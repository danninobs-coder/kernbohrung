import { z } from 'astro/zod';

/**
 * Reihenfolge: Schritte in die richtige Folge bringen.
 *
 * `schritte` steht in der RICHTIGEN Reihenfolge; gemischt wird erst in der
 * Darstellung (`startfolge.ts`). Mindestens drei: Zwei Schritte sind eine
 * Muenze, keine Aufgabe.
 */
export const ReihenfolgeSchema = z.strictObject({
  typ: z.literal('reihenfolge'),
  id: z.string().trim().min(1),
  aufgabe: z.string().trim().min(1),
  schritte: z
    .array(z.string().trim().min(1))
    .min(3)
    .max(7)
    .refine(
      (s) => new Set(s.map((x) => x.trim().toLowerCase())).size === s.length,
      'Schritte müssen sich unterscheiden.',
    ),
});

export type Reihenfolge = z.infer<typeof ReihenfolgeSchema>;
