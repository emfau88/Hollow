# Asset-Manifest

**Stand:** 31. Juli 2026

| Quelle | Rolle | Status |
|---|---|---|
| Imagegen-Masterassets | Fels, Böden, Wandkanten, Besitzränder, Raumprops, Einheiten, Gegner, Waren, Falle, Gefangener, Kartenherz | integriert |
| Eigene bestehende Rasterassets | detailliertes Covenant-Herz, Ressourcenquellen | integriert/Reserve |
| Prozedurale Phaser-Grafik | Marker, Statusringe, Feedback und Effekte | integriert |
| WebAudio-Oszillatoren | UI, Alarm, Produktion, Herz | integriert |

## Terrain V3

Finale Laufzeitassets:

- `public/assets/generated/terrain-v3/rock-top.png`
- `public/assets/generated/terrain-v3/rock-basalt.png`
- `public/assets/generated/terrain-v3/rock-damp.png`
- `public/assets/generated/terrain-v3/rock-roots.png`
- `public/assets/generated/terrain-v3/rock-earth.png`
- `public/assets/generated/terrain-v3/raw-floor.png`
- `public/assets/generated/terrain-v3/claimed-corridor.png`
- `public/assets/generated/terrain-v3/claimed-floor.png`
- `public/assets/generated/terrain-v3/wall-edge.png`
- `public/assets/generated/terrain-v3/wall-corner.png`
- `public/assets/generated/terrain-v3/claimed-border.png`
- `public/assets/generated/terrain-v3/enemy-border.png`

Alle Surface-Sheets verwenden finale 32×32-Pixel-Frames in einem 16×16-Zyklus.
Es findet keine krumme 24→28- oder 64→28-Skalierung mehr statt. Rohboden und
Covenant-Boden wurden für bessere Spiellesbarkeit neu graduiert; Wandlippen
sind bewusst kühl-neutral, damit Gold ausschließlich Besitz kommuniziert.

World Composition V4 nutzt die bereits vorhandenen Foundation-V2-
Imagegen-Quellen für regionale Geologie. `claimed-corridor.png` wird
reproduzierbar aus den bestehenden Rohboden- und Covenant-Mastern abgeleitet.
Es waren keine weiteren Imagegen-Aufrufe notwendig.

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

## Units V1

Vier Imagegen-Masterbilder liefern die aktiven Bitmap-Assets für:

- Arbeiter, Guard, Archer, Hexbinder und rekrutierten Inquisitor
- Höhlenkriecher, Zwergenminer und Zwergenarmbrustschütze
- Adept, Captain, Scout und Warden der Inquisition
- Roherz, Biomasse, Essenz, Metall, Rationen und Rüstungsgüter
- Bolzenfalle und gefangenen Inquisitor

Die Laufzeit-PNGs liegen unter `public/assets/generated/units-v1/`. Quellen und
Chroma-Key-Zwischenstände bleiben unter `sources/` erhalten. Der reproduzierbare
Zuschnitt erfolgt über `scripts/process_unit_assets.py`. Die vorherigen
prozeduralen Figuren- und Warenplatzhalter wurden aus dem aktiven Startpfad
entfernt.

## Covenant-Herz Gameplay V2

Das aktive Kartenherz liegt als `covenant-heart-gameplay-256.png` vor. Es wurde
in einem einzelnen Imagegen-Aufruf speziell für eine Darstellungsgröße von
64–96 Bildschirmpixeln entworfen, lokal per Chroma-Key freigestellt und auf
256×256 Pixel reduziert. Vier große Eisenpranken, eine breite goldene Innenkante
und ein deutlich größerer roter Kern ersetzen das filigrane, bei Kartenzoom
kaum lesbare Motiv. `covenant-heart.png` bleibt als Detailmotiv für spätere
Dialog- oder Porträtansichten erhalten.
Die unveränderte Grün-Key-Quelle liegt unter
`public/assets/generated/heart-v2/sources/`.

## Style B V1 – Dungeon Administration

Der optionale Vertical Slice unter `?theme=style-b` verwendet einen getrennten
Asset-Namespace unter `public/assets/generated/style-b-v1/`. Dadurch bleiben
die bisherigen Produktionsassets vollständig als Vergleich und Fallback
erhalten.

Neu integriert sind:

- blau abgestimmte Terrain-Sheets für Fels, Rohboden, Covenant-Boden, Kanten
  und Besitzränder;
- ein humorvolles Bürokraten-Herz, Arbeiter und Startwache;
- Lager, Pilzkessel und Werkbank;
- Pilzcluster, Erzader, erschöpfte Erzader und Essenzsiegel;
- eine kombinierte Vorschau unter `style-b-v1-preview.png`.

Die Imagegen-Master und Chroma-Key-Zwischenstände liegen unter
`style-b-v1/sources/`. `scripts/asset_tools/build_style_b_v1.py` erzeugt daraus
deterministisch alle Laufzeitgrößen und graduiert die vorhandenen 32-Pixel-
Terrain-Sheets in die neue Palette. Noch nicht produzierte Einheiten, Räume und
Waren greifen im Style-B-Slice auf ihre bisherigen Assets zurück.

## Style B V2 – Herzraum und Pilzgrotte

Der zweite Style-B-Pass liegt getrennt unter
`public/assets/generated/style-b-v2/` und ersetzt im Style-B-Modus gezielt die
kritischen Startbereichsmotive:

- Herz-Hauptquartier aus `base`, `backplate`, `core` und `pulpit`;
- gemeinsame nichtmenschliche Covenant-Silhouette für Arbeiter, Wächter und
  Fernkämpfer;
- Lampen, Banner, Ressourcenregal, Karren, Vorräte und Planwand;
- kleine und mittlere Pilzgruppen sowie eine Grotto-Sammelstation;
- kombinierte visuelle Abnahme unter `style-b-v2-preview.png`.

Die drei unveränderten Masterbilder und ihre freigestellten Zwischenstände
liegen unter `style-b-v2/sources/`. Der reproduzierbare Zuschnitt erfolgt über
`scripts/asset_tools/build_style_b_v2.py`. V1 bleibt als nachvollziehbare
Zwischenstufe und Fallback vollständig erhalten.

## Nicht integriert

`wall-concept-unused.png` wurde bewusst nicht verwendet, weil die Perspektive
nicht zur orthogonalen Spielkarte passt. Es bleibt ausschließlich als
dokumentierte Imagegen-Quelle erhalten.

## Style B V3 – räumliche Karte

Der dritte Style-B-Pass liegt unter `public/assets/generated/style-b-v3/`:

- `walls/`: vier gerichtete gerade Wandmodule und vier vollständige L-Ecken;
- `terrain/`: cobaltfarbener Fels, Grabungs-, Covenant- und Grotto-Boden sowie
  die weiterhin benötigten Fallback-Materialien;
- `decals/`: Schutt, Grabungsspur, Covenant-Einlage, Moos, Sporen und Pfütze;
- `heart/`: architektonische Rückplatte und vordere Klemmfassung;
- `style-b-v3-preview.png`: kombinierte visuelle Assetabnahme.

Die vier unveränderten Masterbilder und ihre freigestellten Zwischenstände
liegen unter `style-b-v3/sources/`. `scripts/asset_tools/build_style_b_v3.py`
schneidet sie reproduzierbar zu, erzeugt 32-Pixel-Terrainatlanten und ordnet
die beiden mittleren Eckzellen des generierten Wandbogens explizit als SW und
ES zu. Diese feste Zuordnung verhindert gespiegelte L-Ecken.
