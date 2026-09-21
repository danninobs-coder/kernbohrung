import { describe, it, expect } from 'vitest';
import {
  auswahl,
  FEHLVORSTELLUNG_AB,
  NEUE_PRINZIPIEN_JE_SITZUNG,
  type Kandidat,
} from '../src/tutor/auswahl';
import type { Ereignis, Zuversicht } from '../src/tutor/typen';

/**
 * Die Tutor-Auswahl, nicht die des Compilers.
 *
 * `tests/auswahl.test.ts` war beim Schreiben dieser Datei bereits belegt: Sie
 * prueft `werkzeug/auswahl.mjs`, also welche QUELLDATEI in eine Lektion
 * eingeht. Hier geht es um die andere Auswahl — welche FRAGE als naechste
 * kommt. Gleicher Name, verschiedene Sache; der Zusatz im Dateinamen haelt
 * beide auseinander, ohne den bestehenden Test anzufassen.
 */

const JETZT = new Date('2026-09-16T10:00:00Z');
const TAG = 86400000;

function tage(n: number): Date {
  return new Date(JETZT.getTime() + n * TAG);
}

function e(
  lektion: string,
  frage: string,
  zuversicht: Zuversicht,
  richtig: boolean,
  merkmal = 'x',
): Ereignis {
  return {
    lektion,
    frage,
    zuversicht,
    richtig,
    typ: 'wahl',
    anteil: richtig ? 1 : 0,
    antwort: merkmal,
    merkmal: richtig ? '' : merkmal,
    dauerMs: 1000,
    zeitpunkt: '2026-09-16T09:00:00Z',
  };
}

/** Eine Frage, die nie beantwortet wurde. */
function neu(lektion: string, frage: string): Kandidat {
  return { lektion, frage, faellig: null, ereignisse: [] };
}

/** Eine Frage mit Verlauf. Zuversicht und Richtigkeit je Antwort als Paare. */
function gelernt(
  lektion: string,
  frage: string,
  faellig: Date,
  antworten: readonly (readonly [Zuversicht, boolean, string?])[],
): Kandidat {
  return {
    lektion,
    frage,
    faellig,
    ereignisse: antworten.map(([z, r, g]) => e(lektion, frage, z, r, g)),
  };
}

/** Kurzform fuer die Zusicherungen: nur die Fragekennungen in Reihenfolge. */
function reihenfolge(kandidaten: readonly Kandidat[], jetzt = JETZT): string[] {
  return auswahl(kandidaten, jetzt).fragen.map((v) => v.frage);
}

describe('auswahl — die vier Stufen', () => {
  it('nennt jede Frage mit dem Grund, aus dem sie drankommt', () => {
    const s = auswahl([neu('kbib', 'kbib-1')], JETZT);
    expect(s.fragen).toEqual([
      { lektion: 'kbib', frage: 'kbib-1', grund: 'neu', reife: 'unberuehrt' },
    ]);
  });

  it('haelt die volle Rangfolge ein: Fehlvorstellung, ueberfaellig, wackelt, neu', () => {
    const kandidaten = [
      // Absichtlich in umgekehrter Reihenfolge eingereicht: Die Auswahl darf
      // nicht die Eingabereihenfolge durchreichen.
      neu('ang', 'ang-1'),
      gelernt('kfm', 'kfm-1', tage(4), [
        ['eher', true],
        ['eher', false],
      ]),
      gelernt('kbib', 'kbib-1', tage(-2), [
        ['eher', true],
        ['eher', true],
      ]),
      gelernt('rvp', 'rvp-1', tage(20), [
        ['sicher', false, 'Reranker dahinter'],
        ['sicher', false, 'Reranker dahinter'],
      ]),
    ];
    const s = auswahl(kandidaten, JETZT);
    expect(s.fragen.map((v) => [v.frage, v.grund])).toEqual([
      ['rvp-1', 'fehlvorstellung'],
      ['kbib-1', 'ueberfaellig'],
      ['kfm-1', 'wackelt'],
      ['ang-1', 'neu'],
    ]);
  });
});

/**
 * Mutationsprobe an der Rangfolge.
 *
 * Jede Zusicherung hier ist so gebaut, dass sie GENAU EINE Vertauschung
 * faellt und sonst nichts: Die hoeher stehende Frage traegt jeweils kein
 * Merkmal der niedrigeren Stufe. Ohne diese Trennung faengt die Suite eine
 * vertauschte Rangfolge nicht — eine Fehlvorstellung ist in der Praxis
 * meistens auch ueberfaellig, und dann ordnet die zweite Stufe sie ohnehin
 * nach vorn.
 *
 * Gemessen, nicht vermutet: Drei Vertauschungen in `RANGFOLGE`
 * (Fehlvorstellung gegen Ueberfaelliges, Ueberfaelliges gegen Wackelndes,
 * Neues nach vorn) wurden je einmal eingebaut und die Suite darauf
 * losgelassen. Mit diesem Block faellt jede der drei. OHNE ihn rutschen ZWEI
 * davon durch: „Ueberfaelliges gegen Wackelndes" und „Neues nach vorn" liefen
 * vollstaendig gruen. Nur die erste faellt zufaellig auf — ueber den Test
 * „nimmt jede Frage hoechstens einmal auf", der den GRUND mitprueft und dabei
 * ungewollt die Rangfolge beruehrt.
 */
describe('auswahl — die Rangfolge einzeln festgenagelt', () => {
  it('stellt die Fehlvorstellung vor das Ueberfaellige, obwohl ihr Termin in der Zukunft liegt', () => {
    const fehlvorstellung = gelernt('rvp', 'rvp-1', tage(20), [
      ['sicher', false, 'Reranker dahinter'],
      ['sicher', false, 'Reranker dahinter'],
    ]);
    const ueberfaellig = gelernt('kbib', 'kbib-1', tage(-30), [
      ['eher', true],
      ['eher', true],
    ]);
    expect(reihenfolge([ueberfaellig, fehlvorstellung])).toEqual(['rvp-1', 'kbib-1']);
  });

  it('stellt das Ueberfaellige vor das Wackelnde, obwohl das Wackelnde juenger ist', () => {
    const ueberfaellig = gelernt('kbib', 'kbib-1', tage(-1), [
      ['eher', true],
      ['eher', true],
    ]);
    const wackelt = gelernt('kfm', 'kfm-1', tage(4), [
      ['eher', true],
      ['eher', false],
    ]);
    expect(reihenfolge([wackelt, ueberfaellig])).toEqual(['kbib-1', 'kfm-1']);
  });

  it('stellt Neues hinter alles andere, auch hinter die schwaechste Wiederholung', () => {
    // Drei einzelne Proben, damit „Neues nach vorn" gegen jede der drei
    // anderen Stufen faellt und nicht nur gegen die erste.
    const wackelt = gelernt('kfm', 'kfm-1', tage(4), [
      ['eher', true],
      ['eher', false],
    ]);
    const ueberfaellig = gelernt('kbib', 'kbib-1', tage(-1), [
      ['eher', true],
      ['eher', true],
    ]);
    const fehlvorstellung = gelernt('rvp', 'rvp-1', tage(20), [
      ['sicher', false, 'a'],
      ['sicher', false, 'a'],
    ]);
    for (const alt of [wackelt, ueberfaellig, fehlvorstellung]) {
      expect(reihenfolge([neu('ang', 'ang-1'), alt])).toEqual([alt.frage, 'ang-1']);
    }
  });

  it('ordnet mehrere Ueberfaellige nach Ueberfaelligkeit absteigend', () => {
    const jung = gelernt('a', 'a-1', tage(-1), [
      ['eher', true],
      ['eher', true],
    ]);
    const alt = gelernt('b', 'b-1', tage(-30), [
      ['eher', true],
      ['eher', true],
    ]);
    const mittel = gelernt('c', 'c-1', tage(-7), [
      ['eher', true],
      ['eher', true],
    ]);
    expect(reihenfolge([jung, alt, mittel])).toEqual(['b-1', 'c-1', 'a-1']);
  });

  it('ordnet mehrere Fehlvorstellungen nach Haeufigkeit, die hartnaeckigste zuerst', () => {
    const zweimal = gelernt('a', 'a-1', tage(20), [
      ['sicher', false, 'x'],
      ['sicher', false, 'x'],
    ]);
    const dreimal = gelernt('b', 'b-1', tage(20), [
      ['sicher', false, 'y'],
      ['sicher', false, 'y'],
      ['sicher', false, 'y'],
    ]);
    expect(reihenfolge([zweimal, dreimal])).toEqual(['b-1', 'a-1']);
  });
});

describe('auswahl — was als Fehlvorstellung gilt', () => {
  it('verlangt zweimal DIESELBE falsche Antwort, nicht nur zweimal falsch', () => {
    // Zwei verschiedene Fehlgriffe sind Unwissen. Zweimal derselbe ist ein
    // Modell im Kopf, das nicht stimmt — und das ist der teurere Fall.
    const wechselnd = gelernt('a', 'a-1', tage(20), [
      ['sicher', false, 'erste falsche'],
      ['sicher', false, 'zweite falsche'],
    ]);
    expect(auswahl([wechselnd], JETZT).fragen[0]?.grund).toBe('wackelt');
  });

  it('zaehlt nur sichere Fehlgriffe, nicht geratene', () => {
    const geraten = gelernt('a', 'a-1', tage(20), [
      ['geraten', false, 'x'],
      ['geraten', false, 'x'],
    ]);
    expect(auswahl([geraten], JETZT).fragen[0]?.grund).toBe('wackelt');
  });

  it('nennt die Schwelle als Zahl', () => {
    expect(FEHLVORSTELLUNG_AB).toBe(2);
  });

  /**
   * Der Befund aus der Durchrechnung einer Sitzungsfolge: Eine einmal
   * eingetragene Fehlvorstellung bleibt fuer immer in der Historie. Wird sie
   * bei der Auswahl aus der GESAMTEN Historie gezaehlt, fuehrt die Frage die
   * Sitzung bis in alle Ewigkeit an — auch wenn sie seither jedes Mal richtig
   * beantwortet wurde. Gemessen: vier Fragen standen dreissig Tage lang
   * taeglich auf Platz eins.
   *
   * Die Auswahl muss deshalb dieselbe Aufloesungsregel benutzen wie `reife`.
   */
  it('laesst eine ausgeraeumte Fehlvorstellung wieder los', () => {
    const ausgeraeumt = gelernt('a', 'a-1', tage(9), [
      ['sicher', false, 'x'],
      ['sicher', false, 'x'],
      ['eher', true],
      ['eher', true],
    ]);
    expect(auswahl([ausgeraeumt], JETZT).fragen).toEqual([]);
  });

  it('haelt sie fest, solange erst ein Treffer darauf folgte', () => {
    const halb = gelernt('a', 'a-1', tage(9), [
      ['sicher', false, 'x'],
      ['sicher', false, 'x'],
      ['eher', true],
    ]);
    expect(auswahl([halb], JETZT).fragen.map((v) => v.grund)).toEqual(['fehlvorstellung']);
  });

  it('holt eine ausgeraeumte Fehlvorstellung bei erneutem Fehlgriff wieder nach vorn', () => {
    // Alt, ausgeraeumt, dann wieder daneben: Das ist derselbe Denkfehler, der
    // zurueckkommt, und nicht irgendein neuer.
    const rueckfall = gelernt('a', 'a-1', tage(9), [
      ['sicher', false, 'x'],
      ['sicher', false, 'x'],
      ['eher', true],
      ['eher', true],
      ['eher', false, 'x'],
    ]);
    expect(auswahl([rueckfall], JETZT).fragen.map((v) => v.grund)).toEqual(['fehlvorstellung']);
  });
});

describe('auswahl — die Begrenzung auf neue Prinzipien', () => {
  /** Vier Lektionen zu je vier Fragen — der heutige Bestand der App. */
  function ganzerBestand(): Kandidat[] {
    const kandidaten: Kandidat[] = [];
    for (const lektion of ['rvp', 'kbib', 'kfm', 'ang']) {
      for (const nr of ['1', '2', '3', 'transfer']) {
        kandidaten.push(neu(lektion, `${lektion}-${nr}`));
      }
    }
    return kandidaten;
  }

  it('nennt die Grenze als Zahl', () => {
    expect(NEUE_PRINZIPIEN_JE_SITZUNG).toBe(2);
  });

  it('legt aus sechzehn unberuehrten Fragen genau acht in die erste Sitzung', () => {
    // Die gemessene Wirkung der Regel beim heutigen Bestand: Sie halbiert die
    // erste Sitzung. Bricht diese Zahl, ist entweder die Grenze verstellt
    // oder der Bestand gewachsen — beides gehoert bemerkt.
    const s = auswahl(ganzerBestand(), JETZT);
    expect(s.fragen).toHaveLength(8);
    expect(new Set(s.fragen.map((v) => v.lektion))).toEqual(new Set(['rvp', 'kbib']));
  });

  it('nimmt die neuen Prinzipien in der uebergebenen Reihenfolge, nicht alphabetisch', () => {
    // Die Eingabe kommt in Lehrplanreihenfolge (`reihenfolge` im Frontmatter).
    // Die Auswahl darf sie nicht umsortieren, sonst beginnt die erste Sitzung
    // bei Lektion 4.
    const s = auswahl([neu('ang', 'ang-1'), neu('kbib', 'kbib-1'), neu('rvp', 'rvp-1')], JETZT);
    expect(s.fragen.map((v) => v.frage)).toEqual(['ang-1', 'kbib-1']);
  });

  it('zaehlt ein angefangenes Prinzip nicht gegen die Grenze', () => {
    // Die Grenze schuetzt vor NEUEN Prinzipien, nicht vor zusaetzlichen
    // Fragen. Wer ein Prinzip schon im Kopf hat, dem kostet dessen vierte
    // Frage kaum noch etwas.
    const kandidaten = [
      gelernt('rvp', 'rvp-1', tage(9), [
        ['eher', true],
        ['eher', true],
      ]),
      neu('rvp', 'rvp-2'),
      neu('kbib', 'kbib-1'),
      neu('kfm', 'kfm-1'),
      neu('ang', 'ang-1'),
    ];
    const s = auswahl(kandidaten, JETZT);
    expect(s.fragen.map((v) => v.frage)).toEqual(['rvp-2', 'kbib-1', 'kfm-1']);
  });

  it('laesst sich die Grenze von aussen verstellen', () => {
    const s = auswahl([neu('a', 'a-1'), neu('b', 'b-1'), neu('c', 'c-1')], JETZT, {
      neuePrinzipien: 1,
    });
    expect(s.fragen.map((v) => v.frage)).toEqual(['a-1']);
  });

  it('gibt bei Grenze null gar nichts Neues heraus', () => {
    const s = auswahl([neu('a', 'a-1')], JETZT, { neuePrinzipien: 0 });
    expect(s.fragen).toEqual([]);
  });
});

/**
 * Der Zustand, der bei vier Lektionen der Normalfall ist: alles beantwortet,
 * nichts faellig.
 *
 * Die Auswahl erfindet dann nichts. Sie sagt stattdessen, WANN wieder etwas
 * ansteht — damit die Landkarte einen Satz hat, der stimmt, statt eine leere
 * Liste ohne Erklaerung zu zeigen.
 */
describe('auswahl — wenn nichts ansteht', () => {
  const ruhe: Kandidat[] = [
    gelernt('rvp', 'rvp-1', tage(9), [
      ['eher', true],
      ['eher', true],
    ]),
    gelernt('kbib', 'kbib-1', tage(3), [
      ['sicher', true],
      ['sicher', true],
    ]),
    gelernt('kfm', 'kfm-1', tage(21), [
      ['eher', true],
      ['eher', true],
    ]),
  ];

  it('gibt eine leere Liste heraus statt eine Frage vorzuziehen', () => {
    expect(auswahl(ruhe, JETZT).fragen).toEqual([]);
  });

  it('nennt den naechsten Termin, damit die Landkarte etwas sagen kann', () => {
    expect(auswahl(ruhe, JETZT).naechstFaellig?.toISOString()).toBe(tage(3).toISOString());
  });

  it('nennt keinen naechsten Termin, wenn es keine geplante Karte gibt', () => {
    expect(auswahl([neu('a', 'a-1')], JETZT).naechstFaellig).toBeNull();
    expect(auswahl([], JETZT).naechstFaellig).toBeNull();
  });

  it('nennt den naechsten Termin auch dann, wenn die Sitzung nicht leer ist', () => {
    // Die Landkarte soll auch nach einer Sitzung sagen koennen, wann es
    // weitergeht.
    const s = auswahl([...ruhe, neu('ang', 'ang-1')], JETZT);
    expect(s.fragen).toHaveLength(1);
    expect(s.naechstFaellig?.toISOString()).toBe(tage(3).toISOString());
  });

  it('zaehlt einen Termin genau jetzt nicht als kuenftig — er steht ja an', () => {
    const jetztFaellig = gelernt('a', 'a-1', new Date(JETZT), [
      ['eher', true],
      ['eher', true],
    ]);
    const s = auswahl([jetztFaellig], JETZT);
    expect(s.fragen.map((v) => v.grund)).toEqual(['ueberfaellig']);
    expect(s.naechstFaellig).toBeNull();
  });
});

describe('auswahl — reine Funktion', () => {
  it('liest die Zeit nicht selbst und aendert die Eingabe nicht', () => {
    const kandidaten = [
      gelernt('a', 'a-1', tage(-1), [
        ['eher', true],
        ['eher', true],
      ]),
      neu('b', 'b-1'),
    ];
    const vorher = JSON.stringify(kandidaten);
    const erste = auswahl(kandidaten, JETZT);
    const zweite = auswahl(kandidaten, JETZT);
    expect(erste).toEqual(zweite);
    expect(JSON.stringify(kandidaten)).toBe(vorher);
  });

  it('nimmt jede Frage hoechstens einmal auf', () => {
    // Eine ueberfaellige Frage mit Fehlvorstellung erfuellt zwei Bedingungen.
    // Sie darf trotzdem nur einmal in der Sitzung stehen.
    const doppelt = gelernt('a', 'a-1', tage(-5), [
      ['sicher', false, 'x'],
      ['sicher', false, 'x'],
    ]);
    const s = auswahl([doppelt], JETZT);
    expect(s.fragen).toHaveLength(1);
    expect(s.fragen[0]?.grund).toBe('fehlvorstellung');
  });

  it('kommt mit einer Frage ohne Termin, aber mit Verlauf zurecht', () => {
    // Kann auftreten, wenn der Kartenspeicher geleert wurde, die Ereignisse
    // aber ueberlebt haben. Kein Absturz, und die Frage faellt nicht raus.
    const ohneKarte: Kandidat = {
      lektion: 'a',
      frage: 'a-1',
      faellig: null,
      ereignisse: [e('a', 'a-1', 'eher', false)],
    };
    expect(auswahl([ohneKarte], JETZT).fragen.map((v) => v.grund)).toEqual(['wackelt']);
  });
});
