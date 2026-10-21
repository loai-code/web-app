'use strict';

// =================================================================
// Noter: kategorier i ubegrænset dybde med gemte vers, hadith og tekst.
// Data gemmes lokalt på telefonen (localStorage) og kan eksporteres.
// =================================================================

const NOTES_KEY = 'notes';
const notes = Object.assign({ version: 1, cats: [] }, store.get(NOTES_KEY, {}));
let notesCurrent = null;   // id på åben kategori (null = oversigt)
const notesExpanded = new Set(store.get('notesExpanded', []));

function saveNotes() { store.set(NOTES_KEY, notes); if (typeof scheduleMirror === 'function') scheduleMirror(); }
function newId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

function getCat(id) { return notes.cats.find(c => c.id === id) || null; }
function childCats(parentId) { return notes.cats.filter(c => (c.parent || null) === (parentId || null)); }
function catPath(id) {
    const path = [];
    let c = getCat(id);
    while (c) { path.unshift(c); c = getCat(c.parent); }
    return path;
}
function descendantIds(id) {
    const out = [];
    const walk = pid => childCats(pid).forEach(c => { out.push(c.id); walk(c.id); });
    walk(id);
    return out;
}
function totalItems(id) {
    return [id, ...descendantIds(id)].reduce((n, cid) => n + (getCat(cid).items || []).length, 0);
}

function createCat(name, parent) {
    const cat = { id: newId(), name, parent: parent || null, note: '', items: [], created: Date.now() };
    notes.cats.push(cat);
    saveNotes();
    return cat;
}

function verseRefText(item) {
    const name = SURAH_NAMES_EN[item.surah].replace(/\s*\(.*\)$/, '');
    const range = item.from === item.to ? `${item.from}` : `${item.from}–${item.to}`;
    return `${name} ${item.surah}:${range}`;
}

function versesOf(item) {
    const out = [];
    for (let a = item.from; a <= item.to; a++) {
        const v = getVerse(item.surah, a);
        if (v) out.push(v);
    }
    return out;
}

// ---------- Visning ----------

const notesView = $('notesView');
const notesCrumbs = $('notesCrumbs');

function renderNotes() {
    if (notesCurrent && !getCat(notesCurrent)) notesCurrent = null;
    renderCrumbs();
    notesView.innerHTML = '';
    const q = normText($('notesSearch').value.trim());
    if (q) { renderNotesSearch(q); return; }
    if (!notesCurrent) renderNotesHome();
    else renderCategory(getCat(notesCurrent));
}

function renderCrumbs() {
    notesCrumbs.innerHTML = '';
    notesCrumbs.appendChild(el('button', { type: 'button', class: 'crumb', onclick: () => openCat(null) }, '❖ Noter'));
    if (notesCurrent) {
        for (const c of catPath(notesCurrent)) {
            notesCrumbs.appendChild(el('span', { class: 'crumb-sep' }, '›'));
            notesCrumbs.appendChild(el('button', { type: 'button', class: 'crumb', onclick: () => openCat(c.id) }, c.name));
        }
    }
}

function openCat(id) {
    notesCurrent = id;
    renderNotes();
    window.scrollTo(0, 0);
}

function renderNotesHome() {
    notesView.appendChild(el('h2', { class: 'section-title' }, 'Mine kategorier'));
    if (!notes.cats.length) {
        notesView.appendChild(el('div', { class: 'empty' },
            el('div', { class: 'empty-orn' }, '❖'),
            el('p', {}, 'Her samler du dine vers, hadith og noter i dine egne kategorier – med så mange underkategorier du vil.'),
            el('p', { class: 'note' }, 'Tip: Tryk "☆ Gem vers i noter" på memoreringssiden for at gemme det vers, du øver.')));
    } else {
        notesView.appendChild(renderTree(null, 0));
    }
    if (notes.cats.length) {
        notesView.appendChild(el('button', { type: 'button', class: 'btn btn-gold btn-block mt', onclick: () => openQuizSetup(null) }, '🧠 Test mig i mine noter'));
    }
    notesView.appendChild(el('button', {
        type: 'button', class: 'btn btn-primary btn-block mt',
        onclick: async () => {
            const name = await askText('Ny kategori', '', 'Opret');
            if (name) { createCat(name, null); renderNotes(); }
        }
    }, '＋ Ny kategori'));
}

function renderTree(parentId, depth) {
    const list = el('div', { class: 'tree' });
    for (const c of childCats(parentId)) {
        const kids = childCats(c.id);
        const open = notesExpanded.has(c.id);
        const row = el('div', { class: 'tree-row', style: `--depth:${depth}` },
            el('button', {
                type: 'button', class: 'tree-toggle' + (kids.length ? '' : ' empty'), 'aria-label': open ? 'Fold sammen' : 'Fold ud',
                onclick: () => {
                    if (!kids.length) return;
                    open ? notesExpanded.delete(c.id) : notesExpanded.add(c.id);
                    store.set('notesExpanded', [...notesExpanded]);
                    renderNotes();
                }
            }, kids.length ? (open ? '▾' : '▸') : '•'),
            el('button', { type: 'button', class: 'tree-name', onclick: () => openCat(c.id) },
                el('span', {}, c.name),
                el('span', { class: 'count' }, String(totalItems(c.id)))));
        list.appendChild(row);
        if (open && kids.length) list.appendChild(renderTree(c.id, depth + 1));
    }
    return list;
}

let noteSaveTimer = null;

function renderCategory(cat) {
    // Titel
    notesView.appendChild(el('div', { class: 'cat-head' },
        el('h2', { class: 'cat-title' }, cat.name),
        el('button', { type: 'button', class: 'icon-btn small ghost', 'aria-label': 'Omdøb', onclick: () => renameCat(cat) }, '✎')));

    // Fri tekst (som en Notion-side)
    const ta = el('textarea', { class: 'cat-note', rows: '3', placeholder: 'Skriv dine noter til denne kategori…' });
    ta.value = cat.note || '';
    const autoGrow = () => { ta.style.height = 'auto'; ta.style.height = Math.max(70, ta.scrollHeight) + 'px'; };
    ta.addEventListener('input', () => {
        autoGrow();
        clearTimeout(noteSaveTimer);
        noteSaveTimer = setTimeout(() => { cat.note = ta.value; saveNotes(); }, 400);
    });
    ta.addEventListener('blur', () => { cat.note = ta.value; saveNotes(); });
    notesView.appendChild(ta);
    requestAnimationFrame(autoGrow);

    // Underkategorier
    const kids = childCats(cat.id);
    notesView.appendChild(el('div', { class: 'sub-head' },
        el('h3', {}, 'Underkategorier'),
        el('button', { type: 'button', class: 'chip-btn small', onclick: () => addSubcat(cat) }, '＋ Ny')));
    if (kids.length) {
        const grid = el('div', { class: 'subcats' });
        for (const k of kids) {
            grid.appendChild(el('button', { type: 'button', class: 'subcat', onclick: () => openCat(k.id) },
                el('span', { class: 'subcat-icon' }, '❖'),
                el('span', { class: 'subcat-name' }, k.name),
                el('span', { class: 'count' }, String(totalItems(k.id)))));
        }
        notesView.appendChild(grid);
    } else {
        notesView.appendChild(el('p', { class: 'note' }, 'Ingen underkategorier endnu.'));
    }

    // Indhold
    const items = cat.items || [];
    const verseCount = [cat.id, ...descendantIds(cat.id)]
        .flatMap(id => getCat(id).items || []).filter(i => i.type === 'verse').length;
    notesView.appendChild(el('div', { class: 'sub-head' }, el('h3', {}, `Gemt indhold (${items.length})`)));

    const actions = el('div', { class: 'tafsir-actions' },
        el('button', { type: 'button', class: 'btn btn-small btn-primary', onclick: () => toggleAddVerseForm(cat) }, '＋ Tilføj vers'),
        el('button', { type: 'button', class: 'btn btn-small btn-ghost', onclick: () => addTextNote(cat) }, '＋ Tekstnote'),
        verseCount ? el('button', { type: 'button', class: 'btn btn-small btn-gold', onclick: () => practiceCat(cat) }, `▶ Øv vers (${verseCount})`) : null,
        el('button', { type: 'button', class: 'btn btn-small btn-ai', onclick: () => openQuizSetup(cat.id) }, '🧠 Test mig'));
    notesView.appendChild(actions);

    const form = buildAddVerseForm(cat);
    notesView.appendChild(form);

    if (!items.length) {
        notesView.appendChild(el('p', { class: 'note' }, 'Intet gemt her endnu.'));
    }
    items.forEach((item, idx) => notesView.appendChild(renderItem(cat, item, idx)));
}

function renderItem(cat, item, idx) {
    const card = el('article', { class: 'note-item' });
    const menuBtn = el('button', { type: 'button', class: 'icon-btn small ghost', 'aria-label': 'Valg', onclick: () => itemMenu(cat, item, idx) }, '⋯');

    if (item.type === 'verse') {
        const verses = versesOf(item);
        card.appendChild(el('div', { class: 'item-head' },
            el('span', { class: 'item-badge' }, 'Vers'),
            el('b', { class: 'item-ref' }, verseRefText(item)),
            menuBtn));
        const ar = el('div', { class: 'item-arabic', dir: 'rtl', lang: 'ar' });
        verses.forEach(v => {
            ar.appendChild(document.createTextNode(v.arabic + ' '));
            ar.appendChild(el('span', { class: 'ayah-num' }, toArabicDigits(v.ayah)));
            ar.appendChild(document.createTextNode(' '));
        });
        card.appendChild(ar);
        const en = verses.map(v => (verses.length > 1 ? `(${v.ayah}) ` : '') + v.english).join(' ');
        card.appendChild(el('div', { class: 'item-trans' }, en));
        const mtBox = el('div', { class: 'item-mt', hidden: true });
        card.appendChild(mtBox);
        const trBtn = el('button', { type: 'button', class: 'btn btn-small btn-ghost' }, 'Oversæt');
        trBtn.addEventListener('click', () => translateInto(mtBox, en, 'en', trBtn));
        card.appendChild(el('div', { class: 'item-actions' },
            trBtn,
            el('button', { type: 'button', class: 'btn btn-small btn-ghost', onclick: () => openVerseInMemorize(item) }, 'Åbn i memorering')));
    } else if (item.type === 'hadith') {
        card.appendChild(el('div', { class: 'item-head' },
            el('span', { class: 'item-badge hadith' }, 'Hadith'),
            el('b', { class: 'item-ref' }, item.title || item.source || 'Hadith'),
            menuBtn));
        if (item.arabic) card.appendChild(el('div', { class: 'item-arabic small', dir: 'rtl', lang: 'ar' }, item.arabic));
        if (item.translation) card.appendChild(el('div', { class: 'item-trans' }, item.translation));
        const meta = [item.source, item.grade].filter(Boolean).join(' · ');
        if (meta) card.appendChild(el('div', { class: 'note' }, meta));
        const actions = el('div', { class: 'item-actions' }, listenButton(() => savedHadithParts(item)));
        if (!item.translation && item.arabic) {
            const mtBox = el('div', { class: 'item-mt', hidden: true });
            card.appendChild(mtBox);
            const trBtn = el('button', { type: 'button', class: 'btn btn-small btn-ghost' }, 'Oversæt');
            trBtn.addEventListener('click', () => translateInto(mtBox, item.arabic, 'ar', trBtn));
            actions.appendChild(trBtn);
        }
        card.appendChild(actions);
    } else {
        card.appendChild(el('div', { class: 'item-head' },
            el('span', { class: 'item-badge text' }, 'Note'),
            el('span', { class: 'item-ref' }, ''),
            menuBtn));
        card.appendChild(el('div', { class: 'item-text' }, item.text));
    }

    if (item.comment) card.appendChild(el('div', { class: 'item-comment' }, item.comment));
    return card;
}

// ---------- Søgning ----------

function itemSearchText(item) {
    if (item.type === 'verse') {
        const vs = versesOf(item);
        return [verseRefText(item), vs.map(v => v.arabic).join(' '), vs.map(v => v.english).join(' '), item.comment].join(' ');
    }
    if (item.type === 'hadith') return [item.title, item.arabic, item.translation, item.source, item.grade, item.comment].join(' ');
    return [item.text, item.comment].join(' ');
}

function catPathText(id) { return catPath(id).map(c => c.name).join(' › '); }

function renderNotesSearch(q) {
    const catHits = notes.cats.filter(c => matchesQuery(normText(c.name + ' ' + (c.note || '')), q));
    const itemHits = [];
    for (const c of notes.cats) {
        (c.items || []).forEach((it, idx) => {
            if (matchesQuery(normText(itemSearchText(it)), q)) itemHits.push({ c, it, idx });
        });
    }
    notesView.appendChild(el('p', { class: 'note' }, `${catHits.length} kategori(er) og ${itemHits.length} gemt(e) element(er) matcher.`));
    if (catHits.length) {
        notesView.appendChild(el('h3', { class: 'list-head' }, 'Kategorier'));
        const list = el('div', { class: 'list' });
        catHits.forEach(c => list.appendChild(el('button', { type: 'button', class: 'list-row', onclick: () => { clearNotesSearch(); openCat(c.id); } },
            el('span', { class: 'list-main' },
                el('span', { class: 'list-title' }, c.name),
                el('span', { class: 'list-sub' }, catPathText(c.id))),
            el('span', { class: 'chev' }, '›'))));
        notesView.appendChild(list);
    }
    if (itemHits.length) {
        notesView.appendChild(el('h3', { class: 'list-head' }, 'Indhold'));
        itemHits.slice(0, 100).forEach(({ c, it, idx }) => {
            notesView.appendChild(el('button', { type: 'button', class: 'crumb result-path', onclick: () => { clearNotesSearch(); openCat(c.id); } }, '❖ ' + catPathText(c.id) + ' ›'));
            notesView.appendChild(renderItem(c, it, idx));
        });
        if (itemHits.length > 100) notesView.appendChild(el('p', { class: 'note' }, 'Viser de første 100 – gør søgningen mere præcis.'));
    }
    if (!catHits.length && !itemHits.length) notesView.appendChild(el('p', { class: 'note' }, 'Ingen resultater.'));
}

function clearNotesSearch() { $('notesSearch').value = ''; }

let notesSearchTimer = null;
$('notesSearch').addEventListener('input', () => {
    clearTimeout(notesSearchTimer);
    notesSearchTimer = setTimeout(renderNotes, 200);
});

// ---------- Handlinger ----------

async function renameCat(cat) {
    const name = await askText('Omdøb kategori', cat.name, 'Gem');
    if (name) { cat.name = name; saveNotes(); renderNotes(); }
}

async function addSubcat(cat) {
    const name = await askText(`Ny underkategori i "${cat.name}"`, '', 'Opret');
    if (name) { createCat(name, cat.id); renderNotes(); }
}

async function deleteCat(cat) {
    const n = totalItems(cat.id);
    const subs = descendantIds(cat.id).length;
    const ok = await askConfirm('Slet kategori?',
        `"${cat.name}" slettes${subs ? ` sammen med ${subs} underkategori(er)` : ''}${n ? ` og ${n} gemt(e) element(er)` : ''}. Det kan ikke fortrydes.`,
        'Slet', true);
    if (!ok) return;
    const ids = new Set([cat.id, ...descendantIds(cat.id)]);
    notes.cats = notes.cats.filter(c => !ids.has(c.id));
    saveNotes();
    notesCurrent = cat.parent || null;
    renderNotes();
}

function moveCat(cat) {
    const banned = new Set([cat.id, ...descendantIds(cat.id)]);
    const options = [{ label: 'Øverste niveau', icon: '⌂', run: () => { cat.parent = null; saveNotes(); renderNotes(); } }];
    const walk = (pid, depth) => childCats(pid).forEach(c => {
        if (banned.has(c.id)) return;
        options.push({ label: '  '.repeat(depth) + c.name, icon: '❖', run: () => { cat.parent = c.id; saveNotes(); renderNotes(); } });
        walk(c.id, depth + 1);
    });
    walk(null, 0);
    chooseAction(`Flyt "${cat.name}" til…`, options);
}

function moveCatOrder(cat, dir) {
    const siblings = childCats(cat.parent);
    const i = siblings.indexOf(cat);
    const j = i + dir;
    if (j < 0 || j >= siblings.length) return;
    const a = notes.cats.indexOf(siblings[i]);
    const b = notes.cats.indexOf(siblings[j]);
    [notes.cats[a], notes.cats[b]] = [notes.cats[b], notes.cats[a]];
    saveNotes();
    renderNotes();
}

function itemMenu(cat, item, idx) {
    const items = cat.items;
    chooseAction('Gemt element', [
        { label: item.comment ? 'Redigér kommentar' : 'Tilføj kommentar', icon: '✎', run: async () => {
            const v = await askLongText('Kommentar', '', item.comment || '', 'Gem');
            if (v !== null) { item.comment = v.trim(); saveNotes(); renderNotes(); }
        } },
        item.type === 'text' ? { label: 'Redigér note', icon: '✎', run: async () => {
            const v = await askLongText('Redigér note', '', item.text, 'Gem');
            if (v !== null && v.trim()) { item.text = v.trim(); saveNotes(); renderNotes(); }
        } } : null,
        { label: 'Kopiér tekst', icon: '⧉', run: () => copyText(itemPlainText(item)) },
        idx > 0 ? { label: 'Flyt op', icon: '↑', run: () => { [items[idx - 1], items[idx]] = [items[idx], items[idx - 1]]; saveNotes(); renderNotes(); } } : null,
        idx < items.length - 1 ? { label: 'Flyt ned', icon: '↓', run: () => { [items[idx + 1], items[idx]] = [items[idx], items[idx + 1]]; saveNotes(); renderNotes(); } } : null,
        { label: 'Flyt til anden kategori', icon: '❖', run: () => moveItem(cat, idx) },
        { label: 'Slet', icon: '🗑', danger: true, run: async () => {
            if (await askConfirm('Slet element?', 'Elementet fjernes fra kategorien.', 'Slet', true)) {
                items.splice(idx, 1); saveNotes(); renderNotes();
            }
        } }
    ].filter(Boolean));
}

function itemPlainText(item) {
    if (item.type === 'verse') {
        const vs = versesOf(item);
        return `${verseRefText(item)}\n${vs.map(v => v.arabic).join(' ')}\n${vs.map(v => v.english).join(' ')}`
            + (item.comment ? `\n\n${item.comment}` : '');
    }
    if (item.type === 'hadith') {
        return [item.title, item.arabic, item.translation, [item.source, item.grade].filter(Boolean).join(' · '), item.comment]
            .filter(Boolean).join('\n\n');
    }
    return item.text;
}

function moveItem(cat, idx) {
    const options = [];
    const walk = (pid, depth) => childCats(pid).forEach(c => {
        if (c.id !== cat.id) {
            options.push({ label: '  '.repeat(depth) + c.name, icon: '❖', run: () => {
                const [it] = cat.items.splice(idx, 1);
                c.items = c.items || [];
                c.items.push(it);
                saveNotes();
                renderNotes();
                toast(`Flyttet til "${c.name}"`);
            } });
        }
        walk(c.id, depth + 1);
    });
    walk(null, 0);
    if (!options.length) { toast('Opret først en anden kategori'); return; }
    chooseAction('Flyt til…', options);
}

async function addTextNote(cat) {
    const text = await askLongText('Ny tekstnote', '', '', 'Tilføj');
    if (text && text.trim()) {
        cat.items.push({ id: newId(), type: 'text', text: text.trim(), added: Date.now() });
        saveNotes();
        renderNotes();
    }
}

function buildAddVerseForm(cat) {
    const sel = el('select', {});
    for (let s = 1; s <= 114; s++) sel.appendChild(el('option', { value: s }, `${s}. ${SURAH_NAMES_EN[s]} · ${SURAH_NAMES_AR[s - 1]}`));
    const from = el('input', { type: 'number', min: '1', value: '1', inputmode: 'numeric' });
    const to = el('input', { type: 'number', min: '1', value: '1', inputmode: 'numeric' });
    sel.addEventListener('change', () => { from.value = 1; to.value = 1; });
    const form = el('div', { class: 'add-verse-form', id: 'addVerseForm', hidden: true },
        el('div', { class: 'field' }, el('label', {}, 'Sura'), sel),
        el('div', { class: 'row' },
            el('div', { class: 'field' }, el('label', {}, 'Fra vers'), from),
            el('div', { class: 'field' }, el('label', {}, 'Til vers'), to)),
        el('button', {
            type: 'button', class: 'btn btn-primary btn-block mt', onclick: () => {
                const surah = Number(sel.value);
                const max = AYAH_COUNT[surah - 1];
                let a = Math.min(Math.max(1, parseInt(from.value, 10) || 1), max);
                let b = Math.min(Math.max(1, parseInt(to.value, 10) || a), max);
                if (a > b) [a, b] = [b, a];
                cat.items.push({ id: newId(), type: 'verse', surah, from: a, to: b, comment: '', added: Date.now() });
                saveNotes();
                renderNotes();
                toast('Vers tilføjet');
            }
        }, 'Tilføj til kategorien'));
    return form;
}

function toggleAddVerseForm() {
    const f = $('addVerseForm');
    if (f) f.hidden = !f.hidden;
}

function practiceCat(cat) {
    const list = [];
    for (const id of [cat.id, ...descendantIds(cat.id)]) {
        for (const it of getCat(id).items || []) {
            if (it.type === 'verse') for (let a = it.from; a <= it.to; a++) list.push({ surah: it.surah, ayah: a });
        }
    }
    showPage('memorize');
    startSessionWithVerses(list, shuffleCheck.checked);
    toast(`Øver ${list.length} vers fra "${cat.name}"`);
}

function openVerseInMemorize(item) {
    surahSelect.value = item.surah;
    clampRange();
    startVerse.value = item.from;
    endVerse.value = item.to;
    showPage('memorize');
    startSession();
}

// ---------- Menu øverst (⋯) ----------

$('notesMenuBtn').addEventListener('click', () => {
    const cat = notesCurrent ? getCat(notesCurrent) : null;
    const actions = [];
    if (cat) {
        actions.push(
            { label: 'Omdøb kategori', icon: '✎', run: () => renameCat(cat) },
            { label: 'Ny underkategori', icon: '＋', run: () => addSubcat(cat) },
            { label: 'Flyt kategori', icon: '❖', run: () => moveCat(cat) },
            { label: 'Flyt op blandt søskende', icon: '↑', run: () => moveCatOrder(cat, -1) },
            { label: 'Flyt ned blandt søskende', icon: '↓', run: () => moveCatOrder(cat, 1) },
            { label: 'Slet kategori', icon: '🗑', danger: true, run: () => deleteCat(cat) });
    }
    actions.push(
        { label: 'Gem backup på telefonen', icon: '📱', run: exportNotesPhone },
        { label: 'Gem backup som fil – vælg selv sted (fx Google Drive)', icon: '💾', run: exportNotesFile },
        { label: 'Gendan backup – find filen på telefonen', icon: '📂', run: importNotesFile },
        { label: 'Del backup (e-mail, besked …)', icon: '⤴', run: exportNotes },
        { label: 'Indsæt backup-tekst', icon: '⤵', run: importNotes });
    const last = store.get('lastBackup', null);
    chooseAction(cat ? cat.name : 'Noter' + (last ? ` · seneste backupfil ${new Date(last).toLocaleDateString('da-DK')}` : ''), actions);
});

// =================================================================
// Backup: noter + indstillinger samlet i én JSON-fil
// =================================================================

function buildBackup() {
    return JSON.stringify({
        app: 'koran-memorering',
        version: 2,
        exported: new Date().toISOString(),
        notes,
        notesExpanded: [...notesExpanded],
        settings,
        dictHistory: store.get('dictHistory', []),
        srs: store.get('srs', {}),
        srsDays: store.get('srsDays', [])
    }, null, 1);
}

function parseBackup(text) {
    const data = JSON.parse(text);
    const imported = data.notes || data;
    if (!imported || !Array.isArray(imported.cats)) throw new Error('filen indeholder ingen noter');
    return data;
}

function applyBackup(data) {
    const imported = data.notes || data;
    notes.cats = imported.cats;
    saveNotes();
    if (Array.isArray(data.notesExpanded)) store.set('notesExpanded', data.notesExpanded);
    if (data.settings && typeof data.settings === 'object') {
        Object.assign(settings, data.settings);
        saveSettings();
    }
    if (Array.isArray(data.dictHistory)) store.set('dictHistory', data.dictHistory);
    if (data.srs && typeof data.srs === 'object') {
        store.set('srs', data.srs);
        Object.keys(srs).forEach(k => delete srs[k]);
        Object.assign(srs, data.srs);
    }
    if (Array.isArray(data.srsDays)) { store.set('srsDays', data.srsDays); data.srsDays.forEach(d => srsDays.add(d)); }
    notesCurrent = null;
    renderNotes();
}

function countItems(cats) {
    return cats.reduce((n, c) => n + (c.items || []).length, 0);
}

async function confirmAndApply(data, source) {
    const cats = (data.notes || data).cats;
    const when = data.exported ? ` fra ${new Date(data.exported).toLocaleString('da-DK', { dateStyle: 'medium', timeStyle: 'short' })}` : '';
    const ok = await askConfirm('Gendan backup?',
        `${source}${when} indeholder ${cats.length} kategorier og ${countItems(cats)} gemte elementer. Dine nuværende noter erstattes.`,
        'Gendan', true);
    if (!ok) return;
    applyBackup(data);
    toast('Backup gendannet ✓');
}

// Gem direkte på telefonen i mappen Download/Koran-memorering (ingen filvælger)
function backupFileName() {
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    return `koran-noter-backup-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}.json`;
}
function exportNotesPhone() {
    if (window.AndroidBridge && AndroidBridge.saveToPhone) AndroidBridge.saveToPhone(backupFileName(), buildBackup());
    else exportNotesFile();
}
window.__phoneSaved = function (ok, info) {
    if (!ok) { toast(info); return; }
    store.set('lastBackup', Date.now());
    showInfo('Backup gemt på telefonen ✓',
        `Filen ligger her:
${info}

Find den i appen "Filer" under Downloads. På en ny telefon: kopiér filen over (fx med USB-kabel eller Google Drive) og vælg "Gendan backup – find filen på telefonen".`);
};

// Gem som fil via Androids filvælger (Google Drive, Downloads, USB …)
function exportNotesFile() {
    const name = backupFileName();
    if (window.AndroidBridge && AndroidBridge.saveFile) {
        AndroidBridge.saveFile(name, buildBackup());
    } else {
        // iPhone/web-app: del-menuen ("Gem i Filer"), ellers almindelig download
        const file = new File([buildBackup()], name, { type: 'application/json' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            navigator.share({ files: [file], title: 'Backup af noter' })
                .then(() => window.__fileSaved(true, ''), e => window.__fileSaved(false, e && e.name === 'AbortError' ? 'cancel' : 'Kunne ikke gemme backup'));
            return;
        }
        const a = el('a', { href: URL.createObjectURL(file), download: name });
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.__fileSaved(true, '');
    }
}
window.__fileSaved = function (ok, msg) {
    if (ok) {
        store.set('lastBackup', Date.now());
        toast('Backup gemt ✓');
    } else if (msg !== 'cancel') {
        toast(msg);
    }
};

function importNotesFile() {
    if (window.AndroidBridge && AndroidBridge.openFile) {
        AndroidBridge.openFile();
    } else {
        const input = el('input', { type: 'file', accept: '.json,application/json' });
        input.addEventListener('change', async () => {
            const f = input.files[0];
            if (f) window.__fileOpened(true, await f.text());
        });
        input.click();
    }
}
window.__fileOpened = function (ok, text) {
    if (!ok) { if (text !== 'cancel') toast(text); return; }
    try {
        confirmAndApply(parseBackup(text), 'Backupfilen');
    } catch (e) {
        toast('Ugyldig backupfil: ' + e.message);
    }
};

// Del som tekst (e-mail, besked osv.)
function exportNotes() {
    shareText(buildBackup(), 'Backup af noter');
    toast('Backup kopieret – gem den fx i en e-mail');
}

async function importNotes() {
    const text = await askLongText('Indsæt backup-tekst', 'Indsæt teksten fra en tidligere delt backup.', '', 'Fortsæt');
    if (!text) return;
    try {
        confirmAndApply(parseBackup(text), 'Backuppen');
    } catch (e) {
        toast('Ugyldig backup: ' + e.message);
    }
}

// Spejlfil til Androids automatiske Google-backup (opdateres ved hver ændring)
let mirrorTimer = null;
function scheduleMirror() {
    if (!(window.AndroidBridge && AndroidBridge.writeMirror)) return;
    clearTimeout(mirrorTimer);
    mirrorTimer = setTimeout(() => AndroidBridge.writeMirror(buildBackup()), 1500);
}

// Ny telefon: er noterne tomme, men findes der en automatisk backup, så tilbyd at gendanne den
(function offerMirrorRestore() {
    if (notes.cats.length || !(window.AndroidBridge && AndroidBridge.readMirror)) return;
    let text = '';
    try { text = AndroidBridge.readMirror(); } catch (e) { text = ''; }
    if (!text) return;
    try {
        const data = parseBackup(text);
        if (!(data.notes || data).cats.length) return;
        setTimeout(() => confirmAndApply(data, 'Den automatiske backup'), 800);
    } catch (e) { /* ignorer ødelagt spejlfil */ }
})();

// =================================================================
// "Gem i noter"-arket (bruges fra memorering og hadith)
// =================================================================

let savePayload = null;
let saveSelected = store.get('lastSaveCat', null);

function openSaveSheet(payload) {
    savePayload = payload;
    if (saveSelected && !getCat(saveSelected)) saveSelected = null;
    const prev = $('savePreview');
    prev.innerHTML = '';
    if (payload.type === 'verse') {
        $('saveSheetTitle').textContent = '☆ Gem vers i noter';
        prev.appendChild(el('b', {}, verseRefText(payload)));
        prev.appendChild(el('div', { class: 'item-arabic small', dir: 'rtl' }, versesOf(payload).map(v => v.arabic).join(' ')));
    } else {
        $('saveSheetTitle').textContent = '☆ Gem hadith i noter';
        prev.appendChild(el('b', {}, payload.title || 'Hadith'));
        prev.appendChild(el('div', { class: 'note' }, payload.source || ''));
    }
    $('saveComment').value = '';
    renderCatPicker();
    openSheet('saveSheet');
}

function renderCatPicker() {
    const box = $('catPicker');
    box.innerHTML = '';
    if (!notes.cats.length) {
        box.appendChild(el('p', { class: 'note' }, 'Du har ingen kategorier endnu – opret en nedenfor.'));
    }
    const walk = (pid, depth) => childCats(pid).forEach(c => {
        box.appendChild(el('button', {
            type: 'button',
            class: 'cat-option' + (c.id === saveSelected ? ' selected' : ''),
            style: `--depth:${depth}`,
            onclick: () => { saveSelected = c.id; renderCatPicker(); }
        }, el('span', { class: 'radio' }), c.name));
        walk(c.id, depth + 1);
    });
    walk(null, 0);
    $('saveConfirmBtn').disabled = !saveSelected;
    const sel = getCat(saveSelected);
    $('saveNewCatBtn').textContent = sel ? `＋ Ny underkategori i "${sel.name}"` : '＋ Ny kategori';
}

$('saveNewCatBtn').addEventListener('click', async () => {
    const parent = getCat(saveSelected);
    const name = await askText(parent ? `Ny underkategori i "${parent.name}"` : 'Ny kategori', '', 'Opret');
    if (!name) return;
    const cat = createCat(name, parent ? parent.id : null);
    if (parent) { notesExpanded.add(parent.id); store.set('notesExpanded', [...notesExpanded]); }
    saveSelected = cat.id;
    renderCatPicker();
});

$('saveConfirmBtn').addEventListener('click', () => {
    const cat = getCat(saveSelected);
    if (!cat || !savePayload) return;
    const item = Object.assign({ id: newId(), added: Date.now(), comment: $('saveComment').value.trim() }, savePayload);
    cat.items = cat.items || [];
    cat.items.push(item);
    saveNotes();
    store.set('lastSaveCat', cat.id);
    closeSheet('saveSheet');
    toast(`Gemt i "${cat.name}" ✓`);
    if (currentPage === 'notes') renderNotes();
});
$('saveCancelBtn').addEventListener('click', () => closeSheet('saveSheet'));

// Sørg for at den automatiske backup altid findes, også for noter fra før denne version
if (notes.cats.length) scheduleMirror();
