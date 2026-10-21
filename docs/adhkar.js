'use strict';

// =================================================================
// Adhkar – Hisn al-Muslim (حصن المسلم) med indspillet oplæsning af hver dhikr
// Tekst (arabisk + engelsk) ligger i adhkar-data.js; lyden hentes fra hisnmuslim.com.
// Tælleren på hver dhikr (fx 33×) huskes resten af dagen.
// =================================================================

const ADHKAR_QUICK = [[27, '☀ Morgen og aften'], [28, '☾ Før søvn'], [1, 'Når man vågner'], [25, 'Efter bønnen'], [96, 'Rejse']];
let adhkarChapter = null;
let adhkarQuery = '';
const adhkarTitleCache = store.get('adhkarTitles', {});

// Tællere for i dag: { date, counts: { dhikrId: antal } }
function adhkarCounts() {
    const today = new Date().toDateString();
    let c = store.get('adhkarCount', null);
    if (!c || c.date !== today) c = { date: today, counts: {} };
    return c;
}
function setAdhkarCount(id, n) {
    const c = adhkarCounts();
    c.counts[id] = n;
    store.set('adhkarCount', c);
}

// Kapiteltitler på det valgte sprog (maskinoversat én gang fra engelsk og gemt)
async function adhkarLocalTitles() {
    const lang = settings.targetLang;
    if (lang === 'en' || lang === 'ar') return null;
    if (adhkarTitleCache[lang]) return adhkarTitleCache[lang];
    const text = ADHKAR.map((c, i) => `${i + 1}. ${c.en.replace(/\s+/g, ' ')}`).join('\n');
    const out = await translateText(text, 'en', lang);
    const found = {};
    for (const m of out.matchAll(/(?:^|\n|\s)(\d{1,3})\.\s*([^\n]*?)(?=\s+\d{1,3}\.\s|\n|$)/g)) found[Number(m[1])] = m[2].trim();
    if (Object.keys(found).length < ADHKAR.length * 0.7) return null;
    const titles = {};
    ADHKAR.forEach((c, i) => { const t = found[i + 1]; if (t) titles[c.id] = t.charAt(0).toUpperCase() + t.slice(1); });
    adhkarTitleCache[lang] = titles;
    store.set('adhkarTitles', adhkarTitleCache);
    return titles;
}
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const adhkarTitle = c => cap((adhkarTitleCache[settings.targetLang] || {})[c.id] || c.en);

function renderAdhkar() {
    stopSpeak();
    const view = $('adhkarView');
    view.innerHTML = '';
    window.scrollTo(0, 0);
    if (adhkarChapter) { renderAdhkarChapter(view, ADHKAR.find(c => c.id === adhkarChapter)); return; }

    view.append(
        el('h2', { class: 'section-title' }, 'Hisn al-Muslim · حصن المسلم'),
        el('p', { class: 'note' }, 'Adhkar og du\'aer fra Koranen og Sunnah, samlet af Sa\'id al-Qahtani. Hver dhikr kan afspilles med indspillet oplæsning.'),
        el('div', { class: 'chip-tabs' }, ADHKAR_QUICK.map(([id, label]) =>
            el('button', { type: 'button', class: 'chip-tab', onclick: () => openAdhkarChapter(id) }, label))));
    const search = el('input', { type: 'search', class: 'search', placeholder: '🔍 Søg i kapitler…', dir: 'auto', autocomplete: 'off', value: adhkarQuery });
    const list = el('div', { class: 'list' });
    view.append(search, list);
    const draw = () => {
        list.innerHTML = '';
        const q = adhkarQuery.trim();
        const rows = ADHKAR.filter(c => !q || matchesQuery(normText([c.ar, c.en, adhkarTitle(c)].join(' ')), normText(q)));
        if (!rows.length) list.appendChild(el('p', { class: 'note' }, 'Ingen kapitler matcher søgningen.'));
        rows.forEach(c => list.appendChild(el('button', { type: 'button', class: 'list-row', onclick: () => openAdhkarChapter(c.id) },
            el('span', { class: 'list-main' },
                el('span', { class: 'list-title' }, adhkarTitle(c)),
                el('span', { class: 'list-ar', dir: 'rtl' }, c.ar)),
            el('span', { class: 'count' }, String(c.items.length)),
            el('span', { class: 'chev' }, '›'))));
    };
    search.addEventListener('input', () => { adhkarQuery = search.value; draw(); });
    draw();
    view.appendChild(el('p', { class: 'note mt' }, 'Kilde: hisnmuslim.com (arabisk tekst, engelsk oversættelse og lyd).'));
    if (!adhkarTitleCache[settings.targetLang]) adhkarLocalTitles().then(t => { if (t && !adhkarChapter && currentPage === 'adhkar') draw(); }).catch(() => {});
}

function openAdhkarChapter(id) {
    adhkarChapter = id;
    store.set('adhkarChapter', id);
    renderAdhkar();
}
function closeAdhkarChapter() {
    adhkarChapter = null;
    store.set('adhkarChapter', null);
    renderAdhkar();
}

function renderAdhkarChapter(view, c) {
    if (!c) { adhkarChapter = null; renderAdhkar(); return; }
    const counts = adhkarCounts().counts;
    view.append(
        el('nav', { class: 'crumbs' },
            el('button', { type: 'button', class: 'crumb', onclick: closeAdhkarChapter }, 'Adhkar'),
            el('span', { class: 'crumb-sep' }, '›'),
            el('button', { type: 'button', class: 'crumb' }, adhkarTitle(c))),
        el('h2', { class: 'adhkar-title', dir: 'rtl' }, c.ar),
        el('div', { class: 'note center' }, adhkarTitle(c)));

    const playAll = el('button', { type: 'button', class: 'btn btn-gold btn-small listen-btn' }, '▶ Afspil hele kapitlet');
    playAll.addEventListener('click', () => {
        if (speaker.btn === playAll) { stopSpeak(); return; }
        playRecorded(() => c.audio, playAll);
    });
    const resetBtn = el('button', { type: 'button', class: 'btn btn-ghost btn-small' }, '↺ Nulstil tællere');
    resetBtn.addEventListener('click', () => {
        c.items.forEach(it => setAdhkarCount(it.id, 0));
        renderAdhkar();
    });
    view.appendChild(el('div', { class: 'tafsir-actions' }, playAll, resetBtn));

    c.items.forEach((it, i) => view.appendChild(adhkarCard(c, it, i, counts[it.id] || 0)));
}

function adhkarCard(c, it, i, count) {
    const card = el('article', { class: 'adhkar-card' + (count >= it.n ? ' done' : '') });
    const counter = el('button', { type: 'button', class: 'adhkar-counter', 'aria-label': 'Tæl' });
    const showCount = n => {
        counter.textContent = it.n > 1 ? `${Math.min(n, it.n)} / ${it.n}` : (n >= 1 ? '✓' : 'Tæl');
        card.classList.toggle('done', n >= it.n);
    };
    showCount(count);
    counter.addEventListener('click', () => {
        count = count >= it.n ? 0 : count + 1; // efter sidste gang starter et tryk forfra
        setAdhkarCount(it.id, count);
        showCount(count);
        if (count === it.n && navigator.vibrate) navigator.vibrate(40);
    });

    card.appendChild(el('div', { class: 'item-head' },
        el('span', { class: 'item-badge' }, String(i + 1)),
        el('span', { class: 'item-ref' }, it.n > 1 ? `Siges ${it.n} gange` : ''),
        counter));
    card.appendChild(el('div', { class: 'adhkar-ar', dir: 'rtl', lang: 'ar' }, it.ar));
    if (it.tr && it.tr !== it.en) card.appendChild(el('div', { class: 'note' }, it.tr));
    if (it.en) card.appendChild(el('div', { class: 'item-trans' }, it.en));

    const mtBox = el('div', { class: 'item-mt', hidden: true });
    const listen = el('button', { type: 'button', class: 'btn btn-small btn-gold listen-btn' }, '🔊 Lyt');
    listen.addEventListener('click', () => {
        if (speaker.btn === listen) { stopSpeak(); return; }
        playRecorded(() => it.audio, listen, { text: it.ar, lang: 'ar' });
    });
    const actions = el('div', { class: 'item-actions' }, listen);
    if (settings.targetLang !== 'en' && settings.targetLang !== 'ar') {
        const trBtn = el('button', { type: 'button', class: 'btn btn-small btn-ghost' }, `Oversæt til ${langLabel(settings.targetLang)}`);
        trBtn.addEventListener('click', () => translateInto(mtBox, it.en || it.ar, it.en ? 'en' : 'ar', trBtn));
        actions.appendChild(trBtn);
    }
    actions.append(
        el('button', { type: 'button', class: 'btn btn-small btn-ghost', onclick: () => copyText(`${it.ar}\n\n${it.en}\n\n— Hisn al-Muslim: ${c.en}`) }, '⧉ Kopiér'),
        el('button', { type: 'button', class: 'btn btn-small btn-ghost', onclick: () => openSaveSheet({
            type: 'hadith', title: `${adhkarTitle(c)} (${i + 1})`, arabic: it.ar, translation: it.en, translationLang: 'en',
            source: 'Hisn al-Muslim', grade: it.n > 1 ? `Siges ${it.n} gange` : ''
        }) }, '☆ Gem'));
    card.append(actions, mtBox);
    return card;
}

adhkarChapter = store.get('adhkarChapter', null);
