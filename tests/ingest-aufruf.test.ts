// @vitest-environment node
import { beforeAll, describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ladePdfjs } from '../werkzeug/adapter/dokument.mjs';
import { argumente, bericht, fuehreAus } from '../werkzeug/ingest-folien.mjs';

/**
 * Der Aufruf: was auf der Kommandozeile steht und was auf der Konsole landet.
 *
 * Der wichtigste Test hier ist der letzte: **kein Folientext auf der
 * Konsole.** Das Material gehoert seinen Verfassern. Gemeldet werden Zahlen,
 * Dateinamen, Abschnitt-Ids und Abschnittstitel — die stehen ohnehin im
 * Lehrplan, den ein Mensch lesen muss.
 */
const WURZEL = path.resolve(__dirname, '..');
const FIXTUREN = path.join(WURZEL, 'tests', 'fixtures');

function temp(): string {
  const ordner = mkdtempSync(path.join(tmpdir(), 'kernbohrung-ingest-'));
  mkdirSync(path.join(ordner, 'lehrplan'), { recursive: true });
  return ordner;
}

/** Sammelt die Ausgabe eines Laufs statt sie zu drucken. */
async function lauf(argv: string[], wurzel: string): Promise<{ code: number; zeilen: string[] }> {
  const zeilen: string[] = [];
  const code = await fuehreAus(argv, wurzel, (zeile: string) => zeilen.push(zeile));
  return { code, zeilen };
}

/**
 * pdf.js einmal vorab laden (Vorspann-Regel 20): `fuehreAus` laedt es ueber
 * `leseFolienEin` intern selbst, ohne ein `geladen` entgegenzunehmen — hier
 * genuegt ein Vorwaermen, der Modul-Cache von Node sorgt dafuer, dass ein
 * Aufruf danach nichts mehr laedt.
 */
beforeAll(() => ladePdfjs());

describe('argumente', () => {
  it('sammelt ein mehrfach genanntes Argument in der Reihenfolge der Zeile', () => {
    expect(argumente(['--folien', 'a', '--name', 'x', '--folien', 'b'], 'folien')).toEqual(['a', 'b']);
  });

  it('uebergeht ein Argument ohne Wert', () => {
    expect(argumente(['--titel'], 'titel')).toEqual([]);
    expect(argumente(['--titel', '--name', 'x'], 'titel')).toEqual([]);
  });
});

describe('fuehreAus', () => {
  it('verlangt Kurzname und Titel und zeigt sonst den Aufruf', async () => {
    const { code, zeilen } = await lauf(['--folien', path.join(FIXTUREN, 'folien-agenda.pdf')], WURZEL);
    expect(code).toBe(2);
    expect(zeilen[0]).toBe('--name und --titel sind Pflicht.');
    expect(zeilen.join('\n')).toContain('--folien <pfad>');
  });

  it('kennt nur --art folien', async () => {
    const { code, zeilen } = await lauf(['--folien', 'x', '--name', 'y', '--titel', 'T', '--art', 'buch'], WURZEL);
    expect(code).toBe(2);
    expect(zeilen[0]).toBe('--art buch kennt diese Fassung nicht. Erlaubt ist nur --art folien.');
  });

  it('meldet einen Abbruch als Zeile, nicht als Stapelabzug', async () => {
    const wurzel = temp();
    try {
      const { code, zeilen } = await lauf(
        ['--folien', path.join(FIXTUREN, 'buch-hochformat.pdf'), '--name', 'x', '--titel', 'T'],
        wurzel,
      );
      expect(code).toBe(1);
      expect(zeilen).toHaveLength(1);
      expect(zeilen[0]).toMatch(/^Bücher liest diese Fassung noch nicht ein/);
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });

  it('meldet ein kaputtes PDF als eine Zeile mit Dateinamen, nicht als Stapelabzug', async () => {
    const wurzel = temp();
    try {
      const kaputt = path.join(wurzel, 'kaputt.pdf');
      writeFileSync(kaputt, 'x');
      const { code, zeilen } = await lauf(['--folien', kaputt, '--name', 'x', '--titel', 'T'], wurzel);
      expect(code).toBe(1);
      expect(zeilen).toEqual(['kaputt.pdf: lässt sich nicht als PDF lesen (Invalid PDF structure.).']);
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });

  it('berichtet Zahlen, Dateien, Ids und Titel — und keinen Folientext', async () => {
    const wurzel = temp();
    try {
      const { code, zeilen } = await lauf(
        [
          '--folien',
          path.join(FIXTUREN, 'folien-agenda.pdf'),
          '--folien',
          path.join(FIXTUREN, 'folien-laeufe.pdf'),
          '--name',
          'fixture-vorlesung',
          '--titel',
          'Fixture-Vorlesung',
        ],
        wurzel,
      );
      expect(code).toBe(0);
      const text = zeilen.join('\n');
      expect(zeilen[1]).toBe('2 Originale, 51 Seiten, 9 Abschnitte.');
      expect(zeilen[2]).toBe(
        '  folien-agenda.pdf — 26 Seiten · agenda · Beiwerk 36,2 % · 1 nur Bild · 1 mit Tabelle oder Grafik',
      );
      expect(text).toContain('  d01-01-grundlagen-der-planung — folien-agenda.pdf, Folien 1–10 — Grundlagen der Planung');
      expect(text).toContain('lehrplan/fixture-vorlesung.yaml — angelegt, wartet auf Freigabe.');

      // Kein Satz aus dem Inhalt der Folien — nur das, was auch im Lehrplan steht.
      const rohtext = readFileSync(
        path.join(wurzel, 'quellen', 'fixture-vorlesung', 'roh', 'd01-01-grundlagen-der-planung.md'),
        'utf8',
      );
      const saetze = rohtext
        .split('\n')
        .filter((z) => z.startsWith('• '))
        .map((z) => z.slice(2));
      expect(saetze.length).toBeGreaterThan(0);
      for (const satz of saetze) expect(text).not.toContain(satz);
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });

  it('laesst einen vorhandenen Lehrplan stehen und meldet den Vergleich', async () => {
    const wurzel = temp();
    const argv = [
      '--folien',
      path.join(FIXTUREN, 'folien-agenda.pdf'),
      '--name',
      'fixture-vorlesung',
      '--titel',
      'Fixture-Vorlesung',
    ];
    try {
      await lauf(argv, wurzel);
      const { code, zeilen } = await lauf(argv, wurzel);
      expect(code).toBe(0);
      expect(zeilen.at(-2)).toBe('  lehrplan/fixture-vorlesung.yaml — liegt schon da und bleibt unverändert.');
      expect(zeilen.at(-1)).toBe('    keine Änderung');
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });
});

describe('bericht', () => {
  it('nennt eine Warnung ueber der Beiwerkschwelle eigens', () => {
    const zeilen = bericht(
      {
        kurzname: 'q',
        stand: `sha256:${'a'.repeat(64)}`,
        originale: [
          {
            datei: 'M2.pdf',
            dateiHash: `sha256:${'a'.repeat(64)}`,
            seiten: 29,
            gliederung: 'agenda',
            beiwerkZeichen: 5907,
            beiwerkAnteil: 0.702,
            nurBild: [4, 5],
            tabellenverdacht: [16],
          },
        ],
        abschnitte: [{ id: 'm02-01-x', titel: 'X', datei: 'M2.pdf', seiten: [1, 29] }],
        warnungen: ['M2.pdf: 70,2 % des Texts als Beiwerk entfernt — vermutlich stimmt etwas mit der Extraktion nicht.'],
        lehrplan: { pfad: path.join('/w', 'lehrplan', 'q.yaml'), geschrieben: true, vergleich: null },
      },
      '/w',
    );
    expect(zeilen).toContain(
      '  M2.pdf — 29 Seiten · agenda · Beiwerk 70,2 % · 2 nur Bild · 1 mit Tabelle oder Grafik',
    );
    expect(zeilen).toContain(
      'Warnung: M2.pdf: 70,2 % des Texts als Beiwerk entfernt — vermutlich stimmt etwas mit der Extraktion nicht.',
    );
    expect(zeilen).toContain('  m02-01-x — M2.pdf, Folien 1–29 — X');
  });
});

describe('werkzeug/ingest.mjs', () => {
  /** Startet die Weiche und liefert Rueckgabewert und Fehlerausgabe. */
  function weiche(...argv: string[]): { code: number; ausgabe: string } {
    try {
      execFileSync(process.execPath, [path.join(WURZEL, 'werkzeug', 'ingest.mjs'), ...argv], {
        encoding: 'utf8',
        stdio: 'pipe',
      });
      return { code: 0, ausgabe: '' };
    } catch (fehler) {
      const f = fehler as { status: number; stderr: string };
      return { code: f.status, ausgabe: f.stderr };
    }
  }

  it('weist --git und --folien zusammen zurueck', () => {
    // Eine Quelle hat eine Herkunft. Geraten wird nichts.
    const { code, ausgabe } = weiche('--git', 'https://x/y.git', '--folien', 'a.pdf', '--name', 'z');
    expect(code).toBe(2);
    expect(ausgabe).toContain('--git und --folien zusammen geht nicht. Eine Quelle hat eine Herkunft.');
  });

  it('zeigt ohne Argument beide Wege und bricht mit 2 ab', () => {
    const { code, ausgabe } = weiche();
    expect(code).toBe(2);
    expect(ausgabe).toContain('npm run ingest -- --git <url> --pfad <unterpfad> --name <kurzname>');
    expect(ausgabe).toContain('npm run ingest -- --folien <pfad>');
    expect(ausgabe).toContain('Bücher und EPUB liest diese Fassung noch nicht ein.');
  });
});
