import { describe, it, expect } from 'vitest';
import { leseManifestauszug, manifesteAusTexten } from '../src/lib/manifestauszug';

/**
 * Ein Manifest der Fassung 2, wie es `werkzeug/manifest.mjs` schreibt — mit
 * leeren Listen, weil der Leser nur Stand und Summen braucht. `bytes` und
 * `gestempeltAm` stehen mit Absicht da: Der Leser muss uebergehen, was er
 * nicht braucht, statt daran zu scheitern.
 */
const fassung2 = {
  fassung: 2,
  gestempeltAm: '2026-09-01T17:58:28.830Z',
  herkunft: {
    art: 'git',
    url: 'https://github.com/Beispiel/repo.git',
    unterpfad: 'rag_tutorials',
    sha: 'a13701eae315a81e1011a4304a6b5e741ea0a984',
  },
  summe: { uebernommen: 62, ausgelassen: 44, bytes: 453294 },
  uebernommen: [],
  ausgelassen: [],
};

/** Legt die Aenderung stumpf ueber das gueltige Manifest und gibt den Text zurueck. */
function text(aenderung: Record<string, unknown> = {}): string {
  return JSON.stringify({ ...fassung2, ...aenderung });
}

describe('leseManifestauszug', () => {
  it('liest Stand und Summen aus Fassung 2', () => {
    expect(leseManifestauszug(text())).toEqual({
      art: 'git',
      stand: 'a13701eae315a81e1011a4304a6b5e741ea0a984',
      uebernommen: 62,
      ausgelassen: 44,
    });
  });

  it('nennt eine Fassung, die diese Seite nicht kennt, beim Namen', () => {
    expect(leseManifestauszug(text({ fassung: 3 }))).toEqual({
      art: 'unlesbar',
      grund: 'Fassung 3 kennt diese Seite nicht',
    });
  });

  it('nimmt Fassung 2 ohne Summen nicht fuer bare Muenze', () => {
    const { summe: _summe, ...ohne } = fassung2;
    expect(leseManifestauszug(JSON.stringify(ohne))).toEqual({
      art: 'unlesbar',
      grund: 'Fassung 2, aber unvollständig',
    });
  });

  it('weist eine Herkunft zurueck, die kein Git ist — Fassung 2 schreibt nur der Git-Adapter', () => {
    expect(leseManifestauszug(text({ herkunft: { ...fassung2.herkunft, art: 'pdf' } }))).toEqual({
      art: 'unlesbar',
      grund: 'Fassung 2, aber unvollständig',
    });
  });

  // Als Tripel aus Name, Text und Grund: `it.each` breitet eine blanke Liste
  // als Argumente aus.
  it.each([
    ['kaputtem JSON', '{"fassung": 2,', 'kein gültiges JSON'],
    ['einem leeren Text', '', 'kein gültiges JSON'],
    ['null', 'null', 'ohne Fassung'],
    ['einer Zahl', '42', 'ohne Fassung'],
    ['einem Text', '"manifest"', 'ohne Fassung'],
    ['einer Liste', '[]', 'ohne Fassung'],
    ['einem leeren Objekt', '{}', 'ohne Fassung'],
    ['einer Fassung als Text', '{"fassung": "2"}', 'ohne Fassung'],
  ])('macht aus %s „unlesbar", ohne zu werfen', (_name, roh, grund) => {
    expect(leseManifestauszug(roh)).toEqual({ art: 'unlesbar', grund });
  });
});

describe('manifesteAusTexten', () => {
  it('schluesselt nach dem Ordner unter quellen/', () => {
    const karte = manifesteAusTexten({
      '/quellen/awesome-llm-apps/manifest.json': text(),
      '/quellen/kaputt/manifest.json': '{',
    });
    expect([...karte.keys()].sort()).toEqual(['awesome-llm-apps', 'kaputt']);
    expect(karte.get('awesome-llm-apps')?.art).toBe('git');
    expect(karte.get('kaputt')).toEqual({ art: 'unlesbar', grund: 'kein gültiges JSON' });
  });

  it('liefert eine leere Karte, wo nicht eingelesen wurde', () => {
    // So baut GitHub: `quellen/` ist gitignored, der Glob findet nichts.
    expect(manifesteAusTexten({}).size).toBe(0);
  });
});
