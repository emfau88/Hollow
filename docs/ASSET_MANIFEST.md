# Asset-Manifest

**Stand:** 23. Juli 2026

| Quelle | Rolle | Status |
|---|---|---|
| Imagegen-Masterassets | Fels, Rohboden, Covenant-Boden, Wandkanten, Besitzränder, Raumprops | integriert |
| Eigene bestehende Rasterassets | Covenant-Herz, Ressourcenquellen | integriert |
| Prozedurale Phaser-Grafik | Einheiten-Platzhalter, Marker, Feedback und Effekte | integriert |
| WebAudio-Oszillatoren | UI, Alarm, Produktion, Herz | integriert |

## Terrain V3

Finale Laufzeitassets:

- `public/assets/generated/terrain-v3/rock-top.png`
- `public/assets/generated/terrain-v3/raw-floor.png`
- `public/assets/generated/terrain-v3/claimed-floor.png`
- `public/assets/generated/terrain-v3/wall-edge.png`
- `public/assets/generated/terrain-v3/wall-corner.png`
- `public/assets/generated/terrain-v3/claimed-border.png`
- `public/assets/generated/terrain-v3/enemy-border.png`

Alle Surface-Sheets verwenden finale 32×32-Pixel-Frames in einem 16×16-Zyklus.
Es findet keine krumme 24→28- oder 64→28-Skalierung mehr statt. Rohboden und
Covenant-Boden wurden für bessere Spiellesbarkeit neu graduiert; Wandlippen
sind bewusst kühl-neutral, damit Gold ausschließlich Besitz kommuniziert.

## Raumprops V3

- Bett
- Pilzkessel
- Schmelzofen
- Werkbank
- Gefängnisgitter
- Lagerkisten und Fass

Die ursprünglichen Magenta-Key-Masterdateien sowie die freigestellten
Zwischenstände bleiben zur Reproduzierbarkeit unter den jeweiligen
`sources/`-Ordnern erhalten.

## Nicht integriert

`wall-concept-unused.png` wurde bewusst nicht verwendet, weil die Perspektive
nicht zur orthogonalen Spielkarte passt. Es bleibt ausschließlich als
dokumentierte Imagegen-Quelle erhalten.
