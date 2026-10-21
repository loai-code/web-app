'use strict';

// =================================================================
// Test dig selv i dine gemte noter (vers og hadith).
// Spørgsmålstyper:
//   Vers:   recite  – se henvisningen, recitér, vis svaret og vurder dig selv
//           gap     – find det manglende ord i verset (4 valgmuligheder)
//           which   – hvilket vers er det? (4 valgmuligheder)
//   Hadith: recall  – se titlen, husk teksten, vis og vurder dig selv
//           whichH  – hvilken hadith er teksten fra? (4 valgmuligheder)
// =================================================================

// scope: null = alle noter, ellers en liste af valgte kategori-id'er (underkategorier tages med)
const quiz = { active: false, questions: [], index: 0, score: 0, answered: 0, wrong: [], scope: null };

function quizItems(scope) {
    const ids = scope
        ? [...new Set(scope.filter(getCat).flatMap(id => [id, ...descendantIds(id)]))]
        : notes.cats.map(c => c.id);
    const verses = [], hadiths = [];
    for (const id of ids) {
        for (const it of (getCat(id).items || [])) {
            if (it.type === 'verse') {
                for (let a = it.from; a <= it.to; a++) { const v = getVerse(it.surah, a); if (v) verses.push(v); }
            } else if (it.type === 'hadith' && (it.arabic || it.translation)) {
                hadiths.push(it);
            }
        }
    }
    // Fjern dubletter
    const seen = new Set();
    return {
        verses: verses.filter(v => { const k = v.surah + ':' + v.ayah; if (seen.has(k)) return false; seen.add(k); return true; }),
        hadiths
    };
}

const verseRef = v => `${SURAH_NAMES_EN[v.surah].replace(/\s*\(.*\)$/, '')} ${v.surah}:${v.ayah}`;
const pickOthers = (pool, n, notThis) => shuffleArray(pool.filter(x => x !== notThis)).slice(0, n);
const shorten = (s, n) => s.length > n ? s.slice(0, n).replace(/\s+\S*$/, '') + ' …' : s;

function buildQuiz(scope, count, mode) {
    const { verses, hadiths } = quizItems(scope);
    const qs = [];
    // Andre vers til forkerte svar: fra noterne, ellers nabovers i samme sura
    const versePool = verses.length >= 4 ? verses : null;
    for (const v of verses) {
        const types = mode === 'self' ? ['recite'] : mode === 'choice' ? ['gap', 'which'] : ['recite', 'gap', 'which'];
        let type = types[Math.floor(Math.random() * types.length)];
        const words = v.arabic.trim().split(/\s+/);
        if (type === 'gap' && words.length < 3) type = mode === 'choice' ? 'which' : 'recite';
        if (type === 'gap') {
            const gi = Math.floor(Math.random() * words.length);
            const answer = words[gi];
            const otherWords = shuffleArray(
                (versePool || VERSES.filter(x => x[0] === v.surah).map(x => ({ arabic: x[2] })))
                    .flatMap(x => x.arabic.trim().split(/\s+/))
                    .filter(w => stripArabic(w) !== stripArabic(answer) && w.length > 1));
            // Helst ord som ikke står i verset selv, så det forkerte svar ikke virker rigtigt
            const inVerse = new Set(words.map(stripArabic));
            const outside = otherWords.filter(w => !inVerse.has(stripArabic(w)));
            const distract = [...new Set([...outside, ...otherWords])].slice(0, 3);
            const options = shuffleArray([answer, ...distract]);
            qs.push({ type, v, gi, words, answer, options });
        } else if (type === 'which') {
            const others = versePool
                ? pickOthers(versePool, 3, v)
                : pickOthers(VERSES.filter(x => x[0] === v.surah && x[1] !== v.ayah).map(x => getVerse(x[0], x[1])), 3, v);
            qs.push({ type, v, answer: verseRef(v), options: shuffleArray([verseRef(v), ...others.map(verseRef)]) });
        } else {
            qs.push({ type: 'recite', v });
        }
    }
    for (const h of hadiths) {
        const canChoose = hadiths.length >= 2 && mode !== 'self';
        const type = mode === 'choice' && canChoose ? 'whichH'
            : mode === 'self' || !canChoose ? 'recall'
            : (Math.random() < 0.5 ? 'recall' : 'whichH');
        if (type === 'whichH') {
            const title = h.title || h.source;
            const others = pickOthers(hadiths, 3, h).map(x => x.title || x.source);
            qs.push({ type, h, answer: title, options: shuffleArray([title, ...others]) });
        } else {
            qs.push({ type: 'recall', h });
        }
    }
    shuffleArray(qs);
    return count ? qs.slice(0, count) : qs;
}

// ---------- Visning ----------

const quizBox = $('notesQuiz');

function setQuizMode(on) {
    quiz.active = on;
    quizBox.hidden = !on;
    $('notesView').hidden = on;
    $('notesSearch').hidden = on;
    document.querySelector('#page-notes .notes-toolbar').hidden = on;
    window.scrollTo(0, 0);
}

function openQuizSetup(catId) {
    if (!quizItems(null).verses.length && !quizItems(null).hadiths.length) {
        toast('Du har ingen gemte vers eller hadith at teste dig i endnu');
        return;
    }
    // Udgangspunkt: den kategori man kom fra, ellers sidste valg, ellers alle noter
    let scope = catId ? [catId] : (quiz.scope && quiz.scope.filter(getCat).length ? quiz.scope.filter(getCat) : null);
    setQuizMode(true);
    quizBox.innerHTML = '';

    const summary = el('p', { class: 'quiz-summary' });
    const startBtn = el('button', { type: 'button', class: 'btn btn-primary btn-block mt' }, 'Start testen');
    const tree = el('div', { class: 'quiz-scope' });

    // "Alle noter" + kategoritræet med afkrydsning
    const allBox = el('input', { type: 'checkbox' });
    const boxes = new Map();
    tree.appendChild(el('label', { class: 'quiz-scope-row all' }, allBox, el('span', {}, 'Alle noter')));
    const walk = (parentId, depth) => childCats(parentId).forEach(c => {
        const box = el('input', { type: 'checkbox' });
        boxes.set(c.id, box);
        const { verses, hadiths } = quizItems([c.id]);
        const n = verses.length + hadiths.length;
        tree.appendChild(el('label', { class: 'quiz-scope-row', style: `padding-inline-start:${10 + depth * 18}px` },
            box, el('span', { class: 'quiz-scope-name' }, (depth ? '↳ ' : '') + c.name), el("span", { class: "count" }, String(n))));
        box.addEventListener('change', () => {
            const sel = selected().filter(id => id !== c.id && !descendantIds(c.id).includes(id));
            scope = box.checked ? [...sel, c.id] : sel;
            if (!scope.length) scope = null;
            sync();
        });
        walk(c.id, depth + 1);
    });
    walk(null, 0);
    allBox.addEventListener('change', () => { scope = allBox.checked ? null : []; sync(); });

    // Valgte kategorier (uden dem der allerede er dækket af en valgt overkategori)
    function selected() { return scope ? scope.slice() : []; }
    function covered(id) {
        if (!scope) return true;
        return catPath(id).some(c => scope.includes(c.id));
    }
    function sync() {
        allBox.checked = !scope;
        for (const [id, box] of boxes) {
            const inherited = scope && catPath(id).slice(0, -1).some(c => scope.includes(c.id));
            box.checked = covered(id);
            box.disabled = !scope || inherited; // dækket af "Alle" eller af en overkategori
            box.closest('label').classList.toggle('dim', box.disabled);
        }
        if (scope && !scope.length) {
            summary.textContent = 'Vælg mindst én kategori.';
            startBtn.disabled = true;
            return;
        }
        const { verses, hadiths } = quizItems(scope);
        const names = scope ? scope.map(id => getCat(id).name).join(', ') : 'Alle noter';
        summary.textContent = `${names}: ${verses.length} vers og ${hadiths.length} hadith.`;
        startBtn.disabled = !verses.length && !hadiths.length;
    }

    const count = el('select', {}, ...[5, 10, 20, 0].map(n => el('option', { value: n }, n ? `${n} spørgsmål` : 'Alle')));
    count.value = 10;
    const mode = el('select', {},
        el('option', { value: 'mix' }, 'Blandet'),
        el('option', { value: 'self' }, 'Recitér / husk selv (vurder dig selv)'),
        el('option', { value: 'choice' }, 'Multiple choice (find ord / vers / hadith)'));
    startBtn.addEventListener('click', () => {
        quiz.scope = scope;
        startQuiz(scope, Number(count.value), mode.value);
    });
    quizBox.append(
        el('h2', { class: 'section-title' }, '🧠 Test dig selv'),
        el('div', { class: 'field' }, el('label', {}, 'Hvad vil du testes i?'), tree),
        summary,
        el('div', { class: 'field mt' }, el('label', {}, 'Antal spørgsmål'), count),
        el('div', { class: 'field mt' }, el('label', {}, 'Type'), mode),
        el('p', { class: 'note' }, 'Når du vurderer dig selv på et vers, opdateres også gentagelsessystemet (Dagens gentagelse).'),
        startBtn,
        el('button', { type: 'button', class: 'btn btn-ghost btn-block mt', onclick: closeQuiz }, 'Annullér'));
    sync();
}

function startQuiz(scope, count, mode, fixed) {
    quiz.questions = fixed || buildQuiz(scope, count, mode);
    quiz.index = 0; quiz.score = 0; quiz.answered = 0; quiz.wrong = [];
    renderQuizQuestion();
}

function closeQuiz() {
    setQuizMode(false);
    quizBox.innerHTML = '';
    renderNotes();
}

function quizHeader() {
    const n = quiz.questions.length;
    return el('div', { class: 'quiz-head' },
        el('span', {}, `Spørgsmål ${quiz.index + 1} af ${n}`),
        el('span', { class: 'quiz-score' }, `✓ ${quiz.score}`),
        el('button', { type: 'button', class: 'icon-btn small ghost', 'aria-label': 'Afslut', onclick: closeQuiz }, '✕'),
        el('div', { class: 'quiz-progress' }, el('span', { style: `width:${Math.round(quiz.index / n * 100)}%` })));
}

function verseBox(v, wordsOverride, hideNum) {
    const box = el('div', { class: 'arabic-box quiz-arabic', dir: 'rtl', lang: 'ar' });
    if (wordsOverride) wordsOverride.forEach(w => box.append(w, ' '));
    else box.append(v.arabic + ' ');
    if (!hideNum) box.appendChild(el('span', { class: 'ayah-num' }, toArabicDigits(v.ayah)));
    return box;
}

function nextQuestion(correct, q) {
    quiz.answered++;
    if (correct) quiz.score++; else quiz.wrong.push(q);
    quiz.index++;
    if (quiz.index >= quiz.questions.length) renderQuizResult(); else renderQuizQuestion();
}

function renderQuizQuestion() {
    const q = quiz.questions[quiz.index];
    quizBox.innerHTML = '';
    quizBox.appendChild(quizHeader());
    const body = el('div', { class: 'quiz-body' });
    quizBox.appendChild(body);

    if (q.type === 'recite') {
        body.append(
            el('div', { class: 'quiz-q' }, 'Recitér verset:'),
            el('div', { class: 'quiz-ref' }, el('span', { class: 'ar' }, 'سورة ' + SURAH_NAMES_AR[q.v.surah - 1]), `${SURAH_NAMES_EN[q.v.surah]} – vers ${q.v.ayah}`));
        const reveal = el('button', { type: 'button', class: 'btn btn-gold btn-block' }, 'Vis svar');
        body.appendChild(reveal);
        reveal.addEventListener('click', () => {
            reveal.remove();
            body.append(verseBox(q.v), el('div', { class: 'item-trans quiz-trans' }, q.v.english), selfRate(q, rating => rateVerse(q.v, rating)));
        });
    } else if (q.type === 'gap') {
        const words = q.words.map((w, i) => i === q.gi ? el('span', { class: 'quiz-gap' }, '_____') : w);
        body.append(
            el('div', { class: 'quiz-q' }, 'Hvilket ord mangler?'),
            el('div', { class: 'note' }, verseRef(q.v)),
            verseBox(q.v, words),
            choiceButtons(q, () => {
                const gap = body.querySelector('.quiz-gap');
                gap.textContent = q.answer;
                gap.classList.add('filled');
            }, true));
    } else if (q.type === 'which') {
        body.append(
            el('div', { class: 'quiz-q' }, 'Hvilket vers er det?'),
            verseBox(q.v, null, true), // versnummeret ville afsløre svaret
            choiceButtons(q, () => {
                body.querySelector('.quiz-arabic').appendChild(el('span', { class: 'ayah-num' }, toArabicDigits(q.v.ayah)));
                body.appendChild(el('div', { class: 'item-trans quiz-trans' }, q.v.english));
            }));
    } else if (q.type === 'recall') {
        body.append(
            el('div', { class: 'quiz-q' }, 'Husk hadithen:'),
            el('div', { class: 'quiz-ref' }, q.h.title || 'Hadith'),
            q.h.source ? el('div', { class: 'note center' }, q.h.source) : null);
        const reveal = el('button', { type: 'button', class: 'btn btn-gold btn-block' }, 'Vis svar');
        body.appendChild(reveal);
        reveal.addEventListener('click', () => {
            reveal.remove();
            if (q.h.arabic) body.appendChild(el('div', { class: 'item-arabic small quiz-arabic', dir: 'rtl', lang: 'ar' }, q.h.arabic));
            if (q.h.translation) body.appendChild(el('div', { class: 'item-trans quiz-trans' }, q.h.translation));
            body.appendChild(el('div', { class: 'item-actions' }, listenButton(() => savedHadithParts(q.h))));
            body.appendChild(selfRate(q));
        });
    } else if (q.type === 'whichH') {
        const text = q.h.translation || q.h.arabic;
        body.append(
            el('div', { class: 'quiz-q' }, 'Hvilken hadith er det?'),
            el('div', { class: (q.h.translation ? 'item-trans' : 'item-arabic small') + ' quiz-text', dir: q.h.translation ? 'auto' : 'rtl' }, shorten(text, 420)),
            choiceButtons(q, null, false));
    }
}

function selfRate(q, onRate) {
    const wrap = el('div', { class: 'srs-rating' },
        el('div', { class: 'srs-q' }, 'Hvor godt kunne du det?'));
    const btns = el('div', { class: 'srs-btns' });
    [[0, '✗ Kunne ikke', 'srs-0'], [1, '≈ Næsten', 'srs-1'], [2, '✓ Kunne', 'srs-2']].forEach(([r, label, cls]) => {
        btns.appendChild(el('button', { type: 'button', class: 'btn ' + cls, onclick: () => {
            if (onRate) onRate(r);
            nextQuestion(r === 2, q);
        } }, label));
    });
    wrap.appendChild(btns);
    return wrap;
}

function choiceButtons(q, afterAnswer, arabicOptions) {
    const box = el('div', { class: 'quiz-options' });
    q.options.forEach(opt => {
        const b = el('button', { type: 'button', class: 'quiz-option' + (arabicOptions ? ' ar' : ''), dir: arabicOptions ? 'rtl' : 'auto' }, opt);
        b.addEventListener('click', () => {
            if (box.dataset.done) return;
            box.dataset.done = '1';
            const correct = opt === q.answer;
            [...box.children].forEach(c => {
                if (c.textContent === q.answer) c.classList.add('correct');
                else if (c === b) c.classList.add('wrong');
                c.disabled = true;
            });
            if (afterAnswer) afterAnswer();
            toast(correct ? '✓ Rigtigt' : '✗ Forkert');
            box.after(el('button', { type: 'button', class: 'btn btn-primary btn-block mt', onclick: () => nextQuestion(correct, q) },
                quiz.index + 1 < quiz.questions.length ? 'Næste spørgsmål ›' : 'Se resultat'));
        });
        box.appendChild(b);
    });
    return box;
}

function renderQuizResult() {
    quizBox.innerHTML = '';
    const n = quiz.questions.length;
    const pct = n ? Math.round(quiz.score / n * 100) : 0;
    const msg = pct === 100 ? 'Mashallah – alt rigtigt! 🌟' : pct >= 80 ? 'Rigtig flot!' : pct >= 50 ? 'Godt på vej – øv dem du ikke kunne.' : 'Øvelse gør mester – prøv igen.';
    quizBox.append(
        el('h2', { class: 'section-title' }, '🧠 Resultat'),
        el('div', { class: 'quiz-result' }, el('b', {}, `${quiz.score} / ${n}`), el('small', {}, `${pct}% rigtige`)),
        el('p', { class: 'center' }, msg));
    if (quiz.wrong.length) {
        quizBox.appendChild(el('h3', { class: 'list-head' }, 'Det skal du øve igen'));
        const list = el('div', { class: 'list' });
        quiz.wrong.forEach(q => list.appendChild(el('div', { class: 'list-row' },
            el('span', { class: 'list-main' }, el('span', { class: 'list-title' }, q.v ? verseRef(q.v) : (q.h.title || q.h.source || 'Hadith'))))));
        quizBox.appendChild(list);
        const wrongCopy = quiz.wrong.slice();
        quizBox.appendChild(el('button', { type: 'button', class: 'btn btn-gold btn-block mt', onclick: () => startQuiz(null, 0, null, shuffleArray(wrongCopy)) }, `Øv de ${wrongCopy.length} igen`));
    }
    quizBox.append(
        el('button', { type: 'button', class: 'btn btn-primary btn-block mt', onclick: () => openQuizSetup(null) }, 'Ny test'),
        el('button', { type: 'button', class: 'btn btn-ghost btn-block mt', onclick: closeQuiz }, 'Tilbage til noter'));
}
