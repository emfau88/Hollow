# Entscheidung: 2.5D-Geometrie statt Wand-Spriteatlas

## Ausgangsproblem

Die bisherige Style-B-Darstellung baute Wände aus überlappenden 2D-Komplettbildern. Für Geraden, Innen- und Außenecken, T-Stücke, Kreuzungen, schmale Gänge und Verdeckung waren jeweils passende Atlasbilder nötig. Die vorhandenen Assets besaßen dafür weder eine vollständig konsistente Topologie noch zuverlässige Vordergrundmasken. Dadurch entstanden trotz wiederholter Atlas- und Sortierkorrekturen sichtbar falsche Anschlüsse und Verdeckungen.

## Was die Tests gezeigt haben

- Weitere Varianten desselben 2D-Atlas-Ansatzes lösen das Grundproblem nicht zuverlässig.
- Ein orthografischer 3D-Test mit echten Böden und Grenzwänden erzeugt beliebige Kurven, Ecken, T-Stücke und Kreuzungen automatisch korrekt.
- Figuren, Herz und Raumobjekte können bei fester Kamera weiterhin als günstige 2D-Sprites verwendet und vom Tiefenpuffer korrekt verdeckt werden.
- Die ersten Geometrietests waren optisch zu technisch; das war ein Asset- und Proportionsproblem, kein erneutes Topologieproblem.

## Eingeschlagener Lösungsweg

Hollow Covenant verwendet für den neuen visuellen Pfad einen Hybridaufbau:

1. Boden, Felsgrenzen und Wände sind echte, aus der Zellkarte erzeugte 3D-Geometrie.
2. Eine kleine modulare Wandfamilie liefert Fuß, Wandkörper, Decklage und Eckpfeiler; Bilder bestimmen nur die Oberfläche.
3. Kamera und Kartenachsen bleiben für Mobile fest und klar lesbar.
4. Vorhandene Figuren, Herz-, Ressourcen- und Raumobjekte bleiben 2D-Sprites, solange keine freie Kameradrehung benötigt wird.
5. Spielregeln, Raumdefinitionen, Kosten und Rezepte werden aus dem bestehenden Spiel weiterverwendet.
6. Graben und Raumerrichtung bleiben Arbeiteraufträge mit Bauzeit und den bestehenden komplementären Arbeitsprioritäten; sie erscheinen nicht sofort durch die Eingabe.
7. `GameScene` ist der kanonische Zustand. Alternative Renderer konsumieren ausschließlich dessen `AutomationState`-/`CanonicalGameState`-Projektion; `GeometrySandboxModel` wird nicht um fehlende Kampagnenlogik erweitert.

## Konsequenz

Das Spiel muss nicht vollständig neu entwickelt werden. Ersetzt werden Renderer und Terrain-Assetpipeline. Die bestehende Simulation bleibt kanonisch und ist über `spatial-prototype.html` bereits live an den Geometriepfad angebunden. `geometry-sandbox.html` und `geometry-proof.html` bleiben eingefrorene Präsentations- und Diagnosenachweise, nicht Orte für neue Spielregeln. Details und Großszenen-QA stehen in [CANONICAL_GEOMETRY_INTEGRATION.md](CANONICAL_GEOMETRY_INTEGRATION.md).
