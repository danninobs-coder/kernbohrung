# Bibliothek — die Landing für den Ingest

Stand: 2026-09-19 (überarbeitet nach Prüfung an echtem Material) · Nachtrag nach 2a: 2026-09-22, am Ende · Teilprojekt 2 von 3 (Aufgabenfamilie → Bibliothek → Lernprofil)

## Ziel

Heute gibt es keinen Ort in der App, an dem man sieht, was eingelesen ist, oder eine Quelle einträgt. Der Ingest ist ein Terminalbefehl mit genau einem Adapter (Git), der Compiler ein Skill, der auf „höchstens acht Prinzipien" je Quelle ausgelegt ist. Für ein Repo mit vierundzwanzig Varianten desselben Gedankens war das richtig. Für Lehrmaterial dreht sich das Ziel um: Dort zählt, dass **jeder Abschnitt** Lektion oder Ablehnung mit Grund bekommt.

Nach diesem Teilprojekt gibt es die Seite `/bibliothek`: Sie zeigt den Bestand mit Abdeckung (überall, auch im Artifact auf dem Handy), und sie nimmt am Rechner im Entwicklungsmodus Lehrmaterial entgegen — **ein Lehrbuch als PDF oder EPUB, oder einen Ordner mit Foliensätzen** —, zerlegt es in Abschnitte und erzeugt den Auftrag für den Compiler. Der Compiler läuft weiter in Claude Code, mit dem Review-Gate. Auftrag und Lektionsdaten sind so geschnitten, dass die Seite später selbst ausführen könnte (Weg B), ohne dass das jetzt gebaut wird.

## Befund am echten Material

Der erste Entwurf dieses Specs war für Fließtext mit Gliederung geschrieben. Geprüft wurde er am 2026-09-19 an dem Material, das tatsächlich eingelesen werden soll: neun Foliensätze einer Projektmanagement-Vorlesung (Module M1–M10, zwei Ordner, rund 8 MB; gelesen wurden die fünf des zweiten Tages). Vier Annahmen hielten nicht.

| Annahme im ersten Entwurf | Befund | Folge |
|---|---|---|
| Die Gliederung kommt aus den Lesezeichen | **0 von 5** Dateien tragen Lesezeichen (Druckausgabe aus einem PDF-Werkzeug) | Für Folien ist die Heuristik der Normalfall, nicht der Notfall — und sie muss eine andere sein als für Bücher |
| Kopfzeilen sind „auf jeder Seite identisch" | Der Briefkopf ist identisch **bis auf die Foliennummer** und macht je nach Satz **ein Drittel bis knapp die Hälfte** des extrahierten Texts aus (überschlagen aus der Extraktion: M5 rund 44 %, M7 rund 36 %, M9 rund 33 %) | Kopfzeilen über Wiederkehr erkennen, Ziffern normalisiert — sonst liest der Compiler zu einem Drittel bis zur Hälfte denselben Briefkopf |
| Unter 200 Zeichen je Seite = Scan → Abbruch | Nach Abzug des Briefkopfs liegen ganze Foliensätze bei 300–470 Zeichen je Folie, der Median darunter; ein Satz mit vielen Bildfolien wäre als „Scan" abgewiesen worden | „Scan" heißt: **keine Textebene**. Wenig Text ist kein Scan |
| Was fehlt, sind „Bilder, Tabellen, Formeln" als Zählung | In M7 sind **7 von 35 Folien reine Bilder** (nur Briefkopf im Text), zwei weitere sind Tabellen, die zu Zahlenkolonnen zerfallen; M6 trägt seine Aufgabe nur im Bild | Das Manifest nennt diese Folien **einzeln**, und der Compiler sieht sich genau diese Seiten im Original an |

Dazu zwei Befunde am Inhalt, die der Compiler können muss:

- **Eine Behauptung ohne Beleg in der Quelle.** Eine Folie nennt feste Behaltensquoten je Aufnahmekanal (Lesen 10 % … Tun 90 %). Für diese Zahlen gibt es keine nachvollziehbare empirische Quelle. Das Material ist trotzdem Prüfungsstoff. Der Compiler darf so etwas weder stillschweigend lehren noch stillschweigend weglassen (→ `vorbehalt`).
- **Schreibfehler in Fachbegriffen** (eine Teamphase ist falsch geschrieben). Lektionen verwenden den richtigen Begriff; die Abweichung steht in der Herkunft.

Und ein Befund für Teilprojekt 1: Das Material passt auf die vier Aufgabentypen besser als erwartet — Vertragsarten und Risikoverteilung (`zuordnen`), Projektstufen und Teamphasen (`reihenfolge`), zwei durchgearbeitete Praxisfälle (`fall`), Abgrenzungen (`wahl`). Es enthält außerdem **zwei Rechenstellen** (Indexfortschreibung, Budget mit Sicherheitspuffer) — `rechnen` rückt damit näher als geplant.

## Nicht Ziel

- Weg B (Claude-Aufruf aus dem Browser, Lektionen als Gerätedaten) wird **nicht** gebaut, nur nicht verbaut.
- Keine OCR im Adapter. Material ganz ohne Textebene wird mit klarer Meldung abgewiesen. (Einzelne Bildfolien in einem sonst lesbaren Satz sind kein Abbruchgrund — siehe Compiler.)
- Der Adapter übernimmt keine Bilder. Er merkt sich, **wo** welche sind.
- Kein Lernprofil, keine Landkarte.

## Entscheidungen

| Frage | Entscheidung | Warum |
|---|---|---|
| Wer führt den Auftrag aus | Claude Code jetzt, Browser vorbereitet | Das Review-Gate ist der Qualitätsmechanismus des Projekts; im Browser müsste es nachgebaut werden. Lektionen bleiben Dateien im Repo mit Quellenverweis. |
| Wo das Eintragen läuft | nur im Entwicklungsmodus | Ein statischer Bau hat keinen Server. Der Endpunkt existiert im Bau nicht — nichts, was auf dem Handy fehlen könnte, ist dort versprochen. |
| Obergrenze acht Prinzipien | gilt nur für `art: repo` | Für Lehrmaterial ersetzt sie die Vollständigkeitspflicht je Abschnitt. |
| Bücher und Folien | ein Lehrplanformat, zwei Gliederer | Der Lehrplan fragt nur: welcher Abschnitt, welcher Status. Wie man Abschnitte findet, ist Sache des Adapters. |
| Bildfolien und zerfallene Tabellen | Adapter markiert, Compiler sieht nach | Claude Code kann PDF-Seiten als Bild lesen. Das ist billiger und verlässlicher als OCR im Adapter — und es passiert nur dort, wo der Text nachweislich nichts hergibt. |
| Zweifelhafte Behauptungen der Quelle | Feld `vorbehalt`, sichtbar in der Lektion | Prüfungsstoff bleibt lernbar, ohne dass die App ihn als gesichert ausgibt. |

## Die Seite `/bibliothek`

Verlinkt in der Kopfleiste neben dem Modusumschalter (gebaut in 2a: am Fuß der Übersicht — siehe Nachtrag). Zwei Gesichter.

**Der Bestand — überall.** Eine Karte je Quelle:

- Titel, Art (Repo, Buch, Folien), Stand (Commit-Hash oder Hash des Originals, bei Büchern ISBN und Auflage)
- Abdeckung als Zahlenzeile: *38 Abschnitte · 11 mit Lektion · 22 offen · 5 abgelehnt* — bei Repos: *6 Prinzipien · 3 mit Lektion · 3 offen*
- Was der Text nicht hergibt: *7 von 35 Folien nur Bild · 2 Tabellen zerfallen* — damit niemand den Bestand für vollständig hält
- Aufklappbar: die Abschnitte mit Status; bei `abgelehnt` der Grund, bei `lektion` der Verweis, bei Prinzipien mit `vorbehalt` ein Hinweis

Gebaut zur Bauzeit aus `lehrplan/*.yaml` und `quellen/*/manifest.json` über ein reines Modul `src/lib/abdeckung.ts`. Hält bei 375 px ohne Überlauf; Aufklappen per Knopf ≥ 44 px.

**Das Eintragen — nur im Entwicklungsmodus.** Darunter, nur wenn `import.meta.env.DEV`, eine React-Insel `Einlesen.tsx`:

1. **Eine oder mehrere Dateien** wählen (PDF, EPUB) oder eine Git-Adresse mit Unterpfad eingeben; Kurzname vergeben (Kleinbuchstaben, Ziffern, Bindestrich). Mehrere Dateien sind eine Quelle — der Ordner mit Foliensätzen ist der Normalfall, nicht die Ausnahme.
2. Absenden → Fortschritt → Ergebnis: erkannte Art (Buch oder Folien, **umstellbar**), Gliederung als Liste mit Seitenbereichen, Warnungen („Gliederung per Heuristik", „7 Folien nur Bild").
3. Kästchen je Abschnitt: welche in den nächsten Durchgang. Alle vorausgewählt.
4. **Auftrag speichern** → die Seite zeigt den Satz zum Kopieren: *„Bau die Lektionen für ‹kurzname›."* — genau der Auslöser des Compiler-Skills.

Nach dem Durchgang und `npm run build` zeigt der Bestand die neue Abdeckung.

## Datenmodell: Lehrplan Fassung 2

`werkzeug/lehrplan.mjs` wird eine diskriminierte Union über `art`. (Gebaut in 2a: Das Schema steht in `src/lib/lehrplan.ts`, `werkzeug/lehrplan.mjs` liest nur noch die Datei — siehe Nachtrag.)

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
# art: buch | folien — neu, eine Form für beide
art: folien
quelle: bauch-projektmanagement   # Kurzname = Ordner unter quellen/
titel: "…"
isbn: "…"                         # optional, nur buch
auflage: "…"                      # optional, nur buch
stand: "sha256:…"                 # Hash über die Originale, aus dem Manifest
geprueftVon: "…"
geprueftAm: "…"
abschnitte:
  - id: m07-2-vertragsarten       # Reihenfolge-Präfix + slug
    titel: "Risikomanagement und Vertragswesen"
    datei: "M7 Risikomanagement 26.pdf"   # bei mehreren Originalen Pflicht
    seiten: [28, 34]
    status: offen                 # offen | beauftragt | lektion | abgelehnt
    grund: "…"                    # Pflicht bei abgelehnt, sonst verboten
    lektion: pauschal-heisst-nicht-komplett  # Pflicht bei lektion, sonst verboten
    prinzipien: []                # 0–3, von Durchgang A gefüllt; Form wie im Repo-Lehrplan,
                                  # belege zeigen auf die Rohdatei des Abschnitts
```

Ein Prinzip bekommt ein optionales Feld `vorbehalt` (ein Satz): Die Quelle behauptet etwas, das sich nicht belegen lässt oder dem Stand der Forschung widerspricht. Das Feld wandert in die Lektion (`LektionSchema.vorbehalt`, optional) und erscheint dort unter dem Satz als Hinweis — sichtbar, nicht im Kleingedruckten.

Das Schema erzwingt: `grund` genau dann, wenn `abgelehnt`; `lektion` genau dann, wenn `lektion`, und die Datei muss existieren; Abschnitt-Ids eindeutig; Seitenbereiche je Datei aufsteigend und überschneidungsfrei; höchstens drei Prinzipien je Abschnitt — ein Abschnitt mit zehn ist katalogisiert, nicht destilliert.

**Der Auftrag** ist keine eigene Datei: Er ist die Menge der Abschnitte mit `status: beauftragt`. Die Seite schreibt diesen Status; der Compiler liest ihn und hinterlässt je Abschnitt `lektion` oder `abgelehnt` mit Grund. Ein Abschnitt darf den Durchgang nicht als `beauftragt` verlassen — das prüft `pruefe-lektion` am Ende.

Das bestehende `awesome-llm-apps.yaml` bekommt `art: repo` eingetragen.

## Abdeckung: `src/lib/abdeckung.ts`

Reine Funktion `abdeckung(lehrplaene, manifeste, lektionsIds) → Bestand[]`. Für `repo`: ein Prinzip gilt als abgedeckt, wenn eine Lektion mit Id = Prinzip-Id existiert. Für `buch` und `folien`: Zählung nach `status`, dazu aus dem Manifest die Zahl der Bildseiten und Tabellenverdachtsseiten. Kein Dateizugriff in der Funktion; das Einlesen passiert in der Astro-Seite zur Bauzeit.

Die Funktion liefert außerdem **Lektionen ohne Lehrplaneintrag** — Dateien unter `inhalt/lektionen/`, auf die kein Prinzip und kein Abschnitt zeigt. Heute gibt es genau eine: `recall-vor-precision` steht als Lektion da, aber in keinem Lehrplan. (Stand 2a: zwei — dazu `pauschal-heisst-nicht-komplett`, bewusst, bis das Einlesen den Eintrag nachträgt.) Die Seite zeigt das als Warnung, nicht als Abdeckung: Eine Lektion, deren Herkunft der Lehrplan nicht kennt, ist genau die Behauptung ohne Quelle, die das Projekt ausschließt. Was damit geschieht — nachtragen oder entfernen — entscheidet der Mensch; die Seite macht es nur sichtbar.

## Der Adapter

Drei Teile mit je einer Aufgabe, statt einer Datei, die alles weiß:

```
werkzeug/adapter/dokument.mjs     Datei → Seiten: Text je Seite, Seitenformat,
                                  Kopfzeilen entfernt, Bild- und Tabellenseiten markiert
werkzeug/gliederung/buch.mjs      Seiten → Abschnitte, für Fließtext
werkzeug/gliederung/folien.mjs    Seiten → Abschnitte, für Foliensätze
```

Gleiche Schnittstelle nach außen wie `adapter/git.mjs`: Ort(e) und Kurzname hinein, `quellen/<kurzname>/` mit Rohdateien und Manifest heraus.

### dokument.mjs — was für beide Arten gilt

**Kopf- und Fußzeilen über Wiederkehr.** Eine Zeile gilt als Beiwerk, wenn sie — Ziffern zu `#` normalisiert — auf mindestens 80 % der Seiten einer Datei vorkommt. Das fängt den Briefkopf mit laufender Foliennummer, an dem die Regel „identisch auf jeder Seite" scheitert. Das Manifest hält fest, wie viele Zeichen je Datei so entfernt wurden; ein Anteil über 60 % erzeugt eine Warnung (dann stimmt vermutlich etwas mit der Extraktion nicht).

**Keine Textebene.** Haben nach der Kopfzeilenentfernung mehr als 90 % der Seiten weniger als 20 Zeichen, bricht der Adapter ab: „kein Textinhalt — das Material ist gescannt; OCR ist nicht Teil des Ingests". Wenig Text ist ausdrücklich kein Abbruchgrund.

**Bildseiten.** Eine Seite mit weniger als 20 Zeichen Nutztext, die mindestens ein Bild trägt, wird als `nurBild` geführt — mit Seitenzahl, nicht nur als Zählung.

**Tabellenverdacht.** Eine Seite, deren Zeilen zu mehr als 60 % aus Zahlen-, Datums- oder Einzeltoken bestehen, wird als `tabellenverdacht` geführt. Der Text bleibt in der Rohdatei, aber mit einer Warnzeile davor: Tabellen zerfallen bei der Extraktion zu Kolonnen, deren Zuordnung nicht mehr stimmt.

**Silbentrennung** am Zeilenende wird zusammengezogen.

**Art erkennen.** Querformat und ein Median unter 600 Zeichen Nutztext je Seite → Folien; sonst Buch. Die Seite zeigt die erkannte Art und lässt sie umstellen — eine Erkennung, die man nicht überstimmen kann, ist eine Fehlerquelle.

### gliederung/buch.mjs

1. PDF-Lesezeichen bzw. EPUB-Inhaltsverzeichnis (nav / toc.ncx). Erste Ebene mit Seitenbereich; tiefere Ebenen werden in den Elternabschnitt gefaltet, bis Abschnitte lesbare Größe haben (Zielgröße 5–25 Seiten; darüber wird die nächste Ebene genommen).
2. Fehlt beides: Heuristik über Schriftgrößensprünge und nummerierte Überschriften; Manifest `gliederung: heuristik`, die Seite warnt. Zwei Abschnitte oder weniger → Abbruch „keine Gliederung erkannt".

### gliederung/folien.mjs

Die Einheit ist der Foliensatz: **eine Datei = mindestens ein Abschnitt.** Ein Satz bis 20 Folien bleibt ein Abschnitt. Darüber wird geteilt, in dieser Reihenfolge:

1. **Agendafolie.** Eine frühe Folie (unter den ersten fünf), deren Zeilen später als Folientitel wiederkehren, liefert die Abschnittsgrenzen.
2. **Titelläufe.** Aufeinanderfolgende Folien, die dieselbe Titelzeile tragen, gehören zusammen; ein Wechsel ist eine Grenze. Als Titelzeile gilt die Zeile, die über einen Lauf von mindestens zwei Folien unverändert wiederkehrt und kein Beiwerk ist.
3. Greift beides nicht: gleichmäßige Teilung in Abschnitte zu höchstens 15 Folien, Manifest `gliederung: gleichmaessig`, Warnung auf der Seite.

Abschnitts-Id aus Dateiname und laufender Nummer (`m07-2-…`); der Titel aus Agenda oder Titellauf, sonst „‹Dateiname›, Folien a–b".

### Ausgabe

Je Abschnitt `quellen/<kurzname>/roh/<id>.md`: Titel, Datei und Seitenbereich in einer Kopfzeile, dann der Nutztext **mit Seitenmarken** (`— Folie 31 —`), damit jede spätere Behauptung auf eine Folie zeigen kann, nicht nur auf einen Satz von 35.

**Manifest** Fassung 3 von `manifest.mjs`: `herkunft.art: 'buch' | 'folien'`, `originale: [{ datei, dateiHash, seiten }]`, `gliederung: lesezeichen | inhaltsverzeichnis | agenda | titellaeufe | heuristik | gleichmaessig`, `beiwerkZeichen` je Datei. Je Rohdatei `seiten`, `nurBild: [n]`, `tabellenverdacht: [n]`. Der Stand der Quelle ist der Hash über die sortierten Datei-Hashes (dasselbe Verfahren wie `inhaltsHash`).

Die Originale liegen unter `quellen/<kurzname>/original/` (gitignored, wie ganz `quellen/`).

**Bibliotheken**: Wahl im Plan nach festen Kriterien — reines JavaScript ohne nativen Bau, läuft unter Node 24, permissive Lizenz; Text je Seite **mit Position und Schriftgröße**, Seitenformat, Lesezeichen und Bildobjekte müssen zugänglich sein. Kandidat für PDF: `pdfjs-dist` (Mozilla). Für EPUB ZIP + XHTML mit vorhandenen kleinen Paketen. Versionsstände und Größen werden im Plan gemessen, nicht geschätzt.

## Der Dev-Endpunkt

Kein Astro-Endpunkt unter `src/pages/api/` — im statischen Bau gäbe es ihn nicht, und ein POST-Handler dort wäre eine Zusage, die der Bau nicht hält. Stattdessen eine **Astro-Integration** `werkzeug/integration/einlesen.mjs`, die im Hook `astro:server:setup` zwei Handler am Dev-Server anmeldet:

- `POST /__einlesen` — multipart mit einer oder mehreren Dateien oder Git-Adresse, Kurzname, optional die Art. Ruft den passenden Adapter, legt `lehrplan/<kurzname>.yaml` mit allen Abschnitten als `offen` an (Buch, Folien) bzw. den bestehenden Weg (Repo). Antwort: erkannte Art, Gliederung, Warnungen, Manifest-Auszug. Obergrenze 200 MB je Anfrage.
- `POST /__auftrag` — JSON `{ quelle, abschnitte: [id] }`. Setzt die genannten Abschnitte auf `beauftragt`. Weist zurück, wenn ein Abschnitt `lektion` oder `abgelehnt` ist.

Beide Handler sind reine Funktionen `(anfrage, wurzel) → antwort`, die in Tests gegen ein temporäres Verzeichnis laufen, ohne Dev-Server. Im gebauten Stand existiert die Integration nicht; die Seite zeigt dort statt des Formulars den Satz „Einlesen geht am Rechner im Entwicklungsmodus".

## Der Compiler-Skill

`SKILL.md` bekommt einen Abschnitt **Durchgang für Lehrmaterial**:

- Auslöser: „Bau die Lektionen für ‹kurzname›" bei `art: buch | folien`.
- Je Abschnitt mit `status: beauftragt`: Rohdatei lesen, Prinzipien destillieren (keine Obergrenze je Quelle, je Abschnitt höchstens drei), Lektion mit den Aufgabentypen aus Teilprojekt 1 bauen (`fall` für jeden Abschnitt mit Sachverhalt, `zuordnen` für Begriffspaare, `reihenfolge` für Verfahren und Stufen, `wahl` für Abgrenzungen), oder **ablehnen mit Grund** (z. B. „reine Titelfolien", „nur Bildbeispiele ohne Aussage").
- **Nachsehen, wo der Text nichts hergibt.** Für jede Seite unter `nurBild` und `tabellenverdacht` öffnet der Skill die Seite im Original (`quellen/<kurzname>/original/…`, Read mit Seitenangabe) und sieht sie sich an. Eine Lektion über eine Folie, die der Skill nicht gesehen hat, ist verboten. Bleibt eine Bildfolie auch beim Ansehen ohne lernbare Aussage (Foto, Stimmungsbild), wird sie im Lehrplan nicht erwähnt — sie ist kein Abschnitt, nur eine Seite.
- **Bei Folien gilt: Stichworte sind keine Sätze.** Eine Folie nennt, der Vortrag erklärt — und der Vortrag fehlt. Der Skill darf die Lücke mit gesichertem Fachwissen schließen, muss das aber kenntlich halten: Was auf der Folie steht, wird mit Folienverweis belegt; was er ergänzt, braucht eine zweite, benannte Quelle oder bleibt weg. Im Zweifel ablehnen.
- **Vorbehalt.** Behauptet die Quelle etwas ohne Beleg oder gegen den Stand der Forschung, bekommt das Prinzip ein `vorbehalt` — oder der Teil wird mit Grund abgelehnt. Nie stillschweigend lehren, nie stillschweigend weglassen. Quellen für den Vorbehalt werden geprüft (DOI gegen Crossref), nicht aus dem Gedächtnis zitiert.
- **Schreibfehler der Quelle** in Fachbegriffen: Lektion mit dem richtigen Begriff, die Abweichung als Notiz in der Herkunft.
- Am Ende: kein Abschnitt mehr `beauftragt`; `pruefe-lektion` läuft über alle neuen Lektionen; `npm run build` als letzte Schranke.
- Das Review-Gate bleibt und arbeitet wie heute: Durchgang A schreibt die Prinzipien je Abschnitt in den Lehrplan und **leert dabei `geprueftVon` und `geprueftAm`**. Durchgang B startet erst, wenn ein Mensch beide wieder gesetzt hat. Bei Lehrmaterial gilt das je Durchgang, nicht je Quelle — ein zweiter Auftrag läuft wieder durch das Gate.

Die Regeln für falsche Antworten (B3) und die zwei Fallen (B5a) gelten unverändert; für `fall` kommt dazu: Pflicht-Prüfpunkte sind die, ohne die die Lösung falsch ist, nicht die, die schön wären.

## Urheberrecht

Lehrmaterial gehört seinen Verfassern. Daraus folgen drei feste Regeln: `quellen/` bleibt gitignored — Rohtext und Originale verlassen den Rechner nicht, auch nicht Richtung GitHub. Lektionen sind eigene Formulierungen, keine Abschriften; `pruefe-lektion` bekommt eine Prüfung, die eine Lektion zurückweist, wenn ein Satz von mehr als zwölf Wörtern wörtlich in der Rohdatei steht. Und ein Artifact, das Lektionen aus fremdem Lehrmaterial enthält, bleibt privat.

## B vorbereitet — was das jetzt bindet

1. **Der Auftrag ist Datenform, kein Befehl**: Statusfelder im Lehrplan mit Zod-Schema. Ein späterer Browser-Ausführer liest dieselben Felder.
2. **`LektionAnsicht.astro`** nimmt `daten: Lektion` und den Rumpf als Komponente (Schnitt aus Teilprojekt 1). Eine Lektion aus IndexedDB wäre ein zweiter Aufrufer.
3. **Die Handler und die Gliederer sind reine Funktionen** ohne Bindung an den Dev-Server oder ans Dateisystem (Seiten hinein, Abschnitte heraus). `pdfjs-dist` läuft auch im Browser — Weg B könnte `dokument.mjs` und beide Gliederer dort wiederverwenden.

Bekannte Lücke, offen benannt: Takt 1 und 2 liegen als MDX-Rumpf vor. Weg B bräuchte einen Markdown-Renderer zur Laufzeit. Nicht jetzt.

## Nachweis

- Lehrplan-Schema: weist `abgelehnt` ohne `grund`, `lektion` ohne Datei, doppelte Abschnitt-Ids, überschneidende Seitenbereiche, mehr als drei Prinzipien je Abschnitt und `art`-lose Dateien ab — mit Tests auf die Meldung.
- `abdeckung`: reine Funktion, Tests für Repo, Buch und Folien, inklusive leerem Bestand und Lektion ohne Lehrplaneintrag.
- `dokument.mjs`: Briefkopf mit laufender Nummer wird entfernt (und `beiwerkZeichen` stimmt); Material ohne Textebene bricht ab, **wenig Text bricht nicht ab**; Bildseite und Tabellenseite werden mit Seitenzahl markiert; Silbentrennung.
- Gliederer: Fixtures unter `tests/fixtures/`, erzeugt von einem Skript unter `werkzeug/fixtures/`, damit sie nachvollziehbar sind — ein Buch-PDF mit Lesezeichen, eines ohne, ein EPUB; ein **Foliensatz-PDF im Querformat mit Briefkopf, Agendafolie, Titelläufen, einer Bildfolie und einer Tabellenfolie**; ein Satz ohne Agenda und ohne Titelläufe (gleichmäßige Teilung). Tests prüfen Grenzen, Seitenbereiche, Titel, `gliederung`-Wert.
- Handler: `__einlesen` (eine Datei, mehrere Dateien, Git) und `__auftrag` gegen ein temporäres Verzeichnis; Zurückweisung bei falschem Kurznamen, zu großer Anfrage, Auftrag auf `lektion`-Abschnitt.
- `pruefe-lektion`: weist eine Lektion mit einem wörtlich übernommenen Satz über zwölf Wörtern zurück; lässt Fachbegriffe und kurze Wendungen durch.
- Seite: der Bau erzeugt `/bibliothek/index.html` mit den Zahlen des heutigen Bestands (6 Prinzipien, 3 mit Lektion, 3 offen — und eine Lektion ohne Lehrplaneintrag, `recall-vor-precision`). Die Zahlen sind gegen den Bestand geprüft, nicht angenommen. Bei 375 px kein Überlauf, Aufklappknöpfe ≥ 44 px.
- **Ende-zu-Ende am echten Material**: die neun Foliensätze der Vorlesung einlesen. Erwartet und nachzuprüfen: kein Abbruch als „Scan"; Briefkopf entfernt und sein Anteil im Manifest ausgewiesen (überschlagen ein Drittel bis knapp die Hälfte — der Lauf misst es genau); in M7 sieben Bildfolien namentlich im Manifest; M7 in mehrere Abschnitte geteilt, M10 und M6 je einer. Dann Auftrag über die Seite, Skill-Lauf, Bau, Bestand zeigt die neue Abdeckung.

## Reihenfolge

Nach der Aufgabenfamilie. Der Compiler kann nur Typen erzeugen, die es gibt.

## Nachtrag nach 2a (2026-09-22)

2a, der Bestand, ist gebaut — Plan `docs/superpowers/plans/2026-09-22-bibliothek-2a-bestand.md` mit seinen Präzisierungen und den Nachträgen aus Reviews und Abnahme. Was davon vom Text oben abweicht:

- **Der Weg zur Seite** ist ein Verweis am Fuß der Übersicht, neben „Dein Lernprofil", nicht in der Kopfleiste. Die Kopfleiste ist bei 375 px schon zweizeilig (Marke und Umschalter brauchen 381 px, Platz ist für 335); ein weiterer Eintrag machte sie auf jeder Seite höher. Ob die Bibliothek doch in die Kopfleiste soll, ist offen.
- **Das Schema** steht in `src/lib/lehrplan.ts`, weil es auch die Seite zur Bauzeit und später ein Browser liest. `werkzeug/lehrplan.mjs` liest nur noch die Datei; der Aufruf im Compiler-Skill bleibt derselbe.
- **Schärfer als oben:** `stand` ist vollständig (Repo: der Commit mit 40 Zeichen; Buch und Folien: `sha256:` und 64 Zeichen), `quelle` ist der Kurzname des Ordners unter `quellen/`, `datei` ist in jedem Abschnitt Pflicht. Mängel stehen auf Deutsch und in einer Zeile, denn die Seite zeigt sie wörtlich.
- **Ein Manifest zählt nur zum Stand seines Lehrplans.** Fehlt es — so baut GitHub, denn `quellen/` ist gitignored —, steht die Zeile trotzdem da: „Lücken: unbekannt — das Manifest liegt nur am Rechner, auf dem eingelesen wurde". Bei Repos sind die Lücken die Auslassungen des Git-Adapters: „44 von 106 Dateien nicht übernommen".
- **Ein ungültiger Lehrplan bricht den Bau nicht ab.** Er steht als Warnung mit seinen Mängeln da, ohne Zahlen.
- **Lektionen ohne Lehrplaneintrag** sind heute zwei: `recall-vor-precision` und `pauschal-heisst-nicht-komplett`.
- **Offen für 2b:** Durchgang A leert bei Lehrmaterial `geprueftVon` (Abschnitt „Der Compiler-Skill"). Nach heutigem Bau verschwindet damit die Karte samt Zahlen, und alle früher freigegebenen Lektionen der Quelle stehen als „ohne Lehrplaneintrag" da. Das trifft schon das erste Einlesen, denn es legt einen Lehrplan ohne Freigabe an. Vorschlag: ein eigener Zustand „wartet auf Freigabe", wenn nur `geprueftVon` und `geprueftAm` fehlen — die Karte bleibt mit ihren Zahlen, markiert als nicht freigegeben. Entschieden wird im Plan für 2b.
