# 2c — Messung und Prototyp (Befund)

Stand: 2026-09-24 · Repo `260901_Kernbohrung`, `master` = `004332d`, nur gelesen.
Quelle: `quellen/bauch-projektmanagement/` (Manifest Fassung 3, Stand `sha256:f99ba946…`),
`lehrplan/bauch-projektmanagement.yaml` (22 Abschnitte, alle `offen`, Freigabe leer).
Urheberrecht: In dieser Datei stehen nur Zahlen, Dateinamen, Abschnitts-Ids und Foliennummern.

---

## Aufgabe 1 — Was der Skill heute tut, wo Lehrmaterial andockt

### Heute (nur `art: repo`)

**Durchgang A — Prinzipien**
- A1 `quellen/<name>/uebersicht.md` da? Sonst `npm run ingest -- --git <url> --pfad … --name …`.
- A2 Erst `manifest.json`: `summe` und die Gründe unter `ausgelassen`.
- A3 `uebersicht.md` nur als Landkarte. A4 `roh/` **vollständig** lesen, vor allem den Code.
- A5 Prinzip = mehrfach belegt + nicht offensichtlich (plausible Gegenposition) + leitet Entscheidung.
- A6 `lehrplan/<name>.yaml` mit `art: repo`, `stand` = SHA, `geprueftVon`/`geprueftAm` leer,
  2–8 Prinzipien (`id`, `satz` ≤ 200, `warumNichtOffensichtlich`, `belege` ≥ 1, `widget`).
  Prüfen mit `liesLehrplan` (Aufruf im Skill). Ergebnis ist absichtlich „wartend".

**Review-Gate** — anhalten; vorlegen: Prinzipien + Gegenposition, Belege, Verworfenes mit
Grund, Unsicherheiten. Weiter erst bei Zustimmung **und** gefülltem `geprueftVon`; nie selbst füllen.

**Durchgang B — Lektionen, eine nach der anderen**
- B1 belegende Rohdateien neu lesen. B2 sechs Takte: Widerspruch (Rumpf) → Bild (Widget-Aufruf
  im Rumpf) → Satz (`prinzip`) → Probe (`aufgaben`, 2–6, laut Skill noch „`typ: wahl`") →
  Transfer (`transfer`) → Herkunft (`quellen`). Lektion-Id = Prinzip-Id (so zählt `abdeckung`).
- B3 falsche Antworten = vertretbare Positionen; jede Antwort mit Begründung; genau eine richtig;
  die Probe muss das Bild brauchen. B4 Transfer auf fremden Fall.
- B5 nach `entwurf/<id>.mdx` (gitignored) → `node werkzeug/pruefe-lektion.mjs entwurf/<id>.mdx`
  → Mängel im Entwurf beheben → erst bei „in Ordnung" `mv` nach `inhalt/lektionen/`.
- B5a Fallen: `„…"` mit geradem `"` bricht YAML; `einheitPlural` im Dativ.
- B6 `npm run build` (= `astro build`) als letzte Schranke — hält bei ungültigen Widget-Parametern.
- B7 im sichtbaren Browserfenster ansehen (`client:visible`).
- Nie: `geprueftVon` füllen, ungeprüft nach `inhalt/lektionen/`, `gesperrt: true` überschreiben.

### Was `pruefe-lektion` heute genau prüft (eine Datei, Aufruf mit Pfad)
1. Frontmatter per Regex (`\r?` für CRLF — alle 5 Lektionen haben im Arbeitsbaum CRLF).
2. YAML lesbar (js-yaml `load`), sonst ein Mangel.
3. **Widget-Aufrufe im Rumpf**: Muster `<Name … />`, Parameter als Literale per `new Function`
   ausgewertet; unbekannter Name → Mangel (bekannt ist nur `Pipeline`); Zod-Schema
   `PipelineProps`; Zusatz: jede Kombination zuschaltbarer Schritte hat ein Ergebnis.
4. **`LektionSchema`**: `titel`; `prinzip` 1–200 Zeichen; `vorbehalt` optional 1–200 (null →
   eigene Meldung); `reihenfolge` positive ganze Zahl; `gesperrt` (Vorgabe false); `fragen`
   verboten (Migrationshinweis); `aufgaben` 2–6 und `transfer` aus der Union
   `wahl | fall | zuordnen | reihenfolge` (je `strictObject`: wahl 3–5 Antworten, genau eine
   richtig, Texte und Begründungen eindeutig, Begründung ≥ 20 Zeichen und ≥ 5 Wörter; fall
   Sachverhalt ≥ 40 Zeichen, 2–8 Prüfpunkte, ≥ 1 Pflicht; zuordnen 3–6 Paare, Einträge ≤ 80
   Zeichen ohne `→`/`;`, ≤ 2 Ablenker; reihenfolge 3–7 eindeutige Schritte); `quellen` ≥ 1
   (`pfad`, `url` optional); Aufgaben-Ids inkl. Transfer eindeutig.
5. Alle Mängel (Kopf + Widgets) in einem Durchgang; Exit 1 bei Mängeln, 2 ohne Argument.

**Nicht geprüft**: Wortlaut gegen die Quelle (kein 12-Wort-Abgleich), Lehrplanstatus
(`beauftragt` übrig?), ob Dateiname = Prinzip-Id / ob ein Lehrplan auf die Lektion zeigt,
`reihenfolge` über Lektionen hinweg, `vorbehalt` gleich dem im Lehrplan, Foliennummern in
`quellen`, ob überhaupt ein Widget da ist (`pauschal-heisst-nicht-komplett` hat keins und
besteht). Tests: `tests/pruefe-lektion.test.ts`, 9 Fälle, keiner zu Wortlaut oder Lehrplan.

### Was für `art: folien` anders sein muss
- **Auslöser** „Bau die Lektionen für ‹kurzname›" bei `art: buch | folien` (heute: „destilliere …").
- **Vorprüfung, sonst Abbruch** (Nachträge 2b-1): Freigabe von Hand eingetragen; `stand` im
  Lehrplan = `manifest.herkunft.stand`; jede Abschnitt-Id in `manifest.roh`; `datei`
  bytegenau in `originale[].datei` (M6 hat zwei Leerzeichen).
- **Umfang = Abschnitte mit `status: beauftragt`**, nicht die ganze Quelle. Keine Obergrenze
  je Quelle (die 8 gilt nur für Repos), höchstens 3 Prinzipien je Abschnitt.
- **Rohdatei je Abschnitt**: `roh/<id>.md`, an den Marken `— Folie n —` in Folien getrennt.
- **Ansehen im Original**: jede Folie aus `manifest.roh[].nurBild` und `…tabellenverdacht`
  (aus dem Manifest, **nicht** aus den Hinweiszeilen der Rohdatei) per Read mit `pages`
  öffnen (geht hier erst mit Poppler oder einem Render-Werkzeug, Aufgabe 5); keine Lektion
  über eine nicht gesehene Folie; Bildfolie ohne Aussage wird nicht erwähnt.
  Leere Folien ohne Bild gibt es am Material nicht (Aufgabe 3), wohl aber 22 Folien mit
  Vektorgrafik außerhalb beider Listen — Regel dafür nötig.
- **Stichworte sind keine Sätze**: Folieninhalt mit Folienverweis belegen; Ergänzungen nur mit
  zweiter, benannter Quelle, sonst weglassen; im Zweifel ablehnen.
- **`vorbehalt`** am Prinzip → Lektion; Quellen dafür prüfen (DOI gegen Crossref); nie still
  lehren, nie still weglassen. Schreibfehler: richtiger Begriff, Abweichung in `quellen`.
- **Aufgabentypen** nach Stoff: `fall` (Sachverhalt), `zuordnen` (Paare), `reihenfolge`
  (Verfahren/Stufen), `wahl` (Abgrenzung) — der Skill sagt heute noch „`typ: wahl`".
  Für `fall`: Pflicht-Prüfpunkte = ohne sie ist die Lösung falsch.
- **Ablehnen mit Grund** → `status: abgelehnt`, `grund`. Sonst `status: lektion`, `lektion`.
- **Gate je Durchgang**: A schreibt `prinzipien` je Abschnitt und leert die Freigabe mit `""`;
  B erst nach neuer Freigabe. Ein zweiter Auftrag läuft wieder durchs Gate.
- **Ende**: kein Abschnitt mehr `beauftragt` — laut Spec prüft das `pruefe-lektion`; heute
  kennt es keinen Lehrplan (neuer Modus nötig, z. B. `--lehrplan lehrplan/<k>.yaml`);
  `pruefe-lektion` über alle neuen Lektionen **samt 12-Wort-Abgleich** (Aufgabe 2); `npm run build`.
- **Lücken im Bestand, die 2c schließen muss**:
  - Wer setzt `beauftragt`? Das Formular kommt erst mit 2b-3; bis dahin von Hand oder ein
    kleiner Befehl. Sonst hat der Auslöser nichts zu tun.
  - `PrinzipSchema.widget` ist Pflicht und muss ein bekanntes Widget sein — bekannt ist nur
    `Pipeline`. Ein Folienprinzip müsste heute `widget: Pipeline` tragen, obwohl die
    Folienlektion (`pauschal-…`) gar kein Widget hat. Takt 2 „Das Bild" braucht für Lehrmaterial
    eine Regel (optional machen oder Aufgabentyp statt Widget).
  - `pruefe-lektion` weiß nicht, aus welcher Quelle eine Lektion stammt; der 12-Wort-Abgleich
    braucht die Zuordnung Lektion → Quelle (aus dem Lehrplan) oder prüft gegen alle `roh/`.

---

## Aufgabe 2 — Prototyp des 12-Wort-Abgleichs

Dateien: `wortlaut.mjs` (Modul + Kommandozeile), `woerter-test.mjs` (20 Prüfungen der
Wortbildung, bestanden), `messung.mjs` → `messung.json`, `messung-ausgabe.txt`,
`probe.mjs` (Gegenprobe, 13 Fälle), `zeichen-statistik.mjs`, `lektionen-form.mjs`.

### Wie der Prototyp zählt
- **Wörter**: NFKC, klein, ß → ss, weicher Trennstrich/Nullbreiten entfernt; Wort = Folge aus
  Buchstaben/Ziffern. Bindestrich-Kompositum = ein Wort (`Detail-Pauschalvertrag` =
  `Detailpauschalvertrag`), Ergänzungsstrich („Bau- und …") trennt; `1.200.000` = eine Zahl.
  Gemessen: Rohdateien und Lektionen sind schon NFC; NFKC ändert zusätzlich `…`, `²`, `´` in
  9 Rohdateien (und fängt Ligaturen, die Bücher in 2b-2 bringen dürften). Keine weichen
  Trennstriche, keine Kombinationszeichen. Aufzählungszeichen aus Symbolschriften (Private
  Use, U+F0A7 × 71, U+F0E8, U+F0E0) sind Trenner.
- **Rohdatei**: Kopf vor der ersten Marke, Marken `— Folie n —`, `WARNZEILE`, `NUR_BILD_ZEILE`
  zählen nicht (ganze Zeile gleich der Konstante, aus `folien.mjs` importiert). Zeilen einer
  Folie werden verbunden; ein Fenster überschreitet nie eine Folie.
- **Lektion**: jeder YAML-String außer `typ`/`id`/`url` ist ein Feld (jedes Listenelement
  einzeln), der Rumpf ein Feld (ohne Widget-Aufrufe, Importe, Adressen), Strings aus
  Widget-Parametern eigene Felder. Kein Fenster über eine Feldgrenze.

### Gemessen (bauch-projektmanagement, 22 Rohdateien, 199 Folien, 8 906 Wörter)
| Variante | 13-Wort-Fenster (verschieden) | Treffer in den 5 Lektionen |
|---|---|---|
| A Folie, Zahlen zählen | 6 935 (6 671) | 0 |
| B Folie, Zahlen weglassen | 5 881 (5 716) | 0 |
| C Folie, Zahlen mitführen (gleich, zählen nicht) | 5 881 (5 718) | 0 |
| D Satzgrenzen `.!?;:` | 3 562 (−49 %) | 0 |
| E je Zeile | 58 (−99 %) | 0 |
| B mit Fenster 10 / 8 / 6 | 6 328 / 6 640 / 6 967 | 0 / 0 / 0 |
| I = B + Satzfilter (≥ 3 versch. Funktionswörter) | 5 881 | 0 |

- **Laufzeit**: Index 20–42 ms (Median je Lauf 22–29 ms), fünf Lektionen 8–14 ms; ganzer Aufruf der
  Kommandozeile ≈ 0,75 s (fast nur Laden der Module; `pruefe-lektion` heute ≈ 1 s je Datei).
  Zusatz: gegen `quellen/awesome-llm-apps/roh` 53 508 Fenster, Index ≈ 130–170 ms, 0 Treffer.
- **Treffer je Lektion**: 0 für alle fünf, in jeder Variante. `pauschal-heisst-nicht-komplett`:
  **0 Treffer, längster wortgleicher Lauf 2 Wörter** (Feld `aufgaben[0].aufgabe`); die vier
  Repo-Lektionen: längster Lauf 2, 2, 2 und 3 Wörter. Kein Lauf ab 4 Wörtern in irgendeiner Lektion.
- **Gegenprobe** (Satz aus `m07-03-risikomanagement`, Folie 27, 13 Wörter, im Original über
  einen Zeilenumbruch; Text nur im Speicher): als Absatz im Rumpf → **trifft**; in
  `transfer.antworten[2].begruendung` → trifft; GROSS + NFD + Fettdruck + Umbruch → trifft;
  mit eingeschobener Zahl → trifft (bei „Zahlen zählen" nicht); nur 12 Wörter → trifft nicht;
  ein Wort ersetzt → trifft nicht; auf zwei Felder verteilt → trifft nicht. Als Datei im
  Temp-Ordner über die Kommandozeile → trifft (Exit 1); `pruefe-lektion` heute auf derselben
  Datei → Exit 0 „in Ordnung". Probedatei danach gelöscht. 13/13 wie erwartet.

### Gefahr falscher Treffer
- **Normzitate und Normtitel**: gering. Eigene Proben (Zitatkette VOB/B + BGB, 21 Wörter;
  Titel VOB/B, HOAI, AHO Heft 9, DIN 69901-5) erreichen in der Quelle höchstens 5 Wörter am
  Stück. Titel von Normen/Verordnungen haben ≤ 10 Wörter — unter der Schwelle.
- **Tabellenkolonnen**: bei „Zahlen zählen" real: 3 077 von 6 935 Fenstern (44 %) enthalten
  Zahlen, 1 061 mindestens vier; 2 726 Fenster (39 %) liegen auf `tabellenverdacht`-Folien,
  893 davon mit ≥ 4 Zahlen. Ein `fall` oder `rechnen` mit den Zahlen eines Folienbeispiels
  (M6, M9) träfe mit weniger als 13 echten Wörtern. „Zahlen weglassen" beseitigt das.
- **Begriffsketten**: **real und belegt.** 98 Ketten ≥ 13 Wörter ohne ein Funktionswort
  (49 auf Tabellenfolien; je eine auf Folie 1 aller 9 Sätze — meist das Titelblatt, bei M6
  die Tabelle), in 18 der 22 Abschnitte. Meine eigene
  Formulierung der AHO-Handlungsbereiche A–E trifft mit **23 Wörtern am Stück**
  (`m01-01-folien-1-14`, Folie 5; 11 Fenster) — eine Lektion zu M1, die die Handlungsbereiche
  in Prosa aufzählt, fiele durch. HOAI-Leistungsphasen, DIN 276, AHO-Projektstufen: ≤ 4.
- **Unterscheidung Satz/Kette** gemessen: eigene Lektionsprosa 1 933 Fenster, davon 99,1 %
  mit ≥ 3 verschiedenen Funktionswörtern (94,6 % mit ≥ 4); Quelle 5 881 Fenster, davon
  49 % mit ≤ 2 (1 011 mit 0, 997 mit 1, 862 mit 2). Der Satzfilter lässt die AHO-Kette durch
  und fängt die Gegenprobe weiter.

### Vorschlag für die Regel (in `pruefe-lektion`)
1. **Fenster 13 Wörter** („mehr als zwölf"), über Zeilen- und Satzgrenzen hinweg, aber nur
   innerhalb einer Folie (Quelle) bzw. eines Felds (Lektion). **Keine Satzerkennung**: sie
   halbiert die Fenster, zeilenweise bleiben 1 %; „z. B.", „Abs.", „Nr." machen Satzenden
   im Deutschen unzuverlässig (so auch der Kommentar in `schema.ts`).
2. **Zahlen zählen nicht und unterbrechen nicht** (weglassen): Zahlen gehören nicht zum
   Wortlaut; schützt Rechen- und Tabellenaufgaben, fängt eine Abschrift mit geänderten Zahlen.
3. **Treffer nur, wenn das Fenster ≥ 3 verschiedene Funktionswörter hat** (Satz, keine
   Begriffskette) — Liste fest im Code, getestet. Alternative ohne Statistik: eine
   Freiliste öffentlicher Begriffsketten (AHO, HOAI, DIN 276) im Repo, deren Fenster abgezogen
   werden; teurer in der Pflege, dafür ohne Heuristik.
4. Normalisierung wie oben (NFKC statt NFC). Nicht mitgezählt: Kopf, Seitenmarken, beide
   Hinweiszeilen; in der Lektion `typ`, `id`, `url`. `quellen[].pfad` wird mitgeprüft; ein
   Zitat des Titelblocks (Kette ohne Funktionswort) lässt der Satzfilter durch — ohne Filter
   fiele es durch.
5. **Gegen alle `quellen/*/roh/`** (≈ 0,2 s), nicht nur gegen den Abschnitt: fängt auch
   Abschriften aus Nachbarfolien. Fehlt `quellen/` (GitHub), meldet die Prüfung „Wortlaut
   nicht geprüft — keine Rohdateien" statt „in Ordnung".
6. **Meldung ohne Text**: Feld, Wortbereich in der Lektion, Abschnitt-Id und Folie, Lauflänge.

---

## Aufgabe 3 — Leere Folien ohne Bild

Gezählt wie der Adapter (`zeichen` = Zeichen ohne Leerraum), je Folie der Rohdatei ohne
Marke und Hinweiszeilen. Skript `leere-folien.mjs` → `umfang.json`.

| Original | Folien | < 20 Zeichen | davon `nurBild` | **in keiner Liste** |
|---|---|---|---|---|
| M1 PM und Leistungsbilder 26.pdf | 23 | 0 | 0 | **0** |
| M2 PM Beispiele Leistungsbilder 26.pdf | 29 | 9 | 9 | **0** |
| M3 PM Stakeholderanalyse 26.pdf | 20 | 1 | 1 | **0** |
| M4 PM PSP 26.pdf | 45 | 0 | 0 | **0** |
| M5 PM Kommunikation 26.pdf | 31 | 3 | 3 | **0** |
| M6  Kostenschätzung Sportcenter 26.pdf | 1 | 0 | 0 | **0** |
| M7 Risikomanagement 26.pdf | 35 | 7 | 7 | **0** |
| M9 Leistungsstandsmessung 26.pdf | 13 | 1 | 1 | **0** |
| M10 Steuerungsmöglichkeiten 26.pdf | 2 | 0 | 0 | **0** |
| Summe | 199 | 21 | 21 | **0** |

- **Keine** Folie unter 20 Zeichen fällt durch beide Listen; alle 21 sind `nurBild`. Eine
  eigene Liste braucht dieses Material nicht. Knapp darüber, in keiner Liste: M2 Folie 27
  (35 Zeichen), M7 Folie 28 (37 Zeichen) — beide ohne echtes Bild und ohne auffällige
  Vektorgrafik (5 Pfade, Median der Datei 5 bzw. 9).
- **Nebenbefund, wichtiger als die Frage** (`vektor-folien.mjs` → `vektor.json`, Pfade je
  Seite aus der Operatorliste von pdf.js, nur gelesen): **22 Folien außerhalb beider Listen
  tragen viel Vektorgrafik** (≥ 20 Pfade und ≥ 3 × Median ihrer Datei; Heuristik, nicht
  kalibriert). Ihr Text ist in der Rohdatei, die Anordnung (Kreislauf, Matrix, Hierarchie)
  nicht. Je Abschnitt: `m05-01` 7 (Folien 4, 7, 10, 11, 12, 15, 17), `m04-05` 4 (38, 40,
  41, 42), `m07-02` 3 (6, 8, 10), `m05-03` 2 (25, 29), je 1: `m01-01` (3), `m01-02` (16),
  `m01-03` (22), `m03-01` (6), `m04-03` (18), `m09-01` (10). Vorschlag für 2c: Der Compiler
  sieht **jede Folie im Original an, auf die sich ein Prinzip stützt** — oder das Manifest
  bekommt eine dritte Liste `grafik`. Mit „nur `nurBild` + `tabellenverdacht`" gingen diese 22
  ungesehen durch.

---

## Aufgabe 4 — Umfang der Abschnitte

„anzusehen" = verschiedene Folien aus `nurBild` ∪ `tabellenverdacht`; „Grafik" = Nebenbefund
aus Aufgabe 3. Zeichen = Länge der Rohdatei (mit Kopf und Marken).

| Abschnitt | Folien | Zeichen | nurBild | tabellenv. | anzusehen | Grafik |
|---|---|---|---|---|---|---|
| m01-01-folien-1-14 | 14 | 8 648 | 0 | 0 | 0 | 1 |
| m01-02-ergaenzende-pm-leistungen-gem | 4 | 3 027 | 0 | 0 | 0 | 1 |
| m01-03-leistungen-building-information | 5 | 2 474 | 0 | 0 | 0 | 1 |
| m02-01-fallbeispiel-1-massnahmen | 7 | 1 811 | 3 | 0 | 3 | 0 |
| m02-02-fallbeispiel-2 | 12 | 2 482 | 6 | 1 | 7 | 0 |
| m02-03-fallbeispiel-3-beurteilung | 7 | 1 001 | 0 | 0 | 0 | 0 |
| m02-04-fallbeispiel-4-claims | 3 | 806 | 0 | 0 | 0 | 0 |
| m03-01-folien-1-20 | 20 | 6 595 | 1 | 1 | 2 | 1 |
| m04-01-folien-1-5 | 5 | 1 398 | 0 | 0 | 0 | 0 |
| m04-02-grundlagen-grundsaetze | 4 | 1 540 | 0 | 1 | 1 | 0 |
| m04-03-beispiel-fuer-typ | 15 | 7 178 | 0 | 7 | 7 | 1 |
| m04-04-aufbauorganisation | 10 | 5 149 | 0 | 3 | 3 | 0 |
| m04-05-hilfsmittel | 11 | 7 278 | 0 | 4 | 4 | 4 |
| m05-01-folien-1-19 | 19 | 8 104 | 1 | 2 | 3 | 7 |
| m05-02-projektkommunikation | 5 | 1 109 | 0 | 0 | 0 | 0 |
| m05-03-wie-organisieren | 7 | 893 | 2 | 0 | 2 | 2 |
| m06-01-folien-1-1 | 1 | 851 | 0 | 1 | 1 | 0 |
| m07-01-begriffsbestimmungen | 5 | 1 528 | 0 | 0 | 0 | 0 |
| **m07-02-prozess-des-risikomanagements** | **21** | 8 946 | 7 | 3 | 10 | 3 |
| m07-03-risikomanagement | 9 | 5 311 | 0 | 0 | 0 | 0 |
| m09-01-folien-1-13 | 13 | 6 558 | 1 | 2 | 3 | 1 |
| m10-01-folien-1-2 | 2 | 1 558 | 0 | 1 | 1 | 0 |
| **Summe** | **199** | **84 245** | **21** | **26** | **47** | **22** |

- **Über ~20 Folien: nur `m07-02-prozess-des-risikomanagements` (21).** Knapp darunter
  `m03-01` (20) und `m05-01` (19). **Über ~15 000 Zeichen: keiner**; die größte Rohdatei hat
  8 946 Zeichen (≈ 2 500 Tokens), die ganze Quelle 84 245 Zeichen (≈ 22 000 Tokens).
- Der Text ist also nirgends zu groß für einen Zug. Die Last steckt im **Ansehen**: `m07-02`
  hat 10 Folien aus den Listen (+ 3 Grafikfolien), `m04-03` 7, `m02-02` 7. Und in der
  **Breite**: 21 Folien auf höchstens 3 Prinzipien heißt, dass in `m07-02` viel abgelehnt
  oder zusammengelegt werden muss. Vorschlag: Abschnitte nicht nachteilen; einen Abschnitt
  mit mehr als 20 Folien oder mehr als 8 anzusehenden Folien im Durchgang allein bearbeiten.

---

## Aufgabe 5 — Originale ansehen

Probiert, ohne etwas vom Inhalt wiederzugeben:

| Aufruf | Ergebnis |
|---|---|
| `Read(file_path: "…/original/M7 Risikomanagement 26.pdf", pages: "16")` (`nurBild`) | **geht nicht**: „pdftoppm is not installed. Install poppler-utils …" |
| `Read(file_path: "…/original/M6  Kostenschätzung Sportcenter 26.pdf", pages: "1")` | **geht nicht**, dieselbe Meldung — `pages` braucht immer Poppler |
| `Read(file_path: "…/original/M6  Kostenschätzung Sportcenter 26.pdf")` (1 Seite, `tabellenverdacht`) | **geht**: Textebene **und** gerendertes Seitenbild |

- Auf diesem Rechner gibt es kein `pdftoppm`, `pdftocairo`, `mutool`, `magick`, `gswin64c`.
  Ohne `pages` liest Read nur PDFs bis 10 Seiten — das sind **2 der 9 Originale** (M6, M10);
  M1–M5, M7, M9 haben 13–45 Seiten und brauchen `pages`.
- **Ausweg ohne Installation, gemessen** (`render-probe.mjs`, nur im Speicher, keine Datei):
  pdf.js mit `@napi-rs/canvas` (liegt schon als optionale Abhängigkeit von pdfjs-dist im
  Repo) rendert M7 Seite 16 bei Skala 1,5 zu 1263 × 893 px, PNG 1,33 MB, 57 % nicht-weiße
  Pixel, 0,7 s samt Laden. Ein Werkzeug `werkzeug/seite-ansehen.mjs <kurzname> <datei> <seite>`
  könnte das nach `quellen/<k>/ansicht/…png` schreiben (gitignored, bleibt in `quellen/`), und
  der Compiler liest das PNG mit Read. Bei `npm ci --omit=optional` fehlt der Canvas — dann
  klare Meldung. Kosten: ≈ 1 500 Tokens je Seite (B × H / 750); alle 47 Listenfolien + 22
  Grafikfolien ≈ 100 000 Tokens über alle 22 Abschnitte.
- **Oder Poppler installieren** (Entscheidung des Nutzers; z. B. über winget/scoop/choco,
  `pdftoppm` in den PATH, Claude Code neu starten). Dann gilt der Aufruf aus dem Spec:
  `Read(file_path: "quellen/bauch-projektmanagement/original/M7 Risikomanagement 26.pdf", pages: "16")`,
  bis 20 Seiten je Aufruf.
- **Foliennummern** (`foliennummern.mjs`, Briefkopf je Seite, nur Zahlen): gedruckte Nummer =
  PDF-Seitennummer = Marke in der Rohdatei auf 198 von 199 Seiten. Einzige Abweichung: die
  eine Seite von M6 trägt die Nummer 2. Ein Folienverweis in `quellen` nennt also die Marke,
  bei M6 mit Hinweis.

---

## Aufgabe 6 — Lehrplan-Schema gegen den Bedarf

**Heute** (`src/lib/lehrplan.ts`): `lektion` genau bei `status: lektion` (superRefine, beide
Richtungen), Existenz der Datei in `pruefeLektionen`; `prinzipien` 0–3 in Repo-Form —
`widget` Pflicht und nur `Pipeline` bekannt; Prinzip-Ids werden über Abschnitte hinweg
**nicht** auf Eindeutigkeit geprüft (nur im Repo). `abdeckung`: Repo = Zeile je Prinzip,
abgedeckt bei Lektion mit Prinzip-Id; Lehrmaterial = Zeile je Abschnitt, Status und
`lektion` aus dem Lehrplan; `ohneLehrplan` = Lektionen, auf die kein `Zeile.lektion` zeigt.
Karte: `.zeile-status` mit genau einem Verweis.

### (a) Je Prinzip eine Lektion, Lektion-Id = Prinzip-Id
- **Schema**: `lektion` am Abschnitt entfällt (Migration mit eigener Meldung statt
  „unbekanntes Feld"). Neu in `pruefeLektionen`: `status: lektion` ⇒ ≥ 1 Prinzip, und jedes
  nicht verworfene Prinzip hat `inhalt/lektionen/<prinzip-id>.mdx`. **Verwerfen einzelner
  Prinzipien** braucht ein Feld (z. B. `grund` am Prinzip, nur Lehrmaterial) — sonst
  verschwindet ein verworfenes Prinzip still oder der Abschnitt wird nie `lektion`.
  Prinzip-Ids eindeutig im ganzen Lehrplan und über Lehrpläne hinweg (sie sind Dateinamen).
- **`abdeckung`**: `Zeile.lektion?: string` → `lektionen: string[]`; `bekannt` sammelt die
  Prinzip-Ids der Abschnitte. Zählung je Abschnitt bleibt; wahlweise „· n Lektionen".
- **Karte**: `Bestand.astro` zeigt mehrere Verweise (oder je Prinzip eine Unterzeile mit
  Marke); `bestandstext` nur, wenn die Zahlenzeile Lektionen nennt.
- **Tests**: alle unten genannten zum Feld neu, dazu Fixtures in `abdeckung` und
  `bestand-ansicht`; neue Tests für Prinzip-Eindeutigkeit, verworfene Prinzipien,
  `lektion` ⇒ alle Prinzipien.
- Am Material: `m07-03-risikomanagement` bekommt das Prinzip `pauschal-heisst-nicht-komplett`
  (Belege Folien 31–33) und wird `lektion` erst, wenn Folien 27–30 und 34–35 entschieden sind.

### (b) Je Abschnitt eine Lektion
- **Schema, `abdeckung`, Karte, Tests bleiben.** Aber eine Lektion trägt genau ein `prinzip`
  und einen `vorbehalt`: Bei 2–3 Prinzipien entweder `status: lektion` ⇒ genau 1 Prinzip
  (die 3 je Abschnitt wird faktisch 1), oder `LektionSchema` und `LektionAnsicht` bekommen
  mehrere Sätze. Sinnvoll wäre eine neue Prüfung „`prinzip` der Lektion = `satz` eines
  Prinzips des Abschnitts".
- Am Material: `m07-03` (Folien 27–35) stünde „mit Lektion", obwohl `pauschal-…` nur 31–33
  lehrt — die Abdeckung wäre zu hoch. `m07-02` (21 Folien) bekäme eine Lektion mit 2–6 Aufgaben.

### In beiden Fällen
- `PrinzipSchema.widget` für Lehrmaterial optional (Folienlektion hat kein Widget).
- Der Bestandstest (`abdeckung.test.ts`, „stimmt mit dem ueberein, was gemessen wurde") ändert
  sich mit dem Eintrag von `pauschal-…`: `ohneLehrplan` nur noch `recall-vor-precision`.

### Tests, die am heutigen Feld `lektion` hängen
- `tests/lehrplan-lehrmaterial.test.ts` — **15 Fälle**: „bleibt ungueltig, wenn daneben eine
  Lektion fehlt"; Block „Abschnitte - grund und lektion" (9: verlangt die Lektion · Lektion
  neben anderem Status · `lektion: null` · bei abgelehnt · bei beauftragt · Grund bei status
  lektion · nimmt vorhandene an · weist fehlende zurück und nennt die Datei · fällt ohne
  bekannte Lektionen durch); „liesLehrplan - Lehrmaterial" (2, YAML-Fixture mit `lektion:`);
  „liesLehrplan - Standardordner" (2, hängt an der echten Datei `pauschal-…`); „keine
  englische Meldung", Fall `lektion: null`.
- `tests/abdeckung.test.ts` — **10 Tests** nutzen Fixtures mit Lektionsabschnitt (`fuenf`,
  `lektionsAbschnitt`); direkt am Feld: zählt nach Status · übernimmt … Lektion … in die
  Zeile · nennt Lektionen ohne Lehrplaneintrag · wartet und zählt · Lektion eines wartenden
  Lehrplans · Bestandstest.
- `tests/bestand-ansicht.test.ts` — **2**: „verweist bei einer Zeile mit Lektion auf die
  Lektion" (Repo-Zeile) · „zeigt bei Folien Fundstelle, Grund und Vorbehalt" (Fixture mit `lektion`).
- `tests/einlesen-folien.test.ts` — **1**: „vergleicht auch mit einem inhaltlich ungueltigen
  Lehrplan" (erzeugt den Mangel über `lektion: grundlagen-der-planung`).
- `tests/bestandstext.test.ts` — 5 Tests halten `mitLektion`-Zahlen fest, nicht das Feld;
  betroffen nur, wenn sich die Zählung ändert.

**Einschätzung**: (a) passt zur Form, die der Spec schon vorsieht (Prinzipien je Abschnitt in
Repo-Form), deckt ehrlich ab und rechnet wie beim Repo; Preis ≈ 28 Tests und ein Feld für
verworfene Prinzipien. (b) kostet jetzt fast nichts, zwingt aber zu einem Prinzip je
Abschnitt oder zu einer Lektion mit mehreren Sätzen, und am Material stimmt die Abdeckung nicht.

---

## Dateien unter `kb2c/`
`befund.md` · `wortlaut.mjs` · `woerter-test.mjs` · `messung.mjs` · `messung.json` ·
`messung-ausgabe.txt` · `probe.mjs` · `zeichen-statistik.mjs` · `lektionen-form.mjs` ·
`leere-folien.mjs` · `umfang.json` · `vektor-folien.mjs` · `vektor.json` ·
`render-probe.mjs` · `foliennummern.mjs` · `foliennummern.json`.
Die Probedatei `probe/probe-pauschal.mdx` bestand nur während `probe.mjs` und ist gelöscht.
`selbstpruefung.mjs` misst den längsten wortgleichen Lauf jeder dieser Dateien gegen die
Rohdateien: höchstens 3 Wörter (Zahlenfolgen 6) — außer `messung.mjs` und `probe.mjs`: Sie
enthalten meine eigene Formulierung der öffentlichen AHO-Handlungsbereiche A–E (Probe für
Falsch-Treffer), die mit 23 Wörtern gleich auf `m01-01`, Folie 5 steht. Auf Wunsch löschen.
