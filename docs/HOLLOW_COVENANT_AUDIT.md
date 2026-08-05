# Hollow Covenant – laufender Audit- und Umsetzungsstand

**Prüfstand:** 5. August 2026

**Historische Quelle:** [HOLLOW_COVENANT_AUDIT_SOURCE_2026-08-05.md](HOLLOW_COVENANT_AUDIT_SOURCE_2026-08-05.md)

**Geltungsbereich:** Three.js-Geometriepfad, Visual-Truth-Szene, parallele
Spielzustände und aktive Assetpfade

## Zweck und Pflegevertrag

Dieses Dokument ist die aktuelle, gegen das Repository geprüfte Fassung des
externen Audits. Die Quelldatei bleibt unverändert erhalten, damit spätere
Änderungen nicht rückwirkend die ursprüngliche Diagnose verfälschen.

Bei Änderungen an Renderer, Licht, Materialien, Kamera, Assetfamilien oder
`GeometrySandboxModel` muss die passende Zeile der Statusmatrix aktualisiert
werden. Aussagen ohne aktuelle Codebasis dürfen nicht still als Ist-Zustand
stehen bleiben.

Statuswerte:

- **bestätigt:** Aussage trifft weiterhin zu;
- **umgesetzt:** die empfohlene Korrektur ist im aktuellen Stand vorhanden;
- **teilweise:** wesentliche Teile sind erledigt, Restarbeit ist benannt;
- **überholt:** historisch korrekt oder plausibel, beschreibt aber nicht mehr
  den aktuellen Code;
- **offen:** noch nicht entschieden oder umgesetzt.

## Kurzurteil

Die technische Grunddiagnose des Audits ist sinnvoll: echte Geometrie ist für
die Wandtopologie der richtige Weg, während das parallel gewachsene
`GeometrySandboxModel` weiterhin das größte Architektur- und Wartungsrisiko
darstellt.

Die damalige optische Ist-Diagnose ist dagegen zu großen Teilen überholt.
Lichtverhältnis, Exposure, Felsemission, Wandtransparenz, Standardstil,
Mobile-Schatten, Felsmasse und Visual-Truth-Kamera wurden inzwischen gezielt
korrigiert. `GameScene` ist inzwischen formal und technisch als kanonischer
Spielzustand festgelegt; der vorhandene Live-Adapter versorgt den
Three.js-Renderer über `AutomationState-v1`. Offen bleibt vor allem ein
verbindlicher Lebenszyklus für historische Assets.

## Nachgemessener technischer Stand

| Gegenstand | Audit-Angabe | Aktueller Stand | Bewertung |
|---|---:|---:|---|
| `geometry-sandbox-main.ts` | ca. 2.160 Zeilen | 2.680 Zeilen | Audit-Zahl überholt; Datei ist weiterhin zu groß |
| `GeometrySandboxModel.ts` | ca. 770 Zeilen | 778 Zeilen | bestätigt; fünf Zeilen Einfrierhinweis ergänzt |
| `geometrySandbox.test.ts` | mehr als 300 Zeilen | 234 Zeilen | Audit-Zahl nicht bestätigt |
| kanonischer Spatial-Renderer | nicht betrachtet | 1.069 Zeilen | bestehender Adapterpfad modernisiert |
| Kampagnen-Renderfixture | nicht vorhanden | 217 Zeilen | reiner kanonischer Datenzustand, keine Simulation |
| Rendererentscheidung | 27 Zeilen | 27 Zeilen | bestätigt |
| Visual-Style-B-Vertrag | 255 Zeilen | 255 Zeilen | bestätigt |
| Golden-Wall-Vertrag | 182 Zeilen | 182 Zeilen | bestätigt |
| Wand-Asset-Chronik | 505 Zeilen | 505 Zeilen | bestätigt |
| sechs zentrale Assetbuildskripte | 1.986 Zeilen | 1.986 Zeilen | bestätigt |
| Bilddateien unter `public/assets` | mehr als 150 | 252 | Grundbefund bestätigt, Zahl aktualisiert |

Gezählt wurden physische Zeilen am 5. August 2026. Bei den Bilddateien zählen
PNG, JPEG, WebP und GIF. Die Paketstände sind Phaser 3.90.0, Three.js
0.185.x, TypeScript 5.8.x, Vite 7.0.x und Vitest 3.2.x.

## Geprüfte Statusmatrix

| Auditpunkt | Status | Aktueller Nachweis und Umsetzung |
|---|---|---|
| Echte Geometrie statt vollständiger Wand-Sprites | **bestätigt** | Instanzierte Böden, Wandlagen, Kappen, Ecken und Schwellen lösen die Topologie im Geometry-Pfad. |
| Parallele Gameplayimplementierung | **bestätigt / eingedämmt** | `GeometrySandboxModel.ts` besitzt weiterhin eigene Gameplayteile, ist nun aber als historischer Präsentationsproof eingefroren. Der Produktionspfad verwendet den vorhandenen Adapter auf `GameScene`. |
| Renderkonfiguration aus der Hauptdatei auslagern | **offen** | Kamera, Renderer, Materialien und Lichter stehen weiterhin in der 2.609 Zeilen großen `geometry-sandbox-main.ts`. |
| Zu hohes globales Fülllicht | **umgesetzt** | Ambient 0,22 + Hemisphere 0,72 gegenüber Key 3,25 ergibt ca. 3,46:1 statt der auditierten 1,34:1. ACES bleibt aktiv, Exposure ist 1,0. |
| Mobile ohne gerichtete Schatten | **umgesetzt** | Das Key-Light wirft auch mobil Schatten; Mobile verwendet eine 512er Shadowmap. Kurze Wand- und Sprite-Kontaktschatten ergänzen die Tiefenwirkung. |
| Selbstleuchtender Normalfels | **umgesetzt** | Bedrock und geschlossene Felsmaterialien verwenden Emissive-Intensität 0. Emission bleibt auf echte Leuchtobjekte und kleine gezielte Akzente begrenzt. |
| Zu helle, graue Felsbasis | **teilweise umgesetzt** | Abgrund `#071427` und Bedrock `#20314E` entsprechen der Style-B-Palette. Rohboden und regionale Geologie sind deutlich dunkler als im Audit, benötigen aber noch die finale Farbkorrektur. |
| Dauerhaft transparente Geologie- und Vorderwände | **umgesetzt** | Geologiematerialien und Vorderwand-Klone sind opak, schreiben Tiefe und werden nicht mehr pauschal richtungsabhängig transparent. Selektive Figurenverdeckung ist noch kein eigenes System. |
| Falscher Standardstil `clean` | **umgesetzt** | Der Standardwert ist `surfaceStyle = 'project'`; Visual Truth erzwingt zusätzlich den Style-B-Vergleichszustand. |
| Kamera bei ca. 59 Grad | **teilweise / bewusst getrennt** | Die normale Sandbox bleibt bei ca. 59 Grad. Visual Truth verwendet nach Browservergleich ca. 53 Grad, damit Wandfassaden sichtbar bleiben. Der alte Golden-Atlas ist nur Material- und Kompositionsreferenz. |
| Geschlossener Fels als niedriger Brocken-Teppich | **weitgehend umgesetzt** | Geschlossene Zellen bilden einen 0,76 Einheiten hohen Bedrockkörper; Visual Truth besitzt zusätzlich eine zusammenhängende Oberseite und nur wenige Silhouettenakzente. |
| Eskalierte Assetpipeline | **bestätigt / offen** | Die Vielzahl historischer Familien besteht weiterhin. Zwei eng begrenzte Visual-Truth-Oberflächen wurden dokumentiert ergänzt; ein vollständiges Aktiv/Referenz/Archiv-Manifest fehlt. |
| Keine weitere Renderer-Variante | **eingehalten** | Die Arbeit erweitert ausschließlich den vorhandenen Geometry-Pfad und dessen isolierten Visual-Truth-Zustand. |
| Keine neuen Sandbox-Gameplayfeatures | **eingehalten und festgeschrieben** | `GeometrySandboxModel` trägt einen Deprecation-/Einfrierhinweis. Visual-Truth-Zustand und große Kampagnenfixture ordnen nur Daten für visuelle QA an und fügen keine Regeln hinzu. |
| Kanonischen Spielzustand festlegen | **umgesetzt** | `GameScene` ist alleinige Wahrheit; `AutomationState`/`CanonicalGameState` ist der renderer-neutrale Vertrag. `GameSimulationBridge` speist den Three.js-Renderer live aus dieser API. |
| Repräsentative Großszene | **umgesetzt** | Die Kampagnen-Renderfixture enthält sechs Räume, Ein-/Zweifeldgänge, Kreuzungen, vier Regionen, Ressourcen, 8 Arbeiter, 6 Truppen und 8 Gegner im kanonischen Schema. |
| Präsentation auf kanonischen Renderer übertragen | **umgesetzt** | 53-Grad-Kamera, Lichtverhältnis, Mobile-Schatten, hohe Felsmasse, helle modulare Wände, Einfeldgang-Cutaway und Spriteanker laufen nun in `spatial-prototype.html`. |
| Alte Pfade formell einfrieren | **offen** | Frühere Assets sind überwiegend inaktiv, aber noch nicht vollständig als Referenz oder Archiv markiert und nicht aus allen normalen Produktionspfaden ausgeschlossen. |

## Seit dem Audit konkret umgesetzt

1. Reproduzierbarer Visual-Truth-Zustand für Herzraum, Gang und Pilzgrotte,
   ausdrücklich ohne neue Gameplayregeln.
2. Licht auf ein belastbares Key-zu-Fill-Verhältnis gebracht und Exposure auf
   1,0 gesetzt.
3. Normale Felsemission entfernt sowie Geologie und Vorderwände opak gemacht.
4. Projektbezogene Style-B-Oberfläche als Standard gesetzt.
5. Mobile Directional Shadows sowie kurze, einheitliche Kontaktflächen für
   Wände, Figuren und bodengebundene Props ergänzt.
6. Geschlossene Felsfläche zu einer hohen Masse mit ruhiger, durchgehender
   Visual-Truth-Oberseite umgebaut.
7. Modulare Wandfamilie mit separatem Sockel, Fassadenlagen, Kappen,
   Innen-/Außenecken, niedrigeren Gangwangen und gebauten/natürlichen
   Übergängen umgesetzt.
8. Maßstab, Bodenanker und Kontaktschatten der vorhandenen Figuren und Props in
   einem gemeinsamen Präsentationsvertrag normalisiert.
9. Visual-Truth-Kamera von einer zu steilen Ansicht auf etwa 53 Grad abgesenkt.
10. `GameScene` und seine `AutomationState-v1`-Projektion als kanonische
    Zustandsquelle dokumentiert und an den Geometry-Renderergrenzen als
    `CanonicalGameState` benannt.
11. `GeometrySandboxModel` als historischen Präsentationsproof eingefroren;
    fehlende Kampagnenfunktionen werden dort nicht weiter nachgebaut.
12. Wand-, Schatten-, Kamera- und Sprite-Präsentation auf den bereits live mit
    dem Hauptspiel verbundenen Spatial-Renderer übertragen.
13. Große Kampagnen-Renderfixture mit sechs Raumtypen, Kreuzungen, Ressourcen,
    Arbeitern, Truppen und Gegnern erstellt.
14. Desktop-, Detail-, Mobil- und Live-Browser-QA durchgeführt; der echte
    Grabungsablauf öffnete dabei nach Start ein reales Felsfeld.

## Weiter offene Entscheidungen und Arbeiten

1. **Renderkonfiguration extrahieren:** Kamera-, Licht-, Schatten- und
   Materialpresets aus der großen Hauptdatei lösen und mit einem festen
   Visual-Truth-Preset absichern.
2. **Assetlebenszyklus festschreiben:** Jede Familie als `active`, `reference`
   oder `archived` markieren; historische Atlanten nicht mehr versehentlich
   als Produktionspfad auswählbar machen.
3. **Großszenen-Assetpass:** modulare Raum-Dressingsets, regionale
   Höhlenrand-/Decalsets und die verbleibenden 64-Pixel-Figuren priorisieren.
4. **Visual-Truth-Gate abschließen:** Aktions-/Atmosphäreneffekte und
   endgültige HUD-Typografie/Iconqualität ergänzen.

## Neuer Visual-QA-Befund: Gang

**Status: umgesetzt, visuell geprüft.** Der Gang auf dem vorherigen
Vergleichsbild las sich eher wie eine schmale Brücke oder zwei parallele
Schienen als wie ein begehbarer, aus dem Fels geschlagener Korridor.

Die Ursache ist technisch klar:

- nur drei Felder Länge und ein Feld Gesamtbreite;
- zwei symmetrische, durchgehende 0,34 bis 0,40 Einheiten breite Kappen ließen
  nur einen sehr schmalen sichtbaren Laufstreifen;
- der Visual-Truth-Gangboden verwendet momentan eine dunkle, praktisch
  strukturlose Fläche statt des bereits geladenen Korridormaterials;
- niedrige gleichförmige Wangen und schwach gerahmte Enden erzeugen eine
  Brücken- oder Schienen-Silhouette.

**Umgesetzte Korrektur ohne neue Assets:**

1. Die logische Breite bleibt bewusst **ein Feld**, weil dies ein regulärer und
   häufiger Spielzustand ist.
2. Das vorhandene `claimed-corridor.png` bildet wieder den sichtbaren Laufboden.
3. Wandverkleidung und Kappen liegen fast vollständig außerhalb der begehbaren
   Zelle im geschlossenen Fels; die volle Bodenbreite bleibt sichtbar.
4. Kurze getrennte Kappensteine ersetzen die durchgehenden hellen Schienen und
   die wiederholten Pfosten an jedem Zellstoß entfallen.
5. Gebaute und natürliche Schwellen markieren weiterhin beide Enden.
6. Dieselbe Ein-Feld-Korridorfamilie wird im projektbezogenen Oberflächenmodus
   auch von der großen spielbaren Geometry-Sandbox verwendet.

Damit entsteht eine eindeutige Sequenz: **Kammer → gebauter Gang → natürliche
Schwelle → Grotte**, ohne eine neue Asset- oder Rendererfamilie zu eröffnen.

## Neuer Großszenen-Befund

**Status: umgesetzt und im Browser geprüft.** Der kanonisch angebundene
Spatial-Renderer zeigt nun einen Kampagnenquerschnitt statt nur Herzraum und
Pilzgrotte. Die hellgrauen Wandflächen funktionieren auch bei langen Läufen,
Raumecken, T-Stücken und Einfeldgängen. Die neuen kurzen Kontaktschatten und das
gerichtete Licht verdecken die Fassaden nicht.

Die Szene belegt zugleich, dass weitere Wandassets derzeit nicht der Engpass
sind. Der sichtbare Qualitätsabstand konzentriert sich auf:

1. mehrere zusammenpassende Props und Decals je Raumtyp;
2. regionale Höhlenränder/Decals für Eisen, Zwerge und Schrein;
3. eine gemeinsame Detailstufe für die verbliebenen 64-Pixel-Figuren;
4. Aktions-, Produktions- und Atmosphäreneffekte;
5. finales HUD-Icon- und Typografieset.

Screenshots, Testeinstiege und genaue Begründung stehen in
[CANONICAL_GEOMETRY_INTEGRATION.md](CANONICAL_GEOMETRY_INTEGRATION.md).
