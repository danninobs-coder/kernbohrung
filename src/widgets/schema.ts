import { z } from 'astro/zod';

/**
 * Erlaubter Zeichensatz für Schritt-Ids — Kleinbuchstaben, Ziffern, einzelne
 * Bindestriche als Trenner.
 *
 * Existiert, damit `schluessel()` eindeutig bleibt: dort werden Ids mit `+`
 * verkettet. Enthielte eine Id selbst ein `+`, wären `['a+b', 'c']` und
 * `['a', 'b+c']` derselbe Schlüssel. Die Regel muss deshalb an *beiden*
 * Stellen gelten, an denen Schritt-Ids auftreten: bei ihrer Definition
 * (`SchrittSchema.id`) und bei ihrer Verwendung (`ErgebnisSchema.wenn`).
 */
const ID_MUSTER = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const ID_MELDUNG =
  'nur Kleinbuchstaben, Ziffern und Bindestrich - keine Leerzeichen oder Sonderzeichen.';

/**
 * Kanonischer Schlüssel einer Menge aktiver Schritt-Ids.
 *
 * Steht bewusst vor den Schema-Definitionen: PipelineProps prüft damit, ob
 * zwei Einträge in `ergebnisse` für dieselbe Kombination gelten.
 *
 * Das Trennzeichen `+` ist nur eindeutig, solange keine Id selbst ein `+`
 * enthält. Dafür sorgt ID_MUSTER.
 */
export function schluessel(ids: readonly string[]): string {
  return [...ids].sort().join('+');
}

// strictObject statt object: ein Zusatzfeld ist hier kein harmloser Beifang,
// sondern das wahrscheinlichste Symptom eines halluzinierenden Generators.
// Lautlos verwerfen hiesse, den Fehler zu verstecken. Gemessen: Astro reicht
// exakt die Schluessel des Aufrufers weiter, Slot-Inhalt geht getrennt nach
// Astro.slots - die Verschaerfung trifft also keinen legitimen Fall.
export const SchrittSchema = z.strictObject({
  id: z.string().regex(ID_MUSTER, ID_MELDUNG),
  titel: z.string().trim().min(1),
  wirkung: z.string().trim().min(1),
  optional: z.boolean().default(false),
  standardAn: z.boolean().default(true),
});

export const AusgabeZeileSchema = z.strictObject({
  text: z.string().trim().min(1),
  treffer: z.boolean(),
});

export const ErgebnisSchema = z
  .strictObject({
    // Dasselbe Muster wie SchrittSchema.id: ein `+` zerlegt den Schluessel
    // hier genauso wie dort.
    wenn: z.array(z.string().regex(ID_MUSTER, ID_MELDUNG)),
    ausgabe: z.array(AusgabeZeileSchema).min(1),
    hinweis: z.string().trim().min(1),
  })
  .refine(
    (e) => new Set(e.ausgabe.map((zeile) => zeile.text)).size === e.ausgabe.length,
    {
      // Die Komponente nutzt den Text als React-key. Doppelte Texte ergaeben
      // doppelte keys - eine Warnung zur Laufzeit statt eines Befunds hier.
      // Verglichen wird der bereits getrimmte Wert, genau der wird key.
      message: 'Zwei Zeilen in ausgabe haben denselben Text.',
      path: ['ausgabe'],
    },
  );

export const PipelineProps = z
  .strictObject({
    einheit: z.string().trim().min(1).default('Dokument'),
    // Deutsche Plurale sind unregelmaessig: "Dokument" + "en" traegt,
    // "Passage" + "en" und "Chunk" + "en" nicht. Wo die Anhaengeregel
    // scheitert, wird der Plural ausgeschrieben.
    einheitPlural: z.string().trim().min(1).optional(),
    // Das Maximum deckelt die 2^n-Laufzeit von fehlendeKombinationen und ist
    // zugleich didaktisch sinnvoll: mehr als acht Stufen liest niemand mehr.
    schritte: z.array(SchrittSchema).min(2).max(8),
    ergebnisse: z.array(ErgebnisSchema).min(1),
  })
  .refine(
    (d) => new Set(d.schritte.map((s) => s.id)).size === d.schritte.length,
    {
      message: 'Zwei Schritte haben dieselbe id.',
      path: ['schritte'],
    },
  )
  .refine(
    (d) => new Set(d.ergebnisse.map((e) => schluessel(e.wenn))).size === d.ergebnisse.length,
    {
      message: 'Zwei Eintraege in ergebnisse gelten fuer dieselbe Kombination.',
      path: ['ergebnisse'],
    },
  );

export type PipelineDaten = z.infer<typeof PipelineProps>;
export type Ergebnis = z.infer<typeof ErgebnisSchema>;

export function findeErgebnis(
  ergebnisse: readonly Ergebnis[],
  aktiv: readonly string[],
): Ergebnis | undefined {
  const gesucht = schluessel(aktiv);
  return ergebnisse.find((e) => schluessel(e.wenn) === gesucht);
}

/**
 * Liefert alle Kombinationen zuschaltbarer Schritte, für die kein Ergebnis
 * hinterlegt ist. Leeres Array heißt: vollständig abgedeckt.
 * Die leere Kombination erscheint als "(keine)".
 */
export function fehlendeKombinationen(daten: PipelineDaten): string[] {
  const optionale = daten.schritte.filter((s) => s.optional).map((s) => s.id);
  const vorhanden = new Set(daten.ergebnisse.map((e) => schluessel(e.wenn)));
  const fehlend: string[] = [];

  for (let maske = 0; maske < 2 ** optionale.length; maske++) {
    const aktiv = optionale.filter((_, i) => (maske >> i) & 1);
    const k = schluessel(aktiv);
    if (!vorhanden.has(k)) fehlend.push(k === '' ? '(keine)' : k);
  }
  return fehlend;
}
