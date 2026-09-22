import { mischen } from '../../lib/mischen.ts';

/**
 * Die Folge, in der die Schritte anfangs dastehen — als Indizes in `schritte`.
 *
 * Gemischt mit der Aufgaben-Id als Saat: gleiche Aufgabe, gleiche Anfangsfolge,
 * ueber Builds und Geraete hinweg. Ausgeschlossen sind zwei Folgen: die
 * richtige selbst — sonst stuende die Loesung schon da und "Abgeben" waere
 * die ganze Aufgabe — und ihre Umkehrung. Die Umkehrung ist kein Randfall:
 * Die Lektion phnk-2 (inhalt/lektionen/pauschal-heisst-nicht-komplett.mdx)
 * startete vor dieser Korrektur exakt umgekehrt, und wer nur eine einzige
 * Stufe des Ablaufs kennt — den Anfang oder das Ende —, dreht sonst die ganze
 * Liste um und hat sortiert, ohne etwas dazwischen zu wissen.
 *
 * Trifft die erste Mischung eine der beiden verbotenen Folgen, wird NICHT
 * mehr rotiert: Eine Rotation um eine Stelle liesse ab vier Schritten die
 * meisten Positionen unveraendert stehen und waere selbst wieder zu nah an
 * der Loesung. Stattdessen wird mit einer von der Saat abgeleiteten Folgesaat
 * neu gemischt (`${saat}:1`, `${saat}:2`, …) bis zu einer festen
 * Hoechstzahl an Versuchen. Ab drei Schritten (6 Permutationen, davon 2
 * verboten) ist die Wahrscheinlichkeit, alle Versuche zu verfehlen, hoechstens
 * (2/6)^HOECHSTVERSUCHE — praktisch nie. Der feste Ausweich danach vertauscht
 * nur die ersten beiden Schritte der richtigen Folge: Das ist nie die richtige
 * Folge (Stelle 0 weicht ab) und nie ihre Umkehrung (deren Stelle 0 ist
 * `anzahl - 1`, mindestens 2 sobald `anzahl >= 3` — nie 1).
 *
 * Sonderfall zwei Schritte: Dort gibt es nur zwei Folgen ueberhaupt, und die
 * zweite IST die Umkehrung der ersten. Sie mit auszuschliessen liesse keine
 * Folge mehr uebrig — deshalb bleibt sie dort erlaubt, und wie bisher wird
 * nur die richtige Folge ausgeschlossen (die alte Rotation ist fuer zwei
 * Elemente ohnehin nichts anderes als ihr Vertauschen, also die Umkehrung).
 * Das Schema laesst nie weniger als drei Schritte zu (schema.ts, `.min(3)`);
 * dieser Zweig ist reine Verteidigung gegen einen Aufruf ausserhalb der App.
 */
export function startfolge(anzahl: number, saat: string): number[] {
  const identitaet = Array.from({ length: anzahl }, (_, i) => i);

  if (anzahl <= 2) {
    const gemischt = mischen(identitaet, saat);
    const schonRichtig = gemischt.every((wert, i) => wert === i);
    return schonRichtig ? [...gemischt.slice(1), gemischt[0]] : gemischt;
  }

  const umkehrung = [...identitaet].reverse();
  const verboten = (folge: readonly number[]): boolean =>
    folge.every((wert, i) => wert === identitaet[i]) || folge.every((wert, i) => wert === umkehrung[i]);

  const HOECHSTVERSUCHE = 20;
  for (let versuch = 0; versuch < HOECHSTVERSUCHE; versuch++) {
    const kandidat = mischen(identitaet, versuch === 0 ? saat : `${saat}:${versuch}`);
    if (!verboten(kandidat)) return kandidat;
  }

  const ausweich = [...identitaet];
  [ausweich[0], ausweich[1]] = [ausweich[1], ausweich[0]];
  return ausweich;
}
