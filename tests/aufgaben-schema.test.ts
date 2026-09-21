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
