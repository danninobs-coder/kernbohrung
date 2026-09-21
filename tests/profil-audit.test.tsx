import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Wahlfrage } from '../src/profil/Audit';

/**
 * jsdom kennt `CSS.escape` nicht. user-event braucht es, um bei einer Pfeiltaste
 * die Felder EINER Radiogruppe zu finden (`input[name="..."]`) — ohne diese
 * Zeilen wirft jede Pfeiltaste auf einem Radiofeld mit Namen. Im Browser gibt
 * es die Funktion; das hier schliesst eine Luecke der Testumgebung, nicht der
 * Komponente. Die Namen der Felder bestehen nur aus Kleinbuchstaben, Ziffern
 * und Bindestrich — zu maskieren gibt es an ihnen nichts.
 */
const fenster = document.defaultView;
if (fenster !== null && typeof fenster.CSS === 'undefined') {
  Object.defineProperty(fenster, 'CSS', { value: { escape: (wert: string) => wert } });
}

type Nutzer = ReturnType<typeof userEvent.setup>;

/**
 * `delay: null` statt der Voreinstellung 0: Mit 0 wartet user-event nach jedem
 * Teilschritt auf einen Zeitgeber, und der feuert unter Windows fruehestens
 * nach rund 15 ms — bei ueber hundert Tastendruecken sind das Sekunden reiner
 * Wartezeit. Die Reihenfolge der Ereignisse bleibt dieselbe.
 */
function neuerNutzer(): Nutzer {
  return userEvent.setup({ delay: null });
}

function frage(text: string): HTMLElement {
  return screen.getByRole('group', { name: text });
}

/** Das Radiofeld, dessen Name mit `anfang` beginnt: `4` fuer „4 — trifft eher zu". */
function feld(gruppe: HTMLElement, anfang: string | number): HTMLInputElement {
  return within(gruppe).getByRole('radio', { name: new RegExp(`^${anfang}( |$)`) }) as HTMLInputElement;
}

describe('Wahlfrage', () => {
  const optionen = [
    { wert: 1, text: '1 — trifft gar nicht zu', kurz: '1' },
    { wert: 4, text: '4 — trifft eher zu', kurz: '4' },
  ];

  it('ist eine Gruppe mit der Frage als Namen und einem Radiofeld je Option', () => {
    render(<Wahlfrage name="a" frage="Ich lerne abends." optionen={optionen} gewaehlt={undefined} beiWahl={() => {}} klasse="skala" />);
    const gruppe = frage('Ich lerne abends.');
    expect(within(gruppe).getAllByRole('radio')).toHaveLength(2);
    // Sichtbar ist nur die Zahl, vorgelesen wird die ganze Stufe.
    expect(feld(gruppe, 4).getAttribute('aria-label')).toBe('4 — trifft eher zu');
    expect(feld(gruppe, 4).checked).toBe(false);
  });

  it('meldet den WERT der gewaehlten Option, nicht ihren Text oder ihre Stelle', async () => {
    const nutzer = neuerNutzer();
    const beiWahl = vi.fn();
    render(<Wahlfrage name="a" frage="Ich lerne abends." optionen={optionen} gewaehlt={undefined} beiWahl={beiWahl} klasse="skala" />);

    await nutzer.click(feld(frage('Ich lerne abends.'), 4));

    expect(beiWahl).toHaveBeenCalledTimes(1);
    expect(beiWahl).toHaveBeenCalledWith(4);
  });

  it('zeigt die Wahl am Feld und an seiner Flaeche', () => {
    render(<Wahlfrage name="a" frage="Ich lerne abends." optionen={optionen} gewaehlt={4} beiWahl={() => {}} klasse="skala" />);
    const gruppe = frage('Ich lerne abends.');
    expect(feld(gruppe, 4).checked).toBe(true);
    expect(feld(gruppe, 1).checked).toBe(false);
    expect(feld(gruppe, 4).closest('label')?.getAttribute('data-gewaehlt')).toBe('true');
    expect(feld(gruppe, 1).closest('label')?.getAttribute('data-gewaehlt')).toBe('false');
  });

  it('haelt die Felder zweier Fragen auseinander', () => {
    // Teilten sich zwei Fragen einen `name`, waeren sie EINE Radiogruppe: Die
    // Pfeiltasten liefen von einer Aussage in die naechste.
    render(
      <>
        <Wahlfrage name="a" frage="Erste" optionen={optionen} gewaehlt={4} beiWahl={() => {}} klasse="skala" />
        <Wahlfrage name="b" frage="Zweite" optionen={optionen} gewaehlt={1} beiWahl={() => {}} klasse="skala" />
      </>,
    );
    expect(feld(frage('Erste'), 4).name).toBe('a');
    expect(feld(frage('Zweite'), 4).name).toBe('b');
    expect(feld(frage('Erste'), 4).checked).toBe(true);
    expect(feld(frage('Zweite'), 1).checked).toBe(true);
  });

  it('laesst sich mit Leertaste und Pfeiltaste bedienen', async () => {
    const nutzer = neuerNutzer();
    const beiWahl = vi.fn();
    render(<Wahlfrage name="a" frage="Ich lerne abends." optionen={optionen} gewaehlt={undefined} beiWahl={beiWahl} klasse="skala" />);

    await nutzer.tab();
    expect(document.activeElement).toBe(feld(frage('Ich lerne abends.'), 1));
    await nutzer.keyboard('[Space]');
    expect(beiWahl).toHaveBeenLastCalledWith(1);
    await nutzer.keyboard('{ArrowRight}');
    expect(beiWahl).toHaveBeenLastCalledWith(4);
  });
});

/**
 * Ergaenzte Mutationsproben aus dem Nachtrag vom 2026-09-21 zu Aufgabe 6,
 * Punkt 4: Diese drei Regeln blieben mit den fuenf Tests oben unentdeckt, als
 * man sie einzeln zurueckbaute. Eigener describe-Block HINTER dem von
 * `Wahlfrage`, damit Aufgabe 7 ihn unveraendert uebernehmen kann, waehrend
 * der Block oben Zeichen fuer Zeichen aus dem Plan bleibt.
 */
describe('Wahlfrage - ergaenzte Mutationsproben', () => {
  const optionen = [
    { wert: 1, text: '1 — trifft gar nicht zu', kurz: '1' },
    { wert: 4, text: '4 — trifft eher zu', kurz: '4' },
  ];

  it('zeigt auf der Flaeche den kurzen Text, nicht den langen', () => {
    render(<Wahlfrage name="a" frage="Ich lerne abends." optionen={optionen} gewaehlt={undefined} beiWahl={() => {}} klasse="skala" />);
    const span = feld(frage('Ich lerne abends.'), 1).closest('label')?.querySelector('span');
    expect(span?.textContent).toBe('1');
  });

  it('versteckt den sichtbaren Text vor dem Screenreader, aria-label traegt vor', () => {
    render(<Wahlfrage name="a" frage="Ich lerne abends." optionen={optionen} gewaehlt={undefined} beiWahl={() => {}} klasse="skala" />);
    const span = feld(frage('Ich lerne abends.'), 1).closest('label')?.querySelector('span');
    expect(span?.getAttribute('aria-hidden')).toBe('true');
  });

  it('rendert den Fuss unter den Feldern, wenn einer uebergeben wird', () => {
    render(
      <Wahlfrage
        name="a"
        frage="Ich lerne abends."
        optionen={optionen}
        gewaehlt={undefined}
        beiWahl={() => {}}
        klasse="skala"
        fuss={<p>Stimmt gar nicht bis stimmt genau.</p>}
      />,
    );
    expect(screen.getByText('Stimmt gar nicht bis stimmt genau.')).toBeTruthy();
  });
});
