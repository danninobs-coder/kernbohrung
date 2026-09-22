import { describe, it, expect } from 'vitest';
import { ReihenfolgeSchema } from '../src/aufgaben/reihenfolge/schema';
import { startfolge } from '../src/aufgaben/reihenfolge/startfolge';
import { bewerteReihenfolge } from '../src/aufgaben/reihenfolge/bewerten';
import { mischen } from '../src/lib/mischen';

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

  it('verlangt das Feld typ', () => {
    // `typ` ist der Diskriminant der Union. Wird das Literal versehentlich
    // wahlfrei, faellt das sonst nirgends auf.
    const { typ: _typ, ...ohne } = reihenfolge();
    expect(ReihenfolgeSchema.safeParse(ohne).success).toBe(false);
  });

  it('weist einen falschen typ zurueck', () => {
    expect(ReihenfolgeSchema.safeParse(reihenfolge({ typ: 'wahl' })).success).toBe(false);
  });
});

describe('startfolge', () => {
  it('ist eine Permutation und gleicht nie der richtigen Folge noch ihrer Umkehrung', () => {
    // Wer nur eine einzige Stufe des Ablaufs kennt - den Anfang oder das Ende -,
    // dreht sonst die ganze Liste um und hat sortiert, ohne etwas dazwischen zu
    // wissen. Die Umkehrung ist deshalb genauso ausgeschlossen wie die richtige
    // Folge selbst (siehe startfolge.ts). 500 Ids je Laenge, ueber jede vom
    // Schema erlaubte Laenge (schema.ts: `.min(3).max(7)`). Mehr kostet im
    // vollen Lauf unter Last Sekunden, ohne mehr zu zeigen: Das rohe Mischen
    // trifft die Umkehrung bei drei Schritten in rund jedem sechsten Fall, ein
    // Rueckfall faellt also schon nach wenigen Ids auf.
    for (let anzahl = 3; anzahl <= 7; anzahl++) {
      const identitaet = Array.from({ length: anzahl }, (_, i) => i);
      const umkehrung = [...identitaet].reverse();
      for (let s = 0; s < 500; s++) {
        const folge = startfolge(anzahl, `saat-${s}`);
        expect([...folge].sort((a, b) => a - b)).toEqual(identitaet);
        expect(folge).not.toEqual(identitaet);
        expect(folge).not.toEqual(umkehrung);
      }
    }
  });

  it('durchlaeuft den Neumisch-Zweig bei jeder Laenge nachweislich', () => {
    // Ersetzt den frueheren Rotationszweig-Test: Statt bei einem Treffer auf
    // die richtige Folge um eine Stelle zu rotieren, mischt startfolge() jetzt
    // mit einer abgeleiteten Folgesaat neu - bei einem Treffer auf die richtige
    // Folge GENAUSO wie bei einem Treffer auf ihre Umkehrung. Gesucht wird je
    // Laenge eine Saat, deren erste, unkorrigierte Mischung eine der beiden
    // trifft; startfolge() darauf angewandt darf keine von beiden mehr sein.
    for (let anzahl = 3; anzahl <= 7; anzahl++) {
      const identitaet = Array.from({ length: anzahl }, (_, i) => i);
      const umkehrung = [...identitaet].reverse();
      let geprueft = false;
      for (let s = 0; s < 20000 && !geprueft; s++) {
        const saat = `saat-${s}`;
        const roh = mischen(identitaet, saat);
        const trifftRichtige = roh.every((wert, i) => wert === identitaet[i]);
        const trifftUmkehrung = roh.every((wert, i) => wert === umkehrung[i]);
        if (trifftRichtige || trifftUmkehrung) {
          const folge = startfolge(anzahl, saat);
          expect(folge).not.toEqual(identitaet);
          expect(folge).not.toEqual(umkehrung);
          geprueft = true;
        }
      }
      expect(geprueft, `keine Saat traf bei Laenge ${anzahl} die richtige Folge oder ihre Umkehrung`).toBe(true);
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

  it('wertet eine zu lange Folge als falsch, statt zu werfen', () => {
    // Ein richtiger Anfang mit angehaengtem Muell darf den Anteil nicht auf 1
    // retten: Der Nenner ist die groessere der beiden Laengen.
    expect(bewerteReihenfolge(aufgabe, [0, 1, 2, 3, 4, 5])).toMatchObject({ richtig: false, anteil: 5 / 6 });
  });

  it('wertet unsinnige Indizes als falsch, statt zu werfen', () => {
    expect(bewerteReihenfolge(aufgabe, [0, 0, 0, 0, 0])).toMatchObject({ richtig: false, anteil: 1 / 5 });
  });
});
