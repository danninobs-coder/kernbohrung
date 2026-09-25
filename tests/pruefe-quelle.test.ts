// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { baueDokumentManifest } from '../werkzeug/manifest.mjs';
import { fuehreAus, pruefeNach, pruefeVor } from '../werkzeug/pruefe-quelle.mjs';

/**
 * Vor- und Nachpruefung eines Compiler-Durchgangs an Lehrmaterial.
 *
 * Kein Test liest lehrplan/ oder quellen/ im Repo: Lehrplaene sind hier von
 * Hand als Zeilen gebaut, Manifeste mit `baueDokumentManifest` aus dem
 * Einlesen selbst, und die Kommandozeile laeuft gegen ein Temp-Verzeichnis.
 * Der Satz in der Rohdatei ist erfunden.
 */

const K = 'fixture-quelle';
const STAND = `sha256:${'a'.repeat(64)}`;
const STEMPEL = '2026-09-25T08:00:00.000Z';
const AUFRUF = 'Aufruf: npm run pruefe-quelle -- --name <kurzname> --vor | --nach';

type Status = 'offen' | 'beauftragt' | 'lektion' | 'abgelehnt';
type AbschnittSpec = {
  id: string;
  seiten: [number, number];
  status: Status;
  datei?: string;
  grund?: string;
  prinzipien?: string[];
};

/** Drei Abschnitte eines Foliensatzes; der dritte hat nur eine Folie. */
const EINSTIEG = { id: 'm01-01-einstieg', seiten: [1, 10] as [number, number] };
const KOSTEN = { id: 'm01-02-kosten', seiten: [11, 20] as [number, number] };
const RISIKEN = { id: 'm01-03-risiken', seiten: [21, 21] as [number, number] };

/** Ein Lehrplan aus Lehrmaterial, Zeile fuer Zeile wie das Geruest des Einlesens — freigegeben, wenn nichts anderes gesagt ist. */
function lehrplanText({
  abschnitte,
  stand = STAND,
  freigegeben = true,
  quelle = K,
}: {
  abschnitte: AbschnittSpec[];
  stand?: string;
  freigegeben?: boolean;
  quelle?: string;
}): string {
  const zeilen = [
    'art: folien',
    `quelle: "${quelle}"`,
    'titel: "Fixture Quelle"',
    `stand: "${stand}"`,
    freigegeben ? 'geprueftVon: "Daniel Nobs"' : 'geprueftVon: ""',
    freigegeben ? 'geprueftAm: "2026-09-25"' : 'geprueftAm: ""',
    'abschnitte:',
  ];
  for (const a of abschnitte) {
    zeilen.push(
      `  - id: ${a.id}`,
      `    titel: "Titel ${a.id}"`,
      `    datei: "${a.datei ?? 'M1.pdf'}"`,
      `    seiten: [${a.seiten[0]}, ${a.seiten[1]}]`,
      `    status: ${a.status}`,
    );
    if (a.grund !== undefined) zeilen.push(`    grund: "${a.grund}"`);
    if (a.prinzipien !== undefined) {
      zeilen.push('    prinzipien:');
      for (const id of a.prinzipien) {
        zeilen.push(
          `      - id: ${id}`,
          '        satz: "Ein Satz, der etwas behauptet."',
          '        warumNichtOffensichtlich: "Weil das Gegenteil plausibel klingt."',
          `        belege: ["roh/${a.id}.md, Folie ${a.seiten[0]}"]`,
        );
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

type VorEingabe = Parameters<typeof pruefeVor>[0];
type NachEingabe = Parameters<typeof pruefeNach>[0];

/** pruefeVor mit passendem Manifest und ohne andere Lehrplaene, soweit der Test nichts anderes sagt. */
function vor(eingabe: Partial<VorEingabe> & Pick<VorEingabe, 'lehrplanText'>) {
  return pruefeVor({ kurzname: K, manifestText: MANIFEST, lektionsIds: new Set<string>(), andere: [], ...eingabe });
}

/** pruefeNach mit geprueftem, sauberem Wortlaut und ohne andere Lehrplaene, soweit der Test nichts anderes sagt. */
function nach(eingabe: Partial<NachEingabe> & Pick<NachEingabe, 'lehrplanText'>) {
  return pruefeNach({ kurzname: K, lektionsIds: new Set<string>(), wortlaut: { ids: [] }, andere: [], ...eingabe });
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
      lehrplanText: lehrplanText({ freigegeben: false, abschnitte: [{ ...EINSTIEG, status: 'beauftragt' }] }),
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

  // 5
  it('verlangt mindestens einen beauftragten Abschnitt', () => {
    const ergebnis = vor({
      lehrplanText: lehrplanText({
        abschnitte: [
          { ...EINSTIEG, status: 'offen' },
          { ...KOSTEN, status: 'abgelehnt', grund: 'Nur Bildbeispiele ohne Aussage.' },
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

  // 6a
  it('meldet eine Prinzip-Id, die ein anderer gueltiger oder wartender Lehrplan traegt; ein unlesbarer zaehlt nicht mit', () => {
    const ergebnis = vor({
      lehrplanText: lehrplanText({
        abschnitte: [{ ...EINSTIEG, status: 'beauftragt', prinzipien: ['geteilte-id', 'wartende-id', 'eigene-id'] }],
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
    const ergebnis = nach({ lehrplanText: FERTIG, lektionsIds: LEKTIONEN, wortlaut: { ids: ['zweites-prinzip'] } });
    expect(ergebnis).toEqual({
      ok: false,
      maengel: [
        'Lektion zweites-prinzip: Wortlaut zu nah an der Quelle — npm run pruefe-lektion -- inhalt/lektionen/zweites-prinzip.mdx zeigt die Stelle.',
      ],
      hinweise: [],
    });
  });

  it('sagt ohne Rohdateien „nicht geprueft" — ein Hinweis, kein Mangel', () => {
    expect(nach({ lehrplanText: FERTIG, lektionsIds: LEKTIONEN, wortlaut: null })).toEqual({
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

/** Ein erfundener Satz: 16 Woerter, sechs verschiedene Funktionswoerter. */
const SATZ = 'Der Polier trägt jeden Abend die Stunden der Kolonne ein und meldet sie an das Büro.';

/** Die Rohdatei zu EINSTIEG, in der Form des Einlesens: Kopf, dann je Folie eine Marke. */
const ROH = ['# Titel m01-01-einstieg', '', 'M1.pdf, Folien 1–10', '', '', '— Folie 2 —', SATZ, ''].join('\n');

/** Eine Lektion mit wenig Frontmatter und dem gegebenen Rumpf. */
function lektion(rumpf: string): string {
  return ['---', 'titel: "Eine Lektion"', '---', '', rumpf, ''].join('\n');
}

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
  /** Vor Durchgang B: zwei Abschnitte beauftragt, einer schon mit Prinzip; daneben ein Repo-Lehrplan ohne gemeinsame Id. */
  const VOR_B = {
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
      [`lehrplan/${K}.yaml`]: lehrplanText({ abschnitte: [{ ...KOSTEN, status: 'beauftragt' }] }),
      [`quellen/${K}/manifest.json`]: MANIFEST,
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
    const geteilt = wurzelMit({ ...VOR_B, 'lehrplan/anderer.yaml': repoText(['erstes-prinzip', 'nur-im-repo']) });
    const ordnerStattDatei = wurzelMit({});
    mkdirSync(path.join(ordnerStattDatei, 'lehrplan', `${K}.yaml`), { recursive: true });
    try {
      for (const [wurzel, erwartet] of [
        [leer, ['lehrplan/fixture-quelle.yaml gibt es nicht — erst einlesen.']],
        [ohneManifest, ['quellen/fixture-quelle/manifest.json gibt es nicht — erst einlesen.']],
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
      for (const w of [leer, ohneManifest, geteilt, ordnerStattDatei]) rmSync(w, { recursive: true, force: true });
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
});

describe('fuehreAus - Aufruf', () => {
  it('zeigt die Aufruf-Hilfe und bricht mit 2 ab, wenn etwas fehlt, doppelt oder fremd ist', async () => {
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
        ['--name', K, '--vor', '--folien', '3'],
        // Kein Kurzname: Er ist der Ordner unter quellen/, gelesen wird nur darunter.
        ['--name', '../fremd', '--vor'],
        ['--name', 'Fixture-Quelle', '--nach'],
      ]) {
        const { code, zeilen } = await lauf(argv, wurzel);
        expect(zeilen).toEqual([AUFRUF]);
        expect(code).toBe(2);
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
});
