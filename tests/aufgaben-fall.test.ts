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

  it('nimmt hoechstens acht Pruefpunkte', () => {
    const punkte = (n: number) =>
      Array.from({ length: n }, (_, i) => ({ text: `Punkt ${i + 1}`, pflicht: i === 0 }));
    expect(FallSchema.safeParse(fall({ pruefpunkte: punkte(8) })).success).toBe(true);
    expect(FallSchema.safeParse(fall({ pruefpunkte: punkte(9) })).success).toBe(false);
  });

  it('weist ein fremdes Feld auch innerhalb eines Pruefpunkts zurueck', () => {
    const mitFremdfeld = { text: 'Mit Gewicht', pflicht: true, gewicht: 2 };
    expect(
      FallSchema.safeParse(fall({ pruefpunkte: [mitFremdfeld, { text: 'Ohne Gewicht', pflicht: false }] })).success,
    ).toBe(false);
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
