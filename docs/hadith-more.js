'use strict';

// =================================================================
// Flere sunni hadith-værker under Hadith → Samlinger
//  1) Med engelsk (HJ_BOOKS): Riyad as-Salihin, Bulugh al-Maram, Mishkat m.fl. fra
//     AhmedBaset/hadith-json (sunnah.com-data) – hentes kapitel for kapitel og vises som de andre samlinger
//  2) Arabisk (SHAMELA_HADITH): Ibn Hibban, al-Mustadrak, Ibn Khuzayma, al-Bayhaqi, Musannaf-værker,
//     at-Tabarani, Musnad Ahmad m.fl. fra al-Maktaba ash-Shamila – bog → kitab → sider med hadith,
//     og man kan springe direkte til et hadith-nummer
// Data (kapitler, kutub, sidetal) ligger i hadith-books-more.js (tools/build_hadith_more.py).
// =================================================================

const HJ_CDN = 'https://cdn.jsdelivr.net/gh/AhmedBaset/hadith-json@main/db/by_chapter/';
const HJ_RAW = 'https://raw.githubusercontent.com/AhmedBaset/hadith-json/main/db/by_chapter/';

// Alle samlinger med engelsk: hadith-json + de to fra sunnah.com (sunnah-extra.js, ligger i appen)
function enBooks() {
    const sn = typeof SUNNAH_BOOKS !== 'undefined' ? SUNNAH_BOOKS : [];
    const i = HJ_BOOKS.findIndex(b => b.id === 'hj-darimi');
    return [...HJ_BOOKS.slice(0, i), ...sn, ...HJ_BOOKS.slice(i)];
}

const MORE_LEVELS = {
    hjbook: renderHjBook,
    hjsec: renderHjSection,
    shbook: renderShBook,
    shtoc: renderShToc,
    shpage: renderShPage
};

// ---------------- Oversigten (under de seks bøger) ----------------

function renderMoreBooks(view) {
    const search = el('input', { type: 'search', class: 'search mt', placeholder: '🔍 Find et værk (fx Ibn Hibban, Mustadrak, Riyad)…', dir: 'auto', autocomplete: 'off' });
    const box = el('div', {});
    view.append(search, box);

    const row = (title, ar, sub, count, onclick) => el('button', { type: 'button', class: 'list-row', onclick },
        el('span', { class: 'list-main' },
            el('span', { class: 'list-title' }, title),
            el('span', { class: 'list-ar', dir: 'rtl' }, ar),
            sub ? el('span', { class: 'list-sub' }, sub) : null),
        count ? el('span', { class: 'count' }, count) : null,
        el('span', { class: 'chev' }, '›'));

    const draw = () => {
        box.innerHTML = '';
        const q = normText(search.value.trim());
        const hit = (...parts) => !q || matchesQuery(normText(parts.join(' ')), q);

        const hj = enBooks().filter(b => hit(b.name, b.ar, b.author));
        if (hj.length) {
            box.appendChild(el('h3', { class: 'list-head' }, 'Flere samlinger – arabisk og engelsk'));
            const list = el('div', { class: 'list' });
            hj.forEach(b => list.appendChild(row(b.name, b.ar, b.author, String(b.total), () => hPush({ level: 'hjbook', book: b.id, label: b.name }))));
            box.appendChild(list);
        }

        const sh = SHAMELA_HADITH.filter(b => hit(b.name, b.ar, b.author, b.group));
        if (sh.length) {
            box.appendChild(el('h3', { class: 'list-head' }, 'Klassiske værker på arabisk · al-Maktaba ash-Shamila'));
            if (!q) box.appendChild(el('p', { class: 'note' }, 'Den arabiske tekst med isnad, som i de trykte udgaver. Hver hadith kan oversættes, læses op, gemmes og sendes til en AI.'));
            let group = null, list = null;
            for (const b of sh) {
                if (b.group !== group) {
                    group = b.group;
                    box.appendChild(el('div', { class: 'more-group' }, group));
                    list = el('div', { class: 'list' });
                    box.appendChild(list);
                }
                list.appendChild(row(b.name, b.ar.replace(/^كتاب\s+/, ''), b.author, '', () => hPush({ level: 'shbook', book: b.id, label: b.name })));
            }
        }
        if (!hj.length && !sh.length) box.appendChild(el('p', { class: 'note' }, 'Ingen værker matcher søgningen.'));
    };
    search.addEventListener('input', draw);
    draw();
}

// ---------------- 1) Værker med engelsk (hadith-json) ----------------

const hjBook = id => enBooks().find(b => b.id === id);
const hjNameCache = store.get('hjChapterNames', {});

async function renderHjBook(st, token) {
    const book = hjBook(st.book);
    hadithView.append(
        el('h3', { class: 'list-head' }, el('span', {}, book.name), ' ', el('span', { class: 'list-ar', dir: 'rtl' }, book.ar)),
        el('p', { class: 'note' }, `${book.author.replace(/ · sunnah\.com$/, '')} · ${book.total} numre med arabisk og engelsk (sunnah.com).`));
    const list = el('div', { class: 'list' });
    const rows = book.sections.map(([id, en, ar, count, first], i) => {
        const title = el('span', { class: 'list-title' }, `${i + 1}. ${en || ar}`);
        list.appendChild(el('button', {
            type: 'button', class: 'list-row', onclick: () => hPush({ level: 'hjsec', book: book.id, sec: id, label: `Kapitel ${i + 1}`, shown: 30 })
        }, el('span', { class: 'list-main' }, title,
            ar ? el('span', { class: 'list-ar', dir: 'rtl' }, ar) : null,
            el('span', { class: 'list-sub' }, `Hadith ${first}–${first + count - 1}`)),
        el('span', { class: 'count' }, String(count)), el('span', { class: 'chev' }, '›')));
        return { title, en, i };
    });
    hadithView.appendChild(list);

    // Kapitelnavne på det valgte sprog (maskinoversat én gang og gemt)
    const lang = settings.targetLang;
    if (lang === 'en' || lang === 'ar') return;
    const key = book.id + ':' + lang;
    try {
        let names = hjNameCache[key];
        if (!names) {
            const out = await translateText(book.sections.map((s, i) => `${i + 1}. ${(s[1] || s[2]).replace(/\s+/g, ' ')}`).join('\n'), 'en', lang);
            const found = {};
            for (const m of out.matchAll(/(?:^|\n|\s)(\d{1,3})\.\s*([^\n]*?)(?=\s+\d{1,3}\.\s|\n|$)/g)) found[Number(m[1])] = m[2].trim();
            if (Object.keys(found).length < book.sections.length * 0.7) return;
            names = book.sections.map((s, i) => found[i + 1] || s[1]);
            hjNameCache[key] = names;
            store.set('hjChapterNames', hjNameCache);
        }
        if (token !== hRenderToken) return;
        rows.forEach(r => {
            r.title.textContent = `${r.i + 1}. ${names[r.i]}`;
            if (r.en) r.title.after(el('span', { class: 'list-sub en' }, r.en));
        });
    } catch (e) { /* behold engelsk */ }
}

async function renderHjSection(st, token) {
    const book = hjBook(st.book);
    const sec = book.sections.find(s => s[0] === st.sec);
    if (book.local) { renderLocalSection(book, sec, st); return; }
    hadithView.appendChild(spinnerLine('Henter hadith…'));
    // Kapitel 0 (hadith uden kapitelnavn) findes kun i den samlede bogfil
    const path = st.sec === 0 ? null : `${book.path}/${st.sec}.json`;
    const load = async base => path ? getJson(base + path)
        : getJson(base.replace('/by_chapter/', '/by_book/') + book.path + '.json');
    let data;
    try { data = await load(HJ_CDN); }
    catch (e) { data = await load(HJ_RAW); }
    if (token !== hRenderToken) return;
    hadithView.innerHTML = '';

    const like = { id: book.id, name: book.name };
    const items = (data.hadiths || []).filter(h => h.chapterId === st.sec).sort((a, b) => a.idInBook - b.idInBook);
    // Nummer = kapitlets første nummer + plads i kapitlet (svarer til sunnah.com's nummerering)
    const all = items.map((h, i) => {
        const en = h.english ? [h.english.narrator, h.english.text].filter(Boolean).join(' ').trim() : '';
        const n = sec ? sec[4] + i : h.idInBook;
        return { ar: { hadithnumber: n, arabicnumber: n, text: (h.arabic || '').trim(), grades: [] }, en: en ? { text: en, grades: [] } : null, pos: i + 1 };
    }).filter(x => x.ar.text);

    showChapterList(book, sec, st, all);
}

// Samlinger der ligger i appen (Hisn al-Muslim, Fada'il al-Ayat): [kapitel, nr., arabisk, engelsk, kilde, translitteration]
function renderLocalSection(book, sec, st) {
    const all = book.hadiths.filter(h => h[0] === st.sec).map(([, n, ar, en, ref, tr]) => {
        const text = [tr ? 'Udtale: ' + tr : '', en, ref ? `(Kilde: ${ref})` : ''].filter(Boolean).join('\n\n');
        return { ar: { hadithnumber: n, arabicnumber: n, text: ar, grades: [] }, en: { text, grades: [] } };
    });
    showChapterList(book, sec, st, all);
}

async function showChapterList(book, sec, st, all) {
    const token = hRenderToken;
    const like = { id: book.id, name: book.name };
    hadithView.appendChild(el('h3', { class: 'list-head' }, `${book.name} · ${sec ? (sec[1] || sec[2]) : ''}`));
    const indexBox = el('div', {});
    const filter = el('input', { type: 'search', class: 'search', placeholder: 'Søg i dette kapitel (arabisk eller engelsk)…' });
    const listBox = el('div', {});
    hadithView.append(indexBox, filter, listBox);
    const strip = s => s.replace(/[ً-ْٰـ]/g, '');
    let babs = null; // { byPos: Map(pos → [kapitel]), list: [kapitel] }
    let more = null;
    const step = () => { st.shown = (st.shown || 30) + 50; draw(); };
    // Hentes flere automatisk, når man nærmer sig bunden – og alle på én gang, når man trækker i scroll-håndtaget
    const autoMore = 'IntersectionObserver' in window
        ? new IntersectionObserver(es => { if (token === hRenderToken && es.some(e => e.isIntersecting)) step(); }, { rootMargin: '1200px 0px' })
        : null;
    hadithView.onFastScroll = () => {
        if (token !== hRenderToken || !more) return;
        st.shown = all.length;
        draw();
    };
    const draw = () => {
        if (autoMore) autoMore.disconnect();
        more = null;
        listBox.innerHTML = '';
        const q = strip(filter.value.trim().toLowerCase());
        const matches = q ? all.filter(x => strip(x.ar.text).includes(q) || (x.en && x.en.text.toLowerCase().includes(q))) : all;
        const shown = matches.slice(0, st.shown || 30);
        if (!matches.length) listBox.appendChild(el('p', { class: 'note' }, 'Ingen hadith matcher søgningen.'));
        shown.forEach(x => {
            // Kapiteloverskrifter (abwab) før den første hadith i kapitlet – ikke mens man søger
            if (!q && babs && x.pos && babs.byPos.has(x.pos)) babs.byPos.get(x.pos).forEach(b => listBox.appendChild(babHeading(b)));
            listBox.appendChild(bookHadithCard(like, x));
        });
        if (matches.length > shown.length) {
            more = el('button', { type: 'button', class: 'btn btn-ghost btn-block', onclick: step }, `Vis flere (${matches.length - shown.length} tilbage)`);
            listBox.appendChild(more);
            if (autoMore) requestAnimationFrame(() => { if (more && more.isConnected) autoMore.observe(more); });
        }
    };
    let t = null;
    filter.addEventListener('input', () => { clearTimeout(t); t = setTimeout(draw, 250); });
    draw();

    // Hent kapitlerne for bogen (sunnah.com) og vis dem i listen + som indholdsfortegnelse
    if (!sec || !all.some(x => x.pos)) return;
    const data = await loadBabs(book.id);
    const arr = data && data[String(sec[0])];
    if (!arr || !arr.length || token !== hRenderToken) return;
    const list = arr.map(([pos, en, ar, no], i) => ({ pos, en: en.replace(/^Chapter:\s*/i, '').trim(), ar, no: no || String(i + 1), i, local: '' }));
    babs = { byPos: new Map(), list };
    list.forEach(b => { if (!babs.byPos.has(b.pos)) babs.byPos.set(b.pos, []); babs.byPos.get(b.pos).push(b); });
    const goTo = b => {
        const idx = all.findIndex(x => x.pos >= b.pos);
        if (idx >= (st.shown || 30)) st.shown = idx + 20;
        filter.value = '';
        draw();
        const h = listBox.querySelector(`[data-bab="${b.i}"]`);
        if (h) h.scrollIntoView({ block: 'start' });
    };
    const rows = el('div', { class: 'bab-index-list' });
    const fillIndex = () => {
        rows.innerHTML = '';
        list.forEach(b => rows.appendChild(el('button', { type: 'button', class: 'bab-index-row', onclick: () => goTo(b) },
            el('span', { class: 'bab-no' }, b.no),
            el('span', { class: 'bab-index-main' },
                el('span', {}, b.local || b.en || b.ar),
                b.ar ? el('span', { class: 'bab-ar', dir: 'rtl' }, b.ar) : null))));
    };
    fillIndex();
    indexBox.appendChild(el('details', { class: 'hadith-details bab-index' },
        el('summary', {}, `Kapitler i denne bog (${list.length}) · الأبواب`), rows));
    draw();

    // Kapiteltitlerne på dansk (maskinoversat én gang og gemt)
    const lang = settings.targetLang;
    if (lang === 'en' || lang === 'ar') return;
    const key = `babs:${book.id}:${sec[0]}:${lang}`;
    let names = store.get(key, null);
    if (!names) {
        try {
            const out = await translateText(list.map((b, i) => `${i + 1}. ${(b.en || b.ar).replace(/\s+/g, ' ')}`).join('\n'), b0lang(list), lang);
            const found = {};
            for (const m of out.matchAll(/(?:^|\n|\s)(\d{1,4})\.\s*([^\n]*?)(?=\s+\d{1,4}\.\s|\n|$)/g)) found[Number(m[1])] = m[2].trim();
            if (Object.keys(found).length < list.length * 0.7) return;
            names = list.map((b, i) => found[i + 1] || '');
            store.set(key, names);
        } catch (e) { return; }
    }
    if (token !== hRenderToken) return;
    list.forEach((b, i) => { b.local = names[i] || ''; });
    fillIndex();
    draw();
}
const b0lang = list => list.some(b => b.en) ? 'en' : 'ar';

// Kapiteloverskrift i listen
function babHeading(b) {
    return el('div', { class: 'bab-heading', 'data-bab': String(b.i) },
        el('div', { class: 'bab-label' }, `Kapitel ${b.no}`),
        el('div', { class: 'bab-title' }, b.local || b.en || ''),
        b.ar ? el('div', { class: 'bab-ar', dir: 'rtl' }, b.ar) : null,
        b.local && b.en ? el('div', { class: 'list-sub en' }, b.en) : null);
}

// Kapiteldata (babs/<samling>.js, fra sunnah.com) indlæses først når de skal bruges
const BABS_FILES = ['bukhari', 'muslim', 'abudawud', 'tirmidhi', 'nasai', 'ibnmajah', 'hj-riyad', 'hj-bulugh', 'hj-mishkat', 'hj-adab'];
const babsLoading = {};
function loadBabs(id) {
    if (!BABS_FILES.includes(id)) return Promise.resolve(null);
    if (window.HADITH_BABS && window.HADITH_BABS[id]) return Promise.resolve(window.HADITH_BABS[id]);
    if (!babsLoading[id]) {
        babsLoading[id] = new Promise(resolve => {
            const s = document.createElement('script');
            s.src = `babs/${id}.js`;
            s.onload = () => resolve((window.HADITH_BABS || {})[id] || null);
            s.onerror = () => { delete babsLoading[id]; resolve(null); };
            document.head.appendChild(s);
        });
    }
    return babsLoading[id];
}

// ---------------- 2) Arabiske værker fra Shamela ----------------

const shBook = id => SHAMELA_HADITH.find(b => b.id === id);
const SH_START = {
    dash: /^\s*(\d{1,6})\s*[-–]/,
    line: /^\s*(\d{1,6})\s*[-–]/,
    bracket: /^\s*\[(\d{1,6})\]/
};
const SH_NUMS = {
    dash: /(?:^|\s)(\d{1,6})\s*[-–]\s*(?:حدثنا|حدثني|أخبرنا|أخبرني|وحدثنا|وحدثني|ثنا|نا|عن|أنا|أنبأنا|قال)/g,
    line: /(?:^|\n)\s*(\d{1,6})\s*[-–]\s/g,
    bracket: /\[(\d{1,6})\]/g
};
const shKutubCache = store.get('shKutubNames', {});

// Én side: overskrift (ج/ص), afsnit i hovedteksten, fodnoter og hadith-numre (fodnoter tæller ikke med)
const shPageCache = new Map();
async function fetchShPage(book, page) {
    const key = book.id + ':' + page;
    if (shPageCache.has(key)) return shPageCache.get(key);
    let html;
    try { html = await httpRequest(`${SHAMELA}${book.id}/${page}`); }
    catch (e) { await new Promise(r => setTimeout(r, 1200)); html = await httpRequest(`${SHAMELA}${book.id}/${page}`); }
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const title = ((doc.querySelector('title') || {}).textContent || '').split(' - ').slice(0, 2).join(' – ');
    const nass = doc.querySelector('div.nass');
    const paras = [], foot = [];
    if (nass) {
        nass.querySelectorAll('script, style, a.btn_tag').forEach(x => x.remove());
        nass.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
        nass.querySelectorAll('p').forEach(p => {
            const t = p.textContent.replace(/[ \t]+/g, ' ').trim();
            if (!t) return;
            (p.classList.contains('hamesh') ? foot : paras).push(t);
        });
    }
    const main = paras.join('\n');
    const nums = [];
    if (book.pattern) for (const m of cleanForNumbers(main).matchAll(SH_NUMS[book.pattern])) nums.push(Number(m[1]));
    const res = { page, title, paras, foot: foot.join('\n'), nums };
    shPageCache.set(key, res);
    return res;
}

// Find siden med hadith nr. n (interpolationssøgning, som ved sharh)
async function locateShHadith(book, n, onStep) {
    const idxKey = 'shIdx:' + book.id;
    const idx = store.get(idxKey, {});
    const remember = r => {
        if (!r.nums.length) return;
        const s = [...r.nums].sort((a, b) => a - b);
        idx[r.page] = s[Math.floor(s.length / 2)];
        const keys = Object.keys(idx);
        if (keys.length > 300) delete idx[keys[0]];
        store.set(idxKey, idx);
    };
    const probe = async p => {
        for (let i = 0; i < 25 && p + i <= book.pages; i++) {
            const r = await fetchShPage(book, p + i);
            onStep && onStep();
            if (r.nums.length) { remember(r); return r; }
        }
        return null;
    };
    // Kendt slutpunkt: højeste nummer nær slutningen af bogen
    if (!idx.max) {
        const r = await probe(Math.max(1, Math.round(book.pages * 0.85)));
        if (r) { idx.max = Math.round(Math.max(...r.nums) / 0.85); store.set(idxKey, idx); }
    }
    let lo = 1, hi = book.pages, loVal = 0, hiVal = Math.max(idx.max || n * 2, n + 1);
    for (const [p, v] of Object.entries(idx)) {
        if (p === 'max') continue;
        const page = Number(p);
        if (v < n && page >= lo) { lo = page; loVal = v; }
        if (v > n && page <= hi) { hi = page; hiVal = v; }
    }
    for (let guard = 0; guard < 18 && hi - lo > 3; guard++) {
        const frac = Math.min(0.97, Math.max(0.03, (n - loVal) / Math.max(1, hiVal - loVal)));
        const guess = Math.min(hi - 1, Math.max(lo + 1, Math.round(lo + frac * (hi - lo))));
        const r = await probe(guess);
        if (!r || r.page >= hi) { hi = guess; continue; }
        if (r.nums.includes(n)) return r.page;
        const med = [...r.nums].sort((a, b) => a - b)[Math.floor(r.nums.length / 2)];
        if (med < n) { lo = r.page; loVal = med; } else { hi = guess; hiVal = med; }
    }
    let last = lo;
    for (let p = lo; p <= Math.min(book.pages, lo + 30); p++) {
        const r = await fetchShPage(book, p);
        onStep && onStep();
        if (r.nums.includes(n)) return p;
        if (r.nums.length) {
            remember(r);
            if (Math.min(...r.nums) > n) return last;
            last = p;
        }
    }
    return last;
}

async function renderShBook(st, token) {
    const book = shBook(st.book);
    hadithView.append(
        el('h3', { class: 'list-head' }, el('span', {}, book.name)),
        el('div', { class: 'list-ar big sh-title', dir: 'rtl' }, book.ar.replace(/^كتاب\s+/, '')),
        el('p', { class: 'note' }, `${book.author} · ${book.pages} sider på al-Maktaba ash-Shamila.`));

    // Spring til hadith-nummer eller side
    const numIn = el('input', { type: 'number', inputmode: 'numeric', min: 1, placeholder: book.pattern ? 'Hadith nr.' : 'Side nr.' });
    const go = el('button', { type: 'button', class: 'btn btn-primary btn-small' }, 'Gå til');
    const mode = el('select', {},
        book.pattern ? el('option', { value: 'h' }, 'Hadith nr.') : null,
        el('option', { value: 'p' }, 'Side'));
    mode.addEventListener('change', () => { numIn.placeholder = mode.value === 'h' ? 'Hadith nr.' : 'Side nr.'; });
    const status = el('div', { class: 'note' });
    const goTo = async () => {
        const n = parseInt(numIn.value, 10);
        if (!n || n < 1) { numIn.focus(); return; }
        if (mode.value === 'p') { hPush({ level: 'shpage', book: book.id, page: Math.min(n, book.pages), label: `Side ${Math.min(n, book.pages)}` }); return; }
        go.disabled = true;
        let steps = 0;
        status.textContent = `Leder efter hadith nr. ${n}…`;
        try {
            const page = await locateShHadith(book, n, () => { status.textContent = `Leder efter hadith nr. ${n}… (${++steps} sider tjekket)`; });
            if (token !== hRenderToken) return;
            hPush({ level: 'shpage', book: book.id, page, focus: n, label: `Nr. ${n}` });
        } catch (e) {
            status.textContent = 'Kunne ikke finde hadithen: ' + e.message;
        } finally { go.disabled = false; }
    };
    go.addEventListener('click', goTo);
    numIn.addEventListener('keydown', e => { if (e.key === 'Enter') goTo(); });
    hadithView.append(el('div', { class: 'sh-goto' }, mode, numIn, go), status);
    if (!book.pattern) hadithView.appendChild(el('p', { class: 'note' }, 'Dette værk har ingen hadith-numre i teksten – gå til et kapitel eller en side.'));

    // Indholdsfortegnelse (kutub)
    if (book.kutub.length) {
        hadithView.appendChild(el('h3', { class: 'list-head' }, 'Indhold'));
        const filter = book.kutub.length > 25 ? el('input', { type: 'search', class: 'search', placeholder: 'Søg i indholdet…', dir: 'auto' }) : null;
        const list = el('div', { class: 'list' });
        if (filter) hadithView.appendChild(filter);
        hadithView.appendChild(list);
        const lang = settings.targetLang;
        const local = shKutubCache[book.id + ':' + lang] || null;
        const draw = () => {
            list.innerHTML = '';
            const q = filter ? normText(filter.value.trim()) : '';
            book.kutub.forEach(([name, page, toc], i) => {
                const da = local && local[i];
                if (q && !matchesQuery(normText(name + ' ' + (da || '')), q)) return;
                list.appendChild(shTocRow(book, { name, page, toc }, da));
            });
        };
        if (filter) filter.addEventListener('input', draw);
        draw();
        // Oversæt kapitelnavnene én gang (op til 400 navne)
        if (!local && lang !== 'ar' && book.kutub.length <= 400) {
            try {
                const out = await translateText(book.kutub.map(([n], i) => `${i + 1}. ${n.replace(/\s+/g, ' ')}`).join('\n'), 'ar', lang);
                const found = {};
                for (const m of out.matchAll(/(?:^|\n|\s)(\d{1,3})\.\s*([^\n]*?)(?=\s+\d{1,3}\.\s|\n|$)/g)) found[Number(m[1])] = m[2].trim();
                if (Object.keys(found).length >= book.kutub.length * 0.7 && token === hRenderToken) {
                    const names = book.kutub.map((k, i) => found[i + 1] || '');
                    shKutubCache[book.id + ':' + lang] = names;
                    store.set('shKutubNames', shKutubCache);
                    renderHadith();
                }
            } catch (e) { /* behold arabisk */ }
        }
    }
    hadithView.appendChild(el('button', { type: 'button', class: 'btn btn-ghost btn-block mt', onclick: () => openExternal(`${SHAMELA}${book.id}`) }, 'Åbn værket på shamela.ws ↗'));
}

// Én række i indholdet: med underkapitler → liste over dem, ellers direkte til siden
function shTocRow(book, { name, page, toc }, da) {
    return el('button', {
        type: 'button', class: 'list-row', onclick: () => hPush(toc
            ? { level: 'shtoc', book: book.id, toc, page, name, label: da || name }
            : { level: 'shpage', book: book.id, page, label: da || name })
    }, el('span', { class: 'list-main' },
        da ? el('span', { class: 'list-title' }, da) : null,
        el('span', { class: 'list-ar', dir: 'rtl' }, name),
        toc ? el('span', { class: 'list-sub' }, 'Underkapitler (abwab) ›') : null),
    el('span', { class: 'list-sub' }, `s. ${page}`), el('span', { class: 'chev' }, '›'));
}

// Underkapitler fra Shamela (ajax/titlechilds) – gemmes på telefonen, så de kun hentes én gang
async function shTocChildren(book, toc) {
    const key = `shToc:${book.id}:${toc}`;
    const cached = store.get(key, null);
    if (cached) return cached;
    const html = await httpRequest(`https://shamela.ws/ajax/titlechilds/${book.id}/${toc}`);
    const doc = new DOMParser().parseFromString(`<div id="r">${html}</div>`, 'text/html');
    // <ul><li>[<a class="exp_bu" data-id="…">[+]</a>]<a href="…/book/ID/SIDE">navn</a></li>…</ul>
    const out = [];
    doc.querySelectorAll('#r > ul > li').forEach(li => {
        const a = [...li.children].find(x => x.tagName === 'A' && /\/book\/\d+\/\d+/.test(x.getAttribute('href') || ''));
        if (!a) return;
        const exp = li.querySelector(':scope > .exp_bu');
        out.push({ name: a.textContent.trim(), page: Number(a.getAttribute('href').match(/\/book\/\d+\/(\d+)/)[1]), toc: exp ? Number(exp.getAttribute('data-id')) : 0 });
    });
    store.set(key, out);
    return out;
}

async function renderShToc(st, token) {
    const book = shBook(st.book);
    hadithView.append(
        el('h3', { class: 'list-head' }, book.name),
        el('div', { class: 'list-ar big sh-title', dir: 'rtl' }, st.name || ''),
        el('button', { type: 'button', class: 'btn btn-ghost btn-block', onclick: () => hPush({ level: 'shpage', book: book.id, page: st.page, label: `Side ${st.page}` }) },
            `Læs fra begyndelsen (side ${st.page}) ›`));
    const box = el('div', { class: 'list mt' });
    hadithView.appendChild(box);
    box.appendChild(spinnerLine('Henter underkapitler…'));
    const kids = await shTocChildren(book, st.toc);
    if (token !== hRenderToken) return;
    box.innerHTML = '';
    if (!kids.length) { box.appendChild(el('p', { class: 'note' }, 'Ingen underkapitler.')); return; }
    const lang = settings.targetLang;
    const nameKey = `shTocNames:${book.id}:${st.toc}:${lang}`;
    const draw = names => {
        box.innerHTML = '';
        kids.forEach((k, i) => box.appendChild(shTocRow(book, k, names && names[i])));
    };
    let names = lang === 'ar' ? null : store.get(nameKey, null);
    draw(names);
    if (names || lang === 'ar') return;
    // Navnene på dansk (maskinoversat én gang og gemt)
    try {
        const out = await translateText(kids.map((k, i) => `${i + 1}. ${k.name.replace(/\s+/g, ' ')}`).join('\n'), 'ar', lang);
        const found = {};
        for (const m of out.matchAll(/(?:^|\n|\s)(\d{1,4})\.\s*([^\n]*?)(?=\s+\d{1,4}\.\s|\n|$)/g)) found[Number(m[1])] = m[2].trim();
        if (Object.keys(found).length < kids.length * 0.7 || token !== hRenderToken) return;
        names = kids.map((k, i) => found[i + 1] || '');
        store.set(nameKey, names);
        draw(names);
    } catch (e) { /* behold arabisk */ }
}

async function renderShPage(st, token) {
    const book = shBook(st.book);
    hadithView.appendChild(spinnerLine(`Henter side ${st.page}…`));
    const r = await fetchShPage(book, st.page);
    if (token !== hRenderToken) return;
    hadithView.innerHTML = '';
    // Forhent næste side, så bladring går hurtigt
    if (st.page < book.pages) fetchShPage(book, st.page + 1).catch(() => {});

    const pager = () => {
        const prev = el('button', { type: 'button', class: 'btn btn-ghost btn-small', disabled: st.page <= 1, onclick: () => turn(-1) }, '‹ Forrige');
        const next = el('button', { type: 'button', class: 'btn btn-ghost btn-small', disabled: st.page >= book.pages, onclick: () => turn(1) }, 'Næste ›');
        return el('div', { class: 'sh-pager' }, prev, el('span', { class: 'note' }, `Side ${st.page} / ${book.pages}`), next);
    };
    const turn = d => {
        st.page = Math.min(book.pages, Math.max(1, st.page + d));
        st.focus = null;
        st.label = `Side ${st.page}`;
        renderHadith();
        window.scrollTo(0, 0);
    };

    hadithView.append(
        el('h3', { class: 'list-head' }, `${book.name}`, r.title ? el('span', { class: 'list-sub' }, ' · ' + r.title.replace(/^.*?–\s*/, '')) : null),
        pager());

    // Del hovedteksten i hadith: et nyt kort begynder ved et afsnit, der starter med et nummer
    const blocks = [];
    let cur = null;
    const startRx = book.pattern ? SH_START[book.pattern] : null;
    for (const p of r.paras) {
        const m = startRx ? startRx.exec(cleanForNumbers(p)) : null;
        if (m) { cur = { num: Number(m[1]), text: p }; blocks.push(cur); continue; }
        // Overskrifter (kitab/bab/dhikr …) – uden vokaltegn, ellers genkendes "كِتَابُ" ikke
        const bare = cleanForNumbers(p).replace(/^[\s«"(\[]+/, '');
        const heading = p.length < 160 && /^(كتاب|باب|ذكر|فصل|الفصل|مسند|حديث|أحاديث|ما جاء|ومن|من مسند|جماع)/.test(bare);
        if (heading) { blocks.push({ heading: p }); cur = null; continue; }
        if (cur) cur.text += '\n' + p;
        else { cur = { num: null, text: p }; blocks.push(cur); }
    }
    if (!blocks.length) hadithView.appendChild(el('p', { class: 'note' }, 'Denne side er tom.'));

    let focusCard = null;
    for (const b of blocks) {
        if (b.heading) { hadithView.appendChild(el('div', { class: 'sh-heading', dir: 'rtl' }, b.heading)); continue; }
        const card = shHadithCard(book, st.page, b);
        if (st.focus && b.num === st.focus) { card.classList.add('focus'); focusCard = card; }
        hadithView.appendChild(card);
    }
    if (r.foot) {
        hadithView.appendChild(el('details', { class: 'hadith-details sh-foot' },
            el('summary', {}, 'Fodnoter (tahqiq) · الحواشي'),
            el('div', { class: 'hadith-ar small', dir: 'rtl' }, r.foot)));
    }
    hadithView.append(pager(),
        el('button', { type: 'button', class: 'btn btn-ghost btn-block mt', onclick: () => openExternal(`${SHAMELA}${book.id}/${st.page}`) }, 'Åbn siden på shamela.ws ↗'));
    if (focusCard) setTimeout(() => focusCard.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
}

function shHadithCard(book, page, b) {
    const ref = b.num ? `${book.name} ${b.num}` : `${book.name}, side ${page}`;
    const card = el('article', { class: 'hadith-card compact' });
    card.appendChild(el('div', { class: 'item-head' },
        b.num ? el('span', { class: 'item-badge hadith' }, `#${b.num}`) : el('span', { class: 'item-badge text' }, '…'),
        el('b', { class: 'item-ref' }, b.num ? book.name : 'Fortsat fra forrige side'),
        null));
    card.appendChild(el('div', { class: 'hadith-ar', dir: 'rtl', lang: 'ar' }, b.text));
    const mtBox = el('div', { class: 'item-mt', hidden: true });
    const trBtn = el('button', { type: 'button', class: 'btn btn-small btn-gold tr-btn' }, 'Oversæt');
    trBtn.addEventListener('click', () => translateInto(mtBox, b.text, 'ar', trBtn));
    card.appendChild(el('div', { class: 'tafsir-actions' },
        listenButton(() => [
            { icon: '📖', label: 'Hadith på arabisk', text: b.text, lang: 'ar' },
            translatedPart(b.text, 'ar', 'Hadith')
        ], 'btn btn-small btn-gold'),
        trBtn,
        el('button', { type: 'button', class: 'btn btn-small btn-ghost', onclick: () => copyText(`${ref}\n\n${b.text}`) }, '⧉ Kopiér'),
        el('button', { type: 'button', class: 'btn btn-small btn-ai', onclick: () => openAiSheet({
            kind: 'hadith', ref, srcLang: 'ar', sourceName: `${book.name} (${book.ar.replace(/^كتاب\s+/, '')}, al-Maktaba ash-Shamila)`, body: b.text
        }) }, '✨ AI'),
        el('button', { type: 'button', class: 'btn btn-small btn-ghost', onclick: () => openSaveSheet({
            type: 'hadith', title: ref, arabic: b.text, translation: '',
            source: `${book.name}${b.num ? ' ' + b.num : ''} · Shamela ${book.id}, side ${page}`, grade: ''
        }) }, '☆ Gem')));
    card.appendChild(mtBox);
    return card;
}
