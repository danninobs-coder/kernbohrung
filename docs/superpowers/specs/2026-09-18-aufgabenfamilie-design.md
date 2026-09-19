# Aufgabenfamilie — fachneutrales Lernformat

Stand: 2026-09-18 · präzisiert am 2026-09-19 beim Schreiben des Plans · Teilprojekt 1 von 3 (Aufgabenfamilie → Bibliothek → Lernprofil)

## Ziel

Die App kann heute genau eine Sache abfragen: eine Wahlfrage mit drei bis fünf Antworten, eine davon richtig. Das steht nicht als Voreinstellung im Schema, sondern als das Einzige, was das Schema ausdrücken kann. Damit ist die App an das gebunden, wofür sie gebaut wurde — Prinzipien aus einem RAG-Repo.

Nach diesem Teilprojekt ist der Aufgabentyp eine Eigenschaft der Aufgabe, nicht der App. Vier Typen für Fach- und Regelwissen sind gebaut, geprüft und am Handy bedienbar. Hülle, Ereignis, Speicher und Tutor kennen den Typ nur als Feld — Mathe und Programmieren docken später als weitere Ordner an, ohne dass sich an diesen Schichten etwas ändert.

## Nicht Ziel

- Der Compiler-Skill lernt die neuen Typen **nicht** in diesem Teilprojekt. Ohne Lehrbuch-Ingest liefe er leer; er gehört zur Bibliothek.
- Keine Landkarte, keine KI-Bewertung, kein Mathe, kein Code.
- `anteil` wird gespeichert, aber **nicht** in die Terminplanung eingerechnet (Begründung unten).

## Entscheidungen

| Frage | Entscheidung | Warum |
|---|---|---|
| Erstes Fach | Fach- und Regelwissen | Nutzerwahl. Vier Typen decken es ab, ohne Formelsatz oder Code-Ausführung. |
| Bewertung freier Falllösungen | Prüfpunkte, Selbstbewertung | Offline, kostenlos, der Text verlässt das Gerät nicht. KI-Rückmeldung bewertet später gegen dieselben Prüfpunkte — kein Umbau. |
| Architektur | Familie mit diskriminierter Union | Strenge Prüfung generierter Inhalte bleibt. Ein Baukasten könnte Unsinn nicht mehr verbieten. |
| Ziehen mit dem Finger | Nein — nur Antippen und Knöpfe | Drag-and-drop ist auf Android in der Seite unzuverlässig und schließt Tastatur und Screenreader aus. |
| `richtig` | bleibt binär | Planer und Kalibrierung sehen nur `richtig` und `zuversicht`. Sie ändern sich nicht. |
| `anteil` | speichern, nicht planen | Ob drei von vier Paaren „Hard" oder „Again" sind, ist mit Daten zu beantworten, nicht mit einer Annahme. Der Wert liegt dann vor. |

## Die Familie

```
src/aufgaben/
  Aufgabentyp.tsx       Verteiler: switch über typ, mit never-Prüfung auf Vollständigkeit
  schema.ts             AufgabeSchema = z.discriminatedUnion('typ', [...])
  vertrag.ts            Ergebnis, Abgabe, Phase, TypProps — der Vertrag mit der Hülle
  wahl/       schema.ts  Wahl.tsx        bewerten.ts
  fall/       schema.ts  Fall.tsx        bewerten.ts
  zuordnen/   schema.ts  Zuordnen.tsx    bewerten.ts
  reihenfolge/schema.ts  Reihenfolge.tsx bewerten.ts
src/components/
  Aufgabe.tsx           die Hülle (ersetzt Frage.tsx)
  Zuversicht.tsx        unverändert
```

Jeder Typ hat drei Dateien mit je einer Aufgabe: `schema.ts` sagt, was der Typ ausdrücken darf; `<Typ>.tsx` zeigt und bedient; `bewerten.ts` ist eine reine Funktion Eingabe → Ergebnis, ohne React, in Isolation testbar.

`schema.ts` an der Wurzel bildet die diskriminierte Union über `typ`. Ein Generator kann keinen Mischtyp erfinden; ein fremdes Feld bleibt ein Fehler (`strictObject`), kein stilles Verwerfen. Das ist dieselbe Strenge wie heute in `widgets/schema.ts`, und aus demselben Grund: Ein Zusatzfeld ist das wahrscheinlichste Symptom eines halluzinierenden Generators.

Gemeinsame Felder aller Typen: `typ`, `id` (Kennung, eindeutig je Lektion, Muster wie heute).

### wahl

Unverändert bis auf das Feld `typ: 'wahl'`. Felder `frage`, `antworten[]` mit `text`, `richtig`, `begruendung`; alle heutigen Regeln (3–5 Antworten, genau eine richtig, Texte und Begründungen paarweise verschieden, Begründung ≥ 5 Wörter) bleiben.

Bewertung: `richtig` = gewählte Antwort ist die richtige. `anteil` = 1 oder 0. `antwort` = Text der gewählten Antwort. `merkmal` = derselbe Text, wenn falsch.

### fall

```yaml
typ: fall
id: ...
sachverhalt: |           # Absätze durch Leerzeile getrennt, kein Markdown
  ...
aufgabe: "..."           # was zu tun ist, ein Satz
pruefpunkte:             # 2–8
  - text: "..."
    pflicht: true        # mindestens einer pflicht
  - text: "..."
    pflicht: false
musterloesung: |         # optional, Absätze, erscheint nach den Prüfpunkten
  ...
```

Ablauf: Sachverhalt lesen → Lösung frei schreiben (Textfeld, höchstens 2 000 Zeichen, Zähler sichtbar) → **Abgeben** → Zuversicht → Prüfpunkte erscheinen als Kästchen, der Lernende hakt ab, was er hatte → **Fertig** → Ergebnis und Musterlösung.

Die Reihenfolge Zuversicht **vor** Prüfpunkten ist der Kern dieses Typs: Wer die Musterlösung schon sieht, schätzt nicht sein Wissen ein, sondern liest ab.

Bewertung: `richtig` = alle Pflicht-Prüfpunkte abgehakt. `anteil` = abgehakte / alle. `antwort` = der geschriebene Text. `merkmal` = die fehlenden Pflicht-Prüfpunkte als sortierte Indizes, z. B. `fehlt:1,3` — das ist das Signal, welcher Punkt einen immer wieder fängt.

Schema verbietet: weniger als zwei Prüfpunkte, keinen Pflichtpunkt, doppelte Prüfpunkttexte.

Bekannte Schwäche, offen benannt: Selbstbewertung ist nachsichtig. Das ist der Preis für offline und kostenlos. Die spätere KI-Rückmeldung prüft gegen dieselben Prüfpunkte.

### zuordnen

```yaml
typ: zuordnen
id: ...
aufgabe: "..."
paare:                   # 3–6
  - links: "..."
    rechts: "..."
ablenker:                # optional, 0–2 zusätzliche rechte Einträge
  - "..."
```

Bedienung: linken Eintrag antippen — direkt darunter klappen die rechten Einträge auf —, dann einen rechten antippen: Das Paar steht. Ein bestehendes Paar antippen löst es und klappt die Auswahl wieder auf. **Einspaltig**, weil zwei Spalten bei 375 px je rund 135 px hätten — zu schmal für die Begriffe, um die es geht. **Abgeben** ist aktiv, sobald jeder linke Eintrag ein Paar hat. Rechte Seite erscheint gemischt (deterministisch, Saat = `id`, wie `mischen.ts`).

Bewertung: `richtig` = alle Paare stimmen. `anteil` = richtige Paare / Anzahl Paare. `antwort` = die gebildeten Paare als `links→rechts`, durch `;` getrennt. `merkmal` = die falschen Paare in derselben Form.

Schema verbietet: doppelte linke oder rechte Einträge, Ablenker, der einem `rechts` gleicht.

### reihenfolge

```yaml
typ: reihenfolge
id: ...
aufgabe: "..."
schritte:                # 3–7, in der richtigen Reihenfolge
  - "..."
```

Bedienung: Schritte erscheinen gemischt (deterministisch, Saat = `id`, wie `mischen.ts`). Gleicht die gemischte Folge der richtigen, rotiert die Komponente sie um eine Position — sonst wäre nichts zu tun; das ist eine Eigenschaft der Darstellung, nicht des Schemas. Je Schritt ein Hoch- und ein Runter-Knopf, 44 px. **Abgeben**.

Bewertung: `richtig` = jede Position stimmt. `anteil` = Schritte an richtiger Position / Anzahl. `antwort` = die abgegebene Folge als Indizes. `merkmal` = dasselbe, wenn falsch.

Schema verbietet: doppelte Schritte.

## Der gemeinsame Vertrag

```ts
// src/aufgaben/vertrag.ts
export type Ergebnis = {
  readonly richtig: boolean;   // für Planer und Kalibrierung
  readonly anteil: number;     // 0–1, gespeichert, noch nicht geplant
  readonly antwort: string;    // was der Lernende getan hat
  readonly merkmal: string;    // Gruppierungsschlüssel der Fehlvorstellung, '' wenn richtig
};
```

Jede `bewerten.ts` liefert genau das. Die Hülle kennt keinen Typ.

## Die Hülle: Aufgabe.tsx

Ersetzt `Frage.tsx`. Reicht die Aufgabe an den Verteiler `Aufgabentyp.tsx`, führt den Zuversichtsschritt, schreibt das Ereignis, plant den Termin. Die Typkomponenten wissen nichts vom Tutor.

Phasen: `offen → abgegeben → zuversicht → aufgeloest`.

Die Typkomponente bekommt `phase` als Prop und zwei Rückrufe:

- `onAbgegeben({ antwort, ergebnis })` — der Lernende hat sich festgelegt. Die Hülle zeigt Zuversicht. `ergebnis` ist die fertige Bewertung oder `null`, wenn sie erst nach der Zuversicht feststehen kann.
- `onErgebnis(ergebnis)` — die nachgereichte Bewertung. Die Hülle speichert, plant, zeigt den Ergebnissatz.

Bei `wahl`, `zuordnen`, `reihenfolge` steht die Bewertung schon bei der Abgabe fest; die Hülle hält sie zurück, bis die Zuversicht gewählt ist, und löst dann in einem Zug auf — dieselbe Reihenfolge wie heute in `Frage.tsx`, ohne einen Effekt, der auf einen Phasenwechsel wartet. Bei `fall` kommt `ergebnis: null`: Nach der Zuversicht steht die Phase `zuversicht`, der Lernende hakt die Prüfpunkte ab, und erst dann ruft die Komponente `onErgebnis`. Das ist der einzige Grund, warum es zwei Rückrufe sind und nicht einer.

Unverändert aus der heutigen `Frage.tsx`: Wahl bis zur Zuversicht widerruflich; Sperre nach der Zuversicht; Fokus springt in den Zuversichtsblock und danach auf den Ergebnissatz; Ergebnis steht als Text, nicht nur als Farbe; Speicherfehler blockieren die Aufgabe nie (Ergebnis erscheint, nur die Aufzeichnung fehlt); Abbruch vor der Zuversicht wird nicht aufgezeichnet; `dauerMs` misst von Abgeben bis Zuversicht.

## Ereignis und Speicher

```ts
export type Ereignis = {
  readonly lektion: string;
  readonly frage: string;        // Kennung der Aufgabe. Historischer Name, bleibt:
                                 // er ist der Schlüssel in allen Tutormodulen und
                                 // im keyPath des Kartenspeichers.
  readonly typ: AufgabenTyp;     // neu
  readonly zuversicht: Zuversicht;
  readonly richtig: boolean;
  readonly anteil: number;       // neu
  readonly antwort: string;      // ersetzt gewaehlt
  readonly merkmal: string;      // neu
  readonly dauerMs: number;
  readonly zeitpunkt: string;
};
```

`AufgabenTyp` ist `'wahl' | 'fall' | 'zuordnen' | 'reihenfolge'`, exportiert aus `src/aufgaben/schema.ts`. `typen.ts` holt ihn per `import type` — der wird beim Übersetzen gelöscht, die Datei bleibt frei von Laufzeitabhängigkeiten, wie ihr Kopfkommentar verlangt.

Speicher steigt auf Fassung 2 über einen zusätzlichen Schritt in `SCHRITTE`. Kein neuer Speicher; der Schritt läuft mit einem Cursor über `ereignisse` und ergänzt jeden Satz: `typ: 'wahl'`, `antwort` aus `gewaehlt`, `anteil` aus `richtig`, `merkmal` aus `gewaehlt` wenn falsch, sonst `''`; `gewaehlt` wird entfernt. `Ausfuhr.fassung` sagt dem Leser, welche Form er bekommt.

Der Größenwächter im Speichertest (heute < 400 Byte je Ereignis) gilt weiter für alle Typen außer `fall`; dort < 4 500 Byte, weil `antwort` bis 2 000 Zeichen trägt und Umlaute in UTF-8 zwei Byte kosten.

`kalibrierung.ts`: Gruppierung der Fehlvorstellungen nach `merkmal` statt nach `gewaehlt`. Sonst keine Änderung. `reife.ts`, `auswahl.ts`, `planung.ts`: keine Änderung — sie lesen nur `richtig`, `zuversicht`, `frage`, `lektion`, `zeitpunkt`.

## Das Lektionsschema

- `fragen` heißt `aufgaben`, 2–6 Einträge (Fälle brauchen mehr Raum als Wahlfragen). Jeder Eintrag ist ein `AufgabeSchema`. `transfer` ist eine Aufgabe beliebigen Typs.
- `typ` steht **explizit** in jeder Aufgabe. Die vier bestehenden Lektionen werden migriert (`fragen` → `aufgaben`, `typ: wahl` je Eintrag). Das Schema weist `fragen` zurück — Migration statt stiller Voreinstellung.
- Takt 2 (Das Bild) wird **optional**: eine Lektion ohne Widget hat nur den Widerspruch im Rumpf. Der Lektionsaufbau Widerspruch · Bild · Satz · Probe · Transfer · Herkunft bleibt sonst, weil er kein RAG-Aufbau ist, sondern ein Prinzip-Aufbau.
- `Lektion.astro` wird in `LektionAnsicht.astro` (nimmt `daten: Lektion` und den Rumpf als Komponente) und `Lektion.astro` (holt beides aus dem Sammlungseintrag) getrennt. Das ist die Vorbereitung für Lektionen, die nicht aus der Sammlung kommen (Bibliothek, Weg B); jetzt nur der Schnitt.

## Bedienung

- Jede Bedienfläche ≥ 44 × 44 px, am gebauten Stand bei 375 px gemessen wie heute.
- Kein Ziehen. Zuordnen per Antippen, Reihenfolge per Knöpfen.
- Ganzer Ablauf per Tastatur; Fokusführung wie in der heutigen Hülle.
- Kein waagerechter Überlauf bei 375 px.

## Nachweis

Je Typ:
- Schema weist Unsinn ab (siehe „Schema verbietet" oben), mit Tests, die die Meldung prüfen.
- `bewerten` rein getestet, inklusive Rand: alles richtig, nichts richtig, teilweise.
- Komponente per Testing Library: handeln → `onAbgegeben` → `phase` → `onErgebnis` mit erwartetem Ergebnis; Widerruf vor Abgeben; Sperre danach.
- Mutationsprobe je Typ an der Stelle, die am meisten wehtut (z. B. `richtig` bei `fall` aus *allen* statt Pflicht-Prüfpunkten).

Hülle: die 27 heutigen Fragetests laufen als Hüllentests mit `typ: wahl` weiter. Dazu: `fall` zeigt Prüfpunkte erst nach Zuversicht.

Speicher: Ereignisse aus Fassung 1 sind nach dem Aufstieg auf 2 vollständig und in neuer Form da.

Bau: 5 Seiten, `astro check` 0 Fehler, alle Tests grün. Am gebauten Stand bei 375 px: Tippflächen und Überlauf gemessen, Ablauf jedes Typs einmal durchgespielt und Ereignis in der Datenbank nachgesehen.

## Die erste Lektion mit echtem Stoff

Keine erfundene Lektion in `inhalt/` — jede Behauptung zeigt auf eine Quelle. Das Material liegt seit 2026-09-19 vor: neun Foliensätze einer Projektmanagement-Vorlesung (Module M1–M10). Daraus entsteht **eine** Lektion von Hand, die alle vier Typen trägt; sie ist zugleich die Vorlage für den Compiler in Teilprojekt 2.

Gewählt ist der Teil zu Bauvertragsarten und Risikoverteilung (M7, Folien 31–33), weil er ein Prinzip mit echter Gegenintuition hergibt — in eigenen Worten: *Ein Pauschalpreis verlagert das Mengenrisiko; das Vollständigkeitsrisiko verlagert erst die Komplettheitsklausel.* Die verbreitete Annahme ist „pauschal heißt komplett".

- `zuordnen`: Vertragsart ↔ Vergütungsgrundlage
- `reihenfolge`: Vertragsformen nach wachsendem Risiko des Auftragnehmers
- `fall`: Streit um eine im Leistungsverzeichnis fehlende Leistung unter einem Detail-Pauschalvertrag; Pflicht-Prüfpunkte trennen Mengen- von Vollständigkeitsrisiko
- `wahl` (Transfer): welches Risiko ein Auftraggeber mit einem detaillierten Pauschalvertrag **nicht** verlagert hat

Die Lektion ist eigene Formulierung, keine Abschrift der Folien; Herkunft nennt Datei und Foliennummern. Weil Folien Stichworte liefern und der Vortrag fehlt, wird jede Aussage, die über den Folientext hinausgeht, gegen eine zweite, benannte Quelle geprüft oder weggelassen. Die Lektion entsteht als letzter Schritt dieses Teilprojekts — vorher gibt es das Schema nicht, in das sie passt. Bis dahin laufen alle Tests mit Testdaten; die Migration der vier RAG-Lektionen beweist `wahl`.

## Außerhalb, mit Andockstelle

- **Mathe**: `src/aufgaben/rechnen/` (Ergebnis mit Toleranz und Bruchvergleich, Formelsatz per KaTeX) und `src/aufgaben/herleiten/` (schrittweise ausgeblendete Beispiele). Hülle, Ereignis, Speicher, Tutor unverändert. `rechnen` ist der nächste Typ nach diesen vier: Schon das erste Material enthält zwei Rechenstellen (Indexfortschreibung einer Kostenschätzung, Budget mit Sicherheitspuffer), die sich mit den vier Typen nur umschreiben, nicht üben lassen.
- **Programmieren**: `src/aufgaben/code/` (Editor, Tests im Browser) und `src/aufgaben/ausgabe/` (Ausgabe vorhersagen). Ebenso.
- **Compiler** für die neuen Typen: Teilprojekt 2.
- **`anteil` in der Planung**: nach Daten.
- **KI-Rückmeldung bei `fall`**: gegen dieselben Prüfpunkte, später.

## Reihenfolge

Dieses Teilprojekt vor der Bibliothek. Ein Ingest, der zuerst gebaut würde, erzeugte wieder nur Wahlfragen — dieselbe geringe Tiefe in neuer Verpackung.
