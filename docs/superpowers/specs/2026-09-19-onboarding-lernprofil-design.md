# Onboarding und Lernprofil

Stand: 2026-09-19 · Teilprojekt 3 · Grundlage: `docs/recherche/2026-09-19-lernprofil-instrumente.md` (84 Quellen gegen Crossref geprüft). Jede Wirkbehauptung in diesem Spec steht dort mit Quelle; hier wird nichts neu behauptet.

## Ziel

Beim Einstieg entsteht ein Lernprofil mit **benannter Schule, benannten Mustern und benanntem Fragebogen** — und es ändert tatsächlich etwas: Sitzungslänge, Reihenfolge, Hilfen und Coaching. Es verspricht dabei nur, was belegt ist.

## Entscheidungen

| Frage | Entscheidung | Warum |
|---|---|---|
| Welche Schule | **Lernstrategien und selbstreguliertes Lernen** für das Strategieprofil; **Vermunts vier Lernmuster** für das benannte Ergebnis | Die Lerntypen-Schulen (VARK, Kolb, Honey & Mumford, Felder) werden von ihren eigenen Urhebern nicht mehr zur Anpassung des Stoffs empfohlen; der Passungseffekt liegt über 17 Metaanalysen bei d = .04. Strategien sind veränderbar und hängen dokumentiert mit Leistung zusammen. Vermunts Modell erfüllt im LSRC-Bericht drei von vier Mindestkriterien — mehr als die anderen Typologien — und sein Autor versteht Muster ausdrücklich als veränderlich. |
| Welcher Fragebogen | **Eigene, neu formulierte Items** (Nutzerentscheidung vom 2026-09-19: keine Anfrage bei Autoren oder Verlagen) | Konstrukte sind frei, Wortlaute nicht. VARK verbietet Einbau und Umformulieren ausdrücklich, Kolb und Honey & Mumford sind Kaufprodukte, für ILS, LIST und LIST-K wurde keine Freigabe zum Nachbau gefunden. |
| Was folgt aus „eigene Items" | Die Messgüte ist **ungeprüft**, und das steht sichtbar in der App | Eine Skala ohne Validierung als Diagnose auszugeben wäre genau die Sorte Behauptung ohne Beleg, die dieses Projekt ausschließt. |
| Was die Hauptlast trägt | **Verhaltensmaße** aus der Nutzung: Trefferquote beim ersten Kontakt (Vorwissen), Kalibrierung, tatsächliche Lerntage | Selbstauskünfte bilden das tatsächliche Lernverhalten nicht zuverlässig ab. Verhalten fällt ohnehin an und lässt sich nachführen. |
| Pflicht oder Angebot | **Angebot**, überspringbar, wiederholbar | Selbst zu entscheiden ist einer der wenigen Motivationshebel mit belastbarer Grundlage. Ein Zwangsformular vor dem ersten Inhalt ist das Gegenteil. |

## Die Trennlinie

Drei Arten von Auskunft, drei Arten von Wirkung — nie vermischt:

1. **Vorlieben** (Format, Einstieg, Sitzungslänge) → steuern **Voreinstellungen und Abwechslung**. Heißen in der App „Vorliebe", nie „Lerntyp". Kein Inhalt wird deswegen vorenthalten.
2. **Strategien und Lernmuster** (Selbstauskunft) → steuern **Coaching**: ein konkreter Vorschlag je Schwachstelle, formuliert als veränderbare Gewohnheit.
3. **Verhalten** (Vorwissen, Kalibrierung, Lerntage) → steuert **Hilfen und Auswahl**: wer ein Prinzip beim ersten Kontakt sicher trifft, springt zur Anwendung; wer sich überschätzt, bekommt seine Kalibrierung gezeigt.

**Nie versprochen wird:** dass man besser lernt, wenn der Stoff zum Muster passt · dass das Audit einen festen Typ diagnostiziert · feste Behaltensquoten · die 85-Prozent-Regel als Gesetz (sie stammt aus Rechenmodellen, nicht aus Versuchen mit Menschen; als Faustregel 75–90 % Trefferquote) · dass „Überblick zuerst" immer wirkt.

## Teil 3a — Audit und Profil (baubar ohne Abhängigkeit)

### Ablauf

Auf der Übersicht erscheint, solange kein Profil gespeichert ist, eine Karte: **„Lernprofil anlegen — etwa vier Minuten"**, mit „Später" daneben. Die Seite `/profil/audit` führt durch drei Schritte:

1. **26 Aussagen** in Gruppen zu je fünf bis sechs, fünfstufig von „trifft gar nicht zu" bis „trifft völlig zu". Reihenfolge gemischt (deterministisch), damit die Skalen nicht erkennbar blockweise kommen.
2. **Drei Vorlieben.**
3. **Ergebnis** auf `/profil`.

Abbrechen ist jederzeit möglich; der Zwischenstand bleibt liegen. Jede Tippfläche ≥ 44 px, der ganze Ablauf per Tastatur, kein Überlauf bei 375 px.

### Die Items — eigene Formulierungen

Verhaltensnah und auf diese App zugeschnitten (Lernen neben dem Beruf, aus Unterlagen). Kein Item lehnt sich an den Wortlaut eines bestehenden Fragebogens an.

**Strategieprofil — sechs Skalen zu je drei Aussagen**

| Skala | Gruppe | Aussagen |
|---|---|---|
| **Ordnen** | kognitiv | Ich mache mir eine eigene Gliederung oder Skizze, bevor ich Einzelheiten lerne. · Ich fasse einen Abschnitt in wenigen eigenen Sätzen zusammen. · Ich unterscheide beim Lesen, was Kernaussage ist und was Beispiel. |
| **Verknüpfen** | kognitiv | Ich überlege, wo mir das Gelernte im Beruf schon begegnet ist. · Ich suche nach eigenen Beispielen für eine Regel. · Ich frage mich, wie ein neuer Begriff mit dem zusammenhängt, was ich schon weiß. |
| **Abrufen** | kognitiv | Ich prüfe mich selbst, ohne in die Unterlagen zu sehen. · Ich wiederhole Stoff über mehrere Tage verteilt statt am Stück. · Wenn ich etwas nicht abrufen kann, schlage ich nach und versuche es später noch einmal. |
| **Steuern** | metakognitiv | Bevor ich anfange, lege ich fest, was ich in dieser Sitzung schaffen will. · Ich merke beim Lernen, wenn ich etwas nur überflogen und nicht verstanden habe. · Wenn eine Lernweise nicht trägt, ändere ich sie. |
| **Dranbleiben** | ressourcenbezogen | Ich lerne auch dann weiter, wenn der Stoff zäh wird. · Beim Lernen schalte ich Ablenkungen bewusst ab. · Ich halte mich an Lernzeiten, die ich mir vorgenommen habe. |
| **Zeit einteilen** | ressourcenbezogen | Ich weiß zu Wochenbeginn, wann ich lernen werde. · Vor einer Prüfung fange ich so früh an, dass am letzten Abend nichts Neues mehr ansteht. · Ich teile großen Stoff in Portionen, die in eine Sitzung passen. |

„Abrufen" steht hier, wo LIST „Wiederholen" führt — mit Absicht: Wiederlesen ist die schwächere Technik, sich abzufragen und zu verteilen die stärkere. Eine eigene Ableitung darf das berücksichtigen.

**Lernmuster nach Vermunt — vier Muster zu je zwei Aussagen**

| Muster | Aussagen |
|---|---|
| **bedeutungsorientiert** | Ich will verstehen, warum etwas gilt, nicht nur, dass es gilt. · Ich bilde mir zu dem, was ich lese, ein eigenes Urteil. |
| **reproduktionsorientiert** | Ich lerne vor allem das, was voraussichtlich abgefragt wird. · Ich präge mir Definitionen und Aufzählungen möglichst wortgetreu ein. |
| **anwendungsorientiert** | Mich interessiert an neuem Stoff zuerst, was ich damit praktisch anfangen kann. · Ich merke mir Dinge am besten, wenn ich sie an einem echten Fall durchspiele. |
| **ungerichtet** | Ich weiß oft nicht, womit ich beim Lernen anfangen soll. · Ich bin unsicher, ob meine Art zu lernen die richtige ist. |

**Vorlieben — drei Fragen, Einfachwahl**

- *Womit steigst du lieber ein?* Überblick zuerst · Beispiel zuerst · egal
- *Wie lang darf eine Sitzung sein?* 5 · 10 · 20 Minuten
- *Was liest du lieber?* knappe Stichpunkte · ausformulierte Absätze · egal

### Auswertung

Rein und ohne Speicherzugriff (`src/profil/auswertung.ts`):

- **Skalenwert** = Mittel der beantworteten Aussagen der Skala, 1–5. Eine Skala mit weniger als zwei Antworten gilt als **nicht erhoben** (`null`, nicht 0 — das wäre eine Aussage).
- **Lernmuster** = das Muster mit dem höchsten Mittel. Liegen die beiden höchsten weniger als 0,5 auseinander, heißt das Ergebnis **„zwischen A und B"** — eine scharfe Grenze bei zwei Items je Muster wäre vorgetäuschte Genauigkeit.
- **Strukturhinweis**: Liegt „ungerichtet" bei 3,5 oder höher, wird das unabhängig vom führenden Muster gemeldet. Das ist das Muster mit dem klarsten Befund (durchgehend negativer Zusammenhang mit Leistung) und das, bei dem die App am meisten helfen kann.
- **Schwachstellen** = die zwei niedrigsten Strategie-Skalen unter 3,0. Gibt es keine, gibt es keinen Vorschlag — das Profil erfindet keinen Mangel.

### Die Ergebnisseite `/profil`

1. **Das Muster**, mit dem Wort „derzeit": *„Dein Lernmuster ist derzeit anwendungsorientiert."* Darunter zwei Sätze, was das heißt, und der Satz: *„Muster ändern sich mit Stoff und Übung. Das ist eine Momentaufnahme, keine Diagnose."*
2. **Sechs Balken** für die Strategien, mit Zahl, nicht nur Farbe.
3. **Je Schwachstelle ein Vorschlag** — konkret, klein, an die App gebunden (Tabelle unten).
4. **Der Beipackzettel**, immer sichtbar, nicht im Kleingedruckten:
   *„Dieses Profil beruht auf eigenen Aussagen nach veröffentlichten Modellen der Lernstrategien (LIST, MSLQ) und den Lernmustern nach Vermunt. Es ist keine geprüfte Skala. Was die App über dein Lernen wirklich weiß, stammt aus deinen Antworten auf Aufgaben — siehe Kalibrierung."*
5. **„Neu erheben"** — und ab acht Wochen nach der Erhebung der Hinweis, dass sich eine Wiederholung lohnt.

### Was eine Schwachstelle vorschlägt

| Skala niedrig | Vorschlag (Wortlaut in der App) |
|---|---|
| Ordnen | „Schreib nach jeder Lektion den Satz des Prinzips in eigenen Worten auf — ein Satz reicht." |
| Verknüpfen | „Nimm dir bei jedem Transfer eine Minute: Wo ist dir das im eigenen Projekt begegnet?" |
| Abrufen | „Lass die App fragen, bevor du nachliest. Es fühlt sich schwerer an und wirkt besser." |
| Steuern | „Leg vor der Sitzung fest, was danach sitzen soll — ein Satz reicht. Prüf am Ende selbst, ob er stimmt." |
| Dranbleiben | „Nimm dir fünf Minuten vor, nicht eine Stunde. Kurz und täglich schlägt lang und selten." |
| Zeit einteilen | „Leg deine Lerntage für die Woche fest, bevor sie anfängt. Ein fester Termin wird eher eingehalten als ein guter Vorsatz." |

### Daten

Im Speicher `einstellungen`, Schlüssel `profil`:

```ts
type Profilstand = {
  readonly itemsatz: 1;                       // steigt, wenn sich Aussagen aendern
  readonly erhoben: string;                   // ISO-Zeitpunkt
  readonly antworten: Readonly<Record<string, 1 | 2 | 3 | 4 | 5>>;  // Item-Id -> Wert
  readonly vorlieben: { einstieg: 'ueberblick' | 'beispiel' | 'egal'; minuten: 5 | 10 | 20; text: 'stichpunkte' | 'absaetze' | 'egal' };
};
```

Gespeichert werden die **Antworten**, nicht das Ergebnis. Ändert sich die Auswertung, stimmt das Profil beim nächsten Öffnen von selbst — ohne Migration. `itemsatz` verhindert, dass Antworten auf alte Aussagen mit neuen verrechnet werden. Der Speicher braucht **keine** neue Fassung; `einstellung()` gibt `unknown` zurück, und ein Zod-Schema prüft beim Lesen. `alsJson()` nimmt das Profil automatisch mit.

### Dateien

```
src/profil/
  items.ts          die 26 Aussagen mit Id, Skala oder Muster, Text; die drei Vorlieben
  schema.ts         ProfilstandSchema (Zod) — prueft, was aus dem Speicher kommt
  auswertung.ts     Skalenwerte, Lernmuster, Strukturhinweis, Schwachstellen — rein
  vorschlag.ts      Schwachstelle -> Vorschlag; Profil -> Voreinstellungen — rein
  Audit.tsx         der Fragebogen als Insel
  Ergebnis.tsx      Muster, Balken, Vorschlaege, Beipackzettel
src/pages/profil/index.astro    Ergebnis
src/pages/profil/audit.astro    Fragebogen
```

### Nachweis 3a

- `items.ts`: jede Skala genau drei, jedes Muster genau zwei Aussagen; Ids eindeutig; keine Aussage doppelt.
- `auswertung.ts`: Mittelwerte; `null` bei zu wenig Antworten statt 0; „zwischen A und B" unter 0,5 Abstand; Strukturhinweis ab 3,5 unabhängig vom führenden Muster; keine Schwachstelle ohne Skala unter 3,0; fremder `itemsatz` → Profil gilt als nicht erhoben. Mutationsprobe an der Gleichstandsregel.
- `schema.ts`: weist Werte außerhalb 1–5, unbekannte Vorlieben und Fremdfelder zurück; ein unlesbarer Stand führt zu „kein Profil", nicht zu einem Absturz.
- `Audit.tsx`: ganzer Ablauf per Tastatur; Zwischenstand überlebt ein Neuladen; Speicherfehler hält den Ablauf nicht auf (Ergebnis wird gezeigt, nur nicht behalten — mit Hinweis).
- `Ergebnis.tsx`: Der Beipackzettel steht im Dokument, wann immer ein Muster dasteht — ein Test hält fest, dass das eine nie ohne das andere erscheint.
- Bei 375 px am gebauten Stand: Tippflächen, kein Überlauf.

## Teil 3b — Was das Profil steuert (braucht die Sitzungsseite)

Heute gibt es Lektionsseiten, aber **keine Seite, die eine Sitzung zusammenstellt** — `auswahl.ts` rechnet sie aus, nichts zeigt sie an. Die Landkarte und die Sitzung waren die letzten offenen Aufgaben des Tutor-Plans. Solange sie fehlen, kann ein Profil nichts steuern. 3b setzt deshalb das Teilprojekt „Sitzung und Landkarte" voraus.

| Eingabe | Art | Was sie verstellt |
|---|---|---|
| Sitzungslänge | Vorliebe | Zahl der Aufgaben je Sitzung |
| Einstieg | Vorliebe | Ob eine Quelle mit der Übersicht ihrer Prinzipien beginnt oder mit der ersten Lektion. **Die Takte innerhalb einer Lektion bleiben** — „erst spielen, dann erklären" ist Didaktik, keine Geschmacksfrage. |
| Textform | Vorliebe | Reserviert für den Compiler (Teilprojekt 4); ändert nie den Inhalt, nur die Länge der Prosa |
| Schwachstellen | Strategie | Welcher Vorschlag in der Sitzung erscheint; bei „Steuern": die Zielfrage vor und nach der Sitzung |
| Strukturhinweis | Muster | Die App schlägt einen festen Tagesplan vor, statt nur „fällig" anzuzeigen |
| Lernmuster | Muster | **Ton und Reihenfolge der Angebote**, nie der Stoff: anwendungsorientiert → Fälle zuerst angeboten; bedeutungsorientiert → Vertiefungsmodule früher angeboten; reproduktionsorientiert → Hinweis auf Transferaufgaben |
| Vorwissen je Lektion | Verhalten | Beim ersten Kontakt sicher und richtig → die Lektion bietet „direkt zur Anwendung" an (Expertise-Umkehr: Hilfen, die Anfängern nützen, bremsen Kundige) |
| Kalibrierung | Verhalten | Wie bisher: sicher-und-falsch kommt bevorzugt zurück; dazu die eigene Überzeugungslücke auf der Landkarte |
| Lerntage | Verhalten | **Abgleich von Selbstbild und Verhalten:** Wer „Ich wiederhole verteilt" hoch ankreuzt und an zwei von vierzehn Tagen lernt, bekommt genau das gezeigt — freundlich, mit Zahl. Das ist die eine Stelle, an der Selbstauskunft und Messung zusammenkommen. |

### Lernziele je Quelle

Beim Eintragen einer Quelle (Bibliothek, Teilprojekt 2) kommt **vor** der Gliederung ein Schritt: *Wofür lernst du das?*

```yaml
ziele:
  zweck: pruefung          # pruefung | anwendung | ueberblick
  termin: 2026-11-14       # wahlfrei
  lerntageProWoche: 4
  minutenProTag: 10
  freitext: "…"            # wahlfrei, ein Satz
```

Die Ziele stehen im Lehrplan der Quelle, nicht im Gerät: Der Compiler braucht sie (Teilprojekt 4 — was ist der Kern, was Vertiefung), und sie sollen mit der Quelle wandern. Aus `termin` und `lerntageProWoche` leitet die Sitzung den Wiederholungsplan ab; der günstigste Abstand wächst mit der Behaltensdauer.

### Standortbestimmung je Quelle

Beim ersten Öffnen einer Quelle bietet die Sitzung an: **„Standort bestimmen — sechs Aufgaben aus dem Kern, ohne Vorbereitung."** Jede mit Sicherheitsangabe. Ergebnis: Vorwissen je Lektion und eine erste Kalibrierung. Die Versuche sind nicht verloren — sie zählen als erste Abrufe und gehen in die Terminplanung ein wie jede andere Antwort. Überspringbar.

## Außerhalb

- Die Sitzungsseite und die Landkarte selbst (eigenes Teilprojekt, Voraussetzung für 3b).
- Validierung der Items. Möglich wäre später ein Vergleich von Skalenwerten und Verhalten über die eigene Historie — das ist Auswertung, keine Validierung, und wird nicht so genannt.
- Jede Anpassung des **Stoffs** an ein Muster oder eine Vorliebe.

## Reihenfolge

3a ist von nichts abhängig und kann nach der Aufgabenfamilie sofort gebaut werden. 3b folgt auf „Sitzung und Landkarte"; die Lernziele kommen mit der Bibliothek.
