'use strict';

// =================================================================
// Lyt og gentag: afspil et afsnit (fra–til vers) med valgfri gentagelse
// af hvert vers, pause mellem versene og gentagelse af hele afsnittet.
// =================================================================

const listen = { audio: null, timer: null, running: false, token: 0 };

function listenSettings() {
    const surah = Number(surahSelect.value);
    const max = AYAH_COUNT[surah - 1];
    let from = Math.min(max, Math.max(1, parseInt($('lsFrom').value, 10) || 1));
    let to = Math.min(max, Math.max(1, parseInt($('lsTo').value, 10) || from));
    if (from > to) [from, to] = [to, from];
    return {
        surah, from, to,
        perVerse: Number($('lsPerVerse').value),
        pause: Number($('lsPause').value),
        rounds: Number($('lsRounds').value)   // 0 = uendeligt
    };
}

function setListenStatus(text, verse) {
    $('lsStatus').textContent = text;
    const box = $('lsVerse');
    box.innerHTML = '';
    box.hidden = !verse;
    if (verse) {
        box.textContent = verse.arabic + ' ';
        box.appendChild(el('span', { class: 'ayah-num' }, toArabicDigits(verse.ayah)));
    }
}

function stopListen() {
    listen.running = false;
    listen.token++;
    clearTimeout(listen.timer);
    if (listen.audio) { listen.audio.pause(); listen.audio.src = ''; listen.audio = null; }
    $('lsStart').hidden = false;
    $('lsStop').hidden = true;
    setListenStatus('');
}

function playOnce(url, token) {
    return new Promise((resolve, reject) => {
        const a = new Audio(url);
        listen.audio = a;
        a.addEventListener('ended', () => resolve());
        a.addEventListener('error', () => reject(new Error('Lydfilen kunne ikke afspilles')));
        a.play().catch(reject);
        if (token !== listen.token) { a.pause(); resolve(); }
    });
}

function wait(ms, token) {
    return new Promise(resolve => {
        listen.timer = setTimeout(resolve, ms);
        if (token !== listen.token) resolve();
    });
}

async function startListen() {
    stopAudio();
    stopListen();
    const cfg = listenSettings();
    $('lsFrom').value = cfg.from;
    $('lsTo').value = cfg.to;
    settings.listen = { perVerse: cfg.perVerse, pause: cfg.pause, rounds: cfg.rounds };
    saveSettings();

    const token = ++listen.token;
    listen.running = true;
    $('lsStart').hidden = true;
    $('lsStop').hidden = false;
    const folder = reciterSelect.value;
    try {
        for (let round = 1; cfg.rounds === 0 || round <= cfg.rounds; round++) {
            for (let a = cfg.from; a <= cfg.to; a++) {
                const v = getVerse(cfg.surah, a);
                for (let rep = 1; rep <= cfg.perVerse; rep++) {
                    if (token !== listen.token) return;
                    setListenStatus(`${SURAH_NAMES_EN[cfg.surah]} vers ${a} · ${rep}/${cfg.perVerse}`
                        + ` · runde ${round}${cfg.rounds ? '/' + cfg.rounds : ''}`, $('lsShowText').checked ? v : null);
                    await playOnce(`https://everyayah.com/data/${folder}/${pad3(cfg.surah)}${pad3(a)}.mp3`, token);
                    if (token !== listen.token) return;
                    if (cfg.pause > 0) {
                        setListenStatus(`Pause – recitér selv… (${cfg.pause} sek.)`, $('lsShowText').checked ? v : null);
                        await wait(cfg.pause * 1000, token);
                    }
                }
            }
        }
        if (token === listen.token) { stopListen(); toast('Afsnittet er færdigt ✓'); }
    } catch (err) {
        if (token === listen.token) { stopListen(); toast(err.message + ' – prøv en anden qari'); }
    }
}

// Udfyld fra–til ud fra den valgte sura/det aktuelle vers
function syncListenRange() {
    const q = currentVerse();
    if (q && Number(surahSelect.value) === q.surah && !listen.running) {
        $('lsFrom').value = startVerse.value;
        $('lsTo').value = endVerse.value;
    }
}

(function initListen() {
    const fill = (id, values, label, selected) => {
        const sel = $(id);
        values.forEach(v => sel.appendChild(el('option', { value: v }, label(v))));
        sel.value = selected;
    };
    const ls = settings.listen || {};
    fill('lsPerVerse', [1, 2, 3, 5, 7, 10, 20], v => `${v} gang${v > 1 ? 'e' : ''}`, ls.perVerse || 3);
    fill('lsPause', [0, 2, 3, 5, 8, 10, 15], v => v ? `${v} sek.` : 'Ingen pause', ls.pause ?? 3);
    fill('lsRounds', [1, 2, 3, 5, 10, 0], v => v ? `${v} gang${v > 1 ? 'e' : ''}` : 'Uendeligt', ls.rounds ?? 1);
    $('lsFrom').value = startVerse.value;
    $('lsTo').value = endVerse.value;
    $('lsStart').addEventListener('click', startListen);
    $('lsStop').addEventListener('click', stopListen);
    surahSelect.addEventListener('change', () => { $('lsFrom').value = 1; $('lsTo').value = endVerse.value; });
    startVerse.addEventListener('change', () => { $('lsFrom').value = startVerse.value; });
    endVerse.addEventListener('change', () => { $('lsTo').value = endVerse.value; });
    $('wholeSurahBtn').addEventListener('click', () => { $('lsFrom').value = 1; $('lsTo').value = endVerse.value; });
})();
