/**
 * Liest das Dokument-Manifest der Fassung 3 zurueck -- das Gegenstueck zu
 * `baueDokumentManifest` aus werkzeug/manifest.mjs.
 *
 * Eigene Datei, und nicht Teil von manifest.mjs: Nur das Lesen prueft die
 * Form mit `astro/zod`, das Schreiben (`baueManifest`, `baueDokumentManifest`,
 * `inhaltsHash`, `dateiHash`, `standAusHashes`) kommt ohne zod aus. Stuende
 * `liesDokumentManifest` weiter in manifest.mjs, luede jeder Import von dort
 * zod mit -- auch werkzeug/ingest-git.mjs, das nur `baueManifest` und
 * `inhaltsHash` braucht und mit dem Lesen eines Dokument-Manifests nichts zu
 * tun hat. Hier bleibt zod bei dem einzigen Werkzeug, das `liesDokumentManifest`
 * tatsaechlich aufruft: werkzeug/ansicht.mjs.
 */

import { z } from 'astro/zod';
import { MANIFEST_FASSUNG_DOKUMENT } from './manifest.mjs';

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
 * @typedef {import('./manifest.mjs').Rohdatei} Rohdatei
 */

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
