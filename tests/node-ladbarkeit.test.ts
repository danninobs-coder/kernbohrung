// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

/**
 * Der Vertrag, auf dem Abschnitt 2 aufbaut.
 *
 * Der Compiler soll erzeugte Widget-Parameter pruefen, BEVOR er eine Lektion
 * schreibt. Er laeuft dabei als gewoehnlicher Node-Prozess - ohne Astro, ohne
 * Vite, ohne Vitest. `src/widgets/pruefung.ts` muss dort ladbar sein.
 *
 * Genau das ist leicht zu verlieren, ohne dass es auffaellt: Ein Import auf
 * `astro:content`, eine `.astro`-Datei oder auch nur ein relativer Import ohne
 * Dateiendung genuegt. Unter Vite und Astro laeuft danach alles weiter gruen,
 * nur der Compiler koennte die Datei nicht mehr oeffnen. Dieser Test faehrt
 * deshalb einen echten Node-Unterprozess und laesst ihn die Datei benutzen.
 */

const wurzel = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const modulUrl = pathToFileURL(path.join(wurzel, 'src', 'widgets', 'pruefung.ts')).href;

/** Zwei zuschaltbare Schritte, aber nur ein Ergebnis - drei Kombinationen fehlen. */
const mitLuecke = {
  einheit: 'Dokument',
  schritte: [
    { id: 'suche', titel: 'Suche', wirkung: 'Holt Kandidaten.' },
    { id: 'bm25', titel: 'BM25', wirkung: 'Sucht woertlich.', optional: true, standardAn: false },
    { id: 'rerank', titel: 'Reranker', wirkung: 'Sortiert um.', optional: true, standardAn: false },
  ],
  ergebnisse: [{ wenn: [], ausgabe: [{ text: 'A', treffer: false }], hinweis: 'ohne' }],
};

function inNodeAusfuehren(): {
  namen: string[];
  luecke: { ok: boolean; maengel: string[] };
  unbekannt: { ok: boolean; maengel: string[] };
} {
  const skript = `
    const { pruefeWidget, widgetPruefungen } = await import(${JSON.stringify(modulUrl)});
    const mitLuecke = ${JSON.stringify(mitLuecke)};
    const norm = (r) => ({ ok: r.ok, maengel: r.ok ? [] : [...r.maengel] });
    process.stdout.write(JSON.stringify({
      namen: Object.keys(widgetPruefungen),
      luecke: norm(pruefeWidget('Pipeline', mitLuecke)),
      unbekannt: norm(pruefeWidget('GibtEsNicht', {})),
    }));
  `;

  const ausgabe = execFileSync(process.execPath, ['--input-type=module', '-e', skript], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  return JSON.parse(ausgabe);
}

describe('pruefung.ts aus einem reinen Node-Prozess', () => {
  it('laesst sich ohne Astro, Vite und Vitest laden und benutzen', () => {
    const ergebnis = inNodeAusfuehren();

    expect(ergebnis.namen).toContain('Pipeline');

    // Die Luecke findet nur die Zusatzpruefung, nicht das Schema selbst -
    // sie muss also den Sprung ueber die Modulgrenze mitmachen.
    expect(ergebnis.luecke.ok).toBe(false);
    expect(ergebnis.luecke.maengel.join(' ')).toMatch(/Kombination/i);

    // Ein unbekannter Name darf nicht stillschweigend durchgehen: Der Compiler
    // erzeugt den Widget-Namen selbst und kann sich vertippen.
    expect(ergebnis.unbekannt.ok).toBe(false);
    expect(ergebnis.unbekannt.maengel.join(' ')).toMatch(/GibtEsNicht/);
  });
});
