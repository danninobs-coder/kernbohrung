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
  const waagrecht = new Set();
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
