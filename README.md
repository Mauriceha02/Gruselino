# Gruselino

Suchspiel für das iPhone: fehlende Figur antippen. Gegen ein bis drei Computer oder zu zweit im WLAN, mit 10 oder 33 Karten. Solopartien werden lokal gespeichert und laufen offline.

`Gruselino` und `Game-Multiplayer` nebeneinander auschecken, in beiden `npm ci` ausführen. In Gruselino: `npm run dev` → http://localhost:5175. Die Commit-ID in `multiplayer.json` legt die Netzwerkversion fest; alternativ `MULTIPLAYER_SOURCE` setzen.

Prüfen: `npm test`. Bauen: `npm run build` → `dist/` für die Vorschau, `bundle/` für die gemeinsame Spiele-App.

Zu zweit: „Mitspieler im WLAN“ → Einladungslink erstellen und teilen. Das zweite Gerät verbindet sich beim Öffnen automatisch, ohne Konto oder Antwortcode. Ohne Internet steht der Code-Modus zur Verfügung. Dafür HTTPS oder localhost verwenden und beide Geräte geöffnet lassen. Die gemeinsame Partie bleibt in der Verbindung; Solospielstände bleiben erhalten. Falsche Antworten sperren 1,5 Sekunden. Die erste richtige Antwort beim Gastgeber gewinnt die Karte.

Für ein Update zuerst Gruselino auf `Dev` pushen, danach die Spiele-App mit der neuen Commit-ID in `games.json`. Gruselino braucht dafür keine eigene GitHub-Pages-Installation.

[Regeln und Planung](PLAN.md).
