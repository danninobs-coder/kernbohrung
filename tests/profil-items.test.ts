import { describe, it, expect } from 'vitest';
import {
  GRUPPEN,
  GRUPPENGROESSEN,
  ITEMS,
  ITEMSATZ,
  MUSTER,
  REIHENFOLGE,
  SKALEN,
  SKALA_TEXT,
  STUFEN,
  STUFEN_TEXT,
  VORLIEBEN,
} from '../src/profil/items';

/** Normalisiert verglichen, nicht exakt: sonst entkommt „Ich lerne ." gegen „ich lerne." */
function normal(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** djb2. Keine Kryptografie — nur ein Wachposten, der bei jedem geaenderten Zeichen anschlaegt. */
function pruefsumme(text: string): number {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = (Math.imul(h, 33) ^ text.charCodeAt(i)) >>> 0;
  return h;
}

describe('die Aussagen', () => {
  it('sind 26: jede Skala genau drei, jedes Muster genau zwei', () => {
    // 6 x 3 + 4 x 2 = 26. Stimmt die Summe, gehoert auch jede Aussage zu einer
    // bekannten Skala oder einem bekannten Muster — sonst bliebe eine uebrig.
    expect(ITEMS).toHaveLength(26);
    for (const skala of SKALEN) expect(ITEMS.filter((i) => i.dimension === skala)).toHaveLength(3);
    for (const muster of MUSTER) expect(ITEMS.filter((i) => i.dimension === muster)).toHaveLength(2);
  });

  it('tragen eindeutige Ids', () => {
    // An der Id haengt die gespeicherte Antwort. Zwei Aussagen mit derselben Id
    // teilten sich ein Kreuz.
    expect(new Set(ITEMS.map((i) => i.id)).size).toBe(ITEMS.length);
  });

  it('kommen nicht doppelt vor, auch nicht nur durch Schreibung getrennt', () => {
    expect(new Set(ITEMS.map((i) => normal(i.text))).size).toBe(ITEMS.length);
  });

  it('haben sich nicht geaendert, ohne dass ITEMSATZ gestiegen ist', () => {
    // Schlaegt dieser Test an, ist eine Aussage umformuliert, umgehaengt oder
    // umbenannt worden. Dann gehoeren gespeicherte Antworten nicht mehr zu
    // diesen Aussagen: ITEMSATZ in items.ts erhoehen UND die beiden Zahlen hier
    // nachziehen. Wer nur die Pruefsumme nachzieht, verrechnet alte Antworten
    // mit neuen Fragen.
    expect(ITEMSATZ).toBe(1);
    expect(pruefsumme(ITEMS.map((i) => `${i.id}|${i.dimension}|${i.text}`).join('\n'))).toBe(1787064221);
  });
});

describe('die Reihenfolge im Audit', () => {
  it('enthaelt jede Aussage genau einmal', () => {
    expect(REIHENFOLGE.map((i) => i.id).sort()).toEqual(ITEMS.map((i) => i.id).sort());
  });

  it('ist fest verankert — ein Zwischenstand findet nach dem Neuladen dieselben Gruppen', () => {
    // Der Entwurf merkt sich nur die Nummer des Schritts. Mischte ein neuer Bau
    // anders, laegen hinter derselben Nummer andere Aussagen, und wer bei
    // Schritt 3 weitermacht, bekaeme manche nie zu sehen.
    expect(GRUPPEN[0]?.map((i) => i.id)).toEqual(['bed-1', 'dra-3', 'ste-1', 'bed-2', 'zei-1', 'ste-2']);
  });

  it('stellt nie zwei Aussagen derselben Skala oder desselben Musters nebeneinander', () => {
    // Das ist der Zweck des Mischens: Wer drei Aussagen zum Zeiteinteilen
    // hintereinander liest, beantwortet ab der zweiten die Skala.
    for (let i = 1; i < REIHENFOLGE.length; i++) {
      expect(REIHENFOLGE[i]?.dimension).not.toBe(REIHENFOLGE[i - 1]?.dimension);
    }
  });

  it('schneidet in Gruppen zu fuenf bis sechs, ohne eine Aussage zu verlieren', () => {
    expect(GRUPPEN.map((g) => g.length)).toEqual([...GRUPPENGROESSEN]);
    for (const groesse of GRUPPENGROESSEN) {
      expect(groesse).toBeGreaterThanOrEqual(5);
      expect(groesse).toBeLessThanOrEqual(6);
    }
    expect(GRUPPEN.flat().map((i) => i.id)).toEqual(REIHENFOLGE.map((i) => i.id));
  });
});

describe('Stufen, Skalennamen und Vorlieben', () => {
  it('kennt fuenf Stufen von „trifft gar nicht zu" bis „trifft völlig zu"', () => {
    expect([...STUFEN]).toEqual([1, 2, 3, 4, 5]);
    expect(STUFEN_TEXT[1]).toBe('trifft gar nicht zu');
    expect(STUFEN_TEXT[5]).toBe('trifft völlig zu');
    expect(new Set(STUFEN.map((s) => STUFEN_TEXT[s])).size).toBe(5);
  });

  it('nennt die sechs Skalen beim Namen', () => {
    expect(SKALEN.map((s) => SKALA_TEXT[s])).toEqual([
      'Ordnen',
      'Verknüpfen',
      'Abrufen',
      'Steuern',
      'Dranbleiben',
      'Zeit einteilen',
    ]);
  });

  it('stellt die drei Vorlieben im Wortlaut des Specs', () => {
    expect(VORLIEBEN.map((v) => [v.id, v.frage, v.optionen.map((o) => o.text)])).toEqual([
      ['einstieg', 'Womit steigst du lieber ein?', ['Überblick zuerst', 'Beispiel zuerst', 'egal']],
      ['minuten', 'Wie lang darf eine Sitzung sein?', ['5 Minuten', '10 Minuten', '20 Minuten']],
      ['text', 'Was liest du lieber?', ['knappe Stichpunkte', 'ausformulierte Absätze', 'egal']],
    ]);
  });
});
