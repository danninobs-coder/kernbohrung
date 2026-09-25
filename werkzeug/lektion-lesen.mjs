/**
 * Eine Lektion lesen: Frontmatter vom Rumpf trennen, Widget-Aufrufe im Rumpf
 * finden und ihre Parameter auswerten.
 *
 * Eigene Datei, damit die Schema-Pruefung (`pruefe-lektion.mjs`) und der
 * Wortlaut-Abgleich (`wortlaut.mjs`) beide von hier lesen koennen, ohne dass
 * eines der beiden Module das andere importiert — sie zerlegen eine Lektion
 * sonst mit demselben Kopfmuster und demselben Widget-Leser, aber jedes fuer
 * sich, und sehen dann leicht verschiedene Felder.
 *
 * `pruefe-lektion.mjs` exportiert FRONTMATTER und widgetAufrufe weiter, damit
 * ein vorhandener Import von dort gueltig bleibt.
 */

/**
 * Trennt Frontmatter vom Rumpf.
 *
 * `\r?` ist keine Vorsichtsmassnahme, sondern Pflicht: Das Projekt laeuft unter
 * Windows mit `autocrlf=true`, und `inhalt/lektionen/recall-vor-precision.mdx`
 * hat tatsaechlich CRLF. Ohne `\r?` findet das Muster dort keinen Kopf und die
 * Pruefung meldet „kein Frontmatter" — bei einer vollkommen gueltigen Datei.
 *
 * Exportiert fuer den Wortlaut-Abgleich, der die Lektion genauso zerlegt.
 */
export const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

/**
 * Ein gelesener Widget-Aufruf — oder die Meldung, dass er sich nicht lesen liess.
 *
 * @typedef {{ name: string, ok: true, props: unknown }} AufrufGelesen
 * @typedef {{ name: string, ok: false, fehler: string }} AufrufUnlesbar
 * @typedef {AufrufGelesen | AufrufUnlesbar} Aufruf
 */

/**
 * Findet Widget-Aufrufe im MDX-Rumpf und wertet ihre Parameter aus.
 *
 * Die Parameter sind JSX-Ausdruecke aus Literalen — Objekte, Arrays, Strings,
 * Zahlen, Wahrheitswerte. Sie werden in einer Funktion ohne Zugriff auf die
 * Umgebung ausgewertet. Das ist eng genug fuer erzeugten Inhalt und ehrlicher
 * als ein selbstgebauter Halbparser, der bei geschachtelten Klammern falsch
 * liegt — und die stehen im echten Material: Der Pipeline-Aufruf in
 * `recall-vor-precision.mdx` schachtelt Objekte in Arrays in Objekte.
 *
 * Was hier laeuft, sind ausschliesslich Dateien aus dem eigenen Repo, zur
 * Bauzeit, ohne Netz und ohne Fremdeingabe. Eine Datei, die an dieser Stelle
 * etwas anderes als Literale enthaelt, ist ohnehin kein Kandidat fuer die
 * Auslieferung: Der Aufruf schlaegt dann fehl und wird als Mangel gemeldet.
 *
 * @param {string} rumpf
 * @returns {Generator<Aufruf>}
 */
export function* widgetAufrufe(rumpf) {
  const muster = /<([A-Z][A-Za-z0-9]*)\s([\s\S]*?)\/>/g;
  let treffer;
  while ((treffer = muster.exec(rumpf)) !== null) {
    const name = treffer[1];
    try {
      yield { name, ok: true, props: werteProps(treffer[2]) };
    } catch (fehler) {
      const grund = fehler instanceof Error ? fehler.message : String(fehler);
      yield { name, ok: false, fehler: `Parameter nicht auswertbar: ${grund}` };
    }
  }
}

/**
 * @param {string} quelle Der Text zwischen Widget-Namen und `/>`
 * @returns {unknown}
 */
function werteProps(quelle) {
  const paare = [];
  const attribut =
    /([a-zA-Z][a-zA-Z0-9]*)\s*=\s*(\{[\s\S]*?\}|"[^"]*"|'[^']*')(?=\s+[a-zA-Z]|\s*$)/g;
  let t;
  while ((t = attribut.exec(quelle)) !== null) {
    const wert = t[2].startsWith('{') ? t[2].slice(1, -1) : t[2];
    paare.push(`${JSON.stringify(t[1])}: (${wert})`);
  }
  return new Function(`"use strict"; return {${paare.join(',')}};`)();
}
