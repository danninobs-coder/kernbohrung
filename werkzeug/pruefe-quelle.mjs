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
 * Manifest (die Datei bytegenau, dieselben Seiten) und jeder Abschnitt des
 * Manifests im Lehrplan, mindestens einer ist beauftragt, und keine
 * Prinzip-Id steht schon in einem anderen Lehrplan. Dazu nennt es je
 * beauftragtem Abschnitt die Rohdatei, den Folienbereich und die Folien, die
 * der Compiler im Original ansehen muss — aus dem Manifest, nicht aus den
 * Hinweiszeilen der Rohdatei.
 *
 * `--nach` steht nach Durchgang B: kein Abschnitt mehr beauftragt, jede
 * Lektion da, keine Prinzip-Id doppelt, der Wortlaut jeder Lektion dieses
 * Lehrplans sauber. Fehlen die eigenen Rohdateien (`quellen/<k>/roh/*.md`,
 * etwa in einem Klon von GitHub), heisst es „nicht geprueft", nicht „in
 * Ordnung" — auch wenn andere Quellen Rohdateien haben.
 *
 * Ein eigenes Werkzeug und kein Teil von pruefe-lektion: Beide Pruefungen
 * muessen Lehrplan, Manifest und Lektionen zusammen sehen.
 *
 * Drei Schichten wie bei den anderen Werkzeugen: `pruefeVor` und `pruefeNach`
 * sind reine Funktionen ueber Texte, `pruefeVorDateien` und
 * `pruefeNachDateien` lesen unter einer Wurzel (und schreiben nichts), und
 * `fuehreAus` ist die Kommandozeile. Laesst sich dabei eine Datei oder ein
 * Ordner nicht lesen, bricht die Pruefung mit einem Satz ab, nicht mit einem
 * Stapelabzug.
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
 * Was vom Lehrplan zu lesen war. `wartet`: Es fehlt nur die Freigabe. Ein
 * ungueltiger traegt die Prinzip-Ids, die sich aus seinem YAML lesen lassen
 * (`rohePrinzipIds`).
 *
 * @typedef {{ zustand: 'fehlt' }} LehrplanFehlt
 * @typedef {{ zustand: 'repo' }} RepoLehrplan
 * @typedef {{ zustand: 'ungueltig', maengel: string[], prinzipIds: string[] }} UngueltigerLehrplan
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
 * Die Prinzip-Ids der Abschnitte, so weit sie sich aus dem YAML lesen lassen
 * — auch aus einem Lehrplan, den das Schema abweist: jede `id`, die als Text
 * in einem Prinzip unter `abschnitte` steht. Kein YAML, keine Liste, kein
 * Text: keine Id.
 *
 * @param {string} text
 * @returns {string[]}
 */
function rohePrinzipIds(text) {
  /** @type {unknown} */
  let roh;
  try {
    roh = yamlLesen(text);
  } catch (fehler) {
    if (fehler instanceof YAMLException) return [];
    throw fehler;
  }
  /** @type {(wert: unknown, name: string) => unknown} */
  const feld = (wert, name) =>
    wert !== null && typeof wert === 'object' ? /** @type {Record<string, unknown>} */ (wert)[name] : undefined;
  /** @type {(wert: unknown) => unknown[]} */
  const liste = (wert) => (Array.isArray(wert) ? wert : []);
  return liste(feld(roh, 'abschnitte')).flatMap((abschnitt) =>
    liste(feld(abschnitt, 'prinzipien')).flatMap((prinzip) => {
      const id = feld(prinzip, 'id');
      return typeof id === 'string' ? [id] : [];
    }),
  );
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
  return rohArt(lehrplanText) === 'repo'
    ? { zustand: 'repo' }
    : { zustand: 'ungueltig', maengel: befund.maengel, prinzipIds: rohePrinzipIds(lehrplanText) };
}

/**
 * Eine Lektionsmenge, in der es jede Lektion gibt: So liest `doppelteIds` die
 * anderen Lehrplaene. Das Schema fragt sie nur mit `has` (`pruefeLektionen`
 * in src/lib/lehrplan.ts).
 *
 * @type {ReadonlySet<string>}
 */
const JEDE_LEKTION = new (class extends Set {
  /** @returns {boolean} */
  has() {
    return true;
  }
})();

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
 * Mit zaehlt jeder andere Lehrplan, der gueltig ist oder nur auf die Freigabe
 * wartet — gelesen, als gaebe es jede Lektion (`JEDE_LEKTION`). Auch einer,
 * dem nur eine Lektion fehlt, beansprucht ihre Id: Die Datei, die sie
 * benennt, gehoert zu ihm, ob sie schon da ist oder nicht. Die Seite fuehrt
 * ihn bis dahin als ungueltig und zaehlt seine Ids nicht. Einer, der sich
 * nicht als Lehrplan lesen laesst — kein YAML, ein anderer Mangel am Schema
 * —, traegt keine Id.
 *
 * @param {Lehrmaterial} lehrplan
 * @param {readonly AndererLehrplan[]} andere
 * @returns {string[]}
 */
function doppelteIds(lehrplan, andere) {
  /** @type {Map<string, string>} Prinzip-Id -> die erste andere Datei, die sie traegt */
  const traeger = new Map();
  for (const { datei, text } of andere) {
    const befund = lehrplanAusYaml(text, JEDE_LEKTION, datei);
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
 * Auch bei gleichem Stand koennen Lehrplan und Manifest auseinanderlaufen:
 * Der Stand hasht nur die Originale. Liest man dieselben PDF mit anderer
 * Gliederung neu ein, bleibt er gleich, Manifest und Rohdateien werden
 * ersetzt — der Lehrplan bleibt, wie er ist; das Einlesen ueberschreibt ihn
 * nie. Deshalb muessen die Seiten jedes Abschnitts die aus dem Manifest sein,
 * und jeder Abschnitt des Manifests muss im Lehrplan stehen. Sonst arbeitete
 * der Compiler an Rohdateien, die anders geschnitten sind, als der Lehrplan
 * sagt.
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
      } else if (eintrag.seiten[0] !== abschnitt.seiten[0] || eintrag.seiten[1] !== abschnitt.seiten[1]) {
        const [von, bis] = abschnitt.seiten;
        const [mv, mb] = eintrag.seiten;
        maengel.push(
          `Abschnitt ${abschnitt.id}: seiten [${von}, ${bis}] im Lehrplan, [${mv}, ${mb}] im Manifest — neu eingelesen? Dann den Lehrplan nachziehen.`,
        );
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
    const imLehrplan = new Set(lehrplan.abschnitte.map((abschnitt) => abschnitt.id));
    for (const { id } of manifest.roh) {
      if (!imLehrplan.has(id)) {
        maengel.push(`Abschnitt ${id} steht im Manifest, aber nicht im Lehrplan — neu eingelesen? Dann den Lehrplan nachziehen.`);
      }
    }
  }
  if (!lehrplan.abschnitte.some((abschnitt) => abschnitt.status === 'beauftragt')) {
    maengel.push('Kein Abschnitt ist beauftragt — erst npm run auftrag.');
  }
  maengel.push(...doppelteIds(lehrplan, andere));

  const ok = maengel.length === 0;
  return { ok, maengel, auftrag: ok ? auftrag : [] };
}

/**
 * Nach Durchgang B.
 *
 * `wortlaut` traegt die Ids der Lektionen, deren Wortlaut zu nah an einer
 * Rohdatei ist — auch bei einem ungueltigen Lehrplan, damit alle Maengel auf
 * einmal dastehen —, oder ist `null`, wenn es die eigenen Rohdateien nicht
 * gibt. Dann steht ein Hinweis da, kein Mangel: nicht geprueft ist nicht in
 * Ordnung, aber auch nicht falsch.
 *
 * Die Freigabe verlangt die Pruefung nicht erneut, sie wurde vor Durchgang B
 * gesetzt. Fehlt sie jetzt, ist das ein Mangel: Durchgang B hat dann ohne sie
 * gearbeitet. Ob jede Lektion da ist, weiss das Schema (`status: lektion`
 * verlangt zu jedem Prinzip die Lektion gleicher Id); das meldet es als
 * Mangel des Lehrplans.
 *
 * Lehrplan und Manifest gleicht nur `pruefeVor` ab, vor jedem Durchgang.
 * Diese Pruefung kommt ohne Manifest aus: In einem Klon von GitHub gibt es
 * keines.
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
    maengel.push(...doppelteIds(plan.lehrplan, andere));
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
 * Ob `fehler` ein gescheiterter Systemaufruf ist — gesperrt, keine Rechte,
 * ein Ordner, wo eine Datei stehen sollte. Node gibt solchen Fehlern
 * `syscall` mit, einem Fehler im Programm nicht. Gleiches Muster wie
 * `istSystemfehler` in werkzeug/adapter/folien.mjs.
 *
 * @param {unknown} fehler
 * @returns {boolean}
 */
function istSystemfehler(fehler) {
  return fehler instanceof Error && typeof (/** @type {Error & { syscall?: unknown }} */ (fehler).syscall) === 'string';
}

/**
 * Was ein gescheiterter Lesezugriff unter `wurzel` wirft. Ein gescheiterter
 * Systemaufruf wird ein Satz statt eines Stapelabzugs, mit dem Pfad aus dem
 * Fehler, relativ zur Wurzel und mit Schraegstrichen. Traegt der Fehler
 * keinen Pfad — ein Ordner, wo eine Datei stehen sollte, scheitert erst beim
 * Lesen, und dessen Fehler nennt keinen —, steht `rel` da. Ein Fehler im
 * Programm geht unveraendert durch: Als Lesefehler verkleidet, suchte man an
 * der Datei statt im Code.
 *
 * @param {unknown} fehler
 * @param {string} wurzel
 * @param {string} rel was gelesen werden sollte, relativ zur Wurzel, mit Schraegstrichen
 * @returns {unknown}
 */
function lesefehler(fehler, wurzel, rel) {
  if (!istSystemfehler(fehler)) return fehler;
  const pfad = /** @type {Error & { path?: unknown }} */ (fehler).path;
  const ort = typeof pfad === 'string' ? path.relative(wurzel, pfad).split(path.sep).join('/') : rel;
  return new PruefeQuelleFehler(`${ort} lässt sich nicht lesen (${fehlercode(fehler)}).`);
}

/**
 * Liest mit `lesen` unter `wurzel`; scheitert es, wirft es `lesefehler`.
 *
 * @template T
 * @param {string} wurzel
 * @param {string} rel was gelesen werden soll, relativ zur Wurzel, mit Schraegstrichen
 * @param {() => T} lesen
 * @returns {T}
 */
function liesUnter(wurzel, rel, lesen) {
  try {
    return lesen();
  } catch (fehler) {
    throw lesefehler(fehler, wurzel, rel);
  }
}

/**
 * @param {string} pfad
 * @returns {boolean}
 */
function istOrdner(pfad) {
  return existsSync(pfad) && statSync(pfad).isDirectory();
}

/**
 * Eine Textdatei unter `wurzel`, `rel` mit Schraegstrichen — oder `null`,
 * wenn es sie nicht gibt. Laesst sie sich aus einem anderen Grund nicht
 * lesen, ist das kein „erst einlesen": Dann bricht die Pruefung mit dem Code
 * ab, wie der Auftrag (`lesefehler`).
 *
 * @param {string} wurzel
 * @param {string} rel
 * @returns {string | null}
 */
function liesText(wurzel, rel) {
  try {
    return readFileSync(path.join(wurzel, ...rel.split('/')), 'utf8');
  } catch (fehler) {
    if (fehlercode(fehler) === 'ENOENT') return null;
    throw lesefehler(fehler, wurzel, rel);
  }
}

/**
 * Die uebrigen `lehrplan/*.yaml` unter `wurzel` — dieselben Dateien, die die
 * Seite liest —, nach Codepunkten sortiert, mit dem Pfad, der im Mangel
 * steht. Laesst sich eine davon nicht lesen oder der Ordner nicht auflisten,
 * bricht die Pruefung ab wie beim eigenen Lehrplan: Sie uebersaehe sonst
 * still eine Doppelung. Eine Datei, die sich lesen, aber nicht als Lehrplan
 * verstehen laesst, zaehlt dagegen nicht mit (`doppelteIds`), und ein Ordner,
 * der wie ein Lehrplan heisst, ist keiner: Auch die Seite liest nur Dateien.
 *
 * @param {string} wurzel
 * @param {string} kurzname
 * @returns {AndererLehrplan[]}
 */
function andereLehrplaene(wurzel, kurzname) {
  const ordner = path.join(wurzel, 'lehrplan');
  if (!liesUnter(wurzel, 'lehrplan', () => istOrdner(ordner))) return [];
  const eigene = `${kurzname}.yaml`;
  const namen = liesUnter(wurzel, 'lehrplan', () => readdirSync(ordner, { withFileTypes: true }))
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
 * Ob unter `quellen/<kurzname>/roh/` mindestens eine Rohdatei liegt — nach
 * derselben Regel, nach der `liesRohIndex` sie liest: eine Datei auf `.md`.
 *
 * @param {string} wurzel
 * @param {string} kurzname
 * @returns {boolean}
 */
function hatEigeneRohdateien(wurzel, kurzname) {
  const ordner = path.join(wurzel, 'quellen', kurzname, 'roh');
  return liesUnter(
    wurzel,
    `quellen/${kurzname}/roh`,
    () =>
      istOrdner(ordner) &&
      readdirSync(ordner, { withFileTypes: true }).some((eintrag) => eintrag.isFile() && eintrag.name.endsWith('.md')),
  );
}

/**
 * Der Wortlaut der Lektionen zu den Prinzipien dieses Lehrplans gegen alle
 * Rohdateien unter `wurzel` (`liesRohIndex`): die Ids der Lektionen mit
 * mindestens einer Abschrift. Eine Lektion, die fehlt, prueft das Schema;
 * eine Lektion ohne Prinzip in diesem Lehrplan ist nicht Sache dieser
 * Pruefung.
 *
 * `null` — nicht geprueft —, solange die eigenen Rohdateien fehlen
 * (`quellen/<kurzname>/roh/*.md`), auch wenn andere Quellen welche haben:
 * Sonst hiesse es „in Ordnung", ohne dass je gegen die eigene Vorlesung
 * geprueft worden waere. Sind sie da, zaehlen alle Rohdateien, auch die
 * anderer Quellen.
 *
 * Auch ein ungueltiger Lehrplan hat Lektionen, und alle Maengel sollen auf
 * einmal dastehen: Dann kommen die Prinzip-Ids aus seinem YAML, so weit es
 * sich lesen laesst (`rohePrinzipIds`).
 *
 * @param {string} wurzel
 * @param {string} kurzname
 * @param {string | null} lehrplanText
 * @param {ReadonlySet<string>} lektionsIds
 * @returns {{ ids: string[] } | null}
 */
function wortlautUnter(wurzel, kurzname, lehrplanText, lektionsIds) {
  if (!hatEigeneRohdateien(wurzel, kurzname)) return null;
  const roh = liesUnter(wurzel, 'quellen', () => liesRohIndex(wurzel));
  if (roh === null) return null;
  const plan = lesePlan(lehrplanText, lektionsIds);
  const prinzipIds =
    plan.zustand === 'lesbar' ? prinzipIdsVon(plan.lehrplan) : plan.zustand === 'ungueltig' ? plan.prinzipIds : [];
  const ids = prinzipIds.filter((id) => lektionsIds.has(id));
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
    wortlaut: wortlautUnter(wurzel, kurzname, lehrplanText, lektionsIds),
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
