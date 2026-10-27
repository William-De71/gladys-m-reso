// The whole integration against the fake Gladys of the SDK
// (`@gladysassistant/integration-sdk/testing`), which checks the discovered
// devices, the states and the scene events like the host API does, and a
// fake API of Mobilités M serving real (reduced) answers.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';

import { createApp, SCENE_ACTIONS, ACTIONS, IDLE_INTERVAL_MS } from '../src/app.js';
import { WIDGETS } from '../src/widgets.js';
import { TRIGGERS } from '../src/events.js';
import {
  fakeMreso,
  storePath,
  silent,
  stopTimesEntry,
  trafficEvent,
  NOW,
  TZ,
} from './helpers/fixtures.js';

const CONFIG = {
  stop_1: 'Victor Hugo',
  stop_1_line: 'tram A',
  stop_1_direction: 'La Poya',
  stop_2: 'gares',
  stop_3: 'Nulle part',
  lines: 'A, C5, c1, Z9',
  interval: '60',
  language: 'fr',
};
const PREFIX = 'ext:test-integration';
const VH_A = `${PREFIX}:stop:c-sem-genvh_sem-a_la-poya`;
const GARES = `${PREFIX}:stop:c-sem-gengar`;
const A = `${PREFIX}:line:sem-a`;
const C5 = `${PREFIX}:line:sem-c5`;
const C1 = `${PREFIX}:line:sem-c1`;
const MINUTE = 60 * 1000;
const STOP_TIMES = 'stop_times';

/**
 * @description The integration, connected to a fake Gladys and a fake API.
 * @param {object} [options] - `{ config, path, logger }`.
 * @returns {Promise<object>} `{ gladys, app, api, clock, path }`.
 */
async function startApp({ config = CONFIG, path = storePath(), logger = silent } = {}) {
  const clock = { now: NOW };
  const api = fakeMreso();
  const gladys = createFakeGladys({ config });
  const app = createApp(gladys, {
    fetch: api,
    storePath: path,
    now: () => clock.now,
    timeZone: TZ,
    timers: false,
    logger,
  });
  await gladys.connect();
  await app.whenReady();
  return { gladys, app, api, clock, path };
}

const created = async (gladys, externalId) => {
  const device = gladys.fake.discoveredDevices.find((d) => d.external_id === externalId);
  assert.ok(device, `${externalId} is offered`);
  await gladys.fake.deviceCreated(device);
  return device;
};
const eventsOf = (gladys, key) => gladys.fake.sceneEvents.filter((event) => event.key === key);
const stopReads = (app) => app.api.requests.byEndpoint[STOP_TIMES] ?? 0;
/**
 * @description A Paris time of the fixtures' day, some minutes after an instant.
 * @param {number} instant - The instant (ms).
 * @param {number} minutes - Minutes to add.
 * @returns {string} "21:21:30".
 */
const parisTime = (instant, minutes) =>
  new Intl.DateTimeFormat('fr-FR', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(instant + minutes * MINUTE));

test('two stops and three lines become five devices; unknown names are reported', async (t) => {
  const { gladys, api } = await startApp();
  t.after(() => gladys.fake.shutdown());
  assert.deepEqual(
    gladys.fake.discoveredDevices.map((device) => [device.external_id, device.name]),
    [
      [VH_A, 'M réso Victor Hugo (A → La Poya)'],
      [GARES, 'M réso Gares'],
      [A, 'M réso tram A'],
      [C5, 'M réso ligne C5'],
      [C1, 'M réso ligne C1'],
    ],
  );
  const status = gladys.fake.connectionStatus;
  assert.equal(status.connected, true);
  assert.equal(
    status.message.fr,
    'Connecté à Mobilités M : 2 arrêt(s), 3 ligne(s), arrêts lus toutes les 60 s. Inconnu ou ambigu : Nulle part, Z9.',
  );
  // The networks once, one request per stop, the traffic (levels and messages).
  assert.deepEqual(
    api.calls.map((call) => call.path),
    [
      '/routers/default/index/routes',
      '/points/json',
      '/routers/default/index/clusters/SEM:GENVH/stoptimes',
      '/routers/default/index/clusters/SEM:GENGAR/stoptimes',
      '/dyn/ligne/json',
      '/dyn/evtTC/json',
    ],
  );
  assert.equal(api.calls[2].params.showCancelledTrips, 'true');
  // The first readings are a baseline: nothing fires.
  assert.deepEqual(gladys.fake.sceneEvents, []);
});

test('created devices get their states, sent again after the creation', async (t) => {
  const { gladys, app, api, clock } = await startApp();
  t.after(() => gladys.fake.shutdown());
  await created(gladys, VH_A);
  await created(gladys, A);
  await created(gladys, C5);
  // 21:08:30 in Paris: the A of 21:23, one minute late.
  assert.equal(gladys.fake.lastState(`${VH_A}:wait`), 15);
  assert.equal(gladys.fake.lastState(`${VH_A}:delay`), 1);
  assert.equal(gladys.fake.lastState(`${VH_A}:next`), 'A → La Poya · 15 min (+1 min de retard)');
  assert.equal(gladys.fake.lastState(`${A}:status`), 'Info trafic : travaux de nuit');
  assert.equal(gladys.fake.lastState(`${A}:messages`), 1);
  assert.equal(gladys.fake.lastState(`${C5}:status`), 'Trafic perturbé : travaux rue Diderot');
  // Later the tram runs on time; the stop not created gets nothing.
  clock.now += 2 * MINUTE;
  api.state.stopTimes['SEM:GENVH'] = [
    stopTimesEntry({ times: [{ at: '21:23' }, { at: '21:38', delay: 240 }] }),
  ];
  await app.readStops();
  assert.equal(gladys.fake.lastState(`${VH_A}:wait`), 12);
  assert.equal(gladys.fake.lastState(`${VH_A}:following`), 31);
  assert.equal(gladys.fake.lastState(`${VH_A}:delay`), 0);
  assert.equal(gladys.fake.lastState(`${GARES}:next`), undefined);
});

test('departure soon: fired close to its mark, once, between two readings too', async (t) => {
  const { gladys, app, api, clock } = await startApp({
    config: { stop_1: 'Gares', stop_1_line: 'C1', language: 'en' },
  });
  t.after(() => gladys.fake.shutdown());
  clock.now += MINUTE;
  api.state.stopTimes['SEM:GENGAR'] = [
    stopTimesEntry({
      line: 'SEM:C1',
      destination: 'Cité Jean Macé',
      times: [{ at: parisTime(clock.now, 12), trip: 'SEM:42' }],
    }),
  ];
  await app.readStops({ force: true });
  assert.deepEqual(eventsOf(gladys, TRIGGERS.DEPARTURE_SOON), []);
  // Seven minutes later, without a reading: the 5-minute mark (between readings).
  clock.now += 7 * MINUTE + 10000;
  await app.checkReminders();
  const soon = eventsOf(gladys, TRIGGERS.DEPARTURE_SOON);
  assert.deepEqual(
    soon.map((event) => [event.data.minutes, event.data.line, event.data.destination]),
    [['5', 'C1', 'Cité Jean Macé']],
  );
  assert.equal(soon[0].data.stop, `${PREFIX}:stop:c-sem-gengar_sem-c1`);
  assert.equal(soon[0].data.summary, 'C1 towards Cité Jean Macé leaves Gares in 5 min (21:21).');
  await app.checkReminders();
  await app.readStops({ force: true });
  assert.equal(eventsOf(gladys, TRIGGERS.DEPARTURE_SOON).length, 1);
});

test('departure cancelled: fired once per trip of the next hour', async (t) => {
  const { gladys, app, api } = await startApp({ config: { stop_1: 'Gares', language: 'fr' } });
  t.after(() => gladys.fake.shutdown());
  api.state.stopTimes['SEM:GENGAR'] = [
    stopTimesEntry({
      line: 'SEM:B',
      destination: 'Oxford',
      times: [
        { at: '21:30', state: 'CANCELED', trip: 'SEM:7' },
        { at: '21:40', trip: 'SEM:8' },
      ],
    }),
  ];
  await app.readStops({ force: true });
  await app.readStops({ force: true });
  const cancelled = eventsOf(gladys, TRIGGERS.DEPARTURE_CANCELLED);
  assert.deepEqual(
    cancelled.map((event) => [event.data.line, event.data.time, event.data.stop]),
    [['B', '21:30', GARES]],
  );
  assert.equal(cancelled[0].data.summary, 'Le B de 21:30 vers Oxford à Gares est supprimé.');
});

test('a disruption, then back to normal: fired once each, never again after a restart', async (t) => {
  const path = storePath();
  const config = { stop_1: 'Gares', lines: 'B', language: 'fr' };
  const { gladys, app, api, clock } = await startApp({ config, path });
  t.after(() => gladys.fake.shutdown());
  // Tram B diverted.
  api.state.levels.SEM_B = { nsv_id: 2, time: NOW, stops: [] };
  api.state.events.works = trafficEvent();
  await app.trafficTick();
  assert.deepEqual(
    gladys.fake.sceneEvents.map((event) => [event.key, event.data.line_name, event.data.kind]),
    [
      [TRIGGERS.LINE_DISRUPTED, 'Tram B', undefined],
      [TRIGGERS.TRAFFIC_MESSAGE, 'Tram B', 'disrupted'],
    ],
  );
  const [disrupted] = gladys.fake.sceneEvents;
  assert.equal(disrupted.data.line, `${PREFIX}:line:sem-b`);
  assert.deepEqual(
    [disrupted.data.state, disrupted.data.title, disrupted.data.start],
    ['disrupted', 'travaux Gares', '27/10 04:00'],
  );
  assert.equal(disrupted.data.summary, 'Tram B : Trafic perturbé (travaux Gares)');
  // The same reading again: nothing new.
  await app.trafficTick();
  assert.equal(gladys.fake.sceneEvents.length, 2);
  // A restart on the same /data: nothing replayed.
  const second = createFakeGladys({ config });
  t.after(() => second.fake.shutdown());
  const restarted = createApp(second, {
    fetch: api,
    storePath: path,
    now: () => clock.now,
    timeZone: TZ,
    timers: false,
    logger: silent,
  });
  await second.connect();
  await restarted.whenReady();
  assert.deepEqual(second.fake.sceneEvents, []);
  // Back to a normal level of service; the message still runs.
  clock.now += 30 * MINUTE;
  api.state.levels.SEM_B = { nsv_id: 1, time: clock.now, stops: [] };
  await restarted.trafficTick();
  assert.deepEqual(
    second.fake.sceneEvents.map((event) => [event.key, event.data.state]),
    [[TRIGGERS.LINE_RESTORED, 'info']],
  );
});

test('one request per stop, shared by its devices; quiet stops every 10 minutes', async (t) => {
  const { gladys, app, api, clock } = await startApp({
    config: {
      stop_1: 'Gares',
      stop_2: 'Gares',
      stop_2_line: 'A',
      interval: '30',
      added_stops: [
        { stop: 'SEM:GENCHV', line: '', direction: '' },
        { stop: 'SEM:GENVH', line: 'B', direction: '' },
      ],
    },
  });
  t.after(() => gladys.fake.shutdown());
  assert.equal(app.getStops().length, 4);
  const before = stopReads(app);
  clock.now += 31 * 1000;
  await app.readStops();
  assert.equal(stopReads(app), before + 3, 'three stops, four devices');
  // Nothing in the next half hour at any stop (the night): every 10 minutes.
  for (const code of Object.keys(api.state.stopTimes)) {
    api.state.stopTimes[code] = [stopTimesEntry({ times: [{ at: '23:55' }] })];
  }
  clock.now += 31 * 1000;
  await app.readStops();
  const quiet = stopReads(app);
  clock.now += 2 * MINUTE;
  await app.readStops();
  assert.equal(stopReads(app), quiet);
  clock.now += IDLE_INTERVAL_MS;
  await app.readStops();
  assert.equal(stopReads(app), quiet + 3);
});

test('the API down: a clear status, the last departures kept; one stop failing alone', async (t) => {
  const { gladys, app, api, clock } = await startApp();
  t.after(() => gladys.fake.shutdown());
  await created(gladys, VH_A);
  await created(gladys, GARES);
  api.state.fail = 503;
  await app.trafficTick();
  clock.now += 2 * MINUTE;
  await app.readStops();
  assert.equal(gladys.fake.connectionStatus.connected, false);
  assert.match(
    gladys.fake.connectionStatus.message.en,
    /do not answer \(HTTP 503: Service Unavailable\)/,
  );
  // The devices keep their last state.
  assert.equal(gladys.fake.lastState(`${VH_A}:wait`), 15);
  api.state.fail = null;
  await app.trafficTick();
  await app.readStops();
  assert.equal(gladys.fake.connectionStatus.connected, true);
  // One stop failing: the other one is read all the same.
  api.state.failStop = 'SEM:GENVH';
  api.state.stopTimes['SEM:GENGAR'] = [stopTimesEntry({ times: [{ at: '21:20' }] })];
  clock.now += 2 * MINUTE;
  await app.readStops();
  assert.equal(gladys.fake.lastState(`${GARES}:wait`), 7);
  assert.equal(gladys.fake.connectionStatus.connected, true);
});

test('widgets: followed stops, a typed stop, lines; valid in every language', async (t) => {
  const { gladys } = await startApp();
  t.after(() => gladys.fake.shutdown());
  for (const language of ['en', 'fr', 'de', 'es']) {
    const answers = [
      await gladys.fake.widgetGet(WIDGETS.DEPARTURES, { settings: {}, language }),
      await gladys.fake.widgetGet(WIDGETS.DEPARTURES, {
        settings: { stops: [VH_A, GARES] },
        language,
      }),
      await gladys.fake.widgetGet(WIDGETS.DEPARTURES, {
        settings: { stop_name: 'Chavant', line: 'C1' },
        language,
      }),
      await gladys.fake.widgetGet(WIDGETS.TRAFFIC, { settings: {}, language }),
      await gladys.fake.widgetGet(WIDGETS.TRAFFIC, { settings: { lines: 'B' }, language }),
    ];
    for (const answer of answers) {
      assert.equal(answer.success, true);
      assert.deepEqual(validateWidgetContent(answer.data.content), [], language);
    }
  }
  const typed = await gladys.fake.widgetGet(WIDGETS.DEPARTURES, {
    settings: { stop_name: 'Chavant', line: 'C1' },
    language: 'fr',
  });
  const [heading, , status] = typed.data.content.components;
  assert.equal(heading.text, 'Chavant (C1)');
  assert.deepEqual(
    status.items.map((item) => item.label),
    ['C1 → Cité Jean Macé', "C1 → Pré de l'Eau"],
  );
  const unknown = await gladys.fake.widgetGet(WIDGETS.TRAFFIC, {
    settings: { lines: 'Z9' },
    language: 'en',
  });
  assert.equal(unknown.data.content.components[0].text, 'Unknown or ambiguous: Z9.');
});

test('the traffic widget shows the trams when no line is followed', async (t) => {
  const { gladys } = await startApp({ config: { stop_1: 'Gares' } });
  t.after(() => gladys.fake.shutdown());
  const traffic = await gladys.fake.widgetGet(WIDGETS.TRAFFIC, { settings: {}, language: 'fr' });
  assert.deepEqual(
    traffic.data.content.components[1].items.map((item) => [item.label, item.value]),
    [
      ['Tram A', 'Info trafic'],
      ['Tram B', 'Trafic normal'],
      ['Tram C', 'Trafic normal'],
      ['Tram D', 'Trafic normal'],
      ['Tram E', 'Trafic normal'],
    ],
  );
});

test('scene actions: next departures of a stop, traffic of a line', async (t) => {
  const { gladys } = await startApp();
  t.after(() => gladys.fake.shutdown());
  const next = await gladys.fake.sceneAction(SCENE_ACTIONS.GET_NEXT_DEPARTURES, { stop: VH_A });
  assert.equal(next.success, true);
  const { outputs } = next.data;
  assert.deepEqual(
    [
      outputs.found,
      outputs.minutes,
      outputs.realtime,
      outputs.delay_minutes,
      outputs.following_minutes,
    ],
    [true, 15, true, 1, -1],
  );
  assert.equal(outputs.summary, 'Prochain passage à Victor Hugo : A vers La Poya dans 15 min.');
  const traffic = await gladys.fake.sceneAction(SCENE_ACTIONS.GET_LINE_TRAFFIC, { line: C5 });
  assert.deepEqual(
    [
      traffic.data.outputs.state,
      traffic.data.outputs.disrupted,
      traffic.data.outputs.message_count,
      traffic.data.outputs.title,
    ],
    ['disrupted', true, 1, 'travaux rue Diderot'],
  );
  // No field: the first line.
  const first = await gladys.fake.sceneAction(SCENE_ACTIONS.GET_LINE_TRAFFIC, {});
  assert.deepEqual(
    [first.data.outputs.line_name, first.data.outputs.summary],
    ['Tram A', 'Tram A : Info trafic (travaux de nuit)'],
  );
});

test('configuration actions: test, find a stop, diagnostic', async (t) => {
  const { gladys, api } = await startApp();
  t.after(() => gladys.fake.shutdown());
  const tested = await gladys.fake.action(ACTIONS.TEST_CONNECTION);
  assert.equal(tested.success, true);
  const fr = tested.data.message.fr;
  assert.match(fr, /^Open data Mobilités M joint : 22 lignes, 23 arrêts/);
  assert.match(fr, /Victor Hugo \(A → La Poya\) : 1 passage\(s\), prochain A dans 15 min/);
  assert.match(fr, /Tram A : Info trafic · Ligne C5 : Trafic perturbé/);
  assert.match(fr, /inconnu ou ambigu : Nulle part · inconnu ou ambigu : Z9/);
  const found = await gladys.fake.action(ACTIONS.SEARCH_STOP, { query: 'chavant' });
  const text = found.data.message.fr;
  assert.match(text, /^Saisissez le nom/);
  assert.match(text, /\n• Chavant \(Grenoble\) \[SEM:GENCHV\] → A, C, NAVA, C1, C4, C11\n/);
  // A stop without a line today.
  assert.match(text, /\n• Grenoble-Eugène-Chavant \[SNC:OCE87697466\] → –$/);
  // One request per stop found, for its lines.
  assert.equal(api.calls.at(-1).path, '/routers/default/index/clusters/SNC:OCE87697466/routes');
  const short = await gladys.fake.action(ACTIONS.SEARCH_STOP, { query: 'r' });
  assert.match(short.data.message.en, /at least two letters/);
  const none = await gladys.fake.action(ACTIONS.SEARCH_STOP, { query: 'zzz' });
  assert.equal(none.data.message.en, 'No stop matches "zzz".');
  const diagnostic = await gladys.fake.action(ACTIONS.DIAGNOSTIC);
  assert.match(diagnostic.data.message.en, /M réso diagnostic/);
});

test('add, list and remove stops with the buttons, beyond the three of the form', async (t) => {
  const { gladys, app } = await startApp();
  t.after(() => gladys.fake.shutdown());
  const added = await gladys.fake.action(ACTIONS.ADD_STOP, { stop: 'sem:genchv', line: 'c1' });
  assert.match(added.data.message.en, /^Stop added: Chavant \(C1\)\. 3 stop\(s\)/);
  assert.deepEqual(gladys.fake.config.added_stops, [
    { stop: 'SEM:GENCHV', line: 'SEM:C1', direction: '' },
  ]);
  assert.ok(
    gladys.fake.discoveredDevices.some(
      (device) => device.external_id === `${PREFIX}:stop:c-sem-genchv_sem-c1`,
    ),
  );
  const snapshot = app.getSnapshot('c-sem-genchv_sem-c1');
  assert.ok(snapshot.passages.length > 0);
  assert.ok(snapshot.passages.every((p) => p.lineId === 'SEM:C1'));
  const again = await gladys.fake.action(ACTIONS.ADD_STOP, { stop: 'Chavant', line: 'C1' });
  assert.match(again.data.message.en, /already followed/);
  const unknown = await gladys.fake.action(ACTIONS.ADD_STOP, { stop: 'Nowhere' });
  assert.equal(unknown.data.message.en, 'Unknown or ambiguous: Nowhere.');
  const list = await gladys.fake.action(ACTIONS.LIST_STOPS);
  assert.equal(
    list.data.message.fr,
    '4 arrêt(s) suivi(s) :\n' +
      '1. Victor Hugo (A → La Poya) (formulaire, arrêt 1)\n' +
      '2. Gares (formulaire, arrêt 2)\n' +
      '3. Nulle part (formulaire, arrêt 3, inconnu ou ambigu)\n' +
      '4. Chavant (C1)',
  );
  const inForm = await gladys.fake.action(ACTIONS.REMOVE_STOP, { stop: '2' });
  assert.match(inForm.data.message.en, /is stop 2 of the form/);
  const removed = await gladys.fake.action(ACTIONS.REMOVE_STOP, { stop: '4' });
  assert.match(removed.data.message.en, /^Stop removed: Chavant \(C1\)/);
  assert.deepEqual(gladys.fake.config.added_stops, []);
  assert.equal(app.getStops().length, 2);
});
