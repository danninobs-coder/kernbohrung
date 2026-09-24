/**
 * Foliensaetze einlesen: Pfade und Kurzname hinein, `quellen/<kurzname>/` und
 * ein Lehrplan-Geruest heraus.
 *
 * Dieselbe Schnittstelle nach aussen wie `adapter/git.mjs`, und wie dort
 * steckt die Arbeit in den Teilen darunter: `dokument.mjs` liest die Seiten,
 * `gliederung/folien.mjs` macht Abschnitte daraus, `manifest.mjs` schreibt den
 * Herkunftsnachweis. Hier wird nur zusammengesetzt und auf den Datentraeger
 * gebracht — gegen ein beliebiges Verzeichnis, damit ein Test nicht in das
 * Projekt schreiben muss.
 *
 * **Auf der Konsole steht nie Folientext.** Das Material gehoert seinen
 * Verfassern; gemeldet werden Zahlen, Dateinamen, Abschnitt-Ids und Titel.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
// Namentlich, nicht als Vorgabe-Import: js-yaml 5 liefert unter `import` ein
// ESM-Buendel ohne Default-Export.
import { load as yamlLesen } from 'js-yaml';
import {
  BEIWERK_WARNUNG,
  DokumentFehler,
  artDerQuelle,
  bereinigeQuelle,
  ladePdfjs,
  liesSeiten,
  seitenText,
} from './dokument.mjs';
import { dateikuerzel, gliedereFolien } from '../gliederung/folien.mjs';
import { lektionsIdsAus } from '../lehrplan.mjs';
import { baueDokumentManifest, dateiHash, standAusHashes } from '../manifest.mjs';
import { lehrplanGeruest, vergleicheLehrplan } from '../lehrplan-geruest.mjs';
import { ID as ID_MUSTER, lehrplanAusYaml } from '../../src/lib/lehrplan.ts';

/**
 * Was auf einer Folie mit Tabellenverdacht ueber dem Text steht.
 *
 * Nicht „hier stand eine Tabelle": Die Regel schlaegt auch bei Diagrammen an.
 * Beides hat dasselbe Problem — die Anordnung traegt die Bedeutung, und die
 * Extraktion traegt die Anordnung nicht.
 */
export const WARNZEILE = '> Tabelle oder Grafik — die Anordnung fehlt im Text; im Original ansehen.';

/** Was anstelle des Texts einer Folie steht, die nur ein Bild traegt. */
export const NUR_BILD_ZEILE = 'nur Bild — im Original ansehen';

/** Bricht das Einlesen mit einer Meldung ab, die man dem Nutzer zeigen kann. */
export class EinleseFehler extends Error {}

/** Nur diese Endung liest diese Fassung. */
const ENDUNG = '.pdf';

/**
 * Namen, die Windows fuer Geraete reserviert. Gemessen unter Windows 11: Node
 * legt `quellen/con/` und `lehrplan/con.yaml` trotzdem an, und `existsSync`
 * meldet `lehrplan/con.yaml` als vorhanden, bevor es die Datei gibt. Andere
 * Programme, der Explorer vorneweg, behandeln solche Namen als Geraet. Auch
 * `com0` und `lpt0` stehen auf der Liste von Microsoft.
 */
const WINDOWS_RESERVIERT = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/;

/** @type {(anteil: number) => string} Ein Prozentwert mit einer Nachkommastelle, deutsch geschrieben. */
export const prozent = (anteil) => `${(anteil * 100).toFixed(1).replace('.', ',')} %`;

/**
 * Natuerliche Sortierung: nach der ersten Zahl im Namen, dann nach
 * Codepunkten. Sonst stuende `M10` vor `M2`, und die Abschnitt-Ids liefen
 * gegen die Lesereihenfolge.
 *
 * Eigener Vergleich statt `localeCompare` — der haengt an der
 * Spracheinstellung des Rechners, und zwei Rechner sollen dieselbe Quelle
 * gleich einlesen.
 *
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function natuerlich(a, b) {
  const za = Number((a.match(/\d+/) ?? ['0'])[0]);
  const zb = Number((b.match(/\d+/) ?? ['0'])[0]);
  if (za !== zb) return za - zb;
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Die PDF-Dateien hinter den angegebenen Orten, in natuerlicher Reihenfolge.
 *
 * Ein Ort ist eine Datei oder ein Ordner; ein Ordner bringt alle `.pdf` darin
 * mit, nicht rekursiv. Doppelte Pfade fallen weg.
 *
 * @param {readonly string[]} orte
 * @returns {string[]}
 */
export function sammlePdfs(orte) {
  /** @type {string[]} */
  const gefunden = [];
  for (const ort of orte) {
    /** @type {import('node:fs').Stats} */
    let stat;
    try {
      stat = statSync(ort);
    } catch (fehler) {
      if (!istSystemfehler(fehler)) throw fehler;
      throw new EinleseFehler(`${ort}: lässt sich nicht öffnen (${fehlercode(fehler)}).`);
    }
    if (stat.isDirectory()) {
      /** @type {string[]} */
      let drin;
      try {
        drin = readdirSync(ort).filter((name) => name.toLowerCase().endsWith(ENDUNG));
      } catch (fehler) {
        if (!istSystemfehler(fehler)) throw fehler;
        throw new EinleseFehler(`${ort}: lässt sich nicht öffnen (${fehlercode(fehler)}).`);
      }
      if (!drin.length) throw new EinleseFehler(`In ${ort} liegt keine PDF-Datei.`);
      for (const name of drin) gefunden.push(path.join(ort, name));
    } else if (ort.toLowerCase().endsWith(ENDUNG)) {
      gefunden.push(ort);
    } else {
      throw new EinleseFehler(`${ort} ist keine PDF-Datei. Diese Fassung liest nur PDF.`);
    }
  }
  // Einmal am Ende sortiert, nicht je Ort: Wer zwei Mappen angibt, bekommt
  // eine Quelle — und in ihr laufen die Dateien in einer Reihenfolge.
  const einmal = [...new Set(gefunden.map((p) => path.resolve(p)))];
  return einmal.sort((a, b) => natuerlich(path.basename(a), path.basename(b)));
}

/**
 * Der Inhalt einer Rohdatei: Kopfzeile, dann der Nutztext mit Seitenmarken.
 *
 * Die Seitenmarke ist der Grund, warum das hier ueberhaupt eine Datei wird:
 * Ohne sie zeigte jede spaetere Behauptung auf einen Satz von
 * fuenfunddreissig Folien statt auf eine.
 *
 * Die Hinweise stehen direkt hinter der Marke ihrer Folie: erst die
 * Warnzeile, dann — bei einer Bildfolie anstelle des Texts — der Bildhinweis.
 * Eine Folie kann beide tragen. Wer die Datei an den Marken trennt, wie der
 * Compiler in 2c, ordnet so jeden Hinweis seiner Folie zu und keinen der
 * Folie davor.
 *
 * @param {{ id: string, titel: string, datei: string, seiten: [number, number] }} abschnitt
 * @param {readonly import('./dokument.mjs').Seite[]} seiten
 * @returns {string}
 */
export function rohdatei(abschnitt, seiten) {
  const [von, bis] = abschnitt.seiten;
  const kopf = [
    `# ${abschnitt.titel}`,
    '',
    `${abschnitt.datei}, ${von === bis ? `Folie ${von}` : `Folien ${von}–${bis}`}`,
    '',
    '',
  ];
  const teile = seiten.map((seite) => {
    // seitenText liefert die Marke als erste Zeile, darunter den Text.
    const [marke, ...text] = seitenText(seite).split('\n');
    const warnung = seite.tabellenverdacht ? [WARNZEILE] : [];
    return [marke, ...warnung, ...(seite.nurBild ? [NUR_BILD_ZEILE] : text)].join('\n');
  });
  return `${kopf.join('\n')}${teile.join('\n\n')}\n`;
}

/**
 * @typedef {{ datei: string, dateiHash: string, seiten: number, gliederung: string, beiwerkZeichen: number, nurBild: number[], tabellenverdacht: number[], beiwerkAnteil: number }} Bericht
 * @typedef {{
 *   kurzname: string,
 *   stand: string,
 *   originale: Bericht[],
 *   abschnitte: { id: string, titel: string, datei: string, seiten: [number, number] }[],
 *   warnungen: string[],
 *   lehrplan: { pfad: string, geschrieben: boolean, vergleich: import('../lehrplan-geruest.mjs').Vergleich | null },
 * }} Ergebnis
 */

/**
 * Lehrplan-Arten, deren Datei ein Folien-Lauf nicht anfasst — auch nicht zum
 * Vergleich. Nur die bekannten: Ein Tippfehler in `art` macht einen Lehrplan
 * kaputt, nicht fremd, und ein kaputter bricht nichts ab.
 */
const ANDERE_LEHRPLAN_ARTEN = new Set(['repo', 'buch']);

/**
 * Was pdf.js wirft, wenn eine Datei kein lesbares PDF ist. Erkannt am Namen:
 * Nicht alle diese Klassen exportiert pdf.js.
 */
const PDFJS_LADEFEHLER = new Set(['InvalidPDFException', 'UnknownErrorException', 'ResponseException']);

/**
 * Ob `fehler` ein gescheiterter Systemaufruf ist — gesperrt, keine Rechte,
 * verschwunden, Platte voll. Node gibt solchen Fehlern `syscall` und `code`
 * mit, einem Fehler im Programm nicht.
 *
 * @param {unknown} fehler
 * @returns {boolean}
 */
function istSystemfehler(fehler) {
  return fehler instanceof Error && typeof (/** @type {Error & { syscall?: unknown }} */ (fehler).syscall) === 'string';
}

/**
 * Warum sich eine Datei nicht lesen liess, als Satz fuer den Nutzer — oder
 * `null`, wenn der Fehler keiner des Lesens ist, sondern einer im Programm.
 * Der geht als Stapelabzug durch: Als Lesefehler verkleidet, suchte man am
 * PDF statt im Code.
 *
 * Ein Dateifehler heisst anders als ein kaputtes PDF: Bei `EBUSY` haelt ein
 * anderes Programm die Datei fest, und am PDF selbst suchte man vergeblich.
 *
 * @param {unknown} fehler
 * @returns {string | null}
 */
function lesegrund(fehler) {
  if (fehler instanceof DokumentFehler) return fehler.message;
  if (!(fehler instanceof Error)) return null;
  if (fehler.name === 'PasswordException') return 'ist mit einem Passwort geschützt — bitte ohne Passwort speichern.';
  if (istSystemfehler(fehler)) return `lässt sich nicht öffnen (${fehlercode(fehler)}).`;
  if (PDFJS_LADEFEHLER.has(fehler.name)) return `lässt sich nicht als PDF lesen (${fehler.message}).`;
  return null;
}

/**
 * Der Code eines gescheiterten Systemaufrufs (`EBUSY`, `EPERM`, …), sonst der
 * Name des Fehlers.
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
 * Die Art, die ein vorhandenes Manifest nennt — `null`, wenn es keines gibt
 * oder keines, das eine Art lesbar nennt.
 *
 * @param {string} pfad
 * @returns {string | null}
 */
function artImManifest(pfad) {
  try {
    const art = JSON.parse(readFileSync(pfad, 'utf8'))?.herkunft?.art;
    return typeof art === 'string' ? art : null;
  } catch {
    return null;
  }
}

/**
 * Die Art, die ein Lehrplan nennt — `null`, wenn er keine lesbare nennt.
 *
 * @param {string} text
 * @returns {string | null}
 */
function artImLehrplan(text) {
  try {
    const daten = yamlLesen(text);
    return typeof daten === 'object' && daten !== null && 'art' in daten && typeof daten.art === 'string'
      ? daten.art
      : null;
  } catch {
    return null;
  }
}

/**
 * Ein vorhandener Lehrplan: sein Text, oder warum er sich nicht lesen liess.
 *
 * @param {string} pfad
 * @returns {{ text: string } | { fehler: string }}
 */
function liesVorhandenen(pfad) {
  try {
    return { text: readFileSync(pfad, 'utf8') };
  } catch (fehler) {
    return { fehler: fehler instanceof Error ? fehler.message : String(fehler) };
  }
}

/**
 * Ein Mangel, den auch ein wartender Lehrplan hat: an der Freigabe. Erkannt am
 * Pfad vorne, so wie `pruefeLehrplan` ihn schreibt.
 */
const FREIGABE_MANGEL = /^(geprueftVon|geprueftAm): /;

/**
 * Ob ein Lehrplantext ein Eintrag mit einer Liste `abschnitte` ist — das
 * Mindeste, womit sich vergleichen laesst.
 *
 * @param {string} text
 * @returns {boolean}
 */
function hatAbschnittsliste(text) {
  try {
    const daten = yamlLesen(text);
    return typeof daten === 'object' && daten !== null && 'abschnitte' in daten && Array.isArray(daten.abschnitte);
  } catch {
    return false;
  }
}

/**
 * Der Vergleich eines vorhandenen Lehrplans mit dem neuen Stand — und eine
 * Warnung, wenn es etwas zu sagen gibt.
 *
 * Ein kaputter, leerer oder ungueltiger Lehrplan bricht das Einlesen nicht
 * ab: Er bleibt Byte fuer Byte, wie er ist. Verglichen wird, sobald er ein
 * Eintrag mit einer Liste `abschnitte` ist, ueber die Rohdaten — auch wenn er
 * ungueltig ist, etwa weil eine Lektion fehlt, auf die er zeigt. Die Warnung
 * nennt dann den ersten Mangel, den ein wartender Lehrplan nicht hat: Die
 * leere Freigabe ist nach dem Einlesen der Normalfall, kein Fehler.
 *
 * Uebersprungen wird nur, wo sich nichts vergleichen laesst: bei einer Datei,
 * die sich nicht oeffnen laesst, einem YAML-Fehler oder einem Eintrag ohne
 * Liste `abschnitte`. Der Grund ist derselbe erste Mangel.
 *
 * @param {{ text: string } | { fehler: string }} vorhanden
 * @param {{ kurzname: string, wurzel: string, stand: string, abschnitte: readonly import('../lehrplan-geruest.mjs').Abschnitt[] }} neu
 * @returns {{ vergleich: import('../lehrplan-geruest.mjs').Vergleich | null, warnung: string | null }}
 */
function vergleicheVorhandenen(vorhanden, { kurzname, wurzel, stand, abschnitte }) {
  // Ohne den Schlusspunkt des Mangels: Der Satz geht danach weiter.
  /** @type {(grund: string) => string} */
  const ohnePunkt = (grund) => grund.replace(/\.$/, '');
  /** @type {(grund: string) => { vergleich: null, warnung: string }} */
  const uebersprungen = (grund) => ({
    vergleich: null,
    warnung: `Vergleich übersprungen: lehrplan/${kurzname}.yaml lässt sich nicht lesen — ${ohnePunkt(grund)}. Der Lehrplan bleibt, wie er ist.`,
  });

  if ('fehler' in vorhanden) return uebersprungen(vorhanden.fehler);
  const lektionen = lektionsIdsAus(path.join(wurzel, 'inhalt', 'lektionen'));
  const befund = lehrplanAusYaml(vorhanden.text, lektionen, `${kurzname}.yaml`);
  const mangel =
    befund.ok || befund.wartet ? null : (befund.maengel.find((m) => !FREIGABE_MANGEL.test(m)) ?? befund.maengel[0]);
  if (mangel !== null && !hatAbschnittsliste(vorhanden.text)) return uebersprungen(mangel);
  return {
    vergleich: vergleicheLehrplan(vorhanden.text, { stand, abschnitte }),
    warnung: mangel === null ? null : `lehrplan/${kurzname}.yaml ist ungültig: ${ohnePunkt(mangel)}. Der Lehrplan bleibt, wie er ist.`,
  };
}

/**
 * Was Einlesen und Tausch mit der Platte tun, als ein Buendel. Nur fuer Tests
 * austauschbar: Ein gesperrtes Umbenennen oder eine volle Platte laesst sich
 * anders nicht zuverlaessig herbeifuehren. `warte` haelt den Lauf fuer so
 * viele Millisekunden an — im Test, ohne wirklich zu warten.
 *
 * @typedef {{
 *   renameSync: (von: string, nach: string) => void,
 *   rmSync: (pfad: string, optionen: import('node:fs').RmOptions) => void,
 *   mkdirSync: (pfad: string, optionen: { recursive: true }) => unknown,
 *   writeFileSync: (pfad: string, daten: string | Uint8Array, optionen?: import('node:fs').WriteFileOptions) => void,
 *   warte: (ms: number) => void,
 * }} Dateisystem
 */

/** Worauf `warte` schlaeft: ein Wert, der sich nie aendert — so endet nur die Frist. */
const SCHLAF = new Int32Array(new SharedArrayBuffer(4));

/** @type {Dateisystem} */
const PLATTE = {
  renameSync,
  rmSync,
  mkdirSync,
  writeFileSync,
  // Synchron wie der Tausch selbst: Ein Timer liefe erst, wenn er vorbei ist.
  warte: (ms) => {
    Atomics.wait(SCHLAF, 0, 0, ms);
  },
};

/**
 * Wie entfernt wird: ganz, ohne Fehler, wenn es nichts gibt — und bei einer
 * Sperre fasst Node selbst dreimal nach, bevor es aufgibt.
 *
 * @type {import('node:fs').RmOptions}
 */
const ENTFERNEN = { recursive: true, force: true, maxRetries: 3, retryDelay: 100 };

/**
 * Codes, mit denen ein Umbenennen unter Windows oft nur einen Augenblick lang
 * scheitert: Ein Virenscanner oder der Suchindex haelt eine frisch
 * geschriebene Datei kurz fest.
 */
const FLUECHTIG = new Set(['EPERM', 'EBUSY', 'EACCES']);

/** Die Pausen zwischen den Versuchen: fuenf Versuche, zusammen hoechstens 1,5 Sekunden Warten. */
const PAUSEN = [100, 200, 400, 800];

/**
 * Benennt um und versucht es nach einer fluechtigen Sperre wieder. Jeder
 * andere Fehler geht sofort durch: Ein `ENOENT` wird durch Warten nicht
 * besser.
 *
 * @param {Dateisystem} platte
 * @param {string} von
 * @param {string} nach
 */
function umbenennen(platte, von, nach) {
  for (let versuch = 0; ; versuch++) {
    try {
      platte.renameSync(von, nach);
      return;
    } catch (fehler) {
      if (versuch >= PAUSEN.length || !FLUECHTIG.has(fehlercode(fehler))) throw fehler;
      platte.warte(PAUSEN[versuch]);
    }
  }
}

/**
 * Entfernt, was halb gebaut liegen blieb: den Ordner `.neu` oder einen halb
 * geschriebenen Lehrplan. Gelingt das nicht, bleibt es liegen, und der
 * Fehler, der hierher fuehrte, geht vor. Ein `.neu` raeumt der naechste Lauf
 * vorher weg, und die Bibliothek sieht Ordner mit einem Punkt vorne nicht
 * (`import.meta.glob` laesst sie aus).
 *
 * @param {string} pfad
 * @param {Dateisystem['rmSync']} entfernen
 */
function raeumeWeg(pfad, entfernen) {
  try {
    entfernen(pfad, ENTFERNEN);
  } catch {
    // liegen lassen — siehe oben
  }
}

/**
 * Setzt den fertig gebauten Ordner `quellen/.<k>.neu` an die Stelle von
 * `quellen/<k>`.
 *
 * Zwei Umbenennungen statt Loeschen und Neuschreiben: `quellen/<k>` ist zu
 * jedem Zeitpunkt der vollstaendige alte Stand, der vollstaendige neue oder —
 * fuer die Dauer einer Umbenennung — gar nicht da; einen halben Ordner gibt es
 * nie. Scheitert ein Umbenennen — unter Windows etwa, wenn ein PDF aus
 * `original/` noch in einem Betrachter offen ist —, wird zurueckgerollt: Der
 * alte Stand kommt an seinen Platz, `.neu` wird entfernt.
 *
 * Scheitert auch das Zuruecklegen, bleiben beide Staende liegen, und die
 * Meldung sagt, wo, und wie der alte zurueckkommt. Der naechste Lauf haelt
 * dann an `.alt` an, statt es zu ueberschreiben — darin steckt der einzige
 * vollstaendige alte Stand. Laesst sich nach gelungenem Tausch nur `.alt`
 * nicht entfernen, ist der neue Stand eingelesen; zurueck kommt dann eine
 * Warnung statt eines Abbruchs.
 *
 * Oft scheitert ein Umbenennen unter Windows nur einen Augenblick lang: Ein
 * Virenscanner haelt die frisch geschriebenen PDF fest. Jedes Umbenennen wird
 * deshalb bei `EPERM`, `EBUSY` und `EACCES` bis zu fuenfmal versucht
 * (`umbenennen`); erst danach gilt es als gescheitert.
 *
 * `dateisystem` ist nur fuer Tests austauschbar (siehe `Dateisystem`).
 *
 * @param {string} quellen der Ordner `quellen/` unter der Wurzel
 * @param {string} kurzname
 * @param {Partial<Dateisystem>} [dateisystem]
 * @returns {string | null} eine Warnung, wenn am Ende nur `.alt` liegen blieb
 */
export function tausche(quellen, kurzname, dateisystem = {}) {
  /** @type {Dateisystem} */
  const platte = { ...PLATTE, ...dateisystem };
  const ziel = path.join(quellen, kurzname);
  const neu = path.join(quellen, `.${kurzname}.neu`);
  const alt = path.join(quellen, `.${kurzname}.alt`);

  const hatteAlten = existsSync(ziel);
  // Die Frage nach einer offenen Datei nur, wo es einen Ordner gab, aus dem eine
  // offen sein kann, und nur bei einem Fehler, der nach einer Sperre aussieht
  // (siehe FLUECHTIG): ENOENT und Aehnliches loest sich nicht durchs Schliessen
  // einer Datei, und die Frage waere am falschen Ort gesucht.
  /** @type {(fehler: unknown) => EinleseFehler} */
  const gescheitert = (fehler) => {
    const code = fehlercode(fehler);
    if (!hatteAlten) return new EinleseFehler(`quellen/${kurzname}/ lässt sich nicht anlegen (${code}). Nichts verändert.`);
    return new EinleseFehler(
      FLUECHTIG.has(code)
        ? `quellen/${kurzname}/ lässt sich nicht ersetzen (${code}) — ist eine Datei daraus noch geöffnet? Nichts verändert.`
        : `quellen/${kurzname}/ lässt sich nicht ersetzen (${code}). Nichts verändert.`,
    );
  };

  if (hatteAlten) {
    try {
      umbenennen(platte, ziel, alt);
    } catch (fehler) {
      raeumeWeg(neu, platte.rmSync);
      throw gescheitert(fehler);
    }
  }
  try {
    umbenennen(platte, neu, ziel);
  } catch (fehler) {
    if (hatteAlten) {
      try {
        umbenennen(platte, alt, ziel);
      } catch (auchDas) {
        throw new EinleseFehler(
          `quellen/${kurzname}/ lässt sich nicht ersetzen (${fehlercode(fehler)}), ` +
            `und der alte Stand ließ sich nicht zurücklegen (${fehlercode(auchDas)}). ` +
            `Der alte Stand liegt in quellen/.${kurzname}.alt, der neue in quellen/.${kurzname}.neu. ` +
            `Zurück zum alten Stand: quellen/.${kurzname}.alt in quellen/${kurzname} umbenennen, ` +
            `quellen/.${kurzname}.neu löschen, dann neu einlesen.`,
        );
      }
    }
    raeumeWeg(neu, platte.rmSync);
    throw gescheitert(fehler);
  }
  if (!hatteAlten) return null;
  try {
    platte.rmSync(alt, ENTFERNEN);
    return null;
  } catch (fehler) {
    return (
      `quellen/.${kurzname}.alt ließ sich nicht entfernen (${fehlercode(fehler)}). Der neue Stand ist eingelesen; ` +
      'bitte den Ordner von Hand löschen — bis dahin hält das nächste Einlesen dort an.'
    );
  }
}

/**
 * Liest eine Quelle aus Foliensaetzen ein.
 *
 * In zwei Schritten, und der erste schreibt nichts. **Rechnen:** alle PDF
 * lesen, pruefen, bereinigen, gliedern, Rohdateien, Manifest und Lehrplan im
 * Speicher bauen, einen vorhandenen Lehrplan lesen. Scheitert dort etwas — ein
 * kaputtes PDF, ein Buch, eine Quelle anderer Art unter demselben Namen —, ist
 * nichts veraendert. **Tauschen:** `quellen/.<k>.neu` aufbauen und an die
 * Stelle von `quellen/<k>` setzen (`tausche`); dann, wenn es keinen gab, den
 * Lehrplan anlegen.
 *
 * Die Originale werden aus den Bytes geschrieben, die gelesen und gehasht
 * wurden, nicht noch einmal kopiert: Liegt eine Eingabe in
 * `quellen/<k>/original/` selbst, gibt es sie beim Tauschen dort nicht mehr —
 * und so passt der Hash im Manifest sicher zur Datei daneben.
 *
 * `dateisystem` ist nur fuer Tests austauschbar, wie bei `tausche`.
 *
 * @param {{
 *   orte: readonly string[],
 *   kurzname: string,
 *   titel: string,
 *   wurzel: string,
 *   art?: 'folien',
 *   gestempeltAm: string,
 *   geladen?: Awaited<ReturnType<typeof ladePdfjs>>,
 *   dateisystem?: Partial<Dateisystem>,
 * }} auftrag
 * @returns {Promise<Ergebnis>}
 */
export async function leseFolienEin({ orte, kurzname, titel, wurzel, art, gestempeltAm, geladen, dateisystem }) {
  if (!ID_MUSTER.test(kurzname)) {
    throw new EinleseFehler(`--name ${kurzname}: nur Kleinbuchstaben, Ziffern und Bindestrich.`);
  }
  // Vor jedem Zugriff auf die Platte: Schon ein existsSync liefert hier Unsinn.
  if (WINDOWS_RESERVIERT.test(kurzname)) {
    throw new EinleseFehler(`Der Kurzname ${kurzname} ist unter Windows reserviert — bitte einen anderen wählen.`);
  }
  if (!titel.trim()) throw new EinleseFehler('--titel fehlt. Die Bibliothek zeigt ihn auf der Karte.');

  // --- vorab: was schon da ist ----------------------------------------------
  const quellen = path.join(wurzel, 'quellen');
  const lehrplanPfad = path.join(wurzel, 'lehrplan', `${kurzname}.yaml`);
  // Zuerst .alt, und nichts anfassen. Was es bedeutet, sagt quellen/<k>/
  // daneben. Fehlt es, blieb ein Tausch auf halbem Weg stehen — Doppelfehler
  // oder Abbruch zwischen den beiden Umbenennungen —, und in .alt steckt der
  // einzige vollstaendige Stand; ein weiterer Tausch wuerde ihn
  // ueberschreiben. Ist es da, war der Tausch fertig, und nur das Aufraeumen
  // blieb aus.
  if (existsSync(path.join(quellen, `.${kurzname}.alt`))) {
    throw new EinleseFehler(
      existsSync(path.join(quellen, kurzname))
        ? `quellen/.${kurzname}.alt ist der Rest eines abgeschlossenen Laufs; der eingelesene Stand liegt in quellen/${kurzname}/. ` +
            `Bitte quellen/.${kurzname}.alt löschen, dann neu einlesen.`
        : `quellen/${kurzname}/ fehlt. Der letzte vollständige Stand liegt in quellen/.${kurzname}.alt. ` +
            `Wiederherstellen: quellen/.${kurzname}.alt in quellen/${kurzname} umbenennen, ` +
            `quellen/.${kurzname}.neu löschen (falls vorhanden), dann neu einlesen.`,
    );
  }
  const manifestArt = artImManifest(path.join(quellen, kurzname, 'manifest.json'));
  if (manifestArt !== null && manifestArt !== 'folien') {
    throw new EinleseFehler(
      `quellen/${kurzname}/ gehört schon zu einer Quelle der Art ${manifestArt} — für Foliensätze einen anderen Kurznamen wählen. Nichts verändert.`,
    );
  }
  const vorhanden = existsSync(lehrplanPfad) ? liesVorhandenen(lehrplanPfad) : null;
  const lehrplanArt = vorhanden !== null && 'text' in vorhanden ? artImLehrplan(vorhanden.text) : null;
  if (lehrplanArt !== null && ANDERE_LEHRPLAN_ARTEN.has(lehrplanArt)) {
    throw new EinleseFehler(
      `lehrplan/${kurzname}.yaml gehört schon zu einer Quelle der Art ${lehrplanArt} — für Foliensätze einen anderen Kurznamen wählen. Nichts verändert.`,
    );
  }

  // --- rechnen: nichts auf die Platte ---------------------------------------
  const pfade = sammlePdfs(orte);
  // Vor dem Lesen, und ohne Gross- und Kleinschreibung: Unter Windows sind
  // a.pdf und A.pdf dieselbe Datei — in original/ bliebe nur eine davon.
  /** @type {Map<string, string>} */
  const gesehen = new Map();
  for (const pfad of pfade) {
    const name = path.basename(pfad).toLowerCase();
    const frueher = gesehen.get(name);
    if (frueher !== undefined) {
      throw new EinleseFehler(
        `Zwei Originale heißen gleich (Groß- und Kleinschreibung zählt nicht): ${frueher} und ${pfad}. ` +
          'Im Lehrplan steht der Dateiname; er muss eindeutig sein.',
      );
    }
    gesehen.set(name, pfad);
  }
  const pdfjs = geladen ?? (await ladePdfjs());

  /** @type {{ datei: string, bytes: Buffer, hash: string, seiten: import('./dokument.mjs').RohSeite[] }[]} */
  const roh = [];
  for (const pfad of pfade) {
    const datei = path.basename(pfad);
    try {
      // Die Bytes bleiben im Speicher: Aus ihnen wird gehasht und spaeter das
      // Original geschrieben. pdf.js bekommt eine Kopie.
      const bytes = readFileSync(pfad);
      const hash = dateiHash(bytes);
      const { seiten } = await liesSeiten(new Uint8Array(bytes), pdfjs);
      roh.push({ datei, bytes, hash, seiten });
    } catch (fehler) {
      const grund = lesegrund(fehler);
      if (grund === null) throw fehler;
      throw new EinleseFehler(`${datei}: ${grund}`);
    }
  }

  const namen = roh.map((r) => r.datei);

  const dateien = bereinigeQuelle(roh.map((r) => ({ datei: r.datei, seiten: r.seiten })));
  const abgebrochen = dateien.filter((d) => d.abbruch !== null);
  if (abgebrochen.length) throw new EinleseFehler(abgebrochen.map((d) => d.abbruch).join('\n'));

  const erkannt = artDerQuelle(dateien);
  if (erkannt.art === 'buch' && art !== 'folien') {
    throw new EinleseFehler(
      'Bücher liest diese Fassung noch nicht ein — erkannt wurde „buch" ' +
        `(${erkannt.quer} von ${erkannt.seiten} Seiten quer, Median ${erkannt.median} Zeichen). ` +
        'Mit --art folien lässt sich die Erkennung überstimmen.',
    );
  }

  const kuerzel = dateikuerzel(namen);
  const gegliedert = dateien.map((d) => ({ datei: d, ...gliedereFolien(d, kuerzel.get(d.datei) ?? 'd01') }));
  const abschnitte = gegliedert.flatMap((g) => g.abschnitte);
  const stand = standAusHashes(roh.map((r) => r.hash));

  /** @type {{ name: string, text: string }[]} */
  const rohdateien = [];
  /** @type {import('../manifest.mjs').Rohdatei[]} */
  const rohListe = [];
  for (const { datei, abschnitte: teile } of gegliedert) {
    for (const abschnitt of teile) {
      const [von, bis] = abschnitt.seiten;
      const seiten = datei.seiten.filter((s) => s.nummer >= von && s.nummer <= bis);
      rohdateien.push({ name: `${abschnitt.id}.md`, text: rohdatei(abschnitt, seiten) });
      rohListe.push({
        id: abschnitt.id,
        datei: abschnitt.datei,
        seiten: abschnitt.seiten,
        nurBild: seiten.filter((s) => s.nurBild).map((s) => s.nummer),
        tabellenverdacht: seiten.filter((s) => s.tabellenverdacht).map((s) => s.nummer),
      });
    }
  }

  const manifest = baueDokumentManifest({
    art: 'folien',
    originale: gegliedert.map(({ datei, gliederung }, i) => ({
      datei: datei.datei,
      dateiHash: roh[i].hash,
      seiten: datei.seitenzahl,
      gliederung,
      beiwerkZeichen: datei.beiwerkZeichen,
    })),
    roh: rohListe,
    gestempeltAm,
  });

  const warnungen = dateien
    .filter((d) => d.beiwerkAnteil > BEIWERK_WARNUNG)
    .map(
      (d) =>
        `${d.datei}: ${prozent(d.beiwerkAnteil)} des Texts als Beiwerk entfernt — ` +
        'vermutlich stimmt etwas mit der Extraktion nicht.',
    );

  // Nie ueberschreiben: Im Lehrplan steckt die Arbeit des Compilers und die
  // Freigabe eines Menschen. Gemeldet wird, was sich geaendert hat.
  /** @type {import('../lehrplan-geruest.mjs').Vergleich | null} */
  let vergleich = null;
  if (vorhanden !== null) {
    const bewertet = vergleicheVorhandenen(vorhanden, { kurzname, wurzel, stand, abschnitte });
    vergleich = bewertet.vergleich;
    if (bewertet.warnung) warnungen.push(bewertet.warnung);
  }
  const geruest = vorhanden === null ? lehrplanGeruest({ kurzname, titel, stand, abschnitte }) : null;

  // --- tauschen -------------------------------------------------------------
  /** @type {Dateisystem} */
  const platte = { ...PLATTE, ...dateisystem };
  const neu = path.join(quellen, `.${kurzname}.neu`);
  // Ein .neu aus einem abgebrochenen Lauf ist halb gebaut, womoeglich mit
  // Dateien, die nicht hierher gehoeren: weg damit, bevor etwas hineinkommt.
  try {
    platte.rmSync(neu, ENTFERNEN);
  } catch (fehler) {
    if (!istSystemfehler(fehler)) throw fehler;
    throw new EinleseFehler(
      `quellen/.${kurzname}.neu aus einem früheren Lauf lässt sich nicht entfernen (${fehlercode(fehler)}). ` +
        'Nichts verändert; bitte den Ordner von Hand löschen, dann neu einlesen.',
    );
  }
  try {
    platte.mkdirSync(path.join(neu, 'original'), { recursive: true });
    platte.mkdirSync(path.join(neu, 'roh'), { recursive: true });
    for (const { datei, bytes } of roh) platte.writeFileSync(path.join(neu, 'original', datei), bytes);
    for (const { name, text } of rohdateien) platte.writeFileSync(path.join(neu, 'roh', name), text, 'utf8');
    platte.writeFileSync(path.join(neu, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  } catch (fehler) {
    raeumeWeg(neu, platte.rmSync);
    if (!istSystemfehler(fehler)) throw fehler;
    throw new EinleseFehler(`Schreiben nach quellen/.${kurzname}.neu gescheitert (${fehlercode(fehler)}). Nichts verändert.`);
  }
  const liegenGeblieben = tausche(quellen, kurzname, platte);
  if (liegenGeblieben) warnungen.push(liegenGeblieben);

  // Der Lehrplan erst jetzt: Scheitert der Tausch, ist auch er nicht angelegt.
  let geschrieben = false;
  if (geruest !== null) {
    /** @type {(fehler: unknown) => EinleseFehler} */
    const ohneLehrplan = (fehler) =>
      new EinleseFehler(
        [
          `quellen/${kurzname}/ ist neu eingelesen, aber lehrplan/${kurzname}.yaml ließ sich nicht schreiben (${fehlercode(fehler)}).`,
          // Die Warnung zu .alt geht mit: Bis .alt weg ist, haelt auch der naechste Lauf dort an.
          ...(liegenGeblieben ? [`Warnung: ${liegenGeblieben}`] : []),
        ].join('\n'),
      );
    try {
      platte.mkdirSync(path.dirname(lehrplanPfad), { recursive: true });
    } catch (fehler) {
      if (!istSystemfehler(fehler)) throw fehler;
      throw ohneLehrplan(fehler);
    }
    try {
      // wx legt die Datei nur an, wenn es sie in diesem Augenblick nicht gibt;
      // Pruefen und Anlegen sind ein Schritt. Ist der Lehrplan seit dem Lesen
      // oben entstanden — von Hand, aus einem Editor, durch einen anderen
      // Lauf —, wird verglichen statt ueberschrieben. Zwei Laeufe mit demselben
      // Kurznamen zugleich sichert das nicht ab: Sie teilen sich
      // quellen/.<k>.neu und .alt und koennen einander dort stoeren. Eine
      // Sperre gibt es nicht.
      platte.writeFileSync(lehrplanPfad, geruest, { encoding: 'utf8', flag: 'wx' });
      geschrieben = true;
    } catch (fehler) {
      if (fehlercode(fehler) !== 'EEXIST') {
        if (!istSystemfehler(fehler)) throw fehler;
        // Scheitert erst das Schreiben nach dem Anlegen, ist die halbe Datei
        // die eigene — wx hat sie eben erst angelegt. Liegen gelassen, hielte
        // der naechste Lauf sie fuer einen Lehrplan und legte das Geruest nie an.
        if (/** @type {Error & { syscall?: unknown }} */ (fehler).syscall !== 'open') raeumeWeg(lehrplanPfad, platte.rmSync);
        throw ohneLehrplan(fehler);
      }
      const bewertet = vergleicheVorhandenen(liesVorhandenen(lehrplanPfad), { kurzname, wurzel, stand, abschnitte });
      vergleich = bewertet.vergleich;
      if (bewertet.warnung) warnungen.push(bewertet.warnung);
    }
  }

  return {
    kurzname,
    stand,
    originale: gegliedert.map(({ datei, gliederung }, i) => ({
      datei: datei.datei,
      dateiHash: roh[i].hash,
      seiten: datei.seitenzahl,
      gliederung,
      beiwerkZeichen: datei.beiwerkZeichen,
      beiwerkAnteil: datei.beiwerkAnteil,
      nurBild: datei.nurBild,
      tabellenverdacht: datei.tabellenverdacht,
    })),
    abschnitte,
    warnungen,
    lehrplan: { pfad: lehrplanPfad, geschrieben, vergleich },
  };
}
