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
    typ: 'wahl',
    id,
    frage: 'Was sortiert ein Reranker?',
    antworten: [antwort('Die Kandidaten', true), antwort('Den Index'), antwort('Die Anfrage')],
  };
}

// Fixtures fuer die uebrigen drei Typen — nur fuer die Tests zur
// Aufgabenfamilie unten gebraucht, deshalb ohne eigene Variationsbreite.
function fall(id: string) {
  return {
    typ: 'fall',
    id,
    sachverhalt: 'Ein Sachverhalt mit ausreichend vielen Zeichen fuer die Mindestlaenge von vierzig.',
    aufgabe: 'Beurteile den Fall.',
    pruefpunkte: [
      { text: 'Nennt die Frist', pflicht: true },
      { text: 'Nennt den Kostentraeger', pflicht: false },
    ],
  };
}

function zuordnen(id: string) {
  return {
    typ: 'zuordnen',
    id,
    aufgabe: 'Ordne zu.',
    paare: [
      { links: 'A', rechts: '1' },
      { links: 'B', rechts: '2' },
      { links: 'C', rechts: '3' },
    ],
  };
}

function reihenfolge(id: string) {
  return {
    typ: 'reihenfolge',
    id,
    aufgabe: 'Ordne.',
    schritte: ['erst', 'dann', 'zuletzt'],
  };
}

function lektion(aenderung: Record<string, unknown> = {}) {
  return {
    titel: 'Eine Lektion',
    prinzip: 'Recall entsteht beim Holen, Precision beim Sortieren.',
    reihenfolge: 1,
    aufgaben: [frage('f-1'), frage('f-2')],
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
        aufgaben: [
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
      aufgaben: [
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
      aufgaben: [
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
      aufgaben: [
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

  it('5. lehnt eine Kollision zwischen aufgaben[].id und transfer.id ab', () => {
    const kaputt = lektion({ transfer: frage('f-1') });
    const ergebnis = LektionSchema.safeParse(kaputt);
    expect(ergebnis.success).toBe(false);
    expect(JSON.stringify(ergebnis.error?.issues)).toContain('eindeutig');

    // und ebenso zwei gleiche Ids unter den Aufgaben selbst
    expect(LektionSchema.safeParse(lektion({ aufgaben: [frage('f-1'), frage('f-1')] })).success).toBe(
      false,
    );
  });

  it('6. lehnt ein prinzip ab, das ein Absatz statt eines Satzes ist', () => {
    const absatz = 'Wort '.repeat(60).trim();
    expect(absatz.length).toBeGreaterThan(200);
    expect(LektionSchema.safeParse(lektion({ prinzip: absatz })).success).toBe(false);
  });
});

describe('LektionSchema - die Aufgabenfamilie', () => {
  it('weist das alte Feld fragen zurueck und sagt, wie es jetzt heisst', () => {
    const { aufgaben: _aufgaben, ...ohne } = lektion();
    const befund = LektionSchema.safeParse({ ...ohne, fragen: [frage('f-1'), frage('f-2')] });
    expect(befund.success).toBe(false);
    if (befund.success) return;
    expect(befund.error.issues.map((i) => i.message).join(' | ')).toMatch(/fragen heißt jetzt aufgaben/);
  });

  it('nimmt zwei bis sechs Aufgaben an und weist eine sowie sieben zurueck', () => {
    const viele = (n: number) => Array.from({ length: n }, (_, i) => frage(`f-${i}`));
    expect(LektionSchema.safeParse(lektion({ aufgaben: viele(1) })).success).toBe(false);
    expect(LektionSchema.safeParse(lektion({ aufgaben: viele(2) })).success).toBe(true);
    expect(LektionSchema.safeParse(lektion({ aufgaben: viele(6) })).success).toBe(true);
    expect(LektionSchema.safeParse(lektion({ aufgaben: viele(7) })).success).toBe(false);
  });

  it('nimmt eine Lektion mit allen vier Aufgabentypen an, Transfer ein fall', () => {
    const gemischt = lektion({
      aufgaben: [frage('f-1'), fall('c-1'), zuordnen('z-1'), reihenfolge('r-1')],
      transfer: fall('c-transfer'),
    });
    const befund = LektionSchema.safeParse(gemischt);
    if (!befund.success) throw new Error(JSON.stringify(befund.error.issues, null, 2));
    expect(befund.success).toBe(true);
  });

  it('weist eine Aufgabe ohne typ zurueck', () => {
    const { typ: _typ, ...ohneTyp } = frage('f-1');
    const kaputt = lektion({ aufgaben: [ohneTyp, frage('f-2')] });
    expect(LektionSchema.safeParse(kaputt).success).toBe(false);
  });
});
