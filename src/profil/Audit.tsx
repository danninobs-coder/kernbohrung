import { useEffect, useRef, useState, type ReactNode } from 'react';
import { GRUPPEN, ITEMS, ITEMSATZ, STUFEN, STUFEN_TEXT, VORLIEBEN, type Vorliebe, type Wert } from './items';
import { werteAus } from './auswertung';
import { Ergebnisansicht } from './Ergebnis';
import {
  HalbeVorliebenSchema,
  SCHLUESSEL_ENTWURF,
  SCHLUESSEL_PROFIL,
  VorliebenSchema,
  liesEntwurf,
  type Entwurf,
  type Profilstand,
} from './schema';
import { speicher as neuerSpeicher, type Speicher } from '../tutor/speicher';

/**
 * Das Audit: 26 Aussagen in fuenf Gruppen, drei Vorlieben, dann das Ergebnis.
 *
 * Drei Zusicherungen bestimmen den Bau.
 *
 * ERSTENS: Alles ist ein Angebot. Keine Aussage muss beantwortet werden —
 * „Weiter" geht immer. Die Auswertung kann damit umgehen (`null` statt 0).
 *
 * ZWEITENS: Der Zwischenstand bleibt liegen. Jede Antwort und jeder
 * Schrittwechsel schreibt den Entwurf fort; nach dem Neuladen geht es dort
 * weiter. Geschrieben wird im Vorbeigehen — auf das Schreiben wartet nichts.
 *
 * DRITTENS: Der Speicher haelt den Ablauf nie auf. Antwortet er beim Lesen
 * nicht, ist der Fragebogen trotzdem sofort bedienbar. Scheitert am Ende das
 * Speichern, steht das Ergebnis trotzdem da — nur nicht behalten, mit Hinweis.
 *
 * Gespeichert werden die ANTWORTEN. Das Ergebnis rechnet `werteAus` bei jedem
 * Oeffnen neu — hier am Ende genauso wie spaeter auf `/profil`.
 */

export type WahlfrageProps<W extends string | number> = {
  /** Eindeutig je Frage — wird zum `name` der Radiogruppe. */
  name: string;
  frage: string;
  optionen: readonly { readonly wert: W; readonly text: string; readonly kurz?: string }[];
  gewaehlt: W | undefined;
  beiWahl: (wert: W) => void;
  /** Zusatzklasse fuer die Anordnung: `skala` nebeneinander, `liste` untereinander. */
  klasse: 'skala' | 'liste';
  /** Steht unter den Feldern, etwa die Enden einer Skala. */
  fuss?: ReactNode;
};

/**
 * Eine Frage mit Einfachwahl — fuer die Aussagen wie fuer die Vorlieben.
 *
 * Echte Radiofelder und kein `role="group"` aus Knoepfen wie bei der
 * Zuversicht: Dort loest jeder Druck sofort etwas aus, hier wird eine Wahl
 * getroffen, die stehen bleibt und sich aendern laesst. Genau das ist ein
 * Radiofeld, und es bringt die Tastatur mit: ein Tabstopp je Frage, Pfeiltasten
 * wechseln die Wahl. Bei bis zu sechs Aussagen zu je fuenf Stufen waeren
 * Knoepfe dreissig Tabstopps je Gruppe.
 *
 * `fieldset` und `legend` ergeben von selbst eine Gruppe mit der Frage als
 * Namen. Der Name jedes Feldes steht in `aria-label`, weil auf der Skala nur
 * die Zahl sichtbar ist — vorgelesen wird „4 — trifft eher zu".
 */
export function Wahlfrage<W extends string | number>({
  name,
  frage,
  optionen,
  gewaehlt,
  beiWahl,
  klasse,
  fuss,
}: WahlfrageProps<W>) {
  return (
    <fieldset className={`wahlfrage ${klasse}`}>
      <legend>{frage}</legend>
      <div className="wahlfelder">
        {optionen.map((option) => (
          <label key={String(option.wert)} className="wahlfeld" data-gewaehlt={option.wert === gewaehlt}>
            <input
              type="radio"
              name={name}
              value={String(option.wert)}
              aria-label={option.text}
              checked={option.wert === gewaehlt}
              onChange={() => beiWahl(option.wert)}
            />
            <span aria-hidden="true">{option.kurz ?? option.text}</span>
          </label>
        ))}
      </div>
      {fuss}
    </fieldset>
  );
}

const STUFEN_OPTIONEN = STUFEN.map((stufe) => ({
  wert: stufe,
  text: `${stufe} — ${STUFEN_TEXT[stufe]}`,
  kurz: String(stufe),
}));

/** Der Schritt nach der letzten Aussagengruppe: die Vorlieben. */
const VORLIEBEN_SCHRITT = GRUPPEN.length;

const LEERER_ENTWURF: Entwurf = { itemsatz: ITEMSATZ, antworten: {}, vorlieben: {}, schritt: 0 };

export type AuditProps = {
  /**
   * Die Naht fuer Tests, wie in `Aufgabe.tsx`. Voreingestellt ist der echte
   * Speicher; er oeffnet erst beim ersten Zugriff, deshalb schadet der Aufruf
   * beim Vorrendern auf dem Server nicht.
   */
  speicher?: Speicher;
  /** Die Uhr fuer den Zeitpunkt der Erhebung. */
  uhr?: () => Date;
};

function standarduhr(): Date {
  return new Date();
}

export default function Audit({ speicher, uhr = standarduhr }: AuditProps) {
  const [ablage] = useState<Speicher>(() => speicher ?? neuerSpeicher());
  const [entwurf, setEntwurf] = useState<Entwurf>(LEERER_ENTWURF);
  const [fertig, setFertig] = useState<Profilstand | null>(null);
  const [nichtBehalten, setNichtBehalten] = useState(false);

  /** Sobald jemand etwas angefasst hat, ueberschreibt ein spaet eintreffender Entwurf nichts mehr. */
  const beruehrt = useRef(false);
  /** Der Fokus folgt nur einem Schrittwechsel per Knopf, nicht dem Laden der Seite. */
  const fokusFolgt = useRef(false);
  const kopf = useRef<HTMLHeadingElement>(null);

  // Den Zwischenstand holen. Der Fragebogen steht schon da und ist bedienbar:
  // Ein Speicher, der nicht antwortet, haelt hier nichts auf.
  useEffect(() => {
    let aktiv = true;
    void (async () => {
      try {
        const gespeichert = liesEntwurf(await ablage.einstellung(SCHLUESSEL_ENTWURF));
        if (aktiv && gespeichert !== null && !beruehrt.current) setEntwurf(gespeichert);
      } catch (fehler) {
        console.warn('[audit] Zwischenstand nicht lesbar:', fehler);
      }
    })();
    return () => {
      aktiv = false;
    };
  }, [ablage]);

  // Beim Schrittwechsel verschwindet die Gruppe, in der der Fokus stand. Ohne
  // diesen Sprung bliebe er auf „Weiter" am Seitenende, und die Tastatur muesste
  // rueckwaerts durch die neue Gruppe. Die Ueberschrift nimmt ihn auf und sagt
  // dabei an, wo man ist.
  useEffect(() => {
    if (!fokusFolgt.current) return;
    fokusFolgt.current = false;
    kopf.current?.focus();
  }, [entwurf.schritt, fertig]);

  /** Schreibt, ohne je zu werfen. `Speicher` kommt von aussen herein — siehe `Aufgabe.tsx`. */
  async function sichere(schluessel: string, wert: unknown): Promise<boolean> {
    try {
      return await ablage.merkeEinstellung(schluessel, wert);
    } catch (fehler) {
      console.warn('[audit] Speichern fehlgeschlagen:', fehler);
      return false;
    }
  }

  function uebernimm(naechster: Entwurf): void {
    beruehrt.current = true;
    setEntwurf(naechster);
    void sichere(SCHLUESSEL_ENTWURF, naechster);
  }

  function antworte(id: string, wert: Wert): void {
    uebernimm({ ...entwurf, antworten: { ...entwurf.antworten, [id]: wert } });
  }

  function waehleVorliebe(id: Vorliebe['id'], wert: string | number): void {
    // Geprueft statt behauptet: Der Wert kommt aus `VORLIEBEN`, die erlaubte
    // Form aus dem Schema. Ein Cast hier waere die Stelle, an der beide Listen
    // unbemerkt auseinanderlaufen.
    const befund = HalbeVorliebenSchema.safeParse({ ...entwurf.vorlieben, [id]: wert });
    if (befund.success) uebernimm({ ...entwurf, vorlieben: befund.data });
  }

  function geheZu(schritt: number): void {
    fokusFolgt.current = true;
    uebernimm({ ...entwurf, schritt });
  }

  function schliesseAb(): void {
    const vorlieben = VorliebenSchema.safeParse(entwurf.vorlieben);
    if (!vorlieben.success) return;
    const stand: Profilstand = {
      itemsatz: ITEMSATZ,
      erhoben: uhr().toISOString(),
      antworten: entwurf.antworten,
      vorlieben: vorlieben.data,
    };
    // ERST die Anzeige, DANN das Schreiben — dieselbe Reihenfolge wie in
    // `Aufgabe.tsx`. Wenn diese Zeilen durch sind, steht das Ergebnis fest, und
    // nichts, was der Speicher danach tut oder laesst, nimmt es wieder weg.
    fokusFolgt.current = true;
    setFertig(stand);
    void behalte(stand);
  }

  async function behalte(stand: Profilstand): Promise<void> {
    if (!(await sichere(SCHLUESSEL_PROFIL, stand))) {
      // Der Entwurf bleibt liegen: Nach dem Neuladen laesst sich der letzte
      // Schritt wiederholen.
      setNichtBehalten(true);
      return;
    }
    // Der Speicher kennt kein Entfernen. `null` heisst „kein Entwurf".
    await sichere(SCHLUESSEL_ENTWURF, null);
  }

  if (fertig !== null) {
    const auswertung = werteAus(fertig);
    return (
      <div className="audit">
        <h2 className="audit-kopf" ref={kopf} tabIndex={-1}>
          Dein Ergebnis
        </h2>
        {auswertung !== null && (
          <Ergebnisansicht
            auswertung={auswertung}
            erhoben={fertig.erhoben}
            jetzt={new Date(fertig.erhoben)}
            nichtBehalten={nichtBehalten}
          />
        )}
      </div>
    );
  }

  const beiVorlieben = entwurf.schritt >= VORLIEBEN_SCHRITT;
  const gruppe = GRUPPEN[entwurf.schritt] ?? [];
  const davor = GRUPPEN.slice(0, entwurf.schritt).reduce((summe, g) => summe + g.length, 0);
  const beantwortet = ITEMS.filter((item) => entwurf.antworten[item.id] !== undefined).length;
  const offeneVorlieben = VORLIEBEN.filter((vorliebe) => entwurf.vorlieben[vorliebe.id] === undefined).length;

  return (
    <div className="audit karte">
      <p className="audit-fortschritt">
        Schritt {Math.min(entwurf.schritt, VORLIEBEN_SCHRITT) + 1} von {VORLIEBEN_SCHRITT + 1} · {beantwortet} von{' '}
        {ITEMS.length} Aussagen beantwortet
      </p>
      <h2 className="audit-kopf" ref={kopf} tabIndex={-1}>
        {beiVorlieben
          ? 'Drei Vorlieben'
          : `Aussagen ${davor + 1} bis ${davor + gruppe.length} von ${ITEMS.length}`}
      </h2>

      {beiVorlieben
        ? VORLIEBEN.map((vorliebe) => (
            <Wahlfrage
              key={vorliebe.id}
              name={`vorliebe-${vorliebe.id}`}
              frage={vorliebe.frage}
              optionen={vorliebe.optionen}
              gewaehlt={entwurf.vorlieben[vorliebe.id]}
              beiWahl={(wert) => waehleVorliebe(vorliebe.id, wert)}
              klasse="liste"
            />
          ))
        : gruppe.map((item) => (
            <Wahlfrage
              key={item.id}
              name={`aussage-${item.id}`}
              frage={item.text}
              optionen={STUFEN_OPTIONEN}
              gewaehlt={entwurf.antworten[item.id]}
              beiWahl={(wert) => antworte(item.id, wert)}
              klasse="skala"
              fuss={
                <p className="skala-enden" aria-hidden="true">
                  <span>{STUFEN_TEXT[1]}</span>
                  <span>{STUFEN_TEXT[5]}</span>
                </p>
              }
            />
          ))}

      <div className="audit-knoepfe">
        {entwurf.schritt > 0 && (
          <button type="button" className="zurueck" onClick={() => geheZu(entwurf.schritt - 1)}>
            Zurück
          </button>
        )}
        {beiVorlieben ? (
          <button type="button" className="abgeben" disabled={offeneVorlieben > 0} onClick={schliesseAb}>
            Ergebnis ansehen
          </button>
        ) : (
          <button type="button" className="abgeben" onClick={() => geheZu(entwurf.schritt + 1)}>
            Weiter
          </button>
        )}
      </div>
      {beiVorlieben && offeneVorlieben > 0 && (
        <p className="audit-offen">Noch {offeneVorlieben} von drei Vorlieben offen.</p>
      )}
    </div>
  );
}
