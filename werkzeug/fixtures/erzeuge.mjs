#!/usr/bin/env node
/**
 * Erzeugt die Test-PDFs unter `tests/fixtures/`.
 *
 * Aufruf: `node werkzeug/fixtures/erzeuge.mjs tests/fixtures`
 *
 * Warum ein Skript und nicht ein paar beigelegte Dateien: Eine Fixture, die
 * niemand herstellen kann, ist eine Behauptung. Hier steht, was in jeder
 * Datei steckt — Briefkopf mit laufender Foliennummer, Agendafolie,
 * Titellaeufe, eine Bildfolie, eine Tabellenfolie, eine Silbentrennung —, und
 * genau darauf zeigen die Tests.
 *
 * Deterministisch: feste Erstellungs- und Aenderungszeit, fester Producer,
 * `useObjectStreams: false`. Zweimal erzeugt ergibt byte-gleiche Dateien;
 * `tests/fixtures-erzeugen.test.ts` haelt das fest. Waere es nicht so, aenderte
 * jeder Lauf die committeten PDFs.
 *
 * Der Text ist erfunden. Nichts hier stammt aus fremdem Lehrmaterial.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { crc32, deflateSync } from 'node:zlib';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

/**
 * @typedef {import('pdf-lib').PDFPage} PDFPage
 * @typedef {{ doc: PDFDocument, schrift: { normal: import('pdf-lib').PDFFont, fett: import('pdf-lib').PDFFont }, logo: import('pdf-lib').PDFImage, foto: import('pdf-lib').PDFImage }} Mappe
 * @typedef {{ art: 'titel' | 'agenda' | 'bild' | 'tabelle' | 'inhalt', titel?: string }} Folieneintrag
 */

/** Feste Zeitstempel: ohne sie steht in jedem Lauf ein anderes Datum im PDF. */
const FEST = new Date('2026-01-01T00:00:00Z');
/** @type {[number, number]} */
const QUER = [842, 595];
/** @type {[number, number]} */
const HOCH = [595, 842];

/** Die Dateien, die dieses Skript schreibt — in der Reihenfolge der Ausgabe. */
export const FIXTURES = [
  'folien-agenda.pdf',
  'folien-laeufe.pdf',
  'folien-gleichmaessig.pdf',
  'folien-scan.pdf',
  'folien-wenig-text.pdf',
  'buch-hochformat.pdf',
];

// ---------------------------------------------------------------------------
// PNG ohne Abhaengigkeit: IHDR/IDAT/IEND von Hand, `crc32` kommt aus node:zlib.

/**
 * @param {number} breite
 * @param {number} hoehe
 * @param {(x: number, y: number) => number[]} farbe
 * @returns {Buffer}
 */
function png(breite, hoehe, farbe) {
  const zeilenbreite = breite * 3 + 1;
  const roh = Buffer.alloc(zeilenbreite * hoehe);
  for (let y = 0; y < hoehe; y++) {
    for (let x = 0; x < breite; x++) roh.set(farbe(x, y), y * zeilenbreite + 1 + x * 3);
  }
  /** @type {(typ: string, daten: Buffer) => Buffer} */
  const block = (typ, daten) => {
    const laenge = Buffer.alloc(4);
    laenge.writeUInt32BE(daten.length);
    const inhalt = Buffer.concat([Buffer.from(typ, 'latin1'), daten]);
    const pruefsumme = Buffer.alloc(4);
    pruefsumme.writeUInt32BE(crc32(inhalt));
    return Buffer.concat([laenge, inhalt, pruefsumme]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(breite, 0);
  ihdr.writeUInt32BE(hoehe, 4);
  ihdr[8] = 8; // Bittiefe
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    block('IHDR', ihdr),
    block('IDAT', deflateSync(roh)),
    block('IEND', Buffer.alloc(0)),
  ]);
}

/** Das Logo im Briefkopf: dieselbe Groesse an derselben Stelle auf jeder Folie. */
const LOGO = png(12, 4, (x) => (x < 6 ? [0, 70, 140] : [200, 30, 30]));
/** Ein Bild im Inhalt — wechselnde Groesse, wechselnde Stelle. */
const FOTO = png(16, 12, (x, y) => [(x * 16) & 255, (y * 21) & 255, 120]);

/** @returns {Promise<Mappe>} */
async function neuesDokument() {
  const doc = await PDFDocument.create();
  doc.setCreationDate(FEST);
  doc.setModificationDate(FEST);
  doc.setProducer('kernbohrung-fixtures');
  doc.setCreator('kernbohrung-fixtures');
  return {
    doc,
    schrift: {
      normal: await doc.embedFont(StandardFonts.Helvetica),
      fett: await doc.embedFont(StandardFonts.HelveticaBold),
    },
    logo: await doc.embedPng(LOGO),
    foto: await doc.embedPng(FOTO),
  };
}

// ---------------------------------------------------------------------------
// Foliensaetze

/**
 * Der Briefkopf: drei Zeilen und das Logo, auf jeder Folie an derselben
 * Stelle, im oberen und unteren Randstreifen. Die Foliennummer laeuft mit —
 * daran scheitert die Regel „auf jeder Seite identisch".
 *
 * @param {PDFPage} seite
 * @param {Mappe} m
 * @param {number} nummer
 */
function briefkopf(seite, m, nummer) {
  seite.drawText('Projektmanagement – Fixture-Vorlesung – Musterhochschule', { x: 60, y: 551, size: 12, font: m.schrift.normal });
  seite.drawText(`Folie ${nummer}`, { x: 760, y: 551, size: 11, font: m.schrift.normal });
  seite.drawText('Lehrstuhl Beispiel · Sommersemester 2026', { x: 45, y: 34, size: 9, font: m.schrift.normal });
  seite.drawImage(m.logo, { x: 712, y: 16, width: 84, height: 28 });
}

/** @type {(seite: PDFPage, m: Mappe, text: string) => void} */
const folientitel = (seite, m, text) => seite.drawText(text, { x: 90, y: 495, size: 20, font: m.schrift.fett });

/**
 * @param {PDFPage} seite
 * @param {Mappe} m
 * @param {string[]} zeilen
 * @param {number} [y0]
 */
function punkte(seite, m, zeilen, y0 = 430) {
  zeilen.forEach((z, i) => seite.drawText(z, { x: 100, y: y0 - i * 26, size: 15, font: m.schrift.normal }));
}

const SAETZE = [
  'Die Projektsteuerung koordiniert alle Beteiligten im Auftrag des Bauherrn.',
  'Leistungsbilder beschreiben, welche Aufgaben wann zu erfüllen sind.',
  'Termine und Kosten werden je Leistungsphase fortgeschrieben.',
  'Abweichungen werden früh gemeldet und mit Maßnahmen hinterlegt.',
];

/**
 * Eine Tabellenfolie: Liniengitter (6 waagrecht, 5 senkrecht) und Zahlenzeilen.
 *
 * @param {PDFPage} seite
 * @param {Mappe} m
 * @param {string} titel
 */
function tabellenfolie(seite, m, titel) {
  folientitel(seite, m, titel);
  const x0 = 100;
  const y0 = 420;
  const spaltenbreite = [220, 130, 130, 130];
  const zeilenhoehe = 30;
  const zeilen = [
    ['Kostengruppe', '2025', '2026', 'Diff. %'],
    ['300 Bauwerk', '1.250.000', '1.310.000', '4,8'],
    ['400 Technik', '480.000', '512.000', '6,7'],
    ['500 Außenanlagen', '95.000', '92.500', '-2,6'],
    ['700 Nebenkosten', '310.000', '318.000', '2,6'],
  ];
  zeilen.forEach((zeile, r) => {
    let x = x0;
    zeile.forEach((zelle, c) => {
      seite.drawText(zelle, { x: x + 6, y: y0 - r * zeilenhoehe + 9, size: 12, font: r ? m.schrift.normal : m.schrift.fett });
      x += spaltenbreite[c];
    });
  });
  const breite = spaltenbreite.reduce((a, b) => a + b, 0);
  for (let r = 0; r <= zeilen.length; r++) {
    const y = y0 - r * zeilenhoehe + 30;
    seite.drawLine({ start: { x: x0, y }, end: { x: x0 + breite, y }, thickness: 0.8, color: rgb(0, 0, 0) });
  }
  let x = x0;
  for (let c = 0; c <= spaltenbreite.length; c++) {
    seite.drawLine({ start: { x, y: y0 + 30 }, end: { x, y: y0 + 30 - zeilen.length * zeilenhoehe }, thickness: 0.8, color: rgb(0, 0, 0) });
    x += spaltenbreite[c] ?? 0;
  }
}

/**
 * Die Folien eines Satzes als Plan, bevor gezeichnet wird.
 *
 * @param {{ agenda: boolean, laeufe: boolean }} form
 * @returns {Folieneintrag[]}
 */
function folienplan({ agenda, laeufe }) {
  /** @type {Folieneintrag[]} */
  const plan = [{ art: 'titel' }];
  if (agenda) plan.push({ art: 'agenda' });
  /** @type {(...titel: string[]) => void} */
  const inhalt = (...titel) => titel.forEach((t) => plan.push({ art: 'inhalt', titel: t }));
  if (laeufe) {
    inhalt(
      'Grundlagen der Planung',
      'Grundlagen der Planung',
      'Grundlagen der Planung',
      'Planungsphasen im Überblick',
      'Planungsphasen im Überblick',
      'Begriffe der Projekt-steuerung',
    );
    plan.push({ art: 'bild' });
    inhalt('Zusammenfassung Grundlagen', 'Kosten und Termine', 'Kosten und Termine', 'Kosten und Termine');
    plan.push({ art: 'tabelle', titel: 'Kosten und Termine' });
    inhalt(
      'Terminplanung',
      'Terminplanung',
      'Kostenkennwerte',
      'Beispielrechnung',
      'Risiken im Projekt',
      'Risiken im Projekt',
      'Risiken im Projekt',
      'Risikobewertung',
      'Risikobewertung',
      'Risikosteuerung',
      'Vertragliche Risikoverteilung',
      'Fazit',
    );
  } else {
    plan.push({ art: 'bild' });
    plan.push({ art: 'tabelle', titel: 'Kostenübersicht' });
    // Jeder Titel verschieden: keine Agenda, kein Titellauf, also gleichmaessig.
    for (let i = 1; plan.length < 32; i++) {
      inhalt(`Thema ${i}: ${['Planung', 'Vergabe', 'Bau', 'Abnahme'][i % 4]} im Detail`);
    }
  }
  return plan;
}

/**
 * @param {string} ziel
 * @param {string} name
 * @param {{ agenda: boolean, laeufe: boolean }} form
 * @returns {Promise<number>}
 */
async function foliensatz(ziel, name, form) {
  const m = await neuesDokument();
  folienplan(form).forEach((eintrag, i) => {
    const nummer = i + 1;
    const seite = m.doc.addPage(QUER);
    briefkopf(seite, m, nummer);
    if (eintrag.art === 'titel') {
      seite.drawText('Modul 99', { x: 170, y: 384, size: 15, font: m.schrift.normal });
      seite.drawText('Fixture: Musterprojekt Neubau', { x: 170, y: 355, size: 26, font: m.schrift.fett });
    } else if (eintrag.art === 'agenda') {
      seite.drawText('AGENDA', { x: 166, y: 403, size: 22, font: m.schrift.fett });
      ['Grundlagen der Planung', 'Kosten und Termine', 'Risiken im Projekt'].forEach((z, k) =>
        seite.drawText(z, { x: 226, y: 335 - k * 48, size: 20, font: m.schrift.normal }),
      );
    } else if (eintrag.art === 'bild') {
      // Nur Bild, kein Nutztext — nach Abzug des Briefkopfs bleibt nichts.
      seite.drawImage(m.foto, { x: 150, y: 120, width: 540, height: 380 });
    } else if (eintrag.art === 'tabelle') {
      tabellenfolie(seite, m, eintrag.titel ?? '');
    } else if (eintrag.titel === 'Begriffe der Projekt-steuerung') {
      // Silbentrennung am Zeilenende und ein Ergaenzungsstrich, im selben Textfeld.
      folientitel(seite, m, 'Begriffe');
      punkte(seite, m, [
        '• Die Projekt-',
        'steuerung ist eine delegierbare Bauherrenaufgabe.',
        '• Kosten-',
        'und Terminplanung gehören zusammen.',
      ]);
    } else {
      folientitel(seite, m, eintrag.titel ?? '');
      punkte(seite, m, [
        `• ${SAETZE[nummer % 4]}`,
        `• ${SAETZE[(nummer + 1) % 4]}`,
        `• Beispiel ${nummer}: Planung, Vergabe und Ausführung im Überblick.`,
      ]);
    }
  });
  return speichere(m.doc, ziel, name);
}

/**
 * Fuenf Seiten, die nur ein Bild tragen: keine Textebene, das Einlesen bricht ab.
 *
 * @param {string} ziel
 * @returns {Promise<number>}
 */
async function scan(ziel) {
  const m = await neuesDokument();
  for (let i = 0; i < 5; i++) m.doc.addPage(QUER).drawImage(m.foto, { x: 0, y: 0, width: 842, height: 595 });
  return speichere(m.doc, ziel, 'folien-scan.pdf');
}

/**
 * Sechs Folien mit je einem kurzen Satz: wenig Text ist kein Abbruchgrund.
 *
 * @param {string} ziel
 * @returns {Promise<number>}
 */
async function wenigText(ziel) {
  const m = await neuesDokument();
  // Verschiedene Saetze an wechselnder Stelle: Saetze, die sich nur in einer
  // Zahl unterscheiden und gleich stehen, waeren Beiwerk — ein anderer Fall.
  const saetze = [
    'Kosten früh schätzen.',
    'Termine laufend fortschreiben.',
    'Risiken benennen und bewerten.',
    'Verträge sorgfältig prüfen.',
    'Nachträge dokumentieren.',
    'Abnahme vorbereiten.',
  ];
  saetze.forEach((satz, i) => {
    m.doc.addPage(QUER).drawText(satz, { x: 100, y: 300 - i * 20, size: 18, font: m.schrift.normal });
  });
  return speichere(m.doc, ziel, 'folien-wenig-text.pdf');
}

// ---------------------------------------------------------------------------
// Hochformat: das Gegenstueck zur Art-Erkennung. 2b-1 liest es nicht ein.

const WOERTER = ['Planung', 'Bauherr', 'Vertrag', 'Leistung', 'Termin', 'Kosten', 'Qualität', 'Risiko', 'Projekt', 'Steuerung', 'Abnahme', 'Nachtrag', 'Vergabe', 'Ausführung', 'Honorar', 'Bauablauf'];

/**
 * Ein Satz aus festem Zufall: derselbe Index ergibt denselben Satz.
 *
 * @param {number} n
 * @returns {string}
 */
function satz(n) {
  let s = n * 7919 + 13;
  const zufall = () => ((s = (s * 1103515245 + 12345) % 2147483648), s / 2147483648);
  const woerter = Array.from({ length: 9 + Math.floor(zufall() * 6) }, () => WOERTER[Math.floor(zufall() * WOERTER.length)].toLowerCase());
  woerter[0] = woerter[0][0].toUpperCase() + woerter[0].slice(1);
  return `${woerter.join(' ')} und die übrigen Beteiligten stimmen sich ab.`;
}

/**
 * @param {string} ziel
 * @returns {Promise<number>}
 */
async function hochformat(ziel) {
  const m = await neuesDokument();
  let seitenNummer = 0;
  let satzNummer = 0;
  for (let kapitel = 1; kapitel <= 3; kapitel++) {
    for (let s = 0; s < 4; s++) {
      const seite = m.doc.addPage(HOCH);
      seitenNummer++;
      // Kolumnentitel und Seitenzahl: das Beiwerk eines Buchs.
      seite.drawText(`Musterbuch Projektmanagement · Kapitel ${kapitel}`, { x: 70, y: 800, size: 9, font: m.schrift.normal });
      seite.drawText(`— ${seitenNummer} —`, { x: 280, y: 30, size: 9, font: m.schrift.normal });
      let y = 760;
      if (s === 0) {
        seite.drawText(`Kapitel ${kapitel}`, { x: 70, y, size: 20, font: m.schrift.fett });
        y -= 30;
      }
      for (let i = 0; i < 45 && y > 70; i++) {
        let zeile = satz(satzNummer++);
        // Eine Silbentrennung am Zeilenende, alle siebzehn Saetze.
        if (satzNummer % 17 === 0) zeile = zeile.replace(/ und die übrigen.*$/, ' sowie die Projekt-');
        if (satzNummer % 17 === 1 && satzNummer > 1) zeile = `steuerung ${zeile[0].toLowerCase()}${zeile.slice(1)}`;
        seite.drawText(zeile.slice(0, 95), { x: 70, y, size: 10.5, font: m.schrift.normal });
        y -= 15;
      }
    }
  }
  return speichere(m.doc, ziel, 'buch-hochformat.pdf');
}

// ---------------------------------------------------------------------------

/**
 * @param {PDFDocument} doc
 * @param {string} ziel
 * @param {string} name
 * @returns {Promise<number>}
 */
async function speichere(doc, ziel, name) {
  const bytes = await doc.save({ useObjectStreams: false });
  writeFileSync(path.join(ziel, name), bytes);
  return bytes.length;
}

/**
 * Schreibt alle Fixtures nach `ziel`.
 *
 * @param {string} ziel Ordner, wird angelegt, wenn er fehlt
 * @returns {Promise<Map<string, number>>} Dateiname -> Groesse in Bytes
 */
export async function erzeugeFixtures(ziel) {
  mkdirSync(ziel, { recursive: true });
  /** @type {Map<string, number>} */
  const groessen = new Map();
  groessen.set('folien-agenda.pdf', await foliensatz(ziel, 'folien-agenda.pdf', { agenda: true, laeufe: true }));
  groessen.set('folien-laeufe.pdf', await foliensatz(ziel, 'folien-laeufe.pdf', { agenda: false, laeufe: true }));
  groessen.set('folien-gleichmaessig.pdf', await foliensatz(ziel, 'folien-gleichmaessig.pdf', { agenda: false, laeufe: false }));
  groessen.set('folien-scan.pdf', await scan(ziel));
  groessen.set('folien-wenig-text.pdf', await wenigText(ziel));
  groessen.set('buch-hochformat.pdf', await hochformat(ziel));
  return groessen;
}

// Direkt aufgerufen: schreiben und auflisten. Importiert: nur die Funktion.
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const ziel = path.resolve(process.argv[2] ?? 'tests/fixtures');
  const groessen = await erzeugeFixtures(ziel);
  for (const [name, bytes] of groessen) console.log(`${name.padEnd(26)} ${String(bytes).padStart(7)} Bytes`);
  console.log(`${groessen.size} Fixtures in ${ziel}`);
}
