import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Wahl from '../src/aufgaben/wahl/Wahl';
import type { Wahl as WahlAufgabe } from '../src/aufgaben/wahl/schema';

const aufgabe: WahlAufgabe = {
  typ: 'wahl',
  id: 'w-test',
  frage: 'Was sortiert ein Reranker?',
  antworten: [
    { text: 'Die Kandidaten', richtig: true, begruendung: 'Genau das ist seine Aufgabe.' },
    { text: 'Den Index', richtig: false, begruendung: 'Den rührt er nicht an.' },
    { text: 'Die Anfrage', richtig: false, begruendung: 'Die bleibt unverändert.' },
  ],
};

function knopf(text: string): HTMLButtonElement {
  return screen.getByRole('button', { name: text }) as HTMLButtonElement;
}

describe('Wahl', () => {
  it('meldet die Wahl samt fertiger Bewertung an die Hülle', async () => {
    const nutzer = userEvent.setup();
    const onAbgegeben = vi.fn();
    render(<Wahl aufgabe={aufgabe} phase="offen" onAbgegeben={onAbgegeben} onErgebnis={vi.fn()} />);

    await nutzer.click(knopf('Den Index'));

    expect(onAbgegeben).toHaveBeenCalledWith({
      antwort: 'Den Index',
      ergebnis: { richtig: false, anteil: 0, antwort: 'Den Index', merkmal: 'Den Index' },
    });
  });

  it('lässt die Wahl wechseln, solange die Zuversicht aussteht', async () => {
    const nutzer = userEvent.setup();
    const onAbgegeben = vi.fn();
    const { rerender } = render(
      <Wahl aufgabe={aufgabe} phase="offen" onAbgegeben={onAbgegeben} onErgebnis={vi.fn()} />,
    );
    await nutzer.click(knopf('Den Index'));
    rerender(<Wahl aufgabe={aufgabe} phase="abgegeben" onAbgegeben={onAbgegeben} onErgebnis={vi.fn()} />);

    await nutzer.click(knopf('Die Kandidaten'));

    expect(onAbgegeben).toHaveBeenCalledTimes(2);
    expect(onAbgegeben.mock.calls[1][0].ergebnis.richtig).toBe(true);
    expect(knopf('Die Kandidaten').getAttribute('aria-pressed')).toBe('true');
    expect(knopf('Den Index').getAttribute('aria-pressed')).toBe('false');
  });

  it('nimmt nach der Auflösung keine Wahl mehr an und zeigt alle Begründungen', async () => {
    const nutzer = userEvent.setup();
    const onAbgegeben = vi.fn();
    const { rerender } = render(
      <Wahl aufgabe={aufgabe} phase="offen" onAbgegeben={onAbgegeben} onErgebnis={vi.fn()} />,
    );
    await nutzer.click(knopf('Den Index'));
    rerender(<Wahl aufgabe={aufgabe} phase="aufgeloest" onAbgegeben={onAbgegeben} onErgebnis={vi.fn()} />);

    for (const a of aufgabe.antworten) {
      expect(knopf(a.text).disabled).toBe(true);
      expect(screen.getByText(a.begruendung)).toBeTruthy();
    }
    expect(knopf('Den Index').dataset.zustand).toBe('falsch');
    expect(knopf('Die Kandidaten').dataset.zustand).toBe('richtig');
    expect(knopf('Die Anfrage').dataset.zustand).toBe('neutral');

    await nutzer.click(knopf('Die Kandidaten'));
    expect(onAbgegeben).toHaveBeenCalledTimes(1);
  });

  it('stellt den Ergebnissatz zwischen Frage und Antworten', () => {
    render(
      <Wahl
        aufgabe={aufgabe}
        phase="aufgeloest"
        onAbgegeben={vi.fn()}
        onErgebnis={vi.fn()}
        ergebnissatz={<p data-testid="satz">Richtig.</p>}
      />,
    );
    const satz = screen.getByTestId('satz');
    expect(satz.previousElementSibling?.className).toBe('frage-text');
    expect(satz.nextElementSibling?.className).toBe('antworten');
  });

  /**
   * Nachtrag A: Die Phase "zuversicht" existiert bei `wahl` nur, weil die
   * Huelle sie fuer ALLE Typen durchreicht (siehe vertrag.ts) — inhaltlich
   * gehoert sie nur zu `fall`. Der Knopf ist hier laut Plan bewusst NICHT
   * `disabled`, damit er in der Tab-Reihenfolge nicht verschwindet. Gesperrt
   * wird stattdessen ueber die Bedingung in `waehle`. Ohne diesen Test waere
   * ein Griff, der die Bedienbarkeit fuer die Zugaenglichkeit vorzieht, nicht
   * von einem Griff zu unterscheiden, der die Sperre schlicht vergisst.
   */
  describe('Phase "zuversicht" sperrt die Wahl', () => {
    it('ruft onAbgegeben nicht und laesst aria-pressed bei "false"', async () => {
      const nutzer = userEvent.setup();
      const onAbgegeben = vi.fn();
      render(<Wahl aufgabe={aufgabe} phase="zuversicht" onAbgegeben={onAbgegeben} onErgebnis={vi.fn()} />);

      await nutzer.click(knopf('Den Index'));

      expect(onAbgegeben).not.toHaveBeenCalled();
      expect(knopf('Den Index').getAttribute('aria-pressed')).toBe('false');
    });
  });

  /**
   * Nachtrag B: Die Textmarke steht ausserhalb des Knopfes (WCAG 1.4.1 ist
   * schon durch `data-zustand` erledigt — die Marke ist die zweite, textliche
   * Saeule derselben Zusicherung). Waere sie im Knopf, hiesse die gewaehlte
   * Antwort vor und nach der Aufloesung unterschiedlich, und ein Test, der
   * ueber den Antworttext nach dem Knopf sucht, faende ihn nicht mehr.
   */
  describe('Textmarken nach der Auflösung', () => {
    it('markiert richtig, deine Wahl und keine Marke an der dritten', async () => {
      const nutzer = userEvent.setup();
      const { rerender } = render(
        <Wahl aufgabe={aufgabe} phase="offen" onAbgegeben={vi.fn()} onErgebnis={vi.fn()} />,
      );
      await nutzer.click(knopf('Den Index'));
      rerender(<Wahl aufgabe={aufgabe} phase="aufgeloest" onAbgegeben={vi.fn()} onErgebnis={vi.fn()} />);

      const richtige = knopf('Die Kandidaten');
      const gewaehlteFalsche = knopf('Den Index');
      const dritte = knopf('Die Anfrage');

      expect(richtige.closest('li')?.querySelector('.antwort-marke')?.textContent).toBe('richtig');
      expect(gewaehlteFalsche.closest('li')?.querySelector('.antwort-marke')?.textContent).toBe(
        'deine Wahl',
      );
      expect(dritte.closest('li')?.querySelector('.antwort-marke')).toBeNull();

      // Die Marke steht ausserhalb des Knopfes: der zugaengliche Name bleibt
      // exakt der Antworttext, in keinem der drei Faelle.
      expect(richtige.textContent).toBe('Die Kandidaten');
      expect(gewaehlteFalsche.textContent).toBe('Den Index');
      expect(dritte.textContent).toBe('Die Anfrage');
    });

    it('markiert eine richtige Wahl als "richtig · deine Wahl"', async () => {
      const nutzer = userEvent.setup();
      const { rerender } = render(
        <Wahl aufgabe={aufgabe} phase="offen" onAbgegeben={vi.fn()} onErgebnis={vi.fn()} />,
      );
      await nutzer.click(knopf('Die Kandidaten'));
      rerender(<Wahl aufgabe={aufgabe} phase="aufgeloest" onAbgegeben={vi.fn()} onErgebnis={vi.fn()} />);

      const richtigeGewaehlte = knopf('Die Kandidaten');
      expect(richtigeGewaehlte.closest('li')?.querySelector('.antwort-marke')?.textContent).toBe(
        'richtig · deine Wahl',
      );
      expect(richtigeGewaehlte.textContent).toBe('Die Kandidaten');
    });
  });

  /**
   * Nachtrag C: Gemerkt wird die Antwort, nicht ihre Position.
   *
   * `mischen` haengt an Eingabereihenfolge UND Startwert — liefert das
   * Elternteil dieselben Objekte in anderer Reihenfolge, faellt bei
   * gleichbleibender `id` (gleicher Startwert) i. A. eine andere
   * Bildschirmreihenfolge heraus. Genau das ist der Fall, den dieser Test
   * treffen soll: Trotz verschobener Anzeige muss die Auswahl am Objekt
   * haengen bleiben, nicht an der Position, an der es einmal angezeigt wurde.
   */
  describe('Gemerkt wird die Antwort, nicht die Position', () => {
    it('behaelt aria-pressed an der Antwort, wenn das Elternteil umsortiert', async () => {
      const nutzer = userEvent.setup();
      const { rerender } = render(
        <Wahl aufgabe={aufgabe} phase="offen" onAbgegeben={vi.fn()} onErgebnis={vi.fn()} />,
      );
      await nutzer.click(knopf('Den Index'));
      expect(knopf('Den Index').getAttribute('aria-pressed')).toBe('true');

      // Gleiche Objekte, rotierte Reihenfolge - neues Array, gleiche id.
      const umsortiert: WahlAufgabe = {
        ...aufgabe,
        antworten: [aufgabe.antworten[1], aufgabe.antworten[2], aufgabe.antworten[0]],
      };
      rerender(<Wahl aufgabe={umsortiert} phase="offen" onAbgegeben={vi.fn()} onErgebnis={vi.fn()} />);

      expect(knopf('Den Index').getAttribute('aria-pressed')).toBe('true');
      expect(knopf('Die Kandidaten').getAttribute('aria-pressed')).toBe('false');
      expect(knopf('Die Anfrage').getAttribute('aria-pressed')).toBe('false');
    });
  });

  /**
   * Nachtrag D: Die Reihenfolge ist je Aufgabe fest — kein Wieder-Mischen bei
   * jedem Rendern derselben Aufgabe.
   */
  describe('Reihenfolge ist je Aufgabe fest', () => {
    it('mischt stabil: zweimal rendern ergibt dieselbe Knopfreihenfolge', () => {
      const { unmount } = render(
        <Wahl aufgabe={aufgabe} phase="offen" onAbgegeben={vi.fn()} onErgebnis={vi.fn()} />,
      );
      const erste = screen.getAllByRole('button').map((b) => b.textContent);
      unmount();

      render(<Wahl aufgabe={aufgabe} phase="offen" onAbgegeben={vi.fn()} onErgebnis={vi.fn()} />);
      const zweite = screen.getAllByRole('button').map((b) => b.textContent);
      expect(zweite).toEqual(erste);
    });
  });
});
