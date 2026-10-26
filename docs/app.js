'use strict';

// =================================================================
// Konstanter
// =================================================================

const MADHAB_NAMES = {
    1: 'Hovedværker · أمهات التفاسير',
    2: 'Sunni · تفاسير أهل السنة',
    3: 'Sunni (sufi) · تفاسير أهل السنة الصوفية',
    10: 'Sunni (salafi) · تفاسير أهل السنة السلفية',
    9: 'Lettilgængelige · تفاسير ميسرة',
    7: 'Moderne · تفاسير حديثة',
    8: 'Korte · تفاسير مختصرة',
    4: 'Shia (12-imam) · تفاسير الشيعة الإثنى عشرية',
    5: 'Zaidi · تفاسير الزيدية',
    6: 'Ibadi · تفاسير الاباضية'
};
const MADHAB_ORDER = [1, 2, 10, 3, 9, 7, 8, 4, 5, 6];
const DEFAULT_TAFSIR = 98; // as-Sa'di: klart moderne arabisk, oversættes godt

const TARGET_LANGS = [
    ['da', 'Dansk'], ['en', 'Engelsk'], ['sv', 'Svensk'], ['no', 'Norsk'], ['de', 'Tysk'],
    ['nl', 'Hollandsk'], ['fr', 'Fransk'], ['es', 'Spansk'], ['tr', 'Tyrkisk'], ['ur', 'Urdu'],
    ['bs', 'Bosnisk'], ['sq', 'Albansk'], ['so', 'Somali'], ['fa', 'Persisk'], ['ku', 'Kurdisk'],
    ['ps', 'Pashto'], ['id', 'Indonesisk'], ['ms', 'Malajisk'], ['ar', 'Arabisk']
];
const LANG_NAME = Object.fromEntries(TARGET_LANGS);

// Færdige (menneskelige) oversættelser fra fawazahmed0/quran-api (gratis, uden nøgle)
const EDITIONS = [
    ['eng-mustafakhattaba', 'Engelsk – The Clear Quran (Khattab)'],
    ['swe-knutbernstrom', 'Svensk – Knut Bernström'],
    ['nor-einarberg', 'Norsk – Einar Berg'],
    ['deu-frankbubenheima', 'Tysk – Bubenheim & Elyas'],
    ['fra-muhammadhamidul', 'Fransk – Hamidullah'],
    ['tur-diyanetisleri', 'Tyrkisk – Diyanet'],
    ['bos-besimkorkut', 'Bosnisk – Besim Korkut'],
    ['urd-muhammadjunagar', 'Urdu – Junagarhi'],
    ['fas-hussainansarian', 'Persisk – Ansarian'],
    ['som-mahmudmuhammada', 'Somali – Mahmud Abduh']
];
const RTL_EDITIONS = new Set(['urd-muhammadjunagar', 'fas-hussainansarian']);
const RTL_LANGS = new Set(['ar', 'ur', 'fa', 'ps']);

// =================================================================
// Tilstand og indstillinger
// =================================================================

const store = {
    get(key, fallback) {
        try {
            const v = localStorage.getItem('qm.' + key);
            return v === null ? fallback : JSON.parse(v);
        } catch (e) { return fallback; }
    },
    set(key, value) {
        try { localStorage.setItem('qm.' + key, JSON.stringify(value)); } catch (e) { /* ignorer */ }
    }
};

const settings = Object.assign({
    surah: 1, start: 1, end: 7, shuffle: true, hide: true,
    translation: 'mt-en', targetLang: 'da', useAllah: true,
    tafsir: DEFAULT_TAFSIR, autoTafsir: true, autoTranslateTafsir: false,
    theme: 'auto', reciter: 'Alafasy_128kbps', repeat: false,
    fontArabic: 32, fontTrans: 18, fontTafsir: 20
}, store.get('settings', {}));
function saveSettings() { store.set('settings', settings); if (typeof scheduleMirror === 'function') scheduleMirror(); }

let questions = [];
let currentIndex = 0;
let revealed = false;
let currentAudio = null;

const tafsirState = {
    key: null,        // "tafsirId:surah:ayah"
    pages: [],        // [{ nodes: [...], text }]
    hasMore: false,
    view: 'original',
    translated: null, // oversat tekst for alle hentede sider
    translatedLang: null,
    loading: false
};

const cache = new Map(); // simpel hukommelsescache for netværkssvar

// =================================================================
// DOM
// =================================================================

const $ = (id) => document.getElementById(id);
const surahSelect = $('surahSelect');
const startVerse = $('startVerse');
const endVerse = $('endVerse');
const shuffleCheck = $('shuffleCheck');
const hideCheck = $('hideCheck');
const startBtn = $('startBtn');
const refSurah = $('refSurah');
const refVerse = $('refVerse');
const refProgress = $('refProgress');
const prevBtn = $('prevBtn');
const showVerseBtn = $('showVerseBtn');
const nextBtn = $('nextBtn');
const arabicDisplay = $('arabicDisplay');
const translationSelect = $('translationSelect');
const translationDisplay = $('translationDisplay');
const translationNote = $('translationNote');
const tafsirSelect = $('tafsirSelect');
const tafsirTabs = $('tafsirTabs');
const tafsirTranslatedTab = $('tafsirTranslatedTab');
const tafsirStatus = $('tafsirStatus');
const tafsirDisplay = $('tafsirDisplay');
const loadTafsirBtn = $('loadTafsirBtn');
const translateTafsirBtn = $('translateTafsirBtn');
const copyTafsirBtn = $('copyTafsirBtn');
const askAiBtn = $('askAiBtn');
const saveVerseBtn = $('saveVerseBtn');
const aiTask = $('aiTask');
const aiIncludeVerse = $('aiIncludeVerse');
const morePagesBtn = $('morePagesBtn');
const openAltafsirBtn = $('openAltafsirBtn');
const reciterSelect = $('reciterSelect');
const repeatCheck = $('repeatCheck');
const playBtn = $('playBtn');
const targetLang = $('targetLang');
const allahCheck = $('allahCheck');
const autoTafsirCheck = $('autoTafsirCheck');
const autoTranslateTafsirCheck = $('autoTranslateTafsirCheck');
const themeSelect = $('themeSelect');

// =================================================================
// Hjælpefunktioner
// =================================================================

const VERSE_INDEX = new Map(VERSES.map((v, i) => [v[0] + ':' + v[1], i]));
function getVerse(surah, ayah) {
    const v = VERSES[VERSE_INDEX.get(surah + ':' + ayah)];
    return v ? { surah: v[0], ayah: v[1], arabic: v[2], english: v[3] } : null;
}

function toArabicDigits(n) {
    return String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
}

function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

let toastTimer = null;
function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}

function setStatus(el, msg, isError) {
    el.classList.toggle('error', !!isError);
    if (msg && msg.loading) {
        el.innerHTML = '<span class="spinner"></span>';
        el.appendChild(document.createTextNode(msg.loading));
    } else {
        el.textContent = msg || '';
    }
}

function currentVerse() {
    return currentIndex < questions.length ? questions[currentIndex] : null;
}

// =================================================================
// Netværk: via Android-broen (omgår CORS og håndterer windows-1256).
// I web-appen (iPhone/browser) hentes kilder der tillader det direkte (CORS),
// resten via web-appens proxy (Cloudflare Worker, se web-app/proxy) eller
// udviklingsserverens /__proxy når siden testes lokalt.
// =================================================================

const DIRECT_HOSTS = ['translate.googleapis.com', 'clients5.google.com', 'cdn.jsdelivr.net', 'raw.githubusercontent.com', 'hadeethenc.com'];

function webProxy() {
    const cfg = window.APP_CONFIG && APP_CONFIG.proxy;
    if (cfg) return cfg.replace(/\/+$/, '');
    return location.hostname === 'localhost' || location.hostname === '127.0.0.1' ? '/__proxy' : '';
}

async function webRequest(url, method, body, charset) {
    const decode = async r => {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return new TextDecoder(charset || 'utf-8').decode(await r.arrayBuffer());
    };
    if (DIRECT_HOSTS.includes(new URL(url).hostname)) {
        return decode(await fetch(url, method === 'POST'
            ? { method, body, headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' } }
            : {}));
    }
    const proxy = webProxy();
    if (!proxy) throw new Error('Denne kilde kræver web-appens proxy – se vejledningen');
    const q = new URLSearchParams({ url, method, charset });
    const r = await fetch(proxy + '?' + q, { method: 'POST', body });
    // Udviklingsserveren sender tekst i UTF-8; web-proxyen sender de rå bytes, som afkodes her
    if (proxy === '/__proxy') { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); }
    return decode(r);
}

const pendingRequests = {};
let requestSeq = 0;

window.__bridgeDone = function (id, ok, text) {
    const p = pendingRequests[id];
    if (!p) return;
    delete pendingRequests[id];
    if (ok) p.resolve(text); else p.reject(new Error(text || 'Netværksfejl'));
};

function httpRequest(url, opts = {}) {
    const method = opts.method || 'GET';
    const body = opts.body || '';
    const charset = opts.charset || 'utf-8';
    const cacheKey = method + ' ' + url + ' ' + body;
    if (cache.has(cacheKey)) return Promise.resolve(cache.get(cacheKey));

    let promise;
    if (window.AndroidBridge && AndroidBridge.request) {
        promise = new Promise((resolve, reject) => {
            const id = 'r' + (++requestSeq);
            pendingRequests[id] = { resolve, reject };
            AndroidBridge.request(id, url, method, body, charset);
        });
    } else {
        promise = webRequest(url, method, body, charset);
    }
    return promise.then(text => {
        cache.set(cacheKey, text);
        return text;
    });
}

function openExternal(url) {
    if (window.AndroidBridge && AndroidBridge.openExternal) AndroidBridge.openExternal(url);
    else window.open(url, '_blank', 'noopener');
}

function copyText(text) {
    if (window.AndroidBridge && AndroidBridge.copyText) {
        AndroidBridge.copyText(text);
        toast('Kopieret ✓');
        return;
    }
    const done = () => toast('Kopieret ✓');
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(done, () => legacyCopy(text) && done());
    } else if (legacyCopy(text)) {
        done();
    }
}
function legacyCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove();
    if (!ok) toast('Kunne ikke kopiere');
    return ok;
}

// =================================================================
// Maskinoversættelse (gratis Google Translate-endpoint, ingen nøgle)
// =================================================================

function splitIntoChunks(text, maxLen) {
    const chunks = [];
    let rest = text;
    while (rest.length > maxLen) {
        let cut = -1;
        for (const sep of ['\n', '. ', '.', '؛', '،', '; ', ', ', ' ']) {
            const i = rest.lastIndexOf(sep, maxLen);
            if (i > maxLen * 0.4) { cut = i + sep.length; break; }
        }
        if (cut < 0) cut = maxLen;
        chunks.push(rest.slice(0, cut));
        rest = rest.slice(cut);
    }
    if (rest.trim()) chunks.push(rest);
    return chunks;
}

function postProcessTranslation(text, lang) {
    if (settings.useAllah && (lang === 'da' || lang === 'no' || lang === 'sv')) {
        text = text.replace(/\bGud(s?)\b/g, 'Allah$1');
    }
    if (settings.useAllah && lang === 'de') {
        text = text.replace(/\bGott(es)?\b/g, (m, s) => s ? 'Allahs' : 'Allah');
    }
    return text;
}

async function translateText(text, source, target, onProgress) {
    const chunks = splitIntoChunks(text, 1800);
    const out = [];
    for (let i = 0; i < chunks.length; i++) {
        if (onProgress) onProgress(i + 1, chunks.length);
        out.push(await translateChunk(chunks[i], source, target));
    }
    return postProcessTranslation(out.join(''), target);
}

// Først Googles "gtx"-endpoint; ved fejl (fx 429 = for mange forespørgsler)
// prøves et andet gratis Google-endpoint med mindre bidder.
async function translateChunk(chunk, source, target) {
    try {
        const url = 'https://translate.googleapis.com/translate_a/single?client=gtx&dt=t'
            + '&sl=' + encodeURIComponent(source) + '&tl=' + encodeURIComponent(target);
        const data = JSON.parse(await httpRequest(url, { method: 'POST', body: 'q=' + encodeURIComponent(chunk) }));
        return (data[0] || []).map(seg => seg[0] || '').join('');
    } catch (firstErr) {
        try {
            const parts = [];
            for (const piece of splitIntoChunks(chunk, 500)) {
                const url = 'https://clients5.google.com/translate_a/t?client=dict-chrome-ex'
                    + '&sl=' + encodeURIComponent(source) + '&tl=' + encodeURIComponent(target)
                    + '&q=' + encodeURIComponent(piece);
                const data = JSON.parse(await httpRequest(url));
                const first = data[0];
                parts.push(Array.isArray(first) ? first[0] : first);
            }
            return parts.join(' ');
        } catch (secondErr) {
            if (/429/.test(firstErr.message + secondErr.message)) {
                throw new Error('Google begrænser midlertidigt antallet af oversættelser – prøv igen om lidt, eller brug "Spørg AI"');
            }
            throw firstErr;
        }
    }
}

// =================================================================
// Opsætning af dropdowns
// =================================================================

function populateSurahs() {
    for (let s = 1; s <= 114; s++) {
        const opt = document.createElement('option');
        opt.value = s;
        opt.textContent = `${s}. ${SURAH_NAMES_EN[s]} · ${SURAH_NAMES_AR[s - 1]}`;
        surahSelect.appendChild(opt);
    }
}

function populateTranslations() {
    translationSelect.innerHTML = '';
    const lang = LANG_NAME[settings.targetLang] || settings.targetLang;
    // Web-appen kan nøjes med den indbyggede oversættelse (APP_CONFIG.builtinTranslationOnly i web-app/web/config.js)
    const onlyBuiltin = !!(window.APP_CONFIG && APP_CONFIG.builtinTranslationOnly);
    const groups = onlyBuiltin ? [['Indbygget', [['builtin', 'Engelsk – Sahih International (offline)']]]] : [
        ['Indbygget', [['builtin', 'Engelsk – Sahih International (offline)']]],
        ['Maskinoversat (Google)', [
            ['mt-en', `${lang} – maskinoversat fra engelsk (anbefalet)`],
            ['mt-ar', `${lang} – maskinoversat direkte fra arabisk`]
        ]],
        ['Færdige oversættelser (online)', EDITIONS]
    ];
    for (const [label, items] of groups) {
        const og = document.createElement('optgroup');
        og.label = label;
        for (const [value, text] of items) {
            const opt = document.createElement('option');
            opt.value = value;
            opt.textContent = text;
            og.appendChild(opt);
        }
        translationSelect.appendChild(og);
    }
    translationSelect.value = settings.translation;
    if (!translationSelect.value) translationSelect.value = onlyBuiltin ? 'builtin' : 'mt-en';
}

// "Ibn Kathir – Fortolkning af den storslåede Koran · تفسير القرآن العظيم/ ابن كثير (ت 774 هـ)"
function tafsirLabel(id, name, death, lang) {
    const da = TAFSIR_NAMES_DA[id];
    const ar = lang === 2 ? '' : `${name} ${death}`.trim();
    if (!da) return ar || name;
    const daText = `${da[0]} – ${da[1]}`;
    return ar ? `${daText}  ·  ${ar}` : daText;
}

function populateTafsirs() {
    for (const m of MADHAB_ORDER) {
        const items = TAFSIRS.filter(t => t[0] === m);
        if (!items.length) continue;
        const og = document.createElement('optgroup');
        og.label = MADHAB_NAMES[m];
        for (const [, id, name, death, lang] of items) {
            const opt = document.createElement('option');
            opt.value = id;
            opt.textContent = tafsirLabel(id, name, death, lang);
            og.appendChild(opt);
        }
        tafsirSelect.appendChild(og);
    }
    tafsirSelect.value = settings.tafsir;
    if (!tafsirSelect.value) tafsirSelect.value = DEFAULT_TAFSIR;
}

function populateReciters() {
    for (const [folder, name, bitrate] of RECITERS) {
        const opt = document.createElement('option');
        opt.value = folder;
        opt.textContent = `${name.replace(/_/g, ' ')} (${bitrate})`;
        reciterSelect.appendChild(opt);
    }
    reciterSelect.value = settings.reciter;
    if (!reciterSelect.value) reciterSelect.selectedIndex = 0;
}

function populateTargetLangs() {
    for (const [code, name] of TARGET_LANGS) {
        const opt = document.createElement('option');
        opt.value = code;
        opt.textContent = name;
        targetLang.appendChild(opt);
    }
    targetLang.value = settings.targetLang;
}

// =================================================================
// Font-størrelser
// =================================================================

const FONT_TARGETS = {
    arabic: { el: arabicDisplay, key: 'fontArabic', min: 18, max: 72 },
    trans: { el: translationDisplay, key: 'fontTrans', min: 12, max: 40 },
    tafsir: { el: tafsirDisplay, key: 'fontTafsir', min: 12, max: 44 }
};
function applyFont(name) {
    const t = FONT_TARGETS[name];
    t.el.style.fontSize = settings[t.key] + 'px';
    document.querySelector(`.font-controls[data-target="${name}"] .size`).textContent = settings[t.key];
}
document.querySelectorAll('.font-controls').forEach(fc => {
    const name = fc.dataset.target;
    fc.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
        const t = FONT_TARGETS[name];
        settings[t.key] = Math.min(t.max, Math.max(t.min, settings[t.key] + Number(b.dataset.step)));
        applyFont(name);
        saveSettings();
    }));
});

// =================================================================
// Session og visning
// =================================================================

function clampRange() {
    const max = AYAH_COUNT[Number(surahSelect.value) - 1];
    startVerse.max = max;
    endVerse.max = max;
}

// Starter en øvesession med en given liste af {surah, ayah} (bruges fra Noter)
function startSessionWithVerses(list, shuffle) {
    questions = list.map(x => getVerse(x.surah, x.ayah)).filter(Boolean);
    if (!questions.length) { toast('Ingen vers at øve'); return; }
    if (shuffle) shuffleArray(questions);
    currentIndex = 0;
    showCurrent();
}

function startSession() {
    const surah = Number(surahSelect.value);
    const max = AYAH_COUNT[surah - 1];
    let start = parseInt(startVerse.value, 10);
    let end = parseInt(endVerse.value, 10);
    if (isNaN(start) || isNaN(end)) { toast('Udfyld versnumre'); return; }
    start = Math.min(Math.max(1, start), max);
    end = Math.min(Math.max(1, end), max);
    if (start > end) [start, end] = [end, start];
    startVerse.value = start;
    endVerse.value = end;

    questions = [];
    for (let a = start; a <= end; a++) {
        const v = getVerse(surah, a);
        if (v) questions.push(v);
    }
    if (!questions.length) { toast('Ingen vers fundet'); return; }
    if (shuffleCheck.checked) shuffleArray(questions);

    Object.assign(settings, { surah, start, end, shuffle: shuffleCheck.checked, hide: hideCheck.checked });
    saveSettings();

    currentIndex = 0;
    showCurrent();
}

function showCurrent() {
    stopAudio();
    const q = currentVerse();
    revealed = false;
    resetTafsir();
    if (!q) {
        refSurah.textContent = questions.length ? '✅ Session afsluttet!' : 'Vælg sura og tryk Start';
        refVerse.textContent = questions.length ? 'Tryk Start for at øve igen' : '';
        refProgress.textContent = '';
        arabicDisplay.innerHTML = '';
        translationDisplay.textContent = '';
        translationNote.textContent = '';
        prevBtn.disabled = currentIndex === 0 || !questions.length;
        showVerseBtn.disabled = nextBtn.disabled = playBtn.disabled = true;
        saveVerseBtn.disabled = true;
        loadTafsirBtn.disabled = openAltafsirBtn.disabled = true;
        if (typeof afterShowCurrent === 'function') afterShowCurrent(null);
        return;
    }
    refSurah.innerHTML = '';
    const ar = document.createElement('span');
    ar.className = 'ar';
    ar.textContent = 'سورة ' + SURAH_NAMES_AR[q.surah - 1];
    refSurah.append(ar, document.createTextNode(`${q.surah}. ${SURAH_NAMES_EN[q.surah]}`));
    refVerse.textContent = `Vers ${q.ayah}`;
    refProgress.textContent = `${currentIndex + 1} / ${questions.length}`;
    prevBtn.disabled = currentIndex === 0;
    nextBtn.disabled = false;
    playBtn.disabled = false;
    openAltafsirBtn.disabled = false;
    saveVerseBtn.disabled = false;

    if (hideCheck.checked) {
        showVerseBtn.disabled = false;
        loadTafsirBtn.disabled = true;
        arabicDisplay.innerHTML = '<div class="placeholder">Recitér verset udenad – tryk <b>Vis vers</b> for at tjekke dig selv.</div>';
        translationDisplay.textContent = '';
        translationNote.textContent = '';
    } else {
        reveal();
    }
    if (typeof afterShowCurrent === 'function') afterShowCurrent(q);
    if (revealed && typeof afterReveal === 'function') afterReveal(q);
}

function reveal() {
    const q = currentVerse();
    if (!q) return;
    revealed = true;
    showVerseBtn.disabled = true;
    loadTafsirBtn.disabled = false;

    // Hvert ord er trykbart → slå op i ordbog
    arabicDisplay.textContent = '';
    q.arabic.trim().split(/\s+/).forEach(word => {
        const span = document.createElement('span');
        span.className = 'w';
        span.textContent = word;
        arabicDisplay.append(span, ' ');
    });
    const num = document.createElement('span');
    num.className = 'ayah-num';
    num.textContent = toArabicDigits(q.ayah);
    arabicDisplay.appendChild(num);

    renderTranslation(q);
    if (autoTafsirCheck.checked) loadTafsir();
    if (typeof afterReveal === 'function') afterReveal(q);
}

function goNext() {
    if (currentIndex < questions.length) currentIndex++;
    showCurrent();
}
function goPrev() {
    if (currentIndex > 0) currentIndex--;
    showCurrent();
}

// =================================================================
// Oversættelse af vers
// =================================================================

let translationToken = 0;
async function renderTranslation(q) {
    const mode = translationSelect.value;
    const token = ++translationToken;
    translationDisplay.dir = 'ltr';
    translationDisplay.style.textAlign = '';
    translationNote.textContent = '';

    if (mode === 'builtin') {
        translationDisplay.textContent = q.english;
        translationNote.textContent = 'Sahih International (indbygget).';
        return;
    }

    translationDisplay.innerHTML = '<span class="spinner"></span>Henter oversættelse…';
    try {
        let text;
        if (mode === 'mt-en' || mode === 'mt-ar') {
            const lang = settings.targetLang;
            const fromAr = mode === 'mt-ar';
            text = await translateText(fromAr ? q.arabic : q.english, fromAr ? 'ar' : 'en', lang);
            if (token !== translationToken) return;
            translationDisplay.dir = RTL_LANGS.has(lang) ? 'rtl' : 'ltr';
            translationDisplay.textContent = text;
            if (!fromAr && lang !== 'en') {
                const src = document.createElement('span');
                src.className = 'source';
                src.textContent = q.english;
                translationDisplay.appendChild(src);
            }
            translationNote.textContent = fromAr
                ? 'Maskinoversat direkte fra arabisk med Google Translate – kan indeholde fejl.'
                : 'Maskinoversat fra Sahih International (engelsk) med Google Translate – kan indeholde fejl. Den engelske tekst står nederst.';
        } else {
            text = await fetchEditionVerse(mode, q.surah, q.ayah);
            if (token !== translationToken) return;
            translationDisplay.dir = RTL_EDITIONS.has(mode) ? 'rtl' : 'ltr';
            translationDisplay.textContent = text;
            const ed = EDITIONS.find(e => e[0] === mode);
            translationNote.textContent = ed ? ed[1] + ' (via quran-api).' : '';
        }
    } catch (err) {
        if (token !== translationToken) return;
        translationDisplay.textContent = q.english;
        translationNote.textContent = '⚠ Kunne ikke hente oversættelse (' + err.message + '). Viser engelsk.';
    }
}

async function fetchEditionVerse(edition, surah, ayah) {
    const path = `editions/${edition}/${surah}/${ayah}.json`;
    const urls = [
        `https://cdn.jsdelivr.net/gh/fawazahmed0/quran-api@1/${path}`,
        `https://raw.githubusercontent.com/fawazahmed0/quran-api/1/${path}`
    ];
    let lastErr;
    for (const url of urls) {
        try {
            const data = JSON.parse(await httpRequest(url));
            if (data && data.text) return data.text;
        } catch (e) { lastErr = e; }
    }
    throw lastErr || new Error('ingen tekst');
}

// =================================================================
// Tafsir fra altafsir.com
// =================================================================

function tafsirInfo(id) {
    return TAFSIRS.find(t => t[1] === Number(id)) || TAFSIRS[0];
}

function altafsirUrl(tafsirId, surah, ayah, page) {
    const [madhab, id, , , lang] = tafsirInfo(tafsirId);
    return 'https://www.altafsir.com/Tafasir.asp?tMadhNo=' + madhab + '&tTafsirNo=' + id
        + '&tSoraNo=' + surah + '&tAyahNo=' + ayah + '&tDisplay=yes'
        + (page ? '&Page=' + page + '&Size=1' : '') + '&UserProfile=0&LanguageId=' + (lang === 2 ? 2 : 1);
}

function resetTafsir() {
    tafsirState.key = null;
    tafsirState.pages = [];
    tafsirState.hasMore = false;
    tafsirState.translated = null;
    tafsirState.translatedLang = null;
    tafsirState.view = 'original';
    tafsirState.loading = false;
    tafsirDisplay.innerHTML = '';
    tafsirTabs.hidden = true;
    translateTafsirBtn.hidden = true;
    copyTafsirBtn.hidden = true;
    askAiBtn.hidden = true;
    loadTafsirBtn.hidden = false;
    morePagesBtn.hidden = true;
    setStatus(tafsirStatus, '');
}

// Udtrækker tafsir-teksten fra altafsir-siden som en liste af {text, quote}-stykker
function parseAltafsir(html, page) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const root = doc.getElementById('SearchResults');
    if (!root) return null;
    root.querySelectorAll('#AyahMenu, #AyahText, center, label, script, style, table').forEach(e => e.remove());

    const parts = [];
    const walk = (node, quote) => {
        for (const child of node.childNodes) {
            if (child.nodeType === 3) {
                const t = child.nodeValue.replace(/\s+/g, ' ');
                if (t.trim() || (parts.length && t === ' ')) parts.push({ text: t, quote });
            } else if (child.nodeType === 1) {
                const tag = child.tagName;
                if (tag === 'BR' || tag === 'P' || tag === 'DIV') parts.push({ text: '\n', quote: false });
                const color = (child.getAttribute('color') || '').toLowerCase();
                walk(child, quote || color === 'red' || color === '#ff0000');
                if (tag === 'P' || tag === 'DIV') parts.push({ text: '\n', quote: false });
            }
        }
    };
    walk(root, false);

    // Ryd op i whitespace
    let text = parts.map(p => p.text).join('').replace(/[ \t]*\n[ \t]*/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    if (!text) return { parts: [], text: '', hasMore: false };

    const pageNums = [...html.matchAll(/InnerLink_onchange\(\d+,(\d+),\d+\)/g)].map(m => Number(m[1]));
    const hasMore = pageNums.some(n => n > page);
    return { parts, text, hasMore };
}

async function loadTafsir() {
    const q = currentVerse();
    if (!q || !revealed) return;
    const tafsirId = Number(tafsirSelect.value);
    const key = tafsirId + ':' + q.surah + ':' + q.ayah;
    if (tafsirState.key === key && (tafsirState.pages.length || tafsirState.loading)) return;
    resetTafsir();
    tafsirState.key = key;
    await loadTafsirPage(1);
}

async function loadTafsirPage(page) {
    const q = currentVerse();
    const key = tafsirState.key;
    if (!q || !key) return;
    const tafsirId = Number(key.split(':')[0]);
    tafsirState.loading = true;
    loadTafsirBtn.disabled = true;
    morePagesBtn.disabled = true;
    setStatus(tafsirStatus, { loading: page > 1 ? `Henter side ${page}…` : 'Henter tafsir fra altafsir.com…' });
    try {
        const html = await httpRequest(altafsirUrl(tafsirId, q.surah, q.ayah, page), { charset: 'windows-1256' });
        if (tafsirState.key !== key) return;
        const parsed = parseAltafsir(html, page);
        if (!parsed) throw new Error('Kunne ikke læse siden');
        if (!parsed.text) {
            if (page === 1) {
                setStatus(tafsirStatus, 'Denne tafsir har ingen tekst til netop dette vers (kommentaren står måske ved et af de omkringliggende vers). Prøv en anden tafsir eller åbn altafsir.com.');
            } else {
                tafsirState.hasMore = false;
                setStatus(tafsirStatus, '');
            }
        } else {
            tafsirState.pages.push(parsed);
            tafsirState.hasMore = parsed.hasMore;
            tafsirState.translated = null; // ny side → skal oversættes igen
            setStatus(tafsirStatus, '');
        }
        renderTafsir();
        if (parsed.text && autoTranslateTafsirCheck.checked && settings.targetLang !== tafsirSourceLang()) {
            translateTafsir();
        }
    } catch (err) {
        if (tafsirState.key !== key) return;
        setStatus(tafsirStatus, '⚠ Kunne ikke hente tafsir: ' + err.message + '. Tjek internetforbindelsen.', true);
    } finally {
        if (tafsirState.key === key) {
            tafsirState.loading = false;
            loadTafsirBtn.disabled = !revealed;
            morePagesBtn.disabled = false;
        }
    }
}

function tafsirSourceLang() {
    const info = tafsirInfo(tafsirState.key ? tafsirState.key.split(':')[0] : tafsirSelect.value);
    return info[4] === 2 ? 'en' : 'ar';
}

function tafsirOriginalText() {
    return tafsirState.pages.map(p => p.text).join('\n\n');
}

function renderTafsir() {
    const hasText = tafsirState.pages.length > 0;
    const srcLang = tafsirSourceLang();
    const lang = settings.targetLang;
    const canTranslate = hasText && lang !== srcLang;

    tafsirTabs.hidden = !(tafsirState.translated && canTranslate);
    tafsirTranslatedTab.textContent = LANG_NAME[lang] || lang;
    tafsirTabs.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === tafsirState.view));
    translateTafsirBtn.hidden = !canTranslate || !!tafsirState.translated;
    translateTafsirBtn.textContent = 'Oversæt til ' + (LANG_NAME[lang] || lang).toLowerCase();
    copyTafsirBtn.hidden = !hasText;
    askAiBtn.hidden = !hasText;
    loadTafsirBtn.hidden = hasText;
    morePagesBtn.hidden = !tafsirState.hasMore;
    morePagesBtn.textContent = `Næste side (${tafsirState.pages.length + 1}) ›`;

    tafsirDisplay.innerHTML = '';
    if (!hasText) return;

    if (tafsirState.view === 'translated' && tafsirState.translated) {
        tafsirDisplay.className = 'tafsir-box' + (RTL_LANGS.has(lang) ? ' ar' : '');
        tafsirDisplay.dir = RTL_LANGS.has(lang) ? 'rtl' : 'ltr';
        tafsirDisplay.textContent = tafsirState.translated;
        return;
    }

    const isAr = srcLang === 'ar';
    tafsirDisplay.className = 'tafsir-box' + (isAr ? ' ar' : '');
    tafsirDisplay.dir = isAr ? 'rtl' : 'ltr';
    tafsirState.pages.forEach((page, i) => {
        if (i > 0) {
            const sep = document.createElement('span');
            sep.className = 'page-sep';
            sep.textContent = `✦ side ${i + 1} ✦`;
            tafsirDisplay.appendChild(sep);
        }
        // Byg teksten op med sikre DOM-noder (ingen fremmed HTML indsættes)
        const frag = document.createDocumentFragment();
        let buf = '', bufQuote = false;
        const flush = () => {
            if (!buf) return;
            if (bufQuote) {
                const s = document.createElement('span');
                s.className = 'q';
                s.textContent = buf;
                frag.appendChild(s);
            } else {
                frag.appendChild(document.createTextNode(buf));
            }
            buf = '';
        };
        for (const p of page.parts) {
            if (p.quote !== bufQuote) { flush(); bufQuote = p.quote; }
            buf += p.text;
        }
        flush();
        const wrap = document.createElement('div');
        wrap.appendChild(frag);
        wrap.innerHTML = wrap.innerHTML.replace(/^\s+/, '');
        tafsirDisplay.appendChild(wrap);
    });
    applyFont('tafsir');
}

async function translateTafsir() {
    if (!tafsirState.pages.length || tafsirState.loading) return;
    const key = tafsirState.key;
    const lang = settings.targetLang;
    const src = tafsirSourceLang();
    translateTafsirBtn.disabled = true;
    tafsirState.loading = true;
    try {
        const text = await translateText(tafsirOriginalText(), src, lang, (i, n) => {
            if (tafsirState.key === key) setStatus(tafsirStatus, { loading: n > 1 ? `Oversætter… (${i}/${n})` : 'Oversætter…' });
        });
        if (tafsirState.key !== key) return;
        tafsirState.translated = text;
        tafsirState.translatedLang = lang;
        tafsirState.view = 'translated';
        setStatus(tafsirStatus, '');
        renderTafsir();
    } catch (err) {
        if (tafsirState.key !== key) return;
        setStatus(tafsirStatus, '⚠ Oversættelse mislykkedes: ' + err.message, true);
    } finally {
        if (tafsirState.key === key) tafsirState.loading = false;
        translateTafsirBtn.disabled = false;
    }
}

function copyTafsir() {
    const q = currentVerse();
    const info = tafsirInfo(tafsirState.key ? tafsirState.key.split(':')[0] : tafsirSelect.value);
    const body = tafsirState.view === 'translated' && tafsirState.translated
        ? tafsirState.translated
        : tafsirOriginalText();
    const header = q ? `${info[2]} – ${SURAH_NAMES_EN[q.surah]} ${q.surah}:${q.ayah}\n\n` : '';
    copyText(header + body);
}

// =================================================================
// Spørg AI: sender tafsiren med en færdig instruktion til en AI-app
// (ChatGPT, DeepSeek, Claude, Gemini) – uden API-nøgle.
// =================================================================

const AI_WEB = {
    chatgpt: 'https://chatgpt.com/',
    deepseek: 'https://chat.deepseek.com/',
    claude: 'https://claude.ai/new',
    gemini: 'https://gemini.google.com/app'
};
const AI_NAMES = { chatgpt: 'ChatGPT', deepseek: 'DeepSeek', claude: 'Claude', gemini: 'Gemini', other: 'appen' };

// payload: { kind: 'tafsir' | 'hadith', ref, srcLang: 'ar' | 'en', sourceName, body, verse? }
let aiPayload = null;

function tafsirAiPayload() {
    const q = currentVerse();
    const info = tafsirInfo(tafsirState.key ? tafsirState.key.split(':')[0] : tafsirSelect.value);
    return {
        kind: 'tafsir',
        ref: q ? `sura ${q.surah} (${SURAH_NAMES_EN[q.surah]}), vers ${q.ayah}` : '',
        srcLang: tafsirSourceLang(),
        sourceName: `${info[2]} ${info[3]}`.trim(),
        body: tafsirOriginalText(),
        verse: q
    };
}

function buildAiPrompt(p) {
    const lang = (LANG_NAME[settings.targetLang] || 'dansk').toLowerCase();
    const srcLang = p.srcLang === 'en' ? 'engelsk' : 'arabisk';
    const allah = settings.useAllah ? ' Skriv "Allah" – ikke "Gud".' : '';
    const isSharh = p.kind === 'sharh';
    const isHadith = p.kind === 'hadith' || isSharh;
    const what = isSharh
        ? `følgende klassiske hadith-kommentar (sharh) af ${p.ref}`
        : isHadith
            ? `følgende hadith (${p.ref})`
            : `følgende tafsir (Koran-kommentar) af ${p.ref}`;
    const it = isSharh ? 'kommentaren' : isHadith ? 'hadithen og forklaringen' : 'tafsiren';

    const tasks = {
        translate: `Oversæt ${what} fra ${srcLang} til ${lang}. `
            + `Oversæt hele teksten tro mod originalen uden at forkorte. Bevar islamiske fagudtryk med en kort forklaring i parentes første gang de optræder, `
            + `og markér Koran-citater og hadith tydeligt.${allah}`,
        explain: `Forklar på ${lang}, kort og enkelt, hvad ${what} siger. `
            + `Skriv til en almindelig læser uden forkundskaber, og hold dig til det ${it} faktisk siger.${allah}`,
        lessons: `Forklar på ${lang} hvad ${what} siger, og opstil derefter de vigtigste lærdomme som punkter. `
            + `Hold dig til det ${it} faktisk siger.${allah}`,
        words: `Gennemgå ${what} og forklar på ${lang} de svære arabiske ord, grammatiske pointer og islamiske begreber, `
            + `der optræder i teksten. Skriv det arabiske ord og forklaringen ved siden af.${allah}`
    };

    const expert = isHadith
        ? 'Du er ekspert i klassisk arabisk og hadith-videnskab. '
        : 'Du er ekspert i klassisk arabisk, Koranen og tafsir. ';
    let text = expert + (tasks[aiTask.value] || tasks.translate) + '\n\n';
    if (!isHadith && p.verse && aiIncludeVerse.checked) {
        text += `Verset (${p.verse.surah}:${p.verse.ayah}):\n${p.verse.arabic}\n\nEngelsk (Sahih International): ${p.verse.english}\n\n`;
    }
    text += `${isSharh ? 'Sharh' : isHadith ? 'Kilde' : 'Tafsir'}: ${p.sourceName}\n\n${p.body}`;
    return text;
}

function openAiSheet(payload) {
    aiPayload = payload || tafsirAiPayload();
    aiTask.value = settings.aiTask || 'translate';
    const isHadith = aiPayload.kind === 'hadith' || aiPayload.kind === 'sharh';
    const isSharh = aiPayload.kind === 'sharh';
    $('aiSheetTitle').textContent = isSharh ? '✨ Spørg AI om sharh-teksten' : isHadith ? '✨ Spørg AI om hadithen' : '✨ Spørg AI om tafsiren';
    aiTask.options[0].textContent = isSharh ? 'Oversæt hele kommentaren' : isHadith ? 'Oversæt hadith og forklaring' : 'Oversæt hele tafsiren';
    $('aiIncludeVerseRow').hidden = isHadith;
    openSheet('aiSheet');
}
function closeAiSheet() {
    closeSheet('aiSheet');
}

function askAi(target) {
    if (!aiPayload || !aiPayload.body) return;
    settings.aiTask = aiTask.value;
    saveSettings();
    const text = buildAiPrompt(aiPayload);
    closeAiSheet();

    if (window.AndroidBridge && AndroidBridge.shareToAi) {
        const result = AndroidBridge.shareToAi(target, text);
        if (result === 'opened-app' || result === 'opened-web') {
            toast(`Teksten er kopieret – sæt den ind i ${AI_NAMES[target]}`);
        } else if (result === 'shared') {
            toast(`Sendt til ${AI_NAMES[target]} (også kopieret)`);
        } else {
            toast('Kunne ikke åbne ' + AI_NAMES[target]);
        }
        return;
    }
    // Web-app/browser: kopiér teksten og åbn tjenesten (på iPhone åbnes appen, hvis den er installeret).
    // ChatGPT og Claude kan få teksten med i adressen, så den står klar.
    copyText(text);
    const prefill = { chatgpt: 'https://chatgpt.com/?q=', claude: 'https://claude.ai/new?q=' }[target];
    const withText = prefill && text.length < 6000;
    const url = withText ? prefill + encodeURIComponent(text) : AI_WEB[target];
    if (url) window.open(url, '_blank', 'noopener');
    toast(withText ? `Åbner ${AI_NAMES[target]} (teksten er også kopieret)` : `Teksten er kopieret – sæt den ind i ${AI_NAMES[target]}`);
}

// Fælles åbning/lukning af bundark med baggrund
function openSheet(id) {
    $('settingsBackdrop').hidden = false;
    $(id).hidden = false;
}
function closeSheet(id) {
    $(id).hidden = true;
    const anyOpen = [...document.querySelectorAll('.sheet')].some(s => !s.hidden);
    if (!anyOpen) $('settingsBackdrop').hidden = true;
}

// =================================================================
// Lyd (EveryAyah)
// =================================================================

function pad3(n) { return String(n).padStart(3, '0'); }

function setPlayState(state) {
    playBtn.querySelector('.play-icon').textContent = state === 'playing' ? '■' : state === 'loading' ? '…' : '▶';
    playBtn.querySelector('.play-label').textContent =
        state === 'playing' ? 'Stop' : state === 'loading' ? 'Henter lyd…' : 'Afspil vers';
}

function stopAudio() {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.src = '';
        currentAudio = null;
    }
    setPlayState('idle');
}

async function togglePlay() {
    if (typeof stopListen === 'function') stopListen();
    if (typeof stopSpeak === 'function') stopSpeak();
    if (currentAudio) { stopAudio(); return; }
    const q = currentVerse();
    if (!q) return;
    const url = `https://everyayah.com/data/${reciterSelect.value}/${pad3(q.surah)}${pad3(q.ayah)}.mp3`;
    const audio = new Audio(url);
    audio.loop = repeatCheck.checked;
    currentAudio = audio;
    setPlayState('loading');
    audio.addEventListener('playing', () => { if (currentAudio === audio) setPlayState('playing'); });
    audio.addEventListener('ended', () => { if (currentAudio === audio) { currentAudio = null; setPlayState('idle'); } });
    audio.addEventListener('error', () => {
        if (currentAudio !== audio) return;
        currentAudio = null;
        setPlayState('idle');
        toast('Kunne ikke afspille lyden – prøv en anden qari');
    });
    try {
        await audio.play();
    } catch (err) {
        if (currentAudio === audio) {
            currentAudio = null;
            setPlayState('idle');
            toast('Kunne ikke afspille lyden');
        }
    }
}

// =================================================================
// Tema og indstillinger
// =================================================================

function applyTheme() {
    if (settings.theme === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', settings.theme);
}

function openSettings() { openSheet('settingsSheet'); }
function closeSettings() { closeSheet('settingsSheet'); }

// =================================================================
// Event listeners
// =================================================================

surahSelect.addEventListener('change', () => {
    clampRange();
    const max = AYAH_COUNT[Number(surahSelect.value) - 1];
    startVerse.value = 1;
    endVerse.value = Math.min(max, 7);
});
$('wholeSurahBtn').addEventListener('click', () => {
    startVerse.value = 1;
    endVerse.value = AYAH_COUNT[Number(surahSelect.value) - 1];
});
startBtn.addEventListener('click', startSession);
arabicDisplay.addEventListener('click', e => {
    const w = e.target.closest('.w');
    if (!w) return;
    w.classList.add('tapped');
    setTimeout(() => w.classList.remove('tapped'), 400);
    chooseAction(w.textContent, [
        { label: 'Find ordet i ordbogen', icon: 'ع', run: () => lookupWord(w.textContent) },
        { label: 'Kopiér ordet', icon: '⧉', run: () => copyText(w.textContent) }
    ]);
});
showVerseBtn.addEventListener('click', reveal);
nextBtn.addEventListener('click', goNext);
prevBtn.addEventListener('click', goPrev);
hideCheck.addEventListener('change', () => {
    settings.hide = hideCheck.checked;
    saveSettings();
    if (!hideCheck.checked && currentVerse() && !revealed) reveal();
});

translationSelect.addEventListener('change', () => {
    settings.translation = translationSelect.value;
    saveSettings();
    const q = currentVerse();
    if (q && revealed) renderTranslation(q);
});

tafsirSelect.addEventListener('change', () => {
    settings.tafsir = Number(tafsirSelect.value);
    saveSettings();
    resetTafsir();
    if (revealed) loadTafsir();
});
loadTafsirBtn.addEventListener('click', () => {
    tafsirState.key = null;
    loadTafsir();
});
morePagesBtn.addEventListener('click', () => loadTafsirPage(tafsirState.pages.length + 1));
translateTafsirBtn.addEventListener('click', translateTafsir);
copyTafsirBtn.addEventListener('click', copyTafsir);
openAltafsirBtn.addEventListener('click', () => {
    const q = currentVerse();
    if (q) openExternal(altafsirUrl(tafsirSelect.value, q.surah, q.ayah, 0));
});
tafsirTabs.addEventListener('click', (e) => {
    const tab = e.target.closest('.tab');
    if (!tab) return;
    tafsirState.view = tab.dataset.view;
    renderTafsir();
});

reciterSelect.addEventListener('change', () => {
    settings.reciter = reciterSelect.value;
    saveSettings();
    stopAudio();
});
repeatCheck.addEventListener('change', () => {
    settings.repeat = repeatCheck.checked;
    saveSettings();
    if (currentAudio) currentAudio.loop = repeatCheck.checked;
});
playBtn.addEventListener('click', togglePlay);

$('settingsBtn').addEventListener('click', openSettings);
$('closeSettingsBtn').addEventListener('click', closeSettings);
$('settingsBackdrop').addEventListener('click', () => closeTopSheet());
askAiBtn.addEventListener('click', () => openAiSheet(tafsirAiPayload()));
saveVerseBtn.addEventListener('click', () => {
    const q = currentVerse();
    if (q) openSaveSheet({ type: 'verse', surah: q.surah, from: q.ayah, to: q.ayah });
});
$('closeAiBtn').addEventListener('click', closeAiSheet);
document.querySelectorAll('#aiSheet [data-ai]').forEach(b =>
    b.addEventListener('click', () => askAi(b.dataset.ai)));
targetLang.addEventListener('change', () => {
    settings.targetLang = targetLang.value;
    saveSettings();
    populateTranslations();
    tafsirState.translated = null;
    tafsirState.view = 'original';
    renderTafsir();
    const q = currentVerse();
    if (q && revealed) renderTranslation(q);
});
allahCheck.addEventListener('change', () => {
    settings.useAllah = allahCheck.checked;
    saveSettings();
    cache.clear();
});
autoTafsirCheck.addEventListener('change', () => { settings.autoTafsir = autoTafsirCheck.checked; saveSettings(); });
autoTranslateTafsirCheck.addEventListener('change', () => { settings.autoTranslateTafsir = autoTranslateTafsirCheck.checked; saveSettings(); });
themeSelect.addEventListener('change', () => {
    settings.theme = themeSelect.value;
    saveSettings();
    applyTheme();
});

// =================================================================
// Init
// =================================================================

populateSurahs();
populateTargetLangs();
populateTranslations();
populateTafsirs();
populateReciters();

surahSelect.value = settings.surah;
clampRange();
startVerse.value = settings.start;
endVerse.value = settings.end;
shuffleCheck.checked = settings.shuffle;
hideCheck.checked = settings.hide;
repeatCheck.checked = settings.repeat;
allahCheck.checked = settings.useAllah;
autoTafsirCheck.checked = settings.autoTafsir;
autoTranslateTafsirCheck.checked = settings.autoTranslateTafsir;
themeSelect.value = settings.theme;
applyTheme();
Object.keys(FONT_TARGETS).forEach(applyFont);
showCurrent();
