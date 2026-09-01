/**
 * Entscheidet allein aus Pfad und Groesse, ob eine Datei ins Rohmaterial kommt.
 *
 * Bewusst eine reine Funktion ohne Dateisystemzugriff: So laesst sie sich ohne
 * Quelle testen, und der Adapter kann sie auf einen Git-Baum anwenden, bevor er
 * auch nur eine Datei geholt hat.
 *
 * Die Typen unten stehen als JSDoc da, nicht zur Zierde: `astro check` bezieht
 * `werkzeug/` mit ein, und ohne die literalen `true`/`false` verbreitert
 * TypeScript `mitnehmen` zu `boolean`. Dann ist `Urteil` keine unterscheidbare
 * Union mehr, und jeder Zugriff auf `grund` oder `rubrik` gilt als Fehler —
 * obwohl er zur Laufzeit richtig ist. Das ist zugleich der Vertrag, auf den
 * sich Manifest und Adapter stuetzen.
 *
 * @typedef {'beschreibung' | 'umsetzung'} Rubrik
 * @typedef {{ pfad: string, mitnehmen: true, rubrik: Rubrik, bytes: number }} Mitnehmen
 * @typedef {{ pfad: string, mitnehmen: false, grund: string }} Auslassen
 * @typedef {Mitnehmen | Auslassen} Urteil
 */

/** @type {{ beschreibung: 'beschreibung', umsetzung: 'umsetzung' }} */
export const RUBRIK = {
  beschreibung: 'beschreibung',
  umsetzung: 'umsetzung',
};

/** Obergrenze je Datei. Darueber liegt erfahrungsgemaess Generiertes, kein Gedanke. */
const MAX_BYTES = 200_000;

const BESCHREIBUNG = /\.(md|mdx|rst|adoc)$/i;
const UMSETZUNG = /\.(py|ts|tsx|js|jsx|go|rs|java|rb|sql)$/i;

/** Textdateien, die trotzdem nichts erklaeren. */
const ABHAENGIGKEITEN = /(^|\/)(requirements[^/]*\.txt|package(-lock)?\.json|pnpm-lock\.yaml|poetry\.lock|Pipfile(\.lock)?|go\.sum|Cargo\.lock)$/i;

/**
 * Konfiguration und Geruest: nennt Werkzeuge, erklaert nichts.
 *
 * Derselbe Gedanke wie bei den Abhaengigkeitslisten, eine Ebene weiter. Eine
 * Build-Konfiguration zaehlt Schalter und Werkzeuge auf, eine Typdeklaration
 * beschreibt die Form fremden Codes, ein Dockerfile ist eine Bauanleitung fuer
 * Maschinen. Keine von ihnen sagt, *warum* etwas so gebaut ist — und genau
 * darauf ist der ganze Durchgang aus.
 *
 * Die Regel haengt am Namensmuster, nicht an einer Liste von Werkzeugen:
 * `<werkzeug>.config.<endung>` ist die Konvention, der vite, babel, jest,
 * vitest, tailwind, postcss, next, astro, rollup und webpack gleichermassen
 * folgen. Wer stattdessen zehn Namen aufzaehlt, hat beim elften Werkzeug
 * wieder eine Luecke.
 *
 * Punktdateien wie `.eslintrc*` stehen der Vollstaendigkeit halber im Muster,
 * erreicht werden sie hier aber nicht: Die Pruefung auf versteckte Dateien
 * liegt weiter oben und faengt sie mit einem ebenso richtigen Grund ab.
 */
const KONFIGURATION = new RegExp(
  [
    // Typdeklarationen — sagen, welche Form fremder Code hat, nicht warum.
    String.raw`\.d\.(ts|mts|cts)$`,
    // Werkzeugkonfiguration nach dem ueblichen `<werkzeug>.config.<endung>`.
    String.raw`(^|/)[^/]+\.config\.[^/.]+$`,
    // tsconfig.json, tsconfig.node.json, jsconfig.json — dieselbe Sache, anderer Name.
    String.raw`(^|/)[jt]sconfig[^/]*\.json$`,
    // Linter- und Formatiererregeln, mit oder ohne fuehrenden Punkt.
    String.raw`(^|/)\.?(eslintrc|prettierrc|babelrc|editorconfig|npmrc)[^/]*$`,
    // Containerbau und Aufrufhuellen.
    String.raw`(^|/)(Dockerfile|Containerfile)[^/]*$`,
    String.raw`(^|/)docker-compose[^/]*\.ya?ml$`,
    String.raw`(^|/)(Makefile|GNUmakefile|Procfile|Justfile|Taskfile)[^/]*$`,
  ].join('|'),
  'i',
);

const DATEN = /\.(csv|tsv|json|jsonl|parquet|ya?ml|xml|db|sqlite3?)$/i;
const BINAER = /\.(png|jpe?g|gif|svg|webp|ico|pdf|zip|gz|mp4|mov|woff2?|ttf)$/i;

/**
 * @param {string} pfad Pfad relativ zur Quellwurzel
 * @param {number} bytes Groesse in Bytes
 * @returns {Urteil}
 */
export function beurteile(pfad, bytes) {
  const name = pfad.split('/').pop() ?? pfad;

  if (pfad.split('/').some((teil) => teil.startsWith('.'))) {
    return nein(pfad, 'versteckte Datei oder versteckter Ordner');
  }
  if (BINAER.test(name)) {
    return nein(pfad, 'Bild oder sonst binaer — traegt keinen Text');
  }
  if (ABHAENGIGKEITEN.test(pfad)) {
    return nein(pfad, 'Abhaengigkeitsliste — nennt Pakete, erklaert nichts');
  }
  // Vor BESCHREIBUNG und UMSETZUNG, nicht danach: `vite.config.ts` und
  // `vite-env.d.ts` sind gueltige TypeScript-Endungen. TypeScript soll als
  // Umsetzung gelten — nur nicht in dieser Rolle.
  if (KONFIGURATION.test(pfad)) {
    return nein(pfad, 'Konfiguration oder Geruest — nennt Werkzeuge, erklaert nichts');
  }
  if (BESCHREIBUNG.test(name)) {
    return bytes > MAX_BYTES
      ? nein(pfad, `zu gross: ${bytes} Bytes ueber der Grenze von ${MAX_BYTES}`)
      : ja(pfad, RUBRIK.beschreibung, bytes);
  }
  if (UMSETZUNG.test(name)) {
    return bytes > MAX_BYTES
      ? nein(pfad, `zu gross: ${bytes} Bytes ueber der Grenze von ${MAX_BYTES}`)
      : ja(pfad, RUBRIK.umsetzung, bytes);
  }
  if (DATEN.test(name)) {
    return nein(pfad, 'Daten — Inhalt statt Erklaerung');
  }
  return nein(pfad, 'unbekannte Endung');
}

/**
 * @param {string} pfad
 * @param {Rubrik} rubrik
 * @param {number} bytes
 * @returns {Mitnehmen}
 */
function ja(pfad, rubrik, bytes) {
  return { pfad, mitnehmen: true, rubrik, bytes };
}

/**
 * @param {string} pfad
 * @param {string} grund
 * @returns {Auslassen}
 */
function nein(pfad, grund) {
  return { pfad, mitnehmen: false, grund };
}
