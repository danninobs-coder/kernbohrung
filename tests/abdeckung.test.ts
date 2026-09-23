// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { abdeckung } from '../src/lib/abdeckung';
import { lehrplaeneAusTexten, pruefeLehrplan, type Lehrplan } from '../src/lib/lehrplan';
import type { Manifestauszug } from '../src/lib/manifestauszug';

/**
 * Die Abdeckung ist eine reine Funktion: Lehrplaene, Manifestauszuege und
 * Lektion-Ids hinein, der Bestand heraus. Die Lehrplaene hier laufen durch
 * `pruefeLehrplan`, bevor sie verrechnet werden — genau wie auf der Seite.
 * Eine Hilfe, die ungepruefte Objekte als Lehrplan ausgibt, testete eine
 * Eingabe, die es nie gibt.
 */

const LEKTIONEN = new Set(['lektion-a', 'lektion-b', 'pauschal-heisst-nicht-komplett']);
const KEINE_MANIFESTE = new Map<string, Manifestauszug>();
const SHA = 'a13701eae315a81e1011a4304a6b5e741ea0a984';
const HASH = `sha256:${'b'.repeat(64)}`;

function gepruefter(daten: unknown, lektionen: ReadonlySet<string> = LEKTIONEN): Lehrplan {
  const e = pruefeLehrplan(daten, lektionen);
  if (!e.ok) throw new Error(`Die Vorlage selbst ist ungueltig:\n  ${e.maengel.join('\n  ')}`);
  return e.lehrplan;
}

/** Ein Lehrplan, dem nur die Freigabe fehlt — der Zustand gleich nach dem Einlesen. */
function wartender(daten: unknown, lektionen: ReadonlySet<string> = LEKTIONEN): Lehrplan {
  const e = pruefeLehrplan(daten, lektionen);
  if (e.ok) throw new Error('Die Vorlage ist freigegeben, erwartet war ein wartender Lehrplan.');
  if (!e.wartet) throw new Error(`Erwartet war „wartet": ${e.maengel.join(' | ')}`);
  return e.lehrplan;
}

function prinzip(id: string, vorbehalt?: string) {
  return {
    id,
    satz: `Der Satz zu ${id}.`,
    warumNichtOffensichtlich: 'Weil es anders aussieht.',
    belege: ['beleg'],
    widget: 'Pipeline',
    ...(vorbehalt === undefined ? {} : { vorbehalt }),
  };
}

function repo(quelle: string, ...prinzipien: ReturnType<typeof prinzip>[]): Lehrplan {
  return gepruefter({
    art: 'repo',
    quelle,
    stand: SHA,
    geprueftVon: 'Daniel Nobs',
    geprueftAm: '2026-09-22',
    prinzipien,
  });
}

function lehrmaterial(art: 'buch' | 'folien', abschnitte: Record<string, unknown>[], extra: Record<string, unknown> = {}): Lehrplan {
  return gepruefter({
    art,
    quelle: 'bauch-projektmanagement',
    titel: 'Projektmanagement',
    stand: HASH,
    geprueftVon: 'Daniel Nobs',
    geprueftAm: '2026-09-22',
    abschnitte,
    ...extra,
  });
}

function abschnitt(id: string, von: number, status: string, extra: Record<string, unknown> = {}) {
  return { id, titel: `Titel ${id}`, datei: 'M7.pdf', seiten: [von, von + 1], status, ...extra };
}

/** Fuenf Abschnitte, je einer pro Status und ein zweiter offener. */
const fuenf = [
  abschnitt('m7-1', 1, 'lektion', { lektion: 'pauschal-heisst-nicht-komplett' }),
  abschnitt('m7-2', 3, 'offen'),
  abschnitt('m7-3', 5, 'offen'),
  abschnitt('m7-4', 7, 'beauftragt'),
  abschnitt('m7-5', 9, 'abgelehnt', { grund: 'reine Titelfolien' }),
];

describe('abdeckung - Repo', () => {
  it('zaehlt ein Prinzip mit gleichnamiger Lektion als abgedeckt, die anderen als offen', () => {
    const { bestand } = abdeckung(
      [repo('r', prinzip('lektion-a'), prinzip('fehlt-noch'), prinzip('lektion-b'))],
      KEINE_MANIFESTE,
      LEKTIONEN,
    );
    expect(bestand[0]?.zaehlung).toEqual({ gesamt: 3, mitLektion: 2, offen: 1, beauftragt: 0, abgelehnt: 0 });
    expect(bestand[0]?.zeilen.map((z) => [z.id, z.status, z.lektion])).toEqual([
      ['lektion-a', 'lektion', 'lektion-a'],
      ['fehlt-noch', 'offen', undefined],
      ['lektion-b', 'lektion', 'lektion-b'],
    ]);
  });

  it('nimmt den Satz als Zeile und den Kurznamen als Titel der Karte', () => {
    const { bestand } = abdeckung([repo('awesome', prinzip('p-1'), prinzip('p-2'))], KEINE_MANIFESTE, LEKTIONEN);
    expect(bestand[0]).toMatchObject({ quelle: 'awesome', art: 'repo', titel: 'awesome', stand: SHA });
    expect(bestand[0]?.zeilen[0]?.titel).toBe('Der Satz zu p-1.');
  });

  it('reicht den Vorbehalt eines Prinzips an seine Zeile weiter', () => {
    const { bestand } = abdeckung(
      [repo('r', prinzip('p-1', 'Nicht belegt.'), prinzip('p-2'))],
      KEINE_MANIFESTE,
      LEKTIONEN,
    );
    expect(bestand[0]?.zeilen.map((z) => z.vorbehalte)).toEqual([['Nicht belegt.'], []]);
  });
});

describe('abdeckung - Buch und Folien', () => {
  it('zaehlt die Abschnitte nach ihrem Status', () => {
    const { bestand } = abdeckung([lehrmaterial('folien', fuenf)], KEINE_MANIFESTE, LEKTIONEN);
    expect(bestand[0]?.zaehlung).toEqual({ gesamt: 5, mitLektion: 1, offen: 2, beauftragt: 1, abgelehnt: 1 });
  });

  it('uebernimmt Titel, Grund, Lektion, Datei und Seiten in die Zeile', () => {
    const { bestand } = abdeckung([lehrmaterial('folien', fuenf)], KEINE_MANIFESTE, LEKTIONEN);
    const [lektion, offen, , , abgelehnt] = bestand[0]?.zeilen ?? [];
    expect(lektion).toMatchObject({ titel: 'Titel m7-1', status: 'lektion', lektion: 'pauschal-heisst-nicht-komplett', datei: 'M7.pdf', seiten: [1, 2] });
    expect(offen?.lektion).toBeUndefined();
    expect(abgelehnt).toMatchObject({ status: 'abgelehnt', grund: 'reine Titelfolien' });
    expect(bestand[0]?.titel).toBe('Projektmanagement');
  });

  it('sammelt die Vorbehalte aller Prinzipien eines Abschnitts', () => {
    const mitDreien = abschnitt('m7-1', 1, 'offen', {
      prinzipien: [prinzip('p-1', 'Erster Vorbehalt.'), prinzip('p-2'), prinzip('p-3', 'Zweiter Vorbehalt.')],
    });
    const { bestand } = abdeckung([lehrmaterial('folien', [mitDreien])], KEINE_MANIFESTE, LEKTIONEN);
    expect(bestand[0]?.zeilen[0]?.vorbehalte).toEqual(['Erster Vorbehalt.', 'Zweiter Vorbehalt.']);
  });

  it('fuehrt ISBN und Auflage nur beim Buch', () => {
    const extra = { isbn: '978-3-658-00000-0', auflage: '3. Auflage' };
    const buch = abdeckung([lehrmaterial('buch', fuenf, extra)], KEINE_MANIFESTE, LEKTIONEN).bestand[0];
    const folien = abdeckung([lehrmaterial('folien', fuenf)], KEINE_MANIFESTE, LEKTIONEN).bestand[0];
    expect([buch?.isbn, buch?.auflage]).toEqual(['978-3-658-00000-0', '3. Auflage']);
    expect([folien?.isbn, folien?.auflage]).toEqual([undefined, undefined]);
  });
});

describe('abdeckung - Lektionen ohne Lehrplaneintrag', () => {
  it('nennt Lektionen, auf die kein Prinzip und kein Abschnitt zeigt — sortiert', () => {
    const lektionen = new Set(['z-lektion', 'lektion-a', 'a-lektion', 'pauschal-heisst-nicht-komplett']);
    const { ohneLehrplan } = abdeckung(
      [repo('r', prinzip('lektion-a'), prinzip('p-2')), lehrmaterial('folien', fuenf)],
      KEINE_MANIFESTE,
      lektionen,
    );
    expect(ohneLehrplan).toEqual(['a-lektion', 'z-lektion']);
  });

  it('fuehrt ohne Lehrplan jede Lektion als ohne Eintrag', () => {
    expect(abdeckung([], KEINE_MANIFESTE, new Set(['b', 'a']))).toEqual({ bestand: [], ohneLehrplan: ['a', 'b'] });
  });

  it('liefert fuer gar nichts gar nichts', () => {
    expect(abdeckung([], KEINE_MANIFESTE, new Set())).toEqual({ bestand: [], ohneLehrplan: [] });
  });
});

describe('abdeckung - was die Quelle nicht hergibt', () => {
  const git: Manifestauszug = { art: 'git', stand: SHA, uebernommen: 62, ausgelassen: 44 };
  const dokument: Manifestauszug = { art: 'dokument', stand: HASH, seiten: 35, nurBild: 7, tabellenverdacht: 2 };
  const luecken = (lehrplan: Lehrplan, manifeste: Map<string, Manifestauszug>) =>
    abdeckung([lehrplan], manifeste, LEKTIONEN).bestand[0]?.luecken;
  const einRepo = () => repo('awesome', prinzip('p-1'), prinzip('p-2'));

  it('fehlt, wenn es kein Manifest gibt — so baut GitHub', () => {
    expect(luecken(einRepo(), new Map())).toEqual({ art: 'fehlt' });
  });

  it('sucht das Manifest unter dem Kurznamen der Quelle', () => {
    expect(luecken(einRepo(), new Map([['andere-quelle', git]]))).toEqual({ art: 'fehlt' });
  });

  it('nimmt die Summen aus dem Manifest, wenn der Stand stimmt', () => {
    expect(luecken(einRepo(), new Map([['awesome', git]]))).toEqual({ art: 'git', uebernommen: 62, ausgelassen: 44 });
  });

  it('zeigt keine Zahlen aus einem Manifest zu einem anderen Stand', () => {
    // Neu eingelesen, Lehrplan nicht nachgezogen: Die Zahlen gehoerten zu
    // einem Bestand, den diese Seite gar nicht zeigt.
    const anderer: Manifestauszug = { ...git, stand: 'ffffffffffffffffffffffffffffffffffffffff' };
    expect(luecken(einRepo(), new Map([['awesome', anderer]]))).toEqual({ art: 'anderer-stand' });
  });

  it('reicht den Grund eines unlesbaren Manifests weiter', () => {
    const kaputt: Manifestauszug = { art: 'unlesbar', grund: 'kein gültiges JSON' };
    expect(luecken(einRepo(), new Map([['awesome', kaputt]]))).toEqual({ art: 'unlesbar', grund: 'kein gültiges JSON' });
  });

  it('zaehlt bei Folien in Folien und beim Buch in Seiten', () => {
    const manifeste = new Map([['bauch-projektmanagement', dokument]]);
    expect(luecken(lehrmaterial('folien', fuenf), manifeste)).toEqual({
      art: 'dokument',
      einheit: 'folien',
      seiten: 35,
      nurBild: 7,
      tabellenverdacht: 2,
    });
    expect(luecken(lehrmaterial('buch', fuenf), manifeste)).toMatchObject({ art: 'dokument', einheit: 'seiten' });
  });

  it('nimmt ein Manifest der falschen Art nicht, auch bei gleichem Stand', () => {
    const gitMitHash: Manifestauszug = { ...git, stand: HASH };
    const dokumentMitSha: Manifestauszug = { ...dokument, stand: SHA };
    expect(luecken(lehrmaterial('folien', fuenf), new Map([['bauch-projektmanagement', gitMitHash]]))).toEqual({
      art: 'anderer-stand',
    });
    expect(luecken(einRepo(), new Map([['awesome', dokumentMitSha]]))).toEqual({ art: 'anderer-stand' });
  });
});

describe('abdeckung - Reihenfolge', () => {
  it('sortiert die Karten nach Kurzname, unabhaengig von der Eingabe', () => {
    const { bestand } = abdeckung(
      [repo('zeta', prinzip('p-1'), prinzip('p-2')), repo('alpha', prinzip('p-3'), prinzip('p-4'))],
      KEINE_MANIFESTE,
      LEKTIONEN,
    );
    expect(bestand.map((b) => b.quelle)).toEqual(['alpha', 'zeta']);
  });
});

describe('der heutige Bestand', () => {
  /**
   * Haelt fest, was am 2026-09-22 gemessen wurde: ein Lehrplan, sechs
   * Prinzipien, drei davon mit Lektion, und zwei Lektionen ohne
   * Lehrplaneintrag. Aendert sich der Bestand — eine neue Lektion, ein neuer
   * Lehrplan —, wird dieser Test nachgezogen, und der Commit sagt warum.
   *
   * Ohne Manifeste: `quellen/` ist gitignored, und dieser Test laeuft auch
   * dort, wo nicht eingelesen wurde. Was das Manifest beitraegt, prueft die
   * Abnahme am gebauten Stand.
   */
  it('stimmt mit dem ueberein, was gemessen wurde', () => {
    const wurzel = path.resolve(__dirname, '..');
    const lektionen = new Set(
      readdirSync(path.join(wurzel, 'inhalt', 'lektionen'))
        .filter((name) => name.endsWith('.mdx'))
        .map((name) => name.slice(0, -'.mdx'.length)),
    );
    const texte = Object.fromEntries(
      readdirSync(path.join(wurzel, 'lehrplan'))
        .filter((name) => name.endsWith('.yaml'))
        .map((name) => [`/lehrplan/${name}`, readFileSync(path.join(wurzel, 'lehrplan', name), 'utf8')]),
    );
    const { gueltig, wartend, ungueltig } = lehrplaeneAusTexten(texte, lektionen);
    expect(ungueltig).toEqual([]);
    expect(wartend).toEqual([]);

    const { bestand, ohneLehrplan } = abdeckung(gueltig, KEINE_MANIFESTE, lektionen);
    expect(bestand.map((b) => [b.quelle, b.art, b.freigabe])).toEqual([['awesome-llm-apps', 'repo', 'erteilt']]);
    expect(bestand[0]?.zaehlung).toEqual({ gesamt: 6, mitLektion: 3, offen: 3, beauftragt: 0, abgelehnt: 0 });
    expect(bestand[0]?.zeilen.filter((z) => z.status === 'lektion').map((z) => z.id)).toEqual([
      'kein-boden-ist-ein-boden',
      'kontrollfluss-folgt-modellstaerke',
      'auslagern-nimmt-die-grundlage',
    ]);
    expect(ohneLehrplan).toEqual(['pauschal-heisst-nicht-komplett', 'recall-vor-precision']);
  });
});

/**
 * Die Freigabe liest `abdeckung` am Lehrplan ab, nicht an einem zweiten
 * Parameter: `pruefeLehrplan` liefert einen wartenden Lehrplan mit leerem
 * `geprueftVon`, ein freigegebener hat dort einen Namen stehen.
 */
describe('abdeckung - Freigabe', () => {
  const lektionsAbschnitt = abschnitt('m7-1', 1, 'lektion', { lektion: 'pauschal-heisst-nicht-komplett' });
  const wartendeFolien = {
    art: 'folien',
    quelle: 'bauch-projektmanagement',
    titel: 'Projektmanagement',
    stand: HASH,
    geprueftVon: '',
    geprueftAm: '',
    abschnitte: [lektionsAbschnitt],
  };

  it('traegt erteilt, wo geprueftVon und geprueftAm stehen', () => {
    const { bestand } = abdeckung([repo('awesome', prinzip('p-1'), prinzip('p-2'))], KEINE_MANIFESTE, LEKTIONEN);
    expect(bestand[0]?.freigabe).toBe('erteilt');
  });

  it('traegt wartet, wo beide leer sind — und zaehlt die Abschnitte trotzdem', () => {
    const { bestand } = abdeckung([wartender(wartendeFolien)], KEINE_MANIFESTE, LEKTIONEN);
    expect(bestand[0]?.freigabe).toBe('wartet');
    expect(bestand[0]?.zaehlung).toEqual({ gesamt: 1, mitLektion: 1, offen: 0, beauftragt: 0, abgelehnt: 0 });
  });

  it('zaehlt die Lektion eines wartenden Lehrplans nicht zu denen ohne Lehrplaneintrag', () => {
    const { ohneLehrplan } = abdeckung([wartender(wartendeFolien)], KEINE_MANIFESTE, LEKTIONEN);
    expect(ohneLehrplan).toEqual(['lektion-a', 'lektion-b']);
  });

  /** Gemischter Bestand: ein Kurzname vor und einer nach dem wartenden Lehrplan zeigt, dass beide zusammen sortiert werden. */
  it('mischt einen freigegebenen und einen wartenden Lehrplan — sortiert, mit Freigabe je Karte', () => {
    const { bestand } = abdeckung(
      [repo('zeta', prinzip('p-1'), prinzip('p-2')), wartender(wartendeFolien)],
      KEINE_MANIFESTE,
      LEKTIONEN,
    );
    expect(bestand.map((b) => b.quelle)).toEqual(['bauch-projektmanagement', 'zeta']);
    expect(bestand.map((b) => b.freigabe)).toEqual(['wartet', 'erteilt']);
  });
});
