// @vitest-environment node
import { afterAll, beforeAll, describe, it, expect } from 'vitest';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { abdeckung } from '../src/lib/abdeckung';
import { lehrplaeneAusTexten } from '../src/lib/lehrplan';
import { ladePdfjs } from '../werkzeug/adapter/dokument.mjs';
import { leseFolienEin } from '../werkzeug/adapter/folien.mjs';
import { fuehreAus as fuehreAuftragAus } from '../werkzeug/auftrag.mjs';
import { lektionsIdsAus } from '../werkzeug/lehrplan.mjs';
import { pruefeLektionsText } from '../werkzeug/pruefe-lektion.mjs';
import { fuehreAus as fuehrePruefeQuelleAus } from '../werkzeug/pruefe-quelle.mjs';
import { rohFolien, woerter } from '../werkzeug/wortlaut.mjs';

/**
 * Der Durchgang an Lehrmaterial als Ganzes, so wie der Compiler-Skill ihn
 * geht: einlesen, freigeben, beauftragen, vorpruefen, Prinzipien schreiben
 * und die Freigabe leeren, wieder freigeben, die Lektion bauen, nachpruefen —
 * und am Ende fuehrt die Abdeckung den Abschnitt mit seinen Lektionen.
 *
 * Jedes Werkzeug hat seine eigenen Tests, aber keiner haelt fest, dass die
 * Kette zusammen aufgeht: dass die Form, die der Skill fuer die Prinzipien
 * zeigt, durch Auftrag, beide Pruefungen und die Seite kommt, und dass eine
 * uebernommene Lektion am Ende ihren Lehrplaneintrag hat.
 *
 * Alles unter einem Temp-Verzeichnis als Wurzel, an der Fixture
 * `folien-agenda.pdf` — selbst erzeugt, ihr Text ist erfunden. Kein Test hier
 * liest lehrplan/, inhalt/ oder quellen/ im Projekt. Prinzipien, Grund und
 * Lektionen sind hier geschrieben; nur die Gegenprobe zum Wortlaut nimmt mit
 * Absicht einen Satz aus der Rohdatei.
 *
 * pdf.js wird einmal geladen und die Fixture einmal in eine Vorlage
 * eingelesen (Schritt 1); jeder Test arbeitet in seiner eigenen Kopie.
 */
const FIXTUREN = path.resolve(__dirname, 'fixtures');
const STEMPEL = '2026-09-26T08:00:00.000Z';
const K = 'fixture-durchgang';
const LEHRPLAN = `lehrplan/${K}.yaml`;

/** Die drei Abschnitte, die das Einlesen aus der Fixture schneidet. Beauftragt werden die ersten beiden. */
const ERSTER = 'd01-01-grundlagen-der-planung';
const ZWEITER = 'd01-02-kosten-und-termine';
const DRITTER = 'd01-03-risiken-im-projekt';

/** Die Lektion, die schon vor dem Durchgang da ist — ohne Lehrplaneintrag, bis Durchgang A sie uebernimmt. */
const UEBERNOMMEN = 'abweichung-frueh-melden';
/** Das Prinzip, dessen Lektion Durchgang B neu baut. */
const NEU = 'entscheiden-bleibt-beim-bauherrn';

/** Die Saetze der beiden Prinzipien. Der des uebernommenen ist der Satz seiner Lektion. */
const SAETZE = {
  uebernommen: 'Wer eine Abweichung erst meldet, wenn sie sicher ist, meldet sie zu spät, um noch gegenzusteuern.',
  neu: 'Der Bauherr kann die Steuerung des Projekts abgeben, seine Entscheidungen aber nicht.',
};

/** Der Vorbehalt am neuen Prinzip: Er wandert in dessen Lektion mit. */
const VORBEHALT = 'Die Folie nennt dafür keinen Beleg; wie weit eine Vollmacht reicht, regelt der Vertrag.';

/** Warum der zweite Abschnitt abgelehnt wird. */
const GRUND = 'Nur Kennwerte und ein Rechenbeispiel, keine Aussage, die sich lehren ließe.';

/** Die Freigabe: leer wie im Geruest und so, wie ein Mensch sie von Hand eintraegt. */
const OHNE_FREIGABE = 'geprueftVon: ""\ngeprueftAm: ""\n';
const MIT_FREIGABE = 'geprueftVon: "Abnahme"\ngeprueftAm: "2026-09-26"\n';

/** Der einzige Mangel nach Durchgang A: Die Freigabe ist geleert, sonst stimmt alles. */
const ERST_FREIGEBEN = `Erst freigeben: ${LEHRPLAN} wartet auf Freigabe (geprueftVon und geprueftAm).`;

/** Die Zeile, die --vor je beauftragtem Abschnitt schreibt — Folien und Listen aus dem Manifest der Fixture. */
const AUFTRAG_ERSTER = `  ${ERSTER} — quellen/${K}/roh/${ERSTER}.md, Folien 1–10 · nur Bild: 9 · Tabelle oder Grafik: –`;
const AUFTRAG_ZWEITER = `  ${ZWEITER} — quellen/${K}/roh/${ZWEITER}.md, Folien 11–18 · nur Bild: – · Tabelle oder Grafik: 14`;

/**
 * Eine Lektion, die `pruefeLektionsText` annimmt: `prinzip` ist der gegebene
 * Satz, der Vorbehalt steht nur da, wenn er gegeben ist. Dazu zwei
 * Wahlaufgaben, ein Transfer und eine Quelle — eigener Text, an dessen Inhalt
 * hier nichts haengt.
 */
function lektion(titel: string, prinzip: string, reihenfolge: number, vorbehalt?: string): string {
  return [
    '---',
    `titel: ${JSON.stringify(titel)}`,
    `prinzip: ${JSON.stringify(prinzip)}`,
    ...(vorbehalt === undefined ? [] : [`vorbehalt: ${JSON.stringify(vorbehalt)}`]),
    `reihenfolge: ${reihenfolge}`,
    'aufgaben:',
    '  - typ: wahl',
    '    id: erkennen',
    '    frage: "In welchem Fall entscheidet die Regel?"',
    '    antworten:',
    '      - text: "Im Fall, der an ihr hängt"',
    '        richtig: true',
    '        begruendung: "Dort ändert sich der Ausgang, sobald man die Regel weglässt."',
    '      - text: "Im Fall, der nur ähnlich klingt"',
    '        richtig: false',
    '        begruendung: "Er teilt die Begriffe, entschieden wird er aber woanders."',
    '      - text: "In keinem Fall"',
    '        richtig: false',
    '        begruendung: "Dann wäre die Regel ein Merksatz ohne jede Wirkung."',
    '  - typ: wahl',
    '    id: abgrenzen',
    '    frage: "Wo endet die Regel?"',
    '    antworten:',
    '      - text: "Wo ihr Grund wegfällt"',
    '        richtig: true',
    '        begruendung: "Ohne den Grund trägt die Regel keinen Fall mehr."',
    '      - text: "Am Ende der Folie"',
    '        richtig: false',
    '        begruendung: "Eine Folie begrenzt die Darstellung, nicht die Geltung."',
    '      - text: "Nirgends"',
    '        richtig: false',
    '        begruendung: "Jede Regel hat Grenzen, und wer sie nicht kennt, wendet sie falsch an."',
    'transfer:',
    '  typ: wahl',
    '  id: uebertragen',
    '  frage: "Was folgt daraus in einem Fall, den die Vorlesung nicht kennt?"',
    '  antworten:',
    '    - text: "Dasselbe, wenn der Grund derselbe ist"',
    '      richtig: true',
    '      begruendung: "Die Regel folgt ihrem Grund, nicht dem Beispiel, an dem man sie lernt."',
    '    - text: "Nichts, weil der Fall neu ist"',
    '      richtig: false',
    '      begruendung: "Ein neuer Fall ist genau der, für den man die Regel lernt."',
    '    - text: "Das Gegenteil"',
    '      richtig: false',
    '      begruendung: "Für eine Umkehr bräuchte es einen anderen Grund als den bekannten."',
    'quellen:',
    '  - pfad: "Fixture-Vorlesung, erfundene Folien"',
    '---',
    '',
    'Ein eigener Absatz, der die Regel an einem Fall erklärt, den jeder von der Baustelle kennt.',
    '',
  ].join('\n');
}

/** Die Lektion, die Durchgang A uebernimmt: Ihr prinzip ist der Satz, den das Prinzip von ihr bekommt. */
const LEKTION_UEBERNOMMEN = lektion('Früh melden', SAETZE.uebernommen, 1);

let geladen: Awaited<ReturnType<typeof ladePdfjs>>;
let eingelesen: Awaited<ReturnType<typeof leseFolienEin>>;
let vorlage = '';

beforeAll(async () => {
  geladen = await ladePdfjs();
  vorlage = mkdtempSync(path.join(tmpdir(), 'kernbohrung-durchgang-vorlage-'));
  mkdirSync(path.join(vorlage, 'lehrplan'), { recursive: true });
  // Schritt 1, wie in tests/einlesen-folien.test.ts: Geruest, Manifest, Rohdateien.
  eingelesen = await leseFolienEin({
    orte: [path.join(FIXTUREN, 'folien-agenda.pdf')],
    kurzname: K,
    titel: 'Fixture Durchgang',
    wurzel: vorlage,
    gestempeltAm: STEMPEL,
    geladen,
  });
  schreibeDatei(vorlage, `inhalt/lektionen/${UEBERNOMMEN}.mdx`, LEKTION_UEBERNOMMEN);
});

afterAll(() => {
  if (vorlage) rmSync(vorlage, { recursive: true, force: true });
});

/** Eine eigene Kopie der Vorlage. */
function kopie(): string {
  const wurzel = mkdtempSync(path.join(tmpdir(), 'kernbohrung-durchgang-'));
  cpSync(vorlage, wurzel, { recursive: true });
  return wurzel;
}

/** Eine Datei unter `wurzel`, `rel` mit Schraegstrichen. */
function lies(wurzel: string, rel: string): string {
  return readFileSync(path.join(wurzel, ...rel.split('/')), 'utf8');
}

/** Schreibt eine Datei unter `wurzel` und legt ihren Ordner an, wenn er fehlt. */
function schreibeDatei(wurzel: string, rel: string, text: string): void {
  const ziel = path.join(wurzel, ...rel.split('/'));
  mkdirSync(path.dirname(ziel), { recursive: true });
  writeFileSync(ziel, text, 'utf8');
}

/** Aendert den Lehrplan unter `wurzel` von Hand, wie ein Mensch oder der Compiler im Editor. */
function lehrplanAendern(wurzel: string, aendern: (text: string) => string): void {
  schreibeDatei(wurzel, LEHRPLAN, aendern(lies(wurzel, LEHRPLAN)));
}

/** Traegt die Freigabe ein: die beiden leeren Zeilen des Geruests, von Hand gefuellt. */
function freigeben(text: string): string {
  expect(text).toContain(OHNE_FREIGABE);
  return text.replace(OHNE_FREIGABE, MIT_FREIGABE);
}

/** Leert die Freigabe wieder, wie der Compiler, nachdem er Prinzipien geschrieben hat. */
function freigabeLeeren(text: string): string {
  expect(text).toContain(MIT_FREIGABE);
  return text.replace(MIT_FREIGABE, OHNE_FREIGABE);
}

/**
 * Ersetzt im Block eines Abschnitts — von seiner id-Zeile bis zur naechsten
 * mit zwei Leerzeichen Einzug — `alt` durch `neu`. Steht `alt` dort nicht
 * genau einmal, bricht der Test ab: Ein replace, das nichts ersetzt, liesse
 * ihn still etwas anderes pruefen.
 */
function imAbschnitt(text: string, id: string, alt: string, neu: string): string {
  const start = text.indexOf(`\n  - id: ${id}\n`) + 1;
  expect(start).toBeGreaterThan(0);
  const naechster = text.indexOf('\n  - id: ', start);
  const ende = naechster === -1 ? text.length : naechster + 1;
  const block = text.slice(start, ende);
  expect(block.split(alt)).toHaveLength(2);
  return text.slice(0, start) + block.replace(alt, neu) + text.slice(ende);
}

/**
 * Durchgang A in der Form, die der Skill zeigt: im ersten Abschnitt unter
 * `status` die `prinzipien:` mit vier Leerzeichen Einzug, jedes Prinzip mit
 * sechs — erst das uebernommene, dann das neue mit Vorbehalt. Der zweite
 * Abschnitt wird mit Grund abgelehnt.
 */
function prinzipienSchreiben(text: string, saetze: { uebernommen: string; neu: string }): string {
  const mitPrinzipien = imAbschnitt(
    text,
    ERSTER,
    '    status: beauftragt\n',
    [
      '    status: beauftragt',
      '    prinzipien:',
      `      - id: ${UEBERNOMMEN}`,
      `        satz: ${JSON.stringify(saetze.uebernommen)}`,
      '        warumNichtOffensichtlich: "Eine unsichere Meldung wirkt voreilig; eine späte kostet die Wahl der Mittel."',
      `        belege: ["roh/${ERSTER}.md, Folien 3–7"]`,
      `      - id: ${NEU}`,
      `        satz: ${JSON.stringify(saetze.neu)}`,
      '        warumNichtOffensichtlich: "Wer einen Steuerer beauftragt, hält ihn leicht auch für den, der entscheidet."',
      `        belege: ["roh/${ERSTER}.md, Folie 8"]`,
      `        vorbehalt: ${JSON.stringify(VORBEHALT)}`,
      '',
    ].join('\n'),
  );
  return imAbschnitt(mitPrinzipien, ZWEITER, '    status: beauftragt\n', `    status: abgelehnt\n    grund: ${JSON.stringify(GRUND)}\n`);
}

type Werkzeug = (argv: readonly string[], wurzel: string, schreibe?: (zeile: string) => void) => Promise<number>;

/** Ein Lauf eines Werkzeugs unter `wurzel`: Rueckgabewert und Zeilen, statt sie zu drucken. */
async function lauf(werkzeug: Werkzeug, argv: string[], wurzel: string): Promise<{ code: number; zeilen: string[] }> {
  const zeilen: string[] = [];
  const code = await werkzeug(argv, wurzel, (zeile: string) => zeilen.push(zeile));
  return { code, zeilen };
}

const vor = (wurzel: string) => lauf(fuehrePruefeQuelleAus, ['--name', K, '--vor'], wurzel);
const nach = (wurzel: string) => lauf(fuehrePruefeQuelleAus, ['--name', K, '--nach'], wurzel);

/**
 * Schritte 2 bis 4 — was vor Durchgang A geschieht: Der Mensch gibt frei und
 * beauftragt die ersten beiden Abschnitte, dann `--vor`. Beide Laeufe enden
 * ohne Mangel.
 */
async function freigegebenUndBeauftragt(wurzel: string): Promise<void> {
  lehrplanAendern(wurzel, freigeben);
  expect(await lauf(fuehreAuftragAus, ['--name', K, ERSTER, ZWEITER], wurzel)).toEqual({
    code: 0,
    zeilen: [
      `${LEHRPLAN}: 2 Abschnitte beauftragt`,
      `  ${ERSTER}`,
      `  ${ZWEITER}`,
      `Nächster Schritt: Durchgang A — „Bau die Lektionen für ${K}“.`,
    ],
  });
  expect(await vor(wurzel)).toEqual({
    code: 0,
    zeilen: [`${LEHRPLAN}: freigegeben, Stand passt zum Manifest.`, 'Beauftragt: 2 Abschnitte', AUFTRAG_ERSTER, AUFTRAG_ZWEITER],
  });
}

/** Schritt 5 — Durchgang A: Prinzipien schreiben, die Freigabe leeren, dann `--vor`, wie der Skill es verlangt. */
function durchgangA(wurzel: string, saetze = SAETZE) {
  lehrplanAendern(wurzel, (text) => freigabeLeeren(prinzipienSchreiben(text, saetze)));
  return vor(wurzel);
}

/** Schritt 6 — der Mensch gibt wieder frei; `--vor` endet ohne Mangel, beauftragt ist nur noch der erste Abschnitt. */
async function wiederFreigegeben(wurzel: string): Promise<void> {
  lehrplanAendern(wurzel, freigeben);
  expect(await vor(wurzel)).toEqual({
    code: 0,
    zeilen: [`${LEHRPLAN}: freigegeben, Stand passt zum Manifest.`, 'Beauftragt: 1 Abschnitt', AUFTRAG_ERSTER],
  });
}

/**
 * Schritt 7 — Durchgang B: die Lektion zum neuen Prinzip, geprueft wie vor
 * dem Schreiben; die uebernommene bleibt, wie sie ist. Dann der erste
 * Abschnitt auf lektion und `--nach`.
 */
function durchgangB(wurzel: string, neueLektion: string) {
  const befund = pruefeLektionsText(neueLektion);
  if (!befund.ok) throw new Error(`Die Lektion selbst ist ungueltig:\n  ${befund.maengel.join('\n  ')}`);
  schreibeDatei(wurzel, `inhalt/lektionen/${NEU}.mdx`, neueLektion);
  lehrplanAendern(wurzel, (text) => imAbschnitt(text, ERSTER, '    status: beauftragt\n', '    status: lektion\n'));
  return nach(wurzel);
}

/**
 * Lehrplaene und Abdeckung aus den Dateien unter `wurzel`, wie die Seite
 * /bibliothek sie liest — ohne Manifeste, wie der Bestandstest.
 */
function bestandUnter(wurzel: string) {
  const lektionsIds = lektionsIdsAus(path.join(wurzel, 'inhalt', 'lektionen'));
  const texte = Object.fromEntries(
    readdirSync(path.join(wurzel, 'lehrplan'))
      .filter((name) => name.endsWith('.yaml'))
      .map((name) => [`/lehrplan/${name}`, lies(wurzel, `lehrplan/${name}`)]),
  );
  const lehrplaene = lehrplaeneAusTexten(texte, lektionsIds);
  return { ...lehrplaene, ...abdeckung([...lehrplaene.gueltig, ...lehrplaene.wartend], new Map(), lektionsIds) };
}

describe('der Durchgang an Lehrmaterial', () => {
  it('geht vom Einlesen bis --nach auf, und die Abdeckung fuehrt den Abschnitt mit beiden Lektionen', async () => {
    const wurzel = kopie();
    try {
      // 1. Eingelesen: ein Geruest, das auf die Freigabe wartet, das Manifest und je Abschnitt eine Rohdatei.
      expect(eingelesen.abschnitte.map((a) => a.id)).toEqual([ERSTER, ZWEITER, DRITTER]);
      expect(eingelesen.lehrplan.geschrieben).toBe(true);
      expect(lies(wurzel, LEHRPLAN)).toContain(OHNE_FREIGABE);
      expect(existsSync(path.join(wurzel, 'quellen', K, 'manifest.json'))).toBe(true);
      expect(readdirSync(path.join(wurzel, 'quellen', K, 'roh')).sort()).toEqual([`${ERSTER}.md`, `${ZWEITER}.md`, `${DRITTER}.md`]);
      // Die Lektion, die Durchgang A uebernimmt, steht noch ohne Lehrplaneintrag da.
      expect(bestandUnter(wurzel).ohneLehrplan).toEqual([UEBERNOMMEN]);

      // 2. bis 4. Freigabe, Auftrag, --vor.
      await freigegebenUndBeauftragt(wurzel);

      // 5. Durchgang A. Ausser „Erst freigeben" darf nichts kommen.
      expect(await durchgangA(wurzel)).toEqual({ code: 1, zeilen: [ERST_FREIGEBEN] });

      // 6. Wieder freigegeben: --vor ohne Mangel.
      await wiederFreigegeben(wurzel);

      // 7. Durchgang B: Die uebernommene Lektion wird nur geprueft, nicht neu gebaut. Die neue
      // traegt als prinzip den Satz ihres Prinzips, und der Vorbehalt wandert mit.
      expect(pruefeLektionsText(lies(wurzel, `inhalt/lektionen/${UEBERNOMMEN}.mdx`)).ok).toBe(true);
      expect(await durchgangB(wurzel, lektion('Entscheiden bleibt', SAETZE.neu, 2, VORBEHALT))).toEqual({
        code: 0,
        zeilen: [`${LEHRPLAN}: kein Abschnitt mehr beauftragt, alle Lektionen da, Wortlaut in Ordnung.`],
      });

      // 8. Die Seite: der Lehrplan gueltig, der erste Abschnitt mit beiden Lektionen, keine Lektion ohne Eintrag.
      const { gueltig, wartend, ungueltig, bestand, ohneLehrplan } = bestandUnter(wurzel);
      expect(ungueltig).toEqual([]);
      expect(wartend).toEqual([]);
      expect(gueltig.map((l) => l.quelle)).toEqual([K]);
      expect(bestand[0]?.zaehlung).toEqual({ gesamt: 3, mitLektion: 1, offen: 1, beauftragt: 0, abgelehnt: 1 });
      expect(bestand[0]?.zeilen.map((z) => [z.id, z.status, z.lektionen, z.vorbehalte])).toEqual([
        [ERSTER, 'lektion', [UEBERNOMMEN, NEU], [VORBEHALT]],
        [ZWEITER, 'abgelehnt', [], []],
        [DRITTER, 'offen', [], []],
      ]);
      expect(ohneLehrplan).toEqual([]);
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });

  it('Gegenprobe: Traegt die neue Lektion ein anderes prinzip, endet --nach mit 1 und nennt sie', async () => {
    const wurzel = kopie();
    try {
      await freigegebenUndBeauftragt(wurzel);
      expect(await durchgangA(wurzel)).toEqual({ code: 1, zeilen: [ERST_FREIGEBEN] });
      await wiederFreigegeben(wurzel);
      const andere = lektion('Entscheiden bleibt', 'Ein anderer Satz als der des Prinzips.', 2, VORBEHALT);
      expect(await durchgangB(wurzel, andere)).toEqual({
        code: 1,
        zeilen: [`Lektion ${NEU}: prinzip ist nicht der Satz des Prinzips in ${LEHRPLAN}.`],
      });
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });

  it('Gegenprobe: Steht ein Satz aus der Rohdatei als satz im Lehrplan, meldet --vor neben der Freigabe den Wortlaut', async () => {
    const wurzel = kopie();
    try {
      await freigegebenUndBeauftragt(wurzel);
      // Die zwei Aufzaehlungspunkte unter dem Titel der Folie 3, ohne ihre Zeichen:
      // ein Satz, wie ihn der Compiler von der Folie abschriebe.
      const folie = rohFolien(lies(wurzel, `quellen/${K}/roh/${ERSTER}.md`)).find((f) => f.nummer === 3);
      if (folie === undefined) throw new Error('Erwartet war Folie 3 in der Rohdatei.');
      const abgeschrieben = folie.text
        .split('\n')
        .slice(1, 3)
        .map((zeile) => zeile.replace(/^\u2022\s*/, ''))
        .join(' ');
      const anzahl = woerter(abgeschrieben).filter((w) => !w.zahl).length;
      expect(anzahl).toBeGreaterThanOrEqual(13);
      expect(await durchgangA(wurzel, { ...SAETZE, neu: abgeschrieben })).toEqual({
        code: 1,
        zeilen: [
          ERST_FREIGEBEN,
          `${LEHRPLAN}: Wortlaut: 13 Wörter am Stück wie in ${K}/${ERSTER}, Folie 3 — Feld ${NEU}.satz, Wörter 1–${anzahl}.`,
        ],
      });
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });

  it('Gegenprobe: Weicht der Satz des uebernommenen Prinzips leicht von seiner Lektion ab, meldet --vor ihn neben der Freigabe', async () => {
    const wurzel = kopie();
    try {
      await freigegebenUndBeauftragt(wurzel);
      expect(SAETZE.uebernommen).toContain('eine Abweichung');
      const geglaettet = SAETZE.uebernommen.replace('eine Abweichung', 'eine Planabweichung');
      expect(await durchgangA(wurzel, { ...SAETZE, uebernommen: geglaettet })).toEqual({
        code: 1,
        zeilen: [
          ERST_FREIGEBEN,
          `Prinzip ${UEBERNOMMEN}: inhalt/lektionen/${UEBERNOMMEN}.mdx hat einen anderen Satz — übernehmen heißt: ihr Satz; sonst eine andere Id.`,
        ],
      });
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });
});
