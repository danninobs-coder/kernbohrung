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
 * `fuehreAus` ist die Kommandozeile. Laesst sich eine Datei nicht lesen oder
 * schreiben, bricht es mit einem Satz ab, nicht mit einem Stapelabzug.
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
import { lesegrund } from './adapter/folien.mjs';
import { liesDokumentManifest } from './dokument-manifest.mjs';

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
 * Ein Kurzname, der nicht dem Muster der Ids folgt. Derselbe Satz wie in
 * werkzeug/pruefe-quelle.mjs, werkzeug/auftrag.mjs und beim Einlesen: Es ist
 * derselbe Fehler.
 *
 * @param {string} kurzname
 * @returns {string}
 */
function kurznameFalsch(kurzname) {
  return `--name ${kurzname}: nur Kleinbuchstaben, Ziffern und Bindestrich.`;
}

/**
 * Der Code eines gescheiterten Dateizugriffs (`EBUSY`, `EISDIR`, …), sonst
 * der Name des Fehlers. Gleiches Muster wie `fehlercode` in
 * werkzeug/adapter/folien.mjs.
 *
 * @param {unknown} fehler
 * @returns {string}
 */
function fehlercode(fehler) {
  if (!(fehler instanceof Error)) return String(fehler);
  const code = /** @type {Error & { code?: unknown }} */ (fehler).code;
  return typeof code === 'string' ? code : fehler.name;
}

/**
 * Ob `fehler` ein gescheiterter Systemaufruf ist — gesperrt, keine Rechte,
 * eine Datei, wo ein Ordner hin soll. Node gibt solchen Fehlern `syscall`
 * mit, einem Fehler im Programm nicht. Gleiches Muster wie `istSystemfehler`
 * in werkzeug/adapter/folien.mjs.
 *
 * @param {unknown} fehler
 * @returns {boolean}
 */
function istSystemfehler(fehler) {
  return fehler instanceof Error && typeof (/** @type {Error & { syscall?: unknown }} */ (fehler).syscall) === 'string';
}

/**
 * Ein Pfad relativ zur Wurzel, mit Schraegstrichen — so steht er in jeder
 * Zeile auf der Konsole, auch unter Windows.
 *
 * @param {string} wurzel
 * @param {string} pfad
 * @returns {string}
 */
function relativ(wurzel, pfad) {
  return path.relative(wurzel, pfad).replaceAll(path.sep, '/');
}

/**
 * Legt mit `schreiben` unter `wurzel` an, was unter `pfad` stehen soll.
 * Scheitert ein Systemaufruf — eine Datei, wo der Ordner hin soll, ein Bild,
 * das ein Betrachter festhaelt —, wird daraus ein Satz mit dem Pfad statt
 * eines Stapelabzugs. Ein Fehler im Programm geht durch: Als Schreibfehler
 * verkleidet, suchte man an der Platte statt im Code.
 *
 * @param {string} wurzel
 * @param {string} pfad
 * @param {() => unknown} schreiben
 */
function schreibeUnter(wurzel, pfad, schreiben) {
  try {
    schreiben();
  } catch (fehler) {
    if (!istSystemfehler(fehler)) throw fehler;
    throw new AnsichtFehler(`${relativ(wurzel, pfad)} lässt sich nicht schreiben (${fehlercode(fehler)}).`);
  }
}

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
 * Ob `datei` ein blosser Dateiname ist -- ohne Pfadanteil davor.
 *
 * Vier eigene Pruefungen statt allein `path.basename`: Das Manifest ist
 * fremde Eingabe (ein alter Stand, von Hand editiert), und `eintrag.datei`
 * geht sonst ungeprueft in `path.join(quelle, 'original', eintrag.datei)`
 * ein -- ein `..` oder ein absoluter Pfad darin liese ausserhalb von
 * quellen/<k>/original/.
 *
 * @param {string} datei
 * @returns {boolean}
 */
function istEinDateiname(datei) {
  if (datei === '.' || datei === '..') return false;
  if (datei.includes('/') || datei.includes('\\')) return false;
  if (/^[A-Za-z]:/.test(datei)) return false;
  return path.basename(datei) === datei;
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
 * Laesst sich eine Datei nicht lesen oder schreiben, steht ein Satz mit ihrem
 * Pfad da: beim Manifest und bei Ordner und Bildern unter `ansicht/` mit dem
 * Code des Systemaufrufs, beim Original derselbe Grund wie beim Einlesen
 * (`lesegrund`) — gesperrt, kein PDF, ein Passwort. Ein Fehler im Programm
 * geht durch.
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
  if (!ID_MUSTER.test(kurzname)) throw new AnsichtFehler(kurznameFalsch(kurzname));
  const quelle = path.join(wurzel, 'quellen', kurzname);
  const manifestPfad = path.join(quelle, 'manifest.json');
  if (!existsSync(manifestPfad)) {
    throw new AnsichtFehler(`quellen/${kurzname}/manifest.json gibt es nicht — erst einlesen.`);
  }
  /** @type {string} */
  let manifestText;
  try {
    manifestText = readFileSync(manifestPfad, 'utf8');
  } catch (fehler) {
    if (!istSystemfehler(fehler)) throw fehler;
    throw new AnsichtFehler(`quellen/${kurzname}/manifest.json lässt sich nicht lesen (${fehlercode(fehler)}).`);
  }
  const gelesen = liesDokumentManifest(manifestText);
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
  if (!istEinDateiname(eintrag.datei)) {
    throw new AnsichtFehler(
      `Das Manifest nennt als Datei ${JSON.stringify(eintrag.datei)} — erwartet ist ein Dateiname ohne Pfad.`,
    );
  }
  const originalPfad = path.join(quelle, 'original', eintrag.datei);
  if (!existsSync(originalPfad)) {
    throw new AnsichtFehler(`Das Original ${eintrag.datei} fehlt unter quellen/${kurzname}/original/.`);
  }
  const { createCanvas } = await canvasLaden(ladeCanvas);
  const { pdfjs, optionen } = geladen ?? (await ladePdfjs());

  // Oeffnen und Laden scheitern aus denselben Gruenden wie beim Einlesen, und
  // so heissen sie auch, mit der Datei davor. Ohne Grund ist es ein Fehler im
  // Programm: Er geht durch.
  /** @type {(fehler: unknown) => unknown} */
  const originalFehler = (fehler) => {
    const grund = lesegrund(fehler);
    return grund === null ? fehler : new AnsichtFehler(`quellen/${kurzname}/original/${eintrag.datei}: ${grund}`);
  };
  /** @type {Uint8Array} */
  let daten;
  try {
    daten = new Uint8Array(readFileSync(originalPfad));
  } catch (fehler) {
    throw originalFehler(fehler);
  }

  const ordner = path.join(quelle, 'ansicht', abschnitt);
  /** @type {Bild[]} */
  const bilder = [];
  // Aufgeraeumt wird mit ladeaufgabe.destroy(), wie in liesSeiten:
  // PDFDocumentProxy.destroy() gibt es in 6.3 nicht mehr.
  const ladeaufgabe = pdfjs.getDocument({ data: daten, ...optionen });
  try {
    let doc;
    try {
      doc = await ladeaufgabe.promise;
    } catch (fehler) {
      throw originalFehler(fehler);
    }
    schreibeUnter(wurzel, ordner, () => mkdirSync(ordner, { recursive: true }));
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
      const png = await leinwand.encode('png');
      schreibeUnter(wurzel, pfad, () => writeFileSync(pfad, png));
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
 * wahlweise `--folien <angabe>`, in beliebiger Reihenfolge. Fehlt etwas oder
 * steht etwas zu viel da, kommt nur die Aufruf-Hilfe (`meldung: null`). Eine
 * fremde Option und ein Kurzname, der nicht dem Muster der Ids folgt,
 * bekommen einen Satz davor, wie bei pruefe-quelle: Die Hilfe allein sagt
 * nicht, was an einem Aufruf falsch ist, der ihr zu folgen scheint. Der erste
 * Fehler gewinnt; den Kurznamen prueft sie erst bei sonst vollstaendigem
 * Aufruf. `rendereFolien` prueft ihn trotzdem selbst: Es laesst sich auch
 * ohne diese Kommandozeile aufrufen.
 *
 * @param {readonly string[]} argv
 * @returns {{ ok: true, kurzname: string, abschnitt: string, folien: string | undefined } | { ok: false, meldung: string | null }}
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
      if (wert === undefined || wert.startsWith('--')) return { ok: false, meldung: null };
      if (argument === '--name') kurzname = wert;
      else folien = wert;
      i++;
    } else if (argument.startsWith('--')) {
      return { ok: false, meldung: `Unbekannte Option ${argument}.` };
    } else {
      ids.push(argument);
    }
  }
  if (kurzname === '' || ids.length !== 1) return { ok: false, meldung: null };
  if (!ID_MUSTER.test(kurzname)) return { ok: false, meldung: kurznameFalsch(kurzname) };
  return { ok: true, kurzname, abschnitt: ids[0], folien };
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
  if (!aufruf.ok) {
    if (aufruf.meldung !== null) schreibe(aufruf.meldung);
    schreibe(AUFRUF);
    return 2;
  }
  const { kurzname, abschnitt, folien } = aufruf;

  try {
    const { bilder } = await rendereFolien({ wurzel, kurzname, abschnitt, folien });
    for (const bild of bilder) schreibe(`${relativ(wurzel, bild.pfad)} — ${bild.breite} × ${bild.hoehe}`);
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
