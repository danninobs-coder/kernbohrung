---
name: kernbohrung-compiler
description: Destilliert aus einer eingelesenen Quelle Kernprinzipien und baut daraus Lektionen für die Lern-App Kernbohrung. Nutze diesen Skill, wenn eine neue Quelle zu Lektionen werden soll, wenn der Lehrplan überarbeitet wird, oder bei Aufrufen wie "destilliere rag_tutorials", "bau die Lektionen", "neuer Lehrplan", "lies die Quelle ein". Zwei Durchgänge mit einem Review-Gate dazwischen — der Lehrplan wird IMMER dem Menschen vorgelegt, bevor Lektionen entstehen. Für Lehrmaterial (Folien, Bücher): „Bau die Lektionen für ‹kurzname›“ — Durchgang für Lehrmaterial.
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
`src/lib/lehrplan.ts`; sieh dort nach, statt zu raten. Ein Lehrplan aus einem
Repo trägt `art: repo` — ohne die Zeile weist die Prüfung ihn zurück.

```yaml
art: repo
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
| 4 Die Probe | Frontmatter `aufgaben` | zwei bis sechs Aufgaben, jede mit `typ` — `typ`: `wahl`, `fall`, `zuordnen` oder `reihenfolge` — was wozu passt, steht unter „Aufgabentypen wählen“ im Durchgang für Lehrmaterial |
| 5 Der Transfer | Frontmatter `transfer` | eine Aufgabe auf einen fremden Fall, ebenfalls mit `typ` — `typ`: `wahl`, `fall`, `zuordnen` oder `reihenfolge` — was wozu passt, steht unter „Aufgabentypen wählen“ im Durchgang für Lehrmaterial |
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
