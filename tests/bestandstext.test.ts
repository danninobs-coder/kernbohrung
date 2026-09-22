import { describe, it, expect } from 'vitest';
import type { Bestand, Luecken, Zeile } from '../src/lib/abdeckung';
import {
  STATUS_TEXT,
  aufklapptext,
  fundstelle,
  kopfzeile,
  kurzstand,
  lueckenzeile,
  zahlenzeile,
} from '../src/lib/bestandstext';

/**
 * Die Wortlaute der Bibliothek, Zeichen fuer Zeichen. Wer hier einen Satz
 * aendert, aendert, was die Seite behauptet — das soll nie nebenbei passieren.
 *
 * `bestand()` legt die Aenderung stumpf ueber einen gueltigen Bestand und
 * ergaenzt nichts.
 */

const SHA = 'a13701eae315a81e1011a4304a6b5e741ea0a984';
const HASH = `sha256:${'b'.repeat(64)}`;

const basis: Bestand = {
  quelle: 'awesome-llm-apps',
  art: 'repo',
  titel: 'awesome-llm-apps',
  stand: SHA,
  zaehlung: { gesamt: 6, mitLektion: 3, offen: 3, beauftragt: 0, abgelehnt: 0 },
  luecken: { art: 'fehlt' },
  zeilen: [],
};

function bestand(aenderung: Partial<Bestand> = {}): Bestand {
  return { ...basis, ...aenderung };
}

const zeile = (aenderung: Partial<Zeile> = {}): Zeile => ({
  id: 'm07-2',
  titel: 'Vertragsarten',
  status: 'offen',
  datei: 'M7 Risikomanagement 26.pdf',
  seiten: [28, 34],
  vorbehalte: [],
  ...aenderung,
});

describe('kopfzeile', () => {
  it('nennt Art und kurzen Stand eines Repos', () => {
    expect(kopfzeile(bestand())).toBe('Repo · Stand a13701e');
  });

  it('kuerzt einen sha256-Stand hinter dem Praefix', () => {
    expect(kurzstand(HASH)).toBe('sha256:bbbbbbb');
    expect(kopfzeile(bestand({ art: 'folien', stand: HASH }))).toBe('Folien · Stand sha256:bbbbbbb');
  });

  it('nennt beim Buch ISBN und Auflage, wenn es sie gibt — die Auflage wie im Lehrplan', () => {
    expect(kopfzeile(bestand({ art: 'buch', stand: HASH, isbn: '978-3-658-00000-0', auflage: '3. Auflage' }))).toBe(
      'Buch · Stand sha256:bbbbbbb · ISBN 978-3-658-00000-0 · 3. Auflage',
    );
    expect(kopfzeile(bestand({ art: 'buch', stand: HASH }))).toBe('Buch · Stand sha256:bbbbbbb');
  });

  it('nennt beim Buch nur die ISBN, wenn es keine Auflage gibt', () => {
    expect(kopfzeile(bestand({ art: 'buch', stand: HASH, isbn: '978-3-658-00000-0' }))).toBe(
      'Buch · Stand sha256:bbbbbbb · ISBN 978-3-658-00000-0',
    );
  });

  it('nennt beim Buch nur die Auflage, wenn es keine ISBN gibt', () => {
    expect(kopfzeile(bestand({ art: 'buch', stand: HASH, auflage: '3. Auflage' }))).toBe(
      'Buch · Stand sha256:bbbbbbb · 3. Auflage',
    );
  });
});

describe('zahlenzeile', () => {
  it('zaehlt ein Repo in Prinzipien', () => {
    expect(zahlenzeile(bestand())).toBe('6 Prinzipien · 3 mit Lektion · 3 offen');
  });

  it('zaehlt Lehrmaterial in Abschnitten und nennt Abgelehnte', () => {
    const z = { gesamt: 38, mitLektion: 11, offen: 22, beauftragt: 0, abgelehnt: 5 };
    expect(zahlenzeile(bestand({ art: 'folien', zaehlung: z }))).toBe(
      '38 Abschnitte · 11 mit Lektion · 22 offen · 5 abgelehnt',
    );
  });

  it('nennt Beauftragte zwischen Offenen und Abgelehnten', () => {
    const z = { gesamt: 38, mitLektion: 11, offen: 18, beauftragt: 4, abgelehnt: 5 };
    expect(zahlenzeile(bestand({ art: 'folien', zaehlung: z }))).toBe(
      '38 Abschnitte · 11 mit Lektion · 18 offen · 4 beauftragt · 5 abgelehnt',
    );
  });

  it('nennt Beauftragte auch ohne Abgelehnte', () => {
    const z = { gesamt: 10, mitLektion: 5, offen: 1, beauftragt: 4, abgelehnt: 0 };
    expect(zahlenzeile(bestand({ art: 'folien', zaehlung: z }))).toBe(
      '10 Abschnitte · 5 mit Lektion · 1 offen · 4 beauftragt',
    );
  });

  it('laesst mit Lektion und offen auch bei Null stehen, und zaehlt in der Einzahl richtig', () => {
    const z = { gesamt: 1, mitLektion: 1, offen: 0, beauftragt: 0, abgelehnt: 0 };
    expect(zahlenzeile(bestand({ art: 'buch', zaehlung: z }))).toBe('1 Abschnitt · 1 mit Lektion · 0 offen');
    expect(zahlenzeile(bestand({ zaehlung: { ...z, mitLektion: 0, offen: 1 } }))).toBe('1 Prinzip · 0 mit Lektion · 1 offen');
  });
});

describe('lueckenzeile', () => {
  it.each<[string, Luecken, string]>([
    ['Git mit Auslassungen', { art: 'git', uebernommen: 62, ausgelassen: 44 }, '44 von 106 Dateien nicht übernommen'],
    ['Git ohne Auslassung', { art: 'git', uebernommen: 12, ausgelassen: 0 }, 'keine Datei ausgelassen'],
    [
      'Git mit genau einer Datei insgesamt, ausgelassen',
      { art: 'git', uebernommen: 0, ausgelassen: 1 },
      '1 von 1 Datei nicht übernommen',
    ],
    [
      'Folien mit Bild und Tabellen',
      { art: 'dokument', einheit: 'folien', seiten: 35, nurBild: 7, tabellenverdacht: 2 },
      '7 von 35 Folien nur Bild · 2 Tabellen vermutlich zerfallen',
    ],
    [
      'ein Buch mit einer Tabelle',
      { art: 'dokument', einheit: 'seiten', seiten: 210, nurBild: 0, tabellenverdacht: 1 },
      '1 Tabelle vermutlich zerfallen',
    ],
    [
      'ein Buch mit Bildseiten',
      { art: 'dokument', einheit: 'seiten', seiten: 210, nurBild: 3, tabellenverdacht: 0 },
      '3 von 210 Seiten nur Bild',
    ],
    [
      'Folien ohne beides',
      { art: 'dokument', einheit: 'folien', seiten: 20, nurBild: 0, tabellenverdacht: 0 },
      'keine Folie nur Bild, keine zerfallene Tabelle erkannt',
    ],
    [
      'genau eine Folie insgesamt, nur Bild',
      { art: 'dokument', einheit: 'folien', seiten: 1, nurBild: 1, tabellenverdacht: 0 },
      '1 von 1 Folie nur Bild',
    ],
    [
      'genau eine Seite insgesamt, nur Bild',
      { art: 'dokument', einheit: 'seiten', seiten: 1, nurBild: 1, tabellenverdacht: 0 },
      '1 von 1 Seite nur Bild',
    ],
    [
      'ein Buch ohne beides',
      { art: 'dokument', einheit: 'seiten', seiten: 20, nurBild: 0, tabellenverdacht: 0 },
      'keine Seite nur Bild, keine zerfallene Tabelle erkannt',
    ],
    ['kein Manifest', { art: 'fehlt' }, 'unbekannt — das Manifest liegt nur am Rechner, auf dem eingelesen wurde'],
    ['ein Manifest zu einem anderen Stand', { art: 'anderer-stand' }, 'unbekannt — das Manifest gehört zu einem anderen Stand'],
    [
      'ein unlesbares Manifest',
      { art: 'unlesbar', grund: 'kein gültiges JSON' },
      'unbekannt — das Manifest lässt sich nicht lesen (kein gültiges JSON)',
    ],
  ])('sagt fuer %s das Richtige', (_fall, luecken, text) => {
    expect(lueckenzeile(luecken)).toBe(text);
  });
});

describe('fundstelle', () => {
  it('nennt Datei und Folien eines Abschnitts', () => {
    expect(fundstelle('folien', zeile())).toBe('M7 Risikomanagement 26.pdf, Folien 28–34');
  });

  it('nennt eine einzelne Folie in der Einzahl', () => {
    expect(fundstelle('folien', zeile({ seiten: [12, 12] }))).toBe('M7 Risikomanagement 26.pdf, Folie 12');
  });

  it('zaehlt ein Buch in Seiten', () => {
    expect(fundstelle('buch', zeile())).toBe('M7 Risikomanagement 26.pdf, Seiten 28–34');
    expect(fundstelle('buch', zeile({ seiten: [3, 3] }))).toBe('M7 Risikomanagement 26.pdf, Seite 3');
  });

  it('hat fuer ein Prinzip aus einem Repo keine Fundstelle', () => {
    expect(fundstelle('repo', zeile({ datei: undefined, seiten: undefined }))).toBeNull();
  });

  it('hat keine Fundstelle, wenn nur die Datei fehlt', () => {
    expect(fundstelle('folien', zeile({ datei: undefined }))).toBeNull();
  });

  it('hat keine Fundstelle, wenn nur die Seiten fehlen', () => {
    expect(fundstelle('folien', zeile({ seiten: undefined }))).toBeNull();
  });
});

describe('Status und Aufklappen', () => {
  it('nennt jeden Status mit denselben Worten wie die Zahlenzeile', () => {
    expect(STATUS_TEXT).toEqual({
      lektion: 'mit Lektion',
      offen: 'offen',
      beauftragt: 'beauftragt',
      abgelehnt: 'abgelehnt',
    });
  });

  it('beschriftet den Knopf nach dem, was die Liste enthaelt, und nennt den Titel der Quelle', () => {
    expect(aufklapptext(bestand())).toBe('Alle Prinzipien von awesome-llm-apps');
    expect(aufklapptext(bestand({ art: 'folien' }))).toBe('Alle Abschnitte von awesome-llm-apps');
    expect(aufklapptext(bestand({ art: 'buch' }))).toBe('Alle Abschnitte von awesome-llm-apps');
  });

  it('unterscheidet zwei Quellen derselben Art am Knopftext, weil Screenreader sonst gleiche Eintraege lesen', () => {
    const a = aufklapptext(bestand({ art: 'folien', titel: 'Projektmanagement' }));
    const b = aufklapptext(bestand({ art: 'folien', titel: 'Bauvertragsrecht' }));
    expect(a).toBe('Alle Abschnitte von Projektmanagement');
    expect(b).toBe('Alle Abschnitte von Bauvertragsrecht');
    expect(a).not.toBe(b);
  });
});
