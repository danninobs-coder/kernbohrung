import { useEffect, useRef, useState } from 'react';
import Aufgabentyp from '../aufgaben/Aufgabentyp';
import type { Aufgabe as AufgabeDaten } from '../aufgaben/schema';
import type { Abgabe, AufgabenPhase, Ergebnis } from '../aufgaben/vertrag';
import Zuversicht from './Zuversicht';
import { naechsterTermin, neueKarte } from '../tutor/planung';
import { speicher as neuerSpeicher, type Speicher } from '../tutor/speicher';
import { ZUVERSICHT_TEXT, type Ereignis, type Zuversicht as Stufe } from '../tutor/typen';

export type AufgabeProps = {
  /**
   * Die Lektion, zu der die Aufgabe gehoert. Zusammen mit `aufgabe.id` der
   * Schluessel von Ereignis und Karte — eine Aufgabe ohne Lektion liesse sich
   * im Speicher nicht wiederfinden, deshalb ist die Angabe nicht wahlfrei.
   */
  lektion: string;
  aufgabe: AufgabeDaten;
  /**
   * Die Naht fuer Tests, wie in `speicher.ts` der `Oeffner`.
   *
   * Voreingestellt ist ein Speicher, den sich alle Aufgaben einer Seite
   * teilen: vier Aufgaben sollen nicht vier Verbindungen zur selben Datenbank
   * oeffnen.
   */
  speicher?: Speicher;
  /**
   * Monotone Uhr in Millisekunden, nur fuer `dauerMs`.
   *
   * `performance.now()` und nicht `Date.now()`: Eine Zeitzonenumstellung oder
   * ein Zeitabgleich mitten in der Aufgabe ergaebe sonst eine negative Dauer.
   */
  uhr?: () => number;
};

/**
 * Ein Speicher fuer die ganze Seite, traege erzeugt.
 *
 * `neuerSpeicher()` oeffnet noch nichts — die Verbindung entsteht beim ersten
 * Zugriff. Der Aufruf hier kostet also nichts und passiert trotzdem erst, wenn
 * er gebraucht wird: Beim Bauen rendert Astro diese Insel auf dem Server vor,
 * und dort gibt es kein IndexedDB.
 */
let geteilt: Speicher | null = null;
function geteilterSpeicher(): Speicher {
  geteilt ??= neuerSpeicher();
  return geteilt;
}

function standarduhr(): number {
  return performance.now();
}

/**
 * Die Huelle jeder Aufgabe: Zuversicht, Aufzeichnung, Terminplanung.
 *
 * Sie kennt keinen Aufgabentyp. Sie kennt den Vertrag aus
 * `src/aufgaben/vertrag.ts`: eine Abgabe, ein Ergebnis, vier Phasen. Ein neuer
 * Typ aendert an dieser Datei nichts.
 */
export default function Aufgabe({ lektion, aufgabe, speicher, uhr = standarduhr }: AufgabeProps) {
  const [abgabe, setAbgabe] = useState<Abgabe | null>(null);
  const [stufe, setStufe] = useState<Stufe | null>(null);
  const [ergebnis, setErgebnis] = useState<Ergebnis | null>(null);

  /**
   * Der Beginn der Messung: die erste Abgabe.
   *
   * Warum nicht ab Anzeige der Aufgabe: Auf einer Lektionsseite stehen mehrere
   * Aufgaben, alle hydrieren beim Laden. Die Zeit ab dem Einhaengen misst dann,
   * wie lange jemand die SEITE offen hatte — bei der vierten Aufgabe inklusive
   * der drei davor. Die Zahl saehe brauchbar aus und waere systematisch nach
   * der Position auf der Seite verzerrt. Das ist schlimmer als keine Zahl.
   *
   * Warum nicht ab erstem Blick: Ein IntersectionObserver meldet, wann die
   * Karte im Sichtfenster steht, nicht wann sie gelesen wird — und in einem
   * Dokument, das als versteckt gilt, feuert er gar nicht.
   *
   * Bleibt der Abschnitt zwischen der Abgabe und der Festlegung der
   * Zuversicht. Beide Enden sind vom Menschen verursacht, beide werden hier
   * beobachtet. `dauerMs` ist damit die Dauer der Selbsteinschaetzung, nicht
   * mehr. Bei einem Sinneswandel wird nicht zurueckgesetzt: Wer die Abgabe
   * noch einmal wechselt, hat gezoegert, und das Zoegern gehoert in die Zahl.
   */
  const beginn = useRef<number | null>(null);
  const dauerMs = useRef(0);
  const aufloesung = useRef<HTMLParagraphElement>(null);
  /**
   * Sperrt eine zweite Aufzeichnung.
   *
   * `stufe`/`ergebnis` sind `useState`-Werte: Sie aendern sich erst beim
   * NAECHSTEN Render, nicht synchron innerhalb des Aufrufs, der sie setzt. Ein
   * zweiter, synchroner Aufruf von `abschliessen` — zwei Klicks vor dem ersten
   * Rendern, oder eine Typkomponente, die `onErgebnis` zweimal ruft — saehe
   * also noch `ergebnis === null` und zeichnete ein zweites Mal auf. Der Ref
   * gilt sofort und synchron mit der ersten Zuweisung und schliesst genau
   * diese Luecke, fuer jeden Typ, auch einen ohne eigene Sperre.
   */
  const aufgezeichnet = useRef(false);

  const phase: AufgabenPhase =
    ergebnis !== null ? 'aufgeloest' : stufe !== null ? 'zuversicht' : abgabe !== null ? 'abgegeben' : 'offen';
  const aufgeloest = phase === 'aufgeloest';

  /**
   * Der Fokus folgt der Aufloesung.
   *
   * Beim Aufloesen verschwindet, worauf der Fokus stand — der Zuversichtsblock
   * oder der Knopf „Fertig". Ein entfernter Fokus faellt auf `<body>`: Der
   * Screenreader verstummt, und die Tastatur faengt beim naechsten Tab wieder
   * ganz oben auf der Seite an. Deshalb wandert der Fokus auf den
   * Ergebnissatz, der dadurch zugleich vorgelesen wird.
   */
  useEffect(() => {
    if (aufgeloest) aufloesung.current?.focus();
  }, [aufgeloest]);

  function nimmAbgabe(neu: Abgabe): void {
    // Nach der Zuversicht ist die Abgabe fest.
    if (stufe !== null) return;
    beginn.current ??= uhr();
    setAbgabe(neu);
  }

  function festlegen(gewaehlteStufe: Stufe): void {
    if (abgabe === null || stufe !== null) return;
    dauerMs.current = Math.max(0, Math.round(uhr() - (beginn.current ?? uhr())));
    setStufe(gewaehlteStufe);
    // Steht die Bewertung schon fest, wird in einem Zug aufgeloest. Nur `fall`
    // reicht sie nach: Dort werden erst jetzt die Pruefpunkte sichtbar.
    if (abgabe.ergebnis !== null) abschliessen(abgabe.ergebnis, gewaehlteStufe);
  }

  function nimmErgebnis(nachgereicht: Ergebnis): void {
    if (stufe === null || ergebnis !== null) return;
    abschliessen(nachgereicht, stufe);
  }

  function abschliessen(fertig: Ergebnis, mitStufe: Stufe): void {
    // Siehe der Kommentar bei `aufgezeichnet`: Ohne diese Zeile schuetzen
    // `stufe`/`ergebnis` nicht gegen einen zweiten, synchronen Aufruf.
    if (aufgezeichnet.current) return;
    aufgezeichnet.current = true;

    const jetzt = new Date();
    // ERST die Anzeige, DANN das Schreiben. Die Reihenfolge ist die ganze
    // Zusicherung: Wenn diese Zeile durch ist, steht die Aufloesung fest, und
    // nichts, was danach kommt, kann sie noch verhindern.
    setErgebnis(fertig);
    void aufzeichnen(fertig, mitStufe, dauerMs.current, jetzt);
  }

  /**
   * Die Aufzeichnung. Sie darf scheitern, ohne die Aufgabe mitzunehmen.
   *
   * Im privaten Fenster, bei geloeschten Websitedaten und bei abgeschaltetem
   * Speicher liefert `speicher.ts` `false`, statt zu werfen. Das `try` hier ist
   * trotzdem kein Guertel zum Hosentraeger: `Speicher` ist eine Schnittstelle,
   * die von aussen hereingereicht wird, und diese Komponente verlaesst sich
   * nicht auf ein Versprechen, das eine fremde Umsetzung brechen kann.
   *
   * Die Karte wird auch dann fortgeschrieben, wenn das Ereignis nicht
   * geschrieben werden konnte: Ein geplanter Termin ohne Historie ist der
   * kleinere Schaden als eine Historie ohne Termin — die Aufgabe kaeme sonst
   * nie wieder.
   *
   * Ereignis und Karte tragen denselben Zeitpunkt. Daran haengt, dass sich der
   * geplante Termin aus dem Ereignis exakt nachrechnen laesst.
   */
  async function aufzeichnen(fertig: Ergebnis, mitStufe: Stufe, dauer: number, jetzt: Date): Promise<void> {
    const ablage = speicher ?? geteilterSpeicher();
    const ereignis: Ereignis = {
      lektion,
      frage: aufgabe.id,
      typ: aufgabe.typ,
      zuversicht: mitStufe,
      richtig: fertig.richtig,
      anteil: fertig.anteil,
      antwort: fertig.antwort,
      merkmal: fertig.merkmal,
      dauerMs: dauer,
      zeitpunkt: jetzt.toISOString(),
    };

    try {
      await ablage.merkeEreignis(ereignis);
      const vorher = await ablage.karte(lektion, aufgabe.id);
      const termin = naechsterTermin(vorher ?? neueKarte(jetzt), mitStufe, fertig.richtig, jetzt);
      await ablage.merkeKarte(lektion, aufgabe.id, termin);
    } catch (fehler) {
      console.warn('[frage] Aufzeichnung fehlgeschlagen:', fehler);
    }
  }

  const ergebnissatz =
    ergebnis !== null && stufe !== null ? (
      <p
        className="aufloesung"
        data-ergebnis={ergebnis.richtig ? 'richtig' : 'falsch'}
        ref={aufloesung}
        tabIndex={-1}
      >
        {urteil(ergebnis)} Angegeben: {ZUVERSICHT_TEXT[stufe]}.
        {hinweisZu(ergebnis.richtig, stufe) !== null && (
          <span className="aufloesung-hinweis"> {hinweisZu(ergebnis.richtig, stufe)}</span>
        )}
      </p>
    ) : null;

  return (
    // `karte` traegt nur Gestalt: Flaeche, Rand, Radius, Schatten aus der
    // Token-Schicht. `frage` bleibt der Klassenname der Karte — er haengt an
    // der Gestaltung und an den Messungen der Abnahme, nicht am Aufgabentyp.
    //
    // `data-beantwortet` heisst „es gibt eine Aufloesung", nicht „es ist etwas
    // angeklickt". Die Zwischenstufen stehen in `data-phase`.
    <div className="frage karte" data-typ={aufgabe.typ} data-beantwortet={aufgeloest} data-phase={phase}>
      <Aufgabentyp
        aufgabe={aufgabe}
        phase={phase}
        onAbgegeben={nimmAbgabe}
        onErgebnis={nimmErgebnis}
        ergebnissatz={ergebnissatz}
      />

      {/* Die Reihenfolge ist Absicht: Sicherheit laesst sich erst einschaetzen,
          wenn eine Antwort im Kopf ist. Zuerst zu fragen hiesse erraten, wie
          schwer die Aufgabe AUSSIEHT. */}
      {phase === 'abgegeben' && <Zuversicht id={aufgabe.id} beiWahl={festlegen} />}
    </div>
  );
}

/** Das Urteil in einem Wort. `richtig` bleibt binaer, der Anteil macht das Teilergebnis sagbar. */
function urteil(ergebnis: Ergebnis): string {
  if (ergebnis.richtig) return 'Richtig.';
  return ergebnis.anteil > 0 ? 'Teilweise richtig.' : 'Falsch.';
}

/**
 * Der Zusatz zum Ergebnissatz — nur fuer die beiden Faelle, die etwas kosten.
 *
 * Sicher und daneben ist der teure Fall: Eine Fehlvorstellung, die sich sicher
 * anfuehlt, loest sich nicht von selbst auf. Getroffen und geraten ist der
 * andere: Glueck ist kein Koennen, und der Planer behandelt es auch nicht so.
 */
function hinweisZu(richtig: boolean, stufe: Stufe): string | null {
  if (!richtig && stufe === 'sicher') {
    return 'Sicher und daneben — solche Fragen kommen bevorzugt zurück.';
  }
  if (richtig && stufe === 'geraten') {
    return 'Getroffen, aber geraten — der Planer holt die Frage früh zurück.';
  }
  return null;
}
