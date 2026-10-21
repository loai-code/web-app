'use strict';

// =================================================================
// Sider og navigation (menu i toppen + Android-tilbageknap)
// =================================================================

const PAGES = {
    memorize: { title: 'Koran-memorering', ar: 'حِفْظُ القُرْآن' },
    progress: { title: 'Fremskridt', ar: 'التَّقَدُّم' },
    search: { title: 'Søg i Koranen', ar: 'البَحْث' },
    notes: { title: 'Noter', ar: 'المُذَكِّرَة' },
    hadith: { title: 'Hadith', ar: 'الحَدِيث' },
    adhkar: { title: 'Adhkar', ar: 'الأَذْكَار' },
    dict: { title: 'Ordbøger', ar: 'المَعَاجِم' },
    calendar: { title: 'Hijri-kalender', ar: 'التَّقْوِيم الهِجْرِي' },
    qibla: { title: 'Qibla', ar: 'القِبْلَة' }
};
let currentPage = 'memorize';
let hadithRendered = false;

function showPage(name) {
    if (!PAGES[name]) name = 'memorize';
    if (currentPage === 'qibla' && name !== 'qibla') stopQibla();
    currentPage = name;
    for (const key of Object.keys(PAGES)) $('page-' + key).hidden = key !== name;
    $('pageTitle').textContent = PAGES[name].title;
    document.querySelector('.brand-ar').textContent = PAGES[name].ar;
    document.querySelectorAll('#pagesMenu [data-page]').forEach(b => b.classList.toggle('active', b.dataset.page === name));
    closePagesMenu();
    store.set('page', name);
    window.scrollTo(0, 0);

    if (name !== 'memorize') stopAudio();
    stopSpeak();
    if (name === 'notes' && !quiz.active) renderNotes();
    if (name === 'progress') renderProgress();
    if (name === 'calendar') renderCalendar();
    if (name === 'adhkar') renderAdhkar();
    if (name === 'search') setTimeout(() => $('qsInput').focus(), 100);
    if (name === 'memorize') updateSrsTodayBtn();
    if (name === 'hadith' && !hadithRendered) { hadithRendered = true; renderHadith(); }
    if (name === 'qibla') startQibla();
    if (name === 'dict') { if (dictMode === 'list') restoreScroll(); requestAnimationFrame(updateFastScroll); }
}

function openPagesMenu() {
    $('pagesMenu').hidden = false;
    $('pagesBtn').setAttribute('aria-expanded', 'true');
}
function closePagesMenu() {
    $('pagesMenu').hidden = true;
    $('pagesBtn').setAttribute('aria-expanded', 'false');
}

$('pagesBtn').addEventListener('click', e => {
    e.stopPropagation();
    $('pagesMenu').hidden ? openPagesMenu() : closePagesMenu();
});
$('pagesMenu').addEventListener('click', e => {
    const b = e.target.closest('[data-page]');
    if (b) showPage(b.dataset.page);
});
document.addEventListener('click', e => {
    if (!$('pagesMenu').hidden && !e.target.closest('#pagesMenu')) closePagesMenu();
});

// Når sproget ændres, skal hadith-emner hentes igen på det nye sprog
targetLang.addEventListener('change', () => {
    hadithRendered = false;
    if (currentPage === 'hadith') { hadithRendered = true; renderHadith(); }
});

// Android-tilbageknap: luk ark → luk menu → gå tilbage i hadith/noter → gå til forsiden
window.handleBack = function () {
    if (closeTopSheet()) return true;
    if (!$('pagesMenu').hidden) { closePagesMenu(); return true; }
    if (currentPage === 'hadith' && !$('hadithResults').hidden) {
        $('hadithSearch').value = '';
        bookSearchToken++;
        setHadithSearchMode(false);
        return true;
    }
    if (currentPage === 'notes' && quiz.active) { closeQuiz(); return true; }
    if (currentPage === 'notes' && $('notesSearch').value) { clearNotesSearch(); renderNotes(); return true; }
    if (currentPage === 'hadith' && hBack()) return true;
    if (currentPage === 'adhkar' && adhkarChapter) { closeAdhkarChapter(); return true; }
    if (currentPage === 'notes' && notesCurrent) {
        const c = getCat(notesCurrent);
        openCat(c ? c.parent : null);
        return true;
    }
    if (currentPage !== 'memorize') { showPage('memorize'); return true; }
    return false;
};

// Android: stop kompasset når appen sendes i baggrunden
document.addEventListener('visibilitychange', () => {
    if (currentPage !== 'qibla') return;
    if (document.hidden) stopQibla(); else startQibla(true);
});

showPage(store.get('page', 'memorize'));
