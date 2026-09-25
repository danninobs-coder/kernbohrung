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
import { FENSTER, findeAbschriften, lektionFelder, liesRohIndex } from './wortlaut.mjs';
// FRONTMATTER und widgetAufrufe stehen in werkzeug/lektion-lesen.mjs: Der
// Wortlaut-Abgleich liest eine Lektion genauso wie diese Pruefung, ohne dass
// eines der beiden Module das andere importiert. Weiterexportiert, damit ein
// vorhandener Import von hier gueltig bleibt.
import { FRONTMATTER, widgetAufrufe } from './lektion-lesen.mjs';

export { FRONTMATTER, widgetAufrufe };

/**
 * Prueft eine Lektion, bevor sie geschrieben wird.
 *
 * Beide Schranken an einer Stelle: das Frontmatter gegen LektionSchema, jeder
 * Widget-Aufruf im Rumpf gegen pruefeWidget. Genau dafuer wurden beide Module
 * in Abschnitt 1 so geschnitten, dass ein reiner Node-Prozess sie laden kann.
 * Die Kommandozeile prueft danach den Wortlaut gegen die Rohdateien
 * (`pruefeWortlaut`).
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
 * Der Wortlaut einer Lektion gegen den Index der Rohdateien (werkzeug/wortlaut.mjs):
 * je Abschrift ein Mangel. Die Meldung nennt Quelle, Abschnitt, Folie, Feld
 * und Wortbereich — nie den Text, denn der gehoert den Verfassern der Quelle.
 * Eine Rohdatei ohne Seitenmarken (Folie 0) wird ohne Folie genannt.
 *
 * @param {string} text Inhalt einer .mdx-Datei
 * @param {import('./wortlaut.mjs').Index} index
 * @returns {string[]}
 */
export function pruefeWortlaut(text, index) {
  return findeAbschriften(lektionFelder(text), index).map(({ feld, von, bis, quelle, abschnitt, folie }) => {
    const fundort = folie === 0 ? `${quelle}/${abschnitt}` : `${quelle}/${abschnitt}, Folie ${folie}`;
    return `Wortlaut: ${FENSTER} Wörter am Stück wie in ${fundort} — Feld ${feld}, Wörter ${von}–${bis}.`;
  });
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

/**
 * Der Code eines gescheiterten Dateizugriffs (`ENOENT`, `EISDIR`, …), sonst
 * der Name des Fehlers. Gleiches Muster wie `fehlercode` in
 * werkzeug/adapter/folien.mjs.
 *
 * @param {unknown} fehler
 * @returns {string}
 */
function fehlercode(fehler) {
  if (!(fehler instanceof Error)) return String(fehler);
  const code = /** @type {Error & { code?: unknown }} */ (fehler).code;
  return typeof code === 'string' ? code : fehler.name;
}

if (direktAufgerufen) {
  const dateien = process.argv.slice(2);
  if (dateien.length === 0) {
    console.error('Aufruf: node werkzeug/pruefe-lektion.mjs <datei.mdx> [<datei.mdx> …]');
    process.exitCode = 2;
  } else {
    // Der Index einmal je Aufruf, nicht je Datei: Er umfasst alle Rohdateien
    // unter quellen/ im Arbeitsverzeichnis, auch Nachbarabschnitte, und fehlt
    // quellen/ (ein Klon von GitHub), heisst es „nicht geprueft".
    const roh = liesRohIndex(process.cwd());
    let abschriften = 0;
    // Eine fehlende oder unlesbare Datei bricht die uebrigen nicht ab: jede
    // Datei einzeln abgefangen, am Ende Exit 2 statt des sonstigen 0/1 —
    // sonst entfielen mit einer nicht aufgeloesten *.mdx (etwa unter
    // PowerShell) alle folgenden Dateien und die Wortlaut-Zeile mit einem
    // Stapelabzug.
    let fehlendeDatei = false;
    for (const datei of dateien) {
      /** @type {string} */
      let text;
      try {
        text = readFileSync(datei, 'utf8');
      } catch (fehler) {
        fehlendeDatei = true;
        const code = fehlercode(fehler);
        console.error(code === 'ENOENT' ? `${datei}: gibt es nicht.` : `${datei}: lässt sich nicht lesen (${code}).`);
        continue;
      }
      const ergebnis = pruefeLektionsText(text);
      const wortlaut = roh === null ? [] : pruefeWortlaut(text, roh.index);
      abschriften += wortlaut.length;
      const maengel = [...(ergebnis.ok ? [] : ergebnis.maengel), ...wortlaut];
      if (maengel.length === 0) {
        console.log(`${datei}: in Ordnung`);
      } else {
        console.error(`${datei}: ${maengel.length} Mangel/Mängel\n`);
        for (const m of maengel) console.error(`  - ${m}`);
        process.exitCode = 1;
      }
    }
    // Ohne Rohdateien kein Mangel — aber auch kein „in Ordnung".
    if (roh === null) console.log('Wortlaut nicht geprüft: keine Rohdateien am Rechner.');
    else if (abschriften === 0) {
      const wort = roh.dateien === 1 ? 'Rohdatei' : 'Rohdateien';
      console.log(`Wortlaut: in Ordnung (${roh.dateien} ${wort}).`);
    }
    if (fehlendeDatei) process.exitCode = 2;
  }
}
