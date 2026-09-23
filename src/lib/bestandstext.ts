import type { Bestand, Luecken, Zeile } from './abdeckung';
import type { Status } from './lehrplan';

/**
 * Was die Bibliothek ueber den Bestand in Worten sagt — an einer Stelle und
 * getestet, Zeichen fuer Zeichen.
 *
 * Die Regel fuer jeden Satz hier: Er behauptet nur, was die Daten tragen.
 * Deshalb „vermutlich zerfallen" und nicht „zerfallen" (das Manifest fuehrt
 * einen Verdacht), „unbekannt" statt einer Null, wo kein Manifest da ist, und
 * „keine … erkannt" statt „vollstaendig".
 */

const ART_TEXT: Readonly<Record<Bestand['art'], string>> = {
  repo: 'Repo',
  buch: 'Buch',
  folien: 'Folien',
};

/** Dieselben Worte wie in der Zahlenzeile — ein Status heisst ueberall gleich. */
export const STATUS_TEXT: Readonly<Record<Status, string>> = {
  lektion: 'mit Lektion',
  offen: 'offen',
  beauftragt: 'beauftragt',
  abgelehnt: 'abgelehnt',
};

/** `1 Prinzip`, `2 Prinzipien`. */
function anzahl(n: number, einzahl: string, mehrzahl: string): string {
  return `${n} ${n === 1 ? einzahl : mehrzahl}`;
}

/** Die ersten sieben Zeichen — bei `sha256:…` die ersten sieben danach. */
export function kurzstand(stand: string): string {
  const praefix = 'sha256:';
  return stand.startsWith(praefix) ? stand.slice(0, praefix.length + 7) : stand.slice(0, 7);
}

/**
 * `Repo · Stand a13701e` — beim Buch mit ISBN und Auflage, wenn der Lehrplan
 * sie kennt. Die Auflage steht dort ausgeschrieben (`3. Auflage`) und hier so,
 * wie sie dort steht.
 */
export function kopfzeile(b: Bestand): string {
  return [
    ART_TEXT[b.art],
    `Stand ${kurzstand(b.stand)}`,
    ...(b.isbn === undefined ? [] : [`ISBN ${b.isbn}`]),
    ...(b.auflage === undefined ? [] : [b.auflage]),
  ].join(' · ');
}

/**
 * `6 Prinzipien · 3 mit Lektion · 3 offen`, bei Lehrmaterial
 * `38 Abschnitte · 11 mit Lektion · 22 offen · 5 abgelehnt`.
 *
 * „mit Lektion" und „offen" stehen immer da, auch mit Null — sie sind die
 * Abdeckung selbst. „beauftragt" und „abgelehnt" nur, wenn es sie gibt: Ein
 * Repo kennt beides nicht, und eine Null dort wuerde einen Zustand
 * vortaeuschen, den es gar nicht haben kann.
 */
export function zahlenzeile(b: Bestand): string {
  const z = b.zaehlung;
  return [
    b.art === 'repo' ? anzahl(z.gesamt, 'Prinzip', 'Prinzipien') : anzahl(z.gesamt, 'Abschnitt', 'Abschnitte'),
    `${z.mitLektion} mit Lektion`,
    `${z.offen} offen`,
    ...(z.beauftragt > 0 ? [`${z.beauftragt} beauftragt`] : []),
    ...(z.abgelehnt > 0 ? [`${z.abgelehnt} abgelehnt`] : []),
  ].join(' · ');
}

/**
 * Was hinter „Lücken:" steht. Auch ohne Manifest steht dort etwas: Eine
 * fehlende Zeile liesse den Bestand vollstaendig aussehen — genau das, was
 * sie verhindern soll.
 */
export function lueckenzeile(l: Luecken): string {
  switch (l.art) {
    case 'git':
      return l.ausgelassen === 0
        ? 'keine Datei ausgelassen'
        : `${l.ausgelassen} von ${anzahl(l.uebernommen + l.ausgelassen, 'Datei', 'Dateien')} nicht übernommen`;
    case 'dokument': {
      const [eine, viele] = l.einheit === 'folien' ? ['Folie', 'Folien'] : ['Seite', 'Seiten'];
      const teile = [
        ...(l.nurBild > 0 ? [`${l.nurBild} von ${anzahl(l.seiten, eine, viele)} nur Bild`] : []),
        // Nicht „Tabellen vermutlich zerfallen": Die Regel schlaegt auch bei
        // Diagrammen an, und zwar zu Recht — der Text eines Strukturplans
        // traegt dessen Hierarchie nicht. Gemessen an einem Foliensatz mit
        // Projektstrukturplaenen: 14 von 45 Folien.
        ...(l.tabellenverdacht > 0 ? [`${anzahl(l.tabellenverdacht, eine, viele)} mit Tabelle oder Grafik`] : []),
      ];
      return teile.length > 0 ? teile.join(' · ') : `keine ${eine} nur Bild, keine mit Tabelle oder Grafik erkannt`;
    }
    case 'fehlt':
      return 'unbekannt — das Manifest liegt nur am Rechner, auf dem eingelesen wurde';
    case 'anderer-stand':
      return 'unbekannt — das Manifest gehört zu einem anderen Stand';
    case 'unlesbar':
      return `unbekannt — das Manifest lässt sich nicht lesen (${l.grund})`;
  }
}

/**
 * Der Satz unter der Kopfzeile, solange die Freigabe fehlt — oder `null`,
 * wenn sie erteilt ist. Er sagt, was fehlt und was deshalb nicht passiert:
 * Die Zahlen stimmen, der Compiler baut daraus aber noch keine Lektionen.
 */
export function freigabezeile(b: Bestand): string | null {
  return b.freigabe === 'wartet'
    ? 'Erst wenn geprueftVon und geprueftAm eingetragen sind, baut der Compiler daraus Lektionen.'
    : null;
}

/** `M7 Risikomanagement 26.pdf, Folien 28–34` — oder `null` bei einem Prinzip aus einem Repo. */
export function fundstelle(art: Bestand['art'], z: Zeile): string | null {
  if (z.datei === undefined || z.seiten === undefined) return null;
  const [von, bis] = z.seiten;
  const [eine, viele] = art === 'folien' ? ['Folie', 'Folien'] : ['Seite', 'Seiten'];
  return `${z.datei}, ${von === bis ? `${eine} ${von}` : `${viele} ${von}–${bis}`}`;
}

/**
 * Die Beschriftung des Knopfs, der die Liste aufklappt — mit dem Titel der
 * Quelle, sonst tragen mehrere `summary` derselben Art denselben Text und
 * sind in der Elementliste eines Screenreaders nicht zu unterscheiden.
 */
export function aufklapptext(b: Bestand): string {
  return `${b.art === 'repo' ? 'Alle Prinzipien' : 'Alle Abschnitte'} von ${b.titel}`;
}
