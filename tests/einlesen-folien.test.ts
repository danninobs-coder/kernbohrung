// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { load as yamlLesen } from 'js-yaml';
import { ladePdfjs } from '../werkzeug/adapter/dokument.mjs';
import { EinleseFehler, leseFolienEin, natuerlich, sammlePdfs } from '../werkzeug/adapter/folien.mjs';
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
