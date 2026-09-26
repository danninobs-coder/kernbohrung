# Kernbohrung — Bibliothek 2c-1: Werkzeug für den Compiler-Durchgang an Lehrmaterial — Implementierungsplan

> **Für agentische Ausführung:** ERFORDERLICHER SUB-SKILL: `superpowers:subagent-driven-development` (empfohlen) oder `superpowers:executing-plans`. Schritte nutzen Checkbox-Syntax (`- [ ]`).

**Ziel:** Alles, was der Compiler-Skill braucht, um aus eingelesenen Foliensätzen Lektionen zu bauen — noch ohne den ersten Durchgang. Eine Lektion gehört zu genau einem Prinzip und trägt dessen Id, auch bei Lehrmaterial; die Karte der Bibliothek verweist je Abschnitt auf die Lektionen seiner Prinzipien. Dazu vier Werkzeuge: `npm run auftrag` setzt Abschnitte von `offen` auf `beauftragt`, `npm run ansicht` rendert Folien des Originals als PNG, `pruefe-lektion` weist eine Lektion ab, die dreizehn Wörter am Stück aus einer Rohdatei übernimmt, und `npm run pruefe-quelle -- --vor | --nach` hält Anfang und Ende eines Durchgangs fest. Der Skill bekommt den Abschnitt „Durchgang für Lehrmaterial“.

**Architektur:** Das Schema bleibt in `src/lib/lehrplan.ts`, die Karte in `abdeckung.ts`, `bestandstext.ts` und `Bestand.astro` — dort ändert sich das Datenmodell (Aufgabe 1). Jedes neue Werkzeug hat drei Schichten wie das Einlesen: eine reine Funktion über Texte, eine Funktion über eine Wurzel (liest und schreibt nur darunter, im Test ein Temp-Verzeichnis) und `fuehreAus(argv, wurzel, schreibe?)` als Kommandozeile; nur der Aufrufblock am Dateiende reicht `process.cwd()` hinein. Neu: `werkzeug/auftrag.mjs`, `werkzeug/ansicht.mjs`, `werkzeug/wortlaut.mjs`, `werkzeug/pruefe-quelle.mjs`; erweitert: `werkzeug/manifest.mjs` (das Manifest der Fassung 3 lesen) und `werkzeug/pruefe-lektion.mjs` (Wortlaut-Abgleich, mehrere Dateien).

**Stack:** Node ≥ 22.18, Astro 7 (statisch), Zod 4 über `astro/zod`, Vitest, js-yaml 5. **Keine neue Abhängigkeit:** `pdfjs-dist` bleibt `6.3.289`; `@napi-rs/canvas` liegt schon als optionale Abhängigkeit von pdfjs-dist im Lockfile und wird nur in `werkzeug/ansicht.mjs` geladen, erst beim Rendern.

**Spec:** `docs/superpowers/specs/2026-09-18-bibliothek-design.md` — „Datenmodell: Lehrplan Fassung 2“, „Der Compiler-Skill“, „Urheberrecht“, „Nachweis“ und beide Nachträge. Messung zu diesem Plan: `docs/recherche/2026-09-24-compiler-lehrmaterial-befund.md`. **Nicht Teil dieses Plans:** der erste echte Durchgang an M7 (2c-2, mit dem Nutzer am Review-Gate), Bücher und EPUB (2b-2), Formular und Dev-Endpunkte (2b-3), das Schreiben von Lektionen.

**Voraussetzung:** `master` ab `004332d` — Bibliothek 2b-1 ist zusammengeführt, die Vorlesung ist eingelesen, ihr Lehrplan wartet auf Freigabe.

**Form dieses Plans:** Anders als 2a und 2b-1 steht hier nicht jede Codezeile. Fest stehen Dateien, Schnittstellen, Regeln, jeder sichtbare Wortlaut und die Testfälle mit ihren Erwartungen; den Code schreibst du testgetrieben. Grund: Zwei lange Planläufe mit Probelauf wurden abgebrochen, und die Entscheidungen sind geklärt. Was nicht feststeht, entscheidest du im Sinne der Nachbarn im Code — und nennst es im Bericht.

---

## Was jeder Ausführende wissen muss

Du siehst nur diesen Vorspann und deine eine Aufgabe.

1. **Das Arbeitsverzeichnis der Bash-Aufrufe wandert nicht mit.** Jeder Aufruf beginnt mit `cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && `.
2. **Niemals `git add -A` oder `git add .`** — immer die Dateien einzeln aufzählen.
3. **Commit-Nachrichten über `git commit -F - <<'MSG'`** und nur mit geraden Anführungszeichen. Letzte Zeile: die Co-Authored-By-Zeile deiner eigenen Sitzung.
4. **Kein NUL-Byte in einer Textdatei.** Am Ende jeder Aufgabe: `python -c "import sys; print(sum(open(f,'rb').read().count(b'\x00') for f in sys.argv[1:]))" <geänderte Textdateien>` → `0`. PDF und PNG sind binär und gehören nicht in die Prüfung.
5. **Relative Importe:** Was unter reinem Node läuft (`werkzeug/*.mjs` und alles, was sie laden, darunter `src/lib/lehrplan.ts`), importiert relativ **mit Endung** (`.mjs`, `.ts`). Node löst Importe ohne Endung nicht auf.
6. **TDD:** erst der Test, der rot wird (Meldung notieren), dann der Code. Befehle: `npx vitest run tests/<datei>`, alle `npm test`, Typen `npm run check`, Bau `npm run build`.
7. **Nie zwei Läufe gleichzeitig.** `npm test`, `npm run check`, `npm run build` teilen sich Zwischenspeicher. Scheitert ein Lauf unerklärlich (bekannt: pdf.js-Tests direkt nach einem Bau, Einlesetests unter Last), einmal allein wiederholen, bevor du etwas „reparierst“.
8. **Keine absoluten Gesamttestzahlen erwarten.** Aufgabe 0 notiert **BASIS** (Tests) und **SEITEN** (Bau). Melde je Aufgabe den Zuwachs.
9. **Wortlaute werden übernommen, nicht verbessert.** Jeder sichtbare Satz steht unten fest — mit Umlauten — und ein Test hält ihn Zeichen für Zeichen. Bezeichner und Kommentare im Code ohne Umlaute.
10. **`quellen/` ist gitignored und enthält fremdes Vorlesungsmaterial.** Kein Test liest `quellen/` oder den Materialordner; Tests bauen ihre Daten in einem Temp-Verzeichnis (`mkdtempSync`) oder nehmen `tests/fixtures/`. Nie Folientext in Code, Tests, Commit-Nachrichten oder auf der Konsole — nur Zahlen, Foliennummern, Dateinamen, Ids, Titel.
11. **Werkzeuge sind geprüftes JavaScript.** `astro check` läuft mit `checkJs: true`; jede `.mjs` braucht JSDoc-Typen an Parametern, Rückgaben und leeren Sammlungen.
12. **Arbeitsordner statt Projektwurzel.** Was liest oder schreibt, nimmt die Wurzel als Parameter; nur der Aufrufblock am Dateiende reicht `process.cwd()` hinein. Direktaufruf erkennen wie in `werkzeug/pruefe-lektion.mjs` (`pathToFileURL(process.argv[1]).href`).
13. **Fehler, die der Nutzer sieht, sind deutsche Sätze** (eine eigene Fehlerklasse je Werkzeug, wie `EinleseFehler`); Programmierfehler gehen als Stapelabzug durch. Exit-Codes: 0 in Ordnung, 1 Mängel, 2 falscher Aufruf.
14. **Zeilenenden:** Die Arbeitskopie führt CRLF (`core.autocrlf=true`). Wer eine Datei mit einem Skript schreibt, schreibt sie mit CRLF. Werkzeuge, die eine vorhandene Datei ändern (der Auftrag), behalten deren Zeilenenden.
15. **pdf.js nur über `ladePdfjs()`** aus `werkzeug/adapter/dokument.mjs`, in Tests einmal in `beforeAll`.
16. **Astro löscht Leerraum mit Zeilenumbruch zwischen zwei Elementen.** Wo Elemente mit Trennzeichen nebeneinanderstehen, gehören sie samt Trennzeichen auf eine Quelltextzeile.
17. **Wann anhalten:** Bei Fehlern, Warnungen, roten Tests, die du nicht erklären kannst, oder wenn eine Entscheidung dieses Plans nicht umsetzbar ist: BLOCKED mit Befund. Weicht nur eine Zählung ab: weitermachen und berichten.

## Präzisierungen gegenüber dem Spec

1. **Eine Lektion je Prinzip** (Nutzer, 2026-09-24). Ein Abschnitt aus Lehrmaterial bekommt bis zu drei Prinzipien; jedes wird eine eigene Lektion mit **Lektion-Id = Prinzip-Id**, wie bei Repos. Das Feld `lektion` am Abschnitt entfällt. Der Spec sah eine Lektion je Abschnitt vor; eine Lektion hat aber sechs Takte um genau einen Satz (`prinzip`), und bei zwei oder drei Prinzipien wäre die Abdeckung falsch gezählt (`m07-03` stünde „mit Lektion“, obwohl die Pauschal-Lektion nur die Folien 31–33 lehrt).
2. **Status eines Abschnitts:** `offen` — keine Prinzipien; `beauftragt` — 0 bis 3 Prinzipien (0 vor Durchgang A, danach mindestens eines); `lektion` — mindestens ein Prinzip, und zu jedem gibt es die Lektion gleicher Id; `abgelehnt` — `grund` Pflicht, keine Prinzipien. Verworfene Prinzipien streicht der Mensch am Review-Gate aus dem Lehrplan; ein Feld dafür gibt es nicht.
3. **`widget` am Prinzip** bleibt bei Repos Pflicht und ist bei Buch und Folien optional: Eine Folienlektion hat oft kein Widget, ihre Interaktion sind die Aufgaben (Vorbild: `pauschal-heisst-nicht-komplett`).
4. **Prinzip-Ids sind über alle Lehrpläne eindeutig**, weil sie Lektionsdateien benennen. Das löst zugleich die offene Frage aus 2a „dieselbe Prinzip-Id in zwei Repo-Lehrplänen zählt eine Lektion doppelt“.
5. **Die Karte** führt in der Zeile eines Abschnitts die Lektionen seiner Prinzipien als Verweise. Eine Lektion gilt als „mit Lehrplaneintrag“, wenn ein Prinzip eines gültigen oder wartenden Lehrplans ihre Id trägt.
6. **Der Auftrag** ist bis 2b-3 ein Befehl im Terminal (`npm run auftrag`). Er ändert nur Statuszeilen und lässt den Rest der Datei Byte für Byte stehen; sein Kern ist die reine Funktion, die 2b-3 für `/__auftrag` wiederverwendet.
7. **Folien ansehen über gerenderte PNG.** `Read` mit `pages` braucht Poppler (`pdftoppm`), das hier nicht installiert ist; ohne `pages` liest `Read` nur PDF bis 10 Seiten (2 der 9 Originale). Gemessen: pdf.js mit `@napi-rs/canvas` rendert eine Folie von M7 bei Skala 1,5 zu 1263 × 893 px in 0,7 s. Systemsoftware wird nicht installiert. Die Bilder liegen unter `quellen/<k>/ansicht/` (gitignored).
8. **Der Compiler sieht mehr Folien an als die Listen nennen.** Gemessen: 22 Folien mit viel Vektorgrafik stehen weder unter `nurBild` noch unter `tabellenverdacht`. Der Skill verlangt deshalb zusätzlich jede Folie, auf die sich ein Prinzip stützt.
9. **Der 12-Wort-Abgleich** (Spec „Urheberrecht“), Regel nach Messung: 13 aufeinanderfolgende gleiche Wörter innerhalb einer Folie bzw. eines Lektionsfelds; Normalisierung NFKC, klein, ß → ss, ein Bindestrich-Kompositum ist ein Wort; Zahlen zählen nicht und unterbrechen nicht; ein Treffer zählt nur, wenn die 13 Wörter mindestens 3 verschiedene Funktionswörter enthalten (Satz, keine Begriffskette). Gemessen an den fünf vorhandenen Lektionen: 0 Treffer, längster gleicher Lauf 3 Wörter. Ohne den Funktionswort-Filter fiele eine eigene Aufzählung der öffentlichen AHO-Handlungsbereiche durch (23 Wörter gleich). Fehlen die Rohdateien (GitHub), heißt es „nicht geprüft“, nicht „in Ordnung“.
10. **Vor- und Nachprüfung** stehen in einem eigenen Werkzeug, weil sie Lehrplan, Manifest und Lektionen zusammen sehen müssen: Freigabe, Stand, Ids, Dateinamen bytegenau, Auftrag vorhanden — und am Ende kein Abschnitt mehr `beauftragt`, jede Lektion da und sauber im Wortlaut.

## Der heutige Bestand (gemessen am 2026-09-24)

| | |
|---|---|
| Tests | 1009 in 51 Dateien; `astro check` 0/0/0; Bau 9 Seiten |
| Lehrpläne | `awesome-llm-apps.yaml` (Repo, 6 Prinzipien, 3 mit Lektion, freigegeben) · `bauch-projektmanagement.yaml` (Folien, 22 Abschnitte, alle `offen`, wartet auf Freigabe) |
| Lektionen | 5; ohne Lehrplaneintrag: `pauschal-heisst-nicht-komplett`, `recall-vor-precision` |
| Feld `lektion` | in keinem Lehrplan benutzt; 28 Tests hängen daran (15 in `lehrplan-lehrmaterial`, 10 in `abdeckung`, 2 in `bestand-ansicht`, 1 in `einlesen-folien`) |
| Rohdateien der Vorlesung | 22, zusammen 84 245 Zeichen; größter Abschnitt `m07-02` mit 21 Folien und 8 946 Zeichen |

## Dateistruktur

```
src/lib/lehrplan.ts            Abschnitt ohne lektion; Status-Regeln; widget optional bei Lehrmaterial;
                               Prinzip-Ids eindeutig im Lehrplan und ueber alle Lehrplaene   (Aufgabe 1)
src/lib/abdeckung.ts           Zeile.lektionen statt Zeile.lektion; bekannt = alle Prinzip-Ids   (Aufgabe 1)
src/components/Bestand.astro   mehrere Verweise je Zeile                                        (Aufgabe 1)
werkzeug/auftrag.mjs           beauftrage(text, ids) · beauftrageDatei · fuehreAus              (Aufgabe 2, neu)
werkzeug/manifest.mjs          + liesDokumentManifest(text)                                     (Aufgabe 3)
werkzeug/ansicht.mjs           folienAuswahl · rendereFolien · fuehreAus                        (Aufgabe 3, neu)
werkzeug/wortlaut.mjs          woerter · rohFolien · lektionFelder · baueIndex · findeAbschriften
                               · liesRohIndex                                                   (Aufgabe 4, neu)
werkzeug/pruefe-lektion.mjs    + Wortlaut, mehrere Dateien                                      (Aufgabe 4)
werkzeug/pruefe-quelle.mjs     pruefeVor · pruefeNach · fuehreAus                               (Aufgabe 5, neu)
.claude/skills/kernbohrung-compiler/SKILL.md   + Durchgang fuer Lehrmaterial                    (Aufgabe 6)
README.md                      + auftrag, ansicht, pruefe-quelle                                (Aufgabe 6)
package.json                   + Skripte auftrag, ansicht, pruefe-quelle                        (Aufgaben 2, 3, 5)
tests/…                        je Aufgabe, siehe dort
```

---

## Aufgabe 0: Ausgangslage, Zweig

**Dateien:** keine.

- [ ] **Schritt 1:** `git status --short` leer, Zweig `master`, `git merge-base --is-ancestor 004332d HEAD`, `node --version` ≥ 22.18. Dann `git switch -c bibliothek-2c1`.
- [ ] **Schritt 2:** `npm test`, `npm run check`, `npm run build` nacheinander — **BASIS** und **SEITEN** notieren (gemessen: 1009, 9).
- [ ] **Schritt 3:** `node -e "require('@napi-rs/canvas'); console.log('canvas da')"` → `canvas da`. `ls quellen/bauch-projektmanagement/manifest.json` → vorhanden (sonst in Aufgabe 7 den Schritt am echten Material auslassen).

**Bericht:** BASIS, SEITEN, Node-Version, Canvas, Manifest.

---

## Aufgabe 1: Eine Lektion je Prinzip — Schema, Abdeckung, Karte

**Dateien:**
- Ändern: `src/lib/lehrplan.ts`, `src/lib/abdeckung.ts`, `src/components/Bestand.astro`
- Tests ändern: `tests/lehrplan-lehrmaterial.test.ts`, `tests/lehrplan.test.ts`, `tests/abdeckung.test.ts`, `tests/bestand-ansicht.test.ts`, `tests/einlesen-folien.test.ts` (ein Test erzeugt heute einen Mangel über `lektion:`), gegebenenfalls `tests/bestandstext.test.ts`

Schema und Karte ändern sich zusammen, weil `abdeckung.ts` das Feld `lektion` liest — nach jedem Commit ist die Suite grün.

### Verhalten

**Schema (`src/lib/lehrplan.ts`):**
- `AbschnittSchema` verliert `lektion`. Steht `lektion` trotzdem in einem Abschnitt, meldet der Schema-Fehler für diesen unbekannten Schlüssel (wie der Hinweis bei `isbn` in Folien) genau: `lektion gibt es nicht mehr: Die Lektionen eines Abschnitts sind die seiner Prinzipien (Lektion-Id = Prinzip-Id).`
- Neue Regeln im `superRefine` des Abschnitts (Pfad jeweils am Abschnitt bzw. an `prinzipien`):
  - `status: offen` mit Prinzipien → `Ein offener Abschnitt hat noch keine Prinzipien — erst beauftragen, dann Durchgang A.` (Pfad `prinzipien`)
  - `status: abgelehnt` mit Prinzipien → `Ein abgelehnter Abschnitt hat keine Prinzipien.` (Pfad `prinzipien`)
  - `status: lektion` ohne Prinzip → `Ein Abschnitt mit status lektion braucht mindestens ein Prinzip — seine Lektionen tragen dessen id.` (Pfad `prinzipien`)
  - bleiben: `grund` genau bei `abgelehnt` (vorhandene Meldungen).
- Das Prinzip bei Buch und Folien: wie bei Repos, aber `widget` optional (eigenes Schema, abgeleitet vom Repo-Prinzip; der exportierte Typ `Prinzip` ist die Form mit optionalem `widget`).
- `pruefeAbschnitte` meldet zusätzlich eine Prinzip-Id, die im selben Lehrplan zweimal vorkommt (über Abschnitte hinweg): `Zwei Prinzipien haben die id ${id}.` — Pfad `abschnitte.${i}.prinzipien.${j}.id` am zweiten Vorkommen.
- `pruefeLektionen` prüft statt `a.lektion`: für jeden Abschnitt mit `status: lektion` jedes Prinzip — fehlt die Lektion, dann `abschnitte.${i}.prinzipien.${j}.id: Die Lektion ${id} gibt es nicht (inhalt/lektionen/${id}.mdx).`
- `lehrplaeneAusTexten`: Nach dem Prüfen aller Dateien (in Pfad-Reihenfolge) wird ein Lehrplan, der eine Prinzip-Id trägt, die schon ein früherer (gültiger oder wartender) Lehrplan trägt, ungültig: Mangel `(Wurzel): Die Prinzip-Id ${id} steht schon in ${andereDatei}; Lektion und Prinzip teilen sich die Id.` — je doppelter Id ein Mangel, er landet in `ungueltig`.

**Abdeckung (`src/lib/abdeckung.ts`):**
- `Zeile.lektion?: string` wird `Zeile.lektionen: readonly string[]` — die Ids der Lektionen, die es gibt: bei Repos `[p.id]`, wenn die Lektion existiert, sonst `[]`; bei Lehrmaterial die Ids der Prinzipien des Abschnitts, deren Lektion existiert (bei `status: lektion` also alle).
- `ohneLehrplan`: Lektionen, deren Id **keine** Prinzip-Id eines der übergebenen Lehrpläne ist (bisher: auf die keine Zeile zeigt). Die Zählung je Abschnitt bleibt.

**Karte (`src/components/Bestand.astro`):** In `.zeile-status` nach der Marke je Lektion ` · <a href="…lektion/<id>/">Titel</a>` — alles auf einer Quelltextzeile (Vorspann 16). Ohne Lektion nur die Marke.

### Tests (erst rot, dann grün)

`tests/lehrplan-lehrmaterial.test.ts` — die Fälle am alten Feld `lektion` werden auf das neue Modell umgeschrieben, dazu neu:
1. `offen` mit einem Prinzip → Mangel W1 (Wortlaut oben) am Pfad `abschnitte.0.prinzipien`.
2. `abgelehnt` mit Grund und einem Prinzip → Mangel „Ein abgelehnter Abschnitt hat keine Prinzipien.“
3. `lektion` ohne Prinzip → Mangel „Ein Abschnitt mit status lektion braucht …“.
4. `lektion` mit zwei Prinzipien, deren Lektionen es gibt → gültig.
5. `lektion` mit zwei Prinzipien, eine Lektion fehlt → Mangel mit Pfad `abschnitte.0.prinzipien.1.id` und `(inhalt/lektionen/<id>.mdx)`.
6. `beauftragt` mit Prinzipien ohne Lektionen → gültig (der Zustand nach Durchgang A).
7. `beauftragt` ohne Prinzipien → gültig (vor Durchgang A).
8. altes Feld `lektion: x` → genau die Migrationsmeldung.
9. Prinzip ohne `widget` im Folien-Lehrplan → gültig; im Repo-Lehrplan → Mangel wie bisher.
10. dieselbe Prinzip-Id in zwei Abschnitten → „Zwei Prinzipien haben die id …“ am zweiten Vorkommen.
11. `lehrplaeneAusTexten` mit zwei Lehrplänen, die dieselbe Prinzip-Id tragen → der zweite (nach Pfad) ungültig mit dem Satz aus dem Verhalten oben, der erste gültig; dasselbe mit zwei Repo-Lehrplänen.
12. „keine englische Meldung“ um die neuen Fälle ergänzen.

`tests/abdeckung.test.ts` — Fixtures mit `lektion` auf Prinzipien umstellen, dazu:
13. Abschnitt `lektion` mit zwei Prinzipien → `zeilen[0].lektionen` sind beide Ids, Zählung `mitLektion: 1`.
14. Abschnitt `beauftragt` mit einem Prinzip ohne Lektion → `lektionen: []`, Status `beauftragt`.
15. Eine Lektion, deren Id nur als Prinzip eines `beauftragt`-Abschnitts steht → nicht unter `ohneLehrplan`.
16. Der Bestandstest („der heutige Bestand“) bleibt grün.

`tests/bestand-ansicht.test.ts`:
17. Zeile mit zwei Lektionen → genau `<p class="zeile-status"><span class="zeile-marke">mit Lektion</span> · <a href="/lektion/a/">A</a> · <a href="/lektion/b/">B</a></p>` (Ids und Titel des Tests).
18. Zeile ohne Lektion → nur die Marke.

**Mutationsproben** (je Vorhersage und Ergebnis im Bericht): Regel „offen ohne Prinzipien“ entfernen → Test 1 rot; die globale Eindeutigkeit in `lehrplaeneAusTexten` entfernen → Test 11 rot; in `Bestand.astro` nur die erste Lektion zeigen → Test 17 rot.

- [ ] **Schritt 1:** Tests schreiben bzw. umschreiben, `npx vitest run` der fünf Dateien → rot (Meldungen notieren).
- [ ] **Schritt 2:** Schema, Abdeckung, Karte umsetzen → grün.
- [ ] **Schritt 3:** `npm test` (BASIS + Zuwachs), `npm run check` (0/0/0), `npm run build` (SEITEN). Die Karte `/bibliothek/` zeigt unverändert zwei Karten (`grep -c 'class="karte quelle"' dist/bibliothek/index.html` → `2`).
- [ ] **Schritt 4:** Mutationsproben, NUL-Prüfung, Commit: `feat: Lehrplan - eine Lektion je Prinzip, auch bei Lehrmaterial`.

---

## Aufgabe 2: Der Auftrag — `npm run auftrag`

**Dateien:** Neu `werkzeug/auftrag.mjs`, `tests/auftrag.test.ts`; ändern `package.json` (Skript `"auftrag": "node werkzeug/auftrag.mjs"`).

### Schnittstelle

```js
/** Reine Funktion ueber den Text eines Lehrplans. */
export function beauftrage(text, ids) // → { ok: true, text: string, geaendert: string[] } | { ok: false, maengel: string[] }

/** Liest lehrplan/<kurzname>.yaml unter wurzel, beauftragt, prueft mit pruefeLehrplan, schreibt zurueck. */
export function beauftrageDatei({ wurzel, kurzname, ids }) // → { geaendert: string[], datei: string }; wirft AuftragFehler

export class AuftragFehler extends Error {}

/** Kommandozeile: npm run auftrag -- --name <kurzname> <abschnitt-id> [<abschnitt-id> …] */
export async function fuehreAus(argv, wurzel, schreibe = (z) => console.log(z)) // → Exit-Code 0 | 1 | 2
```

### Verhalten

- `beauftrage` ändert **nur** die Zeile `status: offen` der genannten Abschnitte zu `status: beauftragt` und lässt alles andere Byte für Byte stehen (Kopfkommentar, Anführungszeichen, Reihenfolge, CRLF oder LF). Danach liest es den neuen Text mit js-yaml und prüft: Genau die genannten Abschnitte haben den Status gewechselt, sonst ist nichts anders (Vergleich der gelesenen Objekte). Scheitert das, ist es ein Programmierfehler (Stapelabzug).
- Alles oder nichts: Gibt es einen Mangel, ändert sich nichts. Mängel, wörtlich:
  - keine Id: `Kein Abschnitt genannt.`
  - Id unbekannt: `Abschnitt ${id} gibt es in diesem Lehrplan nicht.`
  - nicht offen: `Abschnitt ${id} steht auf ${status}, nicht auf offen — beauftragt wird nur, was offen ist.`
  - Repo-Lehrplan: `Nur ein Lehrplan aus Lehrmaterial hat Abschnitte; dieser trägt art: repo.`
  - YAML-Fehler: die einzeilige Meldung wie in `lehrplanAusYaml`.
  - dieselbe Id zweimal genannt: zählt einmal, kein Mangel.
- `beauftrageDatei` prüft das Ergebnis mit `pruefeLehrplan` (Lektionen aus `<wurzel>/inhalt/lektionen`): gültig oder wartend ist in Ordnung, ungültig nicht (dann `AuftragFehler` mit den Mängeln, Datei unverändert). Fehlt die Datei: `lehrplan/${kurzname}.yaml gibt es nicht — erst einlesen.`
- `fuehreAus`: ohne `--name` oder ohne Id → Aufruf-Hilfe `Aufruf: npm run auftrag -- --name <kurzname> <abschnitt-id> [<abschnitt-id> …]`, Exit 2. Erfolg, Exit 0, Ausgabe wörtlich:
  ```
  lehrplan/<k>.yaml: <n> Abschnitt(e) beauftragt
    <id>
    …
  Nächster Schritt: Durchgang A — „Bau die Lektionen für <k>“.
  ```
  (Einzahl `1 Abschnitt beauftragt`, sonst `<n> Abschnitte beauftragt`.) Mängel: je eine Zeile, Exit 1.

### Tests

1. Ein Abschnitt `offen` → `beauftragt`; der übrige Text ist gleich (Vergleich Zeile für Zeile, genau eine geänderte Zeile).
2. CRLF-Text bleibt CRLF (Zahl der `\r\n` gleich, keine nackten `\n` dazu).
3. Drei Ids in einem Aufruf → drei geänderte Zeilen, `geaendert` in der Reihenfolge des Lehrplans.
4. Unbekannte Id → Mangel wörtlich, Text unverändert (auch die gültigen Ids nicht beauftragt).
5. Abschnitt `lektion` bzw. `abgelehnt` → Mangel wörtlich mit dem Status.
6. Repo-Lehrplan → Mangel wörtlich.
7. Keine Id → Mangel wörtlich.
8. Die echte Form des Gerüsts (mit `lehrplanGeruest` aus `werkzeug/lehrplan-geruest.mjs` erzeugt) → beauftragt, und `pruefeLehrplan` meldet danach „wartet“ mit Status `beauftragt` an den Abschnitten.
9. `beauftrageDatei` gegen ein Temp-Verzeichnis: Datei geändert; zweiter Aufruf mit derselben Id → Mangel „steht auf beauftragt …“, Datei byte-gleich.
10. `fuehreAus`: Ausgabe wörtlich und Exit 0; Aufruf-Hilfe und Exit 2; Mangel und Exit 1.

**Mutationsproben:** das Alles-oder-nichts entfernen → Test 4 rot; das Beibehalten der Zeilenenden entfernen → Test 2 rot.

- [ ] Tests rot → Code → grün; `npm test`, `npm run check`, `npm run build`; NUL; Commit: `feat: npm run auftrag - Abschnitte fuer den naechsten Durchgang beauftragen`.

---

## Aufgabe 3: Folien ansehen — `npm run ansicht`

**Dateien:** Neu `werkzeug/ansicht.mjs`, `tests/ansicht.test.ts`; ändern `werkzeug/manifest.mjs` (+ `liesDokumentManifest`), `tests/manifest.test.ts`, `package.json` (Skript `"ansicht": "node werkzeug/ansicht.mjs"`).

### Schnittstelle

```js
// werkzeug/manifest.mjs
/** Liest ein Manifest der Fassung 3 fuer die Werkzeuge. Wirft nie. */
export function liesDokumentManifest(text)
// → { ok: true, manifest: { stand, art, originale: {datei, seiten}[], roh: {id, datei, seiten:[von,bis], nurBild:number[], tabellenverdacht:number[]}[] } }
//   | { ok: false, grund: string }

// werkzeug/ansicht.mjs
export class AnsichtFehler extends Error {}
export function folienAuswahl(angabe, [von, bis]) // '16,19-23' → [16,19,20,21,22,23]; wirft AnsichtFehler
export async function rendereFolien({ wurzel, kurzname, abschnitt, folien, geladen, skala = 1.5 })
// → { bilder: { folie, pfad, breite, hoehe }[] }
export async function fuehreAus(argv, wurzel, schreibe = (z) => console.log(z))
```

### Verhalten

- `liesDokumentManifest`: JSON-Fehler → `grund: 'kein gültiges JSON'`; Fassung ≠ 3 → `grund: 'Fassung ${f}, erwartet 3'`; fehlende oder falsch geformte Felder → `grund: 'Fassung 3, aber unvollständig'`.
- `rendereFolien` liest `quellen/<k>/manifest.json` (Fehlt es: `quellen/<k>/manifest.json gibt es nicht — erst einlesen.`), sucht den Abschnitt in `roh` (`Abschnitt ${id} gibt es im Manifest nicht.`), öffnet `quellen/<k>/original/<datei>` (`Das Original ${datei} fehlt unter quellen/<k>/original/.`), rendert die gewünschten Folien (Standard: alle des Abschnitts) mit pdf.js und `@napi-rs/canvas` zu PNG nach `quellen/<k>/ansicht/<abschnitt>/folie-<n>.png`. Vorbild: `C:/Users/dno/AppData/Local/Temp/claude/kb2c/render-probe.mjs` (nur lesen).
- `@napi-rs/canvas` wird erst in `rendereFolien` geladen (`await import`); fehlt es: `Zum Ansehen fehlt @napi-rs/canvas — es kommt mit pdfjs-dist; bitte npm install ausführen.`
- `folienAuswahl`: Zahlen und Bereiche, durch Komma getrennt; eine Folie außerhalb des Abschnitts → `Folie ${n} liegt nicht in diesem Abschnitt (Folien ${von}–${bis}).`; unlesbare Angabe → `--folien versteht Angaben wie 16,19-23.`
- `fuehreAus`: `npm run ansicht -- --name <k> <abschnitt> [--folien …]`; Aufruf-Hilfe `Aufruf: npm run ansicht -- --name <kurzname> <abschnitt-id> [--folien 16,19-23]` (Exit 2). Ausgabe je Bild eine Zeile `quellen/<k>/ansicht/<abschnitt>/folie-<n>.png — <breite> × <höhe>`, am Ende `<n> Folie(n) gerendert.` (Einzahl `1 Folie gerendert.`). Fehler als `AnsichtFehler`, eine Zeile, Exit 1.

### Tests (`tests/ansicht.test.ts`, `// @vitest-environment node`, pdf.js einmal in `beforeAll`)

Aufbau: In einem Temp-Verzeichnis mit `leseFolienEin` einen Fixture-Foliensatz einlesen (`tests/fixtures/folien-agenda.pdf`), dann rendern.
1. Eine Folie → Datei existiert, beginnt mit der PNG-Signatur `89 50 4E 47 0D 0A 1A 0A`, Breite × Höhe aus dem IHDR gleich dem Ergebnis (bei Skala 1,5 für das Querformat der Fixtures).
2. Ohne `folien` → alle Folien des Abschnitts.
3. `folienAuswahl('2,4-5', [1, 10])` → `[2, 4, 5]`; außerhalb → Meldung wörtlich; `'x'` → Meldung wörtlich.
4. Unbekannter Abschnitt, fehlendes Manifest, fehlendes Original → Meldung wörtlich.
5. `fuehreAus`: Ausgabe wörtlich, Exit 0/1/2.
6. `liesDokumentManifest` (in `tests/manifest.test.ts`): das Manifest aus `baueDokumentManifest` → `ok`; kaputtes JSON, Fassung 2, fehlendes `roh` → jeweils der Grund wörtlich.

Laufzeit der Testdatei messen und berichten (Frist 20 s je Test).

**Mutationsprobe:** die Bereichsprüfung in `folienAuswahl` entfernen → Test 3 rot.

- [ ] Tests rot → Code → grün; `npm test`, `npm run check`, `npm run build`; NUL (PNG ausgenommen); `git status --short` zeigt nichts unter `quellen/`; Commit: `feat: npm run ansicht - Folien des Originals als PNG`.

---

## Aufgabe 4: Der 12-Wort-Abgleich in `pruefe-lektion`

**Dateien:** Neu `werkzeug/wortlaut.mjs`, `tests/wortlaut.test.ts`; ändern `werkzeug/pruefe-lektion.mjs`, `tests/pruefe-lektion.test.ts`.

Grundlage ist der Prototyp `C:/Users/dno/AppData/Local/Temp/claude/kb2c/wortlaut.mjs` (nur lesen; Wortbildung, Folien, Lektionsfelder, Funktionswörter, Fenster). Übernimm die Regel aus Präzisierung 9 und nur sie — keine Varianten-Schalter.

### Schnittstelle (`werkzeug/wortlaut.mjs`)

```js
export const FENSTER = 13;               // "mehr als zwoelf Woerter"
export const MINDEST_FUNKTIONSWOERTER = 3;
export const FUNKTIONSWOERTER;           // Set, aus dem Prototyp, im Code begruendet
export function woerter(text)            // → { w: string, zahl: boolean }[]
export function rohFolien(text)          // → { nummer: number, text: string }[]  (ohne Kopf, Marken, WARNZEILE, NUR_BILD_ZEILE)
export function lektionFelder(mdx)       // → { feld: string, text: string }[]   (YAML-Strings ausser typ/id/url; Rumpf ohne Widget-Aufrufe, Importe, Adressen, HTML)
export function baueIndex(quellen)       // quellen: { quelle, abschnitt, folien: {nummer,text}[] }[] → Index
export function findeAbschriften(felder, index) // → { feld, von, bis, quelle, abschnitt, folie }[]  (von/bis: Wortnummern im Feld, ab 1)
export function liesRohIndex(wurzel)     // quellen/*/roh/*.md → { index, dateien: number } | null (keine Rohdateien)
```

### Verhalten

- Wörter: NFKC, unsichtbare Zeichen (weicher Trennstrich, Nullbreiten, BOM) entfernt, klein, ß → ss; Bindestrich-Kompositum = ein Wort; `1.200.000` = eine Zahl; Zahlen fallen vor der Fensterbildung heraus.
- Fenster: 13 aufeinanderfolgende Wörter innerhalb **einer** Folie bzw. **eines** Felds; ein Fenster zählt nur mit mindestens 3 verschiedenen Funktionswörtern.
- Rohdateien ohne Seitenmarken (Git-Quellen) sind eine Einheit mit Folie `0`.
- `pruefe-lektion`: nimmt eine oder mehrere Dateien. Nach der bisherigen Prüfung (Schema, Widgets) der Wortlaut: `liesRohIndex(process.cwd())` einmal je Aufruf. Treffer sind Mängel, wörtlich (nie Text): `Wortlaut: 13 Wörter am Stück wie in ${quelle}/${abschnitt}, Folie ${folie} — Feld ${feld}, Wörter ${von}–${bis}.` (Folie `0` → `…${abschnitt} — Feld …` ohne Folie). Ohne Treffer zusätzlich die Zeile `Wortlaut: in Ordnung (${n} Rohdateien).`; ohne Rohdateien `Wortlaut nicht geprüft: keine Rohdateien am Rechner.` — das ist kein Mangel. Die reine Funktion `pruefeLektionsText(text)` bleibt unverändert; neu `pruefeWortlaut(text, index)`.
- Laufzeit: gemessen ≈ 0,2 s für den Index über alle Rohdateien.

### Tests (`tests/wortlaut.test.ts`, synthetische Rohdateien, kein `quellen/`)

1. `woerter`: NFKC (`ﬁ` → `fi`), Großschreibung, `ß`, weicher Trennstrich, `Detail-Pauschalvertrag` = ein Wort, `Bau- und Ausbau` = drei Wörter, `1.200.000` = eine Zahl.
2. `rohFolien`: Kopf, Marken, `WARNZEILE`, `NUR_BILD_ZEILE` fallen weg; Folien getrennt mit Nummer.
3. Ein 13-Wort-Satz mit ≥ 3 Funktionswörtern aus Folie 5 steht wörtlich im Rumpf einer Lektion → ein Treffer mit `folie: 5`, `feld: 'rumpf'` und dem Wortbereich.
4. Derselbe Satz mit 12 Wörtern → kein Treffer.
5. Derselbe Satz mit eingeschobener Zahl → Treffer; mit einem ersetzten Wort → keiner.
6. Derselbe Satz, auf zwei Felder verteilt → keiner; über zwei Folien der Quelle verteilt → keiner.
7. Eine Begriffskette aus 13 Wörtern ohne Funktionswort → kein Treffer.
8. Großschrift, NFD-Umlaute und ein Zeilenumbruch im Satz → Treffer.
9. Treffer in einem Frontmatter-Feld (`aufgaben[0].aufgabe`) → `feld` genau so benannt.
10. `liesRohIndex` ohne `quellen/` → `null`; mit zwei Quellen → `dateien: n`.

`tests/pruefe-lektion.test.ts`: 11. Kommandozeile mit einer Lektion und synthetischen Rohdateien unter einem Temp-Wurzelordner (Arbeitsverzeichnis des Unterprozesses) → Mangel wörtlich, Exit 1; ohne Treffer → `Wortlaut: in Ordnung (…)`, Exit 0; ohne `quellen/` → `Wortlaut nicht geprüft: …`, Exit 0; zwei Dateien in einem Aufruf.

**Mutationsproben:** den Funktionswort-Filter entfernen → Test 7 rot; Zahlen mitzählen → Test 5 rot; Fenster über Feldgrenzen → Test 6 rot.

- [ ] Tests rot → Code → grün; `npm test`, `npm run check`, `npm run build`; am echten Material einmal `npm run pruefe-lektion -- inhalt/lektionen/*.mdx` → fünfmal `in Ordnung` und `Wortlaut: in Ordnung (…)` (im Bericht nur diese Zeilen); NUL; Commit: `feat: pruefe-lektion - Wortlaut-Abgleich gegen die Rohdateien`.

---

## Aufgabe 5: Vor- und Nachprüfung — `npm run pruefe-quelle`

**Dateien:** Neu `werkzeug/pruefe-quelle.mjs`, `tests/pruefe-quelle.test.ts`; ändern `package.json` (Skript `"pruefe-quelle": "node werkzeug/pruefe-quelle.mjs"`).

### Schnittstelle

```js
/** Vor Durchgang A und vor Durchgang B. Rein ueber Texte. */
export function pruefeVor({ kurzname, lehrplanText, manifestText, lektionsIds, andere })
// andere: { datei: string, text: string }[] — die uebrigen lehrplan/*.yaml, fuer die Pruefung der Prinzip-Ids ueber alle Lehrplaene
// → { ok: boolean, maengel: string[], auftrag: { id, titel, datei, seiten:[von,bis], roh: string, nurBild: number[], tabellenverdacht: number[] }[] }

/** Nach Durchgang B. */
export function pruefeNach({ kurzname, lehrplanText, lektionsIds, wortlaut, andere })
// wortlaut: { ids: string[] mit Treffern je Lektion } oder null (nicht geprueft)
// → { ok: boolean, maengel: string[], hinweise: string[] }

export async function fuehreAus(argv, wurzel, schreibe = (z) => console.log(z))
```

### Verhalten und Wortlaute

`pruefeVor` — Mängel, wörtlich:
- Lehrplan fehlt: `lehrplan/${k}.yaml gibt es nicht — erst einlesen.`
- Lehrplan wartet: `Erst freigeben: lehrplan/${k}.yaml wartet auf Freigabe (geprueftVon und geprueftAm).`
- Lehrplan ungültig: je Mangel eine Zeile `lehrplan/${k}.yaml: ${mangel}`
- Repo-Lehrplan: `pruefe-quelle gilt für Lehrmaterial; lehrplan/${k}.yaml trägt art: repo.`
- Manifest fehlt / unlesbar: `quellen/${k}/manifest.json gibt es nicht — erst einlesen.` bzw. `quellen/${k}/manifest.json lässt sich nicht lesen (${grund}).`
- Stand: `Der Stand im Lehrplan (${kurzstand(lp)}) passt nicht zum Manifest (${kurzstand(m)}) — neu eingelesen? Dann den Lehrplan nachziehen.` (`kurzstand` aus `src/lib/bestandstext.ts`)
- Abschnitt fehlt im Manifest: `Abschnitt ${id} steht nicht im Manifest.`
- Datei nicht bytegenau im Manifest: `Abschnitt ${id}: die Datei ${JSON.stringify(datei)} steht nicht im Manifest.`
- kein Auftrag: `Kein Abschnitt ist beauftragt — erst npm run auftrag.`
- eine Prinzip-Id dieses Lehrplans steht auch in einem anderen Lehrplan (gültig oder wartend, alle übrigen `lehrplan/*.yaml`): `Prinzip ${id}: die Id steht schon in ${datei}; Lektion und Prinzip teilen sich die Id.` — so sieht der Compiler eine Doppelung, bevor Durchgang B die Lektion eines anderen Lehrplans überschreibt (die Seite prüft das nur beim Bau).

`auftrag` enthält je beauftragtem Abschnitt `roh: 'quellen/<k>/roh/<id>.md'` und die Folienlisten **aus dem Manifest**.

`pruefeNach` — Mängel, wörtlich:
- ein Abschnitt steht noch auf `beauftragt`: `Abschnitt ${id} steht noch auf beauftragt — jeder Abschnitt endet als lektion oder abgelehnt.`
- der Lehrplan ist ungültig (etwa eine Lektion fehlt): je Mangel `lehrplan/${k}.yaml: ${mangel}`
- eine Prinzip-Id steht auch in einem anderen Lehrplan: derselbe Satz wie bei `pruefeVor`.
- ein Wortlaut-Treffer: `Lektion ${id}: Wortlaut zu nah an der Quelle — npm run pruefe-lektion -- inhalt/lektionen/${id}.mdx zeigt die Stelle.`
- Hinweis (kein Mangel), wenn nicht geprüft: `Wortlaut nicht geprüft: keine Rohdateien am Rechner.`
- `pruefeNach` verlangt die Freigabe nicht erneut (sie wurde vor Durchgang B gesetzt), meldet einen wartenden Lehrplan aber als Mangel: `lehrplan/${k}.yaml wartet auf Freigabe — Durchgang B beginnt erst nach der Freigabe.`

`fuehreAus`: `npm run pruefe-quelle -- --name <k> --vor | --nach` (genau eines; sonst Aufruf-Hilfe `Aufruf: npm run pruefe-quelle -- --name <kurzname> --vor | --nach`, Exit 2). Liest Lehrplan, Manifest, Lektions-Ids aus der Wurzel; für `--nach` den Wortlaut über `liesRohIndex` und `findeAbschriften` für die Lektionen der Prinzipien dieses Lehrplans. Ausgabe bei Erfolg, wörtlich:

```
lehrplan/<k>.yaml: freigegeben, Stand passt zum Manifest.
Beauftragt: <n> Abschnitt(e)
  <id> — quellen/<k>/roh/<id>.md, Folien <von>–<bis> · nur Bild: <liste oder –> · Tabelle oder Grafik: <liste oder –>
```
bzw. für `--nach`: `lehrplan/<k>.yaml: kein Abschnitt mehr beauftragt, alle Lektionen da, Wortlaut in Ordnung.` (oder mit dem Hinweis „nicht geprüft“). Mängel: je eine Zeile, Exit 1. Folienlisten mit Komma (`16, 19, 20`); eine einzelne Folie `Folie 5` statt `Folien 5–5`.

### Tests (reine Funktionen mit synthetischen Texten; Kommandozeile gegen ein Temp-Verzeichnis)

1. Freigegebener Lehrplan, passendes Manifest, ein Abschnitt beauftragt → `ok`, `auftrag` mit Rohpfad und Listen aus dem Manifest.
2. Wartender Lehrplan → „Erst freigeben …“ wörtlich.
3. Stand anders → Meldung mit beiden Kurzständen.
4. Abschnitt fehlt im Manifest; Datei mit zwei Leerzeichen im Lehrplan, im Manifest mit einem → jeweils wörtlich (`JSON.stringify` zeigt die Leerzeichen).
5. Kein Abschnitt beauftragt → wörtlich.
6. Repo-Lehrplan → wörtlich.
6a. Eine Prinzip-Id, die auch in einem anderen Lehrplan steht (`andere`) → wörtlich, in `pruefeVor` und `pruefeNach`; ein anderer Lehrplan, der sich nicht lesen lässt, zählt nicht mit.
7. `pruefeNach`: ein Abschnitt noch `beauftragt` → wörtlich; alles `lektion`/`abgelehnt` mit vorhandenen Lektionen → `ok`; Wortlaut-Treffer → wörtlich; `wortlaut: null` → Hinweis, `ok`.
8. `fuehreAus` `--vor`: Ausgabe wörtlich, Exit 0; Aufruf-Hilfe Exit 2; Mangel Exit 1. `--nach` ebenso.

**Mutationsprobe:** die Prüfung „Datei bytegenau“ entfernen → Test 4 rot.

- [ ] Tests rot → Code → grün; `npm test`, `npm run check`, `npm run build`; am echten Lehrplan `npm run pruefe-quelle -- --name bauch-projektmanagement --vor` → „Erst freigeben …“ (oder, falls der Nutzer schon freigegeben hat, „Kein Abschnitt ist beauftragt …“), Exit 1; NUL; Commit: `feat: npm run pruefe-quelle - Vor- und Nachpruefung eines Durchgangs`.

---

## Aufgabe 6: Der Skill-Abschnitt „Durchgang für Lehrmaterial“ und das README

**Dateien:** Ändern `.claude/skills/kernbohrung-compiler/SKILL.md`, `README.md`; neu `tests/skill-befehle.test.ts`.

### SKILL.md

1. Im Frontmatter `description` ergänzen: `… Für Lehrmaterial (Folien, Bücher): „Bau die Lektionen für ‹kurzname›“ — Durchgang für Lehrmaterial.` (Rest wörtlich.)
2. In „B2 · Die sechs Takte“ die beiden Zellen „bis der Skill die übrigen Typen lernt: `typ: wahl`“ ersetzen durch „`typ`: `wahl`, `fall`, `zuordnen` oder `reihenfolge` — was wozu passt, steht unter „Aufgabentypen wählen“ im Durchgang für Lehrmaterial“.
3. Vor „## Was du nie tust“ den folgenden Abschnitt einfügen, **wörtlich**:

````markdown
---

## Durchgang für Lehrmaterial (art: folien, später buch)

Auslöser: **„Bau die Lektionen für ‹kurzname›“**, wenn `lehrplan/<kurzname>.yaml` `art: folien` (oder `buch`) trägt. Der Ablauf ist derselbe wie oben — Durchgang A, Review-Gate, Durchgang B —, mit fünf Unterschieden: Es gibt keine Obergrenze je Quelle, sondern höchstens drei Prinzipien je Abschnitt. Gearbeitet wird nur an Abschnitten mit `status: beauftragt`. Eine Folie nennt, der Vortrag erklärt — und der Vortrag fehlt. Was der Text nicht hergibt, siehst du im Original an. Und am Ende steht kein Abschnitt mehr auf `beauftragt`.

### L0 · Der Auftrag

Den Auftrag gibt der Mensch, nicht du:

```bash
npm run auftrag -- --name <kurzname> <abschnitt-id> [<abschnitt-id> …]
```

Steht kein Abschnitt auf `beauftragt`, frag, welche es sein sollen, und warte.

### L1 · Vorprüfung

```bash
npm run pruefe-quelle -- --name <kurzname> --vor
```

Sie verlangt die Freigabe des Lehrplans, einen Stand, der zum Manifest passt, und mindestens einen beauftragten Abschnitt. Sie nennt je Abschnitt die Rohdatei, den Folienbereich und die Folien, die nur Bild sind oder eine Tabelle oder Grafik tragen. **Nimm diese Listen von hier**, nicht aus den Hinweiszeilen der Rohdatei. Meldet sie Mängel, halte an und leg sie vor.

### L2 · Die Rohdatei lesen — ganz

`quellen/<kurzname>/roh/<abschnitt-id>.md` enthält den Text je Folie hinter Marken wie `— Folie 31 —`. Lies sie vollständig. Der Text ist bereinigt: Briefkopf und Foliennummern sind entfernt, Silbentrennung ist zusammengezogen. Er ist aber zeilenweise aus dem PDF gelesen. Nebeneinanderstehende Textfelder stehen deshalb hintereinander.

### L3 · Die Folien ansehen

```bash
npm run ansicht -- --name <kurzname> <abschnitt-id> --folien <liste>
```

Das Werkzeug rendert die Folien nach `quellen/<kurzname>/ansicht/<abschnitt-id>/folie-<n>.png`; lies die Bilder mit Read. Ansehen musst du:

- jede Folie aus den Listen der Vorprüfung — nur Bild, Tabelle oder Grafik;
- **jede Folie, auf die sich ein Prinzip stützt.** Gemessen: 22 Folien der ersten Vorlesung tragen viel Vektorgrafik und stehen in keiner Liste. Wer nur den Text liest, übersieht dort die Hälfte.

**Eine Lektion über eine Folie, die du nicht angesehen hast, ist verboten.** Bleibt eine Bildfolie auch beim Ansehen ohne lernbare Aussage (Foto, Stimmungsbild), erwähnst du sie im Lehrplan nicht — sie ist eine Seite, kein Abschnitt.

### L4 · Stichworte sind keine Sätze

Eine Folie nennt, der Vortrag erklärt — und der Vortrag fehlt. Du darfst die Lücke mit gesichertem Fachwissen schließen. Kenntlich halten musst du das trotzdem:

- Was auf der Folie steht, belegst du mit dem Folienverweis.
- Was du ergänzt, braucht eine zweite, benannte Quelle — Norm, Gesetz, Standardwerk —, oder es bleibt weg.
- Im Zweifel ablehnen.

### L5 · Prinzipien je Abschnitt — höchstens drei

Die drei Prüfungen aus A5 gelten: mehrfach tragend, nicht offensichtlich, entscheidungsleitend. Je beauftragtem Abschnitt schreibst du in den Lehrplan:

```yaml
  - id: m07-03-risikomanagement
    …
    status: beauftragt
    prinzipien:
      - id: kleinbuchstaben-mit-bindestrich     # wird die Id der Lektion
        satz: "Ein Satz, der etwas behauptet. Höchstens 200 Zeichen."
        warumNichtOffensichtlich: "Die plausible Gegenposition, in einem Satz."
        belege: ["roh/m07-03-risikomanagement.md, Folien 31–33"]
        vorbehalt: "Nur, wenn die Quelle etwas ohne Beleg behauptet."   # sonst weglassen
```

- **Die Id des Prinzips wird die Id der Lektion.** Sie ist über alle Lehrpläne eindeutig; `npm run pruefe-quelle` meldet eine Doppelung.
- **Gibt es zu einem Prinzip schon eine Lektion ohne Lehrplaneintrag** (auf der Bibliotheksseite unter „Lektionen ohne Lehrplaneintrag“), übernimm ihre Id und ihren Satz, statt eine zweite zu planen. Heute gilt das für `pauschal-heisst-nicht-komplett` in `m07-03-risikomanagement`. Eine Lektion, die schon zu einem anderen Lehrplan gehört, überschreibst du nie.
- **`vorbehalt`**, wenn die Quelle etwas behauptet, das sich nicht belegen lässt oder dem Stand der Forschung widerspricht. Prüfungsstoff bleibt lernbar, ohne dass die App ihn als gesichert ausgibt. Eine Quelle für den Vorbehalt prüfst du, statt sie aus dem Gedächtnis zu zitieren (bei Studien die DOI gegen Crossref).
- **Ablehnen mit Grund**, wenn ein Abschnitt nichts Lernbares trägt — etwa reine Titelfolien oder nur Bildbeispiele ohne Aussage: `status: abgelehnt`, `grund: "…"`, keine Prinzipien.
- **Schreibfehler der Quelle** in Fachbegriffen: Die Lektion nutzt den richtigen Begriff, die Abweichung kommt als Notiz in die Herkunft.
- Ein Abschnitt über 20 Folien (heute nur `m07-02`) darf drei Prinzipien tragen, die verschiedene Folien abdecken. Was davon keines trägt, nennst du am Review-Gate als nicht verwertet.

Dann: `geprueftVon: ""` und `geprueftAm: ""` — **du leerst die Freigabe**, der Mensch setzt sie wieder. Prüfen mit `liesLehrplan` wie in A6. Der Lehrplan wartet dann auf Freigabe; das ist richtig.

### L6 · Das Review-Gate

Wie oben, dazu je Abschnitt: welche Folien du angesehen hast, was davon keines der Prinzipien trägt und warum, und jeden `vorbehalt` mit seiner Quelle. Halte an, bis der Mensch zugestimmt **und `geprueftVon` gefüllt** hat.

### L7 · Durchgang B — eine Lektion je Prinzip

Zuerst wieder `npm run pruefe-quelle -- --name <kurzname> --vor`. Dann je Prinzip eine Lektion, eine nach der anderen, wie in B1 bis B7:

- `inhalt/lektionen/<prinzip-id>.mdx`, `prinzip` ist der Satz des Prinzips, `vorbehalt` wandert mit.
- **Kein Widget nötig.** Takt 1, der Widerspruch, ist Prosa im Rumpf; die Aufgaben tragen die Interaktion. Vorbild: `inhalt/lektionen/pauschal-heisst-nicht-komplett.mdx`.
- `quellen`: die Vorlesung mit Modul und Folienbereich, etwa `"Vorlesung Projektmanagement (Prof. Bauch, WBA Weimar 2026), Modul 7 Risikomanagement, Folien 31–33"`, und jede zweite Quelle, auf die du dich stützt (mit `url`, wo es eine gibt).
- **Eigene Worte.** `pruefe-lektion` weist eine Lektion zurück, die dreizehn Wörter am Stück aus einer Rohdatei übernimmt. Wer umformuliert, weil die Prüfung anschlägt, hat zu nah an der Folie geschrieben — schreib den Absatz neu, statt Wörter zu tauschen.

#### Aufgabentypen wählen

| Stoff | Typ |
|---|---|
| ein Sachverhalt, an dem man die Regel anwendet (Praxisfall, Vertragsstreit) | `fall` — Pflicht-Prüfpunkte sind die, ohne die die Lösung falsch ist, nicht die, die schön wären |
| Begriffspaare, Zuordnungen (Vertragsart ↔ Vergütung) | `zuordnen` — Ablenker, die jemand wirklich zuordnen würde |
| Verfahren, Stufen, Phasen | `reihenfolge` |
| Abgrenzungen, Entscheidungen | `wahl` — B3 gilt unverändert |

Zwei bis sechs Aufgaben, dazu der Transfer (B4) auf einen Fall, der in der Vorlesung nicht vorkommt.

### L8 · Abschluss

Nach jeder Lektion: `pruefe-lektion` (B5), dann `mv` nach `inhalt/lektionen/`. Sind alle Prinzipien eines Abschnitts gebaut, setzt du dort `status: lektion`. Am Ende:

```bash
npm run pruefe-quelle -- --name <kurzname> --nach
npm run build
```

`--nach` verlangt: kein Abschnitt mehr `beauftragt`, jede Lektion da, der Wortlaut sauber. Danach Nachschauen wie in B7.
````

### README.md

In der Befehlstabelle drei Zeilen (nach `npm run ingest`):
`| npm run auftrag -- --name <k> <abschnitt> … | Abschnitte für den nächsten Durchgang beauftragen |`
`| npm run ansicht -- --name <k> <abschnitt> | Folien des Originals als PNG unter quellen/<k>/ansicht/ |`
`| npm run pruefe-quelle -- --name <k> --vor \| --nach | Vor- und Nachprüfung eines Compiler-Durchgangs |`
Im Abschnitt „Eine Quelle einlesen“ am Ende ein Absatz: `Nach der Freigabe beauftragst du Abschnitte (npm run auftrag) und sagst Claude Code „Bau die Lektionen für <kurzname>". Der Ablauf steht im Compiler-Skill unter „Durchgang für Lehrmaterial".`

### Test (`tests/skill-befehle.test.ts`)

1. Jeder `npm run <name>`-Aufruf in `SKILL.md` und in der Befehlstabelle des README hat ein gleichnamiges Skript in `package.json` (hält Skill, README und Skripte zusammen).
2. `SKILL.md` enthält die Überschriften `## Durchgang für Lehrmaterial` und die Unterüberschriften L0–L8 in dieser Reihenfolge.

**Mutationsprobe:** ein Skript in einer Kopie der Skripte fehlen lassen (im Test über eine Hilfsfunktion, die Text und Skripte bekommt) → Test 1 rot.

- [ ] Test rot → Text einfügen → grün; `npm test`, `npm run check`; NUL; Commit: `docs: Compiler-Skill - Durchgang fuer Lehrmaterial, README mit den neuen Befehlen`.

---

## Aufgabe 7: Abnahme (Hauptsitzung)

**Dateien:** keine Quelldateien; eine Behebung bekommt einen eigenen Commit.

- [ ] **Schritt 1:** `npm test` (BASIS + Summe der Zuwächse), `npm run check` (0/0/0), `npm run build` (SEITEN), NUL über `git diff --name-only master...HEAD` ohne PDF/PNG, `grep -rlE 'warumNichtOffensichtlich|"rubrik"|sha256:[0-9a-f]{64}' dist/ || echo "kein Rohtext im Bau"`.
- [ ] **Schritt 2:** Karte bei 375 px: vorübergehend `lehrplan/zz-abnahme.yaml` anlegen — `art: folien`, Freigabe gesetzt, vier Abschnitte in den vier Status, der `lektion`-Abschnitt mit den Prinzipien `pauschal-heisst-nicht-komplett` und `recall-vor-precision` (beide Lektionen gibt es, keiner anderen Lehrplan-Id gleich). Bauen, Vorschau `kernbohrung-bau`, messen: Zeile mit zwei Verweisen (je ≥ 44 px, eine Quelltextzeile, kein Überlauf), „Lektionen ohne Lehrplaneintrag“ verschwindet (beide Lektionen haben jetzt einen Eintrag), `ueberlauf: 0`. Danach Datei löschen, neu bauen, `git status --short` leer.
- [ ] **Schritt 3:** Am echten Material: `npm run pruefe-quelle -- --name bauch-projektmanagement --vor` → „Erst freigeben …“ (oder „Kein Abschnitt ist beauftragt …“, falls schon freigegeben); `npm run ansicht -- --name bauch-projektmanagement m07-03-risikomanagement --folien 31` → ein PNG, 1263 × 893; `npm run pruefe-lektion -- inhalt/lektionen/*.mdx` → fünfmal in Ordnung, `Wortlaut: in Ordnung (…)`.
- [ ] **Schritt 4:** Handy-Kopie wie bisher (`handy/`, `werkzeug/relative-verweise.mjs`); das private Artifact aktualisiert die Hauptsitzung.
- [ ] **Schritt 5:** `git status --short` leer, `git log --oneline master..bibliothek-2c1`; Zusammenführen entscheidet der Nutzer (`superpowers:finishing-a-development-branch`).

## Nachträge aus den Reviews und der Abnahme (2026-09-26)

Jede Aufgabe ist einzeln reviewt; dazu kamen eine Planänderung und sieben Nacharbeiten. Die folgenden Abweichungen vom Plan oben sind beschlossen und getestet; maßgeblich sind seither der Code, seine Tests und `SKILL.md`, nicht der Text oben. Der Commit steht in Klammern.

**Planänderung aus dem Review von Aufgabe 1**
- Die Eindeutigkeit der Prinzip-Ids über alle Lehrpläne prüfte nur die Seite beim Bau; im Compiler-Ablauf sah jede Prüfung nur einen Lehrplan. Seither prüft `pruefe-quelle --vor` und `--nach` gegen alle übrigen `lehrplan/*.yaml`, und eine vorhandene Lektion wird nur übernommen, wenn sie keinen Lehrplaneintrag hat (a29d7c1).

**Lehrplan und Karte**
- Bei doppelter Prinzip-Id haben freigegebene Lehrpläne Vorrang vor wartenden. Vorher entschied allein die Pfad-Reihenfolge, und ein wartender Lehrplan mit früherem Dateinamen machte einen freigegebenen ungültig. Wer dabei selbst ungültig wird, gibt seine übrigen Ids frei (bfee410).
- Die Warnung „Lektionen ohne Lehrplaneintrag“ nennt nur noch das Prinzip, keinen Abschnitt mehr (bfee410).

**Werkzeuge**
- `ansicht`: `datei` aus dem Manifest muss ein bloßer Dateiname sein; sonst Abbruch statt Lesen außerhalb von `quellen/<k>/original/` (9d47403).
- `liesDokumentManifest` steht in `werkzeug/dokument-manifest.mjs`, nicht in `manifest.mjs` wie in Aufgabe 3: So lädt `manifest.mjs` kein Zod, und das Einlesen aus Git auch nicht (9d47403).
- `auftrag`: erkennt `status: offen` auch in Anführungszeichen und mit Kommentar und behält die Form; ohne eindeutige Statuszeile ein Mangel statt eines Stapelabzugs; ENOENT und andere Lesefehler mit eigener Meldung (9d47403).
- Wortlaut: Ein Kompositum, das am Zeilenende umbricht, ist ein Wort — außer vor einem Bindewort und in einer Kette mit Ergänzungsstrichen. Apostroph-Varianten werden vor NFKC vereinheitlicht, HTML-Entitäten im Rumpf aufgelöst. Fenster mit weniger als drei verschiedenen Funktionswörtern fallen schon beim Indexieren weg (f682758, 2d7b054).
- `pruefe-lektion`: Eine fehlende oder unlesbare Datei wird einzeln gemeldet, die übrigen werden weiter geprüft. Exit 1 (Mangel) geht vor 2 (Datei fehlt) vor 0. Den Importkreis mit `wortlaut.mjs` löst `werkzeug/lektion-lesen.mjs` auf (f682758, 2d7b054).
- `pruefe-quelle`: Bei gleichem Stand gleicht `--vor` Seitenbereiche und Abschnitte mit dem Manifest ab, denn der Stand hasht nur die Originale — ein Neueinlesen mit anderer Gliederung ließe ihn gleich. `--nach` meldet „Wortlaut: in Ordnung“ nur mit den eigenen Rohdateien, liest bei ungültigem Lehrplan die Prinzip-Ids aus dem rohen YAML und bricht bei Dateifehlern mit einem Satz statt eines Stapelabzugs ab (ee4a488).

**Skill und README — drei Review-Runden**
- Das Frontmatter des Skills war durch „: “ in der Beschreibung kein YAML mehr; Claude Code listete den Skill danach ohne Beschreibung und ohne Auslöser. Der Fehler stand schon in Aufgabe 6. Ein Test liest das Frontmatter jetzt mit js-yaml (dfecb0c).
- Der Durchgang für Lehrmaterial ist gegenüber Aufgabe 6 geschärft (dfecb0c, badaa5e, 7a21afb):
  - A1 bis A4 entfallen, L5 tritt an die Stelle von A6. Die Listen aus L1 sind unvollständig: Vektorgrafik erfassen sie nur als Liniengitter.
  - `--vor` läuft schon nach L5. Außer „Erst freigeben …“ darf nichts kommen; sind alle beauftragten Abschnitte abgelehnt, auch „Kein Abschnitt ist beauftragt …“.
  - Eine übernommene Lektion wird nur geprüft; ändern darf sie nur der Mensch oder der Compiler auf sein ausdrückliches Wort. Verschoben wird nur, wenn es die Zieldatei noch nicht gibt.
  - `reihenfolge` zählt fortlaufend. `quellen` steht als `pfad` und `url`; ein Schreibfehler der Quelle wird Zusatz im `pfad`, denn ein Feld `notiz` fiele still weg.
  - Nach der Freigabe streicht nur der Mensch, und die Freigabe bleibt stehen; geleert wird sie nur in L5.
  - Folienbilder und Folientext werden nie weitergegeben: Die PNG bleiben unter `quellen/`.
- README: Befehle in Backticks — die Platzhalter fielen als HTML-Tags weg —, Takte und Aufgabentypen auf dem Stand der Aufgabenfamilie (dfecb0c, badaa5e).
- Ein Test prüft jede Option hinter `npm run <name> --` in SKILL.md und README gegen die Einstiegsdatei des Werkzeugs. Er fängt Tippfehler in der Anleitung, nicht ein Werkzeug, das eine Option verliert (dfecb0c, badaa5e).

**Zahlen am Ende**
- 1169 Tests in 56 Dateien = BASIS 1009 + 160; `astro check` 0/0/0; Bau 9 Seiten; keine NUL-Bytes in den geänderten Textdateien; kein Rohtext im Bau.
- Abnahme bei 375 px mit einem synthetischen Lehrplan (vier Abschnitte in den vier Status, zwei Lektionen an einem Abschnitt): zwei Verweise in einer Zeile, 44 und 45 px hoch, Zeile ohne Überlauf, `ueberlauf: 0`, „Lektionen ohne Lehrplaneintrag“ verschwindet. Danach Datei gelöscht, Bau wieder 9 Seiten, Arbeitsbaum sauber.
- Am echten Material: `--vor` meldet „Erst freigeben …“ und „Kein Abschnitt ist beauftragt …“, Exit 1; `ansicht` rendert Folie 31 aus `m07-03-risikomanagement` zu 1263 × 893 px; `pruefe-lektion` über alle fünf Lektionen in Ordnung, Wortlaut gegen 46 Rohdateien sauber. Private Handy-Version 12.

**Für 2c-2 zusätzlich zu den offenen Fragen unten**
- `--vor` sieht Lektionen ohne Lehrplaneintrag nicht. Eine Prinzip-Id, unter der es schon eine Lektion gibt, wählt der Compiler nur bei Übernahme; heute betrifft das neben `pauschal-heisst-nicht-komplett` auch `recall-vor-precision`.
- Veröffentlichung weiter nur von Hand: Ein Lauf des Pages-Workflows machte die Abschnittstitel und den Namen des Dozenten öffentlich, ab 2c-2 auch Lektionen aus der Vorlesung.

---

## Selbstprüfung gegen den Spec

| Spec | Aufgabe |
|---|---|
| Auslöser „Bau die Lektionen für ‹kurzname›“ bei `art: buch | folien` | 6 (L0) |
| nur Abschnitte mit `status: beauftragt`; Auftrag ist Datenform | 2, 6 (L0, L1) |
| Rohdatei lesen, Prinzipien destillieren, höchstens drei je Abschnitt | 1 (Schema), 6 (L2, L5) |
| Lektion mit den Aufgabentypen aus Teilprojekt 1 | 6 (L7, „Aufgabentypen wählen“) |
| ablehnen mit Grund | 1 (Regel), 6 (L5) |
| Seiten unter `nurBild`/`tabellenverdacht` im Original ansehen; keine Lektion über ungesehene Folien | 3, 5 (Listen), 6 (L3) |
| Stichworte sind keine Sätze; Ergänzungen mit zweiter Quelle | 6 (L4, L7) |
| `vorbehalt`, Quellen geprüft | 1 (Schema vorhanden), 6 (L5) |
| Schreibfehler der Quelle | 6 (L5) |
| am Ende kein Abschnitt `beauftragt`; `pruefe-lektion` über neue Lektionen; `npm run build` | 5 (`--nach`), 6 (L8) |
| Review-Gate je Durchgang, Freigabe geleert | 6 (L5, L6) |
| Urheberrecht: Satz über zwölf Wörter wörtlich → zurückgewiesen; Fachbegriffe und kurze Wendungen gehen durch | 4, Präzisierung 9 |
| Nachweis `pruefe-lektion` | 4 (Tests 3–9, 11) |
| Lehrplan: `lektion` genau bei `lektion` | ersetzt durch Präzisierungen 1 und 2, Aufgabe 1 |

## Offene Fragen für 2c-2 (erster Durchgang an M7)

- Der Nutzer gibt `lehrplan/bauch-projektmanagement.yaml` frei (Gliederung ansehen, `geprueftVon`/`geprueftAm` eintragen) und beauftragt `m07-01-begriffsbestimmungen`, `m07-02-prozess-des-risikomanagements`, `m07-03-risikomanagement`.
- `m07-02` hat 21 Folien für höchstens drei Prinzipien; was keines trägt, wird am Review-Gate genannt.
- Die Pauschal-Lektion wird Prinzip in `m07-03`; `ohneLehrplan` enthält danach nur noch `recall-vor-precision`, der Bestandstest zieht nach.
- Laufzeit und Kosten des Ansehens: rund 1 500 Tokens je Folienbild; M7 hat 7 Bildfolien, 3 mit Tabelle oder Grafik und weitere mit Vektorgrafik.
