'use strict';

// =================================================================
// Åbenbaringsanledning (asbab an-nuzul) for det viste vers.
// Kilde: al-Wahidi (d. 468 H), "Asbab an-Nuzul" – engelsk oversættelse
// (Royal Aal al-Bayt Institute) via altafsir.com, tafsir nr. 86.
// Ikke alle vers har en kendt anledning.
// =================================================================

const ASBAB_TAFSIR = 86;
let asbabToken = 0;
let asbabText = '';

function resetAsbab() {
    asbabToken++;
    asbabText = '';
    $('asbabBox').innerHTML = '';
    $('asbabBox').hidden = true;
    $('asbabMt').hidden = true;
    $('asbabActions').hidden = true;
    $('asbabLoadBtn').hidden = false;
    $('asbabLoadBtn').disabled = !(currentVerse() && revealed);
}

async function loadAsbab() {
    const q = currentVerse();
    if (!q) return;
    const token = ++asbabToken;
    const box = $('asbabBox');
    $('asbabLoadBtn').hidden = true;
    box.hidden = false;
    box.innerHTML = '';
    box.appendChild(spinnerLine('Henter åbenbaringsanledning…'));
    try {
        const html = await httpRequest(altafsirUrl(ASBAB_TAFSIR, q.surah, q.ayah, 0), { charset: 'windows-1256' });
        if (token !== asbabToken) return;
        const parsed = parseAltafsir(html, 1);
        box.innerHTML = '';
        // Fjern ophavsretsnoten nederst, men vis kilden separat
        const text = parsed && parsed.text
            ? parsed.text.replace(/Asbab Al-Nuzul by Al-Wahidi[\s\S]*$/i, '').replace(/©[\s\S]*$/, '').trim()
            : '';
        if (!text) {
            box.appendChild(el('p', { class: 'note' }, 'al-Wahidi nævner ingen åbenbaringsanledning for dette vers. Mange vers har ingen kendt særskilt anledning.'));
            return;
        }
        asbabText = text;
        box.appendChild(el('div', { class: 'asbab-text' }, text));
        $('asbabActions').hidden = false;
    } catch (err) {
        if (token !== asbabToken) return;
        box.innerHTML = '';
        box.appendChild(el('div', { class: 'status error' }, '⚠ Kunne ikke hente: ' + err.message));
        $('asbabLoadBtn').hidden = false;
    }
}

$('asbabLoadBtn').addEventListener('click', loadAsbab);
$('asbabTranslateBtn').addEventListener('click', () => {
    if (asbabText) translateInto($('asbabMt'), asbabText, 'en', $('asbabTranslateBtn'));
});
$('asbabAiBtn').addEventListener('click', () => {
    const q = currentVerse();
    if (!q || !asbabText) return;
    openAiSheet({
        kind: 'tafsir', ref: `sura ${q.surah} (${SURAH_NAMES_EN[q.surah]}), vers ${q.ayah}`, srcLang: 'en',
        sourceName: 'al-Wahidi, Asbab an-Nuzul (åbenbaringsanledninger, engelsk oversættelse)', body: asbabText, verse: q
    });
});
$('asbabCopyBtn').addEventListener('click', () => {
    const q = currentVerse();
    if (q && asbabText) copyText(`Åbenbaringsanledning – ${SURAH_NAMES_EN[q.surah]} ${q.surah}:${q.ayah} (al-Wahidi)\n\n${asbabText}`);
});
