import { describe, it, expect } from 'vitest';
import {
  PipelineProps,
  schluessel,
  findeErgebnis,
  fehlendeKombinationen,
} from '../src/widgets/schema';

const gueltig = {
  einheit: 'Dokument',
  schritte: [
    { id: 'suche', titel: 'Suche', wirkung: 'Holt Kandidaten.' },
    { id: 'rerank', titel: 'Reranker', wirkung: 'Sortiert um.', optional: true, standardAn: false },
    { id: 'kontext', titel: 'Kontext', wirkung: 'Top 3 gehen ans Modell.' },
  ],
  ergebnisse: [
    { wenn: [], ausgabe: [{ text: 'A', treffer: false }], hinweis: 'ohne' },
    { wenn: ['rerank'], ausgabe: [{ text: 'A', treffer: true }], hinweis: 'mit' },
  ],
};

describe('PipelineProps', () => {
  it('nimmt gültige Parameter an und setzt Standardwerte', () => {
    const d = PipelineProps.parse(gueltig);
    expect(d.schritte[0].optional).toBe(false);
    expect(d.schritte[0].standardAn).toBe(true);
    expect(d.einheit).toBe('Dokument');
  });

  it('lehnt weniger als zwei Schritte ab', () => {
    const kaputt = { ...gueltig, schritte: [gueltig.schritte[0]] };
    expect(PipelineProps.safeParse(kaputt).success).toBe(false);
  });
});

describe('schluessel', () => {
  it('ist unabhängig von der Reihenfolge', () => {
    expect(schluessel(['b', 'a'])).toBe(schluessel(['a', 'b']));
  });

  it('bildet die leere Menge auf den leeren String ab', () => {
    expect(schluessel([])).toBe('');
  });
});

describe('findeErgebnis', () => {
  it('findet das Ergebnis unabhängig von der Reihenfolge der aktiven Ids', () => {
    const d = PipelineProps.parse(gueltig);
    expect(findeErgebnis(d.ergebnisse, ['rerank'])?.hinweis).toBe('mit');
    expect(findeErgebnis(d.ergebnisse, [])?.hinweis).toBe('ohne');
  });

  it('gibt undefined zurück, wenn nichts passt', () => {
    const d = PipelineProps.parse(gueltig);
    expect(findeErgebnis(d.ergebnisse, ['gibtesnicht'])).toBeUndefined();
  });
});

describe('fehlendeKombinationen', () => {
  it('meldet nichts bei vollständiger Abdeckung', () => {
    const d = PipelineProps.parse(gueltig);
    expect(fehlendeKombinationen(d)).toEqual([]);
  });

  it('meldet die fehlende Kombination beim Namen', () => {
    const luecke = {
      ...gueltig,
      schritte: [
        ...gueltig.schritte,
        { id: 'bm25', titel: 'BM25', wirkung: 'Sucht wörtlich.', optional: true, standardAn: false },
      ],
    };
    const d = PipelineProps.parse(luecke);
    expect(fehlendeKombinationen(d).sort()).toEqual(['bm25', 'bm25+rerank']);
  });
});

describe('PipelineProps als Schranke', () => {
  it('lehnt zwei Schritte mit derselben id ab', () => {
    const kaputt = {
      ...gueltig,
      schritte: [
        { id: 'doppelt', titel: 'A', wirkung: 'x', optional: true, standardAn: false },
        { id: 'doppelt', titel: 'B', wirkung: 'y', optional: true, standardAn: false },
      ],
    };
    expect(PipelineProps.safeParse(kaputt).success).toBe(false);
  });

  it('lehnt zwei Ergebnisse fuer dieselbe Kombination ab', () => {
    const kaputt = {
      ...gueltig,
      ergebnisse: [
        ...gueltig.ergebnisse,
        { wenn: ['rerank'], ausgabe: [{ text: 'B', treffer: true }], hinweis: 'nochmal' },
      ],
    };
    expect(PipelineProps.safeParse(kaputt).success).toBe(false);
  });

  it('erkennt dieselbe Kombination auch bei anderer Reihenfolge der Ids', () => {
    const kaputt = {
      einheit: 'Dokument',
      schritte: [
        { id: 'eins', titel: 'A', wirkung: 'x', optional: true, standardAn: false },
        { id: 'zwei', titel: 'B', wirkung: 'y', optional: true, standardAn: false },
      ],
      ergebnisse: [
        { wenn: ['eins', 'zwei'], ausgabe: [{ text: 'A', treffer: true }], hinweis: 'a' },
        { wenn: ['zwei', 'eins'], ausgabe: [{ text: 'B', treffer: true }], hinweis: 'b' },
      ],
    };
    expect(PipelineProps.safeParse(kaputt).success).toBe(false);
  });

  it('lehnt Ids mit Sonderzeichen ab, die den Schluessel zerlegen wuerden', () => {
    for (const id of ['a+b', 'a b', 'A', '']) {
      const kaputt = {
        ...gueltig,
        schritte: [
          { id, titel: 'A', wirkung: 'x' },
          { id: 'zweiter', titel: 'B', wirkung: 'y' },
        ],
      };
      expect(PipelineProps.safeParse(kaputt).success).toBe(false);
    }
  });

  it('nimmt die real verwendeten Ids an', () => {
    for (const id of ['suche', 'rerank', 'bm25', 'anfrage', 'vektor', 'kontext']) {
      const ok = {
        ...gueltig,
        schritte: [
          { id, titel: 'A', wirkung: 'x' },
          { id: 'zweiter', titel: 'B', wirkung: 'y' },
        ],
        ergebnisse: [{ wenn: [], ausgabe: [{ text: 'A', treffer: false }], hinweis: 'ohne' }],
      };
      expect(PipelineProps.safeParse(ok).success).toBe(true);
    }
  });

  it('lehnt Ids in wenn ab, die den Schluessel zerlegen wuerden', () => {
    // Dieselbe Gefahr wie bei SchrittSchema.id: ein `+` im Eintrag macht
    // ['a+b'] und ['a', 'b'] zum selben Schluessel.
    const kaputt = {
      ...gueltig,
      ergebnisse: [
        { wenn: ['a+b'], ausgabe: [{ text: 'A', treffer: false }], hinweis: 'x' },
      ],
    };
    expect(PipelineProps.safeParse(kaputt).success).toBe(false);
  });

  it('lehnt zwei Ausgabezeilen mit demselben Text ab', () => {
    const kaputt = {
      ...gueltig,
      ergebnisse: [
        {
          wenn: [],
          ausgabe: [
            { text: 'Nachtrag 7', treffer: true },
            { text: 'Nachtrag 7', treffer: false },
          ],
          hinweis: 'x',
        },
      ],
    };
    expect(PipelineProps.safeParse(kaputt).success).toBe(false);
  });

  it('lehnt einen unbekannten Zusatzschluessel ab, statt ihn still zu verwerfen', () => {
    const kaputt = { ...gueltig, erfundenesFeld: 'aus einer Halluzination' };
    expect(PipelineProps.safeParse(kaputt).success).toBe(false);
  });

  it('nimmt einheitPlural an, verlangt es aber nicht', () => {
    expect(PipelineProps.parse(gueltig).einheitPlural).toBeUndefined();

    const mitPlural = PipelineProps.parse({
      ...gueltig,
      einheit: 'Passage',
      einheitPlural: 'Passagen',
    });
    expect(mitPlural.einheitPlural).toBe('Passagen');
  });

  it('lehnt reinen Leerraum als Titel ab', () => {
    const kaputt = {
      ...gueltig,
      schritte: [
        { id: 'eins', titel: '   ', wirkung: 'x' },
        { id: 'zwei', titel: 'B', wirkung: 'y' },
      ],
    };
    expect(PipelineProps.safeParse(kaputt).success).toBe(false);
  });
});

describe('Pipeline-Komponente', () => {
  it('meldet ungültige Parameter, statt still zu scheitern', async () => {
    const { render, screen } = await import('@testing-library/react');
    const { default: Pipeline } = await import('../src/widgets/Pipeline');
    render(<Pipeline schritte={[]} ergebnisse={[]} />);
    expect(screen.getByText(/ungültige Parameter/i)).toBeTruthy();
  });

  it('stolpert nicht über das children-Prop aus der Hydration', async () => {
    // Astro reicht children serverseitig nicht mit, React bei der Hydration
    // schon. Ohne das Verwerfen in Pipeline.tsx weist strictObject es ab und
    // das Widget kippt im Browser in den Fehlerkasten - waehrend Tests, Build
    // und das server-gerenderte HTML unauffaellig bleiben.
    const { render } = await import('@testing-library/react');
    const { default: Pipeline } = await import('../src/widgets/Pipeline');

    // Bewusst gegen `container` gepruft statt gegen `screen`: Weil
    // @testing-library/react hier erst waehrend der Testausfuehrung geladen
    // wird, registriert sich sein afterEach(cleanup) zu spaet - die Hooks der
    // Suite sind da schon eingesammelt. Reste des vorigen Tests bleiben also
    // im document. `container` sieht nur den eigenen Renderbaum.
    const { container } = render(<Pipeline {...gueltig} children={undefined} />);

    expect(container.querySelector('.widget-fehler')).toBeNull();
    expect(container.querySelector('.widget-pipeline')).toBeTruthy();
    expect(container.textContent).toContain('ohne');
  });
});
