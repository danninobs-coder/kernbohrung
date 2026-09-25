import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  baueDokumentManifest,
  baueManifest,
  dateiHash,
  inhaltsHash,
  liesDokumentManifest,
  MANIFEST_FASSUNG,
  MANIFEST_FASSUNG_DOKUMENT,
  standAusHashes,
} from '../werkzeug/manifest.mjs';

const FIXTUREN = path.resolve(__dirname, 'fixtures');

// `as const` ist hier nicht Kosmetik: Ohne die Festlegung verbreitert
// TypeScript `mitnehmen: true` im Array-Literal zu `boolean`, und die Fixture
// erfuellt den Urteil-Vertrag aus auswahl.mjs nicht mehr. Genau das soll sie
// aber — sie steht stellvertretend fuer echte Auswahlergebnisse.
const urteile = [
  { pfad: 'a/README.md', mitnehmen: true, rubrik: 'beschreibung', bytes: 100 },
  { pfad: 'a/main.py', mitnehmen: true, rubrik: 'umsetzung', bytes: 200 },
  { pfad: 'a/bild.png', mitnehmen: false, grund: 'Bild oder sonst binaer — traegt keinen Text' },
] as const;

// Nur die uebernommenen Dateien stehen drin. Das Bild fehlt mit Absicht: Was
// nicht uebernommen wurde, kann spaeter auch nicht abweichen.
const hashes = new Map([
  ['a/README.md', inhaltsHash('# Titel\n\nEin Absatz.\n')],
  ['a/main.py', inhaltsHash('print("hallo")\n')],
]);

const herkunft = {
  art: 'git',
  url: 'https://github.com/Beispiel/repo.git',
  unterpfad: 'rag_tutorials',
  sha: 'a13701eae315a81e1011a4304a6b5e741ea0a984',
};

describe('baueManifest', () => {
  it('haelt die Herkunft samt Commit-SHA fest', () => {
    const m = baueManifest({ herkunft, urteile, hashes, gestempeltAm: '2026-09-01T12:00:00Z' });
    expect(m.herkunft.sha).toBe(herkunft.sha);
    expect(m.herkunft.url).toBe(herkunft.url);
    expect(m.fassung).toBe(MANIFEST_FASSUNG);
    expect(m.gestempeltAm).toBe('2026-09-01T12:00:00Z');
  });

  it('listet die uebernommenen Dateien mit Rubrik und Groesse', () => {
    const m = baueManifest({ herkunft, urteile, hashes, gestempeltAm: '2026-09-01T12:00:00Z' });
    expect(m.uebernommen).toHaveLength(2);
    expect(m.uebernommen[0]).toMatchObject({ pfad: 'a/README.md', rubrik: 'beschreibung' });
  });

  it('gibt jeder uebernommenen Datei ihren Inhalts-Hash mit', () => {
    // Der Commit-SHA belegt den Stand der Quelle. Ob eine einzelne `roh/*.md`
    // danach noch dieselbe ist, sagt nur der Hash der Datei selbst.
    const m = baueManifest({ herkunft, urteile, hashes, gestempeltAm: '2026-09-01T12:00:00Z' });
    for (const d of m.uebernommen) {
      expect(d.hash).toBe(hashes.get(d.pfad));
      expect(d.hash).toMatch(/^sha256:[0-9a-f]{64}$/);
    }
    expect(new Set(m.uebernommen.map((d) => d.hash)).size).toBe(2);
  });

  it('listet die Auslassungen MIT Grund — sonst haelt man das Rohmaterial fuer vollstaendig', () => {
    const m = baueManifest({ herkunft, urteile, hashes, gestempeltAm: '2026-09-01T12:00:00Z' });
    expect(m.ausgelassen).toHaveLength(1);
    expect(m.ausgelassen[0].grund).toMatch(/binaer/i);
  });

  it('verlangt fuer ausgelassene Dateien keinen Hash', () => {
    // `hashes` kennt das Bild nicht, und das ist kein Mangel: Ein Pfad, der
    // nie uebernommen wurde, kann auch nicht unbemerkt abweichen.
    expect(hashes.has('a/bild.png')).toBe(false);
    const m = baueManifest({ herkunft, urteile, hashes, gestempeltAm: '2026-09-01T12:00:00Z' });
    expect(m.ausgelassen[0]).not.toHaveProperty('hash');
  });

  it('zaehlt zusammen, damit ein Blick genuegt', () => {
    const m = baueManifest({ herkunft, urteile, hashes, gestempeltAm: '2026-09-01T12:00:00Z' });
    expect(m.summe).toEqual({ uebernommen: 2, ausgelassen: 1, bytes: 300 });
  });

  it('verlangt einen Zeitstempel, statt selbst einen zu erfinden', () => {
    // Der Aufruf ist absichtlich unvollstaendig - geprueft wird die
    // Laufzeitschranke, nicht der Typ. `@ts-expect-error` haelt beides
    // zusammen: TypeScript schweigt hier, meldet sich aber, falls das Feld
    // je optional wuerde und dieser Test dann nichts mehr pruefte.
    // @ts-expect-error gestempeltAm fehlt mit Absicht
    expect(() => baueManifest({ herkunft, urteile, hashes })).toThrow(/Zeitstempel/i);
  });

  it('verlangt einen SHA — ohne ihn ist die Herkunft wertlos', () => {
    const ohne = { ...herkunft, sha: '' };
    expect(() =>
      baueManifest({ herkunft: ohne, urteile, hashes, gestempeltAm: '2026-09-01T12:00:00Z' }),
    ).toThrow(/sha/i);
  });

  it('lehnt eine uebernommene Datei ohne Hash ab und nennt sie beim Namen', () => {
    // Ein Manifest, das eine Datei ohne Hash fuehrt, sieht vollstaendig aus
    // und belegt fuer genau diese Datei nichts. Das soll knallen.
    const luecke = new Map(hashes);
    luecke.delete('a/main.py');
    expect(() =>
      baueManifest({ herkunft, urteile, hashes: luecke, gestempeltAm: '2026-09-01T12:00:00Z' }),
    ).toThrow(/a\/main\.py/);
  });

  it('lehnt einen leeren Hash genauso ab wie einen fehlenden', () => {
    const leer = new Map(hashes);
    leer.set('a/main.py', '');
    expect(() =>
      baueManifest({ herkunft, urteile, hashes: leer, gestempeltAm: '2026-09-01T12:00:00Z' }),
    ).toThrow(/Hash fehlt/i);
  });

  it('lehnt ein Manifest ganz ohne Hashes ab', () => {
    // @ts-expect-error hashes fehlt mit Absicht
    expect(() => baueManifest({ herkunft, urteile, gestempeltAm: '2026-09-01T12:00:00Z' })).toThrow(
      /hashes/i,
    );
  });
});

describe('inhaltsHash', () => {
  it('ergibt fuer denselben Inhalt denselben Wert — sonst belegt er nichts', () => {
    const text = 'Zeile eins\nZeile zwei\n';
    expect(inhaltsHash(text)).toBe(inhaltsHash(text));
  });

  it('aendert sich bei der kleinsten Aenderung', () => {
    expect(inhaltsHash('a')).not.toBe(inhaltsHash('a '));
    expect(inhaltsHash('Zeile\n')).not.toBe(inhaltsHash('Zeile\r\n'));
  });

  it('nennt das Verfahren im Wert, damit spaetere Leser nicht raten muessen', () => {
    expect(inhaltsHash('')).toBe(
      'sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });
});

/**
 * Fassung 3 — das Manifest einer Quelle aus Buch- oder Folienseiten.
 *
 * Drei Dinge entscheiden sich hier und nirgends sonst: wie ein Datei-Hash
 * gebildet wird, wie aus mehreren Datei-Hashes der Stand einer Quelle wird,
 * und was im Manifest steht. Alle drei sind Herkunftsnachweis: Wer sie
 * spaeter anders rechnet, bekommt einen anderen Stand — und die Seite meldet
 * „das Manifest gehört zu einem anderen Stand".
 */
describe('dateiHash', () => {
  const bytes = (...werte: number[]) => new Uint8Array(werte);

  it('nennt das Verfahren im Wert selbst', () => {
    expect(dateiHash(bytes(1, 2, 3))).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it('liefert fuer dieselben Bytes denselben Wert', () => {
    expect(dateiHash(bytes(1, 2, 3))).toBe(dateiHash(bytes(1, 2, 3)));
    expect(dateiHash(bytes(1, 2, 3))).not.toBe(dateiHash(bytes(1, 2, 4)));
  });

  it('unterscheidet Bytes, die als Text gleich aussehen wuerden', () => {
    // Zwei verschiedene ungueltige UTF-8-Folgen: Als Text gelesen wuerden
    // beide zum Ersatzzeichen und haetten denselben Hash. Ein PDF ist kein Text.
    expect(dateiHash(bytes(0xff, 0xfe))).not.toBe(dateiHash(bytes(0xfe, 0xff)));
  });
});

describe('standAusHashes', () => {
  const hashes = ['sha256:' + 'c'.repeat(64), 'sha256:' + 'a'.repeat(64), 'sha256:' + 'b'.repeat(64)];

  it('haengt nicht an der Reihenfolge der Eingabe', () => {
    expect(standAusHashes(hashes)).toBe(standAusHashes([...hashes].reverse()));
  });

  it('sortiert nach Wert und nicht nach der Reihenfolge, in der die Dateien kamen', () => {
    // Sonst haette dieselbe Menge Dateien zwei Staende, je nachdem, wie sie
    // heissen — und ein Umbenennen aendere den Stand.
    expect(standAusHashes(hashes)).not.toBe(inhaltsHash(hashes.join('\n')));
  });

  it('rechnet genau ueber die sortierten Werte, mit Zeilenumbruch dazwischen', () => {
    const sortiert = [...hashes].sort();
    expect(standAusHashes(hashes)).toBe(inhaltsHash(sortiert.join('\n')));
    expect(standAusHashes(hashes)).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it('haengt an jedem einzelnen Hash', () => {
    expect(standAusHashes(hashes)).not.toBe(standAusHashes([...hashes.slice(1), 'sha256:' + 'd'.repeat(64)]));
  });

  it('ergibt fuer einen festen Fixture-Satz immer denselben, einmal ermittelten Stand', () => {
    // Anders als oben: nicht mit demselben Verfahren nachgerechnet, sondern
    // gegen einen Literalwert. Die Fixtures sind byte-gleich reproduzierbar
    // (werkzeug/fixtures/erzeuge.mjs) — weicht einer der drei Werte hier ab,
    // sind es die Fixtures nicht mehr, oder das Verfahren hat sich geaendert.
    const agenda = dateiHash(readFileSync(path.join(FIXTUREN, 'folien-agenda.pdf')));
    const laeufe = dateiHash(readFileSync(path.join(FIXTUREN, 'folien-laeufe.pdf')));
    expect(agenda).toBe('sha256:99a4bb45b1f91d7767eac4696220ec987598801252e2f5c6b36446975d8d2bed');
    expect(laeufe).toBe('sha256:085a59cba48eeefde12ad74069c4bba4dce30a94f65b8ed8d95797211adfec75');
    expect(standAusHashes([agenda, laeufe])).toBe('sha256:3ac610ce0753ac35a76584585549374fba93e2e36c867cf69a5a8b5df95d9095');
  });
});

describe('baueDokumentManifest', () => {
  const originale = [
    { datei: 'M7.pdf', dateiHash: 'sha256:' + 'a'.repeat(64), seiten: 35, gliederung: 'agenda', beiwerkZeichen: 6676 },
    { datei: 'M9.pdf', dateiHash: 'sha256:' + 'b'.repeat(64), seiten: 13, gliederung: 'einzeln', beiwerkZeichen: 2643 },
  ];
  const roh = [
    { id: 'm07-01-begriff', datei: 'M7.pdf', seiten: [1, 5] as [number, number], nurBild: [], tabellenverdacht: [2] },
    { id: 'm07-02-prozess', datei: 'M7.pdf', seiten: [6, 35] as [number, number], nurBild: [16, 19], tabellenverdacht: [17, 26] },
    { id: 'm09-01-folien-1-13', datei: 'M9.pdf', seiten: [1, 13] as [number, number], nurBild: [13], tabellenverdacht: [5, 7] },
  ];
  const baue = () => baueDokumentManifest({ art: 'folien', originale, roh, gestempeltAm: '2026-09-23T08:00:00.000Z' });

  it('traegt Fassung 3 und den Stand aus den Datei-Hashes', () => {
    const manifest = baue();
    expect(manifest.fassung).toBe(3);
    expect(MANIFEST_FASSUNG_DOKUMENT).toBe(3);
    expect(manifest.herkunft).toEqual({
      art: 'folien',
      stand: standAusHashes(originale.map((o) => o.dateiHash)),
    });
  });

  it('rechnet die Summen aus Originalen und Rohdateien', () => {
    expect(baue().summe).toEqual({
      originale: 2,
      seiten: 48,
      abschnitte: 3,
      nurBild: 3,
      tabellenverdacht: 5,
      beiwerkZeichen: 9319,
    });
  });

  it('nennt jede Bildseite und jede Tabellenseite einzeln, nicht nur als Zahl', () => {
    // Der Compiler oeffnet genau diese Seiten im Original. Eine Zaehlung
    // allein sagte ihm nicht, welche.
    expect(baue().roh).toEqual(roh);
    expect(baue().originale).toEqual(originale);
  });

  it('verlangt den Zeitstempel, statt ihn zu erzeugen', () => {
    expect(() => baueDokumentManifest({ art: 'folien', originale, roh, gestempeltAm: '' })).toThrow(/Zeitstempel fehlt/);
  });

  it('verlangt mindestens ein Original', () => {
    expect(() => baueDokumentManifest({ art: 'folien', originale: [], roh, gestempeltAm: 'jetzt' })).toThrow(
      /keine Originale/,
    );
  });

  it('verlangt zu jedem Original seinen Hash', () => {
    const ohne = [{ ...originale[0], dateiHash: '' }];
    expect(() => baueDokumentManifest({ art: 'folien', originale: ohne, roh, gestempeltAm: 'jetzt' })).toThrow(
      /dateiHash fehlt fuer "M7.pdf"/,
    );
  });
});

/**
 * Das Gegenstueck zu `baueDokumentManifest`: Die Werkzeuge lesen das Manifest
 * der Fassung 3 zurueck — `ansicht` den Folienbereich eines Abschnitts,
 * `pruefe-quelle` den Stand und die Seitenlisten. Es wirft nie; was nicht
 * passt, kommt als Grund zurueck, den ein Werkzeug in seinen Satz setzt.
 */
describe('liesDokumentManifest', () => {
  const originale = [
    { datei: 'M7.pdf', dateiHash: 'sha256:' + 'a'.repeat(64), seiten: 35, gliederung: 'agenda', beiwerkZeichen: 6676 },
    { datei: 'M9.pdf', dateiHash: 'sha256:' + 'b'.repeat(64), seiten: 13, gliederung: 'einzeln', beiwerkZeichen: 2643 },
  ];
  const roh = [
    { id: 'm07-01-begriff', datei: 'M7.pdf', seiten: [1, 5] as [number, number], nurBild: [], tabellenverdacht: [2] },
    { id: 'm07-02-prozess', datei: 'M7.pdf', seiten: [6, 35] as [number, number], nurBild: [16, 19], tabellenverdacht: [17, 26] },
    { id: 'm09-01-folien-1-13', datei: 'M9.pdf', seiten: [1, 13] as [number, number], nurBild: [13], tabellenverdacht: [5, 7] },
  ];
  const manifest = () => baueDokumentManifest({ art: 'folien', originale, roh, gestempeltAm: '2026-09-23T08:00:00.000Z' });
  /** Wie das Einlesen es auf die Platte schreibt. */
  const alsText = (wert: unknown) => `${JSON.stringify(wert, null, 2)}\n`;

  it('liest das Manifest, wie baueDokumentManifest es baut', () => {
    expect(liesDokumentManifest(alsText(manifest()))).toEqual({
      ok: true,
      manifest: {
        stand: standAusHashes(originale.map((o) => o.dateiHash)),
        art: 'folien',
        originale: [
          { datei: 'M7.pdf', seiten: 35 },
          { datei: 'M9.pdf', seiten: 13 },
        ],
        roh,
      },
    });
  });

  it('nennt kaputtes JSON als Grund', () => {
    expect(liesDokumentManifest('{ "fassung": 3,')).toEqual({ ok: false, grund: 'kein gültiges JSON' });
  });

  it('nennt eine andere Fassung beim Namen', () => {
    expect(liesDokumentManifest(alsText({ ...manifest(), fassung: 2 }))).toEqual({
      ok: false,
      grund: 'Fassung 2, erwartet 3',
    });
  });

  it('meldet ein Manifest der Fassung 3, dem ein Feld fehlt', () => {
    const ohneRoh: Record<string, unknown> = { ...manifest() };
    delete ohneRoh.roh;
    expect(liesDokumentManifest(alsText(ohneRoh))).toEqual({ ok: false, grund: 'Fassung 3, aber unvollständig' });
  });

  it('meldet ein falsch geformtes Feld genauso', () => {
    // Ein Folienbereich, der rueckwaerts laeuft, ist keiner — ansicht und
    // pruefe-quelle rechnen mit von <= bis.
    const rueckwaerts = manifest();
    rueckwaerts.roh[0].seiten = [5, 1];
    expect(liesDokumentManifest(alsText(rueckwaerts))).toEqual({ ok: false, grund: 'Fassung 3, aber unvollständig' });
    const seitenAlsText = { ...manifest(), originale: [{ datei: 'M7.pdf', seiten: '35' }] };
    expect(liesDokumentManifest(alsText(seitenAlsText))).toEqual({ ok: false, grund: 'Fassung 3, aber unvollständig' });
  });

  it('sagt es, wenn gar keine Fassung dasteht', () => {
    // Wortlaut wie in leseManifestauszug: „Fassung undefined" hilft niemandem.
    expect(liesDokumentManifest('{}')).toEqual({ ok: false, grund: 'ohne Fassung' });
    expect(liesDokumentManifest('null')).toEqual({ ok: false, grund: 'ohne Fassung' });
  });
});
