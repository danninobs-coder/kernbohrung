// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { bereinigeQuelle, ladePdfjs, liesSeiten } from '../werkzeug/adapter/dokument.mjs';
import {
  dateikuerzel,
  findeAgenda,
  findeTitellaeufe,
  folientitel,
  gliedereFolien,
  slug,
} from '../werkzeug/gliederung/folien.mjs';

/**
 * Der Gliederer fuer Foliensaetze: Seiten hinein, Abschnitte heraus.
 *
 * Rein — die meisten Tests bauen ihre Folien selbst, mit einer Titelzeile und
 * ein paar Rumpfzeilen. Am Ende laeuft dasselbe an den drei Foliensatz-Fixtures.
 */
const FIXTUREN = path.resolve(__dirname, 'fixtures');

/** Eine Folie: Titelzeile in 20 pt, darunter Rumpfzeilen in 15 pt. */
function folie(nummer: number, titel: string | null, rumpf: string[] = []) {
  const zeilen = [
    ...(titel === null ? [] : [{ text: titel, groesse: 20, y: 495, x0: 90, x1: 600 }]),
    ...rumpf.map((text, i) => ({ text, groesse: 15, y: 430 - i * 26, x0: 100, x1: 620 })),
  ];
  return { nummer, zeilen };
}

/** Ein Satz aus Folien mit den gegebenen Titeln. */
const satz = (titel: (string | null)[], datei = 'M7 Risikomanagement 26.pdf') => ({
  datei,
  seiten: titel.map((t, i) => folie(i + 1, t)),
});

describe('slug', () => {
  it.each([
    ['Maßnahmen der Bestandsaufnahme', 'massnahmen-der-bestandsaufnahme'],
    ['Ergänzende PM- Leistungen gem. AHO', 'ergaenzende-pm-leistungen-gem'],
    ['Grundlagen & Grundsätze', 'grundlagen-grundsaetze'],
    ['Wie organisieren wir uns selbst?', 'wie-organisieren'],
    ['„Projektkommunikation“', 'projektkommunikation'],
  ])('%s', (titel, erwartet) => {
    expect(slug(titel)).toBe(erwartet);
  });

  it('bleibt unter vier Woertern und 32 Zeichen', () => {
    const lang = slug('Beispiel für typische objektorientierte Gliederung eines Hochbauprojektes');
    expect(lang).toBe('beispiel-fuer-typische');
    expect(lang.length).toBeLessThanOrEqual(32);
    expect(lang.split('-')).toHaveLength(3);
  });

  it('endet nicht auf einem Fuellwort', () => {
    expect(slug('Hilfsmittel für die Projektkoordination')).toBe('hilfsmittel');
  });

  it('liefert eine leere Zeichenkette, wenn nichts uebrig bleibt', () => {
    expect(slug('— · —')).toBe('');
  });
});

describe('dateikuerzel', () => {
  it('nimmt Buchstaben und Zahl aus dem Dateinamen, die Zahl zweistellig', () => {
    const kuerzel = dateikuerzel(['M1 PM und Leistungsbilder 26.pdf', 'M9 Leistungsstandsmessung 26.pdf', 'M10 Steuerung 26.pdf']);
    expect([...kuerzel.values()]).toEqual(['m01', 'm09', 'm10']);
  });

  it('sortiert damit in Lesereihenfolge', () => {
    // Einstellig sortierte `m10` vor `m2` — die Abschnitt-Ids sollen in der
    // Reihenfolge der Dateien stehen, auch nach Codepunkten sortiert.
    const kuerzel = [...dateikuerzel(['M2 a.pdf', 'M10 b.pdf']).values()];
    expect([...kuerzel].sort()).toEqual(kuerzel);
  });

  it('nummeriert alle Dateien durch, wenn eine nicht auf das Muster passt', () => {
    expect([...dateikuerzel(['Vorlesung.pdf', 'M7 x.pdf']).values()]).toEqual(['d01', 'd02']);
  });

  it('nummeriert alle Dateien durch, wenn zwei Kuerzel kollidieren', () => {
    expect([...dateikuerzel(['M7 a.pdf', 'M07 b.pdf']).values()]).toEqual(['d01', 'd02']);
  });
});

describe('folientitel', () => {
  it('nimmt die oberste Nutzzeile', () => {
    expect(folientitel(folie(1, 'Risikomanagement', ['• Ein Punkt']))?.text).toBe('Risikomanagement');
  });

  it('nimmt eine zweite Zeile gleicher Groesse dazu', () => {
    const seite = {
      nummer: 1,
      zeilen: [
        { text: 'Risikomanagement und', groesse: 35.3, y: 400, x0: 90, x1: 600 },
        { text: 'Vertragswesen', groesse: 35.3, y: 360, x0: 90, x1: 500 },
        { text: 'Ein Rumpfsatz', groesse: 15, y: 300, x0: 100, x1: 400 },
      ],
    };
    expect(folientitel(seite)?.text).toBe('Risikomanagement und Vertragswesen');
    expect(folientitel(seite)?.zeilen).toBe(2);
  });

  it('nimmt hoechstens drei Zeilen', () => {
    const seite = {
      nummer: 1,
      zeilen: [0, 1, 2, 3].map((i) => ({ text: `Zeile ${i}`, groesse: 20, y: 400 - i * 25, x0: 90, x1: 600 })),
    };
    expect(folientitel(seite)?.zeilen).toBe(3);
  });

  it('liefert null fuer eine Folie ohne Nutzzeile', () => {
    expect(folientitel(folie(1, null))).toBeNull();
  });
});

describe('findeAgenda', () => {
  const mitAgenda = (agendazeilen: string[], titel: (string | null)[]) => ({
    datei: 'M7.pdf',
    seiten: [folie(1, 'Titelfolie'), folie(2, 'AGENDA', agendazeilen), ...titel.map((t, i) => folie(i + 3, t))],
  });

  it('findet die Agendafolie und ihre Grenzen', () => {
    const agenda = findeAgenda(
      mitAgenda(
        ['Begriffsbestimmungen', 'Prozess des Risikomanagements', 'Vertragswesen'],
        ['Begriffsbestimmungen', 'x', 'Prozess des Risikomanagements', 'y', 'Vertragswesen'],
      ).seiten,
    );
    expect(agenda?.seite).toBe(2);
    expect(agenda?.treffer.map((t) => t.seite)).toEqual([3, 5, 7]);
  });

  it('trifft auch ueber den Wortstamm hinweg', () => {
    // „Begriffsbestimmungen" in der Agenda, „Begriffsbestimmung — Risiko" als
    // Folientitel: Ohne Wortstamm kein Treffer, und die Agenda faellt weg.
    const agenda = findeAgenda(
      mitAgenda(
        ['Begriffsbestimmungen', 'Prozess des Risikomanagements'],
        ['Begriffsbestimmung Risiko', 'x', 'Prozess des Risikomanagements'],
      ).seiten,
    );
    expect(agenda?.treffer.map((t) => t.zeile)).toEqual(['Begriffsbestimmungen', 'Prozess des Risikomanagements']);
  });

  it('nimmt keine Folie, deren Zeilen nur zu einem Drittel wiederkehren', () => {
    const agenda = findeAgenda(
      mitAgenda(['Themenblock eins', 'Themenblock zwei', 'Themenblock drei'], ['Themenblock eins', 'x', 'y', 'z']).seiten,
    );
    expect(agenda).toBeNull();
  });

  it('sieht nur unter den ersten fuenf Folien nach', () => {
    const spaet = {
      datei: 'M7.pdf',
      seiten: [
        ...[1, 2, 3, 4, 5].map((n) => folie(n, `Vorspann ${n}`)),
        folie(6, 'AGENDA', ['Kostenermittlung', 'Terminplanung']),
        folie(7, 'Kostenermittlung'),
        folie(8, 'Terminplanung'),
      ],
    };
    expect(findeAgenda(spaet.seiten)).toBeNull();
  });
});

describe('findeTitellaeufe', () => {
  it('fasst aufeinanderfolgende Folien mit demselben Titel zusammen', () => {
    const laeufe = findeTitellaeufe(satz(['Grundlagen', 'Grundlagen', 'Grundlagen', 'Kosten', 'Kosten']).seiten);
    expect(laeufe).toEqual([
      { titel: 'Grundlagen', von: 1, bis: 3 },
      { titel: 'Kosten', von: 4, bis: 5 },
    ]);
  });

  it('nimmt eine einzelne Folie nicht als Lauf', () => {
    expect(findeTitellaeufe(satz(['a', 'b', 'c']).seiten)).toEqual([]);
  });

  it('nimmt nur den Folientitel, nicht irgendeine wiederkehrende Zeile', () => {
    // Woertlich genommen machte die Regel des Specs eine Aufzaehlungszeile zum
    // Titel eines Abschnitts ueber vierzehn Folien.
    const seiten = [
      folie(1, 'Erstes Thema', ['• Immer dieselbe Fussnote']),
      folie(2, 'Zweites Thema', ['• Immer dieselbe Fussnote']),
      folie(3, 'Drittes Thema', ['• Immer dieselbe Fussnote']),
    ];
    expect(findeTitellaeufe(seiten)).toEqual([]);
  });
});

describe('gliedereFolien', () => {
  const kuerzel = 'm07';

  it('laesst einen Satz bis 20 Folien ein Abschnitt', () => {
    const aus = gliedereFolien(satz(Array.from({ length: 20 }, (_, i) => `Titel ${i}`)), kuerzel);
    expect(aus.gliederung).toBe('einzeln');
    expect(aus.abschnitte).toEqual([
      {
        id: 'm07-01-folien-1-20',
        titel: 'M7 Risikomanagement 26, Folien 1–20',
        datei: 'M7 Risikomanagement 26.pdf',
        seiten: [1, 20],
      },
    ]);
  });

  it('teilt einen groesseren Satz an der Agenda', () => {
    const seiten = [
      folie(1, 'Titelfolie'),
      folie(2, 'AGENDA', ['Grundlagen der Planung', 'Kosten und Termine', 'Risiken im Projekt']),
      ...Array.from({ length: 19 }, (_, i) =>
        folie(i + 3, i === 0 ? 'Grundlagen der Planung' : i === 6 ? 'Kosten und Termine' : i === 12 ? 'Risiken im Projekt' : `Rumpf ${i}`),
      ),
    ];
    const aus = gliedereFolien({ datei: 'M7 Risikomanagement 26.pdf', seiten }, kuerzel);
    expect(aus.gliederung).toBe('agenda');
    expect(aus.abschnitte.map((a) => [a.id, a.titel, a.seiten])).toEqual([
      ['m07-01-grundlagen-der-planung', 'Grundlagen der Planung', [1, 8]],
      ['m07-02-kosten-und-termine', 'Kosten und Termine', [9, 14]],
      ['m07-03-risiken-im-projekt', 'Risiken im Projekt', [15, 21]],
    ]);
  });

  it('teilt sonst an den Titellaeufen', () => {
    const titel = [
      ...Array.from({ length: 11 }, () => 'Erster Lauf'),
      ...Array.from({ length: 10 }, () => 'Zweiter Lauf'),
    ];
    const aus = gliedereFolien(satz(titel), kuerzel);
    expect(aus.gliederung).toBe('titellaeufe');
    expect(aus.abschnitte.map((a) => [a.id, a.seiten])).toEqual([
      ['m07-01-erster-lauf', [1, 11]],
      ['m07-02-zweiter-lauf', [12, 21]],
    ]);
  });

  it('gibt mehr als drei Folien vor der ersten Grenze einen eigenen Abschnitt', () => {
    // Sonst verschwaenden sie im ersten Abschnitt und traegen dessen Titel,
    // obwohl sie gar nicht dazugehoeren.
    const titel = [
      ...Array.from({ length: 6 }, (_, i) => `Einzelthema ${i}`),
      ...Array.from({ length: 8 }, () => 'Erster Lauf'),
      ...Array.from({ length: 8 }, () => 'Zweiter Lauf'),
    ];
    const aus = gliedereFolien(satz(titel), kuerzel);
    expect(aus.abschnitte.map((a) => [a.id, a.titel, a.seiten])).toEqual([
      ['m07-01-folien-1-6', 'M7 Risikomanagement 26, Folien 1–6', [1, 6]],
      ['m07-02-erster-lauf', 'Erster Lauf', [7, 14]],
      ['m07-03-zweiter-lauf', 'Zweiter Lauf', [15, 22]],
    ]);
  });

  it('schlaegt drei oder weniger Vorlauffolien dem ersten Abschnitt zu', () => {
    const titel = [
      ...Array.from({ length: 3 }, (_, i) => `Einzelthema ${i}`),
      ...Array.from({ length: 9 }, () => 'Erster Lauf'),
      ...Array.from({ length: 9 }, () => 'Zweiter Lauf'),
    ];
    const aus = gliedereFolien(satz(titel), kuerzel);
    expect(aus.abschnitte.map((a) => a.seiten)).toEqual([
      [1, 12],
      [13, 21],
    ]);
  });

  it('teilt gleichmaessig, wenn weder Agenda noch Lauf greift', () => {
    const aus = gliedereFolien(satz(Array.from({ length: 32 }, (_, i) => `Thema ${i}`)), kuerzel);
    expect(aus.gliederung).toBe('gleichmaessig');
    expect(aus.abschnitte.map((a) => a.seiten)).toEqual([
      [1, 11],
      [12, 22],
      [23, 32],
    ]);
    expect(aus.abschnitte[0]?.titel).toBe('M7 Risikomanagement 26, Folien 1–11');
  });

  it('deckt jede Folie genau einmal ab', () => {
    const aus = gliedereFolien(satz(Array.from({ length: 47 }, (_, i) => `Thema ${i}`)), kuerzel);
    const abgedeckt = aus.abschnitte.flatMap(({ seiten: [von, bis] }) =>
      Array.from({ length: bis - von + 1 }, (_, i) => von + i),
    );
    expect(abgedeckt).toEqual(Array.from({ length: 47 }, (_, i) => i + 1));
  });
});

describe('an den Fixtures', () => {
  async function gliedere(name: string) {
    const geladen = await ladePdfjs();
    const bytes = new Uint8Array(readFileSync(path.join(FIXTUREN, name)));
    const [datei] = bereinigeQuelle([{ datei: name, ...(await liesSeiten(bytes, geladen)) }]);
    return gliedereFolien(datei!, dateikuerzel([name]).get(name)!);
  }

  it('gliedert den Satz mit Agenda an ihren drei Zeilen', async () => {
    const aus = await gliedere('folien-agenda.pdf');
    expect(aus.gliederung).toBe('agenda');
    expect(aus.abschnitte.map((a) => [a.id, a.titel, a.seiten])).toEqual([
      ['d01-01-grundlagen-der-planung', 'Grundlagen der Planung', [1, 10]],
      ['d01-02-kosten-und-termine', 'Kosten und Termine', [11, 18]],
      ['d01-03-risiken-im-projekt', 'Risiken im Projekt', [19, 26]],
    ]);
  });

  it('gliedert den Satz ohne Agenda an seinen Titellaeufen', async () => {
    const aus = await gliedere('folien-laeufe.pdf');
    expect(aus.gliederung).toBe('titellaeufe');
    expect(aus.abschnitte.map((a) => [a.titel, a.seiten])).toEqual([
      ['Grundlagen der Planung', [1, 4]],
      ['Planungsphasen im Überblick', [5, 9]],
      ['Kosten und Termine', [10, 13]],
      ['Terminplanung', [14, 17]],
      ['Risiken im Projekt', [18, 20]],
      ['Risikobewertung', [21, 25]],
    ]);
  });

  it('teilt den Satz ohne Agenda und ohne Lauf gleichmaessig', async () => {
    const aus = await gliedere('folien-gleichmaessig.pdf');
    expect(aus.gliederung).toBe('gleichmaessig');
    expect(aus.abschnitte.map((a) => [a.id, a.seiten])).toEqual([
      ['d01-01-folien-1-11', [1, 11]],
      ['d01-02-folien-12-22', [12, 22]],
      ['d01-03-folien-23-32', [23, 32]],
    ]);
  });

  it('laesst den kurzen Satz einen Abschnitt', async () => {
    const aus = await gliedere('folien-wenig-text.pdf');
    expect(aus.gliederung).toBe('einzeln');
    expect(aus.abschnitte.map((a) => [a.id, a.titel])).toEqual([
      ['d01-01-folien-1-6', 'folien-wenig-text, Folien 1–6'],
    ]);
  });
});
