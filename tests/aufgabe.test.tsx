import { describe, it, expect, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Aufgabe from '../src/components/Aufgabe';
import type { Wahl } from '../src/aufgaben/wahl/schema';
import type { Fall } from '../src/aufgaben/fall/schema';
import type { Zuordnen } from '../src/aufgaben/zuordnen/schema';
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
  aufgabe: {
    typ: 'wahl',
    id: 'f-test',
    frage: 'Was sortiert ein Reranker?',
    antworten: [
      { text: 'Die Kandidaten', richtig: true, begruendung: 'Genau das ist seine Aufgabe.' },
      { text: 'Den Index', richtig: false, begruendung: 'Den rührt er nicht an.' },
      { text: 'Die Anfrage', richtig: false, begruendung: 'Die bleibt unverändert.' },
    ],
  } satisfies Wahl,
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
  const dargestellt = render(<Aufgabe {...daten} speicher={speicher} uhr={uhr} />);
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

describe('Aufgabe — die Hülle, mit typ wahl', () => {
  it('zeigt die Frage und alle Antworten', () => {
    stelleDar();
    expect(screen.getByText('Was sortiert ein Reranker?')).toBeTruthy();
    for (const a of daten.aufgabe.antworten) expect(knopf(a.text)).toBeTruthy();
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

    for (const a of daten.aufgabe.antworten) expect(screen.getByText(a.begruendung)).toBeTruthy();
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

    for (const a of daten.aufgabe.antworten) expect(knopf(a.text).disabled).toBe(true);

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
    const rotiert = [daten.aufgabe.antworten[1], daten.aufgabe.antworten[2], daten.aufgabe.antworten[0]];
    rerender(<Aufgabe {...daten} speicher={speicher} aufgabe={{ ...daten.aufgabe, antworten: rotiert }} />);

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
      for (const a of daten.aufgabe.antworten) {
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
      expect(auf.ereignisse[0].antwort).toBe('Die Kandidaten');
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
      expect(ereignis.typ).toBe('wahl');
      expect(ereignis.anteil).toBe(0);
      expect(ereignis.antwort).toBe('Den Index');
      expect(ereignis.merkmal).toBe('Den Index');
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
      for (const a of daten.aufgabe.antworten) {
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

describe('Aufgabe — die Hülle mit den übrigen Typen', () => {
  const fall: Fall = {
    typ: 'fall',
    id: 'h-fall',
    sachverhalt: 'Eine Gemeinde vergibt einen Rohbau pauschal. Eine nötige Leistung fehlt im Leistungsverzeichnis.',
    aufgabe: 'Wer hat recht?',
    pruefpunkte: [
      { text: 'Mengenrisiko ist nicht Vollständigkeitsrisiko', pflicht: true },
      { text: 'Ankündigung vor der Ausführung', pflicht: false },
    ],
  };

  const zuordnen: Zuordnen = {
    typ: 'zuordnen',
    id: 'h-zu',
    aufgabe: 'Ordne zu.',
    paare: [
      { links: 'Einheitspreisvertrag', rechts: 'Preis je Einheit mal Menge' },
      { links: 'Pauschalvertrag', rechts: 'Ein Preis fürs Ganze' },
      { links: 'Stundenlohnvertrag', rechts: 'Preis je Stunde' },
    ],
    ablenker: [],
  };

  async function schreibeUndGibAb(nutzer: ReturnType<typeof userEvent.setup>): Promise<void> {
    await nutzer.type(screen.getByLabelText('Deine Lösung'), 'Der Unternehmer hat recht.');
    await nutzer.click(screen.getByRole('button', { name: 'Abgeben' }));
  }

  it('trägt den Typ als Attribut an der Karte', () => {
    const { speicher } = spion();
    const { container } = render(<Aufgabe lektion="l" aufgabe={fall} speicher={speicher} />);
    expect(container.querySelector('.frage')?.getAttribute('data-typ')).toBe('fall');
  });

  it('zeigt bei einem Fall die Prüfpunkte erst NACH der Zuversicht', async () => {
    const nutzer = userEvent.setup();
    const { speicher } = spion();
    render(<Aufgabe lektion="l" aufgabe={fall} speicher={speicher} />);
    await schreibeUndGibAb(nutzer);

    // Die Zuversichtsfrage steht da, die Pruefpunkte nicht: Wer sie vorher
    // saehe, schaetzte nicht sein Wissen ein, sondern laese ab.
    expect(stufenKnopf('sicher')).toBeTruthy();
    expect(screen.queryByRole('checkbox')).toBeNull();

    await nutzer.click(stufenKnopf('eher'));
    expect(screen.getAllByRole('checkbox')).toHaveLength(2);
  });

  it('zeichnet einen Fall erst auf, wenn die Prüfpunkte abgehakt sind', async () => {
    const nutzer = userEvent.setup();
    const { speicher, auf } = spion();
    render(<Aufgabe lektion="l" aufgabe={fall} speicher={speicher} />);
    await schreibeUndGibAb(nutzer);
    await nutzer.click(stufenKnopf('sicher'));

    // Die Zuversicht steht, das Ergebnis noch nicht. Es gibt nichts Ehrliches
    // aufzuzeichnen — `richtig` haette keinen Wert.
    expect(auf.ereignisse).toEqual([]);

    await nutzer.click(screen.getByRole('checkbox', { name: 'Ankündigung vor der Ausführung' }));
    await nutzer.click(screen.getByRole('button', { name: 'Fertig' }));

    await waitFor(() => expect(auf.ereignisse).toHaveLength(1));
    expect(auf.ereignisse[0]).toMatchObject({
      lektion: 'l',
      frage: 'h-fall',
      typ: 'fall',
      zuversicht: 'sicher',
      richtig: false,
      anteil: 0.5,
      antwort: 'Der Unternehmer hat recht.',
      merkmal: 'fehlt:1',
    });
    await waitFor(() => expect(auf.karten).toHaveLength(1));
    expect(screen.getByText(/Teilweise richtig\./)).toBeTruthy();
  });

  it('zeichnet nichts auf, wenn ein Fall nach der Zuversicht verlassen wird', async () => {
    const nutzer = userEvent.setup();
    const { speicher, auf } = spion();
    const { unmount } = render(<Aufgabe lektion="l" aufgabe={fall} speicher={speicher} />);
    await schreibeUndGibAb(nutzer);
    await nutzer.click(stufenKnopf('sicher'));
    unmount();
    await Promise.resolve();

    expect(auf.ereignisse).toEqual([]);
    expect(auf.karten).toEqual([]);
  });

  /**
   * Merkposten aus dem Review (4a): Der Fokus nach der Aufloesung steht nicht
   * nur bei wahl auf dem Ergebnissatz (siehe „Tastaturbedienung" oben),
   * sondern bei jedem Typ — hier bei fall, wo "Fertig" statt des
   * Zuversichtsknopfs das Element ist, das beim Aufloesen verschwindet.
   * Die Huelle kennt den Typ nicht; ihr Fokus-Effekt haengt nur an `aufgeloest`
   * und deckt deshalb beide Faelle mit demselben Code ab.
   */
  it('setzt bei einem Fall den Fokus auf den Ergebnissatz, wenn „Fertig" verschwindet', async () => {
    const nutzer = userEvent.setup();
    const { speicher, auf } = spion();
    const { container } = render(<Aufgabe lektion="l" aufgabe={fall} speicher={speicher} />);
    await schreibeUndGibAb(nutzer);
    await nutzer.click(stufenKnopf('sicher'));
    await nutzer.click(screen.getByRole('checkbox', { name: 'Ankündigung vor der Ausführung' }));

    const fertig = screen.getByRole('button', { name: 'Fertig' });
    fertig.focus();
    expect(document.activeElement).toBe(fertig);

    await nutzer.click(fertig);
    await waitFor(() => expect(auf.ereignisse).toHaveLength(1));

    // "Fertig" ist jetzt weg. Faellt der Fokus dabei auf <body>, verstummt
    // der Screenreader - siehe der Kommentar zum Fokus-Effekt in Aufgabe.tsx.
    const satz = container.querySelector('.aufloesung');
    expect(document.activeElement).toBe(satz);
    expect(document.activeElement).not.toBe(document.body);
  });

  it('nennt ein Teilergebnis beim Namen und speichert den Anteil', async () => {
    const nutzer = userEvent.setup();
    const { speicher, auf } = spion();
    render(<Aufgabe lektion="l" aufgabe={zuordnen} speicher={speicher} />);

    const ordne = async (links: string, rechts: string) => {
      await nutzer.click(screen.getByRole('button', { name: new RegExp(`^${links}`) }));
      await nutzer.click(screen.getByRole('button', { name: rechts }));
    };
    await ordne('Einheitspreisvertrag', 'Ein Preis fürs Ganze');
    await ordne('Pauschalvertrag', 'Preis je Einheit mal Menge');
    await ordne('Stundenlohnvertrag', 'Preis je Stunde');
    await nutzer.click(screen.getByRole('button', { name: 'Abgeben' }));
    await nutzer.click(stufenKnopf('eher'));

    expect(screen.getByText(/Teilweise richtig\./)).toBeTruthy();
    await waitFor(() => expect(auf.ereignisse).toHaveLength(1));
    expect(auf.ereignisse[0].typ).toBe('zuordnen');
    expect(auf.ereignisse[0].richtig).toBe(false);
    expect(auf.ereignisse[0].anteil).toBeCloseTo(1 / 3);
  });

  /**
   * Merkposten aus dem Review (4b): Doppelte Meldungen zeichnen nicht doppelt
   * auf.
   *
   * Der Wettlauf: `festlegen`/`abschliessen` in der Huelle prueften bisher nur
   * die `useState`-Werte `stufe`/`ergebnis`. Ein `useState`-Wert aendert sich
   * aber erst beim NAECHSTEN Render, nicht synchron innerhalb des Aufrufs, der
   * ihn setzt. Zwei native Klicks in einem einzigen `act()` reproduzieren genau
   * das: Zwischen ihnen liegt kein Render, beide Handler sehen denselben,
   * noch alten Zustand und riefen ohne Sperre `abschliessen` zweimal auf.
   */
  describe('Sperre gegen doppelte Aufzeichnung', () => {
    function klickeZweimalSynchron(element: HTMLElement): void {
      act(() => {
        element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      });
    }

    it('zeichnet bei wahl nur einmal auf, wenn die Zuversicht zweimal ausloest, bevor React neu rendert', async () => {
      const nutzer = userEvent.setup();
      const { auf } = stelleDar();
      await nutzer.click(knopf('Die Kandidaten'));

      klickeZweimalSynchron(stufenKnopf('sicher'));

      await waitFor(() => expect(auf.ereignisse.length).toBeGreaterThan(0));
      expect(auf.ereignisse).toHaveLength(1);
      expect(auf.karten).toHaveLength(1);
    });

    it('zeichnet bei einem Fall nur einmal auf, wenn „Fertig" zweimal ausloest', async () => {
      // Fall.tsx hat dafuer schon eine eigene Sperre (den `gemeldet`-Ref in
      // `fertig()`): Dieser Test bliebe auch ohne die Sperre in der Huelle
      // gruen. Er steht trotzdem hier, weil die Zusicherung „genau einmal
      // aufgezeichnet" der Huelle gehoert, nicht dem einzelnen Typ - ein
      // kuenftiger Typ ohne eigene Sperre muss sich genauso darauf verlassen
      // koennen.
      const nutzer = userEvent.setup();
      const { speicher, auf } = spion();
      render(<Aufgabe lektion="l" aufgabe={fall} speicher={speicher} />);
      await schreibeUndGibAb(nutzer);
      await nutzer.click(stufenKnopf('sicher'));
      await nutzer.click(screen.getByRole('checkbox', { name: 'Ankündigung vor der Ausführung' }));

      klickeZweimalSynchron(screen.getByRole('button', { name: 'Fertig' }));

      await waitFor(() => expect(auf.ereignisse.length).toBeGreaterThan(0));
      expect(auf.ereignisse).toHaveLength(1);
      expect(auf.karten).toHaveLength(1);
    });
  });
});
