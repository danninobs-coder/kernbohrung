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
 *
 * Zweiter Fall weiter unten: `src/content/schema.ts` selbst, das den Import
 * oben ueberhaupt erst braucht. Eine Mutationsprobe hat gezeigt, dass ohne
 * diesen zweiten Fall keine der bestehenden Dateien den Verlust der Endung an
 * genau dieser Importzeile bemerkt.
 */

const wurzel = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const modulUrl = pathToFileURL(path.join(wurzel, 'src', 'aufgaben', 'schema.ts')).href;
const modulUrlLektion = pathToFileURL(path.join(wurzel, 'src', 'content', 'schema.ts')).href;

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

/**
 * Dieselbe minimale Lektion wie in `tests/content-schema.test.ts`, hier aber
 * als reine Werte: Der Unterprozess bekommt sie per JSON.stringify mit, ohne
 * Hilfsfunktionen aus dieser Datei mitzuschleppen.
 */
function antwortWert(text: string, richtig: boolean) {
  return {
    text,
    richtig,
    begruendung: `Begruendung zu ${text} mit genug Woertern darin.`,
  };
}

function wahlWert(id: string) {
  return {
    typ: 'wahl',
    id,
    frage: 'Was sortiert ein Reranker?',
    antworten: [
      antwortWert('Die Kandidaten', true),
      antwortWert('Den Index', false),
      antwortWert('Die Anfrage', false),
    ],
  };
}

const gueltigeLektion = {
  titel: 'Eine Lektion',
  prinzip: 'Recall entsteht beim Holen, Precision beim Sortieren.',
  reihenfolge: 1,
  aufgaben: [wahlWert('f-1'), wahlWert('f-2')],
  transfer: wahlWert('f-transfer'),
  quellen: [{ pfad: 'rag_tutorials/hybrid_search_rag' }],
};

// Wie die gueltige Lektion, aber `aufgaben` weicht dem alten Feld `fragen` —
// derselbe Griff wie in tests/content-schema.test.ts.
const { aufgaben: _aufgaben, ...lektionOhneAufgaben } = gueltigeLektion;
const lektionMitAltemFeld = { ...lektionOhneAufgaben, fragen: [wahlWert('f-1'), wahlWert('f-2')] };

describe('content/schema.ts aus einem reinen Node-Prozess', () => {
  it('laesst sich ohne Astro, Vite und Vitest laden, nimmt eine gueltige Lektion an und weist das alte Feld fragen zurueck', () => {
    const skript = `
      const { LektionSchema } = await import(${JSON.stringify(modulUrlLektion)});
      const gut = LektionSchema.safeParse(${JSON.stringify(gueltigeLektion)});
      const altesFeld = LektionSchema.safeParse(${JSON.stringify(lektionMitAltemFeld)});
      process.stdout.write(JSON.stringify({ gut: gut.success, altesFeld: altesFeld.success }));
    `;
    const ausgabe = execFileSync(process.execPath, ['--input-type=module', '-e', skript], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    expect(JSON.parse(ausgabe)).toEqual({ gut: true, altesFeld: false });
  });
});
