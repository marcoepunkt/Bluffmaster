# Bluffmaster 2.0 – Starter

Dieser erste Online-Meilenstein enthält:

- anonyme Firebase-Anmeldung
- Online-Raum mit sechsstelliger Nummer erstellen
- Raum auf einem zweiten Handy betreten
- Spielerliste live auf allen Handys synchronisieren
- Gastgeber startet das Spiel
- Grundgerüst für Offline- und Online-Spiel

## Dateien

- `index.html`
- `style.css`
- `app.js`
- `firestore.rules`

## Testen

Die Dateien müssen über eine echte HTTPS-Webadresse laufen. Direktes Öffnen als lokale Datei reicht nicht.

Geeignet sind zum Beispiel:

- GitHub Pages
- Firebase Hosting
- CodePen oder ein anderer Online-Editor mit Modul-Unterstützung

Öffne dieselbe veröffentlichte Adresse auf zwei Handys:

1. Auf Handy 1 einen Namen eingeben und Raum erstellen.
2. Den sechsstelligen Code merken.
3. Auf Handy 2 einen anderen Namen eingeben und dem Raum beitreten.
4. Beide Geräte sollten die Spielerliste sofort aktualisieren.
5. Der Gastgeber kann ab zwei Spielern auf „Spiel starten“ tippen.

## Firestore-Regeln

Die Datei `firestore.rules` enthält bessere Entwicklungsregeln als der offene Testmodus.

In der Firebase-Konsole:

1. Firestore Database öffnen.
2. Reiter „Regeln“ auswählen.
3. Den bisherigen Inhalt durch den Inhalt aus `firestore.rules` ersetzen.
4. Veröffentlichen.

Diese Regeln sind für den Prototyp gedacht. Vor einer öffentlichen Veröffentlichung werden sie noch weiter verschärft.

## Nächster Meilenstein

Danach wird die komplette Mäxchen-Spiellogik integriert:

- private Würfe
- höhere Ansagen
- bluffen
- glauben / anzweifeln
- Auswertung
- drei Leben
- Ausscheiden und Gewinner
