// The traps of the Gladys core that the fake Gladys does not catch
// (community feedback, thread 11005): a device is only polled with
// should_poll AND poll_frequency, every feature needs min / max / read_only /
// has_feedback, a wrong category / type pair shows no icon nor label, and a
// single invalid field rejects the whole discovery batch.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import {
  DEVICE_FEATURE_CATEGORIES,
  DEVICE_FEATURE_TYPES,
  DEVICE_FEATURE_UNITS,
} from '@gladysassistant/integration-sdk';

import {
  stopKey,
  followedName,
  idsOf,
  parseExternalId,
  buildStopDevice,
  buildStopStates,
  buildLineDevice,
  buildLineStates,
  lineStatusText,
  DEVICE_TYPES,
} from '../src/device.js';
import { parsePassages } from '../src/departures.js';
import { parseTraffic, lineTraffic } from '../src/traffic.js';
import { LANGUAGES } from '../src/i18n.js';
import {
  fakeGladys,
  NOW,
  TZ,
  STOP_TIMES,
  LEVELS,
  EVENTS,
  stopTimesEntry,
} from './helpers/fixtures.js';

const VH_A = {
  stop: { code: 'SEM:GENVH', name: 'Victor Hugo', city: 'Grenoble', network: 'SEM' },
  line: { id: 'SEM:A', name: 'A', mode: 'tram', network: 'SEM' },
  direction: 'La Poya',
};
VH_A.key = stopKey(VH_A.stop, VH_A.line, VH_A.direction);
VH_A.name = followedName(VH_A);
const GARES = {
  stop: { code: 'SEM:GENGAR', name: 'Gares', city: 'Grenoble', network: 'SEM' },
  line: null,
  direction: '',
};
GARES.key = stopKey(GARES.stop, null, '');
GARES.name = followedName(GARES);
const C1 = { id: 'SEM:C1', name: 'C1', mode: 'bus', network: 'SEM' };
const TRAM_A = { id: 'SEM:A', name: 'A', mode: 'tram', network: 'SEM' };
const T83 = { id: 'C38:T83', name: 'T83', mode: 'bus', network: 'C38' };
const CABLE = { id: 'BUL:BUL', name: 'BUL', mode: 'cable', network: 'BUL' };
const lineName = (code) => code.split(':')[1];

const devices = (language) => [
  buildStopDevice(fakeGladys, VH_A, language),
  buildStopDevice(fakeGladys, GARES, language),
  buildLineDevice(fakeGladys, C1, language),
  buildLineDevice(fakeGladys, TRAM_A, language),
  buildLineDevice(fakeGladys, T83, language),
  buildLineDevice(fakeGladys, CABLE, language),
];

// Pairs with an icon and a label in the Gladys front (front/src/utils/consts.js).
const PAIRS = [
  [DEVICE_FEATURE_CATEGORIES.TEXT, DEVICE_FEATURE_TYPES.TEXT.TEXT, undefined],
  [
    DEVICE_FEATURE_CATEGORIES.DURATION,
    DEVICE_FEATURE_TYPES.DURATION.INTEGER,
    DEVICE_FEATURE_UNITS.MINUTES,
  ],
  [DEVICE_FEATURE_CATEGORIES.COUNTER_SENSOR, DEVICE_FEATURE_TYPES.SENSOR.INTEGER, undefined],
];

test('devices are never polled by Gladys: the integration has its own timer', () => {
  for (const device of devices('en')) {
    assert.equal(device.should_poll, false, device.external_id);
    assert.equal(device.poll_frequency, undefined);
  }
});

test('every feature carries min, max, read_only and has_feedback, in every language', () => {
  for (const language of LANGUAGES) {
    for (const device of devices(language)) {
      for (const feature of device.features) {
        for (const key of ['min', 'max']) {
          assert.equal(typeof feature[key], 'number', `${feature.external_id}.${key}`);
        }
        assert.ok(feature.min <= feature.max, feature.external_id);
        assert.equal(feature.read_only, true, feature.external_id);
        assert.equal(feature.has_feedback, false, feature.external_id);
        assert.ok(feature.name.length > 0 && feature.name.length <= 255);
      }
      const names = new Set(device.features.map((feature) => feature.name));
      assert.equal(names.size, device.features.length, 'every feature has its own name');
    }
  }
});

test('category / type / unit pairs known to the Gladys front, from the SDK constants', () => {
  for (const feature of devices('en').flatMap((device) => device.features)) {
    assert.ok(
      PAIRS.some(
        ([category, type, unit]) =>
          feature.category === category && feature.type === type && feature.unit === unit,
      ),
      `${feature.external_id}: ${feature.category}/${feature.type}/${feature.unit}`,
    );
  }
});

test('ids from the code of the stop, the line code and the direction; read back', () => {
  const [vh, gares, c1, a, t83, cable] = devices('fr');
  assert.equal(vh.external_id, 'ext:m-reso:stop:c-sem-genvh_sem-a_la-poya');
  assert.equal(vh.name, 'M réso Victor Hugo (A → La Poya)');
  assert.equal(gares.external_id, 'ext:m-reso:stop:c-sem-gengar');
  assert.equal(gares.name, 'M réso Gares');
  assert.deepEqual([c1.external_id, c1.name], ['ext:m-reso:line:sem-c1', 'M réso ligne C1']);
  assert.deepEqual([a.external_id, a.name], ['ext:m-reso:line:sem-a', 'M réso tram A']);
  assert.deepEqual(
    [t83.external_id, t83.name],
    ['ext:m-reso:line:c38-t83', 'Cars Région ligne T83'],
  );
  assert.equal(cable.name, 'Téléphérique Grenoble-Bastille');
  assert.deepEqual(parseExternalId('ext:m-reso:stop:c-sem-gengar:wait'), {
    type: 'stop',
    key: 'c-sem-gengar',
  });
  assert.deepEqual(parseExternalId('ext:m-reso:line:sem-a'), { type: 'line', key: 'sem-a' });
  assert.equal(parseExternalId('something'), null);
  // Other accents or case in the direction: the same device.
  assert.equal(stopKey(VH_A.stop, VH_A.line, 'LA POYA'), VH_A.key);
  assert.deepEqual(
    vh.params.map((param) => [param.name, param.value]),
    [
      ['MRESO_STOP', 'SEM:GENVH'],
      ['MRESO_LINE', 'SEM:A'],
      ['MRESO_DIRECTION', 'La Poya'],
    ],
  );
});

test('stop states: the next passage, the two waits and the delay', () => {
  const passages = parsePassages(STOP_TIMES['SEM:GENVH'], {
    lineId: 'SEM:A',
    direction: 'La Poya',
    lineName,
  });
  const states = buildStopStates(fakeGladys, VH_A, passages, {
    language: 'fr',
    now: NOW,
    timeZone: TZ,
  });
  const byKey = Object.fromEntries(
    states.map((s) => [s.device_feature_external_id.split(':').pop(), s.state ?? s.text]),
  );
  // 21:08:30: the A of 21:23, 1 min late (21:24); the one after is not
  // announced yet: its wait is left untouched.
  assert.equal(byKey.wait, 15);
  assert.equal(byKey.delay, 1);
  assert.equal(byKey.next, 'A → La Poya · 15 min (+1 min de retard)');
  assert.equal(byKey.following, undefined);
  // The timetable only: no delay published, the text says it.
  const planned = parsePassages(
    [stopTimesEntry({ times: [{ at: '21:15', state: 'SCHEDULED' }] })],
    {
      lineName,
    },
  );
  const scheduled = buildStopStates(fakeGladys, VH_A, planned, {
    language: 'en',
    now: NOW,
    timeZone: TZ,
  });
  assert.deepEqual(
    scheduled.map((s) => s.device_feature_external_id.split(':').pop()),
    ['next', 'wait'],
  );
  assert.equal(scheduled[0].text, 'A → La Poya · 6 min (timetable)');
  // Nothing announced: the waits are left untouched.
  const empty = buildStopStates(fakeGladys, GARES, [], { language: 'es', now: NOW });
  assert.deepEqual(
    empty.map((s) => s.text),
    ['Ningún paso anunciado'],
  );
});

test('line states: the state with the title of the latest message, the count', () => {
  const traffic = parseTraffic(LEVELS, EVENTS);
  const c5 = { id: 'SEM:C5', name: 'C5', mode: 'bus', network: 'SEM' };
  assert.deepEqual(
    buildLineStates(fakeGladys, c5, lineTraffic(traffic, 'SEM:C5', NOW), 'fr').map(
      (s) => s.text ?? s.state,
    ),
    ['Trafic perturbé : travaux rue Diderot', 1],
  );
  assert.deepEqual(
    buildLineStates(fakeGladys, C1, lineTraffic(traffic, 'SEM:C1', NOW), 'en').map(
      (s) => s.text ?? s.state,
    ),
    ['Normal traffic', 0],
  );
  const [status] = buildLineStates(fakeGladys, TRAM_A, lineTraffic(traffic, 'SEM:A', NOW), 'de');
  assert.equal(status.text, 'Verkehrsinformation: travaux de nuit');
  assert.equal(lineStatusText({ state: 'major', messages: [] }, 'es'), 'Tráfico muy alterado');
});

test('the discovery batch and the states pass the checks of the fake host API', async (t) => {
  const gladys = createFakeGladys({});
  t.after(() => gladys.fake.shutdown());
  await gladys.connect();
  for (const language of LANGUAGES) {
    await gladys.publishDiscoveredDevices([
      buildStopDevice(gladys, VH_A, language),
      buildLineDevice(gladys, TRAM_A, language),
    ]);
  }
  const [stop, line] = gladys.fake.discoveredDevices;
  await gladys.fake.deviceCreated(stop);
  await gladys.fake.deviceCreated(line);
  const passages = parsePassages(STOP_TIMES['SEM:GENVH'], {
    lineId: 'SEM:A',
    direction: 'La Poya',
  });
  await gladys.publishStates(buildStopStates(gladys, VH_A, passages, { language: 'en', now: NOW }));
  const traffic = parseTraffic(LEVELS, EVENTS);
  await gladys.publishStates(
    buildLineStates(gladys, TRAM_A, lineTraffic(traffic, 'SEM:A', NOW), 'en'),
  );
  assert.equal(idsOf(gladys, DEVICE_TYPES.STOP, VH_A.key).device, stop.external_id);
  assert.equal(idsOf(gladys, DEVICE_TYPES.LINE, 'SEM:A').device, line.external_id);
  assert.equal(gladys.fake.lastState(`${stop.external_id}:wait`), 15);
  assert.equal(gladys.fake.lastState(`${line.external_id}:messages`), 1);
});
