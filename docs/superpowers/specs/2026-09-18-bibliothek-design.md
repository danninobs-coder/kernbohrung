# Bibliothek — die Landing für den Ingest

Stand: 2026-09-18 · Teilprojekt 2 von 3 (Aufgabenfamilie → Bibliothek → Lernprofil)

## Ziel

Heute gibt es keinen Ort in der App, an dem man sieht, was eingelesen ist, oder eine Quelle einträgt. Der Ingest ist ein Terminalbefehl mit genau einem Adapter (Git), der Compiler ein Skill, der auf „höchstens acht Prinzipien" je Quelle ausgelegt ist. Für ein Repo mit vierundzwanzig Varianten desselben Gedankens war das richtig. Für ein Lehrbuch dreht sich das Ziel um: Dort zählt, dass **jeder Abschnitt** Lektion oder Ablehnung mit Grund bekommt.

Nach diesem Teilprojekt gibt es die Seite `/bibliothek`: Sie zeigt den Bestand mit Abdeckung (überall, auch im Artifact auf dem Handy), und sie nimmt am Rechner im Entwicklungsmodus ein Lehrbuch als PDF oder EPUB entgegen, zerlegt es in Abschnitte und erzeugt den Auftrag für den Compiler. Der Compiler läuft weiter in Claude Code — mit dem Review-Gate. Auftrag und Lektionsdaten sind so geschnitten, dass die Seite später selbst ausführen könnte (Weg B), ohne dass das jetzt gebaut wird.

## Nicht Ziel

- Weg B (Claude-Aufruf aus dem Browser, Lektionen als Gerätedaten) wird **nicht** gebaut, nur nicht verbaut.
- Keine OCR. Ein PDF ohne Textebene (Scan) wird mit klarer Meldung abgewiesen.
- Keine Bilder, Tabellen oder Formeln aus dem Buch; nur Fließtext. Das Manifest hält fest, dass sie fehlen.
- Kein Lernprofil, keine Landkarte.

## Entscheidungen

| Frage | Entscheidung | Warum |
|---|---|---|
| Wer führt den Auftrag aus | Claude Code jetzt, Browser vorbereitet | Das Review-Gate ist der Qualitätsmechanismus des Projekts; im Browser müsste es nachgebaut werden. Lektionen bleiben Dateien im Repo mit Quellenverweis. Ein Lehrbuch hat man ohnehin am Rechner. |
| Wo das Eintragen läuft | nur im Entwicklungsmodus | Ein statischer Bau hat keinen Server. Der Endpunkt existiert im Bau nicht — nichts, was auf dem Handy fehlen könnte, ist dort versprochen. |
| Obergrenze acht Prinzipien | gilt nur für `art: repo` | Für Bücher wird sie durch die Vollständigkeitspflicht je Abschnitt ersetzt. |
| Was aus dem Buch kommt | Fließtext je Abschnitt, Seitenbereich | Das ist, was der Compiler lesen kann. Was fehlt, steht im Manifest. |

## Die Seite `/bibliothek`

Verlinkt in der Kopfleiste neben dem Modusumschalter. Zwei Gesichter.

**Der Bestand — überall.** Eine Karte je Quelle:

- Titel, Art (Repo oder Buch), Stand (Commit-Hash oder ISBN + Auflage + Hash des Originals)
- Abdeckung als Zahlenzeile: *38 Abschnitte · 11 mit Lektion · 22 offen · 5 abgelehnt* — bei Repos: *6 Prinzipien · 3 mit Lektion · 3 offen*
- Aufklappbar: die Abschnitte mit Status; bei `abgelehnt` der Grund, bei `lektion` der Verweis auf die Lektion

Gebaut zur Bauzeit aus `lehrplan/*.yaml` und `quellen/*/manifest.json` über ein reines Modul `src/lib/abdeckung.ts`. Hält bei 375 px ohne Überlauf; Aufklappen per Knopf ≥ 44 px.

**Das Eintragen — nur im Entwicklungsmodus.** Darunter, nur wenn `import.meta.env.DEV`, eine React-Insel `Einlesen.tsx`:

1. Datei wählen (PDF, EPUB) oder Git-Adresse mit Unterpfad eingeben; Kurzname vergeben (Muster wie heute: Kleinbuchstaben, Ziffern, Bindestrich).
2. Absenden → Fortschritt → Ergebnis: Gliederung als Liste mit Seitenbereichen, Warnungen (z. B. „Gliederung per Heuristik").
3. Kästchen je Abschnitt: welche in den nächsten Durchgang. Alle vorausgewählt.
4. **Auftrag speichern** → die Seite zeigt den Satz zum Kopieren: *„Bau die Lektionen für ‹kurzname›."* — genau der Auslöser des Compiler-Skills.

Nach dem Durchgang und `npm run build` zeigt der Bestand die neue Abdeckung.

## Datenmodell: Lehrplan Fassung 2

`werkzeug/lehrplan.mjs` wird eine diskriminierte Union über `art`.

```yaml
# art: repo — wie heute, plus das Feld art
art: repo
quelle: awesome-llm-apps
stand: a13701ea…
geprueftVon: "…"
geprueftAm: "…"
prinzipien: [...]        # HOECHSTZAHL = 8 gilt hier
```

```yaml
# art: buch — neu
art: buch
quelle: hoai-kommentar         # Kurzname = Ordner unter quellen/
titel: "…"
isbn: "…"                      # optional
auflage: "…"                   # optional
stand: "sha256:…"              # Hash der Originaldatei, aus dem Manifest
geprueftVon: "…"
geprueftAm: "…"
abschnitte:
  - id: 05-honorarzonen        # nn-slug, nn = Reihenfolge im Buch
    titel: "§ 5 Honorarzonen"
    seiten: [41, 48]
    status: offen              # offen | beauftragt | lektion | abgelehnt
    grund: "…"                 # Pflicht bei abgelehnt, sonst verboten
    lektion: hoai-honorarzonen # Pflicht bei lektion, sonst verboten; Dateiname unter inhalt/lektionen
    prinzipien: []             # 0–3, von Durchgang A gefüllt; Form wie im Repo-Lehrplan,
                               # belege zeigen auf die Rohdatei des Abschnitts
```

Das Schema erzwingt: `grund` genau dann, wenn `abgelehnt`; `lektion` genau dann, wenn `lektion`, und die Datei muss existieren; Abschnitt-Ids eindeutig; Seitenbereiche aufsteigend und überschneidungsfrei; höchstens drei Prinzipien je Abschnitt — ein Abschnitt mit zehn ist katalogisiert, nicht destilliert.

**Der Auftrag** ist keine eigene Datei: Er ist die Menge der Abschnitte mit `status: beauftragt`. Die Seite schreibt diesen Status; der Compiler liest ihn und hinterlässt je Abschnitt `lektion` oder `abgelehnt` mit Grund. Ein Abschnitt darf den Durchgang nicht als `beauftragt` verlassen — das prüft `pruefe-lektion` am Ende.

Das bestehende `awesome-llm-apps.yaml` bekommt `art: repo` eingetragen.

## Abdeckung: `src/lib/abdeckung.ts`

Reine Funktion `abdeckung(lehrplaene, lektionsIds) → Bestand[]`. Für `repo`: ein Prinzip gilt als abgedeckt, wenn eine Lektion mit Id = Prinzip-Id existiert. Für `buch`: Zählung nach `status`. Kein Dateizugriff in der Funktion; das Einlesen der Dateien passiert in der Astro-Seite zur Bauzeit.

Die Funktion liefert außerdem **Lektionen ohne Lehrplaneintrag** — Dateien unter `inhalt/lektionen/`, auf die kein Prinzip und kein Abschnitt zeigt. Heute gibt es genau eine: `recall-vor-precision` steht als Lektion da, aber in keinem Lehrplan. Die Seite zeigt das als Warnung, nicht als Abdeckung: Eine Lektion, deren Herkunft der Lehrplan nicht kennt, ist genau die Behauptung ohne Quelle, die das Projekt ausschließt. Was damit geschieht — nachtragen oder entfernen — entscheidet der Mensch; die Seite macht es nur sichtbar.

## Der Adapter: `werkzeug/adapter/buch.mjs`

Gegenstück zu `adapter/git.mjs`, dieselbe Schnittstelle: nimmt einen Ort (Dateipfad) und einen Kurznamen, liefert `quellen/<kurzname>/` mit Rohdateien und dem Manifest.

**Gliederung**, in dieser Reihenfolge:
1. PDF-Lesezeichen (Outline) bzw. EPUB-Inhaltsverzeichnis (nav / toc.ncx). Erste Ebene mit Seitenbereich; tiefere Ebenen werden in den Elternabschnitt gefaltet, damit Abschnitte lesbare Größe haben (Zielgröße 5–25 Seiten; darüber wird die nächste Ebene genommen).
2. Fehlt beides: Heuristik über Schriftgrößensprünge und nummerierte Überschriften. Das Manifest trägt `gliederung: heuristik`, die Seite warnt. Zwei Abschnitte oder weniger → Abbruch mit Meldung „keine Gliederung erkannt".

**Text**: je Abschnitt eine Datei `quellen/<kurzname>/roh/<nn>-<slug>.md` mit Überschrift, Seitenbereich in einer Kopfzeile und dem Fließtext. Silbentrennung am Zeilenende wird zusammengezogen; Kopf-/Fußzeilen, die auf jeder Seite identisch sind, werden entfernt. Ein PDF, dessen Text unter 200 Zeichen je Seite im Mittel liegt, gilt als Scan → Abbruch mit Meldung.

**Manifest**: Fassung 3 von `manifest.mjs`. `herkunft.art: 'buch'` mit `titel`, `isbn`, `auflage`, `dateiHash` (SHA-256 des Originals, dasselbe Verfahren wie `inhaltsHash`), `gliederung: lesezeichen | inhaltsverzeichnis | heuristik`. Je Rohdatei zusätzlich `seiten`. Unter `ausgelassen`: Bilder, Tabellen, Formeln mit Zählung je Abschnitt — die Auslassungsliste bleibt der Vertrag, dass der nächste Leser den Bestand nicht für vollständig hält.

Die Originaldatei liegt unter `quellen/<kurzname>/original.<ext>` (gitignored, wie ganz `quellen/`).

**Bibliotheken**: Wahl im Plan nach festen Kriterien — reines JavaScript ohne nativen Bau, läuft unter Node 24, permissive Lizenz, Outline und Text zugänglich. Kandidaten: `pdfjs-dist` (Mozilla) für PDF; für EPUB ZIP + XHTML mit vorhandenen kleinen Paketen. Versionsstände und Größen werden im Plan gemessen, nicht geschätzt.

## Der Dev-Endpunkt

Kein Astro-Endpunkt unter `src/pages/api/` — im statischen Bau gäbe es ihn nicht, und ein POST-Handler dort wäre eine Zusage, die der Bau nicht hält. Stattdessen eine **Astro-Integration** `werkzeug/integration/einlesen.mjs`, die im Hook `astro:server:setup` zwei Handler am Dev-Server anmeldet:

- `POST /__einlesen` — multipart mit Datei oder Git-Adresse, Kurzname. Ruft den passenden Adapter, legt `lehrplan/<kurzname>.yaml` mit allen Abschnitten als `offen` an (Buch) bzw. den bestehenden Weg (Repo). Antwort: Gliederung, Warnungen, Manifest-Auszug. Obergrenze 200 MB.
- `POST /__auftrag` — JSON `{ quelle, abschnitte: [id] }`. Setzt die genannten Abschnitte auf `beauftragt`, alle anderen `offen` bleiben `offen`. Weist zurück, wenn ein Abschnitt `lektion` oder `abgelehnt` ist.

Beide Handler sind reine Funktionen `(anfrage, wurzel) → antwort`, die in Tests gegen ein temporäres Verzeichnis laufen, ohne Dev-Server. Im gebauten Stand existiert die Integration nicht; die Seite zeigt dort statt des Formulars den Satz „Einlesen geht am Rechner im Entwicklungsmodus".

## Der Compiler-Skill

`SKILL.md` bekommt einen Abschnitt **Durchgang für Bücher**:

- Auslöser: „Bau die Lektionen für ‹kurzname›" bei `art: buch`.
- Je Abschnitt mit `status: beauftragt`: Rohdatei lesen, Prinzipien destillieren (keine Obergrenze je Quelle, aber je Abschnitt höchstens drei — ein Abschnitt mit zehn Prinzipien ist katalogisiert), Lektion mit den Aufgabentypen aus Teilprojekt 1 bauen (`fall` für jeden Abschnitt mit Sachverhalt, `zuordnen` für Begriffspaare, `reihenfolge` für Verfahren, `wahl` für Abgrenzungen), oder **ablehnen mit Grund** (z. B. „reiner Verweisabschnitt", „Tabelle, Text fehlt").
- Am Ende: kein Abschnitt mehr `beauftragt`; `pruefe-lektion` läuft über alle neuen Lektionen; `npm run build` als letzte Schranke.
- Das Review-Gate bleibt und arbeitet wie heute: Durchgang A schreibt die Prinzipien je Abschnitt in den Lehrplan und **leert dabei `geprueftVon` und `geprueftAm`**. Durchgang B startet erst, wenn ein Mensch beide wieder gesetzt hat. Bei Büchern gilt das je Durchgang, nicht je Buch — ein zweiter Auftrag am selben Buch läuft wieder durch das Gate.

Die Regeln für falsche Antworten (B3) und die zwei Fallen (B5a) gelten unverändert; für `fall` kommt die Regel dazu: Pflicht-Prüfpunkte sind die, ohne die die Lösung falsch ist, nicht die, die schön wären.

## B vorbereitet — was das jetzt bindet

1. **Der Auftrag ist Datenform, kein Befehl**: Statusfelder im Lehrplan mit Zod-Schema. Ein späterer Browser-Ausführer liest dieselben Felder.
2. **`LektionAnsicht.astro`** nimmt `daten: Lektion` und den Rumpf als Komponente (Schnitt aus Teilprojekt 1). Eine Lektion aus IndexedDB wäre ein zweiter Aufrufer.
3. **Die Handler sind reine Funktionen** ohne Bindung an den Dev-Server. Ein Browser-Ausführer würde die Gliederungslogik im Browser brauchen — das ist die eine Stelle, die in B neu geschrieben werden müsste (pdfjs läuft auch dort).

Bekannte Lücke, offen benannt: Takt 1 und 2 liegen als MDX-Rumpf vor. Weg B bräuchte einen Markdown-Renderer zur Laufzeit. Nicht jetzt.

## Nachweis

- Lehrplan-Schema: weist `abgelehnt` ohne `grund`, `lektion` ohne Datei, doppelte Abschnitt-Ids, überschneidende Seitenbereiche und `art`-lose Dateien ab — mit Tests auf die Meldung.
- `abdeckung`: reine Funktion, Tests für Repo und Buch, inklusive leerem Bestand.
- Adapter: Fixtures unter `tests/fixtures/` — ein PDF mit Lesezeichen, eines ohne (Heuristik), eines als Scan-Attrappe (Bilder, kein Text), ein EPUB. Die Fixtures werden von einem Skript unter `werkzeug/fixtures/` erzeugt, damit sie nachvollziehbar sind. Tests prüfen Gliederung, Seitenbereiche, Silbentrennung, Kopfzeilenentfernung, Scan-Abbruch, Manifest-Felder.
- Handler: `__einlesen` und `__auftrag` gegen ein temporäres Verzeichnis; Zurückweisung bei falschem Kurznamen, zu großer Datei, Auftrag auf `lektion`-Abschnitt.
- Seite: der Bau erzeugt `/bibliothek/index.html` mit den Zahlen des heutigen Bestands (6 Prinzipien, 3 mit Lektion, 3 offen — und eine Lektion ohne Lehrplaneintrag, `recall-vor-precision`). Die Zahlen sind gegen den Bestand geprüft, nicht angenommen. Bei 375 px kein Überlauf, Aufklappknöpfe ≥ 44 px.
- Ende-zu-Ende am Rechner: ein echtes Lehrbuch (vom Nutzer) einlesen, Auftrag über die Seite setzen, Skill laufen lassen, Bau, Bestand zeigt die neue Abdeckung.

## Reihenfolge

Nach der Aufgabenfamilie. Der Compiler kann nur Typen erzeugen, die es gibt.
