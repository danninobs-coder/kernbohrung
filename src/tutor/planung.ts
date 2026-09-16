import { createEmptyCard, fsrs, Rating, type Card, type Grade } from 'ts-fsrs';
import type { Zuversicht } from './typen';

/**
 * Die Terminplanung, gekapselt.
 *
 * ts-fsrs plant mit Standardparametern. Das ist Absicht und keine Luecke:
 * Eine Anpassung der einundzwanzig FSRS-Parameter braucht einige hundert
 * Bewertungen; sie an fuenfzig zu schaetzen waere Ueberanpassung. Die Historie
 * dafuer wird gesammelt (siehe speicher.ts), die Schaetzung kommt, wenn die
 * Datenmenge sie traegt.
 *
 * Ein Planer fuer das ganze Modul, nicht einer je Aufruf: `fsrs()` baut die
 * Parameter und die Strategien jedes Mal neu auf. Der Planer haelt keinen
 * Zustand ueber Aufrufe hinweg — der Zustand steckt in der Karte, die
 * hinein- und wieder herausgeht.
 */

/**
 * Zwei Abweichungen von den Standardwerten, beide gemessen begruendet.
 *
 * `enable_short_term: false` schaltet die Lernschritte im Minutenbereich ab.
 * Mit ihnen graduiert `Hard` auf einer neuen Karte NIE: Sie bleibt auf
 * Lernschritt eins haengen, sechs Minuten, dauerhaft, waehrend die
 * Schwierigkeit auf 9,83 klettert. Wer eine neue Frage raet und trifft, saehe
 * sie alle sechs Minuten wieder. Ohne die Kurzzeitschritte waechst dieselbe
 * Reihe 2, 4, 9, 15, 23, 32, 41, 52, 63, 76 Tage — genau das, was ein
 * Werkzeug fuer Prinzipien braucht. Es ist auch der passendere Takt: Diese App
 * wird in Sitzungen benutzt, nicht im Drill. Niemand will dieselbe Frage sechs
 * Minuten spaeter, sondern morgen.
 *
 * `maximum_interval: 365` deckelt den Ausreisser nach oben. Mit dem Standard
 * von 36 500 Tagen laeuft „immer sicher" ab der siebten Wiederholung in
 * hundert Jahre — die Karte verschwindet nach vier richtigen Antworten
 * endgueltig. Ein Prinzip einmal im Jahr wiederzusehen haelt es am Leben,
 * ohne zu nerven.
 *
 * Der Deckel kostet etwas, und das gehoert hierhin: Ab der fuenften
 * Wiederholung liegen „eher" und „sicher" beide am Deckel, der Abstand
 * zwischen den Zuversichtsstufen verschwindet dort. Das ist vertretbar, weil
 * die Stufen ihre Arbeit in den ersten Wochen leisten — dort stehen 8 gegen
 * 19 gegen 136 Tage. Nach einem Jahr richtiger Abrufe ist ein Prinzip
 * gelernt; der Unterschied zwischen „in einem Jahr" und „in hundert Jahren"
 * ist dann kein Lernsignal mehr, sondern nur die Frage, ob es
 * wiederkommt.
 */
const planer = fsrs({ enable_short_term: false, maximum_interval: 365 });

export function neueKarte(jetzt: Date): Card {
  return createEmptyCard(jetzt);
}

/**
 * Zuversicht und Richtigkeit werden zu einer FSRS-Bewertung.
 *
 * Hier verdient der Zuversichtsknopf sein Geld. Ohne ihn kennt der Planer nur
 * richtig und falsch und muesste jeden Treffer gleich behandeln. Mit ihm
 * unterscheidet er den sicheren Treffer vom geratenen — und der geratene
 * bekommt ein kurzes Intervall, weil Glueck kein Koennen ist.
 *
 * Falsch ist immer Again, unabhaengig von der Zuversicht. Die Zuversicht
 * aendert nichts daran, DASS die Karte zurueckkommt; sie aendert, wie
 * dringend sie im Fehlermuster auftaucht (siehe kalibrierung.ts).
 *
 * Rueckgabetyp ist `Grade`, nicht `Rating`: `Rating` enthaelt zusaetzlich
 * `Rating.Manual`, das `FSRS.next()` nicht annimmt. `Grade` ist genau die
 * Teilmenge der vier echten Bewertungen. Fuer den Aufrufer ist das derselbe
 * Wert — `Grade` schliesst nur den Fall aus, den der Planer ablehnen wuerde.
 */
export function alsBewertung(zuversicht: Zuversicht, richtig: boolean): Grade {
  if (!richtig) return Rating.Again;
  if (zuversicht === 'sicher') return Rating.Easy;
  if (zuversicht === 'eher') return Rating.Good;
  return Rating.Hard;
}

export type Termin = {
  readonly karte: Card;
  readonly faellig: Date;
};

/**
 * Plant den naechsten Termin und gibt die fortgeschriebene Karte zurueck.
 *
 * `jetzt` wird uebergeben und nicht im Modul gelesen. Das ist der Grund, warum
 * diese Datei ohne Zeitattrappe testbar ist: Zweimal derselbe Aufruf mit
 * demselben Zeitpunkt liefert denselben Termin. Die Standardparameter haben
 * `enable_fuzz = false`, es streut also auch nichts nach.
 */
export function naechsterTermin(
  karte: Card,
  zuversicht: Zuversicht,
  richtig: boolean,
  jetzt: Date,
): Termin {
  const ergebnis = planer.next(karte, jetzt, alsBewertung(zuversicht, richtig));
  // `card.due` ist in ts-fsrs 5.4.2 bereits ein echtes Date. Die Kopie ueber
  // getTime() ist trotzdem gewollt: Sonst zeigen `termin.faellig` und
  // `termin.karte.due` auf dasselbe veraenderliche Objekt, und wer an einem
  // dreht, verschiebt unbemerkt das andere.
  return { karte: ergebnis.card, faellig: new Date(ergebnis.card.due.getTime()) };
}
