# Gruselino

Suchspiel für das iPhone: fehlende Figur antippen, gegen ein bis drei Computer spielen. 33 Karten, zwei Spielstärken, eigener lokaler Spielstand und Offlinebetrieb.

`npm ci` → `npm run dev` → http://localhost:5175.
Handy im gleichen WLAN: `npm run dev:lan` → `http://<IP-des-Macs>:5175`.

Prüfen: `npm test`. Bauen: `npm run build` → `dist/` für die Vorschau, `bundle/` für die gemeinsame Spiele-App.

Die Spiele-App übernimmt eine feste Gruselino-Commit-ID. Gruselino zuerst auf `Dev` pushen, anschließend die Spiele-App. Gruselino benötigt dafür keine eigene GitHub-Pages-Installation.

[Regeln und Planung](PLAN.md). Falsche Antworten sperren die Auswahl 1,5 Sekunden. Beim Fortsetzen bleibt die Suchkarte gleich; Computerzeiten starten neu.
