import { z } from 'astro/zod';

/**
 * Kanonischer Schlüssel einer Menge aktiver Schritt-Ids.
 *
 * Steht bewusst vor den Schema-Definitionen: PipelineProps prüft damit, ob
 * zwei Einträge in `ergebnisse` für dieselbe Kombination gelten.
 *
 * Das Trennzeichen `+` ist nur eindeutig, solange keine Id selbst ein `+`
 * enthält — sonst wären `['a+b', 'c']` und `['a', 'b+c']` derselbe Schlüssel.
 * Dafür sorgt die Zeichensatz-Regel auf `SchrittSchema.id`.
 */
export function schluessel(ids: readonly string[]): string {
  return [...ids].sort().join('+');
}

export const SchrittSchema = z.object({
  id: z.string().regex(
    /^[a-z0-9]+(-[a-z0-9]+)*$/,
    'nur Kleinbuchstaben, Ziffern und Bindestrich - keine Leerzeichen oder Sonderzeichen.',
  ),
  titel: z.string().trim().min(1),
  wirkung: z.string().trim().min(1),
  optional: z.boolean().default(false),
  standardAn: z.boolean().default(true),
});

export const AusgabeZeileSchema = z.object({
  text: z.string().trim().min(1),
  treffer: z.boolean(),
});

export const ErgebnisSchema = z.object({
  wenn: z.array(z.string()),
  ausgabe: z.array(AusgabeZeileSchema).min(1),
  hinweis: z.string().trim().min(1),
});

export const PipelineProps = z
  .object({
    einheit: z.string().trim().min(1).default('Dokument'),
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
