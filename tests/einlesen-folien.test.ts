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
import { EinleseFehler, leseFolienEin, natuerlich, sammlePdfs, tausche } from '../werkzeug/adapter/folien.mjs';
import { lehrplanGeruest, vergleicheLehrplan, vergleichInZeilen } from '../werkzeug/lehrplan-geruest.mjs';
import { pruefeLehrplan } from '../src/lib/lehrplan';

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

/** Liest die beiden Foliensaetze mit Agenda und Titellaeufen als eine Quelle ein. */
const einlesen = (wurzel: string, orte = [path.join(FIXTUREN, 'folien-agenda.pdf'), path.join(FIXTUREN, 'folien-laeufe.pdf')]) =>
  leseFolienEin({
    orte,
    kurzname: 'fixture-vorlesung',
    titel: 'Fixture-Vorlesung Projektmanagement',
    wurzel,
    gestempeltAm: STEMPEL,
    geladen,
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

  it('sagt, was es nicht gibt', () => {
    expect(() => sammlePdfs([path.join(FIXTUREN, 'gibt-es-nicht.pdf')])).toThrow(EinleseFehler);
    expect(() => sammlePdfs([path.join(FIXTUREN, 'gibt-es-nicht.pdf')])).toThrow(/gibt es nicht/);
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
      // Die Warnzeile steht VOR der Seitenmarke der Tabellenfolie.
      const tabelle = lies(wurzel, 'quellen', 'fixture-vorlesung', 'roh', 'd01-02-kosten-und-termine.md');
      expect(tabelle).toContain(
        '> Tabelle oder Grafik — die Anordnung fehlt im Text; im Original ansehen.\n— Folie 14 —',
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

  it('schreibt das Geruest deterministisch', () => {
    const eingabe = {
      kurzname: 'fixture-vorlesung',
      titel: 'Fixture-Vorlesung: „Projektmanagement"',
      stand: `sha256:${'a'.repeat(64)}`,
      abschnitte: [{ id: 'd01-01-grundlagen', titel: 'Grundlagen', datei: 'a.pdf', seiten: [1, 10] as [number, number] }],
    };
    expect(lehrplanGeruest(eingabe)).toBe(lehrplanGeruest(eingabe));
    // Titel in Anfuehrungszeichen, Sonderzeichen maskiert.
    expect(lehrplanGeruest(eingabe)).toContain('titel: "Fixture-Vorlesung: „Projektmanagement\\""');
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

  it('haelt an, wenn ein frueherer Lauf quellen/.<k>.alt liegen liess', async () => {
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
        'Ein früherer Lauf ist nicht zu Ende gekommen: quellen/.fixture-vorlesung.alt liegt noch da. Bitte ansehen und entfernen, dann neu einlesen.',
      );
      expect(schnappschuss(wurzel)).toEqual(vorher);
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
 * Der Tausch selbst, mit einem Dateisystem, das an einer Stelle scheitert.
 *
 * Unter Windows scheitert ein Umbenennen etwa, wenn ein PDF aus `original/`
 * noch im Betrachter offen ist. Zuverlaessig herbeifuehren laesst sich das in
 * einem Test nicht; deshalb nimmt `tausche` ein `renameSync` und ein `rmSync`
 * entgegen, die hier an genau einer Stelle einen Fehler werfen. Alles andere
 * geschieht wirklich auf der Platte.
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

  /** Ein Fehler, wie Node ihn fuer eine gesperrte Datei meldet. */
  const gesperrt = (code: string) => Object.assign(new Error(`${code}: resource busy or locked`), { code });

  /** Ein Dateisystem, dessen Umbenennen scheitert, wenn die Quelle so heisst wie ein Schluessel. */
  const umbenennenScheitertBei = (codes: Record<string, string>) => ({
    renameSync: (von: PathLike, nach: PathLike) => {
      const code = codes[path.basename(String(von))];
      if (code) throw gesperrt(code);
      renameSync(von, nach);
    },
    rmSync,
  });

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
        'quellen/k/ lässt sich nicht ersetzen (EBUSY), und der alte Stand ließ sich nicht zurücklegen (EPERM): ' +
          'Er liegt in quellen/.k.alt, der neue in quellen/.k.neu. Bitte ansehen.',
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
      const dateisystem = {
        renameSync,
        rmSync: (pfad: PathLike, optionen?: RmOptions) => {
          if (path.basename(String(pfad)) === '.k.alt') throw gesperrt('EBUSY');
          rmSync(pfad, optionen);
        },
      };
      expect(tausche(quellen, 'k', dateisystem)).toBe(
        'quellen/.k.alt ließ sich nicht entfernen (EBUSY). Der neue Stand ist eingelesen; ' +
          'bitte den Ordner von Hand löschen — bis dahin hält das nächste Einlesen dort an.',
      );
      expect(schnappschuss(path.join(quellen, 'k'))).toEqual(neu);
      expect(readdirSync(quellen).sort()).toEqual(['.k.alt', 'k']);
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });
});
