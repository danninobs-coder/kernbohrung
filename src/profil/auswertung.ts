import { ITEMS, ITEMSATZ, MUSTER, SKALEN, type Dimension, type Muster, type Skala, type Wert } from './items';
import type { Profilstand } from './schema';

/**
 * Die Auswertung des Audits. Rein: keine Uhr, kein Speicher, kein React.
 *
 * Sie rechnet aus den ANTWORTEN, bei jedem Oeffnen neu. Das Ergebnis wird nie
 * gespeichert — aendert sich eine Regel hier, stimmt das Profil beim naechsten
 * Oeffnen von selbst, ohne Migration.
 *
 * Vier Regeln, jede mit ihrer Grenze als benannter Zahl. Wer an einer dreht,
 * findet in `tests/profil-auswertung.test.ts` den Test, der genau an dieser
 * Grenze steht.
 */

/** Unter so vielen Antworten gilt eine Skala oder ein Muster als nicht erhoben. */
export const MINDESTANTWORTEN = 2;
/** Liegen die beiden hoechsten Muster WENIGER als so weit auseinander: „zwischen A und B". */
export const GLEICHSTAND_UNTER = 0.5;
/** AB diesem Mittel bei „ungerichtet" gibt es den Strukturhinweis. */
export const STRUKTUR_AB = 3.5;
/** UNTER diesem Mittel gilt eine Strategie-Skala als Schwachstelle. */
export const SCHWACH_UNTER = 3.0;
/** Mehr Vorschlaege auf einmal liest niemand. */
export const HOECHSTENS_SCHWACHSTELLEN = 2;

/** Item-Id -> Wert. Eine fehlende Id heisst: nicht beantwortet. */
export type Antworten = Readonly<Partial<Record<string, Wert>>>;

export type Lernmuster =
  | { readonly art: 'eindeutig'; readonly muster: Muster }
  | { readonly art: 'zwischen'; readonly a: Muster; readonly b: Muster };

export type Auswertung = {
  /** Mittel je Skala, 1 bis 5 — oder `null`, wenn nicht erhoben. */
  readonly skalen: Readonly<Record<Skala, number | null>>;
  /** Mittel je Muster — oder `null`, wenn nicht erhoben. */
  readonly muster: Readonly<Record<Muster, number | null>>;
  /** `null`, wenn kein einziges Muster erhoben ist. */
  readonly lernmuster: Lernmuster | null;
  readonly strukturhinweis: boolean;
  /** Hoechstens zwei, die niedrigste zuerst. Leer, wenn nichts unter der Schwelle liegt. */
  readonly schwachstellen: readonly Skala[];
};

/**
 * Das Mittel der beantworteten Aussagen einer Skala oder eines Musters.
 *
 * `null` und nicht 0, wenn zu wenig beantwortet ist. Eine 0 waere eine Aussage
 * — die schlechteste, die es gibt: Sie machte aus einer uebersprungenen Skala
 * eine Schwachstelle und aus einem uebersprungenen Muster einen Befund. Eine
 * einzelne Antwort ist kein Mittel, sondern ein Kreuz.
 */
export function mittelwert(antworten: Antworten, dimension: Dimension): number | null {
  const werte = ITEMS.flatMap((item) => {
    const wert = antworten[item.id];
    return item.dimension === dimension && wert !== undefined ? [wert] : [];
  });
  if (werte.length < MINDESTANTWORTEN) return null;
  return werte.reduce<number>((summe, wert) => summe + wert, 0) / werte.length;
}

/**
 * Das Lernmuster: das mit dem hoechsten Mittel — oder „zwischen A und B".
 *
 * Bei zwei Aussagen je Muster waere eine scharfe Grenze vorgetaeuschte
 * Genauigkeit. Liegen die beiden hoechsten weniger als `GLEICHSTAND_UNTER`
 * auseinander, werden beide genannt. Bei gleichem Mittel entscheidet die
 * Reihenfolge in `MUSTER`, damit dasselbe Profil nicht einmal so und einmal
 * anders heisst (`sort` ist stabil).
 *
 * Nicht erhobene Muster nehmen nicht teil — sie sind keine Null, sie fehlen.
 */
export function lernmusterAus(mittel: Readonly<Record<Muster, number | null>>): Lernmuster | null {
  const erhoben = MUSTER.flatMap((muster) => {
    const wert = mittel[muster];
    return wert === null ? [] : [{ muster, wert }];
  });
  const [erstes, zweites] = [...erhoben].sort((x, y) => y.wert - x.wert);
  if (erstes === undefined) return null;
  if (zweites !== undefined && erstes.wert - zweites.wert < GLEICHSTAND_UNTER) {
    return { art: 'zwischen', a: erstes.muster, b: zweites.muster };
  }
  return { art: 'eindeutig', muster: erstes.muster };
}

/**
 * Der Strukturhinweis haengt NUR an „ungerichtet", nicht am fuehrenden Muster.
 *
 * Es ist das Muster mit dem klarsten Befund (durchgehend negativer
 * Zusammenhang mit Leistung) und das, bei dem die App am meisten helfen kann.
 * Wer bei „anwendungsorientiert" 5,0 hat und bei „ungerichtet" 4,0, bekommt
 * den Hinweis trotzdem.
 */
export function strukturhinweisAus(mittel: Readonly<Record<Muster, number | null>>): boolean {
  const wert = mittel.ungerichtet;
  return wert !== null && wert >= STRUKTUR_AB;
}

/**
 * Die zwei niedrigsten Strategie-Skalen UNTER der Schwelle, die niedrigste
 * zuerst. Gibt es keine, gibt es keine — das Profil erfindet keinen Mangel.
 * Eine nicht erhobene Skala ist nie eine Schwachstelle. Bei gleichem Mittel
 * entscheidet die Reihenfolge in `SKALEN` (`sort` ist stabil).
 */
export function schwachstellenAus(skalen: Readonly<Record<Skala, number | null>>): Skala[] {
  return SKALEN.flatMap((skala) => {
    const wert = skalen[skala];
    return wert !== null && wert < SCHWACH_UNTER ? [{ skala, wert }] : [];
  })
    .sort((x, y) => x.wert - y.wert)
    .slice(0, HOECHSTENS_SCHWACHSTELLEN)
    .map((eintrag) => eintrag.skala);
}

/**
 * Die ganze Auswertung — oder `null`, wenn der Stand zu einem anderen Itemsatz
 * gehoert. Dann gilt das Profil als NICHT ERHOBEN: Antworten auf alte Aussagen
 * werden nicht mit neuen verrechnet, auch nicht teilweise.
 */
export function werteAus(stand: Pick<Profilstand, 'itemsatz' | 'antworten'>): Auswertung | null {
  if (stand.itemsatz !== ITEMSATZ) return null;

  const a = stand.antworten;
  // Ausgeschrieben statt in einer Schleife gebaut: So prueft der Uebersetzer,
  // dass keine Skala und kein Muster fehlt — und es braucht keinen Cast.
  const skalen: Record<Skala, number | null> = {
    ordnen: mittelwert(a, 'ordnen'),
    verknuepfen: mittelwert(a, 'verknuepfen'),
    abrufen: mittelwert(a, 'abrufen'),
    steuern: mittelwert(a, 'steuern'),
    dranbleiben: mittelwert(a, 'dranbleiben'),
    zeiteinteilen: mittelwert(a, 'zeiteinteilen'),
  };
  const muster: Record<Muster, number | null> = {
    bedeutungsorientiert: mittelwert(a, 'bedeutungsorientiert'),
    reproduktionsorientiert: mittelwert(a, 'reproduktionsorientiert'),
    anwendungsorientiert: mittelwert(a, 'anwendungsorientiert'),
    ungerichtet: mittelwert(a, 'ungerichtet'),
  };

  return {
    skalen,
    muster,
    lernmuster: lernmusterAus(muster),
    strukturhinweis: strukturhinweisAus(muster),
    schwachstellen: schwachstellenAus(skalen),
  };
}
