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
    expect(leseManifestauszug(text({ fassung: 4 }))).toEqual({
      art: 'unlesbar',
      grund: 'Fassung 4 kennt diese Seite nicht',
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

/**
 * Fassung 3 — was das Einlesen von Buch und Folien schreibt.
 *
 * Die Seite liest daraus drei Zahlen und den Stand. Alles andere im Manifest
 * — die Seitenlisten je Abschnitt, die Originale mit ihren Hashes — ist fuer
 * den Compiler da und geht diesen Leser nichts an; er muss es uebergehen,
 * nicht daran scheitern.
 */
const fassung3 = {
  fassung: 3,
  gestempeltAm: '2026-09-23T08:00:00.000Z',
  herkunft: { art: 'folien', stand: `sha256:${'f'.repeat(64)}` },
  summe: { originale: 9, seiten: 199, abschnitte: 22, nurBild: 8, tabellenverdacht: 21, beiwerkZeichen: 41902 },
  originale: [{ datei: 'M7.pdf', dateiHash: `sha256:${'a'.repeat(64)}`, seiten: 35, gliederung: 'agenda', beiwerkZeichen: 6676 }],
  roh: [{ id: 'm07-01-begriff', datei: 'M7.pdf', seiten: [1, 5], nurBild: [], tabellenverdacht: [2] }],
};

/** Legt die Aenderung stumpf ueber das gueltige Manifest der Fassung 3. */
function text3(aenderung: Record<string, unknown> = {}): string {
  return JSON.stringify({ ...fassung3, ...aenderung });
}

describe('leseManifestauszug - Fassung 3', () => {
  it('liest Stand und die drei Zahlen der Lueckenzeile', () => {
    expect(leseManifestauszug(text3())).toEqual({
      art: 'dokument',
      stand: `sha256:${'f'.repeat(64)}`,
      seiten: 199,
      nurBild: 8,
      tabellenverdacht: 21,
    });
  });

  it('liest ein Buch genauso wie Folien — die Einheit steht im Lehrplan', () => {
    const auszug = leseManifestauszug(text3({ herkunft: { art: 'buch', stand: `sha256:${'f'.repeat(64)}` } }));
    expect(auszug.art).toBe('dokument');
  });

  it('nimmt Fassung 3 ohne Summen nicht fuer bare Muenze', () => {
    const { summe: _summe, ...ohne } = fassung3;
    expect(leseManifestauszug(JSON.stringify(ohne))).toEqual({
      art: 'unlesbar',
      grund: 'Fassung 3, aber unvollständig',
    });
  });

  it('weist einen Stand zurueck, der kein sha256 ist', () => {
    // Der Lehrplan haelt denselben Wert; passt die Form nicht, liesse sich
    // beides nicht mehr gegeneinander halten.
    expect(leseManifestauszug(text3({ herkunft: { art: 'folien', stand: 'a13701e' } }))).toEqual({
      art: 'unlesbar',
      grund: 'Fassung 3, aber unvollständig',
    });
  });

  it('nennt eine Fassung, die diese Seite nicht kennt, weiterhin beim Namen', () => {
    expect(leseManifestauszug(text3({ fassung: 4 }))).toEqual({
      art: 'unlesbar',
      grund: 'Fassung 4 kennt diese Seite nicht',
    });
  });
});
