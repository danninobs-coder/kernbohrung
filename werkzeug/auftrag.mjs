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
 * `fuehreAus` ist die Kommandozeile. Den Kurznamen prueft die mittlere Schicht
 * selbst, bevor sie liest -- nicht erst die Kommandozeile. Laesst sich der
 * Lehrplan nicht lesen oder nicht schreiben oder ist er nicht als UTF-8
 * gespeichert, bricht der Auftrag mit einem Satz ab, nicht mit einem
 * Stapelabzug.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
// Namentlich, nicht als Vorgabe-Import: js-yaml 5 liefert unter `import` ein
// ESM-Buendel ohne Default-Export. Siehe werkzeug/pruefe-lektion.mjs.
import { load as yamlLesen, YAMLException } from 'js-yaml';
import { ID as ID_MUSTER, lehrplanAusYaml } from '../src/lib/lehrplan.ts';
import { lektionsIdsAus } from './lehrplan.mjs';

const AUFRUF = 'Aufruf: npm run auftrag -- --name <kurzname> <abschnitt-id> [<abschnitt-id> …]';

export class AuftragFehler extends Error {}

/**
 * Ein Kurzname, der nicht dem Muster der Ids folgt. Derselbe Satz wie in
 * werkzeug/pruefe-quelle.mjs, werkzeug/ansicht.mjs und beim Einlesen: Es ist
 * derselbe Fehler.
 *
 * @param {string} kurzname
 * @returns {string}
 */
function kurznameFalsch(kurzname) {
  return `--name ${kurzname}: nur Kleinbuchstaben, Ziffern und Bindestrich.`;
}

/**
 * Die Ankerzeile eines Abschnitts: `- id: <id>` mit genau zwei Leerzeichen
 * Einzug, so wie `lehrplanGeruest` sie schreibt. Die Id steht ohne
 * Anfuehrungszeichen, mit doppelten oder mit einfachen; dahinter darf
 * Leerraum stehen und ein Kommentar. Gruppe 1 haelt das Anfuehrungszeichen
 * und erzwingt wie bei `STATUS_OFFEN` dieselbe Art vorn und hinten, Gruppe 2
 * die Id. Ein Kommentar beginnt erst nach Leerraum: `a1#x` liest YAML als
 * eine Id, nicht als `a1` mit Kommentar.
 *
 * Ein Prinzip traegt seine eigene Id in derselben Form, aber tiefer
 * eingerueckt (unter `prinzipien:`) -- das Muster hier trifft nur den
 * Abschnitt selbst, nie sein Prinzip.
 *
 * Was darueber hinaus von Hand abweicht, erkennt es nicht; das faengt der
 * Abgleich mit den Ids aus dem YAML in `beauftrage` ab.
 */
const ABSCHNITT_ANKER = /^ {2}- id: (["']?)([^\s"'#]+)\1(?:[ \t]+(?:#.*)?)?\r?$/gm;

/**
 * Der Mangel, wenn die Anker nicht genau die Abschnitte treffen, die js-yaml
 * liest (siehe `beauftrage`).
 */
const ANDERE_FORM =
  'Die Abschnitte stehen nicht in der Form, die das Einlesen schreibt („  - id: …“ mit zwei Leerzeichen Einzug) — bitte von Hand auf beauftragt setzen.';

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
 * Ob `fehler` ein gescheiterter Systemaufruf ist -- gesperrt, keine Rechte,
 * Platte voll. Node gibt solchen Fehlern `syscall` mit, einem Fehler im
 * Programm nicht. Gleiches Muster wie `istSystemfehler` in
 * werkzeug/adapter/folien.mjs.
 *
 * @param {unknown} fehler
 * @returns {boolean}
 */
function istSystemfehler(fehler) {
  return fehler instanceof Error && typeof (/** @type {Error & { syscall?: unknown }} */ (fehler).syscall) === 'string';
}

/**
 * Liest die Bytes eines Lehrplans als UTF-8. `fatal`: Bytes, die kein UTF-8
 * sind, werfen, statt still zu U+FFFD zu werden -- hat ein Editor in ANSI
 * gespeichert, stuende sonst beim Schreiben jeder Umlaut der Titel als
 * EF BF BD in der Datei. `ignoreBOM`: Ein BOM am Anfang bleibt im Text und
 * steht beim Schreiben wieder da; js-yaml liest darueber hinweg.
 */
const UTF8 = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });

/**
 * Die Bytes als Text -- `null`, wenn sie kein gueltiges UTF-8 sind. Nur
 * dieser eine Fehler wird zu `null`; jeder andere geht durch.
 *
 * @param {Uint8Array} bytes
 * @returns {string | null}
 */
function alsUtf8(bytes) {
  try {
    return UTF8.decode(bytes);
  } catch (fehler) {
    if (fehlercode(fehler) === 'ERR_ENCODING_INVALID_ENCODED_DATA') return null;
    throw fehler;
  }
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
    id: t[2],
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
 * Dasselbe gilt fuer die Ankerzeilen, und sie kommen zuerst: Gesucht wird die
 * status-Zeile im Block eines Abschnitts, von seinem Anker bis zum naechsten.
 * Das stimmt nur, wenn die Anker genau die Abschnitte sind, die js-yaml liest
 * -- dieselben Ids in derselben Reihenfolge. Steht ein Abschnitt in anderer
 * Form da (die Liste ohne Einzug, die id nicht in der ersten Zeile), fehlt
 * sein Anker, und der Block davor schluckt ihn: Die Meldung naennte die
 * falsche Id, oder die Gegenprobe schluege an. Deshalb ein Mangel fuer den
 * ganzen Lehrplan, bevor etwas ersetzt wird.
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

  const anker = abschnittAnker(text);
  if (anker.length !== idsInReihenfolge.length || anker.some((a, i) => a.id !== idsInReihenfolge[i])) {
    return { ok: false, maengel: [ANDERE_FORM] };
  }

  const geaendertSet = new Set(eindeutig);
  const betroffeneAnker = anker.filter((a) => geaendertSet.has(a.id));

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
 * lehrplanAusYaml, schreibt zurueck.
 *
 * Den Kurznamen prueft es, bevor es liest: Er wird zum Pfad unter
 * `lehrplan/`, und nur einer nach dem Muster der Ids bleibt darunter --
 * `../aussen/kopie` schriebe sonst eine Datei neben `lehrplan/` um. Die
 * Kommandozeile prueft ihn schon; hier steht es trotzdem, weil diese Schicht
 * auch ohne sie aufgerufen werden kann -- etwa hinter dem Dev-Endpunkt
 * `/__auftrag`.
 *
 * `wartet`: Dem Lehrplan fehlt nach dem Auftrag noch die Freigabe.
 * Beauftragen geht auch dann; vor Durchgang A muss sie da sein.
 *
 * Gelesen wird die Datei als Bytes und als UTF-8 entschluesselt (`UTF8`).
 * Hat ein Editor sie in einer anderen Kodierung gespeichert, etwa ANSI,
 * bricht der Auftrag mit einem Satz ab und laesst sie stehen: Beim
 * Zurueckschreiben waere jeder Umlaut zerstoert.
 *
 * Scheitert das Schreiben an einem Systemaufruf -- etwa `EBUSY`, weil ein
 * Editor die Datei festhaelt --, wird daraus ein Satz mit dem Code. Ein
 * Fehler im Programm geht durch: Als Schreibfehler verkleidet, suchte man an
 * der Datei statt im Code. `schreibeDatei` ist nur fuer Tests austauschbar:
 * Eine Sperre, die erst zwischen Lesen und Schreiben greift, laesst sich
 * anders nicht herbeifuehren -- unter Windows sperrt sie die Datei auch gegen
 * das Lesen.
 *
 * @param {{
 *   wurzel: string,
 *   kurzname: string,
 *   ids: readonly string[],
 *   schreibeDatei?: (datei: string, text: string, kodierung: 'utf8') => void,
 * }} eingabe
 * @returns {{ geaendert: string[], datei: string, wartet: boolean }}
 */
export function beauftrageDatei({ wurzel, kurzname, ids, schreibeDatei = writeFileSync }) {
  if (!ID_MUSTER.test(kurzname)) throw new AuftragFehler(kurznameFalsch(kurzname));
  const relDatei = `lehrplan/${kurzname}.yaml`;
  const datei = path.join(wurzel, 'lehrplan', `${kurzname}.yaml`);

  let bytes;
  try {
    bytes = readFileSync(datei);
  } catch (fehler) {
    if (fehlercode(fehler) === 'ENOENT') throw new AuftragFehler(`${relDatei} gibt es nicht — erst einlesen.`);
    throw new AuftragFehler(`${relDatei} lässt sich nicht lesen (${fehlercode(fehler)}).`);
  }
  const text = alsUtf8(bytes);
  if (text === null) {
    throw new AuftragFehler(`${relDatei} ist nicht als UTF-8 gespeichert — bitte als UTF-8 speichern und neu aufrufen.`);
  }

  const ergebnis = beauftrage(text, ids);
  if (!ergebnis.ok) throw new AuftragFehler(ergebnis.maengel.join('\n'));

  const lektionsIds = lektionsIdsAus(path.join(wurzel, 'inhalt', 'lektionen'));
  const befund = lehrplanAusYaml(ergebnis.text, lektionsIds, relDatei);
  if (!befund.ok && !befund.wartet) throw new AuftragFehler(befund.maengel.join('\n'));

  try {
    schreibeDatei(datei, ergebnis.text, 'utf8');
  } catch (fehler) {
    if (!istSystemfehler(fehler)) throw fehler;
    throw new AuftragFehler(`${relDatei} lässt sich nicht schreiben (${fehlercode(fehler)}).`);
  }
  return { geaendert: ergebnis.geaendert, datei, wartet: !befund.ok };
}

/**
 * Liest die Kommandozeile: `--name <kurzname>` und die Abschnitt-Ids, in der
 * Reihenfolge der Kommandozeile und in beliebiger Folge mit `--name`. Fehlt
 * der Kurzname, sein Wert oder jede Id, kommt nur die Aufruf-Hilfe
 * (`meldung: null`). Eine fremde Option und ein Kurzname, der nicht dem
 * Muster der Ids folgt, bekommen einen Satz davor: Die Hilfe allein sagt
 * nicht, was an einem Aufruf falsch ist, der ihr zu folgen scheint -- und
 * bisher las die Kommandozeile etwa `--vor` still als Abschnitt-Id. Der
 * erste Fehler gewinnt; den Kurznamen prueft sie erst bei sonst
 * vollstaendigem Aufruf, wie pruefe-quelle.
 *
 * @param {readonly string[]} argv
 * @returns {{ ok: true, kurzname: string, ids: string[] } | { ok: false, meldung: string | null }}
 */
function leseArgv(argv) {
  let kurzname = '';
  /** @type {string[]} */
  const ids = [];
  for (let i = 0; i < argv.length; i++) {
    const argument = argv[i];
    if (argument === '--name') {
      const wert = argv[i + 1];
      if (wert === undefined || wert.startsWith('--')) return { ok: false, meldung: null };
      kurzname = wert;
      i++;
    } else if (argument.startsWith('--')) {
      return { ok: false, meldung: `Unbekannte Option ${argument}.` };
    } else {
      ids.push(argument);
    }
  }
  if (kurzname === '' || ids.length === 0) return { ok: false, meldung: null };
  if (!ID_MUSTER.test(kurzname)) return { ok: false, meldung: kurznameFalsch(kurzname) };
  return { ok: true, kurzname, ids };
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
  const aufruf = leseArgv(argv);
  if (!aufruf.ok) {
    if (aufruf.meldung !== null) schreibe(aufruf.meldung);
    schreibe(AUFRUF);
    return 2;
  }
  const { kurzname, ids } = aufruf;

  try {
    const { geaendert, wartet } = beauftrageDatei({ wurzel, kurzname, ids });
    const kopf = geaendert.length === 1 ? '1 Abschnitt beauftragt' : `${geaendert.length} Abschnitte beauftragt`;
    schreibe(`lehrplan/${kurzname}.yaml: ${kopf}`);
    for (const id of geaendert) schreibe(`  ${id}`);
    // Ohne Freigabe haelt pruefe-quelle --vor Durchgang A an: Sie kommt zuerst.
    schreibe(
      wartet
        ? `Nächster Schritt: freigeben (geprueftVon und geprueftAm in lehrplan/${kurzname}.yaml), dann Durchgang A — „Bau die Lektionen für ${kurzname}“.`
        : `Nächster Schritt: Durchgang A — „Bau die Lektionen für ${kurzname}“.`,
    );
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
