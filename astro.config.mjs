// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import mdx from '@astrojs/mdx';

// https://astro.build/config
export default defineConfig({
  integrations: [react(), mdx()],

  build: {
    // Standard waere "_astro". Der fuehrende Unterstrich kostet an mehreren
    // Orten: GitHub Pages laesst Jekyll darueberlaufen und ueberspringt
    // Verzeichnisse mit Unterstrich, solange keine .nojekyll danebenliegt —
    // die Seite kommt dann ohne Stylesheet und ohne Inselskripte an. Andere
    // Ablagen behalten sich Namen mit Unterstrich fuer sich selbst vor.
    // Der Name ist reine Konvention; ohne Unterstrich laeuft er ueberall.
    assets: 'astro',
  },
});