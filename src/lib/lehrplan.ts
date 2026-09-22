import { z } from 'astro/zod';
// Namentlich, nicht als Vorgabe-Import: js-yaml 5 liefert unter `import` ein
// ESM-Buendel ohne Default-Export. Siehe werkzeug/pruefe-lektion.mjs.
import { load as yamlLesen } from 'js-yaml';
import { widgetPruefungen } from '../widgets/pruefung.ts';

/**
 * Der Lehrplan, Fassung 2 — eine diskriminierte Union ueber `art`.
 *
 * Der Lehrplan ist das Review-Gate: Wer ihn kontrolliert, kontrolliert die App.
 * Er stand bis Fassung 1 in `werkzeug/lehrplan.mjs`. Jetzt lesen ihn drei
 * Stellen: das Werkzeug unter reinem Node, die Seite /bibliothek zur Bauzeit
 * und — vorbereitet, nicht gebaut — ein Ausfuehrer im Browser, der dieselben
 * Statusfelder liest. Deshalb steht hier kein Dateizugriff; das Lesen der
 * Datei bleibt in `werkzeug/lehrplan.mjs`.
 *
 * Relative Importe tragen die Endung `.ts`: `werkzeug/lehrplan.mjs` laedt
 * diese Datei unter reinem Node, und Node loest Importe ohne Endung nicht auf
 * (siehe `tests/node-ladbarkeit-lehrplan.test.ts`).
 */

/**
 * Obergrenze fuer Repos. Die Aufgabe von Durchgang A ist zu verdichten, nicht
 * zu katalogisieren: Vierundzwanzig Varianten sollen zu einer Handvoll
 * Prinzipien werden. Wer neunzehn findet, hat zusammengefasst statt
 * destilliert. Fuer Lehrmaterial gilt sie nicht — dort tritt an ihre Stelle
 * die Pflicht, jeden Abschnitt zu entscheiden.
 */
export const HOECHSTZAHL = 8;

/** Je Abschnitt aus Lehrmaterial. Ein Abschnitt mit zehn Prinzipien ist katalogisiert, nicht destilliert. */
export const HOECHSTZAHL_JE_ABSCHNITT = 3;

/**
 * Der Weg eines Abschnitts: `offen` nach dem Einlesen, `beauftragt` fuer den
 * naechsten Durchgang, danach `lektion` oder `abgelehnt` — nie beides, nie
 * keines. Der Auftrag an den Compiler ist keine eigene Datei, sondern die
 * Menge der Abschnitte mit `beauftragt`.
 */
export const STATUS = ['offen', 'beauftragt', 'lektion', 'abgelehnt'] as const;
export type Status = (typeof STATUS)[number];

const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const IdSchema = z.string().regex(ID, 'nur Kleinbuchstaben, Ziffern und Bindestrich.');

/**
 * Die Meldung steht zweimal da, und das ist der Punkt: `.min(1, …)` greift
 * nur, wenn ein String da ist und zu kurz. Fehlt das Feld ganz — der
 * Regelfall, denn Durchgang A laesst es leer und YAML macht daraus `null` —
 * meldet Zod stattdessen sein englisches „expected string, received null".
 * Ausgerechnet der Satz, der den Zweck des Gates erklaert, erschiene dann nie
 * in dem Fall, fuer den er geschrieben wurde.
 */
const GeprueftVonSchema = z
  .string({ error: 'geprueftVon fehlt — der Lehrplan ist das Review-Gate.' })
  .trim()
  .min(1, 'geprueftVon fehlt — der Lehrplan ist das Review-Gate.');

const PrinzipSchema = z.strictObject({
  id: IdSchema,
  satz: z.string().trim().min(1).max(200, 'Ein Prinzip ist ein Satz, kein Absatz.'),
  warumNichtOffensichtlich: z.string().trim().min(1),
  belege: z
    .array(z.string().trim().min(1))
    .min(1, 'Jedes Prinzip braucht mindestens einen Beleg.'),
  widget: z
    .string()
    .refine(
      (n) => Object.prototype.hasOwnProperty.call(widgetPruefungen, n),
      'kein bekannter Widget-Typ.',
    ),
  /**
   * Die Quelle behauptet etwas, das sich nicht belegen laesst oder dem Stand
   * der Forschung widerspricht. Ein Satz. Er wandert in die Lektion und steht
   * dort unter dem Satz: Pruefungsstoff bleibt lernbar, ohne dass die App ihn
   * als gesichert ausgibt. Nie stillschweigend lehren, nie stillschweigend
   * weglassen.
   */
  // Eigene Meldung fuer null: `vorbehalt:` ohne Wert liest YAML als null.
  vorbehalt: z
    .string({ error: 'Ein Vorbehalt ist Text — ohne Vorbehalt das Feld weglassen.' })
    .trim()
    .min(1, 'Ein Vorbehalt braucht einen Satz — sonst das Feld weglassen.')
    .max(200, 'Ein Vorbehalt ist ein Satz, kein Absatz.')
    .optional(),
});

const RepoSchema = z
  .strictObject({
    art: z.literal('repo'),
    quelle: z.string().trim().min(1),
    stand: z.string().trim().min(7),
    geprueftVon: GeprueftVonSchema,
    geprueftAm: z.string().trim().min(1),
    prinzipien: z
      .array(PrinzipSchema)
      .min(2)
      .max(HOECHSTZAHL, `höchstens ${HOECHSTZAHL} Prinzipien — verdichten, nicht katalogisieren.`),
  })
  .refine(
    (l) => new Set(l.prinzipien.map((p) => p.id)).size === l.prinzipien.length,
    'Zwei Prinzipien haben dieselbe id.',
  );

/** Seitenzahlen zaehlen ab 1, wie im Original. */
const SeiteSchema = z.number().int().min(1, 'Seiten zählen ab 1.');

const AbschnittSchema = z
  .strictObject({
    /** Reihenfolge-Praefix und Slug, etwa `m07-2-vertragsarten`. */
    id: IdSchema,
    titel: z.string().trim().min(1),
    /**
     * Immer Pflicht, nicht erst bei mehreren Originalen: Wie viele Originale
     * es gibt, steht im Manifest, und das kennt dieses Schema nicht. Und der
     * Compiler muss fuer jede Bildseite wissen, welche Datei er oeffnet.
     */
    datei: z.string().trim().min(1),
    seiten: z
      .tuple([SeiteSchema, SeiteSchema])
      .refine(([von, bis]) => von <= bis, 'seiten: erst die erste, dann die letzte Seite.'),
    status: z.enum(STATUS),
    grund: z.string().trim().min(1).optional(),
    lektion: IdSchema.optional(),
    prinzipien: z
      .array(PrinzipSchema)
      .max(
        HOECHSTZAHL_JE_ABSCHNITT,
        `höchstens ${HOECHSTZAHL_JE_ABSCHNITT} Prinzipien je Abschnitt — ein Abschnitt mit mehr ist katalogisiert, nicht destilliert.`,
      )
      .default([]),
  })
  // Beide Richtungen, je fuer grund und lektion: Ein Grund ohne Ablehnung
  // waere eine Begruendung fuer nichts, eine Lektion neben `offen` eine
  // Abdeckung, die niemand beschlossen hat.
  .superRefine((a, ctx) => {
    if (a.status === 'abgelehnt' && a.grund === undefined) {
      ctx.addIssue({ code: 'custom', path: ['grund'], message: 'Ein abgelehnter Abschnitt braucht einen Grund.' });
    }
    if (a.status !== 'abgelehnt' && a.grund !== undefined) {
      ctx.addIssue({ code: 'custom', path: ['grund'], message: 'grund steht nur bei status abgelehnt.' });
    }
    if (a.status === 'lektion' && a.lektion === undefined) {
      ctx.addIssue({ code: 'custom', path: ['lektion'], message: 'Ein Abschnitt mit status lektion nennt seine Lektion.' });
    }
    if (a.status !== 'lektion' && a.lektion !== undefined) {
      ctx.addIssue({ code: 'custom', path: ['lektion'], message: 'lektion steht nur bei status lektion.' });
    }
  });

type AbschnittRoh = z.infer<typeof AbschnittSchema>;

/**
 * Regeln ueber mehrere Abschnitte: eindeutige Ids, und je Datei steigen die
 * Seitenbereiche auf, ohne sich zu ueberschneiden. Sich beruehrende Bereiche
 * ueberschneiden sich — `[1, 5]` und `[5, 9]` teilen Seite 5.
 */
function pruefeAbschnitte(l: { abschnitte: readonly AbschnittRoh[] }, ctx: z.RefinementCtx): void {
  const ids = new Set<string>();
  const ende = new Map<string, number>();
  l.abschnitte.forEach((a, i) => {
    if (ids.has(a.id)) {
      ctx.addIssue({ code: 'custom', path: ['abschnitte', i, 'id'], message: `Zwei Abschnitte haben die id ${a.id}.` });
    }
    ids.add(a.id);

    const bisher = ende.get(a.datei);
    if (bisher !== undefined && a.seiten[0] <= bisher) {
      ctx.addIssue({
        code: 'custom',
        path: ['abschnitte', i, 'seiten'],
        message: `Seitenbereiche steigen je Datei auf und überschneiden sich nicht: ${a.id} beginnt auf Seite ${a.seiten[0]}, der Abschnitt davor in ${a.datei} endet auf Seite ${bisher}.`,
      });
    }
    ende.set(a.datei, Math.max(bisher ?? 0, a.seiten[1]));
  });
}

/** Was Buch und Folien teilen: eine Form, zwei Gliederer — die sind Sache des Adapters. */
const lehrmaterial = {
  quelle: z.string().trim().min(1),
  titel: z.string().trim().min(1),
  /** Der Hash ueber die Originale, aus dem Manifest. */
  stand: z.string().trim().min(7),
  geprueftVon: GeprueftVonSchema,
  geprueftAm: z.string().trim().min(1),
  abschnitte: z.array(AbschnittSchema).min(1, 'Ein Lehrplan aus Lehrmaterial hat mindestens einen Abschnitt.'),
};

const BuchSchema = z
  .strictObject({
    art: z.literal('buch'),
    ...lehrmaterial,
    isbn: z.string().trim().min(1).optional(),
    auflage: z.string().trim().min(1).optional(),
  })
  .superRefine(pruefeAbschnitte);

/** Wie das Buch, aber ohne ISBN und Auflage: `strictObject` weist beide zurueck. */
const FolienSchema = z
  .strictObject({
    art: z.literal('folien'),
    ...lehrmaterial,
  })
  .superRefine(pruefeAbschnitte);

/**
 * Die Meldung fuer einen Lehrplan ohne oder mit unbekanntem `art`. Migration
 * statt stiller Voreinstellung: Wer einen Lehrplan aus Fassung 1 in die Hand
 * bekommt, erfaehrt, was einzutragen ist, statt Zods „Invalid discriminator".
 */
export const ART_FEHLT =
  'art fehlt oder ist unbekannt — erlaubt sind repo, buch und folien. Ein Lehrplan aus einem Git-Repo trägt art: repo.';

export const LehrplanSchema = z.discriminatedUnion('art', [RepoSchema, BuchSchema, FolienSchema], {
  // Nur der Diskriminator bekommt den eigenen Satz. Fuer alles andere —
  // etwa `null` statt eines Objekts — bleibt Zods eigene Meldung.
  error: (issue) => (issue.code === 'invalid_union' ? ART_FEHLT : undefined),
});

export type Lehrplan = z.infer<typeof LehrplanSchema>;
type Lehrmaterial = Extract<Lehrplan, { art: 'buch' | 'folien' }>;
export type Abschnitt = Lehrmaterial['abschnitte'][number];
export type Prinzip = z.infer<typeof PrinzipSchema>;

export type Befund = { ok: true; lehrplan: Lehrplan } | { ok: false; maengel: string[] };

/**
 * Prueft einen geladenen Lehrplan. Wirft nie.
 *
 * `lektionsIds` sind die Lektionen, die es gibt. Ein Abschnitt mit
 * `status: lektion` muss auf eine davon zeigen — das kann Zod allein nicht
 * wissen, deshalb steht die Pruefung hier und nicht im Schema. Wer eine leere
 * Menge hereinreicht, bekommt jeden solchen Abschnitt als Mangel: Die Pruefung
 * faellt im Zweifel durch, nie durch.
 */
export function pruefeLehrplan(daten: unknown, lektionsIds: ReadonlySet<string>): Befund {
  const geprueft = LehrplanSchema.safeParse(daten);
  if (!geprueft.success) {
    return {
      ok: false,
      maengel: geprueft.error.issues.map((m) => `${m.path.join('.') || '(Wurzel)'}: ${m.message}`),
    };
  }
  const lehrplan = geprueft.data;
  if (lehrplan.art === 'repo') return { ok: true, lehrplan };

  const maengel = lehrplan.abschnitte.flatMap((a, i) =>
    a.lektion !== undefined && !lektionsIds.has(a.lektion)
      ? [`abschnitte.${i}.lektion: Die Lektion ${a.lektion} gibt es nicht (inhalt/lektionen/${a.lektion}.mdx).`]
      : [],
  );
  return maengel.length > 0 ? { ok: false, maengel } : { ok: true, lehrplan };
}

/**
 * Liest einen Lehrplan aus YAML-Text und prueft ihn. Wirft nie.
 *
 * Der YAML-Fehler wird als Mangel gemeldet, nicht durchgereicht: An dieser
 * Datei sitzt am Review-Gate ein Mensch und traegt `geprueftVon` von Hand ein.
 * Ein Tippfehler ist dort wahrscheinlich — er soll eine Maengelliste ergeben
 * wie jeder andere Befund auch, keinen nackten Stapelabzug.
 */
export function lehrplanAusYaml(text: string, lektionsIds: ReadonlySet<string>, name: string): Befund {
  let daten: unknown;
  try {
    daten = yamlLesen(text);
  } catch (fehler) {
    const grund = fehler instanceof Error ? fehler.message : String(fehler);
    return { ok: false, maengel: [`${name} ist kein gültiges YAML: ${grund}`] };
  }
  return pruefeLehrplan(daten, lektionsIds);
}

/** Ein Lehrplan, der die Pruefung nicht besteht — die Seite zeigt ihn mit seinen Maengeln. */
export type Ungueltig = { readonly datei: string; readonly maengel: readonly string[] };

/**
 * Liest alle Lehrplaene, wie sie `import.meta.glob` liefert: Pfad -> Text.
 *
 * Nach Pfad sortiert, mit eigenem Vergleich statt `localeCompare` — das haengt
 * an der Spracheinstellung des Rechners, und der Bau soll ueberall dieselbe
 * Seite ergeben. Ein ungueltiger Lehrplan bricht nichts ab: Er landet in
 * `ungueltig`, und die Seite zeigt ihn als Warnung. Das ist auch der Zustand
 * zwischen Durchgang A und der Freigabe, in dem `geprueftVon` leer ist.
 */
export function lehrplaeneAusTexten(
  texte: Readonly<Record<string, string>>,
  lektionsIds: ReadonlySet<string>,
): { gueltig: Lehrplan[]; ungueltig: Ungueltig[] } {
  const gueltig: Lehrplan[] = [];
  const ungueltig: Ungueltig[] = [];
  const eintraege = Object.entries(texte).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  for (const [pfad, text] of eintraege) {
    const datei = pfad.slice(pfad.lastIndexOf('/') + 1);
    const befund = lehrplanAusYaml(text, lektionsIds, datei);
    if (befund.ok) gueltig.push(befund.lehrplan);
    else ungueltig.push({ datei, maengel: befund.maengel });
  }
  return { gueltig, ungueltig };
}
