// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  ART_FEHLT,
  HOECHSTZAHL,
  HOECHSTZAHL_JE_ABSCHNITT,
  lehrplaeneAusTexten,
  pruefeLehrplan,
} from '../src/lib/lehrplan';
import { liesLehrplan } from '../werkzeug/lehrplan.mjs';

/**
 * Lehrplan Fassung 2 fuer Buch und Folien.
 *
 * Die Hilfen hier machen NICHTS von selbst gueltig: `abschnitt()` und
 * `folien()` legen die Aenderung stumpf ueber einen gueltigen Stand. Wer einen
 * Abschnitt kaputt machen will, reicht den ganzen Abschnitt herein. Im Umbau
 * der Aufgabenfamilie blieben zweimal Schemaregeln ohne Test, weil eine Hilfe
 * die Eingaben von selbst gueltig machte.
 *
 * Eine Lektion je Prinzip, Lektion-Id = Prinzip-Id — wie bei Repos. Ein
 * Abschnitt fuehrt keine eigene Lektion; seine Lektionen sind die seiner
 * Prinzipien.
 */

const LEKTIONEN = new Set(['pauschal-heisst-nicht-komplett', 'einheitspreis-folgt-der-menge']);

const prinzip = {
  id: 'pauschal-verlagert-mengenrisiko',
  satz: 'Ein Pauschalpreis verlagert das Mengenrisiko, nicht das Vollständigkeitsrisiko.',
  warumNichtOffensichtlich: 'Pauschal klingt nach komplett.',
  belege: ['m07-2-vertragsarten'],
  widget: 'Pipeline',
};

/** Das Prinzip oben unter einer anderen id — sie benennt zugleich seine Lektion. */
function prinzipMit(id: string): Record<string, unknown> {
  return { ...prinzip, id };
}

/** Ein fuer sich gueltiger Repo-Lehrplan — fuer den Vergleich mit dem Repo. */
const repoBasis = {
  art: 'repo',
  quelle: 'awesome-llm-apps',
  stand: 'a13701eae315a81e1011a4304a6b5e741ea0a984',
  geprueftVon: 'Daniel Nobs',
  geprueftAm: '2026-09-02',
  prinzipien: [
    { id: 'p-1', satz: 'Satz.', warumNichtOffensichtlich: 'Weil.', belege: ['b'], widget: 'Pipeline' },
    { id: 'p-2', satz: 'Satz.', warumNichtOffensichtlich: 'Weil.', belege: ['b'], widget: 'Pipeline' },
  ],
};

const basisAbschnitt = {
  id: 'm07-2-vertragsarten',
  titel: 'Risikomanagement und Vertragswesen',
  datei: 'M7 Risikomanagement 26.pdf',
  seiten: [28, 34],
  status: 'offen',
};

function abschnitt(aenderung: Record<string, unknown> = {}): Record<string, unknown> {
  return { ...basisAbschnitt, ...aenderung };
}

const basis = {
  art: 'folien',
  quelle: 'bauch-projektmanagement',
  titel: 'Projektmanagement',
  stand: `sha256:${'a'.repeat(64)}`,
  geprueftVon: 'Daniel Nobs',
  geprueftAm: '2026-09-22',
  abschnitte: [abschnitt({ id: 'm07-1-risiko', titel: 'Risiko', seiten: [1, 27] }), abschnitt()],
};

function folien(aenderung: Record<string, unknown> = {}): Record<string, unknown> {
  return { ...basis, ...aenderung };
}

/** Ein Folien-Lehrplan mit genau diesen Abschnitten, sonst unveraendert. */
function mitAbschnitten(...abschnitte: Record<string, unknown>[]): Record<string, unknown> {
  return folien({ abschnitte });
}

function ohneFeld(objekt: Record<string, unknown>, feld: string): Record<string, unknown> {
  const { [feld]: _weg, ...rest } = objekt;
  return rest;
}

function gilt(daten: unknown): boolean {
  return pruefeLehrplan(daten, LEKTIONEN).ok;
}

function maengelVon(daten: unknown, lektionen: ReadonlySet<string> = LEKTIONEN): string {
  const e = pruefeLehrplan(daten, lektionen);
  if (e.ok) throw new Error('Erwartet war ein Fehlschlag, die Pruefung war aber zufrieden.');
  return e.maengel.join(' | ');
}

describe('Buch und Folien - die Form', () => {
  it('nimmt einen gueltigen Folien-Lehrplan an', () => {
    const e = pruefeLehrplan(folien(), LEKTIONEN);
    if (!e.ok) throw new Error(e.maengel.join('\n'));
    if (e.lehrplan.art !== 'folien') throw new Error('Erwartet waren Folien.');
    expect(e.lehrplan.abschnitte).toHaveLength(2);
  });

  it('nennt in der Meldung zu art alle drei Arten', () => {
    expect(maengelVon(folien({ art: 'video' }))).toBe(`art: ${ART_FEHLT}`);
    expect(ART_FEHLT).toContain('erlaubt sind repo, buch und folien');
  });

  it('nimmt ein Buch mit ISBN und Auflage an', () => {
    expect(gilt(folien({ art: 'buch', isbn: '978-3-658-00000-0', auflage: '3. Auflage' }))).toBe(true);
  });

  it('weist ISBN und Auflage bei Folien zurueck', () => {
    expect(gilt(folien({ isbn: '978-3-658-00000-0' }))).toBe(false);
    expect(gilt(folien({ auflage: '3. Auflage' }))).toBe(false);
  });

  it('nennt bei ISBN auf Folien den Grund, statt den Schluessel nur unbekannt zu nennen', () => {
    expect(maengelVon(folien({ isbn: '978-3-658-00000-0' }))).toBe(
      '(Wurzel): isbn und auflage stehen nur bei art: buch.',
    );
  });

  it('nennt bei Auflage auf Folien denselben Grund', () => {
    expect(maengelVon(folien({ auflage: '3. Auflage' }))).toBe(
      '(Wurzel): isbn und auflage stehen nur bei art: buch.',
    );
  });

  it.each(['quelle', 'titel', 'stand', 'geprueftVon', 'geprueftAm', 'abschnitte'])('verlangt das Feld %s', (feld) => {
    expect(gilt(ohneFeld(folien(), feld))).toBe(false);
  });

  it('meldet ein fehlendes titel auf Deutsch, ohne Zods englische Standardmeldung', () => {
    expect(maengelVon(ohneFeld(folien(), 'titel'))).toBe('titel: fehlt.');
  });

  it('weist einen gekuerzten sha256-Stand zurueck — 63 statt 64 Zeichen', () => {
    expect(maengelVon(folien({ stand: `sha256:${'a'.repeat(63)}` }))).toBe(
      'stand: stand ist der Hash aus dem Manifest — sha256: und 64 Zeichen aus 0–9 und a–f.',
    );
  });

  it('weist einen Stand ohne das sha256-Praefix zurueck, auch bei 64 Zeichen', () => {
    expect(maengelVon(folien({ stand: 'a'.repeat(64) }))).toBe(
      'stand: stand ist der Hash aus dem Manifest — sha256: und 64 Zeichen aus 0–9 und a–f.',
    );
  });

  it('weist eine Quelle mit Grossbuchstaben und Leerzeichen zurueck — sie ist der Ordnername unter quellen/', () => {
    expect(maengelVon(folien({ quelle: 'Awesome LLM' }))).toBe(
      'quelle: quelle ist der Kurzname des Ordners unter quellen/ — nur Kleinbuchstaben, Ziffern und Bindestrich.',
    );
  });

  it('verlangt mindestens einen Abschnitt', () => {
    expect(maengelVon(mitAbschnitten())).toMatch(/mindestens einen Abschnitt/);
  });

  it('weist Prinzipien auf oberster Ebene zurueck — bei Lehrmaterial haengen sie am Abschnitt', () => {
    expect(gilt(folien({ prinzipien: [prinzip, { ...prinzip, id: 'zwei' }] }))).toBe(false);
  });

  it('weist ein Fremdfeld im Abschnitt zurueck', () => {
    expect(gilt(mitAbschnitten(abschnitt({ notiz: 'nebenbei' })))).toBe(false);
  });
});

describe('Abschnitte - Pflichtfelder und Form', () => {
  it.each(['id', 'titel', 'datei', 'seiten', 'status'])('verlangt im Abschnitt das Feld %s', (feld) => {
    expect(gilt(mitAbschnitten(ohneFeld(abschnitt(), feld)))).toBe(false);
  });

  it('weist eine Abschnitt-Id mit Grossbuchstaben oder Leerzeichen zurueck', () => {
    expect(gilt(mitAbschnitten(abschnitt({ id: 'M07-2' })))).toBe(false);
    expect(gilt(mitAbschnitten(abschnitt({ id: 'm07 2' })))).toBe(false);
  });

  it('weist einen unbekannten Status zurueck', () => {
    expect(gilt(mitAbschnitten(abschnitt({ status: 'fertig' })))).toBe(false);
  });

  it('nennt bei einem unbekannten Status die erlaubten Werte auf Deutsch', () => {
    expect(maengelVon(mitAbschnitten(abschnitt({ status: 'fertig' })))).toBe(
      'abschnitte.0.status: ist nicht erlaubt — erlaubt: offen, beauftragt, lektion, abgelehnt.',
    );
  });

  it('weist einen Seitenbereich zurueck, der rueckwaerts laeuft', () => {
    expect(maengelVon(mitAbschnitten(abschnitt({ seiten: [34, 28] })))).toMatch(
      /erst die erste, dann die letzte Seite/,
    );
  });

  it('weist Seite 0 zurueck', () => {
    expect(maengelVon(mitAbschnitten(abschnitt({ seiten: [0, 3] })))).toMatch(/Seiten zählen ab 1/);
  });

  it('nimmt einen Abschnitt aus einer einzigen Seite an', () => {
    expect(gilt(mitAbschnitten(abschnitt({ seiten: [12, 12] })))).toBe(true);
  });

  it('liest fehlende Prinzipien als leere Liste', () => {
    // Das Einlesen legt Abschnitte ohne Prinzipien an; Durchgang A fuellt sie.
    const e = pruefeLehrplan(mitAbschnitten(abschnitt()), LEKTIONEN);
    if (!e.ok) throw new Error(e.maengel.join('\n'));
    if (e.lehrplan.art === 'repo') throw new Error('Erwartet waren Folien.');
    expect(e.lehrplan.abschnitte[0]?.prinzipien).toEqual([]);
  });

  it('meldet prinzipien: null auf Deutsch — ein YAML-Feld ohne Wert, nicht die fehlende Liste', () => {
    expect(maengelVon(mitAbschnitten(abschnitt({ prinzipien: null })))).toBe('abschnitte.0.prinzipien: ist leer.');
  });
});

/**
 * Wartet auf Freigabe — bei Lehrmaterial ist das der Normalfall gleich nach
 * dem Einlesen: Der Lehrplan traegt alle Abschnitte als `offen`, und
 * `geprueftVon` ist noch leer. Er ist trotzdem lesbar.
 */
describe('Buch und Folien - wartet auf Freigabe', () => {
  it('wartet, wenn nur die Freigabe fehlt — und liefert die Abschnitte mit', () => {
    const e = pruefeLehrplan(folien({ geprueftVon: '' }), LEKTIONEN);
    if (e.ok) throw new Error('Erwartet war ein Fehlschlag.');
    if (!e.wartet) throw new Error(`Erwartet war „wartet": ${e.maengel.join(' | ')}`);
    expect(e.maengel).toEqual(['geprueftVon: geprueftVon fehlt — der Lehrplan ist das Review-Gate.']);
    if (e.lehrplan.art === 'repo') throw new Error('Erwartet waren Folien.');
    expect(e.lehrplan.abschnitte).toHaveLength(2);
    expect(e.lehrplan.geprueftVon).toBe('');
  });

  it('bleibt ungueltig, wenn daneben eine Lektion fehlt — und zeigt beide Maengel', () => {
    const daten = folien({
      geprueftVon: '',
      abschnitte: [abschnitt({ status: 'lektion', prinzipien: [prinzipMit('gibt-es-nicht')] })],
    });
    const e = pruefeLehrplan(daten, LEKTIONEN);
    if (e.ok) throw new Error('Erwartet war ein Fehlschlag.');
    expect(e.wartet).toBeFalsy();
    expect(e.maengel).toEqual([
      'geprueftVon: geprueftVon fehlt — der Lehrplan ist das Review-Gate.',
      'abschnitte.0.prinzipien.0.id: Die Lektion gibt-es-nicht gibt es nicht (inhalt/lektionen/gibt-es-nicht.mdx).',
    ]);
  });

  /**
   * `geprueftVon:` ohne Wert — so leert Durchgang A die Freigabe, und YAML
   * liest daraus null. Dann bricht Zod am Feld ab und laesst die Pruefung
   * ueber alle Abschnitte aus — auch die Pruefung auf doppelte Prinzip-Ids
   * innerhalb desselben Lehrplans. Stuende danach nur der Freigabe-Mangel da,
   * nennte die Karte die falsche Ursache.
   */
  const doppelt = [abschnitt({ seiten: [1, 27] }), abschnitt()];
  const doppeltePrinzipId = [
    abschnitt({ id: 'm07-1-risiko', seiten: [1, 27], status: 'beauftragt', prinzipien: [prinzip] }),
    abschnitt({ status: 'beauftragt', prinzipien: [prinzip] }),
  ];

  it.each([
    ['nicht gesetzt', folien({ geprueftVon: null, abschnitte: doppelt }), 'abschnitte.1.id: Zwei Abschnitte haben die id m07-2-vertragsarten.'],
    ['nicht angelegt', ohneFeld(folien({ abschnitte: doppelt }), 'geprueftVon'), 'abschnitte.1.id: Zwei Abschnitte haben die id m07-2-vertragsarten.'],
    [
      'nicht gesetzt, mit doppelter Prinzip-Id statt doppelter Abschnitt-Id',
      folien({ geprueftVon: null, abschnitte: doppeltePrinzipId }),
      'abschnitte.1.prinzipien.0.id: Zwei Prinzipien haben die id pauschal-verlagert-mengenrisiko.',
    ],
  ])('bleibt ungueltig, wenn geprueftVon %s ist — und zeigt beide Maengel', (_fall, daten, zweiterMangel) => {
    const e = pruefeLehrplan(daten, LEKTIONEN);
    if (e.ok) throw new Error('Erwartet war ein Fehlschlag.');
    expect(e.wartet).toBeFalsy();
    expect(e.maengel).toEqual(['geprueftVon: geprueftVon fehlt — der Lehrplan ist das Review-Gate.', zweiterMangel]);
  });
});

describe('Abschnitte - grund', () => {
  it('verlangt einen Grund, wenn ein Abschnitt abgelehnt ist', () => {
    expect(maengelVon(mitAbschnitten(abschnitt({ status: 'abgelehnt' })))).toMatch(
      /Ein abgelehnter Abschnitt braucht einen Grund\./,
    );
  });

  it('nimmt einen abgelehnten Abschnitt mit Grund an', () => {
    expect(gilt(mitAbschnitten(abschnitt({ status: 'abgelehnt', grund: 'reine Titelfolien' })))).toBe(true);
  });

  it('meldet grund: null bei abgelehnt auf Deutsch — ein leeres YAML-Feld, nicht der fehlende Grund', () => {
    // `grund:` ohne Wert liest YAML als null. Ohne eigene Meldung zeigte die
    // Seite Zods englisches „expected string, received null".
    expect(maengelVon(mitAbschnitten(abschnitt({ status: 'abgelehnt', grund: null })))).toBe(
      'abschnitte.0.grund: ist leer.',
    );
  });

  it('meldet einen leeren Grund auf Deutsch', () => {
    expect(maengelVon(mitAbschnitten(abschnitt({ status: 'abgelehnt', grund: '' })))).toBe(
      'abschnitte.0.grund: ist leer.',
    );
  });

  it.each(['offen', 'beauftragt'])('weist einen Grund bei status %s zurueck', (status) => {
    expect(maengelVon(mitAbschnitten(abschnitt({ status, grund: 'irgendwas' })))).toMatch(
      /grund steht nur bei status abgelehnt\./,
    );
  });

  // Spiegelbildlich: grund bisher nur bei offen/beauftragt geprueft (oben).
  // Bei status lektion muss der Abschnitt zugleich ein Prinzip tragen, zu dem
  // es die Lektion gibt — sonst greift eine andere Regel zuerst.
  it('weist einen Grund bei status lektion zurueck, auch mit Prinzip und Lektion', () => {
    expect(
      maengelVon(
        mitAbschnitten(
          abschnitt({ status: 'lektion', prinzipien: [prinzipMit('pauschal-heisst-nicht-komplett')], grund: 'irgendwas' }),
        ),
      ),
    ).toBe('abschnitte.0.grund: grund steht nur bei status abgelehnt.');
  });
});

/**
 * Was der Status ueber die Prinzipien sagt: `offen` hat noch keine,
 * `beauftragt` null bis drei — vor Durchgang A keine, danach mindestens
 * eines —, `lektion` mindestens eines und `abgelehnt` keines. Verworfene
 * Prinzipien streicht der Mensch am Review-Gate; ein Feld dafuer gibt es nicht.
 */
describe('Abschnitte - Status und Prinzipien', () => {
  it('weist Prinzipien bei status offen zurueck — erst beauftragen, dann Durchgang A', () => {
    expect(maengelVon(mitAbschnitten(abschnitt({ status: 'offen', prinzipien: [prinzip] })))).toBe(
      'abschnitte.0.prinzipien: Ein offener Abschnitt hat noch keine Prinzipien — erst beauftragen, dann Durchgang A.',
    );
  });

  // Mit Grund: Ohne ihn griffe die Regel zum Grund zuerst.
  it('weist Prinzipien bei status abgelehnt zurueck, auch mit Grund', () => {
    expect(
      maengelVon(mitAbschnitten(abschnitt({ status: 'abgelehnt', grund: 'reine Titelfolien', prinzipien: [prinzip] }))),
    ).toBe('abschnitte.0.prinzipien: Ein abgelehnter Abschnitt hat keine Prinzipien.');
  });

  it('verlangt bei status lektion mindestens ein Prinzip', () => {
    expect(maengelVon(mitAbschnitten(abschnitt({ status: 'lektion' })))).toBe(
      'abschnitte.0.prinzipien: Ein Abschnitt mit status lektion braucht mindestens ein Prinzip — seine Lektionen tragen dessen id.',
    );
  });

  it('meldet prinzipien: null bei status lektion auf Deutsch — ein leeres YAML-Feld, nicht das fehlende Prinzip', () => {
    expect(maengelVon(mitAbschnitten(abschnitt({ status: 'lektion', prinzipien: null })))).toBe(
      'abschnitte.0.prinzipien: ist leer.',
    );
  });

  it('nimmt Prinzipien bei status beauftragt an, auch ohne ihre Lektionen — der Zustand nach Durchgang A', () => {
    const ohneLektion = [prinzipMit('gibt-es-nicht'), prinzipMit('auch-nicht')];
    expect(gilt(mitAbschnitten(abschnitt({ status: 'beauftragt', prinzipien: ohneLektion })))).toBe(true);
  });

  it('nimmt status beauftragt ohne Prinzipien an — der Zustand vor Durchgang A', () => {
    expect(gilt(mitAbschnitten(abschnitt({ status: 'beauftragt' })))).toBe(true);
  });
});

/**
 * Eine Lektion je Prinzip, Lektion-Id = Prinzip-Id. Ein Abschnitt mit
 * `status: lektion` ist erst dann fertig, wenn es zu jedem seiner Prinzipien
 * die Lektion gibt.
 */
describe('Abschnitte - die Lektionen ihrer Prinzipien', () => {
  /** Ein Abschnitt mit status lektion und je einem Prinzip dieser Ids, sonst unveraendert. */
  const mitLektionen = (...ids: string[]) => abschnitt({ status: 'lektion', prinzipien: ids.map(prinzipMit) });

  it('nimmt einen Abschnitt an, zu dessen Prinzip es die Lektion gibt', () => {
    expect(gilt(mitAbschnitten(mitLektionen('pauschal-heisst-nicht-komplett')))).toBe(true);
  });

  it('nimmt einen Abschnitt mit zwei Prinzipien an, zu denen es beide Lektionen gibt', () => {
    expect(gilt(mitAbschnitten(mitLektionen('pauschal-heisst-nicht-komplett', 'einheitspreis-folgt-der-menge')))).toBe(
      true,
    );
  });

  it('weist ein Prinzip zurueck, dessen Lektion es nicht gibt, und nennt die Datei', () => {
    expect(maengelVon(mitAbschnitten(mitLektionen('gibt-es-nicht')))).toBe(
      'abschnitte.0.prinzipien.0.id: Die Lektion gibt-es-nicht gibt es nicht (inhalt/lektionen/gibt-es-nicht.mdx).',
    );
  });

  it('nennt von zwei Prinzipien genau das, dessen Lektion fehlt', () => {
    expect(maengelVon(mitAbschnitten(mitLektionen('pauschal-heisst-nicht-komplett', 'gibt-es-nicht')))).toBe(
      'abschnitte.0.prinzipien.1.id: Die Lektion gibt-es-nicht gibt es nicht (inhalt/lektionen/gibt-es-nicht.mdx).',
    );
  });

  it('faellt ohne bekannte Lektionen durch, nie durch', () => {
    expect(maengelVon(mitAbschnitten(mitLektionen('pauschal-heisst-nicht-komplett')), new Set())).toMatch(
      /gibt es nicht/,
    );
  });

  it('weist das alte Feld lektion zurueck und sagt, wo die Lektionen jetzt stehen', () => {
    expect(maengelVon(mitAbschnitten(abschnitt({ lektion: 'x' })))).toBe(
      'abschnitte.0: lektion gibt es nicht mehr: Die Lektionen eines Abschnitts sind die seiner Prinzipien (Lektion-Id = Prinzip-Id).',
    );
  });

  it('nennt bei einem Abschnitt in der alten Form beides: was weg muss und was fehlt', () => {
    expect(
      maengelVon(mitAbschnitten(abschnitt({ status: 'lektion', lektion: 'pauschal-heisst-nicht-komplett' }))),
    ).toBe(
      'abschnitte.0: lektion gibt es nicht mehr: Die Lektionen eines Abschnitts sind die seiner Prinzipien (Lektion-Id = Prinzip-Id).' +
        ' | abschnitte.0.prinzipien: Ein Abschnitt mit status lektion braucht mindestens ein Prinzip — seine Lektionen tragen dessen id.',
    );
  });
});

/**
 * Eine Folienlektion hat oft kein Widget — ihre Interaktion sind die
 * Aufgaben. Bei Buch und Folien ist `widget` deshalb optional; bei Repos
 * bleibt es Pflicht.
 */
describe('Prinzipien - widget', () => {
  it('nimmt ein Prinzip ohne widget bei Folien an und verlangt es im Repo wie bisher', () => {
    const ohneWidget = ohneFeld(prinzip, 'widget');
    expect(gilt(mitAbschnitten(abschnitt({ status: 'beauftragt', prinzipien: [ohneWidget] })))).toBe(true);
    const repo = { ...repoBasis, prinzipien: [ohneFeld(repoBasis.prinzipien[0], 'widget'), repoBasis.prinzipien[1]] };
    expect(maengelVon(repo)).toBe('prinzipien.0.widget: fehlt.');
  });

  it('prueft ein widget bei Folien, wenn es dasteht', () => {
    const falsch = { ...prinzip, widget: 'GibtEsNicht' };
    expect(maengelVon(mitAbschnitten(abschnitt({ status: 'beauftragt', prinzipien: [falsch] })))).toBe(
      'abschnitte.0.prinzipien.0.widget: kein bekannter Widget-Typ.',
    );
  });

  it('weist ein Fremdfeld im Prinzip eines Abschnitts zurueck — bis auf widget die Form des Repos', () => {
    const mitNotiz = { ...prinzip, notiz: 'nebenbei' };
    expect(maengelVon(mitAbschnitten(abschnitt({ status: 'beauftragt', prinzipien: [mitNotiz] })))).toBe(
      'abschnitte.0.prinzipien.0: unbekanntes Feld: notiz.',
    );
  });
});

describe('Abschnitte untereinander', () => {
  const a = (id: string, datei: string, seiten: [number, number]) => abschnitt({ id, datei, seiten });

  it('weist doppelte Abschnitt-Ids zurueck', () => {
    expect(maengelVon(mitAbschnitten(a('m1', 'A.pdf', [1, 5]), a('m1', 'A.pdf', [6, 9])))).toMatch(
      /Zwei Abschnitte haben die id m1\./,
    );
  });

  it('weist sich ueberschneidende Seitenbereiche in derselben Datei zurueck', () => {
    expect(maengelVon(mitAbschnitten(a('m1', 'A.pdf', [1, 10]), a('m2', 'A.pdf', [8, 20])))).toMatch(
      /überschneiden sich nicht: m2 beginnt auf Seite 8, der Abschnitt davor in A\.pdf endet auf Seite 10/,
    );
  });

  it('weist sich beruehrende Bereiche zurueck — beide enthielten dieselbe Seite', () => {
    expect(gilt(mitAbschnitten(a('m1', 'A.pdf', [1, 5]), a('m2', 'A.pdf', [5, 9])))).toBe(false);
  });

  it('nimmt aneinander anschliessende Bereiche an', () => {
    expect(gilt(mitAbschnitten(a('m1', 'A.pdf', [1, 5]), a('m2', 'A.pdf', [6, 9])))).toBe(true);
  });

  it('weist absteigende Bereiche in derselben Datei zurueck', () => {
    expect(gilt(mitAbschnitten(a('m1', 'A.pdf', [10, 12]), a('m2', 'A.pdf', [1, 5])))).toBe(false);
  });

  it('nimmt dieselben Seiten in zwei Dateien an', () => {
    expect(gilt(mitAbschnitten(a('m1', 'A.pdf', [1, 5]), a('m2', 'B.pdf', [1, 5])))).toBe(true);
  });

  it('prueft je Datei, auch wenn sich die Dateien abwechseln', () => {
    // Faengt eine Pruefung, die nur mit dem unmittelbaren Vorgaenger vergleicht.
    expect(gilt(mitAbschnitten(a('m1', 'A.pdf', [1, 5]), a('m2', 'B.pdf', [1, 3]), a('m3', 'A.pdf', [6, 9])))).toBe(
      true,
    );
    expect(gilt(mitAbschnitten(a('m1', 'A.pdf', [1, 5]), a('m2', 'B.pdf', [1, 3]), a('m3', 'A.pdf', [4, 9])))).toBe(
      false,
    );
  });

  // Die Prinzip-Id benennt die Lektionsdatei: Zwei Prinzipien mit derselben
  // Id teilten sich eine Lektion.
  it('weist dieselbe Prinzip-Id in zwei Abschnitten zurueck — am zweiten Vorkommen', () => {
    const erster = abschnitt({ id: 'm1', seiten: [1, 5], status: 'beauftragt', prinzipien: [prinzip] });
    const zweiter = abschnitt({ id: 'm2', seiten: [6, 9], status: 'beauftragt', prinzipien: [prinzipMit('anderes'), prinzip] });
    expect(maengelVon(mitAbschnitten(erster, zweiter))).toBe(
      'abschnitte.1.prinzipien.1.id: Zwei Prinzipien haben die id pauschal-verlagert-mengenrisiko.',
    );
  });

  it('weist dieselbe Prinzip-Id auch im selben Abschnitt zurueck', () => {
    expect(maengelVon(mitAbschnitten(abschnitt({ status: 'beauftragt', prinzipien: [prinzip, prinzip] })))).toBe(
      'abschnitte.0.prinzipien.1.id: Zwei Prinzipien haben die id pauschal-verlagert-mengenrisiko.',
    );
  });
});

/** Prinzipien stehen hier unter `beauftragt`: Ein offener Abschnitt hat noch keine. */
describe('Prinzipien je Abschnitt', () => {
  const prinzipien = (n: number) => Array.from({ length: n }, (_, i) => ({ ...prinzip, id: `prinzip-${i}` }));
  const beauftragt = (aenderung: Record<string, unknown>) => abschnitt({ status: 'beauftragt', ...aenderung });

  it(`nimmt bis zu ${HOECHSTZAHL_JE_ABSCHNITT} Prinzipien je Abschnitt an`, () => {
    expect(gilt(mitAbschnitten(beauftragt({ prinzipien: prinzipien(HOECHSTZAHL_JE_ABSCHNITT) })))).toBe(true);
  });

  it('weist das vierte Prinzip zurueck und sagt warum', () => {
    expect(maengelVon(mitAbschnitten(beauftragt({ prinzipien: prinzipien(HOECHSTZAHL_JE_ABSCHNITT + 1) })))).toMatch(
      /höchstens 3 Prinzipien je Abschnitt — ein Abschnitt mit mehr ist katalogisiert, nicht destilliert\./,
    );
  });

  it('prueft ein Prinzip im Abschnitt wie im Repo — auch seinen Vorbehalt', () => {
    const langer = { ...prinzip, vorbehalt: 'Wort '.repeat(45).trim() };
    expect(maengelVon(mitAbschnitten(beauftragt({ prinzipien: [langer] })))).toMatch(/Ein Vorbehalt ist ein Satz/);
  });

  it(`erlaubt insgesamt mehr als ${HOECHSTZAHL} Prinzipien — die Obergrenze fuer Repos gilt hier nicht`, () => {
    // Vier Abschnitte zu je drei Prinzipien: zwoelf insgesamt, mehr als
    // HOECHSTZAHL. Fuer Lehrmaterial tritt an ihre Stelle die Pflicht, jeden
    // Abschnitt zu entscheiden (siehe Kommentar bei HOECHSTZAHL) — nicht,
    // insgesamt zu verdichten.
    expect(4 * HOECHSTZAHL_JE_ABSCHNITT).toBeGreaterThan(HOECHSTZAHL);
    const vierAbschnitte = Array.from({ length: 4 }, (_, i) =>
      beauftragt({
        id: `m07-${i}`,
        seiten: [i * 10 + 1, i * 10 + 9],
        prinzipien: prinzipien(HOECHSTZAHL_JE_ABSCHNITT).map((p, j) => ({ ...p, id: `a${i}-prinzip-${j}` })),
      }),
    );
    expect(gilt(mitAbschnitten(...vierAbschnitte))).toBe(true);
  });
});

/**
 * Prinzip-Ids benennen Lektionsdateien — deshalb sind sie ueber alle
 * Lehrplaene eindeutig, nicht nur in einem. Es behaelt sie der Lehrplan, der
 * zuerst an der Reihe ist: erst alle freigegebenen in Pfad-Reihenfolge, dann
 * alle wartenden in Pfad-Reihenfolge. Ein Lehrplan mit einer schon
 * vergebenen Id wird ungueltig.
 */
describe('lehrplaeneAusTexten - Prinzip-Ids ueber alle Lehrplaene', () => {
  /** Ein Folien-Lehrplan als Text — JSON ist gueltiges YAML —, mit einem beauftragten Abschnitt. */
  const mitPrinzipien = (quelle: string, aenderung: Record<string, unknown>, ...ids: string[]) =>
    JSON.stringify(
      folien({ quelle, abschnitte: [abschnitt({ status: 'beauftragt', prinzipien: ids.map(prinzipMit) })], ...aenderung }),
    );
  const schonIn = (id: string, datei: string) =>
    `(Wurzel): Die Prinzip-Id ${id} steht schon in ${datei}; Lektion und Prinzip teilen sich die Id.`;

  it('weist den spaeteren von zwei Folien-Lehrplaenen mit derselben Prinzip-Id zurueck — der fruehere bleibt gueltig', () => {
    // In umgekehrter Reihenfolge hereingereicht: Es zaehlt der Pfad, nicht die Eingabe.
    const { gueltig, wartend, ungueltig } = lehrplaeneAusTexten(
      {
        '/lehrplan/b.yaml': mitPrinzipien('b', {}, 'geteilt'),
        '/lehrplan/a.yaml': mitPrinzipien('a', {}, 'geteilt'),
      },
      LEKTIONEN,
    );
    expect(gueltig.map((l) => l.quelle)).toEqual(['a']);
    expect(wartend).toEqual([]);
    expect(ungueltig).toEqual([{ datei: 'b.yaml', maengel: [schonIn('geteilt', 'a.yaml')] }]);
  });

  it('gilt auch zwischen Repo und Folien — mit einem Mangel je doppelter Id', () => {
    const { gueltig, ungueltig } = lehrplaeneAusTexten(
      {
        '/lehrplan/awesome.yaml': JSON.stringify(repoBasis),
        '/lehrplan/bauch.yaml': mitPrinzipien('bauch', {}, 'p-2', 'eigenes', 'p-1'),
      },
      LEKTIONEN,
    );
    expect(gueltig.map((l) => l.art)).toEqual(['repo']);
    expect(ungueltig).toEqual([
      { datei: 'bauch.yaml', maengel: [schonIn('p-2', 'awesome.yaml'), schonIn('p-1', 'awesome.yaml')] },
    ]);
  });

  it('zaehlt einen wartenden Lehrplan mit — ein wartender mit doppelter Id wird ungueltig und zeigt alle Maengel', () => {
    const { wartend, ungueltig } = lehrplaeneAusTexten(
      {
        '/lehrplan/a.yaml': mitPrinzipien('a', { geprueftVon: '' }, 'geteilt'),
        '/lehrplan/b.yaml': mitPrinzipien('b', { geprueftVon: '' }, 'geteilt'),
      },
      LEKTIONEN,
    );
    expect(wartend.map((l) => l.quelle)).toEqual(['a']);
    expect(ungueltig).toEqual([
      {
        datei: 'b.yaml',
        maengel: ['geprueftVon: geprueftVon fehlt — der Lehrplan ist das Review-Gate.', schonIn('geteilt', 'a.yaml')],
      },
    ]);
  });

  /**
   * Freigegebene Lehrplaene gehen zuerst: Sie geben ihre Ids ab, bevor ein
   * wartender Lehrplan an der Reihe ist — auch wenn dessen Datei nach Pfad
   * frueher kommt. Sonst koennte ein Folien-Lehrplan, der noch auf die
   * Freigabe wartet, einen laengst freigegebenen Lehrplan verdraengen, nur
   * weil sein Dateiname alphabetisch vorn steht.
   */
  it('laesst einen wartenden Lehrplan nicht vor einem freigegebenen mit gleicher Id gewinnen, auch wenn er nach Pfad frueher kommt', () => {
    const { gueltig, wartend, ungueltig } = lehrplaeneAusTexten(
      {
        '/lehrplan/a.yaml': mitPrinzipien('a', { geprueftVon: '' }, 'geteilt'),
        '/lehrplan/b.yaml': mitPrinzipien('b', {}, 'geteilt'),
      },
      LEKTIONEN,
    );
    expect(gueltig.map((l) => l.quelle)).toEqual(['b']);
    expect(wartend).toEqual([]);
    expect(ungueltig).toEqual([
      {
        datei: 'a.yaml',
        maengel: ['geprueftVon: geprueftVon fehlt — der Lehrplan ist das Review-Gate.', schonIn('geteilt', 'b.yaml')],
      },
    ]);
  });

  /**
   * Ein Lehrplan, der selbst wegen einer doppelten Id ungueltig wird, traegt
   * danach keine Ids mehr — auch nicht die, in denen er der einzige Traeger
   * war. b faellt wegen X durch; c bekommt Y trotzdem, als haette es b nie
   * gegeben.
   */
  it('gibt eine Id wieder frei, wenn ihr Lehrplan wegen einer anderen doppelten Id ungueltig wird', () => {
    const { gueltig, ungueltig } = lehrplaeneAusTexten(
      {
        '/lehrplan/a.yaml': mitPrinzipien('a', {}, 'x'),
        '/lehrplan/b.yaml': mitPrinzipien('b', {}, 'x', 'y'),
        '/lehrplan/c.yaml': mitPrinzipien('c', {}, 'y'),
      },
      LEKTIONEN,
    );
    expect(gueltig.map((l) => l.quelle)).toEqual(['a', 'c']);
    expect(ungueltig).toEqual([{ datei: 'b.yaml', maengel: [schonIn('x', 'a.yaml')] }]);
  });
});

describe('liesLehrplan - Lehrmaterial', () => {
  const yaml = `art: folien
quelle: bauch-projektmanagement
titel: Projektmanagement
stand: "sha256:${'a'.repeat(64)}"
geprueftVon: Daniel Nobs
geprueftAm: 2026-09-22
abschnitte:
  - id: m07-2-vertragsarten
    titel: Risikomanagement und Vertragswesen
    datei: M7 Risikomanagement 26.pdf
    seiten: [28, 34]
    status: lektion
    prinzipien:
      - id: pauschal-heisst-nicht-komplett
        satz: Ein Pauschalpreis verlagert das Mengenrisiko, nicht das Vollständigkeitsrisiko.
        warumNichtOffensichtlich: Pauschal klingt nach komplett.
        belege: [m07-2-vertragsarten]
`;

  /** Legt Lehrplan und Lektionsordner in einem Wegwerfordner an. */
  function mitOrdner(pruefe: (datei: string, lektionen: string) => void): void {
    const ordner = mkdtempSync(path.join(tmpdir(), 'lehrmaterial-'));
    try {
      const lektionen = path.join(ordner, 'lektionen');
      mkdirSync(lektionen);
      writeFileSync(path.join(lektionen, 'pauschal-heisst-nicht-komplett.mdx'), '---\n---\n', 'utf8');
      const datei = path.join(ordner, 'plan.yaml');
      writeFileSync(datei, yaml, 'utf8');
      pruefe(datei, lektionen);
    } finally {
      rmSync(ordner, { recursive: true, force: true });
    }
  }

  it('findet die Lektion im Lektionsordner', () => {
    mitOrdner((datei, lektionen) => {
      const e = liesLehrplan(datei, lektionen);
      if (!e.ok) throw new Error(e.maengel.join('\n'));
      expect(e.lehrplan.art).toBe('folien');
    });
  });

  it('laesst ohne Lektionsordner jeden Abschnitt mit Lektion durchfallen', () => {
    mitOrdner((datei, lektionen) => {
      const e = liesLehrplan(datei, path.join(lektionen, 'gibt-es-nicht'));
      expect(e.ok).toBe(false);
    });
  });
});

describe('liesLehrplan - Standardordner inhalt/lektionen', () => {
  /**
   * Ohne zweites Argument greift der Vorgabewert `lektionsordner =
   * 'inhalt/lektionen'` — relativ zum Arbeitsverzeichnis, hier also der
   * echte Ordner des Projekts, nicht der Wegwerfordner der Nachbartests. Nur
   * der Lehrplan selbst liegt in einer Temp-Datei; die Lektion muss deshalb
   * wirklich unter `inhalt/lektionen/` existieren.
   */
  const vorlage = (lektion: string) => `art: folien
quelle: bauch-projektmanagement
titel: Projektmanagement
stand: "sha256:${'a'.repeat(64)}"
geprueftVon: Daniel Nobs
geprueftAm: 2026-09-22
abschnitte:
  - id: m07-2-vertragsarten
    titel: Risikomanagement und Vertragswesen
    datei: M7 Risikomanagement 26.pdf
    seiten: [28, 34]
    status: lektion
    prinzipien:
      - id: ${lektion}
        satz: Ein Pauschalpreis verlagert das Mengenrisiko, nicht das Vollständigkeitsrisiko.
        warumNichtOffensichtlich: Pauschal klingt nach komplett.
        belege: [m07-2-vertragsarten]
`;

  function mitLehrplan(lektion: string, pruefe: (datei: string) => void): void {
    const ordner = mkdtempSync(path.join(tmpdir(), 'lehrplan-standardordner-'));
    try {
      const datei = path.join(ordner, 'plan.yaml');
      writeFileSync(datei, vorlage(lektion), 'utf8');
      pruefe(datei);
    } finally {
      rmSync(ordner, { recursive: true, force: true });
    }
  }

  it('findet eine echte Lektion ueber den Standardordner, ohne zweites Argument', () => {
    mitLehrplan('pauschal-heisst-nicht-komplett', (datei) => {
      const e = liesLehrplan(datei);
      if (!e.ok) throw new Error(e.maengel.join('\n'));
      expect(e.ok).toBe(true);
    });
  });

  it('weist ueber denselben Standardordner eine Lektion zurueck, die es nicht gibt', () => {
    mitLehrplan('gibt-es-nicht', (datei) => {
      const e = liesLehrplan(datei);
      expect(e.ok).toBe(false);
      if (e.ok) return;
      expect(e.maengel.join(' ')).toContain('Die Lektion gibt-es-nicht gibt es nicht');
    });
  });
});

describe('keine englische Meldung', () => {
  // Jede Zeile ist fuer sich schon anderswo exakt geprueft; die Tabelle
  // prueft nur den einen Belang: nie ein Wort aus Zods englischer Vorlage.
  it.each<[string, unknown]>([
    ['grund: null bei abgelehnt', mitAbschnitten(abschnitt({ status: 'abgelehnt', grund: null }))],
    ['leerer grund bei abgelehnt', mitAbschnitten(abschnitt({ status: 'abgelehnt', grund: '' }))],
    ['altes Feld lektion: null bei status lektion', mitAbschnitten(abschnitt({ status: 'lektion', lektion: null }))],
    ['altes Feld lektion', mitAbschnitten(abschnitt({ lektion: 'x' }))],
    ['Prinzip bei status offen', mitAbschnitten(abschnitt({ status: 'offen', prinzipien: [prinzip] }))],
    [
      'Prinzip bei status abgelehnt',
      mitAbschnitten(abschnitt({ status: 'abgelehnt', grund: 'reine Titelfolien', prinzipien: [prinzip] })),
    ],
    ['status lektion ohne Prinzip', mitAbschnitten(abschnitt({ status: 'lektion' }))],
    [
      'status lektion, die Lektion fehlt',
      mitAbschnitten(abschnitt({ status: 'lektion', prinzipien: [prinzipMit('gibt-es-nicht')] })),
    ],
    ['dieselbe Prinzip-Id zweimal', mitAbschnitten(abschnitt({ status: 'beauftragt', prinzipien: [prinzip, prinzip] }))],
    ['prinzipien: null im Abschnitt', mitAbschnitten(abschnitt({ prinzipien: null }))],
    ['unbekannter status', mitAbschnitten(abschnitt({ status: 'fertig' }))],
    ['Folien mit isbn', folien({ isbn: '978-3-658-00000-0' })],
    ['Repo mit Feld autor', { ...repoBasis, autor: 'X' }],
    ['Folien ohne titel', ohneFeld(folien(), 'titel')],
    ['Repo mit nur einem Prinzip', { ...repoBasis, prinzipien: [repoBasis.prinzipien[0]] }],
    ['seiten als Text statt Liste', mitAbschnitten(abschnitt({ seiten: 'x' }))],
    ['abschnitte: []', mitAbschnitten()],
    ['datei als Zahl', mitAbschnitten(abschnitt({ datei: 3 }))],
  ])('%s', (_name, daten) => {
    const meldung = maengelVon(daten);
    expect(meldung).not.toMatch(/Invalid|expected|received|Unrecognized|Too small|Too big/);
  });
});
