# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions
follow [Semantic Versioning](https://semver.org/). This file is generated at
each release from the Conventional Commits: do not edit it by hand.

## [0.1.0] - unreleased

### Added

- One device per followed stop of the Grenoble area (three in the form and up to 10 more with the "Add a stop" button, typed by name or by code, filtered by line and direction): the next departure as text, the wait of the next two departures and the delay of the next one, in real time, from the official open data of Mobilités M.
- One device per followed line (up to six), M réso trams and buses and the other networks of Mobilités M: its traffic state as Mobilités M gives it (normal, traffic information, disrupted, heavily disrupted) and the number of traffic messages under way.
- Scene triggers: departure soon (2 to 20 minutes before, on the real-time estimate), departure cancelled, line disrupted, back to normal, and a new traffic message about a followed line.
- Scene actions: read the next departures of a stop (with the delay), and read the traffic of a line, each with a ready-made sentence.
- Dashboard widgets: the next departures of one or several stops, like the screens of the stops, with cancelled trips and delays highlighted (any stop can be typed in the widget); the traffic of lines with the full messages, their period and their document, the five tram lines by default.
- Configuration actions: test the connection, find a stop by name (with its town, its code and its lines), add, list and remove stops, and a diagnostic written to the Logs tab.
- Cloud transport: the official open data API of Mobilités M (SMMAG), no account and no key; one request per followed stop every 30 seconds to 5 minutes, traffic every 5 minutes; lines and stops of the networks kept in /data.
- English, French, German and Spanish everywhere: settings, devices, widgets, scenes and documentation.
