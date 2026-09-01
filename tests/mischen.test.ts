import { describe, it, expect } from 'vitest';
import { mischen } from '../src/lib/mischen';

const liste = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

describe('mischen', () => {
  it('liefert bei gleichem Startwert immer dieselbe Reihenfolge', () => {
    expect(mischen(liste, 'f1')).toEqual(mischen(liste, 'f1'));
  });

  it('liefert bei verschiedenen Startwerten eine andere Reihenfolge', () => {
    expect(mischen(liste, 'f1')).not.toEqual(mischen(liste, 'f2'));
  });

  it('behält alle Elemente genau einmal', () => {
    expect(mischen(liste, 'f1').slice().sort()).toEqual(liste.slice().sort());
  });

  it('verändert die Eingabeliste nicht', () => {
    const original = [...liste];
    mischen(liste, 'f1');
    expect(liste).toEqual(original);
  });

  it('kommt mit leeren Listen und Einzelelementen zurecht', () => {
    expect(mischen([], 'x')).toEqual([]);
    expect(mischen(['a'], 'x')).toEqual(['a']);
  });

  it('mischt reproduzierbar auf eine fest verankerte Reihenfolge', () => {
    // Anker gegen stille Aenderungen an den Konstanten: Eine vertippte Ziffer
    // in xmur3 oder mulberry32 ergibt weiterhin eine gueltige Permutation,
    // nur eine andere. Nur dieser Test wuerde das bemerken.
    expect(mischen(['a', 'b', 'c', 'd'], 'kb-001')).toEqual(['d', 'a', 'b', 'c']);
  });
});
