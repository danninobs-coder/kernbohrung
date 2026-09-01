import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';
import { beurteile } from '../auswahl.mjs';

/**
 * Holt einen Unterpfad eines Git-Repos, ohne das ganze Repo zu holen.
 *
 * Gemessen an awesome-llm-apps: 4,8 Sekunden und 3,2 MB statt 220 MB.
 * `--filter=blob:none` laedt Dateiinhalte erst bei Bedarf, `--sparse` plus
 * `sparse-checkout` beschraenkt den Arbeitsbaum auf den Unterpfad, `--depth 1`
 * spart die Historie. Fuer den Herkunftsnachweis genuegt der HEAD-SHA.
 *
 * Die Typen stehen als JSDoc da, weil `astro check` `werkzeug/` mitprueft und
 * weil sie zugleich der Vertrag sind, den jeder Adapter erfuellt: Ein Adapter
 * liefert `{ herkunft, urteile, lies }` — woher er das nimmt, geht den Ingest
 * nichts an.
 *
 * @typedef {import('../auswahl.mjs').Urteil} Urteil
 * @typedef {import('../auswahl.mjs').Auslassen} Auslassen
 * @typedef {{ art: 'git', url: string, unterpfad: string, sha: string }} Herkunft
 * @typedef {{ herkunft: Herkunft, urteile: Urteil[], lies: (rel: string) => string }} Quelle
 */

/**
 * Windows bricht bei rund 260 Zeichen ab. Wir schoepfen die Grenze nicht aus,
 * sondern lassen Platz fuer die laengsten Pfade *im* Repo — bei rag_tutorials
 * sind das 83 Zeichen.
 */
export const PFADSCHRANKE = 250;
const PLATZ_FUER_REPO_PFADE = 120;

/**
 * Meldet einen zu langen Zielpfad, bevor irgendetwas angelegt wird.
 *
 * Kein vorsorglicher Luxus: Ein erster Klonversuch in ein tief verschachteltes
 * Sitzungsverzeichnis scheiterte mit `fatal: could not create work tree dir:
 * Filename too long` — einer Meldung, die auf das Repo zeigt statt auf den
 * eigentlichen Grund. Die Pruefung steht deshalb vor `rmSync`/`mkdirSync`:
 * Ein Aufruf, der nicht laufen kann, soll auch nichts hinterlassen.
 *
 * @param {string} ziel
 * @returns {void}
 */
export function pruefeZielpfad(ziel) {
  const platzBedarf = ziel.length + 1 + PLATZ_FUER_REPO_PFADE;
  if (platzBedarf > PFADSCHRANKE) {
    throw new Error(
      `Zielpfad zu lang (${ziel.length} Zeichen). Zusammen mit Pfaden im Repo ` +
        `(bis zu ${PLATZ_FUER_REPO_PFADE} Zeichen) sprengt das die Windows-Grenze ` +
        `von ${PFADSCHRANKE}; git meldet dann nur "Filename too long". ` +
        `Leg die Quellen naeher an die Laufwerkswurzel.`,
    );
  }
}

/**
 * @param {{ url: string, unterpfad?: string, ziel: string, protokoll?: (zeile: string) => void }} auftrag
 * @returns {Promise<Quelle>}
 */
export async function hole({ url, unterpfad = '', ziel, protokoll = () => {} }) {
  pruefeZielpfad(ziel);

  if (existsSync(ziel)) rmSync(ziel, { recursive: true, force: true });
  mkdirSync(path.dirname(ziel), { recursive: true });

  protokoll(`klone ${url} (sparse, ohne Blobs, ohne Historie)`);
  git(['clone', '--filter=blob:none', '--sparse', '--depth', '1', url, ziel]);

  if (unterpfad) {
    git(['sparse-checkout', 'set', unterpfad], ziel);
  } else {
    // Ohne Unterpfad waere `sparse-checkout set ''` ein Fehler, und der
    // Sparse-Klon haette nur die Wurzeldateien. Dann eben ganz.
    git(['sparse-checkout', 'disable'], ziel);
  }

  const sha = git(['rev-parse', 'HEAD'], ziel).trim();
  protokoll(`Stand ${sha}`);

  const dateien = listeDateien(ziel, unterpfad);
  if (dateien.length === 0) {
    throw new Error(
      `Unter "${unterpfad}" liegt in ${url} keine einzige Datei. ` +
        `Tippfehler im Unterpfad? Der Klon liegt zur Ansicht in ${ziel}.`,
    );
  }
  protokoll(`${dateien.length} Dateien im Index unter ${unterpfad || '(Wurzel)'}`);

  /** @type {Urteil[]} */
  const urteile = dateien.map((rel) => {
    const voll = path.join(ziel, rel);
    let bytes;
    try {
      bytes = statSync(voll).size;
    } catch {
      // `ls-files` liest den Index, nicht den Arbeitsbaum. Nach einem
      // sparse-checkout kann der Index Dateien fuehren, die gar nicht auf
      // Platte liegen (skip-worktree). Wer die einfach mit Groesse 0
      // durchwinkt, baut ein Manifest, das sie als uebernommen fuehrt — und
      // ein `lies()`, das spaeter abstuerzt. Also: benannte Auslassung.
      return auslassen(rel, 'im Arbeitsbaum nicht vorhanden — sparse-checkout hat sie ausgespart');
    }
    return beurteile(rel, bytes);
  });

  return {
    herkunft: { art: 'git', url, unterpfad, sha },
    urteile,
    lies: (rel) => readFileSync(path.join(ziel, rel), 'utf8'),
  };
}

/**
 * Liest die Dateiliste aus dem Index.
 *
 * Das Format von `git ls-files -s` ist nachgemessen, nicht angenommen:
 * `<modus> <hash> <stufe>\t<pfad>`, auch im Blobless-Klon. Mit `-z` haengt
 * git die Eintraege mit NUL aneinander und laesst das C-Quoting weg, das
 * sonst bei Sonderzeichen im Pfad zuschlaegt. Der Pfad ist alles hinter dem
 * ersten Tabulator — die drei Felder davor enthalten selbst keinen.
 *
 * @param {string} ziel
 * @param {string} unterpfad
 * @returns {string[]}
 */
function listeDateien(ziel, unterpfad) {
  const roh = git(['ls-files', '-s', '-z', ...(unterpfad ? ['--', unterpfad] : [])], ziel);
  return roh
    .split('\0')
    .filter(Boolean)
    .map((eintrag) => eintrag.slice(eintrag.indexOf('\t') + 1))
    .filter(Boolean);
}

/**
 * @param {string} pfad
 * @param {string} grund
 * @returns {Auslassen}
 */
function auslassen(pfad, grund) {
  return { pfad, mitnehmen: false, grund };
}

/**
 * @param {string[]} args
 * @param {string} [cwd]
 * @returns {string}
 */
function git(args, cwd) {
  // `core.autocrlf` steht auf Windows meist auf `true`. Dann bekaeme das
  // Rohmaterial Zeilenenden, die in der Quelle nicht stehen: Die Byte-Zahlen
  // im Manifest waeren falsch, und derselbe Klon saehe auf zwei Rechnern
  // verschieden aus. Der Klon ist Lesematerial, kein Arbeitsbaum — er bleibt
  // bei den Zeilenenden der Quelle.
  const treu = ['-c', 'core.autocrlf=false', '-c', 'core.eol=lf'];
  try {
    return execFileSync('git', [...treu, ...args], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 32 * 1024 * 1024,
    });
  } catch (fehler) {
    const stderr = /** @type {{ stderr?: unknown }} */ (fehler)?.stderr;
    const meldung = typeof stderr === 'string' && stderr.trim() ? stderr.trim() : String(fehler);
    throw new Error(`git ${args.join(' ')} fehlgeschlagen:\n${meldung}`);
  }
}
