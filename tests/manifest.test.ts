import { describe, it, expect } from 'vitest';
import { baueManifest, MANIFEST_FASSUNG } from '../werkzeug/manifest.mjs';

const urteile = [
  { pfad: 'a/README.md', mitnehmen: true, rubrik: 'beschreibung', bytes: 100 },
  { pfad: 'a/main.py', mitnehmen: true, rubrik: 'umsetzung', bytes: 200 },
  { pfad: 'a/bild.png', mitnehmen: false, grund: 'Bild oder sonst binaer — traegt keinen Text' },
];

const herkunft = {
  art: 'git',
  url: 'https://github.com/Beispiel/repo.git',
  unterpfad: 'rag_tutorials',
  sha: 'a13701eae315a81e1011a4304a6b5e741ea0a984',
};

describe('baueManifest', () => {
  it('haelt die Herkunft samt Commit-SHA fest', () => {
    const m = baueManifest({ herkunft, urteile, gestempeltAm: '2026-09-01T12:00:00Z' });
    expect(m.herkunft.sha).toBe(herkunft.sha);
    expect(m.herkunft.url).toBe(herkunft.url);
    expect(m.fassung).toBe(MANIFEST_FASSUNG);
    expect(m.gestempeltAm).toBe('2026-09-01T12:00:00Z');
  });

  it('listet die uebernommenen Dateien mit Rubrik und Groesse', () => {
    const m = baueManifest({ herkunft, urteile, gestempeltAm: '2026-09-01T12:00:00Z' });
    expect(m.uebernommen).toHaveLength(2);
    expect(m.uebernommen[0]).toMatchObject({ pfad: 'a/README.md', rubrik: 'beschreibung' });
  });

  it('listet die Auslassungen MIT Grund — sonst haelt man das Rohmaterial fuer vollstaendig', () => {
    const m = baueManifest({ herkunft, urteile, gestempeltAm: '2026-09-01T12:00:00Z' });
    expect(m.ausgelassen).toHaveLength(1);
    expect(m.ausgelassen[0].grund).toMatch(/binaer/i);
  });

  it('zaehlt zusammen, damit ein Blick genuegt', () => {
    const m = baueManifest({ herkunft, urteile, gestempeltAm: '2026-09-01T12:00:00Z' });
    expect(m.summe).toEqual({ uebernommen: 2, ausgelassen: 1, bytes: 300 });
  });

  it('verlangt einen Zeitstempel, statt selbst einen zu erfinden', () => {
    expect(() => baueManifest({ herkunft, urteile })).toThrow(/Zeitstempel/i);
  });

  it('verlangt einen SHA — ohne ihn ist die Herkunft wertlos', () => {
    const ohne = { ...herkunft, sha: '' };
    expect(() => baueManifest({ herkunft: ohne, urteile, gestempeltAm: '2026-09-01T12:00:00Z' }))
      .toThrow(/sha/i);
  });
});
