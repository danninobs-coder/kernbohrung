import type { Abschnitt, Lehrplan, Prinzip, Status } from './lehrplan';
import type { Manifestauszug } from './manifestauszug';

/**
 * Die Abdeckung: wie weit jede Quelle in Lektionen steckt.
 *
 * Rein — kein Dateizugriff, kein Astro. Das Einlesen passiert in der Seite
 * /bibliothek zur Bauzeit; hier wird nur verrechnet. Die Lehrplaene sind
 * gegen dieselben `lektionsIds` geprueft (`pruefeLehrplan`): Ein Abschnitt
 * mit `status: lektion` zeigt deshalb auf eine Lektion, die es gibt.
 *
 * Fuer Repos gilt ein Prinzip als abgedeckt, wenn es eine Lektion mit
 * derselben Id gibt. Fuer Buch und Folien zaehlt der Status, den der Lehrplan
 * je Abschnitt fuehrt.
 */

export type Zeile = {
  /** Prinzip-Id (Repo) oder Abschnitt-Id (Buch, Folien). */
  readonly id: string;
  /** Der Satz des Prinzips oder der Titel des Abschnitts. */
  readonly titel: string;
  readonly status: Status;
  /** Die Lektion, auf die die Zeile zeigt — nur bei `lektion`. */
  readonly lektion?: string;
  /** Warum abgelehnt — nur bei `abgelehnt`. */
  readonly grund?: string;
  /** Wo der Abschnitt im Original steht — nur bei Buch und Folien. */
  readonly datei?: string;
  readonly seiten?: readonly [number, number];
  /** Die Vorbehalte der Prinzipien dieser Zeile; leer, wenn es keine gibt. */
  readonly vorbehalte: readonly string[];
};

export type Zaehlung = {
  readonly gesamt: number;
  readonly mitLektion: number;
  readonly offen: number;
  readonly beauftragt: number;
  readonly abgelehnt: number;
};

/**
 * Was die Quelle nicht hergibt — oder warum das hier niemand sagen kann.
 *
 * Die drei letzten Faelle sind keine Fehler, sondern Auskuenfte: Ohne
 * Manifest, mit einem unlesbaren oder mit einem zu einem anderen Stand zeigt
 * die Seite keine Zahl. Eine Zahl aus dem falschen Manifest waere schlimmer
 * als keine — sie liesse den Bestand vollstaendiger aussehen, als er ist.
 */
export type Luecken =
  | { readonly art: 'git'; readonly uebernommen: number; readonly ausgelassen: number }
  | {
      readonly art: 'dokument';
      readonly einheit: 'folien' | 'seiten';
      readonly seiten: number;
      readonly nurBild: number;
      readonly tabellenverdacht: number;
    }
  | { readonly art: 'fehlt' }
  | { readonly art: 'anderer-stand' }
  | { readonly art: 'unlesbar'; readonly grund: string };

export type Bestand = {
  readonly quelle: string;
  readonly art: Lehrplan['art'];
  /** Bei Buch und Folien der Titel, bei Repos der Kurzname. */
  readonly titel: string;
  readonly stand: string;
  readonly isbn?: string;
  readonly auflage?: string;
  readonly zaehlung: Zaehlung;
  readonly luecken: Luecken;
  readonly zeilen: readonly Zeile[];
};

export type Abdeckung = {
  /** Eine Karte je Quelle, nach Kurzname sortiert. */
  readonly bestand: readonly Bestand[];
  /**
   * Lektionen, auf die kein Prinzip und kein Abschnitt zeigt, sortiert. Die
   * Seite zeigt sie als Warnung und nie als Abdeckung: Eine Lektion, deren
   * Herkunft kein Lehrplan kennt, ist genau die Behauptung ohne Quelle, die
   * das Projekt ausschliesst.
   */
  readonly ohneLehrplan: readonly string[];
};

/**
 * Eigener Vergleich statt `localeCompare`: Der haengt an der
 * Spracheinstellung des Rechners, und der Bau soll ueberall dieselbe Seite
 * ergeben.
 */
function vergleiche(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function vorbehalteVon(prinzipien: readonly Prinzip[]): string[] {
  return prinzipien.flatMap((p) => (p.vorbehalt === undefined ? [] : [p.vorbehalt]));
}

function zeilenAusPrinzipien(prinzipien: readonly Prinzip[], lektionsIds: ReadonlySet<string>): Zeile[] {
  return prinzipien.map((p) => {
    const abgedeckt = lektionsIds.has(p.id);
    return {
      id: p.id,
      titel: p.satz,
      status: abgedeckt ? 'lektion' : 'offen',
      lektion: abgedeckt ? p.id : undefined,
      vorbehalte: vorbehalteVon([p]),
    };
  });
}

function zeilenAusAbschnitten(abschnitte: readonly Abschnitt[]): Zeile[] {
  return abschnitte.map((a) => ({
    id: a.id,
    titel: a.titel,
    status: a.status,
    lektion: a.lektion,
    grund: a.grund,
    datei: a.datei,
    seiten: a.seiten,
    vorbehalte: vorbehalteVon(a.prinzipien),
  }));
}

function zaehle(zeilen: readonly Zeile[]): Zaehlung {
  const anzahl = (status: Status) => zeilen.filter((z) => z.status === status).length;
  return {
    gesamt: zeilen.length,
    mitLektion: anzahl('lektion'),
    offen: anzahl('offen'),
    beauftragt: anzahl('beauftragt'),
    abgelehnt: anzahl('abgelehnt'),
  };
}

/**
 * Ein Manifest zaehlt nur fuer genau den Stand, den der Lehrplan beschreibt.
 * Wer eine Quelle neu einliest, ohne den Lehrplan nachzuziehen, hat ein
 * Manifest zu einem anderen Stand — dessen Zahlen gehoeren nicht zu diesem
 * Bestand. Dasselbe gilt fuer ein Manifest der falschen Art.
 */
function lueckenVon(lehrplan: Lehrplan, manifest: Manifestauszug | undefined): Luecken {
  if (manifest === undefined) return { art: 'fehlt' };
  if (manifest.art === 'unlesbar') return { art: 'unlesbar', grund: manifest.grund };
  if (manifest.stand !== lehrplan.stand) return { art: 'anderer-stand' };

  if (lehrplan.art === 'repo') {
    return manifest.art === 'git'
      ? { art: 'git', uebernommen: manifest.uebernommen, ausgelassen: manifest.ausgelassen }
      : { art: 'anderer-stand' };
  }
  return manifest.art === 'dokument'
    ? {
        art: 'dokument',
        einheit: lehrplan.art === 'folien' ? 'folien' : 'seiten',
        seiten: manifest.seiten,
        nurBild: manifest.nurBild,
        tabellenverdacht: manifest.tabellenverdacht,
      }
    : { art: 'anderer-stand' };
}

export function abdeckung(
  lehrplaene: readonly Lehrplan[],
  manifeste: ReadonlyMap<string, Manifestauszug>,
  lektionsIds: ReadonlySet<string>,
): Abdeckung {
  const bestand = [...lehrplaene]
    .sort((a, b) => vergleiche(a.quelle, b.quelle))
    .map((l): Bestand => {
      const zeilen =
        l.art === 'repo' ? zeilenAusPrinzipien(l.prinzipien, lektionsIds) : zeilenAusAbschnitten(l.abschnitte);
      return {
        quelle: l.quelle,
        art: l.art,
        titel: l.art === 'repo' ? l.quelle : l.titel,
        stand: l.stand,
        isbn: l.art === 'buch' ? l.isbn : undefined,
        auflage: l.art === 'buch' ? l.auflage : undefined,
        zaehlung: zaehle(zeilen),
        luecken: lueckenVon(l, manifeste.get(l.quelle)),
        zeilen,
      };
    });

  const bekannt = new Set(bestand.flatMap((b) => b.zeilen.flatMap((z) => (z.lektion === undefined ? [] : [z.lektion]))));
  const ohneLehrplan = [...lektionsIds].filter((id) => !bekannt.has(id)).sort(vergleiche);
  return { bestand, ohneLehrplan };
}
