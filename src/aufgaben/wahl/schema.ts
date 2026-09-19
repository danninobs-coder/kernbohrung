import { z } from 'astro/zod';

/**
 * Die Wahlaufgabe: drei bis fuenf Antworten, genau eine richtig.
 *
 * Die Regeln stammen unveraendert aus `src/content/schema.ts`, wo sie bis zur
 * Aufgabenfamilie als `FrageSchema` standen. Neu sind zwei Dinge: das Feld
 * `typ` und `strictObject` statt `object`. Ein fremdes Feld ist hier kein
 * harmloser Beifang, sondern das wahrscheinlichste Symptom eines Generators,
 * der zwei Typen vermischt — lautlos verwerfen hiesse, den Fehler verstecken.
 */

/**
 * Begruendungen sind der Ort, an dem ein Generator am billigsten schummelt:
 * formal lang genug, inhaltlich leer. Die Wortzahl ist eine Heuristik und
 * keine Substanzpruefung — sie faengt nur den plumpen Fall der Zeichenfuellung.
 */
const BegruendungSchema = z
  .string()
  .trim()
  .min(20, 'Jede Antwort braucht eine Begründung mit Substanz.')
  .refine(
    (s) => s.split(/\s+/).filter(Boolean).length >= 5,
    'Begründung braucht mindestens fünf Wörter, keine Zeichenfüllung.',
  );

export const AntwortSchema = z.strictObject({
  text: z.string().trim().min(1),
  richtig: z.boolean(),
  begruendung: BegruendungSchema,
});

export const WahlSchema = z.strictObject({
  typ: z.literal('wahl'),
  id: z.string().trim().min(1),
  frage: z.string().trim().min(1),
  antworten: z
    .array(AntwortSchema)
    .min(3)
    .max(5)
    .refine((a) => a.filter((x) => x.richtig).length === 1, 'Genau eine Antwort muss richtig sein.')
    // Normalisiert verglichen, nicht exakt: sonst entkommt "Ja " gegen "Ja".
    // Ausserdem haengt der React-key in Wahl.tsx an genau diesem Text.
    .refine(
      (a) => new Set(a.map((x) => x.text.trim().toLowerCase())).size === a.length,
      'Antworttexte müssen sich innerhalb einer Frage unterscheiden.',
    )
    .refine(
      (a) => new Set(a.map((x) => x.begruendung.trim().toLowerCase())).size === a.length,
      'Jede Antwort braucht eine eigene Begründung, keine Kopie einer anderen.',
    ),
});

export type Antwort = z.infer<typeof AntwortSchema>;
export type Wahl = z.infer<typeof WahlSchema>;
