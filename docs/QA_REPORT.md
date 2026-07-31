# QA-Bericht – Hollow Covenant

**Stand:** 31. Juli 2026
**Build:** 1.0.0

## Automatisierte Prüfung

- TypeScript-Prüfung: bestanden
- Vite-Produktionsbuild: bestanden
- Vitest: 31/31 Tests bestanden
- Pfadfindung und L-Routen: bestanden
- Produktionsrezepte: bestanden
- Rekrutierungsvoraussetzungen: bestanden
- Gefangenenkonsequenzen: bestanden
- Fünfteiliger Missionsfluss: bestanden
- flächenabhängige Raumkosten und Produktionsskalierung: bestanden
- Phase 3 mit einem zusätzlichen Rekruten: bestanden
- Theme-Auswahl und Style-B-Aliase: bestanden
- Style-B-Asset-Build: reproduzierbar ausgeführt
- alle neuen transparenten Laufzeitassets: transparente Ecken und plausible Motivabdeckung bestanden

## Browserprüfung

Geprüft wurde die laufende Anwendung, nicht nur der Quellcode:

- Startdialog und Spielstart
- Raum als frei gezogene Zone errichten
- Gangroute markieren
- drei Arbeiter graben automatisch
- nördlicher Invasionsweg erzeugt keine Claim-Jobs
- Arbeiterbeschwörung verbraucht 2 Essenz und erhöht 3/5 auf 4/5
- Phasenräume und Rekruten zeigen Sperren samt Gründen
- Missionscheckliste zeigt konkrete Teilfortschritte
- Pilzgrotte aufdecken
- Pilzgrotte ohne erzwungenen Startkampf erschließen
- neues Kartenherz bei normalem Zoom klar lesbar
- Biomasse abbauen, sichtbar tragen und in die Wirtschaft überführen
- Phase 1 abschließen
- Diagnosemodus öffnen
- Gefangenenentscheidung anzeigen und ausführen
- Finalwelle mit Entscheidungsmodifikation auslösen
- Finalwelle besiegen
- Siegstatistik anzeigen

## Responsive Prüfung

### 1280 × 720

- vollständiges HUD
- Werkzeugleiste erreichbar
- keine Laufzeitfehler

### 844 × 390

- `scrollWidth === innerWidth`
- kein horizontaler Seitenüberlauf
- Karte und Werkzeugleiste bedienbar
- reduzierte Informationsdichte wie vorgesehen

### 390 × 844

- blockierender Drehhinweis sichtbar
- kein horizontaler Seitenüberlauf

## Style-B-Prüfstatus

- Produktions-Styleframe gegen reale Karten- und HUD-Dichte erstellt
- kombinierte Assetvorschau visuell auf Silhouetten, Fremdpixel und Skalierung geprüft
- alle referenzierten Style-B-Dateien im Produktionsbuild enthalten
- bisheriges Theme ohne URL-Parameter weiterhin Standard
- direkte Chromium-Abnahme der lokalen URL war in dieser Sitzung durch die
  Browser-Sicherheitsrichtlinie für `127.0.0.1` blockiert; die finale Prüfung
  der drei Zielauflösungen bleibt deshalb der Freigabeschritt vor dem Umschalten
  des Standardthemes

## Bekannte technische Eigenschaft

Phaser wird in einem eigenen Produktionschunk ausgeliefert. Vite meldet deshalb einen
unbedenklichen Größenhinweis für den JavaScript-Chunk; die komprimierte Übertragung liegt
bei rund 373 kB. Funktion oder Ladefähigkeit sind davon nicht beeinträchtigt.
