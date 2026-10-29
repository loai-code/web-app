'use strict';

// =================================================================
// Ordbogssiden har to faner:
//  - Søg:   skriv et ord og vælg en ordbog (den oprindelige version)
//  - Liste: bladr selv gennem alle opslagsord i én lang liste,
//           som i en papirordbog – for at træne hukommelsen
// =================================================================

// Ordbøger der slår op på roden (resten bruger selve ordet)
const ROOT_BASED = new Set(['Arabic Almanac', 'The Arabic Lexicon', 'Quranic Arabic Corpus']);
const LOCALES = { da: 'da', en: 'en', de: 'de', fr: 'fr', ru: 'ru', tr: 'tr' };
const AR_NORM = { 'أ': 'ا', 'إ': 'ا', 'آ': 'ا', 'ء': 'ا', 'ٱ': 'ا', 'ؤ': 'و', 'ئ': 'ي', 'ى': 'ي', 'ة': 'ه' };
const LIST_SOURCES_NOTE = {
    da: 'Dansk retstavningsordliste (LibreOffice/Stavekontrolden).',
    en: 'Engelsk ordliste (SCOWL / LibreOffice).',
    de: 'Tysk ordliste (igerman98 / LibreOffice).',
    fr: 'Fransk ordliste (Dicollecte / LibreOffice).',
    ru: 'Russisk ordliste (LibreOffice).',
    tr: 'Tyrkisk ordliste (LibreOffice, MPL 2.0) – grundformer af ordene.',
    zh: 'Hele CC-CEDICT – samme ordbog som MDBG bygger på – med pinyin.'
};

let dictMode = store.get('dictMode', 'list');
let dictLang = store.get('dictLang', 'ar');
let arSource = store.get('arSource', 'quran');
const groupsCache = {};

const escapeHtml = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const spacedRoot = r => [...r].join(' ');
const cleanSlug = s => s.replace(/-\d+$/, '');

// ---------------- Indlæsning af store ordlister ----------------

const loadingScripts = {};
function loadWords(lang) {
    if (window.FULL_WORDS && FULL_WORDS[lang]) return Promise.resolve();
    if (!loadingScripts[lang]) {
        loadingScripts[lang] = new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = `words-${lang}.js`;
            const timer = setTimeout(() => s.onerror(), 30000); // giv op efter 30 sek.
            s.onload = () => { clearTimeout(timer); resolve(); };
            s.onerror = () => {
                delete loadingScripts[lang]; // så man kan prøve igen
                s.remove();
                reject(new Error('Kunne ikke indlæse ordlisten'));
            };
            document.body.appendChild(s);
        });
    }
    return loadingScripts[lang];
}

// ---------------- Gruppering efter bogstav ----------------

function arLetter(word) {
    const c = word.replace(/[ً-ٰٟ]/g, '')[0] || '';
    return AR_NORM[c] || c;
}

function groupKey() { return dictLang === 'ar' ? 'ar:' + arSource : dictLang; }

function buildGroups() {
    const key = groupKey();
    if (groupsCache[key]) return groupsCache[key];
    const map = new Map();
    const add = (letter, entry) => { if (!map.has(letter)) map.set(letter, []); map.get(letter).push(entry); };

    if (dictLang === 'ar') {
        if (arSource === 'quran') {
            for (const r of AR_ROOTS) add(arLetter(r[0]), { kind: 'root', root: r[0], count: r[1], lemmas: r[2] });
        } else {
            const book = AR_DICT_INDEX.find(b => b.key === arSource);
            for (const slug of book.words) add(arLetter(slug), { kind: 'entry', slug });
        }
        const order = 'ابتثجحخدذرزسشصضطظعغفقكلمنهوي';
        const groups = [...map.entries()].sort((a, b) => (order.indexOf(a[0]) + 1 || 99) - (order.indexOf(b[0]) + 1 || 99));
        return (groupsCache[key] = groups.map(([letter, entries]) => ({ letter, entries })));
    }

    if (dictLang === 'zh') {
        for (const line of FULL_WORDS.zh.split('\n')) {
            const [word, py, trad] = line.split('\t');
            const letter = (py || '?').normalize('NFD')[0].toUpperCase();
            add(letter, { kind: 'word', word, py, trad });
        }
        return (groupsCache[key] = [...map.entries()].map(([letter, entries]) => ({ letter, entries })));
    }

    const coll = new Intl.Collator(LOCALES[dictLang]);
    const words = FULL_WORDS[dictLang].split('\n').sort(coll.compare);
    for (const w of words) {
        let letter = w[0].toLowerCase();
        if (!(dictLang === 'da' && 'æøå'.includes(letter)) && !(dictLang === 'tr' && 'çğıöşü'.includes(letter))) {
            letter = ({ 'æ': 'a', 'œ': 'o', 'ß': 's' }[letter] || letter).normalize('NFD')[0];
        }
        add(letter, { kind: 'word', word: w });
    }
    const groups = [...map.entries()].sort((a, b) => coll.compare(a[0], b[0]));
    return (groupsCache[key] = groups.map(([letter, entries]) => ({ letter, entries })));
}

// ---------------- Fælles: faner ----------------

function renderDictTabs() {
    $('dictModeTabs').querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.mode === dictMode));
    const tabs = $('dictTabs');
    tabs.innerHTML = '';
    for (const code of ['ar', 'tr', 'da', 'en', 'de', 'fr', 'ru', 'zh'].filter(c => DICTS[c])) {
        const d = DICTS[code];
        tabs.appendChild(el('button', {
            type: 'button', class: 'chip-tab' + (code === dictLang ? ' active' : ''),
            onclick: () => { dictLang = code; store.set('dictLang', code); renderDict(); window.scrollTo(0, 0); }
        }, d.name));
    }
}

function renderDict() {
    renderDictTabs();
    $('dictSearchMode').hidden = dictMode !== 'search';
    $('dictListMode').hidden = dictMode !== 'list';
    $('dictListCard').hidden = dictMode !== 'list';
    if (dictMode !== 'list') $('fastScroll').hidden = true;
    if (dictMode === 'search') renderDictSearch();
    else renderDictList();
}

$('dictModeTabs').addEventListener('click', e => {
    const t = e.target.closest('.tab');
    if (!t) return;
    dictMode = t.dataset.mode;
    store.set('dictMode', dictMode);
    renderDict();
});

// =================================================================
// Søg-fanen (den oprindelige ordbog)
// =================================================================

const dictInput = $('dictInput');

function dictQuery() {
    let w = dictInput.value.trim();
    if (dictLang === 'ar' && $('dictStrip').checked) w = stripArabic(w);
    return w;
}

function renderDictSearch() {
    const d = DICTS[dictLang];
    dictInput.dir = dictLang === 'ar' ? 'rtl' : 'auto';
    dictInput.lang = dictLang;
    dictInput.placeholder = dictLang === 'ar' ? 'اكتب كلمة أو جذرًا… (fx كتب)' : `Skriv et ord på ${d.name.toLowerCase()}…`;
    $('dictStripRow').hidden = dictLang !== 'ar';
    $('dictSearchHint').textContent = d.hint;
    const list = $('dictCards');
    list.innerHTML = '';
    for (const item of sortedItems(dictLang)) {
        list.appendChild(el('button', { type: 'button', class: 'dict-card', onclick: () => openDictSearch(item) },
            el('div', { class: 'dict-card-head' },
                el('b', {}, item.name),
                item.ar ? el('span', { class: 'list-ar', dir: 'rtl' }, item.ar) : null),
            el('div', { class: 'dict-desc' }, item.desc),
            item.tags && item.tags.length ? el('div', { class: 'dict-tags' }, item.tags.map(t => el('span', { class: 'dict-tag' }, t))) : null));
    }
    renderDictHistory();
}

function openInBrowser(url, title) {
    if (window.AndroidBridge && AndroidBridge.openInApp) AndroidBridge.openInApp(url, title);
    else window.open(url, '_blank', 'noopener');
}

function openDictSearch(item) {
    const w = dictQuery();
    if (!w) { toast('Skriv først et ord'); dictInput.focus(); return; }
    saveDictHistory(dictInput.value.trim());
    openDictItem(item, w, {});
}

function saveDictHistory(w) {
    const hist = store.get('dictHistory', []).filter(x => x !== w);
    hist.unshift(w);
    store.set('dictHistory', hist.slice(0, 12));
    renderDictHistory();
}
function renderDictHistory() {
    const box = $('dictHistory');
    box.innerHTML = '';
    const hist = store.get('dictHistory', []);
    if (!hist.length) return;
    box.appendChild(el('span', { class: 'note' }, 'Seneste:'));
    hist.forEach(w => box.appendChild(el('button', {
        type: 'button', class: 'hist-chip', dir: 'auto',
        onclick: () => {
            dictInput.value = w;
            if (/[؀-ۿ]/.test(w) && dictLang !== 'ar') { dictLang = 'ar'; store.set('dictLang', 'ar'); renderDict(); }
        }
    }, w)));
}

$('dictClear').addEventListener('click', () => { dictInput.value = ''; dictInput.focus(); });
dictInput.addEventListener('keydown', e => { if (e.key === 'Enter') { dictInput.blur(); openDictSearch(DICTS[dictLang].items[0]); } });
$('dictStrip').checked = store.get('dictStrip', true);
$('dictStrip').addEventListener('change', () => store.set('dictStrip', $('dictStrip').checked));

// =================================================================
// Liste-fanen: én samlet, lang liste over alle ord.
// Listen er "virtuel": den er delt i blokke á op til 300 ord, og kun de
// blokke der er på eller nær skærmen tegnes – resten er tomme pladsholdere
// med den rigtige højde. Så kan selv 160.000 ord vises flydende.
// =================================================================

const BLOCK_SIZE = 300;
const ROW_H = 46;        // højde på en ordlinje (px) – skal matche CSS
const ROW_H_AR = 58;     // arabiske opslagsord
const HEAD_H = 64;       // bogstavoverskrift
let listToken = 0;
let blockObserver = null;
let currentBlocks = [];
let scrollSaveTimer = null;

async function renderDictList() {
    const token = ++listToken;
    const isAr = dictLang === 'ar';

    // Kildevælger for arabisk: Koranens rødder eller en af de klassiske ordbøger
    $('arSourceRow').hidden = !isAr;
    if (isAr) {
        const sel = $('arSource');
        if (!sel.options.length) {
            sel.appendChild(el('option', { value: 'quran' }, 'Koranens rødder og ordformer (1.651 rødder)'));
            AR_DICT_INDEX.forEach(b => sel.appendChild(el('option', { value: b.key }, `${b.name} · ${b.ar} (${b.words.length.toLocaleString('da-DK')} opslag)`)));
        }
        sel.value = arSource;
    }

    const listBox = $('dictList');
    if (blockObserver) blockObserver.disconnect();
    if (!isAr && !(window.FULL_WORDS && FULL_WORDS[dictLang])) {
        listBox.innerHTML = '';
        listBox.appendChild(spinnerLine('Indlæser ordlisten…'));
        try { await loadWords(dictLang); } catch (err) {
            listBox.innerHTML = '';
            listBox.appendChild(el('div', { class: 'status error' }, '⚠ ' + err.message));
            listBox.appendChild(el('button', { type: 'button', class: 'btn btn-ghost btn-block', onclick: renderDictList }, '↻ Prøv igen'));
            return;
        }
        if (token !== listToken) return;
    }

    const groups = buildGroups();
    const total = groups.reduce((n, g) => n + g.entries.length, 0);
    let note;
    if (isAr && arSource === 'quran') {
        note = 'Koranens rødder ordnet som i en klassisk ordbog. Under hver rod står Koranens ordformer og antal forekomster. Tryk for at slå op.';
    } else if (isAr) {
        const b = AR_DICT_INDEX.find(x => x.key === arSource);
        note = `Alle ${total.toLocaleString('da-DK')} opslagsord i ${b.name} (${b.author}) i ordbogens egen rækkefølge. Tryk på et ord for at åbne opslaget.`;
    } else {
        note = `${total.toLocaleString('da-DK')} ord. ${LIST_SOURCES_NOTE[dictLang]} Tryk på et ord for at slå det op – også på dansk.`;
    }
    $('dictHint').textContent = note;

    // Koranens rødder har varierende højde (ordformer under hver rod) – de er få nok til at blive tegnet direkte
    if (isAr && arSource === 'quran') {
        listBox.innerHTML = groups.map((g, gi) => blockHtml({ group: gi, start: 0, end: g.entries.length, head: true }, groups)).join('');
        restoreScroll();
        requestAnimationFrame(updateFastScroll);
        return;
    }

    // Del i blokke og lav pladsholdere med præcis højde
    currentBlocks = [];
    groups.forEach((g, gi) => {
        for (let start = 0; start < g.entries.length; start += BLOCK_SIZE) {
            currentBlocks.push({ group: gi, start, end: Math.min(start + BLOCK_SIZE, g.entries.length), head: start === 0 });
        }
    });
    const rowH = isAr ? ROW_H_AR : ROW_H;
    listBox.innerHTML = currentBlocks.map((b, i) =>
        `<div class="vblock" data-block="${i}" dir="${isAr ? 'rtl' : 'ltr'}" style="height:${(b.head ? HEAD_H : 0) + (b.end - b.start) * rowH}px"></div>`).join('');

    blockObserver = new IntersectionObserver(entries => {
        for (const e of entries) {
            const div = e.target;
            const b = currentBlocks[Number(div.dataset.block)];
            if (e.isIntersecting) {
                if (!div.dataset.filled) { div.innerHTML = blockHtml(b, groups); div.dataset.filled = '1'; }
            } else if (div.dataset.filled) {
                div.innerHTML = '';
                delete div.dataset.filled;
            }
        }
    }, { rootMargin: '2500px 0px' });
    listBox.querySelectorAll('.vblock').forEach(d => blockObserver.observe(d));
    restoreScroll();
    requestAnimationFrame(updateFastScroll);
}

function blockHtml(b, groups) {
    const g = groups[b.group];
    const isAr = dictLang === 'ar';
    let html = b.head
        ? `<h3 class="dict-letter" dir="${isAr ? 'rtl' : 'ltr'}">${escapeHtml(g.letter)} <small dir="ltr">${g.entries.length.toLocaleString('da-DK')} ord</small></h3>`
        : '';
    for (let i = b.start; i < b.end; i++) {
        const e = g.entries[i];
        if (e.kind === 'root') {
            html += `<div class="root-entry"><div class="root-line"><button type="button" class="root" data-root="${escapeHtml(e.root)}">${escapeHtml(spacedRoot(e.root))}</button>`
                + `<span class="root-count">${e.count}×</span></div><div class="lemmas">`
                + e.lemmas.map(l => `<button type="button" class="lemma" data-root="${escapeHtml(e.root)}" data-word="${escapeHtml(l)}">${escapeHtml(l)}</button>`).join('')
                + '</div></div>';
        } else if (e.kind === 'entry') {
            html += `<button type="button" class="word-row ar" data-slug="${escapeHtml(e.slug)}">${escapeHtml(cleanSlug(e.slug))}</button>`;
        } else {
            html += `<button type="button" class="word-row" data-word="${escapeHtml(e.word)}"${e.trad ? ` data-trad="${escapeHtml(e.trad)}"` : ''}>`
                + `<span class="w">${escapeHtml(e.word)}</span>`
                + (e.py ? `<span class="py">${escapeHtml(e.py)}</span>` : '') + '</button>';
        }
    }
    return html;
}

// Husk hvor man var nået til i hver liste
function scrollKey() { return 'dictScroll:' + groupKey(); }
function restoreScroll() {
    const saved = store.get(scrollKey(), 0);
    const top = $('dictListCard').getBoundingClientRect().top + window.scrollY;
    requestAnimationFrame(() => window.scrollTo(0, saved > 0 ? top + saved : 0));
}
window.addEventListener('scroll', () => {
    if (currentPage !== 'dict' || dictMode !== 'list') return;
    clearTimeout(scrollSaveTimer);
    scrollSaveTimer = setTimeout(() => {
        const top = $('dictListCard').getBoundingClientRect().top + window.scrollY;
        store.set(scrollKey(), Math.max(0, Math.round(window.scrollY - top)));
    }, 300);
}, { passive: true });

$('arSource').addEventListener('change', () => {
    arSource = $('arSource').value;
    store.set('arSource', arSource);
    renderDictList();
});

// Ordbøger der oversætter til dansk vises øverst i valgmenuen
function sortedItems(lang) {
    const items = DICTS[lang].items;
    if (lang === 'da') return items;
    return [...items.filter(i => i.tags.includes('Dansk')), ...items.filter(i => !i.tags.includes('Dansk'))];
}

function openDictItem(item, term, ctx) {
    const url = item.url(term, ctx);
    const title = `${item.name} – ${term}`;
    if (item.post) {
        const body = item.post(term, ctx);
        if (window.AndroidBridge && AndroidBridge.openInAppPost) { AndroidBridge.openInAppPost(url, body, title); return; }
        const form = el('form', { method: 'post', action: url, target: '_blank' });
        for (const [k, v] of new URLSearchParams(body)) form.appendChild(el('input', { type: 'hidden', name: k, value: v }));
        document.body.appendChild(form);
        form.submit();
        form.remove();
        return;
    }
    openInBrowser(url, title);
}

function dictAction(item, term, ctx) {
    const danish = item.tags.includes('Dansk');
    return { label: item.name, icon: danish ? '🇩🇰' : '↗', run: () => openDictItem(item, term, ctx) };
}

// Tryk i listen
$('dictList').addEventListener('click', e => {
    const b = e.target.closest('[data-slug], [data-root], [data-word]');
    if (!b) return;

    // Opslag i en bestemt klassisk ordbog → åbn opslaget direkte
    if (b.dataset.slug) {
        const book = AR_DICT_INDEX.find(x => x.key === arSource);
        const word = cleanSlug(b.dataset.slug);
        chooseAction(word, [
            { label: `Åbn i ${book.name}`, icon: '📖', run: () => openInBrowser(`https://arabiclexicon.hawramani.com/${encodeURIComponent(b.dataset.slug)}/?book=${book.book}`, `${book.name} – ${word}`) },
            ...sortedItems('ar').map(item => dictAction(item, stripArabic(word), {}))
        ]);
        return;
    }

    const isAr = dictLang === 'ar';
    const root = b.dataset.root || '';
    const word = b.dataset.word || root;
    const shown = isAr ? (b.dataset.word ? word : spacedRoot(root)) : word;
    const ctx = { trad: b.dataset.trad || '' };
    chooseAction(shown, sortedItems(dictLang).map(item => {
        const term = isAr ? (ROOT_BASED.has(item.name) || !b.dataset.word ? root : stripArabic(word)) : word;
        return dictAction(item, term, ctx);
    }));
});

// Fra et vers: vis ordet man leder efter – selve opslaget skal man selv finde i listen
function lookupWord(word) {
    dictLang = 'ar';
    dictMode = 'list';
    store.set('dictLang', 'ar');
    store.set('dictMode', 'list');
    $('dictTarget').hidden = false;
    $('dictTargetWord').textContent = word;
    showPage('dict');
    renderDict();
}
$('dictTargetClose').addEventListener('click', () => { $('dictTarget').hidden = true; });

renderDict();

// =================================================================
// Trækbar scrollbar: træk i håndtaget i højre side for hurtigt at komme
// gennem listen. Der vises bevidst ikke hvilket bogstav man er ved – man skal selv finde ordet.
// Bruges også i hadith-listerne (sammen med "til toppen"-knappen).
// =================================================================

// Den lange liste håndtaget styrer på hver side
const fastScrollTargets = {
    dict: () => dictMode === 'list' ? $('dictListCard') : null,
    hadith: () => hadithView
};
function fsTarget() {
    if (typeof currentPage === 'undefined') return null; // pages.js er ikke indlæst endnu
    const f = fastScrollTargets[currentPage];
    return f ? f() : null;
}

const fastScroll = $('fastScroll');
const fsThumb = $('fsThumb');
const FS_THUMB_H = 64;
let fsDragging = false;
let fsRaf = 0;

function listRange() {
    const card = fsTarget() || $('dictListCard');
    const start = card.getBoundingClientRect().top + window.scrollY - 90;
    const end = start + card.offsetHeight - window.innerHeight + 120;
    return { start, end: Math.max(start + 1, end) };
}

function updateFastScroll() {
    fsRaf = 0;
    const target = fsTarget();
    const show = !!target && target.offsetHeight > window.innerHeight * 3;
    fastScroll.hidden = !show;
    $('toTop').hidden = !(currentPage === 'hadith' && window.scrollY > window.innerHeight * 2);
    if (!show) return;
    const { start, end } = listRange();
    const ratio = Math.min(1, Math.max(0, (window.scrollY - start) / (end - start)));
    fsThumb.style.top = (ratio * (fastScroll.clientHeight - FS_THUMB_H)) + 'px';
}
window.addEventListener('scroll', () => { if (!fsRaf) fsRaf = requestAnimationFrame(updateFastScroll); }, { passive: true });
window.addEventListener('resize', () => { if (!fsRaf) fsRaf = requestAnimationFrame(updateFastScroll); });

function fsMoveTo(clientY) {
    const rect = fastScroll.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientY - rect.top - FS_THUMB_H / 2) / (rect.height - FS_THUMB_H)));
    const { start, end } = listRange();
    window.scrollTo(0, start + ratio * (end - start));
}

fastScroll.addEventListener('pointerdown', e => {
    // Hadith: hent resten af bogen ind, så håndtaget dækker hele bogen
    const target = fsTarget();
    if (target && target.onFastScroll) target.onFastScroll();
    fsDragging = true;
    fastScroll.classList.add('active');
    fastScroll.setPointerCapture(e.pointerId);
    fsMoveTo(e.clientY);
    e.preventDefault();
});
fastScroll.addEventListener('pointermove', e => { if (fsDragging) fsMoveTo(e.clientY); });
const fsEnd = () => {
    fsDragging = false;
    fastScroll.classList.remove('active');
};
fastScroll.addEventListener('pointerup', fsEnd);
$('toTop').addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
// Listen skifter højde, når siden tegnes om (ny bog, flere hadith osv.)
new MutationObserver(() => { if (!fsRaf) fsRaf = requestAnimationFrame(updateFastScroll); })
    .observe(document.body, { attributes: true, subtree: true, attributeFilter: ['hidden'] });
new MutationObserver(() => { if (!fsRaf) fsRaf = requestAnimationFrame(updateFastScroll); })
    .observe(hadithView, { childList: true, subtree: true });
fastScroll.addEventListener('pointercancel', fsEnd);
