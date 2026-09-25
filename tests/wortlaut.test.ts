// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { NUR_BILD_ZEILE, WARNZEILE, rohdatei } from '../werkzeug/adapter/folien.mjs';
import {
  FENSTER,
  FUNKTIONSWOERTER,
  MINDEST_FUNKTIONSWOERTER,
  baueIndex,
  findeAbschriften,
  lektionFelder,
  liesRohIndex,
  rohFolien,
  woerter,
} from '../werkzeug/wortlaut.mjs';

/**
 * Der Wortlaut-Abgleich: Eine Lektion faellt durch, wenn sie dreizehn Woerter
 * am Stueck aus einer Rohdatei uebernimmt.
 *
 * Kein Test liest `quellen/` im Projekt. Die Rohdateien hier sind synthetisch
 * und ihr Text ist erfunden; geschrieben werden sie mit `rohdatei` aus dem
 * Einlesen selbst, damit Leser und Schreiber dieselbe Form meinen.
 */

/** 13 Woerter, drei verschiedene Funktionswoerter (die, mit, der). */
const SATZ = 'Die Bauleiterin prüft morgens die Lieferscheine, bevor die Kolonne mit der Arbeit beginnt.';
const SATZ_ZEILEN = ['Die Bauleiterin prüft morgens die Lieferscheine,', 'bevor die Kolonne mit der Arbeit beginnt.'];

/** 13 Woerter ohne ein einziges Funktionswort: eine Begriffskette, kein Satz. */
const KETTE =
  'Baugrube Verbau Wasserhaltung Aushub Sauberkeitsschicht Bodenplatte Abdichtung Dämmung Estrich Belag Sockelleiste Fuge Endreinigung';

/** Ein zweiter Satz mit 13 Woertern, in der Quelle ueber zwei Folien verteilt. */
const SATZ_ZWEI_ANFANG = 'Wer den Bauzaun verschiebt,';
const SATZ_ZWEI_ENDE = 'meldet das vorher der Sicherheitsfachkraft und dem zuständigen Polier.';

/** Eine bereinigte Folie, wie `rohdatei` sie bekommt. */
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

/** Die Rohdatei eines Abschnitts mit den Folien 4 bis 8. */
const ROH = rohdatei({ id: 'x01-01-probe', titel: 'Probe', datei: 'Probe.pdf', seiten: [4, 8] }, [
  folie(4, ['Morgens auf der Baustelle', 'Ein eigener Satz steht hier.']),
  folie(5, ['Die Routine', ...SATZ_ZEILEN]),
  folie(6, [KETTE], { tabellenverdacht: true }),
  folie(7, ['Sicherheit', SATZ_ZWEI_ANFANG]),
  folie(8, [SATZ_ZWEI_ENDE]),
]);

const INDEX = baueIndex([{ quelle: 'probe', abschnitt: 'x01-01-probe', folien: rohFolien(ROH) }]);

/** Eine Lektion mit wenig Frontmatter und dem gegebenen Rumpf. */
function lektion(rumpf: string, kopf: string[] = ['titel: "Eine Probe"']): string {
  return ['---', ...kopf, '---', '', rumpf, ''].join('\n');
}

/** Die Abschriften einer Lektion gegen den Index oben. */
const abschriften = (mdx: string) => findeAbschriften(lektionFelder(mdx), INDEX);

describe('woerter', () => {
  const nur = (text: string) => woerter(text).map((t) => t.w);

  it('faltet mit NFKC, schreibt klein und macht aus ss eins', () => {
    expect(nur('Das Pro\uFB01l')).toEqual(['das', 'profil']);
    expect(nur('BAULEITERIN Prüft')).toEqual(['bauleiterin', 'prüft']);
    expect(nur('Straße STRASSE')).toEqual(['strasse', 'strasse']);
  });

  it('entfernt weiche Trennstriche und Nullbreiten, statt an ihnen zu trennen', () => {
    expect(nur('Lie\u00ADfer\u00ADschein')).toEqual(['lieferschein']);
    expect(nur('Bau\u200Bstelle\uFEFF')).toEqual(['baustelle']);
  });

  it('zaehlt ein Bindestrich-Kompositum als ein Wort, einen Ergaenzungsstrich nicht', () => {
    expect(nur('Detail-Pauschalvertrag')).toEqual(['detailpauschalvertrag']);
    expect(nur('Bau- und Ausbau')).toEqual(['bau', 'und', 'ausbau']);
  });

  it('verbindet einen Bindestrich am Zeilenende mit dem naechsten Wort wie ein Kompositum', () => {
    expect(nur('Detail-\nPauschalvertrag')).toEqual(['detailpauschalvertrag']);
    expect(nur('Detail-\r\nPauschalvertrag')).toEqual(['detailpauschalvertrag']);
    expect(nur('Detail- \n  Pauschalvertrag')).toEqual(['detailpauschalvertrag']);
  });

  it('verbindet nicht ueber den Zeilenumbruch, wenn das Folgewort ein Bindewort ist', () => {
    expect(nur('Kosten-\nund Termine')).toEqual(['kosten', 'und', 'termine']);
    expect(nur('Kosten-\r\nund Termine')).toEqual(['kosten', 'und', 'termine']);
  });

  it('bildet Akut, linkes Anfuehrungszeichen und Modifikator-Apostroph auf denselben Apostroph ab', () => {
    expect(nur('geht´s')).toEqual(['gehts']);
    expect(nur('geht‘s')).toEqual(['gehts']);
    expect(nur('gehtʼs')).toEqual(['gehts']);
    expect(nur("geht's")).toEqual(['gehts']);
    expect(nur('geht´s')).toEqual(nur("geht's"));
  });

  it('liest 1.200.000 als eine Zahl und markiert Zahlen', () => {
    expect(woerter('rund 1.200.000 Euro')).toEqual([
      { w: 'rund', zahl: false },
      { w: '1200000', zahl: true },
      { w: 'euro', zahl: false },
    ]);
  });
});

describe('FUNKTIONSWOERTER', () => {
  it('steht in der normalisierten Form und ohne Einzelbuchstaben', () => {
    expect(FENSTER).toBe(13);
    expect(MINDEST_FUNKTIONSWOERTER).toBe(3);
    for (const wort of FUNKTIONSWOERTER) {
      expect(woerter(wort).map((t) => t.w)).toEqual([wort]);
      expect(wort.length).toBeGreaterThan(1);
    }
  });
});

describe('rohFolien', () => {
  it('laesst Kopf, Marken, Warnzeile und Bildhinweis weg und trennt die Folien', () => {
    const text = rohdatei({ id: 'x01-02-form', titel: 'Form', datei: 'Form.pdf', seiten: [1, 3] }, [
      folie(1, ['Erste Zeile', 'zweite Zeile']),
      folie(2, ['Umsatz im Jahr'], { tabellenverdacht: true }),
      folie(3, [], { nurBild: true }),
    ]);
    expect(text).toContain(WARNZEILE);
    expect(text).toContain(NUR_BILD_ZEILE);
    expect(rohFolien(text)).toEqual([
      { nummer: 1, text: 'Erste Zeile\nzweite Zeile' },
      { nummer: 2, text: 'Umsatz im Jahr' },
      { nummer: 3, text: '' },
    ]);
  });

  it('liest CRLF wie LF', () => {
    expect(rohFolien(ROH.replace(/\n/g, '\r\n'))).toEqual(rohFolien(ROH));
  });

  it('nimmt eine Rohdatei ohne Seitenmarken als eine Einheit mit Folie 0', () => {
    expect(rohFolien('---\nvariante: probe\n---\n\nEin Absatz.\n')).toEqual([
      { nummer: 0, text: '---\nvariante: probe\n---\n\nEin Absatz.' },
    ]);
  });

  it('erkennt auch — Seite N — als Marke, nicht nur — Folie N —', () => {
    const text = ['— Seite 3 —', 'Erster Satz.', '— Seite 4 —', 'Zweiter Satz.'].join('\n');
    expect(rohFolien(text)).toEqual([
      { nummer: 3, text: 'Erster Satz.' },
      { nummer: 4, text: 'Zweiter Satz.' },
    ]);
  });
});

describe('lektionFelder', () => {
  it('nimmt die sichtbaren Texte je Feld, ohne typ, id und url', () => {
    const mdx = [
      '---',
      'titel: "Titel der Lektion"',
      'reihenfolge: 2',
      'aufgaben:',
      '  - typ: wahl',
      '    id: p-1',
      '    frage: "Eine Frage?"',
      'quellen:',
      '  - pfad: "ordner/datei"',
      '    url: "https://example.org/x"',
      '---',
      "import Irgendwas from './irgendwo';",
      '',
      'Ein Absatz mit [Verweis](https://example.org/ziel) und <b>Auszeichnung</b>.',
      '',
      "<Pipeline einheit=\"Dokument\" schritte={[{ id: 'a', titel: 'Suche', wirkung: 'Holt Kandidaten.' }]} />",
      '',
      'Noch ein Absatz, siehe https://example.org/nackt dazu.',
    ].join('\n');
    const felder = lektionFelder(mdx);
    expect(felder.map((f) => f.feld)).toEqual([
      'titel',
      'aufgaben[0].frage',
      'quellen[0].pfad',
      'rumpf<Pipeline>.einheit',
      'rumpf<Pipeline>.schritte[0].titel',
      'rumpf<Pipeline>.schritte[0].wirkung',
      'rumpf',
    ]);
    const rumpf = felder[felder.length - 1].text;
    expect(woerter(rumpf).map((t) => t.w)).toEqual([
      ...['ein', 'absatz', 'mit', 'verweis', 'und', 'auszeichnung'],
      ...['noch', 'ein', 'absatz', 'siehe', 'dazu'],
    ]);
  });

  it('liest auch eine Lektion, deren Kopf oder Widget sich nicht auswerten laesst', () => {
    expect(lektionFelder('Nur Prosa, kein Frontmatter.')).toEqual([
      { feld: 'rumpf', text: 'Nur Prosa, kein Frontmatter.' },
    ]);
    expect(lektionFelder('---\ntitel: "unbeendet\n---\nRumpf.').map((f) => f.feld)).toEqual(['frontmatter', 'rumpf']);
    expect(lektionFelder('---\nNur ein Satz im Kopf\n---\nRumpf.')).toEqual([
      { feld: 'frontmatter', text: 'Nur ein Satz im Kopf' },
      { feld: 'rumpf', text: 'Rumpf.' },
    ]);
    const kaputt = lektion('<Pipeline schritte={[ { titel: Suche ohne Anfuehrung } ]} />');
    expect(lektionFelder(kaputt).map((f) => f.feld)).toEqual(['titel', 'rumpf<Pipeline>', 'rumpf']);
  });

  it('behandelt HTML-Entitaeten im Rumpf, ohne sie als eigene Woerter zu zaehlen', () => {
    const mdx = lektion('Eisen&shy;bahn und Bau&nbsp;Ausbau sowie A&amp;B und Fr&uuml;hbau nach Plan.');
    const rumpf = lektionFelder(mdx).find((f) => f.feld === 'rumpf');
    if (!rumpf) throw new Error('kein rumpf-Feld gefunden');
    expect(woerter(rumpf.text).map((t) => t.w)).toEqual([
      'eisenbahn',
      'und',
      'bau',
      'ausbau',
      'sowie',
      'a',
      'b',
      'und',
      'fr',
      'hbau',
      'nach',
      'plan',
    ]);
  });
});

describe('findeAbschriften', () => {
  // 3
  it('findet einen Satz aus Folie 5 im Rumpf, mit Feld und Wortbereich', () => {
    const mdx = lektion(`Ein eigener Absatz vorweg.\n\n${SATZ}\n\nDanach geht es anders weiter.`);
    expect(abschriften(mdx)).toEqual([
      { feld: 'rumpf', von: 5, bis: 17, quelle: 'probe', abschnitt: 'x01-01-probe', folie: 5 },
    ]);
  });

  // 4
  it('laesst zwoelf gleiche Woerter durch', () => {
    const zwoelf = SATZ.replace(' beginnt.', '');
    expect(woerter(zwoelf)).toHaveLength(12);
    expect(abschriften(lektion(`${zwoelf} und hier schliesst ein eigener Gedanke an.`))).toEqual([]);
  });

  // 5
  it('findet den Satz auch mit eingeschobener Zahl, mit einem ersetzten Wort nicht', () => {
    const mitZahl = SATZ.replace('die Lieferscheine', 'die 12 Lieferscheine');
    expect(abschriften(lektion(mitZahl))).toEqual([
      { feld: 'rumpf', von: 1, bis: 13, quelle: 'probe', abschnitt: 'x01-01-probe', folie: 5 },
    ]);
    const ersetzt = SATZ.replace('Lieferscheine', 'Frachtbriefe');
    expect(abschriften(lektion(ersetzt))).toEqual([]);
  });

  // 6
  it('bildet kein Fenster ueber zwei Felder und keins ueber zwei Folien', () => {
    const [anfang, ende] = SATZ_ZEILEN;
    const verteilt = lektion(ende, [`titel: "${anfang}"`]);
    expect(lektionFelder(verteilt).map((f) => f.feld)).toEqual(['titel', 'rumpf']);
    expect(abschriften(verteilt)).toEqual([]);
    expect(abschriften(lektion(`${SATZ_ZWEI_ANFANG} ${SATZ_ZWEI_ENDE}`))).toEqual([]);
  });

  // 7
  it('laesst eine Begriffskette ohne Funktionswort durch', () => {
    expect(woerter(KETTE)).toHaveLength(13);
    expect(abschriften(lektion(KETTE))).toEqual([]);
  });

  // 8
  it('findet den Satz in Grossschrift, mit NFD-Umlaut, Fettdruck und Zeilenumbruch', () => {
    const verstellt = SATZ.toUpperCase().normalize('NFD').replace('LIEFERSCHEINE, ', '**LIEFERSCHEINE**,\n');
    expect(verstellt).toContain('\u0308');
    expect(abschriften(lektion(verstellt))).toEqual([
      { feld: 'rumpf', von: 1, bis: 13, quelle: 'probe', abschnitt: 'x01-01-probe', folie: 5 },
    ]);
  });

  it('findet eine Abschrift in einem Widget-Parameter, mit dem Feld benannt wie im Code', () => {
    const mdx = lektion(
      `<Pipeline einheit="Dokument" schritte={[{ id: 'a', titel: 'Schritt', wirkung: "${SATZ}" }]} />`,
    );
    expect(abschriften(mdx)).toEqual([
      {
        feld: 'rumpf<Pipeline>.schritte[0].wirkung',
        von: 1,
        bis: 13,
        quelle: 'probe',
        abschnitt: 'x01-01-probe',
        folie: 5,
      },
    ]);
  });

  // 9
  it('benennt ein Frontmatter-Feld mit seinem Pfad', () => {
    const mdx = lektion('Eigener Rumpf.', [
      'titel: "Eine Probe"',
      'aufgaben:',
      '  - typ: fall',
      '    id: f-1',
      `    aufgabe: "Zuerst ein eigener Satz. ${SATZ}"`,
    ]);
    expect(abschriften(mdx)).toEqual([
      { feld: 'aufgaben[0].aufgabe', von: 5, bis: 17, quelle: 'probe', abschnitt: 'x01-01-probe', folie: 5 },
    ]);
  });

  it('fasst eine laengere Abschrift zu einem Bereich zusammen', () => {
    const laenger = `${SATZ_ZEILEN[0]} ${SATZ_ZEILEN[1]}`.replace('Die Bauleiterin', 'Die Routine Die Bauleiterin');
    expect(abschriften(lektion(laenger))).toEqual([
      { feld: 'rumpf', von: 1, bis: 15, quelle: 'probe', abschnitt: 'x01-01-probe', folie: 5 },
    ]);
  });

  // 1: Kompositum ueber den Zeilenumbruch in der Rohdatei
  it('findet eine Abschrift, deren Kompositum in der Rohdatei am Zeilenende umbricht', () => {
    const satz = 'Der Nachunternehmer widerspricht dem Detail-Pauschalvertrag und verlangt eine Prüfung der Mengen vor Ort.';
    const roh = rohdatei({ id: 'y01-01-kompositum', titel: 'Kompositum', datei: 'Kompositum.pdf', seiten: [1, 1] }, [
      folie(1, [
        'Der Nachunternehmer widerspricht dem Detail-',
        'Pauschalvertrag und verlangt eine Prüfung der Mengen vor Ort.',
      ]),
    ]);
    const index = baueIndex([{ quelle: 'kompositum', abschnitt: 'y01-01-kompositum', folien: rohFolien(roh) }]);
    expect(findeAbschriften(lektionFelder(lektion(satz)), index)).toEqual([
      { feld: 'rumpf', von: 1, bis: 13, quelle: 'kompositum', abschnitt: 'y01-01-kompositum', folie: 1 },
    ]);
  });

  // 2: verschiedene statt gezaehlte Funktionswoerter
  it('laesst ein Fenster durch, das nur zwei verschiedene Funktionswoerter enthaelt, auch mit oft wiederholten', () => {
    const nurZweiVerschiedene = 'Die der die der die der die der die der die der die';
    expect(woerter(nurZweiVerschiedene)).toHaveLength(13);
    const index = baueIndex([
      { quelle: 'probe', abschnitt: 'x02-nur-funktionswoerter', folien: rohFolien(nurZweiVerschiedene) },
    ]);
    expect(findeAbschriften(lektionFelder(lektion(nurZweiVerschiedene)), index)).toEqual([]);
  });
});

describe('liesRohIndex', () => {
  function temp(): string {
    return mkdtempSync(path.join(tmpdir(), 'kernbohrung-wortlaut-'));
  }

  // 10
  it('gibt ohne quellen/ und ohne Rohdateien null zurueck', () => {
    const wurzel = temp();
    try {
      expect(liesRohIndex(wurzel)).toBeNull();
      mkdirSync(path.join(wurzel, 'quellen', 'leer'), { recursive: true });
      writeFileSync(path.join(wurzel, 'quellen', 'leer', 'manifest.json'), '{}', 'utf8');
      expect(liesRohIndex(wurzel)).toBeNull();
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });

  it('liest die Rohdateien aller Quellen und zaehlt sie', () => {
    const wurzel = temp();
    try {
      const roh = (quelle: string) => {
        const ordner = path.join(wurzel, 'quellen', quelle, 'roh');
        mkdirSync(ordner, { recursive: true });
        return ordner;
      };
      writeFileSync(path.join(roh('probe'), 'x01-01-probe.md'), ROH, 'utf8');
      writeFileSync(path.join(roh('probe'), 'x01-02-anderes.md'), '# Anderes\n\n— Folie 9 —\nNichts davon.\n', 'utf8');
      writeFileSync(path.join(roh('probe'), 'notiz.txt'), SATZ, 'utf8');
      // Wie eine Git-Quelle: ohne Seitenmarken, mit CRLF.
      const variante = `---\r\nvariante: zweite\r\n---\r\n\r\nEin Absatz vorweg.\r\n\r\n${SATZ_ZWEI_ANFANG} ${SATZ_ZWEI_ENDE}\r\n`;
      writeFileSync(path.join(roh('zweite'), 'variante.md'), variante, 'utf8');

      const gelesen = liesRohIndex(wurzel);
      expect(gelesen?.dateien).toBe(3);
      const felder = lektionFelder(lektion(`${SATZ}\n\n${SATZ_ZWEI_ANFANG} ${SATZ_ZWEI_ENDE}`));
      expect(findeAbschriften(felder, gelesen!.index)).toEqual([
        { feld: 'rumpf', von: 1, bis: 13, quelle: 'probe', abschnitt: 'x01-01-probe', folie: 5 },
        { feld: 'rumpf', von: 14, bis: 26, quelle: 'zweite', abschnitt: 'variante', folie: 0 },
      ]);
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });
});
