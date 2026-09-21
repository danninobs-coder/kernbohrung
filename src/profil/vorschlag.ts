import type { Skala } from './items';
import type { Profilstand, Vorlieben } from './schema';

/**
 * Was die App aus dem Profil VORSCHLAEGT. Rein: Die Uhr kommt als Argument
 * herein, der Speicher gar nicht.
 *
 * Vier kleine Dinge, alle von derselben Art — aus einer Tatsache ueber das
 * Profil wird ein Angebot, nie eine Vorschrift:
 * eine Schwachstelle -> ein konkreter Vorschlag,
 * das Alter der Erhebung -> der Hinweis auf eine Wiederholung,
 * kein Profil -> die Einladung auf der Uebersicht,
 * die Vorlieben -> Voreinstellungen (liest erst Teil 3b).
 */

/**
 * Je Skala ein Vorschlag — konkret, klein, an die App gebunden, formuliert als
 * veraenderbare Gewohnheit. Der Wortlaut steht im Spec und wird hier nicht
 * umformuliert; der Test haelt ihn Zeichen fuer Zeichen fest.
 */
export const VORSCHLAG: Readonly<Record<Skala, string>> = {
  ordnen: 'Schreib nach jeder Lektion den Satz des Prinzips in eigenen Worten auf — ein Satz reicht.',
  verknuepfen: 'Nimm dir bei jedem Transfer eine Minute: Wo ist dir das im eigenen Projekt begegnet?',
  abrufen: 'Lass die App fragen, bevor du nachliest. Es fühlt sich schwerer an und wirkt besser.',
  steuern: 'Leg vor der Sitzung fest, was danach sitzen soll — ein Satz reicht. Prüf am Ende selbst, ob er stimmt.',
  dranbleiben: 'Nimm dir fünf Minuten vor, nicht eine Stunde. Kurz und täglich schlägt lang und selten.',
  zeiteinteilen: 'Leg deine Lerntage für die Woche fest, bevor sie anfängt. Ein fester Termin wird eher eingehalten als ein guter Vorsatz.',
};

const TAG_MS = 24 * 60 * 60 * 1000;

/** Acht Wochen. AB diesem Alter lohnt sich eine Wiederholung. */
export const WIEDERHOLUNG_NACH_TAGEN = 56;

/**
 * Ob die Erhebung alt genug ist, dass sich eine Wiederholung lohnt.
 *
 * Muster aendern sich mit Stoff und Uebung — ein Profil von vor einem halben
 * Jahr beschreibt jemanden, den es so nicht mehr gibt. Ein unlesbarer
 * Zeitpunkt ergibt `false`: lieber kein Hinweis als einer ohne Grundlage.
 */
export function wiederholungLohnt(erhoben: string, jetzt: Date): boolean {
  const seit = jetzt.getTime() - new Date(erhoben).getTime();
  return Number.isFinite(seit) && seit >= WIEDERHOLUNG_NACH_TAGEN * TAG_MS;
}

/** So viele Tage bleibt die Einladung weg, nachdem jemand sie auf spaeter verschoben hat. */
export const SPAETER_TAGE = 7;

/**
 * Ob die Uebersicht die Karte „Lernprofil anlegen" zeigt.
 *
 * Das Audit ist ein Angebot. Wer es verschiebt, meint wirklich spaeter: eine
 * Woche Ruhe, dann fragt die Karte noch einmal. `spaeterSeit` ist `unknown`,
 * weil es aus dem Speicher kommt. Alles, was kein Zeitpunkt in der
 * Vergangenheit ist, zaehlt nicht — eine verstellte Uhr soll die Einladung
 * nicht auf Jahre verstecken.
 */
export function einladungZeigen(profilErhoben: boolean, spaeterSeit: unknown, jetzt: Date): boolean {
  if (profilErhoben) return false;
  if (typeof spaeterSeit !== 'string') return true;
  const seit = jetzt.getTime() - new Date(spaeterSeit).getTime();
  if (!Number.isFinite(seit) || seit < 0) return true;
  return seit >= SPAETER_TAGE * TAG_MS;
}

/** Was gilt, solange niemand etwas anderes gesagt hat. */
export const NEUTRALE_VORLIEBEN: Vorlieben = { einstieg: 'egal', minuten: 10, text: 'egal' };

/**
 * Profil -> Voreinstellungen.
 *
 * Heute liest das niemand: Was eine Vorliebe verstellt, entscheidet Teil 3b,
 * sobald es die Sitzungsseite gibt. Die Funktion steht trotzdem schon hier,
 * damit es dann EINE Stelle gibt, die sagt, was ohne Profil gilt — und nicht
 * drei Seiten, die je ihren eigenen Ersatzwert erfinden. Was „egal" bedeutet,
 * bleibt bewusst offen; das ist eine Frage der Abwechslung, nicht des Profils.
 */
export function voreinstellungen(stand: Profilstand | null): Vorlieben {
  return stand === null ? NEUTRALE_VORLIEBEN : stand.vorlieben;
}
