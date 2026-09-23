// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { FIXTURES, erzeugeFixtures } from '../werkzeug/fixtures/erzeuge.mjs';

/**
 * Die Test-PDFs liegen committet unter `tests/fixtures/` — und sind
 * herstellbar.
 *
 * Beides zusammen ist der Punkt: Committet, damit ein Testlauf keine PDFs
 * bauen muss; herstellbar, damit niemand raten muss, was in ihnen steckt. Der
 * Test erzeugt sie in ein Temp-Verzeichnis und vergleicht Byte fuer Byte.
 * Schlaegt er fehl, ist entweder das Skript nicht mehr deterministisch (feste
 * Zeitstempel, fester Producer, `useObjectStreams: false`) oder die
 * committeten Dateien sind nicht mehr die, die es erzeugt.
 *
 * Umgebung `node`: Das Skript schreibt Dateien und laedt `pdf-lib`.
 */
const WURZEL = path.resolve(__dirname, '..');
const FIXTUREORDNER = path.join(WURZEL, 'tests', 'fixtures');

describe('werkzeug/fixtures/erzeuge.mjs', () => {
  it('erzeugt genau die committeten Dateien, Byte fuer Byte gleich', async () => {
    const temp = mkdtempSync(path.join(tmpdir(), 'kernbohrung-fixtures-'));
    try {
      const groessen = await erzeugeFixtures(temp);
      expect([...groessen.keys()]).toEqual([...FIXTURES]);
      for (const name of FIXTURES) {
        const erzeugt = readFileSync(path.join(temp, name));
        const committet = readFileSync(path.join(FIXTUREORDNER, name));
        // Erst die Laenge: Ein Unterschied von zwei Bytes soll nicht als
        // Vergleich zweier 28-KB-Puffer in der Ausgabe landen.
        expect(`${name}: ${erzeugt.length} Bytes`).toBe(`${name}: ${committet.length} Bytes`);
        expect(erzeugt.equals(committet), `${name} weicht ab`).toBe(true);
      }
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  });

  it('haelt den Fixtureordner frei von allem, was das Skript nicht schreibt', () => {
    expect(readdirSync(FIXTUREORDNER).sort()).toEqual([...FIXTURES].sort());
  });
});
