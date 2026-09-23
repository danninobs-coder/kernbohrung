import { readFileSync, readdirSync } from 'node:fs';
import { lehrplanAusYaml } from '../src/lib/lehrplan.ts';

/**
 * Liest eine Lehrplandatei vom Datentraeger und prueft sie.
 *
 * Das Schema selbst steht seit Fassung 2 in `src/lib/lehrplan.ts`: Es wird
 * auch von der Seite /bibliothek zur Bauzeit gelesen und soll spaeter im
 * Browser laufen koennen — dort gibt es kein `node:fs`. Hier bleibt, was nur
 * unter Node geht: die Datei lesen und die Lektionen auflisten, die es gibt.
 *
 * @typedef {import('../src/lib/lehrplan.ts').Befund} Befund
 */

/**
 * Die Lektionen, die es gibt: die Dateinamen unter `ordner` ohne `.mdx`.
 *
 * Fehlt der Ordner, gibt es keine Lektion. Das ist die sichere Seite: Jeder
 * Abschnitt mit `status: lektion` faellt dann durch, keiner rutscht durch.
 *
 * @param {string} ordner
 * @returns {Set<string>}
 */
export function lektionsIdsAus(ordner) {
  try {
    return new Set(
      readdirSync(ordner)
        .filter((name) => name.endsWith('.mdx'))
        .map((name) => name.slice(0, -'.mdx'.length)),
    );
  } catch {
    return new Set();
  }
}

/**
 * @param {string} datei Pfad zur Lehrplandatei, relativ zum Arbeitsverzeichnis
 * @param {string} [lektionsordner] wo die Lektionen liegen, ebenfalls relativ
 * @returns {Befund}
 */
export function liesLehrplan(datei, lektionsordner = 'inhalt/lektionen') {
  // Lesen und Auswerten getrennt gefangen, nicht zusammen: Sonst meldet eine
  // fehlende Datei „ist kein gueltiges YAML" und schickt den Suchenden zur
  // falschen Baustelle. Der Fall ist nicht theoretisch — er ist beim ersten
  // Probelauf dieses Werkzeugs genau so aufgetreten.
  let text;
  try {
    text = readFileSync(datei, 'utf8');
  } catch (fehler) {
    const grund = fehler instanceof Error ? fehler.message : String(fehler);
    return { ok: false, maengel: [`${datei} lässt sich nicht lesen: ${grund}`] };
  }
  return lehrplanAusYaml(text, lektionsIdsAus(lektionsordner), datei);
}
