import { ZUVERSICHT_WERT, type Ereignis, type Zuversicht } from './typen';

/**
 * Wie gut passt die eigene Sicherheit zur eigenen Trefferquote?
 *
 * Die Ueberzeugungsluecke ist der Mittelwert der behaupteten
 * Wahrscheinlichkeiten minus die tatsaechliche Trefferquote. Positiv heisst
 * Selbstueberschaetzung, negativ Unterschaetzung, null heisst kalibriert.
 *
 * Das ist die eine Groesse, die kein anderes Lernwerkzeug misst — und die
 * einzige, die den Unterschied zwischen „hat gelernt" und „glaubt gelernt zu
 * haben" sichtbar macht.
 */

export type StufenBefund = {
  readonly anzahl: number;
  readonly richtig: number;
  /** null, solange die Stufe leer ist — nicht 0, das waere eine Aussage. */
  readonly quote: number | null;
};

export type Kalibrierung = {
  /** false, solange zu wenige Beobachtungen vorliegen. Dann sagt die App nichts. */
  readonly belastbar: boolean;
  readonly luecke: number | null;
  readonly richtung: 'ueberschaetzt' | 'kalibriert' | 'unterschaetzt' | null;
  readonly stufen: Record<Zuversicht, StufenBefund>;
  readonly anzahl: number;
};

/** Darunter gilt eine Luecke als Rauschen, nicht als Befund. */
const NEUTRAL = 0.08;

export function kalibrierung(
  ereignisse: readonly Ereignis[],
  optionen: { mindestens?: number; fenster?: number } = {},
): Kalibrierung {
  const mindestens = optionen.mindestens ?? 12;
  const fenster = optionen.fenster ?? 60;

  // Nur die juengsten Ereignisse: Kalibrierung aendert sich mit Uebung, und
  // ein halbes Jahr alte Selbstueberschaetzung sagt nichts ueber heute.
  const genommen = ereignisse.slice(-fenster);

  const stufen = leereStufen();
  for (const ev of genommen) {
    const s = stufen[ev.zuversicht];
    stufen[ev.zuversicht] = {
      anzahl: s.anzahl + 1,
      richtig: s.richtig + (ev.richtig ? 1 : 0),
      quote: null,
    };
  }
  for (const stufe of Object.keys(stufen) as Zuversicht[]) {
    const s = stufen[stufe];
    stufen[stufe] = { ...s, quote: s.anzahl === 0 ? null : s.richtig / s.anzahl };
  }

  if (genommen.length < mindestens) {
    return { belastbar: false, luecke: null, richtung: null, stufen, anzahl: genommen.length };
  }

  const behauptet = genommen.reduce((n, ev) => n + ZUVERSICHT_WERT[ev.zuversicht], 0) / genommen.length;
  const getroffen = genommen.filter((ev) => ev.richtig).length / genommen.length;
  const luecke = behauptet - getroffen;

  return {
    belastbar: true,
    luecke,
    richtung: luecke > NEUTRAL ? 'ueberschaetzt' : luecke < -NEUTRAL ? 'unterschaetzt' : 'kalibriert',
    stufen,
    anzahl: genommen.length,
  };
}

function leereStufen(): Record<Zuversicht, StufenBefund> {
  const leer: StufenBefund = { anzahl: 0, richtig: 0, quote: null };
  return { sicher: { ...leer }, eher: { ...leer }, geraten: { ...leer } };
}

export type Fehlvorstellung = {
  readonly lektion: string;
  readonly frage: string;
  readonly gewaehlt: string;
  readonly anzahl: number;
};

/**
 * Die gefaehrlichen Faelle: sicher geantwortet und trotzdem daneben.
 *
 * Wer weiss, dass er es nicht weiss, schlaegt nach. Wer sicher ist und
 * danebenliegt, tut es nicht — dort sitzt eine Fehlvorstellung, die von selbst
 * nicht verschwindet. Gruppiert wird nach der GEWAEHLTEN Antwort, nicht nur
 * nach der Frage: Welche Gegenposition jemanden faengt, ist die eigentliche
 * Auskunft.
 */
export function sicherUndFalsch(ereignisse: readonly Ereignis[]): Fehlvorstellung[] {
  const zaehler = new Map<string, Fehlvorstellung>();
  for (const ev of ereignisse) {
    if (ev.zuversicht !== 'sicher' || ev.richtig) continue;
    const schluessel = `${ev.lektion} ${ev.frage} ${ev.gewaehlt}`;
    const bisher = zaehler.get(schluessel);
    zaehler.set(schluessel, {
      lektion: ev.lektion,
      frage: ev.frage,
      gewaehlt: ev.gewaehlt,
      anzahl: (bisher?.anzahl ?? 0) + 1,
    });
  }
  // Der dritte Vergleich ist kein Schoenheitsfehler: Ohne ihn entscheidet bei
  // gleicher Anzahl UND gleicher Frage die Einfuegereihenfolge der Map, und
  // die Landkarte ordnet zwei Fehlvorstellungen je nach Antwortverlauf anders.
  return [...zaehler.values()].sort(
    (a, b) =>
      b.anzahl - a.anzahl ||
      a.frage.localeCompare(b.frage) ||
      a.gewaehlt.localeCompare(b.gewaehlt),
  );
}
