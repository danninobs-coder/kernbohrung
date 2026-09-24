/// <reference types="vitest/config" />
import { getViteConfig } from 'astro/config';

export default getViteConfig({
  test: {
    environment: 'jsdom',
    // Nicht aus Bequemlichkeit gesetzt: @testing-library/react registriert sein
    // afterEach(cleanup) nur, wenn afterEach global existiert. Ohne globals: true
    // bleibt das Aufraeumen zwischen Tests lautlos aus, und Komponententests
    // finden Elemente aus vorherigen Tests wieder.
    globals: true,
    include: ['tests/**/*.test.{ts,tsx}'],
    // Im vollen Lauf starten zwei Dutzend Dateien je ihr eigenes jsdom. Unter
    // Windows hat das wechselnde Komponententests ueber die voreingestellten
    // fuenf Sekunden geschoben, die allein in unter einer Sekunde laufen. Die
    // Frist faengt haengende Tests weiterhin; sie misst nur keine Last mehr.
    testTimeout: 20_000,
    // Dieselbe Frist fuer beforeAll und Co.: Unter Last riss sonst ein beforeAll
    // (etwa das Laden von pdf.js) zuerst, an den voreingestellten zehn Sekunden.
    hookTimeout: 20_000,
  },
});
