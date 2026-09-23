import { z } from 'astro/zod';

/**
 * Was die Seite /bibliothek aus einem Manifest braucht — und nur das.
 *
 * Das Manifest (`quellen/<kurzname>/manifest.json`) ist der
 * Herkunftsnachweis eines Rohmaterialstands. Die Seite liest daraus zwei
 * Dinge: zu welchem Stand es gehoert, und was die Quelle nicht hergibt. Sie
 * liest es zur Bauzeit; im Browser kommt davon nur an, was die Seite daraus
 * macht.
 *
 * `quellen/` ist gitignored. Wo gebaut wird, ohne dass eingelesen wurde — auf
 * GitHub zum Beispiel —, gibt es kein Manifest. Das ist kein Fehler, sondern
 * ein Zustand, den die Seite benennt (siehe `abdeckung.ts`).
 *
 * Gelesen werden zwei Fassungen: 2 vom Git-Adapter, 3 vom Einlesen von Buch
 * und Folien. Jede andere ist `unlesbar` — lieber keine Zahl als eine aus
 * einem Format, das diese Seite nicht kennt.
 */
export type Manifestauszug =
  | {
      readonly art: 'git';
      /** Der Commit-SHA, aus dem eingelesen wurde. */
      readonly stand: string;
      readonly uebernommen: number;
      readonly ausgelassen: number;
    }
  | {
      readonly art: 'dokument';
      /** Der Hash ueber die Originale, `sha256:…`. */
      readonly stand: string;
      /** Seiten aller Originale zusammen. */
      readonly seiten: number;
      /** Seiten, auf denen nach dem Briefkopf kein Text steht, aber ein Bild. */
      readonly nurBild: number;
      /** Seiten, deren Text nach einer zerfallenen Tabelle aussieht. */
      readonly tabellenverdacht: number;
    }
  | { readonly art: 'unlesbar'; readonly grund: string };

/**
 * Fassung 2, soweit die Seite sie braucht. `z.object` und nicht
 * `strictObject`: Das Manifest traegt viel mehr, und das ist richtig so —
 * hier wird nicht das Manifest geprueft, sondern herausgelesen.
 */
const Fassung2Schema = z.object({
  fassung: z.literal(2),
  herkunft: z.object({ art: z.literal('git'), sha: z.string().trim().min(7) }),
  summe: z.object({
    uebernommen: z.number().int().min(0),
    ausgelassen: z.number().int().min(0),
  }),
});

/**
 * Fassung 3, soweit die Seite sie braucht: der Stand und die drei Zahlen der
 * Lueckenzeile. Was der Compiler braucht — die Seiten je Bildfolie und je
 * Tabellenfolie, die Originale mit ihren Hashes — steht im Manifest und wird
 * hier nicht gelesen: Die Seite zeigt Zahlen, keine Seitenlisten.
 */
const Fassung3Schema = z.object({
  fassung: z.literal(3),
  herkunft: z.object({
    art: z.enum(['buch', 'folien']),
    stand: z.string().trim().regex(/^sha256:[0-9a-f]{64}$/),
  }),
  summe: z.object({
    seiten: z.number().int().min(0),
    nurBild: z.number().int().min(0),
    tabellenverdacht: z.number().int().min(0),
  }),
});

/** Liest den Auszug aus dem Text einer `manifest.json`. Wirft nie. */
export function leseManifestauszug(text: string): Manifestauszug {
  let roh: unknown;
  try {
    roh = JSON.parse(text);
  } catch {
    return { art: 'unlesbar', grund: 'kein gültiges JSON' };
  }

  const fassung = typeof roh === 'object' && roh !== null && 'fassung' in roh ? roh.fassung : undefined;
  if (typeof fassung !== 'number') return { art: 'unlesbar', grund: 'ohne Fassung' };
  if (fassung === 2) {
    const befund = Fassung2Schema.safeParse(roh);
    if (!befund.success) return { art: 'unlesbar', grund: 'Fassung 2, aber unvollständig' };
    return {
      art: 'git',
      stand: befund.data.herkunft.sha,
      uebernommen: befund.data.summe.uebernommen,
      ausgelassen: befund.data.summe.ausgelassen,
    };
  }

  if (fassung === 3) {
    const befund = Fassung3Schema.safeParse(roh);
    if (!befund.success) return { art: 'unlesbar', grund: 'Fassung 3, aber unvollständig' };
    return {
      art: 'dokument',
      stand: befund.data.herkunft.stand,
      seiten: befund.data.summe.seiten,
      nurBild: befund.data.summe.nurBild,
      tabellenverdacht: befund.data.summe.tabellenverdacht,
    };
  }

  return { art: 'unlesbar', grund: `Fassung ${fassung} kennt diese Seite nicht` };
}

/**
 * Liest alle Manifeste, wie sie `import.meta.glob` liefert: Pfad -> Text.
 * Der Schluessel der Karte ist der Kurzname — der Ordner unter `quellen/`,
 * der im Lehrplan als `quelle` steht.
 */
export function manifesteAusTexten(texte: Readonly<Record<string, string>>): Map<string, Manifestauszug> {
  const manifeste = new Map<string, Manifestauszug>();
  for (const [pfad, text] of Object.entries(texte)) {
    const teile = pfad.split('/');
    const kurzname = teile[teile.length - 2];
    if (kurzname) manifeste.set(kurzname, leseManifestauszug(text));
  }
  return manifeste;
}
