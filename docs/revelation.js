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
        el('div', { class: 'chip-tabs' }, ...[['order', 'Rækkefølge'], ['M', '🕋 Mekka'], ['D', '🕌 Medina']].map(([k, label]) =>
            el('button', { type: 'button', class: 'chip-tab' + (revTab === k ? ' active' : ''), onclick: () => { revTab = k; store.set('revTab', k); renderRevelation(); } }, label))));

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
