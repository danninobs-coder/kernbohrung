import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Zuversicht, { alsProzent } from '../src/components/Zuversicht';
import { ZUVERSICHT_STUFEN, ZUVERSICHT_TEXT, ZUVERSICHT_WERT } from '../src/tutor/typen';
import type { Zuversicht as Stufe } from '../src/tutor/typen';

/**
 * Der Zuversichtsschritt allein, ohne Frage und ohne Speicher.
 *
 * Die wichtigste Pruefung hier ist die langweiligste: dass der Knopf meldet,
 * was auf ihm steht. Ein vertauschtes Paar in der Abbildung — „Geraten"
 * gedrueckt, `sicher` gemeldet — ist im Markup unsichtbar, laeuft durch jede
 * Sichtpruefung und verfaelscht danach die ganze Kalibrierung: Genau die
 * Stufe, auf der sich jemand ueberschaetzt, wuerde als die ausgewiesen, auf
 * der er sich unterschaetzt.
 */

function stufenKnopf(s: Stufe): HTMLButtonElement {
  return screen.getByRole('button', {
    name: new RegExp(`^${ZUVERSICHT_TEXT[s]}`),
  }) as HTMLButtonElement;
}

describe('Zuversicht', () => {
  it('zeigt alle Stufen in der Reihenfolge aus typen.ts', () => {
    render(<Zuversicht id="f-1" beiWahl={() => {}} fokussieren={false} />);
    const knoepfe = screen.getAllByRole('button');
    expect(knoepfe.map((k) => k.dataset.stufe)).toEqual([...ZUVERSICHT_STUFEN]);
  });

  it('schreibt auf jede Stufe, was sie behauptet', () => {
    render(<Zuversicht id="f-1" beiWahl={() => {}} fokussieren={false} />);
    for (const s of ZUVERSICHT_STUFEN) {
      expect(stufenKnopf(s).textContent).toBe(
        `${ZUVERSICHT_TEXT[s]}behauptet ${alsProzent(ZUVERSICHT_WERT[s])}`,
      );
    }
    expect(alsProzent(0.9)).toBe('90 %');
    expect(alsProzent(0.3)).toBe('30 %');
  });

  // Die Mutationsprobe: Wer hier `sicher` und `geraten` vertauscht, faellt in
  // zwei der drei Faelle durch. Der Test laeuft ueber die SICHTBARE
  // Beschriftung und nicht ueber `data-stufe` — sonst wuerde er die
  // Vertauschung mitvollziehen, statt sie zu bemerken.
  it.each([...ZUVERSICHT_STUFEN])(
    'meldet „%s" genau so, wie der Knopf beschriftet ist',
    async (s) => {
      const nutzer = userEvent.setup();
      const gemeldet = vi.fn();
      render(<Zuversicht id="f-1" beiWahl={gemeldet} fokussieren={false} />);

      await nutzer.click(stufenKnopf(s));

      expect(gemeldet).toHaveBeenCalledTimes(1);
      expect(gemeldet).toHaveBeenCalledWith(s);
    },
  );

  it('traegt die Frage als zugaenglichen Namen der Gruppe', () => {
    render(<Zuversicht id="f-1" beiWahl={() => {}} fokussieren={false} />);
    expect(screen.getByRole('group', { name: 'Wie sicher bist du?' })).toBeTruthy();
  });

  it('haelt die Beschriftung je Frage auseinander', () => {
    // Vier Fragen auf einer Seite sind der Normalfall. Zeigten alle
    // aria-labelledby auf dieselbe id, laese ein Screenreader dreimal die
    // Beschriftung einer fremden Frage vor.
    render(
      <>
        <Zuversicht id="f-1" beiWahl={() => {}} fokussieren={false} />
        <Zuversicht id="f-2" beiWahl={() => {}} fokussieren={false} />
      </>,
    );
    const gruppen = screen.getAllByRole('group');
    const ziele = gruppen.map((g) => g.getAttribute('aria-labelledby'));
    expect(new Set(ziele).size).toBe(2);
    for (const [i, g] of gruppen.entries()) {
      const ziel = document.getElementById(ziele[i] ?? '');
      expect(ziel).not.toBeNull();
      expect(g.contains(ziel)).toBe(true);
    }
  });

  it('nimmt den Fokus auf die erste Stufe, wenn der Block erscheint', () => {
    render(<Zuversicht id="f-1" beiWahl={() => {}} />);
    expect(document.activeElement).toBe(stufenKnopf('sicher'));
  });

  it('laesst den Fokus stehen, wenn er nicht gewuenscht ist', () => {
    const vorher = document.activeElement;
    render(<Zuversicht id="f-1" beiWahl={() => {}} fokussieren={false} />);
    expect(document.activeElement).toBe(vorher);
  });

  it('laesst sich mit Enter und mit der Leertaste ausloesen', async () => {
    const nutzer = userEvent.setup();
    const gemeldet = vi.fn();
    render(<Zuversicht id="f-1" beiWahl={gemeldet} />);

    // Der Fokus steht bereits auf der ersten Stufe.
    await nutzer.keyboard('{Enter}');
    expect(gemeldet).toHaveBeenLastCalledWith('sicher');

    await nutzer.tab();
    await nutzer.keyboard('[Space]');
    expect(gemeldet).toHaveBeenLastCalledWith('eher');
    expect(gemeldet).toHaveBeenCalledTimes(2);
  });
});
