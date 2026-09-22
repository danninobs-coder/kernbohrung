// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { loadRenderers } from 'astro:container';
import { getContainerRenderer } from '@astrojs/react/container-renderer';
import LektionAnsicht from '../src/layouts/LektionAnsicht.astro';
import type { Lektion } from '../src/content/schema';

/**
 * Der Vorbehalt steht unter dem Satz — gerendert geprueft, nicht nur gelesen.
 *
 * `tests/lektion-ansicht.test.ts` liest das Markup als Text; das genuegt fuer
 * die Reihenfolge fester Abschnitte. Der Vorbehalt ist aber bedingt: Er darf
 * nur erscheinen, wenn es ihn gibt, und dann nicht als leerer Kasten. Das
 * zeigt nur eine gerenderte Seite. Der Container von Astro rendert sie ohne
 * Bau; die React-Inseln der Probe braucht er als Renderer mit.
 *
 * `experimental_AstroContainer` heisst so, weil Astro die Schnittstelle noch
 * aendern darf. Bricht dieser Test nach einem Update von Astro, liegt es
 * vermutlich daran — nicht am Vorbehalt.
 *
 * Die Umgebung ist `node`, nicht jsdom: Unter jsdom erkennt Astro die
 * Komponente nicht als eigene und meldet „No valid renderer".
 */

const begruendung = (n: number) => `Begruendung Nummer ${n} mit genug Woertern darin.`;
const wahl = (id: string) => ({
  typ: 'wahl' as const,
  id,
  frage: 'Eine Frage?',
  antworten: [
    { text: 'Richtig', richtig: true, begruendung: begruendung(1) },
    { text: 'Falsch A', richtig: false, begruendung: begruendung(2) },
    { text: 'Falsch B', richtig: false, begruendung: begruendung(3) },
  ],
});

const daten: Lektion = {
  titel: 'Eine Lektion',
  prinzip: 'Ein Satz, der etwas behauptet.',
  reihenfolge: 1,
  gesperrt: false,
  aufgaben: [wahl('a-1'), wahl('a-2')],
  transfer: wahl('a-t'),
  quellen: [{ pfad: 'Folie 12' }],
};

async function rendere(lektion: Lektion): Promise<string> {
  const renderers = await loadRenderers([getContainerRenderer()]);
  const container = await AstroContainer.create({ renderers });
  return container.renderToString(LektionAnsicht, { props: { id: 'probe', daten: lektion } });
}

describe('LektionAnsicht - der Vorbehalt', () => {
  it('steht unter dem Satz und vor der Probe, mit „Vorbehalt:" davor', async () => {
    const html = await rendere({ ...daten, vorbehalt: 'Für diese Quoten gibt es keine belastbare Studie.' });
    const element = '<p class="vorbehalt"><strong>Vorbehalt:</strong> Für diese Quoten gibt es keine belastbare Studie.</p>';
    expect(html).toContain(element);
    const satz = html.indexOf('<p class="prinzip">');
    const vorbehalt = html.indexOf(element);
    const probe = html.indexOf('data-takt="probe"');
    expect(satz).toBeGreaterThan(-1);
    expect(vorbehalt).toBeGreaterThan(satz);
    expect(probe).toBeGreaterThan(vorbehalt);
  });

  it('erscheint ohne Vorbehalt gar nicht — kein leerer Kasten', async () => {
    const html = await rendere(daten);
    expect(html).toContain('<p class="prinzip">Ein Satz, der etwas behauptet.</p>');
    expect(html).not.toContain('class="vorbehalt"');
  });
});
