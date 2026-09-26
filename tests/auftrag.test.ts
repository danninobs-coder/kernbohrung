// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { load as yamlLesen } from 'js-yaml';
import { SPERRE_GREIFT, sperre } from './hilfen/sperre';
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
const AUFRUF = 'Aufruf: npm run auftrag -- --name <kurzname> <abschnitt-id> [<abschnitt-id> …]';

/** Der Mangel, wenn die Abschnitte nicht in der Form stehen, die das Einlesen schreibt. */
const ANDERE_FORM =
  'Die Abschnitte stehen nicht in der Form, die das Einlesen schreibt („  - id: …“ mit zwei Leerzeichen Einzug) — bitte von Hand auf beauftragt setzen.';

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

/** Der Abbruch eines Aufrufs — damit sein Wortlaut ganz geprueft werden kann und nicht nur ein Stueck davon. */
function wurf(aufruf: () => unknown): Error {
  try {
    aufruf();
  } catch (fehler) {
    return fehler as Error;
  }
  throw new Error('Erwartet war ein Abbruch.');
}

/**
 * Nimmt einer Datei das Schreibrecht, bis `frei` es zurueckgibt. Anders als
 * `sperre` laesst das unter Windows das Lesen zu: Gelesen wird wie immer, erst
 * das Schreiben scheitert — dort mit EPERM, sonst mit EACCES. Als root greift
 * das so wenig wie `sperre` (`SPERRE_GREIFT`).
 */
function schreibschutz(pfad: string): { code: string; frei: () => void } {
  const vorher = statSync(pfad);
  chmodSync(pfad, 0o444);
  return {
    code: process.platform === 'win32' ? 'EPERM' : 'EACCES',
    frei: () => chmodSync(pfad, vorher.mode & 0o777),
  };
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
      const vorlage = lehrplanText([{ id: 'a1', status: 'offen' }]);
      // Ersetzte replace nichts, pruefte der Test still nur die blosse Form.
      expect(vorlage).toContain('    status: offen');
      const text = vorlage.replace('    status: offen', roh);
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

  it('erkennt die id-Zeile auch mit Kommentar, Anfuehrungszeichen oder Leerraum am Ende und laesst sie stehen', () => {
    for (const zeile of [
      '  - id: a2  # zweiter Abschnitt',
      '  - id: "a2"',
      `  - id: 'a2'`,
      '  - id: a2   ',
      '  - id: a2\t',
    ]) {
      /** Beide Abschnitte mit dem gegebenen Status, a2 mit der id-Zeile von oben. */
      const mit = (a1: AbschnittSpec['status'], a2: AbschnittSpec['status']) => {
        const vorlage = lehrplanText([
          { id: 'a1', status: a1 },
          { id: 'a2', status: a2 },
        ]);
        // Ersetzte replace nichts — etwa in einer Vorlage mit CRLF —, pruefte der Test still nur die blosse Form.
        expect(vorlage).toContain('  - id: a2\n');
        return vorlage.replace('  - id: a2\n', `${zeile}\n`);
      };
      const text = mit('offen', 'offen');
      // Der Abschnitt selbst wird beauftragt, der Rest bleibt Byte fuer Byte.
      expect(beauftrage(text, ['a2'])).toEqual({ ok: true, text: mit('offen', 'beauftragt'), geaendert: ['a2'] });
      // Und der Block davor endet an dieser Zeile, statt den Abschnitt zu schlucken.
      expect(beauftrage(text, ['a1'])).toEqual({ ok: true, text: mit('beauftragt', 'offen'), geaendert: ['a1'] });
    }
  });

  // Nach dem ersten Durchgang traegt jeder Lehrplan Prinzipien. Gaelte eine
  // ihrer id-Zeilen als Abschnitt, wiese der Anker-Abgleich den ganzen
  // Lehrplan als andere Form ab.
  it('beauftragt neben einem Abschnitt mit Prinzipien und laesst deren id-Zeilen stehen, auch mit Kommentar und in CRLF', () => {
    const vorlage = lehrplanText([
      { id: 'a1', status: 'lektion', prinzipien: ['erstes-prinzip', 'zweites-prinzip'] },
      { id: 'a2', status: 'offen' },
    ]);
    expect(vorlage).toContain('      - id: zweites-prinzip\n');
    const lf = vorlage.replace('      - id: zweites-prinzip\n', '      - id: zweites-prinzip  # aus einer vorhandenen Lektion\n');
    for (const text of [lf, lf.replaceAll('\n', '\r\n')]) {
      const ergebnis = beauftrage(text, ['a2']);
      if (!ergebnis.ok) throw new Error(ergebnis.maengel.join('\n'));
      expect(ergebnis.geaendert).toEqual(['a2']);
      // Genau eine Zeile anders: die status-Zeile von a2, die einzige, die auf offen steht.
      expect(abweichendeZeilen(text, ergebnis.text)).toHaveLength(1);
      expect(text).toContain('    status: offen');
      expect(ergebnis.text).toBe(text.replace('    status: offen', '    status: beauftragt'));
    }
  });

  it('meldet Abschnitte, die nicht in der Form des Einlesens stehen, als Mangel und aendert nichts', () => {
    const vorlage = lehrplanText([
      { id: 'a1', status: 'offen' },
      { id: 'a2', status: 'offen' },
    ]);
    // Die Liste ohne Einzug — und ein Nachbar, dessen id nicht in der ersten
    // Zeile steht, wie ihn ein Formatierer mit sortierten Schluesseln schriebe.
    const ohneEinzug = vorlage.replace(/^ {2}/gm, '');
    const fremderNachbar = vorlage.replace('  - id: a2\n    titel: "Titel a2"\n', '  - titel: "Titel a2"\n    id: a2\n');
    for (const text of [ohneEinzug, fremderNachbar]) {
      // Fuer js-yaml steht dasselbe da; nur die Form ist eine andere.
      expect(text).not.toBe(vorlage);
      expect(yamlLesen(text)).toEqual(yamlLesen(vorlage));
      for (const ids of [['a1'], ['a2'], ['a1', 'a2']]) {
        expect(beauftrage(text, ids)).toEqual({ ok: false, maengel: [ANDERE_FORM] });
      }
    }
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
      // Das Geruest traegt noch keine Freigabe: Der Lehrplan wartet weiter auf sie.
      expect(erster).toEqual({ geaendert: ['d01-01-erstes'], datei, wartet: true });
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

  // Als UTF-8 gelesen, wuerde aus einem Umlaut in ANSI still U+FFFD, und beim
  // Schreiben stuende EF BF BD da: jeder Umlaut der Titel zerstoert.
  it('weist einen Lehrplan ab, der nicht als UTF-8 gespeichert ist, und laesst ihn Byte fuer Byte stehen', () => {
    const wurzel = temp();
    try {
      const kurzname = 'fixture-ansi';
      const datei = path.join(wurzel, 'lehrplan', `${kurzname}.yaml`);
      const text = lehrplanText([{ id: 'a1', status: 'offen' }]);
      expect(text).toContain('titel: "Titel a1"');
      // In ANSI (Windows-1252) ist U+00FC das eine Byte 0xFC — in UTF-8 steht es nie allein.
      const bytes = Buffer.from(text.replace('titel: "Titel a1"', 'titel: "Titel für a1"'), 'latin1');
      expect(bytes.includes(0xfc)).toBe(true);
      writeFileSync(datei, bytes);

      const fehler = wurf(() => beauftrageDatei({ wurzel, kurzname, ids: ['a1'] }));
      expect(fehler).toBeInstanceOf(AuftragFehler);
      expect(fehler.message).toBe(
        `lehrplan/${kurzname}.yaml ist nicht als UTF-8 gespeichert — bitte als UTF-8 speichern und neu aufrufen.`,
      );
      expect(readFileSync(datei).equals(bytes)).toBe(true);
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });

  // Ein Decoder, der das BOM schluckt, schriebe die Datei ohne es zurueck.
  it('laesst ein BOM am Anfang stehen, und die Umlaute bleiben', () => {
    const wurzel = temp();
    try {
      const kurzname = 'fixture-bom';
      const datei = path.join(wurzel, 'lehrplan', `${kurzname}.yaml`);
      const text = lehrplanText([{ id: 'a1', status: 'offen' }]);
      expect(text).toContain('titel: "Titel a1"');
      const mitUmlaut = text.replace('titel: "Titel a1"', 'titel: "Titel für a1"');
      writeFileSync(datei, `\uFEFF${mitUmlaut}`, 'utf8');

      expect(beauftrageDatei({ wurzel, kurzname, ids: ['a1'] }).geaendert).toEqual(['a1']);
      const danach = readFileSync(datei);
      expect([...danach.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
      expect(danach.toString('utf8')).toBe(`\uFEFF${mitUmlaut.replace('    status: offen', '    status: beauftragt')}`);
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });

  it('meldet bei einem freigegebenen Lehrplan, dass er nicht wartet', () => {
    const wurzel = temp();
    try {
      const datei = path.join(wurzel, 'lehrplan', 'fixture-freigegeben.yaml');
      writeFileSync(datei, lehrplanText([{ id: 'a1', status: 'offen' }]), 'utf8');
      expect(beauftrageDatei({ wurzel, kurzname: 'fixture-freigegeben', ids: ['a1'] })).toEqual({
        geaendert: ['a1'],
        datei,
        wartet: false,
      });
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });

  // 2b-3 legt diese Schicht hinter den Dev-Endpunkt /__auftrag, ohne die Kommandozeile davor.
  it('prueft den Kurznamen, bevor es liest: ../aussen/kopie schreibt keine Datei neben lehrplan/ um', () => {
    const wurzel = temp();
    try {
      // lehrplan/../aussen/kopie.yaml ist diese Datei.
      const draussen = path.join(wurzel, 'aussen', 'kopie.yaml');
      mkdirSync(path.dirname(draussen));
      const text = lehrplanText([{ id: 'a1', status: 'offen' }]);
      writeFileSync(draussen, text, 'utf8');

      const fehler = wurf(() => beauftrageDatei({ wurzel, kurzname: '../aussen/kopie', ids: ['a1'] }));
      expect(fehler).toBeInstanceOf(AuftragFehler);
      expect(fehler.message).toBe('--name ../aussen/kopie: nur Kleinbuchstaben, Ziffern und Bindestrich.');
      expect(readFileSync(draussen, 'utf8')).toBe(text);
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });

  it.runIf(SPERRE_GREIFT)('meldet eine Lehrplandatei, die beim Schreiben gesperrt ist, als Satz und laesst sie stehen', () => {
    const wurzel = temp();
    const gesperrt: { code: string; frei: () => void }[] = [];
    const freigeben = () => {
      for (const sperrung of gesperrt.splice(0)) sperrung.frei();
    };
    try {
      const kurzname = 'fixture-gesperrt';
      const datei = path.join(wurzel, 'lehrplan', `${kurzname}.yaml`);
      const text = lehrplanText([{ id: 'a1', status: 'offen' }]);
      writeFileSync(datei, text, 'utf8');

      // Gelesen ist schon; erst beim Schreiben haelt ein Editor die Datei fest.
      const fehler = wurf(() =>
        beauftrageDatei({
          wurzel,
          kurzname,
          ids: ['a1'],
          schreibeDatei: (pfad, inhalt, kodierung) => {
            gesperrt.push(sperre(pfad));
            writeFileSync(pfad, inhalt, kodierung);
          },
        }),
      );
      expect(fehler).toBeInstanceOf(AuftragFehler);
      expect(gesperrt).toHaveLength(1);
      expect(fehler.message).toBe(`lehrplan/${kurzname}.yaml lässt sich nicht schreiben (${gesperrt[0].code}).`);
      freigeben();
      expect(readFileSync(datei, 'utf8')).toBe(text);
    } finally {
      freigeben();
      rmSync(wurzel, { recursive: true, force: true });
    }
  });

  it('laesst einen Fehler im Programm beim Schreiben als solchen durch', () => {
    const wurzel = temp();
    try {
      const kurzname = 'fixture-programmfehler';
      const datei = path.join(wurzel, 'lehrplan', `${kurzname}.yaml`);
      const text = lehrplanText([{ id: 'a1', status: 'offen' }]);
      writeFileSync(datei, text, 'utf8');

      // Kein syscall: Als Schreibfehler verkleidet, suchte man an der Datei statt im Code.
      const programmfehler = new TypeError('ein Fehler im Programm');
      const fehler = wurf(() =>
        beauftrageDatei({
          wurzel,
          kurzname,
          ids: ['a1'],
          schreibeDatei: () => {
            throw programmfehler;
          },
        }),
      );
      expect(fehler).toBe(programmfehler);
      expect(readFileSync(datei, 'utf8')).toBe(text);
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
      // Das Geruest wartet noch auf die Freigabe: Sie kommt vor Durchgang A.
      expect(zeilen).toEqual([
        `lehrplan/${kurzname}.yaml: 1 Abschnitt beauftragt`,
        '  d01-01-erstes',
        `Nächster Schritt: freigeben (geprueftVon und geprueftAm in lehrplan/${kurzname}.yaml), dann Durchgang A — „Bau die Lektionen für ${kurzname}“.`,
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
        `Nächster Schritt: freigeben (geprueftVon und geprueftAm in lehrplan/${kurzname}.yaml), dann Durchgang A — „Bau die Lektionen für ${kurzname}“.`,
      ]);
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });

  it('nennt bei einem freigegebenen Lehrplan gleich Durchgang A als naechsten Schritt, Exit 0', async () => {
    const wurzel = temp();
    try {
      const kurzname = 'fixture-cli-freigegeben';
      writeFileSync(path.join(wurzel, 'lehrplan', `${kurzname}.yaml`), lehrplanText([{ id: 'a1', status: 'offen' }]), 'utf8');

      const { code, zeilen } = await lauf(['--name', kurzname, 'a1'], wurzel);
      expect(code).toBe(0);
      expect(zeilen).toEqual([
        `lehrplan/${kurzname}.yaml: 1 Abschnitt beauftragt`,
        '  a1',
        `Nächster Schritt: Durchgang A — „Bau die Lektionen für ${kurzname}“.`,
      ]);
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });

  it('zeigt ohne --name, ohne dessen Wert oder ohne Id nur die Aufruf-Hilfe und bricht mit 2 ab', async () => {
    const wurzel = temp();
    try {
      for (const argv of [
        ['a1'],
        ['--name', 'x'],
        ['--name'],
        ['a1', '--name'],
        // Ein Wert mit -- vorn ist die naechste Option, kein Kurzname.
        ['--name', '--vor', 'a1'],
      ]) {
        expect(await lauf(argv, wurzel)).toEqual({ code: 2, zeilen: [AUFRUF] });
      }
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });

  // Kein Kurzname: Er wird zum Pfad unter lehrplan/, und nur darunter wird geschrieben.
  it('nennt einen Kurznamen, der nicht dem Muster der Ids folgt, und zeigt die Aufruf-Hilfe, Exit 2', async () => {
    const wurzel = temp();
    try {
      for (const [argv, erwartet] of [
        [['--name', '../aussen', 'a1'], '--name ../aussen: nur Kleinbuchstaben, Ziffern und Bindestrich.'],
        [['a1', '--name', 'Fixture-Gross'], '--name Fixture-Gross: nur Kleinbuchstaben, Ziffern und Bindestrich.'],
      ] as const) {
        expect(await lauf([...argv], wurzel)).toEqual({ code: 2, zeilen: [erwartet, AUFRUF] });
      }
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });

  it('nennt eine fremde Option, statt sie als Abschnitt-Id zu lesen, und zeigt die Aufruf-Hilfe, Exit 2', async () => {
    const wurzel = temp();
    try {
      const kurzname = 'fixture-fremde-option';
      const datei = path.join(wurzel, 'lehrplan', `${kurzname}.yaml`);
      const text = lehrplanText([{ id: 'a1', status: 'offen' }]);
      writeFileSync(datei, text, 'utf8');
      for (const [argv, erwartet] of [
        // --vor gehoert zu pruefe-quelle.
        [['--name', kurzname, '--vor', 'a1'], 'Unbekannte Option --vor.'],
        [['--name', kurzname, 'a1', '--folien', '3'], 'Unbekannte Option --folien.'],
        [['--los', '--name', '../aussen', 'a1'], 'Unbekannte Option --los.'],
      ] as const) {
        expect(await lauf([...argv], wurzel)).toEqual({ code: 2, zeilen: [erwartet, AUFRUF] });
      }
      expect(readFileSync(datei, 'utf8')).toBe(text);
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });

  it('laesst eine Datei in anderer Form Byte fuer Byte stehen und meldet den Mangel, Exit 1', async () => {
    const wurzel = temp();
    try {
      const kurzname = 'fixture-andere-form';
      const datei = path.join(wurzel, 'lehrplan', `${kurzname}.yaml`);
      const vorlage = lehrplanText([
        { id: 'a1', status: 'offen' },
        { id: 'a2', status: 'offen' },
      ]);
      for (const text of [
        vorlage.replace(/^ {2}/gm, ''),
        vorlage.replace('  - id: a2\n    titel: "Titel a2"\n', '  - titel: "Titel a2"\n    id: a2\n'),
      ]) {
        writeFileSync(datei, text, 'utf8');
        for (const id of ['a1', 'a2']) {
          expect(await lauf(['--name', kurzname, id], wurzel)).toEqual({ code: 1, zeilen: [ANDERE_FORM] });
          expect(readFileSync(datei, 'utf8')).toBe(text);
        }
      }
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });

  it.runIf(SPERRE_GREIFT)('meldet eine Lehrplandatei, die sich nicht schreiben laesst, als Satz und bricht mit 1 ab', async () => {
    const wurzel = temp();
    const kurzname = 'fixture-schreibschutz';
    const datei = path.join(wurzel, 'lehrplan', `${kurzname}.yaml`);
    const text = lehrplanText([{ id: 'a1', status: 'offen' }]);
    writeFileSync(datei, text, 'utf8');
    const geschuetzt = schreibschutz(datei);
    try {
      expect(await lauf(['--name', kurzname, 'a1'], wurzel)).toEqual({
        code: 1,
        zeilen: [`lehrplan/${kurzname}.yaml lässt sich nicht schreiben (${geschuetzt.code}).`],
      });
      expect(readFileSync(datei, 'utf8')).toBe(text);
    } finally {
      geschuetzt.frei();
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

describe('werkzeug/auftrag.mjs direkt aufgerufen', () => {
  const WURZEL = path.resolve(__dirname, '..');

  // Wie npm run auftrag: node mit dem Pfad relativ zur Wurzel. Erkennte das
  // Werkzeug den Direktaufruf nicht, endete es wortlos mit 0. Ohne Argumente
  // liest es keine Datei.
  it('zeigt ohne Argumente die Aufruf-Hilfe und endet mit 2', () => {
    const lauf = spawnSync(process.execPath, ['werkzeug/auftrag.mjs'], { cwd: WURZEL, encoding: 'utf8' });
    expect(lauf.stderr).toBe('');
    expect(lauf.stdout).toBe(`${AUFRUF}\n`);
    expect(lauf.status).toBe(2);
  }, 30_000);
});
