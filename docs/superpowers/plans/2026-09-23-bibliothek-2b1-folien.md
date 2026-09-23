# Kernbohrung — Bibliothek 2b-1: Foliensätze einlesen — Implementierungsplan

> **Für agentische Ausführung:** ERFORDERLICHER SUB-SKILL: `superpowers:subagent-driven-development` (empfohlen) oder `superpowers:executing-plans`. Schritte nutzen Checkbox-Syntax (`- [ ]`).

**Ziel:** `npm run ingest -- --folien …` liest Foliensätze als PDF ein, bis die Bibliothek sie zeigt: `quellen/<kurzname>/` mit den Originalen, je Abschnitt eine Rohdatei mit Seitenmarken und einem Manifest der Fassung 3, dazu `lehrplan/<kurzname>.yaml` als Gerüst mit allen Abschnitten `offen`. Weil ein frisch eingelesener Lehrplan noch keine Freigabe trägt, bekommt die Bibliothek dafür einen eigenen Zustand: **wartet auf Freigabe** — die Karte bleibt mit ihren Zahlen stehen und sagt, dass der Compiler daraus noch nichts baut.

**Architektur:** Drei Teile mit je einer Aufgabe, wie im Spec. `werkzeug/adapter/dokument.mjs` liest ein PDF zu Seiten (der einzige Ort mit pdf.js) und rechnet daraus rein weiter — Beiwerk, Silbentrennung, Bildfolien, Tabellenverdacht, Art. `werkzeug/gliederung/folien.mjs` macht aus Seiten Abschnitte, rein und ohne pdf.js. `werkzeug/adapter/folien.mjs` setzt beides zusammen und schreibt gegen ein beliebiges Verzeichnis; `werkzeug/lehrplan-geruest.mjs` erzeugt und vergleicht den Lehrplan. `werkzeug/ingest.mjs` ist nur noch die Weiche zwischen Git und Folien; der Git-Weg zieht unverändert nach `werkzeug/ingest-git.mjs`. Auf der Seite kommen `Freigabe` in `abdeckung.ts`, `freigabezeile` in `bestandstext.ts` und eine Markierung in `Bestand.astro` dazu.

**Stack:** Node ≥ 22.18, Astro 7 (statisch), Zod 4 über `astro/zod`, Vitest. **Zwei neue Abhängigkeiten, beide unter `devDependencies`:** `pdfjs-dist` in genau `6.3.289` (ohne Dach) und `pdf-lib` `^1.17.1` für die Fixtures. Der Bau der Seite braucht keine von beiden.

**Spec:** `docs/superpowers/specs/2026-09-18-bibliothek-design.md` — „Der Adapter", „gliederung/folien.mjs", „Ausgabe", „Urheberrecht" und der „Nachtrag nach 2a". **Nicht Teil dieses Plans:** Bücher und EPUB (2b-2), Formular und Dev-Endpunkte auf der Seite (2b-3), der Compiler für Lehrmaterial (2c). Erkennt das Einlesen ein Buch, bricht es mit klarer Meldung ab.

**Voraussetzung:** `master` ab `a0b8557` — Bibliothek 2a ist zusammengeführt.

---

## Was jeder Ausführende wissen muss

Die Ausführenden sehen nur diesen Vorspann und ihre eine Aufgabe. Regel 1 bis 17 stammen aus Plan 2a und aus Fehlern, die in diesem Projekt tatsächlich passiert sind; 18 bis 24 sind neu und jede beruht auf einer Messung für diesen Plan.

1. **Das Arbeitsverzeichnis der Bash-Aufrufe wandert nicht mit.** Jeder Aufruf beginnt mit
   `cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && `.
2. **Niemals `git add -A` oder `git add .`** — immer die Dateien einzeln aufzählen.
3. **Commit-Nachrichten über `git commit -F - <<'MSG'`** und nur mit geraden Anführungszeichen. Deutsche Anführungszeichen in einer Bash-Zeichenkette zerlegen den Befehl. Letzte Zeile: die Co-Authored-By-Zeile, die die eigene Sitzung vorgibt. In den Befehlen unten steht an dieser Stelle `<CO-AUTHORED-BY>` — das wird **ersetzt**, nicht mitcommittet.
4. **Kein NUL-Byte in eine Textdatei.** Ein Agent hat einmal eines als Trennzeichen geschrieben; alle Tests blieben grün, aber Git führte die Datei fortan als Binärdatei. Prüfung am Ende jeder Aufgabe:
   `python -c "import sys; print(sum(open(f,'rb').read().count(b'\x00') for f in sys.argv[1:]))" <textdateien>` → `0`.
   **Die sechs PDF unter `tests/fixtures/` sind binär und gehören nicht in diese Prüfung** — sie enthalten NUL-Bytes, und das ist richtig so.
5. **Relative Importe:** `src/lib/lehrplan.ts` wird unter reinem Node geladen — über `werkzeug/lehrplan.mjs` und über Tests mit `// @vitest-environment node` — und trägt deshalb die Endung: `from '../widgets/pruefung.ts'`. Node löst relative Importe ohne Endung nicht auf. `abdeckung.ts`, `manifestauszug.ts` und `bestandstext.ts` lädt niemand unter Node; sie holen sich von ihren Nachbarn nur Typen, ohne Endung. **Module unter `werkzeug/` importieren einander mit Endung `.mjs`.**
6. **Nichts aus diesem Plan läuft im Browser.** Die Seite rechnet zur Bauzeit; ins gebaute HTML kommt das Ergebnis, kein Skript und kein Rohtext aus Lehrplan oder Manifest. Typen immer mit `import type` — `verbatimModuleSyntax` verlangt es, und `astro check` meldet es sonst.
7. **TDD:** erst der fehlschlagende Test, dann die Umsetzung. Befehle: ein Test `npx vitest run tests/<datei>`, alle `npm test`, Typen `npm run check`, Bau `npm run build`.
8. **Farben nur über die vorhandenen Token** in `src/styles/global.css`. Ein Farbtoken darf nie nur in einem `@media`- oder `[data-theme]`-Block stehen. Dieser Plan führt kein neues Token ein und hängt in `global.css` nur an.
9. **Jede Bedienfläche mindestens 44 × 44 CSS-Pixel.** Gemessen wird am gebauten Stand bei 375 px, nicht geschätzt.
10. **Browserprüfung am gebauten Stand** (`preview_start` mit Name `kernbohrung-bau`, Port 4322), nicht am Dev-Server: Dessen Vite-Zwischenspeicher hat in diesem Projekt schon leere Inseln geliefert. Der Pane malt beim Scrollen unzuverlässig — mit `javascript_tool` messen, nicht mit Bildschirmfotos.
11. **Nie zwei Läufe gleichzeitig.** `npm test`, `npm run check` und `npm run build` teilen sich Zwischenspeicher und Ausgabeordner. Parallele Läufe — auch die eines anderen Agenten im selben Ordner — erzeugen Fehler, die es nicht gibt. **Gemessen in diesem Probelauf:** Ein `npm test` unmittelbar nach einem `npm run build` meldete einmal drei rote Tests in den vier pdf.js-Dateien; drei Läufe allein danach waren grün. Scheitert ein Lauf unerklärlich: einmal allein wiederholen, bevor du etwas „reparierst".
12. **Keine absoluten Gesamttestzahlen.** Aufgabe 0 notiert die Zahl der Tests als **BASIS** und die Seitenzahl des Baus als **SEITEN**. Dieser Plan nennt nur die Zahl je Testdatei und den Zuwachs.
13. **Wortlaute werden übernommen, nicht verbessert.** Jeder Satz, den die Seite oder die Konsole zeigt, steht unten fest — mit Umlauten — und ein Test hält ihn Zeichen für Zeichen. Bezeichner und Kommentare im Code bleiben wie im ganzen Projekt ohne Umlaute.
14. **Darstellungstests mit dem Container von Astro.** `experimental_AstroContainer` aus `astro/container` rendert eine `.astro`-Komponente ohne Bau. Die Testdatei braucht `// @vitest-environment node` — unter jsdom meldet Astro „No valid renderer".
15. **Astro löscht Leerraum mit Zeilenumbruch zwischen zwei Elementen.** Wo zwei Elemente mit Trennzeichen nebeneinander stehen, gehören sie samt Trennzeichen auf eine Quelltextzeile.
16. **`quellen/` ist gitignored.** Kein Test darf es lesen — auf GitHub gibt es den Ordner nicht. Die Seite liest die Manifeste über `import.meta.glob('/quellen/*/manifest.json', …)`; fehlt der Ordner, liefert der Glob `{}`.
17. **Tastendrücke im Browser-Pane** kamen am 2026-09-22 als Ereignisse ohne Tastennamen an; `details` klappte davon nicht auf. Aufgeklappt wird in der Abnahme mit `.click()` auf das `summary`.
18. **Kein Folientext verlässt `quellen/`.** Das Material gehört seinen Verfassern. In Plan, Tests, Commit-Nachrichten und auf der Konsole stehen nur Zahlen, Seitennummern, Dateinamen, Abschnitt-Ids, Abschnittstitel und Hashes. Die Fixtures unter `tests/fixtures/` sind synthetisch; ihr Text ist erfunden. Ein Test in Aufgabe 9 hält fest, dass kein Satz aus einer Rohdatei in der Konsolenausgabe steht.
19. **Kein Test liest `quellen/` oder den Materialordner.** Was ein Test braucht, erzeugt er in einem Temp-Verzeichnis (`mkdtempSync`) oder liest es aus `tests/fixtures/`. Aufgabe 11 ist die einzige Ausnahme, und sie liest den Materialordner nur.
20. **pdf.js nur über `ladePdfjs()` aus `werkzeug/adapter/dokument.mjs`.** Import aus `pdfjs-dist/legacy/build/pdf.mjs`, nie aus `pdfjs-dist` — der moderne Build meldet „Please use the legacy build in Node.js environments" und scheitert unter Node 24 an `Uint8Array.prototype.toHex`. Wer pdf.js in einem Test braucht, lädt es **einmal** in `beforeAll` und reicht es durch; jeder Aufruf lädt es sonst neu.
21. **`pdfjs-dist` steht ohne Dach in `package.json`.** Die erwarteten Werte der Tests hängen an der Extraktion genau dieser Fassung. Wer sie hebt, misst die Fixture-Werte neu.
22. **Die Werkzeuge unter `werkzeug/` werden mitgeprüft.** `astro check` läuft mit `checkJs: true` über `**/*`; jede `.mjs` braucht JSDoc-Typen an Parametern, Rückgaben und leeren Sammlungen (`/** @type {Map<string, number>} */`). Ein Pfeil-Ausdruck bekommt `/** @type {(a: string) => string} */` über der Zuweisung.
23. **Arbeitsordner statt Projektwurzel.** Alles, was schreibt, nimmt die Wurzel als Parameter (`leseFolienEin({ wurzel })`). Nur `werkzeug/ingest.mjs` reicht `process.cwd()` hinein. So läuft dasselbe im Test gegen ein Temp-Verzeichnis.
24. **Zeilenenden.** Die Arbeitskopie dieses Repos führt CRLF (`core.autocrlf=true`). Wer eine Datei mit einem Skript schreibt, schreibt sie mit CRLF — sonst meldet Git „LF will be replaced by CRLF" und der Diff sieht größer aus, als er ist.

## Präzisierungen gegenüber dem Spec

An diesen Stellen ließ der Spec eine Entscheidung offen, oder die Messung an neun echten Foliensätzen hat sie genauer gemacht. Dieser Plan ändert den Spec nicht; ob er nachgezogen wird, entscheidet die Hauptsitzung. Die Messungen stehen in `docs/recherche/2026-09-22-foliensaetze-befund.md`.

1. **„Ziffern zu `#`" heißt „Ziffern*folge* zu `#`".** Wörtlich je Ziffer normalisiert sind „Folie 7" und „Folie 17" zwei verschiedene Zeilen (`Folie #` und `Folie ##`). In jedem Satz mit mehr als neun Folien erreicht dann keine der beiden die 80 %, und die laufende Foliennummer bleibt im Nutztext stehen — gemessen an drei Sätzen: 39/61, 29/71 und 26/74 Prozent. Mit `\d+ → #` ist sie in allen neun Sätzen Beiwerk.
2. **Die Wiederkehr greift erst ab fünf Seiten; kleinere Dateien übernehmen das Beiwerk der übrigen Dateien derselben Quelle.** Eine Datei mit einer einzigen Seite hat jede Zeile auf 100 % ihrer Seiten: Der ganze Text wäre Beiwerk, der Nutztext null, und die Datei bräche als „Scan" ab. Genau das passierte M6 mit der Spec-Regel. Mit der Übernahme verliert M6 36,1 % (den Briefkopf) und M10 19,0 %, und beide bleiben lesbar.
3. **Beiwerk nur an fester Lage (± 1 % der Seitenhöhe) im oberen oder unteren Randstreifen (15 %).** Ohne diese Bedingung wird ein Aufzählungspunkt, der sich nur in einer Zahl unterscheidet und auf 80 % der Folien an derselben Stelle steht, zu Beiwerk — an der Fixture `folien-agenda.pdf` nachgestellt (21 von 26 Folien = 80,8 %). Am echten Material liegt jede Beiwerkzeile im Randstreifen (Lage 0,07 oder 0,93) und streut höchstens ein Zehntelprozent. An den neun Sätzen ändert die Bedingung kein Ergebnis; sie schützt M2, dessen Zeile „Fallbeispiel n" auf 79,3 % der Folien an wechselnder Stelle steht.
4. **Bild-Beiwerk über die Platzierung.** „Die Seite trägt mindestens ein Bild" trennt nichts: Alle 199 Seiten des echten Materials tragen das Logo im Briefkopf, an derselben Stelle (84 × 28 pt bei x 712, y 16). Ein Bild zählt erst, wenn seine Platzierung nicht auf ≥ 80 % der Seiten wiederkehrt.
5. **`nurBild` = echtes Bild **und** (Nutztext unter 20 Zeichen **oder** genau eine Zeile unter 40 Zeichen).** Die einzige Nutzzeile einer Bildfolie in M7 ist eine Bildunterschrift mit genau 20 Zeichen; die bloße Schwelle verfehlt sie um ein Zeichen. Mit der Ergänzung findet die Regel in M7 genau die sieben Bildfolien, die der Spec erwartet.
6. **`tabellenverdacht` = Liniengitter (≥ 5 waagrechte **und** ≥ 5 senkrechte Vektorlinien) **oder** ≥ 3 Zeilen nur aus Zahlen, Daten, Einheiten.** Die Regel des Specs (> 60 % Einzeltoken) ist an einer Extraktion geeicht, in der jede Tabellenzelle eine eigene Zeile ist. Dieser Adapter setzt Zeilen aus der Lage zusammen; die dichteste Tabelle in M7 (S. 12, 3 374 Zeichen, Liniengitter 23 × 23) liegt damit bei 51 % und wird **nicht** erkannt, während Folien mit vielen Einwortbeschriftungen fälschlich anschlagen.
7. **Das Manifestfeld heißt weiter `tabellenverdacht`, die Seite sagt „mit Tabelle oder Grafik".** Die Regel schlägt zu Recht auch bei Diagrammen an — in M4 bei 15 von 45 Folien mit Projektstrukturplänen; der Text eines Strukturplans trägt dessen Hierarchie nicht. „15 Tabellen vermutlich zerfallen" wäre für diese Datei irreführend. In `lueckenzeile` steht deshalb „N Folien mit Tabelle oder Grafik" (Einzahl „1 Folie …", bei Büchern Seite/Seiten) und „keine Folie nur Bild, keine mit Tabelle oder Grafik erkannt".
8. **Die Art entscheidet die Quelle, nicht die Datei.** Je Datei wackelt es: M10 liegt mit Median 599,5 einen halben Punkt unter der Schwelle 600, M1 bei 576; ohne das Beiwerk der Quelle käme M10 auf 739,5 und hieße „buch". Über alle 199 Seiten der Quelle ist der Median 242. Eine Quelle hat eine Art, nicht neun. `--art folien` überstimmt die Erkennung.
9. **`gliederung` steht je Original im Manifest, mit einem vierten Wert `einzeln`.** In einer Quelle kommen `einzeln`, `agenda` und `titellaeufe` nebeneinander vor (gemessen: 4 · 2 · 3 von 9). Der Spec nennt `gliederung` je Quelle und kennt keinen Wert für Sätze bis 20 Folien.
10. **Die Agenda gleicht über grobe Wortstämme ab.** „Begriffsbestimmungen" in der Agenda trifft den Folientitel „Begriffsbestimmung — Risiko" nur so (Treffer 2/4 ohne, 3/4 mit). Eine reine Wortanteil-Variante wurde verworfen: Sie verliert M2, weil dort kurze Titel („Fallbeispiel 1") auf lange Agendazeilen treffen.
11. **Ein Titellauf zählt nur über den Folientitel.** Wörtlich genommen — jede Zeile, die auf der Nachbarfolie steht — werden Rumpfzeilen zu Abschnittstiteln: In M1 benennt eine Aufzählungszeile den Abschnitt 1–14, in M7 wird das bloße Wort „oder" zum Titel eines Abschnitts.
12. **Mehr als drei Folien vor der ersten Grenze bilden einen eigenen Abschnitt** mit Rückfalltitel. Der Spec sagt dazu nichts; angehängt an den ersten Abschnitt ergibt M5 einen Abschnitt 1–24, weil der erste Titellauf erst auf Folie 20 beginnt.
13. **Abschnitte über 20 Folien werden nicht nachgeteilt.** Die Obergrenze 15 gilt nur für `gleichmaessig`. M7 6–26 (21 Folien), M5 1–19, M3 1–20 und M4 10–24 bleiben, wie sie sind — offene Frage für 2c.
14. **Die Abschnitt-Id ist `‹kürzel›-‹nn›-‹slug›`.** Das Kürzel sind die Buchstaben vor der ersten Zahl des Dateinamens plus die Zahl, zweistellig (`M7 …` → `m07`); passt ein Name nicht oder kollidieren zwei Kürzel, bekommen **alle** Dateien `d01`, `d02`, … Die laufende Nummer ist zweistellig, weil einstellig `m07-10` vor `m07-2` sortierte. Der Slug hat höchstens vier Wörter und 32 Zeichen, Umlaute ausgeschrieben, kein Füllwort am Ende; ohne Titel `folien-a-b`.
15. **Der Stand einer Quelle ist festgeschrieben:** `inhaltsHash` über die nach Codepunkten **sortierten** Datei-Hashes, mit `\n` verbunden, ohne `\n` am Ende. Nach Dateinamen sortiert käme ein anderer Wert heraus (gemessen). Dazu kommt `dateiHash(bytes)` in `manifest.mjs`: Ein PDF als Text gelesen bekäme an jedem ungültigen Byte ein Ersatzzeichen.
16. **Das Manifest für Buch und Folien ist Fassung 3, Git bleibt Fassung 2.** Die beiden Herkünfte haben außer dem Stand fast nichts gemeinsam; ein Manifest, das beides mit leeren Feldern abdeckt, sagt weniger.
17. **Ein Lehrplan, dem nur die Freigabe fehlt, ist wartend, nicht ungültig** (offen aus dem Schlussreview von 2a, hier entschieden). `pruefeLehrplan` bleibt für den Compiler streng (`ok: false`), liefert aber zusätzlich den gelesenen Lehrplan und `wartet: true`. `abdeckung` rechnet ihn wie einen gültigen; die Karte trägt die Markierung. Ohne diesen Zustand verschwände die Karte samt Zahlen, sobald ein Durchgang läuft, und alle früher freigegebenen Lektionen der Quelle stünden unter „ohne Lehrplaneintrag" — auch in einem Handy-Bau aus dieser Zeit.
18. **Der Lehrplan wird nie überschrieben.** In ihm steckt die Arbeit des Compilers und die Freigabe eines Menschen. `quellen/` ist abgeleitet und wird neu geschrieben; der Lehrplan bleibt, und das Einlesen meldet den Vergleich.
19. **Der Bau zeigt `geprueftVon` jetzt im HTML** — als Teil des Satzes „Erst wenn geprueftVon und geprueftAm eingetragen sind …". Die Rohtext-Prüfung der Abnahme sucht deshalb `warumNichtOffensichtlich|"rubrik"|sha256:[0-9a-f]{64}` und prüft `geprueftVon` eigens auf genau diese eine Stelle.
20. **Die Kopfzeile zeigt `Stand sha256:f99ba94`, nicht `Stand f99ba94`.** `kurzstand` aus 2a behält das Präfix; das ist dort getestet und wird hier nicht geändert.
21. **Die Lektion `pauschal-heisst-nicht-komplett` bekommt ihren Lehrplaneintrag erst in 2c.** Erst dort steht fest, wie Abschnitt, Prinzipien und Lektion zusammenhängen (`lektion` ist je Abschnitt eine, `prinzipien` bis drei). Bis dahin steht sie unter „Lektionen ohne Lehrplaneintrag", mit Absicht.

## Der heutige Bestand — gemessen am 2026-09-23

| | |
|---|---|
| Lehrpläne | 1 — `lehrplan/awesome-llm-apps.yaml`, `art: repo`, freigegeben |
| Prinzipien | 6, davon 3 mit Lektion |
| Lektionen | 5, davon 2 ohne Lehrplaneintrag (`pauschal-heisst-nicht-komplett`, `recall-vor-precision`) |
| Tests | **BASIS** in 45 Dateien (Aufgabe 0 misst sie) |
| Bau | **SEITEN** Seiten, `astro check` 0/0/0 |
| Pakete | 399 auditiert, keine davon für PDF |
| Material für Aufgabe 11 | neun Foliensätze, 199 Seiten, 8,5 MB, in zwei Mappen |

Nach diesem Plan: zwei Lehrpläne, der zweite mit 22 Abschnitten und wartend; 51 Testdateien; `SEITEN` unverändert (die Bibliothek gibt es schon).

## Dateistruktur

```
werkzeug/adapter/dokument.mjs     ladePdfjs, liesSeiten, zeilenAus, werteOperatorenAus;         (neu)
                                  schluessel, zeichen, zieheTrennungZusammen, istZahlenzeile,
                                  findeBeiwerk, findeBildBeiwerk, bereinige, bereinigeQuelle,
                                  artDerQuelle, seitenText, BEIWERK_WARNUNG
werkzeug/gliederung/folien.mjs    slug, dateikuerzel, folientitel, findeAgenda,                 (neu)
                                  findeTitellaeufe, gliedereFolien
werkzeug/adapter/folien.mjs       leseFolienEin, sammlePdfs, rohdatei, natuerlich,              (neu)
                                  EinleseFehler, WARNZEILE, NUR_BILD_ZEILE
werkzeug/lehrplan-geruest.mjs     lehrplanGeruest, vergleicheLehrplan, vergleichInZeilen        (neu)
werkzeug/fixtures/erzeuge.mjs     FIXTURES, erzeugeFixtures                                     (neu)
werkzeug/ingest-folien.mjs        argumente, bericht, fuehreAus                                 (neu)
werkzeug/ingest-git.mjs           der heutige Git-Weg, unveraendert verschoben                  (verschoben)
werkzeug/ingest.mjs               nur noch die Weiche                                           (ersetzt)
werkzeug/manifest.mjs             + MANIFEST_FASSUNG_DOKUMENT, dateiHash, standAusHashes,       (geändert)
                                    baueDokumentManifest
src/lib/lehrplan.ts               + Befund mit `wartet`, lehrplaeneAusTexten liefert `wartend`  (geändert)
src/lib/abdeckung.ts              + Freigabe, Bestand.freigabe                                  (geändert)
src/lib/bestandstext.ts           + freigabezeile, neuer Wortlaut in lueckenzeile               (geändert)
src/lib/manifestauszug.ts         + Fassung 3 als Form `dokument`                               (geändert)
src/components/Bestand.astro      + .quelle-freigabe, neuer Warnungstext                        (geändert)
src/pages/bibliothek.astro        rechnet wartende Lehrplaene mit                               (geändert)
src/styles/global.css             + Block „Markierung Wartet auf Freigabe"                      (nur angehängt)
package.json                      + devDependencies, Skript `fixtures`                          (geändert)
README.md                         + Abschnitt „Eine Quelle einlesen"                            (geändert)
lehrplan/bauch-projektmanagement.yaml   das eingelesene Geruest                                 (neu, Aufgabe 11)
tests/fixtures/*.pdf              sechs synthetische PDF, committet                             (neu)
tests/
  lehrplan.test.ts          35 → 41 (+6)      lehrplan-lehrmaterial.test.ts   74 → 76 (+2)
  abdeckung.test.ts         19 → 22 (+3)      bestandstext.test.ts            32 → 35 (+3)
  bestand-ansicht.test.ts   11 → 13 (+2)      bibliothek-seite.test.ts         4 → 5  (+1)
  manifest.test.ts          14 → 27 (+13)     manifestauszug.test.ts          14 → 19 (+5)
  fixtures-erzeugen.test.ts  2 (neu)          dokument-seiten.test.ts         19 (neu)
  dokument-bereinigen.test.ts 32 (neu)        gliederung-folien.test.ts       34 (neu)
  einlesen-folien.test.ts   18 (neu)          ingest-aufruf.test.ts           10 (neu)
```

Zusammen **+150 Tests** (BASIS + 150) und sechs neue Testdateien. `src/layouts/`, `src/tutor/`, `src/aufgaben/`, `src/profil/`, `werkzeug/adapter/git.mjs`, `werkzeug/auswahl.mjs`, `werkzeug/lehrplan.mjs` und `werkzeug/pruefe-lektion.mjs` bleiben unberührt.

## Aufgabe 0: Voraussetzungen, Zweig, Ausgangslage

**Dateien:** keine.

- [ ] **Schritt 1: Voraussetzungen prüfen**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && git status --short && git branch --show-current && git merge-base --is-ancestor a0b8557 HEAD && echo "a0b8557 ist enthalten" && node --version && ls werkzeug/adapter/dokument.mjs werkzeug/gliederung 2>&1 | grep -c "No such file" && grep -c '"pdfjs-dist"' package.json && grep -c 'wartet' src/lib/lehrplan.ts
```
Erwartet, in dieser Reihenfolge: keine Zeile von `git status` (sauberer Baum) · `master` · `a0b8557 ist enthalten` · eine Node-Version ab `v22.18` · `2` (weder `dokument.mjs` noch der Ordner `gliederung` gibt es schon) · `0` (pdfjs-dist ist noch keine Abhängigkeit) · `0` (`lehrplan.ts` kennt den Zustand „wartet" noch nicht).

**Anhalten und melden, nicht weitermachen,** wenn der Baum nicht sauber ist, wenn `a0b8557` fehlt, wenn Node älter ist als 22.18 oder wenn eine der Zahlen abweicht. Die letzten drei sind die Stellen, die dieser Plan anlegt oder ersetzt — stimmen sie nicht, passt er nicht mehr zum Stand.

- [ ] **Schritt 2: Zweig anlegen**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && git switch -c bibliothek-2b1
```
Erwartet: `Switched to a new branch 'bibliothek-2b1'`.

- [ ] **Schritt 3: Ausgangslage festhalten**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && npm test 2>&1 | grep -E "Tests |Test Files |FAIL" && npm run check 2>&1 | grep -E "^- [0-9]+ (error|warning|hint)" && npm run build 2>&1 | grep -E "page\(s\)"
```
Erwartet: alle Tests bestanden (im Probelauf `Test Files 45 passed (45)`, `Tests 795 passed (795)`), `- 0 errors`, `- 0 warnings`, `- 0 hints`, `<n> page(s) built` (im Probelauf 9). **Notiere** die Zahl der bestandenen Tests als **BASIS** und die Seitenzahl als **SEITEN**; beide gehören in den Bericht dieser Aufgabe und werden in jeder folgenden gebraucht. Ist ein Test rot oder gibt es Typfehler: anhalten und melden.

- [ ] **Schritt 4: Testzahlen je Datei notieren**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && for f in lehrplan lehrplan-lehrmaterial abdeckung bestandstext bestand-ansicht bibliothek-seite manifest manifestauszug; do printf "%-24s " "$f"; npx vitest run "tests/$f.test.ts" 2>&1 | grep -oE "Tests  [0-9]+ passed"; done
```
Erwartet, wörtlich:

```text
lehrplan                 Tests  35 passed
lehrplan-lehrmaterial    Tests  74 passed
abdeckung                Tests  19 passed
bestandstext             Tests  32 passed
bestand-ansicht          Tests  11 passed
bibliothek-seite         Tests  4 passed
manifest                 Tests  14 passed
manifestauszug           Tests  14 passed
```

Weicht eine Zahl ab, hat sich die Datei seit dem 2026-09-23 geändert: anhalten und melden — die Zuwächse in den Aufgaben 1, 2 und 7 hängen daran.

- [ ] **Schritt 5: Den heutigen Bestand und das Manifest messen**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && node --input-type=module -e "
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { load } from 'js-yaml';
const lektionen = readdirSync('inhalt/lektionen').filter((d) => d.endsWith('.mdx')).map((d) => d.slice(0, -4)).sort();
const plaene = readdirSync('lehrplan').filter((d) => d.endsWith('.yaml')).sort();
const bekannt = new Set();
for (const datei of plaene) {
  const l = load(readFileSync('lehrplan/' + datei, 'utf8'));
  const teile = l.prinzipien ?? l.abschnitte ?? [];
  teile.forEach((p) => bekannt.add(p.lektion ?? p.id));
  console.log(datei + ' | art: ' + (l.art ?? 'fehlt') + ' | ' + teile.length + ' Eintraege | geprueftVon: ' + JSON.stringify(l.geprueftVon ?? null));
}
console.log('Lektionen: ' + lektionen.length + ' | ohne Lehrplaneintrag: ' + lektionen.filter((id) => !bekannt.has(id)).join(', '));
const m = 'quellen/awesome-llm-apps/manifest.json';
console.log('MANIFEST: ' + (existsSync(m) ? 'vorhanden, Fassung ' + JSON.parse(readFileSync(m, 'utf8')).fassung : 'fehlt'));
"
```
Erwartet, wörtlich bis auf die letzte Zeile:

```text
awesome-llm-apps.yaml | art: repo | 6 Eintraege | geprueftVon: "Daniel Nobs"
Lektionen: 5 | ohne Lehrplaneintrag: pauschal-heisst-nicht-komplett, recall-vor-precision
MANIFEST: vorhanden, Fassung 2
```

Weichen die ersten beiden Zeilen ab, hat sich der Bestand seit dem 2026-09-23 verändert: anhalten und melden — die Zahlen stecken in `tests/abdeckung.test.ts` („der heutige Bestand") und in der Abnahme.

Steht dort **`MANIFEST: fehlt`**, **notiere es**: Dann zeigt die erste Karte „Lücken: unbekannt — das Manifest liegt nur am Rechner, auf dem eingelesen wurde" statt „44 von 106 Dateien nicht übernommen", und die Abnahme (Aufgabe 12) erwartet an dieser einen Stelle den anderen Satz. Im Probelauf lief der Plan in einem frischen Klon, in dem `quellen/` fehlte — dort stand `MANIFEST: fehlt`.

- [ ] **Schritt 6: Den Materialordner für Aufgabe 11 prüfen — nur lesen**

```bash
M="C:/Users/dno/Documents/02_UNI/02_Weimar/3. Semester BPS_BVM_BIM/BPS/Vorlesungen/Lehrunterlagen Prof. Bauch-20260721" && ls "$M/1.Tag 27.6.26" && ls "$M/2. Tag 25.07.2026"
```
Erwartet: vier Dateien in der ersten Mappe (`M1 PM und Leistungsbilder 26.pdf`, `M2 PM Beispiele Leistungsbilder 26.pdf`, `M3 PM Stakeholderanalyse 26.pdf`, `M4 PM PSP 26.pdf`) und fünf in der zweiten (`M10 Steuerungsmöglichkeiten 26.pdf`, `M5 PM Kommunikation 26.pdf`, `M6  Kostenschätzung Sportcenter 26.pdf` — mit zwei Leerzeichen —, `M7 Risikomanagement 26.pdf`, `M9 Leistungsstandsmessung 26.pdf`).

Fehlt der Ordner oder eine Datei: **nicht anhalten**, sondern notieren. Die Aufgaben 1 bis 10 brauchen ihn nicht; nur Aufgabe 11 läuft ohne ihn nicht.

**Bericht dieser Aufgabe:** BASIS, SEITEN, Node-Version, ob das Manifest da ist, ob der Materialordner da ist.

---

## Aufgabe 1: „Wartet auf Freigabe" — der dritte Befund in `src/lib/lehrplan.ts`

**Dateien:**
- Ändern: `src/lib/lehrplan.ts` (drei Stellen), `tests/lehrplan.test.ts`, `tests/lehrplan-lehrmaterial.test.ts`

Das erste Einlesen legt einen Lehrplan **ohne** Freigabe an — `geprueftVon` und `geprueftAm` sind leer, bis ein Mensch sie einträgt. Nach heutigem Stand fällt so ein Lehrplan durch die Prüfung, die Karte verschwindet samt Zahlen, und alle Lektionen der Quelle stehen als „ohne Lehrplaneintrag" da. Das trifft schon den ersten Lauf von Aufgabe 11.

Deshalb ein dritter Fall: **wartend**. Für den Compiler bleibt er `ok: false` — er baut daraus keine Lektionen. Die Seite bekommt zusätzlich den gelesenen Lehrplan und die Markierung. Hat der Lehrplan neben der fehlenden Freigabe **weitere** Mängel, bleibt er ungültig und zeigt alle.

Diese Aufgabe ändert an der gebauten Seite nichts: Der heutige Lehrplan ist freigegeben. `bibliothek.astro` nimmt die wartenden Lehrpläne erst in Aufgabe 2 entgegen.

- [ ] **Schritt 1: Die Tests für den wartenden Zustand schreiben (rot)**

In `tests/lehrplan.test.ts` den Block `describe('lehrplaeneAusTexten', …)` suchen und **unmittelbar davor** einfügen:

```ts
/**
 * Der Zustand zwischen Durchgang A und dem Menschen am Review-Gate.
 *
 * Fuer den Compiler bleibt ein solcher Lehrplan `ok: false` — er baut daraus
 * keine Lektionen. Fuer die Seite ist er trotzdem lesbar: Ohne diesen dritten
 * Fall verschwaende die Karte samt Zahlen, sobald ein Durchgang laeuft, und
 * alle frueher freigegebenen Lektionen stuenden als „ohne Lehrplaneintrag" da.
 */
describe('pruefeLehrplan - wartet auf Freigabe', () => {
  /** Holt den Lehrplan aus einem wartenden Befund. */
  function wartendVon(ergebnis: ReturnType<typeof pruefeLehrplan>) {
    if (ergebnis.ok) throw new Error('Erwartet war ein Fehlschlag, die Pruefung war aber zufrieden.');
    if (!ergebnis.wartet) throw new Error(`Erwartet war „wartet", gemeldet wurde: ${ergebnis.maengel.join(' | ')}`);
    return ergebnis;
  }

  it.each([
    ['leer', ''],
    ['nicht gesetzt', null],
    ['nur Leerzeichen', '   '],
  ])('wartet, wenn geprueftVon %s ist — und liefert den Lehrplan mit', (_fall, wert) => {
    const e = wartendVon(pruefeLehrplan({ ...gut, geprueftVon: wert }, KEINE));
    expect(e.maengel).toEqual(['geprueftVon: geprueftVon fehlt — der Lehrplan ist das Review-Gate.']);
    expect(e.lehrplan.quelle).toBe('awesome-llm-apps');
    if (e.lehrplan.art !== 'repo') throw new Error('Erwartet war ein Repo.');
    expect(e.lehrplan.prinzipien).toHaveLength(2);
  });

  it('wartet auch, wenn beide Felder fehlen', () => {
    const { geprueftVon: _v, geprueftAm: _a, ...ohne } = gut;
    const e = wartendVon(pruefeLehrplan(ohne, KEINE));
    expect(e.maengel).toHaveLength(2);
    expect(e.maengel.join(' ')).toMatch(/geprueftVon/);
    expect(e.maengel.join(' ')).toMatch(/geprueftAm/);
  });

  /** Im Lehrplan steht nichts — dann steht auch im Befund nichts. Der Ersatz war nur ein Lesehilfsmittel. */
  it('traegt die Freigabe leer, nicht mit einem Platzhalter', () => {
    const e = wartendVon(pruefeLehrplan({ ...gut, geprueftVon: '' }, KEINE));
    expect(e.lehrplan.geprueftVon).toBe('');
    expect(e.lehrplan.geprueftAm).toBe('');
  });

  it('bleibt ungueltig, wenn neben der Freigabe noch etwas fehlt — und zeigt alle Maengel', () => {
    const e = pruefeLehrplan({ ...gut, geprueftVon: '', stand: 'a13701e' }, KEINE);
    if (e.ok) throw new Error('Erwartet war ein Fehlschlag.');
    expect(e.wartet).toBeFalsy();
    expect(e.maengel).toHaveLength(2);
    expect(e.maengel.join(' ')).toMatch(/Review-Gate/);
    expect(e.maengel.join(' ')).toMatch(/40 Zeichen/);
  });
});
```

Im selben `describe('lehrplaeneAusTexten', …)` den Test „legt einen Lehrplan, der auf die Freigabe wartet, zu den ungueltigen — mit der Meldung des Gates" **vollständig ersetzen** durch:

```ts
  it('legt einen Lehrplan, dem nur die Freigabe fehlt, zu den wartenden', () => {
    // Genau der Zustand zwischen Durchgang A und dem Menschen: geprueftVon ist
    // leer. Der Bau soll daran nicht scheitern, und die Seite zeigt seine
    // Zahlen — markiert, nicht als Warnung ohne Zahlen.
    const { gueltig, wartend, ungueltig } = lehrplaeneAusTexten(
      { '/lehrplan/wartet.yaml': yaml({ geprueftVon: '' }) },
      KEINE,
    );
    expect(gueltig).toEqual([]);
    expect(ungueltig).toEqual([]);
    expect(wartend.map((l) => l.quelle)).toEqual(['awesome-llm-apps']);
  });
```

und den Test „liefert zwei leere Listen, wenn es keinen Lehrplan gibt" durch:

```ts
  it('liefert drei leere Listen, wenn es keinen Lehrplan gibt', () => {
    expect(lehrplaeneAusTexten({}, KEINE)).toEqual({ gueltig: [], wartend: [], ungueltig: [] });
  });
```

In `tests/lehrplan-lehrmaterial.test.ts` den Block `describe('Abschnitte - grund und lektion', …)` suchen und **unmittelbar davor** einfügen:

```ts
/**
 * Wartet auf Freigabe — bei Lehrmaterial ist das der Normalfall gleich nach
 * dem Einlesen: Der Lehrplan traegt alle Abschnitte als `offen`, und
 * `geprueftVon` ist noch leer. Er ist trotzdem lesbar.
 */
describe('Buch und Folien - wartet auf Freigabe', () => {
  it('wartet, wenn nur die Freigabe fehlt — und liefert die Abschnitte mit', () => {
    const e = pruefeLehrplan(folien({ geprueftVon: '' }), LEKTIONEN);
    if (e.ok) throw new Error('Erwartet war ein Fehlschlag.');
    if (!e.wartet) throw new Error(`Erwartet war „wartet": ${e.maengel.join(' | ')}`);
    expect(e.maengel).toEqual(['geprueftVon: geprueftVon fehlt — der Lehrplan ist das Review-Gate.']);
    if (e.lehrplan.art === 'repo') throw new Error('Erwartet waren Folien.');
    expect(e.lehrplan.abschnitte).toHaveLength(2);
    expect(e.lehrplan.geprueftVon).toBe('');
  });

  it('bleibt ungueltig, wenn daneben eine Lektion fehlt — und zeigt beide Maengel', () => {
    const daten = folien({
      geprueftVon: '',
      abschnitte: [abschnitt({ status: 'lektion', lektion: 'gibt-es-nicht' })],
    });
    const e = pruefeLehrplan(daten, LEKTIONEN);
    if (e.ok) throw new Error('Erwartet war ein Fehlschlag.');
    expect(e.wartet).toBeFalsy();
    expect(e.maengel).toEqual([
      'geprueftVon: geprueftVon fehlt — der Lehrplan ist das Review-Gate.',
      'abschnitte.0.lektion: Die Lektion gibt-es-nicht gibt es nicht (inhalt/lektionen/gibt-es-nicht.mdx).',
    ]);
  });
});
```

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && npx vitest run tests/lehrplan.test.ts tests/lehrplan-lehrmaterial.test.ts 2>&1 | grep -E "Tests  |FAIL" | head -12
```
Erwartet: `Test Files  2 failed (2)` und `Tests  9 failed | 108 passed (117)` — `wartet` gibt es noch nicht, und `lehrplaeneAusTexten` liefert nur zwei Listen.

- [ ] **Schritt 2: Der Befund bekommt einen dritten Fall**

In `src/lib/lehrplan.ts` die Zeile

```ts
export type Befund = { ok: true; lehrplan: Lehrplan } | { ok: false; maengel: string[] };
```

ersetzen durch:

```ts
/**
 * Das Ergebnis der Pruefung. Drei Faelle, nicht zwei: Ein Lehrplan, dem als
 * einziges die Freigabe fehlt, ist nicht ungueltig, sondern **wartend** — der
 * Zustand zwischen Durchgang A und dem Menschen am Review-Gate. Fuer den
 * Compiler bleibt er `ok: false`; die Seite /bibliothek zeigt seine Zahlen
 * und markiert ihn.
 */
export type Befund =
  | { ok: true; lehrplan: Lehrplan }
  | { ok: false; wartet: true; lehrplan: Lehrplan; maengel: string[] }
  | { ok: false; wartet?: false; maengel: string[] };
```

`wartet` ist im dritten Fall optional, damit `werkzeug/lehrplan.mjs` weiter `{ ok: false, maengel: [...] }` zurückgeben kann, ohne geändert zu werden. Wer auf den zweiten Fall verengen will, prüft erst `!befund.ok` und dann `befund.wartet === true`.

- [ ] **Schritt 3: `pruefeLehrplan` erkennt den wartenden Zustand**

In `src/lib/lehrplan.ts` die ganze Funktion `pruefeLehrplan` samt ihrem Kommentarblock ersetzen durch:

```ts
/**
 * Die Lektionen, auf die ein Lehrplan aus Lehrmaterial zeigt, muessen es
 * geben. Das kann Zod nicht wissen; deshalb steht die Pruefung hier.
 */
function pruefeLektionen(lehrplan: Lehrplan, lektionsIds: ReadonlySet<string>): string[] {
  if (lehrplan.art === 'repo') return [];
  return lehrplan.abschnitte.flatMap((a, i) =>
    a.lektion !== undefined && !lektionsIds.has(a.lektion)
      ? [`abschnitte.${i}.lektion: Die Lektion ${a.lektion} gibt es nicht (inhalt/lektionen/${a.lektion}.mdx).`]
      : [],
  );
}

/** Die beiden Felder, deren Fehlen allein noch keinen ungueltigen Lehrplan ergibt. */
const FREIGABE = ['geprueftVon', 'geprueftAm'] as const;

/** Ein Wert, der die Schranke von `geprueftVon` passiert — nur fuer den zweiten Lesedurchgang. */
const FREIGABE_ERSATZ = 'wartet auf Freigabe';

function nurDieFreigabeFehlt(fehler: readonly z.core.$ZodIssue[]): boolean {
  return fehler.every((f) => f.path.length === 1 && FREIGABE.some((name) => f.path[0] === name));
}

/**
 * Liest denselben Lehrplan noch einmal, diesmal mit gefuellter Freigabe — nur
 * um an die uebrigen Felder zu kommen. Was zurueckkommt, traegt die Freigabe
 * wieder leer: Im Lehrplan steht nichts, also steht auch hier nichts.
 */
function mitErsetzterFreigabe(daten: unknown): Lehrplan | null {
  if (typeof daten !== 'object' || daten === null) return null;
  const zweit = LehrplanSchema.safeParse(
    { ...(daten as Record<string, unknown>), geprueftVon: FREIGABE_ERSATZ, geprueftAm: FREIGABE_ERSATZ },
    { error: deutscheMeldung },
  );
  if (!zweit.success) return null;
  const lehrplan = zweit.data;
  lehrplan.geprueftVon = '';
  lehrplan.geprueftAm = '';
  return lehrplan;
}

/**
 * Prueft einen geladenen Lehrplan. Wirft nie.
 *
 * `lektionsIds` sind die Lektionen, die es gibt. Ein Abschnitt mit
 * `status: lektion` muss auf eine davon zeigen — das kann Zod allein nicht
 * wissen, deshalb steht die Pruefung hier und nicht im Schema. Wer eine leere
 * Menge hereinreicht, bekommt jeden solchen Abschnitt als Mangel: Die Pruefung
 * faellt im Zweifel durch, nie durch.
 */
export function pruefeLehrplan(daten: unknown, lektionsIds: ReadonlySet<string>): Befund {
  const geprueft = LehrplanSchema.safeParse(daten, { error: deutscheMeldung });
  if (geprueft.success) {
    const maengel = pruefeLektionen(geprueft.data, lektionsIds);
    return maengel.length > 0 ? { ok: false, maengel } : { ok: true, lehrplan: geprueft.data };
  }

  const maengel = geprueft.error.issues.map((m) => `${m.path.join('.') || '(Wurzel)'}: ${m.message}`);
  // Fehlt ausser der Freigabe nichts, ist der Lehrplan lesbar — und wartend.
  // Kommt dabei ein weiterer Mangel heraus, bleibt er ungueltig und zeigt alle.
  const lehrplan = nurDieFreigabeFehlt(geprueft.error.issues) ? mitErsetzterFreigabe(daten) : null;
  if (lehrplan === null) return { ok: false, maengel };
  const weitere = pruefeLektionen(lehrplan, lektionsIds);
  return weitere.length > 0 ? { ok: false, maengel: [...maengel, ...weitere] } : { ok: false, wartet: true, lehrplan, maengel };
}
```

Das Schema bleibt **unverändert**: `geprueftVon` behält seine Schranke und seine Meldung, damit der Satz „geprueftVon fehlt — der Lehrplan ist das Review-Gate." wörtlich stehen bleibt. Der zweite Lesedurchgang ist nur ein Lesehilfsmittel; scheitert er — weil doch noch etwas anderes fehlt —, bleibt es beim ungültigen Befund.

- [ ] **Schritt 4: `lehrplaeneAusTexten` liefert drei Listen**

In `src/lib/lehrplan.ts` im Kommentar über `lehrplaeneAusTexten` die beiden Zeilen

```ts
 * `ungueltig`, und die Seite zeigt ihn als Warnung. Das ist auch der Zustand
 * zwischen Durchgang A und der Freigabe, in dem `geprueftVon` leer ist.
```

ersetzen durch:

```ts
 * `ungueltig`, und die Seite zeigt ihn als Warnung. Fehlt ihm nur die
 * Freigabe — der Zustand zwischen Durchgang A und dem Menschen —, steht er in
 * `wartend`: mit seinen Zahlen auf der Seite, aber markiert.
```

und die Funktion selbst durch:

```ts
export function lehrplaeneAusTexten(
  texte: Readonly<Record<string, string>>,
  lektionsIds: ReadonlySet<string>,
): { gueltig: Lehrplan[]; wartend: Lehrplan[]; ungueltig: Ungueltig[] } {
  const gueltig: Lehrplan[] = [];
  const wartend: Lehrplan[] = [];
  const ungueltig: Ungueltig[] = [];
  const eintraege = Object.entries(texte).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  for (const [pfad, text] of eintraege) {
    const datei = pfad.slice(pfad.lastIndexOf('/') + 1);
    const befund = lehrplanAusYaml(text, lektionsIds, datei);
    if (befund.ok) gueltig.push(befund.lehrplan);
    else if (befund.wartet) wartend.push(befund.lehrplan);
    else ungueltig.push({ datei, maengel: befund.maengel });
  }
  return { gueltig, wartend, ungueltig };
}
```

- [ ] **Schritt 5: Grün**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && npx vitest run tests/lehrplan.test.ts 2>&1 | grep -oE "Tests  [0-9]+ passed" && npx vitest run tests/lehrplan-lehrmaterial.test.ts 2>&1 | grep -oE "Tests  [0-9]+ passed" && npm test 2>&1 | grep -E "Tests |Test Files |FAIL" && npm run check 2>&1 | grep -E "^- [0-9]+ (error|warning|hint)" && npm run build 2>&1 | grep -E "page\(s\)"
```
Erwartet: `Tests  41 passed` · `Tests  76 passed` · **BASIS + 8** · `- 0 errors`, `- 0 warnings`, `- 0 hints` · **SEITEN** `page(s) built`. Die gebaute Seite ändert sich nicht: Der heutige Lehrplan ist freigegeben.

- [ ] **Schritt 6: Mutationsproben**

Jede Probe wird eingebaut, gemessen und **zurückgenommen**. Erwartet ist genau die Zahl roter Tests.

**Probe A** — in `nurDieFreigabeFehlt` die Zeile durch `return false;` ersetzen.
Vorhersage: 6 rote Tests (fünf in `pruefeLehrplan - wartet auf Freigabe`, einer in `lehrplaeneAusTexten`). Gemessen: genau diese 6.

**Probe B** — in `mitErsetzterFreigabe` die beiden Zeilen `lehrplan.geprueftVon = ''; lehrplan.geprueftAm = '';` streichen.
Vorhersage: 1 roter Test („traegt die Freigabe leer, nicht mit einem Platzhalter"). Gemessen: 1.

**Probe C** — in `pruefeLehrplan` die letzte Zeile durch `return { ok: false, wartet: true, lehrplan, maengel };` ersetzen (der zusätzliche Mangel wird nicht mehr geprüft).
Vorhersage: 1 roter Test in `tests/lehrplan-lehrmaterial.test.ts` („bleibt ungueltig, wenn daneben eine Lektion fehlt"). Gemessen: 1.

**Nicht gefangen, und das ist in Ordnung:** `every` → `some` in `nurDieFreigabeFehlt` ändert nichts, weil der zweite Lesedurchgang dann von selbst scheitert und `null` liefert. Die Bedingung ist eine Abkürzung, keine Schranke.

- [ ] **Schritt 7: NUL-Prüfung und Commit**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && python -c "import sys; print('NUL:', sum(open(f,'rb').read().count(b'\x00') for f in sys.argv[1:]))" src/lib/lehrplan.ts tests/lehrplan.test.ts tests/lehrplan-lehrmaterial.test.ts && git add src/lib/lehrplan.ts tests/lehrplan.test.ts tests/lehrplan-lehrmaterial.test.ts && git commit -F - <<'MSG'
feat: Lehrplan - "wartet auf Freigabe" als dritter Befund

Fehlen einem Lehrplan als einzige Maengel geprueftVon und geprueftAm, ist er
nicht ungueltig, sondern wartend: Fuer den Compiler bleibt er ok: false, die
Seite bekommt den gelesenen Lehrplan und die Markierung dazu. Ohne diesen
Zustand verschwaende die Karte samt Zahlen, sobald ein Durchgang laeuft.

lehrplaeneAusTexten liefert jetzt gueltig, wartend und ungueltig.

<CO-AUTHORED-BY>
MSG
git diff --stat HEAD~1
```
Erwartet: `NUL: 0` · `3 files changed, 164 insertions(+), 26 deletions(-)` (im Probelauf gemessen; ± wenige Zeilen sind in Ordnung, ein Vielfaches nicht).

---

## Aufgabe 2: Die Freigabe auf der Karte — und „Tabelle oder Grafik" statt „zerfallene Tabelle"

**Dateien:**
- Ändern: `src/lib/abdeckung.ts`, `src/lib/bestandstext.ts`, `src/components/Bestand.astro`, `src/pages/bibliothek.astro`, `tests/abdeckung.test.ts`, `tests/bestandstext.test.ts`, `tests/bestand-ansicht.test.ts`, `tests/bibliothek-seite.test.ts`

Zwei Dinge, die zusammengehören, weil beide die Karte betreffen.

**Die Freigabe** liest `abdeckung` am Lehrplan selbst ab: `pruefeLehrplan` liefert einen wartenden Lehrplan mit leerem `geprueftVon` und `geprueftAm`, ein freigegebener hat in beiden Feldern etwas stehen. Ein eigener Parameter wäre eine zweite Wahrheit neben der ersten.

**Der Wortlaut:** Die Regel für `tabellenverdacht` (Aufgabe 5) schlägt auch bei Diagrammen an, und zwar zu Recht — der Text eines Projektstrukturplans trägt dessen Hierarchie nicht. Am echten Material sind das in einer Datei 15 von 45 Folien. „15 Tabellen vermutlich zerfallen" wäre dafür irreführend. Das Manifestfeld heißt weiter `tabellenverdacht` (so steht es im Spec und so liest es der Compiler); die Seite sagt „mit Tabelle oder Grafik".

Die Gestaltung von `.quelle-freigabe` kommt in Aufgabe 10; bis dahin steht der Absatz unformatiert da.

- [ ] **Schritt 1: Die Tests schreiben (rot)**

In `tests/bestandstext.test.ts` den Import um `freigabezeile` ergänzen (alphabetisch vor `lueckenzeile`), im Objekt `basis` die Zeile `freigabe: 'erteilt',` vor `luecken:` einfügen und in der Tabelle von `lueckenzeile` vier erwartete Texte ändern sowie einen Fall ergänzen:

```ts
    [
      'Folien mit Bild und Tabellen',
      { art: 'dokument', einheit: 'folien', seiten: 35, nurBild: 7, tabellenverdacht: 2 },
      '7 von 35 Folien nur Bild · 2 Folien mit Tabelle oder Grafik',
    ],
    [
      'ein Buch mit einer Tabelle',
      { art: 'dokument', einheit: 'seiten', seiten: 210, nurBild: 0, tabellenverdacht: 1 },
      '1 Seite mit Tabelle oder Grafik',
    ],
    [
      'genau eine Folie mit Tabelle oder Grafik',
      { art: 'dokument', einheit: 'folien', seiten: 45, nurBild: 0, tabellenverdacht: 1 },
      '1 Folie mit Tabelle oder Grafik',
    ],
```

sowie in den beiden Fällen „ohne beides" `'keine Folie nur Bild, keine mit Tabelle oder Grafik erkannt'` und `'keine Seite nur Bild, keine mit Tabelle oder Grafik erkannt'`. Dazu ein neuer Block vor `describe('fundstelle', …)`:

```ts
describe('freigabezeile', () => {
  it('sagt bei einer wartenden Quelle, was fehlt und was deshalb nicht passiert', () => {
    expect(freigabezeile(bestand({ freigabe: 'wartet' }))).toBe(
      'Erst wenn geprueftVon und geprueftAm eingetragen sind, baut der Compiler daraus Lektionen.',
    );
  });

  it('schweigt, wenn die Freigabe erteilt ist', () => {
    expect(freigabezeile(bestand())).toBeNull();
  });
});
```

In `tests/bestand-ansicht.test.ts` bekommt `repo` die Zeile `freigabe: 'erteilt',` und `folien` die Zeile `freigabe: 'wartet',` (je unmittelbar vor `zaehlung:`). Im Test „zeigt bei Folien Fundstelle, Grund und Vorbehalt" wird `'7 von 35 Folien nur Bild · 2 Tabellen vermutlich zerfallen'` zu `'7 von 35 Folien nur Bild · 2 Folien mit Tabelle oder Grafik'`. Im Test „zeigt ungueltige Lehrplaene mit ihren Maengeln" wird der erwartete Absatz zu `'<p>Aus diesen Dateien zeigt die Seite keine Zahlen, bis ihre Mängel behoben sind.</p>'`. Und vor „sagt ohne Manifest, dass die Luecken unbekannt sind" kommen zwei Tests dazu:

```ts
  /**
   * Der Zustand gleich nach dem Einlesen: Der Lehrplan liegt da, die Zahlen
   * stimmen, nur am Review-Gate stand noch niemand. Die Markierung steht
   * unter der Kopfzeile, nicht im Kleingedruckten — und Wort fuer Wort.
   */
  it('markiert eine Quelle, die auf die Freigabe wartet, unter der Kopfzeile', async () => {
    const html = await rendere({ bestand: [folien], ohneLehrplan: [] });
    expect(html).toContain(
      '<p class="quelle-freigabe"><strong>Wartet auf Freigabe:</strong> Erst wenn geprueftVon und geprueftAm eingetragen sind, baut der Compiler daraus Lektionen.</p>',
    );
    // Die Zahlen bleiben stehen: Ein wartender Lehrplan ist kein ungueltiger.
    expect(html).toContain('<p class="quelle-zahlen">2 Abschnitte · 1 mit Lektion · 0 offen · 1 abgelehnt</p>');
    expect(html).not.toContain('bestand-warnung');
  });

  it('markiert eine freigegebene Quelle nicht', async () => {
    const html = await rendere({ bestand: [repo], ohneLehrplan: [] });
    expect(html).not.toContain('quelle-freigabe');
  });
```

In `tests/abdeckung.test.ts` kommt vor `function prinzip(…)` eine Hilfe dazu:

```ts
/** Ein Lehrplan, dem nur die Freigabe fehlt — der Zustand gleich nach dem Einlesen. */
function wartender(daten: unknown, lektionen: ReadonlySet<string> = LEKTIONEN): Lehrplan {
  const e = pruefeLehrplan(daten, lektionen);
  if (e.ok) throw new Error('Die Vorlage ist freigegeben, erwartet war ein wartender Lehrplan.');
  if (!e.wartet) throw new Error(`Erwartet war „wartet": ${e.maengel.join(' | ')}`);
  return e.lehrplan;
}
```

und am Ende der Datei ein neuer Block:

```ts
/**
 * Die Freigabe liest `abdeckung` am Lehrplan ab, nicht an einem zweiten
 * Parameter: `pruefeLehrplan` liefert einen wartenden Lehrplan mit leerem
 * `geprueftVon`, ein freigegebener hat dort einen Namen stehen.
 */
describe('abdeckung - Freigabe', () => {
  const lektionsAbschnitt = abschnitt('m7-1', 1, 'lektion', { lektion: 'pauschal-heisst-nicht-komplett' });
  const wartendeFolien = {
    art: 'folien',
    quelle: 'bauch-projektmanagement',
    titel: 'Projektmanagement',
    stand: HASH,
    geprueftVon: '',
    geprueftAm: '',
    abschnitte: [lektionsAbschnitt],
  };

  it('traegt erteilt, wo geprueftVon und geprueftAm stehen', () => {
    const { bestand } = abdeckung([repo('awesome', prinzip('p-1'), prinzip('p-2'))], KEINE_MANIFESTE, LEKTIONEN);
    expect(bestand[0]?.freigabe).toBe('erteilt');
  });

  it('traegt wartet, wo beide leer sind — und zaehlt die Abschnitte trotzdem', () => {
    const { bestand } = abdeckung([wartender(wartendeFolien)], KEINE_MANIFESTE, LEKTIONEN);
    expect(bestand[0]?.freigabe).toBe('wartet');
    expect(bestand[0]?.zaehlung).toEqual({ gesamt: 1, mitLektion: 1, offen: 0, beauftragt: 0, abgelehnt: 0 });
  });

  it('zaehlt die Lektion eines wartenden Lehrplans nicht zu denen ohne Lehrplaneintrag', () => {
    const { ohneLehrplan } = abdeckung([wartender(wartendeFolien)], KEINE_MANIFESTE, LEKTIONEN);
    expect(ohneLehrplan).toEqual(['lektion-a', 'lektion-b']);
  });
});
```

Im Block „der heutige Bestand" wird `expect(bestand.map((b) => [b.quelle, b.art]))` zu `expect(bestand.map((b) => [b.quelle, b.art, b.freigabe]))` mit dem erwarteten Wert `[['awesome-llm-apps', 'repo', 'erteilt']]`, und die Zerlegung von `lehrplaeneAusTexten` nimmt `wartend` mit (`expect(wartend).toEqual([])`).

In `tests/bibliothek-seite.test.ts` kommt vor „kommt ohne Insel und ohne Skript aus" ein Test dazu:

```ts
  it('rechnet wartende Lehrplaene mit, statt sie fallen zu lassen', () => {
    // Ein Lehrplan, dem nur die Freigabe fehlt, ist weder gueltig noch
    // ungueltig. Wer ihn hier vergisst, laesst die Karte samt Zahlen
    // verschwinden — genau der Fall, den das Einlesen als Erstes erzeugt.
    const seite = lies('src', 'pages', 'bibliothek.astro');
    expect(seite).toContain('const { gueltig, wartend, ungueltig } = lehrplaeneAusTexten(lehrplantexte, lektionsIds);');
    expect(seite).toContain('abdeckung([...gueltig, ...wartend], manifesteAusTexten(manifesttexte), lektionsIds)');
  });
```

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && npx vitest run tests/abdeckung.test.ts tests/bestandstext.test.ts tests/bestand-ansicht.test.ts tests/bibliothek-seite.test.ts 2>&1 | grep -E "Tests  |Test Files " | head -4
```
Erwartet: `Test Files  4 failed (4)` und `Tests  14 failed | 61 passed (75)` — `freigabe`, `freigabezeile` und der neue Wortlaut gibt es noch nicht.

- [ ] **Schritt 2: `Freigabe` in `src/lib/abdeckung.ts`**

Unmittelbar vor `export type Zaehlung = {` einfügen:

```ts
/**
 * Ob am Review-Gate schon jemand stand. `wartet` ist der Zustand zwischen
 * Durchgang A und dem Menschen: `geprueftVon` und `geprueftAm` sind leer.
 * Gerechnet wird ein wartender Lehrplan wie ein freigegebener — seine
 * Lektionen stehen nicht als „ohne Lehrplaneintrag" da —, die Karte sagt
 * aber dazu, dass der Compiler aus ihm noch nichts baut.
 */
export type Freigabe = 'erteilt' | 'wartet';
```

In `export type Bestand` nach `readonly auflage?: string;` einfügen:

```ts
  readonly freigabe: Freigabe;
```

Unmittelbar vor `export function abdeckung(` einfügen:

```ts
/**
 * Die Freigabe steht im Lehrplan selbst: `pruefeLehrplan` liefert einen
 * wartenden Lehrplan mit leerem `geprueftVon` und `geprueftAm`, ein
 * freigegebener hat in beiden Feldern etwas stehen. Ein eigener Parameter
 * waere eine zweite Wahrheit neben der ersten.
 */
function freigabeVon(l: Lehrplan): Freigabe {
  return l.geprueftVon.trim() === '' || l.geprueftAm.trim() === '' ? 'wartet' : 'erteilt';
}
```

und im Rückgabeobjekt von `abdeckung` nach der Zeile mit `auflage:` einfügen:

```ts
        freigabe: freigabeVon(l),
```

- [ ] **Schritt 3: Wortlaute in `src/lib/bestandstext.ts`**

Im Fall `'dokument'` von `lueckenzeile` die Liste `teile` und die Rückgabe ersetzen durch:

```ts
      const teile = [
        ...(l.nurBild > 0 ? [`${l.nurBild} von ${anzahl(l.seiten, eine, viele)} nur Bild`] : []),
        // Nicht „Tabellen vermutlich zerfallen": Die Regel schlaegt auch bei
        // Diagrammen an, und zwar zu Recht — der Text eines Strukturplans
        // traegt dessen Hierarchie nicht. Gemessen an einem Foliensatz mit
        // Projektstrukturplaenen: 14 von 45 Folien.
        ...(l.tabellenverdacht > 0 ? [`${anzahl(l.tabellenverdacht, eine, viele)} mit Tabelle oder Grafik`] : []),
      ];
      return teile.length > 0 ? teile.join(' · ') : `keine ${eine} nur Bild, keine mit Tabelle oder Grafik erkannt`;
```

Unmittelbar vor dem Kommentar zu `fundstelle` einfügen:

```ts
/**
 * Der Satz unter der Kopfzeile, solange die Freigabe fehlt — oder `null`,
 * wenn sie erteilt ist. Er sagt, was fehlt und was deshalb nicht passiert:
 * Die Zahlen stimmen, der Compiler baut daraus aber noch keine Lektionen.
 */
export function freigabezeile(b: Bestand): string | null {
  return b.freigabe === 'wartet'
    ? 'Erst wenn geprueftVon und geprueftAm eingetragen sind, baut der Compiler daraus Lektionen.'
    : null;
}
```

- [ ] **Schritt 4: Die Markierung in `src/components/Bestand.astro`**

Den Import um `freigabezeile` ergänzen (alphabetisch nach `aufklapptext`), und

```astro
    <p class="quelle-kopf">{kopfzeile(b)}</p>
    <p class="quelle-zahlen">{zahlenzeile(b)}</p>
```

ersetzen durch:

```astro
    <p class="quelle-kopf">{kopfzeile(b)}</p>
    {freigabezeile(b) !== null && (
      <p class="quelle-freigabe"><strong>Wartet auf Freigabe:</strong> {freigabezeile(b)}</p>
    )}
    <p class="quelle-zahlen">{zahlenzeile(b)}</p>
```

Im Warnblock `data-warnung="ungueltig"` den Absatz

```astro
    <p>
      Aus diesen Dateien zeigt die Seite keine Zahlen. Auch ein Lehrplan, der noch auf die
      Freigabe wartet — geprueftVon ist leer —, steht hier.
    </p>
```

ersetzen durch:

```astro
    <p>Aus diesen Dateien zeigt die Seite keine Zahlen, bis ihre Mängel behoben sind.</p>
```

Der Hinweis auf wartende Lehrpläne fällt weg: Sie stehen nicht mehr hier.

- [ ] **Schritt 5: Die Seite reicht die wartenden Lehrpläne durch**

In `src/pages/bibliothek.astro` die beiden Zeilen

```ts
const { gueltig, ungueltig } = lehrplaeneAusTexten(lehrplantexte, lektionsIds);
const bestand = abdeckung(gueltig, manifesteAusTexten(manifesttexte), lektionsIds);
```

ersetzen durch:

```ts
// Wartende Lehrplaene zaehlen mit: Ihre Zahlen stimmen, nur die Freigabe
// fehlt. Die Karte markiert das; `abdeckung` liest es am leeren `geprueftVon`.
const { gueltig, wartend, ungueltig } = lehrplaeneAusTexten(lehrplantexte, lektionsIds);
const bestand = abdeckung([...gueltig, ...wartend], manifesteAusTexten(manifesttexte), lektionsIds);
```

- [ ] **Schritt 6: Grün**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && for f in abdeckung bestandstext bestand-ansicht bibliothek-seite; do printf "%-18s " "$f"; npx vitest run "tests/$f.test.ts" 2>&1 | grep -oE "Tests  [0-9]+ passed"; done && npm test 2>&1 | grep -E "Tests |Test Files |FAIL" && npm run check 2>&1 | grep -E "^- [0-9]+ (error|warning|hint)" && npm run build 2>&1 | grep -E "page\(s\)"
```
Erwartet:

```text
abdeckung          Tests  22 passed
bestandstext       Tests  35 passed
bestand-ansicht    Tests  13 passed
bibliothek-seite   Tests  5 passed
```

dazu **BASIS + 17** · `- 0 errors`, `- 0 warnings`, `- 0 hints` · **SEITEN** `page(s) built`.

- [ ] **Schritt 7: Mutationsproben**

**Probe A** — `freigabeVon` gibt immer `'erteilt'` zurück.
Vorhersage: 1 roter Test („traegt wartet, wo beide leer sind"). Gemessen: 1.

**Probe B** — in `lueckenzeile` den alten Wortlaut `${anzahl(l.tabellenverdacht, 'Tabelle', 'Tabellen')} vermutlich zerfallen` zurückschreiben.
Vorhersage: 3 rote in `bestandstext`, 1 in `bestand-ansicht`. Gemessen: genau 4.

**Probe C** — in `bibliothek.astro` `abdeckung([...gueltig, ...wartend], …)` durch `abdeckung(gueltig, …)` ersetzen.
Vorhersage: 1 roter Test in `bibliothek-seite`. Gemessen: 1. **Wichtig:** Kein anderer Test fängt das — heute gibt es keinen wartenden Lehrplan. Erst Aufgabe 11 zeigt die Wirkung am gebauten Stand.

- [ ] **Schritt 8: NUL-Prüfung und Commit**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && python -c "import sys; print('NUL:', sum(open(f,'rb').read().count(b'\x00') for f in sys.argv[1:]))" src/lib/abdeckung.ts src/lib/bestandstext.ts src/components/Bestand.astro src/pages/bibliothek.astro tests/abdeckung.test.ts tests/bestandstext.test.ts tests/bestand-ansicht.test.ts tests/bibliothek-seite.test.ts && git add src/lib/abdeckung.ts src/lib/bestandstext.ts src/components/Bestand.astro src/pages/bibliothek.astro tests/abdeckung.test.ts tests/bestandstext.test.ts tests/bestand-ansicht.test.ts tests/bibliothek-seite.test.ts && git commit -F - <<'MSG'
feat: Bibliothek - Markierung "Wartet auf Freigabe" und neuer Wortlaut fuer Tabellen

Die Karte einer Quelle, deren Lehrplan nur auf die Freigabe wartet, bleibt
mit ihren Zahlen stehen und traegt unter der Kopfzeile den Hinweis, dass der
Compiler daraus noch nichts baut. abdeckung liest die Freigabe am Lehrplan ab.

Die Lueckenzeile sagt "N Folien mit Tabelle oder Grafik" statt "N Tabellen
vermutlich zerfallen": Die Regel schlaegt auch bei Diagrammen an, und zwar zu
Recht - der Text eines Strukturplans traegt dessen Hierarchie nicht.

<CO-AUTHORED-BY>
MSG
git diff --stat HEAD~1
```
Erwartet: `NUL: 0` · `8 files changed, 148 insertions(+), 18 deletions(-)`.

---

## Aufgabe 3: Abhängigkeiten, das Fixture-Skript und sechs Test-PDF

**Dateien:**
- Neu: `werkzeug/fixtures/erzeuge.mjs`, `tests/fixtures-erzeugen.test.ts`, sechs PDF unter `tests/fixtures/`
- Ändern: `package.json`, `package-lock.json`

`pdfjs-dist` steht **ohne Dach** in `package.json`: Die erwarteten Werte aller folgenden Tests hängen an der Extraktion genau dieser Fassung. `pdf-lib` erzeugt die Fixtures und darf ein Dach tragen, weil nur das Skript es benutzt. Beide unter `devDependencies` — der Bau der Seite braucht keine von beiden.

`@napi-rs/canvas` kommt als optionale Abhängigkeit von pdf.js mit (38 MB, vorgebaut, kein Kompilieren, keine Installationsskripte). **Nicht bekämpfen:** `--omit=optional` würfe auch die vorgebauten Binaries für Astro, esbuild und sharp hinaus, und der Bau ginge nicht mehr. Gemessen: Die Textextraktion liefert ohne Canvas dieselben Zahlen; er wird nur zum Rendern gebraucht.

Eine Fixture, die niemand herstellen kann, ist eine Behauptung. Deshalb ein Skript — und ein Test, der prüft, dass die committeten Dateien genau die sind, die es erzeugt.

- [ ] **Schritt 1: Die beiden Abhängigkeiten**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && npm install --save-dev --save-exact pdfjs-dist@6.3.289 && npm install --save-dev pdf-lib@^1.17.1 && git diff package.json
```
Erwartet: `added 3 packages, and audited 402 packages in <n>s` und `found 0 vulnerabilities`, danach `added 5 packages, and audited 407 packages in <n>s`. Der Diff von `package.json` zeigt genau zwei neue Zeilen unter `devDependencies`:

```json
    "pdf-lib": "^1.17.1",
    "pdfjs-dist": "6.3.289",
```

Das Lockfile wächst um rund 324 Zeilen; darin steht `@napi-rs/canvas` als `"optional": true`. **Anhalten und melden,** wenn `pdfjs-dist` mit Dach in `package.json` landet oder wenn `found 0 vulnerabilities` nicht dasteht.

- [ ] **Schritt 2: Das Skript `werkzeug/fixtures/erzeuge.mjs` anlegen**

```js
#!/usr/bin/env node
/**
 * Erzeugt die Test-PDFs unter `tests/fixtures/`.
 *
 * Aufruf: `node werkzeug/fixtures/erzeuge.mjs tests/fixtures`
 *
 * Warum ein Skript und nicht ein paar beigelegte Dateien: Eine Fixture, die
 * niemand herstellen kann, ist eine Behauptung. Hier steht, was in jeder
 * Datei steckt — Briefkopf mit laufender Foliennummer, Agendafolie,
 * Titellaeufe, eine Bildfolie, eine Tabellenfolie, eine Silbentrennung —, und
 * genau darauf zeigen die Tests.
 *
 * Deterministisch: feste Erstellungs- und Aenderungszeit, fester Producer,
 * `useObjectStreams: false`. Zweimal erzeugt ergibt byte-gleiche Dateien;
 * `tests/fixtures-erzeugen.test.ts` haelt das fest. Waere es nicht so, aenderte
 * jeder Lauf die committeten PDFs.
 *
 * Der Text ist erfunden. Nichts hier stammt aus fremdem Lehrmaterial.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { crc32, deflateSync } from 'node:zlib';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

/**
 * @typedef {import('pdf-lib').PDFPage} PDFPage
 * @typedef {{ doc: PDFDocument, schrift: { normal: import('pdf-lib').PDFFont, fett: import('pdf-lib').PDFFont }, logo: import('pdf-lib').PDFImage, foto: import('pdf-lib').PDFImage }} Mappe
 * @typedef {{ art: 'titel' | 'agenda' | 'bild' | 'tabelle' | 'inhalt', titel?: string }} Folieneintrag
 */

/** Feste Zeitstempel: ohne sie steht in jedem Lauf ein anderes Datum im PDF. */
const FEST = new Date('2026-01-01T00:00:00Z');
/** @type {[number, number]} */
const QUER = [842, 595];
/** @type {[number, number]} */
const HOCH = [595, 842];

/** Die Dateien, die dieses Skript schreibt — in der Reihenfolge der Ausgabe. */
export const FIXTURES = [
  'folien-agenda.pdf',
  'folien-laeufe.pdf',
  'folien-gleichmaessig.pdf',
  'folien-scan.pdf',
  'folien-wenig-text.pdf',
  'buch-hochformat.pdf',
];

// ---------------------------------------------------------------------------
// PNG ohne Abhaengigkeit: IHDR/IDAT/IEND von Hand, `crc32` kommt aus node:zlib.

/**
 * @param {number} breite
 * @param {number} hoehe
 * @param {(x: number, y: number) => number[]} farbe
 * @returns {Buffer}
 */
function png(breite, hoehe, farbe) {
  const zeilenbreite = breite * 3 + 1;
  const roh = Buffer.alloc(zeilenbreite * hoehe);
  for (let y = 0; y < hoehe; y++) {
    for (let x = 0; x < breite; x++) roh.set(farbe(x, y), y * zeilenbreite + 1 + x * 3);
  }
  /** @type {(typ: string, daten: Buffer) => Buffer} */
  const block = (typ, daten) => {
    const laenge = Buffer.alloc(4);
    laenge.writeUInt32BE(daten.length);
    const inhalt = Buffer.concat([Buffer.from(typ, 'latin1'), daten]);
    const pruefsumme = Buffer.alloc(4);
    pruefsumme.writeUInt32BE(crc32(inhalt));
    return Buffer.concat([laenge, inhalt, pruefsumme]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(breite, 0);
  ihdr.writeUInt32BE(hoehe, 4);
  ihdr[8] = 8; // Bittiefe
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    block('IHDR', ihdr),
    block('IDAT', deflateSync(roh)),
    block('IEND', Buffer.alloc(0)),
  ]);
}

/** Das Logo im Briefkopf: dieselbe Groesse an derselben Stelle auf jeder Folie. */
const LOGO = png(12, 4, (x) => (x < 6 ? [0, 70, 140] : [200, 30, 30]));
/** Ein Bild im Inhalt — wechselnde Groesse, wechselnde Stelle. */
const FOTO = png(16, 12, (x, y) => [(x * 16) & 255, (y * 21) & 255, 120]);

/** @returns {Promise<Mappe>} */
async function neuesDokument() {
  const doc = await PDFDocument.create();
  doc.setCreationDate(FEST);
  doc.setModificationDate(FEST);
  doc.setProducer('kernbohrung-fixtures');
  doc.setCreator('kernbohrung-fixtures');
  return {
    doc,
    schrift: {
      normal: await doc.embedFont(StandardFonts.Helvetica),
      fett: await doc.embedFont(StandardFonts.HelveticaBold),
    },
    logo: await doc.embedPng(LOGO),
    foto: await doc.embedPng(FOTO),
  };
}

// ---------------------------------------------------------------------------
// Foliensaetze

/**
 * Der Briefkopf: drei Zeilen und das Logo, auf jeder Folie an derselben
 * Stelle, im oberen und unteren Randstreifen. Die Foliennummer laeuft mit —
 * daran scheitert die Regel „auf jeder Seite identisch".
 *
 * @param {PDFPage} seite
 * @param {Mappe} m
 * @param {number} nummer
 */
function briefkopf(seite, m, nummer) {
  seite.drawText('Projektmanagement – Fixture-Vorlesung – Musterhochschule', { x: 60, y: 551, size: 12, font: m.schrift.normal });
  seite.drawText(`Folie ${nummer}`, { x: 760, y: 551, size: 11, font: m.schrift.normal });
  seite.drawText('Lehrstuhl Beispiel · Sommersemester 2026', { x: 45, y: 34, size: 9, font: m.schrift.normal });
  seite.drawImage(m.logo, { x: 712, y: 16, width: 84, height: 28 });
}

/** @type {(seite: PDFPage, m: Mappe, text: string) => void} */
const folientitel = (seite, m, text) => seite.drawText(text, { x: 90, y: 495, size: 20, font: m.schrift.fett });

/**
 * @param {PDFPage} seite
 * @param {Mappe} m
 * @param {string[]} zeilen
 * @param {number} [y0]
 */
function punkte(seite, m, zeilen, y0 = 430) {
  zeilen.forEach((z, i) => seite.drawText(z, { x: 100, y: y0 - i * 26, size: 15, font: m.schrift.normal }));
}

const SAETZE = [
  'Die Projektsteuerung koordiniert alle Beteiligten im Auftrag des Bauherrn.',
  'Leistungsbilder beschreiben, welche Aufgaben wann zu erfüllen sind.',
  'Termine und Kosten werden je Leistungsphase fortgeschrieben.',
  'Abweichungen werden früh gemeldet und mit Maßnahmen hinterlegt.',
];

/**
 * Eine Tabellenfolie: Liniengitter (6 waagrecht, 5 senkrecht) und Zahlenzeilen.
 *
 * @param {PDFPage} seite
 * @param {Mappe} m
 * @param {string} titel
 */
function tabellenfolie(seite, m, titel) {
  folientitel(seite, m, titel);
  const x0 = 100;
  const y0 = 420;
  const spaltenbreite = [220, 130, 130, 130];
  const zeilenhoehe = 30;
  const zeilen = [
    ['Kostengruppe', '2025', '2026', 'Diff. %'],
    ['300 Bauwerk', '1.250.000', '1.310.000', '4,8'],
    ['400 Technik', '480.000', '512.000', '6,7'],
    ['500 Außenanlagen', '95.000', '92.500', '-2,6'],
    ['700 Nebenkosten', '310.000', '318.000', '2,6'],
  ];
  zeilen.forEach((zeile, r) => {
    let x = x0;
    zeile.forEach((zelle, c) => {
      seite.drawText(zelle, { x: x + 6, y: y0 - r * zeilenhoehe + 9, size: 12, font: r ? m.schrift.normal : m.schrift.fett });
      x += spaltenbreite[c];
    });
  });
  const breite = spaltenbreite.reduce((a, b) => a + b, 0);
  for (let r = 0; r <= zeilen.length; r++) {
    const y = y0 - r * zeilenhoehe + 30;
    seite.drawLine({ start: { x: x0, y }, end: { x: x0 + breite, y }, thickness: 0.8, color: rgb(0, 0, 0) });
  }
  let x = x0;
  for (let c = 0; c <= spaltenbreite.length; c++) {
    seite.drawLine({ start: { x, y: y0 + 30 }, end: { x, y: y0 + 30 - zeilen.length * zeilenhoehe }, thickness: 0.8, color: rgb(0, 0, 0) });
    x += spaltenbreite[c] ?? 0;
  }
}

/**
 * Die Folien eines Satzes als Plan, bevor gezeichnet wird.
 *
 * @param {{ agenda: boolean, laeufe: boolean }} form
 * @returns {Folieneintrag[]}
 */
function folienplan({ agenda, laeufe }) {
  /** @type {Folieneintrag[]} */
  const plan = [{ art: 'titel' }];
  if (agenda) plan.push({ art: 'agenda' });
  /** @type {(...titel: string[]) => void} */
  const inhalt = (...titel) => titel.forEach((t) => plan.push({ art: 'inhalt', titel: t }));
  if (laeufe) {
    inhalt(
      'Grundlagen der Planung',
      'Grundlagen der Planung',
      'Grundlagen der Planung',
      'Planungsphasen im Überblick',
      'Planungsphasen im Überblick',
      'Begriffe der Projekt-steuerung',
    );
    plan.push({ art: 'bild' });
    inhalt('Zusammenfassung Grundlagen', 'Kosten und Termine', 'Kosten und Termine', 'Kosten und Termine');
    plan.push({ art: 'tabelle', titel: 'Kosten und Termine' });
    inhalt(
      'Terminplanung',
      'Terminplanung',
      'Kostenkennwerte',
      'Beispielrechnung',
      'Risiken im Projekt',
      'Risiken im Projekt',
      'Risiken im Projekt',
      'Risikobewertung',
      'Risikobewertung',
      'Risikosteuerung',
      'Vertragliche Risikoverteilung',
      'Fazit',
    );
  } else {
    plan.push({ art: 'bild' });
    plan.push({ art: 'tabelle', titel: 'Kostenübersicht' });
    // Jeder Titel verschieden: keine Agenda, kein Titellauf, also gleichmaessig.
    for (let i = 1; plan.length < 32; i++) {
      inhalt(`Thema ${i}: ${['Planung', 'Vergabe', 'Bau', 'Abnahme'][i % 4]} im Detail`);
    }
  }
  return plan;
}

/**
 * @param {string} ziel
 * @param {string} name
 * @param {{ agenda: boolean, laeufe: boolean }} form
 * @returns {Promise<number>}
 */
async function foliensatz(ziel, name, form) {
  const m = await neuesDokument();
  folienplan(form).forEach((eintrag, i) => {
    const nummer = i + 1;
    const seite = m.doc.addPage(QUER);
    briefkopf(seite, m, nummer);
    if (eintrag.art === 'titel') {
      seite.drawText('Modul 99', { x: 170, y: 384, size: 15, font: m.schrift.normal });
      seite.drawText('Fixture: Musterprojekt Neubau', { x: 170, y: 355, size: 26, font: m.schrift.fett });
    } else if (eintrag.art === 'agenda') {
      seite.drawText('AGENDA', { x: 166, y: 403, size: 22, font: m.schrift.fett });
      ['Grundlagen der Planung', 'Kosten und Termine', 'Risiken im Projekt'].forEach((z, k) =>
        seite.drawText(z, { x: 226, y: 335 - k * 48, size: 20, font: m.schrift.normal }),
      );
    } else if (eintrag.art === 'bild') {
      // Nur Bild, kein Nutztext — nach Abzug des Briefkopfs bleibt nichts.
      seite.drawImage(m.foto, { x: 150, y: 120, width: 540, height: 380 });
    } else if (eintrag.art === 'tabelle') {
      tabellenfolie(seite, m, eintrag.titel ?? '');
    } else if (eintrag.titel === 'Begriffe der Projekt-steuerung') {
      // Silbentrennung am Zeilenende und ein Ergaenzungsstrich, im selben Textfeld.
      folientitel(seite, m, 'Begriffe');
      punkte(seite, m, [
        '• Die Projekt-',
        'steuerung ist eine delegierbare Bauherrenaufgabe.',
        '• Kosten-',
        'und Terminplanung gehören zusammen.',
      ]);
    } else {
      folientitel(seite, m, eintrag.titel ?? '');
      punkte(seite, m, [
        `• ${SAETZE[nummer % 4]}`,
        `• ${SAETZE[(nummer + 1) % 4]}`,
        `• Beispiel ${nummer}: Planung, Vergabe und Ausführung im Überblick.`,
      ]);
    }
  });
  return speichere(m.doc, ziel, name);
}

/**
 * Fuenf Seiten, die nur ein Bild tragen: keine Textebene, das Einlesen bricht ab.
 *
 * @param {string} ziel
 * @returns {Promise<number>}
 */
async function scan(ziel) {
  const m = await neuesDokument();
  for (let i = 0; i < 5; i++) m.doc.addPage(QUER).drawImage(m.foto, { x: 0, y: 0, width: 842, height: 595 });
  return speichere(m.doc, ziel, 'folien-scan.pdf');
}

/**
 * Sechs Folien mit je einem kurzen Satz: wenig Text ist kein Abbruchgrund.
 *
 * @param {string} ziel
 * @returns {Promise<number>}
 */
async function wenigText(ziel) {
  const m = await neuesDokument();
  // Verschiedene Saetze an wechselnder Stelle: Saetze, die sich nur in einer
  // Zahl unterscheiden und gleich stehen, waeren Beiwerk — ein anderer Fall.
  const saetze = [
    'Kosten früh schätzen.',
    'Termine laufend fortschreiben.',
    'Risiken benennen und bewerten.',
    'Verträge sorgfältig prüfen.',
    'Nachträge dokumentieren.',
    'Abnahme vorbereiten.',
  ];
  saetze.forEach((satz, i) => {
    m.doc.addPage(QUER).drawText(satz, { x: 100, y: 300 - i * 20, size: 18, font: m.schrift.normal });
  });
  return speichere(m.doc, ziel, 'folien-wenig-text.pdf');
}

// ---------------------------------------------------------------------------
// Hochformat: das Gegenstueck zur Art-Erkennung. 2b-1 liest es nicht ein.

const WOERTER = ['Planung', 'Bauherr', 'Vertrag', 'Leistung', 'Termin', 'Kosten', 'Qualität', 'Risiko', 'Projekt', 'Steuerung', 'Abnahme', 'Nachtrag', 'Vergabe', 'Ausführung', 'Honorar', 'Bauablauf'];

/**
 * Ein Satz aus festem Zufall: derselbe Index ergibt denselben Satz.
 *
 * @param {number} n
 * @returns {string}
 */
function satz(n) {
  let s = n * 7919 + 13;
  const zufall = () => ((s = (s * 1103515245 + 12345) % 2147483648), s / 2147483648);
  const woerter = Array.from({ length: 9 + Math.floor(zufall() * 6) }, () => WOERTER[Math.floor(zufall() * WOERTER.length)].toLowerCase());
  woerter[0] = woerter[0][0].toUpperCase() + woerter[0].slice(1);
  return `${woerter.join(' ')} und die übrigen Beteiligten stimmen sich ab.`;
}

/**
 * @param {string} ziel
 * @returns {Promise<number>}
 */
async function hochformat(ziel) {
  const m = await neuesDokument();
  let seitenNummer = 0;
  let satzNummer = 0;
  for (let kapitel = 1; kapitel <= 3; kapitel++) {
    for (let s = 0; s < 4; s++) {
      const seite = m.doc.addPage(HOCH);
      seitenNummer++;
      // Kolumnentitel und Seitenzahl: das Beiwerk eines Buchs.
      seite.drawText(`Musterbuch Projektmanagement · Kapitel ${kapitel}`, { x: 70, y: 800, size: 9, font: m.schrift.normal });
      seite.drawText(`— ${seitenNummer} —`, { x: 280, y: 30, size: 9, font: m.schrift.normal });
      let y = 760;
      if (s === 0) {
        seite.drawText(`Kapitel ${kapitel}`, { x: 70, y, size: 20, font: m.schrift.fett });
        y -= 30;
      }
      for (let i = 0; i < 45 && y > 70; i++) {
        let zeile = satz(satzNummer++);
        // Eine Silbentrennung am Zeilenende, alle siebzehn Saetze.
        if (satzNummer % 17 === 0) zeile = zeile.replace(/ und die übrigen.*$/, ' sowie die Projekt-');
        if (satzNummer % 17 === 1 && satzNummer > 1) zeile = `steuerung ${zeile[0].toLowerCase()}${zeile.slice(1)}`;
        seite.drawText(zeile.slice(0, 95), { x: 70, y, size: 10.5, font: m.schrift.normal });
        y -= 15;
      }
    }
  }
  return speichere(m.doc, ziel, 'buch-hochformat.pdf');
}

// ---------------------------------------------------------------------------

/**
 * @param {PDFDocument} doc
 * @param {string} ziel
 * @param {string} name
 * @returns {Promise<number>}
 */
async function speichere(doc, ziel, name) {
  const bytes = await doc.save({ useObjectStreams: false });
  writeFileSync(path.join(ziel, name), bytes);
  return bytes.length;
}

/**
 * Schreibt alle Fixtures nach `ziel`.
 *
 * @param {string} ziel Ordner, wird angelegt, wenn er fehlt
 * @returns {Promise<Map<string, number>>} Dateiname -> Groesse in Bytes
 */
export async function erzeugeFixtures(ziel) {
  mkdirSync(ziel, { recursive: true });
  /** @type {Map<string, number>} */
  const groessen = new Map();
  groessen.set('folien-agenda.pdf', await foliensatz(ziel, 'folien-agenda.pdf', { agenda: true, laeufe: true }));
  groessen.set('folien-laeufe.pdf', await foliensatz(ziel, 'folien-laeufe.pdf', { agenda: false, laeufe: true }));
  groessen.set('folien-gleichmaessig.pdf', await foliensatz(ziel, 'folien-gleichmaessig.pdf', { agenda: false, laeufe: false }));
  groessen.set('folien-scan.pdf', await scan(ziel));
  groessen.set('folien-wenig-text.pdf', await wenigText(ziel));
  groessen.set('buch-hochformat.pdf', await hochformat(ziel));
  return groessen;
}

// Direkt aufgerufen: schreiben und auflisten. Importiert: nur die Funktion.
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const ziel = path.resolve(process.argv[2] ?? 'tests/fixtures');
  const groessen = await erzeugeFixtures(ziel);
  for (const [name, bytes] of groessen) console.log(`${name.padEnd(26)} ${String(bytes).padStart(7)} Bytes`);
  console.log(`${groessen.size} Fixtures in ${ziel}`);
}
```

- [ ] **Schritt 3: Das Skript als npm-Befehl eintragen**

In `package.json` unter `scripts` nach der Zeile `"ingest": …` einfügen:

```json
    "fixtures": "node werkzeug/fixtures/erzeuge.mjs tests/fixtures",
```

- [ ] **Schritt 4: Die Fixtures erzeugen**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && npm run fixtures
```
Erwartet, wörtlich (die Größen sind byte-genau):

```text
folien-agenda.pdf            28395 Bytes
folien-laeufe.pdf            27464 Bytes
folien-gleichmaessig.pdf     34954 Bytes
folien-scan.pdf               3367 Bytes
folien-wenig-text.pdf         4156 Bytes
buch-hochformat.pdf          41180 Bytes
6 Fixtures in <projektwurzel>\tests\fixtures
```

Weicht eine Größe ab, ist entweder `pdf-lib` eine andere Fassung oder am Skript wurde etwas geändert: anhalten und melden — die Zahlen der Aufgaben 4 bis 8 hängen daran.

- [ ] **Schritt 5: Der Test auf Herstellbarkeit**

`tests/fixtures-erzeugen.test.ts` anlegen:

```ts
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { FIXTURES, erzeugeFixtures } from '../werkzeug/fixtures/erzeuge.mjs';

/**
 * Die Test-PDFs liegen committet unter `tests/fixtures/` — und sind
 * herstellbar.
 *
 * Beides zusammen ist der Punkt: Committet, damit ein Testlauf keine PDFs
 * bauen muss; herstellbar, damit niemand raten muss, was in ihnen steckt. Der
 * Test erzeugt sie in ein Temp-Verzeichnis und vergleicht Byte fuer Byte.
 * Schlaegt er fehl, ist entweder das Skript nicht mehr deterministisch (feste
 * Zeitstempel, fester Producer, `useObjectStreams: false`) oder die
 * committeten Dateien sind nicht mehr die, die es erzeugt.
 *
 * Umgebung `node`: Das Skript schreibt Dateien und laedt `pdf-lib`.
 */
const WURZEL = path.resolve(__dirname, '..');
const FIXTUREORDNER = path.join(WURZEL, 'tests', 'fixtures');

describe('werkzeug/fixtures/erzeuge.mjs', () => {
  it('erzeugt genau die committeten Dateien, Byte fuer Byte gleich', async () => {
    const temp = mkdtempSync(path.join(tmpdir(), 'kernbohrung-fixtures-'));
    try {
      const groessen = await erzeugeFixtures(temp);
      expect([...groessen.keys()]).toEqual([...FIXTURES]);
      for (const name of FIXTURES) {
        const erzeugt = readFileSync(path.join(temp, name));
        const committet = readFileSync(path.join(FIXTUREORDNER, name));
        // Erst die Laenge: Ein Unterschied von zwei Bytes soll nicht als
        // Vergleich zweier 28-KB-Puffer in der Ausgabe landen.
        expect(`${name}: ${erzeugt.length} Bytes`).toBe(`${name}: ${committet.length} Bytes`);
        expect(erzeugt.equals(committet), `${name} weicht ab`).toBe(true);
      }
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  });

  it('haelt den Fixtureordner frei von allem, was das Skript nicht schreibt', () => {
    expect(readdirSync(FIXTUREORDNER).sort()).toEqual([...FIXTURES].sort());
  });
});
```

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && npx vitest run tests/fixtures-erzeugen.test.ts 2>&1 | grep -E "Tests  |Duration"
```
Erwartet: `Tests  2 passed (2)`, Dauer rund 1,3 s — weit unter der Frist von 20 s.

- [ ] **Schritt 6: Alles zusammen**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && npm test 2>&1 | grep -E "Tests |Test Files |FAIL" && npm run check 2>&1 | grep -E "^- [0-9]+ (error|warning|hint)" && npm run build 2>&1 | grep -E "page\(s\)"
```
Erwartet: **BASIS + 19** in 46 Testdateien · `- 0 errors`, `- 0 warnings`, `- 0 hints` · **SEITEN** `page(s) built`. Dass `astro check` still bleibt, ist hier kein Nebenbefund: Es prüft `werkzeug/**/*.mjs` mit, und ohne die JSDoc-Typen im Skript meldete es 45 Fehler (gemessen).

- [ ] **Schritt 7: Mutationsproben**

**Probe A** — in `neuesDokument` die Zeile `doc.setCreationDate(FEST);` streichen.
Vorhersage: 1 roter Test („erzeugt genau die committeten Dateien"), mit einem Längenunterschied in der Meldung. Gemessen: 1.

**Probe B** — `'buch-hochformat.pdf'` aus der Liste `FIXTURES` nehmen.
Vorhersage: 2 rote Tests — die Liste stimmt nicht mehr, und der Ordner enthält eine Datei, die das Skript nicht schreibt. Gemessen: 2.

- [ ] **Schritt 8: NUL-Prüfung und Commit**

Die sechs PDF sind **binär** und gehören nicht in die NUL-Prüfung.

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && python -c "import sys; print('NUL:', sum(open(f,'rb').read().count(b'\x00') for f in sys.argv[1:]))" werkzeug/fixtures/erzeuge.mjs tests/fixtures-erzeugen.test.ts package.json && git add package.json package-lock.json werkzeug/fixtures/erzeuge.mjs tests/fixtures-erzeugen.test.ts tests/fixtures/folien-agenda.pdf tests/fixtures/folien-laeufe.pdf tests/fixtures/folien-gleichmaessig.pdf tests/fixtures/folien-scan.pdf tests/fixtures/folien-wenig-text.pdf tests/fixtures/buch-hochformat.pdf && git commit -F - <<'MSG'
feat: pdfjs-dist und pdf-lib als devDependencies, Fixture-Skript und sechs Test-PDFs

pdfjs-dist auf genau 6.3.289 festgenagelt, ohne Dach: Die erwarteten Werte
der Tests haengen an der Extraktion dieser Fassung. pdf-lib erzeugt die
Fixtures. Beide nur zur Entwicklung - der Bau der Seite braucht keins von
beiden.

werkzeug/fixtures/erzeuge.mjs schreibt sechs PDFs deterministisch nach
tests/fixtures/: drei Foliensaetze (Agenda, Titellaeufe, gleichmaessig), ein
Satz ohne Textebene, einer mit wenig Text und ein Hochformat fuer die
Art-Erkennung. Ein Test erzeugt sie in ein Temp-Verzeichnis und vergleicht
Byte fuer Byte.

<CO-AUTHORED-BY>
MSG
git show --stat HEAD | tail -12
```
Erwartet: `NUL: 0` · zehn Dateien, davon sechs als `Bin 0 -> <n> bytes`, zusammen `782 insertions(+)`.

---

## Aufgabe 4: `dokument.mjs`, Teil 1 — ein PDF zu Seiten lesen

**Dateien:**
- Neu: `werkzeug/adapter/dokument.mjs` (Teil 1; Teil 2 kommt in Aufgabe 5), `tests/dokument-seiten.test.ts`

Der einzige Ort im Projekt, an dem pdf.js vorkommt. Die Grenze zum reinen Teil ist keine Ordnungsliebe: Was danach kommt, lässt sich mit erfundenen Seiten testen — schnell, ohne PDF und ohne fremdes Lehrmaterial —, und ein Ausführer im Browser (Weg B) könnte beide Teile unverändert benutzen, denn pdf.js läuft auch dort.

Drei Dinge, die hier gemessen und nicht geraten sind:

- **Nur der legacy-Build läuft unter Node 24.** Der moderne Build — das ist auch `main` des Pakets — meldet „Please use the legacy build in Node.js environments" und scheitert an **allen** Dateien mit `hashOriginal.toHex is not a function`: `Uint8Array.prototype.toHex` gibt es in V8 13.6 noch nicht.
- **Die vier Datenpfade sind nicht Kosmetik.** Ohne sie meldet pdf.js fehlende Standardschriften und nicht dekodierbare JBIG2-Bilder — bei neun echten Foliensätzen 61 Zeilen auf der Konsole, die wie Fehler aussehen. Sie müssen auf `/` enden; `path.join(…) + path.sep` endet unter Windows auf dem Trennzeichen des Systems und wird mit „Invalid factory url" abgewiesen.
- **pdf.js liefert Textelemente in Stromreihenfolge, nicht in Lesereihenfolge.** Auf einer Agendafolie des echten Materials stand der Titel im Strom hinter der Liste. Ohne Sortierung nach y wäre „die oberste Zeile ist der Titel" schlicht falsch — und die Agendaerkennung in Aufgabe 6 hinge in der Luft.

Bilder bekommen ihre **Platzierung** als Schlüssel (Größe und Lage, auf 4 pt gerundet). Der Grund: „Die Seite trägt ein Bild" trennt nichts — alle 199 Seiten des echten Materials tragen das Logo im Briefkopf. Waagrechte und senkrechte Linien werden gezählt, weil ein Liniengitter die einzige inhaltsfreie Gegenprobe auf eine Tabelle ist.

- [ ] **Schritt 1: Die Tests schreiben (rot)**

`tests/dokument-seiten.test.ts` anlegen:

```ts
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { ladePdfjs, liesSeiten, werteOperatorenAus, zeilenAus } from '../werkzeug/adapter/dokument.mjs';

/**
 * Der Teil von `dokument.mjs`, der ein PDF liest.
 *
 * Zwei Sorten Test: `zeilenAus` und `werteOperatorenAus` bekommen erfundene
 * Elemente und Operatoren — schnell und ohne pdf.js. `liesSeiten` laeuft an
 * den Fixtures unter `tests/fixtures/`, die `werkzeug/fixtures/erzeuge.mjs`
 * schreibt. Kein Test liest `quellen/` oder fremdes Lehrmaterial.
 *
 * Umgebung `node`: pdf.js laedt seinen Worker per dynamischem Import und
 * liest seine Daten mit `fs.readFile`.
 */
const FIXTUREN = path.resolve(__dirname, 'fixtures');
const liesFixture = (name: string) => new Uint8Array(readFileSync(path.join(FIXTUREN, name)));

/** Ein Textelement in der Form, die `getTextContent().items` liefert. */
function element(str: string, x: number, y: number, groesse = 12, breite = str.length * groesse * 0.5) {
  return { str, width: breite, height: groesse, transform: [groesse, 0, 0, groesse, x, y] };
}

/** Dasselbe, aber gedreht — eine Achsenbeschriftung. */
function gedreht(str: string, x: number, y: number, groesse = 12) {
  return { str, width: str.length * groesse * 0.5, height: groesse, transform: [0, groesse, -groesse, 0, x, y] };
}

describe('zeilenAus', () => {
  it('setzt Stuecke auf gleicher Grundlinie zu einer Zeile zusammen, nach x sortiert', () => {
    const zeilen = zeilenAus([element('welt', 60, 400), element('Hallo ', 10, 400)]);
    expect(zeilen.map((z) => z.text)).toEqual(['Hallo welt']);
    expect(zeilen[0]?.groesse).toBe(12);
  });

  it('haelt Stuecke derselben Zeile zusammen, auch wenn die Grundlinie leicht wackelt', () => {
    // Eine Zahl neben einem Wort sitzt selten auf demselben y. Die Toleranz
    // haengt an der kleineren Schriftgroesse: 0,3 x 12 = 3,6 pt.
    const zusammen = zeilenAus([element('Kosten', 10, 400, 20, 60), element('1.250', 80, 401.5, 12)]);
    expect(zusammen.map((z) => z.text)).toEqual(['Kosten 1.250']);
    // Mehr als die Toleranz: zwei Zeilen, die obere zuerst.
    const getrennt = zeilenAus([element('Kosten', 10, 400, 20, 60), element('1.250', 80, 405, 12)]);
    expect(getrennt.map((z) => z.text)).toEqual(['1.250', 'Kosten']);
  });

  it('trennt zwei Textfelder auf gleicher Hoehe an der grossen Luecke', () => {
    // Das linke Stueck endet bei x = 34, das rechte beginnt bei 400: mehr als
    // das Doppelte der Schriftgroesse. Zwei Textfelder sind zwei Zeilen.
    const zeilen = zeilenAus([element('links', 10, 400, 12, 24), element('rechts', 400, 400)]);
    expect(zeilen.map((z) => z.text)).toEqual(['links', 'rechts']);
  });

  it('setzt ein Leerzeichen erst ab der Wortluecke', () => {
    const eng = zeilenAus([element('Pro', 10, 400, 12, 18), element('jekt', 28, 400)]);
    expect(eng.map((z) => z.text)).toEqual(['Projekt']);
    const weit = zeilenAus([element('Pro', 10, 400, 12, 18), element('jekt', 31, 400)]);
    expect(weit.map((z) => z.text)).toEqual(['Pro jekt']);
  });

  it('verwirft Elemente, die nur aus Leerraum bestehen', () => {
    const zeilen = zeilenAus([element('a', 10, 400, 12, 6), element('   ', 16, 400, 12, 18), element('b', 34, 400)]);
    expect(zeilen.map((z) => z.text)).toEqual(['a b']);
  });

  it('liest von oben nach unten, auch wenn der Strom anders sortiert ist', () => {
    // Am echten Material stand der Titel einer Agendafolie im Strom hinter der
    // Liste. Ohne die Sortierung nach y waere „oberste Zeile = Titel" falsch.
    const zeilen = zeilenAus([element('Punkt eins', 100, 300), element('Titel', 100, 500, 24)]);
    expect(zeilen.map((z) => z.text)).toEqual(['Titel', 'Punkt eins']);
  });

  it('haengt gedrehte Beschriftungen als eigene Zeilen an und markiert sie', () => {
    const zeilen = zeilenAus([element('Titel', 100, 500), gedreht('Kosten', 40, 200)]);
    expect(zeilen.map((z) => [z.text, z.gedreht ?? false])).toEqual([
      ['Titel', false],
      ['Kosten', true],
    ]);
  });

  it('laesst doppelt gesetzten Text nur einmal stehen', () => {
    // Schein-Fettdruck: dasselbe Stueck ein zweites Mal, um Haaresbreite versetzt.
    const zeilen = zeilenAus([element('Fett', 10, 400), element('Fett', 10.2, 400)]);
    expect(zeilen.map((z) => z.text)).toEqual(['Fett']);
  });
});

describe('werteOperatorenAus', () => {
  // Nur die Operatoren, um die es hier geht — pdf.js wird dafuer nicht geladen.
  const OPS = {
    save: 10,
    restore: 11,
    transform: 12,
    paintFormXObjectBegin: 74,
    paintFormXObjectEnd: 75,
    constructPath: 91,
    paintImageXObject: 85,
  };
  const BILD_OPS = new Set([85]);
  const werte = (paare: [number, unknown][]) =>
    werteOperatorenAus({ fnArray: paare.map(([fn]) => fn), argsArray: paare.map(([, args]) => args) }, OPS, BILD_OPS);
  /** Ein Pfad, wie ihn pdf.js liefert: `args[1][0]` traegt die Zahlen. */
  const pfad = (daten: number[]): [number, unknown] => [OPS.constructPath, [null, [daten]]];
  const strich = (x0: number, y0: number, x1: number, y1: number) => pfad([0, x0, y0, 1, x1, y1]);

  it('macht aus einem Bild einen Schluessel aus Groesse und Lage', () => {
    const { bilder } = werte([
      [OPS.transform, [84, 0, 0, 28, 712, 16]],
      [OPS.paintImageXObject, ['img_1']],
    ]);
    expect(bilder).toEqual(['84x28@712,16']);
  });

  it('gibt zwei fast gleich platzierten Bildern denselben Schluessel', () => {
    // Ohne das Raster von 4 pt faende die Wiederkehr das Logo im Briefkopf nicht.
    const eins = werte([[OPS.transform, [84, 0, 0, 28, 712, 16]], [OPS.paintImageXObject, ['a']]]);
    const zwei = werte([[OPS.transform, [83.4, 0, 0, 27.6, 713.1, 17.2]], [OPS.paintImageXObject, ['b']]]);
    expect(zwei.bilder).toEqual(eins.bilder);
  });

  it('stellt die Transformation hinter restore wieder her', () => {
    const { bilder } = werte([
      [OPS.save, []],
      [OPS.transform, [540, 0, 0, 380, 150, 120]],
      [OPS.restore, []],
      [OPS.transform, [84, 0, 0, 28, 712, 16]],
      [OPS.paintImageXObject, ['logo']],
    ]);
    expect(bilder).toEqual(['84x28@712,16']);
  });

  it('zaehlt waagrechte und senkrechte Linien getrennt', () => {
    const { gitter } = werte([
      strich(100, 400, 500, 400),
      strich(100, 370, 500, 370),
      strich(100, 400, 100, 300),
      strich(200, 400, 200, 300),
      strich(300, 400, 300, 300),
    ]);
    expect(gitter).toEqual({ hLinien: 2, vLinien: 3 });
  });

  it('zaehlt kurze Striche und Kurven nicht als Tabellenlinien', () => {
    const { gitter } = werte([
      strich(100, 400, 120, 400), // 20 pt waagrecht: eine Unterstreichung
      strich(100, 400, 100, 405), // 5 pt senkrecht: ein Trennzeichen
      pfad([0, 100, 100, 2, 150, 150, 200, 200, 400, 100]), // eine Kurve
    ]);
    expect(gitter).toEqual({ hLinien: 0, vLinien: 0 });
  });
});

describe('liesSeiten an den Fixtures', () => {
  it('liest Seitenzahl, Format und Zeilen eines Foliensatzes', async () => {
    const geladen = await ladePdfjs();
    const { seiten } = await liesSeiten(liesFixture('folien-agenda.pdf'), geladen);
    expect(seiten).toHaveLength(26);
    expect(seiten.map((s) => [Math.round(s.breite), Math.round(s.hoehe)])).toContainEqual([842, 595]);
    expect(new Set(seiten.map((s) => `${Math.round(s.breite)}x${Math.round(s.hoehe)}`))).toEqual(new Set(['842x595']));
    // Die Agendafolie, von oben nach unten: Briefkopf, Titel, drei Punkte, Fusszeile.
    expect(seiten[1]?.zeilen.map((z) => z.text)).toEqual([
      'Projektmanagement – Fixture-Vorlesung – Musterhochschule',
      'Folie 2',
      'AGENDA',
      'Grundlagen der Planung',
      'Kosten und Termine',
      'Risiken im Projekt',
      'Lehrstuhl Beispiel · Sommersemester 2026',
    ]);
    expect(seiten[1]?.zeilen.map((z) => z.groesse)).toEqual([12, 11, 22, 20, 20, 20, 9]);
  });

  it('erkennt das Logo an derselben Platzierung auf jeder Folie', async () => {
    const geladen = await ladePdfjs();
    const { seiten } = await liesSeiten(liesFixture('folien-agenda.pdf'), geladen);
    expect(new Set(seiten.map((s) => s.bilder[0]))).toEqual(new Set(['84x28@712,16']));
    // Die Bildfolie traegt daneben ein zweites, anders platziertes Bild.
    expect(seiten[8]?.bilder).toEqual(['84x28@712,16', '540x380@152,120']);
  });

  it('findet das Liniengitter der Tabellenfolie und nur dort', async () => {
    const geladen = await ladePdfjs();
    const { seiten } = await liesSeiten(liesFixture('folien-agenda.pdf'), geladen);
    expect(seiten[13]?.gitter).toEqual({ hLinien: 6, vLinien: 5 });
    expect(seiten.filter((s) => s.gitter.hLinien >= 5 && s.gitter.vLinien >= 5).map((s) => s.nummer)).toEqual([14]);
  });

  it('liest das Hochformat als hoch und den Satz ohne Textebene als leer', async () => {
    const geladen = await ladePdfjs();
    const buch = await liesSeiten(liesFixture('buch-hochformat.pdf'), geladen);
    expect(buch.seiten).toHaveLength(12);
    expect([Math.round(buch.seiten[0]!.breite), Math.round(buch.seiten[0]!.hoehe)]).toEqual([595, 842]);

    const scan = await liesSeiten(liesFixture('folien-scan.pdf'), geladen);
    expect(scan.seiten).toHaveLength(5);
    expect(scan.seiten.every((s) => s.zeilen.length === 0)).toBe(true);
    expect(scan.seiten.every((s) => s.bilder.length === 1)).toBe(true);
  });

  it('gibt die vier Datenpfade mit Schraegstrich am Ende weiter', async () => {
    // Unter Windows endet `path.join` auf dem Trennzeichen des Systems; pdf.js weist solche Pfade mit
    // „Invalid factory url … must include trailing slash" ab. Der Fehler faellt
    // erst beim Lesen auf, nicht beim Laden.
    const { optionen } = await ladePdfjs();
    const pfade = ['standardFontDataUrl', 'cMapUrl', 'wasmUrl', 'iccUrl'].map((name) => String(optionen[name]));
    expect(pfade.map((p) => p.endsWith('/'))).toEqual([true, true, true, true]);
    expect(pfade.some((p) => p.includes('\\'))).toBe(false);
  });

  it('meldet beim Laden und beim Lesen nichts auf der Konsole', async () => {
    // Ohne die vier Datenpfade meldet pdf.js fehlende Standardschriften und
    // nicht dekodierbare Bilder — je Datei mehrere Zeilen, die wie ein Fehler
    // aussehen und keiner sind.
    const gesammelt: unknown[] = [];
    const echt = { log: console.log, warn: console.warn, error: console.error };
    console.log = (...t: unknown[]) => gesammelt.push(t);
    console.warn = (...t: unknown[]) => gesammelt.push(t);
    console.error = (...t: unknown[]) => gesammelt.push(t);
    try {
      const geladen = await ladePdfjs();
      await liesSeiten(liesFixture('folien-agenda.pdf'), geladen);
    } finally {
      Object.assign(console, echt);
    }
    expect(gesammelt).toEqual([]);
  });
});
```

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && npx vitest run tests/dokument-seiten.test.ts 2>&1 | grep -E "Tests  |Error" | head -4
```
Erwartet: `Tests  no tests` und `Error: Cannot find module '../werkzeug/adapter/dokument.mjs' imported from …/tests/dokument-seiten.test.ts`.

- [ ] **Schritt 2: `werkzeug/adapter/dokument.mjs` anlegen**

Der Ordner `werkzeug/adapter/` gibt es schon (`git.mjs` liegt darin). Die Datei endet nach `zeilenAus`; Aufgabe 5 hängt Teil 2 an.

```js
/**
 * Datei -> Seiten. Der einzige Ort im Projekt, an dem pdf.js vorkommt.
 *
 * Zwei Teile mit scharfer Grenze:
 *   `liesSeiten(bytes, geladen)`  liest ein PDF: Rohzeilen je Seite, Seitenformat,
 *                                Bildplatzierungen, waagrechte und senkrechte Linien.
 *   der Rest von `dokument.mjs`   rechnet daraus, ohne pdf.js und ohne Datei.
 *
 * Die Grenze ist keine Ordnungsliebe: Der zweite Teil laesst sich mit
 * erfundenen Seiten testen — schnell, ohne PDF und ohne fremdes Lehrmaterial —,
 * und ein Ausfuehrer im Browser (Weg B) koennte beide Teile unveraendert
 * benutzen, denn pdf.js laeuft auch dort.
 */
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

/**
 * Gleiche Grundlinie, solange der Hoehenunterschied unter drei Zehnteln der
 * kleineren Schriftgroesse bleibt.
 */
const ZEILE_TOLERANZ = 0.3;

/**
 * Eine Luecke ueber dem Doppelten der Schriftgroesse trennt: Zwei Textfelder
 * auf gleicher Hoehe sind zwei Zeilen, nicht eine.
 */
const SPALTEN_LUECKE = 2;

/** Ab dieser Luecke steht zwischen zwei Stuecken ein Leerzeichen. */
const WORT_LUECKE = 0.15;

/**
 * Bildplatzierungen werden auf 4 pt gerundet, bevor sie verglichen werden.
 * Ohne das Raster faende die Wiederkehr das Logo im Briefkopf nicht, weil
 * seine Koordinaten sich in der dritten Nachkommastelle unterscheiden.
 */
const BILD_RASTER = 4;

/**
 * @typedef {{ text: string, groesse: number, y: number, x0: number, x1: number, gedreht?: boolean }} Zeile
 * @typedef {{ hLinien: number, vLinien: number }} Gitter
 * @typedef {{ nummer: number, breite: number, hoehe: number, zeilen: Zeile[], bilder: string[], gitter: Gitter }} RohSeite
 * @typedef {{ pdfjs: any, optionen: Record<string, unknown>, bildOps: Set<number> }} Pdfjs
 */

// ---------------------------------------------------------------------------
// pdf.js laden

/**
 * Genau diese drei Meldungen kommen beim Laden, wenn `@napi-rs/canvas` fehlt —
 * und nur sie werden geschluckt.
 *
 * Ueber `verbosity` geht das nicht: Sie erscheinen beim Laden des Moduls,
 * bevor `getDocument` die Stufe setzt. Der Canvas ist eine optionale
 * Abhaengigkeit von pdf.js und wird nur zum Rendern gebraucht; die
 * Textextraktion liefert ohne ihn dieselben Zahlen (gemessen an neun
 * Foliensaetzen: gleiche Zeichenzahl, gleiche Bildoperatoren). Wer mit
 * `npm ci --omit=optional` installiert, soll deshalb keine Meldung sehen, die
 * wie ein Fehler aussieht.
 */
const IMPORT_MELDUNGEN = [/^Warning: Cannot load "@napi-rs\/canvas"/, /^Warning: Cannot polyfill `(DOMMatrix|Path2D)`/];

/**
 * Laedt pdf.js und die Pfade zu seinen Daten.
 *
 * Nur der legacy-Build laeuft unter Node 24: Der moderne Build meldet „Please
 * use the legacy build in Node.js environments" und scheitert an
 * `Uint8Array.prototype.toHex`, das es in V8 13.6 noch nicht gibt.
 *
 * Die vier Datenpfade sind nicht Kosmetik. Ohne sie meldet pdf.js je Datei
 * fehlende Standardschriften und nicht dekodierbare JBIG2-Bilder — bei neun
 * Foliensaetzen 61 Zeilen auf der Konsole. Mit ihnen: keine. Sie muessen auf
 * `/` enden; `path.join(...) + path.sep` endet unter Windows auf `\` und wird
 * mit „Invalid factory url" abgewiesen.
 *
 * @param {string} [basisOrdner] wo pdfjs-dist liegt; sonst ueber die Aufloesung
 * @returns {Promise<Pdfjs>}
 */
export async function ladePdfjs(basisOrdner) {
  const require = createRequire(import.meta.url);
  const basis = basisOrdner ?? path.dirname(require.resolve('pdfjs-dist/package.json'));
  const warn = console.warn;
  console.warn = (...teile) => {
    if (!IMPORT_MELDUNGEN.some((muster) => muster.test(String(teile[0])))) warn(...teile);
  };
  let pdfjs;
  try {
    pdfjs = await import(pathToFileURL(path.join(basis, 'legacy/build/pdf.mjs')).href);
  } finally {
    console.warn = warn;
  }
  /** @type {(name: string) => string} */
  const ordner = (name) => `${path.join(basis, name).replaceAll(path.sep, '/')}/`;
  const optionen = {
    // ERRORS (0): Ein beschaedigtes PDF soll die Konsole nicht fluten. Die
    // Ursachen stellen aber die Datenpfade ab, nicht die Stufe.
    verbosity: pdfjs.VerbosityLevel.ERRORS,
    standardFontDataUrl: ordner('standard_fonts'),
    cMapUrl: ordner('cmaps'),
    wasmUrl: ordner('wasm'),
    iccUrl: ordner('iccs'),
  };
  const bildOps = new Set(
    Object.entries(pdfjs.OPS)
      .filter(([name]) => /^paint.*Image|^paintSolidColorImageMask$/.test(name))
      .map(([, wert]) => Number(wert)),
  );
  return { pdfjs, optionen, bildOps };
}

// ---------------------------------------------------------------------------
// Teil 1: pdf.js -> Rohseiten

/**
 * Liest ein PDF.
 *
 * Aufgeraeumt wird mit `ladeaufgabe.destroy()`: `PDFDocumentProxy.destroy()`
 * gibt es in 6.3 nicht mehr.
 *
 * @param {Uint8Array} bytes
 * @param {Pdfjs} geladen
 * @returns {Promise<{ seiten: RohSeite[] }>}
 */
export async function liesSeiten(bytes, geladen) {
  const { pdfjs, optionen, bildOps } = geladen;
  const ladeaufgabe = pdfjs.getDocument({ data: bytes, ...optionen });
  try {
    const doc = await ladeaufgabe.promise;
    /** @type {RohSeite[]} */
    const seiten = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const seite = await doc.getPage(n);
      // getViewport beruecksichtigt /Rotate — die gedrehte Seite ist die,
      // die man sieht, und nur sie entscheidet ueber quer oder hoch.
      const sichtfeld = seite.getViewport({ scale: 1 });
      const textinhalt = await seite.getTextContent();
      const operatoren = await seite.getOperatorList();
      const grafik = werteOperatorenAus(operatoren, pdfjs.OPS, bildOps);
      seiten.push({
        nummer: n,
        breite: sichtfeld.width,
        hoehe: sichtfeld.height,
        zeilen: zeilenAus(textinhalt.items),
        bilder: grafik.bilder,
        gitter: grafik.gitter,
      });
      seite.cleanup();
    }
    return { seiten };
  } finally {
    await ladeaufgabe.destroy();
  }
}

// --- Operatorliste ----------------------------------------------------------

/** @type {(m: number[], n: ArrayLike<number>) => number[]} Zwei Matrizen [a b c d e f] multiplizieren. */
const mal = (m, n) => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];

/** @type {(m: number[], x: number, y: number) => number[]} Einen Punkt durch die Matrix schicken. */
const punkt = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

/**
 * Subpfade aus den Pfaddaten: 0 moveTo, 1 lineTo, 2 curveTo,
 * 3 quadraticCurveTo, 4 closePath.
 *
 * @param {ArrayLike<number>} daten
 * @returns {{ punkte: number[][], kurve: boolean }[]}
 */
function subpfade(daten) {
  /** @type {{ punkte: number[][], kurve: boolean }[]} */
  const aus = [];
  /** @type {{ punkte: number[][], kurve: boolean } | null} */
  let aktuell = null;
  for (let i = 0; i < daten.length; ) {
    const op = daten[i++];
    if (op === 0) {
      aktuell = { punkte: [[daten[i], daten[i + 1]]], kurve: false };
      aus.push(aktuell);
      i += 2;
    } else if (op === 1) {
      aktuell?.punkte.push([daten[i], daten[i + 1]]);
      i += 2;
    } else if (op === 2) {
      if (aktuell) {
        aktuell.kurve = true;
        aktuell.punkte.push([daten[i + 4], daten[i + 5]]);
      }
      i += 6;
    } else if (op === 3) {
      if (aktuell) {
        aktuell.kurve = true;
        aktuell.punkte.push([daten[i + 2], daten[i + 3]]);
      }
      i += 4;
    } else if (op !== 4) break;
  }
  return aus;
}

/** Eine Linie zaehlt ab dieser Dicke nicht mehr als Linie, sondern als Flaeche. */
const LINIE_DICKE = 2.5;
/** Kuerzere waagrechte Striche sind Unterstreichungen, keine Tabellenlinien. */
const LINIE_WAAGRECHT_MIN = 30;
/** Kuerzere senkrechte Striche sind Trennzeichen, keine Spaltenlinien. */
const LINIE_SENKRECHT_MIN = 10;

/**
 * Wertet die Operatorliste einer Seite aus — ohne ein einziges Zeichen Text.
 *
 * Zwei Dinge kommen dabei heraus:
 *
 * 1. **Jedes Bild mit seiner Platzierung** (Groesse und Lage, auf 4 pt
 *    gerundet) als Schluessel. Daran erkennt man ein Logo, das auf jeder Seite
 *    an derselben Stelle steht: „mindestens ein Bild" trennt sonst gar nichts
 *    — am echten Material trug jede der 199 Seiten eines, naemlich das Logo.
 * 2. **Achsparallele Linien.** Das ist die einzige inhaltsfreie Gegenprobe auf
 *    eine Tabelle: Ein Liniengitter ist eines, gleich was in den Zellen steht.
 *
 * Die laufende Transformation wird ueber save/restore/transform und
 * Form-XObjects verfolgt; ohne das liegen alle Bilder im Einheitsquadrat.
 *
 * @param {{ fnArray: ArrayLike<number>, argsArray: any[] }} operatoren
 * @param {Record<string, number>} OPS
 * @param {Set<number>} bildOps
 * @returns {{ bilder: string[], gitter: Gitter }}
 */
export function werteOperatorenAus(operatoren, OPS, bildOps) {
  let ctm = [1, 0, 0, 1, 0, 0];
  /** @type {number[][]} */
  const stapel = [];
  /** @type {string[]} */
  const bilder = [];
  const waagrecht = new Set();
  const senkrecht = new Set();
  /** @type {(wert: number) => number} */
  const raster = (wert) => Math.round(wert / BILD_RASTER) * BILD_RASTER;

  for (let i = 0; i < operatoren.fnArray.length; i++) {
    const fn = operatoren.fnArray[i];
    const args = operatoren.argsArray[i];
    if (fn === OPS.save) stapel.push(ctm);
    else if (fn === OPS.restore) ctm = stapel.pop() ?? [1, 0, 0, 1, 0, 0];
    else if (fn === OPS.transform) ctm = mal(ctm, args);
    else if (fn === OPS.paintFormXObjectBegin) {
      stapel.push(ctm);
      if (args?.[0] && args[0].length === 6) ctm = mal(ctm, [...args[0]]);
    } else if (fn === OPS.paintFormXObjectEnd) ctm = stapel.pop() ?? [1, 0, 0, 1, 0, 0];
    else if (bildOps.has(fn)) {
      // Ein Bild fuellt das Einheitsquadrat unter der laufenden Transformation.
      const [x0, y0] = punkt(ctm, 0, 0);
      const [x1, y1] = punkt(ctm, 1, 1);
      bilder.push(
        `${raster(Math.abs(x1 - x0))}x${raster(Math.abs(y1 - y0))}@${raster(Math.min(x0, x1))},${raster(Math.min(y0, y1))}`,
      );
    } else if (fn === OPS.constructPath) {
      const daten = args?.[1]?.[0];
      if (!daten || !daten.length) continue;
      for (const subpfad of subpfade(daten)) {
        if (subpfad.kurve || subpfad.punkte.length < 2) continue;
        const ecken = subpfad.punkte.map(([x, y]) => punkt(ctm, x, y));
        const xs = ecken.map((e) => e[0]);
        const ys = ecken.map((e) => e[1]);
        const x0 = Math.min(...xs);
        const x1 = Math.max(...xs);
        const y0 = Math.min(...ys);
        const y1 = Math.max(...ys);
        const breite = x1 - x0;
        const hoehe = y1 - y0;
        if (hoehe <= LINIE_DICKE && breite >= LINIE_WAAGRECHT_MIN) waagrecht.add(Math.round((y0 + y1) / 2));
        else if (breite <= LINIE_DICKE && hoehe >= LINIE_SENKRECHT_MIN) senkrecht.add(Math.round((x0 + x1) / 2));
      }
    }
  }
  return { bilder, gitter: { hLinien: waagrecht.size, vLinien: senkrecht.size } };
}

// --- Textelemente -> Zeilen -------------------------------------------------

/**
 * Textelemente zu Zeilen zusammensetzen.
 *
 * pdf.js liefert die Elemente in **Stromreihenfolge, nicht in
 * Lesereihenfolge** — auf einer Agendafolie des echten Materials kam der
 * Titel nach der Liste. Ohne die Sortierung nach y waere „die oberste Zeile
 * ist der Titel" schlicht falsch.
 *
 * Gruppiert wird nach Grundlinie, getrennt an grossen Luecken (zwei
 * Textfelder nebeneinander sind zwei Zeilen). Leerzeichen-Elemente fallen
 * weg; ihre Breite zeigt sich ohnehin als Luecke. Gedrehte Elemente —
 * Achsenbeschriftungen — stehen als eigene Zeilen hinten und sind markiert:
 * Sie haben keine sinnvolle Lage in der Leseordnung.
 *
 * @param {readonly any[]} elemente wie `getTextContent().items`
 * @returns {Zeile[]}
 */
export function zeilenAus(elemente) {
  const teile = [];
  for (const element of elemente) {
    if (!('str' in element) || !element.str || !element.str.trim()) continue;
    const [a, b, c, d, e, f] = element.transform;
    const gedreht = Math.abs(b) > 1e-3 || Math.abs(c) > 1e-3;
    const groesse = Math.hypot(c, d) || Math.hypot(a, b) || element.height || 1;
    teile.push({ text: element.str, x: e, y: f, breite: element.width, groesse, gedreht });
  }

  const waagrecht = teile.filter((t) => !t.gedreht).sort((p, q) => q.y - p.y || p.x - q.x);
  /** @type {{ y: number, groesse: number, teile: typeof teile }[]} */
  const reihen = [];
  for (const teil of waagrecht) {
    const letzte = reihen[reihen.length - 1];
    if (letzte && Math.abs(letzte.y - teil.y) <= ZEILE_TOLERANZ * Math.min(letzte.groesse, teil.groesse)) {
      letzte.teile.push(teil);
      letzte.groesse = Math.max(letzte.groesse, teil.groesse);
    } else {
      reihen.push({ y: teil.y, groesse: teil.groesse, teile: [teil] });
    }
  }

  const zeilen = [];
  for (const reihe of reihen) {
    reihe.teile.sort((p, q) => p.x - q.x);
    let aktuell = null;
    for (const teil of reihe.teile) {
      const groesse = Math.max(teil.groesse, aktuell?.groesse ?? 0);
      const luecke = aktuell ? teil.x - aktuell.x1 : 0;
      // Schein-Fettdruck setzt denselben Text deckungsgleich ein zweites Mal.
      if (aktuell && Math.abs(teil.x - aktuell.letztX) < 0.5 && teil.text === aktuell.letztText) continue;
      if (!aktuell || luecke > SPALTEN_LUECKE * groesse) {
        aktuell = {
          text: teil.text,
          groesse: teil.groesse,
          y: reihe.y,
          x0: teil.x,
          x1: teil.x + teil.breite,
          letztX: teil.x,
          letztText: teil.text,
        };
        zeilen.push(aktuell);
      } else {
        const leerzeichen = luecke > WORT_LUECKE * groesse && !aktuell.text.endsWith(' ') && !teil.text.startsWith(' ');
        aktuell.text += (leerzeichen ? ' ' : '') + teil.text;
        aktuell.groesse = Math.max(aktuell.groesse, teil.groesse);
        aktuell.x1 = Math.max(aktuell.x1, teil.x + teil.breite);
        aktuell.letztX = teil.x;
        aktuell.letztText = teil.text;
      }
    }
  }

  for (const teil of teile.filter((t) => t.gedreht)) {
    zeilen.push({ text: teil.text, groesse: teil.groesse, y: teil.y, x0: teil.x, x1: teil.x, gedreht: true });
  }

  return zeilen
    .map(({ text, groesse, y, x0, x1, gedreht }) => ({
      text: text.replace(/\s+/g, ' ').trim(),
      // Auf ein Zehntel gerundet: Zwei Zeilen derselben Ueberschrift sollen
      // dieselbe Groesse haben, auch wenn die Matrix in der sechsten
      // Nachkommastelle abweicht.
      groesse: Math.round(groesse * 10) / 10,
      y,
      x0,
      x1,
      ...(gedreht ? { gedreht: true } : {}),
    }))
    .filter((zeile) => zeile.text);
}
```

- [ ] **Schritt 3: Grün**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && npx vitest run tests/dokument-seiten.test.ts 2>&1 | grep -E "Tests  |Duration" && npm test 2>&1 | grep -E "Tests |Test Files |FAIL" && npm run check 2>&1 | grep -E "^- [0-9]+ (error|warning|hint)" && npm run build 2>&1 | grep -E "page\(s\)"
```
Erwartet: `Tests  19 passed (19)`, Dauer rund 1,6 s · **BASIS + 38** in 47 Testdateien · `- 0 errors`, `- 0 warnings`, `- 0 hints` · **SEITEN** `page(s) built`.

- [ ] **Schritt 4: Mutationsproben**

**Probe A** — `const ZEILE_TOLERANZ = 0;`.
Vorhersage: 1 roter Test („haelt Stuecke derselben Zeile zusammen, auch wenn die Grundlinie leicht wackelt"). Gemessen: 1.

**Probe B** — `ordner` durch `path.join(basis, name) + path.sep` ersetzen.
Vorhersage: alle Tests, die pdf.js wirklich laufen lassen. Gemessen: 6 rote — pdf.js weist die Pfade beim Lesen ab, nicht beim Laden.

**Probe C** — in `zeilenAus` `.sort((p, q) => q.y - p.y || p.x - q.x)` durch `.sort((p, q) => p.x - q.x)` ersetzen.
Vorhersage: die Leseordnung bricht. Gemessen: 2 rote („liest von oben nach unten …", „liest Seitenzahl, Format und Zeilen eines Foliensatzes").

**Probe D** — `const BILD_RASTER = 1;`.
Vorhersage: die Wiederkehr des Logos bricht. Gemessen: 2 rote.

**Nicht gefangen, und das ist wichtig zu wissen:** `standardFontDataUrl` aus den Optionen zu streichen macht **keinen** Test rot. Die Fixtures betten keine CID-Schriften und keine JBIG2-Bilder ein; die Meldungen entstehen erst an echtem Material. Der Lauf in Aufgabe 11 ist die Messung dafür — dort erwartet der Plan eine stumme Konsole.

- [ ] **Schritt 5: NUL-Prüfung und Commit**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && python -c "import sys; print('NUL:', sum(open(f,'rb').read().count(b'\x00') for f in sys.argv[1:]))" werkzeug/adapter/dokument.mjs tests/dokument-seiten.test.ts && git add werkzeug/adapter/dokument.mjs tests/dokument-seiten.test.ts && git commit -F - <<'MSG'
feat: Adapter - dokument.mjs liest PDF-Seiten mit pdf.js

liesSeiten liefert je Seite Rohzeilen, Format, Bildplatzierungen und die Zahl
der waagrechten und senkrechten Linien. Zeilen entstehen aus der Lage, nicht
aus der Stromreihenfolge: pdf.js liefert die Elemente in der Reihenfolge des
Inhaltsstroms, auf einer Agendafolie kam der Titel hinter der Liste.

Bilder bekommen ihre Platzierung als Schluessel, auf 4 pt gerundet - daran
erkennt man spaeter das Logo im Briefkopf. Linien sind die einzige
inhaltsfreie Gegenprobe auf eine Tabelle.

Nur der legacy-Build laeuft unter Node 24, und die vier Datenpfade muessen auf
einen Schraegstrich enden, sonst weist pdf.js sie unter Windows ab.

<CO-AUTHORED-BY>
MSG
git diff --stat HEAD~1
```
Erwartet: `NUL: 0` · `2 files changed, 604 insertions(+)`.

---

## Aufgabe 5: `dokument.mjs`, Teil 2 — Beiwerk, Trennung, Bildfolien, Tabellenverdacht, Art

**Dateien:**
- Ändern: `werkzeug/adapter/dokument.mjs` (Teil 2 anhängen)
- Neu: `tests/dokument-bereinigen.test.ts`

Ab hier kommt kein pdf.js mehr vor. Eingabe sind Rohseiten, wie `liesSeiten` sie liefert; erfundene Rohseiten tun es genauso, und genau so wird geprüft.

Vier Regeln sind gegenüber dem Spec geschärft, jede an neun echten Foliensätzen gemessen (siehe Präzisierungen 1 bis 8):

| Regel | Spec | hier | warum |
|---|---|---|---|
| Normalisierung | Ziffer → `#` | Ziffern**folge** → `#` | sonst bleibt die Foliennummer in jedem Satz mit über neun Folien im Nutztext |
| Wiederkehr | immer | erst ab 5 Seiten, kleinere übernehmen das Beiwerk der Quelle | eine Datei mit einer Seite gilt sonst als Scan |
| Lage | keine | feste Lage (± 1 %) im Randstreifen (15 %) | sonst wird ein Aufzählungspunkt mit laufender Nummer zu Beiwerk |
| Tabelle | > 60 % Einzeltoken | Liniengitter (≥ 5 × ≥ 5) **oder** ≥ 3 Zahlenzeilen | die dichteste Tabelle des Materials liegt bei 51 % und fällt durch |
| `nurBild` | Bild und < 20 Zeichen | dazu: genau eine Zeile unter 40 Zeichen | eine Bildunterschrift mit genau 20 Zeichen verfehlt die Schwelle um ein Zeichen |
| Art | je Datei | je Quelle | eine Datei liegt 0,5 Zeichen unter der Schwelle 600 |

- [ ] **Schritt 1: Die Tests schreiben (rot)**

`tests/dokument-bereinigen.test.ts` anlegen:

```ts
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  artDerQuelle,
  bereinigeQuelle,
  findeBeiwerk,
  istZahlenzeile,
  ladePdfjs,
  liesSeiten,
  schluessel,
  seitenText,
  zieheTrennungZusammen,
} from '../werkzeug/adapter/dokument.mjs';

/**
 * Der reine Teil von `dokument.mjs`: Beiwerk, Silbentrennung, Bildseiten,
 * Tabellenverdacht, Art und Abbruch.
 *
 * Die meisten Tests bekommen erfundene Rohseiten — jede Regel laesst sich so
 * einzeln und ohne PDF pruefen. Am Ende laeuft dasselbe an den Fixtures, damit
 * nicht nur die Regeln stimmen, sondern auch das, was pdf.js wirklich liefert.
 */
const FIXTUREN = path.resolve(__dirname, 'fixtures');
const liesFixture = (name: string) => new Uint8Array(readFileSync(path.join(FIXTUREN, name)));

const HOEHE = 595;

/** Eine Rohzeile. `y` ist die Grundlinie in Punkten, wie bei pdf.js. */
function zeile(text: string, y: number, extra: { groesse?: number; x0?: number; x1?: number } = {}) {
  return { text, groesse: extra.groesse ?? 12, y, x0: extra.x0 ?? 60, x1: extra.x1 ?? 400 };
}

/** Eine Rohseite, wie `liesSeiten` sie liefert. */
function seite(
  nummer: number,
  zeilen: ReturnType<typeof zeile>[],
  extra: { bilder?: string[]; hLinien?: number; vLinien?: number } = {},
) {
  return {
    nummer,
    breite: 842,
    hoehe: HOEHE,
    zeilen,
    bilder: extra.bilder ?? [],
    gitter: { hLinien: extra.hLinien ?? 0, vLinien: extra.vLinien ?? 0 },
  };
}

/** Der Briefkopf: oben, an fester Stelle, mit laufender Nummer. */
const kopf = (n: number) => zeile(`Folie ${n}`, 0.93 * HOEHE);
/** Eine Datei aus n Folien mit Briefkopf und je einer Inhaltszeile. */
function satz(n: number, inhalt: (i: number) => ReturnType<typeof zeile>[] = () => [], name = 'satz.pdf') {
  return {
    datei: name,
    seiten: Array.from({ length: n }, (_, i) => seite(i + 1, [kopf(i + 1), ...inhalt(i + 1)])),
  };
}

describe('schluessel', () => {
  it('macht aus jeder Ziffernfolge ein einziges Zeichen', () => {
    // Ziffer fuer Ziffer ersetzt waeren „Folie 7" und „Folie 17" verschieden —
    // und die Foliennummer bliebe in jedem Satz mit mehr als neun Folien stehen.
    expect(schluessel('Folie 7')).toBe('Folie #');
    expect(schluessel('Folie 17')).toBe(schluessel('Folie 7'));
    expect(schluessel('  Seite 3  von  12 ')).toBe('Seite # von #');
  });
});

describe('zieheTrennungZusammen', () => {
  it('zieht eine Trennung am Zeilenende zusammen', () => {
    const { zeilen, zusammengezogen } = zieheTrennungZusammen([
      zeile('Die Projekt-', 400, { x0: 100, x1: 220 }),
      zeile('steuerung ist delegierbar.', 385, { x0: 100, x1: 320 }),
    ]);
    expect(zeilen.map((z) => z.text)).toEqual(['Die Projektsteuerung ist delegierbar.']);
    expect(zusammengezogen).toBe(1);
  });

  it('laesst einen Ergaenzungsstrich vor einem Bindewort stehen', () => {
    const { zeilen, zusammengezogen } = zieheTrennungZusammen([
      zeile('Kosten-', 400, { x0: 100, x1: 180 }),
      zeile('und Terminplanung gehören zusammen.', 385, { x0: 100, x1: 340 }),
    ]);
    expect(zeilen).toHaveLength(2);
    expect(zusammengezogen).toBe(0);
  });

  it('zieht nichts ueber die Grenze zweier Textfelder hinweg', () => {
    const { zeilen } = zieheTrennungZusammen([
      zeile('Vertrags-', 400, { x0: 100, x1: 180 }),
      zeile('arten in der Spalte daneben', 385, { x0: 500, x1: 700 }),
    ]);
    expect(zeilen).toHaveLength(2);
  });

  it('zieht nicht zusammen, wenn die naechste Zeile gross beginnt', () => {
    const { zeilen } = zieheTrennungZusammen([
      zeile('Bau-', 400, { x0: 100, x1: 160 }),
      zeile('Herr der Dinge', 385, { x0: 100, x1: 300 }),
    ]);
    expect(zeilen).toHaveLength(2);
  });
});

describe('istZahlenzeile', () => {
  it.each([
    ['1.250.000 1.310.000 4,8', true],
    ['12', true],
    ['01.03.2026 14 Tage', true],
    ['300 Bauwerk', false],
    ['Kostengruppe', false],
    ['– – –', false],
    ['', false],
  ])('%s', (text, erwartet) => {
    expect(istZahlenzeile(text)).toBe(erwartet);
  });
});

describe('findeBeiwerk', () => {
  it('erkennt eine Zeile, die auf jeder Seite an derselben Stelle wiederkehrt', () => {
    const beiwerk = findeBeiwerk(satz(10).seiten);
    expect([...beiwerk.keys()]).toEqual(['Folie #']);
  });

  it('findet unter fuenf Seiten gar nichts', () => {
    // Bei einer einzigen Seite kommt jede Zeile auf 100 % der Seiten vor —
    // der ganze Text waere Beiwerk und die Datei ein „Scan".
    expect(findeBeiwerk(satz(4).seiten).size).toBe(0);
    expect(findeBeiwerk(satz(1).seiten).size).toBe(0);
  });

  it('nimmt nur, was im oberen oder unteren Randstreifen steht', () => {
    // Derselbe Aufzaehlungspunkt auf jeder Folie, aber in der Seitenmitte:
    // Inhalt, kein Beiwerk. Ohne diese Bedingung verloere der Satz seinen Text.
    const mittig = satz(10, (i) => [zeile(`• Beispiel ${i}: Planung und Vergabe`, 0.5 * HOEHE)]);
    expect([...findeBeiwerk(mittig.seiten).keys()]).toEqual(['Folie #']);
  });

  it('nimmt nur, was an fester Stelle steht', () => {
    const wandernd = satz(10, (i) => [zeile('Fallbeispiel', (0.9 - i * 0.02) * HOEHE)]);
    expect([...findeBeiwerk(wandernd.seiten).keys()]).toEqual(['Folie #']);
  });
});

describe('bereinigeQuelle', () => {
  it('entfernt das Beiwerk und zaehlt, wie viele Zeichen das waren', () => {
    const [datei] = bereinigeQuelle([satz(10, () => [zeile('Inhalt der Folie', 0.5 * HOEHE)])]);
    expect(datei.seiten[0]?.zeilen.map((z) => z.text)).toEqual(['Inhalt der Folie']);
    expect(datei.beiwerkHerkunft).toBe('datei');
    // Neunmal „Folie1" bis „Folie9", einmal „Folie10" — Leerraum zaehlt nicht mit.
    expect(datei.beiwerkZeichen).toBe(9 * 6 + 7);
    expect(datei.beiwerkAnteil).toBeCloseTo(61 / (61 + 10 * 14), 5);
  });

  it('gibt einer kleinen Datei das Beiwerk der uebrigen Dateien derselben Quelle', () => {
    const gross = satz(10, () => [zeile('Inhalt', 0.5 * HOEHE)], 'gross.pdf');
    const klein = {
      datei: 'klein.pdf',
      seiten: [seite(1, [kopf(1), zeile('Die ganze Aufgabe steht nur im Bild', 0.5 * HOEHE)])],
    };
    const [, kleinBereinigt] = bereinigeQuelle([gross, klein]);
    expect(kleinBereinigt.beiwerkHerkunft).toBe('quelle');
    expect(kleinBereinigt.seiten[0]?.zeilen.map((z) => z.text)).toEqual(['Die ganze Aufgabe steht nur im Bild']);
    expect(kleinBereinigt.abbruch).toBeNull();
  });

  it('laesst einer kleinen Datei ohne grosse Nachbarin ihren Text', () => {
    const klein = {
      datei: 'klein.pdf',
      seiten: [seite(1, [kopf(1), zeile('Die ganze Aufgabe steht nur im Bild', 0.5 * HOEHE)])],
    };
    const [datei] = bereinigeQuelle([klein]);
    expect(datei.beiwerkHerkunft).toBe('keins');
    expect(datei.seiten[0]?.zeilen).toHaveLength(2);
    expect(datei.abbruch).toBeNull();
  });
});

describe('nurBild und tabellenverdacht', () => {
  /** Zehn Folien, auf jeder das Logo an derselben Stelle. */
  const mitLogo = (inhalt: (i: number) => ReturnType<typeof zeile>[], extra: (i: number) => object = () => ({})) => ({
    datei: 'satz.pdf',
    seiten: Array.from({ length: 10 }, (_, i) =>
      seite(i + 1, [kopf(i + 1), ...inhalt(i + 1)], { bilder: ['84x28@712,16'], ...extra(i + 1) }),
    ),
  });

  it('haelt eine Folie mit Logo und Text nicht fuer eine Bildfolie', () => {
    const [datei] = bereinigeQuelle([mitLogo(() => [zeile('Ein Satz mit reichlich Inhalt darauf', 0.5 * HOEHE)])]);
    expect(datei.nurBild).toEqual([]);
    expect(datei.seiten[0]?.echteBilder).toBe(0);
  });

  it('erkennt eine Folie mit echtem Bild und ohne Text', () => {
    const [datei] = bereinigeQuelle([
      mitLogo(
        () => [],
        (i) => (i === 4 ? { bilder: ['84x28@712,16', '540x380@152,120'] } : {}),
      ),
    ]);
    expect(datei.nurBild).toEqual([4]);
  });

  it('erkennt auch ein Bild mit Bildunterschrift', () => {
    // Am echten Material trug die einzige Nutzzeile einer Bildfolie genau
    // 20 Zeichen — die blosse Schwelle verfehlte sie um ein Zeichen.
    const [datei] = bereinigeQuelle([
      mitLogo(
        (i) =>
          i === 4
            ? [zeile('Abbildung 3: Der Ablauf im Überblick', 0.3 * HOEHE)] // 31 Zeichen: ueber 20, unter 40
            : [zeile('Ein Satz mit Inhalt darauf', 0.5 * HOEHE)],
        (i) => (i === 4 ? { bilder: ['84x28@712,16', '540x380@152,120'] } : {}),
      ),
    ]);
    expect(datei.nurBild).toEqual([4]);
  });

  it('erkennt ein Liniengitter als Tabelle', () => {
    const [datei] = bereinigeQuelle([
      mitLogo(
        () => [zeile('Ein Satz mit Inhalt darauf', 0.5 * HOEHE)],
        (i) => (i === 6 ? { hLinien: 6, vLinien: 5 } : { hLinien: 6, vLinien: 4 }),
      ),
    ]);
    expect(datei.tabellenverdacht).toEqual([6]);
  });

  it('erkennt drei Zeilen aus lauter Zahlen als Tabelle', () => {
    const [datei] = bereinigeQuelle([
      mitLogo((i) =>
        i === 7
          ? [zeile('1.250.000 4,8', 300), zeile('480.000 6,7', 280), zeile('95.000 -2,6', 260)]
          : [zeile('1.250.000 4,8', 300), zeile('480.000 6,7', 280), zeile('Nebenkosten steigen', 260)],
      ),
    ]);
    expect(datei.tabellenverdacht).toEqual([7]);
  });
});

describe('Abbruch und Art', () => {
  it('bricht ab, wenn fast jede Seite leer ist', () => {
    const leer = { datei: 'scan.pdf', seiten: Array.from({ length: 10 }, (_, i) => seite(i + 1, [], { bilder: ['b'] })) };
    const [datei] = bereinigeQuelle([leer]);
    expect(datei.abbruch).toBe('scan.pdf: kein Textinhalt — das Material ist gescannt; OCR ist nicht Teil des Ingests');
  });

  it('bricht bei wenig Text nicht ab', () => {
    const wenig = {
      datei: 'wenig.pdf',
      seiten: Array.from({ length: 10 }, (_, i) => seite(i + 1, [zeile('Kosten früh schätzen und melden.', 300 - i)])),
    };
    expect(bereinigeQuelle([wenig])[0]?.abbruch).toBeNull();
  });

  it('entscheidet die Art ueber die ganze Quelle, nicht je Datei', () => {
    // Eine Datei allein laege mit Median 620 ueber der Schwelle und hiesse
    // „buch" — ueber alle Seiten der Quelle bleibt es ein Foliensatz.
    const lang = { datei: 'a.pdf', seiten: [1, 2].map((n) => seite(n, [zeile('x'.repeat(620), 300)])) };
    const kurz = {
      datei: 'b.pdf',
      seiten: Array.from({ length: 8 }, (_, i) => seite(i + 1, [zeile('x'.repeat(120), 300)])),
    };
    expect(artDerQuelle(bereinigeQuelle([lang])).art).toBe('buch');
    const quelle = artDerQuelle(bereinigeQuelle([lang, kurz]));
    expect(quelle).toEqual({ art: 'folien', median: 120, quer: 10, seiten: 10 });
  });

  it('nennt ein Hochformat mit viel Text ein Buch', () => {
    const hoch = {
      datei: 'buch.pdf',
      seiten: Array.from({ length: 6 }, (_, i) => ({ ...seite(i + 1, [zeile('x'.repeat(3000), 300)]), breite: 595, hoehe: 842 })),
    };
    expect(artDerQuelle(bereinigeQuelle([hoch])).art).toBe('buch');
  });
});

describe('seitenText', () => {
  it('setzt die Seitenmarke vor den Nutztext', () => {
    const [datei] = bereinigeQuelle([satz(10, (i) => [zeile(`Inhalt ${i}`, 0.5 * HOEHE)])]);
    expect(seitenText(datei.seiten[2]!)).toBe('— Folie 3 —\nInhalt 3');
    expect(seitenText(datei.seiten[2]!, 'Seite')).toBe('— Seite 3 —\nInhalt 3');
  });
});

describe('an den Fixtures', () => {
  it('raeumt den Foliensatz mit Agenda auf', async () => {
    const geladen = await ladePdfjs();
    const roh = { datei: 'folien-agenda.pdf', ...(await liesSeiten(liesFixture('folien-agenda.pdf'), geladen)) };
    const [datei] = bereinigeQuelle([roh]);

    expect(datei.beiwerk).toEqual([
      'Projektmanagement – Fixture-Vorlesung – Musterhochschule',
      'Folie #',
      'Lehrstuhl Beispiel · Sommersemester #',
    ]);
    expect(datei.beiwerkAnteil).toBeCloseTo(0.362, 3);
    // Keine Foliennummer mehr im Nutztext.
    expect(datei.seiten.flatMap((s) => s.zeilen).filter((z) => /^Folie \d+$/.test(z.text))).toEqual([]);
    expect(datei.nurBild).toEqual([9]);
    expect(datei.tabellenverdacht).toEqual([14]);
    expect(datei.trennungen).toBe(1);
    expect(datei.abbruch).toBeNull();
    // Die Trennung ist zusammengezogen, der Ergaenzungsstrich steht noch.
    expect(datei.seiten[7]?.zeilen.map((z) => z.text)).toEqual([
      'Begriffe',
      '• Die Projektsteuerung ist eine delegierbare Bauherrenaufgabe.',
      '• Kosten-',
      'und Terminplanung gehören zusammen.',
    ]);
    expect(seitenText(datei.seiten[1]!)).toBe(
      '— Folie 2 —\nAGENDA\nGrundlagen der Planung\nKosten und Termine\nRisiken im Projekt',
    );
  });

  it('bricht beim Satz ohne Textebene ab und beim Satz mit wenig Text nicht', async () => {
    const geladen = await ladePdfjs();
    const scan = { datei: 'folien-scan.pdf', ...(await liesSeiten(liesFixture('folien-scan.pdf'), geladen)) };
    const wenig = { datei: 'folien-wenig-text.pdf', ...(await liesSeiten(liesFixture('folien-wenig-text.pdf'), geladen)) };
    expect(bereinigeQuelle([scan])[0]?.abbruch).toBe(
      'folien-scan.pdf: kein Textinhalt — das Material ist gescannt; OCR ist nicht Teil des Ingests',
    );
    const wenigBereinigt = bereinigeQuelle([wenig])[0]!;
    expect(wenigBereinigt.abbruch).toBeNull();
    expect(wenigBereinigt.median).toBe(24);
  });

  it('nennt das Hochformat ein Buch und die Foliensaetze Folien', async () => {
    const geladen = await ladePdfjs();
    const lies = async (name: string) => ({ datei: name, ...(await liesSeiten(liesFixture(name), geladen)) });
    const folien = bereinigeQuelle([await lies('folien-agenda.pdf'), await lies('folien-laeufe.pdf')]);
    expect(artDerQuelle(folien)).toEqual({ art: 'folien', median: 188, quer: 51, seiten: 51 });

    const buch = bereinigeQuelle([await lies('buch-hochformat.pdf')]);
    expect(artDerQuelle(buch)).toEqual({ art: 'buch', median: 3768, quer: 0, seiten: 12 });
    expect(buch[0]?.beiwerk).toEqual(['Musterbuch Projektmanagement · Kapitel #', '— # —']);
    expect(buch[0]?.trennungen).toBe(6);
  });
});
```

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && npx vitest run tests/dokument-bereinigen.test.ts 2>&1 | grep -E "Tests  |Error" | head -4
```
Erwartet: `Test Files  1 failed (1)` und `Tests  32 failed (32)`, jeder mit `TypeError: <name> is not a function` — die Datei gibt es, ihre zweite Hälfte noch nicht.

- [ ] **Schritt 2: Teil 2 an `werkzeug/adapter/dokument.mjs` anhängen**

Ans Ende der Datei, hinter `zeilenAus`:

```js
// ---------------------------------------------------------------------------
// Teil 2: rein — Beiwerk, Silbentrennung, Bildseiten, Tabellenverdacht, Art
//
// Ab hier kommt kein pdf.js mehr vor. Eingabe sind Rohseiten, wie `liesSeiten`
// sie liefert; erfundene Rohseiten tun es genauso, und genau so wird geprueft.

/** Eine Zeile gilt als Beiwerk, wenn sie auf so vielen Seiten der Datei steht. */
const BEIWERK_ANTEIL = 0.8;

/**
 * Unter fuenf Seiten traegt die Wiederkehr nicht.
 *
 * Gemessen: Eine Datei mit einer einzigen Seite hat jede Zeile auf 100 % ihrer
 * Seiten — der ganze Text waere Beiwerk, der Nutztext null, und die Datei
 * wuerde als Scan abgewiesen. Solche Dateien uebernehmen deshalb das Beiwerk,
 * das in den groesseren Dateien derselben Quelle erkannt wurde.
 */
const BEIWERK_MINDEST_SEITEN = 5;

/** Beiwerk steht an fester Stelle: hoechstens ein Prozent der Seitenhoehe Streuung. */
const BEIWERK_LAGE_TOLERANZ = 0.01;

/**
 * ... und im oberen oder unteren Randstreifen der Seite.
 *
 * Ohne diese Bedingung wird ein Aufzaehlungspunkt, der sich nur in einer Zahl
 * unterscheidet und auf 80 % der Folien an derselben Stelle steht, zu Beiwerk
 * — der Satz verloere seinen Inhalt. Am echten Material liegt jede
 * Beiwerkzeile im Randstreifen (Lage 0,07 oder 0,93) und streut hoechstens ein
 * Zehntelprozent.
 */
const BEIWERK_RANDSTREIFEN = 0.15;

/**
 * Ueber diesem Anteil entfernten Texts meldet das Einlesen eine Warnung: Dann
 * stimmt vermutlich etwas mit der Extraktion nicht. Am echten Material lag der
 * hoechste Wert bei 57 % — ein Satz mit vielen Bildfolien, an dem nichts falsch
 * ist. Die Schwelle warnt also knapp ueber dem, was noch legitim vorkommt.
 */
export const BEIWERK_WARNUNG = 0.6;

/** Weniger Nutztext als das zaehlt als „kein Text auf dieser Seite". */
const NUR_BILD_ZEICHEN = 20;

/** Eine einzelne Zeile unter dieser Laenge neben einem Bild ist eine Bildunterschrift. */
const NUR_BILD_EINE_ZEILE = 40;

/** Ab so vielen waagrechten UND senkrechten Linien ist es ein Tabellengitter. */
const TABELLE_LINIEN = 5;

/** ... oder ab so vielen Zeilen, die nur aus Zahlen, Daten und Einheiten bestehen. */
const TABELLE_ZAHLZEILEN = 3;

/** Unter so vielen Zeichen gilt eine Seite als leer. */
const KEINE_TEXTEBENE_ZEICHEN = 20;

/** Sind mehr als so viele Seiten leer, hat die Datei keine Textebene. */
const KEINE_TEXTEBENE_ANTEIL = 0.9;

/** Median des Nutztexts je Seite, unter dem ein Querformat als Folien gilt. */
const FOLIEN_MEDIAN = 600;

/**
 * @typedef {RohSeite & { quer: boolean, zeichen: number, beiwerkZeichen: number, echteBilder: number, nurBild: boolean, tabellenverdacht: boolean }} Seite
 * @typedef {{ datei: string, seiten: RohSeite[] }} RohDatei
 * @typedef {{
 *   datei: string, seitenzahl: number, quer: number, median: number, abbruch: string | null,
 *   beiwerk: string[], beiwerkHerkunft: 'datei' | 'quelle' | 'keins',
 *   beiwerkZeichen: number, gesamtZeichen: number, beiwerkAnteil: number, trennungen: number,
 *   nurBild: number[], tabellenverdacht: number[], seiten: Seite[]
 * }} Datei
 */

/**
 * Der Vergleichsschluessel einer Zeile: jede Ziffernfolge wird zu einem `#`.
 *
 * **Folge**, nicht Ziffer. Wer jede Ziffer einzeln ersetzt, macht aus
 * „Folie 7" und „Folie 17" zwei verschiedene Zeilen (`Folie #` und `Folie ##`).
 * In jedem Satz mit mehr als neun Folien erreicht dann keine der beiden die
 * 80 %, und die laufende Foliennummer bleibt im Nutztext stehen — gemessen an
 * drei Saetzen: 39/61, 29/71 und 26/74 Prozent.
 *
 * @param {string} text
 * @returns {string}
 */
export const schluessel = (text) => text.replace(/\d+/g, '#').replace(/\s+/g, ' ').trim();

/**
 * Zeichen ohne Leerraum.
 *
 * @param {string} text
 * @returns {number}
 */
export const zeichen = (text) => text.replace(/\s/g, '').length;

/** Woerter, vor denen ein Strich am Zeilenende kein Trennstrich ist, sondern ein Ergaenzungsstrich. */
const BINDEWORT = new Set(['und', 'oder', 'bzw', 'bzw.', 'sowie', 'bis', 'als', 'wie', 'noch', 'statt', 'u.', 'o.']);

/** Trennstrich, weiches Trennzeichen, Bindestrich-Variante. */
const TRENNSTRICH = /\p{L}[-­‐]$/u;

/**
 * Silbentrennung zusammenziehen.
 *
 * Bedingungen, alle zusammen: Die Zeile endet auf Buchstabe und Trennstrich,
 * die naechste beginnt klein, steht direkt darunter und ueberlappt im
 * x-Bereich — also im selben Textfeld. Und das erste Wort der naechsten Zeile
 * ist kein Bindewort: „Kosten- und Terminplanung" traegt einen
 * Ergaenzungsstrich, keine Trennung.
 *
 * Reihenfolge: erst Beiwerk entfernen, dann trennen. Der Adressblock in einem
 * Briefkopf endet selbst auf einem Strich.
 *
 * @param {Zeile[]} zeilen
 * @returns {{ zeilen: Zeile[], zusammengezogen: number }}
 */
export function zieheTrennungZusammen(zeilen) {
  /** @type {Zeile[]} */
  const aus = [];
  let zusammengezogen = 0;
  for (const zeile of zeilen) {
    const vor = aus[aus.length - 1];
    if (vor && !vor.gedreht && !zeile.gedreht && TRENNSTRICH.test(vor.text) && /^\p{Ll}/u.test(zeile.text)) {
      const darunter = vor.y - zeile.y > 0 && vor.y - zeile.y <= 2.5 * Math.max(vor.groesse, zeile.groesse);
      const ueberlappt = zeile.x0 < vor.x1 && zeile.x1 > vor.x0;
      if (darunter && ueberlappt && !BINDEWORT.has(zeile.text.split(' ')[0])) {
        aus[aus.length - 1] = {
          ...vor,
          text: vor.text.slice(0, -1) + zeile.text,
          groesse: Math.max(vor.groesse, zeile.groesse),
          x1: Math.max(vor.x1, zeile.x1),
        };
        zusammengezogen++;
        continue;
      }
    }
    aus.push(zeile);
  }
  return { zeilen: aus, zusammengezogen };
}

const ZAHL = /^[(\[]?[+\-–−±~≈<>]?(\d{1,3}([.’' ]\d{3})+|\d+)([.,]\d+)?[)\]]?(%|‰|€|T€|Mio\.?|Mrd\.?|m²|m³|h|d|Wo\.?)?[.,;:)]?$/u;
const DATUM = /^(\d{1,2}\.\d{1,2}\.(\d{2}|\d{4})?|\d{1,2}\/\d{2,4}|\d{4}-\d{2}(-\d{2})?|(KW|Q)\s?\d{1,2}([./]\d{2,4})?)[.,;:]?$/u;
const EINHEIT = /^(€|EUR|T€|TEUR|%|Mio\.?|Mrd\.?|€\/m²|m²|m³|Std\.?|h|Tage?|Wochen?|Monate?|-|–|—|\/|x|X|✓|✗)$/u;

/**
 * Eine Zeile, die nur aus Zahlen, Daten und Einheiten besteht — und mindestens
 * eine Zahl oder ein Datum enthaelt.
 *
 * Die zweite Bedingung ist noetig: Eine Zeile aus lauter Gedankenstrichen
 * besteht formal nur aus Einheiten und ist trotzdem keine Tabellenzeile.
 *
 * @param {string} text
 * @returns {boolean}
 */
export function istZahlenzeile(text) {
  const token = text.split(/\s+/).filter(Boolean);
  if (!token.length) return false;
  return (
    token.every((t) => ZAHL.test(t) || DATUM.test(t) || EINHEIT.test(t)) &&
    token.some((t) => ZAHL.test(t) || DATUM.test(t))
  );
}

/**
 * Das Beiwerk einer Datei: Zeilen, die auf mindestens 80 % ihrer Seiten
 * wiederkehren, an fester Stelle im oberen oder unteren Randstreifen.
 *
 * Zurueck kommt der Vergleichsschluessel und die Lage, an der die Zeile steht
 * (als Anteil der Seitenhoehe). Die Lage wird beim Entfernen noch einmal
 * gebraucht: Dieselbe Zeile mitten auf einer Folie ist Inhalt, kein Beiwerk.
 *
 * @param {readonly RohSeite[]} seiten
 * @returns {Map<string, number[]>}
 */
export function findeBeiwerk(seiten) {
  /** @type {Map<string, number[]>} */
  const beiwerk = new Map();
  const anzahl = seiten.length;
  if (anzahl < BEIWERK_MINDEST_SEITEN) return beiwerk;

  /** @type {Map<string, { seite: number, lage: number }[]>} */
  const vorkommen = new Map();
  for (const seite of seiten) {
    for (const zeile of seite.zeilen) {
      const k = schluessel(zeile.text);
      const liste = vorkommen.get(k) ?? [];
      liste.push({ seite: seite.nummer, lage: zeile.y / seite.hoehe });
      vorkommen.set(k, liste);
    }
  }
  for (const [k, liste] of vorkommen) {
    const lagen = liste.map((e) => e.lage).sort((a, b) => a - b);
    const mitte = lagen[Math.floor(lagen.length / 2)];
    if (mitte > BEIWERK_RANDSTREIFEN && mitte < 1 - BEIWERK_RANDSTREIFEN) continue;
    const seitenMitZeile = new Set(
      liste.filter((e) => Math.abs(e.lage - mitte) <= BEIWERK_LAGE_TOLERANZ).map((e) => e.seite),
    );
    if (seitenMitZeile.size / anzahl >= BEIWERK_ANTEIL) beiwerk.set(k, [mitte]);
  }
  return beiwerk;
}

/**
 * Bild-Beiwerk: dieselbe Platzierung auf mindestens 80 % der Seiten — das Logo
 * im Briefkopf. Ohne diese Unterscheidung heisst „die Seite traegt ein Bild"
 * gar nichts: Am echten Material trug jede der 199 Seiten das Logo.
 *
 * @param {readonly RohSeite[]} seiten
 * @returns {Set<string>}
 */
export function findeBildBeiwerk(seiten) {
  const anzahl = seiten.length;
  /** @type {Set<string>} */
  const treffer = new Set();
  if (anzahl < BEIWERK_MINDEST_SEITEN) return treffer;
  /** @type {Map<string, number>} */
  const vorkommen = new Map();
  for (const seite of seiten) {
    for (const k of new Set(seite.bilder)) vorkommen.set(k, (vorkommen.get(k) ?? 0) + 1);
  }
  for (const [k, n] of vorkommen) if (n / anzahl >= BEIWERK_ANTEIL) treffer.add(k);
  return treffer;
}

/**
 * Eine Rohdatei bereinigen: Beiwerk entfernen, Trennungen zusammenziehen,
 * Bildseiten und Tabellenverdacht markieren, Median und Abbruch rechnen.
 *
 * `beiwerk` und `bildBeiwerk` kommen von aussen, weil eine kleine Datei das
 * Beiwerk der uebrigen Dateien derselben Quelle uebernimmt.
 *
 * @param {RohDatei} roh
 * @param {{ beiwerk: Map<string, number[]>, bildBeiwerk: Set<string>, herkunft: 'datei' | 'quelle' | 'keins' }} vorgabe
 * @returns {Datei}
 */
export function bereinige(roh, vorgabe) {
  const anzahl = roh.seiten.length;
  const { beiwerk, bildBeiwerk } = vorgabe;
  /** @type {(zeile: Zeile, seite: RohSeite) => boolean} */
  const istBeiwerk = (zeile, seite) => {
    const lagen = beiwerk.get(schluessel(zeile.text));
    return lagen !== undefined && lagen.some((l) => Math.abs(zeile.y / seite.hoehe - l) <= BEIWERK_LAGE_TOLERANZ);
  };

  let gesamtZeichen = 0;
  let beiwerkZeichen = 0;
  let trennungen = 0;

  const seiten = roh.seiten.map((roheSeite) => {
    /** @type {Zeile[]} */
    const nutzzeilen = [];
    let entfernt = 0;
    for (const zeile of roheSeite.zeilen) {
      const n = zeichen(zeile.text);
      gesamtZeichen += n;
      if (istBeiwerk(zeile, roheSeite)) entfernt += n;
      else nutzzeilen.push(zeile);
    }
    beiwerkZeichen += entfernt;

    const gezogen = zieheTrennungZusammen(nutzzeilen);
    trennungen += gezogen.zusammengezogen;
    const zeilen = gezogen.zeilen;
    const nutzZeichen = zeilen.reduce((n, z) => n + zeichen(z.text), 0);
    const echteBilder = roheSeite.bilder.filter((k) => !bildBeiwerk.has(k)).length;
    // Bild mit Bildunterschrift zaehlt auch: Am echten Material war die einzige
    // Nutzzeile einer Bildfolie eine Unterschrift mit genau 20 Zeichen — die
    // blosse Schwelle verfehlte sie um ein Zeichen.
    const nurBild =
      echteBilder >= 1 &&
      (nutzZeichen < NUR_BILD_ZEICHEN || (zeilen.length === 1 && zeichen(zeilen[0].text) < NUR_BILD_EINE_ZEILE));
    const gitter = roheSeite.gitter.hLinien >= TABELLE_LINIEN && roheSeite.gitter.vLinien >= TABELLE_LINIEN;
    const zahlenzeilen = zeilen.filter((z) => istZahlenzeile(z.text)).length;
    return {
      ...roheSeite,
      quer: roheSeite.breite > roheSeite.hoehe,
      zeilen,
      zeichen: nutzZeichen,
      beiwerkZeichen: entfernt,
      echteBilder,
      nurBild,
      tabellenverdacht: gitter || zahlenzeilen >= TABELLE_ZAHLZEILEN,
    };
  });

  const sortiert = seiten.map((s) => s.zeichen).sort((a, b) => a - b);
  const median =
    anzahl === 0 ? 0 : anzahl % 2 ? sortiert[(anzahl - 1) / 2] : (sortiert[anzahl / 2 - 1] + sortiert[anzahl / 2]) / 2;
  const leere = seiten.filter((s) => s.zeichen < KEINE_TEXTEBENE_ZEICHEN).length;

  return {
    datei: roh.datei,
    seitenzahl: anzahl,
    quer: seiten.filter((s) => s.quer).length,
    median,
    // Wenig Text ist ausdruecklich kein Abbruchgrund. „Scan" heisst: keine
    // Textebene — fast jede Seite leer.
    abbruch:
      anzahl > 0 && leere / anzahl > KEINE_TEXTEBENE_ANTEIL
        ? `${roh.datei}: kein Textinhalt — das Material ist gescannt; OCR ist nicht Teil des Ingests`
        : null,
    beiwerk: [...beiwerk.keys()].filter((k) => roh.seiten.some((s) => s.zeilen.some((z) => schluessel(z.text) === k))),
    beiwerkHerkunft: vorgabe.herkunft,
    beiwerkZeichen,
    gesamtZeichen,
    beiwerkAnteil: gesamtZeichen ? beiwerkZeichen / gesamtZeichen : 0,
    trennungen,
    nurBild: seiten.filter((s) => s.nurBild).map((s) => s.nummer),
    tabellenverdacht: seiten.filter((s) => s.tabellenverdacht).map((s) => s.nummer),
    seiten,
  };
}

/**
 * Alle Dateien einer Quelle bereinigen.
 *
 * Dateien unter fuenf Seiten uebernehmen das Beiwerk der groesseren Dateien
 * derselben Quelle. Gibt es keine groessere, bleiben sie ohne Beiwerk —
 * `beiwerkHerkunft` sagt, welcher Fall vorlag.
 *
 * @param {readonly RohDatei[]} dateien
 * @returns {Datei[]}
 */
export function bereinigeQuelle(dateien) {
  const eigenes = dateien.map((d) => findeBeiwerk(d.seiten));
  const eigenesBild = dateien.map((d) => findeBildBeiwerk(d.seiten));
  /** @type {Map<string, number[]>} */
  const gelernt = new Map();
  /** @type {Set<string>} */
  const gelerntBild = new Set();
  dateien.forEach((d, i) => {
    if (d.seiten.length < BEIWERK_MINDEST_SEITEN) return;
    for (const [k, lagen] of eigenes[i]) gelernt.set(k, [...(gelernt.get(k) ?? []), ...lagen]);
    for (const k of eigenesBild[i]) gelerntBild.add(k);
  });

  return dateien.map((d, i) => {
    if (d.seiten.length >= BEIWERK_MINDEST_SEITEN) {
      return bereinige(d, { beiwerk: eigenes[i], bildBeiwerk: eigenesBild[i], herkunft: 'datei' });
    }
    const herkunft = gelernt.size > 0 || gelerntBild.size > 0 ? 'quelle' : 'keins';
    return bereinige(d, { beiwerk: gelernt, bildBeiwerk: gelerntBild, herkunft });
  });
}

/**
 * Die Art einer Quelle — nicht einer Datei.
 *
 * Je Datei entschieden wackelt es: Am echten Material lag eine Datei mit
 * Median 599,5 einen halben Punkt unter der Schwelle, eine andere bei 576.
 * Ueber alle Seiten der Quelle war der Median 242 — eindeutig Folien. Eine
 * Quelle hat eine Art, nicht neun.
 *
 * @param {readonly Datei[]} dateien
 * @returns {{ art: 'folien' | 'buch', median: number, quer: number, seiten: number }}
 */
export function artDerQuelle(dateien) {
  const alle = dateien.flatMap((d) => d.seiten);
  const sortiert = alle.map((s) => s.zeichen).sort((a, b) => a - b);
  const anzahl = sortiert.length;
  const median =
    anzahl === 0 ? 0 : anzahl % 2 ? sortiert[(anzahl - 1) / 2] : (sortiert[anzahl / 2 - 1] + sortiert[anzahl / 2]) / 2;
  const quer = alle.filter((s) => s.quer).length;
  return { art: quer > anzahl / 2 && median < FOLIEN_MEDIAN ? 'folien' : 'buch', median, quer, seiten: anzahl };
}

/**
 * Der Nutztext einer Seite fuer die Rohdatei — mit Seitenmarke davor, damit
 * jede spaetere Behauptung auf eine Folie zeigen kann und nicht nur auf einen
 * Satz von fuenfunddreissig.
 *
 * @param {Seite} seite
 * @param {string} [marke]
 * @returns {string}
 */
export function seitenText(seite, marke = 'Folie') {
  return [`— ${marke} ${seite.nummer} —`, ...seite.zeilen.map((z) => z.text)].join('\n');
}
```

- [ ] **Schritt 3: Grün**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && npx vitest run tests/dokument-bereinigen.test.ts 2>&1 | grep -E "Tests  |Duration" && npm test 2>&1 | grep -E "Tests |Test Files |FAIL" && npm run check 2>&1 | grep -E "^- [0-9]+ (error|warning|hint)" && npm run build 2>&1 | grep -E "page\(s\)"
```
Erwartet: `Tests  32 passed (32)`, Dauer rund 2,1 s · **BASIS + 70** in 48 Testdateien · `- 0 errors`, `- 0 warnings`, `- 0 hints` · **SEITEN** `page(s) built`.

Die Werte, die die Fixtures dabei liefern, stehen in den Tests und hier noch einmal zusammen: `folien-agenda.pdf` 26 Seiten, drei Beiwerkzeilen (`…Musterhochschule`, `Folie #`, `…Sommersemester #`), Beiwerk 36,2 %, `nurBild` [9], `tabellenverdacht` [14], eine zusammengezogene Trennung, Median 188,5 · `folien-scan.pdf` bricht ab · `folien-wenig-text.pdf` bricht nicht ab, Median 24 · `buch-hochformat.pdf` Art `buch`, Median 3768, sechs Trennungen, zwei Beiwerkzeilen.

- [ ] **Schritt 4: Mutationsproben**

**Probe A** — in `schluessel` `/\d+/g` durch `/\d/g` ersetzen.
Vorhersage: der Briefkopf mit laufender Nummer wird nicht mehr erkannt. Gemessen: 4 rote Tests.

**Probe B** — `const BEIWERK_MINDEST_SEITEN = 1;`.
Vorhersage: kleine Dateien verlieren ihren ganzen Text. Gemessen: 3 rote.

**Probe C** — `const BEIWERK_RANDSTREIFEN = 0.5;` (praktisch: kein Randstreifen mehr).
Vorhersage: wiederkehrende Inhaltszeilen werden zu Beiwerk. Gemessen: 8 rote — die Regel hängt an vielen Stellen.

**Probe D** — in `bereinige` die `nurBild`-Bedingung auf `nutzZeichen < NUR_BILD_ZEICHEN` verkürzen.
Vorhersage: 1 roter Test („erkennt auch ein Bild mit Bildunterschrift"). Gemessen: 1.

**Probe E** — in `istZahlenzeile` die zweite Bedingung durch `true` ersetzen.
Vorhersage: eine Zeile aus lauter Gedankenstrichen gilt als Zahlenzeile. Gemessen: 1 roter („– – –").

- [ ] **Schritt 5: NUL-Prüfung und Commit**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && python -c "import sys; print('NUL:', sum(open(f,'rb').read().count(b'\x00') for f in sys.argv[1:]))" werkzeug/adapter/dokument.mjs tests/dokument-bereinigen.test.ts && git add werkzeug/adapter/dokument.mjs tests/dokument-bereinigen.test.ts && git commit -F - <<'MSG'
feat: Adapter - Beiwerk, Silbentrennung, Bildfolien, Tabellenverdacht, Art

Der reine Teil von dokument.mjs. Vier Regeln sind gegenueber dem Spec
geschaerft, jede an neun echten Foliensaetzen gemessen:

- Ziffernfolge zu # statt Ziffer zu #, sonst bleibt die laufende Foliennummer
  in jedem Satz mit mehr als neun Folien im Nutztext stehen.
- Wiederkehr erst ab fuenf Seiten; kleinere Dateien uebernehmen das Beiwerk
  der uebrigen Dateien derselben Quelle. Eine Datei mit einer Seite hat sonst
  jede Zeile auf 100 Prozent ihrer Seiten und gilt als Scan.
- Beiwerk nur an fester Stelle im Randstreifen, sonst wird ein
  Aufzaehlungspunkt mit laufender Nummer zu Beiwerk.
- Tabellenverdacht aus Liniengitter oder Zahlenzeilen statt aus dem Anteil
  der Einzeltoken; nurBild auch bei einem Bild mit Bildunterschrift.

Die Art entscheidet die Quelle, nicht die einzelne Datei.

<CO-AUTHORED-BY>
MSG
git diff --stat HEAD~1
```
Erwartet: `NUL: 0` · `2 files changed, 721 insertions(+)`.

---

## Aufgabe 6: Der Gliederer — `werkzeug/gliederung/folien.mjs`

**Dateien:**
- Neu: `werkzeug/gliederung/folien.mjs`, `tests/gliederung-folien.test.ts`

Seiten hinein, Abschnitte heraus. Rein: keine Datei, kein pdf.js. Die Einheit ist der Foliensatz — **eine Datei ist mindestens ein Abschnitt**, nie weniger.

Die Reihenfolge der Wege steht fest: bis 20 Folien bleibt der Satz ein Abschnitt (`einzeln`); darüber entscheidet die Agendafolie, sonst die Titelläufe, sonst wird gleichmäßig in Abschnitte bis 15 Folien geteilt. Drei Regeln sind gegenüber dem Spec geschärft (Präzisierungen 10 bis 12): Die Agenda gleicht über grobe Wortstämme ab, ein Titellauf zählt nur über den Folientitel, und mehr als drei Folien vor der ersten Grenze bilden einen eigenen Abschnitt.

Der Gliederer nimmt von einer Seite nur, was er braucht — Nummer und Nutzzeilen. Eine `Seite` aus `dokument.mjs` passt darauf, eine von Hand gebaute Folie auch, und die Tests brauchen kein PDF.

- [ ] **Schritt 1: Die Tests schreiben (rot)**

`tests/gliederung-folien.test.ts` anlegen:

```ts
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { bereinigeQuelle, ladePdfjs, liesSeiten } from '../werkzeug/adapter/dokument.mjs';
import {
  dateikuerzel,
  findeAgenda,
  findeTitellaeufe,
  folientitel,
  gliedereFolien,
  slug,
} from '../werkzeug/gliederung/folien.mjs';

/**
 * Der Gliederer fuer Foliensaetze: Seiten hinein, Abschnitte heraus.
 *
 * Rein — die meisten Tests bauen ihre Folien selbst, mit einer Titelzeile und
 * ein paar Rumpfzeilen. Am Ende laeuft dasselbe an den drei Foliensatz-Fixtures.
 */
const FIXTUREN = path.resolve(__dirname, 'fixtures');

/** Eine Folie: Titelzeile in 20 pt, darunter Rumpfzeilen in 15 pt. */
function folie(nummer: number, titel: string | null, rumpf: string[] = []) {
  const zeilen = [
    ...(titel === null ? [] : [{ text: titel, groesse: 20, y: 495, x0: 90, x1: 600 }]),
    ...rumpf.map((text, i) => ({ text, groesse: 15, y: 430 - i * 26, x0: 100, x1: 620 })),
  ];
  return { nummer, zeilen };
}

/** Ein Satz aus Folien mit den gegebenen Titeln. */
const satz = (titel: (string | null)[], datei = 'M7 Risikomanagement 26.pdf') => ({
  datei,
  seiten: titel.map((t, i) => folie(i + 1, t)),
});

describe('slug', () => {
  it.each([
    ['Maßnahmen der Bestandsaufnahme', 'massnahmen-der-bestandsaufnahme'],
    ['Ergänzende PM- Leistungen gem. AHO', 'ergaenzende-pm-leistungen-gem'],
    ['Grundlagen & Grundsätze', 'grundlagen-grundsaetze'],
    ['Wie organisieren wir uns selbst?', 'wie-organisieren'],
    ['„Projektkommunikation“', 'projektkommunikation'],
  ])('%s', (titel, erwartet) => {
    expect(slug(titel)).toBe(erwartet);
  });

  it('bleibt unter vier Woertern und 32 Zeichen', () => {
    const lang = slug('Beispiel für typische objektorientierte Gliederung eines Hochbauprojektes');
    expect(lang).toBe('beispiel-fuer-typische');
    expect(lang.length).toBeLessThanOrEqual(32);
    expect(lang.split('-')).toHaveLength(3);
  });

  it('endet nicht auf einem Fuellwort', () => {
    expect(slug('Hilfsmittel für die Projektkoordination')).toBe('hilfsmittel');
  });

  it('liefert eine leere Zeichenkette, wenn nichts uebrig bleibt', () => {
    expect(slug('— · —')).toBe('');
  });
});

describe('dateikuerzel', () => {
  it('nimmt Buchstaben und Zahl aus dem Dateinamen, die Zahl zweistellig', () => {
    const kuerzel = dateikuerzel(['M1 PM und Leistungsbilder 26.pdf', 'M9 Leistungsstandsmessung 26.pdf', 'M10 Steuerung 26.pdf']);
    expect([...kuerzel.values()]).toEqual(['m01', 'm09', 'm10']);
  });

  it('sortiert damit in Lesereihenfolge', () => {
    // Einstellig sortierte `m10` vor `m2` — die Abschnitt-Ids sollen in der
    // Reihenfolge der Dateien stehen, auch nach Codepunkten sortiert.
    const kuerzel = [...dateikuerzel(['M2 a.pdf', 'M10 b.pdf']).values()];
    expect([...kuerzel].sort()).toEqual(kuerzel);
  });

  it('nummeriert alle Dateien durch, wenn eine nicht auf das Muster passt', () => {
    expect([...dateikuerzel(['Vorlesung.pdf', 'M7 x.pdf']).values()]).toEqual(['d01', 'd02']);
  });

  it('nummeriert alle Dateien durch, wenn zwei Kuerzel kollidieren', () => {
    expect([...dateikuerzel(['M7 a.pdf', 'M07 b.pdf']).values()]).toEqual(['d01', 'd02']);
  });
});

describe('folientitel', () => {
  it('nimmt die oberste Nutzzeile', () => {
    expect(folientitel(folie(1, 'Risikomanagement', ['• Ein Punkt']))?.text).toBe('Risikomanagement');
  });

  it('nimmt eine zweite Zeile gleicher Groesse dazu', () => {
    const seite = {
      nummer: 1,
      zeilen: [
        { text: 'Risikomanagement und', groesse: 35.3, y: 400, x0: 90, x1: 600 },
        { text: 'Vertragswesen', groesse: 35.3, y: 360, x0: 90, x1: 500 },
        { text: 'Ein Rumpfsatz', groesse: 15, y: 300, x0: 100, x1: 400 },
      ],
    };
    expect(folientitel(seite)?.text).toBe('Risikomanagement und Vertragswesen');
    expect(folientitel(seite)?.zeilen).toBe(2);
  });

  it('nimmt hoechstens drei Zeilen', () => {
    const seite = {
      nummer: 1,
      zeilen: [0, 1, 2, 3].map((i) => ({ text: `Zeile ${i}`, groesse: 20, y: 400 - i * 25, x0: 90, x1: 600 })),
    };
    expect(folientitel(seite)?.zeilen).toBe(3);
  });

  it('liefert null fuer eine Folie ohne Nutzzeile', () => {
    expect(folientitel(folie(1, null))).toBeNull();
  });
});

describe('findeAgenda', () => {
  const mitAgenda = (agendazeilen: string[], titel: (string | null)[]) => ({
    datei: 'M7.pdf',
    seiten: [folie(1, 'Titelfolie'), folie(2, 'AGENDA', agendazeilen), ...titel.map((t, i) => folie(i + 3, t))],
  });

  it('findet die Agendafolie und ihre Grenzen', () => {
    const agenda = findeAgenda(
      mitAgenda(
        ['Begriffsbestimmungen', 'Prozess des Risikomanagements', 'Vertragswesen'],
        ['Begriffsbestimmungen', 'x', 'Prozess des Risikomanagements', 'y', 'Vertragswesen'],
      ).seiten,
    );
    expect(agenda?.seite).toBe(2);
    expect(agenda?.treffer.map((t) => t.seite)).toEqual([3, 5, 7]);
  });

  it('trifft auch ueber den Wortstamm hinweg', () => {
    // „Begriffsbestimmungen" in der Agenda, „Begriffsbestimmung — Risiko" als
    // Folientitel: Ohne Wortstamm kein Treffer, und die Agenda faellt weg.
    const agenda = findeAgenda(
      mitAgenda(
        ['Begriffsbestimmungen', 'Prozess des Risikomanagements'],
        ['Begriffsbestimmung Risiko', 'x', 'Prozess des Risikomanagements'],
      ).seiten,
    );
    expect(agenda?.treffer.map((t) => t.zeile)).toEqual(['Begriffsbestimmungen', 'Prozess des Risikomanagements']);
  });

  it('nimmt keine Folie, deren Zeilen nur zu einem Drittel wiederkehren', () => {
    const agenda = findeAgenda(
      mitAgenda(['Themenblock eins', 'Themenblock zwei', 'Themenblock drei'], ['Themenblock eins', 'x', 'y', 'z']).seiten,
    );
    expect(agenda).toBeNull();
  });

  it('sieht nur unter den ersten fuenf Folien nach', () => {
    const spaet = {
      datei: 'M7.pdf',
      seiten: [
        ...[1, 2, 3, 4, 5].map((n) => folie(n, `Vorspann ${n}`)),
        folie(6, 'AGENDA', ['Kostenermittlung', 'Terminplanung']),
        folie(7, 'Kostenermittlung'),
        folie(8, 'Terminplanung'),
      ],
    };
    expect(findeAgenda(spaet.seiten)).toBeNull();
  });
});

describe('findeTitellaeufe', () => {
  it('fasst aufeinanderfolgende Folien mit demselben Titel zusammen', () => {
    const laeufe = findeTitellaeufe(satz(['Grundlagen', 'Grundlagen', 'Grundlagen', 'Kosten', 'Kosten']).seiten);
    expect(laeufe).toEqual([
      { titel: 'Grundlagen', von: 1, bis: 3 },
      { titel: 'Kosten', von: 4, bis: 5 },
    ]);
  });

  it('nimmt eine einzelne Folie nicht als Lauf', () => {
    expect(findeTitellaeufe(satz(['a', 'b', 'c']).seiten)).toEqual([]);
  });

  it('nimmt nur den Folientitel, nicht irgendeine wiederkehrende Zeile', () => {
    // Woertlich genommen machte die Regel des Specs eine Aufzaehlungszeile zum
    // Titel eines Abschnitts ueber vierzehn Folien.
    const seiten = [
      folie(1, 'Erstes Thema', ['• Immer dieselbe Fussnote']),
      folie(2, 'Zweites Thema', ['• Immer dieselbe Fussnote']),
      folie(3, 'Drittes Thema', ['• Immer dieselbe Fussnote']),
    ];
    expect(findeTitellaeufe(seiten)).toEqual([]);
  });
});

describe('gliedereFolien', () => {
  const kuerzel = 'm07';

  it('laesst einen Satz bis 20 Folien ein Abschnitt', () => {
    const aus = gliedereFolien(satz(Array.from({ length: 20 }, (_, i) => `Titel ${i}`)), kuerzel);
    expect(aus.gliederung).toBe('einzeln');
    expect(aus.abschnitte).toEqual([
      {
        id: 'm07-01-folien-1-20',
        titel: 'M7 Risikomanagement 26, Folien 1–20',
        datei: 'M7 Risikomanagement 26.pdf',
        seiten: [1, 20],
      },
    ]);
  });

  it('teilt einen groesseren Satz an der Agenda', () => {
    const seiten = [
      folie(1, 'Titelfolie'),
      folie(2, 'AGENDA', ['Grundlagen der Planung', 'Kosten und Termine', 'Risiken im Projekt']),
      ...Array.from({ length: 19 }, (_, i) =>
        folie(i + 3, i === 0 ? 'Grundlagen der Planung' : i === 6 ? 'Kosten und Termine' : i === 12 ? 'Risiken im Projekt' : `Rumpf ${i}`),
      ),
    ];
    const aus = gliedereFolien({ datei: 'M7 Risikomanagement 26.pdf', seiten }, kuerzel);
    expect(aus.gliederung).toBe('agenda');
    expect(aus.abschnitte.map((a) => [a.id, a.titel, a.seiten])).toEqual([
      ['m07-01-grundlagen-der-planung', 'Grundlagen der Planung', [1, 8]],
      ['m07-02-kosten-und-termine', 'Kosten und Termine', [9, 14]],
      ['m07-03-risiken-im-projekt', 'Risiken im Projekt', [15, 21]],
    ]);
  });

  it('teilt sonst an den Titellaeufen', () => {
    const titel = [
      ...Array.from({ length: 11 }, () => 'Erster Lauf'),
      ...Array.from({ length: 10 }, () => 'Zweiter Lauf'),
    ];
    const aus = gliedereFolien(satz(titel), kuerzel);
    expect(aus.gliederung).toBe('titellaeufe');
    expect(aus.abschnitte.map((a) => [a.id, a.seiten])).toEqual([
      ['m07-01-erster-lauf', [1, 11]],
      ['m07-02-zweiter-lauf', [12, 21]],
    ]);
  });

  it('gibt mehr als drei Folien vor der ersten Grenze einen eigenen Abschnitt', () => {
    // Sonst verschwaenden sie im ersten Abschnitt und traegen dessen Titel,
    // obwohl sie gar nicht dazugehoeren.
    const titel = [
      ...Array.from({ length: 6 }, (_, i) => `Einzelthema ${i}`),
      ...Array.from({ length: 8 }, () => 'Erster Lauf'),
      ...Array.from({ length: 8 }, () => 'Zweiter Lauf'),
    ];
    const aus = gliedereFolien(satz(titel), kuerzel);
    expect(aus.abschnitte.map((a) => [a.id, a.titel, a.seiten])).toEqual([
      ['m07-01-folien-1-6', 'M7 Risikomanagement 26, Folien 1–6', [1, 6]],
      ['m07-02-erster-lauf', 'Erster Lauf', [7, 14]],
      ['m07-03-zweiter-lauf', 'Zweiter Lauf', [15, 22]],
    ]);
  });

  it('schlaegt drei oder weniger Vorlauffolien dem ersten Abschnitt zu', () => {
    const titel = [
      ...Array.from({ length: 3 }, (_, i) => `Einzelthema ${i}`),
      ...Array.from({ length: 9 }, () => 'Erster Lauf'),
      ...Array.from({ length: 9 }, () => 'Zweiter Lauf'),
    ];
    const aus = gliedereFolien(satz(titel), kuerzel);
    expect(aus.abschnitte.map((a) => a.seiten)).toEqual([
      [1, 12],
      [13, 21],
    ]);
  });

  it('teilt gleichmaessig, wenn weder Agenda noch Lauf greift', () => {
    const aus = gliedereFolien(satz(Array.from({ length: 32 }, (_, i) => `Thema ${i}`)), kuerzel);
    expect(aus.gliederung).toBe('gleichmaessig');
    expect(aus.abschnitte.map((a) => a.seiten)).toEqual([
      [1, 11],
      [12, 22],
      [23, 32],
    ]);
    expect(aus.abschnitte[0]?.titel).toBe('M7 Risikomanagement 26, Folien 1–11');
  });

  it('deckt jede Folie genau einmal ab', () => {
    const aus = gliedereFolien(satz(Array.from({ length: 47 }, (_, i) => `Thema ${i}`)), kuerzel);
    const abgedeckt = aus.abschnitte.flatMap(({ seiten: [von, bis] }) =>
      Array.from({ length: bis - von + 1 }, (_, i) => von + i),
    );
    expect(abgedeckt).toEqual(Array.from({ length: 47 }, (_, i) => i + 1));
  });
});

describe('an den Fixtures', () => {
  async function gliedere(name: string) {
    const geladen = await ladePdfjs();
    const bytes = new Uint8Array(readFileSync(path.join(FIXTUREN, name)));
    const [datei] = bereinigeQuelle([{ datei: name, ...(await liesSeiten(bytes, geladen)) }]);
    return gliedereFolien(datei!, dateikuerzel([name]).get(name)!);
  }

  it('gliedert den Satz mit Agenda an ihren drei Zeilen', async () => {
    const aus = await gliedere('folien-agenda.pdf');
    expect(aus.gliederung).toBe('agenda');
    expect(aus.abschnitte.map((a) => [a.id, a.titel, a.seiten])).toEqual([
      ['d01-01-grundlagen-der-planung', 'Grundlagen der Planung', [1, 10]],
      ['d01-02-kosten-und-termine', 'Kosten und Termine', [11, 18]],
      ['d01-03-risiken-im-projekt', 'Risiken im Projekt', [19, 26]],
    ]);
  });

  it('gliedert den Satz ohne Agenda an seinen Titellaeufen', async () => {
    const aus = await gliedere('folien-laeufe.pdf');
    expect(aus.gliederung).toBe('titellaeufe');
    expect(aus.abschnitte.map((a) => [a.titel, a.seiten])).toEqual([
      ['Grundlagen der Planung', [1, 4]],
      ['Planungsphasen im Überblick', [5, 9]],
      ['Kosten und Termine', [10, 13]],
      ['Terminplanung', [14, 17]],
      ['Risiken im Projekt', [18, 20]],
      ['Risikobewertung', [21, 25]],
    ]);
  });

  it('teilt den Satz ohne Agenda und ohne Lauf gleichmaessig', async () => {
    const aus = await gliedere('folien-gleichmaessig.pdf');
    expect(aus.gliederung).toBe('gleichmaessig');
    expect(aus.abschnitte.map((a) => [a.id, a.seiten])).toEqual([
      ['d01-01-folien-1-11', [1, 11]],
      ['d01-02-folien-12-22', [12, 22]],
      ['d01-03-folien-23-32', [23, 32]],
    ]);
  });

  it('laesst den kurzen Satz einen Abschnitt', async () => {
    const aus = await gliedere('folien-wenig-text.pdf');
    expect(aus.gliederung).toBe('einzeln');
    expect(aus.abschnitte.map((a) => [a.id, a.titel])).toEqual([
      ['d01-01-folien-1-6', 'folien-wenig-text, Folien 1–6'],
    ]);
  });
});
```

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && npx vitest run tests/gliederung-folien.test.ts 2>&1 | grep -E "Tests  |Error" | head -4
```
Erwartet: `Tests  no tests` und `Error: Cannot find module '../werkzeug/gliederung/folien.mjs' imported from …/tests/gliederung-folien.test.ts`.

- [ ] **Schritt 2: `werkzeug/gliederung/folien.mjs` anlegen**

```js
/**
 * Seiten eines Foliensatzes -> Abschnitte. Rein: keine Datei, kein pdf.js.
 *
 * Eingabe ist, was `adapter/dokument.mjs` je Datei liefert — bereinigte Seiten
 * mit ihren Nutzzeilen. Die Einheit ist der Foliensatz: **eine Datei ist
 * mindestens ein Abschnitt**, nie weniger.
 *
 * Die Reihenfolge der Wege steht fest: bis 20 Folien bleibt der Satz ein
 * Abschnitt; darueber entscheidet die Agendafolie, sonst die Titellaeufe,
 * sonst wird gleichmaessig geteilt.
 *
 * Der Gliederer nimmt von einer Seite nur, was er braucht: ihre Nummer und
 * ihre Nutzzeilen. Eine `Seite` aus `dokument.mjs` passt darauf, eine von Hand
 * gebaute Folie auch — und die Tests brauchen kein PDF.
 *
 * @typedef {{ text: string, groesse: number, y: number, x0: number, x1: number, gedreht?: boolean }} Zeile
 * @typedef {{ nummer: number, zeilen: readonly Zeile[] }} Folie
 * @typedef {{ id: string, titel: string, datei: string, seiten: [number, number] }} Abschnitt
 * @typedef {'einzeln' | 'agenda' | 'titellaeufe' | 'gleichmaessig'} Weg
 */

/** Bis hierher bleibt ein Satz ein einziger Abschnitt. */
const EINZELN_BIS = 20;

/** Die Agendafolie steht unter den ersten fuenf. */
const AGENDA_UNTER = 5;

/** Ab so vielen wiedergefundenen Agendazeilen gilt die Folie als Agenda. */
const AGENDA_MINDEST_TREFFER = 2;

/** ... und mindestens dieser Anteil der Agendazeilen muss wiederkehren. */
const AGENDA_MINDEST_ANTEIL = 0.5;

/** Ein Praefixtreffer zaehlt erst ab dieser Laenge — sonst passt „Die" auf alles. */
const MINDEST_PRAEFIX = 8;

/** Ein Titellauf sind mindestens so viele aufeinanderfolgende Folien. */
const LAUF_MINDEST = 2;

/** Gleichmaessig geteilt wird in Abschnitte bis zu dieser Groesse. */
const GLEICHMAESSIG_HOECHSTENS = 15;

/** Mehr Folien als das vor der ersten Grenze bilden einen eigenen Abschnitt. */
const VORLAUF_EIGEN_AB = 3;

/** Ein Folientitel sind hoechstens so viele Zeilen. */
const TITEL_ZEILEN = 3;

/** Woerter, die einen Slug nicht beenden sollen, und die bei der Agenda nicht zaehlen. */
const FUELLWORT = new Set([
  'und', 'oder', 'der', 'die', 'das', 'des', 'den', 'dem', 'ein', 'eine', 'einer', 'eines',
  'im', 'in', 'an', 'am', 'auf', 'zu', 'zum', 'zur', 'von', 'vom', 'mit', 'bei', 'für', 'fuer',
  'als', 'wie', 'was', 'wir', 'uns', 'sich', 'ist', 'sind', 'nicht', 'the', 'of', 'and',
]);

/**
 * Ein grober deutscher Wortstamm: haeufige Endungen ab, die laengste zuerst.
 *
 * Er muss nicht linguistisch stimmen, er muss „Begriffsbestimmungen" und
 * „Begriffsbestimmung" gleich machen. Am echten Material entschied genau das
 * ueber eine erkannte Agenda (Treffer 2/4 ohne, 3/4 mit).
 *
 * @param {string} wort
 * @returns {string}
 */
const stamm = (wort) => wort.replace(/(ungen|ern|en|er|es|e|n|s)$/u, '');

/**
 * Titel vergleichbar machen: klein, ohne Aufzaehlungszeichen, ohne
 * Nummerierung, ohne Anfuehrungszeichen, ohne Satzzeichen am Ende.
 *
 * @param {string} text
 * @returns {string}
 */
const normal = (text) =>
  text
    .normalize('NFC')
    .toLowerCase()
    .replace(/^[\s•▪►✓\-–—*·]+/u, '')
    .replace(/^(\d+(\.\d+)*\.?|[a-z]\)|[ivx]+\.)\s+/u, '')
    .replace(/[„“"'»«‚‘’]/gu, '')
    .replace(/\s+/g, ' ')
    .replace(/[\s:.?!…,;–-]+$/u, '')
    .trim();

/** @type {(text: string) => string} Jedes laengere Wort auf seinen Stamm — der Vergleich fuer Agenda und Folientitel. */
const gestemmt = (text) =>
  normal(text)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .map((wort) => (wort.length > 4 ? stamm(wort) : wort))
    .join(' ');

// ---------------------------------------------------------------------------
// Ids

/** @type {Record<string, string>} */
const UMLAUT = { 'ä': 'ae', 'ö': 'oe', 'ü': 'ue', 'ß': 'ss', 'Ä': 'ae', 'Ö': 'oe', 'Ü': 'ue' };

/**
 * Aus einem Titel ein Stueck Id machen: Kleinbuchstaben, Ziffern, Bindestrich.
 *
 * Umlaute werden ausgeschrieben, nicht weggelassen: `massnahmen` statt
 * `manahmen`. Hoechstens vier Woerter und 32 Zeichen, und kein Fuellwort am
 * Ende — `massnahmen-der` liest sich wie ein abgebrochener Satz.
 *
 * @param {string} text
 * @param {number} [hoechstensWoerter]
 * @param {number} [hoechstensZeichen]
 * @returns {string}
 */
export function slug(text, hoechstensWoerter = 4, hoechstensZeichen = 32) {
  const roh = text
    .normalize('NFC')
    .replace(/[äöüßÄÖÜ]/g, (c) => UMLAUT[c])
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const teile = roh.split('-').filter(Boolean).slice(0, hoechstensWoerter);
  /** @type {string[]} */
  const gewaehlt = [];
  for (const teil of teile) {
    if ([...gewaehlt, teil].join('-').length > hoechstensZeichen) break;
    gewaehlt.push(teil);
  }
  while (gewaehlt.length > 1 && FUELLWORT.has(gewaehlt[gewaehlt.length - 1])) gewaehlt.pop();
  return gewaehlt.join('-') || teile[0]?.slice(0, hoechstensZeichen) || '';
}

/**
 * Das Kuerzel je Datei einer Quelle.
 *
 * „M7 Risikomanagement 26.pdf" wird zu `m07`: die Buchstaben vor der ersten
 * Zahl und die Zahl, zweistellig. Zweistellig, weil `m10` sonst vor `m2`
 * sortierte — und die Abschnitt-Ids sollen in Lesereihenfolge sortieren.
 *
 * Passt ein Name nicht auf das Muster oder kollidieren zwei Kuerzel, bekommen
 * **alle** Dateien `d01`, `d02`, … in der uebergebenen Reihenfolge. Nicht nur
 * die eine: Eine Quelle mit gemischten Kuerzeln waere schwerer zu lesen als
 * eine mit durchnummerierten.
 *
 * @param {readonly string[]} dateien in natuerlicher Reihenfolge
 * @returns {Map<string, string>}
 */
export function dateikuerzel(dateien) {
  /** @type {Map<string, string>} */
  const aus = new Map();
  for (const datei of dateien) {
    const treffer = datei.normalize('NFC').match(/^\s*([A-Za-z]{1,3})\s*0*(\d{1,3})(?!\d)/);
    if (!treffer) return nachNummer(dateien);
    aus.set(datei, `${treffer[1].toLowerCase()}${treffer[2].padStart(2, '0')}`);
  }
  if (new Set(aus.values()).size !== dateien.length) return nachNummer(dateien);
  return aus;
}

/** @type {(dateien: readonly string[]) => Map<string, string>} */
const nachNummer = (dateien) => new Map(dateien.map((d, i) => [d, `d${String(i + 1).padStart(2, '0')}`]));

// ---------------------------------------------------------------------------
// Titel

/**
 * Der Titel einer Folie: die oberste Nutzzeile und die direkt darunter
 * folgenden Zeilen gleicher Schriftgroesse, hoechstens drei.
 *
 * Zweizeilige Titel kommen auf Trennfolien vor. Gedrehte Zeilen zaehlen nicht
 * — sie haben keine Lage in der Leseordnung.
 *
 * @param {Folie} seite
 * @returns {{ text: string, groesse: number, zeilen: number } | null}
 */
export function folientitel(seite) {
  const zeilen = seite.zeilen.filter((z) => !z.gedreht);
  if (!zeilen.length) return null;
  const block = [zeilen[0]];
  for (let i = 1; i < zeilen.length && block.length < TITEL_ZEILEN; i++) {
    const vor = block[block.length - 1];
    const gleicheGroesse = Math.abs(zeilen[i].groesse - vor.groesse) <= 0.5;
    const darunter = vor.y - zeilen[i].y > 0 && vor.y - zeilen[i].y <= 1.6 * vor.groesse;
    const ueberlappt = zeilen[i].x0 < vor.x1 && zeilen[i].x1 > vor.x0;
    if (!gleicheGroesse || !darunter || !ueberlappt) break;
    block.push(zeilen[i]);
  }
  return {
    text: block.map((z) => z.text).join(' ').replace(/\s+/g, ' ').trim(),
    groesse: block[0].groesse,
    zeilen: block.length,
  };
}

/**
 * Passt eine Agendazeile zu einem Folientitel? Gleich oder Praefix, beides auf
 * groben Wortstaemmen.
 *
 * @param {string} agendaZeile
 * @param {string} titel
 * @returns {boolean}
 */
function passt(agendaZeile, titel) {
  const a = gestemmt(agendaZeile);
  const t = gestemmt(titel);
  if (!a || !t) return false;
  if (a === t) return true;
  const [kurz, lang] = a.length <= t.length ? [a, t] : [t, a];
  return kurz.length >= MINDEST_PRAEFIX && lang.startsWith(kurz);
}

// ---------------------------------------------------------------------------
// Die drei Wege

/**
 * Die Agendafolie: eine der ersten fuenf Folien, deren Zeilen spaeter der
 * Reihe nach als Folientitel wiederkehren.
 *
 * Der eigene Titel der Agendafolie zaehlt nicht mit — „AGENDA" kehrt nirgends
 * wieder und wuerde den Anteil druecken.
 *
 * @param {readonly Folie[]} seiten
 * @returns {{ seite: number, kandidaten: number, treffer: { zeile: string, seite: number }[] } | null}
 */
export function findeAgenda(seiten) {
  const titel = seiten.map((s) => folientitel(s));
  /** @type {{ seite: number, kandidaten: number, treffer: { zeile: string, seite: number }[] } | null} */
  let bester = null;
  for (let i = 0; i < Math.min(AGENDA_UNTER, seiten.length); i++) {
    const eigen = titel[i];
    const kandidaten = seiten[i].zeilen
      .filter((z) => !z.gedreht)
      .map((z) => z.text)
      .filter((t) => !eigen || (t !== eigen.text && !eigen.text.startsWith(t)))
      .filter((t) => normal(t).length >= 3);
    if (kandidaten.length < AGENDA_MINDEST_TREFFER) continue;

    // Jede Agendazeile sucht die erste spaetere Folie, deren Titel passt —
    // aufsteigend, damit die Reihenfolge der Agenda die Reihenfolge der
    // Abschnitte ist und nicht umgekehrt.
    /** @type {{ zeile: string, seite: number }[]} */
    const treffer = [];
    let ab = i + 1;
    for (const kandidat of kandidaten) {
      for (let j = ab; j < seiten.length; j++) {
        const spaeter = titel[j];
        if (spaeter && passt(kandidat, spaeter.text)) {
          treffer.push({ zeile: kandidat, seite: seiten[j].nummer });
          ab = j + 1;
          break;
        }
      }
    }
    if (treffer.length < AGENDA_MINDEST_TREFFER) continue;
    if (treffer.length / kandidaten.length < AGENDA_MINDEST_ANTEIL) continue;
    if (!bester || treffer.length > bester.treffer.length) {
      bester = { seite: seiten[i].nummer, kandidaten: kandidaten.length, treffer };
    }
  }
  return bester;
}

/**
 * Titellaeufe: aufeinanderfolgende Folien mit demselben Folientitel.
 *
 * **Nur der Folientitel**, nicht irgendeine wiederkehrende Zeile. Wörtlich
 * genommen macht die Regel des Specs Rumpfzeilen zu Abschnittstiteln: Am
 * echten Material wurde einmal eine Aufzaehlungszeile zum Titel eines
 * Abschnitts ueber vierzehn Folien und einmal das blosse Wort „oder".
 *
 * @param {readonly Folie[]} seiten
 * @returns {{ titel: string, von: number, bis: number }[]}
 */
export function findeTitellaeufe(seiten) {
  const titel = seiten.map((s) => folientitel(s)?.text ?? null);
  const schluessel = seiten.map((_, i) => {
    const t = titel[i];
    return t && (titel[i - 1] === t || titel[i + 1] === t) ? t : null;
  });
  /** @type {{ schluessel: string, von: number, bis: number }[]} */
  const laeufe = [];
  for (let i = 0; i < seiten.length; i++) {
    const k = schluessel[i];
    if (!k) continue;
    const letzter = laeufe[laeufe.length - 1];
    if (letzter && letzter.schluessel === k && letzter.bis === i - 1) letzter.bis = i;
    else laeufe.push({ schluessel: k, von: i, bis: i });
  }
  return laeufe
    .filter((l) => l.bis - l.von + 1 >= LAUF_MINDEST)
    .map((l) => ({ titel: l.schluessel, von: seiten[l.von].nummer, bis: seiten[l.bis].nummer }));
}

/**
 * Grenzen mit Titeln zu luecklosen Bereichen ueber alle Folien 1..N machen.
 *
 * Die Folien vor der ersten Grenze — Titelfolie, Agendafolie — gehoeren zum
 * ersten Abschnitt. Sind es mehr als drei, bilden sie einen eigenen Abschnitt
 * mit Rueckfalltitel: Am echten Material begann der erste Titellauf einmal
 * erst auf Folie 20, und die neunzehn davor waeren im Abschnitt „ab Folie 20"
 * verschwunden.
 *
 * @param {{ von: number, titel: string | null }[]} grenzen
 * @param {number} N
 * @returns {[number, number, string | null][]}
 */
function ausGrenzen(grenzen, N) {
  const sortiert = [...grenzen].sort((a, b) => a.von - b.von);
  if (sortiert[0].von !== 1) {
    if (sortiert[0].von - 1 > VORLAUF_EIGEN_AB) sortiert.unshift({ von: 1, titel: null });
    else sortiert[0] = { ...sortiert[0], von: 1 };
  }
  return sortiert.map((g, i) => [g.von, (sortiert[i + 1]?.von ?? N + 1) - 1, g.titel]);
}

/**
 * Einen Foliensatz gliedern.
 *
 * @param {{ datei: string, seiten: readonly Folie[] }} dokument
 * @param {string} kuerzel aus `dateikuerzel()`
 * @returns {{ gliederung: Weg, abschnitte: Abschnitt[] }}
 */
export function gliedereFolien(dokument, kuerzel) {
  const N = dokument.seiten.length;
  const name = dokument.datei.replace(/\.pdf$/i, '').replace(/\s+/g, ' ').trim();

  /** @type {(weg: Weg, bereiche: [number, number, string | null][]) => { gliederung: Weg, abschnitte: Abschnitt[] }} */
  const mitIds = (weg, bereiche) => ({
    gliederung: weg,
    abschnitte: bereiche.map(([von, bis, titel], i) => ({
      // Zweistellig, damit Abschnitt 10 hinter Abschnitt 2 sortiert.
      id: `${kuerzel}-${String(i + 1).padStart(2, '0')}-${titel ? slug(titel) : `folien-${von}-${bis}`}`,
      titel: titel ?? `${name}, Folien ${von}–${bis}`,
      datei: dokument.datei,
      seiten: [von, bis],
    })),
  });

  if (N <= EINZELN_BIS) return mitIds('einzeln', [[1, N, null]]);

  const agenda = findeAgenda(dokument.seiten);
  if (agenda) {
    return mitIds(
      'agenda',
      ausGrenzen(
        agenda.treffer.map((t) => ({ von: t.seite, titel: t.zeile })),
        N,
      ),
    );
  }

  const laeufe = findeTitellaeufe(dokument.seiten);
  if (laeufe.length >= 2 || (laeufe.length === 1 && laeufe[0].von - 1 > VORLAUF_EIGEN_AB)) {
    return mitIds(
      'titellaeufe',
      ausGrenzen(
        laeufe.map((l) => ({ von: l.von, titel: l.titel })),
        N,
      ),
    );
  }

  // Gleichmaessig: so wenige Abschnitte wie moeglich, keiner ueber 15 Folien,
  // der Rest vorn verteilt.
  const anzahl = Math.ceil(N / GLEICHMAESSIG_HOECHSTENS);
  const grundgroesse = Math.floor(N / anzahl);
  const rest = N % anzahl;
  /** @type {[number, number, string | null][]} */
  const bereiche = [];
  let von = 1;
  for (let i = 0; i < anzahl; i++) {
    const groesse = grundgroesse + (i < rest ? 1 : 0);
    bereiche.push([von, von + groesse - 1, null]);
    von += groesse;
  }
  return mitIds('gleichmaessig', bereiche);
}
```

- [ ] **Schritt 3: Grün**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && npx vitest run tests/gliederung-folien.test.ts 2>&1 | grep -E "Tests  |Duration" && npm test 2>&1 | grep -E "Tests |Test Files |FAIL" && npm run check 2>&1 | grep -E "^- [0-9]+ (error|warning|hint)" && npm run build 2>&1 | grep -E "page\(s\)"
```
Erwartet: `Tests  34 passed (34)`, Dauer rund 1,5 s · **BASIS + 104** in 49 Testdateien · `- 0 errors`, `- 0 warnings`, `- 0 hints` · **SEITEN** `page(s) built`.

An den Fixtures ergibt das: `folien-agenda.pdf` → `agenda` mit 1–10, 11–18, 19–26 · `folien-laeufe.pdf` → `titellaeufe` mit sechs Abschnitten (1–4, 5–9, 10–13, 14–17, 18–20, 21–25) · `folien-gleichmaessig.pdf` → `gleichmaessig` mit 1–11, 12–22, 23–32 · `folien-wenig-text.pdf` → `einzeln`.

- [ ] **Schritt 4: Mutationsproben**

**Probe A** — in `passt` `gestemmt` durch `normal` ersetzen (beide Zeilen).
Vorhersage: 1 roter Test („trifft auch ueber den Wortstamm hinweg"). Gemessen: 1.

**Probe B** — in `findeTitellaeufe` den Schlüssel über jede wiederkehrende Zeile statt über den Folientitel bilden.
Vorhersage: 1 roter Test („nimmt nur den Folientitel, nicht irgendeine wiederkehrende Zeile"). Gemessen: 1.

**Probe C** — `const VORLAUF_EIGEN_AB = 100;`.
Vorhersage: 1 roter Test („gibt mehr als drei Folien vor der ersten Grenze einen eigenen Abschnitt"). Gemessen: 1.

**Probe D** — in `nachNummer` (erste Fundstelle von `String(i + 1).padStart(2, '0')`) das `padStart` streichen.
Vorhersage: die Rückfallkürzel heißen `d1`, `d2`. Gemessen: 5 rote — zwei in `dateikuerzel`, drei an den Fixtures.

**Probe E** — `const EINZELN_BIS = 15;`.
Vorhersage: 1 roter Test („laesst einen Satz bis 20 Folien ein Abschnitt"). Gemessen: 1.

- [ ] **Schritt 5: NUL-Prüfung und Commit**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && python -c "import sys; print('NUL:', sum(open(f,'rb').read().count(b'\x00') for f in sys.argv[1:]))" werkzeug/gliederung/folien.mjs tests/gliederung-folien.test.ts && git add werkzeug/gliederung/folien.mjs tests/gliederung-folien.test.ts && git commit -F - <<'MSG'
feat: Gliederer - Foliensaetze in Abschnitte teilen

Bis 20 Folien bleibt ein Satz ein Abschnitt. Darueber entscheidet die
Agendafolie, sonst die Titellaeufe, sonst wird gleichmaessig geteilt.

Drei Regeln sind gegenueber dem Spec geschaerft, jede gemessen:
- Die Agenda gleicht ueber grobe Wortstaemme ab, nicht Zeichen fuer Zeichen.
  "Begriffsbestimmungen" in der Agenda trifft sonst den Folientitel
  "Begriffsbestimmung - Risiko" nicht, und die Agenda faellt weg.
- Ein Titellauf zaehlt nur ueber den Folientitel. Woertlich genommen wird eine
  Aufzaehlungszeile zum Titel eines Abschnitts ueber vierzehn Folien.
- Mehr als drei Folien vor der ersten Grenze bilden einen eigenen Abschnitt.

Die Abschnitt-Id ist Kuerzel, zweistellige Nummer und Slug; Umlaute werden
ausgeschrieben, damit die Id in Lesereihenfolge sortiert und lesbar bleibt.

<CO-AUTHORED-BY>
MSG
git diff --stat HEAD~1
```
Erwartet: `NUL: 0` · `2 files changed, 712 insertions(+)`.

---

## Aufgabe 7: Manifest Fassung 3, `dateiHash` und der Stand einer Quelle

**Dateien:**
- Ändern: `werkzeug/manifest.mjs` (anhängen, eine Zeile im Kommentar), `src/lib/manifestauszug.ts`, `tests/manifest.test.ts`, `tests/manifestauszug.test.ts`

Drei Dinge entscheiden sich hier und nirgends sonst: wie ein Datei-Hash gebildet wird, wie aus mehreren Datei-Hashes der Stand einer Quelle wird, und was im Manifest steht. Alle drei sind Herkunftsnachweis — wer sie später anders rechnet, bekommt einen anderen Stand, und die Seite meldet „das Manifest gehört zu einem anderen Stand".

`inhaltsHash` nimmt Text. Ein PDF ist keiner: Als UTF-8 gelesen bekäme es an jedem ungültigen Byte ein Ersatzzeichen, und zwei verschiedene PDFs könnten denselben Hash tragen. Deshalb `dateiHash(bytes)` im selben Format.

Der Stand ist **festgeschrieben**: die Datei-Hashes nach Codepunkten **sortiert**, mit `\n` verbunden, ohne `\n` am Ende, das Ganze durch `inhaltsHash`. Sortiert nach Wert und nicht nach Dateinamen — sonst änderte ein Umbenennen den Stand (gemessen: es käme `sha256:6b77ebcc…` statt `sha256:f99ba946…` heraus).

Fassung 3 gilt für Buch und Folien; Git bleibt bei 2. Die beiden Herkünfte haben außer dem Stand fast nichts gemeinsam, und ein Manifest, das beides mit lauter leeren Feldern abdeckt, sagt weniger, nicht mehr.

- [ ] **Schritt 1: Die Tests schreiben (rot)**

In `tests/manifest.test.ts` den Import ersetzen durch:

```ts
import {
  baueDokumentManifest,
  baueManifest,
  dateiHash,
  inhaltsHash,
  MANIFEST_FASSUNG,
  MANIFEST_FASSUNG_DOKUMENT,
  standAusHashes,
} from '../werkzeug/manifest.mjs';
```

und ans Ende der Datei anhängen:

```ts
/**
 * Fassung 3 — das Manifest einer Quelle aus Buch- oder Folienseiten.
 *
 * Drei Dinge entscheiden sich hier und nirgends sonst: wie ein Datei-Hash
 * gebildet wird, wie aus mehreren Datei-Hashes der Stand einer Quelle wird,
 * und was im Manifest steht. Alle drei sind Herkunftsnachweis: Wer sie
 * spaeter anders rechnet, bekommt einen anderen Stand — und die Seite meldet
 * „das Manifest gehört zu einem anderen Stand".
 */
describe('dateiHash', () => {
  const bytes = (...werte: number[]) => new Uint8Array(werte);

  it('nennt das Verfahren im Wert selbst', () => {
    expect(dateiHash(bytes(1, 2, 3))).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it('liefert fuer dieselben Bytes denselben Wert', () => {
    expect(dateiHash(bytes(1, 2, 3))).toBe(dateiHash(bytes(1, 2, 3)));
    expect(dateiHash(bytes(1, 2, 3))).not.toBe(dateiHash(bytes(1, 2, 4)));
  });

  it('unterscheidet Bytes, die als Text gleich aussehen wuerden', () => {
    // Zwei verschiedene ungueltige UTF-8-Folgen: Als Text gelesen wuerden
    // beide zum Ersatzzeichen und haetten denselben Hash. Ein PDF ist kein Text.
    expect(dateiHash(bytes(0xff, 0xfe))).not.toBe(dateiHash(bytes(0xfe, 0xff)));
  });
});

describe('standAusHashes', () => {
  const hashes = ['sha256:' + 'c'.repeat(64), 'sha256:' + 'a'.repeat(64), 'sha256:' + 'b'.repeat(64)];

  it('haengt nicht an der Reihenfolge der Eingabe', () => {
    expect(standAusHashes(hashes)).toBe(standAusHashes([...hashes].reverse()));
  });

  it('sortiert nach Wert und nicht nach der Reihenfolge, in der die Dateien kamen', () => {
    // Sonst haette dieselbe Menge Dateien zwei Staende, je nachdem, wie sie
    // heissen — und ein Umbenennen aendere den Stand.
    expect(standAusHashes(hashes)).not.toBe(inhaltsHash(hashes.join('\n')));
  });

  it('rechnet genau ueber die sortierten Werte, mit Zeilenumbruch dazwischen', () => {
    const sortiert = [...hashes].sort();
    expect(standAusHashes(hashes)).toBe(inhaltsHash(sortiert.join('\n')));
    expect(standAusHashes(hashes)).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it('haengt an jedem einzelnen Hash', () => {
    expect(standAusHashes(hashes)).not.toBe(standAusHashes([...hashes.slice(1), 'sha256:' + 'd'.repeat(64)]));
  });
});

describe('baueDokumentManifest', () => {
  const originale = [
    { datei: 'M7.pdf', dateiHash: 'sha256:' + 'a'.repeat(64), seiten: 35, gliederung: 'agenda', beiwerkZeichen: 6676 },
    { datei: 'M9.pdf', dateiHash: 'sha256:' + 'b'.repeat(64), seiten: 13, gliederung: 'einzeln', beiwerkZeichen: 2643 },
  ];
  const roh = [
    { id: 'm07-01-begriff', datei: 'M7.pdf', seiten: [1, 5] as [number, number], nurBild: [], tabellenverdacht: [2] },
    { id: 'm07-02-prozess', datei: 'M7.pdf', seiten: [6, 35] as [number, number], nurBild: [16, 19], tabellenverdacht: [17, 26] },
    { id: 'm09-01-folien-1-13', datei: 'M9.pdf', seiten: [1, 13] as [number, number], nurBild: [13], tabellenverdacht: [5, 7] },
  ];
  const baue = () => baueDokumentManifest({ art: 'folien', originale, roh, gestempeltAm: '2026-09-23T08:00:00.000Z' });

  it('traegt Fassung 3 und den Stand aus den Datei-Hashes', () => {
    const manifest = baue();
    expect(manifest.fassung).toBe(3);
    expect(MANIFEST_FASSUNG_DOKUMENT).toBe(3);
    expect(manifest.herkunft).toEqual({
      art: 'folien',
      stand: standAusHashes(originale.map((o) => o.dateiHash)),
    });
  });

  it('rechnet die Summen aus Originalen und Rohdateien', () => {
    expect(baue().summe).toEqual({
      originale: 2,
      seiten: 48,
      abschnitte: 3,
      nurBild: 3,
      tabellenverdacht: 5,
      beiwerkZeichen: 9319,
    });
  });

  it('nennt jede Bildseite und jede Tabellenseite einzeln, nicht nur als Zahl', () => {
    // Der Compiler oeffnet genau diese Seiten im Original. Eine Zaehlung
    // allein sagte ihm nicht, welche.
    expect(baue().roh).toEqual(roh);
    expect(baue().originale).toEqual(originale);
  });

  it('verlangt den Zeitstempel, statt ihn zu erzeugen', () => {
    expect(() => baueDokumentManifest({ art: 'folien', originale, roh, gestempeltAm: '' })).toThrow(/Zeitstempel fehlt/);
  });

  it('verlangt mindestens ein Original', () => {
    expect(() => baueDokumentManifest({ art: 'folien', originale: [], roh, gestempeltAm: 'jetzt' })).toThrow(
      /keine Originale/,
    );
  });

  it('verlangt zu jedem Original seinen Hash', () => {
    const ohne = [{ ...originale[0], dateiHash: '' }];
    expect(() => baueDokumentManifest({ art: 'folien', originale: ohne, roh, gestempeltAm: 'jetzt' })).toThrow(
      /dateiHash fehlt fuer "M7.pdf"/,
    );
  });
});
```

In `tests/manifestauszug.test.ts` im Test „nennt eine Fassung, die diese Seite nicht kennt, beim Namen" `fassung: 3` durch `fassung: 4` und den erwarteten Grund durch `'Fassung 4 kennt diese Seite nicht'` ersetzen — Fassung 3 kennt die Seite ab jetzt. Dann ans Ende der Datei anhängen:

```ts
/**
 * Fassung 3 — was das Einlesen von Buch und Folien schreibt.
 *
 * Die Seite liest daraus drei Zahlen und den Stand. Alles andere im Manifest
 * — die Seitenlisten je Abschnitt, die Originale mit ihren Hashes — ist fuer
 * den Compiler da und geht diesen Leser nichts an; er muss es uebergehen,
 * nicht daran scheitern.
 */
const fassung3 = {
  fassung: 3,
  gestempeltAm: '2026-09-23T08:00:00.000Z',
  herkunft: { art: 'folien', stand: `sha256:${'f'.repeat(64)}` },
  summe: { originale: 9, seiten: 199, abschnitte: 22, nurBild: 8, tabellenverdacht: 21, beiwerkZeichen: 41902 },
  originale: [{ datei: 'M7.pdf', dateiHash: `sha256:${'a'.repeat(64)}`, seiten: 35, gliederung: 'agenda', beiwerkZeichen: 6676 }],
  roh: [{ id: 'm07-01-begriff', datei: 'M7.pdf', seiten: [1, 5], nurBild: [], tabellenverdacht: [2] }],
};

/** Legt die Aenderung stumpf ueber das gueltige Manifest der Fassung 3. */
function text3(aenderung: Record<string, unknown> = {}): string {
  return JSON.stringify({ ...fassung3, ...aenderung });
}

describe('leseManifestauszug - Fassung 3', () => {
  it('liest Stand und die drei Zahlen der Lueckenzeile', () => {
    expect(leseManifestauszug(text3())).toEqual({
      art: 'dokument',
      stand: `sha256:${'f'.repeat(64)}`,
      seiten: 199,
      nurBild: 8,
      tabellenverdacht: 21,
    });
  });

  it('liest ein Buch genauso wie Folien — die Einheit steht im Lehrplan', () => {
    const auszug = leseManifestauszug(text3({ herkunft: { art: 'buch', stand: `sha256:${'f'.repeat(64)}` } }));
    expect(auszug.art).toBe('dokument');
  });

  it('nimmt Fassung 3 ohne Summen nicht fuer bare Muenze', () => {
    const { summe: _summe, ...ohne } = fassung3;
    expect(leseManifestauszug(JSON.stringify(ohne))).toEqual({
      art: 'unlesbar',
      grund: 'Fassung 3, aber unvollständig',
    });
  });

  it('weist einen Stand zurueck, der kein sha256 ist', () => {
    // Der Lehrplan haelt denselben Wert; passt die Form nicht, liesse sich
    // beides nicht mehr gegeneinander halten.
    expect(leseManifestauszug(text3({ herkunft: { art: 'folien', stand: 'a13701e' } }))).toEqual({
      art: 'unlesbar',
      grund: 'Fassung 3, aber unvollständig',
    });
  });

  it('nennt eine Fassung, die diese Seite nicht kennt, weiterhin beim Namen', () => {
    expect(leseManifestauszug(text3({ fassung: 4 }))).toEqual({
      art: 'unlesbar',
      grund: 'Fassung 4 kennt diese Seite nicht',
    });
  });
});
```

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && npx vitest run tests/manifest.test.ts tests/manifestauszug.test.ts 2>&1 | grep -E "Tests  |Error" | head -4
```
Erwartet: `Test Files  2 failed (2)` und `Tests  17 failed | 29 passed (46)`, die meisten mit `TypeError: dateiHash is not a function` — `dateiHash`, `standAusHashes` und `baueDokumentManifest` gibt es noch nicht.

- [ ] **Schritt 2: `werkzeug/manifest.mjs` erweitern**

Im Kommentar über `MANIFEST_FASSUNG` hinter der Zeile „…sonst traegt die Nummer nichts." zwei Zeilen einfügen:

```js
 *
 * Diese Fassung gilt fuer Git-Quellen. Buch und Folien schreiben Fassung 3,
 * weiter unten.
```

Ans Ende der Datei anhängen:

```js
/**
 * 3 fuer Buch und Folien. Der Git-Adapter schreibt weiter Fassung 2: Die
 * beiden Herkuenfte haben ausser dem Stand fast nichts gemeinsam, und ein
 * Manifest, das beides mit lauter leeren Feldern abdeckt, sagt weniger, nicht
 * mehr. Die Fassung steht im Wert, damit ein Leser nicht raten muss.
 */
export const MANIFEST_FASSUNG_DOKUMENT = 3;

/**
 * Der Hash einer Datei, wie ihn das Manifest fuehrt — dasselbe Format wie
 * `inhaltsHash`, nur ueber Bytes statt ueber Text.
 *
 * Ein PDF ist keine Textdatei: `inhaltsHash` wuerde es als UTF-8 lesen und an
 * jedem ungueltigen Byte ein Ersatzzeichen einsetzen. Zwei verschiedene PDFs
 * koennten dann denselben Hash bekommen.
 *
 * @param {Uint8Array} bytes
 * @returns {string}
 */
export function dateiHash(bytes) {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

/**
 * Der Stand einer Quelle aus mehreren Originalen.
 *
 * Das Verfahren steht hier fest und nicht nur im Kopf dessen, der es zuerst
 * gerechnet hat: die Datei-Hashes **nach Codepunkten sortiert**, mit `\n`
 * verbunden, ohne `\n` am Ende, das Ganze durch `inhaltsHash`. Sortiert nach
 * Wert und nicht nach Dateinamen — dann ergibt dieselbe Menge Dateien
 * denselben Stand, gleich in welcher Reihenfolge sie hereinkommen und gleich
 * wie sie heissen. (Nach Dateinamen sortiert kaeme ein anderer Wert heraus;
 * gemessen, nicht vermutet.)
 *
 * @param {readonly string[]} dateiHashes
 * @returns {string}
 */
export function standAusHashes(dateiHashes) {
  const sortiert = [...dateiHashes].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return inhaltsHash(sortiert.join('\n'));
}

/**
 * @typedef {{ datei: string, dateiHash: string, seiten: number, gliederung: string, beiwerkZeichen: number }} Original
 * @typedef {{ id: string, datei: string, seiten: [number, number], nurBild: number[], tabellenverdacht: number[] }} Rohdatei
 */

/**
 * Das Manifest einer Quelle aus Buch- oder Folienseiten, Fassung 3.
 *
 * Es beantwortet dieselben drei Fragen wie Fassung 2 — woher, was ist nicht
 * mitgekommen, steht in der Rohdatei noch das, was aus der Quelle kam —, nur
 * heisst „nicht mitgekommen" hier etwas anderes: Bilder und Tabellen, die der
 * Text nicht traegt. Deshalb stehen sie **je Seite** da und nicht als blosse
 * Zahl: Der Compiler sieht sich genau diese Seiten im Original an.
 *
 * Der Zeitstempel wird uebergeben und nicht erzeugt, wie bei Fassung 2 — sonst
 * ist das Manifest bei jedem Lauf verschieden und nicht vergleichbar.
 *
 * @param {{
 *   art: 'buch' | 'folien',
 *   originale: readonly Original[],
 *   roh: readonly Rohdatei[],
 *   gestempeltAm: string,
 * }} eingabe
 */
export function baueDokumentManifest({ art, originale, roh, gestempeltAm }) {
  if (!gestempeltAm) {
    throw new Error(
      'baueDokumentManifest: Zeitstempel fehlt. Er wird uebergeben, nicht erzeugt — ' +
        'sonst ist das Manifest bei jedem Lauf verschieden und nicht vergleichbar.',
    );
  }
  if (!originale?.length) {
    throw new Error('baueDokumentManifest: keine Originale. Ohne sie gibt es keinen Stand und keinen Herkunftsnachweis.');
  }
  for (const o of originale) {
    if (!o.dateiHash) {
      throw new Error(
        `baueDokumentManifest: dateiHash fehlt fuer "${o.datei}". Ohne ihn laesst sich nicht sagen, ` +
          'ob das Original seit dem Einlesen ausgetauscht wurde.',
      );
    }
  }

  return {
    fassung: MANIFEST_FASSUNG_DOKUMENT,
    gestempeltAm,
    herkunft: { art, stand: standAusHashes(originale.map((o) => o.dateiHash)) },
    summe: {
      originale: originale.length,
      seiten: originale.reduce((n, o) => n + o.seiten, 0),
      abschnitte: roh.length,
      nurBild: roh.reduce((n, r) => n + r.nurBild.length, 0),
      tabellenverdacht: roh.reduce((n, r) => n + r.tabellenverdacht.length, 0),
      beiwerkZeichen: originale.reduce((n, o) => n + o.beiwerkZeichen, 0),
    },
    originale: originale.map((o) => ({
      datei: o.datei,
      dateiHash: o.dateiHash,
      seiten: o.seiten,
      gliederung: o.gliederung,
      beiwerkZeichen: o.beiwerkZeichen,
    })),
    roh: roh.map((r) => ({
      id: r.id,
      datei: r.datei,
      seiten: r.seiten,
      nurBild: r.nurBild,
      tabellenverdacht: r.tabellenverdacht,
    })),
  };
}
```

- [ ] **Schritt 3: `src/lib/manifestauszug.ts` liest Fassung 3**

Im Kopfkommentar den Absatz

```ts
 * Gelesen wird Fassung 2, die der Git-Adapter schreibt. Die Form fuer Buecher
 * und Folien (`dokument`) steht schon im Typ, weil `abdeckung` sie verrechnet;
 * den Leser dafuer bringt das Einlesen von Lehrmaterial mit, zusammen mit der
 * Fassung, die es schreibt. Bis dahin ist jede andere Fassung `unlesbar`.
 */
```

ersetzen durch:

```ts
 * Gelesen werden zwei Fassungen: 2 vom Git-Adapter, 3 vom Einlesen von Buch
 * und Folien. Jede andere ist `unlesbar` — lieber keine Zahl als eine aus
 * einem Format, das diese Seite nicht kennt.
 */
```

Unmittelbar vor dem Kommentar zu `leseManifestauszug` einfügen:

```ts
/**
 * Fassung 3, soweit die Seite sie braucht: der Stand und die drei Zahlen der
 * Lueckenzeile. Was der Compiler braucht — die Seiten je Bildfolie und je
 * Tabellenfolie, die Originale mit ihren Hashes — steht im Manifest und wird
 * hier nicht gelesen: Die Seite zeigt Zahlen, keine Seitenlisten.
 */
const Fassung3Schema = z.object({
  fassung: z.literal(3),
  herkunft: z.object({
    art: z.enum(['buch', 'folien']),
    stand: z.string().trim().regex(/^sha256:[0-9a-f]{64}$/),
  }),
  summe: z.object({
    seiten: z.number().int().min(0),
    nurBild: z.number().int().min(0),
    tabellenverdacht: z.number().int().min(0),
  }),
});
```

und in `leseManifestauszug` alles ab `if (fassung !== 2)` bis zum Ende der Funktion ersetzen durch:

```ts
  if (fassung === 2) {
    const befund = Fassung2Schema.safeParse(roh);
    if (!befund.success) return { art: 'unlesbar', grund: 'Fassung 2, aber unvollständig' };
    return {
      art: 'git',
      stand: befund.data.herkunft.sha,
      uebernommen: befund.data.summe.uebernommen,
      ausgelassen: befund.data.summe.ausgelassen,
    };
  }

  if (fassung === 3) {
    const befund = Fassung3Schema.safeParse(roh);
    if (!befund.success) return { art: 'unlesbar', grund: 'Fassung 3, aber unvollständig' };
    return {
      art: 'dokument',
      stand: befund.data.herkunft.stand,
      seiten: befund.data.summe.seiten,
      nurBild: befund.data.summe.nurBild,
      tabellenverdacht: befund.data.summe.tabellenverdacht,
    };
  }

  return { art: 'unlesbar', grund: `Fassung ${fassung} kennt diese Seite nicht` };
}
```

Der Typ `Manifestauszug` bleibt unverändert: Die Form `dokument` steht seit 2a im Typ, nur gelesen hat sie bisher niemand.

- [ ] **Schritt 4: Grün**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && npx vitest run tests/manifest.test.ts 2>&1 | grep -oE "Tests  [0-9]+ passed" && npx vitest run tests/manifestauszug.test.ts 2>&1 | grep -oE "Tests  [0-9]+ passed" && npm test 2>&1 | grep -E "Tests |Test Files |FAIL" && npm run check 2>&1 | grep -E "^- [0-9]+ (error|warning|hint)" && npm run build 2>&1 | grep -E "page\(s\)"
```
Erwartet: `Tests  27 passed` · `Tests  19 passed` · **BASIS + 122** · `- 0 errors`, `- 0 warnings`, `- 0 hints` · **SEITEN** `page(s) built`.

- [ ] **Schritt 5: Mutationsproben**

**Probe A** — in `standAusHashes` die Sortierung weglassen (`return inhaltsHash(dateiHashes.join('\n'));`).
Vorhersage: der Stand hängt an der Reihenfolge der Eingabe. Gemessen: 3 rote Tests.

**Probe B** — `dateiHash` über Text statt über Bytes rechnen (`return inhaltsHash(Buffer.from(bytes).toString('utf8'));`).
Vorhersage: 1 roter Test („unterscheidet Bytes, die als Text gleich aussehen wuerden"). Gemessen: 1.

**Probe C** — im `Fassung3Schema` die Formprüfung am Stand streichen (`stand: z.string().trim(),`).
Vorhersage: 1 roter Test („weist einen Stand zurueck, der kein sha256 ist"). Gemessen: 1.

**Probe D** — in `baueDokumentManifest` die Prüfung `if (!originale?.length)` abschalten.
Vorhersage: 1 roter Test („verlangt mindestens ein Original"). Gemessen: 1.

- [ ] **Schritt 6: NUL-Prüfung und Commit**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && python -c "import sys; print('NUL:', sum(open(f,'rb').read().count(b'\x00') for f in sys.argv[1:]))" werkzeug/manifest.mjs src/lib/manifestauszug.ts tests/manifest.test.ts tests/manifestauszug.test.ts && git add werkzeug/manifest.mjs src/lib/manifestauszug.ts tests/manifest.test.ts tests/manifestauszug.test.ts && git commit -F - <<'MSG'
feat: Manifest Fassung 3 fuer Buch und Folien, dateiHash und der Stand einer Quelle

dateiHash hasht Bytes, nicht Text: Ein PDF als UTF-8 gelesen bekaeme an jedem
ungueltigen Byte ein Ersatzzeichen, und zwei verschiedene PDFs koennten
denselben Hash tragen.

standAusHashes legt das Verfahren fest: Datei-Hashes nach Codepunkten
sortiert, mit \n verbunden, durch inhaltsHash. Nach Wert sortiert und nicht
nach Dateinamen - sonst aenderte ein Umbenennen den Stand.

Das Manifest nennt jede Bildseite und jede Tabellenseite einzeln, nicht nur
als Zahl: Der Compiler oeffnet genau diese Seiten im Original.
manifestauszug.ts liest Fassung 3 als Form dokument; Fassung 2 bleibt Git.

<CO-AUTHORED-BY>
MSG
git diff --stat HEAD~1
```
Erwartet: `NUL: 0` · `4 files changed, 347 insertions(+), 16 deletions(-)`.

---

## Aufgabe 8: Das Einlesen als Funktion — Rohdateien, Manifest, Lehrplan-Gerüst, Vergleich

**Dateien:**
- Neu: `werkzeug/adapter/folien.mjs`, `werkzeug/lehrplan-geruest.mjs`, `tests/einlesen-folien.test.ts`

Hier wird zusammengesetzt, was die Aufgaben 4 bis 7 einzeln können, und auf den Datenträger gebracht — **gegen ein beliebiges Verzeichnis**, damit ein Test nicht ins Projekt schreiben muss. Dieselbe Schnittstelle nach außen wie `adapter/git.mjs`: Orte und Kurzname hinein, `quellen/<kurzname>/` heraus.

Zwei Entscheidungen stehen in dieser Aufgabe fest:

**Der Lehrplan wird nie überschrieben.** In ihm steckt die Arbeit des Compilers und die Freigabe eines Menschen. `quellen/` ist abgeleitet und wird bei jedem Lauf neu geschrieben; der Lehrplan bleibt, und das Einlesen meldet den Vergleich — neue, fehlende, verschobene Abschnitte und ob sich der Stand geändert hat.

**Die Rohdatei sagt, wo der Text nichts hergibt.** Vor einer Folie mit Tabellenverdacht steht eine Warnzeile, eine Bildfolie steht als Marke mit Hinweis da. Der Compiler (2c) öffnet genau diese Seiten im Original; eine Zählung allein sagte ihm nicht, welche.

- [ ] **Schritt 1: Die Tests schreiben (rot)**

`tests/einlesen-folien.test.ts` anlegen:

```ts
// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { load as yamlLesen } from 'js-yaml';
import { ladePdfjs } from '../werkzeug/adapter/dokument.mjs';
import { EinleseFehler, leseFolienEin, natuerlich, sammlePdfs } from '../werkzeug/adapter/folien.mjs';
import { lehrplanGeruest, vergleicheLehrplan, vergleichInZeilen } from '../werkzeug/lehrplan-geruest.mjs';
import { pruefeLehrplan } from '../src/lib/lehrplan';

/**
 * Das Einlesen als Ganzes — gegen ein Temp-Verzeichnis, an den Fixtures.
 *
 * Kein Test schreibt ins Projekt und keiner liest `quellen/`: Der Ordner ist
 * gitignored, auf GitHub gibt es ihn nicht. Was hier entsteht, entsteht in
 * einem Verzeichnis, das am Ende wieder verschwindet.
 *
 * pdf.js wird einmal geladen und durchgereicht; jeder Lauf laedt es sonst neu.
 */
const FIXTUREN = path.resolve(__dirname, 'fixtures');
const STEMPEL = '2026-09-23T08:00:00.000Z';

let geladen: Awaited<ReturnType<typeof ladePdfjs>>;
beforeAll(async () => {
  geladen = await ladePdfjs();
});

/** Ein leeres Arbeitsverzeichnis mit `lehrplan/` darin. */
function temp(): string {
  const ordner = mkdtempSync(path.join(tmpdir(), 'kernbohrung-einlesen-'));
  mkdirSync(path.join(ordner, 'lehrplan'), { recursive: true });
  return ordner;
}

const lies = (...teile: string[]) => readFileSync(path.join(...teile), 'utf8');

/** Liest die beiden Foliensaetze mit Agenda und Titellaeufen als eine Quelle ein. */
const einlesen = (wurzel: string, orte = [path.join(FIXTUREN, 'folien-agenda.pdf'), path.join(FIXTUREN, 'folien-laeufe.pdf')]) =>
  leseFolienEin({
    orte,
    kurzname: 'fixture-vorlesung',
    titel: 'Fixture-Vorlesung Projektmanagement',
    wurzel,
    gestempeltAm: STEMPEL,
    geladen,
  });

describe('sammlePdfs', () => {
  it('nimmt alle PDF einer Mappe in natuerlicher Reihenfolge', () => {
    const ordner = temp();
    try {
      for (const name of ['M10 b.pdf', 'M2 a.pdf', 'notizen.txt']) writeFileSync(path.join(ordner, name), 'x');
      expect(sammlePdfs([ordner]).map((p) => path.basename(p))).toEqual(['M2 a.pdf', 'M10 b.pdf']);
    } finally {
      rmSync(ordner, { recursive: true, force: true });
    }
  });

  it('nimmt eine Datei doppelt genannt nur einmal', () => {
    const eine = path.join(FIXTUREN, 'folien-agenda.pdf');
    expect(sammlePdfs([eine, eine])).toHaveLength(1);
  });

  it('sagt, was es nicht gibt', () => {
    expect(() => sammlePdfs([path.join(FIXTUREN, 'gibt-es-nicht.pdf')])).toThrow(EinleseFehler);
    expect(() => sammlePdfs([path.join(FIXTUREN, 'gibt-es-nicht.pdf')])).toThrow(/gibt es nicht/);
  });

  it('weist alles zurueck, was kein PDF ist', () => {
    const ordner = temp();
    try {
      writeFileSync(path.join(ordner, 'buch.epub'), 'x');
      expect(() => sammlePdfs([path.join(ordner, 'buch.epub')])).toThrow(/liest nur PDF/);
      expect(() => sammlePdfs([ordner])).toThrow(/keine PDF-Datei/);
    } finally {
      rmSync(ordner, { recursive: true, force: true });
    }
  });

  it('sortiert nach der ersten Zahl im Namen, nicht nach Codepunkten', () => {
    expect(['M10 b.pdf', 'M2 a.pdf', 'M9 c.pdf'].sort(natuerlich)).toEqual(['M2 a.pdf', 'M9 c.pdf', 'M10 b.pdf']);
  });
});

describe('leseFolienEin - was entsteht', () => {
  it('legt Originale, Rohdateien und das Manifest an', async () => {
    const wurzel = temp();
    try {
      const aus = await einlesen(wurzel);
      const quelle = path.join(wurzel, 'quellen', 'fixture-vorlesung');
      expect(readdirSync(path.join(quelle, 'original')).sort()).toEqual(['folien-agenda.pdf', 'folien-laeufe.pdf']);
      expect(readdirSync(path.join(quelle, 'roh')).sort()).toEqual(
        aus.abschnitte.map((a) => `${a.id}.md`).sort(),
      );
      expect(aus.abschnitte).toHaveLength(9);
      expect(aus.abschnitte.map((a) => a.id)).toEqual([
        'd01-01-grundlagen-der-planung',
        'd01-02-kosten-und-termine',
        'd01-03-risiken-im-projekt',
        'd02-01-grundlagen-der-planung',
        'd02-02-planungsphasen-im-ueberblick',
        'd02-03-kosten-und-termine',
        'd02-04-terminplanung',
        'd02-05-risiken-im-projekt',
        'd02-06-risikobewertung',
      ]);
      expect(aus.warnungen).toEqual([]);
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });

  it('schreibt die Rohdatei mit Kopfzeile, Seitenmarken und beiden Hinweisen', async () => {
    const wurzel = temp();
    try {
      await einlesen(wurzel);
      const roh = lies(wurzel, 'quellen', 'fixture-vorlesung', 'roh', 'd01-01-grundlagen-der-planung.md');
      expect(roh.startsWith('# Grundlagen der Planung\n\nfolien-agenda.pdf, Folien 1–10\n\n')).toBe(true);
      expect(roh).toContain('— Folie 1 —');
      // Die Bildfolie steht als Marke mit Hinweis da, ohne Text.
      expect(roh).toContain('— Folie 9 —\nnur Bild — im Original ansehen');
      // Die Warnzeile steht VOR der Seitenmarke der Tabellenfolie.
      const tabelle = lies(wurzel, 'quellen', 'fixture-vorlesung', 'roh', 'd01-02-kosten-und-termine.md');
      expect(tabelle).toContain(
        '> Tabelle oder Grafik — die Anordnung fehlt im Text; im Original ansehen.\n— Folie 14 —',
      );
      // Die Foliennummer des Briefkopfs ist weg.
      expect(roh).not.toMatch(/^Folie \d+$/m);
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });

  it('schreibt ein Manifest der Fassung 3 mit Stand, Summen und Seitenlisten', async () => {
    const wurzel = temp();
    try {
      const aus = await einlesen(wurzel);
      const manifest = JSON.parse(lies(wurzel, 'quellen', 'fixture-vorlesung', 'manifest.json'));
      expect(manifest.fassung).toBe(3);
      expect(manifest.gestempeltAm).toBe(STEMPEL);
      expect(manifest.herkunft).toEqual({ art: 'folien', stand: aus.stand });
      expect(manifest.summe).toEqual({
        originale: 2,
        seiten: 51,
        abschnitte: 9,
        nurBild: 2,
        tabellenverdacht: 2,
        beiwerkZeichen: manifest.originale[0].beiwerkZeichen + manifest.originale[1].beiwerkZeichen,
      });
      expect(manifest.originale.map((o: { datei: string; seiten: number; gliederung: string }) => [o.datei, o.seiten, o.gliederung])).toEqual([
        ['folien-agenda.pdf', 26, 'agenda'],
        ['folien-laeufe.pdf', 25, 'titellaeufe'],
      ]);
      expect(manifest.roh.find((r: { id: string }) => r.id === 'd01-01-grundlagen-der-planung')).toEqual({
        id: 'd01-01-grundlagen-der-planung',
        datei: 'folien-agenda.pdf',
        seiten: [1, 10],
        nurBild: [9],
        tabellenverdacht: [],
      });
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });

  it('raeumt Rohdateien weg, die es nicht mehr gibt', async () => {
    const wurzel = temp();
    try {
      await einlesen(wurzel);
      const roh = path.join(wurzel, 'quellen', 'fixture-vorlesung', 'roh');
      writeFileSync(path.join(roh, 'd01-99-veraltet.md'), '# alt\n');
      await einlesen(wurzel);
      expect(existsSync(path.join(roh, 'd01-99-veraltet.md'))).toBe(false);
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });
});

describe('leseFolienEin - der Lehrplan', () => {
  it('legt ein Geruest an, das auf die Freigabe wartet', async () => {
    const wurzel = temp();
    try {
      const aus = await einlesen(wurzel);
      expect(aus.lehrplan.geschrieben).toBe(true);
      const text = lies(wurzel, 'lehrplan', 'fixture-vorlesung.yaml');
      expect(text.startsWith('# Diese Datei hat das Einlesen angelegt')).toBe(true);
      expect(text).toContain('geprueftVon: ""');

      const befund = pruefeLehrplan(yamlLesen(text), new Set<string>());
      if (befund.ok) throw new Error('Erwartet war „wartet auf Freigabe".');
      expect(befund.wartet).toBe(true);
      if (!befund.wartet) throw new Error('unerreichbar');
      expect(befund.lehrplan.art).toBe('folien');
      expect(befund.lehrplan.stand).toBe(aus.stand);
      if (befund.lehrplan.art === 'repo') throw new Error('Erwartet waren Folien.');
      expect(befund.lehrplan.abschnitte.map((a) => a.status)).toEqual(Array(9).fill('offen'));
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });

  it('ueberschreibt einen vorhandenen Lehrplan nie und meldet „keine Änderung"', async () => {
    const wurzel = temp();
    try {
      await einlesen(wurzel);
      const pfad = path.join(wurzel, 'lehrplan', 'fixture-vorlesung.yaml');
      const vonHand = `${lies(pfad).replace('geprueftVon: ""', 'geprueftVon: "Daniel Nobs"')}`;
      writeFileSync(pfad, vonHand, 'utf8');

      const zweiter = await einlesen(wurzel);
      expect(zweiter.lehrplan.geschrieben).toBe(false);
      expect(lies(pfad)).toBe(vonHand);
      expect(vergleichInZeilen(zweiter.lehrplan.vergleich!)).toEqual(['keine Änderung']);
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });

  it('schreibt das Geruest deterministisch', () => {
    const eingabe = {
      kurzname: 'fixture-vorlesung',
      titel: 'Fixture-Vorlesung: „Projektmanagement"',
      stand: `sha256:${'a'.repeat(64)}`,
      abschnitte: [{ id: 'd01-01-grundlagen', titel: 'Grundlagen', datei: 'a.pdf', seiten: [1, 10] as [number, number] }],
    };
    expect(lehrplanGeruest(eingabe)).toBe(lehrplanGeruest(eingabe));
    // Titel in Anfuehrungszeichen, Sonderzeichen maskiert.
    expect(lehrplanGeruest(eingabe)).toContain('titel: "Fixture-Vorlesung: „Projektmanagement\\""');
  });
});

describe('vergleicheLehrplan', () => {
  const alt = lehrplanGeruest({
    kurzname: 'q',
    titel: 'T',
    stand: `sha256:${'a'.repeat(64)}`,
    abschnitte: [
      { id: 'm01-01-eins', titel: 'Eins', datei: 'M1.pdf', seiten: [1, 10] },
      { id: 'm01-02-zwei', titel: 'Zwei', datei: 'M1.pdf', seiten: [11, 20] },
    ],
  });

  it('meldet keine Änderung, wenn nichts anders ist', () => {
    const vergleich = vergleicheLehrplan(alt, {
      stand: `sha256:${'a'.repeat(64)}`,
      abschnitte: [
        { id: 'm01-01-eins', titel: 'Eins', datei: 'M1.pdf', seiten: [1, 10] },
        { id: 'm01-02-zwei', titel: 'Zwei', datei: 'M1.pdf', seiten: [11, 20] },
      ],
    });
    expect(vergleich.unveraendert).toBe(2);
    expect(vergleichInZeilen(vergleich)).toEqual(['keine Änderung']);
  });

  it('meldet neue, fehlende und verschobene Abschnitte und den Stand', () => {
    const vergleich = vergleicheLehrplan(alt, {
      stand: `sha256:${'b'.repeat(64)}`,
      abschnitte: [
        { id: 'm01-01-eins', titel: 'Eins', datei: 'M1.pdf', seiten: [1, 12] },
        { id: 'm01-03-drei', titel: 'Drei', datei: 'M1.pdf', seiten: [13, 20] },
      ],
    });
    expect(vergleich.neue).toEqual(['m01-03-drei']);
    expect(vergleich.fehlende).toEqual(['m01-02-zwei']);
    expect(vergleich.verschobene).toEqual([{ id: 'm01-01-eins', alt: [1, 10], neu: [1, 12] }]);
    expect(vergleichInZeilen(vergleich)).toEqual([
      `Stand geändert: sha256:${'a'.repeat(64)} → sha256:${'b'.repeat(64)}`,
      'neu: m01-03-drei',
      'fehlt jetzt: m01-02-zwei',
      'verschoben: m01-01-eins 1–10 → 1–12',
    ]);
  });
});

describe('leseFolienEin - was nicht geht', () => {
  it('bricht bei einem Satz ohne Textebene ab', async () => {
    const wurzel = temp();
    try {
      await expect(einlesen(wurzel, [path.join(FIXTUREN, 'folien-scan.pdf')])).rejects.toThrow(/kein Textinhalt/);
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });

  it('weist ein Buch mit klarer Meldung ab', async () => {
    const wurzel = temp();
    try {
      await expect(einlesen(wurzel, [path.join(FIXTUREN, 'buch-hochformat.pdf')])).rejects.toThrow(
        /Bücher liest diese Fassung noch nicht ein/,
      );
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });

  it('laesst sich mit --art folien ueberstimmen', async () => {
    const wurzel = temp();
    try {
      const aus = await leseFolienEin({
        orte: [path.join(FIXTUREN, 'buch-hochformat.pdf')],
        kurzname: 'trotzdem-folien',
        titel: 'Hochformat, trotzdem als Folien',
        wurzel,
        art: 'folien',
        gestempeltAm: STEMPEL,
        geladen,
      });
      expect(aus.abschnitte).toHaveLength(1);
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });

  it('verlangt einen Kurznamen im Muster der Ids und einen Titel', async () => {
    const wurzel = temp();
    const orte = [path.join(FIXTUREN, 'folien-agenda.pdf')];
    try {
      await expect(
        leseFolienEin({ orte, kurzname: 'Bauch PM', titel: 'x', wurzel, gestempeltAm: STEMPEL, geladen }),
      ).rejects.toThrow(/nur Kleinbuchstaben/);
      await expect(
        leseFolienEin({ orte, kurzname: 'bauch-pm', titel: '  ', wurzel, gestempeltAm: STEMPEL, geladen }),
      ).rejects.toThrow(/--titel fehlt/);
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });
});
```

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && npx vitest run tests/einlesen-folien.test.ts 2>&1 | grep -E "Tests  |Error" | head -4
```
Erwartet: `Tests  no tests` und `Error: Cannot find module '../werkzeug/adapter/folien.mjs' imported from …/tests/einlesen-folien.test.ts`.

- [ ] **Schritt 2: `werkzeug/lehrplan-geruest.mjs` anlegen**

```js
/**
 * Das Lehrplan-Geruest, das das Einlesen anlegt — und der Vergleich mit einem,
 * der schon da ist.
 *
 * Geschrieben wird von Hand und nicht mit `yaml.dump`: Die Datei ist die, an
 * der ein Mensch am Review-Gate sitzt. Reihenfolge, Anfuehrungszeichen und der
 * Kopfkommentar sollen deshalb festliegen und nicht von der Voreinstellung
 * einer Bibliothek abhaengen. Zweimal erzeugt ergibt dasselbe Byte fuer Byte.
 *
 * **Ein vorhandener Lehrplan wird nie ueberschrieben.** In ihm steckt die
 * Arbeit des Compilers und die Freigabe eines Menschen; `quellen/` ist
 * abgeleitet, der Lehrplan ist es nicht.
 */
import { load as yamlLesen } from 'js-yaml';

/**
 * @typedef {{ id: string, titel: string, datei: string, seiten: [number, number] }} Abschnitt
 * @typedef {{
 *   stand: { alt: string, neu: string, geaendert: boolean },
 *   neue: string[],
 *   fehlende: string[],
 *   verschobene: { id: string, alt: [number, number], neu: [number, number] }[],
 *   unveraendert: number,
 * }} Vergleich
 */

/**
 * Ein Wert in doppelten Anfuehrungszeichen.
 *
 * Immer, nicht nur wo noetig: Ein Titel aus einer Folie kann mit einem
 * Doppelpunkt, einem Bindestrich oder einer Zahl anfangen, und YAML liest
 * dann etwas anderes als Text. Ein Titel, der `"` oder `\` enthaelt, wird
 * maskiert.
 *
 * @param {string} wert
 * @returns {string}
 */
function inAnfuehrung(wert) {
  return `"${wert.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
}

/**
 * Der Text des Lehrplans, den das Einlesen anlegt.
 *
 * Alle Abschnitte stehen als `offen` da, und `geprueftVon`/`geprueftAm` sind
 * leer: Das ist der Zustand „wartet auf Freigabe" — die Seite zeigt die
 * Zahlen und markiert sie, der Compiler baut daraus noch nichts.
 *
 * @param {{ kurzname: string, titel: string, stand: string, abschnitte: readonly Abschnitt[] }} eingabe
 * @returns {string}
 */
export function lehrplanGeruest({ kurzname, titel, stand, abschnitte }) {
  const zeilen = [
    '# Diese Datei hat das Einlesen angelegt (npm run ingest -- --folien … --name ' + kurzname + ').',
    '# Die Freigabe traegt ein Mensch von Hand ein: geprueftVon und geprueftAm.',
    '# Bis dahin zeigt die Bibliothek die Zahlen und baut der Compiler keine Lektionen.',
    'art: folien',
    `quelle: ${kurzname}`,
    `titel: ${inAnfuehrung(titel)}`,
    `stand: ${inAnfuehrung(stand)}`,
    'geprueftVon: ""',
    'geprueftAm: ""',
    'abschnitte:',
  ];
  for (const a of abschnitte) {
    zeilen.push(
      `  - id: ${a.id}`,
      `    titel: ${inAnfuehrung(a.titel)}`,
      `    datei: ${inAnfuehrung(a.datei)}`,
      `    seiten: [${a.seiten[0]}, ${a.seiten[1]}]`,
      '    status: offen',
    );
  }
  return `${zeilen.join('\n')}\n`;
}

/**
 * Was sich gegenueber einem vorhandenen Lehrplan geaendert hat.
 *
 * Verglichen wird ueber die Abschnitt-Id. Der Slug haengt am Titel: Aendert
 * der Verfasser eine Agendazeile, heisst derselbe Abschnitt beim naechsten
 * Einlesen anders und erscheint hier als „neu" und „fehlt". Das ist unschoen,
 * aber ehrlich — und deshalb entscheidet ein Mensch, was damit geschieht, und
 * nicht dieses Werkzeug.
 *
 * @param {string} altesYaml
 * @param {{ stand: string, abschnitte: readonly Abschnitt[] }} neu
 * @returns {Vergleich}
 */
export function vergleicheLehrplan(altesYaml, neu) {
  const geladen = yamlLesen(altesYaml);
  const alt = typeof geladen === 'object' && geladen !== null ? /** @type {Record<string, unknown>} */ (geladen) : {};
  const alteAbschnitte = Array.isArray(alt.abschnitte) ? alt.abschnitte : [];
  /** @type {Map<string, [number, number]>} */
  const alteSeiten = new Map();
  for (const a of alteAbschnitte) {
    if (a && typeof a === 'object' && typeof a.id === 'string' && Array.isArray(a.seiten)) {
      alteSeiten.set(a.id, [Number(a.seiten[0]), Number(a.seiten[1])]);
    }
  }
  const neueIds = new Set(neu.abschnitte.map((a) => a.id));

  /** @type {{ id: string, alt: [number, number], neu: [number, number] }[]} */
  const verschobene = [];
  let unveraendert = 0;
  for (const a of neu.abschnitte) {
    const vorher = alteSeiten.get(a.id);
    if (!vorher) continue;
    if (vorher[0] === a.seiten[0] && vorher[1] === a.seiten[1]) unveraendert++;
    else verschobene.push({ id: a.id, alt: vorher, neu: a.seiten });
  }

  const altStand = typeof alt.stand === 'string' ? alt.stand : '';
  return {
    stand: { alt: altStand, neu: neu.stand, geaendert: altStand !== neu.stand },
    neue: neu.abschnitte.filter((a) => !alteSeiten.has(a.id)).map((a) => a.id),
    fehlende: [...alteSeiten.keys()].filter((id) => !neueIds.has(id)),
    verschobene,
    unveraendert,
  };
}

/**
 * Der Vergleich in Zeilen fuer die Konsole. Nur Ids, Zahlen und Seitenbereiche
 * — kein Folientext.
 *
 * @param {Vergleich} vergleich
 * @returns {string[]}
 */
export function vergleichInZeilen(vergleich) {
  if (
    !vergleich.stand.geaendert &&
    vergleich.neue.length === 0 &&
    vergleich.fehlende.length === 0 &&
    vergleich.verschobene.length === 0
  ) {
    return ['keine Änderung'];
  }
  const zeilen = [];
  if (vergleich.stand.geaendert) {
    zeilen.push(`Stand geändert: ${vergleich.stand.alt || '(keiner)'} → ${vergleich.stand.neu}`);
  }
  if (vergleich.neue.length) zeilen.push(`neu: ${vergleich.neue.join(', ')}`);
  if (vergleich.fehlende.length) zeilen.push(`fehlt jetzt: ${vergleich.fehlende.join(', ')}`);
  for (const v of vergleich.verschobene) {
    zeilen.push(`verschoben: ${v.id} ${v.alt[0]}–${v.alt[1]} → ${v.neu[0]}–${v.neu[1]}`);
  }
  return zeilen;
}
```

- [ ] **Schritt 3: `werkzeug/adapter/folien.mjs` anlegen**

```js
/**
 * Foliensaetze einlesen: Pfade und Kurzname hinein, `quellen/<kurzname>/` und
 * ein Lehrplan-Geruest heraus.
 *
 * Dieselbe Schnittstelle nach aussen wie `adapter/git.mjs`, und wie dort
 * steckt die Arbeit in den Teilen darunter: `dokument.mjs` liest die Seiten,
 * `gliederung/folien.mjs` macht Abschnitte daraus, `manifest.mjs` schreibt den
 * Herkunftsnachweis. Hier wird nur zusammengesetzt und auf den Datentraeger
 * gebracht — gegen ein beliebiges Verzeichnis, damit ein Test nicht in das
 * Projekt schreiben muss.
 *
 * **Auf der Konsole steht nie Folientext.** Das Material gehoert seinen
 * Verfassern; gemeldet werden Zahlen, Dateinamen, Abschnitt-Ids und Titel.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { BEIWERK_WARNUNG, artDerQuelle, bereinigeQuelle, ladePdfjs, liesSeiten, seitenText } from './dokument.mjs';
import { dateikuerzel, gliedereFolien } from '../gliederung/folien.mjs';
import { baueDokumentManifest, dateiHash, standAusHashes } from '../manifest.mjs';
import { lehrplanGeruest, vergleicheLehrplan } from '../lehrplan-geruest.mjs';

/**
 * Was auf einer Folie mit Tabellenverdacht ueber dem Text steht.
 *
 * Nicht „hier stand eine Tabelle": Die Regel schlaegt auch bei Diagrammen an.
 * Beides hat dasselbe Problem — die Anordnung traegt die Bedeutung, und die
 * Extraktion traegt die Anordnung nicht.
 */
export const WARNZEILE = '> Tabelle oder Grafik — die Anordnung fehlt im Text; im Original ansehen.';

/** Was anstelle des Texts einer Folie steht, die nur ein Bild traegt. */
export const NUR_BILD_ZEILE = 'nur Bild — im Original ansehen';

/** Bricht das Einlesen mit einer Meldung ab, die man dem Nutzer zeigen kann. */
export class EinleseFehler extends Error {}

/** Nur diese Endung liest diese Fassung. */
const ENDUNG = '.pdf';

/**
 * Natuerliche Sortierung: nach der ersten Zahl im Namen, dann nach
 * Codepunkten. Sonst stuende `M10` vor `M2`, und die Abschnitt-Ids liefen
 * gegen die Lesereihenfolge.
 *
 * Eigener Vergleich statt `localeCompare` — der haengt an der
 * Spracheinstellung des Rechners, und zwei Rechner sollen dieselbe Quelle
 * gleich einlesen.
 *
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function natuerlich(a, b) {
  const za = Number((a.match(/\d+/) ?? ['0'])[0]);
  const zb = Number((b.match(/\d+/) ?? ['0'])[0]);
  if (za !== zb) return za - zb;
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Die PDF-Dateien hinter den angegebenen Orten, in natuerlicher Reihenfolge.
 *
 * Ein Ort ist eine Datei oder ein Ordner; ein Ordner bringt alle `.pdf` darin
 * mit, nicht rekursiv. Doppelte Pfade fallen weg.
 *
 * @param {readonly string[]} orte
 * @returns {string[]}
 */
export function sammlePdfs(orte) {
  /** @type {string[]} */
  const gefunden = [];
  for (const ort of orte) {
    if (!existsSync(ort)) throw new EinleseFehler(`${ort} gibt es nicht.`);
    if (statSync(ort).isDirectory()) {
      const drin = readdirSync(ort).filter((name) => name.toLowerCase().endsWith(ENDUNG));
      if (!drin.length) throw new EinleseFehler(`In ${ort} liegt keine PDF-Datei.`);
      for (const name of drin) gefunden.push(path.join(ort, name));
    } else if (ort.toLowerCase().endsWith(ENDUNG)) {
      gefunden.push(ort);
    } else {
      throw new EinleseFehler(`${ort} ist keine PDF-Datei. Diese Fassung liest nur PDF.`);
    }
  }
  // Einmal am Ende sortiert, nicht je Ort: Wer zwei Mappen angibt, bekommt
  // eine Quelle — und in ihr laufen die Dateien in einer Reihenfolge.
  const einmal = [...new Set(gefunden.map((p) => path.resolve(p)))];
  return einmal.sort((a, b) => natuerlich(path.basename(a), path.basename(b)));
}

/**
 * Der Inhalt einer Rohdatei: Kopfzeile, dann der Nutztext mit Seitenmarken.
 *
 * Die Seitenmarke ist der Grund, warum das hier ueberhaupt eine Datei wird:
 * Ohne sie zeigte jede spaetere Behauptung auf einen Satz von
 * fuenfunddreissig Folien statt auf eine.
 *
 * @param {{ id: string, titel: string, datei: string, seiten: [number, number] }} abschnitt
 * @param {readonly import('./dokument.mjs').Seite[]} seiten
 * @returns {string}
 */
export function rohdatei(abschnitt, seiten) {
  const [von, bis] = abschnitt.seiten;
  const kopf = [
    `# ${abschnitt.titel}`,
    '',
    `${abschnitt.datei}, ${von === bis ? `Folie ${von}` : `Folien ${von}–${bis}`}`,
    '',
    '',
  ];
  const teile = seiten.map((seite) => {
    if (seite.nurBild) return `— Folie ${seite.nummer} —\n${NUR_BILD_ZEILE}`;
    const text = seitenText(seite);
    return seite.tabellenverdacht ? `${WARNZEILE}\n${text}` : text;
  });
  return `${kopf.join('\n')}${teile.join('\n\n')}\n`;
}

/**
 * @typedef {{ datei: string, dateiHash: string, seiten: number, gliederung: string, beiwerkZeichen: number, nurBild: number[], tabellenverdacht: number[], beiwerkAnteil: number }} Bericht
 * @typedef {{
 *   kurzname: string,
 *   stand: string,
 *   originale: Bericht[],
 *   abschnitte: { id: string, titel: string, datei: string, seiten: [number, number] }[],
 *   warnungen: string[],
 *   lehrplan: { pfad: string, geschrieben: boolean, vergleich: import('../lehrplan-geruest.mjs').Vergleich | null },
 * }} Ergebnis
 */

/**
 * Liest eine Quelle aus Foliensaetzen ein.
 *
 * @param {{
 *   orte: readonly string[],
 *   kurzname: string,
 *   titel: string,
 *   wurzel: string,
 *   art?: 'folien',
 *   gestempeltAm: string,
 *   geladen?: Awaited<ReturnType<typeof ladePdfjs>>,
 * }} auftrag
 * @returns {Promise<Ergebnis>}
 */
export async function leseFolienEin({ orte, kurzname, titel, wurzel, art, gestempeltAm, geladen }) {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(kurzname)) {
    throw new EinleseFehler(`--name ${kurzname}: nur Kleinbuchstaben, Ziffern und Bindestrich.`);
  }
  if (!titel.trim()) throw new EinleseFehler('--titel fehlt. Die Bibliothek zeigt ihn auf der Karte.');

  const pfade = sammlePdfs(orte);
  const pdfjs = geladen ?? (await ladePdfjs());

  /** @type {{ datei: string, hash: string, seiten: import('./dokument.mjs').RohSeite[] }[]} */
  const roh = [];
  for (const pfad of pfade) {
    const bytes = readFileSync(pfad);
    const { seiten } = await liesSeiten(new Uint8Array(bytes), pdfjs);
    roh.push({ datei: path.basename(pfad), hash: dateiHash(bytes), seiten });
  }

  const namen = roh.map((r) => r.datei);
  if (new Set(namen).size !== namen.length) {
    throw new EinleseFehler('Zwei Originale heißen gleich. Im Lehrplan steht der Dateiname; er muss eindeutig sein.');
  }

  const dateien = bereinigeQuelle(roh.map((r) => ({ datei: r.datei, seiten: r.seiten })));
  const abgebrochen = dateien.filter((d) => d.abbruch !== null);
  if (abgebrochen.length) throw new EinleseFehler(abgebrochen.map((d) => d.abbruch).join('\n'));

  const erkannt = artDerQuelle(dateien);
  if (erkannt.art === 'buch' && art !== 'folien') {
    throw new EinleseFehler(
      'Bücher liest diese Fassung noch nicht ein — erkannt wurde „buch" ' +
        `(${erkannt.quer} von ${erkannt.seiten} Seiten quer, Median ${erkannt.median} Zeichen). ` +
        'Mit --art folien lässt sich die Erkennung überstimmen.',
    );
  }

  const kuerzel = dateikuerzel(namen);
  const gegliedert = dateien.map((d) => ({ datei: d, ...gliedereFolien(d, kuerzel.get(d.datei) ?? 'd01') }));
  const abschnitte = gegliedert.flatMap((g) => g.abschnitte);
  const stand = standAusHashes(roh.map((r) => r.hash));

  // --- schreiben ------------------------------------------------------------
  const quellordner = path.join(wurzel, 'quellen', kurzname);
  const rohordner = path.join(quellordner, 'roh');
  const originalordner = path.join(quellordner, 'original');
  // Alte Rohdateien wegraeumen: Faellt ein Abschnitt weg, bliebe er sonst
  // liegen und das Manifest widerspraeche dem Ordner daneben.
  rmSync(rohordner, { recursive: true, force: true });
  rmSync(originalordner, { recursive: true, force: true });
  mkdirSync(rohordner, { recursive: true });
  mkdirSync(originalordner, { recursive: true });
  pfade.forEach((pfad) => copyFileSync(pfad, path.join(originalordner, path.basename(pfad))));

  /** @type {import('../manifest.mjs').Rohdatei[]} */
  const rohListe = [];
  for (const { datei, abschnitte: teile } of gegliedert) {
    for (const abschnitt of teile) {
      const [von, bis] = abschnitt.seiten;
      const seiten = datei.seiten.filter((s) => s.nummer >= von && s.nummer <= bis);
      writeFileSync(path.join(rohordner, `${abschnitt.id}.md`), rohdatei(abschnitt, seiten), 'utf8');
      rohListe.push({
        id: abschnitt.id,
        datei: abschnitt.datei,
        seiten: abschnitt.seiten,
        nurBild: seiten.filter((s) => s.nurBild).map((s) => s.nummer),
        tabellenverdacht: seiten.filter((s) => s.tabellenverdacht).map((s) => s.nummer),
      });
    }
  }

  const manifest = baueDokumentManifest({
    art: 'folien',
    originale: gegliedert.map(({ datei, gliederung }, i) => ({
      datei: datei.datei,
      dateiHash: roh[i].hash,
      seiten: datei.seitenzahl,
      gliederung,
      beiwerkZeichen: datei.beiwerkZeichen,
    })),
    roh: rohListe,
    gestempeltAm,
  });
  writeFileSync(path.join(quellordner, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  // --- Lehrplan -------------------------------------------------------------
  const lehrplanPfad = path.join(wurzel, 'lehrplan', `${kurzname}.yaml`);
  const text = lehrplanGeruest({ kurzname, titel, stand, abschnitte });
  let geschrieben = false;
  /** @type {import('../lehrplan-geruest.mjs').Vergleich | null} */
  let vergleich = null;
  if (existsSync(lehrplanPfad)) {
    // Nie ueberschreiben: Im Lehrplan steckt die Arbeit des Compilers und die
    // Freigabe eines Menschen. Gemeldet wird, was sich geaendert hat.
    vergleich = vergleicheLehrplan(readFileSync(lehrplanPfad, 'utf8'), { stand, abschnitte });
  } else {
    mkdirSync(path.dirname(lehrplanPfad), { recursive: true });
    writeFileSync(lehrplanPfad, text, 'utf8');
    geschrieben = true;
  }

  const warnungen = dateien
    .filter((d) => d.beiwerkAnteil > BEIWERK_WARNUNG)
    .map(
      (d) =>
        `${d.datei}: ${(d.beiwerkAnteil * 100).toFixed(1)} % des Texts als Beiwerk entfernt — ` +
        'vermutlich stimmt etwas mit der Extraktion nicht.',
    );

  return {
    kurzname,
    stand,
    originale: gegliedert.map(({ datei, gliederung }, i) => ({
      datei: datei.datei,
      dateiHash: roh[i].hash,
      seiten: datei.seitenzahl,
      gliederung,
      beiwerkZeichen: datei.beiwerkZeichen,
      beiwerkAnteil: datei.beiwerkAnteil,
      nurBild: datei.nurBild,
      tabellenverdacht: datei.tabellenverdacht,
    })),
    abschnitte,
    warnungen,
    lehrplan: { pfad: lehrplanPfad, geschrieben, vergleich },
  };
}
```

- [ ] **Schritt 4: Grün**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && npx vitest run tests/einlesen-folien.test.ts 2>&1 | grep -E "Tests  |Duration" && npm test 2>&1 | grep -E "Tests |Test Files |FAIL" && npm run check 2>&1 | grep -E "^- [0-9]+ (error|warning|hint)" && npm run build 2>&1 | grep -E "page\(s\)"
```
Erwartet: `Tests  18 passed (18)`, Dauer rund 5 bis 7 s (der längste einzelne Test rund 1 s — weit unter der Frist von 20 s) · **BASIS + 140** in 50 Testdateien · `- 0 errors`, `- 0 warnings`, `- 0 hints` · **SEITEN** `page(s) built`.

**Wenn der volle Lauf unerklärlich rot wird:** Regel 11. Im Probelauf meldete ein `npm test` unmittelbar nach einem `npm run build` einmal drei rote Tests in den vier pdf.js-Dateien; drei Läufe allein danach waren grün. Einmal allein wiederholen, bevor du etwas änderst.

- [ ] **Schritt 5: Mutationsproben**

**Probe A** — in `rohdatei` die Warnzeile weglassen (`return text;`).
Vorhersage: 1 roter Test („schreibt die Rohdatei mit Kopfzeile, Seitenmarken und beiden Hinweisen"). Gemessen: 1.

**Probe B** — `if (existsSync(lehrplanPfad))` durch `if (false)` ersetzen (der Lehrplan wird überschrieben).
Vorhersage: 1 roter Test („ueberschreibt einen vorhandenen Lehrplan nie"). Gemessen: 1.

**Probe C** — die Art-Prüfung abschalten (`if (false)`).
Vorhersage: 1 roter Test („weist ein Buch mit klarer Meldung ab"). Gemessen: 1.

**Probe D** — das `rmSync(rohordner, …)` streichen.
Vorhersage: 1 roter Test („raeumt Rohdateien weg, die es nicht mehr gibt"). Gemessen: 1.

**Probe E** — in `sammlePdfs` die letzte Zeile durch `return einmal.sort();` ersetzen.
Vorhersage: 1 roter Test („nimmt alle PDF einer Mappe in natuerlicher Reihenfolge") — `M10` stünde vor `M2`. Gemessen: 1.

- [ ] **Schritt 6: NUL-Prüfung und Commit**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && python -c "import sys; print('NUL:', sum(open(f,'rb').read().count(b'\x00') for f in sys.argv[1:]))" werkzeug/adapter/folien.mjs werkzeug/lehrplan-geruest.mjs tests/einlesen-folien.test.ts && git add werkzeug/adapter/folien.mjs werkzeug/lehrplan-geruest.mjs tests/einlesen-folien.test.ts && git commit -F - <<'MSG'
feat: Einlesen von Foliensaetzen als Funktion, mit Lehrplan-Geruest und Vergleich

leseFolienEin schreibt quellen/<kurzname>/ mit den Originalen, je Abschnitt
eine Rohdatei mit Seitenmarken und dem Manifest der Fassung 3 - gegen ein
beliebiges Verzeichnis, damit Tests nicht ins Projekt schreiben.

Vor einer Folie mit Tabellenverdacht steht eine Warnzeile, eine Bildfolie
steht als Marke mit Hinweis da: Der Compiler soll genau diese Seiten im
Original ansehen.

Der Lehrplan wird angelegt, wenn es ihn nicht gibt - mit leerer Freigabe, also
wartend. Gibt es ihn, bleibt er unveraendert und das Einlesen meldet den
Vergleich: neue, fehlende, verschobene Abschnitte und ob sich der Stand
geaendert hat. In ihm steckt die Arbeit des Compilers; quellen/ ist
abgeleitet, der Lehrplan ist es nicht.

<CO-AUTHORED-BY>
MSG
git diff --stat HEAD~1
```
Erwartet: `NUL: 0` · `3 files changed, 747 insertions(+)`.

---

## Aufgabe 9: Der Aufruf — `npm run ingest -- --folien …` und das README

**Dateien:**
- Neu: `werkzeug/ingest-folien.mjs`, `tests/ingest-aufruf.test.ts`
- Verschoben: `werkzeug/ingest.mjs` → `werkzeug/ingest-git.mjs` (unverändert bis auf den Kopfkommentar)
- Ersetzt: `werkzeug/ingest.mjs` (nur noch die Weiche)
- Ändern: `README.md`

Der Git-Weg bleibt wörtlich derselbe: `npm run ingest -- --git … --pfad … --name …`. Sein Code zieht unverändert nach `ingest-git.mjs`; `ingest.mjs` ist nur noch die Weiche. Geladen wird der gewählte Weg erst, wenn er gewählt ist — so zieht ein Git-Lauf pdf.js nicht mit hoch, und ein Folien-Lauf klont nichts.

Der wichtigste Test dieser Aufgabe ist der zum Urheberrecht: **kein Satz aus einer Rohdatei steht in der Konsolenausgabe.** Gemeldet werden Zahlen, Dateinamen, Abschnitt-Ids und Abschnittstitel — die Titel stehen ohnehin im Lehrplan, den ein Mensch lesen muss.

- [ ] **Schritt 1: Den Git-Weg verschieben**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && git mv werkzeug/ingest.mjs werkzeug/ingest-git.mjs
```

In `werkzeug/ingest-git.mjs` die erste Zeile `#!/usr/bin/env node` ersetzen durch:

```js
/**
 * Der Git-Weg des Einlesens. Aufgerufen wird er ueber `werkzeug/ingest.mjs`;
 * der Befehl ist derselbe geblieben:
 *
 *   npm run ingest -- --git <url> --pfad <unterpfad> --name <kurzname>
 *
 * Diese Datei ist unveraendert aus `ingest.mjs` hierhergezogen, als das
 * Einlesen einen zweiten Weg bekam (Foliensaetze). Wer sie liest, liest den
 * Stand von Teilprojekt 1.
 */
```

Sonst **nichts** ändern.

- [ ] **Schritt 2: Die Tests schreiben (rot)**

`tests/ingest-aufruf.test.ts` anlegen:

```ts
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { argumente, bericht, fuehreAus } from '../werkzeug/ingest-folien.mjs';

/**
 * Der Aufruf: was auf der Kommandozeile steht und was auf der Konsole landet.
 *
 * Der wichtigste Test hier ist der letzte: **kein Folientext auf der
 * Konsole.** Das Material gehoert seinen Verfassern. Gemeldet werden Zahlen,
 * Dateinamen, Abschnitt-Ids und Abschnittstitel — die stehen ohnehin im
 * Lehrplan, den ein Mensch lesen muss.
 */
const WURZEL = path.resolve(__dirname, '..');
const FIXTUREN = path.join(WURZEL, 'tests', 'fixtures');

function temp(): string {
  const ordner = mkdtempSync(path.join(tmpdir(), 'kernbohrung-ingest-'));
  mkdirSync(path.join(ordner, 'lehrplan'), { recursive: true });
  return ordner;
}

/** Sammelt die Ausgabe eines Laufs statt sie zu drucken. */
async function lauf(argv: string[], wurzel: string): Promise<{ code: number; zeilen: string[] }> {
  const zeilen: string[] = [];
  const code = await fuehreAus(argv, wurzel, (zeile: string) => zeilen.push(zeile));
  return { code, zeilen };
}

describe('argumente', () => {
  it('sammelt ein mehrfach genanntes Argument in der Reihenfolge der Zeile', () => {
    expect(argumente(['--folien', 'a', '--name', 'x', '--folien', 'b'], 'folien')).toEqual(['a', 'b']);
  });

  it('uebergeht ein Argument ohne Wert', () => {
    expect(argumente(['--titel'], 'titel')).toEqual([]);
    expect(argumente(['--titel', '--name', 'x'], 'titel')).toEqual([]);
  });
});

describe('fuehreAus', () => {
  it('verlangt Kurzname und Titel und zeigt sonst den Aufruf', async () => {
    const { code, zeilen } = await lauf(['--folien', path.join(FIXTUREN, 'folien-agenda.pdf')], WURZEL);
    expect(code).toBe(2);
    expect(zeilen[0]).toBe('--name und --titel sind Pflicht.');
    expect(zeilen.join('\n')).toContain('--folien <pfad>');
  });

  it('kennt nur --art folien', async () => {
    const { code, zeilen } = await lauf(['--folien', 'x', '--name', 'y', '--titel', 'T', '--art', 'buch'], WURZEL);
    expect(code).toBe(2);
    expect(zeilen[0]).toBe('--art buch kennt diese Fassung nicht. Erlaubt ist nur --art folien.');
  });

  it('meldet einen Abbruch als Zeile, nicht als Stapelabzug', async () => {
    const wurzel = temp();
    try {
      const { code, zeilen } = await lauf(
        ['--folien', path.join(FIXTUREN, 'buch-hochformat.pdf'), '--name', 'x', '--titel', 'T'],
        wurzel,
      );
      expect(code).toBe(1);
      expect(zeilen).toHaveLength(1);
      expect(zeilen[0]).toMatch(/^Bücher liest diese Fassung noch nicht ein/);
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });

  it('berichtet Zahlen, Dateien, Ids und Titel — und keinen Folientext', async () => {
    const wurzel = temp();
    try {
      const { code, zeilen } = await lauf(
        [
          '--folien',
          path.join(FIXTUREN, 'folien-agenda.pdf'),
          '--folien',
          path.join(FIXTUREN, 'folien-laeufe.pdf'),
          '--name',
          'fixture-vorlesung',
          '--titel',
          'Fixture-Vorlesung',
        ],
        wurzel,
      );
      expect(code).toBe(0);
      const text = zeilen.join('\n');
      expect(zeilen[1]).toBe('2 Originale, 51 Seiten, 9 Abschnitte.');
      expect(zeilen[2]).toBe(
        '  folien-agenda.pdf — 26 Seiten · agenda · Beiwerk 36,2 % · 1 nur Bild · 1 mit Tabelle oder Grafik',
      );
      expect(text).toContain('  d01-01-grundlagen-der-planung — folien-agenda.pdf, Folien 1–10 — Grundlagen der Planung');
      expect(text).toContain('lehrplan/fixture-vorlesung.yaml — angelegt, wartet auf Freigabe.');

      // Kein Satz aus dem Inhalt der Folien — nur das, was auch im Lehrplan steht.
      const rohtext = readFileSync(
        path.join(wurzel, 'quellen', 'fixture-vorlesung', 'roh', 'd01-01-grundlagen-der-planung.md'),
        'utf8',
      );
      const saetze = rohtext
        .split('\n')
        .filter((z) => z.startsWith('• '))
        .map((z) => z.slice(2));
      expect(saetze.length).toBeGreaterThan(0);
      for (const satz of saetze) expect(text).not.toContain(satz);
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });

  it('laesst einen vorhandenen Lehrplan stehen und meldet den Vergleich', async () => {
    const wurzel = temp();
    const argv = [
      '--folien',
      path.join(FIXTUREN, 'folien-agenda.pdf'),
      '--name',
      'fixture-vorlesung',
      '--titel',
      'Fixture-Vorlesung',
    ];
    try {
      await lauf(argv, wurzel);
      const { code, zeilen } = await lauf(argv, wurzel);
      expect(code).toBe(0);
      expect(zeilen.at(-2)).toBe('  lehrplan/fixture-vorlesung.yaml — liegt schon da und bleibt unverändert.');
      expect(zeilen.at(-1)).toBe('    keine Änderung');
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });
});

describe('bericht', () => {
  it('nennt eine Warnung ueber der Beiwerkschwelle eigens', () => {
    const zeilen = bericht(
      {
        kurzname: 'q',
        stand: `sha256:${'a'.repeat(64)}`,
        originale: [
          {
            datei: 'M2.pdf',
            dateiHash: `sha256:${'a'.repeat(64)}`,
            seiten: 29,
            gliederung: 'agenda',
            beiwerkZeichen: 5907,
            beiwerkAnteil: 0.702,
            nurBild: [4, 5],
            tabellenverdacht: [16],
          },
        ],
        abschnitte: [{ id: 'm02-01-x', titel: 'X', datei: 'M2.pdf', seiten: [1, 29] }],
        warnungen: ['M2.pdf: 70,2 % des Texts als Beiwerk entfernt — vermutlich stimmt etwas mit der Extraktion nicht.'],
        lehrplan: { pfad: path.join('/w', 'lehrplan', 'q.yaml'), geschrieben: true, vergleich: null },
      },
      '/w',
    );
    expect(zeilen).toContain(
      '  M2.pdf — 29 Seiten · agenda · Beiwerk 70,2 % · 2 nur Bild · 1 mit Tabelle oder Grafik',
    );
    expect(zeilen).toContain(
      'Warnung: M2.pdf: 70,2 % des Texts als Beiwerk entfernt — vermutlich stimmt etwas mit der Extraktion nicht.',
    );
    expect(zeilen).toContain('  m02-01-x — M2.pdf, Folien 1–29 — X');
  });
});

describe('werkzeug/ingest.mjs', () => {
  /** Startet die Weiche und liefert Rueckgabewert und Fehlerausgabe. */
  function weiche(...argv: string[]): { code: number; ausgabe: string } {
    try {
      execFileSync(process.execPath, [path.join(WURZEL, 'werkzeug', 'ingest.mjs'), ...argv], {
        encoding: 'utf8',
        stdio: 'pipe',
      });
      return { code: 0, ausgabe: '' };
    } catch (fehler) {
      const f = fehler as { status: number; stderr: string };
      return { code: f.status, ausgabe: f.stderr };
    }
  }

  it('weist --git und --folien zusammen zurueck', () => {
    // Eine Quelle hat eine Herkunft. Geraten wird nichts.
    const { code, ausgabe } = weiche('--git', 'https://x/y.git', '--folien', 'a.pdf', '--name', 'z');
    expect(code).toBe(2);
    expect(ausgabe).toContain('--git und --folien zusammen geht nicht. Eine Quelle hat eine Herkunft.');
  });

  it('zeigt ohne Argument beide Wege und bricht mit 2 ab', () => {
    const { code, ausgabe } = weiche();
    expect(code).toBe(2);
    expect(ausgabe).toContain('npm run ingest -- --git <url> --pfad <unterpfad> --name <kurzname>');
    expect(ausgabe).toContain('npm run ingest -- --folien <pfad>');
    expect(ausgabe).toContain('Bücher und EPUB liest diese Fassung noch nicht ein.');
  });
});
```

- [ ] **Schritt 3: `werkzeug/ingest-folien.mjs` anlegen**

```js
/**
 * Der Folien-Weg des Einlesens: Befehlszeile, Ausgabe, Fehler.
 *
 *   npm run ingest -- --folien <pfad> [--folien <pfad> …] --name <kurzname> --titel "<Titel>" [--art folien]
 *
 * Die Arbeit macht `adapter/folien.mjs`; hier wird nur gelesen, was auf der
 * Kommandozeile steht, und berichtet, was herauskam.
 *
 * **Nie Folientext auf der Konsole.** Gemeldet werden Zahlen, Dateinamen,
 * Abschnitt-Ids und Abschnittstitel — die Titel stehen ohnehin im Lehrplan,
 * den ein Mensch lesen muss. Der Inhalt der Folien bleibt in `quellen/`, und
 * `quellen/` bleibt am Rechner.
 */
import path from 'node:path';
import { EinleseFehler, leseFolienEin } from './adapter/folien.mjs';
import { vergleichInZeilen } from './lehrplan-geruest.mjs';

const AUFRUF =
  'Aufruf: npm run ingest -- --folien <pfad> [--folien <pfad> …] --name <kurzname> --titel "<Titel>" [--art folien]\n' +
  '  <pfad> ist eine PDF-Datei oder eine Mappe (dann alle .pdf darin).\n' +
  '  Beispiel: npm run ingest -- --folien "C:/Vorlesung/1. Tag" --folien "C:/Vorlesung/2. Tag" \\\n' +
  '              --name bauch-projektmanagement --titel "Vorlesung Projektmanagement"';

/**
 * Alle Werte eines mehrfach erlaubten Arguments, in der Reihenfolge der
 * Kommandozeile.
 *
 * @param {readonly string[]} argv
 * @param {string} name
 * @returns {string[]}
 */
export function argumente(argv, name) {
  /** @type {string[]} */
  const werte = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === `--${name}` && argv[i + 1] !== undefined && !argv[i + 1].startsWith('--')) werte.push(argv[i + 1]);
  }
  return werte;
}

/** @type {(anteil: number) => string} Ein Prozentwert mit einer Nachkommastelle, deutsch geschrieben. */
const prozent = (anteil) => `${(anteil * 100).toFixed(1).replace('.', ',')} %`;

/**
 * Der Bericht eines Laufs, Zeile fuer Zeile.
 *
 * @param {import('./adapter/folien.mjs').Ergebnis} ergebnis
 * @param {string} wurzel
 * @returns {string[]}
 */
export function bericht(ergebnis, wurzel) {
  const seiten = ergebnis.originale.reduce((n, o) => n + o.seiten, 0);
  const zeilen = [
    '',
    `${ergebnis.originale.length} Originale, ${seiten} Seiten, ${ergebnis.abschnitte.length} Abschnitte.`,
  ];
  for (const o of ergebnis.originale) {
    zeilen.push(
      `  ${o.datei} — ${o.seiten} Seiten · ${o.gliederung} · Beiwerk ${prozent(o.beiwerkAnteil)} · ` +
        `${o.nurBild.length} nur Bild · ${o.tabellenverdacht.length} mit Tabelle oder Grafik`,
    );
  }
  zeilen.push('', 'Abschnitte:');
  for (const a of ergebnis.abschnitte) {
    const [von, bis] = a.seiten;
    zeilen.push(`  ${a.id} — ${a.datei}, ${von === bis ? `Folie ${von}` : `Folien ${von}\u2013${bis}`} — ${a.titel}`);
  }
  for (const warnung of ergebnis.warnungen) zeilen.push('', `Warnung: ${warnung}`);

  /** @type {(pfad: string) => string} */
  const rel = (pfad) => path.relative(wurzel, pfad).replaceAll(path.sep, '/');
  zeilen.push(
    '',
    `Stand ${ergebnis.stand}`,
    `  quellen/${ergebnis.kurzname}/ — Originale, ${ergebnis.abschnitte.length} Rohdateien, manifest.json`,
  );
  if (ergebnis.lehrplan.geschrieben) {
    zeilen.push(
      `  ${rel(ergebnis.lehrplan.pfad)} — angelegt, wartet auf Freigabe.`,
      '    geprueftVon und geprueftAm von Hand eintragen; bis dahin baut der Compiler daraus keine Lektionen.',
    );
  } else {
    zeilen.push(`  ${rel(ergebnis.lehrplan.pfad)} — liegt schon da und bleibt unverändert.`);
    const vergleich = ergebnis.lehrplan.vergleich;
    if (vergleich) for (const zeile of vergleichInZeilen(vergleich)) zeilen.push(`    ${zeile}`);
  }
  return zeilen;
}

/**
 * Liest die Kommandozeile und fuehrt den Folien-Weg aus.
 *
 * @param {readonly string[]} argv
 * @param {string} wurzel
 * @param {(zeile: string) => void} [schreibe]
 * @returns {Promise<number>} der Rueckgabewert des Prozesses
 */
export async function fuehreAus(argv, wurzel, schreibe = (zeile) => console.log(zeile)) {
  const orte = argumente(argv, 'folien');
  const kurzname = argumente(argv, 'name')[0] ?? '';
  const titel = argumente(argv, 'titel')[0] ?? '';
  const art = argumente(argv, 'art')[0];

  if (!kurzname || !titel) {
    schreibe('--name und --titel sind Pflicht.');
    schreibe(AUFRUF);
    return 2;
  }
  if (art !== undefined && art !== 'folien') {
    schreibe(`--art ${art} kennt diese Fassung nicht. Erlaubt ist nur --art folien.`);
    return 2;
  }

  try {
    const ergebnis = await leseFolienEin({
      orte,
      kurzname,
      titel,
      wurzel,
      art: art === 'folien' ? 'folien' : undefined,
      // Uebergeben, nicht im Manifest erzeugt — sonst ist jeder Lauf anders.
      gestempeltAm: new Date().toISOString(),
    });
    for (const zeile of bericht(ergebnis, wurzel)) schreibe(zeile);
    return 0;
  } catch (fehler) {
    if (!(fehler instanceof EinleseFehler)) throw fehler;
    schreibe(fehler.message);
    return 1;
  }
}
```

- [ ] **Schritt 4: `werkzeug/ingest.mjs` neu anlegen — nur die Weiche**

```js
#!/usr/bin/env node
/**
 * Einlesen — die Weiche zwischen den Wegen.
 *
 *   npm run ingest -- --git <url> --pfad <unterpfad> --name <kurzname>
 *   npm run ingest -- --folien <pfad> [--folien <pfad> …] --name <kurzname> --titel "<Titel>" [--art folien]
 *
 * Der Git-Weg ist derselbe geblieben; sein Code steht unveraendert in
 * `ingest-git.mjs`. Der Folien-Weg kam mit Teilprojekt 2b dazu. Welcher Weg
 * gemeint ist, sagt das erste Argument, das da ist — geraten wird nichts:
 * Fehlen beide, kommt die Hilfe und kein halber Lauf.
 *
 * Geladen wird der gewaehlte Weg erst dann. So zieht ein Git-Lauf pdf.js nicht
 * mit hoch, und ein Folien-Lauf klont nichts.
 */
import { argumente } from './ingest-folien.mjs';

const argv = process.argv.slice(2);
const folien = argumente(argv, 'folien');
const git = argumente(argv, 'git');

if (folien.length > 0 && git.length > 0) {
  console.error('--git und --folien zusammen geht nicht. Eine Quelle hat eine Herkunft.');
  process.exitCode = 2;
} else if (folien.length > 0) {
  const { fuehreAus } = await import('./ingest-folien.mjs');
  process.exitCode = await fuehreAus(argv, process.cwd());
} else if (git.length > 0) {
  await import('./ingest-git.mjs');
} else {
  console.error(
    'Aufruf, je nach Herkunft:\n' +
      '  npm run ingest -- --git <url> --pfad <unterpfad> --name <kurzname>\n' +
      '  npm run ingest -- --folien <pfad> [--folien <pfad> …] --name <kurzname> --titel "<Titel>" [--art folien]\n' +
      '\n' +
      '  <pfad> ist eine PDF-Datei oder eine Mappe (dann alle .pdf darin, in natürlicher Reihenfolge).\n' +
      '  Bücher und EPUB liest diese Fassung noch nicht ein.',
  );
  process.exitCode = 2;
}
```

- [ ] **Schritt 5: Das README**

In der Befehlstabelle nach der Zeile zu `npm run build` zwei Zeilen einfügen:

```markdown
| `npm run ingest -- …` | Eine Quelle einlesen — siehe „Eine Quelle einlesen" |
| `npm run fixtures` | Die Test-PDFs unter `tests/fixtures/` neu erzeugen (deterministisch) |
```

Im Block „Aufbau" vor der Zeile `docs/superpowers/plans/ …` zwei Zeilen einfügen:

```text
werkzeug/               Einlesen: ingest.mjs als Weiche, adapter/ (git, dokument, folien),
                        gliederung/folien.mjs, manifest.mjs, fixtures/erzeuge.mjs.
lehrplan/               Je Quelle ein Lehrplan — das Review-Gate.
```

Unmittelbar vor `## Auf Android testen und weiterentwickeln` einen Abschnitt einfügen:

````markdown
## Eine Quelle einlesen

Zwei Herkünfte, ein Befehl:

```bash
# ein Git-Repo
npm run ingest -- --git https://github.com/Beispiel/repo.git --pfad unterordner --name kurzname

# Foliensätze als PDF — eine Datei, mehrere Dateien oder ganze Mappen
npm run ingest -- --folien "C:/Vorlesung/1. Tag" --folien "C:/Vorlesung/2. Tag" \
  --name bauch-projektmanagement --titel "Vorlesung Projektmanagement (Prof. Bauch, WBA Weimar 2026)"
```

`--folien` darf mehrfach stehen; jeder Wert ist eine PDF-Datei oder eine Mappe
(dann alle `.pdf` darin, in natürlicher Reihenfolge). Mehrere Dateien sind
**eine** Quelle. `--name` ist der Ordner unter `quellen/` und zugleich die
`quelle` im Lehrplan; `--titel` steht auf der Karte in der Bibliothek.

Dabei entstehen:

```
quellen/<kurzname>/original/   Kopien der PDF — gitignored, wie ganz quellen/
quellen/<kurzname>/roh/<id>.md Je Abschnitt der Nutztext mit Seitenmarken (— Folie 31 —)
quellen/<kurzname>/manifest.json   Herkunftsnachweis, Fassung 3
lehrplan/<kurzname>.yaml       Das Gerüst: alle Abschnitte offen, Freigabe leer
```

**Der Lehrplan wird nie überschrieben.** Gibt es ihn schon, bleibt er stehen,
und das Einlesen meldet den Vergleich: neue, fehlende und verschobene
Abschnitte, und ob sich der Stand geändert hat. `quellen/` wird dabei neu
geschrieben — es ist abgeleitet, der Lehrplan ist es nicht.

Nach dem Einlesen trägt ein Mensch `geprueftVon` und `geprueftAm` in den
Lehrplan ein. Bis dahin zeigt `/bibliothek` die Karte mit ihren Zahlen und der
Markierung „Wartet auf Freigabe"; der Compiler baut daraus keine Lektionen.

Diese Fassung liest **Foliensätze als PDF**. Ein Hochformat mit viel Text wird
als Buch erkannt und mit einer Meldung abgewiesen (`--art folien` überstimmt
die Erkennung); EPUB kommt später. Material ohne Textebene bricht ab — OCR ist
nicht Teil des Einlesens. Auf der Konsole steht nie Folientext: nur Zahlen,
Dateinamen, Abschnitt-Ids und Abschnittstitel.
````

- [ ] **Schritt 6: Grün, und der Aufruf von Hand**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && npx vitest run tests/ingest-aufruf.test.ts 2>&1 | grep -E "Tests  |Duration" && npm test 2>&1 | grep -E "Tests |Test Files |FAIL" && npm run check 2>&1 | grep -E "^- [0-9]+ (error|warning|hint)" && node werkzeug/ingest.mjs; echo "exit=$?"
```
Erwartet: `Tests  10 passed (10)`, Dauer rund 1,9 s · **BASIS + 150** in 51 Testdateien · `- 0 errors`, `- 0 warnings`, `- 0 hints` · dann die Hilfe und `exit=2`:

```text
Aufruf, je nach Herkunft:
  npm run ingest -- --git <url> --pfad <unterpfad> --name <kurzname>
  npm run ingest -- --folien <pfad> [--folien <pfad> …] --name <kurzname> --titel "<Titel>" [--art folien]

  <pfad> ist eine PDF-Datei oder eine Mappe (dann alle .pdf darin, in natürlicher Reihenfolge).
  Bücher und EPUB liest diese Fassung noch nicht ein.
```

- [ ] **Schritt 7: Mutationsproben**

**Probe A** — in `argumente` die Bedingung `&& !argv[i + 1].startsWith('--')` streichen.
Vorhersage: 1 roter Test („uebergeht ein Argument ohne Wert"). Gemessen: 1.

**Probe B** — die Prüfung von `--art` abschalten (`if (false)`).
Vorhersage: 1 roter Test („kennt nur --art folien"). Gemessen: 1.

**Probe C** — in `fuehreAus` im `catch` immer `throw fehler;`.
Vorhersage: 1 roter Test („meldet einen Abbruch als Zeile, nicht als Stapelabzug"). Gemessen: 1.

**Probe D** — in `ingest.mjs` die erste Bedingung durch `if (false)` ersetzen.
Vorhersage: 1 roter Test („weist --git und --folien zusammen zurueck"). Gemessen: 1.

- [ ] **Schritt 8: NUL-Prüfung und Commit**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && python -c "import sys; print('NUL:', sum(open(f,'rb').read().count(b'\x00') for f in sys.argv[1:]))" werkzeug/ingest.mjs werkzeug/ingest-folien.mjs werkzeug/ingest-git.mjs tests/ingest-aufruf.test.ts README.md && git add werkzeug/ingest.mjs werkzeug/ingest-folien.mjs werkzeug/ingest-git.mjs tests/ingest-aufruf.test.ts README.md && git commit -F - <<'MSG'
feat: npm run ingest liest auch Foliensaetze ein

ingest.mjs ist jetzt die Weiche zwischen zwei Wegen. Der Git-Weg ist
unveraendert nach ingest-git.mjs gezogen; der Befehl dafuer bleibt derselbe.
Geladen wird der gewaehlte Weg erst, wenn er gewaehlt ist - ein Git-Lauf zieht
pdf.js nicht mit hoch.

--folien darf mehrfach stehen, jeder Wert ist eine Datei oder eine Mappe.
Mehrere Dateien sind eine Quelle. Auf der Konsole stehen Zahlen, Dateinamen,
Abschnitt-Ids und Abschnittstitel - kein Folientext; ein Test haelt das fest.

README: der neue Aufruf, was dabei entsteht und dass der Lehrplan nie
ueberschrieben wird.

<CO-AUTHORED-BY>
MSG
git diff --stat HEAD~1
```
Erwartet: `NUL: 0` · `5 files changed, 658 insertions(+), 233 deletions(-)` — die 233 gelöschten Zeilen sind der Git-Weg, der aus `ingest.mjs` verschwindet und in `ingest-git.mjs` wieder auftaucht.

---

## Aufgabe 10: Die Gestaltung der Markierung

**Dateien:**
- Ändern: `src/styles/global.css` (nur anhängen)

Die Markierung spricht dieselbe Sprache wie der Vorbehalt in der Lektion: Lesegröße, Textfarbe, Randstreifen in `--akzent-fill`. Kein neues Farbtoken — und **kein eigener Hintergrund**: Die Karte trägt schon `--flaeche`, ein zweiter wäre unsichtbar.

Die Markierung ist kein Bedienelement. Sie braucht keine 44 Pixel, und sie steht unter der Kopfzeile und über den Zahlen, weil sie die Zahlen einordnet und nicht ersetzt.

- [ ] **Schritt 1: Den Block ans Ende von `src/styles/global.css` anhängen**

```css
/* ---------------------------------------------------------------
   Bibliothek: die Markierung „Wartet auf Freigabe" (Teilprojekt 2b-1)

   Dieselbe Sprache wie der Vorbehalt in der Lektion: Lesegroesse,
   Textfarbe, Randstreifen in --akzent-fill. Kein neues Farbtoken,
   und kein eigener Hintergrund — die Karte traegt schon --flaeche,
   ein zweiter waere unsichtbar.

   Die Markierung ist kein Bedienelement: kein Mindestmass, keine
   44 Pixel. Sie steht unter der Kopfzeile und ueber den Zahlen,
   weil sie die Zahlen einordnet und nicht ersetzt.
   --------------------------------------------------------------- */
.quelle-freigabe {
  margin: 0 0 12px;
  padding-left: 10px;
  border-left: 3px solid var(--akzent-fill);
  font-size: 15.5px;
  line-height: 1.5;
  color: var(--ink);
  text-wrap: pretty;
  overflow-wrap: anywhere;
}
```

- [ ] **Schritt 2: Bauen und nachsehen**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && npm run build 2>&1 | grep -E "page\(s\)" && grep -rl "quelle-freigabe" dist/ && npm test 2>&1 | grep -E "Tests |Test Files |FAIL" && npm run check 2>&1 | grep -E "^- [0-9]+ (error|warning|hint)"
```
Erwartet: **SEITEN** `page(s) built` · eine CSS-Datei unter `dist/astro/` nennt `.quelle-freigabe` (im Probelauf `dist/astro/Seite.Dr_iOS9I.css`; der Name enthält einen Hash und ändert sich) · **BASIS + 150** · `- 0 errors`, `- 0 warnings`, `- 0 hints`.

Diese Aufgabe bringt keine Tests; ihr Nachweis ist die Abnahme in Aufgabe 12. Die dort gemessenen Werte: Schriftgröße 15,5 px, hell `rgb(20, 25, 27)` auf weißer Karte, dunkel `rgb(232, 235, 231)` auf `rgb(22, 27, 30)`, Randstreifen links in beiden Fällen `rgb(232, 163, 60) 3px`, kein eigener Hintergrund (`rgba(0, 0, 0, 0)`).

- [ ] **Schritt 3: NUL-Prüfung und Commit**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && python -c "import sys; print('NUL:', sum(open(f,'rb').read().count(b'\x00') for f in sys.argv[1:]))" src/styles/global.css && git add src/styles/global.css && git commit -F - <<'MSG'
style: Bibliothek - die Markierung "Wartet auf Freigabe"

Dieselbe Sprache wie der Vorbehalt in der Lektion: Lesegroesse, Textfarbe,
Randstreifen in --akzent-fill. Kein neues Farbtoken und kein eigener
Hintergrund - die Karte traegt schon --flaeche.

<CO-AUTHORED-BY>
MSG
git diff --stat HEAD~1
```
Erwartet: `NUL: 0` · `1 file changed, 24 insertions(+)`.

---

## Aufgabe 11: Ende zu Ende am echten Material

**Dateien:**
- Neu: `lehrplan/bauch-projektmanagement.yaml` (vom Einlesen erzeugt, wird committet)
- Ändern: `tests/abdeckung.test.ts` („der heutige Bestand")

Neun Foliensätze einer Projektmanagement-Vorlesung, 199 Seiten in zwei Mappen. **Der Materialordner wird nur gelesen.** Was entsteht, landet unter `quellen/` (gitignored) und in einem Lehrplan, der nur Titel, Dateinamen und Folienbereiche trägt — keinen Folientext.

Hat Aufgabe 0 den Materialordner nicht gefunden: hier anhalten und melden. Alles davor ist fertig und grün; diese Aufgabe braucht das Material.

- [ ] **Schritt 1: Einlesen**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && M="C:/Users/dno/Documents/02_UNI/02_Weimar/3. Semester BPS_BVM_BIM/BPS/Vorlesungen/Lehrunterlagen Prof. Bauch-20260721" && npm run ingest -- --folien "$M/1.Tag 27.6.26" --folien "$M/2. Tag 25.07.2026" --name bauch-projektmanagement --titel "Vorlesung Projektmanagement (Prof. Bauch, WBA Weimar 2026)"
```

Erwartet, wörtlich (Laufzeit rund 19 s, **keine einzige Meldung von pdf.js**):

```text
9 Originale, 199 Seiten, 22 Abschnitte.
  M1 PM und Leistungsbilder 26.pdf — 23 Seiten · titellaeufe · Beiwerk 26,3 % · 0 nur Bild · 0 mit Tabelle oder Grafik
  M2 PM Beispiele Leistungsbilder 26.pdf — 29 Seiten · agenda · Beiwerk 57,2 % · 9 nur Bild · 1 mit Tabelle oder Grafik
  M3 PM Stakeholderanalyse 26.pdf — 20 Seiten · einzeln · Beiwerk 42,8 % · 1 nur Bild · 1 mit Tabelle oder Grafik
  M4 PM PSP 26.pdf — 45 Seiten · titellaeufe · Beiwerk 33,6 % · 0 nur Bild · 15 mit Tabelle oder Grafik
  M5 PM Kommunikation 26.pdf — 31 Seiten · titellaeufe · Beiwerk 43,8 % · 3 nur Bild · 2 mit Tabelle oder Grafik
  M6  Kostenschätzung Sportcenter 26.pdf — 1 Seiten · einzeln · Beiwerk 0,0 % · 0 nur Bild · 1 mit Tabelle oder Grafik
  M7 Risikomanagement 26.pdf — 35 Seiten · agenda · Beiwerk 33,9 % · 7 nur Bild · 3 mit Tabelle oder Grafik
  M9 Leistungsstandsmessung 26.pdf — 13 Seiten · einzeln · Beiwerk 33,0 % · 1 nur Bild · 2 mit Tabelle oder Grafik
  M10 Steuerungsmöglichkeiten 26.pdf — 2 Seiten · einzeln · Beiwerk 19,0 % · 0 nur Bild · 1 mit Tabelle oder Grafik
```

danach 22 Abschnittszeilen — die Ids und Bereiche wörtlich:

```text
  m01-01-folien-1-14                      Folien 1–14
  m01-02-ergaenzende-pm-leistungen-gem    Folien 15–18
  m01-03-leistungen-building-information  Folien 19–23
  m02-01-fallbeispiel-1-massnahmen        Folien 1–7
  m02-02-fallbeispiel-2                   Folien 8–19
  m02-03-fallbeispiel-3-beurteilung       Folien 20–26
  m02-04-fallbeispiel-4-claims            Folien 27–29
  m03-01-folien-1-20                      Folien 1–20
  m04-01-folien-1-5                       Folien 1–5
  m04-02-grundlagen-grundsaetze           Folien 6–9
  m04-03-beispiel-fuer-typ                Folien 10–24
  m04-04-aufbauorganisation               Folien 25–34
  m04-05-hilfsmittel                      Folien 35–45
  m05-01-folien-1-19                      Folien 1–19
  m05-02-projektkommunikation             Folien 20–24
  m05-03-wie-organisieren                 Folien 25–31
  m06-01-folien-1-1                       Folie 1
  m07-01-begriffsbestimmungen             Folien 1–5
  m07-02-prozess-des-risikomanagements    Folien 6–26
  m07-03-risikomanagement                 Folien 27–35
  m09-01-folien-1-13                      Folien 1–13
  m10-01-folien-1-2                       Folien 1–2
```

und zum Schluss:

```text
Stand sha256:f99ba9465fd7f116b002a752e774b80ce205e1b741740e0e8c43e1abf6b4af38
  quellen/bauch-projektmanagement/ — Originale, 22 Rohdateien, manifest.json
  lehrplan/bauch-projektmanagement.yaml — angelegt, wartet auf Freigabe.
    geprueftVon und geprueftAm von Hand eintragen; bis dahin baut der Compiler daraus keine Lektionen.
```

**Der Stand ist der harte Prüfstein.** Er hängt nur an den Bytes der neun PDF und am Verfahren aus Aufgabe 7. Weicht er ab, ist entweder das Material ein anderes oder `standAusHashes` rechnet anders: anhalten und melden.

Weicht eine der Zahlen ab, nicht aber der Stand: weitermachen und **im Bericht nennen**. Die Zahlen für `nurBild` und `mit Tabelle oder Grafik` hängen an den Regeln aus Aufgabe 5; sie stehen in keinem Test, nur hier und im Manifest.

- [ ] **Schritt 2: Nachsehen, was entstanden ist**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && node -e "
const m = JSON.parse(require('fs').readFileSync('quellen/bauch-projektmanagement/manifest.json','utf8'));
console.log('fassung', m.fassung, JSON.stringify(m.summe));
console.log('gliederung', m.originale.map((o) => o.gliederung).join(' '));
" && ls quellen/bauch-projektmanagement/roh | wc -l && ls quellen/bauch-projektmanagement/original | wc -l && git status --short
```
Erwartet:

```text
fassung 3 {"originale":9,"seiten":199,"abschnitte":22,"nurBild":21,"tabellenverdacht":26,"beiwerkZeichen":39311}
gliederung titellaeufe agenda einzeln titellaeufe titellaeufe einzeln agenda einzeln einzeln
22
9
?? lehrplan/bauch-projektmanagement.yaml
```

`git status` nennt **nur** den Lehrplan: `quellen/` ist gitignored. Steht dort mehr, anhalten und melden.

- [ ] **Schritt 3: Zweiter Lauf — der Lehrplan bleibt**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && md5sum lehrplan/bauch-projektmanagement.yaml > /tmp/lp.md5 && M="C:/Users/dno/Documents/02_UNI/02_Weimar/3. Semester BPS_BVM_BIM/BPS/Vorlesungen/Lehrunterlagen Prof. Bauch-20260721" && npm run ingest -- --folien "$M/1.Tag 27.6.26" --folien "$M/2. Tag 25.07.2026" --name bauch-projektmanagement --titel "Vorlesung Projektmanagement (Prof. Bauch, WBA Weimar 2026)" 2>&1 | tail -4 && md5sum -c /tmp/lp.md5
```
Erwartet:

```text
Stand sha256:f99ba9465fd7f116b002a752e774b80ce205e1b741740e0e8c43e1abf6b4af38
  quellen/bauch-projektmanagement/ — Originale, 22 Rohdateien, manifest.json
  lehrplan/bauch-projektmanagement.yaml — liegt schon da und bleibt unverändert.
    keine Änderung
lehrplan/bauch-projektmanagement.yaml: OK
```

- [ ] **Schritt 4: „Der heutige Bestand" nachziehen**

Der Bestand hat jetzt zwei Lehrpläne. In `tests/abdeckung.test.ts` den Kommentar über „stimmt mit dem ueberein, was gemessen wurde" ersetzen durch:

```ts
  /**
   * Haelt fest, was gemessen wurde: zwei Lehrplaene — das Repo mit sechs
   * Prinzipien, drei davon mit Lektion, und die eingelesene Vorlesung mit
   * zweiundzwanzig offenen Abschnitten, die auf die Freigabe wartet. Dazu
   * zwei Lektionen ohne Lehrplaneintrag. Aendert sich der Bestand — eine
   * neue Lektion, ein neuer Lehrplan —, wird dieser Test nachgezogen, und
   * der Commit sagt warum.
   *
   * Ohne Manifeste: `quellen/` ist gitignored, und dieser Test laeuft auch
   * dort, wo nicht eingelesen wurde. Was das Manifest beitraegt, prueft die
   * Abnahme am gebauten Stand.
   */
```

und den Rumpf ab `const { gueltig, wartend, ungueltig } =` durch:

```ts
    const { gueltig, wartend, ungueltig } = lehrplaeneAusTexten(texte, lektionen);
    expect(ungueltig).toEqual([]);
    expect(gueltig.map((l) => l.quelle)).toEqual(['awesome-llm-apps']);
    expect(wartend.map((l) => l.quelle)).toEqual(['bauch-projektmanagement']);

    const { bestand, ohneLehrplan } = abdeckung([...gueltig, ...wartend], KEINE_MANIFESTE, lektionen);
    expect(bestand.map((b) => [b.quelle, b.art, b.freigabe])).toEqual([
      ['awesome-llm-apps', 'repo', 'erteilt'],
      ['bauch-projektmanagement', 'folien', 'wartet'],
    ]);
    expect(bestand[0]?.zaehlung).toEqual({ gesamt: 6, mitLektion: 3, offen: 3, beauftragt: 0, abgelehnt: 0 });
    expect(bestand[0]?.zeilen.filter((z) => z.status === 'lektion').map((z) => z.id)).toEqual([
      'kein-boden-ist-ein-boden',
      'kontrollfluss-folgt-modellstaerke',
      'auslagern-nimmt-die-grundlage',
    ]);
    // Neun Originale, 22 Abschnitte, alle offen: der Zustand gleich nach dem
    // Einlesen. Die Lektion `pauschal-heisst-nicht-komplett` bekommt ihren
    // Eintrag erst vom Compiler (2c) — bis dahin steht sie unter „ohne
    // Lehrplaneintrag", mit Absicht.
    expect(bestand[1]?.zaehlung).toEqual({ gesamt: 22, mitLektion: 0, offen: 22, beauftragt: 0, abgelehnt: 0 });
    expect(new Set(bestand[1]?.zeilen.map((z) => z.datei)).size).toBe(9);
    expect(ohneLehrplan).toEqual(['pauschal-heisst-nicht-komplett', 'recall-vor-precision']);
  });
```

- [ ] **Schritt 5: Bauen und die Karte ansehen**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && npm test 2>&1 | grep -E "Tests |Test Files |FAIL" && npm run check 2>&1 | grep -E "^- [0-9]+ (error|warning|hint)" && npm run build 2>&1 | grep -E "page\(s\)" && grep -o '<h2>[^<]*</h2>' dist/bibliothek/index.html && grep -o '<p class="quelle-kopf">[^<]*</p>' dist/bibliothek/index.html && grep -o '<p class="quelle-zahlen">[^<]*</p>' dist/bibliothek/index.html && grep -o '<p class="quelle-luecken"><strong>Lücken:</strong> [^<]*</p>' dist/bibliothek/index.html && grep -c 'quelle-freigabe' dist/bibliothek/index.html
```
Erwartet: **BASIS + 150** · `0/0/0` · **SEITEN** `page(s) built` · zwei Karten:

```text
<h2>awesome-llm-apps</h2>
<h2>Vorlesung Projektmanagement (Prof. Bauch, WBA Weimar 2026)</h2>
<h2>Lektionen ohne Lehrplaneintrag</h2>
<p class="quelle-kopf">Repo · Stand a13701e</p>
<p class="quelle-kopf">Folien · Stand sha256:f99ba94</p>
<p class="quelle-zahlen">6 Prinzipien · 3 mit Lektion · 3 offen</p>
<p class="quelle-zahlen">22 Abschnitte · 0 mit Lektion · 22 offen</p>
<p class="quelle-luecken"><strong>Lücken:</strong> 44 von 106 Dateien nicht übernommen</p>
<p class="quelle-luecken"><strong>Lücken:</strong> 21 von 199 Folien nur Bild · 26 Folien mit Tabelle oder Grafik</p>
1
```

Hat Aufgabe 0 `MANIFEST: fehlt` notiert, steht in der ersten Lückenzeile stattdessen „unbekannt — das Manifest liegt nur am Rechner, auf dem eingelesen wurde" (so war es im Probelauf).

- [ ] **Schritt 6: NUL-Prüfung und Commit**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && python -c "import sys; print('NUL:', sum(open(f,'rb').read().count(b'\x00') for f in sys.argv[1:]))" lehrplan/bauch-projektmanagement.yaml tests/abdeckung.test.ts && grep -c . lehrplan/bauch-projektmanagement.yaml && git add lehrplan/bauch-projektmanagement.yaml tests/abdeckung.test.ts && git commit -F - <<'MSG'
feat: Lehrplan-Geruest fuer die Vorlesung Projektmanagement, eingelesen

Neun Foliensaetze, 199 Seiten, 22 Abschnitte, Stand
sha256:f99ba9465fd7f116b002a752e774b80ce205e1b741740e0e8c43e1abf6b4af38.

Die Datei traegt nur Abschnittstitel, Dateinamen und Folienbereiche - kein
Folientext. Die Originale und die Rohdateien liegen unter quellen/ und bleiben
am Rechner.

geprueftVon und geprueftAm sind leer: Die Bibliothek zeigt die Zahlen mit der
Markierung "Wartet auf Freigabe", der Compiler baut daraus noch nichts.

<CO-AUTHORED-BY>
MSG
git diff --stat HEAD~1
```
Erwartet: `NUL: 0` · `120` Zeilen im Lehrplan · `2 files changed, 139 insertions(+), 7 deletions(-)`.

---

## Aufgabe 12: Abnahme am gebauten Stand

**Dateien:** keine Quelldateien. Behebt die Abnahme einen Fehler, bekommt die Behebung einen eigenen Commit mit Messwert vorher und nachher.

Jeder Schnipsel unten ist in eine `await (async () => { … })()`-Klammer gefasst und gibt sein Ergebnis zurück — so stoßen sich die Namen mehrerer Schnipsel auf derselben Seite nicht. Die Werte in Pixeln stammen aus dem Probelauf; es zählt `zu klein: 0` und `ueberlauf: 0`, nicht das letzte Pixel.

- [ ] **Schritt 1: Die drei Schranken, die NUL-Prüfung, kein Rohtext**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && npm test 2>&1 | grep -E "Tests |Test Files |FAIL" && npm run check 2>&1 | grep -E "^- [0-9]+ (error|warning|hint)" && npm run build 2>&1 | grep -E "page\(s\)" && python -c "
import subprocess
d = [f for f in subprocess.run(['git','diff','--name-only','master...HEAD'],capture_output=True,text=True).stdout.split('\n') if f and not f.endswith('.pdf')]
print('NUL-Bytes:', sum(open(f,'rb').read().count(b'\x00') for f in d), 'in', len(d), 'Textdateien')
" && (grep -rlE 'warumNichtOffensichtlich|"rubrik"|sha256:[0-9a-f]{64}' dist/ || echo "kein Rohtext im Bau") && grep -c 'geprueftVon' dist/bibliothek/index.html && grep -o '.\{0,20\}geprueftVon.\{0,20\}' dist/bibliothek/index.html
```
Erwartet: **BASIS + 150** in 51 Testdateien · `- 0 errors`, `- 0 warnings`, `- 0 hints` · **SEITEN** `page(s) built` · `NUL-Bytes: 0 in 34 Textdateien` · `kein Rohtext im Bau` · `1` und genau eine Fundstelle: `…Freigabe:</strong> Erst wenn geprueftVon und geprueftAm ein…`.

Das Wort `geprueftVon` steht seit Aufgabe 2 **mit Absicht** im HTML — es ist Teil des Satzes, der sagt, was fehlt. Deshalb ist es aus der Rohtextprüfung herausgenommen und wird eigens gezählt. Steht die Zahl über 1 oder zeigt die Fundstelle etwas anderes: anhalten und melden.

- [ ] **Schritt 2: Den gebauten Stand ausliefern**

Die Vorschau `kernbohrung-bau` (Port 4322) neu starten, damit sie den frischen Bau ausliefert: `preview_list` → laufenden Eintrag mit `preview_stop` beenden → `preview_start` mit `name: "kernbohrung-bau"`. Dann `resize_window` mit `preset: "mobile"` (375 × 812).

- [ ] **Schritt 3: `/bibliothek/` bei 375 px — Wortlaute, Flächen, Markierung**

`http://localhost:4322/bibliothek/` öffnen, dann:

```js
await (async () => {
  await new Promise((r) => setTimeout(r, 1000));
  const mass = (auswahl) => {
    const m = [...document.querySelectorAll(auswahl)].map((e) => e.getBoundingClientRect());
    if (!m.length) return 'keine im Bild';
    return `${m.length} Stück, kleinste ${Math.round(Math.min(...m.map((x) => x.width)))}x${Math.round(Math.min(...m.map((x) => x.height)))}, zu klein: ${m.filter((x) => x.width < 44 || x.height < 44).length}`;
  };
  const karten = [...document.querySelectorAll('.quelle')];
  const zweite = karten[1];
  const knopf = zweite.querySelector('.quelle-liste > summary');
  const kr = knopf.getBoundingClientRect();
  const f = zweite.querySelector('.quelle-freigabe');
  return {
    karten: karten.map((k) => k.dataset.quelle),
    kopf: zweite.querySelector('.quelle-kopf').textContent,
    freigabe: f.textContent,
    freigabeMass: `${Math.round(f.getBoundingClientRect().width)}x${Math.round(f.getBoundingClientRect().height)}`,
    zahlen: zweite.querySelector('.quelle-zahlen').textContent,
    luecken: zweite.querySelector('.quelle-luecken').textContent,
    knopf: `${Math.round(kr.width)}x${Math.round(kr.height)}`,
    knopfInTabFolge: knopf.tabIndex === 0,
    offenVorher: zweite.querySelector('.quelle-liste').open,
    summaries: mass('.quelle-liste > summary'),
    ueberlauf: document.documentElement.scrollWidth - innerWidth,
  };
})();
```
Erwartet:

- `karten: ['awesome-llm-apps', 'bauch-projektmanagement']`
- `kopf: 'Folien · Stand sha256:f99ba94'`
- `freigabe: 'Wartet auf Freigabe: Erst wenn geprueftVon und geprueftAm eingetragen sind, baut der Compiler daraus Lektionen.'`, `freigabeMass: '281x93'`
- `zahlen: '22 Abschnitte · 0 mit Lektion · 22 offen'`
- `luecken: 'Lücken: 21 von 199 Folien nur Bild · 26 Folien mit Tabelle oder Grafik'`
- `knopf: '281x103'` (der lange Titel bricht um; über der Mindesthöhe 48), `knopfInTabFolge: true`, `offenVorher: false`
- `summaries: '2 Stück, kleinste 281x77, zu klein: 0'`
- `ueberlauf: 0`

- [ ] **Schritt 4: Aufklappen — 22 Zeilen, lange Dateinamen, kein Überlauf**

Auf derselben Seite:

```js
await (async () => {
  const d = [...document.querySelectorAll('.quelle-liste')][1];
  d.querySelector('summary').click();
  await new Promise((r) => setTimeout(r, 300));
  const zeilen = [...d.querySelectorAll('.zeile')];
  const breiteste = (a) => {
    const e = [...document.querySelectorAll(a)];
    if (!e.length) return 'keine';
    const m = e.map((x) => ({ w: Math.round(x.scrollWidth), v: Math.round(x.clientWidth) })).sort((p, q) => q.w - p.w)[0];
    return `${m.w} in ${m.v}`;
  };
  return {
    offen: d.open,
    zeilenZahl: zeilen.length,
    statusWerte: [...new Set(zeilen.map((z) => z.dataset.status))],
    ersteZeile: {
      titel: zeilen[0].querySelector('.zeile-titel').textContent,
      fundstelle: zeilen[0].querySelector('.zeile-fundstelle').textContent,
      status: zeilen[0].querySelector('.zeile-status').textContent.trim(),
    },
    breitesteFundstelle: breiteste('.zeile-fundstelle'),
    breitesterTitel: breiteste('.zeile-titel'),
    ueberlaufOffen: document.documentElement.scrollWidth - innerWidth,
  };
})();
```
Erwartet: `offen: true` · `zeilenZahl: 22` · `statusWerte: ['offen']` · `ersteZeile: { titel: 'M1 PM und Leistungsbilder 26, Folien 1–14', fundstelle: 'M1 PM und Leistungsbilder 26.pdf, Folien 1–14', status: 'offen' }` · `breitesteFundstelle: '259 in 259'` und `breitesterTitel: '259 in 259'` — der Inhalt passt in die Zeile, `overflow-wrap: anywhere` greift · `ueberlaufOffen: 0`.

- [ ] **Schritt 5: Dunkler Modus der Markierung**

```js
await (async () => {
  const farbe = (a, e) => { const x = document.querySelector(a); return x ? getComputedStyle(x)[e] : 'nicht im Bild'; };
  const stil = () => ({
    schrift: farbe('.quelle-freigabe', 'fontSize'),
    farbe: farbe('.quelle-freigabe', 'color'),
    flaeche: farbe('.quelle-freigabe', 'backgroundColor'),
    randLinks: `${farbe('.quelle-freigabe', 'borderLeftColor')} ${farbe('.quelle-freigabe', 'borderLeftWidth')}`,
    karte: farbe('.quelle', 'backgroundColor'),
  });
  const hell = stil();
  document.documentElement.setAttribute('data-theme', 'dark');
  await new Promise((r) => setTimeout(r, 150));
  const dunkel = stil();
  document.documentElement.removeAttribute('data-theme');
  return { hell, dunkel };
})();
```
Erwartet:
- `hell: { schrift: '15.5px', farbe: 'rgb(20, 25, 27)', flaeche: 'rgba(0, 0, 0, 0)', randLinks: 'rgb(232, 163, 60) 3px', karte: 'rgb(255, 255, 255)' }`
- `dunkel: { schrift: '15.5px', farbe: 'rgb(232, 235, 231)', flaeche: 'rgba(0, 0, 0, 0)', randLinks: 'rgb(232, 163, 60) 3px', karte: 'rgb(22, 27, 30)' }`

Ein heller Wert im dunklen Modus hieße: Eine Regel hängt an einer festen Farbe statt an einem Token. `flaeche` ist in beiden Fällen durchsichtig — das ist Absicht (Aufgabe 10).

- [ ] **Schritt 6: Der Weg von der Übersicht**

`http://localhost:4322/` öffnen:

```js
await (async () => {
  await new Promise((r) => setTimeout(r, 800));
  const v = [...document.querySelectorAll('.profil-verweis a')];
  return {
    text: document.querySelector('.profil-verweis').textContent,
    verweise: v.map((a) => { const r = a.getBoundingClientRect(); return `${a.textContent} ${Math.round(r.width)}x${Math.round(r.height)}`; }),
    leiste: Math.round(document.querySelector('.leiste').getBoundingClientRect().height),
    ueberlauf: document.documentElement.scrollWidth - innerWidth,
  };
})();
```
Erwartet: `text: 'Dein Lernprofil · Bibliothek'` · `verweise: ['Dein Lernprofil 98x44', 'Bibliothek 66x44']` · `leiste: 109` · `ueberlauf: 0`. Danach `resize_window` mit `preset: "desktop"`.

- [ ] **Schritt 7: Der Bau ohne Manifest — so baut GitHub**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && Q=quellen/bauch-projektmanagement && cp $Q/manifest.json $Q/manifest.sicherung && mv $Q/manifest.json $Q/manifest.weg && npm run build 2>&1 | grep -E "page\(s\)|error"; mv $Q/manifest.weg $Q/manifest.json && cmp $Q/manifest.json $Q/manifest.sicherung && rm $Q/manifest.sicherung && echo "Manifest unveraendert zurueck" && grep -o '<p class="quelle-luecken"><strong>Lücken:</strong> [^<]*</p>' dist/bibliothek/index.html && grep -c 'quelle-freigabe' dist/bibliothek/index.html
```
Erwartet: **SEITEN** `page(s) built` · `Manifest unveraendert zurueck` · die zweite Lückenzeile lautet jetzt „unbekannt — das Manifest liegt nur am Rechner, auf dem eingelesen wurde" · `1` — die Markierung bleibt, sie hängt am Lehrplan und nicht am Manifest.

Das Semikolon hinter dem Bau ist Absicht: Auch wenn der Bau scheitert, kommt das Manifest zurück. Kommt `Manifest unveraendert zurueck` **nicht**, liegt die Sicherung als `manifest.sicherung` daneben — anhalten und melden, nichts von Hand „reparieren".

- [ ] **Schritt 8: Die Freigabe eintragen — die Markierung verschwindet**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && sed -i 's/^geprueftVon: ""/geprueftVon: "Daniel Nobs"/; s/^geprueftAm: ""/geprueftAm: "2026-09-23"/' lehrplan/bauch-projektmanagement.yaml && npm run build 2>&1 | grep -E "page\(s\)|error"; (grep -c 'quelle-freigabe' dist/bibliothek/index.html || true); grep -o '<p class="quelle-luecken"><strong>Lücken:</strong> [^<]*</p>' dist/bibliothek/index.html; git checkout -- lehrplan/bauch-projektmanagement.yaml && git status --short lehrplan/ && echo "Lehrplan zurueck" && npm run build 2>&1 | grep -E "page\(s\)"
```
Erwartet: **SEITEN** `page(s) built` · `0` — keine Markierung mehr · beide Lückenzeilen unverändert (`44 von 106 Dateien nicht übernommen` und `21 von 199 Folien nur Bild · 26 Folien mit Tabelle oder Grafik`) · keine Zeile von `git status` · `Lehrplan zurueck` · **SEITEN** `page(s) built`. Das ist der Zustand, in den der Nutzer die Quelle von Hand überführt, bevor der Compiler (2c) sie anfasst.

- [ ] **Schritt 9: Die ortsunabhängige Kopie**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && rm -rf handy && cp -r dist handy && node werkzeug/relative-verweise.mjs handy && grep -o '<a href="[^"]*">Bibliothek</a>' handy/index.html && grep -o '<a href="[^"]*">Zur Übersicht</a>' handy/bibliothek/index.html && grep -o '<p class="quelle-freigabe">.\{0,40\}' handy/bibliothek/index.html && du -sh handy
```
Erwartet: `9 HTML-Dateien, 116 Verweise relativiert.` und `Kein wurzelbezogener Verweis mehr uebrig.` · `<a href="./bibliothek/index.html">Bibliothek</a>` · `<a href="../index.html">Zur Übersicht</a>` · die Markierung steht auch dort · rund `611K`. `handy/` steht in `.gitignore`. **Das Artifact aktualisiert die Hauptsitzung, kein Subagent; es bleibt privat** — es enthält jetzt Abschnittstitel aus fremdem Lehrmaterial.

- [ ] **Schritt 10: Übergabe**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && git status --short && git log --oneline master..bibliothek-2b1 | cat
```
Erwartet: sauberer Baum (`quellen/`, `handy/` und `dist/` sind gitignored) und elf Commits, einer je Aufgabe 1 bis 11, dazu je Behebung aus der Abnahme einer. Das Zusammenführen entscheidet der Nutzer — dafür `superpowers:finishing-a-development-branch`.

---

## Selbstprüfung gegen den Spec

Nur der Umfang von 2b-1: Foliensätze im Terminal einlesen, bis der Bestand sie zeigt.

| Spec (2b, Folienteil) | Aufgabe |
|---|---|
| `werkzeug/adapter/dokument.mjs`: Datei → Seiten, Text je Seite, Seitenformat | 4 (+ Proben B, C) |
| Kopf- und Fußzeilen über Wiederkehr, Ziffern normalisiert; `beiwerkZeichen` je Datei | 5 (+ Proben A, B, C), 7 (Manifest), Präzisierungen 1–3 |
| Warnung über 60 % entferntem Text | 5 (`BEIWERK_WARNUNG`), 9 (`bericht`, Test „nennt eine Warnung … eigens") |
| „Keine Textebene" bricht ab, wenig Text nicht | 5 (+ Probe B), 8 (+ Test „bricht bei einem Satz ohne Textebene ab") |
| Bildseiten einzeln, mit Seitenzahl | 5 (+ Probe D), 7 (Manifest `nurBild: [n]`), Präzisierungen 4, 5 |
| Tabellenverdacht einzeln, mit Warnzeile in der Rohdatei | 5 (+ Probe E), 8 (`WARNZEILE`, + Probe A), Präzisierungen 6, 7 |
| Silbentrennung am Zeilenende zusammenziehen | 5 (vier Tests, darunter der Ergänzungsstrich) |
| Art erkennen (Querformat und Median), umstellbar | 5 (`artDerQuelle`), 8 (`--art folien`, + Probe C), Präzisierung 8 |
| `gliederung/folien.mjs`: eine Datei = mindestens ein Abschnitt | 6 |
| bis 20 Folien ein Abschnitt; Agenda → Titelläufe → gleichmäßig zu 15 | 6 (+ Proben A, B, E), Präzisierungen 10–13 |
| Abschnitts-Id aus Dateiname und laufender Nummer; Titel aus Agenda oder Titellauf, sonst Rückfall | 6 (+ Probe D), Präzisierung 14 |
| Ausgabe `quellen/<kurzname>/roh/<id>.md` mit Kopfzeile und Seitenmarken | 8 (+ Probe A) |
| Originale unter `quellen/<kurzname>/original/` | 8 |
| Manifest Fassung 3: `herkunft.art`, `originale[]`, `gliederung`, `beiwerkZeichen`, je Rohdatei `seiten`, `nurBild`, `tabellenverdacht` | 7 (+ Proben C, D), 8 |
| Stand = Hash über die sortierten Datei-Hashes | 7 (+ Proben A, B), 11 (`sha256:f99ba946…`), Präzisierung 15 |
| Bibliotheken: reines JavaScript, permissive Lizenz, Position und Schriftgröße je Element, Seitenformat, Bildobjekte; Versionsstände gemessen | 3, 4, Präzisierung 21 des Vorspanns |
| Fixtures unter `tests/fixtures/`, erzeugt von einem Skript unter `werkzeug/fixtures/` | 3 (+ Proben A, B) |
| Foliensatz-PDF mit Briefkopf, Agendafolie, Titelläufen, Bildfolie, Tabellenfolie; ein Satz ohne Agenda und ohne Titelläufe | 3, 6 (Fixture-Tests) |
| Tests prüfen Grenzen, Seitenbereiche, Titel, `gliederung`-Wert | 6 |
| Urheberrecht: `quellen/` bleibt gitignored, nichts verlässt den Rechner | 8, 9 (Test „berichtet … und keinen Folientext"), 11 (Schritt 2), 12 (Schritte 1, 9) |
| Ende zu Ende: die neun Foliensätze, kein Abbruch als Scan, Briefkopf entfernt und ausgewiesen, M7 mehrere Abschnitte, M10 und M6 je einer | 11 |
| Der Lehrplan bekommt `art: folien`, `quelle`, `titel`, `stand`, Abschnitte mit `id`, `titel`, `datei`, `seiten`, `status` | 8 (`lehrplanGeruest`), 11 |
| Offen aus 2a: „wartet auf Freigabe", wenn nur `geprueftVon`/`geprueftAm` fehlen | 1 (+ Proben A–C), 2 (+ Probe A), 10, 12 (Schritte 3, 5, 8) |
| Bücher und EPUB, Dev-Endpunkt, Formular, Compiler-Abschnitt | **nicht Teil dieses Plans** — 2b-2, 2b-3, 2c. Ein Buch wird erkannt und mit Meldung abgewiesen (Aufgabe 8, Probe C). |

## Namen über die Aufgaben hinweg

`Befund` mit `wartet`, `pruefeLehrplan(daten, lektionsIds)`, `lehrplaeneAusTexten(texte, lektionsIds) → { gueltig, wartend, ungueltig }` (1) · `Freigabe`, `Bestand.freigabe`, `freigabezeile(b)`, `.quelle-freigabe` (2, 10) · `FIXTURES`, `erzeugeFixtures(ziel)` (3) · `ladePdfjs(basisOrdner?)`, `liesSeiten(bytes, geladen)`, `zeilenAus(elemente)`, `werteOperatorenAus(operatoren, OPS, bildOps)`, Typen `Zeile`, `Gitter`, `RohSeite`, `Pdfjs` (4) · `schluessel`, `zeichen`, `zieheTrennungZusammen`, `istZahlenzeile`, `findeBeiwerk`, `findeBildBeiwerk`, `bereinige(roh, vorgabe)`, `bereinigeQuelle(dateien)`, `artDerQuelle(dateien)`, `seitenText(seite, marke?)`, `BEIWERK_WARNUNG`, Typen `Seite`, `RohDatei`, `Datei` (5) · `slug`, `dateikuerzel`, `folientitel`, `findeAgenda`, `findeTitellaeufe`, `gliedereFolien(dokument, kuerzel)`, Typen `Folie`, `Abschnitt`, `Weg` (6) · `MANIFEST_FASSUNG_DOKUMENT`, `dateiHash(bytes)`, `standAusHashes(dateiHashes)`, `baueDokumentManifest({ art, originale, roh, gestempeltAm })`, Typen `Original`, `Rohdatei` (7) · `leseFolienEin(auftrag)`, `sammlePdfs(orte)`, `rohdatei(abschnitt, seiten)`, `natuerlich(a, b)`, `EinleseFehler`, `WARNZEILE`, `NUR_BILD_ZEILE`, Typen `Bericht`, `Ergebnis`; `lehrplanGeruest`, `vergleicheLehrplan`, `vergleichInZeilen`, Typ `Vergleich` (8) · `argumente(argv, name)`, `bericht(ergebnis, wurzel)`, `fuehreAus(argv, wurzel, schreibe?)` (9).

Die Werte von `gliederung` heißen überall `einzeln | agenda | titellaeufe | gleichmaessig`; das Manifestfeld heißt `tabellenverdacht`, der Wortlaut auf der Seite „mit Tabelle oder Grafik". Klassen, an denen Tests oder Abnahme hängen: `.quelle`, `.quelle-kopf`, `.quelle-freigabe`, `.quelle-zahlen`, `.quelle-luecken`, `.quelle-liste`, `.zeile`, `.zeile-titel`, `.zeile-fundstelle`, `.zeile-status`, `.bestand-warnung`, `[data-quelle]`, `[data-status]`, `[data-warnung]`.

## Testzahlen entlang des Plans

Zuwachs gegenüber BASIS nach jeder Aufgabe:

+8 (1) → +17 (2) → +19 (3) → +38 (4) → +70 (5) → +104 (6) → +122 (7) → +140 (8) → +150 (9). Die Aufgaben 10 bis 12 bringen keine neuen Tests; Aufgabe 11 zieht `tests/abdeckung.test.ts` nach, ohne die Zahl zu ändern. Testdateien 45 → 51.

Laufzeit der neuen Dateien im Probelauf: `fixtures-erzeugen` 1,3 s · `dokument-seiten` 1,6 s · `dokument-bereinigen` 2,1 s · `gliederung-folien` 1,5 s · `einlesen-folien` 5 bis 7 s · `ingest-aufruf` 1,9 s. Der längste einzelne Test liegt bei rund 1 s, die Frist bei 20 s.

## Offene Fragen

**Für 2b-2 (Bücher und EPUB)**
- Lesezeichen: `dokument.mjs` liest sie heute **nicht**. Der Prototyp konnte es (`getOutline`, flach mit Ebene und aufgelöster Zielseite); für Folien braucht es das nicht, und ungenutzter Code altert. Beim Buchgliederer kommt es zurück — die Fixture `buch-hochformat.pdf` trägt heute absichtlich keine.
- Leseordnung bei zwei Spalten: Zeilen werden reihenweise quer über die Spalten gelesen (an einer Tabellenseite gemessen: 29 von 50 Reihen mehrspaltig). Für Tabellenseiten sieht der Compiler ohnehin ins Original; für Fließtext in zwei Spalten wäre eine Blockbildung nötig, hier nicht gemessen.
- Die Einheit im Manifest: `herkunft.art` trägt schon `'buch' | 'folien'`, `lueckenzeile` kennt `seiten` und `folien`. Der Buchweg muss nur noch `art: 'buch'` setzen.

**Für 2b-3 (Formular und Dev-Endpunkte)**
- `leseFolienEin` ist schon die Funktion, die der Handler braucht: Orte, Kurzname, Titel, Wurzel hinein, ein Ergebnis heraus, kein `process.cwd()` darin. Was fehlt, ist der Fortschritt — heute läuft alles am Stück, 19 s ohne ein Lebenszeichen.
- Die Seite müsste die Art umstellen können (`--art folien` gibt es schon) und die erkannten Abschnitte zur Auswahl stellen.

**Für 2c (Compiler)**
- **Abschnitte über 20 Folien** werden nicht nachgeteilt: M7 6–26 (21 Folien), M5 1–19, M3 1–20, M4 10–24. Ob das für einen Durchgang zu groß ist, zeigt der erste Lauf.
- **Die Lektion `pauschal-heisst-nicht-komplett`** bekommt ihren Lehrplaneintrag erst dort. Bis dahin steht sie unter „ohne Lehrplaneintrag" — mit Absicht, und der Abschnitt `m07-03-risikomanagement` (Folien 27–35) ist ihre Herkunft.
- **Id-Stabilität beim Neueinlesen:** Der Slug hängt am Titel. Ändert der Verfasser eine Agendazeile, heißt derselbe Abschnitt beim nächsten Einlesen anders und erscheint im Vergleich als „neu" und „fehlt". Ohne Slug wäre die Id stabil gegen Titeländerungen, aber nicht gegen verschobene Grenzen. Eine Zuordnung über Seitenbereiche braucht das Neueinlesen so oder so.
- **Umbenannte Originale:** Der Stand bleibt gleich (er hängt an den Bytes), `datei` in jedem Abschnitt bricht. Auffallen muss es über `originale[].datei` im Manifest, nicht über den Stand.
- **Die Warnschwelle 60 %** hat im Probelauf nie ausgelöst; der höchste gemessene Wert war 57,2 % an einem Satz mit vielen Bildfolien, an dem nichts falsch ist. Die Schwelle ist damit ungetestet am echten Material — nur an einer erfundenen Eingabe.
- **„Folien 1–1"** steht im Rückfalltitel eines einseitigen Satzes (`m06-01-folien-1-1`), während die Fundstelle daneben „Folie 1" sagt. Das Id-Schema ist so gemessen und festgeschrieben; ob der Titel eine Einzahl bekommt, entscheidet 2c.
- **Diagramm und Tabelle** werden nicht getrennt. `tabellenverdacht` meint beides, und die Seite sagt es auch so. Ob der Compiler beide gleich behandeln soll, zeigt der erste Durchgang.
