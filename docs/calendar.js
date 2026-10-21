'use strict';

// =================================================================
// Hijri-kalender (Umm al-Qura) med islamiske højtider og mærkedage.
// Datoerne beregnes; den lokale månesigtning kan give ±1 dag.
// =================================================================

const HIJRI_MONTHS = ['Muharram', 'Safar', 'Rabi\' al-Awwal', 'Rabi\' ath-Thani', 'Jumada al-Ula', 'Jumada al-Akhira',
    'Rajab', 'Sha\'ban', 'Ramadan', 'Shawwal', 'Dhu al-Qa\'da', 'Dhu al-Hijja'];
const HIJRI_MONTHS_AR = ['مُحَرَّم', 'صَفَر', 'رَبِيع الأَوَّل', 'رَبِيع الآخِر', 'جُمَادَى الأُولَى', 'جُمَادَى الآخِرَة',
    'رَجَب', 'شَعْبَان', 'رَمَضَان', 'شَوَّال', 'ذُو القَعْدَة', 'ذُو الحِجَّة'];

// [måned (1-12), dag, navn, beskrivelse, type]
const HIJRI_EVENTS = [
    [1, 1, 'Islamisk nytår', 'Første dag i Muharram – et nyt hijri-år begynder.', 'major'],
    [1, 9, 'Tasu\'a', 'Dagen før Ashura – det er sunnah at faste den sammen med Ashura.', 'fast'],
    [1, 10, 'Ashura', 'Profeten ﷺ fastede denne dag og opfordrede til det.', 'fast'],
    [9, 1, 'Ramadan begynder', 'Fastemåneden begynder (afhænger af månesigtning).', 'major'],
    [9, 21, 'De sidste ti nætter', 'Søg Laylat al-Qadr i de ulige nætter blandt de sidste ti.', 'night'],
    [9, 27, 'Laylat al-Qadr (27.)', 'Én af de ulige nætter hvor Laylat al-Qadr søges.', 'night'],
    [10, 1, 'Eid al-Fitr', 'Fastebrydningens fest.', 'eid'],
    [12, 1, 'De første ti dage af Dhu al-Hijja', 'De bedste dage i året for gode gerninger.', 'major'],
    [12, 8, 'Yawm at-Tarwiya', 'Hajj begynder.', 'major'],
    [12, 9, 'Arafat-dagen', 'Faste denne dag udsletter synder for to år (for dem der ikke er på hajj).', 'fast'],
    [12, 10, 'Eid al-Adha', 'Offerfesten.', 'eid'],
    [12, 11, 'Tashriq-dagene', '11.–13. Dhu al-Hijja – dage med mad, drikke og dhikr (ingen faste).', 'major']
];

let hijriFmt = null;
function hijriParts(date) {
    if (!hijriFmt) {
        hijriFmt = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', { day: 'numeric', month: 'numeric', year: 'numeric' });
    }
    const parts = Object.fromEntries(hijriFmt.formatToParts(date).filter(p => p.type !== 'literal').map(p => [p.type, p.value]));
    return { day: Number(parts.day), month: Number(parts.month), year: Number(String(parts.year).replace(/\D/g, '')) };
}

function hijriLabel(date) {
    const h = hijriParts(date);
    return `${h.day}. ${HIJRI_MONTHS[h.month - 1]} ${h.year} AH`;
}

function eventsFor(h) {
    const list = HIJRI_EVENTS.filter(e => e[0] === h.month && e[1] === h.day);
    if (h.day >= 13 && h.day <= 15) list.push([h.month, h.day, 'De hvide dage', 'Det er sunnah at faste 13., 14. og 15. i hver hijri-måned.', 'white']);
    return list;
}

let calMonth = (() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); })();

function renderCalendar() {
    const view = $('calendarView');
    view.innerHTML = '';
    const today = new Date();
    const th = hijriParts(today);

    // I dag
    view.appendChild(el('div', { class: 'cal-today' },
        el('div', { class: 'cal-today-ar', dir: 'rtl' }, `${toArabicDigits(th.day)} ${HIJRI_MONTHS_AR[th.month - 1]} ${toArabicDigits(th.year)} هـ`),
        el('div', { class: 'cal-today-da' }, `${hijriLabel(today)} · ${today.toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`),
        ...eventsFor(th).map(e => el('div', { class: 'cal-badge ' + e[4] }, `★ ${e[2]}`))));

    // Månedsvisning
    const y = calMonth.getFullYear(), m = calMonth.getMonth();
    const first = new Date(y, m, 1);
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const hFirst = hijriParts(first), hLast = hijriParts(new Date(y, m, daysInMonth));
    const hijriSpan = hFirst.month === hLast.month
        ? `${HIJRI_MONTHS[hFirst.month - 1]} ${hFirst.year}`
        : `${HIJRI_MONTHS[hFirst.month - 1]} – ${HIJRI_MONTHS[hLast.month - 1]} ${hLast.year}`;
    view.appendChild(el('div', { class: 'cal-nav' },
        el('button', { type: 'button', class: 'icon-btn small ghost', 'aria-label': 'Forrige måned', onclick: () => { calMonth = new Date(y, m - 1, 1); renderCalendar(); } }, '‹'),
        el('div', { class: 'cal-title' },
            el('b', {}, first.toLocaleDateString('da-DK', { month: 'long', year: 'numeric' })),
            el('small', {}, hijriSpan)),
        el('button', { type: 'button', class: 'icon-btn small ghost', 'aria-label': 'Næste måned', onclick: () => { calMonth = new Date(y, m + 1, 1); renderCalendar(); } }, '›')));

    const grid = el('div', { class: 'cal-grid' });
    ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn'].forEach(d => grid.appendChild(el('div', { class: 'cal-wd' + (d === 'Fre' ? ' fri' : '') }, d)));
    const lead = (first.getDay() + 6) % 7;
    for (let i = 0; i < lead; i++) grid.appendChild(el('div', { class: 'cal-cell empty' }));
    for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(y, m, d);
        const h = hijriParts(date);
        const ev = eventsFor(h);
        const isToday = date.toDateString() === today.toDateString();
        const type = ev.length ? ev[0][4] : '';
        grid.appendChild(el('button', {
            type: 'button',
            class: 'cal-cell' + (isToday ? ' today' : '') + (type ? ' ev-' + type : '') + (date.getDay() === 5 ? ' fri' : ''),
            onclick: () => showInfo(`${date.toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`,
                `${hijriLabel(date)}\n\n` + (ev.length ? ev.map(e => `★ ${e[2]}: ${e[3]}`).join('\n\n') : 'Ingen særlige begivenheder.')
                + (date.getDay() === 1 || date.getDay() === 4 ? '\n\nDet er sunnah at faste mandag og torsdag.' : '')
                + (date.getDay() === 5 ? '\n\nFredag: Jumu\'a-bøn, læs Surat al-Kahf og send mange velsignelser over Profeten ﷺ.' : ''))
        }, el('span', { class: 'cal-g' }, String(d)), el('span', { class: 'cal-h' }, String(h.day))));
    }
    view.appendChild(grid);
    view.appendChild(el('div', { class: 'cal-legend' },
        el('span', { class: 'lg eid' }, 'Eid'), el('span', { class: 'lg major' }, 'Mærkedag'),
        el('span', { class: 'lg fast' }, 'Fastedag'), el('span', { class: 'lg night' }, 'Nat'), el('span', { class: 'lg white' }, 'Hvide dage')));

    // Kommende begivenheder (næste 13 måneder)
    view.appendChild(el('h3', { class: 'list-head' }, 'Kommende højtider og mærkedage'));
    const list = el('div', { class: 'list' });
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    let shown = 0;
    for (let i = 0; i < 400 && shown < 14; i++, d.setDate(d.getDate() + 1)) {
        const h = hijriParts(d);
        for (const e of HIJRI_EVENTS.filter(x => x[0] === h.month && x[1] === h.day)) {
            shown++;
            const days = Math.round((d - new Date(today.getFullYear(), today.getMonth(), today.getDate())) / 86400000);
            list.appendChild(el('div', { class: 'list-row cal-event ev-' + e[4] },
                el('span', { class: 'list-main' },
                    el('span', { class: 'list-title' }, e[2]),
                    el('span', { class: 'list-sub' }, `${d.toLocaleDateString('da-DK', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })} · ${h.day}. ${HIJRI_MONTHS[h.month - 1]} ${h.year}`),
                    el('span', { class: 'list-sub' }, e[3])),
                el('span', { class: 'count' }, days === 0 ? 'i dag' : days === 1 ? 'i morgen' : `om ${days} d.`)));
        }
    }
    view.appendChild(list);
    view.appendChild(el('p', { class: 'note' }, 'Datoerne følger Umm al-Qura-kalenderen. Den faktiske start på fx Ramadan og Eid afhænger af månesigtning og kan afvige ±1 dag – følg din moské eller dit lokale råd.'));
}

// Vis dagens hijri-dato i menuen
(function showHijriInMenu() {
    try {
        const b = document.querySelector('#pagesMenu [data-page="calendar"] small');
        if (b) b.textContent = `I dag: ${hijriLabel(new Date())}`;
    } catch (e) { /* Intl uden islamisk kalender */ }
})();
