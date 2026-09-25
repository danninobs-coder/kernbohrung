/**
 * Der Wortlaut-Abgleich (Spec „Urheberrecht"): Eine Lektion faellt durch, wenn
 * sie mehr als zwoelf Woerter am Stueck aus einer Rohdatei uebernimmt.
 * Fachbegriffe, kurze Wendungen und Begriffsketten gehen durch.
 *
 * Die Regel ist gemessen, nicht geschaetzt (docs/recherche/2026-09-24-
 * compiler-lehrmaterial-befund.md, Aufgabe 2): 13 aufeinanderfolgende gleiche
 * Woerter innerhalb einer Folie bzw. eines Lektionsfelds; Zahlen zaehlen nicht
 * und unterbrechen nicht; ein Treffer zaehlt nur, wenn die 13 Woerter
 * mindestens drei verschiedene Funktionswoerter enthalten — ein Satz, keine
 * Begriffskette. An den fuenf vorhandenen Lektionen gemessen: kein Treffer,
 * laengster gleicher Lauf drei Woerter.
 *
 * Schichten wie bei den anderen Werkzeugen: `woerter`, `rohFolien`,
 * `lektionFelder`, `baueIndex` und `findeAbschriften` sind reine Funktionen
 * ueber Texte, `liesRohIndex` liest unter einer Wurzel. Die Kommandozeile ist
 * `pruefe-lektion`.
 *
 * **Nie Text nach aussen.** Ein Treffer nennt Quelle, Abschnitt, Folie, Feld
 * und Wortbereich — nie die Woerter selbst. Das Material gehoert seinen
 * Verfassern.
 *
 * @typedef {{ w: string, zahl: boolean }} Wort
 * @typedef {{ nummer: number, text: string }} Folie
 * @typedef {{ feld: string, text: string }} Feld
 * @typedef {{ quelle: string, abschnitt: string, folie: number }} Fundort
 * @typedef {{ quelle: string, abschnitt: string, folien: readonly Folie[] }} RohQuelle
 * @typedef {Map<string, Fundort>} Index Fenster (13 Woerter, durch Leerzeichen verbunden) -> erste Fundstelle
 * @typedef {{ feld: string, von: number, bis: number, quelle: string, abschnitt: string, folie: number }} Abschrift
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
// Namentlich, nicht als Vorgabe-Import: js-yaml 5 liefert unter `import` ein
// ESM-Buendel ohne Default-Export. Siehe werkzeug/pruefe-lektion.mjs.
import { load as yamlLesen, YAMLException } from 'js-yaml';
import { NUR_BILD_ZEILE, WARNZEILE } from './adapter/folien.mjs';
// Ein Kreis mit Absicht: `pruefe-lektion.mjs` ruft den Abgleich auf, und der
// Abgleich zerlegt eine Lektion mit demselben Kopfmuster und demselben
// Widget-Leser wie die Schema-Pruefung — so sehen beide dieselben Felder.
// Keines der beiden Module ruft beim Laden etwas vom anderen auf, nur in
// Funktionen; in jeder Ladereihenfolge ist der Kreis geschlossen, bevor er
// gebraucht wird.
import { FRONTMATTER, widgetAufrufe } from './pruefe-lektion.mjs';

/** „Mehr als zwoelf Woerter": die Laenge eines Fensters. */
export const FENSTER = 13;

/** So viele verschiedene Funktionswoerter braucht ein Fenster, um als Satz zu zaehlen. */
export const MINDEST_FUNKTIONSWOERTER = 3;

/**
 * Funktionswoerter: Artikel, Praepositionen, Konjunktionen, Hilfs- und
 * Modalverben, Pronomen — was einen Satz von einer Begriffskette unterscheidet.
 *
 * Warum der Filter: Eine Vorlesung ist voller Ketten ohne Satzbau — Tabellen,
 * Titelblaetter, Aufzaehlungen oeffentlicher Begriffe. Gemessen (Befund,
 * Aufgabe 2): In der Vorlesung haben 49 % der 13-Wort-Fenster hoechstens zwei
 * verschiedene Funktionswoerter, in eigener Lektionsprosa nur 0,9 %. Ohne den
 * Filter fiele eine eigene Aufzaehlung der oeffentlichen AHO-Handlungsbereiche
 * durch (23 Woerter gleich); mit ihm trifft eine echte Abschrift weiterhin.
 *
 * In der Form, die `woerter` liefert: klein, ss statt Eszett. Ohne
 * Einzelbuchstaben, sonst zaehlten Aufzaehlungsbuchstaben (A bis E) als
 * Funktionswoerter. Die Liste ist deutsch wie die Lektionen und das gemessene
 * Material; ein englischer Satz traegt kaum eines davon, eine Abschrift aus
 * einer englischen Quelle faellt deshalb nicht auf.
 */
export const FUNKTIONSWOERTER = new Set(
  (
    'der die das den dem des ein eine einer eines einem einen und oder aber sondern denn nicht kein keine keinen keiner ' +
    'mit von vom zu zum zur im in ins am an auf aus bei beim für ist sind war waren wird werden wurde wurden hat haben ' +
    'hatte kann können muss müssen soll sollen darf dürfen sich es sie er wir ihr ich du man als auch so wie ' +
    'dass nach über unter vor durch um bis ohne gegen wenn ob weil da damit dann doch noch nur schon sehr mehr alle ' +
    'alles jede jeder jedes diese dieser dieses dies welche welcher welches was wer wo hier dort sein seine seiner ihre ihren ' +
    'ihrem ihres deren dessen zwischen innerhalb sowie bzw etc sollte sollten'
  ).split(' '),
);

// ---------------------------------------------------------------------------
// Woerter
// ---------------------------------------------------------------------------

/** Was Woerter nicht trennen darf und wegfaellt: weicher Trennstrich, Nullbreiten, BOM. */
const UNSICHTBAR = /[\u00AD\u200B-\u200D\u2060\uFEFF]/g;

/** Bindestrich oder Apostroph zwischen zwei Wortzeichen: Ein Kompositum ist ein Wort. */
const BINDER = /([\p{L}\p{N}])[-\u2010\u2011'\u2019\u00B4]+(?=([\p{L}\p{N}]))/gu;

/** Tausender- und Dezimaltrenner zwischen Ziffern: 1.200.000 ist eine Zahl. */
const ZIFFERNTRENNER = /(\p{N})[.,](?=\p{N})/gu;

const WORT = /[\p{L}\p{N}]+/gu;
const ZAHL = /^\p{N}+$/u;
const ZIFFER = /^\p{N}$/u;

/**
 * Text -> Woerter. NFKC faltet Ligaturen, hochgestellte Ziffern und
 * Auslassungspunkte; dann klein und ss statt Eszett. Ein Bindestrich zwischen
 * zwei Wortzeichen verbindet (`Detail-Pauschalvertrag` ist ein Wort), ein
 * Ergaenzungsstrich nicht (`Bau- und Ausbau` sind drei); zwischen zwei Ziffern
 * trennt er (`1-2` sind zwei Zahlen). Alles ausser Buchstaben und Ziffern
 * trennt — auch Aufzaehlungszeichen aus Symbolschriften.
 *
 * @param {string} text
 * @returns {Wort[]}
 */
export function woerter(text) {
  let t = text.normalize('NFKC').replace(UNSICHTBAR, '').toLowerCase();
  t = t.replace(BINDER, (_, a, b) => (ZIFFER.test(a) && ZIFFER.test(b) ? `${a} ` : a));
  t = t.replace(ZIFFERNTRENNER, '$1');
  return (t.match(WORT) ?? []).map((w) => {
    const wort = w.replaceAll('ß', 'ss');
    return { w: wort, zahl: ZAHL.test(wort) };
  });
}

/**
 * Die Woerter, die in den Abgleich eingehen: Zahlen fallen vorher heraus. So
 * zaehlen sie nicht mit und unterbrechen nicht — eine Rechenaufgabe mit den
 * Zahlen eines Folienbeispiels trifft nicht, eine Abschrift mit geaenderten
 * Zahlen schon.
 *
 * @param {string} text
 * @returns {string[]}
 */
function abgleichWoerter(text) {
  return woerter(text)
    .filter((t) => !t.zahl)
    .map((t) => t.w);
}

// ---------------------------------------------------------------------------
// Rohdatei und Lektion zerlegen
// ---------------------------------------------------------------------------

/** Die Seitenmarke, wie `seitenText` in adapter/dokument.mjs sie schreibt. */
const MARKE = /^— (?:Folie|Seite) (\d+) —$/;

/**
 * Die Folien einer Rohdatei. Kopf (vor der ersten Marke), Seitenmarken, die
 * Warnzeile und der Bildhinweis des Einlesens zaehlen nicht mit — eine Zeile
 * faellt nur weg, wenn sie ganz gleich der Konstante ist. Die Zeilen einer
 * Folie bleiben verbunden: PDF-Zeilen sind Umbrueche, keine Satzgrenzen.
 *
 * Eine Rohdatei ohne Seitenmarken (aus einer Git-Quelle) ist eine Einheit mit
 * Folie 0.
 *
 * @param {string} text
 * @returns {Folie[]}
 */
export function rohFolien(text) {
  const zeilen = text.replace(/\r\n?/g, '\n').split('\n');
  if (!zeilen.some((zeile) => MARKE.test(zeile))) return [{ nummer: 0, text: zeilen.join('\n').trim() }];

  /** @type {{ nummer: number, zeilen: string[] }[]} */
  const folien = [];
  for (const zeile of zeilen) {
    const marke = MARKE.exec(zeile);
    if (marke) {
      folien.push({ nummer: Number(marke[1]), zeilen: [] });
    } else if (folien.length > 0 && zeile !== WARNZEILE && zeile !== NUR_BILD_ZEILE) {
      folien[folien.length - 1].zeilen.push(zeile);
    }
  }
  return folien.map((folie) => ({ nummer: folie.nummer, text: folie.zeilen.join('\n').trim() }));
}

/** Schluessel ohne sichtbaren Text: Art, Kennung, Adresse. */
const UNSICHTBARE_SCHLUESSEL = new Set(['typ', 'id', 'url']);

/** Dasselbe Muster wie in `widgetAufrufe`: ein Widget-Aufruf im Rumpf. */
const WIDGET_AUFRUF = /<([A-Z][A-Za-z0-9]*)\s([\s\S]*?)\/>/g;

/**
 * Alle sichtbaren Texte einer Lektion, je Feld einer. Ein Feld ist jeder
 * YAML-String im Kopf ausser `typ`, `id` und `url` (jedes Listenelement
 * einzeln, benannt mit seinem Pfad wie `aufgaben[0].aufgabe`), jeder String
 * aus den Parametern eines Widget-Aufrufs (`rumpf<Name>…`) und der Rumpf ohne
 * Widget-Aufrufe, Importe, Adressen und HTML. Der Rumpf ist ein Feld:
 * Absaetze sind keine harten Grenzen fuer eine Abschrift.
 *
 * Auch eine kaputte Lektion wird ganz gelesen, damit kein Text ungeprueft
 * bleibt: ohne Kopf zaehlt alles als Rumpf, ein Kopf, der kein YAML ist, als
 * Feld `frontmatter`, und ein Widget-Aufruf, der sich nicht auswerten laesst,
 * mit seinem Parametertext als Feld `rumpf<Name>`. Den Mangel selbst meldet
 * die Schema-Pruefung.
 *
 * @param {string} mdx
 * @returns {Feld[]}
 */
export function lektionFelder(mdx) {
  /** @type {Feld[]} */
  const felder = [];
  const teile = FRONTMATTER.exec(mdx);
  let rumpf = mdx;
  if (teile) {
    rumpf = teile[2];
    /** @type {unknown} */
    let kopf;
    let lesbar = true;
    try {
      kopf = yamlLesen(teile[1]);
    } catch (fehler) {
      if (!(fehler instanceof YAMLException)) throw fehler;
      lesbar = false;
    }
    if (lesbar) sammle(kopf, '', felder);
    else felder.push({ feld: 'frontmatter', text: teile[1] });
  }

  rumpf = rumpf.replace(WIDGET_AUFRUF, (aufruf, name, parameter) => {
    for (const gelesen of widgetAufrufe(aufruf)) {
      if (gelesen.ok) sammle(gelesen.props, `rumpf<${name}>`, felder);
      else felder.push({ feld: `rumpf<${name}>`, text: parameter });
    }
    return '\n\n';
  });
  rumpf = rumpf
    .replace(/^\s*(?:import|export)\s.*$/gm, '') // MDX-Importe
    .replace(/\]\([^)]*\)/g, ']') // Ziele von Verweisen
    .replace(/https?:\/\/\S+/g, ' ') // nackte Adressen
    .replace(/<\/?[a-zA-Z][^>]*>/g, ' '); // HTML und JSX
  felder.push({ feld: 'rumpf', text: rumpf });
  return felder;
}

/**
 * Sammelt die Strings eines gelesenen Werts als Felder, benannt mit ihrem Pfad.
 *
 * @param {unknown} wert
 * @param {string} pfad
 * @param {Feld[]} felder
 */
function sammle(wert, pfad, felder) {
  if (typeof wert === 'string') {
    felder.push({ feld: pfad || 'frontmatter', text: wert });
  } else if (Array.isArray(wert)) {
    wert.forEach((element, i) => sammle(element, `${pfad}[${i}]`, felder));
  } else if (wert !== null && typeof wert === 'object') {
    for (const [schluessel, element] of Object.entries(wert)) {
      if (UNSICHTBARE_SCHLUESSEL.has(schluessel)) continue;
      sammle(element, pfad ? `${pfad}.${schluessel}` : schluessel, felder);
    }
  }
}

// ---------------------------------------------------------------------------
// Index und Abgleich
// ---------------------------------------------------------------------------

/**
 * Alle Fenster aller Folien, je Fenster die erste Fundstelle. Ein Fenster
 * reicht nie ueber eine Folie hinaus.
 *
 * @param {readonly RohQuelle[]} quellen
 * @returns {Index}
 */
export function baueIndex(quellen) {
  /** @type {Index} */
  const index = new Map();
  for (const { quelle, abschnitt, folien } of quellen) {
    for (const { nummer, text } of folien) {
      const ort = { quelle, abschnitt, folie: nummer };
      const folge = abgleichWoerter(text);
      for (let start = 0; start + FENSTER <= folge.length; start++) {
        const fenster = folge.slice(start, start + FENSTER).join(' ');
        if (!index.has(fenster)) index.set(fenster, ort);
      }
    }
  }
  return index;
}

/**
 * @param {readonly string[]} fenster
 * @returns {number}
 */
function verschiedeneFunktionswoerter(fenster) {
  return new Set(fenster.filter((w) => FUNKTIONSWOERTER.has(w))).size;
}

/**
 * Die Abschriften in den Feldern einer Lektion: Fenster, die so in einer
 * Folie stehen und mindestens drei verschiedene Funktionswoerter tragen. Ein
 * Fenster reicht nie ueber ein Feld hinaus.
 *
 * `von` und `bis` zaehlen die Woerter im Feld ab 1, Zahlen nicht mitgezaehlt
 * — wie im Abgleich. Ueberlappende Fenster aus derselben Folie werden ein
 * Bereich: Wer einen Absatz abschreibt, bekommt eine Meldung, nicht eine je
 * Wort.
 *
 * @param {readonly Feld[]} felder
 * @param {Index} index
 * @returns {Abschrift[]}
 */
export function findeAbschriften(felder, index) {
  /** @type {Abschrift[]} */
  const abschriften = [];
  for (const { feld, text } of felder) {
    const folge = abgleichWoerter(text);
    /** @type {Abschrift | undefined} */
    let bereich;
    for (let start = 0; start + FENSTER <= folge.length; start++) {
      const fenster = folge.slice(start, start + FENSTER);
      if (verschiedeneFunktionswoerter(fenster) < MINDEST_FUNKTIONSWOERTER) continue;
      const ort = index.get(fenster.join(' '));
      if (ort === undefined) continue;
      const von = start + 1;
      const bis = start + FENSTER;
      if (
        bereich !== undefined &&
        von <= bereich.bis &&
        bereich.quelle === ort.quelle &&
        bereich.abschnitt === ort.abschnitt &&
        bereich.folie === ort.folie
      ) {
        bereich.bis = bis;
      } else {
        bereich = { feld, von, bis, ...ort };
        abschriften.push(bereich);
      }
    }
  }
  return abschriften;
}

// ---------------------------------------------------------------------------
// Rohdateien unter einer Wurzel
// ---------------------------------------------------------------------------

/**
 * @param {string} pfad
 * @returns {boolean}
 */
function istOrdner(pfad) {
  return existsSync(pfad) && statSync(pfad).isDirectory();
}

/**
 * Der Index ueber alle Rohdateien `quellen/<quelle>/roh/<abschnitt>.md` unter
 * `wurzel`, in fester Reihenfolge (Quelle, dann Datei, nach Codepunkten).
 * `null`, wenn es keine Rohdatei gibt — etwa in einem Klon von GitHub, wo
 * `quellen/` fehlt: Dann heisst es „nicht geprueft", nicht „in Ordnung".
 *
 * @param {string} wurzel
 * @returns {{ index: Index, dateien: number } | null}
 */
export function liesRohIndex(wurzel) {
  const ordner = path.join(wurzel, 'quellen');
  if (!istOrdner(ordner)) return null;

  /** @type {RohQuelle[]} */
  const quellen = [];
  const namen = readdirSync(ordner, { withFileTypes: true })
    .filter((eintrag) => eintrag.isDirectory())
    .map((eintrag) => eintrag.name)
    .sort();
  for (const quelle of namen) {
    const roh = path.join(ordner, quelle, 'roh');
    if (!istOrdner(roh)) continue;
    const dateien = readdirSync(roh, { withFileTypes: true })
      .filter((eintrag) => eintrag.isFile() && eintrag.name.endsWith('.md'))
      .map((eintrag) => eintrag.name)
      .sort();
    for (const datei of dateien) {
      const text = readFileSync(path.join(roh, datei), 'utf8');
      quellen.push({ quelle, abschnitt: datei.slice(0, -'.md'.length), folien: rohFolien(text) });
    }
  }
  return quellen.length === 0 ? null : { index: baueIndex(quellen), dateien: quellen.length };
}
