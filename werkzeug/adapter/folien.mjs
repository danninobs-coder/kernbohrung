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
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { BEIWERK_WARNUNG, artDerQuelle, bereinigeQuelle, ladePdfjs, liesSeiten, seitenText } from './dokument.mjs';
import { dateikuerzel, gliedereFolien } from '../gliederung/folien.mjs';
import { baueDokumentManifest, dateiHash, standAusHashes } from '../manifest.mjs';
import { lehrplanGeruest, vergleicheLehrplan } from '../lehrplan-geruest.mjs';

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
    if (!existsSync(ort)) throw new EinleseFehler(`${ort} gibt es nicht.`);
    if (statSync(ort).isDirectory()) {
      const drin = readdirSync(ort).filter((name) => name.toLowerCase().endsWith(ENDUNG));
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
    if (seite.nurBild) return `— Folie ${seite.nummer} —\n${NUR_BILD_ZEILE}`;
    const text = seitenText(seite);
    return seite.tabellenverdacht ? `${WARNZEILE}\n${text}` : text;
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
 * Liest eine Quelle aus Foliensaetzen ein.
 *
 * @param {{
 *   orte: readonly string[],
 *   kurzname: string,
 *   titel: string,
 *   wurzel: string,
 *   art?: 'folien',
 *   gestempeltAm: string,
 *   geladen?: Awaited<ReturnType<typeof ladePdfjs>>,
 * }} auftrag
 * @returns {Promise<Ergebnis>}
 */
export async function leseFolienEin({ orte, kurzname, titel, wurzel, art, gestempeltAm, geladen }) {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(kurzname)) {
    throw new EinleseFehler(`--name ${kurzname}: nur Kleinbuchstaben, Ziffern und Bindestrich.`);
  }
  if (!titel.trim()) throw new EinleseFehler('--titel fehlt. Die Bibliothek zeigt ihn auf der Karte.');

  const pfade = sammlePdfs(orte);
  const pdfjs = geladen ?? (await ladePdfjs());

  /** @type {{ datei: string, hash: string, seiten: import('./dokument.mjs').RohSeite[] }[]} */
  const roh = [];
  for (const pfad of pfade) {
    const bytes = readFileSync(pfad);
    const { seiten } = await liesSeiten(new Uint8Array(bytes), pdfjs);
    roh.push({ datei: path.basename(pfad), hash: dateiHash(bytes), seiten });
  }

  const namen = roh.map((r) => r.datei);
  if (new Set(namen).size !== namen.length) {
    throw new EinleseFehler('Zwei Originale heißen gleich. Im Lehrplan steht der Dateiname; er muss eindeutig sein.');
  }

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

  // --- schreiben ------------------------------------------------------------
  const quellordner = path.join(wurzel, 'quellen', kurzname);
  const rohordner = path.join(quellordner, 'roh');
  const originalordner = path.join(quellordner, 'original');
  // Alte Rohdateien wegraeumen: Faellt ein Abschnitt weg, bliebe er sonst
  // liegen und das Manifest widerspraeche dem Ordner daneben.
  rmSync(rohordner, { recursive: true, force: true });
  rmSync(originalordner, { recursive: true, force: true });
  mkdirSync(rohordner, { recursive: true });
  mkdirSync(originalordner, { recursive: true });
  pfade.forEach((pfad) => copyFileSync(pfad, path.join(originalordner, path.basename(pfad))));

  /** @type {import('../manifest.mjs').Rohdatei[]} */
  const rohListe = [];
  for (const { datei, abschnitte: teile } of gegliedert) {
    for (const abschnitt of teile) {
      const [von, bis] = abschnitt.seiten;
      const seiten = datei.seiten.filter((s) => s.nummer >= von && s.nummer <= bis);
      writeFileSync(path.join(rohordner, `${abschnitt.id}.md`), rohdatei(abschnitt, seiten), 'utf8');
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
  writeFileSync(path.join(quellordner, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  // --- Lehrplan -------------------------------------------------------------
  const lehrplanPfad = path.join(wurzel, 'lehrplan', `${kurzname}.yaml`);
  const text = lehrplanGeruest({ kurzname, titel, stand, abschnitte });
  let geschrieben = false;
  /** @type {import('../lehrplan-geruest.mjs').Vergleich | null} */
  let vergleich = null;
  if (existsSync(lehrplanPfad)) {
    // Nie ueberschreiben: Im Lehrplan steckt die Arbeit des Compilers und die
    // Freigabe eines Menschen. Gemeldet wird, was sich geaendert hat.
    vergleich = vergleicheLehrplan(readFileSync(lehrplanPfad, 'utf8'), { stand, abschnitte });
  } else {
    mkdirSync(path.dirname(lehrplanPfad), { recursive: true });
    writeFileSync(lehrplanPfad, text, 'utf8');
    geschrieben = true;
  }

  const warnungen = dateien
    .filter((d) => d.beiwerkAnteil > BEIWERK_WARNUNG)
    .map(
      (d) =>
        `${d.datei}: ${(d.beiwerkAnteil * 100).toFixed(1)} % des Texts als Beiwerk entfernt — ` +
        'vermutlich stimmt etwas mit der Extraktion nicht.',
    );

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
