# Gladys M réso

**English** · [Français](README.fr.md) · [Deutsch](README.de.md) · [Español](README.es.md)

[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Latest release](https://img.shields.io/github/v/release/William-De71/gladys-m-reso?sort=semver)](https://github.com/William-De71/gladys-m-reso/releases)
[![CI](https://img.shields.io/github/actions/workflow/status/William-De71/gladys-m-reso/release.yml?branch=main&label=CI)](https://github.com/William-De71/gladys-m-reso/actions/workflows/release.yml)
[![Gladys](https://img.shields.io/badge/Gladys-%E2%89%A5%205.3.0-2f6fb5)](https://gladysassistant.com)

![M réso Grenoble for Gladys Assistant](cover.jpg)

[Gladys Assistant](https://gladysassistant.com) external integration for **M réso**, the trams and buses of Grenoble: the next departures in real time at your stops, with their delay and the cancelled trips, and the traffic of your lines, with scenes and dashboard widgets. It reads the official open data of Mobilités M (SMMAG), without an account or a key.

User documentation: [English](docs/en.md) · [Français](docs/fr.md) · [Deutsch](docs/de.md) · [Español](docs/es.md).

> Community integration, not affiliated with nor endorsed by the SMMAG, M réso or the operators of the networks of Mobilités M.

## Features

- **One device per followed stop** (three in the form, up to 10 more with the **Add a stop** button), typed by name — with its town when two towns share it — or by code, and filtered by **line** and **direction**: next departure, wait of the next two departures, delay of the next one.
- **One device per followed line** (up to six), M réso and the other networks of Mobilités M (Cars Région, Pays Voironnais, Grésivaudan…): its level of service (normal, traffic information, disrupted, heavily disrupted) and the traffic messages under way.
- **Real time**: the estimated time and the delay when the vehicle is followed, the timetable otherwise (marked as such), the cancelled trips.
- **5 scene triggers**, **2 scene actions** and **2 dashboard widgets** (below).
- One request per followed stop, every minute by default (30 s to 5 min, every 10 min at night when nothing is announced), traffic every 5 minutes; lines and stops of the networks kept in `/data`.
- Configuration buttons: test the connection, find a stop (town, code, lines), add / remove / list stops, diagnostic.
- Four languages everywhere: English, French, German, Spanish.

## How it works

![Architecture: Gladys talks to the integration container, which reads the open data API of Mobilités M over the internet (illustration)](docs/assets/architecture.svg)

```mermaid
flowchart LR
  G[Gladys Assistant] <-->|REST /api/integration/v1/* + WebSocket| I[gladys-m-reso container]
  I -->|HTTPS, no key, origin header| A[data.mobilites-m.fr API<br/>stop times, levels of service, messages, lines, stops]
  I --- D[(/data<br/>lines, stops, events seen)]
```

At start, the integration reads the lines (`/routers/default/index/routes`) and the stops (`/points/json?types=clusters`, the "zones d'arrêt": one name in one town) of every network of the area. It then resolves what you typed: "A" is the tram line `SEM:A`, "C1" the Chrono of M réso (the TER "C1" by its code), "Chavant" the stop `SEM:GENCHV`. Then it reads the next departures of each followed stop (`/clusters/<code>/stoptimes`, cancelled trips included) on its own timer, one request per stop, and keeps the ones of the chosen line and direction; every 5 minutes it reads the levels of service (`/dyn/ligne/json`) and the traffic messages (`/dyn/evtTC/json`). Each reading is compared with the previous one to fire the scene triggers.

```mermaid
sequenceDiagram
  participant U as User
  participant G as Gladys
  participant I as Integration
  participant A as API of Mobilités M
  I->>A: lines and stops (once a day / week)
  I->>G: discovered devices (stops, lines)
  U->>G: creates "M réso Victor Hugo (A → La Poya)"
  G->>I: device-created
  loop every minute (stops), 5 minutes (traffic)
    I->>A: departures of each followed stop, levels, messages
    A-->>I: answers
    I->>G: states (next departure, waits, delay, traffic)
    I->>G: scene events (leaving soon, cancelled, disrupted, new message…)
  end
  G->>I: widget-get / scene action
  I-->>G: content from the last reading (read again if older than 90 s)
```

### Transport

Cloud only (`"transports": ["cloud"]`): the catalog shows the cloud badge. The integration contacts `data.mobilites-m.fr`; only the followed stops are asked. There is no local alternative, so there is no "prefer the local connection" button.

## Devices and features

| Device             | Feature                      | Category / type              | Values                                   |
| ------------------ | ---------------------------- | ---------------------------- | ---------------------------------------- |
| M réso \<stop\>    | Next passage                 | `text` / `text`              | "A → La Poya · 3 min (+2 min late)"      |
| M réso \<stop\>    | Wait, wait for the following | `duration` / `integer`       | 0 … 180 min                              |
| M réso \<stop\>    | Delay of the next passage    | `duration` / `integer`       | 0 … 120 min                              |
| M réso tram / line | Traffic                      | `text` / `text`              | "Disrupted traffic: travaux rue Diderot" |
| M réso tram / line | Traffic messages under way   | `counter-sensor` / `integer` | 0 … 20                                   |

At night, without any departure, the waits keep their last value (a 0 would announce a tram now); the delay is published only for a departure followed in real time.

## Scene triggers, actions and widgets

![The two widgets: the next departures at Gares and the traffic of the trams and of bus lines (generated illustration, not a screenshot)](docs/assets/widgets.en.png)

**Scene triggers** (once per transition; the first reading is a reference and fires nothing):

- **Departure soon**: a departure at a followed stop leaves in 2, 3, 5, 10, 15 or 20 minutes, on its real-time estimate. Filters: stop, minutes.
- **Departure cancelled**: a trip of the next hour at a followed stop is cancelled. Filter: stop.
- **Line disrupted**: the level of service of a followed line becomes disrupted or heavily disrupted. Filter: line.
- **Back to normal**: the line is back to a normal level of service. Filter: line.
- **New traffic message**: Mobilités M publishes a message about a followed line, under way or coming. Filters: line, kind (information, disruption, heavy disruption).

**Scene actions**: **next departures** of a stop (line, destination, wait, time, real time or not, delay, the following one, a sentence) and **traffic of a line** (state, messages, latest message, a sentence).

**Widgets**: **M réso departures** (a followed stop, several in one list, or any stop typed in the settings) and **M réso traffic** (the followed lines, the ones typed, or the five tram lines by default).

Examples:

- When **tram A towards La Poya leaves Victor Hugo in 5 minutes** → light the hall lamp in green.
- When **a departure of your stop is cancelled** or **the C1 is disrupted** → send `{{triggerEvent.data.summary}}` to your phone.
- Every weekday at 7:30 → **read the next departures** of your stop and have the `summary` spoken by the kitchen speaker.

## Requirements

- Gladys Assistant **5.3.0** or later (widgets and scene triggers of external integrations, catalog keywords and countries of Gladys 5.3). Older instances cannot install the integration.
- Nothing else: the open data of Mobilités M need neither an account nor a key.

## Installation

- **From the store** of Gladys (Integrations → External integrations), in one click, once indexed.
- **From the repository URL**: `https://github.com/William-De71/gladys-m-reso`.
- **Developer mode**: build the image locally (`docker build -t gladys-m-reso .`) and install it from Gladys.

## Configuration

| Field                 | Description                                                               |
| --------------------- | ------------------------------------------------------------------------- |
| Stop (1 to 3)         | A name ("Chavant", "Grenoble Hôtel de Ville") or a code ("SEM:GENCHV").   |
| Line                  | "A", "C1", "16". Empty: every line of the stop.                           |
| Direction             | Words of the destination: "La Poya", "Fontaine \| Seyssins". Empty: both. |
| Followed lines        | Up to six, separated by commas: "A, B, C1, 16".                           |
| Reading of the stops  | 30 s, 1 min (default), 2 min or 5 min.                                    |
| Language of the texts | Device names, scene summaries and outputs.                                |

Buttons: **Test the connection**, **Find a stop** (town, code and lines of each stop found), **Add a stop**, **Remove a stop**, **List the stops** (the stops beyond the three of the form, kept in the Gladys configuration) and **Diagnostic** (writes the stops, lines, last departures, errors and requests to the Logs tab).

## Usage

1. Enter one to three stops — more with **Add a stop** — (with their line and direction if you wish) and the lines to follow, then save.
2. In the **Discover** tab, create the "M réso …" devices.
3. Add the **M réso departures** and **M réso traffic** widgets to a dashboard, and build scenes with the triggers above.

## Development

```bash
npm install
npm test                       # node --test, never touches the network
npm run lint && npm run format:check
npx github:GladysAssistant/integration-store . --skip-image-check
scripts/build-cover.sh         # cover.jpg from docs/assets/cover.svg
docs/illustrations/render.sh   # docs/assets/widgets.<lang>.png
node .github/scripts/release.mjs next
```

Locally, the SDK reads `GLADYS_HOST_API_URL`, `GLADYS_INTEGRATION_TOKEN` and `GLADYS_INTEGRATION_SELECTOR`; `MRESO_API_URL` points the integration to another API root (a mock); `DEBUG=gladys-integration-sdk` shows the SDK logs and checks every widget content. The tests use real answers of the API of Mobilités M, reduced (`test/fixtures/`, ODbL). The rules of the project are in [CLAUDE.md](CLAUDE.md).

## Release process

![Release pipeline (illustration)](docs/assets/release-pipeline.svg)

Every merge on `main` runs the CI, then computes the version from the [Conventional Commits](https://www.conventionalcommits.org/) since the last tag: `feat` → minor, `fix` / `perf` → patch, `!` or `BREAKING CHANGE` → major (a minor below 1.0.0); `docs`, `chore`, `ci`, `test`, `style`, `refactor`, `build` alone publish nothing. The changelog section is generated, the tag pushed, the multi-architecture image built, then `main` receives the release commit, the GitHub Release is created and a last job checks the public image, the store validator and the topic.

- The pull request title becomes the squash commit, then the changelog line: write it in English, for the user (`pr-title.yml` checks it). Never edit `CHANGELOG.md` by hand.
- 1.0.0 is a decision: Actions → Release → Run workflow with `release-as: 1.0.0`. `dry-run` shows the version and the notes without publishing.
- **Protected branch**: the release pushes its commit to `main` with `GITHUB_TOKEN`. With a ruleset on `main` stricter than "no deletion, no force-push", add GitHub Actions to its bypass list (or push through a GitHub App), otherwise the publish job fails with instructions.
- After the first release, make the `ghcr.io` package public (Package settings → Change visibility), or Gladys cannot pull it.

## Troubleshooting

See [docs/en.md](docs/en.md#troubleshooting). Report issues with the versions of Gladys and of the integration, the stop or line concerned, and the lines of the **Diagnostic** button.

## Contributing

Issues and pull requests are welcome. Run `npm run format:check && npm run lint && npm test` before opening a pull request, and keep every external id and stored key unchanged (see [CLAUDE.md](CLAUDE.md)).

## Security

See [SECURITY.md](SECURITY.md): report vulnerabilities privately. The integration needs no secret: it only reads public open data, and runs read-only, as a non-root user, in its container.

## Screenshots to come

The images above are illustrations, not screenshots. Real screenshots will go in `docs/assets/screenshots/` (PNG, 1280 × 800): `configuration.png`, `discovery.png`, `device.png`, `scene.png`.

## License

[Apache License 2.0](LICENSE) — see also [NOTICE](NOTICE). The departures, lines, stops, levels of service and traffic messages are open data of Mobilités M (SMMAG) under the [Open Database License (ODbL)](https://opendatacommons.org/licenses/odbl/1-0/): the widgets show the source and the time of each reading. Thanks to the Gladys documentation and SDK, and to the SMMAG for publishing these data in real time.
