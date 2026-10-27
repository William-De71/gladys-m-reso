# CLAUDE.md

Project rules for coding assistants (Claude Code reads this file) and for human
contributors.

## What this is

A Gladys Assistant **external integration** for M réso, the tram and bus
network of the Grenoble area, and the other networks of Mobilités M: a Node.js
service (Node 22+, ESM, no build step) that runs in its own sandboxed Docker
container and talks to Gladys through
[`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js),
its only runtime dependency. It reads the official open data API of
Mobilités M (SMMAG, `https://data.mobilites-m.fr/api`, no key, an `origin`
header, ODbL): the next departures of the followed stops in real time — three
in the form, up to 10 more added with the "Add a stop" button —, the level of
service and the traffic messages of the lines, and the lines and stops of the
networks (kept in /data).
Transport: cloud only.
Documentation of the API routes: https://data.mobilites-m.fr/api/routes (each
route used is listed at the top of `src/mreso-api.js`).

## Commands

```bash
npm install
npm test                                  # node --test, the built-in runner
node --test test/widgets.test.js          # one file
DEBUG=gladys-integration-sdk npm test     # with the SDK debug logs
npm run lint                              # ESLint
npm run format:check                      # Prettier, as the CI runs it
npm run format                            # Prettier, fix in place
npx github:GladysAssistant/integration-store . --skip-image-check   # store checks
scripts/build-cover.sh                    # cover.jpg from docs/assets/cover.svg
docs/illustrations/render.sh              # docs/assets/widgets.<lang>.png
node .github/scripts/release.mjs next     # the version the next release would get
```

## Architecture

```
index.js                SDK wiring only (new GladysIntegration + createApp)
src/app.js              every handler, registered before connect(); the timers
src/mreso-api.js        HTTP client of the API of Mobilités M: routes, origin header, errors
src/network.js          lines and stops in /data, typed names -> codes (M réso first)
src/departures.js       stop times -> passages (real time, delay, cancelled, line, destination)
src/traffic.js          levels of service, messages (period, hours, document), the state of a line
src/events.js           scene trigger transitions, payloads, scene action outputs
src/device.js           the stop and line devices and their states
src/widgets.js          departures and traffic dashboard widgets
src/store.js            /data/m-reso.json: network, `seen`
src/time.js             Paris wall-clock dates, times of day (TZ), the service day
src/config.js           configuration (three stops + `added_stops`, lines, interval, language)
src/i18n.js             runtime texts, en / fr / de / es; the brands of the networks
gladys-assistant-integration.json   manifest
docs/{en,fr,de,es}.md   user documentation, re-hosted by the store
docs/illustrations/     generated widget images (render.sh, gen.mjs, render.js)
test/fixtures/          real answers of the API, reduced (ODbL)
.github/scripts/release.mjs         version, changelog, bump (tested in test/)
```

## Rules

- **External ids are forever**, and so is every key users store: device and
  feature external ids (`stop:c-<stop code>_<line code>_<direction>`, e.g.
  `stop:c-sem-genvh_sem-a_la-poya`, `line:<line code>`, e.g. `line:sem-a`: the
  codes of Mobilités M, never a public label that could change), feature
  `category` / `type` / `unit` / `min` / `max` / `step`, the keys of
  `config_schema`, `actions`, the widgets and their settings, scene triggers
  (fields, options, variables) and scene actions (fields, outputs), and the
  internal config keys `added_stops` (`[{ stop, line, direction }]`, stored as
  codes) and `last_language`. `test/structure.test.js` compares them to
  `test/fixtures/discovery.baseline.json`: never update the baseline to make a
  test pass without a documented migration.
- **Category / type pairs.** The next passage and the line traffic are `text`
  / `text`, the waits and the delay `duration` / `integer` in minutes (0-180,
  0-120), the count of messages `counter-sensor` / `integer` (0-20). Without a
  passage the waits are not published (a 0 would announce a tram now); without
  real time the delay is not published.
- **`should_poll` stays false**: the integration reads on its own timer —
  each followed stop in ONE request every `interval` (30 s to 5 min, 1 min by
  default; 10 min while no stop announces anything in the next half hour), one
  stop after the other, devices of one stop sharing the request; the traffic
  (levels and messages) every 5 min; the lines daily after 04:00, the stops
  weekly. A widget or a scene action reuses a reading of less than 90 s. The
  API has no request for several stops: keep the number of stops bounded
  (`MAX_ADDED_STOPS`), Mobilités M asks to be contacted for massive usage.
- **The `origin` header.** Without it the stop times answer 200 with
  `{ "error": … }`: the client always sends it and refuses such a body.
- **Times.** The stop times are true Unix times (`serviceDay` + seconds); the
  messages write Paris wall-clock dates ("15/07/2026 04:00"): parse them with
  `parseMessageDate()`, never `Date.parse()`.
- **Real time.** `realtimeState` `UPDATED` gives the estimate and the delay,
  `SCHEDULED` the timetable only (say it: "(timetable)"), `CANCELED` a
  cancelled trip (left out of the waits, shown in the widget, fired once by
  `departure_cancelled`). Never invent a delay.
- **Traffic.** The state of a line is its level of service (`nsv_id`: 1
  normal, 2 disrupted, 3-4 major), `info` when normal with a message under
  way. A message counts between its start and its end; one starting in the
  next three days is "coming".
- **Events once.** `seen` (in /data) remembers the reminders fired and the
  cancellations reported per stop, the state and messages of each followed
  line. The first reading of a stop or a line is a baseline: nothing fires. A
  scene action or a widget never fires an event.
- **Data licence.** ODbL: keep "Mobilités M" and the time of the reading
  visible in the widgets, and the credit (Mobilités M, SMMAG) in the README,
  the docs and NOTICE.
- **The container rootfs is read-only.** Write only under `/data`.
- **Four languages.** Every user-facing text (manifest, runtime messages in
  `src/i18n.js`, `docs/*.md`, README) exists in English, French, German and
  Spanish. `test/i18n.test.js` checks it. Names of stops, destinations and the
  traffic messages stay in French.
- **Widget images.** After any change to the content of a widget, run
  `docs/illustrations/render.sh` again and look at the four PNG files.
- **Versions belong to the Release workflow**: never edit `version` in
  `package.json`, the lockfile or the manifest, nor the `docker_image` tag.
  The version stays below 1.0.0 until the maintainer runs the Release workflow
  with `release-as: 1.0.0`.
- **Changelog.** Never edit CHANGELOG.md by hand, it is generated at the
  release. Write the PR title as the line the user will read.
- **Commits and PR titles** follow Conventional Commits, in English: `feat` ->
  minor, `fix` / `perf` -> patch, `!` or `BREAKING CHANGE:` -> major (minor
  below 1.0.0); `docs`, `chore`, `ci`, `test`, `style`, `refactor`, `build`
  release nothing.
- **Manifest.** Texts are objects `{ "en", "fr", "de", "es" }`; the catalog
  `description` holds 10 to 100 characters per language; the file stays under
  100 KB. `gladys_version` is `>=5.3.0` (widgets, scene triggers, catalog
  `keywords` and `countries`). Transport: `["cloud"]`. No permission, no
  secret.
- **Forum drafts** (`.github/forum-*.md`) are never committed.
- **Style.** Prettier formats, ESLint catches mistakes. Comments explain why,
  in English. Tests never touch the network (the fake API of
  `test/helpers/fixtures.js`).
