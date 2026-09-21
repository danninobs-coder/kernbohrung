import { useEffect, useState, type ReactNode } from 'react';
import { SKALEN, SKALA_TEXT, type Muster } from './items';
import { werteAus, type Auswertung, type Lernmuster } from './auswertung';
import { SCHLUESSEL_PROFIL, liesProfil } from './schema';
import { VORSCHLAG, wiederholungLohnt } from './vorschlag';
import { speicher as neuerSpeicher, type Speicher } from '../tutor/speicher';

/**
 * Die Ergebnisseite des Lernprofils: Muster, Balken, Vorschlaege, Beipackzettel.
 *
 * Zwei Komponenten in einer Datei. `Ergebnisansicht` stellt eine fertige
 * Auswertung dar und weiss nichts vom Speicher — sie steht auf `/profil` UND am
 * Ende des Audits. Der Standardexport `Ergebnis` ist die Insel fuer `/profil`:
 * Er liest den gespeicherten Stand, prueft ihn und rechnet die Auswertung
 * daraus. Gespeichert ist nie das Ergebnis, immer nur die Antworten.
 *
 * Die Insel kennt keine Adressen. Verweise kommen als Slots aus der
 * Astro-Seite herein: Nur dort erreicht sie `werkzeug/relative-verweise.mjs`,
 * das den gebauten Stand ortsunabhaengig macht.
 */

/** Wortlaut aus dem Spec. Steht IMMER da, wenn die Ansicht dasteht — nicht im Kleingedruckten. */
export const BEIPACKZETTEL =
  'Dieses Profil beruht auf eigenen Aussagen nach veröffentlichten Modellen der Lernstrategien (LIST, MSLQ) und den Lernmustern nach Vermunt. Es ist keine geprüfte Skala. Was die App über dein Lernen wirklich weiß, stammt aus deinen Antworten auf Aufgaben.';

/** Wortlaut aus dem Spec. */
export const MOMENTAUFNAHME =
  'Muster ändern sich mit Stoff und Übung. Das ist eine Momentaufnahme, keine Diagnose.';

/**
 * Je Muster ein bis zwei Saetze, was es heisst. Jeder Satz beginnt mit "Nach
 * deinen Antworten": Die Herkunft ist immer die eigene Selbstauskunft, nie
 * eine Diagnose. Beschrieben wird eine Gewohnheit, nie ein Typ — und
 * nirgends steht, man lerne besser, wenn der Stoff zum Muster passt. Das ist
 * nicht belegt und wird nicht versprochen.
 */
export const MUSTER_ERKLAERUNG: Readonly<Record<Muster, string>> = {
  bedeutungsorientiert:
    'Nach deinen Antworten suchst du nach Zusammenhängen und willst wissen, warum etwas gilt. Was du liest, prüfst du, statt es nur zu übernehmen.',
  reproduktionsorientiert:
    'Nach deinen Antworten richtest du dich danach, was abgefragt wird, und prägst dir den Stoff möglichst genau ein. Die Transferaufgaben der App verlangen mehr als das — dort zeigt sich, ob es trägt.',
  anwendungsorientiert:
    'Nach deinen Antworten fragst du zuerst, was du mit dem Stoff praktisch anfangen kannst, und merkst dir Dinge am besten an einem echten Fall.',
  ungerichtet:
    'Nach deinen Antworten bist du dir oft unsicher, womit du anfangen sollst und ob deine Art zu lernen die richtige ist. Das ist kein Urteil über dich, sondern eine Gewohnheit — und Gewohnheiten lassen sich ändern.',
};

export const STRUKTURHINWEIS =
  'Du hast angegeben, beim Lernen oft nicht zu wissen, womit du anfangen sollst. Halte dich an die Reihenfolge der Lektionen — sie ist so gebaut, dass du das nicht selbst entscheiden musst.';

/** Der Satz zum Muster. Wo ein Muster steht, steht „derzeit". */
export function mustersatz(lernmuster: Lernmuster | null): string {
  if (lernmuster === null) return 'Dein Lernmuster ist nicht erhoben — dafür fehlen Antworten.';
  if (lernmuster.art === 'undeutlich') return 'Nach deinen Antworten trifft derzeit keines der vier Muster deutlich zu.';
  if (lernmuster.art === 'zwischen') {
    return `Dein Lernmuster liegt derzeit zwischen ${lernmuster.a} und ${lernmuster.b}.`;
  }
  return `Dein Lernmuster ist derzeit ${lernmuster.muster}.`;
}

/** 2.6666 wird zu „2,7". */
export function alsZahl(wert: number): string {
  return wert.toFixed(1).replace('.', ',');
}

/** Das Datum der Erhebung in der Zeitzone des Geraets, ohne fuehrende Nullen. */
export function alsDatum(iso: string): string {
  const tag = new Date(iso);
  return `${tag.getDate()}.${tag.getMonth() + 1}.${tag.getFullYear()}`;
}

export type ErgebnisansichtProps = {
  auswertung: Auswertung;
  /** ISO-Zeitpunkt der Erhebung. */
  erhoben: string;
  /** Nur fuer den Hinweis nach acht Wochen. Voreingestellt: jetzt. */
  jetzt?: Date;
  /** Das Ergebnis steht nur auf dem Bildschirm: Das Speichern ist gescheitert. */
  nichtBehalten?: boolean;
  /** Der Verweis „Neu erheben" — ein Slot der Astro-Seite. */
  erneut?: ReactNode;
};

export function Ergebnisansicht({ auswertung, erhoben, jetzt, nichtBehalten = false, erneut }: ErgebnisansichtProps) {
  const { lernmuster, strukturhinweis, skalen, schwachstellen } = auswertung;
  // Kein erhobenes Muster UND ein undeutliches teilen sich das leere Feld:
  // Im ersten Fall fehlen die Antworten, im zweiten stimmen sie keinem
  // Muster deutlich genug zu — in beiden Faellen gibt es nichts zu erklaeren.
  const genannt: readonly Muster[] =
    lernmuster === null || lernmuster.art === 'undeutlich'
      ? []
      : lernmuster.art === 'zwischen'
        ? [lernmuster.a, lernmuster.b]
        : [lernmuster.muster];

  return (
    <div className="profil">
      {nichtBehalten && (
        <p className="profil-hinweis" role="status">
          Dein Profil konnte auf diesem Gerät nicht gespeichert werden. Du siehst es jetzt — nach dem Schließen der
          Seite ist es weg.
        </p>
      )}

      <section className="karte profil-muster">
        <p className="augenbraue">Lernmuster nach Vermunt</p>
        {/* Der Mustersatz ist die Ueberschrift des Abschnitts: Wer per
            Ueberschrift springt, hoert so gleich das Ergebnis. */}
        <h2 className="muster-satz" data-muster={lernmuster === null ? 'keins' : lernmuster.art}>
          {mustersatz(lernmuster)}
        </h2>
        {genannt.map((muster) => (
          <p key={muster} className="muster-erklaerung">
            {genannt.length > 1 && <b>{muster}: </b>}
            {MUSTER_ERKLAERUNG[muster]}
          </p>
        ))}
        {lernmuster !== null && <p className="momentaufnahme">{MOMENTAUFNAHME}</p>}
        {strukturhinweis && <p className="strukturhinweis">{STRUKTURHINWEIS}</p>}
      </section>

      <section className="karte profil-strategien">
        <h2>Deine Lernstrategien</h2>
        <ul className="balken">
          {SKALEN.map((skala) => {
            const wert = skalen[skala];
            return (
              <li key={skala} className="balken-zeile" data-skala={skala}>
                <span className="balken-name">{SKALA_TEXT[skala]}</span>
                {/* Die Zahl steht als Text da. Der Balken ist Zierde und fuer
                    Vorlesegeraete ausgeblendet — Farbe und Laenge allein tragen
                    keinen Wert (WCAG 1.4.1). */}
                <span className="balken-zahl">{wert === null ? 'nicht erhoben' : `${alsZahl(wert)} von 5`}</span>
                <span className="balken-spur" aria-hidden="true">
                  <span className="balken-fuellung" style={{ width: `${wert === null ? 0 : (wert / 5) * 100}%` }} />
                </span>
                {schwachstellen.includes(skala) && <span className="balken-marke">dazu unten ein Vorschlag</span>}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="karte profil-vorschlaege">
        <h2>Vorschläge</h2>
        {schwachstellen.length === 0 ? (
          // Das Profil erfindet keinen Mangel — und unterscheidet, WARUM es
          // keinen gibt: zu wenige Antworten ist ein anderer Befund als
          // erhoben und unauffaellig.
          <p className="kein-vorschlag">
            {SKALEN.every((skala) => skalen[skala] === null)
              ? 'Zu deinen Lernstrategien liegen zu wenige Antworten vor — dann gibt es hier auch keinen Vorschlag.'
              : 'Keine der erhobenen Strategien liegt unter 3 von 5 — dann gibt es hier auch keinen Vorschlag.'}
          </p>
        ) : (
          <ul className="vorschlaege">
            {schwachstellen.map((skala) => (
              <li key={skala} className="vorschlag">
                <b>{SKALA_TEXT[skala]}</b>
                <span>{VORSCHLAG[skala]}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <aside className="beipackzettel">
        <h2>Was dieses Profil ist — und was nicht</h2>
        <p>{BEIPACKZETTEL}</p>
      </aside>

      <section className="profil-erneut">
        <p className="profil-erhoben">Erhoben am {alsDatum(erhoben)}.</p>
        {wiederholungLohnt(erhoben, jetzt ?? new Date()) && (
          <p className="profil-hinweis">
            Deine Erhebung ist älter als acht Wochen. Muster ändern sich — eine Wiederholung lohnt sich.
          </p>
        )}
        {erneut}
      </section>
    </div>
  );
}

export type ErgebnisProps = {
  /**
   * Die Naht fuer Tests, wie in `Aufgabe.tsx`. Voreingestellt ist der echte
   * Speicher; er oeffnet erst beim ersten Zugriff, deshalb schadet der Aufruf
   * beim Vorrendern auf dem Server nicht.
   */
  speicher?: Speicher;
  jetzt?: Date;
  /** Slot: der Verweis zum Audit, wenn noch kein Profil da ist. */
  anlegen?: ReactNode;
  /** Slot: der Verweis „Neu erheben", wenn eines da ist. */
  erneut?: ReactNode;
};

type Zustand =
  | { readonly art: 'laden' }
  | { readonly art: 'keins' }
  | { readonly art: 'da'; readonly auswertung: Auswertung; readonly erhoben: string };

export default function Ergebnis({ speicher, jetzt, anlegen, erneut }: ErgebnisProps) {
  const [ablage] = useState<Speicher>(() => speicher ?? neuerSpeicher());
  const [zustand, setZustand] = useState<Zustand>({ art: 'laden' });

  useEffect(() => {
    let aktiv = true;
    void (async () => {
      // Alles, was kein lesbarer Stand zum heutigen Itemsatz ist, heisst „kein
      // Profil": nichts gespeichert, unlesbar, fremder Satz, Speicher kaputt.
      let naechster: Zustand = { art: 'keins' };
      try {
        const stand = liesProfil(await ablage.einstellung(SCHLUESSEL_PROFIL));
        const auswertung = stand === null ? null : werteAus(stand);
        if (stand !== null && auswertung !== null) {
          naechster = { art: 'da', auswertung, erhoben: stand.erhoben };
        }
      } catch (fehler) {
        console.warn('[profil] Lesen fehlgeschlagen:', fehler);
      }
      if (aktiv) setZustand(naechster);
    })();
    return () => {
      aktiv = false;
    };
  }, [ablage]);

  if (zustand.art === 'laden') return <p className="profil-laden">Dein Profil wird geladen …</p>;

  if (zustand.art === 'keins') {
    return (
      <div className="karte profil-leer">
        <p className="profil-leer-satz">Auf diesem Gerät liegt noch kein Lernprofil.</p>
        <p>
          Das Audit ist ein Angebot: 26 Aussagen und drei Vorlieben, etwa vier Minuten. Es fragt nach Gewohnheiten,
          nicht nach einem Typ — und nichts in der App hängt davon ab, dass du es machst.
        </p>
        {anlegen}
      </div>
    );
  }

  return <Ergebnisansicht auswertung={zustand.auswertung} erhoben={zustand.erhoben} jetzt={jetzt} erneut={erneut} />;
}
