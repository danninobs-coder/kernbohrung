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
