# Kernbohrung — Aufgabenfamilie — Implementierungsplan

> **Für agentische Ausführung:** ERFORDERLICHER SUB-SKILL: `superpowers:subagent-driven-development` (empfohlen) oder `superpowers:executing-plans`. Schritte nutzen Checkbox-Syntax (`- [ ]`).

**Ziel:** Der Aufgabentyp wird eine Eigenschaft der Aufgabe statt der App. Vier Typen für Fach- und Regelwissen — `wahl`, `fall`, `zuordnen`, `reihenfolge` — jeder mit Schema, reiner Bewertung und Komponente. Hülle, Ereignis, Speicher und Tutor kennen den Typ nur als Feld.

**Architektur:** Je Typ ein Ordner unter `src/aufgaben/` mit drei Dateien: `schema.ts` (Zod, was der Typ ausdrücken darf), `bewerten.ts` (reine Funktion, ohne React), `<Typ>.tsx` (Darstellung und Bedienung). `src/aufgaben/schema.ts` bildet die diskriminierte Union über `typ`. Die Hülle `src/components/Aufgabe.tsx` ersetzt `Frage.tsx`: Sie führt Zuversicht, Aufzeichnung und Terminplanung und kennt keinen Typ — nur den Vertrag aus `src/aufgaben/vertrag.ts`.

**Stack:** Astro, React, Zod 4 über `astro/zod`, `idb`, `ts-fsrs`, Vitest mit Testing Library und `fake-indexeddb`. **Keine neue Abhängigkeit.**

**Spec:** `docs/superpowers/specs/2026-09-18-aufgabenfamilie-design.md`

---

## Was jeder Ausführende wissen muss

Diese Regeln stammen aus Fehlern, die in diesem Projekt tatsächlich passiert sind.

1. **Das Arbeitsverzeichnis der Bash-Aufrufe wandert nicht mit.** Jeder Aufruf beginnt mit
   `cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && `.
2. **Niemals `git add -A` oder `git add .`** — immer die Dateien einzeln aufzählen.
3. **Commit-Nachrichten über `git commit -F - <<'MSG'`** und nur mit geraden Anführungszeichen. Deutsche Anführungszeichen in einer Bash-Zeichenkette zerlegen den Befehl. Jede Nachricht endet mit der Zeile
   `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
4. **Kein NUL-Byte in eine Datei.** Ein Agent hat einmal eines als Trennzeichen geschrieben; alle Tests blieben grün, aber Git führte die Datei fortan als Binärdatei. Prüfung am Ende jeder Aufgabe:
   `python -c "import sys; print(sum(open(f,'rb').read().count(b'\x00') for f in sys.argv[1:]))" <dateien>` → `0`.
5. **Relative Importe in `schema.ts`- und `bewerten.ts`-Dateien tragen die Endung `.ts`.** Der Grund ist `werkzeug/pruefe-lektion.mjs`: Es lädt `src/content/schema.ts` unter reinem Node, und Node löst relative Importe ohne Endung nicht auf. Unter Vite läuft ohne Endung alles grün weiter — nur der Compiler könnte die Datei nicht mehr öffnen (siehe `tests/node-ladbarkeit.test.ts`). Komponenten (`.tsx`) importieren wie bisher ohne Endung.
6. **Typen aus `schema.ts` immer mit `import type`.** Sonst wandert Zod ins Browserbündel.
7. **TDD:** erst der fehlschlagende Test, dann die Umsetzung. Befehle: ein Test `npx vitest run tests/<datei>`, alle `npm test`, Typen `npm run check`, Bau `npm run build`.
8. **Farben nur über die vorhandenen Token** in `src/styles/global.css`. Ein Farbtoken darf nie nur in einem `@media`- oder `[data-theme]`-Block stehen. Dieser Plan führt kein neues Token ein.
9. **Jede Bedienfläche mindestens 44 × 44 CSS-Pixel.** Gemessen wird am gebauten Stand bei 375 px, nicht geschätzt.
10. **Browserprüfung am gebauten Stand** (`preview_start` mit Name `kernbohrung-bau`, Port 4322), nicht am Dev-Server: Dessen Vite-Zwischenspeicher hat in diesem Projekt schon leere Inseln geliefert. Der Pane malt beim Scrollen unzuverlässig — mit `javascript_tool` messen, nicht mit Bildschirmfotos.

## Präzisierungen gegenüber dem Spec

Vier Stellen sind beim Durchdenken der Umsetzung genauer geworden. Der Spec wird im selben Commit wie dieser Plan nachgezogen.

1. **Die Bewertung reist mit der Abgabe.** `onAbgegeben({ antwort, ergebnis })` trägt bei `wahl`, `zuordnen`, `reihenfolge` die fertige Bewertung; die Hülle hält sie zurück, bis die Zuversicht steht, und löst dann in einem Zug auf. Das ist wörtlich die Reihenfolge der heutigen `Frage.tsx` („erst die Anzeige, dann das Schreiben") und braucht keinen Effekt, der auf einen Phasenwechsel wartet. Nur `fall` liefert `ergebnis: null` und reicht die Bewertung über `onErgebnis` nach — die Phase `zuversicht` gibt es praktisch nur dort.
2. **`vertrag.ts` statt `ergebnis.ts`, `Aufgabentyp.tsx` statt Register.** Der Vertrag hat vier Typen, nicht einen. Und ein `switch` mit `never`-Prüfung ist typsicher, wo eine Abbildung `typ → Komponente` einen Cast bräuchte.
3. **`sachverhalt` und `musterloesung` sind Absätze, kein Markdown.** Ein Markdown-Renderer in der Insel wäre eine neue Abhängigkeit für zwei Felder.
4. **`zuordnen` einspaltig.** Linken Eintrag antippen klappt die rechten direkt darunter auf. Zwei Spalten hätten bei 375 px je rund 135 px — zu schmal für „Selbstkostenerstattungsvertrag".

## Dateistruktur

```
src/aufgaben/
  vertrag.ts                    Ergebnis, Abgabe, AufgabenPhase, TypProps
  schema.ts                     AufgabeSchema (Union), Aufgabe, AufgabenTyp, AUFGABENTYPEN
  Aufgabentyp.tsx               Verteiler: switch über typ
  wahl/schema.ts                WahlSchema, AntwortSchema        (Regeln aus content/schema.ts)
  wahl/bewerten.ts              bewerteWahl
  wahl/Wahl.tsx                 Antwortliste                     (aus Frage.tsx)
  fall/schema.ts                FallSchema, PruefpunktSchema
  fall/bewerten.ts              bewerteFall
  fall/Fall.tsx                 Sachverhalt, Textfeld, Prüfpunkte
  zuordnen/schema.ts            ZuordnenSchema
  zuordnen/bewerten.ts          bewerteZuordnen
  zuordnen/Zuordnen.tsx         einspaltig, Auswahl klappt auf
  reihenfolge/schema.ts         ReihenfolgeSchema
  reihenfolge/startfolge.ts     gemischte, nie schon richtige Anfangsfolge
  reihenfolge/bewerten.ts       bewerteReihenfolge
  reihenfolge/Reihenfolge.tsx   Hoch/Runter-Knöpfe
src/components/
  Aufgabe.tsx                   die Hülle                        (ersetzt Frage.tsx)
  Zuversicht.tsx                unverändert
src/layouts/
  LektionAnsicht.astro          rendert aus daten: Lektion + Slot
  Lektion.astro                 holt beides aus dem Sammlungseintrag
src/content/schema.ts           LektionSchema mit aufgaben statt fragen
src/tutor/typen.ts              Ereignis mit typ, anteil, antwort, merkmal
src/tutor/speicher.ts           Fassung 2, hebeAufV2
src/tutor/kalibrierung.ts       gruppiert nach merkmal
inhalt/lektionen/*.mdx          migriert; dazu pauschal-heisst-nicht-komplett.mdx
tests/
  aufgaben-wahl.test.ts  aufgaben-fall.test.ts  aufgaben-zuordnen.test.ts
  aufgaben-reihenfolge.test.ts  aufgaben-schema.test.ts  node-ladbarkeit-aufgaben.test.ts
  wahl.test.tsx  fall.test.tsx  zuordnen.test.tsx  reihenfolge.test.tsx
  aufgabe.test.tsx              (umbenannt aus frage.test.tsx)
```

---

## Aufgabe 0: Zweig und Ausgangslage

**Dateien:** keine.

- [ ] **Schritt 1: Zweig anlegen**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && git status --short && git switch -c aufgabenfamilie
```
Erwartet: keine Ausgabe von `git status` (sauberer Baum), dann `Switched to a new branch 'aufgabenfamilie'`.

- [ ] **Schritt 2: Ausgangslage festhalten**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && npm test 2>&1 | grep -E "Tests |Test Files " && npm run check 2>&1 | grep -E "^- [0-9]+ error" && npm run build 2>&1 | grep -E "page\(s\)"
```
Erwartet: `Tests  270 passed (270)`, `- 0 errors`, `5 page(s) built`. Weicht eine Zahl ab: anhalten und melden, nicht weitermachen.

---

## Aufgabe 1: Der Vertrag und `wahl` als erster Typ

**Dateien:**
- Neu: `src/aufgaben/vertrag.ts`, `src/aufgaben/wahl/schema.ts`, `src/aufgaben/wahl/bewerten.ts`
- Test: `tests/aufgaben-wahl.test.ts`

`src/content/schema.ts` bleibt in dieser Aufgabe unberührt. Die Regeln stehen damit vorübergehend doppelt; Aufgabe 12 löscht die alte Fassung.

- [ ] **Schritt 1: Den fehlschlagenden Test schreiben**

`tests/aufgaben-wahl.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { WahlSchema } from '../src/aufgaben/wahl/schema';
import { bewerteWahl } from '../src/aufgaben/wahl/bewerten';

function antwort(text: string, richtig = false, begruendung?: string) {
  return {
    text,
    richtig,
    begruendung: begruendung ?? `Begruendung zu ${text} mit genug Woertern darin.`,
  };
}

function wahl(aenderung: Record<string, unknown> = {}) {
  return {
    typ: 'wahl',
    id: 'w-1',
    frage: 'Was sortiert ein Reranker?',
    antworten: [antwort('Die Kandidaten', true), antwort('Den Index'), antwort('Die Anfrage')],
    ...aenderung,
  };
}

type Befund =
  | { success: true }
  | { success: false; error: { issues: readonly { message: string }[] } };

/** Verengt im Typsystem, nicht nur in der Zusicherung — `astro check` liest mit. */
function meldungen(befund: Befund): string {
  if (befund.success) throw new Error('Erwartet war eine Ablehnung.');
  return befund.error.issues.map((i) => i.message).join(' | ');
}

describe('WahlSchema', () => {
  it('nimmt eine gueltige Wahlaufgabe an', () => {
    expect(WahlSchema.safeParse(wahl()).success).toBe(true);
  });

  it('verlangt das Feld typ', () => {
    const { typ: _typ, ...ohne } = wahl();
    expect(WahlSchema.safeParse(ohne).success).toBe(false);
  });

  it('weist ein fremdes Feld zurueck, statt es zu verschlucken', () => {
    // Das wahrscheinlichste Symptom eines Generators, der zwei Typen vermischt.
    expect(WahlSchema.safeParse(wahl({ paare: [] })).success).toBe(false);
  });

  it('weist zwei richtige Antworten zurueck und sagt warum', () => {
    const befund = WahlSchema.safeParse(
      wahl({ antworten: [antwort('A', true), antwort('B', true), antwort('C')] }),
    );
    expect(meldungen(befund)).toMatch(/Genau eine Antwort/);
  });

  it('weist doppelte Antworttexte zurueck, auch nur durch Leerraum getrennt', () => {
    const befund = WahlSchema.safeParse(
      wahl({ antworten: [antwort('Ja', true), antwort('Ja '), antwort('Nein')] }),
    );
    expect(meldungen(befund)).toMatch(/unterscheiden/);
  });

  it('weist eine Begruendung ohne Substanz zurueck, obwohl sie lang genug ist', () => {
    const befund = WahlSchema.safeParse(
      wahl({
        antworten: [antwort('A', true, 'aaaaaaaaaaaaaaaaaaaaaaaaaaaa'), antwort('B'), antwort('C')],
      }),
    );
    expect(meldungen(befund)).toMatch(/fünf Wörter/);
  });
});

describe('bewerteWahl', () => {
  const aufgabe = WahlSchema.parse(wahl());

  it('meldet einen Treffer als richtig, mit vollem Anteil und leerem Merkmal', () => {
    expect(bewerteWahl(aufgabe, 'Die Kandidaten')).toEqual({
      richtig: true,
      anteil: 1,
      antwort: 'Die Kandidaten',
      merkmal: '',
    });
  });

  it('haelt bei einem Fehlgriff fest, WELCHE Antwort gefangen hat', () => {
    // Das Merkmal ist der ganze Zweck: nicht DASS jemand danebenlag, sondern
    // welche Gegenposition ihn faengt.
    expect(bewerteWahl(aufgabe, 'Den Index')).toEqual({
      richtig: false,
      anteil: 0,
      antwort: 'Den Index',
      merkmal: 'Den Index',
    });
  });

  it('wertet einen unbekannten Text als falsch, statt zu werfen', () => {
    expect(bewerteWahl(aufgabe, 'gibt es nicht').richtig).toBe(false);
  });
});
```

- [ ] **Schritt 2: Test laufen lassen, Fehlschlag ansehen**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && npx vitest run tests/aufgaben-wahl.test.ts 2>&1 | tail -12
```
Erwartet: FAIL mit `Failed to resolve import "../src/aufgaben/wahl/schema"`.

- [ ] **Schritt 3: Den Vertrag anlegen**

`src/aufgaben/vertrag.ts`:

```ts
import type { ReactNode } from 'react';

/**
 * Der Vertrag zwischen einem Aufgabentyp und der Huelle.
 *
 * Die Huelle (`src/components/Aufgabe.tsx`) kennt keinen Typ. Sie kennt nur
 * diese Datei: eine Abgabe, ein Ergebnis, vier Phasen. Alles, was einen Typ
 * ausmacht — wie er aussieht, wie man ihn bedient, wie er bewertet —, bleibt
 * in seinem Ordner.
 *
 * Bewusst ohne Laufzeitabhaengigkeit: Der einzige Import ist ein Typ und wird
 * beim Uebersetzen geloescht. Die `bewerten.ts` jedes Typs importiert von hier
 * und muss unter reinem Node ladbar bleiben.
 */

export type Ergebnis = {
  /** Fuer Planer und Kalibrierung. Bleibt binaer, auch bei Teilergebnissen. */
  readonly richtig: boolean;
  /** 0 bis 1. Wird gespeichert, aber noch nicht in die Terminplanung eingerechnet. */
  readonly anteil: number;
  /** Was die lernende Person getan hat, als Text. */
  readonly antwort: string;
  /** Schluessel, unter dem sich Fehlgriffe gruppieren lassen. Leer bei einem Treffer. */
  readonly merkmal: string;
};

export type Abgabe = {
  readonly antwort: string;
  /**
   * Die fertige Bewertung — oder `null`, wenn sie erst NACH der Zuversicht
   * feststehen kann. Das ist nur bei `fall` so: Dort werden die Pruefpunkte
   * erst abgehakt, nachdem die eigene Sicherheit angegeben ist. Wer die
   * Pruefpunkte vorher sieht, schaetzt nicht sein Wissen ein, sondern liest ab.
   */
  readonly ergebnis: Ergebnis | null;
};

/**
 * `offen` -> arbeiten, `abgegeben` -> Zuversicht waehlen, `zuversicht` ->
 * Bewertung nachreichen (nur `fall`), `aufgeloest` -> fertig.
 */
export type AufgabenPhase = 'offen' | 'abgegeben' | 'zuversicht' | 'aufgeloest';

export type TypProps<A> = {
  readonly aufgabe: A;
  readonly phase: AufgabenPhase;
  /** Die Festlegung. Darf mehrfach kommen, solange die Zuversicht aussteht. */
  readonly onAbgegeben: (abgabe: Abgabe) => void;
  /** Die nachgereichte Bewertung. Nur Typen, deren Abgabe `ergebnis: null` trug. */
  readonly onErgebnis: (ergebnis: Ergebnis) => void;
  /**
   * Der Ergebnissatz der Huelle. Der Typ stellt ihn zwischen Aufgabentext und
   * Bedienflaeche: Er ist die Ueberschrift der Aufloesung, die Einzelheiten
   * darunter sind ihre Erlaeuterung. Wer ihn unten anhaengt, laesst erst vier
   * Begruendungen vorlesen und sagt danach, ob es ueberhaupt gestimmt hat.
   */
  readonly ergebnissatz?: ReactNode;
};
```

- [ ] **Schritt 4: Das Schema anlegen**

`src/aufgaben/wahl/schema.ts`:

```ts
import { z } from 'astro/zod';

/**
 * Die Wahlaufgabe: drei bis fuenf Antworten, genau eine richtig.
 *
 * Die Regeln stammen unveraendert aus `src/content/schema.ts`, wo sie bis zur
 * Aufgabenfamilie als `FrageSchema` standen. Neu sind zwei Dinge: das Feld
 * `typ` und `strictObject` statt `object`. Ein fremdes Feld ist hier kein
 * harmloser Beifang, sondern das wahrscheinlichste Symptom eines Generators,
 * der zwei Typen vermischt — lautlos verwerfen hiesse, den Fehler verstecken.
 */

/**
 * Begruendungen sind der Ort, an dem ein Generator am billigsten schummelt:
 * formal lang genug, inhaltlich leer. Die Wortzahl ist eine Heuristik und
 * keine Substanzpruefung — sie faengt nur den plumpen Fall der Zeichenfuellung.
 */
const BegruendungSchema = z
  .string()
  .trim()
  .min(20, 'Jede Antwort braucht eine Begründung mit Substanz.')
  .refine(
    (s) => s.split(/\s+/).filter(Boolean).length >= 5,
    'Begründung braucht mindestens fünf Wörter, keine Zeichenfüllung.',
  );

export const AntwortSchema = z.strictObject({
  text: z.string().trim().min(1),
  richtig: z.boolean(),
  begruendung: BegruendungSchema,
});

export const WahlSchema = z.strictObject({
  typ: z.literal('wahl'),
  id: z.string().trim().min(1),
  frage: z.string().trim().min(1),
  antworten: z
    .array(AntwortSchema)
    .min(3)
    .max(5)
    .refine((a) => a.filter((x) => x.richtig).length === 1, 'Genau eine Antwort muss richtig sein.')
    // Normalisiert verglichen, nicht exakt: sonst entkommt "Ja " gegen "Ja".
    // Ausserdem haengt der React-key in Wahl.tsx an genau diesem Text.
    .refine(
      (a) => new Set(a.map((x) => x.text.trim().toLowerCase())).size === a.length,
      'Antworttexte müssen sich innerhalb einer Frage unterscheiden.',
    )
    .refine(
      (a) => new Set(a.map((x) => x.begruendung.trim().toLowerCase())).size === a.length,
      'Jede Antwort braucht eine eigene Begründung, keine Kopie einer anderen.',
    ),
});

export type Antwort = z.infer<typeof AntwortSchema>;
export type Wahl = z.infer<typeof WahlSchema>;
```

- [ ] **Schritt 5: Die Bewertung anlegen**

`src/aufgaben/wahl/bewerten.ts`:

```ts
import type { Ergebnis } from '../vertrag.ts';
import type { Wahl } from './schema.ts';

/**
 * Bewertet eine Wahl. Rein, ohne React, ohne Speicher.
 *
 * Das Merkmal ist bei einem Fehlgriff der gewaehlte Text: Welche Gegenposition
 * jemanden faengt, ist die eigentliche Auskunft — nicht nur, dass er danebenlag.
 * Ein unbekannter Text gilt als falsch. Die Komponente reicht nur Texte aus der
 * Aufgabe herein; eine reine Funktion soll trotzdem nie werfen.
 */
export function bewerteWahl(aufgabe: Wahl, gewaehlterText: string): Ergebnis {
  const richtig = aufgabe.antworten.some((a) => a.text === gewaehlterText && a.richtig);
  return {
    richtig,
    anteil: richtig ? 1 : 0,
    antwort: gewaehlterText,
    merkmal: richtig ? '' : gewaehlterText,
  };
}
```

- [ ] **Schritt 6: Test laufen lassen**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && npx vitest run tests/aufgaben-wahl.test.ts 2>&1 | grep -E "Tests |×"
```
Erwartet: `Tests  9 passed (9)`.

Mutationsprobe: In `bewerten.ts` vorübergehend `merkmal: richtig ? '' : gewaehlterText` zu `merkmal: gewaehlterText` ändern. Erwartet: der Test „meldet einen Treffer als richtig, mit vollem Anteil und leerem Merkmal" schlägt fehl — ein Treffer trüge sonst ein Fehlgriff-Merkmal und tauchte in der Kalibrierung als Fehlvorstellung auf. Zurücknehmen, Test wieder grün.

- [ ] **Schritt 7: Typen prüfen und committen**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && npm run check 2>&1 | grep -E "^- [0-9]+ error" && git add src/aufgaben/vertrag.ts src/aufgaben/wahl/schema.ts src/aufgaben/wahl/bewerten.ts tests/aufgaben-wahl.test.ts && git commit -q -F - <<'MSG'
feat: Vertrag der Aufgabenfamilie und wahl als erster Typ

Ergebnis, Abgabe, Phase und TypProps sind der ganze Vertrag zwischen
einem Aufgabentyp und der Huelle. wahl uebernimmt die Regeln der
bisherigen FrageSchema unveraendert, bekommt das Feld typ und wird
strictObject: Ein fremdes Feld ist das wahrscheinlichste Symptom eines
Generators, der zwei Typen vermischt.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
MSG
```
Erwartet: `- 0 errors`, danach ein Commit.

---

## Aufgabe 2: `fall` — Schema und Bewertung

**Dateien:**
- Neu: `src/aufgaben/fall/schema.ts`, `src/aufgaben/fall/bewerten.ts`
- Test: `tests/aufgaben-fall.test.ts`

- [ ] **Schritt 1: Den fehlschlagenden Test schreiben**

`tests/aufgaben-fall.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { FallSchema } from '../src/aufgaben/fall/schema';
import { bewerteFall } from '../src/aufgaben/fall/bewerten';

function fall(aenderung: Record<string, unknown> = {}) {
  return {
    typ: 'fall',
    id: 'f-1',
    sachverhalt:
      'Eine Gemeinde vergibt einen Rohbau zum Pauschalpreis. Grundlage ist ein detailliertes Leistungsverzeichnis.',
    aufgabe: 'Wer traegt das Risiko der fehlenden Leistung?',
    pruefpunkte: [
      { text: 'Mengenrisiko und Vollstaendigkeitsrisiko sind getrennt', pflicht: true },
      { text: 'Das Bausoll folgt aus der detaillierten Beschreibung', pflicht: true },
      { text: 'Die Ankuendigung vor der Ausfuehrung ist erwaehnt', pflicht: false },
    ],
    ...aenderung,
  };
}

type Befund =
  | { success: true }
  | { success: false; error: { issues: readonly { message: string }[] } };

function meldungen(befund: Befund): string {
  if (befund.success) throw new Error('Erwartet war eine Ablehnung.');
  return befund.error.issues.map((i) => i.message).join(' | ');
}

describe('FallSchema', () => {
  it('nimmt einen gueltigen Fall an, mit und ohne Musterloesung', () => {
    expect(FallSchema.safeParse(fall()).success).toBe(true);
    expect(FallSchema.safeParse(fall({ musterloesung: 'Der Unternehmer hat recht.' })).success).toBe(true);
  });

  it('verlangt mindestens zwei Pruefpunkte', () => {
    expect(FallSchema.safeParse(fall({ pruefpunkte: [{ text: 'Nur einer', pflicht: true }] })).success).toBe(false);
  });

  it('verlangt mindestens einen wesentlichen Pruefpunkt und sagt warum', () => {
    const befund = FallSchema.safeParse(
      fall({
        pruefpunkte: [
          { text: 'Schoen zu haben', pflicht: false },
          { text: 'Auch schoen zu haben', pflicht: false },
        ],
      }),
    );
    expect(meldungen(befund)).toMatch(/wesentlich/);
  });

  it('weist doppelte Pruefpunkte zurueck, auch nur durch Schreibung getrennt', () => {
    const befund = FallSchema.safeParse(
      fall({
        pruefpunkte: [
          { text: 'Mengenrisiko', pflicht: true },
          { text: 'mengenrisiko ', pflicht: false },
        ],
      }),
    );
    expect(meldungen(befund)).toMatch(/unterscheiden/);
  });

  it('weist einen Sachverhalt ohne Substanz zurueck', () => {
    expect(meldungen(FallSchema.safeParse(fall({ sachverhalt: 'Zu kurz.' })))).toMatch(/Sachverhalt/);
  });

  it('weist ein fremdes Feld zurueck', () => {
    expect(FallSchema.safeParse(fall({ antworten: [] })).success).toBe(false);
  });
});

describe('bewerteFall', () => {
  const aufgabe = FallSchema.parse(fall());
  const text = 'Der Unternehmer hat recht, weil die Leistung nicht beschrieben war.';

  it('ist richtig, wenn alle wesentlichen Punkte abgehakt sind — auch ohne die uebrigen', () => {
    // Die Mutationsprobe dieser Datei: Wer `richtig` aus ALLEN statt aus den
    // wesentlichen Punkten rechnet, faellt genau hier auf.
    expect(bewerteFall(aufgabe, text, [true, true, false])).toEqual({
      richtig: true,
      anteil: 2 / 3,
      antwort: text,
      merkmal: '',
    });
  });

  it('gibt vollen Anteil, wenn alles abgehakt ist', () => {
    expect(bewerteFall(aufgabe, text, [true, true, true]).anteil).toBe(1);
  });

  it('haelt fest, WELCHER wesentliche Punkt fehlte', () => {
    const ergebnis = bewerteFall(aufgabe, text, [true, false, true]);
    expect(ergebnis.richtig).toBe(false);
    expect(ergebnis.anteil).toBe(2 / 3);
    expect(ergebnis.merkmal).toBe('fehlt:2');
  });

  it('nennt mehrere fehlende Punkte in fester Reihenfolge', () => {
    expect(bewerteFall(aufgabe, text, [false, false, false])).toMatchObject({
      richtig: false,
      anteil: 0,
      merkmal: 'fehlt:1,2',
    });
  });

  it('behandelt fehlende Haken als nicht abgehakt, statt zu werfen', () => {
    expect(bewerteFall(aufgabe, text, [true]).merkmal).toBe('fehlt:2');
  });

  it('gibt den geschriebenen Text unveraendert als Antwort zurueck', () => {
    expect(bewerteFall(aufgabe, text, [true, true, true]).antwort).toBe(text);
  });
});
```

- [ ] **Schritt 2: Test laufen lassen, Fehlschlag ansehen**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && npx vitest run tests/aufgaben-fall.test.ts 2>&1 | tail -8
```
Erwartet: FAIL mit `Failed to resolve import "../src/aufgaben/fall/schema"`.

- [ ] **Schritt 3: Das Schema anlegen**

`src/aufgaben/fall/schema.ts`:

```ts
import { z } from 'astro/zod';

/**
 * Der Fall: Sachverhalt lesen, Loesung frei schreiben, gegen Pruefpunkte
 * selbst abhaken.
 *
 * `pflicht` trennt, ohne was die Loesung FALSCH ist, von dem, was schoen
 * waere. Nur die wesentlichen Punkte entscheiden ueber `richtig`; alle
 * zusammen ergeben den Anteil.
 *
 * `sachverhalt` und `musterloesung` sind Absaetze, durch Leerzeile getrennt —
 * kein Markdown. Ein Renderer in der Insel waere eine neue Abhaengigkeit fuer
 * zwei Felder.
 */

export const PruefpunktSchema = z.strictObject({
  text: z.string().trim().min(1),
  pflicht: z.boolean(),
});

export const FallSchema = z.strictObject({
  typ: z.literal('fall'),
  id: z.string().trim().min(1),
  sachverhalt: z
    .string()
    .trim()
    .min(40, 'Ein Sachverhalt braucht Substanz — mindestens vierzig Zeichen.'),
  aufgabe: z.string().trim().min(1),
  pruefpunkte: z
    .array(PruefpunktSchema)
    .min(2)
    .max(8)
    .refine(
      (p) => p.some((x) => x.pflicht),
      'Mindestens ein Prüfpunkt muss wesentlich sein (pflicht: true) — sonst ist jede Lösung richtig.',
    )
    .refine(
      (p) => new Set(p.map((x) => x.text.trim().toLowerCase())).size === p.length,
      'Prüfpunkte müssen sich unterscheiden.',
    ),
  musterloesung: z.string().trim().min(1).optional(),
});

export type Pruefpunkt = z.infer<typeof PruefpunktSchema>;
export type Fall = z.infer<typeof FallSchema>;
```

- [ ] **Schritt 4: Die Bewertung anlegen**

`src/aufgaben/fall/bewerten.ts`:

```ts
import type { Ergebnis } from '../vertrag.ts';
import type { Fall } from './schema.ts';

/**
 * Bewertet einen Fall aus den abgehakten Pruefpunkten. Rein.
 *
 * `richtig` haengt NUR an den wesentlichen Punkten. Der Anteil zaehlt alle.
 * Das Merkmal nennt die fehlenden wesentlichen Punkte als 1-basierte Nummern
 * in fester Reihenfolge — das ist die Auskunft, welcher Punkt jemanden immer
 * wieder faengt. Bekannte Schwaeche: Selbstbewertung ist nachsichtig. Das ist
 * der Preis fuer offline und kostenlos; eine spaetere KI-Rueckmeldung prueft
 * gegen dieselben Pruefpunkte.
 */
export function bewerteFall(aufgabe: Fall, text: string, haken: readonly boolean[]): Ergebnis {
  const gehabt = aufgabe.pruefpunkte.map((_, i) => haken[i] === true);
  const fehlend = aufgabe.pruefpunkte.flatMap((punkt, i) =>
    punkt.pflicht && !gehabt[i] ? [i + 1] : [],
  );
  const richtig = fehlend.length === 0;
  return {
    richtig,
    anteil: gehabt.filter(Boolean).length / aufgabe.pruefpunkte.length,
    antwort: text,
    merkmal: richtig ? '' : `fehlt:${fehlend.join(',')}`,
  };
}
```

- [ ] **Schritt 5: Test laufen lassen**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && npx vitest run tests/aufgaben-fall.test.ts 2>&1 | grep -E "Tests |×"
```
Erwartet: `Tests  12 passed (12)`.

- [ ] **Schritt 6: Mutationsprobe**

Ändere in `bewerten.ts` vorübergehend `punkt.pflicht && !gehabt[i]` zu `!gehabt[i]` und lass den Test laufen. Erwartet: genau der Test „ist richtig, wenn alle wesentlichen Punkte abgehakt sind" schlägt fehl. Änderung zurücknehmen, Test wieder grün.

- [ ] **Schritt 7: Typen prüfen und committen**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && npm run check 2>&1 | grep -E "^- [0-9]+ error" && git add src/aufgaben/fall/schema.ts src/aufgaben/fall/bewerten.ts tests/aufgaben-fall.test.ts && git commit -q -F - <<'MSG'
feat: Aufgabentyp fall - Schema und Bewertung

Sachverhalt, freie Loesung, Selbstbewertung gegen Pruefpunkte. richtig
haengt nur an den wesentlichen Punkten, der Anteil zaehlt alle, das
Merkmal nennt die fehlenden wesentlichen - die Auskunft, welcher Punkt
jemanden immer wieder faengt. Mutationsprobe: richtig aus ALLEN statt
aus den wesentlichen Punkten wird gefangen.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
MSG
```

---

## Aufgabe 3: `zuordnen` — Schema und Bewertung

**Dateien:**
- Neu: `src/aufgaben/zuordnen/schema.ts`, `src/aufgaben/zuordnen/bewerten.ts`
- Test: `tests/aufgaben-zuordnen.test.ts`

- [ ] **Schritt 1: Den fehlschlagenden Test schreiben**

`tests/aufgaben-zuordnen.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { ZuordnenSchema } from '../src/aufgaben/zuordnen/schema';
import { bewerteZuordnen } from '../src/aufgaben/zuordnen/bewerten';

function zuordnen(aenderung: Record<string, unknown> = {}) {
  return {
    typ: 'zuordnen',
    id: 'z-1',
    aufgabe: 'Ordne jeder Vertragsart ihre Verguetungsgrundlage zu.',
    paare: [
      { links: 'Einheitspreisvertrag', rechts: 'Preis je Einheit mal ausgefuehrte Menge' },
      { links: 'Pauschalvertrag', rechts: 'Ein Preis fuer die ganze Leistung' },
      { links: 'Stundenlohnvertrag', rechts: 'Preis je geleisteter Stunde' },
    ],
    ...aenderung,
  };
}

type Befund =
  | { success: true }
  | { success: false; error: { issues: readonly { message: string }[] } };

function meldungen(befund: Befund): string {
  if (befund.success) throw new Error('Erwartet war eine Ablehnung.');
  return befund.error.issues.map((i) => i.message).join(' | ');
}

describe('ZuordnenSchema', () => {
  it('nimmt eine gueltige Aufgabe an und setzt ablenker auf eine leere Liste', () => {
    expect(ZuordnenSchema.parse(zuordnen()).ablenker).toEqual([]);
  });

  it('nimmt bis zu zwei Ablenker an', () => {
    expect(ZuordnenSchema.safeParse(zuordnen({ ablenker: ['Anteil am Gewinn', 'Festes Monatsgehalt'] })).success).toBe(true);
    expect(ZuordnenSchema.safeParse(zuordnen({ ablenker: ['a', 'b', 'c'] })).success).toBe(false);
  });

  it('verlangt mindestens drei Paare', () => {
    expect(ZuordnenSchema.safeParse(zuordnen({ paare: zuordnen().paare.slice(0, 2) })).success).toBe(false);
  });

  it('weist doppelte linke Eintraege zurueck', () => {
    const paare = [
      { links: 'Pauschalvertrag', rechts: 'A' },
      { links: 'pauschalvertrag ', rechts: 'B' },
      { links: 'Stundenlohnvertrag', rechts: 'C' },
    ];
    expect(meldungen(ZuordnenSchema.safeParse(zuordnen({ paare })))).toMatch(/Linke Einträge/);
  });

  it('weist doppelte rechte Eintraege zurueck und sagt warum', () => {
    // Zwei gleiche rechte Eintraege hiessen: zwei richtige Zuordnungen, von
    // denen die Bewertung nur eine kennt.
    const paare = [
      { links: 'A', rechts: 'Dasselbe' },
      { links: 'B', rechts: 'Dasselbe' },
      { links: 'C', rechts: 'Etwas anderes' },
    ];
    expect(meldungen(ZuordnenSchema.safeParse(zuordnen({ paare })))).toMatch(/Rechte Einträge/);
  });

  it('weist einen Ablenker zurueck, der einem rechten Eintrag gleicht', () => {
    const befund = ZuordnenSchema.safeParse(zuordnen({ ablenker: ['preis je geleisteter stunde'] }));
    expect(meldungen(befund)).toMatch(/Ablenker/);
  });

  it('weist ein fremdes Feld zurueck', () => {
    expect(ZuordnenSchema.safeParse(zuordnen({ schritte: [] })).success).toBe(false);
  });
});

describe('bewerteZuordnen', () => {
  const aufgabe = ZuordnenSchema.parse(zuordnen());
  const [ep, pv, sl] = aufgabe.paare.map((p) => p.rechts);

  it('ist richtig, wenn jedes Paar stimmt', () => {
    expect(bewerteZuordnen(aufgabe, [ep, pv, sl])).toEqual({
      richtig: true,
      anteil: 1,
      antwort: `Einheitspreisvertrag→${ep};Pauschalvertrag→${pv};Stundenlohnvertrag→${sl}`,
      merkmal: '',
    });
  });

  it('zaehlt bei einer Vertauschung die richtigen Paare und nennt die falschen', () => {
    const ergebnis = bewerteZuordnen(aufgabe, [pv, ep, sl]);
    expect(ergebnis.richtig).toBe(false);
    expect(ergebnis.anteil).toBe(1 / 3);
    expect(ergebnis.merkmal).toBe(`Einheitspreisvertrag→${pv};Pauschalvertrag→${ep}`);
  });

  it('wertet eine fehlende Zuordnung als falsch, statt zu werfen', () => {
    const ergebnis = bewerteZuordnen(aufgabe, [ep, null, sl]);
    expect(ergebnis.anteil).toBe(2 / 3);
    expect(ergebnis.merkmal).toBe('Pauschalvertrag→');
  });
});
```

- [ ] **Schritt 2: Test laufen lassen, Fehlschlag ansehen**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && npx vitest run tests/aufgaben-zuordnen.test.ts 2>&1 | tail -8
```
Erwartet: FAIL mit `Failed to resolve import "../src/aufgaben/zuordnen/schema"`.

- [ ] **Schritt 3: Das Schema anlegen**

`src/aufgaben/zuordnen/schema.ts`:

```ts
import { z } from 'astro/zod';

/**
 * Zuordnen: jedem linken Eintrag genau einen rechten.
 *
 * Die Reihenfolge von `paare` ist die Loesung; gemischt wird erst in der
 * Darstellung. `ablenker` sind zusaetzliche rechte Eintraege ohne Partner —
 * sie nehmen dem letzten Paar den Ausschluss als Loesungsweg.
 */

const normal = (s: string): string => s.trim().toLowerCase();

const PaarSchema = z.strictObject({
  links: z.string().trim().min(1),
  rechts: z.string().trim().min(1),
});

export const ZuordnenSchema = z
  .strictObject({
    typ: z.literal('zuordnen'),
    id: z.string().trim().min(1),
    aufgabe: z.string().trim().min(1),
    paare: z
      .array(PaarSchema)
      .min(3)
      .max(6)
      .refine(
        (p) => new Set(p.map((x) => normal(x.links))).size === p.length,
        'Linke Einträge müssen sich unterscheiden.',
      )
      .refine(
        (p) => new Set(p.map((x) => normal(x.rechts))).size === p.length,
        'Rechte Einträge müssen sich unterscheiden — sonst gibt es zwei richtige Zuordnungen.',
      ),
    ablenker: z.array(z.string().trim().min(1)).max(2).default([]),
  })
  .refine((a) => {
    const rechts = new Set(a.paare.map((p) => normal(p.rechts)));
    const eigene = new Set(a.ablenker.map(normal));
    return eigene.size === a.ablenker.length && a.ablenker.every((x) => !rechts.has(normal(x)));
  }, 'Ein Ablenker darf keinem rechten Eintrag gleichen und nicht doppelt vorkommen.');

export type Zuordnen = z.infer<typeof ZuordnenSchema>;
```

- [ ] **Schritt 4: Die Bewertung anlegen**

`src/aufgaben/zuordnen/bewerten.ts`:

```ts
import type { Ergebnis } from '../vertrag.ts';
import type { Zuordnen } from './schema.ts';

/**
 * Bewertet eine Zuordnung. Rein.
 *
 * `zuordnung` liegt in der Reihenfolge von `aufgabe.paare`: an Stelle i steht
 * der rechte Eintrag, den die lernende Person dem i-ten linken gegeben hat,
 * oder `null`. Die Antwort nennt alle Paare, das Merkmal nur die falschen —
 * welche Verwechslung jemanden faengt, ist die Auskunft.
 */
export function bewerteZuordnen(
  aufgabe: Zuordnen,
  zuordnung: readonly (string | null)[],
): Ergebnis {
  const paare = aufgabe.paare.map((paar, i) => ({
    links: paar.links,
    soll: paar.rechts,
    ist: zuordnung[i] ?? null,
  }));
  const falsche = paare.filter((p) => p.ist !== p.soll);
  const alsText = (liste: typeof paare): string =>
    liste.map((p) => `${p.links}→${p.ist ?? ''}`).join(';');
  const richtig = falsche.length === 0;
  return {
    richtig,
    anteil: (paare.length - falsche.length) / paare.length,
    antwort: alsText(paare),
    merkmal: richtig ? '' : alsText(falsche),
  };
}
```

- [ ] **Schritt 5: Test laufen lassen**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && npx vitest run tests/aufgaben-zuordnen.test.ts 2>&1 | grep -E "Tests |×"
```
Erwartet: `Tests  10 passed (10)`.

Mutationsprobe: In `bewerten.ts` vorübergehend `p.ist !== p.soll` zu `p.ist === p.soll` ändern — die Bewertung steht dann auf dem Kopf. Erwartet: alle drei Tests von `bewerteZuordnen` schlagen fehl. Zurücknehmen, Test wieder grün.

- [ ] **Schritt 6: Typen prüfen und committen**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && npm run check 2>&1 | grep -E "^- [0-9]+ error" && git add src/aufgaben/zuordnen/schema.ts src/aufgaben/zuordnen/bewerten.ts tests/aufgaben-zuordnen.test.ts && git commit -q -F - <<'MSG'
feat: Aufgabentyp zuordnen - Schema und Bewertung

Die Reihenfolge der Paare ist die Loesung, gemischt wird erst in der
Darstellung. Doppelte rechte Eintraege sind verboten, weil es sonst
zwei richtige Zuordnungen gaebe, von denen die Bewertung nur eine
kennt. Das Merkmal nennt nur die falschen Paare: welche Verwechslung
jemanden faengt.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
MSG
```

---

## Aufgabe 4: `reihenfolge` — Schema, Startfolge und Bewertung

**Dateien:**
- Neu: `src/aufgaben/reihenfolge/schema.ts`, `src/aufgaben/reihenfolge/startfolge.ts`, `src/aufgaben/reihenfolge/bewerten.ts`
- Test: `tests/aufgaben-reihenfolge.test.ts`

- [ ] **Schritt 1: Den fehlschlagenden Test schreiben**

`tests/aufgaben-reihenfolge.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { ReihenfolgeSchema } from '../src/aufgaben/reihenfolge/schema';
import { startfolge } from '../src/aufgaben/reihenfolge/startfolge';
import { bewerteReihenfolge } from '../src/aufgaben/reihenfolge/bewerten';

function reihenfolge(aenderung: Record<string, unknown> = {}) {
  return {
    typ: 'reihenfolge',
    id: 'r-1',
    aufgabe: 'Bringe die Projektstufen in ihre Reihenfolge.',
    schritte: ['Projektvorbereitung', 'Planung', 'Ausfuehrungsvorbereitung', 'Ausfuehrung', 'Projektabschluss'],
    ...aenderung,
  };
}

describe('ReihenfolgeSchema', () => {
  it('nimmt eine gueltige Aufgabe an', () => {
    expect(ReihenfolgeSchema.safeParse(reihenfolge()).success).toBe(true);
  });

  it('verlangt mindestens drei Schritte — zwei sind eine Muenze', () => {
    expect(ReihenfolgeSchema.safeParse(reihenfolge({ schritte: ['Erst', 'Dann'] })).success).toBe(false);
  });

  it('nimmt hoechstens sieben Schritte', () => {
    const acht = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    expect(ReihenfolgeSchema.safeParse(reihenfolge({ schritte: acht })).success).toBe(false);
  });

  it('weist doppelte Schritte zurueck', () => {
    expect(ReihenfolgeSchema.safeParse(reihenfolge({ schritte: ['Planung', 'planung ', 'Bau'] })).success).toBe(false);
  });

  it('weist ein fremdes Feld zurueck', () => {
    expect(ReihenfolgeSchema.safeParse(reihenfolge({ paare: [] })).success).toBe(false);
  });
});

describe('startfolge', () => {
  it('ist eine Permutation und gleicht NIE der richtigen Folge', () => {
    // Bei drei Schritten trifft das Mischen in einem von sechs Faellen die
    // richtige Folge. Ueber 300 Saaten wird der Rotationszweig also sicher
    // durchlaufen — und genau er wird hier geprueft.
    for (let anzahl = 3; anzahl <= 7; anzahl++) {
      for (let s = 0; s < 300; s++) {
        const folge = startfolge(anzahl, `saat-${s}`);
        expect([...folge].sort((a, b) => a - b)).toEqual(Array.from({ length: anzahl }, (_, i) => i));
        expect(folge.every((wert, i) => wert === i)).toBe(false);
      }
    }
  });

  it('ist stabil: gleiche Saat, gleiche Folge', () => {
    expect(startfolge(5, 'r-1')).toEqual(startfolge(5, 'r-1'));
  });
});

describe('bewerteReihenfolge', () => {
  const aufgabe = ReihenfolgeSchema.parse(reihenfolge());

  it('ist richtig, wenn jede Position stimmt', () => {
    expect(bewerteReihenfolge(aufgabe, [0, 1, 2, 3, 4])).toEqual({
      richtig: true,
      anteil: 1,
      antwort: '1,2,3,4,5',
      merkmal: '',
    });
  });

  it('zaehlt die Schritte an richtiger Position und nennt die abgegebene Folge', () => {
    // Zwei Nachbarn vertauscht: drei von fuenf stehen richtig.
    expect(bewerteReihenfolge(aufgabe, [0, 2, 1, 3, 4])).toEqual({
      richtig: false,
      anteil: 3 / 5,
      antwort: '1,3,2,4,5',
      merkmal: '1,3,2,4,5',
    });
  });

  it('wertet eine unvollstaendige Folge als falsch, statt zu werfen', () => {
    expect(bewerteReihenfolge(aufgabe, [0, 1]).richtig).toBe(false);
  });
});
```

- [ ] **Schritt 2: Test laufen lassen, Fehlschlag ansehen**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && npx vitest run tests/aufgaben-reihenfolge.test.ts 2>&1 | tail -8
```
Erwartet: FAIL mit `Failed to resolve import "../src/aufgaben/reihenfolge/schema"`.

- [ ] **Schritt 3: Das Schema anlegen**

`src/aufgaben/reihenfolge/schema.ts`:

```ts
import { z } from 'astro/zod';

/**
 * Reihenfolge: Schritte in die richtige Folge bringen.
 *
 * `schritte` steht in der RICHTIGEN Reihenfolge; gemischt wird erst in der
 * Darstellung (`startfolge.ts`). Mindestens drei: Zwei Schritte sind eine
 * Muenze, keine Aufgabe.
 */
export const ReihenfolgeSchema = z.strictObject({
  typ: z.literal('reihenfolge'),
  id: z.string().trim().min(1),
  aufgabe: z.string().trim().min(1),
  schritte: z
    .array(z.string().trim().min(1))
    .min(3)
    .max(7)
    .refine(
      (s) => new Set(s.map((x) => x.trim().toLowerCase())).size === s.length,
      'Schritte müssen sich unterscheiden.',
    ),
});

export type Reihenfolge = z.infer<typeof ReihenfolgeSchema>;
```

- [ ] **Schritt 4: Die Startfolge anlegen**

`src/aufgaben/reihenfolge/startfolge.ts`:

```ts
import { mischen } from '../../lib/mischen.ts';

/**
 * Die Folge, in der die Schritte anfangs dastehen — als Indizes in `schritte`.
 *
 * Gemischt mit der Aufgaben-Id als Saat: gleiche Aufgabe, gleiche Anfangsfolge,
 * ueber Builds und Geraete hinweg. Trifft das Mischen zufaellig die richtige
 * Folge, wird um eine Stelle rotiert — sonst stuende die Loesung schon da und
 * "Abgeben" waere die ganze Aufgabe. Das ist eine Eigenschaft der Darstellung
 * und steht deshalb hier, nicht im Schema.
 */
export function startfolge(anzahl: number, saat: string): number[] {
  const gemischt = mischen(
    Array.from({ length: anzahl }, (_, i) => i),
    saat,
  );
  const schonRichtig = gemischt.every((wert, i) => wert === i);
  return schonRichtig ? [...gemischt.slice(1), gemischt[0]] : gemischt;
}
```

- [ ] **Schritt 5: Die Bewertung anlegen**

`src/aufgaben/reihenfolge/bewerten.ts`:

```ts
import type { Ergebnis } from '../vertrag.ts';
import type { Reihenfolge } from './schema.ts';

/**
 * Bewertet eine abgegebene Folge. Rein.
 *
 * `folge[i]` ist der Index des Schritts, der an Stelle i steht. Richtig ist
 * die Folge 0, 1, 2, … Die Antwort nennt die Folge 1-basiert, damit sie sich
 * in der Historie lesen laesst; das Merkmal ist bei einem Fehlgriff dieselbe
 * Folge — welche Verdrehung jemanden faengt.
 */
export function bewerteReihenfolge(aufgabe: Reihenfolge, folge: readonly number[]): Ergebnis {
  const anzahl = aufgabe.schritte.length;
  const treffer = aufgabe.schritte.filter((_, i) => folge[i] === i).length;
  const richtig = folge.length === anzahl && treffer === anzahl;
  const antwort = folge.map((i) => i + 1).join(',');
  return { richtig, anteil: treffer / anzahl, antwort, merkmal: richtig ? '' : antwort };
}
```

- [ ] **Schritt 6: Test laufen lassen**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && npx vitest run tests/aufgaben-reihenfolge.test.ts 2>&1 | grep -E "Tests |×"
```
Erwartet: `Tests  10 passed (10)`.

Mutationsprobe an der Stelle, die am meisten wehtut: In `startfolge.ts` vorübergehend immer `gemischt` zurückgeben (die Rotation weglassen). Erwartet: der Test „ist eine Permutation und gleicht NIE der richtigen Folge" schlägt fehl — ohne die Rotation stünde bei jeder sechsten Aufgabe mit drei Schritten die Lösung schon da, und „Abgeben" wäre die ganze Aufgabe. Zurücknehmen, Test wieder grün.

- [ ] **Schritt 7: Typen prüfen und committen**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && npm run check 2>&1 | grep -E "^- [0-9]+ error" && git add src/aufgaben/reihenfolge/schema.ts src/aufgaben/reihenfolge/startfolge.ts src/aufgaben/reihenfolge/bewerten.ts tests/aufgaben-reihenfolge.test.ts && git commit -q -F - <<'MSG'
feat: Aufgabentyp reihenfolge - Schema, Startfolge, Bewertung

schritte steht in der richtigen Folge, gemischt wird erst in der
Darstellung. Trifft das Mischen zufaellig die richtige Folge, wird
rotiert - sonst stuende die Loesung schon da. Das ist eine Eigenschaft
der Darstellung und steht deshalb in startfolge.ts, nicht im Schema.
Geprueft ueber 300 Saaten je Laenge, damit der Rotationszweig sicher
durchlaufen wird.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
MSG
```

---

## Aufgabe 5: Die Union und die Ladbarkeit unter Node

**Dateien:**
- Neu: `src/aufgaben/schema.ts`
- Test: `tests/aufgaben-schema.test.ts`, `tests/node-ladbarkeit-aufgaben.test.ts`

- [ ] **Schritt 1: Die fehlschlagenden Tests schreiben**

`tests/aufgaben-schema.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { AufgabeSchema, AUFGABENTYPEN } from '../src/aufgaben/schema';

const begruendung = (n: number) => `Begruendung Nummer ${n} mit genug Woertern darin.`;

const muster = {
  wahl: {
    typ: 'wahl',
    id: 'a-1',
    frage: 'Eine Frage?',
    antworten: [
      { text: 'Richtig', richtig: true, begruendung: begruendung(1) },
      { text: 'Falsch A', richtig: false, begruendung: begruendung(2) },
      { text: 'Falsch B', richtig: false, begruendung: begruendung(3) },
    ],
  },
  fall: {
    typ: 'fall',
    id: 'a-2',
    sachverhalt: 'Ein Sachverhalt, der lang genug ist, um als Sachverhalt durchzugehen.',
    aufgabe: 'Wer hat recht?',
    pruefpunkte: [
      { text: 'Der wesentliche Punkt', pflicht: true },
      { text: 'Der schoene Punkt', pflicht: false },
    ],
  },
  zuordnen: {
    typ: 'zuordnen',
    id: 'a-3',
    aufgabe: 'Ordne zu.',
    paare: [
      { links: 'A', rechts: 'eins' },
      { links: 'B', rechts: 'zwei' },
      { links: 'C', rechts: 'drei' },
    ],
  },
  reihenfolge: { typ: 'reihenfolge', id: 'a-4', aufgabe: 'Ordne.', schritte: ['erst', 'dann', 'zuletzt'] },
} as const;

describe('AufgabeSchema', () => {
  it.each(AUFGABENTYPEN)('nimmt ein gueltiges Muster vom Typ %s an', (typ) => {
    expect(AufgabeSchema.safeParse(muster[typ]).success).toBe(true);
  });

  it('kennt genau die vier Typen, in fester Reihenfolge', () => {
    expect([...AUFGABENTYPEN]).toEqual(['wahl', 'fall', 'zuordnen', 'reihenfolge']);
  });

  it('weist einen unbekannten Typ zurueck', () => {
    expect(AufgabeSchema.safeParse({ ...muster.wahl, typ: 'lueckentext' }).success).toBe(false);
  });

  it('weist eine Aufgabe ohne typ zurueck — Migration statt stiller Voreinstellung', () => {
    const { typ: _typ, ...ohne } = muster.wahl;
    expect(AufgabeSchema.safeParse(ohne).success).toBe(false);
  });

  it('weist einen Mischtyp zurueck', () => {
    // Genau das, was ein halluzinierender Generator liefert: der eine Typ,
    // mit den Feldern eines anderen.
    expect(AufgabeSchema.safeParse({ ...muster.wahl, paare: muster.zuordnen.paare }).success).toBe(false);
    expect(AufgabeSchema.safeParse({ ...muster.zuordnen, schritte: ['a', 'b', 'c'] }).success).toBe(false);
  });

  it('prueft auch in der Union die Regel ueber zwei Felder hinweg', () => {
    // Der Ablenker-Vergleich ist ein refine auf dem ganzen Objekt. Er muss den
    // Weg durch die diskriminierte Union ueberleben.
    expect(AufgabeSchema.safeParse({ ...muster.zuordnen, ablenker: ['EINS'] }).success).toBe(false);
  });
});
```

`tests/node-ladbarkeit-aufgaben.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

/**
 * Derselbe Vertrag wie in `tests/node-ladbarkeit.test.ts`, fuer die Aufgaben.
 *
 * `werkzeug/pruefe-lektion.mjs` laedt `src/content/schema.ts` unter reinem
 * Node, und das zieht ab Aufgabe 12 diese Union mit. Ein einziger relativer
 * Import ohne Dateiendung genuegt, und der Compiler kann keine Lektion mehr
 * pruefen — waehrend unter Vite alles gruen weiterlaeuft.
 */

const wurzel = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const modulUrl = pathToFileURL(path.join(wurzel, 'src', 'aufgaben', 'schema.ts')).href;

describe('aufgaben/schema.ts aus einem reinen Node-Prozess', () => {
  it('laesst sich ohne Astro, Vite und Vitest laden und weist Unsinn ab', () => {
    const skript = `
      const { AufgabeSchema, AUFGABENTYPEN } = await import(${JSON.stringify(modulUrl)});
      const unsinn = AufgabeSchema.safeParse({ typ: 'gibt-es-nicht', id: 'x' });
      const gut = AufgabeSchema.safeParse({ typ: 'reihenfolge', id: 'r', aufgabe: 'Ordne.', schritte: ['a', 'b', 'c'] });
      process.stdout.write(JSON.stringify({ typen: [...AUFGABENTYPEN], unsinn: unsinn.success, gut: gut.success }));
    `;
    const ausgabe = execFileSync(process.execPath, ['--input-type=module', '-e', skript], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    expect(JSON.parse(ausgabe)).toEqual({
      typen: ['wahl', 'fall', 'zuordnen', 'reihenfolge'],
      unsinn: false,
      gut: true,
    });
  });
});
```

- [ ] **Schritt 2: Tests laufen lassen, Fehlschlag ansehen**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && npx vitest run tests/aufgaben-schema.test.ts tests/node-ladbarkeit-aufgaben.test.ts 2>&1 | tail -10
```
Erwartet: beide FAIL — `Failed to resolve import "../src/aufgaben/schema"` bzw. ein Fehler des Node-Unterprozesses (`ERR_MODULE_NOT_FOUND`).

- [ ] **Schritt 3: Die Union anlegen**

`src/aufgaben/schema.ts`:

```ts
import { z } from 'astro/zod';
import { WahlSchema } from './wahl/schema.ts';
import { FallSchema } from './fall/schema.ts';
import { ZuordnenSchema } from './zuordnen/schema.ts';
import { ReihenfolgeSchema } from './reihenfolge/schema.ts';

/**
 * Die Aufgabenfamilie als diskriminierte Union ueber `typ`.
 *
 * Ein Generator kann damit keinen Mischtyp erfinden: `typ` waehlt genau ein
 * Schema, und jedes davon ist ein `strictObject`. Ein neuer Typ ist ein neuer
 * Ordner und eine Zeile hier — Huelle, Ereignis, Speicher und Tutor bleiben,
 * wie sie sind.
 *
 * Die Importe tragen die Endung `.ts`: Diese Datei wird ueber
 * `src/content/schema.ts` von `werkzeug/pruefe-lektion.mjs` unter reinem Node
 * geladen, und Node loest relative Importe ohne Endung nicht auf.
 */
export const AufgabeSchema = z.discriminatedUnion('typ', [
  WahlSchema,
  FallSchema,
  ZuordnenSchema,
  ReihenfolgeSchema,
]);

export type Aufgabe = z.infer<typeof AufgabeSchema>;
export type AufgabenTyp = Aufgabe['typ'];

/** In dieser Reihenfolge fuehrt die Oberflaeche die Typen auf. */
export const AUFGABENTYPEN = ['wahl', 'fall', 'zuordnen', 'reihenfolge'] as const;
```

- [ ] **Schritt 4: Tests laufen lassen**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && npx vitest run tests/aufgaben-schema.test.ts tests/node-ladbarkeit-aufgaben.test.ts 2>&1 | grep -E "Tests |×"
```
Erwartet: `Tests  10 passed (10)` (neun in der Union, einer unter Node).

Schlägt schon der **Import** von `schema.ts` fehl, weil `z.discriminatedUnion` das mit `.refine()` versehene `ZuordnenSchema` nicht als Mitglied nimmt: Dann — und nur dann — wandert der Ablenker-Vergleich aus `zuordnen/schema.ts` an die Union. In `zuordnen/schema.ts` das abschließende `.refine(...)` entfernen und als exportierte Funktion bereitstellen:

```ts
/** Der Vergleich ueber zwei Felder hinweg. Haengt an der Union, siehe aufgaben/schema.ts. */
export function ablenkerSindSauber(a: { paare: { rechts: string }[]; ablenker: string[] }): boolean {
  const rechts = new Set(a.paare.map((p) => normal(p.rechts)));
  const eigene = new Set(a.ablenker.map(normal));
  return eigene.size === a.ablenker.length && a.ablenker.every((x) => !rechts.has(normal(x)));
}
```

und in `aufgaben/schema.ts` anhängen:

```ts
.refine(
  (a) => a.typ !== 'zuordnen' || ablenkerSindSauber(a),
  'Ein Ablenker darf keinem rechten Eintrag gleichen und nicht doppelt vorkommen.',
)
```

In `tests/aufgaben-zuordnen.test.ts` prüft der Ablenker-Test dann `AufgabeSchema` statt `ZuordnenSchema`. Den Umweg im Commit benennen.

- [ ] **Schritt 5: Typen prüfen und committen**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && npm run check 2>&1 | grep -E "^- [0-9]+ error" && git add src/aufgaben/schema.ts tests/aufgaben-schema.test.ts tests/node-ladbarkeit-aufgaben.test.ts && git commit -q -F - <<'MSG'
feat: Aufgabenfamilie als diskriminierte Union

typ waehlt genau ein Schema, jedes ist ein strictObject - ein Mischtyp
ist damit nicht ausdrueckbar. Dazu ein Test, der die Union aus einem
echten Node-Unterprozess laedt: pruefe-lektion.mjs zieht sie ab der
Umstellung des Lektionsschemas mit, und ein relativer Import ohne
Endung wuerde den Compiler lahmlegen, waehrend unter Vite alles gruen
bleibt.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
MSG
```

---

## Aufgabe 6: Ereignis und Speicher auf Fassung 2

Das Ereignis bekommt `typ`, `anteil`, `antwort`, `merkmal`; `gewaehlt` entfällt. Der Speicher hebt vorhandene Ereignisse beim Öffnen in die neue Form. `frage` bleibt als Kennung der Aufgabe: Es ist der Schlüssel in `reife.ts`, `auswahl.ts` und im keyPath des Kartenspeichers.

**Dateien:**
- Ändern: `src/tutor/typen.ts`, `src/tutor/speicher.ts`, `src/tutor/kalibrierung.ts`, `src/components/Frage.tsx`
- Test ändern: `tests/speicher.test.ts`, `tests/kalibrierung.test.ts`, `tests/reife.test.ts`, `tests/auswahl.test.ts`, `tests/frage.test.tsx`

- [ ] **Schritt 1: Den fehlschlagenden Test schreiben**

In `tests/speicher.test.ts` den Import aus `../src/tutor/speicher` um `hebeAufV2` ergänzen und **am Ende der Datei** anhängen:

```ts
/**
 * Der echte Aufstieg, nicht der erfundene.
 *
 * Die Beschreibung oben faehrt die Leiter mit einer Fassung, die es nicht
 * gibt. Hier laeuft der Schritt, der wirklich ausgeliefert wird: Ein Bestand,
 * der mit `gewaehlt` geschrieben wurde, muss vollstaendig in der neuen Form
 * ankommen — sonst steht in einem halben Jahr eine Landkarte da, die die
 * ersten Wochen nicht kennt.
 */
describe('Aufstieg auf Fassung 2: Ereignisse bekommen den Aufgabentyp', () => {
  const NUR_FASSUNG_1 = SCHRITTE.slice(0, 1);

  const alterTreffer = {
    lektion: 'rvp',
    frage: 'rvp-2',
    zuversicht: 'eher',
    richtig: true,
    gewaehlt: 'Die Kandidatenmenge',
    dauerMs: 700,
    zeitpunkt: '2026-09-16T09:01:00.000Z',
  };
  const alterFehlgriff = {
    lektion: 'rvp',
    frage: 'rvp-1',
    zuversicht: 'sicher',
    richtig: false,
    gewaehlt: 'Ein Reranker dahinter',
    dauerMs: 900,
    zeitpunkt: '2026-09-16T09:00:00.000Z',
  };

  it('hebt einen Bestand aus Fassung 1 vollstaendig in die neue Form', async () => {
    const name = neuerName();
    // Von Hand und untypisiert: Der heutige Typ kennt `gewaehlt` nicht mehr,
    // der alte Bestand auf fremden Festplatten schon.
    const alt = await idbOeffner(name, NUR_FASSUNG_1)();
    const roh = alt as unknown as IDBPDatabase;
    await roh.add('ereignisse', alterFehlgriff);
    await roh.add('ereignisse', alterTreffer);
    alt.close();

    const neu = speicher(idbOeffner(name, SCHRITTE));
    expect(await neu.ereignisse()).toEqual([
      {
        lektion: 'rvp',
        frage: 'rvp-1',
        typ: 'wahl',
        zuversicht: 'sicher',
        richtig: false,
        anteil: 0,
        antwort: 'Ein Reranker dahinter',
        merkmal: 'Ein Reranker dahinter',
        dauerMs: 900,
        zeitpunkt: '2026-09-16T09:00:00.000Z',
      },
      {
        lektion: 'rvp',
        frage: 'rvp-2',
        typ: 'wahl',
        zuversicht: 'eher',
        richtig: true,
        anteil: 1,
        antwort: 'Die Kandidatenmenge',
        merkmal: '',
        dauerMs: 700,
        zeitpunkt: '2026-09-16T09:01:00.000Z',
      },
    ]);
    await neu.schliessen();
  });

  it('laesst Karten und Einstellungen beim Aufstieg stehen', async () => {
    const name = neuerName();
    const alt = await idbOeffner(name, NUR_FASSUNG_1)();
    const roh = alt as unknown as IDBPDatabase;
    const termin = naechsterTermin(neueKarte(JETZT), 'eher', true, JETZT);
    await roh.put('karten', { lektion: 'rvp', frage: 'rvp-1', karte: termin.karte });
    await roh.put('einstellungen', 'dunkel', 'modus');
    alt.close();

    const neu = speicher(idbOeffner(name, SCHRITTE));
    expect(await neu.karten()).toHaveLength(1);
    expect(await neu.einstellung('modus')).toBe('dunkel');
    await neu.schliessen();
  });

  it('ist wiederholbar: ein schon gehobener Satz bleibt, wie er ist', () => {
    const schonNeu = e();
    expect(hebeAufV2(schonNeu)).toBe(schonNeu);
  });
});
```

- [ ] **Schritt 2: Test laufen lassen, Fehlschlag ansehen**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && npx vitest run tests/speicher.test.ts 2>&1 | tail -12
```
Erwartet: FAIL — `hebeAufV2` ist kein Export von `speicher.ts` (je nach Lauf als `is not a function` oder als fehlgeschlagene Zusicherung über `gewaehlt`).

- [ ] **Schritt 3: Das Ereignis umstellen**

In `src/tutor/typen.ts` direkt unter dem Kopfkommentar einfügen:

```ts
// Ein Typ, kein Wert: Die Zeile wird beim Uebersetzen geloescht. Diese Datei
// bleibt damit frei von Laufzeitabhaengigkeiten, wie ihr Kopfkommentar verlangt.
import type { AufgabenTyp } from '../aufgaben/schema';
```

und den Block von `/** Ein Ereignis je beantworteter Frage.` bis zum Ende des Typs `Ereignis` ersetzen durch:

```ts
/**
 * Ein Ereignis je beantworteter Aufgabe. Unveraenderlich, nur angehaengt.
 *
 * `frage` ist die Kennung der Aufgabe. Der Name stammt aus der Zeit, als es
 * nur Wahlfragen gab, und bleibt: Er ist der Schluessel in `reife.ts`, in
 * `auswahl.ts` und im keyPath des Kartenspeichers. Ihn umzubenennen waere ein
 * Umbau des Speichers ohne Gewinn.
 *
 * `antwort` haelt fest, WAS jemand getan hat — den gewaehlten Text, die
 * geschriebene Loesung, die gebildeten Paare, die abgegebene Folge. `merkmal`
 * ist der Schluessel, unter dem sich Fehlgriffe gruppieren lassen, und bei
 * einem Treffer leer. Beides zu trennen ist kein Luxus: Bei einem Fall ist die
 * Antwort ein freier Text, den niemand zweimal gleich schreibt — gruppieren
 * laesst sich nur nach dem Pruefpunkt, der fehlte. Ohne `merkmal` liesse sich
 * nicht sagen, WELCHE Gegenposition jemanden faengt, und genau das ist das
 * Fehlermuster, auf das der Tutor reagiert.
 *
 * `anteil` wird gespeichert, aber noch nicht in die Terminplanung
 * eingerechnet. Ob drei von vier Paaren ein „Hard" oder ein „Again" sind, ist
 * mit Daten zu beantworten, nicht mit einer Annahme. Der Wert liegt dann vor.
 */
export type Ereignis = {
  readonly lektion: string;
  readonly frage: string;
  readonly typ: AufgabenTyp;
  readonly zuversicht: Zuversicht;
  readonly richtig: boolean;
  readonly anteil: number;
  readonly antwort: string;
  readonly merkmal: string;
  readonly dauerMs: number;
  readonly zeitpunkt: string;
};
```

- [ ] **Schritt 4: Den Speicher auf Fassung 2 heben**

In `src/tutor/speicher.ts`:

(a) Den Import `import type { Ereignis } from './typen';` ersetzen durch
`import type { Ereignis, Zuversicht } from './typen';`

(b) Direkt **vor** `export const SCHRITTE` einfügen:

```ts
/** Ein Ereignis, wie es Fassung 1 geschrieben hat. Nur fuer den Aufstieg. */
export type EreignisV1 = {
  readonly lektion: string;
  readonly frage: string;
  readonly zuversicht: Zuversicht;
  readonly richtig: boolean;
  readonly gewaehlt: string;
  readonly dauerMs: number;
  readonly zeitpunkt: string;
};

/**
 * Hebt ein Ereignis aus Fassung 1 in die heutige Form.
 *
 * Bis zur Aufgabenfamilie gab es nur Wahlfragen: `typ` ist also 'wahl', der
 * Anteil folgt aus `richtig`, und das Merkmal ist der gewaehlte Text, wenn er
 * falsch war. Ein Satz, der schon `typ` traegt, bleibt unveraendert — der
 * Schritt ist damit wiederholbar.
 */
export function hebeAufV2(satz: Ereignis | EreignisV1): Ereignis {
  if ('typ' in satz) return satz;
  const { gewaehlt, ...rest } = satz;
  return {
    ...rest,
    typ: 'wahl',
    anteil: satz.richtig ? 1 : 0,
    antwort: gewaehlt,
    merkmal: satz.richtig ? '' : gewaehlt,
  };
}
```

(c) In `SCHRITTE` hinter dem ersten Eintrag (nach dessen schließendem `},`) den zweiten anfügen:

```ts
  // Fassung 2: Ereignisse tragen den Aufgabentyp (siehe `hebeAufV2`).
  //
  // Additiv wie verlangt: kein Speicher wird geloescht oder neu angelegt, jeder
  // Satz wird an Ort und Stelle fortgeschrieben. Gewartet wird ausschliesslich
  // auf IndexedDB-Anfragen — ein anderes `await` hier liesse die
  // Umbau-Transaktion schliessen, bevor der Zeiger durch ist.
  (_datenbank, umbau) => {
    const ablage = umbau.objectStore('ereignisse');
    const hebeAlle = async (): Promise<void> => {
      let zeiger = await ablage.openCursor();
      while (zeiger) {
        await zeiger.update(hebeAufV2(zeiger.value as Ereignis | EreignisV1));
        zeiger = await zeiger.continue();
      }
    };
    void hebeAlle().catch((fehler) => {
      melde('Aufstieg auf Fassung 2', fehler);
      try {
        umbau.abort();
      } catch {
        // Schon abgebrochen. Das Oeffnen scheitert dann, und die Seite laeuft
        // im speicherlosen Notbetrieb — mit unveraendertem Bestand.
      }
    });
  },
```

(d) Den Kommentarblock über `export function speicher(` („Wie viel Platz das kostet …") ersetzen. Vorher messen:

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && node -e "const e={lektion:'recall-vor-precision',frage:'rvp-1',typ:'wahl',zuversicht:'sicher',richtig:true,anteil:1,antwort:'Der Recall der Kandidatenmenge',merkmal:'',dauerMs:8432,zeitpunkt:'2026-09-16T09:00:00.000Z'};console.log('Treffer:',Buffer.byteLength(JSON.stringify(e)));const f={...e,richtig:false,anteil:0,merkmal:e.antwort};console.log('Fehlgriff:',Buffer.byteLength(JSON.stringify(f)))"
```
Erwartet: zwei Zahlen, um 221 und um 251. Die **gemessenen** Werte stehen dann im neuen Kommentar:

```ts
/**
 * Wie viel Platz das kostet — gemessen, nicht geschaetzt.
 *
 * Ein Wahl-Ereignis mit den echten Texten dieser App: als JSON <Treffer> Byte
 * bei einem Treffer und <Fehlgriff> bei einem Fehlgriff, weil `merkmal` dann
 * den gewaehlten Text wiederholt. Mit Schluessel und Satzkopf der Datenbank
 * rund 300 Byte, auf der Platte etwa das Doppelte.
 *
 * Die anderen Typen sind groesser, und das ist gewollt: `antwort` haelt fest,
 * was jemand getan hat. Bei `zuordnen` sind das alle Paare (bis rund 1,5 kB),
 * bei `fall` der geschriebene Text (bis 2 000 Zeichen, also bis rund 4,3 kB).
 * Die Schranken je Typ stehen in `tests/speicher.test.ts`.
 *
 * Hochgerechnet: 10 000 Wahl-Ereignisse bleiben unter 6 MB, selbst 10 000
 * Faelle unter 50 MB. Chrome raeumt einem Ursprung rund sechzig Prozent des
 * freien Plattenplatzes ein, Firefox zehn. 10 000 Bewertungen sind bei taeglich
 * zwanzig Antworten die Ernte von anderthalb Jahren. Es wird nicht eng.
 */
```
`<Treffer>` und `<Fehlgriff>` durch die gemessenen Zahlen ersetzen.

- [ ] **Schritt 5: Die Kalibrierung nach `merkmal` gruppieren**

In `src/tutor/kalibrierung.ts`:

- `readonly gewaehlt: string;` im Typ `Fehlvorstellung` → `readonly merkmal: string;`
- im Kommentar über `sicherUndFalsch` den Satz „Gruppiert wird nach der GEWAEHLTEN Antwort, nicht nur nach der Frage:" ersetzen durch „Gruppiert wird nach dem MERKMAL des Fehlgriffs, nicht nur nach der Frage — bei einer Wahl ist das die gewaehlte Antwort, bei einem Fall der fehlende Pruefpunkt:"
- ``const schluessel = `${ev.lektion} ${ev.frage} ${ev.gewaehlt}`;`` → ``const schluessel = `${ev.lektion} ${ev.frage} ${ev.merkmal}`;``
- `gewaehlt: ev.gewaehlt,` → `merkmal: ev.merkmal,`
- `a.gewaehlt.localeCompare(b.gewaehlt),` → `a.merkmal.localeCompare(b.merkmal),`

- [ ] **Schritt 6: `Frage.tsx` schreibt die neue Form**

In `src/components/Frage.tsx`, Funktion `aufzeichnen`, das Objekt `ereignis` ersetzen durch:

```ts
    const ereignis: Ereignis = {
      lektion,
      frage: id,
      typ: 'wahl',
      zuversicht: gewaehlteStufe,
      richtig: antwort.richtig,
      anteil: antwort.richtig ? 1 : 0,
      antwort: antwort.text,
      merkmal: antwort.richtig ? '' : antwort.text,
      dauerMs,
      zeitpunkt: jetzt.toISOString(),
    };
```
(Aufgabe 11 ersetzt die Datei ganz. Bis dahin bleibt jeder Commit lauffähig.)

- [ ] **Schritt 7: Die Testhilfen auf die neue Form bringen**

`tests/speicher.test.ts`:
- In der Hilfe `e()` die Zeile `gewaehlt: 'Der Recall der Kandidatenmenge',` ersetzen durch die vier Zeilen
  `typ: 'wahl',` · `anteil: 1,` · `antwort: 'Der Recall der Kandidatenmenge',` · `merkmal: '',`
- Überall `e({ gewaehlt: '…'` → `e({ antwort: '…'` und `.map((ev) => ev.gewaehlt)` → `.map((ev) => ev.antwort)` (Zeilen um 88–92, 178–186, 319, 367, 377).
- In `describe('Schemafortschreibung')`: `ZWEITE_FASSUNG` → `NAECHSTE_FASSUNG` (alle Vorkommen); der Kommentar „Eine Fassung 2, die es heute noch nicht gibt." → „Eine nächste Fassung, die es heute noch nicht gibt."; der Testname `'hebt Daten aus Fassung 1 über den Aufstieg auf Fassung 2 hinüber'` → `'hebt Daten über den Aufstieg auf die nächste Fassung hinüber'`; `expect(griff?.version).toBe(2);` → `expect(griff?.version).toBe(SCHRITTE.length + 1);`; im Kommentar „steigt von 0 auf 2 in einem Zug" → „steigt von 0 auf die neueste Fassung in einem Zug".
- Den ganzen Block `describe('Größe eines Ereignisses', …)` samt Kommentar darüber ersetzen durch:

```ts
/**
 * (c) Die Groesse, als Wachposten — je Typ.
 *
 * `antwort` haelt fest, was jemand getan hat, und das ist je Typ verschieden
 * viel: ein Antworttext, eine Ziffernfolge, alle Paare, ein geschriebener
 * Text. Eine gemeinsame Schranke waere entweder fuer `wahl` wertlos oder fuer
 * `fall` falsch. Der Test haelt die Groessenordnung je Typ fest: Wer `Ereignis`
 * um den Aufgabentext oder die Begruendung erweitert, vervielfacht sie — und
 * soll das hier merken und nicht in zwei Jahren.
 */
describe('Größe eines Ereignisses', () => {
  const HOECHSTENS: Record<AufgabenTyp, number> = {
    wahl: 600,
    reihenfolge: 400,
    zuordnen: 1600,
    fall: 4500,
  };

  const langerText =
    'Weil Precision-Maßnahmen auf der Kandidatenmenge aufsetzen und deren Obergrenze nicht überschreiten können';
  const sechsPaare = Array.from(
    { length: 6 },
    (_, i) => `Selbstkostenerstattungsvertrag Nummer ${i}→Nachgewiesene Kosten des Auftragnehmers samt Zuschlag ${i}`,
  ).join(';');
  const lang = { lektion: 'kontrollfluss-folgt-modellstaerke', frage: 'kfm-transfer', richtig: false, anteil: 0 };

  const laengste: Record<AufgabenTyp, Ereignis> = {
    wahl: e({ ...lang, typ: 'wahl', antwort: langerText, merkmal: langerText }),
    reihenfolge: e({ ...lang, typ: 'reihenfolge', antwort: '1,3,2,4,5,7,6', merkmal: '1,3,2,4,5,7,6' }),
    zuordnen: e({ ...lang, typ: 'zuordnen', antwort: sechsPaare, merkmal: sechsPaare }),
    // Zweitausend Umlaute: die Hoechstlaenge des Textfelds, im teuersten Zeichen.
    fall: e({ ...lang, typ: 'fall', antwort: 'ä'.repeat(2000), merkmal: 'fehlt:1,2,3,4,5,6,7,8' }),
  };

  it.each(AUFGABENTYPEN)('bleibt beim Typ %s auch im längsten Fall unter der Schranke', (typ) => {
    const bytes = new TextEncoder().encode(JSON.stringify(laengste[typ])).length;
    expect(bytes).toBeLessThan(HOECHSTENS[typ]);
  });

  it('hält 10 000 Wahl-Ereignisse unter acht Megabyte', () => {
    expect(10_000 * HOECHSTENS.wahl).toBeLessThan(8 * 1024 * 1024);
  });
});
```
  und oben in der Datei ergänzen: `import { AUFGABENTYPEN, type AufgabenTyp } from '../src/aufgaben/schema';`

`tests/kalibrierung.test.ts`:
- Die Hilfe `e` ersetzen durch:

```ts
function e(zuversicht: Ereignis['zuversicht'], richtig: boolean, frage = 'f1', merkmal = 'x'): Ereignis {
  return {
    lektion: 'l',
    frage,
    typ: 'wahl',
    zuversicht,
    richtig,
    anteil: richtig ? 1 : 0,
    antwort: merkmal,
    merkmal: richtig ? '' : merkmal,
    dauerMs: 1000,
    zeitpunkt: '2026-09-16T10:00:00Z',
  };
}
```
- `gewaehlt: 'Reranker dahinter'` → `merkmal: 'Reranker dahinter'`; alle `t.gewaehlt` → `t.merkmal`; im Kommentar „für die `gewaehlt` überhaupt erhoben wird" → „für die `merkmal` überhaupt erhoben wird".
- In `describe('sicherUndFalsch')` einen Test anhängen:

```ts
  it('gruppiert bei einem Fall nach dem fehlenden Prüfpunkt, nicht nach dem geschriebenen Text', () => {
    // Der Grund, warum `merkmal` neben `antwort` steht: Niemand schreibt eine
    // Loesung zweimal gleich. Gruppiert nach dem Text waeren das zwei
    // Fehlvorstellungen mit je einem Vorkommen — und keine faellt auf.
    const fall = (antwort: string): Ereignis => ({
      lektion: 'l',
      frage: 'f9',
      typ: 'fall',
      zuversicht: 'sicher',
      richtig: false,
      anteil: 0.5,
      antwort,
      merkmal: 'fehlt:2',
      dauerMs: 1000,
      zeitpunkt: '2026-09-16T10:00:00Z',
    });
    expect(sicherUndFalsch([fall('Erste Fassung der Lösung'), fall('Ganz anders formuliert')])).toEqual([
      { lektion: 'l', frage: 'f9', merkmal: 'fehlt:2', anzahl: 2 },
    ]);
  });
```

`tests/reife.test.ts` und `tests/auswahl.test.ts`: in der jeweiligen Hilfe `e` den Parameter `gewaehlt = 'x'` in `merkmal = 'x'` umbenennen und die Eigenschaftszeile `gewaehlt,` ersetzen durch die vier Zeilen
`typ: 'wahl',` · `anteil: richtig ? 1 : 0,` · `antwort: merkmal,` · `merkmal: richtig ? '' : merkmal,`

`tests/frage.test.tsx`: `expect(ereignis.gewaehlt).toBe('Den Index');` ersetzen durch

```ts
      expect(ereignis.typ).toBe('wahl');
      expect(ereignis.anteil).toBe(0);
      expect(ereignis.antwort).toBe('Den Index');
      expect(ereignis.merkmal).toBe('Den Index');
```

Kontrolle, dass nichts übersehen ist:

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && grep -rn "\.gewaehlt\|gewaehlt:" src/tutor tests --include=*.ts --include=*.tsx | grep -v "EreignisV1\|alterTreffer\|alterFehlgriff\|readonly gewaehlt\|const { gewaehlt"
```
Erwartet: Treffer nur noch in `tests/frage.test.tsx` und nur solche, die `data-zustand`/`dataset.zustand` mit dem Wert `'gewaehlt'` prüfen — das ist der Zustand eines Knopfes, nicht das Feld des Ereignisses.

- [ ] **Schritt 8: Alles laufen lassen**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && npm test 2>&1 | grep -E "Tests |Test Files |FAIL" && npm run check 2>&1 | grep -E "^- [0-9]+ error"
```
Erwartet: `Tests  328 passed (328)` (321 nach Aufgabe 5, dazu drei Aufstiegstests, drei zusätzliche Größentests, ein Kalibrierungstest), `- 0 errors`.

- [ ] **Schritt 9: Mutationsprobe am Aufstieg**

In `hebeAufV2` vorübergehend `merkmal: satz.richtig ? '' : gewaehlt` zu `merkmal: gewaehlt` ändern. Erwartet: der Test „hebt einen Bestand aus Fassung 1 …" schlägt am Treffer fehl (`merkmal` müsste leer sein). Zurücknehmen.

- [ ] **Schritt 10: Committen**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && git add src/tutor/typen.ts src/tutor/speicher.ts src/tutor/kalibrierung.ts src/components/Frage.tsx tests/speicher.test.ts tests/kalibrierung.test.ts tests/reife.test.ts tests/auswahl.test.ts tests/frage.test.tsx && git commit -q -F - <<'MSG'
feat: Ereignis und Speicher auf Fassung 2

Das Ereignis traegt typ, anteil, antwort und merkmal; gewaehlt
entfaellt. antwort haelt fest, WAS jemand getan hat, merkmal ist der
Schluessel, unter dem sich Fehlgriffe gruppieren lassen. Die Trennung
ist kein Luxus: Bei einem Fall ist die Antwort ein freier Text, den
niemand zweimal gleich schreibt - gruppieren laesst sich nur nach dem
Pruefpunkt, der fehlte. Ein Test haelt genau das fest.

Der Speicher hebt vorhandene Ereignisse ueber einen zweiten Schritt in
der Leiter an Ort und Stelle: additiv, wiederholbar, und geprueft am
echten Schritt statt an einer erfundenen Fassung. frage bleibt als
Kennung - es ist der Schluessel in reife, auswahl und im keyPath.

Der Groessenwaechter gilt jetzt je Typ: Eine gemeinsame Schranke waere
fuer wahl wertlos oder fuer fall falsch.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
MSG
```

---

## Aufgabe 7: Die Komponente `Wahl`

Die Antwortliste aus `Frage.tsx`, ohne Zuversicht, Speicher und Planer.

**Dateien:**
- Neu: `src/aufgaben/wahl/Wahl.tsx`
- Test: `tests/wahl.test.tsx`

- [ ] **Schritt 1: Den fehlschlagenden Test schreiben**

`tests/wahl.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Wahl from '../src/aufgaben/wahl/Wahl';
import type { Wahl as WahlAufgabe } from '../src/aufgaben/wahl/schema';

const aufgabe: WahlAufgabe = {
  typ: 'wahl',
  id: 'w-test',
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

describe('Wahl', () => {
  it('meldet die Wahl samt fertiger Bewertung an die Hülle', async () => {
    const nutzer = userEvent.setup();
    const onAbgegeben = vi.fn();
    render(<Wahl aufgabe={aufgabe} phase="offen" onAbgegeben={onAbgegeben} onErgebnis={vi.fn()} />);

    await nutzer.click(knopf('Den Index'));

    expect(onAbgegeben).toHaveBeenCalledWith({
      antwort: 'Den Index',
      ergebnis: { richtig: false, anteil: 0, antwort: 'Den Index', merkmal: 'Den Index' },
    });
  });

  it('lässt die Wahl wechseln, solange die Zuversicht aussteht', async () => {
    const nutzer = userEvent.setup();
    const onAbgegeben = vi.fn();
    const { rerender } = render(
      <Wahl aufgabe={aufgabe} phase="offen" onAbgegeben={onAbgegeben} onErgebnis={vi.fn()} />,
    );
    await nutzer.click(knopf('Den Index'));
    rerender(<Wahl aufgabe={aufgabe} phase="abgegeben" onAbgegeben={onAbgegeben} onErgebnis={vi.fn()} />);

    await nutzer.click(knopf('Die Kandidaten'));

    expect(onAbgegeben).toHaveBeenCalledTimes(2);
    expect(onAbgegeben.mock.calls[1][0].ergebnis.richtig).toBe(true);
    expect(knopf('Die Kandidaten').getAttribute('aria-pressed')).toBe('true');
    expect(knopf('Den Index').getAttribute('aria-pressed')).toBe('false');
  });

  it('nimmt nach der Auflösung keine Wahl mehr an und zeigt alle Begründungen', async () => {
    const nutzer = userEvent.setup();
    const onAbgegeben = vi.fn();
    const { rerender } = render(
      <Wahl aufgabe={aufgabe} phase="offen" onAbgegeben={onAbgegeben} onErgebnis={vi.fn()} />,
    );
    await nutzer.click(knopf('Den Index'));
    rerender(<Wahl aufgabe={aufgabe} phase="aufgeloest" onAbgegeben={onAbgegeben} onErgebnis={vi.fn()} />);

    for (const a of aufgabe.antworten) {
      expect(knopf(a.text).disabled).toBe(true);
      expect(screen.getByText(a.begruendung)).toBeTruthy();
    }
    expect(knopf('Den Index').dataset.zustand).toBe('falsch');
    expect(knopf('Die Kandidaten').dataset.zustand).toBe('richtig');
    expect(knopf('Die Anfrage').dataset.zustand).toBe('neutral');

    await nutzer.click(knopf('Die Kandidaten'));
    expect(onAbgegeben).toHaveBeenCalledTimes(1);
  });

  it('stellt den Ergebnissatz zwischen Frage und Antworten', () => {
    render(
      <Wahl
        aufgabe={aufgabe}
        phase="aufgeloest"
        onAbgegeben={vi.fn()}
        onErgebnis={vi.fn()}
        ergebnissatz={<p data-testid="satz">Richtig.</p>}
      />,
    );
    const satz = screen.getByTestId('satz');
    expect(satz.previousElementSibling?.className).toBe('frage-text');
    expect(satz.nextElementSibling?.className).toBe('antworten');
  });
});
```

- [ ] **Schritt 2: Test laufen lassen, Fehlschlag ansehen**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && npx vitest run tests/wahl.test.tsx 2>&1 | tail -8
```
Erwartet: FAIL mit `Failed to resolve import "../src/aufgaben/wahl/Wahl"`.

- [ ] **Schritt 3: Die Komponente anlegen**

`src/aufgaben/wahl/Wahl.tsx`:

```tsx
import { useMemo, useState } from 'react';
import { mischen } from '../../lib/mischen';
import type { TypProps } from '../vertrag';
import { bewerteWahl } from './bewerten';
import type { Antwort, Wahl as WahlAufgabe } from './schema';

type Zustand = 'offen' | 'gewaehlt' | 'richtig' | 'falsch' | 'neutral';

/**
 * Die Wahlaufgabe: Antwort antippen, fertig.
 *
 * Die Bewertung reist mit der Abgabe. Sie steht mit dem Antippen fest; die
 * Huelle haelt sie zurueck, bis die Zuversicht gewaehlt ist. Bis dahin ist die
 * Wahl widerruflich — jedes weitere Antippen ist eine neue Abgabe.
 */
export default function Wahl({ aufgabe, phase, onAbgegeben, ergebnissatz }: TypProps<WahlAufgabe>) {
  const gemischt = useMemo(
    () => mischen(aufgabe.antworten, aufgabe.id),
    [aufgabe.antworten, aufgabe.id],
  );
  // Gemerkt wird die Antwort selbst, nicht ihre Position. Eine Position gilt
  // nur fuer genau die Reihenfolge, in der sie entstanden ist: liefert das
  // Elternteil dieselben Antworten spaeter umsortiert, zeigt der Index auf
  // eine andere Antwort, und die Ansicht behauptet eine Wahl, die niemand
  // getroffen hat - lautlos, ohne Fehler oder Warnung. Die Objektidentitaet
  // ueberlebt jede Umsortierung.
  const [gewaehlt, setGewaehlt] = useState<Antwort | null>(null);
  const aufgeloest = phase === 'aufgeloest';

  function waehle(antwort: Antwort): void {
    if (phase === 'zuversicht' || aufgeloest) return;
    setGewaehlt(antwort);
    onAbgegeben({ antwort: antwort.text, ergebnis: bewerteWahl(aufgabe, antwort.text) });
  }

  function zustandVon(antwort: Antwort): Zustand {
    if (!aufgeloest) return antwort === gewaehlt ? 'gewaehlt' : 'offen';
    if (antwort.richtig) return 'richtig';
    if (antwort === gewaehlt) return 'falsch';
    return 'neutral';
  }

  return (
    <>
      <p className="frage-text">{aufgabe.frage}</p>
      {ergebnissatz}
      <ul className="antworten">
        {gemischt.map((antwort) => (
          // Der Text taugt als key, weil das Schema doppelte Antworttexte
          // innerhalb einer Aufgabe zurueckweist (normalisiert verglichen).
          // Faellt diese Regel, faellt auch dieser key.
          <li key={antwort.text}>
            <button
              type="button"
              className="antwort"
              data-zustand={zustandVon(antwort)}
              // Die Wahl ist bis zur Zuversicht widerruflich, also ist sie ein
              // Schaltzustand und kein abgeschickter Wert. `aria-pressed` sagt
              // ihn genau dort an, wo der Fokus in diesem Moment steht.
              aria-pressed={antwort === gewaehlt}
              disabled={aufgeloest}
              onClick={() => waehle(antwort)}
            >
              {antwort.text}
            </button>
            {/* Farbe allein traegt die Aufloesung nicht (WCAG 1.4.1). Die
                Marke steht ausserhalb des Knopfes: In ihm wuerde sie seinen
                zugaenglichen Namen aendern, und dieselbe Antwort hiesse vor
                und nach der Aufloesung anders. */}
            {aufgeloest && markeZu(antwort, gewaehlt) !== null && (
              <p className="antwort-marke">{markeZu(antwort, gewaehlt)}</p>
            )}
            {aufgeloest && <p className="begruendung">{antwort.begruendung}</p>}
          </li>
        ))}
      </ul>
    </>
  );
}

/** Die Textmarke an einer Antwort, sobald aufgeloest ist. */
function markeZu(antwort: Antwort, gewaehlt: Antwort | null): string | null {
  const eigene = antwort === gewaehlt;
  if (antwort.richtig) return eigene ? 'richtig · deine Wahl' : 'richtig';
  return eigene ? 'deine Wahl' : null;
}
```

- [ ] **Schritt 4: Test laufen lassen**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && npx vitest run tests/wahl.test.tsx 2>&1 | grep -E "Tests |×"
```
Erwartet: `Tests  4 passed (4)`.

- [ ] **Schritt 5: Typen prüfen und committen**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && npm run check 2>&1 | grep -E "^- [0-9]+ error" && git add src/aufgaben/wahl/Wahl.tsx tests/wahl.test.tsx && git commit -q -F - <<'MSG'
feat: Komponente Wahl

Die Antwortliste aus Frage.tsx, ohne Zuversicht, Speicher und Planer.
Die Bewertung reist mit der Abgabe: Sie steht mit dem Antippen fest,
die Huelle haelt sie zurueck, bis die Zuversicht gewaehlt ist. Bis
dahin ist die Wahl widerruflich.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
MSG
```

---

## Aufgabe 8: Die Komponente `Fall`

**Dateien:**
- Neu: `src/aufgaben/fall/Fall.tsx`
- Test: `tests/fall.test.tsx`

- [ ] **Schritt 1: Den fehlschlagenden Test schreiben**

`tests/fall.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Fall, { HOECHSTLAENGE, absaetze } from '../src/aufgaben/fall/Fall';
import type { Fall as FallAufgabe } from '../src/aufgaben/fall/schema';

const aufgabe: FallAufgabe = {
  typ: 'fall',
  id: 'fall-test',
  sachverhalt: 'Eine Gemeinde vergibt einen Rohbau pauschal.\n\nEine Leistung fehlt im Leistungsverzeichnis.',
  aufgabe: 'Wer hat recht?',
  pruefpunkte: [
    { text: 'Mengenrisiko ist nicht Vollständigkeitsrisiko', pflicht: true },
    { text: 'Ankündigung vor der Ausführung', pflicht: false },
  ],
  musterloesung: 'Der Unternehmer hat recht.',
};

const loesung = 'Der Unternehmer hat recht, weil die Leistung nicht beschrieben war.';

function stelleDar(phase: 'offen' | 'abgegeben' | 'zuversicht' | 'aufgeloest' = 'offen') {
  const onAbgegeben = vi.fn();
  const onErgebnis = vi.fn();
  const dargestellt = render(
    <Fall aufgabe={aufgabe} phase={phase} onAbgegeben={onAbgegeben} onErgebnis={onErgebnis} />,
  );
  const inPhase = (neu: typeof phase) =>
    dargestellt.rerender(
      <Fall aufgabe={aufgabe} phase={neu} onAbgegeben={onAbgegeben} onErgebnis={onErgebnis} />,
    );
  return { onAbgegeben, onErgebnis, inPhase };
}

describe('absaetze', () => {
  it('trennt an Leerzeilen und verwirft Leeres', () => {
    expect(absaetze('Erster.\n\nZweiter.\r\n\r\n\r\nDritter.\n')).toEqual(['Erster.', 'Zweiter.', 'Dritter.']);
  });
});

describe('Fall', () => {
  it('zeigt Sachverhalt in Absätzen, Aufgabe und ein begrenztes Textfeld', () => {
    stelleDar();
    expect(screen.getByText('Eine Gemeinde vergibt einen Rohbau pauschal.')).toBeTruthy();
    expect(screen.getByText('Eine Leistung fehlt im Leistungsverzeichnis.')).toBeTruthy();
    expect(screen.getByText('Wer hat recht?')).toBeTruthy();
    expect((screen.getByLabelText('Deine Lösung') as HTMLTextAreaElement).maxLength).toBe(HOECHSTLAENGE);
  });

  it('lässt erst abgeben, wenn etwas geschrieben ist', async () => {
    const nutzer = userEvent.setup();
    const { onAbgegeben } = stelleDar();
    const abgeben = screen.getByRole('button', { name: 'Abgeben' }) as HTMLButtonElement;
    expect(abgeben.disabled).toBe(true);

    await nutzer.type(screen.getByLabelText('Deine Lösung'), loesung);
    expect(abgeben.disabled).toBe(false);
    await nutzer.click(abgeben);

    // `ergebnis: null` ist der Punkt: Die Bewertung kann erst NACH der
    // Zuversicht entstehen.
    expect(onAbgegeben).toHaveBeenCalledWith({ antwort: loesung, ergebnis: null });
  });

  it('zeigt die Prüfpunkte NICHT, solange die Zuversicht aussteht', async () => {
    const nutzer = userEvent.setup();
    const { inPhase } = stelleDar();
    await nutzer.type(screen.getByLabelText('Deine Lösung'), loesung);
    inPhase('abgegeben');

    // Wer die Pruefpunkte vor der Zuversicht sieht, schaetzt nicht sein
    // Wissen ein, sondern liest ab.
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.queryByText('Mengenrisiko ist nicht Vollständigkeitsrisiko')).toBeNull();
    expect((screen.getByLabelText('Deine Lösung') as HTMLTextAreaElement).readOnly).toBe(true);
    expect(screen.queryByRole('button', { name: 'Abgeben' })).toBeNull();
  });

  it('lässt nach der Zuversicht abhaken und reicht die Bewertung nach', async () => {
    const nutzer = userEvent.setup();
    const { onErgebnis, inPhase } = stelleDar();
    await nutzer.type(screen.getByLabelText('Deine Lösung'), loesung);
    inPhase('zuversicht');

    expect(screen.getAllByRole('checkbox')).toHaveLength(2);
    // Vor dem Abschluss keine Marke „wesentlich": Sie wuerde verraten, welche
    // Haken zaehlen.
    expect(screen.queryByText(/wesentlich/)).toBeNull();

    await nutzer.click(screen.getByRole('checkbox', { name: 'Mengenrisiko ist nicht Vollständigkeitsrisiko' }));
    await nutzer.click(screen.getByRole('button', { name: 'Fertig' }));

    expect(onErgebnis).toHaveBeenCalledWith({ richtig: true, anteil: 0.5, antwort: loesung, merkmal: '' });
  });

  it('setzt den Fokus auf die Frage der Prüfpunkte, wenn sie erscheinen', async () => {
    const nutzer = userEvent.setup();
    const { inPhase } = stelleDar();
    await nutzer.type(screen.getByLabelText('Deine Lösung'), loesung);
    inPhase('zuversicht');

    // Der Zuversichtsblock ist eben verschwunden — mitsamt dem Knopf, auf dem
    // der Fokus stand. Ohne diesen Sprung fiele er auf <body>.
    expect(document.activeElement?.textContent).toBe('Was davon steht in deiner Lösung?');
  });

  it('sperrt nach der Auflösung, benennt Wesentliches und zeigt die Musterlösung', async () => {
    const nutzer = userEvent.setup();
    const { inPhase } = stelleDar();
    await nutzer.type(screen.getByLabelText('Deine Lösung'), loesung);
    inPhase('zuversicht');
    await nutzer.click(screen.getByRole('checkbox', { name: 'Ankündigung vor der Ausführung' }));
    inPhase('aufgeloest');

    for (const kasten of screen.getAllByRole('checkbox')) expect((kasten as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByText('wesentlich · fehlte')).toBeTruthy();
    expect(screen.getByText('Der Unternehmer hat recht.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Fertig' })).toBeNull();
  });
});
```

- [ ] **Schritt 2: Test laufen lassen, Fehlschlag ansehen**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && npx vitest run tests/fall.test.tsx 2>&1 | tail -8
```
Erwartet: FAIL mit `Failed to resolve import "../src/aufgaben/fall/Fall"`.

- [ ] **Schritt 3: Die Komponente anlegen**

`src/aufgaben/fall/Fall.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react';
import type { TypProps } from '../vertrag';
import { bewerteFall } from './bewerten';
import type { Fall as FallAufgabe } from './schema';

/** Hoechstlaenge der geschriebenen Loesung. Der Groessenwaechter im Speichertest rechnet damit. */
export const HOECHSTLAENGE = 2000;

/** Absaetze, durch Leerzeile getrennt. Kein Markdown — siehe `schema.ts`. */
export function absaetze(text: string): string[] {
  return text
    .split(/\r?\n\s*\r?\n/)
    .map((absatz) => absatz.trim())
    .filter((absatz) => absatz.length > 0);
}

/**
 * Der Fall: lesen, frei schreiben, abgeben — und erst NACH der Zuversicht
 * gegen die Pruefpunkte abhaken.
 *
 * Die Reihenfolge ist der Kern dieses Typs und der einzige Grund, warum der
 * Vertrag zwei Rueckrufe kennt. Die Abgabe traegt deshalb `ergebnis: null`;
 * die Bewertung kommt ueber `onErgebnis`, wenn die Huelle die Phase
 * `zuversicht` gesetzt hat und die Pruefpunkte abgehakt sind.
 */
export default function Fall({ aufgabe, phase, onAbgegeben, onErgebnis, ergebnissatz }: TypProps<FallAufgabe>) {
  const [text, setText] = useState('');
  const [haken, setHaken] = useState<boolean[]>(() => aufgabe.pruefpunkte.map(() => false));
  const legende = useRef<HTMLLegendElement>(null);

  const eingabeId = `${aufgabe.id}-loesung`;
  const pruefen = phase === 'zuversicht';
  const aufgeloest = phase === 'aufgeloest';

  // Der Zuversichtsblock ist in diesem Moment verschwunden, mitsamt dem Knopf,
  // auf dem der Fokus stand. Ein entfernter Fokus faellt auf <body>: Der
  // Screenreader verstummt, und die Tastatur faengt oben auf der Seite neu an.
  useEffect(() => {
    if (pruefen) legende.current?.focus();
  }, [pruefen]);

  function gibAb(): void {
    if (phase !== 'offen' || text.trim() === '') return;
    onAbgegeben({ antwort: text, ergebnis: null });
  }

  function setze(stelle: number, wert: boolean): void {
    if (!pruefen) return;
    setHaken((alt) => alt.map((h, i) => (i === stelle ? wert : h)));
  }

  function fertig(): void {
    if (!pruefen) return;
    onErgebnis(bewerteFall(aufgabe, text, haken));
  }

  return (
    <>
      <div className="fall-sachverhalt">
        {absaetze(aufgabe.sachverhalt).map((absatz) => (
          <p key={absatz}>{absatz}</p>
        ))}
      </div>
      <p className="frage-text">{aufgabe.aufgabe}</p>
      {ergebnissatz}

      <label className="fall-beschriftung" htmlFor={eingabeId}>
        Deine Lösung
      </label>
      <textarea
        id={eingabeId}
        className="fall-eingabe"
        maxLength={HOECHSTLAENGE}
        readOnly={phase !== 'offen'}
        value={text}
        onChange={(ereignis) => setText(ereignis.target.value)}
      />
      <p className="fall-zaehler">
        {text.length} / {HOECHSTLAENGE}
      </p>

      {phase === 'offen' && (
        <button type="button" className="abgeben" disabled={text.trim() === ''} onClick={gibAb}>
          Abgeben
        </button>
      )}

      {(pruefen || aufgeloest) && (
        <fieldset className="pruefpunkte">
          <legend ref={legende} tabIndex={-1}>
            Was davon steht in deiner Lösung?
          </legend>
          {aufgabe.pruefpunkte.map((punkt, i) => (
            <label
              key={punkt.text}
              className="pruefpunkt"
              data-zustand={aufgeloest ? (haken[i] ? 'gehabt' : punkt.pflicht ? 'fehlt' : 'offen') : undefined}
            >
              <input
                type="checkbox"
                checked={haken[i] ?? false}
                disabled={aufgeloest}
                onChange={(ereignis) => setze(i, ereignis.target.checked)}
              />
              <span className="pruefpunkt-text">{punkt.text}</span>
              {/* Die Marke erst NACH dem Abschluss: Vorher verriete sie, welche
                  Haken ueber richtig und falsch entscheiden. */}
              {aufgeloest && punkt.pflicht && (
                <span className="pruefpunkt-marke">{haken[i] ? 'wesentlich' : 'wesentlich · fehlte'}</span>
              )}
            </label>
          ))}
          {pruefen && (
            <button type="button" className="abgeben" onClick={fertig}>
              Fertig
            </button>
          )}
        </fieldset>
      )}

      {aufgeloest && aufgabe.musterloesung !== undefined && (
        <div className="musterloesung">
          <h3>Musterlösung</h3>
          {absaetze(aufgabe.musterloesung).map((absatz) => (
            <p key={absatz}>{absatz}</p>
          ))}
        </div>
      )}
    </>
  );
}
```

- [ ] **Schritt 4: Test laufen lassen**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && npx vitest run tests/fall.test.tsx 2>&1 | grep -E "Tests |×"
```
Erwartet: `Tests  7 passed (7)`.

- [ ] **Schritt 5: Typen prüfen und committen**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && npm run check 2>&1 | grep -E "^- [0-9]+ error" && git add src/aufgaben/fall/Fall.tsx tests/fall.test.tsx && git commit -q -F - <<'MSG'
feat: Komponente Fall

Lesen, frei schreiben, abgeben - und erst NACH der Zuversicht gegen die
Pruefpunkte abhaken. Wer die Pruefpunkte vorher sieht, schaetzt nicht
sein Wissen ein, sondern liest ab; ein Test haelt fest, dass sie in der
Phase abgegeben nicht im Dokument stehen. Die Marke wesentlich erscheint
erst nach dem Abschluss: Vorher verriete sie, welche Haken zaehlen.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
MSG
```

---

## Aufgabe 9: Die Komponente `Zuordnen`

**Dateien:**
- Neu: `src/aufgaben/zuordnen/Zuordnen.tsx`
- Test: `tests/zuordnen.test.tsx`

- [ ] **Schritt 1: Den fehlschlagenden Test schreiben**

`tests/zuordnen.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Zuordnen from '../src/aufgaben/zuordnen/Zuordnen';
import type { Zuordnen as ZuordnenAufgabe } from '../src/aufgaben/zuordnen/schema';

const aufgabe: ZuordnenAufgabe = {
  typ: 'zuordnen',
  id: 'z-test',
  aufgabe: 'Ordne jeder Vertragsart ihre Vergütungsgrundlage zu.',
  paare: [
    { links: 'Einheitspreisvertrag', rechts: 'Preis je Einheit mal Menge' },
    { links: 'Pauschalvertrag', rechts: 'Ein Preis fürs Ganze' },
    { links: 'Stundenlohnvertrag', rechts: 'Preis je Stunde' },
  ],
  ablenker: ['Anteil an der Miete'],
};

type Nutzer = ReturnType<typeof userEvent.setup>;

function links(name: string): HTMLButtonElement {
  return screen.getByRole('button', { name: new RegExp(`^${name}`) }) as HTMLButtonElement;
}

function option(text: string): HTMLButtonElement {
  return screen.getByRole('button', { name: text }) as HTMLButtonElement;
}

async function ordne(nutzer: Nutzer, linkerEintrag: string, rechterEintrag: string): Promise<void> {
  await nutzer.click(links(linkerEintrag));
  await nutzer.click(option(rechterEintrag));
}

function stelleDar(phase: 'offen' | 'abgegeben' | 'aufgeloest' = 'offen') {
  const onAbgegeben = vi.fn();
  const dargestellt = render(
    <Zuordnen aufgabe={aufgabe} phase={phase} onAbgegeben={onAbgegeben} onErgebnis={vi.fn()} />,
  );
  const inPhase = (neu: typeof phase) =>
    dargestellt.rerender(
      <Zuordnen aufgabe={aufgabe} phase={neu} onAbgegeben={onAbgegeben} onErgebnis={vi.fn()} />,
    );
  return { onAbgegeben, inPhase };
}

describe('Zuordnen', () => {
  it('klappt die rechten Einträge unter dem angetippten linken auf — samt Ablenker', async () => {
    const nutzer = userEvent.setup();
    stelleDar();
    expect(screen.queryByRole('button', { name: 'Preis je Stunde' })).toBeNull();

    await nutzer.click(links('Pauschalvertrag'));

    expect(links('Pauschalvertrag').getAttribute('aria-expanded')).toBe('true');
    for (const rechts of [...aufgabe.paare.map((p) => p.rechts), 'Anteil an der Miete']) {
      expect(option(rechts)).toBeTruthy();
    }
    // Der Fokus folgt dem Aufklappen, sonst laege die Auswahl fuer die
    // Tastatur hinter allen uebrigen linken Eintraegen.
    expect(document.activeElement?.className).toBe('zuordnen-option');
  });

  it('bildet ein Paar, klappt zu und gibt den Fokus an den linken Eintrag zurück', async () => {
    const nutzer = userEvent.setup();
    stelleDar();
    await ordne(nutzer, 'Pauschalvertrag', 'Ein Preis fürs Ganze');

    expect(links('Pauschalvertrag').textContent).toContain('Ein Preis fürs Ganze');
    expect(links('Pauschalvertrag').getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(links('Pauschalvertrag'));
  });

  it('vergibt jeden rechten Eintrag nur einmal', async () => {
    const nutzer = userEvent.setup();
    stelleDar();
    await ordne(nutzer, 'Pauschalvertrag', 'Ein Preis fürs Ganze');
    await nutzer.click(links('Stundenlohnvertrag'));

    expect(option('Ein Preis fürs Ganze').disabled).toBe(true);
    expect(option('Preis je Stunde').disabled).toBe(false);
  });

  it('löst ein bestehendes Paar, wenn man es antippt', async () => {
    const nutzer = userEvent.setup();
    stelleDar();
    await ordne(nutzer, 'Pauschalvertrag', 'Preis je Stunde');

    await nutzer.click(links('Pauschalvertrag'));

    expect(links('Pauschalvertrag').textContent).toContain('noch nichts zugeordnet');
    expect(option('Preis je Stunde').disabled).toBe(false);
  });

  it('lässt erst abgeben, wenn jeder linke Eintrag ein Paar hat, und meldet die Bewertung', async () => {
    const nutzer = userEvent.setup();
    const { onAbgegeben } = stelleDar();
    const abgeben = screen.getByRole('button', { name: 'Abgeben' }) as HTMLButtonElement;
    expect(abgeben.disabled).toBe(true);

    await ordne(nutzer, 'Einheitspreisvertrag', 'Preis je Einheit mal Menge');
    await ordne(nutzer, 'Pauschalvertrag', 'Ein Preis fürs Ganze');
    expect(abgeben.disabled).toBe(true);
    await ordne(nutzer, 'Stundenlohnvertrag', 'Preis je Stunde');
    expect(abgeben.disabled).toBe(false);

    await nutzer.click(abgeben);
    const abgabe = onAbgegeben.mock.calls[0][0];
    expect(abgabe.ergebnis).toMatchObject({ richtig: true, anteil: 1, merkmal: '' });
    expect(abgabe.antwort).toBe(abgabe.ergebnis.antwort);
  });

  it('meldet bei einer Verwechslung den Anteil und die falschen Paare', async () => {
    const nutzer = userEvent.setup();
    const { onAbgegeben } = stelleDar();
    await ordne(nutzer, 'Einheitspreisvertrag', 'Ein Preis fürs Ganze');
    await ordne(nutzer, 'Pauschalvertrag', 'Preis je Einheit mal Menge');
    await ordne(nutzer, 'Stundenlohnvertrag', 'Preis je Stunde');
    await nutzer.click(screen.getByRole('button', { name: 'Abgeben' }));

    expect(onAbgegeben.mock.calls[0][0].ergebnis).toMatchObject({
      richtig: false,
      anteil: 1 / 3,
      merkmal: 'Einheitspreisvertrag→Ein Preis fürs Ganze;Pauschalvertrag→Preis je Einheit mal Menge',
    });
  });

  it('sperrt nach der Abgabe und nennt in der Auflösung, was richtig gewesen wäre', async () => {
    const nutzer = userEvent.setup();
    const { inPhase } = stelleDar();
    await ordne(nutzer, 'Einheitspreisvertrag', 'Ein Preis fürs Ganze');
    await ordne(nutzer, 'Pauschalvertrag', 'Preis je Einheit mal Menge');
    await ordne(nutzer, 'Stundenlohnvertrag', 'Preis je Stunde');

    inPhase('abgegeben');
    expect(links('Pauschalvertrag').disabled).toBe(true);
    expect(screen.queryByRole('button', { name: 'Abgeben' })).toBeNull();

    inPhase('aufgeloest');
    expect(screen.getByText('richtig wäre: Preis je Einheit mal Menge')).toBeTruthy();
    expect(screen.getAllByText('richtig')).toHaveLength(1);
  });
});
```

- [ ] **Schritt 2: Test laufen lassen, Fehlschlag ansehen**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && npx vitest run tests/zuordnen.test.tsx 2>&1 | tail -8
```
Erwartet: FAIL mit `Failed to resolve import "../src/aufgaben/zuordnen/Zuordnen"`.

- [ ] **Schritt 3: Die Komponente anlegen**

`src/aufgaben/zuordnen/Zuordnen.tsx`:

```tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { mischen } from '../../lib/mischen';
import type { TypProps } from '../vertrag';
import { bewerteZuordnen } from './bewerten';
import type { Zuordnen as ZuordnenAufgabe } from './schema';

/**
 * Zuordnen: linken Eintrag antippen, darunter klappen die rechten auf, einen
 * antippen — das Paar steht.
 *
 * Einspaltig, und das ist Absicht: Zwei Spalten haetten auf einem Handy mit
 * 375 Pixeln je rund 135 Pixel, zu schmal fuer ein Wort wie
 * „Selbstkostenerstattungsvertrag". Und kein Ziehen: Drag-and-drop ist auf
 * Android in einer Seite unzuverlaessig und schliesst Tastatur und
 * Screenreader aus.
 */
export default function Zuordnen({ aufgabe, phase, onAbgegeben, ergebnissatz }: TypProps<ZuordnenAufgabe>) {
  const rechteSeite = useMemo(
    () => mischen([...aufgabe.paare.map((paar) => paar.rechts), ...aufgabe.ablenker], aufgabe.id),
    [aufgabe.paare, aufgabe.ablenker, aufgabe.id],
  );
  // An Stelle i steht, was dem i-ten linken Eintrag zugeordnet ist.
  const [zuordnung, setZuordnung] = useState<(string | null)[]>(() => aufgabe.paare.map(() => null));
  const [aktiv, setAktiv] = useState<number | null>(null);
  const linke = useRef<(HTMLButtonElement | null)[]>([]);
  const ersteOption = useRef<HTMLButtonElement | null>(null);

  const offen = phase === 'offen';
  const aufgeloest = phase === 'aufgeloest';
  const vollstaendig = zuordnung.every((eintrag) => eintrag !== null);

  // Der Fokus folgt dem Aufklappen. Sonst laege die Auswahl fuer die Tastatur
  // hinter allen uebrigen linken Eintraegen.
  useEffect(() => {
    if (aktiv !== null) ersteOption.current?.focus();
  }, [aktiv]);

  function oeffne(stelle: number): void {
    if (!offen) return;
    // Ein bestehendes Paar antippen loest es und klappt die Auswahl wieder auf.
    if (zuordnung[stelle] !== null) {
      setZuordnung((alt) => alt.map((eintrag, i) => (i === stelle ? null : eintrag)));
      setAktiv(stelle);
      return;
    }
    setAktiv((alt) => (alt === stelle ? null : stelle));
  }

  function ordneZu(stelle: number, rechts: string): void {
    if (!offen) return;
    setZuordnung((alt) => alt.map((eintrag, i) => (i === stelle ? rechts : eintrag)));
    setAktiv(null);
    // Die Auswahl verschwindet mitsamt dem Knopf, auf dem der Fokus stand.
    linke.current[stelle]?.focus();
  }

  function gibAb(): void {
    if (!offen || !vollstaendig) return;
    const ergebnis = bewerteZuordnen(aufgabe, zuordnung);
    onAbgegeben({ antwort: ergebnis.antwort, ergebnis });
  }

  return (
    <>
      <p className="frage-text">{aufgabe.aufgabe}</p>
      {ergebnissatz}
      <ul className="zuordnen-liste">
        {aufgabe.paare.map((paar, stelle) => {
          const gewaehlt = zuordnung[stelle];
          const stimmt = gewaehlt === paar.rechts;
          let ersteVergeben = false;
          return (
            <li
              key={paar.links}
              className="zuordnen-zeile"
              data-zustand={aufgeloest ? (stimmt ? 'richtig' : 'falsch') : undefined}
            >
              <button
                type="button"
                className="zuordnen-links"
                aria-expanded={aktiv === stelle}
                disabled={!offen}
                ref={(element) => {
                  linke.current[stelle] = element;
                }}
                onClick={() => oeffne(stelle)}
              >
                <span className="zuordnen-begriff">{paar.links}</span>
                <span className="zuordnen-wahl">{gewaehlt ?? 'noch nichts zugeordnet'}</span>
              </button>

              {aktiv === stelle && (
                <ul className="zuordnen-optionen" role="group" aria-label={`Zuordnung für ${paar.links}`}>
                  {rechteSeite.map((rechts) => {
                    const vergeben = zuordnung.includes(rechts);
                    const istErste = !vergeben && !ersteVergeben;
                    if (istErste) ersteVergeben = true;
                    return (
                      <li key={rechts}>
                        <button
                          type="button"
                          className="zuordnen-option"
                          disabled={vergeben}
                          ref={istErste ? ersteOption : undefined}
                          onClick={() => ordneZu(stelle, rechts)}
                        >
                          {rechts}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}

              {aufgeloest && (
                <p className="antwort-marke">{stimmt ? 'richtig' : `richtig wäre: ${paar.rechts}`}</p>
              )}
            </li>
          );
        })}
      </ul>

      {offen && (
        <button type="button" className="abgeben" disabled={!vollstaendig} onClick={gibAb}>
          Abgeben
        </button>
      )}
    </>
  );
}
```

- [ ] **Schritt 4: Test laufen lassen**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && npx vitest run tests/zuordnen.test.tsx 2>&1 | grep -E "Tests |×"
```
Erwartet: `Tests  7 passed (7)`.

- [ ] **Schritt 5: Typen prüfen und committen**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && npm run check 2>&1 | grep -E "^- [0-9]+ error" && git add src/aufgaben/zuordnen/Zuordnen.tsx tests/zuordnen.test.tsx && git commit -q -F - <<'MSG'
feat: Komponente Zuordnen

Einspaltig: Den linken Eintrag antippen klappt die rechten direkt
darunter auf. Zwei Spalten haetten bei 375 Pixeln je rund 135 Pixel,
zu schmal fuer die Begriffe, um die es geht. Kein Ziehen - das ist auf
Android unzuverlaessig und schliesst Tastatur und Screenreader aus.
Der Fokus folgt dem Aufklappen und kehrt nach der Wahl zum linken
Eintrag zurueck.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
MSG
```

---

## Aufgabe 10: Die Komponente `Reihenfolge`

**Dateien:**
- Neu: `src/aufgaben/reihenfolge/Reihenfolge.tsx`
- Test: `tests/reihenfolge.test.tsx`

- [ ] **Schritt 1: Den fehlschlagenden Test schreiben**

`tests/reihenfolge.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Reihenfolge from '../src/aufgaben/reihenfolge/Reihenfolge';
import { startfolge } from '../src/aufgaben/reihenfolge/startfolge';
import type { Reihenfolge as ReihenfolgeAufgabe } from '../src/aufgaben/reihenfolge/schema';

const aufgabe: ReihenfolgeAufgabe = {
  typ: 'reihenfolge',
  id: 'r-test',
  aufgabe: 'Bringe die Projektstufen in ihre Reihenfolge.',
  schritte: ['Vorbereitung', 'Planung', 'Vergabe', 'Ausführung'],
};

type Nutzer = ReturnType<typeof userEvent.setup>;

function imBild(): string[] {
  return Array.from(document.querySelectorAll('.reihenfolge-text')).map((el) => el.textContent ?? '');
}

function knopf(schritt: string, richtung: 'oben' | 'unten'): HTMLButtonElement {
  return screen.getByRole('button', { name: `${schritt} nach ${richtung}` }) as HTMLButtonElement;
}

/** Sortiert ueber die Knoepfe, so wie ein Mensch es taete. */
async function sortiere(nutzer: Nutzer, ziel: readonly string[]): Promise<void> {
  for (let stelle = 0; stelle < ziel.length; stelle++) {
    let position = imBild().indexOf(ziel[stelle]);
    while (position > stelle) {
      await nutzer.click(knopf(ziel[stelle], 'oben'));
      position--;
    }
  }
}

function stelleDar(phase: 'offen' | 'abgegeben' | 'aufgeloest' = 'offen') {
  const onAbgegeben = vi.fn();
  const dargestellt = render(
    <Reihenfolge aufgabe={aufgabe} phase={phase} onAbgegeben={onAbgegeben} onErgebnis={vi.fn()} />,
  );
  const inPhase = (neu: typeof phase) =>
    dargestellt.rerender(
      <Reihenfolge aufgabe={aufgabe} phase={neu} onAbgegeben={onAbgegeben} onErgebnis={vi.fn()} />,
    );
  return { onAbgegeben, inPhase };
}

describe('Reihenfolge', () => {
  it('zeigt die Schritte in der Startfolge, nicht in der richtigen', () => {
    stelleDar();
    const erwartet = startfolge(aufgabe.schritte.length, aufgabe.id).map((i) => aufgabe.schritte[i]);
    expect(imBild()).toEqual(erwartet);
    expect(imBild()).not.toEqual(aufgabe.schritte);
  });

  it('sperrt „nach oben" beim ersten und „nach unten" beim letzten Schritt', () => {
    stelleDar();
    const folge = imBild();
    expect(knopf(folge[0], 'oben').disabled).toBe(true);
    expect(knopf(folge[folge.length - 1], 'unten').disabled).toBe(true);
    expect(knopf(folge[1], 'oben').disabled).toBe(false);
  });

  it('verschiebt einen Schritt und lässt den Fokus bei ihm', async () => {
    const nutzer = userEvent.setup();
    stelleDar();
    const vorher = imBild();

    await nutzer.click(knopf(vorher[2], 'oben'));

    expect(imBild()).toEqual([vorher[0], vorher[2], vorher[1], vorher[3]]);
    expect(document.activeElement).toBe(knopf(vorher[2], 'oben'));
  });

  it('gibt den Fokus am Rand an den Gegenknopf, statt ihn zu verlieren', async () => {
    const nutzer = userEvent.setup();
    stelleDar();
    const vorher = imBild();

    await nutzer.click(knopf(vorher[1], 'oben'));

    // Der Schritt steht jetzt ganz oben, „nach oben" ist gesperrt. Ein
    // gesperrter Knopf haelt keinen Fokus.
    expect(knopf(vorher[1], 'oben').disabled).toBe(true);
    expect(document.activeElement).toBe(knopf(vorher[1], 'unten'));
  });

  it('meldet die richtige Folge als richtig', async () => {
    const nutzer = userEvent.setup();
    const { onAbgegeben } = stelleDar();
    await sortiere(nutzer, aufgabe.schritte);
    await nutzer.click(screen.getByRole('button', { name: 'Abgeben' }));

    expect(onAbgegeben).toHaveBeenCalledWith({
      antwort: '1,2,3,4',
      ergebnis: { richtig: true, anteil: 1, antwort: '1,2,3,4', merkmal: '' },
    });
  });

  it('meldet eine unsortierte Abgabe als falsch, mit der Folge als Merkmal', async () => {
    const nutzer = userEvent.setup();
    const { onAbgegeben } = stelleDar();
    await nutzer.click(screen.getByRole('button', { name: 'Abgeben' }));

    const { ergebnis } = onAbgegeben.mock.calls[0][0];
    expect(ergebnis.richtig).toBe(false);
    expect(ergebnis.merkmal).toBe(ergebnis.antwort);
  });

  it('sperrt nach der Abgabe und zeigt in der Auflösung die richtige Folge', () => {
    const { inPhase } = stelleDar();
    inPhase('abgegeben');
    for (const schritt of aufgabe.schritte) {
      expect(knopf(schritt, 'oben').disabled).toBe(true);
      expect(knopf(schritt, 'unten').disabled).toBe(true);
    }
    expect(screen.queryByRole('button', { name: 'Abgeben' })).toBeNull();

    inPhase('aufgeloest');
    expect(screen.getByText('Richtige Reihenfolge')).toBeTruthy();
  });
});
```

- [ ] **Schritt 2: Test laufen lassen, Fehlschlag ansehen**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && npx vitest run tests/reihenfolge.test.tsx 2>&1 | tail -8
```
Erwartet: FAIL mit `Failed to resolve import "../src/aufgaben/reihenfolge/Reihenfolge"`.

- [ ] **Schritt 3: Die Komponente anlegen**

`src/aufgaben/reihenfolge/Reihenfolge.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react';
import type { TypProps } from '../vertrag';
import { bewerteReihenfolge } from './bewerten';
import type { Reihenfolge as ReihenfolgeAufgabe } from './schema';
import { startfolge } from './startfolge';

type Richtung = -1 | 1;
type Zug = { readonly schritt: number; readonly richtung: Richtung };

/**
 * Reihenfolge: Schritte mit zwei Knoepfen je Zeile nach oben und unten
 * schieben. Kein Ziehen — siehe `Zuordnen.tsx`.
 *
 * `folge[i]` ist der Index des Schritts an Stelle i. Die Zeilen tragen diesen
 * Index als key: React bewegt dann das Element, statt es neu zu bauen, und der
 * Fokus wandert mit dem Schritt mit.
 */
export default function Reihenfolge({ aufgabe, phase, onAbgegeben, ergebnissatz }: TypProps<ReihenfolgeAufgabe>) {
  const [folge, setFolge] = useState<number[]>(() => startfolge(aufgabe.schritte.length, aufgabe.id));
  const [zug, setZug] = useState<Zug | null>(null);
  const knoepfe = useRef(new Map<string, HTMLButtonElement>());

  const offen = phase === 'offen';
  const aufgeloest = phase === 'aufgeloest';
  const allesRichtig = folge.every((schritt, stelle) => schritt === stelle);

  // Der Fokus bleibt beim bewegten Schritt. Steht er danach am Rand, ist der
  // eben gedrueckte Knopf gesperrt — und ein gesperrter Knopf haelt keinen
  // Fokus. Dann uebernimmt der Gegenknopf derselben Zeile.
  useEffect(() => {
    if (zug === null) return;
    const stelle = folge.indexOf(zug.schritt);
    const amRand = zug.richtung === -1 ? stelle === 0 : stelle === folge.length - 1;
    const richtung: Richtung = amRand ? (zug.richtung === -1 ? 1 : -1) : zug.richtung;
    knoepfe.current.get(`${zug.schritt}:${richtung}`)?.focus();
  }, [zug, folge]);

  function verschiebe(stelle: number, richtung: Richtung): void {
    const ziel = stelle + richtung;
    if (!offen || ziel < 0 || ziel >= folge.length) return;
    const neu = [...folge];
    [neu[stelle], neu[ziel]] = [neu[ziel], neu[stelle]];
    setFolge(neu);
    setZug({ schritt: folge[stelle], richtung });
  }

  function gibAb(): void {
    if (!offen) return;
    const ergebnis = bewerteReihenfolge(aufgabe, folge);
    onAbgegeben({ antwort: ergebnis.antwort, ergebnis });
  }

  function merke(schritt: number, richtung: Richtung) {
    return (element: HTMLButtonElement | null): void => {
      const schluessel = `${schritt}:${richtung}`;
      if (element) knoepfe.current.set(schluessel, element);
      else knoepfe.current.delete(schluessel);
    };
  }

  return (
    <>
      <p className="frage-text">{aufgabe.aufgabe}</p>
      {ergebnissatz}
      <ol className="reihenfolge-liste">
        {folge.map((schritt, stelle) => {
          const text = aufgabe.schritte[schritt];
          return (
            <li
              key={schritt}
              className="reihenfolge-zeile"
              data-zustand={aufgeloest ? (schritt === stelle ? 'richtig' : 'falsch') : undefined}
            >
              <span className="reihenfolge-text">{text}</span>
              <span className="reihenfolge-knoepfe">
                <button
                  type="button"
                  className="reihenfolge-knopf"
                  aria-label={`${text} nach oben`}
                  disabled={!offen || stelle === 0}
                  ref={merke(schritt, -1)}
                  onClick={() => verschiebe(stelle, -1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="reihenfolge-knopf"
                  aria-label={`${text} nach unten`}
                  disabled={!offen || stelle === folge.length - 1}
                  ref={merke(schritt, 1)}
                  onClick={() => verschiebe(stelle, 1)}
                >
                  ↓
                </button>
              </span>
            </li>
          );
        })}
      </ol>

      {offen && (
        <button type="button" className="abgeben" onClick={gibAb}>
          Abgeben
        </button>
      )}

      {aufgeloest && !allesRichtig && (
        <div className="reihenfolge-loesung">
          <p className="antwort-marke">Richtige Reihenfolge</p>
          <ol>
            {aufgabe.schritte.map((schritt) => (
              <li key={schritt}>{schritt}</li>
            ))}
          </ol>
        </div>
      )}
    </>
  );
}
```

- [ ] **Schritt 4: Test laufen lassen**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && npx vitest run tests/reihenfolge.test.tsx 2>&1 | grep -E "Tests |×"
```
Erwartet: `Tests  7 passed (7)`.

Hinweis zum vierten Test: Er setzt voraus, dass der zweite Schritt der Startfolge nach einem Zug ganz oben steht — das gilt für jede Startfolge. Schlägt stattdessen der **erste** Test fehl, weil Start- und richtige Folge gleich sind, ist `startfolge` kaputt, nicht der Test.

- [ ] **Schritt 5: Typen prüfen und committen**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && npm run check 2>&1 | grep -E "^- [0-9]+ error" && git add src/aufgaben/reihenfolge/Reihenfolge.tsx tests/reihenfolge.test.tsx && git commit -q -F - <<'MSG'
feat: Komponente Reihenfolge

Zwei Knoepfe je Zeile statt Ziehen. Die Zeilen tragen den Index des
Schritts als key: React bewegt das Element, statt es neu zu bauen, und
der Fokus wandert mit. Am Rand ist der eben gedrueckte Knopf gesperrt
und haelt keinen Fokus - dann uebernimmt der Gegenknopf derselben
Zeile. Beides ist im Test festgehalten.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
MSG
```

---

## Aufgabe 11: Verteiler und Hülle — `Aufgabe.tsx` ersetzt `Frage.tsx`

**Dateien:**
- Neu: `src/aufgaben/Aufgabentyp.tsx`, `src/components/Aufgabe.tsx`
- Umbenennen: `tests/frage.test.tsx` → `tests/aufgabe.test.tsx`
- Ändern: `src/layouts/Lektion.astro`, `src/components/Zuversicht.tsx` (ein Kommentar)
- Löschen: `src/components/Frage.tsx`

Die 27 bestehenden Tests sind die Absicherung dieses Umbaus: Sie laufen unverändert in ihrer Aussage weiter, nur der Aufruf ändert sich.

- [ ] **Schritt 1: Die Testdatei umziehen und auf die Hülle richten**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && git mv tests/frage.test.tsx tests/aufgabe.test.tsx && sed -i "s/daten\.antworten/daten.aufgabe.antworten/g; s/<Frage {\.\.\.daten}/<Aufgabe {...daten}/g" tests/aufgabe.test.tsx
```

Dann in `tests/aufgabe.test.tsx` von Hand:

(a) Die Importzeile `import Frage, { type Antwort } from '../src/components/Frage';` ersetzen durch:

```ts
import Aufgabe from '../src/components/Aufgabe';
import type { Wahl } from '../src/aufgaben/wahl/schema';
import type { Fall } from '../src/aufgaben/fall/schema';
import type { Zuordnen } from '../src/aufgaben/zuordnen/schema';
```

(b) Die Konstante `daten` ersetzen durch:

```ts
const daten = {
  lektion: 'reranker',
  aufgabe: {
    typ: 'wahl',
    id: 'f-test',
    frage: 'Was sortiert ein Reranker?',
    antworten: [
      { text: 'Die Kandidaten', richtig: true, begruendung: 'Genau das ist seine Aufgabe.' },
      { text: 'Den Index', richtig: false, begruendung: 'Den rührt er nicht an.' },
      { text: 'Die Anfrage', richtig: false, begruendung: 'Die bleibt unverändert.' },
    ],
  } satisfies Wahl,
};
```

(c) Im Test „behaelt die Zuordnung, wenn das Elternteil die Antworten umsortiert" die Zeile
`rerender(<Aufgabe {...daten} speicher={speicher} antworten={rotiert} />);` ersetzen durch
`rerender(<Aufgabe {...daten} speicher={speicher} aufgabe={{ ...daten.aufgabe, antworten: rotiert }} />);`

(d) `describe('Frage', () => {` → `describe('Aufgabe — die Hülle, mit typ wahl', () => {`

(e) Am **Ende der Datei** anhängen:

```tsx
describe('Aufgabe — die Hülle mit den übrigen Typen', () => {
  const fall: Fall = {
    typ: 'fall',
    id: 'h-fall',
    sachverhalt: 'Eine Gemeinde vergibt einen Rohbau pauschal. Eine nötige Leistung fehlt im Leistungsverzeichnis.',
    aufgabe: 'Wer hat recht?',
    pruefpunkte: [
      { text: 'Mengenrisiko ist nicht Vollständigkeitsrisiko', pflicht: true },
      { text: 'Ankündigung vor der Ausführung', pflicht: false },
    ],
  };

  const zuordnen: Zuordnen = {
    typ: 'zuordnen',
    id: 'h-zu',
    aufgabe: 'Ordne zu.',
    paare: [
      { links: 'Einheitspreisvertrag', rechts: 'Preis je Einheit mal Menge' },
      { links: 'Pauschalvertrag', rechts: 'Ein Preis fürs Ganze' },
      { links: 'Stundenlohnvertrag', rechts: 'Preis je Stunde' },
    ],
    ablenker: [],
  };

  async function schreibeUndGibAb(nutzer: ReturnType<typeof userEvent.setup>): Promise<void> {
    await nutzer.type(screen.getByLabelText('Deine Lösung'), 'Der Unternehmer hat recht.');
    await nutzer.click(screen.getByRole('button', { name: 'Abgeben' }));
  }

  it('trägt den Typ als Attribut an der Karte', () => {
    const { speicher } = spion();
    const { container } = render(<Aufgabe lektion="l" aufgabe={fall} speicher={speicher} />);
    expect(container.querySelector('.frage')?.getAttribute('data-typ')).toBe('fall');
  });

  it('zeigt bei einem Fall die Prüfpunkte erst NACH der Zuversicht', async () => {
    const nutzer = userEvent.setup();
    const { speicher } = spion();
    render(<Aufgabe lektion="l" aufgabe={fall} speicher={speicher} />);
    await schreibeUndGibAb(nutzer);

    // Die Zuversichtsfrage steht da, die Pruefpunkte nicht: Wer sie vorher
    // saehe, schaetzte nicht sein Wissen ein, sondern laese ab.
    expect(stufenKnopf('sicher')).toBeTruthy();
    expect(screen.queryByRole('checkbox')).toBeNull();

    await nutzer.click(stufenKnopf('eher'));
    expect(screen.getAllByRole('checkbox')).toHaveLength(2);
  });

  it('zeichnet einen Fall erst auf, wenn die Prüfpunkte abgehakt sind', async () => {
    const nutzer = userEvent.setup();
    const { speicher, auf } = spion();
    render(<Aufgabe lektion="l" aufgabe={fall} speicher={speicher} />);
    await schreibeUndGibAb(nutzer);
    await nutzer.click(stufenKnopf('sicher'));

    // Die Zuversicht steht, das Ergebnis noch nicht. Es gibt nichts Ehrliches
    // aufzuzeichnen — `richtig` haette keinen Wert.
    expect(auf.ereignisse).toEqual([]);

    await nutzer.click(screen.getByRole('checkbox', { name: 'Ankündigung vor der Ausführung' }));
    await nutzer.click(screen.getByRole('button', { name: 'Fertig' }));

    await waitFor(() => expect(auf.ereignisse).toHaveLength(1));
    expect(auf.ereignisse[0]).toMatchObject({
      lektion: 'l',
      frage: 'h-fall',
      typ: 'fall',
      zuversicht: 'sicher',
      richtig: false,
      anteil: 0.5,
      antwort: 'Der Unternehmer hat recht.',
      merkmal: 'fehlt:1',
    });
    await waitFor(() => expect(auf.karten).toHaveLength(1));
    expect(screen.getByText(/Teilweise richtig\./)).toBeTruthy();
  });

  it('zeichnet nichts auf, wenn ein Fall nach der Zuversicht verlassen wird', async () => {
    const nutzer = userEvent.setup();
    const { speicher, auf } = spion();
    const { unmount } = render(<Aufgabe lektion="l" aufgabe={fall} speicher={speicher} />);
    await schreibeUndGibAb(nutzer);
    await nutzer.click(stufenKnopf('sicher'));
    unmount();
    await Promise.resolve();

    expect(auf.ereignisse).toEqual([]);
    expect(auf.karten).toEqual([]);
  });

  it('nennt ein Teilergebnis beim Namen und speichert den Anteil', async () => {
    const nutzer = userEvent.setup();
    const { speicher, auf } = spion();
    render(<Aufgabe lektion="l" aufgabe={zuordnen} speicher={speicher} />);

    const ordne = async (links: string, rechts: string) => {
      await nutzer.click(screen.getByRole('button', { name: new RegExp(`^${links}`) }));
      await nutzer.click(screen.getByRole('button', { name: rechts }));
    };
    await ordne('Einheitspreisvertrag', 'Ein Preis fürs Ganze');
    await ordne('Pauschalvertrag', 'Preis je Einheit mal Menge');
    await ordne('Stundenlohnvertrag', 'Preis je Stunde');
    await nutzer.click(screen.getByRole('button', { name: 'Abgeben' }));
    await nutzer.click(stufenKnopf('eher'));

    expect(screen.getByText(/Teilweise richtig\./)).toBeTruthy();
    await waitFor(() => expect(auf.ereignisse).toHaveLength(1));
    expect(auf.ereignisse[0].typ).toBe('zuordnen');
    expect(auf.ereignisse[0].richtig).toBe(false);
    expect(auf.ereignisse[0].anteil).toBeCloseTo(1 / 3);
  });
});
```

Kontrolle:

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && grep -n "<Frage\|components/Frage\|satisfies Antwort" tests/aufgabe.test.tsx
```
Erwartet: keine Ausgabe.

- [ ] **Schritt 2: Test laufen lassen, Fehlschlag ansehen**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && npx vitest run tests/aufgabe.test.tsx 2>&1 | tail -8
```
Erwartet: FAIL mit `Failed to resolve import "../src/components/Aufgabe"`.

- [ ] **Schritt 3: Den Verteiler anlegen**

`src/aufgaben/Aufgabentyp.tsx`:

```tsx
import type { Aufgabe } from './schema';
import type { TypProps } from './vertrag';
import Wahl from './wahl/Wahl';
import Fall from './fall/Fall';
import Zuordnen from './zuordnen/Zuordnen';
import Reihenfolge from './reihenfolge/Reihenfolge';

/**
 * Der Verteiler: die einzige Stelle, die alle Typen kennt.
 *
 * Ein `switch` und keine Abbildung `typ -> Komponente`: TypeScript verengt
 * `aufgabe` in jedem Zweig auf genau den Typ, den die Komponente verlangt. Eine
 * Abbildung braeuchte dafuer einen Cast — und ein Cast ist die Stelle, an der
 * ein fuenfter Typ stillschweigend vergessen wird. Hier meldet der `never`-Zweig
 * ihn beim Uebersetzen.
 *
 * Der Schema-Import ist ein Typ-Import. Zod bleibt damit aus dem Browserbuendel.
 */
export default function Aufgabentyp({ aufgabe, ...vertrag }: TypProps<Aufgabe>) {
  switch (aufgabe.typ) {
    case 'wahl':
      return <Wahl aufgabe={aufgabe} {...vertrag} />;
    case 'fall':
      return <Fall aufgabe={aufgabe} {...vertrag} />;
    case 'zuordnen':
      return <Zuordnen aufgabe={aufgabe} {...vertrag} />;
    case 'reihenfolge':
      return <Reihenfolge aufgabe={aufgabe} {...vertrag} />;
    default: {
      const unbekannt: never = aufgabe;
      throw new Error(`Unbekannter Aufgabentyp: ${JSON.stringify(unbekannt)}`);
    }
  }
}
```

- [ ] **Schritt 4: Die Hülle anlegen**

`src/components/Aufgabe.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react';
import Aufgabentyp from '../aufgaben/Aufgabentyp';
import type { Aufgabe as AufgabeDaten } from '../aufgaben/schema';
import type { Abgabe, AufgabenPhase, Ergebnis } from '../aufgaben/vertrag';
import Zuversicht from './Zuversicht';
import { naechsterTermin, neueKarte } from '../tutor/planung';
import { speicher as neuerSpeicher, type Speicher } from '../tutor/speicher';
import { ZUVERSICHT_TEXT, type Ereignis, type Zuversicht as Stufe } from '../tutor/typen';

export type AufgabeProps = {
  /**
   * Die Lektion, zu der die Aufgabe gehoert. Zusammen mit `aufgabe.id` der
   * Schluessel von Ereignis und Karte — eine Aufgabe ohne Lektion liesse sich
   * im Speicher nicht wiederfinden, deshalb ist die Angabe nicht wahlfrei.
   */
  lektion: string;
  aufgabe: AufgabeDaten;
  /**
   * Die Naht fuer Tests, wie in `speicher.ts` der `Oeffner`.
   *
   * Voreingestellt ist ein Speicher, den sich alle Aufgaben einer Seite
   * teilen: vier Aufgaben sollen nicht vier Verbindungen zur selben Datenbank
   * oeffnen.
   */
  speicher?: Speicher;
  /**
   * Monotone Uhr in Millisekunden, nur fuer `dauerMs`.
   *
   * `performance.now()` und nicht `Date.now()`: Eine Zeitzonenumstellung oder
   * ein Zeitabgleich mitten in der Aufgabe ergaebe sonst eine negative Dauer.
   */
  uhr?: () => number;
};

/**
 * Ein Speicher fuer die ganze Seite, traege erzeugt.
 *
 * `neuerSpeicher()` oeffnet noch nichts — die Verbindung entsteht beim ersten
 * Zugriff. Der Aufruf hier kostet also nichts und passiert trotzdem erst, wenn
 * er gebraucht wird: Beim Bauen rendert Astro diese Insel auf dem Server vor,
 * und dort gibt es kein IndexedDB.
 */
let geteilt: Speicher | null = null;
function geteilterSpeicher(): Speicher {
  geteilt ??= neuerSpeicher();
  return geteilt;
}

function standarduhr(): number {
  return performance.now();
}

/**
 * Die Huelle jeder Aufgabe: Zuversicht, Aufzeichnung, Terminplanung.
 *
 * Sie kennt keinen Aufgabentyp. Sie kennt den Vertrag aus
 * `src/aufgaben/vertrag.ts`: eine Abgabe, ein Ergebnis, vier Phasen. Ein neuer
 * Typ aendert an dieser Datei nichts.
 */
export default function Aufgabe({ lektion, aufgabe, speicher, uhr = standarduhr }: AufgabeProps) {
  const [abgabe, setAbgabe] = useState<Abgabe | null>(null);
  const [stufe, setStufe] = useState<Stufe | null>(null);
  const [ergebnis, setErgebnis] = useState<Ergebnis | null>(null);

  /**
   * Der Beginn der Messung: die erste Abgabe.
   *
   * Warum nicht ab Anzeige der Aufgabe: Auf einer Lektionsseite stehen mehrere
   * Aufgaben, alle hydrieren beim Laden. Die Zeit ab dem Einhaengen misst dann,
   * wie lange jemand die SEITE offen hatte — bei der vierten Aufgabe inklusive
   * der drei davor. Die Zahl saehe brauchbar aus und waere systematisch nach
   * der Position auf der Seite verzerrt. Das ist schlimmer als keine Zahl.
   *
   * Warum nicht ab erstem Blick: Ein IntersectionObserver meldet, wann die
   * Karte im Sichtfenster steht, nicht wann sie gelesen wird — und in einem
   * Dokument, das als versteckt gilt, feuert er gar nicht.
   *
   * Bleibt der Abschnitt zwischen der Abgabe und der Festlegung der
   * Zuversicht. Beide Enden sind vom Menschen verursacht, beide werden hier
   * beobachtet. `dauerMs` ist damit die Dauer der Selbsteinschaetzung, nicht
   * mehr. Bei einem Sinneswandel wird nicht zurueckgesetzt: Wer die Abgabe
   * noch einmal wechselt, hat gezoegert, und das Zoegern gehoert in die Zahl.
   */
  const beginn = useRef<number | null>(null);
  const dauerMs = useRef(0);
  const aufloesung = useRef<HTMLParagraphElement>(null);

  const phase: AufgabenPhase =
    ergebnis !== null ? 'aufgeloest' : stufe !== null ? 'zuversicht' : abgabe !== null ? 'abgegeben' : 'offen';
  const aufgeloest = phase === 'aufgeloest';

  /**
   * Der Fokus folgt der Aufloesung.
   *
   * Beim Aufloesen verschwindet, worauf der Fokus stand — der Zuversichtsblock
   * oder der Knopf „Fertig". Ein entfernter Fokus faellt auf `<body>`: Der
   * Screenreader verstummt, und die Tastatur faengt beim naechsten Tab wieder
   * ganz oben auf der Seite an. Deshalb wandert der Fokus auf den
   * Ergebnissatz, der dadurch zugleich vorgelesen wird.
   */
  useEffect(() => {
    if (aufgeloest) aufloesung.current?.focus();
  }, [aufgeloest]);

  function nimmAbgabe(neu: Abgabe): void {
    // Nach der Zuversicht ist die Abgabe fest.
    if (stufe !== null) return;
    beginn.current ??= uhr();
    setAbgabe(neu);
  }

  function festlegen(gewaehlteStufe: Stufe): void {
    if (abgabe === null || stufe !== null) return;
    dauerMs.current = Math.max(0, Math.round(uhr() - (beginn.current ?? uhr())));
    setStufe(gewaehlteStufe);
    // Steht die Bewertung schon fest, wird in einem Zug aufgeloest. Nur `fall`
    // reicht sie nach: Dort werden erst jetzt die Pruefpunkte sichtbar.
    if (abgabe.ergebnis !== null) abschliessen(abgabe.ergebnis, gewaehlteStufe);
  }

  function nimmErgebnis(nachgereicht: Ergebnis): void {
    if (stufe === null || ergebnis !== null) return;
    abschliessen(nachgereicht, stufe);
  }

  function abschliessen(fertig: Ergebnis, mitStufe: Stufe): void {
    const jetzt = new Date();
    // ERST die Anzeige, DANN das Schreiben. Die Reihenfolge ist die ganze
    // Zusicherung: Wenn diese Zeile durch ist, steht die Aufloesung fest, und
    // nichts, was danach kommt, kann sie noch verhindern.
    setErgebnis(fertig);
    void aufzeichnen(fertig, mitStufe, dauerMs.current, jetzt);
  }

  /**
   * Die Aufzeichnung. Sie darf scheitern, ohne die Aufgabe mitzunehmen.
   *
   * Im privaten Fenster, bei geloeschten Websitedaten und bei abgeschaltetem
   * Speicher liefert `speicher.ts` `false`, statt zu werfen. Das `try` hier ist
   * trotzdem kein Guertel zum Hosentraeger: `Speicher` ist eine Schnittstelle,
   * die von aussen hereingereicht wird, und diese Komponente verlaesst sich
   * nicht auf ein Versprechen, das eine fremde Umsetzung brechen kann.
   *
   * Die Karte wird auch dann fortgeschrieben, wenn das Ereignis nicht
   * geschrieben werden konnte: Ein geplanter Termin ohne Historie ist der
   * kleinere Schaden als eine Historie ohne Termin — die Aufgabe kaeme sonst
   * nie wieder.
   *
   * Ereignis und Karte tragen denselben Zeitpunkt. Daran haengt, dass sich der
   * geplante Termin aus dem Ereignis exakt nachrechnen laesst.
   */
  async function aufzeichnen(fertig: Ergebnis, mitStufe: Stufe, dauer: number, jetzt: Date): Promise<void> {
    const ablage = speicher ?? geteilterSpeicher();
    const ereignis: Ereignis = {
      lektion,
      frage: aufgabe.id,
      typ: aufgabe.typ,
      zuversicht: mitStufe,
      richtig: fertig.richtig,
      anteil: fertig.anteil,
      antwort: fertig.antwort,
      merkmal: fertig.merkmal,
      dauerMs: dauer,
      zeitpunkt: jetzt.toISOString(),
    };

    try {
      await ablage.merkeEreignis(ereignis);
      const vorher = await ablage.karte(lektion, aufgabe.id);
      const termin = naechsterTermin(vorher ?? neueKarte(jetzt), mitStufe, fertig.richtig, jetzt);
      await ablage.merkeKarte(lektion, aufgabe.id, termin);
    } catch (fehler) {
      console.warn('[frage] Aufzeichnung fehlgeschlagen:', fehler);
    }
  }

  const ergebnissatz =
    ergebnis !== null && stufe !== null ? (
      <p
        className="aufloesung"
        data-ergebnis={ergebnis.richtig ? 'richtig' : 'falsch'}
        ref={aufloesung}
        tabIndex={-1}
      >
        {urteil(ergebnis)} Angegeben: {ZUVERSICHT_TEXT[stufe]}.
        {hinweisZu(ergebnis.richtig, stufe) !== null && (
          <span className="aufloesung-hinweis"> {hinweisZu(ergebnis.richtig, stufe)}</span>
        )}
      </p>
    ) : null;

  return (
    // `karte` traegt nur Gestalt: Flaeche, Rand, Radius, Schatten aus der
    // Token-Schicht. `frage` bleibt der Klassenname der Karte — er haengt an
    // der Gestaltung und an den Messungen der Abnahme, nicht am Aufgabentyp.
    //
    // `data-beantwortet` heisst „es gibt eine Aufloesung", nicht „es ist etwas
    // angeklickt". Die Zwischenstufen stehen in `data-phase`.
    <div className="frage karte" data-typ={aufgabe.typ} data-beantwortet={aufgeloest} data-phase={phase}>
      <Aufgabentyp
        aufgabe={aufgabe}
        phase={phase}
        onAbgegeben={nimmAbgabe}
        onErgebnis={nimmErgebnis}
        ergebnissatz={ergebnissatz}
      />

      {/* Die Reihenfolge ist Absicht: Sicherheit laesst sich erst einschaetzen,
          wenn eine Antwort im Kopf ist. Zuerst zu fragen hiesse erraten, wie
          schwer die Aufgabe AUSSIEHT. */}
      {phase === 'abgegeben' && <Zuversicht id={aufgabe.id} beiWahl={festlegen} />}
    </div>
  );
}

/** Das Urteil in einem Wort. `richtig` bleibt binaer, der Anteil macht das Teilergebnis sagbar. */
function urteil(ergebnis: Ergebnis): string {
  if (ergebnis.richtig) return 'Richtig.';
  return ergebnis.anteil > 0 ? 'Teilweise richtig.' : 'Falsch.';
}

/**
 * Der Zusatz zum Ergebnissatz — nur fuer die beiden Faelle, die etwas kosten.
 *
 * Sicher und daneben ist der teure Fall: Eine Fehlvorstellung, die sich sicher
 * anfuehlt, loest sich nicht von selbst auf. Getroffen und geraten ist der
 * andere: Glueck ist kein Koennen, und der Planer behandelt es auch nicht so.
 */
function hinweisZu(richtig: boolean, stufe: Stufe): string | null {
  if (!richtig && stufe === 'sicher') {
    return 'Sicher und daneben — solche Fragen kommen bevorzugt zurück.';
  }
  if (richtig && stufe === 'geraten') {
    return 'Getroffen, aber geraten — der Planer holt die Frage früh zurück.';
  }
  return null;
}
```

- [ ] **Schritt 5: `Lektion.astro` auf die Hülle umstellen (Zwischenstand)**

In `src/layouts/Lektion.astro`:
- `import Frage from '../components/Frage.tsx';` → `import Aufgabe from '../components/Aufgabe.tsx';`
- Den Aufruf in Takt 4 ersetzen durch:

```astro
      {daten.fragen.map((frage) => (
        <Aufgabe client:idle lektion={eintrag.id} aufgabe={{ typ: 'wahl' as const, ...frage }} />
      ))}
```
- Den Aufruf in Takt 5 ersetzen durch:

```astro
      <Aufgabe client:idle lektion={eintrag.id} aufgabe={{ typ: 'wahl' as const, ...daten.transfer }} />
```
- Im Kommentar über Takt 4 `Frage.js` → `Aufgabe.js`.

Das `typ: 'wahl' as const` ist der Zwischenstand, bis Aufgabe 12 das Feld in die Lektionen selbst schreibt.

- [ ] **Schritt 6: `Frage.tsx` entfernen, den Verweis in `Zuversicht.tsx` nachziehen**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && git rm -q src/components/Frage.tsx && sed -i 's/entscheidet `Frage.tsx`/entscheidet `Aufgabe.tsx`/' src/components/Zuversicht.tsx && grep -rn "Frage.tsx\|components/Frage" src tests
```
Erwartet: keine Treffer mehr außer in Kommentaren, die bewusst von der Herkunft sprechen („aus `Frage.tsx`").

- [ ] **Schritt 7: Alles laufen lassen**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && npm test 2>&1 | grep -E "Tests |Test Files |FAIL" && npm run check 2>&1 | grep -E "^- [0-9]+ error" && npm run build 2>&1 | grep -E "page\(s\)"
```
Erwartet: `Tests  358 passed (358)`, `- 0 errors`, `5 page(s) built`.

- [ ] **Schritt 8: Zod ist nicht im Browserbündel**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && ls -l dist/astro/Aufgabe.*.js | awk '{printf "%.1f KB  %s\n", $5/1024, $9}' && grep -c "ZodError\|discriminatedUnion" dist/astro/Aufgabe.*.js
```
Erwartet: eine Datei unter 60 KB und die Zahl `0`. Steht dort etwas anderes, hat eine Komponente einen Wert statt eines Typs aus einer `schema.ts` importiert — den Import auf `import type` umstellen.

- [ ] **Schritt 9: Committen**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && git add src/aufgaben/Aufgabentyp.tsx src/components/Aufgabe.tsx src/components/Zuversicht.tsx src/layouts/Lektion.astro tests/aufgabe.test.tsx && git commit -q -F - <<'MSG'
feat: Huelle Aufgabe.tsx ersetzt Frage.tsx

Die Huelle fuehrt Zuversicht, Aufzeichnung und Terminplanung und kennt
keinen Aufgabentyp - nur den Vertrag. Steht die Bewertung bei der
Abgabe schon fest, loest sie nach der Zuversicht in einem Zug auf, in
derselben Reihenfolge wie bisher: erst die Anzeige, dann das Schreiben.
Nur fall reicht die Bewertung nach; ein Test haelt fest, dass die
Pruefpunkte erst NACH der Zuversicht im Dokument stehen und dass bis
zum Abhaken nichts aufgezeichnet wird.

Der Verteiler ist ein switch mit never-Pruefung statt einer Abbildung:
Ein fuenfter Typ faellt beim Uebersetzen auf, nicht im Betrieb.

Die 27 Tests der Frage laufen als Huellentests weiter, fuenf neue
decken die uebrigen Typen ab. Zod bleibt aus dem Browserbuendel.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
MSG
```

---

## Aufgabe 12: Das Lektionsschema — `aufgaben` statt `fragen`

**Dateien:**
- Ändern: `src/content/schema.ts`, `src/layouts/Lektion.astro`, `.claude/skills/kernbohrung-compiler/SKILL.md`, alle vier `inhalt/lektionen/*.mdx`
- Neu: `src/layouts/LektionAnsicht.astro`
- Test ändern: `tests/content-schema.test.ts`, `tests/pruefe-lektion.test.ts`

- [ ] **Schritt 1: Die Tests auf das neue Schema richten**

`tests/content-schema.test.ts`:
- In der Hilfe `frage(id)` als erste Eigenschaft `typ: 'wahl',` ergänzen.
- Alle Eigenschaften `fragen:` → `aufgaben:` (in `lektion()` und in den Tests 1–5; der Testname `'5. lehnt eine Kollision zwischen fragen[].id und transfer.id ab'` → `'5. lehnt eine Kollision zwischen aufgaben[].id und transfer.id ab'`).
- Am Ende der Datei anhängen:

```ts
describe('LektionSchema - die Aufgabenfamilie', () => {
  const reihenfolge = (id: string) => ({
    typ: 'reihenfolge',
    id,
    aufgabe: 'Ordne.',
    schritte: ['erst', 'dann', 'zuletzt'],
  });

  it('weist das alte Feld fragen zurueck und sagt, wie es jetzt heisst', () => {
    const { aufgaben: _aufgaben, ...ohne } = lektion();
    const befund = LektionSchema.safeParse({ ...ohne, fragen: [frage('f-1'), frage('f-2')] });
    expect(befund.success).toBe(false);
    if (befund.success) return;
    expect(befund.error.issues.map((i) => i.message).join(' | ')).toMatch(/fragen heißt jetzt aufgaben/);
  });

  it('nimmt bis zu sechs Aufgaben und weist die siebte zurueck', () => {
    const viele = (n: number) => Array.from({ length: n }, (_, i) => frage(`f-${i}`));
    expect(LektionSchema.safeParse(lektion({ aufgaben: viele(6) })).success).toBe(true);
    expect(LektionSchema.safeParse(lektion({ aufgaben: viele(7) })).success).toBe(false);
  });

  it('nimmt gemischte Typen an, auch als Transfer', () => {
    const gemischt = lektion({ aufgaben: [frage('f-1'), reihenfolge('r-1')], transfer: reihenfolge('r-t') });
    expect(LektionSchema.safeParse(gemischt).success).toBe(true);
  });
});
```

`tests/pruefe-lektion.test.ts`, im Muster `gute`:
- `fragen:` → `aufgaben:`
- `  - id: p-1` → zwei Zeilen `  - typ: wahl` und `    id: p-1`; ebenso bei `p-2`
- `transfer:` gefolgt von `  id: p-t` → dazwischen die Zeile `  typ: wahl` einfügen

- [ ] **Schritt 2: Tests laufen lassen, Fehlschlag ansehen**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && npx vitest run tests/content-schema.test.ts tests/pruefe-lektion.test.ts 2>&1 | grep -E "Tests |×" | head
```
Erwartet: FAIL — das alte Schema kennt `aufgaben` nicht.

- [ ] **Schritt 3: Das Lektionsschema umstellen**

`src/content/schema.ts` vollständig ersetzen durch:

```ts
import { z } from 'astro/zod';
import { AufgabeSchema } from '../aufgaben/schema.ts';

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
 * Was eine Aufgabe ist, steht in `src/aufgaben/` — der Import traegt die
 * Endung `.ts`, weil `werkzeug/pruefe-lektion.mjs` diese Datei unter reinem
 * Node laedt.
 */

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
    // enthalten Punkte, die keine Satzenden sind.
    prinzip: z
      .string()
      .trim()
      .min(1)
      .max(200, 'prinzip soll ein Satz sein, kein Absatz (max. 200 Zeichen).'),
    reihenfolge: z.number().int().positive(),
    gesperrt: z.boolean().default(false),
    // Bis zur Aufgabenfamilie hiess das Feld `fragen`. Ein nicht-striktes
    // Objekt wuerde den alten Namen stillschweigend verwerfen, und uebrig
    // bliebe die Meldung „aufgaben fehlt" — ohne jeden Hinweis, was zu tun
    // ist. Migration statt stiller Voreinstellung: Der alte Name ist ein
    // Fehler mit Anleitung.
    fragen: z
      .unknown()
      .optional()
      .refine(
        (wert) => wert === undefined,
        'fragen heißt jetzt aufgaben, und jede Aufgabe braucht ein Feld typ (zum Beispiel typ: wahl).',
      ),
    // Zwei bis sechs: Faelle brauchen mehr Raum als Wahlfragen.
    aufgaben: z.array(AufgabeSchema).min(2).max(6),
    transfer: AufgabeSchema,
    quellen: z.array(QuelleSchema).min(1),
  })
  // `id` ist die stabile Identitaet einer Aufgabe, an der der Lernfortschritt
  // haengt. Kollidieren zwei, verschmilzt der Fortschritt zweier Aufgaben
  // lautlos — teuer und schwer zu bemerken. Die Transferaufgabe zaehlt mit.
  .refine(
    (l) => {
      const ids = [...l.aufgaben.map((a) => a.id), l.transfer.id];
      return new Set(ids).size === ids.length;
    },
    'aufgaben[].id und transfer.id müssen innerhalb der Lektion eindeutig sein.',
  );

export type Lektion = z.infer<typeof LektionSchema>;
```

- [ ] **Schritt 4: Die vier Lektionen migrieren**

Einmalskript, im Projektordner anlegen, ausführen, löschen. Die Dateien tragen CRLF (`autocrlf`) — das Zeilenende bleibt, wie es ist.

`migriere-aufgaben.mjs`:

```js
import fs from 'node:fs';

const ordner = 'inhalt/lektionen';
for (const datei of fs.readdirSync(ordner).filter((d) => d.endsWith('.mdx'))) {
  const pfad = `${ordner}/${datei}`;
  const alt = fs.readFileSync(pfad, 'utf8');
  const nl = alt.includes('\r\n') ? '\r\n' : '\n';
  const zeilen = alt.split(nl);
  const ende = zeilen.indexOf('---', 1); // Ende des Frontmatters
  let imTransfer = false;
  let stellen = 0;

  const neu = zeilen.flatMap((zeile, i) => {
    if (i === 0 || i >= ende) return [zeile];
    if (zeile === 'fragen:') {
      stellen++;
      return ['aufgaben:'];
    }
    if (zeile === 'transfer:') {
      imTransfer = true;
      return [zeile];
    }
    if (!imTransfer && zeile.startsWith('  - id: ')) {
      stellen++;
      return ['  - typ: wahl', `    id: ${zeile.slice('  - id: '.length)}`];
    }
    if (imTransfer && zeile.startsWith('  id: ')) {
      stellen++;
      imTransfer = false;
      return ['  typ: wahl', zeile];
    }
    return [zeile];
  });

  // Drei Aufgaben, ein Transfer, ein Feldname: fuenf Stellen je Datei.
  if (ende < 0 || stellen !== 5) {
    console.error(`${datei}: ${stellen} Stellen statt 5 — nicht geschrieben`);
    process.exitCode = 1;
    continue;
  }
  fs.writeFileSync(pfad, neu.join(nl));
  console.log(`${datei}: ${stellen} Stellen`);
}
```

`pruefe-alle.mjs` (ebenfalls einmalig; als Datei und nicht als `node -e`, weil `pruefe-lektion.mjs` beim Laden `process.argv[1]` liest):

```js
import fs from 'node:fs';
import { pruefeLektionsText } from './werkzeug/pruefe-lektion.mjs';

let schlecht = 0;
for (const datei of fs.readdirSync('inhalt/lektionen').filter((d) => d.endsWith('.mdx'))) {
  const befund = pruefeLektionsText(fs.readFileSync(`inhalt/lektionen/${datei}`, 'utf8'));
  console.log(befund.ok ? 'ok     ' : 'MANGEL ', datei, befund.ok ? '' : befund.maengel.join(' | '));
  if (!befund.ok) schlecht++;
}
process.exit(schlecht ? 1 : 0);
```

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && node migriere-aufgaben.mjs && node pruefe-alle.mjs; rm -f migriere-aufgaben.mjs pruefe-alle.mjs; git status --short inhalt/
```
Erwartet: viermal `… : 5 Stellen`, viermal `ok`, und `git status` zeigt genau vier geänderte `.mdx`-Dateien. `pruefe-alle.mjs` läuft unter reinem Node — dass es läuft, ist zugleich der Nachweis, dass die Importkette `content/schema.ts → aufgaben/schema.ts → */schema.ts` überall die Endung trägt.

- [ ] **Schritt 5: Das Layout teilen**

`src/layouts/LektionAnsicht.astro` (neu):

```astro
---
import type { Lektion } from '../content/schema';
import Seite from './Seite.astro';
import Aufgabe from '../components/Aufgabe.tsx';
import Herkunft from '../components/Herkunft.astro';

/**
 * Der einzige Ort im Projekt, der die Reihenfolge der sechs Takte kennt.
 *
 * Takt 1 (Der Widerspruch) und Takt 2 (Das Bild) kommen ueber den Slot, Takt 3
 * bis 6 aus `daten`. Inhalt liefert damit Teile, nie Struktur: eine generierte
 * Lektion kann den Rhythmus nicht umstellen, weil sie ihn gar nicht in der
 * Hand hat. Takt 2 ist wahlfrei — eine Lektion ohne Widget hat im Slot nur den
 * Widerspruch.
 *
 * Entscheidend ist die Stellung des Slots vor Takt 3 — erst spielen, dann
 * erklaeren. Wer diese beiden Abschnitte tauscht, kippt die Didaktik, nicht das
 * Layout.
 *
 * Diese Datei nimmt ein Datenobjekt und weiss nichts von `astro:content`. Das
 * ist der Schnitt fuer Lektionen, die spaeter nicht aus der Sammlung kommen.
 */
interface Props {
  /** Kennung der Lektion — mit der Aufgaben-Id der Schluessel im Speicher. */
  id: string;
  daten: Lektion;
}

const { id, daten } = Astro.props;
---
<Seite titel={daten.titel}>
  <article class="lektion">
    <h1>{daten.titel}</h1>

    <section class="takt" data-takt="widerspruch-und-bild">
      <slot />
    </section>

    <section class="takt" data-takt="satz">
      {/* Die Augenbrauen benennen den Takt, den die Datei ohnehin kennt.
          Sie sind Beschriftung, keine Struktur: wer sie entfernt, aendert
          die Reihenfolge nicht. */}
      <p class="augenbraue">Takt 3 · Der Satz</p>
      <p class="prinzip">{daten.prinzip}</p>
    </section>

    {/*
      client:idle statt client:visible, gemessen begruendet: Das Buendel der
      Aufgabe ist klein gegen die React-Laufzeit, die ohnehin geladen wird.
      Aufgeschobenes Hydrieren spart hier nichts und handelt sich dafuer einen
      Ausfallmodus ein: client:visible haengt an einem IntersectionObserver,
      und der feuert nicht, solange das Dokument als versteckt gilt — im
      Hintergrundtab, bei Vorabdarstellung, in eingebetteten Ansichten. Ein
      Knopf, der nicht reagiert, ist bei einer Lern-App kein Randfall, sondern
      die kaputte Hauptsache.
    */}
    <section class="takt" data-takt="probe">
      <p class="augenbraue">Takt 4 · Die Probe</p>
      <h2>Die Probe</h2>
      {daten.aufgaben.map((aufgabe) => (
        <Aufgabe client:idle lektion={id} aufgabe={aufgabe} />
      ))}
    </section>

    <section class="takt" data-takt="transfer">
      <p class="augenbraue">Takt 5 · Der Transfer</p>
      <h2>Der Transfer</h2>
      <Aufgabe client:idle lektion={id} aufgabe={daten.transfer} />
    </section>

    <section class="takt" data-takt="herkunft">
      <p class="augenbraue">Takt 6 · Herkunft</p>
      <h2>Herkunft</h2>
      <Herkunft quellen={daten.quellen} />
    </section>
  </article>
</Seite>
```

`src/layouts/Lektion.astro` vollständig ersetzen durch:

```astro
---
import type { CollectionEntry } from 'astro:content';
import { render } from 'astro:content';
import LektionAnsicht from './LektionAnsicht.astro';
import { widgets } from '../widgets';

/**
 * Holt eine Lektion aus der Sammlung und reicht sie an die Ansicht.
 *
 * Alles, was `astro:content` kennt, steht hier. Die Ansicht selbst nimmt ein
 * Datenobjekt — eine Lektion aus einer anderen Quelle waere ein zweiter
 * Aufrufer derselben Ansicht.
 */
interface Props {
  eintrag: CollectionEntry<'lektionen'>;
}

const { eintrag } = Astro.props;
// `render` ist eine eigenstaendige Funktion, kein `eintrag.render()`.
const { Content } = await render(eintrag);
---
<LektionAnsicht id={eintrag.id} daten={eintrag.data}>
  {/* `components` loest die Widget-Namen auf, die der Rumpf benutzt.
      Deshalb enthaelt generiertes MDX keine import-Zeilen. */}
  <Content components={widgets} />
</LektionAnsicht>
```

- [ ] **Schritt 6: Den Compiler-Skill nachziehen**

In `.claude/skills/kernbohrung-compiler/SKILL.md` die Tabellenzeile

```text
| 4 Die Probe | Frontmatter `fragen` | zwei bis vier Fragen |
```

ersetzen durch

```text
| 4 Die Probe | Frontmatter `aufgaben` | zwei bis sechs Aufgaben, jede mit `typ` — bis der Skill die übrigen Typen lernt: `typ: wahl` |
```

Mehr nicht: Die neuen Typen lernt der Skill in Teilprojekt 2. Ohne diese eine Zeile erzeugte er aber ab jetzt ungültige Lektionen.

- [ ] **Schritt 7: Alles laufen lassen**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && npm test 2>&1 | grep -E "Tests |Test Files |FAIL" && npm run check 2>&1 | grep -E "^- [0-9]+ error" && npm run build 2>&1 | grep -E "page\(s\)"
```
Erwartet: `Tests  361 passed (361)`, `- 0 errors`, `5 page(s) built`.

- [ ] **Schritt 8: Committen**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && git add src/content/schema.ts src/layouts/Lektion.astro src/layouts/LektionAnsicht.astro .claude/skills/kernbohrung-compiler/SKILL.md tests/content-schema.test.ts tests/pruefe-lektion.test.ts inhalt/lektionen/auslagern-nimmt-die-grundlage.mdx inhalt/lektionen/kein-boden-ist-ein-boden.mdx inhalt/lektionen/kontrollfluss-folgt-modellstaerke.mdx inhalt/lektionen/recall-vor-precision.mdx && git commit -q -F - <<'MSG'
feat: Lektionsschema mit aufgaben statt fragen

Eine Lektion traegt zwei bis sechs Aufgaben beliebigen Typs und einen
Transfer. typ steht ausdruecklich in jeder Aufgabe; die vier
bestehenden Lektionen sind migriert. Der alte Feldname ist ein Fehler
mit Anleitung statt einer stillen Voreinstellung - ein nicht-striktes
Objekt haette ihn verschluckt und nur "aufgaben fehlt" gemeldet.

Das Layout ist geteilt: LektionAnsicht nimmt ein Datenobjekt und weiss
nichts von astro:content, Lektion holt es aus der Sammlung. Das ist der
Schnitt fuer Lektionen, die spaeter nicht aus der Sammlung kommen.

Der Compiler-Skill bekommt die eine Zeile, ohne die er ab jetzt
ungueltige Lektionen erzeugte. Die neuen Typen lernt er in
Teilprojekt 2.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
MSG
```

---

## Aufgabe 13: Gestaltung der neuen Typen

**Dateien:**
- Ändern: `src/styles/global.css` (nur anhängen)

Kein neues Farbtoken. Alles hängt an den vorhandenen — damit gelten die gemessenen Kontraste weiter: `--auf-fill` auf `--akzent-fill` 8,22 · `--ink-2` auf `--flaeche-2` 4,84 (hell) / 5,22 (dunkel) · `--rand-bedien` gegen alle drei Flächen ≥ 3:1.

- [ ] **Schritt 1: Den Block anhängen**

Am Ende von `src/styles/global.css`:

```css
/* ---------------------------------------------------------------
   Aufgabenfamilie

   Drei Regeln fuer alles hier:
   - Jede Bedienflaeche mindestens 44 x 44 Pixel, die grossen 48.
   - Umrisse bedienbarer Elemente ueber --rand-bedien (3:1, WCAG
     1.4.11), nie ueber --rand.
   - Kein neues Farbtoken. Ein Zustand, der nur Farbe traegt, ist
     keiner (WCAG 1.4.1) — jede Aufloesung steht auch als Text da.
   --------------------------------------------------------------- */

/* Der Knopf, mit dem man sich festlegt. Gefuellt, weil er der eine
   Hauptschritt der Karte ist; gesperrt faellt er auf die Flaeche
   zurueck, statt blass zu werden — Transparenz kostet Kontrast. */
.abgeben {
  margin-top: 16px;
  min-height: 48px;
  padding: 11px 22px;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
  color: var(--auf-fill);
  background: var(--akzent-fill);
  border: 1px solid transparent;
  border-radius: var(--radius-pille);
}

.abgeben:disabled {
  cursor: default;
  color: var(--ink-2);
  background: var(--flaeche-2);
  border-color: var(--rand-bedien);
}

/* --- fall ------------------------------------------------------ */

.fall-sachverhalt {
  margin: 0 0 16px;
  padding: 14px 16px;
  background: var(--flaeche-2);
  border-left: 3px solid var(--rand-stark);
  border-radius: 0 var(--radius-antwort) var(--radius-antwort) 0;
}

.fall-sachverhalt p {
  margin: 0 0 10px;
}

.fall-sachverhalt p:last-child {
  margin-bottom: 0;
}

.fall-beschriftung {
  display: block;
  margin: 14px 0 6px;
  font-size: 15px;
  color: var(--ink-2);
}

.fall-eingabe {
  display: block;
  width: 100%;
  min-height: 9.5rem;
  resize: vertical;
  padding: 12px 14px;
  font: inherit;
  line-height: 1.5;
  color: var(--ink);
  background: var(--flaeche-2);
  border: 1px solid var(--rand-bedien);
  border-radius: var(--radius-antwort);
}

.fall-eingabe:read-only {
  background: var(--grund);
}

.fall-zaehler {
  margin: 6px 0 0;
  font-family: var(--schrift-mono);
  font-size: 12px;
  text-align: right;
  color: var(--ink-2);
}

.pruefpunkte {
  min-width: 0;
  margin: 20px 0 0;
  padding: 18px 0 0;
  border: 0;
  border-top: 1px dashed var(--rand-stark);
}

.pruefpunkte legend {
  float: left;
  width: 100%;
  padding: 0;
  margin: 0 0 4px;
  font-size: 15px;
  color: var(--ink-2);
}

/* Die ganze Zeile ist die Tippflaeche, nicht das Kaestchen. */
.pruefpunkt {
  clear: both;
  display: flex;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 6px 12px;
  min-height: 48px;
  margin-top: 8px;
  padding: 12px 14px;
  cursor: pointer;
  background: var(--flaeche-2);
  border: 1px solid var(--rand-bedien);
  border-left: 3px solid transparent;
  border-radius: var(--radius-antwort);
}

.pruefpunkt input {
  flex: none;
  width: 22px;
  height: 22px;
  margin: 1px 0 0;
  accent-color: var(--teal);
}

.pruefpunkt-text {
  flex: 1 1 12rem;
  min-width: 0;
}

.pruefpunkt[data-zustand='gehabt'] {
  border-left-color: var(--richtig);
}

.pruefpunkt[data-zustand='fehlt'] {
  border-left-color: var(--falsch);
}

.pruefpunkt-marke {
  flex-basis: 100%;
  font-family: var(--schrift-mono);
  font-size: 11.5px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ink-2);
}

.pruefpunkt[data-zustand='fehlt'] .pruefpunkt-marke {
  color: var(--falsch);
}

.musterloesung {
  margin-top: 18px;
  padding: 14px 16px;
  background: var(--teal-weich);
  border-radius: var(--radius-antwort);
}

.musterloesung p {
  margin: 0 0 10px;
}

.musterloesung p:last-child {
  margin-bottom: 0;
}

/* --- zuordnen --------------------------------------------------- */

.zuordnen-liste,
.zuordnen-optionen {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}

.zuordnen-liste {
  gap: 8px;
}

.zuordnen-links {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 3px;
  width: 100%;
  min-height: 48px;
  padding: 11px 14px;
  font: inherit;
  text-align: left;
  cursor: pointer;
  overflow-wrap: anywhere;
  color: var(--ink);
  background: var(--flaeche-2);
  border: 1px solid var(--rand-bedien);
  border-left: 3px solid transparent;
  border-radius: var(--radius-antwort);
}

.zuordnen-links:disabled {
  cursor: default;
}

.zuordnen-links[aria-expanded='true'] {
  background: var(--flaeche);
  border-left-color: var(--akzent-fill);
}

.zuordnen-begriff {
  font-weight: 700;
}

.zuordnen-wahl {
  font-size: 14.5px;
  color: var(--ink-2);
}

/* Eingerueckt unter dem linken Eintrag: Die Auswahl gehoert sichtbar
   zu ihm, nicht zur naechsten Zeile. */
.zuordnen-optionen {
  gap: 6px;
  margin: 6px 0 4px 14px;
}

.zuordnen-option {
  width: 100%;
  min-height: 44px;
  padding: 9px 13px;
  font: inherit;
  font-size: 15px;
  text-align: left;
  cursor: pointer;
  overflow-wrap: anywhere;
  color: var(--ink);
  background: var(--flaeche);
  border: 1px solid var(--rand-bedien);
  border-radius: var(--radius-antwort);
}

.zuordnen-option:disabled {
  cursor: default;
  color: var(--ink-2);
  background: var(--grund);
  border-style: dashed;
}

.zuordnen-zeile[data-zustand='richtig'] .zuordnen-links {
  border-left-color: var(--richtig);
}

.zuordnen-zeile[data-zustand='falsch'] .zuordnen-links {
  border-left-color: var(--falsch);
}

/* --- reihenfolge ------------------------------------------------ */

.reihenfolge-liste {
  list-style: none;
  counter-reset: schritt;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.reihenfolge-zeile {
  counter-increment: schritt;
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 56px;
  padding: 6px 8px 6px 14px;
  background: var(--flaeche-2);
  border: 1px solid var(--rand-bedien);
  border-left: 3px solid transparent;
  border-radius: var(--radius-antwort);
}

.reihenfolge-zeile::before {
  content: counter(schritt);
  flex: none;
  width: 1.4em;
  font-family: var(--schrift-mono);
  font-size: 13px;
  color: var(--ink-2);
}

.reihenfolge-text {
  flex: 1 1 auto;
  min-width: 0;
  overflow-wrap: anywhere;
}

.reihenfolge-knoepfe {
  flex: none;
  display: flex;
  gap: 4px;
}

.reihenfolge-knopf {
  width: 44px;
  height: 44px;
  font: inherit;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  color: var(--ink);
  background: var(--flaeche);
  border: 1px solid var(--rand-bedien);
  border-radius: 10px;
}

.reihenfolge-knopf:disabled {
  cursor: default;
  color: var(--ink-2);
  border-style: dashed;
}

.reihenfolge-zeile[data-zustand='richtig'] {
  border-left-color: var(--richtig);
}

.reihenfolge-zeile[data-zustand='falsch'] {
  border-left-color: var(--falsch);
}

.reihenfolge-loesung {
  margin-top: 16px;
}

.reihenfolge-loesung ol {
  margin: 6px 0 0;
  padding-left: 1.4rem;
  color: var(--ink-2);
}

/* Am Handy bleiben neben zwei 44er-Knoepfen rund 125 Pixel fuer den
   Text. Dann wandern die Knoepfe unter den Text, statt ihn zu
   zerquetschen. */
@media (max-width: 480px) {
  .reihenfolge-zeile {
    flex-wrap: wrap;
  }

  .reihenfolge-text {
    flex-basis: calc(100% - 2.4em);
  }

  .reihenfolge-knoepfe {
    margin-left: auto;
  }
}
```

- [ ] **Schritt 2: Kein Token ins Leere**

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
Erwartet: `alle benutzten Token stehen auf :root`, `5 page(s) built`.

- [ ] **Schritt 3: Committen**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && git add src/styles/global.css && git commit -q -F - <<'MSG'
feat: Gestaltung der Aufgabentypen fall, zuordnen, reihenfolge

Kein neues Farbtoken - die gemessenen Kontraste gelten weiter. Jede
Bedienflaeche mindestens 44 Pixel, Umrisse ueber --rand-bedien. Bei
fall ist die ganze Zeile eines Pruefpunkts die Tippflaeche, nicht das
Kaestchen. Bei reihenfolge wandern die Knoepfe am Handy unter den Text,
statt ihn auf 125 Pixel zu quetschen. Gemessen wird in der Abnahme am
gebauten Stand.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
MSG
```

---

## Aufgabe 14: Die erste Lektion mit echtem Stoff

Eine Lektion von Hand, die alle vier Typen trägt — aus der Projektmanagement-Vorlesung, Modul 7, Folien 31–33 (Bauvertragsarten und Risikoverteilung). Sie ist zugleich die Vorlage für den Compiler in Teilprojekt 2.

**Regeln für diese Aufgabe:**
- Der Text unten ist eigene Formulierung, keine Abschrift der Folien. **Nicht umformulieren, nicht ergänzen** — jede Aussage ist gegen die Folien oder gegen die VOB/B gesetzt.
- Die Lektion steht bis Teilprojekt 2 **ohne Lehrplaneintrag** da. Das ist dieselbe Warnung wie bei `recall-vor-precision`, hier bewusst und befristet: Das Lehrplanformat für Folien gibt es erst mit der Bibliothek, die den Eintrag beim Einlesen nachträgt.
- Folien und Rohtext gehören nicht ins Repo. In der Lektion stehen nur Verweise.

**Dateien:**
- Neu: `inhalt/lektionen/pauschal-heisst-nicht-komplett.mdx`

- [ ] **Schritt 1: Die drei Rechtsaussagen am Wortlaut prüfen**

Die Lektion stützt sich über die Folien hinaus auf VOB/B § 2. Den Wortlaut öffnen (`https://dejure.org/gesetze/VOB-B/2.html`) und diese drei Aussagen bestätigen:

1. **Abs. 2:** Vergütet wird nach Einheitspreisen und tatsächlich ausgeführten Leistungen, wenn keine andere Berechnungsart (Pauschalsumme, Stundenlohnsätze, Selbstkosten) vereinbart ist.
2. **Abs. 6:** Wird eine im Vertrag nicht vorgesehene Leistung gefordert, besteht Anspruch auf besondere Vergütung; der Anspruch ist anzukündigen, **bevor** mit der Ausführung begonnen wird.
3. **Abs. 7:** Bei vereinbarter Pauschalsumme bleibt die Vergütung unverändert — und die Absätze 4, 5 und 6 gelten auch bei Pauschalsumme.

Weicht der Wortlaut in einem der drei Punkte ab: **anhalten und melden.** Rechtsinhalt wird nicht auf eigene Faust umgeschrieben.

- [ ] **Schritt 2: Die Lektion anlegen**

`inhalt/lektionen/pauschal-heisst-nicht-komplett.mdx`:

```mdx
---
titel: "Pauschal heißt nicht komplett"
prinzip: "Ein Pauschalpreis verlagert das Mengenrisiko; das Vollständigkeitsrisiko verlagert erst die Komplettheitsklausel."
reihenfolge: 5
gesperrt: false
aufgaben:
  - typ: zuordnen
    id: phnk-1
    aufgabe: "Ordne jeder Vertragsart zu, wonach sich die Vergütung bemisst."
    paare:
      - links: "Einheitspreisvertrag"
        rechts: "Preis je Einheit mal tatsächlich ausgeführte Menge"
      - links: "Pauschalvertrag"
        rechts: "Ein fester Preis für die vereinbarte Leistung, ohne Aufmaß"
      - links: "Stundenlohnvertrag"
        rechts: "Preis je geleisteter Stunde"
      - links: "Selbstkostenerstattungsvertrag"
        rechts: "Nachgewiesene Kosten des Auftragnehmers"
    ablenker:
      - "Anteil an der späteren Miete des Gebäudes"
  - typ: reihenfolge
    id: phnk-2
    aufgabe: "Ordne die Vertragsformen danach, wie viel Risiko der Auftragnehmer trägt — vom geringsten zum größten."
    schritte:
      - "Selbstkostenerstattungsvertrag"
      - "Einheitspreisvertrag"
      - "Detail-Pauschalvertrag"
      - "Komplexer Global-Pauschalvertrag mit Komplettheitsklausel"
  - typ: fall
    id: phnk-3
    sachverhalt: |
      Eine Gemeinde vergibt den Rohbau einer Kita zum Pauschalpreis von 1,2 Millionen Euro. Grundlage ist ein Leistungsverzeichnis mit 140 Positionen, das ihr Architekt aufgestellt hat. Die VOB/B ist vereinbart, eine Komplettheitsklausel enthält der Vertrag nicht.

      Während der Ausführung zeigt sich: Die Abdichtung der Bodenplatte gegen drückendes Wasser steht in keiner Position. Ohne sie ist der Rohbau nicht mangelfrei herzustellen. Die Gemeinde verlangt die Abdichtung. Der Unternehmer kündigt vor der Ausführung an, dass er dafür eine zusätzliche Vergütung beansprucht. Die Gemeinde lehnt ab: Pauschal sei pauschal.
    aufgabe: "Wer hat recht — und warum? Schreib deine Lösung in drei bis fünf Sätzen."
    pruefpunkte:
      - text: "Der Pauschalpreis deckt das Mengenrisiko ab, nicht von selbst das Vollständigkeitsrisiko."
        pflicht: true
      - text: "Beim Detail-Pauschalvertrag bestimmt die detaillierte Beschreibung, was für den Preis geschuldet ist."
        pflicht: true
      - text: "Die Abdichtung ist nicht beschrieben, also eine zusätzliche Leistung — der Unternehmer kann dafür Vergütung verlangen."
        pflicht: true
      - text: "Anders läge es mit Komplettheitsklausel oder globaler Leistungsbeschreibung: Dann trüge der Unternehmer das Vollständigkeitsrisiko."
        pflicht: false
      - text: "Der Unternehmer hat den Anspruch vor der Ausführung angekündigt, wie es die VOB/B für zusätzliche Leistungen verlangt."
        pflicht: false
    musterloesung: |
      Der Unternehmer hat recht. Der Pauschalpreis friert die Mengen ein: Braucht die beschriebene Leistung mehr Material oder Zeit als gedacht, ist das seine Sache. Ob aber alles Nötige überhaupt beschrieben war, ist eine andere Frage — das Vollständigkeitsrisiko.

      Bei einem Detail-Pauschalvertrag legt das detaillierte Leistungsverzeichnis fest, was für den Preis geschuldet ist. Die Abdichtung steht in keiner Position, sie ist also nicht mit dem Pauschalpreis abgegolten. Der Unternehmer muss sie ausführen, weil die Gemeinde sie verlangt, bekommt sie aber zusätzlich vergütet. Die VOB/B lässt diesen Anspruch bei einer Pauschalsumme ausdrücklich bestehen und verlangt nur, dass er vor der Ausführung angekündigt wird — das ist geschehen.

      Anders wäre es mit einer Komplettheitsklausel oder einer nur globalen Leistungsbeschreibung: Dann hätte der Unternehmer das Vollständigkeitsrisiko übernommen.
transfer:
  typ: wahl
  id: phnk-transfer
  frage: "Eine Auftraggeberin will Kostensicherheit und schließt deshalb einen Pauschalvertrag — auf Grundlage ihres eigenen, detaillierten Leistungsverzeichnisses. Welches Risiko trägt sie weiterhin selbst?"
  antworten:
    - text: "Dass ihr Leistungsverzeichnis eine nötige Leistung nicht enthält"
      richtig: true
      begruendung: "Was für den Pauschalpreis geschuldet ist, folgt aus ihrer eigenen detaillierten Beschreibung. Eine Lücke darin ist eine zusätzliche Leistung und kostet zusätzlich — verlagern ließe sich das nur mit einer Komplettheitsklausel oder einer globalen Beschreibung."
    - text: "Dass die Mengen größer ausfallen als im Leistungsverzeichnis angenommen"
      richtig: false
      begruendung: "Genau dieses Risiko nimmt ihr die Pauschale ab. Ohne Aufmaß bleibt der Preis für die beschriebene Leistung gleich, auch wenn mehr Beton oder mehr Stunden nötig werden."
    - text: "Dass der Unternehmer seine Preise zu niedrig kalkuliert hat"
      richtig: false
      begruendung: "Das Kalkulationsrisiko liegt beim Unternehmer, beim Einheitspreis wie bei der Pauschale. Nur bei der Erstattung nachgewiesener Selbstkosten läge es bei ihr."
    - text: "Keines — der Pauschalpreis ist der Endpreis"
      richtig: false
      begruendung: "Das ist die verbreitete Annahme und der Grund für viele Nachtragsstreitigkeiten. Der Pauschalpreis ist nur für den beschriebenen, unveränderten Leistungsumfang der Endpreis."
quellen:
  - pfad: "Vorlesung Projektmanagement (Prof. Bauch, WBA Weimar 2026), Modul 7 Risikomanagement, Folien 31–33"
  - pfad: "VOB/B § 2 Abs. 2, 6 und 7"
    url: "https://dejure.org/gesetze/VOB-B/2.html"
---

Du vergibst einen Rohbau zum Pauschalpreis. Genau deshalb hast du pauschal vergeben: ein Preis, keine Überraschungen. Drei Monate später liegt ein Nachtrag auf dem Tisch — für eine Leistung, die im Leistungsverzeichnis schlicht fehlte. Dein erster Gedanke: Das kann nicht sein, pauschal ist pauschal.

Es kann sein. Der Pauschalpreis hat dir ein Risiko abgenommen, nur nicht das, an das du gedacht hast. Er friert die **Mengen** ein: Braucht der Unternehmer mehr Beton als angenommen, ist das seine Sache. Ob aber **alles Nötige** überhaupt beschrieben war, ist eine zweite Frage — und die beantwortet nicht der Preis, sondern die Art, wie die Leistung beschrieben ist.
```

- [ ] **Schritt 3: Prüfen und bauen**

`pruefe-alle.mjs` wie in Aufgabe 12 Schritt 4 noch einmal anlegen (derselbe Inhalt), dann:

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && node pruefe-alle.mjs; rm -f pruefe-alle.mjs; npm run build 2>&1 | grep -E "page\(s\)|error" && npm test 2>&1 | grep -E "Tests |FAIL"
```
Erwartet: fünfmal `ok`, `6 page(s) built`, `Tests  361 passed (361)`.

- [ ] **Schritt 4: Committen**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && git add inhalt/lektionen/pauschal-heisst-nicht-komplett.mdx && git commit -q -F - <<'MSG'
feat: erste Lektion mit echtem Stoff - Pauschal heisst nicht komplett

Von Hand, aus der Projektmanagement-Vorlesung (Modul 7, Folien 31-33),
mit allen vier Aufgabentypen: zuordnen (Vertragsart und
Verguetungsgrundlage), reihenfolge (Vertragsformen nach Risiko des
Auftragnehmers), fall (fehlende Leistung unter einem
Detail-Pauschalvertrag), wahl als Transfer.

Eigene Formulierung, keine Abschrift. Was ueber die Folien hinausgeht,
ist gegen VOB/B Paragraph 2 Abs. 2, 6 und 7 am Wortlaut geprueft. Folien
und Rohtext liegen nicht im Repo.

Die Lektion steht bis Teilprojekt 2 ohne Lehrplaneintrag da - bewusst
und befristet: Das Lehrplanformat fuer Folien kommt mit der Bibliothek,
die den Eintrag beim Einlesen nachtraegt.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
MSG
```

---

## Aufgabe 15: Abnahme am gebauten Stand

**Dateien:** keine Quelldateien. Behebt die Abnahme einen Fehler, bekommt die Behebung einen eigenen Commit mit Messwert vorher/nachher.

- [ ] **Schritt 1: Die drei Schranken und die NUL-Prüfung**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && npm test 2>&1 | grep -E "Tests |Test Files |FAIL" && npm run check 2>&1 | grep -E "^- [0-9]+ (error|warning)" && npm run build 2>&1 | grep -E "page\(s\)" && python -c "import sys,glob; d=[f for m in ('src/aufgaben/**/*','src/components/*','src/tutor/*','src/layouts/*','tests/*','inhalt/lektionen/*') for f in glob.glob(m,recursive=True) if '.' in f.split('/')[-1].split(chr(92))[-1]]; print('NUL-Bytes:', sum(open(f,'rb').read().count(b'\x00') for f in d), 'in', len(d), 'Dateien')"
```
Erwartet: `Tests  361 passed (361)`, `- 0 errors`, `- 0 warnings`, `6 page(s) built`, `NUL-Bytes: 0`.

- [ ] **Schritt 2: Den gebauten Stand ausliefern**

Die Vorschau `kernbohrung-bau` (Port 4322) neu starten, damit sie den frischen Bau ausliefert: `preview_list` → laufenden Eintrag mit `preview_stop` beenden → `preview_start` mit `name: "kernbohrung-bau"`.

- [ ] **Schritt 3: Tippflächen bei 375 Pixeln**

`resize_window` mit `preset: "mobile"`, dann `http://localhost:4322/lektion/pauschal-heisst-nicht-komplett/` öffnen und mit `javascript_tool` messen:

```js
await new Promise((r) => setTimeout(r, 1500));
const gruppen = {
  Antwort: '.antwort',
  'Abgeben/Fertig': '.abgeben',
  'Zuordnen links': '.zuordnen-links',
  'Reihenfolge-Knopf': '.reihenfolge-knopf',
  Textfeld: '.fall-eingabe',
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
aus.ueberlauf = document.documentElement.scrollWidth - innerWidth;
aus;
```
Erwartet: in jeder Gruppe `zu klein: 0`, `ueberlauf: 0`. Eine Gruppe mit `zu klein` größer null wird in `global.css` behoben, nachgemessen und eigens committet.

- [ ] **Schritt 4: Jeden Typ einmal durchspielen**

Auf derselben Seite:

```js
const warte = (ms) => new Promise((r) => setTimeout(r, ms));
const bericht = [];
for (const karte of document.querySelectorAll('.frage')) {
  const typ = karte.dataset.typ;
  if (typ === 'wahl') karte.querySelector('.antwort').click();
  if (typ === 'zuordnen') {
    for (const links of karte.querySelectorAll('.zuordnen-links')) {
      links.click();
      await warte(80);
      const frei = [...karte.querySelectorAll('.zuordnen-option')].find((o) => !o.disabled);
      bericht.push(`Option ${Math.round(frei.getBoundingClientRect().height)}px hoch`);
      frei.click();
      await warte(80);
    }
    karte.querySelector('.abgeben').click();
  }
  if (typ === 'reihenfolge') karte.querySelector('.abgeben').click();
  if (typ === 'fall') {
    const feld = karte.querySelector('.fall-eingabe');
    // React ueberhoert eine direkte Zuweisung an .value. Der native Setter
    // plus ein input-Ereignis ist der Weg, den auch Testing Library geht.
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(feld, 'Probe aus der Abnahme.');
    feld.dispatchEvent(new Event('input', { bubbles: true }));
    await warte(80);
    karte.querySelector('.abgeben').click();
  }
  await warte(150);
  karte.querySelector('.stufe').click();
  await warte(250);
  if (typ === 'fall') {
    bericht.push(`Prüfpunkt ${Math.round(karte.querySelector('.pruefpunkt').getBoundingClientRect().height)}px hoch`);
    karte.querySelector('.pruefpunkt input').click();
    await warte(80);
    karte.querySelector('.abgeben').click();
    await warte(250);
  }
  bericht.push(`${typ} → ${karte.dataset.phase} · ${karte.querySelector('.aufloesung')?.textContent?.trim().slice(0, 40)}`);
}
await warte(800);
bericht;
```
Erwartet: vier Zeilen `… → aufgeloest · …`, jede gemessene Höhe ≥ 44.

- [ ] **Schritt 5: Was im Speicher steht — und ob der alte Bestand gehoben wurde**

```js
const db = await new Promise((ok, nein) => {
  const a = indexedDB.open('kernbohrung-tutor');
  a.onsuccess = () => ok(a.result);
  a.onerror = () => nein(a.error);
});
const alle = await new Promise((ok, nein) => {
  const a = db.transaction('ereignisse').objectStore('ereignisse').getAll();
  a.onsuccess = () => ok(a.result);
  a.onerror = () => nein(a.error);
});
({
  fassung: db.version,
  anzahl: alle.length,
  ohneTyp: alle.filter((e) => !e.typ).length,
  nochMitGewaehlt: alle.filter((e) => 'gewaehlt' in e).length,
  letzteVier: alle.slice(-4).map((e) => [e.frage, e.typ, e.richtig, Number(e.anteil.toFixed(2)), e.merkmal.slice(0, 48)]),
});
```
Erwartet: `fassung: 2`, `ohneTyp: 0`, `nochMitGewaehlt: 0`, und `letzteVier` nennt `phnk-1` (`zuordnen`), `phnk-2` (`reihenfolge`), `phnk-3` (`fall`, `merkmal` mit `fehlt:`), `phnk-transfer` (`wahl`). Liegen in diesem Browserprofil noch Ereignisse aus früheren Sitzungen, ist `anzahl` größer als vier — dann beweist `nochMitGewaehlt: 0` den Aufstieg am echten Bestand statt nur am Test.

- [ ] **Schritt 6: Dunkler Modus trägt die neuen Flächen**

```js
document.documentElement.setAttribute('data-theme', 'dark');
const farbe = (auswahl, eigenschaft) => { const e = document.querySelector(auswahl); return e ? getComputedStyle(e)[eigenschaft] : 'nicht im Bild'; };
const aus = {
  sachverhalt: farbe('.fall-sachverhalt', 'backgroundColor'),
  eingabeRand: farbe('.fall-eingabe', 'borderTopColor'),
  zeile: farbe('.reihenfolge-zeile', 'backgroundColor'),
  musterloesung: farbe('.musterloesung', 'backgroundColor'),
};
document.documentElement.removeAttribute('data-theme');
aus;
```
Erwartet: `sachverhalt` und `zeile` `rgb(30, 37, 40)` (`--flaeche-2` dunkel), `eingabeRand` `rgb(107, 119, 124)` (`--rand-bedien` dunkel), `musterloesung` `rgb(16, 49, 46)` (`--teal-weich` dunkel). Ein heller Wert hieße: Eine Regel hängt an einer festen Farbe statt an einem Token.

Danach `resize_window` mit `preset: "desktop"`.

- [ ] **Schritt 7: Das Artifact aktualisieren — führt die Hauptsitzung aus, kein Subagent**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && rm -rf handy && cp -r dist handy && node werkzeug/relative-verweise.mjs handy && find handy -type f | sed 's|^handy/||' | sort
```
Erwartet: `Kein wurzelbezogener Verweis mehr uebrig.` und die Dateiliste. Dann mit dem Artifact-Werkzeug `handy/index.html` samt Dateien veröffentlichen (`root: "handy"`, Pfad gleich Quelle), vorhandene `astro/*`-Dateien mit altem Hash auf `null` setzen. Die Adresse bleibt `https://claude.ai/code/artifact/e321d021-7fbd-433b-9660-cef5ec626698`. **Das Artifact bleibt privat:** Es enthält jetzt eine Lektion aus fremdem Lehrmaterial.

- [ ] **Schritt 8: Übergabe**

```bash
cd "C:/Users/dno/Documents/06_Botters/01_Apps/260901_Kernbohrung" && git status --short && git log --oneline master..aufgabenfamilie
```
Erwartet: sauberer Baum, fünfzehn bis siebzehn Commits. Das Zusammenführen entscheidet der Nutzer — dafür `superpowers:finishing-a-development-branch`.

---

## Selbstprüfung gegen den Spec

| Spec-Abschnitt | Aufgabe |
|---|---|
| Die Familie: Ordner je Typ, Union, `strictObject` | 1–5 |
| `wahl` unverändert bis auf `typ` | 1, 7 |
| `fall`: Prüfpunkte, Pflicht, Zuversicht **vor** Prüfpunkten | 2, 8, 11 |
| `zuordnen`: Antippen, kein Ziehen, Ablenker | 3, 9 |
| `reihenfolge`: Knöpfe, nie schon richtig gemischt | 4, 10 |
| Gemeinsamer Vertrag `richtig` / `anteil` / `antwort` / `merkmal` | 1 |
| Hülle mit zwei Rückrufen; Verhalten der `Frage.tsx` erhalten | 11 |
| Ereignis und Speicher Fassung 2; `frage` bleibt; Größenwächter je Typ | 6 |
| `kalibrierung` gruppiert nach `merkmal`; `reife`, `auswahl`, `planung` unverändert | 6 |
| Lektionsschema: `aufgaben` 2–6, `typ` ausdrücklich, `fragen` zurückgewiesen, Migration | 12 |
| Takt 2 optional; `LektionAnsicht` aus Datenobjekt | 12, 14 |
| Bedienung: 44 px, Tastatur, kein Überlauf bei 375 px | 8–10, 13, 15 |
| Nachweis je Typ samt Mutationsprobe | 1 (wahl), 2 (fall), 3 (zuordnen), 4 (reihenfolge), 6 (Aufstieg) |
| Erste Lektion mit echtem Stoff, alle vier Typen | 14 |
| Außerhalb: Compiler, Landkarte, KI, Mathe, Code | nicht Teil dieses Plans; nur die eine SKILL.md-Zeile in 12 |

**Erwartete Testzahlen entlang des Plans:** 270 → 279 (1) → 291 (2) → 301 (3) → 311 (4) → 321 (5) → 328 (6) → 332 (7) → 339 (8) → 346 (9) → 353 (10) → 358 (11) → 361 (12). Weicht eine Zahl ab, ist das kein Fehler für sich — aber der Grund gehört in den Bericht der Aufgabe.

---

## Nachträge aus den Reviews

Was die Qualitätsprüfungen an **diesem Plan** gefunden haben — nicht an den Umsetzungen, die ihm wörtlich folgten. Die Aufgabentexte oben bleiben, wie sie ausgeführt wurden; hier steht, was dazukam.

| Aufgabe | Befund | Nachtrag |
|---|---|---|
| 1 · `wahl` | Die Regel gegen doppelte Begründungen hatte keinen Test: Die Testhilfe `antwort()` macht jede Begründung von selbst eindeutig. | Drei Tests (doppelte Begründung, Grenzen 3–5, Fremdfeld in einer Antwort); ein Kommentar in `vertrag.ts` typneutral gefasst. |
| 2 · `fall` | Kein Test verlangte `typ`; Obergrenze acht und Fremdfeld im Prüfpunkt ungetestet. Die Vorhersage der Mutationsprobe war ungenau: Die mutierte Zeile speist auch das Merkmal, es fallen drei Tests, nicht einer. | Vier Tests. Im Kommentar über `bewerteFall` steht die Falle des positionsbasierten Merkmals: neue Prüfpunkte anhängen, nicht einfügen. |
| 3 · `zuordnen` | `→` und `;` trennen die Paare in `antwort` und `merkmal`, können aber in Einträgen vorkommen. „Wirft nie“ war nur für `null` getestet. | `EintragSchema` weist beide Zeichen in `links`, `rechts` und `ablenker` zurück (JSON sprengte den Größenwächter). Acht Tests insgesamt, darunter zu kurze und zu lange Zuordnung und ein gewählter Ablenker. |
| 4 · `reihenfolge` | vorbeugend | Drei Tests mitgegeben: `typ` verlangt, zu lange Folge, unsinnige Indizes. |

**Die Lehre, die für jeden künftigen Plan gilt:** Jede Regel braucht einen Test, der ohne sie rot würde — und eine Testhilfe, die Eingaben von selbst gültig macht, verdeckt genau das. Eine Zusage wie „wirft nie“ gilt erst, wenn jede Eingabeform einmal durchgespielt ist.

**Erwartete Testzahlen, berichtigt:** nach Aufgabe 1: 282 · 2: 298 · 3: 316 · 4: 329. Die absoluten Zahlen in den Aufgaben 6, 11, 12, 14 und 15 liegen entsprechend höher; jeder Auftrag nennt dem Ausführenden den Stand vor seiner Aufgabe.
