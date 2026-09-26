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
 * Beide pruefen dazu zweierlei:
 *
 * - **Den Wortlaut des Lehrplans** (`lehrplanFelder`): jeden Text darin —
 *   oben, an Abschnitten und Prinzipien, auch in Feldern, die das Schema
 *   nicht kennt, und in Schluesseln —, ausser was in fester Form dasteht,
 *   dazu die Kommentare; gegen dieselben Rohdateien wie die Lektionen. Die
 *   Rohdateien bleiben am Rechner, der Lehrplan liegt im Git, und `grund`
 *   steht sogar auf der Bibliotheksseite: Ein Satz, den der Compiler von
 *   einer Folie in den Lehrplan uebernaehme, laege sonst ungeprueft im Repo.
 *   Fehlen die eigenen Rohdateien, gibt es fuer `--vor` keinen Durchgang
 *   (erst einlesen); `--nach` sagt wie bei den Lektionen „nicht geprueft".
 * - **Ob jede vorhandene Lektion zu ihrem Prinzip passt**: `prinzip` ist sein
 *   `satz`, der `vorbehalt` derselbe — auch bei einem ungueltigen Lehrplan,
 *   so weit er sich lesen laesst. Die Anleitung des Compilers verlangt das,
 *   auch fuer eine uebernommene Lektion — deren Satz uebernimmt der
 *   Lehrplan. Ohne die Pruefung fiele ein Vorbehalt still weg, und eine
 *   versehentlich gewaehlte fremde Id fiele nicht auf.
 *
 * Fehlt einem ungueltigen Lehrplan auch die Freigabe, in beiden Feldern,
 * steht vorn derselbe Satz wie bei einem, dem nur sie fehlt, und die Saetze
 * des Schemas zu `geprueftVon` und `geprueftAm` entfallen: Der Compiler laese
 * darin eine Aufforderung, die Freigabe zu fuellen — genau das darf er nie.
 *
 * Ein eigenes Werkzeug und kein Teil von pruefe-lektion: Beide Pruefungen
 * muessen Lehrplan, Manifest und Lektionen zusammen sehen.
 *
 * Drei Schichten wie bei den anderen Werkzeugen: `pruefeVor` und `pruefeNach`
 * sind reine Funktionen ueber Texte, `pruefeVorDateien` und
 * `pruefeNachDateien` lesen unter einer Wurzel (und schreiben nichts), und
 * `fuehreAus` ist die Kommandozeile. Laesst sich dabei eine Datei oder ein
 * Ordner nicht lesen, bricht die Pruefung mit einem Satz ab, nicht mit einem
 * Stapelabzug. Den Kurznamen prueft die mittlere Schicht selbst, bevor sie
 * etwas liest — nicht erst die Kommandozeile.
 *
 * **Auf der Konsole steht nie Folientext** — nur Ids, Pfade, Dateinamen und
 * Foliennummern. Ein Schluessel steht in keiner Meldung, wenn er nicht wie
 * ein Feldname aussieht (`FELDNAME` in src/lib/lehrplan.ts).
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
// Namentlich, nicht als Vorgabe-Import: js-yaml 5 liefert unter `import` ein
// ESM-Buendel ohne Default-Export. Siehe werkzeug/pruefe-lektion.mjs.
import { load as yamlLesen, YAMLException } from 'js-yaml';
import { kurzstand } from '../src/lib/bestandstext.ts';
import {
  FELDNAME,
  FREIGABE,
  ID as ID_MUSTER,
  STATUS,
  fehltWirklich,
  lehrplanAusYaml,
  prinzipIdsVon,
} from '../src/lib/lehrplan.ts';
import { liesDokumentManifest } from './dokument-manifest.mjs';
import { lektionsIdsAus } from './lehrplan.mjs';
import { FRONTMATTER } from './lektion-lesen.mjs';
import { abschriftSatz, findeAbschriften, lektionFelder, liesRohIndex } from './wortlaut.mjs';

const AUFRUF = 'Aufruf: npm run pruefe-quelle -- --name <kurzname> --vor | --nach';

/** Der Hinweis, wenn es keine Rohdatei gibt — kein Mangel, aber auch kein „in Ordnung". */
const NICHT_GEPRUEFT = 'Wortlaut nicht geprüft: keine Rohdateien am Rechner.';

/** Bricht die Pruefung mit einer Meldung ab, die man dem Nutzer zeigen kann. */
export class PruefeQuelleFehler extends Error {}

/**
 * @typedef {import('../src/lib/lehrplan.ts').Lehrplan} Lehrplan
 * @typedef {Extract<Lehrplan, { art: 'buch' | 'folien' }>} Lehrmaterial
 * @typedef {import('./wortlaut.mjs').Feld} Feld
 * @typedef {import('./wortlaut.mjs').Index} Index
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
 * Was vom Lehrplan zu lesen war. `wartet`: Die Freigabe fehlt — beim
 * lesbaren als einziger Mangel, beim ungueltigen in beiden Feldern neben
 * anderen Maengeln; dessen Saetze des Schemas zur Freigabe sind dann schon
 * heraus. Ein ungueltiger traegt die Prinzip-Ids, die sich aus seinem YAML
 * lesen lassen (`rohePrinzipIds`).
 *
 * @typedef {{ zustand: 'repo' }} RepoLehrplan
 * @typedef {{ zustand: 'ungueltig', maengel: string[], prinzipIds: string[], wartet: boolean }} UngueltigerLehrplan
 * @typedef {{ zustand: 'lesbar', lehrplan: Lehrmaterial, wartet: boolean }} LesbarerLehrplan
 * @typedef {RepoLehrplan | UngueltigerLehrplan | LesbarerLehrplan} GelesenerLehrplan
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
 * Ein Kurzname, der nicht dem Muster der Ids folgt. Derselbe Satz wie in
 * werkzeug/ansicht.mjs und beim Einlesen: Es ist derselbe Fehler.
 *
 * @param {string} kurzname
 * @returns {string}
 */
function kurznameFalsch(kurzname) {
  return `--name ${kurzname}: nur Kleinbuchstaben, Ziffern und Bindestrich.`;
}

/**
 * Ein Text als YAML, ohne Schema, mit der Auskunft, ob er sich lesen liess:
 * Auch ein leerer Text und einer nur aus Kommentaren sind fuer js-yaml 5 kein
 * YAML.
 *
 * @param {string} text
 * @returns {{ ok: true, wert: unknown } | { ok: false }}
 */
function yamlVersuch(text) {
  try {
    return { ok: true, wert: yamlLesen(text) };
  } catch (fehler) {
    if (fehler instanceof YAMLException) return { ok: false };
    throw fehler;
  }
}

/**
 * Ein Text als YAML, ohne Schema — `undefined`, wenn er kein YAML ist. So
 * lesen die Pruefungen einen Lehrplan, auch einen, den das Schema abweist,
 * und den Kopf einer Lektion.
 *
 * @param {string} text
 * @returns {unknown}
 */
function rohLesen(text) {
  const gelesen = yamlVersuch(text);
  return gelesen.ok ? gelesen.wert : undefined;
}

/**
 * Ob ein roher Wert Felder traegt: ein Objekt, keine Liste.
 *
 * @param {unknown} wert
 * @returns {wert is Record<string, unknown>}
 */
function istObjekt(wert) {
  return wert !== null && typeof wert === 'object' && !Array.isArray(wert);
}

/**
 * Das Feld `name` eines rohen Werts — keins, wenn der Wert keine Felder traegt.
 *
 * @param {unknown} wert
 * @param {string} name
 * @returns {unknown}
 */
function rohFeld(wert, name) {
  return istObjekt(wert) ? wert[name] : undefined;
}

/**
 * Ein roher Wert als Liste — keine Eintraege, wenn er keine Liste ist.
 *
 * @param {unknown} wert
 * @returns {unknown[]}
 */
function rohListe(wert) {
  return Array.isArray(wert) ? wert : [];
}

/**
 * Die Prinzip-Ids der Abschnitte, so weit sie sich aus dem YAML lesen lassen
 * — auch aus einem Lehrplan, den das Schema abweist: jede `id`, die als Text
 * in einem Prinzip unter `abschnitte` steht. Kein YAML, keine Liste, kein
 * Text: keine Id.
 *
 * @param {unknown} roh der Lehrplan, wie `rohLesen` ihn liefert
 * @returns {string[]}
 */
function rohePrinzipIds(roh) {
  return rohListe(rohFeld(roh, 'abschnitte')).flatMap((abschnitt) =>
    rohListe(rohFeld(abschnitt, 'prinzipien')).flatMap((prinzip) => {
      const id = rohFeld(prinzip, 'id');
      return typeof id === 'string' ? [id] : [];
    }),
  );
}

/**
 * Felder, die ungelesen bleiben, solange ihr Wert die Form hat, die das
 * Schema dort verlangt: je Schluessel die Pruefung dieser Form.
 *
 * @typedef {ReadonlyMap<string, (wert: unknown) => boolean>} Ausnahmen
 */

/**
 * @param {unknown} wert
 * @returns {boolean}
 */
function istText(wert) {
  return typeof wert === 'string';
}

/**
 * @param {unknown} wert
 * @returns {boolean}
 */
function istId(wert) {
  return typeof wert === 'string' && ID_MUSTER.test(wert);
}

/**
 * @param {unknown} wert
 * @returns {boolean}
 */
function istSeitenliste(wert) {
  return Array.isArray(wert) && wert.every((seite) => typeof seite === 'number');
}

/**
 * @param {unknown} wert
 * @returns {boolean}
 */
function istStatus(wert) {
  return STATUS.some((status) => status === wert);
}

/** Der Name eines Widgets, wie ihn der Rumpf einer Lektion aufruft: `<Pipeline … />`. */
const WIDGET_NAME = /^[A-Z][A-Za-z0-9]*$/;

/**
 * @param {unknown} wert
 * @returns {boolean}
 */
function istWidgetName(wert) {
  return typeof wert === 'string' && WIDGET_NAME.test(wert);
}

/**
 * Fuer ein Feld, das `lehrplanFelder` selbst liest, in jeder Form.
 *
 * @returns {boolean}
 */
function immer() {
  return true;
}

/**
 * Was oben am Lehrplan nicht gelesen wird: was das Einlesen schreibt und die
 * Freigabe, beides nur als Text — dazu die Abschnitte, die `lehrplanFelder`
 * einzeln liest.
 *
 * @type {Ausnahmen}
 */
const NICHT_OBEN = new Map([
  ['art', istText],
  ['quelle', istText],
  ['titel', istText],
  ['stand', istText],
  ['geprueftVon', istText],
  ['geprueftAm', istText],
  ['abschnitte', immer],
]);

/**
 * Was an einem Abschnitt nicht gelesen wird: die Id und was das Einlesen
 * schreibt, je nur in der Form des Schemas — dazu die Prinzipien, die
 * `lehrplanFelder` einzeln liest.
 *
 * @type {Ausnahmen}
 */
const NICHT_AM_ABSCHNITT = new Map([
  ['id', istId],
  ['titel', istText],
  ['datei', istText],
  ['status', istStatus],
  ['seiten', istSeitenliste],
  ['prinzipien', immer],
]);

/** @type {Ausnahmen} Was an einem Prinzip nicht gelesen wird, je nur in der Form des Schemas. */
const NICHT_AM_PRINZIP = new Map([
  ['id', istId],
  ['widget', istWidgetName],
]);

/** @type {Ausnahmen} */
const KEINE_AUSNAHMEN = new Map();

/**
 * Sammelt jeden Text eines rohen Werts, in jeder Tiefe, als Feld mit seinem
 * Pfad hinter `pfad` — wie `sammle` in werkzeug/wortlaut.mjs: `.schluessel`
 * fuer ein Feld, `[i]` fuer einen Listeneintrag; ist der Wert selbst Text,
 * heisst das Feld `pfad`, an der Wurzel `(Wurzel)`.
 *
 * Ein Schluessel steht nur im Pfad, wenn er wie ein Feldname aussieht
 * (`FELDNAME`). Sonst steht dort seine Stelle in der Abbildung, ab 0 —
 * `notiz.{0}` —, und der Schluessel selbst ist ein Feld fuer sich,
 * `notiz.{0}.schluessel`: Er koennte ein Satz von einer Folie sein, und der
 * Name eines Felds steht in jeder Meldung zu ihm.
 *
 * Die Schluessel in `ausser` uebergeht es nur auf der obersten Ebene und nur,
 * wenn ihr Wert die Form hat, die dort gilt: Ein `id` in einem Feld, das das
 * Schema nicht kennt, ist Text wie jeder andere, ein Satz als Id ebenso.
 *
 * @param {unknown} wert
 * @param {string} pfad leer an der Wurzel
 * @param {Feld[]} felder
 * @param {Ausnahmen} [ausser]
 */
function sammleTexte(wert, pfad, felder, ausser = KEINE_AUSNAHMEN) {
  if (typeof wert === 'string') {
    felder.push({ feld: pfad === '' ? '(Wurzel)' : pfad, text: wert });
  } else if (Array.isArray(wert)) {
    wert.forEach((element, i) => sammleTexte(element, `${pfad}[${i}]`, felder));
  } else if (istObjekt(wert)) {
    Object.entries(wert).forEach(([schluessel, element], n) => {
      if (ausser.get(schluessel)?.(element)) return;
      const nennbar = FELDNAME.test(schluessel);
      const name = nennbar ? schluessel : `{${n}}`;
      const unter = pfad === '' ? name : `${pfad}.${name}`;
      if (!nennbar) felder.push({ feld: `${unter}.schluessel`, text: schluessel });
      sammleTexte(element, unter, felder);
    });
  }
}

/**
 * Wo in Zeile `i` ein Kommentar beginnt: die Stelle seiner Raute, `-1` fuer
 * keinen.
 *
 * Ob eine Raute einen Kommentar beginnt, entscheidet der YAML-Leser selbst,
 * kein Nachbau seiner Regeln: Sie steht am Zeilenanfang oder nach Leerraum,
 * und ohne den Rest ihrer Zeile liest sich der Text gleich. Eine Raute in
 * Anfuehrungszeichen oder in einem Blocktext (`|`, `>`) gehoert zum Wert —
 * ohne den Rest laese er sich anders oder gar nicht. So zaehlt jeder Text
 * genau einmal: als Feld oder als Kommentar.
 *
 * Die Raute selbst bleibt fuer die Probe stehen. Ohne sie wuerde eine ganze
 * Kommentarzeile leer, und hinter einem Blocktext mit `|+` oder `>+` gehoert
 * eine Leerzeile zum Text: Er laese sich anders, obwohl die Zeile ein
 * Kommentar ist. Eine Raute ohne Text dahinter bleibt uebergangen — die
 * Probe aenderte nichts, und zu pruefen gibt es nichts.
 *
 * @param {readonly string[]} zeilen die Zeilen des Texts
 * @param {number} i
 * @param {unknown} ganz der ganze Text, gelesen
 * @returns {number}
 */
function kommentarRaute(zeilen, i, ganz) {
  const zeile = zeilen[i];
  for (let raute = zeile.indexOf('#'); raute !== -1; raute = zeile.indexOf('#', raute + 1)) {
    const davor = zeile.charAt(raute - 1);
    if (raute > 0 && davor !== ' ' && davor !== '\t') continue;
    if (raute === zeile.length - 1) continue;
    const probe = yamlVersuch([...zeilen.slice(0, i), zeile.slice(0, raute + 1), ...zeilen.slice(i + 1)].join('\n'));
    if (probe.ok && isDeepStrictEqual(probe.wert, ganz)) return raute;
  }
  return -1;
}

/**
 * Die Kommentare eines YAML-Texts in der Reihenfolge ihrer Zeilen: je
 * Kommentar die Zeile (ab 1) und der Text hinter der Raute
 * (`kommentarRaute`).
 *
 * Aufeinanderfolgende Zeilen, die nur ein Kommentar sind — eingerueckt oder
 * nicht —, sind einer: mit der Zeile der ersten, die Texte mit `\n`
 * verbunden. Sonst reichte ein Satz, auf zwei Kommentarzeilen umbrochen, in
 * keinem Feld ueber 13 Woerter. Ein Kommentar hinter einem Wert ist einer
 * fuer sich, und jede andere Zeile beendet einen Block — auch eine leere und
 * eine mit einer Raute ohne Text.
 *
 * Laesst sich der Text nicht lesen, gibt es keine Kommentare: Was dann Wert
 * und was Kommentar ist, weiss niemand.
 *
 * @param {string} text
 * @returns {{ zeile: number, text: string }[]}
 */
function yamlKommentare(text) {
  // Zeilen enden in YAML auf \r\n, \r oder \n; verbunden wird hier mit \n,
  // beim ganzen Text wie bei jeder Probe.
  const zeilen = text.replace(/^\uFEFF/, '').split(/\r\n|\r|\n/);
  /** @type {{ zeile: number, text: string }[]} */
  const kommentare = [];
  const ganz = yamlVersuch(zeilen.join('\n'));
  if (!ganz.ok) return kommentare;
  /** @type {{ zeile: number, text: string } | null} der Block, den die Zeile davor begonnen oder fortgesetzt hat */
  let block = null;
  zeilen.forEach((zeile, i) => {
    const raute = kommentarRaute(zeilen, i, ganz.wert);
    if (raute === -1) {
      block = null;
      return;
    }
    const kommentar = zeile.slice(raute + 1);
    if (!/^[ \t]*$/.test(zeile.slice(0, raute))) {
      // Hinter einem Wert: ein Kommentar fuer sich.
      kommentare.push({ zeile: i + 1, text: kommentar });
      block = null;
    } else if (block === null) {
      block = { zeile: i + 1, text: kommentar };
      kommentare.push(block);
    } else {
      block.text += `\n${kommentar}`;
    }
  });
  return kommentare;
}

/**
 * Die Textfelder eines Lehrplans fuer den Wortlaut-Abgleich
 * (`findeAbschriften`), roh aus dem YAML gelesen wie die Prinzip-Ids — auch
 * aus einem Lehrplan, den das Schema abweist. Gelesen wird jeder Text, den
 * ein Mensch oder der Compiler dort geschrieben hat: Der Lehrplan liegt im
 * Git, die Rohdateien nicht.
 *
 * Erst jeder Text oben am Lehrplan in jeder Tiefe, dann Abschnitt fuer
 * Abschnitt in der Reihenfolge des Lehrplans: erst jeder Text des Abschnitts
 * in jeder Tiefe — `grund`, aber auch ein Feld, das das Schema nicht kennt —,
 * dann je Prinzip jeder Text in jeder Tiefe: `satz`, auch als Liste,
 * `belege`, auch als einzelner Text, `notiz`. Sind die `abschnitte` keine
 * Liste, zaehlen ihre Texte zum Lehrplan, sind die `prinzipien` keine,
 * zaehlen ihre Texte zum Abschnitt. Ist der Lehrplan selbst eine Liste oder
 * ein Text, zaehlt auch der. Nur Werte, die Text sind.
 *
 * Nicht gelesen wird, was in fester Form dasteht, und nur, solange es in
 * dieser Form dasteht (`NICHT_OBEN`, `NICHT_AM_ABSCHNITT`,
 * `NICHT_AM_PRINZIP`): oben `art`, `quelle`, `titel`, `stand`, `geprueftVon`
 * und `geprueftAm` als Text, am Abschnitt `id` nach dem Muster der Ids,
 * `titel` und `datei` als Text, `seiten` als Liste aus Zahlen und `status`
 * als einer seiner vier Werte, am Prinzip `id` nach dem Muster und `widget`
 * als Name eines Widgets. Titel schreibt das Einlesen, und alle sind kurz.
 * Steht dort etwas anderes — ein Satz als Id, Texte als Seiten —, wird es
 * gelesen wie jedes andere Feld.
 *
 * Ein Feld heisst wie ein Feld der Lektion nach seinem Pfad: oben ab der
 * Wurzel (`notiz`, `titel[0]`), sonst mit der Id seines Abschnitts oder
 * Prinzips davor: `m07-03-risikomanagement.grund`,
 * `pauschal-heisst-nicht-komplett.belege[0]`. Die Id steht nur da, wenn sie
 * dem Muster der Ids folgt und zum ersten Mal vorn steht; sonst die Stelle:
 * `abschnitte[2].grund`, `abschnitte[2].prinzipien[0].satz`. So nennt eine
 * Meldung nie eine Id, die in Wahrheit ein Satz ist, und zwei gleiche Ids
 * ergeben keine gleichen Feldnamen. Aus demselben Grund steht ein Schluessel
 * nur im Pfad, wenn er wie ein Feldname aussieht; sonst seine Stelle, und er
 * selbst ist ein Feld: `notiz.{0}` und `notiz.{0}.schluessel`
 * (`sammleTexte`).
 *
 * Zuletzt, nach Zeile, die Kommentare (`yamlKommentare`), je als Feld
 * `kommentar[<zeile>]` — aufeinanderfolgende Zeilen, die nur ein Kommentar
 * sind, als eines unter der ersten —, auch die Kopfzeilen, die das Einlesen
 * schreibt: Ein Satz von einer Folie laege sonst als Kommentar ungeprueft im
 * Git.
 *
 * Kein YAML: keine Felder, auch keine Kommentare.
 *
 * @param {string} text
 * @returns {Feld[]}
 */
export function lehrplanFelder(text) {
  /** @type {Feld[]} */
  const felder = [];
  /** @type {Set<string>} die Ids, die schon vorn an einem Feld stehen */
  const vergeben = new Set();
  /** @type {(id: unknown, stelle: string) => string} */
  const vorn = (id, stelle) => {
    if (typeof id !== 'string' || !ID_MUSTER.test(id) || vergeben.has(id)) return stelle;
    vergeben.add(id);
    return id;
  };
  const roh = rohLesen(text);
  sammleTexte(roh, '', felder, NICHT_OBEN);
  const abschnitte = rohFeld(roh, 'abschnitte');
  if (!Array.isArray(abschnitte)) sammleTexte(abschnitte, 'abschnitte', felder);
  rohListe(abschnitte).forEach((abschnitt, i) => {
    const name = vorn(rohFeld(abschnitt, 'id'), `abschnitte[${i}]`);
    sammleTexte(abschnitt, name, felder, NICHT_AM_ABSCHNITT);
    const prinzipien = rohFeld(abschnitt, 'prinzipien');
    if (!Array.isArray(prinzipien)) sammleTexte(prinzipien, `${name}.prinzipien`, felder);
    rohListe(prinzipien).forEach((prinzip, j) => {
      sammleTexte(prinzip, vorn(rohFeld(prinzip, 'id'), `abschnitte[${i}].prinzipien[${j}]`), felder, NICHT_AM_PRINZIP);
    });
  });
  for (const kommentar of yamlKommentare(text)) {
    felder.push({ feld: `kommentar[${kommentar.zeile}]`, text: kommentar.text });
  }
  return felder;
}

/**
 * Liest den Lehrplan dieser Quelle so weit, wie beide Pruefungen ihn brauchen.
 *
 * Ein Repo-Lehrplan wird auch dann erkannt, wenn das Schema ihn abweist —
 * an `art`, so wie es im Text steht: Wer dieses Werkzeug an einem Repo
 * aufruft, hat das falsche Werkzeug gewaehlt. Dann steht nur das da, nicht
 * die Maengel eines Lehrplans, den es ohnehin nicht prueft.
 *
 * Ein ungueltiger Lehrplan, in dem beide Freigabefelder leer sind — fehlend,
 * `null` oder nur Leerraum, dieselbe Regel wie beim wartenden
 * (`fehltWirklich`) —, wartet ebenfalls: Die Saetze des Schemas zu
 * `geprueftVon` und `geprueftAm` fallen weg, den Satz zur Freigabe setzt
 * jede Pruefung selbst vorn hin. Ist nur eines leer oder steht dort etwas in
 * falscher Form, bleiben sie: Dann hat jemand die Freigabe begonnen oder
 * falsch eingetragen, und nur der Satz des Schemas sagt, welches Feld.
 *
 * @param {string} lehrplanText
 * @param {ReadonlySet<string>} lektionsIds
 * @returns {GelesenerLehrplan}
 */
function lesePlan(lehrplanText, lektionsIds) {
  // Der Name steht nur in der Meldung zu kaputtem YAML („Lehrplan ist kein
  // gueltiges YAML …", wie beim Auftrag); die Datei nennt der Praefix, den
  // beide Pruefungen vor jeden Mangel des Lehrplans setzen.
  const befund = lehrplanAusYaml(lehrplanText, lektionsIds, 'Lehrplan');
  if (befund.ok || befund.wartet) {
    const { lehrplan } = befund;
    return lehrplan.art === 'repo' ? { zustand: 'repo' } : { zustand: 'lesbar', lehrplan, wartet: !befund.ok };
  }
  const roh = rohLesen(lehrplanText);
  if (rohFeld(roh, 'art') === 'repo') return { zustand: 'repo' };
  const wartet = istObjekt(roh) && FREIGABE.every((name) => fehltWirklich(rohFeld(roh, name)));
  return {
    zustand: 'ungueltig',
    maengel: wartet
      ? befund.maengel.filter((mangel) => !FREIGABE.some((name) => mangel.startsWith(`${name}: `)))
      : befund.maengel,
    prinzipIds: rohePrinzipIds(roh),
    wartet,
  };
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
 * Je Abschrift im Lehrplan ein Mangel: der Satz wie bei einer Lektion
 * (`abschriftSatz`), die Datei davor. Ohne Index — ohne die eigenen
 * Rohdateien — keiner; was das heisst, sagt jede Pruefung selbst.
 *
 * @param {string} datei
 * @param {string} lehrplanText
 * @param {Index | null} index
 * @returns {string[]}
 */
function abschriftenImLehrplan(datei, lehrplanText, index) {
  if (index === null) return [];
  return findeAbschriften(lehrplanFelder(lehrplanText), index).map(
    (abschrift) => `${datei}: ${abschriftSatz(abschrift)}`,
  );
}

/**
 * Der Kopf einer Lektion, roh gelesen — `null`, wenn sie keinen hat, er kein
 * YAML ist oder keine Felder traegt. Das meldet pruefe-lektion; hier wird
 * die Lektion dann uebergangen, statt einen zweiten, ungenaueren Mangel zu
 * melden.
 *
 * @param {string} text
 * @returns {Record<string, unknown> | null}
 */
function lektionsKopf(text) {
  const teile = FRONTMATTER.exec(text);
  const kopf = teile === null ? undefined : rohLesen(teile[1]);
  return istObjekt(kopf) ? kopf : null;
}

/**
 * Ein Vorbehalt zum Vergleichen, ohne Leerraum am Rand. Fehlend, `null` und
 * leer heissen beide „kein Vorbehalt" (`''`): So fehlt er im Lehrplan, und so
 * schreibt man ihn in einer Lektion weg. `null` fuer einen, der kein Text
 * ist — den meldet pruefe-lektion.
 *
 * @param {unknown} wert
 * @returns {string | null}
 */
function vorbehaltZumVergleich(wert) {
  if (wert === undefined || wert === null) return '';
  return typeof wert === 'string' ? wert.trim() : null;
}

/**
 * Die Lektionen, die nicht zu ihrem Prinzip passen, in der Reihenfolge des
 * Lehrplans: `satz`, wenn `prinzip` der Lektion ein anderer Satz ist als
 * `satz` des Prinzips, `vorbehalt`, wenn ihr Vorbehalt ein anderer ist.
 * `fertig`: Das Prinzip steht in einem Abschnitt mit `status: lektion`.
 *
 * Roh gelesen wie `rohePrinzipIds`, damit auch ein ungueltiger Lehrplan
 * abgeglichen wird — nach Durchgang B etwa einer, dem noch eine Lektion
 * fehlt. Verglichen wird, was sich vergleichen laesst: ein Prinzip nur,
 * wenn seine Id Text nach dem Muster der Ids ist, und nur beim ersten
 * Vorkommen der Id — die Lektion gibt es einmal. Ohne Leerraum am Rand,
 * `prinzip` und `satz` nur, wenn beide Text sind, den Vorbehalt nur, wenn
 * er auf beiden Seiten Text ist oder fehlt (`vorbehaltZumVergleich`). Bei
 * einem lesbaren Lehrplan ist das alles gegeben.
 *
 * Die Anleitung des Compilers verlangt beides: `prinzip` ist der Satz des
 * Prinzips, der `vorbehalt` wandert mit, und wer eine Lektion uebernimmt,
 * uebernimmt ihren Satz. Fiele ein Vorbehalt auf dem Weg weg, stuende
 * Pruefungsstoff als gesichert da; und eine Lektion, die unter einer
 * versehentlich gewaehlten Id schon liegt, traegt fast nie den Satz des
 * neuen Prinzips.
 *
 * @param {unknown} roh der Lehrplan, wie `rohLesen` ihn liefert
 * @param {ReadonlyMap<string, string>} lektionen
 * @returns {{ id: string, fertig: boolean, satz: boolean, vorbehalt: boolean }[]}
 */
function lektionenGegenPrinzipien(roh, lektionen) {
  /** @type {Set<string>} */
  const gesehen = new Set();
  return rohListe(rohFeld(roh, 'abschnitte')).flatMap((abschnitt) => {
    const fertig = rohFeld(abschnitt, 'status') === 'lektion';
    return rohListe(rohFeld(abschnitt, 'prinzipien')).flatMap((prinzip) => {
      const id = rohFeld(prinzip, 'id');
      if (typeof id !== 'string' || !ID_MUSTER.test(id) || gesehen.has(id)) return [];
      gesehen.add(id);
      const text = lektionen.get(id);
      const kopf = text === undefined ? null : lektionsKopf(text);
      if (kopf === null) return [];
      const soll = rohFeld(prinzip, 'satz');
      const satz = typeof kopf.prinzip === 'string' && typeof soll === 'string' && kopf.prinzip.trim() !== soll.trim();
      const eigener = vorbehaltZumVergleich(kopf.vorbehalt);
      const seiner = vorbehaltZumVergleich(rohFeld(prinzip, 'vorbehalt'));
      const vorbehalt = eigener !== null && seiner !== null && eigener !== seiner;
      return satz || vorbehalt ? [{ id, fertig, satz, vorbehalt }] : [];
    });
  });
}

/**
 * Je vorhandener Lektion, die nicht zu ihrem Prinzip passt
 * (`lektionenGegenPrinzipien`), ein Mangel fuer satz und einer fuer
 * vorbehalt.
 *
 * Nach Durchgang B hat der Compiler die Lektion gebaut oder uebernommen; sie
 * ist die des Prinzips, und der Satz sagt nur, was nicht stimmt. Ebenso vor
 * einem Durchgang unter einem Abschnitt mit `status: lektion`: Dort liegt
 * die fertige Lektion eines frueheren Durchgangs, und eine andere Id liesse
 * sie ohne Lehrplaneintrag zurueck. Sonst ist eine Lektion, die vor dem
 * Durchgang schon da ist, eine uebernommene: Ihr Satz gilt, sonst gehoert
 * das Prinzip unter eine andere Id, und ihren Vorbehalt aendert nur der
 * Mensch.
 *
 * @param {string} datei der Lehrplan, wie er im Mangel steht
 * @param {string} lehrplanText
 * @param {ReadonlyMap<string, string>} lektionen
 * @param {'vor' | 'nach'} wann vor oder nach dem Durchgang
 * @returns {string[]}
 */
function unpassendeLektionen(datei, lehrplanText, lektionen, wann) {
  return lektionenGegenPrinzipien(rohLesen(lehrplanText), lektionen).flatMap(({ id, fertig, satz, vorbehalt }) => {
    const alsLektion = wann === 'nach' || fertig;
    /** @type {string[]} */
    const maengel = [];
    if (satz) {
      maengel.push(
        alsLektion
          ? `Lektion ${id}: prinzip ist nicht der Satz des Prinzips in ${datei}.`
          : `Prinzip ${id}: inhalt/lektionen/${id}.mdx hat einen anderen Satz — übernehmen heißt: ihr Satz; sonst eine andere Id.`,
      );
    }
    if (vorbehalt) {
      maengel.push(
        alsLektion
          ? `Lektion ${id}: vorbehalt ist nicht der des Prinzips in ${datei}.`
          : `Prinzip ${id}: der vorbehalt passt nicht zu inhalt/lektionen/${id}.mdx — die Lektion ändert nur der Mensch.`,
      );
    }
    return maengel;
  });
}

/**
 * Vor Durchgang A und vor Durchgang B. Rein ueber Texte.
 *
 * `lehrplanText` und `manifestText` sind `null`, wenn es die Datei nicht
 * gibt. `lektionen` sind die Texte der vorhandenen Lektionen, deren Id eine
 * Prinzip-Id dieses Lehrplans ist. `index` ist der Index der Rohdateien
 * (werkzeug/wortlaut.mjs), `null`, wenn die eigenen fehlen. `andere` sind die
 * uebrigen `lehrplan/*.yaml`, jeweils mit dem Pfad, der im Mangel steht.
 *
 * Alle Maengel auf einmal, wie bei pruefe-lektion: Der Mensch soll nach einem
 * Lauf wissen, was alles fehlt — Freigabe und Auftrag etwa —, statt sich von
 * Mangel zu Mangel zu tasten. Weg faellt nur, was ein Mangel gegenstandslos
 * macht: Ohne Lehrplan und bei einem Repo-Lehrplan steht nur dieser eine Satz
 * da, ein ungueltiger Lehrplan traegt keine Abschnitte, und bei einem anderen
 * Stand wird kein Abschnitt gegen das Manifest gehalten — es gehoert dann zu
 * anderen Originalen.
 *
 * Ohne eigene Rohdatei gibt es keinen Durchgang: Der Compiler liest sie, und
 * der Wortlaut des Lehrplans bliebe ungeprueft. Fehlt auch das Manifest,
 * steht nur dessen Mangel da — beide legt dasselbe Einlesen an.
 *
 * Nach allen uebrigen Maengeln des Lehrplans, auch eines ungueltigen, steht
 * je Abschrift im Lehrplan ein Mangel, zuletzt je vorhandener Lektion, die
 * nicht zu ihrem Prinzip passt (`unpassendeLektionen`), auch das bei einem
 * ungueltigen Lehrplan. Was vor Durchgang B unter einem Abschnitt mit
 * `status: lektion` liegt, ist die fertige Lektion eines frueheren
 * Durchgangs: Sie bekommt dieselben Saetze wie nach dem Durchgang. Alles
 * andere ist eine uebernommene Lektion: Ihr Satz gilt, sonst gehoert das
 * Prinzip unter eine andere Id, und an ihrem Vorbehalt aendert der Compiler
 * nichts.
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
 *   lektionen: ReadonlyMap<string, string>,
 *   index: Index | null,
 *   andere: readonly AndererLehrplan[],
 * }} eingabe
 * @returns {VorBefund}
 */
export function pruefeVor({ kurzname, lehrplanText, manifestText, lektionsIds, lektionen, index, andere }) {
  if (lehrplanText === null) return { ok: false, maengel: [lehrplanFehlt(kurzname)], auftrag: [] };
  const plan = lesePlan(lehrplanText, lektionsIds);
  if (plan.zustand === 'repo') return { ok: false, maengel: [nurLehrmaterial(kurzname)], auftrag: [] };

  const datei = `lehrplan/${kurzname}.yaml`;
  /** @type {string[]} */
  const maengel = [];
  if (plan.wartet) maengel.push(`Erst freigeben: ${datei} wartet auf Freigabe (geprueftVon und geprueftAm).`);
  if (plan.zustand === 'ungueltig') maengel.push(...plan.maengel.map((mangel) => `${datei}: ${mangel}`));

  /** @type {import('./dokument-manifest.mjs').DokumentManifest | null} */
  let manifest = null;
  if (manifestText === null) {
    maengel.push(`quellen/${kurzname}/manifest.json gibt es nicht — erst einlesen.`);
  } else {
    const gelesen = liesDokumentManifest(manifestText);
    if (gelesen.ok) manifest = gelesen.manifest;
    else maengel.push(`quellen/${kurzname}/manifest.json lässt sich nicht lesen (${gelesen.grund}).`);
    if (index === null) maengel.push(`quellen/${kurzname}/roh/ enthält keine Rohdatei — erst einlesen.`);
  }
  if (plan.zustand === 'ungueltig') {
    maengel.push(...abschriftenImLehrplan(datei, lehrplanText, index));
    maengel.push(...unpassendeLektionen(datei, lehrplanText, lektionen, 'vor'));
    return { ok: false, maengel, auftrag: [] };
  }

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
  maengel.push(...abschriftenImLehrplan(datei, lehrplanText, index));
  maengel.push(...unpassendeLektionen(datei, lehrplanText, lektionen, 'vor'));

  const ok = maengel.length === 0;
  return { ok, maengel, auftrag: ok ? auftrag : [] };
}

/**
 * Nach Durchgang B. Rein ueber Texte; die Eingaben wie bei `pruefeVor`, nur
 * ohne Manifest.
 *
 * Den Wortlaut von Lehrplan und Lektionen prueft sie gegen `index` — auch
 * bei einem ungueltigen Lehrplan, damit alle Maengel auf einmal dastehen:
 * nach den uebrigen Maengeln des Lehrplans je Abschrift in ihm einer, zuletzt
 * je Lektion mit einer Abschrift einer, der auf pruefe-lektion zeigt. Ist
 * `index` `null`, weil es die eigenen Rohdateien nicht gibt, steht ein
 * Hinweis da, kein Mangel: nicht geprueft ist nicht in Ordnung, aber auch
 * nicht falsch.
 *
 * Vor den Abschriften der Lektionen steht je Lektion, die nicht zu ihrem
 * Prinzip passt, ein Mangel — auch bei einem ungueltigen Lehrplan, dem etwa
 * noch eine andere Lektion fehlt: Durchgang B hat sie gebaut oder
 * uebernommen, und `prinzip` und `vorbehalt` sind die des Prinzips.
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
 *   lektionen: ReadonlyMap<string, string>,
 *   index: Index | null,
 *   andere: readonly AndererLehrplan[],
 * }} eingabe
 * @returns {NachBefund}
 */
export function pruefeNach({ kurzname, lehrplanText, lektionsIds, lektionen, index, andere }) {
  if (lehrplanText === null) return { ok: false, maengel: [lehrplanFehlt(kurzname)], hinweise: [] };
  const plan = lesePlan(lehrplanText, lektionsIds);
  if (plan.zustand === 'repo') return { ok: false, maengel: [nurLehrmaterial(kurzname)], hinweise: [] };

  const datei = `lehrplan/${kurzname}.yaml`;
  /** @type {string[]} */
  const maengel = [];
  if (plan.wartet) maengel.push(`${datei} wartet auf Freigabe — Durchgang B beginnt erst nach der Freigabe.`);
  if (plan.zustand === 'ungueltig') {
    maengel.push(...plan.maengel.map((mangel) => `${datei}: ${mangel}`));
  } else {
    for (const abschnitt of plan.lehrplan.abschnitte) {
      if (abschnitt.status === 'beauftragt') {
        maengel.push(
          `Abschnitt ${abschnitt.id} steht noch auf beauftragt — jeder Abschnitt endet als lektion oder abgelehnt.`,
        );
      }
    }
    maengel.push(...doppelteIds(plan.lehrplan, andere));
  }
  maengel.push(...abschriftenImLehrplan(datei, lehrplanText, index));
  maengel.push(...unpassendeLektionen(datei, lehrplanText, lektionen, 'nach'));
  if (index !== null) {
    // Zweimal steht eine Id nur in einem ungueltigen Lehrplan; ihre Lektion ist trotzdem eine.
    const ids = new Set(plan.zustand === 'lesbar' ? prinzipIdsVon(plan.lehrplan) : plan.prinzipIds);
    for (const id of ids) {
      const text = lektionen.get(id);
      if (text !== undefined && findeAbschriften(lektionFelder(text), index).length > 0) {
        maengel.push(
          `Lektion ${id}: Wortlaut zu nah an der Quelle — npm run pruefe-lektion -- inhalt/lektionen/${id}.mdx zeigt die Stelle.`,
        );
      }
    }
  }
  return { ok: maengel.length === 0, maengel, hinweise: index === null ? [NICHT_GEPRUEFT] : [] };
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
 * Prueft den Kurznamen, bevor unter `wurzel` etwas gelesen wird: Er wird zum
 * Pfad unter `lehrplan/` und `quellen/`, und nur einer nach dem Muster der
 * Ids bleibt darunter. Die Kommandozeile prueft ihn schon; hier steht es
 * trotzdem, weil diese Schicht auch ohne sie aufgerufen werden kann — etwa
 * hinter einem Dev-Endpunkt.
 *
 * @param {string} kurzname
 */
function pruefeKurzname(kurzname) {
  if (!ID_MUSTER.test(kurzname)) throw new PruefeQuelleFehler(kurznameFalsch(kurzname));
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
 * Der Index aller Rohdateien unter `wurzel` (`liesRohIndex`), einmal gelesen
 * fuer den Wortlaut von Lehrplan und Lektionen.
 *
 * `null` — nicht geprueft —, solange die eigenen Rohdateien fehlen
 * (`quellen/<kurzname>/roh/*.md`), auch wenn andere Quellen welche haben:
 * Sonst hiesse es „in Ordnung", ohne dass je gegen die eigene Vorlesung
 * geprueft worden waere. Sind sie da, zaehlen alle Rohdateien, auch die
 * anderer Quellen.
 *
 * @param {string} wurzel
 * @param {string} kurzname
 * @returns {Index | null}
 */
function indexUnter(wurzel, kurzname) {
  if (!hatEigeneRohdateien(wurzel, kurzname)) return null;
  return liesUnter(wurzel, 'quellen', () => liesRohIndex(wurzel))?.index ?? null;
}

/**
 * Die Texte der Lektionen zu den Prinzipien dieses Lehrplans, die es gibt,
 * nach Id. Eine Lektion, die fehlt, prueft das Schema; eine Lektion ohne
 * Prinzip in diesem Lehrplan ist nicht Sache dieser Pruefung.
 *
 * Auch ein ungueltiger Lehrplan hat Lektionen, und alle Maengel sollen auf
 * einmal dastehen: Die Prinzip-Ids kommen deshalb aus seinem YAML, so weit
 * es sich lesen laesst (`rohePrinzipIds`) — bei einem gueltigen sind es
 * dieselben.
 *
 * @param {string} wurzel
 * @param {string | null} lehrplanText
 * @param {ReadonlySet<string>} lektionsIds
 * @returns {Map<string, string>}
 */
function lektionenUnter(wurzel, lehrplanText, lektionsIds) {
  /** @type {Map<string, string>} */
  const lektionen = new Map();
  if (lehrplanText === null) return lektionen;
  for (const id of rohePrinzipIds(rohLesen(lehrplanText))) {
    if (!lektionsIds.has(id) || lektionen.has(id)) continue;
    const text = liesText(wurzel, `inhalt/lektionen/${id}.mdx`);
    if (text !== null) lektionen.set(id, text);
  }
  return lektionen;
}

/**
 * Liest unter `wurzel` Lehrplan, Manifest, die Lektionen zu seinen
 * Prinzipien, die Rohdateien und die uebrigen Lehrplaene und prueft vor
 * einem Durchgang. Schreibt nichts.
 *
 * @param {{ wurzel: string, kurzname: string }} eingabe
 * @returns {VorBefund}
 */
export function pruefeVorDateien({ wurzel, kurzname }) {
  pruefeKurzname(kurzname);
  const lehrplanText = liesText(wurzel, `lehrplan/${kurzname}.yaml`);
  const lektionsIds = lektionsIdsAus(path.join(wurzel, 'inhalt', 'lektionen'));
  return pruefeVor({
    kurzname,
    lehrplanText,
    manifestText: liesText(wurzel, `quellen/${kurzname}/manifest.json`),
    lektionsIds,
    lektionen: lektionenUnter(wurzel, lehrplanText, lektionsIds),
    index: indexUnter(wurzel, kurzname),
    andere: andereLehrplaene(wurzel, kurzname),
  });
}

/**
 * Liest unter `wurzel` Lehrplan, die Lektionen zu seinen Prinzipien, die
 * Rohdateien und die uebrigen Lehrplaene und prueft nach Durchgang B.
 * Schreibt nichts.
 *
 * @param {{ wurzel: string, kurzname: string }} eingabe
 * @returns {NachBefund}
 */
export function pruefeNachDateien({ wurzel, kurzname }) {
  pruefeKurzname(kurzname);
  const lehrplanText = liesText(wurzel, `lehrplan/${kurzname}.yaml`);
  const lektionsIds = lektionsIdsAus(path.join(wurzel, 'inhalt', 'lektionen'));
  return pruefeNach({
    kurzname,
    lehrplanText,
    lektionsIds,
    lektionen: lektionenUnter(wurzel, lehrplanText, lektionsIds),
    index: indexUnter(wurzel, kurzname),
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
 * und `--nach`, in beliebiger Reihenfolge. Fehlt etwas, steht etwas doppelt
 * oder ein Wort ohne `--` da, kommt nur die Aufruf-Hilfe (`meldung: null`).
 * Eine fremde Option und ein Kurzname, der nicht dem Muster der Ids folgt,
 * bekommen einen Satz davor: Die Hilfe allein sagt nicht, was an einem
 * Aufruf falsch ist, der ihr zu folgen scheint. Der Kurzname ist ein Ordner
 * unter `quellen/`, und nur darunter wird gelesen.
 *
 * @param {readonly string[]} argv
 * @returns {{ ok: true, kurzname: string, modus: 'vor' | 'nach' } | { ok: false, meldung: string | null }}
 */
function leseArgv(argv) {
  /** @type {string | null} */
  let kurzname = null;
  /** @type {'vor' | 'nach' | null} */
  let modus = null;
  for (let i = 0; i < argv.length; i++) {
    const argument = argv[i];
    if (argument === '--name') {
      const wert = argv[i + 1];
      if (kurzname !== null || wert === undefined || wert.startsWith('--')) return { ok: false, meldung: null };
      kurzname = wert;
      i++;
    } else if (argument === '--vor' || argument === '--nach') {
      if (modus !== null) return { ok: false, meldung: null };
      modus = argument === '--vor' ? 'vor' : 'nach';
    } else if (argument.startsWith('--')) {
      return { ok: false, meldung: `Unbekannte Option ${argument}.` };
    } else {
      return { ok: false, meldung: null };
    }
  }
  if (modus === null || kurzname === null || kurzname === '') return { ok: false, meldung: null };
  if (!ID_MUSTER.test(kurzname)) return { ok: false, meldung: kurznameFalsch(kurzname) };
  return { ok: true, kurzname, modus };
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
  if (!aufruf.ok) {
    if (aufruf.meldung !== null) schreibe(aufruf.meldung);
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
