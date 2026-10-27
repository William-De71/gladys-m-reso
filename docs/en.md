# M réso Grenoble

## Overview

This integration brings **M réso**, the tram and bus network of the Grenoble area, into Gladys. It gives the **next departures in real time, with their delay**, at the stops you choose (three in the form, up to 10 more with a button), filtered by line and direction. It also follows the **traffic** of up to six lines (normal, traffic information, disrupted, heavily disrupted), with the traffic messages: works, diversions, timetables changed. Each stop and each line becomes a device to show on a dashboard and to use in scenes.

The data come from the **official open data of Mobilités M**, the mobility service of the SMMAG, on `data.mobilites-m.fr` under the ODbL licence: no account, no key. They cover M réso and the other networks of the area (Cars Région Isère, Pays Voironnais, Grésivaudan): an M réso stop also gives the departures of the other lines calling there. Each followed stop is read with one request, every minute by default (every 10 minutes while no stop announces anything in the next half hour, at night). The traffic is read every 5 minutes. The lines and stops of the networks are kept by the integration and read again once a day and once a week.

A departure is **followed in real time** when Mobilités M knows where the vehicle is: its estimated time and its delay are given. Otherwise it is the **timetable**, marked "(timetable)". **Cancelled trips** are shown.

This is a **cloud** integration: it contacts `data.mobilites-m.fr`. Nothing else leaves your network.

## Requirements

- Gladys Assistant 5.3.0 or later.
- Nothing else: the open data of Mobilités M need no account and no key.

## Configuration

| Field                 | What to type                                                                                               |
| --------------------- | ---------------------------------------------------------------------------------------------------------- |
| Stop 1, 2, 3          | The name of the stop ("Chavant", "Grenoble Hôtel de Ville") or its code ("SEM:GENCHV").                    |
| Line                  | Only this line: "A", "C1", "16". Empty: every line of the stop.                                            |
| Direction             | Only the destinations holding these words: "La Poya", "Fontaine \| Seyssins". Empty: both directions.      |
| Followed lines        | The lines whose traffic you follow, six at most: "A, B, C1, 16".                                           |
| Reading of the stops  | Every 30 seconds, minute, 2 minutes or 5 minutes.                                                          |
| Language of the texts | Names of the devices, summaries and outputs of the scenes. Stop names and traffic messages stay in French. |

The **Find a stop** button gives the stops holding a few words, with their town, their code and their lines ("Chavant (Grenoble) [SEM:GENCHV] → A, C, C1, C4"). When two towns share a name ("Hôtel de Ville"), type the town with the name ("Grenoble Hôtel de Ville") or copy the code. **Test the connection** reads the networks, each stop and each line right away.

A line is written as on the vehicle: "A" to "E" for the trams, "C1", "12"… A name used by two networks (the M réso "C1" and the TER "C1") is the M réso one; for the other, type its code ("SNC:C1").

More stops than the three of the form (home, work, school…): **Add a stop** takes the same three fields — stop, line, direction — and follows up to 10 more stops. **List the stops** shows every followed stop, numbered; **Remove a stop** takes that number (or the name). The added stops are kept in the configuration of Gladys, so they follow its backups.

## Usage

### Devices

In the **Discover** tab, create the devices you want:

- **M réso \<stop\>**: the next departure as text ("A → La Poya · 3 min (+2 min late)"), the wait of the next departure and of the one after (minutes), and the delay of the next one (minutes, published only when it is followed in real time);
- **M réso tram A**, **M réso line C1**, **Cars Région line T83**…: the traffic as text ("Disrupted traffic: travaux rue Diderot") and the number of traffic messages under way.

At night, without any departure, the waits keep their last value.

### Traffic

Mobilités M gives each line a **level of service**: normal, disrupted or heavily disrupted. It is the state of the line device, and **traffic information** when the service is normal but a message is under way (works at night later in the evening, a stop moved…). Each message has a period of validity ("15/07 04:00 → 19/12 03:00"), sometimes hours of the day ("21:30–02:00"), and often a document (a diversion map).

### Dashboard widgets

![The M réso departures widget at Gares and the M réso traffic widget of the trams and of bus lines (generated illustration, not a screenshot)](https://raw.githubusercontent.com/William-De71/gladys-m-reso/main/docs/assets/widgets.en.png)

- **M réso departures**: the next departures of a stop, compact. One row per line and destination, with its next departures in a row ("2 · 17 min"). A cancelled trip is shown ("cancelled 21:44") and turns the row orange, like a delay of 5 minutes or more. The **Routes shown** setting sets the number of rows. Choose a followed stop, or type any stop (and a line) in the widget settings. With **Several stops**, one widget shows several stop devices: the devices of one stop are merged under its name; for different stops, each stop opens with a row of its own.
- **M réso traffic**: the state of each line, then the messages under way and those of the next three days, with their period. Tap a card for the full text and the document. The followed lines, the ones typed in the settings, or the five tram lines when you follow none.

### Scenes

Triggers, once per change (the first reading is only a baseline):

- **M réso: departure soon**: a departure at a followed stop leaves in 2, 3, 5, 10, 15 or 20 minutes, counted on its real-time estimate.
- **M réso: departure cancelled**: a trip of the next hour at a followed stop is cancelled.
- **M réso: line disrupted**: the level of service of a followed line becomes disrupted or heavily disrupted.
- **M réso: back to normal**: the line is back to a normal level of service.
- **M réso: new traffic message**: Mobilités M publishes a message about a followed line, under way or coming.

Each gives a ready-made sentence, `{{triggerEvent.data.summary}}`, and its values (line, destination, time, delay, title, text, start and end…). The actions **M réso: next departures** and **M réso: traffic of a line** return the same kind of values, to put in a message or to test in a condition.

Examples:

- When tram A towards La Poya leaves Victor Hugo in 5 minutes → turn the hall lamp green.
- When a departure of your stop is cancelled, or the C1 is disrupted → send the summary to your phone before you leave.
- Every weekday at 7:30 → read the next departures of your stop and have the kitchen speaker announce them.

### Transport

Cloud only: the data come from the internet. Only the stops you follow are asked to the API of Mobilités M, one by one.

## Troubleshooting

- **"Unknown or ambiguous"**: use **Find a stop**, then copy the exact name (with its town if needed) or the code; for a line, its name as on the vehicle ("A", "C1", "16") or its code.
- **"(timetable)" after a departure**: Mobilités M does not follow that vehicle in real time; the time is the one of the timetable.
- **No departure**: at night the network sleeps; the stop is read every 10 minutes.
- **"The open data of Mobilités M do not answer"**: the integration tries again at each reading; the last departures stay on the widgets.
- **To report a problem**: press **Diagnostic**, then copy the lines starting with "M réso diagnostic" from the Logs tab into a GitHub issue or a reply on the forum, with the versions of Gladys and of the integration.
