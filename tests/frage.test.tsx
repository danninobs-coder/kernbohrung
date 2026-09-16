import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Frage, { type Antwort } from '../src/components/Frage';
import { naechsterTermin, neueKarte, type Termin } from '../src/tutor/planung';
import type { Speicher } from '../src/tutor/speicher';
import { ZUVERSICHT_TEXT, type Ereignis, type Zuversicht as Stufe } from '../src/tutor/typen';

/**
 * Die Frage laeuft jetzt in zwei Schritten: Antwort, dann Zuversicht.
 *
 * Die sieben Zusicherungen der ersten Fassung stehen alle noch hier. Vier von
 * ihnen brauchten einen zusaetzlichen Klick, weil die Aufloesung nicht mehr an
 * der Antwort haengt, sondern an der Zuversicht — geprueft wird in ihnen
 * dasselbe wie vorher. Was dazugekommen ist: die Zwischenstufe, die
 * Tastaturbedienung, der Abbruch, die Messung und die Zusicherung, dass der
 * Speicher die Frage unter keinen Umstaenden aufhalten kann.
 */

const daten = {
  lektion: 'reranker',
  id: 'f-test',
  frage: 'Was sortiert ein Reranker?',
  antworten: [
    { text: 'Die Kandidaten', richtig: true, begruendung: 'Genau das ist seine Aufgabe.' },
    { text: 'Den Index', richtig: false, begruendung: 'Den rührt er nicht an.' },
    { text: 'Die Anfrage', richtig: false, begruendung: 'Die bleibt unverändert.' },
  ] satisfies Antwort[],
};

function knopf(text: string): HTMLButtonElement {
  return screen.getByRole('button', { name: text }) as HTMLButtonElement;
}

function stufenKnopf(s: Stufe): HTMLButtonElement {
  return screen.getByRole('button', {
    name: new RegExp(`^${ZUVERSICHT_TEXT[s]}`),
  }) as HTMLButtonElement;
}

type Aufzeichnung = {
  ereignisse: Ereignis[];
  karten: { lektion: string; frage: string; termin: Termin }[];
};

/**
 * Ein Speicher, der mitschreibt. Hier ist die Attrappe richtig: Geprueft wird,
 * WAS die Frage der Speicherschicht uebergibt, nicht ob IndexedDB es behaelt —
 * das steht in speicher.test.ts an echtem IndexedDB.
 */
function spion(teil: Partial<Speicher> = {}): { speicher: Speicher; auf: Aufzeichnung } {
  const auf: Aufzeichnung = { ereignisse: [], karten: [] };
  const speicher: Speicher = {
    merkeEreignis: async (ereignis) => {
      auf.ereignisse.push(ereignis);
      return true;
    },
    ereignisse: async () => auf.ereignisse,
    merkeKarte: async (lektion, frage, termin) => {
      auf.karten.push({ lektion, frage, termin });
      return true;
    },
    karte: async () => null,
    karten: async () => [],
    einstellung: async () => undefined,
    merkeEinstellung: async () => true,
    alsJson: async () => '{}',
    schliessen: async () => {},
    ...teil,
  };
  return { speicher, auf };
}

function stelleDar(teil: Partial<Speicher> = {}, uhr?: () => number) {
  const { speicher, auf } = spion(teil);
  const dargestellt = render(<Frage {...daten} speicher={speicher} uhr={uhr} />);
  return { ...dargestellt, speicher, auf };
}

/** Der ganze Ablauf in einem Aufruf: Antwort waehlen, Stufe waehlen. */
async function beantworte(
  nutzer: ReturnType<typeof userEvent.setup>,
  text: string,
  s: Stufe = 'sicher',
): Promise<void> {
  await nutzer.click(knopf(text));
  await nutzer.click(stufenKnopf(s));
}

describe('Frage', () => {
  it('zeigt die Frage und alle Antworten', () => {
    stelleDar();
    expect(screen.getByText('Was sortiert ein Reranker?')).toBeTruthy();
    for (const a of daten.antworten) expect(knopf(a.text)).toBeTruthy();
  });

  it('zeigt vor der Antwort keine Begründung', () => {
    stelleDar();
    expect(screen.queryByText('Genau das ist seine Aufgabe.')).toBeNull();
    expect(screen.queryByText('Den rührt er nicht an.')).toBeNull();
  });

  it('markiert nach einer falschen Wahl beide Zustände und zeigt alle Begründungen', async () => {
    const nutzer = userEvent.setup();
    stelleDar();
    await beantworte(nutzer, 'Den Index');

    expect(knopf('Den Index').dataset.zustand).toBe('falsch');
    expect(knopf('Die Kandidaten').dataset.zustand).toBe('richtig');
    expect(knopf('Die Anfrage').dataset.zustand).toBe('neutral');

    for (const a of daten.antworten) expect(screen.getByText(a.begruendung)).toBeTruthy();
  });

  it('markiert eine richtige Wahl als richtig', async () => {
    const nutzer = userEvent.setup();
    stelleDar();
    await beantworte(nutzer, 'Die Kandidaten');
    expect(knopf('Die Kandidaten').dataset.zustand).toBe('richtig');
  });

  it('lässt keinen zweiten Versuch zu', async () => {
    const nutzer = userEvent.setup();
    stelleDar();
    await beantworte(nutzer, 'Den Index');

    for (const a of daten.antworten) expect(knopf(a.text).disabled).toBe(true);

    await nutzer.click(knopf('Die Kandidaten'));
    expect(knopf('Den Index').dataset.zustand).toBe('falsch');
  });

  it('mischt stabil: gleiche Id ergibt gleiche Reihenfolge', () => {
    const { unmount } = stelleDar();
    const erste = screen.getAllByRole('button').map((b) => b.textContent);
    unmount();
    stelleDar();
    const zweite = screen.getAllByRole('button').map((b) => b.textContent);
    expect(zweite).toEqual(erste);
  });

  it('behaelt die Zuordnung, wenn das Elternteil die Antworten umsortiert', async () => {
    const nutzer = userEvent.setup();
    const { rerender, speicher } = stelleDar();
    await beantworte(nutzer, 'Den Index');
    expect(knopf('Den Index').dataset.zustand).toBe('falsch');

    // Gleiche Objekte, rotierte Reihenfolge - so wie ein Elternteil sie
    // nach einem Re-Render liefern koennte. Bewusst Rotation und kein
    // reverse(): bei drei Elementen bleibt beim Umdrehen das mittlere
    // stehen, und ein Index-Fehler an dieser Stelle bliebe verdeckt.
    const rotiert = [daten.antworten[1], daten.antworten[2], daten.antworten[0]];
    rerender(<Frage {...daten} speicher={speicher} antworten={rotiert} />);

    expect(knopf('Den Index').dataset.zustand).toBe('falsch');
    expect(knopf('Die Anfrage').dataset.zustand).toBe('neutral');
    expect(knopf('Die Kandidaten').dataset.zustand).toBe('richtig');
  });

  describe('der Zuversichtsschritt', () => {
    it('fragt die Sicherheit erst, wenn eine Antwort gewählt ist', async () => {
      const nutzer = userEvent.setup();
      stelleDar();
      expect(screen.queryByRole('group', { name: 'Wie sicher bist du?' })).toBeNull();

      await nutzer.click(knopf('Den Index'));
      expect(screen.getByRole('group', { name: 'Wie sicher bist du?' })).toBeTruthy();
    });

    it('hält die Auflösung zurück, bis die Zuversicht feststeht', async () => {
      const nutzer = userEvent.setup();
      const { container, auf } = stelleDar();
      await nutzer.click(knopf('Den Index'));

      // Gewählt ist markiert - aber noch ohne Urteil.
      expect(knopf('Den Index').dataset.zustand).toBe('gewaehlt');
      expect(knopf('Die Kandidaten').dataset.zustand).toBe('offen');
      for (const a of daten.antworten) {
        expect(screen.queryByText(a.begruendung)).toBeNull();
        expect(knopf(a.text).disabled).toBe(false);
      }
      expect(container.querySelector('.aufloesung')).toBeNull();
      expect(auf.ereignisse).toEqual([]);
    });

    it('lässt die Antwort vor der Zuversicht noch wechseln', async () => {
      const nutzer = userEvent.setup();
      const { auf } = stelleDar();
      await nutzer.click(knopf('Den Index'));
      await nutzer.click(knopf('Die Kandidaten'));

      expect(knopf('Den Index').dataset.zustand).toBe('offen');
      expect(knopf('Die Kandidaten').dataset.zustand).toBe('gewaehlt');

      await nutzer.click(stufenKnopf('sicher'));
      await waitFor(() => expect(auf.ereignisse).toHaveLength(1));
      expect(auf.ereignisse[0].gewaehlt).toBe('Die Kandidaten');
      expect(auf.ereignisse[0].richtig).toBe(true);
    });

    it('nennt im Ergebnissatz die angegebene Stufe', async () => {
      const nutzer = userEvent.setup();
      const { container } = stelleDar();
      await beantworte(nutzer, 'Die Kandidaten', 'eher');

      const satz = container.querySelector('.aufloesung');
      expect(satz?.textContent).toContain('Richtig.');
      expect(satz?.textContent).toContain('Angegeben: Eher schon.');
      expect(satz?.getAttribute('data-ergebnis')).toBe('richtig');
    });

    it('benennt den teuren Fall: sicher und daneben', async () => {
      const nutzer = userEvent.setup();
      const { container } = stelleDar();
      await beantworte(nutzer, 'Den Index', 'sicher');

      const satz = container.querySelector('.aufloesung');
      expect(satz?.getAttribute('data-ergebnis')).toBe('falsch');
      expect(satz?.textContent).toContain('Sicher und daneben');
    });

    it('nimmt den Zuversichtsblock nach der Festlegung wieder weg', async () => {
      const nutzer = userEvent.setup();
      stelleDar();
      await beantworte(nutzer, 'Den Index');
      expect(screen.queryByRole('group', { name: 'Wie sicher bist du?' })).toBeNull();
    });
  });

  describe('Tastaturbedienung', () => {
    it('trägt den ganzen Ablauf ohne Maus', async () => {
      const nutzer = userEvent.setup();
      const { container, auf } = stelleDar();

      await nutzer.tab();
      const erste = screen.getAllByRole('button')[0] as HTMLButtonElement;
      expect(document.activeElement).toBe(erste);

      // Enter auf dem Antwortknopf.
      await nutzer.keyboard('{Enter}');
      expect(erste.dataset.zustand).toBe('gewaehlt');

      // Der Fokus wandert mit: Ohne diesen Sprung fuehrte der naechste Tab
      // erst durch die restlichen Antworten, bevor er beim zweiten Schritt
      // ankommt - beim Druck auf die erste Antwort waeren das drei Stationen.
      expect(document.activeElement).toBe(stufenKnopf('sicher'));

      // Leertaste auf dem Stufenknopf.
      await nutzer.keyboard('[Space]');

      // Der Knopf, auf dem der Fokus stand, ist jetzt weg. Faellt der Fokus
      // dabei auf <body>, verstummt der Screenreader und die Tastatur faengt
      // beim naechsten Tab ganz oben auf der Seite an.
      const satz = container.querySelector('.aufloesung');
      expect(document.activeElement).toBe(satz);
      expect(document.activeElement).not.toBe(document.body);
      expect(satz?.textContent).toContain('Angegeben: Sicher.');

      await waitFor(() => expect(auf.ereignisse).toHaveLength(1));
    });

    it('lässt die gewählte Antwort ansagen, ohne eine eigene Region dafür', async () => {
      const nutzer = userEvent.setup();
      stelleDar();
      expect(knopf('Den Index').getAttribute('aria-pressed')).toBe('false');
      await nutzer.click(knopf('Den Index'));
      expect(knopf('Den Index').getAttribute('aria-pressed')).toBe('true');
      expect(knopf('Die Anfrage').getAttribute('aria-pressed')).toBe('false');
    });

    it('sagt die Auflösung auch ohne Farbe', async () => {
      const nutzer = userEvent.setup();
      stelleDar();
      await beantworte(nutzer, 'Den Index');
      // WCAG 1.4.1: Rand und Randfarbe allein reichen nicht.
      expect(screen.getByText('richtig')).toBeTruthy();
      expect(screen.getByText('deine Wahl')).toBeTruthy();
    });
  });

  describe('Aufzeichnung', () => {
    it('schreibt Ereignis und Karte mit allem, was der Vertrag verlangt', async () => {
      const nutzer = userEvent.setup();
      const { auf } = stelleDar({}, () => 0);
      const vorher = Date.now();
      await beantworte(nutzer, 'Den Index', 'eher');

      await waitFor(() => expect(auf.ereignisse).toHaveLength(1));
      const ereignis = auf.ereignisse[0];
      expect(ereignis.lektion).toBe('reranker');
      expect(ereignis.frage).toBe('f-test');
      expect(ereignis.zuversicht).toBe('eher');
      expect(ereignis.richtig).toBe(false);
      expect(ereignis.gewaehlt).toBe('Den Index');
      expect(new Date(ereignis.zeitpunkt).getTime()).toBeGreaterThanOrEqual(vorher);

      await waitFor(() => expect(auf.karten).toHaveLength(1));
      expect(auf.karten[0].lektion).toBe('reranker');
      expect(auf.karten[0].frage).toBe('f-test');
    });

    /**
     * Die Mutationsprobe an der teuersten Stelle.
     *
     * Wer `sicher` und `geraten` beim Abbilden vertauscht, speichert einen
     * geratenen Treffer als sicheren. Sichtbar ist das nirgends: Die
     * Aufloesung stimmt, die Begruendungen stimmen, die Karte wird
     * geschrieben. Erst Wochen spaeter steht die Kalibrierung auf dem Kopf und
     * der Planer legt eine geratene Antwort ein halbes Jahr weg.
     *
     * Geprueft wird deshalb beides: was gespeichert wird UND was daraus
     * geplant wird. `naechsterTermin` ist ohne Streuung deterministisch, und
     * die Frage plant mit demselben Zeitpunkt, den sie ins Ereignis schreibt —
     * der Termin laesst sich daraus exakt nachrechnen.
     */
    it.each([
      ['sicher', 'geraten'],
      ['geraten', 'sicher'],
      ['eher', 'sicher'],
    ] as const)('speichert „%s" als %s nicht', async (gedrueckt, nichtDas) => {
      const nutzer = userEvent.setup();
      const { auf } = stelleDar();
      await beantworte(nutzer, 'Die Kandidaten', gedrueckt);

      await waitFor(() => expect(auf.karten).toHaveLength(1));
      expect(auf.ereignisse[0].zuversicht).toBe(gedrueckt);

      const jetzt = new Date(auf.ereignisse[0].zeitpunkt);
      const erwartet = naechsterTermin(neueKarte(jetzt), gedrueckt, true, jetzt);
      const falsch = naechsterTermin(neueKarte(jetzt), nichtDas, true, jetzt);
      expect(auf.karten[0].termin.faellig.getTime()).toBe(erwartet.faellig.getTime());
      expect(auf.karten[0].termin.faellig.getTime()).not.toBe(falsch.faellig.getTime());
    });

    it('schreibt eine vorhandene Karte fort, statt sie neu anzulegen', async () => {
      const nutzer = userEvent.setup();
      const angelegt = new Date('2026-09-01T10:00:00Z');
      const alt = naechsterTermin(neueKarte(angelegt), 'sicher', true, angelegt).karte;
      const { auf } = stelleDar({ karte: async () => alt });

      await beantworte(nutzer, 'Die Kandidaten', 'sicher');
      await waitFor(() => expect(auf.karten).toHaveLength(1));

      // Aus dem Bestand fortgeschrieben, nicht bei null angefangen: Die
      // Wiederholungszahl waere sonst bei jeder Antwort wieder 1.
      expect(auf.karten[0].termin.karte.reps).toBe(alt.reps + 1);
    });

    /**
     * Der Abbruch: Antwort gewaehlt, Seite verlassen, keine Stufe gedrueckt.
     *
     * Entschieden ist: Es wird NICHTS aufgezeichnet. Bis zur Stufe ist die
     * Wahl widerruflich (siehe den Test weiter oben), sie ist also ein
     * Entwurf und keine Antwort. Vor allem aber hat `Ereignis.zuversicht`
     * keinen ehrlichen Wert fuer diesen Fall: Jede der drei Stufen waere eine
     * Behauptung, die niemand aufgestellt hat. Sie zu erfinden verdirbt genau
     * die Zahl, fuer die dieser ganze Schritt gebaut wurde — und der Planer
     * bekaeme obendrein eine Karte aus einer Bewertung, die nie stattfand.
     * Eine abgebrochene Frage ist deshalb eine unbeantwortete Frage.
     */
    it('zeichnet nichts auf, wenn die Frage vor der Zuversicht verlassen wird', async () => {
      const nutzer = userEvent.setup();
      const { unmount, auf } = stelleDar();
      await nutzer.click(knopf('Den Index'));
      unmount();
      await Promise.resolve();

      expect(auf.ereignisse).toEqual([]);
      expect(auf.karten).toEqual([]);
    });
  });

  describe('der Speicher haelt die Frage nie auf', () => {
    /** Alles da, was die Aufloesung ausmacht - Urteil, Begruendungen, Sperre. */
    function pruefeAufloesung(container: HTMLElement): void {
      expect(container.querySelector('.aufloesung')?.textContent).toContain('Falsch.');
      expect(knopf('Den Index').dataset.zustand).toBe('falsch');
      expect(knopf('Die Kandidaten').dataset.zustand).toBe('richtig');
      for (const a of daten.antworten) {
        expect(screen.getByText(a.begruendung)).toBeTruthy();
        expect(knopf(a.text).disabled).toBe(true);
      }
    }

    it('löst auf, wenn das Schreiben wirft', async () => {
      const warnung = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const nutzer = userEvent.setup();
      const { container } = stelleDar({
        merkeEreignis: () => {
          throw new Error('kein Speicher');
        },
      });

      await beantworte(nutzer, 'Den Index');
      pruefeAufloesung(container);
      await waitFor(() => expect(warnung).toHaveBeenCalled());
      warnung.mockRestore();
    });

    it('löst auf, wenn das Schreiben scheitert und false meldet', async () => {
      const nutzer = userEvent.setup();
      const { container } = stelleDar({
        merkeEreignis: async () => false,
        merkeKarte: async () => false,
        karte: async () => null,
      });

      await beantworte(nutzer, 'Den Index');
      pruefeAufloesung(container);
    });

    it('löst auf, wenn der Speicher gar nicht antwortet', async () => {
      // Der haerteste Fall: eine Zusage, die nie eingeloest wird. Wer die
      // Anzeige hinter das Schreiben haengte - `await` vor `setStufe` -,
      // bliebe hier fuer immer bei der halben Frage stehen.
      const nutzer = userEvent.setup();
      const { container } = stelleDar({
        merkeEreignis: () => new Promise<boolean>(() => {}),
      });

      await beantworte(nutzer, 'Den Index');
      pruefeAufloesung(container);
    });
  });

  /**
   * Die Messung.
   *
   * `dauerMs` traegt die Spanne zwischen der Wahl der Antwort und der
   * Festlegung der Zuversicht — die Dauer der Selbsteinschaetzung. Nicht die
   * Zeit ab Anzeige der Frage: Auf einer Lektionsseite hydrieren vier Fragen
   * gleichzeitig, und die vierte haette dann die Lesezeit der drei davor
   * mitgemessen. Nicht die Zeit ab dem ersten Blick: Ein Beobachter meldet,
   * wann die Karte im Bild steht, nicht wann sie gelesen wird.
   */
  describe('dauerMs', () => {
    it('misst von der Antwort bis zur Zuversicht', async () => {
      const nutzer = userEvent.setup();
      let t = 0;
      const { auf } = stelleDar({}, () => t);

      t = 1000;
      await nutzer.click(knopf('Den Index'));
      t = 4500;
      await nutzer.click(stufenKnopf('sicher'));

      await waitFor(() => expect(auf.ereignisse).toHaveLength(1));
      expect(auf.ereignisse[0].dauerMs).toBe(3500);
    });

    it('setzt bei einem Sinneswandel nicht zurück', async () => {
      const nutzer = userEvent.setup();
      let t = 0;
      const { auf } = stelleDar({}, () => t);

      t = 1000;
      await nutzer.click(knopf('Den Index'));
      t = 3000;
      await nutzer.click(knopf('Die Kandidaten'));
      t = 5000;
      await nutzer.click(stufenKnopf('sicher'));

      await waitFor(() => expect(auf.ereignisse).toHaveLength(1));
      // 4000 und nicht 2000: Das Zoegern zwischen zwei Antworten gehoert zur
      // Selbsteinschaetzung dazu, nicht in einen verworfenen Anlauf.
      expect(auf.ereignisse[0].dauerMs).toBe(4000);
    });
  });
});
