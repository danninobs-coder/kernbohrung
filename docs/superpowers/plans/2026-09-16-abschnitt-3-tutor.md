# Kernbohrung — Abschnitt 3 „Der Tutor" — Implementierungsplan

> **Für agentische Ausführung:** ERFORDERLICHER SUB-SKILL: `superpowers:subagent-driven-development`. Schritte nutzen Checkbox-Syntax (`- [ ]`).

**Ziel:** Die App misst, wie du lernst, und richtet sich danach. Nicht nach einem „Lerntyp" — den gibt es nicht —, sondern nach drei Größen, die sich tatsächlich messen lassen: **wann du vergisst**, **wie gut du deine eigene Sicherheit einschätzt**, und **auf welche falschen Antworten du hereinfällst**.

Dazu Richtung B als echtes Design, mit hellem und dunklem Modus.

**Architektur:** Wie bisher zweigeteilt. Alles Berechenbare sind reine Funktionen unter `src/tutor/`, einzeln testbar, ohne Browserbezug. Die Speicherung ist eine dünne Schicht darüber (IndexedDB über `idb`). Die Oberfläche liest nur ab.

**Stack:** `ts-fsrs` 5.4.2 für die Terminplanung, `idb` 8.0.3 für den Speicher. Keine weiteren Laufzeitabhängigkeiten.

---

## Warum kein „Lerntyp"

Der Plan beginnt mit einem Widerspruch zur Auftragsformulierung, weil sonst mehrere Tage in die falsche Richtung liefen.

Die Vorstellung, Menschen seien visuelle, auditive oder kinästhetische Lerntypen und lernten besser, wenn der Stoff zu ihrem Typ passt, ist wiederholt geprüft und nicht bestätigt worden. Die entscheidenden Studien haben genau das getan, was die These verlangt: Lernende nach Typ eingeteilt, ihnen passenden und unpassenden Stoff gegeben, und den Lernerfolg verglichen. Der erwartete Wechselwirkungseffekt blieb aus. Was sich stattdessen zeigt: Was für einen Stoff die beste Darstellungsform ist, hängt am **Stoff**, nicht an der Person — eine Landkarte lernt man visuell, ein Gedicht sprachlich, und zwar alle.

Was es dagegen wirklich gibt, ist individuell, messbar und anpassbar:

| Größe | Was sie sagt | Woraus sie sich ergibt |
|---|---|---|
| **Vergessensrate** | Wie schnell dir *dieses* Prinzip entfällt | Abstand zwischen Wiederholungen und Trefferquote |
| **Kalibrierung** | Wie gut deine Sicherheit zur Richtigkeit passt | Zuversichtsangabe vor der Antwort |
| **Fehlermuster** | Welche Gegenposition dich zuverlässig fängt | Welche falsche Antwort du wählst, nicht nur dass du falsch lagst |
| **Vorwissen** | Was du schon kannst | Trefferquote beim ersten Kontakt |

Die zweite ist die interessanteste und die, die sonst niemand misst. **Sicher und falsch** ist der wertvollste Zustand im ganzen System: Wer weiß, dass er es nicht weiß, schlägt nach. Wer sicher ist und danebenliegt, tut es nicht — und genau dort sitzt eine Fehlvorstellung, die von selbst nicht verschwindet.

---

## Warum die Parameteranpassung noch nicht kommt

`ts-fsrs` plant Termine, optimiert aber keine Parameter. Dafür gibt es `fsrs-browser` — geprüft: 337 KB WebAssembly, ein echter Trainingslauf mit Epochen, Batch-Größe und Lernrate, und über `wasm-bindgen-rayon` an `SharedArrayBuffer` gebunden. Das verlangt Cross-Origin-Isolation, die eine statisch ausgelieferte Seite nicht mitbringt.

Der schwerere Einwand ist aber nicht technisch. **FSRS hat einundzwanzig Parameter.** Um sie sinnvoll zu schätzen, braucht es einige hundert bis tausend Bewertungen. Bei vier Lektionen mit je vier Fragen sind das nach Wochen vielleicht fünfzig. Einundzwanzig Parameter an fünfzig Beobachtungen zu fitten ist keine Anpassung, sondern Überanpassung.

Das ist exakt der Fehler aus der Lektion, die in diesem Repo bereits steht: **eine Schwelle ohne Daten ist geraten.** Der Plan baut deshalb die Anpassung, die bei dieser Datenmenge tatsächlich trägt, und sammelt sauber die Historie, aus der später eine echte Parameterschätzung werden kann. Die Schwelle dafür steht im Code, nicht in jemandes Kopf — siehe Aufgabe 7.

---

## Dateistruktur nach Abschnitt 3

```
src/tutor/
├─ typen.ts            Ereignis, Zuversicht, Bewertung — der gemeinsame Vertrag
├─ kalibrierung.ts     Reine Rechnung: Überzeugungslücke, Trefferquote je Zuversichtsstufe
├─ planung.ts          ts-fsrs gekapselt: Zuversicht + Richtigkeit → Rating → nächster Termin
├─ auswahl.ts          Welche Frage kommt als nächste, und warum
├─ reife.ts            frisch / sitzt / verblasst — der Zustand eines Prinzips
└─ speicher.ts         IndexedDB-Schicht über idb; die einzige unreine Datei

src/components/
├─ Frage.tsx           + Zuversichtsschritt vor der Antwort
└─ Zuversicht.tsx      Die drei Knöpfe, eigene Komponente

src/pages/
└─ fortschritt.astro   Die Landkarte

src/styles/
└─ global.css          Token-Schicht, hell und dunkel

tests/
├─ kalibrierung.test.ts
├─ planung.test.ts
├─ auswahl.test.ts
├─ reife.test.ts
└─ zuversicht.test.tsx
```

**Der Schnitt:** `speicher.ts` ist die einzige Datei, die IndexedDB kennt. Alles darüber rechnet auf gewöhnlichen Arrays und ist ohne Browser testbar. Das ist derselbe Schnitt wie bei `auswahl.mjs` im Compiler — und aus demselben Grund.

---

## Aufgabe 1: Der gemeinsame Vertrag

**Dateien:** Erstellen `src/tutor/typen.ts`

- [ ] **Schritt 1: Die Typen schreiben**

```typescript
/**
 * Der Vertrag zwischen Messung, Rechnung und Oberflaeche.
 *
 * Bewusst eine eigene Datei ohne Abhaengigkeiten: Sie wird von reinen
 * Rechenmodulen, von der Speicherschicht und von React-Inseln importiert.
 * Haengt hier etwas an ts-fsrs oder an idb, zieht das die ganze Kette mit.
 */

/**
 * Drei Stufen, nicht fuenf.
 *
 * Fuenf Stufen klingen praeziser und sind es bei kleinen Datenmengen nicht:
 * Die mittleren Stufen fuellen sich kaum, und die Trefferquote je Stufe wird
 * aus so wenigen Beobachtungen geschaetzt, dass sie springt. Drei Stufen mit
 * klar verschiedenen Erwartungswerten tragen ab der ersten Woche.
 */
export type Zuversicht = 'sicher' | 'eher' | 'geraten';

/** Was die Stufe als Wahrscheinlichkeit behauptet. Grundlage der Kalibrierung. */
export const ZUVERSICHT_WERT: Record<Zuversicht, number> = {
  sicher: 0.9,
  eher: 0.65,
  geraten: 0.3,
};

export const ZUVERSICHT_TEXT: Record<Zuversicht, string> = {
  sicher: 'Sicher',
  eher: 'Eher schon',
  geraten: 'Geraten',
};

/**
 * Ein Ereignis je beantworteter Frage. Unveraenderlich, nur angehaengt.
 *
 * `gewaehlt` haelt den Text der gewaehlten Antwort fest, nicht nur richtig oder
 * falsch. Ohne ihn laesst sich nicht sagen, WELCHE Gegenposition jemanden
 * faengt — und genau das ist das Fehlermuster, auf das der Tutor reagiert.
 */
export type Ereignis = {
  readonly lektion: string;
  readonly frage: string;
  readonly zuversicht: Zuversicht;
  readonly richtig: boolean;
  readonly gewaehlt: string;
  readonly dauerMs: number;
  readonly zeitpunkt: string;
};

/** Der Reifegrad eines Prinzips, wie ihn die Landkarte zeigt. */
export type Reife = 'unberuehrt' | 'frisch' | 'sitzt' | 'verblasst' | 'wackelt';
```

- [ ] **Schritt 2: Typpruefung und Commit**

```bash
npm run check
git add src/tutor/typen.ts
git commit -m "feat: gemeinsamer Vertrag fuer die Tutor-Schicht"
```

---

## Aufgabe 2: Kalibrierung

Die Rechnung, die den Unterschied zwischen „hat gelernt" und „glaubt gelernt zu haben" sichtbar macht.

**Dateien:** Erstellen `src/tutor/kalibrierung.ts`, Test `tests/kalibrierung.test.ts`

- [ ] **Schritt 1: Den fehlschlagenden Test schreiben**

```typescript
import { describe, it, expect } from 'vitest';
import { kalibrierung, sicherUndFalsch } from '../src/tutor/kalibrierung';
import type { Ereignis } from '../src/tutor/typen';

function e(zuversicht: Ereignis['zuversicht'], richtig: boolean, frage = 'f1', gewaehlt = 'x'): Ereignis {
  return { lektion: 'l', frage, zuversicht, richtig, gewaehlt, dauerMs: 1000, zeitpunkt: '2026-09-16T10:00:00Z' };
}

describe('kalibrierung', () => {
  it('meldet bei leerer Historie kein Urteil', () => {
    const k = kalibrierung([]);
    expect(k.belastbar).toBe(false);
    expect(k.luecke).toBeNull();
  });

  it('nennt eine Überzeugungslücke von null bei perfekter Passung', () => {
    // 10x sicher (0,9) mit 9 richtig -> 0,9 behauptet, 0,9 getroffen
    const ereignisse = [
      ...Array.from({ length: 9 }, () => e('sicher', true)),
      e('sicher', false),
    ];
    const k = kalibrierung(ereignisse, { mindestens: 10 });
    expect(k.belastbar).toBe(true);
    expect(k.luecke).toBeCloseTo(0, 2);
  });

  it('erkennt Selbstüberschätzung als positive Lücke', () => {
    const ereignisse = Array.from({ length: 10 }, (_, i) => e('sicher', i < 5));
    const k = kalibrierung(ereignisse, { mindestens: 10 });
    expect(k.luecke).toBeCloseTo(0.4, 2);
    expect(k.richtung).toBe('ueberschaetzt');
  });

  it('erkennt Unterschätzung als negative Lücke', () => {
    const ereignisse = Array.from({ length: 10 }, () => e('geraten', true));
    const k = kalibrierung(ereignisse, { mindestens: 10 });
    expect(k.luecke).toBeCloseTo(-0.7, 2);
    expect(k.richtung).toBe('unterschaetzt');
  });

  it('gibt je Stufe die beobachtete Trefferquote zurück', () => {
    const ereignisse = [
      e('sicher', true), e('sicher', true), e('sicher', false), e('sicher', true),
      e('geraten', false), e('geraten', true),
    ];
    const k = kalibrierung(ereignisse, { mindestens: 1 });
    expect(k.stufen.sicher).toEqual({ anzahl: 4, richtig: 3, quote: 0.75 });
    expect(k.stufen.geraten).toEqual({ anzahl: 2, richtig: 1, quote: 0.5 });
    expect(k.stufen.eher).toEqual({ anzahl: 0, richtig: 0, quote: null });
  });

  it('haelt sich an das Fenster und ignoriert Älteres', () => {
    const alt = Array.from({ length: 20 }, () => e('sicher', false));
    const neu = Array.from({ length: 10 }, () => e('sicher', true));
    const k = kalibrierung([...alt, ...neu], { mindestens: 5, fenster: 10 });
    expect(k.stufen.sicher.anzahl).toBe(10);
    expect(k.luecke).toBeCloseTo(-0.1, 2);
  });
});

describe('sicherUndFalsch', () => {
  it('findet die gefährlichen Fälle: sicher und trotzdem daneben', () => {
    const ereignisse = [
      e('sicher', false, 'f1', 'Reranker dahinter'),
      e('geraten', false, 'f2', 'irgendwas'),
      e('sicher', true, 'f3', 'richtig'),
      e('sicher', false, 'f1', 'Reranker dahinter'),
    ];
    const treffer = sicherUndFalsch(ereignisse);
    expect(treffer).toHaveLength(1);
    expect(treffer[0]).toMatchObject({ frage: 'f1', gewaehlt: 'Reranker dahinter', anzahl: 2 });
  });

  it('gibt nichts zurück, wenn niemand sicher danebenlag', () => {
    expect(sicherUndFalsch([e('geraten', false), e('sicher', true)])).toEqual([]);
  });

  it('sortiert nach Häufigkeit, die hartnäckigste zuerst', () => {
    const ereignisse = [
      e('sicher', false, 'f1', 'a'),
      e('sicher', false, 'f2', 'b'), e('sicher', false, 'f2', 'b'), e('sicher', false, 'f2', 'b'),
    ];
    expect(sicherUndFalsch(ereignisse).map((t) => t.frage)).toEqual(['f2', 'f1']);
  });
});
```

- [ ] **Schritt 2: Test laufen lassen, Fehlschlag belegen**

```bash
npx vitest run tests/kalibrierung.test.ts
```

Erwartet: FAIL, Modul nicht auflösbar.

- [ ] **Schritt 3: Implementierung schreiben**

```typescript
import { ZUVERSICHT_WERT, type Ereignis, type Zuversicht } from './typen';

/**
 * Wie gut passt die eigene Sicherheit zur eigenen Trefferquote?
 *
 * Die Ueberzeugungsluecke ist der Mittelwert der behaupteten
 * Wahrscheinlichkeiten minus die tatsaechliche Trefferquote. Positiv heisst
 * Selbstueberschaetzung, negativ Unterschaetzung, null heisst kalibriert.
 *
 * Das ist die eine Groesse, die kein anderes Lernwerkzeug misst — und die
 * einzige, die den Unterschied zwischen „hat gelernt" und „glaubt gelernt zu
 * haben" sichtbar macht.
 */

export type StufenBefund = {
  readonly anzahl: number;
  readonly richtig: number;
  /** null, solange die Stufe leer ist — nicht 0, das waere eine Aussage. */
  readonly quote: number | null;
};

export type Kalibrierung = {
  /** false, solange zu wenige Beobachtungen vorliegen. Dann sagt die App nichts. */
  readonly belastbar: boolean;
  readonly luecke: number | null;
  readonly richtung: 'ueberschaetzt' | 'kalibriert' | 'unterschaetzt' | null;
  readonly stufen: Record<Zuversicht, StufenBefund>;
  readonly anzahl: number;
};

/** Darunter gilt eine Luecke als Rauschen, nicht als Befund. */
const NEUTRAL = 0.08;

export function kalibrierung(
  ereignisse: readonly Ereignis[],
  optionen: { mindestens?: number; fenster?: number } = {},
): Kalibrierung {
  const mindestens = optionen.mindestens ?? 12;
  const fenster = optionen.fenster ?? 60;

  // Nur die juengsten Ereignisse: Kalibrierung aendert sich mit Uebung, und
  // ein halbes Jahr alte Selbstueberschaetzung sagt nichts ueber heute.
  const genommen = ereignisse.slice(-fenster);

  const stufen = leereStufen();
  for (const ev of genommen) {
    const s = stufen[ev.zuversicht];
    stufen[ev.zuversicht] = {
      anzahl: s.anzahl + 1,
      richtig: s.richtig + (ev.richtig ? 1 : 0),
      quote: null,
    };
  }
  for (const stufe of Object.keys(stufen) as Zuversicht[]) {
    const s = stufen[stufe];
    stufen[stufe] = { ...s, quote: s.anzahl === 0 ? null : s.richtig / s.anzahl };
  }

  if (genommen.length < mindestens) {
    return { belastbar: false, luecke: null, richtung: null, stufen, anzahl: genommen.length };
  }

  const behauptet = genommen.reduce((n, ev) => n + ZUVERSICHT_WERT[ev.zuversicht], 0) / genommen.length;
  const getroffen = genommen.filter((ev) => ev.richtig).length / genommen.length;
  const luecke = behauptet - getroffen;

  return {
    belastbar: true,
    luecke,
    richtung: luecke > NEUTRAL ? 'ueberschaetzt' : luecke < -NEUTRAL ? 'unterschaetzt' : 'kalibriert',
    stufen,
    anzahl: genommen.length,
  };
}

function leereStufen(): Record<Zuversicht, StufenBefund> {
  const leer: StufenBefund = { anzahl: 0, richtig: 0, quote: null };
  return { sicher: { ...leer }, eher: { ...leer }, geraten: { ...leer } };
}

export type Fehlvorstellung = {
  readonly lektion: string;
  readonly frage: string;
  readonly gewaehlt: string;
  readonly anzahl: number;
};

/**
 * Die gefaehrlichen Faelle: sicher geantwortet und trotzdem daneben.
 *
 * Wer weiss, dass er es nicht weiss, schlaegt nach. Wer sicher ist und
 * danebenliegt, tut es nicht — dort sitzt eine Fehlvorstellung, die von selbst
 * nicht verschwindet. Gruppiert wird nach der GEWAEHLTEN Antwort, nicht nur
 * nach der Frage: Welche Gegenposition jemanden faengt, ist die eigentliche
 * Auskunft.
 */
export function sicherUndFalsch(ereignisse: readonly Ereignis[]): Fehlvorstellung[] {
  const zaehler = new Map<string, Fehlvorstellung>();
  for (const ev of ereignisse) {
    if (ev.zuversicht !== 'sicher' || ev.richtig) continue;
    const schluessel = `${ev.lektion} ${ev.frage} ${ev.gewaehlt}`;
    const bisher = zaehler.get(schluessel);
    zaehler.set(schluessel, {
      lektion: ev.lektion,
      frage: ev.frage,
      gewaehlt: ev.gewaehlt,
      anzahl: (bisher?.anzahl ?? 0) + 1,
    });
  }
  return [...zaehler.values()].sort((a, b) => b.anzahl - a.anzahl || a.frage.localeCompare(b.frage));
}
```

- [ ] **Schritt 4: Erfolg belegen, committen**

```bash
npx vitest run tests/kalibrierung.test.ts
git add src/tutor/kalibrierung.ts tests/kalibrierung.test.ts
git commit -m "feat: Kalibrierung und Fehlvorstellungen aus der Ereignishistorie"
```

---

## Aufgabe 3: Planung

`ts-fsrs` gekapselt. Der interessante Teil ist die Abbildung von Zuversicht und Richtigkeit auf eine FSRS-Bewertung — dort verdient der Zuversichtsknopf sein Geld.

**Dateien:** Erstellen `src/tutor/planung.ts`, Test `tests/planung.test.ts`

- [ ] **Schritt 1: Die Abbildung festlegen und testen**

```typescript
import { describe, it, expect } from 'vitest';
import { alsBewertung, naechsterTermin, neueKarte } from '../src/tutor/planung';
import { Rating } from 'ts-fsrs';

describe('alsBewertung', () => {
  it('bildet sicher und richtig auf Easy ab', () => {
    expect(alsBewertung('sicher', true)).toBe(Rating.Easy);
  });

  it('bildet eher und richtig auf Good ab', () => {
    expect(alsBewertung('eher', true)).toBe(Rating.Good);
  });

  it('bildet geraten und richtig auf Hard ab — Glück ist kein Können', () => {
    // Der Kern der Sache: Ohne Zuversicht waere das ein Treffer wie jeder
    // andere und bekaeme ein langes Intervall. Mit Zuversicht weiss der
    // Planer, dass hier geraten wurde.
    expect(alsBewertung('geraten', true)).toBe(Rating.Hard);
  });

  it('bildet jede falsche Antwort auf Again ab, unabhängig von der Zuversicht', () => {
    expect(alsBewertung('sicher', false)).toBe(Rating.Again);
    expect(alsBewertung('eher', false)).toBe(Rating.Again);
    expect(alsBewertung('geraten', false)).toBe(Rating.Again);
  });
});

describe('naechsterTermin', () => {
  it('gibt einer neuen Karte bei Easy ein längeres Intervall als bei Hard', () => {
    const jetzt = new Date('2026-09-16T10:00:00Z');
    const leicht = naechsterTermin(neueKarte(jetzt), 'sicher', true, jetzt);
    const schwer = naechsterTermin(neueKarte(jetzt), 'geraten', true, jetzt);
    expect(leicht.faellig.getTime()).toBeGreaterThan(schwer.faellig.getTime());
  });

  it('holt eine falsch beantwortete Karte kurzfristig zurück', () => {
    const jetzt = new Date('2026-09-16T10:00:00Z');
    const gut = naechsterTermin(neueKarte(jetzt), 'eher', true, jetzt);
    const daneben = naechsterTermin(neueKarte(jetzt), 'sicher', false, jetzt);
    expect(daneben.faellig.getTime()).toBeLessThan(gut.faellig.getTime());
  });

  it('liefert eine Karte zurück, die sich erneut planen lässt', () => {
    const jetzt = new Date('2026-09-16T10:00:00Z');
    const erste = naechsterTermin(neueKarte(jetzt), 'eher', true, jetzt);
    const zweite = naechsterTermin(erste.karte, 'eher', true, erste.faellig);
    expect(zweite.faellig.getTime()).toBeGreaterThan(erste.faellig.getTime());
  });

  it('erfindet keinen Zeitpunkt, sondern nimmt den übergebenen', () => {
    const jetzt = new Date('2026-09-16T10:00:00Z');
    const a = naechsterTermin(neueKarte(jetzt), 'eher', true, jetzt);
    const b = naechsterTermin(neueKarte(jetzt), 'eher', true, jetzt);
    expect(a.faellig.toISOString()).toBe(b.faellig.toISOString());
  });
});
```

- [ ] **Schritt 2: Implementierung schreiben**

```typescript
import { createEmptyCard, fsrs, Rating, type Card } from 'ts-fsrs';
import type { Zuversicht } from './typen';

/**
 * Die Terminplanung, gekapselt.
 *
 * ts-fsrs plant mit Standardparametern. Das ist Absicht und keine Luecke:
 * Eine Anpassung der einundzwanzig FSRS-Parameter braucht einige hundert
 * Bewertungen; sie an fuenfzig zu schaetzen waere Ueberanpassung. Die Historie
 * dafuer wird gesammelt (siehe speicher.ts), die Schaetzung kommt, wenn die
 * Datenmenge sie traegt.
 */

const planer = fsrs();

export function neueKarte(jetzt: Date): Card {
  return createEmptyCard(jetzt);
}

/**
 * Zuversicht und Richtigkeit werden zu einer FSRS-Bewertung.
 *
 * Hier verdient der Zuversichtsknopf sein Geld. Ohne ihn kennt der Planer nur
 * richtig und falsch und muesste jeden Treffer gleich behandeln. Mit ihm
 * unterscheidet er den sicheren Treffer vom geratenen — und der geratene
 * bekommt ein kurzes Intervall, weil Glueck kein Koennen ist.
 *
 * Falsch ist immer Again, unabhaengig von der Zuversicht. Die Zuversicht
 * aendert nichts daran, DASS die Karte zurueckkommt; sie aendert, wie
 * dringend sie im Fehlermuster auftaucht (siehe kalibrierung.ts).
 */
export function alsBewertung(zuversicht: Zuversicht, richtig: boolean): Rating {
  if (!richtig) return Rating.Again;
  if (zuversicht === 'sicher') return Rating.Easy;
  if (zuversicht === 'eher') return Rating.Good;
  return Rating.Hard;
}

export type Termin = {
  readonly karte: Card;
  readonly faellig: Date;
};

export function naechsterTermin(
  karte: Card,
  zuversicht: Zuversicht,
  richtig: boolean,
  jetzt: Date,
): Termin {
  const ergebnis = planer.next(karte, jetzt, alsBewertung(zuversicht, richtig));
  return { karte: ergebnis.card, faellig: new Date(ergebnis.card.due) };
}
```

- [ ] **Schritt 3: Erfolg belegen, committen**

```bash
npx vitest run tests/planung.test.ts
git add src/tutor/planung.ts tests/planung.test.ts
git commit -m "feat: Terminplanung, Zuversicht als Bewertungssignal"
```

**Achtung bei der Umsetzung:** Die genaue Form von `planer.next()` in ts-fsrs 5.4.2 ist zu prüfen — ob es `{card, log}` oder ein `RecordLogItem` liefert, und ob `card.due` ein `Date` oder eine Zeichenkette ist. Der Plan wurde gegen die Paketbeschreibung geschrieben, nicht gegen einen Lauf. **Passe die Umsetzung an, nicht den Test**, und melde die Abweichung.

---

## Aufgabe 4: Reife und Auswahl

**Dateien:** Erstellen `src/tutor/reife.ts` und `src/tutor/auswahl.ts` samt Tests

- [ ] **Schritt 1: Reife**

`reife.ts` bildet den Zustand eines Prinzips auf die fünf Stufen aus `typen.ts` ab:

- `unberuehrt` — nie beantwortet
- `frisch` — beantwortet, aber noch keine Wiederholung überstanden
- `sitzt` — mindestens zweimal richtig, letzte Antwort richtig, Termin in der Zukunft
- `verblasst` — Termin überfällig
- `wackelt` — letzte Antwort falsch, oder mindestens einmal *sicher und falsch*

Die Stufe `wackelt` ist die, die es anderswo nicht gibt: Sie trennt „muss wiederholt werden, weil Zeit vergangen ist" von „muss wiederholt werden, weil da eine Fehlvorstellung sitzt". Die zweite ist dringender.

- [ ] **Schritt 2: Auswahl**

`auswahl.ts` entscheidet, welche Frage als nächste kommt. Die Reihenfolge ist:

1. **Fehlvorstellungen zuerst** — Fragen, bei denen zweimal sicher dieselbe falsche Antwort gewählt wurde
2. **Überfälliges** — nach Überfälligkeit absteigend
3. **Wackelndes** — letzte Antwort falsch
4. **Neues** — höchstens zwei unberührte Prinzipien je Sitzung, sonst überfordert die Sitzung

Der vierte Punkt ist eine Begrenzung, keine Auswahl: Neues Material kostet mehr als Wiederholung, und eine Sitzung, die nur aus Neuem besteht, hinterlässt nichts.

Beide Module sind reine Funktionen über Arrays und werden ohne Browser getestet.

- [ ] **Schritt 3: Committen**

```bash
git add src/tutor/reife.ts src/tutor/auswahl.ts tests/reife.test.ts tests/auswahl.test.ts
git commit -m "feat: Reifegrade und Auswahl nach Schwaeche"
```

---

## Aufgabe 5: Der Speicher

**Dateien:** Erstellen `src/tutor/speicher.ts`

Die einzige unreine Datei. Über `idb`, drei Speicher:

- `ereignisse` — angehängt, nie geändert. Der Rohstoff für alles andere.
- `karten` — je Frage der FSRS-Zustand
- `einstellungen` — Modus hell/dunkel, und später die Parameter

**Zwei Regeln, die im Code stehen müssen:**

Jeder Lesezugriff ist in `try/catch`. Ein privates Fenster, gelöschte Websitedaten oder eine Browsereinstellung, die Speicher verbietet — in allen drei Fällen muss die Seite ohne gespeicherten Zustand richtig rendern, nicht abstürzen.

Der Export ist von Anfang an dabei: `alsJson()` gibt die gesamte Historie heraus. Ohne ihn ist die spätere Parameterschätzung unmöglich, und die Daten gehören dem Lernenden.

- [ ] **Committen**

```bash
git add src/tutor/speicher.ts
git commit -m "feat: Speicherschicht ueber IndexedDB, mit Export"
```

---

## Aufgabe 6: Richtung B als echtes Design, hell und dunkel

**Dateien:** Ändern `src/styles/global.css`, `src/layouts/Seite.astro`, `src/widgets/Pipeline.tsx`, `src/components/Frage.tsx`; erstellen `src/components/Zuversicht.tsx`

- [ ] **Schritt 1: Die Token-Schicht**

Vollständige **helle** Palette auf blankem `:root`. Dunkel nur als Neudefinition derselben Namen, doppelt abgesichert:

```css
:root {
  --grund: #FAF7F2;
  --flaeche: #FFFFFF;
  --rand: #E6DFD4;
  --ink: #16191B;
  --ink-2: #6B736F;
  --akzent: #9A5F0C;        /* Amber, auf hell abgedunkelt bis Text-Kontrast */
  --akzent-fill: #E8A33C;   /* Amber als Flaeche, mit dunkler Schrift darauf */
  --akzent-auf-fill: #14181A;
  --richtig: #17796C;
  --falsch: #9A4A16;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) { /* … dieselben Namen, dunkle Werte … */ }
}

:root[data-theme='dark'] { /* … identisch … */ }
```

**Der Grund für die doppelte Absicherung:** Die Systemeinstellung deckt den Standardfall, das Attribut den ausdrücklichen Wunsch. Ohne den `:not([data-theme='light'])`-Schutz überstimmt die Systemeinstellung den Umschalter in einer Richtung.

**Amber ist auf hell nicht dasselbe wie auf dunkel.** `#E8A33C` auf Weiß erreicht kein lesbares Kontrastverhältnis für Text. Deshalb zwei Token: `--akzent` als abgedunkelte Textfarbe, `--akzent-fill` als Fläche mit dunkler Schrift darauf. Wer das zusammenlegt, bekommt eine helle Fassung, die aussieht wie die dunkle und sich nicht lesen lässt.

- [ ] **Schritt 2: Der Umschalter**

In `Seite.astro`, drei Zustände: System, hell, dunkel. Die Wahl liegt in `localStorage` und wird in einem Inline-Skript im `<head>` gesetzt, **bevor** die Seite malt — sonst blitzt beim Laden die falsche Fassung auf.

- [ ] **Schritt 3: Schriften und Formen**

Syne für Überschriften, Atkinson Hyperlegible für Fließtext, JetBrains Mono für Code und Zahlen. Pillen-Knoten im Widget, weiche Radien, ein einzelner warmer Lichtfleck als Atmosphäre — nicht als Verlaufsteppich über die ganze Seite.

- [ ] **Schritt 4: Prüfen**

Kontrastverhältnisse für Text gegen Grund messen, in **beiden** Modi. Unter 4,5:1 für Fließtext ist ein Befund, kein Geschmack.

---

## Aufgabe 7: Die Landkarte und die Schwelle

**Dateien:** Erstellen `src/pages/fortschritt.astro`

Was sie zeigt:

- **Die Prinzipien mit Reifegrad** — unberührt, frisch, sitzt, verblasst, wackelt
- **Die Überzeugungslücke**, sobald sie belastbar ist, mit dem Satz dazu: über null heißt selbstüberschätzt
- **Die Trefferquote je Zuversichtsstufe** — drei Balken. Hier sieht man auf einen Blick, ob „sicher" etwas bedeutet
- **Die Fehlvorstellungen** — welche falsche Antwort dich zweimal sicher gefangen hat
- **Ein Ausfuhrknopf** für die gesamte Historie

Und, ausdrücklich:

- [ ] **Die Schwelle für echte Parameteranpassung steht im Code.**

```typescript
/**
 * Ab hier traegt eine eigene Parameterschaetzung.
 *
 * FSRS hat 21 Parameter. Die Literatur nennt einige hundert bis tausend
 * Bewertungen, bevor eine Schaetzung die Standardwerte schlaegt. 400 ist
 * bewusst konservativ gewaehlt: lieber laenger mit guten Standardwerten als
 * frueh mit ueberangepassten eigenen.
 *
 * Solange die Zahl nicht erreicht ist, zeigt die Landkarte, wie viele
 * Bewertungen noch fehlen — statt so zu tun, als sei bereits angepasst.
 */
export const BEWERTUNGEN_FUER_EIGENE_PARAMETER = 400;
```

Die Landkarte zeigt den Fortschritt dorthin als Zeile: „Eigene Parameter ab 400 Bewertungen — bisher 63."

**Das ist der ehrliche Teil des selbstanpassenden Tutors:** Er sagt, woran er sich gerade anpasst und woran noch nicht.

---

## Aufgabe 8: Abnahme

- [ ] `npm test`, `npm run check`, `npm run build`
- [ ] **Im Browser, sichtbares Fenster:** heller und dunkler Modus, Umschalter, kein Aufblitzen beim Laden
- [ ] Eine Frage in jeder Zuversichtsstufe beantworten, prüfen dass das Ereignis im Speicher landet
- [ ] Neu laden, prüfen dass der Zustand überlebt
- [ ] Die Landkarte gegen die eben erzeugten Ereignisse gegenlesen
- [ ] Privates Fenster: Seite muss ohne Speicher funktionieren

**Die Frage, die zählt:** Sag die Landkarte etwas, das du nicht schon wusstest? Wenn sie nur bestätigt, was ohnehin klar war, ist die Messung Zierde.

## Abnahmekriterium

Vier Lektionen sind mit Zuversichtsangabe beantwortbar, die Ereignisse überleben einen Neustart, die Landkarte zeigt Reifegrade und — sobald genug Beobachtungen vorliegen — die Überzeugungslücke. Heller und dunkler Modus sind beide vollständig, mit gemessenem Textkontrast über 4,5:1. Die Schwelle für eigene Parameter steht im Code und wird auf der Landkarte als Fortschritt gezeigt.

**Ausdrücklich nicht Teil:** eigene FSRS-Parameter. Die kommen, wenn die Historie sie trägt.
