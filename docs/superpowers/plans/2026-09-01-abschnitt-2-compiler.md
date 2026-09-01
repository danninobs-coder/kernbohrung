# Kernbohrung — Abschnitt 2 „Compiler" — Implementierungsplan

> **Für agentische Ausführung:** ERFORDERLICHER SUB-SKILL: `superpowers:subagent-driven-development` (empfohlen) oder `superpowers:executing-plans`. Schritte nutzen Checkbox-Syntax (`- [ ]`).

**Ziel:** Aus `rag_tutorials` in `Shubhamsaboo/awesome-llm-apps` entstehen sechs Prinzipien und daraus sechs Lektionen — mit einem Review-Gate dazwischen, an dem ein Mensch den Lehrplan korrigiert, und einer Prüfung, die eine Lektion ablehnt, bevor sie geschrieben wird.

**Architektur:** Der Compiler ist zweigeteilt, und der Schnitt verläuft entlang der Frage, ob ein Schritt Urteilsvermögen braucht.

Alles Deterministische sind **Node-Skripte** unter `werkzeug/`: Quellen holen, auswählen, aufbereiten, Manifest schreiben, Lektionen prüfen. Sie sind testbar, wiederholbar und brauchen kein Sprachmodell. Sie importieren `src/content/schema.ts` und `src/widgets/pruefung.ts` — genau der Vertrag, den Abschnitt 1 dafür gebaut und mit einem Node-Unterprozess abgesichert hat.

Die zwei Durchgänge, die Urteilsvermögen brauchen — Prinzipien destillieren, Lektionen formulieren — sind ein **Claude-Code-Skill** unter `.claude/skills/`. Er ruft die Skripte auf, liest das Rohmaterial, legt den Lehrplan zur Korrektur vor und baut daraus Lektionen. Es gibt keinen API-Schlüssel, keine eigene Modell-Anbindung und kein zweites Werkzeug: Wer den Compiler laufen lässt, öffnet Claude Code im Projekt.

**Tech-Stack:** Node 24 · `js-yaml` (neue direkte Abhängigkeit, liegt bereits transitiv im Baum) · die vorhandenen Schemata aus Abschnitt 1. Keine neuen Laufzeitabhängigkeiten für die App.

**Nicht in diesem Abschnitt:** FSRS und Fortschritt (Abschnitt 4), Widgets 2 und 3 (Abschnitt 3), Design.

### Der PDF-Adapter, und warum er hier fehlt

Der Konzeptplan nennt für diesen Abschnitt „Adapter Git und PDF". Der PDF-Adapter wird bewusst zurückgestellt, mit einem Grund, der erst beim Entwerfen sichtbar wurde.

Das vorhandene Werkzeug für PDFs ist `extract_text` aus dem `local-rag`-MCP. Es läuft unter dem Windows-Konto, greift direkt auf das X:-Laufwerk zu und ist damit **nur aus einer Claude-Sitzung heraus erreichbar, nicht aus einem Node-Skript** — und auch dort nur mit VPN-Verbindung ins Büronetz. Ein Node-seitiger PDF-Adapter müsste stattdessen eine eigene Bibliothek mitbringen und würde damit ein zweites, schlechteres Extraktionsverfahren neben dem etablierten aufbauen.

Die Auflösung ist der Adapter-Schnitt selbst: `werkzeug/adapter/typen.mjs` legt fest, was ein Adapter liefern muss — `{ herkunft, urteile, lies }`. Der Git-Adapter erfüllt das als Skript. Ein PDF-Adapter erfüllt dasselbe **skillseitig**: Der Compiler-Skill ruft `extract_text` auf und schreibt in genau dieselbe Struktur unter `quellen/<name>/roh/`. Alles danach — Auswahl, Manifest, Destillation, Lektionsbau — ist identisch und bereits gebaut.

Damit bleibt „generisch ab Tag 1" gewahrt: Die Architektur ist quellenunabhängig, es fehlt nur die zweite Implementierung. Sie entsteht in Abschnitt 5, wo laut Konzeptplan ohnehin ein Stapel PDFs durchgeschoben wird — dann gegen echtes Material statt gegen eine Annahme.

---

## Was die Erkundung ergeben hat

Vor dem Entwurf gemessen, nicht angenommen:

| Befund | Zahl | Folge für den Entwurf |
|---|---|---|
| Sparse-Klon `--filter=blob:none --sparse --depth 1` | 4,8 s, 3,2 MB statt 220 MB | Der Git-Adapter klont sparse, nie vollständig |
| Relevanter Text unter `rag_tutorials` | 80 KB README + 354 KB Python | Passt in einen Kontext, aber nicht bequem — es braucht eine Übersicht als Einstieg |
| READMEs mit einem Abschnitt „How It Works" | **4 von 24** | Das Prinzip steht im Code. Der Ingest muss Python mitnehmen, nicht nur Prosa |
| Häufigste README-Überschriften | Features (14), Prerequisites (9), How to Run (9) | Merkmalslisten und Installationsanleitungen tragen keine Prinzipien |
| Längster relativer Pfad im Quellbaum | 83 Zeichen | Zusammen mit dem Projektpfad rund 160 — unter Windows knapp, aber tragbar |

Der letzte Punkt ist keine Theorie: Ein erster Klonversuch in das Sitzungs-Scratchpad scheiterte mit `fatal: could not create work tree dir: Filename too long`. Der Ingest legt Quellen deshalb **im Projekt** ab, nicht in tief verschachtelten Temp-Pfaden, und meldet einen zu langen Zielpfad als Fehler mit Klartext statt ihn krachen zu lassen.

---

## Dateistruktur nach Abschnitt 2

```
werkzeug/
├─ ingest.mjs                  CLI: Quelle holen und aufbereiten
├─ adapter/
│  ├─ typen.mjs                Das Adapter-Interface, eine Datei, ein Vertrag
│  └─ git.mjs                  Sparse-Klon, Auswahl, Aufbereitung
├─ auswahl.mjs                 Welche Datei kommt mit, welche nicht, und warum
├─ manifest.mjs                Herkunftsnachweis schreiben und lesen
├─ pruefe-lektion.mjs          CLI: eine Lektion gegen alle Schranken prüfen
└─ lehrplan.mjs                Lehrplan lesen, schreiben, prüfen

quellen/
└─ awesome-llm-apps/           (erzeugt, nicht im Git)
   ├─ manifest.json            Quelle, SHA, Datum, jede Datei mit Hash, jede Auslassung mit Grund
   ├─ uebersicht.md            24 Varianten in je fünf Zeilen — der Einstieg für Durchgang A
   └─ roh/
      ├─ corrective_rag.md     README + Code einer Variante, mit Herkunft im Frontmatter
      └─ …                     eine Datei je Variante

lehrplan/
└─ awesome-llm-apps.yaml       Der Lehrplan. Vom Menschen korrigiert, dann maßgeblich.

.claude/skills/kernbohrung-compiler/
└─ SKILL.md                    Durchgang A und B, mit dem Review-Gate dazwischen

tests/
├─ auswahl.test.ts
├─ manifest.test.ts
├─ lehrplan.test.ts
└─ pruefe-lektion.test.ts
```

**Warum `quellen/` nicht ins Git geht:** Es ist abgeleitet und wiederherstellbar — der Manifest-SHA sagt, aus welchem Stand. Was ins Git gehört, ist das Destillat: `lehrplan/` und `inhalt/lektionen/`.

**Verantwortlichkeiten:** `auswahl.mjs` entscheidet als reine Funktion über eine Datei und weiß nichts von Git. `git.mjs` holt und weiß nichts über Aufbereitung. `manifest.mjs` kennt nur das Format. Jede ist einzeln testbar; das ist der Grund für den Zuschnitt.

---

## Aufgabe 1: Auswahl — welche Datei kommt mit

Die erste Entscheidung des Compilers, und eine, die man leicht falsch trifft. Nimmt er alles, erstickt der Destillat-Durchgang in Lockfiles und Bilddaten. Nimmt er nur Prosa, verliert er das Prinzip — es steht in vier von vierundzwanzig Fällen in der Prosa und sonst im Code.

**Dateien:** Erstellen `werkzeug/auswahl.mjs`, Test `tests/auswahl.test.ts`

- [ ] **Schritt 1: Den fehlschlagenden Test schreiben**

Datei `tests/auswahl.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { beurteile, RUBRIK } from '../werkzeug/auswahl.mjs';

describe('beurteile', () => {
  it('nimmt eine README als Beschreibung', () => {
    const u = beurteile('rag_tutorials/corrective_rag/README.md', 2367);
    expect(u.mitnehmen).toBe(true);
    expect(u.rubrik).toBe(RUBRIK.beschreibung);
  });

  it('nimmt Python als Umsetzung', () => {
    const u = beurteile('rag_tutorials/corrective_rag/corrective_rag.py', 16609);
    expect(u.mitnehmen).toBe(true);
    expect(u.rubrik).toBe(RUBRIK.umsetzung);
  });

  it('laesst Bilder liegen und nennt den Grund', () => {
    const u = beurteile('rag_tutorials/x/assets/architektur.png', 500000);
    expect(u.mitnehmen).toBe(false);
    expect(u.grund).toMatch(/Bild|binaer/i);
  });

  it('laesst Abhaengigkeitslisten liegen', () => {
    const u = beurteile('rag_tutorials/x/requirements.txt', 348);
    expect(u.mitnehmen).toBe(false);
    expect(u.grund).toMatch(/Abhaengigkeit/i);
  });

  it('laesst Daten liegen, auch wenn sie Text sind', () => {
    for (const p of ['x/daten.csv', 'x/ergebnisse.json', 'x/paket-lock.json']) {
      expect(beurteile(p, 40000).mitnehmen).toBe(false);
    }
  });

  it('laesst zu grosse Textdateien liegen und nennt die Groesse', () => {
    const u = beurteile('rag_tutorials/x/riesig.py', 400_000);
    expect(u.mitnehmen).toBe(false);
    expect(u.grund).toMatch(/gross/i);
  });

  it('laesst versteckte Dateien und Ordner liegen', () => {
    expect(beurteile('x/.gitignore', 24).mitnehmen).toBe(false);
    expect(beurteile('x/.github/workflows/ci.yml', 1295).mitnehmen).toBe(false);
  });

  it('urteilt allein aus Pfad und Groesse, ohne Dateisystem', () => {
    // Reine Funktion: derselbe Aufruf ergibt dasselbe Urteil.
    const a = beurteile('x/y.py', 100);
    const b = beurteile('x/y.py', 100);
    expect(a).toEqual(b);
  });
});
```

- [ ] **Schritt 2: Test laufen lassen, Fehlschlag bestätigen**

```bash
npx vitest run tests/auswahl.test.ts
```

Erwartet: FAIL — Modul `../werkzeug/auswahl.mjs` nicht auflösbar.

- [ ] **Schritt 3: Implementierung schreiben**

Datei `werkzeug/auswahl.mjs`:

```javascript
/**
 * Entscheidet allein aus Pfad und Groesse, ob eine Datei ins Rohmaterial kommt.
 *
 * Bewusst eine reine Funktion ohne Dateisystemzugriff: So laesst sie sich ohne
 * Quelle testen, und der Adapter kann sie auf einen Git-Baum anwenden, bevor er
 * auch nur eine Datei geholt hat.
 */

export const RUBRIK = {
  beschreibung: 'beschreibung',
  umsetzung: 'umsetzung',
};

/** Obergrenze je Datei. Darueber liegt erfahrungsgemaess Generiertes, kein Gedanke. */
const MAX_BYTES = 200_000;

const BESCHREIBUNG = /\.(md|mdx|rst|adoc)$/i;
const UMSETZUNG = /\.(py|ts|tsx|js|jsx|go|rs|java|rb|sql)$/i;

/** Textdateien, die trotzdem nichts erklaeren. */
const ABHAENGIGKEITEN = /(^|\/)(requirements[^/]*\.txt|package(-lock)?\.json|pnpm-lock\.yaml|poetry\.lock|Pipfile(\.lock)?|go\.sum|Cargo\.lock)$/i;
const DATEN = /\.(csv|tsv|json|jsonl|parquet|ya?ml|xml|db|sqlite3?)$/i;
const BINAER = /\.(png|jpe?g|gif|svg|webp|ico|pdf|zip|gz|mp4|mov|woff2?|ttf)$/i;

export function beurteile(pfad, bytes) {
  const name = pfad.split('/').pop() ?? pfad;

  if (pfad.split('/').some((teil) => teil.startsWith('.'))) {
    return nein(pfad, 'versteckte Datei oder versteckter Ordner');
  }
  if (BINAER.test(name)) {
    return nein(pfad, 'Bild oder sonst binaer — traegt keinen Text');
  }
  if (ABHAENGIGKEITEN.test(pfad)) {
    return nein(pfad, 'Abhaengigkeitsliste — nennt Pakete, erklaert nichts');
  }
  if (BESCHREIBUNG.test(name)) {
    return bytes > MAX_BYTES
      ? nein(pfad, `zu gross: ${bytes} Bytes ueber der Grenze von ${MAX_BYTES}`)
      : ja(pfad, RUBRIK.beschreibung, bytes);
  }
  if (UMSETZUNG.test(name)) {
    return bytes > MAX_BYTES
      ? nein(pfad, `zu gross: ${bytes} Bytes ueber der Grenze von ${MAX_BYTES}`)
      : ja(pfad, RUBRIK.umsetzung, bytes);
  }
  if (DATEN.test(name)) {
    return nein(pfad, 'Daten — Inhalt statt Erklaerung');
  }
  return nein(pfad, 'unbekannte Endung');
}

function ja(pfad, rubrik, bytes) {
  return { pfad, mitnehmen: true, rubrik, bytes };
}

function nein(pfad, grund) {
  return { pfad, mitnehmen: false, grund };
}
```

Reihenfolge der Prüfungen beachten: `DATEN` steht **nach** `BESCHREIBUNG` und `UMSETZUNG`, weil `.yaml` sonst eine Beschreibung schluckte; und `ABHAENGIGKEITEN` steht vor beiden, weil `package.json` sonst als Daten statt als Abhängigkeitsliste gemeldet würde — beides wäre nicht falsch, aber die Begründung im Manifest wäre unpräziser.

- [ ] **Schritt 4: Test laufen lassen, Erfolg bestätigen**

```bash
npx vitest run tests/auswahl.test.ts
```

Erwartet: 8 Tests grün.

- [ ] **Schritt 5: Committen**

```bash
git add werkzeug/auswahl.mjs tests/auswahl.test.ts
git commit -m "feat: Auswahlregel fuer Rohmaterial, als reine Funktion"
```

---

## Aufgabe 2: Manifest — der Herkunftsnachweis

Das Konzept macht die Herkunft zur Pflicht: Jede spätere Behauptung muss auf eine Quelldatei zeigen können. Ebenso wichtig und leichter zu vergessen: **Das Manifest hält auch fest, was nicht mitgekommen ist.** Ohne diese Liste hält der nächste Leser das Rohmaterial für vollständig.

**Dateien:** Erstellen `werkzeug/manifest.mjs`, Test `tests/manifest.test.ts`

- [ ] **Schritt 1: Den fehlschlagenden Test schreiben**

Datei `tests/manifest.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { baueManifest, MANIFEST_FASSUNG } from '../werkzeug/manifest.mjs';

const urteile = [
  { pfad: 'a/README.md', mitnehmen: true, rubrik: 'beschreibung', bytes: 100 },
  { pfad: 'a/main.py', mitnehmen: true, rubrik: 'umsetzung', bytes: 200 },
  { pfad: 'a/bild.png', mitnehmen: false, grund: 'Bild oder sonst binaer — traegt keinen Text' },
];

const herkunft = {
  art: 'git',
  url: 'https://github.com/Beispiel/repo.git',
  unterpfad: 'rag_tutorials',
  sha: 'a13701eae315a81e1011a4304a6b5e741ea0a984',
};

describe('baueManifest', () => {
  it('haelt die Herkunft samt Commit-SHA fest', () => {
    const m = baueManifest({ herkunft, urteile, gestempeltAm: '2026-09-01T12:00:00Z' });
    expect(m.herkunft.sha).toBe(herkunft.sha);
    expect(m.herkunft.url).toBe(herkunft.url);
    expect(m.fassung).toBe(MANIFEST_FASSUNG);
    expect(m.gestempeltAm).toBe('2026-09-01T12:00:00Z');
  });

  it('listet die uebernommenen Dateien mit Rubrik und Groesse', () => {
    const m = baueManifest({ herkunft, urteile, gestempeltAm: '2026-09-01T12:00:00Z' });
    expect(m.uebernommen).toHaveLength(2);
    expect(m.uebernommen[0]).toMatchObject({ pfad: 'a/README.md', rubrik: 'beschreibung' });
  });

  it('listet die Auslassungen MIT Grund — sonst haelt man das Rohmaterial fuer vollstaendig', () => {
    const m = baueManifest({ herkunft, urteile, gestempeltAm: '2026-09-01T12:00:00Z' });
    expect(m.ausgelassen).toHaveLength(1);
    expect(m.ausgelassen[0].grund).toMatch(/binaer/i);
  });

  it('zaehlt zusammen, damit ein Blick genuegt', () => {
    const m = baueManifest({ herkunft, urteile, gestempeltAm: '2026-09-01T12:00:00Z' });
    expect(m.summe).toEqual({ uebernommen: 2, ausgelassen: 1, bytes: 300 });
  });

  it('verlangt einen Zeitstempel, statt selbst einen zu erfinden', () => {
    expect(() => baueManifest({ herkunft, urteile })).toThrow(/Zeitstempel/i);
  });

  it('verlangt einen SHA — ohne ihn ist die Herkunft wertlos', () => {
    const ohne = { ...herkunft, sha: '' };
    expect(() => baueManifest({ herkunft: ohne, urteile, gestempeltAm: '2026-09-01T12:00:00Z' }))
      .toThrow(/sha/i);
  });
});
```

- [ ] **Schritt 2: Test laufen lassen, Fehlschlag bestätigen**

```bash
npx vitest run tests/manifest.test.ts
```

Erwartet: FAIL — Modul nicht auflösbar.

- [ ] **Schritt 3: Implementierung schreiben**

Datei `werkzeug/manifest.mjs`:

```javascript
/**
 * Das Manifest ist der Herkunftsnachweis eines Rohmaterialstands.
 *
 * Es beantwortet zwei Fragen, und die zweite wird gern vergessen:
 * Woher kommt das hier — und was ist NICHT mitgekommen. Ohne die
 * Auslassungsliste haelt der naechste Leser den Bestand fuer vollstaendig
 * und schliesst aus einem fehlenden Treffer auf ein fehlendes Thema.
 */

export const MANIFEST_FASSUNG = 1;

export function baueManifest({ herkunft, urteile, gestempeltAm }) {
  if (!gestempeltAm) {
    throw new Error(
      'baueManifest: Zeitstempel fehlt. Er wird uebergeben, nicht erzeugt — ' +
        'sonst ist das Manifest bei jedem Lauf verschieden und nicht vergleichbar.',
    );
  }
  if (!herkunft?.sha) {
    throw new Error(
      'baueManifest: sha fehlt. Ohne ihn laesst sich spaeter nicht sagen, ' +
        'aus welchem Stand eine Behauptung stammt.',
    );
  }

  const uebernommen = urteile
    .filter((u) => u.mitnehmen)
    .map(({ pfad, rubrik, bytes }) => ({ pfad, rubrik, bytes }));

  const ausgelassen = urteile
    .filter((u) => !u.mitnehmen)
    .map(({ pfad, grund }) => ({ pfad, grund }));

  return {
    fassung: MANIFEST_FASSUNG,
    gestempeltAm,
    herkunft,
    summe: {
      uebernommen: uebernommen.length,
      ausgelassen: ausgelassen.length,
      bytes: uebernommen.reduce((n, d) => n + d.bytes, 0),
    },
    uebernommen,
    ausgelassen,
  };
}
```

- [ ] **Schritt 4: Test laufen lassen, Erfolg bestätigen**

```bash
npx vitest run tests/manifest.test.ts
```

Erwartet: 6 Tests grün.

- [ ] **Schritt 5: Committen**

```bash
git add werkzeug/manifest.mjs tests/manifest.test.ts
git commit -m "feat: Manifest mit Herkunft und Auslassungsliste"
```

---

## Aufgabe 3: Git-Adapter und Ingest-CLI

**Dateien:** Erstellen `werkzeug/adapter/git.mjs`, `werkzeug/ingest.mjs`; Skript in `package.json`

- [ ] **Schritt 1: Adapter schreiben**

Datei `werkzeug/adapter/git.mjs`:

```javascript
import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { beurteile } from '../auswahl.mjs';

/**
 * Holt einen Unterpfad eines Git-Repos, ohne das ganze Repo zu holen.
 *
 * Gemessen an awesome-llm-apps: 4,8 Sekunden und 3,2 MB statt 220 MB.
 * `--filter=blob:none` laedt Dateiinhalte erst bei Bedarf, `--sparse` plus
 * `sparse-checkout` beschraenkt den Arbeitsbaum auf den Unterpfad, `--depth 1`
 * spart die Historie. Fuer den Herkunftsnachweis genuegt der HEAD-SHA.
 */
export async function hole({ url, unterpfad, ziel, protokoll = () => {} }) {
  if (existsSync(ziel)) rmSync(ziel, { recursive: true, force: true });
  mkdirSync(path.dirname(ziel), { recursive: true });

  // Windows: MAX_PATH schlaegt hier frueh und mit einer irrefuehrenden Meldung zu.
  const platzBedarf = ziel.length + 1 + 120;
  if (platzBedarf > 250) {
    throw new Error(
      `Zielpfad zu lang (${ziel.length} Zeichen). Zusammen mit Pfaden im Repo ` +
        `sprengt das die Windows-Grenze; git meldet dann nur "Filename too long". ` +
        `Leg die Quellen naeher an die Laufwerkswurzel.`,
    );
  }

  protokoll(`klone ${url} (sparse, ohne Blobs, ohne Historie)`);
  git(['clone', '--filter=blob:none', '--sparse', '--depth', '1', url, ziel]);
  git(['sparse-checkout', 'set', unterpfad], ziel);

  const sha = git(['rev-parse', 'HEAD'], ziel).trim();
  protokoll(`Stand ${sha}`);

  const roh = git(['ls-files', '-s', unterpfad], ziel);
  const dateien = roh
    .split('\n')
    .filter(Boolean)
    .map((zeile) => zeile.split('\t')[1])
    .filter(Boolean);

  const urteile = dateien.map((rel) => {
    const voll = path.join(ziel, rel);
    const bytes = existsSync(voll) ? readFileSync(voll).length : 0;
    return beurteile(rel, bytes);
  });

  return {
    herkunft: { art: 'git', url, unterpfad, sha },
    urteile,
    lies: (rel) => readFileSync(path.join(ziel, rel), 'utf8'),
  };
}

function git(args, cwd) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 32 * 1024 * 1024,
  });
}
```

- [ ] **Schritt 2: Aufbereitung und CLI schreiben**

Datei `werkzeug/ingest.mjs`:

```javascript
#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { hole } from './adapter/git.mjs';
import { baueManifest } from './manifest.mjs';
import { RUBRIK } from './auswahl.mjs';

/**
 * Bereitet eine Quelle so auf, dass der Destillat-Durchgang damit arbeiten kann.
 *
 * Eine Datei je Variante, nicht je Quelldatei: Eine Variante ist die kleinste
 * Einheit, die fuer sich einen Gedanken traegt. README und Code gehoeren
 * zusammengelesen — in vier von vierundzwanzig Faellen erklaert die README das
 * Verfahren, sonst steht es nur im Code.
 */

function argument(name, standard) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : standard;
}

const url = argument('git');
const unterpfad = argument('pfad', '');
const kurzname = argument('name');

if (!url || !kurzname) {
  console.error(
    'Aufruf: npm run ingest -- --git <url> --pfad <unterpfad> --name <kurzname>\n' +
      'Beispiel: npm run ingest -- --git https://github.com/Shubhamsaboo/awesome-llm-apps.git \\\n' +
      '            --pfad rag_tutorials --name awesome-llm-apps',
  );
  process.exit(2);
}

const wurzel = process.cwd();
const quellordner = path.join(wurzel, 'quellen', kurzname);
const arbeitsklon = path.join(quellordner, '.klon');

const { herkunft, urteile, lies } = await hole({
  url,
  unterpfad,
  ziel: arbeitsklon,
  protokoll: (z) => console.log(`  ${z}`),
});

const uebernommen = urteile.filter((u) => u.mitnehmen);
const varianten = new Map();
for (const u of uebernommen) {
  const teile = u.pfad.split('/');
  const name = teile.length > 2 ? teile[1] : teile[0].replace(/\.[^.]+$/, '');
  if (!varianten.has(name)) varianten.set(name, []);
  varianten.get(name).push(u);
}

const rohordner = path.join(quellordner, 'roh');
mkdirSync(rohordner, { recursive: true });

const einstiege = [];
for (const [name, dateien] of [...varianten].sort()) {
  const beschreibungen = dateien.filter((d) => d.rubrik === RUBRIK.beschreibung);
  const umsetzungen = dateien.filter((d) => d.rubrik === RUBRIK.umsetzung);

  const kopf = [
    '---',
    `variante: ${name}`,
    `herkunft: ${herkunft.url}`,
    `stand: ${herkunft.sha}`,
    'dateien:',
    ...dateien.map((d) => `  - ${d.pfad}`),
    '---',
    '',
  ].join('\n');

  const teile = [kopf];
  for (const d of beschreibungen) {
    teile.push(`## Beschreibung — ${d.pfad}\n\n${lies(d.pfad)}\n`);
  }
  for (const d of umsetzungen) {
    const endung = d.pfad.split('.').pop();
    teile.push(`## Umsetzung — ${d.pfad}\n\n\`\`\`${endung}\n${lies(d.pfad)}\n\`\`\`\n`);
  }

  writeFileSync(path.join(rohordner, `${name}.md`), teile.join('\n'), 'utf8');

  const ersterAbsatz =
    beschreibungen.length > 0
      ? (lies(beschreibungen[0].pfad)
          .split('\n')
          .filter((z) => z.trim() && !z.startsWith('#'))[0] ?? '')
      : '';
  einstiege.push({ name, ersterAbsatz: ersterAbsatz.slice(0, 300), dateien: dateien.length });
}

const uebersicht = [
  `# ${kurzname} — ${varianten.size} Varianten`,
  '',
  `Stand ${herkunft.sha}, Unterpfad \`${unterpfad}\`.`,
  '',
  'Diese Übersicht ist der Einstieg für den Destillat-Durchgang: Sie reicht,',
  'um Verwandtschaften zu erkennen. Für ein Urteil über ein Prinzip gehört die',
  'jeweilige Datei unter `roh/` vollständig gelesen.',
  '',
  ...einstiege.flatMap((e) => [`## ${e.name}`, '', e.ersterAbsatz, '', `\`roh/${e.name}.md\` · ${e.dateien} Quelldateien`, '']),
].join('\n');

writeFileSync(path.join(quellordner, 'uebersicht.md'), uebersicht, 'utf8');

const manifest = baueManifest({
  herkunft,
  urteile,
  gestempeltAm: new Date().toISOString(),
});
writeFileSync(path.join(quellordner, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

console.log(
  `\n${manifest.summe.uebernommen} Dateien übernommen, ${manifest.summe.ausgelassen} ausgelassen, ` +
    `${varianten.size} Varianten, ${Math.round(manifest.summe.bytes / 1024)} KB.\n` +
    `  ${path.relative(wurzel, quellordner)}/uebersicht.md\n` +
    `  ${path.relative(wurzel, quellordner)}/manifest.json`,
);
```

- [ ] **Schritt 3: Skript und Ignorieren eintragen**

In `package.json` bei `scripts` ergänzen:

```json
    "ingest": "node werkzeug/ingest.mjs",
```

In `.gitignore` ergänzen:

```
quellen/
```

- [ ] **Schritt 4: Echten Lauf machen**

```bash
npm run ingest -- --git https://github.com/Shubhamsaboo/awesome-llm-apps.git --pfad rag_tutorials --name awesome-llm-apps
```

Erwartet: 24 Varianten, rund 60 übernommene Dateien, rund 430 KB. Prüfe von Hand:
- `quellen/awesome-llm-apps/manifest.json` nennt einen SHA und eine nicht leere Auslassungsliste
- `quellen/awesome-llm-apps/roh/corrective_rag.md` enthält README **und** Python
- `quellen/awesome-llm-apps/uebersicht.md` listet 24 Varianten

- [ ] **Schritt 5: Committen**

```bash
git add werkzeug/adapter/git.mjs werkzeug/ingest.mjs package.json .gitignore
git commit -m "feat: Git-Adapter mit Sparse-Klon und Ingest-CLI"
```

---

## Aufgabe 4: Lektionsprüfung als Kommandozeilenwerkzeug

Die Schranke aus Abschnitt 1, benutzbar gemacht. Der Skill ruft sie auf, **bevor** er eine Lektion schreibt — nicht danach.

**Dateien:** Erstellen `werkzeug/pruefe-lektion.mjs`, Test `tests/pruefe-lektion.test.ts`

- [ ] **Schritt 1: Den fehlschlagenden Test schreiben**

Datei `tests/pruefe-lektion.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { pruefeLektionsText } from '../werkzeug/pruefe-lektion.mjs';

const gute = `---
titel: "Ein Prinzip"
prinzip: "Ein Satz, der etwas behauptet."
reihenfolge: 2
gesperrt: false
fragen:
  - id: p-1
    frage: "Erste Frage?"
    antworten:
      - text: "Richtig"
        richtig: true
        begruendung: "Diese Begruendung hat mehr als fuenf Woerter."
      - text: "Falsch A"
        richtig: false
        begruendung: "Auch diese Begruendung hat genug Woerter darin."
      - text: "Falsch B"
        richtig: false
        begruendung: "Und diese hier ebenfalls, mit genug Woertern."
  - id: p-2
    frage: "Zweite Frage?"
    antworten:
      - text: "Richtig"
        richtig: true
        begruendung: "Diese Begruendung hat mehr als fuenf Woerter."
      - text: "Falsch A"
        richtig: false
        begruendung: "Auch diese Begruendung hat genug Woerter darin."
      - text: "Falsch B"
        richtig: false
        begruendung: "Und diese hier ebenfalls, mit genug Woertern."
transfer:
  id: p-t
  frage: "Transferfrage?"
  antworten:
    - text: "Richtig"
      richtig: true
      begruendung: "Diese Begruendung hat mehr als fuenf Woerter."
    - text: "Falsch A"
      richtig: false
      begruendung: "Auch diese Begruendung hat genug Woerter darin."
    - text: "Falsch B"
      richtig: false
      begruendung: "Und diese hier ebenfalls, mit genug Woertern."
quellen:
  - pfad: "rag_tutorials/corrective_rag"
---

Ein Widerspruch in Prosa.
`;

describe('pruefeLektionsText', () => {
  it('nimmt eine gueltige Lektion an', () => {
    const e = pruefeLektionsText(gute);
    expect(e.ok).toBe(true);
  });

  it('lehnt zwei richtige Antworten ab und sagt warum', () => {
    const kaputt = gute.replace('text: "Falsch A"\n        richtig: false', 'text: "Falsch A"\n        richtig: true');
    const e = pruefeLektionsText(kaputt);
    expect(e.ok).toBe(false);
    expect(e.maengel.join(' ')).toMatch(/genau eine/i);
  });

  it('lehnt eine Lektion ohne Frontmatter ab', () => {
    const e = pruefeLektionsText('Nur Prosa, kein Frontmatter.');
    expect(e.ok).toBe(false);
    expect(e.maengel.join(' ')).toMatch(/frontmatter/i);
  });

  it('lehnt kaputtes YAML ab, ohne abzustuerzen', () => {
    const e = pruefeLektionsText('---\ntitel: "unbeendet\n---\n');
    expect(e.ok).toBe(false);
    expect(e.maengel.length).toBeGreaterThan(0);
  });

  it('meldet einen ungueltigen Widget-Aufruf im Rumpf', () => {
    const mitWidget = gute + '\n<Pipeline schritte={[]} ergebnisse={[]} />\n';
    const e = pruefeLektionsText(mitWidget);
    expect(e.ok).toBe(false);
    expect(e.maengel.join(' ')).toMatch(/Pipeline/);
  });

  it('meldet einen unbekannten Widget-Namen im Rumpf', () => {
    const mitWidget = gute + '\n<GibtEsNicht foo={1} />\n';
    const e = pruefeLektionsText(mitWidget);
    expect(e.ok).toBe(false);
    expect(e.maengel.join(' ')).toMatch(/GibtEsNicht/);
  });
});
```

- [ ] **Schritt 2: Test laufen lassen, Fehlschlag bestätigen**

```bash
npx vitest run tests/pruefe-lektion.test.ts
```

Erwartet: FAIL — Modul nicht auflösbar.

- [ ] **Schritt 3: Implementierung schreiben**

Datei `werkzeug/pruefe-lektion.mjs`:

```javascript
#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import yaml from 'js-yaml';
import { LektionSchema } from '../src/content/schema.ts';
import { pruefeWidget } from '../src/widgets/pruefung.ts';

/**
 * Prueft eine Lektion, bevor sie geschrieben wird.
 *
 * Beide Schranken an einer Stelle: das Frontmatter gegen LektionSchema, jeder
 * Widget-Aufruf im Rumpf gegen pruefeWidget. Genau dafuer wurden beide Module
 * in Abschnitt 1 so geschnitten, dass ein reiner Node-Prozess sie laden kann.
 */

export function pruefeLektionsText(text) {
  const treffer = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
  if (!treffer) {
    return { ok: false, maengel: ['Kein Frontmatter gefunden. Eine Lektion beginnt mit --- und endet den Kopf mit ---.'] };
  }

  let kopf;
  try {
    kopf = yaml.load(treffer[1]);
  } catch (fehler) {
    return { ok: false, maengel: [`Frontmatter ist kein gueltiges YAML: ${fehler.message}`] };
  }

  const maengel = [];

  const geprueft = LektionSchema.safeParse(kopf);
  if (!geprueft.success) {
    for (const m of geprueft.error.issues) {
      maengel.push(`Frontmatter ${m.path.join('.') || '(Wurzel)'}: ${m.message}`);
    }
  }

  for (const { name, props, fehler } of widgetAufrufe(treffer[2])) {
    if (fehler) {
      maengel.push(`Widget <${name} …/>: ${fehler}`);
      continue;
    }
    const ergebnis = pruefeWidget(name, props);
    if (!ergebnis.ok) maengel.push(...ergebnis.maengel);
  }

  return maengel.length === 0 ? { ok: true, daten: geprueft.data } : { ok: false, maengel };
}

/**
 * Findet Widget-Aufrufe im MDX-Rumpf und wertet ihre Parameter aus.
 *
 * Die Parameter sind JSX-Ausdruecke aus Literalen — Objekte, Arrays, Strings,
 * Zahlen, Wahrheitswerte. Sie werden in einer Funktion ohne Zugriff auf die
 * Umgebung ausgewertet. Das ist eng genug fuer erzeugten Inhalt und ehrlicher
 * als ein selbstgebauter Halbparser, der bei geschachtelten Klammern falsch
 * liegt. Eine Datei, die hier etwas anderes als Literale enthaelt, ist ohnehin
 * kein Kandidat fuer die Auslieferung.
 */
export function* widgetAufrufe(rumpf) {
  const muster = /<([A-Z][A-Za-z0-9]*)\s([\s\S]*?)\/>/g;
  let treffer;
  while ((treffer = muster.exec(rumpf)) !== null) {
    const name = treffer[1];
    try {
      yield { name, props: werteProps(treffer[2]) };
    } catch (fehler) {
      yield { name, fehler: `Parameter nicht auswertbar: ${fehler.message}` };
    }
  }
}

function werteProps(quelle) {
  const paare = [];
  const attribut = /([a-zA-Z][a-zA-Z0-9]*)\s*=\s*(\{[\s\S]*?\}|"[^"]*"|'[^']*')(?=\s+[a-zA-Z]|\s*$)/g;
  let t;
  while ((t = attribut.exec(quelle)) !== null) {
    const wert = t[2].startsWith('{') ? t[2].slice(1, -1) : t[2];
    paare.push(`${JSON.stringify(t[1])}: (${wert})`);
  }
  // eslint-disable-next-line no-new-func
  return new Function(`"use strict"; return {${paare.join(',')}};`)();
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}`) {
  const datei = process.argv[2];
  if (!datei) {
    console.error('Aufruf: node werkzeug/pruefe-lektion.mjs <datei.mdx>');
    process.exit(2);
  }
  const ergebnis = pruefeLektionsText(readFileSync(datei, 'utf8'));
  if (ergebnis.ok) {
    console.log(`${datei}: in Ordnung`);
  } else {
    console.error(`${datei}: ${ergebnis.maengel.length} Mangel/Mängel\n`);
    for (const m of ergebnis.maengel) console.error(`  - ${m}`);
    process.exit(1);
  }
}
```

- [ ] **Schritt 4: `js-yaml` als direkte Abhängigkeit eintragen**

```bash
npm i -D js-yaml @types/js-yaml
```

Es liegt bereits transitiv im Baum, aber ein transitiver Treffer ist kein Vertrag — er kann bei jedem Astro-Update verschwinden.

- [ ] **Schritt 5: Test laufen lassen, Erfolg bestätigen**

```bash
npx vitest run tests/pruefe-lektion.test.ts
```

Erwartet: 6 Tests grün.

- [ ] **Schritt 6: Gegen die echte Lektion laufen lassen**

```bash
node werkzeug/pruefe-lektion.mjs inhalt/lektionen/recall-vor-precision.mdx
```

Erwartet: `in Ordnung`. Das ist der wichtigste Einzelnachweis dieser Aufgabe: Die Prüfung erkennt die von Hand geschriebene Lektion als gültig — inklusive ihres Pipeline-Aufrufs mit vier Ergebnissen.

- [ ] **Schritt 7: Skript eintragen und committen**

In `package.json`:

```json
    "pruefe-lektion": "node werkzeug/pruefe-lektion.mjs",
```

```bash
git add werkzeug/pruefe-lektion.mjs tests/pruefe-lektion.test.ts package.json package-lock.json
git commit -m "feat: Lektionspruefung als Werkzeug, vor dem Schreiben nutzbar"
```

---

## Aufgabe 5: Lehrplan — Format und Prüfung

Der Lehrplan ist das Ergebnis von Durchgang A und die Vorlage für Durchgang B. Er ist die Datei, an der das Review-Gate hängt: **Wer den Lehrplan kontrolliert, kontrolliert die App.**

**Dateien:** Erstellen `werkzeug/lehrplan.mjs`, Test `tests/lehrplan.test.ts`

- [ ] **Schritt 1: Das Format festlegen**

Ein Lehrplan sieht so aus (Beispiel, keine echten Prinzipien):

```yaml
quelle: awesome-llm-apps
stand: a13701eae315a81e1011a4304a6b5e741ea0a984
geprueftVon: Daniel Nobs
geprueftAm: 2026-09-02
prinzipien:
  - id: recall-vor-precision
    satz: "Recall entsteht beim Holen, Precision beim Sortieren."
    warumNichtOffensichtlich: "Beide zeigen sich als schlechte Treffer."
    belege:
      - corrective_rag
      - hybrid_search_rag
    widget: Pipeline
```

- [ ] **Schritt 2: Den fehlschlagenden Test schreiben**

Datei `tests/lehrplan.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { pruefeLehrplan, HOECHSTZAHL } from '../werkzeug/lehrplan.mjs';

const gut = {
  quelle: 'awesome-llm-apps',
  stand: 'a13701eae315a81e1011a4304a6b5e741ea0a984',
  geprueftVon: 'Daniel Nobs',
  geprueftAm: '2026-09-02',
  prinzipien: [
    {
      id: 'recall-vor-precision',
      satz: 'Recall entsteht beim Holen, Precision beim Sortieren.',
      warumNichtOffensichtlich: 'Beide zeigen sich als schlechte Treffer.',
      belege: ['corrective_rag'],
      widget: 'Pipeline',
    },
    {
      id: 'kontext-ist-knapp',
      satz: 'Das Kontextfenster ist ein Budget, kein Behaelter.',
      warumNichtOffensichtlich: 'Mehr Kontext klingt immer besser.',
      belege: ['autonomous_rag'],
      widget: 'Pipeline',
    },
  ],
};

describe('pruefeLehrplan', () => {
  it('nimmt einen gueltigen Lehrplan an', () => {
    expect(pruefeLehrplan(gut).ok).toBe(true);
  });

  it('verlangt mindestens zwei Prinzipien', () => {
    const e = pruefeLehrplan({ ...gut, prinzipien: [gut.prinzipien[0]] });
    expect(e.ok).toBe(false);
  });

  it(`erlaubt hoechstens ${HOECHSTZAHL} Prinzipien — Verdichten ist die Aufgabe`, () => {
    const viele = Array.from({ length: HOECHSTZAHL + 1 }, (_, i) => ({
      ...gut.prinzipien[0],
      id: `prinzip-${i}`,
    }));
    const e = pruefeLehrplan({ ...gut, prinzipien: viele });
    expect(e.ok).toBe(false);
    expect(e.maengel.join(' ')).toMatch(/hoechstens|verdicht/i);
  });

  it('lehnt doppelte Prinzip-Ids ab', () => {
    const doppelt = [gut.prinzipien[0], { ...gut.prinzipien[1], id: gut.prinzipien[0].id }];
    expect(pruefeLehrplan({ ...gut, prinzipien: doppelt }).ok).toBe(false);
  });

  it('verlangt zu jedem Prinzip mindestens einen Beleg', () => {
    const ohne = [{ ...gut.prinzipien[0], belege: [] }, gut.prinzipien[1]];
    const e = pruefeLehrplan({ ...gut, prinzipien: ohne });
    expect(e.ok).toBe(false);
    expect(e.maengel.join(' ')).toMatch(/beleg/i);
  });

  it('verlangt einen Pruefer — der Lehrplan ist das Review-Gate', () => {
    const { geprueftVon, ...ohne } = gut;
    const e = pruefeLehrplan(ohne);
    expect(e.ok).toBe(false);
    expect(e.maengel.join(' ')).toMatch(/geprueftVon/i);
  });

  it('lehnt ein unbekanntes Widget ab', () => {
    const falsch = [{ ...gut.prinzipien[0], widget: 'GibtEsNicht' }, gut.prinzipien[1]];
    expect(pruefeLehrplan({ ...gut, prinzipien: falsch }).ok).toBe(false);
  });
});
```

- [ ] **Schritt 3: Implementierung schreiben**

Datei `werkzeug/lehrplan.mjs`:

```javascript
import { readFileSync } from 'node:fs';
import yaml from 'js-yaml';
import { z } from 'astro/zod';
import { widgetPruefungen } from '../src/widgets/pruefung.ts';

/**
 * Der Lehrplan ist das Review-Gate.
 *
 * Die Obergrenze ist keine Formalie: Die Aufgabe von Durchgang A ist zu
 * verdichten, nicht zu katalogisieren. Vierundzwanzig Varianten sollen zu
 * einer Handvoll Prinzipien werden. Wer neunzehn Prinzipien findet, hat
 * zusammengefasst statt destilliert.
 */
export const HOECHSTZAHL = 8;

const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const PrinzipSchema = z.strictObject({
  id: z.string().regex(ID, 'nur Kleinbuchstaben, Ziffern und Bindestrich.'),
  satz: z.string().trim().min(1).max(200, 'Ein Prinzip ist ein Satz, kein Absatz.'),
  warumNichtOffensichtlich: z.string().trim().min(1),
  belege: z.array(z.string().trim().min(1)).min(1, 'Jedes Prinzip braucht mindestens einen Beleg.'),
  widget: z.string().refine(
    (n) => Object.prototype.hasOwnProperty.call(widgetPruefungen, n),
    'kein bekannter Widget-Typ.',
  ),
});

const LehrplanSchema = z
  .strictObject({
    quelle: z.string().trim().min(1),
    stand: z.string().trim().min(7),
    geprueftVon: z.string().trim().min(1, 'geprueftVon fehlt — der Lehrplan ist das Review-Gate.'),
    geprueftAm: z.string().trim().min(1),
    prinzipien: z
      .array(PrinzipSchema)
      .min(2)
      .max(HOECHSTZAHL, `hoechstens ${HOECHSTZAHL} Prinzipien — verdichten, nicht katalogisieren.`),
  })
  .refine(
    (l) => new Set(l.prinzipien.map((p) => p.id)).size === l.prinzipien.length,
    'Zwei Prinzipien haben dieselbe id.',
  );

export function pruefeLehrplan(daten) {
  const geprueft = LehrplanSchema.safeParse(daten);
  if (geprueft.success) return { ok: true, lehrplan: geprueft.data };
  return {
    ok: false,
    maengel: geprueft.error.issues.map((m) => `${m.path.join('.') || '(Wurzel)'}: ${m.message}`),
  };
}

export function liesLehrplan(datei) {
  return pruefeLehrplan(yaml.load(readFileSync(datei, 'utf8')));
}
```

- [ ] **Schritt 4: Test laufen lassen, Erfolg bestätigen**

```bash
npx vitest run tests/lehrplan.test.ts
```

Erwartet: 7 Tests grün.

- [ ] **Schritt 5: Committen**

```bash
git add werkzeug/lehrplan.mjs tests/lehrplan.test.ts
git commit -m "feat: Lehrplan-Format mit Obergrenze und Belegpflicht"
```

---

## Aufgabe 6: Der Skill

Die beiden Durchgänge, die Urteilsvermögen brauchen. Der Skill ruft die Werkzeuge auf und legt zwischen A und B das Review-Gate.

**Dateien:** Erstellen `.claude/skills/kernbohrung-compiler/SKILL.md`

- [ ] **Schritt 1: Den Skill schreiben**

Datei `.claude/skills/kernbohrung-compiler/SKILL.md`:

````markdown
---
name: kernbohrung-compiler
description: Destilliert aus einer eingelesenen Quelle Kernprinzipien und baut daraus Lektionen für die Lern-App Kernbohrung. Nutze diesen Skill, wenn eine neue Quelle zu Lektionen werden soll, wenn der Lehrplan überarbeitet wird, oder bei Aufrufen wie "destilliere rag_tutorials", "bau die Lektionen", "neuer Lehrplan". Zwei Durchgänge mit einem Review-Gate dazwischen — der Lehrplan wird IMMER dem Menschen vorgelegt, bevor Lektionen entstehen.
---

# Kernbohrung — Compiler

Du verdichtest Rohmaterial zu Lektionen. Zwei Durchgänge, dazwischen ein Mensch.

## Grundsätze, die über allem stehen

**Verdichten, nicht katalogisieren.** Vierundzwanzig Varianten sind nicht
vierundzwanzig Themen. Wenn du für jede Variante ein Prinzip findest, hast du
zusammengefasst, nicht destilliert. Höchstens acht, lieber fünf.

**Ablehnen ist erlaubt und erwünscht.** Vier gute Lektionen schlagen zwölf
mittelmäßige. Findest du zu einem Prinzip keine Frage, deren falsche Antworten
etwas taugen, sag das — und baue die Lektion nicht.

**Jede Behauptung zeigt auf eine Quelldatei.** Was du nicht belegen kannst,
kommt nicht in den Lehrplan.

## Durchgang A — Prinzipien destillieren

1. Prüfe, ob die Quelle eingelesen ist:
   ```bash
   ls quellen/<name>/uebersicht.md
   ```
   Fehlt sie, lies erst ein:
   ```bash
   npm run ingest -- --git <url> --pfad <unterpfad> --name <name>
   ```

2. Lies `quellen/<name>/uebersicht.md` ganz. Sie gibt dir die Landkarte, aber
   **kein Urteil** — die ersten Absätze der READMEs sind Werbetext.

3. Lies `quellen/<name>/manifest.json`, Abschnitt `ausgelassen`. Was fehlt,
   musst du wissen, bevor du über Vollständigkeit redest.

4. Lies die Dateien unter `roh/` — **vollständig, nicht überflogen**, und
   besonders die Abschnitte „Umsetzung". Bei diesem Material erklären nur vier
   von vierundzwanzig READMEs das Verfahren; sonst steht es im Code. Wer nur
   die Beschreibungen liest, destilliert Merkmalslisten.

5. Frage dich nicht „was macht jede Variante", sondern:
   **Welche wiederkehrenden Prinzipien erklären, warum es diese Varianten gibt?**
   Ein Prinzip taugt, wenn es
   - in mehreren Varianten auftaucht,
   - nicht offensichtlich ist (es gibt eine plausible Gegenposition),
   - und eine Entscheidung leitet, nicht nur einen Namen vergibt.

6. Schreib den Entwurf nach `lehrplan/<name>.yaml`. Format und Grenzen siehe
   `werkzeug/lehrplan.mjs`. Lass `geprueftVon` und `geprueftAm` **leer** —
   die füllt der Mensch.

7. Prüfe ihn:
   ```bash
   node -e "import('./werkzeug/lehrplan.mjs').then(m=>console.log(JSON.stringify(m.liesLehrplan('lehrplan/<name>.yaml'),null,2)))"
   ```

## Das Review-Gate

**Halte hier an.** Lege den Lehrplan vor und sag klar:

- welche Prinzipien du gefunden hast, je in einem Satz
- worauf du sie stützt
- was du **verworfen** hast und warum — das ist oft aufschlussreicher
- wo du unsicher bist

Dann bitte um Korrektur. Fahre erst fort, wenn der Mensch zugestimmt hat und
`geprueftVon` gefüllt ist. **Fülle es niemals selbst.**

## Durchgang B — Lektionen bauen

Je Prinzip eine Lektion, eine nach der anderen. Für jede:

1. Lies die belegenden Rohdateien noch einmal.
2. Schreib die Lektion nach dem Sechs-Takte-Aufbau. Die Reihenfolge legt das
   Layout fest; du lieferst Teile:
   - **Frontmatter:** `prinzip`, `fragen`, `transfer`, `quellen`
   - **Rumpf:** der Widerspruch als Prosa, dann der Widget-Aufruf
3. **Die Regel für falsche Antworten** ist der Kern. Eine Frage ist nur
   zulässig, wenn ihre falschen Antworten Positionen sind, die ein kompetenter
   Mensch tatsächlich vertreten würde.

   Untauglich: *Wofür steht RAG? (b) Random Access Grammar*
   Tauglich: *Recall gut, Precision schlecht — was zuerst?*

   Jede falsche Antwort trägt ihre eigene Begründung, warum sie falsch ist.
   Dort steckt der Lerneffekt, nicht in der richtigen Antwort.

4. Der Transfer geht auf einen Fall, der in der Quelle **nicht** vorkommt.

5. Schreib die Datei in einen Entwurfsordner, dann prüfe:
   ```bash
   node werkzeug/pruefe-lektion.mjs <entwurf>.mdx
   ```
   Erst wenn das `in Ordnung` meldet, verschiebe sie nach
   `inhalt/lektionen/`. **Nie vorher.**

6. Zum Schluss:
   ```bash
   npm run build
   ```
   Der Bau ist die letzte Schranke — er hält bei ungültigen Widget-Parametern an.

## Was du nie tust

- `geprueftVon` selbst füllen
- eine Lektion nach `inhalt/lektionen/` schreiben, die die Prüfung nicht bestanden hat
- eine Datei mit `gesperrt: true` überschreiben — die ist von Hand nachgebessert
- eine Frage bauen, deren falsche Antworten offensichtlich falsch sind
- über Vollständigkeit reden, ohne die Auslassungsliste im Manifest gelesen zu haben
````

- [ ] **Schritt 2: Committen**

```bash
git add .claude/skills/kernbohrung-compiler/SKILL.md
git commit -m "feat: Compiler-Skill mit Review-Gate zwischen den Durchgaengen"
```

---

## Aufgabe 7: Der erste echte Durchlauf

Die Werkzeuge sind gebaut. Jetzt zeigt sich, ob sie taugen. **Diese Aufgabe wird nicht an einen Subagenten delegiert** — Durchgang A braucht Urteilsvermögen, und das Review-Gate braucht den Menschen.

- [ ] **Schritt 1: Einlesen**

```bash
npm run ingest -- --git https://github.com/Shubhamsaboo/awesome-llm-apps.git --pfad rag_tutorials --name awesome-llm-apps
```

- [ ] **Schritt 2: Durchgang A**

Skill `kernbohrung-compiler` aufrufen. Ergebnis: `lehrplan/awesome-llm-apps.yaml` mit höchstens acht Prinzipien, `geprueftVon` leer.

- [ ] **Schritt 3: Review-Gate**

Der Lehrplan wird vorgelegt, besprochen, korrigiert. Der Mensch trägt `geprueftVon` und `geprueftAm` ein.

Erwartung an dieser Stelle, ausdrücklich festgehalten: **Der erste Entwurf wird nicht gut sein.** Das ist der Zweck des Gates. Rechne mit Streichungen und mit Prinzipien, die zu zweit eines sind.

- [ ] **Schritt 4: Durchgang B**

Je Prinzip eine Lektion, jede vor dem Verschieben geprüft. Ablehnungen sind zulässig und werden benannt.

- [ ] **Schritt 5: Committen**

```bash
git add lehrplan/ inhalt/lektionen/
git commit -m "content: Lehrplan und Lektionen aus rag_tutorials"
```

---

## Aufgabe 8: Abnahme

- [ ] **Schritt 1: Alle Tests**

```bash
npm test && npm run check && npm run build
```

- [ ] **Schritt 2: Sichtprüfung im Browser**

**In einem sichtbaren Fenster** — `client:visible` hydriert sonst nicht. Für jede erzeugte Lektion:

1. Die sechs Takte stehen in der richtigen Reihenfolge.
2. Kein `.widget-fehler` im Dokument nach der Hydration.
3. Das Widget reagiert, und jede Schalterkombination zeigt ein Ergebnis.
4. Vor dem Antworten ist keine Begründung sichtbar, danach alle.
5. Die Herkunftslinks zeigen auf die Verzeichnisse, die im Lehrplan als Belege stehen.

- [ ] **Schritt 3: Die Frage, die zählt**

Lies eine erzeugte Lektion als Lernender, nicht als Prüfer. Beantworte:

- Ist der Widerspruch wirklich einer, oder nur eine Einleitung?
- Braucht die Probe das Bild, oder wäre sie ohne genauso lösbar?
- Sind die falschen Antworten Positionen, die man vertreten könnte?

**Diese drei Fragen entscheiden über Abschnitt 2, nicht die Testzahl.** Fällt
eine Lektion durch, ist das ein Befund am Compiler, nicht an der Lektion.

## Abnahmekriterium

Aus `rag_tutorials` sind über einen vom Menschen geprüften Lehrplan mindestens
vier Lektionen entstanden, die die Prüfung bestehen, im Browser funktionieren
und die drei Fragen aus Schritt 3 aushalten. Der Ingest ist reproduzierbar und
sein Manifest weist Herkunft und Auslassungen aus.

**Ausdrücklich nicht Teil des Kriteriums:** dass alle acht Prinzipien zu
Lektionen werden. Weniger und besser ist das Ziel.
