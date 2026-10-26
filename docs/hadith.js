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
    const trBtn = el('button', { type: 'button', class: 'btn btn-small btn-gold' }, local ? 'Maskinoversæt arabisk' : `Oversæt til ${(LANG_NAME[lang] || lang).toLowerCase()}`);
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
    const trBtn = el('button', { type: 'button', class: 'btn btn-small btn-gold' }, 'Oversæt');
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
//  - Samlinger: søgning kapitel for kapitel i en hel samling (arabisk + engelsk tekst)
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

async function runHadithSearch() {
    const raw = $('hadithSearch').value.trim();
    bookSearchToken++;
    if (!raw) { setHadithSearchMode(false); return; }
    setHadithSearchMode(true);
    const box = $('hadithResults');
    box.innerHTML = '';
    const q = normText(raw);

    // --- HadeethEnc ---
    const hencBox = el('div', {});
    box.appendChild(el('h3', { class: 'list-head' }, 'Emner · HadeethEnc'));
    box.appendChild(hencBox);
    hencBox.appendChild(spinnerLine('Henter hadith-oversigt (kun første gang)…'));
    try {
        const items = await loadHencIndex((i, n) => {
            hencBox.innerHTML = '';
            hencBox.appendChild(spinnerLine(`Henter hadith-oversigt (kun første gang)… ${i}/${n}`));
        });
        hencBox.innerHTML = '';
        const hits = items.filter(([, ar, loc]) => matchesQuery(normText(ar + ' ' + loc), q));
        hencBox.appendChild(el('p', { class: 'note' }, `${hits.length} hadith fundet i titlerne.`));
        const list = el('div', { class: 'list' });
        hits.slice(0, 60).forEach(([id, ar, loc]) => list.appendChild(el('button', {
            type: 'button', class: 'list-row', onclick: () => openHencFromSearch(id)
        }, el('span', { class: 'list-main' },
            loc ? el('span', { class: 'list-title' }, loc) : null,
            el('span', { class: 'list-ar big', dir: 'rtl' }, ar)),
        el('span', { class: 'chev' }, '›'))));
        hencBox.appendChild(list);
        if (hits.length > 60) hencBox.appendChild(el('p', { class: 'note' }, `Viser 60 af ${hits.length} – tilføj flere ord for at indsnævre.`));
    } catch (err) {
        hencBox.innerHTML = '';
        hencBox.appendChild(el('div', { class: 'status error' }, '⚠ Kunne ikke hente oversigten: ' + err.message));
    }

    // --- Samlinger ---
    box.appendChild(el('h3', { class: 'list-head' }, 'Samlinger (fuld tekst)'));
    const sel = el('select', {});
    HADITH_BOOKS.forEach(b => sel.appendChild(el('option', { value: b.id }, `${b.name} · ${b.ar}`)));
    sel.value = store.get('hadithSearchBook', 'bukhari');
    const btn = el('button', { type: 'button', class: 'btn btn-small btn-gold' }, 'Søg i hele samlingen');
    const bookBox = el('div', {});
    box.appendChild(el('div', { class: 'row' }, el('div', { class: 'field' }, sel), btn));
    box.appendChild(el('p', { class: 'note' }, 'Søger i arabisk og engelsk tekst. De store samlinger hentes kapitel for kapitel (Bukhari ca. 14 MB) – brug gerne wi-fi.'));
    box.appendChild(bookBox);
    btn.addEventListener('click', () => { store.set('hadithSearchBook', sel.value); searchBook(sel.value, q, bookBox, btn); });
}

async function searchBook(bookId, q, box, btn) {
    const token = ++bookSearchToken;
    const book = HADITH_BOOKS.find(b => b.id === bookId);
    btn.disabled = true;
    box.innerHTML = '';
    const status = el('div', {});
    const list = el('div', {});
    box.append(status, list);
    let found = 0;
    try {
        for (let i = 0; i < book.sections.length; i++) {
            if (token !== bookSearchToken) return;
            const sec = book.sections[i];
            status.innerHTML = '';
            status.appendChild(spinnerLine(`Søger i ${book.name}: kapitel ${i + 1} af ${book.sections.length} – ${found} fundet`));
            const [ara, eng] = await Promise.all([
                getHadithApi(`ara-${book.id}/sections/${sec[0]}.json`),
                getHadithApi(`eng-${book.id}/sections/${sec[0]}.json`).catch(() => null)
            ]);
            const engMap = new Map(((eng && eng.hadiths) || []).map(h => [h.hadithnumber, h]));
            for (const h of ara.hadiths || []) {
                if (!(h.text || '').trim()) continue;
                const en = engMap.get(h.hadithnumber);
                if (matchesQuery(normText(h.text + ' ' + (en ? en.text : '')), q)) {
                    found++;
                    if (found <= 50) list.appendChild(bookHadithCard(book, { ar: h, en }));
                }
            }
        }
        status.innerHTML = '';
        status.appendChild(el('p', { class: 'note' }, found
            ? `${found} hadith fundet i ${book.name}${found > 50 ? ' – viser de første 50' : ''}.`
            : `Ingen hadith i ${book.name} matcher.`));
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
