// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

/**
 * Derselbe Vertrag wie in `tests/node-ladbarkeit.test.ts`, fuer den Lehrplan.
 *
 * Der Compiler-Skill prueft seinen Entwurf mit
 * `node -e "import('./werkzeug/lehrplan.mjs')…"` — unter reinem Node, ohne
 * Vite. Seit Fassung 2 zieht das `src/lib/lehrplan.ts` mit, und ein einziger
 * relativer Import ohne Endung legte den Skill lahm, waehrend unter Vitest
 * alles gruen bliebe. Der Unterprozess liest dabei den echten Lehrplan: Das
 * ist zugleich der Nachweis, dass `lehrplan/awesome-llm-apps.yaml` Fassung 2
 * erfuellt.
 */

const wurzel = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const werkzeug = pathToFileURL(path.join(wurzel, 'werkzeug', 'lehrplan.mjs')).href;

describe('werkzeug/lehrplan.mjs aus einem reinen Node-Prozess', () => {
  it('liest den echten Lehrplan so, wie der Compiler-Skill es tut', () => {
    const skript = `
      const { liesLehrplan } = await import(${JSON.stringify(werkzeug)});
      const e = liesLehrplan('lehrplan/awesome-llm-apps.yaml');
      process.stdout.write(JSON.stringify(e.ok ? { ok: true, art: e.lehrplan.art, quelle: e.lehrplan.quelle } : e));
    `;
    const ausgabe = execFileSync(process.execPath, ['--input-type=module', '-e', skript], {
      cwd: wurzel,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    expect(JSON.parse(ausgabe)).toEqual({ ok: true, art: 'repo', quelle: 'awesome-llm-apps' });
  }, 30_000);
});
