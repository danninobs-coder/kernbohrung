/**
 * Datei -> Seiten. Der einzige Ort im Projekt, an dem pdf.js vorkommt.
 *
 * Zwei Teile mit scharfer Grenze:
 *   `liesSeiten(bytes, geladen)`  liest ein PDF: Rohzeilen je Seite, Seitenformat,
 *                                Bildplatzierungen, waagrechte und senkrechte Linien.
 *   der Rest von `dokument.mjs`   rechnet daraus, ohne pdf.js und ohne Datei.
 *
 * Die Grenze ist keine Ordnungsliebe: Der zweite Teil laesst sich mit
 * erfundenen Seiten testen — schnell, ohne PDF und ohne fremdes Lehrmaterial —,
 * und ein Ausfuehrer im Browser (Weg B) koennte beide Teile unveraendert
 * benutzen, denn pdf.js laeuft auch dort.
 */
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

/**
 * Gleiche Grundlinie, solange der Hoehenunterschied unter drei Zehnteln der
 * kleineren Schriftgroesse bleibt.
 */
const ZEILE_TOLERANZ = 0.3;

/**
 * Eine Luecke ueber dem Doppelten der Schriftgroesse trennt: Zwei Textfelder
 * auf gleicher Hoehe sind zwei Zeilen, nicht eine.
 */
const SPALTEN_LUECKE = 2;

/** Ab dieser Luecke steht zwischen zwei Stuecken ein Leerzeichen. */
const WORT_LUECKE = 0.15;

/**
 * Bildplatzierungen werden auf 4 pt gerundet, bevor sie verglichen werden.
 * Ohne das Raster faende die Wiederkehr das Logo im Briefkopf nicht, weil
 * seine Koordinaten sich in der dritten Nachkommastelle unterscheiden.
 */
const BILD_RASTER = 4;

/**
 * @typedef {{ text: string, groesse: number, y: number, x0: number, x1: number, gedreht?: boolean }} Zeile
 * @typedef {{ hLinien: number, vLinien: number }} Gitter
 * @typedef {{ nummer: number, breite: number, hoehe: number, zeilen: Zeile[], bilder: string[], gitter: Gitter }} RohSeite
 * @typedef {{ pdfjs: any, optionen: Record<string, unknown>, bildOps: Set<number> }} Pdfjs
 */

// ---------------------------------------------------------------------------
// pdf.js laden

/**
 * Genau diese drei Meldungen kommen beim Laden, wenn `@napi-rs/canvas` fehlt —
 * und nur sie werden geschluckt.
 *
 * Ueber `verbosity` geht das nicht: Sie erscheinen beim Laden des Moduls,
 * bevor `getDocument` die Stufe setzt. Der Canvas ist eine optionale
 * Abhaengigkeit von pdf.js und wird nur zum Rendern gebraucht; die
 * Textextraktion liefert ohne ihn dieselben Zahlen (gemessen an neun
 * Foliensaetzen: gleiche Zeichenzahl, gleiche Bildoperatoren). Wer mit
 * `npm ci --omit=optional` installiert, soll deshalb keine Meldung sehen, die
 * wie ein Fehler aussieht.
 */
const IMPORT_MELDUNGEN = [/^Warning: Cannot load "@napi-rs\/canvas"/, /^Warning: Cannot polyfill `(DOMMatrix|Path2D)`/];

/**
 * Laedt pdf.js und die Pfade zu seinen Daten.
 *
 * Nur der legacy-Build laeuft unter Node 24: Der moderne Build meldet „Please
 * use the legacy build in Node.js environments" und scheitert an
 * `Uint8Array.prototype.toHex`, das es in V8 13.6 noch nicht gibt.
 *
 * Die vier Datenpfade sind nicht Kosmetik. Ohne sie meldet pdf.js je Datei
 * fehlende Standardschriften und nicht dekodierbare JBIG2-Bilder — bei neun
 * Foliensaetzen 61 Zeilen auf der Konsole. Mit ihnen: keine. Sie muessen auf
 * `/` enden; `path.join(...) + path.sep` endet unter Windows auf `\` und wird
 * mit „Invalid factory url" abgewiesen.
 *
 * @param {string} [basisOrdner] wo pdfjs-dist liegt; sonst ueber die Aufloesung
 * @returns {Promise<Pdfjs>}
 */
export async function ladePdfjs(basisOrdner) {
  const require = createRequire(import.meta.url);
  const basis = basisOrdner ?? path.dirname(require.resolve('pdfjs-dist/package.json'));
  const warn = console.warn;
  console.warn = (...teile) => {
    if (!IMPORT_MELDUNGEN.some((muster) => muster.test(String(teile[0])))) warn(...teile);
  };
  let pdfjs;
  try {
    pdfjs = await import(pathToFileURL(path.join(basis, 'legacy/build/pdf.mjs')).href);
  } finally {
    console.warn = warn;
  }
  /** @type {(name: string) => string} */
  const ordner = (name) => `${path.join(basis, name).replaceAll(path.sep, '/')}/`;
  const optionen = {
    // ERRORS (0): Ein beschaedigtes PDF soll die Konsole nicht fluten. Die
    // Ursachen stellen aber die Datenpfade ab, nicht die Stufe.
    verbosity: pdfjs.VerbosityLevel.ERRORS,
    standardFontDataUrl: ordner('standard_fonts'),
    cMapUrl: ordner('cmaps'),
    wasmUrl: ordner('wasm'),
    iccUrl: ordner('iccs'),
  };
  // Nur die paint*-Varianten: Ein Inline-Bild (BI/ID/EI im Content-Stream,
  // OPS 63-65 = beginInlineImage/beginImageData/endInlineImage) baut pdf.js
  // beim Erzeugen der Operatorliste schon zu einem einzigen
  // paintInlineImageXObject zusammen (pdf.worker.mjs, Fall
  // OPS.endInlineImage ruft buildPaintImageXObject auf). Die drei anderen
  // OPS tauchen in der fertigen Liste nicht auf; sie zusaetzlich zu
  // zaehlen waere eine Doppelzaehlung desselben Bilds.
  const bildOps = new Set(
    Object.entries(pdfjs.OPS)
      .filter(([name]) => /^paint.*Image|^paintSolidColorImageMask$/.test(name))
      .map(([, wert]) => Number(wert)),
  );
  return { pdfjs, optionen, bildOps };
}

// ---------------------------------------------------------------------------
// Teil 1: pdf.js -> Rohseiten

/**
 * Ein PDF, das sich oeffnen laesst, aber nicht so lesen, wie diese Fassung es
 * braucht. Die Meldung ist deutsch und nennt die Abhilfe; wer einliest, setzt
 * den Dateinamen davor. Eigene Klasse, damit das Einlesen sie von einem
 * Fehler im Programm unterscheiden kann.
 */
export class DokumentFehler extends Error {}

/**
 * Liest ein PDF.
 *
 * Aufgeraeumt wird mit `ladeaufgabe.destroy()`: `PDFDocumentProxy.destroy()`
 * gibt es in 6.3 nicht mehr.
 *
 * @param {Uint8Array} bytes
 * @param {Pdfjs} geladen
 * @returns {Promise<{ seiten: RohSeite[] }>}
 */
export async function liesSeiten(bytes, geladen) {
  const { pdfjs, optionen, bildOps } = geladen;
  const ladeaufgabe = pdfjs.getDocument({ data: bytes, ...optionen });
  try {
    const doc = await ladeaufgabe.promise;
    /** @type {RohSeite[]} */
    const seiten = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const seite = await doc.getPage(n);
      if (seite.rotate !== 0) {
        throw new DokumentFehler(
          `Seite ${n} ist um ${seite.rotate} Grad gedreht. Gedrehte Seiten liest diese Fassung noch nicht in der richtigen Reihenfolge; bitte das PDF ohne Drehung speichern.`,
        );
      }
      // getViewport beruecksichtigt /Rotate — die gedrehte Seite ist die,
      // die man sieht, und nur sie entscheidet ueber quer oder hoch.
      const sichtfeld = seite.getViewport({ scale: 1 });
      const textinhalt = await seite.getTextContent();
      const operatoren = await seite.getOperatorList();
      const grafik = werteOperatorenAus(operatoren, pdfjs.OPS, bildOps);
      seiten.push({
        nummer: n,
        breite: sichtfeld.width,
        hoehe: sichtfeld.height,
        zeilen: zeilenAus(textinhalt.items),
        bilder: grafik.bilder,
        gitter: grafik.gitter,
      });
      seite.cleanup();
    }
    return { seiten };
  } finally {
    await ladeaufgabe.destroy();
  }
}

// --- Operatorliste ----------------------------------------------------------

/** @type {(m: number[], n: ArrayLike<number>) => number[]} Zwei Matrizen [a b c d e f] multiplizieren. */
const mal = (m, n) => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];

/** @type {(m: number[], x: number, y: number) => number[]} Einen Punkt durch die Matrix schicken. */
const punkt = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

/**
 * Subpfade aus den Pfaddaten: 0 moveTo, 1 lineTo, 2 curveTo,
 * 3 quadraticCurveTo, 4 closePath.
 *
 * @param {ArrayLike<number>} daten
 * @returns {{ punkte: number[][], kurve: boolean }[]}
 */
function subpfade(daten) {
  /** @type {{ punkte: number[][], kurve: boolean }[]} */
  const aus = [];
  /** @type {{ punkte: number[][], kurve: boolean } | null} */
  let aktuell = null;
  for (let i = 0; i < daten.length; ) {
    const op = daten[i++];
    if (op === 0) {
      aktuell = { punkte: [[daten[i], daten[i + 1]]], kurve: false };
      aus.push(aktuell);
      i += 2;
    } else if (op === 1) {
      aktuell?.punkte.push([daten[i], daten[i + 1]]);
      i += 2;
    } else if (op === 2) {
      if (aktuell) {
        aktuell.kurve = true;
        aktuell.punkte.push([daten[i + 4], daten[i + 5]]);
      }
      i += 6;
    } else if (op === 3) {
      if (aktuell) {
        aktuell.kurve = true;
        aktuell.punkte.push([daten[i + 2], daten[i + 3]]);
      }
      i += 4;
    } else if (op !== 4) break;
  }
  return aus;
}

/** Eine Linie zaehlt ab dieser Dicke nicht mehr als Linie, sondern als Flaeche. */
const LINIE_DICKE = 2.5;
/** Kuerzere waagrechte Striche sind Unterstreichungen, keine Tabellenlinien. */
const LINIE_WAAGRECHT_MIN = 30;
/** Kuerzere senkrechte Striche sind Trennzeichen, keine Spaltenlinien. */
const LINIE_SENKRECHT_MIN = 10;

/**
 * Wertet die Operatorliste einer Seite aus — ohne ein einziges Zeichen Text.
 *
 * Zwei Dinge kommen dabei heraus:
 *
 * 1. **Jedes Bild mit seiner Platzierung** (Groesse und Lage, auf 4 pt
 *    gerundet) als Schluessel. Daran erkennt man ein Logo, das auf jeder Seite
 *    an derselben Stelle steht: „mindestens ein Bild" trennt sonst gar nichts
 *    — am echten Material trug jede der 199 Seiten eines, naemlich das Logo.
 * 2. **Achsparallele Linien.** Das ist die einzige inhaltsfreie Gegenprobe auf
 *    eine Tabelle: Ein Liniengitter ist eines, gleich was in den Zellen steht.
 *
 * Die laufende Transformation wird ueber save/restore/transform und
 * Form-XObjects verfolgt; ohne das liegen alle Bilder im Einheitsquadrat.
 *
 * @param {{ fnArray: ArrayLike<number>, argsArray: any[] }} operatoren
 * @param {Record<string, number>} OPS
 * @param {Set<number>} bildOps
 * @returns {{ bilder: string[], gitter: Gitter }}
 */
export function werteOperatorenAus(operatoren, OPS, bildOps) {
  let ctm = [1, 0, 0, 1, 0, 0];
  /** @type {number[][]} */
  const stapel = [];
  /** @type {string[]} */
  const bilder = [];
  /** @type {Set<number>} */
  const waagrecht = new Set();
  /** @type {Set<number>} */
  const senkrecht = new Set();
  /** @type {(wert: number) => number} */
  const raster = (wert) => Math.round(wert / BILD_RASTER) * BILD_RASTER;

  for (let i = 0; i < operatoren.fnArray.length; i++) {
    const fn = operatoren.fnArray[i];
    const args = operatoren.argsArray[i];
    if (fn === OPS.save) stapel.push(ctm);
    else if (fn === OPS.restore) ctm = stapel.pop() ?? [1, 0, 0, 1, 0, 0];
    else if (fn === OPS.transform) ctm = mal(ctm, args);
    else if (fn === OPS.paintFormXObjectBegin) {
      stapel.push(ctm);
      if (args?.[0] && args[0].length === 6) ctm = mal(ctm, [...args[0]]);
    } else if (fn === OPS.paintFormXObjectEnd) ctm = stapel.pop() ?? [1, 0, 0, 1, 0, 0];
    else if (bildOps.has(fn)) {
      // Ein Bild fuellt das Einheitsquadrat unter der laufenden Transformation.
      const [x0, y0] = punkt(ctm, 0, 0);
      const [x1, y1] = punkt(ctm, 1, 1);
      bilder.push(
        `${raster(Math.abs(x1 - x0))}x${raster(Math.abs(y1 - y0))}@${raster(Math.min(x0, x1))},${raster(Math.min(y0, y1))}`,
      );
    } else if (fn === OPS.constructPath) {
      const daten = args?.[1]?.[0];
      if (!daten || !daten.length) continue;
      for (const subpfad of subpfade(daten)) {
        if (subpfad.kurve || subpfad.punkte.length < 2) continue;
        const ecken = subpfad.punkte.map(([x, y]) => punkt(ctm, x, y));
        const xs = ecken.map((e) => e[0]);
        const ys = ecken.map((e) => e[1]);
        const x0 = Math.min(...xs);
        const x1 = Math.max(...xs);
        const y0 = Math.min(...ys);
        const y1 = Math.max(...ys);
        const breite = x1 - x0;
        const hoehe = y1 - y0;
        if (hoehe <= LINIE_DICKE && breite >= LINIE_WAAGRECHT_MIN) waagrecht.add(Math.round((y0 + y1) / 2));
        else if (breite <= LINIE_DICKE && hoehe >= LINIE_SENKRECHT_MIN) senkrecht.add(Math.round((x0 + x1) / 2));
      }
    }
  }
  return { bilder, gitter: { hLinien: waagrecht.size, vLinien: senkrecht.size } };
}

// --- Textelemente -> Zeilen -------------------------------------------------

/**
 * Textelemente zu Zeilen zusammensetzen.
 *
 * pdf.js liefert die Elemente in **Stromreihenfolge, nicht in
 * Lesereihenfolge** — auf einer Agendafolie des echten Materials kam der
 * Titel nach der Liste. Ohne die Sortierung nach y waere „die oberste Zeile
 * ist der Titel" schlicht falsch.
 *
 * Gruppiert wird nach Grundlinie, getrennt an grossen Luecken (zwei
 * Textfelder nebeneinander sind zwei Zeilen). Leerzeichen-Elemente fallen
 * weg; ihre Breite zeigt sich ohnehin als Luecke. Gedrehte Elemente —
 * Achsenbeschriftungen — stehen als eigene Zeilen hinten und sind markiert:
 * Sie haben keine sinnvolle Lage in der Leseordnung.
 *
 * @param {readonly any[]} elemente wie `getTextContent().items`
 * @returns {Zeile[]}
 */
export function zeilenAus(elemente) {
  const teile = [];
  for (const element of elemente) {
    if (!('str' in element) || !element.str || !element.str.trim()) continue;
    const [a, b, c, d, e, f] = element.transform;
    const gedreht = Math.abs(b) > 1e-3 || Math.abs(c) > 1e-3;
    const groesse = Math.hypot(c, d) || Math.hypot(a, b) || element.height || 1;
    teile.push({ text: element.str, x: e, y: f, breite: element.width, groesse, gedreht });
  }

  const waagrecht = teile.filter((t) => !t.gedreht).sort((p, q) => q.y - p.y || p.x - q.x);
  /** @type {{ y: number, groesse: number, teile: typeof teile }[]} */
  const reihen = [];
  for (const teil of waagrecht) {
    const letzte = reihen[reihen.length - 1];
    if (letzte && Math.abs(letzte.y - teil.y) <= ZEILE_TOLERANZ * Math.min(letzte.groesse, teil.groesse)) {
      letzte.teile.push(teil);
      letzte.groesse = Math.max(letzte.groesse, teil.groesse);
    } else {
      reihen.push({ y: teil.y, groesse: teil.groesse, teile: [teil] });
    }
  }

  const zeilen = [];
  for (const reihe of reihen) {
    reihe.teile.sort((p, q) => p.x - q.x);
    let aktuell = null;
    for (const teil of reihe.teile) {
      const groesse = Math.max(teil.groesse, aktuell?.groesse ?? 0);
      const luecke = aktuell ? teil.x - aktuell.x1 : 0;
      // Schein-Fettdruck setzt denselben Text deckungsgleich ein zweites Mal.
      if (aktuell && Math.abs(teil.x - aktuell.letztX) < 0.5 && teil.text === aktuell.letztText) continue;
      if (!aktuell || luecke > SPALTEN_LUECKE * groesse) {
        aktuell = {
          text: teil.text,
          groesse: teil.groesse,
          y: reihe.y,
          x0: teil.x,
          x1: teil.x + teil.breite,
          letztX: teil.x,
          letztText: teil.text,
        };
        zeilen.push(aktuell);
      } else {
        const leerzeichen = luecke > WORT_LUECKE * groesse && !aktuell.text.endsWith(' ') && !teil.text.startsWith(' ');
        aktuell.text += (leerzeichen ? ' ' : '') + teil.text;
        aktuell.groesse = Math.max(aktuell.groesse, teil.groesse);
        aktuell.x1 = Math.max(aktuell.x1, teil.x + teil.breite);
        aktuell.letztX = teil.x;
        aktuell.letztText = teil.text;
      }
    }
  }

  for (const teil of teile.filter((t) => t.gedreht)) {
    zeilen.push({ text: teil.text, groesse: teil.groesse, y: teil.y, x0: teil.x, x1: teil.x, gedreht: true });
  }

  return zeilen
    .map(({ text, groesse, y, x0, x1, gedreht }) => ({
      text: text.replace(/\s+/g, ' ').trim(),
      // Auf ein Zehntel gerundet: Zwei Zeilen derselben Ueberschrift sollen
      // dieselbe Groesse haben, auch wenn die Matrix in der sechsten
      // Nachkommastelle abweicht.
      groesse: Math.round(groesse * 10) / 10,
      y,
      x0,
      x1,
      ...(gedreht ? { gedreht: true } : {}),
    }))
    .filter((zeile) => zeile.text);
}

// ---------------------------------------------------------------------------
// Teil 2: rein — Beiwerk, Silbentrennung, Bildseiten, Tabellenverdacht, Art
//
// Ab hier kommt kein pdf.js mehr vor. Eingabe sind Rohseiten, wie `liesSeiten`
// sie liefert; erfundene Rohseiten tun es genauso, und genau so wird geprueft.

/** Eine Zeile gilt als Beiwerk, wenn sie auf so vielen Seiten der Datei steht. */
const BEIWERK_ANTEIL = 0.8;

/**
 * Unter fuenf Seiten traegt die Wiederkehr nicht.
 *
 * Gemessen: Eine Datei mit einer einzigen Seite hat jede Zeile auf 100 % ihrer
 * Seiten — der ganze Text waere Beiwerk, der Nutztext null, und die Datei
 * wuerde als Scan abgewiesen. Solche Dateien uebernehmen deshalb das Beiwerk,
 * das in den groesseren Dateien derselben Quelle erkannt wurde.
 */
const BEIWERK_MINDEST_SEITEN = 5;

/** Beiwerk steht an fester Stelle: hoechstens ein Prozent der Seitenhoehe Streuung. */
const BEIWERK_LAGE_TOLERANZ = 0.01;

/**
 * ... und im oberen oder unteren Randstreifen der Seite.
 *
 * Ohne diese Bedingung wird ein Aufzaehlungspunkt, der sich nur in einer Zahl
 * unterscheidet und auf 80 % der Folien an derselben Stelle steht, zu Beiwerk
 * — der Satz verloere seinen Inhalt. Am echten Material liegt jede
 * Beiwerkzeile im Randstreifen (Lage 0,07 oder 0,93) und streut hoechstens ein
 * Zehntelprozent.
 */
const BEIWERK_RANDSTREIFEN = 0.15;

/**
 * Ueber diesem Anteil entfernten Texts meldet das Einlesen eine Warnung: Dann
 * stimmt vermutlich etwas mit der Extraktion nicht. Am echten Material lag der
 * hoechste Wert bei 57 % — ein Satz mit vielen Bildfolien, an dem nichts falsch
 * ist. Die Schwelle warnt also knapp ueber dem, was noch legitim vorkommt.
 */
export const BEIWERK_WARNUNG = 0.6;

/** Weniger Nutztext als das zaehlt als „kein Text auf dieser Seite". */
const NUR_BILD_ZEICHEN = 20;

/** Eine einzelne Zeile unter dieser Laenge neben einem Bild ist eine Bildunterschrift. */
const NUR_BILD_EINE_ZEILE = 40;

/** Ab so vielen waagrechten UND senkrechten Linien ist es ein Tabellengitter. */
const TABELLE_LINIEN = 5;

/** ... oder ab so vielen Zeilen, die nur aus Zahlen, Daten und Einheiten bestehen. */
const TABELLE_ZAHLZEILEN = 3;

/** Unter so vielen Zeichen gilt eine Seite als leer. */
const KEINE_TEXTEBENE_ZEICHEN = 20;

/** Sind mehr als so viele Seiten leer, hat die Datei keine Textebene. */
const KEINE_TEXTEBENE_ANTEIL = 0.9;

/** Median des Nutztexts je Seite, unter dem ein Querformat als Folien gilt. */
const FOLIEN_MEDIAN = 600;

/**
 * @typedef {RohSeite & { quer: boolean, zeichen: number, beiwerkZeichen: number, echteBilder: number, nurBild: boolean, tabellenverdacht: boolean }} Seite
 * @typedef {{ datei: string, seiten: RohSeite[] }} RohDatei
 * @typedef {{
 *   datei: string, seitenzahl: number, quer: number, median: number, abbruch: string | null,
 *   beiwerk: string[], beiwerkHerkunft: 'datei' | 'quelle' | 'keins',
 *   beiwerkZeichen: number, gesamtZeichen: number, beiwerkAnteil: number, trennungen: number,
 *   nurBild: number[], tabellenverdacht: number[], seiten: Seite[]
 * }} Datei
 */

/**
 * Der Vergleichsschluessel einer Zeile: jede Ziffernfolge wird zu einem `#`.
 *
 * **Folge**, nicht Ziffer. Wer jede Ziffer einzeln ersetzt, macht aus
 * „Folie 7" und „Folie 17" zwei verschiedene Zeilen (`Folie #` und `Folie ##`).
 * In jedem Satz mit mehr als neun Folien erreicht dann keine der beiden die
 * 80 %, und die laufende Foliennummer bleibt im Nutztext stehen — gemessen an
 * drei Saetzen: 39/61, 29/71 und 26/74 Prozent.
 *
 * @param {string} text
 * @returns {string}
 */
export const schluessel = (text) => text.replace(/\d+/g, '#').replace(/\s+/g, ' ').trim();

/**
 * Zeichen ohne Leerraum.
 *
 * @param {string} text
 * @returns {number}
 */
export const zeichen = (text) => text.replace(/\s/g, '').length;

/** Woerter, vor denen ein Strich am Zeilenende kein Trennstrich ist, sondern ein Ergaenzungsstrich. */
const BINDEWORT = new Set(['und', 'oder', 'bzw', 'bzw.', 'sowie', 'bis', 'als', 'wie', 'noch', 'statt', 'u.', 'o.']);

/** Trennstrich, weiches Trennzeichen, Bindestrich-Variante. */
const TRENNSTRICH = /\p{L}[-­‐]$/u;

/**
 * Silbentrennung zusammenziehen.
 *
 * Bedingungen, alle zusammen: Die Zeile endet auf Buchstabe und Trennstrich,
 * die naechste beginnt klein, steht direkt darunter und ueberlappt im
 * x-Bereich — also im selben Textfeld. Und das erste Wort der naechsten Zeile
 * ist kein Bindewort: „Kosten- und Terminplanung" traegt einen
 * Ergaenzungsstrich, keine Trennung.
 *
 * Reihenfolge: erst Beiwerk entfernen, dann trennen. Der Adressblock in einem
 * Briefkopf endet selbst auf einem Strich.
 *
 * @param {Zeile[]} zeilen
 * @returns {{ zeilen: Zeile[], zusammengezogen: number }}
 */
export function zieheTrennungZusammen(zeilen) {
  /** @type {Zeile[]} */
  const aus = [];
  let zusammengezogen = 0;
  for (const zeile of zeilen) {
    const vor = aus[aus.length - 1];
    if (vor && !vor.gedreht && !zeile.gedreht && TRENNSTRICH.test(vor.text) && /^\p{Ll}/u.test(zeile.text)) {
      const darunter = vor.y - zeile.y > 0 && vor.y - zeile.y <= 2.5 * Math.max(vor.groesse, zeile.groesse);
      const ueberlappt = zeile.x0 < vor.x1 && zeile.x1 > vor.x0;
      if (darunter && ueberlappt && !BINDEWORT.has(zeile.text.split(' ')[0])) {
        aus[aus.length - 1] = {
          ...vor,
          text: vor.text.slice(0, -1) + zeile.text,
          groesse: Math.max(vor.groesse, zeile.groesse),
          x1: Math.max(vor.x1, zeile.x1),
        };
        zusammengezogen++;
        continue;
      }
    }
    aus.push(zeile);
  }
  return { zeilen: aus, zusammengezogen };
}

const ZAHL = /^[(\[]?[+\-–−±~≈<>]?(\d{1,3}([.’' ]\d{3})+|\d+)([.,]\d+)?[)\]]?(%|‰|€|T€|Mio\.?|Mrd\.?|m²|m³|h|d|Wo\.?)?[.,;:)]?$/u;
const DATUM = /^(\d{1,2}\.\d{1,2}\.(\d{2}|\d{4})?|\d{1,2}\/\d{2,4}|\d{4}-\d{2}(-\d{2})?|(KW|Q)\s?\d{1,2}([./]\d{2,4})?)[.,;:]?$/u;
const EINHEIT = /^(€|EUR|T€|TEUR|%|Mio\.?|Mrd\.?|€\/m²|m²|m³|Std\.?|h|Tage?|Wochen?|Monate?|-|–|—|\/|x|X|✓|✗)$/u;

/**
 * Eine Zeile, die nur aus Zahlen, Daten und Einheiten besteht — und mindestens
 * eine Zahl oder ein Datum enthaelt.
 *
 * Die zweite Bedingung ist noetig: Eine Zeile aus lauter Gedankenstrichen
 * besteht formal nur aus Einheiten und ist trotzdem keine Tabellenzeile.
 *
 * @param {string} text
 * @returns {boolean}
 */
export function istZahlenzeile(text) {
  const token = text.split(/\s+/).filter(Boolean);
  if (!token.length) return false;
  return (
    token.every((t) => ZAHL.test(t) || DATUM.test(t) || EINHEIT.test(t)) &&
    token.some((t) => ZAHL.test(t) || DATUM.test(t))
  );
}

/**
 * Das Beiwerk einer Datei: Zeilen, die auf mindestens 80 % ihrer Seiten
 * wiederkehren, an fester Stelle im oberen oder unteren Randstreifen.
 *
 * Zurueck kommt der Vergleichsschluessel und die Lage, an der die Zeile steht
 * (als Anteil der Seitenhoehe). Die Lage wird beim Entfernen noch einmal
 * gebraucht: Dieselbe Zeile mitten auf einer Folie ist Inhalt, kein Beiwerk.
 *
 * @param {readonly RohSeite[]} seiten
 * @returns {Map<string, number[]>}
 */
export function findeBeiwerk(seiten) {
  /** @type {Map<string, number[]>} */
  const beiwerk = new Map();
  const anzahl = seiten.length;
  if (anzahl < BEIWERK_MINDEST_SEITEN) return beiwerk;

  /** @type {Map<string, { seite: number, lage: number }[]>} */
  const vorkommen = new Map();
  for (const seite of seiten) {
    for (const zeile of seite.zeilen) {
      const k = schluessel(zeile.text);
      const liste = vorkommen.get(k) ?? [];
      liste.push({ seite: seite.nummer, lage: zeile.y / seite.hoehe });
      vorkommen.set(k, liste);
    }
  }
  for (const [k, liste] of vorkommen) {
    const lagen = liste.map((e) => e.lage).sort((a, b) => a - b);
    const mitte = lagen[Math.floor(lagen.length / 2)];
    if (mitte > BEIWERK_RANDSTREIFEN && mitte < 1 - BEIWERK_RANDSTREIFEN) continue;
    const seitenMitZeile = new Set(
      liste.filter((e) => Math.abs(e.lage - mitte) <= BEIWERK_LAGE_TOLERANZ).map((e) => e.seite),
    );
    if (seitenMitZeile.size / anzahl >= BEIWERK_ANTEIL) beiwerk.set(k, [mitte]);
  }
  return beiwerk;
}

/**
 * Bild-Beiwerk: dieselbe Platzierung auf mindestens 80 % der Seiten — das Logo
 * im Briefkopf. Ohne diese Unterscheidung heisst „die Seite traegt ein Bild"
 * gar nichts: Am echten Material trug jede der 199 Seiten das Logo.
 *
 * @param {readonly RohSeite[]} seiten
 * @returns {Set<string>}
 */
export function findeBildBeiwerk(seiten) {
  const anzahl = seiten.length;
  /** @type {Set<string>} */
  const treffer = new Set();
  if (anzahl < BEIWERK_MINDEST_SEITEN) return treffer;
  /** @type {Map<string, number>} */
  const vorkommen = new Map();
  for (const seite of seiten) {
    for (const k of new Set(seite.bilder)) vorkommen.set(k, (vorkommen.get(k) ?? 0) + 1);
  }
  for (const [k, n] of vorkommen) if (n / anzahl >= BEIWERK_ANTEIL) treffer.add(k);
  return treffer;
}

/**
 * Eine Rohdatei bereinigen: Beiwerk entfernen, Trennungen zusammenziehen,
 * Bildseiten und Tabellenverdacht markieren, Median und Abbruch rechnen.
 *
 * `beiwerk` und `bildBeiwerk` kommen von aussen, weil eine kleine Datei das
 * Beiwerk der uebrigen Dateien derselben Quelle uebernimmt.
 *
 * @param {RohDatei} roh
 * @param {{ beiwerk: Map<string, number[]>, bildBeiwerk: Set<string>, herkunft: 'datei' | 'quelle' | 'keins' }} vorgabe
 * @returns {Datei}
 */
export function bereinige(roh, vorgabe) {
  const anzahl = roh.seiten.length;
  const { beiwerk, bildBeiwerk } = vorgabe;
  /** @type {(zeile: Zeile, seite: RohSeite) => boolean} */
  const istBeiwerk = (zeile, seite) => {
    const lagen = beiwerk.get(schluessel(zeile.text));
    return lagen !== undefined && lagen.some((l) => Math.abs(zeile.y / seite.hoehe - l) <= BEIWERK_LAGE_TOLERANZ);
  };

  let gesamtZeichen = 0;
  let beiwerkZeichen = 0;
  let trennungen = 0;

  const seiten = roh.seiten.map((roheSeite) => {
    /** @type {Zeile[]} */
    const nutzzeilen = [];
    let entfernt = 0;
    for (const zeile of roheSeite.zeilen) {
      const n = zeichen(zeile.text);
      gesamtZeichen += n;
      if (istBeiwerk(zeile, roheSeite)) entfernt += n;
      else nutzzeilen.push(zeile);
    }
    beiwerkZeichen += entfernt;

    const gezogen = zieheTrennungZusammen(nutzzeilen);
    trennungen += gezogen.zusammengezogen;
    const zeilen = gezogen.zeilen;
    const nutzZeichen = zeilen.reduce((n, z) => n + zeichen(z.text), 0);
    const echteBilder = roheSeite.bilder.filter((k) => !bildBeiwerk.has(k)).length;
    // Bild mit Bildunterschrift zaehlt auch: Am echten Material war die einzige
    // Nutzzeile einer Bildfolie eine Unterschrift mit genau 20 Zeichen — die
    // blosse Schwelle verfehlte sie um ein Zeichen.
    const nurBild =
      echteBilder >= 1 &&
      (nutzZeichen < NUR_BILD_ZEICHEN || (zeilen.length === 1 && zeichen(zeilen[0].text) < NUR_BILD_EINE_ZEILE));
    const gitter = roheSeite.gitter.hLinien >= TABELLE_LINIEN && roheSeite.gitter.vLinien >= TABELLE_LINIEN;
    const zahlenzeilen = zeilen.filter((z) => istZahlenzeile(z.text)).length;
    return {
      ...roheSeite,
      quer: roheSeite.breite > roheSeite.hoehe,
      zeilen,
      zeichen: nutzZeichen,
      beiwerkZeichen: entfernt,
      echteBilder,
      nurBild,
      tabellenverdacht: gitter || zahlenzeilen >= TABELLE_ZAHLZEILEN,
    };
  });

  const sortiert = seiten.map((s) => s.zeichen).sort((a, b) => a - b);
  const median =
    anzahl === 0 ? 0 : anzahl % 2 ? sortiert[(anzahl - 1) / 2] : (sortiert[anzahl / 2 - 1] + sortiert[anzahl / 2]) / 2;
  const leere = seiten.filter((s) => s.zeichen < KEINE_TEXTEBENE_ZEICHEN).length;

  return {
    datei: roh.datei,
    seitenzahl: anzahl,
    quer: seiten.filter((s) => s.quer).length,
    median,
    // Wenig Text ist ausdruecklich kein Abbruchgrund. „Scan" heisst: keine
    // Textebene — fast jede Seite leer.
    abbruch:
      anzahl > 0 && leere / anzahl > KEINE_TEXTEBENE_ANTEIL
        ? `${roh.datei}: kein Textinhalt — das Material ist gescannt; OCR ist nicht Teil des Ingests`
        : null,
    beiwerk: [...beiwerk.keys()].filter((k) => roh.seiten.some((s) => s.zeilen.some((z) => schluessel(z.text) === k))),
    beiwerkHerkunft: vorgabe.herkunft,
    beiwerkZeichen,
    gesamtZeichen,
    beiwerkAnteil: gesamtZeichen ? beiwerkZeichen / gesamtZeichen : 0,
    trennungen,
    nurBild: seiten.filter((s) => s.nurBild).map((s) => s.nummer),
    tabellenverdacht: seiten.filter((s) => s.tabellenverdacht).map((s) => s.nummer),
    seiten,
  };
}

/**
 * Alle Dateien einer Quelle bereinigen.
 *
 * Dateien unter fuenf Seiten uebernehmen das Beiwerk der groesseren Dateien
 * derselben Quelle. Gibt es keine groessere, bleiben sie ohne Beiwerk —
 * `beiwerkHerkunft` sagt, welcher Fall vorlag.
 *
 * @param {readonly RohDatei[]} dateien
 * @returns {Datei[]}
 */
export function bereinigeQuelle(dateien) {
  const eigenes = dateien.map((d) => findeBeiwerk(d.seiten));
  const eigenesBild = dateien.map((d) => findeBildBeiwerk(d.seiten));
  /** @type {Map<string, number[]>} */
  const gelernt = new Map();
  /** @type {Set<string>} */
  const gelerntBild = new Set();
  dateien.forEach((d, i) => {
    if (d.seiten.length < BEIWERK_MINDEST_SEITEN) return;
    for (const [k, lagen] of eigenes[i]) gelernt.set(k, [...(gelernt.get(k) ?? []), ...lagen]);
    for (const k of eigenesBild[i]) gelerntBild.add(k);
  });

  return dateien.map((d, i) => {
    if (d.seiten.length >= BEIWERK_MINDEST_SEITEN) {
      return bereinige(d, { beiwerk: eigenes[i], bildBeiwerk: eigenesBild[i], herkunft: 'datei' });
    }
    const herkunft = gelernt.size > 0 || gelerntBild.size > 0 ? 'quelle' : 'keins';
    return bereinige(d, { beiwerk: gelernt, bildBeiwerk: gelerntBild, herkunft });
  });
}

/**
 * Die Art einer Quelle — nicht einer Datei.
 *
 * Je Datei entschieden wackelt es: Am echten Material lag eine Datei mit
 * Median 599,5 einen halben Punkt unter der Schwelle, eine andere bei 576.
 * Ueber alle Seiten der Quelle war der Median 242 — eindeutig Folien. Eine
 * Quelle hat eine Art, nicht neun.
 *
 * @param {readonly Datei[]} dateien
 * @returns {{ art: 'folien' | 'buch', median: number, quer: number, seiten: number }}
 */
export function artDerQuelle(dateien) {
  const alle = dateien.flatMap((d) => d.seiten);
  const sortiert = alle.map((s) => s.zeichen).sort((a, b) => a - b);
  const anzahl = sortiert.length;
  const median =
    anzahl === 0 ? 0 : anzahl % 2 ? sortiert[(anzahl - 1) / 2] : (sortiert[anzahl / 2 - 1] + sortiert[anzahl / 2]) / 2;
  const quer = alle.filter((s) => s.quer).length;
  return { art: quer > anzahl / 2 && median < FOLIEN_MEDIAN ? 'folien' : 'buch', median, quer, seiten: anzahl };
}

/**
 * Der Nutztext einer Seite fuer die Rohdatei — mit Seitenmarke davor, damit
 * jede spaetere Behauptung auf eine Folie zeigen kann und nicht nur auf einen
 * Satz von fuenfunddreissig.
 *
 * @param {Seite} seite
 * @param {string} [marke]
 * @returns {string}
 */
export function seitenText(seite, marke = 'Folie') {
  return [`— ${marke} ${seite.nummer} —`, ...seite.zeilen.map((z) => z.text)].join('\n');
}
