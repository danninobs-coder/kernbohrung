# Kernbohrung

Eine Lern-App, die aus Quellen Kernprinzipien destilliert und sie abfragt. Eine
Lektion stellt zuerst einen Widerspruch auf, lässt ihn an einem spielbaren
Widget durcharbeiten und benennt das Prinzip erst danach. Geprüft wird über
Multiple Choice mit Begründung zu jeder Antwort und über eine Transferfrage aus
einem fremden Feld. Ab Bauabschnitt 2 erzeugt ein Sprachmodell die Lektionen
selbst; dieser Abschnitt baut das Ziel, auf das hin erzeugt wird.

Die tragende Entscheidung: **harte Trennung zwischen Bauzeit und Laufzeit.**
Alles Teure und Unzuverlässige passiert vorher. Die ausgelieferte App generiert
nichts und prüft nichts, was sie nicht schon weiß.

## Aufbau

Inhalt liegt als MDX in `inhalt/lektionen/`, außerhalb von `src/`, und wird über
Astros Content-Layer geladen. Die maschinenlesbaren Teile einer Lektion stehen
im Frontmatter (Prinzip, Fragen, Antworten, Begründungen, Quellen) und werden
von einem Zod-Schema erzwungen; im Rumpf steht nur Prosa und der Widget-Aufruf.
Die Reihenfolge der sechs Takte legt das Layout fest, nicht der Inhalt. Eine
generierte Lektion liefert damit Teile, nie Struktur, und kann den Rhythmus
nicht umstellen.

```
inhalt/lektionen/       Die Lektionen als MDX. Später vom Compiler erzeugt.
src/content/schema.ts   Frontmatter-Schema. Die Qualitätsschranke, frei von astro:content.
src/content.config.ts   Collection-Definition, dünn.
src/widgets/            Widget-Schemas, Prüfstelle, React-Inseln, Astro-Hüllen, Registry.
src/components/         Frage.tsx (Multiple Choice), Herkunft.astro (Quellen).
src/layouts/            Seite.astro (HTML-Hülle), Lektion.astro (die Taktfolge).
src/lib/mischen.ts      Deterministisches Mischen der Antworten, seed-basiert.
src/pages/              Übersicht und Lektionsroute.
tests/                  Vitest, jsdom, @testing-library/react.
docs/superpowers/plans/ Der Implementierungsplan zu Abschnitt 1.
```

### Die sechs Takte

1. **Der Widerspruch** — die naheliegende Annahme und warum sie nicht trägt (MDX-Rumpf).
2. **Das Bild** — ein spielbares Widget, an dem der Widerspruch sichtbar wird (MDX-Rumpf).
3. **Der Satz** — das Prinzip in einem Satz (Frontmatter `prinzip`).
4. **Die Probe** — zwei bis vier Multiple-Choice-Fragen mit Begründung zu jeder Antwort.
5. **Der Transfer** — dieselbe Struktur in einem fremden Feld.
6. **Die Herkunft** — die Quellen, aus denen das Prinzip destilliert wurde.

Takt 2 steht vor Takt 3, und das ist keine Formalie: erst spielen, dann
erklären. Wer beide tauscht, kippt die Didaktik.

## Befehle

| Befehl | Wirkung |
| --- | --- |
| `npm run dev` | Entwicklungsserver auf `localhost:4321` |
| `npm test` | Unit-Tests einmal durchlaufen (`npm run test:watch` für den Dauerbetrieb) |
| `npm run check` | Typprüfung über Astro-, TSX- und TS-Dateien |
| `npm run build` | Produktionsbau nach `dist/` |

Node ≥ 22.12 erforderlich.

## Ein Widget hinzufügen

Ein Widget besteht aus fünf Teilen. Wer einen davon vergisst, merkt es
unterschiedlich schnell — der vergessene Eintrag in einer der beiden Registries
fällt am spätesten auf.

1. **Schema** in `src/widgets/schema.ts`. `z.strictObject`, nicht `z.object`: ein
   unbekanntes Zusatzfeld ist hier kein harmloser Beifang, sondern das
   wahrscheinlichste Symptom eines halluzinierenden Generators.
2. **React-Insel** `src/widgets/<Name>.tsx`. Nimmt einen ungeprüften
   Schlüssel-Wert-Beutel entgegen und ruft `pruefeWidget('<Name>', props)` auf.
   Zur Bauzeit wirft sie bei Mängeln und hält den Bau an, zur Laufzeit zeigt sie
   den Fehlerkasten.
3. **Astro-Hülle** `src/widgets/<Name>.astro` mit statischem Import und
   `client:visible`. Sie ist die Voraussetzung dafür, dass generiertes MDX das
   Widget ohne `import`-Zeile benutzen kann: Astro muss die Komponente zur
   Bauzeit kennen, um sie hydrieren zu können, und eine dynamisch aus einer
   Registry gezogene Komponente kann das nicht.
4. **Eintrag in `src/widgets/index.ts`** — Name auf die **`.astro`-Hülle**, nicht
   auf die `.tsx`-Datei. Siehe „Bekannte Fallen".
5. **Eintrag in `src/widgets/pruefung.ts`** — Name auf das Schema, dazu optional
   eine Zusatzprüfung für inhaltliche Bedingungen, die ein Schema nicht
   ausdrücken kann. Für `Pipeline` ist das `fehlendeKombinationen`: jede
   Kombination zuschaltbarer Schritte braucht ein hinterlegtes Ergebnis.

`tests/widget-registry.test.ts` besteht darauf, dass Schritt 4 und 5 dieselben
Namen tragen. `src/widgets/pruefung.ts` importiert bewusst nur `astro/zod` und
`./schema.ts` und bleibt damit aus einem reinen Node-Prozess ladbar — der
Lektions-Compiler aus Abschnitt 2 läuft in genau so einem und braucht den Weg
vom Widget-Namen zum Schema.

## Bekannte Fallen

Drei Dinge, die dieses Projekt teuer gelernt hat. Allen dreien ist gemeinsam,
dass sie lautlos scheitern: Tests grün, `astro check` grün, Build grün, HTML
unauffällig.

**`children` verhält sich in Astro und React verschieden.** Astro reicht
`children` serverseitig nicht mit, React bei der Hydration schon. Ein striktes
Schema weist den Schlüssel deshalb erst im Browser ab, und das Widget kippt dort
in den Fehlerkasten, während Tests, Build und das server-gerenderte HTML nichts
davon zeigen. `pruefeWidget` verwirft `children` zentral, damit kein Widget die
Zeile abschreiben muss.

**`astro:content` ist nur serverseitig ladbar.** Ein Import scheitert auch unter
Vitest mit „The 'astro:content' module is only available server-side.". Deshalb
steht das Lektions-Schema in `src/content/schema.ts` und nicht in
`src/content.config.ts`: sonst ließe sich die wichtigste Qualitätsschranke des
Projekts nicht im Unit-Test prüfen, und der Compiler könnte generierten Inhalt
nicht vor dem Schreiben validieren. Dasselbe gilt für `src/widgets/index.ts` —
die Datei importiert eine `.astro`-Hülle und ist aus reinem Node nicht ladbar
(`Unknown file extension ".astro"`). Was der Compiler braucht, liegt in
`src/widgets/pruefung.ts`.

**`client:visible` hydriert in einem verborgenen Fenster nie.** Astro startet die
Insel erst, wenn ein `IntersectionObserver` sie im Sichtbereich meldet. Ist das
Browserfenster minimiert oder verdeckt oder die Seite ungescrollt, feuert der
Observer nicht. Die Seite sieht dann vollständig richtig aus — das statische HTML
ist ja da — und reagiert auf nichts. Sichtprüfungen gehören in ein sichtbares
Fenster, und vor dem Klicken wird zum Widget gescrollt.

Zur vierten, verwandten Falle gibt es einen eigenen Test: Zeigt ein Eintrag in
`src/widgets/index.ts` auf die React-Datei statt auf die `.astro`-Hülle, baut das
Projekt mit Exitcode 0 durch, das HTML enthält Widget-Markup und Schaltflächen
wie erwartet, und nur das Hydrations-Skript fehlt. Die Schalter tun dann nichts
mehr, und außer einem Menschen, der klickt, merkt es niemand.

## Kein Design

Bauabschnitt 1 hat bewusst keine Gestaltung. `src/styles/global.css` reicht für
Lesbarkeit und nicht weiter. Optik kommt später; hier steht zur Prüfung, ob eine
Lektion Ende zu Ende trägt.
