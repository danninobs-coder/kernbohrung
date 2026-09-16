import { describe, it, expect } from 'vitest';
import { relativiere, schreibeUm, tiefeVon, benenneIndex } from '../werkzeug/relative-verweise.mjs';

describe('relativiere', () => {
  it('laesst einen Pfad auf Tiefe 0 im selben Verzeichnis', () => {
    expect(relativiere('/_astro/a.css', 0)).toBe('./_astro/a.css');
  });

  it('steigt je Verzeichnis eine Ebene hinauf', () => {
    expect(relativiere('/_astro/a.css', 2)).toBe('../../_astro/a.css');
    expect(relativiere('/lektion/x/', 2)).toBe('../../lektion/x/index.html');
  });

  it('macht aus der blossen Wurzel keinen leeren Verweis', () => {
    // Ein leeres href zeigt auf die Seite selbst — auf Tiefe 0 waere das
    // zufaellig richtig, auf Tiefe 2 grob falsch.
    expect(relativiere('/', 0)).toBe('./index.html');
    expect(relativiere('/', 2)).toBe('../../index.html');
  });

  it('fasst Ziele mit Schema nicht an', () => {
    for (const ziel of ['https://fonts.googleapis.com/x', 'data:image/png;base64,AA', 'mailto:a@b.de', '#takt-3']) {
      expect(relativiere(ziel, 2)).toBe(ziel);
    }
  });

  it('fasst schemalose Verweise auf fremde Rechner nicht an', () => {
    // //cdn.example.com/x uebernimmt das Schema der Seite und ist NICHT
    // wurzelbezogen. Ein naives startsWith('/') wuerde es zerstoeren.
    expect(relativiere('//cdn.example.com/x.js', 2)).toBe('//cdn.example.com/x.js');
  });

  it('laesst bereits relative Ziele in Ruhe', () => {
    expect(relativiere('bild.svg', 2)).toBe('bild.svg');
    expect(relativiere('../a/b.css', 1)).toBe('../a/b.css');
  });
});

describe('schreibeUm', () => {
  it('schreibt href und src um und zaehlt sie', () => {
    const { html, umgeschrieben } = schreibeUm(
      '<link href="/_astro/a.css"><script src="/_astro/b.js"></script>',
      2,
    );
    expect(html).toBe('<link href="../../_astro/a.css"><script src="../../_astro/b.js"></script>');
    expect(umgeschrieben).toBe(2);
  });

  it('laesst fremde Ziele stehen und zaehlt sie nicht mit', () => {
    const quelle = '<link href="https://fonts.googleapis.com/css2?family=Syne"><a href="#x">y</a>';
    const { html, umgeschrieben } = schreibeUm(quelle, 2);
    expect(html).toBe(quelle);
    expect(umgeschrieben).toBe(0);
  });

  it('kommt mit einfachen Anfuehrungszeichen zurecht', () => {
    expect(schreibeUm("<a href='/lektion/x/'>", 1).html).toBe("<a href='../lektion/x/index.html'>");
  });

  it('zerlegt srcset in seine Ziele und laesst die Massangaben stehen', () => {
    const { html, umgeschrieben } = schreibeUm(
      '<img srcset="/a.png 1x, /b.png 2x, https://c.de/d.png 3x">',
      1,
    );
    expect(html).toBe('<img srcset="../a.png 1x, ../b.png 2x, https://c.de/d.png 3x">');
    expect(umgeschrieben).toBe(2);
  });

  it('zerstoert ein Frage-Fragment im Ziel nicht', () => {
    expect(schreibeUm('<a href="/lektion/x/?a=1#takt-4">', 2).html).toBe(
      '<a href="../../lektion/x/index.html?a=1#takt-4">',
    );
  });

  it('ist ein zweiter Lauf wirkungslos', () => {
    // Das Werkzeug laeuft nach jedem Bau. Liefe es versehentlich zweimal,
    // duerfen die Verweise nicht ein zweites Mal hinaufsteigen.
    const einmal = schreibeUm('<link href="/a.css">', 2).html;
    const zweimal = schreibeUm(einmal, 2);
    expect(zweimal.html).toBe(einmal);
    expect(zweimal.umgeschrieben).toBe(0);
  });
});

describe('tiefeVon', () => {
  it('zaehlt die Verzeichnisse zwischen Wurzel und Datei', () => {
    expect(tiefeVon('dist', 'dist/index.html')).toBe(0);
    expect(tiefeVon('dist', 'dist/lektion/x/index.html')).toBe(2);
  });
});

describe('benenneIndex', () => {
  it('macht aus einem Verzeichnisverweis einen Dateiverweis', () => {
    // Ein Ort, der nur veroeffentlichte Pfade kennt, findet unter "x/" nichts
    // und liefert nichts — ohne Fehlermeldung. index.html geht ueberall.
    expect(benenneIndex('../lektion/x/')).toBe('../lektion/x/index.html');
    expect(benenneIndex('./')).toBe('./index.html');
  });

  it('laesst Dateiverweise in Ruhe', () => {
    expect(benenneIndex('../_astro/a.css')).toBe('../_astro/a.css');
    expect(benenneIndex('./favicon.svg')).toBe('./favicon.svg');
  });

  it('haengt den Frage- und Rautenteil hinten an, nicht in die Mitte', () => {
    expect(benenneIndex('../x/?a=1')).toBe('../x/index.html?a=1');
    expect(benenneIndex('../x/#takt-4')).toBe('../x/index.html#takt-4');
  });
});

describe('die Astro-Inselverweise', () => {
  it('schreibt component-url und renderer-url um', () => {
    // An diesen beiden haengt die Hydrierung. Sie sind weder href noch src:
    // Wer nur die beiden umschreibt, bekommt eine Seite, die richtig aussieht
    // und auf keinen Knopf reagiert.
    const quelle =
      '<astro-island uid="a" component-url="/_astro/Frage.js" renderer-url="/_astro/client.js"></astro-island>';
    const { html, umgeschrieben } = schreibeUm(quelle, 2);
    expect(html).toContain('component-url="../../_astro/Frage.js"');
    expect(html).toContain('renderer-url="../../_astro/client.js"');
    expect(umgeschrieben).toBe(2);
  });

  it('laesst component-export in Ruhe, das ist kein Pfad', () => {
    const quelle = '<astro-island component-export="default" opts="{}"></astro-island>';
    expect(schreibeUm(quelle, 2).html).toBe(quelle);
  });
});
