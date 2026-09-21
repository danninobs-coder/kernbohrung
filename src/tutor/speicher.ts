import {
  openDB,
  type DBSchema,
  type IDBPDatabase,
  type IDBPTransaction,
  type StoreNames,
} from 'idb';
import type { Card } from 'ts-fsrs';
import type { Termin } from './planung';
import type { Ereignis, Zuversicht } from './typen';

/**
 * Die Speicherschicht. Die einzige Datei im Tutor mit Nebenwirkungen.
 *
 * Drei Speicher in einer IndexedDB-Datenbank. `ereignisse` haengt nur an und
 * wird nie geaendert — er ist der Rohstoff, aus dem `kalibrierung.ts`,
 * `reife.ts` und `auswahl.ts` alles Weitere rechnen. `karten` haelt je Frage
 * den FSRS-Zustand; das ist abgeleiteter Zustand und liesse sich aus den
 * Ereignissen neu berechnen. `einstellungen` haelt den Modus hell/dunkel und
 * spaeter die eigenen FSRS-Parameter.
 *
 * Zwei Regeln bestimmen den ganzen Bau.
 *
 * ERSTENS: Kein Zugriff darf werfen. Im privaten Fenster, bei geloeschten
 * Websitedaten und bei abgeschaltetem Speicher wirft schon das Oeffnen — bei
 * fehlendem `indexedDB` sogar synchron, noch bevor ein Promise entsteht
 * (`openDB` ruft `indexedDB.open` in der ersten Zeile auf). Jede Lesefunktion
 * liefert dann einen brauchbaren leeren Wert, jede Schreibfunktion `false`.
 * Die Seite rendert ohne gespeicherten Zustand richtig, statt mit einem
 * weissen Bildschirm zu enden. Das ist kein Randfall: Es ist der erste
 * Eindruck fuer jeden, der die App im privaten Fenster ausprobiert.
 *
 * ZWEITENS: `alsJson()` ist von Anfang an dabei und nicht nachgereicht. Ohne
 * die vollstaendige Historie ist die spaetere FSRS-Parameterschaetzung
 * unmoeglich — und die Daten gehoeren der lernenden Person, nicht dem
 * Browserprofil, aus dem sie beim naechsten Aufraeumen verschwinden.
 */

/** Ein `Kartenstand`, wie ihn die Oberflaeche und `auswahl.ts` brauchen. */
export type Kartenstand = {
  readonly lektion: string;
  readonly frage: string;
  readonly karte: Card;
  /**
   * Abgeleitet aus `karte.due`, nicht danebengespeichert.
   *
   * Zwei Felder mit derselben Aussage driften irgendwann auseinander, und dann
   * gibt es zwei Wahrheiten darueber, wann eine Frage ansteht. Die Kopie ueber
   * `getTime()` ist derselbe Schutz wie in `planung.ts`: Wer an `faellig`
   * dreht, verschiebt sonst unbemerkt die Karte.
   */
  readonly faellig: Date;
};

/**
 * Was im Speicher liegt. Absichtlich schmaler als `Kartenstand`.
 *
 * Nur `karte` wird geschrieben, `faellig` nicht — siehe oben.
 */
type Kartensatz = {
  readonly lektion: string;
  readonly frage: string;
  readonly karte: Card;
};

interface TutorDb extends DBSchema {
  ereignisse: { key: number; value: Ereignis };
  karten: { key: [string, string]; value: Kartensatz };
  einstellungen: { key: string; value: unknown };
}

export const DATENBANK = 'kernbohrung-tutor';

type Umbau = IDBPTransaction<TutorDb, StoreNames<TutorDb>[], 'versionchange'>;

/** Ein Schritt der Schemafortschreibung. Fassung n ist der n-te Eintrag. */
export type Schritt = (datenbank: IDBPDatabase<TutorDb>, umbau: Umbau) => void;

/**
 * Die Leiter, nicht ein `switch` ueber Fassungsnummern.
 *
 * Ein Speicher, der nur die heutige Fassung kennt, verliert beim ersten
 * Feldwechsel Daten. Deshalb steht hier eine Liste: Ein neues Feld heisst, ein
 * Schritt kommt ans Ende — die Fassungsnummer ist dann die Laenge der Liste
 * und niemand muss sie von Hand hochzaehlen und dabei vergessen.
 *
 * Der Aufstieg laeuft genau die Schritte zwischen alter und neuer Fassung.
 * Wer von 0 auf 2 kommt, laeuft dieselben zwei Schritte wie jemand, der
 * einzeln von 0 auf 1 und spaeter von 1 auf 2 aufgestiegen ist. Das ist die
 * Bedingung dafuer, dass ein halbes Jahr alter Bestand ankommt: Jeder Schritt
 * muss additiv sein. `deleteObjectStore` oder ein Speicher, der geloescht und
 * neu angelegt wird, waere genau der Datenverlust, gegen den diese Liste
 * gebaut ist.
 */
/** Ein Ereignis, wie es Fassung 1 geschrieben hat. Nur fuer den Aufstieg. */
export type EreignisV1 = {
  readonly lektion: string;
  readonly frage: string;
  readonly zuversicht: Zuversicht;
  readonly richtig: boolean;
  readonly gewaehlt: string;
  readonly dauerMs: number;
  readonly zeitpunkt: string;
};

/**
 * Hebt ein Ereignis aus Fassung 1 in die heutige Form.
 *
 * Bis zur Aufgabenfamilie gab es nur Wahlfragen: `typ` ist also 'wahl', der
 * Anteil folgt aus `richtig`, und das Merkmal ist der gewaehlte Text, wenn er
 * falsch war. Ein Satz, der schon `typ` traegt, bleibt unveraendert — der
 * Schritt ist damit wiederholbar.
 */
export function hebeAufV2(satz: Ereignis | EreignisV1): Ereignis {
  if ('typ' in satz) return satz;
  const { gewaehlt, ...rest } = satz;
  return {
    ...rest,
    typ: 'wahl',
    anteil: satz.richtig ? 1 : 0,
    antwort: gewaehlt,
    merkmal: satz.richtig ? '' : gewaehlt,
  };
}

export const SCHRITTE: readonly Schritt[] = [
  // Fassung 1: die drei Speicher.
  (datenbank) => {
    // Fortlaufende Zahl als Schluessel, ohne Schluesselpfad. Damit bleibt der
    // gespeicherte Wert ein reines `Ereignis` ohne eingespritzte Kennung — und
    // `getAll()` liefert die Ereignisse in Schluesselreihenfolge, also in
    // Einfuegereihenfolge. Genau die brauchen `reife.ts` und `auswahl.ts`.
    datenbank.createObjectStore('ereignisse', { autoIncrement: true });

    // Zusammengesetzter Schluessel statt einer selbstgebauten Zeichenkette:
    // IndexedDB kann Arrays als Schluessel, und damit stellt sich die Frage
    // nach einem Trennzeichen hier gar nicht erst. `auswahl.ts` braucht dafuer
    // ein NUL, weil eine Map nur Zeichenketten kann; dieser Speicher nicht.
    datenbank.createObjectStore('karten', { keyPath: ['lektion', 'frage'] });

    // Schluessel von aussen, Werte beliebig: heute eine Zeichenkette fuer den
    // Modus, spaeter einundzwanzig Zahlen fuer die FSRS-Parameter.
    datenbank.createObjectStore('einstellungen');
  },

  // Fassung 2: Ereignisse tragen den Aufgabentyp (siehe `hebeAufV2`).
  //
  // Additiv wie verlangt: kein Speicher wird geloescht oder neu angelegt, jeder
  // Satz wird an Ort und Stelle fortgeschrieben. Gewartet wird ausschliesslich
  // auf IndexedDB-Anfragen — ein anderes `await` hier liesse die
  // Umbau-Transaktion schliessen, bevor der Zeiger durch ist.
  (_datenbank, umbau) => {
    const ablage = umbau.objectStore('ereignisse');
    const hebeAlle = async (): Promise<void> => {
      let zeiger = await ablage.openCursor();
      while (zeiger) {
        await zeiger.update(hebeAufV2(zeiger.value as Ereignis | EreignisV1));
        zeiger = await zeiger.continue();
      }
    };
    void hebeAlle().catch((fehler) => {
      melde('Aufstieg auf Fassung 2', fehler);
      try {
        umbau.abort();
      } catch {
        // Schon abgebrochen. Das Oeffnen scheitert dann, und die Seite laeuft
        // im speicherlosen Notbetrieb — mit unveraendertem Bestand.
      }
    });
    // `idb` legt fuer jede Transaktion ein `done`-Versprechen an, sobald sie
    // gewrappt wird — auch wenn niemand danach fragt. Bricht die Transaktion
    // ab, lehnt dieses Versprechen ab, und ohne einen Abnehmer meldet die
    // Laufzeitumgebung eine unbehandelte Ablehnung, obwohl der Abbruch hier
    // gewollt ist und schon oben gemeldet wurde. Der leere Fang nimmt nur
    // dieses zweite, ungefragte Echo entgegen.
    umbau.done.catch(() => {});
  },
];

/** Die aktuelle Fassung — abgeleitet, damit sie nicht danebenlaufen kann. */
export const FASSUNG = SCHRITTE.length;

/**
 * Der Zugang zur Datenbank, als Funktion.
 *
 * Das ist die Naht, an der die Tests ansetzen. `speicher()` kennt nur diese
 * eine Funktion und nicht `openDB`. Ein Test ersetzt sie durch eine, die
 * wirft, und prueft damit genau den Fall, der im Browser am schwersten
 * herzustellen und im Betrieb am teuersten ist.
 */
export type Oeffner = () => Promise<IDBPDatabase<TutorDb>>;

export function idbOeffner(
  name: string = DATENBANK,
  schritte: readonly Schritt[] = SCHRITTE,
): Oeffner {
  return async () => {
    const datenbank = await openDB<TutorDb>(name, schritte.length, {
      upgrade(db, alteFassung, neueFassung, umbau) {
        for (let i = alteFassung; i < (neueFassung ?? schritte.length); i++) {
          schritte[i]?.(db, umbau);
        }
      },
    });

    // Ein anderer Tab will auf eine neue Fassung aufsteigen und wird von
    // DIESER Verbindung blockiert. Wer hier nichts tut, laesst den anderen Tab
    // unbegrenzt haengen — `openDB` loest dort weder auf noch ab. Diese
    // Verbindung ist danach tot; die Seite holt sich beim naechsten Laden eine
    // neue, und bis dahin laeuft sie im speicherlosen Notbetrieb weiter.
    datenbank.addEventListener('versionchange', () => datenbank.close());

    return datenbank;
  };
}

/** Der vollstaendige Auszug, wie ihn `alsJson()` ausgibt. */
export type Ausfuhr = {
  readonly fassung: number;
  readonly erzeugt: string;
  readonly ereignisse: readonly Ereignis[];
  readonly karten: readonly Kartensatz[];
  readonly einstellungen: Readonly<Record<string, unknown>>;
};

export type Speicher = {
  /** Haengt an. Gibt zurueck, ob es wirklich gespeichert wurde. */
  merkeEreignis(ereignis: Ereignis): Promise<boolean>;
  /** Chronologisch, aelteste zuerst. Leer, wenn kein Speicher da ist. */
  ereignisse(): Promise<readonly Ereignis[]>;
  merkeKarte(lektion: string, frage: string, termin: Termin): Promise<boolean>;
  karte(lektion: string, frage: string): Promise<Card | null>;
  karten(): Promise<readonly Kartenstand[]>;
  /**
   * Der rohe Wert. Der Aufrufer prueft ihn.
   *
   * Ein `as string` hier waere eine Behauptung ueber eine Datei auf einer
   * fremden Festplatte, geschrieben womoeglich von einer aelteren Fassung
   * dieser App. `undefined`, wenn nichts da ist oder nichts gelesen werden
   * konnte — der Unterschied steht in der Konsole.
   */
  einstellung(schluessel: string): Promise<unknown>;
  merkeEinstellung(schluessel: string, wert: unknown): Promise<boolean>;
  /** Die gesamte Historie als JSON-Text, fertig zum Herunterladen. */
  alsJson(jetzt?: Date): Promise<string>;
  /** Schliesst die Verbindung. Der naechste Zugriff oeffnet neu. */
  schliessen(): Promise<void>;
};

const LEERE_AUSFUHR = {
  ereignisse: [] as readonly Ereignis[],
  karten: [] as readonly Kartensatz[],
  einstellungen: {} as Readonly<Record<string, unknown>>,
};

/**
 * Wie viel Platz das kostet — gemessen, nicht geschaetzt.
 *
 * Ein Wahl-Ereignis mit den echten Texten dieser App: als JSON 221 Byte bei
 * einem Treffer und 252 bei einem Fehlgriff, weil `merkmal` dann den
 * gewaehlten Text wiederholt. Mit Schluessel und Satzkopf der Datenbank rund
 * 300 Byte, auf der Platte etwa das Doppelte.
 *
 * Die anderen Typen sind groesser, und das ist gewollt: `antwort` haelt fest,
 * was jemand getan hat. Bei `zuordnen` sind das alle Paare (bis rund 1,5 kB),
 * bei `fall` der geschriebene Text — gemessen rund 6,2 kB im teuersten Fall:
 * 2 000 Zeichen, jedes davon ein dreibytiges Zeichen (UTF-8, ausserhalb der
 * ersten 2048 Codepunkte, etwa '€'). `maxLength` zaehlt UTF-16-Einheiten,
 * nicht Byte — drei Byte je Einheit ist das teuerste Verhaeltnis, das eine
 * einzelne Einheit erreichen kann. Die Schranken je Typ stehen in
 * `tests/speicher.test.ts`.
 *
 * Hochgerechnet: 10 000 Wahl-Ereignisse liegen bei rund 6 MB (10 000 × 600
 * Byte), 10 000 Faelle bei rund 62 MB (10 000 × 6500 Byte) — beide mit
 * Reserve unter den Budgets aus `tests/speicher.test.ts` (8 MB bzw. 80 MB).
 * Chrome raeumt einem Ursprung rund sechzig Prozent des freien Plattenplatzes
 * ein, Firefox zehn. 10 000 Bewertungen sind bei taeglich zwanzig Antworten
 * die Ernte von anderthalb Jahren. Es wird nicht eng.
 */
export function speicher(oeffnen: Oeffner = idbOeffner()): Speicher {
  /**
   * Einmal oeffnen, nicht je Zugriff — und den Fehlschlag merken.
   *
   * `null` heisst „es gibt keinen Speicher". Der Wert bleibt stehen: Wenn das
   * Oeffnen im privaten Fenster einmal scheitert, scheitert es auch beim
   * zweihundertsten Versuch. Ohne das Merken haette jede Antwort in der
   * Sitzung eine eigene Warnung in der Konsole hinterlassen.
   */
  let verbindung: Promise<IDBPDatabase<TutorDb> | null> | null = null;

  async function verbinde(): Promise<IDBPDatabase<TutorDb> | null> {
    // Die `async`-Funktion ist hier der Punkt und keine Gewohnheit: Sie macht
    // aus einem SYNCHRONEN Wurf von `oeffnen()` eine abgelehnte Zusage, die
    // dieses `catch` faengt. `oeffnen().catch(...)` taete das nicht — ohne
    // `indexedDB` wirft `openDB` schon vor dem ersten Promise.
    try {
      return await oeffnen();
    } catch (fehler) {
      melde('Oeffnen', fehler);
      return null;
    }
  }

  function datenbank(): Promise<IDBPDatabase<TutorDb> | null> {
    verbindung ??= verbinde();
    return verbindung;
  }

  async function lies<T>(
    was: string,
    ersatz: T,
    arbeit: (db: IDBPDatabase<TutorDb>) => Promise<T>,
  ): Promise<T> {
    const db = await datenbank();
    if (db === null) return ersatz;
    try {
      return await arbeit(db);
    } catch (fehler) {
      melde(was, fehler);
      return ersatz;
    }
  }

  async function schreibe(
    was: string,
    arbeit: (db: IDBPDatabase<TutorDb>) => Promise<unknown>,
  ): Promise<boolean> {
    const db = await datenbank();
    if (db === null) return false;
    try {
      await arbeit(db);
      return true;
    } catch (fehler) {
      melde(was, fehler);
      return false;
    }
  }

  return {
    merkeEreignis(ereignis) {
      // `add` und nicht `put`: Dieser Speicher haengt an. `put` koennte einen
      // bestehenden Satz ueberschreiben, und genau das darf hier nie passieren.
      return schreibe('merkeEreignis', (db) => db.add('ereignisse', ereignis));
    },

    ereignisse() {
      // Keine Sortierung nach `zeitpunkt`. Die Schluesselreihenfolge ist die
      // Einfuegereihenfolge und damit die Wahrheit; eine Uhr, die wegen
      // Zeitzone oder Zeitabgleich zurueckspringt, wuerde die Historie sonst
      // umstellen — und `reife.ts` liest „die letzte Antwort" schlicht als
      // letztes Element.
      //
      // Der Sicherheitsgurt: `.map(hebeAufV2)` hebt jeden gelesenen Satz, auch
      // wenn er das nicht braeuchte. Nach Spezifikation ist die Umbau-
      // Transaktion aus Schritt 2 atomar, ein Bestand aus halb gehobenen und
      // halb alten Saetzen also unerreichbar — der Gurt kostet trotzdem nur
      // eine Zeile und schuetzt vor Browsern, die sich nicht daran halten. Es
      // geht um Lerndaten.
      return lies('ereignisse', [] as readonly Ereignis[], async (db) => {
        const saetze = (await db.getAll('ereignisse')) as (Ereignis | EreignisV1)[];
        return saetze.map(hebeAufV2);
      });
    },

    merkeKarte(lektion, frage, termin) {
      // `put` und nicht `add`: Eine Karte wird bei jeder Antwort fortgeschrieben.
      return schreibe('merkeKarte', (db) =>
        db.put('karten', { lektion, frage, karte: termin.karte }),
      );
    },

    async karte(lektion, frage) {
      const satz = await lies('karte', undefined, (db) => db.get('karten', [lektion, frage]));
      return satz?.karte ?? null;
    },

    async karten() {
      const saetze = await lies('karten', [] as Kartensatz[], (db) => db.getAll('karten'));
      return saetze.flatMap(alsKartenstand);
    },

    einstellung(schluessel) {
      return lies('einstellung', undefined, (db) => db.get('einstellungen', schluessel));
    },

    merkeEinstellung(schluessel, wert) {
      return schreibe('merkeEinstellung', (db) => db.put('einstellungen', wert, schluessel));
    },

    async alsJson(jetzt = new Date()) {
      const inhalt = await lies('alsJson', LEERE_AUSFUHR, async (db) => {
        // Eine Transaktion ueber alle drei Speicher, nicht drei nacheinander.
        // Ein Auszug, in dem die Karte schon die Antwort von eben kennt und das
        // Ereignis dazu fehlt, ist als Grundlage einer Parameterschaetzung
        // schlechter als gar keiner: Er sieht vollstaendig aus.
        const tx = db.transaction(['ereignisse', 'karten', 'einstellungen'], 'readonly');
        const [ereignisse, karten, schluessel, werte] = await Promise.all([
          tx.objectStore('ereignisse').getAll(),
          tx.objectStore('karten').getAll(),
          tx.objectStore('einstellungen').getAllKeys(),
          tx.objectStore('einstellungen').getAll(),
        ]);
        await tx.done;

        const einstellungen: Record<string, unknown> = {};
        schluessel.forEach((k, i) => {
          einstellungen[k] = werte[i];
        });
        return { ereignisse, karten, einstellungen };
      });

      // Auch im Fehlerfall gueltiges JSON mit leeren Listen. Der Ausfuhrknopf
      // auf der Landkarte darf nicht davon abhaengen, dass der Speicher geht.
      const ausfuhr: Ausfuhr = { fassung: FASSUNG, erzeugt: jetzt.toISOString(), ...inhalt };
      return JSON.stringify(ausfuhr, null, 2);
    },

    async schliessen() {
      const offen = verbindung;
      verbindung = null;
      (await offen)?.close();
    },
  };
}

/**
 * Ein Satz wird zum Kartenstand — oder faellt heraus.
 *
 * `flatMap` ueber null bis ein Ergebnis, damit ein einzelner unlesbarer Satz
 * nicht den ganzen Speicher mitnimmt. Der Fall ist nicht erfunden: Wenn eine
 * kuenftige Fassung `karte` anders ablegt und die Fortschreibung dabei etwas
 * uebersieht, ist der Unterschied zwischen „eine Karte fehlt" und „keine Karte
 * da" der Unterschied zwischen einem Schoenheitsfehler und einem
 * zurueckgesetzten Lernstand.
 */
function alsKartenstand(satz: Kartensatz): Kartenstand[] {
  const faellig = satz.karte?.due;
  if (!(faellig instanceof Date) || Number.isNaN(faellig.getTime())) {
    melde('karten', `Satz ohne brauchbaren Termin: ${satz.lektion}/${satz.frage}`);
    return [];
  }
  return [{ ...satz, faellig: new Date(faellig.getTime()) }];
}

/**
 * Ein Fehlschlag wird gemeldet, nicht verschluckt.
 *
 * Die Oberflaeche zeigt in beiden Faellen dasselbe, naemlich nichts. In der
 * Konsole steht der Unterschied zwischen „nichts zu speichern" und „nicht
 * gespeichert" — sonst sucht man den fehlenden Zustand spaeter dort, wo er
 * nicht herkommt.
 */
function melde(was: string, fehler: unknown): void {
  console.warn(`[speicher] ${was} fehlgeschlagen:`, fehler);
}
