import { z } from 'astro/zod';
// Namentlich, nicht als Vorgabe-Import: js-yaml 5 liefert unter `import` ein
// ESM-Buendel ohne Default-Export. Siehe werkzeug/pruefe-lektion.mjs.
import { load as yamlLesen, YAMLException } from 'js-yaml';
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

/**
 * Das Muster einer Id. Auch der Kurzname einer Quelle folgt ihm — er ist der
 * Ordner unter `quellen/` und die `quelle` im Lehrplan; das Einlesen prueft
 * ihn mit genau diesem Muster.
 */
export const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const IdSchema = z.string().regex(ID, 'nur Kleinbuchstaben, Ziffern und Bindestrich.');

/**
 * Wie ein Feldname aussieht: ein Buchstabe, dann bis zu 40 Buchstaben,
 * Ziffern, Unterstriche oder Bindestriche. Nur ein Schluessel dieser Form
 * steht in einer Meldung — ein anderer koennte ein Satz von einer Folie sein,
 * und die Meldungen stehen auf der Konsole und auf der Bibliotheksseite.
 * Exportiert fuer werkzeug/pruefe-quelle.mjs: Dort steht ein Schluessel nach
 * derselben Regel im Namen eines Felds.
 */
export const FELDNAME = /^[A-Za-z][A-Za-z0-9_-]{0,40}$/;

/** `quelle` ist der Ordnername unter `quellen/` — dasselbe Muster wie eine Id, eigene Meldung. */
const QuelleSchema = z
  .string()
  .trim()
  .regex(ID, 'quelle ist der Kurzname des Ordners unter quellen/ — nur Kleinbuchstaben, Ziffern und Bindestrich.');

/** Der volle Commit-Hash aus dem Manifest eines Git-Repos — ein Kurz-SHA waere „anderer Stand", obwohl derselbe Commit gemeint ist. */
const RepoStandSchema = z
  .string()
  .trim()
  .regex(/^[0-9a-f]{40}$/, 'stand ist der volle Commit aus dem Manifest — 40 Zeichen aus 0–9 und a–f.');

/** Der sha256-Hash ueber die Originale aus dem Manifest von Buch und Folien. */
const LehrmaterialStandSchema = z
  .string()
  .trim()
  .regex(
    /^sha256:[0-9a-f]{64}$/,
    'stand ist der Hash aus dem Manifest — sha256: und 64 Zeichen aus 0–9 und a–f.',
  );

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

const WidgetSchema = z
  .string()
  .refine((n) => Object.prototype.hasOwnProperty.call(widgetPruefungen, n), 'kein bekannter Widget-Typ.');

/**
 * Ein Prinzip, wie es ein Repo-Lehrplan traegt. Seine Id benennt zugleich
 * seine Lektion: `inhalt/lektionen/<id>.mdx`, bei Repos wie bei Lehrmaterial.
 */
const RepoPrinzipSchema = z.strictObject({
  id: IdSchema,
  satz: z.string().trim().min(1).max(200, 'Ein Prinzip ist ein Satz, kein Absatz.'),
  warumNichtOffensichtlich: z.string().trim().min(1),
  belege: z
    .array(z.string().trim().min(1))
    .min(1, 'Jedes Prinzip braucht mindestens einen Beleg.'),
  widget: WidgetSchema,
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

/**
 * Das Prinzip bei Buch und Folien: dieselbe Form, nur `widget` optional. Eine
 * Folienlektion hat oft kein Widget — ihre Interaktion sind die Aufgaben.
 */
const LehrmaterialPrinzipSchema = RepoPrinzipSchema.extend({ widget: WidgetSchema.optional() });

const RepoSchema = z
  .strictObject({
    art: z.literal('repo'),
    quelle: QuelleSchema,
    stand: RepoStandSchema,
    geprueftVon: GeprueftVonSchema,
    geprueftAm: z.string().trim().min(1),
    prinzipien: z
      .array(RepoPrinzipSchema)
      .min(2)
      .max(HOECHSTZAHL, `höchstens ${HOECHSTZAHL} Prinzipien — verdichten, nicht katalogisieren.`),
  })
  .refine(
    (l) => new Set(l.prinzipien.map((p) => p.id)).size === l.prinzipien.length,
    'Zwei Prinzipien haben dieselbe id.',
  );

/** Seitenzahlen zaehlen ab 1, wie im Original. */
const SeiteSchema = z.number().int().min(1, 'Seiten zählen ab 1.');

/**
 * Migration statt „unbekanntes Feld": Bis Plan 2c-1 nannte ein Abschnitt
 * seine eine Lektion. Jetzt hat er je Prinzip eine, und die Lektion traegt
 * die Id ihres Prinzips — wie bei Repos.
 */
const LEKTION_ENTFAELLT =
  'lektion gibt es nicht mehr: Die Lektionen eines Abschnitts sind die seiner Prinzipien (Lektion-Id = Prinzip-Id).';

const AbschnittSchema = z
  .strictObject(
    {
      /** Reihenfolge-Praefix und Slug, etwa `m07-02-vertragsarten`. */
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
      prinzipien: z
        .array(LehrmaterialPrinzipSchema)
        .max(
          HOECHSTZAHL_JE_ABSCHNITT,
          `höchstens ${HOECHSTZAHL_JE_ABSCHNITT} Prinzipien je Abschnitt — ein Abschnitt mit mehr ist katalogisiert, nicht destilliert.`,
        )
        .default([]),
    },
    {
      error: (iss) =>
        iss.code === 'unrecognized_keys' && iss.keys.includes('lektion') ? LEKTION_ENTFAELLT : undefined,
    },
  )
  // Beide Richtungen fuer grund: Ein Grund ohne Ablehnung waere eine
  // Begruendung fuer nichts. Und der Status sagt, ob es Prinzipien gibt:
  // `offen` noch keine, `beauftragt` null bis drei (vor Durchgang A keine,
  // danach mindestens eines), `lektion` mindestens eines — zu jedem gibt es
  // die Lektion gleicher Id, das prueft `pruefeLektionen` —, `abgelehnt`
  // keines. Verworfene Prinzipien streicht der Mensch am Review-Gate.
  .superRefine((a, ctx) => {
    if (a.status === 'abgelehnt' && a.grund === undefined) {
      ctx.addIssue({ code: 'custom', path: ['grund'], message: 'Ein abgelehnter Abschnitt braucht einen Grund.' });
    }
    if (a.status !== 'abgelehnt' && a.grund !== undefined) {
      ctx.addIssue({ code: 'custom', path: ['grund'], message: 'grund steht nur bei status abgelehnt.' });
    }
    if (a.status === 'offen' && a.prinzipien.length > 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['prinzipien'],
        message: 'Ein offener Abschnitt hat noch keine Prinzipien — erst beauftragen, dann Durchgang A.',
      });
    }
    if (a.status === 'abgelehnt' && a.prinzipien.length > 0) {
      ctx.addIssue({ code: 'custom', path: ['prinzipien'], message: 'Ein abgelehnter Abschnitt hat keine Prinzipien.' });
    }
    if (a.status === 'lektion' && a.prinzipien.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['prinzipien'],
        message: 'Ein Abschnitt mit status lektion braucht mindestens ein Prinzip — seine Lektionen tragen dessen id.',
      });
    }
  });

type AbschnittRoh = z.infer<typeof AbschnittSchema>;

/**
 * Regeln ueber mehrere Abschnitte: eindeutige Ids — der Abschnitte und der
 * Prinzipien, denn eine Prinzip-Id benennt eine Lektionsdatei —, und je Datei
 * steigen die Seitenbereiche auf, ohne sich zu ueberschneiden. Sich
 * beruehrende Bereiche ueberschneiden sich — `[1, 5]` und `[5, 9]` teilen
 * Seite 5.
 */
function pruefeAbschnitte(l: { abschnitte: readonly AbschnittRoh[] }, ctx: z.RefinementCtx): void {
  const ids = new Set<string>();
  const prinzipIds = new Set<string>();
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

    a.prinzipien.forEach((p, j) => {
      if (prinzipIds.has(p.id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['abschnitte', i, 'prinzipien', j, 'id'],
          message: `Zwei Prinzipien haben die id ${p.id}.`,
        });
      }
      prinzipIds.add(p.id);
    });
  });
}

/** Was Buch und Folien teilen: eine Form, zwei Gliederer — die sind Sache des Adapters. */
const lehrmaterial = {
  quelle: QuelleSchema,
  titel: z.string().trim().min(1),
  /** Der Hash ueber die Originale, aus dem Manifest. */
  stand: LehrmaterialStandSchema,
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

/**
 * Wie das Buch, aber ohne ISBN und Auflage: `strictObject` weist beide zurueck
 * — mit einem Hinweis statt der blossen Meldung „unbekanntes Feld": Wer aus
 * einem Buch-Lehrplan kopiert, soll den Grund sofort sehen.
 */
const FolienSchema = z
  .strictObject(
    {
      art: z.literal('folien'),
      ...lehrmaterial,
    },
    {
      error: (iss) =>
        iss.code === 'unrecognized_keys' && (iss.keys.includes('isbn') || iss.keys.includes('auflage'))
          ? 'isbn und auflage stehen nur bei art: buch.'
          : undefined,
    },
  )
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
/** Die Form mit optionalem `widget` — ein Prinzip aus einem Repo passt hinein. */
export type Prinzip = z.infer<typeof LehrmaterialPrinzipSchema>;

/**
 * Die Ids aller Prinzipien eines Lehrplans, in ihrer Reihenfolge. Jede
 * benennt eine Lektion: `inhalt/lektionen/<id>.mdx`. Eine Lektion hat einen
 * Lehrplaneintrag, wenn ein gueltiger oder wartender Lehrplan ihre Id traegt.
 */
export function prinzipIdsVon(l: Lehrplan): string[] {
  return (l.art === 'repo' ? l.prinzipien : l.abschnitte.flatMap((a) => a.prinzipien)).map((p) => p.id);
}

/**
 * Das Ergebnis der Pruefung. Drei Faelle, nicht zwei: Ein Lehrplan, dem als
 * einziges die Freigabe fehlt, ist nicht ungueltig, sondern **wartend** — der
 * Zustand zwischen Durchgang A und dem Menschen am Review-Gate. Fuer den
 * Compiler bleibt er `ok: false`; die Seite /bibliothek zeigt seine Zahlen
 * und markiert ihn.
 */
export type Befund =
  | { ok: true; lehrplan: Lehrplan }
  | { ok: false; wartet: true; lehrplan: Lehrplan; maengel: string[] }
  // wartet ist hier optional, damit werkzeug/lehrplan.mjs mit seinem JSDoc-Typ { ok: false, maengel } unveraendert bleibt.
  | { ok: false; wartet?: false; maengel: string[] };

/** Zods Typnamen auf Deutsch, fuer die Meldung bei falscher Form. */
const ERWARTET: Readonly<Record<string, string>> = {
  string: 'Text',
  number: 'eine Zahl',
  int: 'eine ganze Zahl',
  array: 'eine Liste',
  tuple: 'eine Liste',
  object: 'einen Eintrag mit Feldern',
};

/** Zods eigene deutsche Uebersetzung — nur als Rueckfall, wenn unten keine Zeile greift. */
const localeErrorDe = z.locales?.de?.().localeError;

/**
 * Deutsche Meldung je Pruefung, als Rueckfall fuer `LehrplanSchema.safeParse`.
 *
 * Greift nur, wo das Schema selbst keine eigene Meldung traegt: Eine
 * Schema-Meldung (`.min(1, "…")`, ein eigenes `error` an Feld oder Objekt,
 * `ctx.addIssue({ message })`) gewinnt bei Zod 4 immer zuerst — das ist hier
 * mit einem kleinen Vorlauf-Test geprueft, nicht angenommen. Die Meldungen im
 * Schema selbst (`vorbehalt`, `geprueftVon`, `ART_FEHLT`, die Obergrenzen,
 * das Id-Muster, Seiten, `grund`, Status und Prinzipien, das alte Feld
 * `lektion`, doppelte Ids, Ueberschneidung) bleiben deshalb unveraendert.
 */
const deutscheMeldung: z.core.$ZodErrorMap = (iss) => {
  switch (iss.code) {
    case 'invalid_type': {
      if (iss.input === undefined) return 'fehlt.';
      if (iss.input === null) return 'ist leer.';
      return `hat die falsche Form — erwartet ${ERWARTET[iss.expected] ?? iss.expected}.`;
    }
    case 'too_small': {
      if (iss.origin === 'string') {
        return iss.minimum === 1 ? 'ist leer.' : `ist zu kurz — mindestens ${iss.minimum} Zeichen.`;
      }
      if (iss.origin === 'array') {
        return iss.minimum === 1
          ? 'braucht mindestens einen Eintrag.'
          : `braucht mindestens ${iss.minimum} Einträge.`;
      }
      if (iss.origin === 'number') return `muss mindestens ${iss.minimum} sein.`;
      break;
    }
    case 'too_big': {
      if (iss.origin === 'string') return `ist zu lang — höchstens ${iss.maximum} Zeichen.`;
      if (iss.origin === 'array') return `hat zu viele Einträge — höchstens ${iss.maximum}.`;
      break;
    }
    case 'invalid_value':
      return `ist nicht erlaubt — erlaubt: ${iss.values.join(', ')}.`;
    case 'unrecognized_keys': {
      // Ein Schluessel, der nicht wie ein Feldname aussieht, wird gezaehlt,
      // nie genannt: Er koennte ein Satz von einer Folie sein (FELDNAME).
      const nennbar = iss.keys.filter((schluessel) => FELDNAME.test(schluessel));
      const ohne = iss.keys.length - nennbar.length;
      if (iss.keys.length === 1) return ohne === 0 ? `unbekanntes Feld: ${iss.keys[0]}.` : 'unbekanntes Feld (kein Feldname).';
      const teile = ohne === 0 ? nennbar : [...nennbar, `${ohne} ohne Feldnamen`];
      return `unbekannte Felder: ${teile.join(', ')}.`;
    }
  }
  // Kein globales z.config: Das stellte jede andere Pruefung im Prozess mit um.
  return localeErrorDe?.(iss) ?? undefined;
};

/**
 * Ein Abschnitt aus Lehrmaterial mit `status: lektion` hat zu jedem seiner
 * Prinzipien die Lektion gleicher Id. Das kann Zod nicht wissen; deshalb
 * steht die Pruefung hier. Unter `beauftragt` fehlen Lektionen noch zu Recht:
 * Das ist der Zustand nach Durchgang A.
 */
function pruefeLektionen(lehrplan: Lehrplan, lektionsIds: ReadonlySet<string>): string[] {
  if (lehrplan.art === 'repo') return [];
  return lehrplan.abschnitte.flatMap((a, i) =>
    a.status !== 'lektion'
      ? []
      : a.prinzipien.flatMap((p, j) =>
          lektionsIds.has(p.id)
            ? []
            : [`abschnitte.${i}.prinzipien.${j}.id: Die Lektion ${p.id} gibt es nicht (inhalt/lektionen/${p.id}.mdx).`],
        ),
  );
}

/**
 * Die beiden Felder, deren Fehlen allein noch keinen ungueltigen Lehrplan ergibt.
 * Exportiert wie `fehltWirklich` fuer werkzeug/pruefe-quelle.mjs: Dort wartet
 * auch ein ungueltiger Lehrplan auf die Freigabe, wenn beide Felder nach
 * derselben Regel fehlen.
 */
export const FREIGABE = ['geprueftVon', 'geprueftAm'] as const;

/** Ein Wert, der die Schranke von `geprueftVon` passiert — nur fuer den zweiten Lesedurchgang. */
const FREIGABE_ERSATZ = 'wartet auf Freigabe';

/** Die Maengel eines Lesedurchgangs, je mit dem Pfad vorn — so zeigt die Seite sie woertlich. */
function alsMaengel(fehler: readonly z.core.$ZodIssue[]): string[] {
  return fehler.map((m) => `${m.path.join('.') || '(Wurzel)'}: ${m.message}`);
}

/**
 * Fehlt ein Freigabefeld wirklich? Nicht angelegt, `geprueftVon:` ohne Wert
 * (YAML liest daraus null), leer oder nur Leerzeichen. Alles andere — etwa
 * `geprueftAm: 20260924` als Zahl — steht schon da, nur in falscher Form.
 */
export function fehltWirklich(wert: unknown): boolean {
  return wert === undefined || wert === null || (typeof wert === 'string' && wert.trim() === '');
}

/**
 * Meldet dieser Mangel eine Freigabe, die wirklich fehlt? Ein Formfehler
 * zaehlt nicht dazu: Sonst verlangte die Karte einen Eintrag, der schon
 * dasteht.
 */
function fehlendeFreigabe(f: z.core.$ZodIssue, roh: Readonly<Record<string, unknown>>): boolean {
  return f.path.length === 1 && FREIGABE.some((name) => f.path[0] === name && fehltWirklich(roh[name]));
}

/**
 * Liest denselben Lehrplan noch einmal, diesmal mit gefuellter Freigabe. Das
 * bringt zweierlei: die uebrigen Felder — und die Maengel, die der erste
 * Lesedurchgang nicht sehen konnte. Steht die Freigabe als null da oder fehlt
 * sie, bricht Zod an diesem Feld ab und laesst die Pruefungen ueber den ganzen
 * Lehrplan aus: doppelte Ids, sich ueberschneidende Seitenbereiche. Die meldet
 * erst dieser Lesedurchgang — auch dann, wenn neben der Freigabe noch etwas
 * fehlt.
 *
 * Ein Lehrplan, der zurueckkommt, traegt die Freigabe so, wie sie im Lehrplan
 * steht — leer, wo sie fehlt; der Ersatzwert verlaesst die Funktion nie.
 */
function mitErsetzterFreigabe(
  roh: Readonly<Record<string, unknown>>,
): { ok: true; lehrplan: Lehrplan } | { ok: false; maengel: string[] } {
  const zweit = LehrplanSchema.safeParse(
    { ...roh, geprueftVon: FREIGABE_ERSATZ, geprueftAm: FREIGABE_ERSATZ },
    { error: deutscheMeldung },
  );
  if (!zweit.success) return { ok: false, maengel: alsMaengel(zweit.error.issues) };
  const lehrplan = zweit.data;
  lehrplan.geprueftVon = typeof roh.geprueftVon === 'string' ? roh.geprueftVon.trim() : '';
  lehrplan.geprueftAm = typeof roh.geprueftAm === 'string' ? roh.geprueftAm.trim() : '';
  return { ok: true, lehrplan };
}

/**
 * Prueft einen geladenen Lehrplan. Wirft nie.
 *
 * `lektionsIds` sind die Lektionen, die es gibt. Zu jedem Prinzip eines
 * Abschnitts mit `status: lektion` muss es die Lektion gleicher Id geben —
 * das kann Zod allein nicht wissen, deshalb steht die Pruefung hier und nicht
 * im Schema. Wer eine leere Menge hereinreicht, bekommt jedes solche Prinzip
 * als Mangel: Die Pruefung faellt im Zweifel durch, nie durch.
 */
export function pruefeLehrplan(daten: unknown, lektionsIds: ReadonlySet<string>): Befund {
  const geprueft = LehrplanSchema.safeParse(daten, { error: deutscheMeldung });
  if (geprueft.success) {
    const maengel = pruefeLektionen(geprueft.data, lektionsIds);
    return maengel.length > 0 ? { ok: false, maengel } : { ok: true, lehrplan: geprueft.data };
  }

  const fehler = geprueft.error.issues;
  const maengel = alsMaengel(fehler);
  // Fehlt die Freigabe wirklich, liest ein zweiter Durchgang mit ersetzter
  // Freigabe, was der erste nach ihr ausgelassen hat — auch neben weiteren
  // Maengeln: Sonst fehlte etwa eine doppelte Id, sobald noch etwas anderes
  // nicht stimmt.
  const roh = typeof daten === 'object' && daten !== null ? (daten as Readonly<Record<string, unknown>>) : null;
  if (roh === null || !fehler.some((f) => fehlendeFreigabe(f, roh))) return { ok: false, maengel };
  const zweit = mitErsetzterFreigabe(roh);
  // Alle Maengel, keiner doppelt — erst die Freigabe, dann die uebrigen, wie
  // Zod sie in einem Lauf meldet, wenn die Freigabe leer statt null ist.
  if (!zweit.ok) return { ok: false, maengel: [...new Set([...maengel, ...zweit.maengel])] };
  // Fehlt ausser der Freigabe nichts, ist der Lehrplan lesbar — und wartend.
  // Kommt ein weiterer Mangel heraus, bleibt er ungueltig und zeigt alle.
  const weitere = pruefeLektionen(zweit.lehrplan, lektionsIds);
  return weitere.length === 0 && fehler.every((f) => fehlendeFreigabe(f, roh))
    ? { ok: false, wartet: true, lehrplan: zweit.lehrplan, maengel }
    : { ok: false, maengel: [...maengel, ...weitere] };
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
    // `fehler.message` haengt bei js-yaml 5 einen mehrzeiligen Quelltextausschnitt
    // an — auf der Seite, die Maengel woertlich zeigt, unlesbar. Mit Zeile und
    // Spalte aus `mark` bleibt die Meldung eine Zeile.
    if (fehler instanceof YAMLException && fehler.mark) {
      const { line, column } = fehler.mark;
      return {
        ok: false,
        maengel: [`${name} ist kein gültiges YAML (Zeile ${line + 1}, Spalte ${column + 1}): ${fehler.reason}`],
      };
    }
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
 * `ungueltig`, und die Seite zeigt ihn als Warnung. Fehlt ihm nur die
 * Freigabe — der Zustand zwischen Durchgang A und dem Menschen —, steht er in
 * `wartend`: mit seinen Zahlen auf der Seite, aber markiert.
 *
 * Prinzip-Ids sind ueber alle Lehrplaene eindeutig, denn jede benennt eine
 * Lektionsdatei. Vergeben wird zweistufig, nicht nur nach Pfad: zuerst
 * bekommen die gueltigen (freigegebenen) Lehrplaene ihre Ids, in
 * Pfad-Reihenfolge, danach die wartenden, ebenfalls in Pfad-Reihenfolge — ein
 * freigegebener Lehrplan verliert seine Id also nie an einen wartenden, nur
 * weil dessen Datei alphabetisch frueher kommt. Traegt ein Lehrplan eine Id,
 * die schon ein frueherer derselben oder der vorigen Stufe traegt, wird er
 * ungueltig — mit einem Mangel je doppelter Id, hinter den Maengeln, die er
 * als wartender schon hat. Seine Ids zaehlen dann fuer die spaeteren nicht
 * mehr mit: Ein ungueltiger Lehrplan traegt nichts, auch dann nicht, wenn
 * gerade eine doppelte Id ihn selbst ungueltig gemacht hat — traegt ein
 * Lehrplan b zwei Ids X und Y und faellt wegen X durch, bleibt Y frei fuer
 * einen spaeteren Lehrplan c, als haette es b nie gegeben. Die Ausgabe-Listen
 * (`gueltig`, `wartend`, `ungueltig`) bleiben trotz der zwei Stufen in
 * Pfad-Reihenfolge.
 */
export function lehrplaeneAusTexten(
  texte: Readonly<Record<string, string>>,
  lektionsIds: ReadonlySet<string>,
): { gueltig: Lehrplan[]; wartend: Lehrplan[]; ungueltig: Ungueltig[] } {
  const eintraege = Object.entries(texte).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const gelesen = eintraege.map(([pfad, text]) => {
    const datei = pfad.slice(pfad.lastIndexOf('/') + 1);
    return { datei, befund: lehrplanAusYaml(text, lektionsIds, datei) };
  });

  /** Prinzip-Id -> die Datei des Lehrplans, der sie traegt. */
  const traeger = new Map<string, string>();
  /** Datei -> ihre Maengel durch Ids, die schon eine andere Datei traegt. */
  const doppelteIds = new Map<string, string[]>();

  /** Traegt die Ids eines gueltigen oder wartenden Lehrplans ein, wenn keine Id schon vergeben ist. */
  function eintragen(datei: string, lehrplan: Lehrplan): void {
    const ids = prinzipIdsVon(lehrplan);
    const doppelt = ids.flatMap((id) => {
      const andereDatei = traeger.get(id);
      return andereDatei === undefined
        ? []
        : [`(Wurzel): Die Prinzip-Id ${id} steht schon in ${andereDatei}; Lektion und Prinzip teilen sich die Id.`];
    });
    if (doppelt.length > 0) {
      doppelteIds.set(datei, doppelt);
      return;
    }
    for (const id of ids) traeger.set(id, datei);
  }

  // Erste Stufe: die gueltigen (freigegebenen) Lehrplaene, in Pfad-Reihenfolge.
  for (const { datei, befund } of gelesen) {
    if (befund.ok) eintragen(datei, befund.lehrplan);
  }
  // Zweite Stufe: die wartenden, ebenfalls in Pfad-Reihenfolge — sie bekommen
  // eine Id nur, wenn keine freigegebene Datei sie schon traegt.
  for (const { datei, befund } of gelesen) {
    if (!befund.ok && befund.wartet) eintragen(datei, befund.lehrplan);
  }

  // Dritter Durchgang, nur zum Einsammeln: Die zwei Stufen oben vergeben die
  // Ids, entscheiden also ueber gueltig/ungueltig — aber die Ausgabe-Listen
  // sollen in Pfad-Reihenfolge bleiben, nicht in Stufen-Reihenfolge.
  const gueltig: Lehrplan[] = [];
  const wartend: Lehrplan[] = [];
  const ungueltig: Ungueltig[] = [];
  for (const { datei, befund } of gelesen) {
    if (!befund.ok && !befund.wartet) {
      ungueltig.push({ datei, maengel: befund.maengel });
      continue;
    }
    const doppelt = doppelteIds.get(datei);
    if (doppelt !== undefined) {
      ungueltig.push({ datei, maengel: [...(befund.ok ? [] : befund.maengel), ...doppelt] });
      continue;
    }
    if (befund.ok) gueltig.push(befund.lehrplan);
    else wartend.push(befund.lehrplan);
  }
  return { gueltig, wartend, ungueltig };
}
