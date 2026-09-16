import { describe, it, expect } from 'vitest';
import { kalibrierung, sicherUndFalsch } from '../src/tutor/kalibrierung';
import type { Ereignis } from '../src/tutor/typen';

function e(zuversicht: Ereignis['zuversicht'], richtig: boolean, frage = 'f1', gewaehlt = 'x'): Ereignis {
  return { lektion: 'l', frage, zuversicht, richtig, gewaehlt, dauerMs: 1000, zeitpunkt: '2026-09-16T10:00:00Z' };
}

describe('kalibrierung', () => {
  it('meldet bei leerer Historie kein Urteil', () => {
    const k = kalibrierung([]);
    expect(k.belastbar).toBe(false);
    expect(k.luecke).toBeNull();
  });

  it('nennt eine Überzeugungslücke von null bei perfekter Passung', () => {
    // 10x sicher (0,9) mit 9 richtig -> 0,9 behauptet, 0,9 getroffen
    const ereignisse = [
      ...Array.from({ length: 9 }, () => e('sicher', true)),
      e('sicher', false),
    ];
    const k = kalibrierung(ereignisse, { mindestens: 10 });
    expect(k.belastbar).toBe(true);
    expect(k.luecke).toBeCloseTo(0, 2);
  });

  it('erkennt Selbstüberschätzung als positive Lücke', () => {
    const ereignisse = Array.from({ length: 10 }, (_, i) => e('sicher', i < 5));
    const k = kalibrierung(ereignisse, { mindestens: 10 });
    expect(k.luecke).toBeCloseTo(0.4, 2);
    expect(k.richtung).toBe('ueberschaetzt');
  });

  it('erkennt Unterschätzung als negative Lücke', () => {
    const ereignisse = Array.from({ length: 10 }, () => e('geraten', true));
    const k = kalibrierung(ereignisse, { mindestens: 10 });
    expect(k.luecke).toBeCloseTo(-0.7, 2);
    expect(k.richtung).toBe('unterschaetzt');
  });

  it('gibt je Stufe die beobachtete Trefferquote zurück', () => {
    const ereignisse = [
      e('sicher', true), e('sicher', true), e('sicher', false), e('sicher', true),
      e('geraten', false), e('geraten', true),
    ];
    const k = kalibrierung(ereignisse, { mindestens: 1 });
    expect(k.stufen.sicher).toEqual({ anzahl: 4, richtig: 3, quote: 0.75 });
    expect(k.stufen.geraten).toEqual({ anzahl: 2, richtig: 1, quote: 0.5 });
    expect(k.stufen.eher).toEqual({ anzahl: 0, richtig: 0, quote: null });
  });

  it('haelt sich an das Fenster und ignoriert Älteres', () => {
    const alt = Array.from({ length: 20 }, () => e('sicher', false));
    const neu = Array.from({ length: 10 }, () => e('sicher', true));
    const k = kalibrierung([...alt, ...neu], { mindestens: 5, fenster: 10 });
    expect(k.stufen.sicher.anzahl).toBe(10);
    expect(k.luecke).toBeCloseTo(-0.1, 2);
  });

  it('nennt eine Lücke unterhalb der Rauschschwelle kalibriert, in beide Richtungen', () => {
    // Ohne diesen Test ist NEUTRAL wirkungslos: Alle übrigen Lücken liegen weit
    // jenseits der Schwelle, eine auf null gesetzte Schwelle fiele nicht auf.
    // Dann aber gälte jede Zufallsschwankung als Befund — und die App spräche
    // von Selbstüberschätzung, wo sie nichts gemessen hat.
    const eher = (richtige: number) => Array.from({ length: 20 }, (_, i) => e('eher', i < richtige));
    expect(kalibrierung(eher(12)).richtung).toBe('kalibriert'); // 0,65 - 0,60 = +0,05
    expect(kalibrierung(eher(14)).richtung).toBe('kalibriert'); // 0,65 - 0,70 = -0,05
    expect(kalibrierung(eher(11)).richtung).toBe('ueberschaetzt'); // 0,65 - 0,55 = +0,10
  });

  it('ist ab genau der Mindestzahl belastbar, eine Antwort darunter nicht', () => {
    const drei = Array.from({ length: 3 }, () => e('sicher', true));
    expect(kalibrierung(drei, { mindestens: 4 }).belastbar).toBe(false);
    expect(kalibrierung([...drei, e('sicher', true)], { mindestens: 4 }).belastbar).toBe(true);
  });

  it('bleibt unbelastbar, wenn das Fenster kleiner ist als die Mindestzahl', () => {
    // Eine Falle für den Aufrufer: Diese Kombination kann nie belastbar werden,
    // egal wie viel beantwortet wird. Das Verhalten ist hier festgehalten, damit
    // es auffällt, statt als stiller Dauerzustand „noch zu wenige Daten".
    const viele = Array.from({ length: 40 }, () => e('sicher', true));
    const k = kalibrierung(viele, { mindestens: 12, fenster: 5 });
    expect(k.belastbar).toBe(false);
    expect(k.luecke).toBeNull();
    // Die Stufen werden trotzdem gezählt — die Balken der Landkarte brauchen sie.
    expect(k.anzahl).toBe(5);
    expect(k.stufen.sicher).toEqual({ anzahl: 5, richtig: 5, quote: 1 });
  });

  it('lässt unberührte Stufen leer, wenn alles in einer Stufe liegt', () => {
    // quote bleibt null, nicht 0: 0 hiesse „nie getroffen", null heisst „nie
    // gefragt". Auf der Landkarte ist das der Unterschied zwischen einem Balken
    // am Boden und gar keinem Balken.
    const ereignisse = Array.from({ length: 12 }, (_, i) => e('eher', i < 9));
    const k = kalibrierung(ereignisse);
    expect(k.belastbar).toBe(true);
    expect(k.stufen.eher).toEqual({ anzahl: 12, richtig: 9, quote: 0.75 });
    expect(k.stufen.sicher).toEqual({ anzahl: 0, richtig: 0, quote: null });
    expect(k.stufen.geraten).toEqual({ anzahl: 0, richtig: 0, quote: null });
    expect(k.luecke).toBeCloseTo(-0.1, 2);
    expect(k.richtung).toBe('unterschaetzt');
  });
});

describe('sicherUndFalsch', () => {
  it('findet die gefährlichen Fälle: sicher und trotzdem daneben', () => {
    const ereignisse = [
      e('sicher', false, 'f1', 'Reranker dahinter'),
      e('geraten', false, 'f2', 'irgendwas'),
      e('sicher', true, 'f3', 'richtig'),
      e('sicher', false, 'f1', 'Reranker dahinter'),
    ];
    const treffer = sicherUndFalsch(ereignisse);
    expect(treffer).toHaveLength(1);
    expect(treffer[0]).toMatchObject({ frage: 'f1', gewaehlt: 'Reranker dahinter', anzahl: 2 });
  });

  it('gibt nichts zurück, wenn niemand sicher danebenlag', () => {
    expect(sicherUndFalsch([e('geraten', false), e('sicher', true)])).toEqual([]);
  });

  it('sortiert nach Häufigkeit, die hartnäckigste zuerst', () => {
    const ereignisse = [
      e('sicher', false, 'f1', 'a'),
      e('sicher', false, 'f2', 'b'), e('sicher', false, 'f2', 'b'), e('sicher', false, 'f2', 'b'),
    ];
    expect(sicherUndFalsch(ereignisse).map((t) => t.frage)).toEqual(['f2', 'f1']);
  });

  it('trennt zwei verschiedene falsche Antworten auf dieselbe Frage', () => {
    // Der eigentliche Zweck der Gruppierung: nicht DASS jemand bei f1 sicher
    // danebenlag, sondern WELCHE Gegenposition ihn fängt. Wer nur nach der Frage
    // gruppiert, addiert zwei verschiedene Fehlvorstellungen zu einer Zahl und
    // verliert genau die Auskunft, für die `gewaehlt` überhaupt erhoben wird.
    const ereignisse = [
      e('sicher', false, 'f1', 'Reranker dahinter'),
      e('sicher', false, 'f1', 'Reranker dahinter'),
      e('sicher', false, 'f1', 'Chunks kleiner schneiden'),
    ];
    const treffer = sicherUndFalsch(ereignisse);
    expect(treffer).toHaveLength(2);
    expect(treffer.map((t) => [t.gewaehlt, t.anzahl])).toEqual([
      ['Reranker dahinter', 2],
      ['Chunks kleiner schneiden', 1],
    ]);
  });

  it('ordnet gleich häufige Fehlvorstellungen derselben Frage fest', () => {
    // Ohne dritten Vergleich entscheidet die Einfuegereihenfolge der Map. Die
    // beiden Faelle kommen hier in umgekehrter Reihenfolge herein und muessen
    // trotzdem gleich herauskommen.
    const vorwaerts = sicherUndFalsch([
      e('sicher', false, 'f1', 'Zebra'),
      e('sicher', false, 'f1', 'Anker'),
    ]);
    const rueckwaerts = sicherUndFalsch([
      e('sicher', false, 'f1', 'Anker'),
      e('sicher', false, 'f1', 'Zebra'),
    ]);
    expect(vorwaerts.map((t) => t.gewaehlt)).toEqual(['Anker', 'Zebra']);
    expect(rueckwaerts.map((t) => t.gewaehlt)).toEqual(['Anker', 'Zebra']);
  });
});
