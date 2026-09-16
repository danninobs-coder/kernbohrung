import { describe, it, expect } from 'vitest';
import { alsBewertung, naechsterTermin, neueKarte } from '../src/tutor/planung';
import { ZUVERSICHT_STUFEN } from '../src/tutor/typen';
import { Rating, type Card } from 'ts-fsrs';

describe('alsBewertung', () => {
  it('bildet sicher und richtig auf Easy ab', () => {
    expect(alsBewertung('sicher', true)).toBe(Rating.Easy);
  });

  it('bildet eher und richtig auf Good ab', () => {
    expect(alsBewertung('eher', true)).toBe(Rating.Good);
  });

  it('bildet geraten und richtig auf Hard ab — Glück ist kein Können', () => {
    // Der Kern der Sache: Ohne Zuversicht waere das ein Treffer wie jeder
    // andere und bekaeme ein langes Intervall. Mit Zuversicht weiss der
    // Planer, dass hier geraten wurde.
    expect(alsBewertung('geraten', true)).toBe(Rating.Hard);
  });

  it('bildet jede falsche Antwort auf Again ab, unabhängig von der Zuversicht', () => {
    expect(alsBewertung('sicher', false)).toBe(Rating.Again);
    expect(alsBewertung('eher', false)).toBe(Rating.Again);
    expect(alsBewertung('geraten', false)).toBe(Rating.Again);
  });
});

describe('naechsterTermin', () => {
  it('gibt einer neuen Karte bei Easy ein längeres Intervall als bei Hard', () => {
    const jetzt = new Date('2026-09-16T10:00:00Z');
    const leicht = naechsterTermin(neueKarte(jetzt), 'sicher', true, jetzt);
    const schwer = naechsterTermin(neueKarte(jetzt), 'geraten', true, jetzt);
    expect(leicht.faellig.getTime()).toBeGreaterThan(schwer.faellig.getTime());
  });

  it('holt eine falsch beantwortete Karte kurzfristig zurück', () => {
    const jetzt = new Date('2026-09-16T10:00:00Z');
    const gut = naechsterTermin(neueKarte(jetzt), 'eher', true, jetzt);
    const daneben = naechsterTermin(neueKarte(jetzt), 'sicher', false, jetzt);
    expect(daneben.faellig.getTime()).toBeLessThan(gut.faellig.getTime());
  });

  it('liefert eine Karte zurück, die sich erneut planen lässt', () => {
    const jetzt = new Date('2026-09-16T10:00:00Z');
    const erste = naechsterTermin(neueKarte(jetzt), 'eher', true, jetzt);
    const zweite = naechsterTermin(erste.karte, 'eher', true, erste.faellig);
    expect(zweite.faellig.getTime()).toBeGreaterThan(erste.faellig.getTime());
  });

  it('erfindet keinen Zeitpunkt, sondern nimmt den übergebenen', () => {
    const jetzt = new Date('2026-09-16T10:00:00Z');
    const a = naechsterTermin(neueKarte(jetzt), 'eher', true, jetzt);
    const b = naechsterTermin(neueKarte(jetzt), 'eher', true, jetzt);
    expect(a.faellig.toISOString()).toBe(b.faellig.toISOString());
  });
});

/**
 * Die Wirkung, nicht nur die Abbildung.
 *
 * Eine Mutationsprobe an `alsBewertung` hat gezeigt: Vertauscht man dort zwei
 * Stufen, schlaegt ausschliesslich die zugehoerige Zusicherung oben an —
 * saemtliche Termin-Tests bleiben gruen. Die Tests oben pinnen damit den
 * NAMEN der Bewertung, nicht ihre Folge. Wer die Abbildung spaeter absichtlich
 * verschiebt, zieht die Zusicherung mit und merkt nicht, dass der
 * Zuversichtsknopf aufgehoert hat zu wirken.
 *
 * Die Zusicherungen hier pinnen die Aussage, die das Merkmal tatsaechlich
 * macht: Ein geratener Treffer kommt frueher zurueck als ein sicherer, und ein
 * Fehlgriff frueher als jeder Treffer.
 *
 * Gemessen wird auf einer GEREIFTEN Karte. Auf einer neuen liegen die
 * Lernschritte dazwischen — 6 Minuten fuer Hard gegen 8 Tage fuer Easy —, und
 * dieser Abgrund uebersteht jede Verwechslung der Stufen. Eine neue Karte ist
 * als Pruefstein zu grob; im Review-Zustand liegen die Intervalle mit 8, 11
 * und 19 Tagen so dicht, dass eine vertauschte Stufe die Ordnung bricht.
 */
describe('naechsterTermin auf einer gereiften Karte', () => {
  const T0 = new Date('2026-09-16T10:00:00Z');

  /** Zweimal „eher + richtig" bringt die Karte in den Review-Zustand. */
  function gereift(): { karte: Card; jetzt: Date } {
    const erste = naechsterTermin(neueKarte(T0), 'eher', true, T0);
    const zweite = naechsterTermin(erste.karte, 'eher', true, erste.faellig);
    return { karte: zweite.karte, jetzt: zweite.faellig };
  }

  it('ordnet die drei Zuversichtsstufen streng nach Länge des Intervalls', () => {
    const { karte, jetzt } = gereift();
    const geraten = naechsterTermin(karte, 'geraten', true, jetzt).faellig.getTime();
    const eher = naechsterTermin(karte, 'eher', true, jetzt).faellig.getTime();
    const sicher = naechsterTermin(karte, 'sicher', true, jetzt).faellig.getTime();
    expect(geraten).toBeLessThan(eher);
    expect(eher).toBeLessThan(sicher);
  });

  it('holt jeden Fehlgriff früher zurück als den schwächsten Treffer', () => {
    const { karte, jetzt } = gereift();
    const schwaechsterTreffer = naechsterTermin(karte, 'geraten', true, jetzt).faellig.getTime();
    for (const stufe of ZUVERSICHT_STUFEN) {
      expect(naechsterTermin(karte, stufe, false, jetzt).faellig.getTime()).toBeLessThan(
        schwaechsterTreffer,
      );
    }
  });

  it('lässt die übergebene Karte unberührt — sie ist mehrfach planbar', () => {
    const { karte, jetzt } = gereift();
    const vorher = karte.due.getTime();
    naechsterTermin(karte, 'sicher', true, jetzt);
    const zweiterLauf = naechsterTermin(karte, 'sicher', true, jetzt);
    expect(karte.due.getTime()).toBe(vorher);
    expect(zweiterLauf.faellig.getTime()).toBe(
      naechsterTermin(karte, 'sicher', true, jetzt).faellig.getTime(),
    );
  });
});
