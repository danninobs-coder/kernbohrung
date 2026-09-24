// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import type { PathLike, RmOptions } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { load as yamlLesen } from 'js-yaml';
import { PDFDocument, PDFHexString, StandardFonts, degrees } from 'pdf-lib';
import { ladePdfjs } from '../werkzeug/adapter/dokument.mjs';
import {
  EinleseFehler,
  NUR_BILD_ZEILE,
  WARNZEILE,
  leseFolienEin,
  natuerlich,
  rohdatei,
  sammlePdfs,
  tausche,
} from '../werkzeug/adapter/folien.mjs';
import type { Dateisystem } from '../werkzeug/adapter/folien.mjs';
import { lehrplanGeruest, vergleicheLehrplan, vergleichInZeilen } from '../werkzeug/lehrplan-geruest.mjs';
import { lehrplaeneAusTexten, pruefeLehrplan } from '../src/lib/lehrplan';
import { manifesteAusTexten } from '../src/lib/manifestauszug';
import { abdeckung } from '../src/lib/abdeckung';
import { freigabezeile, lueckenzeile, zahlenzeile } from '../src/lib/bestandstext';

/**
 * Das Einlesen als Ganzes — gegen ein Temp-Verzeichnis, an den Fixtures.
 *
 * Kein Test schreibt ins Projekt und keiner liest `quellen/`: Der Ordner ist
 * gitignored, auf GitHub gibt es ihn nicht. Was hier entsteht, entsteht in
 * einem Verzeichnis, das am Ende wieder verschwindet.
 *
 * pdf.js wird einmal geladen und durchgereicht; jeder Lauf laedt es sonst neu.
 */
const FIXTUREN = path.resolve(__dirname, 'fixtures');
const STEMPEL = '2026-09-23T08:00:00.000Z';

let geladen: Awaited<ReturnType<typeof ladePdfjs>>;
beforeAll(async () => {
  geladen = await ladePdfjs();
});

/** Ein leeres Arbeitsverzeichnis mit `lehrplan/` darin. */
function temp(): string {
  const ordner = mkdtempSync(path.join(tmpdir(), 'kernbohrung-einlesen-'));
  mkdirSync(path.join(ordner, 'lehrplan'), { recursive: true });
  return ordner;
}

const lies = (...teile: string[]) => readFileSync(path.join(...teile), 'utf8');

/**
 * Liest die beiden Foliensaetze mit Agenda und Titellaeufen als eine Quelle
 * ein — auf Wunsch mit einem Dateisystem, das an einer Stelle scheitert.
 */
const einlesen = (
  wurzel: string,
  orte = [path.join(FIXTUREN, 'folien-agenda.pdf'), path.join(FIXTUREN, 'folien-laeufe.pdf')],
  dateisystem?: Partial<Dateisystem>,
) =>
  leseFolienEin({
    orte,
    kurzname: 'fixture-vorlesung',
    titel: 'Fixture-Vorlesung Projektmanagement',
    wurzel,
    gestempeltAm: STEMPEL,
    geladen,
    dateisystem,
  });

/** Jede Datei unter `ordner` mit dem Hash ihres Inhalts — auch in Ordnern mit Punkt vorne. */
function schnappschuss(ordner: string): Record<string, string> {
  const aus: Record<string, string> = {};
  const gehe = (rel: string) => {
    for (const eintrag of readdirSync(path.join(ordner, rel), { withFileTypes: true })) {
      const teil = rel ? `${rel}/${eintrag.name}` : eintrag.name;
      if (eintrag.isDirectory()) gehe(teil);
      else aus[teil] = createHash('sha256').update(readFileSync(path.join(ordner, teil))).digest('hex');
    }
  };
  if (existsSync(ordner)) gehe('');
  return aus;
}

/** Der Abbruch eines Laufs — damit sein Wortlaut ganz geprueft werden kann und nicht nur ein Stueck davon. */
async function abbruch(lauf: Promise<unknown>): Promise<Error> {
  try {
    await lauf;
  } catch (fehler) {
    return fehler as Error;
  }
  throw new Error('Erwartet war ein Abbruch.');
}

/** Ein Fehler, wie Node ihn fuer einen gescheiterten Systemaufruf meldet: mit `code` und `syscall`. */
const systemfehler = (code: string, syscall: string) => Object.assign(new Error(`${code}: ${syscall}`), { code, syscall });

/**
 * Ein Dateisystem, dessen Umbenennen scheitert, wenn die Quelle so heisst wie
 * ein Schluessel: mit einem Code jedes Mal, mit einer Liste von Codes der
 * Reihe nach und danach nicht mehr. Gewartet wird nicht wirklich:
 * `wartezeiten` haelt fest, wie lange es gewesen waere, `versuche`, was
 * umbenannt werden sollte.
 */
function umbenennenScheitertBei(codes: Record<string, string | string[]>) {
  const offen = new Map(Object.entries(codes).map(([name, code]) => [name, Array.isArray(code) ? [...code] : code] as const));
  const versuche: string[] = [];
  const wartezeiten: number[] = [];
  return {
    versuche,
    wartezeiten,
    renameSync: (von: PathLike, nach: PathLike) => {
      const name = path.basename(String(von));
      versuche.push(name);
      const code = offen.get(name);
      const jetzt = Array.isArray(code) ? code.shift() : code;
      if (jetzt) throw systemfehler(jetzt, 'rename');
      renameSync(von, nach);
    },
    rmSync,
    warte: (ms: number) => {
      wartezeiten.push(ms);
    },
  };
}

/** Ein PDF aus pdf-lib, dessen einzige Seite um 90 Grad gedreht ist. Der Text ist erfunden. */
async function gedrehtesPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const seite = doc.addPage([842, 595]);
  seite.setRotation(degrees(90));
  seite.drawText('Erfundener Text', { x: 50, y: 300, size: 12, font: await doc.embedFont(StandardFonts.Helvetica) });
  return doc.save();
}

/**
 * Ein PDF, das ein Passwort verlangt. pdf-lib verschluesselt nicht — ein
 * Encrypt-Eintrag, zu dem das leere Passwort nicht passt, genuegt aber, damit
 * pdf.js nach einem fragt.
 */
async function pdfMitPasswort(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.addPage([842, 595]);
  const nullen = (n: number) => PDFHexString.of('00'.repeat(n));
  const schloss = doc.context.obj({ Filter: 'Standard', V: 1, R: 2, O: nullen(32), U: nullen(32), P: -4 });
  doc.context.trailerInfo.Encrypt = doc.context.register(schloss);
  doc.context.trailerInfo.ID = doc.context.obj([nullen(16), nullen(16)]);
  return doc.save({ useObjectStreams: false });
}

describe('sammlePdfs', () => {
  it('nimmt alle PDF einer Mappe in natuerlicher Reihenfolge', () => {
    const ordner = temp();
    try {
      for (const name of ['M10 b.pdf', 'M2 a.pdf', 'notizen.txt']) writeFileSync(path.join(ordner, name), 'x');
      expect(sammlePdfs([ordner]).map((p) => path.basename(p))).toEqual(['M2 a.pdf', 'M10 b.pdf']);
    } finally {
      rmSync(ordner, { recursive: true, force: true });
    }
  });

  it('nimmt eine Datei doppelt genannt nur einmal', () => {
    const eine = path.join(FIXTUREN, 'folien-agenda.pdf');
    expect(sammlePdfs([eine, eine])).toHaveLength(1);
  });

  it('sagt, was es nicht gibt, statt einen Stapelabzug zu werfen', () => {
    expect(() => sammlePdfs([path.join(FIXTUREN, 'gibt-es-nicht.pdf')])).toThrow(EinleseFehler);
    expect(() => sammlePdfs([path.join(FIXTUREN, 'gibt-es-nicht.pdf')])).toThrow(
      `${path.join(FIXTUREN, 'gibt-es-nicht.pdf')}: lässt sich nicht öffnen (ENOENT).`,
    );
  });

  it('weist alles zurueck, was kein PDF ist', () => {
    const ordner = temp();
    try {
      writeFileSync(path.join(ordner, 'buch.epub'), 'x');
      expect(() => sammlePdfs([path.join(ordner, 'buch.epub')])).toThrow(/liest nur PDF/);
      expect(() => sammlePdfs([ordner])).toThrow(/keine PDF-Datei/);
    } finally {
      rmSync(ordner, { recursive: true, force: true });
    }
  });

  it('sortiert nach der ersten Zahl im Namen, nicht nach Codepunkten', () => {
    expect(['M10 b.pdf', 'M2 a.pdf', 'M9 c.pdf'].sort(natuerlich)).toEqual(['M2 a.pdf', 'M9 c.pdf', 'M10 b.pdf']);
  });
});

describe('leseFolienEin - was entsteht', () => {
  it('legt Originale, Rohdateien und das Manifest an', async () => {
    const wurzel = temp();
    try {
      const aus = await einlesen(wurzel);
      const quelle = path.join(wurzel, 'quellen', 'fixture-vorlesung');
      expect(readdirSync(path.join(quelle, 'original')).sort()).toEqual(['folien-agenda.pdf', 'folien-laeufe.pdf']);
      expect(readdirSync(path.join(quelle, 'roh')).sort()).toEqual(
        aus.abschnitte.map((a) => `${a.id}.md`).sort(),
      );
      expect(aus.abschnitte).toHaveLength(9);
      expect(aus.abschnitte.map((a) => a.id)).toEqual([
        'd01-01-grundlagen-der-planung',
        'd01-02-kosten-und-termine',
        'd01-03-risiken-im-projekt',
        'd02-01-grundlagen-der-planung',
        'd02-02-planungsphasen-im-ueberblick',
        'd02-03-kosten-und-termine',
        'd02-04-terminplanung',
        'd02-05-risiken-im-projekt',
        'd02-06-risikobewertung',
      ]);
      expect(aus.warnungen).toEqual([]);
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });

  it('schreibt die Rohdatei mit Kopfzeile, Seitenmarken und beiden Hinweisen', async () => {
    const wurzel = temp();
    try {
      await einlesen(wurzel);
      const roh = lies(wurzel, 'quellen', 'fixture-vorlesung', 'roh', 'd01-01-grundlagen-der-planung.md');
      expect(roh.startsWith('# Grundlagen der Planung\n\nfolien-agenda.pdf, Folien 1–10\n\n')).toBe(true);
      expect(roh).toContain('— Folie 1 —');
      // Die Bildfolie steht als Marke mit Hinweis da, ohne Text.
      expect(roh).toContain('— Folie 9 —\nnur Bild — im Original ansehen');
      // Die Warnzeile steht direkt HINTER der Seitenmarke der Tabellenfolie:
      // Wer an der Marke trennt, ordnet sie ihrer Folie zu und nicht der davor.
      const tabelle = lies(wurzel, 'quellen', 'fixture-vorlesung', 'roh', 'd01-02-kosten-und-termine.md');
      expect(tabelle).toContain(
        '— Folie 14 —\n> Tabelle oder Grafik — die Anordnung fehlt im Text; im Original ansehen.',
      );
      // Die Foliennummer des Briefkopfs ist weg.
      expect(roh).not.toMatch(/^Folie \d+$/m);
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });

  it('schreibt ein Manifest der Fassung 3 mit Stand, Summen und Seitenlisten', async () => {
    const wurzel = temp();
    try {
      const aus = await einlesen(wurzel);
      const manifest = JSON.parse(lies(wurzel, 'quellen', 'fixture-vorlesung', 'manifest.json'));
      expect(manifest.fassung).toBe(3);
      expect(manifest.gestempeltAm).toBe(STEMPEL);
      expect(manifest.herkunft).toEqual({ art: 'folien', stand: aus.stand });
      expect(manifest.summe).toEqual({
        originale: 2,
        seiten: 51,
        abschnitte: 9,
        nurBild: 2,
        tabellenverdacht: 2,
        beiwerkZeichen: manifest.originale[0].beiwerkZeichen + manifest.originale[1].beiwerkZeichen,
      });
      expect(manifest.originale.map((o: { datei: string; seiten: number; gliederung: string }) => [o.datei, o.seiten, o.gliederung])).toEqual([
        ['folien-agenda.pdf', 26, 'agenda'],
        ['folien-laeufe.pdf', 25, 'titellaeufe'],
      ]);
      expect(manifest.roh.find((r: { id: string }) => r.id === 'd01-01-grundlagen-der-planung')).toEqual({
        id: 'd01-01-grundlagen-der-planung',
        datei: 'folien-agenda.pdf',
        seiten: [1, 10],
        nurBild: [9],
        tabellenverdacht: [],
      });
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });

  it('meldet viel Beiwerk mit deutschem Komma', async () => {
    const wurzel = temp();
    try {
      // Fuenf Folien, jede mit derselben langen Kopf- und Fusszeile und wenig Inhalt.
      const doc = await PDFDocument.create();
      const schrift = await doc.embedFont(StandardFonts.Helvetica);
      for (let n = 1; n <= 5; n++) {
        const seite = doc.addPage([842, 595]);
        seite.drawText('Kopfzeile mit einem langen Namen der Veranstaltung', { x: 40, y: 560, size: 12, font: schrift });
        seite.drawText('Fusszeile mit Hochschule, Ort und Semester', { x: 40, y: 30, size: 12, font: schrift });
        seite.drawText(`Inhalt der Folie ${n} steht hier`, { x: 40, y: 300, size: 20, font: schrift });
      }
      const pdf = path.join(wurzel, 'viel-beiwerk.pdf');
      writeFileSync(pdf, await doc.save());
      const aus = await einlesen(wurzel, [pdf]);
      expect(aus.warnungen).toEqual([
        'viel-beiwerk.pdf: 77,1 % des Texts als Beiwerk entfernt — vermutlich stimmt etwas mit der Extraktion nicht.',
      ]);
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });

  it('raeumt Rohdateien weg, die es nicht mehr gibt', async () => {
    const wurzel = temp();
    try {
      await einlesen(wurzel);
      const roh = path.join(wurzel, 'quellen', 'fixture-vorlesung', 'roh');
      writeFileSync(path.join(roh, 'd01-99-veraltet.md'), '# alt\n');
      await einlesen(wurzel);
      expect(existsSync(path.join(roh, 'd01-99-veraltet.md'))).toBe(false);
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });
});

describe('leseFolienEin - der Lehrplan', () => {
  it('legt ein Geruest an, das auf die Freigabe wartet', async () => {
    const wurzel = temp();
    try {
      const aus = await einlesen(wurzel);
      expect(aus.lehrplan.geschrieben).toBe(true);
      const text = lies(wurzel, 'lehrplan', 'fixture-vorlesung.yaml');
      expect(text.startsWith('# Diese Datei hat das Einlesen angelegt')).toBe(true);
      expect(text).toContain('geprueftVon: ""');

      const befund = pruefeLehrplan(yamlLesen(text), new Set<string>());
      if (befund.ok) throw new Error('Erwartet war „wartet auf Freigabe".');
      expect(befund.wartet).toBe(true);
      if (!befund.wartet) throw new Error('unerreichbar');
      expect(befund.lehrplan.art).toBe('folien');
      expect(befund.lehrplan.stand).toBe(aus.stand);
      if (befund.lehrplan.art === 'repo') throw new Error('Erwartet waren Folien.');
      expect(befund.lehrplan.abschnitte.map((a) => a.status)).toEqual(Array(9).fill('offen'));
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });

  it('ueberschreibt einen vorhandenen Lehrplan nie und meldet „keine Änderung"', async () => {
    const wurzel = temp();
    try {
      await einlesen(wurzel);
      const pfad = path.join(wurzel, 'lehrplan', 'fixture-vorlesung.yaml');
      const vonHand = `${lies(pfad).replace('geprueftVon: ""', 'geprueftVon: "Daniel Nobs"')}`;
      writeFileSync(pfad, vonHand, 'utf8');

      const zweiter = await einlesen(wurzel);
      expect(zweiter.lehrplan.geschrieben).toBe(false);
      expect(lies(pfad)).toBe(vonHand);
      expect(vergleichInZeilen(zweiter.lehrplan.vergleich!)).toEqual(['keine Änderung']);
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });

  it('schreibt ein Geruest, aus dem YAML genau das zurueckliest, was hineinging', () => {
    const titel = [
      'a: b # c "d" \\ e „f“ - * g',
      'Tabulator\tund Steuerzeichen\u0001\u001f\u007f am Ende',
      '- 2024: null',
      'C1\u0080\u0085\u009f und Trenner\u2028\u2029\ufeff am Ende',
    ];
    const eingabe = {
      kurzname: 'fixture-vorlesung',
      titel: titel[0]!,
      stand: `sha256:${'a'.repeat(64)}`,
      abschnitte: titel.map((t, i) => ({
        id: `d01-0${i + 1}-x`,
        titel: t,
        datei: `${t}.pdf`,
        seiten: [i + 1, i + 1] as [number, number],
      })),
    };
    const text = lehrplanGeruest(eingabe);
    const gelesen = yamlLesen(text) as { quelle: unknown; titel: unknown; stand: unknown; abschnitte: unknown };
    expect(gelesen.quelle).toBe(eingabe.kurzname);
    expect(gelesen.titel).toBe(eingabe.titel);
    expect(gelesen.stand).toBe(eingabe.stand);
    expect(gelesen.abschnitte).toEqual(eingabe.abschnitte.map((a) => ({ ...a, status: 'offen' })));
    // Maskiert und lesbar fuer den Menschen am Review-Gate: Steuerzeichen als \xNN,
    // die unsichtbaren Zeilentrenner und das BOM als \uNNNN.
    expect(text).toContain(String.raw`    titel: "a: b # c \"d\" \\ e „f“ - * g"`);
    expect(text).toContain(String.raw`    titel: "Tabulator\x09und Steuerzeichen\x01\x1F\x7F am Ende"`);
    expect(text).toContain(String.raw`    titel: "C1\x80\x85\x9F und Trenner\u2028\u2029\uFEFF am Ende"`);
  });

  it('setzt quelle in Anfuehrungszeichen: Auch --name 2024 bleibt Text, und der Lehrplan wartet', () => {
    for (const kurzname of ['2024', 'null', 'true', '0x1f', '1e5']) {
      const daten = yamlLesen(
        lehrplanGeruest({
          kurzname,
          titel: 'T',
          stand: `sha256:${'a'.repeat(64)}`,
          abschnitte: [{ id: 'd01-01-x', titel: 'X', datei: 'a.pdf', seiten: [1, 2] }],
        }),
      );
      expect((daten as { quelle: unknown }).quelle).toBe(kurzname);
      const befund = pruefeLehrplan(daten, new Set<string>());
      expect(!befund.ok && befund.wartet).toBe(true);
    }
  });

  it('meldet nach dem Umbenennen einer Datei die neue Datei — bei denselben Ids', async () => {
    const wurzel = temp();
    try {
      const vorher = path.join(wurzel, 'M7 Risiko 26.pdf');
      writeFileSync(vorher, readFileSync(path.join(FIXTUREN, 'folien-agenda.pdf')));
      const erster = await einlesen(wurzel, [vorher]);
      const nachher = path.join(wurzel, 'M7 Risiko 27.pdf');
      renameSync(vorher, nachher);
      const zweiter = await einlesen(wurzel, [nachher]);
      // Dieselben Bytes: Stand und Ids bleiben gleich — nur die Datei im Lehrplan stimmt nicht mehr.
      expect(zweiter.stand).toBe(erster.stand);
      expect(zweiter.abschnitte.map((a) => a.id)).toEqual(erster.abschnitte.map((a) => a.id));
      expect(vergleichInZeilen(zweiter.lehrplan.vergleich!)).toEqual(
        erster.abschnitte.map((a) => `Datei geändert: ${a.id} — M7 Risiko 26.pdf → M7 Risiko 27.pdf`),
      );
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });
});

/**
 * Der Durchstich: Schreiber (`leseFolienEin`/`baueDokumentManifest`) und
 * Leser (`manifestauszug.ts`, `lehrplan.ts`, `abdeckung.ts`, `bestandstext.ts`)
 * teilen sonst kein Testobjekt. Wuerde ein Feld im Manifest umbenannt, zeigte
 * die Karte still „unbekannt …", und kein anderer Test hier wuerde rot —
 * jeder prueft nur seine Seite der Grenze fuer sich.
 *
 * Gelesen wird ueber dieselben Schluessel wie in `src/pages/bibliothek.astro`:
 * `/lehrplan/<k>.yaml` und `/quellen/<k>/manifest.json`.
 */
describe('Durchstich: vom Einlesen bis zur Bibliothekskarte', () => {
  it('kommt wartend an, und Luecken-, Zahlen- und Freigabezeile stimmen mit dem Einlesen ueberein', async () => {
    const wurzel = temp();
    try {
      const aus = await einlesen(wurzel);
      const lehrplanText = lies(wurzel, 'lehrplan', 'fixture-vorlesung.yaml');
      const manifestText = lies(wurzel, 'quellen', 'fixture-vorlesung', 'manifest.json');

      const { gueltig, wartend, ungueltig } = lehrplaeneAusTexten(
        { '/lehrplan/fixture-vorlesung.yaml': lehrplanText },
        new Set<string>(),
      );
      expect(ungueltig).toEqual([]);
      expect(gueltig).toEqual([]);
      expect(wartend).toHaveLength(1);
      expect(wartend[0]?.geprueftVon).toBe('');

      const manifeste = manifesteAusTexten({ '/quellen/fixture-vorlesung/manifest.json': manifestText });
      const { bestand } = abdeckung(wartend, manifeste, new Set<string>());
      expect(bestand).toHaveLength(1);
      const karte = bestand[0]!;

      expect(karte.stand).toBe(aus.stand);
      expect(karte.freigabe).toBe('wartet');
      // Die Zahlen kommen aus demselben Einlesen: 9 Abschnitte, alle offen, keiner mit Lektion.
      expect(zahlenzeile(karte)).toBe('9 Abschnitte · 0 mit Lektion · 9 offen');
      // 2 von 51 Folien nur Bild, 2 mit Tabelle oder Grafik — siehe „schreibt ein Manifest der Fassung 3" oben.
      expect(lueckenzeile(karte.luecken)).toBe('2 von 51 Folien nur Bild · 2 Folien mit Tabelle oder Grafik');
      expect(freigabezeile(karte)).toBe(
        'Erst wenn geprueftVon und geprueftAm eingetragen sind, baut der Compiler daraus Lektionen.',
      );
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });
});

describe('vergleicheLehrplan', () => {
  const alt = lehrplanGeruest({
    kurzname: 'q',
    titel: 'T',
    stand: `sha256:${'a'.repeat(64)}`,
    abschnitte: [
      { id: 'm01-01-eins', titel: 'Eins', datei: 'M1.pdf', seiten: [1, 10] },
      { id: 'm01-02-zwei', titel: 'Zwei', datei: 'M1.pdf', seiten: [11, 20] },
    ],
  });

  it('meldet keine Änderung, wenn nichts anders ist', () => {
    const vergleich = vergleicheLehrplan(alt, {
      stand: `sha256:${'a'.repeat(64)}`,
      abschnitte: [
        { id: 'm01-01-eins', titel: 'Eins', datei: 'M1.pdf', seiten: [1, 10] },
        { id: 'm01-02-zwei', titel: 'Zwei', datei: 'M1.pdf', seiten: [11, 20] },
      ],
    });
    expect(vergleich.unveraendert).toBe(2);
    expect(vergleichInZeilen(vergleich)).toEqual(['keine Änderung']);
  });

  it('meldet neue, fehlende und verschobene Abschnitte und den Stand', () => {
    const vergleich = vergleicheLehrplan(alt, {
      stand: `sha256:${'b'.repeat(64)}`,
      abschnitte: [
        { id: 'm01-01-eins', titel: 'Eins', datei: 'M1.pdf', seiten: [1, 12] },
        { id: 'm01-03-drei', titel: 'Drei', datei: 'M1.pdf', seiten: [13, 20] },
      ],
    });
    expect(vergleich.neue).toEqual(['m01-03-drei']);
    expect(vergleich.fehlende).toEqual(['m01-02-zwei']);
    expect(vergleich.verschobene).toEqual([{ id: 'm01-01-eins', alt: [1, 10], neu: [1, 12] }]);
    expect(vergleichInZeilen(vergleich)).toEqual([
      `Stand geändert: sha256:${'a'.repeat(64)} → sha256:${'b'.repeat(64)}`,
      'neu: m01-03-drei',
      'fehlt jetzt: m01-02-zwei',
      'verschoben: m01-01-eins 1–10 → 1–12',
    ]);
  });

  it('meldet unter derselben Id eine geaenderte Datei und einen geaenderten Titel', () => {
    const vorher = lehrplanGeruest({
      kurzname: 'q',
      titel: 'T',
      stand: `sha256:${'a'.repeat(64)}`,
      abschnitte: [
        { id: 'm07-01-begriffe', titel: 'Begriffe', datei: 'M7 Risikomanagement 26.pdf', seiten: [1, 5] },
        { id: 'm07-02-prozess', titel: 'Prozess', datei: 'M7 Risikomanagement 26.pdf', seiten: [6, 26] },
      ],
    });
    const vergleich = vergleicheLehrplan(vorher, {
      stand: `sha256:${'a'.repeat(64)}`,
      abschnitte: [
        { id: 'm07-01-begriffe', titel: 'Begriffe', datei: 'M7 Risikomanagement 27.pdf', seiten: [1, 5] },
        { id: 'm07-02-prozess', titel: 'Prozess: der Ablauf', datei: 'M7 Risikomanagement 27.pdf', seiten: [6, 26] },
      ],
    });
    expect(vergleich.unveraendert).toBe(0);
    expect(vergleichInZeilen(vergleich)).toEqual([
      'Datei geändert: m07-01-begriffe — M7 Risikomanagement 26.pdf → M7 Risikomanagement 27.pdf',
      'Datei geändert: m07-02-prozess — M7 Risikomanagement 26.pdf → M7 Risikomanagement 27.pdf',
      'Titel geändert: m07-02-prozess — Prozess → Prozess: der Ablauf',
    ]);
  });

  it('vergleicht einen Abschnitt ohne lesbare Seiten ueber Datei und Titel, statt ihn fuer neu zu halten', () => {
    // Aus einem ungueltigen Lehrplan: einmal fehlen die Seiten, einmal sind sie Text.
    const ohneSeiten = [
      'abschnitte:',
      '  - id: m01-01-eins',
      '    titel: "Eins"',
      '    datei: "M1.pdf"',
      '  - id: m01-02-zwei',
      '    titel: "Zwei"',
      '    datei: "M1.pdf"',
      '    seiten: elf bis zwanzig',
      '',
    ].join('\n');
    const vergleich = vergleicheLehrplan(ohneSeiten, {
      stand: `sha256:${'a'.repeat(64)}`,
      abschnitte: [
        { id: 'm01-01-eins', titel: 'Eins', datei: 'M1.pdf', seiten: [1, 10] },
        { id: 'm01-02-zwei', titel: 'Zwei!', datei: 'M1.pdf', seiten: [11, 20] },
      ],
    });
    expect(vergleich.neue).toEqual([]);
    expect(vergleich.fehlende).toEqual([]);
    expect(vergleich.verschobene).toEqual([]);
    expect(vergleich.unveraendert).toBe(1);
    expect(vergleich.andererTitel).toEqual([{ id: 'm01-02-zwei', alt: 'Zwei', neu: 'Zwei!' }]);
  });
});

describe('rohdatei', () => {
  /** Eine bereinigte Folie, wie `rohdatei` sie bekommt. Der Text ist erfunden. */
  function folie(nummer: number, texte: string[], merkmale: { nurBild?: boolean; tabellenverdacht?: boolean } = {}) {
    return {
      nummer,
      breite: 842,
      hoehe: 595,
      zeilen: texte.map((text, i) => ({ text, groesse: 12, y: 500 - 20 * i, x0: 60, x1: 400 })),
      bilder: [],
      gitter: { hLinien: 0, vLinien: 0 },
      quer: true,
      zeichen: texte.join('').length,
      beiwerkZeichen: 0,
      echteBilder: merkmale.nurBild ? 1 : 0,
      nurBild: merkmale.nurBild ?? false,
      tabellenverdacht: merkmale.tabellenverdacht ?? false,
    };
  }

  it('stellt beide Hinweise direkt hinter die Seitenmarke ihrer Folie', () => {
    const abschnitt = { id: 'd01-01-x', titel: 'X', datei: 'a.pdf', seiten: [1, 4] as [number, number] };
    const text = rohdatei(abschnitt, [
      folie(1, ['Titel', 'Zeile']),
      folie(2, ['Umsatz 2024', '1 2 3'], { tabellenverdacht: true }),
      folie(3, [], { nurBild: true }),
      folie(4, ['Legende'], { nurBild: true, tabellenverdacht: true }),
    ]);
    // Getrennt an den Seitenmarken, gehoert jeder Hinweis zu seiner Folie.
    expect(text).toBe(
      [
        '# X',
        '',
        'a.pdf, Folien 1–4',
        '',
        '— Folie 1 —',
        'Titel',
        'Zeile',
        '',
        '— Folie 2 —',
        WARNZEILE,
        'Umsatz 2024',
        '1 2 3',
        '',
        '— Folie 3 —',
        NUR_BILD_ZEILE,
        '',
        '— Folie 4 —',
        WARNZEILE,
        NUR_BILD_ZEILE,
        '',
      ].join('\n'),
    );
  });
});

describe('leseFolienEin - was nicht geht', () => {
  it('bricht bei einem Satz ohne Textebene ab', async () => {
    const wurzel = temp();
    try {
      await expect(einlesen(wurzel, [path.join(FIXTUREN, 'folien-scan.pdf')])).rejects.toThrow(/kein Textinhalt/);
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });

  it('weist ein Buch mit klarer Meldung ab', async () => {
    const wurzel = temp();
    try {
      await expect(einlesen(wurzel, [path.join(FIXTUREN, 'buch-hochformat.pdf')])).rejects.toThrow(
        /Bücher liest diese Fassung noch nicht ein/,
      );
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });

  it('laesst sich mit --art folien ueberstimmen', async () => {
    const wurzel = temp();
    try {
      const aus = await leseFolienEin({
        orte: [path.join(FIXTUREN, 'buch-hochformat.pdf')],
        kurzname: 'trotzdem-folien',
        titel: 'Hochformat, trotzdem als Folien',
        wurzel,
        art: 'folien',
        gestempeltAm: STEMPEL,
        geladen,
      });
      expect(aus.abschnitte).toHaveLength(1);
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });

  it('verlangt einen Kurznamen im Muster der Ids und einen Titel', async () => {
    const wurzel = temp();
    const orte = [path.join(FIXTUREN, 'folien-agenda.pdf')];
    try {
      await expect(
        leseFolienEin({ orte, kurzname: 'Bauch PM', titel: 'x', wurzel, gestempeltAm: STEMPEL, geladen }),
      ).rejects.toThrow(/nur Kleinbuchstaben/);
      await expect(
        leseFolienEin({ orte, kurzname: 'bauch-pm', titel: '  ', wurzel, gestempeltAm: STEMPEL, geladen }),
      ).rejects.toThrow(/--titel fehlt/);
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });

  it('weist Kurznamen ab, die Windows fuer Geraete reserviert', async () => {
    const wurzel = temp();
    const orte = [path.join(FIXTUREN, 'gibt-es-nicht.pdf')];
    try {
      for (const kurzname of ['con', 'prn', 'aux', 'nul', 'com0', 'com1', 'com9', 'lpt0', 'lpt1', 'lpt9']) {
        const fehler = await abbruch(leseFolienEin({ orte, kurzname, titel: 'T', wurzel, gestempeltAm: STEMPEL, geladen }));
        expect(fehler).toBeInstanceOf(EinleseFehler);
        expect(fehler.message).toBe(`Der Kurzname ${kurzname} ist unter Windows reserviert — bitte einen anderen wählen.`);
      }
      // Reserviert ist nur der Name selbst: com10 und con-x kommen durch und scheitern erst am fehlenden PDF.
      for (const kurzname of ['com10', 'con-x']) {
        const fehler = await abbruch(leseFolienEin({ orte, kurzname, titel: 'T', wurzel, gestempeltAm: STEMPEL, geladen }));
        expect(fehler.message).toMatch(/lässt sich nicht öffnen \(ENOENT\)/);
      }
      expect(readdirSync(wurzel)).toEqual(['lehrplan']);
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });

  it('erkennt zwei Originale, die nur Gross- und Kleinschreibung unterscheidet', async () => {
    const wurzel = temp();
    try {
      // Unter Windows sind a.pdf und A.pdf dieselbe Datei — in einem Ordner gaebe es sie nicht zweimal.
      for (const [ordner, name] of [['eins', 'a.pdf'], ['zwei', 'A.pdf']] as const) {
        mkdirSync(path.join(wurzel, ordner));
        writeFileSync(path.join(wurzel, ordner, name), 'x');
      }
      const fehler = await abbruch(einlesen(wurzel, [path.join(wurzel, 'eins'), path.join(wurzel, 'zwei')]));
      expect(fehler).toBeInstanceOf(EinleseFehler);
      expect(fehler.message).toBe(
        'Zwei Originale heißen gleich (Groß- und Kleinschreibung zählt nicht): ' +
          `${path.join(wurzel, 'zwei', 'A.pdf')} und ${path.join(wurzel, 'eins', 'a.pdf')}. ` +
          'Im Lehrplan steht der Dateiname; er muss eindeutig sein.',
      );
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });
});

describe('leseFolienEin - Originale und Lesefehler', () => {
  it('liest aus dem eigenen original/ noch einmal ein und behaelt jedes Byte', async () => {
    const wurzel = temp();
    try {
      await einlesen(wurzel);
      const original = path.join(wurzel, 'quellen', 'fixture-vorlesung', 'original');
      const hash = (name: string) => createHash('sha256').update(readFileSync(path.join(FIXTUREN, name))).digest('hex');
      const erwartet = { 'folien-agenda.pdf': hash('folien-agenda.pdf'), 'folien-laeufe.pdf': hash('folien-laeufe.pdf') };
      expect(schnappschuss(original)).toEqual(erwartet);

      // Der zweite Lauf liest genau die Dateien, die er ersetzt.
      const zweiter = await einlesen(wurzel, [original]);
      expect(zweiter.abschnitte).toHaveLength(9);
      expect(schnappschuss(original)).toEqual(erwartet);
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });

  it('schreibt das Original aus den gelesenen Bytes, auch wenn sich die Datei danach aendert', async () => {
    const wurzel = temp();
    try {
      const agenda = path.join(wurzel, 'folien-agenda.pdf');
      writeFileSync(agenda, readFileSync(path.join(FIXTUREN, 'folien-agenda.pdf')));
      // Waehrend pdf.js liest, wird die Datei auf der Platte ausgetauscht — etwa von einem Sync-Programm.
      const austauschend = {
        ...geladen,
        pdfjs: {
          ...geladen.pdfjs,
          getDocument: (optionen: unknown) => {
            writeFileSync(agenda, 'inzwischen eine andere Datei');
            return geladen.pdfjs.getDocument(optionen);
          },
        },
      };
      await leseFolienEin({
        orte: [agenda],
        kurzname: 'fixture-vorlesung',
        titel: 'T',
        wurzel,
        gestempeltAm: STEMPEL,
        geladen: austauschend,
      });
      const quelle = path.join(wurzel, 'quellen', 'fixture-vorlesung');
      const manifest = JSON.parse(lies(quelle, 'manifest.json'));
      const kopie = readFileSync(path.join(quelle, 'original', 'folien-agenda.pdf'));
      expect(`sha256:${createHash('sha256').update(kopie).digest('hex')}`).toBe(manifest.originale[0].dateiHash);
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });

  it('nennt bei einem kaputten PDF die Datei', async () => {
    const wurzel = temp();
    try {
      const kaputt = path.join(wurzel, 'kaputt.pdf');
      writeFileSync(kaputt, 'x');
      const fehler = await abbruch(einlesen(wurzel, [kaputt]));
      expect(fehler).toBeInstanceOf(EinleseFehler);
      expect(fehler.message).toBe('kaputt.pdf: lässt sich nicht als PDF lesen (Invalid PDF structure.).');
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });

  it('meldet einen Dateifehler beim Lesen als solchen, nicht als kaputtes PDF', async () => {
    const wurzel = temp();
    try {
      // Ein Ordner, der wie ein PDF heisst: Die Mappe bringt ihn mit, und das Lesen scheitert mit EISDIR.
      const mappe = path.join(wurzel, 'mappe');
      mkdirSync(path.join(mappe, 'ordner.pdf'), { recursive: true });
      const fehler = await abbruch(einlesen(wurzel, [mappe]));
      expect(fehler).toBeInstanceOf(EinleseFehler);
      expect(fehler.message).toBe('ordner.pdf: lässt sich nicht öffnen (EISDIR).');
      expect(readdirSync(wurzel).sort()).toEqual(['lehrplan', 'mappe']);
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });

  it('nennt bei einer gedrehten Seite die Datei', async () => {
    const wurzel = temp();
    try {
      const gedreht = path.join(wurzel, 'gedreht.pdf');
      writeFileSync(gedreht, await gedrehtesPdf());
      const fehler = await abbruch(einlesen(wurzel, [gedreht]));
      expect(fehler).toBeInstanceOf(EinleseFehler);
      expect(fehler.message).toBe(
        'gedreht.pdf: Seite 1 ist um 90 Grad gedreht. Gedrehte Seiten liest diese Fassung noch nicht in der richtigen Reihenfolge; bitte das PDF ohne Drehung speichern.',
      );
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });

  it('nennt bei einem PDF mit Passwort die Datei', async () => {
    const wurzel = temp();
    try {
      const geschuetzt = path.join(wurzel, 'passwort.pdf');
      writeFileSync(geschuetzt, await pdfMitPasswort());
      const fehler = await abbruch(einlesen(wurzel, [geschuetzt]));
      expect(fehler).toBeInstanceOf(EinleseFehler);
      expect(fehler.message).toBe('passwort.pdf: ist mit einem Passwort geschützt — bitte ohne Passwort speichern.');
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });

  it('laesst einen Fehler im Programm als solchen durch', async () => {
    const wurzel = temp();
    // Ein TypeError ist kein Lesefehler: Als Lesefehler verkleidet, suchte man am PDF statt im Code.
    const programmfehler = {
      ...geladen,
      pdfjs: {
        ...geladen.pdfjs,
        getDocument: () => {
          throw new TypeError('ein Fehler im Programm');
        },
      },
    };
    try {
      const fehler = await abbruch(
        leseFolienEin({
          orte: [path.join(FIXTUREN, 'folien-agenda.pdf')],
          kurzname: 'fixture-vorlesung',
          titel: 'T',
          wurzel,
          gestempeltAm: STEMPEL,
          geladen: programmfehler,
        }),
      );
      expect(fehler).toBeInstanceOf(TypeError);
      expect(fehler.message).toBe('ein Fehler im Programm');
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });
});

describe('leseFolienEin - erst rechnen, dann tauschen', () => {
  it('laesst nach einem Lauf mit weniger PDF nur den neuen Satz stehen', async () => {
    const wurzel = temp();
    try {
      await einlesen(wurzel);
      const aus = await einlesen(wurzel, [path.join(FIXTUREN, 'folien-agenda.pdf')]);
      const quelle = path.join(wurzel, 'quellen', 'fixture-vorlesung');
      expect(aus.abschnitte).toHaveLength(3);
      expect(readdirSync(path.join(quelle, 'original'))).toEqual(['folien-agenda.pdf']);
      expect(readdirSync(path.join(quelle, 'roh')).sort()).toEqual(aus.abschnitte.map((a) => `${a.id}.md`).sort());
      expect(readdirSync(path.join(wurzel, 'quellen'))).toEqual(['fixture-vorlesung']);
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });

  it('raeumt ein .neu aus einem frueheren Lauf vorher weg: Fremdes landet nicht in quellen/<k>/', async () => {
    const wurzel = temp();
    try {
      const halb = path.join(wurzel, 'quellen', '.fixture-vorlesung.neu');
      for (const ordner of ['original', 'roh']) mkdirSync(path.join(halb, ordner), { recursive: true });
      writeFileSync(path.join(halb, 'original', 'fremd.pdf'), 'fremd');
      writeFileSync(path.join(halb, 'roh', 'd09-99-fremd.md'), '# fremd\n');
      const aus = await einlesen(wurzel);
      const quelle = path.join(wurzel, 'quellen', 'fixture-vorlesung');
      expect(readdirSync(path.join(quelle, 'original')).sort()).toEqual(['folien-agenda.pdf', 'folien-laeufe.pdf']);
      expect(readdirSync(path.join(quelle, 'roh')).sort()).toEqual(aus.abschnitte.map((a) => `${a.id}.md`).sort());
      expect(readdirSync(path.join(wurzel, 'quellen'))).toEqual(['fixture-vorlesung']);
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });

  it('laesst quellen/<k>/ byte-gleich, wenn ein zweiter Lauf an einem PDF scheitert', async () => {
    const wurzel = temp();
    try {
      await einlesen(wurzel);
      const quellen = path.join(wurzel, 'quellen');
      const vorher = schnappschuss(quellen);
      const kaputt = path.join(wurzel, 'kaputt.pdf');
      writeFileSync(kaputt, 'x');
      // kaputt.pdf sortiert hinter die beiden Fixtures: Es scheitert, nachdem sie gelesen sind.
      const orte = [path.join(FIXTUREN, 'folien-agenda.pdf'), path.join(FIXTUREN, 'folien-laeufe.pdf'), kaputt];
      const fehler = await abbruch(einlesen(wurzel, orte));
      expect(fehler.message).toBe('kaputt.pdf: lässt sich nicht als PDF lesen (Invalid PDF structure.).');
      expect(schnappschuss(quellen)).toEqual(vorher);
      expect(readdirSync(quellen)).toEqual(['fixture-vorlesung']);
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });

  it('vergleicht nicht mit einem kaputten oder leeren Lehrplan und laesst ihn, wie er ist', async () => {
    const faelle = [
      [
        'art: folien\n  x: [\n',
        'fixture-vorlesung.yaml ist kein gültiges YAML (Zeile 2, Spalte 4): bad indentation of a mapping entry',
      ],
      ['', 'fixture-vorlesung.yaml ist kein gültiges YAML: expected a document, but the input is empty'],
      // Gueltiges YAML, aber kein Lehrplan: Der Grund ist der erste Mangel, ohne seinen Schlusspunkt.
      ['art: folien\n', 'quelle: fehlt'],
      // Ohne Liste abschnitte gibt es nichts zu vergleichen. Der Grund ist nicht die leere
      // Freigabe davor — die hat jeder wartende Lehrplan.
      [
        `art: folien\nquelle: "fixture-vorlesung"\ntitel: "T"\nstand: "sha256:${'a'.repeat(64)}"\ngeprueftVon: ""\ngeprueftAm: ""\nabschnitte: "keine"\n`,
        'abschnitte: hat die falsche Form — erwartet eine Liste',
      ],
    ];
    for (const [text, grund] of faelle) {
      const wurzel = temp();
      try {
        const pfad = path.join(wurzel, 'lehrplan', 'fixture-vorlesung.yaml');
        writeFileSync(pfad, text, 'utf8');
        const aus = await einlesen(wurzel);
        expect(readFileSync(pfad, 'utf8')).toBe(text);
        expect(aus.lehrplan).toEqual({ pfad, geschrieben: false, vergleich: null });
        expect(aus.warnungen).toEqual([
          `Vergleich übersprungen: lehrplan/fixture-vorlesung.yaml lässt sich nicht lesen — ${grund}. Der Lehrplan bleibt, wie er ist.`,
        ]);
      } finally {
        rmSync(wurzel, { recursive: true, force: true });
      }
    }
  });

  it('vergleicht auch mit einem inhaltlich ungueltigen Lehrplan und sagt, was ihm fehlt', async () => {
    // Wartend und freigegeben: Die leere Freigabe ist kein Mangel, den die Warnung nennt.
    for (const freigabe of [false, true]) {
      const wurzel = temp();
      try {
        await einlesen(wurzel);
        const pfad = path.join(wurzel, 'lehrplan', 'fixture-vorlesung.yaml');
        // Der erste Abschnitt zeigt auf eine Lektion, die es unter dieser Wurzel nicht gibt.
        let text = lies(pfad).replace('    status: offen', '    status: lektion\n    lektion: grundlagen-der-planung');
        if (freigabe) text = text.replace('geprueftVon: ""', 'geprueftVon: "Daniel Nobs"').replace('geprueftAm: ""', 'geprueftAm: "2026-09-24"');
        writeFileSync(pfad, text, 'utf8');
        const aus = await einlesen(wurzel);
        expect(readFileSync(pfad, 'utf8')).toBe(text);
        expect(aus.lehrplan.geschrieben).toBe(false);
        expect(vergleichInZeilen(aus.lehrplan.vergleich!)).toEqual(['keine Änderung']);
        expect(aus.warnungen).toEqual([
          'lehrplan/fixture-vorlesung.yaml ist ungültig: abschnitte.0.lektion: Die Lektion grundlagen-der-planung gibt es nicht ' +
            '(inhalt/lektionen/grundlagen-der-planung.mdx). Der Lehrplan bleibt, wie er ist.',
        ]);
      } finally {
        rmSync(wurzel, { recursive: true, force: true });
      }
    }
  });

  it('vergleicht mit einem wartenden Lehrplan ohne Warnung', async () => {
    const wurzel = temp();
    try {
      await einlesen(wurzel);
      const aus = await einlesen(wurzel);
      expect(aus.lehrplan.geschrieben).toBe(false);
      expect(vergleichInZeilen(aus.lehrplan.vergleich!)).toEqual(['keine Änderung']);
      expect(aus.warnungen).toEqual([]);
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });

  it('bricht bei einem Lehrplan einer anderen Art ab und veraendert nichts', async () => {
    const wurzel = temp();
    try {
      const pfad = path.join(wurzel, 'lehrplan', 'fixture-vorlesung.yaml');
      const text = 'art: repo\nquelle: fixture-vorlesung\n';
      writeFileSync(pfad, text, 'utf8');
      const fehler = await abbruch(einlesen(wurzel));
      expect(fehler).toBeInstanceOf(EinleseFehler);
      expect(fehler.message).toBe(
        'lehrplan/fixture-vorlesung.yaml gehört schon zu einer Quelle der Art repo — für Foliensätze einen anderen Kurznamen wählen. Nichts verändert.',
      );
      expect(readFileSync(pfad, 'utf8')).toBe(text);
      expect(existsSync(path.join(wurzel, 'quellen'))).toBe(false);
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });

  it('bricht bei einem Manifest einer anderen Art ab und veraendert nichts', async () => {
    const wurzel = temp();
    try {
      const quelle = path.join(wurzel, 'quellen', 'fixture-vorlesung');
      mkdirSync(path.join(quelle, 'roh'), { recursive: true });
      const herkunft = { art: 'git', url: 'https://example.org/x.git', unterpfad: 'docs', sha: 'a'.repeat(40) };
      writeFileSync(path.join(quelle, 'manifest.json'), JSON.stringify({ fassung: 2, herkunft }));
      writeFileSync(path.join(quelle, 'roh', 'readme.md'), '# aus dem Repo\n');
      const vorher = schnappschuss(path.join(wurzel, 'quellen'));
      const fehler = await abbruch(einlesen(wurzel));
      expect(fehler).toBeInstanceOf(EinleseFehler);
      expect(fehler.message).toBe(
        'quellen/fixture-vorlesung/ gehört schon zu einer Quelle der Art git — für Foliensätze einen anderen Kurznamen wählen. Nichts verändert.',
      );
      expect(schnappschuss(path.join(wurzel, 'quellen'))).toEqual(vorher);
      expect(readdirSync(path.join(wurzel, 'lehrplan'))).toEqual([]);
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });

  it('haelt an einem liegengebliebenen .alt neben quellen/<k>/ an: Der Tausch war fertig, .alt kann weg', async () => {
    const wurzel = temp();
    try {
      await einlesen(wurzel);
      const alt = path.join(wurzel, 'quellen', '.fixture-vorlesung.alt');
      mkdirSync(alt);
      writeFileSync(path.join(alt, 'manifest.json'), '{}');
      const vorher = schnappschuss(wurzel);
      const fehler = await abbruch(einlesen(wurzel));
      expect(fehler).toBeInstanceOf(EinleseFehler);
      expect(fehler.message).toBe(
        'quellen/.fixture-vorlesung.alt ist der Rest eines abgeschlossenen Laufs; der eingelesene Stand liegt in quellen/fixture-vorlesung/. ' +
          'Bitte quellen/.fixture-vorlesung.alt löschen, dann neu einlesen.',
      );
      expect(schnappschuss(wurzel)).toEqual(vorher);
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });

  it('haelt an einem .alt ohne quellen/<k>/ an, sagt, wie der alte Stand zurueckkommt, und fasst nichts an', async () => {
    const wurzel = temp();
    try {
      // Der Zustand nach einem Doppelfehler: der alte Stand in .alt, der neue in .neu, quellen/<k>/ fehlt.
      await einlesen(wurzel);
      const quellen = path.join(wurzel, 'quellen');
      renameSync(path.join(quellen, 'fixture-vorlesung'), path.join(quellen, '.fixture-vorlesung.alt'));
      mkdirSync(path.join(quellen, '.fixture-vorlesung.neu'));
      writeFileSync(path.join(quellen, '.fixture-vorlesung.neu', 'manifest.json'), '{}');
      const vorher = schnappschuss(wurzel);
      const fehler = await abbruch(einlesen(wurzel));
      expect(fehler).toBeInstanceOf(EinleseFehler);
      expect(fehler.message).toBe(
        'quellen/fixture-vorlesung/ fehlt. Der letzte vollständige Stand liegt in quellen/.fixture-vorlesung.alt. ' +
          'Wiederherstellen: quellen/.fixture-vorlesung.alt in quellen/fixture-vorlesung umbenennen, ' +
          'quellen/.fixture-vorlesung.neu löschen (falls vorhanden), dann neu einlesen.',
      );
      expect(schnappschuss(wurzel)).toEqual(vorher);
      expect(readdirSync(quellen).sort()).toEqual(['.fixture-vorlesung.alt', '.fixture-vorlesung.neu']);
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });

  it('ueberschreibt auch keinen Lehrplan, der erst waehrend des Rechnens entsteht', async () => {
    const wurzel = temp();
    const pfad = path.join(wurzel, 'lehrplan', 'fixture-vorlesung.yaml');
    const vonDaneben = lehrplanGeruest({
      kurzname: 'fixture-vorlesung',
      titel: 'Von einem Lauf daneben',
      stand: `sha256:${'b'.repeat(64)}`,
      abschnitte: [{ id: 'd01-01-grundlagen-der-planung', titel: 'Grundlagen der Planung', datei: 'folien-agenda.pdf', seiten: [1, 10] }],
    });
    // Ein Lauf daneben legt den Lehrplan an, waehrend dieser noch die PDF liest.
    const daneben = {
      ...geladen,
      pdfjs: {
        ...geladen.pdfjs,
        getDocument: (optionen: unknown) => {
          if (!existsSync(pfad)) writeFileSync(pfad, vonDaneben, 'utf8');
          return geladen.pdfjs.getDocument(optionen);
        },
      },
    };
    try {
      const aus = await leseFolienEin({
        orte: [path.join(FIXTUREN, 'folien-agenda.pdf'), path.join(FIXTUREN, 'folien-laeufe.pdf')],
        kurzname: 'fixture-vorlesung',
        titel: 'Fixture-Vorlesung Projektmanagement',
        wurzel,
        gestempeltAm: STEMPEL,
        geladen: daneben,
      });
      expect(readFileSync(pfad, 'utf8')).toBe(vonDaneben);
      expect(aus.lehrplan.geschrieben).toBe(false);
      expect(aus.lehrplan.vergleich?.stand.geaendert).toBe(true);
      expect(aus.lehrplan.vergleich?.neue).toHaveLength(8);
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });
});

/**
 * Das Einlesen, wenn die Platte nicht mitspielt: mit einem Dateisystem, das an
 * genau einer Stelle scheitert — wie beim Tausch unten. Eine volle Platte oder
 * eine gesperrte Datei laesst sich anders nicht zuverlaessig herbeifuehren.
 */
describe('leseFolienEin - wenn die Platte nicht mitspielt', () => {
  it('legt beim Erstlauf nichts an, wenn sich das Neue endgueltig nicht einsetzen laesst', async () => {
    const wurzel = temp();
    try {
      const dateisystem = umbenennenScheitertBei({ '.fixture-vorlesung.neu': 'EPERM' });
      const fehler = await abbruch(einlesen(wurzel, undefined, dateisystem));
      expect(fehler).toBeInstanceOf(EinleseFehler);
      // Ohne die Frage nach einer geoeffneten Datei: Es gab noch keinen Ordner, aus dem eine offen sein koennte.
      expect(fehler.message).toBe('quellen/fixture-vorlesung/ lässt sich nicht anlegen (EPERM). Nichts verändert.');
      expect(readdirSync(path.join(wurzel, 'quellen'))).toEqual([]);
      expect(readdirSync(path.join(wurzel, 'lehrplan'))).toEqual([]);
      expect(dateisystem.wartezeiten).toEqual([100, 200, 400, 800]);
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });

  it('bricht ab, wenn sich ein .neu aus einem frueheren Lauf nicht entfernen laesst, und veraendert nichts', async () => {
    const wurzel = temp();
    try {
      await einlesen(wurzel);
      const halb = path.join(wurzel, 'quellen', '.fixture-vorlesung.neu');
      mkdirSync(path.join(halb, 'roh'), { recursive: true });
      writeFileSync(path.join(halb, 'roh', 'halb.md'), '# halb\n');
      const vorher = schnappschuss(wurzel);
      const fehler = await abbruch(
        einlesen(wurzel, undefined, {
          rmSync: (pfad, optionen) => {
            if (path.basename(pfad) === '.fixture-vorlesung.neu') throw systemfehler('EPERM', 'rmdir');
            rmSync(pfad, optionen);
          },
        }),
      );
      expect(fehler).toBeInstanceOf(EinleseFehler);
      expect(fehler.message).toBe(
        'quellen/.fixture-vorlesung.neu aus einem früheren Lauf lässt sich nicht entfernen (EPERM). ' +
          'Nichts verändert; bitte den Ordner von Hand löschen, dann neu einlesen.',
      );
      expect(schnappschuss(wurzel)).toEqual(vorher);
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });

  it('raeumt .neu weg und veraendert nichts, wenn das Schreiben dorthin scheitert', async () => {
    const wurzel = temp();
    try {
      await einlesen(wurzel);
      const vorher = schnappschuss(wurzel);
      const fehler = await abbruch(
        einlesen(wurzel, undefined, {
          writeFileSync: (pfad, daten, optionen) => {
            // Die Originale passen noch, bei den Rohdateien ist die Platte voll.
            if (path.basename(path.dirname(pfad)) === 'roh') throw systemfehler('ENOSPC', 'write');
            writeFileSync(pfad, daten, optionen);
          },
        }),
      );
      expect(fehler).toBeInstanceOf(EinleseFehler);
      expect(fehler.message).toBe('Schreiben nach quellen/.fixture-vorlesung.neu gescheitert (ENOSPC). Nichts verändert.');
      expect(schnappschuss(wurzel)).toEqual(vorher);
      expect(readdirSync(path.join(wurzel, 'quellen'))).toEqual(['fixture-vorlesung']);
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });

  it('sagt, dass quellen/<k>/ neu ist, wenn danach der Lehrplan scheitert — und behaelt die Warnung zu .alt', async () => {
    const wurzel = temp();
    try {
      await einlesen(wurzel);
      const lehrplan = path.join(wurzel, 'lehrplan', 'fixture-vorlesung.yaml');
      // Ohne Lehrplan legt der naechste Lauf das Geruest an.
      rmSync(lehrplan);
      const fehler = await abbruch(
        einlesen(wurzel, undefined, {
          rmSync: (pfad, optionen) => {
            if (path.basename(pfad) === '.fixture-vorlesung.alt') throw systemfehler('EBUSY', 'rmdir');
            rmSync(pfad, optionen);
          },
          writeFileSync: (pfad, daten, optionen) => {
            if (pfad === lehrplan) throw systemfehler('EACCES', 'open');
            writeFileSync(pfad, daten, optionen);
          },
        }),
      );
      expect(fehler).toBeInstanceOf(EinleseFehler);
      expect(fehler.message).toBe(
        'quellen/fixture-vorlesung/ ist neu eingelesen, aber lehrplan/fixture-vorlesung.yaml ließ sich nicht schreiben (EACCES).\n' +
          'Warnung: quellen/.fixture-vorlesung.alt ließ sich nicht entfernen (EBUSY). Der neue Stand ist eingelesen; ' +
          'bitte den Ordner von Hand löschen — bis dahin hält das nächste Einlesen dort an.',
      );
      expect(existsSync(lehrplan)).toBe(false);
      expect(readdirSync(path.join(wurzel, 'quellen')).sort()).toEqual(['.fixture-vorlesung.alt', 'fixture-vorlesung']);
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });

  it('laesst keinen halb geschriebenen Lehrplan liegen', async () => {
    const wurzel = temp();
    try {
      const lehrplan = path.join(wurzel, 'lehrplan', 'fixture-vorlesung.yaml');
      const fehler = await abbruch(
        einlesen(wurzel, undefined, {
          writeFileSync: (pfad, daten, optionen) => {
            if (pfad === lehrplan) {
              // Angelegt und zur Haelfte geschrieben, dann ist die Platte voll.
              writeFileSync(pfad, String(daten).slice(0, 100), optionen);
              throw systemfehler('ENOSPC', 'write');
            }
            writeFileSync(pfad, daten, optionen);
          },
        }),
      );
      expect(fehler).toBeInstanceOf(EinleseFehler);
      expect(fehler.message).toBe(
        'quellen/fixture-vorlesung/ ist neu eingelesen, aber lehrplan/fixture-vorlesung.yaml ließ sich nicht schreiben (ENOSPC).',
      );
      // Sonst hielte der naechste Lauf den Rest fuer einen Lehrplan und schriebe das Geruest nie.
      expect(existsSync(lehrplan)).toBe(false);
      expect(readdirSync(path.join(wurzel, 'quellen'))).toEqual(['fixture-vorlesung']);
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });
});

/**
 * Der Tausch selbst, mit einem Dateisystem, das an einer Stelle scheitert.
 *
 * Unter Windows scheitert ein Umbenennen etwa, wenn ein PDF aus `original/`
 * noch im Betrachter offen ist. Zuverlaessig herbeifuehren laesst sich das in
 * einem Test nicht; deshalb nimmt `tausche` ein `renameSync` und ein `rmSync`
 * entgegen, die hier an genau einer Stelle einen Fehler werfen, und eine
 * Wartefunktion, die nicht wirklich wartet. Alles andere geschieht wirklich
 * auf der Platte.
 */
describe('tausche', () => {
  /** quellen/k mit dem alten Stand und quellen/.k.neu mit dem neuen — wie kurz vor dem Tausch. */
  function vorDemTausch(): { wurzel: string; quellen: string } {
    const wurzel = temp();
    const quellen = path.join(wurzel, 'quellen');
    for (const [ordner, stand] of [['k', 'alt'], ['.k.neu', 'neu']] as const) {
      mkdirSync(path.join(quellen, ordner, 'original'), { recursive: true });
      writeFileSync(path.join(quellen, ordner, 'original', 'M1.pdf'), stand);
      writeFileSync(path.join(quellen, ordner, 'manifest.json'), JSON.stringify({ stand }));
    }
    return { wurzel, quellen };
  }

  /** Der Fehler, den `lauf` wirft. */
  function abbruchSofort(lauf: () => unknown): Error {
    try {
      lauf();
    } catch (fehler) {
      return fehler as Error;
    }
    throw new Error('Erwartet war ein Abbruch.');
  }

  it('rollt zurueck, wenn sich das Neue nicht einsetzen laesst', () => {
    const { wurzel, quellen } = vorDemTausch();
    try {
      const vorher = schnappschuss(path.join(quellen, 'k'));
      const fehler = abbruchSofort(() => tausche(quellen, 'k', umbenennenScheitertBei({ '.k.neu': 'EBUSY' })));
      expect(fehler).toBeInstanceOf(EinleseFehler);
      expect(fehler.message).toBe('quellen/k/ lässt sich nicht ersetzen (EBUSY) — ist eine Datei daraus noch geöffnet? Nichts verändert.');
      expect(schnappschuss(path.join(quellen, 'k'))).toEqual(vorher);
      expect(readdirSync(quellen)).toEqual(['k']);
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });

  it('stellt nichts um, wenn sich schon das Alte nicht wegstellen laesst', () => {
    const { wurzel, quellen } = vorDemTausch();
    try {
      const vorher = schnappschuss(path.join(quellen, 'k'));
      const fehler = abbruchSofort(() => tausche(quellen, 'k', umbenennenScheitertBei({ k: 'EPERM' })));
      expect(fehler).toBeInstanceOf(EinleseFehler);
      expect(fehler.message).toBe('quellen/k/ lässt sich nicht ersetzen (EPERM) — ist eine Datei daraus noch geöffnet? Nichts verändert.');
      expect(schnappschuss(path.join(quellen, 'k'))).toEqual(vorher);
      expect(readdirSync(quellen)).toEqual(['k']);
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });

  it('laesst beide Staende liegen und sagt wo, wenn auch das Zuruecklegen scheitert', () => {
    const { wurzel, quellen } = vorDemTausch();
    try {
      const alt = schnappschuss(path.join(quellen, 'k'));
      const neu = schnappschuss(path.join(quellen, '.k.neu'));
      const fehler = abbruchSofort(() =>
        tausche(quellen, 'k', umbenennenScheitertBei({ '.k.neu': 'EBUSY', '.k.alt': 'EPERM' })),
      );
      expect(fehler).toBeInstanceOf(EinleseFehler);
      expect(fehler.message).toBe(
        'quellen/k/ lässt sich nicht ersetzen (EBUSY), und der alte Stand ließ sich nicht zurücklegen (EPERM). ' +
          'Der alte Stand liegt in quellen/.k.alt, der neue in quellen/.k.neu. ' +
          'Zurück zum alten Stand: quellen/.k.alt in quellen/k umbenennen, quellen/.k.neu löschen, dann neu einlesen.',
      );
      // Nichts geloescht: Der naechste Lauf haelt an .alt an, statt es zu ueberschreiben.
      expect(readdirSync(quellen).sort()).toEqual(['.k.alt', '.k.neu']);
      expect(schnappschuss(path.join(quellen, '.k.alt'))).toEqual(alt);
      expect(schnappschuss(path.join(quellen, '.k.neu'))).toEqual(neu);
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });

  it('warnt nur, wenn sich am Ende .alt nicht entfernen laesst', () => {
    const { wurzel, quellen } = vorDemTausch();
    try {
      const neu = schnappschuss(path.join(quellen, '.k.neu'));
      const mitgegeben: (RmOptions | undefined)[] = [];
      const dateisystem = {
        renameSync,
        rmSync: (pfad: PathLike, optionen?: RmOptions) => {
          if (path.basename(String(pfad)) === '.k.alt') {
            mitgegeben.push(optionen);
            throw systemfehler('EBUSY', 'rmdir');
          }
          rmSync(pfad, optionen);
        },
      };
      expect(tausche(quellen, 'k', dateisystem)).toBe(
        'quellen/.k.alt ließ sich nicht entfernen (EBUSY). Der neue Stand ist eingelesen; ' +
          'bitte den Ordner von Hand löschen — bis dahin hält das nächste Einlesen dort an.',
      );
      // Node fasst bei einer Sperre selbst nach, bevor der Fehler hier ankommt.
      expect(mitgegeben).toEqual([{ recursive: true, force: true, maxRetries: 3, retryDelay: 100 }]);
      expect(schnappschuss(path.join(quellen, 'k'))).toEqual(neu);
      expect(readdirSync(quellen).sort()).toEqual(['.k.alt', 'k']);
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });

  it('versucht es nach einer fluechtigen Sperre wieder und tauscht dann', () => {
    const { wurzel, quellen } = vorDemTausch();
    try {
      const neu = schnappschuss(path.join(quellen, '.k.neu'));
      // Wie ein Virenscanner, der die frisch geschriebenen Dateien kurz festhaelt.
      const dateisystem = umbenennenScheitertBei({ '.k.neu': ['EPERM', 'EPERM'] });
      expect(tausche(quellen, 'k', dateisystem)).toBeNull();
      expect(schnappschuss(path.join(quellen, 'k'))).toEqual(neu);
      expect(readdirSync(quellen)).toEqual(['k']);
      expect(dateisystem.versuche).toEqual(['k', '.k.neu', '.k.neu', '.k.neu']);
      expect(dateisystem.wartezeiten).toEqual([100, 200]);
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });

  it('gibt nach fuenf Versuchen auf und rollt zurueck', () => {
    const { wurzel, quellen } = vorDemTausch();
    try {
      const vorher = schnappschuss(path.join(quellen, 'k'));
      // Ein sechster Versuch gelaenge — es gibt ihn nicht.
      const dateisystem = umbenennenScheitertBei({ '.k.neu': Array<string>(5).fill('EPERM') });
      const fehler = abbruchSofort(() => tausche(quellen, 'k', dateisystem));
      expect(fehler).toBeInstanceOf(EinleseFehler);
      expect(fehler.message).toBe('quellen/k/ lässt sich nicht ersetzen (EPERM) — ist eine Datei daraus noch geöffnet? Nichts verändert.');
      expect(schnappschuss(path.join(quellen, 'k'))).toEqual(vorher);
      expect(readdirSync(quellen)).toEqual(['k']);
      expect(dateisystem.versuche).toEqual(['k', '.k.neu', '.k.neu', '.k.neu', '.k.neu', '.k.neu', '.k.alt']);
      expect(dateisystem.wartezeiten).toEqual([100, 200, 400, 800]);
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });

  it('versucht es bei einem Fehler, der keine Sperre ist, nicht wieder', () => {
    const { wurzel, quellen } = vorDemTausch();
    try {
      const vorher = schnappschuss(path.join(quellen, 'k'));
      const dateisystem = umbenennenScheitertBei({ '.k.neu': ['ENOENT'] });
      const fehler = abbruchSofort(() => tausche(quellen, 'k', dateisystem));
      expect(fehler).toBeInstanceOf(EinleseFehler);
      // ENOENT ist keine Sperre: keine Frage nach einer geoeffneten Datei.
      expect(fehler.message).toBe('quellen/k/ lässt sich nicht ersetzen (ENOENT). Nichts verändert.');
      expect(dateisystem.versuche).toEqual(['k', '.k.neu', '.k.alt']);
      expect(dateisystem.wartezeiten).toEqual([]);
      expect(schnappschuss(path.join(quellen, 'k'))).toEqual(vorher);
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });

  it('fragt bei einem Fehler, der keine Sperre ist, nicht nach einer offenen Datei', () => {
    const { wurzel, quellen } = vorDemTausch();
    try {
      const vorher = schnappschuss(path.join(quellen, 'k'));
      // Diesmal scheitert schon das Wegstellen des alten Stands — mit ENOENT statt einer Sperre.
      const fehler = abbruchSofort(() => tausche(quellen, 'k', umbenennenScheitertBei({ k: 'ENOENT' })));
      expect(fehler).toBeInstanceOf(EinleseFehler);
      expect(fehler.message).toBe('quellen/k/ lässt sich nicht ersetzen (ENOENT). Nichts verändert.');
      expect(schnappschuss(path.join(quellen, 'k'))).toEqual(vorher);
      expect(readdirSync(quellen)).toEqual(['k']);
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });

  it('meldet den Fehler beim Umbenennen, auch wenn danach das Aufraeumen scheitert', () => {
    const { wurzel, quellen } = vorDemTausch();
    try {
      const vorher = schnappschuss(path.join(quellen, 'k'));
      const dateisystem = {
        ...umbenennenScheitertBei({ '.k.neu': 'EBUSY' }),
        rmSync: (pfad: PathLike, optionen?: RmOptions) => {
          if (path.basename(String(pfad)) === '.k.neu') throw systemfehler('EPERM', 'rmdir');
          rmSync(pfad, optionen);
        },
      };
      const fehler = abbruchSofort(() => tausche(quellen, 'k', dateisystem));
      expect(fehler).toBeInstanceOf(EinleseFehler);
      expect(fehler.message).toBe('quellen/k/ lässt sich nicht ersetzen (EBUSY) — ist eine Datei daraus noch geöffnet? Nichts verändert.');
      expect(schnappschuss(path.join(quellen, 'k'))).toEqual(vorher);
      // .neu bleibt liegen; der naechste Lauf raeumt es vorher weg.
      expect(readdirSync(quellen).sort()).toEqual(['.k.neu', 'k']);
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });
});
