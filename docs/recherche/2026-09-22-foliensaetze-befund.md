# Befund 2b: Foliensätze einlesen, Messung und Prototyp

Stand: 2026-09-22 · Node v24.13.1 (V8 13.6), npm 11.8.0, Windows 11
Arbeitsplatz: `C:/Users/dno/AppData/Local/Temp/claude/kb2b/`, Pakete nur unter `kb2b/proto/`.
Material nur gelesen, an Ort und Stelle. Hier stehen nur Zahlen, Seitennummern, Dateinamen und kurze Abschnittstitel.

---

## 1. pdfjs-dist

**Version:** `pdfjs-dist@6.3.289` (latest, veröffentlicht 2026-08-29; monatlicher Takt, 6.0 kam 2026-05-30).
**Lizenz:** Apache-2.0. Mitgeliefert: JBIG2-Decoder (PDFium, BSD-3) und OpenJPEG (BSD-2) als WASM, qcms (MIT),
Foxit-Standardschriften (BSD-artig, PDFium), Liberation Sans (GPLv2 mit Font-Ausnahme; nur Laufzeitdaten, nichts davon landet im Bau).
`engines.node: ">=22.13.0 || >=24"`, kein `exports`-Feld, also sind Unterpfade wie `pdfjs-dist/legacy/build/pdf.mjs` importierbar.

### Installation (Protokolle: `install-voll.log`, `install-ohne-optional.log`)

| | `npm install pdfjs-dist` | `npm install pdfjs-dist --omit=optional` |
|---|---|---|
| Ausgabe | `added 3 packages, and audited 4 packages in 7s`, `found 0 vulnerabilities` | `added 1 package, and audited 2 packages in 9s` |
| Pakete | pdfjs-dist, @napi-rs/canvas 1.0.9, @napi-rs/canvas-win32-x64-msvc 1.0.9 | pdfjs-dist |
| Größe | **73,2 MB** (pdfjs-dist 34,8 MB in 554 Dateien, canvas 0,13 MB, win32-Binary 38,3 MB) | **34,8 MB** |
| Lockfile | – | führt @napi-rs/canvas trotzdem (als optional); ein späteres `npm ci` ohne `--omit` holt es |

- `@napi-rs/canvas` ist eine **optionale** Abhängigkeit von pdfjs-dist (`^1.0.0`). Sie kommt **vorgebaut**:
  das plattformspezifische Unterpaket `@napi-rs/canvas-win32-x64-msvc` bringt `skia.win32-x64-msvc.node`
  (PE32+-DLL, 27,4 MB) und `icudtl.dat` (10,9 MB) mit. **Kein Kompilieren**, keine install/postinstall-Skripte
  in allen drei Paketen (geprüft in den `package.json`), kein node-gyp. Lizenz MIT.
- Einordnung fürs Repo: Dort liegen schon 15 optionale Pakete, darunter vorgebaute Binaries für Astro-Compiler,
  esbuild, rolldown, lightningcss und sharp. **`--omit=optional` (oder `omit=optional` in `.npmrc`) ist fürs
  Repo keine Option**: Es würfe diese mit hinaus, und Astro baut nicht mehr. Den Canvas einzeln ausschließen
  ginge nur über einen `overrides`-Kniff mit Leerpaket. Das lohnt nicht, siehe unten.

### Läuft die Textextraktion ohne @napi-rs/canvas?

Ja. Alle neun Sätze liefern ohne Canvas **dieselben Zahlen**: 110 364 Zeichen, gleiche Item-Zahl je Datei,
gleiche Bild-Operatoren je Seite (`rauch-*.log`). Der Canvas wird nur zum Rendern gebraucht (Polyfills für
`DOMMatrix` und `Path2D`, `createCanvas`). Einzige Stelle im Worker, die `DOMMatrix` braucht: das Kompilieren
von Type3-Glyphen aus Bildmasken. In den neun Sätzen kam sie nicht vor.
Ein Messfehler, der beinahe durchgerutscht wäre: Ein verschachteltes Projekt ohne Canvas unter `proto/`
findet `@napi-rs/canvas` trotzdem, weil Node beim Auflösen im übergeordneten `node_modules` weitersucht. Gemessen
wurde deshalb mit vorübergehend beiseitegelegtem `proto/node_modules/@napi-rs`.

### Einstieg unter Node 24

- **Nur der legacy-Build läuft:** `pdfjs-dist/legacy/build/pdf.mjs`. Der moderne Build (`build/pdf.mjs`, das ist
  auch `main` des Pakets, also das, was `import 'pdfjs-dist'` liefert) meldet `Please use the legacy build in Node.js
  environments` und scheitert an **allen neun** Dateien mit `hashOriginal.toHex is not a function`:
  `Uint8Array.prototype.toHex` fehlt in V8 13.6 (gemessen: `typeof … === 'undefined'`).
- **Worker:** nichts einstellen. `GlobalWorkerOptions.workerSrc` steht unter Node schon auf `./pdf.worker.mjs`;
  pdf.js richtet einen „fake worker“ im selben Thread ein (lädt `pdf.worker.mjs` per dynamischem Import).
  Die zugehörige Meldung `Setting up fake worker` kommt nur bei `verbosity ≥ WARNINGS` und kam in keinem Lauf.
- **API-Änderung gegenüber älteren Beispielen:** `PDFDocumentProxy.destroy()` gibt es in 6.3 nicht mehr;
  aufgeräumt wird mit `await ladeaufgabe.destroy()` (die von `getDocument` zurückgegebene Aufgabe).

### Meldungen auf der Konsole und wie man sie abstellt

| Meldung (Anzahl über alle neun Sätze) | Ursache | sauber abstellen |
|---|---|---|
| `Ensure that the standardFontDataUrl API parameter is provided` (35) | nicht eingebettete Standardschriften | `standardFontDataUrl` auf `pdfjs-dist/standard_fonts/` |
| `#instantiateWasm: … wasmUrl …` (4), `Cannot find package 'nulljbig2_nowasm_fallback.js'` (4), `Unable to decode image "img_p…": JBig2 failed to initialize` (18) | JBIG2-Bilder ohne WASM-Decoder | `wasmUrl` auf `pdfjs-dist/wasm/` |
| (vorsorglich) CMap- und ICC-Meldungen | CID-Schriften, Farbprofile | `cMapUrl` auf `cmaps/`, `iccUrl` auf `iccs/` |
| `Cannot load "@napi-rs/canvas"`, `Cannot polyfill DOMMatrix`, `Cannot polyfill Path2D` (je 1, **beim Import**) | nur ohne Canvas | **nicht** über `verbosity`: Sie kommen beim Laden des Moduls, bevor `getDocument` die Stufe setzt. Entweder Canvas installiert lassen, oder `console.warn` nur für die Dauer des `import()` durch einen Filter auf genau diese drei Muster ersetzen (geprüft: dann 0 Meldungen) |

- Mit allen vier Datenpfaden gesetzt: **0 Meldungen** über alle neun Sätze, auch bei `verbosity` auf Standard.
  Die Bildzahlen ändern sich dadurch nicht: Auch ein JBIG2-Bild, das nicht dekodiert werden kann, bleibt als
  `paintImageXObject` in der Operatorliste.
- **Falle unter Windows:** Die Datenpfade müssen auf `/` enden. `path.join(...) + path.sep` endet auf `\` und wird mit
  `Invalid factory url: "…\cmaps\" must include trailing slash` abgewiesen. Richtig:
  `path.join(basis, 'cmaps').replaceAll(path.sep, '/') + '/'`, als Pfad, nicht als `file://`-URL (pdf.js liest
  unter Node mit `fs.readFile`).
- `verbosity: VerbosityLevel.ERRORS` (0) zusätzlich, damit beschädigte PDFs die Konsole nicht fluten. Die
  Ursachen stellen aber die Datenpfade ab, nicht die Stufe.
- Bild-Operatoren in `OPS` (6.3.289): `paintImageXObject`=85, `paintInlineImageXObject`=86,
  `paintImageMaskXObject`=83, `paintImageMaskXObjectGroup`=84, `paintInlineImageXObjectGroup`=87,
  `paintImageXObjectRepeat`=88, `paintImageMaskXObjectRepeat`=89, `paintSolidColorImageMask`=90, dazu
  `beginInlineImage`/`beginImageData`/`endInlineImage` (63–65). In den neun Sätzen kommt nur `paintImageXObject` vor.

**Empfehlung:** Canvas nicht bekämpfen. Er ist vorgebaut, kompiliert nichts und gleicht den Binaries, die das Repo
schon hat. Kosten: 38 MB unter `node_modules`, nichts im Bau. Import immer aus `pdfjs-dist/legacy/build/pdf.mjs`,
die vier Datenpfade setzen, `verbosity: 0`. Den Filter für die drei Importmeldungen trotzdem einbauen: `npm ci --omit=optional`
auf einem anderen Rechner soll keine Meldungen ergeben, die wie ein Fehler aussehen.

---

## 2. Prototyp `dokument.mjs` (Datei `proto/dokument.mjs`)

**Aufbau.** Zwei Teile mit scharfer Grenze: `liesSeiten(bytes, pdfjs)` ist der einzige Teil mit pdf.js
(Zeilen, Format, Bilder, Lesezeichen, Vektorgitter); `bereinige`/`bereinigeQuelle` sind rein (Beiwerk,
Silbentrennung, `nurBild`, `tabellenverdacht`, Art, Abbruch). Alle Regeln stehen in `REGELN` und lassen sich
je Lauf umstellen; `varianten.mjs` und `varianten2.mjs` vergleichen sie über alle neun Sätze, ohne Text auszugeben.

**Zeilen.** Elemente nach Grundlinie gruppiert (|Δy| ≤ 0,3 × kleinere Schriftgröße), nach x sortiert,
getrennt an Lücken > 2 × Schriftgröße (zwei Textfelder auf gleicher Höhe sind zwei Zeilen), Leerzeichen-Elemente
verworfen (ihre Breite zeigt sich als Lücke), Wortabstand ab 0,15 × Schriftgröße. Schriftgröße je Zeile =
größte der Elemente (`hypot(c, d)` der Textmatrix). Gedrehte Elemente (0–8 je Satz) als eigene Zeilen.
Befund am Material: pdf.js liefert Elemente in **Stromreihenfolge, nicht Lesereihenfolge**. Auf der Agendafolie
von M7 kommt der Titel nach der Liste. Ohne Sortierung nach y wäre „erste Zeile = Titel“ falsch.

**Seitenformat.** `getViewport({ scale: 1 })` berücksichtigt `/Rotate`. Alle 199 Seiten der neun Sätze:
841,9 × 595,3 pt (A4 quer), `rotate 0`, `userUnit 1`.

**Bilder.** Alle Bild-Operatoren gezählt (Liste in Abschnitt 1); in den neun Sätzen kommt nur `paintImageXObject`
vor. **Jede der 199 Seiten trägt mindestens ein Bild**: das Logo im Briefkopf, eine einzige Platzierung
(84 × 28 pt bei x 712, y 16) in allen Sätzen. „≥ 1 Bild“ trennt damit nichts. Der Prototyp erkennt Bild-Beiwerk
wie Text-Beiwerk über Wiederkehr der Platzierung (Größe und Lage aus der CTM, auf 4 pt gerundet) und zählt
`echteBilder` ohne das Logo. Für `nurBild` ändert das an diesem Material nichts, macht „Bild vorhanden“ aber
aussagekräftig: In M7 tragen 16 von 35 Folien ein echtes Bild.

**Vektorgitter** (zusätzlich, aus derselben Operatorliste, kein Text): achsparallele Linien und Flächen in
Seitenkoordinaten (CTM über save/restore/transform/Form-XObjects verfolgt). Das ist die einzige inhaltsfreie Gegenprobe für
Tabellen, siehe Abschnitt 4.

**Laufzeit** (Text / Operatorliste, ms): M1 544/227 · M2 882/628 · M3 878/782 · M4 1950/556 · M5 430/376 ·
M6 268/14 · M7 1394/948 · M9 265/150 · M10 324/17. Gesamt rund 10,6 s für 199 Seiten, davon rund 35 % die
Operatorliste. Sie dekodiert die Bilder mit, abschalten lässt sich das nicht: `maxImageSize` würde die Operatoren entfernen.

### Drei Befunde an den Regeln, die schon hier auffallen (gemessen, Details in Abschnitt 4)

1. **„Ziffern zu #“ muss „Ziffern*folge* zu #“ heißen.** Wörtlich je Ziffer normalisiert, sind „Folie 7“ und
   „Folie 17“ verschiedene Zeilen (`Folie #` / `Folie ##`). In jedem Satz mit mehr als 9 Folien erreicht dann keine
   der beiden 80 %, und die Foliennummer bleibt im Nutztext stehen (M1: 39 % / 61 %, M5: 29 % / 71 %, M7: 26 % / 74 %).
   Mit `\d+ → #` ist sie in allen Sätzen Beiwerk.
2. **Die 80-%-Regel bricht bei kleinen Dateien.** M6 hat **eine** Seite: Jede Zeile kommt auf 100 % der Seiten vor,
   der ganze Text ist Beiwerk, Nutztext 0, und der Satz **bricht als „Scan“ ab**. M10 (2 Seiten) übersteht es nur,
   weil zufällig nur der Briefkopf auf beiden Seiten steht. Vorschlag, gemessen: Wiederkehr erst ab 5 Seiten, kleinere
   Dateien übernehmen das Beiwerk, das in den anderen Dateien **derselben Quelle** erkannt wurde (`fremdesBeiwerk`).
   M6 verliert damit 36,1 % (den Briefkopf), M10 19,0 %. Nur „ab 5 Seiten, sonst gar nicht“ ließe den Briefkopf in
   M6/M10 stehen, und M10 kippte mit Median 739,5 zur Art `buch`.
3. **Silbentrennung** wird zusammengezogen, wenn die Zeile auf Buchstabe + Trennstrich endet und die nächste Zeile
   desselben Textfelds (direkt darunter, x-Bereich überlappt) klein beginnt, nicht aber vor einem Bindewort
   („Kosten- und …“). Am Material: 8 Zusammenziehungen (M2 1, M4 2, M7 4, M9 1), 0 Ergänzungsstriche.
   Reihenfolge wichtig: erst Beiwerk entfernen, dann trennen, denn der Adressblock im Briefkopf endet selbst auf „-“.

---

## 3. Prototyp `gliederung/folien.mjs` (Datei `proto/gliederung/folien.mjs`)

Rein: bereinigte Seiten hinein, Abschnitte heraus, kein pdf.js, keine Datei. Umgesetzt wie im Spec, jede
Abweichung als Schalter in `FOLIEN_REGELN`, damit „wörtlich“ und „Vorschlag“ nebeneinander messbar bleiben:

- **Folientitel** = oberste Nutzzeile (nach Beiwerk, nach y sortiert) plus direkt darunter folgende Zeilen gleicher
  Schriftgröße (zweizeilige Titel auf Trennfolien, M7 S. 28 mit 35,3 pt), höchstens drei.
- **bis 20 Folien** ein Abschnitt (`einzeln`; der Wert fehlt in der `gliederung`-Aufzählung des Specs).
- **Agenda**: unter den ersten fünf Folien die mit den meisten Zeilen (ohne ihren eigenen Titel), die in
  Agendareihenfolge als Titel späterer Folien wiederkehren; angenommen ab 2 Treffern und ≥ 50 % der Zeilen.
  Abgleich wörtlich: gleich oder Präfix (ab 8 Zeichen), nach Kleinschreibung, ohne Nummerierung, Anführungszeichen,
  Satzzeichen am Ende. **Vorschlag `praefixStamm`**: dasselbe über grobe Wortstämme (Plural- und Genitivendungen ab).
  Gemessen: M7 „Begriffsbestimmungen“ gegen Folientitel „Begriffsbestimmung …“ trifft nur so (Agenda 2/4 → 3/4).
  Eine reine Wortanteil-Variante (`stamm`) wurde verworfen: Sie verliert M2, weil dort kurze Titel („Fallbeispiel 1“) auf
  lange Agendazeilen treffen. M5 hat eine Agendafolie, deren vier Zeilen thematisch sind und als Folientitel
  nicht wiederkehren (1/4); dort greift die Regel zu Recht nicht.
- **Titelläufe**: wörtlich jede Zeile, die unverändert auf der Nachbarfolie steht (die oberste solche je Folie).
  **Vorschlag `laufSchluessel: titel`**: nur der Folientitel zählt. Gemessen: Wörtlich werden Rumpfzeilen zu
  Abschnittstiteln. In M1 benennt eine Aufzählungszeile (Folien 8–9) den Abschnitt 1–14, in M4 werden drei Zeilen,
  die kein Folientitel sind, zu Grenzen, in M7 (mit wörtlichem Beiwerk) ein einzelnes Wort „oder“ (Folien 32–33).
- **Folien vor der ersten Grenze**: Das Spec sagt nichts. Angehängt an den ersten Abschnitt ergibt M5 einen Abschnitt
  1–24, weil der erste Titellauf erst auf S. 20 beginnt. **Vorschlag `vorlaufEigen`**: mehr als drei solche Folien
  bilden einen eigenen Abschnitt mit Rückfalltitel; Titel- und Agendafolie (1–2) bleiben beim ersten.
- **gleichmäßig** zu höchstens 15 (`ceil(N/15)` Abschnitte, Rest vorn verteilt). An den neun Sätzen nie gebraucht,
  an den Fixtures geprüft (Abschnitt 7).

**Id-Schema (Vorschlag):** `‹kürzel›-‹nn›-‹slug›`, z. B. `m07-03-risikomanagement`.
- `kürzel`: Buchstaben vor der ersten Zahl des Dateinamens plus die Zahl, zweistellig (`M7 …` → `m07`, `M10 …` → `m10`).
  Passt ein Dateiname nicht auf das Muster oder kollidieren zwei Kürzel, bekommen **alle** Dateien `d01`, `d02`, …
  in natürlicher Reihenfolge.
- `nn`: laufende Nummer, zweistellig (breiter nur ab 100 Abschnitten je Datei). Einstellig wie im Spec-Beispiel
  (`m07-2-…`) sortierte `m07-10` vor `m07-2`.
- `slug`: aus dem Titel, Umlaute ausgeschrieben, höchstens 4 Wörter und 32 Zeichen, kein Füllwort am Ende;
  beim Rückfalltitel `folien-a-b`.
- Geprüft an allen 22 (Vorschlag) bzw. 26 (wörtlich) Abschnitten: Id-Muster `^[a-z0-9]+(-[a-z0-9]+)*$` erfüllt,
  Sortierung nach Codepunkten = Reihenfolge Datei/Abschnitt, längste Id 38 Zeichen, jede Seite jeder Datei genau
  einmal. **`pruefeLehrplan` aus `src/lib/lehrplan.ts`** (unverändert aus dem Repo geladen, Node-Type-Stripping):
  beide Lehrpläne **gültig**. Gegenprobe mit doppelter Id und berührenden Bereichen (`[1,5]`, `[5,9]`): beide Mängel
  gemeldet.
- Offen: Der Slug hängt am Titel. Ändert der Verfasser eine Agendazeile, ändert sich beim Neueinlesen die Id, und
  der Status des Abschnitts (`lektion`, `abgelehnt`) findet seinen Abschnitt nicht mehr. Ohne Slug (`m07-03`) wäre die Id
  stabil gegen Titeländerungen, aber nicht gegen verschobene Grenzen. Das Neueinlesen braucht so oder so eine Zuordnung
  über Seitenbereiche.

---

## 4. Lauf über alle neun Sätze (`proto/lauf.mjs`, Tabellen auch in `lauf-tabelle.md`)

Regeln **Vorschlag** = Spec plus die gemessenen Korrekturen: Ziffernfolge → `#`; Wiederkehr ab 5 Seiten, kleinere
Dateien mit dem Beiwerk der Quelle; Beiwerk nur an fester Lage im Randstreifen (Begründung in Abschnitt 7; an den neun
Sätzen ergebnisgleich, geprüft per `diff`); `nurBild` mit echten Bildern (ohne Logo); Tabellenverdacht = Liniengitter
(≥ 5 waagrechte und ≥ 5 senkrechte Vektorlinien) **oder** ≥ 3 Zeilen nur aus Zahlen/Daten/Einheiten; Gliederung
`praefixStamm`, Titellauf über den Folientitel, eigener Vorlauf. Laufzeit = Datei lesen + pdf.js (Text und
Operatorliste), zweiter Lauf; die reine Auswertung (Beiwerk bis Gliederung) braucht für alle neun zusammen 78 ms.

| Datei | Seiten | Ausrichtung | Median Nutztext | Beiwerk | nurBild | tabellenverdacht | Lesezeichen | Agendafolie | Weg | Laufzeit |
|---|---|---|---|---|---|---|---|---|---|---|
| M1 | 23 | quer | 576 | 26,3 % | – | – | nein | – | titellaeufe | 0,9 s |
| M2 | 29 | quer | 64 | 57,2 % | 4, 5, 6, 9, 11–15 | 16 | nein | S. 2 (4/5) | agenda | 2,0 s |
| M3 | 20 | quer | 233,5 | 42,8 % | – | – | nein | – | einzeln | 1,7 s |
| M4 | 45 | quer | 260 | 33,6 % | – | 8, 10, 12, 14, 16, 17, 19, 26, 28, 32, 37, 39, 43, 44 | nein | – | titellaeufe | 2,6 s |
| M5 | 31 | quer | 158 | 43,8 % | 31 | 9 | nein | – | titellaeufe | 0,8 s |
| M6 | 1 | quer | 360 | 36,1 % (Beiwerk der Quelle) | – | 1 | nein | – | einzeln | 0,3 s |
| M7 | 35 | quer | 250 | 33,9 % | 16, 19–23 | 12, 17, 26 | nein | S. 2 (3/4) | agenda | 1,9 s |
| M9 | 13 | quer | 216 | 33,0 % | 13 | 5, 7 | nein | – | einzeln | 0,5 s |
| M10 | 2 | quer | 599,5 | 19,0 % (Beiwerk der Quelle) | – | 2 | nein | – | einzeln | 0,4 s |

Median = Zeichen ohne Leerraum je Seite nach Beiwerk. Beiwerk-Anteil = entfernte Zeichen / alle Zeichen, ohne
Leerraum (mit je einem Leerzeichen zwischen Wörtern: M7 34,7 %, M5 43,9 %, M9 33,7 %). Art: alle neun `folien`.
Kein Abbruch. Lesezeichen: 0 von 9 Dateien (Spec: 0 von 5). Erster Lauf: M3 einmal 7,7 s (Ausreißer beim kalten
Lesen), sonst dieselben Größenordnungen; alle Zahlen außer der Laufzeit in beiden Läufen identisch.

**Abschnitte (Vorschlag), 22 insgesamt:**

| Id | Seiten | Titel |
|---|---|---|
| `m01-01-folien-1-14` | 1–14 | M1 PM und Leistungsbilder 26, Folien 1–14 |
| `m01-02-ergaenzende-pm-leistungen-gem` | 15–18 | Ergänzende PM- Leistungen gem. AHO Heft 19 Jan. 2018 |
| `m01-03-leistungen-building-information` | 19–23 | Leistungen Building Information Modeling |
| `m02-01-fallbeispiel-1-massnahmen` | 1–7 | Fallbeispiel 1 Maßnahmen der Bestandsaufnahme und Restrukturierung |
| `m02-02-fallbeispiel-2` | 8–19 | Fallbeispiel 2 Bautenstandsermittlung bei komplexen Bauvorhaben |
| `m02-03-fallbeispiel-3-beurteilung` | 20–26 | Fallbeispiel 3 Beurteilung von Prozessabläufen und Technologien |
| `m02-04-fallbeispiel-4-claims` | 27–29 | Fallbeispiel 4 Claims im Honorarbereich |
| `m03-01-folien-1-20` | 1–20 | M3 PM Stakeholderanalyse 26, Folien 1–20 |
| `m04-01-folien-1-5` | 1–5 | M4 PM PSP 26, Folien 1–5 |
| `m04-02-grundlagen-grundsaetze` | 6–9 | Grundlagen & Grundsätze |
| `m04-03-beispiel-fuer-typ` | 10–24 | Beispiel für typ. objektorientierte Gliederung eines Hochbauprojektes |
| `m04-04-aufbauorganisation` | 25–34 | Aufbauorganisation |
| `m04-05-hilfsmittel` | 35–45 | Hilfsmittel für die Projektkoordination |
| `m05-01-folien-1-19` | 1–19 | M5 PM Kommunikation 26, Folien 1–19 |
| `m05-02-projektkommunikation` | 20–24 | „Projektkommunikation“ |
| `m05-03-wie-organisieren` | 25–31 | Wie organisieren wir uns selbst? |
| `m06-01-folien-1-1` | 1 | M6 Kostenschätzung Sportcenter 26, Folien 1–1 |
| `m07-01-begriffsbestimmungen` | 1–5 | Begriffsbestimmungen |
| `m07-02-prozess-des-risikomanagements` | 6–26 | Prozess des Risikomanagements |
| `m07-03-risikomanagement` | 27–35 | Risikomanagement und Vertragswesen |
| `m09-01-folien-1-13` | 1–13 | M9 Leistungsstandsmessung 26, Folien 1–13 |
| `m10-01-folien-1-2` | 1–2 | M10 Steuerungsmöglichkeiten 26, Folien 1–2 |

**Dieselben neun Sätze mit den Spec-Regeln wörtlich:** M6 **bricht als „Scan“ ab** (1 Seite, 100 % Beiwerk, Median 0).
M2 findet seine Agenda nicht mehr (6 Titelläufe statt 4 Fallbeispiele), M7 geht über Titelläufe (1–12, 13–31, 32–35,
der letzte heißt „oder“), M5 1–24/25–31, M4 8 Abschnitte, M1 mit einer Aufzählungszeile als Abschnittstitel.
Beiwerk: M1 25,4 · M2 55,3 · M3 41,5 · M4 33,4 · M5 42,3 · M7 32,7 · M9 32,0 · M10 25,5 %. `nurBild` M2 nur 4, 5, 6, 9.
Tabellenverdacht: 32 Seiten, davon M4 15. Schema gültig (26 Abschnitte).

### Vergleich mit den Erwartungen des Specs

| Erwartung | Vorschlag | wörtlich | Befund |
|---|---|---|---|
| Beiwerk M5 ≈ 44 % | 43,8 % | 42,3 % | trifft |
| Beiwerk M7 ≈ 36 % | 33,9 % | 32,7 % | 2 Punkte darunter; die Schätzung kam aus einer anderen Extraktion. Alle Briefkopfzeilen sind erkannt (je 100 % der Seiten), es fehlt keine |
| Beiwerk M9 ≈ 33 % | 33,0 % | 32,0 % | trifft |
| kein Abbruch als Scan | kein Abbruch | **M6 bricht ab** | Ursache 80-%-Regel bei 1 Seite, siehe Abschnitt 2 |
| M7: 7 von 35 nur Bild | **6** (16, 19–23) | 6 | S. 25 fehlt: einzige Nutzzeile ist eine Bildunterschrift mit **genau 20 Zeichen** unter vier echten Bildern. `< 20` verfehlt sie um ein Zeichen |
| M7: 2 Tabellenfolien | 12, 17, 26 | 8, 17, 31 (mit Ziffernfolge: 8, 10, 17, 31) | Vektorgitter allein trifft genau **12 und 17**, siehe unten |
| M7 mehrere Abschnitte | 3 | 3 | beide, aber wörtlich an falschen Grenzen (Abschnitt 5) |
| M10 und M6 je einer | ja | ja (M6 aber Abbruch) | – |

**Warum die Tabellenregel des Specs danebenliegt (gemessen).** Das Spec hat die Regel an einer Extraktion geeicht, in der
jede Tabellenzelle eine eigene Zeile ist. Der Prototyp setzt Zeilen aus der Lage zusammen. Tabellenzeilen kommen damit als
Zeilen aus mehreren Wörtern heraus, und Folien mit vielen Einwortbeschriftungen (Diagramme, Matrizen) überschreiten die
60 %. In M7 heißt das: S. 12, die dichteste Tabelle (3 374 Zeichen, 174 Zeilen, 26 reine Zahlenzeilen, 29 von 50 Reihen
mehrspaltig, Liniengitter 23 × 23), liegt bei 51 % und wird **nicht** erkannt. S. 8, 10 und 31 (Einwortzeilen, keine
Zahlen) werden dagegen erkannt. Die inhaltsfreie Gegenprobe über die Vektorgrafik: Nur S. 12 (23 waagrechte ×
23 senkrechte Linien) und S. 17 (9 × 19) tragen ein Liniengitter; S. 17 findet auch die Spec-Regel. Zu ändern:
Tabellenverdacht aus **Liniengitter (≥ 5 × ≥ 5) oder ≥ 3 reinen Zahlenzeilen**. Ergibt in M7 12, 17, 26 (S. 26: 3 Zahlenzeilen,
6 senkrechte Linien) und erfasst M6, dessen Aufgabe laut Spec im Bild steckt (Liniengitter allein fände M6 nicht).
Kosten: M4 (Projektstrukturpläne, Kästchen mit Verbindungslinien) meldet 14 Seiten, die wörtliche Regel 15, teils andere.
Diagramme lösen beide Regeln aus. Für den Compiler ist das richtig, denn der Text eines Strukturplans trägt die Hierarchie
nicht. Auf der Seite „2 Tabellen zerfallen“ als Zählung wäre für M4 aber irreführend. Offen: Kennzeichen umbenennen („Struktur
nur im Bild“) oder Diagramm und Tabelle trennen.

**`nurBild`, gemessen je Schwelle** (echte Bilder): `< 20` → M7 6; `< 21` → M7 7, sonst unverändert; `< 25` → dazu M5 3, 30;
`< 30` → dazu M3 15. Vorschlag statt einer Zahl, die auf eine Folie passt: **echtes Bild und (Nutztext < 20 Zeichen oder genau
eine Zeile unter 40 Zeichen)**, also Bild mit Bildunterschrift. Ergibt M7 genau 7 (16, 19–23, 25), dazu M3 15, M5 3, 30 (je eine
Zeile neben einem Bild). Mit „eine Zeile unter 60“ käme M7 S. 14 dazu (Titel über zwei Fotos). Die Tabelle oben zeigt noch
die Spec-Schwelle `< 20`.

**Weitere Befunde am Lauf**
- **Art-Erkennung wackelt je Datei:** M10 liegt mit Median 599,5 einen halben Punkt unter der Schwelle 600, M1 bei 576.
  Ohne das Beiwerk der Quelle käme M10 auf 739,5 und hieße `buch`. Über alle 199 Seiten der Quelle ist der Median 242.
  Vorschlag: Art **je Quelle** entscheiden, nicht je Datei.
- **Beiwerk-Warnung bei 60 %** (Spec) läge knapp über M2 (57,2 %), einem Satz mit vielen Bildfolien, an dem nichts
  falsch ist. Die Schwelle warnt bei legitimem Material.
- **Gliederungsweg je Datei:** In einer Quelle kommen `einzeln`, `agenda` und `titellaeufe` nebeneinander vor. Das Manifest
  braucht `gliederung` je Original, nicht je Quelle, und einen Wert für `einzeln`.
- **Große Abschnitte:** M7 6–26 (21 Folien), M5 1–19, M3 1–20, M4 10–24. Die Obergrenze 15 gilt nur für `gleichmaessig`.
  Offen, ob Agenda- und Titellauf-Abschnitte über 20 Folien nachgeteilt werden.

---

## 5. M7, Folien 31–33 (Lektion `pauschal-heisst-nicht-komplett`)

- **Vorschlag:** alle drei in **`m07-03-risikomanagement`** (Folien 27–35, „Risikomanagement und Vertragswesen“), **ein Abschnitt**.
  Die Grenze 26/27 kommt aus der Agendazeile; ob S. 27 schon dazugehört oder erst die Trennfolie S. 28, entscheidet der
  Präfixabgleich (Titel von S. 27 beginnt mit „Risikomanagement -“). Für 31–33 ist es gleichgültig.
- **Spec wörtlich:** **verteilt**. 31 liegt in `m07-02-beispiel-risikomanagement` (13–31), 32–33 in `m07-03-oder` (32–35).
  Die Kette: Foliennummern ab 10 bleiben stehen (Ziffern einzeln normalisiert) → „Folie 10“ … „Folie 35“ ist die oberste
  Nutzzeile und damit der Titel jeder Folie ab 10 → die Agenda findet nur 1 von 4 → Titelläufe über beliebige Zeilen → eine
  Zeile, die auf 32 und 33 unverändert steht, macht zwischen 31 und 32 eine Grenze.
- Für den Lehrplan heißt das: Die Lektion bekommt mit dem Vorschlag genau einen Abschnitt als Herkunft (`m07-03-…`, Status `lektion`).
  Der Abschnitt umfasst 9 Folien, zitiert werden 3. Die Seitenmarken in der Rohdatei (`— Folie 31 —`) tragen die feinere Angabe.

---

## 6. Hash

| Datei | Bytes | dateiHash |
|---|---|---|
| M1 PM und Leistungsbilder 26.pdf | 1 012 108 | `sha256:44bc62fc383c38d88f9495f5dc184d6008dd3e3e9290aefcb52635c6526d47ba` |
| M2 PM Beispiele Leistungsbilder 26.pdf | 3 390 964 | `sha256:ab751912d47b25a8751fbde1d44e4c125a3a01c0b9d2f59b2c55807c66b2703f` |
| M3 PM Stakeholderanalyse 26.pdf | 1 751 596 | `sha256:50c451de9045e6c8d0ec7c9bb84709b7ded0239b0f868a95f85a0db51b6ceb19` |
| M4 PM PSP 26.pdf | 2 118 175 | `sha256:257ff7ac6078d5803516e374ba6fc898360b44496ca2ae1c5615f98bda7f688e` |
| M5 PM Kommunikation 26.pdf | 971 017 | `sha256:46c7a601e5f1af77191ec5d38e72da29ee70fbd4668251f6de9dee91992c3bd1` |
| M6  Kostenschätzung Sportcenter 26.pdf | 12 656 | `sha256:2db479080ef918e48d39ef90c545d0a934bb45a8fd900bdfbc2aed81e268d97f` |
| M7 Risikomanagement 26.pdf | 2 702 832 | `sha256:f8d74aca551c7f0823b3d543105b4bd806df37d696fdd69d54f01f5176a1770c` |
| M9 Leistungsstandsmessung 26.pdf | 567 878 | `sha256:e6a949e667b5173f5c92ab8867f4efa26f00da87a3dcaae3ea268ad1e672b425` |
| M10 Steuerungsmöglichkeiten 26.pdf | 26 231 | `sha256:7b11913cb77eee689db3d34544ccf214b9cc8cb528ec2a72badd059145c018ec` |

**Stand** = `inhaltsHash` aus `werkzeug/manifest.mjs` (unverändert importiert) über die nach Codepunkten sortierten Datei-Hashes,
je einer pro Zeile, `\n` dazwischen, keiner am Ende:
**`sha256:f99ba9465fd7f116b002a752e774b80ce205e1b741740e0e8c43e1abf6b4af38`**, erfüllt das Schema (`sha256:` + 64 Hex).

- **Gleich beim zweiten Lauf:** vier Prozesse (`lauf.mjs` zweimal, `stand.mjs` zweimal; `diff` der Ausgaben leer),
  derselbe Wert, auch bei umgekehrter Eingabereihenfolge. Datei-Hashes mit `sha256sum` gegengeprüft (M1, M6, M7 identisch).
- **Die Sortierung ist Teil des Verfahrens:** nach Dateinamen statt nach Wert sortiert ergibt sich
  `sha256:6b77ebcc…`. Das Spec sagt „sortierte Datei-Hashes“; der Plan sollte die Zeichenfolge festschreiben (Trenner `\n`, voller
  Wert mit Präfix).
- `inhaltsHash` nimmt Text (UTF-8). Für PDF-Bytes braucht `manifest.mjs` ein Gegenstück `dateiHash(bytes)` im selben Format.
- Offen: Umbenennen einer Datei ändert den Stand nicht, bricht aber `datei` in jedem Abschnitt. Auffallen muss es über
  `originale[].datei` im Manifest, nicht über den Stand.

---

## 7. Fixtures mit pdf-lib (`proto/fixtures/erzeuge.mjs`, Prüfung `proto/fixtures/pruefe.mjs`)

**pdf-lib 1.17.1**, MIT, reines JavaScript, keine Installationsskripte. `npm install pdf-lib` → 5 Pakete in 24 s,
**21,8 MB** (pdf-lib 19,5 MB, davon der größte Teil mehrfach gebündelte `dist`/`es`/`cjs`-Ausgaben; @pdf-lib/standard-fonts
0,8, @pdf-lib/upng 0,7, pako 0,8 (MIT AND Zlib), tslib 0,03 (0BSD)). Letzte Version 2021-11-06, seitdem ruhend,
nicht als veraltet markiert. Gepflegte Forks mit derselben API: `@cantoo/pdf-lib` 2.11.1 (MIT, 26,3 MB, Stand 2026-09-15),
`@pdfme/pdf-lib` 6.1.13 (MIT, 2,2 MB, 2026-09-21). Für ein Fixture-Skript reicht das Original. Die Wahl ist unkritisch,
weil nur die Tests es brauchen (`devDependencies`).

**Es geht.** Erzeugt werden sieben PDFs (in `kb2b/fixtures-pdf/`), **zweimal erzeugt byte-gleich** (feste
Erstellungs- und Änderungszeit, fester Producer, `useObjectStreams: false`):

| Datei | Inhalt | Größe |
|---|---|---|
| `folien-agenda.pdf` | 26 Folien quer: Briefkopf (Kopfzeile, „Folie n“ rechts oben, Fußzeile, Logo-PNG an fester Stelle), Agendafolie (S. 2, 3 Punkte), Titelläufe, Bildfolie (S. 9, PNG, kein Text), Tabellenfolie (S. 14, Liniengitter 6 × 5, Zahlen), Silbentrennung und Ergänzungsstrich (S. 8) | 28 KB |
| `folien-laeufe.pdf` | dasselbe ohne Agendafolie (25 Folien) | 27 KB |
| `folien-gleichmaessig.pdf` | 32 Folien, jeder Titel verschieden, keine Agenda | 35 KB |
| `folien-scan.pdf` | 5 Seiten nur Bild | 3 KB |
| `folien-wenig-text.pdf` | 6 Folien mit je einem kurzen Satz (Median 24 Zeichen) | 4 KB |
| `buch-lesezeichen.pdf` | 22 Seiten hoch, Titelseite, 3 Kapitel mit je 2 Unterabschnitten, Kolumnentitel und Seitenzahl, Silbentrennung; **9 Lesezeichen in 2 Ebenen** | 73 KB |
| `buch-ohne.pdf` | derselbe Inhalt ohne Lesezeichen | 71 KB |

- **Das PNG** entsteht ohne Paket: IHDR/IDAT/IEND von Hand, `zlib.deflateSync`, `zlib.crc32` (ab Node 22.2).
- **Lesezeichen ohne Outline-API**, auf niedriger Ebene: `/Outlines` im Katalog (`doc.catalog.set`), je Eintrag ein über
  `context.nextRef()`/`context.assign()` angelegtes Dictionary mit `/Title` (ausdrücklich `PDFHexString.fromText`, sonst
  macht `context.obj` aus dem String einen Namen und Umlaute gehen verloren), `/Parent`, `/Prev`, `/Next`, `/First`, `/Last`,
  `/Count` (positiv = aufgeklappt) und `/Dest [Seitenref /XYZ null null null]`; dazu `/PageMode /UseOutlines`. Rund 30 Zeilen
  (`fuegeLesezeichenHinzu`). pdf.js liest alle 9 Einträge mit Ebene und aufgelöster Zielseite zurück.
- **Grenze:** Die Standardschriften von pdf-lib kodieren nur WinAnsi (`WinAnsi cannot encode "Δ"`). Umlaute, „ “ – · € gehen.
  Für mehr Zeichen braucht es eine eingebettete TTF und `@pdf-lib/fontkit`.

**Liest der Prototyp sie wie beabsichtigt?** Ja, **33 von 33 Prüfungen** mit den Vorschlagsregeln:
- `folien-agenda`: Art `folien`, kein Abbruch, genau 3 Beiwerkzeilen plus 1 Bild-Beiwerk (Logo), keine „Folie n“ im Nutztext,
  `nurBild` [9], `tabellenverdacht` [14], 1 Trennung zusammengezogen, 1 Ergänzungsstrich stehen gelassen, Weg `agenda` (S. 2),
  Abschnitte `d01-01-grundlagen-der-planung` 1–10, `d01-02-kosten-und-termine` 11–18, `d01-03-risiken-im-projekt` 19–26.
- `folien-laeufe`: Weg `titellaeufe`, 6 Abschnitte mit den Lauftiteln (1–4, 5–9, 10–13, 14–17, 18–20, 21–25), `nurBild` [8], Tabelle [13].
- `folien-gleichmaessig`: Weg `gleichmaessig`, 1–11, 12–22, 23–32, Titel „folien-gleichmaessig, Folien 1–11“.
- `folien-scan`: Abbruch „keine Textebene“. `folien-wenig-text`: kein Abbruch.
- `buch-lesezeichen` / `buch-ohne`: Art `buch` (hoch, Median 3 762 Zeichen), 2 Beiwerkzeilen (Kolumnentitel mit Kapitelnummer,
  Seitenzahl), Trennung zusammengezogen; Lesezeichen 9 mit Ebene und Seite bzw. 0.

Zwei Befunde, die erst die Fixtures gezeigt haben:
1. **Mit den Spec-Regeln wörtlich** findet `folien-agenda` seine Agenda nicht (Weg `titellaeufe`, 6 Abschnitte): derselbe Fehler
   wie bei M7, nachgestellt mit synthetischem Text. Ab Folie 10 bleibt „Folie 10“ stehen und wird zum Folientitel.
2. **Restrisiko der Ziffernregel:** Der dritte Aufzählungspunkt jeder Inhaltsfolie („• Beispiel n: …“) unterscheidet sich nur in
   der Zahl und steht immer an derselben Stelle, 21 von 26 Folien = 80,8 %. Er wird ohne weitere Bedingung zu Beiwerk. Am
   echten Material liegt jede Beiwerkzeile **an fester Stelle** (Streuung ≤ 0,1 % der Seitenhöhe) und **im Randstreifen**
   (y/h ≤ 0,073 oder ≥ 0,926). Vorschlag: Beiwerk nur bei fester Lage (± 1 %) im oberen oder unteren Randstreifen (15 %). An den
   neun Sätzen ändert das kein Ergebnis, an der Fixture fängt es den Fall (Prüfung „ohne Randstreifen: 4“).
   Dasselbe schützt M2: Dort steht „Fallbeispiel n“ auf 79,3 % der Folien, an wechselnder Stelle (y/h 0,60–0,87). Bei einer
   Schwelle von 79 % (entspricht einer Folie mehr) würde die Zeile ohne Lagebedingung Beiwerk, die Agenda fiele weg
   (Titelläufe 1–17, 18–21, 22–23, 24–29), und das Beiwerk stiege auf 60,1 %, über die Warnschwelle des Specs. Mit
   Lagebedingung: unverändert. Gemessen in `lage-wirkung.mjs`.

---

## 8. EPUB: Pakete für ZIP und XHTML (nur Empfehlung)

**Im Repo schon vorhanden** (gelesen aus `node_modules` und `package-lock.json`, nichts verändert):

| Paket | Version | Lizenz | Größe | im Baum über | nur dev? |
|---|---|---|---|---|---|
| ultrahtml | 1.7.0 | MIT | 164 KB, 0 Abh. | astro, @astrojs/react | **nein** (Produktivbaum) |
| sax | 1.6.1 | BlueOak-1.0.0 | 62 KB | svgo | nein |
| entities | 4.5.0 | BSD-2-Clause | 413 KB | dom-serializer | nein |
| domhandler / domutils / dom-serializer | 5.0.3 / 3.2.2 / 2.0.0 | BSD-2 / BSD-2 / MIT | 75 / 167 / 29 KB | css-select | nein |
| parse5 | 8.0.1 | MIT | 573 KB (+ entities 8.0.0) | jsdom | **ja**, nur über eine devDependency |
| saxes | 6.0.0 | ISC | 164 KB | jsdom | ja |

**Kein einziges ZIP-Paket** (fflate, jszip, yauzl, unzipper, adm-zip: keins, auch nicht verschachtelt). htmlparser2 fehlt ebenfalls.

**Kandidaten für ZIP** (npm, heute): fflate 0.8.3, MIT, 0 Abhängigkeiten, 778 KB entpackt (mehrere Builds), läuft in Node und
Browser · yauzl 3.4.0, MIT, 107 KB, 1 Abh., nur Node · jszip 3.10.2, MIT **oder** GPL-3.0, 4 Abh. · unzipper 0.12.5, 5 Abh. ·
@zip.js/zip.js 2.17.0, BSD-3, 8,3 MB. Ohne Paket ginge es auch: Zentralverzeichnis von Hand lesen und
`zlib.inflateRawSync`, rund 60 Zeilen, aber nur unter Node.

**Kurzprüfung ultrahtml** an synthetischen Schnipseln: OPF (Namensraum-Tags wie `dc:title`, selbstschließende `<item/>`,
`<itemref/>`), `nav.xhtml` (verschachtelte `<ol>`) und XHTML werden gelesen. Zwei Stolpersteine: **Entitäten bleiben
undekodiert** (`&shy;`, `&#160;` stehen roh im Text), und **`walk` besucht verschachtelte Inline-Elemente nicht in
Dokumentreihenfolge** (der Text eines `<em>` kam nach dem Rest des Absatzes).

**Empfehlung:** **fflate** neu für den ZIP-Teil (klein, ohne Abhängigkeiten, auch im Browser: Weg B). **ultrahtml** für
`container.xml`, OPF, nav/NCX und die XHTML-Kapitel, als ausdrückliche `dependency` in der Version, die astro schon zieht
(kein zusätzlicher Download). Dazu eine eigene rekursive Traversierung über `children` und `decodeHTML` aus **entities**
(ebenfalls schon im Produktivbaum, BSD-2). parse5 nur, falls sich Spec-treues HTML-Parsen als nötig erweist; dann gehört es
ausdrücklich in `dependencies`, denn transitiv hängt es nur an jsdom.

---

## Zusammenfassung für den Plan

**Übernehmen (gemessen):** pdfjs-dist 6.3.289 über `legacy/build/pdf.mjs`, vier Datenpfade mit `/` am Ende,
`verbosity: 0`, Importfilter für die drei Canvas-Meldungen; Canvas nicht bekämpfen. Zeilen nach Grundlage mit Spaltentrennung.
Beiwerk: **Ziffernfolge → #**, **Wiederkehr ab 5 Seiten, kleinere Dateien mit dem Beiwerk der Quelle**, **feste Lage (± 1 %)
im Randstreifen (15 %)**; Bild-Beiwerk über die Platzierung. Tabellenverdacht über **Liniengitter oder Zahlenzeilen** statt
Tokenanteil. Agenda über **Präfix auf Wortstämmen**, Titelläufe über den **Folientitel**, **Vorlauf > 3 Folien eigener
Abschnitt**. Id `‹kürzel›-‹nn›-‹slug›`. Stand = `inhaltsHash(sortierteDateiHashes.join('\n'))`, dazu `dateiHash(bytes)` in
`manifest.mjs`. Fixtures mit pdf-lib, Lesezeichen über `fuegeLesezeichenHinzu`. EPUB mit fflate + ultrahtml + entities.

**Offene Entwurfsfragen**
1. `gliederung` je Original statt je Quelle, und ein Wert für Sätze bis 20 Folien (`einzeln`).
2. Art je Quelle statt je Datei (M10 liegt 0,5 unter der Schwelle 600).
3. Tabellenverdacht umbenennen oder Diagramm und Tabelle trennen (M4: 14 Strukturplanfolien); Zählung auf der Seite.
4. `nurBild` mit Bildunterschrift (eine Zeile < 40 Zeichen) oder die Spec-Schwelle behalten (M7 dann 6 statt 7).
5. Beiwerk-Warnschwelle 60 % (M2 hat legitim 57 %).
6. Abschnitte über 20 Folien aus Agenda/Titellauf nachteilen? (M7 6–26, M5 1–19, M3 1–20)
7. Id-Stabilität beim Neueinlesen: Slug am Titel, Status-Übernahme über Seitenbereiche.
8. Umbenannte Originale: Stand bleibt gleich, `datei` bricht; Prüfung über `originale[].datei`.
9. Leseordnung bei Textfeldern nebeneinander: Zeilen werden reihenweise quer über die Spalten gelesen (M7 S. 12: 29 von
   50 Reihen mehrspaltig). Für Tabellenseiten sieht der Compiler ohnehin ins Original; für Fließtext in zwei Spalten
   (Bücher) wäre eine Blockbildung nötig, hier nicht gemessen.

## Prototyp-Dateien

Alle unter `C:/Users/dno/AppData/Local/Temp/claude/kb2b/proto/`:
`dokument.mjs` (Adapter-Prototyp), `gliederung/folien.mjs` (Gliederer), `fixtures/erzeuge.mjs` (Fixture-Skript),
`fixtures/pruefe.mjs` (33 Prüfungen), `lauf.mjs` (Gesamtlauf, Schema, Hash, M7), `stand.mjs` (Stand zweimal),
`material.mjs` (Pfade), Messskripte `rauch.mjs`, `einstieg.mjs`, `erkunde.mjs`, `pruefe-dokument.mjs`, `varianten.mjs`,
`varianten2.mjs`, `gitter.mjs`, `masken.mjs`, `titel.mjs`, `agenda-debug.mjs`, `pruefe-gliederung.mjs`, `lage.mjs`,
`lage-wirkung.mjs`, `nurbild-variante.mjs`; Unterprojekt `ohne-optional/` (pdfjs-dist ohne Canvas).
Daneben in `kb2b/`: `befund.md`, `lauf-tabelle.md`, Installations- und Rauchtest-Protokolle, `stand-lauf1/2.txt`,
`fixtures-pdf/` (7 PDFs + `erwartung.json`), `fixtures-hash1/2.txt`.
