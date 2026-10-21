'use strict';

// =================================================================
// Klassiske sharh (forklaringer) fra al-Maktaba ash-Shamila (shamela.ws).
// Appen finder den side i sharh-værket, hvor hadith nr. N kommenteres, ved
// en binær søgning gennem bogens sider (hadith-numrene står i teksten),
// og viser den arabiske tekst med mulighed for oversættelse og AI.
// =================================================================

const SHAMELA = 'https://shamela.ws/book/';

// num: hvilket nummer fra hadith-api der matcher værkets nummerering
//   'hadith' = hadithnumber, 'arabic' = heltalsdelen af arabicnumber (Muslim: Fu'ad 'Abd al-Baqi)
// pages: antal sider i bogen på Shamela; start: omtrent hvor kommentaren til de første hadith begynder. locate: false = ingen hadith-numre → åbnes ved bogens start
const SHARH_WORKS = {
    bukhari: [
        { id: 1673, start: 455, pattern: 'fath', name: 'Fath al-Bari', ar: 'فتح الباري', author: 'Ibn Hajar al-\'Asqalani (d. 852 H)', pages: 7996, num: 'hadith' },
        { id: 5756, start: 42, pattern: 'dash', name: '\'Umdat al-Qari', ar: 'عمدة القاري', author: 'Badr ad-Din al-\'Ayni (d. 855 H)', pages: 7603, num: 'hadith' },
        { id: 21716, start: 64, pattern: 'dash', name: 'Irshad as-Sari', ar: 'إرشاد الساري', author: 'al-Qastallani (d. 923 H)', pages: 8298, num: 'hadith' },
        { id: 137, pattern: 'dash', name: 'Fath al-Bari (Ibn Rajab)', ar: 'فتح الباري لابن رجب', author: 'Ibn Rajab al-Hanbali (d. 795 H) – dækker kun første del', pages: 4834, num: 'hadith' }
    ],
    muslim: [
        { id: 1711, start: 109, pattern: 'bracket', name: 'al-Minhaj (an-Nawawi)', ar: 'شرح النووي على مسلم', author: 'an-Nawawi (d. 676 H)', pages: 4086, num: 'arabic' },
        { id: 1712, pattern: 'bracket', name: 'ad-Dibaj (as-Suyuti)', ar: 'شرح السيوطي على مسلم', author: 'as-Suyuti (d. 911 H)', pages: 1639, num: 'arabic' }
    ],
    abudawud: [
        { id: 5760, pattern: 'bracket', name: '\'Awn al-Ma\'bud', ar: 'عون المعبود', author: 'al-\'Azimabadi (d. 1329 H) med Ibn al-Qayyims hashiya', pages: 4665, num: 'hadith' },
        { id: 14601, start: 83, pattern: 'dash', name: 'Badhl al-Majhud', ar: 'بذل المجهود', author: 'Khalil Ahmad as-Saharanfuri (d. 1346 H)', pages: 8721, num: 'hadith' },
        { id: 1442, name: 'Ma\'alim as-Sunan', ar: 'معالم السنن', author: 'al-Khattabi (d. 388 H)', pages: 1377, locate: false }
    ],
    tirmidhi: [
        { id: 21662, pattern: 'bracket', name: 'Tuhfat al-Ahwadhi', ar: 'تحفة الأحوذي', author: 'al-Mubarakfuri (d. 1353 H)', pages: 4874, num: 'hadith' }
    ],
    nasai: [
        { id: 522, pattern: 'bracket', name: 'Hashiyat as-Sindi', ar: 'حاشية السندي على النسائي', author: 'as-Sindi (d. 1138 H)', pages: 2103, num: 'hadith' }
    ],
    ibnmajah: [
        { id: 9810, start: 1, pattern: 'dash', name: 'Hashiyat as-Sindi', ar: 'حاشية السندي على ابن ماجه', author: 'as-Sindi (d. 1138 H)', pages: 5204, num: 'hadith' },
        { id: 791, pattern: 'bracket', name: 'Misbah az-Zujaja (as-Suyuti m.fl.)', ar: 'شرح سنن ابن ماجه للسيوطي', author: 'as-Suyuti (d. 911 H) m.fl.', pages: 322, num: 'hadith' }
    ],
    malik: [
        { id: 551, name: 'Sharh az-Zurqani', ar: 'شرح الزرقاني على الموطأ', author: 'az-Zurqani (d. 1122 H)', pages: 4163, locate: false },
        { id: 6684, name: 'al-Muntaqa', ar: 'المنتقى شرح الموطأ', author: 'Abu al-Walid al-Baji (d. 474 H)', pages: 2236, locate: false },
        { id: 236, name: 'at-Tamhid', ar: 'التمهيد', author: 'Ibn \'Abd al-Barr (d. 463 H)', pages: 9093, locate: false },
        { id: 1722, name: 'al-Istidhkar', ar: 'الاستذكار', author: 'Ibn \'Abd al-Barr (d. 463 H)', pages: 4158, locate: false }
    ],
    nawawi: [
        { id: 4268, name: 'Jami\' al-\'Ulum wa\'l-Hikam', ar: 'جامع العلوم والحكم', author: 'Ibn Rajab al-Hanbali (d. 795 H)', pages: 1052, locate: false }
    ]
};

const AR_DIGITS = { '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9' };
const NUM_PATTERNS = {
    dash: /(?:^|\s)(\d{1,5})\s*[-–]\s*(?:حدثنا|حدثني|أخبرنا|أخبرني|وحدثنا|وحدثني|ثنا|نا|عن)/g,
    bracket: /\[(\d{1,5})\]/g,
    fath: /\[الحديث\s*(\d{1,5})|(?:^|\s)(\d{1,5})\s*[-–]\s*(?:حدثنا|حدثني|أخبرنا|أخبرني|وحدثنا)/g
};

function cleanForNumbers(t) {
    return t.replace(/[ً-ْٰ]/g, '').replace(/[٠-٩]/g, d => AR_DIGITS[d]);
}

// Henter én side fra Shamela: titel (fx "ج4 - ص108"), tekst og hadith-numre på siden
const sharhPageCache = new Map();
async function fetchSharhPage(bookId, page, pattern) {
    const key = bookId + ':' + page;
    if (sharhPageCache.has(key)) return sharhPageCache.get(key);
    let html;
    try {
        html = await httpRequest(`${SHAMELA}${bookId}/${page}`);
    } catch (e) {
        await new Promise(r => setTimeout(r, 1200));
        html = await httpRequest(`${SHAMELA}${bookId}/${page}`);
    }
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const title = (doc.querySelector('title') || {}).textContent || '';
    const parts = [...doc.querySelectorAll('div.nass')].map(d => {
        d.querySelectorAll('script, style').forEach(x => x.remove());
        d.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
        d.querySelectorAll('p').forEach(p => p.append('\n'));
        return d.textContent;
    });
    const text = parts.join('\n').replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n\n').trim();
    const nums = [];
    const rx = NUM_PATTERNS[pattern || 'dash'];
    for (const m of cleanForNumbers(text).matchAll(rx)) nums.push(Number(m[1] || m[2]));
    const res = { page, title: title.split(' - ').slice(0, 2).join(' – '), text, nums };
    sharhPageCache.set(key, res);
    return res;
}

// Gemmer kendte (side → numre) pr. bog, så senere opslag bliver hurtigere
function sharhIndex(bookId) { return store.get('sharhIdx:' + bookId, {}); }
function rememberSharhPage(bookId, page, nums) {
    if (!nums.length) return;
    const idx = sharhIndex(bookId);
    const sorted = [...nums].sort((a, b) => a - b);
    idx[page] = sorted[Math.floor(sorted.length / 2)];
    const keys = Object.keys(idx);
    if (keys.length > 400) delete idx[keys[0]];
    store.set('sharhIdx:' + bookId, idx);
}

// Første side med numre fra og med p (op til 40 sider frem – nogle værker har lange kommentarer uden numre)
async function probeSharh(book, p, onStep, limit) {
    for (let i = 0; i < (limit || 40) && p + i <= book.pages; i++) {
        const r = await fetchSharhPage(book.id, p + i, book.pattern);
        if (onStep) onStep();
        if (r.nums.length) {
            rememberSharhPage(book.id, r.page, r.nums);
            const sorted = [...r.nums].sort((x, y) => x - y);
            return { ...r, median: sorted[Math.floor(sorted.length / 2)] };
        }
    }
    return null;
}

// Interpolationssøgning: gæt siden ud fra nummeret, og indsnævr derefter
async function locateSharh(book, n, maxN, onStep) {
    let lo = book.start || 1, hi = book.pages, loVal = 0, hiVal = maxN + 1;
    for (const [p, v] of Object.entries(sharhIndex(book.id))) {
        const page = Number(p);
        if (v < n && page >= lo) { lo = page; loVal = v; }
        if (v > n && page <= hi) { hi = page; hiVal = v; }
    }
    for (let guard = 0; guard < 16 && hi - lo > 3; guard++) {
        const frac = Math.min(0.95, Math.max(0.05, (n - loVal) / Math.max(1, hiVal - loVal)));
        const guess = Math.min(hi - 1, Math.max(lo + 1, Math.round(lo + frac * (hi - lo))));
        const r = await probeSharh(book, guess, onStep);
        if (!r) {
            // Sider uden numre: indledning i starten, register i slutningen
            if (guess < book.pages / 2) lo = Math.min(hi - 1, guess + 40); else hi = guess;
            continue;
        }
        if (r.nums.includes(n)) return r.page;
        if (r.median < n) { lo = r.page; loVal = r.median; } else { hi = guess; hiVal = r.median; }
    }
    // Gå frem side for side fra lo
    let lastWithNums = lo;
    for (let p = lo; p <= Math.min(book.pages, lo + 40); p++) {
        const r = await fetchSharhPage(book.id, p, book.pattern);
        if (onStep) onStep();
        if (r.nums.includes(n)) return p;
        if (r.nums.length) {
            if (Math.min(...r.nums) > n) return lastWithNums;
            lastWithNums = p;
        }
    }
    return lastWithNums;
}

// Saml sharh-teksten: fra siden med hadith N til siden hvor næste hadith begynder
async function collectSharh(book, startPage, n, maxPages) {
    const pages = [];
    for (let p = startPage; p <= book.pages && pages.length < maxPages; p++) {
        const r = await fetchSharhPage(book.id, p, book.pattern);
        pages.push(r);
        if (p > startPage && r.nums.some(x => x > n)) break;
    }
    return pages;
}

// =================================================================
// Visning (en side i hadith-afsnittet)
// =================================================================

function openSharhChooser(book, hadithNo, arabicNo, arText) {
    const works = SHARH_WORKS[book.id] || [];
    if (!works.length) { toast('Der er ingen klassisk sharh på Shamela til denne samling'); return; }
    chooseAction(`Sharh til ${book.name} ${hadithNo}`, works.map(w => ({
        label: `${w.name} · ${w.ar}`, icon: '📜',
        run: () => hPush({ level: 'sharh', book: book.id, work: w.id, hadith: hadithNo, arabic: arabicNo, label: w.name, matn: arText })
    })));
}

async function renderSharh(st, token) {
    const book = HADITH_BOOKS.find(b => b.id === st.book);
    const work = (SHARH_WORKS[st.book] || []).find(w => w.id === st.work);
    const n = work.num === 'arabic' ? Math.floor(Number(st.arabic) || st.hadith) : st.hadith;

    hadithView.appendChild(el('div', { class: 'sharh-head' },
        el('h3', { class: 'hadith-title', dir: 'rtl' }, work.ar),
        el('div', { class: 'note' }, `${work.name} – ${work.author}. Kommentar til ${book.name} nr. ${n}. Kilde: al-Maktaba ash-Shamila.`)));

    const status = el('div', { class: 'status' });
    hadithView.appendChild(status);

    let startPage = 1;
    if (work.locate !== false) {
        let steps = 0;
        const step = () => {
            steps++;
            if (token === hRenderToken) { status.innerHTML = ''; status.appendChild(spinnerLine(`Finder hadith ${n} i ${work.name}… (${steps} sider gennemset)`)); }
        };
        step();
        const maxN = work.num === 'arabic' ? 3100 : book.total;
        startPage = await locateSharh(work, n, maxN, step);
    }
    if (token !== hRenderToken) return;
    status.innerHTML = '';
    status.appendChild(spinnerLine('Henter teksten…'));
    const pages = await collectSharh(work, startPage, n, work.locate === false ? 1 : 8);
    if (token !== hRenderToken) return;
    status.innerHTML = '';
    if (work.locate === false) {
        status.appendChild(el('p', { class: 'note' }, 'Dette værk har ingen hadith-numre, så det åbnes ved begyndelsen. Brug "Næste side" eller "Åbn på Shamela" for at bladre.'));
    } else if (!pages.some(p => p.nums.includes(n))) {
        status.appendChild(el('p', { class: 'note' }, `Hadith nr. ${n} blev ikke fundet præcist – her er det nærmeste sted. Nummereringen kan variere mellem udgaverne.`));
    }

    const textBox = el('div', { class: 'sharh-text', dir: 'rtl', lang: 'ar' });
    let lastPage = startPage;
    const addPage = r => {
        lastPage = r.page;
        textBox.appendChild(el('div', { class: 'sharh-page-label' }, r.title));
        // Markér stedet hvor hadithen begynder
        textBox.appendChild(el('div', { class: 'sharh-page' + (r.nums.includes(n) ? ' has-hadith' : '') }, r.text));
    };
    pages.forEach(addPage);
    hadithView.appendChild(textBox);

    const fullText = () => [...textBox.querySelectorAll('.sharh-page')].map(d => d.textContent).join('\n\n');
    const mtBox = el('div', { class: 'item-mt', hidden: true });
    const trBtn = el('button', { type: 'button', class: 'btn btn-small btn-gold' }, `Oversæt til ${(LANG_NAME[settings.targetLang] || 'dansk').toLowerCase()}`);
    trBtn.addEventListener('click', () => translateInto(mtBox, fullText(), 'ar', trBtn));
    const moreBtn = el('button', { type: 'button', class: 'btn btn-small btn-ghost' }, 'Næste side ›');
    moreBtn.addEventListener('click', async () => {
        if (lastPage >= work.pages) return;
        moreBtn.disabled = true;
        try { addPage(await fetchSharhPage(work.id, lastPage + 1, work.pattern)); }
        catch (e) { toast('Kunne ikke hente siden: ' + e.message); }
        moreBtn.disabled = false;
    });

    hadithView.appendChild(el('div', { class: 'tafsir-actions' },
        trBtn,
        el('button', { type: 'button', class: 'btn btn-small btn-ai', onclick: () => openAiSheet({
            kind: 'sharh', ref: `${book.name} nr. ${n}`, srcLang: 'ar',
            sourceName: `${work.ar} – ${work.name}, ${work.author}`,
            body: (st.matn ? `الحديث:\n${st.matn}\n\nالشرح:\n` : '') + fullText()
        }) }, '✨ Spørg AI'),
        el('button', { type: 'button', class: 'btn btn-small btn-ghost', onclick: () => copyText(`${work.ar} – ${book.name} ${n}\n\n${fullText()}`) }, '⧉ Kopiér'),
        moreBtn,
        el('button', { type: 'button', class: 'btn btn-small btn-ghost', onclick: () => openInBrowser(`${SHAMELA}${work.id}/${startPage}`, `${work.name} – ${n}`) }, 'Åbn på Shamela ↗')));
    hadithView.appendChild(mtBox);
}
