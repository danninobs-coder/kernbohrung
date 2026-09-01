/**
 * Die eine Stelle, an der Widget-Parameter geprüft werden.
 *
 * **Importregel:** Diese Datei darf ausschließlich `astro/zod` und `./schema.ts`
 * importieren — kein React, kein `astro:content`, keine `.astro`-Datei. Das ist
 * kein Stilwunsch, sondern ihr Zweck: `src/widgets/index.ts` bildet Widget-Namen
 * auf `.astro`-Hüllen ab und ist aus einem reinen Node-Prozess nicht ladbar
 * (`Unknown file extension ".astro"`). Der Lektions-Compiler aus Abschnitt 2
 * läuft aber in genau so einem Prozess: Er sieht `<Pipeline …/>` im erzeugten
 * Rumpf und braucht einen programmatischen Weg vom Namen zum Schema — sonst
 * müsste er die Zuordnung fest verdrahten und driftet ab Widget zwei.
 *
 * Gemessen: `node --input-type=module -e "import('file:///…/pruefung.ts')"`
 * lädt die Datei samt `./schema.ts` über Node-Type-Stripping, ohne Bundler.
 * `tests/widget-pruefung.test.ts` hält die Importregel fest.
 */

// Nur als Typ: `z` wird hier ausschliesslich in Typpositionen benutzt
// (`z.ZodType`, `z.infer`). `verbatimModuleSyntax` verlangt dafuer `import type`
// - und der Nebeneffekt passt zum Zweck der Datei: zur Laufzeit bleibt allein
// die Abhaengigkeit auf ./schema.ts uebrig.
import type { z } from 'astro/zod';
// Mit Dateiendung, anders als sonst im Projekt: Node loest relative Importe
// ohne Endung nicht auf (ERR_MODULE_NOT_FOUND), Vite und Astro schon. Genau
// dieser Unterschied wuerde die Datei fuer einen reinen Node-Prozess unbrauchbar
// machen - und das ist ihr einziger Zweck. `allowImportingTsExtensions` ist in
// astro/tsconfigs/base gesetzt, die Endung stoert `astro check` also nicht.
import { PipelineProps, fehlendeKombinationen, type PipelineDaten } from './schema.ts';

/**
 * Schlüssel, die kein Widget-Parameter sein können, sondern vom Framework
 * stammen.
 *
 * `children` ist der gemessene Fall und der Grund, dass es diese Liste gibt:
 * Astro reicht `children` serverseitig nicht mit, React bei der Hydration schon.
 * Ohne das Verwerfen weist `z.strictObject` den Schlüssel ab und das Widget
 * kippt **im Browser** in den Fehlerkasten — bei grünen Tests, grünem
 * `astro check` und unauffälligem server-gerendertem HTML. Der Fehler ist dem
 * Projekt schon einmal passiert.
 *
 * Er wird deshalb hier verworfen und nicht in der Komponente: Widget zwei bis
 * sieben müssten die Zeile sonst abschreiben, und wer sie vergisst, merkt es
 * erst im laufenden Browser.
 *
 * `key` und `ref` stehen vorsorglich daneben — React verbraucht beide selbst,
 * sie können also nie als Widget-Parameter gemeint sein. Die Liste bleibt
 * bewusst kurz: jeder weitere Eintrag ist ein Loch in der strictObject-Schranke.
 */
const RAUSCHEN: readonly string[] = ['children', 'key', 'ref'];

/**
 * Eine Zusatzprüfung prüft inhaltliche Bedingungen, die ein Zod-Schema nicht
 * ausdrücken kann. Sie läuft erst **nach** erfolgreicher Schemaprüfung und
 * bekommt deshalb bereits geparste Daten — mit gesetzten Standardwerten.
 *
 * Rückgabe: leere Liste heißt „in Ordnung". Sonst je Mangel ein deutscher Satz
 * ohne Widget-Namen davor; den setzt `pruefeWidget` einheitlich vor.
 */
export type Zusatzpruefung<Daten> = (daten: Daten) => readonly string[];

/**
 * `any` ist hier Absicht und kein Versehen: Die Registry ist heterogen — jedes
 * Widget hat einen anderen Datentyp. Mit `unknown` wäre `Zusatzpruefung<Daten>`
 * wegen der Kontravarianz von Funktionsparametern nicht mehr zuweisbar, und die
 * Einträge müssten ihre Typen einzeln wegcasten. Die Genauigkeit bleibt an der
 * Stelle erhalten, an der sie zählt: `widgetPruefungen` wird ohne Weitung
 * abgeleitet, `pruefeWidget('Pipeline', …)` liefert `PipelineDaten`.
 */
type Pruefeintrag<Daten = any> = {
  readonly schema: z.ZodType<Daten>;
  readonly zusatz?: Zusatzpruefung<Daten>;
};

/**
 * Name → Schema (+ optionale Zusatzprüfung).
 *
 * Der Name ist derselbe, den der MDX-Rumpf benutzt und den
 * `src/widgets/index.ts` auf die Astro-Hülle abbildet. Beide Registries müssen
 * dieselben Schlüssel tragen; `tests/widget-registry.test.ts` hält das fest.
 */
export const widgetPruefungen = {
  Pipeline: {
    schema: PipelineProps,
    /**
     * Die inhaltliche Bedingung, die das Widget-Schema laut Plan trägt: **jede
     * Kombination zuschaltbarer Schritte braucht ein hinterlegtes Ergebnis.**
     * Zod kann das nicht ausdrücken — ein Widget mit drei Schaltern und einem
     * einzigen Ergebnis ist strukturell tadellos und zeigt im Betrieb sieben
     * Löcher.
     */
    zusatz: (daten: PipelineDaten): readonly string[] => {
      const fehlend = fehlendeKombinationen(daten);
      if (fehlend.length === 0) return [];

      const optionale = daten.schritte.filter((s) => s.optional).length;
      return [
        `ergebnisse — für ${fehlend.length} von ${2 ** optionale} Kombinationen ` +
          `zuschaltbarer Schritte ist kein Ergebnis hinterlegt: ${fehlend.join(', ')}. ` +
          `Jede Kombination braucht einen Eintrag in ergebnisse, sonst zeigt das ` +
          `Widget dort „kein Ergebnis hinterlegt".`,
      ];
    },
  },
} satisfies Record<string, Pruefeintrag>;

export type WidgetName = keyof typeof widgetPruefungen;

export type PruefErgebnis<Daten = unknown> =
  | { readonly ok: true; readonly daten: Daten }
  | { readonly ok: false; readonly maengel: readonly string[] };

/**
 * Genau die Felder eines Zod-Mangels, die für eine deutsche Meldung gebraucht
 * werden. Strukturell beschrieben statt aus Zod importiert, damit ein
 * umbenannter Zod-Typ diese Datei nicht mitreißt.
 */
type ZodMangel = {
  readonly code: string;
  readonly message: string;
  readonly path: readonly PropertyKey[];
  readonly keys?: readonly string[];
  readonly expected?: string;
  readonly origin?: string;
  readonly minimum?: unknown;
  readonly maximum?: unknown;
};

/** `['schritte', 0, 'id']` → `schritte[0].id`. Leerer Pfad → leerer String. */
function pfadAlsText(pfad: readonly PropertyKey[]): string {
  let text = '';
  for (const teil of pfad) {
    if (typeof teil === 'number') text += `[${teil}]`;
    else text += text === '' ? String(teil) : `.${String(teil)}`;
  }
  return text;
}

/**
 * Deutsche Beschreibung eines Zod-Mangels.
 *
 * Die Zod-Vorgaben sind englisch und blass („Invalid input", „Too small"). Diese
 * Meldungen sind aber das, was ein Generator in Abschnitt 2 in seiner
 * Reparaturschleife zurückbekommt — sie müssen sagen, was falsch ist. Wo das
 * Schema selbst eine Meldung mitgibt (`regex`, `refine`), wird sie übernommen:
 * die ist bereits deutsch und genauer als alles, was hier stünde.
 */
function beschreibung(mangel: ZodMangel): string {
  switch (mangel.code) {
    case 'unrecognized_keys': {
      const keys = mangel.keys ?? [];
      const liste = keys.map((k) => `"${k}"`).join(', ');
      return keys.length === 1
        ? `unbekanntes Feld ${liste} — das Widget-Schema kennt es nicht.`
        : `unbekannte Felder ${liste} — das Widget-Schema kennt sie nicht.`;
    }
    case 'invalid_type':
      return `falscher Typ, erwartet wird ${mangel.expected ?? 'ein anderer Wert'}.`;
    case 'too_small':
      return mangel.origin === 'array'
        ? `zu wenige Einträge, mindestens ${String(mangel.minimum)} verlangt.`
        : mangel.origin === 'string'
          ? `zu kurz, mindestens ${String(mangel.minimum)} Zeichen verlangt (leer oder nur Leerraum reicht nicht).`
          : mangel.message;
    case 'too_big':
      return mangel.origin === 'array'
        ? `zu viele Einträge, höchstens ${String(mangel.maximum)} erlaubt.`
        : mangel.origin === 'string'
          ? `zu lang, höchstens ${String(mangel.maximum)} Zeichen erlaubt.`
          : mangel.message;
    case 'invalid_format':
      return `ungültiges Format, ${mangel.message}`;
    default:
      // `custom` landet hier: die .refine()-Meldungen in schema.ts sind bereits
      // deutsche Sätze.
      return mangel.message;
  }
}

/** `Pipeline: schritte[0].id — ungültiges Format: …` */
function alsMeldung(name: string, mangel: ZodMangel): string {
  const pfad = pfadAlsText(mangel.path);
  const text = beschreibung(mangel);
  return pfad === '' ? `${name}: ${text}` : `${name}: ${pfad} — ${text}`;
}

/**
 * Entfernt Framework-Rauschen, bevor geprüft wird. Nicht-Objekte gehen
 * unverändert durch — die weist das Schema selbst ab, und zwar mit einer
 * besseren Meldung, als hier zu erfinden wäre.
 */
function ohneRauschen(props: unknown): unknown {
  if (props === null || typeof props !== 'object' || Array.isArray(props)) return props;

  const rest: Record<string, unknown> = {};
  for (const [schluessel, wert] of Object.entries(props)) {
    if (RAUSCHEN.includes(schluessel)) continue;
    rest[schluessel] = wert;
  }
  return rest;
}

/**
 * Prüft die Parameter eines Widget-Aufrufs.
 *
 * Bei Erfolg kommen die **geparsten** Daten zurück, nicht die Eingabe: Zod setzt
 * dabei die Standardwerte (`optional`, `standardAn`, `einheit`), der Aufrufer
 * kann sie also direkt verwenden.
 *
 * Bei Misserfolg kommen lesbare deutsche Meldungen zurück. Sie sind das, was ein
 * Generator in Abschnitt 2 in seiner Reparaturschleife zurückbekommt.
 */
export function pruefeWidget<N extends WidgetName>(
  name: N,
  props: unknown,
): PruefErgebnis<z.infer<(typeof widgetPruefungen)[N]['schema']>>;
export function pruefeWidget(name: string, props: unknown): PruefErgebnis;
export function pruefeWidget(name: string, props: unknown): PruefErgebnis {
  // `Object.hasOwn` statt eines Zugriffs mit undefined-Vergleich: sonst löste
  // ein Widget namens "toString" oder "constructor" auf Object.prototype auf
  // und die Zeile darunter griffe auf `schema` einer Funktion zu.
  if (!Object.hasOwn(widgetPruefungen, name)) {
    const bekannt = Object.keys(widgetPruefungen).join(', ');
    return {
      ok: false,
      maengel: [
        `Unbekanntes Widget "${name}" — es gibt keine Prüfung dafür. ` +
          `Bekannt sind: ${bekannt}.`,
      ],
    };
  }

  const eintrag = (widgetPruefungen as Record<string, Pruefeintrag>)[name]!;
  const geprueft = eintrag.schema.safeParse(ohneRauschen(props));

  if (!geprueft.success) {
    return { ok: false, maengel: geprueft.error.issues.map((m) => alsMeldung(name, m)) };
  }

  // Erst hier, nicht vorher: die Zusatzprüfung rechnet mit vollständigen Daten
  // samt Standardwerten. Der Typ ist durch das gerade gelaufene Schema gedeckt.
  const zusatzMaengel = eintrag.zusatz?.(geprueft.data) ?? [];
  if (zusatzMaengel.length > 0) {
    return { ok: false, maengel: zusatzMaengel.map((m) => `${name}: ${m}`) };
  }

  return { ok: true, daten: geprueft.data };
}
