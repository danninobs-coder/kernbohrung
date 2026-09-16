// Macht einen gebauten Stand ortsunabhaengig.
//
// Astro schreibt wurzelbezogene Verweise: href="/lektion/x/", src="/_astro/y.js".
// Die funktionieren nur, wenn die Seite unter dem Wurzelpfad einer Domaene
// liegt. Sobald sie in einem Unterpfad haengt - ein Projektauftritt auf
// GitHub Pages, eine Vorschau, ein Artifact - zeigen sie ins Leere, und zwar
// lautlos: Das HTML kommt an, das Stylesheet nicht.
//
// Dieses Werkzeug rechnet jeden wurzelbezogenen Verweis in einen relativen um,
// abhaengig davon, wie tief die Datei liegt, die ihn traegt.
//
// Es ist bewusst eine Nachbearbeitung und keine Astro-Einstellung: `base`
// verlangt einen festen Unterpfad, der zur Bauzeit bekannt sein muss. Genau das
// ist hier nicht der Fall - derselbe Bau soll an mehreren Orten laufen.

import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/** Verweise auf fremde Rechner, Daten-URIs und Anker bleiben unberuehrt. */
const FREMD = /^([a-z][a-z0-9+.-]*:|\/\/|#)/i;

/**
 * Rechnet einen wurzelbezogenen Pfad in einen relativen um.
 *
 * `tiefe` ist die Anzahl der Verzeichnisse zwischen Wurzel und der Datei, die
 * den Verweis traegt: dist/index.html hat Tiefe 0, dist/lektion/x/index.html
 * hat Tiefe 2.
 *
 * Der Sonderfall "/" ist der Grund, warum das keine Zeile Ersetzung ist: Auf
 * Tiefe 0 muesste daraus "" werden, und ein leeres href zeigt auf die Seite
 * selbst - richtig, aber nur zufaellig. Explizit ist es "./" beziehungsweise
 * "../../".
 *
 * @param {string} ziel wurzelbezogener Pfad, beginnt mit "/"
 * @param {number} tiefe
 * @returns {string}
 */
export function relativiere(ziel, tiefe) {
  if (!ziel.startsWith('/') || ziel.startsWith('//')) return ziel;
  const hinauf = tiefe === 0 ? './' : '../'.repeat(tiefe);
  const rest = ziel.slice(1);
  return benenneIndex(rest === '' ? hinauf : hinauf + rest);
}

/**
 * Macht aus einem Verzeichnisverweis einen Dateiverweis.
 *
 * Astro schreibt href="/lektion/x/". Ein Webserver loest das ueber ein
 * Verzeichnisregister auf und liefert index.html. Nicht jeder Ort tut das:
 * Eine Ablage, die nur die veroeffentlichten Pfade kennt, findet unter
 * "lektion/x/" nichts und liefert nichts - ohne Fehlermeldung, die Seite
 * bleibt einfach leer.
 *
 * "lektion/x/index.html" funktioniert dagegen ueberall, auch dort, wo das
 * Verzeichnisregister existiert. Der Preis ist ein sichtbares .html in der
 * Adresszeile.
 *
 * Der Fragezeichen- und Rautenteil bleibt hinten stehen: "/x/?a=1#b" wird zu
 * "x/index.html?a=1#b", nicht zu "x/?a=1#b/index.html".
 *
 * @param {string} pfad
 * @returns {string}
 */
export function benenneIndex(pfad) {
  const schnitt = pfad.search(/[?#]/);
  const ort = schnitt === -1 ? pfad : pfad.slice(0, schnitt);
  const anhang = schnitt === -1 ? '' : pfad.slice(schnitt);
  return ort.endsWith('/') ? `${ort}index.html${anhang}` : pfad;
}

/**
 * Schreibt alle wurzelbezogenen Verweise eines HTML-Textes um.
 *
 * Betroffen sind href, src und srcset. Nicht betroffen sind Verweise mit
 * Schema (https:, data:, mailto:), schemalose (//cdn...) und reine Anker (#x)
 * - die sind entweder nicht ortsabhaengig oder sollen es nicht sein.
 *
 * @param {string} html
 * @param {number} tiefe
 * @returns {{html: string, umgeschrieben: number}}
 */
export function schreibeUm(html, tiefe) {
  let umgeschrieben = 0;

  // component-url und renderer-url sind keine Zierde: An ihnen haengt die
  // Hydrierung. Astro schreibt <astro-island component-url="/_astro/Frage.js"
  // renderer-url="/_astro/client.js">, und das sind weder href noch src. Wer
  // nur href und src umschreibt, bekommt eine Seite, die richtig aussieht und
  // auf keinen Knopf reagiert — ohne Fehlermeldung im HTML, nur eine
  // fehlgeschlagene Anfrage in der Konsole.
  const einfach = html.replace(
    /\b(href|src|component-url|renderer-url|before-hydration-url)=(["'])([^"']*)\2/gi,
    (ganz, attribut, anfuehrung, ziel) => {
      if (FREMD.test(ziel) || !ziel.startsWith('/')) return ganz;
      umgeschrieben += 1;
      return `${attribut}=${anfuehrung}${relativiere(ziel, tiefe)}${anfuehrung}`;
    },
  );

  // srcset traegt mehrere Ziele mit Breitenangabe, durch Komma getrennt.
  const mitSrcset = einfach.replace(
    /\bsrcset=(["'])([^"']*)\1/gi,
    (/** @type {string} */ _ganz, /** @type {string} */ anfuehrung, /** @type {string} */ liste) => {
      const teile = liste.split(',').map((/** @type {string} */ teil) => {
        // Gestutzt zurueckgeben, nicht das Teilstueck: Nach dem Zerlegen am
        // Komma traegt jedes Folgeteil ein fuehrendes Leerzeichen, das sich
        // beim Zusammenfuegen mit ", " zu einem doppelten summieren wuerde.
        const gestutzt = teil.trim();
        if (!gestutzt) return gestutzt;
        const [ziel, ...mass] = gestutzt.split(/\s+/);
        if (FREMD.test(ziel) || !ziel.startsWith('/')) return gestutzt;
        umgeschrieben += 1;
        return [relativiere(ziel, tiefe), ...mass].join(' ');
      });
      return `srcset=${anfuehrung}${teile.join(', ')}${anfuehrung}`;
    },
  );

  return { html: mitSrcset, umgeschrieben };
}

/**
 * Wie viele Verzeichnisse liegen zwischen Wurzel und Datei.
 *
 * @param {string} wurzel
 * @param {string} datei
 * @returns {number}
 */
export function tiefeVon(wurzel, datei) {
  const rel = path.relative(wurzel, datei).split(path.sep);
  return rel.length - 1;
}

/**
 * Laeuft ueber alle HTML-Dateien unterhalb von `wurzel` und schreibt sie um.
 *
 * @param {string} wurzel
 * @returns {Promise<{dateien: number, verweise: number}>}
 */
export async function relativiereBau(wurzel) {
  const eintraege = await fs.readdir(wurzel, { recursive: true, withFileTypes: true });
  let dateien = 0;
  let verweise = 0;

  for (const eintrag of eintraege) {
    if (!eintrag.isFile() || !eintrag.name.endsWith('.html')) continue;
    const voll = path.join(eintrag.parentPath, eintrag.name);
    const html = await fs.readFile(voll, 'utf8');
    const { html: neu, umgeschrieben } = schreibeUm(html, tiefeVon(wurzel, voll));
    if (umgeschrieben > 0) await fs.writeFile(voll, neu, 'utf8');
    dateien += 1;
    verweise += umgeschrieben;
  }

  return { dateien, verweise };
}

/**
 * Sucht nach wurzelbezogenen Verweisen, die uebrig geblieben sind.
 *
 * Der Wachposten gegen genau den Fehler, der diesem Werkzeug schon einmal
 * unterlaufen ist: component-url wurde nicht umgeschrieben, die Seite sah
 * richtig aus und reagierte auf keinen Knopf. Ein stiller Fehlschlag wird hier
 * zu einem lauten.
 *
 * @param {string} wurzel
 * @returns {Promise<string[]>} Fundstellen als "datei: verweis"
 */
export async function suchWurzelbezogene(wurzel) {
  const eintraege = await fs.readdir(wurzel, { recursive: true, withFileTypes: true });
  const funde = [];
  for (const eintrag of eintraege) {
    if (!eintrag.isFile() || !eintrag.name.endsWith('.html')) continue;
    const voll = path.join(eintrag.parentPath, eintrag.name);
    const html = await fs.readFile(voll, 'utf8');
    for (const [, , ziel] of html.matchAll(/([a-z-]+)=(["'])(\/[^"'/][^"']*)\2/gi)) {
      funde.push(`${path.relative(wurzel, voll)}: ${ziel}`);
    }
  }
  return funde;
}

// pathToFileURL, nicht `file://${argv[1]}`: Auf Windows fehlt dort der dritte
// Schraegstrich, der Vergleich schlaegt still fehl und das Werkzeug tut nichts.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const wurzel = process.argv[2] ?? 'dist';
  const { dateien, verweise } = await relativiereBau(wurzel);
  console.log(`${dateien} HTML-Dateien, ${verweise} Verweise relativiert.`);

  const uebrig = await suchWurzelbezogene(wurzel);
  if (uebrig.length > 0) {
    console.error(`\nFEHLER: ${uebrig.length} wurzelbezogene Verweise blieben stehen:`);
    for (const fund of uebrig.slice(0, 20)) console.error('  ' + fund);
    process.exit(1);
  }
  console.log('Kein wurzelbezogener Verweis mehr uebrig.');
}
