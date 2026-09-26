// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
// Benannter Import wie in werkzeug/pruefe-lektion.mjs: js-yaml 5 ist ein
// ESM-Buendel ohne Default-Export.
import { load as yamlLesen } from 'js-yaml';

/**
 * Haelt SKILL.md, README.md, package.json und die Werkzeuge zusammen.
 *
 * Jeder `npm run <name>`-Aufruf in SKILL.md oder in der Befehlstabelle des
 * README braucht ein gleichnamiges Skript in package.json - sonst tippt der
 * Compiler-Skill (oder ein Mensch, der dem README folgt) einen Befehl ab, den
 * es gar nicht gibt. Dasselbe gilt fuer jede Option hinter `--`: Das Werkzeug
 * muss sie kennen. Und das Frontmatter des Skills muss YAML bleiben, sonst
 * listet Claude Code den Skill ohne Beschreibung und damit ohne Ausloeser.
 * Gelesen werden SKILL.md, README.md, package.json und werkzeug/*.mjs aus dem
 * Repo; das ist hier erlaubt, anders als bei quellen/, das kein Test anfassen
 * darf.
 */

const wurzel = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const skillText = readFileSync(
  path.join(wurzel, '.claude', 'skills', 'kernbohrung-compiler', 'SKILL.md'),
  'utf8',
);
const readmeText = readFileSync(path.join(wurzel, 'README.md'), 'utf8');
const skripte: Record<string, unknown> = JSON.parse(
  readFileSync(path.join(wurzel, 'package.json'), 'utf8'),
).scripts;

/** Die Markdown-Tabelle unter der Ueberschrift "Befehle" im README, Zeile fuer Zeile. */
function befehlsTabelle(readme: string): string {
  const start = readme.indexOf('| Befehl | Wirkung |');
  if (start === -1) throw new Error('Befehlstabelle nicht gefunden');
  const zeilen: string[] = [];
  for (const zeile of readme.slice(start).split(/\r?\n/)) {
    if (!zeile.startsWith('|')) break;
    zeilen.push(zeile);
  }
  return zeilen.join('\n');
}

/**
 * Jeder `npm run <name>`-Aufruf in den uebergebenen Texten, der kein Skript
 * gleichen Namens in `skripte` hat - sortiert, leeres Array heisst gedeckt.
 *
 * Text und Skripte kommen als Parameter herein statt ueber einen eigenen
 * Dateizugriff: nur so laesst sich dieselbe Pruefung unten auf einer
 * mutierten Kopie der Skripte wiederholen (Mutationsprobe).
 */
function fehlendeSkripte(texte: string[], skripte: Record<string, unknown>): string[] {
  const namen = new Set<string>();
  for (const text of texte) {
    for (const treffer of text.matchAll(/npm run ([\w:-]+)/g)) namen.add(treffer[1]);
  }
  return [...namen].filter((name) => !Object.hasOwn(skripte, name)).sort();
}

describe('Skill und README - dieselben Befehle wie package.json', () => {
  it('jeder npm-run-Aufruf in SKILL.md und der Befehlstabelle hat ein Skript', () => {
    expect(fehlendeSkripte([skillText, befehlsTabelle(readmeText)], skripte)).toEqual([]);
  });

  it('Mutationsprobe: fehlt ein Skript in der Kopie, faellt dieselbe Pruefung', () => {
    // Kein Diff auf package.json - nur eine Kopie im Speicher verliert einen
    // Eintrag. Zeigt, dass die Probe oben nicht zufaellig gruen ist.
    const kopie = { ...skripte };
    delete kopie.auftrag;
    expect(fehlendeSkripte([skillText, befehlsTabelle(readmeText)], kopie)).toEqual(['auftrag']);
  });
});

/** Eine Datei aus dem Repo, Pfad relativ zur Wurzel. */
function lies(datei: string): string {
  return readFileSync(path.join(wurzel, datei), 'utf8');
}

/**
 * Jede Option, die ein Text hinter `npm run <name> --` nennt und die das
 * Werkzeug nicht kennt - als "<name> --<option>", sortiert; leer heisst
 * gedeckt.
 *
 * "Kennt" heisst: Die Einstiegsdatei des Skripts (`node werkzeug/<x>.mjs` in
 * package.json) nennt die Option als ganzes Wort - in Code, Aufruf-Hilfe oder
 * Kommentar; `--folie` zaehlt also nicht als `--folien`. Das faengt Tippfehler
 * in SKILL.md und README, nicht ein Werkzeug, das eine Option verliert: Bei
 * `ingest` steht sie nur in der Hilfe der Weiche, gelesen wird sie in
 * ingest-git.mjs bzw. ingest-folien.mjs. Gelesen wird bis zum Zeilenende oder
 * zum Ende des Code-Spans. Skripte, die nicht mit `node` starten (astro,
 * vitest), bleiben aussen vor.
 */
function unbekannteOptionen(
  texte: string[],
  skripte: Record<string, unknown>,
  lesen: (datei: string) => string,
): string[] {
  const fehlend = new Set<string>();
  for (const text of texte) {
    for (const [, name, rest] of text.matchAll(/npm run ([\w:-]+) -- ([^`\n]*)/g)) {
      const skript = skripte[name];
      const einstieg = typeof skript === 'string' ? /^node (\S+\.mjs)/.exec(skript) : null;
      if (einstieg === null) continue;
      const quelltext = lesen(einstieg[1]);
      for (const [option] of rest.matchAll(/--[a-z][\w-]*/g)) {
        if (!new RegExp(`(?<![\\w-])${option}(?![\\w-])`).test(quelltext)) {
          fehlend.add(`${name} ${option}`);
        }
      }
    }
  }
  return [...fehlend].sort();
}

describe('Skill und README - Optionen, die die Werkzeuge kennen', () => {
  it('jede Option hinter npm run <name> -- in SKILL.md und README kennt das Werkzeug', () => {
    expect(unbekannteOptionen([skillText, readmeText], skripte, lies)).toEqual([]);
  });

  it('Mutationsprobe: eine vertippte Option faellt auf, auch als Praefix einer echten', () => {
    const vertippt = skillText.replace('--folien <liste>', '--folie <liste>');
    expect(vertippt).not.toBe(skillText);
    expect(unbekannteOptionen([vertippt], skripte, lies)).toEqual(['ansicht --folie']);
  });
});

/** Das Frontmatter zwischen den beiden `---`-Zeilen am Anfang. */
function frontmatter(text: string): string {
  const kopf = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(text);
  if (kopf === null) throw new Error('SKILL.md beginnt nicht mit einem Frontmatter');
  return kopf[1];
}

describe('SKILL.md - Frontmatter', () => {
  it('ist gueltiges YAML und traegt Name und Ausloeser', () => {
    const daten = yamlLesen(frontmatter(skillText)) as { name?: unknown; description?: unknown };
    expect(daten.name).toBe('kernbohrung-compiler');
    expect(daten.description).toEqual(expect.stringContaining('destilliere rag_tutorials'));
    expect(daten.description).toEqual(expect.stringContaining('Bau die Lektionen für'));
  });

  it('Mutationsprobe: ein ": " in der Beschreibung macht das YAML ungueltig', () => {
    // Genau so war es in 467bd4a: Claude Code listete den Skill danach nur
    // noch unter seinem Titel, ohne Beschreibung und ohne Ausloeser.
    const kaputt = frontmatter(skillText).replace('(Folien, Bücher) gilt', '(Folien, Bücher): gilt');
    expect(kaputt).not.toBe(frontmatter(skillText));
    expect(() => yamlLesen(kaputt)).toThrow();
  });
});

describe('SKILL.md - Durchgang fuer Lehrmaterial', () => {
  it('enthaelt die Ueberschrift und die Unterueberschriften L0 bis L8 in dieser Reihenfolge', () => {
    const hauptIdx = skillText.indexOf('## Durchgang für Lehrmaterial');
    expect(hauptIdx).toBeGreaterThan(-1);

    const treffer = [...skillText.matchAll(/^### (L\d+)\b/gm)];
    expect(treffer.map((m) => m[1])).toEqual(['L0', 'L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8']);
    expect(treffer[0].index).toBeGreaterThan(hauptIdx);
  });
});
