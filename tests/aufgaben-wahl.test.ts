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
