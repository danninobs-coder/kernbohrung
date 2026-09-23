// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { ladePdfjs, liesSeiten, werteOperatorenAus, zeilenAus } from '../werkzeug/adapter/dokument.mjs';
import { PDFDocument, StandardFonts, degrees } from 'pdf-lib';

/**
 * Der Teil von `dokument.mjs`, der ein PDF liest.
 *
 * Zwei Sorten Test: `zeilenAus` und `werteOperatorenAus` bekommen erfundene
 * Elemente und Operatoren — schnell und ohne pdf.js. `liesSeiten` laeuft an
 * den Fixtures unter `tests/fixtures/`, die `werkzeug/fixtures/erzeuge.mjs`
 * schreibt. Kein Test liest `quellen/` oder fremdes Lehrmaterial.
 *
 * Umgebung `node`: pdf.js laedt seinen Worker per dynamischem Import und
 * liest seine Daten mit `fs.readFile`.
 */
const FIXTUREN = path.resolve(__dirname, 'fixtures');
const liesFixture = (name: string) => new Uint8Array(readFileSync(path.join(FIXTUREN, name)));

/** Ein Textelement in der Form, die `getTextContent().items` liefert. */
function element(str: string, x: number, y: number, groesse = 12, breite = str.length * groesse * 0.5) {
  return { str, width: breite, height: groesse, transform: [groesse, 0, 0, groesse, x, y] };
}

/** Dasselbe, aber gedreht — eine Achsenbeschriftung. */
function gedreht(str: string, x: number, y: number, groesse = 12) {
  return { str, width: str.length * groesse * 0.5, height: groesse, transform: [0, groesse, -groesse, 0, x, y] };
}

describe('zeilenAus', () => {
  it('setzt Stuecke auf gleicher Grundlinie zu einer Zeile zusammen, nach x sortiert', () => {
    const zeilen = zeilenAus([element('welt', 60, 400), element('Hallo ', 10, 400)]);
    expect(zeilen.map((z) => z.text)).toEqual(['Hallo welt']);
    expect(zeilen[0]?.groesse).toBe(12);
  });

  it('haelt Stuecke derselben Zeile zusammen, auch wenn die Grundlinie leicht wackelt', () => {
    // Eine Zahl neben einem Wort sitzt selten auf demselben y. Die Toleranz
    // haengt an der kleineren Schriftgroesse: 0,3 x 12 = 3,6 pt.
    const zusammen = zeilenAus([element('Kosten', 10, 400, 20, 60), element('1.250', 80, 401.5, 12)]);
    expect(zusammen.map((z) => z.text)).toEqual(['Kosten 1.250']);
    // Mehr als die Toleranz: zwei Zeilen, die obere zuerst.
    const getrennt = zeilenAus([element('Kosten', 10, 400, 20, 60), element('1.250', 80, 405, 12)]);
    expect(getrennt.map((z) => z.text)).toEqual(['1.250', 'Kosten']);
  });

  it('trennt zwei Textfelder auf gleicher Hoehe an der grossen Luecke', () => {
    // Das linke Stueck endet bei x = 34, das rechte beginnt bei 400: mehr als
    // das Doppelte der Schriftgroesse. Zwei Textfelder sind zwei Zeilen.
    const zeilen = zeilenAus([element('links', 10, 400, 12, 24), element('rechts', 400, 400)]);
    expect(zeilen.map((z) => z.text)).toEqual(['links', 'rechts']);
  });

  it('setzt ein Leerzeichen erst ab der Wortluecke', () => {
    const eng = zeilenAus([element('Pro', 10, 400, 12, 18), element('jekt', 28, 400)]);
    expect(eng.map((z) => z.text)).toEqual(['Projekt']);
    const weit = zeilenAus([element('Pro', 10, 400, 12, 18), element('jekt', 31, 400)]);
    expect(weit.map((z) => z.text)).toEqual(['Pro jekt']);
  });

  it('verwirft Elemente, die nur aus Leerraum bestehen', () => {
    const zeilen = zeilenAus([element('a', 10, 400, 12, 6), element('   ', 16, 400, 12, 18), element('b', 34, 400)]);
    expect(zeilen.map((z) => z.text)).toEqual(['a b']);
  });

  it('liest von oben nach unten, auch wenn der Strom anders sortiert ist', () => {
    // Am echten Material stand der Titel einer Agendafolie im Strom hinter der
    // Liste. Ohne die Sortierung nach y waere „oberste Zeile = Titel" falsch.
    const zeilen = zeilenAus([element('Punkt eins', 100, 300), element('Titel', 100, 500, 24)]);
    expect(zeilen.map((z) => z.text)).toEqual(['Titel', 'Punkt eins']);
  });

  it('haengt gedrehte Beschriftungen als eigene Zeilen an und markiert sie', () => {
    const zeilen = zeilenAus([element('Titel', 100, 500), gedreht('Kosten', 40, 200)]);
    expect(zeilen.map((z) => [z.text, z.gedreht ?? false])).toEqual([
      ['Titel', false],
      ['Kosten', true],
    ]);
  });

  it('laesst doppelt gesetzten Text nur einmal stehen', () => {
    // Schein-Fettdruck: dasselbe Stueck ein zweites Mal, um Haaresbreite versetzt.
    const zeilen = zeilenAus([element('Fett', 10, 400), element('Fett', 10.2, 400)]);
    expect(zeilen.map((z) => z.text)).toEqual(['Fett']);
  });
});

describe('werteOperatorenAus', () => {
  // Nur die Operatoren, um die es hier geht — pdf.js wird dafuer nicht geladen.
  const OPS = {
    save: 10,
    restore: 11,
    transform: 12,
    paintFormXObjectBegin: 74,
    paintFormXObjectEnd: 75,
    constructPath: 91,
    paintImageXObject: 85,
  };
  const BILD_OPS = new Set([85]);
  const werte = (paare: [number, unknown][]) =>
    werteOperatorenAus({ fnArray: paare.map(([fn]) => fn), argsArray: paare.map(([, args]) => args) }, OPS, BILD_OPS);
  /** Ein Pfad, wie ihn pdf.js liefert: `args[1][0]` traegt die Zahlen. */
  const pfad = (daten: number[]): [number, unknown] => [OPS.constructPath, [null, [daten]]];
  const strich = (x0: number, y0: number, x1: number, y1: number) => pfad([0, x0, y0, 1, x1, y1]);

  it('macht aus einem Bild einen Schluessel aus Groesse und Lage', () => {
    const { bilder } = werte([
      [OPS.transform, [84, 0, 0, 28, 712, 16]],
      [OPS.paintImageXObject, ['img_1']],
    ]);
    expect(bilder).toEqual(['84x28@712,16']);
  });

  it('gibt zwei fast gleich platzierten Bildern denselben Schluessel', () => {
    // Ohne das Raster von 4 pt faende die Wiederkehr das Logo im Briefkopf nicht.
    const eins = werte([[OPS.transform, [84, 0, 0, 28, 712, 16]], [OPS.paintImageXObject, ['a']]]);
    const zwei = werte([[OPS.transform, [83.4, 0, 0, 27.6, 713.1, 17.2]], [OPS.paintImageXObject, ['b']]]);
    expect(zwei.bilder).toEqual(eins.bilder);
  });

  it('stellt die Transformation hinter restore wieder her', () => {
    const { bilder } = werte([
      [OPS.save, []],
      [OPS.transform, [540, 0, 0, 380, 150, 120]],
      [OPS.restore, []],
      [OPS.transform, [84, 0, 0, 28, 712, 16]],
      [OPS.paintImageXObject, ['logo']],
    ]);
    expect(bilder).toEqual(['84x28@712,16']);
  });

  it('zaehlt waagrechte und senkrechte Linien getrennt', () => {
    const { gitter } = werte([
      strich(100, 400, 500, 400),
      strich(100, 370, 500, 370),
      strich(100, 400, 100, 300),
      strich(200, 400, 200, 300),
      strich(300, 400, 300, 300),
    ]);
    expect(gitter).toEqual({ hLinien: 2, vLinien: 3 });
  });

  it('zaehlt kurze Striche und Kurven nicht als Tabellenlinien', () => {
    const { gitter } = werte([
      strich(100, 400, 120, 400), // 20 pt waagrecht: eine Unterstreichung
      strich(100, 400, 100, 405), // 5 pt senkrecht: ein Trennzeichen
      pfad([0, 100, 100, 2, 150, 150, 200, 200, 400, 100]), // eine Kurve
    ]);
    expect(gitter).toEqual({ hLinien: 0, vLinien: 0 });
  });
});

describe('liesSeiten an den Fixtures', () => {
  let pdfjs: Awaited<ReturnType<typeof ladePdfjs>>;
  /**
   * Konsolenmeldungen waehrend `ladePdfjs()` hier in `beforeAll` — vor jedem
   * Test dieser Datei. `ladePdfjs` speichert selbst nichts zwischen; einzig
   * der dynamische Import von pdf.js liegt im Modul-Cache von Node, und
   * Vitest laedt Module je Testdatei neu (isolate: true, Voreinstellung) —
   * dieser Aufruf ist also der erste Import von pdf.js in dieser Datei, ganz
   * gleich, welche andere Testdatei vorher lief.
   */
  let ladeMeldungen: unknown[];
  beforeAll(async () => {
    ladeMeldungen = [];
    const echt = { log: console.log, warn: console.warn, error: console.error, info: console.info };
    console.log = (...t: unknown[]) => ladeMeldungen.push(t);
    console.warn = (...t: unknown[]) => ladeMeldungen.push(t);
    console.error = (...t: unknown[]) => ladeMeldungen.push(t);
    console.info = (...t: unknown[]) => ladeMeldungen.push(t);
    try {
      pdfjs = await ladePdfjs();
    } finally {
      Object.assign(console, echt);
    }
  });

  it('liest Seitenzahl, Format und Zeilen eines Foliensatzes', async () => {
    const { seiten } = await liesSeiten(liesFixture('folien-agenda.pdf'), pdfjs);
    expect(seiten).toHaveLength(26);
    expect(seiten.map((s) => [Math.round(s.breite), Math.round(s.hoehe)])).toContainEqual([842, 595]);
    expect(new Set(seiten.map((s) => `${Math.round(s.breite)}x${Math.round(s.hoehe)}`))).toEqual(new Set(['842x595']));
    // Die Agendafolie, von oben nach unten: Briefkopf, Titel, drei Punkte, Fusszeile.
    expect(seiten[1]?.zeilen.map((z) => z.text)).toEqual([
      'Projektmanagement – Fixture-Vorlesung – Musterhochschule',
      'Folie 2',
      'AGENDA',
      'Grundlagen der Planung',
      'Kosten und Termine',
      'Risiken im Projekt',
      'Lehrstuhl Beispiel · Sommersemester 2026',
    ]);
    expect(seiten[1]?.zeilen.map((z) => z.groesse)).toEqual([12, 11, 22, 20, 20, 20, 9]);
  });

  it('erkennt das Logo an derselben Platzierung auf jeder Folie', async () => {
    const { seiten } = await liesSeiten(liesFixture('folien-agenda.pdf'), pdfjs);
    expect(new Set(seiten.map((s) => s.bilder[0]))).toEqual(new Set(['84x28@712,16']));
    // Die Bildfolie traegt daneben ein zweites, anders platziertes Bild.
    expect(seiten[8]?.bilder).toEqual(['84x28@712,16', '540x380@152,120']);
  });

  it('findet das Liniengitter der Tabellenfolie und nur dort', async () => {
    const { seiten } = await liesSeiten(liesFixture('folien-agenda.pdf'), pdfjs);
    expect(seiten[13]?.gitter).toEqual({ hLinien: 6, vLinien: 5 });
    expect(seiten.filter((s) => s.gitter.hLinien >= 5 && s.gitter.vLinien >= 5).map((s) => s.nummer)).toEqual([14]);
  });

  it('liest das Hochformat als hoch und den Satz ohne Textebene als leer', async () => {
    const buch = await liesSeiten(liesFixture('buch-hochformat.pdf'), pdfjs);
    expect(buch.seiten).toHaveLength(12);
    expect([Math.round(buch.seiten[0]!.breite), Math.round(buch.seiten[0]!.hoehe)]).toEqual([595, 842]);

    const scan = await liesSeiten(liesFixture('folien-scan.pdf'), pdfjs);
    expect(scan.seiten).toHaveLength(5);
    expect(scan.seiten.every((s) => s.zeilen.length === 0)).toBe(true);
    expect(scan.seiten.every((s) => s.bilder.length === 1)).toBe(true);
  });

  it('gibt die vier Datenpfade mit Schraegstrich am Ende weiter', async () => {
    // Unter Windows endet `path.join` auf dem Trennzeichen des Systems; pdf.js weist solche Pfade mit
    // „Invalid factory url … must include trailing slash" ab. Der Fehler faellt
    // erst beim Lesen auf, nicht beim Laden.
    const { optionen } = pdfjs;
    const pfade = ['standardFontDataUrl', 'cMapUrl', 'wasmUrl', 'iccUrl'].map((name) => String(optionen[name]));
    expect(pfade.map((p) => p.endsWith('/'))).toEqual([true, true, true, true]);
    expect(pfade.some((p) => p.includes('\\'))).toBe(false);
  });

  it('meldet beim Laden und beim Lesen nichts auf der Konsole', async () => {
    // Die Ladephase: von `beforeAll` in `ladeMeldungen` gesammelt, bevor
    // dieser oder ein anderer Test dieser Datei lief.
    expect(ladeMeldungen).toEqual([]);

    // Ohne die vier Datenpfade meldet pdf.js fehlende Standardschriften und
    // nicht dekodierbare Bilder — je Datei mehrere Zeilen, die wie ein Fehler
    // aussehen und keiner sind.
    const gesammelt: unknown[] = [];
    const echt = { log: console.log, warn: console.warn, error: console.error };
    console.log = (...t: unknown[]) => gesammelt.push(t);
    console.warn = (...t: unknown[]) => gesammelt.push(t);
    console.error = (...t: unknown[]) => gesammelt.push(t);
    try {
      await liesSeiten(liesFixture('folien-agenda.pdf'), pdfjs);
    } finally {
      Object.assign(console, echt);
    }
    expect(gesammelt).toEqual([]);
  });

  it('weist eine gedrehte Seite ab, statt die Zeilenreihenfolge still falsch zu lesen', async () => {
    // getViewport dreht Breite/Hoehe mit /Rotate, getTextContent liefert die
    // Koordinaten aber unrotiert — vermischt ergaebe das eine falsche
    // Zeilenreihenfolge, ohne dass irgendetwas das meldet.
    const doc = await PDFDocument.create();
    const schrift = await doc.embedFont(StandardFonts.Helvetica);
    const seite = doc.addPage([595, 842]);
    seite.setRotation(degrees(90));
    seite.drawText('Text auf gedrehter Seite', { x: 50, y: 800, size: 12, font: schrift });
    const bytes = await doc.save();

    await expect(liesSeiten(bytes, pdfjs)).rejects.toThrow('Seite 1 ist um 90 Grad gedreht');
  });
});
