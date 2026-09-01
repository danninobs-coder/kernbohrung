import { describe, it, expect } from 'vitest';
import { beurteile, RUBRIK } from '../werkzeug/auswahl.mjs';

type Urteil = ReturnType<typeof beurteile>;

/**
 * Grenzt das Urteil ein und wirft mit einer brauchbaren Meldung, wenn es
 * anders ausfiel als erwartet.
 *
 * TypeScript verlangt die Eingrenzung, weil `Urteil` eine unterscheidbare
 * Union ist — ein `expect(u.mitnehmen).toBe(true)` davor grenzt den Typ nicht
 * ein. Der Umweg zahlt sich aus: Statt „expected undefined to be
 * 'beschreibung'" steht im Fehlerfall da, warum die Datei liegen blieb.
 */
function alsMitnehmen(u: Urteil): Extract<Urteil, { mitnehmen: true }> {
  if (!u.mitnehmen) throw new Error(`${u.pfad} wurde ausgelassen: ${u.grund}`);
  return u;
}

function alsAuslassen(u: Urteil): Extract<Urteil, { mitnehmen: false }> {
  if (u.mitnehmen) throw new Error(`${u.pfad} wurde mitgenommen als ${u.rubrik}`);
  return u;
}

describe('beurteile', () => {
  it('nimmt eine README als Beschreibung', () => {
    const u = alsMitnehmen(beurteile('rag_tutorials/corrective_rag/README.md', 2367));
    expect(u.rubrik).toBe(RUBRIK.beschreibung);
  });

  it('nimmt Python als Umsetzung', () => {
    const u = alsMitnehmen(beurteile('rag_tutorials/corrective_rag/corrective_rag.py', 16609));
    expect(u.rubrik).toBe(RUBRIK.umsetzung);
  });

  it('laesst Bilder liegen und nennt den Grund', () => {
    const u = alsAuslassen(beurteile('rag_tutorials/x/assets/architektur.png', 500000));
    expect(u.grund).toMatch(/Bild|binaer/i);
  });

  it('laesst Abhaengigkeitslisten liegen', () => {
    const u = alsAuslassen(beurteile('rag_tutorials/x/requirements.txt', 348));
    expect(u.grund).toMatch(/Abhaengigkeit/i);
  });

  it('laesst Daten liegen, auch wenn sie Text sind', () => {
    for (const p of ['x/daten.csv', 'x/ergebnisse.json', 'x/paket-lock.json']) {
      expect(beurteile(p, 40000).mitnehmen).toBe(false);
    }
  });

  it('laesst zu grosse Textdateien liegen und nennt die Groesse', () => {
    const u = alsAuslassen(beurteile('rag_tutorials/x/riesig.py', 400_000));
    expect(u.grund).toMatch(/gross/i);
  });

  it('laesst versteckte Dateien und Ordner liegen', () => {
    expect(beurteile('x/.gitignore', 24).mitnehmen).toBe(false);
    expect(beurteile('x/.github/workflows/ci.yml', 1295).mitnehmen).toBe(false);
  });

  it('urteilt allein aus Pfad und Groesse, ohne Dateisystem', () => {
    // Reine Funktion: derselbe Aufruf ergibt dasselbe Urteil.
    const a = beurteile('x/y.py', 100);
    const b = beurteile('x/y.py', 100);
    expect(a).toEqual(b);
  });
});
