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
import { z } from 'astro/zod';

/**
 * 2, nicht mehr 1: Mit dem Inhalts-Hash je uebernommener Datei ist ein
 * Pflichtfeld dazugekommen. Wer einen alten Bestand in die Hand bekommt, muss
 * ihn von einem neuen unterscheiden koennen — sonst traegt die Nummer nichts.
 *
 * Diese Fassung gilt fuer Git-Quellen. Buch und Folien schreiben Fassung 3,
 * weiter unten.
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

/**
 * 3 fuer Buch und Folien. Der Git-Adapter schreibt weiter Fassung 2: Die
 * beiden Herkuenfte haben ausser dem Stand fast nichts gemeinsam, und ein
 * Manifest, das beides mit lauter leeren Feldern abdeckt, sagt weniger, nicht
 * mehr. Die Fassung steht im Wert, damit ein Leser nicht raten muss.
 */
export const MANIFEST_FASSUNG_DOKUMENT = 3;

/**
 * Der Hash einer Datei, wie ihn das Manifest fuehrt — dasselbe Format wie
 * `inhaltsHash`, nur ueber Bytes statt ueber Text.
 *
 * Ein PDF ist keine Textdatei: `inhaltsHash` wuerde es als UTF-8 lesen und an
 * jedem ungueltigen Byte ein Ersatzzeichen einsetzen. Zwei verschiedene PDFs
 * koennten dann denselben Hash bekommen.
 *
 * @param {Uint8Array} bytes
 * @returns {string}
 */
export function dateiHash(bytes) {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

/**
 * Der Stand einer Quelle aus mehreren Originalen.
 *
 * Das Verfahren steht hier fest und nicht nur im Kopf dessen, der es zuerst
 * gerechnet hat: die Datei-Hashes **nach Codepunkten sortiert**, mit `\n`
 * verbunden, ohne `\n` am Ende, das Ganze durch `inhaltsHash`. Sortiert nach
 * Wert und nicht nach Dateinamen — dann ergibt dieselbe Menge Dateien
 * denselben Stand, gleich in welcher Reihenfolge sie hereinkommen und gleich
 * wie sie heissen. (Nach Dateinamen sortiert kaeme ein anderer Wert heraus;
 * gemessen, nicht vermutet.)
 *
 * @param {readonly string[]} dateiHashes
 * @returns {string}
 */
export function standAusHashes(dateiHashes) {
  const sortiert = [...dateiHashes].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return inhaltsHash(sortiert.join('\n'));
}

/**
 * @typedef {{ datei: string, dateiHash: string, seiten: number, gliederung: string, beiwerkZeichen: number }} Original
 * @typedef {{ id: string, datei: string, seiten: [number, number], nurBild: number[], tabellenverdacht: number[] }} Rohdatei
 */

/**
 * Das Manifest einer Quelle aus Buch- oder Folienseiten, Fassung 3.
 *
 * Es beantwortet dieselben drei Fragen wie Fassung 2 — woher, was ist nicht
 * mitgekommen, steht in der Rohdatei noch das, was aus der Quelle kam —, nur
 * heisst „nicht mitgekommen" hier etwas anderes: Bilder und Tabellen, die der
 * Text nicht traegt. Deshalb stehen sie **je Seite** da und nicht als blosse
 * Zahl: Der Compiler sieht sich genau diese Seiten im Original an.
 *
 * Der Zeitstempel wird uebergeben und nicht erzeugt, wie bei Fassung 2 — sonst
 * ist das Manifest bei jedem Lauf verschieden und nicht vergleichbar.
 *
 * @param {{
 *   art: 'buch' | 'folien',
 *   originale: readonly Original[],
 *   roh: readonly Rohdatei[],
 *   gestempeltAm: string,
 * }} eingabe
 */
export function baueDokumentManifest({ art, originale, roh, gestempeltAm }) {
  if (!gestempeltAm) {
    throw new Error(
      'baueDokumentManifest: Zeitstempel fehlt. Er wird uebergeben, nicht erzeugt — ' +
        'sonst ist das Manifest bei jedem Lauf verschieden und nicht vergleichbar.',
    );
  }
  if (!originale?.length) {
    throw new Error('baueDokumentManifest: keine Originale. Ohne sie gibt es keinen Stand und keinen Herkunftsnachweis.');
  }
  for (const o of originale) {
    if (!o.dateiHash) {
      throw new Error(
        `baueDokumentManifest: dateiHash fehlt fuer "${o.datei}". Ohne ihn laesst sich nicht sagen, ` +
          'ob das Original seit dem Einlesen ausgetauscht wurde.',
      );
    }
  }

  return {
    fassung: MANIFEST_FASSUNG_DOKUMENT,
    gestempeltAm,
    herkunft: { art, stand: standAusHashes(originale.map((o) => o.dateiHash)) },
    summe: {
      originale: originale.length,
      seiten: originale.reduce((n, o) => n + o.seiten, 0),
      abschnitte: roh.length,
      nurBild: roh.reduce((n, r) => n + r.nurBild.length, 0),
      tabellenverdacht: roh.reduce((n, r) => n + r.tabellenverdacht.length, 0),
      beiwerkZeichen: originale.reduce((n, o) => n + o.beiwerkZeichen, 0),
    },
    originale: originale.map((o) => ({
      datei: o.datei,
      dateiHash: o.dateiHash,
      seiten: o.seiten,
      gliederung: o.gliederung,
      beiwerkZeichen: o.beiwerkZeichen,
    })),
    roh: roh.map((r) => ({
      id: r.id,
      datei: r.datei,
      seiten: r.seiten,
      nurBild: r.nurBild,
      tabellenverdacht: r.tabellenverdacht,
    })),
  };
}

/** Eine Seite im Manifest: ganzzahlig, ab 1. */
const SEITE = z.number().int().min(1);

/**
 * Fassung 3, soweit die Werkzeuge sie brauchen: Stand und Art, die Originale
 * mit ihrer Seitenzahl, je Rohdatei der Folienbereich und die Listen der
 * Bild- und Tabellenseiten.
 *
 * `z.object` und nicht `strictObject`, wie in `src/lib/manifestauszug.ts`:
 * Hier wird herausgelesen, nicht das Manifest geprueft. Was es sonst noch
 * traegt — Hashes, Gliederung, Summen —, stoert nicht.
 */
const DokumentManifestSchema = z.object({
  fassung: z.literal(3),
  herkunft: z.object({
    art: z.enum(['buch', 'folien']),
    stand: z.string().regex(/^sha256:[0-9a-f]{64}$/),
  }),
  originale: z.array(z.object({ datei: z.string().min(1), seiten: z.number().int().min(0) })).min(1),
  roh: z.array(
    z.object({
      id: z.string().min(1),
      datei: z.string().min(1),
      // Ein Bereich, der rueckwaerts laeuft, ist keiner.
      seiten: z.tuple([SEITE, SEITE]).refine(([von, bis]) => von <= bis),
      nurBild: z.array(SEITE),
      tabellenverdacht: z.array(SEITE),
    }),
  ),
});

/**
 * @typedef {{
 *   stand: string,
 *   art: 'buch' | 'folien',
 *   originale: { datei: string, seiten: number }[],
 *   roh: Rohdatei[],
 * }} DokumentManifest
 * @typedef {{ ok: true, manifest: DokumentManifest } | { ok: false, grund: string }} GelesenesManifest
 */

/**
 * Liest ein Manifest der Fassung 3 fuer die Werkzeuge. Wirft nie.
 *
 * Das Gegenstueck zu `baueDokumentManifest`. Was nicht passt, kommt als Grund
 * zurueck, den das Werkzeug in seinen eigenen Satz setzt. „kein gültiges
 * JSON", „ohne Fassung" und „Fassung 3, aber unvollständig" sagt
 * `leseManifestauszug`, das dasselbe Manifest fuer die Seite liest, genauso.
 *
 * @param {string} text Inhalt einer `manifest.json`
 * @returns {GelesenesManifest}
 */
export function liesDokumentManifest(text) {
  /** @type {unknown} */
  let roh;
  try {
    roh = JSON.parse(text);
  } catch {
    return { ok: false, grund: 'kein gültiges JSON' };
  }

  const fassung = typeof roh === 'object' && roh !== null && 'fassung' in roh ? roh.fassung : undefined;
  if (typeof fassung !== 'number') return { ok: false, grund: 'ohne Fassung' };
  if (fassung !== MANIFEST_FASSUNG_DOKUMENT) return { ok: false, grund: `Fassung ${fassung}, erwartet 3` };

  const befund = DokumentManifestSchema.safeParse(roh);
  if (!befund.success) return { ok: false, grund: 'Fassung 3, aber unvollständig' };
  const { herkunft, originale, roh: rohdateien } = befund.data;
  return {
    ok: true,
    manifest: {
      stand: herkunft.stand,
      art: herkunft.art,
      originale: originale.map(({ datei, seiten }) => ({ datei, seiten })),
      roh: rohdateien.map(({ id, datei, seiten, nurBild, tabellenverdacht }) => ({
        id,
        datei,
        seiten,
        nurBild,
        tabellenverdacht,
      })),
    },
  };
}
