import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Fall, { HOECHSTLAENGE, absaetze } from '../src/aufgaben/fall/Fall';
import type { Fall as FallAufgabe } from '../src/aufgaben/fall/schema';

const aufgabe: FallAufgabe = {
  typ: 'fall',
  id: 'fall-test',
  sachverhalt: 'Eine Gemeinde vergibt einen Rohbau pauschal.\n\nEine Leistung fehlt im Leistungsverzeichnis.',
  aufgabe: 'Wer hat recht?',
  pruefpunkte: [
    { text: 'Mengenrisiko ist nicht Vollständigkeitsrisiko', pflicht: true },
    { text: 'Ankündigung vor der Ausführung', pflicht: false },
  ],
  musterloesung: 'Der Unternehmer hat recht.',
};

const loesung = 'Der Unternehmer hat recht, weil die Leistung nicht beschrieben war.';

function stelleDar(phase: 'offen' | 'abgegeben' | 'zuversicht' | 'aufgeloest' = 'offen') {
  const onAbgegeben = vi.fn();
  const onErgebnis = vi.fn();
  const dargestellt = render(
    <Fall aufgabe={aufgabe} phase={phase} onAbgegeben={onAbgegeben} onErgebnis={onErgebnis} />,
  );
  const inPhase = (neu: typeof phase) =>
    dargestellt.rerender(
      <Fall aufgabe={aufgabe} phase={neu} onAbgegeben={onAbgegeben} onErgebnis={onErgebnis} />,
    );
  return { onAbgegeben, onErgebnis, inPhase };
}

describe('absaetze', () => {
  it('trennt an Leerzeilen und verwirft Leeres', () => {
    expect(absaetze('Erster.\n\nZweiter.\r\n\r\n\r\nDritter.\n')).toEqual(['Erster.', 'Zweiter.', 'Dritter.']);
  });
});

describe('Fall', () => {
  it('zeigt Sachverhalt in Absätzen, Aufgabe und ein begrenztes Textfeld', () => {
    stelleDar();
    expect(screen.getByText('Eine Gemeinde vergibt einen Rohbau pauschal.')).toBeTruthy();
    expect(screen.getByText('Eine Leistung fehlt im Leistungsverzeichnis.')).toBeTruthy();
    expect(screen.getByText('Wer hat recht?')).toBeTruthy();
    expect((screen.getByLabelText('Deine Lösung') as HTMLTextAreaElement).maxLength).toBe(HOECHSTLAENGE);
  });

  it('lässt erst abgeben, wenn etwas geschrieben ist', async () => {
    const nutzer = userEvent.setup();
    const { onAbgegeben } = stelleDar();
    const abgeben = screen.getByRole('button', { name: 'Abgeben' }) as HTMLButtonElement;
    expect(abgeben.disabled).toBe(true);

    await nutzer.type(screen.getByLabelText('Deine Lösung'), loesung);
    expect(abgeben.disabled).toBe(false);
    await nutzer.click(abgeben);

    // `ergebnis: null` ist der Punkt: Die Bewertung kann erst NACH der
    // Zuversicht entstehen.
    expect(onAbgegeben).toHaveBeenCalledWith({ antwort: loesung, ergebnis: null });
  });

  /**
   * Nachtrag E: Nur Leerraum ist wie nichts geschrieben. `text.trim() === ''`
   * steht an zwei Stellen (Sperre des Knopfes, Wache in `gibAb`) — dieser Test
   * deckt die erste ab, an der jede Mutation zuerst sichtbar wird.
   */
  it('lässt nicht abgeben, wenn nur Leerraum geschrieben wurde', async () => {
    const nutzer = userEvent.setup();
    const { onAbgegeben } = stelleDar();
    const abgeben = screen.getByRole('button', { name: 'Abgeben' }) as HTMLButtonElement;

    await nutzer.type(screen.getByLabelText('Deine Lösung'), '   \n\n  ');
    expect(abgeben.disabled).toBe(true);
    await nutzer.click(abgeben);

    expect(onAbgegeben).not.toHaveBeenCalled();
  });

  it('zeigt die Prüfpunkte NICHT, solange die Zuversicht aussteht', async () => {
    const nutzer = userEvent.setup();
    const { inPhase } = stelleDar();
    await nutzer.type(screen.getByLabelText('Deine Lösung'), loesung);
    inPhase('abgegeben');

    // Wer die Pruefpunkte vor der Zuversicht sieht, schaetzt nicht sein
    // Wissen ein, sondern liest ab.
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.queryByText('Mengenrisiko ist nicht Vollständigkeitsrisiko')).toBeNull();
    expect((screen.getByLabelText('Deine Lösung') as HTMLTextAreaElement).readOnly).toBe(true);
    expect(screen.queryByRole('button', { name: 'Abgeben' })).toBeNull();
  });

  it('lässt nach der Zuversicht abhaken und reicht die Bewertung nach', async () => {
    const nutzer = userEvent.setup();
    const { onErgebnis, inPhase } = stelleDar();
    await nutzer.type(screen.getByLabelText('Deine Lösung'), loesung);
    inPhase('zuversicht');

    expect(screen.getAllByRole('checkbox')).toHaveLength(2);
    // Vor dem Abschluss keine Marke „wesentlich": Sie wuerde verraten, welche
    // Haken zaehlen.
    expect(screen.queryByText(/wesentlich/)).toBeNull();

    await nutzer.click(screen.getByRole('checkbox', { name: 'Mengenrisiko ist nicht Vollständigkeitsrisiko' }));
    await nutzer.click(screen.getByRole('button', { name: 'Fertig' }));

    expect(onErgebnis).toHaveBeenCalledWith({ richtig: true, anteil: 0.5, antwort: loesung, merkmal: '' });
  });

  /**
   * Nachtrag F: Nur den Nicht-Pflichtpunkt abzuhaken reicht nicht — `richtig`
   * haengt allein am Pflichtpunkt (Index 0, siehe `bewerten.ts`). Faengt auch
   * die Mutation ab, die in `fertig` `haken` durch lauter `true` ersetzt.
   */
  it('bewertet als falsch, wenn nur der Nicht-Pflichtpunkt abgehakt wird', async () => {
    const nutzer = userEvent.setup();
    const { onErgebnis, inPhase } = stelleDar();
    await nutzer.type(screen.getByLabelText('Deine Lösung'), loesung);
    inPhase('zuversicht');

    await nutzer.click(screen.getByRole('checkbox', { name: 'Ankündigung vor der Ausführung' }));
    await nutzer.click(screen.getByRole('button', { name: 'Fertig' }));

    expect(onErgebnis).toHaveBeenCalledWith({ richtig: false, anteil: 0.5, antwort: loesung, merkmal: 'fehlt:1' });
  });

  it('setzt den Fokus auf die Frage der Prüfpunkte, wenn sie erscheinen', async () => {
    const nutzer = userEvent.setup();
    const { inPhase } = stelleDar();
    await nutzer.type(screen.getByLabelText('Deine Lösung'), loesung);
    inPhase('zuversicht');

    // Der Zuversichtsblock ist eben verschwunden — mitsamt dem Knopf, auf dem
    // der Fokus stand. Ohne diesen Sprung fiele er auf <body>.
    expect(document.activeElement?.textContent).toBe('Was davon steht in deiner Lösung?');
  });

  it('sperrt nach der Auflösung, benennt Wesentliches und zeigt die Musterlösung', async () => {
    const nutzer = userEvent.setup();
    const { inPhase } = stelleDar();
    await nutzer.type(screen.getByLabelText('Deine Lösung'), loesung);
    inPhase('zuversicht');
    await nutzer.click(screen.getByRole('checkbox', { name: 'Ankündigung vor der Ausführung' }));
    inPhase('aufgeloest');

    for (const kasten of screen.getAllByRole('checkbox')) expect((kasten as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByText('wesentlich · fehlte')).toBeTruthy();
    expect(screen.getByText('Der Unternehmer hat recht.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Fertig' })).toBeNull();
  });

  /**
   * Nachtrag G: `data-zustand` je Pruefpunkt, erst nach der Aufloesung. Zwei
   * Szenarien, weil "gehabt" und "offen" beide am Nicht-Pflichtpunkt haengen
   * koennen und sich sonst nicht unterscheiden liessen. Nach dem Abhaken hat
   * der Pflichtpunkt (Index 0) im DOM eine Marke, die seinen zugaenglichen
   * Namen aendert — deshalb wird hier ueber die feste Reihenfolge der
   * Checkboxen zugegriffen statt ueber den Namen.
   */
  describe('data-zustand nach der Auflösung', () => {
    it('markiert den fehlenden Pflichtpunkt als "fehlt" und den abgehakten Nicht-Pflichtpunkt als "gehabt"', async () => {
      const nutzer = userEvent.setup();
      const { inPhase } = stelleDar();
      await nutzer.type(screen.getByLabelText('Deine Lösung'), loesung);
      inPhase('zuversicht');
      await nutzer.click(screen.getByRole('checkbox', { name: 'Ankündigung vor der Ausführung' }));
      inPhase('aufgeloest');

      const [pflichtpunkt, nichtPflichtpunkt] = screen.getAllByRole('checkbox');
      expect((pflichtpunkt.closest('label') as HTMLElement).dataset.zustand).toBe('fehlt');
      expect((nichtPflichtpunkt.closest('label') as HTMLElement).dataset.zustand).toBe('gehabt');
    });

    it('markiert einen nicht abgehakten Nicht-Pflichtpunkt als "offen"', async () => {
      const nutzer = userEvent.setup();
      const { inPhase } = stelleDar();
      await nutzer.type(screen.getByLabelText('Deine Lösung'), loesung);
      inPhase('zuversicht');
      await nutzer.click(screen.getByRole('checkbox', { name: 'Mengenrisiko ist nicht Vollständigkeitsrisiko' }));
      inPhase('aufgeloest');

      const [pflichtpunkt, nichtPflichtpunkt] = screen.getAllByRole('checkbox');
      expect((pflichtpunkt.closest('label') as HTMLElement).dataset.zustand).toBe('gehabt');
      expect((nichtPflichtpunkt.closest('label') as HTMLElement).dataset.zustand).toBe('offen');
    });

    it('trägt vor der Auflösung an keinem Prüfpunkt ein data-zustand', async () => {
      const nutzer = userEvent.setup();
      const { inPhase } = stelleDar();
      await nutzer.type(screen.getByLabelText('Deine Lösung'), loesung);
      inPhase('zuversicht');

      for (const kasten of screen.getAllByRole('checkbox')) {
        expect((kasten.closest('label') as HTMLElement).dataset.zustand).toBeUndefined();
      }
    });
  });

  /**
   * Nachtrag H: Die Marke "wesentlich" ohne Zusatz, wenn der Pflichtpunkt
   * abgehakt war — und nie am Nicht-Pflichtpunkt, egal ob abgehakt oder nicht.
   */
  it('zeigt "wesentlich" ohne Zusatz am abgehakten Pflichtpunkt und nie am Nicht-Pflichtpunkt', async () => {
    const nutzer = userEvent.setup();
    const { inPhase } = stelleDar();
    await nutzer.type(screen.getByLabelText('Deine Lösung'), loesung);
    inPhase('zuversicht');
    await nutzer.click(screen.getByRole('checkbox', { name: 'Mengenrisiko ist nicht Vollständigkeitsrisiko' }));
    inPhase('aufgeloest');

    expect(screen.getByText('wesentlich')).toBeTruthy();
    expect(screen.queryByText('wesentlich · fehlte')).toBeNull();
    const [pflichtpunkt, nichtPflichtpunkt] = screen.getAllByRole('checkbox');
    expect(pflichtpunkt.closest('label')?.querySelector('.pruefpunkt-marke')).toBeTruthy();
    expect(nichtPflichtpunkt.closest('label')?.querySelector('.pruefpunkt-marke')).toBeNull();
  });

  /** Nachtrag I: Ohne Musterlösung erscheint auch nach der Auflösung keine Überschrift dafür. */
  it('zeigt nach der Auflösung keine Musterlösung, wenn die Aufgabe keine hat', async () => {
    const nutzer = userEvent.setup();
    const { musterloesung: _musterloesung, ...ohneMusterloesung } = aufgabe;
    const onAbgegeben = vi.fn();
    const onErgebnis = vi.fn();
    const dargestellt = render(
      <Fall aufgabe={ohneMusterloesung} phase="offen" onAbgegeben={onAbgegeben} onErgebnis={onErgebnis} />,
    );
    await nutzer.type(screen.getByLabelText('Deine Lösung'), loesung);
    dargestellt.rerender(
      <Fall aufgabe={ohneMusterloesung} phase="zuversicht" onAbgegeben={onAbgegeben} onErgebnis={onErgebnis} />,
    );
    dargestellt.rerender(
      <Fall aufgabe={ohneMusterloesung} phase="aufgeloest" onAbgegeben={onAbgegeben} onErgebnis={onErgebnis} />,
    );

    expect(screen.queryByText('Musterlösung')).toBeNull();
  });

  /** Nachtrag J: Der Zähler zeigt die aktuelle Länge und zählt beim Tippen mit. */
  it('zeigt den Zeichenzähler und zählt beim Tippen mit', async () => {
    const nutzer = userEvent.setup();
    stelleDar();
    expect(screen.getByText(`0 / ${HOECHSTLAENGE}`)).toBeTruthy();

    await nutzer.type(screen.getByLabelText('Deine Lösung'), 'abc');
    expect(screen.getByText(`3 / ${HOECHSTLAENGE}`)).toBeTruthy();
  });

  /** Nachtrag K: In "abgegeben" und "aufgeloest" bleibt der geschriebene Text stehen, nur lesbar. */
  it('hält das Textfeld in "abgegeben" und "aufgeloest" readOnly, mit dem geschriebenen Text', async () => {
    const nutzer = userEvent.setup();
    const { inPhase } = stelleDar();
    await nutzer.type(screen.getByLabelText('Deine Lösung'), loesung);

    inPhase('abgegeben');
    let feld = screen.getByLabelText('Deine Lösung') as HTMLTextAreaElement;
    expect(feld.readOnly).toBe(true);
    expect(feld.value).toBe(loesung);

    inPhase('zuversicht');
    inPhase('aufgeloest');
    feld = screen.getByLabelText('Deine Lösung') as HTMLTextAreaElement;
    expect(feld.readOnly).toBe(true);
    expect(feld.value).toBe(loesung);
  });

  /**
   * Nachtrag L: `HOECHSTLAENGE` ist an tests/speicher.test.ts gekoppelt — der
   * dortige Größenwächter ("Größe eines Ereignisses") rechnet mit genau 2000
   * Umlauten als längstem `fall`-Text. Ändert sich diese Zahl hier, muss die
   * dortige Rechnung mitgezogen werden.
   */
  it('legt die Höchstlänge auf 2000 fest', () => {
    expect(HOECHSTLAENGE).toBe(2000);
  });
});
