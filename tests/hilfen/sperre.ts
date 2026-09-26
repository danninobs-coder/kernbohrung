import { chmodSync, closeSync, constants, openSync, statSync } from 'node:fs';

/**
 * Die Sperre fuer die Tests der Werkzeuge: eine Datei oder ein Ordner, den ein
 * anderes Programm festhaelt. Eine Fassung fuer alle, damit jeder Test
 * dasselbe meint, wenn er „gesperrt" sagt — drei Kopien waren schon
 * auseinandergelaufen.
 *
 * Die Datei heisst nicht `*.test.ts`: Vitest sammelt sie nicht als Test
 * (`include` in vitest.config.ts), `astro check` prueft sie trotzdem mit.
 */

/**
 * `UV_FS_O_EXLOCK` aus libuv: unter Windows oeffnen, ohne die Datei mit
 * anderen zu teilen. Eine feste Zahl, weil Node die Konstante nicht in
 * `fs.constants` fuehrt — unter Windows steht dort von den `UV_FS_O_*` nur
 * `UV_FS_O_FILEMAP`, in den Typen von @types/node ebenso. libuv wertet sie
 * trotzdem aus.
 */
const UV_FS_O_EXLOCK = 0x10000000;

/**
 * Sperrt eine Datei oder einen Ordner, bis `frei` sie wieder freigibt — wie
 * ein Editor oder ein anderes Programm, das eine Datei festhaelt. `code` ist
 * der Fehlercode, mit dem ein Zugriff dann scheitert.
 *
 * Unter Windows geoeffnet, ohne sie zu teilen: Wer die Datei oeffnet, zum
 * Lesen wie zum Schreiben, oder den Ordner auflistet, bekommt EBUSY — auch
 * ein Kindprozess; stat und das Lesen von Dateien im Ordner gehen weiter.
 * Sonst ohne Rechte (EACCES): eine Datei ohne jedes Recht, ein Ordner ohne
 * Leserecht, aber durchquerbar — die Dateien darin bleiben lesbar wie unter
 * Windows.
 */
export function sperre(pfad: string): { code: string; frei: () => void } {
  if (process.platform === 'win32') {
    const fd = openSync(pfad, UV_FS_O_EXLOCK | constants.O_RDONLY);
    return { code: 'EBUSY', frei: () => closeSync(fd) };
  }
  const vorher = statSync(pfad);
  chmodSync(pfad, vorher.isDirectory() ? 0o300 : 0o000);
  return { code: 'EACCES', frei: () => chmodSync(pfad, vorher.mode & 0o777) };
}

/**
 * Wer als root laeuft, liest und schreibt trotz entzogener Rechte: Dann greift
 * `sperre` ausserhalb von Windows nicht, und auch kein anderer Entzug von
 * Rechten. Ein Test, der eine Sperre braucht, laeuft nur, wenn sie greift.
 */
export const SPERRE_GREIFT = process.getuid?.() !== 0;
