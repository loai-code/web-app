'use strict';

// =================================================================
// Oplæsning af hadith (der findes ingen indspillet lyd til hadith-samlingerne)
//  1) Telefonens egen tekst-til-tale (Android, fx Google-oplæsning med arabisk stemme) – virker også offline
//  2) Mangler telefonen stemmen: Google Oversæt-oplæsning online, læst i bidder á ~180 tegn
// =================================================================

const TTS_RATES = [[0.75, 'langsom'], [1, 'normal'], [1.25, 'hurtig']];
const speaker = { id: 0, btn: null, label: '', audio: null, text: '', lang: 'ar', rate: store.get('ttsRate', 1) };

function speakText(text, lang, btn) {
    text = (text || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (!text) return;
    stopSpeak();
    if (typeof stopAudio === 'function') stopAudio();
    if (typeof stopListen === 'function') stopListen();
    const id = ++speaker.id;
    Object.assign(speaker, { btn, text, lang });
    if (btn) {
        speaker.label = btn.textContent;
        btn.textContent = '⏹ Stop';
        btn.classList.add('speaking');
    }
    if (window.AndroidBridge && AndroidBridge.ttsSpeak) AndroidBridge.ttsSpeak(id, text, lang, speaker.rate);
    else speakWeb(id, text, lang);
}

window.onTtsEvent = function (id, ev) {
    if (id !== speaker.id) return;
    if (ev === 'done') { resetSpeakBtn(); return; }
    if (ev === 'nolang' || ev === 'noengine' || ev === 'error') {
        const name = (LANG_NAME[speaker.lang] || speaker.lang).toLowerCase();
        toast(ev === 'nolang'
            ? `Telefonen har ingen ${name} stemme – bruger Google-oplæsning (kræver internet)`
            : 'Bruger Google-oplæsning (kræver internet)');
        speakOnline(id, speaker.text, speaker.lang);
    }
};

function ttsChunks(text, max) {
    const out = [];
    let cur = '';
    for (const part of text.split(/(?<=[.!?؟،,؛;:])\s+|\s+/)) {
        if ((cur + ' ' + part).trim().length > max && cur) { out.push(cur); cur = part; }
        else cur = (cur + ' ' + part).trim();
        while (cur.length > max) { out.push(cur.slice(0, max)); cur = cur.slice(max); }
    }
    if (cur) out.push(cur);
    return out;
}

function speakOnline(id, text, lang) {
    const chunks = ttsChunks(text, 180);
    const url = q => `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${encodeURIComponent(lang)}&q=${encodeURIComponent(q)}`;
    let i = 0;
    let nextAudio = new Audio(url(chunks[0]));
    const play = () => {
        if (id !== speaker.id) return;
        if (i >= chunks.length) { resetSpeakBtn(); return; }
        const a = nextAudio;
        i++;
        nextAudio = i < chunks.length ? new Audio(url(chunks[i])) : null; // hent næste bid i forvejen
        if (nextAudio) nextAudio.preload = 'auto';
        speaker.audio = a;
        a.playbackRate = speaker.rate;
        a.onended = play;
        a.onerror = () => {
            if (id !== speaker.id) return;
            toast('Oplæsningen kunne ikke hentes – tjek internetforbindelsen');
            resetSpeakBtn();
        };
        a.play().catch(() => a.onerror());
    };
    play();
}

// Web-app/iPhone: browserens egen oplæsning (iPhone har fx en god arabisk stemme), ellers Google online
function webVoice(lang) {
    if (!window.speechSynthesis) return null;
    const voices = speechSynthesis.getVoices();
    const l = lang.toLowerCase();
    return voices.find(v => v.lang.toLowerCase().replace('_', '-').startsWith(l + '-'))
        || voices.find(v => v.lang.toLowerCase() === l) || null;
}
function speakWeb(id, text, lang) {
    const voice = webVoice(lang);
    if (!voice) { speakOnline(id, text, lang); return; }
    speechSynthesis.cancel();
    const chunks = ttsChunks(text, 220); // lange tekster afbrydes ellers på iPhone
    let started = false;
    chunks.forEach((c, i) => {
        const u = new SpeechSynthesisUtterance(c);
        u.voice = voice;
        u.lang = voice.lang;
        u.rate = speaker.rate;
        u.onstart = () => { started = true; };
        if (i === chunks.length - 1) u.onend = () => { if (id === speaker.id) resetSpeakBtn(); };
        u.onerror = e => {
            if (id !== speaker.id || e.error === 'interrupted' || e.error === 'canceled') return;
            speechSynthesis.cancel();
            speakOnline(id, text, lang);
        };
        speechSynthesis.speak(u);
    });
    // Starter stemmen slet ikke (fx manglende stemmedata), så brug Google
    setTimeout(() => {
        if (id === speaker.id && !started && !speechSynthesis.speaking) { speechSynthesis.cancel(); speakOnline(id, text, lang); }
    }, 2500);
}
if (window.speechSynthesis) { speechSynthesis.getVoices(); speechSynthesis.onvoiceschanged = () => speechSynthesis.getVoices(); }

function stopSpeak() {
    speaker.id++;
    if (window.speechSynthesis && !(window.AndroidBridge && AndroidBridge.ttsSpeak)) speechSynthesis.cancel();
    if (window.AndroidBridge && AndroidBridge.ttsStop) AndroidBridge.ttsStop();
    if (speaker.audio) { speaker.audio.pause(); speaker.audio.src = ''; speaker.audio = null; }
    resetSpeakBtn();
}

function resetSpeakBtn() {
    if (speaker.audio) { speaker.audio.pause(); speaker.audio = null; }
    if (speaker.btn) {
        speaker.btn.textContent = speaker.label;
        speaker.btn.classList.remove('speaking');
        speaker.btn = null;
    }
}

/**
 * Lyt-knap til en hadith. parts: [{ label, text, lang }] eller { label, translate: { text, from } }
 * (oversættes til det valgte sprog først). Én del → læses op direkte, ellers vælger man i en liste.
 */
function listenButton(getParts, cls = 'btn btn-small btn-ghost') {
    const btn = el('button', { type: 'button', class: cls + ' listen-btn' }, '🔊 Lyt');
    btn.addEventListener('click', () => {
        if (speaker.btn === btn) { stopSpeak(); return; } // tryk igen = stop
        const parts = getParts().filter(p => p && (p.recorded || p.text || (p.translate && p.translate.text)));
        if (!parts.length) return;
        if (parts.length === 1 && !parts[0].translate) { speakText(parts[0].text, parts[0].lang, btn); return; }
        openListenMenu(btn, parts);
    });
    return btn;
}

function openListenMenu(btn, parts) {
    const rateName = (TTS_RATES.find(r => r[0] === speaker.rate) || TTS_RATES[1])[1];
    chooseAction('🔊 Lyt til', [
        ...parts.map(p => ({ icon: p.icon || '▶', label: p.label, run: () => playPart(btn, p) })),
        {
            icon: '⏱', label: `Hastighed: ${rateName} (tryk for at skifte)`, run: () => {
                const i = TTS_RATES.findIndex(r => r[0] === speaker.rate);
                speaker.rate = TTS_RATES[(i + 1) % TTS_RATES.length][0];
                store.set('ttsRate', speaker.rate);
                setTimeout(() => openListenMenu(btn, parts), 250);
            }
        }
    ]);
}

async function playPart(btn, p) {
    if (p.recorded) { playRecorded(p.recorded, btn, p.fallback); return; }
    if (!p.translate) { speakText(p.text, p.lang, btn); return; }
    const lang = settings.targetLang;
    const old = btn.textContent;
    btn.textContent = 'Oversætter…';
    btn.disabled = true;
    try {
        const text = await translateText(p.translate.text, p.translate.from, lang);
        btn.textContent = old;
        btn.disabled = false;
        speakText(text, lang, btn);
    } catch (e) {
        btn.textContent = old;
        btn.disabled = false;
        toast('Kunne ikke oversætte teksten');
    }
}

// Del-hjælpere, så hadith-, note- og quiz-visningen beskriver det samme
const langLabel = lang => (LANG_NAME[lang] || lang).toLowerCase();
function translatedPart(text, from, what = 'Oversættelse') {
    const lang = settings.targetLang;
    if (!text || lang === from || lang === 'ar') return null;
    return { icon: '🌐', label: `${what} på ${langLabel(lang)} (maskinoversat)`, translate: { text, from } };
}

// Dele til en gemt hadith (noter og quiz). Ældre noter kender ikke oversættelsens sprog → gæt ud fra teksten.
function savedHadithParts(item) {
    const tLang = item.translationLang || (/[æøåÆØÅ]/.test(item.translation || '') ? 'da' : 'en');
    const bukh = /bukh[aā]r[iī]\D{0,3}(\d{1,4})\b/i.exec([item.source, item.title].join(' '));
    return [
        bukh && typeof bukhariRecordedPart === 'function' ? bukhariRecordedPart(Number(bukh[1]), item.arabic) : null,
        item.arabic ? { icon: '📖', label: bukh ? 'Hadith på arabisk (computerstemme)' : 'Hadith på arabisk', text: item.arabic, lang: 'ar' } : null,
        item.translation ? { icon: '🌐', label: `Oversættelse (${langLabel(tLang)})`, text: item.translation, lang: tLang } : null,
        item.translation && tLang !== settings.targetLang ? translatedPart(item.translation, tLang, 'Hadith')
            : !item.translation ? translatedPart(item.arabic, 'ar', 'Hadith') : null
    ];
}

// ---------- Indspillet lyd (menneskelig oplæsning) ----------

/** Afspil en lydfil. getUrl() giver url'en (evt. et løfte); fallback = { text, lang } til computerstemme ved fejl. */
async function playRecorded(getUrl, btn, fallback) {
    stopSpeak();
    if (typeof stopAudio === 'function') stopAudio();
    if (typeof stopListen === 'function') stopListen();
    const id = ++speaker.id;
    speaker.btn = btn;
    if (btn) { speaker.label = btn.textContent; btn.textContent = '⏳ Henter…'; btn.classList.add('speaking'); }
    let url;
    try {
        url = await getUrl();
    } catch (e) {
        if (id !== speaker.id) return;
        resetSpeakBtn();
        if (fallback && fallback.text) {
            toast('Kunne ikke hente oplæsningen – bruger computerstemme');
            speakText(fallback.text, fallback.lang, btn);
        } else toast('Kunne ikke hente oplæsningen: ' + e.message);
        return;
    }
    if (id !== speaker.id) return;
    if (btn) btn.textContent = '⏹ Stop';
    const a = new Audio(url);
    speaker.audio = a;
    a.playbackRate = speaker.rate;
    a.onended = () => { if (id === speaker.id) resetSpeakBtn(); };
    a.onerror = () => {
        if (id !== speaker.id) return;
        resetSpeakBtn();
        toast('Lyden kunne ikke afspilles – tjek internetforbindelsen');
    };
    a.play().catch(() => a.onerror());
}

// Sahih al-Bukhari oplæst hadith for hadith (én mp3 pr. hadith i 7 zip-filer, nummereret som appens Bukhari-numre).
// Appen henter kun den ene hadiths bytes ud af zip'en (se ZipAudioHelper.java) og gemmer den i cachen.
const BUKHARI_AUDIO_RANGES = [[1, 1000], [1001, 2000], [2001, 3000], [3001, 4000], [4001, 5000], [5001, 6000], [6001, 7563]];
const pad4 = n => String(n).padStart(4, '0');
const zipAudioWaiting = new Map();
window.__zipAudioDone = function (id, ok, result) {
    const w = zipAudioWaiting.get(id);
    if (!w) return;
    zipAudioWaiting.delete(id);
    ok ? w.resolve(result) : w.reject(new Error(result));
};
let zipAudioSeq = 0;

function bukhariAudioUrl(n) {
    n = Number(n);
    const r = BUKHARI_AUDIO_RANGES.find(([a, b]) => n >= a && n <= b);
    if (!Number.isInteger(n) || !r) return Promise.reject(new Error('Ingen oplæsning til dette nummer'));
    const zip = `https://salafiaudio.wordpress.com/wp-content/uploads/2014/06/bukhari_mp3_${pad4(r[0])}-${pad4(r[1])}.zip`;
    if (!(window.AndroidBridge && AndroidBridge.fetchZipAudio)) {
        // Web-app: proxyen henter den ene mp3 ud af zip'en
        const proxy = typeof webProxy === 'function' ? webProxy() : '';
        if (!proxy || proxy === '/__proxy') return Promise.reject(new Error('kræver web-appens proxy'));
        return Promise.resolve(`${proxy}/zip?${new URLSearchParams({ u: zip, e: pad4(n) + '.mp3' })}`);
    }
    const id = 'z' + (++zipAudioSeq);
    return new Promise((resolve, reject) => {
        zipAudioWaiting.set(id, { resolve, reject });
        AndroidBridge.fetchZipAudio(id, zip, pad4(n) + '.mp3', `bukhari-${pad4(n)}.mp3`);
        setTimeout(() => { if (zipAudioWaiting.delete(id)) reject(new Error('det tog for lang tid')); }, 90000);
    });
}

const hasBukhariAudio = n => Number.isInteger(Number(n)) && Number(n) >= 1 && Number(n) <= 7563;
function bukhariRecordedPart(n, arabic) {
    return hasBukhariAudio(n)
        ? { icon: '🎙', label: 'Oplæst på arabisk (indspillet stemme)', recorded: () => bukhariAudioUrl(n), fallback: { text: arabic, lang: 'ar' } }
        : null;
}
