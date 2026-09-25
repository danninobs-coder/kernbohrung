#!/usr/bin/env node
/**
 * Der Auftrag: Abschnitte eines Lehrplans aus Lehrmaterial von `offen` auf
 * `beauftragt` setzen -- die Vorbereitung fuer den naechsten Durchgang des
 * Compilers an genau diesen Abschnitten.
 *
 *   npm run auftrag -- --name <kurzname> <abschnitt-id> [<abschnitt-id> …]
 *
 * Drei Schichten wie beim Einlesen: `beauftrage` ist die reine Funktion ueber
 * den Text, `beauftrageDatei` liest und schreibt unter einer Wurzel, und
 * `fuehreAus` ist die Kommandozeile.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
// Namentlich, nicht als Vorgabe-Import: js-yaml 5 liefert unter `import` ein
// ESM-Buendel ohne Default-Export. Siehe werkzeug/pruefe-lektion.mjs.
import { load as yamlLesen, YAMLException } from 'js-yaml';
import { lehrplanAusYaml } from '../src/lib/lehrplan.ts';
import { lektionsIdsAus } from './lehrplan.mjs';

const AUFRUF = 'Aufruf: npm run auftrag -- --name <kurzname> <abschnitt-id> [<abschnitt-id> …]';

export class AuftragFehler extends Error {}

/**
 * Die Ankerzeile eines Abschnitts: `- id: <id>` mit genau zwei Leerzeichen
 * Einzug, so wie `lehrplanGeruest` sie schreibt. Ein Prinzip traegt seine
 * eigene Id in derselben Form, aber tiefer eingerueckt (unter `prinzipien:`)
 * -- das Muster hier trifft nur den Abschnitt selbst, nie sein Prinzip.
 */
const ABSCHNITT_ANKER = /^ {2}- id: (\S+)\r?$/gm;

/**
 * Die Statuszeile eines Abschnitts, vier Leerzeichen Einzug: `status: offen`
 * ohne Anfuehrungszeichen, mit doppelten oder mit einfachen, wahlweise mit
 * Kommentar dahinter. Gruppe 1 haelt das Anfuehrungszeichen (leer, wenn
 * keines da ist) und erzwingt per Rueckverweis (`\1`) dieselbe Art vorn und
 * hinten -- `status: "offen'` waere kein Treffer.
 *
 * Global, damit ein Block sich auf mehr als einen Treffer pruefen laesst
 * (siehe `beauftrage`): Findet sich in einem Abschnitt keine oder mehr als
 * eine Statuszeile, ist das ein Mangel, kein Programmfehler -- die Form kann
 * von Hand abweichen, ohne dass js-yaml sich daran stoert.
 *
 * Ersetzt wird mit `.replace('offen', 'beauftragt')` auf dem ganzen Treffer:
 * Das erste "offen" darin ist immer der Wert, eines im Kommentar kaeme erst
 * danach.
 */
const STATUS_OFFEN = /^ {4}status: (["']?)offen\1[ \t]*(?:#.*)?\r?$/gm;

/**
 * Der Code eines gescheiterten Dateizugriffs (`ENOENT`, `EISDIR`, …), sonst
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
 * Die Abschnitte eines Textes, erkannt an ihrer Ankerzeile, mit dem Ende
 * ihres jeweiligen Blocks (Beginn des naechsten Abschnitts oder Textende).
 *
 * @param {string} text
 * @returns {{ id: string, start: number, blockEnde: number }[]}
 */
function abschnittAnker(text) {
  const treffer = [...text.matchAll(ABSCHNITT_ANKER)];
  return treffer.map((t, i) => ({
    id: t[1],
    start: /** @type {number} */ (t.index),
    blockEnde: i + 1 < treffer.length ? /** @type {number} */ (treffer[i + 1].index) : text.length,
  }));
}

/**
 * Id und Status jedes Abschnitts aus einem roh gelesenen Lehrplan, plus die
 * Ids in der Reihenfolge des Lehrplans. Ein Abschnitt ohne lesbare Id oder
 * ohne lesbaren Status zaehlt nicht mit -- er faellt dann bei jeder Id-Suche
 * durch, nie durch als vermeintlich vorhanden.
 *
 * @param {readonly unknown[]} abschnitte
 * @returns {{ statusJeId: Map<string, string>, idsInReihenfolge: string[] }}
 */
function statusUebersicht(abschnitte) {
  /** @type {Map<string, string>} */
  const statusJeId = new Map();
  /** @type {string[]} */
  const idsInReihenfolge = [];
  for (const roh of abschnitte) {
    if (roh === null || typeof roh !== 'object') continue;
    const a = /** @type {Record<string, unknown>} */ (roh);
    if (typeof a.id !== 'string') continue;
    idsInReihenfolge.push(a.id);
    if (typeof a.status === 'string') statusJeId.set(a.id, a.status);
  }
  return { statusJeId, idsInReihenfolge };
}

/**
 * @typedef {{ ok: true, text: string, geaendert: string[] }} BeauftragtErgebnis
 * @typedef {{ ok: false, maengel: string[] }} AbgelehntesErgebnis
 * @typedef {BeauftragtErgebnis | AbgelehntesErgebnis} Ergebnis
 */

/**
 * Reine Funktion ueber den Text eines Lehrplans.
 *
 * Aendert nur die Zeile `status: offen` der genannten Abschnitte zu
 * `status: beauftragt` und laesst alles andere Byte fuer Byte stehen
 * (Kopfkommentar, Anfuehrungszeichen, Reihenfolge, CRLF oder LF). Danach
 * liest es den neuen Text mit js-yaml und prueft: Genau die genannten
 * Abschnitte haben den Status gewechselt, sonst ist nichts anders. Scheitert
 * diese Gegenprobe, ist es ein Programmierfehler (Stapelabzug) -- kein Mangel.
 *
 * Findet sich fuer einen laut YAML offenen Abschnitt keine eindeutige
 * status-Zeile im Text (weder die drei erkannten Formen noch mehr als eine
 * davon), ist das dagegen ein Mangel: Die Form kann von Hand abweichen, ohne
 * dass js-yaml sich daran stoert, und das darf das Werkzeug nicht mit einem
 * Stapelabzug quittieren.
 *
 * Alles oder nichts: Gibt es einen Mangel, aendert sich nichts.
 *
 * @param {string} text
 * @param {readonly string[]} ids
 * @returns {Ergebnis}
 */
export function beauftrage(text, ids) {
  const eindeutig = [...new Set(ids)];
  if (eindeutig.length === 0) return { ok: false, maengel: ['Kein Abschnitt genannt.'] };

  let roh;
  try {
    roh = yamlLesen(text);
  } catch (fehler) {
    // Dieselbe einzeilige Form wie lehrplanAusYaml: fehler.message haengt bei
    // js-yaml 5 sonst einen mehrzeiligen Quelltextausschnitt an.
    if (fehler instanceof YAMLException && fehler.mark) {
      const { line, column } = fehler.mark;
      return {
        ok: false,
        maengel: [`Lehrplan ist kein gültiges YAML (Zeile ${line + 1}, Spalte ${column + 1}): ${fehler.reason}`],
      };
    }
    const grund = fehler instanceof Error ? fehler.message : String(fehler);
    return { ok: false, maengel: [`Lehrplan ist kein gültiges YAML: ${grund}`] };
  }

  const objekt = roh !== null && typeof roh === 'object' ? /** @type {Record<string, unknown>} */ (roh) : {};
  if (objekt.art === 'repo') {
    return { ok: false, maengel: ['Nur ein Lehrplan aus Lehrmaterial hat Abschnitte; dieser trägt art: repo.'] };
  }

  const abschnitte = Array.isArray(objekt.abschnitte) ? objekt.abschnitte : [];
  const { statusJeId, idsInReihenfolge } = statusUebersicht(abschnitte);

  /** @type {string[]} */
  const maengel = [];
  for (const id of eindeutig) {
    const status = statusJeId.get(id);
    if (status === undefined) {
      maengel.push(`Abschnitt ${id} gibt es in diesem Lehrplan nicht.`);
    } else if (status !== 'offen') {
      maengel.push(`Abschnitt ${id} steht auf ${status}, nicht auf offen — beauftragt wird nur, was offen ist.`);
    }
  }
  if (maengel.length > 0) return { ok: false, maengel };

  const geaendertSet = new Set(eindeutig);
  const betroffeneAnker = abschnittAnker(text).filter((a) => geaendertSet.has(a.id));

  /** @type {{ start: number, ende: number, ersatz: string }[]} */
  const ersetzungen = [];
  for (const a of betroffeneAnker) {
    const block = text.slice(a.start, a.blockEnde);
    const treffer = [...block.matchAll(STATUS_OFFEN)];
    if (treffer.length !== 1) {
      maengel.push(
        `Abschnitt ${a.id}: die Zeile status lässt sich nicht sicher finden — bitte von Hand auf beauftragt setzen.`,
      );
      continue;
    }
    const [einziger] = treffer;
    const start = a.start + /** @type {number} */ (einziger.index);
    ersetzungen.push({ start, ende: start + einziger[0].length, ersatz: einziger[0].replace('offen', 'beauftragt') });
  }
  if (maengel.length > 0) return { ok: false, maengel };
  ersetzungen.sort((x, y) => x.start - y.start);

  let neuerText = '';
  let stelle = 0;
  for (const e of ersetzungen) {
    neuerText += text.slice(stelle, e.start) + e.ersatz;
    stelle = e.ende;
  }
  neuerText += text.slice(stelle);

  // Gegenprobe: mit js-yaml gelesen darf sich gegenueber dem Original nur der
  // Status der genannten Abschnitte geaendert haben -- sonst nichts.
  const erwartet = /** @type {Record<string, unknown>} */ (structuredClone(objekt));
  const erwarteteAbschnitte = Array.isArray(erwartet.abschnitte) ? erwartet.abschnitte : [];
  for (const roh of erwarteteAbschnitte) {
    if (roh === null || typeof roh !== 'object') continue;
    const a = /** @type {Record<string, unknown>} */ (roh);
    if (typeof a.id === 'string' && geaendertSet.has(a.id)) a.status = 'beauftragt';
  }
  const geprueft = yamlLesen(neuerText);
  if (JSON.stringify(geprueft) !== JSON.stringify(erwartet)) {
    throw new Error(
      'Programmfehler in beauftrage: nach der Aenderung stimmt der Lehrplan nicht mehr mit der Erwartung ueberein.',
    );
  }

  const geaendert = idsInReihenfolge.filter((id) => geaendertSet.has(id));
  return { ok: true, text: neuerText, geaendert };
}

/**
 * Liest lehrplan/<kurzname>.yaml unter wurzel, beauftragt, prueft mit
 * pruefeLehrplan, schreibt zurueck.
 *
 * @param {{ wurzel: string, kurzname: string, ids: readonly string[] }} eingabe
 * @returns {{ geaendert: string[], datei: string }}
 */
export function beauftrageDatei({ wurzel, kurzname, ids }) {
  const relDatei = `lehrplan/${kurzname}.yaml`;
  const datei = path.join(wurzel, 'lehrplan', `${kurzname}.yaml`);

  let text;
  try {
    text = readFileSync(datei, 'utf8');
  } catch (fehler) {
    if (fehlercode(fehler) === 'ENOENT') throw new AuftragFehler(`${relDatei} gibt es nicht — erst einlesen.`);
    throw new AuftragFehler(`${relDatei} lässt sich nicht lesen (${fehlercode(fehler)}).`);
  }

  const ergebnis = beauftrage(text, ids);
  if (!ergebnis.ok) throw new AuftragFehler(ergebnis.maengel.join('\n'));

  const lektionsIds = lektionsIdsAus(path.join(wurzel, 'inhalt', 'lektionen'));
  const befund = lehrplanAusYaml(ergebnis.text, lektionsIds, relDatei);
  if (!befund.ok && !befund.wartet) throw new AuftragFehler(befund.maengel.join('\n'));

  writeFileSync(datei, ergebnis.text, 'utf8');
  return { geaendert: ergebnis.geaendert, datei };
}

/**
 * Liest --name und die Abschnitt-Ids von der Kommandozeile. Alles, was nicht
 * --name oder dessen Wert ist, zaehlt als Abschnitt-Id, in der Reihenfolge
 * der Kommandozeile.
 *
 * @param {readonly string[]} argv
 * @returns {{ kurzname: string, ids: string[] }}
 */
function leseArgv(argv) {
  let kurzname = '';
  /** @type {string[]} */
  const ids = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--name') {
      kurzname = argv[i + 1] ?? '';
      i++;
    } else {
      ids.push(argv[i]);
    }
  }
  return { kurzname, ids };
}

/**
 * Kommandozeile: npm run auftrag -- --name <kurzname> <abschnitt-id> [<abschnitt-id> …]
 *
 * @param {readonly string[]} argv
 * @param {string} wurzel
 * @param {(zeile: string) => void} [schreibe]
 * @returns {Promise<number>} der Rueckgabewert des Prozesses
 */
export async function fuehreAus(argv, wurzel, schreibe = (zeile) => console.log(zeile)) {
  const { kurzname, ids } = leseArgv(argv);
  if (!kurzname || ids.length === 0) {
    schreibe(AUFRUF);
    return 2;
  }

  try {
    const { geaendert } = beauftrageDatei({ wurzel, kurzname, ids });
    const kopf = geaendert.length === 1 ? '1 Abschnitt beauftragt' : `${geaendert.length} Abschnitte beauftragt`;
    schreibe(`lehrplan/${kurzname}.yaml: ${kopf}`);
    for (const id of geaendert) schreibe(`  ${id}`);
    schreibe(`Nächster Schritt: Durchgang A — „Bau die Lektionen für ${kurzname}“.`);
    return 0;
  } catch (fehler) {
    if (!(fehler instanceof AuftragFehler)) throw fehler;
    // beauftrageDatei fasst mehrere Maengel mit '\n' zu einer message
    // zusammen; hier wird je Zeile ein eigener schreibe()-Aufruf daraus.
    for (const zeile of fehler.message.split('\n')) schreibe(zeile);
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
