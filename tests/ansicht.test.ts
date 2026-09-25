// @vitest-environment node
import { afterAll, beforeAll, describe, it, expect } from 'vitest';
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { ladePdfjs } from '../werkzeug/adapter/dokument.mjs';
import { leseFolienEin } from '../werkzeug/adapter/folien.mjs';
import { AnsichtFehler, folienAuswahl, fuehreAus, rendereFolien } from '../werkzeug/ansicht.mjs';

/**
 * Folien ansehen: auswaehlen, rendern, melden.
 *
 * Kein Test liest `quellen/` im Projekt. Einmal vorab wird die Fixture
 * `folien-agenda.pdf` in eine Vorlage im Temp-Verzeichnis eingelesen; jeder
 * Test arbeitet in seiner eigenen Kopie davon und raeumt sie wieder weg.
 *
 * Die Fixture ist A4 quer (842 × 595 pt). Bei Skala 1,5 wird eine Folie
 * 1263 × 893 px gross — so gross wie eine Folie des echten Materials.
 */
const FIXTUREN = path.resolve(__dirname, 'fixtures');
const STEMPEL = '2026-09-25T08:00:00.000Z';
const KURZNAME = 'fixture-ansicht';
/** Folien 11–18 der Fixture; Folie 14 steht unter Tabellenverdacht. */
const ABSCHNITT = 'd01-02-kosten-und-termine';
const PNG_SIGNATUR = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const AUFRUF = 'Aufruf: npm run ansicht -- --name <kurzname> <abschnitt-id> [--folien 16,19-23]';

let geladen: Awaited<ReturnType<typeof ladePdfjs>>;
let vorlage = '';

beforeAll(async () => {
  geladen = await ladePdfjs();
  vorlage = mkdtempSync(path.join(tmpdir(), 'kernbohrung-ansicht-vorlage-'));
  await leseFolienEin({
    orte: [path.join(FIXTUREN, 'folien-agenda.pdf')],
    kurzname: KURZNAME,
    titel: 'Fixture Ansicht',
    wurzel: vorlage,
    gestempeltAm: STEMPEL,
    geladen,
  });
});

afterAll(() => {
  if (vorlage) rmSync(vorlage, { recursive: true, force: true });
});

/** Eine eigene Kopie der eingelesenen Vorlage. */
function kopie(): string {
  const wurzel = mkdtempSync(path.join(tmpdir(), 'kernbohrung-ansicht-'));
  cpSync(vorlage, wurzel, { recursive: true });
  return wurzel;
}

/** Ein Pfad unter `quellen/<k>/` der Kopie. */
const quelle = (wurzel: string, ...teile: string[]) => path.join(wurzel, 'quellen', KURZNAME, ...teile);

/** Der Abbruch eines Laufs — damit sein Wortlaut ganz geprueft werden kann und nicht nur ein Stueck davon. */
async function abbruch(lauf: Promise<unknown>): Promise<Error> {
  try {
    await lauf;
  } catch (fehler) {
    return fehler as Error;
  }
  throw new Error('Erwartet war ein Abbruch.');
}

/** Dasselbe fuer einen Aufruf ohne Promise. */
function wurf(aufruf: () => unknown): Error {
  try {
    aufruf();
  } catch (fehler) {
    return fehler as Error;
  }
  throw new Error('Erwartet war ein Abbruch.');
}

/** Breite und Hoehe aus dem IHDR, dem ersten Block hinter der Signatur. */
function ihdr(png: Buffer): [number, number] {
  expect(png.toString('latin1', 12, 16)).toBe('IHDR');
  return [png.readUInt32BE(16), png.readUInt32BE(20)];
}

/** Der Anteil der Pixel, die nicht fast weiss sind. Ein leeres Bild hat 0. */
async function anteilNichtWeiss(png: Buffer): Promise<number> {
  const bild = await loadImage(png);
  const leinwand = createCanvas(bild.width, bild.height);
  const kontext = leinwand.getContext('2d');
  kontext.drawImage(bild, 0, 0);
  const pixel = kontext.getImageData(0, 0, bild.width, bild.height).data;
  let nichtWeiss = 0;
  for (let i = 0; i < pixel.length; i += 4) {
    if (pixel[i] < 240 || pixel[i + 1] < 240 || pixel[i + 2] < 240) nichtWeiss++;
  }
  return nichtWeiss / (pixel.length / 4);
}

describe('rendereFolien', () => {
  it('rendert eine Folie als PNG, und das IHDR traegt die Masse aus dem Ergebnis', async () => {
    const wurzel = kopie();
    try {
      const { bilder } = await rendereFolien({ wurzel, kurzname: KURZNAME, abschnitt: ABSCHNITT, folien: '14', geladen });
      expect(bilder).toEqual([
        { folie: 14, pfad: quelle(wurzel, 'ansicht', ABSCHNITT, 'folie-14.png'), breite: 1263, hoehe: 893 },
      ]);
      const png = readFileSync(bilder[0].pfad);
      expect([...png.subarray(0, 8)]).toEqual(PNG_SIGNATUR);
      expect(ihdr(png)).toEqual([bilder[0].breite, bilder[0].hoehe]);
      // Gerendert, nicht bloss angelegt: Ein leeres Bild haette dieselbe
      // Signatur und dieselben Masse.
      expect(await anteilNichtWeiss(png)).toBeGreaterThan(0.005);
      expect(readdirSync(quelle(wurzel, 'ansicht', ABSCHNITT))).toEqual(['folie-14.png']);
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });

  it('rendert ohne Auswahl alle Folien des Abschnitts', async () => {
    const wurzel = kopie();
    try {
      const { bilder } = await rendereFolien({ wurzel, kurzname: KURZNAME, abschnitt: ABSCHNITT, geladen });
      expect(bilder.map((b) => b.folie)).toEqual([11, 12, 13, 14, 15, 16, 17, 18]);
      expect(readdirSync(quelle(wurzel, 'ansicht', ABSCHNITT)).sort()).toEqual(
        bilder.map((b) => `folie-${b.folie}.png`).sort(),
      );
      for (const bild of bilder) expect(ihdr(readFileSync(bild.pfad))).toEqual([1263, 893]);
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });

  it('rendert in der verlangten Skala', async () => {
    const wurzel = kopie();
    try {
      const { bilder } = await rendereFolien({ wurzel, kurzname: KURZNAME, abschnitt: ABSCHNITT, folien: '11', geladen, skala: 1 });
      expect(bilder.map((b) => [b.breite, b.hoehe])).toEqual([[842, 595]]);
      expect(ihdr(readFileSync(bilder[0].pfad))).toEqual([842, 595]);
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });
});

describe('folienAuswahl', () => {
  it('liest Zahlen und Bereiche, aufsteigend und jede Folie einmal', () => {
    expect(folienAuswahl('2,4-5', [1, 10])).toEqual([2, 4, 5]);
    expect(folienAuswahl('16,19-23', [16, 23])).toEqual([16, 19, 20, 21, 22, 23]);
    expect(folienAuswahl(' 5, 2 ,2', [1, 10])).toEqual([2, 5]);
    // Mit Halbgeviertstrich, wie die Werkzeuge einen Bereich selbst schreiben („Folien 11–18").
    expect(folienAuswahl('3–4', [1, 10])).toEqual([3, 4]);
  });

  it('weist eine Folie ausserhalb des Abschnitts ab', () => {
    for (const [angabe, folie] of [
      ['11', 11],
      ['0', 0],
      ['2,9-12', 12],
      ['0-3', 0],
    ] as const) {
      const fehler = wurf(() => folienAuswahl(angabe, [1, 10]));
      expect(fehler).toBeInstanceOf(AnsichtFehler);
      expect(fehler.message).toBe(`Folie ${folie} liegt nicht in diesem Abschnitt (Folien 1–10).`);
    }
  });

  it('weist eine Angabe ab, die es nicht lesen kann', () => {
    for (const angabe of ['x', '', '3-', '-3', '5-3', '1,,2', '2,', '1.5', '1 2', '1-2-3']) {
      const fehler = wurf(() => folienAuswahl(angabe, [1, 10]));
      expect(fehler).toBeInstanceOf(AnsichtFehler);
      expect(fehler.message).toBe('--folien versteht Angaben wie 16,19-23.');
    }
  });
});

describe('rendereFolien - was fehlt', () => {
  it('meldet ein fehlendes Manifest', async () => {
    const wurzel = kopie();
    try {
      const fehler = await abbruch(rendereFolien({ wurzel, kurzname: 'nicht-eingelesen', abschnitt: ABSCHNITT, geladen }));
      expect(fehler).toBeInstanceOf(AnsichtFehler);
      expect(fehler.message).toBe('quellen/nicht-eingelesen/manifest.json gibt es nicht — erst einlesen.');
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });

  it('meldet ein Manifest, das sich nicht lesen laesst, mit dem Grund', async () => {
    const wurzel = kopie();
    try {
      writeFileSync(quelle(wurzel, 'manifest.json'), '{ "fassung": 3,', 'utf8');
      const fehler = await abbruch(rendereFolien({ wurzel, kurzname: KURZNAME, abschnitt: ABSCHNITT, geladen }));
      expect(fehler).toBeInstanceOf(AnsichtFehler);
      expect(fehler.message).toBe('quellen/fixture-ansicht/manifest.json lässt sich nicht lesen (kein gültiges JSON).');
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });

  it('meldet einen Abschnitt, den das Manifest nicht kennt', async () => {
    const wurzel = kopie();
    try {
      const fehler = await abbruch(rendereFolien({ wurzel, kurzname: KURZNAME, abschnitt: 'd09-99-gibt-es-nicht', geladen }));
      expect(fehler).toBeInstanceOf(AnsichtFehler);
      expect(fehler.message).toBe('Abschnitt d09-99-gibt-es-nicht gibt es im Manifest nicht.');
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });

  it('meldet ein fehlendes Original', async () => {
    const wurzel = kopie();
    try {
      rmSync(quelle(wurzel, 'original', 'folien-agenda.pdf'));
      const fehler = await abbruch(rendereFolien({ wurzel, kurzname: KURZNAME, abschnitt: ABSCHNITT, geladen }));
      expect(fehler).toBeInstanceOf(AnsichtFehler);
      expect(fehler.message).toBe('Das Original folien-agenda.pdf fehlt unter quellen/fixture-ansicht/original/.');
      expect(existsSync(quelle(wurzel, 'ansicht'))).toBe(false);
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });

  it('prueft die Auswahl gegen die Folien des Abschnitts und legt vorher nichts an', async () => {
    const wurzel = kopie();
    try {
      const fehler = await abbruch(rendereFolien({ wurzel, kurzname: KURZNAME, abschnitt: ABSCHNITT, folien: '9', geladen }));
      expect(fehler).toBeInstanceOf(AnsichtFehler);
      expect(fehler.message).toBe('Folie 9 liegt nicht in diesem Abschnitt (Folien 11–18).');
      expect(existsSync(quelle(wurzel, 'ansicht'))).toBe(false);
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });

  it('sagt, was fehlt, wenn sich @napi-rs/canvas nicht laden laesst', async () => {
    const wurzel = kopie();
    try {
      // Das Paket fehlt ganz, oder nur sein Binaerteil fuer diese Plattform.
      const fehlt = [
        Object.assign(new Error("Cannot find package '@napi-rs/canvas'"), { code: 'ERR_MODULE_NOT_FOUND' }),
        new Error('Cannot find native binding. npm has a bug related to optional dependencies.'),
      ];
      for (const grund of fehlt) {
        const fehler = await abbruch(
          rendereFolien({ wurzel, kurzname: KURZNAME, abschnitt: ABSCHNITT, geladen, ladeCanvas: () => Promise.reject(grund) }),
        );
        expect(fehler).toBeInstanceOf(AnsichtFehler);
        expect(fehler.message).toBe(
          'Zum Ansehen fehlt @napi-rs/canvas — es kommt mit pdfjs-dist; bitte npm install ausführen.',
        );
      }
      // Ein anderer Fehler beim Laden ist keiner, den npm install behebt: Er geht als Stapelabzug durch.
      const programmfehler = new TypeError('ein Fehler im Programm');
      const fehler = await abbruch(
        rendereFolien({ wurzel, kurzname: KURZNAME, abschnitt: ABSCHNITT, geladen, ladeCanvas: () => Promise.reject(programmfehler) }),
      );
      expect(fehler).toBe(programmfehler);
      expect(existsSync(quelle(wurzel, 'ansicht'))).toBe(false);
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });

  it('schreibt nur unter quellen/<k>/ansicht/ — Kurzname und Abschnitt muessen Ids sein', async () => {
    const wurzel = kopie();
    try {
      const fremd = await abbruch(rendereFolien({ wurzel, kurzname: '../fremd', abschnitt: ABSCHNITT, geladen }));
      expect(fremd).toBeInstanceOf(AnsichtFehler);
      expect(fremd.message).toBe('--name ../fremd: nur Kleinbuchstaben, Ziffern und Bindestrich.');

      // Auch ein Manifest, das einen Pfad als Id fuehrt, lenkt die Bilder nicht aus dem Ordner.
      const manifest = JSON.parse(readFileSync(quelle(wurzel, 'manifest.json'), 'utf8'));
      manifest.roh[1].id = '../../ausserhalb';
      writeFileSync(quelle(wurzel, 'manifest.json'), JSON.stringify(manifest), 'utf8');
      const ausserhalb = await abbruch(rendereFolien({ wurzel, kurzname: KURZNAME, abschnitt: '../../ausserhalb', geladen }));
      expect(ausserhalb).toBeInstanceOf(AnsichtFehler);
      expect(ausserhalb.message).toBe('Abschnitt ../../ausserhalb gibt es im Manifest nicht.');

      expect(readdirSync(wurzel).sort()).toEqual(['lehrplan', 'quellen']);
      expect(readdirSync(quelle(wurzel)).sort()).toEqual(['manifest.json', 'original', 'roh']);
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });
});

describe('fuehreAus', () => {
  async function lauf(argv: string[], wurzel: string): Promise<{ code: number; zeilen: string[] }> {
    const zeilen: string[] = [];
    const code = await fuehreAus(argv, wurzel, (zeile: string) => zeilen.push(zeile));
    return { code, zeilen };
  }

  it('meldet das Bild mit Pfad und Massen und am Ende die Zahl in der Einzahl, Exit 0', async () => {
    const wurzel = kopie();
    try {
      const { code, zeilen } = await lauf(['--name', KURZNAME, ABSCHNITT, '--folien', '14'], wurzel);
      expect(code).toBe(0);
      expect(zeilen).toEqual([
        'quellen/fixture-ansicht/ansicht/d01-02-kosten-und-termine/folie-14.png — 1263 × 893',
        '1 Folie gerendert.',
      ]);
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });

  it('meldet jedes Bild und am Ende die Zahl in der Mehrzahl, Exit 0', async () => {
    const wurzel = kopie();
    try {
      // Die Reihenfolge der Argumente ist frei.
      const { code, zeilen } = await lauf(['--folien', '12-13', '--name', KURZNAME, ABSCHNITT], wurzel);
      expect(code).toBe(0);
      expect(zeilen).toEqual([
        'quellen/fixture-ansicht/ansicht/d01-02-kosten-und-termine/folie-12.png — 1263 × 893',
        'quellen/fixture-ansicht/ansicht/d01-02-kosten-und-termine/folie-13.png — 1263 × 893',
        '2 Folien gerendert.',
      ]);
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });

  it('zeigt die Aufruf-Hilfe und bricht mit 2 ab, wenn etwas fehlt, doppelt oder fremd ist', async () => {
    const wurzel = kopie();
    try {
      for (const argv of [
        [],
        [ABSCHNITT],
        ['--name', KURZNAME],
        ['--name'],
        ['--name', '--folien', '14', ABSCHNITT],
        ['--name', KURZNAME, ABSCHNITT, 'd01-03-risiken-im-projekt'],
        ['--name', KURZNAME, ABSCHNITT, '--folien'],
        ['--name', KURZNAME, ABSCHNITT, '--skala', '2'],
      ]) {
        const { code, zeilen } = await lauf(argv, wurzel);
        expect(code).toBe(2);
        expect(zeilen).toEqual([AUFRUF]);
      }
      expect(existsSync(quelle(wurzel, 'ansicht'))).toBe(false);
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });

  it('meldet einen Fehler als eine Zeile und bricht mit 1 ab', async () => {
    const wurzel = kopie();
    try {
      for (const [argv, meldung] of [
        [['--name', KURZNAME, 'd09-99-gibt-es-nicht'], 'Abschnitt d09-99-gibt-es-nicht gibt es im Manifest nicht.'],
        [['--name', KURZNAME, ABSCHNITT, '--folien', 'x'], '--folien versteht Angaben wie 16,19-23.'],
        [['--name', KURZNAME, ABSCHNITT, '--folien', '19'], 'Folie 19 liegt nicht in diesem Abschnitt (Folien 11–18).'],
        [['--name', 'nicht-eingelesen', ABSCHNITT], 'quellen/nicht-eingelesen/manifest.json gibt es nicht — erst einlesen.'],
      ] as const) {
        const { code, zeilen } = await lauf([...argv], wurzel);
        expect(code).toBe(1);
        expect(zeilen).toEqual([meldung]);
      }
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });
});
