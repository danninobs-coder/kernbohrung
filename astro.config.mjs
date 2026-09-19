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
  // `--host` gehoert nicht hierher, sondern in `npm run dev:handy`: wer den
  // Entwicklungsserver ins WLAN oeffnet, soll das bewusst tun.
});
