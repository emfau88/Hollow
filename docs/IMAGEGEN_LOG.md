# Imagegen-Log

**Stand:** 31. Juli 2026
**Ursprünglicher Terrain-/Raum-Pass:** 6 von maximal 6 Generierungen
**Aktueller Gameplay-Herz-Pass:** 1 Generierung

Alle Aufrufe nutzten das integrierte Imagegen-Werkzeug. Covenant-Herz und
Ressourcen-Vorschau dienten ausschließlich als Stilreferenzen. Die finalen
Spielassets wurden lokal zugeschnitten, farblich kalibriert, auf 32-Pixel-Frames
reduziert und als PNG-Dateien gespeichert.

| Nr. | Zweck | Masterdatei | Ergebnis |
|---:|---|---|---|
| 1 | Nahtlose Felsoberfläche | `terrain-v3/sources/rock-top-master.png` | integriert |
| 2 | Nahtloser ausgegrabener Rohboden | `terrain-v3/sources/raw-floor-master.png` | integriert |
| 3 | Nahtloser Covenant-Dungeonboden | `terrain-v3/sources/claimed-floor-master.png` | integriert |
| 4 | Erster Wandkonzeptbogen | `terrain-v3/sources/wall-concept-unused.png` | verworfen: zu perspektivisch |
| 5 | Orthogonale Wandkanten und Besitzränder | `terrain-v3/sources/edges-and-borders-master.png` | integriert |
| 6 | Raumobjekte: Bett, Kessel, Ofen, Werkbank, Gitter, Lager | `room-props-v3/sources/room-props-master.png` | integriert |

## Promptzusammenfassungen

1. Ruhige, große, nahtlose Felsplatten in orthogonaler Draufsicht; geringe
   Mikrostruktur; klare Trennung von dunklem Laufboden.
2. Sehr dunkle, matte Graberde mit wenigen Werkzeugspuren; nahtlos und ohne
   Steinplatten oder Objekte.
3. Geordneter Covenant-Boden aus dunklem Werkstein mit sparsamen Messing- und
   Burgundakzenten; nahtlos und ohne dominantes Emblem.
4. Modulare Dungeonwand mit dunklem Stein und Messing. Das Ergebnis wurde wegen
   frontaler/isometrischer Perspektive nicht verwendet.
5. Flache 90-Grad-Draufsicht: natürliche Felskante, passende Ecke,
   Covenant-Messingrand und feindlicher Eisen-/Rotrand auf Magenta-Key.
6. Striktes 3×2-Prop-Sheet auf Magenta-Key mit sechs isolierten,
   maßstäblich konsistenten Raumobjekten.

## Lokale Aufbereitung

`scripts/asset_tools/build_terrain_v3.py` erzeugt reproduzierbar:

- drei kontinuierliche 8×8-Surface-Sheets mit 32×32-Pixel-Frames;
- Wandkante und Wandecke;
- Covenant- und Feind-Besitzrand;
- sechs freigestellte Raumprops;
- zwei Vorschau-PNGs für visuelle Kontrolle.

Die sichtbaren Terrainformen stammen aus diesen PNG-Assets. Der Renderer wählt
lediglich Frames, Rotationen und Zustandsränder aus.

## Gameplay-Herz V2 – 26. Juli 2026

Ein zusätzlicher, späterer Polish-Pass erzeugte genau ein neues Bild:

- orthogonale Draufsicht;
- vier große Eisen-/Goldformen statt Filigran;
- roter Kern mit rund 40 Prozent Motivbreite;
- starke eingebrannte Außenkontur;
- flacher Grün-Key, lokal entfernt;
- finales Laufzeitasset: `public/assets/generated/covenant-heart-gameplay-256.png`.

Der vollständige Prompt verlangte ausdrücklich Lesbarkeit bei 64–96 Pixeln,
keine Ketten, keine kleinen Spitzen, keine Umgebung und keine Schrift. Verwendet
wurde das integrierte Imagegen-Werkzeug; die lokale Aufbereitung erfolgte mit
dem Chroma-Key-Helfer des Imagegen-Workflows.

## Style B V1 – 31. Juli 2026

Für den kontrollierten Style-B-Slice wurden drei zusätzliche integrierte
Imagegen-Aufrufe verwendet:

| Nr. | Zweck | Masterdatei | Verwendung |
|---:|---|---|---|
| 1 | Produktionsnahes Styleframe auf realer Karten- und HUD-Dichte | `docs/mockups/HOLLOW_COVENANT_STYLE_B_PRODUCTION_FRAME.png` | Zielbild und Reviewreferenz |
| 2 | Herz, Arbeiter und Wächter auf Magenta-Key | `style-b-v1/sources/characters-master.png` | drei aktive Laufzeitassets |
| 3 | Lager, Kessel, Werkbank, Pilze, Erz und Essenz auf Magenta-Key | `style-b-v1/sources/props-resources-master.png` | sechs aktive Laufzeitassets plus erschöpfte Erzvariante |

Das Styleframe verwendet den aktuellen Gameplay-Screenshot als verbindliche
Layoutreferenz und Mockup B ausschließlich als Stilreferenz. Die beiden
Asset-Sheets verlangen eine einheitliche Draufsicht, große Silhouetten,
dunkelblaue Konturen, Creme/Messing/Koralle/Mint sowie einen vollständig flachen
Magenta-Hintergrund ohne Schatten. Die Freistellung erfolgte mit dem lokalen
Chroma-Key-Helfer. Zuschnitt, Skalierung, Schärfung, Terrain-Grading und Preview
sind über `scripts/asset_tools/build_style_b_v1.py` reproduzierbar.

## Style B V2 – 31. Juli 2026

Drei weitere Imagegen-Aufrufe wurden für den echten Neuaufbau von Herzraum und
Pilzgrotte verwendet:

| Nr. | Zweck | Masterdatei | Verwendung |
|---:|---|---|---|
| 1 | mehrteiliger Herz-Architekturbausatz | `style-b-v2/sources/heart-building-master.png` | Sockel, Rückwand, Kern und Leitpult |
| 2 | Covenant-Diener-Silhouetten | `style-b-v2/sources/servants-master.png` | Arbeiter, Wächter und Fernkämpfer |
| 3 | Startbereich- und Pilzgrotte-Dekor | `style-b-v2/sources/start-decor-master.png` | neun aktive Dekorassets |

Der Herz-Prompt verlangte vier strikt getrennte Architekturteile, einen kleinen
gliedmaßenlosen Kern und eine fest montierte Rückwand mit leerer Fassung. Der
Diener-Prompt schloss menschliche Gesichter, Haut, Nasen, Münder und Bärte aus
und definierte kurze Masken-Homunkuli, deren Rollen allein an Werkzeug, Schild
oder Armbrust erkennbar sind. Der Dekor-Prompt definierte ein exaktes 3×3-Sheet
aus Lampen-, Verwaltungs-, Transport- und Pilzmotiven. Alle Master nutzen einen
flachen `#ff00ff`-Hintergrund. Chroma-Key, manuelle Regionszuschnitte,
Laufzeitskalierung und Preview sind über
`scripts/asset_tools/build_style_b_v2.py` reproduzierbar.

## Style B V3 – 31. Juli 2026

Vier Imagegen-Aufrufe erzeugten die räumliche Kartenebene. Alle transparenten
Motive wurden auf einem flachen `#ff00ff`-Hintergrund angefordert und lokal per
Chroma-Key freigestellt.

| Nr. | verwendeter Prompt (kompakt) | Masterdatei | Verwendung |
|---:|---|---|---|
| 1 | Exakter 4×2-Bogen aus N/E/S/W-Wandsegmenten und NE/ES/SW/WN-L-Ecken; orthogonale Draufsicht mit flacher 2.5D-Steinkappe, dunkler Stirn, Kontaktschatten und sparsamen Messingankern | `style-b-v3/sources/wall-kit-master.png` | acht gerichtete Wandmodule |
| 2 | Exakter 2×2-Bogen aus cobaltfarbenem Fels, ausgegrabenem Boden, pflaumenfarbenem Covenant-Stein und mintfeuchtem Grotto-Boden; handgemalte große Formen, keine Objekte oder Schrift | `style-b-v3/sources/terrain-materials-master.png` | vier plastische Materialfamilien |
| 3 | Exakter 3×2-Bogen aus Schutt, Werkzeug-/Grabungsspur, Covenant-Einlage, Moos, Sporen und Pfütze; orthogonal, niedrig, freigestellt und ohne Gebäude | `style-b-v3/sources/ground-decals-master.png` | sechs Bodendecals |
| 4 | Exakter 2×1-Bogen aus symmetrischer leerer Herz-Rückplatte und vorderer Klemmfassung; Messing, Stein, keine Figur, kein Kern und keine Schrift | `style-b-v3/sources/heart-mount-master.png` | Kern zwischen zwei Architekturebenen eingebettet |

Die Laufzeitassets und die kombinierte Vorschau erzeugt
`scripts/asset_tools/build_style_b_v3.py`. Die unveränderten Masterdateien
bleiben als Herkunftsnachweis erhalten.
