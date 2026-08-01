# Hollow Covenant

[![Deploy to GitHub Pages](https://github.com/emfau88/Hollow/actions/workflows/deploy.yml/badge.svg)](https://github.com/emfau88/Hollow/actions/workflows/deploy.yml)

<p align="center">
  <strong><a href="https://emfau88.github.io/Hollow/">▶ Hollow Covenant direkt im Browser spielen</a></strong>
</p>

**Hollow Covenant** ist ein spielbarer HTML5-Vertical-Slice eines humorvoll-makabren, mobile-tauglichen Dungeon-Management-Spiels. Unter einer angeblich heiligen Metropole erwacht ein uraltes Dungeon-Herz: Der Spieler gräbt ein unterirdisches Reich aus, erschließt Rohstoffe, organisiert sichtbare Produktionsketten, baut eine kleine indirekt gesteuerte Armee auf und entscheidet über das Schicksal besiegter Inquisitoren.

> **Projektstatus:** spielbarer Proof of Concept in aktiver Entwicklung. Zielplattformen sind Smartphone und Tablet im Querformat sowie Desktop-Browser. Grafik, Audio, Balancing und technische Architektur sind noch nicht auf finalem Produktionsniveau.

<p align="center">
  <a href="https://emfau88.github.io/Hollow/"><img src="docs/HOLLOW_COVENANT_START.png" width="49%" alt="Startbildschirm von Hollow Covenant"></a>
  <a href="https://emfau88.github.io/Hollow/"><img src="docs/HOLLOW_COVENANT_DESKTOP.png" width="49%" alt="Aktuelle Desktop-Spielansicht von Hollow Covenant"></a>
</p>

### Experimentelle visuelle Richtung: Dungeon Administration

Style B überträgt das Spiel auf eine hellere, freundlichere und stärker
charakterbasierte Bildsprache. Der spielbare Startbereich verwendet bereits ein
mehrteiliges Herz-Hauptquartier, nichtmenschliche Covenant-Diener und eine
vollständig ausgestattete Pilzgrotte. Der bisherige Stil bleibt vorerst Standard.

<p align="center">
  <strong><a href="https://emfau88.github.io/Hollow/?theme=style-b">▶ Style-B-Slice direkt im Browser ausprobieren</a></strong><br /><br />
  <a href="https://emfau88.github.io/Hollow/?theme=style-b"><img src="docs/screenshots/style-b-v3-gameplay.png" width="82%" alt="Spielbarer Style-B-Startbereich mit plastischen Wänden, Herz-Hauptquartier und Pilzgrotte"></a><br />
  <small>Echter Spielscreen mit vergrößertem Herzraum, 2.5D-Wandbausatz, plastischen Böden und sichtbarer Pilzgrotte.</small>
</p>

### Spielbare 2.5D-Sandbox

Der neue Geometriepfad kann unabhängig vom bisherigen Renderer als mobile-first
Sandbox gespielt werden. Er verwendet echte 3D-Böden und -Wände, übernimmt aber
die sechs Raumtypen, Baukosten und Produktionsrezepte des Hauptspiels. Die große
Karte enthält mehrere ergiebige Eisen- und Pilzvorkommen und unterstützt freies
Ganggraben, Kammerplanung, zeitbasierte Arbeiteraufträge, maßstäbliche
Raumausstattung, Produktion und Touch-Bedienung. Hauptspiel und frühere
Prototyp-/Diagnoseseiten bleiben als getrennte Einstiege erhalten.

<p align="center">
  <strong><a href="https://emfau88.github.io/Hollow/geometry-sandbox.html">▶ Spielbare 2.5D-Sandbox öffnen</a></strong><br />
  <small>Smartphone/Tablet: Querformat empfohlen. Gang per Tippen/Ziehen; Kammern und Räume als Fläche aufziehen.</small>
</p>

Die technischen Hintergründe und der beschlossene Migrationspfad stehen in der
[Renderer-Entscheidung](docs/GEOMETRY_RENDERER_DECISION.md).

#### Technischer Stand der 2.5D-Sandbox

Die Sandbox ist derzeit ein **spielbarer Architektur- und Gameplay-Proof**, aber
noch kein Ersatz für den vollständigen Vertical Slice. Nachgewiesen ist:

- echte Boden- und Wandgeometrie wird aus offenen Feldern erzeugt; Geraden,
  Innen-/Außenecken, T-Stücke und Kreuzungen benötigen keine überlappenden
  Komplettsprites mehr;
- die Wanddarstellung unterscheidet inzwischen automatisch zwischen gebauter
  Architektur und natürlichem Fels: organische Felskörper schließen Gangränder,
  während Räume topology-getriebene Pfeiler, Kappen, Messingbänder und
  Übergangsschwellen erhalten;
- ein sparsames Beleuchtungsset setzt warme Covenant-Wandleuchten und kühle
  Naturlichter als emissive 3D-Körper mit echten lokalen Lichtquellen. Die Zahl
  der Lichter wird auf Mobilgeräten niedriger gehalten;
- Grabaufträge öffnen den Fels nicht sofort: Der sichtbare Arbeiter läuft zum
  exakt angrenzenden Feld, richtet sich zum Ziel aus und beendet dort erst seine
  Grabanimation samt Fortschrittsanzeige;
- große 48 × 32-Karte, umfangreiche Erz- und Pilzvorkommen, sechs Raumtypen,
  Baukosten, Raumgrößen, Kapazitäten und die drei Produktionsrezepte des
  Hauptspiels funktionieren in einer fortlaufenden Sandbox;
- Arbeitsprioritäten verteilen Graben, Bauen und Abbau; Geometrie und
  Ressourcen werden ereignisbasiert statt in jedem Frame vollständig neu
  aufgebaut;
- mobile Steuerung mit mindestens 44 px großen Zielen, kompakter
  Ressourcenleiste, unterer Werkzeugleiste, aufklappbaren Bau-/Arbeitsmenüs,
  Pinch-Zoom, Vollbild und einer bestmöglichen Querformat-Anforderung ist
  vorhanden. Eine erzwungene Bildschirmdrehung bleibt von Browser und Gerät
  abhängig; insbesondere iOS kann sie verweigern.

Noch klar fehlend oder vereinfacht sind:

- vollständige Übernahme der Kampagne mit Fog of War, Beanspruchen,
  Gegenstandstransport, Hunger, Kampf, Fallen, Rekrutierung, Wellen,
  Gefangenenablauf, Sieg/Niederlage und Speichern;
- individuelle Simulation und sichtbare Darstellung aller Arbeiter. Aktuell
  gräbt ein sichtbarer Arbeiter feldgenau, während Bauen, Abbau und weitere
  Arbeiter noch zusammengefasst simuliert werden;
- dieselbe robuste Jobreservierung, Weg-Neuberechnung und Fehlerbehandlung wie
  im Hauptspiel sowie echtes Geräte-QA auf mehreren Smartphones und Tablets;
- finale 3D-/2.5D-Assets, Animationen, Effekte, Audio, Balancing und ein
  durchgängiger visueller Qualitätsdurchlauf.

#### Warum die Sandbox noch spartanisch aussieht

Der Prototyp sollte zuerst die zuvor problematische **Topologie, Verdeckung und
Interaktion** beweisen. Deshalb bestehen Wände momentan aus einfachen
Geometriequadern mit Testmaterialien; Bodenflächen sind große wiederholte
Texturen, Erz und Pilze stehen als flache Sprites in der Welt und viele
Raumobjekte stammen weiterhin aus der alten Top-down-Perspektive. Es fehlen
kleinteilige Felsformen, Materialvariation, saubere Übergänge, Schattenarbeit,
Dekoration und ein gemeinsamer Maßstab. Der nüchterne Eindruck ist daher vor
allem ein noch fehlender Art- und Asset-Pass – nicht erneut das alte
Ecken-/Kantenproblem des Renderers.

Die größten Hebel für Mockup-Nähe wären, in dieser Reihenfolge:

1. eine kleine, konsistente modulare Wand- und Felsfamilie für die neue Kamera
   (Sockel, Wandkörper, Kappe, Pfeiler, Türschwelle und 3–5 Materialvarianten);
2. organische Felsränder und Böden mit Übergangsblends, Decals, Geröll,
   Pilzbewuchs und gezielter Variation statt großer sichtbarer Farbflächen;
3. Dungeon-Herz und zentrale Raumausstattung als perspektivisch passende
   2.5D-Sprites oder einfache 3D-Modelle in einheitlichem Maßstab;
4. kontrollierte Beleuchtung mit warmen Raumlichtern, kühlem Fels, Kontakt-
   und Tiefenschatten sowie besser abgestimmter Kamera und Wandhöhe;
5. vollständige Arbeiter-, Grab-, Bau- und Produktionsanimationen mit Staub,
   Splittern, Licht- und Audiofeedback.

Damit ist der technische Weg weiterhin sinnvoll, die sichtbare Qualität muss
aber durch eine gezielt für diesen Renderer produzierte Assetfamilie entstehen;
die alten Top-down-Komplettbilder allein können diesen Schritt nicht leisten.

## Vision

Der Vertical Slice soll eine zentrale These beweisen:

> Strategisches Graben und eine sichtbare Wirtschaft erzeugen militärische Macht; der Umgang mit Gefangenen bestimmt zugleich, welche Gesellschaft unter der Erde entsteht.

Die sechs Designpfeiler sind:

1. **Strategisches Graben** zu sichtbaren Rohstoff-, Raum- und Konfliktzielen.
2. **Sichtbare Wirtschaft** mit physischen Gütern und Transportwegen.
3. **Wirtschaft erzeugt Militärmacht** durch Einheiten, Fallen und Expansion.
4. **Indirekte Führung** über Prioritäten, Banner und autonome Einheiten.
5. **Gefangene verbinden Kampf und Moral** mit konkreten spielmechanischen Folgen.
6. **Lesbarkeit vor Systemmenge**: Voraussetzungen und Stillstände sollen verständlich sein.

Die vollständige Produktvision, Zielerfahrung und Definition of Done stehen im [Masterplan](Hollow_Covenant_Masterplan.md).

## Was bereits spielbar ist

- handgebaute Untergrundkarte mit 64 × 48 Feldern, Fog of War und mehreren Geologieregionen;
- Gang- und Kammerplanung, feldweises Graben, Beanspruchen und Errichten von Räumen;
- autonome Arbeiter mit persistentem Jobboard, Reservierungen und einstellbaren Arbeitsprioritäten;
- physische Rohstoffe, sichtbarer Transport, Lagerkapazitäten sowie blockierbare Raum-Ein- und -Ausgänge;
- drei Produktionsketten: Biomasse → Rationen, Roherz → Metall und Metall → Rüstungsgüter;
- sechs Raumtypen: Lager, Schlafkammer, Pilzküche, Schmelze, Werkstatt und Gefängnis;
- drei reguläre Kampfeinheiten sowie ein rekrutierbarer Inquisitor;
- Angriffsbanner, Haltebanner, Bolzenfallen, Covenant-Puls, Hunger und Heilung in Betten;
- natürliche Ressourcen, Zwergen-Claim, Essenzschrein und drei Inquisitionswellen;
- fünfteilige Missionsführung mit Checklisten, Freischaltungen, Sieg und Niederlage;
- geführter Ersteinstieg mit sichtbar ausgegrabener Pilzgrotte, markierter Tunnelverbindung und schrittweise freigeschaltetem HUD;
- Gefangenenablauf mit Eskorte, Zelle und den Entscheidungen Freilassen, Rekrutieren oder Opfern;
- Vertrauen und Furcht mit Auswirkungen auf Armee, Ressourcen und Finalwelle;
- responsives HUD, Querformat-Sperre, Vollbildmodus, Touch-Steuerung sowie Pause, 1× und 2× Geschwindigkeit.

Die Mission ist als kompakter Durchlauf mit einer Zielgröße von etwa 8–10 Minuten angelegt. Es gibt bewusst keinen Sandbox-Modus.

## Kernschleife

```text
Ziel wählen → Tunnel planen → Arbeiter graben und beanspruchen
     ↓
Rohstoff abbauen → sichtbar transportieren → verarbeiten
     ↓
Räume, Kämpfer und Fallen finanzieren → Standort erobern
     ↓
Gefangenenentscheidung treffen → Finalwelle überstehen
```

## Schnellstart

Voraussetzungen:

- Node.js 22
- npm

```bash
git clone https://github.com/emfau88/Hollow.git
cd Hollow
npm ci
npm run dev
```

Danach `http://localhost:5188/` öffnen.

### Produktionsversion lokal prüfen

```bash
npm run build
npm run preview
```

Die Vorschau läuft standardmäßig unter `http://localhost:4188/`.

## Steuerung

### Maus und Tastatur

| Eingabe | Aktion |
|---|---|
| Ziehen | je nach aktivem Werkzeug Kamera bewegen, Gang/Kammer planen oder Raum aufziehen |
| Mausrad | zoomen |
| `WASD` / Pfeiltasten | Kamera bewegen |
| `F` | bekannte Karte einpassen |
| `P` | Pause ein-/ausschalten |
| `R` | Knick einer geplanten L-Gangroute drehen |
| `Esc` | zum Kamerawerkzeug wechseln |

Weitere Aktionen wie Geschwindigkeit, Vollbild, Audio, Covenant-Puls, Arbeitsprioritäten, Bau, Rekrutierung und Kampfsteuerung sind direkt über das HUD erreichbar.

### Erste Schritte und Arbeiter

Nach dem Erwecken des Herzens ist die **Pilzgrotte östlich der Starthöhle bereits ausgegraben und grün markiert**. Wähle „Gang“ und ziehe die kurze Verbindung vom goldenen Ring bis zum grünen Ring. Die Arbeiter graben und beanspruchen den neuen Boden automatisch. Baue danach eine Pilzküche und versorge sie mit Biomasse.

Zusätzliche Arbeiter werden nach einer **fertigen Pilzküche** freigeschaltet. Klicke oben im HUD direkt auf den Arbeiterzähler (`3/5`); ein Arbeiter kostet 2 Essenz, benötigt 4 Sekunden und das aktuelle Limit liegt bei 5. Kämpfer erscheinen später separat unter „Gefolge“.

### Touch

- im Querformat spielen;
- mit einem Finger je nach Werkzeug ziehen;
- mit zwei Fingern verschieben und per Pinch zoomen;
- Kartenansicht, Vollbild und Simulationsgeschwindigkeit über das HUD steuern.

## Entwicklung

| Befehl | Zweck |
|---|---|
| `npm run dev` | Vite-Entwicklungsserver auf Port 5188 |
| `npm test` | alle Vitest-Tests einmal ausführen |
| `npm run test:watch` | Tests im Watch-Modus |
| `npm run lint` | strikte TypeScript-Prüfung ohne Ausgabe |
| `npm run build` | TypeScript prüfen, Vite-Build erzeugen und Sites-Paket vorbereiten |
| `npm run preview` | Produktionsbuild lokal auf Port 4188 starten |

Der optionale Diagnosemodus ist unter `http://localhost:5188/?debug=1` verfügbar. Er zeigt Simulations- und Arbeiterdaten und bietet Abkürzungen für wiederholbare QA-Szenarien.

### Browser-Automation und Chromium-Agenten

Der explizite Automationsmodus läuft unter `http://localhost:5188/?automation=1&seed=42`. Er deaktiviert automatische Vollbildwechsel, verwendet einen reproduzierbaren Zufallsseed und installiert nach dem Laden `window.hollowAgent`. Die API steuert dieselben Spielaktionen und Sperrregeln wie das sichtbare HUD:

```js
const agent = window.hollowAgent;
agent.start();
agent.getState();
agent.planDig({ x: 38, y: 34 }, { x: 42, y: 34 });
agent.setSpeed(2);
agent.step(100);
agent.focusTarget('fungus');
```

Verfügbare Methoden: `start`, `getState`, `selectTool`, `planDig`, `placeRoom`, `summonWorker`, `recruit`, `setSpeed`, `step`, `focusTarget` und `reset`. `getState()` liefert Mission, Checkliste, Ressourcen, Arbeiter, Einheiten, Gegner, Räume, Gegenstände, bekannte Felder, Weltziele, Kamera und blockierte Aktionen als serialisierbares Objekt. Für ereignisgesteuerte Runner stehen `hollow:agent-ready`, `hollow:action-complete` und `hollow:objective-changed` bereit. Wichtige HUD-Elemente besitzen zusätzlich stabile `data-testid`-Selektoren; zugängliche Weltziel-Schaltflächen spiegeln die sichtbaren strategischen Ziele.

## Technik und Projektstruktur

- **Engine:** Phaser 3.90.0
- **Sprache:** TypeScript 5 mit aktiviertem Strict Mode
- **Build:** Vite 7
- **Tests:** Vitest 3
- **Darstellung:** WebGL/Canvas mit DOM-/CSS-HUD
- **Simulation:** fester 10-Hz-Takt, Rendering bis 60 FPS
- **Deployment:** statischer Build über GitHub Actions/GitHub Pages; zusätzlich Sites-kompatible Paketierung

```text
src/
  config/   Balancewerte, Terrain- und Missionskonfiguration
  core/     Regeln, Pathfinding, Jobboard, Terrain und Audio
  data/     Räume, Einheiten, Gegenstände und Rezepte
  scenes/   Phaser-Spielszene und Laufzeitorchestrierung
  ui/       DOM-basiertes HUD
tests/      Regel-, Missions-, Job-, Wirtschafts- und Pfadtests
public/     Laufzeit-Assets
scripts/    reproduzierbare Asset- und Deployment-Aufbereitung
docs/       QA-, Asset-, Imagegen- und Änderungsdokumentation
```

Bei jedem Push auf `main` installiert der GitHub-Actions-Workflow die Abhängigkeiten, prüft TypeScript, führt die Tests aus, baut die Anwendung und ist für das anschließende GitHub-Pages-Deployment konfiguriert.

## Projektdokumentation

- [Masterplan](Hollow_Covenant_Masterplan.md) – Produktvision, Scope, Systeme und Definition of Done
- [Changelog](docs/CHANGELOG.md) – bisherige Entwicklungsschritte
- [QA-Bericht](docs/QA_REPORT.md) – automatisierte und manuelle Prüfungen
- [Asset-Manifest](docs/ASSET_MANIFEST.md) – aktive und verworfene Grafikassets
- [Imagegen-Log](docs/IMAGEGEN_LOG.md) – dokumentierte Generierungen und lokale Aufbereitung
- [Visual Style B](docs/VISUAL_STYLE_B.md) – Style Bible, Produktionsregeln und Freigabekriterien
- [Renderer-Entscheidung](docs/GEOMETRY_RENDERER_DECISION.md) – Wandproblematik, Testergebnis und 2.5D-Migrationspfad

## Bewusste Grenzen des Vertical Slice

Der aktuelle Scope enthält unter anderem keine prozeduralen Karten, mehrere Ebenen, Oberflächenwelt, Forschung, Handel, Multiplayer, Konten, Backend, Monetarisierung oder ein umfangreiches Savegame-System. Die Oberfläche ist derzeit deutschsprachig. Audio und Grafik dienen dem Proof of Concept und sind nicht als finale Release-Assets zu verstehen.

## Lizenz

Aktuell ist keine Lizenzdatei im Repository hinterlegt. Nutzung, Weitergabe oder Wiederverwendung von Code und Assets ist damit nicht pauschal freigegeben.
