'use strict';

// =================================================================
// Hadith
//  - Emner: HadeethEnc.com (arabisk tekst, sharh, lærdomme, ordforklaringer
//    og officielle oversættelser – også dansk for mange hadith)
//  - Samlinger: Bukhari, Muslim m.fl. fra fawazahmed0/hadith-api (arabisk + engelsk)
// =================================================================

const HENC = 'https://hadeethenc.com/api/v1/';
const HADITH_API = 'https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/';
const HADITH_API_FALLBACK = 'https://raw.githubusercontent.com/fawazahmed0/hadith-api/1/editions/';

const hadithView = $('hadithView');
const hadithCrumbs = $('hadithCrumbs');
const hadithStatus = $('hadithStatus');

// Navigationsstak pr. kilde, så man kan skifte fane uden at miste sin plads
const hNav = {
    src: 'topics',
    topics: [{ level: 'root' }],
    books: [{ level: 'root' }]
};
let hRenderToken = 0;
let hencCats = null;      // [{id, title, titleLocal, count, parent}]
let hencCatsLang = null;

async function getJson(url) {
    return JSON.parse(await httpRequest(url));
}
async function getHadithApi(path) {
    try { return await getJson(HADITH_API + path); }
    catch (e) {
        try { return await getJson(HADITH_API_FALLBACK + path); }
        catch (e2) { throw new Error(`jsdelivr: ${e.message} / github: ${e2.message}`); }
    }
}

function hState() { const s = hNav[hNav.src]; return s[s.length - 1]; }
function hPush(state) { hNav[hNav.src].push(state); renderHadith(); window.scrollTo(0, 0); }
function hGoto(depth) { hNav[hNav.src].length = depth + 1; renderHadith(); window.scrollTo(0, 0); }
function hBack() {
    const s = hNav[hNav.src];
    if (s.length > 1) { s.pop(); renderHadith(); return true; }
    return false;
}

$('hadithTabs').addEventListener('click', e => {
    const tab = e.target.closest('.tab');
    if (!tab) return;
    hNav.src = tab.dataset.src;
    $('hadithTabs').querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t === tab));
    renderHadith();
});

function renderHadithCrumbs() {
    hadithCrumbs.innerHTML = '';
    const stack = hNav[hNav.src];
    stack.forEach((s, i) => {
        if (i > 0) hadithCrumbs.appendChild(el('span', { class: 'crumb-sep' }, '›'));
        hadithCrumbs.appendChild(el('button', { type: 'button', class: 'crumb', onclick: () => hGoto(i) }, s.label || (hNav.src === 'topics' ? 'Emner' : 'Samlinger')));
    });
}

function renderHadith() {
    const token = ++hRenderToken;
    renderHadithCrumbs();
    hadithView.innerHTML = '';
    setStatus(hadithStatus, '');
    const st = hState();
    const run = hNav.src === 'topics'
        ? (st.level === 'root' ? renderTopicsRoot : st.level === 'cat' ? renderTopicCat : renderHencHadith)
        : ((typeof MORE_LEVELS !== 'undefined' && MORE_LEVELS[st.level]) // flere værker (hadith-more.js)
            || (st.level === 'root' ? renderBooksRoot : st.level === 'book' ? renderBook : st.level === 'sharh' ? renderSharh : renderSection));
    run(st, token).catch(err => {
        if (token !== hRenderToken) return;
        hadithView.innerHTML = '';
        setStatus(hadithStatus, '⚠ Kunne ikke hente data: ' + err.message + '. Tjek internetforbindelsen.', true);
        hadithView.appendChild(el('button', { type: 'button', class: 'btn btn-ghost btn-block', onclick: renderHadith }, '↻ Prøv igen'));
    });
}

// ---------------- Emner (HadeethEnc) ----------------

async function loadHencCats() {
    const lang = settings.targetLang;
    if (hencCats && hencCatsLang === lang) return hencCats;
    const ar = await getJson(HENC + 'categories/list/?language=ar');
    let local = [];
    if (lang !== 'ar') {
        try { local = await getJson(HENC + 'categories/list/?language=' + encodeURIComponent(lang)); } catch (e) { local = []; }
    }
    const localMap = new Map(local.map(c => [String(c.id), c.title]));
    hencCats = ar.map(c => ({
        id: String(c.id),
        title: c.title,
        titleLocal: localMap.get(String(c.id)) || '',
        count: Number(c.hadeeths_count) || 0,
        parent: c.parent_id ? String(c.parent_id) : null
    }));
    hencCatsLang = lang;
    return hencCats;
}

function catButton(c, onclick) {
    return el('button', { type: 'button', class: 'list-row', onclick },
        el('span', { class: 'list-main' },
            c.titleLocal ? el('span', { class: 'list-title' }, c.titleLocal) : null,
            el('span', { class: 'list-ar', dir: 'rtl' }, c.title)),
        el('span', { class: 'count' }, String(c.count)),
        el('span', { class: 'chev' }, '›'));
}

async function renderTopicsRoot(st, token) {
    hadithView.appendChild(spinnerLine('Henter emner…'));
    const cats = await loadHencCats();
    if (token !== hRenderToken) return;
    hadithView.innerHTML = '';
    hadithView.appendChild(el('p', { class: 'note' }, 'Vælg et emne. Hver hadith har arabisk tekst, ægthedsgrad, forklaring (sharh) og ofte en officiel dansk oversættelse.'));
    const list = el('div', { class: 'list' });
    cats.filter(c => !c.parent).forEach(c => list.appendChild(catButton(c, () => hPush({ level: 'cat', id: c.id, label: c.titleLocal || c.title, page: 1 }))));
    hadithView.appendChild(list);
}

async function renderTopicCat(st, token) {
    hadithView.appendChild(spinnerLine('Henter…'));
    const cats = await loadHencCats();
    const kids = cats.filter(c => c.parent === st.id);
    const data = await getJson(`${HENC}hadeeths/list/?language=ar&category_id=${st.id}&page=${st.page || 1}&per_page=20`);
    if (token !== hRenderToken) return;
    hadithView.innerHTML = '';

    if (kids.length) {
        hadithView.appendChild(el('h3', { class: 'list-head' }, 'Underemner'));
        const list = el('div', { class: 'list' });
        kids.forEach(c => list.appendChild(catButton(c, () => hPush({ level: 'cat', id: c.id, label: c.titleLocal || c.title, page: 1 }))));
        hadithView.appendChild(list);
    }

    const items = data.data || [];
    const meta = data.meta || {};
    if (items.length) {
        hadithView.appendChild(el('h3', { class: 'list-head' }, `Hadith (${meta.total_items || items.length})`));
        const list = el('div', { class: 'list' });
        const lang = settings.targetLang;
        items.forEach(h => {
            const hasLocal = (h.translations || []).includes(lang);
            list.appendChild(el('button', {
                type: 'button', class: 'list-row', onclick: () => hPush({ level: 'hadith', id: String(h.id), label: 'Hadith' })
            },
                el('span', { class: 'list-main' }, el('span', { class: 'list-ar big', dir: 'rtl' }, h.title)),
                hasLocal ? el('span', { class: 'lang-badge', title: 'Officiel oversættelse findes' }, lang.toUpperCase()) : null,
                el('span', { class: 'chev' }, '›')));
        });
        hadithView.appendChild(list);

        const page = Number(meta.current_page || st.page || 1);
        const last = Number(meta.last_page || 1);
        if (last > 1) {
            hadithView.appendChild(el('div', { class: 'pager' },
                el('button', { type: 'button', class: 'btn btn-small btn-ghost', disabled: page <= 1, onclick: () => { st.page = page - 1; renderHadith(); window.scrollTo(0, 0); } }, '‹ Forrige'),
                el('span', { class: 'note' }, `Side ${page} af ${last}`),
                el('button', { type: 'button', class: 'btn btn-small btn-ghost', disabled: page >= last, onclick: () => { st.page = page + 1; renderHadith(); window.scrollTo(0, 0); } }, 'Næste ›')));
        }
    } else if (!kids.length) {
        hadithView.appendChild(el('p', { class: 'note' }, 'Ingen hadith i dette emne.'));
    }
}

async function renderHencHadith(st, token) {
    hadithView.appendChild(spinnerLine('Henter hadith…'));
    const ar = await getJson(`${HENC}hadeeths/one/?language=ar&id=${st.id}`);
    const lang = settings.targetLang;
    let local = null;
    if (lang !== 'ar' && (ar.translations || []).includes(lang)) {
        try { local = await getJson(`${HENC}hadeeths/one/?language=${encodeURIComponent(lang)}&id=${st.id}`); } catch (e) { local = null; }
    }
    if (token !== hRenderToken) return;
    hadithView.innerHTML = '';
    st.label = local ? local.title : ar.title;
    renderHadithCrumbs();

    const card = el('article', { class: 'hadith-card' });
    card.appendChild(el('h3', { class: 'hadith-title', dir: 'rtl' }, ar.title));
    if (local) card.appendChild(el('div', { class: 'hadith-title-local' }, local.title));
    card.appendChild(el('div', { class: 'hadith-ar', dir: 'rtl', lang: 'ar' }, ar.hadeeth));
    card.appendChild(el('div', { class: 'hadith-meta' },
        ar.grade ? el('span', { class: 'grade' }, ar.grade + (local && local.grade ? ` · ${local.grade}` : '')) : null,
        ar.attribution ? el('span', { class: 'attrib', dir: 'rtl' }, ar.attribution) : null));

    if (local) {
        card.appendChild(el('div', { class: 'hadith-section' },
            el('div', { class: 'mt-label' }, `Officiel oversættelse (${(LANG_NAME[lang] || lang).toLowerCase()}) · HadeethEnc`),
            el('div', { class: 'hadith-local' }, local.hadeeth)));
    }

    // Forklaring (sharh)
    const expl = el('details', { class: 'hadith-details', open: true },
        el('summary', {}, 'Forklaring · الشرح'),
        local && local.explanation ? el('div', { class: 'hadith-local' }, local.explanation) : null,
        el('div', { class: 'hadith-ar small', dir: 'rtl' }, ar.explanation || ''));
    card.appendChild(expl);

    const hints = (local && local.hints && local.hints.length ? local.hints : ar.hints) || [];
    if (hints.length) {
        card.appendChild(el('details', { class: 'hadith-details' },
            el('summary', {}, 'Lærdomme · الفوائد'),
            el('ul', { class: 'hints', dir: local ? 'ltr' : 'rtl' }, hints.map(h => el('li', {}, h)))));
    }
    const words = (local && local.words_meanings && local.words_meanings.length ? local.words_meanings : ar.words_meanings) || [];
    if (words.length) {
        card.appendChild(el('details', { class: 'hadith-details' },
            el('summary', {}, 'Ordforklaringer · معاني الكلمات'),
            el('dl', { class: 'words' }, words.flatMap(w => [el('dt', { dir: 'rtl' }, w.word), el('dd', {}, w.meaning)]))));
    }
    if (ar.reference) {
        card.appendChild(el('details', { class: 'hadith-details' },
            el('summary', {}, 'Kildehenvisninger · المراجع'),
            el('div', { class: 'hadith-ar small', dir: 'rtl' }, ar.reference)));
    }

    const plainAr = `${ar.title}\n\n${ar.hadeeth}\n\n${ar.attribution || ''} – ${ar.grade || ''}\n\nالشرح:\n${ar.explanation || ''}`;
    const mtBox = el('div', { class: 'item-mt', hidden: true });
    const trBtn = el('button', { type: 'button', class: 'btn btn-small btn-gold tr-btn' }, local ? 'Maskinoversæt arabisk' : `Oversæt til ${(LANG_NAME[lang] || lang).toLowerCase()}`);
    trBtn.addEventListener('click', () => translateInto(mtBox, `${ar.hadeeth}\n\n${ar.explanation || ''}`, 'ar', trBtn));
    const listenBtn = listenButton(() => [
        { icon: '📖', label: 'Hadith på arabisk', text: ar.hadeeth, lang: 'ar' },
        local ? { icon: '🌐', label: `Hadith på ${langLabel(lang)}`, text: local.hadeeth, lang } : translatedPart(ar.hadeeth, 'ar', 'Hadith'),
        { icon: '📜', label: 'Forklaring på arabisk', text: ar.explanation, lang: 'ar' },
        local && local.explanation ? { icon: '📜', label: `Forklaring på ${langLabel(lang)}`, text: local.explanation, lang }
            : translatedPart(ar.explanation, 'ar', 'Forklaring')
    ], 'btn btn-small btn-gold');
    card.appendChild(el('div', { class: 'tafsir-actions' },
        listenBtn,
        trBtn,
        el('button', { type: 'button', class: 'btn btn-small btn-ghost', onclick: () => copyText(local ? `${local.title}\n\n${local.hadeeth}\n\n${local.explanation || ''}\n\n---\n\n${plainAr}` : plainAr) }, '⧉ Kopiér'),
        el('button', { type: 'button', class: 'btn btn-small btn-ai', onclick: () => openAiSheet({
            kind: 'hadith', ref: `${ar.attribution || 'HadeethEnc'}, ${ar.grade || ''}`, srcLang: 'ar',
            sourceName: 'HadeethEnc.com', body: `${ar.hadeeth}\n\nالشرح:\n${ar.explanation || ''}`
        }) }, '✨ Spørg AI'),
        el('button', { type: 'button', class: 'btn btn-small btn-ghost', onclick: () => openSaveSheet({
            type: 'hadith', title: local ? local.title : ar.title, arabic: ar.hadeeth, translation: local ? local.hadeeth : '',
            translationLang: local ? lang : '',
            source: [ar.attribution, 'HadeethEnc #' + st.id].filter(Boolean).join(' · '), grade: ar.grade || ''
        }) }, '☆ Gem'),
        el('button', { type: 'button', class: 'btn btn-small btn-ghost', onclick: () => openExternal(`https://hadeethenc.com/${local ? lang : 'ar'}/browse/hadith/${st.id}`) }, 'Åbn på hadeethenc.com ↗')));
    card.appendChild(mtBox);
    hadithView.appendChild(card);
}

// ---------------- Samlinger (hadith-api) ----------------

const sectionNameCache = store.get('hadithSectionNames', {});

async function localizedSectionNames(book) {
    const lang = settings.targetLang;
    if (lang === 'en') return null;
    const key = book.id + ':' + lang;
    if (sectionNameCache[key]) return sectionNameCache[key];
    // Nummerér linjerne, så de kan parres igen selv hvis Google slår linjer sammen
    const text = book.sections.map((s, i) => `${i + 1}. ${s[1].replace(/\n/g, ' ')}`).join('\n');
    const out = await translateText(text, 'en', lang);
    const found = new Map();
    for (const m of out.matchAll(/(?:^|\n|\s)(\d{1,3})\.\s*([^\n]*?)(?=\s+\d{1,3}\.\s|\n|$)/g)) {
        found.set(Number(m[1]), m[2].trim());
    }
    const lines = book.sections.map((s, i) => found.get(i + 1) || s[1]);
    if (found.size < book.sections.length * 0.7) return null;
    sectionNameCache[key] = lines;
    store.set('hadithSectionNames', sectionNameCache);
    return lines;
}

async function renderBooksRoot() {
    hadithView.appendChild(el('p', { class: 'note' }, 'De klassiske samlinger med arabisk tekst og engelsk oversættelse. Hver hadith kan oversættes, kopieres, gemmes og sendes til en AI.'));
    const list = el('div', { class: 'list' });
    for (const b of HADITH_BOOKS) {
        list.appendChild(el('button', {
            type: 'button', class: 'list-row', onclick: () => {
                if (b.sections.length === 1) hPush({ level: 'section', book: b.id, sec: b.sections[0][0], label: b.name, shown: 30 });
                else hPush({ level: 'book', book: b.id, label: b.name });
            }
        },
            el('span', { class: 'list-main' },
                el('span', { class: 'list-title' }, b.name),
                el('span', { class: 'list-ar', dir: 'rtl' }, b.ar)),
            el('span', { class: 'count' }, b.sections.length > 1 ? `${b.sections.length} bøger` : `${b.sections[0][3] - b.sections[0][2] + 1}`),
            el('span', { class: 'chev' }, '›')));
    }
    hadithView.appendChild(list);
    if (typeof renderMoreBooks === 'function') renderMoreBooks(hadithView);
}

async function renderBook(st, token) {
    const book = HADITH_BOOKS.find(b => b.id === st.book);
    hadithView.appendChild(el('h3', { class: 'list-head' }, el('span', {}, book.name), ' ', el('span', { class: 'list-ar', dir: 'rtl' }, book.ar)));
    const list = el('div', { class: 'list' });
    const rows = book.sections.map(([num, name, first, last]) => {
        const title = el('span', { class: 'list-title' }, `${num}. ${name}`);
        const sub = el('span', { class: 'list-sub' }, `Hadith ${first}–${last}`);
        list.appendChild(el('button', {
            type: 'button', class: 'list-row', onclick: () => hPush({ level: 'section', book: book.id, sec: num, label: `Bog ${num}`, shown: 30 })
        }, el('span', { class: 'list-main' }, title, sub), el('span', { class: 'count' }, String(last - first + 1)), el('span', { class: 'chev' }, '›')));
        return { title, num, name };
    });
    hadithView.appendChild(list);

    // Oversæt kapitelnavne til det valgte sprog i baggrunden
    try {
        const names = await localizedSectionNames(book);
        if (names && token === hRenderToken) {
            rows.forEach((r, i) => {
                r.title.textContent = `${r.num}. ${names[i]}`;
                r.title.after(el('span', { class: 'list-sub en' }, r.name));
            });
        }
    } catch (e) { /* behold engelsk */ }
}

async function renderSection(st, token) {
    const book = HADITH_BOOKS.find(b => b.id === st.book);
    const sec = book.sections.find(s => s[0] === st.sec);
    hadithView.appendChild(spinnerLine('Henter hadith…'));
    const [ara, eng] = await Promise.all([
        getHadithApi(`ara-${book.id}/sections/${st.sec}.json`),
        getHadithApi(`eng-${book.id}/sections/${st.sec}.json`).catch(() => null)
    ]);
    if (token !== hRenderToken) return;
    hadithView.innerHTML = '';
    const engMap = new Map(((eng && eng.hadiths) || []).map(h => [h.hadithnumber, h]));
    const all = (ara.hadiths || []).filter(h => (h.text || '').trim()).map(h => ({ ar: h, en: engMap.get(h.hadithnumber) }));

    hadithView.appendChild(el('h3', { class: 'list-head' }, `${book.name} · ${sec ? sec[1] : ''}`));
    const filter = el('input', { type: 'search', class: 'search', placeholder: 'Søg i dette kapitel (arabisk eller engelsk)…' });
    hadithView.appendChild(filter);
    const listBox = el('div', {});
    hadithView.appendChild(listBox);

    const strip = s => s.replace(/[ً-ْٰـ]/g, '');
    const draw = () => {
        listBox.innerHTML = '';
        const q = strip(filter.value.trim().toLowerCase());
        const matches = q
            ? all.filter(x => strip(x.ar.text).includes(q) || (x.en && x.en.text.toLowerCase().includes(q)))
            : all;
        const shown = matches.slice(0, st.shown || 30);
        if (!matches.length) listBox.appendChild(el('p', { class: 'note' }, 'Ingen hadith matcher søgningen.'));
        shown.forEach(x => listBox.appendChild(bookHadithCard(book, x)));
        if (matches.length > shown.length) {
            listBox.appendChild(el('button', {
                type: 'button', class: 'btn btn-ghost btn-block', onclick: () => { st.shown = (st.shown || 30) + 30; draw(); }
            }, `Vis flere (${matches.length - shown.length} tilbage)`));
        }
    };
    let t = null;
    filter.addEventListener('input', () => { clearTimeout(t); t = setTimeout(draw, 250); });
    draw();
}

function bookHadithCard(book, { ar, en }) {
    const num = ar.hadithnumber;
    const card = el('article', { class: 'hadith-card compact' });
    card.appendChild(el('div', { class: 'item-head' },
        el('span', { class: 'item-badge hadith' }, `#${num}`),
        el('b', { class: 'item-ref' }, book.name),
        null));
    card.appendChild(el('div', { class: 'hadith-ar', dir: 'rtl', lang: 'ar' }, ar.text));
    if (en && en.text) card.appendChild(el('div', { class: 'hadith-en' }, en.text));
    const grades = (en && en.grades) || ar.grades || [];
    if (grades.length) {
        card.appendChild(el('div', { class: 'hadith-meta' }, grades.map(g => el('span', { class: 'grade' }, `${g.grade} (${g.name})`))));
    }
    const mtBox = el('div', { class: 'item-mt', hidden: true });
    const trBtn = el('button', { type: 'button', class: 'btn btn-small btn-gold tr-btn' }, 'Oversæt');
    trBtn.addEventListener('click', () => translateInto(mtBox, en && en.text ? en.text : ar.text, en && en.text ? 'en' : 'ar', trBtn));
    const ref = `${book.name} ${num}`;
    const hasEn = !!(en && en.text);
    card.appendChild(el('div', { class: 'tafsir-actions' },
        listenButton(() => [
            book.id === 'bukhari' ? bukhariRecordedPart(num, ar.text) : null,
            { icon: '📖', label: book.id === 'bukhari' ? 'Hadith på arabisk (computerstemme)' : 'Hadith på arabisk', text: ar.text, lang: 'ar' },
            hasEn ? { icon: '🌐', label: 'Engelsk oversættelse', text: en.text, lang: 'en' } : null,
            translatedPart(hasEn ? en.text : ar.text, hasEn ? 'en' : 'ar', 'Hadith')
        ], 'btn btn-small btn-gold'),
        trBtn,
        el('button', { type: 'button', class: 'btn btn-small btn-ghost', onclick: () => copyText(`${ref}\n\n${ar.text}\n\n${en ? en.text : ''}`) }, '⧉ Kopiér'),
        (SHARH_WORKS[book.id] || []).length
            ? el('button', { type: 'button', class: 'btn btn-small btn-gold sharh-btn', onclick: () => openSharhChooser(book, num, ar.arabicnumber, ar.text) }, '📜 Sharh')
            : null,
        el('button', { type: 'button', class: 'btn btn-small btn-ai', onclick: () => openAiSheet({
            kind: 'hadith', ref, srcLang: 'ar', sourceName: book.name,
            body: ar.text + (en && en.text ? `\n\nEngelsk oversættelse: ${en.text}` : '')
        }) }, '✨ AI'),
        el('button', { type: 'button', class: 'btn btn-small btn-ghost', onclick: () => openSaveSheet({
            type: 'hadith', title: ref, arabic: ar.text, translation: en ? en.text : '', translationLang: 'en',
            source: `${book.name} ${num}`, grade: grades.map(g => `${g.grade} (${g.name})`).join(', ')
        }) }, '☆ Gem')));
    card.appendChild(mtBox);
    return card;
}

// =================================================================
// Søgning i hadith
//  - HadeethEnc: alle titler (arabisk + valgt sprog) hentes én gang og gemmes på telefonen
//  - Hisn al-Muslim og Fada'il al-Ayat: teksten ligger i appen
//  - Arabiske værker: Shamela's egen søgning i alle 54 værker på én gang
//  - Samlinger: søgning kapitel for kapitel i én eller alle samlinger (arabisk + engelsk tekst)
//  Skriver man på dansk, oversættes søgeordet til engelsk og arabisk.
// =================================================================

const HENC_INDEX_MAX_AGE = 7 * 24 * 3600 * 1000;
let hencIndex = null;
let bookSearchToken = 0;

async function loadHencIndex(onProgress) {
    const lang = settings.targetLang;
    if (hencIndex && hencIndex.lang === lang) return hencIndex.items;
    const cached = store.get('hencIndex', null);
    if (cached && cached.lang === lang && Date.now() - cached.time < HENC_INDEX_MAX_AGE) {
        hencIndex = cached;
        return cached.items;
    }
    const cats = await loadHencCats();
    const roots = cats.filter(c => !c.parent).map(c => c.id);
    const map = new Map();
    for (let i = 0; i < roots.length; i++) {
        if (onProgress) onProgress(i + 1, roots.length);
        const ar = await getJson(`${HENC}hadeeths/list/?language=ar&category_id=${roots[i]}&page=1&per_page=5000`);
        (ar.data || []).forEach(h => { if (!map.has(h.id)) map.set(h.id, [h.id, h.title, '']); });
        if (lang !== 'ar') {
            try {
                const loc = await getJson(`${HENC}hadeeths/list/?language=${encodeURIComponent(lang)}&category_id=${roots[i]}&page=1&per_page=5000`);
                (loc.data || []).forEach(h => { const e = map.get(h.id); if (e) e[2] = h.title; });
            } catch (e) { /* ingen oversatte titler */ }
        }
    }
    hencIndex = { lang, time: Date.now(), items: [...map.values()] };
    store.set('hencIndex', hencIndex);
    return hencIndex.items;
}

function setHadithSearchMode(on) {
    $('hadithResults').hidden = !on;
    $('hadithBrowse').hidden = on;
}

// Søgeordet på de sprog, kilderne er skrevet på. Skriver man dansk (eller andet), oversættes det
// til engelsk (samlingernes oversættelse) og arabisk (Shamela-værkerne).
async function searchTerms(raw) {
    if (hasArabic(raw)) return { ar: raw, en: null, extra: null };
    let en = raw, ar = null;
    try { en = (await translateText(raw, 'auto', 'en')).trim() || raw; } catch (e) { en = raw; }
    try { ar = (await translateText(raw, 'auto', 'ar')).trim() || null; } catch (e) { ar = null; }
    return { ar, en, extra: [en !== raw ? `engelsk: "${en}"` : '', ar ? `arabisk: "${ar}"` : ''].filter(Boolean).join(', ') };
}

async function runHadithSearch() {
    const raw = $('hadithSearch').value.trim();
    bookSearchToken++;
    if (!raw) { setHadithSearchMode(false); return; }
    setHadithSearchMode(true);
    const box = $('hadithResults');
    box.innerHTML = '';
    const token = bookSearchToken;
    const q = normText(raw);
    const termsBox = el('p', { class: 'note' });
    box.appendChild(termsBox);
    const termsP = searchTerms(raw).then(t => {
        if (t.extra && token === bookSearchToken) termsBox.textContent = `Søger også efter ${t.extra}.`;
        return t;
    });
    // Et match: alle ord fra det man skrev – eller fra den engelske/arabiske udgave af søgeordet
    const matcher = t => {
        const qs = [q, t.en && normText(t.en), t.ar && normText(t.ar)].filter(Boolean);
        return text => { const n = normText(text); return qs.some(x => matchesQuery(n, x)); };
    };

    // --- 1) HadeethEnc (titler) ---
    const hencBox = el('div', {});
    box.append(el('h3', { class: 'list-head' }, 'Emner · HadeethEnc'), hencBox);
    hencBox.appendChild(spinnerLine('Henter hadith-oversigt (kun første gang)…'));
    const hencDone = loadHencIndex((i, n) => {
        hencBox.innerHTML = '';
        hencBox.appendChild(spinnerLine(`Henter hadith-oversigt (kun første gang)… ${i}/${n}`));
    }).then(items => {
        hencBox.innerHTML = '';
        const hits = items.filter(([, ar, loc]) => matchesQuery(normText(ar + ' ' + loc), q));
        hencBox.appendChild(el('p', { class: 'note' }, `${hits.length} hadith fundet i titlerne.`));
        const list = el('div', { class: 'list' });
        hits.slice(0, 40).forEach(([id, ar, loc]) => list.appendChild(el('button', {
            type: 'button', class: 'list-row', onclick: () => openHencFromSearch(id)
        }, el('span', { class: 'list-main' },
            loc ? el('span', { class: 'list-title' }, loc) : null,
            el('span', { class: 'list-ar big', dir: 'rtl' }, ar)),
        el('span', { class: 'chev' }, '›'))));
        hencBox.appendChild(list);
        if (hits.length > 40) hencBox.appendChild(el('p', { class: 'note' }, `Viser 40 af ${hits.length} – tilføj flere ord for at indsnævre.`));
    }).catch(err => {
        hencBox.innerHTML = '';
        hencBox.appendChild(el('div', { class: 'status error' }, '⚠ Kunne ikke hente oversigten: ' + err.message));
    });

    // --- 2) Samlinger i appen (Hisn al-Muslim, Fada'il al-Ayat) – med det samme ---
    const localBox = el('div', {});
    box.append(el('h3', { class: 'list-head' }, 'Hisn al-Muslim og Fada\'il al-Ayat was-Suwar'), localBox);
    // --- 3) Klassiske arabiske værker (Shamela) ---
    const shBox = el('div', {});
    box.append(el('h3', { class: 'list-head' }, 'Klassiske værker på arabisk · al-Maktaba ash-Shamila'), shBox);
    // --- 4) Fuld tekst i samlingerne med engelsk ---
    box.appendChild(el('h3', { class: 'list-head' }, 'Samlinger med arabisk og engelsk (fuld tekst)'));
    const sel = el('select', {});
    sel.appendChild(el('option', { value: 'all' }, 'Alle samlinger (stor download første gang)'));
    const og1 = el('optgroup', { label: 'De seks bøger m.fl.' });
    HADITH_BOOKS.forEach(b => og1.appendChild(el('option', { value: b.id }, `${b.name} · ${b.ar}`)));
    const og2 = el('optgroup', { label: 'Flere samlinger' });
    HJ_BOOKS.forEach(b => og2.appendChild(el('option', { value: b.id }, `${b.name} · ${b.ar}`)));
    sel.append(og1, og2);
    sel.value = store.get('hadithSearchBook', 'bukhari');
    if (!sel.value) sel.value = 'bukhari';
    const btn = el('button', { type: 'button', class: 'btn btn-small btn-gold' }, 'Søg i fuld tekst');
    const bookBox = el('div', {});
    box.append(el('div', { class: 'row' }, el('div', { class: 'field' }, sel), btn),
        el('p', { class: 'note' }, 'Søger i den arabiske og engelske tekst. Teksten hentes kapitel for kapitel (Bukhari ca. 14 MB, alle samlinger ca. 100 MB) – brug gerne wi-fi.'),
        bookBox);

    const t = await termsP;
    if (token !== bookSearchToken) return;
    const match = matcher(t);
    btn.addEventListener('click', () => {
        store.set('hadithSearchBook', sel.value);
        const ids = sel.value === 'all' ? [...HADITH_BOOKS.map(b => b.id), ...HJ_BOOKS.map(b => b.id)] : [sel.value];
        searchCollections(ids, match, bookBox, btn);
    });

    // Hisn al-Muslim og Fada'il (tekst i appen)
    const localHits = [];
    for (const b of (typeof SUNNAH_BOOKS !== 'undefined' ? SUNNAH_BOOKS : [])) {
        const secName = new Map(b.sections.map(x => [x[0], x[1] + ' ' + x[2]]));
        // kapiteltitlen tæller med (fx "Chapter: What to say before sleeping")
        for (const h of b.hadiths) if (match([h[2], h[3], h[5] || '', secName.get(h[0]) || ''].join(' '))) localHits.push([b, h]);
    }
    localBox.appendChild(el('p', { class: 'note' }, localHits.length ? `${localHits.length} fundet.` : 'Ingen fundet.'));
    localHits.slice(0, 20).forEach(([b, [, n, ar, en, ref, tr]]) => {
        const text = [tr ? 'Udtale: ' + tr : '', en, ref ? `(Kilde: ${ref})` : ''].filter(Boolean).join('\n\n');
        localBox.appendChild(bookHadithCard({ id: b.id, name: b.name }, { ar: { hadithnumber: n, arabicnumber: n, text: ar, grades: [] }, en: { text, grades: [] } }));
    });
    if (localHits.length > 20) localBox.appendChild(el('p', { class: 'note' }, `Viser 20 af ${localHits.length}.`));

    // Shamela-søgning (arabisk) i alle 54 værker på én gang
    if (t.ar) searchShamela(t.ar, shBox, 1, token);
    else shBox.appendChild(el('p', { class: 'note' }, 'Skriv på arabisk for at søge i de arabiske værker.'));
    await hencDone;
}

// Shamela's egen søgning – 10 resultater ad gangen, med uddrag, bind og side
async function searchShamela(term, box, page, token) {
    const more = box.querySelector('.sh-more');
    if (more) more.remove();
    const spin = spinnerLine(page === 1 ? 'Søger i de arabiske værker…' : 'Henter flere…');
    box.appendChild(spin);
    const body = new URLSearchParams([['term', term], ...SHAMELA_HADITH.map(b => ['books[]', String(b.id)]), ['page', String(page)]]).toString();
    try {
        const html = await httpRequest('https://shamela.ws/ajax/search', { method: 'POST', body, noCache: true });
        if (token !== bookSearchToken) return;
        spin.remove();
        const doc = new DOMParser().parseFromString(`<div id="r">${html}</div>`, 'text/html');
        const root = doc.getElementById('r');
        // Shamela giver 10 resultater ad gangen og en "flere"-knap, men intet samlet antal
        const results = [...root.querySelectorAll('.srch-page-ref')];
        const hasMore = !!root.querySelector('#bu_srch_more');
        if (page === 1) box.appendChild(el('p', { class: 'note' }, results.length ? (hasMore ? 'Mange steder fundet – de mest relevante først.' : `${results.length} steder fundet.`) : 'Ingen fundet.'));
        for (const refEl of results) {
            const head = refEl.parentElement;
            const a = head.querySelector('a[href*="/book/"]');
            const m = a && a.getAttribute('href').match(/\/book\/(\d+)\/(\d+)/);
            if (!m) continue;
            const [, id, pg] = m;
            const book = SHAMELA_HADITH.find(b => b.id === Number(id));
            if (!book) continue;
            const ref = refEl;
            let snip = head.nextElementSibling;
            while (snip && !snip.classList.contains('srch-snippet') && snip.tagName !== 'DIV') snip = snip.nextElementSibling;
            if (snip && !snip.classList.contains('srch-snippet')) snip = null;
            const fromFoot = !!(snip && snip.querySelector('.srch-footnote-badge'));
            const textEl = snip && (snip.querySelector('.srch-snippet-text') || snip);
            const row = el('button', {
                type: 'button', class: 'list-row sh-hit', onclick: () => openShamelaFromSearch(book.id, Number(pg))
            }, el('span', { class: 'list-main' },
                el('span', { class: 'list-title' }, book.name),
                el('span', { class: 'list-sub' }, [ref ? ref.textContent.trim() : `side ${pg}`, fromFoot ? 'i fodnoterne' : ''].filter(Boolean).join(' · ')),
                textEl ? el('span', { class: 'list-ar sh-snip', dir: 'rtl' }) : null),
            el('span', { class: 'chev' }, '›'));
            // Uddraget med søgeordene fremhævet (<em> fra Shamela)
            if (textEl) {
                const target = row.querySelector('.sh-snip');
                textEl.childNodes.forEach(nd => target.appendChild(nd.nodeName === 'EM' ? el('mark', {}, nd.textContent) : document.createTextNode(nd.textContent)));
            }
            box.appendChild(row);
        }
        if (hasMore) {
            box.appendChild(el('button', {
                type: 'button', class: 'btn btn-ghost btn-block sh-more', onclick: () => searchShamela(term, box, page + 1, token)
            }, 'Vis flere'));
        }
    } catch (err) {
        spin.remove();
        box.appendChild(el('div', { class: 'status error' }, '⚠ Kunne ikke søge i Shamela: ' + err.message));
    }
}

function openShamelaFromSearch(id, page) {
    setHadithSearchMode(false);
    hNav.src = 'books';
    $('hadithTabs').querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.src === 'books'));
    const book = SHAMELA_HADITH.find(b => b.id === id);
    hNav.books = [{ level: 'root' }, { level: 'shbook', book: id, label: book.name }];
    hPush({ level: 'shpage', book: id, page, label: `Side ${page}` });
}

// Fuld tekst i en eller flere samlinger (de seks bøger m.fl. + hadith-json)
async function searchCollections(ids, match, box, btn) {
    const token = ++bookSearchToken;
    btn.disabled = true;
    box.innerHTML = '';
    const status = el('div', {});
    const list = el('div', {});
    box.append(status, list);
    const MAX_SHOWN = ids.length > 1 ? 100 : 50;
    let found = 0;
    const perBook = [];
    const show = (book, x) => { found++; if (found <= MAX_SHOWN) list.appendChild(bookHadithCard(book, x)); };
    const progress = (book, i, n) => {
        status.innerHTML = '';
        status.appendChild(spinnerLine(`Søger i ${book.name}: kapitel ${i} af ${n} – ${found} fundet`));
    };
    const json = url => httpRequest(url, { noCache: true }).then(JSON.parse);
    try {
        for (const id of ids) {
            const before = found;
            const fw = HADITH_BOOKS.find(b => b.id === id);
            if (fw) {
                for (let i = 0; i < fw.sections.length; i++) {
                    if (token !== bookSearchToken) return;
                    progress(fw, i + 1, fw.sections.length);
                    const sec = fw.sections[i][0];
                    const get = path => json(HADITH_API + path).catch(() => json(HADITH_API_FALLBACK + path));
                    const [ara, eng] = await Promise.all([get(`ara-${fw.id}/sections/${sec}.json`), get(`eng-${fw.id}/sections/${sec}.json`).catch(() => null)]);
                    const engMap = new Map(((eng && eng.hadiths) || []).map(h => [h.hadithnumber, h]));
                    for (const h of ara.hadiths || []) {
                        if (!(h.text || '').trim()) continue;
                        const en = engMap.get(h.hadithnumber);
                        if (match(h.text + ' ' + (en ? en.text : ''))) show(fw, { ar: h, en });
                    }
                }
            } else {
                const hj = HJ_BOOKS.find(b => b.id === id);
                if (!hj) continue;
                const like = { id: hj.id, name: hj.name };
                for (let i = 0; i < hj.sections.length; i++) {
                    if (token !== bookSearchToken) return;
                    progress(hj, i + 1, hj.sections.length);
                    const sec = hj.sections[i];
                    const path = sec[0] === 0 ? null : `${hj.path}/${sec[0]}.json`;
                    const load = base => path ? json(base + path) : json(base.replace('/by_chapter/', '/by_book/') + hj.path + '.json');
                    const data = await load(HJ_CDN).catch(() => load(HJ_RAW));
                    const items = (data.hadiths || []).filter(h => h.chapterId === sec[0]).sort((a, b) => a.idInBook - b.idInBook);
                    items.forEach((h, j) => {
                        const en = h.english ? [h.english.narrator, h.english.text].filter(Boolean).join(' ').trim() : '';
                        if (!(h.arabic || '').trim() || !match(h.arabic + ' ' + en)) return;
                        const n = sec[4] + j;
                        show(like, { ar: { hadithnumber: n, arabicnumber: n, text: h.arabic.trim(), grades: [] }, en: en ? { text: en, grades: [] } : null });
                    });
                }
            }
            perBook.push([(HADITH_BOOKS.find(b => b.id === id) || HJ_BOOKS.find(b => b.id === id)).name, found - before]);
        }
        status.innerHTML = '';
        const summary = perBook.filter(([, n]) => n).map(([name, n]) => `${name}: ${n}`).join(' · ');
        status.appendChild(el('p', { class: 'note' }, found
            ? `${found} hadith fundet${found > MAX_SHOWN ? ` – viser de første ${MAX_SHOWN}` : ''}.${ids.length > 1 ? ' ' + summary : ''}`
            : 'Ingen hadith matcher.'));
    } catch (err) {
        status.innerHTML = '';
        status.appendChild(el('div', { class: 'status error' }, '⚠ Søgningen blev afbrudt: ' + err.message));
    } finally {
        btn.disabled = false;
    }
}

function openHencFromSearch(id) {
    setHadithSearchMode(false);
    hNav.src = 'topics';
    $('hadithTabs').querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.src === 'topics'));
    hPush({ level: 'hadith', id: String(id), label: 'Hadith' });
}

$('hadithSearchForm').addEventListener('submit', e => {
    e.preventDefault();
    $('hadithSearch').blur();
    runHadithSearch();
});
$('hadithSearch').addEventListener('input', () => {
    if (!$('hadithSearch').value.trim()) { bookSearchToken++; setHadithSearchMode(false); }
});
