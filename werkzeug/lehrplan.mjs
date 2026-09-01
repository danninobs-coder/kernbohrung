import { readFileSync } from 'node:fs';
// Namentlich, nicht als Vorgabe-Import: js-yaml 5 liefert unter `import` ein
// ESM-Buendel ohne Default-Export. Siehe pruefe-lektion.mjs.
import { load as yamlLesen } from 'js-yaml';
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
  belege: z
    .array(z.string().trim().min(1))
    .min(1, 'Jedes Prinzip braucht mindestens einen Beleg.'),
  widget: z
    .string()
    .refine(
      (n) => Object.prototype.hasOwnProperty.call(widgetPruefungen, n),
      'kein bekannter Widget-Typ.',
    ),
});

const LehrplanSchema = z
  .strictObject({
    quelle: z.string().trim().min(1),
    stand: z.string().trim().min(7),
    // Die Meldung steht zweimal da, und das ist der Punkt: `.min(1, …)` greift
    // nur, wenn ein String da ist und zu kurz. Fehlt das Feld ganz — der
    // Regelfall, denn Durchgang A laesst es leer und YAML macht daraus `null` —
    // meldet Zod stattdessen sein englisches „expected string, received null".
    // Ausgerechnet der Satz, der den Zweck des Gates erklaert, erschiene dann
    // nie in dem Fall, fuer den er geschrieben wurde.
    geprueftVon: z
      .string({ error: 'geprueftVon fehlt — der Lehrplan ist das Review-Gate.' })
      .trim()
      .min(1, 'geprueftVon fehlt — der Lehrplan ist das Review-Gate.'),
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

/**
 * Die Typen als JSDoc, weil `astro check` mit `checkJs` auch `werkzeug/` liest.
 * `ok` steht literal da: sonst verbreitert TypeScript es zu `boolean`, die
 * Union ist nicht mehr unterscheidbar, und der Zugriff auf `lehrplan` oder
 * `maengel` gilt als Fehler — obwohl er zur Laufzeit richtig ist.
 *
 * @typedef {z.infer<typeof LehrplanSchema>} Lehrplan
 * @typedef {{ ok: true, lehrplan: Lehrplan }} Angenommen
 * @typedef {{ ok: false, maengel: string[] }} Abgelehnt
 * @typedef {Angenommen | Abgelehnt} Befund
 */

/**
 * @param {unknown} daten Der geladene Lehrplan — kommt aus YAML, ist also unbekannt
 * @returns {Befund}
 */
export function pruefeLehrplan(daten) {
  const geprueft = LehrplanSchema.safeParse(daten);
  if (geprueft.success) return { ok: true, lehrplan: geprueft.data };
  return {
    ok: false,
    maengel: geprueft.error.issues.map((m) => `${m.path.join('.') || '(Wurzel)'}: ${m.message}`),
  };
}

/**
 * Liest eine Lehrplandatei und prueft sie.
 *
 * Der YAML-Fehler wird gefangen und als Mangel gemeldet, nicht durchgereicht:
 * An dieser Datei sitzt am Review-Gate ein Mensch und traegt `geprueftVon` von
 * Hand ein. Ein Tippfehler ist dort wahrscheinlich — und soll eine Maengelliste
 * ergeben wie jeder andere Befund auch, keinen nackten Stapelabzug.
 *
 * @param {string} datei
 * @returns {Befund}
 */
export function liesLehrplan(datei) {
  // Lesen und Auswerten getrennt gefangen, nicht zusammen: Sonst meldet eine
  // fehlende Datei „ist kein gueltiges YAML" und schickt den Suchenden zur
  // falschen Baustelle. Der Fall ist nicht theoretisch — er ist beim ersten
  // Probelauf dieses Werkzeugs genau so aufgetreten.
  let text;
  try {
    text = readFileSync(datei, 'utf8');
  } catch (fehler) {
    const grund = fehler instanceof Error ? fehler.message : String(fehler);
    return { ok: false, maengel: [`${datei} laesst sich nicht lesen: ${grund}`] };
  }

  let daten;
  try {
    daten = yamlLesen(text);
  } catch (fehler) {
    // `fehler` ist unter `strict` vom Typ `unknown` — der Griff auf `.message`
    // braucht eine Verengung.
    const grund = fehler instanceof Error ? fehler.message : String(fehler);
    return { ok: false, maengel: [`${datei} ist kein gueltiges YAML: ${grund}`] };
  }

  return pruefeLehrplan(daten);
}
