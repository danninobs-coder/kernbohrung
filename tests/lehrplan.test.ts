// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pruefeLehrplan, liesLehrplan, HOECHSTZAHL } from '../werkzeug/lehrplan.mjs';

/**
 * Der Lehrplan ist das Review-Gate: Wer ihn kontrolliert, kontrolliert die App.
 *
 * Die beiden Schranken, an denen sich das entscheidet, stehen unten je fuer
 * sich: die Obergrenze (Durchgang A soll verdichten, nicht katalogisieren) und
 * `geprueftVon` (ohne menschliche Abnahme ist es kein Lehrplan).
 */

const gut = {
  quelle: 'awesome-llm-apps',
  stand: 'a13701eae315a81e1011a4304a6b5e741ea0a984',
  geprueftVon: 'Daniel Nobs',
  geprueftAm: '2026-09-02',
  prinzipien: [
    {
      id: 'recall-vor-precision',
      satz: 'Recall entsteht beim Holen, Precision beim Sortieren.',
      warumNichtOffensichtlich: 'Beide zeigen sich als schlechte Treffer.',
      belege: ['corrective_rag'],
      widget: 'Pipeline',
    },
    {
      id: 'kontext-ist-knapp',
      satz: 'Das Kontextfenster ist ein Budget, kein Behaelter.',
      warumNichtOffensichtlich: 'Mehr Kontext klingt immer besser.',
      belege: ['autonomous_rag'],
      widget: 'Pipeline',
    },
  ],
};

/**
 * Liest die Maengel aus einem Ergebnis, das fehlschlagen musste.
 *
 * Wie in `tests/widget-pruefung.test.ts`: `expect(e.ok).toBe(false)` ueberzeugt
 * den Testlauf, verengt aber die Union nicht — `astro check` kennt `maengel`
 * danach immer noch nicht.
 */
function maengelVon(ergebnis: ReturnType<typeof pruefeLehrplan>): readonly string[] {
  if (ergebnis.ok) throw new Error('Erwartet war ein Fehlschlag, die Pruefung war aber zufrieden.');
  return ergebnis.maengel;
}

describe('pruefeLehrplan', () => {
  it('nimmt einen gueltigen Lehrplan an', () => {
    const e = pruefeLehrplan(gut);
    if (!e.ok) throw new Error(`Erwartet war Erfolg, gemeldet wurde:\n  ${e.maengel.join('\n  ')}`);
    expect(e.lehrplan.prinzipien).toHaveLength(2);
  });

  it('verlangt mindestens zwei Prinzipien', () => {
    expect(pruefeLehrplan({ ...gut, prinzipien: [gut.prinzipien[0]] }).ok).toBe(false);
  });

  it(`erlaubt hoechstens ${HOECHSTZAHL} Prinzipien — Verdichten ist die Aufgabe`, () => {
    const viele = Array.from({ length: HOECHSTZAHL + 1 }, (_, i) => ({
      ...gut.prinzipien[0],
      id: `prinzip-${i}`,
    }));
    const maengel = maengelVon(pruefeLehrplan({ ...gut, prinzipien: viele }));
    expect(maengel.join(' ')).toMatch(/hoechstens|verdicht/i);
  });

  it('lehnt doppelte Prinzip-Ids ab', () => {
    const doppelt = [gut.prinzipien[0], { ...gut.prinzipien[1], id: gut.prinzipien[0].id }];
    expect(pruefeLehrplan({ ...gut, prinzipien: doppelt }).ok).toBe(false);
  });

  it('verlangt zu jedem Prinzip mindestens einen Beleg', () => {
    const ohne = [{ ...gut.prinzipien[0], belege: [] }, gut.prinzipien[1]];
    const maengel = maengelVon(pruefeLehrplan({ ...gut, prinzipien: ohne }));
    expect(maengel.join(' ')).toMatch(/beleg/i);
  });

  it('verlangt einen Pruefer — der Lehrplan ist das Review-Gate', () => {
    const { geprueftVon: _weg, ...ohne } = gut;
    const maengel = maengelVon(pruefeLehrplan(ohne));
    expect(maengel.join(' ')).toMatch(/geprueftVon/i);
    // Nicht nur der Feldname: Geprueft wird der Satz, der den Zweck des Gates
    // erklaert. Ohne ihn stuende hier Zods englisches „expected string,
    // received undefined" — ausgerechnet in dem Fall, fuer den der Satz
    // geschrieben wurde.
    expect(maengel.join(' ')).toMatch(/Review-Gate/);
  });

  it('lehnt den leeren und den nicht ausgefuellten Pruefer mit derselben Meldung ab', () => {
    // Durchgang A laesst `geprueftVon` leer; YAML macht daraus `null`. Genau
    // dieser Wert muss die Erklaerung ausloesen, nicht nur der fehlende Schluessel.
    for (const wert of ['   ', null, undefined]) {
      const maengel = maengelVon(pruefeLehrplan({ ...gut, geprueftVon: wert }));
      expect(maengel.join(' ')).toMatch(/Review-Gate/);
    }
  });

  it('lehnt ein unbekanntes Widget ab', () => {
    const falsch = [{ ...gut.prinzipien[0], widget: 'GibtEsNicht' }, gut.prinzipien[1]];
    expect(pruefeLehrplan({ ...gut, prinzipien: falsch }).ok).toBe(false);
  });

  it('lehnt Zusatzfelder ab, statt sie stillschweigend zu schlucken', () => {
    // Ein Feld, das niemand liest, ist der wahrscheinlichste Ort fuer eine
    // Behauptung, die spaeter niemand belegt.
    expect(pruefeLehrplan({ ...gut, notizen: 'nebenbei' }).ok).toBe(false);
  });
});

describe('liesLehrplan', () => {
  /** Legt eine Lehrplandatei an und raeumt sie wieder weg. */
  function mitDatei(inhalt: string, pruefe: (datei: string) => void): void {
    const ordner = mkdtempSync(path.join(tmpdir(), 'lehrplan-'));
    try {
      const datei = path.join(ordner, 'plan.yaml');
      writeFileSync(datei, inhalt, 'utf8');
      pruefe(datei);
    } finally {
      rmSync(ordner, { recursive: true, force: true });
    }
  }

  it('liest eine gueltige Lehrplandatei', () => {
    const yaml = `quelle: awesome-llm-apps
stand: a13701eae315a81e1011a4304a6b5e741ea0a984
geprueftVon: Daniel Nobs
geprueftAm: 2026-09-02
prinzipien:
  - id: recall-vor-precision
    satz: "Recall entsteht beim Holen, Precision beim Sortieren."
    warumNichtOffensichtlich: "Beide zeigen sich als schlechte Treffer."
    belege:
      - corrective_rag
    widget: Pipeline
  - id: kontext-ist-knapp
    satz: "Das Kontextfenster ist ein Budget, kein Behaelter."
    warumNichtOffensichtlich: "Mehr Kontext klingt immer besser."
    belege:
      - autonomous_rag
    widget: Pipeline
`;
    mitDatei(yaml, (datei) => {
      const e = liesLehrplan(datei);
      if (!e.ok) throw new Error(`Erwartet war Erfolg:\n  ${e.maengel.join('\n  ')}`);
      expect(e.lehrplan.geprueftVon).toBe('Daniel Nobs');
      // Unquotiert notiert und trotzdem ein String: js-yaml 5 loest Datumsangaben
      // nicht zu Date-Objekten auf. Der Mensch am Review-Gate muss also nicht
      // an Anfuehrungszeichen denken.
      expect(e.lehrplan.geprueftAm).toBe('2026-09-02');
    });
  });

  /**
   * Am Review-Gate tippt ein Mensch `geprueftVon` von Hand in diese Datei.
   * Ein YAML-Tippfehler ist dort wahrscheinlich — er darf eine Maengelliste
   * ergeben und keinen nackten Stapelabzug.
   */
  it('meldet kaputtes YAML als Mangel, statt abzustuerzen', () => {
    mitDatei('quelle: "unbeendet\nstand: abc\n', (datei) => {
      const maengel = maengelVon(liesLehrplan(datei));
      expect(maengel.join(' ')).toMatch(/YAML/i);
    });
  });

  /**
   * Eine fehlende Datei ist kein Syntaxfehler.
   *
   * Wuerden beide Faelle in einem catch landen, meldete der haeufigere von
   * beiden — der vertippte Pfad — „ist kein gueltiges YAML" und schickte den
   * Suchenden in die Datei statt auf den Pfad.
   */
  it('unterscheidet eine fehlende Datei von kaputtem YAML', () => {
    const maengel = maengelVon(liesLehrplan(path.join(tmpdir(), 'gibt-es-nicht-4711.yaml')));
    expect(maengel.join(' ')).toMatch(/nicht lesen/i);
    expect(maengel.join(' ')).not.toMatch(/gueltiges YAML/i);
  });
});
