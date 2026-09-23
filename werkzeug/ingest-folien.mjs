/**
 * Der Folien-Weg des Einlesens: Befehlszeile, Ausgabe, Fehler.
 *
 *   npm run ingest -- --folien <pfad> [--folien <pfad> …] --name <kurzname> --titel "<Titel>" [--art folien]
 *
 * Die Arbeit macht `adapter/folien.mjs`; hier wird nur gelesen, was auf der
 * Kommandozeile steht, und berichtet, was herauskam.
 *
 * **Nie Folientext auf der Konsole.** Gemeldet werden Zahlen, Dateinamen,
 * Abschnitt-Ids und Abschnittstitel — die Titel stehen ohnehin im Lehrplan,
 * den ein Mensch lesen muss. Der Inhalt der Folien bleibt in `quellen/`, und
 * `quellen/` bleibt am Rechner.
 */
import path from 'node:path';
import { EinleseFehler, leseFolienEin, prozent } from './adapter/folien.mjs';
import { vergleichInZeilen } from './lehrplan-geruest.mjs';

const AUFRUF =
  'Aufruf: npm run ingest -- --folien <pfad> [--folien <pfad> …] --name <kurzname> --titel "<Titel>" [--art folien]\n' +
  '  <pfad> ist eine PDF-Datei oder eine Mappe (dann alle .pdf darin).\n' +
  '  Beispiel: npm run ingest -- --folien "C:/Vorlesung/1. Tag" --folien "C:/Vorlesung/2. Tag" \\\n' +
  '              --name bauch-projektmanagement --titel "Vorlesung Projektmanagement"';

/**
 * Alle Werte eines mehrfach erlaubten Arguments, in der Reihenfolge der
 * Kommandozeile.
 *
 * @param {readonly string[]} argv
 * @param {string} name
 * @returns {string[]}
 */
export function argumente(argv, name) {
  /** @type {string[]} */
  const werte = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === `--${name}` && argv[i + 1] !== undefined && !argv[i + 1].startsWith('--')) werte.push(argv[i + 1]);
  }
  return werte;
}

/**
 * Der Bericht eines Laufs, Zeile fuer Zeile.
 *
 * @param {import('./adapter/folien.mjs').Ergebnis} ergebnis
 * @param {string} wurzel
 * @returns {string[]}
 */
export function bericht(ergebnis, wurzel) {
  const seiten = ergebnis.originale.reduce((n, o) => n + o.seiten, 0);
  const zeilen = [
    '',
    `${ergebnis.originale.length} Originale, ${seiten} Seiten, ${ergebnis.abschnitte.length} Abschnitte.`,
  ];
  for (const o of ergebnis.originale) {
    zeilen.push(
      `  ${o.datei} — ${o.seiten} Seiten · ${o.gliederung} · Beiwerk ${prozent(o.beiwerkAnteil)} · ` +
        `${o.nurBild.length} nur Bild · ${o.tabellenverdacht.length} mit Tabelle oder Grafik`,
    );
  }
  zeilen.push('', 'Abschnitte:');
  for (const a of ergebnis.abschnitte) {
    const [von, bis] = a.seiten;
    zeilen.push(`  ${a.id} — ${a.datei}, ${von === bis ? `Folie ${von}` : `Folien ${von}\u2013${bis}`} — ${a.titel}`);
  }
  for (const warnung of ergebnis.warnungen) zeilen.push('', `Warnung: ${warnung}`);

  /** @type {(pfad: string) => string} */
  const rel = (pfad) => path.relative(wurzel, pfad).replaceAll(path.sep, '/');
  zeilen.push(
    '',
    `Stand ${ergebnis.stand}`,
    `  quellen/${ergebnis.kurzname}/ — Originale, ${ergebnis.abschnitte.length} Rohdateien, manifest.json`,
  );
  if (ergebnis.lehrplan.geschrieben) {
    zeilen.push(
      `  ${rel(ergebnis.lehrplan.pfad)} — angelegt, wartet auf Freigabe.`,
      '    geprueftVon und geprueftAm von Hand eintragen; bis dahin baut der Compiler daraus keine Lektionen.',
    );
  } else {
    zeilen.push(`  ${rel(ergebnis.lehrplan.pfad)} — liegt schon da und bleibt unverändert.`);
    const vergleich = ergebnis.lehrplan.vergleich;
    if (vergleich) for (const zeile of vergleichInZeilen(vergleich)) zeilen.push(`    ${zeile}`);
  }
  return zeilen;
}

/**
 * Liest die Kommandozeile und fuehrt den Folien-Weg aus.
 *
 * @param {readonly string[]} argv
 * @param {string} wurzel
 * @param {(zeile: string) => void} [schreibe]
 * @returns {Promise<number>} der Rueckgabewert des Prozesses
 */
export async function fuehreAus(argv, wurzel, schreibe = (zeile) => console.log(zeile)) {
  const orte = argumente(argv, 'folien');
  const kurzname = argumente(argv, 'name')[0] ?? '';
  const titel = argumente(argv, 'titel')[0] ?? '';
  const art = argumente(argv, 'art')[0];

  if (!kurzname || !titel) {
    schreibe('--name und --titel sind Pflicht.');
    schreibe(AUFRUF);
    return 2;
  }
  if (art !== undefined && art !== 'folien') {
    schreibe(`--art ${art} kennt diese Fassung nicht. Erlaubt ist nur --art folien.`);
    return 2;
  }

  try {
    const ergebnis = await leseFolienEin({
      orte,
      kurzname,
      titel,
      wurzel,
      art: art === 'folien' ? 'folien' : undefined,
      // Uebergeben, nicht im Manifest erzeugt — sonst ist jeder Lauf anders.
      gestempeltAm: new Date().toISOString(),
    });
    for (const zeile of bericht(ergebnis, wurzel)) schreibe(zeile);
    return 0;
  } catch (fehler) {
    if (!(fehler instanceof EinleseFehler)) throw fehler;
    schreibe(fehler.message);
    return 1;
  }
}
