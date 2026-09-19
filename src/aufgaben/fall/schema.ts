import { z } from 'astro/zod';

/**
 * Der Fall: Sachverhalt lesen, Loesung frei schreiben, gegen Pruefpunkte
 * selbst abhaken.
 *
 * `pflicht` trennt, ohne was die Loesung FALSCH ist, von dem, was schoen
 * waere. Nur die wesentlichen Punkte entscheiden ueber `richtig`; alle
 * zusammen ergeben den Anteil.
 *
 * `sachverhalt` und `musterloesung` sind Absaetze, durch Leerzeile getrennt —
 * kein Markdown. Ein Renderer in der Insel waere eine neue Abhaengigkeit fuer
 * zwei Felder.
 */

export const PruefpunktSchema = z.strictObject({
  text: z.string().trim().min(1),
  pflicht: z.boolean(),
});

export const FallSchema = z.strictObject({
  typ: z.literal('fall'),
  id: z.string().trim().min(1),
  sachverhalt: z
    .string()
    .trim()
    .min(40, 'Ein Sachverhalt braucht Substanz — mindestens vierzig Zeichen.'),
  aufgabe: z.string().trim().min(1),
  pruefpunkte: z
    .array(PruefpunktSchema)
    .min(2)
    .max(8)
    .refine(
      (p) => p.some((x) => x.pflicht),
      'Mindestens ein Prüfpunkt muss wesentlich sein (pflicht: true) — sonst ist jede Lösung richtig.',
    )
    .refine(
      (p) => new Set(p.map((x) => x.text.trim().toLowerCase())).size === p.length,
      'Prüfpunkte müssen sich unterscheiden.',
    ),
  musterloesung: z.string().trim().min(1).optional(),
});

export type Pruefpunkt = z.infer<typeof PruefpunktSchema>;
export type Fall = z.infer<typeof FallSchema>;
