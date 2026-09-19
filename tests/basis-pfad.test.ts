import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * Auf GitHub Pages liegt die App nicht unter `/`, sondern unter
 * `/kernbohrung/`. Ein Link wie `href="/lektion/…"` fuehrt dort ins Leere —
 * lautlos, denn lokal unter `/` funktioniert er einwandfrei, und der Build
 * meldet nichts. Deshalb muss jeder interne Link ueber
 * `import.meta.env.BASE_URL` gebildet werden.
 *
 * Geprueft werden nur eigene Seiten und Layouts. Externe Adressen (https://…)
 * und Anker (#…) sind erlaubt.
 */
const wurzel = path.resolve(__dirname, '..');

function alleDateien(ordner: string): string[] {
  return readdirSync(ordner).flatMap((name) => {
    const voll = path.join(ordner, name);
    return statSync(voll).isDirectory() ? alleDateien(voll) : [voll];
  });
}

const kandidaten = [
  ...alleDateien(path.join(wurzel, 'src', 'pages')),
  ...alleDateien(path.join(wurzel, 'src', 'layouts')),
  ...alleDateien(path.join(wurzel, 'src', 'components')),
].filter((datei) => /\.(astro|tsx)$/.test(datei));

describe('Basispfad', () => {
  it('kennt Seiten und Layouts', () => {
    expect(kandidaten.length).toBeGreaterThan(0);
  });

  it.each(kandidaten.map((datei) => [path.relative(wurzel, datei), datei]))(
    '%s enthaelt keinen absoluten Wurzel-Link',
    (_name, datei) => {
      const quelle = readFileSync(datei, 'utf8');
      // href="/…" oder src="/…" mit einem einzelnen Schraegstrich am Anfang;
      // `//` (protokollrelativ) ist absichtlich nicht betroffen.
      const treffer = quelle.match(/\b(href|src)=["']\/(?!\/)[^"']*["']/g) ?? [];
      expect(treffer).toEqual([]);
    },
  );

  it('das Manifest verweist nur relativ, damit es mit jedem Basispfad geht', () => {
    const manifest = JSON.parse(
      readFileSync(path.join(wurzel, 'public', 'manifest.webmanifest'), 'utf8'),
    ) as { start_url: string; scope: string; icons: { src: string }[] };
    expect(manifest.start_url.startsWith('/')).toBe(false);
    expect(manifest.scope.startsWith('/')).toBe(false);
    for (const icon of manifest.icons) expect(icon.src.startsWith('/')).toBe(false);
  });
});
