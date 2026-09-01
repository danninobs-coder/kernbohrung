# Kernbohrung — Abschnitt 1 „Skelett" — Implementierungsplan

> **Für agentische Ausführung:** ERFORDERLICHER SUB-SKILL: `superpowers:subagent-driven-development` (empfohlen) oder `superpowers:executing-plans`, um diesen Plan Aufgabe für Aufgabe abzuarbeiten. Schritte nutzen Checkbox-Syntax (`- [ ]`) zur Nachverfolgung.

**Ziel:** Eine einzelne, von Hand geschriebene Lektion läuft Ende zu Ende — Widerspruch, spielbares Pipeline-Widget, Prinzip-Satz, Multiple-Choice-Probe, Transferfrage, Herkunftsangabe — in einer statischen Astro-Seite, mit grünen Unit-Tests für jede Logikeinheit.

**Architektur:** Inhalt liegt als MDX außerhalb von `src/` und wird über Astros Content-Layer (`glob`-Loader) geladen. Die maschinenlesbaren Teile einer Lektion (Prinzip, Fragen, Antworten, Begründungen, Quellen) stehen im Frontmatter und werden von einem Zod-Schema erzwungen; im MDX-Rumpf steht nur Prosa und ein Widget-Aufruf. **Die Reihenfolge der sechs Takte ist im Layout festgelegt, nicht im Inhalt** — generierter Inhalt kann den Rhythmus damit nicht brechen. Widgets sind React-Inseln, die über eine Registry an `<Content components={…} />` übergeben werden, sodass generiertes MDX keine `import`-Zeilen enthalten muss.

**Tech-Stack:** Astro 7.2 · @astrojs/mdx 8 · @astrojs/react 6 · React 19 · Zod 4 (über `astro/zod`) · Vitest 4 + jsdom + @testing-library/react · TypeScript. Node ≥ 22.12 erforderlich (vorhanden: 24.13.1).

**Nicht in diesem Abschnitt:** Compiler, Ingest-Adapter, FSRS, Fortschrittsspeicher, Design. Die Optik bleibt bewusst roh — lesbar reicht.

**Projektort:** `C:\Users\dno\Documents\06_Botters\01_Apps\260901_Kernbohrung`
(folgt der Konvention `YYMMDD_Name` aus `01_Apps`; anderer Ort ist in Aufgabe 1 frei wählbar, dann alle Pfade entsprechend anpassen)

---

## Dateistruktur nach Abschnitt 1

```
260901_Kernbohrung/
├─ inhalt/lektionen/
│  ├─ .gitkeep
│  └─ recall-vor-precision.mdx      Der Inhalt. Später vom Compiler erzeugt.
├─ src/
│  ├─ content.config.ts             Collection-Definition, dünn — importiert aus content/schema.ts
│  ├─ content/
│  │  └─ schema.ts                  Frontmatter-Schema (die Qualitätsschranke), bewusst ohne astro:content-Import
│  ├─ lib/mischen.ts                Deterministisches Mischen, seed-basiert
│  ├─ widgets/
│  │  ├─ schema.ts                  Zod-Schemas + Hilfsfunktionen aller Widget-Typen
│  │  ├─ Pipeline.tsx               Widget 01, React-Insel
│  │  ├─ Pipeline.astro             Hydrations-Hülle (statischer Import + client:visible)
│  │  └─ index.ts                   Registry: MDX-Name → Astro-Hülle
│  ├─ components/
│  │  ├─ Frage.tsx                  Multiple Choice, React-Insel
│  │  └─ Herkunft.astro             Quellenliste (Takt 6)
│  ├─ layouts/
│  │  ├─ Seite.astro                HTML-Hülle
│  │  └─ Lektion.astro              Die sechs Takte in fester Reihenfolge
│  ├─ pages/
│  │  ├─ index.astro                Übersicht aller Lektionen
│  │  └─ lektion/[...slug].astro    Eine Lektion
│  └─ styles/global.css             Minimal, nur Lesbarkeit
├─ tests/
│  ├─ aufbau.test.ts                Rauchtest aus Aufgabe 1
│  ├─ schema.test.tsx               Widget-Schema und Pipeline-Komponente
│  ├─ mischen.test.ts
│  ├─ frage.test.tsx
│  └─ content-schema.test.ts        Lektions-Schema, unabhängig von astro:content ladbar
├─ docs/superpowers/plans/2026-09-01-abschnitt-1-skelett.md   (dieser Plan)
├─ astro.config.mjs
├─ vitest.config.ts
├─ tsconfig.json
└─ package.json
```

**Verantwortlichkeiten, kurz:** `widgets/schema.ts` kennt Widget-Parameter und sonst nichts — es wird in Abschnitt 2 unverändert vom Compiler importiert. `content/schema.ts` kennt das Lektions-Frontmatter und bleibt frei von `astro:content`, damit Tests und Compiler es importieren können. `mischen.ts` ist reine Mathematik ohne UI-Bezug. `Frage.tsx` weiß nichts über Lektionen, nur über eine Frage. `Lektion.astro` ist der einzige Ort, der die Taktfolge kennt.

---

## Aufgabe 1: Projekt anlegen, Testlauf grün

**Dateien:**
- Erstellen: das gesamte Projektgerüst durch das offizielle CLI
- Erstellen: `vitest.config.ts`
- Ändern: `package.json` (Skripte)

- [ ] **Schritt 1: Ordner anlegen und betreten**

```bash
mkdir -p "/c/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && cd "/c/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung"
```

- [ ] **Schritt 2: Astro-Grundgerüst erzeugen**

Der Ordner muss dafür leer sein.

```bash
npm create astro@latest . -- --template minimal --typescript strict --install --no-git --skip-houston --yes
```

Erwartet: `node_modules/`, `src/pages/index.astro`, `astro.config.mjs`, `tsconfig.json`, `package.json` liegen vor.
Falls das CLI wegen eines nicht leeren Ordners abbricht: in Unterordner erzeugen und hochziehen —

```bash
npm create astro@latest .astro-init -- --template minimal --typescript strict --install --no-git --skip-houston --yes && mv .astro-init/* .astro-init/.* . 2>/dev/null; rmdir .astro-init
```

- [ ] **Schritt 3: Git initialisieren und Grundgerüst sichern**

```bash
git init && git add -A && git commit -m "chore: Astro-Grundgeruest (minimal, strict)"
```

- [ ] **Schritt 4: React- und MDX-Integration hinzufügen**

```bash
npx astro add react mdx --yes
```

Erwartet: `astro.config.mjs` enthält jetzt `integrations: [react(), mdx()]`; `@astrojs/react`, `@astrojs/mdx`, `react`, `react-dom` stehen in `package.json`.

- [ ] **Schritt 5: Testwerkzeuge installieren**

```bash
npm install -D vitest jsdom @testing-library/react @testing-library/user-event
```

- [ ] **Schritt 6: `vitest.config.ts` anlegen**

```typescript
/// <reference types="vitest/config" />
import { getViteConfig } from 'astro/config';

export default getViteConfig({
  test: {
    environment: 'jsdom',
    // Nicht aus Bequemlichkeit gesetzt: @testing-library/react registriert sein
    // afterEach(cleanup) nur, wenn afterEach global existiert. Ohne globals: true
    // bleibt das Aufraeumen zwischen Tests lautlos aus, und Komponententests
    // finden Elemente aus vorherigen Tests wieder.
    globals: true,
    include: ['tests/**/*.test.{ts,tsx}'],
  },
});
```

In den Testdateien wird trotzdem explizit aus `vitest` importiert — das ist erlaubt und macht die Dateien für sich lesbar.

- [ ] **Schritt 7: Skripte in `package.json` eintragen**

Der `scripts`-Block wird vollständig ersetzt durch:

```json
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "check": "astro check",
    "test": "vitest run",
    "test:watch": "vitest"
  },
```

- [ ] **Schritt 8: Rauchtest schreiben**

Datei `tests/aufbau.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { z } from 'astro/zod';

describe('Projektaufbau', () => {
  it('kann Zod über astro/zod importieren', () => {
    const schema = z.object({ a: z.string() });
    expect(schema.parse({ a: 'x' })).toEqual({ a: 'x' });
  });

  it('hat eine DOM-Umgebung', () => {
    expect(typeof document).toBe('object');
  });
});
```

- [ ] **Schritt 9: Tests laufen lassen**

```bash
npm test
```

Erwartet: 2 Tests grün.
Falls `astro/zod` nicht auflösbar ist: `npm install -D zod@^4` und in allen folgenden Dateien `from 'astro/zod'` durch `from 'zod'` ersetzen. Der Rest des Plans bleibt unverändert.

- [ ] **Schritt 10: Plan ablegen und committen**

Diesen Plan aus dem Ablageort, aus dem er gelesen wurde, ins Projekt kopieren — `<planquelle>` durch den tatsächlichen Pfad der Datei ersetzen, aus der gerade gearbeitet wird:

```bash
mkdir -p docs/superpowers/plans && cp "<planquelle>" docs/superpowers/plans/2026-09-01-abschnitt-1-skelett.md
```

```bash
git add -A && git commit -m "chore: React, MDX, Vitest und Implementierungsplan"
```

---

## Aufgabe 2: Widget-Schema

Das Schema ist die Schnittstelle zum Compiler aus Abschnitt 2. Es beschreibt nicht nur die Form der Parameter, sondern auch eine inhaltliche Bedingung: **jede Kombination zuschaltbarer Schritte braucht ein hinterlegtes Ergebnis.** Sonst zeigt das Widget im Betrieb ein Loch.

**Dateien:**
- Erstellen: `src/widgets/schema.ts`
- Test: `tests/schema.test.ts`

- [ ] **Schritt 1: Den fehlschlagenden Test schreiben**

Datei `tests/schema.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  PipelineProps,
  schluessel,
  findeErgebnis,
  fehlendeKombinationen,
} from '../src/widgets/schema';

const gueltig = {
  einheit: 'Dokument',
  schritte: [
    { id: 'suche', titel: 'Suche', wirkung: 'Holt Kandidaten.' },
    { id: 'rerank', titel: 'Reranker', wirkung: 'Sortiert um.', optional: true, standardAn: false },
    { id: 'kontext', titel: 'Kontext', wirkung: 'Top 3 gehen ans Modell.' },
  ],
  ergebnisse: [
    { wenn: [], ausgabe: [{ text: 'A', treffer: false }], hinweis: 'ohne' },
    { wenn: ['rerank'], ausgabe: [{ text: 'A', treffer: true }], hinweis: 'mit' },
  ],
};

describe('PipelineProps', () => {
  it('nimmt gültige Parameter an und setzt Standardwerte', () => {
    const d = PipelineProps.parse(gueltig);
    expect(d.schritte[0].optional).toBe(false);
    expect(d.schritte[0].standardAn).toBe(true);
    expect(d.einheit).toBe('Dokument');
  });

  it('lehnt weniger als zwei Schritte ab', () => {
    const kaputt = { ...gueltig, schritte: [gueltig.schritte[0]] };
    expect(PipelineProps.safeParse(kaputt).success).toBe(false);
  });
});

describe('schluessel', () => {
  it('ist unabhängig von der Reihenfolge', () => {
    expect(schluessel(['b', 'a'])).toBe(schluessel(['a', 'b']));
  });

  it('bildet die leere Menge auf den leeren String ab', () => {
    expect(schluessel([])).toBe('');
  });
});

describe('findeErgebnis', () => {
  it('findet das Ergebnis unabhängig von der Reihenfolge der aktiven Ids', () => {
    const d = PipelineProps.parse(gueltig);
    expect(findeErgebnis(d.ergebnisse, ['rerank'])?.hinweis).toBe('mit');
    expect(findeErgebnis(d.ergebnisse, [])?.hinweis).toBe('ohne');
  });

  it('gibt undefined zurück, wenn nichts passt', () => {
    const d = PipelineProps.parse(gueltig);
    expect(findeErgebnis(d.ergebnisse, ['gibtesnicht'])).toBeUndefined();
  });
});

describe('fehlendeKombinationen', () => {
  it('meldet nichts bei vollständiger Abdeckung', () => {
    const d = PipelineProps.parse(gueltig);
    expect(fehlendeKombinationen(d)).toEqual([]);
  });

  it('meldet die fehlende Kombination beim Namen', () => {
    const luecke = {
      ...gueltig,
      schritte: [
        ...gueltig.schritte,
        { id: 'bm25', titel: 'BM25', wirkung: 'Sucht wörtlich.', optional: true, standardAn: false },
      ],
    };
    const d = PipelineProps.parse(luecke);
    expect(fehlendeKombinationen(d).sort()).toEqual(['bm25', 'bm25+rerank']);
  });
});

describe('PipelineProps als Schranke', () => {
  it('lehnt zwei Schritte mit derselben id ab', () => {
    const kaputt = {
      ...gueltig,
      schritte: [
        { id: 'doppelt', titel: 'A', wirkung: 'x', optional: true, standardAn: false },
        { id: 'doppelt', titel: 'B', wirkung: 'y', optional: true, standardAn: false },
      ],
    };
    expect(PipelineProps.safeParse(kaputt).success).toBe(false);
  });

  it('lehnt zwei Ergebnisse fuer dieselbe Kombination ab', () => {
    const kaputt = {
      ...gueltig,
      ergebnisse: [
        ...gueltig.ergebnisse,
        { wenn: ['rerank'], ausgabe: [{ text: 'B', treffer: true }], hinweis: 'nochmal' },
      ],
    };
    expect(PipelineProps.safeParse(kaputt).success).toBe(false);
  });

  it('erkennt dieselbe Kombination auch bei anderer Reihenfolge der Ids', () => {
    const kaputt = {
      einheit: 'Dokument',
      schritte: [
        { id: 'eins', titel: 'A', wirkung: 'x', optional: true, standardAn: false },
        { id: 'zwei', titel: 'B', wirkung: 'y', optional: true, standardAn: false },
      ],
      ergebnisse: [
        { wenn: ['eins', 'zwei'], ausgabe: [{ text: 'A', treffer: true }], hinweis: 'a' },
        { wenn: ['zwei', 'eins'], ausgabe: [{ text: 'B', treffer: true }], hinweis: 'b' },
      ],
    };
    expect(PipelineProps.safeParse(kaputt).success).toBe(false);
  });

  it('lehnt Ids mit Sonderzeichen ab, die den Schluessel zerlegen wuerden', () => {
    for (const id of ['a+b', 'a b', 'A', '']) {
      const kaputt = {
        ...gueltig,
        schritte: [
          { id, titel: 'A', wirkung: 'x' },
          { id: 'zweiter', titel: 'B', wirkung: 'y' },
        ],
      };
      expect(PipelineProps.safeParse(kaputt).success).toBe(false);
    }
  });

  it('nimmt die real verwendeten Ids an', () => {
    for (const id of ['suche', 'rerank', 'bm25', 'anfrage', 'vektor', 'kontext']) {
      const ok = {
        ...gueltig,
        schritte: [
          { id, titel: 'A', wirkung: 'x' },
          { id: 'zweiter', titel: 'B', wirkung: 'y' },
        ],
        ergebnisse: [{ wenn: [], ausgabe: [{ text: 'A', treffer: false }], hinweis: 'ohne' }],
      };
      expect(PipelineProps.safeParse(ok).success).toBe(true);
    }
  });

  it('lehnt Ids in wenn ab, die den Schluessel zerlegen wuerden', () => {
    // Dieselbe Gefahr wie bei SchrittSchema.id: ein `+` im Eintrag macht
    // ['a+b'] und ['a', 'b'] zum selben Schluessel.
    const kaputt = {
      ...gueltig,
      ergebnisse: [
        { wenn: ['a+b'], ausgabe: [{ text: 'A', treffer: false }], hinweis: 'x' },
      ],
    };
    expect(PipelineProps.safeParse(kaputt).success).toBe(false);
  });

  it('lehnt zwei Ausgabezeilen mit demselben Text ab', () => {
    const kaputt = {
      ...gueltig,
      ergebnisse: [
        {
          wenn: [],
          ausgabe: [
            { text: 'Nachtrag 7', treffer: true },
            { text: 'Nachtrag 7', treffer: false },
          ],
          hinweis: 'x',
        },
      ],
    };
    expect(PipelineProps.safeParse(kaputt).success).toBe(false);
  });

  it('lehnt einen unbekannten Zusatzschluessel ab, statt ihn still zu verwerfen', () => {
    const kaputt = { ...gueltig, erfundenesFeld: 'aus einer Halluzination' };
    expect(PipelineProps.safeParse(kaputt).success).toBe(false);
  });

  it('nimmt einheitPlural an, verlangt es aber nicht', () => {
    expect(PipelineProps.parse(gueltig).einheitPlural).toBeUndefined();

    const mitPlural = PipelineProps.parse({
      ...gueltig,
      einheit: 'Passage',
      einheitPlural: 'Passagen',
    });
    expect(mitPlural.einheitPlural).toBe('Passagen');
  });

  it('lehnt reinen Leerraum als Titel ab', () => {
    const kaputt = {
      ...gueltig,
      schritte: [
        { id: 'eins', titel: '   ', wirkung: 'x' },
        { id: 'zwei', titel: 'B', wirkung: 'y' },
      ],
    };
    expect(PipelineProps.safeParse(kaputt).success).toBe(false);
  });
});
```

Der zweite Block ist nicht Kür. Das Schema ist die Qualitätsschranke, die der
Compiler aus Abschnitt 2 unverändert importiert; jedes der folgenden Löcher
erzeugt **strukturell gültige** Daten und damit keinen Fehler, sondern nur ein
falsches Ergebnis oder ein lautlos verworfenes Signal:

- Ein `+` in einer Id bricht den kanonischen Schlüssel: `schluessel(['a+b','c'])`
  und `schluessel(['a','b+c'])` liefern beide `'a+b+c'`. Dieselbe Gefahr gilt
  für `wenn`-Einträge, deshalb prüft dasselbe Zeichensatz-Muster beide Stellen.
- Zwei Schritte mit derselben Id lassen `fehlendeKombinationen` dieselbe Lücke
  doppelt melden und erfinden eine Phantom-Kombination `a+a`; in der Komponente
  gäbe es zusätzlich doppelte React-Keys.
- Zwei `ergebnisse`-Einträge mit demselben Schlüssel: `findeErgebnis` nimmt still
  den ersten, und die Abdeckungsprüfung zählt die Dopplung als „vorhanden".
- Zwei `ausgabe`-Zeilen mit demselben Text ergäben in der Pipeline-Komponente
  denselben React-Key — derselbe Grund wie bei den Schritt-Ids, nur auf der
  Ausgabeseite.
- Ein unbekannter Zusatzschlüssel wäre bei `z.object` harmloser Beifang gewesen.
  Er ist stattdessen das wahrscheinlichste Symptom eines halluzinierenden
  Generators, deshalb lehnt `z.strictObject` ihn ab, statt ihn lautlos zu
  verwerfen.

`einheitPlural` ist kein Loch, sondern eine Ergänzung: deutsche Plurale sind
unregelmäßig, „Dokument" plus „en" trägt, „Passage" plus „en" nicht — wo die
Anhängeregel scheitert, kann der Plural ausgeschrieben werden. Das Feld bleibt
optional, der Test dazu prüft nur, dass beide Fälle durchgehen.

- [ ] **Schritt 2: Test laufen lassen, Fehlschlag bestätigen**

```bash
npx vitest run tests/schema.test.ts
```

Erwartet: FAIL — Modul `../src/widgets/schema` nicht auflösbar.

- [ ] **Schritt 3: Minimale Implementierung schreiben**

Datei `src/widgets/schema.ts`:

```typescript
import { z } from 'astro/zod';

/**
 * Erlaubter Zeichensatz für Schritt-Ids — Kleinbuchstaben, Ziffern, einzelne
 * Bindestriche als Trenner.
 *
 * Existiert, damit `schluessel()` eindeutig bleibt: dort werden Ids mit `+`
 * verkettet. Enthielte eine Id selbst ein `+`, wären `['a+b', 'c']` und
 * `['a', 'b+c']` derselbe Schlüssel. Die Regel muss deshalb an *beiden*
 * Stellen gelten, an denen Schritt-Ids auftreten: bei ihrer Definition
 * (`SchrittSchema.id`) und bei ihrer Verwendung (`ErgebnisSchema.wenn`).
 */
const ID_MUSTER = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const ID_MELDUNG =
  'nur Kleinbuchstaben, Ziffern und Bindestrich - keine Leerzeichen oder Sonderzeichen.';

/**
 * Kanonischer Schlüssel einer Menge aktiver Schritt-Ids.
 *
 * Steht bewusst vor den Schema-Definitionen: PipelineProps prüft damit, ob
 * zwei Einträge in `ergebnisse` für dieselbe Kombination gelten.
 *
 * Das Trennzeichen `+` ist nur eindeutig, solange keine Id selbst ein `+`
 * enthält. Dafür sorgt ID_MUSTER.
 */
export function schluessel(ids: readonly string[]): string {
  return [...ids].sort().join('+');
}

// strictObject statt object: ein Zusatzfeld ist hier kein harmloser Beifang,
// sondern das wahrscheinlichste Symptom eines halluzinierenden Generators.
// Lautlos verwerfen hiesse, den Fehler zu verstecken. Gemessen: Astro reicht
// exakt die Schluessel des Aufrufers weiter, Slot-Inhalt geht getrennt nach
// Astro.slots - die Verschaerfung trifft also keinen legitimen Fall.
export const SchrittSchema = z.strictObject({
  id: z.string().regex(ID_MUSTER, ID_MELDUNG),
  titel: z.string().trim().min(1),
  wirkung: z.string().trim().min(1),
  optional: z.boolean().default(false),
  standardAn: z.boolean().default(true),
});

export const AusgabeZeileSchema = z.strictObject({
  text: z.string().trim().min(1),
  treffer: z.boolean(),
});

export const ErgebnisSchema = z
  .strictObject({
    // Dasselbe Muster wie SchrittSchema.id: ein `+` zerlegt den Schluessel
    // hier genauso wie dort.
    wenn: z.array(z.string().regex(ID_MUSTER, ID_MELDUNG)),
    ausgabe: z.array(AusgabeZeileSchema).min(1),
    hinweis: z.string().trim().min(1),
  })
  .refine(
    (e) => new Set(e.ausgabe.map((zeile) => zeile.text)).size === e.ausgabe.length,
    {
      // Die Komponente nutzt den Text als React-key. Doppelte Texte ergaeben
      // doppelte keys - eine Warnung zur Laufzeit statt eines Befunds hier.
      // Verglichen wird der bereits getrimmte Wert, genau der wird key.
      message: 'Zwei Zeilen in ausgabe haben denselben Text.',
      path: ['ausgabe'],
    },
  );

export const PipelineProps = z
  .strictObject({
    einheit: z.string().trim().min(1).default('Dokument'),
    // Deutsche Plurale sind unregelmaessig: "Dokument" + "en" traegt,
    // "Passage" + "en" und "Chunk" + "en" nicht. Wo die Anhaengeregel
    // scheitert, wird der Plural ausgeschrieben.
    einheitPlural: z.string().trim().min(1).optional(),
    // Das Maximum deckelt die 2^n-Laufzeit von fehlendeKombinationen und ist
    // zugleich didaktisch sinnvoll: mehr als acht Stufen liest niemand mehr.
    schritte: z.array(SchrittSchema).min(2).max(8),
    ergebnisse: z.array(ErgebnisSchema).min(1),
  })
  .refine(
    (d) => new Set(d.schritte.map((s) => s.id)).size === d.schritte.length,
    {
      message: 'Zwei Schritte haben dieselbe id.',
      path: ['schritte'],
    },
  )
  .refine(
    (d) => new Set(d.ergebnisse.map((e) => schluessel(e.wenn))).size === d.ergebnisse.length,
    {
      message: 'Zwei Eintraege in ergebnisse gelten fuer dieselbe Kombination.',
      path: ['ergebnisse'],
    },
  );

export type PipelineDaten = z.infer<typeof PipelineProps>;
export type Ergebnis = z.infer<typeof ErgebnisSchema>;

export function findeErgebnis(
  ergebnisse: readonly Ergebnis[],
  aktiv: readonly string[],
): Ergebnis | undefined {
  const gesucht = schluessel(aktiv);
  return ergebnisse.find((e) => schluessel(e.wenn) === gesucht);
}

/**
 * Liefert alle Kombinationen zuschaltbarer Schritte, für die kein Ergebnis
 * hinterlegt ist. Leeres Array heißt: vollständig abgedeckt.
 * Die leere Kombination erscheint als "(keine)".
 */
export function fehlendeKombinationen(daten: PipelineDaten): string[] {
  const optionale = daten.schritte.filter((s) => s.optional).map((s) => s.id);
  const vorhanden = new Set(daten.ergebnisse.map((e) => schluessel(e.wenn)));
  const fehlend: string[] = [];

  for (let maske = 0; maske < 2 ** optionale.length; maske++) {
    const aktiv = optionale.filter((_, i) => (maske >> i) & 1);
    const k = schluessel(aktiv);
    if (!vorhanden.has(k)) fehlend.push(k === '' ? '(keine)' : k);
  }
  return fehlend;
}
```

- [ ] **Schritt 4: Test laufen lassen, Erfolg bestätigen**

```bash
npx vitest run tests/schema.test.ts
```

Erwartet: 18 Tests grün.

Zwei Punkte, die beim Nacharbeiten leicht danebengehen:

- `schluessel` steht **vor** den Schema-Definitionen. Die zweite `.refine()`-Klausel
  ruft die Funktion auf; stünde sie wie sonst üblich unten bei den Hilfsfunktionen,
  griffe die Referenz ins Leere.
- Alle Objekte nutzen `z.strictObject`, nicht `z.object`. Gemessen, nicht vermutet:
  Die `.astro`-Hülle aus Aufgabe 5, Schritt 5 reicht `Astro.props` per Spread an die
  React-Insel weiter, und Astro legt dabei nichts an zusätzlichen Schlüsseln bei —
  ein Zusatzfeld ist also so gut wie immer das Symptom eines halluzinierenden
  Generators, nicht harmloser Beifang. Die eine Ausnahme ist `children`: React
  reicht es bei der Hydration mit, Astro serverseitig nicht. Dafür gibt es in
  Aufgabe 5, Schritt 3 eine eigene Zeile im Widget, keine Lockerung des Schemas.

- [ ] **Schritt 5: Committen**

```bash
git add src/widgets/schema.ts tests/schema.test.ts && git commit -m "feat: Zod-Schema und Hilfsfunktionen fuer das Pipeline-Widget"
```

---

## Aufgabe 3: Deterministisches Mischen

Antwortreihenfolgen müssen gemischt werden, sonst lernt man beim Wiederholen die Position statt das Prinzip. Sie müssen aber **stabil** gemischt werden, sonst ist die Seite nicht reproduzierbar und Tests werden flatterhaft. Also: Mischen mit einem Startwert, der aus der Frage-Id kommt.

**Dateien:**
- Erstellen: `src/lib/mischen.ts`
- Test: `tests/mischen.test.ts`

- [ ] **Schritt 1: Den fehlschlagenden Test schreiben**

Datei `tests/mischen.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { mischen } from '../src/lib/mischen';

const liste = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

describe('mischen', () => {
  it('liefert bei gleichem Startwert immer dieselbe Reihenfolge', () => {
    expect(mischen(liste, 'f1')).toEqual(mischen(liste, 'f1'));
  });

  it('liefert bei verschiedenen Startwerten eine andere Reihenfolge', () => {
    expect(mischen(liste, 'f1')).not.toEqual(mischen(liste, 'f2'));
  });

  it('behält alle Elemente genau einmal', () => {
    expect(mischen(liste, 'f1').slice().sort()).toEqual(liste.slice().sort());
  });

  it('verändert die Eingabeliste nicht', () => {
    const original = [...liste];
    mischen(liste, 'f1');
    expect(liste).toEqual(original);
  });

  it('kommt mit leeren Listen und Einzelelementen zurecht', () => {
    expect(mischen([], 'x')).toEqual([]);
    expect(mischen(['a'], 'x')).toEqual(['a']);
  });

  it('mischt reproduzierbar auf eine fest verankerte Reihenfolge', () => {
    // Anker gegen stille Aenderungen an den Konstanten: Eine vertippte Ziffer
    // in xmur3 oder mulberry32 ergibt weiterhin eine gueltige Permutation,
    // nur eine andere. Nur dieser Test wuerde das bemerken.
    expect(mischen(['a', 'b', 'c', 'd'], 'kb-001')).toEqual(['d', 'a', 'b', 'c']);
  });
});
```

Der letzte Test ist der einzige mit Zähnen. Die fünf davor prüfen **Eigenschaften**
— deterministisch, elementerhaltend, nicht-mutierend. Ein Tippfehler in einer der
Magie-Konstanten, etwa `1779033703` zu `1779033701`, erzeugt weiterhin eine
gültige, deterministische, elementerhaltende Permutation. Nur eine andere: aus
`['d','a','b','c']` wird `['a','d','c','b']`. Alle fünf Eigenschaftstests blieben
grün, während sämtliche Antwortreihenfolgen der App still umspringen.

Der erwartete Wert wird **ausgerechnet, nicht geraten**: Erst implementieren,
dann die echte Funktion einmal laufen lassen und das gemessene Ergebnis eintragen.

- [ ] **Schritt 2: Test laufen lassen, Fehlschlag bestätigen**

```bash
npx vitest run tests/mischen.test.ts
```

Erwartet: FAIL — Modul `../src/lib/mischen` nicht auflösbar.

- [ ] **Schritt 3: Implementierung schreiben**

Datei `src/lib/mischen.ts`:

```typescript
/**
 * xmur3-Hash (bryc, github.com/bryc/code/blob/master/jshash/PRNGs.md).
 * String zu 32-Bit-Startwert. Die Konstanten sind Teil des Algorithmus
 * und duerfen nicht veraendert werden.
 */
function startwert(text: string): number {
  let h = 1779033703 ^ text.length;
  for (let i = 0; i < text.length; i++) {
    h = Math.imul(h ^ text.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h ^= h >>> 16;
  return h >>> 0;
}

/**
 * mulberry32 (bryc, siehe oben). Liefert bei jedem Aufruf eine Zahl in [0, 1) —
 * 1.0 wird nie erreicht. Genau darauf verlaesst sich der Tausch in mischen():
 * nur so bleibt j <= i. Die Konstanten sind Teil des Algorithmus.
 */
function generator(saat: number): () => number {
  let a = saat;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Fisher-Yates mit festem Startwert. Gleiche Liste plus gleicher Startwert
 * ergibt immer dieselbe Reihenfolge. Die Eingabe bleibt unberührt.
 *
 * `saat` muss ueber Builds und Aufrufe hinweg stabil sein (etwa eine Frage-Id) —
 * kein Zeitstempel, kein Zufallswert.
 */
export function mischen<T>(liste: readonly T[], saat: string): T[] {
  const kopie = [...liste];
  const naechste = generator(startwert(saat));
  for (let i = kopie.length - 1; i > 0; i--) {
    const j = Math.floor(naechste() * (i + 1));
    [kopie[i], kopie[j]] = [kopie[j], kopie[i]];
  }
  return kopie;
}
```

- [ ] **Schritt 4: Test laufen lassen, Erfolg bestätigen**

```bash
npx vitest run tests/mischen.test.ts
```

Erwartet: 6 Tests grün.

- [ ] **Schritt 5: Committen**

```bash
git add src/lib/mischen.ts tests/mischen.test.ts && git commit -m "feat: deterministisches Mischen mit Startwert"
```

---

## Aufgabe 4: Multiple-Choice-Komponente

Die Regel aus dem Konzept in Code gegossen: **eine Antwort wird gewählt, danach ist Schluss** — kein zweiter Versuch, weil der nur Ratestrategien belohnt. Und **alle Begründungen werden sichtbar**, nicht nur die zur gewählten Antwort. Dort steckt der Lerneffekt.

**Dateien:**
- Erstellen: `src/components/Frage.tsx`
- Test: `tests/frage.test.tsx`

- [ ] **Schritt 1: Den fehlschlagenden Test schreiben**

Datei `tests/frage.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Frage from '../src/components/Frage';

const daten = {
  id: 'f-test',
  frage: 'Was sortiert ein Reranker?',
  antworten: [
    { text: 'Die Kandidaten', richtig: true, begruendung: 'Genau das ist seine Aufgabe.' },
    { text: 'Den Index', richtig: false, begruendung: 'Den rührt er nicht an.' },
    { text: 'Die Anfrage', richtig: false, begruendung: 'Die bleibt unverändert.' },
  ],
};

function knopf(text: string): HTMLButtonElement {
  return screen.getByRole('button', { name: text }) as HTMLButtonElement;
}

describe('Frage', () => {
  it('zeigt die Frage und alle Antworten', () => {
    render(<Frage {...daten} />);
    expect(screen.getByText('Was sortiert ein Reranker?')).toBeTruthy();
    for (const a of daten.antworten) expect(knopf(a.text)).toBeTruthy();
  });

  it('zeigt vor der Antwort keine Begründung', () => {
    render(<Frage {...daten} />);
    expect(screen.queryByText('Genau das ist seine Aufgabe.')).toBeNull();
    expect(screen.queryByText('Den rührt er nicht an.')).toBeNull();
  });

  it('markiert nach einer falschen Wahl beide Zustände und zeigt alle Begründungen', async () => {
    const nutzer = userEvent.setup();
    render(<Frage {...daten} />);
    await nutzer.click(knopf('Den Index'));

    expect(knopf('Den Index').dataset.zustand).toBe('falsch');
    expect(knopf('Die Kandidaten').dataset.zustand).toBe('richtig');
    expect(knopf('Die Anfrage').dataset.zustand).toBe('neutral');

    for (const a of daten.antworten) expect(screen.getByText(a.begruendung)).toBeTruthy();
  });

  it('markiert eine richtige Wahl als richtig', async () => {
    const nutzer = userEvent.setup();
    render(<Frage {...daten} />);
    await nutzer.click(knopf('Die Kandidaten'));
    expect(knopf('Die Kandidaten').dataset.zustand).toBe('richtig');
  });

  it('lässt keinen zweiten Versuch zu', async () => {
    const nutzer = userEvent.setup();
    render(<Frage {...daten} />);
    await nutzer.click(knopf('Den Index'));

    for (const a of daten.antworten) expect(knopf(a.text).disabled).toBe(true);

    await nutzer.click(knopf('Die Kandidaten'));
    expect(knopf('Den Index').dataset.zustand).toBe('falsch');
  });

  it('mischt stabil: gleiche Id ergibt gleiche Reihenfolge', () => {
    const { unmount } = render(<Frage {...daten} />);
    const erste = screen.getAllByRole('button').map((b) => b.textContent);
    unmount();
    render(<Frage {...daten} />);
    const zweite = screen.getAllByRole('button').map((b) => b.textContent);
    expect(zweite).toEqual(erste);
  });

  it('behaelt die Zuordnung, wenn das Elternteil die Antworten umsortiert', async () => {
    const nutzer = userEvent.setup();
    const { rerender } = render(<Frage {...daten} />);
    await nutzer.click(knopf('Den Index'));
    expect(knopf('Den Index').dataset.zustand).toBe('falsch');

    // Gleiche Objekte, rotierte Reihenfolge - so wie ein Elternteil sie
    // nach einem Re-Render liefern koennte. Bewusst Rotation und kein
    // reverse(): bei drei Elementen bleibt beim Umdrehen das mittlere
    // stehen, und ein Index-Fehler an dieser Stelle bliebe verdeckt.
    const rotiert = [daten.antworten[1], daten.antworten[2], daten.antworten[0]];
    rerender(<Frage {...daten} antworten={rotiert} />);

    expect(knopf('Den Index').dataset.zustand).toBe('falsch');
    expect(knopf('Die Anfrage').dataset.zustand).toBe('neutral');
    expect(knopf('Die Kandidaten').dataset.zustand).toBe('richtig');
  });
});
```

- [ ] **Schritt 2: Test laufen lassen, Fehlschlag bestätigen**

```bash
npx vitest run tests/frage.test.tsx
```

Erwartet: FAIL — Modul `../src/components/Frage` nicht auflösbar.

- [ ] **Schritt 3: Implementierung schreiben**

Datei `src/components/Frage.tsx`:

```tsx
import { useMemo, useState } from 'react';
import { mischen } from '../lib/mischen';

export type Antwort = {
  text: string;
  richtig: boolean;
  begruendung: string;
};

export type FrageProps = {
  id: string;
  frage: string;
  antworten: Antwort[];
};

type Zustand = 'offen' | 'richtig' | 'falsch' | 'neutral';

export default function Frage({ id, frage, antworten }: FrageProps) {
  const gemischt = useMemo(() => mischen(antworten, id), [antworten, id]);
  // Gemerkt wird die Antwort selbst, nicht ihre Position. Eine Position gilt
  // nur fuer genau die Reihenfolge, in der sie entstanden ist: liefert das
  // Elternteil dieselben Antworten spaeter umsortiert, zeigt der Index auf
  // eine andere Antwort, und die Ansicht behauptet eine Wahl, die der Nutzer
  // nie getroffen hat - lautlos, ohne Fehler oder Warnung. Die Objektidentitaet
  // ueberlebt jede Umsortierung.
  const [gewaehlt, setGewaehlt] = useState<Antwort | null>(null);
  const beantwortet = gewaehlt !== null;

  function zustandVon(antwort: Antwort): Zustand {
    if (!beantwortet) return 'offen';
    if (antwort.richtig) return 'richtig';
    if (antwort === gewaehlt) return 'falsch';
    return 'neutral';
  }

  return (
    <div className="frage" data-beantwortet={beantwortet}>
      <p className="frage-text">{frage}</p>
      <ul className="antworten">
        {gemischt.map((antwort) => (
          // Der Text taugt als key, weil das Lektions-Schema doppelte
          // Antworttexte innerhalb einer Frage zurueckweist (normalisiert
          // verglichen). Faellt diese Regel, faellt auch dieser key.
          <li key={antwort.text}>
            <button
              type="button"
              className="antwort"
              data-zustand={zustandVon(antwort)}
              disabled={beantwortet}
              onClick={() => setGewaehlt(antwort)}
            >
              {antwort.text}
            </button>
            {beantwortet && <p className="begruendung">{antwort.begruendung}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

Die Komponente merkt sich die gewählte Antwort selbst, nicht ihren Index — ein
Index gilt nur für die Reihenfolge, in der er entstand, und `gemischt` wird bei
jedem Re-Render neu aus `antworten` berechnet. Reicht ein Elternteil dieselben
Antworten später umsortiert weiter, zeigte ein gemerkter Index auf die falsche
Antwort. Der Regressionstest oben (`behaelt die Zuordnung …`) rotiert die Liste
absichtlich statt sie umzudrehen: Bei drei Elementen bleibt ein `reverse()` beim
mittleren Element stehen und ein Index-Fehler bliebe unbemerkt.

- [ ] **Schritt 4: Test laufen lassen, Erfolg bestätigen**

```bash
npx vitest run tests/frage.test.tsx
```

Erwartet: 7 Tests grün.

- [ ] **Schritt 5: Committen**

```bash
git add src/components/Frage.tsx tests/frage.test.tsx && git commit -m "feat: Multiple-Choice-Komponente mit Begruendungen und ohne Zweitversuch"
```

---

## Aufgabe 5: Pipeline-Widget

Die Komponente prüft ihre eigenen Parameter zur Laufzeit gegen das Schema aus Aufgabe 2 und zeigt bei Verstoß einen sichtbaren Fehlerkasten statt still kaputt zu sein. In Abschnitt 2 prüft der Compiler dieselben Schemata schon vorher — die Laufzeitprüfung bleibt als zweites Netz.

Die Hydration steckt in einer eigenen `.astro`-Hülle mit statischem Import. Das ist die Voraussetzung dafür, dass generiertes MDX das Widget ohne `import`-Zeile benutzen kann.

**Dateien:**
- Erstellen: `src/widgets/Pipeline.tsx`
- Erstellen: `src/widgets/Pipeline.astro`
- Erstellen: `src/widgets/index.ts`
- Test: `tests/schema.test.ts` erweitern

- [ ] **Schritt 1: Test für die Fehlerbehandlung ergänzen**

An das Ende von `tests/schema.test.ts` anfügen:

```typescript
describe('Pipeline-Komponente', () => {
  it('meldet ungültige Parameter, statt still zu scheitern', async () => {
    const { render, screen } = await import('@testing-library/react');
    const { default: Pipeline } = await import('../src/widgets/Pipeline');
    render(<Pipeline schritte={[]} ergebnisse={[]} />);
    expect(screen.getByText(/ungültige Parameter/i)).toBeTruthy();
  });

  it('stolpert nicht über das children-Prop aus der Hydration', async () => {
    // Astro reicht children serverseitig nicht mit, React bei der Hydration
    // schon. Ohne das Verwerfen in Pipeline.tsx weist strictObject es ab und
    // das Widget kippt im Browser in den Fehlerkasten - waehrend Tests, Build
    // und das server-gerenderte HTML unauffaellig bleiben.
    const { render } = await import('@testing-library/react');
    const { default: Pipeline } = await import('../src/widgets/Pipeline');

    // Bewusst gegen `container` gepruft statt gegen `screen`: Weil
    // @testing-library/react hier erst waehrend der Testausfuehrung geladen
    // wird, registriert sich sein afterEach(cleanup) zu spaet - die Hooks der
    // Suite sind da schon eingesammelt. Reste des vorigen Tests bleiben also
    // im document. `container` sieht nur den eigenen Renderbaum.
    const { container } = render(<Pipeline {...gueltig} children={undefined} />);

    expect(container.querySelector('.widget-fehler')).toBeNull();
    expect(container.querySelector('.widget-pipeline')).toBeTruthy();
    expect(container.textContent).toContain('ohne');
  });
});
```

Damit dieser JSX enthält, wird die Datei umbenannt:

```bash
git mv tests/schema.test.ts tests/schema.test.tsx
```

- [ ] **Schritt 2: Test laufen lassen, Fehlschlag bestätigen**

```bash
npx vitest run tests/schema.test.tsx
```

Erwartet: 18 Tests grün, 2 FAIL — Modul `../src/widgets/Pipeline` nicht auflösbar.

- [ ] **Schritt 3: Widget implementieren**

Datei `src/widgets/Pipeline.tsx`:

```tsx
import { useState } from 'react';
import { PipelineProps, findeErgebnis, type PipelineDaten } from './schema';

/**
 * Nimmt bewusst einen ungeprueften Schluessel-Wert-Beutel entgegen statt
 * PipelineDaten: die Parameter kommen aus generiertem MDX, nicht aus
 * handgeschriebenem TSX. Die Schranke ist die Laufzeitpruefung unten, nicht
 * der Typ. `unknown` waere hier falsch - TypeScript leitet daraus fuer JSX
 * `IntrinsicAttributes` ab, womit `<Pipeline schritte={...} />` nicht mehr
 * typpruefbar ist (ts2322).
 */
export default function Pipeline({
  children: _children,
  ...props
}: Record<string, unknown>) {
  // `children` wird verworfen, bevor geprueft wird. Astro reicht es
  // serverseitig nicht mit, React bei der Hydration schon - ohne diese Zeile
  // faellt das Widget im Browser in den Fehlerkasten, waehrend Tests, Build
  // und das server-gerenderte HTML unauffaellig bleiben. Framework-Rauschen,
  // kein Inhalt; die strictObject-Schranke gilt weiter fuer alles andere.
  const geprueft = PipelineProps.safeParse(props);

  if (!geprueft.success) {
    return (
      <div className="widget-fehler">
        <strong>Pipeline: ungültige Parameter</strong>
        <pre>{JSON.stringify(geprueft.error.issues, null, 2)}</pre>
      </div>
    );
  }

  return <Ansicht daten={geprueft.data} />;
}

function Ansicht({ daten }: { daten: PipelineDaten }) {
  const [aktiv, setAktiv] = useState<string[]>(
    daten.schritte.filter((s) => s.optional && s.standardAn).map((s) => s.id),
  );

  const ergebnis = findeErgebnis(daten.ergebnisse, aktiv);

  function umschalten(id: string) {
    setAktiv((vorher) =>
      vorher.includes(id) ? vorher.filter((x) => x !== id) : [...vorher, id],
    );
  }

  return (
    <div className="widget widget-pipeline">
      <ol className="pipeline-schritte">
        {daten.schritte.map((schritt) => {
          const an = !schritt.optional || aktiv.includes(schritt.id);
          return (
            <li key={schritt.id} className="pipeline-schritt" data-an={an} data-optional={schritt.optional}>
              {schritt.optional ? (
                <button
                  type="button"
                  className="schritt-knopf"
                  aria-pressed={an}
                  onClick={() => umschalten(schritt.id)}
                >
                  {schritt.titel}
                </button>
              ) : (
                <span className="schritt-name">{schritt.titel}</span>
              )}
              <p className="schritt-wirkung">{schritt.wirkung}</p>
            </li>
          );
        })}
      </ol>

      <div className="pipeline-ergebnis">
        {ergebnis ? (
          <>
            <ol className="ausgabe">
              {ergebnis.ausgabe.map((zeile) => (
                <li key={zeile.text} data-treffer={zeile.treffer}>
                  {zeile.text}
                </li>
              ))}
            </ol>
            <p className="hinweis">{ergebnis.hinweis}</p>
            <p className="zaehler">
              {ergebnis.ausgabe.filter((z) => z.treffer).length} von {ergebnis.ausgabe.length}{' '}
              {daten.einheitPlural ?? `${daten.einheit}en`} relevant
            </p>
          </>
        ) : (
          <p className="hinweis">Für diese Kombination ist kein Ergebnis hinterlegt.</p>
        )}
      </div>
    </div>
  );
}
```

> **Hinweiskasten — betrifft jedes künftige Widget:** Astro reicht `children`
> serverseitig nicht mit, React bei der Hydration schon. Mit `z.strictObject`
> weist das Schema den Schlüssel sonst ab, und das Widget kippt im Browser in
> den Fehlerkasten — während Tests, `astro check`, `npm run build` und das
> server-gerenderte HTML unauffällig bleiben, weil dort keine Hydration
> stattfindet, die `children` anhängen könnte. Wer Widget Nummer zwei baut,
> braucht dieselbe Zeile: `children` aus den Props herauslösen und verwerfen,
> bevor der Rest gegen das strikte Schema geprüft wird.

- [ ] **Schritt 4: Test laufen lassen, Erfolg bestätigen**

```bash
npx vitest run tests/schema.test.tsx
```

Erwartet: 20 Tests grün.

- [ ] **Schritt 5: Hydrations-Hülle anlegen**

Datei `src/widgets/Pipeline.astro`:

```astro
---
import PipelineInsel from './Pipeline.tsx';
const props = Astro.props;
---
<PipelineInsel client:visible {...props} />
```

Der statische Import ist der Punkt: Astro muss die Komponente zur Bauzeit kennen, um sie hydrieren zu können. Eine dynamisch aus einer Registry gezogene Komponente kann das nicht. Deshalb bekommt jeder Widget-Typ genau eine solche Hülle.

- [ ] **Schritt 6: Registry anlegen**

Datei `src/widgets/index.ts`:

```typescript
import Pipeline from './Pipeline.astro';

/**
 * Bildet die Namen ab, die im MDX-Rumpf benutzt werden dürfen.
 * Generiertes MDX enthält deshalb keine import-Zeilen — der Compiler
 * schreibt nur <Pipeline … />, aufgelöst wird hier.
 */
export const widgets = { Pipeline };
```

- [ ] **Schritt 7: Committen**

```bash
git add src/widgets tests/schema.test.tsx && git commit -m "feat: Pipeline-Widget mit Laufzeitpruefung und Widget-Registry"
```

---

## Aufgabe 6: Content-Collection und Frontmatter-Schema

Hier steht die eigentliche Qualitätsschranke. Das Schema erzwingt, was das Konzept fordert: mindestens zwei und höchstens vier Proben-Fragen, drei bis fünf Antworten je Frage, **genau eine richtige**, und **zu jeder Antwort eine Begründung mit Substanz** — dazu eindeutige Antworttexte und Begründungen innerhalb einer Frage, eindeutige Frage-Ids innerhalb der Lektion, und ein `prinzip`, das ein Satz bleibt, kein Absatz. Was das nicht erfüllt, wird nicht gebaut.

Das Schema steht in einer eigenen Datei, getrennt von der Collection-Definition:
`astro:content` ist nur serverseitig auflösbar, ein Import scheitert unter Vitest
mit „The 'astro:content' module is only available server-side." Stünden die
Zod-Regeln in `content.config.ts`, ließe sich die wichtigste Qualitätsschranke
des Projekts nicht per Unit-Test prüfen und der Lektions-Compiler aus Abschnitt 2
könnte generierten Inhalt nicht vor dem Schreiben validieren.

**Dateien:**
- Erstellen: `src/content/schema.ts`
- Erstellen: `src/content.config.ts`
- Erstellen: `inhalt/lektionen/.gitkeep`
- Test: `tests/content-schema.test.ts`

- [ ] **Schritt 1: Den fehlschlagenden Test schreiben**

Datei `tests/content-schema.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { LektionSchema } from '../src/content/schema';

/**
 * Diese Datei ist der Zweck des Herausloesens: solange die Schemata in
 * src/content.config.ts standen, war ein Import von aussen unmoeglich —
 * `astro:content` scheitert auch unter Vitest mit „The 'astro:content'
 * module is only available server-side.". Der Import oben ist der Nachweis,
 * dass der Schnitt sitzt.
 */

function antwort(text: string, richtig = false, begruendung?: string) {
  return {
    text,
    richtig,
    begruendung: begruendung ?? `Begruendung zu ${text} mit genug Woertern darin.`,
  };
}

function frage(id: string) {
  return {
    id,
    frage: 'Was sortiert ein Reranker?',
    antworten: [antwort('Die Kandidaten', true), antwort('Den Index'), antwort('Die Anfrage')],
  };
}

function lektion(aenderung: Record<string, unknown> = {}) {
  return {
    titel: 'Eine Lektion',
    prinzip: 'Recall entsteht beim Holen, Precision beim Sortieren.',
    reihenfolge: 1,
    fragen: [frage('f-1'), frage('f-2')],
    transfer: frage('f-transfer'),
    quellen: [{ pfad: 'rag_tutorials/hybrid_search_rag' }],
    ...aenderung,
  };
}

describe('LektionSchema - Positivfaelle', () => {
  it('nimmt eine gueltige Minimallektion an', () => {
    const ergebnis = LektionSchema.safeParse(lektion());
    expect(ergebnis.success).toBe(true);
  });

  it('setzt gesperrt auf false, auch nach dem objektweiten refine', () => {
    // Ein .refine() auf dem Objekt darf den Standardwert nicht verschlucken.
    const d = LektionSchema.parse(lektion());
    expect(d.gesperrt).toBe(false);
  });
});

describe('LektionSchema - die sechs Loecher', () => {
  it('1. zaehlt die Laenge erst nach dem Trimmen', () => {
    function mitBegruendung(begruendung: string) {
      return lektion({
        fragen: [
          {
            ...frage('f-1'),
            antworten: [
              antwort('Die Kandidaten', true),
              { text: 'Den Index', richtig: false, begruendung },
              antwort('Die Anfrage'),
            ],
          },
          frage('f-2'),
        ],
      });
    }

    // 20 Leerzeichen bestehen ein min(20) ohne vorheriges trim().
    expect(LektionSchema.safeParse(mitBegruendung(' '.repeat(20))).success).toBe(false);

    // Der schaerfere Fall: fuenf Woerter, mit Leerraum auf ueber 20 Zeichen
    // aufgeblaeht. Die Wortpruefung greift hier nicht - nur die Reihenfolge
    // trim() vor min(20) faengt das ab.
    const aufgeblaeht = 'a b c d e' + ' '.repeat(30);
    expect(aufgeblaeht.length).toBeGreaterThan(20);
    expect(aufgeblaeht.trim().length).toBeLessThan(20);
    expect(aufgeblaeht.trim().split(/\s+/).filter(Boolean).length).toBe(5);
    expect(LektionSchema.safeParse(mitBegruendung(aufgeblaeht)).success).toBe(false);
  });

  it('2. lehnt doppelte Antworttexte ab, auch nur durch Leerraum getrennt', () => {
    const kaputt = lektion({
      fragen: [
        {
          ...frage('f-1'),
          antworten: [antwort('Die Kandidaten', true), antwort('Den Index'), antwort('Den Index ')],
        },
        frage('f-2'),
      ],
    });
    const ergebnis = LektionSchema.safeParse(kaputt);
    expect(ergebnis.success).toBe(false);
    expect(JSON.stringify(ergebnis.error?.issues)).toContain('unterscheiden');
  });

  it('3. lehnt dieselbe Begruendung unter zwei Antworten ab', () => {
    const geteilt = 'Dieselbe Begruendung unter zwei Antworten kopiert.';
    const kaputt = lektion({
      fragen: [
        {
          ...frage('f-1'),
          antworten: [
            antwort('Die Kandidaten', true, geteilt),
            antwort('Den Index', false, geteilt.toUpperCase()),
            antwort('Die Anfrage'),
          ],
        },
        frage('f-2'),
      ],
    });
    const ergebnis = LektionSchema.safeParse(kaputt);
    expect(ergebnis.success).toBe(false);
    expect(JSON.stringify(ergebnis.error?.issues)).toContain('eigene Begründung');
  });

  it('4. lehnt eine Begruendung ohne Substanz ab, obwohl sie lang genug ist', () => {
    const fuellung = 'aaaaaaaaaaaaaaaaaaaa';
    expect(fuellung.length).toBeGreaterThanOrEqual(20);
    const kaputt = lektion({
      fragen: [
        {
          ...frage('f-1'),
          antworten: [
            antwort('Die Kandidaten', true),
            antwort('Den Index', false, fuellung),
            antwort('Die Anfrage'),
          ],
        },
        frage('f-2'),
      ],
    });
    expect(LektionSchema.safeParse(kaputt).success).toBe(false);
  });

  it('5. lehnt eine Kollision zwischen fragen[].id und transfer.id ab', () => {
    const kaputt = lektion({ transfer: frage('f-1') });
    const ergebnis = LektionSchema.safeParse(kaputt);
    expect(ergebnis.success).toBe(false);
    expect(JSON.stringify(ergebnis.error?.issues)).toContain('eindeutig');

    // und ebenso zwei gleiche Ids unter den Fragen selbst
    expect(LektionSchema.safeParse(lektion({ fragen: [frage('f-1'), frage('f-1')] })).success).toBe(
      false,
    );
  });

  it('6. lehnt ein prinzip ab, das ein Absatz statt eines Satzes ist', () => {
    const absatz = 'Wort '.repeat(60).trim();
    expect(absatz.length).toBeGreaterThan(200);
    expect(LektionSchema.safeParse(lektion({ prinzip: absatz })).success).toBe(false);
  });
});
```

Die Beschriftung „die sechs Löcher" ist wörtlich gemeint: jeder der sechs Tests
zielt auf eine Lücke, die eine naive erste Fassung des Schemas hätte — lange
genug statt inhaltsvoll, wortgleich statt eindeutig, kopiert statt eigen,
kollidierend statt eindeutig, Absatz statt Satz. Jede Lücke erzeugt **strukturell
gültige** Daten und damit keinen Fehler, sondern nur eine Lektion, die durchrutscht.

- [ ] **Schritt 2: Test laufen lassen, Fehlschlag bestätigen**

```bash
npx vitest run tests/content-schema.test.ts
```

Erwartet: FAIL — Modul `../src/content/schema` nicht auflösbar.

- [ ] **Schritt 3: Content-Schema schreiben**

Datei `src/content/schema.ts`:

```typescript
import { z } from 'astro/zod';

/**
 * Das Lektions-Schema — bewusst frei von `astro:content`.
 *
 * Der Schnitt ist der Zweck dieser Datei: `src/content.config.ts` importiert
 * `astro:content` und ist damit von aussen nicht ladbar. Ein Import scheitert
 * auch unter Vitest mit „The 'astro:content' module is only available
 * server-side." — die wichtigste Qualitaetsschranke des Projekts liesse sich
 * also nicht im Unit-Test pruefen, und der Lektions-Compiler koennte
 * generierten Inhalt nicht vor dem Schreiben validieren.
 *
 * Hier steht deshalb nur Zod. `defineCollection` bleibt in content.config.ts.
 */

/**
 * Begruendungen sind der Ort, an dem ein Generator am billigsten schummelt:
 * formal lang genug, inhaltlich leer. Die Wortzahl ist eine Heuristik und
 * keine Substanzpruefung — „aaa bbb ccc ddd eee" kommt durch. Sie faengt nur
 * den plumpen Fall der Zeichenfuellung ab, mehr soll sie nicht leisten.
 */
const BegruendungSchema = z
  .string()
  .trim()
  .min(20, 'Jede Antwort braucht eine Begründung mit Substanz.')
  .refine(
    (s) => s.split(/\s+/).filter(Boolean).length >= 5,
    'Begründung braucht mindestens fünf Wörter, keine Zeichenfüllung.',
  );

export const AntwortSchema = z.object({
  text: z.string().trim().min(1),
  richtig: z.boolean(),
  begruendung: BegruendungSchema,
});

export const FrageSchema = z.object({
  id: z.string().trim().min(1),
  frage: z.string().trim().min(1),
  antworten: z
    .array(AntwortSchema)
    .min(3)
    .max(5)
    .refine(
      (a) => a.filter((x) => x.richtig).length === 1,
      'Genau eine Antwort muss richtig sein.',
    )
    // Normalisiert verglichen, nicht exakt: sonst entkommt "Ja " gegen "Ja".
    // Ausserdem haengt der React-key in Frage.tsx an genau diesem Text.
    .refine(
      (a) => new Set(a.map((x) => x.text.trim().toLowerCase())).size === a.length,
      'Antworttexte müssen sich innerhalb einer Frage unterscheiden.',
    )
    .refine(
      (a) => new Set(a.map((x) => x.begruendung.trim().toLowerCase())).size === a.length,
      'Jede Antwort braucht eine eigene Begründung, keine Kopie einer anderen.',
    ),
});

export const QuelleSchema = z.object({
  pfad: z.string().trim().min(1),
  url: z.url().optional(),
});
// Hinweis: z.string().url() ist in Zod 4 verworfen (ts(6385) beim Bauen).
// Deshalb hier direkt z.url().optional() verwendet.

export const LektionSchema = z
  .object({
    titel: z.string().trim().min(1),
    // Zeichenlaenge ist ein Naeherungsmass fuer „ein Satz". Eine Satzzaehlung
    // per Regex ist im Deutschen unzuverlaessig: „z. B.", „u. a." und „Nr. 7"
    // enthalten Punkte, die keine Satzenden sind. Das echte prinzip hat 125
    // Zeichen, die Grenze laesst also reichlich Luft.
    prinzip: z
      .string()
      .trim()
      .min(1)
      .max(200, 'prinzip soll ein Satz sein, kein Absatz (max. 200 Zeichen).'),
    reihenfolge: z.number().int().positive(),
    gesperrt: z.boolean().default(false),
    fragen: z.array(FrageSchema).min(2).max(4),
    transfer: FrageSchema,
    quellen: z.array(QuelleSchema).min(1),
  })
  // `id` ist der einzige Kandidat fuer eine stabile Frage-Identitaet, an der
  // spaeter der Lernfortschritt haengt. Kollidieren zwei, verschmilzt der
  // Fortschritt zweier Fragen lautlos — teuer und schwer zu bemerken.
  // Die Transferfrage zaehlt dabei mit.
  .refine(
    (l) => {
      const ids = [...l.fragen.map((f) => f.id), l.transfer.id];
      return new Set(ids).size === ids.length;
    },
    'fragen[].id und transfer.id müssen innerhalb der Lektion eindeutig sein.',
  );

export type Lektion = z.infer<typeof LektionSchema>;
```

`gesperrt: true` markiert von Hand geschriebene oder nachgebesserte Lektionen. Der Compiler aus Abschnitt 2 wird diese Dateien überspringen. In diesem Abschnitt hat das Feld noch keine Wirkung, aber die Markierung steht damit von Anfang an im Inhalt.

- [ ] **Schritt 4: Content-Konfiguration schreiben**

Datei `src/content.config.ts` — dünn, nur noch die Verbindung zu `astro:content`:

```typescript
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { LektionSchema } from './content/schema';

const lektionen = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './inhalt/lektionen' }),
  schema: LektionSchema,
});

export const collections = { lektionen };
```

- [ ] **Schritt 5: Test laufen lassen, Erfolg bestätigen**

```bash
npx vitest run tests/content-schema.test.ts
```

Erwartet: 8 Tests grün.

- [ ] **Schritt 6: Inhaltsordner anlegen**

```bash
mkdir -p inhalt/lektionen && touch inhalt/lektionen/.gitkeep
```

- [ ] **Schritt 7: Typen erzeugen lassen und prüfen**

```bash
npx astro sync && npx astro check
```

Erwartet: `astro sync` erzeugt `.astro/types.d.ts` ohne Fehler. `astro check` meldet noch keine Nutzung der Collection — das ist in Ordnung.

- [ ] **Schritt 8: Committen**

```bash
git add src/content.config.ts src/content tests/content-schema.test.ts inhalt && git commit -m "feat: Lektions-Collection mit erzwungenen Qualitaetsregeln"
```

---

## Aufgabe 7: Die erste Lektion

Thema mit Absicht gewählt: Es ist genau der Fehler, der beim Betrieb eines RAG für Bauakten am häufigsten falsch behandelt wird — und es passt zum Pipeline-Widget.

**Dateien:**
- Erstellen: `inhalt/lektionen/recall-vor-precision.mdx`

- [ ] **Schritt 1: Die Lektion schreiben**

Datei `inhalt/lektionen/recall-vor-precision.mdx`:

```mdx
---
titel: "Recall und Precision sind zwei Probleme, nicht eins"
prinzip: "Recall entsteht beim Holen, Precision beim Sortieren — repariere sie mit verschiedenen Werkzeugen, und in dieser Reihenfolge."
reihenfolge: 1
gesperrt: true
fragen:
  - id: rvp-1
    frage: "Du hängst einen Reranker hinter die Suche. Welche Größe kann sich dadurch nicht verbessern?"
    antworten:
      - text: "Der Recall der Kandidatenmenge"
        richtig: true
        begruendung: "Der Reranker sortiert nur, was die Suche bereits geholt hat. Ein Dokument, das nicht unter den Kandidaten war, kann er nicht nach oben schieben."
      - text: "Die Precision der obersten fünf Treffer"
        richtig: false
        begruendung: "Genau dafür ist er da. Im Bild oben steigt sie von einem auf drei Treffer, ohne dass die Suche ein einziges Dokument zusätzlich geholt hätte."
      - text: "Die Qualität der Antwort des Modells"
        richtig: false
        begruendung: "Sie steigt mit, weil das Modell besseren Kontext bekommt. Das ist eine Folge, kein Widerspruch."
      - text: "Der Anteil relevanter Dokumente im Kontextfenster"
        richtig: false
        begruendung: "Das ist Precision unter anderem Namen, und die verbessert der Reranker."
  - id: rvp-2
    frage: "Ein bestimmtes Dokument taucht in den Suchergebnissen überhaupt nicht auf, auch nicht unter 200 Kandidaten. Was hilft?"
    antworten:
      - text: "Ein größeres Reranker-Modell einsetzen"
        richtig: false
        begruendung: "Er sortiert nur die Kandidatenmenge. Was nicht darin ist, bleibt draußen, egal wie gut er ist."
      - text: "top_k von 50 auf 200 erhöhen"
        richtig: false
        begruendung: "Wenn es auch unter 200 nicht auftaucht, liegt der Fehler nicht an der Menge, sondern daran, wonach gesucht wird."
      - text: "Eine zweite Suchart danebenstellen, etwa BM25"
        richtig: true
        begruendung: "Wenn semantische Ähnlichkeit das Dokument nicht findet, braucht es eine andere Trefferlogik daneben. Aktenzeichen, Normnummern und Eigennamen verwischt ein Embedding, eine wörtliche Suche nicht."
      - text: "Die Chunks verkleinern"
        richtig: false
        begruendung: "Kleinere Chunks ändern die Granularität, nicht die Art der Ähnlichkeit. Was semantisch danebenliegt, liegt auch in kleineren Stücken daneben."
  - id: rvp-3
    frage: "Warum lautet die Reihenfolge erst Recall, dann Precision — und nicht umgekehrt?"
    antworten:
      - text: "Weil Precision-Maßnahmen auf der Kandidatenmenge aufsetzen und deren Obergrenze nicht überschreiten können"
        richtig: true
        begruendung: "Der Reranker kann höchstens so gut werden, wie die Kandidatenmenge Treffer enthält. Zuerst an der Precision zu arbeiten heißt, gegen eine Decke zu drücken, die man noch anheben könnte."
      - text: "Weil Reranker teurer sind als Vektorsuchen"
        richtig: false
        begruendung: "Stimmt meistens, ist aber ein Kostenargument. Die Reihenfolge folgt aus der Abhängigkeit der beiden Schritte, nicht aus dem Preis."
      - text: "Weil Recall leichter zu messen ist"
        richtig: false
        begruendung: "Eher umgekehrt: Für Recall muss man wissen, was es überhaupt zu finden gäbe. Das ist der schwerer zu beschaffende Wert."
      - text: "Weil ein Reranker mit zu wenigen Kandidaten überanpasst"
        richtig: false
        begruendung: "Reranker lernen nicht an deinen Daten, sie bewerten Paare aus Anfrage und Dokument. Das Problem ist keine Überanpassung, sondern eine Obergrenze."
transfer:
  id: rvp-transfer
  frage: "In einem Bewerbungsverfahren gehen 400 Bewerbungen ein. Ein Stichwortfilter lässt 40 durch, eine Fachjury wählt daraus 5 aus. Die Jury beklagt, unter den 5 sei kaum jemand Passendes. Wo liegt das Problem am wahrscheinlichsten?"
  antworten:
    - text: "Beim Stichwortfilter"
      richtig: true
      begruendung: "Die Jury kann nur aus den 40 wählen, die durchkamen. Sind die Passenden schon im Filter hängengeblieben, ändert auch die beste Jury nichts. Filter und Jury verhalten sich zueinander wie Suche und Reranker."
    - text: "Bei der Jury"
      richtig: false
      begruendung: "Möglich, aber unwahrscheinlicher. Die Jury sieht 40 und wählt 5 — sie hat den kleineren Spielraum. Prüfe zuerst, was gar nicht erst bei ihr ankommt."
    - text: "Bei der Zahl 5"
      richtig: false
      begruendung: "Mehr Plätze ließen mehr Bewerber durch, aber keine besseren. Die Menge ist nicht das Problem, die Auswahlgrundlage ist es."
    - text: "Bei den 400 Bewerbungen"
      richtig: false
      begruendung: "Möglich, wenn niemand Passendes dabei war. Das prüft man aber erst, wenn feststeht, dass der Filter die Passenden nicht aussortiert hat."
quellen:
  - pfad: "rag_tutorials/hybrid_search_rag"
    url: "https://github.com/Shubhamsaboo/awesome-llm-apps/tree/main/rag_tutorials/hybrid_search_rag"
  - pfad: "rag_tutorials/local_hybrid_search_rag"
    url: "https://github.com/Shubhamsaboo/awesome-llm-apps/tree/main/rag_tutorials/local_hybrid_search_rag"
  - pfad: "rag_tutorials/corrective_rag"
    url: "https://github.com/Shubhamsaboo/awesome-llm-apps/tree/main/rag_tutorials/corrective_rag"
---

Deine Suche liefert schlechte Treffer. Die naheliegende Reaktion ist ein besseres Embedding-Modell. Meistens ist das die falsche Baustelle. Denn „schlechte Treffer" zerfällt in zwei Fehler, die entgegengesetzte Gegenmittel verlangen. Fehlt das richtige Dokument schon unter den Kandidaten, hilft nur, anders zu suchen. Ist es dabei, steht aber auf Platz vierzig, hilft nur, besser zu sortieren. Wer beides mit demselben Handgriff behandelt, verschlimmert regelmäßig das eine, während er das andere repariert.

<Pipeline
  einheit="Dokument"
  schritte={[
    { id: 'anfrage', titel: 'Anfrage', wirkung: 'Wer trägt die Kosten für die Bauzeitverlängerung aus Nachtrag 7?' },
    { id: 'vektor', titel: 'Vektorsuche', wirkung: 'Holt 50 Kandidaten. Bestimmt, was überhaupt zur Auswahl steht.' },
    { id: 'bm25', titel: '+ BM25', wirkung: 'Sucht zusätzlich wörtlich. Findet Aktenzeichen und Nummern, die ein Embedding verwischt.', optional: true, standardAn: false },
    { id: 'rerank', titel: '+ Reranker', wirkung: 'Sortiert die Kandidaten neu. Ändert nichts daran, was gefunden wurde.', optional: true, standardAn: false },
    { id: 'kontext', titel: 'Top 5', wirkung: 'Nur diese fünf sieht das Modell.' }
  ]}
  ergebnisse={[
    {
      wenn: [],
      ausgabe: [
        { text: 'Protokoll JF 14 — allgemeiner Terminstand', treffer: false },
        { text: 'Nachtrag 3 — Kostenübernahme Erdarbeiten', treffer: false },
        { text: 'Nachtrag 7 — Bauzeitverlängerung, Kostenträger', treffer: true },
        { text: 'Baustellenordnung, Abschnitt Termine', treffer: false },
        { text: 'Protokoll JF 9 — Verzug Rohbau', treffer: false }
      ],
      hinweis: 'Ein Treffer unter fünf. Das richtige Dokument war unter den 50 Kandidaten — es steht nur zu weit hinten.'
    },
    {
      wenn: ['rerank'],
      ausgabe: [
        { text: 'Nachtrag 7 — Bauzeitverlängerung, Kostenträger', treffer: true },
        { text: 'Nachtrag 7 — Anlage 2: Kostenaufstellung', treffer: true },
        { text: 'Protokoll JF 12 — Beschluss zu Nachtrag 7', treffer: true },
        { text: 'Protokoll JF 9 — Verzug Rohbau', treffer: false },
        { text: 'Nachtrag 3 — Kostenübernahme Erdarbeiten', treffer: false }
      ],
      hinweis: 'Drei Treffer statt einem — und die Suche hat kein einziges Dokument zusätzlich geholt. Die neu erschienenen Zeilen standen längst unter den 50 Kandidaten, nur zu weit hinten für die Top 5.'
    },
    {
      wenn: ['bm25'],
      ausgabe: [
        { text: 'Nachtrag 7 — Bauzeitverlängerung, Kostenträger', treffer: true },
        { text: 'Nachtrag 7 — Anlage 2: Kostenaufstellung', treffer: true },
        { text: 'Baustellenordnung, Abschnitt Termine', treffer: false },
        { text: 'Nachtrag 3 — Kostenübernahme Erdarbeiten', treffer: false },
        { text: 'Protokoll JF 14 — allgemeiner Terminstand', treffer: false }
      ],
      hinweis: 'Die wörtliche Suche zieht „Nachtrag 7" nach oben, weil die Zeichenfolge exakt vorkommt. Das Embedding allein sah zwischen Nachtrag 3 und Nachtrag 7 kaum einen Unterschied.'
    },
    {
      wenn: ['bm25', 'rerank'],
      ausgabe: [
        { text: 'Nachtrag 7 — Bauzeitverlängerung, Kostenträger', treffer: true },
        { text: 'Nachtrag 7 — Anlage 2: Kostenaufstellung', treffer: true },
        { text: 'Protokoll JF 12 — Beschluss zu Nachtrag 7', treffer: true },
        { text: 'Schriftverkehr AG — Anerkennung Bauzeitverlängerung', treffer: true },
        { text: 'Nachtrag 3 — Kostenübernahme Erdarbeiten', treffer: false }
      ],
      hinweis: 'Vier von fünf. Beide Handgriffe wirken auf verschiedene Fehler: BM25 hat die Kandidatenmenge verbessert, der Reranker ihre Reihenfolge.'
    }
  ]}
/>
```

- [ ] **Schritt 2: Prüfen, dass das Schema die Lektion annimmt**

```bash
npx astro sync
```

Erwartet: kein Schemafehler. Bei einem Fehler nennt Astro Datei, Feld und Regel — die Meldung ist die Anleitung zur Korrektur.

- [ ] **Schritt 3: Committen**

```bash
git add inhalt/lektionen/recall-vor-precision.mdx && git commit -m "content: erste Lektion — Recall und Precision sind zwei Probleme"
```

---

## Aufgabe 8: Layouts und die feste Taktfolge

`Lektion.astro` ist der einzige Ort im Projekt, der die Reihenfolge der sechs Takte kennt. Der Inhalt liefert Teile, nicht Struktur.

**Dateien:**
- Erstellen: `src/layouts/Seite.astro`
- Erstellen: `src/layouts/Lektion.astro`
- Erstellen: `src/components/Herkunft.astro`
- Erstellen: `src/styles/global.css`

- [ ] **Schritt 1: HTML-Hülle anlegen**

Datei `src/layouts/Seite.astro`:

```astro
---
import '../styles/global.css';
interface Props {
  titel: string;
}
const { titel } = Astro.props;
---
<html lang="de">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{titel} — Kernbohrung</title>
  </head>
  <body>
    <a class="heim" href="/">Kernbohrung</a>
    <main>
      <slot />
    </main>
  </body>
</html>
```

Astro 7 nutzt einen strengeren Compiler: jedes nicht-leere Element braucht ein schließendes Tag, und ungültige Verschachtelung wird nicht mehr stillschweigend korrigiert.

- [ ] **Schritt 2: Herkunftsangabe anlegen**

Datei `src/components/Herkunft.astro`:

```astro
---
interface Quelle {
  pfad: string;
  url?: string;
}
interface Props {
  quellen: Quelle[];
}
const { quellen } = Astro.props;
---
<ul class="herkunft">
  {quellen.map((quelle) => (
    <li>
      {quelle.url
        ? <a href={quelle.url} rel="noreferrer">{quelle.pfad}</a>
        : <span>{quelle.pfad}</span>}
    </li>
  ))}
</ul>
```

- [ ] **Schritt 3: Lektions-Layout anlegen**

Datei `src/layouts/Lektion.astro`:

```astro
---
import type { CollectionEntry } from 'astro:content';
import { render } from 'astro:content';
import Seite from './Seite.astro';
import Frage from '../components/Frage.tsx';
import Herkunft from '../components/Herkunft.astro';
import { widgets } from '../widgets';

/**
 * Der einzige Ort im Projekt, der die Reihenfolge der sechs Takte kennt.
 *
 * Takt 1 (Der Widerspruch) und Takt 2 (Das Bild) stehen im MDX-Rumpf, Takt 3
 * bis 6 im Frontmatter. Inhalt liefert damit Teile, nie Struktur: eine
 * generierte Lektion kann den Rhythmus nicht umstellen, weil sie ihn gar
 * nicht in der Hand hat.
 *
 * Entscheidend ist die Stellung von Takt 2 vor Takt 3 — erst spielen, dann
 * erklaeren. Wer diese beiden Abschnitte tauscht, kippt die Didaktik, nicht
 * das Layout.
 */
interface Props {
  eintrag: CollectionEntry<'lektionen'>;
}

const { eintrag } = Astro.props;
// `render` ist eine eigenstaendige Funktion, kein `eintrag.render()`.
const { Content } = await render(eintrag);
const daten = eintrag.data;
---
<Seite titel={daten.titel}>
  <article class="lektion">
    <h1>{daten.titel}</h1>

    <section class="takt" data-takt="widerspruch-und-bild">
      {/* `components` loest die Widget-Namen auf, die der Rumpf benutzt.
          Deshalb enthaelt generiertes MDX keine import-Zeilen. */}
      <Content components={widgets} />
    </section>

    <section class="takt" data-takt="satz">
      <p class="prinzip">{daten.prinzip}</p>
    </section>

    <section class="takt" data-takt="probe">
      <h2>Die Probe</h2>
      {daten.fragen.map((frage) => (
        <Frage client:visible id={frage.id} frage={frage.frage} antworten={frage.antworten} />
      ))}
    </section>

    <section class="takt" data-takt="transfer">
      <h2>Der Transfer</h2>
      <Frage
        client:visible
        id={daten.transfer.id}
        frage={daten.transfer.frage}
        antworten={daten.transfer.antworten}
      />
    </section>

    <section class="takt" data-takt="herkunft">
      <h2>Herkunft</h2>
      <Herkunft quellen={daten.quellen} />
    </section>
  </article>
</Seite>
```

- [ ] **Schritt 4: Minimale Formatierung anlegen**

Datei `src/styles/global.css`:

```css
:root {
  color-scheme: light dark;
  --grund: Canvas;
  --schrift: CanvasText;
  --linie: color-mix(in oklab, CanvasText 20%, transparent);
  --treffer: color-mix(in oklab, green 55%, CanvasText);
  --fehl: color-mix(in oklab, crimson 55%, CanvasText);
}

body {
  margin: 0;
  background: var(--grund);
  color: var(--schrift);
  font: 17px/1.6 system-ui, sans-serif;
}

main { max-width: 46rem; margin: 0 auto; padding: 2rem 1.25rem 6rem; }
.heim { display: block; padding: 1rem 1.25rem; font-size: 0.85rem; }

.takt { padding: 2rem 0; border-top: 1px solid var(--linie); }
.prinzip { font-size: 1.25rem; font-weight: 600; }

.pipeline-schritte { display: grid; gap: 0.5rem; padding: 0; list-style: none; }
.pipeline-schritt[data-an='false'] { opacity: 0.4; }
.schritt-wirkung { margin: 0.25rem 0 0; font-size: 0.9rem; }
.pipeline-ergebnis { margin-top: 1.5rem; }
.ausgabe li[data-treffer='true'] { color: var(--treffer); font-weight: 600; }
.ausgabe li[data-treffer='false'] { opacity: 0.55; }
.zaehler { font-variant-numeric: tabular-nums; font-size: 0.9rem; }

.antworten { display: grid; gap: 0.75rem; padding: 0; list-style: none; }
.antwort { display: block; width: 100%; padding: 0.6rem 0.8rem; text-align: left; font: inherit; cursor: pointer; background: transparent; color: inherit; border: 1px solid var(--linie); }
.antwort:disabled { cursor: default; }
.antwort[data-zustand='richtig'] { border-color: var(--treffer); font-weight: 600; }
.antwort[data-zustand='falsch'] { border-color: var(--fehl); }
.begruendung { margin: 0.4rem 0 0; font-size: 0.9rem; opacity: 0.8; }

.widget-fehler { border: 2px solid var(--fehl); padding: 1rem; }
.herkunft { font-size: 0.9rem; }
```

- [ ] **Schritt 5: Committen**

```bash
git add src/layouts src/components/Herkunft.astro src/styles && git commit -m "feat: Layouts mit fester Taktfolge und minimaler Formatierung"
```

---

## Aufgabe 9: Routen

**Dateien:**
- Erstellen: `src/pages/lektion/[...slug].astro`
- Ersetzen: `src/pages/index.astro`

- [ ] **Schritt 1: Lektionsroute anlegen**

Die Route reicht nur den Eintrag durch; gerendert wird im Layout. Deshalb wird hier **kein** `render` importiert.

Datei `src/pages/lektion/[...slug].astro`:

```astro
---
import { getCollection } from 'astro:content';
import Lektion from '../../layouts/Lektion.astro';

export async function getStaticPaths() {
  const lektionen = await getCollection('lektionen');
  return lektionen.map((eintrag) => ({
    params: { slug: eintrag.id },
    props: { eintrag },
  }));
}

const { eintrag } = Astro.props;
---
<Lektion eintrag={eintrag} />
```

- [ ] **Schritt 2: Startseite ersetzen**

Datei `src/pages/index.astro` — vollständiger Inhalt:

```astro
---
import { getCollection } from 'astro:content';
import Seite from '../layouts/Seite.astro';

const lektionen = (await getCollection('lektionen')).sort(
  (a, b) => a.data.reihenfolge - b.data.reihenfolge,
);
---
<Seite titel="Übersicht">
  <h1>Lektionen</h1>
  <ol class="uebersicht">
    {lektionen.map((eintrag) => (
      <li>
        <a href={`/lektion/${eintrag.id}/`}>{eintrag.data.titel}</a>
        <p>{eintrag.data.prinzip}</p>
      </li>
    ))}
  </ol>
</Seite>
```

- [ ] **Schritt 3: Entwicklungsserver starten und ansehen**

```bash
npm run dev
```

Erwartet: Server läuft auf `http://localhost:4321`. Die Startseite listet „Recall und Precision sind zwei Probleme, nicht eins". Der Link führt zur Lektion.

- [ ] **Schritt 4: Committen**

```bash
git add src/pages && git commit -m "feat: Uebersicht und Lektionsroute"
```

---

## Aufgabe 10: Ende-zu-Ende-Abnahme

- [ ] **Schritt 1: Alle Tests laufen lassen**

```bash
npm test
```

Erwartet: 43 Tests grün, aufgeschlüsselt je Datei:

| Datei | Tests |
|---|---|
| `tests/aufbau.test.ts` | 2 |
| `tests/schema.test.tsx` | 20 (18 Schema + 2 Pipeline-Komponente) |
| `tests/mischen.test.ts` | 6 |
| `tests/frage.test.tsx` | 7 |
| `tests/content-schema.test.ts` | 8 |
| **Summe** | **43** |

- [ ] **Schritt 2: Typprüfung**

```bash
npm run check
```

Erwartet: 0 Fehler. Warnungen zu ungenutzten Variablen sind zulässig.

- [ ] **Schritt 3: Produktionsbau**

```bash
npm run build
```

Erwartet: `dist/index.html` und `dist/lektion/recall-vor-precision/index.html` liegen vor.

- [ ] **Schritt 4: Sichtprüfung im Browser**

```bash
npm run preview
```

**Vorbedingung:** Die Prüfung muss in einem **sichtbaren** Browserfenster
stattfinden, nicht in einem minimierten oder verdeckten. Die Inseln (Pipeline
und beide `Frage`-Instanzen) nutzen `client:visible` — Astro hydriert sie erst,
wenn ein `IntersectionObserver` sie im Sichtbereich meldet. Ist das Fenster
verborgen oder die Seite ungescrollt, feuert der Observer nicht, und nichts
hydriert. Das Ergebnis sieht aus wie erwartet — statisches HTML ist ja da —
und reagiert auf nichts. Vor Punkt 2 also erst zum Widget scrollen, vor Punkt 4
zu den Fragen.

Diese sieben Punkte am fertigen Bau abhaken:

1. Die Lektion zeigt die Takte in der Reihenfolge Widerspruch → Bild → Satz → Probe → Transfer → Herkunft.
2. Das Pipeline-Widget reagiert auf beide Schalter, und alle vier Kombinationen zeigen ein Ergebnis — keine zeigt „kein Ergebnis hinterlegt".
3. Mit beiden Schaltern an stehen vier von fünf Dokumenten auf Treffer.
4. Vor dem Antworten ist keine Begründung sichtbar.
5. Nach einer Antwort sind alle Begründungen sichtbar, die richtige Antwort ist markiert, und ein zweiter Klick ändert nichts.
6. Die drei Herkunftslinks öffnen die jeweiligen Verzeichnisse in `awesome-llm-apps`.
7. Nach der Hydration steht **kein** `.widget-fehler` im Dokument (per DevTools-Konsole
   prüfbar: `document.querySelector('.widget-fehler')` liefert `null`). Server-gerendert
   kann das Widget korrekt aussehen und erst beim Hydrieren scheitern — etwa genau dann,
   wenn die `children`-Behandlung aus Aufgabe 5, Schritt 3 fehlt.

- [ ] **Schritt 5: Abschluss committen**

```bash
git add -A && git commit -m "chore: Abschnitt 1 abgeschlossen — eine Lektion laeuft Ende zu Ende"
```

---

## Abnahmekriterium für Abschnitt 1

Eine handgeschriebene Lektion ist im Browser vollständig benutzbar, alle Unit-Tests sind grün, `npm run build` läuft durch, und das Frontmatter-Schema lehnt eine Lektion ab, bei der eine Begründung fehlt oder zwei Antworten als richtig markiert sind. Damit steht das Ziel, auf das der Compiler in Abschnitt 2 hin erzeugt.

## Was Abschnitt 2 übernimmt, ohne es zu ändern

`src/widgets/schema.ts` (Parameterprüfung), `src/content/schema.ts` (Qualitätsregeln), das Frontmatter-Format der Lektion und die Widget-Registry. Der Compiler erzeugt Dateien in `inhalt/lektionen/` und prüft sie gegen genau diese Schemata, bevor er sie schreibt. `src/content.config.ts` bleibt die dünne, nicht separat testbare Verbindung zu `astro:content` und wird nicht importiert.
