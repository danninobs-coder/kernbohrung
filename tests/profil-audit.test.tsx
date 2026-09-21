import 'fake-indexeddb/auto';

import { describe, it, expect, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Audit, { Wahlfrage } from '../src/profil/Audit';
import { BEIPACKZETTEL } from '../src/profil/Ergebnis';
import { GRUPPEN, GRUPPENGROESSEN, ITEMS } from '../src/profil/items';
import { ProfilstandSchema } from '../src/profil/schema';
import { idbOeffner, speicher as echterSpeicher, type Speicher } from '../src/tutor/speicher';

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

/**
 * Das Audit braucht je Durchlauf Dutzende Bedienschritte, und jeder kostet unter
 * jsdom einige zehn Millisekunden. Auf einem Rechner, auf dem nebenher andere
 * Laeufe arbeiten, reichen die ueblichen fuenf Sekunden dann nicht sicher — und
 * ein Test, der nur unter Last scheitert, ist ein Geisterfehler.
 */
vi.setConfig({ testTimeout: 20_000 });

const JETZT = '2026-09-19T10:00:00.000Z';
const uhr = () => new Date(JETZT);

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

/** Die Aussage an Stelle `stelle` der Gruppe `gruppe` — in der Reihenfolge, in der das Audit fragt. */
function aussage(gruppe: number, stelle: number) {
  const item = GRUPPEN[gruppe]?.[stelle];
  if (item === undefined) throw new Error(`Keine Aussage ${gruppe}/${stelle}.`);
  return item;
}

function frage(text: string): HTMLElement {
  return screen.getByRole('group', { name: text });
}

/** Das Radiofeld, dessen Name mit `anfang` beginnt: `4` fuer „4 — trifft eher zu". */
function feld(gruppe: HTMLElement, anfang: string | number): HTMLInputElement {
  return within(gruppe).getByRole('radio', { name: new RegExp(`^${anfang}( |$)`) }) as HTMLInputElement;
}

/**
 * Ueber die Beschriftung gesucht, nicht ueber `getByRole`: Die Rollensuche
 * rechnet fuer jedes der dreissig Radiofelder Sichtbarkeit und Namen aus und
 * kostet hier je Aufruf rund 40 ms. Ein `<button>` ist ein Knopf — an seiner
 * Rolle gibt es nichts zu pruefen.
 */
function knopf(name: string): HTMLButtonElement {
  const gefunden = [...document.querySelectorAll('button')].find((b) => b.textContent === name);
  if (gefunden === undefined) throw new Error(`Kein Knopf „${name}".`);
  return gefunden;
}

function kopf(): string | null {
  return document.querySelector('.audit-kopf')?.textContent ?? null;
}

/**
 * Ein Speicher, der mitschreibt UND behaelt — dieselbe Naht wie `spion()` in
 * `tests/aufgabe.test.tsx`, nur mit Gedaechtnis, weil das Audit seinen
 * Zwischenstand wieder liest. Hier ist die Attrappe richtig: Geprueft wird,
 * WAS das Audit der Speicherschicht uebergibt. Dass IndexedDB es behaelt,
 * prueft der letzte Test dieser Datei am echten Speicher.
 */
function spion(teil: Partial<Speicher> = {}, anfang: Record<string, unknown> = {}) {
  const ablage = new Map<string, unknown>(Object.entries(anfang));
  const geschrieben: { schluessel: string; wert: unknown }[] = [];
  const speicher: Speicher = {
    merkeEreignis: async () => true,
    ereignisse: async () => [],
    merkeKarte: async () => true,
    karte: async () => null,
    karten: async () => [],
    einstellung: async (schluessel) => ablage.get(schluessel),
    merkeEinstellung: async (schluessel, wert) => {
      geschrieben.push({ schluessel, wert });
      ablage.set(schluessel, wert);
      return true;
    },
    alsJson: async () => '{}',
    schliessen: async () => {},
    ...teil,
  };
  return { speicher, ablage, geschrieben };
}

async function zuDenVorlieben(nutzer: Nutzer): Promise<void> {
  for (let i = 0; i < GRUPPENGROESSEN.length; i++) await nutzer.click(knopf('Weiter'));
}

async function waehleVorlieben(nutzer: Nutzer): Promise<void> {
  await nutzer.click(feld(frage('Womit steigst du lieber ein?'), 'Beispiel zuerst'));
  await nutzer.click(feld(frage('Wie lang darf eine Sitzung sein?'), '10 Minuten'));
  await nutzer.click(feld(frage('Was liest du lieber?'), 'egal'));
}

/** Der kuerzeste Weg zum Ergebnis: jede Aussage uebersprungen, drei Vorlieben gewaehlt. */
async function bisZumErgebnis(nutzer: Nutzer): Promise<void> {
  await zuDenVorlieben(nutzer);
  await waehleVorlieben(nutzer);
  await nutzer.click(knopf('Ergebnis ansehen'));
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

describe('Audit — der Ablauf', () => {
  it('beginnt mit den ersten sechs Aussagen in der gemischten Reihenfolge', () => {
    render(<Audit speicher={spion().speicher} uhr={uhr} />);
    expect(kopf()).toBe('Aussagen 1 bis 6 von 26');
    expect(screen.getAllByRole('group').map((g) => g.querySelector('legend')?.textContent)).toEqual(
      GRUPPEN[0]?.map((item) => item.text),
    );
    expect(screen.queryByRole('button', { name: 'Zurück' })).toBeNull();
  });

  it('geht auch ohne eine einzige Antwort weiter — das Audit ist ein Angebot', async () => {
    const nutzer = neuerNutzer();
    render(<Audit speicher={spion().speicher} uhr={uhr} />);

    await nutzer.click(knopf('Weiter'));
    expect(kopf()).toBe('Aussagen 7 bis 11 von 26');
    await nutzer.click(knopf('Weiter'));
    await nutzer.click(knopf('Weiter'));
    await nutzer.click(knopf('Weiter'));
    expect(kopf()).toBe('Aussagen 22 bis 26 von 26');
    await nutzer.click(knopf('Weiter'));
    expect(kopf()).toBe('Drei Vorlieben');
  });

  it('fuehrt mit Zurück in die vorige Gruppe und behaelt die Antworten', async () => {
    const nutzer = neuerNutzer();
    render(<Audit speicher={spion().speicher} uhr={uhr} />);

    await nutzer.click(feld(frage(aussage(0, 0).text), 4));
    await nutzer.click(knopf('Weiter'));
    await nutzer.click(knopf('Zurück'));

    expect(kopf()).toBe('Aussagen 1 bis 6 von 26');
    expect(feld(frage(aussage(0, 0).text), 4).checked).toBe(true);
    expect(screen.getByText(/1 von 26 Aussagen beantwortet/)).toBeTruthy();
  });

  it('gibt das Ergebnis erst frei, wenn alle drei Vorlieben gewaehlt sind', async () => {
    const nutzer = neuerNutzer();
    render(<Audit speicher={spion().speicher} uhr={uhr} />);
    await zuDenVorlieben(nutzer);

    expect(knopf('Ergebnis ansehen').disabled).toBe(true);
    expect(screen.getByText('Noch 3 von drei Vorlieben offen.')).toBeTruthy();

    await nutzer.click(feld(frage('Womit steigst du lieber ein?'), 'Beispiel zuerst'));
    await nutzer.click(feld(frage('Wie lang darf eine Sitzung sein?'), '10 Minuten'));
    expect(knopf('Ergebnis ansehen').disabled).toBe(true);
    expect(screen.getByText('Noch 1 von drei Vorlieben offen.')).toBeTruthy();

    await nutzer.click(feld(frage('Was liest du lieber?'), 'egal'));
    expect(knopf('Ergebnis ansehen').disabled).toBe(false);
    expect(screen.queryByText(/Vorlieben offen/)).toBeNull();
  });

  it('zeigt am Ende das Ergebnis an Ort und Stelle — mit Beipackzettel', async () => {
    const nutzer = neuerNutzer();
    render(<Audit speicher={spion().speicher} uhr={uhr} />);
    // Beide Aussagen zu „anwendungsorientiert" mit 5: ein eindeutiges Muster.
    for (let g = 0; g < GRUPPEN.length; g++) {
      for (const item of GRUPPEN[g] ?? []) {
        if (item.dimension === 'anwendungsorientiert') await nutzer.click(feld(frage(item.text), 5));
      }
      await nutzer.click(knopf('Weiter'));
    }
    await waehleVorlieben(nutzer);
    await nutzer.click(knopf('Ergebnis ansehen'));

    expect(kopf()).toBe('Dein Ergebnis');
    expect(screen.getByText('Dein Lernmuster ist derzeit anwendungsorientiert.')).toBeTruthy();
    expect(screen.getByText(BEIPACKZETTEL)).toBeTruthy();
    expect(screen.queryByRole('radio')).toBeNull();
  });

  it('setzt den Fokus beim Schrittwechsel auf die Ueberschrift — aber nicht beim Laden', async () => {
    const nutzer = neuerNutzer();
    render(<Audit speicher={spion().speicher} uhr={uhr} />);
    // Beim Laden stiehlt das Audit keinen Fokus.
    expect(document.activeElement).toBe(document.body);

    await nutzer.click(knopf('Weiter'));
    // Die alte Gruppe ist weg. Bliebe der Fokus auf „Weiter" am Seitenende,
    // muesste die Tastatur rueckwaerts durch die neue Gruppe.
    expect(document.activeElement).toBe(document.querySelector('.audit-kopf'));
    expect(document.activeElement?.textContent).toBe('Aussagen 7 bis 11 von 26');
  });

  it('traegt den ganzen Ablauf ohne Maus', async () => {
    const nutzer = neuerNutzer();
    const { speicher, ablage } = spion();
    render(<Audit speicher={speicher} uhr={uhr} />);

    /** Tab, bis der Knopf den Fokus hat — hoechstens ein paar Stationen weit. */
    async function tabBis(name: string): Promise<void> {
      const ziel = knopf(name);
      for (let i = 0; i < 8 && document.activeElement !== ziel; i++) await nutzer.tab();
      expect(document.activeElement).toBe(ziel);
    }

    // Die erste Aussage mit allem, was die Tastatur kann: Tab fuehrt hinein,
    // die Leertaste waehlt die 1, zwei Pfeile weiter steht die 3.
    await nutzer.tab();
    expect(document.activeElement).toBe(feld(frage(aussage(0, 0).text), 1));
    await nutzer.keyboard('[Space]{ArrowRight}{ArrowRight}');
    expect(feld(frage(aussage(0, 0).text), 3).checked).toBe(true);

    // Alle uebrigen: Tab in die naechste Aussage, Leertaste.
    for (const [g, groesse] of GRUPPENGROESSEN.entries()) {
      for (let i = g === 0 ? 1 : 0; i < groesse; i++) {
        await nutzer.tab();
        await nutzer.keyboard('[Space]');
      }
      await tabBis('Weiter');
      await nutzer.keyboard('{Enter}');
      // Der Fokus steht jetzt auf der Ueberschrift; der naechste Tab fuehrt in
      // die erste Aussage der neuen Gruppe, nicht zurueck an den Seitenanfang.
      expect(document.activeElement).toBe(document.querySelector('.audit-kopf'));
    }

    expect(kopf()).toBe('Drei Vorlieben');
    for (let i = 0; i < 3; i++) {
      await nutzer.tab();
      await nutzer.keyboard('[Space]');
    }
    await tabBis('Ergebnis ansehen');
    await nutzer.keyboard('{Enter}');

    expect(kopf()).toBe('Dein Ergebnis');
    expect(document.activeElement).toBe(document.querySelector('.audit-kopf'));
    await waitFor(() => expect(ablage.get('profil')).toBeTruthy());
    const stand = ProfilstandSchema.parse(ablage.get('profil'));
    expect(Object.keys(stand.antworten).sort()).toEqual(ITEMS.map((item) => item.id).sort());
    expect(stand.antworten[aussage(0, 0).id]).toBe(3);
    expect(Object.values(stand.antworten).filter((wert) => wert === 1)).toHaveLength(ITEMS.length - 1);
    expect(stand.vorlieben).toEqual({ einstieg: 'ueberblick', minuten: 5, text: 'stichpunkte' });
    // Eigene Frist: rund sechzig Tastendruecke, jeder mit einem Neuaufbau unter jsdom.
  }, 30_000);
});

describe('Audit — was gespeichert wird', () => {
  it('speichert die Antworten und die Vorlieben — und kein Ergebnis', async () => {
    const nutzer = neuerNutzer();
    const { speicher, ablage } = spion();
    render(<Audit speicher={speicher} uhr={uhr} />);

    await nutzer.click(feld(frage(aussage(0, 0).text), 4));
    await nutzer.click(feld(frage(aussage(0, 1).text), 2));
    await bisZumErgebnis(nutzer);

    await waitFor(() => expect(ablage.get('profil')).toBeTruthy());
    // `toEqual` gegen das GANZE Objekt: Ein zusaetzliches Feld — ein
    // Lernmuster, ein Skalenwert — liesse den Test scheitern.
    expect(ablage.get('profil')).toEqual({
      itemsatz: 1,
      erhoben: JETZT,
      antworten: { [aussage(0, 0).id]: 4, [aussage(0, 1).id]: 2 },
      vorlieben: { einstieg: 'beispiel', minuten: 10, text: 'egal' },
    });
    expect(ProfilstandSchema.safeParse(ablage.get('profil')).success).toBe(true);
  });

  it('schreibt den Zwischenstand bei jeder Antwort fort', async () => {
    const nutzer = neuerNutzer();
    const { speicher, geschrieben } = spion();
    render(<Audit speicher={speicher} uhr={uhr} />);

    await nutzer.click(feld(frage(aussage(0, 0).text), 4));

    expect(geschrieben).toEqual([
      {
        schluessel: 'profil:entwurf',
        wert: { itemsatz: 1, antworten: { [aussage(0, 0).id]: 4 }, vorlieben: {}, schritt: 0 },
      },
    ]);
  });

  it('macht nach dem Neuladen dort weiter, wo es aufgehoert hat', async () => {
    const nutzer = neuerNutzer();
    const { speicher } = spion();
    const erste = render(<Audit speicher={speicher} uhr={uhr} />);
    await nutzer.click(feld(frage(aussage(0, 0).text), 4));
    await nutzer.click(knopf('Weiter'));
    await nutzer.click(feld(frage(aussage(1, 0).text), 2));
    erste.unmount();

    render(<Audit speicher={speicher} uhr={uhr} />);

    await waitFor(() => expect(kopf()).toBe('Aussagen 7 bis 11 von 26'));
    expect(feld(frage(aussage(1, 0).text), 2).checked).toBe(true);
    expect(screen.getByText(/2 von 26 Aussagen beantwortet/)).toBeTruthy();
    await nutzer.click(knopf('Zurück'));
    expect(feld(frage(aussage(0, 0).text), 4).checked).toBe(true);
  });

  it('wirft den Zwischenstand weg, sobald das Profil gespeichert ist', async () => {
    const nutzer = neuerNutzer();
    const { speicher, ablage, geschrieben } = spion();
    render(<Audit speicher={speicher} uhr={uhr} />);
    await bisZumErgebnis(nutzer);

    // Der Speicher kennt kein Entfernen; `null` heisst „kein Entwurf".
    await waitFor(() => expect(ablage.get('profil:entwurf')).toBeNull());
    expect(geschrieben.at(-2)?.schluessel).toBe('profil');
    expect(geschrieben.at(-1)).toEqual({ schluessel: 'profil:entwurf', wert: null });
  });

  it('verwirft einen unlesbaren Zwischenstand und faengt vorn an', async () => {
    const { speicher } = spion({}, { 'profil:entwurf': { itemsatz: 2, antworten: {}, vorlieben: {}, schritt: 3 } });
    render(<Audit speicher={speicher} uhr={uhr} />);

    await act(async () => {
      await Promise.resolve();
    });
    expect(kopf()).toBe('Aussagen 1 bis 6 von 26');
  });

  it('ueberschreibt nichts Angefasstes, wenn der Zwischenstand spaet eintrifft', async () => {
    const nutzer = neuerNutzer();
    let liefere: (wert: unknown) => void = () => {};
    const spaet = new Promise<unknown>((ok) => {
      liefere = ok;
    });
    const { speicher } = spion({ einstellung: () => spaet });
    render(<Audit speicher={speicher} uhr={uhr} />);

    await nutzer.click(feld(frage(aussage(0, 0).text), 4));
    await act(async () => {
      liefere({ itemsatz: 1, antworten: { [aussage(0, 1).id]: 2 }, vorlieben: {}, schritt: 3 });
      await spaet;
    });

    expect(kopf()).toBe('Aussagen 1 bis 6 von 26');
    expect(feld(frage(aussage(0, 0).text), 4).checked).toBe(true);
    expect(feld(frage(aussage(0, 1).text), 2).checked).toBe(false);
  });
});

describe('der Speicher haelt das Audit nie auf', () => {
  it('ist sofort bedienbar, wenn der Speicher beim Lesen gar nicht antwortet', async () => {
    const nutzer = neuerNutzer();
    const { speicher } = spion({ einstellung: () => new Promise<unknown>(() => {}) });
    render(<Audit speicher={speicher} uhr={uhr} />);

    await nutzer.click(feld(frage(aussage(0, 0).text), 5));
    expect(feld(frage(aussage(0, 0).text), 5).checked).toBe(true);
    await nutzer.click(knopf('Weiter'));
    expect(kopf()).toBe('Aussagen 7 bis 11 von 26');
  });

  it('zeigt das Ergebnis, wenn das Speichern false meldet — mit Hinweis', async () => {
    const nutzer = neuerNutzer();
    const { speicher } = spion({ merkeEinstellung: async () => false });
    render(<Audit speicher={speicher} uhr={uhr} />);
    await bisZumErgebnis(nutzer);

    expect(kopf()).toBe('Dein Ergebnis');
    expect(screen.getByText(BEIPACKZETTEL)).toBeTruthy();
    expect((await screen.findByRole('status')).textContent).toMatch(/nicht gespeichert/);
  });

  it('zeigt das Ergebnis, wenn das Speichern wirft — mit Hinweis', async () => {
    const warnung = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const nutzer = neuerNutzer();
    const { speicher } = spion({
      merkeEinstellung: () => {
        throw new Error('kein Speicher');
      },
    });
    render(<Audit speicher={speicher} uhr={uhr} />);
    await bisZumErgebnis(nutzer);

    expect(kopf()).toBe('Dein Ergebnis');
    expect((await screen.findByRole('status')).textContent).toMatch(/nicht gespeichert/);
    expect(warnung).toHaveBeenCalled();
    warnung.mockRestore();
  });

  it('zeigt das Ergebnis, wenn das Speichern gar nicht antwortet', async () => {
    // Der haerteste Fall: eine Zusage, die nie eingeloest wird. Wer die Anzeige
    // hinter das Schreiben haengte, bliebe hier fuer immer bei den Vorlieben.
    const nutzer = neuerNutzer();
    const { speicher } = spion({ merkeEinstellung: () => new Promise<boolean>(() => {}) });
    render(<Audit speicher={speicher} uhr={uhr} />);
    await bisZumErgebnis(nutzer);

    expect(kopf()).toBe('Dein Ergebnis');
    expect(screen.getByText(BEIPACKZETTEL)).toBeTruthy();
  });

  it('laesst den Zwischenstand liegen, wenn das Profil nicht gespeichert werden konnte', async () => {
    const nutzer = neuerNutzer();
    const geschrieben: string[] = [];
    const { speicher } = spion({
      merkeEinstellung: async (schluessel, wert) => {
        if (schluessel === 'profil:entwurf' && wert === null) geschrieben.push('entwurf geloescht');
        return schluessel !== 'profil';
      },
    });
    render(<Audit speicher={speicher} uhr={uhr} />);
    await bisZumErgebnis(nutzer);

    await screen.findByRole('status');
    // Nach dem Neuladen laesst sich der letzte Schritt wiederholen.
    expect(geschrieben).toEqual([]);
  });
});

describe('Audit am echten IndexedDB', () => {
  it('ueberlebt ein Neuladen und landet als gueltiger Stand im Auszug', async () => {
    const nutzer = neuerNutzer();
    const name = `audit-probe-${Date.now()}`;

    const erster = echterSpeicher(idbOeffner(name));
    const erste = render(<Audit speicher={erster} uhr={uhr} />);
    await nutzer.click(feld(frage(aussage(0, 0).text), 4));
    await nutzer.click(knopf('Weiter'));
    await waitFor(async () => expect(await erster.einstellung('profil:entwurf')).toMatchObject({ schritt: 1 }));
    erste.unmount();
    await erster.schliessen();

    const zweiter = echterSpeicher(idbOeffner(name));
    render(<Audit speicher={zweiter} uhr={uhr} />);
    await waitFor(() => expect(kopf()).toBe('Aussagen 7 bis 11 von 26'));
    await nutzer.click(knopf('Weiter'));
    await nutzer.click(knopf('Weiter'));
    await nutzer.click(knopf('Weiter'));
    await nutzer.click(knopf('Weiter'));
    await waehleVorlieben(nutzer);
    await nutzer.click(knopf('Ergebnis ansehen'));

    await waitFor(async () => expect(await zweiter.einstellung('profil:entwurf')).toBeNull());
    const gespeichert = await zweiter.einstellung('profil');
    expect(gespeichert).toEqual({
      itemsatz: 1,
      erhoben: JETZT,
      antworten: { [aussage(0, 0).id]: 4 },
      vorlieben: { einstieg: 'beispiel', minuten: 10, text: 'egal' },
    });
    // `alsJson()` nimmt das Profil von selbst mit — ohne neue Fassung des Speichers.
    const auszug = JSON.parse(await zweiter.alsJson()) as { einstellungen: Record<string, unknown> };
    expect(auszug.einstellungen.profil).toEqual(gespeichert);
    await zweiter.schliessen();
  });
});
