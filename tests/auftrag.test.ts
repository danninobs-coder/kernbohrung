// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { load as yamlLesen } from 'js-yaml';
import { pruefeLehrplan } from '../src/lib/lehrplan';
import { lehrplanGeruest } from '../werkzeug/lehrplan-geruest.mjs';
import { AuftragFehler, beauftrage, beauftrageDatei, fuehreAus } from '../werkzeug/auftrag.mjs';

/**
 * Der Auftrag: Abschnitte eines Lehrplans aus Lehrmaterial von `offen` auf
 * `beauftragt` setzen.
 *
 * Die Fixturen hier sind von Hand als Zeilen gebaut, nicht mit `yaml.dump`:
 * `beauftrage` muss den Text Byte fuer Byte stehen lassen, und das laesst
 * sich nur gegen einen Text pruefen, dessen genaue Form man selbst kennt.
 * Kein Test liest lehrplan/ im Repo — alles gegen Text oder ein Temp-Verzeichnis.
 */

const STAND = `sha256:${'a'.repeat(64)}`;

type AbschnittSpec = {
  id: string;
  status: 'offen' | 'beauftragt' | 'lektion' | 'abgelehnt';
  grund?: string;
  prinzipien?: string[];
};

/** Die Zeilen eines Abschnitts, wie lehrplanGeruest sie schreibt, plus optional grund/prinzipien. */
function abschnittZeilen(a: AbschnittSpec, seiten: [number, number]): string[] {
  const zeilen = [
    `  - id: ${a.id}`,
    `    titel: "Titel ${a.id}"`,
    `    datei: "M1.pdf"`,
    `    seiten: [${seiten[0]}, ${seiten[1]}]`,
    `    status: ${a.status}`,
  ];
  if (a.grund !== undefined) zeilen.push(`    grund: "${a.grund}"`);
  if (a.prinzipien) {
    zeilen.push('    prinzipien:');
    for (const id of a.prinzipien) {
      zeilen.push(
        `      - id: ${id}`,
        '        satz: "Satz."',
        '        warumNichtOffensichtlich: "Weil."',
        `        belege: ["${a.id}"]`,
      );
    }
  }
  return zeilen;
}

/** Ein Lehrplan aus Lehrmaterial, LF-getrennt, mit Kopfkommentar — fuer den byte-genauen Vergleich. */
function lehrplanText(abschnitte: AbschnittSpec[]): string {
  const zeilen = [
    '# Kopfkommentar, den beauftrage() stehen laesst.',
    'art: folien',
    'quelle: "fixture-auftrag"',
    'titel: "Fixture Auftrag"',
    `stand: "${STAND}"`,
    'geprueftVon: "Daniel Nobs"',
    'geprueftAm: "2026-09-24"',
    'abschnitte:',
    ...abschnitte.flatMap((a, i) => abschnittZeilen(a, [i * 10 + 1, i * 10 + 10])),
  ];
  return `${zeilen.join('\n')}\n`;
}

const REPO_TEXT =
  [
    '# Repo-Lehrplan.',
    'art: repo',
    'quelle: "awesome-llm-apps"',
    `stand: "${'a'.repeat(40)}"`,
    'geprueftVon: "Daniel Nobs"',
    'geprueftAm: "2026-09-24"',
    'prinzipien:',
    '  - id: p-1',
    '    satz: "Satz."',
    '    warumNichtOffensichtlich: "Weil."',
    '    belege: ["b"]',
    '    widget: Pipeline',
  ].join('\n') + '\n';

/** Zeilenweise Abweichungen zwischen zwei Texten, als Indexliste. */
function abweichendeZeilen(alt: string, neu: string): number[] {
  const a = alt.split('\n');
  const n = neu.split('\n');
  expect(n).toHaveLength(a.length);
  return a.map((_, i) => i).filter((i) => a[i] !== n[i]);
}

describe('beauftrage', () => {
  it('setzt einen offenen Abschnitt auf beauftragt und laesst den Rest Zeile fuer Zeile stehen', () => {
    const text = lehrplanText([
      { id: 'a1', status: 'offen' },
      { id: 'a2', status: 'offen' },
    ]);
    const ergebnis = beauftrage(text, ['a1']);
    if (!ergebnis.ok) throw new Error(ergebnis.maengel.join('\n'));
    expect(ergebnis.geaendert).toEqual(['a1']);

    const abweichungen = abweichendeZeilen(text, ergebnis.text);
    expect(abweichungen).toHaveLength(1);
    const alt = text.split('\n');
    const neu = ergebnis.text.split('\n');
    const [i] = abweichungen;
    expect(alt[i]).toBe('    status: offen');
    expect(neu[i]).toBe('    status: beauftragt');
  });

  it('behaelt CRLF-Zeilenenden bei', () => {
    const text = lehrplanText([{ id: 'a1', status: 'offen' }]).replaceAll('\n', '\r\n');
    const ergebnis = beauftrage(text, ['a1']);
    if (!ergebnis.ok) throw new Error(ergebnis.maengel.join('\n'));

    const zaehleCrlf = (s: string) => (s.match(/\r\n/g) ?? []).length;
    const zaehleNackteLf = (s: string) => (s.match(/(?<!\r)\n/g) ?? []).length;
    expect(zaehleCrlf(ergebnis.text)).toBe(zaehleCrlf(text));
    expect(zaehleNackteLf(ergebnis.text)).toBe(0);
    expect(ergebnis.text).toContain('status: beauftragt\r\n');
  });

  it('erkennt status: offen mit Anfuehrungszeichen oder Kommentar und bewahrt die Form', () => {
    for (const roh of [
      '    status: "offen"',
      `    status: 'offen'`,
      '    status: offen  # noch nicht dran',
    ] as const) {
      const text = lehrplanText([{ id: 'a1', status: 'offen' }]).replace('    status: offen', roh);
      const ergebnis = beauftrage(text, ['a1']);
      if (!ergebnis.ok) throw new Error(ergebnis.maengel.join('\n'));
      expect(ergebnis.geaendert).toEqual(['a1']);
      // Nur "offen" wird zu "beauftragt" -- Anfuehrungszeichen und Kommentar bleiben stehen.
      expect(ergebnis.text).toBe(text.replace('offen', 'beauftragt'));
    }
  });

  it('meldet einen Mangel statt abzustuerzen, wenn sich die status-Zeile nicht sicher finden laesst', () => {
    // Gueltiges YAML -- js-yaml liest den Wert als "offen" --, aber drei
    // Leerzeichen statt einem passen zu keinem der drei erkannten Muster: ein
    // Fall, den die Erkennung nicht erraten soll.
    const text = lehrplanText([{ id: 'a1', status: 'offen' }]).replace('    status: offen', '    status:   offen');
    const ergebnis = beauftrage(text, ['a1']);
    expect(ergebnis).toEqual({
      ok: false,
      maengel: ['Abschnitt a1: die Zeile status lässt sich nicht sicher finden — bitte von Hand auf beauftragt setzen.'],
    });
  });

  it('beauftragt mehrere Ids und meldet sie in der Reihenfolge des Lehrplans', () => {
    const text = lehrplanText([
      { id: 'a1', status: 'offen' },
      { id: 'a2', status: 'offen' },
      { id: 'a3', status: 'offen' },
      { id: 'a4', status: 'offen' },
    ]);
    const ergebnis = beauftrage(text, ['a3', 'a1', 'a2']);
    if (!ergebnis.ok) throw new Error(ergebnis.maengel.join('\n'));
    expect(ergebnis.geaendert).toEqual(['a1', 'a2', 'a3']);

    const abweichungen = abweichendeZeilen(text, ergebnis.text);
    expect(abweichungen).toHaveLength(3);
    const alt = text.split('\n');
    const neu = ergebnis.text.split('\n');
    for (const i of abweichungen) {
      expect(alt[i]).toBe('    status: offen');
      expect(neu[i]).toBe('    status: beauftragt');
    }
    // a4 bleibt offen: genau eine status:-offen-Zeile ist noch da.
    expect(neu.filter((z) => z === '    status: offen')).toHaveLength(1);
  });

  it('zaehlt eine zweimal genannte Id nur einmal, kein Mangel', () => {
    const text = lehrplanText([
      { id: 'a1', status: 'offen' },
      { id: 'a2', status: 'offen' },
    ]);
    const ergebnis = beauftrage(text, ['a1', 'a1']);
    if (!ergebnis.ok) throw new Error(ergebnis.maengel.join('\n'));
    expect(ergebnis.geaendert).toEqual(['a1']);
    expect(abweichendeZeilen(text, ergebnis.text)).toHaveLength(1);
  });

  it('weist eine unbekannte Id ab und aendert nichts, auch nicht die gueltigen Ids', () => {
    const text = lehrplanText([{ id: 'a1', status: 'offen' }]);
    const ergebnis = beauftrage(text, ['a1', 'nicht-vorhanden']);
    expect(ergebnis).toEqual({ ok: false, maengel: ['Abschnitt nicht-vorhanden gibt es in diesem Lehrplan nicht.'] });
  });

  it('weist einen Abschnitt mit status lektion ab', () => {
    const text = lehrplanText([{ id: 'a1', status: 'lektion', prinzipien: ['schon-gelehrt'] }]);
    const ergebnis = beauftrage(text, ['a1']);
    expect(ergebnis).toEqual({
      ok: false,
      maengel: ['Abschnitt a1 steht auf lektion, nicht auf offen — beauftragt wird nur, was offen ist.'],
    });
  });

  it('weist einen Abschnitt mit status abgelehnt ab', () => {
    const text = lehrplanText([{ id: 'a1', status: 'abgelehnt', grund: 'Nicht relevant.' }]);
    const ergebnis = beauftrage(text, ['a1']);
    expect(ergebnis).toEqual({
      ok: false,
      maengel: ['Abschnitt a1 steht auf abgelehnt, nicht auf offen — beauftragt wird nur, was offen ist.'],
    });
  });

  it('weist einen Repo-Lehrplan ab', () => {
    const ergebnis = beauftrage(REPO_TEXT, ['p-1']);
    expect(ergebnis).toEqual({
      ok: false,
      maengel: ['Nur ein Lehrplan aus Lehrmaterial hat Abschnitte; dieser trägt art: repo.'],
    });
  });

  it('verlangt mindestens eine Id', () => {
    const text = lehrplanText([{ id: 'a1', status: 'offen' }]);
    expect(beauftrage(text, [])).toEqual({ ok: false, maengel: ['Kein Abschnitt genannt.'] });
  });

  it('meldet fehlerhaftes YAML einzeilig, wie lehrplanAusYaml', () => {
    const kaputt = 'art: folien\nabschnitte: [';
    const ergebnis = beauftrage(kaputt, ['a1']);
    expect(ergebnis.ok).toBe(false);
    if (ergebnis.ok) return;
    expect(ergebnis.maengel).toHaveLength(1);
    expect(ergebnis.maengel[0]).toMatch(/^Lehrplan ist kein gültiges YAML \(Zeile \d+, Spalte \d+\): /);
  });
});

describe('beauftrage gegen die echte Form des Geruests', () => {
  it('beauftragt einen Abschnitt, und pruefeLehrplan meldet danach wartet mit status beauftragt', () => {
    const geruest = lehrplanGeruest({
      kurzname: 'fixture-geruest',
      titel: 'Fixture Geruest',
      stand: STAND,
      abschnitte: [
        { id: 'd01-01-erstes', titel: 'Erstes', datei: 'M1.pdf', seiten: [1, 10] },
        { id: 'd01-02-zweites', titel: 'Zweites', datei: 'M1.pdf', seiten: [11, 20] },
      ],
    });

    const ergebnis = beauftrage(geruest, ['d01-01-erstes']);
    if (!ergebnis.ok) throw new Error(ergebnis.maengel.join('\n'));

    const befund = pruefeLehrplan(yamlLesen(ergebnis.text), new Set());
    expect(befund.ok).toBe(false);
    if (befund.ok) return;
    expect(befund.wartet).toBe(true);
    if (!befund.wartet) return;
    if (befund.lehrplan.art === 'repo') throw new Error('Erwartet waren Folien.');
    const abschnitt = befund.lehrplan.abschnitte.find((a) => a.id === 'd01-01-erstes');
    expect(abschnitt?.status).toBe('beauftragt');
    const anderer = befund.lehrplan.abschnitte.find((a) => a.id === 'd01-02-zweites');
    expect(anderer?.status).toBe('offen');
  });
});

/** Temp-Verzeichnis mit lehrplan/-Unterordner, wie ihn beauftrageDatei erwartet. */
function temp(): string {
  const ordner = mkdtempSync(path.join(tmpdir(), 'kernbohrung-auftrag-'));
  mkdirSync(path.join(ordner, 'lehrplan'), { recursive: true });
  return ordner;
}

describe('beauftrageDatei', () => {
  it('aendert die Datei; ein zweiter Aufruf mit derselben Id bleibt Mangel und laesst die Datei byte-gleich', () => {
    const wurzel = temp();
    try {
      const kurzname = 'fixture-datei';
      const geruest = lehrplanGeruest({
        kurzname,
        titel: 'Fixture Datei',
        stand: STAND,
        abschnitte: [{ id: 'd01-01-erstes', titel: 'Erstes', datei: 'M1.pdf', seiten: [1, 10] }],
      });
      const datei = path.join(wurzel, 'lehrplan', `${kurzname}.yaml`);
      writeFileSync(datei, geruest, 'utf8');

      const erster = beauftrageDatei({ wurzel, kurzname, ids: ['d01-01-erstes'] });
      expect(erster.geaendert).toEqual(['d01-01-erstes']);
      const nachErstem = readFileSync(datei, 'utf8');
      expect(nachErstem).toContain('    status: beauftragt');

      let fehlerNachricht = '';
      try {
        beauftrageDatei({ wurzel, kurzname, ids: ['d01-01-erstes'] });
        throw new Error('Erwartet war ein AuftragFehler.');
      } catch (fehler) {
        expect(fehler).toBeInstanceOf(AuftragFehler);
        fehlerNachricht = (fehler as Error).message;
      }
      expect(fehlerNachricht).toBe(
        'Abschnitt d01-01-erstes steht auf beauftragt, nicht auf offen — beauftragt wird nur, was offen ist.',
      );
      expect(readFileSync(datei, 'utf8')).toBe(nachErstem);
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });

  it('meldet eine fehlende Datei', () => {
    const wurzel = temp();
    try {
      expect(() => beauftrageDatei({ wurzel, kurzname: 'gibts-nicht', ids: ['x'] })).toThrow(
        'lehrplan/gibts-nicht.yaml gibt es nicht — erst einlesen.',
      );
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });

  it('unterscheidet ENOENT von anderen Lesefehlern', () => {
    const wurzel = temp();
    try {
      const kurzname = 'ist-ein-ordner';
      // Ein Ordner an der Stelle der Datei: readFileSync scheitert mit
      // EISDIR, nicht mit ENOENT -- der Lehrplan gibt es ja, nur lesen laesst
      // er sich nicht.
      mkdirSync(path.join(wurzel, 'lehrplan', `${kurzname}.yaml`), { recursive: true });
      expect(() => beauftrageDatei({ wurzel, kurzname, ids: ['x'] })).toThrow(
        `lehrplan/${kurzname}.yaml lässt sich nicht lesen (EISDIR).`,
      );
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });
});

describe('fuehreAus', () => {
  async function lauf(argv: string[], wurzel: string): Promise<{ code: number; zeilen: string[] }> {
    const zeilen: string[] = [];
    const code = await fuehreAus(argv, wurzel, (zeile: string) => zeilen.push(zeile));
    return { code, zeilen };
  }

  it('meldet Erfolg woertlich in der Einzahl und Exit 0', async () => {
    const wurzel = temp();
    try {
      const kurzname = 'fixture-cli-einzahl';
      const geruest = lehrplanGeruest({
        kurzname,
        titel: 'Fixture CLI Einzahl',
        stand: STAND,
        abschnitte: [{ id: 'd01-01-erstes', titel: 'Erstes', datei: 'M1.pdf', seiten: [1, 10] }],
      });
      writeFileSync(path.join(wurzel, 'lehrplan', `${kurzname}.yaml`), geruest, 'utf8');

      const { code, zeilen } = await lauf(['--name', kurzname, 'd01-01-erstes'], wurzel);
      expect(code).toBe(0);
      expect(zeilen).toEqual([
        `lehrplan/${kurzname}.yaml: 1 Abschnitt beauftragt`,
        '  d01-01-erstes',
        `Nächster Schritt: Durchgang A — „Bau die Lektionen für ${kurzname}“.`,
      ]);
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });

  it('meldet Erfolg woertlich in der Mehrzahl und Exit 0', async () => {
    const wurzel = temp();
    try {
      const kurzname = 'fixture-cli-mehrzahl';
      const geruest = lehrplanGeruest({
        kurzname,
        titel: 'Fixture CLI Mehrzahl',
        stand: STAND,
        abschnitte: [
          { id: 'd01-01-erstes', titel: 'Erstes', datei: 'M1.pdf', seiten: [1, 10] },
          { id: 'd01-02-zweites', titel: 'Zweites', datei: 'M1.pdf', seiten: [11, 20] },
        ],
      });
      writeFileSync(path.join(wurzel, 'lehrplan', `${kurzname}.yaml`), geruest, 'utf8');

      // Aufrufreihenfolge bewusst vertauscht: die Meldung folgt der Lehrplan-Reihenfolge.
      const { code, zeilen } = await lauf(['--name', kurzname, 'd01-02-zweites', 'd01-01-erstes'], wurzel);
      expect(code).toBe(0);
      expect(zeilen).toEqual([
        `lehrplan/${kurzname}.yaml: 2 Abschnitte beauftragt`,
        '  d01-01-erstes',
        '  d01-02-zweites',
        `Nächster Schritt: Durchgang A — „Bau die Lektionen für ${kurzname}“.`,
      ]);
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });

  it('zeigt ohne --name oder ohne Id die Aufruf-Hilfe und bricht mit 2 ab', async () => {
    const wurzel = temp();
    try {
      const ohneName = await lauf(['a1'], wurzel);
      expect(ohneName.code).toBe(2);
      expect(ohneName.zeilen).toEqual([
        'Aufruf: npm run auftrag -- --name <kurzname> <abschnitt-id> [<abschnitt-id> …]',
      ]);

      const ohneId = await lauf(['--name', 'x'], wurzel);
      expect(ohneId.code).toBe(2);
      expect(ohneId.zeilen).toEqual(ohneName.zeilen);
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });

  it('meldet einen Mangel als eine Zeile und bricht mit 1 ab', async () => {
    const wurzel = temp();
    try {
      const { code, zeilen } = await lauf(['--name', 'nicht-eingelesen', 'a1'], wurzel);
      expect(code).toBe(1);
      expect(zeilen).toEqual(['lehrplan/nicht-eingelesen.yaml gibt es nicht — erst einlesen.']);
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });

  it('meldet mehrere Maengel als je eigene Zeile, nicht als eine mit eingebettetem Zeilenumbruch', async () => {
    const wurzel = temp();
    try {
      const kurzname = 'fixture-zwei-maengel';
      const geruest = lehrplanGeruest({
        kurzname,
        titel: 'Fixture Zwei Maengel',
        stand: STAND,
        abschnitte: [{ id: 'd01-01-erstes', titel: 'Erstes', datei: 'M1.pdf', seiten: [1, 10] }],
      });
      writeFileSync(path.join(wurzel, 'lehrplan', `${kurzname}.yaml`), geruest, 'utf8');

      const { code, zeilen } = await lauf(['--name', kurzname, 'nicht-a', 'nicht-b'], wurzel);
      expect(code).toBe(1);
      expect(zeilen).toEqual([
        'Abschnitt nicht-a gibt es in diesem Lehrplan nicht.',
        'Abschnitt nicht-b gibt es in diesem Lehrplan nicht.',
      ]);
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });
});
