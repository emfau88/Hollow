# QA-Bericht – Hollow Covenant

**Stand:** 20. Juli 2026  
**Build:** 1.0.0

## Automatisierte Prüfung

- TypeScript-Prüfung: bestanden
- Vite-Produktionsbuild: bestanden
- Vitest: 13/13 Tests bestanden
- Pfadfindung und L-Routen: bestanden
- Produktionsrezepte: bestanden
- Rekrutierungsvoraussetzungen: bestanden
- Gefangenenkonsequenzen: bestanden
- Fünfteiliger Missionsfluss: bestanden

## Browserprüfung

Geprüft wurde die laufende Anwendung, nicht nur der Quellcode:

- Startdialog und Spielstart
- Raum als frei gezogene Zone errichten
- Gangroute markieren
- drei Arbeiter graben automatisch
- Pilzgrotte aufdecken
- Angriffsbanner setzen
- Höhlengegner automatisch bekämpfen
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

## Bekannte technische Eigenschaft

Phaser wird in einem eigenen Produktionschunk ausgeliefert. Vite meldet deshalb einen
unbedenklichen Größenhinweis für den JavaScript-Chunk; die komprimierte Übertragung liegt
bei rund 351 kB. Funktion oder Ladefähigkeit sind davon nicht beeinträchtigt.
