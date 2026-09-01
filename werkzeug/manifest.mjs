/**
 * Das Manifest ist der Herkunftsnachweis eines Rohmaterialstands.
 *
 * Es beantwortet zwei Fragen, und die zweite wird gern vergessen:
 * Woher kommt das hier — und was ist NICHT mitgekommen. Ohne die
 * Auslassungsliste haelt der naechste Leser den Bestand fuer vollstaendig
 * und schliesst aus einem fehlenden Treffer auf ein fehlendes Thema.
 */

export const MANIFEST_FASSUNG = 1;

export function baueManifest({ herkunft, urteile, gestempeltAm }) {
  if (!gestempeltAm) {
    throw new Error(
      'baueManifest: Zeitstempel fehlt. Er wird uebergeben, nicht erzeugt — ' +
        'sonst ist das Manifest bei jedem Lauf verschieden und nicht vergleichbar.',
    );
  }
  if (!herkunft?.sha) {
    throw new Error(
      'baueManifest: sha fehlt. Ohne ihn laesst sich spaeter nicht sagen, ' +
        'aus welchem Stand eine Behauptung stammt.',
    );
  }

  const uebernommen = urteile
    .filter((u) => u.mitnehmen)
    .map(({ pfad, rubrik, bytes }) => ({ pfad, rubrik, bytes }));

  const ausgelassen = urteile
    .filter((u) => !u.mitnehmen)
    .map(({ pfad, grund }) => ({ pfad, grund }));

  return {
    fassung: MANIFEST_FASSUNG,
    gestempeltAm,
    herkunft,
    summe: {
      uebernommen: uebernommen.length,
      ausgelassen: ausgelassen.length,
      bytes: uebernommen.reduce((n, d) => n + d.bytes, 0),
    },
    uebernommen,
    ausgelassen,
  };
}
