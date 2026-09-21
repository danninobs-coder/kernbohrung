// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import mdx from '@astrojs/mdx';

/**
 * Der Basispfad, unter dem die Seite ausgeliefert wird.
 *
 * Lokal ist das `/` — `npm run dev` laeuft auf `localhost:4321/` wie gehabt.
 * GitHub Pages liefert ein Projekt dagegen unter
 * `https://<konto>.github.io/<repo>/` aus; der Deploy-Workflow setzt dafuer
 * `ASTRO_BASE=/<repo>`. Alle internen Links muessen deshalb ueber
 * `import.meta.env.BASE_URL` gebildet werden, nie als nacktes `/…` —
 * `tests/basis-pfad.test.ts` passt darauf auf.
 */
const basis = process.env.ASTRO_BASE ?? '/';
const site = process.env.ASTRO_SITE;

// https://astro.build/config
export default defineConfig({
  ...(site ? { site } : {}),
  base: basis,
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
  // `--host` gehoert nicht hierher, sondern in `npm run dev:handy`: wer den
  // Entwicklungsserver ins WLAN oeffnet, soll das bewusst tun.
});
