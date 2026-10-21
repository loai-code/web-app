# Koran-memorering som web-app (iPhone, Android og PC)

Web-appen er den samme app som Android-versionen og bygges automatisk ud fra den.
Den lægges gratis på **GitHub Pages**, og på iPhone installeres den fra Safari med
"Føj til hjemmeskærm". Derefter ligger den som en app med eget ikon, i fuld skærm og
virker også uden internet (det der ikke skal hentes fra nettet).

```
web-app/
├── docs/          ← den færdige web-app (det GitHub Pages viser) – rør ikke ved den
├── web/           ← web-filer: config.js (proxy-adresse), web.js, web.css, ikoner, service worker
├── proxy/         ← worker.js: proxy til Cloudflare (trin 2)
└── build.py       ← bygger docs/ ud fra Android-appen
```

---

## Trin 1 – Læg web-appen på GitHub Pages (ca. 5 minutter)

1. Åbn **GitHub Desktop** → *File* → *Add local repository…* → vælg mappen
   `Downloads\QuranMemoriseApp\web-app` → *Add repository*.
2. Tryk **Publish repository** (øverst).
   - Navn: fx `koran-app`
   - **Fjern fluebenet** ved *Keep this code private* (GitHub Pages er kun gratis for offentlige projekter;
     der ligger ingen personlige data i koden – dine noter gemmes kun på telefonen).
   - Tryk *Publish repository*.
3. Gå til projektet på github.com (*Repository* → *View on GitHub*) → **Settings** → **Pages**:
   - *Source*: **Deploy from a branch**
   - *Branch*: **main** og mappen **/docs** → **Save**
4. Efter 1–2 minutter står adressen øverst på siden, fx
   **`https://DIT-BRUGERNAVN.github.io/koran-app/`**

Nu virker appen – undtagen tafsir fra altafsir.com, klassisk sharh fra Shamela og Bukhari-oplæsningen,
som kræver proxyen i trin 2.

## Trin 2 – Proxy til tafsir, sharh og Bukhari-lyd (gratis, ca. 5 minutter)

Nogle hjemmesider tillader ikke, at en anden hjemmeside henter deres indhold. Android-appen
henter dem direkte, men web-appen skal have en lille mellemstation. Cloudflare Workers er gratis
(100.000 kald om dagen – langt mere end du bruger).

1. Opret en gratis konto på **https://dash.cloudflare.com/sign-up**.
2. Vælg **Workers & Pages** (i menuen til venstre, evt. under *Compute*) → **Create** →
   **Start with Hello World!** (eller *Create Worker*).
3. Navn: `koran-proxy` → **Deploy**.
4. Tryk **Edit code**. Slet alt i editoren, og indsæt **hele** indholdet af `web-app/proxy/worker.js`.
   Tryk **Deploy**.
5. Kopiér adressen, fx `https://koran-proxy.DIT-NAVN.workers.dev`. Åbner du den i browseren,
   skal der stå *"Koran-memorering proxy kører ✓"*.
6. Åbn `web-app/web/config.js` og indsæt adressen:
   ```js
   window.APP_CONFIG = {
       proxy: 'https://koran-proxy.DIT-NAVN.workers.dev'
   };
   ```
7. Byg og udgiv (se "Opdatering" herunder).

## Trin 3 – Installér på iPhone

1. Åbn adressen fra trin 1 i **Safari** (det skal være Safari).
2. Tryk på **Del**-knappen (firkanten med pilen op).
3. Vælg **Føj til hjemmeskærm** → **Tilføj**.
4. Åbn appen fra ikonet. Første gang gemmes appen på telefonen, så den starter hurtigt
   og virker offline.

**Android:** åbn adressen i Chrome → menuen ⋮ → **Installér app** (eller *Føj til startskærm*).

---

## Opdatering (når Android-appen er ændret, eller proxy-adressen er sat)

1. Kør i mappen `web-app`:
   ```
   python build.py
   ```
2. I GitHub Desktop: skriv en kort beskrivelse → **Commit to main** → **Push origin**.
3. Efter 1–2 minutter viser appen på telefonen beskeden *"Der er en ny version"* → tryk **Opdatér**.

## Forskelle fra Android-appen

| | Web-app | Android-app (APK) |
|---|---|---|
| Ordbøger | Åbner i Safari/Chrome | Appens egen browser |
| Oplæsning af hadith | Telefonens/browserens stemme, ellers Google | Telefonens stemme, ellers Google |
| Backup af noter | Del-menuen → "Gem i Filer" | Download-mappen |
| Qibla | Spørger om adgang til kompasset (tryk på kompasset) | Automatisk |
| Tafsir, sharh, Bukhari-lyd | Via proxyen (trin 2) | Direkte |

Dine noter gemmes på den enhed, du bruger – de følger ikke automatisk med mellem
iPhone og Android. Brug *Noter → ⋯ → Gem backup på telefonen* og *Gendan backup – find filen på telefonen* til at flytte dem.
