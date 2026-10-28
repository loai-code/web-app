'use strict';
// Service worker: gør web-appen hurtig og brugbar offline.
// VERSION og PRECACHE indsættes af build.py – en ny version udløser "Opdatér"-beskeden i appen.
const VERSION = 'f743c4d4b48f';
const PRECACHE = ["adhkar-data.js", "adhkar.js", "app.js", "ar-dict-index.js", "asbab.js", "calendar.js", "config.js", "dict-ui.js", "dict.js", "fonts/Amiri-Regular.ttf", "fonts/AmiriQuran-Regular.ttf", "hadith-books-more.js", "hadith-books.js", "hadith-more.js", "hadith.js", "icons/apple-touch-icon.png", "icons/favicon-32.png", "icons/icon-192.png", "icons/icon-512.png", "index.html", "listen.js", "manifest.webmanifest", "notes.js", "pages.css", "pages.js", "qibla.js", "quiz.js", "quran-data.js", "search.js", "sharh.js", "srs.js", "style.css", "sunnah-extra.js", "tafsir-list.js", "tafsir-names-da.js", "tts.js", "ui.js", "web.css", "web.js", "wordlists.js"];
const CORE = 'core-' + VERSION;
const EXTRA = 'extra-v1';           // store ordlister – ændres sjældent, beholdes på tværs af versioner
const BABS = 'babs-' + VERSION;     // hadith-kapitler – følger appens version, så rettelser kommer med

self.addEventListener('install', e => {
    e.waitUntil(caches.open(CORE).then(c => c.addAll(PRECACHE)));
});

self.addEventListener('activate', e => {
    e.waitUntil((async () => {
        for (const k of await caches.keys()) {
            if ((k.startsWith('core-') && k !== CORE) || (k.startsWith('babs-') && k !== BABS)) await caches.delete(k);
        }
        // Ældre versioner gemte kapitelfilerne sammen med ordlisterne – fjern dem, så de nye hentes
        const extra = await caches.open(EXTRA);
        for (const req of await extra.keys()) if (new URL(req.url).pathname.includes('/babs/')) await extra.delete(req);
        await self.clients.claim();
    })());
});

self.addEventListener('message', e => {
    if (e.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', e => {
    const req = e.request;
    const url = new URL(req.url);
    if (req.method !== 'GET' || url.origin !== location.origin) return; // lyd, oversættelse osv. går direkte til nettet

    if (req.mode === 'navigate') {
        e.respondWith(caches.match('index.html').then(r => r || fetch(req)));
        return;
    }
    const isBabs = url.pathname.includes('/babs/');
    e.respondWith((isBabs ? caches.open(BABS).then(c => c.match(req, { ignoreSearch: true })) : caches.match(req, { ignoreSearch: true })).then(hit => {
        if (hit) return hit;
        return fetch(req).then(res => {
            if (res.ok && /\.(js|css|ttf|woff2?|png|json)$/.test(url.pathname)) {
                const copy = res.clone();
                caches.open(isBabs ? BABS : EXTRA).then(c => c.put(req, copy));
            }
            return res;
        });
    }));
});
