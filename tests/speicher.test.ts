/**
 * Warum `fake-indexeddb` und nicht eine Attrappe.
 *
 * Vitest laeuft unter jsdom, und jsdom hat kein IndexedDB. Die naheliegende
 * Antwort waere, den Speicher hinter eine schmale Schnittstelle zu legen und
 * die im Test durch eine Attrappe zu ersetzen. Sie taugt hier nicht: Die
 * interessanten Eigenschaften dieser Schicht sind genau die, die IndexedDB
 * beisteuert und eine Attrappe erfinden muesste — dass ein Aufstieg von
 * Fassung 1 auf 2 den Bestand stehen laesst, dass `getAll` in
 * Schluesselreihenfolge liefert, dass eine geschlossene Verbindung wirft, dass
 * `Date` die strukturierte Kopie ueberlebt. Eine Attrappe, die das nachbaut,
 * prueft die Attrappe.
 *
 * `fake-indexeddb` 6.2.5 ist eine vollstaendige Umsetzung der Spezifikation:
 * 340 kB ausgepackt, 120 Dateien, **keine** Abhaengigkeiten, Apache-2.0, nur
 * Entwicklungsabhaengigkeit — im Browserbuendel landet nichts davon.
 *
 * Die Naht gibt es trotzdem, aber an der richtigen Stelle: `speicher()` nimmt
 * einen `Oeffner`. Damit laesst sich der Fehlschlag beim Oeffnen erzwingen,
 * ohne globale Objekte umzubiegen — und der ganze Rest der Schicht bleibt am
 * echten IndexedDB gemessen.
 */
import 'fake-indexeddb/auto';

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { IDBPDatabase } from 'idb';
import {
  FASSUNG,
  idbOeffner,
  speicher,
  SCHRITTE,
  type Ausfuhr,
  type Oeffner,
  type Schritt,
} from '../src/tutor/speicher';
import { naechsterTermin, neueKarte } from '../src/tutor/planung';
import type { Ereignis } from '../src/tutor/typen';

const JETZT = new Date('2026-09-16T10:00:00Z');

/** Je Test eine eigene Datenbank — fake-indexeddb haelt sie ueber die Datei hinweg. */
let zaehler = 0;
function neuerName(): string {
  zaehler++;
  return `probe-${zaehler}`;
}

function e(teil: Partial<Ereignis> = {}): Ereignis {
  return {
    lektion: 'recall-vor-precision',
    frage: 'rvp-1',
    zuversicht: 'sicher',
    richtig: true,
    gewaehlt: 'Der Recall der Kandidatenmenge',
    dauerMs: 8432,
    zeitpunkt: '2026-09-16T09:00:00.000Z',
    ...teil,
  };
}

let warnungen: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  // Die Warnungen gehoeren zur Zusicherung: Ein Fehlschlag wird gemeldet, nicht
  // verschluckt. Stummgeschaltet werden sie nur, damit die Testausgabe lesbar
  // bleibt — geprueft wird, dass sie kommen.
  warnungen = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  warnungen.mockRestore();
});

describe('Speicher im Normalfall', () => {
  it('haengt ein Ereignis an und liest es zurueck', async () => {
    const s = speicher(idbOeffner(neuerName()));
    expect(await s.merkeEreignis(e())).toBe(true);
    expect(await s.ereignisse()).toEqual([e()]);
    await s.schliessen();
  });

  it('gibt die Ereignisse in Einfügereihenfolge zurück, nicht nach Zeitstempel', async () => {
    // Der Fall, gegen den das gebaut ist: Eine Uhr, die wegen Zeitzonenwechsel
    // oder Zeitabgleich zurueckspringt. Wer nach `zeitpunkt` sortiert, stellt
    // damit die Historie um — und `reife.ts` liest „die letzte Antwort"
    // schlicht als letztes Element.
    const s = speicher(idbOeffner(neuerName()));
    await s.merkeEreignis(e({ gewaehlt: 'erste', zeitpunkt: '2026-09-16T09:00:00.000Z' }));
    await s.merkeEreignis(e({ gewaehlt: 'zweite', zeitpunkt: '2026-09-16T08:00:00.000Z' }));
    await s.merkeEreignis(e({ gewaehlt: 'dritte', zeitpunkt: '2026-09-16T10:00:00.000Z' }));

    expect((await s.ereignisse()).map((ev) => ev.gewaehlt)).toEqual(['erste', 'zweite', 'dritte']);
    await s.schliessen();
  });

  it('überlebt einen Neustart der Verbindung', async () => {
    // Das Abnahmekriterium aus dem Plan: „die Ereignisse ueberleben einen
    // Neustart". Zweimal `speicher()` auf denselben Namen ist genau das.
    const name = neuerName();
    const erste = speicher(idbOeffner(name));
    await erste.merkeEreignis(e());
    await erste.schliessen();

    const zweite = speicher(idbOeffner(name));
    expect(await zweite.ereignisse()).toEqual([e()]);
    await zweite.schliessen();
  });

  it('schreibt eine Karte fort, statt eine zweite danebenzulegen', async () => {
    const s = speicher(idbOeffner(neuerName()));
    const erster = naechsterTermin(neueKarte(JETZT), 'eher', true, JETZT);
    const zweiter = naechsterTermin(erster.karte, 'sicher', true, erster.faellig);

    await s.merkeKarte('recall-vor-precision', 'rvp-1', erster);
    await s.merkeKarte('recall-vor-precision', 'rvp-1', zweiter);

    const stände = await s.karten();
    expect(stände).toHaveLength(1);
    expect(stände[0]?.karte.reps).toBe(zweiter.karte.reps);
    await s.schliessen();
  });

  it('hält Datum und Kartenzustand über die strukturierte Kopie hinweg', async () => {
    // IndexedDB legt keine JSON-Zeichenkette ab, sondern eine strukturierte
    // Kopie — `Date` kommt als `Date` zurueck. Diese Zusicherung traegt die
    // ganze Terminplanung; ginge sie verloren, waere `faellig` nach dem
    // Neuladen eine Zeichenkette und jeder Vergleich in `reife.ts` falsch.
    const s = speicher(idbOeffner(neuerName()));
    const termin = naechsterTermin(neueKarte(JETZT), 'eher', true, JETZT);
    await s.merkeKarte('recall-vor-precision', 'rvp-1', termin);

    const stand = (await s.karten())[0];
    expect(stand?.faellig).toBeInstanceOf(Date);
    expect(stand?.faellig.toISOString()).toBe(termin.faellig.toISOString());
    expect(stand?.karte.due).toBeInstanceOf(Date);
    await s.schliessen();
  });

  it('leitet faellig aus der Karte ab, statt es daneben zu speichern', async () => {
    // Eine Wahrheit, nicht zwei: `faellig` ist immer `karte.due`, und zwar als
    // Kopie — wer am Rueckgabewert dreht, verschiebt nicht die Karte.
    const s = speicher(idbOeffner(neuerName()));
    const termin = naechsterTermin(neueKarte(JETZT), 'eher', true, JETZT);
    await s.merkeKarte('recall-vor-precision', 'rvp-1', termin);

    const stand = (await s.karten())[0];
    expect(stand?.faellig.getTime()).toBe(stand?.karte.due.getTime());
    expect(stand?.faellig).not.toBe(stand?.karte.due);
    await s.schliessen();
  });

  it('findet eine einzelne Karte über Lektion und Frage', async () => {
    const s = speicher(idbOeffner(neuerName()));
    const termin = naechsterTermin(neueKarte(JETZT), 'eher', true, JETZT);
    await s.merkeKarte('recall-vor-precision', 'rvp-1', termin);

    expect((await s.karte('recall-vor-precision', 'rvp-1'))?.reps).toBe(termin.karte.reps);
    expect(await s.karte('recall-vor-precision', 'rvp-2')).toBeNull();
    await s.schliessen();
  });

  it('nimmt für Einstellungen auch etwas anderes als Text', async () => {
    // Heute der Modus hell/dunkel, spaeter einundzwanzig FSRS-Parameter.
    const s = speicher(idbOeffner(neuerName()));
    await s.merkeEinstellung('modus', 'dunkel');
    await s.merkeEinstellung('parameter', [0.4, 1.2, 3.17]);

    expect(await s.einstellung('modus')).toBe('dunkel');
    expect(await s.einstellung('parameter')).toEqual([0.4, 1.2, 3.17]);
    expect(await s.einstellung('gibtsnicht')).toBeUndefined();
    await s.schliessen();
  });
});

describe('alsJson', () => {
  it('gibt die gesamte Historie heraus', async () => {
    const s = speicher(idbOeffner(neuerName()));
    await s.merkeEreignis(e({ gewaehlt: 'erste' }));
    await s.merkeEreignis(e({ gewaehlt: 'zweite' }));
    await s.merkeKarte('recall-vor-precision', 'rvp-1', naechsterTermin(neueKarte(JETZT), 'eher', true, JETZT));
    await s.merkeEinstellung('modus', 'dunkel');

    const ausfuhr = JSON.parse(await s.alsJson(JETZT)) as Ausfuhr;
    expect(ausfuhr.fassung).toBe(FASSUNG);
    expect(ausfuhr.erzeugt).toBe(JETZT.toISOString());
    expect(ausfuhr.ereignisse.map((ev) => ev.gewaehlt)).toEqual(['erste', 'zweite']);
    expect(ausfuhr.karten).toHaveLength(1);
    expect(ausfuhr.einstellungen).toEqual({ modus: 'dunkel' });
    await s.schliessen();
  });

  it('macht aus dem Kartentermin eine lesbare Zeitangabe', async () => {
    // Der Auszug soll ohne diese App auswertbar sein — das ist der Zweck. Ein
    // `Date` wird dabei zur ISO-Zeichenkette, und das ist gewollt.
    const s = speicher(idbOeffner(neuerName()));
    const termin = naechsterTermin(neueKarte(JETZT), 'eher', true, JETZT);
    await s.merkeKarte('recall-vor-precision', 'rvp-1', termin);

    const text = await s.alsJson(JETZT);
    expect(text).toContain(termin.faellig.toISOString());
    await s.schliessen();
  });
});

/**
 * (a) Der Fall, der im Browser am schwersten herzustellen ist.
 *
 * Privates Fenster, geloeschte Websitedaten, abgeschalteter Speicher: In allen
 * dreien wirft schon das Oeffnen. Aufgesetzt wird das ueber die Naht — ein
 * `Oeffner`, der wirft — und nicht durch Umbiegen globaler Objekte. Das ist
 * deterministisch, braucht keine Aufraeumarbeit und laesst den Rest der
 * Testdatei am echten IndexedDB messen.
 */
describe('wenn das Öffnen wirft', () => {
  const wirftAsynchron: Oeffner = async () => {
    throw new DOMException('A mutation operation was attempted on a database that did not allow mutations.', 'SecurityError');
  };

  /**
   * Der Wurf VOR dem ersten Promise — kein erfundener Fall.
   *
   * `openDB` ruft `indexedDB.open` in seiner ersten Zeile auf. Fehlt das
   * globale `indexedDB` — das ist der jsdom-Zustand ohne `fake-indexeddb` —,
   * wirft es synchron, und ein `.catch()` an der Zusage kaeme zu spaet.
   */
  const wirftSynchron = (() => {
    throw new TypeError("Cannot read properties of undefined (reading 'open')");
  }) as unknown as Oeffner;

  for (const [wie, oeffnen] of [
    ['asynchron', wirftAsynchron],
    ['synchron', wirftSynchron],
  ] as const) {
    it(`liefert brauchbare leere Werte statt zu werfen (${wie})`, async () => {
      const s = speicher(oeffnen);

      await expect(s.ereignisse()).resolves.toEqual([]);
      await expect(s.karten()).resolves.toEqual([]);
      await expect(s.karte('recall-vor-precision', 'rvp-1')).resolves.toBeNull();
      await expect(s.einstellung('modus')).resolves.toBeUndefined();
      await expect(s.schliessen()).resolves.toBeUndefined();
    });

    it(`gibt bei jedem Schreibversuch false zurück (${wie})`, async () => {
      const s = speicher(oeffnen);

      await expect(s.merkeEreignis(e())).resolves.toBe(false);
      await expect(
        s.merkeKarte('recall-vor-precision', 'rvp-1', naechsterTermin(neueKarte(JETZT), 'eher', true, JETZT)),
      ).resolves.toBe(false);
      await expect(s.merkeEinstellung('modus', 'dunkel')).resolves.toBe(false);
    });
  }

  it('liefert einen gültigen, leeren Auszug statt einer kaputten Datei', async () => {
    // Der Ausfuhrknopf auf der Landkarte darf nicht davon abhaengen, dass der
    // Speicher geht. Eine leere, gueltige Datei ist ein Ergebnis; ein Wurf
    // mitten im Herunterladen ist ein Absturz.
    const ausfuhr = JSON.parse(await speicher(wirftAsynchron).alsJson(JETZT)) as Ausfuhr;
    expect(ausfuhr).toEqual({
      fassung: FASSUNG,
      erzeugt: JETZT.toISOString(),
      ereignisse: [],
      karten: [],
      einstellungen: {},
    });
  });

  it('meldet den Fehlschlag, statt ihn zu verschlucken', async () => {
    await speicher(wirftAsynchron).ereignisse();
    expect(warnungen).toHaveBeenCalledWith(expect.stringContaining('Oeffnen'), expect.anything());
  });

  it('versucht das Öffnen genau einmal', async () => {
    // Ohne das Merken haette jede einzelne Antwort einer Sitzung im privaten
    // Fenster eine eigene Warnung hinterlassen — und einen eigenen Versuch,
    // eine Datenbank zu oeffnen, die es nicht gibt.
    let versuche = 0;
    const s = speicher(async () => {
      versuche++;
      throw new Error('kein Speicher');
    });

    await s.ereignisse();
    await s.karten();
    await s.merkeEreignis(e());
    await s.alsJson(JETZT);

    expect(versuche).toBe(1);
    expect(warnungen).toHaveBeenCalledTimes(1);
  });
});

/**
 * (a) Der zweite Fehlerfall: Die Verbindung steht, der Zugriff scheitert.
 *
 * Hergestellt an einer echten Datenbank, deren Verbindung geschlossen wird —
 * genau das, was passiert, wenn der Browser die Verbindung kappt oder jemand
 * waehrend der Sitzung die Websitedaten loescht. Keine Attrappe: Der Wurf
 * kommt aus IndexedDB selbst.
 */
describe('wenn die Verbindung mitten im Betrieb wegbricht', () => {
  async function abgerissen(): Promise<ReturnType<typeof speicher>> {
    const echt = idbOeffner(neuerName());
    let offen: Awaited<ReturnType<Oeffner>> | null = null;
    const s = speicher(async () => {
      offen = await echt();
      return offen;
    });

    await s.merkeEreignis(e());
    // Ab hier ist die Verbindung tot, der Speicher weiss es aber noch nicht.
    (offen as unknown as IDBPDatabase | null)?.close();
    return s;
  }

  it('gibt false zurück, statt den Schreibversuch werfen zu lassen', async () => {
    const s = await abgerissen();
    await expect(s.merkeEreignis(e({ gewaehlt: 'zweite' }))).resolves.toBe(false);
    expect(warnungen).toHaveBeenCalledWith(
      expect.stringContaining('merkeEreignis'),
      expect.anything(),
    );
  });

  it('liefert beim Lesen leere Werte, statt die Seite abstürzen zu lassen', async () => {
    const s = await abgerissen();
    await expect(s.ereignisse()).resolves.toEqual([]);
    await expect(s.karten()).resolves.toEqual([]);
  });

  it('gibt auch dann noch einen gültigen Auszug heraus', async () => {
    const s = await abgerissen();
    const ausfuhr = JSON.parse(await s.alsJson(JETZT)) as Ausfuhr;
    expect(ausfuhr.ereignisse).toEqual([]);
    expect(ausfuhr.fassung).toBe(FASSUNG);
  });
});

/**
 * (b) Die Probe, die sonst niemand macht.
 *
 * Ein Speicher, der nur die heutige Fassung kennt, faellt erst in einem halben
 * Jahr auf — beim ersten Feldwechsel, und dann mit dem Lernstand der Nutzer.
 * Deshalb wird hier eine zweite Fassung erfunden und der Aufstieg gefahren.
 */
describe('Schemafortschreibung', () => {
  /**
   * Eine Fassung 2, die es heute noch nicht gibt.
   *
   * Der Umweg ueber den untypisierten Griff ist Absicht und kein Trick: Die
   * Typen der heutigen Fassung koennen einen Speicher der naechsten nicht
   * kennen. Genau das ist die Lage, in der die Leiter in einem halben Jahr
   * benutzt wird.
   */
  const ZWEITE_FASSUNG: readonly Schritt[] = [
    ...SCHRITTE,
    (datenbank) => {
      (datenbank as unknown as IDBPDatabase).createObjectStore('notizen');
    },
  ];

  it('hebt Daten aus Fassung 1 über den Aufstieg auf Fassung 2 hinüber', async () => {
    const name = neuerName();

    const eins = speicher(idbOeffner(name, SCHRITTE));
    await eins.merkeEreignis(e({ gewaehlt: 'vor dem Aufstieg' }));
    await eins.merkeKarte('recall-vor-precision', 'rvp-1', naechsterTermin(neueKarte(JETZT), 'eher', true, JETZT));
    await eins.merkeEinstellung('modus', 'dunkel');
    await eins.schliessen();

    const zwei = speicher(idbOeffner(name, ZWEITE_FASSUNG));
    // Dass hier ueberhaupt etwas ankommt, beweist zweierlei: Der Bestand steht
    // noch, UND der erste Schritt wurde nicht erneut gefahren — ein zweites
    // `createObjectStore('ereignisse')` haette den Aufstieg mit einem
    // ConstraintError abgebrochen und die Liste leer gelassen.
    expect((await zwei.ereignisse()).map((ev) => ev.gewaehlt)).toEqual(['vor dem Aufstieg']);
    expect(await zwei.karten()).toHaveLength(1);
    expect(await zwei.einstellung('modus')).toBe('dunkel');
    await zwei.schliessen();
  });

  it('legt beim Aufstieg wirklich die neue Fassung an', async () => {
    const name = neuerName();
    const eins = speicher(idbOeffner(name, SCHRITTE));
    await eins.merkeEreignis(e());
    await eins.schliessen();

    let offen: Awaited<ReturnType<Oeffner>> | null = null;
    const echt = idbOeffner(name, ZWEITE_FASSUNG);
    const zwei = speicher(async () => {
      offen = await echt();
      return offen;
    });
    await zwei.ereignisse();

    const griff = offen as unknown as IDBPDatabase | null;
    expect(griff?.version).toBe(2);
    expect([...(griff?.objectStoreNames ?? [])]).toContain('notizen');
    await zwei.schliessen();
  });

  it('läuft bei einer frischen Datenbank alle Schritte auf einmal', async () => {
    // Wer die App erst in einem halben Jahr zum ersten Mal oeffnet, steigt von
    // 0 auf 2 in einem Zug. Das muss dieselben Speicher ergeben wie der Weg
    // ueber Fassung 1.
    let offen: Awaited<ReturnType<Oeffner>> | null = null;
    const echt = idbOeffner(neuerName(), ZWEITE_FASSUNG);
    const s = speicher(async () => {
      offen = await echt();
      return offen;
    });
    expect(await s.merkeEreignis(e())).toBe(true);

    const namen = [...((offen as unknown as IDBPDatabase | null)?.objectStoreNames ?? [])];
    expect(namen.sort()).toEqual(['einstellungen', 'ereignisse', 'karten', 'notizen']);
    await s.schliessen();
  });

  it('verwirft einen unlesbaren Kartensatz, statt alle Karten fallen zu lassen', async () => {
    // Der Fall, den eine kuenftige Fassung erzeugen kann: ein Satz, dessen
    // Termin nicht mehr das ist, wofuer diese Fassung ihn haelt. Der
    // Unterschied zwischen „eine Karte fehlt" und „keine Karte da" ist der
    // Unterschied zwischen einem Schoenheitsfehler und einem
    // zurueckgesetzten Lernstand.
    const name = neuerName();
    let offen: Awaited<ReturnType<Oeffner>> | null = null;
    const echt = idbOeffner(name);
    const s = speicher(async () => {
      offen = await echt();
      return offen;
    });
    await s.merkeKarte('recall-vor-precision', 'rvp-1', naechsterTermin(neueKarte(JETZT), 'eher', true, JETZT));

    const griff = offen as unknown as IDBPDatabase | null;
    await griff?.put('karten', {
      lektion: 'recall-vor-precision',
      frage: 'rvp-2',
      karte: { due: '2026-09-18T10:00:00.000Z' },
    });

    const stände = await s.karten();
    expect(stände.map((k) => k.frage)).toEqual(['rvp-1']);
    expect(warnungen).toHaveBeenCalledWith(expect.stringContaining('karten'), expect.anything());
    await s.schliessen();
  });
});

/**
 * (c) Die Groesse, als Wachposten.
 *
 * Gemessen an den echten Texten dieser App: 218 Byte je Ereignis als JSON,
 * 204 Byte in der strukturierten Kopie, mit Schluessel und Satzkopf rund 255.
 * Das sind 100 kB fuer die 400 Bewertungen, ab denen eigene FSRS-Parameter
 * tragen, und 2,5 MB fuer 10 000. Der Test haelt die Groessenordnung fest:
 * Wer `Ereignis` um den Fragetext oder die Begruendung erweitert, verzehnfacht
 * sie — und soll das hier merken und nicht in zwei Jahren.
 */
describe('Größe eines Ereignisses', () => {
  const JE_EREIGNIS_HOECHSTENS = 400;

  it('bleibt auch im längsten Fall unter der Schranke', () => {
    const laengste = e({
      lektion: 'kontrollfluss-folgt-modellstaerke',
      frage: 'kfm-transfer',
      gewaehlt:
        'Weil Precision-Maßnahmen auf der Kandidatenmenge aufsetzen und deren Obergrenze nicht überschreiten können',
    });
    const bytes = new TextEncoder().encode(JSON.stringify(laengste)).length;

    expect(bytes).toBeLessThan(JE_EREIGNIS_HOECHSTENS);
  });

  it('hält 10 000 Bewertungen unter vier Megabyte', () => {
    // Zum Vergleich: Chrome raeumt einem Ursprung rund sechzig Prozent des
    // freien Plattenplatzes ein. 10 000 Bewertungen sind bei zwanzig Antworten
    // am Tag die Ernte von anderthalb Jahren. Es wird nicht eng.
    expect(10_000 * JE_EREIGNIS_HOECHSTENS).toBeLessThan(4 * 1024 * 1024);
  });
});
