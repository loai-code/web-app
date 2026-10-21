'use strict';

// =================================================================
// Gentagelsessystem (spaced repetition, som Anki)
// Efter hvert vers vurderer man sig selv: "Kunne ikke", "Næsten" eller "Kunne".
// Appen beregner så, hvornår verset skal gentages næste gang.
// Data: srs[ "sura:vers" ] = { ease, interval (dage), due (ms), reps, lapses, last (ms) }
// =================================================================

const DAY_MS = 24 * 3600 * 1000;
const srs = store.get('srs', {});
const srsDays = new Set(store.get('srsDays', []));   // datoer (ÅÅÅÅ-MM-DD) hvor der er øvet
const SOLID_DAYS = 21;                               // interval for at regne et vers som "sidder fast"

function saveSrs() {
    store.set('srs', srs);
    store.set('srsDays', [...srsDays].slice(-400));
    if (typeof scheduleMirror === 'function') scheduleMirror();
}

function todayKey(d = new Date()) {
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// rating: 0 = kunne ikke, 1 = næsten, 2 = kunne
function rateVerse(q, rating) {
    const key = q.surah + ':' + q.ayah;
    const now = Date.now();
    const c = srs[key] || { ease: 2.5, interval: 0, due: now, reps: 0, lapses: 0 };
    if (rating === 0) {
        c.reps = 0;
        c.lapses++;
        c.ease = Math.max(1.3, c.ease - 0.2);
        c.interval = 0;
        c.due = now + 10 * 60 * 1000;        // igen om 10 minutter
    } else if (rating === 1) {
        c.ease = Math.max(1.3, c.ease - 0.15);
        c.interval = Math.max(1, Math.round(c.interval * 1.2));
        c.reps++;
        c.due = now + c.interval * DAY_MS;
    } else {
        c.interval = c.reps === 0 ? 1 : c.reps === 1 ? 3 : Math.round(Math.max(c.interval, 1) * c.ease);
        c.ease = Math.min(3.0, c.ease + 0.05);
        c.reps++;
        c.due = now + c.interval * DAY_MS;
    }
    c.last = now;
    srs[key] = c;
    srsDays.add(todayKey());
    saveSrs();
    return c;
}

function dueVerses() {
    const now = Date.now();
    return Object.entries(srs)
        .filter(([, c]) => c.due <= now)
        .sort((a, b) => a[1].due - b[1].due)
        .map(([k]) => { const [s, a] = k.split(':').map(Number); return { surah: s, ayah: a }; });
}

function streakDays() {
    let n = 0;
    const d = new Date();
    if (!srsDays.has(todayKey(d))) d.setDate(d.getDate() - 1); // i går tæller stadig, hvis man ikke har øvet endnu i dag
    while (srsDays.has(todayKey(d))) { n++; d.setDate(d.getDate() - 1); }
    return n;
}

function formatInterval(days) {
    if (days <= 0) return 'om 10 min.';
    if (days === 1) return 'i morgen';
    if (days < 30) return `om ${days} dage`;
    if (days < 365) return `om ${Math.round(days / 30)} md.`;
    return `om ${(days / 365).toFixed(1)} år`;
}

// ---------- Memoreringssiden ----------

const srsRating = $('srsRating');

function updateSrsTodayBtn() {
    const n = dueVerses().length;
    const b = $('srsTodayBtn');
    b.textContent = n ? `📅 Dagens gentagelse (${n} vers)` : '📅 Ingen vers skal gentages lige nu';
    b.disabled = !n;
}

function afterShowCurrent(q) {
    srsRating.hidden = true;
    if (typeof resetAsbab === 'function') resetAsbab();
    if (q) {
        const c = srs[q.surah + ':' + q.ayah];
        $('srsInfo').textContent = c ? `Øvet ${c.reps + c.lapses} gang(e) · næste gentagelse ${c.due <= Date.now() ? 'nu' : formatInterval(Math.round((c.due - Date.now()) / DAY_MS))}` : 'Nyt vers';
    } else {
        $('srsInfo').textContent = '';
    }
    updateSrsTodayBtn();
}

function afterReveal(q) {
    srsRating.hidden = !q;
    $('asbabLoadBtn').disabled = !q;
}

srsRating.addEventListener('click', e => {
    const b = e.target.closest('[data-rate]');
    const q = currentVerse();
    if (!b || !q) return;
    const c = rateVerse(q, Number(b.dataset.rate));
    toast(Number(b.dataset.rate) === 0 ? 'Kommer igen om lidt' : `Næste gentagelse ${formatInterval(c.interval)}`);
    // Kunne ikke → læg verset bagerst i sessionen, så det øves igen
    if (Number(b.dataset.rate) === 0 && !questions.slice(currentIndex + 1).some(x => x.surah === q.surah && x.ayah === q.ayah)) {
        questions.push(q);
    }
    goNext();
});

$('srsTodayBtn').addEventListener('click', () => {
    const list = dueVerses();
    if (!list.length) return;
    startSessionWithVerses(list, false);
    toast(`Gentager ${list.length} vers`);
});

// ---------- Fremskridtssiden ----------

function renderProgress() {
    const box = $('progressView');
    box.innerHTML = '';
    const entries = Object.entries(srs);
    const solid = entries.filter(([, c]) => c.interval >= SOLID_DAYS).length;
    const due = dueVerses().length;
    box.appendChild(el('div', { class: 'stat-grid' },
        el('div', { class: 'stat' }, el('b', {}, String(entries.length)), el('small', {}, 'vers øvet')),
        el('div', { class: 'stat' }, el('b', {}, String(solid)), el('small', {}, 'sidder fast')),
        el('div', { class: 'stat' }, el('b', {}, String(due)), el('small', {}, 'skal gentages')),
        el('div', { class: 'stat' }, el('b', {}, `${streakDays()} 🔥`), el('small', {}, 'dage i træk'))));
    box.appendChild(el('p', { class: 'note' }, `Et vers "sidder fast", når næste gentagelse er mindst ${SOLID_DAYS} dage ude i fremtiden. Hele Koranen har 6.236 vers.`));
    if (due) {
        box.appendChild(el('button', { type: 'button', class: 'btn btn-gold btn-block', onclick: () => { showPage('memorize'); $('srsTodayBtn').click(); } }, `📅 Gentag ${due} vers nu`));
    }

    const perSurah = new Map();
    for (const [k, c] of entries) {
        const s = Number(k.split(':')[0]);
        const p = perSurah.get(s) || { started: 0, solid: 0 };
        p.started++;
        if (c.interval >= SOLID_DAYS) p.solid++;
        perSurah.set(s, p);
    }
    box.appendChild(el('h3', { class: 'list-head' }, 'Suraer'));
    if (!perSurah.size) {
        box.appendChild(el('p', { class: 'note' }, 'Ingen vers øvet endnu. Vis et vers på memoreringssiden og vurder hvor godt du kunne det.'));
        return;
    }
    const list = el('div', { class: 'list' });
    [...perSurah.entries()].sort((a, b) => a[0] - b[0]).forEach(([s, p]) => {
        const total = AYAH_COUNT[s - 1];
        const pctStarted = Math.round(p.started / total * 100);
        const pctSolid = Math.round(p.solid / total * 100);
        list.appendChild(el('button', {
            type: 'button', class: 'list-row progress-row', onclick: () => {
                surahSelect.value = s; clampRange(); startVerse.value = 1; endVerse.value = total;
                showPage('memorize'); startSession();
            }
        },
            el('span', { class: 'list-main' },
                el('span', { class: 'list-title' }, `${s}. ${SURAH_NAMES_EN[s]} · ${SURAH_NAMES_AR[s - 1]}`),
                el('span', { class: 'bar' },
                    el('span', { class: 'bar-started', style: `width:${pctStarted}%` }),
                    el('span', { class: 'bar-solid', style: `width:${pctSolid}%` })),
                el('span', { class: 'list-sub' }, `${p.started}/${total} øvet · ${p.solid} sidder fast`)),
            el('span', { class: 'chev' }, '›')));
    });
    box.appendChild(list);
}

updateSrsTodayBtn();
