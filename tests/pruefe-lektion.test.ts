// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { pruefeLektionsText } from '../werkzeug/pruefe-lektion.mjs';

/**
 * Die Schranke, die entscheidet, was ausgeliefert wird.
 *
 * Sie prueft beides an einer Stelle: das Frontmatter gegen LektionSchema und
 * jeden Widget-Aufruf im Rumpf gegen pruefeWidget. Der Compiler-Skill ruft sie
 * auf, BEVOR er eine Datei nach `inhalt/lektionen/` schreibt.
 */

const gute = `---
titel: "Ein Prinzip"
prinzip: "Ein Satz, der etwas behauptet."
reihenfolge: 2
gesperrt: false
fragen:
  - id: p-1
    frage: "Erste Frage?"
    antworten:
      - text: "Richtig"
        richtig: true
        begruendung: "Diese Begruendung hat mehr als fuenf Woerter."
      - text: "Falsch A"
        richtig: false
        begruendung: "Auch diese Begruendung hat genug Woerter darin."
      - text: "Falsch B"
        richtig: false
        begruendung: "Und diese hier ebenfalls, mit genug Woertern."
  - id: p-2
    frage: "Zweite Frage?"
    antworten:
      - text: "Richtig"
        richtig: true
        begruendung: "Die zweite Frage braucht eigene Begruendungen hier."
      - text: "Falsch A"
        richtig: false
        begruendung: "Auch fuer sie gilt: genug Woerter, eigener Text."
      - text: "Falsch B"
        richtig: false
        begruendung: "Und diese dritte unterscheidet sich ebenfalls davon."
transfer:
  id: p-t
  frage: "Transferfrage?"
  antworten:
    - text: "Richtig"
      richtig: true
      begruendung: "Der Transfer traegt wiederum eigene Begruendungen mit."
    - text: "Falsch A"
      richtig: false
      begruendung: "Diese hier steht nur an dieser einen Stelle so."
    - text: "Falsch B"
      richtig: false
      begruendung: "Und die letzte unterscheidet sich von allen anderen."
quellen:
  - pfad: "rag_tutorials/corrective_rag"
---

Ein Widerspruch in Prosa.
`;

/**
 * Liest die Maengel aus einem Ergebnis, das fehlschlagen musste.
 *
 * Derselbe Griff wie in `tests/widget-pruefung.test.ts`: `expect(e.ok).toBe(false)`
 * ueberzeugt zwar den Testlauf, verengt aber die Union nicht — `astro check`
 * kennt `maengel` danach immer noch nicht. Die Verengung muss im Typsystem
 * stattfinden, nicht in der Zusicherung.
 */
function maengelVon(ergebnis: ReturnType<typeof pruefeLektionsText>): readonly string[] {
  if (ergebnis.ok) throw new Error('Erwartet war ein Fehlschlag, die Pruefung war aber zufrieden.');
  return ergebnis.maengel;
}

describe('pruefeLektionsText', () => {
  it('nimmt eine gueltige Lektion an', () => {
    const e = pruefeLektionsText(gute);
    if (!e.ok) throw new Error(`Erwartet war Erfolg, gemeldet wurde:\n  ${e.maengel.join('\n  ')}`);
    expect(e.ok).toBe(true);
    expect(e.daten.titel).toBe('Ein Prinzip');
  });

  it('lehnt zwei richtige Antworten ab und sagt warum', () => {
    const kaputt = gute.replace(
      'text: "Falsch A"\n        richtig: false',
      'text: "Falsch A"\n        richtig: true',
    );
    const maengel = maengelVon(pruefeLektionsText(kaputt));
    expect(maengel.join(' ')).toMatch(/genau eine/i);
  });

  it('lehnt eine Lektion ohne Frontmatter ab', () => {
    const maengel = maengelVon(pruefeLektionsText('Nur Prosa, kein Frontmatter.'));
    expect(maengel.join(' ')).toMatch(/frontmatter/i);
  });

  it('lehnt kaputtes YAML ab, ohne abzustuerzen', () => {
    const maengel = maengelVon(pruefeLektionsText('---\ntitel: "unbeendet\n---\n'));
    expect(maengel.length).toBeGreaterThan(0);
  });

  it('meldet einen ungueltigen Widget-Aufruf im Rumpf', () => {
    const mitWidget = gute + '\n<Pipeline schritte={[]} ergebnisse={[]} />\n';
    const maengel = maengelVon(pruefeLektionsText(mitWidget));
    expect(maengel.join(' ')).toMatch(/Pipeline/);
  });

  it('meldet einen unbekannten Widget-Namen im Rumpf', () => {
    const mitWidget = gute + '\n<GibtEsNicht foo={1} />\n';
    const maengel = maengelVon(pruefeLektionsText(mitWidget));
    expect(maengel.join(' ')).toMatch(/GibtEsNicht/);
  });

  /**
   * Der Fall, der unter Windows lautlos danebengeht.
   *
   * Das Projekt laeuft mit `autocrlf=true`; die von Hand geschriebene Lektion
   * unter `inhalt/lektionen/` hat tatsaechlich CRLF. Ein Frontmatter-Muster
   * ohne `\r?` findet dort keinen Kopf und meldet „kein Frontmatter" — bei
   * einer vollkommen gueltigen Datei.
   *
   * Beide Formen werden aus einer erst auf LF vereinheitlichten Vorlage
   * gebaut, nicht aus `gute` direkt. Sonst haengt der Test daran, wie git
   * diese Testdatei gerade ausgecheckt hat: Bei `autocrlf=true` traegt sie
   * nach einem frischen Klon selbst CRLF, ein blindes `\n` → `\r\n` erzeugte
   * daraus `\r\r\n`, und der Test fiele um — nicht wegen der Pruefung,
   * sondern wegen seiner eigenen Vorlage.
   */
  const alsLf = gute.replace(/\r\n/g, '\n');
  const alsCrlf = alsLf.replace(/\n/g, '\r\n');

  it('erkennt das Frontmatter bei LF-Zeilenenden', () => {
    expect(alsLf).not.toContain('\r');
    const e = pruefeLektionsText(alsLf);
    if (!e.ok) throw new Error(`LF bricht das Frontmatter:\n  ${e.maengel.join('\n  ')}`);
    expect(e.daten.titel).toBe('Ein Prinzip');
  });

  it('erkennt das Frontmatter auch bei CRLF-Zeilenenden', () => {
    expect(alsCrlf).toContain('\r\n');
    expect(alsCrlf).not.toContain('\r\r');
    const e = pruefeLektionsText(alsCrlf);
    if (!e.ok) throw new Error(`CRLF bricht das Frontmatter:\n  ${e.maengel.join('\n  ')}`);
    expect(e.daten.titel).toBe('Ein Prinzip');
  });

  /**
   * Widget-Parameter stehen im echten Material ueber viele Zeilen und
   * enthalten geschachtelte Klammern. Genau daran scheitert ein selbstgebauter
   * Halbparser — deshalb steht der Fall hier und nicht nur im einzeiligen
   * Beispiel oben.
   */
  it('wertet mehrzeilige, geschachtelte Widget-Parameter aus', () => {
    const mitWidget =
      gute +
      `
<Pipeline
  einheit="Dokument"
  schritte={[
    { id: 'suche', titel: 'Suche', wirkung: 'Holt Kandidaten.' },
    { id: 'bm25', titel: '+ BM25', wirkung: 'Sucht woertlich.', optional: true, standardAn: false },
    { id: 'kontext', titel: 'Top 5', wirkung: 'Nur die sieht das Modell.' }
  ]}
  ergebnisse={[
    { wenn: [], ausgabe: [{ text: 'A', treffer: false }], hinweis: 'ohne BM25' },
    { wenn: ['bm25'], ausgabe: [{ text: 'B', treffer: true }], hinweis: 'mit BM25' }
  ]}
/>
`;
    const e = pruefeLektionsText(mitWidget);
    if (!e.ok) throw new Error(`Erwartet war Erfolg, gemeldet wurde:\n  ${e.maengel.join('\n  ')}`);
    expect(e.ok).toBe(true);
  });
});
