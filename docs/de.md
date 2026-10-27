# M réso Grenoble

## Überblick

Diese Integration bringt **M réso**, das Straßenbahn- und Busnetz des Großraums Grenoble, in Gladys. Sie liefert die **nächsten Abfahrten in Echtzeit, mit ihrer Verspätung**, an den Haltestellen deiner Wahl (drei im Formular, bis zu 10 weitere über eine Schaltfläche), gefiltert nach Linie und Richtung. Sie verfolgt auch die **Verkehrslage** von bis zu sechs Linien (normal, Verkehrsinformation, gestört, stark gestört) mit den Verkehrsmeldungen: Bauarbeiten, Umleitungen, geänderte Fahrpläne. Jede Haltestelle und jede Linie wird zu einem Gerät für ein Dashboard und für Szenen.

Die Daten stammen aus den **offiziellen Open Data von Mobilités M**, dem Mobilitätsdienst des SMMAG, auf `data.mobilites-m.fr` unter der Lizenz ODbL: kein Konto, kein Schlüssel. Sie umfassen M réso und die anderen Netze der Region (Cars Région Isère, Pays Voironnais, Grésivaudan): Eine M réso-Haltestelle liefert auch die Abfahrten der anderen Linien, die dort halten. Jede verfolgte Haltestelle wird mit einer Anfrage gelesen, standardmäßig jede Minute (alle 10 Minuten, solange keine Haltestelle in der nächsten halben Stunde etwas ankündigt, nachts). Die Verkehrslage wird alle 5 Minuten gelesen. Die Linien und Haltestellen der Netze behält die Integration und liest sie einmal am Tag bzw. einmal pro Woche neu.

Eine Abfahrt wird **in Echtzeit verfolgt**, wenn Mobilités M die Position des Fahrzeugs kennt: Ihre geschätzte Zeit und ihre Verspätung werden angegeben. Sonst ist es der **Fahrplan**, markiert mit „(Fahrplan)“. **Ausfallende Fahrten** werden angezeigt.

Dies ist eine **Cloud**-Integration: Sie kontaktiert `data.mobilites-m.fr`. Sonst verlässt nichts dein Netzwerk.

## Voraussetzungen

- Gladys Assistant 5.3.0 oder neuer.
- Sonst nichts: Die Open Data von Mobilités M brauchen weder Konto noch Schlüssel.

## Konfiguration

| Feld                     | Was eingeben                                                                                                      |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| Haltestelle 1, 2, 3      | Der Name der Haltestelle („Chavant“, „Grenoble Hôtel de Ville“) oder ihr Code („SEM:GENCHV“).                     |
| Linie                    | Nur diese Linie: „A“, „C1“, „16“. Leer: alle Linien der Haltestelle.                                              |
| Richtung                 | Nur die Ziele mit diesen Wörtern: „La Poya“, „Fontaine \| Seyssins“. Leer: beide Richtungen.                      |
| Verfolgte Linien         | Die Linien, deren Verkehrslage du verfolgst, höchstens sechs: „A, B, C1, 16“.                                     |
| Abfrage der Haltestellen | Alle 30 Sekunden, jede Minute, alle 2 Minuten oder alle 5 Minuten.                                                |
| Sprache der Texte        | Namen der Geräte, Zusammenfassungen und Ausgaben der Szenen. Haltestellennamen und Meldungen bleiben französisch. |

Die Schaltfläche **Haltestelle suchen** liefert die Haltestellen mit einigen Wörtern, mit ihrem Ort, ihrem Code und ihren Linien („Chavant (Grenoble) [SEM:GENCHV] → A, C, C1, C4“). Wenn zwei Orte einen Namen teilen („Hôtel de Ville“), gib den Ort mit dem Namen ein („Grenoble Hôtel de Ville“) oder kopiere den Code. **Verbindung testen** liest die Netze, jede Haltestelle und jede Linie sofort.

Eine Linie wird wie auf dem Fahrzeug geschrieben: „A“ bis „E“ für die Straßenbahnen, „C1“, „12“… Ein Name, den zwei Netze nutzen (die M réso-Linie „C1“ und der TER „C1“), bezeichnet die von M réso; für die andere gib ihren Code ein („SNC:C1“).

Mehr Haltestellen als die drei des Formulars (Zuhause, Arbeit, Schule…): **Haltestelle hinzufügen** übernimmt dieselben drei Felder — Haltestelle, Linie, Richtung — und verfolgt bis zu 10 weitere Haltestellen. **Haltestellen auflisten** zeigt alle verfolgten Haltestellen nummeriert; **Haltestelle entfernen** nimmt diese Nummer (oder den Namen). Die hinzugefügten Haltestellen werden in der Konfiguration von Gladys gespeichert und folgen damit ihren Sicherungen.

## Verwendung

### Geräte

Lege im Tab **Entdecken** die gewünschten Geräte an:

- **M réso \<Haltestelle\>**: die nächste Abfahrt als Text („A → La Poya · 3 Min. (+2 Min. Verspätung)“), die Wartezeit der nächsten und der folgenden Abfahrt (Minuten) und die Verspätung der nächsten (Minuten, nur veröffentlicht, wenn sie in Echtzeit verfolgt wird);
- **M réso Straßenbahn A**, **M réso Linie C1**, **Cars Région Linie T83**…: die Verkehrslage als Text („Gestörter Betrieb: travaux rue Diderot“) und die Zahl der aktuellen Verkehrsmeldungen.

Nachts, ohne Abfahrt, behalten die Wartezeiten ihren letzten Wert.

### Verkehrslage

Mobilités M gibt jeder Linie einen **Betriebszustand**: normal, gestört oder stark gestört. Er ist der Zustand des Liniengeräts, und **Verkehrsinformation**, wenn der Betrieb normal ist, aber eine Meldung läuft (Nachtbauarbeiten später am Abend, verlegte Haltestelle…). Jede Meldung hat einen Gültigkeitszeitraum („15/07 04:00 → 19/12 03:00“), manchmal Uhrzeiten des Tages („21:30–02:00“) und oft ein Dokument (Umleitungsplan).

### Dashboard-Widgets

![Das Widget M réso Abfahrten an Gares und das Widget M réso Verkehrslage der Straßenbahnen und von Buslinien (generierte Illustration, kein Screenshot)](https://raw.githubusercontent.com/William-De71/gladys-m-reso/main/docs/assets/widgets.de.png)

- **M réso Abfahrten**: die nächsten Abfahrten einer Haltestelle, kompakt. Eine Zeile pro Linie und Ziel, mit ihren nächsten Abfahrten hintereinander („2 · 17 Min.“). Eine ausfallende Fahrt wird angezeigt („entfällt 21:44“) und färbt die Zeile orange, wie eine Verspätung ab 5 Minuten. Die Einstellung **Angezeigte Fahrten** legt die Zahl der Zeilen fest. Wähle eine verfolgte Haltestelle oder gib eine beliebige Haltestelle (und eine Linie) in den Widget-Einstellungen ein. Mit **Mehrere Haltestellen** zeigt ein Widget mehrere Haltestellen-Geräte: Die Geräte einer Haltestelle werden unter ihrem Namen zusammengefasst; bei verschiedenen Haltestellen beginnt jede mit einer eigenen Zeile.
- **M réso Verkehrslage**: der Zustand jeder Linie, dann die aktuellen Meldungen und die der nächsten drei Tage, mit ihrem Zeitraum. Tippe auf eine Karte für den vollständigen Text und das Dokument. Die verfolgten Linien, die in den Einstellungen eingegebenen oder die fünf Straßenbahnlinien, wenn du keine verfolgst.

### Szenen

Auslöser, einmal pro Änderung (die erste Abfrage dient nur als Referenz):

- **M réso: Abfahrt bald**: eine Abfahrt an einer verfolgten Haltestelle fährt in 2, 3, 5, 10, 15 oder 20 Minuten, gezählt nach ihrer Echtzeit-Schätzung.
- **M réso: Abfahrt entfällt**: eine Fahrt der nächsten Stunde an einer verfolgten Haltestelle fällt aus.
- **M réso: Linie gestört**: der Betriebszustand einer verfolgten Linie wird gestört oder stark gestört.
- **M réso: wieder normal**: die Linie hat wieder einen normalen Betriebszustand.
- **M réso: neue Verkehrsmeldung**: Mobilités M veröffentlicht eine Meldung zu einer verfolgten Linie, aktuell oder demnächst.

Jeder liefert einen fertigen Satz, `{{triggerEvent.data.summary}}`, und seine Werte (Linie, Ziel, Zeit, Verspätung, Titel, Text, Beginn und Ende…). Die Aktionen **M réso: nächste Abfahrten** und **M réso: Verkehrslage einer Linie** liefern dieselbe Art von Werten, für eine Nachricht oder eine Bedingung.

Beispiele:

- Wenn die Straßenbahn A Richtung La Poya in 5 Minuten an Victor Hugo abfährt → die Flurlampe grün schalten.
- Wenn eine Abfahrt deiner Haltestelle entfällt oder die C1 gestört ist → die Zusammenfassung vor dem Losgehen aufs Handy schicken.
- Jeden Werktag um 7:30 → die nächsten Abfahrten deiner Haltestelle lesen und vom Küchenlautsprecher ansagen lassen.

### Transport

Nur Cloud: Die Daten kommen aus dem Internet. Nur die Haltestellen, die du verfolgst, werden bei der API von Mobilités M abgefragt, eine nach der anderen.

## Fehlerbehebung

- **„Unbekannt oder mehrdeutig“**: Nutze **Haltestelle suchen** und kopiere dann den genauen Namen (bei Bedarf mit Ort) oder den Code; für eine Linie ihren Namen wie auf dem Fahrzeug („A“, „C1“, „16“) oder ihren Code.
- **„(Fahrplan)“ nach einer Abfahrt**: Mobilités M verfolgt dieses Fahrzeug nicht in Echtzeit; die Zeit ist die des Fahrplans.
- **Keine Abfahrt**: Nachts schläft das Netz; die Haltestelle wird alle 10 Minuten gelesen.
- **„Die Open Data von Mobilités M antworten nicht“**: Die Integration versucht es bei jeder Abfrage erneut; die letzten Abfahrten bleiben in den Widgets.
- **Ein Problem melden**: Drücke **Diagnose** und kopiere dann die Zeilen, die mit „M réso diagnostic“ beginnen, aus dem Tab Protokolle in ein GitHub-Issue oder eine Antwort im Forum, mit den Versionen von Gladys und der Integration.
