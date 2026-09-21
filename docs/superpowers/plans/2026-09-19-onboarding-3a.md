# Kernbohrung — Onboarding 3a: Audit und Profil — Implementierungsplan

> **Für agentische Ausführung:** ERFORDERLICHER SUB-SKILL: `superpowers:subagent-driven-development` (empfohlen) oder `superpowers:executing-plans`. Schritte nutzen Checkbox-Syntax (`- [ ]`).

**Ziel:** Ein überspringbares Audit erhebt ein Lernprofil — 26 eigene Aussagen (sechs Strategie-Skalen, vier Lernmuster nach Vermunt) und drei Vorlieben — und zeigt es auf einer Ergebnisseite: das Muster („derzeit"), sechs Balken mit Zahl, je Schwachstelle ein Vorschlag und ein Beipackzettel, der nie fehlt, wenn ein Muster dasteht. Gespeichert werden die Antworten, nie das Ergebnis.

**Architektur:** Alles liegt unter `src/profil/`. Vier reine Module — `items.ts` (Daten), `schema.ts` (Zod: was aus dem Speicher kommt), `auswertung.ts` (die Regeln), `vorschlag.ts` (was die App daraus anbietet) — und zwei Inseln, `Audit.tsx` und `Ergebnis.tsx`, die einen `Speicher` als Prop hereingereicht bekommen wie `Aufgabe.tsx`. Der Stand liegt im vorhandenen Speicher `einstellungen` unter `profil`, der Zwischenstand unter `profil:entwurf`; der Speicher bekommt **keine** neue Fassung. Verweise stehen im Astro-Markup und kommen als Slots in die Inseln, damit `werkzeug/relative-verweise.mjs` sie erreicht.

**Stack:** Astro, React, Zod 4 über `astro/zod`, `idb`, Vitest mit Testing Library und `fake-indexeddb`. **Keine neue Abhängigkeit.**

**Spec:** `docs/superpowers/specs/2026-09-19-onboarding-lernprofil-design.md`, Abschnitt „Teil 3a — Audit und Profil". **Nicht Teil dieses Plans:** Teil 3b (was das Profil steuert), die Lernziele je Quelle und die Standortbestimmung.

**Voraussetzung:** ~~Die Aufgabenfamilie ist abgeschlossen.~~ Überholt — siehe den Nachtrag direkt darunter.

## Nachtrag vom 2026-09-21: vorgezogen, gebaut auf dem Stand von `master`

Entschieden am 2026-09-21: Teil 3a wird **vor** dem Abschluss der Aufgabenfamilie gebaut, auf dem Zweig `onboarding-3a`, abgezweigt von `master` (`6f4c0b5`). So kommt das Onboarding auf das Handy, ohne auf die sechs offenen Schritte der Aufgabenfamilie zu warten. Geprüft am 2026-09-21: `master` hat alles, was dieser Plan braucht — `einstellung()` und `merkeEinstellung()` im Speicher, die Speicher-Naht in `Frage.tsx`, alle Farbtoken, `werkzeug/relative-verweise.mjs`, eine `index.astro` ohne `<script>`. Die Aufgabenfamilie ändert weder `src/pages/` noch `global.css` noch `Seite.astro`. Es fehlt nur die Klasse `.abgeben`.

Wo der Plan unten die Aufgabenfamilie voraussetzt, gilt stattdessen:

1. **Aufgabe 0, Schritt 1** prüft: sauberer Baum · Zweig `onboarding-3a` · `grep -c "^\.abgeben {" src/styles/global.css` ergibt `0` · `ls src/components/Frage.tsx tests/frage.test.tsx` findet beide · `<script` in `src/pages/index.astro` ergibt `0`. **Schritt 2 entfällt**, der Zweig besteht schon.
2. **`Aufgabe.tsx` als Muster** heißt hier `src/components/Frage.tsx` (dieselbe Naht: `speicher?: Speicher`, voreingestellt ein geteilter Speicher; erst die Anzeige, dann das Schreiben). `tests/aufgabe.test.tsx` heißt `tests/frage.test.tsx`. Die Testdateien dieses Plans definieren ihr eigenes `spion()` und importieren nichts von dort.
3. **`.abgeben`** legt Aufgabe 9 selbst an — am Ende von `global.css`, **vor** dem Block „Lernprofil", wortgleich mit Aufgabe 13 der Aufgabenfamilie (Regel `.abgeben` und `.abgeben:disabled`, samt ihrem Kommentar). „Hinter dem Block der Aufgabenfamilie" heißt hier: am Ende der Datei. Wird die Aufgabenfamilie später mit `master` zusammengeführt, lässt ihre Aufgabe 13 den Block weg, weil er schon steht.
4. **Abnahme (Aufgabe 10):** `dist/astro/Aufgabe.*.js` heißt `dist/astro/Frage.*.js`. Die Aussage bleibt: Die Insel der Lektionsseiten kommt ohne Zod aus.
5. **Präzisierung 15 ist überholt.** Die drei Vorschläge wurden am 2026-09-19 umformuliert (siehe Spec) und greifen 3b nicht mehr voraus.
6. **Regel 5** nennt `src/aufgaben/` — das gibt es auf `master` noch nicht; für `src/profil/` gilt die Regel unverändert.
7. **Nacharbeit aus dem Abschluss-Review (2026-09-21, zwei Commits):** Ein Lernmuster wird nur noch genannt, wenn sein Mittel `MUSTER_AB` (3,5) erreicht — sonst „undeutlich" statt des schwächsten Maximums. Der Vorschläge-Abschnitt unterscheidet „keine Antworten" von „erhoben, aber keine Schwachstelle". Die vier Mustererklärungen beginnen einheitlich mit „Nach deinen Antworten" und ohne die Behauptung „am meisten hilft". Der Beipackzettel verweist nicht mehr auf die Kalibrierungsansicht, die es noch nicht gibt.

---

## Was jeder Ausführende wissen muss

Die Regeln 1 bis 10 stammen aus dem Plan der Aufgabenfamilie und aus Fehlern, die in diesem Projekt tatsächlich passiert sind. 11 bis 13 sind Lehren aus deren Umbau.

1. **Das Arbeitsverzeichnis der Bash-Aufrufe wandert nicht mit.** Jeder Aufruf beginnt mit
   `cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && `.
2. **Niemals `git add -A` oder `git add .`** — immer die Dateien einzeln aufzählen.
3. **Commit-Nachrichten über `git commit -F - <<'MSG'`** und nur mit geraden Anführungszeichen. Deutsche Anführungszeichen in einer Bash-Zeichenkette zerlegen den Befehl. Letzte Zeile: die Co-Authored-By-Zeile, die die eigene Sitzung vorgibt. In den Befehlen unten steht an dieser Stelle `<CO-AUTHORED-BY>` — das wird **ersetzt**, nicht mitcommittet.
4. **Kein NUL-Byte in eine Datei.** Ein Agent hat einmal eines als Trennzeichen geschrieben; alle Tests blieben grün, aber Git führte die Datei fortan als Binärdatei. Prüfung am Ende jeder Aufgabe:
   `python -c "import sys; print(sum(open(f,'rb').read().count(b'\x00') for f in sys.argv[1:]))" <dateien>` → `0`.
5. **Relative Importe in `src/profil/` tragen KEINE Endung.** Die Regel der Aufgabenfamilie — `.ts` anhängen — gilt nur für Dateien, die `werkzeug/` unter reinem Node lädt (`src/content/schema.ts`, die `schema.ts` und `bewerten.ts` unter `src/aufgaben/`, `src/widgets/pruefung.ts`): Node löst relative Importe ohne Endung nicht auf. `src/profil/` lädt niemand unter Node — der Compiler erzeugt keine Profile. Also einheitlich `from './items'`, nicht `from './items.ts'`. Einzige Ausnahme wie überall im Projekt: Eine `.astro`-Datei bindet eine Insel **mit** Endung ein (`import Audit from '../../profil/Audit.tsx'`).
6. **Zod gehört nicht ins Bündel der Lektionsseiten — und hier mit Absicht ins Bündel des Profils.** Bei der Aufgabenfamilie prüft Zod nur beim Bauen; deshalb holen sich Komponenten dort aus `schema.ts` ausschließlich Typen (`import type`). Das Profil wird **im Browser** gelesen, aus einem fremden Speicher — dort muss geprüft werden. Die Regel lautet deshalb: `auswertung.ts` und `vorschlag.ts` importieren aus `src/profil/schema.ts` nur **Typen** und bleiben damit frei von Zod. Im Browser importieren es zur Laufzeit genau drei Stellen: `Audit.tsx`, `Ergebnis.tsx` und das Skript in `src/pages/index.astro`. Die Abnahme misst, was das kostet, und hält fest, dass `Aufgabe.*.js` weiterhin ohne Zod auskommt.
7. **TDD:** erst der fehlschlagende Test, dann die Umsetzung. Befehle: ein Test `npx vitest run tests/<datei>`, alle `npm test`, Typen `npm run check`, Bau `npm run build`.
8. **Farben nur über die vorhandenen Token** in `src/styles/global.css`. Ein Farbtoken darf nie nur in einem `@media`- oder `[data-theme]`-Block stehen. Dieser Plan führt kein neues Token ein und hängt in `global.css` nur an.
9. **Jede Bedienfläche mindestens 44 × 44 CSS-Pixel.** Gemessen wird am gebauten Stand bei 375 px, nicht geschätzt.
10. **Browserprüfung am gebauten Stand** (`preview_start` mit Name `kernbohrung-bau`, Port 4322), nicht am Dev-Server: Dessen Vite-Zwischenspeicher hat in diesem Projekt schon leere Inseln geliefert. Der Pane malt beim Scrollen unzuverlässig — mit `javascript_tool` messen, nicht mit Bildschirmfotos.
11. **Nie zwei Läufe gleichzeitig.** `npm test`, `npm run check` und `npm run build` teilen sich Zwischenspeicher und Ausgabeordner. Parallele Läufe — auch die eines anderen Agenten im selben Ordner — erzeugen Fehler, die es nicht gibt. Scheitert ein Lauf unerklärlich: einmal allein wiederholen, bevor du etwas „reparierst".
12. **Keine absoluten Gesamttestzahlen.** Die Basis verschiebt sich mit jedem anderen Zweig. Aufgabe 0 notiert die Zahl als **BASIS**, die Seitenzahl des Baus als **SEITEN**. Dieser Plan nennt nur die Zahl je Testdatei und den Zuwachs.
13. **Wortlaute werden übernommen, nicht verbessert.** Die 26 Aussagen, die drei Vorlieben, die sechs Vorschläge, der Beipackzettel und der Satz zur Momentaufnahme stehen wörtlich im Spec — mit Umlauten. Tests halten sie Zeichen für Zeichen fest. Bezeichner und Kommentare im Code bleiben wie im ganzen Projekt ohne Umlaute.

Zwei Dinge über die Testumgebung, die sonst eine Stunde kosten:

- **jsdom kennt `CSS.escape` nicht.** user-event braucht es bei jeder Pfeiltaste auf einem Radiofeld mit `name` und wirft sonst `Cannot read properties of undefined (reading 'escape')`. `tests/profil-audit.test.tsx` schließt die Lücke in seinen ersten Zeilen. Das ist eine Lücke der Testumgebung, nicht der Komponente — im Browser gibt es die Funktion.
- **Ein Durchlauf durch das Audit sind Dutzende Bedienschritte, jeder kostet unter jsdom einige zehn Millisekunden.** Die Testdatei stellt deshalb `userEvent.setup({ delay: null })` ein (die Voreinstellung wartet nach jedem Teilschritt auf einen Zeitgeber, der unter Windows frühestens nach rund 15 ms feuert), sucht Knöpfe über ihre Beschriftung statt über `getByRole` und setzt die Frist je Test auf 20 Sekunden. `tests/profil-audit.test.tsx` braucht insgesamt 10 bis 20 Sekunden. Das ist erwartet.

## Präzisierungen gegenüber dem Spec

An diesen Stellen ließ der Spec eine Entscheidung offen, oder die Umsetzung hat sie genauer gemacht. Dieser Plan ändert den Spec nicht; ob er nachgezogen wird, entscheidet die Hauptsitzung.

1. **Das Ergebnis erscheint am Ende des Audits an Ort und Stelle; `/profil` zeigt dasselbe aus dem Speicher.** Der Spec nennt als dritten Schritt „Ergebnis auf `/profil`". Der Fall „Speichern gescheitert, Ergebnis trotzdem zeigen" braucht die Anzeige im Audit ohnehin — ein Weg statt zwei. Und ein Seitenwechsel aus JavaScript heraus wäre ein wurzelbezogener Verweis, den `relative-verweise.mjs` nicht erreicht. Beide Seiten benutzen dieselbe `Ergebnisansicht`.
2. **Die Itemsatz-Regel steht in der Auswertung, nicht im Schema.** `ProfilstandSchema` nimmt jede positive ganze Zahl als `itemsatz` an; `werteAus` gibt bei einem fremden Satz `null` zurück („nicht erhoben"). So steht es im Nachweis des Specs, und es trennt zwei Fragen: Ist das ein Profilstand? Gehört er zu den heutigen Aussagen? Folgerichtig prüft das Schema die Schlüssel von `antworten` nicht gegen die heutigen Ids; die Auswertung liest nur, was sie kennt. Der **Entwurf** dagegen nagelt den Itemsatz fest — er ist Wegwerfware.
3. **Auch ein Muster braucht zwei Antworten.** Der Spec nennt die Mindestzahl bei den Skalen. Bei zwei Aussagen je Muster heißt das: beide. Ein Mittel aus einem Kreuz wäre genau die vorgetäuschte Genauigkeit, gegen die sich der Spec wendet. Nebenwirkung: Mittel aus zwei ganzen Zahlen liegen ein Vielfaches von 0,5 auseinander — „zwischen A und B" entsteht heute nur bei Gleichstand. Die Regel bleibt trotzdem allgemein (`< 0,5`), und die Tests prüfen sie an der Funktion über Mittelwerte, nicht nur über Antworten.
4. **Gleichstand bricht die feste Reihenfolge.** Bei gleichem Mittel entscheidet die Reihenfolge in `MUSTER` (bedeutungs-, reproduktions-, anwendungsorientiert, ungerichtet) und in `SKALEN` — sonst hieße dasselbe Profil einmal so und einmal anders.
5. **Die drei mittleren Stufen.** Der Spec nennt nur die Enden. Dazwischen: „trifft eher nicht zu", „teils, teils", „trifft eher zu".
6. **Keine Aussage ist Pflicht, alle drei Vorlieben sind es.** „Weiter" geht immer — sonst wäre die `null`-Regel der Auswertung totes Holz. Die Vorlieben haben im gespeicherten Typ kein „nicht angegeben", und eine Voreinstellung wäre eine Behauptung, die niemand aufgestellt hat. „Ergebnis ansehen" ist deshalb gesperrt, bis alle drei gewählt sind, und sagt, wie viele fehlen.
7. **„Später" heißt sieben Tage.** Die Einladung auf der Übersicht bleibt danach eine Woche weg und kommt dann wieder (Schlüssel `profil:spaeter`). Ohne Frist stünde sie bei jedem Besuch der Übersicht wieder da. Die Regel steht als reine Funktion in `vorschlag.ts`.
8. **Der feste Weg zum Profil ist ein Verweis am Fuß der Übersicht, kein Eintrag in der Kopfleiste.** Bei 375 px füllen Marke und Modusumschalter die Leiste schon fast aus (aus den Schriftgrößen gerechnet rund 324 von 335 px — gerechnet, nicht gemessen). Ein dritter Eintrag bräche sie auf jeder Seite in zwei Zeilen. `Seite.astro` bleibt unberührt.
9. **Verweise sind Slots.** Inseln kennen keine Adressen; `src/pages/profil/index.astro` reicht „Lernprofil anlegen" und „Neu erheben" als Slots `anlegen` und `erneut` herein. **Slotnamen ohne Bindestrich:** Astro macht aus `neu-erheben` beim Vorrendern die Eigenschaft `neuErheben`, reicht einen beim Vorrendern nicht gezeigten Slot im Browser aber unter dem rohen Namen herein (`@astrojs/react`: `server.js` wandelt um, `client.js` nicht). Die Insel fände ihn nach dem Hydrieren nicht mehr.
10. **Echte Radiofelder statt `role="group"` aus Knöpfen.** `Zuversicht.tsx` begründet ihre Knöpfe damit, dass jeder Druck sofort auslöst. Hier bleibt eine Wahl stehen und lässt sich ändern — das ist ein Radiofeld, und es bringt die Tastatur mit: ein Tabstopp je Frage, Pfeiltasten wechseln. Dreißig Knöpfe je Gruppe wären dreißig Tabstopps. `fieldset` und `legend` ergeben die Gruppe mit der Frage als Namen.
11. **Der Entwurf wird gelöscht, indem `null` darübergeschrieben wird.** Der Speicher kennt kein Entfernen, und er soll für das Profil nicht wachsen. Scheitert das Speichern des Profils, bleibt der Entwurf liegen — nach dem Neuladen lässt sich der letzte Schritt wiederholen.
12. **Eigene Wortlaute, wo der Spec keine gibt:** je Muster zwei Sätze (`MUSTER_ERKLAERUNG`), der Strukturhinweis, die Sätze für „zwischen A und B" und „nicht erhoben", der Hinweis „nicht gespeichert", der Text ohne Profil. Sie beschreiben Gewohnheiten, nie Typen, und versprechen nirgends, man lerne besser, wenn der Stoff zum Muster passt. Der Strukturhinweis verweist auf die Reihenfolge der Lektionen — die gibt es heute; der „feste Tagesplan" kommt erst mit 3b.
13. **`voreinstellungen()` ist bewusst dünn.** Der Spec führt „Profil → Voreinstellungen" unter `vorschlag.ts`; was eine Vorliebe verstellt, entscheidet aber erst 3b. Die Funktion gibt die Vorlieben zurück oder ohne Profil die neutralen (`egal`, 10 Minuten, `egal`) — eine Stelle, die sagt, was ohne Profil gilt. Was „egal" bedeutet, bleibt offen.
14. **Die Spalte „Gruppe" (kognitiv, metakognitiv, ressourcenbezogen) steht nur als Kommentar in `items.ts`.** Nichts in 3a liest sie. Die 26 Aussagen laufen in fünf Gruppen zu 6, 5, 5, 5, 5.
15. **Drei der sechs Vorschläge greifen 3b voraus** („Stell die Sitzung auf fünf Minuten", „Die App fragt dich am Ende danach", „Trag deine Lerntage ein"). Sie stehen wörtlich im Spec und werden wörtlich übernommen — das ist eine offene Stelle des Specs, keine des Plans.
16. **Neben „Neu erheben" steht das Datum der Erhebung** („Erhoben am 19.9.2026"). Der Hinweis nach acht Wochen hinge sonst in der Luft.

## Dateistruktur

```
src/profil/
  items.ts            ITEMSATZ, SKALEN, MUSTER, SKALA_TEXT, STUFEN, STUFEN_TEXT, ITEMS,
                      REIHENFOLGE, GRUPPENGROESSEN, GRUPPEN, VORLIEBEN          — reine Daten
  schema.ts           SCHLUESSEL_*, VorliebenSchema, HalbeVorliebenSchema,
                      ProfilstandSchema, EntwurfSchema, liesProfil, liesEntwurf  — Zod, laeuft im Browser
  auswertung.ts       mittelwert, lernmusterAus, strukturhinweisAus,
                      schwachstellenAus, werteAus, die fuenf Grenzwerte          — rein
  vorschlag.ts        VORSCHLAG, wiederholungLohnt, einladungZeigen,
                      NEUTRALE_VORLIEBEN, voreinstellungen                       — rein
  Ergebnis.tsx        Ergebnisansicht (Darstellung) und Ergebnis (Insel fuer /profil);
                      BEIPACKZETTEL, MOMENTAUFNAHME, MUSTER_ERKLAERUNG, STRUKTURHINWEIS
  Audit.tsx           Wahlfrage (Einfachwahl aus Radiofeldern) und Audit (die Insel)
src/pages/
  profil/index.astro  Ergebnisseite; reicht die Verweise als Slots herein
  profil/audit.astro  Fragebogen
  index.astro         + Einladungskarte, + Verweis „Dein Lernprofil", + Skript     (geaendert)
src/styles/global.css + Block „Lernprofil"                                        (nur angehaengt)
tests/
  profil-items.test.ts       11 Tests      profil-schema.test.ts      37 Tests
  profil-auswertung.test.ts  26 Tests      profil-vorschlag.test.ts   14 Tests
  profil-ergebnis.test.tsx   25 Tests      profil-audit.test.tsx      24 Tests
```

Zusammen 137 neue Tests. `src/tutor/speicher.ts`, `src/layouts/Seite.astro` und alles unter `src/aufgaben/` bleiben unberührt.

---

## Aufgabe 0: Voraussetzungen, Zweig, Ausgangslage

**Dateien:** keine.

- [ ] **Schritt 1: Prüfen, dass die Aufgabenfamilie abgeschlossen ist**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && git status --short && git branch --show-current && grep -c "^\.abgeben {" src/styles/global.css && ls src/aufgaben/Aufgabentyp.tsx src/components/Aufgabe.tsx tests/aufgabe.test.tsx && (grep -c "<script" src/pages/index.astro || true)
```
Erwartet, in dieser Reihenfolge: keine Zeile von `git status` (sauberer Baum) · der Name des Zweigs, auf dem die Aufgabenfamilie abgeschlossen liegt (`master`, wenn sie zusammengeführt ist, sonst `aufgabenfamilie`) · `1` · die drei Pfade · `0`.

**Anhalten und melden, nicht weitermachen,** wenn der Baum nicht sauber ist, wenn statt `1` eine `0` kommt (die Klasse `.abgeben` fehlt), wenn `ls` eine Datei nicht findet oder wenn die letzte Zahl nicht `0` ist (dann hat jemand `index.astro` schon umgebaut, und Aufgabe 8 Schritt 3 passt nicht mehr). Dieser Plan wird **nach** der Aufgabenfamilie ausgeführt, nicht neben ihr.

- [ ] **Schritt 2: Zweig anlegen**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && git switch -c onboarding-3a
```
Erwartet: `Switched to a new branch 'onboarding-3a'`.

- [ ] **Schritt 3: Ausgangslage festhalten**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && npm test 2>&1 | grep -E "Tests |Test Files |FAIL" && npm run check 2>&1 | grep -E "^- [0-9]+ error" && npm run build 2>&1 | grep -E "page\(s\)"
```
Erwartet: alle Tests bestanden, `- 0 errors`, `<n> page(s) built`. **Notiere** die Zahl der bestandenen Tests als **BASIS** und die Seitenzahl als **SEITEN** — beide stehen im Bericht dieser Aufgabe und werden in Aufgabe 7, 8 und 10 gebraucht. Ist ein Test rot oder gibt es Typfehler: anhalten und melden.

---
## Aufgabe 1: Die Aussagen und die Vorlieben — `items.ts`

**Dateien:**
- Neu: `src/profil/items.ts`
- Test: `tests/profil-items.test.ts`

Die Wortlaute unten sind aus dem Spec übernommen. **Nicht umformulieren, nicht „glätten"** — auch kein Komma. Ein Test hält eine Prüfsumme über alle Aussagen fest.

- [ ] **Schritt 1: Den fehlschlagenden Test schreiben**

`tests/profil-items.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  GRUPPEN,
  GRUPPENGROESSEN,
  ITEMS,
  ITEMSATZ,
  MUSTER,
  REIHENFOLGE,
  SKALEN,
  SKALA_TEXT,
  STUFEN,
  STUFEN_TEXT,
  VORLIEBEN,
} from '../src/profil/items';

/** Normalisiert verglichen, nicht exakt: sonst entkommt „Ich lerne ." gegen „ich lerne." */
function normal(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** djb2. Keine Kryptografie — nur ein Wachposten, der bei jedem geaenderten Zeichen anschlaegt. */
function pruefsumme(text: string): number {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = (Math.imul(h, 33) ^ text.charCodeAt(i)) >>> 0;
  return h;
}

describe('die Aussagen', () => {
  it('sind 26: jede Skala genau drei, jedes Muster genau zwei', () => {
    // 6 x 3 + 4 x 2 = 26. Stimmt die Summe, gehoert auch jede Aussage zu einer
    // bekannten Skala oder einem bekannten Muster — sonst bliebe eine uebrig.
    expect(ITEMS).toHaveLength(26);
    for (const skala of SKALEN) expect(ITEMS.filter((i) => i.dimension === skala)).toHaveLength(3);
    for (const muster of MUSTER) expect(ITEMS.filter((i) => i.dimension === muster)).toHaveLength(2);
  });

  it('tragen eindeutige Ids', () => {
    // An der Id haengt die gespeicherte Antwort. Zwei Aussagen mit derselben Id
    // teilten sich ein Kreuz.
    expect(new Set(ITEMS.map((i) => i.id)).size).toBe(ITEMS.length);
  });

  it('kommen nicht doppelt vor, auch nicht nur durch Schreibung getrennt', () => {
    expect(new Set(ITEMS.map((i) => normal(i.text))).size).toBe(ITEMS.length);
  });

  it('haben sich nicht geaendert, ohne dass ITEMSATZ gestiegen ist', () => {
    // Schlaegt dieser Test an, ist eine Aussage umformuliert, umgehaengt oder
    // umbenannt worden. Dann gehoeren gespeicherte Antworten nicht mehr zu
    // diesen Aussagen: ITEMSATZ in items.ts erhoehen UND die beiden Zahlen hier
    // nachziehen. Wer nur die Pruefsumme nachzieht, verrechnet alte Antworten
    // mit neuen Fragen.
    expect(ITEMSATZ).toBe(1);
    expect(pruefsumme(ITEMS.map((i) => `${i.id}|${i.dimension}|${i.text}`).join('\n'))).toBe(1787064221);
  });
});

describe('die Reihenfolge im Audit', () => {
  it('enthaelt jede Aussage genau einmal', () => {
    expect(REIHENFOLGE.map((i) => i.id).sort()).toEqual(ITEMS.map((i) => i.id).sort());
  });

  it('ist fest verankert — ein Zwischenstand findet nach dem Neuladen dieselben Gruppen', () => {
    // Der Entwurf merkt sich nur die Nummer des Schritts. Mischte ein neuer Bau
    // anders, laegen hinter derselben Nummer andere Aussagen, und wer bei
    // Schritt 3 weitermacht, bekaeme manche nie zu sehen.
    expect(GRUPPEN[0]?.map((i) => i.id)).toEqual(['bed-1', 'dra-3', 'ste-1', 'bed-2', 'zei-1', 'ste-2']);
  });

  it('stellt nie zwei Aussagen derselben Skala oder desselben Musters nebeneinander', () => {
    // Das ist der Zweck des Mischens: Wer drei Aussagen zum Zeiteinteilen
    // hintereinander liest, beantwortet ab der zweiten die Skala.
    for (let i = 1; i < REIHENFOLGE.length; i++) {
      expect(REIHENFOLGE[i]?.dimension).not.toBe(REIHENFOLGE[i - 1]?.dimension);
    }
  });

  it('schneidet in Gruppen zu fuenf bis sechs, ohne eine Aussage zu verlieren', () => {
    expect(GRUPPEN.map((g) => g.length)).toEqual([...GRUPPENGROESSEN]);
    for (const groesse of GRUPPENGROESSEN) {
      expect(groesse).toBeGreaterThanOrEqual(5);
      expect(groesse).toBeLessThanOrEqual(6);
    }
    expect(GRUPPEN.flat().map((i) => i.id)).toEqual(REIHENFOLGE.map((i) => i.id));
  });
});

describe('Stufen, Skalennamen und Vorlieben', () => {
  it('kennt fuenf Stufen von „trifft gar nicht zu" bis „trifft völlig zu"', () => {
    expect([...STUFEN]).toEqual([1, 2, 3, 4, 5]);
    expect(STUFEN_TEXT[1]).toBe('trifft gar nicht zu');
    expect(STUFEN_TEXT[5]).toBe('trifft völlig zu');
    expect(new Set(STUFEN.map((s) => STUFEN_TEXT[s])).size).toBe(5);
  });

  it('nennt die sechs Skalen beim Namen', () => {
    expect(SKALEN.map((s) => SKALA_TEXT[s])).toEqual([
      'Ordnen',
      'Verknüpfen',
      'Abrufen',
      'Steuern',
      'Dranbleiben',
      'Zeit einteilen',
    ]);
  });

  it('stellt die drei Vorlieben im Wortlaut des Specs', () => {
    expect(VORLIEBEN.map((v) => [v.id, v.frage, v.optionen.map((o) => o.text)])).toEqual([
      ['einstieg', 'Womit steigst du lieber ein?', ['Überblick zuerst', 'Beispiel zuerst', 'egal']],
      ['minuten', 'Wie lang darf eine Sitzung sein?', ['5 Minuten', '10 Minuten', '20 Minuten']],
      ['text', 'Was liest du lieber?', ['knappe Stichpunkte', 'ausformulierte Absätze', 'egal']],
    ]);
  });
});
```

- [ ] **Schritt 2: Test laufen lassen, Fehlschlag ansehen**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && npx vitest run tests/profil-items.test.ts 2>&1 | tail -8
```
Erwartet: FAIL mit `Failed to resolve import "../src/profil/items"`.

- [ ] **Schritt 3: Die Datei anlegen**

`src/profil/items.ts`:

```ts
import { mischen } from '../lib/mischen';

/**
 * Die Aussagen des Audits und die drei Vorlieben.
 *
 * Eigene Formulierungen, abgeleitet aus veroeffentlichten Modellen der
 * Lernstrategien (LIST, MSLQ) und den Lernmustern nach Vermunt. Konstrukte
 * sind frei, Wortlaute nicht: Kein Satz hier lehnt sich an den Wortlaut eines
 * bestehenden Fragebogens an. Die Messguete ist damit UNGEPRUEFT, und das
 * steht auf der Ergebnisseite (siehe `BEIPACKZETTEL` in `Ergebnis.tsx`).
 *
 * Diese Datei ist reine Daten plus eine deterministische Reihenfolge. Sie
 * kennt weder Zod noch React noch den Speicher.
 */

/**
 * Steigt, wenn sich eine Aussage aendert — auch nur im Wortlaut.
 *
 * Antworten gehoeren zu genau dem Satz, auf den sie gegeben wurden. Wer eine
 * Aussage umformuliert und die Zahl stehen laesst, verrechnet alte Antworten
 * mit neuen Fragen. `tests/profil-items.test.ts` haelt dafuer eine Pruefsumme
 * ueber alle Wortlaute fest.
 */
export const ITEMSATZ = 1;

/** Die sechs Strategie-Skalen, in der Reihenfolge der Ergebnisseite. */
export const SKALEN = [
  'ordnen',
  'verknuepfen',
  'abrufen',
  'steuern',
  'dranbleiben',
  'zeiteinteilen',
] as const;
export type Skala = (typeof SKALEN)[number];

/**
 * Die vier Lernmuster nach Vermunt.
 *
 * Der Bezeichner IST das Wort, das auf der Ergebnisseite steht — alle vier
 * kommen ohne Umlaut aus. Die Reihenfolge entscheidet bei gleichem Mittel,
 * welches Muster zuerst genannt wird (siehe `lernmusterAus`).
 */
export const MUSTER = [
  'bedeutungsorientiert',
  'reproduktionsorientiert',
  'anwendungsorientiert',
  'ungerichtet',
] as const;
export type Muster = (typeof MUSTER)[number];

export type Dimension = Skala | Muster;

export const SKALA_TEXT: Readonly<Record<Skala, string>> = {
  ordnen: 'Ordnen',
  verknuepfen: 'Verknüpfen',
  abrufen: 'Abrufen',
  steuern: 'Steuern',
  dranbleiben: 'Dranbleiben',
  zeiteinteilen: 'Zeit einteilen',
};

/** Fuenf Stufen. Die Enden stehen im Spec, die drei mittleren sind die uebliche Reihe. */
export const STUFEN = [1, 2, 3, 4, 5] as const;
export type Wert = (typeof STUFEN)[number];

export const STUFEN_TEXT: Readonly<Record<Wert, string>> = {
  1: 'trifft gar nicht zu',
  2: 'trifft eher nicht zu',
  3: 'teils, teils',
  4: 'trifft eher zu',
  5: 'trifft völlig zu',
};

export type Item = {
  readonly id: string;
  /** Die Skala oder das Muster, zu dem die Aussage zaehlt. */
  readonly dimension: Dimension;
  readonly text: string;
};

/**
 * Die 26 Aussagen: sechs Skalen zu je drei, vier Muster zu je zwei.
 *
 * „Abrufen" steht, wo LIST „Wiederholen" fuehrt — mit Absicht: Wiederlesen ist
 * die schwaechere Technik, sich abzufragen und zu verteilen die staerkere.
 */
export const ITEMS: readonly Item[] = [
  // Ordnen (kognitiv)
  { id: 'ord-1', dimension: 'ordnen', text: 'Ich mache mir eine eigene Gliederung oder Skizze, bevor ich Einzelheiten lerne.' },
  { id: 'ord-2', dimension: 'ordnen', text: 'Ich fasse einen Abschnitt in wenigen eigenen Sätzen zusammen.' },
  { id: 'ord-3', dimension: 'ordnen', text: 'Ich unterscheide beim Lesen, was Kernaussage ist und was Beispiel.' },
  // Verknuepfen (kognitiv)
  { id: 'ver-1', dimension: 'verknuepfen', text: 'Ich überlege, wo mir das Gelernte im Beruf schon begegnet ist.' },
  { id: 'ver-2', dimension: 'verknuepfen', text: 'Ich suche nach eigenen Beispielen für eine Regel.' },
  { id: 'ver-3', dimension: 'verknuepfen', text: 'Ich frage mich, wie ein neuer Begriff mit dem zusammenhängt, was ich schon weiß.' },
  // Abrufen (kognitiv)
  { id: 'abr-1', dimension: 'abrufen', text: 'Ich prüfe mich selbst, ohne in die Unterlagen zu sehen.' },
  { id: 'abr-2', dimension: 'abrufen', text: 'Ich wiederhole Stoff über mehrere Tage verteilt statt am Stück.' },
  { id: 'abr-3', dimension: 'abrufen', text: 'Wenn ich etwas nicht abrufen kann, schlage ich nach und versuche es später noch einmal.' },
  // Steuern (metakognitiv)
  { id: 'ste-1', dimension: 'steuern', text: 'Bevor ich anfange, lege ich fest, was ich in dieser Sitzung schaffen will.' },
  { id: 'ste-2', dimension: 'steuern', text: 'Ich merke beim Lernen, wenn ich etwas nur überflogen und nicht verstanden habe.' },
  { id: 'ste-3', dimension: 'steuern', text: 'Wenn eine Lernweise nicht trägt, ändere ich sie.' },
  // Dranbleiben (ressourcenbezogen)
  { id: 'dra-1', dimension: 'dranbleiben', text: 'Ich lerne auch dann weiter, wenn der Stoff zäh wird.' },
  { id: 'dra-2', dimension: 'dranbleiben', text: 'Beim Lernen schalte ich Ablenkungen bewusst ab.' },
  { id: 'dra-3', dimension: 'dranbleiben', text: 'Ich halte mich an Lernzeiten, die ich mir vorgenommen habe.' },
  // Zeit einteilen (ressourcenbezogen)
  { id: 'zei-1', dimension: 'zeiteinteilen', text: 'Ich weiß zu Wochenbeginn, wann ich lernen werde.' },
  { id: 'zei-2', dimension: 'zeiteinteilen', text: 'Vor einer Prüfung fange ich so früh an, dass am letzten Abend nichts Neues mehr ansteht.' },
  { id: 'zei-3', dimension: 'zeiteinteilen', text: 'Ich teile großen Stoff in Portionen, die in eine Sitzung passen.' },
  // bedeutungsorientiert
  { id: 'bed-1', dimension: 'bedeutungsorientiert', text: 'Ich will verstehen, warum etwas gilt, nicht nur, dass es gilt.' },
  { id: 'bed-2', dimension: 'bedeutungsorientiert', text: 'Ich bilde mir zu dem, was ich lese, ein eigenes Urteil.' },
  // reproduktionsorientiert
  { id: 'rep-1', dimension: 'reproduktionsorientiert', text: 'Ich lerne vor allem das, was voraussichtlich abgefragt wird.' },
  { id: 'rep-2', dimension: 'reproduktionsorientiert', text: 'Ich präge mir Definitionen und Aufzählungen möglichst wortgetreu ein.' },
  // anwendungsorientiert
  { id: 'anw-1', dimension: 'anwendungsorientiert', text: 'Mich interessiert an neuem Stoff zuerst, was ich damit praktisch anfangen kann.' },
  { id: 'anw-2', dimension: 'anwendungsorientiert', text: 'Ich merke mir Dinge am besten, wenn ich sie an einem echten Fall durchspiele.' },
  // ungerichtet
  { id: 'ung-1', dimension: 'ungerichtet', text: 'Ich weiß oft nicht, womit ich beim Lernen anfangen soll.' },
  { id: 'ung-2', dimension: 'ungerichtet', text: 'Ich bin unsicher, ob meine Art zu lernen die richtige ist.' },
];

/**
 * Die Reihenfolge, in der das Audit fragt: gemischt, aber bei jedem Aufruf und
 * in jedem Bau dieselbe.
 *
 * Gemischt, damit die Skalen nicht erkennbar blockweise kommen — wer drei
 * Aussagen zum Zeiteinteilen hintereinander liest, beantwortet ab der zweiten
 * die Skala und nicht mehr die Aussage. Deterministisch, damit ein
 * Zwischenstand nach dem Neuladen dieselben Gruppen wiederfindet.
 *
 * Die Saat haengt am Itemsatz: Ein neuer Satz mischt neu. Fuer Satz 1 ist
 * nachgerechnet, dass keine zwei Nachbarn zur selben Skala oder zum selben
 * Muster gehoeren; der Test haelt das fest.
 */
export const REIHENFOLGE: readonly Item[] = mischen(ITEMS, `profil-itemsatz-${ITEMSATZ}`);

/** „Gruppen zu je fuenf bis sechs": 6 + 5 + 5 + 5 + 5 = 26. */
export const GRUPPENGROESSEN = [6, 5, 5, 5, 5] as const;

/** Die gemischten Aussagen, in Gruppen geschnitten — eine Gruppe je Schritt des Audits. */
export const GRUPPEN: readonly (readonly Item[])[] = GRUPPENGROESSEN.map((groesse, i) => {
  const anfang = GRUPPENGROESSEN.slice(0, i).reduce((summe, g) => summe + g, 0);
  return REIHENFOLGE.slice(anfang, anfang + groesse);
});

export type Vorliebe = {
  readonly id: 'einstieg' | 'minuten' | 'text';
  readonly frage: string;
  readonly optionen: readonly { readonly wert: string | number; readonly text: string }[];
};

/**
 * Die drei Vorlieben. Sie heissen in der App „Vorliebe", nie „Lerntyp", und
 * steuern spaeter (Teil 3b) Voreinstellungen — kein Inhalt wird ihretwegen
 * vorenthalten. Welche Werte gespeichert werden duerfen, sagt `VorliebenSchema`
 * in `schema.ts`; ein Test haelt beide Listen deckungsgleich.
 */
export const VORLIEBEN: readonly Vorliebe[] = [
  {
    id: 'einstieg',
    frage: 'Womit steigst du lieber ein?',
    optionen: [
      { wert: 'ueberblick', text: 'Überblick zuerst' },
      { wert: 'beispiel', text: 'Beispiel zuerst' },
      { wert: 'egal', text: 'egal' },
    ],
  },
  {
    id: 'minuten',
    frage: 'Wie lang darf eine Sitzung sein?',
    optionen: [
      { wert: 5, text: '5 Minuten' },
      { wert: 10, text: '10 Minuten' },
      { wert: 20, text: '20 Minuten' },
    ],
  },
  {
    id: 'text',
    frage: 'Was liest du lieber?',
    optionen: [
      { wert: 'stichpunkte', text: 'knappe Stichpunkte' },
      { wert: 'absaetze', text: 'ausformulierte Absätze' },
      { wert: 'egal', text: 'egal' },
    ],
  },
];
```

- [ ] **Schritt 4: Test laufen lassen**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && npx vitest run tests/profil-items.test.ts 2>&1 | grep -E "Tests |×"
```
Erwartet: `Tests  11 passed (11)`.

Schlägt **nur** die Prüfsumme fehl, ist beim Übertragen ein Zeichen verrutscht — meist ein Umlaut, ein „ß" oder ein Leerzeichen am Zeilenende. Dann die 26 Texte Zeichen für Zeichen gegen den Spec halten und **den Text** berichtigen, nicht die Zahl im Test. Schlägt der Anker der ersten Gruppe fehl, stehen die Aussagen in `ITEMS` in anderer Reihenfolge als oben: Die Mischung hängt an ihr.

- [ ] **Schritt 5: Mutationsprobe — der Wortlaut ist bewacht**

Ändere in `src/profil/items.ts` vorübergehend `Ich suche nach eigenen Beispielen für eine Regel.` zu `Ich suche nach eigenen Beispielen für jede Regel.` und lass den Test laufen (Befehl aus Schritt 4).

Erwartet: **genau ein** Test schlägt fehl — „haben sich nicht geaendert, ohne dass ITEMSATZ gestiegen ist". Die übrigen zehn bleiben grün: Die Aussage ist weiterhin eindeutig, gehört weiterhin zu ihrer Skala. Genau deshalb braucht es die Prüfsumme — ohne sie bliebe eine Umformulierung unbemerkt, und alte Antworten würden mit einer neuen Frage verrechnet.

Änderung zurücknehmen, dann:

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && (grep -c "für jede Regel" src/profil/items.ts || true) && npx vitest run tests/profil-items.test.ts 2>&1 | grep -E "Tests |×"
```
Erwartet: `0`, dann `Tests  11 passed (11)`.

- [ ] **Schritt 6: Typen prüfen und committen**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && python -c "import sys; print(sum(open(f,'rb').read().count(b'\x00') for f in sys.argv[1:]))" src/profil/items.ts tests/profil-items.test.ts && npm run check 2>&1 | grep -E "^- [0-9]+ error" && git add src/profil/items.ts tests/profil-items.test.ts && git commit -q -F - <<'MSG'
feat: Aussagen und Vorlieben des Lernprofil-Audits

26 eigene Aussagen - sechs Strategie-Skalen zu je drei, vier Lernmuster
nach Vermunt zu je zwei - und drei Vorlieben, im Wortlaut des Specs.
Konstrukte sind frei, Wortlaute nicht: Kein Satz lehnt sich an einen
bestehenden Fragebogen an.

Die Reihenfolge im Audit ist gemischt und fest: Die Saat haengt am
Itemsatz, keine zwei Nachbarn gehoeren zur selben Skala, und ein Test
verankert die erste Gruppe - der Zwischenstand merkt sich nur die
Nummer des Schritts.

Eine Pruefsumme ueber alle Wortlaute bewacht ITEMSATZ: Wer eine Aussage
umformuliert, ohne die Zahl zu erhoehen, verrechnet alte Antworten mit
neuen Fragen. Mutationsprobe: ein geaendertes Wort wird gefangen, und
zwar nur von diesem Test.

<CO-AUTHORED-BY>
MSG
```
Erwartet: `0`, `- 0 errors`, danach ein Commit.

---

## Aufgabe 2: Was im Speicher liegt — `schema.ts`

**Dateien:**
- Neu: `src/profil/schema.ts`
- Test: `tests/profil-schema.test.ts`

Jede Regel des Schemas hat unten einen Test, der ohne sie rot würde. Die Testhilfen `stand()` und `entwurf()` legen eine Änderung stumpf über einen gültigen Stand und **ergänzen nichts**: Wer ein verschachteltes Feld kaputt machen will, reicht das ganze verschachtelte Objekt herein. Im Umbau der Aufgabenfamilie blieben zweimal Schemaregeln ohne Test, weil die Hilfe die Eingaben von selbst gültig machte.

- [ ] **Schritt 1: Den fehlschlagenden Test schreiben**

`tests/profil-schema.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { VORLIEBEN } from '../src/profil/items';
import {
  EntwurfSchema,
  ProfilstandSchema,
  VorliebenSchema,
  liesEntwurf,
  liesProfil,
} from '../src/profil/schema';

/**
 * Die Hilfen hier machen NICHTS von selbst gueltig: Sie legen die Aenderung
 * stumpf ueber einen gueltigen Stand. Wer ein verschachteltes Feld kaputt
 * machen will, reicht das ganze verschachtelte Objekt herein. Eine Hilfe, die
 * fehlende Felder ergaenzt, haette genau die Tests entwertet, die pruefen, ob
 * ein Feld fehlen darf.
 */
const vorlieben = { einstieg: 'beispiel', minuten: 10, text: 'egal' };

const basis = {
  itemsatz: 1,
  erhoben: '2026-09-19T10:00:00.000Z',
  antworten: { 'ord-1': 4, 'ord-2': 2, 'ung-1': 5 },
  vorlieben,
};

function stand(aenderung: Record<string, unknown> = {}): Record<string, unknown> {
  return { ...basis, ...aenderung };
}

const entwurfBasis = {
  itemsatz: 1,
  antworten: { 'ord-1': 4 },
  vorlieben: {},
  schritt: 2,
};

function entwurf(aenderung: Record<string, unknown> = {}): Record<string, unknown> {
  return { ...entwurfBasis, ...aenderung };
}

function gilt(wert: unknown): boolean {
  return ProfilstandSchema.safeParse(wert).success;
}

describe('ProfilstandSchema', () => {
  it('nimmt einen gueltigen Stand an', () => {
    expect(gilt(stand())).toBe(true);
  });

  it('nimmt einen Stand ganz ohne Antworten an', () => {
    // Wer jede Aussage ueberspringt, hat trotzdem drei Vorlieben angegeben. Das
    // ist ein duennes Profil, aber kein kaputtes.
    expect(gilt(stand({ antworten: {} }))).toBe(true);
  });

  it.each([0, 6, 3.5, '3', null])('weist den Wert %s in den Antworten zurueck', (wert) => {
    expect(gilt(stand({ antworten: { 'ord-1': wert } }))).toBe(false);
  });

  it.each([
    ['einstieg', 'video'],
    ['minuten', 15],
    ['text', 'bilder'],
  ])('weist bei der Vorliebe %s den unbekannten Wert %s zurueck', (feld, wert) => {
    expect(gilt(stand({ vorlieben: { ...vorlieben, [feld]: wert } }))).toBe(false);
  });

  it('verlangt alle drei Vorlieben', () => {
    const { minuten: _minuten, ...ohne } = vorlieben;
    expect(gilt(stand({ vorlieben: ohne }))).toBe(false);
  });

  it('weist ein fremdes Feld zurueck — auch und gerade das Ergebnis', () => {
    // Gespeichert werden die Antworten, nie das Ergebnis. Ein Stand, der sein
    // Lernmuster mitbringt, stammt nicht von dieser App — oder von einer
    // Fassung, die diese Regel gebrochen hat.
    expect(gilt(stand({ lernmuster: 'anwendungsorientiert' }))).toBe(false);
  });

  it('weist ein fremdes Feld in den Vorlieben zurueck', () => {
    expect(gilt(stand({ vorlieben: { ...vorlieben, lerntyp: 'visuell' } }))).toBe(false);
  });

  it('weist einen Zeitpunkt zurueck, der keiner ist', () => {
    // An `erhoben` haengt der Hinweis nach acht Wochen. Mit „gestern" laesst
    // sich nicht rechnen.
    expect(gilt(stand({ erhoben: 'gestern' }))).toBe(false);
    expect(gilt(stand({ erhoben: '2026-09-19' }))).toBe(false);
  });

  it.each([0, -1, 1.5, '1'])('weist den itemsatz %s zurueck', (itemsatz) => {
    expect(gilt(stand({ itemsatz }))).toBe(false);
  });

  it('nimmt einen fremden itemsatz an — ob er zaehlt, entscheidet die Auswertung', () => {
    // Lesbar ist nicht auswertbar. Die Trennung ist Absicht: Das Schema sagt,
    // ob das ein Profilstand IST; `werteAus` sagt, ob er zu den heutigen
    // Aussagen gehoert.
    expect(gilt(stand({ itemsatz: 2 }))).toBe(true);
  });
});

describe('liesProfil', () => {
  it('gibt den Stand zurueck, wenn er lesbar ist', () => {
    expect(liesProfil(stand())).toEqual(basis);
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
  ])('macht aus %s „kein Profil", ohne zu werfen', (_name, roh) => {
    expect(liesProfil(roh)).toBeNull();
  });

  it('macht aus einem halb richtigen Stand „kein Profil", nicht ein halbes', () => {
    expect(liesProfil(stand({ antworten: { 'ord-1': 4, 'ord-2': 9 } }))).toBeNull();
  });
});

describe('EntwurfSchema', () => {
  it('nimmt einen Entwurf mit halben Vorlieben an', () => {
    expect(EntwurfSchema.safeParse(entwurf()).success).toBe(true);
    expect(EntwurfSchema.safeParse(entwurf({ vorlieben: { minuten: 5 } })).success).toBe(true);
  });

  it('weist einen Entwurf zu einem anderen Itemsatz zurueck', () => {
    // Anders als das Profil ist ein Entwurf Wegwerfware: Zu anderen Aussagen
    // gibt es nichts fortzusetzen.
    expect(EntwurfSchema.safeParse(entwurf({ itemsatz: 2 })).success).toBe(false);
  });

  it.each([-1, 6, 1.5])('weist den Schritt %s zurueck', (schritt) => {
    expect(EntwurfSchema.safeParse(entwurf({ schritt })).success).toBe(false);
  });

  it('nimmt den ersten Schritt und den Schritt mit den Vorlieben an', () => {
    expect(EntwurfSchema.safeParse(entwurf({ schritt: 0 })).success).toBe(true);
    expect(EntwurfSchema.safeParse(entwurf({ schritt: 5 })).success).toBe(true);
  });

  it('ist bei Werten, Vorlieben und fremden Feldern so streng wie das Profil', () => {
    expect(EntwurfSchema.safeParse(entwurf({ antworten: { 'ord-1': 6 } })).success).toBe(false);
    expect(EntwurfSchema.safeParse(entwurf({ vorlieben: { einstieg: 'video' } })).success).toBe(false);
    expect(EntwurfSchema.safeParse(entwurf({ vorlieben: { lerntyp: 'visuell' } })).success).toBe(false);
    expect(EntwurfSchema.safeParse(entwurf({ erhoben: '2026-09-19T10:00:00.000Z' })).success).toBe(false);
  });
});

describe('liesEntwurf', () => {
  it('gibt den Entwurf zurueck, wenn er lesbar ist', () => {
    expect(liesEntwurf(entwurf())).toEqual(entwurfBasis);
  });

  it('macht aus einem geloeschten Entwurf keinen', () => {
    // Das Audit loescht seinen Entwurf, indem es `null` darueberschreibt — der
    // Speicher kennt kein Entfernen.
    expect(liesEntwurf(null)).toBeNull();
    expect(liesEntwurf(undefined)).toBeNull();
    expect(liesEntwurf('irgendwas')).toBeNull();
  });
});

describe('Schema und Audit sprechen dieselbe Sprache', () => {
  it('nimmt jede Vorliebe an, die das Audit anbietet', () => {
    // Die Optionen stehen in items.ts, die erlaubten Werte hier. Laufen beide
    // auseinander, bietet das Audit etwas an, das sich nicht speichern laesst.
    for (const vorliebe of VORLIEBEN) {
      for (const option of vorliebe.optionen) {
        const befund = VorliebenSchema.safeParse({ ...vorlieben, [vorliebe.id]: option.wert });
        expect(befund.success).toBe(true);
      }
    }
  });
});
```

- [ ] **Schritt 2: Test laufen lassen, Fehlschlag ansehen**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && npx vitest run tests/profil-schema.test.ts 2>&1 | tail -8
```
Erwartet: FAIL mit `Failed to resolve import "../src/profil/schema"`.

- [ ] **Schritt 3: Das Schema anlegen**

`src/profil/schema.ts`:

```ts
import { z } from 'astro/zod';
import { GRUPPENGROESSEN, ITEMSATZ, STUFEN } from './items';

/**
 * Was vom Lernprofil im Speicher liegt — und die Pruefung beim Lesen.
 *
 * `einstellung()` gibt `unknown` zurueck: Der Wert kommt von einer fremden
 * Festplatte, geschrieben womoeglich von einer aelteren oder neueren Fassung
 * dieser App oder von Hand veraendert. Deshalb wird hier geprueft und nicht
 * behauptet.
 *
 * Diese Datei ist die EINE Stelle im Profil, die Zod zur Laufzeit braucht, und
 * sie laeuft im Browser — dort wird gelesen. Alle anderen Dateien in
 * `src/profil/` holen sich von hier nur Typen (`import type`); die beiden
 * Inseln und das Skript der Uebersicht rufen `liesProfil` und `liesEntwurf`.
 *
 * Gespeichert werden die ANTWORTEN, nie das Ergebnis. `strictObject` haelt das
 * fest: Ein Stand, der ein Feld wie `lernmuster` mitbringt, ist kein Profil.
 */

export const SCHLUESSEL_PROFIL = 'profil';
export const SCHLUESSEL_ENTWURF = 'profil:entwurf';
export const SCHLUESSEL_SPAETER = 'profil:spaeter';

/** Eine Antwort: 1 bis 5, nichts dazwischen, nichts daneben. */
const WertSchema = z.literal([...STUFEN]);

export const VorliebenSchema = z.strictObject({
  einstieg: z.enum(['ueberblick', 'beispiel', 'egal']),
  minuten: z.literal([5, 10, 20]),
  text: z.enum(['stichpunkte', 'absaetze', 'egal']),
});

/**
 * Die Vorlieben, solange das Audit laeuft: jede darf noch fehlen. `partial()`
 * behaelt die Strenge — ein fremdes Feld faellt auch hier durch.
 */
export const HalbeVorliebenSchema = VorliebenSchema.partial();

/**
 * Der gespeicherte Stand unter `SCHLUESSEL_PROFIL`.
 *
 * `itemsatz` ist hier eine beliebige positive ganze Zahl und NICHT auf den
 * heutigen Satz festgelegt: Ein Stand aus einem anderen Satz ist lesbar, nur
 * nicht auswertbar. Ob er zaehlt, entscheidet `werteAus` in `auswertung.ts`.
 *
 * Die Schluessel von `antworten` sind Item-Ids, werden aber nicht gegen die
 * heutige Liste geprueft — aus demselben Grund. Die Auswertung liest nur die
 * Ids, die sie kennt; der Rest bleibt liegen und stoert nicht.
 */
export const ProfilstandSchema = z.strictObject({
  itemsatz: z.number().int().min(1),
  erhoben: z.iso.datetime(),
  antworten: z.record(z.string(), WertSchema),
  vorlieben: VorliebenSchema,
});

/**
 * Der Zwischenstand eines laufenden Audits unter `SCHLUESSEL_ENTWURF`.
 *
 * Anders als beim Profil ist der Itemsatz hier festgenagelt: Ein Entwurf ist
 * Wegwerfware, und ein Entwurf zu anderen Aussagen ist keiner. `schritt` zaehlt
 * die Aussagengruppen ab 0; der Wert `GRUPPENGROESSEN.length` ist der Schritt
 * mit den Vorlieben.
 */
export const EntwurfSchema = z.strictObject({
  itemsatz: z.literal(ITEMSATZ),
  antworten: z.record(z.string(), WertSchema),
  vorlieben: HalbeVorliebenSchema,
  schritt: z.number().int().min(0).max(GRUPPENGROESSEN.length),
});

export type Vorlieben = z.infer<typeof VorliebenSchema>;
export type Profilstand = z.infer<typeof ProfilstandSchema>;
export type Entwurf = z.infer<typeof EntwurfSchema>;

/** Der gespeicherte Stand — oder `null`. Wirft nie: Unlesbar heisst „kein Profil". */
export function liesProfil(roh: unknown): Profilstand | null {
  const befund = ProfilstandSchema.safeParse(roh);
  return befund.success ? befund.data : null;
}

/** Der Zwischenstand — oder `null`. Auch ein geloeschter Entwurf (`null`) ist keiner. */
export function liesEntwurf(roh: unknown): Entwurf | null {
  const befund = EntwurfSchema.safeParse(roh);
  return befund.success ? befund.data : null;
}
```

- [ ] **Schritt 4: Test laufen lassen**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && npx vitest run tests/profil-schema.test.ts 2>&1 | grep -E "Tests |×"
```
Erwartet: `Tests  37 passed (37)`.

- [ ] **Schritt 5: Mutationsprobe — das Ergebnis darf nicht mit in den Speicher**

Ändere in `src/profil/schema.ts` vorübergehend `export const ProfilstandSchema = z.strictObject({` zu `export const ProfilstandSchema = z.object({` und lass den Test laufen.

Erwartet: **genau ein** Test schlägt fehl — „weist ein fremdes Feld zurueck — auch und gerade das Ergebnis". Mit `z.object` würde ein Stand, der sein `lernmuster` mitbringt, stillschweigend angenommen und das Feld verworfen. Der Nachbartest „weist ein fremdes Feld in den Vorlieben zurueck" bleibt grün: `VorliebenSchema` ist ein eigenes `strictObject` und von dieser Änderung nicht betroffen.

Änderung zurücknehmen, dann:

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && grep -c "z.strictObject" src/profil/schema.ts && npx vitest run tests/profil-schema.test.ts 2>&1 | grep -E "Tests |×"
```
Erwartet: `3`, dann `Tests  37 passed (37)`.

- [ ] **Schritt 6: Typen prüfen und committen**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && python -c "import sys; print(sum(open(f,'rb').read().count(b'\x00') for f in sys.argv[1:]))" src/profil/schema.ts tests/profil-schema.test.ts && npm run check 2>&1 | grep -E "^- [0-9]+ error" && git add src/profil/schema.ts tests/profil-schema.test.ts && git commit -q -F - <<'MSG'
feat: Schema fuer Profilstand und Zwischenstand

einstellung() gibt unknown zurueck - der Wert kommt von einer fremden
Festplatte. liesProfil und liesEntwurf pruefen ihn und werfen nie: Ein
unlesbarer Stand heisst kein Profil, nicht Absturz.

Gespeichert werden die Antworten, nie das Ergebnis. strictObject haelt
das fest: Ein Stand, der sein Lernmuster mitbringt, ist kein Profil.
Mutationsprobe: z.object statt z.strictObject wird gefangen.

Der itemsatz des Profils ist bewusst nicht festgenagelt - lesbar ist
nicht auswertbar, und ob ein Stand zu den heutigen Aussagen gehoert,
entscheidet die Auswertung. Der Entwurf dagegen ist Wegwerfware und
gilt nur fuer den heutigen Satz.

Diese Datei ist die eine Stelle im Profil, die Zod zur Laufzeit
braucht, und sie laeuft im Browser: Dort wird gelesen.

<CO-AUTHORED-BY>
MSG
```
Erwartet: `0`, `- 0 errors`, danach ein Commit.

---

## Aufgabe 3: Die Regeln — `auswertung.ts`

**Dateien:**
- Neu: `src/profil/auswertung.ts`
- Test: `tests/profil-auswertung.test.ts`

Vier Regeln, jede mit ihrer Grenze. Die Tests stehen **an** den Grenzen: genau zwei Antworten, genau 0,5 Abstand, genau 3,5, genau 3,0. Damit sich die Grenzen unabhängig von der Zahl der Aussagen prüfen lassen, nehmen `lernmusterAus`, `strukturhinweisAus` und `schwachstellenAus` fertige Mittelwerte entgegen — 3,49 lässt sich mit zwei ganzzahligen Antworten nicht erzeugen, als Mittelwert aber hinschreiben.

- [ ] **Schritt 1: Den fehlschlagenden Test schreiben**

`tests/profil-auswertung.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { ITEMS, type Dimension, type Muster, type Skala, type Wert } from '../src/profil/items';
import {
  lernmusterAus,
  mittelwert,
  schwachstellenAus,
  strukturhinweisAus,
  werteAus,
} from '../src/profil/auswertung';

/**
 * Antworten fuer eine Skala oder ein Muster, in der Reihenfolge ihrer Aussagen.
 * `null` heisst: diese Aussage bleibt unbeantwortet. Die Hilfe ergaenzt nichts —
 * was nicht dasteht, ist nicht beantwortet.
 */
function fuer(dimension: Dimension, ...werte: (Wert | null)[]): Record<string, Wert> {
  const aus: Record<string, Wert> = {};
  ITEMS.filter((item) => item.dimension === dimension).forEach((item, i) => {
    const wert = werte[i];
    if (wert !== undefined && wert !== null) aus[item.id] = wert;
  });
  return aus;
}

function muster(teil: Partial<Record<Muster, number | null>>): Record<Muster, number | null> {
  return {
    bedeutungsorientiert: null,
    reproduktionsorientiert: null,
    anwendungsorientiert: null,
    ungerichtet: null,
    ...teil,
  };
}

function skalen(teil: Partial<Record<Skala, number | null>>): Record<Skala, number | null> {
  return {
    ordnen: null,
    verknuepfen: null,
    abrufen: null,
    steuern: null,
    dranbleiben: null,
    zeiteinteilen: null,
    ...teil,
  };
}

describe('mittelwert', () => {
  it('mittelt die beantworteten Aussagen einer Skala', () => {
    expect(mittelwert(fuer('ordnen', 2, 3, 4), 'ordnen')).toBe(3);
    expect(mittelwert(fuer('ordnen', 1, 2, 2), 'ordnen')).toBeCloseTo(5 / 3, 10);
  });

  it('rechnet mit genau zwei Antworten — der Mindestzahl', () => {
    expect(mittelwert(fuer('ordnen', 2, null, 5), 'ordnen')).toBe(3.5);
  });

  it('gibt bei nur einer Antwort null — nicht 0 und nicht den Einzelwert', () => {
    // Eine 0 waere eine Aussage, und zwar die schlechteste. Eine 4 waere ein
    // Mittel aus einem Kreuz.
    expect(mittelwert(fuer('ordnen', 4), 'ordnen')).toBeNull();
  });

  it('gibt ganz ohne Antwort null', () => {
    expect(mittelwert({}, 'ordnen')).toBeNull();
  });

  it('verlangt bei einem Muster beide Aussagen', () => {
    expect(mittelwert(fuer('bedeutungsorientiert', 5), 'bedeutungsorientiert')).toBeNull();
    expect(mittelwert(fuer('bedeutungsorientiert', 5, 4), 'bedeutungsorientiert')).toBe(4.5);
  });

  it('zaehlt weder fremde Skalen noch unbekannte Aussagen mit', () => {
    const antworten = { ...fuer('verknuepfen', 5, 5, 5), 'gibt-es-nicht': 5 as const };
    expect(mittelwert(antworten, 'ordnen')).toBeNull();
    expect(mittelwert(antworten, 'verknuepfen')).toBe(5);
  });
});

describe('lernmusterAus', () => {
  it('nennt das Muster mit dem hoechsten Mittel', () => {
    expect(
      lernmusterAus(
        muster({ bedeutungsorientiert: 3.5, reproduktionsorientiert: 2, anwendungsorientiert: 4.5, ungerichtet: 2 }),
      ),
    ).toEqual({ art: 'eindeutig', muster: 'anwendungsorientiert' });
  });

  it('sagt „zwischen A und B" bei weniger als 0,5 Abstand, das hoehere zuerst', () => {
    expect(
      lernmusterAus(muster({ bedeutungsorientiert: 3.75, anwendungsorientiert: 4, ungerichtet: 1 })),
    ).toEqual({ art: 'zwischen', a: 'anwendungsorientiert', b: 'bedeutungsorientiert' });
  });

  it('bleibt bei GENAU 0,5 Abstand eindeutig', () => {
    // Die Grenze: „weniger als 0,5" heisst 0,5 selbst gehoert nicht dazu.
    expect(lernmusterAus(muster({ bedeutungsorientiert: 4, anwendungsorientiert: 3.5 }))).toEqual({
      art: 'eindeutig',
      muster: 'bedeutungsorientiert',
    });
  });

  it('sagt knapp unter 0,5 Abstand noch „zwischen"', () => {
    expect(lernmusterAus(muster({ bedeutungsorientiert: 4, anwendungsorientiert: 3.51 }))).toEqual({
      art: 'zwischen',
      a: 'bedeutungsorientiert',
      b: 'anwendungsorientiert',
    });
  });

  it('nennt bei gleichem Mittel die Muster in fester Reihenfolge', () => {
    // Dasselbe Profil darf nicht einmal so und einmal anders heissen.
    expect(
      lernmusterAus(
        muster({ bedeutungsorientiert: 3, reproduktionsorientiert: 3, anwendungsorientiert: 3, ungerichtet: 3 }),
      ),
    ).toEqual({ art: 'zwischen', a: 'bedeutungsorientiert', b: 'reproduktionsorientiert' });
    expect(
      lernmusterAus(
        muster({ bedeutungsorientiert: 2, reproduktionsorientiert: 2, anwendungsorientiert: 4, ungerichtet: 4 }),
      ),
    ).toEqual({ art: 'zwischen', a: 'anwendungsorientiert', b: 'ungerichtet' });
  });

  it('kommt mit einem einzigen erhobenen Muster aus', () => {
    expect(lernmusterAus(muster({ ungerichtet: 2 }))).toEqual({ art: 'eindeutig', muster: 'ungerichtet' });
  });

  it('gibt null, wenn kein Muster erhoben ist', () => {
    expect(lernmusterAus(muster({}))).toBeNull();
  });
});

describe('strukturhinweisAus', () => {
  it('meldet ab GENAU 3,5 bei „ungerichtet"', () => {
    expect(strukturhinweisAus(muster({ ungerichtet: 3.5 }))).toBe(true);
  });

  it('meldet knapp darunter nicht', () => {
    expect(strukturhinweisAus(muster({ ungerichtet: 3.49 }))).toBe(false);
    expect(strukturhinweisAus(muster({ ungerichtet: 3 }))).toBe(false);
  });

  it('meldet unabhaengig vom fuehrenden Muster', () => {
    const mittel = muster({ anwendungsorientiert: 5, ungerichtet: 4 });
    expect(lernmusterAus(mittel)).toEqual({ art: 'eindeutig', muster: 'anwendungsorientiert' });
    expect(strukturhinweisAus(mittel)).toBe(true);
  });

  it('meldet nichts, wenn „ungerichtet" nicht erhoben ist', () => {
    expect(strukturhinweisAus(muster({ anwendungsorientiert: 5 }))).toBe(false);
  });
});

describe('schwachstellenAus', () => {
  it('nennt die zwei niedrigsten Skalen unter 3,0, die niedrigste zuerst', () => {
    expect(
      schwachstellenAus(
        skalen({ ordnen: 2.5, verknuepfen: 1.5, abrufen: 2, steuern: 4, dranbleiben: 3.5, zeiteinteilen: 2.9 }),
      ),
    ).toEqual(['verknuepfen', 'abrufen']);
  });

  it('nennt bei GENAU 3,0 keine Schwachstelle', () => {
    // „Unter 3,0" heisst: 3,0 selbst ist keine.
    expect(
      schwachstellenAus(
        skalen({ ordnen: 3, verknuepfen: 3, abrufen: 3, steuern: 3, dranbleiben: 3, zeiteinteilen: 3 }),
      ),
    ).toEqual([]);
  });

  it('nennt knapp unter 3,0 eine — und nur die', () => {
    expect(
      schwachstellenAus(
        skalen({ ordnen: 4, verknuepfen: 4, abrufen: 4, steuern: 4, dranbleiben: 4, zeiteinteilen: 2.99 }),
      ),
    ).toEqual(['zeiteinteilen']);
  });

  it('macht aus einer nicht erhobenen Skala keine Schwachstelle', () => {
    expect(schwachstellenAus(skalen({ verknuepfen: 2 }))).toEqual(['verknuepfen']);
    expect(schwachstellenAus(skalen({}))).toEqual([]);
  });

  it('nimmt bei gleichem Mittel die Reihenfolge der Skalen', () => {
    expect(
      schwachstellenAus(
        skalen({ ordnen: 2, verknuepfen: 2, abrufen: 2, steuern: 2, dranbleiben: 2, zeiteinteilen: 2 }),
      ),
    ).toEqual(['ordnen', 'verknuepfen']);
  });
});

describe('werteAus', () => {
  const antworten = {
    ...fuer('ordnen', 2, 2, 3),
    ...fuer('verknuepfen', 4, 5, 4),
    ...fuer('abrufen', 1, 2, 2),
    ...fuer('steuern', 3, 3, 3),
    ...fuer('dranbleiben', 4, 4, 5),
    ...fuer('zeiteinteilen', 2, 3, 3),
    ...fuer('bedeutungsorientiert', 3, 4),
    ...fuer('reproduktionsorientiert', 2, 2),
    ...fuer('anwendungsorientiert', 5, 4),
    ...fuer('ungerichtet', 4, 3),
  };

  it('rechnet ein ganzes Profil aus den Antworten', () => {
    const ergebnis = werteAus({ itemsatz: 1, antworten });
    expect(ergebnis?.skalen.ordnen).toBeCloseTo(7 / 3, 10);
    expect(ergebnis?.skalen.abrufen).toBeCloseTo(5 / 3, 10);
    expect(ergebnis?.skalen.zeiteinteilen).toBeCloseTo(8 / 3, 10);
    expect(ergebnis).toMatchObject({
      skalen: { steuern: 3 },
      muster: {
        bedeutungsorientiert: 3.5,
        reproduktionsorientiert: 2,
        anwendungsorientiert: 4.5,
        ungerichtet: 3.5,
      },
      lernmuster: { art: 'eindeutig', muster: 'anwendungsorientiert' },
      strukturhinweis: true,
      schwachstellen: ['abrufen', 'ordnen'],
    });
  });

  it('gilt bei fremdem itemsatz als nicht erhoben', () => {
    // Antworten auf alte Aussagen werden nicht mit neuen verrechnet — auch
    // dann nicht, wenn zufaellig alle Ids noch passen.
    expect(werteAus({ itemsatz: 2, antworten })).toBeNull();
    expect(werteAus({ itemsatz: 1, antworten })).not.toBeNull();
  });

  it('liefert ohne Antworten lauter null und keinen Befund', () => {
    expect(werteAus({ itemsatz: 1, antworten: {} })).toEqual({
      skalen: {
        ordnen: null,
        verknuepfen: null,
        abrufen: null,
        steuern: null,
        dranbleiben: null,
        zeiteinteilen: null,
      },
      muster: {
        bedeutungsorientiert: null,
        reproduktionsorientiert: null,
        anwendungsorientiert: null,
        ungerichtet: null,
      },
      lernmuster: null,
      strukturhinweis: false,
      schwachstellen: [],
    });
  });

  it('macht aus einer uebersprungenen Skala keinen Mangel', () => {
    // Alles mit 4 beantwortet, nur „Ordnen" hat ein einziges Kreuz — bei 1.
    const fastAlles = Object.fromEntries(
      ITEMS.filter((item) => item.dimension !== 'ordnen').map((item) => [item.id, 4 as const]),
    );
    const ergebnis = werteAus({ itemsatz: 1, antworten: { ...fastAlles, ...fuer('ordnen', 1) } });
    expect(ergebnis?.skalen.ordnen).toBeNull();
    expect(ergebnis?.schwachstellen).toEqual([]);
  });
});
```

- [ ] **Schritt 2: Test laufen lassen, Fehlschlag ansehen**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && npx vitest run tests/profil-auswertung.test.ts 2>&1 | tail -8
```
Erwartet: FAIL mit `Failed to resolve import "../src/profil/auswertung"`.

- [ ] **Schritt 3: Die Auswertung anlegen**

`src/profil/auswertung.ts`:

```ts
import { ITEMS, ITEMSATZ, MUSTER, SKALEN, type Dimension, type Muster, type Skala, type Wert } from './items';
import type { Profilstand } from './schema';

/**
 * Die Auswertung des Audits. Rein: keine Uhr, kein Speicher, kein React.
 *
 * Sie rechnet aus den ANTWORTEN, bei jedem Oeffnen neu. Das Ergebnis wird nie
 * gespeichert — aendert sich eine Regel hier, stimmt das Profil beim naechsten
 * Oeffnen von selbst, ohne Migration.
 *
 * Vier Regeln, jede mit ihrer Grenze als benannter Zahl. Wer an einer dreht,
 * findet in `tests/profil-auswertung.test.ts` den Test, der genau an dieser
 * Grenze steht.
 */

/** Unter so vielen Antworten gilt eine Skala oder ein Muster als nicht erhoben. */
export const MINDESTANTWORTEN = 2;
/** Liegen die beiden hoechsten Muster WENIGER als so weit auseinander: „zwischen A und B". */
export const GLEICHSTAND_UNTER = 0.5;
/** AB diesem Mittel bei „ungerichtet" gibt es den Strukturhinweis. */
export const STRUKTUR_AB = 3.5;
/** UNTER diesem Mittel gilt eine Strategie-Skala als Schwachstelle. */
export const SCHWACH_UNTER = 3.0;
/** Mehr Vorschlaege auf einmal liest niemand. */
export const HOECHSTENS_SCHWACHSTELLEN = 2;

/** Item-Id -> Wert. Eine fehlende Id heisst: nicht beantwortet. */
export type Antworten = Readonly<Partial<Record<string, Wert>>>;

export type Lernmuster =
  | { readonly art: 'eindeutig'; readonly muster: Muster }
  | { readonly art: 'zwischen'; readonly a: Muster; readonly b: Muster };

export type Auswertung = {
  /** Mittel je Skala, 1 bis 5 — oder `null`, wenn nicht erhoben. */
  readonly skalen: Readonly<Record<Skala, number | null>>;
  /** Mittel je Muster — oder `null`, wenn nicht erhoben. */
  readonly muster: Readonly<Record<Muster, number | null>>;
  /** `null`, wenn kein einziges Muster erhoben ist. */
  readonly lernmuster: Lernmuster | null;
  readonly strukturhinweis: boolean;
  /** Hoechstens zwei, die niedrigste zuerst. Leer, wenn nichts unter der Schwelle liegt. */
  readonly schwachstellen: readonly Skala[];
};

/**
 * Das Mittel der beantworteten Aussagen einer Skala oder eines Musters.
 *
 * `null` und nicht 0, wenn zu wenig beantwortet ist. Eine 0 waere eine Aussage
 * — die schlechteste, die es gibt: Sie machte aus einer uebersprungenen Skala
 * eine Schwachstelle und aus einem uebersprungenen Muster einen Befund. Eine
 * einzelne Antwort ist kein Mittel, sondern ein Kreuz.
 */
export function mittelwert(antworten: Antworten, dimension: Dimension): number | null {
  const werte = ITEMS.flatMap((item) => {
    const wert = antworten[item.id];
    return item.dimension === dimension && wert !== undefined ? [wert] : [];
  });
  if (werte.length < MINDESTANTWORTEN) return null;
  return werte.reduce<number>((summe, wert) => summe + wert, 0) / werte.length;
}

/**
 * Das Lernmuster: das mit dem hoechsten Mittel — oder „zwischen A und B".
 *
 * Bei zwei Aussagen je Muster waere eine scharfe Grenze vorgetaeuschte
 * Genauigkeit. Liegen die beiden hoechsten weniger als `GLEICHSTAND_UNTER`
 * auseinander, werden beide genannt. Bei gleichem Mittel entscheidet die
 * Reihenfolge in `MUSTER`, damit dasselbe Profil nicht einmal so und einmal
 * anders heisst (`sort` ist stabil).
 *
 * Nicht erhobene Muster nehmen nicht teil — sie sind keine Null, sie fehlen.
 */
export function lernmusterAus(mittel: Readonly<Record<Muster, number | null>>): Lernmuster | null {
  const erhoben = MUSTER.flatMap((muster) => {
    const wert = mittel[muster];
    return wert === null ? [] : [{ muster, wert }];
  });
  const [erstes, zweites] = [...erhoben].sort((x, y) => y.wert - x.wert);
  if (erstes === undefined) return null;
  if (zweites !== undefined && erstes.wert - zweites.wert < GLEICHSTAND_UNTER) {
    return { art: 'zwischen', a: erstes.muster, b: zweites.muster };
  }
  return { art: 'eindeutig', muster: erstes.muster };
}

/**
 * Der Strukturhinweis haengt NUR an „ungerichtet", nicht am fuehrenden Muster.
 *
 * Es ist das Muster mit dem klarsten Befund (durchgehend negativer
 * Zusammenhang mit Leistung) und das, bei dem die App am meisten helfen kann.
 * Wer bei „anwendungsorientiert" 5,0 hat und bei „ungerichtet" 4,0, bekommt
 * den Hinweis trotzdem.
 */
export function strukturhinweisAus(mittel: Readonly<Record<Muster, number | null>>): boolean {
  const wert = mittel.ungerichtet;
  return wert !== null && wert >= STRUKTUR_AB;
}

/**
 * Die zwei niedrigsten Strategie-Skalen UNTER der Schwelle, die niedrigste
 * zuerst. Gibt es keine, gibt es keine — das Profil erfindet keinen Mangel.
 * Eine nicht erhobene Skala ist nie eine Schwachstelle. Bei gleichem Mittel
 * entscheidet die Reihenfolge in `SKALEN`.
 */
export function schwachstellenAus(skalen: Readonly<Record<Skala, number | null>>): Skala[] {
  return SKALEN.flatMap((skala) => {
    const wert = skalen[skala];
    return wert !== null && wert < SCHWACH_UNTER ? [{ skala, wert }] : [];
  })
    .sort((x, y) => x.wert - y.wert)
    .slice(0, HOECHSTENS_SCHWACHSTELLEN)
    .map((eintrag) => eintrag.skala);
}

/**
 * Die ganze Auswertung — oder `null`, wenn der Stand zu einem anderen Itemsatz
 * gehoert. Dann gilt das Profil als NICHT ERHOBEN: Antworten auf alte Aussagen
 * werden nicht mit neuen verrechnet, auch nicht teilweise.
 */
export function werteAus(stand: Pick<Profilstand, 'itemsatz' | 'antworten'>): Auswertung | null {
  if (stand.itemsatz !== ITEMSATZ) return null;

  const a = stand.antworten;
  // Ausgeschrieben statt in einer Schleife gebaut: So prueft der Uebersetzer,
  // dass keine Skala und kein Muster fehlt — und es braucht keinen Cast.
  const skalen: Record<Skala, number | null> = {
    ordnen: mittelwert(a, 'ordnen'),
    verknuepfen: mittelwert(a, 'verknuepfen'),
    abrufen: mittelwert(a, 'abrufen'),
    steuern: mittelwert(a, 'steuern'),
    dranbleiben: mittelwert(a, 'dranbleiben'),
    zeiteinteilen: mittelwert(a, 'zeiteinteilen'),
  };
  const muster: Record<Muster, number | null> = {
    bedeutungsorientiert: mittelwert(a, 'bedeutungsorientiert'),
    reproduktionsorientiert: mittelwert(a, 'reproduktionsorientiert'),
    anwendungsorientiert: mittelwert(a, 'anwendungsorientiert'),
    ungerichtet: mittelwert(a, 'ungerichtet'),
  };

  return {
    skalen,
    muster,
    lernmuster: lernmusterAus(muster),
    strukturhinweis: strukturhinweisAus(muster),
    schwachstellen: schwachstellenAus(skalen),
  };
}
```

- [ ] **Schritt 4: Test laufen lassen**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && npx vitest run tests/profil-auswertung.test.ts 2>&1 | grep -E "Tests |×"
```
Erwartet: `Tests  26 passed (26)`.

- [ ] **Schritt 5: Mutationsprobe A — `null` statt 0**

Ändere in `mittelwert` vorübergehend `if (werte.length < MINDESTANTWORTEN) return null;` zu `if (werte.length < MINDESTANTWORTEN) return 0;` und lass den Test laufen.

Erwartet: **genau sechs** Tests schlagen fehl, zwanzig bleiben grün:

1. `mittelwert` › „gibt bei nur einer Antwort null — nicht 0 und nicht den Einzelwert"
2. `mittelwert` › „gibt ganz ohne Antwort null"
3. `mittelwert` › „verlangt bei einem Muster beide Aussagen"
4. `mittelwert` › „zaehlt weder fremde Skalen noch unbekannte Aussagen mit"
5. `werteAus` › „liefert ohne Antworten lauter null und keinen Befund"
6. `werteAus` › „macht aus einer uebersprungenen Skala keinen Mangel"

Die letzten beiden zeigen, warum die Stelle wehtut: Mit 0 wird aus jeder übersprungenen Skala eine Schwachstelle und aus einem leeren Audit ein Lernmuster. Die Tests zu `lernmusterAus`, `strukturhinweisAus` und `schwachstellenAus` bleiben grün — sie bekommen ihre Mittelwerte direkt und laufen an `mittelwert` vorbei. Änderung zurücknehmen.

- [ ] **Schritt 6: Mutationsprobe B — die Gleichstandsregel**

Ändere in `lernmusterAus` vorübergehend `erstes.wert - zweites.wert < GLEICHSTAND_UNTER` zu `erstes.wert - zweites.wert <= GLEICHSTAND_UNTER` und lass den Test laufen.

Erwartet: **genau ein** Test schlägt fehl — `lernmusterAus` › „bleibt bei GENAU 0,5 Abstand eindeutig". Der große Test in `werteAus` bleibt grün, weil dort das führende Muster (4,5) einen ganzen Punkt vor dem zweiten (3,5) liegt — mit Absicht nicht an der Grenze. Änderung zurücknehmen, dann:

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && (grep -c "return 0;\|<= GLEICHSTAND_UNTER" src/profil/auswertung.ts || true) && npx vitest run tests/profil-auswertung.test.ts 2>&1 | grep -E "Tests |×"
```
Erwartet: `0`, dann `Tests  26 passed (26)`.

- [ ] **Schritt 7: Typen prüfen und committen**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && python -c "import sys; print(sum(open(f,'rb').read().count(b'\x00') for f in sys.argv[1:]))" src/profil/auswertung.ts tests/profil-auswertung.test.ts && npm run check 2>&1 | grep -E "^- [0-9]+ error" && git add src/profil/auswertung.ts tests/profil-auswertung.test.ts && git commit -q -F - <<'MSG'
feat: Auswertung des Audits - Skalen, Lernmuster, Schwachstellen

Rein, ohne Uhr und ohne Speicher. Gerechnet wird aus den Antworten, bei
jedem Oeffnen neu - aendert sich eine Regel, stimmt das Profil von
selbst, ohne Migration.

Vier Regeln, jede mit ihrer Grenze als benannter Zahl und einem Test,
der genau dort steht: null statt 0 unter zwei Antworten; zwischen A und
B unter 0,5 Abstand, bei genau 0,5 eindeutig; Strukturhinweis ab genau
3,5 bei ungerichtet, unabhaengig vom fuehrenden Muster; Schwachstellen
sind die zwei niedrigsten Skalen unter 3,0, bei genau 3,0 keine. Ein
fremder itemsatz heisst nicht erhoben.

Zwei Mutationsproben: null zu 0 faellt in sechs Tests auf - darunter
die beiden, die zeigen, dass aus einer uebersprungenen Skala sonst ein
Mangel wuerde. Die Gleichstandsregel mit <= statt < faellt in genau
einem auf.

<CO-AUTHORED-BY>
MSG
```
Erwartet: `0`, `- 0 errors`, danach ein Commit.

---

## Aufgabe 4: Was die App daraus anbietet — `vorschlag.ts`

**Dateien:**
- Neu: `src/profil/vorschlag.ts`
- Test: `tests/profil-vorschlag.test.ts`

Vier kleine Dinge von derselben Art: aus einer Tatsache über das Profil wird ein Angebot. Die Uhr kommt als Argument herein.

- [ ] **Schritt 1: Den fehlschlagenden Test schreiben**

`tests/profil-vorschlag.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  NEUTRALE_VORLIEBEN,
  VORSCHLAG,
  einladungZeigen,
  voreinstellungen,
  wiederholungLohnt,
} from '../src/profil/vorschlag';
import type { Profilstand } from '../src/profil/schema';

const ERHOBEN = '2026-09-19T10:00:00.000Z';
const TAG = 24 * 60 * 60 * 1000;

/** `tage` Tage und `ms` Millisekunden nach der Erhebung. */
function nach(tage: number, ms = 0): Date {
  return new Date(new Date(ERHOBEN).getTime() + tage * TAG + ms);
}

describe('VORSCHLAG', () => {
  it('traegt die sechs Vorschlaege im Wortlaut des Specs', () => {
    expect(VORSCHLAG).toEqual({
      ordnen: 'Schreib nach jeder Lektion den Satz des Prinzips in eigenen Worten auf — ein Satz reicht.',
      verknuepfen: 'Nimm dir bei jedem Transfer eine Minute: Wo ist dir das im eigenen Projekt begegnet?',
      abrufen: 'Lass die App fragen, bevor du nachliest. Es fühlt sich schwerer an und wirkt besser.',
      steuern: 'Leg vor der Sitzung fest, was danach sitzen soll — ein Satz reicht. Prüf am Ende selbst, ob er stimmt.',
      dranbleiben: 'Nimm dir fünf Minuten vor, nicht eine Stunde. Kurz und täglich schlägt lang und selten.',
      zeiteinteilen: 'Leg deine Lerntage für die Woche fest, bevor sie anfängt. Ein fester Termin wird eher eingehalten als ein guter Vorsatz.',
    });
  });
});

describe('wiederholungLohnt', () => {
  it('meldet ab GENAU acht Wochen', () => {
    expect(wiederholungLohnt(ERHOBEN, nach(56))).toBe(true);
    expect(wiederholungLohnt(ERHOBEN, nach(200))).toBe(true);
  });

  it('meldet eine Millisekunde vorher noch nicht', () => {
    expect(wiederholungLohnt(ERHOBEN, nach(56, -1))).toBe(false);
    expect(wiederholungLohnt(ERHOBEN, nach(0))).toBe(false);
  });

  it('meldet bei einem unlesbaren Zeitpunkt nichts', () => {
    // Lieber kein Hinweis als einer ohne Grundlage.
    expect(wiederholungLohnt('gestern', nach(200))).toBe(false);
  });
});

describe('einladungZeigen', () => {
  it('zeigt die Einladung, solange kein Profil erhoben ist', () => {
    expect(einladungZeigen(false, undefined, nach(0))).toBe(true);
  });

  it('zeigt sie nie, wenn ein Profil erhoben ist', () => {
    expect(einladungZeigen(true, undefined, nach(0))).toBe(false);
    expect(einladungZeigen(true, ERHOBEN, nach(30))).toBe(false);
  });

  it('bleibt nach „Später" weg — und kommt nach GENAU sieben Tagen wieder', () => {
    expect(einladungZeigen(false, ERHOBEN, nach(0))).toBe(false);
    expect(einladungZeigen(false, ERHOBEN, nach(7, -1))).toBe(false);
    expect(einladungZeigen(false, ERHOBEN, nach(7))).toBe(true);
  });

  it.each([
    ['eine Zahl', 42],
    ['null', null],
    ['ein Wort', 'irgendwann'],
    ['ein Objekt', {}],
  ])('laesst sich von Unsinn im Speicher nicht verstecken: %s', (_name, spaeter) => {
    expect(einladungZeigen(false, spaeter, nach(0))).toBe(true);
  });

  it('laesst sich von einem Zeitpunkt in der Zukunft nicht verstecken', () => {
    // Eine verstellte Uhr soll die Einladung nicht auf Jahre wegsperren.
    expect(einladungZeigen(false, nach(400).toISOString(), nach(0))).toBe(true);
  });
});

describe('voreinstellungen', () => {
  const stand: Profilstand = {
    itemsatz: 1,
    erhoben: ERHOBEN,
    antworten: {},
    vorlieben: { einstieg: 'ueberblick', minuten: 20, text: 'stichpunkte' },
  };

  it('gibt ohne Profil die neutralen Vorlieben', () => {
    expect(voreinstellungen(null)).toEqual({ einstieg: 'egal', minuten: 10, text: 'egal' });
    expect(voreinstellungen(null)).toBe(NEUTRALE_VORLIEBEN);
  });

  it('gibt mit Profil genau dessen Vorlieben', () => {
    expect(voreinstellungen(stand)).toEqual({ einstieg: 'ueberblick', minuten: 20, text: 'stichpunkte' });
  });
});
```

- [ ] **Schritt 2: Test laufen lassen, Fehlschlag ansehen**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && npx vitest run tests/profil-vorschlag.test.ts 2>&1 | tail -8
```
Erwartet: FAIL mit `Failed to resolve import "../src/profil/vorschlag"`.

- [ ] **Schritt 3: Die Datei anlegen**

`src/profil/vorschlag.ts`:

```ts
import type { Skala } from './items';
import type { Profilstand, Vorlieben } from './schema';

/**
 * Was die App aus dem Profil VORSCHLAEGT. Rein: Die Uhr kommt als Argument
 * herein, der Speicher gar nicht.
 *
 * Vier kleine Dinge, alle von derselben Art — aus einer Tatsache ueber das
 * Profil wird ein Angebot, nie eine Vorschrift:
 * eine Schwachstelle -> ein konkreter Vorschlag,
 * das Alter der Erhebung -> der Hinweis auf eine Wiederholung,
 * kein Profil -> die Einladung auf der Uebersicht,
 * die Vorlieben -> Voreinstellungen (liest erst Teil 3b).
 */

/**
 * Je Skala ein Vorschlag — konkret, klein, an die App gebunden, formuliert als
 * veraenderbare Gewohnheit. Der Wortlaut steht im Spec und wird hier nicht
 * umformuliert; der Test haelt ihn Zeichen fuer Zeichen fest.
 */
export const VORSCHLAG: Readonly<Record<Skala, string>> = {
  ordnen: 'Schreib nach jeder Lektion den Satz des Prinzips in eigenen Worten auf — ein Satz reicht.',
  verknuepfen: 'Nimm dir bei jedem Transfer eine Minute: Wo ist dir das im eigenen Projekt begegnet?',
  abrufen: 'Lass die App fragen, bevor du nachliest. Es fühlt sich schwerer an und wirkt besser.',
  steuern: 'Leg vor der Sitzung fest, was danach sitzen soll — ein Satz reicht. Prüf am Ende selbst, ob er stimmt.',
  dranbleiben: 'Nimm dir fünf Minuten vor, nicht eine Stunde. Kurz und täglich schlägt lang und selten.',
  zeiteinteilen: 'Leg deine Lerntage für die Woche fest, bevor sie anfängt. Ein fester Termin wird eher eingehalten als ein guter Vorsatz.',
};

const TAG_MS = 24 * 60 * 60 * 1000;

/** Acht Wochen. AB diesem Alter lohnt sich eine Wiederholung. */
export const WIEDERHOLUNG_NACH_TAGEN = 56;

/**
 * Ob die Erhebung alt genug ist, dass sich eine Wiederholung lohnt.
 *
 * Muster aendern sich mit Stoff und Uebung — ein Profil von vor einem halben
 * Jahr beschreibt jemanden, den es so nicht mehr gibt. Ein unlesbarer
 * Zeitpunkt ergibt `false`: lieber kein Hinweis als einer ohne Grundlage.
 */
export function wiederholungLohnt(erhoben: string, jetzt: Date): boolean {
  const seit = jetzt.getTime() - new Date(erhoben).getTime();
  return Number.isFinite(seit) && seit >= WIEDERHOLUNG_NACH_TAGEN * TAG_MS;
}

/** So viele Tage bleibt die Einladung weg, nachdem jemand sie auf spaeter verschoben hat. */
export const SPAETER_TAGE = 7;

/**
 * Ob die Uebersicht die Karte „Lernprofil anlegen" zeigt.
 *
 * Das Audit ist ein Angebot. Wer es verschiebt, meint wirklich spaeter: eine
 * Woche Ruhe, dann fragt die Karte noch einmal. `spaeterSeit` ist `unknown`,
 * weil es aus dem Speicher kommt. Alles, was kein Zeitpunkt in der
 * Vergangenheit ist, zaehlt nicht — eine verstellte Uhr soll die Einladung
 * nicht auf Jahre verstecken.
 */
export function einladungZeigen(profilErhoben: boolean, spaeterSeit: unknown, jetzt: Date): boolean {
  if (profilErhoben) return false;
  if (typeof spaeterSeit !== 'string') return true;
  const seit = jetzt.getTime() - new Date(spaeterSeit).getTime();
  if (!Number.isFinite(seit) || seit < 0) return true;
  return seit >= SPAETER_TAGE * TAG_MS;
}

/** Was gilt, solange niemand etwas anderes gesagt hat. */
export const NEUTRALE_VORLIEBEN: Vorlieben = { einstieg: 'egal', minuten: 10, text: 'egal' };

/**
 * Profil -> Voreinstellungen.
 *
 * Heute liest das niemand: Was eine Vorliebe verstellt, entscheidet Teil 3b,
 * sobald es die Sitzungsseite gibt. Die Funktion steht trotzdem schon hier,
 * damit es dann EINE Stelle gibt, die sagt, was ohne Profil gilt — und nicht
 * drei Seiten, die je ihren eigenen Ersatzwert erfinden. Was „egal" bedeutet,
 * bleibt bewusst offen; das ist eine Frage der Abwechslung, nicht des Profils.
 */
export function voreinstellungen(stand: Profilstand | null): Vorlieben {
  return stand === null ? NEUTRALE_VORLIEBEN : stand.vorlieben;
}
```

- [ ] **Schritt 4: Test laufen lassen**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && npx vitest run tests/profil-vorschlag.test.ts 2>&1 | grep -E "Tests |×"
```
Erwartet: `Tests  14 passed (14)`.

- [ ] **Schritt 5: Mutationsprobe — „ab acht Wochen"**

Ändere in `wiederholungLohnt` vorübergehend `seit >= WIEDERHOLUNG_NACH_TAGEN * TAG_MS` zu `seit > WIEDERHOLUNG_NACH_TAGEN * TAG_MS` und lass den Test laufen.

Erwartet: **genau ein** Test schlägt fehl — `wiederholungLohnt` › „meldet ab GENAU acht Wochen". Der Nachbar „meldet eine Millisekunde vorher noch nicht" bleibt grün: Er steht auf der anderen Seite der Grenze. Änderung zurücknehmen, dann:

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && (grep -c "seit > WIEDERHOLUNG" src/profil/vorschlag.ts || true) && npx vitest run tests/profil-vorschlag.test.ts 2>&1 | grep -E "Tests |×"
```
Erwartet: `0`, dann `Tests  14 passed (14)`.

- [ ] **Schritt 6: Typen prüfen und committen**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && python -c "import sys; print(sum(open(f,'rb').read().count(b'\x00') for f in sys.argv[1:]))" src/profil/vorschlag.ts tests/profil-vorschlag.test.ts && npm run check 2>&1 | grep -E "^- [0-9]+ error" && git add src/profil/vorschlag.ts tests/profil-vorschlag.test.ts && git commit -q -F - <<'MSG'
feat: Vorschlaege, Wiederholungshinweis und Einladung

Je Skala ein Vorschlag im Wortlaut des Specs - konkret, klein, als
veraenderbare Gewohnheit formuliert. Ab genau acht Wochen lohnt sich
eine Wiederholung; die Mutationsprobe mit > statt >= faellt in genau
einem Test auf.

Die Einladung auf der Uebersicht erscheint, solange kein Profil erhoben
ist. Wer sie verschiebt, hat eine Woche Ruhe. Unsinn im Speicher und
ein Zeitpunkt in der Zukunft verstecken sie nicht - eine verstellte Uhr
soll die Einladung nicht auf Jahre wegsperren.

voreinstellungen() ist bewusst duenn: Was eine Vorliebe verstellt,
entscheidet Teil 3b. Bis dahin gibt es eine Stelle, die sagt, was ohne
Profil gilt.

<CO-AUTHORED-BY>
MSG
```
Erwartet: `0`, `- 0 errors`, danach ein Commit.

---
## Aufgabe 5: Die Ergebnisseite — `Ergebnis.tsx`

**Dateien:**
- Neu: `src/profil/Ergebnis.tsx`
- Test: `tests/profil-ergebnis.test.tsx`

Zwei Komponenten in einer Datei: `Ergebnisansicht` stellt eine fertige Auswertung dar und weiß nichts vom Speicher; der Standardexport `Ergebnis` ist die Insel für `/profil` und bekommt den Speicher als Prop — dieselbe Naht wie `Aufgabe.tsx`, im Test bedient über ein `spion()` wie in `tests/aufgabe.test.tsx`.

Der wichtigste Test hier heißt „zeigt NIE ein Muster ohne den Beipackzettel": Er rendert sechzig durchgezählte Antwortsätze und prüft die Regel an jedem — und er prüft am Ende, dass die Schleife wirklich eindeutige, unentschiedene **und** leere Muster gesehen hat. Ohne diese letzte Zeile könnte er grün sein, weil er den schwierigen Fall nie erzeugt.

- [ ] **Schritt 1: Den fehlschlagenden Test schreiben**

`tests/profil-ergebnis.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import Ergebnis, {
  BEIPACKZETTEL,
  Ergebnisansicht,
  MOMENTAUFNAHME,
  MUSTER_ERKLAERUNG,
  STRUKTURHINWEIS,
  alsZahl,
  mustersatz,
} from '../src/profil/Ergebnis';
import { werteAus, type Auswertung } from '../src/profil/auswertung';
import { ITEMS, SKALEN, type Wert } from '../src/profil/items';
import { VORSCHLAG } from '../src/profil/vorschlag';
import type { Speicher } from '../src/tutor/speicher';

const ERHOBEN = '2026-09-19T10:00:00.000Z';
const TAG = 24 * 60 * 60 * 1000;

/** Eine unauffaellige Auswertung. Jeder Test ueberschreibt, worum es ihm geht. */
function auswertung(teil: Partial<Auswertung> = {}): Auswertung {
  return {
    skalen: { ordnen: 4, verknuepfen: 4, abrufen: 4, steuern: 4, dranbleiben: 4, zeiteinteilen: 4 },
    muster: { bedeutungsorientiert: 3, reproduktionsorientiert: 2, anwendungsorientiert: 4.5, ungerichtet: 2 },
    lernmuster: { art: 'eindeutig', muster: 'anwendungsorientiert' },
    strukturhinweis: false,
    schwachstellen: [],
    ...teil,
  };
}

function zeige(teil: Partial<Auswertung> = {}, jetzt = new Date(ERHOBEN)) {
  return render(<Ergebnisansicht auswertung={auswertung(teil)} erhoben={ERHOBEN} jetzt={jetzt} />);
}

describe('die festen Texte der Ergebnisseite', () => {
  it('traegt den Beipackzettel im Wortlaut des Specs', () => {
    expect(BEIPACKZETTEL).toBe(
      'Dieses Profil beruht auf eigenen Aussagen nach veröffentlichten Modellen der Lernstrategien (LIST, MSLQ) und den Lernmustern nach Vermunt. Es ist keine geprüfte Skala. Was die App über dein Lernen wirklich weiß, stammt aus deinen Antworten auf Aufgaben — siehe Kalibrierung.',
    );
  });

  it('traegt den Satz zur Momentaufnahme im Wortlaut des Specs', () => {
    expect(MOMENTAUFNAHME).toBe(
      'Muster ändern sich mit Stoff und Übung. Das ist eine Momentaufnahme, keine Diagnose.',
    );
  });

  it('sagt ein Muster nie ohne das Wort „derzeit"', () => {
    expect(mustersatz({ art: 'eindeutig', muster: 'anwendungsorientiert' })).toBe(
      'Dein Lernmuster ist derzeit anwendungsorientiert.',
    );
    expect(mustersatz({ art: 'zwischen', a: 'bedeutungsorientiert', b: 'anwendungsorientiert' })).toBe(
      'Dein Lernmuster liegt derzeit zwischen bedeutungsorientiert und anwendungsorientiert.',
    );
  });

  it('schreibt Zahlen mit Komma und einer Stelle', () => {
    expect(alsZahl(8 / 3)).toBe('2,7');
    expect(alsZahl(3)).toBe('3,0');
  });
});

describe('Ergebnisansicht', () => {
  it('zeigt ein eindeutiges Muster mit Erklaerung, Momentaufnahme und Beipackzettel', () => {
    zeige();
    expect(screen.getByText('Dein Lernmuster ist derzeit anwendungsorientiert.')).toBeTruthy();
    expect(screen.getByText(MUSTER_ERKLAERUNG.anwendungsorientiert)).toBeTruthy();
    expect(screen.getByText(MOMENTAUFNAHME)).toBeTruthy();
    expect(screen.getByText(BEIPACKZETTEL)).toBeTruthy();
  });

  it('zeigt „zwischen A und B" mit beiden Erklaerungen — und dem Beipackzettel', () => {
    zeige({ lernmuster: { art: 'zwischen', a: 'bedeutungsorientiert', b: 'anwendungsorientiert' } });
    expect(
      screen.getByText('Dein Lernmuster liegt derzeit zwischen bedeutungsorientiert und anwendungsorientiert.'),
    ).toBeTruthy();
    expect(screen.getByText(MUSTER_ERKLAERUNG.bedeutungsorientiert, { exact: false })).toBeTruthy();
    expect(screen.getByText(MUSTER_ERKLAERUNG.anwendungsorientiert, { exact: false })).toBeTruthy();
    expect(screen.getByText(BEIPACKZETTEL)).toBeTruthy();
  });

  it('zeigt den Strukturhinweis unabhaengig vom fuehrenden Muster — und den Beipackzettel', () => {
    zeige({ strukturhinweis: true });
    expect(screen.getByText('Dein Lernmuster ist derzeit anwendungsorientiert.')).toBeTruthy();
    expect(screen.getByText(STRUKTURHINWEIS)).toBeTruthy();
    expect(screen.getByText(BEIPACKZETTEL)).toBeTruthy();
  });

  it('zeigt ohne Befund keinen Strukturhinweis', () => {
    zeige({ strukturhinweis: false });
    expect(screen.queryByText(STRUKTURHINWEIS)).toBeNull();
  });

  it('behauptet ohne erhobenes Muster keines — der Beipackzettel steht trotzdem da', () => {
    zeige({ lernmuster: null });
    expect(screen.queryByText(/derzeit/)).toBeNull();
    expect(screen.queryByText(MOMENTAUFNAHME)).toBeNull();
    expect(screen.getByText(/nicht erhoben — dafür fehlen Antworten/)).toBeTruthy();
    expect(screen.getByText(BEIPACKZETTEL)).toBeTruthy();
  });

  it('zeigt sechs Balken mit Zahl, nicht nur mit Farbe', () => {
    const { container } = zeige({
      skalen: { ordnen: 7 / 3, verknuepfen: 4, abrufen: 5 / 3, steuern: 3, dranbleiben: 5, zeiteinteilen: 1 },
    });
    const zeilen = [...container.querySelectorAll('.balken-zeile')];
    expect(zeilen.map((z) => z.getAttribute('data-skala'))).toEqual([...SKALEN]);
    expect(zeilen.map((z) => z.querySelector('.balken-zahl')?.textContent)).toEqual([
      '2,3 von 5',
      '4,0 von 5',
      '1,7 von 5',
      '3,0 von 5',
      '5,0 von 5',
      '1,0 von 5',
    ]);
    expect(zeilen[0]?.querySelector('.balken-name')?.textContent).toBe('Ordnen');
  });

  it('schreibt bei einer nicht erhobenen Skala „nicht erhoben" statt einer Null', () => {
    const { container } = zeige({
      skalen: { ordnen: null, verknuepfen: 4, abrufen: 4, steuern: 4, dranbleiben: 4, zeiteinteilen: 4 },
    });
    const ordnen = container.querySelector('[data-skala="ordnen"]');
    expect(ordnen?.querySelector('.balken-zahl')?.textContent).toBe('nicht erhoben');
    expect(ordnen?.textContent).not.toMatch(/0,0/);
  });

  it('macht je Schwachstelle genau einen Vorschlag, im Wortlaut', () => {
    zeige({ schwachstellen: ['abrufen', 'ordnen'] });
    expect(screen.getByText(VORSCHLAG.abrufen)).toBeTruthy();
    expect(screen.getByText(VORSCHLAG.ordnen)).toBeTruthy();
    for (const skala of ['verknuepfen', 'steuern', 'dranbleiben', 'zeiteinteilen'] as const) {
      expect(screen.queryByText(VORSCHLAG[skala])).toBeNull();
    }
    // Am Balken steht die Marke in Worten, nicht nur in Farbe.
    expect(screen.getAllByText('dazu unten ein Vorschlag')).toHaveLength(2);
  });

  it('erfindet keinen Mangel: ohne Schwachstelle kein Vorschlag', () => {
    const { container } = zeige({ schwachstellen: [] });
    expect(container.querySelectorAll('.vorschlag')).toHaveLength(0);
    expect(screen.getByText(/gibt es hier auch keinen Vorschlag/)).toBeTruthy();
  });

  it('weist ab acht Wochen auf eine Wiederholung hin — vorher nicht', () => {
    const vorher = zeige({}, new Date(new Date(ERHOBEN).getTime() + 56 * TAG - 1));
    expect(screen.queryByText(/älter als acht Wochen/)).toBeNull();
    vorher.unmount();

    zeige({}, new Date(new Date(ERHOBEN).getTime() + 56 * TAG));
    expect(screen.getByText(/älter als acht Wochen/)).toBeTruthy();
  });

  it('sagt offen, wenn das Ergebnis nicht behalten wurde', () => {
    render(<Ergebnisansicht auswertung={auswertung()} erhoben={ERHOBEN} nichtBehalten />);
    expect(screen.getByRole('status').textContent).toMatch(/nicht gespeichert/);
  });

  it('zeigt den Verweis zum Neu-Erheben, den die Seite hereinreicht', () => {
    render(<Ergebnisansicht auswertung={auswertung()} erhoben={ERHOBEN} erneut={<a href="/x/">Neu erheben</a>} />);
    expect(screen.getByRole('link', { name: 'Neu erheben' })).toBeTruthy();
  });

  it('zeigt NIE ein Muster ohne den Beipackzettel', () => {
    // Sechzig Antwortsaetze, stumpf durchgezaehlt: volle, halbe und leere,
    // eindeutige und unentschiedene. Die Regel ist nicht „der Beipackzettel
    // steht im Normalfall da", sondern „es gibt keinen Fall ohne ihn".
    const gesehen = new Set<string>();
    for (let n = 0; n < 60; n++) {
      const antworten: Record<string, Wert> = {};
      ITEMS.forEach((item, i) => {
        const wert = (n * 7 + i * (n % 5) + i * i) % 6;
        if (wert === 1 || wert === 2 || wert === 3 || wert === 4 || wert === 5) antworten[item.id] = wert;
      });
      const ergebnis = werteAus({ itemsatz: 1, antworten });
      if (ergebnis === null) throw new Error('Itemsatz 1 muss auswertbar sein.');

      const { container, unmount } = render(<Ergebnisansicht auswertung={ergebnis} erhoben={ERHOBEN} />);
      const art = container.querySelector('.muster-satz')?.getAttribute('data-muster') ?? 'fehlt';
      gesehen.add(art);
      if (art !== 'keins') {
        expect(container.querySelector('.beipackzettel')?.textContent).toContain(BEIPACKZETTEL);
      }
      unmount();
    }
    // Ohne diese Zeile koennte die Schleife gruen sein, weil sie nie ein
    // unentschiedenes Muster erzeugt hat.
    expect([...gesehen].sort()).toEqual(['eindeutig', 'keins', 'zwischen']);
  });
});

/**
 * Ein Speicher, der mitschreibt — dieselbe Naht wie `spion()` in
 * `tests/aufgabe.test.tsx`. Geprueft wird, was die Insel LIEST und dass sie
 * nichts schreibt; ob IndexedDB etwas behaelt, steht in speicher.test.ts.
 */
function spion(einstellungen: Record<string, unknown> = {}, teil: Partial<Speicher> = {}) {
  const geschrieben: { schluessel: string; wert: unknown }[] = [];
  const speicher: Speicher = {
    merkeEreignis: async () => true,
    ereignisse: async () => [],
    merkeKarte: async () => true,
    karte: async () => null,
    karten: async () => [],
    einstellung: async (schluessel) => einstellungen[schluessel],
    merkeEinstellung: async (schluessel, wert) => {
      geschrieben.push({ schluessel, wert });
      return true;
    },
    alsJson: async () => '{}',
    schliessen: async () => {},
    ...teil,
  };
  return { speicher, geschrieben };
}

const stand = {
  itemsatz: 1,
  erhoben: ERHOBEN,
  antworten: { 'anw-1': 5, 'anw-2': 4, 'bed-1': 3, 'bed-2': 3, 'abr-1': 1, 'abr-2': 2, 'abr-3': 2 },
  vorlieben: { einstieg: 'beispiel', minuten: 10, text: 'egal' },
};

const anlegen = <a href="/profil/audit/">Lernprofil anlegen</a>;
const erneut = <a href="/profil/audit/">Neu erheben</a>;

describe('Ergebnis — die Insel auf /profil', () => {
  it('rechnet das gespeicherte Profil aus den Antworten und zeigt es', async () => {
    const { speicher } = spion({ profil: stand });
    render(<Ergebnis speicher={speicher} anlegen={anlegen} erneut={erneut} />);

    expect(await screen.findByText('Dein Lernmuster ist derzeit anwendungsorientiert.')).toBeTruthy();
    expect(screen.getByText(VORSCHLAG.abrufen)).toBeTruthy();
    expect(screen.getByText(BEIPACKZETTEL)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Neu erheben' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Lernprofil anlegen' })).toBeNull();
  });

  it('bietet das Audit an, wenn nichts gespeichert ist', async () => {
    const { speicher } = spion();
    render(<Ergebnis speicher={speicher} anlegen={anlegen} erneut={erneut} />);

    expect(await screen.findByText('Auf diesem Gerät liegt noch kein Lernprofil.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Lernprofil anlegen' })).toBeTruthy();
    expect(screen.queryByText(/derzeit/)).toBeNull();
  });

  it.each([
    ['ein unlesbarer Stand', { itemsatz: 1, antworten: 'kaputt' }],
    ['ein Stand zu einem fremden Itemsatz', { ...stand, itemsatz: 2 }],
    ['ein Stand, der sein Ergebnis mitbringt', { ...stand, lernmuster: 'anwendungsorientiert' }],
    ['ein geloeschter Wert', null],
  ])('behandelt als „kein Profil", ohne abzustuerzen: %s', async (_name, roh) => {
    const { speicher } = spion({ profil: roh });
    render(<Ergebnis speicher={speicher} anlegen={anlegen} erneut={erneut} />);

    expect(await screen.findByText('Auf diesem Gerät liegt noch kein Lernprofil.')).toBeTruthy();
    expect(screen.queryByText(/derzeit/)).toBeNull();
  });

  it('bleibt stehen, wenn der Speicher beim Lesen wirft', async () => {
    const warnung = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { speicher } = spion({}, { einstellung: () => Promise.reject(new Error('kein Speicher')) });
    render(<Ergebnis speicher={speicher} anlegen={anlegen} erneut={erneut} />);

    expect(await screen.findByText('Auf diesem Gerät liegt noch kein Lernprofil.')).toBeTruthy();
    expect(warnung).toHaveBeenCalled();
    warnung.mockRestore();
  });

  it('liest nur — das Ergebnis wird nie gespeichert', async () => {
    const { speicher, geschrieben } = spion({ profil: stand });
    render(<Ergebnis speicher={speicher} anlegen={anlegen} erneut={erneut} />);

    await screen.findByText(/derzeit/);
    await waitFor(() => expect(geschrieben).toEqual([]));
  });
});
```

- [ ] **Schritt 2: Test laufen lassen, Fehlschlag ansehen**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && npx vitest run tests/profil-ergebnis.test.tsx 2>&1 | tail -8
```
Erwartet: FAIL mit `Failed to resolve import "../src/profil/Ergebnis"`.

- [ ] **Schritt 3: Die Komponenten anlegen**

`src/profil/Ergebnis.tsx`:

```tsx
import { useEffect, useState, type ReactNode } from 'react';
import { SKALEN, SKALA_TEXT, type Muster } from './items';
import { werteAus, type Auswertung, type Lernmuster } from './auswertung';
import { SCHLUESSEL_PROFIL, liesProfil } from './schema';
import { VORSCHLAG, wiederholungLohnt } from './vorschlag';
import { speicher as neuerSpeicher, type Speicher } from '../tutor/speicher';

/**
 * Die Ergebnisseite des Lernprofils: Muster, Balken, Vorschlaege, Beipackzettel.
 *
 * Zwei Komponenten in einer Datei. `Ergebnisansicht` stellt eine fertige
 * Auswertung dar und weiss nichts vom Speicher — sie steht auf `/profil` UND am
 * Ende des Audits. Der Standardexport `Ergebnis` ist die Insel fuer `/profil`:
 * Er liest den gespeicherten Stand, prueft ihn und rechnet die Auswertung
 * daraus. Gespeichert ist nie das Ergebnis, immer nur die Antworten.
 *
 * Die Insel kennt keine Adressen. Verweise kommen als Slots aus der
 * Astro-Seite herein: Nur dort erreicht sie `werkzeug/relative-verweise.mjs`,
 * das den gebauten Stand ortsunabhaengig macht.
 */

/** Wortlaut aus dem Spec. Steht IMMER da, wenn die Ansicht dasteht — nicht im Kleingedruckten. */
export const BEIPACKZETTEL =
  'Dieses Profil beruht auf eigenen Aussagen nach veröffentlichten Modellen der Lernstrategien (LIST, MSLQ) und den Lernmustern nach Vermunt. Es ist keine geprüfte Skala. Was die App über dein Lernen wirklich weiß, stammt aus deinen Antworten auf Aufgaben — siehe Kalibrierung.';

/** Wortlaut aus dem Spec. */
export const MOMENTAUFNAHME =
  'Muster ändern sich mit Stoff und Übung. Das ist eine Momentaufnahme, keine Diagnose.';

/**
 * Je Muster zwei Saetze, was es heisst. Beschrieben wird eine Gewohnheit, nie
 * ein Typ — und nirgends steht, man lerne besser, wenn der Stoff zum Muster
 * passt. Das ist nicht belegt und wird nicht versprochen.
 */
export const MUSTER_ERKLAERUNG: Readonly<Record<Muster, string>> = {
  bedeutungsorientiert:
    'Du suchst nach Zusammenhängen und willst wissen, warum etwas gilt. Was du liest, prüfst du, statt es nur zu übernehmen.',
  reproduktionsorientiert:
    'Du richtest dich danach, was abgefragt wird, und prägst dir den Stoff möglichst genau ein. Die Transferaufgaben der App verlangen mehr als das — dort zeigt sich, ob es trägt.',
  anwendungsorientiert:
    'Du fragst zuerst, was du mit dem Stoff praktisch anfangen kannst. Nach eigener Auskunft merkst du dir Dinge am besten an einem echten Fall.',
  ungerichtet:
    'Du bist dir oft unsicher, womit du anfangen sollst und ob deine Art zu lernen die richtige ist. Das ist kein Urteil über dich — es ist das Muster, bei dem eine feste Struktur am meisten hilft.',
};

export const STRUKTURHINWEIS =
  'Du hast angegeben, beim Lernen oft nicht zu wissen, womit du anfangen sollst. Halte dich an die Reihenfolge der Lektionen — sie ist so gebaut, dass du das nicht selbst entscheiden musst.';

/** Der Satz zum Muster. Wo ein Muster steht, steht „derzeit". */
export function mustersatz(lernmuster: Lernmuster | null): string {
  if (lernmuster === null) return 'Dein Lernmuster ist nicht erhoben — dafür fehlen Antworten.';
  if (lernmuster.art === 'zwischen') {
    return `Dein Lernmuster liegt derzeit zwischen ${lernmuster.a} und ${lernmuster.b}.`;
  }
  return `Dein Lernmuster ist derzeit ${lernmuster.muster}.`;
}

/** 2.6666 wird zu „2,7". */
export function alsZahl(wert: number): string {
  return wert.toFixed(1).replace('.', ',');
}

/** Das Datum der Erhebung in der Zeitzone des Geraets, ohne fuehrende Nullen. */
export function alsDatum(iso: string): string {
  const tag = new Date(iso);
  return `${tag.getDate()}.${tag.getMonth() + 1}.${tag.getFullYear()}`;
}

export type ErgebnisansichtProps = {
  auswertung: Auswertung;
  /** ISO-Zeitpunkt der Erhebung. */
  erhoben: string;
  /** Nur fuer den Hinweis nach acht Wochen. Voreingestellt: jetzt. */
  jetzt?: Date;
  /** Das Ergebnis steht nur auf dem Bildschirm: Das Speichern ist gescheitert. */
  nichtBehalten?: boolean;
  /** Der Verweis „Neu erheben" — ein Slot der Astro-Seite. */
  erneut?: ReactNode;
};

export function Ergebnisansicht({ auswertung, erhoben, jetzt, nichtBehalten = false, erneut }: ErgebnisansichtProps) {
  const { lernmuster, strukturhinweis, skalen, schwachstellen } = auswertung;
  const genannt: readonly Muster[] =
    lernmuster === null ? [] : lernmuster.art === 'zwischen' ? [lernmuster.a, lernmuster.b] : [lernmuster.muster];

  return (
    <div className="profil">
      {nichtBehalten && (
        <p className="profil-hinweis" role="status">
          Dein Profil konnte auf diesem Gerät nicht gespeichert werden. Du siehst es jetzt — nach dem Schließen der
          Seite ist es weg.
        </p>
      )}

      <section className="karte profil-muster">
        <p className="augenbraue">Lernmuster nach Vermunt</p>
        <p className="muster-satz" data-muster={lernmuster === null ? 'keins' : lernmuster.art}>
          {mustersatz(lernmuster)}
        </p>
        {genannt.map((muster) => (
          <p key={muster} className="muster-erklaerung">
            {genannt.length > 1 && <b>{muster}: </b>}
            {MUSTER_ERKLAERUNG[muster]}
          </p>
        ))}
        {lernmuster !== null && <p className="momentaufnahme">{MOMENTAUFNAHME}</p>}
        {strukturhinweis && <p className="strukturhinweis">{STRUKTURHINWEIS}</p>}
      </section>

      <section className="karte profil-strategien">
        <h2>Deine Lernstrategien</h2>
        <ul className="balken">
          {SKALEN.map((skala) => {
            const wert = skalen[skala];
            return (
              <li key={skala} className="balken-zeile" data-skala={skala}>
                <span className="balken-name">{SKALA_TEXT[skala]}</span>
                {/* Die Zahl steht als Text da. Der Balken ist Zierde und fuer
                    Vorlesegeraete ausgeblendet — Farbe und Laenge allein tragen
                    keinen Wert (WCAG 1.4.1). */}
                <span className="balken-zahl">{wert === null ? 'nicht erhoben' : `${alsZahl(wert)} von 5`}</span>
                <span className="balken-spur" aria-hidden="true">
                  <span className="balken-fuellung" style={{ width: `${wert === null ? 0 : (wert / 5) * 100}%` }} />
                </span>
                {schwachstellen.includes(skala) && <span className="balken-marke">dazu unten ein Vorschlag</span>}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="karte profil-vorschlaege">
        <h2>Vorschläge</h2>
        {schwachstellen.length === 0 ? (
          // Das Profil erfindet keinen Mangel.
          <p className="kein-vorschlag">Keine deiner Strategien liegt unter 3 von 5 — dann gibt es hier auch keinen Vorschlag.</p>
        ) : (
          <ul className="vorschlaege">
            {schwachstellen.map((skala) => (
              <li key={skala} className="vorschlag">
                <b>{SKALA_TEXT[skala]}</b>
                <span>{VORSCHLAG[skala]}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <aside className="beipackzettel">
        <h2>Was dieses Profil ist — und was nicht</h2>
        <p>{BEIPACKZETTEL}</p>
      </aside>

      <section className="profil-erneut">
        <p className="profil-erhoben">Erhoben am {alsDatum(erhoben)}.</p>
        {wiederholungLohnt(erhoben, jetzt ?? new Date()) && (
          <p className="profil-hinweis">
            Deine Erhebung ist älter als acht Wochen. Muster ändern sich — eine Wiederholung lohnt sich.
          </p>
        )}
        {erneut}
      </section>
    </div>
  );
}

export type ErgebnisProps = {
  /**
   * Die Naht fuer Tests, wie in `Aufgabe.tsx`. Voreingestellt ist der echte
   * Speicher; er oeffnet erst beim ersten Zugriff, deshalb schadet der Aufruf
   * beim Vorrendern auf dem Server nicht.
   */
  speicher?: Speicher;
  jetzt?: Date;
  /** Slot: der Verweis zum Audit, wenn noch kein Profil da ist. */
  anlegen?: ReactNode;
  /** Slot: der Verweis „Neu erheben", wenn eines da ist. */
  erneut?: ReactNode;
};

type Zustand =
  | { readonly art: 'laden' }
  | { readonly art: 'keins' }
  | { readonly art: 'da'; readonly auswertung: Auswertung; readonly erhoben: string };

export default function Ergebnis({ speicher, jetzt, anlegen, erneut }: ErgebnisProps) {
  const [ablage] = useState<Speicher>(() => speicher ?? neuerSpeicher());
  const [zustand, setZustand] = useState<Zustand>({ art: 'laden' });

  useEffect(() => {
    let aktiv = true;
    void (async () => {
      // Alles, was kein lesbarer Stand zum heutigen Itemsatz ist, heisst „kein
      // Profil": nichts gespeichert, unlesbar, fremder Satz, Speicher kaputt.
      let naechster: Zustand = { art: 'keins' };
      try {
        const stand = liesProfil(await ablage.einstellung(SCHLUESSEL_PROFIL));
        const auswertung = stand === null ? null : werteAus(stand);
        if (stand !== null && auswertung !== null) {
          naechster = { art: 'da', auswertung, erhoben: stand.erhoben };
        }
      } catch (fehler) {
        console.warn('[profil] Lesen fehlgeschlagen:', fehler);
      }
      if (aktiv) setZustand(naechster);
    })();
    return () => {
      aktiv = false;
    };
  }, [ablage]);

  if (zustand.art === 'laden') return <p className="profil-laden">Dein Profil wird geladen …</p>;

  if (zustand.art === 'keins') {
    return (
      <div className="karte profil-leer">
        <p className="profil-leer-satz">Auf diesem Gerät liegt noch kein Lernprofil.</p>
        <p>
          Das Audit ist ein Angebot: 26 Aussagen und drei Vorlieben, etwa vier Minuten. Es fragt nach Gewohnheiten,
          nicht nach einem Typ — und nichts in der App hängt davon ab, dass du es machst.
        </p>
        {anlegen}
      </div>
    );
  }

  return <Ergebnisansicht auswertung={zustand.auswertung} erhoben={zustand.erhoben} jetzt={jetzt} erneut={erneut} />;
}
```

- [ ] **Schritt 4: Test laufen lassen**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && npx vitest run tests/profil-ergebnis.test.tsx 2>&1 | grep -E "Tests |×"
```
Erwartet: `Tests  25 passed (25)`.

- [ ] **Schritt 5: Mutationsprobe — der Beipackzettel rutscht in einen Zweig**

Das ist der Fehler, der wirklich passiert: Jemand räumt die Ansicht auf und stellt den Beipackzettel „zum Muster". Ersetze in `Ergebnisansicht` vorübergehend

```tsx
      <aside className="beipackzettel">
        <h2>Was dieses Profil ist — und was nicht</h2>
        <p>{BEIPACKZETTEL}</p>
      </aside>
```

durch

```tsx
      {lernmuster?.art === 'eindeutig' && (
        <aside className="beipackzettel">
          <h2>Was dieses Profil ist — und was nicht</h2>
          <p>{BEIPACKZETTEL}</p>
        </aside>
      )}
```

und lass den Test laufen. Erwartet: **genau drei** Tests schlagen fehl, alle in `Ergebnisansicht`:

1. „zeigt „zwischen A und B" mit beiden Erklaerungen — und dem Beipackzettel"
2. „behauptet ohne erhobenes Muster keines — der Beipackzettel steht trotzdem da"
3. „zeigt NIE ein Muster ohne den Beipackzettel"

Grün bleiben der Test zum eindeutigen Muster, der zum Strukturhinweis (er benutzt ein eindeutiges Muster) und alle Tests der Insel (ihr gespeicherter Stand ist eindeutig anwendungsorientiert). Änderung zurücknehmen, dann:

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && (grep -c "art === 'eindeutig' &&" src/profil/Ergebnis.tsx || true) && npx vitest run tests/profil-ergebnis.test.tsx 2>&1 | grep -E "Tests |×"
```
Erwartet: `0`, dann `Tests  25 passed (25)`.

- [ ] **Schritt 6: Typen prüfen und committen**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && python -c "import sys; print(sum(open(f,'rb').read().count(b'\x00') for f in sys.argv[1:]))" src/profil/Ergebnis.tsx tests/profil-ergebnis.test.tsx && npm run check 2>&1 | grep -E "^- [0-9]+ error" && git add src/profil/Ergebnis.tsx tests/profil-ergebnis.test.tsx && git commit -q -F - <<'MSG'
feat: Ergebnisseite des Lernprofils

Das Muster mit dem Wort derzeit, zwei Saetze dazu und der Satz zur
Momentaufnahme; sechs Balken mit Zahl statt nur Farbe; je Schwachstelle
ein Vorschlag im Wortlaut, ohne Schwachstelle keiner; der Beipackzettel
in Lesegroesse; Neu erheben mit dem Hinweis ab acht Wochen.

Der Beipackzettel steht ohne Bedingung in der Ansicht. Ein Test rendert
sechzig durchgezaehlte Antwortsaetze und prueft an jedem, dass kein
Muster ohne ihn dasteht - und dass die Schleife eindeutige,
unentschiedene und leere Muster wirklich gesehen hat. Mutationsprobe:
Rutscht der Beipackzettel in den Zweig des eindeutigen Musters, fallen
genau drei Tests.

Die Insel liest, prueft und rechnet; sie schreibt nie. Unlesbar, fremder
Itemsatz, mitgebrachtes Ergebnis, werfender Speicher: alles heisst kein
Profil, nichts davon stuerzt ab. Verweise kommen als Slots herein - die
Insel kennt keine Adressen.

<CO-AUTHORED-BY>
MSG
```
Erwartet: `0`, `- 0 errors`, danach ein Commit.

---

## Aufgabe 6: Die Frage mit Einfachwahl — `Wahlfrage`

**Dateien:**
- Neu: `src/profil/Audit.tsx` (zunächst nur `Wahlfrage`)
- Test: `tests/profil-audit.test.tsx` (zunächst nur die fünf Tests zu `Wahlfrage`)

Ein kleines, für sich prüfbares Stück wie `Zuversicht.tsx` — eine Frage, mehrere Optionen, eine Wahl. Das Audit benutzt es für die 26 Aussagen und für die drei Vorlieben. Aufgabe 7 ersetzt beide Dateien durch ihre vollständige Fassung; `Wahlfrage` und ihre fünf Tests bleiben dabei Zeichen für Zeichen gleich.

- [ ] **Schritt 1: Den fehlschlagenden Test schreiben**

`tests/profil-audit.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Wahlfrage } from '../src/profil/Audit';

/**
 * jsdom kennt `CSS.escape` nicht. user-event braucht es, um bei einer Pfeiltaste
 * die Felder EINER Radiogruppe zu finden (`input[name="..."]`) — ohne diese
 * Zeilen wirft jede Pfeiltaste auf einem Radiofeld mit Namen. Im Browser gibt
 * es die Funktion; das hier schliesst eine Luecke der Testumgebung, nicht der
 * Komponente. Die Namen der Felder bestehen nur aus Kleinbuchstaben, Ziffern
 * und Bindestrich — zu maskieren gibt es an ihnen nichts.
 */
const fenster = document.defaultView;
if (fenster !== null && typeof fenster.CSS === 'undefined') {
  Object.defineProperty(fenster, 'CSS', { value: { escape: (wert: string) => wert } });
}

type Nutzer = ReturnType<typeof userEvent.setup>;

/**
 * `delay: null` statt der Voreinstellung 0: Mit 0 wartet user-event nach jedem
 * Teilschritt auf einen Zeitgeber, und der feuert unter Windows fruehestens
 * nach rund 15 ms — bei ueber hundert Tastendruecken sind das Sekunden reiner
 * Wartezeit. Die Reihenfolge der Ereignisse bleibt dieselbe.
 */
function neuerNutzer(): Nutzer {
  return userEvent.setup({ delay: null });
}

function frage(text: string): HTMLElement {
  return screen.getByRole('group', { name: text });
}

/** Das Radiofeld, dessen Name mit `anfang` beginnt: `4` fuer „4 — trifft eher zu". */
function feld(gruppe: HTMLElement, anfang: string | number): HTMLInputElement {
  return within(gruppe).getByRole('radio', { name: new RegExp(`^${anfang}( |$)`) }) as HTMLInputElement;
}

describe('Wahlfrage', () => {
  const optionen = [
    { wert: 1, text: '1 — trifft gar nicht zu', kurz: '1' },
    { wert: 4, text: '4 — trifft eher zu', kurz: '4' },
  ];

  it('ist eine Gruppe mit der Frage als Namen und einem Radiofeld je Option', () => {
    render(<Wahlfrage name="a" frage="Ich lerne abends." optionen={optionen} gewaehlt={undefined} beiWahl={() => {}} klasse="skala" />);
    const gruppe = frage('Ich lerne abends.');
    expect(within(gruppe).getAllByRole('radio')).toHaveLength(2);
    // Sichtbar ist nur die Zahl, vorgelesen wird die ganze Stufe.
    expect(feld(gruppe, 4).getAttribute('aria-label')).toBe('4 — trifft eher zu');
    expect(feld(gruppe, 4).checked).toBe(false);
  });

  it('meldet den WERT der gewaehlten Option, nicht ihren Text oder ihre Stelle', async () => {
    const nutzer = neuerNutzer();
    const beiWahl = vi.fn();
    render(<Wahlfrage name="a" frage="Ich lerne abends." optionen={optionen} gewaehlt={undefined} beiWahl={beiWahl} klasse="skala" />);

    await nutzer.click(feld(frage('Ich lerne abends.'), 4));

    expect(beiWahl).toHaveBeenCalledTimes(1);
    expect(beiWahl).toHaveBeenCalledWith(4);
  });

  it('zeigt die Wahl am Feld und an seiner Flaeche', () => {
    render(<Wahlfrage name="a" frage="Ich lerne abends." optionen={optionen} gewaehlt={4} beiWahl={() => {}} klasse="skala" />);
    const gruppe = frage('Ich lerne abends.');
    expect(feld(gruppe, 4).checked).toBe(true);
    expect(feld(gruppe, 1).checked).toBe(false);
    expect(feld(gruppe, 4).closest('label')?.getAttribute('data-gewaehlt')).toBe('true');
    expect(feld(gruppe, 1).closest('label')?.getAttribute('data-gewaehlt')).toBe('false');
  });

  it('haelt die Felder zweier Fragen auseinander', () => {
    // Teilten sich zwei Fragen einen `name`, waeren sie EINE Radiogruppe: Die
    // Pfeiltasten liefen von einer Aussage in die naechste.
    render(
      <>
        <Wahlfrage name="a" frage="Erste" optionen={optionen} gewaehlt={4} beiWahl={() => {}} klasse="skala" />
        <Wahlfrage name="b" frage="Zweite" optionen={optionen} gewaehlt={1} beiWahl={() => {}} klasse="skala" />
      </>,
    );
    expect(feld(frage('Erste'), 4).name).toBe('a');
    expect(feld(frage('Zweite'), 4).name).toBe('b');
    expect(feld(frage('Erste'), 4).checked).toBe(true);
    expect(feld(frage('Zweite'), 1).checked).toBe(true);
  });

  it('laesst sich mit Leertaste und Pfeiltaste bedienen', async () => {
    const nutzer = neuerNutzer();
    const beiWahl = vi.fn();
    render(<Wahlfrage name="a" frage="Ich lerne abends." optionen={optionen} gewaehlt={undefined} beiWahl={beiWahl} klasse="skala" />);

    await nutzer.tab();
    expect(document.activeElement).toBe(feld(frage('Ich lerne abends.'), 1));
    await nutzer.keyboard('[Space]');
    expect(beiWahl).toHaveBeenLastCalledWith(1);
    await nutzer.keyboard('{ArrowRight}');
    expect(beiWahl).toHaveBeenLastCalledWith(4);
  });
});
```

- [ ] **Schritt 2: Test laufen lassen, Fehlschlag ansehen**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && npx vitest run tests/profil-audit.test.tsx 2>&1 | tail -8
```
Erwartet: FAIL mit `Failed to resolve import "../src/profil/Audit"`.

- [ ] **Schritt 3: Die Komponente anlegen**

`src/profil/Audit.tsx`:

```tsx
import type { ReactNode } from 'react';

export type WahlfrageProps<W extends string | number> = {
  /** Eindeutig je Frage — wird zum `name` der Radiogruppe. */
  name: string;
  frage: string;
  optionen: readonly { readonly wert: W; readonly text: string; readonly kurz?: string }[];
  gewaehlt: W | undefined;
  beiWahl: (wert: W) => void;
  /** Zusatzklasse fuer die Anordnung: `skala` nebeneinander, `liste` untereinander. */
  klasse: 'skala' | 'liste';
  /** Steht unter den Feldern, etwa die Enden einer Skala. */
  fuss?: ReactNode;
};

/**
 * Eine Frage mit Einfachwahl — fuer die Aussagen wie fuer die Vorlieben.
 *
 * Echte Radiofelder und kein `role="group"` aus Knoepfen wie bei der
 * Zuversicht: Dort loest jeder Druck sofort etwas aus, hier wird eine Wahl
 * getroffen, die stehen bleibt und sich aendern laesst. Genau das ist ein
 * Radiofeld, und es bringt die Tastatur mit: ein Tabstopp je Frage, Pfeiltasten
 * wechseln die Wahl. Bei bis zu sechs Aussagen zu je fuenf Stufen waeren
 * Knoepfe dreissig Tabstopps je Gruppe.
 *
 * `fieldset` und `legend` ergeben von selbst eine Gruppe mit der Frage als
 * Namen. Der Name jedes Feldes steht in `aria-label`, weil auf der Skala nur
 * die Zahl sichtbar ist — vorgelesen wird „4 — trifft eher zu".
 */
export function Wahlfrage<W extends string | number>({
  name,
  frage,
  optionen,
  gewaehlt,
  beiWahl,
  klasse,
  fuss,
}: WahlfrageProps<W>) {
  return (
    <fieldset className={`wahlfrage ${klasse}`}>
      <legend>{frage}</legend>
      <div className="wahlfelder">
        {optionen.map((option) => (
          <label key={String(option.wert)} className="wahlfeld" data-gewaehlt={option.wert === gewaehlt}>
            <input
              type="radio"
              name={name}
              value={String(option.wert)}
              aria-label={option.text}
              checked={option.wert === gewaehlt}
              onChange={() => beiWahl(option.wert)}
            />
            <span aria-hidden="true">{option.kurz ?? option.text}</span>
          </label>
        ))}
      </div>
      {fuss}
    </fieldset>
  );
}
```

- [ ] **Schritt 4: Test laufen lassen**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && npx vitest run tests/profil-audit.test.tsx 2>&1 | grep -E "Tests |×"
```
Erwartet: `Tests  5 passed (5)`.

Wirft der letzte Test `Cannot read properties of undefined (reading 'escape')`, fehlen die Zeilen zu `CSS.escape` am Kopf der Testdatei — siehe „Was jeder Ausführende wissen muss".

- [ ] **Schritt 5: Typen prüfen und committen**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && python -c "import sys; print(sum(open(f,'rb').read().count(b'\x00') for f in sys.argv[1:]))" src/profil/Audit.tsx tests/profil-audit.test.tsx && npm run check 2>&1 | grep -E "^- [0-9]+ error" && git add src/profil/Audit.tsx tests/profil-audit.test.tsx && git commit -q -F - <<'MSG'
feat: Wahlfrage - Einfachwahl aus echten Radiofeldern

Eine Frage, mehrere Optionen, eine Wahl, die stehen bleibt und sich
aendern laesst. Echte Radiofelder und keine Knopfgruppe wie bei der
Zuversicht: Dort loest jeder Druck sofort aus, hier nicht. Das Radiofeld
bringt die Tastatur mit - ein Tabstopp je Frage, Pfeiltasten wechseln.
Dreissig Knoepfe je Gruppe waeren dreissig Tabstopps.

fieldset und legend ergeben die Gruppe mit der Frage als Namen. Auf der
Skala ist nur die Zahl sichtbar; vorgelesen wird die ganze Stufe.

jsdom kennt CSS.escape nicht, user-event braucht es fuer Pfeiltasten in
einer benannten Radiogruppe. Die Testdatei schliesst diese Luecke der
Testumgebung in ihren ersten Zeilen.

<CO-AUTHORED-BY>
MSG
```
Erwartet: `0`, `- 0 errors`, danach ein Commit.

---

## Aufgabe 7: Das Audit — die Insel

**Dateien:**
- Ändern (ganz ersetzen): `src/profil/Audit.tsx`, `tests/profil-audit.test.tsx`

Drei Zusicherungen bestimmen den Bau, und jede hat ihre Tests: Alles ist ein Angebot („Weiter" geht immer). Der Zwischenstand bleibt liegen (mit `spion()` **und** einmal am echten IndexedDB über `fake-indexeddb`, mit eigenem Datenbanknamen wie in `tests/speicher.test.ts`). Der Speicher hält den Ablauf nie auf — beim Lesen nicht und beim Schreiben nicht: erst die Anzeige, dann das Schreiben, wie in `Aufgabe.tsx`.

- [ ] **Schritt 1: Die Testdatei durch die vollständige Fassung ersetzen**

Die fünf Tests zu `Wahlfrage` bleiben unverändert, neunzehn kommen dazu. `tests/profil-audit.test.tsx`, ganz:

```tsx
import 'fake-indexeddb/auto';

import { describe, it, expect, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Audit, { Wahlfrage } from '../src/profil/Audit';
import { BEIPACKZETTEL } from '../src/profil/Ergebnis';
import { GRUPPEN, GRUPPENGROESSEN, ITEMS } from '../src/profil/items';
import { ProfilstandSchema } from '../src/profil/schema';
import { idbOeffner, speicher as echterSpeicher, type Speicher } from '../src/tutor/speicher';

/**
 * jsdom kennt `CSS.escape` nicht. user-event braucht es, um bei einer Pfeiltaste
 * die Felder EINER Radiogruppe zu finden (`input[name="..."]`) — ohne diese
 * Zeilen wirft jede Pfeiltaste auf einem Radiofeld mit Namen. Im Browser gibt
 * es die Funktion; das hier schliesst eine Luecke der Testumgebung, nicht der
 * Komponente. Die Namen der Felder bestehen nur aus Kleinbuchstaben, Ziffern
 * und Bindestrich — zu maskieren gibt es an ihnen nichts.
 */
const fenster = document.defaultView;
if (fenster !== null && typeof fenster.CSS === 'undefined') {
  Object.defineProperty(fenster, 'CSS', { value: { escape: (wert: string) => wert } });
}

/**
 * Das Audit braucht je Durchlauf Dutzende Bedienschritte, und jeder kostet unter
 * jsdom einige zehn Millisekunden. Auf einem Rechner, auf dem nebenher andere
 * Laeufe arbeiten, reichen die ueblichen fuenf Sekunden dann nicht sicher — und
 * ein Test, der nur unter Last scheitert, ist ein Geisterfehler.
 */
vi.setConfig({ testTimeout: 20_000 });

const JETZT = '2026-09-19T10:00:00.000Z';
const uhr = () => new Date(JETZT);

type Nutzer = ReturnType<typeof userEvent.setup>;

/**
 * `delay: null` statt der Voreinstellung 0: Mit 0 wartet user-event nach jedem
 * Teilschritt auf einen Zeitgeber, und der feuert unter Windows fruehestens
 * nach rund 15 ms — bei ueber hundert Tastendruecken sind das Sekunden reiner
 * Wartezeit. Die Reihenfolge der Ereignisse bleibt dieselbe.
 */
function neuerNutzer(): Nutzer {
  return userEvent.setup({ delay: null });
}

/** Die Aussage an Stelle `stelle` der Gruppe `gruppe` — in der Reihenfolge, in der das Audit fragt. */
function aussage(gruppe: number, stelle: number) {
  const item = GRUPPEN[gruppe]?.[stelle];
  if (item === undefined) throw new Error(`Keine Aussage ${gruppe}/${stelle}.`);
  return item;
}

function frage(text: string): HTMLElement {
  return screen.getByRole('group', { name: text });
}

/** Das Radiofeld, dessen Name mit `anfang` beginnt: `4` fuer „4 — trifft eher zu". */
function feld(gruppe: HTMLElement, anfang: string | number): HTMLInputElement {
  return within(gruppe).getByRole('radio', { name: new RegExp(`^${anfang}( |$)`) }) as HTMLInputElement;
}

/**
 * Ueber die Beschriftung gesucht, nicht ueber `getByRole`: Die Rollensuche
 * rechnet fuer jedes der dreissig Radiofelder Sichtbarkeit und Namen aus und
 * kostet hier je Aufruf rund 40 ms. Ein `<button>` ist ein Knopf — an seiner
 * Rolle gibt es nichts zu pruefen.
 */
function knopf(name: string): HTMLButtonElement {
  const gefunden = [...document.querySelectorAll('button')].find((b) => b.textContent === name);
  if (gefunden === undefined) throw new Error(`Kein Knopf „${name}".`);
  return gefunden;
}

function kopf(): string | null {
  return document.querySelector('.audit-kopf')?.textContent ?? null;
}

/**
 * Ein Speicher, der mitschreibt UND behaelt — dieselbe Naht wie `spion()` in
 * `tests/aufgabe.test.tsx`, nur mit Gedaechtnis, weil das Audit seinen
 * Zwischenstand wieder liest. Hier ist die Attrappe richtig: Geprueft wird,
 * WAS das Audit der Speicherschicht uebergibt. Dass IndexedDB es behaelt,
 * prueft der letzte Test dieser Datei am echten Speicher.
 */
function spion(teil: Partial<Speicher> = {}, anfang: Record<string, unknown> = {}) {
  const ablage = new Map<string, unknown>(Object.entries(anfang));
  const geschrieben: { schluessel: string; wert: unknown }[] = [];
  const speicher: Speicher = {
    merkeEreignis: async () => true,
    ereignisse: async () => [],
    merkeKarte: async () => true,
    karte: async () => null,
    karten: async () => [],
    einstellung: async (schluessel) => ablage.get(schluessel),
    merkeEinstellung: async (schluessel, wert) => {
      geschrieben.push({ schluessel, wert });
      ablage.set(schluessel, wert);
      return true;
    },
    alsJson: async () => '{}',
    schliessen: async () => {},
    ...teil,
  };
  return { speicher, ablage, geschrieben };
}

async function zuDenVorlieben(nutzer: Nutzer): Promise<void> {
  for (let i = 0; i < GRUPPENGROESSEN.length; i++) await nutzer.click(knopf('Weiter'));
}

async function waehleVorlieben(nutzer: Nutzer): Promise<void> {
  await nutzer.click(feld(frage('Womit steigst du lieber ein?'), 'Beispiel zuerst'));
  await nutzer.click(feld(frage('Wie lang darf eine Sitzung sein?'), '10 Minuten'));
  await nutzer.click(feld(frage('Was liest du lieber?'), 'egal'));
}

/** Der kuerzeste Weg zum Ergebnis: jede Aussage uebersprungen, drei Vorlieben gewaehlt. */
async function bisZumErgebnis(nutzer: Nutzer): Promise<void> {
  await zuDenVorlieben(nutzer);
  await waehleVorlieben(nutzer);
  await nutzer.click(knopf('Ergebnis ansehen'));
}

describe('Wahlfrage', () => {
  const optionen = [
    { wert: 1, text: '1 — trifft gar nicht zu', kurz: '1' },
    { wert: 4, text: '4 — trifft eher zu', kurz: '4' },
  ];

  it('ist eine Gruppe mit der Frage als Namen und einem Radiofeld je Option', () => {
    render(<Wahlfrage name="a" frage="Ich lerne abends." optionen={optionen} gewaehlt={undefined} beiWahl={() => {}} klasse="skala" />);
    const gruppe = frage('Ich lerne abends.');
    expect(within(gruppe).getAllByRole('radio')).toHaveLength(2);
    // Sichtbar ist nur die Zahl, vorgelesen wird die ganze Stufe.
    expect(feld(gruppe, 4).getAttribute('aria-label')).toBe('4 — trifft eher zu');
    expect(feld(gruppe, 4).checked).toBe(false);
  });

  it('meldet den WERT der gewaehlten Option, nicht ihren Text oder ihre Stelle', async () => {
    const nutzer = neuerNutzer();
    const beiWahl = vi.fn();
    render(<Wahlfrage name="a" frage="Ich lerne abends." optionen={optionen} gewaehlt={undefined} beiWahl={beiWahl} klasse="skala" />);

    await nutzer.click(feld(frage('Ich lerne abends.'), 4));

    expect(beiWahl).toHaveBeenCalledTimes(1);
    expect(beiWahl).toHaveBeenCalledWith(4);
  });

  it('zeigt die Wahl am Feld und an seiner Flaeche', () => {
    render(<Wahlfrage name="a" frage="Ich lerne abends." optionen={optionen} gewaehlt={4} beiWahl={() => {}} klasse="skala" />);
    const gruppe = frage('Ich lerne abends.');
    expect(feld(gruppe, 4).checked).toBe(true);
    expect(feld(gruppe, 1).checked).toBe(false);
    expect(feld(gruppe, 4).closest('label')?.getAttribute('data-gewaehlt')).toBe('true');
    expect(feld(gruppe, 1).closest('label')?.getAttribute('data-gewaehlt')).toBe('false');
  });

  it('haelt die Felder zweier Fragen auseinander', () => {
    // Teilten sich zwei Fragen einen `name`, waeren sie EINE Radiogruppe: Die
    // Pfeiltasten liefen von einer Aussage in die naechste.
    render(
      <>
        <Wahlfrage name="a" frage="Erste" optionen={optionen} gewaehlt={4} beiWahl={() => {}} klasse="skala" />
        <Wahlfrage name="b" frage="Zweite" optionen={optionen} gewaehlt={1} beiWahl={() => {}} klasse="skala" />
      </>,
    );
    expect(feld(frage('Erste'), 4).name).toBe('a');
    expect(feld(frage('Zweite'), 4).name).toBe('b');
    expect(feld(frage('Erste'), 4).checked).toBe(true);
    expect(feld(frage('Zweite'), 1).checked).toBe(true);
  });

  it('laesst sich mit Leertaste und Pfeiltaste bedienen', async () => {
    const nutzer = neuerNutzer();
    const beiWahl = vi.fn();
    render(<Wahlfrage name="a" frage="Ich lerne abends." optionen={optionen} gewaehlt={undefined} beiWahl={beiWahl} klasse="skala" />);

    await nutzer.tab();
    expect(document.activeElement).toBe(feld(frage('Ich lerne abends.'), 1));
    await nutzer.keyboard('[Space]');
    expect(beiWahl).toHaveBeenLastCalledWith(1);
    await nutzer.keyboard('{ArrowRight}');
    expect(beiWahl).toHaveBeenLastCalledWith(4);
  });
});

describe('Audit — der Ablauf', () => {
  it('beginnt mit den ersten sechs Aussagen in der gemischten Reihenfolge', () => {
    render(<Audit speicher={spion().speicher} uhr={uhr} />);
    expect(kopf()).toBe('Aussagen 1 bis 6 von 26');
    expect(screen.getAllByRole('group').map((g) => g.querySelector('legend')?.textContent)).toEqual(
      GRUPPEN[0]?.map((item) => item.text),
    );
    expect(screen.queryByRole('button', { name: 'Zurück' })).toBeNull();
  });

  it('geht auch ohne eine einzige Antwort weiter — das Audit ist ein Angebot', async () => {
    const nutzer = neuerNutzer();
    render(<Audit speicher={spion().speicher} uhr={uhr} />);

    await nutzer.click(knopf('Weiter'));
    expect(kopf()).toBe('Aussagen 7 bis 11 von 26');
    await nutzer.click(knopf('Weiter'));
    await nutzer.click(knopf('Weiter'));
    await nutzer.click(knopf('Weiter'));
    expect(kopf()).toBe('Aussagen 22 bis 26 von 26');
    await nutzer.click(knopf('Weiter'));
    expect(kopf()).toBe('Drei Vorlieben');
  });

  it('fuehrt mit Zurück in die vorige Gruppe und behaelt die Antworten', async () => {
    const nutzer = neuerNutzer();
    render(<Audit speicher={spion().speicher} uhr={uhr} />);

    await nutzer.click(feld(frage(aussage(0, 0).text), 4));
    await nutzer.click(knopf('Weiter'));
    await nutzer.click(knopf('Zurück'));

    expect(kopf()).toBe('Aussagen 1 bis 6 von 26');
    expect(feld(frage(aussage(0, 0).text), 4).checked).toBe(true);
    expect(screen.getByText(/1 von 26 Aussagen beantwortet/)).toBeTruthy();
  });

  it('gibt das Ergebnis erst frei, wenn alle drei Vorlieben gewaehlt sind', async () => {
    const nutzer = neuerNutzer();
    render(<Audit speicher={spion().speicher} uhr={uhr} />);
    await zuDenVorlieben(nutzer);

    expect(knopf('Ergebnis ansehen').disabled).toBe(true);
    expect(screen.getByText('Noch 3 von drei Vorlieben offen.')).toBeTruthy();

    await nutzer.click(feld(frage('Womit steigst du lieber ein?'), 'Beispiel zuerst'));
    await nutzer.click(feld(frage('Wie lang darf eine Sitzung sein?'), '10 Minuten'));
    expect(knopf('Ergebnis ansehen').disabled).toBe(true);
    expect(screen.getByText('Noch 1 von drei Vorlieben offen.')).toBeTruthy();

    await nutzer.click(feld(frage('Was liest du lieber?'), 'egal'));
    expect(knopf('Ergebnis ansehen').disabled).toBe(false);
    expect(screen.queryByText(/Vorlieben offen/)).toBeNull();
  });

  it('zeigt am Ende das Ergebnis an Ort und Stelle — mit Beipackzettel', async () => {
    const nutzer = neuerNutzer();
    render(<Audit speicher={spion().speicher} uhr={uhr} />);
    // Beide Aussagen zu „anwendungsorientiert" mit 5: ein eindeutiges Muster.
    for (let g = 0; g < GRUPPEN.length; g++) {
      for (const item of GRUPPEN[g] ?? []) {
        if (item.dimension === 'anwendungsorientiert') await nutzer.click(feld(frage(item.text), 5));
      }
      await nutzer.click(knopf('Weiter'));
    }
    await waehleVorlieben(nutzer);
    await nutzer.click(knopf('Ergebnis ansehen'));

    expect(kopf()).toBe('Dein Ergebnis');
    expect(screen.getByText('Dein Lernmuster ist derzeit anwendungsorientiert.')).toBeTruthy();
    expect(screen.getByText(BEIPACKZETTEL)).toBeTruthy();
    expect(screen.queryByRole('radio')).toBeNull();
  });

  it('setzt den Fokus beim Schrittwechsel auf die Ueberschrift — aber nicht beim Laden', async () => {
    const nutzer = neuerNutzer();
    render(<Audit speicher={spion().speicher} uhr={uhr} />);
    // Beim Laden stiehlt das Audit keinen Fokus.
    expect(document.activeElement).toBe(document.body);

    await nutzer.click(knopf('Weiter'));
    // Die alte Gruppe ist weg. Bliebe der Fokus auf „Weiter" am Seitenende,
    // muesste die Tastatur rueckwaerts durch die neue Gruppe.
    expect(document.activeElement).toBe(document.querySelector('.audit-kopf'));
    expect(document.activeElement?.textContent).toBe('Aussagen 7 bis 11 von 26');
  });

  it('traegt den ganzen Ablauf ohne Maus', async () => {
    const nutzer = neuerNutzer();
    const { speicher, ablage } = spion();
    render(<Audit speicher={speicher} uhr={uhr} />);

    /** Tab, bis der Knopf den Fokus hat — hoechstens ein paar Stationen weit. */
    async function tabBis(name: string): Promise<void> {
      const ziel = knopf(name);
      for (let i = 0; i < 8 && document.activeElement !== ziel; i++) await nutzer.tab();
      expect(document.activeElement).toBe(ziel);
    }

    // Die erste Aussage mit allem, was die Tastatur kann: Tab fuehrt hinein,
    // die Leertaste waehlt die 1, zwei Pfeile weiter steht die 3.
    await nutzer.tab();
    expect(document.activeElement).toBe(feld(frage(aussage(0, 0).text), 1));
    await nutzer.keyboard('[Space]{ArrowRight}{ArrowRight}');
    expect(feld(frage(aussage(0, 0).text), 3).checked).toBe(true);

    // Alle uebrigen: Tab in die naechste Aussage, Leertaste.
    for (const [g, groesse] of GRUPPENGROESSEN.entries()) {
      for (let i = g === 0 ? 1 : 0; i < groesse; i++) {
        await nutzer.tab();
        await nutzer.keyboard('[Space]');
      }
      await tabBis('Weiter');
      await nutzer.keyboard('{Enter}');
      // Der Fokus steht jetzt auf der Ueberschrift; der naechste Tab fuehrt in
      // die erste Aussage der neuen Gruppe, nicht zurueck an den Seitenanfang.
      expect(document.activeElement).toBe(document.querySelector('.audit-kopf'));
    }

    expect(kopf()).toBe('Drei Vorlieben');
    for (let i = 0; i < 3; i++) {
      await nutzer.tab();
      await nutzer.keyboard('[Space]');
    }
    await tabBis('Ergebnis ansehen');
    await nutzer.keyboard('{Enter}');

    expect(kopf()).toBe('Dein Ergebnis');
    expect(document.activeElement).toBe(document.querySelector('.audit-kopf'));
    await waitFor(() => expect(ablage.get('profil')).toBeTruthy());
    const stand = ProfilstandSchema.parse(ablage.get('profil'));
    expect(Object.keys(stand.antworten).sort()).toEqual(ITEMS.map((item) => item.id).sort());
    expect(stand.antworten[aussage(0, 0).id]).toBe(3);
    expect(Object.values(stand.antworten).filter((wert) => wert === 1)).toHaveLength(ITEMS.length - 1);
    expect(stand.vorlieben).toEqual({ einstieg: 'ueberblick', minuten: 5, text: 'stichpunkte' });
    // Eigene Frist: rund sechzig Tastendruecke, jeder mit einem Neuaufbau unter jsdom.
  }, 30_000);
});

describe('Audit — was gespeichert wird', () => {
  it('speichert die Antworten und die Vorlieben — und kein Ergebnis', async () => {
    const nutzer = neuerNutzer();
    const { speicher, ablage } = spion();
    render(<Audit speicher={speicher} uhr={uhr} />);

    await nutzer.click(feld(frage(aussage(0, 0).text), 4));
    await nutzer.click(feld(frage(aussage(0, 1).text), 2));
    await bisZumErgebnis(nutzer);

    await waitFor(() => expect(ablage.get('profil')).toBeTruthy());
    // `toEqual` gegen das GANZE Objekt: Ein zusaetzliches Feld — ein
    // Lernmuster, ein Skalenwert — liesse den Test scheitern.
    expect(ablage.get('profil')).toEqual({
      itemsatz: 1,
      erhoben: JETZT,
      antworten: { [aussage(0, 0).id]: 4, [aussage(0, 1).id]: 2 },
      vorlieben: { einstieg: 'beispiel', minuten: 10, text: 'egal' },
    });
    expect(ProfilstandSchema.safeParse(ablage.get('profil')).success).toBe(true);
  });

  it('schreibt den Zwischenstand bei jeder Antwort fort', async () => {
    const nutzer = neuerNutzer();
    const { speicher, geschrieben } = spion();
    render(<Audit speicher={speicher} uhr={uhr} />);

    await nutzer.click(feld(frage(aussage(0, 0).text), 4));

    expect(geschrieben).toEqual([
      {
        schluessel: 'profil:entwurf',
        wert: { itemsatz: 1, antworten: { [aussage(0, 0).id]: 4 }, vorlieben: {}, schritt: 0 },
      },
    ]);
  });

  it('macht nach dem Neuladen dort weiter, wo es aufgehoert hat', async () => {
    const nutzer = neuerNutzer();
    const { speicher } = spion();
    const erste = render(<Audit speicher={speicher} uhr={uhr} />);
    await nutzer.click(feld(frage(aussage(0, 0).text), 4));
    await nutzer.click(knopf('Weiter'));
    await nutzer.click(feld(frage(aussage(1, 0).text), 2));
    erste.unmount();

    render(<Audit speicher={speicher} uhr={uhr} />);

    await waitFor(() => expect(kopf()).toBe('Aussagen 7 bis 11 von 26'));
    expect(feld(frage(aussage(1, 0).text), 2).checked).toBe(true);
    expect(screen.getByText(/2 von 26 Aussagen beantwortet/)).toBeTruthy();
    await nutzer.click(knopf('Zurück'));
    expect(feld(frage(aussage(0, 0).text), 4).checked).toBe(true);
  });

  it('wirft den Zwischenstand weg, sobald das Profil gespeichert ist', async () => {
    const nutzer = neuerNutzer();
    const { speicher, ablage, geschrieben } = spion();
    render(<Audit speicher={speicher} uhr={uhr} />);
    await bisZumErgebnis(nutzer);

    // Der Speicher kennt kein Entfernen; `null` heisst „kein Entwurf".
    await waitFor(() => expect(ablage.get('profil:entwurf')).toBeNull());
    expect(geschrieben.at(-2)?.schluessel).toBe('profil');
    expect(geschrieben.at(-1)).toEqual({ schluessel: 'profil:entwurf', wert: null });
  });

  it('verwirft einen unlesbaren Zwischenstand und faengt vorn an', async () => {
    const { speicher } = spion({}, { 'profil:entwurf': { itemsatz: 2, antworten: {}, vorlieben: {}, schritt: 3 } });
    render(<Audit speicher={speicher} uhr={uhr} />);

    await act(async () => {
      await Promise.resolve();
    });
    expect(kopf()).toBe('Aussagen 1 bis 6 von 26');
  });

  it('ueberschreibt nichts Angefasstes, wenn der Zwischenstand spaet eintrifft', async () => {
    const nutzer = neuerNutzer();
    let liefere: (wert: unknown) => void = () => {};
    const spaet = new Promise<unknown>((ok) => {
      liefere = ok;
    });
    const { speicher } = spion({ einstellung: () => spaet });
    render(<Audit speicher={speicher} uhr={uhr} />);

    await nutzer.click(feld(frage(aussage(0, 0).text), 4));
    await act(async () => {
      liefere({ itemsatz: 1, antworten: { [aussage(0, 1).id]: 2 }, vorlieben: {}, schritt: 3 });
      await spaet;
    });

    expect(kopf()).toBe('Aussagen 1 bis 6 von 26');
    expect(feld(frage(aussage(0, 0).text), 4).checked).toBe(true);
    expect(feld(frage(aussage(0, 1).text), 2).checked).toBe(false);
  });
});

describe('der Speicher haelt das Audit nie auf', () => {
  it('ist sofort bedienbar, wenn der Speicher beim Lesen gar nicht antwortet', async () => {
    const nutzer = neuerNutzer();
    const { speicher } = spion({ einstellung: () => new Promise<unknown>(() => {}) });
    render(<Audit speicher={speicher} uhr={uhr} />);

    await nutzer.click(feld(frage(aussage(0, 0).text), 5));
    expect(feld(frage(aussage(0, 0).text), 5).checked).toBe(true);
    await nutzer.click(knopf('Weiter'));
    expect(kopf()).toBe('Aussagen 7 bis 11 von 26');
  });

  it('zeigt das Ergebnis, wenn das Speichern false meldet — mit Hinweis', async () => {
    const nutzer = neuerNutzer();
    const { speicher } = spion({ merkeEinstellung: async () => false });
    render(<Audit speicher={speicher} uhr={uhr} />);
    await bisZumErgebnis(nutzer);

    expect(kopf()).toBe('Dein Ergebnis');
    expect(screen.getByText(BEIPACKZETTEL)).toBeTruthy();
    expect((await screen.findByRole('status')).textContent).toMatch(/nicht gespeichert/);
  });

  it('zeigt das Ergebnis, wenn das Speichern wirft — mit Hinweis', async () => {
    const warnung = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const nutzer = neuerNutzer();
    const { speicher } = spion({
      merkeEinstellung: () => {
        throw new Error('kein Speicher');
      },
    });
    render(<Audit speicher={speicher} uhr={uhr} />);
    await bisZumErgebnis(nutzer);

    expect(kopf()).toBe('Dein Ergebnis');
    expect((await screen.findByRole('status')).textContent).toMatch(/nicht gespeichert/);
    expect(warnung).toHaveBeenCalled();
    warnung.mockRestore();
  });

  it('zeigt das Ergebnis, wenn das Speichern gar nicht antwortet', async () => {
    // Der haerteste Fall: eine Zusage, die nie eingeloest wird. Wer die Anzeige
    // hinter das Schreiben haengte, bliebe hier fuer immer bei den Vorlieben.
    const nutzer = neuerNutzer();
    const { speicher } = spion({ merkeEinstellung: () => new Promise<boolean>(() => {}) });
    render(<Audit speicher={speicher} uhr={uhr} />);
    await bisZumErgebnis(nutzer);

    expect(kopf()).toBe('Dein Ergebnis');
    expect(screen.getByText(BEIPACKZETTEL)).toBeTruthy();
  });

  it('laesst den Zwischenstand liegen, wenn das Profil nicht gespeichert werden konnte', async () => {
    const nutzer = neuerNutzer();
    const geschrieben: string[] = [];
    const { speicher } = spion({
      merkeEinstellung: async (schluessel, wert) => {
        if (schluessel === 'profil:entwurf' && wert === null) geschrieben.push('entwurf geloescht');
        return schluessel !== 'profil';
      },
    });
    render(<Audit speicher={speicher} uhr={uhr} />);
    await bisZumErgebnis(nutzer);

    await screen.findByRole('status');
    // Nach dem Neuladen laesst sich der letzte Schritt wiederholen.
    expect(geschrieben).toEqual([]);
  });
});

describe('Audit am echten IndexedDB', () => {
  it('ueberlebt ein Neuladen und landet als gueltiger Stand im Auszug', async () => {
    const nutzer = neuerNutzer();
    const name = `audit-probe-${Date.now()}`;

    const erster = echterSpeicher(idbOeffner(name));
    const erste = render(<Audit speicher={erster} uhr={uhr} />);
    await nutzer.click(feld(frage(aussage(0, 0).text), 4));
    await nutzer.click(knopf('Weiter'));
    await waitFor(async () => expect(await erster.einstellung('profil:entwurf')).toMatchObject({ schritt: 1 }));
    erste.unmount();
    await erster.schliessen();

    const zweiter = echterSpeicher(idbOeffner(name));
    render(<Audit speicher={zweiter} uhr={uhr} />);
    await waitFor(() => expect(kopf()).toBe('Aussagen 7 bis 11 von 26'));
    await nutzer.click(knopf('Weiter'));
    await nutzer.click(knopf('Weiter'));
    await nutzer.click(knopf('Weiter'));
    await nutzer.click(knopf('Weiter'));
    await waehleVorlieben(nutzer);
    await nutzer.click(knopf('Ergebnis ansehen'));

    await waitFor(async () => expect(await zweiter.einstellung('profil:entwurf')).toBeNull());
    const gespeichert = await zweiter.einstellung('profil');
    expect(gespeichert).toEqual({
      itemsatz: 1,
      erhoben: JETZT,
      antworten: { [aussage(0, 0).id]: 4 },
      vorlieben: { einstieg: 'beispiel', minuten: 10, text: 'egal' },
    });
    // `alsJson()` nimmt das Profil von selbst mit — ohne neue Fassung des Speichers.
    const auszug = JSON.parse(await zweiter.alsJson()) as { einstellungen: Record<string, unknown> };
    expect(auszug.einstellungen.profil).toEqual(gespeichert);
    await zweiter.schliessen();
  });
});
```

- [ ] **Schritt 2: Test laufen lassen, Fehlschlag ansehen**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && npx vitest run tests/profil-audit.test.tsx 2>&1 | grep -E "Tests |Element type"  | head -3
```
Erwartet: `Tests  19 failed | 5 passed (24)`. `Audit.tsx` hat noch keinen Standardexport; React meldet `Element type is invalid … got: undefined`. Die fünf Tests zu `Wahlfrage` bleiben grün.

- [ ] **Schritt 3: `Audit.tsx` durch die vollständige Fassung ersetzen**

`src/profil/Audit.tsx`, ganz:

```tsx
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { GRUPPEN, ITEMS, ITEMSATZ, STUFEN, STUFEN_TEXT, VORLIEBEN, type Vorliebe, type Wert } from './items';
import { werteAus } from './auswertung';
import { Ergebnisansicht } from './Ergebnis';
import {
  HalbeVorliebenSchema,
  SCHLUESSEL_ENTWURF,
  SCHLUESSEL_PROFIL,
  VorliebenSchema,
  liesEntwurf,
  type Entwurf,
  type Profilstand,
} from './schema';
import { speicher as neuerSpeicher, type Speicher } from '../tutor/speicher';

/**
 * Das Audit: 26 Aussagen in fuenf Gruppen, drei Vorlieben, dann das Ergebnis.
 *
 * Drei Zusicherungen bestimmen den Bau.
 *
 * ERSTENS: Alles ist ein Angebot. Keine Aussage muss beantwortet werden —
 * „Weiter" geht immer. Die Auswertung kann damit umgehen (`null` statt 0).
 *
 * ZWEITENS: Der Zwischenstand bleibt liegen. Jede Antwort und jeder
 * Schrittwechsel schreibt den Entwurf fort; nach dem Neuladen geht es dort
 * weiter. Geschrieben wird im Vorbeigehen — auf das Schreiben wartet nichts.
 *
 * DRITTENS: Der Speicher haelt den Ablauf nie auf. Antwortet er beim Lesen
 * nicht, ist der Fragebogen trotzdem sofort bedienbar. Scheitert am Ende das
 * Speichern, steht das Ergebnis trotzdem da — nur nicht behalten, mit Hinweis.
 *
 * Gespeichert werden die ANTWORTEN. Das Ergebnis rechnet `werteAus` bei jedem
 * Oeffnen neu — hier am Ende genauso wie spaeter auf `/profil`.
 */

export type WahlfrageProps<W extends string | number> = {
  /** Eindeutig je Frage — wird zum `name` der Radiogruppe. */
  name: string;
  frage: string;
  optionen: readonly { readonly wert: W; readonly text: string; readonly kurz?: string }[];
  gewaehlt: W | undefined;
  beiWahl: (wert: W) => void;
  /** Zusatzklasse fuer die Anordnung: `skala` nebeneinander, `liste` untereinander. */
  klasse: 'skala' | 'liste';
  /** Steht unter den Feldern, etwa die Enden einer Skala. */
  fuss?: ReactNode;
};

/**
 * Eine Frage mit Einfachwahl — fuer die Aussagen wie fuer die Vorlieben.
 *
 * Echte Radiofelder und kein `role="group"` aus Knoepfen wie bei der
 * Zuversicht: Dort loest jeder Druck sofort etwas aus, hier wird eine Wahl
 * getroffen, die stehen bleibt und sich aendern laesst. Genau das ist ein
 * Radiofeld, und es bringt die Tastatur mit: ein Tabstopp je Frage, Pfeiltasten
 * wechseln die Wahl. Bei bis zu sechs Aussagen zu je fuenf Stufen waeren
 * Knoepfe dreissig Tabstopps je Gruppe.
 *
 * `fieldset` und `legend` ergeben von selbst eine Gruppe mit der Frage als
 * Namen. Der Name jedes Feldes steht in `aria-label`, weil auf der Skala nur
 * die Zahl sichtbar ist — vorgelesen wird „4 — trifft eher zu".
 */
export function Wahlfrage<W extends string | number>({
  name,
  frage,
  optionen,
  gewaehlt,
  beiWahl,
  klasse,
  fuss,
}: WahlfrageProps<W>) {
  return (
    <fieldset className={`wahlfrage ${klasse}`}>
      <legend>{frage}</legend>
      <div className="wahlfelder">
        {optionen.map((option) => (
          <label key={String(option.wert)} className="wahlfeld" data-gewaehlt={option.wert === gewaehlt}>
            <input
              type="radio"
              name={name}
              value={String(option.wert)}
              aria-label={option.text}
              checked={option.wert === gewaehlt}
              onChange={() => beiWahl(option.wert)}
            />
            <span aria-hidden="true">{option.kurz ?? option.text}</span>
          </label>
        ))}
      </div>
      {fuss}
    </fieldset>
  );
}

const STUFEN_OPTIONEN = STUFEN.map((stufe) => ({
  wert: stufe,
  text: `${stufe} — ${STUFEN_TEXT[stufe]}`,
  kurz: String(stufe),
}));

/** Der Schritt nach der letzten Aussagengruppe: die Vorlieben. */
const VORLIEBEN_SCHRITT = GRUPPEN.length;

const LEERER_ENTWURF: Entwurf = { itemsatz: ITEMSATZ, antworten: {}, vorlieben: {}, schritt: 0 };

export type AuditProps = {
  /**
   * Die Naht fuer Tests, wie in `Aufgabe.tsx`. Voreingestellt ist der echte
   * Speicher; er oeffnet erst beim ersten Zugriff, deshalb schadet der Aufruf
   * beim Vorrendern auf dem Server nicht.
   */
  speicher?: Speicher;
  /** Die Uhr fuer den Zeitpunkt der Erhebung. */
  uhr?: () => Date;
};

function standarduhr(): Date {
  return new Date();
}

export default function Audit({ speicher, uhr = standarduhr }: AuditProps) {
  const [ablage] = useState<Speicher>(() => speicher ?? neuerSpeicher());
  const [entwurf, setEntwurf] = useState<Entwurf>(LEERER_ENTWURF);
  const [fertig, setFertig] = useState<Profilstand | null>(null);
  const [nichtBehalten, setNichtBehalten] = useState(false);

  /** Sobald jemand etwas angefasst hat, ueberschreibt ein spaet eintreffender Entwurf nichts mehr. */
  const beruehrt = useRef(false);
  /** Der Fokus folgt nur einem Schrittwechsel per Knopf, nicht dem Laden der Seite. */
  const fokusFolgt = useRef(false);
  const kopf = useRef<HTMLHeadingElement>(null);

  // Den Zwischenstand holen. Der Fragebogen steht schon da und ist bedienbar:
  // Ein Speicher, der nicht antwortet, haelt hier nichts auf.
  useEffect(() => {
    let aktiv = true;
    void (async () => {
      try {
        const gespeichert = liesEntwurf(await ablage.einstellung(SCHLUESSEL_ENTWURF));
        if (aktiv && gespeichert !== null && !beruehrt.current) setEntwurf(gespeichert);
      } catch (fehler) {
        console.warn('[audit] Zwischenstand nicht lesbar:', fehler);
      }
    })();
    return () => {
      aktiv = false;
    };
  }, [ablage]);

  // Beim Schrittwechsel verschwindet die Gruppe, in der der Fokus stand. Ohne
  // diesen Sprung bliebe er auf „Weiter" am Seitenende, und die Tastatur muesste
  // rueckwaerts durch die neue Gruppe. Die Ueberschrift nimmt ihn auf und sagt
  // dabei an, wo man ist.
  useEffect(() => {
    if (!fokusFolgt.current) return;
    fokusFolgt.current = false;
    kopf.current?.focus();
  }, [entwurf.schritt, fertig]);

  /** Schreibt, ohne je zu werfen. `Speicher` kommt von aussen herein — siehe `Aufgabe.tsx`. */
  async function sichere(schluessel: string, wert: unknown): Promise<boolean> {
    try {
      return await ablage.merkeEinstellung(schluessel, wert);
    } catch (fehler) {
      console.warn('[audit] Speichern fehlgeschlagen:', fehler);
      return false;
    }
  }

  function uebernimm(naechster: Entwurf): void {
    beruehrt.current = true;
    setEntwurf(naechster);
    void sichere(SCHLUESSEL_ENTWURF, naechster);
  }

  function antworte(id: string, wert: Wert): void {
    uebernimm({ ...entwurf, antworten: { ...entwurf.antworten, [id]: wert } });
  }

  function waehleVorliebe(id: Vorliebe['id'], wert: string | number): void {
    // Geprueft statt behauptet: Der Wert kommt aus `VORLIEBEN`, die erlaubte
    // Form aus dem Schema. Ein Cast hier waere die Stelle, an der beide Listen
    // unbemerkt auseinanderlaufen.
    const befund = HalbeVorliebenSchema.safeParse({ ...entwurf.vorlieben, [id]: wert });
    if (befund.success) uebernimm({ ...entwurf, vorlieben: befund.data });
  }

  function geheZu(schritt: number): void {
    fokusFolgt.current = true;
    uebernimm({ ...entwurf, schritt });
  }

  function schliesseAb(): void {
    const vorlieben = VorliebenSchema.safeParse(entwurf.vorlieben);
    if (!vorlieben.success) return;
    const stand: Profilstand = {
      itemsatz: ITEMSATZ,
      erhoben: uhr().toISOString(),
      antworten: entwurf.antworten,
      vorlieben: vorlieben.data,
    };
    // ERST die Anzeige, DANN das Schreiben — dieselbe Reihenfolge wie in
    // `Aufgabe.tsx`. Wenn diese Zeilen durch sind, steht das Ergebnis fest, und
    // nichts, was der Speicher danach tut oder laesst, nimmt es wieder weg.
    fokusFolgt.current = true;
    setFertig(stand);
    void behalte(stand);
  }

  async function behalte(stand: Profilstand): Promise<void> {
    if (!(await sichere(SCHLUESSEL_PROFIL, stand))) {
      // Der Entwurf bleibt liegen: Nach dem Neuladen laesst sich der letzte
      // Schritt wiederholen.
      setNichtBehalten(true);
      return;
    }
    // Der Speicher kennt kein Entfernen. `null` heisst „kein Entwurf".
    await sichere(SCHLUESSEL_ENTWURF, null);
  }

  if (fertig !== null) {
    const auswertung = werteAus(fertig);
    return (
      <div className="audit">
        <h2 className="audit-kopf" ref={kopf} tabIndex={-1}>
          Dein Ergebnis
        </h2>
        {auswertung !== null && (
          <Ergebnisansicht
            auswertung={auswertung}
            erhoben={fertig.erhoben}
            jetzt={new Date(fertig.erhoben)}
            nichtBehalten={nichtBehalten}
          />
        )}
      </div>
    );
  }

  const beiVorlieben = entwurf.schritt >= VORLIEBEN_SCHRITT;
  const gruppe = GRUPPEN[entwurf.schritt] ?? [];
  const davor = GRUPPEN.slice(0, entwurf.schritt).reduce((summe, g) => summe + g.length, 0);
  const beantwortet = ITEMS.filter((item) => entwurf.antworten[item.id] !== undefined).length;
  const offeneVorlieben = VORLIEBEN.filter((vorliebe) => entwurf.vorlieben[vorliebe.id] === undefined).length;

  return (
    <div className="audit karte">
      <p className="audit-fortschritt">
        Schritt {Math.min(entwurf.schritt, VORLIEBEN_SCHRITT) + 1} von {VORLIEBEN_SCHRITT + 1} · {beantwortet} von{' '}
        {ITEMS.length} Aussagen beantwortet
      </p>
      <h2 className="audit-kopf" ref={kopf} tabIndex={-1}>
        {beiVorlieben
          ? 'Drei Vorlieben'
          : `Aussagen ${davor + 1} bis ${davor + gruppe.length} von ${ITEMS.length}`}
      </h2>

      {beiVorlieben
        ? VORLIEBEN.map((vorliebe) => (
            <Wahlfrage
              key={vorliebe.id}
              name={`vorliebe-${vorliebe.id}`}
              frage={vorliebe.frage}
              optionen={vorliebe.optionen}
              gewaehlt={entwurf.vorlieben[vorliebe.id]}
              beiWahl={(wert) => waehleVorliebe(vorliebe.id, wert)}
              klasse="liste"
            />
          ))
        : gruppe.map((item) => (
            <Wahlfrage
              key={item.id}
              name={`aussage-${item.id}`}
              frage={item.text}
              optionen={STUFEN_OPTIONEN}
              gewaehlt={entwurf.antworten[item.id]}
              beiWahl={(wert) => antworte(item.id, wert)}
              klasse="skala"
              fuss={
                <p className="skala-enden" aria-hidden="true">
                  <span>{STUFEN_TEXT[1]}</span>
                  <span>{STUFEN_TEXT[5]}</span>
                </p>
              }
            />
          ))}

      <div className="audit-knoepfe">
        {entwurf.schritt > 0 && (
          <button type="button" className="zurueck" onClick={() => geheZu(entwurf.schritt - 1)}>
            Zurück
          </button>
        )}
        {beiVorlieben ? (
          <button type="button" className="abgeben" disabled={offeneVorlieben > 0} onClick={schliesseAb}>
            Ergebnis ansehen
          </button>
        ) : (
          <button type="button" className="abgeben" onClick={() => geheZu(entwurf.schritt + 1)}>
            Weiter
          </button>
        )}
      </div>
      {beiVorlieben && offeneVorlieben > 0 && (
        <p className="audit-offen">Noch {offeneVorlieben} von drei Vorlieben offen.</p>
      )}
    </div>
  );
}
```

- [ ] **Schritt 4: Test laufen lassen**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && npx vitest run tests/profil-audit.test.tsx 2>&1 | grep -E "Tests |×"
```
Erwartet: `Tests  24 passed (24)`. Der Lauf dauert 10 bis 20 Sekunden.

- [ ] **Schritt 5: Mutationsprobe — das Ergebnis wandert mit in den Speicher**

Ergänze in `schliesseAb` vorübergehend eine Zeile, sodass der Stand sein Ergebnis mitnimmt:

```ts
      vorlieben: vorlieben.data,
      lernmuster: 'anwendungsorientiert',
    };
```

TypeScript meldet die Zeile als Fehler — das ist richtig so und stört die Probe nicht: vitest prüft keine Typen, und `npm run check` läuft erst nach dem Zurücknehmen. Lass den Test laufen. Erwartet: **genau drei** Tests schlagen fehl:

1. „Audit — der Ablauf" › „traegt den ganzen Ablauf ohne Maus" (`ProfilstandSchema.parse` weist das fremde Feld zurück)
2. „Audit — was gespeichert wird" › „speichert die Antworten und die Vorlieben — und kein Ergebnis"
3. „Audit am echten IndexedDB" › „ueberlebt ein Neuladen und landet als gueltiger Stand im Auszug"

Änderung zurücknehmen, dann:

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && (grep -c "lernmuster:" src/profil/Audit.tsx || true) && npx vitest run tests/profil-audit.test.tsx 2>&1 | grep -E "Tests |×"
```
Erwartet: `0`, dann `Tests  24 passed (24)`.

- [ ] **Schritt 6: Die ganze Suite**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && npm test 2>&1 | grep -E "Tests |Test Files |FAIL"
```
Erwartet: alles grün, **BASIS + 137** Tests (11 + 37 + 26 + 14 + 25 + 24). Die Zahl im Bericht notieren. Weicht sie ab, ist das kein Fehler für sich — aber der Grund gehört in den Bericht.

- [ ] **Schritt 7: Typen prüfen und committen**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && python -c "import sys; print(sum(open(f,'rb').read().count(b'\x00') for f in sys.argv[1:]))" src/profil/Audit.tsx tests/profil-audit.test.tsx && npm run check 2>&1 | grep -E "^- [0-9]+ error" && git add src/profil/Audit.tsx tests/profil-audit.test.tsx && git commit -q -F - <<'MSG'
feat: das Audit als Insel

26 Aussagen in fuenf Gruppen, drei Vorlieben, dann das Ergebnis an Ort
und Stelle. Keine Aussage ist Pflicht - Weiter geht immer, und die
Auswertung kann damit umgehen. Die drei Vorlieben sind es: Der
gespeicherte Typ kennt kein nicht angegeben, und eine Voreinstellung
waere eine Behauptung, die niemand aufgestellt hat.

Der Zwischenstand wird bei jeder Antwort fortgeschrieben und ueberlebt
ein Neuladen - geprueft mit einer Attrappe und einmal am echten
IndexedDB. Trifft er spaet ein, ueberschreibt er nichts Angefasstes.

Der Speicher haelt den Ablauf nie auf: Antwortet er beim Lesen nicht,
ist der Fragebogen trotzdem bedienbar. Erst die Anzeige, dann das
Schreiben - meldet es false, wirft es oder antwortet es nie, steht das
Ergebnis trotzdem da, im Fehlerfall mit Hinweis, und der Entwurf bleibt
liegen.

Gespeichert werden die Antworten. Mutationsprobe: Ein mitgespeichertes
Lernmuster faellt in genau drei Tests auf. Der ganze Ablauf traegt ohne
Maus; beim Schrittwechsel folgt der Fokus der Ueberschrift, beim Laden
nicht.

<CO-AUTHORED-BY>
MSG
```
Erwartet: `0`, `- 0 errors`, danach ein Commit.

---
## Aufgabe 8: Die Seiten und die Einladung auf der Übersicht

**Dateien:**
- Neu: `src/pages/profil/index.astro`, `src/pages/profil/audit.astro`
- Ändern (ganz ersetzen): `src/pages/index.astro`

Inseln werden mit `client:idle` eingebunden, nicht mit `client:visible` — der Grund steht im Kommentar in `src/layouts/Lektion.astro`. `src/layouts/Seite.astro` bleibt unberührt; die neuen Seiten docken über `<Seite titel="…">` an.

- [ ] **Schritt 1: Die Ergebnisseite anlegen**

`src/pages/profil/index.astro`:

```astro
---
import Seite from '../../layouts/Seite.astro';
import Ergebnis from '../../profil/Ergebnis.tsx';
---
<Seite titel="Lernprofil">
  <p class="augenbraue">Kernbohrung · Lernprofil</p>
  <h1>Dein Lernprofil</h1>

  {/*
    client:idle und nicht client:visible — der Grund steht in
    `src/layouts/Lektion.astro`: client:visible haengt an einem
    IntersectionObserver, und der feuert nicht, solange das Dokument als
    versteckt gilt. Eine Profilseite, die „wird geladen" sagt und dabei
    bleibt, waere genau dieser Ausfall.

    Die beiden Verweise stehen HIER und nicht in der Insel. Nur was im
    gebauten HTML steht, erreicht `werkzeug/relative-verweise.mjs`; ein
    Verweis, den React erst im Browser zusammensetzt, zeigte in der
    ortsunabhaengigen Kopie ins Leere. Die Insel bekommt sie als Slots
    hereingereicht und entscheidet nur, welchen sie zeigt.

    Die Slotnamen tragen mit Absicht keinen Bindestrich. Astro macht aus
    `neu-erheben` beim Vorrendern die Eigenschaft `neuErheben`, reicht
    einen beim Vorrendern NICHT gezeigten Slot im Browser aber unter dem
    rohen Namen `neu-erheben` herein — die Insel faende ihn dann nicht.
    Beide Slots hier sind beim Vorrendern nicht gezeigt: Die Insel beginnt
    mit „wird geladen".
  */}
  <Ergebnis client:idle>
    <a slot="anlegen" class="abgeben knopf-verweis" href="/profil/audit/">Lernprofil anlegen</a>
    <a slot="erneut" class="abgeben knopf-verweis" href="/profil/audit/">Neu erheben</a>
  </Ergebnis>

  <p class="profil-verweis"><a href="/">Zur Übersicht</a></p>
</Seite>
```

- [ ] **Schritt 2: Die Seite des Fragebogens anlegen**

`src/pages/profil/audit.astro`:

```astro
---
import Seite from '../../layouts/Seite.astro';
import Audit from '../../profil/Audit.tsx';
---
<Seite titel="Lernprofil anlegen">
  <p class="augenbraue">Kernbohrung · Lernprofil</p>
  <h1>Lernprofil anlegen</h1>
  <p class="vorspann">
    26 Aussagen zu deinen Lerngewohnheiten und drei Vorlieben, etwa vier Minuten. Keine Aussage
    ist Pflicht, und du kannst jederzeit aufhören: Der Zwischenstand bleibt auf diesem Gerät liegen.
  </p>

  {/* client:idle und nicht client:visible — siehe `src/layouts/Lektion.astro`. */}
  <Audit client:idle />

  {/* Der eine Verweis dieser Seite steht im Astro-Markup und nicht in der
      Insel: Nur hier erreicht ihn `werkzeug/relative-verweise.mjs`. Er heisst
      in jeder Phase gleich — waehrend des Audits ist er der Abbruch, nach dem
      Ergebnis der Weg weiter. */}
  <p class="profil-verweis"><a href="/">Zur Übersicht</a></p>
</Seite>
```

- [ ] **Schritt 3: Die Übersicht um Einladung, Verweis und Skript ergänzen**

Aufgabe 0 hat geprüft, dass `src/pages/index.astro` noch kein `<script>` trägt — die Datei ist also die bekannte mit Überschrift, Vorspann und Liste. Ersetze sie ganz. Neu sind: die Karte `data-einladung` (zunächst `hidden`), der Absatz `.profil-verweis` und das Skript am Ende. Frontmatter, Überschrift, Vorspann und Liste bleiben wörtlich.

`src/pages/index.astro`:

```astro
---
import { getCollection } from 'astro:content';
import Seite from '../layouts/Seite.astro';

const lektionen = (await getCollection('lektionen')).sort(
  (a, b) => a.data.reihenfolge - b.data.reihenfolge,
);
---
<Seite titel="Übersicht">
  <p class="augenbraue">Kernbohrung · Übersicht</p>
  <h1>Lektionen</h1>
  <p class="vorspann">
    Jede Lektion läuft in sechs Takten: Widerspruch, Bild, Satz, Probe, Transfer, Herkunft.
    Erst spielen, dann erklären.
  </p>

  {/*
    Die Einladung zum Audit. Sie steht vollstaendig im gebauten HTML — samt
    Verweis, den `werkzeug/relative-verweise.mjs` nur hier erreicht — und ist
    zunaechst versteckt. Das Skript am Seitenende deckt sie auf, wenn kein
    Profil erhoben ist. Andersherum (sichtbar bauen, bei vorhandenem Profil
    verstecken) blitzte sie bei jedem Besuch kurz auf, ausgerechnet bei denen,
    die sie nichts mehr angeht.
  */}
  <section class="karte einladung" data-einladung hidden>
    <div class="einladung-text">
      <h2>Lernprofil anlegen — etwa vier Minuten</h2>
      <p>
        26 Aussagen zu deinen Lerngewohnheiten und drei Vorlieben. Ein Angebot, keine Voraussetzung:
        Jede Lektion steht dir auch ohne Profil offen.
      </p>
    </div>
    <div class="einladung-knoepfe">
      <a class="abgeben knopf-verweis" href="/profil/audit/">Lernprofil anlegen</a>
      <button type="button" class="zurueck" data-spaeter>Später</button>
    </div>
  </section>

  <ol class="uebersicht">
    {lektionen.map((eintrag) => (
      <li>
        <a href={`/lektion/${eintrag.id}/`}>{eintrag.data.titel}</a>
        <p>{eintrag.data.prinzip}</p>
      </li>
    ))}
  </ol>

  {/* Der feste Weg zum Profil, ohne Skript: Die Karte oben verschwindet,
      sobald ein Profil da ist — dieser Verweis bleibt. */}
  <p class="profil-verweis"><a href="/profil/">Dein Lernprofil</a></p>
</Seite>

<script>
  // Astro buendelt dieses Skript; es laeuft als Modul nach dem Aufbau der
  // Seite. Die Entscheidung selbst steht in `einladungZeigen` und ist dort
  // getestet — hier wird nur gelesen, gefragt und umgeschaltet.
  import { speicher } from '../tutor/speicher';
  import { werteAus } from '../profil/auswertung';
  import { SCHLUESSEL_PROFIL, SCHLUESSEL_SPAETER, liesProfil } from '../profil/schema';
  import { einladungZeigen } from '../profil/vorschlag';

  const karte = document.querySelector<HTMLElement>('[data-einladung]');
  if (karte !== null) {
    // `speicher()` wirft nie: Ohne IndexedDB liefert jedes Lesen `undefined`,
    // und die Karte erscheint — das ist im privaten Fenster auch richtig so.
    const ablage = speicher();

    void (async () => {
      const stand = liesProfil(await ablage.einstellung(SCHLUESSEL_PROFIL));
      const erhoben = stand !== null && werteAus(stand) !== null;
      const spaeter = await ablage.einstellung(SCHLUESSEL_SPAETER);
      karte.hidden = !einladungZeigen(erhoben, spaeter, new Date());
    })();

    karte.querySelector('[data-spaeter]')?.addEventListener('click', () => {
      // Erst verstecken, dann merken: Scheitert das Schreiben, ist die Karte
      // fuer diesen Besuch trotzdem weg und kommt beim naechsten wieder.
      karte.hidden = true;
      void ablage.merkeEinstellung(SCHLUESSEL_SPAETER, new Date().toISOString());
    });
  }
</script>
```

Das Skript ist bewusst dünn und ohne eigenen Unit-Test: Die Entscheidung trifft `einladungZeigen` (Aufgabe 4, an den Grenzen getestet), gelesen wird über `liesProfil` und `werteAus` (Aufgabe 2 und 3). Was hier bleibt — lesen, fragen, `hidden` umschalten —, prüft die Abnahme am gebauten Stand.

- [ ] **Schritt 4: Typen, Bau und das gebaute HTML ansehen**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && npm run check 2>&1 | grep -E "^- [0-9]+ error" && npm run build 2>&1 | grep -E "page\(s\)|error" && grep -o 'data-astro-template="[a-z]*"' dist/profil/index.html && grep -c 'data-einladung' dist/index.html && grep -c '<script type="module"' dist/index.html && grep -c 'Aussagen 1 bis 6 von 26' dist/profil/audit/index.html
```
Erwartet: `- 0 errors` · **SEITEN + 2** `page(s) built` · `data-astro-template="anlegen"` und `data-astro-template="erneut"` (die Insel beginnt mit „wird geladen", beide Slots sind beim Vorrendern nicht gezeigt und liegen deshalb als `<template>` bei) · `1` · `1` · `1` (das Audit rendert seine erste Gruppe schon beim Bauen vor — der Fragebogen steht da, bevor das Skript lädt).

Fehlt eine der beiden `data-astro-template`-Zeilen, prüfe die Slotnamen: ohne Bindestrich, genau `anlegen` und `erneut`.

- [ ] **Schritt 5: Committen**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && python -c "import sys; print(sum(open(f,'rb').read().count(b'\x00') for f in sys.argv[1:]))" src/pages/index.astro src/pages/profil/index.astro src/pages/profil/audit.astro && git add src/pages/index.astro src/pages/profil/index.astro src/pages/profil/audit.astro && git commit -q -F - <<'MSG'
feat: Seiten /profil und /profil/audit, Einladung auf der Uebersicht

Die Uebersicht laedt zum Audit ein, solange kein Profil erhoben ist.
Die Karte steht vollstaendig im gebauten HTML und ist zunaechst
versteckt; ein kleines Skript deckt sie auf. Andersherum blitzte sie bei
jedem Besuch kurz auf - ausgerechnet bei denen, die sie nichts mehr
angeht. Spaeter heisst eine Woche Ruhe. Ein fester Verweis am Fuss der
Uebersicht fuehrt ohne Skript zum Profil.

Verweise stehen im Astro-Markup und nicht in den Inseln: Nur dort
erreicht sie relative-verweise.mjs. /profil reicht sie als Slots herein.
Die Slotnamen tragen keinen Bindestrich - Astro wandelt ihn beim
Vorrendern um, reicht einen nicht gezeigten Slot im Browser aber unter
dem rohen Namen herein.

Seite.astro bleibt unberuehrt: Ein dritter Eintrag in der Kopfleiste
braeche sie am Handy in zwei Zeilen.

<CO-AUTHORED-BY>
MSG
```
Erwartet: `0`, danach ein Commit.

---

## Aufgabe 9: Gestaltung

**Dateien:**
- Ändern: `src/styles/global.css` (nur anhängen)

Kein neues Farbtoken. Alles hängt an den vorhandenen — damit gelten die gemessenen Kontraste weiter: `--auf-fill` auf `--akzent-fill` 8,22 · `--ink-2` auf `--flaeche-2` 4,84 (hell) / 5,22 (dunkel) · `--rand-bedien` gegen alle drei Flächen ≥ 3:1.

- [ ] **Schritt 1: Den Block anhängen**

Ganz am Ende von `src/styles/global.css`, hinter dem Block der Aufgabenfamilie:

```css
/* ---------------------------------------------------------------
   Lernprofil (Teilprojekt 3a)

   Dieselben drei Regeln wie bei der Aufgabenfamilie:
   - Jede Bedienflaeche mindestens 44 x 44 Pixel, die grossen 48.
   - Umrisse bedienbarer Elemente ueber --rand-bedien (3:1, WCAG
     1.4.11), nie ueber --rand.
   - Kein neues Farbtoken. Ein Zustand, der nur Farbe traegt, ist
     keiner (WCAG 1.4.1): Die gewaehlte Stufe hat einen dickeren,
     dunklen Rand und fette Schrift, jeder Balken seine Zahl.
   --------------------------------------------------------------- */

/* Ein Verweis, der wie der Hauptknopf aussieht. `.abgeben` stammt
   aus der Aufgabenfamilie und ist fuer <button> gebaut; ein <a>
   braucht dazu nur die Anordnung und keinen Unterstrich. */
.knopf-verweis {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
}

/* Der zweite Knopf neben dem Hauptknopf — im Audit der Weg zurueck,
   auf der Uebersicht das Verschieben auf spaeter. */
.zurueck {
  min-height: 48px;
  padding: 11px 22px;
  font: inherit;
  cursor: pointer;
  color: var(--ink);
  background: var(--flaeche-2);
  border: 1px solid var(--rand-bedien);
  border-radius: var(--radius-pille);
}

.zurueck:hover {
  background: var(--flaeche);
}

/* --- die Einladung auf der Uebersicht --------------------------- */

.einladung {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 14px 22px;
  margin: 0 0 28px;
  border-left: 3px solid var(--akzent-fill);
}

/* `display: flex` schluege das hidden-Attribut sonst aus dem Feld:
   Die Karte stuende da, bevor das Skript entschieden hat. */
.einladung[hidden] {
  display: none;
}

.einladung-text {
  flex: 1 1 16rem;
  min-width: 0;
}

.einladung-text h2 {
  margin: 0 0 4px;
  font-size: 19px;
}

.einladung-text p {
  margin: 0;
  font-size: 15px;
  color: var(--ink-2);
}

.einladung-knoepfe,
.audit-knoepfe {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.einladung-knoepfe .abgeben,
.audit-knoepfe .abgeben {
  margin-top: 0;
}

.profil-verweis {
  margin: 28px 0 0;
  font-size: 15px;
}

.profil-verweis a {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
}

/* --- das Audit --------------------------------------------------- */

.audit-fortschritt {
  margin: 0 0 6px;
  font-family: var(--schrift-mono);
  font-size: 12px;
  color: var(--ink-2);
  font-variant-numeric: tabular-nums;
}

/* Die Ueberschrift nimmt beim Schrittwechsel den Fokus auf. Die
   klebende Leiste darf sie dabei nicht verdecken. */
.audit-kopf {
  scroll-margin-top: 96px;
  margin-bottom: 18px;
}

.wahlfrage {
  min-width: 0;
  margin: 0;
  padding: 18px 0 0;
  border: 0;
  border-top: 1px solid var(--rand);
}

.wahlfrage + .wahlfrage {
  margin-top: 18px;
}

.wahlfrage legend {
  float: left;
  width: 100%;
  padding: 0;
  margin: 0 0 12px;
  font-size: 17px;
  line-height: 1.4;
  text-wrap: pretty;
}

.wahlfelder {
  clear: both;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* Fuenf Stufen nebeneinander. Gerechnet fuer 375 Pixel: In der Karte
   bleiben mit dem schmalen Innenrand von unten rund 300 Pixel,
   abzueglich vier Luecken sind das rund 55 je Feld — ueber den 44,
   die eine Tippflaeche braucht. Gemessen wird in der Abnahme. */
.skala .wahlfelder {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 6px;
}

/* Das ganze Feld ist die Tippflaeche. Das Radiofeld selbst liegt
   unsichtbar darueber: Es nimmt Klick, Fokus und Tastatur an, die
   Flaeche zeigt den Zustand. */
.wahlfeld {
  position: relative;
  display: flex;
  align-items: center;
  min-height: 48px;
  padding: 11px 14px;
  cursor: pointer;
  overflow-wrap: anywhere;
  color: var(--ink);
  background: var(--flaeche-2);
  border: 1px solid var(--rand-bedien);
  border-radius: var(--radius-antwort);
}

.skala .wahlfeld {
  justify-content: center;
  padding: 0;
  font-family: var(--schrift-mono);
  font-size: 15px;
  font-weight: 600;
}

.wahlfeld input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  opacity: 0;
  cursor: pointer;
}

.wahlfeld:hover {
  background: var(--flaeche);
}

/* Nicht nur Farbe: fette Schrift und ein doppelt so kraeftiger,
   dunkler Rand. Der zweite Pixel kommt als Schatten nach innen —
   ein breiterer Rand liesse das Feld beim Antippen springen. */
.wahlfeld[data-gewaehlt='true'] {
  font-weight: 700;
  color: var(--auf-fill);
  background: var(--akzent-fill);
  border-color: var(--ink);
  box-shadow: inset 0 0 0 1px var(--ink);
}

/* Der Fokus sitzt auf dem unsichtbaren Feld; zeigen muss ihn die
   Flaeche. */
.wahlfeld:has(input:focus-visible) {
  outline: 2px solid var(--akzent);
  outline-offset: 2px;
}

.skala-enden {
  clear: both;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin: 6px 0 0;
  font-family: var(--schrift-mono);
  font-size: 11.5px;
  color: var(--ink-2);
}

.audit-knoepfe {
  margin-top: 24px;
}

.audit-offen {
  margin: 10px 0 0;
  font-size: 14.5px;
  color: var(--ink-2);
}

/* --- die Ergebnisseite ------------------------------------------- */

.profil {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.profil-laden,
.profil-erhoben {
  margin: 0;
  font-size: 15px;
  color: var(--ink-2);
}

.profil-leer-satz,
.muster-satz {
  margin: 0 0 12px;
  font-family: var(--schrift-kopf);
  font-size: 1.25rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  line-height: 1.35;
  text-wrap: pretty;
}

.muster-erklaerung {
  margin: 0 0 10px;
}

.momentaufnahme {
  margin: 12px 0 0;
  font-size: 15px;
  color: var(--ink-2);
}

.strukturhinweis,
.profil-hinweis {
  margin: 0;
  padding: 12px 15px;
  font-size: 15.5px;
  background: var(--flaeche-2);
  border-left: 3px solid var(--akzent-fill);
  border-radius: 0 var(--radius-antwort) var(--radius-antwort) 0;
}

.strukturhinweis {
  margin-top: 14px;
}

.balken,
.vorschlaege {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* Name links, Zahl rechts, Balken darunter ueber die ganze Breite —
   bei 375 Pixeln bliebe neben Name und Zahl sonst kein Balken. */
.balken-zeile {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 5px 12px;
  align-items: baseline;
}

.balken-name {
  font-weight: 700;
}

.balken-zahl {
  font-family: var(--schrift-mono);
  font-size: 13px;
  color: var(--ink-2);
  font-variant-numeric: tabular-nums;
}

.balken-spur {
  grid-column: 1 / -1;
  display: block;
  height: 10px;
  overflow: hidden;
  background: var(--flaeche-2);
  border: 1px solid var(--rand);
  border-radius: var(--radius-pille);
}

.balken-fuellung {
  display: block;
  height: 100%;
  background: var(--teal);
  border-radius: var(--radius-pille);
}

.balken-marke {
  grid-column: 1 / -1;
  font-family: var(--schrift-mono);
  font-size: 11.5px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--akzent);
}

.vorschlag {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 12px 15px;
  background: var(--teal-weich);
  border: 1px solid var(--rand);
  border-radius: var(--radius-antwort);
}

.kein-vorschlag {
  margin: 0;
  color: var(--ink-2);
}

/* Der Beipackzettel: immer sichtbar, in Lesegroesse und in der
   Textfarbe — nicht im Kleingedruckten. */
.beipackzettel {
  padding: 18px 20px;
  font-size: 16px;
  color: var(--ink);
  background: var(--flaeche);
  border: 1px solid var(--rand-stark);
  border-left: 3px solid var(--akzent-fill);
  border-radius: var(--radius-antwort);
}

.beipackzettel h2 {
  margin: 0 0 6px;
  font-size: 16.5px;
}

.beipackzettel p {
  margin: 0;
}

.profil-erneut {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
  margin-top: 6px;
}

.profil-erneut .abgeben,
.profil-leer .abgeben {
  margin-top: 0;
}

/* Am Handy zaehlt jeder Pixel der Skala: schmalerer Innenrand. */
@media (max-width: 480px) {
  .audit.karte {
    padding: 22px 16px;
  }
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
Erwartet: `alle benutzten Token stehen auf :root`, **SEITEN + 2** `page(s) built`.

- [ ] **Schritt 3: Committen**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && python -c "import sys; print(sum(open(f,'rb').read().count(b'\x00') for f in sys.argv[1:]))" src/styles/global.css && git add src/styles/global.css && git commit -q -F - <<'MSG'
feat: Gestaltung des Lernprofils

Kein neues Farbtoken - die gemessenen Kontraste gelten weiter. Jede
Bedienflaeche mindestens 44 Pixel, Umrisse ueber --rand-bedien. Das
ganze Feld einer Stufe ist die Tippflaeche; das Radiofeld liegt
unsichtbar darueber und nimmt Klick, Fokus und Tastatur an. Die
gewaehlte Stufe traegt nicht nur Farbe, sondern fette Schrift und einen
doppelt so kraeftigen Rand - als Schatten nach innen, damit das Feld
beim Antippen nicht springt.

Jeder Balken hat seine Zahl; Name und Zahl stehen ueber dem Balken,
weil bei 375 Pixeln daneben keiner bliebe. Der Beipackzettel steht in
Lesegroesse und Textfarbe. display: flex schluege das hidden-Attribut
der Einladung aus dem Feld - eine eigene Regel haelt es. Gemessen wird
in der Abnahme am gebauten Stand.

<CO-AUTHORED-BY>
MSG
```
Erwartet: `0`, danach ein Commit.

---

## Aufgabe 10: Abnahme am gebauten Stand

**Dateien:** keine Quelldateien. Behebt die Abnahme einen Fehler, bekommt die Behebung einen eigenen Commit mit Messwert vorher/nachher.

Jeder Schnipsel unten ist in eine `await (async () => { … })()`-Klammer gefasst und gibt sein Ergebnis zurück — so stoßen sich die Namen mehrerer Schnipsel auf derselben Seite nicht. **Die Datenbank wird nie von Hand geöffnet, bevor die App sie angelegt hat:** Ein blankes `indexedDB.open` legte sonst eine leere Fassung 1 ohne Speicher an, und der Aufstieg der App liefe daran vorbei. Die Schnipsel prüfen das selbst über `indexedDB.databases()`.

- [ ] **Schritt 1: Die drei Schranken, die NUL-Prüfung und das Bündel**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && npm test 2>&1 | grep -E "Tests |Test Files |FAIL" && npm run check 2>&1 | grep -E "^- [0-9]+ (error|warning)" && npm run build 2>&1 | grep -E "page\(s\)" && python -c "import sys,glob; d=[f for m in ('src/profil/*','src/pages/*.astro','src/pages/profil/*','src/styles/*','tests/profil-*') for f in glob.glob(m)]; print('NUL-Bytes:', sum(open(f,'rb').read().count(b'\x00') for f in d), 'in', len(d), 'Dateien')" && for z in $(grep -l "unrecognized_keys" dist/astro/*.js); do n=$(basename "$z"); echo "Zod in $n: $(( $(wc -c < "$z") / 1024 )) KB, von Aufgabe importiert: $(grep -c "$n" dist/astro/Aufgabe.*.js)"; done
```
Erwartet: **BASIS + 137** Tests bestanden · `- 0 errors`, `- 0 warnings` · **SEITEN + 2** `page(s) built` · `NUL-Bytes: 0 in 16 Dateien` · mindestens eine Zeile `Zod in …`, und **jede** endet auf `von Aufgabe importiert: 0`. Die Größe in KB im Bericht notieren: Das ist der Preis dafür, dass im Browser geprüft wird, was aus dem Speicher kommt. Steht irgendwo eine Zahl größer `0`, zieht eine Lektionsseite Zod nach — dann hat `auswertung.ts` oder `vorschlag.ts` einen Wert statt eines Typs aus `schema.ts` importiert.

- [ ] **Schritt 2: Den gebauten Stand ausliefern**

Die Vorschau `kernbohrung-bau` (Port 4322) neu starten, damit sie den frischen Bau ausliefert: `preview_list` → laufenden Eintrag mit `preview_stop` beenden → `preview_start` mit `name: "kernbohrung-bau"`. Dann `resize_window` mit `preset: "mobile"` (375 × 812).

- [ ] **Schritt 3: Frischer Stand — die Einladung steht da, Tippflächen stimmen**

`http://localhost:4322/` öffnen. Zuerst den Stand zurücksetzen, damit die Abnahme wiederholbar ist:

```js
await (async () => {
  await new Promise((r) => setTimeout(r, 1500));
  const bekannt = (await indexedDB.databases()).some((d) => d.name === 'kernbohrung-tutor');
  if (!bekannt) return 'Datenbank fehlt noch — Seite neu laden und den Schnipsel wiederholen';
  const db = await new Promise((ok, nein) => {
    const a = indexedDB.open('kernbohrung-tutor');
    a.onsuccess = () => ok(a.result);
    a.onerror = () => nein(a.error);
  });
  const tx = db.transaction('einstellungen', 'readwrite');
  for (const schluessel of ['profil', 'profil:entwurf', 'profil:spaeter']) tx.objectStore('einstellungen').delete(schluessel);
  await new Promise((ok, nein) => {
    tx.oncomplete = ok;
    tx.onerror = () => nein(tx.error);
  });
  db.close();
  return 'drei Schluessel entfernt';
})();
```
Erwartet: `drei Schluessel entfernt`. Die Seite neu laden (`navigate` auf dieselbe Adresse), dann messen:

```js
await (async () => {
  await new Promise((r) => setTimeout(r, 1500));
  const gruppen = {
    'Einladung: Verweis': '[data-einladung] a',
    'Einladung: Später': '[data-einladung] [data-spaeter]',
    'Verweis zum Profil': '.profil-verweis a',
    Modusumschalter: '.schalter button',
  };
  const aus = {};
  for (const [name, auswahl] of Object.entries(gruppen)) {
    const elemente = [...document.querySelectorAll(auswahl)];
    if (!elemente.length) { aus[name] = 'keine im Bild'; continue; }
    const masse = elemente.map((e) => {
      const r = e.getBoundingClientRect();
      const nach = getComputedStyle(e, '::after');
      return { w: Math.max(r.width, parseFloat(nach.width) || 0), h: Math.max(r.height, parseFloat(nach.height) || 0) };
    });
    aus[name] = `${elemente.length} Stück, kleinste ${Math.round(Math.min(...masse.map((m) => m.w)))}x${Math.round(Math.min(...masse.map((m) => m.h)))}, zu klein: ${masse.filter((m) => m.w < 44 || m.h < 44).length}`;
  }
  aus.karteSichtbar = !document.querySelector('[data-einladung]').hidden;
  aus.ueberlauf = document.documentElement.scrollWidth - innerWidth;
  return aus;
})();
```
Erwartet: `karteSichtbar: true`, in jeder Gruppe `zu klein: 0`, `ueberlauf: 0`. Eine Gruppe mit `zu klein` größer null wird in `global.css` behoben, nachgemessen und eigens committet.

- [ ] **Schritt 4: „Später" versteckt die Karte — auch nach dem Neuladen**

```js
await (async () => {
  document.querySelector('[data-spaeter]').click();
  await new Promise((r) => setTimeout(r, 600));
  return { versteckt: document.querySelector('[data-einladung]').hidden };
})();
```
Erwartet: `versteckt: true`. Seite neu laden, dann:

```js
await (async () => {
  await new Promise((r) => setTimeout(r, 1500));
  const db = await new Promise((ok, nein) => {
    const a = indexedDB.open('kernbohrung-tutor');
    a.onsuccess = () => ok(a.result);
    a.onerror = () => nein(a.error);
  });
  const spaeter = await new Promise((ok, nein) => {
    const a = db.transaction('einstellungen').objectStore('einstellungen').get('profil:spaeter');
    a.onsuccess = () => ok(a.result);
    a.onerror = () => nein(a.error);
  });
  db.close();
  return { versteckt: document.querySelector('[data-einladung]').hidden, spaeter };
})();
```
Erwartet: `versteckt: true`, `spaeter` ein ISO-Zeitpunkt von eben.

- [ ] **Schritt 5: `/profil/` ohne Profil**

`http://localhost:4322/profil/` öffnen:

```js
await (async () => {
  await new Promise((r) => setTimeout(r, 1500));
  const verweis = document.querySelector('.profil-leer a');
  const r = verweis.getBoundingClientRect();
  return {
    satz: document.querySelector('.profil-leer-satz')?.textContent,
    verweis: verweis.textContent,
    ziel: verweis.getAttribute('href'),
    masse: `${Math.round(r.width)}x${Math.round(r.height)}`,
    neuErhebenImBild: [...document.querySelectorAll('a')].some((a) => a.textContent === 'Neu erheben'),
    ueberlauf: document.documentElement.scrollWidth - innerWidth,
  };
})();
```
Erwartet: `satz: 'Auf diesem Gerät liegt noch kein Lernprofil.'`, `verweis: 'Lernprofil anlegen'`, `ziel: '/profil/audit/'`, beide Maße ≥ 44, `neuErhebenImBild: false`, `ueberlauf: 0`. Dass `verweis` überhaupt gefunden wird, beweist den Weg über den Slot: Er war beim Vorrendern nicht gezeigt und kommt erst nach dem Hydrieren ins Bild.

- [ ] **Schritt 6: Das Audit — Tippflächen, heller und dunkler Modus**

`http://localhost:4322/profil/audit/` öffnen:

```js
await (async () => {
  await new Promise((r) => setTimeout(r, 1500));
  const mass = (auswahl) => {
    const masse = [...document.querySelectorAll(auswahl)].map((e) => e.getBoundingClientRect());
    if (!masse.length) return 'keine im Bild';
    return `${masse.length} Stück, kleinste ${Math.round(Math.min(...masse.map((m) => m.width)))}x${Math.round(Math.min(...masse.map((m) => m.height)))}, zu klein: ${masse.filter((m) => m.width < 44 || m.height < 44).length}`;
  };
  const aus = {
    kopf: document.querySelector('.audit-kopf').textContent,
    felder: mass('.wahlfeld'),
    weiter: mass('.audit-knoepfe .abgeben'),
    verweis: mass('.profil-verweis a'),
    ueberlauf: document.documentElement.scrollWidth - innerWidth,
  };
  document.querySelector('.wahlfeld input').click();
  await new Promise((r) => setTimeout(r, 200));
  document.documentElement.setAttribute('data-theme', 'dark');
  const farbe = (auswahl, eigenschaft) => { const e = document.querySelector(auswahl); return e ? getComputedStyle(e)[eigenschaft] : 'nicht im Bild'; };
  aus.dunkel = {
    feld: farbe(".wahlfeld[data-gewaehlt='false']", 'backgroundColor'),
    feldRand: farbe(".wahlfeld[data-gewaehlt='false']", 'borderTopColor'),
    gewaehlt: farbe(".wahlfeld[data-gewaehlt='true']", 'backgroundColor'),
  };
  document.documentElement.removeAttribute('data-theme');
  return aus;
})();
```
Erwartet: `kopf: 'Aussagen 1 bis 6 von 26'`, `felder: '30 Stück, …, zu klein: 0'`, `weiter` und `verweis` mit `zu klein: 0`, `ueberlauf: 0`. Dunkel: `feld: 'rgb(30, 37, 40)'` (`--flaeche-2`), `feldRand: 'rgb(107, 119, 124)'` (`--rand-bedien`), `gewaehlt: 'rgb(232, 163, 60)'` (`--akzent-fill`). Ein heller Wert hieße: Eine Regel hängt an einer festen Farbe statt an einem Token.

- [ ] **Schritt 7: Zwei Gruppen beantworten, neu laden — der Zwischenstand bleibt**

Auf derselben Seite. Die Antworten hängen an der Skala, damit das Ergebnis etwas zeigt: Abrufen bekommt 2 (eine Schwachstelle), anwendungsorientiert 5 (ein eindeutiges Muster), ungerichtet 2 (kein Strukturhinweis), alles andere 4.

```js
await (async () => {
  const warte = (ms) => new Promise((r) => setTimeout(r, ms));
  const wertFuer = (id) => (id.startsWith('abr') ? 2 : id.startsWith('anw') ? 5 : id.startsWith('ung') ? 2 : 4);
  const bericht = [];
  for (let runde = 0; runde < 2; runde++) {
    for (const frage of document.querySelectorAll('.wahlfrage')) {
      const id = frage.querySelector('input').name.replace('aussage-', '');
      frage.querySelector(`input[value="${wertFuer(id)}"]`).click();
      await warte(40);
    }
    bericht.push(document.querySelector('.audit-fortschritt').textContent.trim());
    document.querySelector('.audit-knoepfe .abgeben').click();
    await warte(250);
  }
  bericht.push(document.querySelector('.audit-kopf').textContent);
  bericht.push(`Fokus auf der Überschrift: ${document.activeElement === document.querySelector('.audit-kopf')}`);
  bericht.push(`Zurück: ${Math.round(document.querySelector('.zurueck').getBoundingClientRect().height)}px hoch`);
  await warte(600);
  return bericht;
})();
```
Erwartet: `'Schritt 1 von 6 · 6 von 26 Aussagen beantwortet'`, `'Schritt 2 von 6 · 11 von 26 Aussagen beantwortet'`, `'Aussagen 12 bis 16 von 26'`, `'Fokus auf der Überschrift: true'`, `'Zurück: 48px hoch'`.

Jetzt die Seite **neu laden** (`navigate` auf dieselbe Adresse), dann:

```js
await (async () => {
  await new Promise((r) => setTimeout(r, 1500));
  return {
    kopf: document.querySelector('.audit-kopf').textContent,
    fortschritt: document.querySelector('.audit-fortschritt').textContent.trim(),
    angekreuztInDieserGruppe: document.querySelectorAll('.wahlfeld input:checked').length,
  };
})();
```
Erwartet: `kopf: 'Aussagen 12 bis 16 von 26'`, `fortschritt: 'Schritt 3 von 6 · 11 von 26 Aussagen beantwortet'`, `angekreuztInDieserGruppe: 0`.

- [ ] **Schritt 8: Zu Ende spielen — das Ergebnis**

```js
await (async () => {
  const warte = (ms) => new Promise((r) => setTimeout(r, ms));
  const wertFuer = (id) => (id.startsWith('abr') ? 2 : id.startsWith('anw') ? 5 : id.startsWith('ung') ? 2 : 4);
  for (let runde = 0; runde < 3; runde++) {
    for (const frage of document.querySelectorAll('.wahlfrage')) {
      const id = frage.querySelector('input').name.replace('aussage-', '');
      frage.querySelector(`input[value="${wertFuer(id)}"]`).click();
      await warte(40);
    }
    document.querySelector('.audit-knoepfe .abgeben').click();
    await warte(250);
  }
  const fertig = () => document.querySelector('.audit-knoepfe .abgeben');
  const aus = { kopfVorlieben: document.querySelector('.audit-kopf').textContent, gesperrtVorher: fertig().disabled };
  aus.feldVorliebe = `${Math.round(document.querySelector('.liste .wahlfeld').getBoundingClientRect().height)}px hoch`;
  for (const [name, wert] of [['vorliebe-einstieg', 'beispiel'], ['vorliebe-minuten', '10'], ['vorliebe-text', 'egal']]) {
    document.querySelector(`input[name="${name}"][value="${wert}"]`).click();
    await warte(40);
  }
  aus.gesperrtNachher = fertig().disabled;
  fertig().click();
  await warte(900);
  return {
    ...aus,
    kopf: document.querySelector('.audit-kopf').textContent,
    muster: document.querySelector('.muster-satz').textContent,
    abrufen: document.querySelector('[data-skala="abrufen"] .balken-zahl').textContent,
    vorschlaege: [...document.querySelectorAll('.vorschlag span')].map((e) => e.textContent),
    beipackzettel: document.querySelector('.beipackzettel p')?.textContent.slice(0, 40),
    beipackzettelSchrift: getComputedStyle(document.querySelector('.beipackzettel')).fontSize,
    strukturhinweis: document.querySelector('.strukturhinweis') !== null,
    nichtBehalten: document.querySelector('[role="status"]') !== null,
    ueberlauf: document.documentElement.scrollWidth - innerWidth,
  };
})();
```
Erwartet: `kopfVorlieben: 'Drei Vorlieben'`, `gesperrtVorher: true`, `feldVorliebe` ≥ 48, `gesperrtNachher: false`, `kopf: 'Dein Ergebnis'`, `muster: 'Dein Lernmuster ist derzeit anwendungsorientiert.'`, `abrufen: '2,0 von 5'`, `vorschlaege` mit genau einem Eintrag („Lass die App fragen, bevor du nachliest. …"), `beipackzettel: 'Dieses Profil beruht auf eigenen Aussagen'`, `beipackzettelSchrift: '16px'`, `strukturhinweis: false`, `nichtBehalten: false`, `ueberlauf: 0`.

- [ ] **Schritt 9: Was im Speicher liegt — Antworten, kein Ergebnis**

```js
await (async () => {
  const db = await new Promise((ok, nein) => {
    const a = indexedDB.open('kernbohrung-tutor');
    a.onsuccess = () => ok(a.result);
    a.onerror = () => nein(a.error);
  });
  const lies = (schluessel) => new Promise((ok, nein) => {
    const a = db.transaction('einstellungen').objectStore('einstellungen').get(schluessel);
    a.onsuccess = () => ok(a.result);
    a.onerror = () => nein(a.error);
  });
  const profil = await lies('profil');
  const entwurf = await lies('profil:entwurf');
  const fassung = db.version;
  db.close();
  return {
    fassung,
    felder: Object.keys(profil).sort(),
    antworten: Object.keys(profil.antworten).length,
    werte: [...new Set(Object.values(profil.antworten))].sort(),
    itemsatz: profil.itemsatz,
    erhoben: profil.erhoben,
    vorlieben: profil.vorlieben,
    entwurf,
  };
})();
```
Erwartet: `felder: ['antworten', 'erhoben', 'itemsatz', 'vorlieben']` — **und nichts sonst**: kein `lernmuster`, keine `skalen`, keine `schwachstellen`. `antworten: 26`, `werte: [2, 4, 5]`, `itemsatz: 1`, `erhoben` ein ISO-Zeitpunkt von eben, `vorlieben: { einstieg: 'beispiel', minuten: 10, text: 'egal' }`, `entwurf: null`. `fassung` ist dieselbe wie vor diesem Plan (nach der Aufgabenfamilie: `2`) — das Profil hat dem Speicher keine neue Fassung abverlangt.

- [ ] **Schritt 10: `/profil/` mit Profil, dunkler Modus, und die Übersicht lädt nicht mehr ein**

`http://localhost:4322/profil/` öffnen:

```js
await (async () => {
  await new Promise((r) => setTimeout(r, 1500));
  const erneut = [...document.querySelectorAll('a')].find((a) => a.textContent === 'Neu erheben');
  const r = erneut.getBoundingClientRect();
  document.documentElement.setAttribute('data-theme', 'dark');
  const farbe = (auswahl) => { const e = document.querySelector(auswahl); return e ? getComputedStyle(e).backgroundColor : 'nicht im Bild'; };
  const dunkel = {
    karte: farbe('.profil-muster'),
    beipackzettel: farbe('.beipackzettel'),
    spur: farbe('.balken-spur'),
    fuellung: farbe('.balken-fuellung'),
    vorschlag: farbe('.vorschlag'),
  };
  document.documentElement.removeAttribute('data-theme');
  return {
    muster: document.querySelector('.muster-satz').textContent,
    balken: document.querySelectorAll('.balken-zeile').length,
    erhoben: document.querySelector('.profil-erhoben').textContent,
    neuErheben: `${Math.round(r.width)}x${Math.round(r.height)} → ${erneut.getAttribute('href')}`,
    anlegenImBild: [...document.querySelectorAll('a')].some((a) => a.textContent === 'Lernprofil anlegen'),
    ueberlauf: document.documentElement.scrollWidth - innerWidth,
    dunkel,
  };
})();
```
Erwartet: `muster: 'Dein Lernmuster ist derzeit anwendungsorientiert.'`, `balken: 6`, `erhoben` mit dem heutigen Datum, `neuErheben` mit beiden Maßen ≥ 44 und dem Ziel `/profil/audit/`, `anlegenImBild: false`, `ueberlauf: 0`. Dunkel: `karte` und `beipackzettel` `rgb(22, 27, 30)` (`--flaeche`), `spur` `rgb(30, 37, 40)` (`--flaeche-2`), `fuellung` `rgb(47, 184, 166)` (`--teal`), `vorschlag` `rgb(16, 49, 46)` (`--teal-weich`).

Dann `http://localhost:4322/` öffnen:

```js
await (async () => {
  await new Promise((r) => setTimeout(r, 1500));
  return { karteSichtbar: !document.querySelector('[data-einladung]').hidden };
})();
```
Erwartet: `karteSichtbar: false`. Danach `resize_window` mit `preset: "desktop"`.

- [ ] **Schritt 11: Die ortsunabhängige Kopie — die Verweise aus den Slots sind umgeschrieben**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && rm -rf handy && cp -r dist handy && node werkzeug/relative-verweise.mjs handy && grep -o 'data-astro-template="[a-z]*"><a [^>]*>' handy/profil/index.html && grep -o '<a class="abgeben knopf-verweis" href="[^"]*"' handy/index.html
```
Erwartet: `Kein wurzelbezogener Verweis mehr uebrig.` · zwei Zeilen zu `anlegen` und `erneut`, beide mit `href="../profil/audit/index.html"` · eine Zeile mit `href="./profil/audit/index.html"`. `handy/` steht in `.gitignore`. Das Artifact selbst aktualisiert die Hauptsitzung, kein Subagent.

- [ ] **Schritt 12: Übergabe**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && git status --short && git log --oneline -9
```
Erwartet: sauberer Baum; neun Commits dieses Plans (einer je Aufgabe 1 bis 9), dazu je Behebung aus der Abnahme einer. Das Zusammenführen entscheidet der Nutzer — dafür `superpowers:finishing-a-development-branch`.

---

## Selbstprüfung gegen den Spec

| Spec, Teil 3a | Aufgabe |
|---|---|
| Karte „Lernprofil anlegen — etwa vier Minuten" mit „Später", solange kein Profil gespeichert ist | 4 (`einladungZeigen`), 8, 10 |
| 26 Aussagen in Gruppen zu fünf bis sechs, fünfstufig, deterministisch gemischt | 1, 7 |
| Drei Vorlieben, Einfachwahl; heißen „Vorliebe", nie „Lerntyp" | 1, 7 |
| Ergebnis; Abbrechen jederzeit, der Zwischenstand bleibt liegen | 7, 8 |
| Jede Tippfläche ≥ 44 px, ganzer Ablauf per Tastatur, kein Überlauf bei 375 px | 6, 7, 9, 10 |
| Die Items, die Vorlieben — eigene Formulierungen, wörtlich | 1 (Wortlaut, Prüfsumme) |
| Skalenwert = Mittel, `null` unter zwei Antworten | 3 (+ Mutationsprobe A) |
| Lernmuster = höchstes Mittel; „zwischen A und B" unter 0,5 | 3 (+ Mutationsprobe B) |
| Strukturhinweis ab 3,5, unabhängig vom führenden Muster | 3, 5 |
| Schwachstellen = zwei niedrigste unter 3,0, sonst keine | 3, 5 |
| Fremder `itemsatz` → nicht erhoben | 3, 5 (Insel) |
| Ergebnisseite: Muster mit „derzeit", zwei Sätze, Momentaufnahme | 5 |
| Sechs Balken mit Zahl, nicht nur Farbe | 5, 9 |
| Je Schwachstelle ein Vorschlag, im Wortlaut | 4, 5 |
| Beipackzettel, immer sichtbar; nie ein Muster ohne ihn | 5 (+ Mutationsprobe), 7, 10 |
| „Neu erheben" und der Hinweis ab acht Wochen | 4, 5, 8 |
| Daten: `einstellungen`/`profil`, Antworten statt Ergebnis, keine neue Fassung, `alsJson()` nimmt es mit | 2, 7 (+ Mutationsprobe, echter Speicher), 10 |
| `schema.ts`: Werte außerhalb 1–5, unbekannte Vorlieben, Fremdfelder; unlesbar → „kein Profil" | 2 (+ Mutationsprobe), 5 |
| `Audit.tsx`: Speicherfehler hält den Ablauf nicht auf, mit Hinweis | 7 |
| Dateien wie im Spec | Dateistruktur; keine weitere Datei unter `src/profil/` |
| Teil 3b, Lernziele, Standortbestimmung | nicht Teil dieses Plans; `voreinstellungen()` ist die eine vorbereitete Stelle |

**Testzahlen entlang des Plans (Zuwachs gegenüber BASIS):** +11 (1) → +48 (2) → +74 (3) → +88 (4) → +113 (5) → +118 (6) → +137 (7). Aufgabe 8 und 9 bringen keine Tests; ihr Nachweis ist die Abnahme.

**Namen über die Aufgaben hinweg:** `ITEMSATZ`, `ITEMS`, `GRUPPEN`, `GRUPPENGROESSEN`, `STUFEN`, `STUFEN_TEXT`, `VORLIEBEN`, `SKALEN`, `SKALA_TEXT`, `MUSTER` (Aufgabe 1) · `SCHLUESSEL_PROFIL`, `SCHLUESSEL_ENTWURF`, `SCHLUESSEL_SPAETER`, `VorliebenSchema`, `HalbeVorliebenSchema`, `ProfilstandSchema`, `liesProfil`, `liesEntwurf`, Typen `Profilstand`, `Entwurf`, `Vorlieben` (2) · `werteAus`, Typen `Auswertung`, `Lernmuster` (3) · `VORSCHLAG`, `wiederholungLohnt`, `einladungZeigen` (4) · `Ergebnisansicht`, `BEIPACKZETTEL` (5) · `Wahlfrage` (6). Klassen, an denen Tests oder Abnahme hängen: `.audit-kopf`, `.audit-fortschritt`, `.audit-knoepfe`, `.wahlfrage`, `.wahlfeld`, `.zurueck`, `.muster-satz`, `.beipackzettel`, `.balken-zeile`, `.balken-zahl`, `.vorschlag`, `.profil-leer`, `.profil-leer-satz`, `.profil-erhoben`, `.profil-verweis`, `[data-einladung]`, `[data-spaeter]`.
