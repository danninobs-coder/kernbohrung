import { describe, it, expect } from 'vitest';
import {
  NEUTRALE_VORLIEBEN,
  VORSCHLAG,
  einladungZeigen,
  voreinstellungen,
  wiederholungLohnt,
} from '../src/profil/vorschlag';
import type { Profilstand } from '../src/profil/schema';

const ERHOBEN = '2026-09-19T10:00:00.000Z';
const TAG = 24 * 60 * 60 * 1000;

/** `tage` Tage und `ms` Millisekunden nach der Erhebung. */
function nach(tage: number, ms = 0): Date {
  return new Date(new Date(ERHOBEN).getTime() + tage * TAG + ms);
}

describe('VORSCHLAG', () => {
  it('traegt die sechs Vorschlaege im Wortlaut des Specs', () => {
    expect(VORSCHLAG).toEqual({
      ordnen: 'Schreib nach jeder Lektion den Satz des Prinzips in eigenen Worten auf — ein Satz reicht.',
      verknuepfen: 'Nimm dir bei jedem Transfer eine Minute: Wo ist dir das im eigenen Projekt begegnet?',
      abrufen: 'Lass die App fragen, bevor du nachliest. Es fühlt sich schwerer an und wirkt besser.',
      steuern: 'Leg vor der Sitzung fest, was danach sitzen soll — ein Satz reicht. Prüf am Ende selbst, ob er stimmt.',
      dranbleiben: 'Nimm dir fünf Minuten vor, nicht eine Stunde. Kurz und täglich schlägt lang und selten.',
      zeiteinteilen: 'Leg deine Lerntage für die Woche fest, bevor sie anfängt. Ein fester Termin wird eher eingehalten als ein guter Vorsatz.',
    });
  });
});

describe('wiederholungLohnt', () => {
  it('meldet ab GENAU acht Wochen', () => {
    expect(wiederholungLohnt(ERHOBEN, nach(56))).toBe(true);
    expect(wiederholungLohnt(ERHOBEN, nach(200))).toBe(true);
  });

  it('meldet eine Millisekunde vorher noch nicht', () => {
    expect(wiederholungLohnt(ERHOBEN, nach(56, -1))).toBe(false);
    expect(wiederholungLohnt(ERHOBEN, nach(0))).toBe(false);
  });

  it('meldet bei einem unlesbaren Zeitpunkt nichts', () => {
    // Lieber kein Hinweis als einer ohne Grundlage.
    expect(wiederholungLohnt('gestern', nach(200))).toBe(false);
  });

});

describe('einladungZeigen', () => {
  it('zeigt die Einladung, solange kein Profil erhoben ist', () => {
    expect(einladungZeigen(false, undefined, nach(0))).toBe(true);
  });

  it('zeigt sie nie, wenn ein Profil erhoben ist', () => {
    expect(einladungZeigen(true, undefined, nach(0))).toBe(false);
    expect(einladungZeigen(true, ERHOBEN, nach(30))).toBe(false);
  });

  it('bleibt nach „Später" weg — und kommt nach GENAU sieben Tagen wieder', () => {
    expect(einladungZeigen(false, ERHOBEN, nach(0))).toBe(false);
    expect(einladungZeigen(false, ERHOBEN, nach(7, -1))).toBe(false);
    expect(einladungZeigen(false, ERHOBEN, nach(7))).toBe(true);
  });

  it.each([
    ['eine Zahl', 42],
    ['null', null],
    ['ein Wort', 'irgendwann'],
    ['ein Objekt', {}],
  ])('laesst sich von Unsinn im Speicher nicht verstecken: %s', (_name, spaeter) => {
    expect(einladungZeigen(false, spaeter, nach(0))).toBe(true);
  });

  it('laesst sich auch von einer Zahl nicht verstecken, die zufällig zum selben Zeitpunkt passt', () => {
    // Haelt die Typwache `typeof spaeterSeit !== 'string'`: Eine Zahl im
    // Speicher (z. B. ein versehentliches Date.now() statt toISOString())
    // darf die Einladung nicht verstecken, selbst wenn sie als Zeitstempel
    // zufaellig genau auf „jetzt" zeigt (seit = 0, also innerhalb der Frist).
    const jetzt = nach(0);
    expect(einladungZeigen(false, jetzt.getTime(), jetzt)).toBe(true);
  });

  it('laesst sich von einem Zeitpunkt in der Zukunft nicht verstecken', () => {
    // Eine verstellte Uhr soll die Einladung nicht auf Jahre wegsperren.
    expect(einladungZeigen(false, nach(400).toISOString(), nach(0))).toBe(true);
  });
});

describe('voreinstellungen', () => {
  const stand: Profilstand = {
    itemsatz: 1,
    erhoben: ERHOBEN,
    antworten: {},
    vorlieben: { einstieg: 'ueberblick', minuten: 20, text: 'stichpunkte' },
  };

  it('gibt ohne Profil die neutralen Vorlieben', () => {
    expect(voreinstellungen(null)).toEqual({ einstieg: 'egal', minuten: 10, text: 'egal' });
    expect(voreinstellungen(null)).toBe(NEUTRALE_VORLIEBEN);
    // Dieselbe Referenz fuer alle: Sie darf sich nicht veraendern lassen.
    expect(Object.isFrozen(NEUTRALE_VORLIEBEN)).toBe(true);
  });

  it('gibt mit Profil genau dessen Vorlieben', () => {
    expect(voreinstellungen(stand)).toEqual({ einstieg: 'ueberblick', minuten: 20, text: 'stichpunkte' });
  });
});
