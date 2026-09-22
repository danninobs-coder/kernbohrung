# Kernbohrung — Bibliothek 2a: Der Bestand — Implementierungsplan

> **Für agentische Ausführung:** ERFORDERLICHER SUB-SKILL: `superpowers:subagent-driven-development` (empfohlen) oder `superpowers:executing-plans`. Schritte nutzen Checkbox-Syntax (`- [ ]`).

**Ziel:** Die Seite `/bibliothek` zeigt, was eingelesen ist und wie weit es in Lektionen steckt: eine Karte je Quelle mit Art, Stand, Zahlenzeile und dem, was die Quelle nicht hergibt, aufklappbar bis zum einzelnen Prinzip oder Abschnitt — und als Warnung jede Lektion, deren Herkunft kein Lehrplan kennt. Dafür wird der Lehrplan zur diskriminierten Union über `art` (Repo, Buch, Folien), und ein Prinzip bekommt den `vorbehalt`, den die Lektion sichtbar unter dem Satz zeigt.

**Architektur:** Vier Module unter `src/lib/`: `lehrplan.ts` (das Schema, Fassung 2 — es zieht aus `werkzeug/lehrplan.mjs` hierher, weil es jetzt auch die Seite und später der Browser lesen), `manifestauszug.ts` (was die Seite aus einem Manifest braucht), `abdeckung.ts` (die Verrechnung, rein) und `bestandstext.ts` (die Wortlaute, rein). `src/components/Bestand.astro` ordnet nur an; `src/pages/bibliothek.astro` liest die Dateien zur Bauzeit über `import.meta.glob` und reicht sie durch. Keine Insel, kein Skript: Aufgeklappt wird mit `details`. `werkzeug/lehrplan.mjs` behält nur das Lesen vom Datenträger.

**Stack:** Astro 7 (statisch), Zod 4 über `astro/zod`, `js-yaml`, Vitest — für zwei Darstellungstests mit dem Container von Astro. **Keine neue Abhängigkeit.**

**Spec:** `docs/superpowers/specs/2026-09-18-bibliothek-design.md` — die Abschnitte „Datenmodell: Lehrplan Fassung 2", „Abdeckung", aus „Die Seite `/bibliothek`" nur „Der Bestand", und der Nachweis dazu. **Nicht Teil dieses Plans:** 2b Einlesen (Adapter, Gliederer, Manifest Fassung 3, Dev-Endpunkte, Formular, Einlesen am echten Material) und 2c Compiler (Skill-Abschnitt für Lehrmaterial, Prüfung auf wörtliche Übernahme, erster Durchgang). Die Seite verspricht davon nichts, auch nicht als Platzhalter.

**Voraussetzung:** `master` ab `549a60e` — Aufgabenfamilie und 3a sind zusammengeführt.

**Nach der Ausführung (2026-09-22):** Der Plan steht hier im Stand vor der Ausführung. Was Reviews und Abnahme geändert haben — Wortlaute, Markup, schärfere Regeln —, steht in „Nachträge aus den Reviews und der Abnahme" vor der Selbstprüfung. Maßgeblich für Wortlaute und Regeln sind seither `src/lib/bestandstext.ts`, `src/lib/lehrplan.ts` und ihre Tests, nicht die Codeblöcke unten.

---

## Was jeder Ausführende wissen muss

Die Regeln 1 bis 13 stammen aus den Plänen der Aufgabenfamilie und von 3a und aus Fehlern, die in diesem Projekt tatsächlich passiert sind. 14 bis 17 sind neu; jede beruht auf einer Messung für diesen Plan.

1. **Das Arbeitsverzeichnis der Bash-Aufrufe wandert nicht mit.** Jeder Aufruf beginnt mit
   `cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && `.
2. **Niemals `git add -A` oder `git add .`** — immer die Dateien einzeln aufzählen.
3. **Commit-Nachrichten über `git commit -F - <<'MSG'`** und nur mit geraden Anführungszeichen. Deutsche Anführungszeichen in einer Bash-Zeichenkette zerlegen den Befehl. Letzte Zeile: die Co-Authored-By-Zeile, die die eigene Sitzung vorgibt. In den Befehlen unten steht an dieser Stelle `<CO-AUTHORED-BY>` — das wird **ersetzt**, nicht mitcommittet.
4. **Kein NUL-Byte in eine Datei.** Ein Agent hat einmal eines als Trennzeichen geschrieben; alle Tests blieben grün, aber Git führte die Datei fortan als Binärdatei. Prüfung am Ende jeder Aufgabe:
   `python -c "import sys; print(sum(open(f,'rb').read().count(b'\x00') for f in sys.argv[1:]))" <dateien>` → `0`.
5. **Relative Importe:** `src/lib/lehrplan.ts` wird unter reinem Node geladen — über `werkzeug/lehrplan.mjs`, vom Compiler-Skill — und trägt deshalb die Endung: `from '../widgets/pruefung.ts'`. Node löst relative Importe ohne Endung nicht auf; unter Vite liefe ohne Endung alles grün weiter (`tests/node-ladbarkeit-lehrplan.test.ts` fängt das). `abdeckung.ts`, `manifestauszug.ts` und `bestandstext.ts` lädt niemand unter Node; sie holen sich von ihren Nachbarn nur Typen, ohne Endung. Eine `.astro`-Datei bindet `.astro`-Komponenten mit Endung ein, Module aus `src/lib/` ohne.
6. **Nichts aus diesem Plan läuft im Browser.** Die Seite rechnet zur Bauzeit; ins gebaute HTML kommt das Ergebnis, kein Skript und kein Rohtext aus Lehrplan oder Manifest. Typen immer mit `import type` — `verbatimModuleSyntax` verlangt es, und `astro check` meldet es sonst.
7. **TDD:** erst der fehlschlagende Test, dann die Umsetzung. Befehle: ein Test `npx vitest run tests/<datei>`, alle `npm test`, Typen `npm run check`, Bau `npm run build`.
8. **Farben nur über die vorhandenen Token** in `src/styles/global.css`. Ein Farbtoken darf nie nur in einem `@media`- oder `[data-theme]`-Block stehen. Dieser Plan führt kein neues Token ein und hängt in `global.css` nur an.
9. **Jede Bedienfläche mindestens 44 × 44 CSS-Pixel.** Gemessen wird am gebauten Stand bei 375 px, nicht geschätzt.
10. **Browserprüfung am gebauten Stand** (`preview_start` mit Name `kernbohrung-bau`, Port 4322), nicht am Dev-Server: Dessen Vite-Zwischenspeicher hat in diesem Projekt schon leere Inseln geliefert. Der Pane malt beim Scrollen unzuverlässig — mit `javascript_tool` messen, nicht mit Bildschirmfotos.
11. **Nie zwei Läufe gleichzeitig.** `npm test`, `npm run check` und `npm run build` teilen sich Zwischenspeicher und Ausgabeordner. Parallele Läufe — auch die eines anderen Agenten im selben Ordner — erzeugen Fehler, die es nicht gibt. Scheitert ein Lauf unerklärlich: einmal allein wiederholen, bevor du etwas „reparierst".
12. **Keine absoluten Gesamttestzahlen.** Aufgabe 0 notiert die Zahl der Tests als **BASIS** und die Seitenzahl des Baus als **SEITEN**. Dieser Plan nennt nur die Zahl je Testdatei und den Zuwachs.
13. **Wortlaute werden übernommen, nicht verbessert.** Jeder Satz, den die Seite oder die Lektion zeigt, steht unten fest — mit Umlauten — und ein Test hält ihn Zeichen für Zeichen. Bezeichner und Kommentare im Code bleiben wie im ganzen Projekt ohne Umlaute.
14. **Darstellungstests mit dem Container von Astro.** `experimental_AstroContainer` aus `astro/container` rendert eine `.astro`-Komponente ohne Bau. Die Testdatei braucht `// @vitest-environment node` — unter jsdom meldet Astro „No valid renderer". Für `LektionAnsicht.astro` mit ihren React-Inseln kommt der Renderer aus `@astrojs/react/container-renderer`; der gleichnamige Export aus `@astrojs/react` ist veraltet und kostet in `astro check` zwei Hinweise. Der erste Test einer solchen Datei braucht einige Sekunden für die Umwandlung — erwartet, und weit unter der Frist von 20 s.
15. **Astro löscht Leerraum mit Zeilenumbruch zwischen zwei Elementen.** `<span>…</span>` und `<a>…</a>` auf zwei Quelltextzeilen stehen im gebauten HTML ohne Leerzeichen aneinander — vorgelesen „mit LektionKein Boden…". Wo zwei Elemente mit Trennzeichen nebeneinander stehen, gehören sie samt Trennzeichen auf eine Quelltextzeile. Gemessen am 2026-09-22; ein Test hält es für die beiden Stellen fest.
16. **`quellen/` ist gitignored.** Kein Test darf es lesen — auf GitHub gibt es den Ordner nicht. Die Seite liest die Manifeste über `import.meta.glob('/quellen/*/manifest.json', …)`; fehlt der Ordner, liefert der Glob `{}` (gemessen). Die Abnahme baut einmal ohne Manifest, indem sie die Datei umbenennt — mit Sicherung und Vergleich danach.
17. **Tastendrücke im Browser-Pane:** Am 2026-09-22 kamen `key`-Aktionen des Panes als Ereignisse ohne Tastennamen an; `details` klappte davon nicht auf. Die Abnahme prüft deshalb, dass der Aufklappknopf in der Tab-Reihenfolge liegt und einen Fokusrahmen zeigt. Auf- und Zuklappen mit Enter und Leertaste ist eingebautes Verhalten von `summary`.

## Präzisierungen gegenüber dem Spec

An diesen Stellen ließ der Spec eine Entscheidung offen, oder die Umsetzung hat sie genauer gemacht. Dieser Plan ändert den Spec nicht; ob er nachgezogen wird, entscheidet die Hauptsitzung.

1. **Fehlt das Manifest, steht die Zeile trotzdem da — mit „unbekannt".** `quellen/` ist gitignored; beim Bau auf GitHub gibt es kein Manifest. Die Karte zeigt dann „Lücken: unbekannt — das Manifest liegt nur am Rechner, auf dem eingelesen wurde". Weglassen hieße: Die Karte sähe aus wie eine ohne Lücken — genau das Missverständnis, gegen das der Spec die Zeile verlangt („damit niemand den Bestand für vollständig hält"). Dieselbe Zeile mit eigenem Grund, wenn das Manifest unlesbar ist oder zu einem anderen Stand gehört (neu eingelesen, Lehrplan nicht nachgezogen): Eine Zahl aus dem falschen Manifest wäre schlimmer als keine.
2. **Bei Repos sind die Lücken die Auslassungen des Git-Adapters.** Der Spec nennt „was der Text nicht hergibt" nur für Bücher und Folien. Für ein Repo ist das Gegenstück die Auslassungsliste des Manifests — `werkzeug/manifest.mjs` begründet sie mit demselben Satz: Ohne sie hält der nächste Leser den Bestand für vollständig. Heute: „44 von 106 Dateien nicht übernommen".
3. **Das Schema zieht nach `src/lib/lehrplan.ts`.** Der Spec schreibt „`werkzeug/lehrplan.mjs` wird eine diskriminierte Union". Den Lehrplan lesen jetzt drei Stellen: der Compiler-Skill unter reinem Node, die Seite zur Bauzeit und — vorbereitet, nicht gebaut — ein Ausführer im Browser (Spec, „B vorbereitet": Statusfelder mit Zod-Schema). Im Browser gibt es kein `node:fs`, und `werkzeug/lehrplan.mjs` beginnt mit `readFileSync`. Das Schema folgt damit dem Muster von `src/content/schema.ts` und `src/widgets/pruefung.ts`; die Abhängigkeit läuft nur von `werkzeug/` nach `src/`, nie zurück. `werkzeug/lehrplan.mjs` behält `liesLehrplan` — der Aufruf im Compiler-Skill bleibt wörtlich derselbe.
4. **`vorbehalt`: ein Satz, sichtbar unter dem Satz.** Im Lehrplan-Prinzip und in `LektionSchema` optional, getrimmt, 1 bis 200 Zeichen — dasselbe Maß wie `prinzip`; ein leerer Vorbehalt ist ein Fehler, kein fehlender. In `LektionAnsicht.astro` steht er im Takt 3, unmittelbar unter `.prinzip`: `<p class="vorbehalt"><strong>Vorbehalt:</strong> …</p>`, in 16 px und Textfarbe auf `--flaeche` mit dem Randstreifen in `--akzent-fill` — dieselbe Sprache wie der Beipackzettel des Lernprofils, der ebenfalls „nicht im Kleingedruckten" stehen muss. Das Wort „Vorbehalt:" steht im Text und wird mit vorgelesen; eine ARIA-Rolle braucht es dafür nicht. Ohne Vorbehalt kein Element, auch kein leeres. In der Bibliothek steht derselbe Hinweis in der Zeile des Prinzips oder Abschnitts.
5. **Aufklappen mit `details` und `summary`, nicht mit einem Knopf und `aria-expanded`.** Die Seite ist statisch und soll es bleiben: `details` klappt ohne JavaScript auf, im Bau, auf GitHub und in der ortsunabhängigen Kopie für das Handy. Tastatur (Tab, Enter, Leertaste) und den Zustand „aufgeklappt/zugeklappt" für Screenreader bringt der Browser mit. Ein Knopf mit `aria-expanded` bräuchte ein Skript, das ausfallen kann — dann bliebe der Inhalt versteckt, oder der Knopf behauptete einen falschen Zustand. Die ganze `summary`-Zeile ist die Fläche, mindestens 48 px hoch (am Muster gemessen: 281 × 50 bei 375 px); `display: list-item` behält das Dreieck des Browsers, das mit `display: flex` verschwände.
6. **Der Weg zur Seite: ein Verweis am Fuß der Übersicht, neben „Dein Lernprofil", nicht in der Kopfleiste** — so, wie Plan 3a (Präzisierung 8) für das Profil entschieden hat. **Deren Begründung stimmt gemessen nicht mehr:** Bei 375 px ist die Kopfleiste schon heute zweizeilig — Marke 172 px + Abstand 16 + Umschalter 193 = 381 px bei 335 px Platz (am 2026-09-22 mit geladenen Schriften gemessen; 3a hatte 324 px gerechnet). Ein Eintrag „Bibliothek" (81 × 44 px) käme in die zweite Zeile neben den Umschalter und machte die klebende Leiste auf jeder Seite 6 px höher (109 → 115 px). Der Plan bleibt beim Fuß der Übersicht, weil der Auftrag es so vorgibt und `Seite.astro` dann unberührt bleibt. Ob die Bibliothek doch in die Kopfleiste soll, ist eine Frage an den Nutzer.
7. **`datei` ist in jedem Abschnitt Pflicht, nicht erst „bei mehreren Originalen".** Wie viele Originale es gibt, steht im Manifest, und das kennt das Schema nicht. Und der Compiler muss für jede Bildfolie wissen, welche Datei er öffnet. Das Einlesen (2b) kostet es ein Feld.
8. **„Die Datei muss existieren" prüft `pruefeLehrplan(daten, lektionsIds)`, nicht Zod.** Das Schema ist rein und kennt keine Dateien. `lektionsIds` reicht die Seite aus der Sammlung herein; `liesLehrplan` liest sie aus `inhalt/lektionen/`. Fehlt der Ordner, gibt es keine Lektion, und jeder Abschnitt mit `status: lektion` fällt durch — im Zweifel durch, nie durch.
9. **Ein Abschnitt ohne `prinzipien` hat eine leere Liste.** Das Einlesen legt Abschnitte ohne Prinzipien an; Durchgang A füllt sie. Achtunddreißig Zeilen `prinzipien: []` in einem frischen Lehrplan wären Rauschen.
10. **Ein ungültiger Lehrplan bricht den Bau nicht ab.** Er erscheint als Warnung „Lehrpläne, die die Prüfung nicht bestehen", mit seinen Mängeln und ohne Zahlen. Der wichtigste Fall ist kein Fehler: Zwischen Durchgang A und der Freigabe ist `geprueftVon` leer. Scheiterte daran der Bau, scheiterten auch die Veröffentlichung auf GitHub und jeder Bau für das Handy, solange ein Mensch noch liest. Die Lektionen eines solchen Lehrplans stehen dann unter „Lektionen ohne Lehrplaneintrag" — deshalb sagt die Warnung „eines gültigen Lehrplans".
11. **`abdeckung` liefert `{ bestand, ohneLehrplan }`.** Der Spec nennt `→ Bestand[]` und „liefert außerdem Lektionen ohne Lehrplaneintrag"; beides kommt aus einem Aufruf. `manifeste` ist eine Karte Kurzname → `Manifestauszug`, eine neutrale Form, die `manifestauszug.ts` aus dem Manifest liest. Gelesen wird heute Fassung 2 (Git); jede andere Fassung ist „unlesbar". Die Form für Bücher und Folien (`dokument`) steht schon im Typ, weil `abdeckung` sie verrechnet und getestet wird; den Leser für Manifest Fassung 3 bringt 2b mit.
12. **Ein Manifest zählt nur für den Stand seines Lehrplans:** `manifest.stand === lehrplan.stand`, und die Art muss passen — Git zu Repo, Dokument zu Buch und Folien.
13. **Heute gibt es zwei Lektionen ohne Lehrplaneintrag, nicht eine.** Der Spec nennt `recall-vor-precision`. Dazu kam `pauschal-heisst-nicht-komplett` — mit Absicht: Aufgabe 14 der Aufgabenfamilie hat sie „bewusst und befristet" ohne Eintrag angelegt, bis das Einlesen (2b) ihn nachträgt. Gemessen, siehe „Der heutige Bestand".
14. **Eigene Wortlaute, wo der Spec keine gibt oder mehr behauptet, als die Daten tragen:** „2 Tabellen vermutlich zerfallen" statt „zerfallen" (das Manifest führt einen Verdacht) · „Lücken:" als Einleitung der Zeile · „keine Folie nur Bild, keine zerfallene Tabelle erkannt" statt Schweigen · die drei Sätze mit „unbekannt —" · die Texte der beiden Warnungen, des leeren Bestands und des Vorspanns · „Alle Prinzipien" und „Alle Abschnitte" auf dem Knopf. In der Zahlenzeile stehen „mit Lektion" und „offen" immer, „beauftragt" und „abgelehnt" nur, wenn es sie gibt — ein Repo kennt beides nicht. Der Stand steht gekürzt da (`a13701e`, bei `sha256:` die sieben Zeichen danach), die Auflage so, wie sie im Lehrplan steht („3. Auflage").
15. **Mängel stehen auf der Seite wörtlich — deshalb mit Umlauten.** Bisher las sie nur der Compiler-Skill im Terminal; jetzt zeigt sie die Seite. Die drei Meldungen, die aus `werkzeug/lehrplan.mjs` umziehen und keinen Umlaut hatten, bekommen ihn: „höchstens 8 Prinzipien", „ist kein gültiges YAML", „lässt sich nicht lesen". Der Test „unterscheidet eine fehlende Datei von kaputtem YAML" prüft jetzt `not.toMatch(/YAML/)` — mit `gueltiges` hätte er nach der Umstellung nichts mehr gefangen.
16. **Die Seite liest mit `import.meta.glob`, nicht mit `node:fs`.** Die Muster beginnen an der Projektwurzel (`/lehrplan/*.yaml`, `/quellen/*/manifest.json`), gleich wo die Seite liegt, und im Entwicklungsmodus baut die Seite neu, wenn sich ein Lehrplan ändert. Gemessen: Schlüssel wie `/lehrplan/awesome-llm-apps.yaml`, Werte als Text, ein fehlender Ordner ergibt `{}`, und im gebauten `dist/` steht kein Rohtext aus Lehrplan oder Manifest.
17. **Reihenfolge auf der Seite:** die Karten nach Kurzname (eigener Vergleich statt `localeCompare`, wie im Ingest), darunter die ungültigen Lehrpläne, darunter die Lektionen ohne Lehrplaneintrag. Leer ist der Bestand nur, wenn es weder gültige noch ungültige Lehrpläne gibt: „Es liegt kein Lehrplan vor."
18. **Der Compiler-Skill bekommt nur, was `art` für Repos verlangt:** In A6 steht `art: repo` im Muster und der neue Ort des Schemas. Ohne die Zeile schriebe der Skill ab Aufgabe 1 Lehrpläne, die die Prüfung zurückweist. Der Abschnitt für Lehrmaterial kommt mit 2c.

## Der heutige Bestand — gemessen am 2026-09-22

| | |
|---|---|
| Lehrpläne | 1 — `lehrplan/awesome-llm-apps.yaml`, ohne `art` |
| Prinzipien | 6 |
| … mit Lektion (Id = Prinzip-Id) | 3 — `kein-boden-ist-ein-boden`, `kontrollfluss-folgt-modellstaerke`, `auslagern-nimmt-die-grundlage` |
| … offen | 3 — `vertrauen-ist-herkunft`, `belegbarkeit-steckt-in-der-struktur`, `abruf-und-erzeugung-sind-zwei-rechnungen` |
| Lektionen | 5 |
| … ohne Lehrplaneintrag | 2 — `pauschal-heisst-nicht-komplett`, `recall-vor-precision` |
| Vorbehalte | keiner |
| Manifest (nur am Rechner) | `quellen/awesome-llm-apps/manifest.json`: Fassung 2, Stand `a13701e…` (gleich dem Lehrplan), 62 übernommen, 44 ausgelassen |
| Kopfleiste bei 375 px | zweizeilig: Marke 172 px + 16 + Umschalter 193 = 381 px bei 335 px Platz |

Die Zahlen stehen als erwartete Werte in `tests/abdeckung.test.ts` („der heutige Bestand") und in der Abnahme. Aufgabe 0 misst sie vor dem ersten Schritt noch einmal.

## Dateistruktur

```
src/lib/
  lehrplan.ts         HOECHSTZAHL, HOECHSTZAHL_JE_ABSCHNITT, STATUS, ART_FEHLT, LehrplanSchema,
                      pruefeLehrplan, lehrplanAusYaml, lehrplaeneAusTexten; Typen Lehrplan,
                      Abschnitt, Prinzip, Status, Befund, Ungueltig        — Zod, unter Node und Vite
  manifestauszug.ts   Manifestauszug, leseManifestauszug, manifesteAusTexten — Zod, nur zur Bauzeit
  abdeckung.ts        abdeckung; Typen Abdeckung, Bestand, Zeile, Zaehlung, Luecken — rein
  bestandstext.ts     STATUS_TEXT, kurzstand, kopfzeile, zahlenzeile, lueckenzeile,
                      fundstelle, aufklapptext                             — rein, die Wortlaute
src/components/Bestand.astro     Karten, Warnungen, leerer Bestand — ordnet nur an        (neu)
src/pages/bibliothek.astro       liest zur Bauzeit und reicht an Bestand.astro           (neu)
src/pages/index.astro            + Verweis „Bibliothek" am Fuß                            (geändert)
src/content/schema.ts            + vorbehalt                                              (geändert)
src/layouts/LektionAnsicht.astro + der Vorbehalt unter dem Satz                           (geändert)
src/styles/global.css            + Block „Bibliothek und Vorbehalt"                      (nur angehängt)
werkzeug/lehrplan.mjs            nur noch liesLehrplan                                    (ersetzt)
lehrplan/awesome-llm-apps.yaml   + art: repo                                              (eine Zeile)
.claude/skills/kernbohrung-compiler/SKILL.md   A6: art: repo, Ort des Schemas             (geändert)
tests/
  lehrplan.test.ts          12 → 28 (+16)   lehrplan-lehrmaterial.test.ts    44 (neu)
  node-ladbarkeit-lehrplan.test.ts  1 (neu) content-schema.test.ts     12 → 15 (+3)
  lektion-vorbehalt.test.ts  2 (neu)        manifestauszug.test.ts           14 (neu)
  abdeckung.test.ts         19 (neu)        bestandstext.test.ts             23 (neu)
  bestand-ansicht.test.ts   11 (neu)        bibliothek-seite.test.ts          4 (neu)
  basis-pfad.test.ts        +2 (je ein Fall für Bestand.astro und bibliothek.astro)
```

Zusammen 139 neue Tests. `src/layouts/Seite.astro`, `src/tutor/`, `src/aufgaben/`, `src/profil/`, `werkzeug/manifest.mjs`, `werkzeug/adapter/git.mjs` und `werkzeug/ingest.mjs` bleiben unberührt.

---

## Aufgabe 0: Voraussetzungen, Zweig, Ausgangslage

**Dateien:** keine.

- [ ] **Schritt 1: Voraussetzungen prüfen**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && git status --short && git branch --show-current && git merge-base --is-ancestor 549a60e HEAD && echo "549a60e ist enthalten" && ls src/lib/lehrplan.ts src/pages/bibliothek.astro 2>&1 | grep -c "No such file" && (grep -c "^art:" lehrplan/awesome-llm-apps.yaml || true) && grep -c 'Dein Lernprofil</a></p>' src/pages/index.astro && grep -c 'werkzeug/lehrplan.mjs`; sieh dort nach' .claude/skills/kernbohrung-compiler/SKILL.md
```
Erwartet, in dieser Reihenfolge: keine Zeile von `git status` (sauberer Baum) · `master` · `549a60e ist enthalten` · `2` (keine der beiden neuen Dateien gibt es schon) · `0` (der Lehrplan trägt noch kein `art`) · `1` · `1`.

**Anhalten und melden, nicht weitermachen,** wenn der Baum nicht sauber ist, wenn `549a60e` fehlt, wenn eine der Zahlen abweicht. Die beiden letzten sind die Stellen, die Aufgabe 1 und Aufgabe 8 wörtlich ersetzen — stimmen sie nicht, passt der Plan nicht mehr zum Stand.

- [ ] **Schritt 2: Zweig anlegen**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && git switch -c bibliothek-2a
```
Erwartet: `Switched to a new branch 'bibliothek-2a'`.

- [ ] **Schritt 3: Ausgangslage festhalten**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && npm test 2>&1 | grep -E "Tests |Test Files |FAIL" && npm run check 2>&1 | grep -E "^- [0-9]+ (error|warning|hint)" && npm run build 2>&1 | grep -E "page\(s\)"
```
Erwartet: alle Tests bestanden, `- 0 errors`, `- 0 warnings`, `- 0 hints`, `<n> page(s) built`. **Notiere** die Zahl der bestandenen Tests als **BASIS** und die Seitenzahl als **SEITEN** — beide gehören in den Bericht dieser Aufgabe und werden in Aufgabe 8 und 10 gebraucht. Ist ein Test rot oder gibt es Typfehler: anhalten und melden.

- [ ] **Schritt 4: Den heutigen Bestand messen**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && node --input-type=module -e "
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { load } from 'js-yaml';
const lektionen = readdirSync('inhalt/lektionen').filter((d) => d.endsWith('.mdx')).map((d) => d.slice(0, -4)).sort();
const plaene = readdirSync('lehrplan').filter((d) => d.endsWith('.yaml')).sort();
const bekannt = new Set();
for (const datei of plaene) {
  const l = load(readFileSync('lehrplan/' + datei, 'utf8'));
  const mit = l.prinzipien.filter((p) => lektionen.includes(p.id)).map((p) => p.id);
  l.prinzipien.forEach((p) => bekannt.add(p.id));
  console.log(datei + ' | art: ' + (l.art ?? 'fehlt') + ' | ' + l.prinzipien.length + ' Prinzipien | mit Lektion: ' + mit.join(', '));
}
console.log('Lektionen: ' + lektionen.length + ' | ohne Lehrplaneintrag: ' + lektionen.filter((id) => !bekannt.has(id)).join(', '));
const m = 'quellen/awesome-llm-apps/manifest.json';
if (existsSync(m)) { const j = JSON.parse(readFileSync(m, 'utf8')); console.log('MANIFEST: vorhanden | Fassung ' + j.fassung + ' | ' + j.herkunft.sha.slice(0, 7) + ' | ' + j.summe.uebernommen + ' uebernommen, ' + j.summe.ausgelassen + ' ausgelassen'); } else console.log('MANIFEST: fehlt');
"
```
Erwartet, wörtlich:

```text
awesome-llm-apps.yaml | art: fehlt | 6 Prinzipien | mit Lektion: kein-boden-ist-ein-boden, kontrollfluss-folgt-modellstaerke, auslagern-nimmt-die-grundlage
Lektionen: 5 | ohne Lehrplaneintrag: pauschal-heisst-nicht-komplett, recall-vor-precision
MANIFEST: vorhanden | Fassung 2 | a13701e | 62 uebernommen, 44 ausgelassen
```

Weichen die ersten beiden Zeilen ab, hat sich der Bestand seit dem 2026-09-22 verändert: anhalten und melden — die Zahlen stecken in `tests/abdeckung.test.ts` und in der Abnahme. Steht dort `MANIFEST: fehlt`, **notiere es**: Dann gilt in Aufgabe 8 und 10 für den normalen Bau, was dort für den Bau ohne Manifest steht.

---

## Aufgabe 1: Lehrplan Fassung 2 für Repos — `art`, `vorbehalt` und der Umzug nach `src/lib/`

**Dateien:**
- Neu: `src/lib/lehrplan.ts`, `tests/node-ladbarkeit-lehrplan.test.ts`
- Ersetzen: `werkzeug/lehrplan.mjs`, `tests/lehrplan.test.ts`
- Ändern: `lehrplan/awesome-llm-apps.yaml` (eine Zeile), `.claude/skills/kernbohrung-compiler/SKILL.md` (Abschnitt A6)

Die Union hat in dieser Aufgabe ein Mitglied, `repo`; Buch und Folien kommen in Aufgabe 2 dazu. Deshalb nennt die Meldung zu `art` hier nur Repos — Aufgabe 2 erweitert sie. `pruefeLehrplan` nimmt die Lektion-Ids schon jetzt entgegen, damit Aufgabe 2 keinen Aufrufer umbauen muss; ein Repo prüft sie nicht.

- [ ] **Schritt 1: Die Tests des Lehrplans auf Fassung 2 richten**

`tests/lehrplan.test.ts` vollständig ersetzen durch:

```ts
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ART_FEHLT, HOECHSTZAHL, lehrplaeneAusTexten, pruefeLehrplan } from '../src/lib/lehrplan';
import { liesLehrplan } from '../werkzeug/lehrplan.mjs';

/**
 * Der Lehrplan ist das Review-Gate: Wer ihn kontrolliert, kontrolliert die App.
 *
 * Diese Datei prueft die Form fuer Repos — Fassung 1 plus `art` und
 * `vorbehalt` — und das Lesen: vom Datentraeger und aus den Texten, die die
 * Seite /bibliothek bekommt. Buch und Folien stehen in
 * `tests/lehrplan-lehrmaterial.test.ts`.
 *
 * Die beiden Schranken, an denen sich das entscheidet, stehen unten je fuer
 * sich: die Obergrenze (Durchgang A soll verdichten, nicht katalogisieren) und
 * `geprueftVon` (ohne menschliche Abnahme ist es kein Lehrplan).
 */

/** Fuer Repos spielt es keine Rolle, welche Lektionen es gibt. */
const KEINE = new Set<string>();

const gut = {
  art: 'repo',
  quelle: 'awesome-llm-apps',
  stand: 'a13701eae315a81e1011a4304a6b5e741ea0a984',
  geprueftVon: 'Daniel Nobs',
  geprueftAm: '2026-09-02',
  prinzipien: [
    {
      id: 'recall-vor-precision',
      satz: 'Recall entsteht beim Holen, Precision beim Sortieren.',
      warumNichtOffensichtlich: 'Beide zeigen sich als schlechte Treffer.',
      belege: ['corrective_rag'],
      widget: 'Pipeline',
    },
    {
      id: 'kontext-ist-knapp',
      satz: 'Das Kontextfenster ist ein Budget, kein Behaelter.',
      warumNichtOffensichtlich: 'Mehr Kontext klingt immer besser.',
      belege: ['autonomous_rag'],
      widget: 'Pipeline',
    },
  ],
};

/**
 * Liest die Maengel aus einem Ergebnis, das fehlschlagen musste.
 *
 * Wie in `tests/widget-pruefung.test.ts`: `expect(e.ok).toBe(false)` ueberzeugt
 * den Testlauf, verengt aber die Union nicht — `astro check` kennt `maengel`
 * danach immer noch nicht.
 */
function maengelVon(ergebnis: ReturnType<typeof pruefeLehrplan>): readonly string[] {
  if (ergebnis.ok) throw new Error('Erwartet war ein Fehlschlag, die Pruefung war aber zufrieden.');
  return ergebnis.maengel;
}

/** Legt einen Vorbehalt stumpf ueber das erste Prinzip — und ergaenzt nichts sonst. */
function mitVorbehalt(vorbehalt: unknown) {
  return { ...gut, prinzipien: [{ ...gut.prinzipien[0], vorbehalt }, gut.prinzipien[1]] };
}

describe('pruefeLehrplan - Repo', () => {
  it('nimmt einen gueltigen Lehrplan an', () => {
    const e = pruefeLehrplan(gut, KEINE);
    if (!e.ok) throw new Error(`Erwartet war Erfolg, gemeldet wurde:\n  ${e.maengel.join('\n  ')}`);
    if (e.lehrplan.art !== 'repo') throw new Error('Erwartet war ein Repo.');
    expect(e.lehrplan.prinzipien).toHaveLength(2);
  });

  it('weist einen Lehrplan ohne art zurueck und sagt, was einzutragen ist', () => {
    // Genau so sieht jeder Lehrplan aus Fassung 1 aus. Migration statt
    // stiller Voreinstellung: Die Meldung nennt die Zeile, die fehlt.
    const { art: _art, ...ohne } = gut;
    expect(maengelVon(pruefeLehrplan(ohne, KEINE))).toEqual([`art: ${ART_FEHLT}`]);
    expect(ART_FEHLT).toMatch(/art: repo/);
  });

  it('weist eine unbekannte art mit derselben Meldung zurueck', () => {
    expect(maengelVon(pruefeLehrplan({ ...gut, art: 'video' }, KEINE))).toEqual([`art: ${ART_FEHLT}`]);
  });

  // Als Paare aus Name und Wert: `it.each` breitet eine blanke Liste als
  // Argumente aus — eine leere Liste kaeme als „gar kein Argument" an.
  it.each([
    ['nichts', undefined],
    ['null', null],
    ['einem Text', 'text'],
    ['einer Zahl', 42],
    ['einer leeren Liste', []],
    ['einem leeren Objekt', {}],
  ])('macht aus %s einen Befund mit Maengeln, ohne zu werfen', (_name, daten) => {
    expect(maengelVon(pruefeLehrplan(daten, KEINE)).length).toBeGreaterThan(0);
  });

  it('verlangt mindestens zwei Prinzipien', () => {
    expect(pruefeLehrplan({ ...gut, prinzipien: [gut.prinzipien[0]] }, KEINE).ok).toBe(false);
  });

  it(`erlaubt hoechstens ${HOECHSTZAHL} Prinzipien — Verdichten ist die Aufgabe`, () => {
    const viele = Array.from({ length: HOECHSTZAHL + 1 }, (_, i) => ({
      ...gut.prinzipien[0],
      id: `prinzip-${i}`,
    }));
    const maengel = maengelVon(pruefeLehrplan({ ...gut, prinzipien: viele }, KEINE));
    expect(maengel.join(' ')).toMatch(/höchstens 8 Prinzipien — verdichten/);
  });

  it('lehnt doppelte Prinzip-Ids ab', () => {
    const doppelt = [gut.prinzipien[0], { ...gut.prinzipien[1], id: gut.prinzipien[0].id }];
    expect(pruefeLehrplan({ ...gut, prinzipien: doppelt }, KEINE).ok).toBe(false);
  });

  it('verlangt zu jedem Prinzip mindestens einen Beleg', () => {
    const ohne = [{ ...gut.prinzipien[0], belege: [] }, gut.prinzipien[1]];
    const maengel = maengelVon(pruefeLehrplan({ ...gut, prinzipien: ohne }, KEINE));
    expect(maengel.join(' ')).toMatch(/beleg/i);
  });

  it('verlangt einen Pruefer — der Lehrplan ist das Review-Gate', () => {
    const { geprueftVon: _weg, ...ohne } = gut;
    const maengel = maengelVon(pruefeLehrplan(ohne, KEINE));
    expect(maengel.join(' ')).toMatch(/geprueftVon/i);
    // Nicht nur der Feldname: Geprueft wird der Satz, der den Zweck des Gates
    // erklaert. Ohne ihn stuende hier Zods englisches „expected string,
    // received undefined" — ausgerechnet in dem Fall, fuer den der Satz
    // geschrieben wurde.
    expect(maengel.join(' ')).toMatch(/Review-Gate/);
  });

  it('lehnt den leeren und den nicht ausgefuellten Pruefer mit derselben Meldung ab', () => {
    // Durchgang A laesst `geprueftVon` leer; YAML macht daraus `null`. Genau
    // dieser Wert muss die Erklaerung ausloesen, nicht nur der fehlende Schluessel.
    for (const wert of ['   ', null, undefined]) {
      const maengel = maengelVon(pruefeLehrplan({ ...gut, geprueftVon: wert }, KEINE));
      expect(maengel.join(' ')).toMatch(/Review-Gate/);
    }
  });

  it('lehnt ein unbekanntes Widget ab', () => {
    const falsch = [{ ...gut.prinzipien[0], widget: 'GibtEsNicht' }, gut.prinzipien[1]];
    expect(pruefeLehrplan({ ...gut, prinzipien: falsch }, KEINE).ok).toBe(false);
  });

  it('lehnt Zusatzfelder ab, statt sie stillschweigend zu schlucken', () => {
    // Ein Feld, das niemand liest, ist der wahrscheinlichste Ort fuer eine
    // Behauptung, die spaeter niemand belegt.
    expect(pruefeLehrplan({ ...gut, notizen: 'nebenbei' }, KEINE).ok).toBe(false);
  });

  it('weist Titel und Abschnitte bei einem Repo zurueck — die gehoeren zu Buch und Folien', () => {
    expect(pruefeLehrplan({ ...gut, titel: 'Ein Titel' }, KEINE).ok).toBe(false);
    expect(pruefeLehrplan({ ...gut, abschnitte: [] }, KEINE).ok).toBe(false);
  });
});

describe('pruefeLehrplan - Vorbehalt', () => {
  it('nimmt ein Prinzip mit Vorbehalt an und gibt ihn zurueck', () => {
    const satz = 'Für diese Quoten gibt es keine belastbare Studie.';
    const e = pruefeLehrplan(mitVorbehalt(satz), KEINE);
    if (!e.ok) throw new Error(e.maengel.join('\n'));
    if (e.lehrplan.art !== 'repo') throw new Error('Erwartet war ein Repo.');
    expect(e.lehrplan.prinzipien[0]?.vorbehalt).toBe(satz);
    expect(e.lehrplan.prinzipien[1]?.vorbehalt).toBeUndefined();
  });

  it('weist einen Vorbehalt zurueck, der ein Absatz ist', () => {
    const absatz = 'Wort '.repeat(45).trim();
    expect(absatz.length).toBeGreaterThan(200);
    expect(maengelVon(pruefeLehrplan(mitVorbehalt(absatz), KEINE)).join(' ')).toMatch(
      /Ein Vorbehalt ist ein Satz, kein Absatz/,
    );
  });

  it('weist einen leeren Vorbehalt zurueck, statt ihn als keinen zu lesen', () => {
    // Ein leerer Vorbehalt ist ein Fehler beim Erzeugen, kein Vorbehalt.
    // Wer keinen hat, laesst das Feld weg.
    expect(maengelVon(pruefeLehrplan(mitVorbehalt('   '), KEINE)).join(' ')).toMatch(
      /Ein Vorbehalt braucht einen Satz/,
    );
  });
});

describe('liesLehrplan', () => {
  /** Legt eine Lehrplandatei an und raeumt sie wieder weg. */
  function mitDatei(inhalt: string, pruefe: (datei: string) => void): void {
    const ordner = mkdtempSync(path.join(tmpdir(), 'lehrplan-'));
    try {
      const datei = path.join(ordner, 'plan.yaml');
      writeFileSync(datei, inhalt, 'utf8');
      pruefe(datei);
    } finally {
      rmSync(ordner, { recursive: true, force: true });
    }
  }

  it('liest eine gueltige Lehrplandatei', () => {
    const yaml = `art: repo
quelle: awesome-llm-apps
stand: a13701eae315a81e1011a4304a6b5e741ea0a984
geprueftVon: Daniel Nobs
geprueftAm: 2026-09-02
prinzipien:
  - id: recall-vor-precision
    satz: "Recall entsteht beim Holen, Precision beim Sortieren."
    warumNichtOffensichtlich: "Beide zeigen sich als schlechte Treffer."
    belege:
      - corrective_rag
    widget: Pipeline
  - id: kontext-ist-knapp
    satz: "Das Kontextfenster ist ein Budget, kein Behaelter."
    warumNichtOffensichtlich: "Mehr Kontext klingt immer besser."
    belege:
      - autonomous_rag
    widget: Pipeline
`;
    mitDatei(yaml, (datei) => {
      const e = liesLehrplan(datei);
      if (!e.ok) throw new Error(`Erwartet war Erfolg:\n  ${e.maengel.join('\n  ')}`);
      expect(e.lehrplan.geprueftVon).toBe('Daniel Nobs');
      // Unquotiert notiert und trotzdem ein String: js-yaml 5 loest Datumsangaben
      // nicht zu Date-Objekten auf. Der Mensch am Review-Gate muss also nicht
      // an Anfuehrungszeichen denken.
      expect(e.lehrplan.geprueftAm).toBe('2026-09-02');
    });
  });

  /**
   * Am Review-Gate tippt ein Mensch `geprueftVon` von Hand in diese Datei.
   * Ein YAML-Tippfehler ist dort wahrscheinlich — er darf eine Maengelliste
   * ergeben und keinen nackten Stapelabzug.
   */
  it('meldet kaputtes YAML als Mangel, statt abzustuerzen', () => {
    mitDatei('quelle: "unbeendet\nstand: abc\n', (datei) => {
      const maengel = maengelVon(liesLehrplan(datei));
      expect(maengel.join(' ')).toMatch(/kein gültiges YAML/);
    });
  });

  /**
   * Eine fehlende Datei ist kein Syntaxfehler.
   *
   * Wuerden beide Faelle in einem catch landen, meldete der haeufigere von
   * beiden — der vertippte Pfad — „ist kein gueltiges YAML" und schickte den
   * Suchenden in die Datei statt auf den Pfad.
   */
  it('unterscheidet eine fehlende Datei von kaputtem YAML', () => {
    const maengel = maengelVon(liesLehrplan(path.join(tmpdir(), 'gibt-es-nicht-4711.yaml')));
    expect(maengel.join(' ')).toMatch(/lässt sich nicht lesen/);
    expect(maengel.join(' ')).not.toMatch(/YAML/);
  });
});

describe('lehrplaeneAusTexten', () => {
  /** Der gueltige Lehrplan oben als YAML-Text — JSON ist gueltiges YAML. */
  const yaml = (aenderung: Record<string, unknown> = {}) => JSON.stringify({ ...gut, ...aenderung });

  it('trennt gueltige von ungueltigen Lehrplaenen und nennt die Datei beim Namen', () => {
    const { gueltig, ungueltig } = lehrplaeneAusTexten(
      { '/lehrplan/gut.yaml': yaml(), '/lehrplan/kaputt.yaml': 'quelle: "unbeendet\n' },
      KEINE,
    );
    expect(gueltig.map((l) => l.quelle)).toEqual(['awesome-llm-apps']);
    expect(ungueltig.map((u) => u.datei)).toEqual(['kaputt.yaml']);
    expect(ungueltig[0]?.maengel.join(' ')).toMatch(/^kaputt\.yaml ist kein gültiges YAML/);
  });

  it('legt einen Lehrplan, der auf die Freigabe wartet, zu den ungueltigen — mit der Meldung des Gates', () => {
    // Genau der Zustand zwischen Durchgang A und dem Menschen: geprueftVon ist
    // leer. Der Bau soll daran nicht scheitern; die Seite zeigt ihn als Warnung.
    const { gueltig, ungueltig } = lehrplaeneAusTexten({ '/lehrplan/wartet.yaml': yaml({ geprueftVon: '' }) }, KEINE);
    expect(gueltig).toEqual([]);
    expect(ungueltig).toEqual([
      { datei: 'wartet.yaml', maengel: ['geprueftVon: geprueftVon fehlt — der Lehrplan ist das Review-Gate.'] },
    ]);
  });

  it('sortiert nach Pfad, unabhaengig von der Reihenfolge der Eingabe', () => {
    const { ungueltig } = lehrplaeneAusTexten({ '/lehrplan/b.yaml': '{', '/lehrplan/a.yaml': '{' }, KEINE);
    expect(ungueltig.map((u) => u.datei)).toEqual(['a.yaml', 'b.yaml']);
  });

  it('liefert zwei leere Listen, wenn es keinen Lehrplan gibt', () => {
    expect(lehrplaeneAusTexten({}, KEINE)).toEqual({ gueltig: [], ungueltig: [] });
  });
});
```

Neu gegenüber der bisherigen Datei: `art: 'repo'` in `gut` und im YAML, der zweite Parameter `KEINE` bei jedem Aufruf, der Import von `pruefeLehrplan` und `HOECHSTZAHL` aus `src/lib/lehrplan`, die Tests zu `art`, zu „wirft nie", zum Repo ohne Titel und Abschnitte, zum Vorbehalt und zu `lehrplaeneAusTexten`. Drei Meldungen tragen jetzt Umlaute (Präzisierung 15).

- [ ] **Schritt 2: Den Test unter reinem Node anlegen**

`tests/node-ladbarkeit-lehrplan.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

/**
 * Derselbe Vertrag wie in `tests/node-ladbarkeit.test.ts`, fuer den Lehrplan.
 *
 * Der Compiler-Skill prueft seinen Entwurf mit
 * `node -e "import('./werkzeug/lehrplan.mjs')…"` — unter reinem Node, ohne
 * Vite. Seit Fassung 2 zieht das `src/lib/lehrplan.ts` mit, und ein einziger
 * relativer Import ohne Endung legte den Skill lahm, waehrend unter Vitest
 * alles gruen bliebe. Der Unterprozess liest dabei den echten Lehrplan: Das
 * ist zugleich der Nachweis, dass `lehrplan/awesome-llm-apps.yaml` Fassung 2
 * erfuellt.
 */

const wurzel = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const werkzeug = pathToFileURL(path.join(wurzel, 'werkzeug', 'lehrplan.mjs')).href;

describe('werkzeug/lehrplan.mjs aus einem reinen Node-Prozess', () => {
  it('liest den echten Lehrplan so, wie der Compiler-Skill es tut', () => {
    const skript = `
      const { liesLehrplan } = await import(${JSON.stringify(werkzeug)});
      const e = liesLehrplan('lehrplan/awesome-llm-apps.yaml');
      process.stdout.write(JSON.stringify(e.ok ? { ok: true, art: e.lehrplan.art, quelle: e.lehrplan.quelle } : e));
    `;
    const ausgabe = execFileSync(process.execPath, ['--input-type=module', '-e', skript], {
      cwd: wurzel,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    expect(JSON.parse(ausgabe)).toEqual({ ok: true, art: 'repo', quelle: 'awesome-llm-apps' });
  }, 30_000);
});
```

- [ ] **Schritt 3: Tests laufen lassen, Fehlschlag ansehen**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && npx vitest run tests/lehrplan.test.ts tests/node-ladbarkeit-lehrplan.test.ts 2>&1 | grep -E "Tests |Test Files |FAIL|Cannot find module"
```
Erwartet: FAIL in beiden Dateien — `tests/lehrplan.test.ts` lädt nicht (`Error: Cannot find module '../src/lib/lehrplan'`), und der Node-Test „liest den echten Lehrplan so, wie der Compiler-Skill es tut“ scheitert: `Test Files  2 failed (2)`. (Gemessen im Probelauf am 2026-09-22.)

- [ ] **Schritt 4: Das Schema anlegen**

`src/lib/lehrplan.ts`:

```ts
import { z } from 'astro/zod';
// Namentlich, nicht als Vorgabe-Import: js-yaml 5 liefert unter `import` ein
// ESM-Buendel ohne Default-Export. Siehe werkzeug/pruefe-lektion.mjs.
import { load as yamlLesen } from 'js-yaml';
import { widgetPruefungen } from '../widgets/pruefung.ts';

/**
 * Der Lehrplan, Fassung 2 — eine diskriminierte Union ueber `art`.
 *
 * Der Lehrplan ist das Review-Gate: Wer ihn kontrolliert, kontrolliert die App.
 * Er stand bis Fassung 1 in `werkzeug/lehrplan.mjs`. Jetzt lesen ihn drei
 * Stellen: das Werkzeug unter reinem Node, die Seite /bibliothek zur Bauzeit
 * und — vorbereitet, nicht gebaut — ein Ausfuehrer im Browser, der dieselben
 * Statusfelder liest. Deshalb steht hier kein Dateizugriff; das Lesen der
 * Datei bleibt in `werkzeug/lehrplan.mjs`.
 *
 * Relative Importe tragen die Endung `.ts`: `werkzeug/lehrplan.mjs` laedt
 * diese Datei unter reinem Node, und Node loest Importe ohne Endung nicht auf
 * (siehe `tests/node-ladbarkeit-lehrplan.test.ts`).
 */

/**
 * Obergrenze fuer Repos. Die Aufgabe von Durchgang A ist zu verdichten, nicht
 * zu katalogisieren: Vierundzwanzig Varianten sollen zu einer Handvoll
 * Prinzipien werden. Wer neunzehn findet, hat zusammengefasst statt
 * destilliert.
 */
export const HOECHSTZAHL = 8;

const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const IdSchema = z.string().regex(ID, 'nur Kleinbuchstaben, Ziffern und Bindestrich.');

/**
 * Die Meldung steht zweimal da, und das ist der Punkt: `.min(1, …)` greift
 * nur, wenn ein String da ist und zu kurz. Fehlt das Feld ganz — der
 * Regelfall, denn Durchgang A laesst es leer und YAML macht daraus `null` —
 * meldet Zod stattdessen sein englisches „expected string, received null".
 * Ausgerechnet der Satz, der den Zweck des Gates erklaert, erschiene dann nie
 * in dem Fall, fuer den er geschrieben wurde.
 */
const GeprueftVonSchema = z
  .string({ error: 'geprueftVon fehlt — der Lehrplan ist das Review-Gate.' })
  .trim()
  .min(1, 'geprueftVon fehlt — der Lehrplan ist das Review-Gate.');

const PrinzipSchema = z.strictObject({
  id: IdSchema,
  satz: z.string().trim().min(1).max(200, 'Ein Prinzip ist ein Satz, kein Absatz.'),
  warumNichtOffensichtlich: z.string().trim().min(1),
  belege: z
    .array(z.string().trim().min(1))
    .min(1, 'Jedes Prinzip braucht mindestens einen Beleg.'),
  widget: z
    .string()
    .refine(
      (n) => Object.prototype.hasOwnProperty.call(widgetPruefungen, n),
      'kein bekannter Widget-Typ.',
    ),
  /**
   * Die Quelle behauptet etwas, das sich nicht belegen laesst oder dem Stand
   * der Forschung widerspricht. Ein Satz. Er wandert in die Lektion und steht
   * dort unter dem Satz: Pruefungsstoff bleibt lernbar, ohne dass die App ihn
   * als gesichert ausgibt. Nie stillschweigend lehren, nie stillschweigend
   * weglassen.
   */
  vorbehalt: z
    .string()
    .trim()
    .min(1, 'Ein Vorbehalt braucht einen Satz — sonst das Feld weglassen.')
    .max(200, 'Ein Vorbehalt ist ein Satz, kein Absatz.')
    .optional(),
});

const RepoSchema = z
  .strictObject({
    art: z.literal('repo'),
    quelle: z.string().trim().min(1),
    stand: z.string().trim().min(7),
    geprueftVon: GeprueftVonSchema,
    geprueftAm: z.string().trim().min(1),
    prinzipien: z
      .array(PrinzipSchema)
      .min(2)
      .max(HOECHSTZAHL, `höchstens ${HOECHSTZAHL} Prinzipien — verdichten, nicht katalogisieren.`),
  })
  .refine(
    (l) => new Set(l.prinzipien.map((p) => p.id)).size === l.prinzipien.length,
    'Zwei Prinzipien haben dieselbe id.',
  );

/**
 * Die Meldung fuer einen Lehrplan ohne oder mit unbekanntem `art`. Migration
 * statt stiller Voreinstellung: Wer einen Lehrplan aus Fassung 1 in die Hand
 * bekommt, erfaehrt, was einzutragen ist, statt Zods „Invalid discriminator".
 */
export const ART_FEHLT = 'art fehlt oder ist unbekannt. Ein Lehrplan aus einem Git-Repo trägt art: repo.';

export const LehrplanSchema = z.discriminatedUnion('art', [RepoSchema], {
  // Nur der Diskriminator bekommt den eigenen Satz. Fuer alles andere —
  // etwa `null` statt eines Objekts — bleibt Zods eigene Meldung.
  error: (issue) => (issue.code === 'invalid_union' ? ART_FEHLT : undefined),
});

export type Lehrplan = z.infer<typeof LehrplanSchema>;
export type Prinzip = z.infer<typeof PrinzipSchema>;

export type Befund = { ok: true; lehrplan: Lehrplan } | { ok: false; maengel: string[] };

/**
 * Prueft einen geladenen Lehrplan. Wirft nie.
 *
 * `lektionsIds` sind die Lektionen, die es gibt. Ein Repo prueft sie nicht:
 * Ob ein Prinzip schon eine Lektion hat, ist Abdeckung, keine Gueltigkeit.
 */
export function pruefeLehrplan(daten: unknown, lektionsIds: ReadonlySet<string>): Befund {
  const geprueft = LehrplanSchema.safeParse(daten);
  if (geprueft.success) return { ok: true, lehrplan: geprueft.data };
  return {
    ok: false,
    maengel: geprueft.error.issues.map((m) => `${m.path.join('.') || '(Wurzel)'}: ${m.message}`),
  };
}

/**
 * Liest einen Lehrplan aus YAML-Text und prueft ihn. Wirft nie.
 *
 * Der YAML-Fehler wird als Mangel gemeldet, nicht durchgereicht: An dieser
 * Datei sitzt am Review-Gate ein Mensch und traegt `geprueftVon` von Hand ein.
 * Ein Tippfehler ist dort wahrscheinlich — er soll eine Maengelliste ergeben
 * wie jeder andere Befund auch, keinen nackten Stapelabzug.
 */
export function lehrplanAusYaml(text: string, lektionsIds: ReadonlySet<string>, name: string): Befund {
  let daten: unknown;
  try {
    daten = yamlLesen(text);
  } catch (fehler) {
    const grund = fehler instanceof Error ? fehler.message : String(fehler);
    return { ok: false, maengel: [`${name} ist kein gültiges YAML: ${grund}`] };
  }
  return pruefeLehrplan(daten, lektionsIds);
}

/** Ein Lehrplan, der die Pruefung nicht besteht — die Seite zeigt ihn mit seinen Maengeln. */
export type Ungueltig = { readonly datei: string; readonly maengel: readonly string[] };

/**
 * Liest alle Lehrplaene, wie sie `import.meta.glob` liefert: Pfad -> Text.
 *
 * Nach Pfad sortiert, mit eigenem Vergleich statt `localeCompare` — das haengt
 * an der Spracheinstellung des Rechners, und der Bau soll ueberall dieselbe
 * Seite ergeben. Ein ungueltiger Lehrplan bricht nichts ab: Er landet in
 * `ungueltig`, und die Seite zeigt ihn als Warnung. Das ist auch der Zustand
 * zwischen Durchgang A und der Freigabe, in dem `geprueftVon` leer ist.
 */
export function lehrplaeneAusTexten(
  texte: Readonly<Record<string, string>>,
  lektionsIds: ReadonlySet<string>,
): { gueltig: Lehrplan[]; ungueltig: Ungueltig[] } {
  const gueltig: Lehrplan[] = [];
  const ungueltig: Ungueltig[] = [];
  const eintraege = Object.entries(texte).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  for (const [pfad, text] of eintraege) {
    const datei = pfad.slice(pfad.lastIndexOf('/') + 1);
    const befund = lehrplanAusYaml(text, lektionsIds, datei);
    if (befund.ok) gueltig.push(befund.lehrplan);
    else ungueltig.push({ datei, maengel: befund.maengel });
  }
  return { gueltig, ungueltig };
}
```

- [ ] **Schritt 5: Das Werkzeug auf das Lesen zurückschneiden**

`werkzeug/lehrplan.mjs` vollständig ersetzen durch:

```js
import { readFileSync, readdirSync } from 'node:fs';
import { lehrplanAusYaml } from '../src/lib/lehrplan.ts';

/**
 * Liest eine Lehrplandatei vom Datentraeger und prueft sie.
 *
 * Das Schema selbst steht seit Fassung 2 in `src/lib/lehrplan.ts`: Es wird
 * auch von der Seite /bibliothek zur Bauzeit gelesen und soll spaeter im
 * Browser laufen koennen — dort gibt es kein `node:fs`. Hier bleibt, was nur
 * unter Node geht: die Datei lesen und die Lektionen auflisten, die es gibt.
 *
 * @typedef {import('../src/lib/lehrplan.ts').Befund} Befund
 */

/**
 * Die Lektionen, die es gibt: die Dateinamen unter `ordner` ohne `.mdx`.
 *
 * Fehlt der Ordner, gibt es keine Lektion. Das ist die sichere Seite: Jeder
 * Abschnitt mit `status: lektion` faellt dann durch, keiner rutscht durch.
 *
 * @param {string} ordner
 * @returns {Set<string>}
 */
function lektionsIdsAus(ordner) {
  try {
    return new Set(
      readdirSync(ordner)
        .filter((name) => name.endsWith('.mdx'))
        .map((name) => name.slice(0, -'.mdx'.length)),
    );
  } catch {
    return new Set();
  }
}

/**
 * @param {string} datei Pfad zur Lehrplandatei, relativ zum Arbeitsverzeichnis
 * @param {string} [lektionsordner] wo die Lektionen liegen, ebenfalls relativ
 * @returns {Befund}
 */
export function liesLehrplan(datei, lektionsordner = 'inhalt/lektionen') {
  // Lesen und Auswerten getrennt gefangen, nicht zusammen: Sonst meldet eine
  // fehlende Datei „ist kein gueltiges YAML" und schickt den Suchenden zur
  // falschen Baustelle. Der Fall ist nicht theoretisch — er ist beim ersten
  // Probelauf dieses Werkzeugs genau so aufgetreten.
  let text;
  try {
    text = readFileSync(datei, 'utf8');
  } catch (fehler) {
    const grund = fehler instanceof Error ? fehler.message : String(fehler);
    return { ok: false, maengel: [`${datei} lässt sich nicht lesen: ${grund}`] };
  }
  return lehrplanAusYaml(text, lektionsIdsAus(lektionsordner), datei);
}
```

- [ ] **Schritt 6: Tests laufen lassen**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && npx vitest run tests/lehrplan.test.ts tests/node-ladbarkeit-lehrplan.test.ts 2>&1 | grep -E "Tests |×|art fehlt"
```
Erwartet: `Tests  1 failed | 28 passed (29)`. Rot ist nur der Node-Test am echten Lehrplan, mit der Meldung „art: art fehlt oder ist unbekannt. Ein Lehrplan aus einem Git-Repo trägt art: repo.“ — genau das behebt Schritt 7. Danach: `Tests  29 passed (29)`.

- [ ] **Schritt 7: Den bestehenden Lehrplan migrieren**

In `lehrplan/awesome-llm-apps.yaml` diese Stelle (die ersten beiden Zeilen)

```yaml
quelle: awesome-llm-apps
stand: a13701eae315a81e1011a4304a6b5e741ea0a984
```

ersetzen durch

```yaml
art: repo
quelle: awesome-llm-apps
stand: a13701eae315a81e1011a4304a6b5e741ea0a984
```

Sonst nichts an der Datei — `geprueftVon` und `geprueftAm` bleiben, wie sie sind: `art` ist eine Formangabe, kein neuer Inhalt, und verlangt keine neue Freigabe.

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && head -2 lehrplan/awesome-llm-apps.yaml && git diff --stat lehrplan/ && npx vitest run tests/lehrplan.test.ts tests/node-ladbarkeit-lehrplan.test.ts 2>&1 | grep -E "Tests |×"
```
Erwartet: `art: repo`, `quelle: awesome-llm-apps`, `1 file changed, 1 insertion(+)`, dann `Tests  29 passed (29)`.

- [ ] **Schritt 8: Den Compiler-Skill nachziehen**

In `.claude/skills/kernbohrung-compiler/SKILL.md`, Abschnitt „A6 · Den Entwurf schreiben", diese Stelle

````text
Nach `lehrplan/<name>.yaml`. Format und Grenzen stehen in
`werkzeug/lehrplan.mjs`; sieh dort nach, statt zu raten.

```yaml
quelle: <name>
````

ersetzen durch

````text
Nach `lehrplan/<name>.yaml`. Format und Grenzen stehen in
`src/lib/lehrplan.ts`; sieh dort nach, statt zu raten. Ein Lehrplan aus einem
Repo trägt `art: repo` — ohne die Zeile weist die Prüfung ihn zurück.

```yaml
art: repo
quelle: <name>
````

Mehr nicht. Der Prüfbefehl darunter (`node -e "import('./werkzeug/lehrplan.mjs')…liesLehrplan('lehrplan/<name>.yaml')…"`) bleibt wörtlich derselbe — `liesLehrplan` hat seinen Namen und seine Bedeutung behalten. Wie der Skill Bücher und Folien behandelt, lernt er in 2c.

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && git diff --stat .claude/ && grep -c "^art: repo" .claude/skills/kernbohrung-compiler/SKILL.md && grep -c "src/lib/lehrplan.ts" .claude/skills/kernbohrung-compiler/SKILL.md
```
Erwartet: `1 file changed, 3 insertions(+), 1 deletion(-)`, `1`, `1`.

- [ ] **Schritt 9: Mutationsproben — was jeder neue Test fängt**

Jede Probe: die Änderung vorübergehend machen, den Befehl laufen lassen, die Änderung zurücknehmen.

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && npx vitest run tests/lehrplan.test.ts tests/node-ladbarkeit-lehrplan.test.ts 2>&1 | grep -E "Tests |×"
```

**A — die Meldung zu `art`.** In `src/lib/lehrplan.ts` `error: (issue) => (issue.code === 'invalid_union' ? ART_FEHLT : undefined),` ändern zu `error: () => undefined,`. Erwartet: **genau zwei** Tests schlagen fehl — „weist einen Lehrplan ohne art zurueck und sagt, was einzutragen ist" und „weist eine unbekannte art mit derselben Meldung zurueck". Ohne den eigenen Satz stünde dort Zods „Invalid discriminator value", und wer einen Lehrplan aus Fassung 1 prüft, erführe nicht, welche Zeile fehlt.

**B — die Endung `.ts`.** In `src/lib/lehrplan.ts` `from '../widgets/pruefung.ts';` ändern zu `from '../widgets/pruefung';`. Erwartet: **genau ein** Test schlägt fehl — „liest den echten Lehrplan so, wie der Compiler-Skill es tut"; die 28 unter Vitest bleiben grün. Genau dafür gibt es den Test: Vite löst den Import auf, Node nicht, und der Skill stünde still.

**C — ein Satz ist kein Absatz.** In `src/lib/lehrplan.ts` `.max(200, 'Ein Vorbehalt ist ein Satz, kein Absatz.')` ändern zu `.max(2000, 'Ein Vorbehalt ist ein Satz, kein Absatz.')`. Erwartet: **genau ein** Test schlägt fehl — „weist einen Vorbehalt zurueck, der ein Absatz ist".

Alle drei zurücknehmen, dann:

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && grep -c "ART_FEHLT : undefined\|pruefung.ts'\|max(200, 'Ein Vorbehalt" src/lib/lehrplan.ts && npx vitest run tests/lehrplan.test.ts tests/node-ladbarkeit-lehrplan.test.ts 2>&1 | grep -E "Tests |×"
```
Erwartet: `3`, dann `Tests  29 passed (29)`.

- [ ] **Schritt 10: Typen, NUL-Prüfung, Commit**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && python -c "import sys; print(sum(open(f,'rb').read().count(b'\x00') for f in sys.argv[1:]))" src/lib/lehrplan.ts werkzeug/lehrplan.mjs lehrplan/awesome-llm-apps.yaml .claude/skills/kernbohrung-compiler/SKILL.md tests/lehrplan.test.ts tests/node-ladbarkeit-lehrplan.test.ts && npm run check 2>&1 | grep -E "^- [0-9]+ (error|warning|hint)" && git add src/lib/lehrplan.ts werkzeug/lehrplan.mjs lehrplan/awesome-llm-apps.yaml .claude/skills/kernbohrung-compiler/SKILL.md tests/lehrplan.test.ts tests/node-ladbarkeit-lehrplan.test.ts && git commit -q -F - <<'MSG'
feat: Lehrplan Fassung 2 fuer Repos - art, vorbehalt, Schema in src/lib

Der Lehrplan wird eine diskriminierte Union ueber art; in diesem
Schritt mit einem Mitglied, repo. Ein Lehrplan ohne art ist ein Fehler
mit Anleitung, keine stille Voreinstellung. awesome-llm-apps.yaml traegt
jetzt art: repo, der Compiler-Skill schreibt es in A6 mit.

Ein Prinzip kann einen vorbehalt tragen: ein Satz, wenn die Quelle
etwas behauptet, das sich nicht belegen laesst.

Das Schema zieht nach src/lib/lehrplan.ts. Den Lehrplan lesen jetzt
der Skill unter Node, die Seite /bibliothek zur Bauzeit und spaeter
der Browser - dort gibt es kein node:fs. werkzeug/lehrplan.mjs behaelt
liesLehrplan. Ein Test laedt es aus einem echten Node-Prozess und liest
dabei den echten Lehrplan: Ein Import ohne .ts-Endung legte den Skill
lahm, waehrend Vitest gruen bliebe. Mutationsprobe: gefangen.

Die Maengel zeigt kuenftig die Seite, deshalb mit Umlauten.

<CO-AUTHORED-BY>
MSG
```
Erwartet: `0`, `- 0 errors`, `- 0 warnings`, `- 1 hint`, danach ein Commit. Der Hinweis ist `ts(6133): 'lektionsIds' is declared but its value is never read` in `src/lib/lehrplan.ts` — der Parameter steht schon in der Signatur, benutzt wird er erst in Aufgabe 2 (Abschnitte mit `status: lektion`); dann verschwindet der Hinweis.

---

## Aufgabe 2: Buch und Folien — Abschnitte, Status und ihre Regeln

**Dateien:**
- Ersetzen: `src/lib/lehrplan.ts`
- Test: `tests/lehrplan-lehrmaterial.test.ts` (neu)

Jede Regel aus dem Spec („Das Schema erzwingt …") hat unten einen Test, der ohne sie rot wird: `grund` genau dann, wenn `abgelehnt` (beide Richtungen); `lektion` genau dann, wenn `lektion` (beide Richtungen), und die Lektion muss es geben; Abschnitt-Ids eindeutig; Seitenbereiche je Datei aufsteigend und überschneidungsfrei; höchstens drei Prinzipien je Abschnitt; ISBN und Auflage nur beim Buch. Die Hilfen `abschnitt()` und `folien()` legen eine Änderung stumpf über einen gültigen Stand und ergänzen nichts — wer einen Abschnitt kaputt machen will, reicht den ganzen Abschnitt herein.

- [ ] **Schritt 1: Den fehlschlagenden Test schreiben**

`tests/lehrplan-lehrmaterial.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ART_FEHLT, HOECHSTZAHL_JE_ABSCHNITT, pruefeLehrplan } from '../src/lib/lehrplan';
import { liesLehrplan } from '../werkzeug/lehrplan.mjs';

/**
 * Lehrplan Fassung 2 fuer Buch und Folien.
 *
 * Die Hilfen hier machen NICHTS von selbst gueltig: `abschnitt()` und
 * `folien()` legen die Aenderung stumpf ueber einen gueltigen Stand. Wer einen
 * Abschnitt kaputt machen will, reicht den ganzen Abschnitt herein. Im Umbau
 * der Aufgabenfamilie blieben zweimal Schemaregeln ohne Test, weil eine Hilfe
 * die Eingaben von selbst gueltig machte.
 */

const LEKTIONEN = new Set(['pauschal-heisst-nicht-komplett']);

const prinzip = {
  id: 'pauschal-verlagert-mengenrisiko',
  satz: 'Ein Pauschalpreis verlagert das Mengenrisiko, nicht das Vollständigkeitsrisiko.',
  warumNichtOffensichtlich: 'Pauschal klingt nach komplett.',
  belege: ['m07-2-vertragsarten'],
  widget: 'Pipeline',
};

const basisAbschnitt = {
  id: 'm07-2-vertragsarten',
  titel: 'Risikomanagement und Vertragswesen',
  datei: 'M7 Risikomanagement 26.pdf',
  seiten: [28, 34],
  status: 'offen',
};

function abschnitt(aenderung: Record<string, unknown> = {}): Record<string, unknown> {
  return { ...basisAbschnitt, ...aenderung };
}

const basis = {
  art: 'folien',
  quelle: 'bauch-projektmanagement',
  titel: 'Projektmanagement',
  stand: `sha256:${'a'.repeat(64)}`,
  geprueftVon: 'Daniel Nobs',
  geprueftAm: '2026-09-22',
  abschnitte: [abschnitt({ id: 'm07-1-risiko', titel: 'Risiko', seiten: [1, 27] }), abschnitt()],
};

function folien(aenderung: Record<string, unknown> = {}): Record<string, unknown> {
  return { ...basis, ...aenderung };
}

/** Ein Folien-Lehrplan mit genau diesen Abschnitten, sonst unveraendert. */
function mitAbschnitten(...abschnitte: Record<string, unknown>[]): Record<string, unknown> {
  return folien({ abschnitte });
}

function ohneFeld(objekt: Record<string, unknown>, feld: string): Record<string, unknown> {
  const { [feld]: _weg, ...rest } = objekt;
  return rest;
}

function gilt(daten: unknown): boolean {
  return pruefeLehrplan(daten, LEKTIONEN).ok;
}

function maengelVon(daten: unknown, lektionen: ReadonlySet<string> = LEKTIONEN): string {
  const e = pruefeLehrplan(daten, lektionen);
  if (e.ok) throw new Error('Erwartet war ein Fehlschlag, die Pruefung war aber zufrieden.');
  return e.maengel.join(' | ');
}

describe('Buch und Folien - die Form', () => {
  it('nimmt einen gueltigen Folien-Lehrplan an', () => {
    const e = pruefeLehrplan(folien(), LEKTIONEN);
    if (!e.ok) throw new Error(e.maengel.join('\n'));
    if (e.lehrplan.art !== 'folien') throw new Error('Erwartet waren Folien.');
    expect(e.lehrplan.abschnitte).toHaveLength(2);
  });

  it('nennt in der Meldung zu art alle drei Arten', () => {
    expect(maengelVon(folien({ art: 'video' }))).toBe(`art: ${ART_FEHLT}`);
    expect(ART_FEHLT).toContain('erlaubt sind repo, buch und folien');
  });

  it('nimmt ein Buch mit ISBN und Auflage an', () => {
    expect(gilt(folien({ art: 'buch', isbn: '978-3-658-00000-0', auflage: '3. Auflage' }))).toBe(true);
  });

  it('weist ISBN und Auflage bei Folien zurueck', () => {
    expect(gilt(folien({ isbn: '978-3-658-00000-0' }))).toBe(false);
    expect(gilt(folien({ auflage: '3. Auflage' }))).toBe(false);
  });

  it.each(['titel', 'stand', 'geprueftVon', 'geprueftAm', 'abschnitte'])('verlangt das Feld %s', (feld) => {
    expect(gilt(ohneFeld(folien(), feld))).toBe(false);
  });

  it('verlangt mindestens einen Abschnitt', () => {
    expect(maengelVon(mitAbschnitten())).toMatch(/mindestens einen Abschnitt/);
  });

  it('weist Prinzipien auf oberster Ebene zurueck — bei Lehrmaterial haengen sie am Abschnitt', () => {
    expect(gilt(folien({ prinzipien: [prinzip, { ...prinzip, id: 'zwei' }] }))).toBe(false);
  });

  it('weist ein Fremdfeld im Abschnitt zurueck', () => {
    expect(gilt(mitAbschnitten(abschnitt({ notiz: 'nebenbei' })))).toBe(false);
  });
});

describe('Abschnitte - Pflichtfelder und Form', () => {
  it.each(['id', 'titel', 'datei', 'seiten', 'status'])('verlangt im Abschnitt das Feld %s', (feld) => {
    expect(gilt(mitAbschnitten(ohneFeld(abschnitt(), feld)))).toBe(false);
  });

  it('weist eine Abschnitt-Id mit Grossbuchstaben oder Leerzeichen zurueck', () => {
    expect(gilt(mitAbschnitten(abschnitt({ id: 'M07-2' })))).toBe(false);
    expect(gilt(mitAbschnitten(abschnitt({ id: 'm07 2' })))).toBe(false);
  });

  it('weist einen unbekannten Status zurueck', () => {
    expect(gilt(mitAbschnitten(abschnitt({ status: 'fertig' })))).toBe(false);
  });

  it('weist einen Seitenbereich zurueck, der rueckwaerts laeuft', () => {
    expect(maengelVon(mitAbschnitten(abschnitt({ seiten: [34, 28] })))).toMatch(
      /erst die erste, dann die letzte Seite/,
    );
  });

  it('weist Seite 0 zurueck', () => {
    expect(maengelVon(mitAbschnitten(abschnitt({ seiten: [0, 3] })))).toMatch(/Seiten zählen ab 1/);
  });

  it('nimmt einen Abschnitt aus einer einzigen Seite an', () => {
    expect(gilt(mitAbschnitten(abschnitt({ seiten: [12, 12] })))).toBe(true);
  });

  it('liest fehlende Prinzipien als leere Liste', () => {
    // Das Einlesen legt Abschnitte ohne Prinzipien an; Durchgang A fuellt sie.
    const e = pruefeLehrplan(mitAbschnitten(abschnitt()), LEKTIONEN);
    if (!e.ok) throw new Error(e.maengel.join('\n'));
    if (e.lehrplan.art === 'repo') throw new Error('Erwartet waren Folien.');
    expect(e.lehrplan.abschnitte[0]?.prinzipien).toEqual([]);
  });
});

describe('Abschnitte - grund und lektion', () => {
  it('verlangt einen Grund, wenn ein Abschnitt abgelehnt ist', () => {
    expect(maengelVon(mitAbschnitten(abschnitt({ status: 'abgelehnt' })))).toMatch(
      /Ein abgelehnter Abschnitt braucht einen Grund\./,
    );
  });

  it('nimmt einen abgelehnten Abschnitt mit Grund an', () => {
    expect(gilt(mitAbschnitten(abschnitt({ status: 'abgelehnt', grund: 'reine Titelfolien' })))).toBe(true);
  });

  it.each(['offen', 'beauftragt'])('weist einen Grund bei status %s zurueck', (status) => {
    expect(maengelVon(mitAbschnitten(abschnitt({ status, grund: 'irgendwas' })))).toMatch(
      /grund steht nur bei status abgelehnt\./,
    );
  });

  it('verlangt die Lektion, wenn der Status lektion ist', () => {
    expect(maengelVon(mitAbschnitten(abschnitt({ status: 'lektion' })))).toMatch(
      /Ein Abschnitt mit status lektion nennt seine Lektion\./,
    );
  });

  it('weist eine Lektion neben einem anderen Status zurueck', () => {
    expect(
      maengelVon(mitAbschnitten(abschnitt({ status: 'offen', lektion: 'pauschal-heisst-nicht-komplett' }))),
    ).toMatch(/lektion steht nur bei status lektion\./);
  });

  it('nimmt einen Abschnitt mit einer Lektion an, die es gibt', () => {
    expect(gilt(mitAbschnitten(abschnitt({ status: 'lektion', lektion: 'pauschal-heisst-nicht-komplett' })))).toBe(
      true,
    );
  });

  it('weist eine Lektion zurueck, die es nicht gibt, und nennt die Datei', () => {
    expect(maengelVon(mitAbschnitten(abschnitt({ status: 'lektion', lektion: 'gibt-es-nicht' })))).toBe(
      'abschnitte.0.lektion: Die Lektion gibt-es-nicht gibt es nicht (inhalt/lektionen/gibt-es-nicht.mdx).',
    );
  });

  it('faellt ohne bekannte Lektionen durch, nie durch', () => {
    const daten = mitAbschnitten(abschnitt({ status: 'lektion', lektion: 'pauschal-heisst-nicht-komplett' }));
    expect(maengelVon(daten, new Set())).toMatch(/gibt es nicht/);
  });
});

describe('Abschnitte untereinander', () => {
  const a = (id: string, datei: string, seiten: [number, number]) => abschnitt({ id, datei, seiten });

  it('weist doppelte Abschnitt-Ids zurueck', () => {
    expect(maengelVon(mitAbschnitten(a('m1', 'A.pdf', [1, 5]), a('m1', 'A.pdf', [6, 9])))).toMatch(
      /Zwei Abschnitte haben die id m1\./,
    );
  });

  it('weist sich ueberschneidende Seitenbereiche in derselben Datei zurueck', () => {
    expect(maengelVon(mitAbschnitten(a('m1', 'A.pdf', [1, 10]), a('m2', 'A.pdf', [8, 20])))).toMatch(
      /überschneiden sich nicht: m2 beginnt auf Seite 8, der Abschnitt davor in A\.pdf endet auf Seite 10/,
    );
  });

  it('weist sich beruehrende Bereiche zurueck — beide enthielten dieselbe Seite', () => {
    expect(gilt(mitAbschnitten(a('m1', 'A.pdf', [1, 5]), a('m2', 'A.pdf', [5, 9])))).toBe(false);
  });

  it('nimmt aneinander anschliessende Bereiche an', () => {
    expect(gilt(mitAbschnitten(a('m1', 'A.pdf', [1, 5]), a('m2', 'A.pdf', [6, 9])))).toBe(true);
  });

  it('weist absteigende Bereiche in derselben Datei zurueck', () => {
    expect(gilt(mitAbschnitten(a('m1', 'A.pdf', [10, 12]), a('m2', 'A.pdf', [1, 5])))).toBe(false);
  });

  it('nimmt dieselben Seiten in zwei Dateien an', () => {
    expect(gilt(mitAbschnitten(a('m1', 'A.pdf', [1, 5]), a('m2', 'B.pdf', [1, 5])))).toBe(true);
  });

  it('prueft je Datei, auch wenn sich die Dateien abwechseln', () => {
    // Faengt eine Pruefung, die nur mit dem unmittelbaren Vorgaenger vergleicht.
    expect(gilt(mitAbschnitten(a('m1', 'A.pdf', [1, 5]), a('m2', 'B.pdf', [1, 3]), a('m3', 'A.pdf', [6, 9])))).toBe(
      true,
    );
    expect(gilt(mitAbschnitten(a('m1', 'A.pdf', [1, 5]), a('m2', 'B.pdf', [1, 3]), a('m3', 'A.pdf', [4, 9])))).toBe(
      false,
    );
  });
});

describe('Prinzipien je Abschnitt', () => {
  const prinzipien = (n: number) => Array.from({ length: n }, (_, i) => ({ ...prinzip, id: `prinzip-${i}` }));

  it(`nimmt bis zu ${HOECHSTZAHL_JE_ABSCHNITT} Prinzipien je Abschnitt an`, () => {
    expect(gilt(mitAbschnitten(abschnitt({ prinzipien: prinzipien(HOECHSTZAHL_JE_ABSCHNITT) })))).toBe(true);
  });

  it('weist das vierte Prinzip zurueck und sagt warum', () => {
    expect(maengelVon(mitAbschnitten(abschnitt({ prinzipien: prinzipien(HOECHSTZAHL_JE_ABSCHNITT + 1) })))).toMatch(
      /höchstens 3 Prinzipien je Abschnitt — ein Abschnitt mit mehr ist katalogisiert, nicht destilliert\./,
    );
  });

  it('prueft ein Prinzip im Abschnitt wie im Repo — auch seinen Vorbehalt', () => {
    const langer = { ...prinzip, vorbehalt: 'Wort '.repeat(45).trim() };
    expect(maengelVon(mitAbschnitten(abschnitt({ prinzipien: [langer] })))).toMatch(/Ein Vorbehalt ist ein Satz/);
  });
});

describe('liesLehrplan - Lehrmaterial', () => {
  const yaml = `art: folien
quelle: bauch-projektmanagement
titel: Projektmanagement
stand: "sha256:${'a'.repeat(64)}"
geprueftVon: Daniel Nobs
geprueftAm: 2026-09-22
abschnitte:
  - id: m07-2-vertragsarten
    titel: Risikomanagement und Vertragswesen
    datei: M7 Risikomanagement 26.pdf
    seiten: [28, 34]
    status: lektion
    lektion: pauschal-heisst-nicht-komplett
`;

  /** Legt Lehrplan und Lektionsordner in einem Wegwerfordner an. */
  function mitOrdner(pruefe: (datei: string, lektionen: string) => void): void {
    const ordner = mkdtempSync(path.join(tmpdir(), 'lehrmaterial-'));
    try {
      const lektionen = path.join(ordner, 'lektionen');
      mkdirSync(lektionen);
      writeFileSync(path.join(lektionen, 'pauschal-heisst-nicht-komplett.mdx'), '---\n---\n', 'utf8');
      const datei = path.join(ordner, 'plan.yaml');
      writeFileSync(datei, yaml, 'utf8');
      pruefe(datei, lektionen);
    } finally {
      rmSync(ordner, { recursive: true, force: true });
    }
  }

  it('findet die Lektion im Lektionsordner', () => {
    mitOrdner((datei, lektionen) => {
      const e = liesLehrplan(datei, lektionen);
      if (!e.ok) throw new Error(e.maengel.join('\n'));
      expect(e.lehrplan.art).toBe('folien');
    });
  });

  it('laesst ohne Lektionsordner jeden Abschnitt mit Lektion durchfallen', () => {
    mitOrdner((datei, lektionen) => {
      const e = liesLehrplan(datei, path.join(lektionen, 'gibt-es-nicht'));
      expect(e.ok).toBe(false);
    });
  });
});
```

- [ ] **Schritt 2: Test laufen lassen, Fehlschlag ansehen**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && npx vitest run tests/lehrplan-lehrmaterial.test.ts 2>&1 | grep -E "Tests "
```
Erwartet: `Tests  26 failed | 18 passed (44)` (gemessen im Probelauf am 2026-09-22). Nach Schritt 3 sind alle grün; die drei Lehrplan-Dateien zusammen: `Tests  73 passed (73)`.

- [ ] **Schritt 3: Das Schema um Buch und Folien erweitern**

`src/lib/lehrplan.ts` vollständig ersetzen durch:

```ts
import { z } from 'astro/zod';
// Namentlich, nicht als Vorgabe-Import: js-yaml 5 liefert unter `import` ein
// ESM-Buendel ohne Default-Export. Siehe werkzeug/pruefe-lektion.mjs.
import { load as yamlLesen } from 'js-yaml';
import { widgetPruefungen } from '../widgets/pruefung.ts';

/**
 * Der Lehrplan, Fassung 2 — eine diskriminierte Union ueber `art`.
 *
 * Der Lehrplan ist das Review-Gate: Wer ihn kontrolliert, kontrolliert die App.
 * Er stand bis Fassung 1 in `werkzeug/lehrplan.mjs`. Jetzt lesen ihn drei
 * Stellen: das Werkzeug unter reinem Node, die Seite /bibliothek zur Bauzeit
 * und — vorbereitet, nicht gebaut — ein Ausfuehrer im Browser, der dieselben
 * Statusfelder liest. Deshalb steht hier kein Dateizugriff; das Lesen der
 * Datei bleibt in `werkzeug/lehrplan.mjs`.
 *
 * Relative Importe tragen die Endung `.ts`: `werkzeug/lehrplan.mjs` laedt
 * diese Datei unter reinem Node, und Node loest Importe ohne Endung nicht auf
 * (siehe `tests/node-ladbarkeit-lehrplan.test.ts`).
 */

/**
 * Obergrenze fuer Repos. Die Aufgabe von Durchgang A ist zu verdichten, nicht
 * zu katalogisieren: Vierundzwanzig Varianten sollen zu einer Handvoll
 * Prinzipien werden. Wer neunzehn findet, hat zusammengefasst statt
 * destilliert. Fuer Lehrmaterial gilt sie nicht — dort tritt an ihre Stelle
 * die Pflicht, jeden Abschnitt zu entscheiden.
 */
export const HOECHSTZAHL = 8;

/** Je Abschnitt aus Lehrmaterial. Ein Abschnitt mit zehn Prinzipien ist katalogisiert, nicht destilliert. */
export const HOECHSTZAHL_JE_ABSCHNITT = 3;

/**
 * Der Weg eines Abschnitts: `offen` nach dem Einlesen, `beauftragt` fuer den
 * naechsten Durchgang, danach `lektion` oder `abgelehnt` — nie beides, nie
 * keines. Der Auftrag an den Compiler ist keine eigene Datei, sondern die
 * Menge der Abschnitte mit `beauftragt`.
 */
export const STATUS = ['offen', 'beauftragt', 'lektion', 'abgelehnt'] as const;
export type Status = (typeof STATUS)[number];

const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const IdSchema = z.string().regex(ID, 'nur Kleinbuchstaben, Ziffern und Bindestrich.');

/**
 * Die Meldung steht zweimal da, und das ist der Punkt: `.min(1, …)` greift
 * nur, wenn ein String da ist und zu kurz. Fehlt das Feld ganz — der
 * Regelfall, denn Durchgang A laesst es leer und YAML macht daraus `null` —
 * meldet Zod stattdessen sein englisches „expected string, received null".
 * Ausgerechnet der Satz, der den Zweck des Gates erklaert, erschiene dann nie
 * in dem Fall, fuer den er geschrieben wurde.
 */
const GeprueftVonSchema = z
  .string({ error: 'geprueftVon fehlt — der Lehrplan ist das Review-Gate.' })
  .trim()
  .min(1, 'geprueftVon fehlt — der Lehrplan ist das Review-Gate.');

const PrinzipSchema = z.strictObject({
  id: IdSchema,
  satz: z.string().trim().min(1).max(200, 'Ein Prinzip ist ein Satz, kein Absatz.'),
  warumNichtOffensichtlich: z.string().trim().min(1),
  belege: z
    .array(z.string().trim().min(1))
    .min(1, 'Jedes Prinzip braucht mindestens einen Beleg.'),
  widget: z
    .string()
    .refine(
      (n) => Object.prototype.hasOwnProperty.call(widgetPruefungen, n),
      'kein bekannter Widget-Typ.',
    ),
  /**
   * Die Quelle behauptet etwas, das sich nicht belegen laesst oder dem Stand
   * der Forschung widerspricht. Ein Satz. Er wandert in die Lektion und steht
   * dort unter dem Satz: Pruefungsstoff bleibt lernbar, ohne dass die App ihn
   * als gesichert ausgibt. Nie stillschweigend lehren, nie stillschweigend
   * weglassen.
   */
  vorbehalt: z
    .string()
    .trim()
    .min(1, 'Ein Vorbehalt braucht einen Satz — sonst das Feld weglassen.')
    .max(200, 'Ein Vorbehalt ist ein Satz, kein Absatz.')
    .optional(),
});

const RepoSchema = z
  .strictObject({
    art: z.literal('repo'),
    quelle: z.string().trim().min(1),
    stand: z.string().trim().min(7),
    geprueftVon: GeprueftVonSchema,
    geprueftAm: z.string().trim().min(1),
    prinzipien: z
      .array(PrinzipSchema)
      .min(2)
      .max(HOECHSTZAHL, `höchstens ${HOECHSTZAHL} Prinzipien — verdichten, nicht katalogisieren.`),
  })
  .refine(
    (l) => new Set(l.prinzipien.map((p) => p.id)).size === l.prinzipien.length,
    'Zwei Prinzipien haben dieselbe id.',
  );

/** Seitenzahlen zaehlen ab 1, wie im Original. */
const SeiteSchema = z.number().int().min(1, 'Seiten zählen ab 1.');

const AbschnittSchema = z
  .strictObject({
    /** Reihenfolge-Praefix und Slug, etwa `m07-2-vertragsarten`. */
    id: IdSchema,
    titel: z.string().trim().min(1),
    /**
     * Immer Pflicht, nicht erst bei mehreren Originalen: Wie viele Originale
     * es gibt, steht im Manifest, und das kennt dieses Schema nicht. Und der
     * Compiler muss fuer jede Bildseite wissen, welche Datei er oeffnet.
     */
    datei: z.string().trim().min(1),
    seiten: z
      .tuple([SeiteSchema, SeiteSchema])
      .refine(([von, bis]) => von <= bis, 'seiten: erst die erste, dann die letzte Seite.'),
    status: z.enum(STATUS),
    grund: z.string().trim().min(1).optional(),
    lektion: IdSchema.optional(),
    prinzipien: z
      .array(PrinzipSchema)
      .max(
        HOECHSTZAHL_JE_ABSCHNITT,
        `höchstens ${HOECHSTZAHL_JE_ABSCHNITT} Prinzipien je Abschnitt — ein Abschnitt mit mehr ist katalogisiert, nicht destilliert.`,
      )
      .default([]),
  })
  // Beide Richtungen, je fuer grund und lektion: Ein Grund ohne Ablehnung
  // waere eine Begruendung fuer nichts, eine Lektion neben `offen` eine
  // Abdeckung, die niemand beschlossen hat.
  .superRefine((a, ctx) => {
    if (a.status === 'abgelehnt' && a.grund === undefined) {
      ctx.addIssue({ code: 'custom', path: ['grund'], message: 'Ein abgelehnter Abschnitt braucht einen Grund.' });
    }
    if (a.status !== 'abgelehnt' && a.grund !== undefined) {
      ctx.addIssue({ code: 'custom', path: ['grund'], message: 'grund steht nur bei status abgelehnt.' });
    }
    if (a.status === 'lektion' && a.lektion === undefined) {
      ctx.addIssue({ code: 'custom', path: ['lektion'], message: 'Ein Abschnitt mit status lektion nennt seine Lektion.' });
    }
    if (a.status !== 'lektion' && a.lektion !== undefined) {
      ctx.addIssue({ code: 'custom', path: ['lektion'], message: 'lektion steht nur bei status lektion.' });
    }
  });

type AbschnittRoh = z.infer<typeof AbschnittSchema>;

/**
 * Regeln ueber mehrere Abschnitte: eindeutige Ids, und je Datei steigen die
 * Seitenbereiche auf, ohne sich zu ueberschneiden. Sich beruehrende Bereiche
 * ueberschneiden sich — `[1, 5]` und `[5, 9]` teilen Seite 5.
 */
function pruefeAbschnitte(l: { abschnitte: readonly AbschnittRoh[] }, ctx: z.RefinementCtx): void {
  const ids = new Set<string>();
  const ende = new Map<string, number>();
  l.abschnitte.forEach((a, i) => {
    if (ids.has(a.id)) {
      ctx.addIssue({ code: 'custom', path: ['abschnitte', i, 'id'], message: `Zwei Abschnitte haben die id ${a.id}.` });
    }
    ids.add(a.id);

    const bisher = ende.get(a.datei);
    if (bisher !== undefined && a.seiten[0] <= bisher) {
      ctx.addIssue({
        code: 'custom',
        path: ['abschnitte', i, 'seiten'],
        message: `Seitenbereiche steigen je Datei auf und überschneiden sich nicht: ${a.id} beginnt auf Seite ${a.seiten[0]}, der Abschnitt davor in ${a.datei} endet auf Seite ${bisher}.`,
      });
    }
    ende.set(a.datei, Math.max(bisher ?? 0, a.seiten[1]));
  });
}

/** Was Buch und Folien teilen: eine Form, zwei Gliederer — die sind Sache des Adapters. */
const lehrmaterial = {
  quelle: z.string().trim().min(1),
  titel: z.string().trim().min(1),
  /** Der Hash ueber die Originale, aus dem Manifest. */
  stand: z.string().trim().min(7),
  geprueftVon: GeprueftVonSchema,
  geprueftAm: z.string().trim().min(1),
  abschnitte: z.array(AbschnittSchema).min(1, 'Ein Lehrplan aus Lehrmaterial hat mindestens einen Abschnitt.'),
};

const BuchSchema = z
  .strictObject({
    art: z.literal('buch'),
    ...lehrmaterial,
    isbn: z.string().trim().min(1).optional(),
    auflage: z.string().trim().min(1).optional(),
  })
  .superRefine(pruefeAbschnitte);

/** Wie das Buch, aber ohne ISBN und Auflage: `strictObject` weist beide zurueck. */
const FolienSchema = z
  .strictObject({
    art: z.literal('folien'),
    ...lehrmaterial,
  })
  .superRefine(pruefeAbschnitte);

/**
 * Die Meldung fuer einen Lehrplan ohne oder mit unbekanntem `art`. Migration
 * statt stiller Voreinstellung: Wer einen Lehrplan aus Fassung 1 in die Hand
 * bekommt, erfaehrt, was einzutragen ist, statt Zods „Invalid discriminator".
 */
export const ART_FEHLT =
  'art fehlt oder ist unbekannt — erlaubt sind repo, buch und folien. Ein Lehrplan aus einem Git-Repo trägt art: repo.';

export const LehrplanSchema = z.discriminatedUnion('art', [RepoSchema, BuchSchema, FolienSchema], {
  // Nur der Diskriminator bekommt den eigenen Satz. Fuer alles andere —
  // etwa `null` statt eines Objekts — bleibt Zods eigene Meldung.
  error: (issue) => (issue.code === 'invalid_union' ? ART_FEHLT : undefined),
});

export type Lehrplan = z.infer<typeof LehrplanSchema>;
type Lehrmaterial = Extract<Lehrplan, { art: 'buch' | 'folien' }>;
export type Abschnitt = Lehrmaterial['abschnitte'][number];
export type Prinzip = z.infer<typeof PrinzipSchema>;

export type Befund = { ok: true; lehrplan: Lehrplan } | { ok: false; maengel: string[] };

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
  const geprueft = LehrplanSchema.safeParse(daten);
  if (!geprueft.success) {
    return {
      ok: false,
      maengel: geprueft.error.issues.map((m) => `${m.path.join('.') || '(Wurzel)'}: ${m.message}`),
    };
  }
  const lehrplan = geprueft.data;
  if (lehrplan.art === 'repo') return { ok: true, lehrplan };

  const maengel = lehrplan.abschnitte.flatMap((a, i) =>
    a.lektion !== undefined && !lektionsIds.has(a.lektion)
      ? [`abschnitte.${i}.lektion: Die Lektion ${a.lektion} gibt es nicht (inhalt/lektionen/${a.lektion}.mdx).`]
      : [],
  );
  return maengel.length > 0 ? { ok: false, maengel } : { ok: true, lehrplan };
}

/**
 * Liest einen Lehrplan aus YAML-Text und prueft ihn. Wirft nie.
 *
 * Der YAML-Fehler wird als Mangel gemeldet, nicht durchgereicht: An dieser
 * Datei sitzt am Review-Gate ein Mensch und traegt `geprueftVon` von Hand ein.
 * Ein Tippfehler ist dort wahrscheinlich — er soll eine Maengelliste ergeben
 * wie jeder andere Befund auch, keinen nackten Stapelabzug.
 */
export function lehrplanAusYaml(text: string, lektionsIds: ReadonlySet<string>, name: string): Befund {
  let daten: unknown;
  try {
    daten = yamlLesen(text);
  } catch (fehler) {
    const grund = fehler instanceof Error ? fehler.message : String(fehler);
    return { ok: false, maengel: [`${name} ist kein gültiges YAML: ${grund}`] };
  }
  return pruefeLehrplan(daten, lektionsIds);
}

/** Ein Lehrplan, der die Pruefung nicht besteht — die Seite zeigt ihn mit seinen Maengeln. */
export type Ungueltig = { readonly datei: string; readonly maengel: readonly string[] };

/**
 * Liest alle Lehrplaene, wie sie `import.meta.glob` liefert: Pfad -> Text.
 *
 * Nach Pfad sortiert, mit eigenem Vergleich statt `localeCompare` — das haengt
 * an der Spracheinstellung des Rechners, und der Bau soll ueberall dieselbe
 * Seite ergeben. Ein ungueltiger Lehrplan bricht nichts ab: Er landet in
 * `ungueltig`, und die Seite zeigt ihn als Warnung. Das ist auch der Zustand
 * zwischen Durchgang A und der Freigabe, in dem `geprueftVon` leer ist.
 */
export function lehrplaeneAusTexten(
  texte: Readonly<Record<string, string>>,
  lektionsIds: ReadonlySet<string>,
): { gueltig: Lehrplan[]; ungueltig: Ungueltig[] } {
  const gueltig: Lehrplan[] = [];
  const ungueltig: Ungueltig[] = [];
  const eintraege = Object.entries(texte).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  for (const [pfad, text] of eintraege) {
    const datei = pfad.slice(pfad.lastIndexOf('/') + 1);
    const befund = lehrplanAusYaml(text, lektionsIds, datei);
    if (befund.ok) gueltig.push(befund.lehrplan);
    else ungueltig.push({ datei, maengel: befund.maengel });
  }
  return { gueltig, ungueltig };
}
```

Gegenüber Aufgabe 1 neu: `HOECHSTZAHL_JE_ABSCHNITT`, `STATUS`, `SeiteSchema`, `AbschnittSchema` mit seinen vier Richtungen, `pruefeAbschnitte`, `BuchSchema`, `FolienSchema`, die Union mit drei Mitgliedern, die erweiterte Meldung `ART_FEHLT`, die Typen `Abschnitt` und `Status` und in `pruefeLehrplan` die Prüfung, dass es jede genannte Lektion gibt. Alles andere ist Wort für Wort dasselbe.

- [ ] **Schritt 4: Tests laufen lassen**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && npx vitest run tests/lehrplan-lehrmaterial.test.ts tests/lehrplan.test.ts tests/node-ladbarkeit-lehrplan.test.ts 2>&1 | grep -E "Tests |×"
```
Erwartet: `Tests  73 passed (73)` — 44 neu, 28 und 1 aus Aufgabe 1.

- [ ] **Schritt 5: Mutationsproben — jede Regel wird gefangen, und zwar dort, wo sie steht**

Jede Probe: vorübergehend ändern, laufen lassen, zurücknehmen.

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && npx vitest run tests/lehrplan-lehrmaterial.test.ts tests/lehrplan.test.ts 2>&1 | grep -E "Tests |×"
```

Alle Änderungen in `src/lib/lehrplan.ts`:

| Probe | vorübergehend ändern | Erwartet: genau diese Tests schlagen fehl |
|---|---|---|
| A — Grund Pflicht | `if (a.status === 'abgelehnt' && a.grund === undefined) {` → `if (false) {` | „verlangt einen Grund, wenn ein Abschnitt abgelehnt ist" |
| B — Grund verboten | `if (a.status !== 'abgelehnt' && a.grund !== undefined) {` → `if (false) {` | „weist einen Grund bei status offen zurueck", „… beauftragt zurueck" (zwei) |
| C — Lektion Pflicht | `if (a.status === 'lektion' && a.lektion === undefined) {` → `if (false) {` | „verlangt die Lektion, wenn der Status lektion ist" |
| D — Lektion verboten | `if (a.status !== 'lektion' && a.lektion !== undefined) {` → `if (false) {` | „weist eine Lektion neben einem anderen Status zurueck" |
| E — die Lektion gibt es | `a.lektion !== undefined && !lektionsIds.has(a.lektion)` → `false` | „weist eine Lektion zurueck, die es nicht gibt, und nennt die Datei", „faellt ohne bekannte Lektionen durch, nie durch", „laesst ohne Lektionsordner jeden Abschnitt mit Lektion durchfallen" (drei) |
| F — Ids eindeutig | `if (ids.has(a.id)) {` → `if (false) {` | „weist doppelte Abschnitt-Ids zurueck" |
| G — Berührung ist Überschneidung | `a.seiten[0] <= bisher` → `a.seiten[0] < bisher` | „weist sich beruehrende Bereiche zurueck — beide enthielten dieselbe Seite" |
| H — je Datei | `const bisher = ende.get(a.datei);` → `const bisher = ende.size > 0 ? Math.max(...ende.values()) : undefined;` | „nimmt dieselben Seiten in zwei Dateien an", „prueft je Datei, auch wenn sich die Dateien abwechseln" (zwei) |
| I — rückwärts | `([von, bis]) => von <= bis` → `() => true` | „weist einen Seitenbereich zurueck, der rueckwaerts laeuft" |
| J — drei je Abschnitt | in `.max(` des Abschnitts die Zeile `HOECHSTZAHL_JE_ABSCHNITT,` → `99,` | „weist das vierte Prinzip zurueck und sagt warum" |
| K — Folien ohne ISBN | bei `const FolienSchema = z` die Zeile `.strictObject({` → `.object({` | „weist ISBN und Auflage bei Folien zurueck", „weist Prinzipien auf oberster Ebene zurueck — …" (zwei) |

Probe E zeigt, warum die Prüfung außerhalb von Zod steht und trotzdem getestet ist: Ohne sie ginge ein Lehrplan durch, der eine Lektion als fertig meldet, die es nicht gibt — auf der Seite ein Verweis ins Leere. Probe H: Wer alle Dateien in einen Topf wirft, verbietet jedem zweiten Foliensatz, auf Folie 1 zu beginnen.

Alle Proben zurücknehmen, dann:

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && git diff --stat src/lib/lehrplan.ts && npx vitest run tests/lehrplan-lehrmaterial.test.ts tests/lehrplan.test.ts tests/node-ladbarkeit-lehrplan.test.ts 2>&1 | grep -E "Tests |×"
```
Erwartet: eine Zeile `src/lib/lehrplan.ts | …` (die Änderung dieser Aufgabe gegenüber Aufgabe 1, noch nicht committet), dann `Tests  73 passed (73)`. Vergleiche die Datei zur Sicherheit mit Schritt 3 — keine Probe darf stehen bleiben.

- [ ] **Schritt 6: Typen, NUL-Prüfung, Commit**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && python -c "import sys; print(sum(open(f,'rb').read().count(b'\x00') for f in sys.argv[1:]))" src/lib/lehrplan.ts tests/lehrplan-lehrmaterial.test.ts && npm run check 2>&1 | grep -E "^- [0-9]+ (error|warning|hint)" && git add src/lib/lehrplan.ts tests/lehrplan-lehrmaterial.test.ts && git commit -q -F - <<'MSG'
feat: Lehrplan Fassung 2 fuer Buch und Folien

Buch und Folien teilen eine Form: Abschnitte mit Datei, Seitenbereich
und Status (offen, beauftragt, lektion, abgelehnt). Der Auftrag an den
Compiler ist keine eigene Datei, sondern die Menge der Abschnitte mit
beauftragt.

Das Schema erzwingt, was der Spec verlangt, in beiden Richtungen: grund
genau bei abgelehnt, lektion genau bei lektion - und die Lektion muss
es geben. Diese Pruefung steht in pruefeLehrplan statt in Zod, weil
das Schema keine Dateien kennt; ohne Lektionsordner faellt jeder
Abschnitt mit Lektion durch. Abschnitt-Ids eindeutig, Seitenbereiche
je Datei aufsteigend und ohne Ueberschneidung (sich beruehrende
Bereiche teilen eine Seite), hoechstens drei Prinzipien je Abschnitt,
ISBN und Auflage nur beim Buch. datei ist immer Pflicht: Wie viele
Originale es gibt, weiss nur das Manifest.

Elf Mutationsproben, jede von genau den erwarteten Tests gefangen.

<CO-AUTHORED-BY>
MSG
```
Erwartet: `0`, `- 0 errors`, `- 0 warnings`, `- 0 hints`, danach ein Commit.

---

## Aufgabe 3: Der Vorbehalt in der Lektion

**Dateien:**
- Ändern: `src/content/schema.ts`, `src/layouts/LektionAnsicht.astro`
- Test: `tests/content-schema.test.ts` (anhängen), `tests/lektion-vorbehalt.test.ts` (neu)

Die Lektion bekommt `vorbehalt` als optionales Feld; `LektionAnsicht.astro` zeigt ihn im Takt 3, unmittelbar unter dem Satz. Die Gestaltung (`.vorbehalt`) kommt in Aufgabe 9 — bis dahin steht er als einfacher Absatz mit fettem „Vorbehalt:" da. Heute trägt keine Lektion einen Vorbehalt; der Bau ändert sich in dieser Aufgabe nicht.

- [ ] **Schritt 1: Die Tests für das Schema anhängen**

Ans Ende von `tests/content-schema.test.ts` anhängen, nach einer Leerzeile:

```ts
describe('LektionSchema - der Vorbehalt', () => {
  it('nimmt eine Lektion mit Vorbehalt an und gibt ihn getrimmt zurueck', () => {
    const d = LektionSchema.parse(lektion({ vorbehalt: '  Für diese Quoten gibt es keine belastbare Studie.  ' }));
    expect(d.vorbehalt).toBe('Für diese Quoten gibt es keine belastbare Studie.');
  });

  it('weist einen Vorbehalt zurueck, der ein Absatz ist', () => {
    const befund = LektionSchema.safeParse(lektion({ vorbehalt: 'Wort '.repeat(45).trim() }));
    expect(befund.success).toBe(false);
    expect(JSON.stringify(befund.error?.issues)).toContain('vorbehalt soll ein Satz sein, kein Absatz');
  });

  it('weist einen leeren Vorbehalt zurueck, statt ihn als keinen zu lesen', () => {
    const befund = LektionSchema.safeParse(lektion({ vorbehalt: '   ' }));
    expect(befund.success).toBe(false);
    expect(JSON.stringify(befund.error?.issues)).toContain('vorbehalt braucht einen Satz');
  });
});
```

- [ ] **Schritt 2: Den Darstellungstest schreiben**

`tests/lektion-vorbehalt.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { loadRenderers } from 'astro:container';
import { getContainerRenderer } from '@astrojs/react/container-renderer';
import LektionAnsicht from '../src/layouts/LektionAnsicht.astro';
import type { Lektion } from '../src/content/schema';

/**
 * Der Vorbehalt steht unter dem Satz — gerendert geprueft, nicht nur gelesen.
 *
 * `tests/lektion-ansicht.test.ts` liest das Markup als Text; das genuegt fuer
 * die Reihenfolge fester Abschnitte. Der Vorbehalt ist aber bedingt: Er darf
 * nur erscheinen, wenn es ihn gibt, und dann nicht als leerer Kasten. Das
 * zeigt nur eine gerenderte Seite. Der Container von Astro rendert sie ohne
 * Bau; die React-Inseln der Probe braucht er als Renderer mit.
 *
 * `experimental_AstroContainer` heisst so, weil Astro die Schnittstelle noch
 * aendern darf. Bricht dieser Test nach einem Update von Astro, liegt es
 * vermutlich daran — nicht am Vorbehalt.
 *
 * Die Umgebung ist `node`, nicht jsdom: Unter jsdom erkennt Astro die
 * Komponente nicht als eigene und meldet „No valid renderer".
 */

const begruendung = (n: number) => `Begruendung Nummer ${n} mit genug Woertern darin.`;
const wahl = (id: string) => ({
  typ: 'wahl' as const,
  id,
  frage: 'Eine Frage?',
  antworten: [
    { text: 'Richtig', richtig: true, begruendung: begruendung(1) },
    { text: 'Falsch A', richtig: false, begruendung: begruendung(2) },
    { text: 'Falsch B', richtig: false, begruendung: begruendung(3) },
  ],
});

const daten: Lektion = {
  titel: 'Eine Lektion',
  prinzip: 'Ein Satz, der etwas behauptet.',
  reihenfolge: 1,
  gesperrt: false,
  aufgaben: [wahl('a-1'), wahl('a-2')],
  transfer: wahl('a-t'),
  quellen: [{ pfad: 'Folie 12' }],
};

async function rendere(lektion: Lektion): Promise<string> {
  const renderers = await loadRenderers([getContainerRenderer()]);
  const container = await AstroContainer.create({ renderers });
  return container.renderToString(LektionAnsicht, { props: { id: 'probe', daten: lektion } });
}

describe('LektionAnsicht - der Vorbehalt', () => {
  it('steht unter dem Satz und vor der Probe, mit „Vorbehalt:" davor', async () => {
    const html = await rendere({ ...daten, vorbehalt: 'Für diese Quoten gibt es keine belastbare Studie.' });
    const element = '<p class="vorbehalt"><strong>Vorbehalt:</strong> Für diese Quoten gibt es keine belastbare Studie.</p>';
    expect(html).toContain(element);
    const satz = html.indexOf('<p class="prinzip">');
    const vorbehalt = html.indexOf(element);
    const probe = html.indexOf('data-takt="probe"');
    expect(satz).toBeGreaterThan(-1);
    expect(vorbehalt).toBeGreaterThan(satz);
    expect(probe).toBeGreaterThan(vorbehalt);
  });

  it('erscheint ohne Vorbehalt gar nicht — kein leerer Kasten', async () => {
    const html = await rendere(daten);
    expect(html).toContain('<p class="prinzip">Ein Satz, der etwas behauptet.</p>');
    expect(html).not.toContain('class="vorbehalt"');
  });
});
```

- [ ] **Schritt 3: Tests laufen lassen, Fehlschlag ansehen**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && npx vitest run tests/content-schema.test.ts tests/lektion-vorbehalt.test.ts 2>&1 | grep -E "Tests |×"
```
Erwartet: `Tests  4 failed | 13 passed (17)` — rot sind genau die vier neuen: „nimmt eine Lektion mit Vorbehalt an und gibt ihn getrimmt zurueck“, „weist einen Vorbehalt zurueck, der ein Absatz ist“, „weist einen leeren Vorbehalt zurueck, statt ihn als keinen zu lesen“ und „steht unter dem Satz und vor der Probe, mit „Vorbehalt:“ davor“. Nach Schritt 5: `Tests  17 passed (17)`.

- [ ] **Schritt 4: Das Feld ins Lektionsschema**

In `src/content/schema.ts` diese Stelle

```ts
      .max(200, 'prinzip soll ein Satz sein, kein Absatz (max. 200 Zeichen).'),
    reihenfolge: z.number().int().positive(),
```

ersetzen durch

```ts
      .max(200, 'prinzip soll ein Satz sein, kein Absatz (max. 200 Zeichen).'),
    // Der Vorbehalt kommt aus dem Lehrplan: Die Quelle behauptet etwas, das
    // sich nicht belegen laesst oder dem Stand der Forschung widerspricht.
    // Die Lektion zeigt ihn unter dem Satz — Pruefungsstoff bleibt lernbar,
    // ohne dass die App ihn als gesichert ausgibt. Gemessen wie `prinzip`.
    vorbehalt: z
      .string()
      .trim()
      .min(1, 'vorbehalt braucht einen Satz — sonst das Feld weglassen.')
      .max(200, 'vorbehalt soll ein Satz sein, kein Absatz (max. 200 Zeichen).')
      .optional(),
    reihenfolge: z.number().int().positive(),
```

`LektionSchema` bleibt `z.object` und nicht strikt: Ohne dieses Feld würde ein Vorbehalt in einer Lektion **stillschweigend verworfen** — genau das, was die Tests aus Schritt 1 im roten Lauf gezeigt haben.

- [ ] **Schritt 5: Den Vorbehalt unter den Satz setzen**

In `src/layouts/LektionAnsicht.astro` diese Stelle

```astro
      <p class="prinzip">{daten.prinzip}</p>
    </section>
```

ersetzen durch

```astro
      <p class="prinzip">{daten.prinzip}</p>
      {/* Der Vorbehalt gehoert zum Satz und steht deshalb in seinem Takt,
          unmittelbar darunter: Die Quelle behauptet hier etwas, das sich
          nicht belegen laesst. Sichtbar, nicht im Kleingedruckten — und
          ohne Vorbehalt gar nicht, auch nicht als leerer Kasten. Das Wort
          „Vorbehalt:" steht im Text, damit es auch vorgelesen wird. */}
      {daten.vorbehalt !== undefined && (
        <p class="vorbehalt"><strong>Vorbehalt:</strong> {daten.vorbehalt}</p>
      )}
    </section>
```

`<strong>` und der Text stehen auf **einer** Quelltextzeile (Regel 15).

- [ ] **Schritt 6: Tests laufen lassen**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && npx vitest run tests/content-schema.test.ts tests/lektion-vorbehalt.test.ts tests/lektion-ansicht.test.ts 2>&1 | grep -E "Tests |×"
```
Erwartet: `Tests  18 passed (18)` — 15 im Schema, 2 im Darstellungstest, 1 in der Reihenfolge der Takte (unverändert grün: Der Vorbehalt steht in Takt 3, vor der Probe).

- [ ] **Schritt 7: Mutationsproben**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && npx vitest run tests/content-schema.test.ts tests/lektion-vorbehalt.test.ts 2>&1 | grep -E "Tests |×"
```

**A — kein leerer Kasten.** In `src/layouts/LektionAnsicht.astro` `{daten.vorbehalt !== undefined && (` ändern zu `{(`. Erwartet: **genau ein** Test schlägt fehl — „erscheint ohne Vorbehalt gar nicht — kein leerer Kasten". Jede Lektion ohne Vorbehalt trüge sonst ein leeres „Vorbehalt:" unter ihrem Satz; ein Text-Test auf das Markup sähe das nicht.

**B — ein Satz, kein Absatz.** In `src/content/schema.ts` `.max(200, 'vorbehalt soll ein Satz sein` ändern zu `.max(2000, 'vorbehalt soll ein Satz sein`. Erwartet: **genau ein** Test schlägt fehl — „weist einen Vorbehalt zurueck, der ein Absatz ist".

Beide zurücknehmen, dann den Befehl oben noch einmal: `Tests  17 passed (17)`.

- [ ] **Schritt 8: Typen, Bau, NUL-Prüfung, Commit**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && python -c "import sys; print(sum(open(f,'rb').read().count(b'\x00') for f in sys.argv[1:]))" src/content/schema.ts src/layouts/LektionAnsicht.astro tests/content-schema.test.ts tests/lektion-vorbehalt.test.ts && npm run check 2>&1 | grep -E "^- [0-9]+ (error|warning|hint)" && npm run build 2>&1 | grep -E "page\(s\)" && (grep -l 'class="vorbehalt"' dist/lektion/*/index.html || echo "keine Lektion mit Vorbehalt") && git add src/content/schema.ts src/layouts/LektionAnsicht.astro tests/content-schema.test.ts tests/lektion-vorbehalt.test.ts && git commit -q -F - <<'MSG'
feat: Vorbehalt in der Lektion, sichtbar unter dem Satz

Behauptet eine Quelle etwas ohne Beleg, bekommt die Lektion einen
vorbehalt: ein Satz, gemessen wie prinzip. LektionAnsicht zeigt ihn im
Takt 3 unmittelbar unter dem Satz, das Wort Vorbehalt steht im Text und
wird vorgelesen. Ohne Vorbehalt kein Element, auch kein leeres.

Der Test rendert die Ansicht mit dem Container von Astro, samt den
React-Inseln der Probe: Ein bedingtes Element sieht nur eine gerenderte
Seite. Mutationsprobe: das Element ohne Bedingung wird gefangen.

<CO-AUTHORED-BY>
MSG
```
Erwartet: `0`, `- 0 errors`, `- 0 warnings`, `- 0 hints`, **SEITEN** `page(s) built`, `keine Lektion mit Vorbehalt`, danach ein Commit.

---

## Aufgabe 4: Was die Seite aus einem Manifest liest — `manifestauszug.ts`

**Dateien:**
- Neu: `src/lib/manifestauszug.ts`
- Test: `tests/manifestauszug.test.ts`

Das Manifest ist groß und trägt viel mehr, als die Seite braucht. `leseManifestauszug` holt Stand und Summen heraus und wirft nie: Was sich nicht lesen lässt, ist `unlesbar` mit Grund. Gelesen wird Fassung 2, die der Git-Adapter schreibt. Die Form `dokument` für Bücher und Folien steht schon im Typ (Präzisierung 11); einen Leser dafür gibt es erst mit Manifest Fassung 3 in 2b.

- [ ] **Schritt 1: Den fehlschlagenden Test schreiben**

`tests/manifestauszug.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { leseManifestauszug, manifesteAusTexten } from '../src/lib/manifestauszug';

/**
 * Ein Manifest der Fassung 2, wie es `werkzeug/manifest.mjs` schreibt — mit
 * leeren Listen, weil der Leser nur Stand und Summen braucht. `bytes` und
 * `gestempeltAm` stehen mit Absicht da: Der Leser muss uebergehen, was er
 * nicht braucht, statt daran zu scheitern.
 */
const fassung2 = {
  fassung: 2,
  gestempeltAm: '2026-09-01T17:58:28.830Z',
  herkunft: {
    art: 'git',
    url: 'https://github.com/Beispiel/repo.git',
    unterpfad: 'rag_tutorials',
    sha: 'a13701eae315a81e1011a4304a6b5e741ea0a984',
  },
  summe: { uebernommen: 62, ausgelassen: 44, bytes: 453294 },
  uebernommen: [],
  ausgelassen: [],
};

/** Legt die Aenderung stumpf ueber das gueltige Manifest und gibt den Text zurueck. */
function text(aenderung: Record<string, unknown> = {}): string {
  return JSON.stringify({ ...fassung2, ...aenderung });
}

describe('leseManifestauszug', () => {
  it('liest Stand und Summen aus Fassung 2', () => {
    expect(leseManifestauszug(text())).toEqual({
      art: 'git',
      stand: 'a13701eae315a81e1011a4304a6b5e741ea0a984',
      uebernommen: 62,
      ausgelassen: 44,
    });
  });

  it('nennt eine Fassung, die diese Seite nicht kennt, beim Namen', () => {
    expect(leseManifestauszug(text({ fassung: 3 }))).toEqual({
      art: 'unlesbar',
      grund: 'Fassung 3 kennt diese Seite nicht',
    });
  });

  it('nimmt Fassung 2 ohne Summen nicht fuer bare Muenze', () => {
    const { summe: _summe, ...ohne } = fassung2;
    expect(leseManifestauszug(JSON.stringify(ohne))).toEqual({
      art: 'unlesbar',
      grund: 'Fassung 2, aber unvollständig',
    });
  });

  it('weist eine Herkunft zurueck, die kein Git ist — Fassung 2 schreibt nur der Git-Adapter', () => {
    expect(leseManifestauszug(text({ herkunft: { ...fassung2.herkunft, art: 'pdf' } }))).toEqual({
      art: 'unlesbar',
      grund: 'Fassung 2, aber unvollständig',
    });
  });

  // Als Tripel aus Name, Text und Grund: `it.each` breitet eine blanke Liste
  // als Argumente aus.
  it.each([
    ['kaputtem JSON', '{"fassung": 2,', 'kein gültiges JSON'],
    ['einem leeren Text', '', 'kein gültiges JSON'],
    ['null', 'null', 'ohne Fassung'],
    ['einer Zahl', '42', 'ohne Fassung'],
    ['einem Text', '"manifest"', 'ohne Fassung'],
    ['einer Liste', '[]', 'ohne Fassung'],
    ['einem leeren Objekt', '{}', 'ohne Fassung'],
    ['einer Fassung als Text', '{"fassung": "2"}', 'ohne Fassung'],
  ])('macht aus %s „unlesbar", ohne zu werfen', (_name, roh, grund) => {
    expect(leseManifestauszug(roh)).toEqual({ art: 'unlesbar', grund });
  });
});

describe('manifesteAusTexten', () => {
  it('schluesselt nach dem Ordner unter quellen/', () => {
    const karte = manifesteAusTexten({
      '/quellen/awesome-llm-apps/manifest.json': text(),
      '/quellen/kaputt/manifest.json': '{',
    });
    expect([...karte.keys()].sort()).toEqual(['awesome-llm-apps', 'kaputt']);
    expect(karte.get('awesome-llm-apps')?.art).toBe('git');
    expect(karte.get('kaputt')).toEqual({ art: 'unlesbar', grund: 'kein gültiges JSON' });
  });

  it('liefert eine leere Karte, wo nicht eingelesen wurde', () => {
    // So baut GitHub: `quellen/` ist gitignored, der Glob findet nichts.
    expect(manifesteAusTexten({}).size).toBe(0);
  });
});
```

- [ ] **Schritt 2: Test laufen lassen, Fehlschlag ansehen**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && npx vitest run tests/manifestauszug.test.ts 2>&1 | grep -E "Tests |Failed to resolve"
```
Erwartet: FAIL mit `Failed to resolve import "../src/lib/manifestauszug"`.

- [ ] **Schritt 3: Den Leser anlegen**

`src/lib/manifestauszug.ts`:

```ts
import { z } from 'astro/zod';

/**
 * Was die Seite /bibliothek aus einem Manifest braucht — und nur das.
 *
 * Das Manifest (`quellen/<kurzname>/manifest.json`) ist der
 * Herkunftsnachweis eines Rohmaterialstands. Die Seite liest daraus zwei
 * Dinge: zu welchem Stand es gehoert, und was die Quelle nicht hergibt. Sie
 * liest es zur Bauzeit; im Browser kommt davon nur an, was die Seite daraus
 * macht.
 *
 * `quellen/` ist gitignored. Wo gebaut wird, ohne dass eingelesen wurde — auf
 * GitHub zum Beispiel —, gibt es kein Manifest. Das ist kein Fehler, sondern
 * ein Zustand, den die Seite benennt (siehe `abdeckung.ts`).
 *
 * Gelesen wird Fassung 2, die der Git-Adapter schreibt. Die Form fuer Buecher
 * und Folien (`dokument`) steht schon im Typ, weil `abdeckung` sie verrechnet;
 * den Leser dafuer bringt das Einlesen von Lehrmaterial mit, zusammen mit der
 * Fassung, die es schreibt. Bis dahin ist jede andere Fassung `unlesbar`.
 */
export type Manifestauszug =
  | {
      readonly art: 'git';
      /** Der Commit-SHA, aus dem eingelesen wurde. */
      readonly stand: string;
      readonly uebernommen: number;
      readonly ausgelassen: number;
    }
  | {
      readonly art: 'dokument';
      /** Der Hash ueber die Originale, `sha256:…`. */
      readonly stand: string;
      /** Seiten aller Originale zusammen. */
      readonly seiten: number;
      /** Seiten, auf denen nach dem Briefkopf kein Text steht, aber ein Bild. */
      readonly nurBild: number;
      /** Seiten, deren Text nach einer zerfallenen Tabelle aussieht. */
      readonly tabellenverdacht: number;
    }
  | { readonly art: 'unlesbar'; readonly grund: string };

/**
 * Fassung 2, soweit die Seite sie braucht. `z.object` und nicht
 * `strictObject`: Das Manifest traegt viel mehr, und das ist richtig so —
 * hier wird nicht das Manifest geprueft, sondern herausgelesen.
 */
const Fassung2Schema = z.object({
  fassung: z.literal(2),
  herkunft: z.object({ art: z.literal('git'), sha: z.string().trim().min(7) }),
  summe: z.object({
    uebernommen: z.number().int().min(0),
    ausgelassen: z.number().int().min(0),
  }),
});

/** Liest den Auszug aus dem Text einer `manifest.json`. Wirft nie. */
export function leseManifestauszug(text: string): Manifestauszug {
  let roh: unknown;
  try {
    roh = JSON.parse(text);
  } catch {
    return { art: 'unlesbar', grund: 'kein gültiges JSON' };
  }

  const fassung = typeof roh === 'object' && roh !== null && 'fassung' in roh ? roh.fassung : undefined;
  if (typeof fassung !== 'number') return { art: 'unlesbar', grund: 'ohne Fassung' };
  if (fassung !== 2) return { art: 'unlesbar', grund: `Fassung ${fassung} kennt diese Seite nicht` };

  const befund = Fassung2Schema.safeParse(roh);
  if (!befund.success) return { art: 'unlesbar', grund: 'Fassung 2, aber unvollständig' };
  return {
    art: 'git',
    stand: befund.data.herkunft.sha,
    uebernommen: befund.data.summe.uebernommen,
    ausgelassen: befund.data.summe.ausgelassen,
  };
}

/**
 * Liest alle Manifeste, wie sie `import.meta.glob` liefert: Pfad -> Text.
 * Der Schluessel der Karte ist der Kurzname — der Ordner unter `quellen/`,
 * der im Lehrplan als `quelle` steht.
 */
export function manifesteAusTexten(texte: Readonly<Record<string, string>>): Map<string, Manifestauszug> {
  const manifeste = new Map<string, Manifestauszug>();
  for (const [pfad, text] of Object.entries(texte)) {
    const teile = pfad.split('/');
    const kurzname = teile[teile.length - 2];
    if (kurzname) manifeste.set(kurzname, leseManifestauszug(text));
  }
  return manifeste;
}
```

- [ ] **Schritt 4: Test laufen lassen**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && npx vitest run tests/manifestauszug.test.ts 2>&1 | grep -E "Tests |×"
```
Erwartet: `Tests  14 passed (14)`.

- [ ] **Schritt 5: Mutationsproben**

Den Befehl aus Schritt 4 je Probe laufen lassen; alle Änderungen in `src/lib/manifestauszug.ts`:

| Probe | vorübergehend ändern | Erwartet: genau dieser Test schlägt fehl |
|---|---|---|
| A — fremde Fassung | `if (fassung !== 2) return` → `if (false) return` | „nennt eine Fassung, die diese Seite nicht kennt, beim Namen" |
| B — nur Git | `herkunft: z.object({ art: z.literal('git'),` → `herkunft: z.object({ art: z.string(),` | „weist eine Herkunft zurueck, die kein Git ist — …" |
| C — Fassung als Zahl | `if (typeof fassung !== 'number') return` → `if (fassung === undefined) return` | „macht aus einer Fassung als Text „unlesbar", ohne zu werfen" |
| D — Schlüssel | `const kurzname = teile[teile.length - 2];` → `const kurzname = teile[teile.length - 1];` | „schluesselt nach dem Ordner unter quellen/" |

Probe A ist die wichtige: Ohne die Abfrage läse die Seite ein Manifest der Fassung 3 wie eines der Fassung 2 — und meldete nicht „diese Fassung kenne ich nicht", sondern „unvollständig", also einen Fehler, den es nicht gibt.

Alle zurücknehmen, dann den Befehl aus Schritt 4: `Tests  14 passed (14)`.

- [ ] **Schritt 6: Typen, NUL-Prüfung, Commit**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && python -c "import sys; print(sum(open(f,'rb').read().count(b'\x00') for f in sys.argv[1:]))" src/lib/manifestauszug.ts tests/manifestauszug.test.ts && npm run check 2>&1 | grep -E "^- [0-9]+ (error|warning|hint)" && git add src/lib/manifestauszug.ts tests/manifestauszug.test.ts && git commit -q -F - <<'MSG'
feat: Manifestauszug - was die Bibliothek aus einem Manifest liest

Stand und Summen aus Manifest Fassung 2, und sonst nichts. Wirft nie:
kaputtes JSON, eine fremde Fassung oder ein unvollstaendiges Manifest
ergeben unlesbar mit Grund, jede Eingabeform ist einmal durchgespielt.

Die Form fuer Buecher und Folien steht schon im Typ, weil die Abdeckung
sie verrechnet; den Leser dafuer bringt das Einlesen von Lehrmaterial
mit der Fassung mit, die es schreibt.

<CO-AUTHORED-BY>
MSG
```
Erwartet: `0`, `- 0 errors`, `- 0 warnings`, `- 0 hints`, danach ein Commit.

---

## Aufgabe 5: Die Abdeckung — `abdeckung.ts`

**Dateien:**
- Neu: `src/lib/abdeckung.ts`
- Test: `tests/abdeckung.test.ts`

Eine reine Funktion: Lehrpläne, Manifestauszüge und Lektion-Ids hinein, `{ bestand, ohneLehrplan }` heraus. Kein Dateizugriff — das Einlesen macht die Seite. Die Lehrpläne in den Tests laufen durch `pruefeLehrplan`, bevor sie verrechnet werden, genau wie auf der Seite: Eine Hilfe, die ungeprüfte Objekte als Lehrplan ausgibt, testete eine Eingabe, die es nie gibt. Der letzte Test liest den echten Bestand aus `lehrplan/` und `inhalt/lektionen/` — beide stehen im Git, der Test läuft also auch auf GitHub — und hält die Zahlen vom 2026-09-22 fest.

- [ ] **Schritt 1: Den fehlschlagenden Test schreiben**

`tests/abdeckung.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { abdeckung } from '../src/lib/abdeckung';
import { lehrplaeneAusTexten, pruefeLehrplan, type Lehrplan } from '../src/lib/lehrplan';
import type { Manifestauszug } from '../src/lib/manifestauszug';

/**
 * Die Abdeckung ist eine reine Funktion: Lehrplaene, Manifestauszuege und
 * Lektion-Ids hinein, der Bestand heraus. Die Lehrplaene hier laufen durch
 * `pruefeLehrplan`, bevor sie verrechnet werden — genau wie auf der Seite.
 * Eine Hilfe, die ungepruefte Objekte als Lehrplan ausgibt, testete eine
 * Eingabe, die es nie gibt.
 */

const LEKTIONEN = new Set(['lektion-a', 'lektion-b', 'pauschal-heisst-nicht-komplett']);
const KEINE_MANIFESTE = new Map<string, Manifestauszug>();
const SHA = 'a13701eae315a81e1011a4304a6b5e741ea0a984';
const HASH = `sha256:${'b'.repeat(64)}`;

function gepruefter(daten: unknown, lektionen: ReadonlySet<string> = LEKTIONEN): Lehrplan {
  const e = pruefeLehrplan(daten, lektionen);
  if (!e.ok) throw new Error(`Die Vorlage selbst ist ungueltig:\n  ${e.maengel.join('\n  ')}`);
  return e.lehrplan;
}

function prinzip(id: string, vorbehalt?: string) {
  return {
    id,
    satz: `Der Satz zu ${id}.`,
    warumNichtOffensichtlich: 'Weil es anders aussieht.',
    belege: ['beleg'],
    widget: 'Pipeline',
    ...(vorbehalt === undefined ? {} : { vorbehalt }),
  };
}

function repo(quelle: string, ...prinzipien: ReturnType<typeof prinzip>[]): Lehrplan {
  return gepruefter({
    art: 'repo',
    quelle,
    stand: SHA,
    geprueftVon: 'Daniel Nobs',
    geprueftAm: '2026-09-22',
    prinzipien,
  });
}

function lehrmaterial(art: 'buch' | 'folien', abschnitte: Record<string, unknown>[], extra: Record<string, unknown> = {}): Lehrplan {
  return gepruefter({
    art,
    quelle: 'bauch-projektmanagement',
    titel: 'Projektmanagement',
    stand: HASH,
    geprueftVon: 'Daniel Nobs',
    geprueftAm: '2026-09-22',
    abschnitte,
    ...extra,
  });
}

function abschnitt(id: string, von: number, status: string, extra: Record<string, unknown> = {}) {
  return { id, titel: `Titel ${id}`, datei: 'M7.pdf', seiten: [von, von + 1], status, ...extra };
}

/** Fuenf Abschnitte, je einer pro Status und ein zweiter offener. */
const fuenf = [
  abschnitt('m7-1', 1, 'lektion', { lektion: 'pauschal-heisst-nicht-komplett' }),
  abschnitt('m7-2', 3, 'offen'),
  abschnitt('m7-3', 5, 'offen'),
  abschnitt('m7-4', 7, 'beauftragt'),
  abschnitt('m7-5', 9, 'abgelehnt', { grund: 'reine Titelfolien' }),
];

describe('abdeckung - Repo', () => {
  it('zaehlt ein Prinzip mit gleichnamiger Lektion als abgedeckt, die anderen als offen', () => {
    const { bestand } = abdeckung(
      [repo('r', prinzip('lektion-a'), prinzip('fehlt-noch'), prinzip('lektion-b'))],
      KEINE_MANIFESTE,
      LEKTIONEN,
    );
    expect(bestand[0]?.zaehlung).toEqual({ gesamt: 3, mitLektion: 2, offen: 1, beauftragt: 0, abgelehnt: 0 });
    expect(bestand[0]?.zeilen.map((z) => [z.id, z.status, z.lektion])).toEqual([
      ['lektion-a', 'lektion', 'lektion-a'],
      ['fehlt-noch', 'offen', undefined],
      ['lektion-b', 'lektion', 'lektion-b'],
    ]);
  });

  it('nimmt den Satz als Zeile und den Kurznamen als Titel der Karte', () => {
    const { bestand } = abdeckung([repo('awesome', prinzip('p-1'), prinzip('p-2'))], KEINE_MANIFESTE, LEKTIONEN);
    expect(bestand[0]).toMatchObject({ quelle: 'awesome', art: 'repo', titel: 'awesome', stand: SHA });
    expect(bestand[0]?.zeilen[0]?.titel).toBe('Der Satz zu p-1.');
  });

  it('reicht den Vorbehalt eines Prinzips an seine Zeile weiter', () => {
    const { bestand } = abdeckung(
      [repo('r', prinzip('p-1', 'Nicht belegt.'), prinzip('p-2'))],
      KEINE_MANIFESTE,
      LEKTIONEN,
    );
    expect(bestand[0]?.zeilen.map((z) => z.vorbehalte)).toEqual([['Nicht belegt.'], []]);
  });
});

describe('abdeckung - Buch und Folien', () => {
  it('zaehlt die Abschnitte nach ihrem Status', () => {
    const { bestand } = abdeckung([lehrmaterial('folien', fuenf)], KEINE_MANIFESTE, LEKTIONEN);
    expect(bestand[0]?.zaehlung).toEqual({ gesamt: 5, mitLektion: 1, offen: 2, beauftragt: 1, abgelehnt: 1 });
  });

  it('uebernimmt Titel, Grund, Lektion, Datei und Seiten in die Zeile', () => {
    const { bestand } = abdeckung([lehrmaterial('folien', fuenf)], KEINE_MANIFESTE, LEKTIONEN);
    const [lektion, offen, , , abgelehnt] = bestand[0]?.zeilen ?? [];
    expect(lektion).toMatchObject({ titel: 'Titel m7-1', status: 'lektion', lektion: 'pauschal-heisst-nicht-komplett', datei: 'M7.pdf', seiten: [1, 2] });
    expect(offen?.lektion).toBeUndefined();
    expect(abgelehnt).toMatchObject({ status: 'abgelehnt', grund: 'reine Titelfolien' });
    expect(bestand[0]?.titel).toBe('Projektmanagement');
  });

  it('sammelt die Vorbehalte aller Prinzipien eines Abschnitts', () => {
    const mitDreien = abschnitt('m7-1', 1, 'offen', {
      prinzipien: [prinzip('p-1', 'Erster Vorbehalt.'), prinzip('p-2'), prinzip('p-3', 'Zweiter Vorbehalt.')],
    });
    const { bestand } = abdeckung([lehrmaterial('folien', [mitDreien])], KEINE_MANIFESTE, LEKTIONEN);
    expect(bestand[0]?.zeilen[0]?.vorbehalte).toEqual(['Erster Vorbehalt.', 'Zweiter Vorbehalt.']);
  });

  it('fuehrt ISBN und Auflage nur beim Buch', () => {
    const extra = { isbn: '978-3-658-00000-0', auflage: '3. Auflage' };
    const buch = abdeckung([lehrmaterial('buch', fuenf, extra)], KEINE_MANIFESTE, LEKTIONEN).bestand[0];
    const folien = abdeckung([lehrmaterial('folien', fuenf)], KEINE_MANIFESTE, LEKTIONEN).bestand[0];
    expect([buch?.isbn, buch?.auflage]).toEqual(['978-3-658-00000-0', '3. Auflage']);
    expect([folien?.isbn, folien?.auflage]).toEqual([undefined, undefined]);
  });
});

describe('abdeckung - Lektionen ohne Lehrplaneintrag', () => {
  it('nennt Lektionen, auf die kein Prinzip und kein Abschnitt zeigt — sortiert', () => {
    const lektionen = new Set(['z-lektion', 'lektion-a', 'a-lektion', 'pauschal-heisst-nicht-komplett']);
    const { ohneLehrplan } = abdeckung(
      [repo('r', prinzip('lektion-a'), prinzip('p-2')), lehrmaterial('folien', fuenf)],
      KEINE_MANIFESTE,
      lektionen,
    );
    expect(ohneLehrplan).toEqual(['a-lektion', 'z-lektion']);
  });

  it('fuehrt ohne Lehrplan jede Lektion als ohne Eintrag', () => {
    expect(abdeckung([], KEINE_MANIFESTE, new Set(['b', 'a']))).toEqual({ bestand: [], ohneLehrplan: ['a', 'b'] });
  });

  it('liefert fuer gar nichts gar nichts', () => {
    expect(abdeckung([], KEINE_MANIFESTE, new Set())).toEqual({ bestand: [], ohneLehrplan: [] });
  });
});

describe('abdeckung - was die Quelle nicht hergibt', () => {
  const git: Manifestauszug = { art: 'git', stand: SHA, uebernommen: 62, ausgelassen: 44 };
  const dokument: Manifestauszug = { art: 'dokument', stand: HASH, seiten: 35, nurBild: 7, tabellenverdacht: 2 };
  const luecken = (lehrplan: Lehrplan, manifeste: Map<string, Manifestauszug>) =>
    abdeckung([lehrplan], manifeste, LEKTIONEN).bestand[0]?.luecken;
  const einRepo = () => repo('awesome', prinzip('p-1'), prinzip('p-2'));

  it('fehlt, wenn es kein Manifest gibt — so baut GitHub', () => {
    expect(luecken(einRepo(), new Map())).toEqual({ art: 'fehlt' });
  });

  it('sucht das Manifest unter dem Kurznamen der Quelle', () => {
    expect(luecken(einRepo(), new Map([['andere-quelle', git]]))).toEqual({ art: 'fehlt' });
  });

  it('nimmt die Summen aus dem Manifest, wenn der Stand stimmt', () => {
    expect(luecken(einRepo(), new Map([['awesome', git]]))).toEqual({ art: 'git', uebernommen: 62, ausgelassen: 44 });
  });

  it('zeigt keine Zahlen aus einem Manifest zu einem anderen Stand', () => {
    // Neu eingelesen, Lehrplan nicht nachgezogen: Die Zahlen gehoerten zu
    // einem Bestand, den diese Seite gar nicht zeigt.
    const anderer: Manifestauszug = { ...git, stand: 'ffffffffffffffffffffffffffffffffffffffff' };
    expect(luecken(einRepo(), new Map([['awesome', anderer]]))).toEqual({ art: 'anderer-stand' });
  });

  it('reicht den Grund eines unlesbaren Manifests weiter', () => {
    const kaputt: Manifestauszug = { art: 'unlesbar', grund: 'kein gültiges JSON' };
    expect(luecken(einRepo(), new Map([['awesome', kaputt]]))).toEqual({ art: 'unlesbar', grund: 'kein gültiges JSON' });
  });

  it('zaehlt bei Folien in Folien und beim Buch in Seiten', () => {
    const manifeste = new Map([['bauch-projektmanagement', dokument]]);
    expect(luecken(lehrmaterial('folien', fuenf), manifeste)).toEqual({
      art: 'dokument',
      einheit: 'folien',
      seiten: 35,
      nurBild: 7,
      tabellenverdacht: 2,
    });
    expect(luecken(lehrmaterial('buch', fuenf), manifeste)).toMatchObject({ art: 'dokument', einheit: 'seiten' });
  });

  it('nimmt ein Manifest der falschen Art nicht, auch bei gleichem Stand', () => {
    const gitMitHash: Manifestauszug = { ...git, stand: HASH };
    const dokumentMitSha: Manifestauszug = { ...dokument, stand: SHA };
    expect(luecken(lehrmaterial('folien', fuenf), new Map([['bauch-projektmanagement', gitMitHash]]))).toEqual({
      art: 'anderer-stand',
    });
    expect(luecken(einRepo(), new Map([['awesome', dokumentMitSha]]))).toEqual({ art: 'anderer-stand' });
  });
});

describe('abdeckung - Reihenfolge', () => {
  it('sortiert die Karten nach Kurzname, unabhaengig von der Eingabe', () => {
    const { bestand } = abdeckung(
      [repo('zeta', prinzip('p-1'), prinzip('p-2')), repo('alpha', prinzip('p-3'), prinzip('p-4'))],
      KEINE_MANIFESTE,
      LEKTIONEN,
    );
    expect(bestand.map((b) => b.quelle)).toEqual(['alpha', 'zeta']);
  });
});

describe('der heutige Bestand', () => {
  /**
   * Haelt fest, was am 2026-09-22 gemessen wurde: ein Lehrplan, sechs
   * Prinzipien, drei davon mit Lektion, und zwei Lektionen ohne
   * Lehrplaneintrag. Aendert sich der Bestand — eine neue Lektion, ein neuer
   * Lehrplan —, wird dieser Test nachgezogen, und der Commit sagt warum.
   *
   * Ohne Manifeste: `quellen/` ist gitignored, und dieser Test laeuft auch
   * dort, wo nicht eingelesen wurde. Was das Manifest beitraegt, prueft die
   * Abnahme am gebauten Stand.
   */
  it('stimmt mit dem ueberein, was gemessen wurde', () => {
    const wurzel = path.resolve(__dirname, '..');
    const lektionen = new Set(
      readdirSync(path.join(wurzel, 'inhalt', 'lektionen'))
        .filter((name) => name.endsWith('.mdx'))
        .map((name) => name.slice(0, -'.mdx'.length)),
    );
    const texte = Object.fromEntries(
      readdirSync(path.join(wurzel, 'lehrplan'))
        .filter((name) => name.endsWith('.yaml'))
        .map((name) => [`/lehrplan/${name}`, readFileSync(path.join(wurzel, 'lehrplan', name), 'utf8')]),
    );
    const { gueltig, ungueltig } = lehrplaeneAusTexten(texte, lektionen);
    expect(ungueltig).toEqual([]);

    const { bestand, ohneLehrplan } = abdeckung(gueltig, KEINE_MANIFESTE, lektionen);
    expect(bestand.map((b) => [b.quelle, b.art])).toEqual([['awesome-llm-apps', 'repo']]);
    expect(bestand[0]?.zaehlung).toEqual({ gesamt: 6, mitLektion: 3, offen: 3, beauftragt: 0, abgelehnt: 0 });
    expect(bestand[0]?.zeilen.filter((z) => z.status === 'lektion').map((z) => z.id)).toEqual([
      'kein-boden-ist-ein-boden',
      'kontrollfluss-folgt-modellstaerke',
      'auslagern-nimmt-die-grundlage',
    ]);
    expect(ohneLehrplan).toEqual(['pauschal-heisst-nicht-komplett', 'recall-vor-precision']);
  });
});
```

- [ ] **Schritt 2: Test laufen lassen, Fehlschlag ansehen**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && npx vitest run tests/abdeckung.test.ts 2>&1 | grep -E "Tests |Failed to resolve"
```
Erwartet: FAIL mit `Failed to resolve import "../src/lib/abdeckung"`.

- [ ] **Schritt 3: Die Abdeckung anlegen**

`src/lib/abdeckung.ts`:

```ts
import type { Abschnitt, Lehrplan, Prinzip, Status } from './lehrplan';
import type { Manifestauszug } from './manifestauszug';

/**
 * Die Abdeckung: wie weit jede Quelle in Lektionen steckt.
 *
 * Rein — kein Dateizugriff, kein Astro. Das Einlesen passiert in der Seite
 * /bibliothek zur Bauzeit; hier wird nur verrechnet. Die Lehrplaene sind
 * gegen dieselben `lektionsIds` geprueft (`pruefeLehrplan`): Ein Abschnitt
 * mit `status: lektion` zeigt deshalb auf eine Lektion, die es gibt.
 *
 * Fuer Repos gilt ein Prinzip als abgedeckt, wenn es eine Lektion mit
 * derselben Id gibt. Fuer Buch und Folien zaehlt der Status, den der Lehrplan
 * je Abschnitt fuehrt.
 */

export type Zeile = {
  /** Prinzip-Id (Repo) oder Abschnitt-Id (Buch, Folien). */
  readonly id: string;
  /** Der Satz des Prinzips oder der Titel des Abschnitts. */
  readonly titel: string;
  readonly status: Status;
  /** Die Lektion, auf die die Zeile zeigt — nur bei `lektion`. */
  readonly lektion?: string;
  /** Warum abgelehnt — nur bei `abgelehnt`. */
  readonly grund?: string;
  /** Wo der Abschnitt im Original steht — nur bei Buch und Folien. */
  readonly datei?: string;
  readonly seiten?: readonly [number, number];
  /** Die Vorbehalte der Prinzipien dieser Zeile; leer, wenn es keine gibt. */
  readonly vorbehalte: readonly string[];
};

export type Zaehlung = {
  readonly gesamt: number;
  readonly mitLektion: number;
  readonly offen: number;
  readonly beauftragt: number;
  readonly abgelehnt: number;
};

/**
 * Was die Quelle nicht hergibt — oder warum das hier niemand sagen kann.
 *
 * Die drei letzten Faelle sind keine Fehler, sondern Auskuenfte: Ohne
 * Manifest, mit einem unlesbaren oder mit einem zu einem anderen Stand zeigt
 * die Seite keine Zahl. Eine Zahl aus dem falschen Manifest waere schlimmer
 * als keine — sie liesse den Bestand vollstaendiger aussehen, als er ist.
 */
export type Luecken =
  | { readonly art: 'git'; readonly uebernommen: number; readonly ausgelassen: number }
  | {
      readonly art: 'dokument';
      readonly einheit: 'folien' | 'seiten';
      readonly seiten: number;
      readonly nurBild: number;
      readonly tabellenverdacht: number;
    }
  | { readonly art: 'fehlt' }
  | { readonly art: 'anderer-stand' }
  | { readonly art: 'unlesbar'; readonly grund: string };

export type Bestand = {
  readonly quelle: string;
  readonly art: Lehrplan['art'];
  /** Bei Buch und Folien der Titel, bei Repos der Kurzname. */
  readonly titel: string;
  readonly stand: string;
  readonly isbn?: string;
  readonly auflage?: string;
  readonly zaehlung: Zaehlung;
  readonly luecken: Luecken;
  readonly zeilen: readonly Zeile[];
};

export type Abdeckung = {
  /** Eine Karte je Quelle, nach Kurzname sortiert. */
  readonly bestand: readonly Bestand[];
  /**
   * Lektionen, auf die kein Prinzip und kein Abschnitt zeigt, sortiert. Die
   * Seite zeigt sie als Warnung und nie als Abdeckung: Eine Lektion, deren
   * Herkunft kein Lehrplan kennt, ist genau die Behauptung ohne Quelle, die
   * das Projekt ausschliesst.
   */
  readonly ohneLehrplan: readonly string[];
};

/**
 * Eigener Vergleich statt `localeCompare`: Der haengt an der
 * Spracheinstellung des Rechners, und der Bau soll ueberall dieselbe Seite
 * ergeben.
 */
function vergleiche(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function vorbehalteVon(prinzipien: readonly Prinzip[]): string[] {
  return prinzipien.flatMap((p) => (p.vorbehalt === undefined ? [] : [p.vorbehalt]));
}

function zeilenAusPrinzipien(prinzipien: readonly Prinzip[], lektionsIds: ReadonlySet<string>): Zeile[] {
  return prinzipien.map((p) => {
    const abgedeckt = lektionsIds.has(p.id);
    return {
      id: p.id,
      titel: p.satz,
      status: abgedeckt ? 'lektion' : 'offen',
      lektion: abgedeckt ? p.id : undefined,
      vorbehalte: vorbehalteVon([p]),
    };
  });
}

function zeilenAusAbschnitten(abschnitte: readonly Abschnitt[]): Zeile[] {
  return abschnitte.map((a) => ({
    id: a.id,
    titel: a.titel,
    status: a.status,
    lektion: a.lektion,
    grund: a.grund,
    datei: a.datei,
    seiten: a.seiten,
    vorbehalte: vorbehalteVon(a.prinzipien),
  }));
}

function zaehle(zeilen: readonly Zeile[]): Zaehlung {
  const anzahl = (status: Status) => zeilen.filter((z) => z.status === status).length;
  return {
    gesamt: zeilen.length,
    mitLektion: anzahl('lektion'),
    offen: anzahl('offen'),
    beauftragt: anzahl('beauftragt'),
    abgelehnt: anzahl('abgelehnt'),
  };
}

/**
 * Ein Manifest zaehlt nur fuer genau den Stand, den der Lehrplan beschreibt.
 * Wer eine Quelle neu einliest, ohne den Lehrplan nachzuziehen, hat ein
 * Manifest zu einem anderen Stand — dessen Zahlen gehoeren nicht zu diesem
 * Bestand. Dasselbe gilt fuer ein Manifest der falschen Art.
 */
function lueckenVon(lehrplan: Lehrplan, manifest: Manifestauszug | undefined): Luecken {
  if (manifest === undefined) return { art: 'fehlt' };
  if (manifest.art === 'unlesbar') return { art: 'unlesbar', grund: manifest.grund };
  if (manifest.stand !== lehrplan.stand) return { art: 'anderer-stand' };

  if (lehrplan.art === 'repo') {
    return manifest.art === 'git'
      ? { art: 'git', uebernommen: manifest.uebernommen, ausgelassen: manifest.ausgelassen }
      : { art: 'anderer-stand' };
  }
  return manifest.art === 'dokument'
    ? {
        art: 'dokument',
        einheit: lehrplan.art === 'folien' ? 'folien' : 'seiten',
        seiten: manifest.seiten,
        nurBild: manifest.nurBild,
        tabellenverdacht: manifest.tabellenverdacht,
      }
    : { art: 'anderer-stand' };
}

export function abdeckung(
  lehrplaene: readonly Lehrplan[],
  manifeste: ReadonlyMap<string, Manifestauszug>,
  lektionsIds: ReadonlySet<string>,
): Abdeckung {
  const bestand = [...lehrplaene]
    .sort((a, b) => vergleiche(a.quelle, b.quelle))
    .map((l): Bestand => {
      const zeilen =
        l.art === 'repo' ? zeilenAusPrinzipien(l.prinzipien, lektionsIds) : zeilenAusAbschnitten(l.abschnitte);
      return {
        quelle: l.quelle,
        art: l.art,
        titel: l.art === 'repo' ? l.quelle : l.titel,
        stand: l.stand,
        isbn: l.art === 'buch' ? l.isbn : undefined,
        auflage: l.art === 'buch' ? l.auflage : undefined,
        zaehlung: zaehle(zeilen),
        luecken: lueckenVon(l, manifeste.get(l.quelle)),
        zeilen,
      };
    });

  const bekannt = new Set(bestand.flatMap((b) => b.zeilen.flatMap((z) => (z.lektion === undefined ? [] : [z.lektion]))));
  const ohneLehrplan = [...lektionsIds].filter((id) => !bekannt.has(id)).sort(vergleiche);
  return { bestand, ohneLehrplan };
}
```

- [ ] **Schritt 4: Test laufen lassen**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && npx vitest run tests/abdeckung.test.ts 2>&1 | grep -E "Tests |×"
```
Erwartet: `Tests  19 passed (19)`.

Schlägt **nur** „stimmt mit dem ueberein, was gemessen wurde" fehl, hat sich der echte Bestand verändert (Aufgabe 0, Schritt 4 hätte es gemeldet) — oder `awesome-llm-apps.yaml` trägt noch kein `art` (Aufgabe 1, Schritt 7).

- [ ] **Schritt 5: Mutationsproben**

Den Befehl aus Schritt 4 je Probe laufen lassen; alle Änderungen in `src/lib/abdeckung.ts`:

| Probe | vorübergehend ändern | Erwartet: genau diese Tests schlagen fehl |
|---|---|---|
| A — Id = Prinzip-Id | `const abgedeckt = lektionsIds.has(p.id);` → `const abgedeckt = true;` | „zaehlt ein Prinzip mit gleichnamiger Lektion als abgedeckt, die anderen als offen", „stimmt mit dem ueberein, was gemessen wurde" (zwei) |
| B — der Stand | die Zeile `if (manifest.stand !== lehrplan.stand) return { art: 'anderer-stand' };` löschen | „zeigt keine Zahlen aus einem Manifest zu einem anderen Stand" |
| C — die Art | `    return manifest.art === 'git'` → `    return true` | „nimmt ein Manifest der falschen Art nicht, auch bei gleichem Stand" |
| D — ohne Lehrplan | `.filter((id) => !bekannt.has(id))` löschen (nur dieses Stück) | „nennt Lektionen, auf die kein Prinzip und kein Abschnitt zeigt — sortiert", „stimmt mit dem ueberein, was gemessen wurde" (zwei) |
| E — Einheit | `einheit: lehrplan.art === 'folien' ? 'folien' : 'seiten',` → `einheit: 'folien',` | „zaehlt bei Folien in Folien und beim Buch in Seiten" |
| F — Karten sortiert | die Zeile `.sort((a, b) => vergleiche(a.quelle, b.quelle))` löschen | „sortiert die Karten nach Kurzname, unabhaengig von der Eingabe" |
| G — alle Vorbehalte | `vorbehalte: vorbehalteVon(a.prinzipien),` → `vorbehalte: vorbehalteVon(a.prinzipien.slice(0, 1)),` | „sammelt die Vorbehalte aller Prinzipien eines Abschnitts" |

Probe B ist der Grund für Präzisierung 12: Wer eine Quelle neu einliest und den Lehrplan nicht nachzieht, bekäme ohne die Zeile die Zahlen eines anderen Bestands auf die Karte. Probe D: Eine Lektion ohne Lehrplaneintrag wäre auf der Seite nicht mehr von einer mit Eintrag zu unterscheiden.

Alle zurücknehmen, dann den Befehl aus Schritt 4: `Tests  19 passed (19)`.

- [ ] **Schritt 6: Typen, NUL-Prüfung, Commit**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && python -c "import sys; print(sum(open(f,'rb').read().count(b'\x00') for f in sys.argv[1:]))" src/lib/abdeckung.ts tests/abdeckung.test.ts && npm run check 2>&1 | grep -E "^- [0-9]+ (error|warning|hint)" && git add src/lib/abdeckung.ts tests/abdeckung.test.ts && git commit -q -F - <<'MSG'
feat: Abdeckung - wie weit jede Quelle in Lektionen steckt

Reine Funktion ohne Dateizugriff. Bei Repos gilt ein Prinzip als
abgedeckt, wenn es eine Lektion mit derselben Id gibt; bei Buch und
Folien zaehlt der Status je Abschnitt. Dazu die Lektionen, auf die kein
Prinzip und kein Abschnitt zeigt - die Seite zeigt sie als Warnung,
nie als Abdeckung.

Was die Quelle nicht hergibt, kommt aus dem Manifest, aber nur aus dem
zum selben Stand und derselben Art. Ohne Manifest, mit einem unlesbaren
oder einem fremden sagt die Abdeckung das, statt eine Zahl zu liefern.

Ein Test haelt den heutigen Bestand fest: 6 Prinzipien, 3 mit Lektion,
3 offen, 2 Lektionen ohne Lehrplaneintrag.

<CO-AUTHORED-BY>
MSG
```
Erwartet: `0`, `- 0 errors`, `- 0 warnings`, `- 0 hints`, danach ein Commit.

---

## Aufgabe 6: Die Wortlaute — `bestandstext.ts`

**Dateien:**
- Neu: `src/lib/bestandstext.ts`
- Test: `tests/bestandstext.test.ts`

Alles, was die Bibliothek über eine Quelle in Worten sagt, steht in dieser einen Datei, und ein Test hält es Zeichen für Zeichen: Kopfzeile, Zahlenzeile, die Zeile hinter „Lücken:", die Fundstelle eines Abschnitts, die Worte für die vier Status und die Beschriftung des Knopfs. Die Regel für jeden Satz: Er behauptet nur, was die Daten tragen (Präzisierung 14).

- [ ] **Schritt 1: Den fehlschlagenden Test schreiben**

`tests/bestandstext.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import type { Bestand, Luecken, Zeile } from '../src/lib/abdeckung';
import {
  STATUS_TEXT,
  aufklapptext,
  fundstelle,
  kopfzeile,
  kurzstand,
  lueckenzeile,
  zahlenzeile,
} from '../src/lib/bestandstext';

/**
 * Die Wortlaute der Bibliothek, Zeichen fuer Zeichen. Wer hier einen Satz
 * aendert, aendert, was die Seite behauptet — das soll nie nebenbei passieren.
 *
 * `bestand()` legt die Aenderung stumpf ueber einen gueltigen Bestand und
 * ergaenzt nichts.
 */

const SHA = 'a13701eae315a81e1011a4304a6b5e741ea0a984';
const HASH = `sha256:${'b'.repeat(64)}`;

const basis: Bestand = {
  quelle: 'awesome-llm-apps',
  art: 'repo',
  titel: 'awesome-llm-apps',
  stand: SHA,
  zaehlung: { gesamt: 6, mitLektion: 3, offen: 3, beauftragt: 0, abgelehnt: 0 },
  luecken: { art: 'fehlt' },
  zeilen: [],
};

function bestand(aenderung: Partial<Bestand> = {}): Bestand {
  return { ...basis, ...aenderung };
}

const zeile = (aenderung: Partial<Zeile> = {}): Zeile => ({
  id: 'm07-2',
  titel: 'Vertragsarten',
  status: 'offen',
  datei: 'M7 Risikomanagement 26.pdf',
  seiten: [28, 34],
  vorbehalte: [],
  ...aenderung,
});

describe('kopfzeile', () => {
  it('nennt Art und kurzen Stand eines Repos', () => {
    expect(kopfzeile(bestand())).toBe('Repo · Stand a13701e');
  });

  it('kuerzt einen sha256-Stand hinter dem Praefix', () => {
    expect(kurzstand(HASH)).toBe('sha256:bbbbbbb');
    expect(kopfzeile(bestand({ art: 'folien', stand: HASH }))).toBe('Folien · Stand sha256:bbbbbbb');
  });

  it('nennt beim Buch ISBN und Auflage, wenn es sie gibt — die Auflage wie im Lehrplan', () => {
    expect(kopfzeile(bestand({ art: 'buch', stand: HASH, isbn: '978-3-658-00000-0', auflage: '3. Auflage' }))).toBe(
      'Buch · Stand sha256:bbbbbbb · ISBN 978-3-658-00000-0 · 3. Auflage',
    );
    expect(kopfzeile(bestand({ art: 'buch', stand: HASH }))).toBe('Buch · Stand sha256:bbbbbbb');
  });
});

describe('zahlenzeile', () => {
  it('zaehlt ein Repo in Prinzipien', () => {
    expect(zahlenzeile(bestand())).toBe('6 Prinzipien · 3 mit Lektion · 3 offen');
  });

  it('zaehlt Lehrmaterial in Abschnitten und nennt Abgelehnte', () => {
    const z = { gesamt: 38, mitLektion: 11, offen: 22, beauftragt: 0, abgelehnt: 5 };
    expect(zahlenzeile(bestand({ art: 'folien', zaehlung: z }))).toBe(
      '38 Abschnitte · 11 mit Lektion · 22 offen · 5 abgelehnt',
    );
  });

  it('nennt Beauftragte zwischen Offenen und Abgelehnten', () => {
    const z = { gesamt: 38, mitLektion: 11, offen: 18, beauftragt: 4, abgelehnt: 5 };
    expect(zahlenzeile(bestand({ art: 'folien', zaehlung: z }))).toBe(
      '38 Abschnitte · 11 mit Lektion · 18 offen · 4 beauftragt · 5 abgelehnt',
    );
  });

  it('laesst mit Lektion und offen auch bei Null stehen, und zaehlt in der Einzahl richtig', () => {
    const z = { gesamt: 1, mitLektion: 1, offen: 0, beauftragt: 0, abgelehnt: 0 };
    expect(zahlenzeile(bestand({ art: 'buch', zaehlung: z }))).toBe('1 Abschnitt · 1 mit Lektion · 0 offen');
    expect(zahlenzeile(bestand({ zaehlung: { ...z, mitLektion: 0, offen: 1 } }))).toBe('1 Prinzip · 0 mit Lektion · 1 offen');
  });
});

describe('lueckenzeile', () => {
  it.each<[string, Luecken, string]>([
    ['Git mit Auslassungen', { art: 'git', uebernommen: 62, ausgelassen: 44 }, '44 von 106 Dateien nicht übernommen'],
    ['Git ohne Auslassung', { art: 'git', uebernommen: 12, ausgelassen: 0 }, 'keine Datei ausgelassen'],
    [
      'Folien mit Bild und Tabellen',
      { art: 'dokument', einheit: 'folien', seiten: 35, nurBild: 7, tabellenverdacht: 2 },
      '7 von 35 Folien nur Bild · 2 Tabellen vermutlich zerfallen',
    ],
    [
      'ein Buch mit einer Tabelle',
      { art: 'dokument', einheit: 'seiten', seiten: 210, nurBild: 0, tabellenverdacht: 1 },
      '1 Tabelle vermutlich zerfallen',
    ],
    [
      'ein Buch mit Bildseiten',
      { art: 'dokument', einheit: 'seiten', seiten: 210, nurBild: 3, tabellenverdacht: 0 },
      '3 von 210 Seiten nur Bild',
    ],
    [
      'Folien ohne beides',
      { art: 'dokument', einheit: 'folien', seiten: 20, nurBild: 0, tabellenverdacht: 0 },
      'keine Folie nur Bild, keine zerfallene Tabelle erkannt',
    ],
    [
      'ein Buch ohne beides',
      { art: 'dokument', einheit: 'seiten', seiten: 20, nurBild: 0, tabellenverdacht: 0 },
      'keine Seite nur Bild, keine zerfallene Tabelle erkannt',
    ],
    ['kein Manifest', { art: 'fehlt' }, 'unbekannt — das Manifest liegt nur am Rechner, auf dem eingelesen wurde'],
    ['ein Manifest zu einem anderen Stand', { art: 'anderer-stand' }, 'unbekannt — das Manifest gehört zu einem anderen Stand'],
    [
      'ein unlesbares Manifest',
      { art: 'unlesbar', grund: 'kein gültiges JSON' },
      'unbekannt — das Manifest lässt sich nicht lesen (kein gültiges JSON)',
    ],
  ])('sagt fuer %s das Richtige', (_fall, luecken, text) => {
    expect(lueckenzeile(luecken)).toBe(text);
  });
});

describe('fundstelle', () => {
  it('nennt Datei und Folien eines Abschnitts', () => {
    expect(fundstelle('folien', zeile())).toBe('M7 Risikomanagement 26.pdf, Folien 28–34');
  });

  it('nennt eine einzelne Folie in der Einzahl', () => {
    expect(fundstelle('folien', zeile({ seiten: [12, 12] }))).toBe('M7 Risikomanagement 26.pdf, Folie 12');
  });

  it('zaehlt ein Buch in Seiten', () => {
    expect(fundstelle('buch', zeile())).toBe('M7 Risikomanagement 26.pdf, Seiten 28–34');
    expect(fundstelle('buch', zeile({ seiten: [3, 3] }))).toBe('M7 Risikomanagement 26.pdf, Seite 3');
  });

  it('hat fuer ein Prinzip aus einem Repo keine Fundstelle', () => {
    expect(fundstelle('repo', zeile({ datei: undefined, seiten: undefined }))).toBeNull();
  });
});

describe('Status und Aufklappen', () => {
  it('nennt jeden Status mit denselben Worten wie die Zahlenzeile', () => {
    expect(STATUS_TEXT).toEqual({
      lektion: 'mit Lektion',
      offen: 'offen',
      beauftragt: 'beauftragt',
      abgelehnt: 'abgelehnt',
    });
  });

  it('beschriftet den Knopf nach dem, was die Liste enthaelt', () => {
    expect(aufklapptext(bestand())).toBe('Alle Prinzipien');
    expect(aufklapptext(bestand({ art: 'folien' }))).toBe('Alle Abschnitte');
    expect(aufklapptext(bestand({ art: 'buch' }))).toBe('Alle Abschnitte');
  });
});
```

- [ ] **Schritt 2: Test laufen lassen, Fehlschlag ansehen**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && npx vitest run tests/bestandstext.test.ts 2>&1 | grep -E "Tests |Failed to resolve"
```
Erwartet: FAIL mit `Failed to resolve import "../src/lib/bestandstext"`.

- [ ] **Schritt 3: Die Wortlaute anlegen**

`src/lib/bestandstext.ts`:

```ts
import type { Bestand, Luecken, Zeile } from './abdeckung';
import type { Status } from './lehrplan';

/**
 * Was die Bibliothek ueber den Bestand in Worten sagt — an einer Stelle und
 * getestet, Zeichen fuer Zeichen.
 *
 * Die Regel fuer jeden Satz hier: Er behauptet nur, was die Daten tragen.
 * Deshalb „vermutlich zerfallen" und nicht „zerfallen" (das Manifest fuehrt
 * einen Verdacht), „unbekannt" statt einer Null, wo kein Manifest da ist, und
 * „keine … erkannt" statt „vollstaendig".
 */

const ART_TEXT: Readonly<Record<Bestand['art'], string>> = {
  repo: 'Repo',
  buch: 'Buch',
  folien: 'Folien',
};

/** Dieselben Worte wie in der Zahlenzeile — ein Status heisst ueberall gleich. */
export const STATUS_TEXT: Readonly<Record<Status, string>> = {
  lektion: 'mit Lektion',
  offen: 'offen',
  beauftragt: 'beauftragt',
  abgelehnt: 'abgelehnt',
};

/** `1 Prinzip`, `2 Prinzipien`. */
function anzahl(n: number, einzahl: string, mehrzahl: string): string {
  return `${n} ${n === 1 ? einzahl : mehrzahl}`;
}

/** Die ersten sieben Zeichen — bei `sha256:…` die ersten sieben danach. */
export function kurzstand(stand: string): string {
  const praefix = 'sha256:';
  return stand.startsWith(praefix) ? stand.slice(0, praefix.length + 7) : stand.slice(0, 7);
}

/**
 * `Repo · Stand a13701e` — beim Buch mit ISBN und Auflage, wenn der Lehrplan
 * sie kennt. Die Auflage steht dort ausgeschrieben (`3. Auflage`) und hier so,
 * wie sie dort steht.
 */
export function kopfzeile(b: Bestand): string {
  return [
    ART_TEXT[b.art],
    `Stand ${kurzstand(b.stand)}`,
    ...(b.isbn === undefined ? [] : [`ISBN ${b.isbn}`]),
    ...(b.auflage === undefined ? [] : [b.auflage]),
  ].join(' · ');
}

/**
 * `6 Prinzipien · 3 mit Lektion · 3 offen`, bei Lehrmaterial
 * `38 Abschnitte · 11 mit Lektion · 22 offen · 5 abgelehnt`.
 *
 * „mit Lektion" und „offen" stehen immer da, auch mit Null — sie sind die
 * Abdeckung selbst. „beauftragt" und „abgelehnt" nur, wenn es sie gibt: Ein
 * Repo kennt beides nicht, und eine Null dort wuerde einen Zustand
 * vortaeuschen, den es gar nicht haben kann.
 */
export function zahlenzeile(b: Bestand): string {
  const z = b.zaehlung;
  return [
    b.art === 'repo' ? anzahl(z.gesamt, 'Prinzip', 'Prinzipien') : anzahl(z.gesamt, 'Abschnitt', 'Abschnitte'),
    `${z.mitLektion} mit Lektion`,
    `${z.offen} offen`,
    ...(z.beauftragt > 0 ? [`${z.beauftragt} beauftragt`] : []),
    ...(z.abgelehnt > 0 ? [`${z.abgelehnt} abgelehnt`] : []),
  ].join(' · ');
}

/**
 * Was hinter „Lücken:" steht. Auch ohne Manifest steht dort etwas: Eine
 * fehlende Zeile liesse den Bestand vollstaendig aussehen — genau das, was
 * sie verhindern soll.
 */
export function lueckenzeile(l: Luecken): string {
  switch (l.art) {
    case 'git':
      return l.ausgelassen === 0
        ? 'keine Datei ausgelassen'
        : `${l.ausgelassen} von ${l.uebernommen + l.ausgelassen} Dateien nicht übernommen`;
    case 'dokument': {
      const [eine, viele] = l.einheit === 'folien' ? ['Folie', 'Folien'] : ['Seite', 'Seiten'];
      const teile = [
        ...(l.nurBild > 0 ? [`${l.nurBild} von ${l.seiten} ${viele} nur Bild`] : []),
        ...(l.tabellenverdacht > 0
          ? [`${anzahl(l.tabellenverdacht, 'Tabelle', 'Tabellen')} vermutlich zerfallen`]
          : []),
      ];
      return teile.length > 0 ? teile.join(' · ') : `keine ${eine} nur Bild, keine zerfallene Tabelle erkannt`;
    }
    case 'fehlt':
      return 'unbekannt — das Manifest liegt nur am Rechner, auf dem eingelesen wurde';
    case 'anderer-stand':
      return 'unbekannt — das Manifest gehört zu einem anderen Stand';
    case 'unlesbar':
      return `unbekannt — das Manifest lässt sich nicht lesen (${l.grund})`;
  }
}

/** `M7 Risikomanagement 26.pdf, Folien 28–34` — oder `null` bei einem Prinzip aus einem Repo. */
export function fundstelle(art: Bestand['art'], z: Zeile): string | null {
  if (z.datei === undefined || z.seiten === undefined) return null;
  const [von, bis] = z.seiten;
  const [eine, viele] = art === 'folien' ? ['Folie', 'Folien'] : ['Seite', 'Seiten'];
  return `${z.datei}, ${von === bis ? `${eine} ${von}` : `${viele} ${von}–${bis}`}`;
}

/** Die Beschriftung des Knopfs, der die Liste aufklappt. */
export function aufklapptext(b: Bestand): string {
  return b.art === 'repo' ? 'Alle Prinzipien' : 'Alle Abschnitte';
}
```

- [ ] **Schritt 4: Test laufen lassen**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && npx vitest run tests/bestandstext.test.ts 2>&1 | grep -E "Tests |×"
```
Erwartet: `Tests  23 passed (23)`.

Schlägt ein Wortlaut fehl, ist beim Übertragen ein Zeichen verrutscht — meist ein Umlaut, der Mittelpunkt `·` (U+00B7), der Gedankenstrich `—` (U+2014) oder der Bis-Strich `–` (U+2013) in „28–34". Dann **den Text** berichtigen, nicht den Test.

- [ ] **Schritt 5: Mutationsproben**

Den Befehl aus Schritt 4 je Probe laufen lassen; alle Änderungen in `src/lib/bestandstext.ts`:

| Probe | vorübergehend ändern | Erwartet: genau diese Tests schlagen fehl |
|---|---|---|
| A — keine Null, wo es den Zustand nicht gibt | `z.beauftragt > 0` → `z.beauftragt >= 0` | „zaehlt ein Repo in Prinzipien", „zaehlt Lehrmaterial in Abschnitten und nennt Abgelehnte", „laesst mit Lektion und offen auch bei Null stehen, und zaehlt in der Einzahl richtig" (drei) |
| B — ein Verdacht ist ein Verdacht | `` vermutlich zerfallen`] `` → `` zerfallen`] `` | „sagt fuer Folien mit Bild und Tabellen das Richtige", „sagt fuer ein Buch mit einer Tabelle das Richtige" (zwei) |
| C — eine Folie | `von === bis ?` → `false ?` | „nennt eine einzelne Folie in der Einzahl", „zaehlt ein Buch in Seiten" (zwei) |

Alle zurücknehmen, dann den Befehl aus Schritt 4: `Tests  23 passed (23)`.

- [ ] **Schritt 6: Typen, NUL-Prüfung, Commit**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && python -c "import sys; print(sum(open(f,'rb').read().count(b'\x00') for f in sys.argv[1:]))" src/lib/bestandstext.ts tests/bestandstext.test.ts && npm run check 2>&1 | grep -E "^- [0-9]+ (error|warning|hint)" && git add src/lib/bestandstext.ts tests/bestandstext.test.ts && git commit -q -F - <<'MSG'
feat: Wortlaute der Bibliothek an einer Stelle

Kopfzeile, Zahlenzeile, die Luecken, die Fundstelle eines Abschnitts,
die Worte fuer die vier Status und die Beschriftung des Knopfs. Jeder
Satz behauptet nur, was die Daten tragen: vermutlich zerfallen statt
zerfallen, unbekannt statt einer Null ohne Manifest, keine ... erkannt
statt vollstaendig. mit Lektion und offen stehen immer da, beauftragt
und abgelehnt nur, wenn es sie gibt.

Ein Test haelt jeden Wortlaut Zeichen fuer Zeichen.

<CO-AUTHORED-BY>
MSG
```
Erwartet: `0`, `- 0 errors`, `- 0 warnings`, `- 0 hints`, danach ein Commit.

---

## Aufgabe 7: Die Darstellung — `Bestand.astro`

**Dateien:**
- Neu: `src/components/Bestand.astro`
- Test: `tests/bestand-ansicht.test.ts`

Die Komponente rechnet nichts; sie ordnet an, was `abdeckung` gerechnet und `bestandstext` formuliert hat. Die Daten kommen als Props herein, damit der Test sie mit jedem Bestand rendern kann — auch mit Buch und Folien, die es im echten Bestand noch nicht gibt. Die Wortlaute der beiden Warnungen und des leeren Bestands stehen hier im Markup und im Test (Regel 13).

- [ ] **Schritt 1: Den fehlschlagenden Test schreiben**

`tests/bestand-ansicht.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import Bestand from '../src/components/Bestand.astro';
import type { Abdeckung, Bestand as Quellenbestand } from '../src/lib/abdeckung';
import type { Ungueltig } from '../src/lib/lehrplan';

/**
 * Die Darstellung des Bestands, gerendert mit dem Container von Astro.
 *
 * Buch und Folien gibt es im echten Bestand noch nicht; ohne diesen Test
 * liefe ihre Darstellung zum ersten Mal, wenn das Einlesen fertig ist. Die
 * Faelle hier sind von Hand gebaut und laufen nicht durch `abdeckung` — was
 * `abdeckung` rechnet, prueft `tests/abdeckung.test.ts`.
 *
 * `experimental_AstroContainer` heisst so, weil Astro die Schnittstelle noch
 * aendern darf. Bricht dieser Test nach einem Update von Astro, liegt es
 * vermutlich daran. Umgebung `node`: Unter jsdom erkennt Astro die Komponente
 * nicht und meldet „No valid renderer".
 */

const TITEL = new Map([
  ['kein-boden-ist-ein-boden', 'Kein Boden ist auch ein Boden'],
  ['pauschal-heisst-nicht-komplett', 'Pauschal heißt nicht komplett'],
  ['recall-vor-precision', 'Recall und Precision sind zwei Probleme, nicht eins'],
]);

const repo: Quellenbestand = {
  quelle: 'awesome-llm-apps',
  art: 'repo',
  titel: 'awesome-llm-apps',
  stand: 'a13701eae315a81e1011a4304a6b5e741ea0a984',
  zaehlung: { gesamt: 2, mitLektion: 1, offen: 1, beauftragt: 0, abgelehnt: 0 },
  luecken: { art: 'git', uebernommen: 62, ausgelassen: 44 },
  zeilen: [
    {
      id: 'kein-boden-ist-ein-boden',
      titel: 'Wer keine Relevanzschwelle setzt, hat sie auf minus unendlich gesetzt.',
      status: 'lektion',
      lektion: 'kein-boden-ist-ein-boden',
      vorbehalte: [],
    },
    { id: 'vertrauen-ist-herkunft', titel: 'Vertrauen hängt an der Herkunft.', status: 'offen', vorbehalte: [] },
  ],
};

const folien: Quellenbestand = {
  quelle: 'bauch-projektmanagement',
  art: 'folien',
  titel: 'Projektmanagement',
  stand: `sha256:${'b'.repeat(64)}`,
  zaehlung: { gesamt: 2, mitLektion: 1, offen: 0, beauftragt: 0, abgelehnt: 1 },
  luecken: { art: 'dokument', einheit: 'folien', seiten: 35, nurBild: 7, tabellenverdacht: 2 },
  zeilen: [
    {
      id: 'm07-2-vertragsarten',
      titel: 'Risikomanagement und Vertragswesen',
      status: 'lektion',
      lektion: 'pauschal-heisst-nicht-komplett',
      datei: 'M7 Risikomanagement 26.pdf',
      seiten: [28, 34],
      vorbehalte: ['Für die Behaltensquoten gibt es keine belastbare Studie.'],
    },
    {
      id: 'm07-3-titel',
      titel: 'Titelfolien',
      status: 'abgelehnt',
      grund: 'reine Titelfolien',
      datei: 'M7 Risikomanagement 26.pdf',
      seiten: [35, 35],
      vorbehalte: [],
    },
  ],
};

const nichts: Abdeckung = { bestand: [], ohneLehrplan: [] };

async function rendere(abdeckung: Abdeckung, ungueltig: readonly Ungueltig[] = []): Promise<string> {
  const container = await AstroContainer.create();
  return container.renderToString(Bestand, { props: { abdeckung, ungueltig, lektionstitel: TITEL } });
}

/** Das Stueck HTML einer Zeile — damit ein Treffer nicht aus der Nachbarzeile stammt. */
function zeileMit(html: string, status: string): string {
  const anfang = html.indexOf(`<li class="zeile" data-status="${status}">`);
  if (anfang < 0) throw new Error(`Keine Zeile mit Status ${status}.`);
  return html.slice(anfang, html.indexOf('</li>', anfang));
}

describe('Bestand - die Karte einer Quelle', () => {
  it('zeigt Titel, Kopfzeile, Zahlen und Luecken', async () => {
    const html = await rendere({ bestand: [repo], ohneLehrplan: [] });
    expect(html).toContain('<h2>awesome-llm-apps</h2>');
    expect(html).toContain('<p class="quelle-kopf">Repo · Stand a13701e</p>');
    expect(html).toContain('<p class="quelle-zahlen">2 Prinzipien · 1 mit Lektion · 1 offen</p>');
    expect(html).toContain('<p class="quelle-luecken"><strong>Lücken:</strong> 44 von 106 Dateien nicht übernommen</p>');
  });

  it('klappt die Prinzipien mit details und summary auf — ohne ein Skript', async () => {
    const html = await rendere({ bestand: [repo], ohneLehrplan: [] });
    expect(html).toContain('<details class="quelle-liste"><summary>Alle Prinzipien</summary>');
    expect(html).not.toContain('<script');
  });

  it('verweist bei einer Zeile mit Lektion auf die Lektion, unter ihrem Titel', async () => {
    const zeile = zeileMit(await rendere({ bestand: [repo], ohneLehrplan: [] }), 'lektion');
    expect(zeile).toContain('<span class="zeile-marke">mit Lektion</span>');
    // Mit Trennzeichen: Ohne es liefen Marke und Titel beim Vorlesen ineinander.
    expect(zeile).toContain('mit Lektion</span> · <a href="/lektion/kein-boden-ist-ein-boden/">Kein Boden ist auch ein Boden</a>');
  });

  it('nennt bei einer offenen Zeile den Status und verweist nirgendwohin', async () => {
    const zeile = zeileMit(await rendere({ bestand: [repo], ohneLehrplan: [] }), 'offen');
    expect(zeile).toContain('<span class="zeile-marke">offen</span>');
    expect(zeile).not.toContain('<a ');
  });

  it('zeigt bei Folien Fundstelle, Grund und Vorbehalt', async () => {
    const html = await rendere({ bestand: [folien], ohneLehrplan: [] });
    expect(html).toContain('<summary>Alle Abschnitte</summary>');
    expect(html).toContain('7 von 35 Folien nur Bild · 2 Tabellen vermutlich zerfallen');
    const lektion = zeileMit(html, 'lektion');
    expect(lektion).toContain('<p class="zeile-fundstelle">M7 Risikomanagement 26.pdf, Folien 28–34</p>');
    expect(lektion).toContain(
      '<p class="zeile-vorbehalt"><strong>Vorbehalt:</strong> Für die Behaltensquoten gibt es keine belastbare Studie.</p>',
    );
    const abgelehnt = zeileMit(html, 'abgelehnt');
    expect(abgelehnt).toContain('<p class="zeile-fundstelle">M7 Risikomanagement 26.pdf, Folie 35</p>');
    expect(abgelehnt).toContain('<p class="zeile-grund"><strong>Grund:</strong> reine Titelfolien</p>');
  });

  it('sagt ohne Manifest, dass die Luecken unbekannt sind, statt die Zeile wegzulassen', async () => {
    const html = await rendere({ bestand: [{ ...repo, luecken: { art: 'fehlt' } }], ohneLehrplan: [] });
    expect(html).toContain(
      '<strong>Lücken:</strong> unbekannt — das Manifest liegt nur am Rechner, auf dem eingelesen wurde</p>',
    );
  });
});

describe('Bestand - Warnungen und leerer Bestand', () => {
  it('warnt vor Lektionen ohne Lehrplaneintrag und verweist auf sie', async () => {
    const html = await rendere({ bestand: [repo], ohneLehrplan: ['recall-vor-precision'] });
    expect(html).toContain('<h2>Lektionen ohne Lehrplaneintrag</h2>');
    expect(html).toContain(
      'Auf diese Lektionen zeigt kein Prinzip und kein Abschnitt eines gültigen Lehrplans. Ihre Herkunft ist damit nicht geprüft, und sie zählen hier nicht als Abdeckung. Ob sie nachgetragen oder entfernt werden, entscheidest du.',
    );
    expect(html).toContain('<a href="/lektion/recall-vor-precision/">Recall und Precision sind zwei Probleme, nicht eins</a>');
  });

  it('zeigt ungueltige Lehrplaene mit ihren Maengeln', async () => {
    const html = await rendere(nichts, [
      { datei: 'awesome-llm-apps.yaml', maengel: ['geprueftVon: geprueftVon fehlt — der Lehrplan ist das Review-Gate.'] },
    ]);
    expect(html).toContain('<h2>Lehrpläne, die die Prüfung nicht bestehen</h2>');
    expect(html).toContain(
      'Aus diesen Dateien zeigt die Seite keine Zahlen. Auch ein Lehrplan, der noch auf die Freigabe wartet — geprueftVon ist leer —, steht hier.',
    );
    expect(html).toContain('<h3>awesome-llm-apps.yaml</h3>');
    expect(html).toContain('<code>geprueftVon: geprueftVon fehlt — der Lehrplan ist das Review-Gate.</code>');
  });

  it('warnt nicht, wo es nichts zu warnen gibt', async () => {
    const html = await rendere({ bestand: [repo], ohneLehrplan: [] });
    expect(html).not.toContain('bestand-warnung');
  });

  it('sagt bei leerem Bestand, dass kein Lehrplan vorliegt', async () => {
    expect(await rendere(nichts)).toContain('<p class="bestand-leer">Es liegt kein Lehrplan vor.</p>');
  });

  it('sagt das nicht, wenn es Lehrplaene gibt, die nur ungueltig sind', async () => {
    const html = await rendere(nichts, [{ datei: 'x.yaml', maengel: ['art: unbekannt'] }]);
    expect(html).not.toContain('bestand-leer');
  });
});
```

- [ ] **Schritt 2: Test laufen lassen, Fehlschlag ansehen**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && npx vitest run tests/bestand-ansicht.test.ts 2>&1 | grep -E "Tests |Cannot find module"
```
Erwartet: FAIL — `Error: Cannot find module '../src/components/Bestand.astro'`, dazu `Tests  no tests`.

- [ ] **Schritt 3: Die Komponente anlegen**

`src/components/Bestand.astro`:

```astro
---
import type { Abdeckung } from '../lib/abdeckung';
import type { Ungueltig } from '../lib/lehrplan';
import {
  STATUS_TEXT,
  aufklapptext,
  fundstelle,
  kopfzeile,
  lueckenzeile,
  zahlenzeile,
} from '../lib/bestandstext';

/**
 * Der Bestand: eine Karte je Quelle, darunter zwei Warnungen, wenn es etwas
 * zu warnen gibt.
 *
 * Diese Datei rechnet nichts. Was abgedeckt ist, sagt `abdeckung`, wie es
 * heisst, sagt `bestandstext`; hier wird nur angeordnet. Die Daten kommen als
 * Props herein und nicht aus Dateien, damit die Darstellung im Test mit jedem
 * Bestand gerendert werden kann — auch mit Buch und Folien, die es im echten
 * Bestand noch nicht gibt.
 *
 * Aufgeklappt wird mit `details` und `summary`: Das geht ohne JavaScript, in
 * jedem Bau und in der ortsunabhaengigen Kopie; Tastatur und Vorlesen bringt
 * der Browser mit, samt dem Zustand auf und zu.
 */
interface Props {
  abdeckung: Abdeckung;
  ungueltig: readonly Ungueltig[];
  /** Lektion-Id -> Titel, fuer die Verweise. */
  lektionstitel: ReadonlyMap<string, string>;
}

const { abdeckung, ungueltig, lektionstitel } = Astro.props;

// Lokal `/`, auf GitHub Pages `/kernbohrung/` — siehe astro.config.mjs.
const basis = import.meta.env.BASE_URL.replace(/\/?$/, '/');
const titelVon = (id: string) => lektionstitel.get(id) ?? id;
---
{abdeckung.bestand.length === 0 && ungueltig.length === 0 && (
  <p class="bestand-leer">Es liegt kein Lehrplan vor.</p>
)}

{abdeckung.bestand.map((b) => (
  <section class="karte quelle" data-quelle={b.quelle}>
    <h2>{b.titel}</h2>
    <p class="quelle-kopf">{kopfzeile(b)}</p>
    <p class="quelle-zahlen">{zahlenzeile(b)}</p>
    <p class="quelle-luecken"><strong>Lücken:</strong> {lueckenzeile(b.luecken)}</p>
    <details class="quelle-liste">
      <summary>{aufklapptext(b)}</summary>
      <ol>
        {b.zeilen.map((z) => (
          <li class="zeile" data-status={z.status}>
            <p class="zeile-titel">{z.titel}</p>
            {fundstelle(b.art, z) !== null && <p class="zeile-fundstelle">{fundstelle(b.art, z)}</p>}
            {/* Marke und Verweis auf einer Zeile im Quelltext: Astro loescht
                Leerraum mit Zeilenumbruch zwischen zwei Elementen, und
                vorgelesen hiesse es dann „mit LektionKein Boden…“. */}
            <p class="zeile-status">
              <span class="zeile-marke">{STATUS_TEXT[z.status]}</span>{z.lektion !== undefined && (
                <> · <a href={`${basis}lektion/${z.lektion}/`}>{titelVon(z.lektion)}</a></>
              )}
            </p>
            {z.grund !== undefined && (
              <p class="zeile-grund"><strong>Grund:</strong> {z.grund}</p>
            )}
            {z.vorbehalte.map((v) => (
              <p class="zeile-vorbehalt"><strong>Vorbehalt:</strong> {v}</p>
            ))}
          </li>
        ))}
      </ol>
    </details>
  </section>
))}

{ungueltig.length > 0 && (
  <section class="karte bestand-warnung" data-warnung="ungueltig">
    <h2>Lehrpläne, die die Prüfung nicht bestehen</h2>
    <p>
      Aus diesen Dateien zeigt die Seite keine Zahlen. Auch ein Lehrplan, der noch auf die
      Freigabe wartet — geprueftVon ist leer —, steht hier.
    </p>
    {ungueltig.map((u) => (
      <div class="ungueltig">
        <h3>{u.datei}</h3>
        <ul>
          {u.maengel.map((m) => <li><code>{m}</code></li>)}
        </ul>
      </div>
    ))}
  </section>
)}

{abdeckung.ohneLehrplan.length > 0 && (
  <section class="karte bestand-warnung" data-warnung="ohne-lehrplan">
    <h2>Lektionen ohne Lehrplaneintrag</h2>
    <p>
      Auf diese Lektionen zeigt kein Prinzip und kein Abschnitt eines gültigen Lehrplans. Ihre
      Herkunft ist damit nicht geprüft, und sie zählen hier nicht als Abdeckung. Ob sie
      nachgetragen oder entfernt werden, entscheidest du.
    </p>
    <ul>
      {abdeckung.ohneLehrplan.map((id) => (
        <li><a href={`${basis}lektion/${id}/`}>{titelVon(id)}</a></li>
      ))}
    </ul>
  </section>
)}
```

Zwei Stellen, an denen der Quelltext so aussehen **muss**: `<span class="zeile-marke">…</span>{z.lektion !== undefined && (` steht auf einer Zeile, und im Fragment `<> · <a …>…</a></>` stehen Trennzeichen und Verweis auf einer Zeile (Regel 15). Sonst liefen Marke und Titel im gebauten HTML ineinander.

- [ ] **Schritt 4: Tests laufen lassen**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && npx vitest run tests/bestand-ansicht.test.ts 2>&1 | grep -E "Tests |×" && npx vitest run tests/basis-pfad.test.ts --reporter=verbose 2>&1 | grep -E "Bestand.astro|Tests |×"
```
Erwartet: `Tests  11 passed (11)`; im Pfad-Test steht `✓ … src\components\Bestand.astro enthaelt keinen absoluten Wurzel-Link` und kein `×`.

- [ ] **Schritt 5: Mutationsproben**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && npx vitest run tests/bestand-ansicht.test.ts 2>&1 | grep -E "Tests |×"
```

Alle Änderungen in `src/components/Bestand.astro`:

| Probe | vorübergehend ändern | Erwartet: genau dieser Test schlägt fehl |
|---|---|---|
| A — die Lücken bleiben | `<p class="quelle-luecken"><strong>Lücken:</strong> {lueckenzeile(b.luecken)}</p>` → `{b.luecken.art !== 'fehlt' && <p class="quelle-luecken"><strong>Lücken:</strong> {lueckenzeile(b.luecken)}</p>}` | „sagt ohne Manifest, dass die Luecken unbekannt sind, statt die Zeile wegzulassen" |
| B — das Trennzeichen | `<> · <a href=` → `<><a href=` | „verweist bei einer Zeile mit Lektion auf die Lektion, unter ihrem Titel" |
| C — leer heißt leer | `{abdeckung.bestand.length === 0 && ungueltig.length === 0 && (` → `{abdeckung.bestand.length === 0 && (` | „sagt das nicht, wenn es Lehrplaene gibt, die nur ungueltig sind" |

Probe A ist Präzisierung 1 als Test: Die naheliegende „Vereinfachung", die Zeile ohne Manifest wegzulassen, fällt auf. Probe C: Ein Bestand, der nur aus ungültigen Lehrplänen besteht, ist nicht leer — er wartet auf eine Freigabe.

Alle zurücknehmen, dann den Befehl oben: `Tests  11 passed (11)`.

- [ ] **Schritt 6: Typen, NUL-Prüfung, Commit**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && python -c "import sys; print(sum(open(f,'rb').read().count(b'\x00') for f in sys.argv[1:]))" src/components/Bestand.astro tests/bestand-ansicht.test.ts && npm run check 2>&1 | grep -E "^- [0-9]+ (error|warning|hint)" && git add src/components/Bestand.astro tests/bestand-ansicht.test.ts && git commit -q -F - <<'MSG'
feat: Darstellung des Bestands - Karten, Warnungen, leerer Bestand

Eine Karte je Quelle mit Titel, Art und Stand, Zahlenzeile und Luecken,
die Prinzipien oder Abschnitte zum Aufklappen mit details und summary:
ohne Skript, im Bau wie in der Kopie fuers Handy. Darunter die
Lehrplaene, die die Pruefung nicht bestehen, und die Lektionen ohne
Lehrplaneintrag - beide als Warnung.

Die Komponente rechnet nichts und bekommt alles als Props. Der Test
rendert sie mit dem Container von Astro, auch mit Buch und Folien, die
es im Bestand noch nicht gibt. Marke und Verweis stehen auf einer
Quelltextzeile: Astro loescht Leerraum mit Zeilenumbruch, und
vorgelesen liefen beide sonst ineinander.

<CO-AUTHORED-BY>
MSG
```
Erwartet: `0`, `- 0 errors`, `- 0 warnings`, `- 0 hints`, danach ein Commit.

---

## Aufgabe 8: Die Seite und der Weg dorthin

**Dateien:**
- Neu: `src/pages/bibliothek.astro`
- Ändern: `src/pages/index.astro` (eine Zeile und ihr Kommentar)
- Test: `tests/bibliothek-seite.test.ts`

Die Seite liest zur Bauzeit, prüft, verrechnet und reicht an `Bestand.astro` weiter; sie selbst enthält keine Regel, die nicht schon in Aufgabe 1 bis 7 getestet ist. Was von ihr übrig bleibt — die beiden Globs, der Verweis von der Übersicht, keine Insel, kein Skript —, hält ein Text-Test fest wie `tests/lektion-ansicht.test.ts`; was sie zeigt, prüft der Bau unten und die Abnahme. `src/layouts/Seite.astro` bleibt unberührt (Präzisierung 6).

- [ ] **Schritt 1: Den fehlschlagenden Test schreiben**

`tests/bibliothek-seite.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Der Weg zur Bibliothek und was die Seite nicht tut — als Text geprueft wie
 * `tests/lektion-ansicht.test.ts`: Eine Seite aus `src/pages/` laesst sich
 * nur mit dem ganzen Content-Layer rendern. Was sie zeigt, pruefen
 * `tests/bestand-ansicht.test.ts` und die Abnahme am gebauten Stand.
 *
 * Gelesen wird in jedem Test neu und nicht einmal oben: Fehlt eine Datei,
 * schlaegt der Test fehl, der sie braucht — nicht die ganze Datei beim Laden.
 */
const wurzel = path.resolve(__dirname, '..');
const lies = (...teile: string[]) => readFileSync(path.join(wurzel, ...teile), 'utf8');

describe('der Weg zur Bibliothek', () => {
  it('fuehrt vom Fuss der Uebersicht dorthin, neben dem Lernprofil', () => {
    expect(lies('src', 'pages', 'index.astro')).toContain(
      '>Dein Lernprofil</a> · <a href={`${basis}bibliothek/`}>Bibliothek</a></p>',
    );
  });

  it('laesst die Kopfleiste bei Marke und Modusumschalter', () => {
    // Die Leiste klebt auf jeder Seite; ein Eintrag dort machte sie auf
    // jeder Lektionsseite hoeher (bei 375 px gemessen: 115 statt 109 px).
    // Entschieden in Plan 3a, Praezisierung 8, hier uebernommen.
    expect(lies('src', 'layouts', 'Seite.astro').toLowerCase()).not.toContain('bibliothek');
  });
});

describe('die Seite /bibliothek', () => {
  it('liest Lehrplaene und Manifeste zur Bauzeit, ab der Projektwurzel', () => {
    const seite = lies('src', 'pages', 'bibliothek.astro');
    expect(seite).toContain("import.meta.glob<string>('/lehrplan/*.yaml'");
    expect(seite).toContain("import.meta.glob<string>('/quellen/*/manifest.json'");
  });

  it('kommt ohne Insel und ohne Skript aus', () => {
    // Aufklappen macht `details`. Was im Browser laeuft, kann dort ausfallen —
    // hier gibt es nichts, was ausfallen koennte.
    const seite = lies('src', 'pages', 'bibliothek.astro');
    expect(seite).not.toMatch(/client:/);
    expect(seite).not.toContain('<script');
  });
});
```

- [ ] **Schritt 2: Test laufen lassen, Fehlschlag ansehen**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && npx vitest run tests/bibliothek-seite.test.ts 2>&1 | grep -E "Tests |×"
```
Erwartet: `Tests  3 failed | 1 passed (4)` — rot: „fuehrt vom Fuss der Uebersicht dorthin, neben dem Lernprofil“, „liest Lehrplaene und Manifeste zur Bauzeit, ab der Projektwurzel“, „kommt ohne Insel und ohne Skript aus“. Nach Schritt 5: `Tests  4 passed (4)`.

- [ ] **Schritt 3: Die Seite anlegen**

`src/pages/bibliothek.astro`:

```astro
---
import { getCollection } from 'astro:content';
import Seite from '../layouts/Seite.astro';
import Bestand from '../components/Bestand.astro';
import { abdeckung } from '../lib/abdeckung';
import { lehrplaeneAusTexten } from '../lib/lehrplan';
import { manifesteAusTexten } from '../lib/manifestauszug';

/**
 * Die Bibliothek: was eingelesen ist und wie weit es in Lektionen steckt.
 *
 * Alles hier geschieht zur Bauzeit. Die Seite liest die Lehrplaene und die
 * Manifeste als Text, prueft und verrechnet sie und schreibt das Ergebnis
 * ins HTML. Im Browser laeuft nichts davon — auch kein Rohtext kommt dort an.
 *
 * `import.meta.glob` statt `node:fs`: Vite findet die Dateien selbst, der
 * Pfad beginnt an der Projektwurzel, und im Entwicklungsmodus baut die Seite
 * neu, sobald sich ein Lehrplan aendert. Wo `quellen/` fehlt — auf GitHub,
 * denn der Ordner ist gitignored —, liefert der zweite Glob nichts, und die
 * Seite sagt, dass sie die Luecken nicht kennt.
 */
const lektionen = await getCollection('lektionen');
const lektionsIds = new Set(lektionen.map((l) => l.id));
const lektionstitel = new Map(lektionen.map((l) => [l.id, l.data.titel]));

const lehrplantexte = import.meta.glob<string>('/lehrplan/*.yaml', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const manifesttexte = import.meta.glob<string>('/quellen/*/manifest.json', {
  query: '?raw',
  import: 'default',
  eager: true,
});

const { gueltig, ungueltig } = lehrplaeneAusTexten(lehrplantexte, lektionsIds);
const bestand = abdeckung(gueltig, manifesteAusTexten(manifesttexte), lektionsIds);

// Lokal `/`, auf GitHub Pages `/kernbohrung/` — siehe astro.config.mjs.
const basis = import.meta.env.BASE_URL.replace(/\/?$/, '/');
---
<Seite titel="Bibliothek">
  <p class="augenbraue">Kernbohrung · Bibliothek</p>
  <h1>Bibliothek</h1>
  <p class="vorspann">
    Jede Quelle, aus der Lektionen entstehen: welcher Stand eingelesen ist, was davon schon
    Lektion ist und wo das Eingelesene Lücken hat.
  </p>

  <Bestand abdeckung={bestand} ungueltig={ungueltig} lektionstitel={lektionstitel} />

  <p class="profil-verweis"><a href={basis}>Zur Übersicht</a></p>
</Seite>
```

- [ ] **Schritt 4: Den Verweis an den Fuß der Übersicht setzen**

In `src/pages/index.astro` diese Stelle

```astro
  {/* Der feste Weg zum Profil, ohne Skript: Die Karte oben verschwindet,
      sobald ein Profil da ist — dieser Verweis bleibt. */}
  <p class="profil-verweis"><a href={`${basis}profil/`}>Dein Lernprofil</a></p>
```

ersetzen durch

```astro
  {/* Die festen Wege, ohne Skript: Die Karte oben verschwindet, sobald ein
      Profil da ist — dieser Verweis bleibt. Die Bibliothek steht daneben und
      nicht in der Kopfleiste: Die klebt auf jeder Seite und ist bei 375 px
      schon zweizeilig; ein Eintrag dort machte sie auf jeder Lektionsseite
      hoeher. Beide Verweise stehen auf einer Zeile im Quelltext — Astro
      loescht Leerraum mit Zeilenumbruch zwischen zwei Elementen, und das
      Trennzeichen ginge mit. */}
  <p class="profil-verweis"><a href={`${basis}profil/`}>Dein Lernprofil</a> · <a href={`${basis}bibliothek/`}>Bibliothek</a></p>
```

Beide Verweise und das Trennzeichen stehen auf **einer** Zeile (Regel 15). `.profil-verweis a` macht schon heute jeden Verweis darin 44 px hoch; neues CSS braucht es dafür nicht.

- [ ] **Schritt 5: Tests laufen lassen**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && npx vitest run tests/bibliothek-seite.test.ts 2>&1 | grep -E "Tests |×" && npx vitest run tests/basis-pfad.test.ts --reporter=verbose 2>&1 | grep -E "bibliothek.astro|Bestand.astro|Tests "
```
Erwartet: `Tests  4 passed (4)`, dann zwei Zeilen mit `✓` für `…bibliothek.astro enthaelt keinen absoluten Wurzel-Link` und `…Bestand.astro enthaelt keinen absoluten Wurzel-Link`, und `basis-pfad` ganz grün.

- [ ] **Schritt 6: Typen, Bau und das gebaute HTML ansehen**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && npm run check 2>&1 | grep -E "^- [0-9]+ (error|warning|hint)" && npm run build 2>&1 | grep -E "page\(s\)|error" && grep -o '<p class="quelle-kopf">[^<]*</p>' dist/bibliothek/index.html && grep -o '<p class="quelle-zahlen">[^<]*</p>' dist/bibliothek/index.html && grep -o '<p class="quelle-luecken"><strong>Lücken:</strong> [^<]*</p>' dist/bibliothek/index.html && grep -o 'data-status="[a-z]*"' dist/bibliothek/index.html | sort | uniq -c && grep -o 'data-warnung="[a-z-]*"' dist/bibliothek/index.html && grep -o '<a href="/lektion/[a-z-]*/">[^<]*</a></li>' dist/bibliothek/index.html && (grep -c 'astro-island\|type="module"' dist/bibliothek/index.html || true) && grep -o '<a href="/bibliothek/">Bibliothek</a>' dist/index.html
```
Erwartet, in dieser Reihenfolge:

```text
- 0 errors
- 0 warnings
- 0 hints
<SEITEN + 1> page(s) built
<p class="quelle-kopf">Repo · Stand a13701e</p>
<p class="quelle-zahlen">6 Prinzipien · 3 mit Lektion · 3 offen</p>
<p class="quelle-luecken"><strong>Lücken:</strong> 44 von 106 Dateien nicht übernommen</p>
      3 data-status="lektion"
      3 data-status="offen"
data-warnung="ohne-lehrplan"
<a href="/lektion/pauschal-heisst-nicht-komplett/">Pauschal heißt nicht komplett</a></li>
<a href="/lektion/recall-vor-precision/">Recall und Precision sind zwei Probleme, nicht eins</a></li>
0
<a href="/bibliothek/">Bibliothek</a>
```

Die `0` in der vorletzten Zeile zählt Inseln und Modulskripte auf der Seite: keine. Die beiden Inline-Skripte des Modusumschalters aus `Seite.astro` stehen auf jeder Seite und zählen hier nicht. Hat Aufgabe 0 `MANIFEST: fehlt` notiert, steht in der Lückenzeile statt der Zahlen `unbekannt — das Manifest liegt nur am Rechner, auf dem eingelesen wurde`.

- [ ] **Schritt 7: Kein Rohtext im gebauten Stand**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && (grep -rlE "warumNichtOffensichtlich|geprueftVon|\"rubrik\"|sha256:[0-9a-f]{64}" dist/ || echo "kein Rohtext im Bau")
```
Erwartet: `kein Rohtext im Bau`. Die Seite liest Lehrplan und Manifest zur Bauzeit; ins HTML kommt nur, was sie daraus macht. Steht hier ein Dateiname, ist Rohtext in ein Bündel geraten — anhalten und melden: `quellen/` darf den Rechner nicht verlassen, auch nicht in Teilen.

- [ ] **Schritt 8: Mutationsprobe**

In `src/pages/index.astro` `>Dein Lernprofil</a> · <a href=` ändern zu `>Dein Lernprofil</a><a href=` und den Befehl aus Schritt 2 laufen lassen. Erwartet: **genau ein** Test schlägt fehl — „fuehrt vom Fuss der Uebersicht dorthin, neben dem Lernprofil". Zurücknehmen, dann noch einmal: `Tests  4 passed (4)`.

- [ ] **Schritt 9: NUL-Prüfung, Commit**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && python -c "import sys; print(sum(open(f,'rb').read().count(b'\x00') for f in sys.argv[1:]))" src/pages/bibliothek.astro src/pages/index.astro tests/bibliothek-seite.test.ts && git add src/pages/bibliothek.astro src/pages/index.astro tests/bibliothek-seite.test.ts && git commit -q -F - <<'MSG'
feat: Seite /bibliothek und der Weg dorthin

Die Seite liest Lehrplaene und Manifeste zur Bauzeit ueber
import.meta.glob, prueft, verrechnet und zeigt den Bestand. Ohne Insel
und ohne Skript; im gebauten Stand steht kein Rohtext. Wo quellen/
fehlt - auf GitHub -, sagt die Karte, dass sie die Luecken nicht
kennt. Ein ungueltiger Lehrplan bricht den Bau nicht ab, er steht als
Warnung da: Zwischen Durchgang A und der Freigabe ist das der Normalfall.

Der Weg dorthin ist ein Verweis am Fuss der Uebersicht, neben dem
Lernprofil; die Kopfleiste bleibt, wie sie ist.

<CO-AUTHORED-BY>
MSG
```
Erwartet: `0`, danach ein Commit.

---

## Aufgabe 9: Gestaltung

**Dateien:**
- Ändern: `src/styles/global.css` (nur anhängen)

Kein neues Farbtoken. Alles hängt an den vorhandenen, damit gelten die gemessenen Kontraste weiter. Der Status einer Zeile trägt Farbe nur zusätzlich; das Wort steht immer da (WCAG 1.4.1).

- [ ] **Schritt 1: Den Block anhängen**

Ans Ende von `src/styles/global.css` anhängen — hinter der letzten Regel (`.reihenfolge-zeile .antwort-marke { … }`), mit einer Leerzeile dazwischen:

```css
/* ---------------------------------------------------------------
   Bibliothek und Vorbehalt (Teilprojekt 2a)

   Dieselben drei Regeln wie bei Aufgabenfamilie und Lernprofil:
   - Jede Bedienflaeche mindestens 44 x 44 Pixel, die grossen 48.
   - Umrisse bedienbarer Elemente ueber --rand-bedien (3:1, WCAG
     1.4.11), nie ueber --rand.
   - Kein neues Farbtoken. Ein Zustand, der nur Farbe traegt, ist
     keiner (WCAG 1.4.1): Jeder Status steht als Wort da, die Farbe
     kommt nur dazu.
   --------------------------------------------------------------- */

/* Der Vorbehalt unter dem Satz: in Lesegroesse und Textfarbe, nicht
   im Kleingedruckten — wie der Beipackzettel des Lernprofils. */
.vorbehalt {
  margin: 12px 0 0;
  padding: 12px 16px;
  font-size: 16px;
  line-height: 1.5;
  color: var(--ink);
  background: var(--flaeche);
  border: 1px solid var(--rand-stark);
  border-left: 3px solid var(--akzent-fill);
  border-radius: var(--radius-antwort);
  text-wrap: pretty;
}

/* --- die Karte einer Quelle --------------------------------------- */

.quelle + .quelle,
.quelle + .bestand-warnung,
.bestand-warnung + .bestand-warnung {
  margin-top: 18px;
}

.quelle h2 {
  margin: 0 0 2px;
  overflow-wrap: anywhere;
}

.quelle-kopf {
  margin: 0 0 14px;
  font-family: var(--schrift-mono);
  font-size: 12.5px;
  color: var(--ink-2);
  overflow-wrap: anywhere;
}

.quelle-zahlen {
  margin: 0 0 6px;
  font-family: var(--schrift-mono);
  font-size: 15px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.quelle-luecken {
  margin: 0 0 16px;
  font-size: 15.5px;
}

.quelle-liste {
  border-top: 1px solid var(--rand);
}

/* Der Knopf zum Aufklappen ist die ganze Zeile, mindestens 48 Pixel
   hoch. `display: list-item` behaelt das Dreieck des Browsers — mit
   `flex` verschwaende es in Chrome, und ein eigenes muesste man
   nachbauen. */
.quelle-liste > summary {
  display: list-item;
  min-height: 48px;
  padding: 12px 0;
  cursor: pointer;
  font-weight: 700;
  color: var(--ink);
}

.quelle-liste > summary:hover {
  color: var(--akzent);
}

.quelle-liste > ol {
  margin: 4px 0 0;
  padding-left: 1.4rem;
}

.zeile + .zeile {
  margin-top: 14px;
}

.zeile p {
  margin: 0;
}

.zeile-titel {
  font-size: 15.5px;
  line-height: 1.45;
}

.zeile-fundstelle {
  font-family: var(--schrift-mono);
  font-size: 12.5px;
  color: var(--ink-2);
  overflow-wrap: anywhere;
}

.zeile-status {
  font-size: 14.5px;
}

/* Der Verweis zur Lektion wird zur 44-Pixel-Flaeche; die Zeile waechst
   mit, statt dass er in die Nachbarzeile ragt. */
.zeile-status a {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
}

.zeile-marke {
  font-family: var(--schrift-mono);
  font-size: 11.5px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ink-2);
}

.zeile[data-status='lektion'] .zeile-marke {
  color: var(--teal);
}

.zeile[data-status='beauftragt'] .zeile-marke {
  color: var(--akzent);
}

.zeile[data-status='abgelehnt'] .zeile-marke {
  color: var(--falsch);
}

.zeile-grund,
.zeile-vorbehalt {
  margin-top: 4px;
  font-size: 14.5px;
}

.zeile-vorbehalt {
  padding-left: 10px;
  border-left: 3px solid var(--akzent-fill);
}

/* --- die Warnungen und der leere Bestand -------------------------- */

/* Derselbe Rand wie am Fehlerkasten der Widgets: Hier ist etwas zu
   entscheiden, nicht nur zu lesen. */
.bestand-warnung {
  border-left: 3px solid var(--falsch);
}

.bestand-warnung h2 {
  font-size: 19px;
}

.bestand-warnung > p {
  margin: 0;
  font-size: 15.5px;
}

.bestand-warnung ul {
  margin: 10px 0 0;
  padding-left: 1.25rem;
}

.bestand-warnung li a {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
}

.ungueltig h3 {
  margin: 16px 0 4px;
  overflow-wrap: anywhere;
}

.ungueltig code {
  overflow-wrap: anywhere;
}

.bestand-leer {
  color: var(--ink-2);
}
```

- [ ] **Schritt 2: Kein Token ins Leere, und der Bau steht**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && node -e "
const s=require('fs').readFileSync('src/styles/global.css','utf8');
const wurzel=s.slice(s.indexOf(':root {'), s.indexOf('@media'));
const definiert=new Set([...wurzel.matchAll(/--([a-z0-9-]+)\s*:/g)].map(m=>m[1]));
const benutzt=new Set([...s.matchAll(/var\(--([a-z0-9-]+)/g)].map(m=>m[1]));
const fehlt=[...benutzt].filter(n=>!definiert.has(n));
console.log(fehlt.length?'FEHLT: '+fehlt.join(', '):'alle benutzten Token stehen auf :root');
" && npm run build 2>&1 | grep -E "page\(s\)|error"
```
Erwartet: `alle benutzten Token stehen auf :root`, **SEITEN + 1** `page(s) built`.

- [ ] **Schritt 3: NUL-Prüfung, Commit**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && python -c "import sys; print(sum(open(f,'rb').read().count(b'\x00') for f in sys.argv[1:]))" src/styles/global.css && git add src/styles/global.css && git commit -q -F - <<'MSG'
feat: Gestaltung von Bibliothek und Vorbehalt

Kein neues Farbtoken. Der Vorbehalt steht in Lesegroesse und Textfarbe
unter dem Satz, mit dem Randstreifen des Beipackzettels - nicht im
Kleingedruckten. Der Knopf zum Aufklappen ist die ganze Zeile, mindestens
48 Pixel hoch; display: list-item behaelt das Dreieck des Browsers. Die
Verweise zu den Lektionen werden 44 Pixel hoch. Der Status einer Zeile
traegt Farbe nur zusaetzlich zum Wort. Die Warnungen tragen den Rand
des Fehlerkastens. Gemessen wird in der Abnahme am gebauten Stand.

<CO-AUTHORED-BY>
MSG
```
Erwartet: `0`, danach ein Commit.

---

## Aufgabe 10: Abnahme am gebauten Stand

**Dateien:** keine Quelldateien. Behebt die Abnahme einen Fehler, bekommt die Behebung einen eigenen Commit mit Messwert vorher und nachher.

Jeder Schnipsel unten ist in eine `await (async () => { … })()`-Klammer gefasst und gibt sein Ergebnis zurück — so stoßen sich die Namen mehrerer Schnipsel auf derselben Seite nicht. Die Werte in Pixeln stammen aus einem Probelauf am 2026-09-22; es zählt `zu klein: 0` und `ueberlauf: 0`, nicht das letzte Pixel.

- [ ] **Schritt 1: Die drei Schranken, die NUL-Prüfung, kein Rohtext**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && npm test 2>&1 | grep -E "Tests |Test Files |FAIL" && npm run check 2>&1 | grep -E "^- [0-9]+ (error|warning|hint)" && npm run build 2>&1 | grep -E "page\(s\)" && python -c "import subprocess; d=subprocess.run(['git','diff','--name-only','master...HEAD'],capture_output=True,text=True).stdout.split(); print('NUL-Bytes:', sum(open(f,'rb').read().count(b'\x00') for f in d), 'in', len(d), 'Dateien')" && (grep -rlE "warumNichtOffensichtlich|geprueftVon|\"rubrik\"|sha256:[0-9a-f]{64}" dist/ || echo "kein Rohtext im Bau")
```
Erwartet: **BASIS + 139** Tests bestanden · `- 0 errors`, `- 0 warnings`, `- 0 hints` · **SEITEN + 1** `page(s) built` · `NUL-Bytes: 0 in 23 Dateien` · `kein Rohtext im Bau`.

- [ ] **Schritt 2: Den gebauten Stand ausliefern**

Die Vorschau `kernbohrung-bau` (Port 4322) neu starten, damit sie den frischen Bau ausliefert: `preview_list` → laufenden Eintrag mit `preview_stop` beenden → `preview_start` mit `name: "kernbohrung-bau"`. Dann `resize_window` mit `preset: "mobile"` (375 × 812).

- [ ] **Schritt 3: `/bibliothek/` bei 375 px — Wortlaute, Flächen, Aufklappen**

`http://localhost:4322/bibliothek/` öffnen, dann:

```js
await (async () => {
  await new Promise((r) => setTimeout(r, 1000));
  const mass = (auswahl) => {
    const masse = [...document.querySelectorAll(auswahl)].map((e) => e.getBoundingClientRect());
    if (!masse.length) return 'keine im Bild';
    return `${masse.length} Stück, kleinste ${Math.round(Math.min(...masse.map((m) => m.width)))}x${Math.round(Math.min(...masse.map((m) => m.height)))}, zu klein: ${masse.filter((m) => m.width < 44 || m.height < 44).length}`;
  };
  const details = document.querySelector('.quelle-liste');
  const knopf = details.querySelector('summary');
  const vorher = { offen: details.open, knopf: mass('.quelle-liste > summary'), ueberlauf: document.documentElement.scrollWidth - innerWidth };
  knopf.click();
  await new Promise((r) => setTimeout(r, 200));
  return {
    kopf: document.querySelector('.quelle-kopf').textContent,
    zahlen: document.querySelector('.quelle-zahlen').textContent,
    luecken: document.querySelector('.quelle-luecken').textContent,
    vorher,
    offenNachKlick: details.open,
    knopfInTabFolge: knopf.tabIndex === 0,
    zeilen: [...document.querySelectorAll('.zeile')].map((z) => `${z.dataset.status}: ${z.querySelector('.zeile-status').textContent}`),
    zeilenVerweise: mass('.zeile-status a'),
    warnVerweise: mass('.bestand-warnung li a'),
    zurUebersicht: mass('.profil-verweis a'),
    ohneLehrplan: [...document.querySelectorAll('[data-warnung="ohne-lehrplan"] li')].map((l) => l.textContent),
    ueberlaufOffen: document.documentElement.scrollWidth - innerWidth,
  };
})();
```
Erwartet:
- `kopf: 'Repo · Stand a13701e'`, `zahlen: '6 Prinzipien · 3 mit Lektion · 3 offen'`, `luecken: 'Lücken: 44 von 106 Dateien nicht übernommen'`
- `vorher: { offen: false, knopf: '1 Stück, kleinste 281x50, zu klein: 0', ueberlauf: 0 }` — die Höhe mindestens 48
- `offenNachKlick: true`, `knopfInTabFolge: true`
- `zeilen`, in dieser Reihenfolge: `'lektion: mit Lektion · Kein Boden ist auch ein Boden'`, `'lektion: mit Lektion · Der Kontrollfluss folgt der Modellstärke'`, `'offen: offen'`, `'offen: offen'`, `'lektion: mit Lektion · Auslagern nimmt die Grundlage, nicht die Entscheidung'`, `'offen: offen'`
- `zeilenVerweise: '3 Stück, …, zu klein: 0'`, `warnVerweise: '2 Stück, …, zu klein: 0'`, `zurUebersicht: '1 Stück, …, zu klein: 0'`
- `ohneLehrplan: ['Pauschal heißt nicht komplett', 'Recall und Precision sind zwei Probleme, nicht eins']`
- `ueberlaufOffen: 0`

Eine Gruppe mit `zu klein` größer null wird in `global.css` behoben, nachgemessen und eigens committet. Hat Aufgabe 0 `MANIFEST: fehlt` notiert, lautet `luecken` wie in Schritt 7.

- [ ] **Schritt 4: Dunkler Modus**

Auf derselben Seite:

```js
await (async () => {
  document.documentElement.setAttribute('data-theme', 'dark');
  await new Promise((r) => setTimeout(r, 100));
  const farbe = (auswahl, eigenschaft) => { const e = document.querySelector(auswahl); return e ? getComputedStyle(e)[eigenschaft] : 'nicht im Bild'; };
  const aus = {
    karte: farbe('.quelle', 'backgroundColor'),
    kopf: farbe('.quelle-kopf', 'color'),
    knopf: farbe('.quelle-liste > summary', 'color'),
    trenner: farbe('.quelle-liste', 'borderTopColor'),
    markeLektion: farbe(".zeile[data-status='lektion'] .zeile-marke", 'color'),
    markeOffen: farbe(".zeile[data-status='offen'] .zeile-marke", 'color'),
    warnRand: farbe('.bestand-warnung', 'borderLeftColor'),
  };
  document.documentElement.removeAttribute('data-theme');
  return aus;
})();
```
Erwartet: `karte: 'rgb(22, 27, 30)'` (`--flaeche`), `kopf: 'rgb(141, 152, 148)'` (`--ink-2`), `knopf: 'rgb(232, 235, 231)'` (`--ink`), `trenner: 'rgb(42, 49, 52)'` (`--rand`), `markeLektion: 'rgb(47, 184, 166)'` (`--teal`), `markeOffen: 'rgb(141, 152, 148)'` (`--ink-2`), `warnRand: 'rgb(224, 118, 60)'` (`--falsch`). Ein heller Wert hieße: Eine Regel hängt an einer festen Farbe statt an einem Token.

- [ ] **Schritt 5: Der Weg von der Übersicht — und die Kopfleiste, wie sie ist**

`http://localhost:4322/` öffnen:

```js
await (async () => {
  await new Promise((r) => setTimeout(r, 1000));
  const verweise = [...document.querySelectorAll('.profil-verweis a')];
  const marke = document.querySelector('.marke').getBoundingClientRect();
  const schalter = document.querySelector('.schalter').getBoundingClientRect();
  return {
    text: document.querySelector('.profil-verweis').textContent,
    verweise: verweise.map((a) => { const r = a.getBoundingClientRect(); return `${a.textContent} ${Math.round(r.width)}x${Math.round(r.height)} → ${a.getAttribute('href')}`; }),
    eineZeile: new Set(verweise.map((a) => Math.round(a.getBoundingClientRect().top))).size === 1,
    leiste: Math.round(document.querySelector('.leiste').getBoundingClientRect().height),
    umschalterUnterDerMarke: schalter.top >= marke.bottom,
    ueberlauf: document.documentElement.scrollWidth - innerWidth,
  };
})();
```
Erwartet: `text: 'Dein Lernprofil · Bibliothek'`, zwei `verweise` — `'Dein Lernprofil 99x44 → /profil/'` und `'Bibliothek 66x44 → /bibliothek/'` (Höhe je 44) —, `eineZeile: true`, `ueberlauf: 0`. `leiste: 109` und `umschalterUnterDerMarke: true` sind keine Anforderung, sondern der Messwert für Präzisierung 6: Die Kopfleiste ist bei 375 px zweizeilig, mit oder ohne diesen Plan. Beide Werte in den Bericht.

- [ ] **Schritt 6: Der Vorbehalt unter dem Satz — Größe und Farben**

Heute trägt keine Lektion einen Vorbehalt. Das Markup ist in Aufgabe 3 gerendert geprüft; hier geht es um die Gestaltung. `http://localhost:4322/lektion/pauschal-heisst-nicht-komplett/` öffnen:

```js
await (async () => {
  await new Promise((r) => setTimeout(r, 1000));
  // Genau das Markup, das LektionAnsicht.astro erzeugt (tests/lektion-vorbehalt.test.ts),
  // von Hand unter den Satz gesetzt — nur fuer diese Messung, nichts wird gespeichert.
  document.querySelector('.prinzip').insertAdjacentHTML('afterend', '<p class="vorbehalt"><strong>Vorbehalt:</strong> Für feste Behaltensquoten je Aufnahmekanal gibt es keine nachvollziehbare empirische Quelle.</p>');
  const v = document.querySelector('.vorbehalt');
  const p = document.querySelector('.prinzip');
  const stil = (e) => { const s = getComputedStyle(e); return { schrift: s.fontSize, farbe: s.color, flaeche: s.backgroundColor, randLinks: `${s.borderLeftColor} ${s.borderLeftWidth}` }; };
  const hell = stil(v);
  document.documentElement.setAttribute('data-theme', 'dark');
  await new Promise((r) => setTimeout(r, 100));
  const dunkel = stil(v);
  document.documentElement.removeAttribute('data-theme');
  return { hell, dunkel, abstandUnterDemSatz: Math.round(v.getBoundingClientRect().top - p.getBoundingClientRect().bottom), ueberlauf: document.documentElement.scrollWidth - innerWidth };
})();
```
Erwartet: `hell: { schrift: '16px', farbe: 'rgb(20, 25, 27)', flaeche: 'rgb(255, 255, 255)', randLinks: 'rgb(232, 163, 60) 3px' }`, `dunkel: { schrift: '16px', farbe: 'rgb(232, 235, 231)', flaeche: 'rgb(22, 27, 30)', randLinks: 'rgb(232, 163, 60) 3px' }`, `abstandUnterDemSatz: 12`, `ueberlauf: 0`. Lesegröße und Textfarbe — nicht `--ink-2`, nicht unter 16 px. Danach die Seite neu laden (der eingesetzte Absatz verschwindet) und `resize_window` mit `preset: "desktop"`.

- [ ] **Schritt 7: Der Bau ohne Manifest — so baut GitHub**

Hat Aufgabe 0 `MANIFEST: fehlt` notiert, entfällt dieser Schritt: Dann war jeder Bau bisher einer ohne Manifest, und Schritt 3 hat es schon gezeigt.

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && cp quellen/awesome-llm-apps/manifest.json quellen/awesome-llm-apps/manifest.sicherung && mv quellen/awesome-llm-apps/manifest.json quellen/awesome-llm-apps/manifest.weg && npm run build 2>&1 | grep -E "page\(s\)|error"; mv quellen/awesome-llm-apps/manifest.weg quellen/awesome-llm-apps/manifest.json && cmp quellen/awesome-llm-apps/manifest.json quellen/awesome-llm-apps/manifest.sicherung && rm quellen/awesome-llm-apps/manifest.sicherung && echo "Manifest unveraendert zurueck" && grep -o '<p class="quelle-luecken"><strong>Lücken:</strong> [^<]*</p>' dist/bibliothek/index.html && grep -o '<p class="quelle-zahlen">[^<]*</p>' dist/bibliothek/index.html
```
Erwartet: **SEITEN + 1** `page(s) built` · `Manifest unveraendert zurueck` · `<p class="quelle-luecken"><strong>Lücken:</strong> unbekannt — das Manifest liegt nur am Rechner, auf dem eingelesen wurde</p>` · `<p class="quelle-zahlen">6 Prinzipien · 3 mit Lektion · 3 offen</p>`.

Das Semikolon hinter dem Bau ist Absicht: Auch wenn der Bau scheitert, kommt das Manifest zurück. Kommt `Manifest unveraendert zurueck` **nicht**, liegt die Sicherung als `manifest.sicherung` daneben — anhalten und melden, nichts von Hand „reparieren".

- [ ] **Schritt 8: Ein Lehrplan, der auf die Freigabe wartet**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && sed -i 's/^geprueftVon: "Daniel Nobs"/geprueftVon: ""/' lehrplan/awesome-llm-apps.yaml && grep -c '^geprueftVon: ""' lehrplan/awesome-llm-apps.yaml && npm run build 2>&1 | grep -E "page\(s\)|error"; git checkout -- lehrplan/awesome-llm-apps.yaml && git status --short lehrplan/ && echo "Lehrplan zurueck" && (grep -c 'class="karte quelle"' dist/bibliothek/index.html || true) && grep -o '<h3>[^<]*</h3>' dist/bibliothek/index.html && grep -o '<code>[^<]*</code>' dist/bibliothek/index.html && grep -o '<a href="/lektion/[a-z-]*/">[^<]*</a></li>' dist/bibliothek/index.html | wc -l
```
Erwartet: `1` · **SEITEN + 1** `page(s) built` — der Bau scheitert **nicht** · keine Zeile von `git status` · `Lehrplan zurueck` · `0` (keine Karte) · `<h3>awesome-llm-apps.yaml</h3>` · `<code>geprueftVon: geprueftVon fehlt — der Lehrplan ist das Review-Gate.</code>` · `5` (alle fünf Lektionen stehen jetzt ohne gültigen Lehrplaneintrag da). Das ist Präzisierung 10 am echten Bau: der Zustand zwischen Durchgang A und der Freigabe.

- [ ] **Schritt 9: Zurück zum normalen Bau, und die ortsunabhängige Kopie**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && npm run build 2>&1 | grep -E "page\(s\)" && grep -o '<p class="quelle-luecken"><strong>Lücken:</strong> [^<]*</p>' dist/bibliothek/index.html && rm -rf handy && cp -r dist handy && node werkzeug/relative-verweise.mjs handy && grep -o '<a href="[^"]*">Bibliothek</a>' handy/index.html && grep -o '<a href="[^"]*">Zur Übersicht</a>' handy/bibliothek/index.html && grep -o '<a href="[^"]*lektion/[^"]*">' handy/bibliothek/index.html | sort -u
```
Erwartet: **SEITEN + 1** `page(s) built` · die Lückenzeile wieder mit `44 von 106 Dateien nicht übernommen` · `… Verweise relativiert.` und `Kein wurzelbezogener Verweis mehr uebrig.` · `<a href="./bibliothek/index.html">Bibliothek</a>` · `<a href="../index.html">Zur Übersicht</a>` · fünf Zeilen `<a href="../lektion/<id>/index.html">` (drei aus den Zeilen, zwei aus der Warnung). `handy/` steht in `.gitignore`. Das Artifact aktualisiert die Hauptsitzung, kein Subagent; **es bleibt privat**, es enthält Lektionen aus fremdem Lehrmaterial.

- [ ] **Schritt 10: Übergabe**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && git status --short && git log --oneline master..bibliothek-2a
```
Erwartet: sauberer Baum (`quellen/` und `handy/` sind gitignored); neun Commits dieses Plans, einer je Aufgabe 1 bis 9, dazu je Behebung aus der Abnahme einer. Das Zusammenführen entscheidet der Nutzer — dafür `superpowers:finishing-a-development-branch`.

---

## Nachträge aus den Reviews und der Abnahme (2026-09-22)

Jede Aufgabe ist einzeln reviewt, der ganze Zweig zum Schluss noch einmal. Die folgenden Abweichungen vom Plan sind beschlossen und getestet; der Commit steht in Klammern.

**Wortlaute und Markup**
- Der Aufklappknopf nennt die Quelle: „Alle Prinzipien von ‹Titel›", „Alle Abschnitte von ‹Titel›" (Präzisierung 14, Aufgaben 6 und 7). Sonst tragen mehrere `summary` denselben Text und sind in der Elementliste eines Screenreaders nicht zu unterscheiden (8c3bccf). Folge in der Abnahme: Bei 375 px ist der Knopf zweizeilig, 281 × 77 statt 281 × 50 — über der Mindesthöhe von 48.
- Ungültige Lehrpläne stehen als Liste, wie jede andere wiederholte Sammlung der Seite: `<ul><li class="ungueltig"><h3>…</h3><ul><li><code>…</code></li></ul></li></ul>` statt `<div class="ungueltig">` (8c3bccf). Ein Test hält das ganze Fragment (25b6542). Die Regel `.bestand-warnung[data-warnung='ungueltig'] > ul` nimmt der äußeren Liste Einzug und Punkte; die innere behält genau einen Einzug (46266a8; gemessen: `h3` 29 px, `code` 49 px vom Kartenrand).
- Einzahl in der Lückenzeile: „1 von 1 Folie nur Bild", „1 von 1 Seite nur Bild", „1 von 1 Datei nicht übernommen" (8c3bccf, 25b6542).
- Mängel auf Deutsch, über Präzisierung 15 hinaus: `pruefeLehrplan` prüft mit einer eigenen Fehlerfunktion (`deutscheMeldung`), die übersetzt, was Zod sonst englisch meldet — „fehlt.", „ist leer.", „braucht mindestens 2 Einträge.", „ist nicht erlaubt — erlaubt: …", „unbekanntes Feld: …"; der Rest fällt auf `z.locales.de` zurück, ein globales `z.config` gibt es nicht. Meldungen im Schema haben Vorrang. Folien mit `isbn` oder `auflage`: „isbn und auflage stehen nur bei art: buch." `vorbehalt:` ohne Wert und `vorbehalt: ""` haben eigene Sätze (fd8d252). Ein YAML-Fehler steht in einer Zeile, mit Zeile und Spalte (fa9170c).

**Schärfere Regeln**
- `stand` ist vollständig — bei Repos der Commit mit 40 Zeichen aus 0–9 und a–f, bei Buch und Folien `sha256:` und 64 Zeichen. `quelle` ist der Kurzname des Ordners unter `quellen/` (Muster der Ids). Grund: `abdeckung` vergleicht den Stand mit dem Manifest exakt; ein Kurz-SHA hätte „anderer Stand" ergeben, obwohl es derselbe Commit ist (e9aba39).
- `quelle` ist bei Buch und Folien Pflicht, mit Test (905c469).
- Tests für Regeln, die bisher keiner hielt: Die Obergrenze 8 gilt nur für Repos; `lektion` bei `abgelehnt` und `beauftragt`, `grund` bei `lektion`; der Standardordner von `liesLehrplan` (9c77d98).

**Gestaltung, gemessen in der Abnahme**
- `overflow-wrap: anywhere` auch am Aufklappknopf (3d4b20c — mit einem Titel ohne Trennstelle vorher 373 px Inhalt in 281 px, nachher 281) und an `.zeile-titel` (6d93fef — mit dem Ersatztitel „‹Dateiname›, Folien a–b" aus 2b ohne die Regel 394 px in 259 px, mit ihr 259).

**Umgebung**
- Node ab 22.18, weil `werkzeug/*.mjs` TypeScript-Dateien direkt laden: `engines` in `package.json` und im Lockfile, dazu das README (905c469, 2828188). `js-yaml` steht unter `dependencies`, weil die Seite es beim Bau braucht (2828188).

**Zahlen am Ende**
- 795 Tests = BASIS 609 + 139 aus dem Plan + 47 aus den Nacharbeiten. `astro check` 0/0/0, Bau 9 Seiten (SEITEN 8 + 1), kein Rohtext im Bau. NUL-Prüfung über 27 Dateien: 0 — der Plan rechnete 23; dazu kommen der Plan selbst, `package.json`, `package-lock.json` und `README.md`.
- Abnahme bei 375 px, Schritte 3 bis 9: wie erwartet bis auf die Knopfhöhe oben. Präzisierung 6 gemessen: Kopfleiste 109 px, der Umschalter steht unter der Marke — zweizeilig mit oder ohne diesen Plan. Bau ohne Manifest und Bau mit wartendem Lehrplan wie erwartet; bei wartendem Lehrplan stehen alle fünf Lektionen unter „ohne Lehrplaneintrag", alle fünf Verweise 44 px hoch.

**Offen für 2b und 2c — entschieden wird im jeweiligen Plan**
- **Freigabe je Durchgang.** Laut Spec leert Durchgang A bei Lehrmaterial `geprueftVon`. Dann verschwindet die Karte samt Zahlen (Präzisierung 10), und alle früher freigegebenen Lektionen der Quelle stehen unter „ohne Lehrplaneintrag" — auch in einem Handy-Bau aus dieser Zeit. Das trifft schon 2b: Das erste Einlesen legt einen Lehrplan ohne Freigabe an. Vorschlag aus dem Schlussreview: ein eigener Zustand „wartet auf Freigabe", wenn nur `geprueftVon` und `geprueftAm` bemängelt sind — die Karte bleibt mit Zahlen, markiert als nicht freigegeben.
- `status: lektion` mit `prinzipien: []` zählt als abgedeckt, obwohl kein Prinzip durch das Review-Gate ging (2c).
- Ob ein `vorbehalt` aus dem Lehrplan auch in der Lektion steht, prüft niemand — bei Repos schon heute (2c, `pruefe-lektion`).
- Dieselbe Prinzip-Id in zwei Repo-Lehrplänen zählt eine Lektion doppelt.
- Ist `quelle` falsch geschrieben, sagt die Lückenzeile „liegt nur am Rechner, auf dem eingelesen wurde" auch auf genau diesem Rechner.
- Klein: `ERWARTET` in `deutscheMeldung` kennt nur die Typen, die das Schema heute hat. Der Test zum Standardordner hängt an der Lektion `pauschal-heisst-nicht-komplett`. In `.zeile-status` bricht der Verweis bei 375 px unter „mit Lektion ·" um; der Punkt steht dann am Zeilenende.

---

## Selbstprüfung gegen den Spec

Nur der Umfang von 2a.

| Spec (2a) | Aufgabe |
|---|---|
| Lehrplan als diskriminierte Union über `art`; `repo` wie bisher plus `art`, `HOECHSTZAHL` = 8 nur für Repos | 1, 2 |
| Lehrpläne ohne `art` abgewiesen, mit Test auf die Meldung | 1 (+ Probe A), 2 |
| `awesome-llm-apps.yaml` bekommt `art: repo` | 1 (+ Test unter Node am echten Lehrplan) |
| Buch und Folien: `quelle`, `titel`, `isbn`/`auflage` nur beim Buch, `stand`, `geprueftVon`/`geprueftAm`, `abschnitte` | 2 (+ Probe K) |
| Abschnitt: `id`, `titel`, `datei`, `seiten`, `status` (vier Werte), `prinzipien` 0–3 | 2 (+ Proben I, J), Präzisierungen 7, 9 |
| `grund` genau dann, wenn `abgelehnt` | 2 (+ Proben A, B) |
| `lektion` genau dann, wenn `lektion`, und die Datei muss existieren | 2 (+ Proben C, D, E), Präzisierung 8 |
| Abschnitt-Ids eindeutig; Seitenbereiche je Datei aufsteigend und überschneidungsfrei | 2 (+ Proben F, G, H) |
| `vorbehalt` am Prinzip, ein Satz | 1 (+ Probe C), 2 |
| `LektionSchema.vorbehalt`, optional, unter dem Satz, sichtbar | 3 (+ Proben A, B), 9, 10 (Schritt 6), Präzisierung 4 |
| `abdeckung(lehrplaene, manifeste, lektionsIds)` rein, ohne Dateizugriff | 5, Präzisierung 11 |
| Repo: abgedeckt, wenn Lektion-Id = Prinzip-Id | 5 (+ Probe A) |
| Buch/Folien: Zählung nach Status; Bildseiten und Tabellenverdacht aus dem Manifest | 4, 5 (+ Probe E), 6 |
| Lektionen ohne Lehrplaneintrag — als Warnung, nicht als Abdeckung | 5 (+ Probe D), 7, 8, 10 (Schritte 3, 8) |
| Tests für Repo, Buch, Folien, leeren Bestand, Lektion ohne Eintrag | 5 |
| `/bibliothek`: Karte je Quelle mit Titel, Art, Stand (bei Büchern ISBN und Auflage) | 6, 7, 8 |
| Zahlenzeile (`… Abschnitte · … mit Lektion · … offen · … abgelehnt`; Repos in Prinzipien) | 6 (+ Probe A), 7, 8 |
| Was der Text nicht hergibt — damit niemand den Bestand für vollständig hält | 4, 5 (+ Probe B), 6 (+ Probe B), 7 (+ Probe A), 10 (Schritt 7), Präzisierungen 1, 2 |
| Aufklappbar: Abschnitte mit Status; Grund, Verweis, Hinweis bei Vorbehalt | 7 (+ Probe B), 9, 10 (Schritt 3), Präzisierung 5 |
| Gebaut zur Bauzeit aus `lehrplan/*.yaml` und `quellen/*/manifest.json` über `src/lib/abdeckung.ts` | 8, Präzisierung 16 |
| 375 px ohne Überlauf; Aufklappen per Knopf ≥ 44 px | 9, 10 (Schritte 3, 5, 6) |
| Verlinkt in der Kopfleiste | 8 — am Fuß der Übersicht, Präzisierung 6 |
| Nachweis: Der Bau erzeugt `/bibliothek/index.html` mit den Zahlen des heutigen Bestands, gegen den Bestand geprüft | 0 (Schritt 4), 5 („der heutige Bestand"), 8 (Schritt 6), 10 |
| B vorbereitet: Der Auftrag ist Datenform — Statusfelder mit Zod-Schema, das auch ein Browser laden kann | 2, Präzisierung 3 |
| Urheberrecht: `quellen/` bleibt am Rechner | 8 (Schritt 7), 10 (Schritt 1) |
| Eintragen, Adapter, Gliederer, Manifest Fassung 3, Dev-Endpunkte (2b); Compiler-Abschnitt, Prüfung auf wörtliche Übernahme (2c) | nicht Teil dieses Plans; `Manifestauszug` trägt die Form `dokument` schon, der Compiler-Skill nur `art: repo` |

**Testzahlen entlang des Plans (Zuwachs gegenüber BASIS):** +17 (1) → +61 (2) → +66 (3) → +80 (4) → +99 (5) → +122 (6) → +134 (7, davon einer in `basis-pfad`) → +139 (8, davon einer in `basis-pfad`). Aufgabe 9 bringt keine Tests; ihr Nachweis ist die Abnahme.

**Namen über die Aufgaben hinweg:** `HOECHSTZAHL`, `ART_FEHLT`, `LehrplanSchema`, `pruefeLehrplan(daten, lektionsIds)`, `lehrplanAusYaml(text, lektionsIds, name)`, `lehrplaeneAusTexten(texte, lektionsIds)`, `liesLehrplan(datei, lektionsordner?)`, Typen `Lehrplan`, `Prinzip`, `Befund`, `Ungueltig` (1) · `HOECHSTZAHL_JE_ABSCHNITT`, `STATUS`, Typen `Abschnitt`, `Status` (2) · `vorbehalt` in `LektionSchema` (3) · `Manifestauszug`, `leseManifestauszug`, `manifesteAusTexten` (4) · `abdeckung`, Typen `Abdeckung`, `Bestand`, `Zeile`, `Zaehlung`, `Luecken` (5) · `STATUS_TEXT`, `kurzstand`, `kopfzeile`, `zahlenzeile`, `lueckenzeile`, `fundstelle`, `aufklapptext` (6) · `Bestand.astro` mit den Props `abdeckung`, `ungueltig`, `lektionstitel` (7). Klassen und Merkmale, an denen Tests oder Abnahme hängen: `.vorbehalt`, `.quelle`, `.quelle-kopf`, `.quelle-zahlen`, `.quelle-luecken`, `.quelle-liste`, `.zeile`, `.zeile-titel`, `.zeile-fundstelle`, `.zeile-status`, `.zeile-marke`, `.zeile-grund`, `.zeile-vorbehalt`, `.bestand-warnung`, `.ungueltig`, `.bestand-leer`, `.profil-verweis`, `[data-quelle]`, `[data-status]`, `[data-warnung]`.
