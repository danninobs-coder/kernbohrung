import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { LektionSchema } from './content/schema';

const lektionen = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './inhalt/lektionen' }),
  schema: LektionSchema,
});

export const collections = { lektionen };
