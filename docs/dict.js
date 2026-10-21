'use strict';

// =================================================================
// Ordbøger: slå et ord op i arabiske ordbøger (betydning, rod, etymologi)
// og i ordbøger for dansk, engelsk, tysk, fransk, russisk og kinesisk.
// Opslag åbnes i appens indbyggede browser.
// =================================================================

const enc = encodeURIComponent;

// Arabisk → Buckwalter (bruges af Quranic Arabic Corpus)
const BUCKWALTER = {
    'ء': "'", 'آ': '|', 'أ': '>', 'ؤ': '&', 'إ': '<', 'ئ': '}', 'ا': 'A', 'ب': 'b', 'ة': 'p', 'ت': 't', 'ث': 'v',
    'ج': 'j', 'ح': 'H', 'خ': 'x', 'د': 'd', 'ذ': '*', 'ر': 'r', 'ز': 'z', 'س': 's', 'ش': '$', 'ص': 'S', 'ض': 'D',
    'ط': 'T', 'ظ': 'Z', 'ع': 'E', 'غ': 'g', 'ف': 'f', 'ق': 'q', 'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n', 'ه': 'h',
    'و': 'w', 'ى': 'Y', 'ي': 'y'
};
const toBuckwalter = s => [...s].map(c => BUCKWALTER[c] || '').join('');

// Fjern tashkil, tatweel og Koran-tegn; normalisér alif wasla
function stripArabic(s) {
    return s
        .replace(/[ؐ-ًؚ-ٰٟۖ-ۭـ]/g, '')
        .replace(/ٱ/g, 'ا')
        .replace(/[^ء-ي\s]/g, '')
        .trim();
}

const DICTS = {
    ar: {
        name: 'Arabisk', hint: 'Klassiske ordbøger er ordnet efter roden – søg fx på كتب i stedet for مكتوب.',
        items: [
            { name: 'Ordbogen.com – Gyldendals Røde Ordbøger', desc: 'De rigtige ordbogsværker: Gyldendals Røde Ordbøger m.fl. (ejes nu af Ordbogen A/S). Kræver abonnement – log ind én gang i appens browser, så huskes du.', tags: ['Dansk', 'Abonnement'], url: w => `https://www.ordbogen.com/da/opslag?q=${enc(w)}` },
            { name: 'Arabic Almanac', ar: 'المورد', desc: 'Hans Wehr, Lane\'s Lexicon, Lisan al-Arab, Mufradat ar-Raghib, al-Munjid, Brill (Badawi & Haleem), Kazimirski m.fl. – scannede sider efter rod. Indeholder også "al-Mu\'jam al-Ishtiqaqi al-Mu\'assal" (etymologisk ordbog over Koranens ord).', tags: ['Hans Wehr', 'Lane', 'Lisan', 'Etymologi'], url: w => `https://ejtaal.net/aa/#q=${enc(w)}` },
            { name: 'The Arabic Lexicon', ar: 'المعجم العربي', desc: 'Over 40 klassiske ordbøger i søgbar tekst: Kitab al-\'Ayn, Maqayis al-Lugha (Ibn Faris – rodens grundbetydning), as-Sihah, Lisan al-Arab, al-Qamus al-Muhit, Taj al-\'Arus, Mufradat, al-Mu\'arrab (låneord i Koranen), Lane og Dozy.', tags: ['Maqayis', 'Lisan', 'Taj al-Arus', 'Etymologi'], url: w => `https://arabiclexicon.hawramani.com/search/${enc(w)}` },
            { name: 'Maajim', ar: 'معاجم', desc: 'Lisan al-Arab, al-Mu\'jam al-Wasit, al-Ghani, Mukhtar as-Sihah, Mu\'jam al-Lugha al-\'Arabiyya al-Mu\'asira – samt arabisk–dansk.', tags: ['al-Wasit', 'Moderne'], url: w => `https://www.maajim.com/dictionary/${enc(w)}` },
            { name: 'Doha – historisk ordbog', ar: 'معجم الدوحة التاريخي', desc: 'Ordenes historie: ældste kendte brug, betydningsudvikling og etymologi med daterede citater.', tags: ['Etymologi', 'Historie'], url: w => `https://www.dohadictionary.org/dictionary/${enc(w)}` },
            { name: 'Quranic Arabic Corpus', ar: 'معجم القرآن', desc: 'Alle steder i Koranen hvor roden forekommer, med grammatik og engelsk betydning. Søg på roden (3 bogstaver).', tags: ['Koranen', 'Rod'], url: w => `https://corpus.quran.com/qurandictionary.jsp?q=${enc(toBuckwalter(w))}` },
            { name: 'al-Ma\'ani – arabisk', ar: 'المعاني عربي عربي', desc: 'Stor moderne og klassisk arabisk-arabisk ordbog med mange opslagsværker samlet.', tags: ['Moderne'], url: w => `https://www.almaany.com/ar/dict/ar-ar/${enc(w)}/` },
            { name: 'al-Ma\'ani – arabisk–engelsk', ar: 'المعاني عربي إنجليزي', desc: 'Arabisk–engelsk ordbog.', tags: ['Engelsk'], url: w => `https://www.almaany.com/ar/dict/ar-en/${enc(w)}/` },
            { name: 'Wiktionary', ar: 'ويكاموس', desc: 'Engelsk Wiktionary med etymologi, rod, bøjning og oversættelser.', tags: ['Etymologi'], url: w => `https://en.wiktionary.org/wiki/${enc(w)}` },
            { name: 'Glosbe arabisk → dansk', ar: 'عربي ← دنماركي', desc: 'Arabisk–dansk ordbog med eksempelsætninger.', tags: ['Dansk'], url: w => `https://glosbe.com/ar/da/${enc(w)}` },
            { name: 'Google Oversæt → dansk', ar: '', desc: 'Hurtig maskinoversættelse af ordet.', tags: ['Dansk'], url: w => `https://translate.google.com/?sl=ar&tl=da&text=${enc(w)}&op=translate` }
        ]
    },
    da: {
        name: 'Dansk', hint: '',
        items: [
            { name: 'Ordbogen.com – Gyldendals Røde Ordbøger', desc: 'De rigtige ordbogsværker: Gyldendals Røde Ordbøger m.fl. (ejes nu af Ordbogen A/S). Kræver abonnement – log ind én gang i appens browser, så huskes du.', tags: ['Dansk', 'Abonnement'], url: w => `https://www.ordbogen.com/da/opslag?q=${enc(w)}` },
            { name: 'Den Danske Ordbog', desc: 'Betydning, bøjning, udtale og oprindelse (ordnet.dk).', tags: ['Etymologi'], url: w => `https://ordnet.dk/ddo/ordbog?query=${enc(w)}` },
            { name: 'Ordbog over det danske Sprog', desc: 'Historisk ordbog over dansk 1700–1950 (ordnet.dk).', tags: ['Historie'], url: w => `https://ordnet.dk/ods/ordbog?query=${enc(w)}` },
            { name: 'Lex.dk – Den Store Danske m.fl.', desc: 'Danmarks nationalleksikon (Den Store Danske, Trap Danmark, Dansk Biografisk Leksikon m.fl.): opslag om begreber, personer og steder.', tags: ['Leksikon'], url: w => `https://lex.dk/.search?query=${enc(w)}` },
            { name: 'Sproget.dk', desc: 'Retskrivning og sprogråd fra Dansk Sprognævn.', tags: ['Retskrivning'], url: w => `https://sproget.dk/raad-og-regler/ordboeger/?q=${enc(w)}` },
            { name: 'Glosbe dansk → arabisk', desc: 'Dansk–arabisk ordbog med eksempler.', tags: ['Arabisk'], url: w => `https://glosbe.com/da/ar/${enc(w)}` },
            { name: 'Wiktionary (dansk)', desc: 'Betydning, bøjning og etymologi.', tags: ['Etymologi'], url: w => `https://da.wiktionary.org/wiki/${enc(w)}` }
        ]
    },
    en: {
        name: 'Engelsk', hint: '',
        items: [
            { name: 'Ordbogen.com – Gyldendals Røde Ordbøger', desc: 'De rigtige ordbogsværker: Gyldendals Røde Ordbøger m.fl. (ejes nu af Ordbogen A/S). Kræver abonnement – log ind én gang i appens browser, så huskes du.', tags: ['Dansk', 'Abonnement'], url: w => `https://www.ordbogen.com/da/opslag?q=${enc(w)}` },
            { name: 'dict.cc engelsk → dansk', desc: 'Engelsk–dansk ordbog med mange oversættelser.', tags: ['Dansk'], url: w => `https://da-en.dict.cc/?s=${enc(w)}` },
            { name: 'Glosbe engelsk → dansk', desc: 'Engelsk–dansk med eksempelsætninger.', tags: ['Dansk'], url: w => `https://glosbe.com/en/da/${enc(w)}` },
            { name: 'Google Oversæt → dansk', desc: 'Hurtig maskinoversættelse.', tags: ['Dansk'], url: w => `https://translate.google.com/?sl=en&tl=da&text=${enc(w)}&op=translate` },
            { name: 'Etymonline', desc: 'Online Etymology Dictionary – ordenes oprindelse og historie.', tags: ['Etymologi'], url: w => `https://www.etymonline.com/word/${enc(w)}` },
            { name: 'Cambridge Dictionary', desc: 'Klare definitioner og eksempler.', tags: [], url: w => `https://dictionary.cambridge.org/dictionary/english/${enc(w)}` },
            { name: 'Merriam-Webster', desc: 'Amerikansk standardordbog med etymologi.', tags: ['Etymologi'], url: w => `https://www.merriam-webster.com/dictionary/${enc(w)}` },
            { name: 'Wiktionary (engelsk)', desc: 'Betydning, udtale og etymologi.', tags: ['Etymologi'], url: w => `https://en.wiktionary.org/wiki/${enc(w)}` },
            { name: 'Glosbe engelsk → arabisk', desc: 'Engelsk–arabisk med eksempler.', tags: ['Arabisk'], url: w => `https://glosbe.com/en/ar/${enc(w)}` }
        ]
    },
    de: {
        name: 'Tysk', hint: '',
        items: [
            { name: 'Ordbogen.com – Gyldendals Røde Ordbøger', desc: 'De rigtige ordbogsværker: Gyldendals Røde Ordbøger m.fl. (ejes nu af Ordbogen A/S). Kræver abonnement – log ind én gang i appens browser, så huskes du.', tags: ['Dansk', 'Abonnement'], url: w => `https://www.ordbogen.com/da/opslag?q=${enc(w)}` },
            { name: 'dict.cc tysk → dansk', desc: 'Tysk–dansk ordbog.', tags: ['Dansk'], url: w => `https://de-da.dict.cc/?s=${enc(w)}` },
            { name: 'Glosbe tysk → dansk', desc: 'Tysk–dansk med eksempelsætninger.', tags: ['Dansk'], url: w => `https://glosbe.com/de/da/${enc(w)}` },
            { name: 'Google Oversæt → dansk', desc: 'Hurtig maskinoversættelse.', tags: ['Dansk'], url: w => `https://translate.google.com/?sl=de&tl=da&text=${enc(w)}&op=translate` },
            { name: 'Grimms Deutsches Wörterbuch', desc: 'Brødrene Grimms store historiske ordbog (Wörterbuchnetz, Trier) – ordets historie og oprindelse.', tags: ['Etymologi', 'Historie'], url: w => `https://woerterbuchnetz.de/?sigle=DWB&lemma=${enc(w.toLowerCase())}` },
            { name: 'Adelung (Wörterbuchnetz)', desc: 'Adelungs klassiske ordbog over højtysk (1793–1801).', tags: ['Historie'], url: w => `https://woerterbuchnetz.de/?sigle=Adelung&lemma=${enc(w)}` },
            { name: 'Duden', desc: 'Den tyske standardordbog: betydning, retskrivning og oprindelse.', tags: ['Etymologi'], url: w => `https://www.duden.de/suchen/dudenonline/${enc(w)}` },
            { name: 'DWDS', desc: 'Digitales Wörterbuch der deutschen Sprache – med Pfeifers etymologiske ordbog.', tags: ['Etymologi'], url: w => `https://www.dwds.de/wb/${enc(w)}` },
            { name: 'Wiktionary (tysk)', desc: 'Betydning, bøjning og etymologi.', tags: ['Etymologi'], url: w => `https://de.wiktionary.org/wiki/${enc(w)}` },
            { name: 'Glosbe tysk → arabisk', desc: 'Tysk–arabisk med eksempler.', tags: ['Arabisk'], url: w => `https://glosbe.com/de/ar/${enc(w)}` }
        ]
    },
    fr: {
        name: 'Fransk', hint: '',
        items: [
            { name: 'Ordbogen.com – Gyldendals Røde Ordbøger', desc: 'De rigtige ordbogsværker: Gyldendals Røde Ordbøger m.fl. (ejes nu af Ordbogen A/S). Kræver abonnement – log ind én gang i appens browser, så huskes du.', tags: ['Dansk', 'Abonnement'], url: w => `https://www.ordbogen.com/da/opslag?q=${enc(w)}` },
            { name: 'Glosbe fransk → dansk', desc: 'Fransk–dansk med eksempelsætninger.', tags: ['Dansk'], url: w => `https://glosbe.com/fr/da/${enc(w)}` },
            { name: 'Google Oversæt → dansk', desc: 'Hurtig maskinoversættelse.', tags: ['Dansk'], url: w => `https://translate.google.com/?sl=fr&tl=da&text=${enc(w)}&op=translate` },
            { name: 'Dictionnaire de l\'Académie française', desc: 'Det Franske Akademis officielle ordbog (9. udgave) med ordets historie.', tags: ['Officiel', 'Etymologi'], url: w => `https://www.dictionnaire-academie.fr/search?term=${enc(w)}` },
            { name: 'Larousse', desc: 'Fransk standardordbog.', tags: [], url: w => `https://www.larousse.fr/dictionnaires/francais/${enc(w)}` },
            { name: 'CNRTL – TLFi', desc: 'Trésor de la langue française: definitioner.', tags: [], url: w => `https://www.cnrtl.fr/definition/${enc(w)}` },
            { name: 'CNRTL – etymologi', desc: 'Ordets oprindelse og historie.', tags: ['Etymologi'], url: w => `https://www.cnrtl.fr/etymologie/${enc(w)}` },
            { name: 'Wiktionnaire', desc: 'Fransk Wiktionary med etymologi.', tags: ['Etymologi'], url: w => `https://fr.wiktionary.org/wiki/${enc(w)}` },
            { name: 'Glosbe fransk → arabisk', desc: 'Fransk–arabisk med eksempler.', tags: ['Arabisk'], url: w => `https://glosbe.com/fr/ar/${enc(w)}` }
        ]
    },
    ru: {
        name: 'Russisk', hint: '',
        items: [
            { name: 'Ordbogen.com – Gyldendals Røde Ordbøger', desc: 'De rigtige ordbogsværker: Gyldendals Røde Ordbøger m.fl. (ejes nu af Ordbogen A/S). Kræver abonnement – log ind én gang i appens browser, så huskes du.', tags: ['Dansk', 'Abonnement'], url: w => `https://www.ordbogen.com/da/opslag?q=${enc(w)}` },
            { name: 'Glosbe russisk → dansk', desc: 'Russisk–dansk med eksempelsætninger.', tags: ['Dansk'], url: w => `https://glosbe.com/ru/da/${enc(w)}` },
            { name: 'Google Oversæt → dansk', desc: 'Hurtig maskinoversættelse.', tags: ['Dansk'], url: w => `https://translate.google.com/?sl=ru&tl=da&text=${enc(w)}&op=translate` },
            { name: 'Dals ordbog (slovardalja.net)', desc: 'Vladimir Dals klassiske forklarende ordbog over det levende russiske sprog (1863–66).', tags: ['Historie'],
                url: () => 'https://slovardalja.net/view_search.php',
                post: w => 'search=' + enc(w) + '&submit_s=' + enc('Искать') },
            { name: 'Dals ordbog (gufo.me)', desc: 'Samme ordbog af Dal, med direkte opslag på ordet.', tags: ['Historie'], url: w => `https://gufo.me/dict/dal/${enc(w)}` },
            { name: 'Gramota.ru', desc: 'Russiske standardordbøger: retskrivning og betydning.', tags: [], url: w => `https://gramota.ru/poisk?query=${enc(w)}` },
            { name: 'Wiktionary (russisk)', desc: 'Betydning, bøjning og etymologi (bl.a. efter Vasmer).', tags: ['Etymologi'], url: w => `https://ru.wiktionary.org/wiki/${enc(w)}` },
            { name: 'Academic.ru', desc: 'Søgning i mange russiske ordbøger og leksika på én gang.', tags: ['Etymologi'], url: w => `https://dic.academic.ru/searchall.php?SWord=${enc(w)}` },
            { name: 'Glosbe russisk → arabisk', desc: 'Russisk–arabisk med eksempler.', tags: ['Arabisk'], url: w => `https://glosbe.com/ru/ar/${enc(w)}` }
        ]
    },
    zh: {
        name: 'Kinesisk', hint: 'Skriv tegn (fx 书) eller pinyin.',
        items: [
            { name: 'Ordbogen.com – Gyldendals Røde Ordbøger', desc: 'De rigtige ordbogsværker: Gyldendals Røde Ordbøger m.fl. (ejes nu af Ordbogen A/S). Kræver abonnement – log ind én gang i appens browser, så huskes du.', tags: ['Dansk', 'Abonnement'], url: w => `https://www.ordbogen.com/da/opslag?q=${enc(w)}` },
            { name: 'Glosbe kinesisk → dansk', desc: 'Kinesisk–dansk med eksempelsætninger.', tags: ['Dansk'], url: w => `https://glosbe.com/zh/da/${enc(w)}` },
            { name: 'Google Oversæt → dansk', desc: 'Hurtig maskinoversættelse.', tags: ['Dansk'], url: w => `https://translate.google.com/?sl=zh-CN&tl=da&text=${enc(w)}&op=translate` },
            { name: '教育部《重編國語辭典》', desc: 'Taiwans officielle ordbog fra Undervisningsministeriet – svarer til Akademiets ordbog (traditionelle tegn).', tags: ['Officiel'], url: (w, ctx) => `https://dict.revised.moe.edu.tw/search.jsp?md=1&word=${enc((ctx && ctx.trad) || w)}` },
            { name: '漢語多功能字庫 (CUHK)', desc: 'Tegnets oprindelse: orakelben, bronze- og seglskrift og betydningens udvikling – svarer til en etymologisk ordbog (første tegn).', tags: ['Etymologi'], url: w => `https://humanum.arts.cuhk.edu.hk/Lexis/lexi-mf/search.php?word=${enc([...w][0])}` },
            { name: 'Chinese Text Project (Kangxi)', desc: 'Klassiske ordbøger: Kangxi zidian (1716) og Shuowen jiezi (100 e.Kr.) – svarer til Grimm/Dal (første tegn).', tags: ['Historie', 'Etymologi'], url: w => `https://ctext.org/dictionary.pl?if=en&char=${enc([...w][0])}` },
            { name: 'Zdic 汉典', desc: 'Stor kinesisk ordbog med Kangxi-opslag og tegnenes oprindelse.', tags: ['Etymologi'], url: w => `https://www.zdic.net/hans/${enc(w)}` },
            { name: 'MDBG', desc: 'Kinesisk–engelsk ordbog (CC-CEDICT) med pinyin og tegnopdeling.', tags: [], url: w => `https://www.mdbg.net/chinese/dictionary?wdqb=${enc(w)}` },
            { name: 'Wiktionary (engelsk)', desc: 'Kinesiske tegn med udtale og etymologi.', tags: ['Etymologi'], url: w => `https://en.wiktionary.org/wiki/${enc(w)}` },
            { name: 'Glosbe kinesisk → arabisk', desc: 'Kinesisk–arabisk med eksempler.', tags: ['Arabisk'], url: w => `https://glosbe.com/zh/ar/${enc(w)}` }
        ]
    },
    tr: {
        name: 'Tyrkisk', hint: 'Mange tyrkiske ord kommer fra arabisk og persisk – se etymologien hos Nişanyan og Etimoloji Türkçe.',
        items: [
            { name: 'Ordbogen.com – Gyldendals Røde Ordbøger', desc: 'Ordbogsværker hos Ordbogen A/S. Kræver abonnement – log ind én gang i appens browser.', tags: ['Dansk', 'Abonnement'], url: w => `https://www.ordbogen.com/da/opslag?q=${enc(w)}` },
            { name: 'Glosbe tyrkisk → dansk', desc: 'Tyrkisk–dansk ordbog med eksempelsætninger.', tags: ['Dansk'], url: w => `https://glosbe.com/tr/da/${enc(w)}` },
            { name: 'Google Oversæt → dansk', desc: 'Hurtig maskinoversættelse.', tags: ['Dansk'], url: w => `https://translate.google.com/?sl=tr&tl=da&text=${enc(w)}&op=translate` },
            { name: 'TDK – Güncel Türkçe Sözlük', ar: '', desc: 'Det Tyrkiske Sprogselskabs officielle ordbog – svarer til Den Danske Ordbog.', tags: ['Officiel'], url: w => `https://sozluk.gov.tr/?kelime=${enc(w)}` },
            { name: 'Nişanyan Sözlük', desc: 'Sevan Nişanyans etymologiske ordbog: ordets oprindelse (arabisk, persisk, osmannisk, gammeltyrkisk) med ældste belæg.', tags: ['Etymologi'], url: w => `https://www.nisanyansozluk.com/kelime/${enc(w)}` },
            { name: 'Etimoloji Türkçe', desc: 'Etymologisk ordbog – viser fx den arabiske rod (kitap ← كتاب, rod k-t-b).', tags: ['Etymologi', 'Arabisk rod'], url: w => `https://www.etimolojiturkce.com/kelime/${enc(w)}` },
            { name: 'Kubbealtı Lugatı', desc: 'Stor klassisk ordbog over tyrkisk med osmannisk ordforråd, arabisk/persisk oprindelse og citater.', tags: ['Osmannisk', 'Historie'], url: w => `https://lugatim.com/s/${enc(w)}` },
            { name: 'Wiktionary (tyrkisk)', desc: 'Vikisözlük: betydning, bøjning og etymologi.', tags: ['Etymologi'], url: w => `https://tr.wiktionary.org/wiki/${enc(w)}` },
            { name: 'Wiktionary (engelsk)', desc: 'Engelsk Wiktionary med tyrkisk etymologi og osmannisk skrift.', tags: ['Etymologi'], url: w => `https://en.wiktionary.org/wiki/${enc(w)}#Turkish` },
            { name: 'Tureng tyrkisk → engelsk', desc: 'Stor tyrkisk–engelsk ordbog med fagudtryk.', tags: [], url: w => `https://tureng.com/en/turkish-english/${enc(w)}` },
            { name: 'Glosbe tyrkisk → arabisk', desc: 'Tyrkisk–arabisk med eksempler.', tags: ['Arabisk'], url: w => `https://glosbe.com/tr/ar/${enc(w)}` }
        ]
    }
};
