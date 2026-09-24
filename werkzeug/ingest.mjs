#!/usr/bin/env node
/**
 * Einlesen — die Weiche zwischen den Wegen.
 *
 *   npm run ingest -- --git <url> --pfad <unterpfad> --name <kurzname>
 *   npm run ingest -- --folien <pfad> [--folien <pfad> …] --name <kurzname> --titel "<Titel>" [--art folien]
 *
 * Der Git-Weg ist derselbe geblieben; sein Code steht unveraendert in
 * `ingest-git.mjs`. Der Folien-Weg kam mit Teilprojekt 2b dazu. Welcher Weg
 * gemeint ist, sagt das erste Argument, das da ist — geraten wird nichts:
 * Fehlen beide, kommt die Hilfe und kein halber Lauf.
 *
 * Nicht alles wartet auf diese Entscheidung: `argumente` unten ist ein
 * statischer Import, und der laedt `ingest-folien.mjs` samt Folien-Zweig und
 * zod immer mit hoch — auch bei einem reinen Git-Lauf. Erst der Rest des
 * gewaehlten Wegs kommt per `await import(...)`, und pdf.js laedt `ladePdfjs`
 * ohnehin erst bei Bedarf. So zieht ein Git-Lauf pdf.js nicht mit hoch, und
 * ein Folien-Lauf klont nichts.
 */
import { argumente } from './ingest-folien.mjs';

const argv = process.argv.slice(2);
const folien = argumente(argv, 'folien');
const git = argumente(argv, 'git');

if (folien.length > 0 && git.length > 0) {
  console.error('--git und --folien zusammen geht nicht. Eine Quelle hat eine Herkunft.');
  process.exitCode = 2;
} else if (folien.length > 0) {
  const { fuehreAus } = await import('./ingest-folien.mjs');
  process.exitCode = await fuehreAus(argv, process.cwd());
} else if (git.length > 0) {
  await import('./ingest-git.mjs');
} else {
  console.error(
    'Aufruf, je nach Herkunft:\n' +
      '  npm run ingest -- --git <url> --pfad <unterpfad> --name <kurzname>\n' +
      '  npm run ingest -- --folien <pfad> [--folien <pfad> …] --name <kurzname> --titel "<Titel>" [--art folien]\n' +
      '\n' +
      '  <pfad> ist eine PDF-Datei oder eine Mappe (dann alle .pdf darin, in natürlicher Reihenfolge).\n' +
      '  Bücher und EPUB liest diese Fassung noch nicht ein.',
  );
  process.exitCode = 2;
}
