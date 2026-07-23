# HOLLOW COVENANT
## Verbindlicher Masterplan für einen hochwertigen HTML5-Proof-of-Concept

**Dokumentstatus:** Verbindliche Umsetzungsvorgabe  
**Stand:** 20. Juli 2026  
**Adressat:** Coding-Agent ohne vorherigen Projektkontext  
**Projektphase:** Spielbarer Proof of Concept / Vertical Slice  
**Zielplattform:** Mobile-first im Querformat, zusätzlich Desktop-Browser  
**Arbeitstitel:** `Hollow Covenant`

---

# 0. Auftrag an den Coding-Agenten

Baue einen hochwertigen, klar verständlichen und technisch belastbaren HTML5-Prototypen eines unterirdischen Dungeon-Management-Spiels.

Das Spiel orientiert sich funktional vor allem an:

- **Dwelvers:** sichtbare Rohstoffe, Arbeiterlogistik, Produktionsketten, freie Raumformen, indirekt gesteuerte Einheiten und umkämpfte Ressourcen.
- **Dungeon Keeper 1 und 2:** Graben, Räume, Kreaturenökologie, Dungeon-Herz, Heldenangriffe, Gefängnis, Konvertierung und schwarzer Humor.
- **Mindustry, stark reduziert:** gut lesbare Produktionsengpässe und militärisch relevante Versorgungsketten, aber keine komplexen Förderbandnetze.

Es darf **keine direkte Kopie** bestehender Spiele, Figuren, Begriffe, Raumdesigns, Interface-Strukturen oder konkreter Karten werden.

Der Prototyp muss die folgende Kernthese beweisen:

> Der Spieler gräbt gezielt zu wertvollen Rohstoffquellen, lässt diese sichtbar abbauen und verarbeiten, baut damit eine kleine Armee auf, erobert weitere unterirdische Ressourcen und entscheidet, wie mit besiegten Helden umgegangen wird.

Dieser Masterplan ist verbindlich. Keine zusätzlichen Systeme, Rohstoffe, Räume, Einheiten oder Spielmodi hinzufügen, bevor die hier definierten Abnahmekriterien erfüllt sind.

Bei einer technischen Unklarheit gilt:

1. Die einfachste robuste Lösung wählen.
2. Spielbarkeit und Lesbarkeit über Simulationstiefe stellen.
3. Keine zentrale Designentscheidung eigenmächtig verändern.
4. Abweichungen dokumentieren und begründen.

---

# 1. Produktvision

## 1.1 Elevator Pitch

Unter einer angeblich heiligen Metropole erwacht ein uraltes Dungeon-Herz. Der Spieler gräbt ein unterirdisches Reich aus, erschließt Rohstoffe, betreibt eine sichtbare Wirtschaft, rekrutiert Kreaturen und kämpft gegen konkurrierende Untergrundfraktionen sowie eindringende Helden.

Besiegte Gegner können freigelassen, rekrutiert oder geopfert werden. Dadurch entscheidet der Spieler nicht nur, wie stark sein Dungeon wird, sondern welche Art von Gesellschaft darin entsteht.

## 1.2 Eigenständige Identität

`Hollow Covenant` ist kein reines „böser Dungeon“-Spiel. Der Spieler kann drei Haltungen entwickeln:

- **Zuflucht:** stabile Versorgung, freiwillige Gefolgschaft und geringere Eskalation.
- **Herrschaft:** Opfer, Einschüchterung, schnelle Macht und stärkere Gegenangriffe.
- **Pragmatismus:** situative Entscheidungen ohne maximalen moralischen Bonus.

Gut und Böse dürfen nicht nur Dialogfarben sein. Entscheidungen müssen mindestens einen konkreten Einfluss auf Ressourcen, Einheiten oder Gegnerstärke besitzen.

## 1.3 Designpfeiler

Jede Funktion muss mindestens einem dieser Pfeiler dienen:

1. **Strategisches Graben** – sichtbare Rohstoff-, Raum- und Konfliktziele statt zufälliger Funde.
2. **Sichtbare Wirtschaft** – Rohstoffe existieren als Gegenstände und werden getragen.
3. **Wirtschaft erzeugt Militärmacht** – Güter ermöglichen Einheiten, Fallen und Expansion.
4. **Indirekte Führung** – Arbeiter und Kämpfer handeln automatisch; der Spieler setzt Absichten.
5. **Gefangene verbinden Kampf und Moral** – der Gefangene bleibt sichtbar im Dungeon.
6. **Lesbarkeit vor Systemmenge** – Stillstand und Voraussetzungen müssen erklärt werden.

---

# 2. Harte Produktgrenzen

## 2.1 Enthalten

- eine handgebaute Untergrundkarte;
- eine Mission von etwa 10 Minuten;
- Graben von Gängen und rechteckigen Kammern;
- drei Hauptrohstoffe und drei verarbeitete Güter;
- physische Gegenstände und sichtbaren Transport;
- sechs Raumtypen;
- drei Standard-Kampfeinheiten;
- eine rekrutierbare Heldeneinheit;
- drei Arbeiter zu Beginn;
- zwei umkämpfte Rohstoffstandorte;
- einen natürlichen Rohstoffstandort;
- drei Heldenangriffe;
- ein sichtbares Gefängnis;
- eine Gefangenenentscheidung;
- Vertrauen und Furcht;
- trockenen, sparsamen Sarkasmus;
- Touch-Steuerung im Querformat;
- Desktop-Steuerung.

## 2.2 Ausdrücklich nicht enthalten

- mehrere Dungeon-Ebenen;
- begehbare Oberflächenwelt;
- prozedurale Karten;
- Multiplayer;
- Handel;
- Forschungsbaum;
- individuelle Ausrüstungsslots;
- Waffenqualitäten;
- Lohnsystem;
- komplexe Beziehungen zwischen Kreaturen;
- vollständiges Müdigkeits- oder Stimmungssystem;
- Fallenleitungen;
- Flüssigkeiten oder Förderbänder;
- Ego-Perspektive;
- mehr als vier spielbare Kampfeinheitentypen;
- mehr als sechs Raumtypen;
- finale Grafik;
- Sprachausgabe;
- Monetarisierung;
- Backend oder Konten;
- umfangreiches Savegame-System.

---

# 3. Zielplattform und Bedienphilosophie

## 3.1 Mobile-first bedeutet Querformat

- Smartphone und Tablet: Querformat.
- Desktop: frei skalierbares Browserfenster.
- Im Hochformat erscheint eine blockierende Aufforderung zum Drehen.
- Die Simulation pausiert im Hochformat.

Testauflösungen:

- 740 × 360
- 800 × 360
- 844 × 390
- 915 × 412
- 1024 × 600
- 1280 × 720
- 1920 × 1080

## 3.2 Bedienprinzipien

- Keine Funktion darf Hover voraussetzen.
- Touch-Ziele mindestens 44 × 44 CSS-Pixel.
- Die Karte nimmt den größten Teil des Bildschirms ein.
- Informationen erscheinen kontextbezogen im Bottom Sheet oder Seitenpanel.
- Keine UI darf die Seite horizontal verbreitern.
- Safe-Area-Inset berücksichtigen.
- `ResizeObserver` für Canvas und HUD.
- Kamera nach Rotation, Resize und Panelwechsel neu einpassen.

## 3.3 Kamerasteuerung

### Touch

- Ein Finger im Kameramodus: verschieben.
- Zwei Finger jederzeit: verschieben und Pinch-Zoom.
- `+`, `−` und `Karte`.
- Doppeltipp auf Herz oder Alarm: Kamera springt zum Ereignis.

### Maus/Tastatur

- Mittlere Maustaste oder Leertaste + Ziehen: verschieben.
- Mausrad: Zoom unter Mausposition.
- WASD/Pfeiltasten: bewegen.
- `F`: Karte einpassen.
- `P`: Pause.

### Zoom

- Mindestzoom zeigt die bekannte Karte.
- Standardzoom hält Einheiten und Güter klar erkennbar.
- Maximalzoom etwa 2,0.
- Nearest-Neighbor-Skalierung.

---

# 4. Zielerlebnis der Vertical Slice

## 4.1 Spielzeit

- erster Durchlauf: etwa 10 Minuten;
- Wiederholung: 8–10 Minuten;
- kein Sandbox-Modus.

## 4.2 Missionsziel

Der Spieler muss:

1. Nahrung erschließen;
2. Metallproduktion aufbauen;
3. mindestens zwei zusätzliche Kämpfer rekrutieren;
4. eine von Zwergen kontrollierte Erzader erobern;
5. einen Essenzschrein der Inquisition erobern;
6. einen Inquisitor gefangen nehmen und über sein Schicksal entscheiden;
7. die Finalwelle überstehen.

## 4.3 Niederlage

- Dungeon-Herz fällt auf 0 HP.
- Kein Game Over allein durch Nahrungsmangel.

---

# 5. Prototypkarte

## 5.1 Größe

- 64 × 48 Felder;
- 16 × 16 Pixel Quelltiles;
- standardmäßig 32 × 32 Renderpixel;
- eine orthogonale Top-down-Ebene.

## 5.2 Startbereich

Unterer mittlerer Bereich:

- Herz, 2 × 2 Felder;
- kleine Startkammer;
- drei Arbeiter;
- ein Covenant Guard;
- ein provisorischer Schlafplatz;
- kleines Startlager;
- bekannter Haupteingang im Norden.

Startbestand:

| Gut | Menge |
|---|---:|
| Metallbarren | 10 |
| Rationen | 2 |
| Roherz | 0 |
| Pilzbiomasse | 0 |
| Arkane Essenz | 0 |
| Rüstungsgüter | 0 |

## 5.3 Standorte

### Kleine Eisenader

- westlich/nordwestlich;
- unbewacht;
- 8 Roherz;
- Tutorialquelle.

### Pilzgrotte

- östlich;
- zwei Cave Crawler;
- 16 Pilzbiomasse;
- Sporen und Pilzsilhouetten kündigen sie an.

### Zwergen-Claim

- westlich/nordwestlich;
- 36 Roherz;
- zwei Dwarf Guards und ein Dwarf Crossbow;
- muss erobert und anschließend beansprucht werden.

### Essenzschrein

- nördlich;
- 16 Essenzsplitter;
- zwei Adepten und ein Inquisitor-Captain;
- Captain wird kampfunfähig statt getötet.

### Haupteingang

- nördlicher Kartenrand;
- Spawnpunkt der drei Inquisitionswellen;
- ungefähre Hauptangriffsroute ist erkennbar.

## 5.4 Hinweise durch Fels

- Eisen: rostrote Risse.
- Pilze: grünliche Sporen.
- Essenz: violett-blaues Pulsieren.
- Außenposten: gedämpftes Licht oder Geräuschindikator.
- In vier Feldern Nähe werden genaue Umrisse sichtbar.
- Nach Öffnung einer angrenzenden Wand wird die Kammer aufgedeckt.
- Normales Gestein liefert keinen Rohstoff.
- Keine zufälligen Ressourcenfunde.

---

# 6. Kernschleife

1. Ziel erkennen.
2. Gang/Kammer planen.
3. Arbeiter graben.
4. Rohstoff sichtbar abbauen.
5. Gegenstand liegt in der Welt.
6. Arbeiter transportiert ihn.
7. Produktionsraum verarbeitet ihn.
8. Produkt wird erneut transportiert.
9. Produkt ermöglicht Raum, Einheit oder Falle.
10. Einheit erobert stärkere Rohstoffquelle.
11. Feinde greifen an.
12. Gefangener verändert Wirtschaft, Armee und Bedrohung.

Kein zentraler Schritt darf nur als unsichtbare Zahlenänderung stattfinden.

---

# 7. Graben und Planen

## 7.1 Werkzeuge

### Gang

- orthogonale L-Route;
- Knick vor Bestätigung anpassbar;
- Breite 1 oder optional 2 Felder.

### Kammer

- Rechteck;
- Mindestgröße 2 × 2;
- maximale Einzelplanung 10 × 10.

### Entfernen

- noch nicht bearbeitete Markierungen abwählbar.

## 7.2 Grabfronten

- Erreichbare Fronten werden dynamisch berechnet.
- Maximal zwei Arbeiter an demselben Felsfeld.
- Zweiter Arbeiter beschleunigt um 60 Prozent.
- Dritter Arbeiter sucht andere Aufgabe.
- Kammern erzeugen mehrere parallele Fronten.
- Vorschau zeigt Felder, Fronten und mögliche Arbeiterzahl.

Beispiel:

> 14 Felder geplant · 1 Grabfront · maximal 2 Arbeiter gleichzeitig

## 7.3 Zeiten

| Tätigkeit | Basisdauer |
|---|---:|
| normales Felsfeld | 1,5 s |
| rohstoffhaltiges Feld | 2,2 s |
| ein Rohstoffstück abbauen | 2,5 s |
| ein Bodenfeld beanspruchen | 0,9 s |
| Raumfeld errichten | 0,7 s |

Abweichungen nach Test maximal ±20 Prozent.

## 7.4 Beanspruchen

- Ein offenes Feld wird erst beanspruchbar, wenn es orthogonal an eigenen Boden grenzt.
- Arbeiter verlegen den Covenant-Boden einzeln von der Basis nach außen.
- Feindlicher Boden wird erst nach Beseitigung der zugehörigen Wächter freigegeben.
- Eine Rohstoffquelle gilt als beansprucht, sobald der verlegte Boden ihr Quellenfeld erreicht.
- Claiming ist sichtbar, reserviert und konkurriert fair mit Graben, Abbau und Transport.

---

# 8. Gegenstände, Lager und Logistik

## 8.1 Physische Güter

Rohstoffe:

- Roherz
- Pilzbiomasse
- Essenzsplitter

Produkte:

- Metallbarren
- Rationen
- Rüstungsgüter

Jedes Gut benötigt:

- unterscheidbare Silhouette;
- eigenes Symbol;
- sichtbare Darstellung beim Tragen;
- `×2`, falls zwei identische Einheiten getragen werden.

## 8.2 Tragekapazität

- maximal zwei gleiche Güter;
- Gefangener belegt komplette Kapazität;
- keine unsichtbaren Teleports.

## 8.3 Lager

- frei aufgemalter Raum;
- Mindestgröße zwei Felder;
- kostenfrei auf beanspruchtem Boden;
- ein Stapel pro Feld;
- maximal fünf gleiche Gegenstände pro Stapel;
- keine Filter im Prototyp;
- bei Vollstand klare Anzeige `Lager voll`.

## 8.4 Lieferpriorität

1. Gefangenen-Eskorte;
2. leere benötigte Falle;
3. fehlender Produktionsinput;
4. gefährdete lose Gegenstände;
5. Lagerung;
6. Abbau und Graben.

Produktionsräume dürfen keine globalen Zahlenbestände direkt verbrauchen.

## 8.5 Maschinenstatus

Jeder Raum zeigt:

- Eingangsplätze;
- Ausgangsplätze;
- Fortschritt;
- Blockierungsgrund.

Gründe:

- Kein Eingangsmaterial
- Ausgang voll
- Kein erreichbares Lager
- Raum nicht verbunden
- Produktion pausiert

---

# 9. Rohstoffe und Rezepte

## 9.1 Schmelze

| Input | Dauer | Output |
|---|---:|---|
| 2 Roherz | 6 s | 1 Metallbarren |

## 9.2 Küche

| Input | Dauer | Output |
|---|---:|---|
| 2 Pilzbiomasse | 5 s | 2 Rationen |

## 9.3 Essenz

- Splitter werden zum Herz getragen.
- Ein Splitter ergibt eine Arkane Essenz.
- Keine zusätzliche Maschine.

## 9.4 Werkstatt

| Input | Dauer | Output |
|---|---:|---|
| 1 Metallbarren | 7 s | 2 Rüstungsgüter |

Rüstungsgüter repräsentieren Waffen, Rüstungsteile und Fallenladung.

---

# 10. Räume

Räume werden als Zonen auf beanspruchtem Boden gezogen. Sie erhalten automatisch sichtbare Funktionsobjekte.

Jeder Raum zeigt:

- Name;
- Mindestgröße;
- Kosten;
- Kapazität;
- Input/Output;
- Status.

## 10.1 Lager

| Eigenschaft | Wert |
|---|---|
| Mindestgröße | 2 Felder |
| Kosten | 0 |
| Kapazität | 1 Stapel/Feld |

## 10.2 Schlafkammer

| Eigenschaft | Wert |
|---|---|
| Mindestgröße | 2 × 2 |
| Kosten | `ceil(Felder / 2)` Metall |
| Kapazität | 1 Bett pro 4 Felder |
| Heilung | 5 HP/s |
| Maximalgröße | 4 × 4 |

- Jede normale Kampfeinheit benötigt ein Bett.
- Arbeiter nicht.
- Unter 30 Prozent HP ziehen Einheiten sich zurück, sofern kein Angriffsbanner bindet.
- Betten und Bewohner sind sichtbar.

## 10.3 Pilzküche

| Eigenschaft | Wert |
|---|---|
| Mindestgröße | 2 × 3 |
| Kosten | `2 + ceil(Felder / 3)` Metall |
| Stationen | 1 pro 6 Felder, max. 2 |
| Input | Biomasse |
| Output | Rationen |

## 10.4 Schmelze

| Eigenschaft | Wert |
|---|---|
| Mindestgröße | 2 × 3 |
| Kosten | `3 + ceil(Felder / 3)` Metall |
| Öfen | 1 pro 6 Felder, max. 2 |
| Input | Roherz |
| Output | Metall |

Keine Kohlekette.

## 10.5 Werkstatt

| Eigenschaft | Wert |
|---|---|
| Mindestgröße | 2 × 3 |
| Kosten | `3 + ceil(Felder / 3)` Metall |
| Werkbänke | 1 pro 6 Felder, max. 2 |
| Input | Metall |
| Output | Rüstungsgüter |

## 10.6 Gefängnis

| Eigenschaft | Wert |
|---|---|
| Mindestgröße | 2 × 3 |
| Kosten | `4 + ceil(Felder / 3)` Metall |
| Kapazität | 1 Zelle pro 4 Felder |

- Zellen sichtbar.
- Gefangene antippbar.
- Ohne freie Zelle keine dauerhafte Gefangennahme.
- Kampfunfähiger Gegner erwacht nach 30 Sekunden ohne Transport.

---

# 11. Dungeon-Herz

- Missionsobjekt;
- Rekrutierungspunkt;
- Essenzdepot;
- Erzähler;
- Ziel der Helden.

Werte:

- 300 HP;
- außerhalb eines Angriffs 1 HP/s Regeneration.

## 11.1 Covenant Pulse

- Kosten: 5 Essenz;
- Cooldown: 30 s;
- 25 Schaden an Feinden in 6 Feldern;
- 20 Heilung am Herz;
- klarer Ringeffekt;
- keine starke Bildschirmerschütterung.

## 11.2 Rekrutierungsqueue

- ein aktiver Vorgang;
- maximal drei Einträge;
- Kosten bei Start reservieren;
- Abbruch vor 25 Prozent: 100 Prozent Erstattung;
- danach: 50 Prozent.

---

# 12. Arbeiter

## 12.1 Grundregeln

- drei Arbeiter zu Beginn;
- maximal fünf;
- zusätzlicher Arbeiter: 2 Essenz, 4 s;
- keine Nahrung, Betten oder Löhne;
- Arbeiter kämpfen nicht.

## 12.2 Aufgaben

- graben;
- neutralen oder gesicherten feindlichen Boden feldweise beanspruchen;
- abbauen;
- tragen;
- beliefern;
- Ausgänge leeren;
- Räume errichten;
- Fallen laden;
- Gefangene eskortieren;
- fliehen.

## 12.3 Zustände

- Idle
- MovingToJob
- Digging
- AssistingDig
- Claiming
- Mining
- Hauling
- Delivering
- Building
- SupplyingTrap
- EscortingPrisoner
- Fleeing
- Repathing

Beim Antippen:

- Aufgabe;
- Ziel;
- getragenes Gut;
- Untätigkeitsgrund.

Zulässige Gründe:

- Kein erreichbarer Auftrag
- Alle Aufträge reserviert
- Weg durch Gegner blockiert
- Lager und Ausgänge voll

## 12.4 Job-System

Jeder Job besitzt:

- ID;
- Kategorie;
- Priorität;
- Ziel;
- benötigtes Objekt;
- Reservierung;
- Zeitstempel;
- Erreichbarkeit;
- maximale Arbeiterzahl.

Regeln:

- Reservierung verfällt nach 5 s ohne Fortschritt.
- Ungültiger Weg gibt Job frei.
- Nach Abschluss im selben Simulationstakt neuen Job suchen.
- Nach Felsöffnung Grabfront neu berechnen.
- Gegnerwelle darf Wirtschaftsjobs nicht dauerhaft löschen.
- Fliehende Arbeiter nehmen Arbeit automatisch wieder auf.

## 12.5 Verteilung

Bei mindestens drei Arbeitern:

- eine flexible Logistik-/Claiming-Lane;
- eine flexible Grab-/Claiming-Lane;
- eine flexible Rohstoff-Lane, bei knapper Nahrung mit Biomassevorrang;
- jede Lane übernimmt bei fehlender Kernaufgabe andere erreichbare Arbeit.

## 12.6 Anti-Deadlock

- Repathing nach 1,5 s ohne Positionsfortschritt.
- Freigabe nach zwei gescheiterten Pfaden.
- Kein Teleport im normalen Spiel.
- Debugzähler für Jobs, Idle und Pfadfehler.


# 13. Bedürfnisse der Kampfeinheiten

Der Prototyp verwendet nur zwei Bedürfnisse:

1. Bett
2. Nahrung

## 13.1 Bett

- Voraussetzung für Rekrutierung.
- dauerhaft einer Einheit zugewiesen.
- ermöglicht Heilung.
- ohne Bett keine normale Rekrutierung.

## 13.2 Nahrung

- Eine Ration bei Rekrutierung.
- Danach eine Ration alle 150 Sekunden.
- Außerhalb des Kampfes sucht die Einheit ein Rationslager.
- Im aktiven Angriff verlässt sie ihre Position nicht zum Essen.
- Ohne Nahrung: `Hungrig`, −20 Prozent Bewegung, −15 Prozent Angriffsgeschwindigkeit.
- Kein direkter Lebensverlust.

HUD zeigt Bestand, Produktion, Verbrauch und hungrige Einheiten.

---

# 14. Rekrutierung und spielbare Einheiten

Die Rekrutierung erfolgt im Proof of Concept über das Herz. Räume und Güter sind Voraussetzungen. Ein späteres Vollspiel darf zusätzlich ein Anlocksystem erhalten.

## 14.1 Covenant Guard

- Rolle: Blocker.
- Voraussetzung: freies Bett, Küche, Werkstatt.
- Kosten: 1 Ration, 1 Rüstungsgut.

| Wert | Menge |
|---|---:|
| HP | 100 |
| Schaden | 12 |
| Angriffstakt | 1,0 s |
| Reichweite | 1 |
| Bewegung | 2,2 Felder/s |
| Rekrutierung | 5 s |

Verhalten:

- hält Engstellen;
- verfolgt nicht weiter als sechs Felder vom Banner.

## 14.2 Gloom Archer

- Rolle: Fernkämpfer.
- Voraussetzung: freies Bett, Werkstatt.
- Kosten: 1 Ration, 1 Rüstungsgut.

| Wert | Menge |
|---|---:|
| HP | 60 |
| Schaden | 9 |
| Angriffstakt | 1,2 s |
| Reichweite | 5 |
| Bewegung | 2,4 Felder/s |
| Rekrutierung | 6 s |

- hält etwa drei Felder Abstand;
- zieht sich hinter Guards zurück;
- keine laufenden Munitionskosten.

## 14.3 Hexbinder

- Rolle: Unterstützung.
- Voraussetzung: freies Bett, eroberter Essenzschrein, Küche.
- Kosten: 1 Ration, 3 Essenz.

| Wert | Menge |
|---|---:|
| HP | 55 |
| Schaden | 4 |
| Angriffstakt | 1,5 s |
| Reichweite | 4 |
| Bewegung | 2,2 Felder/s |
| Rekrutierung | 8 s |

Treffer verlangsamt zwei Sekunden um 25 Prozent; nicht stapelbar.

## 14.4 Rekrutierter Inquisitor

- nur über Gefangenenentscheidung;
- Kosten: 2 Rationen, 1 freies Bett;
- maximal einer.

| Wert | Menge |
|---|---:|
| HP | 110 |
| Schaden | 14 |
| Angriffstakt | 1,1 s |
| Reichweite | 4 |
| Bewegung | 2,3 Felder/s |

Alle 12 Sekunden erhält der verbündete Kämpfer mit den niedrigsten HP einen Schild von 20 HP.

---

# 15. Kampfsteuerung

Keine klassische RTS-Einzelauswahl als Hauptmechanik.

## 15.1 Befehle

### Angriffsbanner

- auf erreichbares Zielgebiet setzen;
- alle verfügbaren Kämpfer sammeln sich;
- Feinde im Radius von sechs Feldern werden angegriffen;
- auf Claims und Schreine platzierbar.

### Verteidigungsbanner

- Einheiten halten einen Bereich;
- Standardpunkt ist das Herz;
- Guards vorne, Fernkämpfer dahinter.

### Rückzug

- Einheiten kehren zum Herz oder Bett zurück;
- Verwundete priorisieren Heilung.

### Alarm

- alle Einheiten verteidigen das Herz;
- Kamera kann zum Angriff springen.

## 15.2 Simulation

- Gridbewegung, weich interpoliert.
- Keine Friendly Fire.
- Kein dauerhaftes gegenseitiges Blockieren.
- Treffer: kurzer Flash, kleine Schadenszahl.
- Lebensbalken nur im Kampf oder bei Auswahl.
- Feindpriorität:
  1. aktueller Angreifer;
  2. blockierende Tür/Falle;
  3. Kampfeinheit;
  4. Produktionsraum;
  5. Herz.

## 15.3 Arbeiter in Gefahr

- Gegner in drei Feldern: fliehen.
- getragenes Gut fällt.
- nach zehn sicheren Sekunden wieder arbeiten.

---

# 16. Gegner und Konfliktstandorte

## 16.1 Cave Crawler

| Wert | Menge |
|---|---:|
| HP | 35 |
| Schaden | 5 |
| Angriffstakt | 1,2 s |
| Bewegung | 2,4 |

- bewacht Pilzgrotte;
- verfolgt maximal sechs Felder;
- nicht gefangennehmbar.

## 16.2 Zwerge

### Dwarf Guard

| Wert | Menge |
|---|---:|
| HP | 70 |
| Schaden | 8 |
| Angriffstakt | 1,1 s |

### Dwarf Crossbow

| Wert | Menge |
|---|---:|
| HP | 50 |
| Schaden | 7 |
| Angriffstakt | 1,3 s |
| Reichweite | 4 |

- zunächst territorial;
- Warnung beim Erstkontakt;
- Angriff bei Betreten oder Graben im Claim;
- keine Verfolgung bis zum Herz, solange nicht aktiv bekämpft;
- nach Niederlage Claim beanspruchbar.

Keine Diplomatie im Proof of Concept.

## 16.3 Inquisition

### Scout

| Wert | Menge |
|---|---:|
| HP | 60 |
| Schaden | 8 |
| Angriffstakt | 1,0 s |

### Adept

| Wert | Menge |
|---|---:|
| HP | 55 |
| Fernschaden | 6 |
| Reichweite | 5 |
| Heilung | 10 HP alle 8 s |

### Inquisitor-Captain

| Wert | Menge |
|---|---:|
| HP | 130 |
| Schaden | 14 |
| Angriffstakt | 1,2 s |
| Reichweite | 1 |

Der Schrein-Captain wird bei 0 HP kampfunfähig.

---

# 17. Angriffswellen

## 17.1 Welle 1 – Vermessungstrupp

Start:

- nach erster zusätzlicher Kampfeinheit;
- frühestens 4:30;
- spätestens 6:00.

Gegner:

- 3 Scouts.

Warnung:

- 30 s.

## 17.2 Welle 2 – Säuberungstrupp

Start:

- nach Zwergen-Claim;
- mindestens 2:30 nach Welle 1.

Gegner:

- 4 Scouts;
- 1 Adept.

Warnung:

- 35 s.

## 17.3 Finalwelle – Das Urteil

Start:

- Essenzschrein erobert;
- Gefangenenentscheidung getroffen;
- 60 s Vorbereitung.

Basis:

- 5 Scouts;
- 2 Adepten;
- 1 Elite-Captain.

Modifikation:

- Freilassen: −1 Scout.
- Rekrutieren: unverändert, aber Inquisitor auf Spielerseite.
- Opfern: +1 Elitegegner.

Nach Sieg endet die Mission.

---

# 18. Fallen und Türen

## 18.1 Bolzenfalle

- Baukosten: 2 Metall.
- ein Rüstungsgut lädt sechs Schüsse.
- Arbeiter liefert sichtbar.
- Anzeige `0/6` bis `6/6`.

| Wert | Menge |
|---|---:|
| Schaden | 18 |
| Reichweite | 4 |
| Intervall | 1,0 s |

Leerzustand:

- rotes Symbol;
- `Keine Ladung`;
- automatischer Lieferjob.

## 18.2 Tür

- Kosten: 2 Metall.
- eigene Einheiten passieren.
- Gegner müssen zerstören.
- 120 HP.
- nur eine Türart.

---

# 19. Gefangenenablauf

## 19.1 Kampfunfähigkeit

- Captain fällt sichtbar zu Boden.
- Label `Kampfunfähig`.
- Countdown bis Erwachen.
- freie Zelle erzeugt Eskortjob.

## 19.2 Transport

- Arbeiter läuft zum Captain.
- sichtbares Tragen oder Eskortieren.
- Zelle wird reserviert.
- bei Angriff fällt Gefangener zu Boden.
- Job wird später neu erzeugt.

## 19.3 Zelle

- Gefangener bleibt als Figur sichtbar.
- Name, Rang und Porträt.
- Antippen öffnet Detailpanel.

Beispiel:

> **Inquisitor Severin Vale**  
> Rang: Captain  
> „Seine Überzeugungen sind fest. Seine Tür leider weniger.“

## 19.4 Entscheidungen

### Freilassen

- +15 Vertrauen;
- Finalwelle −1 Scout;
- sichtbarer Abmarsch.

### Rekrutieren

- benötigt 2 Rationen und freies Bett;
- wird Heldeneinheit;
- +5 Vertrauen.

### Opfern

- +6 Essenz;
- +20 Furcht;
- Finalwelle +1 Elitegegner;
- nicht grotesker Effekt.

Vor Bestätigung werden Konsequenzen klar gezeigt.

---

# 20. Vertrauen und Furcht

Start:

- Vertrauen 20
- Furcht 10

## Vertrauen

- ab 40: Bettheilung +10 Prozent.
- ab 60: Hungerintervall +20 Prozent.

## Furcht

- ab 30: Spielereinheiten +8 Prozent Schaden.
- ab 50: Inquisitionswellen +10 Prozent HP.

Keine versteckten Boni.

Nach Sieg:

- dominanter Pfad;
- rekrutierte/verlorene Einheiten;
- transportierte Güter;
- Gefangenenentscheidung;
- Spielzeit.

Keine moralische Verurteilung.

---

# 21. HUD und Informationsdesign

## 21.1 Dauerhaft sichtbar

Kompakte obere Leiste:

- Herz-HP;
- Roherz;
- Metall;
- Biomasse;
- Rationen;
- Essenz;
- Rüstungsgüter;
- Betten belegt/gesamt;
- Wellenstatus;
- Pause/Geschwindigkeit.

Auf schmalen Displays:

- wichtigste Werte direkt;
- Rest aufklappbar;
- kein Seitenoverflow.

## 21.2 Prognosen

Ressourcenpanel zeigt:

- Bestand;
- Produktion/Minute;
- Verbrauch/Minute;
- reservierte Menge;
- lose/eingelagerte Menge.

## 21.3 Kontextpanel

### Rohstoffquelle

- Typ;
- Restmenge;
- beansprucht/feindlich;
- Arbeiterzahl.

### Produktionsraum

- Größe;
- Stationen;
- Input/Output;
- Fortschritt;
- Stillstandsgrund;
- Pause.

### Einheit

- Rolle;
- HP;
- Hunger;
- Bett;
- Aufgabe/Befehl.

### Arbeiter

- Zustand;
- Job;
- getragenes Gut;
- Ziel;
- Idle-Grund.

### Gefängnis

- Zellen;
- Gefangener;
- Entscheidungen.

## 21.4 Bauvorschau

- gültig gold/grün;
- ungültig rot;
- Kosten;
- Kapazität;
- Mindestgröße;
- blockierende Objekte.

Beispiel:

> Schlafkammer · 8 Felder · 4 Metall · 2 Betten

## 21.5 Meldungspriorität

1. Herz angegriffen
2. Gefangener erwacht bald
3. Angriffswelle
4. Nahrung leer
5. Produktion steht
6. Lager voll
7. Bau abgeschlossen

Meldungen sind antippbar und fokussieren das Ereignis.

---

# 22. Tutorial und Missionsführung

## Phase 1 – Etwas Essbares

- Pilzgrotte finden.
- 4 Biomasse bergen.
- Küche bauen.
- 2 Rationen herstellen.

## Phase 2 – Metall ist überzeugender als Moral

- kleine Eisenader erreichen.
- Schmelze bauen.
- 2 Metall produzieren.
- Schlafkammer mit 2 Betten bauen.

## Phase 3 – Eine Armee im Rahmen des Budgets

- Werkstatt bauen.
- 2 Rüstungsgüter herstellen.
- Guard oder Archer rekrutieren.

## Phase 4 – Eigentumsfragen

- Zwergen-Claim erobern.
- reiche Ader beanspruchen.
- 6 Roherz bergen.

## Phase 5 – Das Urteil umkehren

- Essenzschrein erobern.
- Captain gefangen nehmen.
- Entscheidung treffen.
- Finalwelle überstehen.

Kontexttipps erscheinen nur bei echtem Problem und beantworten:

1. Was ist blockiert?
2. Warum?
3. Welche Aktion löst es?

---

# 23. Sarkasmus und Ton

Das Herz ist intelligent, trocken und leicht boshaft.

Regeln:

- maximal ein Kommentar alle 20 s, außer kritisch;
- keine Memes;
- keine aktuellen Popkulturreferenzen;
- keine infantilen Fäkalwitze;
- keine Informationsverschleierung;
- maximal zwei kurze Sätze;
- höchstens 15 unterschiedliche Kommentare.

Beispiele:

- „Die Schmelze wartet auf Erz. Ihre Ansprüche werden zunehmend extravagant.“
- „Das Lager ist voll. Ordnung war offenbar nie Teil des Bundes.“
- „Der Rekrut könnte im Gang schlafen. Seine Loyalität würde sich ähnlich provisorisch entwickeln.“
- „Die Oberfläche schickt erneut Fachpersonal für gescheiterte Invasionen.“
- „Großzügigkeit. Eine bemerkenswert effiziente Form der Verwirrung.“
- „Sein Einspruch wurde aufgenommen, geprüft und in Essenz umgewandelt.“

---

# 24. Grafikstil und Assetstrategie

## 24.1 Stil

- 2D-Top-down-Pixelart;
- dunkle, feuchte Unterwelt;
- klare Silhouetten;
- begrenzte Palette;
- keine Neonfarben;
- warme Lichtquellen gegen kühle Felsfarben;
- Funktionen heben sich klar ab;
- kein Asset-Flip-Eindruck.

## 24.2 Hauptpack: Damp Dungeons

**Link:**  
https://arex-v.itch.io/damp-dungeons

**Primäre Verwendung:**

- Fels;
- Höhlen- und Dungeonboden;
- Wände;
- Wasser/Feuchtigkeit;
- Steine;
- Pilze und Höhlendekoration;
- Fackeln und Umgebungsanimationen;
- natürliche Monster;
- atmosphärische Details.

Ziel:

- mindestens 70 Prozent der sichtbaren Umgebung stammen daraus oder aus Recolors davon.

Lizenz laut Angebotsseite:

- kommerzielle und nichtkommerzielle Nutzung erlaubt;
- Bearbeitung erlaubt;
- Weiterverkauf der Original- oder bearbeiteten Assets als Pack verboten.

Pflicht:

- Seite beim Download erneut prüfen;
- Lizenztext mit Datum lokal sichern;
- Originalarchiv unverändert aufbewahren.

## 24.3 Ergänzungspack: 16x16 DungeonTileset II

**Link:**  
https://0x72.itch.io/dungeontileset-ii

**Primäre Verwendung:**

- Zwergeneinheiten;
- Armbrust/Pfeile;
- Türen;
- Fallen;
- Schalter;
- Kisten;
- Waffen- und Gegenstandssymbole;
- humanoide Ersatzfiguren;
- fehlende Funktionsobjekte.

**Nicht primär verwenden für:**

- großflächige Böden/Wände, wenn Damp Dungeons passt;
- zusätzliche Dekoration ohne Funktion;
- ungefilterte Mischung beider Paletten.

Lizenz:

- CC0;
- Bearbeitung und kommerzielle Nutzung erlaubt;
- Credit nicht erforderlich, aber in Credits aufnehmen.

## 24.4 Asset-Hierarchie

1. Damp Dungeons.
2. DungeonTileset II mit Stilangleichung.
3. einfache eigene/prozedurale Pixelgrafik.
4. Imagegen nur für identitätsstiftende Lücken.
5. keine weiteren Packs ohne Audit.

## 24.5 Stilangleichung

Prüfen:

- Tilegröße;
- Blickwinkel;
- Konturstärke;
- Helligkeit/Sättigung;
- Schattenrichtung;
- Animationsgeschwindigkeit.

Pflicht:

- gemeinsame Palette;
- bei Bedarf Recolors;
- Nearest Neighbor;
- keine gemischten Pixelraster;
- keine Transparenzränder.

## 24.6 Ordner

```text
assets/
  external/
    damp_dungeons/original/
    dungeontileset_ii/original/
  derived/
    terrain/
    units/
    objects/
    ui/
  generated/imagegen/
  licenses/
    DAMP_DUNGEONS_LICENSE.md
    DUNGEONTILESET_II_CC0.md
  manifest/ASSET_MANIFEST.md
```

Originale niemals überschreiben.

## 24.7 Manifest

Vor Integration erstellen:

- Quelle;
- URL;
- Lizenz;
- Datei;
- Maße;
- Animationen;
- Rolle;
- Bearbeitung;
- Status.

Nicht anhand der Shopvorschau annehmen, was enthalten ist.

---

# 25. Imagegen-Regeln

Der Agent darf Imagegen verwenden, aber nicht als Art-Abteilung missverstehen.

## 25.1 Limit

Maximal **sechs Aufrufe** für den Terrain-V3-Qualitätspass.

Keine automatischen Variantenserien. Ein gezielter Korrekturaufruf ist erlaubt,
wenn ein Ergebnis technisch nicht integrierbar ist.

## 25.2 Erlaubte Aufrufe

1. **Terrainmaterial:** Fels, Rohboden oder gebauter Covenant-Boden.
2. **Modulare Kanten:** Wandlippen, Ecken und Besitzränder als Masterquelle.
3. **Raumobjektblatt:** wenige klar getrennte Funktionsobjekte.
4. **Gezielte Korrektur:** nur bei falscher Perspektive oder technisch unbrauchbarem Ergebnis.

## 25.3 Verboten

- ungeprüft direkt generierte Komplett-Tilesets;
- Laufzeitgrafik ohne gespeicherte PNG-Assets;
- Richtungs-Spritesheets;
- vollständige Animationen;
- dutzende Einzelicons;
- finale Art;
- wiederholte Generierung wegen kleiner kosmetischer Fehler.

Erlaubt ist die lokale, reproduzierbare Aufbereitung weniger Imagegen-
Masterquellen zu 32-Pixel-Atlanten. Sichtbare Formen müssen als PNG-Assets im
Projekt liegen; Code wählt nur Frames, Rotationen und Zustände.

## 25.4 Dokumentation

`docs/IMAGEGEN_LOG.md` enthält:

- Zweck;
- Promptzusammenfassung;
- Datei;
- Verwendung;
- Referenz oder direktes Placeholder-Asset.

Nicht integrierbares Ergebnis wird durch einfachen Platzhalter ersetzt.


# 26. Animation und Feedback

## 26.1 Mindestanimationen

- Arbeiter: Idle, Laufen, Arbeiten, Tragen.
- Guard: Idle, Laufen, Angriff, Treffer, Tod.
- Archer: Idle, Laufen, Schuss, Treffer, Tod.
- Hexbinder: Idle, Laufen, Wirken, Treffer, Tod.
- Gegner: Idle, Laufen, Angriff, Tod.
- Gefangener: kampfunfähig und Zellen-Idle.
- Herz: ruhiger Puls.
- Schmelze: Feuer/Glut bei Produktion.
- Küche: Dampf/Kesselbewegung.
- Werkstatt: Funken/Hammer.
- Rohstoffquelle: sichtbarer Abbau.
- Gegenstand: Aufnehmen/Ablegen.

Falls ein Pack keine Animation liefert, genügen zwei bis vier Frames, Sprite-Flip, Skalierung oder Partikel. Keine aufwendige Frame-Produktion.

## 26.2 Transportlesbarkeit

- getragenes Gut sichtbar;
- bei Arbeiterauswahl dünne Ziellinie;
- Ablage mit Snap-Feedback;
- Inputslot leuchtet;
- Produktion startet sichtbar.

## 26.3 Abbau

- Quelle verliert sichtbar Material;
- Gegenstand erscheint am Boden;
- keine sofortige globale Gutschrift;
- HUD unterscheidet lose, eingelagerte und reservierte Güter.

---

# 27. Audio

Externe Soundpacks sind nicht Teil dieses Auftrags.

Erlaubt:

- wenige WebAudio-Signale;
- UI-Klick;
- Grabimpuls;
- Produktionsabschluss;
- Alarm;
- Herzpuls;
- Gefangenenentscheidung.

Nicht erforderlich:

- Musik;
- Sprachausgabe;
- große Soundbibliothek.

Pflicht:

- Mute;
- Lautstärke;
- keine laute Wiedergabe vor Nutzerinteraktion.

---

# 28. Technischer Stack

## 28.1 Verbindliche Basis

- TypeScript
- Vite
- Phaser **3.90.0**
- HTML5 Canvas/WebGL mit Canvas-Fallback
- CSS für HUD
- Vitest
- ESLint oder gleichwertig
- kein React/Vue/Svelte

Phaser 3.90.0 wird für den Proof of Concept bewusst festgeschrieben. Nicht während der Umsetzung auf Phaser 4 migrieren.

Offizielle Seite:

https://phaser.io/download/release/v3.90.0

## 28.2 Struktur

```text
hollow-covenant/
  index.html
  package.json
  vite.config.ts
  tsconfig.json
  src/
    main.ts
    config/
      gameConfig.ts
      balance.ts
      missionConfig.ts
    scenes/
      BootScene.ts
      GameScene.ts
      OverlayScene.ts
    core/
      GameState.ts
      EventBus.ts
      Grid.ts
      TimeController.ts
    data/
      roomDefinitions.ts
      unitDefinitions.ts
      itemDefinitions.ts
      recipes.ts
      dialogue.ts
    entities/
      Unit.ts
      Worker.ts
      CombatUnit.ts
      Enemy.ts
      ItemStack.ts
      ResourceNode.ts
      Room.ts
      Trap.ts
      Prisoner.ts
    systems/
      JobSystem.ts
      PathfindingSystem.ts
      WorkerSystem.ts
      DigSystem.ts
      InventorySystem.ts
      LogisticsSystem.ts
      ProductionSystem.ts
      RoomSystem.ts
      NeedsSystem.ts
      RecruitmentSystem.ts
      CombatSystem.ts
      BannerSystem.ts
      PrisonSystem.ts
      MoralitySystem.ts
      WaveSystem.ts
      TutorialSystem.ts
      NotificationSystem.ts
    ui/
      HudController.ts
      BuildToolbar.ts
      ContextPanel.ts
      ResourcePanel.ts
      ObjectivePanel.ts
      NotificationFeed.ts
      RotateOverlay.ts
    utils/
      math.ts
      assertions.ts
      debug.ts
  tests/
    jobSystem.test.ts
    logistics.test.ts
    production.test.ts
    recruitment.test.ts
    prison.test.ts
    missionFlow.test.ts
  assets/
  docs/
    MASTERPLAN.md
    ASSET_MANIFEST.md
    IMAGEGEN_LOG.md
    QA_REPORT.md
    CHANGELOG.md
```

## 28.3 Architektur

- Simulation und Darstellung trennen.
- Balancewerte nur in Datendateien.
- Keine hartcodierten Rezepte in UI.
- Räume/Einheiten/Rezepte datengetrieben.
- typisierter EventBus.
- UI mutiert nicht direkt globalen Zustand.
- Simulation 10 Hz.
- Rendering bis 60 FPS.
- Bewegung interpolieren.
- seedbarer Zufall; fester Missionsseed.

## 28.4 Weltzustand

Mindestens:

- Tiles;
- bekannte Bereiche;
- Grabmarkierungen;
- Räume;
- Ressourcenknoten;
- Gegenstände;
- Arbeiter;
- Kampfeinheiten;
- Feinde;
- Gefangene;
- Jobs;
- Wellen;
- Ressourcenstatistik;
- Vertrauen/Furcht;
- Missionsphase;
- Zeitstatus.

## 28.5 Pathfinding

- A* auf Grid.
- höhere Kosten für Gefahr/Türen.
- nicht jeden Frame neu berechnen.
- Cache ungültig bei Felsöffnung, Türänderung, Blockade oder Banner.
- ausgelegt für maximal 30 aktive Einheiten.
- Eigenimplementierung nur mit Tests.

## 28.6 Performance

Ziel auf durchschnittlichem Android-Gerät:

- 50–60 FPS;
- nicht dauerhaft unter 40 FPS;
- maximal 30 aktive Einheiten;
- maximal 120 sichtbare lose Gegenstände;
- Offscreen-Güter vereinfacht simulierbar;
- Objektpools für Projektile/Partikel;
- Texturatlas;
- keine Base64-Großbilder im Quellcode.

---

# 29. Responsive Layoutsicherheit

Verbindliche Basis:

```css
html,
body,
#app {
  width: 100%;
  height: 100%;
  max-width: 100vw;
  overflow: hidden;
}
```

Zusätzlich:

- Grid-Kinder `min-width: 0`.
- Ressourcenlisten intern scrollbar.
- Canvas aus sichtbarem Container messen.
- Kamera-Fit nach Start, Rotation, Resize, Vollbild und Panelwechsel.
- Overlays dürfen keine unsichtbare Breite erzeugen.
- automatisierte Viewporttests.

---

# 30. Pause und Geschwindigkeit

Geschwindigkeiten:

- Pause
- 1×
- 2×

Automatisch auf 1× bei:

- Angriffsbeginn;
- feindlichem Claim;
- kampfunfähigem Captain;
- Herz unter 40 Prozent;
- Gefangenenentscheidung.

Entscheidungsdialog pausiert.

---

# 31. Debug und Diagnose

Aktivierung etwa über:

`?debug=1`

Anzeigen:

- FPS;
- Simulationsschritte;
- Jobs nach Kategorie;
- Reservierungen;
- Idle-Arbeiter;
- Pfadfehler;
- Gegenstände;
- Einheiten;
- Missionsphase;
- Wave-Timer.

Aktionen:

- nächste Welle;
- +10 Metall;
- +10 Nahrung;
- Schrein erobern;
- Captain kampfunfähig;
- Pfade einblenden;
- Jobs einblenden;
- Karte aufdecken;
- Neustart.

Im normalen Spiel unsichtbar.

---

# 32. Qualitätssicherung

## 32.1 Automatisierte Tests

### Job-System

- drei Arbeiter vollenden eine 12-Felder-Route;
- neue Grabfront entsteht;
- Reservierungen verfallen;
- blockierter Arbeiter gibt Job frei;
- nach Flucht wird weitergearbeitet;
- gelöschtes Ziel entfernt Job.

### Logistik

- Erz wird aufgenommen;
- Erz erreicht Lager/Schmelze;
- voller Input verhindert Überlieferung;
- voller Output stoppt Produktion;
- Lagerplatz reaktiviert Transport;
- leere Falle erzeugt Lieferjob.

### Produktion

- 2 Erz → 1 Metall nach 6 s;
- 2 Biomasse → 2 Rationen;
- 1 Metall → 2 Rüstungsgüter;
- korrekter Stillstandsgrund.

### Rekrutierung

- ohne Bett blockiert;
- ohne Ration blockiert;
- Kosten reserviert;
- Abbruch erstattet;
- Bett zugewiesen.

### Gefängnis

- Captain erzeugt Eskortjob;
- ohne Zelle kein falscher Transport;
- Erwachen nach 30 s;
- sichtbare Einlieferung;
- Rekrutierungsvoraussetzungen;
- Wellenmodifikation je Entscheidung.

### Mission

- fünf Phasen abschließbar;
- Finalwelle erst nach Entscheidung;
- Sieg nur nach Finalwelle;
- Herz 0 = Niederlage.

## 32.2 Manuelle Szenarien

### A – Arbeiter

- 15-Felder-Gang und 5 × 5-Kammer.
- Kein Arbeiter >3 s ohne erklärten Grund.
- Fronten verteilen sich automatisch.

### B – Erzfluss

- abbauen;
- Gegenstand sehen;
- aufnehmen;
- liefern;
- Input sehen;
- Fortschritt sehen;
- Metallausgang sehen;
- Weitertransport sehen.

### C – Schlafkammer

- zwei Betten;
- zwei Einheiten;
- dritte Rekrutierung scheitert verständlich;
- Verletzter heilt sichtbar.

### D – Falle

- bauen;
- laden;
- sechs Schüsse;
- leer;
- Nachlieferung.

### E – Gefangener

- Captain besiegen;
- sichtbar liegen;
- sichtbar transportieren;
- sichtbar in Zelle;
- Konsequenzen anzeigen;
- Entscheidung wirkt.

### F – Mobile

Auf allen Zielauflösungen:

- Karte erreichbar;
- keine abgeschnittene UI;
- Kamera steuerbar;
- Raumziehen;
- keine ungewollte Kamerabewegung beim Bauen;
- Pinch-Zoom;
- Bottom Sheet blockiert Ziel nicht dauerhaft.

---

# 33. Definition of Done

Fertig erst, wenn:

- Mission vollständig spielbar.
- Graben in zwei Minuten verständlich.
- Rohstoffziele auffindbar.
- drei Arbeiter zuverlässig.
- Idle-Gründe sichtbar.
- Abbau, Transport und Verarbeitung sichtbar.
- Räume erklären Kosten, Nutzen, Input und Output.
- Betten zeigen Kapazität/Bewohner.
- Einheiten rekrutierbar.
- Banner steuern Kämpfer.
- Zwergen-Claim und Schrein eroberbar.
- drei Wellen funktionieren.
- Falle wird sichtbar geladen.
- Captain gefangen und transportiert.
- Gefangener bleibt in Zelle sichtbar.
- drei Entscheidungen funktionieren.
- Vertrauen/Furcht wirken.
- Mobile Querformat funktioniert.
- kein horizontaler Overflow.
- Pflicht-Tests bestehen.
- Lizenzen dokumentiert.
- Imagegen-Limit eingehalten.
- keine Scope-Verletzung.

---

# 34. Umsetzungsphasen

## Phase 0 – Projekt und Asset-Audit

- Vite/TS/Phaser läuft.
- Packs heruntergeladen.
- Lizenzen gesichert.
- Manifest.
- mobile Shell.
- noch kein Imagegen/Kampf/finale UI.

## Phase 1 – Kamera, Karte, Planung

- Rotate Overlay.
- Pan/Zoom/Fit.
- Gang/Kammer.
- Aufdeckung.
- Rohstoffhinweise.
- keine Layoutüberläufe.

## Phase 2 – Arbeiter und Graben

- Job-System.
- mehrere Fronten.
- Assistenz.
- Mining.
- Zustände.
- Deadlock-Diagnose.
- Tests.

Nicht abgeschlossen, solange Arbeiter ohne erklärten Grund stoppen.

## Phase 3 – Logistik und Produktion

- Gegenstände.
- Lager.
- Küche/Schmelze/Werkstatt.
- Puffer.
- Transport.
- Stillstandsgründe.
- Tests.

## Phase 4 – Räume, Bedürfnisse, Rekrutierung

- Schlafkammer.
- Betten.
- Nahrung.
- Herzqueue.
- drei Einheiten.
- Tests.

## Phase 5 – Kampf und Claims

- Banner.
- Höhlenkreaturen.
- Zwerge.
- Schrein.
- Inquisition.
- Tür/Falle.
- Wellen 1 und 2.

## Phase 6 – Gefängnis und Moral

- Captain.
- Eskorte.
- Zellen.
- drei Entscheidungen.
- Vertrauen/Furcht.
- Finalmodifikation.

## Phase 7 – Mission und Polish

- komplette Missionsführung.
- Finalwelle.
- Sieg/Niederlage.
- Sarkasmus.
- visuelle Klarheit.
- minimales Audio.
- Imagegen nur für Restlücken.
- QA.

---

# 35. Berichtsformat des Coding-Agenten

Nach jeder Phase:

1. geänderte Dateien;
2. umgesetzte Systeme;
3. Einschränkungen;
4. Tests;
5. Ergebnisse;
6. Mobile- und Desktop-Screenshot/Video;
7. Risiken;
8. Bestätigung der Scope-Grenzen.

Kernfehler dürfen nicht als „für Prototyp ausreichend“ abgetan werden:

- Arbeiter hängen;
- Pfade brechen;
- Güter teleportieren;
- Stillstand unklar;
- Kamera unsteuerbar;
- UI abgeschnitten;
- Gefangener unsichtbar;
- Voraussetzungen unklar.

---

# 36. Referenz- und Lizenzquellen

Keine konkreten Namen, Grafiken, Texte oder Karten der Referenzspiele kopieren.

## Dungeon Keeper

Dungeon Keeper Manual:

https://archive.org/details/Dungeon_Keeper_Manual

Dungeon Keeper 2 Manual:

https://retrogamer.biz/wp-content/uploads/2016/06/Dungeon-Keeper-2-Manual.pdf

Übernommene Prinzipien:

- Räume als Voraussetzungen;
- eigene Arbeiterklasse;
- Schlafen/Heilung;
- Gefängnis/Konvertierung;
- Kampfrollen;
- Herz und Heldenangriffe.

## Dwelvers

https://store.steampowered.com/app/276870/Dwelvers/

Übernommene Prinzipien:

- Produktionsketten;
- Untergrundressourcen;
- freie Räume;
- AI-Kreaturen;
- sichtbare Versorgung;
- Wirtschaft erzeugt Militärmacht;
- Fallen und menschliche Gegner.

Nicht übernehmen:

- Ebenen;
- großes Crafting;
- Einzelausrüstung;
- Oberfläche;
- Handel;
- Warenmasse.

## Grafikassets

Damp Dungeons:

https://arex-v.itch.io/damp-dungeons

16x16 DungeonTileset II:

https://0x72.itch.io/dungeontileset-ii

## Framework

Phaser 3.90.0:

https://phaser.io/download/release/v3.90.0

---

# 37. Abschließende Leitentscheidung

`Hollow Covenant` soll kein kleineres `Dwelvers` werden.

Verbindliche Zieldefinition:

> Ein zugängliches, mobile-taugliches Dungeon-Management-Spiel, in dem sichtbare Produktionsketten eine kleine indirekt gesteuerte Armee versorgen, wertvolle Rohstofforte aktiv erobert werden und der Umgang mit besiegten Helden bestimmt, welche Gesellschaft unter der Erde entsteht.

Der Proof of Concept ist erfolgreich, wenn diese Verbindung mit einer Karte, drei Rohstoffketten, sechs Räumen und vier Kampfeinheitentypen trägt.

Mehr Content folgt erst, nachdem der Kern zuverlässig, verständlich und spielerisch interessant ist.
