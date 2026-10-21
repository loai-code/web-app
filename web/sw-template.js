'use strict';
// Service worker: gør web-appen hurtig og brugbar offline.
// VERSION og PRECACHE indsættes af build.py – en ny version udløser "Opdatér"-beskeden i appen.
const VERSION = '__VERSION__';
const PRECACHE = __PRECACHE__;
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
