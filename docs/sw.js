'use strict';
// Service worker: gør web-appen hurtig og brugbar offline.
// VERSION og PRECACHE indsættes af build.py – en ny version udløser "Opdatér"-beskeden i appen.
const VERSION = '06970a5f21d1';
const PRECACHE = ["adhkar-data.js", "adhkar.js", "app.js", "ar-dict-index.js", "asbab.js", "calendar.js", "config.js", "dict-ui.js", "dict.js", "fonts/Amiri-Regular.ttf", "fonts/AmiriQuran-Regular.ttf", "hadith-books.js", "hadith.js", "icons/apple-touch-icon.png", "icons/favicon-32.png", "icons/icon-192.png", "icons/icon-512.png", "index.html", "listen.js", "manifest.webmanifest", "notes.js", "pages.css", "pages.js", "qibla.js", "quiz.js", "quran-data.js", "search.js", "sharh.js", "srs.js", "style.css", "tafsir-list.js", "tafsir-names-da.js", "tts.js", "ui.js", "web.css", "web.js", "wordlists.js"];
const CORE = 'core-' + VERSION;
const EXTRA = 'extra-v1'; // store ordlister m.m., hentes første gang de bruges

self.addEventListener('install', e => {
    e.waitUntil(caches.open(CORE).then(c => c.addAll(PRECACHE)));
});

self.addEventListener('activate', e => {
    e.waitUntil(caches.keys().then(keys => Promise.all(
        keys.filter(k => k.startsWith('core-') && k !== CORE).map(k => caches.delete(k))
    )).then(() => self.clients.claim()));
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
    e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => {
        if (hit) return hit;
        return fetch(req).then(res => {
            if (res.ok && /\.(js|css|ttf|woff2?|png|json)$/.test(url.pathname)) {
                const copy = res.clone();
                caches.open(EXTRA).then(c => c.put(req, copy));
            }
            return res;
        });
    }));
});
