/** xmur3: String zu 32-Bit-Startwert. */
function startwert(text: string): number {
  let h = 1779033703 ^ text.length;
  for (let i = 0; i < text.length; i++) {
    h = Math.imul(h ^ text.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h ^= h >>> 16;
  return h >>> 0;
}

/** mulberry32: kleiner, schneller Pseudozufallsgenerator. */
function generator(saat: number): () => number {
  let a = saat;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Fisher-Yates mit festem Startwert. Gleiche Liste plus gleicher Startwert
 * ergibt immer dieselbe Reihenfolge. Die Eingabe bleibt unberührt.
 */
export function mischen<T>(liste: readonly T[], saat: string): T[] {
  const kopie = [...liste];
  const naechste = generator(startwert(saat));
  for (let i = kopie.length - 1; i > 0; i--) {
    const j = Math.floor(naechste() * (i + 1));
    [kopie[i], kopie[j]] = [kopie[j], kopie[i]];
  }
  return kopie;
}
