// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { SPERRE_GREIFT, sperre } from './hilfen/sperre';
import { lehrplanGeruest } from '../werkzeug/lehrplan-geruest.mjs';
import { baueDokumentManifest } from '../werkzeug/manifest.mjs';
import {
  PruefeQuelleFehler,
  fuehreAus,
  lehrplanFelder,
  pruefeNach,
  pruefeNachDateien,
  pruefeVor,
  pruefeVorDateien,
} from '../werkzeug/pruefe-quelle.mjs';
import { baueIndex, rohFolien } from '../werkzeug/wortlaut.mjs';

/**
 * Vor- und Nachpruefung eines Compiler-Durchgangs an Lehrmaterial.
 *
 * Kein Test liest lehrplan/, inhalt/ oder quellen/ im Repo: Lehrplaene und
 * Lektionen sind hier von Hand als Zeilen gebaut, Manifeste mit
 * `baueDokumentManifest` aus dem Einlesen selbst, und die Kommandozeile laeuft
 * gegen ein Temp-Verzeichnis. Die Saetze in Rohdatei, Lehrplaenen und
 * Lektionen sind erfunden.
 */

const K = 'fixture-quelle';
const STAND = `sha256:${'a'.repeat(64)}`;
const STEMPEL = '2026-09-25T08:00:00.000Z';
const AUFRUF = 'Aufruf: npm run pruefe-quelle -- --name <kurzname> --vor | --nach';

type Status = 'offen' | 'beauftragt' | 'lektion' | 'abgelehnt';
/** Ein Prinzip; was nicht gegeben ist, bekommt einen festen Text, ein Vorbehalt fehlt dann. */
type PrinzipSpec = { id: string; satz?: string; vorbehalt?: string; belege?: string[] };
type AbschnittSpec = {
  id: string;
  seiten: [number, number];
  status: Status;
  titel?: string;
  datei?: string;
  grund?: string;
  prinzipien?: (string | PrinzipSpec)[];
};

/** Der Satz, den ein Prinzip traegt, wenn nichts anderes gesagt ist. */
const PRINZIPSATZ = 'Ein Satz, der etwas behauptet.';

/** Drei Abschnitte eines Foliensatzes; der dritte hat nur eine Folie. */
const EINSTIEG = { id: 'm01-01-einstieg', seiten: [1, 10] as [number, number] };
const KOSTEN = { id: 'm01-02-kosten', seiten: [11, 20] as [number, number] };
const RISIKEN = { id: 'm01-03-risiken', seiten: [21, 21] as [number, number] };

/**
 * Ein Lehrplan aus Lehrmaterial, Zeile fuer Zeile wie das Geruest des Einlesens — freigegeben, wenn nichts anderes gesagt ist.
 * `freigabe` ersetzt die beiden Zeilen der Freigabe, etwa durch eine mit falscher Form oder durch keine.
 */
function lehrplanText({
  abschnitte,
  stand = STAND,
  freigegeben = true,
  freigabe = freigegeben
    ? ['geprueftVon: "Daniel Nobs"', 'geprueftAm: "2026-09-25"']
    : ['geprueftVon: ""', 'geprueftAm: ""'],
  quelle = K,
}: {
  abschnitte: AbschnittSpec[];
  stand?: string;
  freigegeben?: boolean;
  freigabe?: string[];
  quelle?: string;
}): string {
  const zeilen = [
    'art: folien',
    `quelle: "${quelle}"`,
    'titel: "Fixture Quelle"',
    `stand: "${stand}"`,
    ...freigabe,
    'abschnitte:',
  ];
  for (const a of abschnitte) {
    zeilen.push(
      `  - id: ${a.id}`,
      `    titel: "${a.titel ?? `Titel ${a.id}`}"`,
      `    datei: "${a.datei ?? 'M1.pdf'}"`,
      `    seiten: [${a.seiten[0]}, ${a.seiten[1]}]`,
      `    status: ${a.status}`,
    );
    if (a.grund !== undefined) zeilen.push(`    grund: "${a.grund}"`);
    if (a.prinzipien !== undefined) {
      zeilen.push('    prinzipien:');
      for (const eintrag of a.prinzipien) {
        const p = typeof eintrag === 'string' ? { id: eintrag } : eintrag;
        zeilen.push(
          `      - id: ${p.id}`,
          `        satz: "${p.satz ?? PRINZIPSATZ}"`,
          '        warumNichtOffensichtlich: "Weil das Gegenteil plausibel klingt."',
          `        belege: ${JSON.stringify(p.belege ?? [`roh/${a.id}.md, Folie ${a.seiten[0]}`])}`,
        );
        if (p.vorbehalt !== undefined) zeilen.push(`        vorbehalt: "${p.vorbehalt}"`);
      }
    }
  }
  return `${zeilen.join('\n')}\n`;
}

/** Ein Repo-Lehrplan mit den gegebenen Prinzip-Ids (das Schema verlangt mindestens zwei). */
function repoText(ids: string[]): string {
  const zeilen = [
    'art: repo',
    'quelle: "anderes-repo"',
    `stand: "${'c'.repeat(40)}"`,
    'geprueftVon: "Daniel Nobs"',
    'geprueftAm: "2026-09-25"',
    'prinzipien:',
    ...ids.flatMap((id) => [
      `  - id: ${id}`,
      '    satz: "Ein Satz."',
      '    warumNichtOffensichtlich: "Weil."',
      '    belege: ["README.md"]',
      '    widget: Pipeline',
    ]),
  ];
  return `${zeilen.join('\n')}\n`;
}

type RohSpec = { id: string; seiten: [number, number]; datei?: string; nurBild?: number[]; tabellenverdacht?: number[] };

/**
 * Das Manifest der Fassung 3, wie das Einlesen es schreibt. Nur der Stand ist
 * fest statt aus den Datei-Hashes gerechnet: So steht die Meldung zum Stand
 * woertlich im Test.
 */
function manifestText(roh: RohSpec[], stand = STAND): string {
  const dateien = [...new Set(roh.map((r) => r.datei ?? 'M1.pdf'))];
  const manifest = baueDokumentManifest({
    art: 'folien',
    originale: dateien.map((datei, i) => ({
      datei,
      dateiHash: `sha256:${String(i + 1).repeat(64)}`,
      seiten: 40,
      gliederung: 'agenda',
      beiwerkZeichen: 0,
    })),
    roh: roh.map((r) => ({
      id: r.id,
      datei: r.datei ?? 'M1.pdf',
      seiten: r.seiten,
      nurBild: r.nurBild ?? [],
      tabellenverdacht: r.tabellenverdacht ?? [],
    })),
    gestempeltAm: STEMPEL,
  });
  return JSON.stringify({ ...manifest, herkunft: { ...manifest.herkunft, stand } }, null, 2);
}

/** Das Manifest zu EINSTIEG, KOSTEN und RISIKEN; nur EINSTIEG hat Folien in den Listen. */
const MANIFEST = manifestText([
  { ...EINSTIEG, nurBild: [3], tabellenverdacht: [5, 7, 8] },
  KOSTEN,
  RISIKEN,
]);

/** Ein erfundener Satz: 16 Woerter, sechs verschiedene Funktionswoerter. */
const SATZ = 'Der Polier trägt jeden Abend die Stunden der Kolonne ein und meldet sie an das Büro.';

/** Die Rohdatei zu EINSTIEG, in der Form des Einlesens: Kopf, dann je Folie eine Marke. */
const ROH = ['# Titel m01-01-einstieg', '', 'M1.pdf, Folien 1–10', '', '', '— Folie 2 —', SATZ, ''].join('\n');

/** Der Index, den die Dateien-Schicht aus ROH unter quellen/fixture-quelle/roh/ baut. */
const INDEX = baueIndex([{ quelle: K, abschnitt: EINSTIEG.id, folien: rohFolien(ROH) }]);

/** Der Mangel zu SATZ im Feld `feld` des Lehrplans: alle 16 Woerter, wie in Folie 2 von ROH. */
function lehrplanAbschrift(feld: string): string {
  return `lehrplan/fixture-quelle.yaml: Wortlaut: 13 Wörter am Stück wie in fixture-quelle/m01-01-einstieg, Folie 2 — Feld ${feld}, Wörter 1–16.`;
}

/** Eine Lektion mit dem gegebenen Rumpf; ohne `kopf` traegt ihr Frontmatter nur den Titel. */
function lektion(rumpf: string, kopf: string[] = ['titel: "Eine Lektion"']): string {
  return ['---', ...kopf, '---', '', rumpf, ''].join('\n');
}

/** Eine Lektion zu einem Prinzip: `prinzip` ist der gegebene Satz, `vorbehalt` steht nur da, wenn er gegeben ist. */
function lektionZu(prinzip: string, vorbehalt?: string): string {
  const kopf = ['titel: "Eine Lektion"', `prinzip: "${prinzip}"`];
  if (vorbehalt !== undefined) kopf.push(`vorbehalt: "${vorbehalt}"`);
  return lektion('Ein eigener Absatz, der die Regel in anderen Worten erklärt.', kopf);
}

type VorEingabe = Parameters<typeof pruefeVor>[0];
type NachEingabe = Parameters<typeof pruefeNach>[0];

/**
 * pruefeVor mit passendem Manifest, ohne Lektionen und ohne andere Lehrplaene, soweit der Test nichts anderes sagt.
 * MANIFEST traegt alle drei Abschnitte; ein Lehrplan, der gegen es gehalten wird, fuehrt sie deshalb alle — wie nach dem Einlesen.
 * Der leere Index heisst: Rohdateien da, nichts gefunden.
 */
function vor(eingabe: Partial<VorEingabe> & Pick<VorEingabe, 'lehrplanText'>) {
  return pruefeVor({
    kurzname: K,
    manifestText: MANIFEST,
    lektionsIds: new Set<string>(),
    lektionen: new Map(),
    index: new Map(),
    andere: [],
    ...eingabe,
  });
}

/** pruefeNach mit geprueftem, sauberem Wortlaut (leerer Index), ohne Lektionstexte und ohne andere Lehrplaene, soweit der Test nichts anderes sagt. */
function nach(eingabe: Partial<NachEingabe> & Pick<NachEingabe, 'lehrplanText'>) {
  return pruefeNach({
    kurzname: K,
    lektionsIds: new Set<string>(),
    lektionen: new Map(),
    index: new Map(),
    andere: [],
    ...eingabe,
  });
}

describe('pruefeVor', () => {
  // 1
  it('gibt bei freigegebenem Lehrplan und passendem Manifest den Auftrag mit Rohpfad und den Listen aus dem Manifest', () => {
    const ergebnis = vor({
      lehrplanText: lehrplanText({
        abschnitte: [
          { ...EINSTIEG, status: 'beauftragt' },
          { ...KOSTEN, status: 'offen' },
          { ...RISIKEN, status: 'abgelehnt', grund: 'Nur eine Titelfolie.' },
        ],
      }),
    });
    expect(ergebnis).toEqual({
      ok: true,
      maengel: [],
      auftrag: [
        {
          id: 'm01-01-einstieg',
          titel: 'Titel m01-01-einstieg',
          datei: 'M1.pdf',
          seiten: [1, 10],
          roh: 'quellen/fixture-quelle/roh/m01-01-einstieg.md',
          nurBild: [3],
          tabellenverdacht: [5, 7, 8],
        },
      ],
    });
  });

  // 2
  it('verlangt die Freigabe', () => {
    const ergebnis = vor({
      lehrplanText: lehrplanText({
        freigegeben: false,
        abschnitte: [
          { ...EINSTIEG, status: 'beauftragt' },
          { ...KOSTEN, status: 'offen' },
          { ...RISIKEN, status: 'offen' },
        ],
      }),
    });
    expect(ergebnis).toEqual({
      ok: false,
      maengel: ['Erst freigeben: lehrplan/fixture-quelle.yaml wartet auf Freigabe (geprueftVon und geprueftAm).'],
      auftrag: [],
    });
  });

  it('meldet bei einem frisch eingelesenen Lehrplan alles auf einmal: Freigabe und Auftrag', () => {
    const ergebnis = vor({
      lehrplanText: lehrplanText({
        freigegeben: false,
        abschnitte: [
          { ...EINSTIEG, status: 'offen' },
          { ...KOSTEN, status: 'offen' },
          { ...RISIKEN, status: 'offen' },
        ],
      }),
    });
    expect(ergebnis.maengel).toEqual([
      'Erst freigeben: lehrplan/fixture-quelle.yaml wartet auf Freigabe (geprueftVon und geprueftAm).',
      'Kein Abschnitt ist beauftragt — erst npm run auftrag.',
    ]);
  });

  // 3
  it('meldet einen anderen Stand mit beiden Kurzstaenden und haelt dann keinen Abschnitt gegen das Manifest', () => {
    const ergebnis = vor({
      lehrplanText: lehrplanText({
        stand: `sha256:${'b'.repeat(64)}`,
        // Ein Abschnitt, den das Manifest nicht kennt: Bei anderem Stand ist das keine eigene Meldung wert.
        // Ebenso wenig die beiden, die nur im Manifest stehen (m01-02-kosten, m01-03-risiken).
        abschnitte: [{ ...EINSTIEG, status: 'beauftragt' }, { id: 'm01-09-gibt-es-nicht', seiten: [30, 31], status: 'offen' }],
      }),
    });
    expect(ergebnis).toEqual({
      ok: false,
      maengel: [
        'Der Stand im Lehrplan (sha256:bbbbbbb) passt nicht zum Manifest (sha256:aaaaaaa) — neu eingelesen? Dann den Lehrplan nachziehen.',
      ],
      auftrag: [],
    });
  });

  // 4
  it('meldet einen Abschnitt, der nicht im Manifest steht', () => {
    const ergebnis = vor({
      lehrplanText: lehrplanText({
        abschnitte: [
          { ...EINSTIEG, status: 'beauftragt' },
          { ...KOSTEN, status: 'offen' },
          { ...RISIKEN, status: 'offen' },
          { id: 'm01-09-gibt-es-nicht', seiten: [30, 31], status: 'offen' },
        ],
      }),
    });
    expect(ergebnis.maengel).toEqual(['Abschnitt m01-09-gibt-es-nicht steht nicht im Manifest.']);
    expect(ergebnis.ok).toBe(false);
  });

  it('verlangt die Datei bytegenau: zwei Leerzeichen im Lehrplan, eines im Manifest', () => {
    const ergebnis = vor({
      lehrplanText: lehrplanText({ abschnitte: [{ ...EINSTIEG, status: 'beauftragt', datei: 'M6  Zwei Leerzeichen.pdf' }] }),
      manifestText: manifestText([{ ...EINSTIEG, datei: 'M6 Zwei Leerzeichen.pdf' }]),
    });
    expect(ergebnis).toEqual({
      ok: false,
      maengel: ['Abschnitt m01-01-einstieg: die Datei "M6  Zwei Leerzeichen.pdf" steht nicht im Manifest.'],
      auftrag: [],
    });
  });

  // Dieselben PDF mit anderer Gliederung neu eingelesen: Der Stand bleibt, Manifest und Rohdateien sind neu, der Lehrplan alt.
  it('meldet bei gleichem Stand Seiten, die im Manifest anders stehen — bei anderem Stand nur den Stand', () => {
    const abschnitte: AbschnittSpec[] = [
      { ...EINSTIEG, seiten: [1, 8], status: 'beauftragt' },
      { ...KOSTEN, status: 'offen' },
      { ...RISIKEN, status: 'offen' },
    ];
    expect(vor({ lehrplanText: lehrplanText({ abschnitte }) })).toEqual({
      ok: false,
      maengel: [
        'Abschnitt m01-01-einstieg: seiten [1, 8] im Lehrplan, [1, 10] im Manifest — neu eingelesen? Dann den Lehrplan nachziehen.',
      ],
      auftrag: [],
    });
    expect(vor({ lehrplanText: lehrplanText({ abschnitte, stand: `sha256:${'b'.repeat(64)}` }) }).maengel).toEqual([
      'Der Stand im Lehrplan (sha256:bbbbbbb) passt nicht zum Manifest (sha256:aaaaaaa) — neu eingelesen? Dann den Lehrplan nachziehen.',
    ]);
  });

  it('meldet bei gleichem Stand einen Abschnitt, der im Manifest steht, aber nicht im Lehrplan', () => {
    const ergebnis = vor({
      lehrplanText: lehrplanText({
        abschnitte: [
          { ...EINSTIEG, status: 'beauftragt' },
          { ...RISIKEN, status: 'offen' },
        ],
      }),
    });
    expect(ergebnis).toEqual({
      ok: false,
      maengel: [
        'Abschnitt m01-02-kosten steht im Manifest, aber nicht im Lehrplan — neu eingelesen? Dann den Lehrplan nachziehen.',
      ],
      auftrag: [],
    });
  });

  // 5
  it('verlangt mindestens einen beauftragten Abschnitt', () => {
    const ergebnis = vor({
      lehrplanText: lehrplanText({
        abschnitte: [
          { ...EINSTIEG, status: 'offen' },
          { ...KOSTEN, status: 'abgelehnt', grund: 'Nur Bildbeispiele ohne Aussage.' },
          { ...RISIKEN, status: 'offen' },
        ],
      }),
    });
    expect(ergebnis).toEqual({ ok: false, maengel: ['Kein Abschnitt ist beauftragt — erst npm run auftrag.'], auftrag: [] });
  });

  // 6
  it('weist einen Repo-Lehrplan ab, auch einen ungueltigen', () => {
    const satz = 'pruefe-quelle gilt für Lehrmaterial; lehrplan/fixture-quelle.yaml trägt art: repo.';
    expect(vor({ lehrplanText: repoText(['p-eins', 'p-zwei']) })).toEqual({ ok: false, maengel: [satz], auftrag: [] });
    // Nur ein Prinzip: Das Schema weist den Lehrplan ab; gemeldet wird trotzdem nur, dass er ein Repo ist.
    expect(vor({ lehrplanText: repoText(['p-eins']) }).maengel).toEqual([satz]);
  });

  it('meldet einen fehlenden Lehrplan, ein fehlendes und ein unlesbares Manifest', () => {
    expect(vor({ lehrplanText: null })).toEqual({
      ok: false,
      maengel: ['lehrplan/fixture-quelle.yaml gibt es nicht — erst einlesen.'],
      auftrag: [],
    });

    const lehrplan = lehrplanText({ abschnitte: [{ ...EINSTIEG, status: 'beauftragt' }] });
    expect(vor({ lehrplanText: lehrplan, manifestText: null }).maengel).toEqual([
      'quellen/fixture-quelle/manifest.json gibt es nicht — erst einlesen.',
    ]);
    expect(vor({ lehrplanText: lehrplan, manifestText: '{ "fassung": 2 }' }).maengel).toEqual([
      'quellen/fixture-quelle/manifest.json lässt sich nicht lesen (Fassung 2, erwartet 3).',
    ]);
  });

  it('meldet einen ungueltigen Lehrplan je Mangel mit dem Dateinamen davor', () => {
    const ohneGrund = vor({ lehrplanText: lehrplanText({ abschnitte: [{ ...EINSTIEG, status: 'abgelehnt' }] }) });
    expect(ohneGrund.maengel).toEqual([
      'lehrplan/fixture-quelle.yaml: abschnitte.0.grund: Ein abgelehnter Abschnitt braucht einen Grund.',
    ]);

    const kaputt = vor({ lehrplanText: 'art: folien\nabschnitte: [' });
    expect(kaputt.maengel).toHaveLength(1);
    expect(kaputt.maengel[0]).toMatch(
      /^lehrplan\/fixture-quelle\.yaml: Lehrplan ist kein gültiges YAML \(Zeile \d+, Spalte \d+\): /,
    );
  });

  it('meldet einen ungueltigen Lehrplan und einen Mangel am Manifest zusammen', () => {
    const ungueltig = lehrplanText({ abschnitte: [{ ...EINSTIEG, status: 'abgelehnt' }] });
    const mangel = 'lehrplan/fixture-quelle.yaml: abschnitte.0.grund: Ein abgelehnter Abschnitt braucht einen Grund.';
    expect(vor({ lehrplanText: ungueltig, manifestText: null })).toEqual({
      ok: false,
      maengel: [mangel, 'quellen/fixture-quelle/manifest.json gibt es nicht — erst einlesen.'],
      auftrag: [],
    });
    expect(vor({ lehrplanText: ungueltig, manifestText: '{' }).maengel).toEqual([
      mangel,
      'quellen/fixture-quelle/manifest.json lässt sich nicht lesen (kein gültiges JSON).',
    ]);
  });

  // 6a
  it('meldet eine Prinzip-Id, die ein anderer gueltiger oder wartender Lehrplan traegt; ein unlesbarer zaehlt nicht mit', () => {
    const ergebnis = vor({
      lehrplanText: lehrplanText({
        abschnitte: [
          { ...EINSTIEG, status: 'beauftragt', prinzipien: ['geteilte-id', 'wartende-id', 'eigene-id'] },
          { ...KOSTEN, status: 'offen' },
          { ...RISIKEN, status: 'offen' },
        ],
      }),
      andere: [
        { datei: 'lehrplan/anderer.yaml', text: repoText(['geteilte-id', 'nur-im-repo']) },
        { datei: 'lehrplan/kaputt.yaml', text: 'art: repo\nprinzipien: [\n  - id: eigene-id\n' },
        // Nur ein Prinzip: gueltiges YAML, aber das Schema weist ihn ab.
        { datei: 'lehrplan/ungueltig.yaml', text: repoText(['eigene-id']) },
        {
          datei: 'lehrplan/wartender.yaml',
          text: lehrplanText({
            quelle: 'wartende-quelle',
            freigegeben: false,
            abschnitte: [{ ...EINSTIEG, status: 'beauftragt', prinzipien: ['wartende-id'] }],
          }),
        },
      ],
    });
    expect(ergebnis).toEqual({
      ok: false,
      maengel: [
        'Prinzip geteilte-id: die Id steht schon in lehrplan/anderer.yaml; Lektion und Prinzip teilen sich die Id.',
        'Prinzip wartende-id: die Id steht schon in lehrplan/wartender.yaml; Lektion und Prinzip teilen sich die Id.',
      ],
      auftrag: [],
    });
  });

  it('zaehlt die Ids eines anderen Lehrplans mit, dem nur eine Lektion fehlt', () => {
    const ergebnis = vor({
      lehrplanText: lehrplanText({
        abschnitte: [
          { ...EINSTIEG, status: 'beauftragt', prinzipien: ['geteilte-id'] },
          { ...KOSTEN, status: 'offen' },
          { ...RISIKEN, status: 'offen' },
        ],
      }),
      // Der andere Lehrplan steht auf lektion, die Lektion geteilte-id gibt es aber nicht (lektionsIds ist leer):
      // Das Schema weist ihn ab, seine Id beansprucht er trotzdem.
      andere: [
        {
          datei: 'lehrplan/anderer.yaml',
          text: lehrplanText({
            quelle: 'andere-quelle',
            abschnitte: [{ ...EINSTIEG, status: 'lektion', prinzipien: ['geteilte-id'] }],
          }),
        },
      ],
    });
    expect(ergebnis.maengel).toEqual([
      'Prinzip geteilte-id: die Id steht schon in lehrplan/anderer.yaml; Lektion und Prinzip teilen sich die Id.',
    ]);
  });
});

describe('pruefeNach', () => {
  /** Alle drei Abschnitte entschieden; die Lektionen zu beiden Prinzipien gibt es. */
  const FERTIG = lehrplanText({
    abschnitte: [
      { ...EINSTIEG, status: 'lektion', prinzipien: ['erstes-prinzip', 'zweites-prinzip'] },
      { ...KOSTEN, status: 'abgelehnt', grund: 'Nur Bildbeispiele ohne Aussage.' },
      { ...RISIKEN, status: 'offen' },
    ],
  });
  const LEKTIONEN = new Set(['erstes-prinzip', 'zweites-prinzip']);

  // 7
  it('meldet einen Abschnitt, der noch auf beauftragt steht', () => {
    const ergebnis = nach({
      lehrplanText: lehrplanText({
        abschnitte: [
          { ...EINSTIEG, status: 'beauftragt', prinzipien: ['erstes-prinzip'] },
          { ...KOSTEN, status: 'lektion', prinzipien: ['zweites-prinzip'] },
        ],
      }),
      lektionsIds: LEKTIONEN,
    });
    expect(ergebnis).toEqual({
      ok: false,
      maengel: ['Abschnitt m01-01-einstieg steht noch auf beauftragt — jeder Abschnitt endet als lektion oder abgelehnt.'],
      hinweise: [],
    });
  });

  it('ist in Ordnung, wenn jeder Abschnitt entschieden ist und jede Lektion da', () => {
    expect(nach({ lehrplanText: FERTIG, lektionsIds: LEKTIONEN })).toEqual({ ok: true, maengel: [], hinweise: [] });
  });

  it('meldet eine fehlende Lektion als Mangel des Lehrplans', () => {
    const ergebnis = nach({ lehrplanText: FERTIG, lektionsIds: new Set(['erstes-prinzip']) });
    expect(ergebnis.maengel).toEqual([
      'lehrplan/fixture-quelle.yaml: abschnitte.0.prinzipien.1.id: Die Lektion zweites-prinzip gibt es nicht (inhalt/lektionen/zweites-prinzip.mdx).',
    ]);
    expect(ergebnis.ok).toBe(false);
  });

  it('meldet einen Wortlaut-Treffer je Lektion', () => {
    const ergebnis = nach({
      lehrplanText: FERTIG,
      lektionsIds: LEKTIONEN,
      lektionen: new Map([
        ['erstes-prinzip', lektion('Ein eigener Absatz, der die Regel in anderen Worten erklärt.')],
        ['zweites-prinzip', lektion(`Ein eigener Satz vorweg. ${SATZ}`)],
      ]),
      index: INDEX,
    });
    expect(ergebnis).toEqual({
      ok: false,
      maengel: [
        'Lektion zweites-prinzip: Wortlaut zu nah an der Quelle — npm run pruefe-lektion -- inhalt/lektionen/zweites-prinzip.mdx zeigt die Stelle.',
      ],
      hinweise: [],
    });
  });

  it('meldet die Lektion einer doppelten Id in einem ungueltigen Lehrplan einmal', () => {
    const zweimal = lehrplanText({ abschnitte: [{ ...EINSTIEG, status: 'lektion', prinzipien: ['x', 'x'] }] });
    const doppelt = 'lehrplan/fixture-quelle.yaml: abschnitte.0.prinzipien.1.id: Zwei Prinzipien haben die id x.';
    const mitLektion = (text: string) =>
      nach({ lehrplanText: zweimal, lektionsIds: new Set(['x']), lektionen: new Map([['x', text]]), index: INDEX });
    expect(mitLektion(lektion(`Ein eigener Satz vorweg. ${SATZ}`))).toEqual({
      ok: false,
      maengel: [
        doppelt,
        'Lektion x: Wortlaut zu nah an der Quelle — npm run pruefe-lektion -- inhalt/lektionen/x.mdx zeigt die Stelle.',
      ],
      hinweise: [],
    });
    // Ohne Abschrift keine Zeile zur Lektion.
    expect(mitLektion(lektion('Ein eigener Absatz, der die Regel in anderen Worten erklärt.')).maengel).toEqual([doppelt]);
  });

  it('sagt ohne Rohdateien „nicht geprueft" — ein Hinweis, kein Mangel', () => {
    expect(nach({ lehrplanText: FERTIG, lektionsIds: LEKTIONEN, index: null })).toEqual({
      ok: true,
      maengel: [],
      hinweise: ['Wortlaut nicht geprüft: keine Rohdateien am Rechner.'],
    });
  });

  it('meldet einen wartenden Lehrplan: Durchgang B beginnt erst nach der Freigabe', () => {
    const wartend = lehrplanText({
      freigegeben: false,
      abschnitte: [{ ...EINSTIEG, status: 'lektion', prinzipien: ['erstes-prinzip'] }],
    });
    expect(nach({ lehrplanText: wartend, lektionsIds: LEKTIONEN }).maengel).toEqual([
      'lehrplan/fixture-quelle.yaml wartet auf Freigabe — Durchgang B beginnt erst nach der Freigabe.',
    ]);
  });

  // 6a
  it('meldet eine Prinzip-Id, die ein anderer Lehrplan traegt, mit demselben Satz wie pruefeVor', () => {
    const ergebnis = nach({
      lehrplanText: FERTIG,
      lektionsIds: LEKTIONEN,
      andere: [
        { datei: 'lehrplan/anderer.yaml', text: repoText(['zweites-prinzip', 'nur-im-repo']) },
        { datei: 'lehrplan/kaputt.yaml', text: 'art: repo\nprinzipien: [\n  - id: erstes-prinzip\n' },
      ],
    });
    expect(ergebnis.maengel).toEqual([
      'Prinzip zweites-prinzip: die Id steht schon in lehrplan/anderer.yaml; Lektion und Prinzip teilen sich die Id.',
    ]);
  });

  it('meldet einen fehlenden Lehrplan und weist einen Repo-Lehrplan ab wie pruefeVor', () => {
    expect(nach({ lehrplanText: null }).maengel).toEqual(['lehrplan/fixture-quelle.yaml gibt es nicht — erst einlesen.']);
    expect(nach({ lehrplanText: repoText(['p-eins', 'p-zwei']) }).maengel).toEqual([
      'pruefe-quelle gilt für Lehrmaterial; lehrplan/fixture-quelle.yaml trägt art: repo.',
    ]);
  });
});

describe('lehrplanFelder', () => {
  it('liest grund und die Texte der Prinzipien, benannt nach der Id, ohne Titel, Ids und die Felder oben', () => {
    const text = [
      'art: folien',
      `quelle: "${K}"`,
      'titel: "Titel des Lehrplans"',
      `stand: "${STAND}"`,
      'geprueftVon: "Daniel Nobs"',
      'geprueftAm: "2026-09-25"',
      'abschnitte:',
      '  - id: m01-01-einstieg',
      '    titel: "Titel des ersten Abschnitts"',
      '    datei: "M1.pdf"',
      '    seiten: [1, 10]',
      '    status: abgelehnt',
      '    grund: "Nur eine Titelfolie."',
      '  - id: m01-02-kosten',
      '    titel: "Titel des zweiten Abschnitts"',
      '    datei: "M1.pdf"',
      '    seiten: [11, 20]',
      '    status: beauftragt',
      '    prinzipien:',
      '      - id: erstes-prinzip',
      '        satz: "Der Satz des Prinzips."',
      '        warumNichtOffensichtlich: "Das Warum des Prinzips."',
      '        belege: ["roh/m01-02-kosten.md, Folien 11–12", "VOB/B § 2 Abs. 7"]',
      '        widget: Pipeline',
      '        vorbehalt: "Der Vorbehalt des Prinzips."',
      '',
    ].join('\n');
    // Die Reihenfolge ist die des Lehrplans: vorbehalt steht hinter belege, widget faellt heraus.
    expect(lehrplanFelder(text)).toEqual([
      { feld: 'm01-01-einstieg.grund', text: 'Nur eine Titelfolie.' },
      { feld: 'erstes-prinzip.satz', text: 'Der Satz des Prinzips.' },
      { feld: 'erstes-prinzip.warumNichtOffensichtlich', text: 'Das Warum des Prinzips.' },
      { feld: 'erstes-prinzip.belege[0]', text: 'roh/m01-02-kosten.md, Folien 11–12' },
      { feld: 'erstes-prinzip.belege[1]', text: 'VOB/B § 2 Abs. 7' },
      { feld: 'erstes-prinzip.vorbehalt', text: 'Der Vorbehalt des Prinzips.' },
    ]);
  });

  it('liest jeden Text an Abschnitt und Prinzip in jeder Tiefe, auch in Feldern, die das Schema nicht kennt — erst den Abschnitt, dann seine Prinzipien', () => {
    const text = [
      'art: folien',
      'abschnitte:',
      '  - id: m01-01-einstieg',
      '    titel: "Titel des ersten Abschnitts"',
      '    notiz: "Eine Notiz am Abschnitt."',
      '    prinzipien:',
      '      - id: erstes-prinzip',
      '        satz: ["Ein Satz als Liste.", "Sein zweiter Teil."]',
      '        belege: "Ein Beleg als einzelner Text."',
      '        widget: { name: "Ein Widget als Eintrag." }',
      '        notiz:',
      '          warum: "Eine Notiz am Prinzip, eine Ebene tiefer."',
      '          id: "Eine Id in der Notiz."',
      '          liste: [["Ganz tief."], 7]',
      '    datei: "M1.pdf"',
      '    seiten: ["eins", "zehn"]',
      '    status: beauftragt',
      '    x: ["Ein Text in einer Liste.", 3]',
      '  - id: m01-02-kosten',
      '    grund: "Ein Grund."',
      '',
    ].join('\n');
    // x steht im YAML hinter den Prinzipien, gehoert aber zum Abschnitt: Es kommt vor ihnen.
    // Nur unter id, titel, datei, seiten, status und widget des Abschnitts oder Prinzips selbst liest es nicht.
    expect(lehrplanFelder(text)).toEqual([
      { feld: 'm01-01-einstieg.notiz', text: 'Eine Notiz am Abschnitt.' },
      { feld: 'm01-01-einstieg.x[0]', text: 'Ein Text in einer Liste.' },
      { feld: 'erstes-prinzip.satz[0]', text: 'Ein Satz als Liste.' },
      { feld: 'erstes-prinzip.satz[1]', text: 'Sein zweiter Teil.' },
      { feld: 'erstes-prinzip.belege', text: 'Ein Beleg als einzelner Text.' },
      { feld: 'erstes-prinzip.notiz.warum', text: 'Eine Notiz am Prinzip, eine Ebene tiefer.' },
      { feld: 'erstes-prinzip.notiz.id', text: 'Eine Id in der Notiz.' },
      { feld: 'erstes-prinzip.notiz.liste[0][0]', text: 'Ganz tief.' },
      { feld: 'm01-02-kosten.grund', text: 'Ein Grund.' },
    ]);
  });

  it('nennt ein Feld nach seiner Stelle, wenn die Id nicht dem Muster folgt oder schon vorn an einem anderen Feld steht', () => {
    const text = [
      'art: folien',
      'abschnitte:',
      '  - id: "Ein Satz als Id eines Abschnitts."',
      '    grund: "Ein Grund."',
      '    prinzipien:',
      '      - id: Erstes-Prinzip',
      '        satz: "Ein Satz unter einer Id mit Grossbuchstaben."',
      '      - id: doppelt',
      '        satz: "Der erste Satz."',
      '  - id: doppelt',
      '    grund: "Ein Abschnitt mit der Id eines Prinzips davor."',
      '    prinzipien:',
      '      - id: doppelt',
      '        satz: "Der zweite Satz."',
      '      - id: eigenes-prinzip',
      '        satz: "Ein eigener Satz."',
      '',
    ].join('\n');
    const felder = lehrplanFelder(text);
    expect(felder).toEqual([
      { feld: 'abschnitte[0].grund', text: 'Ein Grund.' },
      { feld: 'abschnitte[0].prinzipien[0].satz', text: 'Ein Satz unter einer Id mit Grossbuchstaben.' },
      { feld: 'doppelt.satz', text: 'Der erste Satz.' },
      { feld: 'abschnitte[1].grund', text: 'Ein Abschnitt mit der Id eines Prinzips davor.' },
      { feld: 'abschnitte[1].prinzipien[0].satz', text: 'Der zweite Satz.' },
      { feld: 'eigenes-prinzip.satz', text: 'Ein eigener Satz.' },
    ]);
    // Zwei gleiche Ids, keine gleichen Feldnamen.
    expect(new Set(felder.map(({ feld }) => feld)).size).toBe(felder.length);
  });

  it('liest auch einen Abschnitt oder ein Prinzip, das Text statt Eintrag ist, und prinzipien, die keine Liste sind', () => {
    const text = [
      'art: folien',
      'abschnitte:',
      '  - "Ein Abschnitt als Text."',
      '  - id: m01-02-kosten',
      '    prinzipien: "Prinzipien als Text."',
      '  - id: m01-03-risiken',
      '    prinzipien:',
      '      - "Ein Prinzip als Text."',
      '      - ["Ein Prinzip als Liste."]',
      '      - id: drittes-prinzip',
      '        satz: "Ein Satz."',
      '  - id: m01-04-termine',
      '    prinzipien:',
      '      satz: "Ein Prinzip ohne Liste davor."',
      '',
    ].join('\n');
    expect(lehrplanFelder(text)).toEqual([
      { feld: 'abschnitte[0]', text: 'Ein Abschnitt als Text.' },
      { feld: 'm01-02-kosten.prinzipien', text: 'Prinzipien als Text.' },
      { feld: 'abschnitte[2].prinzipien[0]', text: 'Ein Prinzip als Text.' },
      { feld: 'abschnitte[2].prinzipien[1][0]', text: 'Ein Prinzip als Liste.' },
      { feld: 'drittes-prinzip.satz', text: 'Ein Satz.' },
      { feld: 'm01-04-termine.prinzipien.satz', text: 'Ein Prinzip ohne Liste davor.' },
    ]);
  });

  it('liest Kommentare, ganze Zeilen und hinter einem Wert, zuletzt nach Zeile — eine Raute in Anfuehrungszeichen oder in einem Blocktext ist Text', () => {
    const zeilen = [
      '# Eine Kommentarzeile ganz oben.',
      'art: folien # Ein Kommentar hinter einem Wert.',
      'abschnitte:',
      '  - id: m01-01-einstieg',
      '    grund: "Ein Grund # mit Raute in Anfuehrungszeichen." # Und einer dahinter.',
      '    # Eine eingerueckte Kommentarzeile.',
      '    status: offen\t# Nach einem Tabulator.',
      '    prinzipien:',
      '      - id: erstes-prinzip',
      "        satz: 'Ein Satz # mit Raute in einfachen Anfuehrungszeichen.'",
      '        belege: ["Ein Beleg # mit Raute.", "Folie 3"] # Hinter einer Liste.',
      "        vorbehalt: Ein Vorbehalt ohne Anfuehrungszeichen, gibt's # Nach einem Apostroph.",
      '        warumNichtOffensichtlich: |',
      '          # Diese Zeile gehoert zum Text.',
      '',
    ];
    const erwartet = [
      { feld: 'm01-01-einstieg.grund', text: 'Ein Grund # mit Raute in Anfuehrungszeichen.' },
      { feld: 'erstes-prinzip.satz', text: 'Ein Satz # mit Raute in einfachen Anfuehrungszeichen.' },
      { feld: 'erstes-prinzip.belege[0]', text: 'Ein Beleg # mit Raute.' },
      { feld: 'erstes-prinzip.belege[1]', text: 'Folie 3' },
      { feld: 'erstes-prinzip.vorbehalt', text: "Ein Vorbehalt ohne Anfuehrungszeichen, gibt's" },
      { feld: 'erstes-prinzip.warumNichtOffensichtlich', text: '# Diese Zeile gehoert zum Text.\n' },
      { feld: 'kommentar[1]', text: ' Eine Kommentarzeile ganz oben.' },
      { feld: 'kommentar[2]', text: ' Ein Kommentar hinter einem Wert.' },
      { feld: 'kommentar[5]', text: ' Und einer dahinter.' },
      { feld: 'kommentar[6]', text: ' Eine eingerueckte Kommentarzeile.' },
      { feld: 'kommentar[7]', text: ' Nach einem Tabulator.' },
      { feld: 'kommentar[11]', text: ' Hinter einer Liste.' },
      { feld: 'kommentar[12]', text: ' Nach einem Apostroph.' },
    ];
    expect(lehrplanFelder(zeilen.join('\n'))).toEqual(erwartet);
    // Mit CRLF, wie in der Arbeitskopie unter Windows: dieselben Felder, dieselben Zeilen.
    expect(lehrplanFelder(zeilen.join('\r\n'))).toEqual(erwartet);
    // Ein BOM vorn verdeckt die erste Kommentarzeile nicht.
    expect(lehrplanFelder(String.fromCharCode(0xfeff) + zeilen.join('\n'))).toEqual(erwartet);
  });

  it('liest die Kopfzeilen, die das Einlesen schreibt, als Kommentare wie alle anderen', () => {
    const geruest = lehrplanGeruest({
      kurzname: K,
      titel: 'Fixture Quelle',
      stand: STAND,
      abschnitte: [{ ...EINSTIEG, titel: 'Titel m01-01-einstieg', datei: 'M1.pdf' }],
    });
    expect(lehrplanFelder(geruest).map(({ feld }) => feld)).toEqual(['kommentar[1]', 'kommentar[2]', 'kommentar[3]']);
  });

  it('nennt ein Feld ohne Id als Text nach seiner Stelle und liest nur Werte, die Text sind', () => {
    const text = [
      'art: folien',
      'abschnitte:',
      '  - titel: "Ein Abschnitt ohne Id"',
      '    grund: "Ein Grund ohne Id."',
      '  - id: 7',
      '    grund: "Ein Grund mit einer Zahl als Id."',
      '    prinzipien:',
      '      - satz: "Ein Satz ohne Id."',
      '        belege: ["Ein Beleg.", 42, "Noch ein Beleg."]',
      '      - id: [kein, text]',
      '        satz: 13',
      '        vorbehalt: "Ein Vorbehalt mit einer Liste als Id."',
      '  - id: m01-03-risiken',
      '    grund: 12',
      '    prinzipien:',
      '      - id: drittes-prinzip',
      '        warumNichtOffensichtlich: "Nur das Warum."',
      '',
    ].join('\n');
    expect(lehrplanFelder(text)).toEqual([
      { feld: 'abschnitte[0].grund', text: 'Ein Grund ohne Id.' },
      { feld: 'abschnitte[1].grund', text: 'Ein Grund mit einer Zahl als Id.' },
      { feld: 'abschnitte[1].prinzipien[0].satz', text: 'Ein Satz ohne Id.' },
      { feld: 'abschnitte[1].prinzipien[0].belege[0]', text: 'Ein Beleg.' },
      { feld: 'abschnitte[1].prinzipien[0].belege[2]', text: 'Noch ein Beleg.' },
      { feld: 'abschnitte[1].prinzipien[1].vorbehalt', text: 'Ein Vorbehalt mit einer Liste als Id.' },
      { feld: 'drittes-prinzip.warumNichtOffensichtlich', text: 'Nur das Warum.' },
    ]);
  });

  it('gibt ohne YAML keine Felder, auch keine Kommentare, und ohne Abschnitte keine', () => {
    expect(lehrplanFelder('art: folien\nabschnitte: [')).toEqual([]);
    // Ob eine Raute einen Kommentar beginnt, weiss erst der YAML-Leser.
    expect(lehrplanFelder('# Ein Kommentar.\nart: folien\nabschnitte: [')).toEqual([]);
    expect(lehrplanFelder('')).toEqual([]);
    expect(lehrplanFelder('- eine Liste\n- statt eines Lehrplans\n')).toEqual([]);
    expect(lehrplanFelder('art: folien\nabschnitte: "kein Abschnitt"\n')).toEqual([]);
  });
});

describe('Wortlaut im Lehrplan', () => {
  /** Vor Durchgang B: EINSTIEG beauftragt mit dem Prinzip, KOSTEN wie gegeben, RISIKEN offen. */
  function vorB(prinzip: PrinzipSpec, kosten: AbschnittSpec = { ...KOSTEN, status: 'offen' }): string {
    return lehrplanText({
      abschnitte: [{ ...EINSTIEG, status: 'beauftragt', prinzipien: [prinzip] }, kosten, { ...RISIKEN, status: 'offen' }],
    });
  }

  /** Nach Durchgang B: EINSTIEG mit der Lektion zum Prinzip, KOSTEN wie gegeben, RISIKEN offen. */
  function nachB(
    prinzip: PrinzipSpec,
    kosten: AbschnittSpec = { ...KOSTEN, status: 'abgelehnt', grund: 'Nur Bildbeispiele ohne Aussage.' },
  ): string {
    return lehrplanText({
      abschnitte: [{ ...EINSTIEG, status: 'lektion', prinzipien: [prinzip] }, kosten, { ...RISIKEN, status: 'offen' }],
    });
  }

  const MIT_LEKTION = new Set(['erstes-prinzip']);

  it('meldet vor dem Durchgang eine Abschrift in satz, in grund und in belege, mit Feld und Wortbereich', () => {
    expect(vor({ lehrplanText: vorB({ id: 'erstes-prinzip', satz: SATZ }), index: INDEX })).toEqual({
      ok: false,
      maengel: [lehrplanAbschrift('erstes-prinzip.satz')],
      auftrag: [],
    });
    const imGrund = vorB({ id: 'erstes-prinzip' }, { ...KOSTEN, status: 'abgelehnt', grund: SATZ });
    expect(vor({ lehrplanText: imGrund, index: INDEX }).maengel).toEqual([lehrplanAbschrift('m01-02-kosten.grund')]);
    const imBeleg = vorB({ id: 'erstes-prinzip', belege: [SATZ, 'VOB/B § 2 Abs. 7'] });
    expect(vor({ lehrplanText: imBeleg, index: INDEX }).maengel).toEqual([lehrplanAbschrift('erstes-prinzip.belege[0]')]);
  });

  it('meldet nach dem Durchgang eine Abschrift in satz, in grund und in belege', () => {
    expect(nach({ lehrplanText: nachB({ id: 'erstes-prinzip', satz: SATZ }), lektionsIds: MIT_LEKTION, index: INDEX })).toEqual({
      ok: false,
      maengel: [lehrplanAbschrift('erstes-prinzip.satz')],
      hinweise: [],
    });
    const imGrund = nachB({ id: 'erstes-prinzip' }, { ...KOSTEN, status: 'abgelehnt', grund: SATZ });
    expect(nach({ lehrplanText: imGrund, lektionsIds: MIT_LEKTION, index: INDEX }).maengel).toEqual([
      lehrplanAbschrift('m01-02-kosten.grund'),
    ]);
    const imBeleg = nachB({ id: 'erstes-prinzip', belege: [SATZ] });
    expect(nach({ lehrplanText: imBeleg, lektionsIds: MIT_LEKTION, index: INDEX }).maengel).toEqual([
      lehrplanAbschrift('erstes-prinzip.belege[0]'),
    ]);
  });

  it('meldet nichts, wenn derselbe Text nur im titel steht', () => {
    const imTitel = { ...EINSTIEG, titel: SATZ };
    const vorher = lehrplanText({
      abschnitte: [{ ...imTitel, status: 'beauftragt' }, { ...KOSTEN, status: 'offen' }, { ...RISIKEN, status: 'offen' }],
    });
    expect(vor({ lehrplanText: vorher, index: INDEX }).ok).toBe(true);
    const nachher = lehrplanText({ abschnitte: [{ ...imTitel, status: 'lektion', prinzipien: ['erstes-prinzip'] }] });
    expect(nach({ lehrplanText: nachher, lektionsIds: MIT_LEKTION, index: INDEX })).toEqual({
      ok: true,
      maengel: [],
      hinweise: [],
    });
  });

  it('meldet eine Abschrift auch in einem ungueltigen Lehrplan, hinter dessen Maengeln', () => {
    const ohneGrund: AbschnittSpec = { ...KOSTEN, status: 'abgelehnt' };
    const grundFehlt = 'lehrplan/fixture-quelle.yaml: abschnitte.1.grund: Ein abgelehnter Abschnitt braucht einen Grund.';
    expect(vor({ lehrplanText: vorB({ id: 'erstes-prinzip', satz: SATZ }, ohneGrund), index: INDEX }).maengel).toEqual([
      grundFehlt,
      lehrplanAbschrift('erstes-prinzip.satz'),
    ]);
    const nachher = nachB({ id: 'erstes-prinzip', satz: SATZ }, ohneGrund);
    expect(nach({ lehrplanText: nachher, lektionsIds: MIT_LEKTION, index: INDEX }).maengel).toEqual([
      grundFehlt,
      lehrplanAbschrift('erstes-prinzip.satz'),
    ]);
  });

  it('meldet eine Abschrift in einem Feld, das das Schema nicht kennt, hinter dessen Mangel', () => {
    // Die erste Zeile status: offen gehoert zu KOSTEN, dem zweiten Abschnitt.
    const mitNotiz = vorB({ id: 'erstes-prinzip' }).replace('    status: offen\n', `    status: offen\n    notiz: "${SATZ}"\n`);
    expect(vor({ lehrplanText: mitNotiz, index: INDEX }).maengel).toEqual([
      'lehrplan/fixture-quelle.yaml: abschnitte.1: unbekanntes Feld: notiz.',
      lehrplanAbschrift('m01-02-kosten.notiz'),
    ]);
  });

  it('meldet eine Abschrift in einem Kommentar mit seiner Zeile, nach denen in den Feldern', () => {
    const oben = `# ${SATZ}\n${vorB({ id: 'erstes-prinzip' })}`;
    expect(vor({ lehrplanText: oben, index: INDEX })).toEqual({
      ok: false,
      maengel: [lehrplanAbschrift('kommentar[1]')],
      auftrag: [],
    });
    const dahinter = nachB({ id: 'erstes-prinzip' }).replace(`quelle: "${K}"\n`, `quelle: "${K}" # ${SATZ}\n`);
    expect(nach({ lehrplanText: dahinter, lektionsIds: MIT_LEKTION, index: INDEX })).toEqual({
      ok: false,
      maengel: [lehrplanAbschrift('kommentar[2]')],
      hinweise: [],
    });
    // Der Kommentar steht in Zeile 1, seine Meldung trotzdem hinter der zum satz.
    const beides = `# ${SATZ}\n${vorB({ id: 'erstes-prinzip', satz: SATZ })}`;
    expect(vor({ lehrplanText: beides, index: INDEX }).maengel).toEqual([
      lehrplanAbschrift('erstes-prinzip.satz'),
      lehrplanAbschrift('kommentar[1]'),
    ]);
  });

  it('verlangt ohne Rohdatei vor dem Durchgang das Einlesen, solange es ein Manifest gibt, und sagt danach nur „nicht geprueft"', () => {
    const vorher = vorB({ id: 'erstes-prinzip', satz: SATZ });
    expect(vor({ lehrplanText: vorher, index: null })).toEqual({
      ok: false,
      maengel: ['quellen/fixture-quelle/roh/ enthält keine Rohdatei — erst einlesen.'],
      auftrag: [],
    });
    // Ohne Manifest bleibt es bei dessen Mangel.
    expect(vor({ lehrplanText: vorher, index: null, manifestText: null }).maengel).toEqual([
      'quellen/fixture-quelle/manifest.json gibt es nicht — erst einlesen.',
    ]);
    expect(nach({ lehrplanText: nachB({ id: 'erstes-prinzip', satz: SATZ }), lektionsIds: MIT_LEKTION, index: null })).toEqual({
      ok: true,
      maengel: [],
      hinweise: ['Wortlaut nicht geprüft: keine Rohdateien am Rechner.'],
    });
  });

  it('stellt die Abschriften im Lehrplan hinter dessen uebrige Maengel und vor die der Lektionen', () => {
    expect(
      vor({
        lehrplanText: vorB({ id: 'erstes-prinzip', satz: SATZ }),
        index: INDEX,
        lektionsIds: MIT_LEKTION,
        lektionen: new Map([['erstes-prinzip', lektionZu('Ein anderer Satz.')]]),
        andere: [{ datei: 'lehrplan/anderer.yaml', text: repoText(['erstes-prinzip', 'nur-im-repo']) }],
      }).maengel,
    ).toEqual([
      'Prinzip erstes-prinzip: die Id steht schon in lehrplan/anderer.yaml; Lektion und Prinzip teilen sich die Id.',
      lehrplanAbschrift('erstes-prinzip.satz'),
      'Prinzip erstes-prinzip: inhalt/lektionen/erstes-prinzip.mdx hat einen anderen Satz — übernehmen heißt: ihr Satz; sonst eine andere Id.',
    ]);

    const nochBeauftragt = lehrplanText({
      abschnitte: [
        { ...EINSTIEG, status: 'lektion', prinzipien: [{ id: 'erstes-prinzip', satz: SATZ }, 'zweites-prinzip'] },
        { ...KOSTEN, status: 'beauftragt' },
      ],
    });
    expect(
      nach({
        lehrplanText: nochBeauftragt,
        lektionsIds: new Set(['erstes-prinzip', 'zweites-prinzip']),
        lektionen: new Map([
          ['erstes-prinzip', lektionZu('Ein anderer Satz.')],
          ['zweites-prinzip', lektion(`Ein eigener Satz vorweg. ${SATZ}`)],
        ]),
        index: INDEX,
      }).maengel,
    ).toEqual([
      'Abschnitt m01-02-kosten steht noch auf beauftragt — jeder Abschnitt endet als lektion oder abgelehnt.',
      lehrplanAbschrift('erstes-prinzip.satz'),
      'Lektion erstes-prinzip: prinzip ist nicht der Satz des Prinzips in lehrplan/fixture-quelle.yaml.',
      'Lektion zweites-prinzip: Wortlaut zu nah an der Quelle — npm run pruefe-lektion -- inhalt/lektionen/zweites-prinzip.mdx zeigt die Stelle.',
    ]);
  });
});

describe('Lektion und Prinzip', () => {
  /** Vor Durchgang B, die Lektion zum Prinzip schon da: eine uebernommene oder eine aus einem frueheren Durchgang. */
  function vorMit(prinzip: PrinzipSpec, text: string) {
    return vor({
      lehrplanText: lehrplanText({
        abschnitte: [
          { ...EINSTIEG, status: 'beauftragt', prinzipien: [prinzip] },
          { ...KOSTEN, status: 'offen' },
          { ...RISIKEN, status: 'offen' },
        ],
      }),
      lektionsIds: new Set([prinzip.id]),
      lektionen: new Map([[prinzip.id, text]]),
    });
  }

  /** Nach Durchgang B: EINSTIEG mit der Lektion zum Prinzip. */
  function nachMit(prinzip: PrinzipSpec, text: string) {
    return nach({
      lehrplanText: lehrplanText({ abschnitte: [{ ...EINSTIEG, status: 'lektion', prinzipien: [prinzip] }] }),
      lektionsIds: new Set([prinzip.id]),
      lektionen: new Map([[prinzip.id, text]]),
    });
  }

  const ANDERER_SATZ_VOR =
    'Prinzip uebernommen: inhalt/lektionen/uebernommen.mdx hat einen anderen Satz — übernehmen heißt: ihr Satz; sonst eine andere Id.';
  const ANDERER_VORBEHALT_VOR =
    'Prinzip uebernommen: der vorbehalt passt nicht zu inhalt/lektionen/uebernommen.mdx — die Lektion ändert nur der Mensch.';
  const ANDERER_SATZ_NACH = 'Lektion uebernommen: prinzip ist nicht der Satz des Prinzips in lehrplan/fixture-quelle.yaml.';
  const ANDERER_VORBEHALT_NACH = 'Lektion uebernommen: vorbehalt ist nicht der des Prinzips in lehrplan/fixture-quelle.yaml.';

  it('laesst eine Lektion mit dem Satz und dem Vorbehalt ihres Prinzips durch', () => {
    const ohne = { id: 'uebernommen' };
    expect(vorMit(ohne, lektionZu(PRINZIPSATZ)).ok).toBe(true);
    expect(nachMit(ohne, lektionZu(PRINZIPSATZ))).toEqual({ ok: true, maengel: [], hinweise: [] });
    const mit = { id: 'uebernommen', vorbehalt: 'Ein Vorbehalt.' };
    expect(vorMit(mit, lektionZu(PRINZIPSATZ, 'Ein Vorbehalt.')).maengel).toEqual([]);
    expect(nachMit(mit, lektionZu(PRINZIPSATZ, 'Ein Vorbehalt.')).maengel).toEqual([]);
  });

  it('meldet einen anderen Satz vor und nach dem Durchgang', () => {
    const prinzip = { id: 'uebernommen' };
    expect(vorMit(prinzip, lektionZu('Ein anderer Satz.'))).toEqual({ ok: false, maengel: [ANDERER_SATZ_VOR], auftrag: [] });
    expect(nachMit(prinzip, lektionZu('Ein anderer Satz.'))).toEqual({ ok: false, maengel: [ANDERER_SATZ_NACH], hinweise: [] });
  });

  it('meldet einen Vorbehalt, den nur das Prinzip traegt', () => {
    const prinzip = { id: 'uebernommen', vorbehalt: 'Ein Vorbehalt.' };
    expect(vorMit(prinzip, lektionZu(PRINZIPSATZ)).maengel).toEqual([ANDERER_VORBEHALT_VOR]);
    expect(nachMit(prinzip, lektionZu(PRINZIPSATZ)).maengel).toEqual([ANDERER_VORBEHALT_NACH]);
  });

  it('meldet einen Vorbehalt, den nur die Lektion traegt', () => {
    const prinzip = { id: 'uebernommen' };
    expect(vorMit(prinzip, lektionZu(PRINZIPSATZ, 'Ein Vorbehalt.')).maengel).toEqual([ANDERER_VORBEHALT_VOR]);
    expect(nachMit(prinzip, lektionZu(PRINZIPSATZ, 'Ein Vorbehalt.')).maengel).toEqual([ANDERER_VORBEHALT_NACH]);
  });

  it('meldet einen anderen Satz und einen anderen Vorbehalt zusammen', () => {
    const prinzip = { id: 'uebernommen', vorbehalt: 'Ein Vorbehalt.' };
    const text = lektionZu('Ein anderer Satz.', 'Ein anderer Vorbehalt.');
    expect(vorMit(prinzip, text).maengel).toEqual([ANDERER_SATZ_VOR, ANDERER_VORBEHALT_VOR]);
    expect(nachMit(prinzip, text).maengel).toEqual([ANDERER_SATZ_NACH, ANDERER_VORBEHALT_NACH]);
  });

  it('zaehlt Leerraum am Rand nicht, und fehlend, null und leer heissen kein Vorbehalt', () => {
    const mitRand = { id: 'uebernommen', satz: `  ${PRINZIPSATZ} `, vorbehalt: ' Ein Vorbehalt.  ' };
    const text = lektionZu(` ${PRINZIPSATZ}   `, '   Ein Vorbehalt. ');
    expect(vorMit(mitRand, text).maengel).toEqual([]);
    expect(nachMit(mitRand, text).maengel).toEqual([]);

    const ohne = { id: 'uebernommen' };
    for (const zeile of ['vorbehalt:', 'vorbehalt: null', 'vorbehalt: ""', 'vorbehalt: "   "']) {
      const leer = lektion('Ein eigener Absatz.', ['titel: "Eine Lektion"', `prinzip: "${PRINZIPSATZ}"`, zeile]);
      expect(vorMit(ohne, leer).maengel).toEqual([]);
      expect(nachMit(ohne, leer).maengel).toEqual([]);
    }
  });

  it('vergleicht prinzip nur, wenn es Text ist — alles andere meldet pruefe-lektion', () => {
    const text = lektion('Ein eigener Absatz.', ['titel: "Eine Lektion"', 'prinzip: 42']);
    expect(vorMit({ id: 'uebernommen' }, text).maengel).toEqual([]);
    expect(nachMit({ id: 'uebernommen' }, text).maengel).toEqual([]);
  });

  it('uebergeht eine Lektion, deren Frontmatter sich nicht lesen laesst oder kein Objekt ist — das meldet pruefe-lektion', () => {
    // Das Prinzip traegt einen Vorbehalt: Wuerde eine dieser Lektionen verglichen, fehlte er ihr.
    const prinzip = { id: 'uebernommen', vorbehalt: 'Ein Vorbehalt.' };
    for (const text of [
      '---\nprinzip: "unbeendet\n---\nRumpf.\n',
      '---\nNur ein Satz im Kopf\n---\nRumpf.\n',
      '---\n- eine\n- Liste\n---\nRumpf.\n',
      'Nur Prosa, kein Frontmatter.\n',
    ]) {
      expect(vorMit(prinzip, text).maengel).toEqual([]);
      expect(nachMit(prinzip, text).maengel).toEqual([]);
    }
  });

  it('gleicht auch einen wartenden und einen ungueltigen Lehrplan ab', () => {
    const mitLektion = { lektionsIds: new Set(['uebernommen']), lektionen: new Map([['uebernommen', lektionZu('Ein anderer Satz.')]]) };
    const wartend = lehrplanText({
      freigegeben: false,
      abschnitte: [
        { ...EINSTIEG, status: 'beauftragt', prinzipien: ['uebernommen'] },
        { ...KOSTEN, status: 'offen' },
        { ...RISIKEN, status: 'offen' },
      ],
    });
    expect(vor({ lehrplanText: wartend, ...mitLektion }).maengel).toEqual([
      'Erst freigeben: lehrplan/fixture-quelle.yaml wartet auf Freigabe (geprueftVon und geprueftAm).',
      ANDERER_SATZ_VOR,
    ]);
    const ungueltig = lehrplanText({
      abschnitte: [
        { ...EINSTIEG, status: 'beauftragt', prinzipien: ['uebernommen'] },
        { ...KOSTEN, status: 'abgelehnt' },
        { ...RISIKEN, status: 'offen' },
      ],
    });
    expect(vor({ lehrplanText: ungueltig, ...mitLektion }).maengel).toEqual([
      'lehrplan/fixture-quelle.yaml: abschnitte.1.grund: Ein abgelehnter Abschnitt braucht einen Grund.',
      ANDERER_SATZ_VOR,
    ]);
  });

  // Der typische Fall: Nach Durchgang B fehlt eine Lektion, und das Schema weist den Lehrplan ab.
  it('gleicht nach dem Durchgang die uebrigen Lektionen ab, auch wenn eine fehlende den Lehrplan ungueltig macht', () => {
    const lehrplan = lehrplanText({
      abschnitte: [
        { ...EINSTIEG, status: 'lektion', prinzipien: [{ id: 'uebernommen', vorbehalt: 'Ein Vorbehalt.' }, 'fehlt-noch'] },
      ],
    });
    const lektionFehlt =
      'lehrplan/fixture-quelle.yaml: abschnitte.0.prinzipien.1.id: Die Lektion fehlt-noch gibt es nicht (inhalt/lektionen/fehlt-noch.mdx).';
    const mitLektion = (text: string) =>
      nach({ lehrplanText: lehrplan, lektionsIds: new Set(['uebernommen']), lektionen: new Map([['uebernommen', text]]) });
    expect(mitLektion(lektionZu('Ein anderer Satz.'))).toEqual({
      ok: false,
      maengel: [lektionFehlt, ANDERER_SATZ_NACH, ANDERER_VORBEHALT_NACH],
      hinweise: [],
    });
    // Passt die Lektion zu ihrem Prinzip, bleibt es beim Mangel des Lehrplans.
    expect(mitLektion(lektionZu(PRINZIPSATZ, 'Ein Vorbehalt.')).maengel).toEqual([lektionFehlt]);
  });

  it('gleicht in einem ungueltigen Lehrplan nur ab, was sich vergleichen laesst', () => {
    /** Die Zeilen eines Prinzips, roh — auch mit Werten, die das Schema abweist; warumNichtOffensichtlich und belege stimmen. */
    const roh = (id: string, ...felder: string[]) => [
      `      - id: ${id}`,
      ...felder.map((feld) => `        ${feld}`),
      '        warumNichtOffensichtlich: "Weil das Gegenteil plausibel klingt."',
      '        belege: ["roh/m01-01-einstieg.md, Folie 1"]',
    ];
    /** Vor Durchgang B: EINSTIEG beauftragt mit diesen Prinzipien, KOSTEN und RISIKEN offen. */
    const mitPrinzipien = (...prinzipien: string[][]) =>
      lehrplanText({
        abschnitte: [{ ...EINSTIEG, status: 'beauftragt' }, { ...KOSTEN, status: 'offen' }, { ...RISIKEN, status: 'offen' }],
      }).replace('    status: beauftragt\n', ['    status: beauftragt', '    prinzipien:', ...prinzipien.flat(), ''].join('\n'));
    const imLehrplan = (mangel: string) => `lehrplan/fixture-quelle.yaml: ${mangel}`;
    const SATZ_ZEILE = `satz: "${PRINZIPSATZ}"`;
    const faelle: { prinzipien: string[][]; zuLektion: [string, string]; maengel: string[] }[] = [
      // Die Id ist ein Satz: Die Lektion unter diesem Namen wird nicht verglichen, obwohl sie nicht passt.
      {
        prinzipien: [roh('Kein Muster', SATZ_ZEILE)],
        zuLektion: ['Kein Muster', lektionZu('Ein anderer Satz.', 'Ein Vorbehalt.')],
        maengel: [imLehrplan('abschnitte.0.prinzipien.0.id: nur Kleinbuchstaben, Ziffern und Bindestrich.')],
      },
      // satz ist kein Text: kein Vergleich des Satzes, wohl aber des Vorbehalts, den nur die Lektion traegt.
      {
        prinzipien: [roh('uebernommen', 'satz: 13')],
        zuLektion: ['uebernommen', lektionZu('Ein anderer Satz.', 'Ein Vorbehalt.')],
        maengel: [imLehrplan('abschnitte.0.prinzipien.0.satz: hat die falsche Form — erwartet Text.'), ANDERER_VORBEHALT_VOR],
      },
      // vorbehalt ist kein Text: kein Vergleich des Vorbehalts, wohl aber des Satzes.
      {
        prinzipien: [roh('uebernommen', SATZ_ZEILE, 'vorbehalt: [kein, Text]')],
        zuLektion: ['uebernommen', lektionZu('Ein anderer Satz.', 'Ein Vorbehalt.')],
        maengel: [
          imLehrplan('abschnitte.0.prinzipien.0.vorbehalt: Ein Vorbehalt ist Text — ohne Vorbehalt das Feld weglassen.'),
          ANDERER_SATZ_VOR,
        ],
      },
      // vorbehalt ohne Wert (null) und leer heissen: keiner — gegen einen in der Lektion ein anderer, gegen keinen derselbe.
      {
        prinzipien: [roh('uebernommen', SATZ_ZEILE, 'vorbehalt:')],
        zuLektion: ['uebernommen', lektionZu(PRINZIPSATZ, 'Ein Vorbehalt.')],
        maengel: [
          imLehrplan('abschnitte.0.prinzipien.0.vorbehalt: Ein Vorbehalt ist Text — ohne Vorbehalt das Feld weglassen.'),
          ANDERER_VORBEHALT_VOR,
        ],
      },
      {
        prinzipien: [roh('uebernommen', SATZ_ZEILE, 'vorbehalt:')],
        zuLektion: ['uebernommen', lektionZu(PRINZIPSATZ)],
        maengel: [imLehrplan('abschnitte.0.prinzipien.0.vorbehalt: Ein Vorbehalt ist Text — ohne Vorbehalt das Feld weglassen.')],
      },
      {
        prinzipien: [roh('uebernommen', SATZ_ZEILE, 'vorbehalt: ""')],
        zuLektion: ['uebernommen', lektionZu(PRINZIPSATZ, 'Ein Vorbehalt.')],
        maengel: [
          imLehrplan('abschnitte.0.prinzipien.0.vorbehalt: Ein Vorbehalt braucht einen Satz — sonst das Feld weglassen.'),
          ANDERER_VORBEHALT_VOR,
        ],
      },
      // Zweimal dieselbe Id: verglichen wird nur mit dem ersten Prinzip, gemeldet einmal.
      {
        prinzipien: [roh('uebernommen', SATZ_ZEILE), roh('uebernommen', 'satz: "Ein zweiter Satz."')],
        zuLektion: ['uebernommen', lektionZu('Noch ein Satz.')],
        maengel: [imLehrplan('abschnitte.0.prinzipien.1.id: Zwei Prinzipien haben die id uebernommen.'), ANDERER_SATZ_VOR],
      },
    ];
    for (const { prinzipien, zuLektion: [id, text], maengel } of faelle) {
      const ergebnis = vor({ lehrplanText: mitPrinzipien(...prinzipien), lektionsIds: new Set([id]), lektionen: new Map([[id, text]]) });
      expect(ergebnis.maengel).toEqual(maengel);
    }
  });

  it('nennt vor dem Durchgang eine Lektion unter status lektion mit den Saetzen nach dem Durchgang, eine uebernommene mit denen zur Uebernahme', () => {
    const anders = lektionZu('Ein anderer Satz.', 'Ein Vorbehalt.');
    const lektionen = new Map([
      ['fertig', anders],
      ['uebernommen', anders],
    ]);
    const lektionsIds = new Set(['fertig', 'uebernommen']);
    // Unter status lektion: fertig aus einem frueheren Durchgang. Eine andere Id liesse sie ohne Lehrplaneintrag zurueck.
    const fertig = [
      'Lektion fertig: prinzip ist nicht der Satz des Prinzips in lehrplan/fixture-quelle.yaml.',
      'Lektion fertig: vorbehalt ist nicht der des Prinzips in lehrplan/fixture-quelle.yaml.',
    ];
    const lesbar = lehrplanText({
      abschnitte: [
        { ...EINSTIEG, status: 'lektion', prinzipien: ['fertig'] },
        { ...KOSTEN, status: 'beauftragt', prinzipien: ['uebernommen'] },
        { ...RISIKEN, status: 'offen' },
      ],
    });
    expect(vor({ lehrplanText: lesbar, lektionsIds, lektionen })).toEqual({
      ok: false,
      maengel: [...fertig, ANDERER_SATZ_VOR, ANDERER_VORBEHALT_VOR],
      auftrag: [],
    });
    // Dasselbe in einem ungueltigen Lehrplan: Unter status lektion fehlt die Lektion fehlt-noch.
    const ungueltig = lehrplanText({
      abschnitte: [
        { ...EINSTIEG, status: 'lektion', prinzipien: ['fertig', 'fehlt-noch'] },
        { ...KOSTEN, status: 'beauftragt', prinzipien: ['uebernommen'] },
        { ...RISIKEN, status: 'offen' },
      ],
    });
    expect(vor({ lehrplanText: ungueltig, lektionsIds, lektionen }).maengel).toEqual([
      'lehrplan/fixture-quelle.yaml: abschnitte.0.prinzipien.1.id: Die Lektion fehlt-noch gibt es nicht (inhalt/lektionen/fehlt-noch.mdx).',
      ...fertig,
      ANDERER_SATZ_VOR,
      ANDERER_VORBEHALT_VOR,
    ]);
  });
});

describe('Freigabe neben anderen Maengeln', () => {
  /** Die Freigabe leer — fehlend, null oder nur Leerraum — in beiden Feldern. */
  const LEERE_FREIGABEN = [
    ['geprueftVon: ""', 'geprueftAm: ""'],
    ['geprueftVon: "  "', 'geprueftAm: " "'],
    ['geprueftVon:', 'geprueftAm:'],
    [],
  ];

  /** Ein Satz des Schemas zur Freigabe: Darin laese der Compiler, er solle sie fuellen. */
  const schemaSatzZurFreigabe = (mangel: string) => /^lehrplan\/fixture-quelle\.yaml: geprueft(Von|Am): /.test(mangel);

  /** Neben der Freigabe ein zweiter Mangel: ein abgelehnter Abschnitt ohne Grund. */
  const OHNE_GRUND: AbschnittSpec[] = [{ ...EINSTIEG, status: 'abgelehnt' }];
  const GRUND_FEHLT = 'lehrplan/fixture-quelle.yaml: abschnitte.0.grund: Ein abgelehnter Abschnitt braucht einen Grund.';

  it('sagt vor dem Durchgang zuerst „Erst freigeben", dann den weiteren Mangel — ohne die Saetze des Schemas zur Freigabe', () => {
    for (const freigabe of LEERE_FREIGABEN) {
      const { maengel } = vor({ lehrplanText: lehrplanText({ freigabe, abschnitte: OHNE_GRUND }) });
      expect(maengel).toEqual([
        'Erst freigeben: lehrplan/fixture-quelle.yaml wartet auf Freigabe (geprueftVon und geprueftAm).',
        GRUND_FEHLT,
      ]);
      expect(maengel.filter(schemaSatzZurFreigabe)).toEqual([]);
    }
  });

  it('laesst vor dem Durchgang die Saetze des Schemas stehen, wenn nur ein Feld leer ist oder eines falsche Form hat', () => {
    const nurAmLeer = lehrplanText({ freigabe: ['geprueftVon: "Daniel Nobs"', 'geprueftAm: ""'], abschnitte: OHNE_GRUND });
    expect(vor({ lehrplanText: nurAmLeer }).maengel).toEqual(['lehrplan/fixture-quelle.yaml: geprueftAm: ist leer.', GRUND_FEHLT]);
    const amAlsZahl = lehrplanText({ freigabe: ['geprueftVon: ""', 'geprueftAm: 20260925'], abschnitte: OHNE_GRUND });
    expect(vor({ lehrplanText: amAlsZahl }).maengel).toEqual([
      'lehrplan/fixture-quelle.yaml: geprueftVon: geprueftVon fehlt — der Lehrplan ist das Review-Gate.',
      'lehrplan/fixture-quelle.yaml: geprueftAm: hat die falsche Form — erwartet Text.',
      GRUND_FEHLT,
    ]);
  });

  it('sagt nach dem Durchgang zuerst „wartet auf Freigabe", dann den weiteren Mangel; nur ein leeres Feld behaelt den Satz des Schemas', () => {
    // Neben der Freigabe fehlt die Lektion zweites-prinzip.
    const abschnitte: AbschnittSpec[] = [{ ...EINSTIEG, status: 'lektion', prinzipien: ['erstes-prinzip', 'zweites-prinzip'] }];
    const lektionsIds = new Set(['erstes-prinzip']);
    const lektionFehlt =
      'lehrplan/fixture-quelle.yaml: abschnitte.0.prinzipien.1.id: Die Lektion zweites-prinzip gibt es nicht (inhalt/lektionen/zweites-prinzip.mdx).';
    for (const freigabe of LEERE_FREIGABEN) {
      const { maengel } = nach({ lehrplanText: lehrplanText({ freigabe, abschnitte }), lektionsIds });
      expect(maengel).toEqual([
        'lehrplan/fixture-quelle.yaml wartet auf Freigabe — Durchgang B beginnt erst nach der Freigabe.',
        lektionFehlt,
      ]);
      expect(maengel.filter(schemaSatzZurFreigabe)).toEqual([]);
    }
    const nurAmLeer = lehrplanText({ freigabe: ['geprueftVon: "Daniel Nobs"', 'geprueftAm: ""'], abschnitte });
    expect(nach({ lehrplanText: nurAmLeer, lektionsIds }).maengel).toEqual([
      'lehrplan/fixture-quelle.yaml: geprueftAm: ist leer.',
      lektionFehlt,
    ]);
  });
});

/** Ein Temp-Verzeichnis mit den gegebenen Dateien (Pfad relativ zur Wurzel -> Text). */
function wurzelMit(dateien: Record<string, string>): string {
  const wurzel = mkdtempSync(path.join(tmpdir(), 'kernbohrung-pruefe-quelle-'));
  for (const [pfad, text] of Object.entries(dateien)) {
    const ziel = path.join(wurzel, ...pfad.split('/'));
    mkdirSync(path.dirname(ziel), { recursive: true });
    writeFileSync(ziel, text, 'utf8');
  }
  return wurzel;
}

async function lauf(argv: string[], wurzel: string): Promise<{ code: number; zeilen: string[] }> {
  const zeilen: string[] = [];
  const code = await fuehreAus(argv, wurzel, (zeile: string) => zeilen.push(zeile));
  return { code, zeilen };
}

describe('fuehreAus --vor', () => {
  /** Vor Durchgang B: zwei Abschnitte beauftragt, einer schon mit Prinzip; daneben ein Repo-Lehrplan ohne gemeinsame Id. Noch ohne Rohdatei. */
  const OHNE_ROHDATEI = {
    [`lehrplan/${K}.yaml`]: lehrplanText({
      abschnitte: [
        { ...EINSTIEG, status: 'beauftragt', prinzipien: ['erstes-prinzip'] },
        { ...KOSTEN, status: 'offen' },
        { ...RISIKEN, status: 'beauftragt' },
      ],
    }),
    [`quellen/${K}/manifest.json`]: MANIFEST,
    'lehrplan/anderer.yaml': repoText(['nur-im-repo', 'auch-nur-im-repo']),
  };

  /** Dasselbe mit der Rohdatei zu EINSTIEG, wie sie das Einlesen neben das Manifest legt. */
  const VOR_B = { ...OHNE_ROHDATEI, [`quellen/${K}/roh/m01-01-einstieg.md`]: ROH };

  // 8
  it('nennt je beauftragtem Abschnitt Rohdatei, Folien und Listen, Exit 0', async () => {
    const wurzel = wurzelMit(VOR_B);
    try {
      const { code, zeilen } = await lauf(['--name', K, '--vor'], wurzel);
      expect(zeilen).toEqual([
        'lehrplan/fixture-quelle.yaml: freigegeben, Stand passt zum Manifest.',
        'Beauftragt: 2 Abschnitte',
        '  m01-01-einstieg — quellen/fixture-quelle/roh/m01-01-einstieg.md, Folien 1–10 · nur Bild: 3 · Tabelle oder Grafik: 5, 7, 8',
        '  m01-03-risiken — quellen/fixture-quelle/roh/m01-03-risiken.md, Folie 21 · nur Bild: – · Tabelle oder Grafik: –',
      ]);
      expect(code).toBe(0);
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });

  it('sagt „1 Abschnitt" in der Einzahl', async () => {
    const wurzel = wurzelMit({
      [`lehrplan/${K}.yaml`]: lehrplanText({
        abschnitte: [
          { ...EINSTIEG, status: 'offen' },
          { ...KOSTEN, status: 'beauftragt' },
          { ...RISIKEN, status: 'offen' },
        ],
      }),
      [`quellen/${K}/manifest.json`]: MANIFEST,
      [`quellen/${K}/roh/m01-01-einstieg.md`]: ROH,
    });
    try {
      const { code, zeilen } = await lauf(['--vor', '--name', K], wurzel);
      expect(zeilen).toEqual([
        'lehrplan/fixture-quelle.yaml: freigegeben, Stand passt zum Manifest.',
        'Beauftragt: 1 Abschnitt',
        '  m01-02-kosten — quellen/fixture-quelle/roh/m01-02-kosten.md, Folien 11–20 · nur Bild: – · Tabelle oder Grafik: –',
      ]);
      expect(code).toBe(0);
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });

  it('meldet Maengel je als eine Zeile, Exit 1', async () => {
    const leer = wurzelMit({});
    const ohneManifest = wurzelMit({ [`lehrplan/${K}.yaml`]: VOR_B[`lehrplan/${K}.yaml`] });
    const ohneRohdatei = wurzelMit(OHNE_ROHDATEI);
    // Rohdateien anderer Quellen ersetzen die eigenen nicht.
    const nurFremde = wurzelMit({ ...OHNE_ROHDATEI, 'quellen/andere-quelle/roh/x01-01-fremd.md': ROH });
    const geteilt = wurzelMit({ ...VOR_B, 'lehrplan/anderer.yaml': repoText(['erstes-prinzip', 'nur-im-repo']) });
    const ordnerStattDatei = wurzelMit({});
    mkdirSync(path.join(ordnerStattDatei, 'lehrplan', `${K}.yaml`), { recursive: true });
    try {
      for (const [wurzel, erwartet] of [
        [leer, ['lehrplan/fixture-quelle.yaml gibt es nicht — erst einlesen.']],
        [ohneManifest, ['quellen/fixture-quelle/manifest.json gibt es nicht — erst einlesen.']],
        [ohneRohdatei, ['quellen/fixture-quelle/roh/ enthält keine Rohdatei — erst einlesen.']],
        [nurFremde, ['quellen/fixture-quelle/roh/ enthält keine Rohdatei — erst einlesen.']],
        [
          geteilt,
          ['Prinzip erstes-prinzip: die Id steht schon in lehrplan/anderer.yaml; Lektion und Prinzip teilen sich die Id.'],
        ],
        // Den Lehrplan gibt es, nur lesen laesst er sich nicht: nicht „erst einlesen".
        [ordnerStattDatei, ['lehrplan/fixture-quelle.yaml lässt sich nicht lesen (EISDIR).']],
      ] as const) {
        const { code, zeilen } = await lauf(['--name', K, '--vor'], wurzel);
        expect(zeilen).toEqual(erwartet);
        expect(code).toBe(1);
      }
    } finally {
      for (const w of [leer, ohneManifest, ohneRohdatei, nurFremde, geteilt, ordnerStattDatei]) {
        rmSync(w, { recursive: true, force: true });
      }
    }
  });

  it('meldet einen Satz aus der Rohdatei, den der Lehrplan als satz traegt, mit Feld und Wortbereich, Exit 1', async () => {
    const wurzel = wurzelMit({
      ...VOR_B,
      [`lehrplan/${K}.yaml`]: lehrplanText({
        abschnitte: [
          { ...EINSTIEG, status: 'beauftragt', prinzipien: [{ id: 'erstes-prinzip', satz: SATZ }] },
          { ...KOSTEN, status: 'offen' },
          { ...RISIKEN, status: 'beauftragt' },
        ],
      }),
    });
    try {
      const { code, zeilen } = await lauf(['--name', K, '--vor'], wurzel);
      expect(zeilen).toEqual([
        'lehrplan/fixture-quelle.yaml: Wortlaut: 13 Wörter am Stück wie in fixture-quelle/m01-01-einstieg, Folie 2 — Feld erstes-prinzip.satz, Wörter 1–16.',
      ]);
      expect(code).toBe(1);
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });

  it('meldet eine vorhandene Lektion zum Prinzip, die einen anderen Satz traegt, Exit 1', async () => {
    const wurzel = wurzelMit({ ...VOR_B, 'inhalt/lektionen/erstes-prinzip.mdx': lektionZu('Ein anderer Satz.') });
    try {
      const { code, zeilen } = await lauf(['--name', K, '--vor'], wurzel);
      expect(zeilen).toEqual([
        'Prinzip erstes-prinzip: inhalt/lektionen/erstes-prinzip.mdx hat einen anderen Satz — übernehmen heißt: ihr Satz; sonst eine andere Id.',
      ]);
      expect(code).toBe(1);
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });

  // Uebersaehe sonst still eine Doppelung mit ihm.
  it.runIf(SPERRE_GREIFT)('bricht ab, wenn sich ein anderer Lehrplan nicht lesen laesst, Exit 1', async () => {
    const wurzel = wurzelMit(VOR_B);
    const gesperrt = sperre(path.join(wurzel, 'lehrplan', 'anderer.yaml'));
    try {
      expect(await lauf(['--name', K, '--vor'], wurzel)).toEqual({
        code: 1,
        zeilen: [`lehrplan/anderer.yaml lässt sich nicht lesen (${gesperrt.code}).`],
      });
    } finally {
      gesperrt.frei();
      rmSync(wurzel, { recursive: true, force: true });
    }
  });

  // Auch die Seite liest unter lehrplan/ nur Dateien.
  it('uebergeht einen Ordner, der wie ein anderer Lehrplan heisst', async () => {
    const ohneOrdner = wurzelMit(VOR_B);
    const mitOrdner = wurzelMit(VOR_B);
    mkdirSync(path.join(mitOrdner, 'lehrplan', 'ordner.yaml'));
    try {
      const ohne = await lauf(['--name', K, '--vor'], ohneOrdner);
      expect(await lauf(['--name', K, '--vor'], mitOrdner)).toEqual(ohne);
      expect(ohne.code).toBe(0);
    } finally {
      for (const w of [ohneOrdner, mitOrdner]) rmSync(w, { recursive: true, force: true });
    }
  });

  it.runIf(SPERRE_GREIFT)('meldet einen Ordner lehrplan/, der sich nicht auflisten laesst, als Satz, Exit 1', async () => {
    const wurzel = wurzelMit(VOR_B);
    const gesperrt = sperre(path.join(wurzel, 'lehrplan'));
    try {
      expect(await lauf(['--name', K, '--vor'], wurzel)).toEqual({
        code: 1,
        zeilen: [`lehrplan lässt sich nicht lesen (${gesperrt.code}).`],
      });
    } finally {
      gesperrt.frei();
      rmSync(wurzel, { recursive: true, force: true });
    }
  });
});

describe('fuehreAus --nach', () => {
  /** Nach Durchgang B: EINSTIEG hat seine Lektion, KOSTEN ist abgelehnt, RISIKEN nie beauftragt. */
  const NACH_B = {
    [`lehrplan/${K}.yaml`]: lehrplanText({
      abschnitte: [
        { ...EINSTIEG, status: 'lektion', prinzipien: ['stunden-taeglich-melden'] },
        { ...KOSTEN, status: 'abgelehnt', grund: 'Nur Bildbeispiele ohne Aussage.' },
        { ...RISIKEN, status: 'offen' },
      ],
    }),
    'inhalt/lektionen/stunden-taeglich-melden.mdx': lektion('Ein eigener Absatz, der die Regel in anderen Worten erklärt.'),
  };

  // 8
  it('meldet ohne Mangel: kein Abschnitt mehr beauftragt, alle Lektionen da, Wortlaut in Ordnung, Exit 0', async () => {
    const wurzel = wurzelMit({ ...NACH_B, [`quellen/${K}/roh/m01-01-einstieg.md`]: ROH });
    try {
      const { code, zeilen } = await lauf(['--name', K, '--nach'], wurzel);
      expect(zeilen).toEqual([
        'lehrplan/fixture-quelle.yaml: kein Abschnitt mehr beauftragt, alle Lektionen da, Wortlaut in Ordnung.',
      ]);
      expect(code).toBe(0);
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });

  it('sagt ohne Rohdateien nicht „Wortlaut in Ordnung", sondern „nicht geprueft", Exit 0', async () => {
    const wurzel = wurzelMit(NACH_B);
    try {
      const { code, zeilen } = await lauf(['--name', K, '--nach'], wurzel);
      expect(zeilen).toEqual([
        'lehrplan/fixture-quelle.yaml: kein Abschnitt mehr beauftragt, alle Lektionen da.',
        'Wortlaut nicht geprüft: keine Rohdateien am Rechner.',
      ]);
      expect(code).toBe(0);
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });

  it('sagt mit Rohdateien nur anderer Quellen „nicht geprueft", nicht „Wortlaut in Ordnung", Exit 0', async () => {
    const FREMD = { 'quellen/andere-quelle/roh/x01-01-fremd.md': ROH };
    // Gegen die eigene Vorlesung waere nie geprueft worden.
    const nurFremde = wurzelMit({ ...NACH_B, ...FREMD });
    // Der eigene Ordner roh/ ist da, aber ohne Rohdatei (*.md).
    const eigeneOhneMd = wurzelMit({ ...NACH_B, ...FREMD, [`quellen/${K}/roh/notiz.txt`]: SATZ });
    try {
      for (const wurzel of [nurFremde, eigeneOhneMd]) {
        const { code, zeilen } = await lauf(['--name', K, '--nach'], wurzel);
        expect(zeilen).toEqual([
          'lehrplan/fixture-quelle.yaml: kein Abschnitt mehr beauftragt, alle Lektionen da.',
          'Wortlaut nicht geprüft: keine Rohdateien am Rechner.',
        ]);
        expect(code).toBe(0);
      }
    } finally {
      for (const w of [nurFremde, eigeneOhneMd]) rmSync(w, { recursive: true, force: true });
    }
  });

  it('prueft mit den eigenen Rohdateien auch gegen die Rohdateien anderer Quellen, Exit 1', async () => {
    const wurzel = wurzelMit({
      ...NACH_B,
      'inhalt/lektionen/stunden-taeglich-melden.mdx': lektion(`Ein eigener Satz vorweg. ${SATZ}`),
      // Den Satz traegt nur die Rohdatei der anderen Quelle.
      [`quellen/${K}/roh/m01-01-einstieg.md`]: ROH.replace(SATZ, 'Nur ein kurzer Satz.'),
      'quellen/andere-quelle/roh/x01-01-fremd.md': ROH,
    });
    try {
      const { code, zeilen } = await lauf(['--name', K, '--nach'], wurzel);
      expect(zeilen).toEqual([
        'Lektion stunden-taeglich-melden: Wortlaut zu nah an der Quelle — npm run pruefe-lektion -- inhalt/lektionen/stunden-taeglich-melden.mdx zeigt die Stelle.',
      ]);
      expect(code).toBe(1);
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });

  it('prueft den Wortlaut auch bei ungueltigem Lehrplan und meldet beides, Exit 1', async () => {
    const wurzel = wurzelMit({
      ...NACH_B,
      [`lehrplan/${K}.yaml`]: lehrplanText({
        abschnitte: [
          { ...EINSTIEG, status: 'lektion', prinzipien: ['stunden-taeglich-melden'] },
          // Die Lektion zu diesem Prinzip fehlt noch: Das Schema weist den Lehrplan ab.
          { ...KOSTEN, status: 'lektion', prinzipien: ['kosten-frueh-schaetzen'] },
        ],
      }),
      'inhalt/lektionen/stunden-taeglich-melden.mdx': lektion(`Ein eigener Satz vorweg. ${SATZ}`),
      [`quellen/${K}/roh/m01-01-einstieg.md`]: ROH,
    });
    try {
      const { code, zeilen } = await lauf(['--name', K, '--nach'], wurzel);
      expect(zeilen).toEqual([
        'lehrplan/fixture-quelle.yaml: abschnitte.1.prinzipien.0.id: Die Lektion kosten-frueh-schaetzen gibt es nicht (inhalt/lektionen/kosten-frueh-schaetzen.mdx).',
        'Lektion stunden-taeglich-melden: Wortlaut zu nah an der Quelle — npm run pruefe-lektion -- inhalt/lektionen/stunden-taeglich-melden.mdx zeigt die Stelle.',
      ]);
      expect(code).toBe(1);
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });

  it.runIf(SPERRE_GREIFT)('meldet eine Rohdatei, die sich nicht lesen laesst, als Satz, Exit 1', async () => {
    const wurzel = wurzelMit({ ...NACH_B, [`quellen/${K}/roh/m01-01-einstieg.md`]: ROH });
    const gesperrt = sperre(path.join(wurzel, 'quellen', K, 'roh', 'm01-01-einstieg.md'));
    try {
      expect(await lauf(['--name', K, '--nach'], wurzel)).toEqual({
        code: 1,
        zeilen: [`quellen/fixture-quelle/roh/m01-01-einstieg.md lässt sich nicht lesen (${gesperrt.code}).`],
      });
    } finally {
      gesperrt.frei();
      rmSync(wurzel, { recursive: true, force: true });
    }
  });

  it('meldet einen Ordner an Stelle einer Lektionsdatei als Satz, Exit 1', async () => {
    const wurzel = wurzelMit({
      [`lehrplan/${K}.yaml`]: NACH_B[`lehrplan/${K}.yaml`],
      [`quellen/${K}/roh/m01-01-einstieg.md`]: ROH,
    });
    mkdirSync(path.join(wurzel, 'inhalt', 'lektionen', 'stunden-taeglich-melden.mdx'), { recursive: true });
    try {
      expect(await lauf(['--name', K, '--nach'], wurzel)).toEqual({
        code: 1,
        zeilen: ['inhalt/lektionen/stunden-taeglich-melden.mdx lässt sich nicht lesen (EISDIR).'],
      });
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });

  it('prueft den Wortlaut der Lektionen dieses Lehrplans, nicht den fremder Lektionen, Exit 1', async () => {
    const abschrift = lektion(`Ein eigener Satz vorweg. ${SATZ}`);
    const wurzel = wurzelMit({
      ...NACH_B,
      'inhalt/lektionen/stunden-taeglich-melden.mdx': abschrift,
      // Dieselbe Abschrift in einer Lektion ohne Prinzip in diesem Lehrplan: nicht Sache dieser Pruefung.
      'inhalt/lektionen/fremde-lektion.mdx': abschrift,
      [`quellen/${K}/roh/m01-01-einstieg.md`]: ROH,
    });
    try {
      const { code, zeilen } = await lauf(['--name', K, '--nach'], wurzel);
      expect(zeilen).toEqual([
        'Lektion stunden-taeglich-melden: Wortlaut zu nah an der Quelle — npm run pruefe-lektion -- inhalt/lektionen/stunden-taeglich-melden.mdx zeigt die Stelle.',
      ]);
      expect(code).toBe(1);
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });

  it('meldet einen noch beauftragten Abschnitt und den Hinweis darunter, Exit 1', async () => {
    const wurzel = wurzelMit({
      ...NACH_B,
      [`lehrplan/${K}.yaml`]: lehrplanText({
        abschnitte: [{ ...EINSTIEG, status: 'beauftragt', prinzipien: ['stunden-taeglich-melden'] }],
      }),
    });
    try {
      const { code, zeilen } = await lauf(['--name', K, '--nach'], wurzel);
      expect(zeilen).toEqual([
        'Abschnitt m01-01-einstieg steht noch auf beauftragt — jeder Abschnitt endet als lektion oder abgelehnt.',
        'Wortlaut nicht geprüft: keine Rohdateien am Rechner.',
      ]);
      expect(code).toBe(1);
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });

  it('meldet eine Lektion, deren prinzip nicht der Satz ihres Prinzips ist, Exit 1', async () => {
    const wurzel = wurzelMit({
      ...NACH_B,
      'inhalt/lektionen/stunden-taeglich-melden.mdx': lektionZu('Ein anderer Satz.'),
      [`quellen/${K}/roh/m01-01-einstieg.md`]: ROH,
    });
    try {
      const { code, zeilen } = await lauf(['--name', K, '--nach'], wurzel);
      expect(zeilen).toEqual([
        'Lektion stunden-taeglich-melden: prinzip ist nicht der Satz des Prinzips in lehrplan/fixture-quelle.yaml.',
      ]);
      expect(code).toBe(1);
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });
});

describe('fuehreAus - Aufruf', () => {
  it('zeigt nur die Aufruf-Hilfe und bricht mit 2 ab, wenn etwas fehlt, doppelt oder ohne -- dasteht', async () => {
    const wurzel = wurzelMit({});
    try {
      for (const argv of [
        [],
        ['--vor'],
        ['--nach'],
        ['--name', K],
        ['--name'],
        ['--name', '--vor'],
        ['--name', K, '--vor', '--nach'],
        ['--name', K, '--nach', '--nach'],
        ['--name', K, '--vor', 'm01-01-einstieg'],
      ]) {
        const { code, zeilen } = await lauf(argv, wurzel);
        expect(zeilen).toEqual([AUFRUF]);
        expect(code).toBe(2);
      }
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });

  it('zeigt nur die Aufruf-Hilfe, wenn --name doppelt dasteht, auch mit demselben Kurznamen — einmal genannt laeuft die Pruefung', async () => {
    const wurzel = wurzelMit({});
    try {
      for (const argv of [
        ['--name', 'a', '--name', 'b', '--vor'],
        ['--name', K, '--name', K, '--nach'],
        // Doppelt geht vor: Der Kurzname wird erst bei sonst vollstaendigem Aufruf geprueft.
        ['--vor', '--name', K, '--name', 'Fixture-Quelle'],
      ]) {
        expect(await lauf(argv, wurzel)).toEqual({ code: 2, zeilen: [AUFRUF] });
      }
      expect(await lauf(['--vor', '--name', K], wurzel)).toEqual({
        code: 1,
        zeilen: ['lehrplan/fixture-quelle.yaml gibt es nicht — erst einlesen.'],
      });
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });

  // Kein Kurzname: Er ist der Ordner unter quellen/, gelesen wird nur darunter.
  it('nennt einen Kurznamen, der nicht dem Muster der Ids folgt, und zeigt die Aufruf-Hilfe, Exit 2', async () => {
    const wurzel = wurzelMit({});
    try {
      for (const [argv, erwartet] of [
        [['--name', '../aussen', '--vor'], '--name ../aussen: nur Kleinbuchstaben, Ziffern und Bindestrich.'],
        [['--nach', '--name', 'Fixture-Quelle'], '--name Fixture-Quelle: nur Kleinbuchstaben, Ziffern und Bindestrich.'],
      ] as const) {
        const { code, zeilen } = await lauf([...argv], wurzel);
        expect(zeilen).toEqual([erwartet, AUFRUF]);
        expect(code).toBe(2);
      }
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });

  it('nennt eine fremde Option und zeigt die Aufruf-Hilfe, Exit 2', async () => {
    const wurzel = wurzelMit({});
    try {
      for (const [argv, erwartet] of [
        [['--name', K, '--vor', '--los'], 'Unbekannte Option --los.'],
        [['--name', K, '--vor', '--folien', '3'], 'Unbekannte Option --folien.'],
        [['--los', '--name', K, '--nach'], 'Unbekannte Option --los.'],
      ] as const) {
        const { code, zeilen } = await lauf([...argv], wurzel);
        expect(zeilen).toEqual([erwartet, AUFRUF]);
        expect(code).toBe(2);
      }
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });

  // 2b-3 legt die Dateien-Schicht womoeglich hinter einen Dev-Endpunkt, ohne diese Kommandozeile davor.
  it('laesst pruefeVorDateien und pruefeNachDateien einen falschen Kurznamen melden, bevor sie etwas lesen', () => {
    const wurzel = wurzelMit({});
    // lehrplan/../aussen.yaml ist dieser Ordner: Laesen sie zuerst, hiesse es „laesst sich nicht lesen (EISDIR)".
    mkdirSync(path.join(wurzel, 'aussen.yaml'));
    try {
      for (const pruefe of [pruefeVorDateien, pruefeNachDateien]) {
        let fehler: unknown;
        try {
          pruefe({ wurzel, kurzname: '../aussen' });
        } catch (f) {
          fehler = f;
        }
        expect(fehler).toBeInstanceOf(PruefeQuelleFehler);
        expect((fehler as Error).message).toBe('--name ../aussen: nur Kleinbuchstaben, Ziffern und Bindestrich.');
      }
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });
});

describe('werkzeug/pruefe-quelle.mjs aus einem reinen Node-Prozess', () => {
  const SKRIPT = path.resolve(__dirname, '..', 'werkzeug', 'pruefe-quelle.mjs');

  // Unter Vitest loest Vite auch Importe ohne Endung auf; `npm run pruefe-quelle`
  // laeuft ohne. Der Stand weicht hier ab, damit auch kurzstand aus
  // src/lib/bestandstext.ts unter reinem Node laeuft.
  it('laeuft ohne Vite und meldet einen anderen Stand, Exit 1', () => {
    const wurzel = wurzelMit({
      [`lehrplan/${K}.yaml`]: lehrplanText({
        stand: `sha256:${'b'.repeat(64)}`,
        abschnitte: [{ ...EINSTIEG, status: 'beauftragt' }],
      }),
      [`quellen/${K}/manifest.json`]: MANIFEST,
      [`quellen/${K}/roh/m01-01-einstieg.md`]: ROH,
    });
    try {
      const ergebnis = spawnSync(process.execPath, [SKRIPT, '--name', K, '--vor'], { cwd: wurzel, encoding: 'utf8' });
      expect(ergebnis.stderr).toBe('');
      expect(ergebnis.stdout).toBe(
        'Der Stand im Lehrplan (sha256:bbbbbbb) passt nicht zum Manifest (sha256:aaaaaaa) — neu eingelesen? Dann den Lehrplan nachziehen.\n',
      );
      expect(ergebnis.status).toBe(1);
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  }, 30_000);

  // Wie npm run pruefe-quelle: node mit dem Pfad relativ zur Wurzel. Erkennte
  // das Werkzeug den Direktaufruf nicht, endete es wortlos mit 0. Ohne
  // Argumente liest es keine Datei.
  it('zeigt ohne Argumente die Aufruf-Hilfe und endet mit 2', () => {
    const ergebnis = spawnSync(process.execPath, ['werkzeug/pruefe-quelle.mjs'], {
      cwd: path.resolve(__dirname, '..'),
      encoding: 'utf8',
    });
    expect(ergebnis.stderr).toBe('');
    expect(ergebnis.stdout).toBe(`${AUFRUF}\n`);
    expect(ergebnis.status).toBe(2);
  }, 30_000);
});
