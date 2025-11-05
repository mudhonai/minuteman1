# 📱 Minuteman - Native Mobile App Setup

Deine Minuteman-App ist jetzt für **echtes Hintergrund-Geofencing** vorbereitet! Die App kann im Hintergrund laufen und automatisch stempeln, wenn Mitarbeiter durch das Werkstor gehen.

## ✅ Was bereits vorbereitet ist:

- ✅ Capacitor ist konfiguriert
- ✅ iOS & Android Support
- ✅ Background-Geolocation Plugin
- ✅ Push-Benachrichtigungen
- ✅ Native Geofencing-Service
- ✅ Hot-Reload für schnelles Testing

## 🚀 Nächste Schritte zum Testen auf deinem Handy:

### 1. Projekt zu Github exportieren
Klicke auf **"Export to Github"** in Lovable und übertrage das Projekt in dein eigenes Github-Repository.

### 2. Projekt lokal klonen
```bash
git clone [DEIN-GITHUB-REPO-URL]
cd [PROJEKT-NAME]
```

### 3. Dependencies installieren
```bash
npm install
```

### 4. Plattformen hinzufügen

**Für iOS (benötigt Mac mit Xcode):**
```bash
npx cap add ios
npx cap update ios
```

**Für Android (benötigt Android Studio):**
```bash
npx cap add android
npx cap update android
```

### 5. Build erstellen
```bash
npm run build
```

### 6. Native Project syncen
```bash
npx cap sync
```

### 7. App auf Handy/Emulator starten

**iOS:**
```bash
npx cap run ios
```
Oder öffne `/ios/App/App.xcworkspace` in Xcode

**Android:**
```bash
npx cap run android
```
Oder öffne `/android` in Android Studio

## 📍 Wie das Hintergrund-Geofencing funktioniert:

1. **App startet** → Background-Tracking aktiviert (wenn in Einstellungen aktiviert)
2. **Mitarbeiter geht durch Werkstor** → GPS erkennt Trigger-Punkt
3. **Automatisches Stempeln**:
   - Status "idle" + Auto-Clock-In = **EINSTEMPELN** ✅
   - Status "working/break" + Auto-Clock-Out = **AUSSTEMPELN** 🏁
4. **Push-Benachrichtigung** → Mitarbeiter sieht Bestätigung
5. **App im Hintergrund** → Weiter monitoren

## 🔐 Benötigte Berechtigungen:

### iOS (wird automatisch abgefragt):
- Standort "Immer" erlauben
- Benachrichtigungen erlauben

### Android (wird automatisch abgefragt):
- Standort (Präzise)
- Hintergrund-Standort
- Benachrichtigungen

## ⚙️ Wichtige Konfiguration:

Die Datei `capacitor.config.ts` ist bereits konfiguriert mit:
- **App-ID**: `app.lovable.7b116ff6ebf646559dc2fd36adf2a949`
- **App-Name**: minuteman1
- **Hot-Reload**: Direkt von Lovable Preview testen

## 🎯 Für Produktion:

Wenn du die App für echte Nutzung vorbereiten willst:

1. **Entferne Hot-Reload** aus `capacitor.config.ts`:
   ```typescript
   // Entferne die "server" Sektion für Production
   ```

2. **Baue Production Build**:
   ```bash
   npm run build
   npx cap sync
   ```

3. **App-Store Deployment**:
   - **iOS**: Xcode → Archive → Upload zu App Store Connect
   - **Android**: Android Studio → Build → Generate Signed Bundle

## 📚 Weitere Ressourcen:

- [Capacitor Dokumentation](https://capacitorjs.com/docs)
- [iOS Entwickler-Account](https://developer.apple.com)
- [Google Play Console](https://play.google.com/console)

## 🐛 Probleme?

Häufige Lösungen:
- **Build-Fehler**: `rm -rf node_modules && npm install`
- **iOS nicht startbar**: Xcode öffnen und manuell starten
- **Android nicht startbar**: Android Studio öffnen und Gradle Sync ausführen

---

**Viel Erfolg mit deiner Native Mobile App! 🚀**
