# Gruselino

Die fehlende Figur antippen: solo gegen Computer oder zu zweit, mit 10 oder 33 Karten. Solopartien werden lokal gespeichert und laufen offline.

`Gruselino` und `Game-Multiplayer` nebeneinander auschecken und jeweils `npm ci` ausführen. Die Netzwerkversion ist in `multiplayer.json` festgelegt.

```sh
npm run dev
```

Öffnen: http://localhost:5175. Prüfen: `npm test`. Build: `npm run build` → `dist/` und `bundle/`.

Multiplayer: Einladungslink teilen, beide Geräte geöffnet lassen. Ohne Internet gibt es den Code-Modus. Die erste richtige Antwort beim Gastgeber gewinnt; falsche Antworten sperren 1,5 Sekunden.

Updates: zuerst Game-Multiplayer pushen, bei Bedarf `multiplayer.json` aktualisieren, dann Gruselino pushen und dessen Commit-ID in der Spiele-App unter `games.json` eintragen.

[Originalregeln](https://product-files.ravensburger.cloud/manuals/663759.pdf). Eigene Figuren und Kartenlayouts; Antippen und Eingabesperre sind Anpassungen für die App.
