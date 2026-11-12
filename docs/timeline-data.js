'use strict';

// =================================================================
// Tidslinje for åbenbaringen 570–632 med kilder og pålidelighed.
//  y      årstal (omregnet fra hijri-kalenderen – omtrentligt)
//  w      tidspunkt i islamisk kalender / hvornår
//  date   pålidelighed af tidspunktet:  'sikker' | 'sandsynlig' | 'omstridt'
//  link   pålidelighed af koblingen mellem vers og begivenhed: 'sikker' | 'sandsynlig' | 'omstridt' | 'svag'
//  v      vers: {s, a:[fra, til], c (egen pålidelighed), om (omtaler begivenheden, åbenbaret senere/tidligere), n (note), label}
//  why    forklaring af pålideligheden
//  src    andre kilder (tekst)
//  h      hadith i appens samlinger: [samling, nummer, kort beskrivelse] – numrene er kontrolleret
//  b      tekst til mærket ved verset under memorering
// =================================================================

const TIMELINE = [
    {
        id: 'fil', y: 'ca. 570', w: 'Elefantens år', b: 'ca. 570 · Elefantens år',
        t: 'Profetens ﷺ fødsel', period: 'pre',
        d: 'Abraha fra Yemen drager mod Mekka med en hær med elefanter for at ødelægge Kaaba. Samme år fødes profeten ﷺ.',
        v: [{ s: 105, a: [1, 5], om: true, n: 'omtaler hæren (åbenbaret senere i Mekka)' }],
        date: 'sandsynlig', link: 'sikker',
        why: 'Sira-forfatterne siger, at profeten ﷺ blev født i Elefantens år, hvilket omregnes til ca. 570–571. Det præcise år og dagen (ofte nævnt 12. Rabi\' al-Awwal) er omstridt. Sura al-Fil nævner selv elefanthæren, men blev åbenbaret mange år senere.',
        src: ['Ibn Hisham, as-Sira an-Nabawiyya', 'Sura 105 nævner selv elefanthæren']
    },
    {
        id: 'iqra', y: 'ca. 610', w: 'Ramadan, 13 år før hijra', b: 'ca. 610 · første åbenbaring',
        t: 'Første åbenbaring i Hira-hulen', period: 'M',
        d: 'Jibril kommer til profeten ﷺ, der er omkring 40 år, med de første vers: "Læs i din Herres navn, Han som skabte…"',
        v: [{ s: 96, a: [1, 5] }],
        date: 'sandsynlig', link: 'sikker',
        why: 'At de første vers var 96:1–5, fortæller Aisha i Sahih al-Bukhari. At det var i Ramadan, følger af 2:185 og 97:1. Året regnes ud fra, at profeten ﷺ døde 63 år gammel og levede 13 år i Mekka efter kaldet. Dagen er omstridt (fx 17., 21. eller 27. Ramadan).',
        src: ['Koranen 2:185 og 97:1 (åbenbaret i Ramadan, på Laylat al-Qadr)'],
        h: [['bukhari', 3, 'Aisha om begyndelsen på åbenbaringen'], ['bukhari', 4466, 'Aisha: han døde 63 år gammel']]
    },
    {
        id: 'fatra', y: 'ca. 610–613', w: 'Efter en pause (fatra)', b: 'ca. 610–613 · efter pausen',
        t: 'Åbenbaringen fortsætter: "Rejs dig og advar!"', period: 'M',
        d: 'Efter en pause i åbenbaringen ser profeten ﷺ englen igen, og begyndelsen af sura al-Muddaththir åbenbares.',
        v: [{ s: 74, a: [1, 5] }],
        date: 'omstridt', link: 'sikker',
        why: 'Jabir fortæller i Bukhari, at 74:1–5 kom efter pausen. Hvor lang pausen var, er omstridt – fra nogle dage til omkring tre år – så året er usikkert.',
        h: [['bukhari', 4, 'Jabir: englen kommer igen efter pausen']]
    },
    {
        id: 'safa', y: 'ca. 613', w: 'Ca. 3 år efter kaldet', b: 'ca. 613 · den åbne kaldelse',
        t: 'Den åbne kaldelse begynder', period: 'M',
        d: '"Og advar dine nærmeste slægtninge" – profeten ﷺ kalder Quraysh sammen fra bjerget as-Safa. Abu Lahab svarer hånligt, og sura al-Masad åbenbares.',
        v: [{ s: 26, a: [214, 214] }, { s: 111, a: [1, 5] }],
        date: 'sandsynlig', link: 'sikker',
        why: 'Ibn Abbas fortæller i Bukhari, hvad der skete, da 26:214 kom, og at sura 111 kom som svar til Abu Lahab. At det skete ca. 3 år efter kaldet, bygger på Ibn Ishaq og er omtrentligt.',
        src: ['Ibn Hisham, as-Sira an-Nabawiyya'],
        h: [['bukhari', 4770, 'Ibn Abbas: profeten ﷺ på as-Safa']]
    },
    {
        id: 'rum', y: 'ca. 614–615', w: 'Efter persernes sejr over Byzans', b: 'ca. 614–615 · romerne besejret',
        t: 'Romerne besejret – og en forudsigelse', period: 'M',
        d: 'Perserne erobrer Jerusalem fra Byzans (614). Sura ar-Rum forudsiger, at romerne vil sejre igen "inden for få år" – hvilket skete i 620\'erne.',
        v: [{ s: 30, a: [1, 5] }],
        date: 'sandsynlig', link: 'sikker',
        why: 'Versene nævner selv begivenheden, og Ibn Abbas forklarer baggrunden (Tirmidhi, sahih). Persernes erobringer kendes fra byzantinske og persiske kilder (Jerusalem faldt i 614), så perioden passer – men det præcise år for versene kendes ikke.',
        src: ['Byzantinsk historie: Jerusalem erobret af perserne i 614'],
        h: [['tirmidhi', 3193, 'Ibn Abbas om 30:1–3']]
    },
    {
        id: 'habasha', y: 'ca. 615–616', w: '5. år efter kaldet', b: 'før ca. 615 · Abessinien',
        t: 'Udvandringen til Abessinien', period: 'M',
        d: 'Forfulgte muslimer søger beskyttelse hos Negus. Ja\'far ibn Abi Talib reciterer begyndelsen af sura Maryam for ham – så den var allerede åbenbaret.',
        v: [{ s: 19, a: [1, 33], om: true, label: 'Sura 19, begyndelsen', n: 'var allerede åbenbaret' }],
        date: 'sandsynlig', link: 'sandsynlig',
        why: 'Beretningen om Ja\'far hos Negus findes i Musnad Ahmad fra Umm Salama med en god (hasan) kæde. Den viser kun, at begyndelsen af sura Maryam var åbenbaret før udvandringen – ikke præcis hvornår. Året kommer fra siraen.',
        src: ['Musnad Ahmad, Umm Salama (hasan)', 'Ibn Hisham, as-Sira an-Nabawiyya']
    },
    {
        id: 'umar', y: 'ca. 616', w: 'Ca. 6. år efter kaldet', b: 'ca. 616 · Umar bliver muslim',
        t: 'Umar ibn al-Khattab bliver muslim', period: 'M',
        d: 'Ifølge en kendt fortælling hører Umar begyndelsen af sura Ta-Ha hos sin søster og bliver muslim.',
        v: [{ s: 20, a: [1, 8], om: true, n: 'var allerede åbenbaret' }],
        date: 'sandsynlig', link: 'svag',
        why: 'At Umar blev muslim i Mekka, er sikkert, og året er omtrentligt. Fortællingen om Ta-Ha hos søsteren står hos Ibn Ishaq uden en sikker kæde, så koblingen til versene er svag.',
        src: ['Ibn Hisham, as-Sira an-Nabawiyya (uden sikker kæde)']
    },
    {
        id: 'huzn', y: 'ca. 619', w: 'Ca. 3 år før hijra', b: 'ca. 619 · Abu Talibs død',
        t: 'Sorgens år: Abu Talib og Khadija dør', period: 'M',
        d: 'Profetens ﷺ farbror Abu Talib dør uden at sige trosbekendelsen. Da åbenbares: "Du kan ikke vejlede dem, du elsker…"',
        v: [{ s: 28, a: [56, 56] }],
        date: 'sandsynlig', link: 'sikker',
        why: 'Bukhari forbinder 28:56 med Abu Talibs død. Året bygger på siraen og er omtrentligt.',
        h: [['bukhari', 4772, 'Abu Talibs dødsleje']]
    },
    {
        id: 'jinn', y: 'ca. 619–620?', w: 'Omstridt – måske på vejen fra Ta\'if', b: 'Mekka · jinnerne lytter (år omstridt)',
        t: 'Jinnerne lytter til Koranen', period: 'M',
        d: 'En gruppe jinner hører profeten ﷺ recitere ved Nakhla, og sura al-Jinn åbenbares.',
        v: [{ s: 72, a: [1, 28] }, { s: 46, a: [29, 32], c: 'sandsynlig' }],
        date: 'omstridt', link: 'sikker',
        why: 'Ibn Abbas (Bukhari) forbinder sura al-Jinn med, at jinnerne lyttede, mens profeten ﷺ var på vej til markedet i Ukaz. Hvornår det var, er omstridt: Ibn Ishaq sætter det på hjemvejen fra Ta\'if (ca. 619), andre lærde mener, det skete tidligt i Mekka-perioden. 46:29–32 knyttes til det af mange mufassirun.',
        src: ['Ibn Hisham, as-Sira an-Nabawiyya'],
        h: [['bukhari', 4921, 'Ibn Abbas: jinnerne lytter']]
    },
    {
        id: 'isra', y: 'ca. 620–621', w: 'Omstridt – 1 til 5 år før hijra', b: 'ca. 620–621 · natterejsen (omstridt)',
        t: 'Natterejsen og himmelfarten', period: 'M',
        d: 'Profeten ﷺ føres om natten fra Mekka til Jerusalem og op gennem himlene. De fem daglige bønner påbydes.',
        v: [{ s: 17, a: [1, 1] }, { s: 53, a: [1, 18], c: 'sandsynlig' }],
        date: 'omstridt', link: 'sikker',
        why: 'At rejsen fandt sted, står i Koranen (17:1) og i sahih hadith. Tidspunktet er omstridt: de lærde nævner alt fra 1 til 5 år før hijra, mange siger ca. 1 år før. Den udbredte dato 27. Rajab har ingen sikker kilde. 53:1–18 knyttes til himmelfarten af de fleste mufassirun.',
        h: [['bukhari', 3887, 'Profeten ﷺ fortæller om natterejsen']]
    },
    {
        id: 'hijra', y: '622', w: 'Rabi\' al-Awwal 1 AH (ca. september 622)', b: '622 · hijra',
        t: 'Hijra – udvandringen til Medina', period: 'D',
        d: 'Profeten ﷺ og Abu Bakr gemmer sig i hulen Thawr og når derefter Medina. Den islamiske kalender tæller fra dette år.',
        v: [{ s: 9, a: [40, 40], om: true, n: 'omtaler hulen (åbenbaret 9 AH)' }],
        date: 'sikker', link: 'sikker',
        why: 'Året er det bedst kendte i siraen – den islamiske kalender begynder med det. Ankomsten til Medina regnes til Rabi\' al-Awwal, ca. september 622; den præcise dag varierer lidt mellem kilderne. 9:40 omtaler hulen, men blev åbenbaret senere.',
        h: [['bukhari', 3653, 'Abu Bakr i hulen']]
    },
    {
        id: 'qibla', y: 'ca. jan.–feb. 624', w: 'Rajab/Sha\'ban 2 AH', b: '624 · qibla skifter',
        t: 'Qibla skifter fra Jerusalem til Kaaba', period: 'D',
        d: 'Efter 16–17 måneder med bøn mod Jerusalem påbydes bøn mod Kaaba i Mekka.',
        v: [{ s: 2, a: [142, 150] }],
        date: 'sikker', link: 'sikker',
        why: 'al-Bara fortæller i Bukhari, at de bad mod Jerusalem i "16 eller 17 måneder" efter ankomsten til Medina, og at 2:144 kom ved skiftet. Datoen kendes derfor inden for ca. en måned.',
        h: [['bukhari', 40, 'al-Bara: 16 eller 17 måneder mod Jerusalem'], ['bukhari', 4486, 'al-Bara: 2:144 åbenbares']]
    },
    {
        id: 'siyam', y: 'ca. feb. 624', w: 'Sha\'ban 2 AH', b: 'ca. 624 · fasten påbydes',
        t: 'Fasten i Ramadan påbydes', period: 'D',
        d: '"I, som tror! Det er foreskrevet for jer at faste…" – den første Ramadan-faste var året for Badr.',
        v: [{ s: 2, a: [183, 185] }],
        date: 'sandsynlig', link: 'sikker',
        why: 'At 2:183–185 påbyder fasten, står i versene selv. At det skete i Sha\'ban 2 AH, er det almindelige syn i siraen (fx Ibn Sa\'d og at-Tabari), men der er ingen sahih hadith med datoen.',
        src: ['Ibn Sa\'d, at-Tabaqat al-Kubra', 'at-Tabari, Tarikh ar-Rusul wal-Muluk']
    },
    {
        id: 'badr', y: 'marts 624', w: '17. Ramadan 2 AH', b: '624 · Badr',
        t: 'Slaget ved Badr', period: 'D',
        d: 'Omkring 313 muslimer møder en langt større hær fra Quraysh og sejrer. Sura al-Anfal handler om slaget og byttet.',
        v: [{ s: 8, a: [1, 29] }, { s: 8, a: [37, 75] }, { s: 3, a: [123, 123], om: true, n: 'nævner Badr (åbenbaret efter Uhud)' }],
        date: 'sikker', link: 'sikker',
        why: 'Datoen 17. Ramadan 2 AH er det almindelige i kilderne (enkelte siger 19. Ramadan). Ibn Abbas siger i Bukhari, at sura al-Anfal kom i forbindelse med Badr. Vers 30–36 regnes i Madinah-mushafen som mekkanske og er derfor ikke taget med.',
        h: [['bukhari', 4645, 'Ibn Abbas: al-Anfal kom ved Badr']]
    },
    {
        id: 'uhud', y: 'marts 625', w: 'Shawwal 3 AH', b: '625 · Uhud',
        t: 'Slaget ved Uhud', period: 'D',
        d: 'Bueskytterne forlader deres post, og muslimerne lider store tab. Profeten ﷺ bliver såret. Et langt afsnit af Al Imran handler om slaget.',
        v: [{ s: 3, a: [122, 122] }, { s: 3, a: [121, 121], c: 'sandsynlig' }, { s: 3, a: [123, 179], c: 'sandsynlig' }],
        date: 'sikker', link: 'sikker',
        why: 'Datoen (Shawwal 3 AH) er enig i kilderne. Jabir fortæller i Bukhari, at 3:122 handler om to stammer ved Uhud. At hele afsnittet fra 3:121 (ca. 60 vers) hører til slaget, står hos Ibn Ishaq og de fleste mufassirun – den præcise afgrænsning er omtrentlig.',
        src: ['Ibn Hisham, as-Sira an-Nabawiyya (ca. 60 vers om Uhud)'],
        h: [['bukhari', 4051, 'Jabir: 3:122 handler om os']]
    },
    {
        id: 'khamr', y: 'ca. 625–626', w: 'Efter Uhud (3–4 AH)', b: 'ca. 625 · vinforbuddet',
        t: 'Vin (khamr) forbydes endeligt', period: 'D',
        d: 'Forbuddet kom i trin. Med 5:90–91 blev vin forbudt helt, og vinen blev hældt ud i Medinas gader.',
        v: [{ s: 5, a: [90, 91] }],
        date: 'sandsynlig', link: 'sikker',
        why: 'Jabir fortæller i Bukhari, at nogle drak vin om morgenen på Uhuds dag og døde som martyrer samme dag – forbuddet kom altså efter Uhud. Anas fortæller, hvordan vinen blev hældt ud. Det præcise år er omstridt.',
        h: [['bukhari', 2815, 'Jabir: nogle drak vin om morgenen ved Uhud'], ['bukhari', 4617, 'Anas: vinen hældes ud']]
    },
    {
        id: 'nadir', y: 'ca. 625', w: 'Rabi\' al-Awwal 4 AH', b: 'ca. 625 · Banu an-Nadir',
        t: 'Banu an-Nadir forvises fra Medina', period: 'D',
        d: 'Den jødiske stamme Banu an-Nadir bryder pagten og må forlade Medina. Sura al-Hashr handler om det.',
        v: [{ s: 59, a: [1, 24] }],
        date: 'sandsynlig', link: 'sikker',
        why: 'Ibn Abbas kaldte sura al-Hashr "suraen om Banu an-Nadir" (Bukhari). De fleste sira-forfattere sætter forvisningen til 4 AH; az-Zuhri mente dog, at den skete 6 måneder efter Badr.',
        h: [['bukhari', 4883, 'Ibn Abbas: kald den sura an-Nadir']]
    },
    {
        id: 'ifk', y: '627 eller 628', w: 'Efter felttoget mod Banu al-Mustaliq (5 eller 6 AH)', b: 'ca. 627 · Aishas uskyld',
        t: 'Bagvaskelsen af Aisha (al-ifk)', period: 'D',
        d: 'Aisha bliver ved en fejl efterladt på hjemvejen og anklaget falsk. Efter en måned åbenbares hendes uskyld. På samme felttog siger hyklernes leder de ord, sura al-Munafiqun handler om.',
        v: [{ s: 24, a: [11, 26] }, { s: 63, a: [1, 11], c: 'sandsynlig' }],
        date: 'omstridt', link: 'sikker',
        why: 'Aishas egen lange beretning (Bukhari) knytter 24:11–26 til hændelsen. Zayd ibn Arqam knytter sura 63 til Ibn Ubayys ord på et felttog, som de fleste placerer her. Om felttoget var i 5 eller 6 AH, er omstridt (Ibn Sa\'d: Sha\'ban 5, Ibn Ishaq: Sha\'ban 6).',
        h: [['bukhari', 4750, 'Aishas beretning om al-ifk'], ['bukhari', 4900, 'Zayd ibn Arqam om Ibn Ubayys ord']]
    },
    {
        id: 'ahzab', y: 'ca. marts 627', w: 'Shawwal 5 AH', b: 'ca. 627 · Grøftens slag',
        t: 'Grøftens slag (al-Ahzab)', period: 'D',
        d: 'En stor koalition belejrer Medina, som forsvares med en grøft. Belejringen ender uden kamp.',
        v: [{ s: 33, a: [9, 27] }],
        date: 'sandsynlig', link: 'sikker',
        why: 'Versene beskriver selv belejringen. Ibn Ishaq og de fleste sætter slaget til Shawwal 5 AH; Musa ibn Uqba sagde 4 AH. Vers 26–27 handler om Banu Qurayza lige efter.',
        h: [['bukhari', 4106, 'al-Bara: profeten ﷺ graver grøften']]
    },
    {
        id: 'hijab', y: 'ca. 627', w: 'Dhul-Qa\'da 5 AH (nogle: 3 eller 4 AH)', b: 'ca. 627 · hijab-verset',
        t: 'Brylluppet med Zaynab bint Jahsh og hijab-verset', period: 'D',
        d: 'Ved bryllupsmåltidet bliver gæsterne siddende, og verset om at tale med profetens ﷺ hustruer bag et forhæng åbenbares.',
        v: [{ s: 33, a: [53, 53] }],
        date: 'sandsynlig', link: 'sikker',
        why: 'Anas fortæller i Bukhari, at 33:53 kom ved brylluppet med Zaynab bint Jahsh. Året er 5 AH ifølge de fleste, 3 eller 4 AH ifølge andre.',
        h: [['bukhari', 4791, 'Anas om brylluppet og verset']]
    },
    {
        id: 'hudaybiya', y: 'marts 628', w: 'Dhul-Qa\'da 6 AH', b: '628 · Hudaybiyya',
        t: 'Hudaybiyya-traktaten', period: 'D',
        d: 'Muslimerne vil udføre umra, men stoppes. Der sluttes fred med Quraysh. På hjemvejen åbenbares sura al-Fath: "Vi har givet dig en klar sejr".',
        v: [{ s: 48, a: [1, 29] }],
        date: 'sikker', link: 'sikker',
        why: 'Datoen (Dhul-Qa\'da 6 AH) er enig i kilderne. Umar fortæller i Bukhari, at sura al-Fath kom om natten på hjemvejen.',
        h: [['bukhari', 4177, 'Umar: en sura kærere end alt'], ['bukhari', 2731, 'Traktaten ved Hudaybiyya']]
    },
    {
        id: 'hatib', y: 'ca. januar 630', w: 'Lige før Ramadan 8 AH', b: '630 · Hatibs brev',
        t: 'Hatibs brev før Mekkas erobring', period: 'D',
        d: 'Hatib ibn Abi Balta\'a sender et hemmeligt brev til Quraysh om muslimernes planer. Brevet opsnappes, og begyndelsen af sura al-Mumtahina åbenbares.',
        v: [{ s: 60, a: [1, 1] }],
        date: 'sikker', link: 'sikker',
        why: 'Ali fortæller i Bukhari hele hændelsen og at 60:1 kom om den. Den skete lige før erobringen af Mekka, som er sikkert dateret.',
        h: [['bukhari', 4890, 'Ali: brevet og 60:1'], ['bukhari', 4274, 'Ali: brevet opsnappes']]
    },
    {
        id: 'fath', y: 'januar 630', w: 'Ramadan 8 AH', b: '630 · Mekkas erobring',
        t: 'Mekkas erobring', period: 'D',
        d: 'Mekka indtages næsten uden kamp. Afguderne omkring Kaaba knuses, mens profeten ﷺ reciterer: "Sandheden er kommet, og falskheden er forsvundet."',
        v: [{ s: 17, a: [81, 81], om: true, n: 'reciteret (åbenbaret tidligere i Mekka)' }],
        date: 'sikker', link: 'sikker',
        why: 'Datoen er enig i kilderne. Ibn Mas\'ud fortæller i Bukhari, at profeten ﷺ reciterede 17:81, mens han knuste afguderne – verset var åbenbaret tidligere.',
        h: [['bukhari', 4287, 'Ibn Mas\'ud: 360 afguder omkring Kaaba']]
    },
    {
        id: 'hunayn', y: 'jan.–feb. 630', w: 'Shawwal 8 AH', b: '630 · Hunayn',
        t: 'Slaget ved Hunayn', period: 'D',
        d: 'Kort efter erobringen er muslimerne mange og stoler på deres antal – de trænger først tilbage, men sejrer.',
        v: [{ s: 9, a: [25, 26], om: true, n: 'nævner Hunayn ved navn (åbenbaret 9 AH)' }],
        date: 'sikker', link: 'sikker',
        why: 'Hunayn nævnes ved navn i 9:25, og datoen er enig i kilderne. Versene blev formentlig åbenbaret lidt senere sammen med begyndelsen af sura at-Tawba.'
    },
    {
        id: 'tabuk', y: 'okt.–dec. 630', w: 'Rajab 9 AH', b: '630 · Tabuk',
        t: 'Felttoget til Tabuk', period: 'D',
        d: 'Den sidste store ekspedition, i hede og nød. Mange vers i sura at-Tawba handler om dem, der blev hjemme – bl.a. de tre, hvis anger blev accepteret.',
        v: [{ s: 9, a: [117, 118] }, { s: 9, a: [38, 116], c: 'sandsynlig' }, { s: 9, a: [119, 127], c: 'sandsynlig' }],
        date: 'sikker', link: 'sikker',
        why: 'Ka\'b ibn Malik fortæller selv i Bukhari, at 9:117–118 kom om ham og de to andre. At det meste af suraen fra vers 38 handler om Tabuk, er de fleste mufassirun enige om, men afgrænsningen er omtrentlig.',
        h: [['bukhari', 4418, 'Ka\'b ibn Malik om Tabuk']]
    },
    {
        id: 'baraa', y: 'marts 631', w: 'Dhul-Hijja 9 AH', b: '631 · sura Bara\'a bekendtgøres',
        t: 'Abu Bakrs hajj – erklæringen fra sura at-Tawba', period: 'D',
        d: 'Abu Bakr leder hajj. Begyndelsen af sura Bara\'a bekendtgøres i Mina: afgudsdyrkere må ikke længere udføre hajj, og ingen må gå nøgen omkring Kaaba.',
        v: [{ s: 9, a: [1, 28], c: 'sandsynlig' }],
        date: 'sikker', link: 'sikker',
        why: 'Abu Hurayra fortæller i Bukhari, at han var med til at bekendtgøre det på offerdagen. Hvor mange vers der blev læst op, varierer i overleveringerne (fx 30 eller 40), så afgrænsningen er omtrentlig.',
        h: [['bukhari', 4655, 'Abu Hurayra: bekendtgørelsen i Mina']]
    },
    {
        id: 'arafa', y: '6.–7. marts 632 (fredag)', w: '9. Dhul-Hijja 10 AH', b: '632 · Arafat-dagen',
        t: 'Afskedspilgrimsrejsen: "I dag har Jeg fuldendt jeres religion"', period: 'D',
        d: 'Under profetens ﷺ eneste hajj åbenbares 5:3 på Arafat. Dagen efter holder han prædikenen om de hellige dage, byer og liv.',
        v: [{ s: 5, a: [3, 3] }],
        date: 'sikker', link: 'sikker',
        why: 'Umar fortæller i Bukhari, at 5:3 kom på Arafat-dagen, en fredag, under afskedspilgrimsrejsen. Det er en af de bedst daterede åbenbaringer.',
        h: [['bukhari', 45, 'Umar: verset kom på Arafat, en fredag'], ['bukhari', 1739, 'Ibn Abbas: prædikenen på offerdagen']]
    },
    {
        id: 'akhir', y: '632', w: 'De sidste uger – omstridt', b: '632 · blandt de sidste vers',
        t: 'De sidste vers', period: 'D',
        d: 'Hvilket vers der kom sidst, er de lærde uenige om. Ibn Abbas siger versene om renter (2:278–281, ofte 2:281: "Og frygt en dag, hvor I føres tilbage til Allah"). al-Bara siger 4:176.',
        v: [{ s: 2, a: [278, 281], c: 'omstridt' }, { s: 4, a: [176, 176], c: 'omstridt' }, { s: 110, a: [1, 3], c: 'omstridt', n: 'Ibn Abbas: et tegn på, at profetens ﷺ død var nær' }],
        date: 'omstridt', link: 'omstridt',
        why: 'Flere sahih-overleveringer peger på forskellige vers, fordi hver sahabi fortæller det sidste, han selv hørte. Hvor lang tid før profetens ﷺ død de kom, nævnes også forskelligt (fra få dage til ca. 80 dage).',
        src: ['as-Suyuti, al-Itqan fi \'Ulum al-Qur\'an (kapitlet om de sidste vers)'],
        h: [['bukhari', 4544, 'Ibn Abbas: det sidste var verset om renter'], ['bukhari', 4605, 'al-Bara: det sidste var 4:176'], ['bukhari', 4970, 'Ibn Abbas om sura an-Nasr']]
    },
    {
        id: 'wafat', y: 'juni 632', w: 'Rabi\' al-Awwal 11 AH', b: '',
        t: 'Profeten ﷺ dør i Medina, 63 år gammel', period: 'D',
        d: 'Åbenbaringen slutter. Profeten ﷺ dør i Aishas hus en mandag.',
        v: [],
        date: 'sikker', link: 'sikker',
        why: 'Måned og år er sikre, og at det var en mandag, står i sahih hadith. Dagen er omstridt: 12. Rabi\' al-Awwal er mest udbredt, men 1. og 2. nævnes også.',
        h: [['bukhari', 4466, 'Aisha: han døde 63 år gammel']]
    }
];
