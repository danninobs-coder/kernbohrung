import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const AntwortSchema = z.object({
  text: z.string().min(1),
  richtig: z.boolean(),
  begruendung: z.string().min(20, 'Jede Antwort braucht eine Begründung mit Substanz.'),
});

const FrageSchema = z.object({
  id: z.string().min(1),
  frage: z.string().min(1),
  antworten: z
    .array(AntwortSchema)
    .min(3)
    .max(5)
    .refine(
      (a) => a.filter((x) => x.richtig).length === 1,
      'Genau eine Antwort muss richtig sein.',
    ),
});

const QuelleSchema = z.object({
  pfad: z.string().min(1),
  url: z.url().optional(),
});
// Hinweis: z.string().url() ist in Zod 4 verworfen (ts(6385) beim Bauen).
// Deshalb hier direkt z.url().optional() verwendet.

const lektionen = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './inhalt/lektionen' }),
  schema: z.object({
    titel: z.string().min(1),
    prinzip: z.string().min(1),
    reihenfolge: z.number().int().positive(),
    gesperrt: z.boolean().default(false),
    fragen: z.array(FrageSchema).min(2).max(4),
    transfer: FrageSchema,
    quellen: z.array(QuelleSchema).min(1),
  }),
});

export const collections = { lektionen };
