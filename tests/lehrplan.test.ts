// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ART_FEHLT, HOECHSTZAHL, lehrplaeneAusTexten, pruefeLehrplan } from '../src/lib/lehrplan';
import { liesLehrplan } from '../werkzeug/lehrplan.mjs';

/**
 * Der Lehrplan ist das Review-Gate: Wer ihn kontrolliert, kontrolliert die App.
 *
 * Diese Datei prueft die Form fuer Repos — Fassung 1 plus `art` und
 * `vorbehalt` — und das Lesen: vom Datentraeger und aus den Texten, die die
 * Seite /bibliothek bekommt. Buch und Folien stehen in
 * `tests/lehrplan-lehrmaterial.test.ts`.
 *
 * Die beiden Schranken, an denen sich das entscheidet, stehen unten je fuer
 * sich: die Obergrenze (Durchgang A soll verdichten, nicht katalogisieren) und
 * `geprueftVon` (ohne menschliche Abnahme ist es kein Lehrplan).
 */

/** Fuer Repos spielt es keine Rolle, welche Lektionen es gibt. */
const KEINE = new Set<string>();

const gut = {
  art: 'repo',
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

/** Legt einen Vorbehalt stumpf ueber das erste Prinzip — und ergaenzt nichts sonst. */
function mitVorbehalt(vorbehalt: unknown) {
  return { ...gut, prinzipien: [{ ...gut.prinzipien[0], vorbehalt }, gut.prinzipien[1]] };
}

describe('pruefeLehrplan - Repo', () => {
  it('nimmt einen gueltigen Lehrplan an', () => {
    const e = pruefeLehrplan(gut, KEINE);
    if (!e.ok) throw new Error(`Erwartet war Erfolg, gemeldet wurde:\n  ${e.maengel.join('\n  ')}`);
    if (e.lehrplan.art !== 'repo') throw new Error('Erwartet war ein Repo.');
    expect(e.lehrplan.prinzipien).toHaveLength(2);
  });

  it('weist einen Lehrplan ohne art zurueck und sagt, was einzutragen ist', () => {
    // Genau so sieht jeder Lehrplan aus Fassung 1 aus. Migration statt
    // stiller Voreinstellung: Die Meldung nennt die Zeile, die fehlt.
    const { art: _art, ...ohne } = gut;
    expect(maengelVon(pruefeLehrplan(ohne, KEINE))).toEqual([`art: ${ART_FEHLT}`]);
    expect(ART_FEHLT).toMatch(/art: repo/);
  });

  it('weist eine unbekannte art mit derselben Meldung zurueck', () => {
    expect(maengelVon(pruefeLehrplan({ ...gut, art: 'video' }, KEINE))).toEqual([`art: ${ART_FEHLT}`]);
  });

  // Als Paare aus Name und Wert: `it.each` breitet eine blanke Liste als
  // Argumente aus — eine leere Liste kaeme als „gar kein Argument" an.
  it.each([
    ['nichts', undefined],
    ['null', null],
    ['einem Text', 'text'],
    ['einer Zahl', 42],
    ['einer leeren Liste', []],
    ['einem leeren Objekt', {}],
  ])('macht aus %s einen Befund mit Maengeln, ohne zu werfen', (_name, daten) => {
    expect(maengelVon(pruefeLehrplan(daten, KEINE)).length).toBeGreaterThan(0);
  });

  it('verlangt mindestens zwei Prinzipien', () => {
    expect(pruefeLehrplan({ ...gut, prinzipien: [gut.prinzipien[0]] }, KEINE).ok).toBe(false);
  });

  it('nennt bei nur einem Prinzip die Mindestzahl auf Deutsch', () => {
    expect(maengelVon(pruefeLehrplan({ ...gut, prinzipien: [gut.prinzipien[0]] }, KEINE))).toEqual([
      'prinzipien: braucht mindestens 2 Einträge.',
    ]);
  });

  it(`erlaubt hoechstens ${HOECHSTZAHL} Prinzipien — Verdichten ist die Aufgabe`, () => {
    const viele = Array.from({ length: HOECHSTZAHL + 1 }, (_, i) => ({
      ...gut.prinzipien[0],
      id: `prinzip-${i}`,
    }));
    const maengel = maengelVon(pruefeLehrplan({ ...gut, prinzipien: viele }, KEINE));
    expect(maengel.join(' ')).toMatch(/höchstens 8 Prinzipien — verdichten/);
  });

  it('lehnt doppelte Prinzip-Ids ab', () => {
    const doppelt = [gut.prinzipien[0], { ...gut.prinzipien[1], id: gut.prinzipien[0].id }];
    expect(pruefeLehrplan({ ...gut, prinzipien: doppelt }, KEINE).ok).toBe(false);
  });

  it('verlangt zu jedem Prinzip mindestens einen Beleg', () => {
    const ohne = [{ ...gut.prinzipien[0], belege: [] }, gut.prinzipien[1]];
    const maengel = maengelVon(pruefeLehrplan({ ...gut, prinzipien: ohne }, KEINE));
    expect(maengel.join(' ')).toMatch(/beleg/i);
  });

  it('verlangt einen Pruefer — der Lehrplan ist das Review-Gate', () => {
    const { geprueftVon: _weg, ...ohne } = gut;
    const maengel = maengelVon(pruefeLehrplan(ohne, KEINE));
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
      const maengel = maengelVon(pruefeLehrplan({ ...gut, geprueftVon: wert }, KEINE));
      expect(maengel.join(' ')).toMatch(/Review-Gate/);
    }
  });

  it('lehnt ein unbekanntes Widget ab', () => {
    const falsch = [{ ...gut.prinzipien[0], widget: 'GibtEsNicht' }, gut.prinzipien[1]];
    expect(pruefeLehrplan({ ...gut, prinzipien: falsch }, KEINE).ok).toBe(false);
  });

  it('lehnt Zusatzfelder ab, statt sie stillschweigend zu schlucken', () => {
    // Ein Feld, das niemand liest, ist der wahrscheinlichste Ort fuer eine
    // Behauptung, die spaeter niemand belegt.
    expect(pruefeLehrplan({ ...gut, notizen: 'nebenbei' }, KEINE).ok).toBe(false);
  });

  it('nennt ein unbekanntes Feld auf Deutsch und beim Namen', () => {
    expect(maengelVon(pruefeLehrplan({ ...gut, autor: 'X' }, KEINE))).toEqual([
      '(Wurzel): unbekanntes Feld: autor.',
    ]);
  });

  it('weist Titel und Abschnitte bei einem Repo zurueck — die gehoeren zu Buch und Folien', () => {
    expect(pruefeLehrplan({ ...gut, titel: 'Ein Titel' }, KEINE).ok).toBe(false);
    expect(pruefeLehrplan({ ...gut, abschnitte: [] }, KEINE).ok).toBe(false);
  });
});

describe('pruefeLehrplan - Repo, stand und quelle', () => {
  it('weist einen gekuerzten Stand zurueck — der Vergleich mit dem Manifest braucht den vollen Commit', () => {
    expect(maengelVon(pruefeLehrplan({ ...gut, stand: 'a13701e' }, KEINE))).toEqual([
      'stand: stand ist der volle Commit aus dem Manifest — 40 Zeichen aus 0–9 und a–f.',
    ]);
  });

  it('weist einen Stand mit Grossbuchstaben zurueck', () => {
    expect(
      maengelVon(pruefeLehrplan({ ...gut, stand: 'A13701EAE315A81E1011A4304A6B5E741EA0A984' }, KEINE)),
    ).toEqual(['stand: stand ist der volle Commit aus dem Manifest — 40 Zeichen aus 0–9 und a–f.']);
  });

  it('weist eine Quelle mit Grossbuchstaben und Leerzeichen zurueck — sie ist der Ordnername unter quellen/', () => {
    expect(maengelVon(pruefeLehrplan({ ...gut, quelle: 'Awesome LLM' }, KEINE))).toEqual([
      'quelle: quelle ist der Kurzname des Ordners unter quellen/ — nur Kleinbuchstaben, Ziffern und Bindestrich.',
    ]);
  });
});

describe('pruefeLehrplan - Vorbehalt', () => {
  it('nimmt ein Prinzip mit Vorbehalt an und gibt ihn zurueck', () => {
    const satz = 'Für diese Quoten gibt es keine belastbare Studie.';
    const e = pruefeLehrplan(mitVorbehalt(satz), KEINE);
    if (!e.ok) throw new Error(e.maengel.join('\n'));
    if (e.lehrplan.art !== 'repo') throw new Error('Erwartet war ein Repo.');
    expect(e.lehrplan.prinzipien[0]?.vorbehalt).toBe(satz);
    expect(e.lehrplan.prinzipien[1]?.vorbehalt).toBeUndefined();
  });

  it('weist einen Vorbehalt zurueck, der ein Absatz ist', () => {
    const absatz = 'Wort '.repeat(45).trim();
    expect(absatz.length).toBeGreaterThan(200);
    expect(maengelVon(pruefeLehrplan(mitVorbehalt(absatz), KEINE)).join(' ')).toMatch(
      /Ein Vorbehalt ist ein Satz, kein Absatz/,
    );
  });

  it('weist einen leeren Vorbehalt zurueck, statt ihn als keinen zu lesen', () => {
    // Ein leerer Vorbehalt ist ein Fehler beim Erzeugen, kein Vorbehalt.
    // Wer keinen hat, laesst das Feld weg.
    expect(maengelVon(pruefeLehrplan(mitVorbehalt('   '), KEINE)).join(' ')).toMatch(
      /Ein Vorbehalt braucht einen Satz/,
    );
  });

  it('meldet ein leeres YAML-Feld vorbehalt auf Deutsch', () => {
    // `vorbehalt:` ohne Wert liest YAML als null. Ohne eigene Meldung zeigte
    // die Seite Zods englischen Standardtext.
    expect(maengelVon(pruefeLehrplan(mitVorbehalt(null), KEINE)).join(' ')).toMatch(
      /Ein Vorbehalt ist Text/,
    );
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
    const yaml = `art: repo
quelle: awesome-llm-apps
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
      expect(maengel.join(' ')).toMatch(/kein gültiges YAML/);
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
    expect(maengel.join(' ')).toMatch(/lässt sich nicht lesen/);
    expect(maengel.join(' ')).not.toMatch(/YAML/);
  });
});

/**
 * Der Zustand zwischen Durchgang A und dem Menschen am Review-Gate.
 *
 * Fuer den Compiler bleibt ein solcher Lehrplan `ok: false` — er baut daraus
 * keine Lektionen. Fuer die Seite ist er trotzdem lesbar: Ohne diesen dritten
 * Fall verschwaende die Karte samt Zahlen, sobald ein Durchgang laeuft, und
 * alle frueher freigegebenen Lektionen stuenden als „ohne Lehrplaneintrag" da.
 */
describe('pruefeLehrplan - wartet auf Freigabe', () => {
  /** Holt den Lehrplan aus einem wartenden Befund. */
  function wartendVon(ergebnis: ReturnType<typeof pruefeLehrplan>) {
    if (ergebnis.ok) throw new Error('Erwartet war ein Fehlschlag, die Pruefung war aber zufrieden.');
    if (!ergebnis.wartet) throw new Error(`Erwartet war „wartet", gemeldet wurde: ${ergebnis.maengel.join(' | ')}`);
    return ergebnis;
  }

  it.each([
    ['leer', ''],
    ['nicht gesetzt', null],
    ['nur Leerzeichen', '   '],
  ])('wartet, wenn geprueftVon %s ist — und liefert den Lehrplan mit', (_fall, wert) => {
    const e = wartendVon(pruefeLehrplan({ ...gut, geprueftVon: wert }, KEINE));
    expect(e.maengel).toEqual(['geprueftVon: geprueftVon fehlt — der Lehrplan ist das Review-Gate.']);
    // Bei „nur Leerzeichen" haelt das fest, dass mitErsetzterFreigabe trimmt —
    // ohne .trim() bliebe hier '   ' stehen statt ''.
    expect(e.lehrplan.geprueftVon).toBe('');
    expect(e.lehrplan.quelle).toBe('awesome-llm-apps');
    if (e.lehrplan.art !== 'repo') throw new Error('Erwartet war ein Repo.');
    expect(e.lehrplan.prinzipien).toHaveLength(2);
  });

  it('wartet auch, wenn beide Felder fehlen', () => {
    const { geprueftVon: _v, geprueftAm: _a, ...ohne } = gut;
    const e = wartendVon(pruefeLehrplan(ohne, KEINE));
    expect(e.maengel).toHaveLength(2);
    expect(e.maengel.join(' ')).toMatch(/geprueftVon/);
    expect(e.maengel.join(' ')).toMatch(/geprueftAm/);
  });

  /**
   * Was im Lehrplan tatsaechlich steht, bleibt im Befund erhalten — nur das
   * fehlende Feld wird leer. Der Ersatzwert aus dem zweiten Lesedurchgang
   * verlaesst die Funktion nie.
   */
  it('traegt nur das fehlende Feld leer, nicht mit einem Platzhalter', () => {
    const e = wartendVon(pruefeLehrplan({ ...gut, geprueftVon: '' }, KEINE));
    expect(e.lehrplan.geprueftVon).toBe('');
    expect(e.lehrplan.geprueftAm).toBe('2026-09-02');
  });

  it('behaelt geprueftVon, wenn nur geprueftAm fehlt', () => {
    const e = wartendVon(pruefeLehrplan({ ...gut, geprueftAm: '' }, KEINE));
    expect(e.lehrplan.geprueftVon).toBe('Daniel Nobs');
    expect(e.lehrplan.geprueftAm).toBe('');
  });

  it('bleibt ungueltig, wenn neben der Freigabe noch etwas fehlt — und zeigt alle Maengel', () => {
    const e = pruefeLehrplan({ ...gut, geprueftVon: '', stand: 'a13701e' }, KEINE);
    if (e.ok) throw new Error('Erwartet war ein Fehlschlag.');
    expect(e.wartet).toBeFalsy();
    expect(e.maengel).toHaveLength(2);
    expect(e.maengel.join(' ')).toMatch(/Review-Gate/);
    expect(e.maengel.join(' ')).toMatch(/40 Zeichen/);
  });
});

describe('lehrplaeneAusTexten', () => {
  /** Der gueltige Lehrplan oben als YAML-Text — JSON ist gueltiges YAML. */
  const yaml = (aenderung: Record<string, unknown> = {}) => JSON.stringify({ ...gut, ...aenderung });

  it('trennt gueltige von ungueltigen Lehrplaenen und nennt die Datei beim Namen', () => {
    const { gueltig, ungueltig } = lehrplaeneAusTexten(
      { '/lehrplan/gut.yaml': yaml(), '/lehrplan/kaputt.yaml': 'quelle: "unbeendet\n' },
      KEINE,
    );
    expect(gueltig.map((l) => l.quelle)).toEqual(['awesome-llm-apps']);
    expect(ungueltig.map((u) => u.datei)).toEqual(['kaputt.yaml']);
    expect(ungueltig[0]?.maengel.join(' ')).toMatch(/^kaputt\.yaml ist kein gültiges YAML/);
  });

  it('meldet eine falsche Einrueckung einzeilig, mit Zeile und Spalte statt Quelltextausschnitt', () => {
    // Js-yaml haengt an seine `.message` sonst den mehrzeiligen Ausschnitt an
    // — auf der Seite /bibliothek, die Maengel wörtlich zeigt, unlesbar.
    const { ungueltig } = lehrplaeneAusTexten(
      { '/lehrplan/schief.yaml': 'art: repo\nquelle: x\n  stand: abc\n' },
      KEINE,
    );
    expect(ungueltig).toEqual([
      {
        datei: 'schief.yaml',
        maengel: ['schief.yaml ist kein gültiges YAML (Zeile 3, Spalte 8): bad indentation of a mapping entry'],
      },
    ]);
    expect(ungueltig[0]?.maengel[0]).not.toContain('\n');
  });

  it('legt einen Lehrplan, dem nur die Freigabe fehlt, zu den wartenden', () => {
    // Genau der Zustand zwischen Durchgang A und dem Menschen: geprueftVon ist
    // leer. Der Bau soll daran nicht scheitern, und die Seite zeigt seine
    // Zahlen — markiert, nicht als Warnung ohne Zahlen.
    const { gueltig, wartend, ungueltig } = lehrplaeneAusTexten(
      { '/lehrplan/wartet.yaml': yaml({ geprueftVon: '' }) },
      KEINE,
    );
    expect(gueltig).toEqual([]);
    expect(ungueltig).toEqual([]);
    expect(wartend.map((l) => l.quelle)).toEqual(['awesome-llm-apps']);
  });

  it('sortiert nach Pfad, unabhaengig von der Reihenfolge der Eingabe', () => {
    const { ungueltig } = lehrplaeneAusTexten({ '/lehrplan/b.yaml': '{', '/lehrplan/a.yaml': '{' }, KEINE);
    expect(ungueltig.map((u) => u.datei)).toEqual(['a.yaml', 'b.yaml']);
  });

  it('liefert drei leere Listen, wenn es keinen Lehrplan gibt', () => {
    expect(lehrplaeneAusTexten({}, KEINE)).toEqual({ gueltig: [], wartend: [], ungueltig: [] });
  });
});
