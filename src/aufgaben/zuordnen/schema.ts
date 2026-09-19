import { z } from 'astro/zod';

/**
 * Zuordnen: jedem linken Eintrag genau einen rechten.
 *
 * Die Reihenfolge von `paare` ist die Loesung; gemischt wird erst in der
 * Darstellung. `ablenker` sind zusaetzliche rechte Eintraege ohne Partner —
 * sie nehmen dem letzten Paar den Ausschluss als Loesungsweg.
 */

const normal = (s: string): string => s.trim().toLowerCase();

/**
 * Ein Eintrag, wie er links, rechts oder als Ablenker steht.
 *
 * `→` und `;` sind verboten, weil `bewerten.ts` die Paare genau damit zu
 * `antwort` und `merkmal` zusammenfuegt (`Links→Rechts;Links→Rechts`). Kaeme
 * eines der Zeichen in einem Eintrag vor, liessen sich zwei verschiedene
 * Zuordnungen nicht mehr unterscheiden. Eine robustere Kodierung (JSON)
 * sprengt den Groessenwaechter des Ereignisses; das Verbot kostet kein Byte
 * und trifft nur kurze Eintraege, keinen Fliesstext.
 */
const EintragSchema = z
  .string()
  .trim()
  .min(1)
  .refine(
    (s) => !s.includes('→') && !s.includes(';'),
    'Ein Eintrag darf weder → noch ; enthalten — beides trennt die Paare im gespeicherten Ereignis.',
  );

const PaarSchema = z.strictObject({
  links: EintragSchema,
  rechts: EintragSchema,
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
    ablenker: z.array(EintragSchema).max(2).default([]),
  })
  .refine((a) => {
    const rechts = new Set(a.paare.map((p) => normal(p.rechts)));
    const eigene = new Set(a.ablenker.map(normal));
    return eigene.size === a.ablenker.length && a.ablenker.every((x) => !rechts.has(normal(x)));
  }, 'Ein Ablenker darf keinem rechten Eintrag gleichen und nicht doppelt vorkommen.');

export type Zuordnen = z.infer<typeof ZuordnenSchema>;
