import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Frage from '../src/components/Frage';

const daten = {
  id: 'f-test',
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

describe('Frage', () => {
  it('zeigt die Frage und alle Antworten', () => {
    render(<Frage {...daten} />);
    expect(screen.getByText('Was sortiert ein Reranker?')).toBeTruthy();
    for (const a of daten.antworten) expect(knopf(a.text)).toBeTruthy();
  });

  it('zeigt vor der Antwort keine Begründung', () => {
    render(<Frage {...daten} />);
    expect(screen.queryByText('Genau das ist seine Aufgabe.')).toBeNull();
    expect(screen.queryByText('Den rührt er nicht an.')).toBeNull();
  });

  it('markiert nach einer falschen Wahl beide Zustände und zeigt alle Begründungen', async () => {
    const nutzer = userEvent.setup();
    render(<Frage {...daten} />);
    await nutzer.click(knopf('Den Index'));

    expect(knopf('Den Index').dataset.zustand).toBe('falsch');
    expect(knopf('Die Kandidaten').dataset.zustand).toBe('richtig');
    expect(knopf('Die Anfrage').dataset.zustand).toBe('neutral');

    for (const a of daten.antworten) expect(screen.getByText(a.begruendung)).toBeTruthy();
  });

  it('markiert eine richtige Wahl als richtig', async () => {
    const nutzer = userEvent.setup();
    render(<Frage {...daten} />);
    await nutzer.click(knopf('Die Kandidaten'));
    expect(knopf('Die Kandidaten').dataset.zustand).toBe('richtig');
  });

  it('lässt keinen zweiten Versuch zu', async () => {
    const nutzer = userEvent.setup();
    render(<Frage {...daten} />);
    await nutzer.click(knopf('Den Index'));

    for (const a of daten.antworten) expect(knopf(a.text).disabled).toBe(true);

    await nutzer.click(knopf('Die Kandidaten'));
    expect(knopf('Den Index').dataset.zustand).toBe('falsch');
  });

  it('mischt stabil: gleiche Id ergibt gleiche Reihenfolge', () => {
    const { unmount } = render(<Frage {...daten} />);
    const erste = screen.getAllByRole('button').map((b) => b.textContent);
    unmount();
    render(<Frage {...daten} />);
    const zweite = screen.getAllByRole('button').map((b) => b.textContent);
    expect(zweite).toEqual(erste);
  });

  it('behaelt die Zuordnung, wenn das Elternteil die Antworten umsortiert', async () => {
    const nutzer = userEvent.setup();
    const { rerender } = render(<Frage {...daten} />);
    await nutzer.click(knopf('Den Index'));
    expect(knopf('Den Index').dataset.zustand).toBe('falsch');

    // Gleiche Objekte, rotierte Reihenfolge - so wie ein Elternteil sie
    // nach einem Re-Render liefern koennte. Bewusst Rotation und kein
    // reverse(): bei drei Elementen bleibt beim Umdrehen das mittlere
    // stehen, und ein Index-Fehler an dieser Stelle bliebe verdeckt.
    const rotiert = [daten.antworten[1], daten.antworten[2], daten.antworten[0]];
    rerender(<Frage {...daten} antworten={rotiert} />);

    expect(knopf('Den Index').dataset.zustand).toBe('falsch');
    expect(knopf('Die Anfrage').dataset.zustand).toBe('neutral');
    expect(knopf('Die Kandidaten').dataset.zustand).toBe('richtig');
  });
});
