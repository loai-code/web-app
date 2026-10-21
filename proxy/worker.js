// =================================================================
// Proxy til Koran-memorering web-appen – Cloudflare Worker (gratis).
// Kopiér HELE denne fil ind i en ny Worker (se VEJLEDNING.md, trin 2).
//
//  POST /?url=…&method=GET|POST&charset=…   henter en side fra en tilladt kilde og sender
//                                           de rå bytes tilbage (appen afkoder selv tegnsættet)
//  GET  /zip?u=<zip-url>&e=0001.mp3          henter én mp3 ud af Bukhari-zip'erne (HTTP Range)
//
// Kun kilderne herunder kan hentes, så proxyen ikke kan misbruges til alt muligt.
// =================================================================

const ALLOWED_HOSTS = new Set([
    'www.altafsir.com', 'altafsir.com',
    'shamela.ws',
    'translate.googleapis.com', 'clients5.google.com',
    'cdn.jsdelivr.net', 'raw.githubusercontent.com',
    'hadeethenc.com',
]);
const ZIP_HOSTS = new Set(['salafiaudio.wordpress.com']);
const UA = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36';

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Range',
    'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
};

export default {
    async fetch(request) {
        if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
        const u = new URL(request.url);
        try {
            if (u.pathname.replace(/\/+$/, '').endsWith('/zip')) return await zipEntry(u, request);
            return await proxy(u, request);
        } catch (e) {
            return new Response(String(e && e.message || e), { status: 502, headers: { ...CORS, 'Content-Type': 'text/plain; charset=utf-8' } });
        }
    },
};

async function proxy(u, request) {
    const target = u.searchParams.get('url');
    if (!target) return new Response('Koran-memorering proxy kører ✓', { headers: { ...CORS, 'Content-Type': 'text/plain; charset=utf-8' } });
    const t = new URL(target);
    if (t.protocol !== 'https:' || !ALLOWED_HOSTS.has(t.hostname)) {
        return new Response('Vært ikke tilladt: ' + t.hostname, { status: 403, headers: CORS });
    }
    const method = (u.searchParams.get('method') || 'GET').toUpperCase() === 'POST' ? 'POST' : 'GET';
    const body = method === 'POST' && request.method === 'POST' ? await request.text() : undefined;
    const r = await fetch(t.toString(), {
        method,
        body,
        redirect: 'follow',
        headers: {
            'User-Agent': UA,
            'Accept-Language': 'ar,da;q=0.9,en;q=0.8',
            ...(method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' } : {}),
        },
    });
    if (!r.ok) return new Response('HTTP ' + r.status, { status: 502, headers: CORS });
    return new Response(r.body, { headers: { ...CORS, 'Content-Type': 'application/octet-stream', 'Cache-Control': 'no-store' } });
}

// ---------- Én mp3 ud af en stor zip (filerne ligger ukomprimeret) ----------

const directories = new Map(); // zip-url → Map(filnavn → [offset, størrelse, metode]); holdes mens workeren er varm

async function zipEntry(u, request) {
    const zipUrl = u.searchParams.get('u') || '';
    const entry = u.searchParams.get('e') || '';
    const z = new URL(zipUrl);
    if (z.protocol !== 'https:' || !ZIP_HOSTS.has(z.hostname) || !/^\d{4}\.mp3$/.test(entry)) {
        return new Response('Ikke tilladt', { status: 403, headers: CORS });
    }
    const dir = await directory(zipUrl);
    const e = dir.get(entry);
    if (!e) return new Response('Lydfilen findes ikke', { status: 404, headers: CORS });
    const [off, size, method] = e;
    if (method !== 0) return new Response('Lydfilen er komprimeret', { status: 500, headers: CORS });
    const data = await range(zipUrl, `bytes=${off}-${off + 30 + 512 + size - 1}`);
    const v = new DataView(data.buffer, data.byteOffset, data.byteLength);
    if (v.getUint32(0, true) !== 0x04034b50) throw new Error('Uventet zip-indhold');
    const start = 30 + v.getUint16(26, true) + v.getUint16(28, true);
    const mp3 = data.subarray(start, start + size);
    if (mp3.length !== size) throw new Error('Lydfilen blev ikke hentet helt');
    return withRange(request, mp3);
}

async function directory(zipUrl) {
    if (directories.has(zipUrl)) return directories.get(zipUrl);
    const tail = await range(zipUrl, 'bytes=-4096');
    let p = -1;
    for (let i = tail.length - 22; i >= 0; i--) {
        if (tail[i] === 0x50 && tail[i + 1] === 0x4b && tail[i + 2] === 0x05 && tail[i + 3] === 0x06) { p = i; break; }
    }
    if (p < 0) throw new Error('Kunne ikke læse zip-filen');
    const tv = new DataView(tail.buffer, tail.byteOffset, tail.byteLength);
    const cdSize = tv.getUint32(p + 12, true), cdOff = tv.getUint32(p + 16, true);
    const raw = await range(zipUrl, `bytes=${cdOff}-${cdOff + cdSize - 1}`);
    const v = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
    const map = new Map();
    const dec = new TextDecoder('latin1');
    for (let i = 0; i + 46 <= raw.length && v.getUint32(i, true) === 0x02014b50;) {
        const method = v.getUint16(i + 10, true), csz = v.getUint32(i + 20, true);
        const n = v.getUint16(i + 28, true), m = v.getUint16(i + 30, true), k = v.getUint16(i + 32, true);
        const off = v.getUint32(i + 42, true);
        map.set(dec.decode(raw.subarray(i + 46, i + 46 + n)), [off, csz, method]);
        i += 46 + n + m + k;
    }
    if (!map.size) throw new Error('Tom zip-oversigt');
    directories.set(zipUrl, map);
    return map;
}

// WordPress' CDN ignorerer af og til Range første gang (svarer 200 med hele filen) – prøv igen
async function range(url, rangeHeader) {
    for (let attempt = 0; attempt < 5; attempt++) {
        const r = await fetch(url, { headers: { 'User-Agent': UA, Range: rangeHeader } });
        if (r.status === 206) return new Uint8Array(await r.arrayBuffer());
        if (r.body) await r.body.cancel();
        if (r.status !== 200) throw new Error('HTTP ' + r.status);
        await new Promise(res => setTimeout(res, 700 * (attempt + 1)));
    }
    throw new Error('Serveren understøtter ikke delvis hentning lige nu – prøv igen');
}

// iPhone kræver at lyd kan hentes i stykker (Range)
function withRange(request, bytes) {
    const headers = {
        ...CORS,
        'Content-Type': 'audio/mpeg',
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=31536000, immutable',
    };
    const m = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get('Range') || '');
    if (!m) return new Response(bytes, { headers: { ...headers, 'Content-Length': String(bytes.length) } });
    let a = m[1] === '' ? Math.max(0, bytes.length - Number(m[2])) : Number(m[1]);
    let b = m[1] === '' || m[2] === '' ? bytes.length - 1 : Math.min(Number(m[2]), bytes.length - 1);
    if (a > b || a >= bytes.length) {
        return new Response(null, { status: 416, headers: { ...headers, 'Content-Range': `bytes */${bytes.length}` } });
    }
    return new Response(bytes.subarray(a, b + 1), {
        status: 206,
        headers: { ...headers, 'Content-Range': `bytes ${a}-${b}/${bytes.length}`, 'Content-Length': String(b - a + 1) },
    });
}
