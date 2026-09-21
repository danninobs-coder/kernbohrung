import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Zuordnen from '../src/aufgaben/zuordnen/Zuordnen';
import type { Zuordnen as ZuordnenAufgabe } from '../src/aufgaben/zuordnen/schema';

const aufgabe: ZuordnenAufgabe = {
  typ: 'zuordnen',
  id: 'z-test',
  aufgabe: 'Ordne jeder Vertragsart ihre Vergütungsgrundlage zu.',
  paare: [
    { links: 'Einheitspreisvertrag', rechts: 'Preis je Einheit mal Menge' },
    { links: 'Pauschalvertrag', rechts: 'Ein Preis fürs Ganze' },
    { links: 'Stundenlohnvertrag', rechts: 'Preis je Stunde' },
  ],
  ablenker: ['Anteil an der Miete'],
};

type Nutzer = ReturnType<typeof userEvent.setup>;

function links(name: string): HTMLButtonElement {
  return screen.getByRole('button', { name: new RegExp(`^${name}`) }) as HTMLButtonElement;
}

function option(text: string): HTMLButtonElement {
  return screen.getByRole('button', { name: text }) as HTMLButtonElement;
}

async function ordne(nutzer: Nutzer, linkerEintrag: string, rechterEintrag: string): Promise<void> {
  await nutzer.click(links(linkerEintrag));
  await nutzer.click(option(rechterEintrag));
}

function stelleDar(phase: 'offen' | 'abgegeben' | 'aufgeloest' = 'offen') {
  const onAbgegeben = vi.fn();
  const dargestellt = render(
    <Zuordnen aufgabe={aufgabe} phase={phase} onAbgegeben={onAbgegeben} onErgebnis={vi.fn()} />,
  );
  const inPhase = (neu: typeof phase) =>
    dargestellt.rerender(
      <Zuordnen aufgabe={aufgabe} phase={neu} onAbgegeben={onAbgegeben} onErgebnis={vi.fn()} />,
    );
  return { onAbgegeben, inPhase };
}

describe('Zuordnen', () => {
  it('klappt die rechten Einträge unter dem angetippten linken auf — samt Ablenker', async () => {
    const nutzer = userEvent.setup();
    stelleDar();
    expect(screen.queryByRole('button', { name: 'Preis je Stunde' })).toBeNull();

    await nutzer.click(links('Pauschalvertrag'));

    expect(links('Pauschalvertrag').getAttribute('aria-expanded')).toBe('true');
    for (const rechts of [...aufgabe.paare.map((p) => p.rechts), 'Anteil an der Miete']) {
      expect(option(rechts)).toBeTruthy();
    }
    // Der Fokus folgt dem Aufklappen, sonst laege die Auswahl fuer die
    // Tastatur hinter allen uebrigen linken Eintraegen.
    expect(document.activeElement?.className).toBe('zuordnen-option');
  });

  it('bildet ein Paar, klappt zu und gibt den Fokus an den linken Eintrag zurück', async () => {
    const nutzer = userEvent.setup();
    stelleDar();
    await ordne(nutzer, 'Pauschalvertrag', 'Ein Preis fürs Ganze');

    expect(links('Pauschalvertrag').textContent).toContain('Ein Preis fürs Ganze');
    expect(links('Pauschalvertrag').getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(links('Pauschalvertrag'));
  });

  it('vergibt jeden rechten Eintrag nur einmal', async () => {
    const nutzer = userEvent.setup();
    stelleDar();
    await ordne(nutzer, 'Pauschalvertrag', 'Ein Preis fürs Ganze');
    await nutzer.click(links('Stundenlohnvertrag'));

    expect(option('Ein Preis fürs Ganze').disabled).toBe(true);
    expect(option('Preis je Stunde').disabled).toBe(false);
  });

  it('löst ein bestehendes Paar, wenn man es antippt', async () => {
    const nutzer = userEvent.setup();
    stelleDar();
    await ordne(nutzer, 'Pauschalvertrag', 'Preis je Stunde');

    await nutzer.click(links('Pauschalvertrag'));

    expect(links('Pauschalvertrag').textContent).toContain('noch nichts zugeordnet');
    expect(option('Preis je Stunde').disabled).toBe(false);
  });

  it('lässt erst abgeben, wenn jeder linke Eintrag ein Paar hat, und meldet die Bewertung', async () => {
    const nutzer = userEvent.setup();
    const { onAbgegeben } = stelleDar();
    const abgeben = screen.getByRole('button', { name: 'Abgeben' }) as HTMLButtonElement;
    expect(abgeben.disabled).toBe(true);

    await ordne(nutzer, 'Einheitspreisvertrag', 'Preis je Einheit mal Menge');
    await ordne(nutzer, 'Pauschalvertrag', 'Ein Preis fürs Ganze');
    expect(abgeben.disabled).toBe(true);
    await ordne(nutzer, 'Stundenlohnvertrag', 'Preis je Stunde');
    expect(abgeben.disabled).toBe(false);

    await nutzer.click(abgeben);
    const abgabe = onAbgegeben.mock.calls[0][0];
    expect(abgabe.ergebnis).toMatchObject({ richtig: true, anteil: 1, merkmal: '' });
    expect(abgabe.antwort).toBe(abgabe.ergebnis.antwort);
  });

  it('meldet bei einer Verwechslung den Anteil und die falschen Paare', async () => {
    const nutzer = userEvent.setup();
    const { onAbgegeben } = stelleDar();
    await ordne(nutzer, 'Einheitspreisvertrag', 'Ein Preis fürs Ganze');
    await ordne(nutzer, 'Pauschalvertrag', 'Preis je Einheit mal Menge');
    await ordne(nutzer, 'Stundenlohnvertrag', 'Preis je Stunde');
    await nutzer.click(screen.getByRole('button', { name: 'Abgeben' }));

    expect(onAbgegeben.mock.calls[0][0].ergebnis).toMatchObject({
      richtig: false,
      anteil: 1 / 3,
      merkmal: 'Einheitspreisvertrag→Ein Preis fürs Ganze;Pauschalvertrag→Preis je Einheit mal Menge',
    });
  });

  it('sperrt nach der Abgabe und nennt in der Auflösung, was richtig gewesen wäre', async () => {
    const nutzer = userEvent.setup();
    const { inPhase } = stelleDar();
    await ordne(nutzer, 'Einheitspreisvertrag', 'Ein Preis fürs Ganze');
    await ordne(nutzer, 'Pauschalvertrag', 'Preis je Einheit mal Menge');
    await ordne(nutzer, 'Stundenlohnvertrag', 'Preis je Stunde');

    inPhase('abgegeben');
    expect(links('Pauschalvertrag').disabled).toBe(true);
    expect(screen.queryByRole('button', { name: 'Abgeben' })).toBeNull();

    inPhase('aufgeloest');
    expect(screen.getByText('richtig wäre: Preis je Einheit mal Menge')).toBeTruthy();
    expect(screen.getAllByText('richtig')).toHaveLength(1);
  });

  /**
   * Nachtrag M: Denselben, noch ungepaarten linken Eintrag zweimal antippen
   * ist ein Umschalter — er klappt wieder zu. Ohne diesen Test koennte ein
   * Griff, der `oeffne` in ein reines "immer aufklappen" verwandelt, unbemerkt
   * bleiben.
   */
  it('M: klappt beim zweiten Antippen desselben, noch ungepaarten linken Eintrags wieder zu', async () => {
    const nutzer = userEvent.setup();
    stelleDar();
    await nutzer.click(links('Pauschalvertrag'));
    await nutzer.click(links('Pauschalvertrag'));

    expect(links('Pauschalvertrag').getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('group')).toBeNull();
  });

  /**
   * Nachtrag N: Ein zweiter, ANDERER linker Eintrag klappt den ersten zu und
   * sich selbst auf — zu jedem Zeitpunkt ist hoechstens eine Optionsgruppe im
   * Dokument.
   */
  it('N: tippt man einen anderen linken Eintrag an, ist nur dieser aufgeklappt', async () => {
    const nutzer = userEvent.setup();
    stelleDar();
    await nutzer.click(links('Pauschalvertrag'));
    await nutzer.click(links('Stundenlohnvertrag'));

    expect(links('Pauschalvertrag').getAttribute('aria-expanded')).toBe('false');
    expect(links('Stundenlohnvertrag').getAttribute('aria-expanded')).toBe('true');
    expect(screen.getAllByRole('group')).toHaveLength(1);
  });

  /**
   * Nachtrag O: Der Fokus beim Aufklappen geht auf die erste NICHT vergebene
   * Option, nicht stumpf auf die erste des Arrays.
   *
   * Mischreihenfolge fuer id 'z-test' — ermittelt mit `mischen()` aus
   * src/lib/mischen.ts unter reinem Node (rechts-Eintraege plus Ablenker in
   * der Reihenfolge, in der sie der Komponente uebergeben werden):
   *   mischen(
   *     ['Preis je Einheit mal Menge', 'Ein Preis fürs Ganze', 'Preis je Stunde', 'Anteil an der Miete'],
   *     'z-test',
   *   )
   *   -> ['Preis je Stunde', 'Ein Preis fürs Ganze', 'Preis je Einheit mal Menge', 'Anteil an der Miete']
   * 'Preis je Stunde' steht an erster Stelle der Mischung.
   */
  it('O: der Fokus geht beim Aufklappen auf die erste noch freie Option', async () => {
    const nutzer = userEvent.setup();
    stelleDar();
    // Belegt die in der Mischreihenfolge erste Option ('Preis je Stunde').
    await ordne(nutzer, 'Stundenlohnvertrag', 'Preis je Stunde');

    await nutzer.click(links('Pauschalvertrag'));

    // 'Preis je Stunde' ist vergeben; die naechste freie Option in der
    // Mischreihenfolge ist 'Ein Preis fürs Ganze' — dorthin muss der Fokus
    // gehen, nicht auf eine gesperrte Option.
    expect(document.activeElement).toBe(option('Ein Preis fürs Ganze'));
  });

  /**
   * Nachtrag P: Waehlt man den Ablenker, ist die Abgabe falsch, und `merkmal`
   * traegt genau das Paar mit dem Ablenker — Wert exakt gegen `bewerten.ts`
   * geprueft (alsText haengt "links→ist" der falschen Paare mit ";" aneinander;
   * hier gibt es nur ein falsches Paar).
   */
  it('P: waehlt man den Ablenker, ist die Abgabe falsch und merkmal nennt das Paar mit dem Ablenker', async () => {
    const nutzer = userEvent.setup();
    const { onAbgegeben } = stelleDar();
    await ordne(nutzer, 'Einheitspreisvertrag', 'Anteil an der Miete');
    await ordne(nutzer, 'Pauschalvertrag', 'Ein Preis fürs Ganze');
    await ordne(nutzer, 'Stundenlohnvertrag', 'Preis je Stunde');

    await nutzer.click(screen.getByRole('button', { name: 'Abgeben' }));

    expect(onAbgegeben.mock.calls[0][0].ergebnis).toMatchObject({
      richtig: false,
      anteil: 2 / 3,
      merkmal: 'Einheitspreisvertrag→Anteil an der Miete',
    });
  });

  /**
   * Nachtrag Q: `data-zustand` traegt vor der Aufloesung KEIN Attribut — auch
   * nicht in "abgegeben". Die Marke ("richtig" bzw. "richtig waere: …") steht
   * ebenfalls erst in "aufgeloest": Sie wuerde die Loesung schon vor der
   * Zuversicht verraten.
   */
  it('Q: data-zustand und die Marke stehen erst in "aufgeloest", nicht schon in "abgegeben"', async () => {
    const nutzer = userEvent.setup();
    const { inPhase } = stelleDar();
    await ordne(nutzer, 'Einheitspreisvertrag', 'Ein Preis fürs Ganze');
    await ordne(nutzer, 'Pauschalvertrag', 'Preis je Einheit mal Menge');
    await ordne(nutzer, 'Stundenlohnvertrag', 'Preis je Stunde');

    for (const zeile of document.querySelectorAll('.zuordnen-zeile')) {
      expect((zeile as HTMLElement).dataset.zustand).toBeUndefined();
    }

    inPhase('abgegeben');
    for (const zeile of document.querySelectorAll('.zuordnen-zeile')) {
      expect((zeile as HTMLElement).dataset.zustand).toBeUndefined();
    }
    expect(screen.queryByText('richtig')).toBeNull();
    expect(screen.queryByText(/richtig wäre:/)).toBeNull();

    inPhase('aufgeloest');
    const zeileEinheit = links('Einheitspreisvertrag').closest('li') as HTMLElement;
    const zeilePauschal = links('Pauschalvertrag').closest('li') as HTMLElement;
    const zeileStunden = links('Stundenlohnvertrag').closest('li') as HTMLElement;
    expect(zeileEinheit.dataset.zustand).toBe('falsch');
    expect(zeilePauschal.dataset.zustand).toBe('falsch');
    expect(zeileStunden.dataset.zustand).toBe('richtig');
    expect(screen.getAllByText('richtig')).toHaveLength(1);
    expect(screen.getByText('richtig wäre: Preis je Einheit mal Menge')).toBeTruthy();
    expect(screen.getByText('richtig wäre: Ein Preis fürs Ganze')).toBeTruthy();
  });

  /**
   * Nachtrag R: Wie bei `Wahl` und `Fall` steht der Ergebnissatz zwischen
   * Aufgabentext und der Liste.
   */
  it('R: stellt den Ergebnissatz zwischen Frage und Liste', () => {
    render(
      <Zuordnen
        aufgabe={aufgabe}
        phase="aufgeloest"
        onAbgegeben={vi.fn()}
        onErgebnis={vi.fn()}
        ergebnissatz={<p data-testid="satz">Richtig.</p>}
      />,
    );
    const satz = screen.getByTestId('satz');
    expect(satz.previousElementSibling?.className).toBe('frage-text');
    expect(satz.nextElementSibling?.className).toBe('zuordnen-liste');
  });

  /**
   * Nachtrag S: In "abgegeben" und "aufgeloest" laesst sich nichts mehr
   * aufklappen — die linken Eintraege sind gesperrt — und die gebildeten
   * Paare bleiben sichtbar.
   */
  it('S: laesst sich in "abgegeben" und "aufgeloest" nicht mehr aufklappen, die Paare bleiben sichtbar', async () => {
    const nutzer = userEvent.setup();
    const { inPhase } = stelleDar();
    await ordne(nutzer, 'Einheitspreisvertrag', 'Preis je Einheit mal Menge');
    await ordne(nutzer, 'Pauschalvertrag', 'Ein Preis fürs Ganze');
    await ordne(nutzer, 'Stundenlohnvertrag', 'Preis je Stunde');

    inPhase('abgegeben');
    await nutzer.click(links('Pauschalvertrag'));
    expect(screen.queryByRole('group')).toBeNull();
    expect(links('Pauschalvertrag').textContent).toContain('Ein Preis fürs Ganze');

    inPhase('aufgeloest');
    await nutzer.click(links('Pauschalvertrag'));
    expect(screen.queryByRole('group')).toBeNull();
    expect(links('Pauschalvertrag').textContent).toContain('Ein Preis fürs Ganze');
  });

  /**
   * Nachtrag T: Die Reihenfolge der rechten Seite haengt an der `id`.
   *
   * Node-Probe mit `mischen()` aus src/lib/mischen.ts (rechts-Eintraege plus
   * Ablenker, wie sie der Komponente uebergeben werden):
   *   mischen([...], 'z-test')   -> ['Preis je Stunde', 'Ein Preis fürs Ganze', 'Preis je Einheit mal Menge', 'Anteil an der Miete']
   *   mischen([...], 'z-test-2') -> ['Preis je Stunde', 'Ein Preis fürs Ganze', 'Anteil an der Miete', 'Preis je Einheit mal Menge']
   * 'z-test-2' vertauscht die letzten beiden Eintraege gegenueber 'z-test' —
   * eine nachweislich andere Reihenfolge bei gleichen Eintraegen. Der Ablenker
   * steht dabei mitten in BEIDEN Listen, nicht angehaengt: Er wird mit den
   * echten rechten Eintraegen gemeinsam gemischt.
   */
  it('T: mischt die rechte Seite anhand der id, der Ablenker eingerechnet', async () => {
    const nutzer = userEvent.setup();
    const andereAufgabe: ZuordnenAufgabe = { ...aufgabe, id: 'z-test-2' };
    render(<Zuordnen aufgabe={andereAufgabe} phase="offen" onAbgegeben={vi.fn()} onErgebnis={vi.fn()} />);

    await nutzer.click(links('Pauschalvertrag'));
    const gruppe = screen.getByRole('group', { name: 'Zuordnung für Pauschalvertrag' });
    const reihenfolge = within(gruppe)
      .getAllByRole('button')
      .map((knopf) => knopf.textContent);

    expect(reihenfolge).toEqual([
      'Preis je Stunde',
      'Ein Preis fürs Ganze',
      'Anteil an der Miete',
      'Preis je Einheit mal Menge',
    ]);
  });

  /**
   * Nachtrag U: Ein Doppelklick auf "Abgeben" ruft `onAbgegeben` zweimal —
   * der Vertrag erlaubt das ausdruecklich, solange die Zuversicht aussteht.
   * Beide Abgaben muessen dann identisch sein, sonst kaeme in der Huelle ein
   * unklarer Zustand an. `Zuordnen` bekommt dagegen keine eigene Sperre, wie
   * `Fall` sie fuer "Fertig" hat — dort ist eine zweite Meldung verboten, hier
   * ausdruecklich zulaessig.
   */
  it('U: meldet einen Doppelklick auf "Abgeben" zweimal, aber mit identischer Abgabe', async () => {
    const nutzer = userEvent.setup();
    const { onAbgegeben } = stelleDar();
    await ordne(nutzer, 'Einheitspreisvertrag', 'Preis je Einheit mal Menge');
    await ordne(nutzer, 'Pauschalvertrag', 'Ein Preis fürs Ganze');
    await ordne(nutzer, 'Stundenlohnvertrag', 'Preis je Stunde');

    await nutzer.dblClick(screen.getByRole('button', { name: 'Abgeben' }));

    expect(onAbgegeben).toHaveBeenCalledTimes(2);
    expect(onAbgegeben.mock.calls[0][0]).toEqual(onAbgegeben.mock.calls[1][0]);
  });
});
