'use strict';

// =================================================================
// Søgning i Koranen
//  - Arabisk: uden hensyn til vokaltegn og alif-former
//  - Engelsk: i Sahih International (indbygget)
//  - Dansk (eller andet sprog): søgeordet oversættes til engelsk, og der søges i oversættelsen
// =================================================================

let quranIndex = null;   // [{ v, ar, en }] – bygges første gang der søges
let searchToken = 0;

function buildQuranIndex() {
    if (!quranIndex) {
        quranIndex = VERSES.map(v => ({ v, ar: normText(v[2]), en: normText(v[3]) }));
    }
    return quranIndex;
}

const hasArabic = s => /[؀-ۿ]/.test(s);

function highlightLatin(text, terms) {
    // Markér søgeordene i den engelske tekst (kun ved latinske bogstaver)
    const frag = document.createDocumentFragment();
    if (!terms.length) { frag.append(text); return frag; }
    const rx = new RegExp('(' + terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'gi');
    let last = 0;
    for (const m of text.matchAll(rx)) {
        frag.append(text.slice(last, m.index), el('mark', {}, m[0]));
        last = m.index + m[0].length;
    }
    frag.append(text.slice(last));
    return frag;
}

async function runQuranSearch() {
    const raw = $('qsInput').value.trim();
    const box = $('qsResults');
    const token = ++searchToken;
    box.innerHTML = '';
    if (raw.length < 2) return;
    const idx = buildQuranIndex();
    const surahFilter = Number($('qsSurah').value) || 0;
    const inScope = e => !surahFilter || e.v[0] === surahFilter;

    let hits = [];
    let note = '';
    let terms = [];
    if (hasArabic(raw)) {
        const q = normText(raw);
        hits = idx.filter(e => inScope(e) && matchesQuery(e.ar, q));
    } else {
        const qEn = normText(raw);
        terms = qEn.split(' ').filter(Boolean);
        hits = idx.filter(e => inScope(e) && matchesQuery(e.en, qEn));
        // Søg også på det oversatte søgeord (fx dansk → engelsk)
        if ($('qsTranslate').checked && settings.targetLang !== 'en') {
            box.appendChild(spinnerLine('Oversætter søgeordet…'));
            try {
                const en = normText(await translateText(raw, 'auto', 'en'));
                if (token !== searchToken) return;
                box.innerHTML = '';
                if (en && en !== qEn) {
                    const extra = idx.filter(e => inScope(e) && matchesQuery(e.en, en) && !hits.includes(e));
                    hits = hits.concat(extra);
                    terms = terms.concat(en.split(' ').filter(Boolean));
                    note = `Søgte også efter den engelske oversættelse: "${en}"`;
                }
            } catch (e) {
                box.innerHTML = '';
                note = 'Søgeordet kunne ikke oversættes – søgte kun på engelsk.';
            }
        }
        hits.sort((a, b) => a.v[0] - b.v[0] || a.v[1] - b.v[1]);
    }
    if (token !== searchToken) return;

    box.appendChild(el('p', { class: 'note' }, `${hits.length} vers fundet.` + (note ? ' ' + note : '')));
    const shown = hits.slice(0, 100);
    for (const e of shown) {
        const [s, a, ar, en] = e.v;
        const card = el('article', { class: 'note-item qs-hit' },
            el('div', { class: 'item-head' },
                el('span', { class: 'item-badge' }, `${s}:${a}`),
                el('b', { class: 'item-ref' }, `${SURAH_NAMES_EN[s]} · ${SURAH_NAMES_AR[s - 1]}`)),
            el('div', { class: 'item-arabic small', dir: 'rtl', lang: 'ar' }, ar),
            el('div', { class: 'item-trans' }, highlightLatin(en, terms)),
            el('div', { class: 'item-actions' },
                el('button', { type: 'button', class: 'btn btn-small btn-primary', onclick: () => {
                    surahSelect.value = s; clampRange(); startVerse.value = a; endVerse.value = a;
                    showPage('memorize'); startSession();
                } }, 'Åbn i memorering'),
                el('button', { type: 'button', class: 'btn btn-small btn-ghost', onclick: () => openSaveSheet({ type: 'verse', surah: s, from: a, to: a }) }, '☆ Gem')));
        box.appendChild(card);
    }
    if (hits.length > shown.length) box.appendChild(el('p', { class: 'note' }, `Viser de første 100 af ${hits.length} – gør søgningen mere præcis.`));
}

(function initQuranSearch() {
    const sel = $('qsSurah');
    sel.appendChild(el('option', { value: 0 }, 'Hele Koranen'));
    for (let s = 1; s <= 114; s++) sel.appendChild(el('option', { value: s }, `${s}. ${SURAH_NAMES_EN[s]} · ${SURAH_NAMES_AR[s - 1]}`));
    $('qsForm').addEventListener('submit', e => { e.preventDefault(); $('qsInput').blur(); runQuranSearch(); });
    sel.addEventListener('change', () => { if ($('qsInput').value.trim()) runQuranSearch(); });
    $('qsTranslateLabel').textContent = `Søg også på ${(LANG_NAME[settings.targetLang] || 'dansk').toLowerCase()} (søgeordet oversættes)`;
})();
