import { z } from 'astro/zod';
import { AufgabeSchema } from '../aufgaben/schema.ts';

/**
 * Das Lektions-Schema — bewusst frei von `astro:content`.
 *
 * Der Schnitt ist der Zweck dieser Datei: `src/content.config.ts` importiert
 * `astro:content` und ist damit von aussen nicht ladbar. Ein Import scheitert
 * auch unter Vitest mit „The 'astro:content' module is only available
 * server-side." — die wichtigste Qualitaetsschranke des Projekts liesse sich
 * also nicht im Unit-Test pruefen, und der Lektions-Compiler koennte
 * generierten Inhalt nicht vor dem Schreiben validieren.
 *
 * Hier steht deshalb nur Zod. `defineCollection` bleibt in content.config.ts.
 * Was eine Aufgabe ist, steht in `src/aufgaben/` — der Import traegt die
 * Endung `.ts`, weil `werkzeug/pruefe-lektion.mjs` diese Datei unter reinem
 * Node laedt.
 */

export const QuelleSchema = z.object({
  pfad: z.string().trim().min(1),
  url: z.url().optional(),
});
// Hinweis: z.string().url() ist in Zod 4 verworfen (ts(6385) beim Bauen).
// Deshalb hier direkt z.url().optional() verwendet.

export const LektionSchema = z
  .object({
    titel: z.string().trim().min(1),
    // Zeichenlaenge ist ein Naeherungsmass fuer „ein Satz". Eine Satzzaehlung
    // per Regex ist im Deutschen unzuverlaessig: „z. B.", „u. a." und „Nr. 7"
    // enthalten Punkte, die keine Satzenden sind.
    prinzip: z
      .string()
      .trim()
      .min(1)
      .max(200, 'prinzip soll ein Satz sein, kein Absatz (max. 200 Zeichen).'),
    // Der Vorbehalt kommt aus dem Lehrplan: Die Quelle behauptet etwas, das
    // sich nicht belegen laesst oder dem Stand der Forschung widerspricht.
    // Die Lektion zeigt ihn unter dem Satz — Pruefungsstoff bleibt lernbar,
    // ohne dass die App ihn als gesichert ausgibt. Gemessen wie `prinzip`.
    // Eigene Meldung fuer null: `vorbehalt:` ohne Wert liest YAML als null.
    vorbehalt: z
      .string({ error: 'vorbehalt ist Text — ohne Vorbehalt das Feld weglassen.' })
      .trim()
      .min(1, 'vorbehalt braucht einen Satz — sonst das Feld weglassen.')
      .max(200, 'vorbehalt soll ein Satz sein, kein Absatz (max. 200 Zeichen).')
      .optional(),
    reihenfolge: z.number().int().positive(),
    gesperrt: z.boolean().default(false),
    // Bis zur Aufgabenfamilie hiess das Feld `fragen`. Ein nicht-striktes
    // Objekt wuerde den alten Namen stillschweigend verwerfen, und uebrig
    // bliebe die Meldung „aufgaben fehlt" — ohne jeden Hinweis, was zu tun
    // ist. Migration statt stiller Voreinstellung: Der alte Name ist ein
    // Fehler mit Anleitung.
    fragen: z
      .unknown()
      .optional()
      .refine(
        (wert) => wert === undefined,
        'fragen heißt jetzt aufgaben, und jede Aufgabe braucht ein Feld typ (zum Beispiel typ: wahl).',
      ),
    // Zwei bis sechs. Frueher hoechstens vier Wahlfragen; mit vier Typen soll
    // eine Probe jeden einmal enthalten koennen und dazu zwei Wahlfragen fuer
    // die schnellen Unterscheidungen. Mehr als sechs sprengt eine Sitzung von
    // zehn Minuten, weil ein Fall allein mehrere Minuten braucht.
    aufgaben: z.array(AufgabeSchema).min(2).max(6),
    transfer: AufgabeSchema,
    quellen: z.array(QuelleSchema).min(1),
  })
  // `id` ist die stabile Identitaet einer Aufgabe, an der der Lernfortschritt
  // haengt. Kollidieren zwei, verschmilzt der Fortschritt zweier Aufgaben
  // lautlos — teuer und schwer zu bemerken. Die Transferaufgabe zaehlt mit.
  .refine(
    (l) => {
      const ids = [...l.aufgaben.map((a) => a.id), l.transfer.id];
      return new Set(ids).size === ids.length;
    },
    'aufgaben[].id und transfer.id müssen innerhalb der Lektion eindeutig sein.',
  );

export type Lektion = z.infer<typeof LektionSchema>;
