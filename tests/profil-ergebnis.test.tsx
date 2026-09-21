import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import Ergebnis, {
  BEIPACKZETTEL,
  Ergebnisansicht,
  MOMENTAUFNAHME,
  MUSTER_ERKLAERUNG,
  STRUKTURHINWEIS,
  alsZahl,
  mustersatz,
} from '../src/profil/Ergebnis';
import { werteAus, type Auswertung } from '../src/profil/auswertung';
import { ITEMS, SKALEN, type Wert } from '../src/profil/items';
import { VORSCHLAG } from '../src/profil/vorschlag';
import type { Speicher } from '../src/tutor/speicher';

const ERHOBEN = '2026-09-19T10:00:00.000Z';
const TAG = 24 * 60 * 60 * 1000;

/** Eine unauffaellige Auswertung. Jeder Test ueberschreibt, worum es ihm geht. */
function auswertung(teil: Partial<Auswertung> = {}): Auswertung {
  return {
    skalen: { ordnen: 4, verknuepfen: 4, abrufen: 4, steuern: 4, dranbleiben: 4, zeiteinteilen: 4 },
    muster: { bedeutungsorientiert: 3, reproduktionsorientiert: 2, anwendungsorientiert: 4.5, ungerichtet: 2 },
    lernmuster: { art: 'eindeutig', muster: 'anwendungsorientiert' },
    strukturhinweis: false,
    schwachstellen: [],
    ...teil,
  };
}

function zeige(teil: Partial<Auswertung> = {}, jetzt = new Date(ERHOBEN)) {
  return render(<Ergebnisansicht auswertung={auswertung(teil)} erhoben={ERHOBEN} jetzt={jetzt} />);
}

describe('die festen Texte der Ergebnisseite', () => {
  it('traegt den Beipackzettel im Wortlaut des Specs', () => {
    expect(BEIPACKZETTEL).toBe(
      'Dieses Profil beruht auf eigenen Aussagen nach veröffentlichten Modellen der Lernstrategien (LIST, MSLQ) und den Lernmustern nach Vermunt. Es ist keine geprüfte Skala. Was die App über dein Lernen wirklich weiß, stammt aus deinen Antworten auf Aufgaben — siehe Kalibrierung.',
    );
  });

  it('traegt den Satz zur Momentaufnahme im Wortlaut des Specs', () => {
    expect(MOMENTAUFNAHME).toBe(
      'Muster ändern sich mit Stoff und Übung. Das ist eine Momentaufnahme, keine Diagnose.',
    );
  });

  it('sagt ein Muster nie ohne das Wort „derzeit"', () => {
    expect(mustersatz({ art: 'eindeutig', muster: 'anwendungsorientiert' })).toBe(
      'Dein Lernmuster ist derzeit anwendungsorientiert.',
    );
    expect(mustersatz({ art: 'zwischen', a: 'bedeutungsorientiert', b: 'anwendungsorientiert' })).toBe(
      'Dein Lernmuster liegt derzeit zwischen bedeutungsorientiert und anwendungsorientiert.',
    );
  });

  it('schreibt Zahlen mit Komma und einer Stelle', () => {
    expect(alsZahl(8 / 3)).toBe('2,7');
    expect(alsZahl(3)).toBe('3,0');
  });
});

describe('Ergebnisansicht', () => {
  it('zeigt ein eindeutiges Muster mit Erklaerung, Momentaufnahme und Beipackzettel', () => {
    zeige();
    expect(screen.getByText('Dein Lernmuster ist derzeit anwendungsorientiert.')).toBeTruthy();
    expect(screen.getByText(MUSTER_ERKLAERUNG.anwendungsorientiert)).toBeTruthy();
    expect(screen.getByText(MOMENTAUFNAHME)).toBeTruthy();
    expect(screen.getByText(BEIPACKZETTEL)).toBeTruthy();
  });

  it('zeigt „zwischen A und B" mit beiden Erklaerungen — und dem Beipackzettel', () => {
    zeige({ lernmuster: { art: 'zwischen', a: 'bedeutungsorientiert', b: 'anwendungsorientiert' } });
    expect(
      screen.getByText('Dein Lernmuster liegt derzeit zwischen bedeutungsorientiert und anwendungsorientiert.'),
    ).toBeTruthy();
    expect(screen.getByText(MUSTER_ERKLAERUNG.bedeutungsorientiert, { exact: false })).toBeTruthy();
    expect(screen.getByText(MUSTER_ERKLAERUNG.anwendungsorientiert, { exact: false })).toBeTruthy();
    expect(screen.getByText(BEIPACKZETTEL)).toBeTruthy();
  });

  it('zeigt den Strukturhinweis unabhaengig vom fuehrenden Muster — und den Beipackzettel', () => {
    zeige({ strukturhinweis: true });
    expect(screen.getByText('Dein Lernmuster ist derzeit anwendungsorientiert.')).toBeTruthy();
    expect(screen.getByText(STRUKTURHINWEIS)).toBeTruthy();
    expect(screen.getByText(BEIPACKZETTEL)).toBeTruthy();
  });

  it('zeigt ohne Befund keinen Strukturhinweis', () => {
    zeige({ strukturhinweis: false });
    expect(screen.queryByText(STRUKTURHINWEIS)).toBeNull();
  });

  it('behauptet ohne erhobenes Muster keines — der Beipackzettel steht trotzdem da', () => {
    zeige({ lernmuster: null });
    expect(screen.queryByText(/derzeit/)).toBeNull();
    expect(screen.queryByText(MOMENTAUFNAHME)).toBeNull();
    expect(screen.getByText(/nicht erhoben — dafür fehlen Antworten/)).toBeTruthy();
    expect(screen.getByText(BEIPACKZETTEL)).toBeTruthy();
  });

  it('zeigt sechs Balken mit Zahl, nicht nur mit Farbe', () => {
    const { container } = zeige({
      skalen: { ordnen: 7 / 3, verknuepfen: 4, abrufen: 5 / 3, steuern: 3, dranbleiben: 5, zeiteinteilen: 1 },
    });
    const zeilen = [...container.querySelectorAll('.balken-zeile')];
    expect(zeilen.map((z) => z.getAttribute('data-skala'))).toEqual([...SKALEN]);
    expect(zeilen.map((z) => z.querySelector('.balken-zahl')?.textContent)).toEqual([
      '2,3 von 5',
      '4,0 von 5',
      '1,7 von 5',
      '3,0 von 5',
      '5,0 von 5',
      '1,0 von 5',
    ]);
    expect(zeilen[0]?.querySelector('.balken-name')?.textContent).toBe('Ordnen');
  });

  it('schreibt bei einer nicht erhobenen Skala „nicht erhoben" statt einer Null', () => {
    const { container } = zeige({
      skalen: { ordnen: null, verknuepfen: 4, abrufen: 4, steuern: 4, dranbleiben: 4, zeiteinteilen: 4 },
    });
    const ordnen = container.querySelector('[data-skala="ordnen"]');
    expect(ordnen?.querySelector('.balken-zahl')?.textContent).toBe('nicht erhoben');
    expect(ordnen?.textContent).not.toMatch(/0,0/);
  });

  it('macht je Schwachstelle genau einen Vorschlag, im Wortlaut', () => {
    zeige({ schwachstellen: ['abrufen', 'ordnen'] });
    expect(screen.getByText(VORSCHLAG.abrufen)).toBeTruthy();
    expect(screen.getByText(VORSCHLAG.ordnen)).toBeTruthy();
    for (const skala of ['verknuepfen', 'steuern', 'dranbleiben', 'zeiteinteilen'] as const) {
      expect(screen.queryByText(VORSCHLAG[skala])).toBeNull();
    }
    // Am Balken steht die Marke in Worten, nicht nur in Farbe.
    expect(screen.getAllByText('dazu unten ein Vorschlag')).toHaveLength(2);
  });

  it('erfindet keinen Mangel: ohne Schwachstelle kein Vorschlag', () => {
    const { container } = zeige({ schwachstellen: [] });
    expect(container.querySelectorAll('.vorschlag')).toHaveLength(0);
    expect(screen.getByText(/gibt es hier auch keinen Vorschlag/)).toBeTruthy();
  });

  it('weist ab acht Wochen auf eine Wiederholung hin — vorher nicht', () => {
    const vorher = zeige({}, new Date(new Date(ERHOBEN).getTime() + 56 * TAG - 1));
    expect(screen.queryByText(/älter als acht Wochen/)).toBeNull();
    vorher.unmount();

    zeige({}, new Date(new Date(ERHOBEN).getTime() + 56 * TAG));
    expect(screen.getByText(/älter als acht Wochen/)).toBeTruthy();
  });

  it('sagt offen, wenn das Ergebnis nicht behalten wurde', () => {
    render(<Ergebnisansicht auswertung={auswertung()} erhoben={ERHOBEN} nichtBehalten />);
    expect(screen.getByRole('status').textContent).toMatch(/nicht gespeichert/);
  });

  it('zeigt den Verweis zum Neu-Erheben, den die Seite hereinreicht', () => {
    render(<Ergebnisansicht auswertung={auswertung()} erhoben={ERHOBEN} erneut={<a href="/x/">Neu erheben</a>} />);
    expect(screen.getByRole('link', { name: 'Neu erheben' })).toBeTruthy();
  });

  it('nennt das Datum der Erhebung, ohne fuehrende Nullen', () => {
    // Mittags UTC: In jeder bewohnten Zeitzone ist das derselbe Kalendertag,
    // der Test haengt also nicht an der Zeitzone des Rechners.
    render(<Ergebnisansicht auswertung={auswertung()} erhoben="2026-09-05T12:00:00.000Z" />);
    expect(screen.getByText('Erhoben am 5.9.2026.')).toBeTruthy();
  });

  it('gibt dem Lernmuster eine Ueberschrift wie den anderen Abschnitten', () => {
    // Wer per Ueberschrift springt, darf den wichtigsten Abschnitt nicht
    // ueberspringen.
    render(<Ergebnisansicht auswertung={auswertung()} erhoben={ERHOBEN} />);
    expect(screen.getByRole('heading', { name: 'Dein Lernmuster' })).toBeTruthy();
  });

  it('zeigt NIE ein Muster ohne den Beipackzettel', () => {
    // Sechzig Antwortsaetze, stumpf durchgezaehlt: volle, halbe und leere,
    // eindeutige und unentschiedene. Die Regel ist nicht „der Beipackzettel
    // steht im Normalfall da", sondern „es gibt keinen Fall ohne ihn".
    const gesehen = new Set<string>();
    for (let n = 0; n < 60; n++) {
      const antworten: Record<string, Wert> = {};
      ITEMS.forEach((item, i) => {
        const wert = (n * 7 + i * (n % 5) + i * i) % 6;
        if (wert === 1 || wert === 2 || wert === 3 || wert === 4 || wert === 5) antworten[item.id] = wert;
      });
      const ergebnis = werteAus({ itemsatz: 1, antworten });
      if (ergebnis === null) throw new Error('Itemsatz 1 muss auswertbar sein.');

      const { container, unmount } = render(<Ergebnisansicht auswertung={ergebnis} erhoben={ERHOBEN} />);
      const art = container.querySelector('.muster-satz')?.getAttribute('data-muster') ?? 'fehlt';
      gesehen.add(art);
      if (art !== 'keins') {
        expect(container.querySelector('.beipackzettel')?.textContent).toContain(BEIPACKZETTEL);
      }
      unmount();
    }
    // Ohne diese Zeile koennte die Schleife gruen sein, weil sie nie ein
    // unentschiedenes Muster erzeugt hat.
    expect([...gesehen].sort()).toEqual(['eindeutig', 'keins', 'zwischen']);
  });
});

/**
 * Ein Speicher, der mitschreibt — dieselbe Naht wie `spion()` in
 * `tests/aufgabe.test.tsx`. Geprueft wird, was die Insel LIEST und dass sie
 * nichts schreibt; ob IndexedDB etwas behaelt, steht in speicher.test.ts.
 */
function spion(einstellungen: Record<string, unknown> = {}, teil: Partial<Speicher> = {}) {
  const geschrieben: { schluessel: string; wert: unknown }[] = [];
  const speicher: Speicher = {
    merkeEreignis: async () => true,
    ereignisse: async () => [],
    merkeKarte: async () => true,
    karte: async () => null,
    karten: async () => [],
    einstellung: async (schluessel) => einstellungen[schluessel],
    merkeEinstellung: async (schluessel, wert) => {
      geschrieben.push({ schluessel, wert });
      return true;
    },
    alsJson: async () => '{}',
    schliessen: async () => {},
    ...teil,
  };
  return { speicher, geschrieben };
}

const stand = {
  itemsatz: 1,
  erhoben: ERHOBEN,
  antworten: { 'anw-1': 5, 'anw-2': 4, 'bed-1': 3, 'bed-2': 3, 'abr-1': 1, 'abr-2': 2, 'abr-3': 2 },
  vorlieben: { einstieg: 'beispiel', minuten: 10, text: 'egal' },
};

const anlegen = <a href="/profil/audit/">Lernprofil anlegen</a>;
const erneut = <a href="/profil/audit/">Neu erheben</a>;

describe('Ergebnis — die Insel auf /profil', () => {
  it('rechnet das gespeicherte Profil aus den Antworten und zeigt es', async () => {
    const { speicher } = spion({ profil: stand });
    render(<Ergebnis speicher={speicher} anlegen={anlegen} erneut={erneut} />);

    expect(await screen.findByText('Dein Lernmuster ist derzeit anwendungsorientiert.')).toBeTruthy();
    expect(screen.getByText(VORSCHLAG.abrufen)).toBeTruthy();
    expect(screen.getByText(BEIPACKZETTEL)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Neu erheben' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Lernprofil anlegen' })).toBeNull();
  });

  it('bietet das Audit an, wenn nichts gespeichert ist', async () => {
    const { speicher } = spion();
    render(<Ergebnis speicher={speicher} anlegen={anlegen} erneut={erneut} />);

    expect(await screen.findByText('Auf diesem Gerät liegt noch kein Lernprofil.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Lernprofil anlegen' })).toBeTruthy();
    expect(screen.queryByText(/derzeit/)).toBeNull();
  });

  it.each([
    ['ein unlesbarer Stand', { itemsatz: 1, antworten: 'kaputt' }],
    ['ein Stand zu einem fremden Itemsatz', { ...stand, itemsatz: 2 }],
    ['ein Stand, der sein Ergebnis mitbringt', { ...stand, lernmuster: 'anwendungsorientiert' }],
    ['ein geloeschter Wert', null],
  ])('behandelt als „kein Profil", ohne abzustuerzen: %s', async (_name, roh) => {
    const { speicher } = spion({ profil: roh });
    render(<Ergebnis speicher={speicher} anlegen={anlegen} erneut={erneut} />);

    expect(await screen.findByText('Auf diesem Gerät liegt noch kein Lernprofil.')).toBeTruthy();
    expect(screen.queryByText(/derzeit/)).toBeNull();
  });

  it('bleibt stehen, wenn der Speicher beim Lesen wirft', async () => {
    const warnung = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { speicher } = spion({}, { einstellung: () => Promise.reject(new Error('kein Speicher')) });
    render(<Ergebnis speicher={speicher} anlegen={anlegen} erneut={erneut} />);

    expect(await screen.findByText('Auf diesem Gerät liegt noch kein Lernprofil.')).toBeTruthy();
    expect(warnung).toHaveBeenCalled();
    warnung.mockRestore();
  });

  it('liest nur — das Ergebnis wird nie gespeichert', async () => {
    const { speicher, geschrieben } = spion({ profil: stand });
    render(<Ergebnis speicher={speicher} anlegen={anlegen} erneut={erneut} />);

    await screen.findByText(/derzeit/);
    await waitFor(() => expect(geschrieben).toEqual([]));
  });
});
