// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pruefeLektionsText, pruefeWortlaut } from '../werkzeug/pruefe-lektion.mjs';
import { baueIndex, rohFolien } from '../werkzeug/wortlaut.mjs';

/**
 * Die Schranke, die entscheidet, was ausgeliefert wird.
 *
 * Sie prueft beides an einer Stelle: das Frontmatter gegen LektionSchema und
 * jeden Widget-Aufruf im Rumpf gegen pruefeWidget. Der Compiler-Skill ruft sie
 * auf, BEVOR er eine Datei nach `inhalt/lektionen/` schreibt.
 */

const gute = `---
titel: "Ein Prinzip"
prinzip: "Ein Satz, der etwas behauptet."
reihenfolge: 2
gesperrt: false
aufgaben:
  - typ: wahl
    id: p-1
    frage: "Erste Frage?"
    antworten:
      - text: "Richtig"
        richtig: true
        begruendung: "Diese Begruendung hat mehr als fuenf Woerter."
      - text: "Falsch A"
        richtig: false
        begruendung: "Auch diese Begruendung hat genug Woerter darin."
      - text: "Falsch B"
        richtig: false
        begruendung: "Und diese hier ebenfalls, mit genug Woertern."
  - typ: wahl
    id: p-2
    frage: "Zweite Frage?"
    antworten:
      - text: "Richtig"
        richtig: true
        begruendung: "Die zweite Frage braucht eigene Begruendungen hier."
      - text: "Falsch A"
        richtig: false
        begruendung: "Auch fuer sie gilt: genug Woerter, eigener Text."
      - text: "Falsch B"
        richtig: false
        begruendung: "Und diese dritte unterscheidet sich ebenfalls davon."
transfer:
  typ: wahl
  id: p-t
  frage: "Transferfrage?"
  antworten:
    - text: "Richtig"
      richtig: true
      begruendung: "Der Transfer traegt wiederum eigene Begruendungen mit."
    - text: "Falsch A"
      richtig: false
      begruendung: "Diese hier steht nur an dieser einen Stelle so."
    - text: "Falsch B"
      richtig: false
      begruendung: "Und die letzte unterscheidet sich von allen anderen."
quellen:
  - pfad: "rag_tutorials/corrective_rag"
---

Ein Widerspruch in Prosa.
`;

/**
 * Liest die Maengel aus einem Ergebnis, das fehlschlagen musste.
 *
 * Derselbe Griff wie in `tests/widget-pruefung.test.ts`: `expect(e.ok).toBe(false)`
 * ueberzeugt zwar den Testlauf, verengt aber die Union nicht — `astro check`
 * kennt `maengel` danach immer noch nicht. Die Verengung muss im Typsystem
 * stattfinden, nicht in der Zusicherung.
 */
function maengelVon(ergebnis: ReturnType<typeof pruefeLektionsText>): readonly string[] {
  if (ergebnis.ok) throw new Error('Erwartet war ein Fehlschlag, die Pruefung war aber zufrieden.');
  return ergebnis.maengel;
}

describe('pruefeLektionsText', () => {
  it('nimmt eine gueltige Lektion an', () => {
    const e = pruefeLektionsText(gute);
    if (!e.ok) throw new Error(`Erwartet war Erfolg, gemeldet wurde:\n  ${e.maengel.join('\n  ')}`);
    expect(e.ok).toBe(true);
    expect(e.daten.titel).toBe('Ein Prinzip');
  });

  it('lehnt zwei richtige Antworten ab und sagt warum', () => {
    const kaputt = gute.replace(
      'text: "Falsch A"\n        richtig: false',
      'text: "Falsch A"\n        richtig: true',
    );
    const maengel = maengelVon(pruefeLektionsText(kaputt));
    expect(maengel.join(' ')).toMatch(/genau eine/i);
  });

  it('lehnt eine Lektion ohne Frontmatter ab', () => {
    const maengel = maengelVon(pruefeLektionsText('Nur Prosa, kein Frontmatter.'));
    expect(maengel.join(' ')).toMatch(/frontmatter/i);
  });

  it('lehnt kaputtes YAML ab, ohne abzustuerzen', () => {
    const maengel = maengelVon(pruefeLektionsText('---\ntitel: "unbeendet\n---\n'));
    expect(maengel.length).toBeGreaterThan(0);
  });

  it('meldet einen ungueltigen Widget-Aufruf im Rumpf', () => {
    const mitWidget = gute + '\n<Pipeline schritte={[]} ergebnisse={[]} />\n';
    const maengel = maengelVon(pruefeLektionsText(mitWidget));
    expect(maengel.join(' ')).toMatch(/Pipeline/);
  });

  it('meldet einen unbekannten Widget-Namen im Rumpf', () => {
    const mitWidget = gute + '\n<GibtEsNicht foo={1} />\n';
    const maengel = maengelVon(pruefeLektionsText(mitWidget));
    expect(maengel.join(' ')).toMatch(/GibtEsNicht/);
  });

  /**
   * Der Fall, der unter Windows lautlos danebengeht.
   *
   * Das Projekt laeuft mit `autocrlf=true`; die von Hand geschriebene Lektion
   * unter `inhalt/lektionen/` hat tatsaechlich CRLF. Ein Frontmatter-Muster
   * ohne `\r?` findet dort keinen Kopf und meldet „kein Frontmatter" — bei
   * einer vollkommen gueltigen Datei.
   *
   * Beide Formen werden aus einer erst auf LF vereinheitlichten Vorlage
   * gebaut, nicht aus `gute` direkt. Sonst haengt der Test daran, wie git
   * diese Testdatei gerade ausgecheckt hat: Bei `autocrlf=true` traegt sie
   * nach einem frischen Klon selbst CRLF, ein blindes `\n` → `\r\n` erzeugte
   * daraus `\r\r\n`, und der Test fiele um — nicht wegen der Pruefung,
   * sondern wegen seiner eigenen Vorlage.
   */
  const alsLf = gute.replace(/\r\n/g, '\n');
  const alsCrlf = alsLf.replace(/\n/g, '\r\n');

  it('erkennt das Frontmatter bei LF-Zeilenenden', () => {
    expect(alsLf).not.toContain('\r');
    const e = pruefeLektionsText(alsLf);
    if (!e.ok) throw new Error(`LF bricht das Frontmatter:\n  ${e.maengel.join('\n  ')}`);
    expect(e.daten.titel).toBe('Ein Prinzip');
  });

  it('erkennt das Frontmatter auch bei CRLF-Zeilenenden', () => {
    expect(alsCrlf).toContain('\r\n');
    expect(alsCrlf).not.toContain('\r\r');
    const e = pruefeLektionsText(alsCrlf);
    if (!e.ok) throw new Error(`CRLF bricht das Frontmatter:\n  ${e.maengel.join('\n  ')}`);
    expect(e.daten.titel).toBe('Ein Prinzip');
  });

  /**
   * Widget-Parameter stehen im echten Material ueber viele Zeilen und
   * enthalten geschachtelte Klammern. Genau daran scheitert ein selbstgebauter
   * Halbparser — deshalb steht der Fall hier und nicht nur im einzeiligen
   * Beispiel oben.
   */
  it('wertet mehrzeilige, geschachtelte Widget-Parameter aus', () => {
    const mitWidget =
      gute +
      `
<Pipeline
  einheit="Dokument"
  schritte={[
    { id: 'suche', titel: 'Suche', wirkung: 'Holt Kandidaten.' },
    { id: 'bm25', titel: '+ BM25', wirkung: 'Sucht woertlich.', optional: true, standardAn: false },
    { id: 'kontext', titel: 'Top 5', wirkung: 'Nur die sieht das Modell.' }
  ]}
  ergebnisse={[
    { wenn: [], ausgabe: [{ text: 'A', treffer: false }], hinweis: 'ohne BM25' },
    { wenn: ['bm25'], ausgabe: [{ text: 'B', treffer: true }], hinweis: 'mit BM25' }
  ]}
/>
`;
    const e = pruefeLektionsText(mitWidget);
    if (!e.ok) throw new Error(`Erwartet war Erfolg, gemeldet wurde:\n  ${e.maengel.join('\n  ')}`);
    expect(e.ok).toBe(true);
  });
});

/**
 * Der Wortlaut: dreizehn Woerter am Stueck wie in einer Rohdatei sind ein
 * Mangel. Die Rohdateien hier sind synthetisch, ihr Text ist erfunden; kein
 * Test liest `quellen/` im Projekt.
 */
const SATZ = 'Die Bauleiterin prüft morgens die Lieferscheine, bevor die Kolonne mit der Arbeit beginnt.';

/** Eine Rohdatei in der Form des Einlesens: Kopf, dann Seitenmarken. */
const ROH = [
  '# Probe',
  '',
  'Probe.pdf, Folien 4–5',
  '',
  '— Folie 4 —',
  'Morgens auf der Baustelle',
  '',
  '— Folie 5 —',
  'Die Bauleiterin prüft morgens die Lieferscheine,',
  'bevor die Kolonne mit der Arbeit beginnt.',
  '',
].join('\n');

/** `gute` mit dem Satz als eigenem Absatz: Der Rumpf hat davor vier eigene Woerter. */
const abschrift = `${gute}\n${SATZ}\n`;

const MELDUNG = 'Wortlaut: 13 Wörter am Stück wie in probe/x01-01-probe, Folie 5 — Feld rumpf, Wörter 5–17.';

describe('pruefeWortlaut', () => {
  it('meldet eine Abschrift mit Quelle, Folie, Feld und Wortbereich, nie mit Text', () => {
    const index = baueIndex([{ quelle: 'probe', abschnitt: 'x01-01-probe', folien: rohFolien(ROH) }]);
    const maengel = pruefeWortlaut(abschrift, index);
    expect(maengel).toEqual([MELDUNG]);
    expect(maengel[0]).not.toMatch(/Bauleiterin|Lieferscheine|Kolonne/);
    expect(pruefeWortlaut(gute, index)).toEqual([]);
  });

  it('nennt bei einer Rohdatei ohne Seitenmarken keine Folie', () => {
    const index = baueIndex([{ quelle: 'repo', abschnitt: 'variante', folien: rohFolien(`Ein Absatz.\n\n${SATZ}\n`) }]);
    expect(pruefeWortlaut(abschrift, index)).toEqual([
      'Wortlaut: 13 Wörter am Stück wie in repo/variante — Feld rumpf, Wörter 5–17.',
    ]);
  });
});

describe('werkzeug/pruefe-lektion.mjs', () => {
  const SKRIPT = path.resolve(__dirname, '..', 'werkzeug', 'pruefe-lektion.mjs');

  /** Startet die Pruefung mit `wurzel` als Arbeitsverzeichnis, wie `npm run pruefe-lektion` im Projekt. */
  function pruefe(wurzel: string, ...dateien: string[]): { code: number | null; aus: string; fehler: string } {
    const lauf = spawnSync(process.execPath, [SKRIPT, ...dateien], { cwd: wurzel, encoding: 'utf8' });
    return { code: lauf.status, aus: lauf.stdout, fehler: lauf.stderr };
  }

  /** Ein Temp-Wurzelordner mit drei Lektionen, auf Wunsch mit zwei Rohdateien unter `quellen/`. */
  function wurzel(mitRohdateien: boolean): string {
    const ordner = mkdtempSync(path.join(tmpdir(), 'kernbohrung-pruefe-lektion-'));
    writeFileSync(path.join(ordner, 'sauber.mdx'), gute, 'utf8');
    writeFileSync(path.join(ordner, 'abschrift.mdx'), abschrift, 'utf8');
    writeFileSync(path.join(ordner, 'beides.mdx'), `${gute}\n<GibtEsNicht foo={1} />\n\n${SATZ}\n`, 'utf8');
    if (mitRohdateien) {
      const roh = path.join(ordner, 'quellen', 'probe', 'roh');
      mkdirSync(roh, { recursive: true });
      writeFileSync(path.join(roh, 'x01-01-probe.md'), ROH, 'utf8');
      writeFileSync(path.join(roh, 'x01-02-anderes.md'), '# Anderes\n\n— Folie 9 —\nNichts davon.\n', 'utf8');
    }
    return ordner;
  }

  it('meldet eine Abschrift woertlich als Mangel und endet mit 1', () => {
    const w = wurzel(true);
    try {
      const { code, aus, fehler } = pruefe(w, 'abschrift.mdx');
      expect(fehler).toBe(`abschrift.mdx: 1 Mangel/Mängel\n\n  - ${MELDUNG}\n`);
      expect(aus).toBe('');
      expect(code).toBe(1);
    } finally {
      rmSync(w, { recursive: true, force: true });
    }
  });

  it('meldet ohne Treffer den Wortlaut in Ordnung und endet mit 0', () => {
    const w = wurzel(true);
    try {
      const { code, aus, fehler } = pruefe(w, 'sauber.mdx');
      expect(aus).toBe('sauber.mdx: in Ordnung\nWortlaut: in Ordnung (2 Rohdateien).\n');
      expect(fehler).toBe('');
      expect(code).toBe(0);
    } finally {
      rmSync(w, { recursive: true, force: true });
    }
  });

  it('sagt ohne quellen/ nicht geprueft statt in Ordnung, und das ist kein Mangel', () => {
    const w = wurzel(false);
    try {
      const { code, aus, fehler } = pruefe(w, 'sauber.mdx', 'abschrift.mdx');
      expect(aus).toBe(
        'sauber.mdx: in Ordnung\nabschrift.mdx: in Ordnung\nWortlaut nicht geprüft: keine Rohdateien am Rechner.\n',
      );
      expect(fehler).toBe('');
      expect(code).toBe(0);
    } finally {
      rmSync(w, { recursive: true, force: true });
    }
  });

  it('prueft mehrere Dateien in einem Aufruf, den Wortlaut nach Schema und Widgets', () => {
    const w = wurzel(true);
    try {
      const { code, aus, fehler } = pruefe(w, 'sauber.mdx', 'abschrift.mdx', 'beides.mdx');
      expect(aus).toBe('sauber.mdx: in Ordnung\n');
      const zeilen = fehler.split('\n');
      expect(zeilen.slice(0, 4)).toEqual(['abschrift.mdx: 1 Mangel/Mängel', '', `  - ${MELDUNG}`, 'beides.mdx: 2 Mangel/Mängel']);
      expect(zeilen[5]).toMatch(/^ {2}- Unbekanntes Widget "GibtEsNicht"/);
      expect(zeilen.slice(6)).toEqual([`  - ${MELDUNG}`, '']);
      expect(code).toBe(1);
    } finally {
      rmSync(w, { recursive: true, force: true });
    }
  });

  it('zeigt ohne Datei den Aufruf und endet mit 2', () => {
    const w = wurzel(false);
    try {
      const { code, aus, fehler } = pruefe(w);
      expect(fehler).toBe('Aufruf: node werkzeug/pruefe-lektion.mjs <datei.mdx> [<datei.mdx> …]\n');
      expect(aus).toBe('');
      expect(code).toBe(2);
    } finally {
      rmSync(w, { recursive: true, force: true });
    }
  });
});
