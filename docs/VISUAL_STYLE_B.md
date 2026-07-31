# Visual Style B – Dungeon Administration

**Status:** spielbarer Vertical Slice hinter `?theme=style-b`
**Stand:** 31. Juli 2026

## Ziel

Hollow Covenant soll wie ein geschäftiger, leicht überforderter Dungeonbetrieb
wirken: warm, klar, charmant-chaotisch und humorvoll. Die Unterwelt bleibt ein
gefährlicher Ort, aber sie soll nicht deprimierend oder horrorschwarz sein.

Der Stil verbindet:

- große, sofort lesbare Silhouetten;
- tiefblauen Fels statt nahezu schwarzer Flächen;
- warmes Creme, Messing und Holz für den Covenant;
- Koralle für Herz und Gefahr;
- Mint und Türkis für Pilze, Essenz und sichere Naturziele;
- Humor durch Körperhaltung, Reaktionen und Betriebsdetails statt Textgags.

Das [Produktions-Styleframe](mockups/HOLLOW_COVENANT_STYLE_B_PRODUCTION_FRAME.png)
übersetzt das gewählte Konzept auf Kameraperspektive, HUD-Fläche und Kartendichte
des echten Spiels.

## Verbindliche Gestaltungsregeln

### Formen und Silhouetten

- Figuren haben große Köpfe und Hände sowie leicht überdimensionierte Werkzeuge.
- Jede Einheit muss bei 36–44 Bildschirmpixeln ohne Beschriftung erkennbar sein.
- Covenant-Diener sind eine eigene Homunkulus-Spezies: gedrungen, 2,5–3 Köpfe
  hoch, mit dunklem Maskengesicht und ausschließlich zwei mintfarbenen Augen.
- Menschliche Hautgesichter, Nasen, Zähne, Bärte und Schnurrbärte sind bei
  Covenant-Dienern ausgeschlossen. Rolle und Charakter entstehen über Werkzeug,
  Haltung und Ausrüstung.
- Covenant-Formen sind rund, improvisiert und warm; gegnerische Formen bleiben
  später kantiger und disziplinierter.
- Props bestehen aus wenigen großen Formen. Kleine Dekoration darf die Funktion
  nicht verdecken.
- Terrain verwendet große ruhige Felsplatten; Mikrostruktur und Kontrastflimmern
  werden vermieden.

### Palette

| Rolle | Farbe |
|---|---|
| Abgrund / äußerster Hintergrund | `#071427` |
| Felsblau | `#20314E` |
| HUD-Panel | `#0B1D35` |
| Text / heller Stein | `#F2DDB0` |
| Covenant-Messing | `#D8A532` |
| Herz / unmittelbare Gefahr | `#E75A52` |
| Pilze / positive Natur | `#55C9A2` |
| Essenz / magische Aktivität | `#38B8BD` |

Gold bezeichnet Besitz, Bedienfokus oder Covenant-Technik. Türkis bezeichnet
nicht Besitz, sondern natürliche oder magische Aktivität. Koralle wird sparsam
eingesetzt, damit Herz und Gefahr auffallen.

### Maßstab auf dem 32-Pixel-Raster

| Element | Zielgröße im Spiel |
|---|---:|
| Arbeiter | 43 px |
| normale Kampfeinheit | 45–46 px |
| getragenes Item | 22–26 px |
| Ressourcenknoten | 58–66 px |
| Herz-Hauptquartier: Sockel | 220 × 165 px |
| Herz-Hauptquartier: Kern | 76 px |
| interaktive HUD-Fläche | mindestens 44 px |

Figuren dürfen ihre Kachel visuell überragen. Bewegung, Zielwahl und Kollision
bleiben weiterhin kachelbasiert.

### Licht und Effekte

- Covenant-Räume erhalten weiches Bernsteinlicht.
- Die Pilzgrotte darf bereits vor Erschließung gedämpft mintfarben leuchten.
- Licht kommuniziert Raumfunktion und Spielfortschritt, nicht nur Atmosphäre.
- Zunächst werden günstige Additive-Glows und kleine Partikel verwendet. Ein
  vollständiges dynamisches Schattensystem ist nicht Teil dieses Slices.

### UI

- Panelgrund: tiefes Navy mit heller Creme-Schrift und Messingkante.
- Zusammengehörige Ressourcen werden als ein Band gelesen, nicht als zehn
  konkurrierende Kästchen.
- Aktiver Zustand: vollflächiges warmes Gold mit dunkelblauer Schrift.
- Icons sind einheitliche, code-native SVG-Linienicons. Unicode bleibt nur bei
  untergeordneten oder noch nicht umgestellten Funktionen.
- Die HUD-Abmessungen bleiben gegenüber dem bisherigen Spiel unverändert.

## Humor-Richtlinie

Gut:

- das Herz führt Buch und trinkt während einer Krise aus seiner Tasse;
- Arbeiter reagieren stolz auf winzige Fortschritte;
- Werkzeuge sind etwas zu groß, Karren etwas zu voll, Apparate sichtbar
  improvisiert;
- trockene Verwaltungsformulierungen stehen im Kontrast zum Dungeonchaos.

Vermeiden:

- Slapstick in jedem Bildschirmbereich;
- moderne Meme-Sprache oder Popkulturreferenzen;
- niedliche Formen, die Gefahr und Systemzustände unlesbar machen;
- Gore, Horror-Nahaufnahmen und fast schwarze Vollflächen.

## Technische Umsetzung

Style B wird mit `?theme=style-b` oder `?theme=comedy` aktiviert. Ohne Parameter
bleibt der bisherige Stil aktiv, bis der neue Slice visuell freigegeben ist.

- zentrale Theme-Auswahl: `src/config/VisualTheme.ts`
- HUD-Theme und SVG-Icons: `src/styles.css`, `src/ui/HudController.ts`
- Terrain-, Raum- und Ressourcenbasis: `public/assets/generated/style-b-v1/`
- Herz-, Diener- und Startdekor-Slice: `public/assets/generated/style-b-v2/`
- 2.5D-Wände, Materialböden, Bodendecals und Herzfassung:
  `public/assets/generated/style-b-v3/`
- reproduzierbare Builds: `scripts/asset_tools/build_style_b_v1.py` und
  `scripts/asset_tools/build_style_b_v2.py` sowie
  `scripts/asset_tools/build_style_b_v3.py`
- Imagegen-Master und freigestellte Quellen: jeweils unter `sources/`

Der zweite Slice baut das Herz als Architektur aus vier Teilen auf: begehbarer
Sockel, fest montierte Rückwand, kleiner lebender Kern und Leitpult. Arbeiter,
Wächter und Fernkämpfer teilen eine verbindliche Covenant-Silhouette. Lampen,
Banner, Regal, Karren, Vorräte und Planwand verdichten den Startbereich; mehrere
Pilzgruppen und eine Sammelstation machen die bereits ausgegrabene Grotte vor
dem Durchbruch verständlich. Noch nicht neu produzierte Räume, Gegner und Waren
verwenden bewusst die bisherigen Assets als Fallback.

### Style-B-V3: räumliche Kartenarchitektur

Der dritte Pass ersetzt die flache Kartenwirkung durch ein gerichtetes
Wandmodul-System. Vier gerade Kanten und vier separat gezeichnete L-Ecken
besitzen eine helle Steinkappe, eine sichtbare dunkle Wandstirn und einen
Kontaktschatten. Der Renderer setzt an Sackgassen zwei Ecken und an isolierten
Feldern vier Ecken, sodass auch Drei- und Vierfachanschlüsse keine transparenten
Quadrate hinterlassen. Bekannte Style-B-Zielräume verwenden vollständige
rechteckige Grundrisse; ihre vier Eckfelder werden nicht mehr ausgespart.

Großformatige Materialflächen liefern cobaltfarbenen Fels, Grabungsboden,
pflaumenfarbenen Covenant-Stein und feuchten Grotto-Boden. Das Pilzbiom beginnt
erst hinter einem blauen Puffer östlich des Herzraums. Bodendecals ergänzen
Schutt, Werkzeugspuren, Covenant-Einlage, Moos, Sporen und Pfütze, ohne das
Raster zu betonen. Der Herzraum ist 15 × 11 Felder groß, seine Dekoration folgt
dem Rand, und Arbeiter starten auf sicheren Innenfeldern. Der rote Herzkern
sitzt zwischen fester Rückplatte und Vorderfassung und liest sich dadurch als
Teil eines Gebäudes statt als aufgesetzte Figur. Die alte orange Besitzkontur
entfällt in Style B; Material und Architektur vermitteln Besitz bereits klar.

## Freigabekriterien für den nächsten Produktionsschritt

1. Herz-Hauptquartier, Dienerrollen und Pilzgrotte sind innerhalb von fünf
   Sekunden erkennbar.
2. Das Zielpanel konkurriert nicht mit dem Herzraum.
3. Die Pilzgrotte wirkt erreichbar und attraktiv, ohne bereits als Eigentum zu
   erscheinen.
4. Figuren bleiben bei Zoom 0,8, 1,0 und 1,2 unterscheidbar.
5. Der Slice funktioniert bei `1366×768`, `1024×576` und `844×390`.
6. Build und Tests bleiben grün; auf einem durchschnittlichen Tablet werden
   weiterhin 60 FPS angestrebt.
7. Erst nach direkter Vorher-/Nachher-Freigabe wird Style B Standard.

## Danach

Nach Freigabe folgen in dieser Reihenfolge: Bewegungs- und Arbeitsanimationen
für die drei Covenant-Silhouetten und den Herzkern; alle sechs Räume; Waren und
Produktionsfeedback; Hexbinder und Inquisitor-Rekrut; Untergrundfraktion;
Inquisition; Kampf- und Schadenseffekte.
