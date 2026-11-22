# 🕵️ IMPOSTER – Online-Partyspiel

Partyspiel im Nintendo-Switch-Stil für Web und Android. Alle bekommen dasselbe geheime Wort, nur der **Imposter** nicht. Ihr redet darüber, ohne das Wort zu sagen. Wer verdächtig ist, wird nach **STOPP!** rausgewählt.

- 🌐 **Online:** Gruppe mit 5-stelligem Code oder Link erstellen, 3–20 Spieler, jeder an seinem eigenen Handy
- 📱 **Lokal:** ein Handy wird herumgereicht
- 🇩🇪 🇬🇧 🇷🇸 **Sprachen:** Deutsch, English, Srpski (jeder Spieler sieht das Wort in seiner Sprache)
- 🎭 **18 eigene Charaktere** (Blobbo, Foxi, Momo, Zappy, Nubo, Kiki, Grumbo, Luma, Tako, Bruno, Fizzy, Stella, Pingo, Rocky, Shado, Pepper, Mochi, Volto) oder ein eigenes Foto
- 📚 **500 Wörter** in 11 Kategorien
- 🎮 **4 Spielmodi:** Klassisch, Undercover (der Imposter bekommt ein anderes Wort und weiß nichts davon), Chaos (unbekannte Anzahl Imposter), Schreib-Modus (Hinweise tippen, nur online)
- 🎯 **Letzte Chance:** Ein erwischter Imposter darf das Wort raten und gewinnt bei richtiger Antwort doch noch
- ⚙️ **Spiel-Einstellungen:** bis zu (Spieler − 1) Imposter, Kategorien, eigene Wörter, Timer von 1–10 Min., Kategorie-Hinweis
- 👵 **Einfacher Modus (Oma-Modus):** große Schrift, hoher Kontrast, keine Animationen, Karte per Knopf, Erklärungen auf jedem Bildschirm, Vorlese-Knopf
- 🎨 **App-Einstellungen:** 5 Farbthemen, 3 Schriftgrößen, Kontrast, Animationen, Töne, Vibration, Aufdeck-Art, Sprech-Reihenfolge, Bildschirm anlassen, Nachfrage vor dem Verlassen
- 🎴 **Karten:** gedrückt halten oder nach oben ziehen, um das Wort zu sehen

## Technik
- Reines HTML/CSS/JS ohne Build-Schritt (`www/`)
- Multiplayer per WebRTC über [PeerJS](https://peerjs.com) (kostenloser öffentlicher Vermittlungsserver). Das Handy des Hosts ist der Spielserver.
- Android-App mit Capacitor. Die APK wird per GitHub Actions gebaut (`.github/workflows/imposter.yml`) und als Release veröffentlicht.

## Lokal starten
```bash
cd imposter/www && python3 -m http.server 8080
```

## APK selbst bauen
Voraussetzungen: Android SDK und JDK 21.
```bash
cd imposter && npm install && npm run android:init && npm run android:build
```
