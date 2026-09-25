#!/usr/bin/env node
/**
 * Vor- und Nachpruefung eines Compiler-Durchgangs an Lehrmaterial: was
 * stimmen muss, bevor der Compiler an beauftragten Abschnitten arbeitet, und
 * was, wenn er fertig ist.
 *
 *   npm run pruefe-quelle -- --name <kurzname> --vor | --nach
 *
 * `--vor` steht vor Durchgang A und wieder vor Durchgang B: Der Lehrplan ist
 * freigegeben, sein Stand passt zum Manifest, jeder Abschnitt steht im
 * Manifest (die Datei bytegenau), mindestens einer ist beauftragt, und keine
 * Prinzip-Id steht schon in einem anderen Lehrplan. Dazu nennt es je
 * beauftragtem Abschnitt die Rohdatei, den Folienbereich und die Folien, die
 * der Compiler im Original ansehen muss — aus dem Manifest, nicht aus den
 * Hinweiszeilen der Rohdatei.
 *
 * `--nach` steht nach Durchgang B: kein Abschnitt mehr beauftragt, jede
 * Lektion da, keine Prinzip-Id doppelt, der Wortlaut jeder Lektion dieses
 * Lehrplans sauber. Fehlen die Rohdateien (ein Klon von GitHub), heisst es
 * „nicht geprueft", nicht „in Ordnung".
 *
 * Ein eigenes Werkzeug und kein Teil von pruefe-lektion: Beide Pruefungen
 * muessen Lehrplan, Manifest und Lektionen zusammen sehen.
 *
 * Drei Schichten wie bei den anderen Werkzeugen: `pruefeVor` und `pruefeNach`
 * sind reine Funktionen ueber Texte, `pruefeVorDateien` und
 * `pruefeNachDateien` lesen unter einer Wurzel (und schreiben nichts), und
 * `fuehreAus` ist die Kommandozeile.
 *
 * **Auf der Konsole steht nie Folientext** — nur Ids, Pfade, Dateinamen und
 * Foliennummern.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
// Namentlich, nicht als Vorgabe-Import: js-yaml 5 liefert unter `import` ein
// ESM-Buendel ohne Default-Export. Siehe werkzeug/pruefe-lektion.mjs.
import { load as yamlLesen, YAMLException } from 'js-yaml';
import { kurzstand } from '../src/lib/bestandstext.ts';
import { ID as ID_MUSTER, lehrplanAusYaml, prinzipIdsVon } from '../src/lib/lehrplan.ts';
import { liesDokumentManifest } from './dokument-manifest.mjs';
import { lektionsIdsAus } from './lehrplan.mjs';
import { findeAbschriften, lektionFelder, liesRohIndex } from './wortlaut.mjs';

const AUFRUF = 'Aufruf: npm run pruefe-quelle -- --name <kurzname> --vor | --nach';

/** Der Hinweis, wenn es keine Rohdatei gibt — kein Mangel, aber auch kein „in Ordnung". */
const NICHT_GEPRUEFT = 'Wortlaut nicht geprüft: keine Rohdateien am Rechner.';

/** Bricht die Pruefung mit einer Meldung ab, die man dem Nutzer zeigen kann. */
export class PruefeQuelleFehler extends Error {}

/**
 * @typedef {import('../src/lib/lehrplan.ts').Lehrplan} Lehrplan
 * @typedef {Extract<Lehrplan, { art: 'buch' | 'folien' }>} Lehrmaterial
 * @typedef {{ datei: string, text: string }} AndererLehrplan
 * @typedef {{
 *   id: string,
 *   titel: string,
 *   datei: string,
 *   seiten: [number, number],
 *   roh: string,
 *   nurBild: number[],
 *   tabellenverdacht: number[],
 * }} AuftragsAbschnitt
 * @typedef {{ ok: boolean, maengel: string[], auftrag: AuftragsAbschnitt[] }} VorBefund
 * @typedef {{ ok: boolean, maengel: string[], hinweise: string[] }} NachBefund
 */

/**
 * Was vom Lehrplan zu lesen war. `wartet`: Es fehlt nur die Freigabe.
 *
 * @typedef {{ zustand: 'fehlt' }} LehrplanFehlt
 * @typedef {{ zustand: 'repo' }} RepoLehrplan
 * @typedef {{ zustand: 'ungueltig', maengel: string[] }} UngueltigerLehrplan
 * @typedef {{ zustand: 'lesbar', lehrplan: Lehrmaterial, wartet: boolean }} LesbarerLehrplan
 * @typedef {LehrplanFehlt | RepoLehrplan | UngueltigerLehrplan | LesbarerLehrplan} GelesenerLehrplan
 */

/**
 * @param {string} kurzname
 * @returns {string}
 */
function lehrplanFehlt(kurzname) {
  return `lehrplan/${kurzname}.yaml gibt es nicht — erst einlesen.`;
}

/**
 * @param {string} kurzname
 * @returns {string}
 */
function nurLehrmaterial(kurzname) {
  return `pruefe-quelle gilt für Lehrmaterial; lehrplan/${kurzname}.yaml trägt art: repo.`;
}

/**
 * `art` so, wie es im Text steht — auch in einem Lehrplan, den das Schema
 * abweist. `undefined`, wenn der Text kein YAML ist oder kein `art` traegt.
 *
 * @param {string} text
 * @returns {unknown}
 */
function rohArt(text) {
  let roh;
  try {
    roh = yamlLesen(text);
  } catch (fehler) {
    if (fehler instanceof YAMLException) return undefined;
    throw fehler;
  }
  return roh !== null && typeof roh === 'object' ? /** @type {Record<string, unknown>} */ (roh).art : undefined;
}

/**
 * Liest den Lehrplan dieser Quelle so weit, wie beide Pruefungen ihn brauchen.
 *
 * Ein Repo-Lehrplan wird auch dann erkannt, wenn das Schema ihn abweist: Wer
 * dieses Werkzeug an einem Repo aufruft, hat das falsche Werkzeug gewaehlt —
 * dann steht nur das da, nicht die Maengel eines Lehrplans, den es ohnehin
 * nicht prueft.
 *
 * @param {string | null} lehrplanText
 * @param {ReadonlySet<string>} lektionsIds
 * @returns {GelesenerLehrplan}
 */
function lesePlan(lehrplanText, lektionsIds) {
  if (lehrplanText === null) return { zustand: 'fehlt' };
  // Der Name steht nur in der Meldung zu kaputtem YAML („Lehrplan ist kein
  // gueltiges YAML …", wie beim Auftrag); die Datei nennt der Praefix, den
  // beide Pruefungen vor jeden Mangel des Lehrplans setzen.
  const befund = lehrplanAusYaml(lehrplanText, lektionsIds, 'Lehrplan');
  if (befund.ok || befund.wartet) {
    const { lehrplan } = befund;
    return lehrplan.art === 'repo' ? { zustand: 'repo' } : { zustand: 'lesbar', lehrplan, wartet: !befund.ok };
  }
  return rohArt(lehrplanText) === 'repo' ? { zustand: 'repo' } : { zustand: 'ungueltig', maengel: befund.maengel };
}

/**
 * Die Prinzip-Ids dieses Lehrplans, die schon ein anderer traegt — je Id ein
 * Mangel mit der ersten anderen Datei, die sie traegt.
 *
 * Eine Prinzip-Id benennt eine Lektionsdatei; deshalb ist sie ueber alle
 * Lehrplaene eindeutig. Die Seite prueft das erst beim Bau
 * (`lehrplaeneAusTexten`); hier sieht es der Compiler, bevor Durchgang B die
 * Lektion eines anderen Lehrplans ueberschreibt. Anders als auf der Seite
 * zaehlt jede Doppelung, gleich welcher der beiden Lehrplaene freigegeben
 * ist: Die eine Lektionsdatei ueberschriebe die andere in jedem Fall.
 *
 * Mit zaehlt, wie auf der Seite, jeder andere Lehrplan, der gueltig ist oder
 * nur auf die Freigabe wartet. Einer, der sich nicht lesen laesst, traegt
 * keine Id.
 *
 * @param {Lehrmaterial} lehrplan
 * @param {readonly AndererLehrplan[]} andere
 * @param {ReadonlySet<string>} lektionsIds
 * @returns {string[]}
 */
function doppelteIds(lehrplan, andere, lektionsIds) {
  /** @type {Map<string, string>} Prinzip-Id -> die erste andere Datei, die sie traegt */
  const traeger = new Map();
  for (const { datei, text } of andere) {
    const befund = lehrplanAusYaml(text, lektionsIds, datei);
    if (!befund.ok && !befund.wartet) continue;
    for (const id of prinzipIdsVon(befund.lehrplan)) {
      if (!traeger.has(id)) traeger.set(id, datei);
    }
  }
  return prinzipIdsVon(lehrplan).flatMap((id) => {
    const datei = traeger.get(id);
    return datei === undefined
      ? []
      : [`Prinzip ${id}: die Id steht schon in ${datei}; Lektion und Prinzip teilen sich die Id.`];
  });
}

/**
 * Vor Durchgang A und vor Durchgang B. Rein ueber Texte.
 *
 * `lehrplanText` und `manifestText` sind `null`, wenn es die Datei nicht
 * gibt. `andere` sind die uebrigen `lehrplan/*.yaml`, jeweils mit dem Pfad,
 * der im Mangel steht.
 *
 * Alle Maengel auf einmal, wie bei pruefe-lektion: Der Mensch soll nach einem
 * Lauf wissen, was alles fehlt — Freigabe und Auftrag etwa —, statt sich von
 * Mangel zu Mangel zu tasten. Weg faellt nur, was ein Mangel gegenstandslos
 * macht: Ohne Lehrplan und bei einem Repo-Lehrplan steht nur dieser eine Satz
 * da, ein ungueltiger Lehrplan traegt keine Abschnitte, und bei einem anderen
 * Stand wird kein Abschnitt gegen das Manifest gehalten — es gehoert dann zu
 * anderen Originalen.
 *
 * Die Datei eines Abschnitts muss bytegenau die sein, die das Manifest fuer
 * denselben Abschnitt nennt: Ein Dateiname mit zwei Leerzeichen, im Lehrplan
 * zu einem geglaettet, fuehrte den Compiler zu einer Datei, die es nicht gibt.
 * Verglichen wird der Wert, wie ihn das Schema liest (ohne Leerraum am Rand) —
 * so, wie ihn Seite und Compiler sehen.
 *
 * `auftrag` bleibt leer, solange es einen Mangel gibt. Sonst traegt es je
 * beauftragtem Abschnitt, in der Reihenfolge des Lehrplans, Id, Titel und
 * Datei aus dem Lehrplan, dazu den Pfad der Rohdatei und aus dem Manifest den
 * Folienbereich und die Folienlisten — dieselben Folien, die die Rohdatei
 * enthaelt und `npm run ansicht` rendert.
 *
 * @param {{
 *   kurzname: string,
 *   lehrplanText: string | null,
 *   manifestText: string | null,
 *   lektionsIds: ReadonlySet<string>,
 *   andere: readonly AndererLehrplan[],
 * }} eingabe
 * @returns {VorBefund}
 */
export function pruefeVor({ kurzname, lehrplanText, manifestText, lektionsIds, andere }) {
  const datei = `lehrplan/${kurzname}.yaml`;
  const plan = lesePlan(lehrplanText, lektionsIds);
  if (plan.zustand === 'fehlt') return { ok: false, maengel: [lehrplanFehlt(kurzname)], auftrag: [] };
  if (plan.zustand === 'repo') return { ok: false, maengel: [nurLehrmaterial(kurzname)], auftrag: [] };

  /** @type {string[]} */
  const maengel = [];
  if (plan.zustand === 'ungueltig') {
    maengel.push(...plan.maengel.map((mangel) => `${datei}: ${mangel}`));
  } else if (plan.wartet) {
    maengel.push(`Erst freigeben: ${datei} wartet auf Freigabe (geprueftVon und geprueftAm).`);
  }

  /** @type {import('./dokument-manifest.mjs').DokumentManifest | null} */
  let manifest = null;
  if (manifestText === null) {
    maengel.push(`quellen/${kurzname}/manifest.json gibt es nicht — erst einlesen.`);
  } else {
    const gelesen = liesDokumentManifest(manifestText);
    if (gelesen.ok) manifest = gelesen.manifest;
    else maengel.push(`quellen/${kurzname}/manifest.json lässt sich nicht lesen (${gelesen.grund}).`);
  }
  if (plan.zustand === 'ungueltig') return { ok: false, maengel, auftrag: [] };

  const { lehrplan } = plan;
  /** @type {AuftragsAbschnitt[]} */
  const auftrag = [];
  if (manifest !== null && lehrplan.stand !== manifest.stand) {
    maengel.push(
      `Der Stand im Lehrplan (${kurzstand(lehrplan.stand)}) passt nicht zum Manifest (${kurzstand(manifest.stand)}) — neu eingelesen? Dann den Lehrplan nachziehen.`,
    );
  } else if (manifest !== null) {
    for (const abschnitt of lehrplan.abschnitte) {
      const eintrag = manifest.roh.find((r) => r.id === abschnitt.id);
      if (eintrag === undefined) {
        maengel.push(`Abschnitt ${abschnitt.id} steht nicht im Manifest.`);
      } else if (eintrag.datei !== abschnitt.datei) {
        maengel.push(`Abschnitt ${abschnitt.id}: die Datei ${JSON.stringify(abschnitt.datei)} steht nicht im Manifest.`);
      } else if (abschnitt.status === 'beauftragt') {
        auftrag.push({
          id: abschnitt.id,
          titel: abschnitt.titel,
          datei: abschnitt.datei,
          seiten: eintrag.seiten,
          roh: `quellen/${kurzname}/roh/${abschnitt.id}.md`,
          nurBild: eintrag.nurBild,
          tabellenverdacht: eintrag.tabellenverdacht,
        });
      }
    }
  }
  if (!lehrplan.abschnitte.some((abschnitt) => abschnitt.status === 'beauftragt')) {
    maengel.push('Kein Abschnitt ist beauftragt — erst npm run auftrag.');
  }
  maengel.push(...doppelteIds(lehrplan, andere, lektionsIds));

  const ok = maengel.length === 0;
  return { ok, maengel, auftrag: ok ? auftrag : [] };
}

/**
 * Nach Durchgang B.
 *
 * `wortlaut` traegt die Ids der Lektionen, deren Wortlaut zu nah an einer
 * Rohdatei ist — oder ist `null`, wenn es keine Rohdatei gibt. Dann steht
 * ein Hinweis da, kein Mangel: nicht geprueft ist nicht in Ordnung, aber auch
 * nicht falsch.
 *
 * Die Freigabe verlangt die Pruefung nicht erneut, sie wurde vor Durchgang B
 * gesetzt. Fehlt sie jetzt, ist das ein Mangel: Durchgang B hat dann ohne sie
 * gearbeitet. Ob jede Lektion da ist, weiss das Schema (`status: lektion`
 * verlangt zu jedem Prinzip die Lektion gleicher Id); das meldet es als
 * Mangel des Lehrplans.
 *
 * @param {{
 *   kurzname: string,
 *   lehrplanText: string | null,
 *   lektionsIds: ReadonlySet<string>,
 *   wortlaut: { ids: readonly string[] } | null,
 *   andere: readonly AndererLehrplan[],
 * }} eingabe
 * @returns {NachBefund}
 */
export function pruefeNach({ kurzname, lehrplanText, lektionsIds, wortlaut, andere }) {
  const datei = `lehrplan/${kurzname}.yaml`;
  const plan = lesePlan(lehrplanText, lektionsIds);
  if (plan.zustand === 'fehlt') return { ok: false, maengel: [lehrplanFehlt(kurzname)], hinweise: [] };
  if (plan.zustand === 'repo') return { ok: false, maengel: [nurLehrmaterial(kurzname)], hinweise: [] };

  /** @type {string[]} */
  const maengel = [];
  if (plan.zustand === 'ungueltig') {
    maengel.push(...plan.maengel.map((mangel) => `${datei}: ${mangel}`));
  } else {
    if (plan.wartet) maengel.push(`${datei} wartet auf Freigabe — Durchgang B beginnt erst nach der Freigabe.`);
    for (const abschnitt of plan.lehrplan.abschnitte) {
      if (abschnitt.status === 'beauftragt') {
        maengel.push(
          `Abschnitt ${abschnitt.id} steht noch auf beauftragt — jeder Abschnitt endet als lektion oder abgelehnt.`,
        );
      }
    }
    maengel.push(...doppelteIds(plan.lehrplan, andere, lektionsIds));
  }
  for (const id of wortlaut?.ids ?? []) {
    maengel.push(
      `Lektion ${id}: Wortlaut zu nah an der Quelle — npm run pruefe-lektion -- inhalt/lektionen/${id}.mdx zeigt die Stelle.`,
    );
  }
  return { ok: maengel.length === 0, maengel, hinweise: wortlaut === null ? [NICHT_GEPRUEFT] : [] };
}

// ---------------------------------------------------------------------------
// Unter einer Wurzel
// ---------------------------------------------------------------------------

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
 * Eine Textdatei unter `wurzel`, `rel` mit Schraegstrichen — oder `null`,
 * wenn es sie nicht gibt. Laesst sie sich aus einem anderen Grund nicht
 * lesen, ist das kein „erst einlesen": Dann bricht die Pruefung mit dem Code
 * ab, wie der Auftrag.
 *
 * @param {string} wurzel
 * @param {string} rel
 * @returns {string | null}
 */
function liesText(wurzel, rel) {
  try {
    return readFileSync(path.join(wurzel, ...rel.split('/')), 'utf8');
  } catch (fehler) {
    const code = fehlercode(fehler);
    if (code === 'ENOENT') return null;
    throw new PruefeQuelleFehler(`${rel} lässt sich nicht lesen (${code}).`);
  }
}

/**
 * Die uebrigen `lehrplan/*.yaml` unter `wurzel` — dieselben Dateien, die die
 * Seite liest —, nach Codepunkten sortiert, mit dem Pfad, der im Mangel
 * steht. Laesst sich eine davon nicht lesen, bricht die Pruefung ab wie beim
 * eigenen Lehrplan: Sie uebersaehe sonst still eine Doppelung. Eine Datei,
 * die sich lesen, aber nicht als Lehrplan verstehen laesst, zaehlt dagegen
 * nicht mit (`doppelteIds`).
 *
 * @param {string} wurzel
 * @param {string} kurzname
 * @returns {AndererLehrplan[]}
 */
function andereLehrplaene(wurzel, kurzname) {
  const ordner = path.join(wurzel, 'lehrplan');
  if (!existsSync(ordner) || !statSync(ordner).isDirectory()) return [];
  const eigene = `${kurzname}.yaml`;
  const namen = readdirSync(ordner, { withFileTypes: true })
    .filter((eintrag) => eintrag.isFile() && eintrag.name.endsWith('.yaml') && eintrag.name !== eigene)
    .map((eintrag) => eintrag.name)
    .sort();
  /** @type {AndererLehrplan[]} */
  const andere = [];
  for (const name of namen) {
    const text = liesText(wurzel, `lehrplan/${name}`);
    if (text !== null) andere.push({ datei: `lehrplan/${name}`, text });
  }
  return andere;
}

/**
 * Liest unter `wurzel` Lehrplan, Manifest, die Lektionen, die es gibt, und
 * die uebrigen Lehrplaene und prueft vor einem Durchgang. Schreibt nichts.
 *
 * @param {{ wurzel: string, kurzname: string }} eingabe
 * @returns {VorBefund}
 */
export function pruefeVorDateien({ wurzel, kurzname }) {
  return pruefeVor({
    kurzname,
    lehrplanText: liesText(wurzel, `lehrplan/${kurzname}.yaml`),
    manifestText: liesText(wurzel, `quellen/${kurzname}/manifest.json`),
    lektionsIds: lektionsIdsAus(path.join(wurzel, 'inhalt', 'lektionen')),
    andere: andereLehrplaene(wurzel, kurzname),
  });
}

/**
 * Der Wortlaut der Lektionen zu den Prinzipien dieses Lehrplans gegen alle
 * Rohdateien unter `wurzel` (`liesRohIndex`): die Ids der Lektionen mit
 * mindestens einer Abschrift. `null`, wenn es keine Rohdatei gibt. Eine
 * Lektion, die fehlt, prueft das Schema; eine Lektion ohne Prinzip in diesem
 * Lehrplan ist nicht Sache dieser Pruefung.
 *
 * @param {string} wurzel
 * @param {string | null} lehrplanText
 * @param {ReadonlySet<string>} lektionsIds
 * @returns {{ ids: string[] } | null}
 */
function wortlautUnter(wurzel, lehrplanText, lektionsIds) {
  const roh = liesRohIndex(wurzel);
  if (roh === null) return null;
  const plan = lesePlan(lehrplanText, lektionsIds);
  const ids = plan.zustand === 'lesbar' ? prinzipIdsVon(plan.lehrplan).filter((id) => lektionsIds.has(id)) : [];
  return {
    ids: ids.filter((id) => {
      const text = liesText(wurzel, `inhalt/lektionen/${id}.mdx`);
      return text !== null && findeAbschriften(lektionFelder(text), roh.index).length > 0;
    }),
  };
}

/**
 * Liest unter `wurzel` Lehrplan, Lektionen, Rohdateien und die uebrigen
 * Lehrplaene und prueft nach Durchgang B. Schreibt nichts.
 *
 * @param {{ wurzel: string, kurzname: string }} eingabe
 * @returns {NachBefund}
 */
export function pruefeNachDateien({ wurzel, kurzname }) {
  const lehrplanText = liesText(wurzel, `lehrplan/${kurzname}.yaml`);
  const lektionsIds = lektionsIdsAus(path.join(wurzel, 'inhalt', 'lektionen'));
  return pruefeNach({
    kurzname,
    lehrplanText,
    lektionsIds,
    wortlaut: wortlautUnter(wurzel, lehrplanText, lektionsIds),
    andere: andereLehrplaene(wurzel, kurzname),
  });
}

// ---------------------------------------------------------------------------
// Kommandozeile
// ---------------------------------------------------------------------------

/**
 * `16, 19, 20` — oder `–`, wenn die Liste leer ist.
 *
 * @param {readonly number[]} folien
 * @returns {string}
 */
function folienliste(folien) {
  return folien.length === 0 ? '–' : folien.join(', ');
}

/**
 * `Folien 11–18`, eine einzelne Folie `Folie 5`.
 *
 * @param {readonly [number, number]} seiten
 * @returns {string}
 */
function folienbereich([von, bis]) {
  return von === bis ? `Folie ${von}` : `Folien ${von}–${bis}`;
}

/**
 * Liest die Kommandozeile: `--name <kurzname>` und genau eines von `--vor`
 * und `--nach`, in beliebiger Reihenfolge. `null`, wenn etwas fehlt, zu viel
 * oder fremd ist — dann kommt die Aufruf-Hilfe. Ein Kurzname folgt dem Muster
 * der Ids; er ist ein Ordner unter `quellen/`, und nur darunter wird gelesen.
 *
 * @param {readonly string[]} argv
 * @returns {{ kurzname: string, modus: 'vor' | 'nach' } | null}
 */
function leseArgv(argv) {
  let kurzname = '';
  /** @type {'vor' | 'nach' | null} */
  let modus = null;
  for (let i = 0; i < argv.length; i++) {
    const argument = argv[i];
    if (argument === '--name') {
      const wert = argv[i + 1];
      if (wert === undefined || wert.startsWith('--')) return null;
      kurzname = wert;
      i++;
    } else if (argument === '--vor' || argument === '--nach') {
      if (modus !== null) return null;
      modus = argument === '--vor' ? 'vor' : 'nach';
    } else {
      return null;
    }
  }
  return modus !== null && ID_MUSTER.test(kurzname) ? { kurzname, modus } : null;
}

/**
 * Kommandozeile: npm run pruefe-quelle -- --name <kurzname> --vor | --nach
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
  const { kurzname, modus } = aufruf;
  const datei = `lehrplan/${kurzname}.yaml`;

  try {
    if (modus === 'vor') {
      const ergebnis = pruefeVorDateien({ wurzel, kurzname });
      if (!ergebnis.ok) {
        for (const mangel of ergebnis.maengel) schreibe(mangel);
        return 1;
      }
      const n = ergebnis.auftrag.length;
      schreibe(`${datei}: freigegeben, Stand passt zum Manifest.`);
      schreibe(`Beauftragt: ${n === 1 ? '1 Abschnitt' : `${n} Abschnitte`}`);
      for (const a of ergebnis.auftrag) {
        schreibe(
          `  ${a.id} — ${a.roh}, ${folienbereich(a.seiten)} · nur Bild: ${folienliste(a.nurBild)} · Tabelle oder Grafik: ${folienliste(a.tabellenverdacht)}`,
        );
      }
      return 0;
    }

    const ergebnis = pruefeNachDateien({ wurzel, kurzname });
    if (ergebnis.ok) {
      // Ohne Rohdateien kein „Wortlaut in Ordnung": Der Satz endet vorher,
      // der Hinweis folgt als eigene Zeile.
      schreibe(
        ergebnis.hinweise.includes(NICHT_GEPRUEFT)
          ? `${datei}: kein Abschnitt mehr beauftragt, alle Lektionen da.`
          : `${datei}: kein Abschnitt mehr beauftragt, alle Lektionen da, Wortlaut in Ordnung.`,
      );
    } else {
      for (const mangel of ergebnis.maengel) schreibe(mangel);
    }
    for (const hinweis of ergebnis.hinweise) schreibe(hinweis);
    return ergebnis.ok ? 0 : 1;
  } catch (fehler) {
    if (!(fehler instanceof PruefeQuelleFehler)) throw fehler;
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
