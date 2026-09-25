#!/usr/bin/env node
/**
 * Folien des Originals ansehen: rendert Folien eines Abschnitts als PNG, damit
 * der Compiler sie mit `Read` ansehen kann.
 *
 *   npm run ansicht -- --name <kurzname> <abschnitt-id> [--folien 16,19-23]
 *
 * Warum Bilder: Auf einer Folie mit Tabelle oder Grafik traegt der Text die
 * Anordnung nicht, und eine Bildfolie hat gar keinen. `Read` liest ein PDF mit
 * `pages` nur ueber Poppler (`pdftoppm`), das hier nicht installiert ist, und
 * ohne `pages` nur bis zehn Seiten. pdf.js rendert mit `@napi-rs/canvas`, das
 * als optionale Abhaengigkeit von pdfjs-dist ohnehin im Lockfile steht —
 * gemessen: eine Folie bei Skala 1,5 zu 1263 × 893 px in 0,7 s.
 *
 * Drei Schichten wie beim Einlesen: `folienAuswahl` ist die reine Funktion
 * ueber die Angabe, `rendereFolien` liest und schreibt unter einer Wurzel, und
 * `fuehreAus` ist die Kommandozeile.
 *
 * **Die Bilder bleiben unter `quellen/`** (gitignored), in
 * `quellen/<kurzname>/ansicht/<abschnitt-id>/folie-<n>.png`: Sie zeigen fremdes
 * Material. Auf der Konsole stehen nur Pfade und Masse, nie Folientext. Ein
 * neues Einlesen ersetzt `quellen/<kurzname>/` als Ganzes; alte Bilder zu
 * einem alten Stand bleiben so nicht liegen.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ID as ID_MUSTER } from '../src/lib/lehrplan.ts';
import { ladePdfjs } from './adapter/dokument.mjs';
import { liesDokumentManifest } from './manifest.mjs';

const AUFRUF = 'Aufruf: npm run ansicht -- --name <kurzname> <abschnitt-id> [--folien 16,19-23]';

/** Was `folienAuswahl` zu einer Angabe sagt, die es nicht lesen kann. */
const UNLESBAR = '--folien versteht Angaben wie 16,19-23.';

/**
 * Ein Teil der Angabe: eine Folie oder ein Bereich. Der Bereich darf auch mit
 * Halbgeviertstrich stehen — so schreiben die Werkzeuge ihn selbst
 * („Folien 11–18"), und so wird er kopiert.
 */
const TEIL = /^\s*(\d+)\s*(?:[-–]\s*(\d+)\s*)?$/;

/** Bricht das Ansehen mit einer Meldung ab, die man dem Nutzer zeigen kann. */
export class AnsichtFehler extends Error {}

/**
 * Die Folien einer Angabe wie `16,19-23`: Zahlen und Bereiche, durch Komma
 * getrennt. Zurueck kommen sie aufsteigend und jede einmal.
 *
 * Jede Folie muss im Abschnitt liegen. Bei einem Bereich werden die Enden
 * geprueft, bevor er aufgezaehlt wird: `1-999999999` wird abgewiesen, nicht
 * erst zu einer Liste mit einer Milliarde Eintraegen.
 *
 * @param {string} angabe
 * @param {readonly [number, number]} bereich die Folien des Abschnitts, von und bis
 * @returns {number[]}
 */
export function folienAuswahl(angabe, [von, bis]) {
  /** @type {Set<number>} */
  const folien = new Set();
  for (const teil of angabe.split(',')) {
    const treffer = TEIL.exec(teil);
    if (!treffer) throw new AnsichtFehler(UNLESBAR);
    const anfang = Number(treffer[1]);
    const ende = treffer[2] === undefined ? anfang : Number(treffer[2]);
    if (ende < anfang) throw new AnsichtFehler(UNLESBAR);
    for (const folie of [anfang, ende]) {
      if (folie < von || folie > bis) {
        throw new AnsichtFehler(`Folie ${folie} liegt nicht in diesem Abschnitt (Folien ${von}–${bis}).`);
      }
    }
    for (let folie = anfang; folie <= ende; folie++) folien.add(folie);
  }
  return [...folien].sort((a, b) => a - b);
}

/**
 * Was beim Laden kommt, wenn `@napi-rs/canvas` fehlt: Fehlt das Paket, meldet
 * Node einen dieser Codes; fehlt nur sein Binaerteil fuer diese Plattform,
 * meldet der Lader des Pakets einen dieser Saetze. Nur diese Faelle werden zur
 * Meldung — jeder andere Fehler geht als Stapelabzug durch.
 */
const CANVAS_FEHLT_CODES = new Set(['ERR_MODULE_NOT_FOUND', 'MODULE_NOT_FOUND']);
const CANVAS_FEHLT_MELDUNG = /^(Cannot find|Failed to load) native binding/;

/**
 * @typedef {{ createCanvas: typeof import('@napi-rs/canvas').createCanvas }} CanvasModul
 */

/**
 * Laedt `@napi-rs/canvas` — erst jetzt, beim Rendern: Wer nur einliest,
 * braucht es nicht.
 *
 * @param {() => Promise<CanvasModul>} ladeCanvas
 * @returns {Promise<CanvasModul>}
 */
async function canvasLaden(ladeCanvas) {
  try {
    return await ladeCanvas();
  } catch (fehler) {
    if (fehler instanceof Error) {
      const code = /** @type {Error & { code?: unknown }} */ (fehler).code;
      if ((typeof code === 'string' && CANVAS_FEHLT_CODES.has(code)) || CANVAS_FEHLT_MELDUNG.test(fehler.message)) {
        throw new AnsichtFehler('Zum Ansehen fehlt @napi-rs/canvas — es kommt mit pdfjs-dist; bitte npm install ausführen.');
      }
    }
    throw fehler;
  }
}

/**
 * @typedef {{ folie: number, pfad: string, breite: number, hoehe: number }} Bild
 */

/**
 * Rendert Folien eines Abschnitts aus dem Original als PNG nach
 * `quellen/<kurzname>/ansicht/<abschnitt>/folie-<n>.png` unter `wurzel`.
 *
 * Erst wird geprueft, was fehlen kann — Manifest, Abschnitt, Auswahl,
 * Original, Canvas —, dann wird etwas angelegt. Scheitert eine Pruefung,
 * bleibt die Platte, wie sie war.
 *
 * Kurzname und Abschnitt werden zu Ordnernamen. Nur was dem Muster der Ids
 * folgt, bleibt sicher unter `quellen/<kurzname>/ansicht/` und damit
 * gitignored — ein `--name ../x` oder ein Manifest, das einen Pfad als Id
 * fuehrt, legte die Bilder sonst daneben.
 *
 * `folien` ist die Angabe wie auf der Kommandozeile (`16,19-23`); ohne sie
 * kommen alle Folien des Abschnitts. `pfad` im Ergebnis ist absolut.
 * `ladeCanvas` ist nur fuer Tests austauschbar: Ein fehlendes
 * `@napi-rs/canvas` laesst sich anders nicht herbeifuehren.
 *
 * @param {{
 *   wurzel: string,
 *   kurzname: string,
 *   abschnitt: string,
 *   folien?: string,
 *   geladen?: import('./adapter/dokument.mjs').Pdfjs,
 *   skala?: number,
 *   ladeCanvas?: () => Promise<CanvasModul>,
 * }} auftrag
 * @returns {Promise<{ bilder: Bild[] }>}
 */
export async function rendereFolien({
  wurzel,
  kurzname,
  abschnitt,
  folien,
  geladen,
  skala = 1.5,
  ladeCanvas = () => import('@napi-rs/canvas'),
}) {
  if (!ID_MUSTER.test(kurzname)) {
    throw new AnsichtFehler(`--name ${kurzname}: nur Kleinbuchstaben, Ziffern und Bindestrich.`);
  }
  const quelle = path.join(wurzel, 'quellen', kurzname);
  const manifestPfad = path.join(quelle, 'manifest.json');
  if (!existsSync(manifestPfad)) {
    throw new AnsichtFehler(`quellen/${kurzname}/manifest.json gibt es nicht — erst einlesen.`);
  }
  const gelesen = liesDokumentManifest(readFileSync(manifestPfad, 'utf8'));
  if (!gelesen.ok) {
    throw new AnsichtFehler(`quellen/${kurzname}/manifest.json lässt sich nicht lesen (${gelesen.grund}).`);
  }
  // Eine Id, die dem Muster nicht folgt, kann kein Abschnitt sein — auch wenn
  // ein veraendertes Manifest sie fuehrt.
  const eintrag = ID_MUSTER.test(abschnitt) ? gelesen.manifest.roh.find((r) => r.id === abschnitt) : undefined;
  if (!eintrag) throw new AnsichtFehler(`Abschnitt ${abschnitt} gibt es im Manifest nicht.`);

  const [von, bis] = eintrag.seiten;
  const auswahl =
    folien === undefined ? Array.from({ length: bis - von + 1 }, (_, i) => von + i) : folienAuswahl(folien, eintrag.seiten);
  const originalPfad = path.join(quelle, 'original', eintrag.datei);
  if (!existsSync(originalPfad)) {
    throw new AnsichtFehler(`Das Original ${eintrag.datei} fehlt unter quellen/${kurzname}/original/.`);
  }
  const { createCanvas } = await canvasLaden(ladeCanvas);
  const { pdfjs, optionen } = geladen ?? (await ladePdfjs());

  const ordner = path.join(quelle, 'ansicht', abschnitt);
  /** @type {Bild[]} */
  const bilder = [];
  // Aufgeraeumt wird mit ladeaufgabe.destroy(), wie in liesSeiten:
  // PDFDocumentProxy.destroy() gibt es in 6.3 nicht mehr.
  const ladeaufgabe = pdfjs.getDocument({ data: new Uint8Array(readFileSync(originalPfad)), ...optionen });
  try {
    const doc = await ladeaufgabe.promise;
    mkdirSync(ordner, { recursive: true });
    for (const folie of auswahl) {
      const seite = await doc.getPage(folie);
      const sichtfeld = seite.getViewport({ scale: skala });
      // Aufgerundet: Die angeschnittene Pixelzeile gehoert noch zur Folie
      // (A4 quer bei Skala 1,5: 892,5 -> 893).
      const leinwand = createCanvas(Math.ceil(sichtfeld.width), Math.ceil(sichtfeld.height));
      // Nur `canvas`, kein `canvasContext`: pdf.js holt sich den Kontext selbst,
      // so empfiehlt es seine Schnittstelle.
      await seite.render({ canvas: leinwand, viewport: sichtfeld }).promise;
      const pfad = path.join(ordner, `folie-${folie}.png`);
      writeFileSync(pfad, await leinwand.encode('png'));
      bilder.push({ folie, pfad, breite: leinwand.width, hoehe: leinwand.height });
      seite.cleanup();
    }
  } finally {
    await ladeaufgabe.destroy();
  }
  return { bilder };
}

/**
 * Liest die Kommandozeile: `--name <kurzname>`, genau eine Abschnitt-Id und
 * wahlweise `--folien <angabe>`, in beliebiger Reihenfolge. `null`, wenn etwas
 * fehlt, zu viel oder fremd ist — dann kommt die Aufruf-Hilfe.
 *
 * @param {readonly string[]} argv
 * @returns {{ kurzname: string, abschnitt: string, folien: string | undefined } | null}
 */
function leseArgv(argv) {
  let kurzname = '';
  /** @type {string | undefined} */
  let folien;
  /** @type {string[]} */
  const ids = [];
  for (let i = 0; i < argv.length; i++) {
    const argument = argv[i];
    if (argument === '--name' || argument === '--folien') {
      const wert = argv[i + 1];
      if (wert === undefined || wert.startsWith('--')) return null;
      if (argument === '--name') kurzname = wert;
      else folien = wert;
      i++;
    } else if (argument.startsWith('--')) {
      return null;
    } else {
      ids.push(argument);
    }
  }
  return kurzname && ids.length === 1 ? { kurzname, abschnitt: ids[0], folien } : null;
}

/**
 * Kommandozeile: npm run ansicht -- --name <kurzname> <abschnitt-id> [--folien 16,19-23]
 *
 * @param {readonly string[]} argv
 * @param {string} wurzel
 * @param {(zeile: string) => void} [schreibe]
 * @returns {Promise<number>} der Rueckgabewert des Prozesses
 */
export async function fuehreAus(argv, wurzel, schreibe = (zeile) => console.log(zeile)) {
  const aufruf = leseArgv(argv);
  if (aufruf === null) {
    schreibe(AUFRUF);
    return 2;
  }

  try {
    const { bilder } = await rendereFolien({ wurzel, ...aufruf });
    /** @type {(pfad: string) => string} */
    const rel = (pfad) => path.relative(wurzel, pfad).replaceAll(path.sep, '/');
    for (const bild of bilder) schreibe(`${rel(bild.pfad)} — ${bild.breite} × ${bild.hoehe}`);
    schreibe(bilder.length === 1 ? '1 Folie gerendert.' : `${bilder.length} Folien gerendert.`);
    return 0;
  } catch (fehler) {
    if (!(fehler instanceof AnsichtFehler)) throw fehler;
    schreibe(fehler.message);
    return 1;
  }
}

/**
 * Wurde die Datei direkt aufgerufen, oder nur importiert? Siehe
 * werkzeug/pruefe-lektion.mjs: `pathToFileURL` erzeugt unter Windows genau
 * die Form, die Node auch fuer `import.meta.url` verwendet.
 */
const direktAufgerufen = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (direktAufgerufen) {
  process.exitCode = await fuehreAus(process.argv.slice(2), process.cwd());
}
