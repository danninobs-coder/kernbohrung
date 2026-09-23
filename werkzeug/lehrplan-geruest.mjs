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
 * @typedef {{ id: string, alt: string, neu: string }} Aenderung
 * @typedef {{
 *   stand: { alt: string, neu: string, geaendert: boolean },
 *   neue: string[],
 *   fehlende: string[],
 *   verschobene: { id: string, alt: [number, number], neu: [number, number] }[],
 *   andereDatei: Aenderung[],
 *   andererTitel: Aenderung[],
 *   unveraendert: number,
 * }} Vergleich
 */

/**
 * Ein Wert in doppelten Anfuehrungszeichen.
 *
 * Immer, nicht nur wo noetig: Ein Titel aus einer Folie kann mit einem
 * Doppelpunkt, einem Bindestrich oder einer Zahl anfangen, und YAML liest
 * dann etwas anderes als Text. Ein Titel, der `"` oder `\` enthaelt, wird
 * maskiert. Steuerzeichen (U+0000 bis U+001F und U+007F) stehen als `\xNN`
 * da: Roh weist YAML die meisten ab — der ganze Lehrplan waere dann
 * unlesbar —, und ein Tabulator bliebe am Review-Gate unsichtbar.
 *
 * @param {string} wert
 * @returns {string}
 */
function inAnfuehrung(wert) {
  const maskiert = wert
    .replaceAll('\\', '\\\\')
    .replaceAll('"', '\\"')
    .replace(/[\x00-\x1f\x7f]/g, (zeichen) => `\\x${zeichen.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')}`);
  return `"${maskiert}"`;
}

/**
 * Der Text des Lehrplans, den das Einlesen anlegt.
 *
 * Alle Abschnitte stehen als `offen` da, und `geprueftVon`/`geprueftAm` sind
 * leer: Das ist der Zustand „wartet auf Freigabe" — die Seite zeigt die
 * Zahlen und markiert sie, der Compiler baut daraus noch nichts.
 *
 * Auch `quelle` steht in Anfuehrungszeichen, obwohl der Kurzname nur
 * Kleinbuchstaben, Ziffern und Bindestriche traegt: `--name 2024` laese YAML
 * sonst als Zahl, `null` als nichts und `true` als Wahrheitswert — und der
 * Lehrplan gaelte als ungueltig statt als wartend.
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
    `quelle: ${inAnfuehrung(kurzname)}`,
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
 * Unter derselben Id zaehlen Seiten, Datei und Titel, jedes fuer sich. Die
 * Datei vor allem: Heisst `M7 … 26.pdf` ein Jahr spaeter `M7 … 27.pdf`, bleiben
 * die Ids dieselben — ohne diesen Vergleich stuende im Lehrplan still der alte
 * Name, und der Compiler suchte eine Datei, die es nicht mehr gibt. Ein Feld,
 * das im alten Lehrplan kein Text ist, wird nicht verglichen.
 *
 * @param {string} altesYaml
 * @param {{ stand: string, abschnitte: readonly Abschnitt[] }} neu
 * @returns {Vergleich}
 */
export function vergleicheLehrplan(altesYaml, neu) {
  const geladen = yamlLesen(altesYaml);
  const alt = typeof geladen === 'object' && geladen !== null ? /** @type {Record<string, unknown>} */ (geladen) : {};
  const alteAbschnitte = Array.isArray(alt.abschnitte) ? alt.abschnitte : [];
  /** @type {Map<string, { seiten: [number, number], datei: string | null, titel: string | null }>} */
  const vorher = new Map();
  for (const a of alteAbschnitte) {
    if (a && typeof a === 'object' && typeof a.id === 'string' && Array.isArray(a.seiten)) {
      vorher.set(a.id, {
        seiten: [Number(a.seiten[0]), Number(a.seiten[1])],
        datei: typeof a.datei === 'string' ? a.datei : null,
        titel: typeof a.titel === 'string' ? a.titel : null,
      });
    }
  }
  const neueIds = new Set(neu.abschnitte.map((a) => a.id));

  /** @type {Vergleich['verschobene']} */
  const verschobene = [];
  /** @type {Aenderung[]} */
  const andereDatei = [];
  /** @type {Aenderung[]} */
  const andererTitel = [];
  let unveraendert = 0;
  for (const a of neu.abschnitte) {
    const v = vorher.get(a.id);
    if (!v) continue;
    let gleich = true;
    if (v.seiten[0] !== a.seiten[0] || v.seiten[1] !== a.seiten[1]) {
      verschobene.push({ id: a.id, alt: v.seiten, neu: a.seiten });
      gleich = false;
    }
    if (v.datei !== null && v.datei !== a.datei) {
      andereDatei.push({ id: a.id, alt: v.datei, neu: a.datei });
      gleich = false;
    }
    if (v.titel !== null && v.titel !== a.titel) {
      andererTitel.push({ id: a.id, alt: v.titel, neu: a.titel });
      gleich = false;
    }
    if (gleich) unveraendert++;
  }

  const altStand = typeof alt.stand === 'string' ? alt.stand : '';
  return {
    stand: { alt: altStand, neu: neu.stand, geaendert: altStand !== neu.stand },
    neue: neu.abschnitte.filter((a) => !vorher.has(a.id)).map((a) => a.id),
    fehlende: [...vorher.keys()].filter((id) => !neueIds.has(id)),
    verschobene,
    andereDatei,
    andererTitel,
    unveraendert,
  };
}

/**
 * Der Vergleich in Zeilen fuer die Konsole. Nur Ids, Zahlen, Seitenbereiche,
 * Dateinamen und Abschnittstitel — kein Folientext.
 *
 * @param {Vergleich} vergleich
 * @returns {string[]}
 */
export function vergleichInZeilen(vergleich) {
  /** @type {string[]} */
  const zeilen = [];
  if (vergleich.stand.geaendert) {
    zeilen.push(`Stand geändert: ${vergleich.stand.alt || '(keiner)'} → ${vergleich.stand.neu}`);
  }
  if (vergleich.neue.length) zeilen.push(`neu: ${vergleich.neue.join(', ')}`);
  if (vergleich.fehlende.length) zeilen.push(`fehlt jetzt: ${vergleich.fehlende.join(', ')}`);
  for (const v of vergleich.verschobene) {
    zeilen.push(`verschoben: ${v.id} ${v.alt[0]}–${v.alt[1]} → ${v.neu[0]}–${v.neu[1]}`);
  }
  // Dateinamen und Titel tragen Leerzeichen; der Gedankenstrich trennt sie von der Id.
  for (const d of vergleich.andereDatei) zeilen.push(`Datei geändert: ${d.id} — ${d.alt} → ${d.neu}`);
  for (const t of vergleich.andererTitel) zeilen.push(`Titel geändert: ${t.id} — ${t.alt} → ${t.neu}`);
  return zeilen.length ? zeilen : ['keine Änderung'];
}
