// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  artDerQuelle,
  bereinigeQuelle,
  findeBeiwerk,
  istZahlenzeile,
  ladePdfjs,
  liesSeiten,
  schluessel,
  seitenText,
  zieheTrennungZusammen,
} from '../werkzeug/adapter/dokument.mjs';

/**
 * Der reine Teil von `dokument.mjs`: Beiwerk, Silbentrennung, Bildseiten,
 * Tabellenverdacht, Art und Abbruch.
 *
 * Die meisten Tests bekommen erfundene Rohseiten — jede Regel laesst sich so
 * einzeln und ohne PDF pruefen. Am Ende laeuft dasselbe an den Fixtures, damit
 * nicht nur die Regeln stimmen, sondern auch das, was pdf.js wirklich liefert.
 */
const FIXTUREN = path.resolve(__dirname, 'fixtures');
const liesFixture = (name: string) => new Uint8Array(readFileSync(path.join(FIXTUREN, name)));

const HOEHE = 595;

/** Eine Rohzeile. `y` ist die Grundlinie in Punkten, wie bei pdf.js. */
function zeile(text: string, y: number, extra: { groesse?: number; x0?: number; x1?: number } = {}) {
  return { text, groesse: extra.groesse ?? 12, y, x0: extra.x0 ?? 60, x1: extra.x1 ?? 400 };
}

/** Eine Rohseite, wie `liesSeiten` sie liefert. */
function seite(
  nummer: number,
  zeilen: ReturnType<typeof zeile>[],
  extra: { bilder?: string[]; hLinien?: number; vLinien?: number } = {},
) {
  return {
    nummer,
    breite: 842,
    hoehe: HOEHE,
    zeilen,
    bilder: extra.bilder ?? [],
    gitter: { hLinien: extra.hLinien ?? 0, vLinien: extra.vLinien ?? 0 },
  };
}

/** Der Briefkopf: oben, an fester Stelle, mit laufender Nummer. */
const kopf = (n: number) => zeile(`Folie ${n}`, 0.93 * HOEHE);
/** Eine Datei aus n Folien mit Briefkopf und je einer Inhaltszeile. */
function satz(n: number, inhalt: (i: number) => ReturnType<typeof zeile>[] = () => [], name = 'satz.pdf') {
  return {
    datei: name,
    seiten: Array.from({ length: n }, (_, i) => seite(i + 1, [kopf(i + 1), ...inhalt(i + 1)])),
  };
}

describe('schluessel', () => {
  it('macht aus jeder Ziffernfolge ein einziges Zeichen', () => {
    // Ziffer fuer Ziffer ersetzt waeren „Folie 7" und „Folie 17" verschieden —
    // und die Foliennummer bliebe in jedem Satz mit mehr als neun Folien stehen.
    expect(schluessel('Folie 7')).toBe('Folie #');
    expect(schluessel('Folie 17')).toBe(schluessel('Folie 7'));
    expect(schluessel('  Seite 3  von  12 ')).toBe('Seite # von #');
  });
});

describe('zieheTrennungZusammen', () => {
  it('zieht eine Trennung am Zeilenende zusammen', () => {
    const { zeilen, zusammengezogen } = zieheTrennungZusammen([
      zeile('Die Projekt-', 400, { x0: 100, x1: 220 }),
      zeile('steuerung ist delegierbar.', 385, { x0: 100, x1: 320 }),
    ]);
    expect(zeilen.map((z) => z.text)).toEqual(['Die Projektsteuerung ist delegierbar.']);
    expect(zusammengezogen).toBe(1);
  });

  it('laesst einen Ergaenzungsstrich vor einem Bindewort stehen', () => {
    const { zeilen, zusammengezogen } = zieheTrennungZusammen([
      zeile('Kosten-', 400, { x0: 100, x1: 180 }),
      zeile('und Terminplanung gehören zusammen.', 385, { x0: 100, x1: 340 }),
    ]);
    expect(zeilen).toHaveLength(2);
    expect(zusammengezogen).toBe(0);
  });

  it('zieht nichts ueber die Grenze zweier Textfelder hinweg', () => {
    const { zeilen } = zieheTrennungZusammen([
      zeile('Vertrags-', 400, { x0: 100, x1: 180 }),
      zeile('arten in der Spalte daneben', 385, { x0: 500, x1: 700 }),
    ]);
    expect(zeilen).toHaveLength(2);
  });

  it('zieht nicht zusammen, wenn die naechste Zeile gross beginnt', () => {
    const { zeilen } = zieheTrennungZusammen([
      zeile('Bau-', 400, { x0: 100, x1: 160 }),
      zeile('Herr der Dinge', 385, { x0: 100, x1: 300 }),
    ]);
    expect(zeilen).toHaveLength(2);
  });
});

describe('istZahlenzeile', () => {
  it.each([
    ['1.250.000 1.310.000 4,8', true],
    ['12', true],
    ['01.03.2026 14 Tage', true],
    ['300 Bauwerk', false],
    ['Kostengruppe', false],
    ['– – –', false],
    ['', false],
  ])('%s', (text, erwartet) => {
    expect(istZahlenzeile(text)).toBe(erwartet);
  });
});

describe('findeBeiwerk', () => {
  it('erkennt eine Zeile, die auf jeder Seite an derselben Stelle wiederkehrt', () => {
    const beiwerk = findeBeiwerk(satz(10).seiten);
    expect([...beiwerk.keys()]).toEqual(['Folie #']);
  });

  it('findet unter fuenf Seiten gar nichts', () => {
    // Bei einer einzigen Seite kommt jede Zeile auf 100 % der Seiten vor —
    // der ganze Text waere Beiwerk und die Datei ein „Scan".
    expect(findeBeiwerk(satz(4).seiten).size).toBe(0);
    expect(findeBeiwerk(satz(1).seiten).size).toBe(0);
  });

  it('nimmt nur, was im oberen oder unteren Randstreifen steht', () => {
    // Derselbe Aufzaehlungspunkt auf jeder Folie, aber in der Seitenmitte:
    // Inhalt, kein Beiwerk. Ohne diese Bedingung verloere der Satz seinen Text.
    const mittig = satz(10, (i) => [zeile(`• Beispiel ${i}: Planung und Vergabe`, 0.5 * HOEHE)]);
    expect([...findeBeiwerk(mittig.seiten).keys()]).toEqual(['Folie #']);
  });

  it('nimmt nur, was an fester Stelle steht', () => {
    const wandernd = satz(10, (i) => [zeile('Fallbeispiel', (0.9 - i * 0.02) * HOEHE)]);
    expect([...findeBeiwerk(wandernd.seiten).keys()]).toEqual(['Folie #']);
  });
});

describe('bereinigeQuelle', () => {
  it('entfernt das Beiwerk und zaehlt, wie viele Zeichen das waren', () => {
    const [datei] = bereinigeQuelle([satz(10, () => [zeile('Inhalt der Folie', 0.5 * HOEHE)])]);
    expect(datei.seiten[0]?.zeilen.map((z) => z.text)).toEqual(['Inhalt der Folie']);
    expect(datei.beiwerkHerkunft).toBe('datei');
    // Neunmal „Folie1" bis „Folie9", einmal „Folie10" — Leerraum zaehlt nicht mit.
    expect(datei.beiwerkZeichen).toBe(9 * 6 + 7);
    expect(datei.beiwerkAnteil).toBeCloseTo(61 / (61 + 10 * 14), 5);
  });

  it('gibt einer kleinen Datei das Beiwerk der uebrigen Dateien derselben Quelle', () => {
    const gross = satz(10, () => [zeile('Inhalt', 0.5 * HOEHE)], 'gross.pdf');
    const klein = {
      datei: 'klein.pdf',
      seiten: [seite(1, [kopf(1), zeile('Die ganze Aufgabe steht nur im Bild', 0.5 * HOEHE)])],
    };
    const [, kleinBereinigt] = bereinigeQuelle([gross, klein]);
    expect(kleinBereinigt.beiwerkHerkunft).toBe('quelle');
    expect(kleinBereinigt.seiten[0]?.zeilen.map((z) => z.text)).toEqual(['Die ganze Aufgabe steht nur im Bild']);
    expect(kleinBereinigt.abbruch).toBeNull();
  });

  it('laesst einer kleinen Datei ohne grosse Nachbarin ihren Text', () => {
    const klein = {
      datei: 'klein.pdf',
      seiten: [seite(1, [kopf(1), zeile('Die ganze Aufgabe steht nur im Bild', 0.5 * HOEHE)])],
    };
    const [datei] = bereinigeQuelle([klein]);
    expect(datei.beiwerkHerkunft).toBe('keins');
    expect(datei.seiten[0]?.zeilen).toHaveLength(2);
    expect(datei.abbruch).toBeNull();
  });
});

describe('nurBild und tabellenverdacht', () => {
  /** Zehn Folien, auf jeder das Logo an derselben Stelle. */
  const mitLogo = (inhalt: (i: number) => ReturnType<typeof zeile>[], extra: (i: number) => object = () => ({})) => ({
    datei: 'satz.pdf',
    seiten: Array.from({ length: 10 }, (_, i) =>
      seite(i + 1, [kopf(i + 1), ...inhalt(i + 1)], { bilder: ['84x28@712,16'], ...extra(i + 1) }),
    ),
  });

  it('haelt eine Folie mit Logo und Text nicht fuer eine Bildfolie', () => {
    const [datei] = bereinigeQuelle([mitLogo(() => [zeile('Ein Satz mit reichlich Inhalt darauf', 0.5 * HOEHE)])]);
    expect(datei.nurBild).toEqual([]);
    expect(datei.seiten[0]?.echteBilder).toBe(0);
  });

  it('erkennt eine Folie mit echtem Bild und ohne Text', () => {
    const [datei] = bereinigeQuelle([
      mitLogo(
        () => [],
        (i) => (i === 4 ? { bilder: ['84x28@712,16', '540x380@152,120'] } : {}),
      ),
    ]);
    expect(datei.nurBild).toEqual([4]);
  });

  it('erkennt auch ein Bild mit Bildunterschrift', () => {
    // Am echten Material trug die einzige Nutzzeile einer Bildfolie genau
    // 20 Zeichen — die blosse Schwelle verfehlte sie um ein Zeichen.
    const [datei] = bereinigeQuelle([
      mitLogo(
        (i) =>
          i === 4
            ? [zeile('Abbildung 3: Der Ablauf im Überblick', 0.3 * HOEHE)] // 31 Zeichen: ueber 20, unter 40
            : [zeile('Ein Satz mit Inhalt darauf', 0.5 * HOEHE)],
        (i) => (i === 4 ? { bilder: ['84x28@712,16', '540x380@152,120'] } : {}),
      ),
    ]);
    expect(datei.nurBild).toEqual([4]);
  });

  it('erkennt ein Liniengitter als Tabelle', () => {
    const [datei] = bereinigeQuelle([
      mitLogo(
        () => [zeile('Ein Satz mit Inhalt darauf', 0.5 * HOEHE)],
        (i) => (i === 6 ? { hLinien: 6, vLinien: 5 } : { hLinien: 6, vLinien: 4 }),
      ),
    ]);
    expect(datei.tabellenverdacht).toEqual([6]);
  });

  it('erkennt drei Zeilen aus lauter Zahlen als Tabelle', () => {
    const [datei] = bereinigeQuelle([
      mitLogo((i) =>
        i === 7
          ? [zeile('1.250.000 4,8', 300), zeile('480.000 6,7', 280), zeile('95.000 -2,6', 260)]
          : [zeile('1.250.000 4,8', 300), zeile('480.000 6,7', 280), zeile('Nebenkosten steigen', 260)],
      ),
    ]);
    expect(datei.tabellenverdacht).toEqual([7]);
  });
});

describe('Abbruch und Art', () => {
  it('bricht ab, wenn fast jede Seite leer ist', () => {
    const leer = { datei: 'scan.pdf', seiten: Array.from({ length: 10 }, (_, i) => seite(i + 1, [], { bilder: ['b'] })) };
    const [datei] = bereinigeQuelle([leer]);
    expect(datei.abbruch).toBe('scan.pdf: kein Textinhalt — das Material ist gescannt; OCR ist nicht Teil des Ingests');
  });

  it('bricht bei wenig Text nicht ab', () => {
    const wenig = {
      datei: 'wenig.pdf',
      seiten: Array.from({ length: 10 }, (_, i) => seite(i + 1, [zeile('Kosten früh schätzen und melden.', 300 - i)])),
    };
    expect(bereinigeQuelle([wenig])[0]?.abbruch).toBeNull();
  });

  it('entscheidet die Art ueber die ganze Quelle, nicht je Datei', () => {
    // Eine Datei allein laege mit Median 620 ueber der Schwelle und hiesse
    // „buch" — ueber alle Seiten der Quelle bleibt es ein Foliensatz.
    const lang = { datei: 'a.pdf', seiten: [1, 2].map((n) => seite(n, [zeile('x'.repeat(620), 300)])) };
    const kurz = {
      datei: 'b.pdf',
      seiten: Array.from({ length: 8 }, (_, i) => seite(i + 1, [zeile('x'.repeat(120), 300)])),
    };
    expect(artDerQuelle(bereinigeQuelle([lang])).art).toBe('buch');
    const quelle = artDerQuelle(bereinigeQuelle([lang, kurz]));
    expect(quelle).toEqual({ art: 'folien', median: 120, quer: 10, seiten: 10 });
  });

  it('nennt ein Hochformat mit viel Text ein Buch', () => {
    const hoch = {
      datei: 'buch.pdf',
      seiten: Array.from({ length: 6 }, (_, i) => ({ ...seite(i + 1, [zeile('x'.repeat(3000), 300)]), breite: 595, hoehe: 842 })),
    };
    expect(artDerQuelle(bereinigeQuelle([hoch])).art).toBe('buch');
  });
});

describe('seitenText', () => {
  it('setzt die Seitenmarke vor den Nutztext', () => {
    const [datei] = bereinigeQuelle([satz(10, (i) => [zeile(`Inhalt ${i}`, 0.5 * HOEHE)])]);
    expect(seitenText(datei.seiten[2]!)).toBe('— Folie 3 —\nInhalt 3');
    expect(seitenText(datei.seiten[2]!, 'Seite')).toBe('— Seite 3 —\nInhalt 3');
  });
});

describe('an den Fixtures', () => {
  it('raeumt den Foliensatz mit Agenda auf', async () => {
    const geladen = await ladePdfjs();
    const roh = { datei: 'folien-agenda.pdf', ...(await liesSeiten(liesFixture('folien-agenda.pdf'), geladen)) };
    const [datei] = bereinigeQuelle([roh]);

    expect(datei.beiwerk).toEqual([
      'Projektmanagement – Fixture-Vorlesung – Musterhochschule',
      'Folie #',
      'Lehrstuhl Beispiel · Sommersemester #',
    ]);
    expect(datei.beiwerkAnteil).toBeCloseTo(0.362, 3);
    // Keine Foliennummer mehr im Nutztext.
    expect(datei.seiten.flatMap((s) => s.zeilen).filter((z) => /^Folie \d+$/.test(z.text))).toEqual([]);
    expect(datei.nurBild).toEqual([9]);
    expect(datei.tabellenverdacht).toEqual([14]);
    expect(datei.trennungen).toBe(1);
    expect(datei.abbruch).toBeNull();
    // Die Trennung ist zusammengezogen, der Ergaenzungsstrich steht noch.
    expect(datei.seiten[7]?.zeilen.map((z) => z.text)).toEqual([
      'Begriffe',
      '• Die Projektsteuerung ist eine delegierbare Bauherrenaufgabe.',
      '• Kosten-',
      'und Terminplanung gehören zusammen.',
    ]);
    expect(seitenText(datei.seiten[1]!)).toBe(
      '— Folie 2 —\nAGENDA\nGrundlagen der Planung\nKosten und Termine\nRisiken im Projekt',
    );
  });

  it('bricht beim Satz ohne Textebene ab und beim Satz mit wenig Text nicht', async () => {
    const geladen = await ladePdfjs();
    const scan = { datei: 'folien-scan.pdf', ...(await liesSeiten(liesFixture('folien-scan.pdf'), geladen)) };
    const wenig = { datei: 'folien-wenig-text.pdf', ...(await liesSeiten(liesFixture('folien-wenig-text.pdf'), geladen)) };
    expect(bereinigeQuelle([scan])[0]?.abbruch).toBe(
      'folien-scan.pdf: kein Textinhalt — das Material ist gescannt; OCR ist nicht Teil des Ingests',
    );
    const wenigBereinigt = bereinigeQuelle([wenig])[0]!;
    expect(wenigBereinigt.abbruch).toBeNull();
    expect(wenigBereinigt.median).toBe(24);
  });

  it('nennt das Hochformat ein Buch und die Foliensaetze Folien', async () => {
    const geladen = await ladePdfjs();
    const lies = async (name: string) => ({ datei: name, ...(await liesSeiten(liesFixture(name), geladen)) });
    const folien = bereinigeQuelle([await lies('folien-agenda.pdf'), await lies('folien-laeufe.pdf')]);
    expect(artDerQuelle(folien)).toEqual({ art: 'folien', median: 188, quer: 51, seiten: 51 });

    const buch = bereinigeQuelle([await lies('buch-hochformat.pdf')]);
    expect(artDerQuelle(buch)).toEqual({ art: 'buch', median: 3768, quer: 0, seiten: 12 });
    expect(buch[0]?.beiwerk).toEqual(['Musterbuch Projektmanagement · Kapitel #', '— # —']);
    expect(buch[0]?.trennungen).toBe(6);
  });
});
