import { z } from 'astro/zod';
import { GRUPPENGROESSEN, ITEMSATZ, STUFEN } from './items';

/**
 * Was vom Lernprofil im Speicher liegt — und die Pruefung beim Lesen.
 *
 * `einstellung()` gibt `unknown` zurueck: Der Wert kommt von einer fremden
 * Festplatte, geschrieben womoeglich von einer aelteren oder neueren Fassung
 * dieser App oder von Hand veraendert. Deshalb wird hier geprueft und nicht
 * behauptet.
 *
 * Diese Datei ist die EINE Stelle im Profil, die Zod zur Laufzeit braucht, und
 * sie laeuft im Browser — dort wird gelesen. Alle anderen Dateien in
 * `src/profil/` holen sich von hier nur Typen (`import type`); die beiden
 * Inseln und das Skript der Uebersicht rufen `liesProfil` und `liesEntwurf`.
 *
 * Gespeichert werden die ANTWORTEN, nie das Ergebnis. `strictObject` haelt das
 * fest: Ein Stand, der ein Feld wie `lernmuster` mitbringt, ist kein Profil.
 */

export const SCHLUESSEL_PROFIL = 'profil';
export const SCHLUESSEL_ENTWURF = 'profil:entwurf';
export const SCHLUESSEL_SPAETER = 'profil:spaeter';

/** Eine Antwort: 1 bis 5, nichts dazwischen, nichts daneben. */
const WertSchema = z.literal([...STUFEN]);

export const VorliebenSchema = z.strictObject({
  einstieg: z.enum(['ueberblick', 'beispiel', 'egal']),
  minuten: z.literal([5, 10, 20]),
  text: z.enum(['stichpunkte', 'absaetze', 'egal']),
});

/**
 * Die Vorlieben, solange das Audit laeuft: jede darf noch fehlen. `partial()`
 * behaelt die Strenge — ein fremdes Feld faellt auch hier durch.
 */
export const HalbeVorliebenSchema = VorliebenSchema.partial();

/**
 * Der gespeicherte Stand unter `SCHLUESSEL_PROFIL`.
 *
 * `itemsatz` ist hier eine beliebige positive ganze Zahl und NICHT auf den
 * heutigen Satz festgelegt: Ein Stand aus einem anderen Satz ist lesbar, nur
 * nicht auswertbar. Ob er zaehlt, entscheidet `werteAus` in `auswertung.ts`.
 *
 * Die Schluessel von `antworten` sind Item-Ids, werden aber nicht gegen die
 * heutige Liste geprueft — aus demselben Grund. Die Auswertung liest nur die
 * Ids, die sie kennt; der Rest bleibt liegen und stoert nicht.
 */
export const ProfilstandSchema = z.strictObject({
  itemsatz: z.number().int().min(1),
  // Mit Zeitzone erlaubt: `+02:00` ist derselbe Zeitpunkt wie `Z` (siehe Test).
  erhoben: z.iso.datetime({ offset: true }),
  antworten: z.record(z.string(), WertSchema),
  vorlieben: VorliebenSchema,
});

/**
 * Der Zwischenstand eines laufenden Audits unter `SCHLUESSEL_ENTWURF`.
 *
 * Anders als beim Profil ist der Itemsatz hier festgenagelt: Ein Entwurf ist
 * Wegwerfware, und ein Entwurf zu anderen Aussagen ist keiner. `schritt` zaehlt
 * die Aussagengruppen ab 0; der Wert `GRUPPENGROESSEN.length` ist der Schritt
 * mit den Vorlieben.
 */
export const EntwurfSchema = z.strictObject({
  itemsatz: z.literal(ITEMSATZ),
  antworten: z.record(z.string(), WertSchema),
  vorlieben: HalbeVorliebenSchema,
  schritt: z.number().int().min(0).max(GRUPPENGROESSEN.length),
});

export type Vorlieben = z.infer<typeof VorliebenSchema>;
export type Profilstand = z.infer<typeof ProfilstandSchema>;
export type Entwurf = z.infer<typeof EntwurfSchema>;

/** Der gespeicherte Stand — oder `null`. Wirft nie: Unlesbar heisst „kein Profil". */
export function liesProfil(roh: unknown): Profilstand | null {
  const befund = ProfilstandSchema.safeParse(roh);
  return befund.success ? befund.data : null;
}

/** Der Zwischenstand — oder `null`. Auch ein geloeschter Entwurf (`null`) ist keiner. */
export function liesEntwurf(roh: unknown): Entwurf | null {
  const befund = EntwurfSchema.safeParse(roh);
  return befund.success ? befund.data : null;
}
