import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Der Weg zur Bibliothek und was die Seite nicht tut — als Text geprueft wie
 * `tests/lektion-ansicht.test.ts`: Eine Seite aus `src/pages/` laesst sich
 * nur mit dem ganzen Content-Layer rendern. Was sie zeigt, pruefen
 * `tests/bestand-ansicht.test.ts` und die Abnahme am gebauten Stand.
 *
 * Gelesen wird in jedem Test neu und nicht einmal oben: Fehlt eine Datei,
 * schlaegt der Test fehl, der sie braucht — nicht die ganze Datei beim Laden.
 */
const wurzel = path.resolve(__dirname, '..');
const lies = (...teile: string[]) => readFileSync(path.join(wurzel, ...teile), 'utf8');

describe('der Weg zur Bibliothek', () => {
  it('fuehrt vom Fuss der Uebersicht dorthin, neben dem Lernprofil', () => {
    expect(lies('src', 'pages', 'index.astro')).toContain(
      '>Dein Lernprofil</a> · <a href={`${basis}bibliothek/`}>Bibliothek</a></p>',
    );
  });

  it('laesst die Kopfleiste bei Marke und Modusumschalter', () => {
    // Die Leiste klebt auf jeder Seite; ein Eintrag dort machte sie auf
    // jeder Lektionsseite hoeher (bei 375 px gemessen: 115 statt 109 px).
    // Entschieden in Plan 3a, Praezisierung 8, hier uebernommen.
    expect(lies('src', 'layouts', 'Seite.astro').toLowerCase()).not.toContain('bibliothek');
  });
});

describe('die Seite /bibliothek', () => {
  it('liest Lehrplaene und Manifeste zur Bauzeit, ab der Projektwurzel', () => {
    const seite = lies('src', 'pages', 'bibliothek.astro');
    expect(seite).toContain("import.meta.glob<string>('/lehrplan/*.yaml'");
    expect(seite).toContain("import.meta.glob<string>('/quellen/*/manifest.json'");
  });

  it('rechnet wartende Lehrplaene mit, statt sie fallen zu lassen', () => {
    // Ein Lehrplan, dem nur die Freigabe fehlt, ist weder gueltig noch
    // ungueltig. Wer ihn hier vergisst, laesst die Karte samt Zahlen
    // verschwinden — genau der Fall, den das Einlesen als Erstes erzeugt.
    const seite = lies('src', 'pages', 'bibliothek.astro');
    expect(seite).toContain('const { gueltig, wartend, ungueltig } = lehrplaeneAusTexten(lehrplantexte, lektionsIds);');
    expect(seite).toContain('abdeckung([...gueltig, ...wartend], manifesteAusTexten(manifesttexte), lektionsIds)');
  });

  it('kommt ohne Insel und ohne Skript aus', () => {
    // Aufklappen macht `details`. Was im Browser laeuft, kann dort ausfallen —
    // hier gibt es nichts, was ausfallen koennte.
    const seite = lies('src', 'pages', 'bibliothek.astro');
    expect(seite).not.toMatch(/client:/);
    expect(seite).not.toContain('<script');
  });
});
