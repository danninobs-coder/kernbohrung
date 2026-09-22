---
name: kernbohrung-compiler
description: Destilliert aus einer eingelesenen Quelle Kernprinzipien und baut daraus Lektionen für die Lern-App Kernbohrung. Nutze diesen Skill, wenn eine neue Quelle zu Lektionen werden soll, wenn der Lehrplan überarbeitet wird, oder bei Aufrufen wie "destilliere rag_tutorials", "bau die Lektionen", "neuer Lehrplan", "lies die Quelle ein". Zwei Durchgänge mit einem Review-Gate dazwischen — der Lehrplan wird IMMER dem Menschen vorgelegt, bevor Lektionen entstehen.
---

# Kernbohrung — Compiler

Du verdichtest Rohmaterial zu Lektionen. Zwei Durchgänge, dazwischen ein Mensch.

Die Werkzeuge stehen bereit und sind getestet. Deine Aufgabe ist das, was sie
nicht können: urteilen, was ein Prinzip ist und was nur ein Merkmal.

## Vier Grundsätze, die über allem stehen

**Verdichten, nicht katalogisieren.** Vierundzwanzig Varianten sind nicht
vierundzwanzig Themen. Findest du für jede Variante ein Prinzip, hast du
zusammengefasst statt destilliert. Höchstens acht — das erzwingt auch das
Format. Lieber fünf, die tragen.

**Ablehnen ist erlaubt und erwünscht.** Vier gute Lektionen schlagen zwölf
mittelmäßige. Findest du zu einem Prinzip keine Frage, deren falsche Antworten
etwas taugen, dann sag das und baue die Lektion nicht. Eine abgelehnte Lektion
ist ein Ergebnis, kein Versagen.

**Jede Behauptung zeigt auf eine Quelldatei.** Was du nicht belegen kannst,
kommt nicht in den Lehrplan. Ein Prinzip mit einem Beleg ist verdächtig — es
soll ja gerade das Wiederkehrende sein.

**Rede nie über Vollständigkeit, ohne die Auslassungsliste gelesen zu haben.**
Der Ingest nimmt nicht alles mit. Was fehlt, steht in `manifest.json` unter
`ausgelassen`, jeder Eintrag mit Grund. Wer das überspringt, hält den Bestand
für vollständig und schließt aus einem fehlenden Treffer auf ein fehlendes
Thema.

---

## Durchgang A — Prinzipien destillieren

### A1 · Quelle bereitstellen

```bash
ls quellen/<name>/uebersicht.md
```

Fehlt sie, lies ein:

```bash
npm run ingest -- --git <url> --pfad <unterpfad> --name <name>
```

Der Ingest klont sparse — für ein 220-MB-Repo lädt er rund 3 MB. Er schreibt
`quellen/<name>/` mit `manifest.json`, `uebersicht.md` und `roh/` (eine Datei
je Variante). Der Ordner ist bewusst nicht im Git: Er ist abgeleitet, und der
Commit-SHA im Manifest sagt, aus welchem Stand.

### A2 · Erst das Manifest, dann der Inhalt

```bash
node -e "const m=require('./quellen/<name>/manifest.json'); console.log(m.summe); console.log([...new Set(m.ausgelassen.map(a=>a.grund))].join('\n'))"
```

Du musst wissen, was **nicht** da ist, bevor du über das urteilst, was da ist.

### A3 · Die Übersicht als Landkarte, nicht als Urteil

`quellen/<name>/uebersicht.md` gibt je Variante einen Absatz. Sie reicht, um
Verwandtschaften zu ahnen. Sie reicht **nicht**, um ein Prinzip zu erkennen —
die ersten Absätze von READMEs sind Werbetext, und Werbetext beschreibt, was
etwas kann, nicht warum es so gebaut ist.

### A4 · Das Rohmaterial lesen, und zwar den Code

Lies die Dateien unter `quellen/<name>/roh/` **vollständig**, besonders die
Abschnitte „Umsetzung".

Der Grund ist gemessen, nicht vermutet: Bei der ersten eingelesenen Quelle
hatten **vier von vierundzwanzig** READMEs überhaupt einen Abschnitt, der
erklärt, wie die Sache funktioniert. Die übrigen listen Merkmale und
Installationsschritte. Das Prinzip hinter „Corrective RAG" — die Schleife aus
Bewertung, Umformulierung und Rückfall auf die Websuche — steht im Python. Wer
nur die Beschreibungen liest, destilliert Merkmalslisten und merkt es nicht.

Wenn das Material zu umfangreich für einen Zug ist, lies in Gruppen und
notiere unterwegs. Überfliegen ist keine Alternative.

### A5 · Die richtige Frage stellen

Nicht: *Was macht jede Variante?* Das führt zu vierundzwanzig Zusammenfassungen.

Sondern: **Welche wiederkehrenden Prinzipien erklären, warum es diese Varianten
überhaupt gibt?**

Ein Prinzip taugt, wenn drei Dinge zutreffen:

1. **Es kommt mehrfach vor.** Ein Einzelfall ist eine Variante, kein Prinzip.
2. **Es ist nicht offensichtlich.** Es muss eine plausible Gegenposition geben,
   die ein kompetenter Mensch vertreten würde. „Man braucht einen Vektorindex"
   ist kein Prinzip, sondern eine Voraussetzung.
3. **Es leitet eine Entscheidung.** Wer es verstanden hat, trifft eine andere
   Wahl als vorher. Ein Prinzip, aus dem nichts folgt, ist eine Vokabel.

Prüfe jeden Kandidaten gegen alle drei. Der zweite Punkt siebt am schärfsten.

### A6 · Den Entwurf schreiben

Nach `lehrplan/<name>.yaml`. Format und Grenzen stehen in
`werkzeug/lehrplan.mjs`; sieh dort nach, statt zu raten.

```yaml
quelle: <name>
stand: <SHA aus manifest.json>
geprueftVon: ""
geprueftAm: ""
prinzipien:
  - id: kleinbuchstaben-mit-bindestrich
    satz: "Ein Satz, der etwas behauptet. Höchstens 200 Zeichen."
    warumNichtOffensichtlich: "Die plausible Gegenposition, in einem Satz."
    belege: [variante-a, variante-b]
    widget: Pipeline
```

**`geprueftVon` und `geprueftAm` bleiben leer.** Die füllt der Mensch.

Prüfen:

```bash
node -e "import('./werkzeug/lehrplan.mjs').then(m=>console.log(JSON.stringify(m.liesLehrplan('lehrplan/<name>.yaml'),null,2)))"
```

---

## Das Review-Gate

**Halte hier an.** Nicht „zeig kurz und mach weiter" — anhalten.

Lege vor:

- **Die Prinzipien**, je in einem Satz, mit ihrer Gegenposition.
- **Worauf du sie stützt** — welche Varianten, und was dort konkret steht.
- **Was du verworfen hast und warum.** Das ist oft aufschlussreicher als das
  Behaltene: Es zeigt, wo du die Grenze zwischen Prinzip und Merkmal gezogen
  hast, und genau darüber soll der Mensch entscheiden können.
- **Wo du unsicher bist.** Kandidaten, bei denen du zwischen zwei Schnitten
  geschwankt hast. Verschweig sie nicht, um entschlossener zu wirken.

Dann bitte um Korrektur und warte.

Rechne damit, dass gestrichen und zusammengelegt wird. Der erste Entwurf ist
selten der richtige — deshalb gibt es das Gate.

Fahre erst fort, wenn der Mensch zugestimmt hat **und `geprueftVon` gefüllt
ist**. Fülle es niemals selbst, auch nicht mit einem Namen, den du im Repo
gefunden hast. Ein Lehrplan ohne menschliche Abnahme ist kein Lehrplan, und
der leere Eintrag ist das einzige, was diesen Unterschied festhält.

---

## Durchgang B — Lektionen bauen

Eine Lektion nach der anderen. Nicht alle auf einmal — jede wird einzeln
geprüft, und ein Fehler in der ersten ändert oft, wie die zweite aussehen muss.

### B1 · Die belegenden Rohdateien noch einmal lesen

Beim Formulieren brauchst du Einzelheiten, die beim Destillieren keine Rolle
spielten. Aus dem Gedächtnis zu schreiben produziert Behauptungen, die keinen
Beleg mehr haben.

### B2 · Die sechs Takte

Die Reihenfolge legt das Layout fest. Du lieferst Teile:

| Takt | Wo | Was |
|---|---|---|
| 1 Der Widerspruch | MDX-Rumpf | Prosa: warum ist das nicht offensichtlich? |
| 2 Das Bild | MDX-Rumpf | der Widget-Aufruf |
| 3 Der Satz | Frontmatter `prinzip` | das Prinzip in einem Satz |
| 4 Die Probe | Frontmatter `aufgaben` | zwei bis sechs Aufgaben, jede mit `typ` — bis der Skill die übrigen Typen lernt: `typ: wahl` |
| 5 Der Transfer | Frontmatter `transfer` | eine Frage auf einen fremden Fall |
| 6 Die Herkunft | Frontmatter `quellen` | die Belege |

**Der Widerspruch ist kein Vorwort.** Er muss die Frage erzeugen, auf die das
Prinzip die Antwort ist. Steht am Anfang „In diesem Abschnitt lernen Sie…",
hast du eine Einleitung geschrieben, keinen Widerspruch.

**Das Bild kommt vor dem Satz.** Erst spielen, dann formulieren. Wer das
umdreht, hat eine Illustration gebaut.

### B3 · Die Regel für falsche Antworten

Hier entscheidet sich, ob die Lektion etwas wert ist.

Eine Frage ist nur zulässig, wenn ihre falschen Antworten **Positionen sind,
die ein kompetenter Mensch tatsächlich vertreten würde.**

Untauglich:

> Wofür steht RAG?
> (a) Retrieval-Augmented Generation (b) Random Access Grammar

Tauglich:

> Dein Retrieval hat gute Recall, schlechte Precision. Was zuerst?
> (a) Reranker dahinter (b) Chunks verkleinern (c) mehr Kandidaten holen
> (d) Embedding-Modell wechseln

Zwei weitere Regeln, die das Schema erzwingt und die du trotzdem verstehen
solltest:

- **Jede Antwort trägt ihre eigene Begründung**, auch die falschen. Dort steckt
  der Lerneffekt — zu wissen, warum die anderen drei falsch sind, ist mehr wert
  als die richtige Antwort.
- **Genau eine ist richtig.** Wenn dir zwei richtig erscheinen, ist die Frage
  schlecht gestellt, nicht das Schema zu streng.

Und eine, die das Schema nicht prüfen kann: **Die Probe muss das Bild
brauchen.** Ist eine Frage ohne das Widget genauso lösbar, gehört sie nicht in
diese Lektion.

### B4 · Der Transfer

Ein Fall, der in der Quelle **nicht** vorkommt, am besten aus einem anderen
Gebiet. Er prüft, ob jemand das Prinzip verstanden hat oder nur die Beispiele
wiedererkennt.

### B5 · Prüfen, bevor du schreibst

Schreib die Lektion **zuerst nach `entwurf/`**, nie direkt nach
`inhalt/lektionen/`.

```bash
node werkzeug/pruefe-lektion.mjs entwurf/<id>.mdx
```

Das prüft beides an einer Stelle: das Frontmatter gegen das Lektionsschema und
jeden Widget-Aufruf im Rumpf gegen die Widget-Prüfung — samt der Bedingung,
dass jede Schalterkombination ein Ergebnis hat.

Meldet es Mängel, **behebe sie im Entwurf**. Verschiebe erst bei `in Ordnung`:

```bash
mv entwurf/<id>.mdx inhalt/lektionen/<id>.mdx
```

### B5a · Zwei Fallen, die beim Schreiben zuverlässig zuschlagen

**Deutsche Anführungszeichen brechen das YAML.** Wer `„…` mit einem geraden `"`
schließt, beendet damit den YAML-String, und die Meldung lautet nur
`bad indentation of a mapping entry` — sie zeigt auf eine Zeile weiter unten und
sagt nichts über die Ursache. Das korrekte Schlusszeichen ist `“`. Prüf das,
bevor du die Einrückung suchst:

```bash
grep -n '„[^“]*"' entwurf/<id>.mdx
```

**`einheitPlural` steht im Dativ.** Der Zähler des Pipeline-Widgets rendert
„3 von 5 <Plural> relevant". Also `Dokumenten`, nicht `Dokumente`; `Abschnitten`,
nicht `Abschnitte`. Die Prüfung merkt das nicht — es ist Grammatik, kein Schema.

### B6 · Der Bau als letzte Schranke

```bash
npm run build
```

Der Bau hält bei ungültigen Widget-Parametern an — das ist das zweite Netz
hinter der Prüfung. Läuft er durch, ist die Lektion auslieferbar.

### B7 · Nachschauen

Am Ende gehört jede neue Lektion einmal im Browser angesehen, **in einem
sichtbaren Fenster**. Die Inseln nutzen `client:visible`; ist das Fenster
verborgen, hydriert nichts, und man sieht eine Seite, die aussieht wie erwartet
und auf nichts reagiert.

---

## Was du nie tust

- **`geprueftVon` selbst füllen.** Das ist die eine Zeile, die den Unterschied
  zwischen geprüft und ungeprüft festhält.
- **Eine Lektion nach `inhalt/lektionen/` schreiben, die die Prüfung nicht
  bestanden hat.** Auch nicht „vorläufig".
- **Eine Datei mit `gesperrt: true` überschreiben.** Die ist von Hand
  nachgebessert; deine Fassung wäre ein Rückschritt.
- **Eine Frage bauen, deren falsche Antworten offensichtlich falsch sind.**
  Lieber eine Frage weniger.
- **Über Vollständigkeit reden, ohne die Auslassungsliste gelesen zu haben.**
- **Den Umfang stillschweigend anpassen.** Wenn aus acht Prinzipien vier gute
  Lektionen werden, sag das mit Begründung. Wenn du drei Prinzipien nicht
  belegen kannst, streich sie und nenne sie.
