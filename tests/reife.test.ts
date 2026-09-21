import { describe, it, expect } from 'vitest';
import { reife, reifeDesPrinzips, RICHTIGE_GEGEN_FEHLVORSTELLUNG } from '../src/tutor/reife';
import type { Ereignis, Zuversicht } from '../src/tutor/typen';

const JETZT = new Date('2026-09-16T10:00:00Z');
const TAG = 86400000;

/** `jetzt` plus so viele Tage — negativ fuer Vergangenheit. */
function tage(n: number): Date {
  return new Date(JETZT.getTime() + n * TAG);
}

function e(zuversicht: Zuversicht, richtig: boolean, merkmal = 'x'): Ereignis {
  return {
    lektion: 'rvp',
    frage: 'rvp-1',
    zuversicht,
    richtig,
    typ: 'wahl',
    anteil: richtig ? 1 : 0,
    antwort: merkmal,
    merkmal: richtig ? '' : merkmal,
    dauerMs: 1000,
    zeitpunkt: '2026-09-16T09:00:00Z',
  };
}

describe('reife', () => {
  it('nennt eine nie beantwortete Frage unberuehrt', () => {
    expect(reife({ ereignisse: [], faellig: null }, JETZT)).toBe('unberuehrt');
  });

  it('nennt eine einmal richtig beantwortete Frage frisch', () => {
    // Beantwortet, aber noch keine Wiederholung ueberstanden: Ein einziger
    // Treffer sagt nichts darueber, ob es morgen noch da ist.
    expect(reife({ ereignisse: [e('eher', true)], faellig: tage(2) }, JETZT)).toBe('frisch');
  });

  it('nennt sitzt bei zweimal richtig, letzter Antwort richtig und Termin in der Zukunft', () => {
    const verlauf = { ereignisse: [e('eher', true), e('sicher', true)], faellig: tage(9) };
    expect(reife(verlauf, JETZT)).toBe('sitzt');
  });

  it('nennt nicht sitzt, wenn nur einmal richtig geantwortet wurde', () => {
    // Ein Treffer und ein Fehlgriff ergeben keine Reife, auch nicht mit
    // langem Termin.
    const verlauf = { ereignisse: [e('eher', false), e('eher', true)], faellig: tage(9) };
    expect(reife(verlauf, JETZT)).toBe('frisch');
  });

  it('nennt verblasst, sobald der Termin ueberfaellig ist', () => {
    const verlauf = { ereignisse: [e('eher', true), e('eher', true)], faellig: tage(-3) };
    expect(reife(verlauf, JETZT)).toBe('verblasst');
  });

  it('zaehlt den Termin genau jetzt als faellig, nicht als Zukunft', () => {
    // Die Grenze gehoert festgenagelt: Ein `<` statt `<=` laesst eine Karte
    // im Moment ihrer Faelligkeit durch die Auswahl fallen.
    const verlauf = { ereignisse: [e('eher', true), e('eher', true)], faellig: new Date(JETZT) };
    expect(reife(verlauf, JETZT)).toBe('verblasst');
  });

  it('nennt wackelt, wenn die letzte Antwort falsch war', () => {
    const verlauf = { ereignisse: [e('eher', true), e('eher', false)], faellig: tage(1) };
    expect(reife(verlauf, JETZT)).toBe('wackelt');
  });

  it('laesst wackelt vor verblasst gehen — die Fehlvorstellung ist dringender', () => {
    // Der Unterschied, den es anderswo nicht gibt: „muss wiederholt werden,
    // weil Zeit vergangen ist" gegen „muss wiederholt werden, weil da eine
    // Fehlvorstellung sitzt".
    const verlauf = { ereignisse: [e('eher', true), e('eher', false)], faellig: tage(-5) };
    expect(reife(verlauf, JETZT)).toBe('wackelt');
  });

  it('nennt wackelt nach sicher und falsch, auch wenn der Termin in der Zukunft liegt', () => {
    const verlauf = { ereignisse: [e('sicher', false)], faellig: tage(30) };
    expect(reife(verlauf, JETZT)).toBe('wackelt');
  });

  it('unterscheidet sicher und falsch von geraten und falsch', () => {
    // Wer raet und danebenliegt, weiss dass er es nicht weiss. Das ist kein
    // hartnaeckiger Zustand, sondern eine Luecke — und die schliesst sich mit
    // einer richtigen Antwort.
    const geraten = { ereignisse: [e('geraten', false), e('eher', true)], faellig: tage(3) };
    expect(reife(geraten, JETZT)).toBe('frisch');

    const sicher = { ereignisse: [e('sicher', false), e('eher', true)], faellig: tage(3) };
    expect(reife(sicher, JETZT)).toBe('wackelt');
  });
});

/**
 * Die Entwurfsfrage, die der Plan offen liess: Reicht EINE richtige Antwort,
 * um aus `wackelt` herauszukommen, wenn die Ursache ein sicherer Fehlgriff
 * war?
 *
 * Die Antwort des Moduls ist nein — zwei. Die Zusicherungen hier pinnen
 * genau diese Entscheidung, damit sie nicht unbemerkt zurueckgedreht wird.
 */
describe('reife loest eine Fehlvorstellung erst nach zwei Treffern', () => {
  it('bleibt nach einer einzigen richtigen Antwort bei wackelt', () => {
    const verlauf = { ereignisse: [e('sicher', false), e('sicher', true)], faellig: tage(9) };
    expect(reife(verlauf, JETZT)).toBe('wackelt');
  });

  it('faellt nach der zweiten richtigen Antwort aus wackelt heraus', () => {
    const verlauf = {
      ereignisse: [e('sicher', false), e('sicher', true), e('sicher', true)],
      faellig: tage(9),
    };
    expect(reife(verlauf, JETZT)).toBe('sitzt');
  });

  it('zaehlt nur die Treffer NACH dem sicheren Fehlgriff', () => {
    // Zwei Treffer davor helfen nicht: Sie sind der Grund, warum die
    // Zuversicht ueberhaupt auf „sicher" stand.
    const verlauf = {
      ereignisse: [e('sicher', true), e('sicher', true), e('sicher', false), e('sicher', true)],
      faellig: tage(9),
    };
    expect(reife(verlauf, JETZT)).toBe('wackelt');
  });

  it('setzt nach einem erneuten sicheren Fehlgriff wieder von vorn an', () => {
    const verlauf = {
      ereignisse: [
        e('sicher', false),
        e('sicher', true),
        e('sicher', true),
        e('sicher', false),
        e('sicher', true),
      ],
      faellig: tage(9),
    };
    expect(reife(verlauf, JETZT)).toBe('wackelt');
  });

  it('nennt die Schwelle als Zahl, statt sie zu verstecken', () => {
    expect(RICHTIGE_GEGEN_FEHLVORSTELLUNG).toBe(2);
  });
});

describe('reife liest die Zeit nicht selbst', () => {
  it('ergibt bei gleichem Zeitpunkt dieselbe Stufe', () => {
    // Dieselbe Bedingung wie in planung.ts: `jetzt` kommt herein, wird nicht
    // gelesen. Genau das macht das Modul ohne Zeitattrappe testbar.
    const verlauf = { ereignisse: [e('eher', true), e('eher', true)], faellig: tage(1) };
    expect(reife(verlauf, JETZT)).toBe(reife(verlauf, JETZT));
  });

  it('kippt allein durch einen spaeteren Zeitpunkt von sitzt auf verblasst', () => {
    const verlauf = { ereignisse: [e('eher', true), e('eher', true)], faellig: tage(1) };
    expect(reife(verlauf, JETZT)).toBe('sitzt');
    expect(reife(verlauf, tage(2))).toBe('verblasst');
  });
});

/**
 * Ein Prinzip hat vier Fragen. Die Landkarte zeigt aber das PRINZIP, nicht
 * die Frage — also braucht es eine Regel, wie aus vier Stufen eine wird.
 */
describe('reifeDesPrinzips', () => {
  it('nennt ein Prinzip unberuehrt, solange keine seiner Fragen beantwortet ist', () => {
    expect(reifeDesPrinzips(['unberuehrt', 'unberuehrt', 'unberuehrt', 'unberuehrt'])).toBe(
      'unberuehrt',
    );
  });

  it('nennt ein angefangenes Prinzip nie mehr unberuehrt', () => {
    // Sonst behauptet die Landkarte „noch nie angefasst" ueber ein Prinzip,
    // an dem gerade drei Fragen sitzen.
    expect(reifeDesPrinzips(['unberuehrt', 'sitzt', 'sitzt', 'sitzt'])).toBe('frisch');
  });

  it('zeigt die dringendste Stufe: eine wackelnde Frage genuegt', () => {
    expect(reifeDesPrinzips(['sitzt', 'sitzt', 'wackelt', 'verblasst'])).toBe('wackelt');
  });

  it('zeigt verblasst, wenn nichts wackelt, aber etwas ueberfaellig ist', () => {
    expect(reifeDesPrinzips(['sitzt', 'verblasst', 'sitzt', 'frisch'])).toBe('verblasst');
  });

  it('nennt sitzt erst, wenn jede Frage sitzt', () => {
    expect(reifeDesPrinzips(['sitzt', 'sitzt', 'sitzt', 'sitzt'])).toBe('sitzt');
    expect(reifeDesPrinzips(['sitzt', 'sitzt', 'sitzt', 'frisch'])).toBe('frisch');
  });

  it('nennt ein Prinzip ohne Fragen unberuehrt statt zu werfen', () => {
    // Kann vorkommen, wenn eine Lektion noch keine Fragen hat. Die Landkarte
    // soll dann eine Stufe zeigen, nicht abstuerzen.
    expect(reifeDesPrinzips([])).toBe('unberuehrt');
  });
});
