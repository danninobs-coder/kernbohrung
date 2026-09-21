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
  hebeAufV2,
  idbOeffner,
  speicher,
  SCHRITTE,
  type Ausfuhr,
  type Oeffner,
  type Schritt,
} from '../src/tutor/speicher';
import { naechsterTermin, neueKarte } from '../src/tutor/planung';
import type { Ereignis } from '../src/tutor/typen';
import { AUFGABENTYPEN, type AufgabenTyp } from '../src/aufgaben/schema';

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
    typ: 'wahl',
    zuversicht: 'sicher',
    richtig: true,
    anteil: 1,
    antwort: 'Der Recall der Kandidatenmenge',
    merkmal: '',
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
    await s.merkeEreignis(e({ antwort: 'erste', zeitpunkt: '2026-09-16T09:00:00.000Z' }));
    await s.merkeEreignis(e({ antwort: 'zweite', zeitpunkt: '2026-09-16T08:00:00.000Z' }));
    await s.merkeEreignis(e({ antwort: 'dritte', zeitpunkt: '2026-09-16T10:00:00.000Z' }));

    expect((await s.ereignisse()).map((ev) => ev.antwort)).toEqual(['erste', 'zweite', 'dritte']);
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
    await s.merkeEreignis(e({ antwort: 'erste' }));
    await s.merkeEreignis(e({ antwort: 'zweite' }));
    await s.merkeKarte('recall-vor-precision', 'rvp-1', naechsterTermin(neueKarte(JETZT), 'eher', true, JETZT));
    await s.merkeEinstellung('modus', 'dunkel');

    const ausfuhr = JSON.parse(await s.alsJson(JETZT)) as Ausfuhr;
    expect(ausfuhr.fassung).toBe(FASSUNG);
    expect(ausfuhr.erzeugt).toBe(JETZT.toISOString());
    expect(ausfuhr.ereignisse.map((ev) => ev.antwort)).toEqual(['erste', 'zweite']);
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
    await expect(s.merkeEreignis(e({ antwort: 'zweite' }))).resolves.toBe(false);
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
   * Eine nächste Fassung, die es heute noch nicht gibt.
   *
   * Der Umweg ueber den untypisierten Griff ist Absicht und kein Trick: Die
   * Typen der heutigen Fassung koennen einen Speicher der naechsten nicht
   * kennen. Genau das ist die Lage, in der die Leiter in einem halben Jahr
   * benutzt wird.
   */
  const NAECHSTE_FASSUNG: readonly Schritt[] = [
    ...SCHRITTE,
    (datenbank) => {
      (datenbank as unknown as IDBPDatabase).createObjectStore('notizen');
    },
  ];

  it('hebt Daten über den Aufstieg auf die nächste Fassung hinüber', async () => {
    const name = neuerName();

    const eins = speicher(idbOeffner(name, SCHRITTE));
    await eins.merkeEreignis(e({ antwort: 'vor dem Aufstieg' }));
    await eins.merkeKarte('recall-vor-precision', 'rvp-1', naechsterTermin(neueKarte(JETZT), 'eher', true, JETZT));
    await eins.merkeEinstellung('modus', 'dunkel');
    await eins.schliessen();

    const zwei = speicher(idbOeffner(name, NAECHSTE_FASSUNG));
    // Dass hier ueberhaupt etwas ankommt, beweist zweierlei: Der Bestand steht
    // noch, UND der erste Schritt wurde nicht erneut gefahren — ein zweites
    // `createObjectStore('ereignisse')` haette den Aufstieg mit einem
    // ConstraintError abgebrochen und die Liste leer gelassen.
    expect((await zwei.ereignisse()).map((ev) => ev.antwort)).toEqual(['vor dem Aufstieg']);
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
    const echt = idbOeffner(name, NAECHSTE_FASSUNG);
    const zwei = speicher(async () => {
      offen = await echt();
      return offen;
    });
    await zwei.ereignisse();

    const griff = offen as unknown as IDBPDatabase | null;
    expect(griff?.version).toBe(SCHRITTE.length + 1);
    expect([...(griff?.objectStoreNames ?? [])]).toContain('notizen');
    await zwei.schliessen();
  });

  it('läuft bei einer frischen Datenbank alle Schritte auf einmal', async () => {
    // Wer die App erst in einem halben Jahr zum ersten Mal oeffnet, steigt von
    // 0 auf die neueste Fassung in einem Zug. Das muss dieselben Speicher
    // ergeben wie der Weg ueber Fassung 1.
    let offen: Awaited<ReturnType<Oeffner>> | null = null;
    const echt = idbOeffner(neuerName(), NAECHSTE_FASSUNG);
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
 * (c) Die Groesse, als Wachposten — je Typ.
 *
 * `antwort` haelt fest, was jemand getan hat, und das ist je Typ verschieden
 * viel: ein Antworttext, eine Ziffernfolge, alle Paare, ein geschriebener
 * Text. Eine gemeinsame Schranke waere entweder fuer `wahl` wertlos oder fuer
 * `fall` falsch. Der Test haelt die Groessenordnung je Typ fest: Wer `Ereignis`
 * um den Aufgabentext oder die Begruendung erweitert, vervielfacht sie — und
 * soll das hier merken und nicht in zwei Jahren.
 */
describe('Größe eines Ereignisses', () => {
  const HOECHSTENS: Record<AufgabenTyp, number> = {
    wahl: 600,
    reihenfolge: 400,
    zuordnen: 1600,
    fall: 6500,
  };

  const langerText =
    'Weil Precision-Maßnahmen auf der Kandidatenmenge aufsetzen und deren Obergrenze nicht überschreiten können';
  const sechsPaare = Array.from(
    { length: 6 },
    (_, i) => `Selbstkostenerstattungsvertrag Nummer ${i}→Nachgewiesene Kosten des Auftragnehmers samt Zuschlag ${i}`,
  ).join(';');
  const lang = { lektion: 'kontrollfluss-folgt-modellstaerke', frage: 'kfm-transfer', richtig: false, anteil: 0 };

  const laengste: Record<AufgabenTyp, Ereignis> = {
    wahl: e({ ...lang, typ: 'wahl', antwort: langerText, merkmal: langerText }),
    reihenfolge: e({ ...lang, typ: 'reihenfolge', antwort: '1,3,2,4,5,7,6', merkmal: '1,3,2,4,5,7,6' }),
    zuordnen: e({ ...lang, typ: 'zuordnen', antwort: sechsPaare, merkmal: sechsPaare }),
    // Zweitausend Eurozeichen: die Hoechstlaenge des Textfelds, im teuersten
    // Zeichen. `maxLength` zaehlt UTF-16-Einheiten, nicht Byte. Ein Zeichen
    // aus der Basic Multilingual Plane ausserhalb der ersten 2048 Codepunkte
    // (etwa '€') braucht in UTF-8 drei Byte je Einheit — mehr als 'ä' (zwei
    // Byte je Einheit) und mehr als ein Zeichen jenseits der BMP (vier Byte
    // auf zwei UTF-16-Einheiten, also nur zwei Byte je Einheit). Drei Byte je
    // Einheit ist damit das teuerste Verhaeltnis, das eine einzelne
    // UTF-16-Einheit erreichen kann.
    fall: e({ ...lang, typ: 'fall', antwort: '€'.repeat(2000), merkmal: 'fehlt:1,2,3,4,5,6,7,8' }),
  };

  it.each(AUFGABENTYPEN)('bleibt beim Typ %s auch im längsten Fall unter der Schranke', (typ) => {
    const bytes = new TextEncoder().encode(JSON.stringify(laengste[typ])).length;
    expect(bytes).toBeLessThan(HOECHSTENS[typ]);
    // Die Schranke braucht selbst einen Waechter nach unten: Ohne diese Zeile
    // faengt keine Mutation eine grosszuegig angehobene HOECHSTENS ab — der
    // Test oben wird dann einfach mit angehoben und bleibt gruen. Ist-Werte
    // (gemessen): wahl 430, reihenfolge 245, zuordnen 1390, fall 6233 Byte —
    // alle liegen ueber der halben Schranke.
    expect(bytes).toBeGreaterThan(HOECHSTENS[typ] / 2);
  });

  // Die Schranke selbst braucht einen Waechter gegen Aufweichung: Wer sie
  // grosszuegig anhebt, damit der Test oben wieder gruen wird, sprengt hier
  // das Budget.
  const BUDGET_MB: Record<AufgabenTyp, number> = { wahl: 8, reihenfolge: 8, zuordnen: 20, fall: 80 };

  it.each(AUFGABENTYPEN)('hält 10 000 Ereignisse vom Typ %s im Budget', (typ) => {
    expect(10_000 * HOECHSTENS[typ]).toBeLessThan(BUDGET_MB[typ] * 1024 * 1024);
  });
});

/**
 * Der echte Aufstieg, nicht der erfundene.
 *
 * Die Beschreibung oben faehrt die Leiter mit einer Fassung, die es nicht
 * gibt. Hier laeuft der Schritt, der wirklich ausgeliefert wird: Ein Bestand,
 * der mit `gewaehlt` geschrieben wurde, muss vollstaendig in der neuen Form
 * ankommen — sonst steht in einem halben Jahr eine Landkarte da, die die
 * ersten Wochen nicht kennt.
 */
describe('Aufstieg auf Fassung 2: Ereignisse bekommen den Aufgabentyp', () => {
  const NUR_FASSUNG_1 = SCHRITTE.slice(0, 1);

  const alterTreffer = {
    lektion: 'rvp',
    frage: 'rvp-2',
    zuversicht: 'eher',
    richtig: true,
    gewaehlt: 'Die Kandidatenmenge',
    dauerMs: 700,
    zeitpunkt: '2026-09-16T09:01:00.000Z',
  };
  const alterFehlgriff = {
    lektion: 'rvp',
    frage: 'rvp-1',
    zuversicht: 'sicher',
    richtig: false,
    gewaehlt: 'Ein Reranker dahinter',
    dauerMs: 900,
    zeitpunkt: '2026-09-16T09:00:00.000Z',
  };

  it('hebt einen Bestand aus Fassung 1 vollstaendig in die neue Form', async () => {
    const name = neuerName();
    // Von Hand und untypisiert: Der heutige Typ kennt `gewaehlt` nicht mehr,
    // der alte Bestand auf fremden Festplatten schon.
    const alt = await idbOeffner(name, NUR_FASSUNG_1)();
    const roh = alt as unknown as IDBPDatabase;
    await roh.add('ereignisse', alterFehlgriff);
    await roh.add('ereignisse', alterTreffer);
    alt.close();

    const neu = speicher(idbOeffner(name, SCHRITTE));
    expect(await neu.ereignisse()).toEqual([
      {
        lektion: 'rvp',
        frage: 'rvp-1',
        typ: 'wahl',
        zuversicht: 'sicher',
        richtig: false,
        anteil: 0,
        antwort: 'Ein Reranker dahinter',
        merkmal: 'Ein Reranker dahinter',
        dauerMs: 900,
        zeitpunkt: '2026-09-16T09:00:00.000Z',
      },
      {
        lektion: 'rvp',
        frage: 'rvp-2',
        typ: 'wahl',
        zuversicht: 'eher',
        richtig: true,
        anteil: 1,
        antwort: 'Die Kandidatenmenge',
        merkmal: '',
        dauerMs: 700,
        zeitpunkt: '2026-09-16T09:01:00.000Z',
      },
    ]);
    await neu.schliessen();
  });

  it('laesst Karten und Einstellungen beim Aufstieg stehen', async () => {
    const name = neuerName();
    const alt = await idbOeffner(name, NUR_FASSUNG_1)();
    const roh = alt as unknown as IDBPDatabase;
    const termin = naechsterTermin(neueKarte(JETZT), 'eher', true, JETZT);
    await roh.put('karten', { lektion: 'rvp', frage: 'rvp-1', karte: termin.karte });
    await roh.put('einstellungen', 'dunkel', 'modus');
    alt.close();

    const neu = speicher(idbOeffner(name, SCHRITTE));
    expect(await neu.karten()).toHaveLength(1);
    expect(await neu.einstellung('modus')).toBe('dunkel');
    await neu.schliessen();
  });

  it('ist wiederholbar: ein schon gehobener Satz bleibt, wie er ist', () => {
    const schonNeu = e();
    expect(hebeAufV2(schonNeu)).toBe(schonNeu);
  });

  /**
   * Nachtrag: die Wiederholbarkeit am echten Speicher, nicht nur an der
   * reinen Funktion.
   *
   * Der Test oben ("ist wiederholbar") prueft `hebeAufV2` isoliert. Er sagt
   * nichts darueber, ob ein zweites Oeffnen mit `SCHRITTE` am echten Speicher
   * etwas doppelt heben oder verlieren kann. Deshalb hier zweimal hintereinander
   * mit derselben Fassungsliste geoeffnet: Die zweite Lesung muss Wort fuer
   * Wort der ersten entsprechen, und es darf immer noch genau ein Ereignis sein.
   */
  it('ist wiederholbar am echten Speicher: ein zweites Öffnen mit SCHRITTE hebt nichts doppelt', async () => {
    const name = neuerName();
    const alt = await idbOeffner(name, NUR_FASSUNG_1)();
    const roh = alt as unknown as IDBPDatabase;
    await roh.add('ereignisse', alterTreffer);
    alt.close();

    const ersterZugriff = speicher(idbOeffner(name, SCHRITTE));
    const ersteLesung = await ersterZugriff.ereignisse();
    await ersterZugriff.schliessen();

    const zweiterZugriff = speicher(idbOeffner(name, SCHRITTE));
    const zweiteLesung = await zweiterZugriff.ereignisse();
    await zweiterZugriff.schliessen();

    expect(zweiteLesung).toHaveLength(1);
    expect(zweiteLesung).toEqual(ersteLesung);
  });
});

/**
 * Nachtrag: der Abbruchpfad.
 *
 * Der Kommentar im Schritt behauptet: Scheitert der Aufstieg, wird die
 * Umbau-Transaktion abgebrochen, „mit unveraendertem Bestand". Ausgeloest wird
 * das hier ueber einen Satz, an dem `hebeAufV2` selbst wirft — eine blanke
 * Zeichenkette hat kein `typ`-Feld, und `'typ' in <string>` wirft einen
 * TypeError, bevor irgendetwas geschrieben wird. Der `ereignisse`-Speicher
 * erlaubt das: `SCHRITTE[0]` legt ihn ohne `keyPath` an, mit `autoIncrement`
 * als einziger Schluesselquelle — jeder strukturiert kopierbare Wert geht
 * hinein, nicht nur Objekte, die wie ein `Ereignis` aussehen.
 */
describe('Aufstieg auf Fassung 2: Abbruchpfad', () => {
  const NUR_FASSUNG_1 = SCHRITTE.slice(0, 1);

  it('bricht den Umbau ab und laesst Fassung 1 unveraendert, wenn ein Satz beim Aufstieg wirft', async () => {
    const name = neuerName();
    const alt = await idbOeffner(name, NUR_FASSUNG_1)();
    const roh = alt as unknown as IDBPDatabase;
    await roh.add('ereignisse', 'ein Satz ohne Form');
    alt.close();

    // Das Oeffnen scheitert: Die Umbau-Transaktion wird abgebrochen, sobald
    // der Cursor auf den kaputten Satz trifft, und `openDB` loest dann ab statt
    // auf. Der Speicher faengt das — siehe `verbinde()` in speicher.ts — und
    // laeuft im speicherlosen Notbetrieb weiter.
    const kaputt = speicher(idbOeffner(name, SCHRITTE));
    expect(await kaputt.ereignisse()).toEqual([]);
    await kaputt.schliessen();

    // Ein anschliessendes Oeffnen mit NUR Fassung 1 beweist, dass der Abbruch
    // wirklich nichts hinterlassen hat: Der Bestand steht noch bei Fassung 1,
    // der alte Satz unveraendert.
    const geprueft = await idbOeffner(name, NUR_FASSUNG_1)();
    const rohGeprueft = geprueft as unknown as IDBPDatabase;
    expect(await rohGeprueft.getAll('ereignisse')).toEqual(['ein Satz ohne Form']);
    geprueft.close();
  });
});

/**
 * Der Sicherheitsgurt beim Lesen.
 *
 * Nach Spezifikation ist eine Versionchange-Transaktion atomar: Entweder
 * laufen alle Cursor-Updates aus Schritt 2 durch, oder keins — ein Bestand aus
 * halb gehobenen und halb alten Saetzen ist demnach unerreichbar. Dieser Test
 * schreibt trotzdem von Hand einen Satz in alter Form direkt in eine
 * Datenbank, die schon bei Fassung 2 steht — der Fall, den ein Browser
 * erzeugt, der sich nicht an die Spezifikation haelt, oder eine kuenftige
 * Fassung, die einen Satz beim Aufstieg uebersieht. `ereignisse()` schickt
 * jeden gelesenen Satz durch `hebeAufV2`: Der Gurt kostet eine Zeile, und es
 * geht um Lerndaten.
 */
describe('ereignisse() hebt auch dann, wenn ein Satz die Migration umgangen hat', () => {
  it('gibt einen von Hand nachtraeglich eingelegten Satz in alter Form gehoben zurueck', async () => {
    const name = neuerName();
    // Die Datenbank steht schon bei Fassung 2 — der Aufstieg ist gelaufen und
    // hatte nichts zu heben. Erst DANACH landet der alte Satz im Speicher.
    const alt = await idbOeffner(name, SCHRITTE)();
    const roh = alt as unknown as IDBPDatabase;
    await roh.add('ereignisse', {
      lektion: 'rvp',
      frage: 'rvp-1',
      zuversicht: 'sicher',
      richtig: false,
      gewaehlt: 'Ein Reranker dahinter',
      dauerMs: 900,
      zeitpunkt: '2026-09-16T09:00:00.000Z',
    });
    alt.close();

    const s = speicher(idbOeffner(name, SCHRITTE));
    const gelesen = await s.ereignisse();
    expect(gelesen).toEqual([
      {
        lektion: 'rvp',
        frage: 'rvp-1',
        typ: 'wahl',
        zuversicht: 'sicher',
        richtig: false,
        anteil: 0,
        antwort: 'Ein Reranker dahinter',
        merkmal: 'Ein Reranker dahinter',
        dauerMs: 900,
        zeitpunkt: '2026-09-16T09:00:00.000Z',
      },
    ]);
    expect(gelesen[0] && 'gewaehlt' in gelesen[0]).toBe(false);
    await s.schliessen();
  });
});
