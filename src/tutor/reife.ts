import type { Ereignis, Reife } from './typen';

/**
 * Der Zustand eines Prinzips, wie ihn die Landkarte zeigt.
 *
 * Die interessante Stufe ist `wackelt`. Sie trennt zwei Gruende, die andere
 * Wiederholungswerkzeuge in einen Topf werfen: „muss wiederholt werden, weil
 * Zeit vergangen ist" gegen „muss wiederholt werden, weil da eine
 * Fehlvorstellung sitzt". Die zweite ist dringender, und nur die zweite
 * verschwindet nicht von selbst.
 *
 * Wie in `planung.ts` kommt `jetzt` von aussen herein und wird nicht im Modul
 * gelesen. Das ist die Bedingung dafuer, dass diese Datei ohne Zeitattrappe
 * testbar ist.
 */

export type Frageverlauf = {
  /** Chronologisch, aelteste Antwort zuerst. */
  readonly ereignisse: readonly Ereignis[];
  /** Der FSRS-Termin. `null`, solange keine Karte existiert. */
  readonly faellig: Date | null;
};

/**
 * So viele Treffer braucht es, um eine Fehlvorstellung als ueberwunden zu
 * gelten — die Entwurfsfrage, die der Plan offen liess.
 *
 * Die Antwort ist zwei, nicht eins, und zwar aus drei Gruenden.
 *
 * Erstens raet man bei vier Antwortmoeglichkeiten in einem von vier Faellen
 * richtig. Ein einzelner Treffer nach einem sicheren Fehlgriff ist damit noch
 * kein Beleg, dass sich etwas geaendert hat.
 *
 * Zweitens zeigt diese App unmittelbar nach der Antwort die Begruendung an.
 * Der naechstfolgende Versuch derselben Frage laeuft also gegen einen frisch
 * gelesenen Text, nicht gegen das Gedaechtnis. Genau dort ist ein Treffer am
 * wenigsten wert.
 *
 * Drittens ist der Fehler asymmetrisch teuer. Eine Frage einmal zu oft zu
 * stellen kostet eine Minute. Eine Fehlvorstellung zu frueh abzuhaken heisst,
 * dass sie unbemerkt stehen bleibt — und `wackelt` existiert allein, um genau
 * das zu verhindern.
 *
 * Gezaehlt werden nur Treffer NACH dem letzten sicheren Fehlgriff. Treffer
 * davor sind kein Gegenbeweis, sondern der Grund, warum die Zuversicht
 * ueberhaupt auf „sicher" stand.
 */
export const RICHTIGE_GEGEN_FEHLVORSTELLUNG = 2;

export function reife(verlauf: Frageverlauf, jetzt: Date): Reife {
  const { ereignisse, faellig } = verlauf;

  if (ereignisse.length === 0) return 'unberuehrt';

  // Die Reihenfolge der Pruefungen IST die Rangfolge der Dringlichkeit.
  // `wackelt` steht vor `verblasst`, weil eine Fehlvorstellung nicht dadurch
  // weggeht, dass ihr Termin noch nicht erreicht ist.
  if (wackelt(ereignisse)) return 'wackelt';

  // `<=` und nicht `<`: Im Moment der Faelligkeit steht die Karte an. Ein `<`
  // liesse sie in genau diesem Moment durch die Auswahl fallen.
  if (faellig !== null && faellig.getTime() <= jetzt.getTime()) return 'verblasst';

  const richtige = ereignisse.filter((ev) => ev.richtig).length;
  const letzte = ereignisse[ereignisse.length - 1];
  if (richtige >= 2 && letzte?.richtig === true) return 'sitzt';

  // Beantwortet, aber noch keine Wiederholung ueberstanden. Ein einziger
  // Treffer sagt nichts darueber, ob es morgen noch da ist.
  return 'frisch';
}

/**
 * Zwei Ursachen, eine Stufe.
 *
 * Die erste ist die offensichtliche: Die letzte Antwort war falsch.
 *
 * Die zweite ist die, um derentwillen es diese Stufe gibt: Wer sicher war und
 * danebenlag, hat kein Wissensloch, sondern ein falsches Modell. Wer weiss,
 * dass er es nicht weiss, schlaegt nach; wer sicher ist, tut es nicht. Deshalb
 * zaehlt `geraten` und falsch hier nicht mit — das ist eine Luecke, und die
 * schliesst eine richtige Antwort.
 */
function wackelt(ereignisse: readonly Ereignis[]): boolean {
  const letzte = ereignisse[ereignisse.length - 1];
  if (letzte !== undefined && !letzte.richtig) return true;

  const letzterFehlgriff = letzterIndexSicherUndFalsch(ereignisse);
  if (letzterFehlgriff === -1) return false;

  const seither = ereignisse.slice(letzterFehlgriff + 1).filter((ev) => ev.richtig).length;
  return seither < RICHTIGE_GEGEN_FEHLVORSTELLUNG;
}

function letzterIndexSicherUndFalsch(ereignisse: readonly Ereignis[]): number {
  for (let i = ereignisse.length - 1; i >= 0; i--) {
    const ev = ereignisse[i];
    if (ev !== undefined && ev.zuversicht === 'sicher' && !ev.richtig) return i;
  }
  return -1;
}

/**
 * Aus vier Fragestufen wird eine Prinzipstufe.
 *
 * Die Landkarte zeigt Prinzipien, der Fortschritt haengt an Fragen. Die Regel
 * ist bewusst pessimistisch: Ein Prinzip ist so reif wie seine schwaechste
 * Frage. Ein Prinzip „sitzt" zu nennen, waehrend eine seiner vier Fragen
 * wackelt, waere genau die Beschoenigung, gegen die dieses ganze Modul
 * gebaut ist.
 *
 * Zwei Sonderfaelle sind der Grund, warum das kein blosses Maximum ueber eine
 * Rangliste ist: `unberuehrt` gilt nur, wenn noch KEINE Frage beantwortet
 * wurde — sonst behauptete die Landkarte „noch nie angefasst" ueber ein
 * Prinzip mit drei sitzenden Fragen. Umgekehrt bleibt ein Prinzip mit einer
 * offenen Frage `frisch` und wird nicht `sitzt`.
 */
export function reifeDesPrinzips(stufen: readonly Reife[]): Reife {
  if (stufen.length === 0) return 'unberuehrt';
  if (stufen.every((s) => s === 'unberuehrt')) return 'unberuehrt';
  if (stufen.includes('wackelt')) return 'wackelt';
  if (stufen.includes('verblasst')) return 'verblasst';
  if (stufen.includes('frisch') || stufen.includes('unberuehrt')) return 'frisch';
  return 'sitzt';
}
