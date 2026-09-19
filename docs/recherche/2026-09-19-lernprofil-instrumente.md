# Lernprofil-Instrumente für ein Onboarding-Audit

Recherchebericht vom 19.09.2026. Zweck: Grundlage für das Onboarding einer privaten, deutschsprachigen Lern-Web-App (Einzelperson, kein Verkauf).

## 0. Kurzantwort auf die drei Fragen

**(1) Welche „Schule" nimmt man?** Keine der Lerntypen-Schulen (VARK, Kolb, Honey & Mumford, Felder–Silverman) taugt als Diagnosegrundlage, aus der man Stoffaufbereitung ableitet. Die Urheber selbst lehnen das inzwischen ab (VARK-Learn, Kolb & Kolb, Felder), und die Forschung zur Passungshypothese findet keinen belastbaren Effekt (Teil B). Tragfähig ist die Schule der **Lernstrategien und des selbstregulierten Lernens**: MSLQ (Pintrich et al.) → LIST (Wild & Schiefele) → LIST-K (Klingsieck). Sie misst veränderbare Strategien statt fester Typen und zeigt dokumentierte Zusammenhänge mit Studienleistung (Anstrengungsregulation ρ = .40 in der MSLQ-Metaanalyse).

**(2) Welche Typen gibt es?** Siehe Tabelle in Teil A. Kurz: VARK kennt vier Modalitäten plus multimodal; Kolb vier klassische bzw. neun neue Stile; Honey & Mumford vier Stile; Felder–Silverman vier bipolare Dimensionen; Vermunt vier Lernmuster; Biggs und Entwistle Tiefen-, Oberflächen- und (Entwistle) strategischen Ansatz; MSLQ 15 Skalen; LIST 11 Skalen, LIST-K 13 Subskalen.

**(3) Welcher Fragebogen, und darf man ihn einbauen?** Kein Lernstil-Fragebogen ist zugleich rechtlich sauber einbaubar, unter fünf Minuten lang und messtechnisch gut belegt. VARK schließt den Einbau in Apps ausdrücklich aus (nur über kostenpflichtige API), Kolb und Honey & Mumford sind Kaufprodukte, der Felder-ILS ist nur zur Nutzung, nicht zum Nachbau freigegeben. Am nächsten kommt inhaltlich der deutschsprachige LIST-K (39 Items, dokumentierte Reliabilität), für den aber keine offene Lizenz gefunden wurde. Empfehlung in Teil D.

## 1. Methode und Lesehinweise

- **Verifikation der Literatur:** Jede wissenschaftliche Quelle wurde über `https://api.crossref.org/works?query.bibliographic=<Titel+Autor+Jahr>&rows=3` geprüft. Titel, Zeitschrift, Jahr und DOI stehen in Abschnitt 6 so, wie Crossref sie liefert. Wo Crossref nichts Passendes lieferte, steht „DOI nicht verifiziert".
- **Inhalte der Studien:** Abstracts wurden über offene Schnittstellen abgerufen. Das Kürzel hinter der Quelle nennt die Herkunft:
  - **[EPMC]** `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=DOI:"<DOI>"&resultType=core&format=json`
  - **[OA]** `https://api.openalex.org/works/doi:<DOI>`
  - **[ERIC]** `https://api.ies.ed.gov/eric/?search=title:"<Titel>"&format=json`
  - **[PM]** `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=<PMID>&rettype=abstract&retmode=text`
  - **[S2]** `https://api.semanticscholar.org/graph/v1/paper/DOI:<DOI>`
  - **[VT]** Volltext geöffnet (PDF oder Open-Access-Seite), URL jeweils angegeben
  - **[nur CR]** nur bibliografisch über Crossref geprüft, Inhalt in dieser Sitzung nicht geöffnet. Zu diesen Quellen macht der Bericht keine Inhaltsaussage.
- **Lizenz- und Produktseiten** wurden direkt geöffnet; die entscheidenden Seiten (VARK, TalentLens, IFEL, ComPADRE, EdInstruments) zusätzlich im Rohtext gegengelesen, weil die automatische Seitenzusammenfassung in zwei Fällen nachweislich falsche Angaben erfand (eine erfundene Zeitschrift, ein erfundener Berichtstitel).
- **Zitate:** Fragebogen-Items wurden nicht übernommen. Der Bericht enthält genau ein wörtliches Kurzzitat (VARK, Abschnitt 2.1); alles andere ist paraphrasiert.
- **„NICHT VERIFIZIERT"** kennzeichnet wörtlich alles, was nicht an einer in dieser Sitzung geöffneten Quelle belegt werden konnte. Dauerangaben mit dem Zusatz „Schätzung" sind eigene Überschläge ohne Beleg.
- **Gesperrte Quellen:** `educationdesignsinc.com` (offizielle ILS-Seite samt FAQ) verlangt ein CAPTCHA und wurde deshalb nicht geöffnet. ResearchGate lieferte durchgehend 403. `johnbiggs.com.au` ist seit 2026 eine geparkte Domain. Die ETL-Projektseite der Universität Edinburgh hat ein abgelaufenes Zertifikat bzw. liefert 404.
- **Keine Rechtsberatung.** Die rechtlichen Hinweise geben Lizenztexte und Gesetzeswortlaut wieder; die Bewertung im Einzelfall bleibt offen.

## 2. Teil A — Instrumente

### Übersicht

| Instrument | Urheber, Jahr | Typen / Dimensionen | Items, Dauer | Lizenz, Einbau in eigene App | Deutsche Fassung | Messgüte (Kurz) |
|---|---|---|---|---|---|---|
| VARK | Fleming & Mills 1992; VARK-Learn Ltd | Visual, Aural, Read/write, Kinesthetic, dazu multimodal | 16 Fragen (Version 9.2), Mehrfachwahl; ca. 5–10 Min. (Schätzung) | Urheberrecht und Marke. Einbau in Apps, eigenes Hosting, Umformulieren ausdrücklich ausgeschlossen; nur über kostenpflichtige API | Ja, auf der offiziellen Seite | α .73–.78 (Herstellerangabe); Leite et al. 2010: Reliabilität ausreichend, Validität vorläufig, Warnung für Forschungseinsatz |
| Kolb KLSI 4.0 (jetzt KELP) | Kolb 1971; Kolb & Kolb 2011/2013 | Klassisch 4 (Accommodating, Assimilating, Converging, Diverging); neu 9 (Initiating, Experiencing, Imagining, Reflecting, Analyzing, Thinking, Deciding, Acting, Balancing) | 20 Items, Rangreihen; KELP 10–15 Min. | Kaufprodukt, 35 USD je Durchführung, nur online beim Anbieter. Keine Nachbau-Lizenz gefunden | In der Übersetzungsliste des Handbuchs fehlt Deutsch; NICHT VERIFIZIERT | α im Mittel .81 (Herstellerangabe); keine Retest-Studie zur 4.0; Henson & Hwang 2002: stark schwankende Reliabilitäten |
| Honey & Mumford LSQ | Honey & Mumford 1982 (Manual; revidiert 1992, ersetzt 2000); heute Pearson TalentLens | Activist, Reflector, Theorist, Pragmatist | 40 oder 80 Items; 10–20 Min. | Pearson, alle Rechte vorbehalten. Nachdruck von Items und Übersetzungen nur mit schriftlicher Erlaubnis | Ja (TalentLens listet Deutsch) | Duff & Duffy 2002: Faktorstruktur nicht bestätigt, Reliabilität unzureichend, kein stabiler Bezug zur Leistung |
| Felder–Soloman ILS | Felder & Silverman 1988 (Modell); Felder & Soloman 1991/1994 (Instrument) | 4 Dimensionen: aktiv/reflektiv, sensorisch/intuitiv, visuell/verbal, sequenziell/global | 44 Items (4 × 11), a/b-Zwangswahl; ca. 10 Min. (Schätzung) | Kostenlos zur nicht-kommerziellen Nutzung durch Einzelne und Lehrende; Firmen lizenzieren bei der NC State University. Urheberrechtsvermerk mit allen Rechten vorbehalten. Nachbau in eigener App nirgends eingeräumt | NICHT VERIFIZIERT | α .41–.76; Retest .51–.87; Litzinger et al. 2007: α .55–.77, mehrere Faktoren je Skala |
| Vermunt ILS | Vermunt 1994/1998 | 4 Lernmuster: bedeutungs-, reproduktions-, anwendungsorientiert, ungerichtet | 120 Items, 20 Skalen, 5-stufig; ca. 25–30 Min. (Schätzung) | Urheberrecht beim Autor, Erlaubnis nötig: NICHT VERIFIZIERT am Primärtext | NICHT VERIFIZIERT | Coffield 2004: drei von vier Mindestkriterien; Boyle et al. 2003: Vier-Faktoren-Modell bestätigt, nur schwache Bezüge zur Leistung |
| Biggs R-SPQ-2F | Biggs, Kember & Leung 2001 | Tiefenansatz, Oberflächenansatz; je Motiv- und Strategie-Subskala | 20 Items, 5-stufig; ca. 5 Min. (Schätzung) | Urheberrecht bei Biggs und Kember. Freie Nutzung für Lehrevaluation und Forschung mit Quellenangabe nur indirekt belegt; App-Einbau nicht geregelt | Keine gefunden | Original: α akzeptabel, CFA gut. Johnson et al. 2021: Validitätsbedenken; Stes et al. 2013: kulturabhängige Faktorstruktur |
| Entwistle ASSIST | Tait, Entwistle & McCune 1997/98 | Tiefenansatz, strategischer Ansatz, Oberflächenansatz | 52 Items, 13 Subskalen, 5-stufig; ca. 15 Min. (Schätzung) | Frei mit Quellenangabe: NICHT VERIFIZIERT am Primärtext | NICHT VERIFIZIERT | Dedos & Fouskakis 2021: α .84 / .84 / .73; Coffield 2004: zwei von vier Mindestkriterien |
| MSLQ | Pintrich, Smith, Garcia & McKeachie 1991 | 15 Skalen: 6 Motivation, 9 Lernstrategien (kognitiv, metakognitiv, Ressourcen) | 81 Items, 7-stufig; 20–30 Min.; Skalen einzeln einsetzbar | EdInstruments führt es als Open Access. Die Aussage, es sei gemeinfrei: NICHT VERIFIZIERT am Primärtext. Manual frei bei ERIC | Autorisierte deutsche Fassung: NICHT VERIFIZIERT. LIST baut auf dem MSLQ auf | Credé & Phillips 2011: Validität je Skala ρ .05 bis .40; α .52–.93; de Araujo et al. 2023: drei Skalen unzuverlässig |
| LIST | Wild & Schiefele 1994 | 11 Skalen in drei Gruppen: kognitiv, metakognitiv, ressourcenbezogen | 77 Items; ca. 15 Min. (Schätzung) | Urheberrechtlich geschützt, keine öffentliche Lizenz (publish.UP). Im Open Test Archive nicht gelistet | Original deutsch | Wild & Schiefele: Reliabilität zufriedenstellend (N = 310); Boerner et al. 2005: Struktur bestätigt, Bezüge zur Note gering |
| LIST-K | Klingsieck 2018 | 13 Subskalen in denselben drei Gruppen | 39 Items; ca. 5–7 Min. (Schätzung) | Hogrefe-Zeitschrift, geschlossen, keine Lizenz bei Crossref oder OpenAlex hinterlegt. Keine Nutzungsfreigabe gefunden | Original deutsch | Drei Studien: Faktorstruktur stabil, Subskalen-Reliabilität akzeptabel bis sehr gut, mindestens so reliabel wie das Original |

### 2.1 VARK (Fleming)

Neil Fleming stellte VARK 1987 vor; die Erstveröffentlichung ist Fleming & Mills (1992). Das Modell unterscheidet vier Wahrnehmungsvorlieben; rund zwei Drittel der Befragten gelten laut Anbieter als multimodal. Der aktuelle Fragebogen (Version 9.2) hat 16 Fragen mit je vier ankreuzbaren Antworten, Mehrfachwahl ist erlaubt. Die offizielle Seite bietet ihn in über 40 Sprachen an, darunter Deutsch.

Die Lizenzlage ist eindeutig und für den Zweck hinderlich. Modell, Fragebogen und Begleitmaterial sind urheberrechtlich geschützt, das Wort VARK ist seit 2012 Marke. Die Rechteseite nennt ausdrücklich, wofür keine Erlaubnis erteilt wird: Hosting auf eigener Website oder eigenem Server, Einbau in Apps oder Umfragetools (außer über die kostenpflichtige VARK-API), Umformulieren des Fragebogens, Datenerhebung mit eigenem System. Auch passwortgeschützte Kopien gelten als Verstoß. Eine eigene Übersetzung scheidet damit ebenfalls aus. Persönliche Nutzung auf der Anbieterseite ist frei. Das Abo mit API kostet 50 USD im Jahr für 30 Teilnehmende.

Zur Messgüte nennt der Anbieter α zwischen .73 und .78. Leite, Svinicki & Shi (2010) fanden ausreichende Reliabilität und vorläufige Validitätshinweise, benannten aber Probleme mit Itemformulierung und Auswertungsalgorithmus und rieten beim Forschungseinsatz zur Vorsicht.

Der Anbieter distanziert sich selbst von der Passungsidee: „VARK is NOT about matching teaching materials to learning preferences" (https://vark-learn.com/research/guide-for-researchers/). Es gehe um Lernstrategien, die Lernende ausprobieren können; das bloße Kennen der Vorliebe verbessere das Lernen kaum.

Belege: https://vark-learn.com/copyright-information/ · https://vark-learn.com/research/guide-for-researchers/ · https://vark-learn.com/the-vark-questionnaire/ · https://vark-learn.com/research/validity-and-reliability/ · https://vark-learn.com/product/vark-subscription/ · https://vark-learn.com/introduction-to-vark/the-vark-modalities/ · Leite et al. [ERIC, EJ879083]

### 2.2 Kolb Learning Style Inventory (KLSI 4.0, heute KELP)

Das Inventar beruht auf Kolbs Theorie des Erfahrungslernens mit den vier Modi konkrete Erfahrung, reflektierende Beobachtung, abstrakte Begriffsbildung und aktives Experimentieren. Die Fassung 4.0 (2011) hat 20 Items im Rangreihenformat, zwölf davon ähnlich der Fassung 3.1, acht neue messen Lernflexibilität. Sie ersetzt die vier klassischen Stile durch neun und war nur online verfügbar.

Der Vertriebspartner, das Institute for Experiential Learning, erklärt die KLSI 4.0 für abgelöst durch das Kolb Experiential Learning Profile (KELP). Dieses kostet 35 USD je Durchführung und dauert 10 bis 15 Minuten. Die älteren Fassungen 3.1 und 3.2 vertreibt Korn Ferry. Das Handbuch erwähnt eine Forschungsversion; deren Bedingungen sind NICHT VERIFIZIERT. Eine Freigabe zum Nachbau wurde nirgends gefunden. Die Übersetzungsliste im Handbuch nennt Arabisch, Chinesisch, Französisch, Japanisch, Italienisch, Portugiesisch, Spanisch, Schwedisch und Thai, nicht aber Deutsch.

Die Autoren berichten eine mittlere interne Konsistenz von .81 (N = 10 423) und räumen ein, dass es zur Fassung 4.0 keine Retest-Studie gibt. Für die 3.1 liegen zwei Studien vor: eine mit Werten über .9, eine mit im Mittel .54, bei der 47 % der Studierenden beim zweiten Durchgang einem anderen Stil zugeordnet wurden. Henson & Hwang (2002) fanden über Studien hinweg stark schwankende Reliabilitäten. Manolis et al. (2013) sprechen von ernsten Schwächen und schlagen ein kontinuierliches Kurzmaß vor. Coffield et al. (2004) sehen nur eines von vier Mindestkriterien erfüllt.

Zur Passung schreiben Kolb & Kolb, das Inventar sei nicht dafür gedacht, Lernende unterschiedlichen Lehrangeboten zuzuweisen; das laufe auf Stereotypisierung hinaus. Lernstil sei ein veränderlicher Zustand, kein festes Merkmal. Empfohlen wird, den ganzen Lernzyklus zu durchlaufen.

Belege: https://learningfromexperience.com/downloads/research-library/the-kolb-learning-style-inventory-4-0.pdf [VT] · https://experientiallearninginstitute.org/kolb-learning-style-inventory-4-0/ · https://experientiallearninginstitute.org/product/kolb-experiential-learning-profile-kelp-individual-purchase/ · https://learningfromexperience.com/tools/kolb-experiential-learning-profile-kelp/ · Henson & Hwang [OA] · Manolis et al. [ERIC, EJ1007790] · Coffield [VT]

### 2.3 Honey & Mumford Learning Styles Questionnaire (LSQ)

Der LSQ überträgt Kolbs Lernzyklus in vier Stile für den Managementkontext. Pearson TalentLens vertreibt ihn in einer Fassung mit 40 und einer mit 80 Aussagen, online oder gedruckt, 10 bis 20 Minuten, ab 16 Jahren. Die Seite richtet sich laut eigenem Vermerk nur an Kunden im Vereinigten Königreich. Deutsch ist als Sprache gelistet.

Die Seite trägt einen Pearson-Urheberrechtsvermerk mit allen Rechten vorbehalten. Die allgemeinen Verkaufs- und Nutzungsbedingungen von Pearson Assessments untersagen das Vervielfältigen von Testitems, Skalen und Auswertungsalgorithmen, auch unentgeltlich, und erlauben Anpassungen oder Übersetzungen nur mit vorheriger schriftlicher Zustimmung (Anfragen an pas.licensing@pearson.com). Einschränkung: Geöffnet wurde die Bedingungsseite von Pearson Assessments (USA); die britische TalentLens-Lizenzvereinbarung selbst ist NICHT VERIFIZIERT.

Die unabhängige Prüfung fällt schwach aus. Duff & Duffy (2002, N = 388) konnten weder Kolbs zwei Dimensionen noch die vier Stile faktorenanalytisch bestätigen, brachten die interne Konsistenz auch durch Itemauswahl nicht auf ein befriedigendes Niveau und fanden keinen stabilen Zusammenhang mit Studienleistung. Cockerton et al. (2002, N = 284) fanden eine Vier-Faktoren-Lösung als beste der geprüften. Coffield et al. sehen eines von vier Mindestkriterien erfüllt.

Was Honey & Mumford selbst zur Passung sagen, ist am Primärtext NICHT VERIFIZIERT. Laut Coffield enthält das Manual Vorschläge, wenig genutzte Stile zu stärken, und die Autoren raten von der Verwendung zur Personalauswahl ab.

Belege: https://www.talentlens.com/honey-and-mumford.html · https://www.pearsonassessments.com/footer/terms-of-sale---use.html · https://research-portal.uws.ac.uk/en/publications/psychometric-properties-of-honey-amp-mumfords-learning-styles-que/ · Cockerton et al. [PM, 12416844] · Coffield [VT]

### 2.4 Felder–Soloman Index of Learning Styles (ILS)

Das Modell stammt aus Felder & Silverman (1988, Engineering Education 78(7), 674–681). Felder strich später die Dimension induktiv/deduktiv und benannte visuell/auditiv in visuell/verbal um. Das Instrument entstand 1991, wurde 1994 nach einer Faktorenanalyse überarbeitet und steht seit 1996/97 im Netz. Es hat 44 Fragen, elf je Dimension, jeweils mit zwei Antwortmöglichkeiten.

Felder & Spurlin (2005) beschreiben die Bedingungen so: kostenlos für Einzelne, die ihr eigenes Profil bestimmen wollen, und für Lehrende oder Studierende, die es in Unterricht oder Forschung einsetzen; Organisationen außerhalb des Bildungsbereichs können eine Lizenz erwerben. Der ComPADRE-Katalogeintrag bestätigt das und nennt die NC State University als Lizenzgeberin. Das Online-Werkzeug trägt einen Urheberrechtsvermerk zugunsten Felders mit allen Rechten vorbehalten und speichert nach eigener Angabe keine Antworten. Ein Recht, den Fragebogen in einer eigenen Anwendung nachzubauen oder zu übersetzen, räumt keine der geöffneten Quellen ein. Die offizielle FAQ-Seite war wegen eines CAPTCHAs nicht zugänglich; ihr Inhalt ist NICHT VERIFIZIERT. Eine autorisierte oder validierte deutsche Fassung ist NICHT VERIFIZIERT; Felder schrieb 2002, das Instrument sei in etwa ein halbes Dutzend Sprachen übersetzt, ohne sie zu nennen.

Die Messgüte ist mäßig. Felder & Spurlin berichten aus vier Studien α zwischen .41 und .76 und Retest-Korrelationen zwischen .51 und .87 (vier Wochen bis acht Monate). Sie setzen die Annehmbarkeitsschwelle selbst auf .50 mit der Begründung, es handle sich um Einstellungen, nicht um Leistung. Litzinger et al. (2007) fanden α .55 bis .77 und mehrere Faktoren innerhalb von drei der vier Skalen. Hosford & Siders (2010) bestätigen die vorgesehene Struktur bei mäßiger Reliabilität.

Felder lehnt die Passungshypothese ausdrücklich ab. In seinem Beitrag von 2020 räumt er ein, dass sie keine belastbare Forschungsstütze hat, und nennt als Zweck von Lernstilen eine ausgewogene Lehre, die alle Pole jeder Dimension bedient. Lernstilprofile dürften nie als Grundlage für Studien- oder Berufsberatung dienen.

Belege: https://engr.ncsu.edu/wp-content/uploads/drive/1ZbL_vMB7JmHGABSgr-xCCP2z-xiS_bBp/2005-ILS_Validation%28IJEE%29.pdf [VT] · https://engr.ncsu.edu/wp-content/uploads/drive/1tKCP5oEAV5VV4Yb97j-IG_geuBxCQqB6/2020-AEE%20Learning%20Styles%20Opinion%20Piece.pdf [VT] · https://engr.ncsu.edu/wp-content/uploads/drive/1QP6kBI1iQmpQbTXL-08HSl0PwJ5BYnZW/1988-LS-plus-note.pdf [VT] · https://learningstyles.webtools.ncsu.edu · https://www.compadre.org/portal/items/detail.cfm?ID=2044 · https://engr.ncsu.edu/stem-resources/legacy-site/education-related-papers/ · Litzinger et al. [OA] · Hosford & Siders [PM, 20936578]

### 2.5 Vermunt Inventory of Learning Styles / Learning Patterns

Vermunt entwickelte das Inventar aus phänomenografischen Studien. Es erfasst vier Komponenten (Verarbeitungsstrategien, Regulationsstrategien, Lernkonzeptionen, Lernorientierungen) auf 20 Skalen. Aus deren Zusammenspiel ergeben sich vier Muster. Coffield et al. beschreiben es als Selbsteinschätzung mit 120 Items auf fünfstufigen Skalen. Für ein Onboarding ist es damit zu lang.

Vermunt & Donche (2017) erklären, sie hätten um 2004 den Begriff Lernstil aufgegeben, weil er als unveränderliches Persönlichkeitsmerkmal missverstanden werde. Ein Lernmuster sei das Ergebnis des Zusammenspiels von Person und Umfeld. Bedeutungsorientiertes Lernen hänge überwiegend positiv, ungerichtetes Lernen durchgehend negativ mit Studienleistung zusammen; die übrigen Bezüge schwankten nach Fach, Kultur und Prüfungsform. Statt Anpassung an das Muster empfehlen sie prozessorientierte Lehre mit schrittweiser Übergabe der Steuerung an die Lernenden.

Boyle, Duffy & Dunleavy (2003, N = 273) bestätigten das Vier-Faktoren-Modell an britischen Studierenden und fanden nur schwache Zusammenhänge mit Leistung. Coffield et al. sehen drei von vier Mindestkriterien erfüllt, mehr als bei den meisten anderen Modellen.

Die Nutzungsbedingungen sind NICHT VERIFIZIERT: Ein Suchtreffer verweist auf einen Urheberrechtsvermerk des Autors mit Erlaubnisvorbehalt in einer bei ResearchGate abgelegten Fassung, die nicht geöffnet werden konnte. Eine deutsche Fassung ist NICHT VERIFIZIERT.

Belege: https://api.repository.cam.ac.uk/server/api/core/bitstreams/57d19303-8013-4347-93a0-87230801a098/content [VT, CC BY] · https://www.repository.cam.ac.uk/items/1e5e55f7-ad24-4b84-b830-e6bfc83c83b0 · Vermunt 1998 [OA] · Boyle et al. [PM, 12828816] · Coffield [VT]

### 2.6 Biggs R-SPQ-2F

Die revidierte Zwei-Faktoren-Fassung des Study Process Questionnaire hat 20 Items: je fünf für Tiefenmotiv, Tiefenstrategie, Oberflächenmotiv und Oberflächenstrategie. Entwickelt wurde sie an 229 Studierenden in Hongkong und an 495 weiteren geprüft, mit akzeptablen α-Werten und guter Passung der Zwei-Faktoren-Struktur. Als Zweck nennen die Autoren ein einfaches Werkzeug, mit dem Lehrende ihre eigene Lehre und die Lernansätze ihrer Studierenden bewerten. Das Instrument bildet also den Ansatz in einem bestimmten Kurs ab, keinen festen Typ.

Spätere Prüfungen sind gemischt. Stes et al. (2013) konnten die ursprüngliche Zwei-Faktoren-Struktur an der niederländischen Fassung nicht reproduzieren und mahnen zur Vorsicht bei kulturübergreifender Verwendung. Johnson et al. (2021) fanden trotz brauchbarer Reliabilität (ω um .80) eine schwache Modellpassung und bei 12 von 20 Items Widersprüche zwischen Fragebogen- und Interviewaussagen; das Instrument habe die Studierenden in ihrem Kurs nicht nach Tiefen- und Oberflächenansatz trennen können.

Die Rechtslage ließ sich nur indirekt klären. Ein Open-Access-Artikel (Dove Press) erkennt in der Danksagung an, dass das Urheberrecht bei John Biggs und David Kember liegt. Suchtreffer geben an, der Originalartikel lade zur Nutzung für Lehrevaluation und Forschung gegen Quellenangabe ein und Biggs' Website habe den kostenlosen Download angeboten. Beides ist NICHT VERIFIZIERT: Der Originalartikel liegt hinter einer Bezahlschranke, und `johnbiggs.com.au` ist inzwischen eine geparkte Domain. Ein Einbau in eine App ist in keiner geöffneten Quelle geregelt. Eine deutsche Fassung wurde nicht gefunden.

Belege: Biggs et al. [PM, 11307705] · https://pmc.ncbi.nlm.nih.gov/articles/PMC8084138/ [VT] · https://pmc.ncbi.nlm.nih.gov/articles/PMC3546932/ [VT] · https://www.dovepress.com/learning-approach-among-health-sciences-students-in-a-medical-college--peer-reviewed-fulltext-article-AMEP · https://johnbiggs.com.au/academic/students-approaches-to-learning/ (geparkt)

### 2.7 Entwistle ASSIST

Das Approaches and Study Skills Inventory for Students entstand 1997 in Edinburgh aus dem älteren Approaches to Studying Inventory. Der Hauptteil hat 52 Items auf fünfstufiger Skala: 16 zum Tiefenansatz (vier Subskalen), 20 zum strategischen Ansatz (fünf Subskalen), 16 zum Oberflächenansatz (vier Subskalen). Coffield et al. heben hervor, dass Entwistle von Ansätzen spricht und nicht von Lernertypen.

Dedos & Fouskakis (2021) berichten aus einer achtjährigen Erhebung mit 1181 Studierenden α = .84 (tief), .84 (strategisch) und .73 (Oberfläche), im Einklang mit früheren Studien. Byrne et al. (2004) fanden die drei Ansätze bei Studierenden in den USA und Irland wieder. Coffield et al. sehen zwei von vier Mindestkriterien erfüllt und merken an, dass Fragebogenklassifikationen sich in Interviews mit denselben Studierenden nicht immer bestätigen.

Die Aussage, das Inventar dürfe gegen bloße Quellenangabe frei verwendet werden, erscheint nur in Suchtreffern zu einer ResearchGate-Seite und ist NICHT VERIFIZIERT. Die Projektseite war nicht erreichbar. Eine deutsche Fassung ist NICHT VERIFIZIERT.

Belege: https://pmc.ncbi.nlm.nih.gov/articles/PMC8225834/ [VT, CC BY] · Byrne et al. [OA] · Coffield [VT]

### 2.8 MSLQ (Pintrich et al.)

Das Motivated Strategies for Learning Questionnaire entstand ab 1986 an der University of Michigan mit Mitteln des US-Bildungsministeriums (OERI). Es hat 81 Items auf siebenstufiger Skala: 31 zur Motivation, 31 zu kognitiven und metakognitiven Strategien, 19 zum Ressourcenmanagement. Das Manual betont, dass die 15 Skalen einzeln oder zusammen eingesetzt werden können, dass es keine Normen gibt und dass die Antworten kursbezogen zu verstehen sind. Das vollständige Ausfüllen dauert 20 bis 30 Minuten.

Pintrich et al. (1993) berichten robuste Skalenreliabilitäten, eine gute Faktorstruktur und eine vernünftige Vorhersage der Kursleistung. Die Metaanalyse von Credé & Phillips (2011; 67 Stichproben, 19 900 Studierende) zeigt, dass die Skalen sehr unterschiedlich taugen: von ρ = .40 für Anstrengungsregulation bis ρ = .05 für Hilfesuchen. De Araujo et al. (2023) fanden nur mit einem bestimmten Schätzverfahren eine annehmbare Modellpassung und für drei Skalen (Elaboration, intrinsische Zielorientierung, metakognitive Selbstregulation) unzureichende Reliabilität.

EdInstruments (Brown University) führt das MSLQ als Open Access mit α zwischen .52 und .93. Das Manual liegt frei bei ERIC, enthält aber keinen Rechtevermerk. Die verbreitete Aussage, das MSLQ sei gemeinfrei und ohne Erlaubnis nutzbar, stammt laut Suchtreffern von der ResearchGate-Seite des Manuals und ist NICHT VERIFIZIERT. Das Instrument ist englisch; eine eigene Übersetzung wäre eine Adaption ohne geprüfte Messgüte. Eine autorisierte deutsche Fassung ist NICHT VERIFIZIERT.

Belege: https://files.eric.ed.gov/fulltext/ED338122.pdf [VT] · https://edinstruments.org/instruments/motivated-strategies-learning-questionnaire-mslq · Pintrich et al. 1993 [OA] · Credé & Phillips [ERIC, EJ931876] · Duncan & McKeachie [ERIC, EJ724932] · https://pmc.ncbi.nlm.nih.gov/articles/PMC10704012/ [VT]

### 2.9 LIST und LIST-K

Wild & Schiefele (1994) entwickelten das Inventar „Lernstrategien im Studium" auf der Grundlage des MSLQ und eines weiteren englischsprachigen Verfahrens. Es unterscheidet kognitive Strategien (Organisation, Zusammenhänge, kritisches Prüfen, Wiederholen), metakognitive Strategien (Planung, Überwachung, Regulation) und ressourcenbezogene Strategien (Anstrengung, Konzentration, Zeitmanagement, Lernumgebung, Lernen mit anderen, Literatur) auf 11 Skalen mit 77 Items. Die Erstprüfung an 310 Studierenden ergab sinnvolle Faktorstrukturen und zufriedenstellende Reliabilität. Boerner et al. (2005, N = 577) bestätigten die Dreiteilung erstmals faktorenanalytisch, bemängelten die bis dahin schwache Konsistenz der metakognitiven Skala und fanden nur geringe positive Zusammenhänge mit dem Studienerfolg.

Klingsieck (2018) kürzte das Inventar auf 39 Items in 13 Subskalen. Drei Studien zeigen stabile psychometrische Eigenschaften; konfirmatorische Faktorenanalysen stützen die Auswertung auf Subskalenebene, die Reliabilitäten sind akzeptabel bis sehr gut, und die Kurzform ist mindestens so reliabel wie das Original. Gedacht ist sie für zeitsparende Erhebungen. Antwortformat und Bearbeitungszeit sind NICHT VERIFIZIERT.

Eine offene Lizenz gibt es für keine der beiden Fassungen. Der Hochschulschriftenserver der Universität Potsdam stellt den Originalartikel von 1994 als PDF bereit und weist ihn als urheberrechtlich geschützt ohne öffentliche Lizenz aus. Der LIST-K-Artikel ist bei Hogrefe nicht frei zugänglich; Crossref und OpenAlex verzeichnen keine Lizenz. Im Open Test Archive des ZPID (264 Verfahren, Startseitenliste am 19.09.2026 durchsucht) ist keine der beiden Fassungen gelistet. Beide Instrumente erfassen Strategien, keine Typen; eine Passungsempfehlung erheben die geöffneten Quellen nicht.

Belege: https://publishup.uni-potsdam.de/frontdoor/index/index/docId/3182 · https://kops.uni-konstanz.de/server/api/core/bitstreams/9ce8cebd-acec-4b29-bc70-9691ae2ddf5a/content [VT] · Klingsieck [OA, Crossref-Abstract] · https://testarchiv.eu/ · https://www.testarchiv.eu/de/nutzungsbedingungen

### 2.10 Rechtlicher Rahmen in Deutschland (Wortlaut, keine Beratung)

- § 53 Abs. 1 UrhG erlaubt natürlichen Personen einzelne Vervielfältigungen zum privaten Gebrauch ohne Erwerbszweck, sofern die Vorlage nicht offensichtlich rechtswidrig ist. Nach Abs. 6 dürfen solche Kopien weder verbreitet noch öffentlich wiedergegeben werden. https://www.gesetze-im-internet.de/urhg/__53.html
- § 19a UrhG behält dem Urheber das Recht vor, ein Werk so ins Netz zu stellen, dass es von Orten und zu Zeiten eigener Wahl abrufbar ist. https://www.gesetze-im-internet.de/urhg/__19a.html
- § 23 UrhG verlangt für die Veröffentlichung oder Verwertung von Bearbeitungen, etwa Übersetzungen, die Zustimmung des Urhebers. Wahrt ein neues Werk hinreichenden Abstand, liegt keine Bearbeitung vor. https://www.gesetze-im-internet.de/urhg/__23.html

Folgerung für die App: Wer Items eines geschützten Fragebogens nur lokal und nur für sich nutzt, bewegt sich im Bereich des privaten Gebrauchs. Sobald die App öffentlich erreichbar ist, greift diese Schranke nicht mehr, auch wenn nichts verkauft wird. Vertragliche Verbote wie bei VARK gelten unabhängig davon. Ob einzelne Items die für Urheberrechtsschutz nötige Schöpfungshöhe erreichen, wurde nicht geprüft; die Rechteinhaber beanspruchen Schutz jedenfalls ausdrücklich.

## 3. Teil B — Die Passungsfrage

Die Passungshypothese (meshing hypothesis) besagt, man lerne besser, wenn die Darbietung zum eigenen Lernstil passt. Um sie zu belegen, braucht es ein bestimmtes Versuchsdesign: Lernstil vorab erheben, zufällig auf Darbietungsformen verteilen, alle gleich prüfen und eine Kreuzwechselwirkung nachweisen.

### 3.1 Geprüfte Kernquellen

- **Pashler, McDaniel, Rohrer & Bjork (2008)** [EPMC]. Auftragsgutachten zur Frage, ob lernstilbasierter Unterricht wissenschaftlich gestützt ist. Menschen äußern Vorlieben und unterscheiden sich in Fähigkeiten; für die geforderte Wechselwirkung fanden die Autoren aber praktisch keinen Beleg, und mehrere methodisch geeignete Studien widersprachen der Hypothese. Sie halten fest, dass viele Varianten schlicht nie sauber getestet wurden.
- **Willingham, Hughes & Dobolyi (2015)** [OA]. Überblick über den wissenschaftlichen Status von Lernstiltheorien. Die Theorien gelten verbreitet als zutreffend, die wissenschaftliche Stützung fehlt; Lehrende sollten ihre Zeit auf besser belegte Ansätze verwenden.
- **Husmann & O'Loughlin (2019)** [EPMC]. 426 Anatomiestudierende füllten VARK und eine Befragung zu Lernstrategien aus. Die meisten lernten nicht so, wie ihr VARK-Ergebnis nahelegte; weder die VARK-Werte noch die Übereinstimmung von Strategie und VARK-Typ hingen mit der Kursnote zusammen. Einzelne Strategien taten es, unabhängig vom Typ.
- **Rogowsky, Calhoun & Tallal (2015)** [OA]. Erste Studie im von Pashler geforderten Design, mit Erwachsenen: auditive oder visuelle Vorliebe erhoben, zufällig Hörbuch oder E-Text zugeteilt, sofort und nach zwei Wochen geprüft. Kein signifikanter Zusammenhang zwischen Vorliebe und Lernerfolg je Darbietungsform.
- **Rogowsky, Calhoun & Tallal (2020)** [EPMC]. Gleiches Design mit Fünftklässlern. Wieder kein Passungseffekt; Kinder mit visueller Vorliebe schnitten beim Hören wie beim Lesen besser ab. Die Autorinnen halten lernstilbasierte Anpassung für einen möglichen Bärendienst.
- **Cuevas (2015)** [OA]. Sichtung der Forschung seit 2009. Die methodisch saubereren Studien widerlegen die Hypothese eher; zwischen breiter Akzeptanz in der Praxis und der Befundlage besteht eine deutliche Kluft.
- **Coffield, Moseley, Hall & Ecclestone (2004)** [VT]. LSRC-Bericht, ISBN 1 85338 918 8, kein DOI. Aus 71 gefundenen Modellen wurden 13 genau geprüft, gemessen an interner Konsistenz, Retest-Reliabilität, Konstrukt- und Vorhersagevalidität in unabhängigen Studien. Nur Allinson & Hayes erfüllten alle vier Kriterien, Vermunt und Apter drei, Entwistle, Herrmann und Myers-Briggs zwei, Kolb, Honey & Mumford, Dunn & Dunn und Gregorc eines. Zur Passung nennen die Autoren die Befunde bestenfalls uneinheitlich und fanden keinen harten Beleg, dass sie die Leistung nennenswert verbessert. Geöffnet wurde eine gespiegelte Kopie, die LSRC-Seite existiert nicht mehr: https://www.leerbeleving.nl/wp-content/uploads/2011/09/learning-styles.pdf · Katalogeintrag: https://research.birmingham.ac.uk/en/publications/learning-styles-in-post-16-education-a-systematic-review

### 3.2 Weitere Synthesen

- **Kavale & Forness (1987)** [OA]. Metaanalyse von 39 Studien zu modalitätsbezogenem Testen und Unterrichten: kein Nutzen passender Unterweisung, Modalitätsgruppen überlappen stark.
- **Aslaksen & Lorås (2018)** [EPMC]. Kurzübersicht nur über Studien mit strengem Design: Effektstärken sehr klein und nicht signifikant.
- **Massa & Mayer (2006)** [ERIC, EJ756109]. Drei Experimente mit 14 Maßen der Verbalisierer-Visualisierer-Dimension: fast keine signifikanten Wechselwirkungen mit der Art der Hilfeseiten.
- **Knoll, Otani, Skeel & Van Horn (2017)** [EPMC]. Die verbale oder visuelle Vorliebe hing mit den Urteilen über das eigene Lernen zusammen, nicht aber mit der Erinnerungsleistung oder der Genauigkeit dieser Urteile. Das erklärt, warum sich Lernstile richtig anfühlen.
- **Hattie & O'Leary (2025)** [OA]. Auswertung von 17 Metaanalysen: Studien, die die Passung testen, ergeben d = .04. Korrelationsstudien kommen im Mittel auf r = .24, vermengen aber Lernstile mit Lernstrategien. Empfehlung: weg von der Passung, hin zum Vermitteln anpassungsfähiger Strategien.
- **Newton & Salvi (2020)** [OA]. 37 Studien, 15 405 Lehrende aus 18 Ländern: gewichtet 89,1 % glauben an den Nutzen der Passung, ohne Rückgang über die Jahre.

### 3.3 Gegenbefunde und ihre Einordnung

- **Lovelace (2005)** [OA]. Metaanalyse zum Dunn-&-Dunn-Modell mit 76 Studien und 7196 Teilnehmenden; berichtet mittlere bis große Effekte passender Unterweisung auf Leistung und Einstellung. **Kavale & LeFever (2007)** [OA] halten das für nicht tragfähig: 96 % der Studien waren Dissertationen, 70 % davon aus dem Umfeld der Modellurheber, dazu Probleme bei Effektstärkendeutung und fehlenden Angaben. Gleiches gilt für die ältere Metaanalyse von Dunn et al. (1995) [nur CR]. Einordnung: schwach wegen Stichprobenverzerrung und Interessenbindung.
- **Clinton-Lisell & Litzinger (2024)** [EPMC]. Metaanalyse von 21 Studien, 101 Effektstärken, 1712 Personen: insgesamt ein Vorteil passender Unterweisung von g = 0,31 (95 %-KI 0,05 bis 0,57). Eine echte Kreuzwechselwirkung für mindestens zwei Stile zeigte sich aber nur bei 26 % der Ergebnismaße. Die Autorinnen bewerten den Nutzen wegen geringer Studienqualität und hoher Kosten selbst als zu klein und zu selten für eine breite Einführung. Einordnung: der ernsthafteste Gegenbefund, aber ausdrücklich kein Freibrief.
- **Ford & Chen (2001)** [OA]. 73 Postgraduierte lernten HTML mit Material, das erst den Überblick oder erst die Tiefe bot, passend oder unpassend zu ihrem kognitiven Stil (Feldabhängigkeit). Bei passender Bedingung fiel der Wissenstest signifikant besser aus, vor allem bei Männern; der praktische Test zeigte keinen Passungseffekt. Einordnung: kleine Einzelstudie, kognitiver Stil statt Selbstauskunft, für die Frage „erst Überblick oder erst Detail" thematisch einschlägig.
- **Felder & Spurlin (2005)** [VT] erwähnen, Studien hätten bei Passung von Lehr- und Lernstil mehr Lernerfolg gezeigt, und argumentieren trotzdem gegen ausschließlich passende Lehre. Coffield et al. zitieren eine Übersicht, die neun Studien für und neun gegen die Passung zählt.

### 3.4 Stand

Vorlieben gibt es, und sie beeinflussen, wie gut sich Lernen anfühlt. Dass passende Darbietung das Lernergebnis verbessert, ist nicht belegt: Die streng angelegten Studien finden nichts, die Gesamtschau über Metaanalysen landet nahe null, und die positiven Befunde stammen überwiegend aus methodisch schwachen oder interessengebundenen Quellen. Ein Onboarding darf deshalb keine Passung versprechen.

## 4. Teil C — Was ein Onboarding stattdessen belastbar messen kann

### 4.1 Vorwissen und Expertise-Umkehr-Effekt

Kalyuga, Ayres, Chandler & Sweller (2003) [OA] zeigen, dass Lehrtechniken, die Anfängern helfen, bei Fortgeschrittenen wirkungslos werden oder schaden. Kalyuga (2007) [S2] ordnet die Befunde in die ältere Forschung zu Wechselwirkungen zwischen Merkmal und Methode ein und bespricht die Folgen für lernerangepasste Lehrsysteme samt ersten adaptiven Lernumgebungen. Die Metaanalyse von Simonsmeier et al. (2022) [OA] mahnt zur Genauigkeit: Vortest und Nachtest korrelieren hoch (r = .53), Vorwissen sagt den Zuwachs aber im Mittel nicht vorher (r = −.06) bei enormer Streuung. Vorwissen bestimmt also, wo jemand landet und welche Hilfen sinnvoll sind, nicht pauschal, wie viel er dazulernt.

**Onboarding:** kurzer Vortest am tatsächlichen Stoff statt Selbsteinschätzung. Das Ergebnis steuert das Maß an Anleitung: ausgearbeitete Beispiele für Einsteiger, mehr eigenes Problemlösen für Kundige.

### 4.2 Testing-Effekt

Roediger & Karpicke (2006) [EPMC]: Nach fünf Minuten lag wiederholtes Lesen vorn, nach zwei Tagen und einer Woche deutlich das wiederholte Abrufen, obwohl die Lesegruppe sich sicherer fühlte. Rowland (2014) [EPMC] bestätigt den Effekt metaanalytisch, stärker bei freiem Abruf als beim Wiedererkennen. Adesope et al. (2017) [OA]: Übungstests schlagen erneutes Lernen und alle anderen Vergleichsbedingungen.

**Onboarding:** kein Messgegenstand, sondern Standardeinstellung. Abfragen statt Wiederlesen, und dem Nutzer sagen, dass sich das schwerer anfühlt.

### 4.3 Verteiltes Lernen

Cepeda et al. (2006) [EPMC]: Metaanalyse über 317 Experimente; der günstigste Abstand zwischen Lerneinheiten wächst mit dem Behaltensintervall. Cepeda et al. (2008) [EPMC], über 1350 Personen: Der optimale Abstand beträgt etwa 20 bis 40 % bei einer Woche Behaltensdauer und fällt auf 5 bis 10 % bei einem Jahr.

**Onboarding:** Zieltermin und verfügbare Tage pro Woche abfragen; daraus den Wiederholungsplan ableiten.

### 4.4 Verschachteltes Üben (Interleaving)

Rohrer & Taylor (2007) [ERIC, EJ786797]: gemischte Matheaufgaben führten nach einer Woche zu weit besserer Leistung als nach Typ geblockte. Kornell & Bjork (2008) [EPMC]: Malstile wurden verschachtelt besser gelernt, obwohl die Teilnehmenden das Blocken für wirksamer hielten. Brunmair & Richter (2019) [EPMC]: im Mittel g = 0,42, am stärksten bei Bildmaterial (0,67), klein bei Mathematik (0,34), uneindeutig bei Sachtexten, bei Wörtern umgekehrt (−0,39).

**Onboarding:** nichts zu messen. Verschachteln dort, wo ähnliche Kategorien unterschieden werden müssen; bei Texten und Vokabeln nicht erzwingen.

### 4.5 Metakognitive Kalibrierung

Dunlosky & Rawson (2012) [ERIC, EJ964388]: Wer die Richtigkeit eigener Antworten genauer einschätzte, behielt nach zwei Tagen mehr, unabhängig von Rückmeldung, Aufwand und Durchgängen. Hacker et al. (2000) [ERIC, EJ619366]: Leistungsstarke sagten ihre Prüfungsergebnisse treffend voraus, die Schwächsten überschätzten sich grob. Koriat & Bjork (2005) [EPMC] erklären die Kompetenzillusion damit, dass beim Lernen Information vorliegt, die in der Prüfung fehlt. Bjork, Dunlosky & Kornell (2013) [EPMC]: Menschen haben oft ein fehlerhaftes Bild davon, wie sie lernen.

**Onboarding:** Das ist der ergiebigste Messpunkt. Im Vortest vor jeder Antwort eine Sicherheitsangabe verlangen und mit der Trefferquote vergleichen. Das Ergebnis ist ein Verhaltensmaß, keine Selbstauskunft, und lässt sich im Verlauf nachführen.

### 4.6 Zielsetzung und selbstreguliertes Lernen

Locke & Latham (2002) [PM, 12237980] fassen 35 Jahre Zielsetzungsforschung zusammen. Sitzmann & Ely (2011) [EPMC], 430 Studien mit 90 380 Personen: Zielniveau, Ausdauer, Anstrengung und Selbstwirksamkeit wirken am stärksten und erklären zusammen 17 % der Lernvarianz; Planung, Überwachung, Hilfesuchen und Emotionskontrolle zeigten keinen signifikanten Zusammenhang. Morisano et al. (2010) [EPMC]: Ein schriftliches Online-Zielsetzungsprogramm verbesserte bei 85 leistungsschwachen Studierenden nach vier Monaten die Noten gegenüber der Kontrollgruppe. Richardson, Abraham & Bond (2012) [EPMC]: Unter 50 Korrelaten der Studiennote erreichen Notenziel und Anstrengungsregulation mittlere Stärke, leistungsbezogene Selbstwirksamkeit die höchste.

**Onboarding:** ein konkretes, anspruchsvolles Ziel mit Termin formulieren lassen und Anstrengungsregulation als Strategiemerkmal erheben.

### 4.7 Die 85-Prozent-Regel

Wilson, Shenhav, Straccia & Cohen (2019) [EPMC, VT: https://pmc.ncbi.nlm.nih.gov/articles/PMC6831579/] leiten für binäre Klassifikationsaufgaben und Lernverfahren mit stochastischem Gradientenabstieg eine optimale Fehlerquote von rund 15,87 % her. Geprüft wurde an einem Perzeptron, einem zweischichtigen neuronalen Netz und einem Rechenmodell des Wahrnehmungslernens bei Affen. Menschen nahmen nicht teil. Bei anderen Rauschannahmen verschiebt sich das Optimum auf 82 % oder 75 %.

**Onboarding:** als Faustregel für die Schwierigkeitssteuerung brauchbar (Trefferquote grob zwischen 75 und 90 % halten), nicht als belegtes Gesetz menschlichen Lernens ausgeben.

### 4.8 Kern zuerst, Details später

- **Advance Organizer.** Ausubel (1960) [OA] prüfte, ob vorangestellte übergeordnete Begriffe das Lernen unvertrauten Materials erleichtern. Barnes & Clawson (1975) [OA] verneinten nach 32 Studien einen Nutzen; Mayer (1979) [OA] wies ihnen Schwächen nach und zeigte Wirkung unter geeigneten Bedingungen. Die Metaanalysen von Luiten et al. (1980, 135 Studien) [OA] und Stone (1983, 112 Studien) [OA, ERIC ED220476] finden einen förderlichen Effekt auf Lernen und Behalten. Stone merkt an, dass die wirksamsten Organizer nicht Ausubels Vorgaben entsprachen: konkrete schnitten besser ab als abstrakte, und Lernende mit wenig Vorwissen profitierten nicht besonders.
- **Vortraining.** Mayer, Mathias & Wetzell (2002) [PM, 12240927]: Wer vor einer Erklär-Animation die Bauteile und ihre Zustände kennenlernte, schnitt in allen drei Experimenten beim Transfer besser ab.
- **Elaboration Theory.** Reigeluth, Merrill, Wilson & Spiller (1980) [nur CR] schlagen eine Abfolge vom Allgemeinen zum Detaillierten vor. Wilson & Cole (1992) [ERIC, EJ462854] kritisieren das Modell im Licht neuerer Kognitionsforschung und empfehlen, es weniger prozedural zu fassen und die Abfolge am Verständnis der Lernenden auszurichten. Eine Metaanalyse zur Wirksamkeit wurde nicht gefunden.

Einordnung: Für „Überblick zuerst" gibt es einen kleinen bis mittleren, an Bedingungen geknüpften Beleg. Die Elaboration Theory ist ein Gestaltungsmodell mit dünner empirischer Basis. Als Standardabfolge vertretbar, als Wirkversprechen nicht.

### 4.9 Die Lernpyramide

Die Grafik mit festen Behaltensquoten (10 % Lesen bis 90 % Tun) hat keine empirische Grundlage.

- **Letrud (2012)** [ERIC, EJ996977; DOI nicht verifiziert]. Historische und methodische Kritik an der Pyramide des NTL Institute mit der Aufforderung, das Modell zurückzuziehen.
- **Subramony, Molenda, Betrus & Thalheimer (2014)** [ERIC, EJ1057239; DOI nicht verifiziert]. Vier Befunde: Die Zahlen sind keine Forschungsergebnisse und kursieren in Dutzenden Varianten; Dales Erfahrungskegel war beschreibend gemeint; die Verbindung beider ist unbegründet; alle angeblichen Ursprungsquellen erwiesen sich als falsch.
- **Letrud & Hernes (2018)** [OA]. Varianten der Pyramide kursieren seit über 160 Jahren und stammen nicht aus empirischer Forschung. **Letrud & Hernes (2016)** [OA] belegen ihre weite Verbreitung in Fachzeitschriften.

## 5. Teil D — Empfehlung

### 5.1 Befund

Kein Lernstil-Fragebogen erfüllt alle drei Bedingungen (rechtlich einbaubar, unter fünf Minuten, dokumentierte Messgüte):

- VARK wäre kurz genug, verbietet aber den Einbau und den Nachbau ausdrücklich.
- Kolb und Honey & Mumford sind Kaufprodukte mit schwacher unabhängiger Messgüte.
- Der Felder-ILS ist zur Nutzung frei, nicht zum Nachbau, hat 44 Items und mäßige Reliabilität.
- Vermunt und ASSIST sind zu lang, ihre Bedingungen unbelegt.
- Der R-SPQ-2F wäre kurz, bildet aber den Ansatz in einem bestimmten Kurs ab und ist rechtlich nur indirekt geklärt.

### 5.2 Empfohlene Instrumente

**Erste Wahl: LIST-K (Klingsieck 2018), mit Erlaubnis.** Deutschsprachig, 39 Items, in drei Studien geprüft, Auswertung auf Subskalenebene ausdrücklich gestützt. Für das Fünf-Minuten-Ziel genügt eine Auswahl von fünf bis sechs Subskalen mit je drei Items (rund 15 bis 18 Items, etwa drei Minuten, Schätzung). Naheliegend sind Anstrengung, Zeitmanagement, Konzentration, die metakognitiven Subskalen und Wiederholen oder Organisation, weil Anstrengungsregulation in den Metaanalysen am stärksten mit Leistung zusammenhängt. Die veröffentlichte Reliabilität gilt je Subskala nur, wenn deren Items unverändert bleiben. Rechtlich: Für eine nur lokal und privat genutzte App liegt das im Bereich des privaten Gebrauchs. Ist die App öffentlich erreichbar, sollte vorher die Erlaubnis der Autorin (Universität Paderborn) und gegebenenfalls des Verlags Hogrefe eingeholt werden. Eine Freigabe liegt bisher nicht vor.

**Zweite Wahl: einzelne MSLQ-Skalen.** Das Manual sieht den Einzeleinsatz ausdrücklich vor, und es ist frei bei ERIC verfügbar. Dagegen sprechen die englische Sprache, die ungeprüfte Messgüte jeder eigenen Übersetzung und der am Primärtext nicht belegte Rechtsstatus. Sinnvoll nur, wenn die LIST-K-Erlaubnis ausbleibt und Englisch kein Hindernis ist.

**Rückfallebene: eigene, neu formulierte Items.** Entlang der veröffentlichten Struktur (kognitiv, metakognitiv, ressourcenbezogen) frei formuliert, ohne Anlehnung an den Wortlaut bestehender Items. Konstrukte sind nicht schutzfähig, und § 23 UrhG nimmt Werke mit hinreichendem Abstand aus. Der Preis: Die Messgüte ist dann ungeprüft. Das gehört in der App offen gesagt, etwa als Hinweis, dass es sich um eine Selbstauskunft ohne geprüfte Skala handelt. Die Verhaltensmaße aus Teil C tragen in diesem Fall die Hauptlast.

### 5.3 Saubere Trennung

**(i) Vorliebe: erheben und für Abwechslung und Motivation nutzen.** Wenige selbst formulierte Fragen: bevorzugtes Format (Text, Audio, Grafik, Beispiel), Sitzungslänge, Tageszeit, erst Überblick oder erst Beispiel. Verwendung nur als Voreinstellung und zur Abwechslung. In der App als Vorliebe benennen, nie als Lerntyp, und nie Inhalte deswegen vorenthalten. Begründung: Vorlieben sind real und prägen das Lerngefühl (Pashler et al. 2008; Knoll et al. 2017), nicht das Ergebnis.

**(ii) Strategie- und Selbststeuerungsprofil: erheben und fürs Coaching nutzen.** LIST-K-Auswahl oder eigene Items, ergänzt um Verhaltensmaße: Vortest am Stoff, Sicherheitsangaben zur Kalibrierung, ein konkretes Ziel mit Termin, verfügbare Lerntage. Rückmeldung als veränderbare Gewohnheit, mit je einem konkreten Vorschlag. Das Profil im Verlauf wiederholen, denn Strategien ändern sich mit Kurs und Übung.

**(iii) Nicht versprechen:**
- dass man besser lernt, wenn der Stoff zum Lernstil passt;
- dass ein Fragebogen einen festen Lerntyp diagnostiziert oder Fähigkeiten anzeigt;
- feste Behaltensquoten nach Art der Lernpyramide;
- die 85-Prozent-Regel als Gesetz menschlichen Lernens;
- dass Selbstauskünfte das tatsächliche Lernverhalten abbilden;
- dass „Überblick zuerst" immer wirkt.

### 5.4 Vorschlag für den Ablauf (unter fünf Minuten)

1. Ziel und Termin, Lerntage pro Woche (30 Sekunden).
2. Vortest mit 6 bis 8 Fragen am Stoff, jeweils mit Sicherheitsangabe (2 Minuten). Ergibt Vorwissen und Kalibrierung.
3. Strategieprofil mit 15 bis 18 Items (2 Minuten).
4. Drei Vorliebenfragen (20 Sekunden).

Die Zeiten sind Schätzungen.

## 6. Verifiziert über Crossref

Angaben wie von Crossref geliefert. „online/print" nennt beide Daten, wo Crossref sie trennt.

### Teil A
1. Fleming, Mills — Not Another Inventory, Rather a Catalyst for Reflection — To Improve the Academy — 1992 — 11(1), 137–155 — 10.1002/j.2334-4822.1992.tb00213.x (zweiter Eintrag: 10.3998/tia.17063888.0011.014)
2. Leite, Svinicki, Shi — Attempted Validation of the Scores of the VARK: Learning Styles Inventory With Multitrait–Multimethod Confirmatory Factor Analysis Models — Educational and Psychological Measurement — online 2009, print 2010 — 70(2), 323–339 — 10.1177/0013164409344507
3. Kolb, Kolb — Learning Styles and Learning Spaces: Enhancing Experiential Learning in Higher Education — Academy of Management Learning & Education — 2005 — 4(2), 193–212 — 10.5465/amle.2005.17268566 [nur CR]
4. Manolis, Burns, Assudani, Chinta — Assessing experiential learning styles: A methodological reconstruction and validation of the Kolb Learning Style Inventory — Learning and Individual Differences — 2013 — 23, 44–52 — 10.1016/j.lindif.2012.10.009
5. Henson, Hwang — Variability and Prediction of Measurement Error in Kolb's Learning Style Inventory Scores a Reliability Generalization Study — Educational and Psychological Measurement — 2002 — 62(4), 712–727 — 10.1177/0013164402062004011
6. Duff, Duffy — Psychometric properties of Honey & Mumford's Learning Styles Questionnaire (LSQ) — Personality and Individual Differences — 2002 — 33(1), 147–163 — 10.1016/s0191-8869(01)00141-6
7. Cockerton, Naz, Sheppard — Factorial Validity and Internal Reliability of Honey and Mumford's Learning Styles Questionnaire — Psychological Reports — 2002 — 91(2), 503–519 — 10.2466/pr0.2002.91.2.503
8. Swailes, Senior — The Dimensionality of Honey and Mumford's Learning Styles Questionnaire — International Journal of Selection and Assessment — 1999 — 7(1), 1–11 — 10.1111/1468-2389.00099 [nur CR]
9. Litzinger, Lee, Wise, Felder — A Psychometric Study of the Index of Learning Styles© — Journal of Engineering Education — 2007 — 96(4), 309–319 — 10.1002/j.2168-9830.2007.tb00941.x
10. Zywno — A Contribution To Validation Of Score Meaning For Felder Soloman's Index Of Learning Styles — 2003 Annual Conference Proceedings (ASEE) — 10.18260/1-2--12424 [nur CR]
11. Hosford, Siders — Felder-Soloman's Index of Learning Styles: Internal Consistency, Temporal Stability, and Factor Structure — Teaching and Learning in Medicine — 2010 — 22(4), 298–303 — 10.1080/10401334.2010.512832
12. Vermunt — The regulation of constructive learning processes — British Journal of Educational Psychology — 1998 — 68(2), 149–171 — 10.1111/j.2044-8279.1998.tb01281.x
13. Vermunt, Vermetten — Patterns in Student Learning: Relationships Between Learning Strategies, Conceptions of Learning, and Learning Orientations — Educational Psychology Review — 2004 — 16(4), 359–384 — 10.1007/s10648-004-0005-y [nur CR]
14. Vermunt, Donche — A Learning Patterns Perspective on Student Learning in Higher Education: State of the Art and Moving Forward — Educational Psychology Review — 2017 — 29(2), 269–299 — 10.1007/s10648-017-9414-6
15. Boyle, Duffy, Dunleavy — Learning styles and academic outcome: The validity and utility of Vermunt's Inventory of Learning Styles in a British higher education setting — British Journal of Educational Psychology — 2003 — 73(2), 267–290 — 10.1348/00070990360626976
16. Biggs, Kember, Leung — The revised two‐factor Study Process Questionnaire: R‐SPQ‐2F — British Journal of Educational Psychology — 2001 — 71(1), 133–149 — 10.1348/000709901158433
17. Justicia, Pichardo, Cano, Berbén, De la Fuente — The Revised Two-Factor Study Process Questionnaire (R-SPQ-2F): Exploratory and confirmatory factor analyses at item level — European Journal of Psychology of Education — 2008 — 23(3), 355–372 — 10.1007/bf03173004 [nur CR]
18. Stes, De Maeyer, Van Petegem — Examining the Cross-Cultural Sensitivity of the Revised Two-Factor Study Process Questionnaire (R-SPQ-2F) and Validation of a Dutch Version — PLoS ONE — 2013 — 8(1), e54099 — 10.1371/journal.pone.0054099
19. Johnson, Gallagher, Vagnozzi — Validity concerns with the Revised Study Process Questionnaire (R-SPQ-2F) in undergraduate anatomy & physiology students — PLOS ONE — 2021 — 16(4), e0250600 — 10.1371/journal.pone.0250600
20. Byrne, Flood, Willis — Validation of the approaches and study skills inventory for students (assist) using accounting students in the USA and Ireland: a research note — Accounting Education — 2004 — 13(4), 449–459 — 10.1080/0963928042000306792
21. Dedos, Fouskakis — Dataset and validation of the approaches to study skills inventory for students — Scientific Data — 2021 — 8(1) — 10.1038/s41597-021-00943-6
22. Entwistle, Tait, McCune — Patterns of response to an approaches to studying inventory across contrasting groups and contexts — European Journal of Psychology of Education — 2000 — 15(1), 33–48 — 10.1007/bf03173165 [nur CR]
23. Pintrich, Smith, Garcia, McKeachie — Reliability and Predictive Validity of the Motivated Strategies for Learning Questionnaire (Mslq) — Educational and Psychological Measurement — 1993 — 53(3), 801–813 — 10.1177/0013164493053003024
24. Credé, Phillips — A meta-analytic review of the Motivated Strategies for Learning Questionnaire — Learning and Individual Differences — 2011 — 21(4), 337–346 — 10.1016/j.lindif.2011.03.002
25. Duncan, McKeachie — The Making of the Motivated Strategies for Learning Questionnaire — Educational Psychologist — 2005 — 40(2), 117–128 — 10.1207/s15326985ep4002_6
26. de Araujo, Gomes, Jelihovschi — The factor structure of the Motivated Strategies for Learning Questionnaire (MSLQ): new methodological approaches and evidence — Psicologia: Reflexão e Crítica — 2023 — 36(1) — 10.1186/s41155-023-00280-0
27. Klingsieck — Kurz und knapp – die Kurzskala des Fragebogens „Lernstrategien im Studium" (LIST) — Zeitschrift für Pädagogische Psychologie — 2018 — 32(4), 249–259 — 10.1024/1010-0652/a000230
28. Boerner, Seeber, Keller, Beinborn — Lernstrategien und Lernerfolg im Studium: — Zeitschrift für Entwicklungspsychologie und Pädagogische Psychologie — 2005 — 37(1), 17–26 — 10.1026/0049-8637.37.1.17
29. Richardson, Abraham, Bond — Psychological correlates of university students' academic performance: A systematic review and meta-analysis. — Psychological Bulletin — 2012 — 138(2), 353–387 — 10.1037/a0026838

### Teil B
30. Pashler, McDaniel, Rohrer, Bjork — Learning Styles: Concepts and Evidence — Psychological Science in the Public Interest — 2008 (Dezember) — 9(3), 105–119 — 10.1111/j.1539-6053.2009.01038.x
31. Willingham, Hughes, Dobolyi — The Scientific Status of Learning Styles Theories — Teaching of Psychology — 2015 — 42(3), 266–271 — 10.1177/0098628315589505
32. Husmann, O'Loughlin — Another Nail in the Coffin for Learning Styles? Disparities among Undergraduate Anatomy Students' Study Strategies, Class Performance, and Reported VARK Learning Styles — Anatomical Sciences Education — online 2018, print 2019 — 12(1), 6–19 — 10.1002/ase.1777
33. Rogowsky, Calhoun, Tallal — Matching learning style to instructional method: Effects on comprehension. — Journal of Educational Psychology — 2015 — 107(1), 64–78 — 10.1037/a0037478
34. Rogowsky, Calhoun, Tallal — Providing Instruction Based on Students' Learning Style Preferences Does Not Improve Learning — Frontiers in Psychology — 2020 — 11 — 10.3389/fpsyg.2020.00164
35. Cuevas — Is learning styles-based instruction effective? A comprehensive analysis of recent research on learning styles — Theory and Research in Education — 2015 — 13(3), 308–333 — 10.1177/1477878515606621
36. Aslaksen, Lorås — The Modality-Specific Learning Style Hypothesis: A Mini-Review — Frontiers in Psychology — 2018 — 9 — 10.3389/fpsyg.2018.01538
37. Clinton-Lisell, Litzinger — Is it really a neuromyth? A meta-analysis of the learning styles matching hypothesis — Frontiers in Psychology — 2024 — 15 — 10.3389/fpsyg.2024.1428732
38. Hattie, O'Leary — Learning Styles, Preferences, or Strategies? An Explanation for the Resurgence of Styles Across Many Meta-analyses — Educational Psychology Review — 2025 — 37(2) — 10.1007/s10648-025-10002-w
39. Lovelace — Meta-Analysis of Experimental Research Based on the Dunn and Dunn Model — The Journal of Educational Research — 2005 — 98(3), 176–183 — 10.3200/joer.98.3.176-183
40. Kavale, LeFever — Dunn and Dunn Model of Learning-Style Preferences: Critique of Lovelace Meta-Analysis — The Journal of Educational Research — 2007 — 101(2), 94–97 — 10.3200/joer.101.2.94-98
41. Dunn, Griggs, Olson, Beasley, Gorman — A Meta-Analytic Validation of the Dunn and Dunn Model of Learning-Style Preferences — The Journal of Educational Research — 1995 — 88(6), 353–362 — 10.1080/00220671.1995.9941181 [nur CR]
42. Kavale, Forness — Substance over Style: Assessing the Efficacy of Modality Testing and Teaching — Exceptional Children — 1987 — 54(3), 228–239 — 10.1177/001440298705400305
43. Knoll, Otani, Skeel, Van Horn — Learning style, judgements of learning, and learning of verbal and visual information — British Journal of Psychology — online 2016, print 2017 — 108(3), 544–563 — 10.1111/bjop.12214
44. Massa, Mayer — Testing the ATI hypothesis: Should multimedia instruction accommodate verbalizer-visualizer cognitive style? — Learning and Individual Differences — 2006 — 16(4), 321–335 — 10.1016/j.lindif.2006.10.001
45. Ford, Chen — Matching/mismatching revisited: an empirical study of learning and teaching styles — British Journal of Educational Technology — 2001 — 32(1), 5–22 — 10.1111/1467-8535.00173
46. Newton, Salvi — How Common Is Belief in the Learning Styles Neuromyth, and Does It Matter? A Pragmatic Systematic Review — Frontiers in Education — 2020 — 5 — 10.3389/feduc.2020.602451
47. Kirschner — Stop propagating the learning styles myth — Computers & Education — 2017 — 106, 166–171 — 10.1016/j.compedu.2016.12.006 [nur CR]
48. An, Carr — Learning styles theory fails to explain learning and achievement: Recommendations for alternative approaches — Personality and Individual Differences — 2017 — 116, 410–416 — 10.1016/j.paid.2017.04.050 [nur CR]
49. Rohrer, Pashler — Learning styles: where's the evidence? — Medical Education — 2012 — 46(7), 634–635 — 10.1111/j.1365-2923.2012.04273.x [nur CR]

### Teil C
50. Kalyuga, Ayres, Chandler, Sweller — The Expertise Reversal Effect — Educational Psychologist — 2003 — 38(1), 23–31 — 10.1207/s15326985ep3801_4
51. Kalyuga — Expertise Reversal Effect and Its Implications for Learner-Tailored Instruction — Educational Psychology Review — 2007 — 19(4), 509–539 — 10.1007/s10648-007-9054-3
52. Simonsmeier, Flaig, Deiglmayr, Schalk, Schneider — Domain-specific prior knowledge and learning: A meta-analysis — Educational Psychologist — online 2021, print 2022 — 57(1), 31–54 — 10.1080/00461520.2021.1939700
53. Roediger, Karpicke — Test-Enhanced Learning: Taking Memory Tests Improves Long-Term Retention — Psychological Science — 2006 — 17(3), 249–255 — 10.1111/j.1467-9280.2006.01693.x
54. Roediger, Karpicke — The Power of Testing Memory: Basic Research and Implications for Educational Practice — Perspectives on Psychological Science — 2006 — 1(3), 181–210 — 10.1111/j.1745-6916.2006.00012.x [nur CR]
55. Rowland — The effect of testing versus restudy on retention: A meta-analytic review of the testing effect. — Psychological Bulletin — 2014 — 140(6), 1432–1463 — 10.1037/a0037559
56. Adesope, Trevisan, Sundararajan — Rethinking the Use of Tests: A Meta-Analysis of Practice Testing — Review of Educational Research — 2017 — 87(3), 659–701 — 10.3102/0034654316689306
57. Cepeda, Pashler, Vul, Wixted, Rohrer — Distributed practice in verbal recall tasks: A review and quantitative synthesis. — Psychological Bulletin — 2006 — 132(3), 354–380 — 10.1037/0033-2909.132.3.354
58. Cepeda, Vul, Rohrer, Wixted, Pashler — Spacing Effects in Learning: A Temporal Ridgeline of Optimal Retention — Psychological Science — 2008 — 19(11), 1095–1102 — 10.1111/j.1467-9280.2008.02209.x
59. Rohrer, Taylor — The shuffling of mathematics problems improves learning — Instructional Science — 2007 — 35(6), 481–498 — 10.1007/s11251-007-9015-8
60. Kornell, Bjork — Learning Concepts and Categories: Is Spacing the „Enemy of Induction"? — Psychological Science — 2008 — 19(6), 585–592 — 10.1111/j.1467-9280.2008.02127.x
61. Brunmair, Richter — Similarity matters: A meta-analysis of interleaved learning and its moderators. — Psychological Bulletin — 2019 — 145(11), 1029–1052 — 10.1037/bul0000209
62. Dunlosky, Rawson — Overconfidence produces underachievement: Inaccurate self evaluations undermine students' learning and retention — Learning and Instruction — 2012 — 22(4), 271–280 — 10.1016/j.learninstruc.2011.08.003
63. Koriat, Bjork — Illusions of Competence in Monitoring One's Knowledge During Study. — Journal of Experimental Psychology: Learning, Memory, and Cognition — 2005 — 31(2), 187–194 — 10.1037/0278-7393.31.2.187
64. Hacker, Bol, Horgan, Rakow — Test prediction and performance in a classroom context. — Journal of Educational Psychology — 2000 — 92(1), 160–170 — 10.1037/0022-0663.92.1.160
65. Kornell, Bjork — The promise and perils of self-regulated study — Psychonomic Bulletin & Review — 2007 — 14(2), 219–224 — 10.3758/bf03194055 [nur CR]
66. Bjork, Dunlosky, Kornell — Self-Regulated Learning: Beliefs, Techniques, and Illusions — Annual Review of Psychology — 2013 — 64(1), 417–444 — 10.1146/annurev-psych-113011-143823
67. Locke, Latham — Building a practically useful theory of goal setting and task motivation: A 35-year odyssey. — American Psychologist — 2002 — 57(9), 705–717 — 10.1037/0003-066x.57.9.705
68. Sitzmann, Ely — A meta-analysis of self-regulated learning in work-related training and educational attainment: What we know and where we need to go. — Psychological Bulletin — 2011 — 137(3), 421–442 — 10.1037/a0022777
69. Zimmerman — Becoming a Self-Regulated Learner: An Overview — Theory Into Practice — 2002 — 41(2), 64–70 — 10.1207/s15430421tip4102_2 [nur CR]
70. Morisano, Hirsh, Peterson, Pihl, Shore — Setting, elaborating, and reflecting on personal goals improves academic performance. — Journal of Applied Psychology — 2010 — 95(2), 255–264 — 10.1037/a0018478
71. Wilson, Shenhav, Straccia, Cohen — The Eighty Five Percent Rule for optimal learning — Nature Communications — 2019 — 10(1) — 10.1038/s41467-019-12552-4
72. Ausubel — The use of advance organizers in the learning and retention of meaningful verbal material. — Journal of Educational Psychology — 1960 — 51(5), 267–272 — 10.1037/h0046669
73. Luiten, Ames, Ackerson — A Meta-analysis of the Effects of Advance Organizers on Learning and Retention — American Educational Research Journal — 1980 — 17(2), 211–218 — 10.3102/00028312017002211
74. Mayer — Can Advance Organizers Influence Meaningful Learning? — Review of Educational Research — 1979 — 49(2), 371–383 — 10.3102/00346543049002371 (zweiter Eintrag: 10.2307/1169964)
75. Barnes, Clawson — Do Advance Organizers Facilitate Learning? Recommendations for Further Research Based on an Analysis of 32 Studies — Review of Educational Research — 1975 — 45(4), 637–659 — 10.3102/00346543045004637
76. Stone — A Meta-Analysis of Advance Organizer Studies — The Journal of Experimental Education — 1983 — 51(4), 194–199 — 10.1080/00220973.1983.11011862
77. Mayer, Mathias, Wetzell — Fostering understanding of multimedia messages through pre-training: Evidence for a two-stage theory of mental model construction. — Journal of Experimental Psychology: Applied — 2002 — 8(3), 147–154 — 10.1037/1076-898x.8.3.147
78. Reigeluth, Merrill, Wilson, Spiller — The elaboration theory of instruction: A model for sequencing and synthesizing instruction — Instructional Science — 1980 — 9(3) — 10.1007/bf00177327 [nur CR]
79. Wilson, Cole — A critical review of elaboration theory — Educational Technology Research and Development — 1992 — 40(3), 63–79 — 10.1007/bf02296843
80. English, Reigeluth — Formative research on sequencing instruction with the elaboration theory — Educational Technology Research and Development — 1996 — 44(1), 23–42 — 10.1007/bf02300324 [nur CR]
81. Letrud, Hernes — Excavating the origins of the learning pyramid myths — Cogent Education — 2018 — 5(1), 1518638 — 10.1080/2331186x.2018.1518638
82. Letrud, Hernes — The diffusion of the learning pyramid myths in academia: an exploratory study — Journal of Curriculum Studies — online 2015, print 2016 — 48(3), 291–302 — 10.1080/00220272.2015.1088063
83. Dunlosky, Rawson, Marsh, Nathan, Willingham — Improving Students' Learning With Effective Learning Techniques: Promising Directions From Cognitive and Educational Psychology — Psychological Science in the Public Interest — 2013 — 14(1), 4–58 — 10.1177/1529100612453266
84. Hattie, Donoghue — Learning strategies: a synthesis and conceptual model — npj Science of Learning — 2016 — 1(1) — 10.1038/npjscilearn.2016.13

## 7. Nicht verifiziert

### DOI nicht verifiziert (Crossref ohne passenden Treffer)
- Coffield, Moseley, Hall & Ecclestone (2004), LSRC-Bericht. Kein DOI erwartet; ISBN 1 85338 918 8. Geöffnet wurde eine gespiegelte Kopie, nicht die erloschene LSRC-Seite.
- Felder & Silverman (1988), Engineering Education 78(7), 674–681. Angaben laut PDF auf der NCSU-Seite.
- Felder & Spurlin (2005), International Journal of Engineering Education 21(1), 103–112. Crossref kennt nur einen PsycTESTS-Datensatz (10.1037/t43782-000), nicht den Artikel.
- Felder (2020), Advances in Engineering Education 8(1).
- Wild & Schiefele (1994), Zeitschrift für Differentielle und Diagnostische Psychologie 15(4), 185–200. Crossref kennt nur einen PsycTESTS-Datensatz (10.1037/t72690-000). URN: urn:nbn:de:kobv:517-opus-33638.
- Letrud (2012), Education 133(1). ERIC EJ996977.
- Subramony, Molenda, Betrus & Thalheimer (2014), Educational Technology. ERIC EJ1057239.
- Tait, Entwistle & McCune (1998), Buchbeitrag zu ASSIST.
- Pintrich, Smith, Garcia & McKeachie (1991), MSLQ-Manual. ERIC ED338122, kein DOI.
- Kolb & Kolb (2013), Handbuch zur KLSI 4.0. Verlagsdokument ohne DOI.
- Kavale, Hirshoren & Forness (1998). Kein Treffer; im Bericht nicht verwendet.

### Sachaussagen NICHT VERIFIZIERT
- **ILS:** Inhalt der offiziellen FAQ- und Lizenzseite (CAPTCHA). Existenz einer autorisierten oder validierten deutschen Fassung.
- **MSLQ:** die Aussage, das Instrument sei gemeinfrei und ohne Erlaubnis nutzbar (nur Suchtreffer zu einer ResearchGate-Seite). Autorisierte deutsche Fassung.
- **ASSIST:** freie Nutzung gegen Quellenangabe (nur Suchtreffer). Deutsche Fassung. Projektseite nicht erreichbar.
- **Vermunt ILS:** Urheberrechtsvermerk und Erlaubnisbedingungen (nur Suchtreffer). Deutsche Fassung.
- **R-SPQ-2F:** Wortlaut der Nutzungseinladung im Originalartikel (Bezahlschranke). Frühere Download-Freigabe auf Biggs' Website (Domain geparkt). Die Aussage, das Instrument solle Studierende nicht als Tiefen- oder Oberflächenlerner einstufen (nur Suchtreffer).
- **Kolb:** Bedingungen der Forschungsversion. Deutsche Fassung.
- **Honey & Mumford:** eigene Aussage der Autoren zur Passung (nur über Coffield belegt). Britische TalentLens-Lizenzvereinbarung; geöffnet wurden die Bedingungen von Pearson Assessments (USA).
- **LIST-K:** Antwortformat und Bearbeitungszeit. Bezugsweg der Items außerhalb des kostenpflichtigen Artikels. Jede ausdrückliche Nutzungsfreigabe.
- **Dauerangaben** mit dem Zusatz „Schätzung" in Tabelle und Text.
- **Inhalt** aller mit [nur CR] markierten Quellen.
- **Elaboration Theory:** Eine Metaanalyse zur Wirksamkeit wurde nicht gefunden; das ist kein Beleg dafür, dass es keine gibt.
- **Schöpfungshöhe** einzelner Fragebogen-Items nach deutschem Urheberrecht: nicht geprüft.
