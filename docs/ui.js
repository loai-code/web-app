'use strict';

// =================================================================
// Fælles UI-hjælpere: elementer, dialoger og valgmenuer
// =================================================================

// el('div', { class: 'x', onclick: fn }, 'tekst', barn, ...)
function el(tag, attrs, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
        if (v === null || v === undefined || v === false) continue;
        if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
        else if (k === 'class') node.className = v;
        else if (k === 'text') node.textContent = v;
        else node.setAttribute(k, v === true ? '' : v);
    }
    for (const c of children.flat()) {
        if (c === null || c === undefined || c === false) continue;
        node.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
    }
    return node;
}

// Normaliserer tekst til søgning: små bogstaver, uden arabiske vokaltegn,
// ens alif/ya/ta marbuta-former, så "الرَّحْمَٰن" findes med "الرحمن"
function normText(s) {
    return (s || '').toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '') // Islām → islam, é → e
        .replace(/[ؐ-ًؚ-ٰٟۖ-ۭـ]/g, '')
        .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
        .replace(/\s+/g, ' ');
}

// Alle ord i søgningen skal forekomme (i vilkårlig rækkefølge)
function matchesQuery(haystackNorm, queryNorm) {
    return queryNorm.split(' ').filter(Boolean).every(t => haystackNorm.includes(t));
}

function spinnerLine(text) {
    return el('div', { class: 'status' }, el('span', { class: 'spinner' }), text);
}

// Lukker det øverste åbne bundark; returnerer true hvis noget blev lukket
const SHEET_PRIORITY = ['dialogSheet', 'actionSheet', 'saveSheet', 'aiSheet', 'settingsSheet'];
function closeTopSheet() {
    for (const id of SHEET_PRIORITY) {
        if (!$(id).hidden) {
            if (id === 'dialogSheet') dialogResolve(null);
            else closeSheet(id);
            return true;
        }
    }
    return false;
}

// ---------- Dialog (tekstfelt / bekræftelse) ----------
let dialogPending = null;

function dialogResolve(value) {
    closeSheet('dialogSheet');
    const p = dialogPending;
    dialogPending = null;
    if (p) p(value);
}

function openDialog({ title, message, input, multiline, value, okText, danger, noCancel }) {
    if (dialogPending) dialogResolve(null);
    $('dialogTitle').textContent = title || '';
    $('dialogMsg').textContent = message || '';
    $('dialogMsg').hidden = !message;
    const inp = $('dialogInput');
    const ta = $('dialogTextarea');
    inp.hidden = !(input && !multiline);
    ta.hidden = !(input && multiline);
    inp.value = ta.value = value || '';
    const ok = $('dialogOk');
    ok.textContent = okText || 'OK';
    ok.className = 'btn ' + (danger ? 'btn-danger' : 'btn-primary');
    $('dialogCancel').hidden = !!noCancel;
    openSheet('dialogSheet');
    if (input) setTimeout(() => (multiline ? ta : inp).focus(), 50);
    return new Promise(resolve => { dialogPending = resolve; });
}

function askText(title, value, okText) {
    return openDialog({ title, input: true, value, okText }).then(v => (v === null ? null : v.trim() || null));
}
function askLongText(title, message, value, okText) {
    return openDialog({ title, message, input: true, multiline: true, value, okText });
}
function showInfo(title, message) {
    return openDialog({ title, message, okText: 'OK', noCancel: true });
}
function askConfirm(title, message, okText, danger) {
    return openDialog({ title, message, okText: okText || 'OK', danger }).then(v => v !== null);
}

$('dialogOk').addEventListener('click', () => {
    const multiline = !$('dialogTextarea').hidden;
    const inputShown = !$('dialogInput').hidden;
    dialogResolve(multiline ? $('dialogTextarea').value : inputShown ? $('dialogInput').value : true);
});
$('dialogCancel').addEventListener('click', () => dialogResolve(null));
$('dialogInput').addEventListener('keydown', e => { if (e.key === 'Enter') $('dialogOk').click(); });

// ---------- Valgmenu ----------
// actions: [{ label, icon, danger, run }]
function chooseAction(title, actions) {
    $('actionTitle').textContent = title;
    const list = $('actionList');
    list.innerHTML = '';
    for (const a of actions) {
        list.appendChild(el('button', {
            type: 'button',
            class: 'action-item' + (a.danger ? ' danger' : ''),
            onclick: () => { closeSheet('actionSheet'); a.run(); }
        }, el('span', { class: 'action-icon' }, a.icon || '•'), a.label));
    }
    list.appendChild(el('button', { type: 'button', class: 'action-item muted', onclick: () => closeSheet('actionSheet') },
        el('span', { class: 'action-icon' }, '✕'), 'Annullér'));
    openSheet('actionSheet');
}

// ---------- Del tekst (Android-del-menu eller kopiér) ----------
function shareText(text, title) {
    if (window.AndroidBridge && AndroidBridge.shareToAi) {
        AndroidBridge.shareToAi('other', text);
    } else if (navigator.share) {
        navigator.share({ title: title || 'Koran-memorering', text }).catch(() => copyText(text));
    } else {
        copyText(text);
    }
}

// ---------- Oversættelse til en boks (bruges af hadith og noter) ----------
async function translateInto(box, text, srcLang, button) {
    const lang = settings.targetLang;
    if (button) button.disabled = true;
    box.hidden = false;
    box.innerHTML = '';
    box.appendChild(spinnerLine('Oversætter…'));
    try {
        const out = await translateText(text, srcLang, lang, (i, n) => {
            if (n > 1) { box.innerHTML = ''; box.appendChild(spinnerLine(`Oversætter… (${i}/${n})`)); }
        });
        box.innerHTML = '';
        box.dir = RTL_LANGS.has(lang) ? 'rtl' : 'ltr';
        box.appendChild(el('div', { class: 'mt-label' }, `Maskinoversat til ${(LANG_NAME[lang] || lang).toLowerCase()}`));
        box.appendChild(el('div', { class: 'mt-text' }, out));
        return out;
    } catch (err) {
        box.innerHTML = '';
        box.appendChild(el('div', { class: 'status error' }, '⚠ Oversættelse mislykkedes: ' + err.message));
        return null;
    } finally {
        if (button) button.disabled = false;
    }
}
