# Hollow Covenant

> Unverändert übernommene externe Audit-Quelle. Diese Datei ist historisch und
> wird nicht fortgeschrieben. Der geprüfte aktuelle Stand steht in
> [HOLLOW_COVENANT_AUDIT.md](HOLLOW_COVENANT_AUDIT.md).

Bei Hollow Covenant existieren inzwischen nicht nur mehrere Renderer. Es existieren bereits parallele Gameplayzustände. Das neue Geometry-Sandbox-Modell besitzt eigene offene und beanspruchte Felder, Räume, Arbeiter, Prioritäten, Ressourcen, Produktionsketten, Gegner, Kreaturenhunger, Kampf und Küchenlogik. Das ist kein reiner Rendereradapter mehr, sondern eine zweite Spielimplementierung.

Hollow Covenant besitzt ebenfalls erhebliche technische Substanz, ist aber stark zersplittert. Die aktuelle Geometry-Variante sieht nicht deshalb falsch aus, weil Three.js grundsätzlich ungeeignet wäre. Sie sieht falsch aus, weil konkrete Licht-, Farb-, Material-, Transparenz- und Kamerawerte dem dokumentierten Ziel widersprechen. Noch gefährlicher ist aber die parallel wachsende Spiellogik.

## Technische Vermessung

Die Three.js-Geometriesandbox umfasst ungefähr 2.160 Zeilen in einer Hauptdatei. Das Sandbox-Spielmodell besitzt ungefähr 770 Zeilen. Die zugehörige Testdatei umfasst mehr als 300 Zeilen und prüft einen umfangreichen Gameplayloop.

Die Rendererentscheidung umfasst 27 Zeilen. Der Visual-Style-B-Vertrag besitzt 255 Zeilen. Der Golden-Wall-Vertrag umfasst 182 Zeilen. Die Wand-Asset-Chronik umfasst 505 Zeilen. Sechs zentrale Assetbuildskripte kommen zusammen auf 1.986 Zeilen. Zusätzlich existieren mehr als 150 Binärdateien aus verschiedenen Style-B-, Geometry- und Terrain-Assetfamilien.

Hollow verwendet Phaser 3.90, Three.js 0.185.1, Vite 7 und Vitest 3.

## Was bei Hollow gut ist

Die ursprüngliche Diagnose war richtig. Überlappende zweidimensionale Komplettbilder für Wände lösen Ecken, Verdeckung, Kreuzungen, T-Stücke und schmale Gänge nicht zuverlässig. Echte Boden- und Wandgeometrie mit zweidimensionalen Figuren ist technisch plausibel.

Die Geometry-Sandbox verwendet Instancing für wiederholte Geometrie. Das ist bei einer großen Dungeonfläche wesentlich effizienter als ein separates Mesh pro Feld.

Die Rendererparameter sind explizit festgelegt. Tone Mapping, Exposure, Shadowmap, Pixel Ratio, Kamera, Materialien, Lichter und Mobilprofil sind im Code sichtbar. Das optische Problem ist deshalb reparierbar.

Auch die Sandboxtests sind substanziell. Sie prüfen verbundene Grabung, Claiming, Entdeckung, Kampf, physischen Ressourcentransport, Küche, Fütterung, sechs Raumfamilien, Kapazitäten, Arbeiterprioritäten und Arbeiterlimits.

Das Problem ist nicht die Qualität dieser Tests. Das Problem ist, dass sie ein separates Sandboxmodell absichern.

## Die nachrechenbare Lichtdiagnose

Die Geometry-Sandbox verwendet ein Ambient Light mit Intensität 1,02, ein Hemisphere Light mit Intensität 2,15 und ein gerichtetes Key Light mit Intensität 4,25. Das Tone Mapping ist ACES, die Exposure liegt bei 1,22.

Das globale Fülllicht beträgt nominal 1,02 plus 2,15, also 3,17.

Das Verhältnis von Key Light zu globalem Fülllicht beträgt 4,25 geteilt durch 3,17. Das ergibt nur ungefähr 1,34 zu eins.

Damit werden die Objekte von fast allen Richtungen stark aufgehellt. Das gerichtete Licht kann nur wenig Kontrast erzeugen, weil Ambient und Hemisphere bereits fast drei Viertel seiner nominellen Intensität liefern.

ACES und Exposure 1,22 komprimieren die hellen Flächen zusätzlich.

Das Ergebnis ist sichtbar, freundlich und farbig, aber nicht massiv und architektonisch. Wandstirn, Kappen, Boden und Fels werden einander zu ähnlich. Lokale Punktlichter erscheinen eher als Farbflecken, statt die Struktur zu formen.

Als erster Test sollte ein Key-zu-Fill-Verhältnis von ungefähr drei zu eins bis fünf zu eins verwendet werden.

Ein konkretes Preset wäre Ambient 0,20, Hemisphere 0,65 und Key Light 3,40. Das ergibt 3,40 geteilt durch 0,85, also genau vier zu eins.

Das ist keine universelle Naturregel. Es ist ein kontrollierter Testwert für den dokumentierten Zielstil.

## Warum Mobile besonders problematisch ist

Auf Mobilgeräten wird das Shadow Casting des gerichteten Key Lights vollständig deaktiviert.

Der neue Renderer ersetzt gemalte 2.5D-Tiefe durch reale Geometrie. Ohne Schatten bleiben nur Flächennormalen, Farben, Roughness und Lichtgradienten. Gleichzeitig ist das Fülllicht extrem hoch.

Damit verschwindet auf dem wichtigen mobilen Zielprofil ausgerechnet ein zentraler Vorteil des Geometrieansatzes.

Die Lösung ist nicht, alle Punktlichter mit dynamischen Schatten auszustatten. Sinnvoller wären eine kleine Directional-Shadowmap auf Mobile, gebackene Ambient-Occlusion-Flächen oder einfache Kontaktdecals unter Wänden und Props.

## Warum der Fels nicht massiv wirkt

Das Bedrockmaterial besitzt eine Emissive-Intensität von 0,42. Die geschlossenen Felsmaterialien besitzen 0,46.

Emission umgeht die gerichtete Beleuchtung. Auch von der Lichtquelle abgewandte Felsflächen bleiben dadurch aufgehellt.

Der Fels liest sich deshalb nicht wie dunkle Masse, sondern wie ein leicht selbstleuchtendes Material. Schatten verlieren zusätzlich an Wirkung.

Normale Felsmaterialien sollten eine Emissive-Intensität zwischen null und höchstens 0,05 besitzen. Emission sollte nur für Pilze, Herz, Essenz und technische Lampen verwendet werden.

## Warum die Farben nicht dem Zielstil entsprechen

Der rohe Boden verwendet `#829AAA`. Der Basalt verwendet `#8DA4B6`.

Die dokumentierte Style-B-Palette nennt für Fels `#20314E` und für den Abgrund `#071427`.

Die relative Luminanz des aktuellen Basalts liegt bei ungefähr 0,356. Die relative Luminanz des dokumentierten Felsziels liegt bei ungefähr 0,031.

Der aktuelle Basalt ist damit linear ungefähr 11,7-mal heller als das Ziel aus der eigenen Dokumentation.

Der Unterschied zwischen aktuellem Basalt und aktuellem Rohboden ist dagegen gering. Der Basalt ist nur ungefähr 16 Prozent luminanter als der Boden.

Das Ergebnis kann deshalb selbst bei korrekter Geometrie nicht wie das Zielbild wirken. Es handelt sich nicht um eine Geschmacksfrage. Die Materialbasis ist messbar deutlich heller und grauer als die verbindliche Palette.

## Transparente Wände

Die Geologieschichten verwenden eine Opacity von 0,72 und deaktiviertes Depth Writing. Die südlichen Vordergrundwände verwenden eine Opacity von 0,68 und ebenfalls kein Depth Writing.

Diese Transparenz hängt dauerhaft von der Wandrichtung ab. Sie hängt nicht davon ab, ob sich tatsächlich eine Figur hinter der Wand befindet.

Dadurch entsteht Geisterarchitektur. Wände wirken halbtransparent statt massiv. Hintere Geometrie scheint durch. Die Sortierung kann instabil wirken und die Architektur verliert Gewicht.

Die Wände sollten standardmäßig opak sein. Eine Verdeckungsregel sollte nur aktiv werden, wenn eine Figur tatsächlich hinter einer Vorderwand steht. Dann können genau die betroffenen Segmente temporär gedithert oder ausgeblendet werden.

## Der falsche Standardstil

Die Sandbox startet mit `surfaceStyle = clean`.

Das dokumentierte Ziel ist aber Style B beziehungsweise die projektbezogene Variante mit tiefblauem Fels, Creme und Messing.

Der erste Eindruck der neuesten Variante verwendet daher standardmäßig helle und saubere Wände statt der gewählten Stilrichtung.

Das erklärt nicht alle Probleme, ist aber ein eindeutiger Verdrahtungsfehler.

## Die Kamera

Der Kameraoffset beträgt 17,5 Einheiten in der Höhe und 10,5 Einheiten in Z-Richtung.

Daraus ergibt sich ein Winkel von ungefähr 59 Grad über der Horizontalen. Das entspricht ungefähr 31 Grad Abweichung von einer reinen Top-down-Sicht.

Der alte Golden-Wall-Vertrag beschreibt dagegen eine orthogonale, screen-aligned Top-down-Projektion mit gemaltem asymmetrischem 2.5D-Relief.

Die neue Sandbox verwendet reale geneigte Geometrie und billboardartige Sprites.

Die Kamera ist nicht zwangsläufig schlecht. Sie erzeugt aber eine andere Projektionslogik. Der alte Styleframe kann deshalb nicht pixelgenau reproduziert werden. Er kann nur noch als Material-, Farb- und Kompositionsreferenz dienen.

## Die geschlossene Felsfläche

Die geschlossenen Felsinstanzen besitzen nur ungefähr 0,34 bis 0,52 Einheiten Höhe. Die gebauten Wände erreichen einschließlich Basis und Kappe ungefähr 1,13 Einheiten.

Ungegrabener Fels wird dadurch als niedriger Teppich aus vielen einzelnen Brocken dargestellt. Gebaute Wände wirken deutlich höher.

Für einen Dungeonbuilder sollte geschlossener Fels aber die stärkste Masse bilden.

Besser wäre ein zusammenhängender Bedrockkörper mit wenigen großen Oberflächenformen, statt hunderte flache Einzelsteine.

## Die eskalierte Assetpipeline

Im Repository existieren Style B V1 bis V7, Golden-v1, Foundation-v2, Terrain-v3, Direct Terrain v2, Geometry Proof, Geometry Sandbox sowie zahlreiche Source-, Alpha-, Chroma-, Preview-, Atlas- und Occlusionvarianten.

Jede visuelle Fehlannahme wurde offenbar mit einer weiteren Variante beantwortet. Die Varianten wurden zwar dokumentiert, aber nicht konsequent aus dem aktiven Produktionspfad entfernt.

Dadurch können Coding-Agenten den falschen Pfad erweitern. Assets besitzen keinen klaren Lebenszyklus. Tests sichern historische Verträge, die möglicherweise nicht mehr produktiv sein sollen. Zeit fließt in Pipelinepflege statt in die Validierung des Spiels.

## Das größte Hollow-Risiko: eine zweite Spielimplementierung

`GeometrySandboxModel.ts` besitzt eigene Mapgrenzen, Entdeckungsorte, Gegner, Kreaturenhunger, Räume, Lagerzustände, Mining, Digging, Claiming, Building, Arbeiterjobs, Prioritäten, Produktion, Küchenfluss und einen kompletten Fortschrittsloop.

Um den neuen Renderer spielbar zu machen, wurde kein einfacher Adapter auf den bestehenden Spielzustand erstellt. Stattdessen wurde ein neues Sandboxmodell aufgebaut und mit ausgewählten alten Regeln verbunden.

Damit muss jede zukünftige Funktion potenziell zweimal implementiert werden: einmal im bisherigen Hauptspiel und einmal in der Geometry Sandbox.

Für einen Solo-Entwickler ist das nicht tragbar.

Das härteste Hollow-Urteil lautet daher: Die optischen Parameter sind in wenigen Tagen korrigierbar. Die zweite Spielimplementierung ist das eigentliche existenzielle Risiko.

## Konkrete Lösungen für Hollow

Zuerst sollte die Renderkonfiguration aus der großen Hauptdatei ausgelagert werden. Aufwand: vier bis acht Stunden.

Danach braucht es zwei oder drei feste Lichtpresets und einen kontrollierten A/B-Vergleich. Aufwand: weitere vier bis acht Stunden.

Emission und permanente Wandtransparenz sollten bereinigt werden. Aufwand: ungefähr ein Tag.

Die projektbezogene Style-B-Oberfläche muss Standard werden. Aufwand: zwei bis vier Stunden.

Auf Mobile sollte eine günstige Form von Kontakt- oder Directional Shadow eingeführt werden. Aufwand: ein bis zwei Tage.

Die geschlossene Felsdarstellung sollte vereinfacht werden. Aufwand: ein bis zwei Tage.

Die wichtigste Architekturentscheidung ist aber in drei bis fünf Stunden schriftlich festzulegen: Welcher Spielzustand ist kanonisch?

Als erster reproduzierbarer Rendertest sollten folgende Werte gelten: Ambient 0,20, Hemisphere 0,65, Key Light 3,40 und Exposure 1,0. Normale Felsemission wird auf null gesetzt. Wände und Vordergrundwände werden vollständig opak. Die projektbezogene Surface-Variante wird Standard. Punktlichter werden zunächst halbiert.

Dann wird dieselbe Szene mit demselben Zustand vor und nach der Änderung verglichen. Erst danach dürfen Kamera oder Assets verändert werden. Sonst werden wieder zu viele Variablen gleichzeitig bewegt.

## Umgang mit den parallelen Pfaden

Die Geometry Sandbox beziehungsweise der daraus extrahierte Geometry Renderer sollte der einzige Kandidat für die zukünftige Darstellung sein.

`geometry-proof.html` kann als kleine Geometrietestseite erhalten bleiben. Dort sollten keine Gameplayfunktionen ergänzt werden.

Alte Phaser-Wandvarianten, V1 bis V7, Golden-Prototypen und Direct Terrain v2 sollten im Repository als Referenz bleiben, aber offiziell eingefroren werden. Sie sollten nicht mehr im normalen Buildmenü angeboten, nicht mehr funktional erweitert und nicht mehr automatisch vorgeladen werden. Ein Manifest sollte sie klar als archiviert markieren.

Dann muss zwischen zwei Varianten entschieden werden.

Variante A: Das bestehende Hauptspiel bleibt kanonisch. In diesem Fall wird `GeometrySandboxModel` nicht weiter erweitert. Der Three.js-Renderer erhält einen Adapter auf den bestehenden Zustand.

Variante B: Das Geometry-Sandbox-Modell wird kanonisch. Dann muss das alte Modell aktiv stillgelegt und die fehlende Spiellogik kontrolliert migriert werden.

Die Empfehlung lautet Variante A, sofern das bisherige Hauptspiel bereits mehr vollständige Systeme besitzt. Das Sandboxmodell importiert bereits alte Regeln. Das beweist, dass der Spielkern nicht neu erfunden werden muss.

## Was bei Hollow ausdrücklich nicht gebaut werden sollte

Es darf keine weitere Renderer-Variante entstehen.

Es sollte kein Style B V8 und kein Golden-v2 geben, bevor Licht, Materialien und Zustandsduplikation gelöst sind.

Im Geometry-Sandbox-Modell sollten keine neuen Gameplayfeatures ergänzt werden.

Eine vollständige PBR-Pipeline mit Normal Maps, Height Maps, Displacement und Spezialshadern wäre verfrüht.

Es sollten keine dynamischen Schatten für alle Punktlichter gebaut werden.

Dreidimensionale Charaktermodelle lösen das aktuelle Problem nicht.

Eine frei drehbare 3D-Kamera würde Lesbarkeit, UI und Assetkosten verschlechtern.

Es sollten keine neuen Assets produziert werden, bevor eine einzige Szene mit korrigierten Werten das Ziel überzeugend erreicht.

Features dürfen nicht weiter per Copy-and-paste in beide Gameplaypfade portiert werden.

An dritter Stelle steht ein kontrolliertes Hollow-Lichtpreset mit ungefähr vier zu eins Key-zu-Fill und deaktivierter Felsemission. Aufwand: vier bis acht Stunden. Das testet die optische Hauptursache mit minimalem Aufwand.

An fünfter Stelle stehen der projektbezogene Standardstil und opake Wände in Hollow. Aufwand: vier bis acht Stunden.

Danach müssen die Hollow-Pfade offiziell eingefroren werden. Aufwand: ungefähr ein Tag.

Mobile Contact Shadows für Hollow benötigen ein bis zwei Tage.

Der Hollow-Rendereradapter auf einen kanonischen Zustand benötigt drei bis fünf Tage.

Sechs Stunden sollten für das Hollow-Licht- und Material-A/B verwendet werden.

Drei Stunden sollten verwendet werden, um Hollow-Pfade einzufrieren und den kanonischen Zustand festzulegen.

Hollow sollte höchstens 15 Prozent erhalten. Das Ziel lautet Schadensbegrenzung, nicht Contentproduktion. Renderwerte werden korrigiert, Pfade eingefroren und ein kanonischer Zustand festgelegt. Neue Gameplayfeatures sind ausgeschlossen.

Hollow muss das Variantenwachstum sofort stoppen. Zuerst werden Licht und Materialien korrigiert. Danach wird genau ein kanonischer Spielzustand erzwungen.
