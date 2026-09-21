// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

/**
 * Derselbe Vertrag wie in `tests/node-ladbarkeit.test.ts`, fuer die Aufgaben.
 *
 * `werkzeug/pruefe-lektion.mjs` laedt `src/content/schema.ts` unter reinem
 * Node, und das zieht ab Aufgabe 12 diese Union mit. Ein einziger relativer
 * Import ohne Dateiendung genuegt, und der Compiler kann keine Lektion mehr
 * pruefen — waehrend unter Vite alles gruen weiterlaeuft.
 */

const wurzel = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const modulUrl = pathToFileURL(path.join(wurzel, 'src', 'aufgaben', 'schema.ts')).href;

describe('aufgaben/schema.ts aus einem reinen Node-Prozess', () => {
  it('laesst sich ohne Astro, Vite und Vitest laden und weist Unsinn ab', () => {
    const skript = `
      const { AufgabeSchema, AUFGABENTYPEN } = await import(${JSON.stringify(modulUrl)});
      const unsinn = AufgabeSchema.safeParse({ typ: 'gibt-es-nicht', id: 'x' });
      const gut = AufgabeSchema.safeParse({ typ: 'reihenfolge', id: 'r', aufgabe: 'Ordne.', schritte: ['a', 'b', 'c'] });
      process.stdout.write(JSON.stringify({ typen: [...AUFGABENTYPEN], unsinn: unsinn.success, gut: gut.success }));
    `;
    const ausgabe = execFileSync(process.execPath, ['--input-type=module', '-e', skript], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    expect(JSON.parse(ausgabe)).toEqual({
      typen: ['wahl', 'fall', 'zuordnen', 'reihenfolge'],
      unsinn: false,
      gut: true,
    });
  });
});
