/**
 * Das Lehrplan-Geruest, das das Einlesen anlegt — und der Vergleich mit einem,
 * der schon da ist.
 *
 * Geschrieben wird von Hand und nicht mit `yaml.dump`: Die Datei ist die, an
 * der ein Mensch am Review-Gate sitzt. Reihenfolge, Anfuehrungszeichen und der
 * Kopfkommentar sollen deshalb festliegen und nicht von der Voreinstellung
 * einer Bibliothek abhaengen. Zweimal erzeugt ergibt dasselbe Byte fuer Byte.
 *
 * **Ein vorhandener Lehrplan wird nie ueberschrieben.** In ihm steckt die
 * Arbeit des Compilers und die Freigabe eines Menschen; `quellen/` ist
 * abgeleitet, der Lehrplan ist es nicht.
 */
import { load as yamlLesen } from 'js-yaml';

/**
 * @typedef {{ id: string, titel: string, datei: string, seiten: [number, number] }} Abschnitt
 * @typedef {{
 *   stand: { alt: string, neu: string, geaendert: boolean },
 *   neue: string[],
 *   fehlende: string[],
 *   verschobene: { id: string, alt: [number, number], neu: [number, number] }[],
 *   unveraendert: number,
 * }} Vergleich
 */

/**
 * Ein Wert in doppelten Anfuehrungszeichen.
 *
 * Immer, nicht nur wo noetig: Ein Titel aus einer Folie kann mit einem
 * Doppelpunkt, einem Bindestrich oder einer Zahl anfangen, und YAML liest
 * dann etwas anderes als Text. Ein Titel, der `"` oder `\` enthaelt, wird
 * maskiert.
 *
 * @param {string} wert
 * @returns {string}
 */
function inAnfuehrung(wert) {
  return `"${wert.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
}

/**
 * Der Text des Lehrplans, den das Einlesen anlegt.
 *
 * Alle Abschnitte stehen als `offen` da, und `geprueftVon`/`geprueftAm` sind
 * leer: Das ist der Zustand „wartet auf Freigabe" — die Seite zeigt die
 * Zahlen und markiert sie, der Compiler baut daraus noch nichts.
 *
 * @param {{ kurzname: string, titel: string, stand: string, abschnitte: readonly Abschnitt[] }} eingabe
 * @returns {string}
 */
export function lehrplanGeruest({ kurzname, titel, stand, abschnitte }) {
  const zeilen = [
    '# Diese Datei hat das Einlesen angelegt (npm run ingest -- --folien … --name ' + kurzname + ').',
    '# Die Freigabe traegt ein Mensch von Hand ein: geprueftVon und geprueftAm.',
    '# Bis dahin zeigt die Bibliothek die Zahlen und baut der Compiler keine Lektionen.',
    'art: folien',
    `quelle: ${kurzname}`,
    `titel: ${inAnfuehrung(titel)}`,
    `stand: ${inAnfuehrung(stand)}`,
    'geprueftVon: ""',
    'geprueftAm: ""',
    'abschnitte:',
  ];
  for (const a of abschnitte) {
    zeilen.push(
      `  - id: ${a.id}`,
      `    titel: ${inAnfuehrung(a.titel)}`,
      `    datei: ${inAnfuehrung(a.datei)}`,
      `    seiten: [${a.seiten[0]}, ${a.seiten[1]}]`,
      '    status: offen',
    );
  }
  return `${zeilen.join('\n')}\n`;
}

/**
 * Was sich gegenueber einem vorhandenen Lehrplan geaendert hat.
 *
 * Verglichen wird ueber die Abschnitt-Id. Der Slug haengt am Titel: Aendert
 * der Verfasser eine Agendazeile, heisst derselbe Abschnitt beim naechsten
 * Einlesen anders und erscheint hier als „neu" und „fehlt". Das ist unschoen,
 * aber ehrlich — und deshalb entscheidet ein Mensch, was damit geschieht, und
 * nicht dieses Werkzeug.
 *
 * @param {string} altesYaml
 * @param {{ stand: string, abschnitte: readonly Abschnitt[] }} neu
 * @returns {Vergleich}
 */
export function vergleicheLehrplan(altesYaml, neu) {
  const geladen = yamlLesen(altesYaml);
  const alt = typeof geladen === 'object' && geladen !== null ? /** @type {Record<string, unknown>} */ (geladen) : {};
  const alteAbschnitte = Array.isArray(alt.abschnitte) ? alt.abschnitte : [];
  /** @type {Map<string, [number, number]>} */
  const alteSeiten = new Map();
  for (const a of alteAbschnitte) {
    if (a && typeof a === 'object' && typeof a.id === 'string' && Array.isArray(a.seiten)) {
      alteSeiten.set(a.id, [Number(a.seiten[0]), Number(a.seiten[1])]);
    }
  }
  const neueIds = new Set(neu.abschnitte.map((a) => a.id));

  /** @type {{ id: string, alt: [number, number], neu: [number, number] }[]} */
  const verschobene = [];
  let unveraendert = 0;
  for (const a of neu.abschnitte) {
    const vorher = alteSeiten.get(a.id);
    if (!vorher) continue;
    if (vorher[0] === a.seiten[0] && vorher[1] === a.seiten[1]) unveraendert++;
    else verschobene.push({ id: a.id, alt: vorher, neu: a.seiten });
  }

  const altStand = typeof alt.stand === 'string' ? alt.stand : '';
  return {
    stand: { alt: altStand, neu: neu.stand, geaendert: altStand !== neu.stand },
    neue: neu.abschnitte.filter((a) => !alteSeiten.has(a.id)).map((a) => a.id),
    fehlende: [...alteSeiten.keys()].filter((id) => !neueIds.has(id)),
    verschobene,
    unveraendert,
  };
}

/**
 * Der Vergleich in Zeilen fuer die Konsole. Nur Ids, Zahlen und Seitenbereiche
 * — kein Folientext.
 *
 * @param {Vergleich} vergleich
 * @returns {string[]}
 */
export function vergleichInZeilen(vergleich) {
  if (
    !vergleich.stand.geaendert &&
    vergleich.neue.length === 0 &&
    vergleich.fehlende.length === 0 &&
    vergleich.verschobene.length === 0
  ) {
    return ['keine Änderung'];
  }
  const zeilen = [];
  if (vergleich.stand.geaendert) {
    zeilen.push(`Stand geändert: ${vergleich.stand.alt || '(keiner)'} → ${vergleich.stand.neu}`);
  }
  if (vergleich.neue.length) zeilen.push(`neu: ${vergleich.neue.join(', ')}`);
  if (vergleich.fehlende.length) zeilen.push(`fehlt jetzt: ${vergleich.fehlende.join(', ')}`);
  for (const v of vergleich.verschobene) {
    zeilen.push(`verschoben: ${v.id} ${v.alt[0]}–${v.alt[1]} → ${v.neu[0]}–${v.neu[1]}`);
  }
  return zeilen;
}
