// Scene triggers fire once per transition, with flat payloads within the
// limits of the core; scene actions return their declared outputs only.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  detectReminders,
  detectCancellations,
  detectLineChanges,
  reminderData,
  cancelledData,
  lineEvent,
  nextDeparturesOutputs,
  lineTrafficOutputs,
  pick,
  tolerance,
  TRIGGERS,
  REMINDER_MINUTES,
  NEXT_DEPARTURES_OUTPUTS,
  LINE_TRAFFIC_OUTPUTS,
} from '../src/events.js';
import { parsePassages } from '../src/departures.js';
import { parseTraffic, lineTraffic } from '../src/traffic.js';
import { LANGUAGES } from '../src/i18n.js';
import { NOW, TZ, LEVELS, EVENTS, stopTimesEntry, trafficEvent } from './helpers/fixtures.js';

const manifest = JSON.parse(
  readFileSync(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);
const FOLLOWED = {
  name: 'Victor Hugo (A → La Poya)',
  deviceId: 'ext:m-reso:stop:c-sem-genvh_sem-a_la-poya',
  stop: { code: 'SEM:GENVH', name: 'Victor Hugo' },
};
const lineName = (code) => code.split(':')[1];
const B = {
  id: 'SEM:B',
  name: 'B',
  mode: 'tram',
  network: 'SEM',
  deviceId: 'ext:m-reso:line:sem-b',
};
const A = {
  id: 'SEM:A',
  name: 'A',
  mode: 'tram',
  network: 'SEM',
  deviceId: 'ext:m-reso:line:sem-a',
};
const MINUTE = 60 * 1000;
const at = (time, extra = {}) =>
  parsePassages([stopTimesEntry({ times: [{ at: time, ...extra }] })], { lineName });
const disrupted = (events = { works: trafficEvent() }) =>
  parseTraffic({ SEM_B: { nsv_id: 2, time: NOW } }, events);
const normal = parseTraffic({ SEM_B: { nsv_id: 1, time: NOW } }, {});

/**
 * @description Assert that event data is flat and within the limits of the core.
 * @param {object} data - The data.
 * @param {string} key - The trigger key.
 */
function assertPayload(data, key) {
  const trigger = manifest.scene_triggers.find((entry) => entry.key === key);
  assert.ok(trigger, key);
  assert.ok(Object.keys(data).length <= 30);
  for (const [name, value] of Object.entries(data)) {
    assert.ok(
      value === null || ['string', 'number', 'boolean'].includes(typeof value),
      `${key}.${name}`,
    );
    if (typeof value === 'string') {
      assert.ok(value.length <= 1000, `${key}.${name}`);
    }
  }
  // Every variable is in the data, and every field filters a key of it.
  for (const variable of trigger.variables) {
    assert.ok(variable.key in data, `${key}: variable ${variable.key}`);
  }
  for (const field of trigger.fields) {
    assert.ok(field.key in data, `${key}: field ${field.key}`);
  }
}

test('reminders: once per passage and mark, never on the first reading', () => {
  // 21:13:10 in Paris: 4 min 40 s after 21:08:30.
  const passages = at('21:13:10');
  // First reading of the stop: a baseline.
  const first = detectReminders({ passages, fired: undefined, now: NOW });
  assert.deepEqual(first.due, []);
  assert.equal(first.fired.length, 1);
  // 4 min 40 s before: the 5-minute mark, once.
  const memory = detectReminders({ passages, fired: [], now: NOW });
  assert.deepEqual(
    memory.due.map((entry) => entry.mark),
    [5],
  );
  const again = detectReminders({ passages, fired: memory.fired, now: NOW + 10000 });
  assert.deepEqual(again.due, []);
  // The same trip announced later (a delay) is the same passage: no new 5.
  const later = at('21:13:10', { delay: 40 });
  assert.deepEqual(detectReminders({ passages: later, fired: memory.fired, now: NOW }).due, []);
  // Old reminders are forgotten.
  const forgotten = detectReminders({ passages: [], fired: memory.fired, now: NOW + 20 * MINUTE });
  assert.deepEqual(forgotten.fired, []);
  assert.deepEqual(REMINDER_MINUTES.map(tolerance), [1, 1, 1.5, 3, 3, 3]);
});

test('cancellations: once per trip, within the hour, never on the first reading', () => {
  const passages = parsePassages(
    [
      stopTimesEntry({
        times: [
          { at: '21:20', state: 'CANCELED', trip: 'SEM:1' },
          { at: '22:30', state: 'CANCELED', trip: 'SEM:2' },
          { at: '21:25', trip: 'SEM:3' },
        ],
      }),
    ],
    { lineName },
  );
  assert.deepEqual(detectCancellations({ passages, known: undefined, now: NOW }).due, []);
  const first = detectCancellations({ passages, known: [], now: NOW });
  assert.deepEqual(
    first.due.map((passage) => passage.trip),
    ['SEM:1'],
  );
  assert.deepEqual(detectCancellations({ passages, known: first.known, now: NOW }).due, []);
  for (const language of LANGUAGES) {
    assertPayload(
      cancelledData(FOLLOWED, first.due[0], { language, timeZone: TZ }),
      TRIGGERS.DEPARTURE_CANCELLED,
    );
  }
  assert.equal(
    cancelledData(FOLLOWED, first.due[0], { language: 'fr', timeZone: TZ }).summary,
    'Le A de 21:20 vers La Poya à Victor Hugo est supprimé.',
  );
});

test('departure soon: a flat payload, its summary in every language', () => {
  const [passage] = at('21:13', { delay: 180 });
  for (const language of LANGUAGES) {
    const data = reminderData(FOLLOWED, passage, 5, { language, timeZone: TZ });
    assertPayload(data, TRIGGERS.DEPARTURE_SOON);
    assert.equal(data.minutes, '5');
    assert.equal(data.time, '21:16');
    assert.equal(data.delay_minutes, 3);
  }
  assert.equal(
    reminderData(FOLLOWED, passage, 5, { language: 'fr', timeZone: TZ }).summary,
    'A vers La Poya passe à Victor Hugo dans 5 min (21:16, 3 min de retard).',
  );
  const [onTime] = at('21:13');
  assert.equal(
    reminderData(FOLLOWED, onTime, 5, { language: 'en', timeZone: TZ }).summary,
    'A towards La Poya leaves Victor Hugo in 5 min (21:13).',
  );
});

test('line changes: disrupted, a new message, back to normal', () => {
  // First reading of the line: a baseline, even disrupted.
  const first = detectLineChanges({ lines: [B, A], traffic: disrupted(), seen: {}, now: NOW });
  assert.deepEqual(first.changes, []);
  assert.equal(first.seen['SEM:B'].state, 'disrupted');
  // From normal to disrupted: the disruption and its message.
  const before = detectLineChanges({ lines: [B], traffic: normal, seen: {}, now: NOW - MINUTE });
  const now = detectLineChanges({ lines: [B], traffic: disrupted(), seen: before.seen, now: NOW });
  assert.deepEqual(
    now.changes.map((change) => [change.key, change.message?.state]),
    [
      [TRIGGERS.LINE_DISRUPTED, 'disrupted'],
      [TRIGGERS.TRAFFIC_MESSAGE, 'disrupted'],
    ],
  );
  // The same reading again: nothing.
  const same = detectLineChanges({ lines: [B], traffic: disrupted(), seen: now.seen, now: NOW });
  assert.deepEqual(same.changes, []);
  // A coming message is new too.
  const coming = detectLineChanges({
    lines: [B],
    traffic: disrupted({
      works: trafficEvent(),
      soon: trafficEvent({ code: 'SOON', dateDebut: '29/10/2026 04:00', nsv_id: 1 }),
    }),
    seen: same.seen,
    now: NOW,
  });
  assert.deepEqual(
    coming.changes.map((change) => [change.key, change.message.id]),
    [[TRIGGERS.TRAFFIC_MESSAGE, 'SOON']],
  );
  // Back to a normal level of service.
  const over = detectLineChanges({ lines: [B], traffic: normal, seen: coming.seen, now: NOW });
  assert.deepEqual(
    over.changes.map((change) => [change.key, change.traffic.state]),
    [[TRIGGERS.LINE_RESTORED, 'normal']],
  );
});

test('line events: flat payloads, summaries in every language', () => {
  const traffic = lineTraffic(disrupted(), 'SEM:B', NOW);
  const [message] = traffic.messages;
  for (const language of LANGUAGES) {
    const event = lineEvent(
      { key: TRIGGERS.LINE_DISRUPTED, line: B, traffic, message },
      { language, timeZone: TZ },
    );
    assertPayload(event.data, TRIGGERS.LINE_DISRUPTED);
    const fresh = lineEvent(
      { key: TRIGGERS.TRAFFIC_MESSAGE, line: B, traffic, message },
      { language, timeZone: TZ },
    );
    assertPayload(fresh.data, TRIGGERS.TRAFFIC_MESSAGE);
    const restored = lineEvent(
      { key: TRIGGERS.LINE_RESTORED, line: A, traffic: lineTraffic(normal, 'SEM:A', NOW) },
      { language, timeZone: TZ },
    );
    assertPayload(restored.data, TRIGGERS.LINE_RESTORED);
  }
  const fresh = lineEvent(
    { key: TRIGGERS.TRAFFIC_MESSAGE, line: B, traffic, message },
    { language: 'en', timeZone: TZ },
  );
  assert.deepEqual(
    [fresh.data.line, fresh.data.line_name, fresh.data.kind, fresh.data.start, fresh.data.end],
    ['ext:m-reso:line:sem-b', 'Tram B', 'disrupted', '27/10 04:00', '30/10 03:00'],
  );
  assert.equal(fresh.data.summary, 'Tram B, disruption: travaux Gares');
  const event = lineEvent(
    { key: TRIGGERS.LINE_DISRUPTED, line: B, traffic, message },
    { language: 'fr', timeZone: TZ },
  );
  assert.equal(event.data.summary, 'Tram B : Trafic perturbé (travaux Gares)');
});

test('scene action outputs: declared keys only, flat values', () => {
  const declared = (key) =>
    manifest.scene_actions.find((action) => action.key === key).outputs.map((output) => output.key);
  assert.deepEqual(NEXT_DEPARTURES_OUTPUTS, declared('get_next_departures'));
  assert.deepEqual(LINE_TRAFFIC_OUTPUTS, declared('get_line_traffic'));
  const passages = parsePassages(
    [
      stopTimesEntry({
        times: [
          { at: '21:15', delay: 120 },
          { at: '21:30', state: 'SCHEDULED' },
        ],
      }),
    ],
    { lineName },
  );
  const next = pick(
    nextDeparturesOutputs({ followed: FOLLOWED, passages, now: NOW, language: 'en', timeZone: TZ }),
    NEXT_DEPARTURES_OUTPUTS,
  );
  assert.deepEqual(
    [
      next.found,
      next.line,
      next.minutes,
      next.time,
      next.realtime,
      next.delay_minutes,
      next.following_minutes,
    ],
    [true, 'A', 8, '21:17', true, 2, 21],
  );
  assert.equal(
    next.summary,
    'Next passage at Victor Hugo: A towards La Poya in 8 min. The following one in 21 min.',
  );
  const none = nextDeparturesOutputs({
    followed: FOLLOWED,
    passages: [],
    now: NOW,
    language: 'en',
    timeZone: TZ,
  });
  assert.deepEqual([none.found, none.minutes, none.time, none.realtime], [false, -1, '', false]);
  assert.equal(none.summary, 'No passage announced at Victor Hugo.');
  const traffic = lineTrafficOutputs({
    line: { id: 'SEM:C5', name: 'C5', mode: 'bus', network: 'SEM' },
    traffic: lineTraffic(parseTraffic(LEVELS, EVENTS), 'SEM:C5', NOW),
    language: 'fr',
  });
  assert.deepEqual(
    [
      traffic.line_name,
      traffic.state,
      traffic.disrupted,
      traffic.message_count,
      traffic.state_label,
    ],
    ['Ligne C5', 'disrupted', true, 1, 'Trafic perturbé'],
  );
  for (const value of [...Object.values(next), ...Object.values(traffic)]) {
    assert.ok(['string', 'number', 'boolean'].includes(typeof value));
  }
});
