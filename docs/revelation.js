'use strict';

// =================================================================
// Åbenbaring: mekkansk/medinensisk for hvert vers og rækkefølgen suraerne blev åbenbaret i.
// Data i revelation-data.js (REV_SURAH = [rækkefølge, 'M'|'D'] pr. sura, REV_EXC = vers der afviger fra suraen).
// =================================================================

const REV_LABEL = { M: 'Mekka', D: 'Medina' };
const REV_ICON = { M: '🕋', D: '🕌' };
let revTab = store.get('revTab', 'order');

// 'M' eller 'D' for et vers + om det er en undtagelse fra suraens klassifikation
function verseRevelation(surah, ayah) {
    const [, type] = REV_SURAH[surah - 1];
    const exc = (REV_EXC[surah] || []).includes(ayah);
    return { type: exc ? (type === 'M' ? 'D' : 'M') : type, exc, suraType: type };
}

// Lille mærke ved versnummeret under memorering
function revelationBadge(surah, ayah) {
    const r = verseRevelation(surah, ayah);
    return el('button', {
        type: 'button', class: 'rev-badge rev-' + r.type,
        title: 'Se åbenbaringens rækkefølge',
        onclick: () => { revTab = r.type === 'M' ? 'M' : 'D'; showPage('revelation'); }
    }, `${REV_ICON[r.type]} ${REV_LABEL[r.type]}${r.exc ? ' (undtagelse)' : ''}`);
}

// Antal vers fra hver periode i en sura
function revCounts(s) {
    const total = AYAH_COUNT[s - 1];
    const exc = (REV_EXC[s] || []).length;
    const own = total - exc;
    return REV_SURAH[s - 1][1] === 'M' ? { M: own, D: exc } : { M: exc, D: own };
}

// "20, 23, 91–93" ud fra en sorteret liste af versnumre
function verseRanges(list) {
    const out = [];
    for (let i = 0; i < list.length; i++) {
        let j = i;
        while (j + 1 < list.length && list[j + 1] === list[j] + 1) j++;
        out.push(j > i ? `${list[i]}–${list[j]}` : String(list[i]));
        i = j;
    }
    return out.join(', ');
}

function openSurahToMemorize(s) {
    surahSelect.value = s;
    startVerse.value = 1;
    endVerse.value = AYAH_COUNT[s - 1];
    showPage('memorize');
    startSession();
}

function revRow(s, sub, extra) {
    const [order, type] = REV_SURAH[s - 1];
    return el('button', { type: 'button', class: 'list-row rev-row', onclick: () => openSurahToMemorize(s) },
        el('span', { class: 'rev-order rev-' + type, title: 'Nr. i åbenbaringsrækkefølgen' }, String(order)),
        el('span', { class: 'list-main' },
            el('span', { class: 'list-title' }, `${s}. ${SURAH_NAMES_EN[s]}`),
            el('span', { class: 'list-ar', dir: 'rtl' }, 'سورة ' + SURAH_NAMES_AR[s - 1]),
            sub ? el('span', { class: 'list-sub' }, sub) : null,
            extra ? el('span', { class: 'list-sub rev-exc' }, extra) : null),
        el('span', { class: 'chev' }, '›'));
}

function renderRevelation() {
    const view = $('revelationView');
    view.innerHTML = '';
    const sum = { M: { suras: 0, verses: 0 }, D: { suras: 0, verses: 0 } };
    for (let s = 1; s <= 114; s++) {
        const c = revCounts(s);
        sum[REV_SURAH[s - 1][1]].suras++;
        sum.M.verses += c.M;
        sum.D.verses += c.D;
    }
    view.append(
        el('div', { class: 'rev-stats' },
            el('div', { class: 'rev-stat rev-M' }, el('b', {}, `${REV_ICON.M} Mekka`), el('span', {}, `${sum.M.suras} suraer · ${sum.M.verses.toLocaleString('da-DK')} vers`)),
            el('div', { class: 'rev-stat rev-D' }, el('b', {}, `${REV_ICON.D} Medina`), el('span', {}, `${sum.D.suras} suraer · ${sum.D.verses.toLocaleString('da-DK')} vers`))),
        el('div', { class: 'chip-tabs' }, ...[['order', 'Rækkefølge'], ['timeline', '📅 Tidslinje'], ['M', '🕋 Mekka'], ['D', '🕌 Medina']].map(([k, label]) =>
            el('button', { type: 'button', class: 'chip-tab' + (revTab === k ? ' active' : ''), onclick: () => { revTab = k; store.set('revTab', k); renderRevelation(); } }, label))));

    if (revTab === 'timeline') { renderTimeline(view); return; }
    const list = el('div', { class: 'list' });
    if (revTab === 'order') {
        view.appendChild(el('p', { class: 'note' }, 'Suraerne i den rækkefølge de blev åbenbaret – fra det første vers i Hira-hulen til Medina-perioden. Tallet til venstre er pladsen i rækkefølgen; tryk på en sura for at øve den.'));
        const byOrder = [...Array(114).keys()].map(i => i + 1).sort((a, b) => REV_SURAH[a - 1][0] - REV_SURAH[b - 1][0]);
        let period = null;
        const seen = new Set();
        byOrder.forEach(s => {
            const type = REV_SURAH[s - 1][1];
            if (type !== period) {
                // Overskrift, når perioden skifter – første gang med årstal
                list.appendChild(el('div', { class: 'rev-period rev-' + type }, seen.has(type)
                    ? `${REV_ICON[type]} ${REV_LABEL[type]}`
                    : type === 'M' ? '🕋 Mekka-perioden (ca. 610–622)' : '🕌 Medina-perioden – efter hijra (622–632)'));
                seen.add(type);
                period = type;
            }
            const exc = REV_EXC[s] || [];
            list.appendChild(revRow(s, `${REV_LABEL[type]} · ${AYAH_COUNT[s - 1]} vers`,
                exc.length ? `Vers ${verseRanges(exc)} regnes som ${type === 'M' ? 'medinensiske' : 'mekkanske'}` : ''));
        });
    } else {
        const t = revTab;
        const other = t === 'M' ? 'D' : 'M';
        view.appendChild(el('p', { class: 'note' }, t === 'M'
            ? 'De mekkanske vers – åbenbaret før hijra. Først de mekkanske suraer, derefter mekkanske vers inde i medinensiske suraer.'
            : 'De medinensiske vers – åbenbaret efter hijra. Først de medinensiske suraer, derefter medinensiske vers inde i mekkanske suraer.'));
        list.appendChild(el('div', { class: 'rev-period rev-' + t }, `${REV_ICON[t]} ${t === 'M' ? 'Mekkanske' : 'Medinensiske'} suraer`));
        for (let s = 1; s <= 114; s++) {
            if (REV_SURAH[s - 1][1] !== t) continue;
            const exc = REV_EXC[s] || [];
            list.appendChild(revRow(s, exc.length ? `Vers 1–${AYAH_COUNT[s - 1]} undtagen ${verseRanges(exc)}` : `Alle ${AYAH_COUNT[s - 1]} vers`));
        }
        const mixed = Object.keys(REV_EXC).map(Number).filter(s => REV_SURAH[s - 1][1] === other).sort((a, b) => a - b);
        if (mixed.length) {
            list.appendChild(el('div', { class: 'rev-period rev-' + t }, `${REV_ICON[t]} ${t === 'M' ? 'Mekkanske' : 'Medinensiske'} vers i ${t === 'M' ? 'medinensiske' : 'mekkanske'} suraer`));
            mixed.forEach(s => list.appendChild(revRow(s, `Vers ${verseRanges(REV_EXC[s])}`)));
        }
    }
    view.appendChild(list);
    view.appendChild(el('p', { class: 'note' }, 'Kilde: rækkefølgen og inddelingen følger den egyptiske standardmushaf (som Madinah-mushafen, via Tanzil); undtagelserne er dem, der står i suraernes overskrifter. De bygger på overleveringer, og de lærde er uenige om enkelte suraer og vers.'));
}

// =================================================================
// Tidslinje (data i timeline-data.js) med kilde og pålidelighed for hver begivenhed
// =================================================================

const TL_CONF = {
    sikker: { label: 'Sikker', icon: '🟢', text: 'Står i Koranen selv eller i sahih hadith, og kilderne er enige.' },
    sandsynlig: { label: 'Sandsynlig', icon: '🟡', text: 'Flertallet af de lærde og sira-forfatterne, men uden sahih hadith med tidspunktet – eller kun omtrentligt.' },
    omstridt: { label: 'Omstridt', icon: '🟠', text: 'De lærde nævner forskellige år, dage eller vers.' },
    svag: { label: 'Svag', icon: '🔴', text: 'Fortællingen er kendt, men overleveringen har ingen sikker kæde.' }
};
let tlFocus = null;
let tlIndex = null;

function tlConfPill(kind, level) {
    const c = TL_CONF[level];
    return el('span', { class: 'tl-pill tl-' + level, title: c.text }, `${c.icon} ${kind}: ${c.label}`);
}

function openRangeToMemorize(s, from, to) {
    surahSelect.value = s;
    startVerse.value = from;
    endVerse.value = to;
    showPage('memorize');
    startSession();
}

function verseLabel(v) {
    if (v.label) return v.label;
    return v.a[0] === v.a[1] ? `${v.s}:${v.a[0]}` : `${v.s}:${v.a[0]}–${v.a[1]}`;
}

// Én hadith hentes og vises inde i kildefeltet
async function showTimelineHadith(box, bookId, num, btn) {
    if (box.childElementCount) { box.innerHTML = ''; btn.textContent = 'Læs ›'; return; }
    btn.disabled = true;
    box.appendChild(spinnerLine('Henter hadith…'));
    try {
        const [ara, eng] = await Promise.all([
            getHadithApi(`ara-${bookId}/${num}.json`),
            getHadithApi(`eng-${bookId}/${num}.json`).catch(() => null)
        ]);
        box.innerHTML = '';
        const book = HADITH_BOOKS.find(b => b.id === bookId);
        box.appendChild(bookHadithCard(book, { ar: ara.hadiths[0], en: eng && eng.hadiths && eng.hadiths[0] }));
        btn.textContent = 'Skjul';
    } catch (e) {
        box.innerHTML = '';
        box.appendChild(el('div', { class: 'status error' }, '⚠ Kunne ikke hente hadithen: ' + e.message));
    } finally {
        btn.disabled = false;
    }
}

function timelineSources(e) {
    const box = el('div', { class: 'tl-src', hidden: true });
    box.append(
        el('div', { class: 'tl-src-row' }, tlConfPill('Tidspunkt', e.date), el('span', {}, TL_CONF[e.date].text)),
        el('div', { class: 'tl-src-row' }, tlConfPill('Kobling til versene', e.link), el('span', {}, TL_CONF[e.link].text)),
        el('p', { class: 'tl-why' }, e.why));
    if (e.h && e.h.length) {
        box.appendChild(el('b', { class: 'tl-src-head' }, 'Hadith'));
        e.h.forEach(([bookId, num, desc]) => {
            const book = HADITH_BOOKS.find(b => b.id === bookId);
            const card = el('div', { class: 'tl-hadith-box' });
            const btn = el('button', { type: 'button', class: 'btn btn-small btn-ghost' }, 'Læs ›');
            btn.addEventListener('click', () => showTimelineHadith(card, bookId, num, btn));
            box.append(el('div', { class: 'tl-hadith' }, el('span', {}, el('b', {}, `${book ? book.name : bookId} nr. ${num}`), ` – ${desc}`), btn), card);
        });
    }
    if (e.src && e.src.length) {
        box.appendChild(el('b', { class: 'tl-src-head' }, 'Andre kilder'));
        box.appendChild(el('ul', { class: 'tl-src-list' }, e.src.map(x => el('li', {}, x))));
    }
    return box;
}

function timelineCard(e) {
    const card = el('article', { class: 'tl-item tl-' + e.period, id: 'tl-' + e.id });
    const src = timelineSources(e);
    const srcBtn = el('button', { type: 'button', class: 'btn btn-small btn-ghost tl-src-btn' }, 'ⓘ Kilde og pålidelighed');
    const openSrc = open => {
        src.hidden = !open;
        srcBtn.textContent = open ? 'ⓘ Skjul kilde' : 'ⓘ Kilde og pålidelighed';
    };
    srcBtn.addEventListener('click', () => openSrc(src.hidden));
    card.append(
        el('div', { class: 'tl-year' }, e.y),
        el('div', { class: 'tl-when' }, e.w),
        el('h3', { class: 'tl-title' }, e.t),
        el('div', { class: 'tl-pills' }, tlConfPill('Tidspunkt', e.date), tlConfPill('Kobling', e.link)),
        el('p', { class: 'tl-desc' }, e.d));
    if (e.v.length) {
        card.appendChild(el('div', { class: 'tl-verses' }, e.v.map(v => {
            const conf = v.c || e.link;
            return el('button', {
                type: 'button', class: 'tl-verse' + (v.om ? ' tl-om' : ''),
                title: 'Øv disse vers – kobling: ' + TL_CONF[conf].label.toLowerCase(),
                onclick: () => openRangeToMemorize(v.s, v.a[0], v.a[1])
            },
            el('span', { class: 'tl-dot' }, TL_CONF[conf].icon),
            el('span', {}, `${verseLabel(v)} · ${SURAH_NAMES_EN[v.s]}`),
            v.n ? el('small', {}, v.n) : null);
        })));
    }
    card.append(srcBtn, src);
    card._openSrc = () => openSrc(true);
    return card;
}

function renderTimeline(view) {
    view.appendChild(el('p', { class: 'note' }, 'De vigtigste begivenheder fra 570 til 632 og de vers, der knyttes til dem. Årstallene er omregnet fra den islamiske kalender og er omtrentlige – især i Mekka-perioden. Tryk på et vers for at øve det, og på "Kilde og pålidelighed" for at se, hvad tidspunktet bygger på.'));
    view.appendChild(el('details', { class: 'tl-legend' },
        el('summary', {}, 'Hvad betyder farverne?'),
        el('p', {}, 'Hver begivenhed har to vurderinger: hvor sikkert tidspunktet er, og hvor sikkert det er, at versene hører til begivenheden.'),
        ...Object.values(TL_CONF).map(c => el('div', { class: 'tl-legend-row' }, el('b', {}, `${c.icon} ${c.label}`), el('span', {}, c.text))),
        el('p', {}, 'Vers med stiplet kant omtaler begivenheden, men blev åbenbaret på et andet tidspunkt.')));
    const list = el('div', { class: 'tl-list' });
    let period = null;
    TIMELINE.forEach(e => {
        if (e.period !== 'pre' && e.period !== period) {
            list.appendChild(el('div', { class: 'rev-period rev-' + e.period }, e.period === 'M' ? '🕋 Mekka-perioden (ca. 610–622)' : '🕌 Medina-perioden – efter hijra (622–632)'));
            period = e.period;
        }
        list.appendChild(timelineCard(e));
    });
    view.appendChild(list);
    view.appendChild(el('p', { class: 'note' }, 'Kilder: hadith-numrene følger appens samlinger (sunnah.com-nummerering). Sira: Ibn Ishaq/Ibn Hisham, Ibn Sa\'d og at-Tabari. De fleste vers har ingen kendt dato og er derfor ikke med her.'));
    if (tlFocus) {
        const card = $('tl-' + tlFocus);
        tlFocus = null;
        if (card) { card._openSrc(); requestAnimationFrame(() => card.scrollIntoView({ block: 'start' })); }
    }
}

// Mærke med årstal ved verset under memorering – kun for vers der blev åbenbaret ved begivenheden
function timelineEventFor(surah, ayah) {
    if (!tlIndex) {
        tlIndex = {};
        TIMELINE.forEach(e => e.v.forEach(v => {
            if (v.om || !e.b) return;
            (tlIndex[v.s] = tlIndex[v.s] || []).push({ e, v, size: v.a[1] - v.a[0] });
        }));
        Object.values(tlIndex).forEach(arr => arr.sort((x, y) => x.size - y.size));
    }
    return (tlIndex[surah] || []).find(m => ayah >= m.v.a[0] && ayah <= m.v.a[1]) || null;
}

function timelineBadge(surah, ayah) {
    const m = timelineEventFor(surah, ayah);
    if (!m) return null;
    const link = m.v.c || m.e.link;
    // Farven følger den svageste af de to vurderinger
    const order = ['sikker', 'sandsynlig', 'omstridt', 'svag'];
    const conf = order[Math.max(order.indexOf(m.e.date), order.indexOf(link))];
    return el('button', {
        type: 'button', class: 'rev-badge tl-badge tl-' + conf,
        title: `Tidspunkt: ${TL_CONF[m.e.date].label} · kobling: ${TL_CONF[link].label} – tryk for kilden`,
        onclick: () => { revTab = 'timeline'; tlFocus = m.e.id; showPage('revelation'); }
    }, `📅 ${m.e.b} ${TL_CONF[conf].icon}`);
}
