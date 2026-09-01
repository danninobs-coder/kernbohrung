import { z } from 'astro/zod';

/**
 * Das Lektions-Schema — bewusst frei von `astro:content`.
 *
 * Der Schnitt ist der Zweck dieser Datei: `src/content.config.ts` importiert
 * `astro:content` und ist damit von aussen nicht ladbar. Ein Import scheitert
 * auch unter Vitest mit „The 'astro:content' module is only available
 * server-side." — die wichtigste Qualitaetsschranke des Projekts liesse sich
 * also nicht im Unit-Test pruefen, und der Lektions-Compiler koennte
 * generierten Inhalt nicht vor dem Schreiben validieren.
 *
 * Hier steht deshalb nur Zod. `defineCollection` bleibt in content.config.ts.
 */

/**
 * Begruendungen sind der Ort, an dem ein Generator am billigsten schummelt:
 * formal lang genug, inhaltlich leer. Die Wortzahl ist eine Heuristik und
 * keine Substanzpruefung — „aaa bbb ccc ddd eee" kommt durch. Sie faengt nur
 * den plumpen Fall der Zeichenfuellung ab, mehr soll sie nicht leisten.
 */
const BegruendungSchema = z
  .string()
  .trim()
  .min(20, 'Jede Antwort braucht eine Begründung mit Substanz.')
  .refine(
    (s) => s.split(/\s+/).filter(Boolean).length >= 5,
    'Begründung braucht mindestens fünf Wörter, keine Zeichenfüllung.',
  );

export const AntwortSchema = z.object({
  text: z.string().trim().min(1),
  richtig: z.boolean(),
  begruendung: BegruendungSchema,
});

export const FrageSchema = z.object({
  id: z.string().trim().min(1),
  frage: z.string().trim().min(1),
  antworten: z
    .array(AntwortSchema)
    .min(3)
    .max(5)
    .refine(
      (a) => a.filter((x) => x.richtig).length === 1,
      'Genau eine Antwort muss richtig sein.',
    )
    // Normalisiert verglichen, nicht exakt: sonst entkommt "Ja " gegen "Ja".
    // Ausserdem haengt der React-key in Frage.tsx an genau diesem Text.
    .refine(
      (a) => new Set(a.map((x) => x.text.trim().toLowerCase())).size === a.length,
      'Antworttexte müssen sich innerhalb einer Frage unterscheiden.',
    )
    .refine(
      (a) => new Set(a.map((x) => x.begruendung.trim().toLowerCase())).size === a.length,
      'Jede Antwort braucht eine eigene Begründung, keine Kopie einer anderen.',
    ),
});

export const QuelleSchema = z.object({
  pfad: z.string().trim().min(1),
  url: z.url().optional(),
});
// Hinweis: z.string().url() ist in Zod 4 verworfen (ts(6385) beim Bauen).
// Deshalb hier direkt z.url().optional() verwendet.

export const LektionSchema = z
  .object({
    titel: z.string().trim().min(1),
    // Zeichenlaenge ist ein Naeherungsmass fuer „ein Satz". Eine Satzzaehlung
    // per Regex ist im Deutschen unzuverlaessig: „z. B.", „u. a." und „Nr. 7"
    // enthalten Punkte, die keine Satzenden sind. Das echte prinzip hat 125
    // Zeichen, die Grenze laesst also reichlich Luft.
    prinzip: z
      .string()
      .trim()
      .min(1)
      .max(200, 'prinzip soll ein Satz sein, kein Absatz (max. 200 Zeichen).'),
    reihenfolge: z.number().int().positive(),
    gesperrt: z.boolean().default(false),
    fragen: z.array(FrageSchema).min(2).max(4),
    transfer: FrageSchema,
    quellen: z.array(QuelleSchema).min(1),
  })
  // `id` ist der einzige Kandidat fuer eine stabile Frage-Identitaet, an der
  // spaeter der Lernfortschritt haengt. Kollidieren zwei, verschmilzt der
  // Fortschritt zweier Fragen lautlos — teuer und schwer zu bemerken.
  // Die Transferfrage zaehlt dabei mit.
  .refine(
    (l) => {
      const ids = [...l.fragen.map((f) => f.id), l.transfer.id];
      return new Set(ids).size === ids.length;
    },
    'fragen[].id und transfer.id müssen innerhalb der Lektion eindeutig sein.',
  );

export type Lektion = z.infer<typeof LektionSchema>;
