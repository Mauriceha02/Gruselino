# Gruselino – Planung

Stand: 11. Oktober 2026. Die erste App-Version ist umgesetzt. Dieser Plan dokumentiert ihre Regeln und die Einbindung in die Spiele-App.

## Regeln des Originals

- Zwei bis vier Spieler, 33 Suchkarten und vier Übersichtstafeln.
- Acht Figuren: Ritter, Fledermaus, Gespenst, Vampir, Eule, Katze, Hexe und Kürbis.
- Jeder Spieler erhält eine Übersicht mit allen acht Figuren. Auf jeder Suchkarte sind sieben Figuren abgebildet; genau eine fehlt.
- Die Suchkarten werden gemischt und verdeckt gestapelt. Eine Karte wird für alle gleichzeitig aufgedeckt.
- Alle suchen gleichzeitig. Wer die fehlende Figur zuerst richtig nennt, bekommt die Karte. Dann wird die nächste aufgedeckt.
- Nach der letzten Karte gewinnt, wer die meisten Karten gesammelt hat.
- Die Anleitung nennt keine besondere Strafe für einen falschen Ruf und keine eigene Regel für Gleichstand.

Quelle: [Ravensburger-Spielanleitung](https://product-files.ravensburger.cloud/manuals/663759.pdf), verlinkt auf der [Produktseite](https://www.ravensburger.de/de-DE/pdp/23081).

Die genaue Häufigkeit der fehlenden Figuren im Originaldeck ist in der Anleitung nicht angegeben. Dafür keine Verteilung als Originalregel behaupten. Unsere 33 Karten erhalten eigene Anordnungen; die Lösungen werden möglichst gleichmäßig verteilt. Die zusätzliche Karte gegenüber vier Durchgängen durch alle acht Figuren wird pro Partie zufällig zugeordnet.

## Erste App-Version

Ein Mensch gegen ein bis drei Computergegner, vollständig offline. Kein Konto, kein Server und kein WLAN-Mehrspieler in der ersten Version.

1. Spielstärke und Anzahl der Computer auswählen.
2. Nach einer kurzen Startanzeige die erste Suchkarte aufdecken.
3. Die fehlende Figur auf der eigenen Übersicht antippen.
4. Die erste richtige Antwort gewinnt genau einen Punkt und die Karte. Danach werden weitere Antworten für diese Karte gesperrt.
5. Lösung und Gewinner kurz anzeigen. Erst anschließend die nächste Karte aufdecken.
6. Nach 33 vergebenen Karten das Ergebnis anzeigen. Bei Punktgleichheit gibt es mehrere Gewinner.

Antippen, Punkteanzeige und gemeinsame Gewinner sind Anpassungen für die App. Ein Punkt entspricht einer gewonnenen Karte.

Vorschlag bei einer falschen Antwort: kein Punkt und 1,5 Sekunden Eingabesperre für diesen Spieler. Die Suchkarte bleibt offen und andere Spieler dürfen weiter antworten. Das verhindert schnelles Durchtippen aller acht Figuren. Diese Regel und die Dauer sind App-Entscheidungen, keine Vorgabe aus dem Original.

## Bildschirm auf dem iPhone

- Oben: Zurück zur Spieleauswahl, eigener Punktestand, Computerpunkte und verbleibende Karten.
- Mitte: eine große Suchkarte mit sieben gut erkennbaren Figuren.
- Unten: feste Übersicht mit allen acht Figuren als acht Tasten, in zwei Reihen zu je vier Figuren.
- Die Übersicht behält immer dieselbe Reihenfolge. Die Suchkarten variieren Anordnung, Größe und Drehung der Figuren.
- Suchkarte und Übersicht müssen gleichzeitig sichtbar bleiben; während der Suche wird nicht gescrollt.
- Große Tippflächen, deutlich unterscheidbare Silhouetten und kurze Figurenbezeichnungen. Farbe darf nicht das einzige Unterscheidungsmerkmal sein.
- Ergebnisse zwischen Karten anzeigen, ohne die Tippflächen während einer laufenden Suche zu verschieben.

## Figuren und Karten

Die acht Figuren werden neu gezeichnet und lokal mitgeliefert. Jede Figur hat eine feste ID sowie denselben erkennbaren Look auf Suchkarte und Übersicht. Zunächst einfache eigene SVGs, danach die fertigen Illustrationen einsetzen. Keine extern nachgeladenen Bilder.

Eine Suchkarte enthält sieben unterschiedliche Figuren und eine Lösungs-ID. Die Lösung muss genau der achten, nicht sichtbaren Figur entsprechen. Positionen werden einmal beim Erstellen der Partie erzeugt und gespeichert, damit eine Karte beim Fortsetzen ihr Aussehen behält. Keine überdeckten oder abgeschnittenen Figuren.

Eigene Zeichnungen und Kartenlayouts verwenden; das Ravensburger-Logo und die Originalillustrationen gehören nicht zu unseren App-Assets.

## Computergegner

Die Computer bekommen nach dem Aufdecken eine zufällige Reaktionszeit. Ihre Geschwindigkeit wird für das Spiel eingestellt; sie lösen die Bilder nicht mit einem KI-Dienst.

Erste Werte zum Ausprobieren: Einfach 4–8 Sekunden, Stark 2–5 Sekunden. Beide starten erst, wenn die Suchkarte sichtbar und ihre Bilder geladen sind. Die Zeiten müssen auf dem echten iPhone getestet und angepasst werden.

Eine gemeinsame Auswertung entscheidet über alle Antworten. Jede Antwort gehört zu einer bestimmten Karte. Sobald diese vergeben ist, können verspätete Klicks oder Computer-Timer dafür keinen zweiten Punkt auslösen. Gewinnt ein Mensch, werden die übrigen Computer-Timer beendet. Bei exakt gleicher Antwortzeit wird unter den schnellsten richtigen Antworten gelost.

## Speichern und Pausieren

- Eigener Speichername `gruselino.game.v1`; vorhandene Phase10-Spielstände werden nicht verändert.
- Speichern: Kartensatz mit Anordnungen, Reihenfolge des Stapels, aktuelle Karte, Gewinner jeder vergebenen Karte, Einstellungen und Spielfortschritt.
- Punktstände aus den gewonnenen Karten ableiten, damit keine Karte doppelt gezählt werden kann.
- Beim Verlassen des Spiels oder Wechseln in den Hintergrund pausieren alle Timer.
- Beim Fortsetzen bleibt die aktuelle Suchkarte gleich. Nach einer kurzen Startanzeige beginnt die Suche mit neu angesetzten Computerzeiten. Das ist eine bewusste App-Anpassung: Die laufende Reaktionszeit wird nicht über Stunden oder nach einem Neustart weitergezählt.
- Zwischenkarten-Ergebnisse ebenfalls speichern. Nach einem Neustart darf eine bereits gewonnene Karte nicht erneut vergeben werden.
- Speicherfehler sichtbar melden. Eine neue Partie ersetzt den bisherigen Gruselino-Spielstand erst nach einer bewussten Auswahl.

## Technik und Ordner

TypeScript und HTML/CSS, passend zur bestehenden App. Spiellogik von Darstellung und Timern trennen. Kein Framework für den ersten Stand nötig.

```text
src/game/       Figuren, Karten, Antworten und Punkte
src/ui/         Suchkarte, Übersicht und Ergebnisse
src/ai/         Computerzeiten
src/storage/    Lokaler Spielstand
public/assets/  Eigene Figuren und Kartenbilder
tests/          Regeln und wichtige Zustandswechsel
scripts/        Build und Offline-Dateien
```

Die Ordner bleiben flach; Spiellogik und Oberfläche sind getrennt.

## Einbindung in die Spiele-Startseite

Die Entwicklung bleibt in einem eigenen Repository `Gruselino`. Das bestehende Repository `Phase10` enthält weiterhin die Spieleauswahl und die Phase10-App.

Empfohlen: Die Spiele-App übernimmt beim Build eine festgelegte Gruselino-Version und liefert beide Spiele unter ihrer bisherigen Adresse aus. Der bestehende Offline-Cache enthält dann auch Gruselino. So reicht ein Home-Bildschirm-Symbol, und die Startseite öffnet beide Spiele ohne Internet. Keine Kopie des Gruselino-Quellcodes von Hand pflegen.

Vor der Umsetzung der Einbindung festlegen:

- Gruselino liefert ein JavaScript-Modul zum Starten in einem gegebenen Bildschirmbereich und zum vollständigen Beenden. Beim Beenden verschwinden seine Listener und Timer.
- Die gemeinsame App übernimmt Navigation, Installation und Offline-Updates. Das Gruselino-Modul registriert keinen zweiten Service Worker.
- Eigene Asset-Pfade und auf den Gruselino-Bereich begrenztes CSS verhindern Kollisionen mit Phase10.
- Im Build eine konkrete Git-Commit-ID verwenden, damit Gruselino-Änderungen die bestehende App erst bei einem bewussten Update verändern.
- Die Startseite ersetzt „Geplant“ erst nach erfolgreicher Integration durch „Spielen“ oder „Fortsetzen“.
- Mit vorhandenen Phase10-Spielständen, unter dem Unterpfad `/Phase10/` und ohne Internet prüfen.

Ein einfacher Link zu einer separat veröffentlichten Gruselino-Website wäre ebenfalls möglich. Er bietet zunächst zwei unabhängige Apps; der aktuelle Phase10-Offline-Cache speichert das verlinkte Spiel dadurch nicht automatisch mit. Daher ist das nicht die geplante Lösung für eine gemeinsame Offline-App.

[GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages) kann statische Spiele aus Repositories veröffentlichen. Die gemeinsame Auslieferung aus getrennten Repositories ist unsere geplante Build-Lösung, keine automatische GitHub-Pages-Funktion.

## Reihenfolge der Umsetzung

1. Acht eigene Figuren und eine Handyansicht mit Suchkarte und Übersicht entwerfen.
2. Karten erzeugen, Antworten auswerten und Punkte zählen. Zunächst ohne Computer.
3. Computerzeiten, Pause und Fortsetzen ergänzen.
4. Spielstand und Offlinebetrieb einbauen; auf dem echten iPhone ausprobieren.
5. Gruselino als festgelegte Version in die Spiele-App aufnehmen.
6. WLAN-Mehrspieler später separat planen: Dafür braucht es zusätzlich eine gemeinsame Spielleitung und eine faire Abstimmung der Antwortzeiten zwischen den Geräten.

Wichtige Prüfungen: jede Karte hat genau sieben der acht Figuren; genau eine Lösung; keine doppelte Punktevergabe; alte Timer bleiben wirkungslos; falsche Antworten umgehen die Sperre nicht; Summe der Punkte entspricht den vergebenen Karten; Fortsetzen verliert keine Karte; Wechsel zwischen Spielen beendet alle Gruselino-Timer; beide Spiele bleiben offline nutzbar.
