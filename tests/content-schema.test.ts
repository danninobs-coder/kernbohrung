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
