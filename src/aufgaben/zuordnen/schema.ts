import { z } from 'astro/zod';

/**
 * Zuordnen: jedem linken Eintrag genau einen rechten.
 *
 * Die Reihenfolge von `paare` ist die Loesung; gemischt wird erst in der
 * Darstellung. `ablenker` sind zusaetzliche rechte Eintraege ohne Partner —
 * sie nehmen dem letzten Paar den Ausschluss als Loesungsweg.
 */

const normal = (s: string): string => s.trim().toLowerCase();

const PaarSchema = z.strictObject({
  links: z.string().trim().min(1),
  rechts: z.string().trim().min(1),
});

export const ZuordnenSchema = z
  .strictObject({
    typ: z.literal('zuordnen'),
    id: z.string().trim().min(1),
    aufgabe: z.string().trim().min(1),
    paare: z
      .array(PaarSchema)
      .min(3)
      .max(6)
      .refine(
        (p) => new Set(p.map((x) => normal(x.links))).size === p.length,
        'Linke Einträge müssen sich unterscheiden.',
      )
      .refine(
        (p) => new Set(p.map((x) => normal(x.rechts))).size === p.length,
        'Rechte Einträge müssen sich unterscheiden — sonst gibt es zwei richtige Zuordnungen.',
      ),
    ablenker: z.array(z.string().trim().min(1)).max(2).default([]),
  })
  .refine((a) => {
    const rechts = new Set(a.paare.map((p) => normal(p.rechts)));
    const eigene = new Set(a.ablenker.map(normal));
    return eigene.size === a.ablenker.length && a.ablenker.every((x) => !rechts.has(normal(x)));
  }, 'Ein Ablenker darf keinem rechten Eintrag gleichen und nicht doppelt vorkommen.');

export type Zuordnen = z.infer<typeof ZuordnenSchema>;
