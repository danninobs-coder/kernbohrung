// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import Bestand from '../src/components/Bestand.astro';
import type { Abdeckung, Bestand as Quellenbestand } from '../src/lib/abdeckung';
import type { Ungueltig } from '../src/lib/lehrplan';

/**
 * Die Darstellung des Bestands, gerendert mit dem Container von Astro.
 *
 * Buch und Folien gibt es im echten Bestand noch nicht; ohne diesen Test
 * liefe ihre Darstellung zum ersten Mal, wenn das Einlesen fertig ist. Die
 * Faelle hier sind von Hand gebaut und laufen nicht durch `abdeckung` — was
 * `abdeckung` rechnet, prueft `tests/abdeckung.test.ts`.
 *
 * `experimental_AstroContainer` heisst so, weil Astro die Schnittstelle noch
 * aendern darf. Bricht dieser Test nach einem Update von Astro, liegt es
 * vermutlich daran. Umgebung `node`: Unter jsdom erkennt Astro die Komponente
 * nicht und meldet „No valid renderer".
 */

const TITEL = new Map([
  ['kein-boden-ist-ein-boden', 'Kein Boden ist auch ein Boden'],
  ['pauschal-heisst-nicht-komplett', 'Pauschal heißt nicht komplett'],
  ['recall-vor-precision', 'Recall und Precision sind zwei Probleme, nicht eins'],
]);

const repo: Quellenbestand = {
  quelle: 'awesome-llm-apps',
  art: 'repo',
  titel: 'awesome-llm-apps',
  stand: 'a13701eae315a81e1011a4304a6b5e741ea0a984',
  zaehlung: { gesamt: 2, mitLektion: 1, offen: 1, beauftragt: 0, abgelehnt: 0 },
  luecken: { art: 'git', uebernommen: 62, ausgelassen: 44 },
  zeilen: [
    {
      id: 'kein-boden-ist-ein-boden',
      titel: 'Wer keine Relevanzschwelle setzt, hat sie auf minus unendlich gesetzt.',
      status: 'lektion',
      lektion: 'kein-boden-ist-ein-boden',
      vorbehalte: [],
    },
    { id: 'vertrauen-ist-herkunft', titel: 'Vertrauen hängt an der Herkunft.', status: 'offen', vorbehalte: [] },
  ],
};

const folien: Quellenbestand = {
  quelle: 'bauch-projektmanagement',
  art: 'folien',
  titel: 'Projektmanagement',
  stand: `sha256:${'b'.repeat(64)}`,
  zaehlung: { gesamt: 2, mitLektion: 1, offen: 0, beauftragt: 0, abgelehnt: 1 },
  luecken: { art: 'dokument', einheit: 'folien', seiten: 35, nurBild: 7, tabellenverdacht: 2 },
  zeilen: [
    {
      id: 'm07-2-vertragsarten',
      titel: 'Risikomanagement und Vertragswesen',
      status: 'lektion',
      lektion: 'pauschal-heisst-nicht-komplett',
      datei: 'M7 Risikomanagement 26.pdf',
      seiten: [28, 34],
      vorbehalte: ['Für die Behaltensquoten gibt es keine belastbare Studie.'],
    },
    {
      id: 'm07-3-titel',
      titel: 'Titelfolien',
      status: 'abgelehnt',
      grund: 'reine Titelfolien',
      datei: 'M7 Risikomanagement 26.pdf',
      seiten: [35, 35],
      vorbehalte: [],
    },
  ],
};

const nichts: Abdeckung = { bestand: [], ohneLehrplan: [] };

async function rendere(abdeckung: Abdeckung, ungueltig: readonly Ungueltig[] = []): Promise<string> {
  const container = await AstroContainer.create();
  return container.renderToString(Bestand, { props: { abdeckung, ungueltig, lektionstitel: TITEL } });
}

/** Das Stueck HTML einer Zeile — damit ein Treffer nicht aus der Nachbarzeile stammt. */
function zeileMit(html: string, status: string): string {
  const anfang = html.indexOf(`<li class="zeile" data-status="${status}">`);
  if (anfang < 0) throw new Error(`Keine Zeile mit Status ${status}.`);
  return html.slice(anfang, html.indexOf('</li>', anfang));
}

describe('Bestand - die Karte einer Quelle', () => {
  it('zeigt Titel, Kopfzeile, Zahlen und Luecken', async () => {
    const html = await rendere({ bestand: [repo], ohneLehrplan: [] });
    expect(html).toContain('<h2>awesome-llm-apps</h2>');
    expect(html).toContain('<p class="quelle-kopf">Repo · Stand a13701e</p>');
    expect(html).toContain('<p class="quelle-zahlen">2 Prinzipien · 1 mit Lektion · 1 offen</p>');
    expect(html).toContain('<p class="quelle-luecken"><strong>Lücken:</strong> 44 von 106 Dateien nicht übernommen</p>');
  });

  it('klappt die Prinzipien mit details und summary auf — ohne ein Skript', async () => {
    const html = await rendere({ bestand: [repo], ohneLehrplan: [] });
    expect(html).toContain('<details class="quelle-liste"><summary>Alle Prinzipien</summary>');
    expect(html).not.toContain('<script');
  });

  it('verweist bei einer Zeile mit Lektion auf die Lektion, unter ihrem Titel', async () => {
    const zeile = zeileMit(await rendere({ bestand: [repo], ohneLehrplan: [] }), 'lektion');
    expect(zeile).toContain('<span class="zeile-marke">mit Lektion</span>');
    // Mit Trennzeichen: Ohne es liefen Marke und Titel beim Vorlesen ineinander.
    expect(zeile).toContain('mit Lektion</span> · <a href="/lektion/kein-boden-ist-ein-boden/">Kein Boden ist auch ein Boden</a>');
  });

  it('nennt bei einer offenen Zeile den Status und verweist nirgendwohin', async () => {
    const zeile = zeileMit(await rendere({ bestand: [repo], ohneLehrplan: [] }), 'offen');
    expect(zeile).toContain('<span class="zeile-marke">offen</span>');
    expect(zeile).not.toContain('<a ');
  });

  it('zeigt bei Folien Fundstelle, Grund und Vorbehalt', async () => {
    const html = await rendere({ bestand: [folien], ohneLehrplan: [] });
    expect(html).toContain('<summary>Alle Abschnitte</summary>');
    expect(html).toContain('7 von 35 Folien nur Bild · 2 Tabellen vermutlich zerfallen');
    const lektion = zeileMit(html, 'lektion');
    expect(lektion).toContain('<p class="zeile-fundstelle">M7 Risikomanagement 26.pdf, Folien 28–34</p>');
    expect(lektion).toContain(
      '<p class="zeile-vorbehalt"><strong>Vorbehalt:</strong> Für die Behaltensquoten gibt es keine belastbare Studie.</p>',
    );
    const abgelehnt = zeileMit(html, 'abgelehnt');
    expect(abgelehnt).toContain('<p class="zeile-fundstelle">M7 Risikomanagement 26.pdf, Folie 35</p>');
    expect(abgelehnt).toContain('<p class="zeile-grund"><strong>Grund:</strong> reine Titelfolien</p>');
  });

  it('sagt ohne Manifest, dass die Luecken unbekannt sind, statt die Zeile wegzulassen', async () => {
    const html = await rendere({ bestand: [{ ...repo, luecken: { art: 'fehlt' } }], ohneLehrplan: [] });
    expect(html).toContain(
      '<strong>Lücken:</strong> unbekannt — das Manifest liegt nur am Rechner, auf dem eingelesen wurde</p>',
    );
  });
});

describe('Bestand - Warnungen und leerer Bestand', () => {
  it('warnt vor Lektionen ohne Lehrplaneintrag und verweist auf sie', async () => {
    const html = await rendere({ bestand: [repo], ohneLehrplan: ['recall-vor-precision'] });
    expect(html).toContain('<h2>Lektionen ohne Lehrplaneintrag</h2>');
    expect(html).toContain(
      'Auf diese Lektionen zeigt kein Prinzip und kein Abschnitt eines gültigen Lehrplans. Ihre Herkunft ist damit nicht geprüft, und sie zählen hier nicht als Abdeckung. Ob sie nachgetragen oder entfernt werden, entscheidest du.',
    );
    expect(html).toContain('<a href="/lektion/recall-vor-precision/">Recall und Precision sind zwei Probleme, nicht eins</a>');
  });

  it('zeigt ungueltige Lehrplaene mit ihren Maengeln', async () => {
    const html = await rendere(nichts, [
      { datei: 'awesome-llm-apps.yaml', maengel: ['geprueftVon: geprueftVon fehlt — der Lehrplan ist das Review-Gate.'] },
    ]);
    expect(html).toContain('<h2>Lehrpläne, die die Prüfung nicht bestehen</h2>');
    expect(html).toContain(
      'Aus diesen Dateien zeigt die Seite keine Zahlen. Auch ein Lehrplan, der noch auf die Freigabe wartet — geprueftVon ist leer —, steht hier.',
    );
    expect(html).toContain('<h3>awesome-llm-apps.yaml</h3>');
    expect(html).toContain('<code>geprueftVon: geprueftVon fehlt — der Lehrplan ist das Review-Gate.</code>');
  });

  it('warnt nicht, wo es nichts zu warnen gibt', async () => {
    const html = await rendere({ bestand: [repo], ohneLehrplan: [] });
    expect(html).not.toContain('bestand-warnung');
  });

  it('sagt bei leerem Bestand, dass kein Lehrplan vorliegt', async () => {
    expect(await rendere(nichts)).toContain('<p class="bestand-leer">Es liegt kein Lehrplan vor.</p>');
  });

  it('sagt das nicht, wenn es Lehrplaene gibt, die nur ungueltig sind', async () => {
    const html = await rendere(nichts, [{ datei: 'x.yaml', maengel: ['art: unbekannt'] }]);
    expect(html).not.toContain('bestand-leer');
  });
});
