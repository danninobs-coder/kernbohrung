import { z } from 'astro/zod';

export const SchrittSchema = z.object({
  id: z.string().min(1),
  titel: z.string().min(1),
  wirkung: z.string().min(1),
  optional: z.boolean().default(false),
  standardAn: z.boolean().default(true),
});

export const AusgabeZeileSchema = z.object({
  text: z.string().min(1),
  treffer: z.boolean(),
});

export const ErgebnisSchema = z.object({
  wenn: z.array(z.string()),
  ausgabe: z.array(AusgabeZeileSchema).min(1),
  hinweis: z.string().min(1),
});

export const PipelineProps = z.object({
  einheit: z.string().default('Dokument'),
  schritte: z.array(SchrittSchema).min(2),
  ergebnisse: z.array(ErgebnisSchema).min(1),
});

export type PipelineDaten = z.infer<typeof PipelineProps>;
export type Ergebnis = z.infer<typeof ErgebnisSchema>;

/** Kanonischer Schlüssel einer Menge aktiver Schritt-Ids. */
export function schluessel(ids: readonly string[]): string {
  return [...ids].sort().join('+');
}

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
