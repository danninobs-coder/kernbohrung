import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Reihenfolge from '../src/aufgaben/reihenfolge/Reihenfolge';
import { startfolge } from '../src/aufgaben/reihenfolge/startfolge';
import type { Reihenfolge as ReihenfolgeAufgabe } from '../src/aufgaben/reihenfolge/schema';

const aufgabe: ReihenfolgeAufgabe = {
  typ: 'reihenfolge',
  id: 'r-test',
  aufgabe: 'Bringe die Projektstufen in ihre Reihenfolge.',
  schritte: ['Vorbereitung', 'Planung', 'Vergabe', 'Ausführung'],
};

type Nutzer = ReturnType<typeof userEvent.setup>;

function imBild(): string[] {
  return Array.from(document.querySelectorAll('.reihenfolge-text')).map((el) => el.textContent ?? '');
}

function knopf(schritt: string, richtung: 'oben' | 'unten'): HTMLButtonElement {
  return screen.getByRole('button', { name: `${schritt} nach ${richtung}` }) as HTMLButtonElement;
}

function ansage(): HTMLElement | null {
  return document.querySelector('.nur-vorlesen');
}

/** Sortiert ueber die Knoepfe, so wie ein Mensch es taete. */
async function sortiere(nutzer: Nutzer, ziel: readonly string[]): Promise<void> {
  for (let stelle = 0; stelle < ziel.length; stelle++) {
    let position = imBild().indexOf(ziel[stelle]);
    while (position > stelle) {
      await nutzer.click(knopf(ziel[stelle], 'oben'));
      position--;
    }
  }
}

function stelleDar(phase: 'offen' | 'abgegeben' | 'aufgeloest' = 'offen') {
  const onAbgegeben = vi.fn();
  const dargestellt = render(
    <Reihenfolge aufgabe={aufgabe} phase={phase} onAbgegeben={onAbgegeben} onErgebnis={vi.fn()} />,
  );
  const inPhase = (neu: typeof phase) =>
    dargestellt.rerender(
      <Reihenfolge aufgabe={aufgabe} phase={neu} onAbgegeben={onAbgegeben} onErgebnis={vi.fn()} />,
    );
  return { onAbgegeben, inPhase };
}

describe('Reihenfolge', () => {
  it('zeigt die Schritte in der Startfolge, nicht in der richtigen', () => {
    stelleDar();
    const erwartet = startfolge(aufgabe.schritte.length, aufgabe.id).map((i) => aufgabe.schritte[i]);
    expect(imBild()).toEqual(erwartet);
    expect(imBild()).not.toEqual(aufgabe.schritte);
  });

  it('sperrt „nach oben" beim ersten und „nach unten" beim letzten Schritt', () => {
    stelleDar();
    const folge = imBild();
    expect(knopf(folge[0], 'oben').disabled).toBe(true);
    expect(knopf(folge[folge.length - 1], 'unten').disabled).toBe(true);
    expect(knopf(folge[1], 'oben').disabled).toBe(false);
  });

  it('verschiebt einen Schritt und lässt den Fokus bei ihm', async () => {
    const nutzer = userEvent.setup();
    stelleDar();
    const vorher = imBild();

    await nutzer.click(knopf(vorher[2], 'oben'));

    expect(imBild()).toEqual([vorher[0], vorher[2], vorher[1], vorher[3]]);
    expect(document.activeElement).toBe(knopf(vorher[2], 'oben'));
  });

  it('gibt den Fokus am Rand an den Gegenknopf, statt ihn zu verlieren', async () => {
    const nutzer = userEvent.setup();
    stelleDar();
    const vorher = imBild();

    await nutzer.click(knopf(vorher[1], 'oben'));

    // Der Schritt steht jetzt ganz oben, „nach oben" ist gesperrt. Ein
    // gesperrter Knopf haelt keinen Fokus.
    expect(knopf(vorher[1], 'oben').disabled).toBe(true);
    expect(document.activeElement).toBe(knopf(vorher[1], 'unten'));
  });

  it('meldet die richtige Folge als richtig', async () => {
    const nutzer = userEvent.setup();
    const { onAbgegeben } = stelleDar();
    await sortiere(nutzer, aufgabe.schritte);
    await nutzer.click(screen.getByRole('button', { name: 'Abgeben' }));

    expect(onAbgegeben).toHaveBeenCalledWith({
      antwort: '1,2,3,4',
      ergebnis: { richtig: true, anteil: 1, antwort: '1,2,3,4', merkmal: '' },
    });
  });

  it('meldet eine unsortierte Abgabe als falsch, mit der Folge als Merkmal', async () => {
    const nutzer = userEvent.setup();
    const { onAbgegeben } = stelleDar();
    await nutzer.click(screen.getByRole('button', { name: 'Abgeben' }));

    const { ergebnis } = onAbgegeben.mock.calls[0][0];
    expect(ergebnis.richtig).toBe(false);
    expect(ergebnis.merkmal).toBe(ergebnis.antwort);
  });

  it('sperrt nach der Abgabe und zeigt in der Auflösung die richtige Folge', () => {
    const { inPhase } = stelleDar();
    inPhase('abgegeben');
    for (const schritt of aufgabe.schritte) {
      expect(knopf(schritt, 'oben').disabled).toBe(true);
      expect(knopf(schritt, 'unten').disabled).toBe(true);
    }
    expect(screen.queryByRole('button', { name: 'Abgeben' })).toBeNull();

    inPhase('aufgeloest');
    expect(screen.getByText('Richtige Reihenfolge')).toBeTruthy();
  });

  /**
   * Nachtrag V: `data-zustand` je Zeile. Vor der Aufloesung (auch schon in
   * "abgegeben") steht an keiner Zeile ein Attribut - die Loesung darf vor
   * der Zuversicht nicht ablesbar sein. Abgegeben wird hier ohne zu
   * sortieren: `startfolge` schliesst die richtige Folge als Startpunkt aus
   * (siehe startfolge.ts), also steht nach der Aufloesung mindestens eine
   * Zeile auf "falsch".
   */
  it('V: trägt data-zustand erst nach der Auflösung ein - "richtig" oder "falsch" je Zeile', () => {
    const { inPhase } = stelleDar();
    for (const zeile of document.querySelectorAll('.reihenfolge-zeile')) {
      expect((zeile as HTMLElement).dataset.zustand).toBeUndefined();
    }

    inPhase('abgegeben');
    for (const zeile of document.querySelectorAll('.reihenfolge-zeile')) {
      expect((zeile as HTMLElement).dataset.zustand).toBeUndefined();
    }

    inPhase('aufgeloest');
    const zustaende = Array.from(document.querySelectorAll('.reihenfolge-zeile')).map(
      (zeile) => (zeile as HTMLElement).dataset.zustand,
    );
    const erwartet = startfolge(aufgabe.schritte.length, aufgabe.id).map((schritt, stelle) =>
      schritt === stelle ? 'richtig' : 'falsch',
    );
    expect(zustaende).toEqual(erwartet);
    expect(zustaende).toContain('falsch');
  });

  /**
   * Nachtrag W: Der Loesungsblock "Richtige Reihenfolge" verraet die
   * Antwort - er darf deshalb weder erscheinen, wenn schon alles richtig
   * stand, noch schon in "abgegeben" (dort steht die Zuversicht noch aus).
   * Das Gegenstueck - er erscheint bei falscher Folge in "aufgeloest" -
   * deckt der Test unmittelbar oben bereits ab.
   */
  it('W: zeigt "Richtige Reihenfolge" nicht bei schon richtiger Folge und nicht in "abgegeben"', async () => {
    const nutzer = userEvent.setup();
    const { inPhase } = stelleDar();
    await sortiere(nutzer, aufgabe.schritte);

    inPhase('abgegeben');
    expect(screen.queryByText('Richtige Reihenfolge')).toBeNull();

    inPhase('aufgeloest');
    expect(screen.queryByText('Richtige Reihenfolge')).toBeNull();
  });

  /** Nachtrag X: Wie bei `Wahl` steht der Ergebnissatz zwischen Frage und Liste. */
  it('X: stellt den Ergebnissatz zwischen Frage und Liste', () => {
    render(
      <Reihenfolge
        aufgabe={aufgabe}
        phase="aufgeloest"
        onAbgegeben={vi.fn()}
        onErgebnis={vi.fn()}
        ergebnissatz={<p data-testid="satz">Richtig.</p>}
      />,
    );
    const satz = screen.getByTestId('satz');
    expect(satz.previousElementSibling?.className).toBe('frage-text');
    expect(satz.nextElementSibling?.className).toBe('reihenfolge-liste');
  });

  /** Nachtrag Y: "nach unten" bewegt spiegelbildlich zu "nach oben" (Tests oben). */
  it('Y: verschiebt einen Schritt nach unten und lässt den Fokus bei ihm', async () => {
    const nutzer = userEvent.setup();
    stelleDar();
    const vorher = imBild();

    await nutzer.click(knopf(vorher[1], 'unten'));

    expect(imBild()).toEqual([vorher[0], vorher[2], vorher[1], vorher[3]]);
    expect(document.activeElement).toBe(knopf(vorher[1], 'unten'));
  });

  it('Y: gibt am unteren Rand den Fokus an "nach oben" derselben Zeile', async () => {
    const nutzer = userEvent.setup();
    stelleDar();
    const vorher = imBild();
    const vorletzter = vorher[vorher.length - 2];

    await nutzer.click(knopf(vorletzter, 'unten'));

    // Der Schritt steht jetzt ganz unten, „nach unten" ist gesperrt. Ein
    // gesperrter Knopf haelt keinen Fokus.
    expect(knopf(vorletzter, 'unten').disabled).toBe(true);
    expect(document.activeElement).toBe(knopf(vorletzter, 'oben'));
  });

  /**
   * Nachtrag Z: Die Startfolge haengt an der id, nicht nur an der
   * Schrittliste.
   *
   * Node-Probe mit `startfolge()` aus reihenfolge/startfolge.ts, mit den
   * vier Schritten dieser Testaufgabe:
   *   startfolge(4, 'r-test')   -> [0,2,3,1]
   *   startfolge(4, 'r-test-2') -> [1,2,3,0]
   * Beide Folgen unterscheiden sich schon an erster Stelle - 'r-test-2' ist
   * eine nachweislich andere Mischung, keine beliebig gegriffene zweite id.
   */
  it('Z: mischt anhand der id - eine zweite Aufgabe mit derselben Schrittliste startet anders', () => {
    const andereAufgabe: ReihenfolgeAufgabe = { ...aufgabe, id: 'r-test-2' };

    const { unmount } = render(
      <Reihenfolge aufgabe={aufgabe} phase="offen" onAbgegeben={vi.fn()} onErgebnis={vi.fn()} />,
    );
    const erste = imBild();
    unmount();

    render(<Reihenfolge aufgabe={andereAufgabe} phase="offen" onAbgegeben={vi.fn()} onErgebnis={vi.fn()} />);
    const zweite = imBild();

    expect(zweite).not.toEqual(erste);
    expect(zweite).toEqual(startfolge(aufgabe.schritte.length, 'r-test-2').map((i) => aufgabe.schritte[i]));
  });

  /**
   * Nachtrag AA: Ein Doppelklick auf "Abgeben" ruft `onAbgegeben` zweimal -
   * der Vertrag erlaubt das ausdruecklich, solange die Zuversicht aussteht
   * (siehe vertrag.ts). Wie bei `Zuordnen` bekommt `Reihenfolge` dagegen
   * keine eigene Sperre: nur festgehalten, dass beide Abgaben identisch
   * bleiben, nichts dagegen gebaut.
   */
  it('AA: meldet einen Doppelklick auf "Abgeben" zweimal, aber mit identischer Abgabe', async () => {
    const nutzer = userEvent.setup();
    const { onAbgegeben } = stelleDar();

    await nutzer.dblClick(screen.getByRole('button', { name: 'Abgeben' }));

    expect(onAbgegeben).toHaveBeenCalledTimes(2);
    expect(onAbgegeben.mock.calls[0][0]).toEqual(onAbgegeben.mock.calls[1][0]);
  });

  /**
   * Nachtrag AB: Nach einem Zug sagt heute nur der Screenreader-Knopfname
   * wieder vor, nie die neue Position. Eine visuell versteckte Live-Region
   * traegt die Stelle nach — leer vor dem ersten Zug, sonst „{Schritt} steht
   * jetzt an Stelle {n} von {m}.“.
   */
  it('AB: die Live-Region ist vor dem ersten Zug leer und traegt aria-live="polite"', () => {
    stelleDar();
    expect(ansage()?.getAttribute('aria-live')).toBe('polite');
    expect(ansage()?.textContent).toBe('');
  });

  it('AB: sagt nach "nach oben" die neue Stelle an', async () => {
    const nutzer = userEvent.setup();
    stelleDar();
    const vorher = imBild();

    await nutzer.click(knopf(vorher[2], 'oben'));

    expect(ansage()?.textContent).toBe(`${vorher[2]} steht jetzt an Stelle 2 von 4.`);
  });

  it('AB: sagt nach "nach unten" die neue Stelle an', async () => {
    const nutzer = userEvent.setup();
    stelleDar();
    const vorher = imBild();

    await nutzer.click(knopf(vorher[1], 'unten'));

    expect(ansage()?.textContent).toBe(`${vorher[1]} steht jetzt an Stelle 3 von 4.`);
  });
});
