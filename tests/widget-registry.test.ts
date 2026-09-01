// @vitest-environment node
//
// Nicht jsdom, und zwar aus einem gemessenen Grund: Unter jsdom loest Vite die
// `browser`-Bedingung auf, und `./Pipeline.astro` kommt als Astros Browser-Stub
// zurueck - eine anonyme Funktion, die beim Aufruf
// „Astro components cannot be used in the browser" wirft. Sie traegt weder
// `isAstroComponentFactory` noch `moduleId`, die Pruefung unten waere also
// blind. In der node-Umgebung liefert derselbe Import die echte
// Komponenten-Fabrik samt beider Merkmale.
import { describe, it, expect } from 'vitest';
import { widgets } from '../src/widgets/index';
import { widgetPruefungen } from '../src/widgets/pruefung';
// Der Quelltext als Text: die zweite, von Astro-Interna unabhaengige Probe.
import quelltext from '../src/widgets/index.ts?raw';

/**
 * Der Befund, den diese Datei festhaelt:
 *
 * `src/widgets/index.ts` bildet Widget-Namen auf **Astro-Huellen** ab. Zeigt ein
 * Eintrag versehentlich auf die React-Datei — `./Pipeline.tsx` statt
 * `./Pipeline.astro`, der plausibelste Fluechtigkeitsfehler beim Anlegen von
 * Widget zwei —, baut das Projekt weiterhin mit Exitcode 0 und ohne Warnung.
 * Gemessen: `widget-pipeline` steht danach genauso einmal im HTML,
 * `schritt-knopf` genauso zweimal. Nur das Hydrations-Skript fehlt. Die Seite
 * sieht im Quelltext vollstaendig richtig aus, die Schalter tun bloss nichts
 * mehr. Kein Test, kein `astro check` und kein Build merkt das — nur ein Mensch,
 * der klickt.
 */

/** Nur die beiden Merkmale, an denen eine Astro-Fabrik erkennbar ist. */
function alsFabrik(wert: unknown): { isAstroComponentFactory?: unknown; moduleId?: unknown } {
  return wert as { isAstroComponentFactory?: unknown; moduleId?: unknown };
}

describe('Widget-Registry', () => {
  it('ist nicht leer', () => {
    expect(Object.keys(widgets).length).toBeGreaterThan(0);
  });

  it('bildet jeden Namen auf eine Astro-Huelle ab, nicht auf eine React-Komponente', () => {
    for (const [name, wert] of Object.entries(widgets)) {
      const fabrik = alsFabrik(wert);

      expect(typeof wert, `${name} ist keine Komponente`).toBe('function');
      expect(
        fabrik.isAstroComponentFactory,
        `${name} zeigt nicht auf eine .astro-Huelle. Ohne Huelle fehlt die ` +
          `client:visible-Direktive, das Widget wird server-gerendert und nie ` +
          `hydriert - die Seite sieht richtig aus und reagiert auf nichts.`,
      ).toBe(true);
      expect(
        String(fabrik.moduleId),
        `${name} wird aus einer Datei geladen, die nicht auf .astro endet`,
      ).toMatch(/\.astro$/);
    }
  });

  it('importiert in index.ts ausschliesslich .astro-Dateien', () => {
    // Dieselbe Aussage noch einmal, aber ohne Astro-Interna: Faende Astro eines
    // Tages einen anderen Namen fuer `isAstroComponentFactory`, bliebe diese
    // Probe stehen. Sie liest, was dort geschrieben steht.
    const importe = [...quelltext.matchAll(/^\s*import\s[^'"]*from\s+'([^']+)'/gm)].map(
      (treffer) => treffer[1],
    );

    expect(importe.length).toBeGreaterThan(0);
    for (const spezifizierer of importe) {
      expect(
        spezifizierer,
        `index.ts importiert "${spezifizierer}" - erlaubt sind nur .astro-Huellen`,
      ).toMatch(/\.astro$/);
    }
  });
});

describe('Registry und Pruefstelle', () => {
  // Ein Widget ohne Pruefung oder eine Pruefung ohne Widget ist eine
  // Driftquelle, sobald es mehr als eines gibt: Im ersten Fall baut ein
  // halluzinierter Parameter wieder durch, im zweiten zeigt eine Pruefung ins
  // Leere. Beide Richtungen werden geprueft.
  it('tragen dieselben Namen', () => {
    expect(Object.keys(widgets).sort()).toEqual(Object.keys(widgetPruefungen).sort());
  });

  it('lassen kein Widget ohne Pruefung', () => {
    for (const name of Object.keys(widgets)) {
      expect(Object.hasOwn(widgetPruefungen, name), `${name} hat keine Pruefung`).toBe(true);
    }
  });

  it('lassen keine Pruefung ohne Widget', () => {
    for (const name of Object.keys(widgetPruefungen)) {
      expect(Object.hasOwn(widgets, name), `Pruefung ${name} hat kein Widget`).toBe(true);
    }
  });
});
