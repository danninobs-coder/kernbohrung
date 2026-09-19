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

  it('verlangt das Feld typ', () => {
    // `typ` ist der Diskriminant der Union. Wird das Literal versehentlich
    // wahlfrei, faellt das sonst nirgends auf.
    const { typ: _typ, ...ohne } = zuordnen();
    expect(ZuordnenSchema.safeParse(ohne).success).toBe(false);
  });

  it('nimmt hoechstens sechs Paare', () => {
    const paare = (n: number) =>
      Array.from({ length: n }, (_, i) => ({ links: `Links ${i + 1}`, rechts: `Rechts ${i + 1}` }));
    expect(ZuordnenSchema.safeParse(zuordnen({ paare: paare(6) })).success).toBe(true);
    expect(ZuordnenSchema.safeParse(zuordnen({ paare: paare(7) })).success).toBe(false);
  });

  it('weist doppelte Ablenker zurueck, auch nur durch Schreibung getrennt', () => {
    const befund = ZuordnenSchema.safeParse(zuordnen({ ablenker: ['Anteil am Gewinn', 'anteil am gewinn '] }));
    expect(meldungen(befund)).toMatch(/Ablenker/);
  });

  it('weist ein fremdes Feld auch innerhalb eines Paars zurueck', () => {
    const paare = [
      ...zuordnen().paare.slice(0, 2),
      { links: 'Stundenlohnvertrag', rechts: 'Preis je geleisteter Stunde', punkte: 1 },
    ];
    expect(ZuordnenSchema.safeParse(zuordnen({ paare })).success).toBe(false);
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
