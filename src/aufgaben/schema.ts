import { z } from 'astro/zod';
import { WahlSchema } from './wahl/schema.ts';
import { FallSchema } from './fall/schema.ts';
import { ZuordnenSchema } from './zuordnen/schema.ts';
import { ReihenfolgeSchema } from './reihenfolge/schema.ts';

/**
 * Die Aufgabenfamilie als diskriminierte Union ueber `typ`.
 *
 * Ein Generator kann damit keinen Mischtyp erfinden: `typ` waehlt genau ein
 * Schema, und jedes davon ist ein `strictObject`. Ein neuer Typ ist ein neuer
 * Ordner und eine Zeile hier — Huelle, Ereignis, Speicher und Tutor bleiben,
 * wie sie sind.
 *
 * Die Importe tragen die Endung `.ts`: Diese Datei wird ueber
 * `src/content/schema.ts` von `werkzeug/pruefe-lektion.mjs` unter reinem Node
 * geladen, und Node loest relative Importe ohne Endung nicht auf.
 */
export const AufgabeSchema = z.discriminatedUnion('typ', [
  WahlSchema,
  FallSchema,
  ZuordnenSchema,
  ReihenfolgeSchema,
]);

export type Aufgabe = z.infer<typeof AufgabeSchema>;
export type AufgabenTyp = Aufgabe['typ'];

/** In dieser Reihenfolge fuehrt die Oberflaeche die Typen auf. */
export const AUFGABENTYPEN = ['wahl', 'fall', 'zuordnen', 'reihenfolge'] as const;
