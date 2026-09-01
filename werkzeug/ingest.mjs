#!/usr/bin/env node
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { hole } from './adapter/git.mjs';
import { baueManifest } from './manifest.mjs';
import { RUBRIK } from './auswahl.mjs';

/**
 * Bereitet eine Quelle so auf, dass der Destillat-Durchgang damit arbeiten kann.
 *
 * Eine Datei je Variante, nicht je Quelldatei: Eine Variante ist die kleinste
 * Einheit, die fuer sich einen Gedanken traegt. README und Code gehoeren
 * zusammengelesen — in vier von vierundzwanzig Faellen erklaert die README das
 * Verfahren, sonst steht es nur im Code.
 *
 * @typedef {import('./auswahl.mjs').Mitnehmen} Mitnehmen
 */

/**
 * @param {string} name
 * @param {string} [standard]
 * @returns {string | undefined}
 */
function argument(name, standard) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : standard;
}

const url = argument('git');
const unterpfad = argument('pfad', '') ?? '';
const kurzname = argument('name');

if (!url || !kurzname) {
  console.error(
    'Aufruf: npm run ingest -- --git <url> --pfad <unterpfad> --name <kurzname>\n' +
      'Beispiel: npm run ingest -- --git https://github.com/Shubhamsaboo/awesome-llm-apps.git \\\n' +
      '            --pfad rag_tutorials --name awesome-llm-apps',
  );
  process.exit(2);
}

const wurzel = process.cwd();
const quellordner = path.join(wurzel, 'quellen', kurzname);
const arbeitsklon = path.join(quellordner, '.klon');

const { herkunft, urteile, lies } = await hole({
  url,
  unterpfad,
  ziel: arbeitsklon,
  protokoll: (z) => console.log(`  ${z}`),
});

const uebernommen = urteile.filter((u) => u.mitnehmen);

/**
 * Gruppiert die uebernommenen Dateien zu Varianten.
 *
 * Der Name kommt aus dem Pfad: `rag_tutorials/corrective_rag/README.md` wird
 * zu `corrective_rag`. Das gilt hier fuer jede Datei, weil unter dem Unterpfad
 * ausschliesslich Variantenordner liegen — nachgezaehlt, nicht gehofft: alle
 * 106 Indexeintraege haben mindestens drei Segmente. Flachere Quellen fallen
 * auf den Ordner- beziehungsweise Dateinamen zurueck.
 *
 * @type {Map<string, Mitnehmen[]>}
 */
const varianten = new Map();
for (const u of uebernommen) {
  const teile = u.pfad.split('/');
  const name = teile.length > 2 ? teile[1] : teile[0].replace(/\.[^.]+$/, '');
  const bisher = varianten.get(name);
  if (bisher) bisher.push(u);
  else varianten.set(name, [u]);
}

const rohordner = path.join(quellordner, 'roh');
// Alte Rohdateien wegraeumen: Faellt eine Variante in der Quelle weg, bliebe
// sie sonst liegen und das Manifest widerspraeche dem Ordner daneben.
rmSync(rohordner, { recursive: true, force: true });
mkdirSync(rohordner, { recursive: true });

/** @type {{ name: string, ersterAbsatz: string, dateien: number }[]} */
const einstiege = [];

/**
 * Sucht in einer Beschreibung die erste Zeile, die tatsaechlich etwas beschreibt.
 *
 * Ueberschriften, Abzeichen und Verweise scheiden aus. Der letzte Fall ist der
 * wichtige: Steht am Anfang nur ein Verweis auf ein Tutorial, traegt der
 * Uebersichtseintrag null Information — bei der ersten eingelesenen Quelle
 * betraf das 6 von 24 Varianten.
 *
 * Die Regel ist bewusst allgemein gehalten und nicht auf diese Quelle
 * zugeschnitten. Zwei Merkmale zusammen tragen sie:
 *
 * 1. Nach Abzug von Markdown-Syntax, Verweisen und Bildern muss genug Text
 *    uebrig bleiben. Das faengt reine Abzeichen- und Verweiszeilen ab.
 * 2. Der Rest muss einen Satz **anfangen**, also gross beginnen. Das ist der
 *    entscheidende Teil: Bei der ersten Quelle stand hinter dem Werbeverweis
 *    noch Fliesstext ("… and learn how to build this from scratch"), also
 *    reichlich Zeichen — aber als Fortsetzung des Aufrufs, klein beginnend.
 *    Eine Beschreibung faengt einen Satz an, ein Fragment nicht.
 *
 * Wer stattdessen einen bestimmten Wortlaut ausschliesst, hat die naechste
 * Quelle schon verloren.
 *
 * @param {string} text
 * @returns {string}
 */
function ersteBeschreibendeZeile(text) {
  for (const zeile of text.split('\n')) {
    const roh = zeile.trim();
    if (!roh || roh.startsWith('#') || roh.startsWith('>')) continue;

    // Lesbar bleiben soll, was zurueckkommt — Bindestriche gehoeren zum Wort
    // ("Retrieval-Augmented"), Sternchen und Emoji nicht.
    const lesbar = roh
      .replace(/!?\[[^\]]*\]\([^)]*\)/g, '') // Verweise und Bilder samt Beschriftung
      .replace(/<[^>]+>/g, '') // rohes HTML, etwa Abzeichen
      .replace(/[*_`~]/g, '') // Auszeichnung
      .replace(/\p{Extended_Pictographic}/gu, '') // Emoji als Schmuck
      .replace(/\s{2,}/g, ' ')
      .trim();

    // Fuer das Urteil faellt zusaetzlich alles weg, was auch ohne Bedeutung
    // Laenge erzeugen wuerde.
    const nurText = lesbar.replace(/[|>-]/g, '').trim();

    if (nurText.length < 40) continue;
    if (!/^[\p{Lu}\p{N}"„]/u.test(nurText)) continue;

    return lesbar;
  }
  return '';
}

// Eigener Vergleich statt `sort()`: Der Standardvergleich wuerde die Paare
// erst in Zeichenketten verwandeln, und `localeCompare` haengt an der
// Spracheinstellung des Rechners. Beides waere fuer einen Lauf, der
// reproduzierbar sein soll, die falsche Grundlage.
const nachNamen = [...varianten].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

for (const [name, dateien] of nachNamen) {
  const beschreibungen = dateien.filter((d) => d.rubrik === RUBRIK.beschreibung);
  const umsetzungen = dateien.filter((d) => d.rubrik === RUBRIK.umsetzung);

  const kopf = [
    '---',
    `variante: ${name}`,
    `herkunft: ${herkunft.url}`,
    `stand: ${herkunft.sha}`,
    'dateien:',
    ...dateien.map((d) => `  - ${d.pfad}`),
    '---',
    '',
  ].join('\n');

  const teile = [kopf];
  for (const d of beschreibungen) {
    teile.push(`## Beschreibung — ${d.pfad}\n\n${lies(d.pfad)}\n`);
  }
  for (const d of umsetzungen) {
    const inhalt = lies(d.pfad);
    const endung = d.pfad.split('.').pop();
    const z = zaun(inhalt);
    teile.push(`## Umsetzung — ${d.pfad}\n\n${z}${endung}\n${inhalt}\n${z}\n`);
  }

  writeFileSync(path.join(rohordner, `${name}.md`), teile.join('\n'), 'utf8');

  const ersterAbsatz =
    beschreibungen.length > 0 ? ersteBeschreibendeZeile(lies(beschreibungen[0].pfad)) : '';
  einstiege.push({ name, ersterAbsatz: ersterAbsatz.slice(0, 300), dateien: dateien.length });
}

const uebersicht = [
  `# ${kurzname} — ${varianten.size} Varianten`,
  '',
  `Stand ${herkunft.sha}, Unterpfad \`${unterpfad}\`.`,
  '',
  'Diese Übersicht ist der Einstieg für den Destillat-Durchgang: Sie reicht,',
  'um Verwandtschaften zu erkennen. Für ein Urteil über ein Prinzip gehört die',
  'jeweilige Datei unter `roh/` vollständig gelesen.',
  '',
  ...einstiege.flatMap((e) => [
    `## ${e.name}`,
    '',
    e.ersterAbsatz,
    '',
    `\`roh/${e.name}.md\` · ${e.dateien} Quelldateien`,
    '',
  ]),
].join('\n');

writeFileSync(path.join(quellordner, 'uebersicht.md'), uebersicht, 'utf8');

const manifest = baueManifest({
  herkunft,
  urteile,
  gestempeltAm: new Date().toISOString(),
});
writeFileSync(path.join(quellordner, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

console.log(
  `\n${manifest.summe.uebernommen} Dateien übernommen, ${manifest.summe.ausgelassen} ausgelassen, ` +
    `${varianten.size} Varianten, ${Math.round(manifest.summe.bytes / 1024)} KB.\n` +
    `  ${path.relative(wurzel, quellordner)}/uebersicht.md\n` +
    `  ${path.relative(wurzel, quellordner)}/manifest.json`,
);

/**
 * Waehlt einen Codezaun, der laenger ist als die laengste Backtick-Folge im
 * Inhalt. Bei rag_tutorials taeten drei es (nachgesehen: keine Datei enthaelt
 * mehr als einen Backtick am Stueck), aber ein Prompt-Template mit einem
 * eingebetteten Codeblock wuerde den Zaun sonst lautlos aufbrechen und den
 * Rest der Datei als Prosa erscheinen lassen.
 *
 * @param {string} inhalt
 * @returns {string}
 */
function zaun(inhalt) {
  const laengste = (inhalt.match(/`+/g) ?? []).reduce((n, s) => Math.max(n, s.length), 0);
  return '`'.repeat(Math.max(3, laengste + 1));
}
