/**
 * Entscheidet allein aus Pfad und Groesse, ob eine Datei ins Rohmaterial kommt.
 *
 * Bewusst eine reine Funktion ohne Dateisystemzugriff: So laesst sie sich ohne
 * Quelle testen, und der Adapter kann sie auf einen Git-Baum anwenden, bevor er
 * auch nur eine Datei geholt hat.
 */

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
const DATEN = /\.(csv|tsv|json|jsonl|parquet|ya?ml|xml|db|sqlite3?)$/i;
const BINAER = /\.(png|jpe?g|gif|svg|webp|ico|pdf|zip|gz|mp4|mov|woff2?|ttf)$/i;

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

function ja(pfad, rubrik, bytes) {
  return { pfad, mitnehmen: true, rubrik, bytes };
}

function nein(pfad, grund) {
  return { pfad, mitnehmen: false, grund };
}
