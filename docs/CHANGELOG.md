# Changelog

## Progression, Versorgung und Kartenherz – 26. Juli 2026

- nördlichen Invasionskorridor dauerhaft von automatischem Beanspruchen und Bebauung ausgenommen
- Pilzgrotte als sicheren ersten Wirtschaftsstandort ohne Startkampf eingerichtet
- Startmetall auf 12 angehoben und Raumkosten auf flächenabhängige Formeln umgestellt
- größere Produktionsräume auf bis zu zwei Stationen, Schlafräume auf Betten und Gefängnisse auf Zellen skaliert
- Arbeiterbeschwörung für 2 Essenz mit Vier-Sekunden-Dauer und Limit von fünf Arbeitern ergänzt
- Phase 3 auf einen zusätzlichen Rekruten korrigiert und Wellen mit Vorwarnung vom Phasenwechsel entkoppelt
- aktive Missionschecklisten, Phasenfreischaltungen, Tooltips und konkrete Blockadegründe ergänzt
- Fallen auf Metallbaukosten, sichtbare Rüstungsbelieferung, vier Felder Reichweite und sechs Schüsse umgestellt
- Rationsgänge, Hungerabzüge und sichtbare Heilung in zugewiesenen Betten ergänzt
- Bewegungsdarstellung zwischen Simulationstakten interpoliert und Rastergrafik auf geglättetes Rendering umgestellt
- neues vereinfachtes Imagegen-Kartenherz mit klarer Silhouette und 256-Pixel-Laufzeittextur integriert

## Physische Wirtschaft, Jobboard und Units V1 – 26. Juli 2026

- globale Sofortproduktion durch sichtbare Lagerstapel, Raum-Inputs und blockierbare Ausgänge ersetzt
- Arbeiter transportieren Waren zu Lager, Herz, Produktionsräumen und leeren Fallen
- Lagerkapazität, Eingangsbestand, Ausgangsblockade und Idle-Gründe inspizierbar gemacht
- persistentes Jobboard mit Reservierungen, Fünf-Sekunden-Ablauf, Neuvergabe und Pfadfehlerdiagnose ergänzt
- automatischen Fallennachschub und physische Bestandsentnahme für Bau, Rekrutierung und Entscheidungen integriert
- vier Imagegen-Masterblätter für Covenant, Gegnerfraktionen, Waren, Falle und Gefangenen aufbereitet
- prozedurale Figuren-, Waren-, Fallen- und Gefangenenplatzhalter durch freigestellte Bitmap-Assets ersetzt
- Kampflesbarkeit durch eindeutige Silhouetten, fraktionsfarbene Statusringe und Angriffsbewegung verbessert

## World Composition V4 – 26. Juli 2026

- vorhandene Imagegen-Masterassets als fünf zusammenhängende Geologieregionen integriert
- ruhigen Covenant-Korridorboden vom ornamentierten Raum- und Herzboden getrennt
- bekannte Zielkammern mit organischen, befestigten oder rituellen Silhouetten statt Rechteckrahmen aufgebaut
- Raumplanung auf echte feldweise Arbeiterkonstruktion mit sichtbarem Fortschritt umgestellt
- Küche, Werkstatt, Gefängnis und Betten werden erst nach vollständigem Bau funktionsfähig
- sichtbare Arbeitsprioritäten für Transport, Graben, Bauen, Claiming und Abbau ergänzt
- feindliche Kammern, Angriffsrouten und gefährdete Arbeiter deutlicher markiert
- Arbeiterdiagnose und Prioritätstests um Bauaufträge erweitert

## Lesbarkeit, Claiming und Arbeiter – 23. Juli 2026

- bekannte Rohstoff- und Feindziele als echte, abgetrennte Hohlräume statt Fels-Rechtecke umgesetzt
- Karte von 64×40 auf 64×48 Felder erweitert und nördlichen Anmarschweg verlängert
- Rohgänge aufgehellt, Covenant-Boden beruhigt und Wandkanten kühl von goldenen Besitzrändern getrennt
- Materialzyklus von 8×8 auf 16×16 Frames vergrößert
- Grabmarkierungen als zusammenhängende Route statt einzelner Kästchen gestaltet
- vollständiges feldweises Beanspruchen als 0,9-s-Arbeiterauftrag ergänzt
- natürliche Quellen sind erst nach Bodenverlegung bis zur Quelle abbaubar
- flexible Arbeiter-Lanes für Graben, Abbau, Claiming und Transport ergänzt
- Doppelreservierung von Grab- und Claimfeldern verhindert
- Diagnoseanzeige um aktive Arbeiteraufgaben erweitert

## Terrain V3 – 23. Juli 2026

- visuelles Grundraster von 28 auf 32 Pixel umgestellt
- Imagegen-basierte Fels-, Rohboden- und Covenant-Bodenatlanten integriert
- 16×16-Materialzyklus für große, weniger repetitive Oberflächen
- assetbasierte Wandlippen und Ecken mit klarer Tunnel-Silhouette
- getrennte Covenant- und Feind-Besitzränder
- sechs gezeichnete Raumplatzhalter durch Imagegen-PNG-Props ersetzt
- alten prozeduralen Terrainatlas aus dem aktiven Startpfad entfernt
- reproduzierbare Assetaufbereitung und Vorschaubilder ergänzt

## 1.0.0 – 20. Juli 2026

- Sites-kompatible Produktionshülle für die statische Vite-Anwendung
- vollständige handgebaute 64×40-Untergrundkarte
- Mobile-first-HUD und Querformat-Sperre
- Kamera mit Pan, Zoom, Fit und Tastatursteuerung
- Gang- und Kammerplanung
- drei autonome Arbeiter mit Grab-, Abbau-, Transport- und Eskortjobs
- sichtbare Rohstoffe, lose Güter und Transport
- sechs frei platzierbare Raumtypen
- Küche, Schmelze und Werkstatt mit sichtbarem Produktionsfortschritt
- Betten und Rekrutierungsvoraussetzungen
- Guard, Archer, Hexbinder und rekrutierbarer Inquisitor
- Angriffsbanner, Haltebanner, Fallen und Covenant Pulse
- natürliche Gegner, Zwergen-Claim, Essenzschrein und drei Inquisitionswellen
- sichtbarer Gefangener, Eskorte, Zelle und drei Entscheidungen
- Vertrauen, Furcht und entscheidungsabhängige Finalwelle
- fünfteilige Missionsführung, Sieg, Niederlage und Statistik
- prozedurale Pixelart und minimales WebAudio
- optionaler Diagnosemodus über `?debug=1`
