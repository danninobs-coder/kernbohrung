// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * Haelt SKILL.md, README.md und package.json zusammen.
 *
 * Jeder `npm run <name>`-Aufruf in SKILL.md oder in der Befehlstabelle des
 * README braucht ein gleichnamiges Skript in package.json - sonst tippt der
 * Compiler-Skill (oder ein Mensch, der dem README folgt) einen Befehl ab, den
 * es gar nicht gibt. Gelesen werden SKILL.md, README.md und package.json aus
 * dem Repo; das ist hier erlaubt, anders als bei quellen/, das kein Test
 * anfassen darf.
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

describe('SKILL.md - Durchgang fuer Lehrmaterial', () => {
  it('enthaelt die Ueberschrift und die Unterueberschriften L0 bis L8 in dieser Reihenfolge', () => {
    const hauptIdx = skillText.indexOf('## Durchgang für Lehrmaterial');
    expect(hauptIdx).toBeGreaterThan(-1);

    const treffer = [...skillText.matchAll(/^### (L\d+)\b/gm)];
    expect(treffer.map((m) => m[1])).toEqual(['L0', 'L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8']);
    expect(treffer[0].index).toBeGreaterThan(hauptIdx);
  });
});
