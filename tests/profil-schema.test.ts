import { describe, it, expect } from 'vitest';
import { VORLIEBEN } from '../src/profil/items';
import {
  EntwurfSchema,
  ProfilstandSchema,
  VorliebenSchema,
  liesEntwurf,
  liesProfil,
} from '../src/profil/schema';

/**
 * Die Hilfen hier machen NICHTS von selbst gueltig: Sie legen die Aenderung
 * stumpf ueber einen gueltigen Stand. Wer ein verschachteltes Feld kaputt
 * machen will, reicht das ganze verschachtelte Objekt herein. Eine Hilfe, die
 * fehlende Felder ergaenzt, haette genau die Tests entwertet, die pruefen, ob
 * ein Feld fehlen darf.
 */
const vorlieben = { einstieg: 'beispiel', minuten: 10, text: 'egal' };

const basis = {
  itemsatz: 1,
  erhoben: '2026-09-19T10:00:00.000Z',
  antworten: { 'ord-1': 4, 'ord-2': 2, 'ung-1': 5 },
  vorlieben,
};

function stand(aenderung: Record<string, unknown> = {}): Record<string, unknown> {
  return { ...basis, ...aenderung };
}

const entwurfBasis = {
  itemsatz: 1,
  antworten: { 'ord-1': 4 },
  vorlieben: {},
  schritt: 2,
};

function entwurf(aenderung: Record<string, unknown> = {}): Record<string, unknown> {
  return { ...entwurfBasis, ...aenderung };
}

function gilt(wert: unknown): boolean {
  return ProfilstandSchema.safeParse(wert).success;
}

describe('ProfilstandSchema', () => {
  it('nimmt einen gueltigen Stand an', () => {
    expect(gilt(stand())).toBe(true);
  });

  it('nimmt einen Stand ganz ohne Antworten an', () => {
    // Wer jede Aussage ueberspringt, hat trotzdem drei Vorlieben angegeben. Das
    // ist ein duennes Profil, aber kein kaputtes.
    expect(gilt(stand({ antworten: {} }))).toBe(true);
  });

  it.each([0, 6, 3.5, '3', null])('weist den Wert %s in den Antworten zurueck', (wert) => {
    expect(gilt(stand({ antworten: { 'ord-1': wert } }))).toBe(false);
  });

  it.each([
    ['einstieg', 'video'],
    ['minuten', 15],
    ['text', 'bilder'],
  ])('weist bei der Vorliebe %s den unbekannten Wert %s zurueck', (feld, wert) => {
    expect(gilt(stand({ vorlieben: { ...vorlieben, [feld]: wert } }))).toBe(false);
  });

  it('verlangt alle drei Vorlieben', () => {
    const { minuten: _minuten, ...ohne } = vorlieben;
    expect(gilt(stand({ vorlieben: ohne }))).toBe(false);
  });

  it('weist ein fremdes Feld zurueck — auch und gerade das Ergebnis', () => {
    // Gespeichert werden die Antworten, nie das Ergebnis. Ein Stand, der sein
    // Lernmuster mitbringt, stammt nicht von dieser App — oder von einer
    // Fassung, die diese Regel gebrochen hat.
    expect(gilt(stand({ lernmuster: 'anwendungsorientiert' }))).toBe(false);
  });

  it('weist ein fremdes Feld in den Vorlieben zurueck', () => {
    expect(gilt(stand({ vorlieben: { ...vorlieben, lerntyp: 'visuell' } }))).toBe(false);
  });

  it('weist einen Zeitpunkt zurueck, der keiner ist', () => {
    // An `erhoben` haengt der Hinweis nach acht Wochen. Mit „gestern" laesst
    // sich nicht rechnen.
    expect(gilt(stand({ erhoben: 'gestern' }))).toBe(false);
    expect(gilt(stand({ erhoben: '2026-09-19' }))).toBe(false);
  });

  it('nimmt einen Zeitpunkt mit Zeitzone an, nicht nur einen mit Z', () => {
    // Die App schreibt `toISOString()`, also immer mit Z. Ein von Hand oder
    // von einer anderen Fassung geschriebener Stand mit +02:00 ist aber
    // derselbe Zeitpunkt. Ihn abzuweisen hiesse, wegen der Schreibweise eines
    // Datums alle Antworten zu verwerfen.
    expect(gilt(stand({ erhoben: '2026-09-19T12:00:00+02:00' }))).toBe(true);
    // Ohne jede Zeitzone bleibt er mehrdeutig und faellt durch.
    expect(gilt(stand({ erhoben: '2026-09-19T12:00:00' }))).toBe(false);
  });

  it('nimmt Antworten zu Ids an, die es heute nicht gibt', () => {
    // Praezisierung 2 des Plans: Das Schema prueft die Form, nicht die
    // heutige Liste der Aussagen. Die Auswertung liest nur, was sie kennt.
    expect(gilt(stand({ antworten: { 'ord-1': 4, 'gibt-es-nicht': 3 } }))).toBe(true);
  });

  it.each([0, -1, 1.5, '1'])('weist den itemsatz %s zurueck', (itemsatz) => {
    expect(gilt(stand({ itemsatz }))).toBe(false);
  });

  it('nimmt einen fremden itemsatz an — ob er zaehlt, entscheidet die Auswertung', () => {
    // Lesbar ist nicht auswertbar. Die Trennung ist Absicht: Das Schema sagt,
    // ob das ein Profilstand IST; `werteAus` sagt, ob er zu den heutigen
    // Aussagen gehoert.
    expect(gilt(stand({ itemsatz: 2 }))).toBe(true);
  });
});

describe('liesProfil', () => {
  it('gibt den Stand zurueck, wenn er lesbar ist', () => {
    expect(liesProfil(stand())).toEqual(basis);
  });

  // Als Paare aus Name und Wert: `it.each` breitet eine blanke Liste als
  // Argumente aus — eine leere Liste kaeme als „gar kein Argument" an.
  it.each([
    ['nichts', undefined],
    ['null', null],
    ['einem Text', 'text'],
    ['einer Zahl', 42],
    ['einer leeren Liste', []],
    ['einem leeren Objekt', {}],
  ])('macht aus %s „kein Profil", ohne zu werfen', (_name, roh) => {
    expect(liesProfil(roh)).toBeNull();
  });

  it('macht aus einem halb richtigen Stand „kein Profil", nicht ein halbes', () => {
    expect(liesProfil(stand({ antworten: { 'ord-1': 4, 'ord-2': 9 } }))).toBeNull();
  });

  // Ergaenzt fuer die "wirft nie"-Regel: Die zwei Faelle oben (leeres Objekt,
  // falscher Wert in einem Feld) decken noch nicht ab, dass auch ein fremdes
  // Feld und ein falscher TYP in einem Feld nie werfen, sondern null ergeben.
  it('macht aus einem Objekt mit fremdem Feld „kein Profil", ohne zu werfen', () => {
    expect(liesProfil(stand({ lernmuster: 'anwendungsorientiert' }))).toBeNull();
  });

  it('macht aus einem Objekt mit falschem Typ in einem Feld „kein Profil", ohne zu werfen', () => {
    expect(liesProfil(stand({ erhoben: 12345 }))).toBeNull();
  });
});

describe('EntwurfSchema', () => {
  it('nimmt einen Entwurf mit halben Vorlieben an', () => {
    expect(EntwurfSchema.safeParse(entwurf()).success).toBe(true);
    expect(EntwurfSchema.safeParse(entwurf({ vorlieben: { minuten: 5 } })).success).toBe(true);
  });

  it('weist einen Entwurf zu einem anderen Itemsatz zurueck', () => {
    // Anders als das Profil ist ein Entwurf Wegwerfware: Zu anderen Aussagen
    // gibt es nichts fortzusetzen.
    expect(EntwurfSchema.safeParse(entwurf({ itemsatz: 2 })).success).toBe(false);
  });

  it.each([-1, 6, 1.5])('weist den Schritt %s zurueck', (schritt) => {
    expect(EntwurfSchema.safeParse(entwurf({ schritt })).success).toBe(false);
  });

  it('nimmt den ersten Schritt und den Schritt mit den Vorlieben an', () => {
    expect(EntwurfSchema.safeParse(entwurf({ schritt: 0 })).success).toBe(true);
    expect(EntwurfSchema.safeParse(entwurf({ schritt: 5 })).success).toBe(true);
  });

  it('ist bei Werten, Vorlieben und fremden Feldern so streng wie das Profil', () => {
    expect(EntwurfSchema.safeParse(entwurf({ antworten: { 'ord-1': 6 } })).success).toBe(false);
    expect(EntwurfSchema.safeParse(entwurf({ vorlieben: { einstieg: 'video' } })).success).toBe(false);
    expect(EntwurfSchema.safeParse(entwurf({ vorlieben: { lerntyp: 'visuell' } })).success).toBe(false);
    expect(EntwurfSchema.safeParse(entwurf({ erhoben: '2026-09-19T10:00:00.000Z' })).success).toBe(false);
  });
});

describe('liesEntwurf', () => {
  it('gibt den Entwurf zurueck, wenn er lesbar ist', () => {
    expect(liesEntwurf(entwurf())).toEqual(entwurfBasis);
  });

  it('macht aus einem geloeschten Entwurf keinen', () => {
    // Das Audit loescht seinen Entwurf, indem es `null` darueberschreibt — der
    // Speicher kennt kein Entfernen.
    expect(liesEntwurf(null)).toBeNull();
    expect(liesEntwurf(undefined)).toBeNull();
    expect(liesEntwurf('irgendwas')).toBeNull();
  });
});

describe('Schema und Audit sprechen dieselbe Sprache', () => {
  it('nimmt jede Vorliebe an, die das Audit anbietet', () => {
    // Die Optionen stehen in items.ts, die erlaubten Werte hier. Laufen beide
    // auseinander, bietet das Audit etwas an, das sich nicht speichern laesst.
    for (const vorliebe of VORLIEBEN) {
      for (const option of vorliebe.optionen) {
        const befund = VorliebenSchema.safeParse({ ...vorlieben, [vorliebe.id]: option.wert });
        expect(befund.success).toBe(true);
      }
    }
  });
});
