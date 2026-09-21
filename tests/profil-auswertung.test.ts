import { describe, it, expect } from 'vitest';
import { ITEMS, type Dimension, type Muster, type Skala, type Wert } from '../src/profil/items';
import {
  lernmusterAus,
  mittelwert,
  schwachstellenAus,
  strukturhinweisAus,
  werteAus,
} from '../src/profil/auswertung';

/**
 * Antworten fuer eine Skala oder ein Muster, in der Reihenfolge ihrer Aussagen.
 * `null` heisst: diese Aussage bleibt unbeantwortet. Die Hilfe ergaenzt nichts —
 * was nicht dasteht, ist nicht beantwortet.
 */
function fuer(dimension: Dimension, ...werte: (Wert | null)[]): Record<string, Wert> {
  const aus: Record<string, Wert> = {};
  ITEMS.filter((item) => item.dimension === dimension).forEach((item, i) => {
    const wert = werte[i];
    if (wert !== undefined && wert !== null) aus[item.id] = wert;
  });
  return aus;
}

function muster(teil: Partial<Record<Muster, number | null>>): Record<Muster, number | null> {
  return {
    bedeutungsorientiert: null,
    reproduktionsorientiert: null,
    anwendungsorientiert: null,
    ungerichtet: null,
    ...teil,
  };
}

function skalen(teil: Partial<Record<Skala, number | null>>): Record<Skala, number | null> {
  return {
    ordnen: null,
    verknuepfen: null,
    abrufen: null,
    steuern: null,
    dranbleiben: null,
    zeiteinteilen: null,
    ...teil,
  };
}

describe('mittelwert', () => {
  it('mittelt die beantworteten Aussagen einer Skala', () => {
    expect(mittelwert(fuer('ordnen', 2, 3, 4), 'ordnen')).toBe(3);
    expect(mittelwert(fuer('ordnen', 1, 2, 2), 'ordnen')).toBeCloseTo(5 / 3, 10);
  });

  it('rechnet mit genau zwei Antworten — der Mindestzahl', () => {
    expect(mittelwert(fuer('ordnen', 2, null, 5), 'ordnen')).toBe(3.5);
  });

  it('gibt bei nur einer Antwort null — nicht 0 und nicht den Einzelwert', () => {
    // Eine 0 waere eine Aussage, und zwar die schlechteste. Eine 4 waere ein
    // Mittel aus einem Kreuz.
    expect(mittelwert(fuer('ordnen', 4), 'ordnen')).toBeNull();
  });

  it('gibt ganz ohne Antwort null', () => {
    expect(mittelwert({}, 'ordnen')).toBeNull();
  });

  it('verlangt bei einem Muster beide Aussagen', () => {
    expect(mittelwert(fuer('bedeutungsorientiert', 5), 'bedeutungsorientiert')).toBeNull();
    expect(mittelwert(fuer('bedeutungsorientiert', 5, 4), 'bedeutungsorientiert')).toBe(4.5);
  });

  it('zaehlt weder fremde Skalen noch unbekannte Aussagen mit', () => {
    const antworten = { ...fuer('verknuepfen', 5, 5, 5), 'gibt-es-nicht': 5 as const };
    expect(mittelwert(antworten, 'ordnen')).toBeNull();
    expect(mittelwert(antworten, 'verknuepfen')).toBe(5);
  });

  it('zaehlt nur echte Item-Ids — nicht jede Id mit passender Vorsilbe', () => {
    // Haelt fest, dass `mittelwert` ueber ITEMS geht statt Ids nur an ihrer
    // Vorsilbe zu erkennen: 'ord-9' saehe aus wie eine Ordnen-Aussage, steht
    // aber nicht in ITEMS und darf den Mittelwert nicht verschieben.
    const antworten = { ...fuer('ordnen', 2, 3, 4), 'ord-9': 5 as const };
    expect(mittelwert(antworten, 'ordnen')).toBe(3);
  });
});

describe('lernmusterAus', () => {
  it('nennt das Muster mit dem hoechsten Mittel', () => {
    expect(
      lernmusterAus(
        muster({ bedeutungsorientiert: 3.5, reproduktionsorientiert: 2, anwendungsorientiert: 4.5, ungerichtet: 2 }),
      ),
    ).toEqual({ art: 'eindeutig', muster: 'anwendungsorientiert' });
  });

  it('sagt „zwischen A und B" bei weniger als 0,5 Abstand, das hoehere zuerst', () => {
    expect(
      lernmusterAus(muster({ bedeutungsorientiert: 3.75, anwendungsorientiert: 4, ungerichtet: 1 })),
    ).toEqual({ art: 'zwischen', a: 'anwendungsorientiert', b: 'bedeutungsorientiert' });
  });

  it('bleibt bei GENAU 0,5 Abstand eindeutig', () => {
    // Die Grenze: „weniger als 0,5" heisst 0,5 selbst gehoert nicht dazu.
    expect(lernmusterAus(muster({ bedeutungsorientiert: 4, anwendungsorientiert: 3.5 }))).toEqual({
      art: 'eindeutig',
      muster: 'bedeutungsorientiert',
    });
  });

  it('sagt knapp unter 0,5 Abstand noch „zwischen"', () => {
    expect(lernmusterAus(muster({ bedeutungsorientiert: 4, anwendungsorientiert: 3.51 }))).toEqual({
      art: 'zwischen',
      a: 'bedeutungsorientiert',
      b: 'anwendungsorientiert',
    });
  });

  it('nennt bei gleichem Mittel die Muster in fester Reihenfolge', () => {
    // Dasselbe Profil darf nicht einmal so und einmal anders heissen.
    expect(
      lernmusterAus(
        muster({ bedeutungsorientiert: 3, reproduktionsorientiert: 3, anwendungsorientiert: 3, ungerichtet: 3 }),
      ),
    ).toEqual({ art: 'zwischen', a: 'bedeutungsorientiert', b: 'reproduktionsorientiert' });
    expect(
      lernmusterAus(
        muster({ bedeutungsorientiert: 2, reproduktionsorientiert: 2, anwendungsorientiert: 4, ungerichtet: 4 }),
      ),
    ).toEqual({ art: 'zwischen', a: 'anwendungsorientiert', b: 'ungerichtet' });
  });

  it('kommt mit einem einzigen erhobenen Muster aus', () => {
    expect(lernmusterAus(muster({ ungerichtet: 2 }))).toEqual({ art: 'eindeutig', muster: 'ungerichtet' });
  });

  it('gibt null, wenn kein Muster erhoben ist', () => {
    expect(lernmusterAus(muster({}))).toBeNull();
  });
});

describe('strukturhinweisAus', () => {
  it('meldet ab GENAU 3,5 bei „ungerichtet"', () => {
    expect(strukturhinweisAus(muster({ ungerichtet: 3.5 }))).toBe(true);
  });

  it('meldet knapp darunter nicht', () => {
    expect(strukturhinweisAus(muster({ ungerichtet: 3.49 }))).toBe(false);
    expect(strukturhinweisAus(muster({ ungerichtet: 3 }))).toBe(false);
  });

  it('meldet unabhaengig vom fuehrenden Muster', () => {
    const mittel = muster({ anwendungsorientiert: 5, ungerichtet: 4 });
    expect(lernmusterAus(mittel)).toEqual({ art: 'eindeutig', muster: 'anwendungsorientiert' });
    expect(strukturhinweisAus(mittel)).toBe(true);
  });

  it('meldet nichts, wenn „ungerichtet" nicht erhoben ist', () => {
    expect(strukturhinweisAus(muster({ anwendungsorientiert: 5 }))).toBe(false);
  });
});

describe('schwachstellenAus', () => {
  it('nennt die zwei niedrigsten Skalen unter 3,0, die niedrigste zuerst', () => {
    expect(
      schwachstellenAus(
        skalen({ ordnen: 2.5, verknuepfen: 1.5, abrufen: 2, steuern: 4, dranbleiben: 3.5, zeiteinteilen: 2.9 }),
      ),
    ).toEqual(['verknuepfen', 'abrufen']);
  });

  it('nennt bei GENAU 3,0 keine Schwachstelle', () => {
    // „Unter 3,0" heisst: 3,0 selbst ist keine.
    expect(
      schwachstellenAus(
        skalen({ ordnen: 3, verknuepfen: 3, abrufen: 3, steuern: 3, dranbleiben: 3, zeiteinteilen: 3 }),
      ),
    ).toEqual([]);
  });

  it('nennt knapp unter 3,0 eine — und nur die', () => {
    expect(
      schwachstellenAus(
        skalen({ ordnen: 4, verknuepfen: 4, abrufen: 4, steuern: 4, dranbleiben: 4, zeiteinteilen: 2.99 }),
      ),
    ).toEqual(['zeiteinteilen']);
  });

  it('macht aus einer nicht erhobenen Skala keine Schwachstelle', () => {
    expect(schwachstellenAus(skalen({ verknuepfen: 2 }))).toEqual(['verknuepfen']);
    expect(schwachstellenAus(skalen({}))).toEqual([]);
  });

  it('nimmt bei gleichem Mittel die Reihenfolge der Skalen', () => {
    expect(
      schwachstellenAus(
        skalen({ ordnen: 2, verknuepfen: 2, abrufen: 2, steuern: 2, dranbleiben: 2, zeiteinteilen: 2 }),
      ),
    ).toEqual(['ordnen', 'verknuepfen']);
  });
});

describe('werteAus', () => {
  const antworten = {
    ...fuer('ordnen', 2, 2, 3),
    ...fuer('verknuepfen', 4, 5, 4),
    ...fuer('abrufen', 1, 2, 2),
    ...fuer('steuern', 3, 3, 3),
    ...fuer('dranbleiben', 4, 4, 5),
    ...fuer('zeiteinteilen', 2, 3, 3),
    ...fuer('bedeutungsorientiert', 3, 4),
    ...fuer('reproduktionsorientiert', 2, 2),
    ...fuer('anwendungsorientiert', 5, 4),
    ...fuer('ungerichtet', 4, 3),
  };

  it('rechnet ein ganzes Profil aus den Antworten', () => {
    const ergebnis = werteAus({ itemsatz: 1, antworten });
    expect(ergebnis?.skalen.ordnen).toBeCloseTo(7 / 3, 10);
    expect(ergebnis?.skalen.abrufen).toBeCloseTo(5 / 3, 10);
    expect(ergebnis?.skalen.zeiteinteilen).toBeCloseTo(8 / 3, 10);
    expect(ergebnis).toMatchObject({
      skalen: { steuern: 3 },
      muster: {
        bedeutungsorientiert: 3.5,
        reproduktionsorientiert: 2,
        anwendungsorientiert: 4.5,
        ungerichtet: 3.5,
      },
      lernmuster: { art: 'eindeutig', muster: 'anwendungsorientiert' },
      strukturhinweis: true,
      schwachstellen: ['abrufen', 'ordnen'],
    });
  });

  it('gilt bei fremdem itemsatz als nicht erhoben', () => {
    // Antworten auf alte Aussagen werden nicht mit neuen verrechnet — auch
    // dann nicht, wenn zufaellig alle Ids noch passen.
    expect(werteAus({ itemsatz: 2, antworten })).toBeNull();
    expect(werteAus({ itemsatz: 1, antworten })).not.toBeNull();
  });

  it('liefert ohne Antworten lauter null und keinen Befund', () => {
    expect(werteAus({ itemsatz: 1, antworten: {} })).toEqual({
      skalen: {
        ordnen: null,
        verknuepfen: null,
        abrufen: null,
        steuern: null,
        dranbleiben: null,
        zeiteinteilen: null,
      },
      muster: {
        bedeutungsorientiert: null,
        reproduktionsorientiert: null,
        anwendungsorientiert: null,
        ungerichtet: null,
      },
      lernmuster: null,
      strukturhinweis: false,
      schwachstellen: [],
    });
  });

  it('macht aus einer uebersprungenen Skala keinen Mangel', () => {
    // Alles mit 4 beantwortet, nur „Ordnen" hat ein einziges Kreuz — bei 1.
    const fastAlles = Object.fromEntries(
      ITEMS.filter((item) => item.dimension !== 'ordnen').map((item) => [item.id, 4 as const]),
    );
    const ergebnis = werteAus({ itemsatz: 1, antworten: { ...fastAlles, ...fuer('ordnen', 1) } });
    expect(ergebnis?.skalen.ordnen).toBeNull();
    expect(ergebnis?.schwachstellen).toEqual([]);
  });
});
