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
