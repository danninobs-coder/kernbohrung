#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
// Namentlich, nicht als Vorgabe-Import: js-yaml 5 liefert unter `import` ein
// echtes ESM-Buendel ohne Default-Export. `import yaml from 'js-yaml'` bindet
// dort `undefined`, und `yaml.load(...)` waere ein Absturz zur Laufzeit — bei
// gruener Typpruefung, weil `esModuleInterop` einen Default herbeisynthetisiert.
import { load as yamlLesen } from 'js-yaml';
import { LektionSchema } from '../src/content/schema.ts';
import { pruefeWidget } from '../src/widgets/pruefung.ts';

/**
 * Prueft eine Lektion, bevor sie geschrieben wird.
 *
 * Beide Schranken an einer Stelle: das Frontmatter gegen LektionSchema, jeder
 * Widget-Aufruf im Rumpf gegen pruefeWidget. Genau dafuer wurden beide Module
 * in Abschnitt 1 so geschnitten, dass ein reiner Node-Prozess sie laden kann.
 *
 * Die Typen stehen als JSDoc da, weil `astro check` mit `checkJs` auch
 * `werkzeug/` liest. Wie in `auswahl.mjs` sind `ok: true` und `ok: false`
 * literal notiert: ohne das verbreitert TypeScript sie zu `boolean`, die Union
 * ist nicht mehr unterscheidbar, und jeder Zugriff auf `daten` oder `maengel`
 * gilt als Fehler — obwohl er zur Laufzeit richtig ist.
 *
 * @typedef {import('../src/content/schema.ts').Lektion} Lektion
 * @typedef {{ ok: true, daten: Lektion }} Angenommen
 * @typedef {{ ok: false, maengel: string[] }} Abgelehnt
 * @typedef {Angenommen | Abgelehnt} Befund
 */

/**
 * Trennt Frontmatter vom Rumpf.
 *
 * `\r?` ist keine Vorsichtsmassnahme, sondern Pflicht: Das Projekt laeuft unter
 * Windows mit `autocrlf=true`, und `inhalt/lektionen/recall-vor-precision.mdx`
 * hat tatsaechlich CRLF. Ohne `\r?` findet das Muster dort keinen Kopf und die
 * Pruefung meldet „kein Frontmatter" — bei einer vollkommen gueltigen Datei.
 */
const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

/**
 * @param {string} text Inhalt einer .mdx-Datei
 * @returns {Befund}
 */
export function pruefeLektionsText(text) {
  const treffer = FRONTMATTER.exec(text);
  if (!treffer) {
    return {
      ok: false,
      maengel: [
        'Kein Frontmatter gefunden. Eine Lektion beginnt mit --- und endet den Kopf mit ---.',
      ],
    };
  }

  let kopf;
  try {
    kopf = yamlLesen(treffer[1]);
  } catch (fehler) {
    // `fehler` ist unter `strict` vom Typ `unknown`. Der Griff auf `.message`
    // braucht deshalb eine Verengung, nicht bloss Zuversicht.
    const grund = fehler instanceof Error ? fehler.message : String(fehler);
    return { ok: false, maengel: [`Frontmatter ist kein gueltiges YAML: ${grund}`] };
  }

  /** @type {string[]} */
  const widgetMaengel = [];
  for (const aufruf of widgetAufrufe(treffer[2])) {
    if (!aufruf.ok) {
      widgetMaengel.push(`Widget <${aufruf.name} …/>: ${aufruf.fehler}`);
      continue;
    }
    const ergebnis = pruefeWidget(aufruf.name, aufruf.props);
    if (!ergebnis.ok) widgetMaengel.push(...ergebnis.maengel);
  }

  // Kopf und Rumpf werden in einem Durchgang gemeldet, nicht nacheinander: Der
  // Compiler-Skill soll alles auf einmal zu sehen bekommen, statt sich durch
  // eine Reparaturschleife je Mangel zu tasten.
  const geprueft = LektionSchema.safeParse(kopf);
  if (!geprueft.success) {
    const kopfMaengel = geprueft.error.issues.map(
      (m) => `Frontmatter ${m.path.join('.') || '(Wurzel)'}: ${m.message}`,
    );
    return { ok: false, maengel: [...kopfMaengel, ...widgetMaengel] };
  }
  if (widgetMaengel.length > 0) {
    return { ok: false, maengel: widgetMaengel };
  }

  return { ok: true, daten: geprueft.data };
}

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

/**
 * Wurde die Datei direkt aufgerufen, oder nur importiert?
 *
 * `import.meta.url === \`file://${process.argv[1]}\`` — der naheliegende
 * Vergleich — ist unter Windows immer falsch: `import.meta.url` lautet
 * `file:///C:/…` mit drei Schraegstrichen, die selbstgebaute Seite ergaebe
 * `file://C:/…` mit zweien. Der Block liefe dann nie, das Werkzeug taete auf
 * der Kommandozeile nichts und beendete sich wortlos mit 0. `pathToFileURL`
 * erzeugt genau die Form, die Node auch fuer `import.meta.url` verwendet —
 * samt Laufwerksbuchstabe und URL-Kodierung.
 */
const direktAufgerufen =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (direktAufgerufen) {
  const datei = process.argv[2];
  if (!datei) {
    console.error('Aufruf: node werkzeug/pruefe-lektion.mjs <datei.mdx>');
    process.exit(2);
  }
  const ergebnis = pruefeLektionsText(readFileSync(datei, 'utf8'));
  if (ergebnis.ok) {
    console.log(`${datei}: in Ordnung`);
  } else {
    console.error(`${datei}: ${ergebnis.maengel.length} Mangel/Mängel\n`);
    for (const m of ergebnis.maengel) console.error(`  - ${m}`);
    process.exit(1);
  }
}
