# Wand- und Architekturasset-Chronik

**Stand:** 1. August 2026

**Untersuchter Git-Stand:** `ea31adf` (`main`)

**Geltungsbereich:** Wand-, Gang-, Schwellen- und direkt gekoppelte Boden-/Grottenassets von der Terrain-Grundlage bis Style B V7

## Kurzfassung und ehrliche Bewertung

Ja: Die aktuelle V7 hat die Wände gegenüber den malerischeren Zwischenständen
optisch vereinfacht. Sie hat L-/T-Verbindungen, Gangbreiten, Raumrollen und
Schwellen systematisch zuverlässiger gemacht, dafür aber Wandhöhe, Materialfülle,
individuelle Steinformen und die plastische Fassadenwirkung reduziert. Das ist
kein subjektiver Nebeneffekt, sondern direkt in der Erzeugung sichtbar: V7 baut
schmale, deterministische Masken und färbt Materialausschnitte darin ein; die
reich gemalten V4-Wandmodule werden für die aktiven V7-Wände nicht mehr benutzt.

Das Hauptproblem war deshalb nie nur „eine falsche L-Ecke“. Wir haben mehrfach
zwischen zwei unvollständigen Lösungen gewechselt:

1. malerische, tiefe Wandbilder, deren Geometrie nicht zum Raster und zu allen
   möglichen Grabungsformen passte;
2. geometrisch verlässliche Module, deren Form und Material nicht mehr die
   Qualität des Mockups erreichten.

Der Zielzustand ist **keine echte isometrische Karte**, sondern eine
orthogonale Draufsicht mit kontrollierter 2.5D-Tiefe: Boden und Logik bleiben
top-down und rasterbasiert; Südwände zeigen eine deutlich höhere Vorderseite,
Seitenwände eine gerichtete Wange und Nordwände eine niedrigere Kappe. Das
vorhandene Phaser-/Grid-Grundgerüst ist dafür geeignet. Was bisher fehlte, war
ein vor der Assetproduktion festgeschriebener und vollständig ausgemalter
Projektions-, Topologie- und Übergangsvertrag.

## Was das Mockup verbindlich vorgibt

Das [Produktions-Styleframe](mockups/HOLLOW_COVENANT_STYLE_B_PRODUCTION_FRAME.png)
ist als Zielbild kohärent, weil alle Elemente in einer Illustration dieselbe
Perspektive, Lichtquelle, Detaildichte und Farbhierarchie besitzen. Für eine
modulare Spielkarte müssen daraus folgende Regeln explizit reproduziert werden:

- orthogonales 32-Pixel-Logikraster, aber größere überlappende 2.5D-Sprites;
- Licht von links oben und dieselbe Materialhelligkeit in allen Richtungen;
- niedrige Nordkante, sichtbare Südfront sowie klar gerichtete Ost-/Westwangen;
- echte, orientierte Außen- und Innenecken statt eines gedrehten Universalteils;
- eigene Tür-/Schwellenstücke zwischen Raum, Gang und Naturhöhle;
- gebaute Covenant-Räume, befestigte neutrale Räume, gegrabene Gänge und
  natürliche Höhlen als vier verwandte, aber klar verschiedene Familien;
- organische Naturkonturen statt rechteckiger Covenant-Rahmen um jede Kammer;
- Freigabe nicht am Einzelasset, sondern an einem echten Spielscreen bei den
  tatsächlich verwendeten Zoomstufen und Bildschirmgrößen.

## Chronologie aller relevanten Wandpässe

### 0. Terrain Foundation V2 / Terrain V3

**Commit:** `be27ae0` – *Upgrade terrain readability and worker claiming*

**Assets:**

- `foundation-v2/autotiles/wall-lip.png` und `wall-corner.png` samt Quellen,
  Alpha-Dateien und Vorschau;
- `terrain-v3/wall-edge.png` und `wall-corner.png`;
- `terrain-v3/sources/wall-concept-unused.png`.

**Anlass:** Die prozedurale Ausgangskarte sollte durch lesbare, assetbasierte
Felskanten auf einem 32-Pixel-Terrain ersetzt werden.

**Gewünschter Effekt:** Klare Tunnelkontur in echter Draufsicht, geringe Kosten,
rotierbare Kante plus Ecke.

**Tatsächliches Ergebnis:** Als funktionale Top-down-Kante erreicht. Der erste
Wandkonzeptbogen wurde bewusst verworfen, weil er frontal/isometrisch und damit
inkompatibel zur Karte war. Die verwendeten Lippen blieben flach; sichtbare
Raumhöhe wie im späteren Mockup war nicht Teil dieses Passes.

**Ziel erreicht?** **Teilweise.** Gute Basislesbarkeit, keine 2.5D-Architektur.

### 1. Style B V1 – Farbwelt ohne neue Wandgeometrie

**Commit:** `ddafb46` – *Add Style B visual slice*

**Assets:** `style-b-v1/terrain/wall-edge.png`, `wall-corner.png` und die
umgefärbten Style-B-Terrainflächen.

**Anlass:** Das freundlichere blau-goldene „Dungeon Administration“-Zielbild
sollte parallel zum Legacy-Stil spielbar werden.

**Gewünschter Effekt:** Tiefblauer Fels, wärmere Covenant-Flächen, weniger
düstere Gesamtwirkung.

**Tatsächliches Ergebnis:** Palette und Materialstimmung änderten sich, die
Wände blieben jedoch dieselben flachen Top-down-Lippen. Das Mockup wirkte deshalb
räumlicher als der echte Spielscreen.

**Ziel erreicht?** **Farbe ja, räumliche Wandwirkung nein.**

### 2. Style B V2 – Herzraum und Dekor, aber noch keine neue Wandfamilie

**Commit:** `fd34143` – *Build Style B heart room and grotto*

**Direkt gekoppelte Assets:** vierteiliges Herzgebäude, Lampen, Banner, Karren,
Regale, Vorräte, Pilzgruppen und Grotto-Station.

**Anlass:** Herz und Diener sollten nicht länger wie menschliche Figuren bzw.
ein großer Charakter wirken. Herzraum und Pilzgrotte sollten als Orte lesbar
werden.

**Gewünschter Effekt:** Mehr Fülle, Humor, Maßstab und erzählerische Funktion im
Startbereich.

**Tatsächliches Ergebnis:** Die Motive verbesserten die Szene deutlich. Sie
trafen aber auf weiterhin flache Wandkanten. Dadurch entstand ein
Perspektivkonflikt: plastische Gebäude und Props lagen in einer top-down
gerahmten Karte.

**Ziel erreicht?** **Für Motive weitgehend, für die Gesamtarchitektur nur
teilweise.**

### 3. Style B V3 – erste tiefe, gerichtete Wandbilder

**Commit:** `9e4974f` – *Add dimensional Style B terrain*

**Assets:**

- `walls/north.png`, `east.png`, `south.png`, `west.png`;
- `north-east.png`, `east-south.png`, `south-west.png`, `west-north.png`;
- Quellen `wall-kit-master.png` und `wall-kit-master-alpha.png`;
- neue großflächige Fels-, Rohboden-, Covenant- und Grottenmaterialien;
- sechs Bodendecals und die Herzfassung.

**Anlass:** Die flache Wirkung sollte explizit durch helle Kappen, dunkle
Stirnflächen und Kontaktschatten ersetzt werden. Gleichzeitig sollten die
fehlenden Quadrate an den Ecken neutraler Kammern verschwinden.

**Gewünschter Effekt:** Sichtbare Wandhöhe und echte L-Formen auf dem
32-Pixel-Raster; mehr Nähe zum Mockup.

**Tatsächliches Ergebnis:** Einzelne Wandabschnitte wirkten deutlich
hochwertiger und plastischer. Die 48-/64-Pixel-Module waren jedoch an offenen
Kachelzentren verankert. Mehrere große L-Sprites überlagerten sich bei
Sackgassen, Drei-/Vierfachkontakten und frisch gegrabenen Anschlüssen. Das
erzeugte fehlende Eckquadrate, scheinbar zugemauerte Gänge, überstehende
Fassaden und in Wände laufenden Boden.

**Ziel erreicht?** **Visuell teilweise, topologisch nein.**

### 4. 32×32-Vereinfachung – erster Tausch von Tiefe gegen Sicherheit

**Commit:** `a5230b0` – *Polish worker animation and dungeon rendering*

**Änderung:**

- alle Wandmodule auf 32×32 begrenzt;
- eine Nordwand als Quelle verwendet und für die anderen Richtungen gedreht;
- L-Ecken deterministisch aus zwei Geraden zusammengesetzt;
- `WallLayout.ts` für nicht überlappende Teile eingeführt;
- Terrain-RenderTexture auf `NEAREST` gestellt;
- vollständige Karten-Neuzeichnung nach jeder Grabung entfernt.

**Anlass:** Überlappende 48-/64-Pixel-Sprites versperrten schmale Gänge optisch,
Grabungen verlangten teure Full-Map-Redraws und Kanten jitterten bzw. wurden
inkonsistent zusammengesetzt.

**Gewünschter Effekt:** Saubere lokale Updates, bessere Performance, keine
scheinbaren Mauern im Durchgang und rasterstabile Darstellung.

**Tatsächliches Ergebnis:** Mechanik und Updatekosten wurden robuster. Die
Wände verloren aber genau die Überzeichnung außerhalb der 32-Pixel-Kachel, die
ihnen Höhe gegeben hatte. Gedrehte Kopien widersprachen zudem der festen
Lichtquelle; `NEAREST` verstärkte beim Herauszoomen die pixelige Wirkung.

**Ziel erreicht?** **Technisch teilweise, visuell klar verfehlt.** Dieser Pass
war ein dokumentierter Qualitätsrückschritt.

### 5. „Restore painted depth“ – 96-Pixel-Atlas und glattes Zoomen

**Commit:** `07e44da` – *Restore painted wall depth and smooth zoom*

**Assets:**

- `wall-kit-master-v2.png`, `wall-kit-master-v2-alpha.png` und Prompt;
- neu aufgebaute 96×96-Richtungs- und L-Frames;
- `wall-atlas.png` mit acht Frames.

**Anlass:** Die 32×32-Fassung war sichtbar zu flach und zu pixelig.

**Gewünschter Effekt:** Malerische Kappe und Steinfront zurückholen, ohne den
begehbaren 32-Pixel-Streifen zu schließen; lineare Filterung und Subpixelkamera
für schärferes, ruhigeres Zoomen.

**Tatsächliches Ergebnis:** Wandtiefe und Zoomdarstellung wurden besser. Die
Geometrie blieb aber ein kachelzentriertes System aus Geraden und großen
L-Kompositionen. Außerdem stammten die Richtungen wieder aus Rotationen einer
Quelle; Licht und Seitenperspektive waren nicht vollständig konsistent.

**Ziel erreicht?** **Visuell deutlich besser, topologisch weiterhin nur
teilweise.**

### 6. Style B V4 – Kanten und Ecken an echten Rastergrenzen

**Commit:** `1b9f14c` – *Rebuild Style B walls and opening layout*

**Assets:**

- separat gemaltes `wall-kit-master-v4-*` samt Prompt;
- `north-v4.png`, `east-v4.png`, `south-v4.png`, `west-v4.png`;
- `convex-v4.png`, `concave-v4.png`, `diagonal-v4.png`;
- `wall-atlas-v4.png`.

**Anlass:** Kachelzentrierte L-Sprites konnten Rechtecke, Türanschlüsse und
frische Grabungen nicht zuverlässig schließen.

**Gewünschter Effekt:** Geraden sitzen auf Rasterkanten, Ecken auf gemeinsam
genutzten Rasterknoten. Vier Richtungen sollten separat gemalt sein, damit
Licht und Vorderseiten nicht durch Rotation verfälscht werden.

**Tatsächliches Ergebnis:** Das Renderer-Modell wurde grundsätzlich richtiger:
Kante und Knoten waren getrennt, und die Module blieben malerisch. Das generierte
goldene Eckteil war aber selbst V-/isometrisch gezeichnet. An rechtwinkligen
Wänden wirkte es deshalb versetzt und aufgefächert. Tiefe Raumfassaden
überlappten außerdem weiterhin schmale Gänge und Türmündungen.

**Ziel erreicht?** **Architektonisch ein wichtiger Fortschritt, visuell und bei
schmalen Anschlüssen nur teilweise.**

### 7. Style B V5 – kompakte Gangwände, quadratische Pfosten, neutrale Familie

**Commit:** `48d8ef5` – *Fix Style B room corners and dug passages*

**Assets:**

- `wall-atlas-v5.png` und `wall-atlas-neutral-v5.png`;
- vier `*-v5.png`-Geraden;
- `convex-v5.png`, leere `concave-v5.png` und `diagonal-v5.png`;
- vier `compact-*-v5.png`-Gangwangen.

**Anlass:** V4-Eckpfeiler wirkten diagonal, doppelte Pfosten blockierten
Gangmündungen und tiefe Raumwände überdeckten ein Feld breite Gänge. Neutrale
Kammern sollten nicht wie Covenant-Besitz aussehen.

**Gewünschter Effekt:** Quadratische 90°-Pfeiler, offene Türanschlüsse, weniger
tiefe Gangwangen und eine graugrüne neutrale Wandfamilie.

**Tatsächliches Ergebnis:** Die konkrete Doppelpfosten- und Farbproblematik
wurde reduziert. Raum versus Gang wurde jedoch aus offenen 2×2-Flächen
erraten. Zweispurige Gänge, L-Formen und Anschlüsse konnten dadurch zwischen
tiefer Raumwand und kompakter Gangwand wechseln. Helligkeit und Wandhöhe waren
zwischen horizontalen und vertikalen Verläufen nicht stabil.

**Ziel erreicht?** **Teilweise.** Einzelne Symptome behoben, die
Klassifikation blieb unzuverlässig.

### 8. Style B V6 – semantische Korridore

**Commit:** `9f5e6f9` – *Establish semantic Style B corridor architecture*

**Assets:** vier `corridor-*-v6.png` und `corridor-wall-atlas-v6.png`.

**Anlass:** Die 2×2-Formerkennung aus V5 war keine belastbare Definition eines
Gangs. Horizontale Passagen wirkten wegen komprimierter dunkler Raumfassaden
erheblich dunkler als vertikale.

**Gewünschter Effekt:** Explizite Rollen `room`, `chamber`, `corridor`; niedrige
Korridorlippen aus derselben hellen Materialquelle; gleiche Helligkeit für alle
Richtungen; Entfernung des braunen Tutorial-Grabungsdecals.

**Tatsächliches Ergebnis:** Zwei Felder breite, L- und T-förmige Gänge blieben
semantisch Korridore, und das Schmutzdecal verschwand. Der V6-Atlas enthielt
aber nur vier Geraden. Es gab keine eigenen Gangknicke, T-Knoten, Raumübergänge
oder orientierten Eckmodule. Überlagerte Geraden sahen deshalb wie Schienen aus;
Mündungen blieben abrupt und visuell unvollständig.

**Ziel erreicht?** **Semantik ja, vollständige Darstellung nein.**

### 9. Style B V7 – vollständiger Topologievertrag, schwächere aktive Malerei

**Commit:** `ea31adf` – *Complete Style B 2.5D architecture kit*

**Aktive Assets:**

- `wall-atlas-built-v7.png`;
- `wall-atlas-fortified-v7.png`;
- `wall-atlas-natural-v7.png`;
- `wall-atlas-corridor-v7.png`;
- `threshold-built-v7.png` und `threshold-natural-v7.png`.

**Weitere neue Dateien:** `architecture-v7-preview.png`,
`natural-cavern-material-v7.png` und dessen Prompt.

**Anlass:** V6 konnte Geraden darstellen, aber keine vollständigen L-/T-/X-,
Diagonal- und Übergangssituationen. Natürliche Höhlen und befestigte Kammern
brauchten dauerhaft eigene Identitäten.

**Gewünschter Effekt:** Ein gemeinsamer 16-Frame-Vertrag für vier
Architekturfamilien: vier Geraden, vier orientierte Außenecken, vier orientierte
Innenecken, zwei Diagonalkontakte und zwei Reserven; zusätzlich vier Schwellen
je Übergangsfamilie. Pilzgrotte organischer und weiter vom Herzraum entfernt.

**Tatsächliches Ergebnis:** Die strukturelle Seite ist der bisher beste Stand:
Die Rollen `built-room`, `fortified-chamber`, `natural-cavern` und `corridor`
sind explizit, die Topologie ist vollständig, und der Renderer muss L-/T-Knoten
nicht mehr aus zufällig überlagerten Geraden improvisieren. Die Pilzgrotte ist
organischer und besitzt eine eigene Wandfamilie.

Die aktive Wandmalerei ist jedoch sichtbar schwächer. V7 schneidet keine
fertig gemalten V4-Wände in den neuen Vertrag. Stattdessen erzeugt das
Buildskript geometrische Rechteck-/Ellipse-Masken, füllt sie mit eingefärbten
Materialausschnitten und zeichnet wenige Linien darüber. Die gebaute Familie
verwendet dafür sogar einen Ausschnitt aus `terrain-materials-master.png`, nicht
das reichere V4-Wandmaster. Die Masken sind bewusst schmal: Bei der gebauten
Nordwand sind Kappe und Front beispielsweise nur wenige Pixel hoch. Das macht
sie sicher, aber im echten Spiel dünn, generisch und weniger plastisch.

**Ziel erreicht?** **Topologie und Rollen weitgehend ja; Mockup-Qualität nein.**
Die Nutzerbeobachtung, dass die Wände wieder minderwertiger aussehen, ist
korrekt.

## Direkt gekoppelte Boden- und Grottenänderungen

Die Wandwirkung wurde nicht nur durch Wand-PNGs beeinflusst:

| Pass | Änderung | Gewünschter Effekt | Ergebnis |
|---|---|---|---|
| V3 | großformatige Fels-, Rohboden-, Covenant- und Feuchtbodenatlanten | weniger Kachelwiederholung, plastischere Umgebung | Material reicher, aber Wandüberstände und Decals liefen teilweise in die Wände |
| V3 | Schutt-, Grabungs-, Moos-, Sporen-, Pfützen- und Inlay-Decals | erzählerische Bodendetails wie im Mockup | im Herzraum hilfreich; großes Grabungsdecal wirkte am Grottengang wie Schmutzauflage |
| V4/V5 | Herzraum vergrößert, Pilzgrotte räumlich getrennt, Besitzkante entfernt | weniger vollgestopfte Szene, sauberere Komposition | Startbereich verbessert; rechteckige Raum-/Wandlogik blieb dominant |
| V6 | braunes Grabungsdecal aus der Laufzeit entfernt | echter Gangboden ohne schmutzige Überlagerung | erreicht |
| V7 | Pilzgrotte als organische 9×9-Naturhöhle und zwei Felder weiter östlich | natürlicher, attraktiver, mehr Abstand zum Herzraum | strukturell erreicht; malerische Makrokomposition des Mockups noch nicht erreicht |

## Inventar: Was liegt im Projekt und was ist wirklich aktiv?

Die hohe Dateizahl ist real:

- **42 PNG-Dateien** liegen allein in `public/assets/generated/style-b-v3/walls/`;
- **64 Dateien** sind projektweit anhand von Namen/Ordnern als Wand-, Schwellen-
  oder Architekturdateien zuzuordnen;
- zusätzlich existieren das V7-Naturmaterial und sein Prompt, obwohl „wall“
  nicht im Dateinamen steht.

Die 64 Dateien verteilen sich auf Foundation-V2-Autotiles, Terrain-V3,
Style-B-V1, Style-B-V3-Quellen und sämtliche Exporte V3 bis V7. Alte Dateien
wurden zur Reproduzierbarkeit nicht überschrieben oder gelöscht.

### Zur Laufzeit aktiv

`src/config/VisualTheme.ts` verweist im Style-B-Modus auf genau sechs
V7-Architekturatlanten: vier Wandfamilien und zwei Schwellenatlanten. Sobald ein
Atlas vorhanden ist, lädt `GameScene` die alten Einzelbilder nicht. Die V7-
Vorschau ist ebenfalls kein Laufzeitasset.

### Im selben Ordner vorhanden, aber aktuell historisch/inaktiv

- ursprüngliche acht V3-Einzelmodule und `wall-atlas.png`;
- V4-Geraden, drei Knotentypen und `wall-atlas-v4.png`;
- V5-Geraden, Knotentypen, vier Kompaktwände, Spieler- und Neutralatlas;
- V6-Geraden und Korridoratlas;
- `architecture-v7-preview.png` als reine Dokumentationsvorschau.

Damit sind von den 42 PNGs im Wall-Ordner **6 aktiv**, **1 eine Vorschau** und
**35 historische Exporte**. Die alten Pfade stehen teilweise noch als Fallback-
Felder im Theme-Objekt, werden im aktiven Atlas-Zweig aber nicht geladen.

## Das große Ganze: Warum es bisher nie wie im Mockup wurde

### 1. Illustration und modularer Baukasten wurden verwechselt

Das Mockup ist ein einmalig komponiertes Gesamtbild. Im Spiel muss dieselbe
Welt aus kombinierbaren Teilen für beliebige Grabungen entstehen. Ein schönes
L-Eckbild genügt dafür nicht; benötigt werden mindestens alle Geraden,
orientierten Außen-/Innenecken, Diagonalen, Gangbreiten und Raumübergänge unter
einem identischen Projektionsvertrag. Dieser vollständige Vertrag existiert
erst seit V7.

### 2. Der Projektionsvertrag wurde nach den Bildern geändert

V3 malte auf Kachelzentren, V4 verschob Wände auf Kanten und Knoten, V5 führte
kompakte Varianten ein, V6 ersetzte Formerkennung durch Semantik, V7 änderte
schließlich den Atlasvertrag auf 16 Frames. Jeder Schritt löste ein echtes
Problem, entwertete aber Annahmen der zuvor gemalten Assets. Wir haben dadurch
mehrmals Renderer und Kunst gleichzeitig umgebaut.

### 3. Geometrie und Kunstqualität wurden abwechselnd priorisiert

V3/V4 kamen dem Mockup malerisch näher, waren aber in beliebigen Gängen
unzuverlässig. Die 32×32-Fassung und V7 sind geometrisch kontrollierbarer,
opfern aber sichtbare Höhe und individuelle Formen. Es gab bislang keinen Pass,
der **auf der finalen V7-Topologie** noch einmal professionell und vollständig
ausgemalt wurde.

### 4. Zu viele Assetgenerationen teilen sich einen Bildschirm

Fels, Böden, Herz, Props, Figuren, V4-Wände, V6-Gänge und V7-Naturmaterial
stammen aus verschiedenen Generierungen und lokalen Ableitungen. Sie besitzen
unterschiedliche Konturhärte, Detailgröße, Perspektive, Schattenrichtung und
Sättigung. Das Mockup wirkt „voller und stimmiger“, weil diese Parameter dort
über die gesamte Szene gleich sind.

### 5. Die falsche Frage „isometrisch oder top-down?“ blieb zu lange offen

Einige generierte Eckteile waren V-förmig/isometrisch, obwohl das Spielraster
orthogonal ist. Dadurch sahen selbst geschlossene Ecken versetzt aus. Der
richtige Zielbegriff ist **orthogonales Top-down mit asymmetrischer 2.5D-
Fassade**, nicht echte Isometrie.

### 6. Einzelasset-Abnahme statt Golden-Screen-Abnahme

Atlanten und Magenta-/Chroma-Vorschauen konnten technisch korrekt aussehen,
während der echte Raum bei Zoom 0,7 oder auf 844×390 scheiterte. Bislang gibt es
keinen automatischen visuellen Regressionstest gegen einen verbindlichen
Golden Screen. Tests sichern Topologie und Mechanik, aber nicht „wirkt die
Südwand plastisch?“ oder „ist die horizontale Wange gleich hell?“.

### 7. 32-Pixel-Logik und fraktionaler Zoom verschärfen jede Inkonsistenz

Das Raster ist nicht grundsätzlich zu klein für 2.5D; die Wandbilder müssen
aber bewusst größer als eine Kachel sein und mit festen Pivots, linearer
Filterung und einer klaren Screen-Space-Detailgrenze entworfen werden. Werden
sie auf schmale In-Kachel-Masken reduziert, verschwinden Tiefe und Material beim
Herauszoomen. Werden sie ohne festen Überlappungsvertrag vergrößert, blockieren
sie optisch Gänge.

## Was heute belastbar funktioniert

- Grid-, Grabungs-, Pfad- und Raummechanik sind grundsätzlich mit dem
  gewünschten orthogonalen 2.5D-Stil kompatibel.
- V7 besitzt explizite Architekturrollen statt visueller Heuristiken.
- Der 16-Frame-Vertrag deckt Gerade, Sackgasse, L, T, Kreuzung,
  Diagonalkontakt und mehrspurige Anschlüsse ab.
- Schwellen sind eine eigene Ebene und müssen nicht mehr durch Wandpfosten
  improvisiert werden.
- Natürliche Grotte und neutrale/befestigte Kammer können visuell vom
  Covenant-Raum getrennt bleiben.
- Alte braune Grabungsüberlagerung ist entfernt.
- Alte Assets sind inaktiv und beeinflussen den aktuellen Renderer nicht
  gleichzeitig.

## Was noch nicht dem Mockup entspricht

- V7-Gebäudewände sind zu dünn und besitzen zu wenig sichtbare Frontfläche.
- Mauerwerk, Messingdetails, Brüche und Kontaktschatten sind zu generisch.
- Große Räume lesen sich wieder stärker als flache Rahmen statt als gebaute
  Kammern.
- Die vier Wandfamilien teilen einen technischen Vertrag, aber noch keinen
  gleichwertig handwerklich ausgearbeiteten Art-Contract.
- Boden, Wand, Herzfundament und Dekor besitzen noch nicht überall dieselbe
  Licht- und Schattenlogik.
- Natürliche Höhlen sind topologisch organischer, aber noch nicht so reich und
  makrokomponiert wie im Mockup.
- Bei weitem Zoom reduziert sich die ohnehin schmale V7-Fassade auf wenige
  Bildschirmpixel.

## Empfohlener nächster Schritt: V7.1 Art-Skin statt V8-Renderer

Der sichere professionelle Weg ist, die funktionierende V7-Architektur zu
**frieren** und nur ihre visuelle Haut neu zu produzieren:

1. `TerrainArchitecture`, `WallLayout`, Grabungsmechanik, Pivots,
   Frame-Reihenfolge und Schwellenlogik bleiben unverändert.
2. Ein einziger freigegebener „Golden Architecture Kit“-Styleframe definiert
   Maßstab, Wandhöhe, Kappenbreite, Südfront, Seitenwangen, Licht und Palette.
3. Auf diesem Vertrag werden vier vollständige 16-Frame-Familien und zwei
   4-Frame-Schwellenatlanten aus **einer** Art-Direction produziert. Das sind 72
   logisch benötigte Frames, aber weiterhin nur sechs Laufzeit-PNGs.
4. Die gebaute Familie erhält wieder echte gemalte Steinblöcke,
   Messingverbindungen und eine tiefe Südfront; sie wird nicht aus einer
   Bodenmaterialprobe koloriert.
5. Korridore bleiben niedriger, benutzen aber dieselbe Stein-, Licht- und
   Kontursprache. Naturwände erhalten bewusst unregelmäßige Konturen innerhalb
   derselben Anker- und Kollisionsgrenzen.
6. Eine feste Testkarte zeigt gleichzeitig vier Raumecken, horizontale und
   vertikale Ein-/Zweifeldgänge, Sackgasse, L, T, Kreuzung sowie alle Übergänge.
7. Abnahme erfolgt im echten Browser bei Zoom 0,7 / 0,88 / 1,12 und mindestens
   1366×768 sowie 844×390 – mit Vorher/Nachher neben dem Mockup.
8. Ein Golden-Screenshot-Test verhindert, dass eine spätere Geometrie- oder
   Performanceänderung unbemerkt wieder die Wandkunst austauscht.
9. Erst nach visueller Freigabe werden die 35 historischen Wall-Exporte in
   einen klaren Archivordner verschoben oder entfernt.

### Was ausdrücklich nicht noch einmal passieren sollte

- kein weiterer Renderer-Umbau, bevor der V7.1-Art-Skin bewertet wurde;
- keine Mischung von V4-Geraden, V6-Gängen und V7-Ecken in derselben Laufzeit;
- keine gedrehten Universalwände für alle Himmelsrichtungen;
- keine Abnahme anhand eines freigestellten Einzelassets;
- kein Austausch gegen kleinere/schmalere Frames allein zur Lösung eines
  Darstellungsfehlers;
- keine ImageGen-Geometrie als Quelle der Topologie – ImageGen darf Material
  und malerische Form liefern, die exakten Masken, Pivots und Framepositionen
  bleiben deterministisch.

## Abschließende Diagnose

Wir haben das Grundproblem jetzt klarer als in den vorherigen Pässen:

> Der Code kann die gewünschte orthogonale 2.5D-Welt darstellen. Die aktive
> V7 löst den geometrischen Vertrag, ist aber noch kein finaler Kunstpass. Das
> Mockup wird erst erreichbar, wenn wir die V7-Topologie unverändert lassen und
> genau dafür einen zusammenhängenden, professionell gemalten Wand- und
> Übergangsbausatz produzieren.

Ein erneuter „Eckenfix“ oder eine weitere Atlasgeneration aus bestehenden
Bodenmaterialien wäre deshalb der falsche nächste Schritt. Der nächste Schritt
ist ein kontrollierter V7.1-Artpass mit Golden Screen und visueller
Abnahmematrix.
