/**
 * Das Manifest ist der Herkunftsnachweis eines Rohmaterialstands.
 *
 * Es beantwortet drei Fragen, und die hinteren beiden werden gern vergessen:
 * Woher kommt das hier — was ist NICHT mitgekommen — und steht in einer
 * einzelnen Rohdatei noch das, was aus der Quelle kam. Ohne die
 * Auslassungsliste haelt der naechste Leser den Bestand fuer vollstaendig und
 * schliesst aus einem fehlenden Treffer auf ein fehlendes Thema. Ohne die
 * Inhalts-Hashes belegt der Commit-SHA nur den Stand des Klons: Wer danach
 * eine `roh/*.md` aendert, faellt nirgends auf — und der Zweck der Datei ist
 * gerade, dass jede spaetere Behauptung auf eine Quelldatei zeigen kann.
 */

import { createHash } from 'node:crypto';

/**
 * 2, nicht mehr 1: Mit dem Inhalts-Hash je uebernommener Datei ist ein
 * Pflichtfeld dazugekommen. Wer einen alten Bestand in die Hand bekommt, muss
 * ihn von einem neuen unterscheiden koennen — sonst traegt die Nummer nichts.
 */
export const MANIFEST_FASSUNG = 2;

/**
 * @typedef {import('./auswahl.mjs').Urteil} Urteil
 * @typedef {import('./auswahl.mjs').Rubrik} Rubrik
 * @typedef {{ art: string, url: string, unterpfad: string, sha: string }} Herkunft
 * @typedef {{ pfad: string, rubrik: Rubrik, bytes: number, hash: string }} Uebernommen
 */

/**
 * Bildet den Inhalts-Hash, wie ihn das Manifest fuehrt.
 *
 * SHA-256 ueber den Inhalt, ausdruecklich nicht der Git-Blob-Hash. Den gaebe
 * es ueber `git ls-files -s` umsonst, nur ist er git-spezifisch: Er hasht
 * `blob <laenge>\0` vor den Inhalt und ist ausserhalb eines Repos nicht zu
 * bilden. Der PDF-Adapter aus Abschnitt 5 hat kein Git. Ein Herkunftsnachweis,
 * dessen Form von der Quellart abhaengt, taugt nicht als gemeinsames Format —
 * dann liessen sich zwei Bestaende nicht mehr gegeneinander halten.
 *
 * Das Verfahren steht im Wert selbst (`sha256:…`) und nicht nur in dieser
 * Datei: Wer das Manifest in fuenf Jahren liest, soll nicht raten muessen,
 * womit gerechnet wurde.
 *
 * Die Funktion steht hier und nicht im Ingest, weil das Manifest das Format
 * festlegt und gleich darunter darauf besteht. Jeder kuenftige Adapter rechnet
 * so dasselbe aus, statt sich eine eigene Schreibweise auszudenken.
 *
 * @param {string} inhalt Dateiinhalt als Text
 * @returns {string}
 */
export function inhaltsHash(inhalt) {
  return `sha256:${createHash('sha256').update(inhalt, 'utf8').digest('hex')}`;
}

/**
 * Die Hashes kommen als eigener Parameter herein und nicht als Feld im
 * `Urteil`. Das ist Absicht: `beurteile` urteilt allein aus Pfad und Groesse
 * und oeffnet keine Datei — ein Hash im Urteil wuerde diese Zusage aufweichen
 * und ein Feld erzwingen, das die reine Funktion gar nicht fuellen kann. So
 * bleibt die Grenze scharf: Die Auswahl sagt *ob*, der Ingest sagt *was genau*
 * dort stand. Eine `Map` und kein Objektliteral, weil Pfade beliebige
 * Zeichenketten sind und `__proto__` als Schluessel sonst eine Falle waere.
 *
 * @param {{
 *   herkunft: Herkunft,
 *   urteile: readonly Urteil[],
 *   gestempeltAm: string,
 *   hashes: ReadonlyMap<string, string>,
 * }} eingabe
 */
export function baueManifest({ herkunft, urteile, gestempeltAm, hashes }) {
  if (!gestempeltAm) {
    throw new Error(
      'baueManifest: Zeitstempel fehlt. Er wird uebergeben, nicht erzeugt — ' +
        'sonst ist das Manifest bei jedem Lauf verschieden und nicht vergleichbar.',
    );
  }
  if (!herkunft?.sha) {
    throw new Error(
      'baueManifest: sha fehlt. Ohne ihn laesst sich spaeter nicht sagen, ' +
        'aus welchem Stand eine Behauptung stammt.',
    );
  }
  if (!hashes) {
    throw new Error(
      'baueManifest: hashes fehlt. Ein Manifest ohne Inhalts-Hashes belegt nur ' +
        'den Stand des Klons und nicht die einzelne Datei daneben — das ist kein ' +
        'Herkunftsnachweis, und still durchgehen soll das nicht.',
    );
  }

  /** @type {Uebernommen[]} */
  const uebernommen = [];
  for (const u of urteile) {
    if (!u.mitnehmen) continue;
    const hash = hashes.get(u.pfad);
    if (!hash) {
      throw new Error(
        `baueManifest: Hash fehlt fuer "${u.pfad}". Ohne ihn laesst sich nicht ` +
          'sagen, ob diese Datei seit dem Einlesen veraendert wurde; der Commit-SHA ' +
          'deckt den Stand der Quelle ab, nicht die Rohdatei danach.',
      );
    }
    uebernommen.push({ pfad: u.pfad, rubrik: u.rubrik, bytes: u.bytes, hash });
  }

  // Ausgelassene Dateien tragen keinen Hash: Es gibt nichts, was spaeter
  // abweichen koennte — der Pfad ist gar nicht erst uebernommen worden.
  const ausgelassen = urteile
    .filter((u) => !u.mitnehmen)
    .map(({ pfad, grund }) => ({ pfad, grund }));

  return {
    fassung: MANIFEST_FASSUNG,
    gestempeltAm,
    herkunft,
    summe: {
      uebernommen: uebernommen.length,
      ausgelassen: ausgelassen.length,
      bytes: uebernommen.reduce((n, d) => n + d.bytes, 0),
    },
    uebernommen,
    ausgelassen,
  };
}
