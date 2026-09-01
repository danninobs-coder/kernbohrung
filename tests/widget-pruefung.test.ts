import { describe, it, expect } from 'vitest';
import { pruefeWidget, widgetPruefungen } from '../src/widgets/pruefung';
// Der Quelltext als Text, nicht als Modul: der Test unten prueft, was die Datei
// importiert, und dafuer muss er sie lesen koennen, ohne sie auszufuehren.
import quelltext from '../src/widgets/pruefung.ts?raw';

/**
 * Zwei Schalter, alle vier Kombinationen hinterlegt — die Vorlage, von der aus
 * jeder Test unten genau ein Loch aufreißt.
 */
const gueltig = {
  einheit: 'Dokument',
  schritte: [
    { id: 'suche', titel: 'Suche', wirkung: 'Holt Kandidaten.' },
    { id: 'bm25', titel: '+ BM25', wirkung: 'Sucht wörtlich.', optional: true, standardAn: false },
    { id: 'rerank', titel: '+ Reranker', wirkung: 'Sortiert um.', optional: true, standardAn: false },
    { id: 'kontext', titel: 'Top 5', wirkung: 'Nur die sieht das Modell.' },
  ],
  ergebnisse: [
    { wenn: [], ausgabe: [{ text: 'A', treffer: false }], hinweis: 'ohne' },
    { wenn: ['bm25'], ausgabe: [{ text: 'B', treffer: true }], hinweis: 'nur bm25' },
    { wenn: ['rerank'], ausgabe: [{ text: 'C', treffer: true }], hinweis: 'nur rerank' },
    { wenn: ['bm25', 'rerank'], ausgabe: [{ text: 'D', treffer: true }], hinweis: 'beides' },
  ],
};

/** Liest die Mängel aus einem Ergebnis, das fehlschlagen musste. */
function maengelVon(ergebnis: ReturnType<typeof pruefeWidget>): readonly string[] {
  if (ergebnis.ok) throw new Error('Erwartet war ein Fehlschlag, die Prüfung war aber zufrieden.');
  return ergebnis.maengel;
}

describe('pruefeWidget — der gültige Fall', () => {
  it('nimmt gültige Parameter an und liefert die geparsten Daten mit Standardwerten', () => {
    const ergebnis = pruefeWidget('Pipeline', gueltig);

    expect(ergebnis.ok).toBe(true);
    if (!ergebnis.ok) return;

    // Geparst, nicht durchgereicht: Zod hat die Standardwerte gesetzt, der
    // Aufrufer kann die Daten direkt rendern.
    expect(ergebnis.daten.schritte[0].optional).toBe(false);
    expect(ergebnis.daten.schritte[0].standardAn).toBe(true);
    expect(ergebnis.daten.einheit).toBe('Dokument');
    expect(ergebnis.daten.schritte).toHaveLength(4);
  });

  it('setzt einheit auch dann, wenn der Aufruf sie weglässt', () => {
    const { einheit: _weg, ...ohneEinheit } = gueltig;
    const ergebnis = pruefeWidget('Pipeline', ohneEinheit);

    expect(ergebnis.ok).toBe(true);
    if (!ergebnis.ok) return;
    expect(ergebnis.daten.einheit).toBe('Dokument');
  });
});

describe('pruefeWidget — unbekannte Widgets', () => {
  it('meldet einen unbekannten Namen, statt ihn stillschweigend durchzulassen', () => {
    const maengel = maengelVon(pruefeWidget('Zeitstrahl', gueltig));

    expect(maengel).toHaveLength(1);
    expect(maengel[0]).toContain('Zeitstrahl');
    // Die Meldung nennt, was es stattdessen gibt — ein Generator soll sich
    // daran korrigieren können.
    expect(maengel[0]).toContain('Pipeline');
  });

  it('fällt nicht auf Schlüssel von Object.prototype herein', () => {
    // Ohne Object.hasOwn löste "toString" auf die Prototypfunktion auf, und der
    // Zugriff auf deren `schema` wäre ein Absturz statt einer Meldung.
    for (const name of ['toString', 'constructor', 'hasOwnProperty']) {
      const ergebnis = pruefeWidget(name, gueltig);
      expect(ergebnis.ok).toBe(false);
      expect(maengelVon(ergebnis)[0]).toContain('Unbekanntes Widget');
    }
  });
});

describe('pruefeWidget — Schemaprüfung', () => {
  it('meldet ein halluziniertes Zusatzfeld', () => {
    const maengel = maengelVon(
      pruefeWidget('Pipeline', { ...gueltig, erfundenesFeld: 'aus einer Halluzination' }),
    );

    expect(maengel).toHaveLength(1);
    expect(maengel[0]).toContain('erfundenesFeld');
    expect(maengel[0]).toContain('Pipeline');
  });

  it('nennt bei einem Formfehler den Feldpfad bis in die Tiefe', () => {
    const kaputt = {
      ...gueltig,
      schritte: [
        { id: 'GROSS UND FALSCH', titel: 'A', wirkung: 'x' },
        ...gueltig.schritte.slice(1),
      ],
    };
    const maengel = maengelVon(pruefeWidget('Pipeline', kaputt));

    expect(maengel.some((m) => m.includes('schritte[0].id'))).toBe(true);
  });

  it('meldet leere Parameter verständlich statt mit „Invalid input"', () => {
    const maengel = maengelVon(pruefeWidget('Pipeline', { schritte: [], ergebnisse: [] }));

    expect(maengel.length).toBeGreaterThan(0);
    for (const m of maengel) {
      expect(m).not.toMatch(/Invalid input|Too small|Too big|Unrecognized key/);
    }
    expect(maengel.some((m) => m.includes('schritte'))).toBe(true);
    expect(maengel.some((m) => m.includes('ergebnisse'))).toBe(true);
  });
});

describe('pruefeWidget — Framework-Rauschen', () => {
  it('stört sich nicht an children aus der Hydration', () => {
    // Astro reicht children serverseitig nicht mit, React bei der Hydration
    // schon. Das Verwerfen steht hier und nicht in der Komponente, damit Widget
    // zwei bis sieben die Zeile nicht abschreiben müssen.
    const ergebnis = pruefeWidget('Pipeline', { ...gueltig, children: undefined });

    expect(ergebnis.ok).toBe(true);
  });

  it('verwirft children auch dann, wenn tatsächlich Inhalt darin steht', () => {
    expect(pruefeWidget('Pipeline', { ...gueltig, children: 'Slot-Inhalt' }).ok).toBe(true);
    expect(pruefeWidget('Pipeline', { ...gueltig, key: 'k', ref: null }).ok).toBe(true);
  });

  it('lässt die strictObject-Schranke für alles andere in Kraft', () => {
    // Die Rauschliste ist kein Freibrief: ein erfundenes Feld neben children
    // wird weiterhin gemeldet.
    const maengel = maengelVon(
      pruefeWidget('Pipeline', { ...gueltig, children: undefined, farbe: 'blau' }),
    );

    expect(maengel.some((m) => m.includes('farbe'))).toBe(true);
  });
});

describe('pruefeWidget — Zusatzprüfung', () => {
  it('meldet eine Abdeckungslücke, obwohl das Schema selbst zufrieden ist', () => {
    // Der Kern: drei zuschaltbare Schritte, ein einziges hinterlegtes Ergebnis.
    // Strukturell tadellos — PipelineProps hat daran nichts auszusetzen —, im
    // Betrieb sieben Löcher.
    const luecke = {
      einheit: 'Dokument',
      schritte: [
        { id: 'suche', titel: 'Suche', wirkung: 'Holt Kandidaten.' },
        { id: 'bm25', titel: '+ BM25', wirkung: 'Wörtlich.', optional: true, standardAn: false },
        { id: 'rerank', titel: '+ Reranker', wirkung: 'Sortiert.', optional: true, standardAn: false },
        { id: 'hyde', titel: '+ HyDE', wirkung: 'Erfindet vorab.', optional: true, standardAn: false },
      ],
      ergebnisse: [{ wenn: [], ausgabe: [{ text: 'A', treffer: false }], hinweis: 'ohne' }],
    };

    // Erst der Nachweis, dass das Schema allein nichts merkt.
    expect(widgetPruefungen.Pipeline.schema.safeParse(luecke).success).toBe(true);

    const maengel = maengelVon(pruefeWidget('Pipeline', luecke));
    expect(maengel).toHaveLength(1);
    expect(maengel[0]).toContain('Pipeline');
    expect(maengel[0]).toContain('ergebnisse');
    expect(maengel[0]).toContain('7 von 8');
    // Die fehlenden Kombinationen werden beim Namen genannt, nicht nur gezählt.
    expect(maengel[0]).toContain('bm25+rerank');
  });

  it('läuft erst nach der Schemaprüfung — ein Formfehler verdeckt die Lücke nicht mit einem Absturz', () => {
    const kaputtUndLueckig = {
      schritte: [
        { id: 'eins', titel: 'A', wirkung: 'x', optional: true, standardAn: false },
        { id: 'ZWEI FALSCH', titel: 'B', wirkung: 'y', optional: true, standardAn: false },
      ],
      ergebnisse: [{ wenn: [], ausgabe: [{ text: 'A', treffer: false }], hinweis: 'ohne' }],
    };
    const maengel = maengelVon(pruefeWidget('Pipeline', kaputtUndLueckig));

    expect(maengel.some((m) => m.includes('schritte[1].id'))).toBe(true);
  });

  it('schweigt bei vollständiger Abdeckung', () => {
    expect(pruefeWidget('Pipeline', gueltig).ok).toBe(true);
  });
});

describe('pruefeWidget — Beschaffenheit der Meldungen', () => {
  it('liefert niemals leere oder nichtssagende Mängel', () => {
    const faelle: unknown[] = [
      { ...gueltig, erfundenesFeld: 1 },
      { schritte: [], ergebnisse: [] },
      { ...gueltig, einheit: 42 },
      { ...gueltig, ergebnisse: [] },
      'gar kein Objekt',
      null,
    ];

    for (const fall of faelle) {
      const maengel = maengelVon(pruefeWidget('Pipeline', fall));
      expect(maengel.length).toBeGreaterThan(0);
      for (const m of maengel) {
        expect(m.trim().length).toBeGreaterThan(20);
        expect(m.startsWith('Pipeline')).toBe(true);
      }
    }
  });
});

describe('pruefung.ts als Compiler-Schnittstelle', () => {
  it('bildet jeden Namen auf ein Schema ab', () => {
    for (const [name, eintrag] of Object.entries(widgetPruefungen)) {
      expect(typeof eintrag.schema.safeParse, `${name} hat kein Schema`).toBe('function');
    }
    expect(Object.keys(widgetPruefungen)).toContain('Pipeline');
  });

  it('importiert nichts, was ein reiner Node-Prozess nicht laden kann', () => {
    // Der eigentliche Zweck der Datei. `src/widgets/index.ts` ist aus reinem
    // Node nicht ladbar (`Unknown file extension ".astro"`), der Compiler aus
    // Abschnitt 2 läuft aber genau so. Zwei Wege, das kaputtzumachen, und
    // dieser Test schließt beide:
    //
    // 1. Ein Import, den es dort nicht gibt — React, astro:content, eine
    //    .astro-Datei.
    // 2. Ein relativer Import ohne Dateiendung. Vite und Astro ergänzen sie,
    //    Node nicht (ERR_MODULE_NOT_FOUND). Genau das ist beim Bauen dieser
    //    Datei passiert und nur so aufgefallen.
    const importe = [...quelltext.matchAll(/^\s*import\s[^'"]*from\s+'([^']+)'/gm)].map(
      (treffer) => treffer[1],
    );

    expect(importe.length).toBeGreaterThan(0);
    expect(importe.sort()).toEqual(['./schema.ts', 'astro/zod']);
  });
});
