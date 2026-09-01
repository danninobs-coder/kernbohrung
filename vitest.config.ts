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
  },
});
