# Hollow Covenant Terrain v2 – direkt einbindbar

Dieses Paket ist das technische Terrainset für das aktuelle Repo.

## Format
- 28×28 px pro Frame
- 0 px spacing
- 0 px margin
- PNG RGBA
- Phaser 3.90 kompatibel
- Wandkanten transparent
- passend zu `BALANCE.tileSize = 28`

## Visuelle Zustände
- `ROCK_*` = massiver/unberührter Fels
- `RAW_GROUND_*` = frisch gegrabener, roher Gang
- `CLAIMED_FLOOR_*` = beanspruchter Standard-Dungeonboden
- `ROOM_*` = funktionscodierte Raumböden
- `WALL_*` = transparente Wandkanten über offenen Feldern
- `ROCK_IRON_*`, `ROCK_FUNGUS_HINT`, `ROCK_ESSENCE_HINT` = gezielte Ressourcensuche

## Phaser

```ts
this.load.spritesheet('hollow-terrain', 'assets/hollow/hollow_terrain_28.png', {
  frameWidth: 28,
  frameHeight: 28,
  spacing: 0,
  margin: 0,
});
```

Das `HollowTerrainFrames.ts` unverändert nach `src/config/` legen.

## Renderreihenfolge
1. Base tile
2. `WALL_*` Overlay
3. Ressourcenknoten / Raumobjekte
4. Einheiten
5. Status/HUD

## Wichtig für die aktuelle `drawWorld()`-Logik
Die bisherigen `Graphics.fillRect()`-Flächen für Fels/Boden/Räume durch Image-Frames ersetzen. Die deterministische Variante sollte aus `(x,y)` berechnet werden, damit die Textur beim Redraw nicht springt.

Empfohlen:
- Fels: 3 Hauptvarianten; `DAMP`/`MOSS` selten beimischen
- roher Gang: 6 Varianten
- Raum: genau den passenden `ROOM_*`-Frame über die gesamte Raumfläche
- Wandkante: pro offenem Tile die vier Felsnachbarn prüfen und entsprechende transparente Kanten auflegen

Die Vorschau `hollow_terrain_ingame_preview_2x.png` wurde ausschließlich aus den finalen 28×28 Frames dieses Pakets gebaut.
