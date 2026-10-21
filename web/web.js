'use strict';

// =================================================================
// Kun i web-appen (iPhone, Android-browser, PC):
//  - offline-cache (service worker) og besked om ny version
//  - vejledning til at installere på hjemmeskærmen
//  - Androids tilbage-knap / browserens tilbage → appens egen tilbage-funktion
//  - bed browseren om ikke at slette noterne
// =================================================================

(function () {
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
    document.documentElement.classList.toggle('is-standalone', standalone);
    document.documentElement.classList.toggle('is-ios', isIOS);

    // ---------- Offline og opdateringer ----------
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
        navigator.serviceWorker.register('sw.js').then(reg => {
            const offerUpdate = worker => {
                const box = el('div', { class: 'web-banner' },
                    el('span', {}, 'Der er en ny version af appen.'),
                    el('button', { type: 'button', class: 'btn btn-small btn-gold', onclick: () => worker.postMessage('skipWaiting') }, 'Opdatér'));
                document.body.appendChild(box);
            };
            if (reg.waiting && navigator.serviceWorker.controller) offerUpdate(reg.waiting);
            reg.addEventListener('updatefound', () => {
                const w = reg.installing;
                w && w.addEventListener('statechange', () => {
                    if (w.state === 'installed' && navigator.serviceWorker.controller) offerUpdate(w);
                });
            });
            // Søg efter ny version, når appen åbnes igen
            document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });
        }).catch(() => {});
        let reloading = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (reloading) return;
            reloading = true;
            location.reload();
        });
    }

    // Noterne ligger i browserens lager – bed om at det ikke ryddes automatisk
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

    // ---------- Installér på hjemmeskærmen ----------
    const HINT_KEY = 'webInstallHintHidden';
    const hintHidden = () => Date.now() < store.get(HINT_KEY, 0);
    const hideHint = box => { store.set(HINT_KEY, Date.now() + 14 * 86400000); box.remove(); };

    if (!standalone && isIOS && !hintHidden()) {
        const box = el('div', { class: 'web-banner install' },
            el('div', {},
                el('b', {}, 'Installér appen på din iPhone'),
                el('ol', {},
                    el('li', {}, 'Tryk på Del-knappen ', el('span', { class: 'share-ico', 'aria-hidden': 'true' }, '⬆'), ' nederst (eller øverst) i Safari'),
                    el('li', {}, 'Vælg "Føj til hjemmeskærm"'),
                    el('li', {}, 'Tryk "Tilføj" – åbn derefter appen fra ikonet'))),
            el('button', { type: 'button', class: 'icon-btn small ghost', 'aria-label': 'Luk', onclick: () => hideHint(box) }, '✕'));
        setTimeout(() => document.body.appendChild(box), 1200);
    }

    let deferredPrompt = null;
    window.addEventListener('beforeinstallprompt', e => {
        e.preventDefault();
        deferredPrompt = e;
        if (hintHidden()) return;
        const box = el('div', { class: 'web-banner install' },
            el('span', {}, 'Installér appen, så den ligger som et ikon og virker offline.'),
            el('button', {
                type: 'button', class: 'btn btn-small btn-gold', onclick: async () => {
                    box.remove();
                    deferredPrompt.prompt();
                    await deferredPrompt.userChoice.catch(() => {});
                    deferredPrompt = null;
                }
            }, 'Installér'),
            el('button', { type: 'button', class: 'icon-btn small ghost', 'aria-label': 'Luk', onclick: () => hideHint(box) }, '✕'));
        document.body.appendChild(box);
    });

    // ---------- Tilbage-knap ----------
    // Der ligger altid ét ekstra trin i historikken; trykker man tilbage, klarer appen det selv
    // (lukker ark, går et niveau op, til forsiden). Først på forsiden forlades appen.
    history.replaceState({ root: true }, '');
    history.pushState({ app: true }, '');
    window.addEventListener('popstate', () => {
        if (window.handleBack && window.handleBack()) history.pushState({ app: true }, '');
        else history.back();
    });
})();
