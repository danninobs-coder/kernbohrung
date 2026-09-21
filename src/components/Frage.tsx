import { useEffect, useMemo, useRef, useState } from 'react';
import { mischen } from '../lib/mischen';
import Zuversicht from './Zuversicht';
import { naechsterTermin, neueKarte } from '../tutor/planung';
import { speicher as neuerSpeicher, type Speicher } from '../tutor/speicher';
import { ZUVERSICHT_TEXT, type Ereignis, type Zuversicht as Stufe } from '../tutor/typen';

export type Antwort = {
  text: string;
  richtig: boolean;
  begruendung: string;
};

export type FrageProps = {
  /**
   * Die Lektion, zu der die Frage gehoert. Zusammen mit `id` der Schluessel
   * von Ereignis und Karte — eine Frage ohne Lektion liesse sich im Speicher
   * nicht wiederfinden, deshalb ist die Angabe nicht wahlfrei.
   */
  lektion: string;
  id: string;
  frage: string;
  antworten: Antwort[];
  /**
   * Die Naht fuer Tests, wie in `speicher.ts` der `Oeffner`.
   *
   * Voreingestellt ist ein Speicher, den sich alle Fragen einer Seite teilen:
   * vier Fragen sollen nicht vier Verbindungen zur selben Datenbank oeffnen.
   */
  speicher?: Speicher;
  /**
   * Monotone Uhr in Millisekunden, nur fuer `dauerMs`.
   *
   * `performance.now()` und nicht `Date.now()`: Eine Zeitzonenumstellung oder
   * ein Zeitabgleich mitten in der Frage ergaebe sonst eine negative Dauer.
   */
  uhr?: () => number;
};

type Zustand = 'offen' | 'gewaehlt' | 'richtig' | 'falsch' | 'neutral';

/** `offen` -> Antwort waehlen, `gewaehlt` -> Stufe waehlen, `aufgeloest` -> fertig. */
type Phase = 'offen' | 'gewaehlt' | 'aufgeloest';

/**
 * Ein Speicher fuer die ganze Seite, traege erzeugt.
 *
 * `neuerSpeicher()` oeffnet noch nichts — die Verbindung entsteht beim ersten
 * Zugriff. Der Aufruf hier kostet also nichts und passiert trotzdem erst,
 * wenn er gebraucht wird: Beim Bauen rendert Astro diese Insel auf dem Server
 * vor, und dort gibt es kein IndexedDB.
 */
let geteilt: Speicher | null = null;
function geteilterSpeicher(): Speicher {
  geteilt ??= neuerSpeicher();
  return geteilt;
}

function standarduhr(): number {
  return performance.now();
}

export default function Frage({
  lektion,
  id,
  frage,
  antworten,
  speicher,
  uhr = standarduhr,
}: FrageProps) {
  const gemischt = useMemo(() => mischen(antworten, id), [antworten, id]);
  // Gemerkt wird die Antwort selbst, nicht ihre Position. Eine Position gilt
  // nur fuer genau die Reihenfolge, in der sie entstanden ist: liefert das
  // Elternteil dieselben Antworten spaeter umsortiert, zeigt der Index auf
  // eine andere Antwort, und die Ansicht behauptet eine Wahl, die der Nutzer
  // nie getroffen hat - lautlos, ohne Fehler oder Warnung. Die Objektidentitaet
  // ueberlebt jede Umsortierung.
  const [gewaehlt, setGewaehlt] = useState<Antwort | null>(null);
  const [stufe, setStufe] = useState<Stufe | null>(null);

  /**
   * Der Beginn der Messung: die erste Wahl einer Antwort.
   *
   * Warum nicht ab Anzeige der Frage: Auf einer Lektionsseite stehen vier
   * Fragen, alle hydrieren beim Laden. Die Zeit ab dem Einhaengen misst dann,
   * wie lange jemand die SEITE offen hatte — bei der vierten Frage inklusive
   * der drei davor. Die Zahl saehe brauchbar aus und waere systematisch nach
   * der Position auf der Seite verzerrt. Das ist schlimmer als keine Zahl.
   *
   * Warum nicht ab erstem Blick: Ein IntersectionObserver meldet, wann die
   * Karte im Sichtfenster steht, nicht wann sie gelesen wird. Wer einmal nach
   * unten scrollt, hat alle vier „gesehen". Dazu kommt derselbe Ausfallmodus,
   * wegen dem `Lektion.astro` schon `client:visible` verworfen hat: In einem
   * Dokument, das als versteckt gilt, feuert der Beobachter nicht.
   *
   * Bleibt der Abschnitt zwischen der Wahl der Antwort und der Festlegung der
   * Zuversicht. Beide Enden sind vom Menschen verursacht, beide werden hier
   * beobachtet, und beide sind unabhaengig davon, wo die Frage auf der Seite
   * steht. Das ist NICHT die Zeit, die das Nachdenken ueber die Frage
   * gebraucht hat — die faengt vor dem ersten Klick an und ist von hier aus
   * unsichtbar. Es ist die Dauer der Selbsteinschaetzung, und `dauerMs` traegt
   * genau diese Bedeutung, nicht mehr.
   *
   * Bei einem Sinneswandel wird nicht zurueckgesetzt: Wer die Antwort noch
   * einmal wechselt, hat gezoegert, und das Zoegern gehoert in die Zahl.
   */
  const beginn = useRef<number | null>(null);
  const aufloesung = useRef<HTMLParagraphElement>(null);

  const aufgeloest = stufe !== null;
  const phase: Phase = aufgeloest ? 'aufgeloest' : gewaehlt !== null ? 'gewaehlt' : 'offen';

  /**
   * Der Fokus folgt der Aufloesung.
   *
   * Beim Festlegen verschwindet der Zuversichtsblock — mitsamt dem Knopf, auf
   * dem der Fokus gerade stand. Ein entfernter Fokus faellt auf `<body>`
   * zurueck: Der Screenreader verstummt, und die Tastatur faengt beim
   * naechsten Tab wieder ganz oben auf der Seite an. Deshalb wandert der Fokus
   * auf den Ergebnissatz, der dadurch zugleich vorgelesen wird.
   */
  useEffect(() => {
    if (aufgeloest) aufloesung.current?.focus();
  }, [aufgeloest]);

  function waehle(antwort: Antwort): void {
    if (aufgeloest) return;
    beginn.current ??= uhr();
    setGewaehlt(antwort);
  }

  function festlegen(gewaehlteStufe: Stufe): void {
    const antwort = gewaehlt;
    if (antwort === null || aufgeloest) return;

    const jetzt = new Date();
    const dauerMs = Math.max(0, Math.round(uhr() - (beginn.current ?? uhr())));

    // ERST die Anzeige, DANN das Schreiben. Die Reihenfolge ist die ganze
    // Zusicherung: Wenn diese Zeile durch ist, steht die Aufloesung fest, und
    // nichts, was danach kommt, kann sie noch verhindern.
    setStufe(gewaehlteStufe);
    void aufzeichnen(antwort, gewaehlteStufe, dauerMs, jetzt);
  }

  /**
   * Die Aufzeichnung. Sie darf scheitern, ohne die Frage mitzunehmen.
   *
   * Im privaten Fenster, bei geloeschten Websitedaten und bei abgeschaltetem
   * Speicher liefert `speicher.ts` `false`, statt zu werfen. Das `try` hier
   * ist trotzdem kein Guertel zum Hosentraeger: `Speicher` ist eine
   * Schnittstelle, die von aussen hereingereicht wird, und diese Komponente
   * verlaesst sich nicht auf ein Versprechen, das eine fremde Umsetzung
   * brechen kann.
   *
   * Die Karte wird auch dann fortgeschrieben, wenn das Ereignis nicht
   * geschrieben werden konnte. Beide Schreibvorgaenge gehen in dieselbe
   * Datenbank: Faellt sie ganz aus, faellt beides aus, und es entsteht keine
   * Luecke. Scheitert nur eines von beiden, ist ein geplanter Termin ohne
   * Historie der kleinere Schaden als eine Historie ohne Termin — die Frage
   * kaeme sonst nie wieder.
   */
  async function aufzeichnen(
    antwort: Antwort,
    gewaehlteStufe: Stufe,
    dauerMs: number,
    jetzt: Date,
  ): Promise<void> {
    const ablage = speicher ?? geteilterSpeicher();
    const ereignis: Ereignis = {
      lektion,
      frage: id,
      typ: 'wahl',
      zuversicht: gewaehlteStufe,
      richtig: antwort.richtig,
      anteil: antwort.richtig ? 1 : 0,
      antwort: antwort.text,
      merkmal: antwort.richtig ? '' : antwort.text,
      dauerMs,
      zeitpunkt: jetzt.toISOString(),
    };

    try {
      await ablage.merkeEreignis(ereignis);
      const vorher = await ablage.karte(lektion, id);
      const termin = naechsterTermin(
        vorher ?? neueKarte(jetzt),
        gewaehlteStufe,
        antwort.richtig,
        jetzt,
      );
      await ablage.merkeKarte(lektion, id, termin);
    } catch (fehler) {
      console.warn('[frage] Aufzeichnung fehlgeschlagen:', fehler);
    }
  }

  function zustandVon(antwort: Antwort): Zustand {
    if (!aufgeloest) return antwort === gewaehlt ? 'gewaehlt' : 'offen';
    if (antwort.richtig) return 'richtig';
    if (antwort === gewaehlt) return 'falsch';
    return 'neutral';
  }

  return (
    // `karte` traegt nur Gestalt: Flaeche, Rand, Radius, Schatten aus der
    // Token-Schicht. Die Frage selbst weiss davon nichts.
    //
    // `data-beantwortet` heisst weiterhin „es gibt eine Aufloesung" und nicht
    // „es ist etwas angeklickt". Die Zwischenstufe steht in `data-phase`.
    <div className="frage karte" data-beantwortet={aufgeloest} data-phase={phase}>
      <p className="frage-text">{frage}</p>

      {/* Der Ergebnissatz steht VOR den Antworten, nicht darunter: Er ist die
          Ueberschrift der Aufloesung, die einzelnen Begruendungen sind ihre
          Erlaeuterung. Wer ihn unten anhaengt, laesst erst vier Begruendungen
          vorlesen und sagt danach, ob es ueberhaupt gestimmt hat. */}
      {aufgeloest && gewaehlt !== null && (
        <p
          className="aufloesung"
          data-ergebnis={gewaehlt.richtig ? 'richtig' : 'falsch'}
          ref={aufloesung}
          tabIndex={-1}
        >
          {gewaehlt.richtig ? 'Richtig.' : 'Falsch.'} Angegeben: {ZUVERSICHT_TEXT[stufe]}.
          {hinweisZu(gewaehlt.richtig, stufe) !== null && (
            <span className="aufloesung-hinweis"> {hinweisZu(gewaehlt.richtig, stufe)}</span>
          )}
        </p>
      )}

      <ul className="antworten">
        {gemischt.map((antwort) => (
          // Der Text taugt als key, weil das Lektions-Schema doppelte
          // Antworttexte innerhalb einer Frage zurueckweist (normalisiert
          // verglichen). Faellt diese Regel, faellt auch dieser key.
          <li key={antwort.text}>
            <button
              type="button"
              className="antwort"
              data-zustand={zustandVon(antwort)}
              // Die Wahl ist bis zur Zuversicht widerruflich, also ist sie ein
              // Schaltzustand und kein abgeschickter Wert. `aria-pressed` sagt
              // ihn genau dort an, wo der Fokus in diesem Moment steht — die
              // Rueckmeldung kommt damit ohne zusaetzliche Live-Region aus.
              aria-pressed={antwort === gewaehlt}
              disabled={aufgeloest}
              onClick={() => waehle(antwort)}
            >
              {antwort.text}
            </button>
            {/* Farbe allein traegt die Aufloesung nicht (WCAG 1.4.1). Die
                Marke steht ausserhalb des Knopfes: In ihm wuerde sie seinen
                zugaenglichen Namen aendern, und dieselbe Antwort hiesse vor
                und nach der Aufloesung anders. */}
            {aufgeloest && markeZu(antwort, gewaehlt) !== null && (
              <p className="antwort-marke">{markeZu(antwort, gewaehlt)}</p>
            )}
            {aufgeloest && <p className="begruendung">{antwort.begruendung}</p>}
          </li>
        ))}
      </ul>

      {/* Die Reihenfolge ist Absicht: Sicherheit laesst sich erst
          einschaetzen, wenn eine Antwort im Kopf ist. Zuerst zu fragen hiesse
          erraten, wie schwer die Frage AUSSIEHT. */}
      {phase === 'gewaehlt' && <Zuversicht id={id} beiWahl={festlegen} />}
    </div>
  );
}

/**
 * Der Zusatz zum Ergebnissatz — nur fuer die beiden Faelle, die etwas kosten.
 *
 * Sicher und daneben ist der teure Fall: Eine Fehlvorstellung, die sich sicher
 * anfuehlt, loest sich nicht von selbst auf. Getroffen und geraten ist der
 * andere: Glueck ist kein Koennen, und der Planer behandelt es auch nicht so.
 * Die uebrigen vier Kombinationen brauchen keinen Kommentar.
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

/** Die Textmarke an einer Antwort, sobald aufgeloest ist. */
function markeZu(antwort: Antwort, gewaehlt: Antwort | null): string | null {
  const eigene = antwort === gewaehlt;
  if (antwort.richtig) return eigene ? 'richtig · deine Wahl' : 'richtig';
  return eigene ? 'deine Wahl' : null;
}
