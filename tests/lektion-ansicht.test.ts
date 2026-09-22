import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Warum ein Text-Test und kein gerenderter Vergleich.
 *
 * Der Kern der Didaktik ist "erst spielen, dann erklaeren": Takt 2 (das
 * Widget im Slot) muss vor Takt 3 (der Satz) stehen, und dieser wiederum vor
 * Probe, Transfer und Herkunft. Eine Astro-Komponente laesst sich hier nicht
 * billig rendern — das braeuchte den Astro-Compiler und eine Laufzeitumgebung,
 * fuer eine reine Reihenfolgepruefung im Markup unverhaeltnismaessig teuer.
 * Eine vertauschte Reihenfolge baut ausserdem fehlerfrei: kein Typfehler, kein
 * Ausfall anderswo — die Lektion kippt lautlos, und nur ein Blick ins Markup
 * faengt das. Deshalb liest dieser Test die Datei als reinen Text.
 */
const wurzel = path.resolve(__dirname, '..');
const markup = readFileSync(path.join(wurzel, 'src', 'layouts', 'LektionAnsicht.astro'), 'utf8');

describe('LektionAnsicht.astro - Reihenfolge der Takte', () => {
  it('haelt den Slot vor Satz, Probe, Transfer und Herkunft', () => {
    const reihenfolge = [
      '<slot',
      'data-takt="satz"',
      'data-takt="probe"',
      'data-takt="transfer"',
      'data-takt="herkunft"',
    ] as const;

    const positionen = reihenfolge.map((suchtext) => markup.indexOf(suchtext));

    positionen.forEach((position, i) => {
      expect(position, `${reihenfolge[i]} fehlt im Markup`).toBeGreaterThanOrEqual(0);
    });

    for (let i = 1; i < positionen.length; i++) {
      expect(
        positionen[i],
        `${reihenfolge[i]} sollte nach ${reihenfolge[i - 1]} stehen`,
      ).toBeGreaterThan(positionen[i - 1]!);
    }
  });
});
