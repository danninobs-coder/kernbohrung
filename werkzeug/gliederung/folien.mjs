/**
 * Seiten eines Foliensatzes -> Abschnitte. Rein: keine Datei, kein pdf.js.
 *
 * Eingabe ist, was `adapter/dokument.mjs` je Datei liefert — bereinigte Seiten
 * mit ihren Nutzzeilen. Die Einheit ist der Foliensatz: **eine Datei ist
 * mindestens ein Abschnitt**, nie weniger.
 *
 * Die Reihenfolge der Wege steht fest: bis 20 Folien bleibt der Satz ein
 * Abschnitt; darueber entscheidet die Agendafolie, sonst die Titellaeufe,
 * sonst wird gleichmaessig geteilt.
 *
 * Der Gliederer nimmt von einer Seite nur, was er braucht: ihre Nummer und
 * ihre Nutzzeilen. Eine `Seite` aus `dokument.mjs` passt darauf, eine von Hand
 * gebaute Folie auch — und die Tests brauchen kein PDF.
 *
 * @typedef {{ text: string, groesse: number, y: number, x0: number, x1: number, gedreht?: boolean }} Zeile
 * @typedef {{ nummer: number, zeilen: readonly Zeile[] }} Folie
 * @typedef {{ id: string, titel: string, datei: string, seiten: [number, number] }} Abschnitt
 * @typedef {'einzeln' | 'agenda' | 'titellaeufe' | 'gleichmaessig'} Weg
 */

/** Bis hierher bleibt ein Satz ein einziger Abschnitt. */
const EINZELN_BIS = 20;

/** Die Agendafolie steht unter den ersten fuenf. */
const AGENDA_UNTER = 5;

/** Ab so vielen wiedergefundenen Agendazeilen gilt die Folie als Agenda. */
const AGENDA_MINDEST_TREFFER = 2;

/** ... und mindestens dieser Anteil der Agendazeilen muss wiederkehren. */
const AGENDA_MINDEST_ANTEIL = 0.5;

/** Ein Praefixtreffer zaehlt erst ab dieser Laenge — sonst passt „Die" auf alles. */
const MINDEST_PRAEFIX = 8;

/** Ein Titellauf sind mindestens so viele aufeinanderfolgende Folien. */
const LAUF_MINDEST = 2;

/** Gleichmaessig geteilt wird in Abschnitte bis zu dieser Groesse. */
const GLEICHMAESSIG_HOECHSTENS = 15;

/** Mehr Folien als das vor der ersten Grenze bilden einen eigenen Abschnitt. */
const VORLAUF_EIGEN_AB = 3;

/** Ein Folientitel sind hoechstens so viele Zeilen. */
const TITEL_ZEILEN = 3;

/** Woerter, die einen Slug nicht beenden sollen, und die bei der Agenda nicht zaehlen. */
const FUELLWORT = new Set([
  'und', 'oder', 'der', 'die', 'das', 'des', 'den', 'dem', 'ein', 'eine', 'einer', 'eines',
  'im', 'in', 'an', 'am', 'auf', 'zu', 'zum', 'zur', 'von', 'vom', 'mit', 'bei', 'für', 'fuer',
  'als', 'wie', 'was', 'wir', 'uns', 'sich', 'ist', 'sind', 'nicht', 'the', 'of', 'and',
]);

/**
 * Ein grober deutscher Wortstamm: haeufige Endungen ab, die laengste zuerst.
 *
 * Er muss nicht linguistisch stimmen, er muss „Begriffsbestimmungen" und
 * „Begriffsbestimmung" gleich machen. Am echten Material entschied genau das
 * ueber eine erkannte Agenda (Treffer 2/4 ohne, 3/4 mit).
 *
 * @param {string} wort
 * @returns {string}
 */
const stamm = (wort) => wort.replace(/(ungen|ern|en|er|es|e|n|s)$/u, '');

/**
 * Titel vergleichbar machen: klein, ohne Aufzaehlungszeichen, ohne
 * Nummerierung, ohne Anfuehrungszeichen, ohne Satzzeichen am Ende.
 *
 * @param {string} text
 * @returns {string}
 */
const normal = (text) =>
  text
    .normalize('NFC')
    .toLowerCase()
    .replace(/^[\s•▪►✓\-–—*·]+/u, '')
    .replace(/^(\d+(\.\d+)*\.?|[a-z]\)|[ivx]+\.)\s+/u, '')
    .replace(/[„“"'»«‚‘’]/gu, '')
    .replace(/\s+/g, ' ')
    .replace(/[\s:.?!…,;–-]+$/u, '')
    .trim();

/** @type {(text: string) => string} Jedes laengere Wort auf seinen Stamm — der Vergleich fuer Agenda und Folientitel. */
const gestemmt = (text) =>
  normal(text)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .map((wort) => (wort.length > 4 ? stamm(wort) : wort))
    .join(' ');

// ---------------------------------------------------------------------------
// Ids

/** @type {Record<string, string>} */
const UMLAUT = { 'ä': 'ae', 'ö': 'oe', 'ü': 'ue', 'ß': 'ss', 'Ä': 'ae', 'Ö': 'oe', 'Ü': 'ue' };

/**
 * Aus einem Titel ein Stueck Id machen: Kleinbuchstaben, Ziffern, Bindestrich.
 *
 * Umlaute werden ausgeschrieben, nicht weggelassen: `massnahmen` statt
 * `manahmen`. Hoechstens vier Woerter und 32 Zeichen, und kein Fuellwort am
 * Ende — `massnahmen-der` liest sich wie ein abgebrochener Satz.
 *
 * @param {string} text
 * @param {number} [hoechstensWoerter]
 * @param {number} [hoechstensZeichen]
 * @returns {string}
 */
export function slug(text, hoechstensWoerter = 4, hoechstensZeichen = 32) {
  const roh = text
    .normalize('NFC')
    .replace(/[äöüßÄÖÜ]/g, (c) => UMLAUT[c])
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const teile = roh.split('-').filter(Boolean).slice(0, hoechstensWoerter);
  /** @type {string[]} */
  const gewaehlt = [];
  for (const teil of teile) {
    if ([...gewaehlt, teil].join('-').length > hoechstensZeichen) break;
    gewaehlt.push(teil);
  }
  while (gewaehlt.length > 1 && FUELLWORT.has(gewaehlt[gewaehlt.length - 1])) gewaehlt.pop();
  return gewaehlt.join('-') || teile[0]?.slice(0, hoechstensZeichen) || '';
}

/**
 * Das Kuerzel je Datei einer Quelle.
 *
 * „M7 Risikomanagement 26.pdf" wird zu `m07`: die Buchstaben vor der ersten
 * Zahl und die Zahl, zweistellig. Zweistellig, weil `m10` sonst vor `m2`
 * sortierte — und die Abschnitt-Ids sollen in Lesereihenfolge sortieren.
 *
 * Passt ein Name nicht auf das Muster oder kollidieren zwei Kuerzel, bekommen
 * **alle** Dateien `d01`, `d02`, … in der uebergebenen Reihenfolge. Nicht nur
 * die eine: Eine Quelle mit gemischten Kuerzeln waere schwerer zu lesen als
 * eine mit durchnummerierten.
 *
 * @param {readonly string[]} dateien in natuerlicher Reihenfolge
 * @returns {Map<string, string>}
 */
export function dateikuerzel(dateien) {
  /** @type {Map<string, string>} */
  const aus = new Map();
  for (const datei of dateien) {
    const treffer = datei.normalize('NFC').match(/^\s*([A-Za-z]{1,3})\s*0*(\d{1,3})(?!\d)/);
    if (!treffer) return nachNummer(dateien);
    aus.set(datei, `${treffer[1].toLowerCase()}${treffer[2].padStart(2, '0')}`);
  }
  if (new Set(aus.values()).size !== dateien.length) return nachNummer(dateien);
  return aus;
}

/** @type {(dateien: readonly string[]) => Map<string, string>} */
const nachNummer = (dateien) => new Map(dateien.map((d, i) => [d, `d${String(i + 1).padStart(2, '0')}`]));

// ---------------------------------------------------------------------------
// Titel

/**
 * Der Titel einer Folie: die oberste Nutzzeile und die direkt darunter
 * folgenden Zeilen gleicher Schriftgroesse, hoechstens drei.
 *
 * Zweizeilige Titel kommen auf Trennfolien vor. Gedrehte Zeilen zaehlen nicht
 * — sie haben keine Lage in der Leseordnung.
 *
 * @param {Folie} seite
 * @returns {{ text: string, groesse: number, zeilen: number } | null}
 */
export function folientitel(seite) {
  const zeilen = seite.zeilen.filter((z) => !z.gedreht);
  if (!zeilen.length) return null;
  const block = [zeilen[0]];
  for (let i = 1; i < zeilen.length && block.length < TITEL_ZEILEN; i++) {
    const vor = block[block.length - 1];
    const gleicheGroesse = Math.abs(zeilen[i].groesse - vor.groesse) <= 0.5;
    const darunter = vor.y - zeilen[i].y > 0 && vor.y - zeilen[i].y <= 1.6 * vor.groesse;
    const ueberlappt = zeilen[i].x0 < vor.x1 && zeilen[i].x1 > vor.x0;
    if (!gleicheGroesse || !darunter || !ueberlappt) break;
    block.push(zeilen[i]);
  }
  return {
    text: block.map((z) => z.text).join(' ').replace(/\s+/g, ' ').trim(),
    groesse: block[0].groesse,
    zeilen: block.length,
  };
}

/**
 * Passt eine Agendazeile zu einem Folientitel? Gleich oder Praefix, beides auf
 * groben Wortstaemmen.
 *
 * @param {string} agendaZeile
 * @param {string} titel
 * @returns {boolean}
 */
function passt(agendaZeile, titel) {
  const a = gestemmt(agendaZeile);
  const t = gestemmt(titel);
  if (!a || !t) return false;
  if (a === t) return true;
  const [kurz, lang] = a.length <= t.length ? [a, t] : [t, a];
  return kurz.length >= MINDEST_PRAEFIX && lang.startsWith(kurz);
}

// ---------------------------------------------------------------------------
// Die drei Wege

/**
 * Die Agendafolie: eine der ersten fuenf Folien, deren Zeilen spaeter der
 * Reihe nach als Folientitel wiederkehren.
 *
 * Der eigene Titel der Agendafolie zaehlt nicht mit — „AGENDA" kehrt nirgends
 * wieder und wuerde den Anteil druecken.
 *
 * @param {readonly Folie[]} seiten
 * @returns {{ seite: number, kandidaten: number, treffer: { zeile: string, seite: number }[] } | null}
 */
export function findeAgenda(seiten) {
  const titel = seiten.map((s) => folientitel(s));
  /** @type {{ seite: number, kandidaten: number, treffer: { zeile: string, seite: number }[] } | null} */
  let bester = null;
  for (let i = 0; i < Math.min(AGENDA_UNTER, seiten.length); i++) {
    const eigen = titel[i];
    const kandidaten = seiten[i].zeilen
      .filter((z) => !z.gedreht)
      .map((z) => z.text)
      .filter((t) => !eigen || (t !== eigen.text && !eigen.text.startsWith(t)))
      .filter((t) => normal(t).length >= 3);
    if (kandidaten.length < AGENDA_MINDEST_TREFFER) continue;

    // Jede Agendazeile sucht die erste spaetere Folie, deren Titel passt —
    // aufsteigend, damit die Reihenfolge der Agenda die Reihenfolge der
    // Abschnitte ist und nicht umgekehrt.
    /** @type {{ zeile: string, seite: number }[]} */
    const treffer = [];
    let ab = i + 1;
    for (const kandidat of kandidaten) {
      for (let j = ab; j < seiten.length; j++) {
        const spaeter = titel[j];
        if (spaeter && passt(kandidat, spaeter.text)) {
          treffer.push({ zeile: kandidat, seite: seiten[j].nummer });
          ab = j + 1;
          break;
        }
      }
    }
    if (treffer.length < AGENDA_MINDEST_TREFFER) continue;
    if (treffer.length / kandidaten.length < AGENDA_MINDEST_ANTEIL) continue;
    if (!bester || treffer.length > bester.treffer.length) {
      bester = { seite: seiten[i].nummer, kandidaten: kandidaten.length, treffer };
    }
  }
  return bester;
}

/**
 * Titellaeufe: aufeinanderfolgende Folien mit demselben Folientitel.
 *
 * **Nur der Folientitel**, nicht irgendeine wiederkehrende Zeile. Wörtlich
 * genommen macht die Regel des Specs Rumpfzeilen zu Abschnittstiteln: Am
 * echten Material wurde einmal eine Aufzaehlungszeile zum Titel eines
 * Abschnitts ueber vierzehn Folien und einmal das blosse Wort „oder".
 *
 * @param {readonly Folie[]} seiten
 * @returns {{ titel: string, von: number, bis: number }[]}
 */
export function findeTitellaeufe(seiten) {
  const titel = seiten.map((s) => folientitel(s)?.text ?? null);
  const schluessel = seiten.map((_, i) => {
    const t = titel[i];
    return t && (titel[i - 1] === t || titel[i + 1] === t) ? t : null;
  });
  /** @type {{ schluessel: string, von: number, bis: number }[]} */
  const laeufe = [];
  for (let i = 0; i < seiten.length; i++) {
    const k = schluessel[i];
    if (!k) continue;
    const letzter = laeufe[laeufe.length - 1];
    if (letzter && letzter.schluessel === k && letzter.bis === i - 1) letzter.bis = i;
    else laeufe.push({ schluessel: k, von: i, bis: i });
  }
  return laeufe
    .filter((l) => l.bis - l.von + 1 >= LAUF_MINDEST)
    .map((l) => ({ titel: l.schluessel, von: seiten[l.von].nummer, bis: seiten[l.bis].nummer }));
}

/**
 * Grenzen mit Titeln zu luecklosen Bereichen ueber alle Folien 1..N machen.
 *
 * Die Folien vor der ersten Grenze — Titelfolie, Agendafolie — gehoeren zum
 * ersten Abschnitt. Sind es mehr als drei, bilden sie einen eigenen Abschnitt
 * mit Rueckfalltitel: Am echten Material begann der erste Titellauf einmal
 * erst auf Folie 20, und die neunzehn davor waeren im Abschnitt „ab Folie 20"
 * verschwunden.
 *
 * @param {{ von: number, titel: string | null }[]} grenzen
 * @param {number} N
 * @returns {[number, number, string | null][]}
 */
function ausGrenzen(grenzen, N) {
  const sortiert = [...grenzen].sort((a, b) => a.von - b.von);
  if (sortiert[0].von !== 1) {
    if (sortiert[0].von - 1 > VORLAUF_EIGEN_AB) sortiert.unshift({ von: 1, titel: null });
    else sortiert[0] = { ...sortiert[0], von: 1 };
  }
  return sortiert.map((g, i) => [g.von, (sortiert[i + 1]?.von ?? N + 1) - 1, g.titel]);
}

/**
 * Einen Foliensatz gliedern.
 *
 * @param {{ datei: string, seiten: readonly Folie[] }} dokument
 * @param {string} kuerzel aus `dateikuerzel()`
 * @returns {{ gliederung: Weg, abschnitte: Abschnitt[] }}
 */
export function gliedereFolien(dokument, kuerzel) {
  const N = dokument.seiten.length;
  const name = dokument.datei.replace(/\.pdf$/i, '').replace(/\s+/g, ' ').trim();

  /** @type {(weg: Weg, bereiche: [number, number, string | null][]) => { gliederung: Weg, abschnitte: Abschnitt[] }} */
  const mitIds = (weg, bereiche) => ({
    gliederung: weg,
    abschnitte: bereiche.map(([von, bis, titel], i) => ({
      // Zweistellig, damit Abschnitt 10 hinter Abschnitt 2 sortiert.
      id: `${kuerzel}-${String(i + 1).padStart(2, '0')}-${titel ? slug(titel) : `folien-${von}-${bis}`}`,
      titel: titel ?? `${name}, Folien ${von}–${bis}`,
      datei: dokument.datei,
      seiten: [von, bis],
    })),
  });

  if (N <= EINZELN_BIS) return mitIds('einzeln', [[1, N, null]]);

  const agenda = findeAgenda(dokument.seiten);
  if (agenda) {
    return mitIds(
      'agenda',
      ausGrenzen(
        agenda.treffer.map((t) => ({ von: t.seite, titel: t.zeile })),
        N,
      ),
    );
  }

  const laeufe = findeTitellaeufe(dokument.seiten);
  if (laeufe.length >= 2 || (laeufe.length === 1 && laeufe[0].von - 1 > VORLAUF_EIGEN_AB)) {
    return mitIds(
      'titellaeufe',
      ausGrenzen(
        laeufe.map((l) => ({ von: l.von, titel: l.titel })),
        N,
      ),
    );
  }

  // Gleichmaessig: so wenige Abschnitte wie moeglich, keiner ueber 15 Folien,
  // der Rest vorn verteilt.
  const anzahl = Math.ceil(N / GLEICHMAESSIG_HOECHSTENS);
  const grundgroesse = Math.floor(N / anzahl);
  const rest = N % anzahl;
  /** @type {[number, number, string | null][]} */
  const bereiche = [];
  let von = 1;
  for (let i = 0; i < anzahl; i++) {
    const groesse = grundgroesse + (i < rest ? 1 : 0);
    bereiche.push([von, von + groesse - 1, null]);
    von += groesse;
  }
  return mitIds('gleichmaessig', bereiche);
}
