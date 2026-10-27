import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  stateOfLevel,
  parseMessageDate,
  hoursOf,
  plainText,
  titleOf,
  linkOf,
  messageOf,
  parseTraffic,
  lineTraffic,
  seriousMessages,
} from '../src/traffic.js';
import { LEVELS, EVENTS, NOW, trafficEvent } from './helpers/fixtures.js';

test('the levels of service and the dates of the messages', () => {
  assert.deepEqual([1, 2, 3, 4, undefined].map(stateOfLevel), [
    'normal',
    'disrupted',
    'major',
    'major',
    'normal',
  ]);
  // Paris wall-clock dates.
  assert.equal(parseMessageDate('27/10/2026 04:00'), Date.parse('2026-10-27T03:00:00Z'));
  assert.equal(parseMessageDate('01/07/2026'), Date.parse('2026-06-30T22:00:00Z'));
  assert.equal(parseMessageDate('soon'), null);
  assert.equal(hoursOf('21:30', '02:00'), '21:30–02:00');
  assert.equal(hoursOf('00:00:00', '00:00:00'), '');
  assert.equal(plainText('a  <b>b</b>\r\n\n  c'), 'a b\nc');
  assert.equal(titleOf('', 'La ligne est déviée. Arrêt reporté.'), 'La ligne est déviée.');
  assert.equal(titleOf('x'.repeat(200), '').length, 140);
  assert.equal(
    linkOf('https://www.tag.fr/include/x.php?f=C5 travaux.pdf'),
    'https://www.tag.fr/include/x.php?f=C5%20travaux.pdf',
  );
  assert.equal(linkOf('http://example.com'), '');
});

test('a message: its lines, its level, its period', () => {
  const message = messageOf('k', trafficEvent({ listeLigne: 'SEM_B,SEM_C1,sacado' }));
  assert.deepEqual(message.lineIds, ['SEM:B', 'SEM:C1']);
  assert.equal(message.level, 2);
  assert.equal(message.title, 'travaux Gares');
  assert.equal(message.start, Date.parse('2026-10-27T03:00:00Z'));
  assert.equal(message.end, Date.parse('2026-10-30T02:00:00Z'));
  // The real messages: every one about a line of the fixtures.
  const traffic = parseTraffic(LEVELS, EVENTS);
  assert.equal(traffic.messages.length, Object.keys(EVENTS).length);
  assert.deepEqual(traffic.levels['SEM:C5'].level, 2);
});

test('a line: its level of service, info when a message is under way', () => {
  const traffic = parseTraffic(LEVELS, EVENTS);
  assert.deepEqual(lineTraffic(traffic, 'SEM:B', NOW), {
    state: 'normal',
    since: null,
    messages: [],
    upcoming: [],
  });
  // Works at night on the A, level 1 of service: information.
  const a = lineTraffic(traffic, 'SEM:A', NOW);
  assert.equal(a.state, 'info');
  assert.equal(a.messages[0].hours, '21:30–02:00');
  // The C5 is diverted: disrupted, since 15/07.
  const c5 = lineTraffic(traffic, 'SEM:C5', NOW);
  assert.equal(c5.state, 'disrupted');
  assert.equal(c5.since, LEVELS.SEM_C5.time);
  assert.equal(seriousMessages(c5).length, 1);
  assert.equal(lineTraffic(null, 'SEM:A', NOW).state, 'unknown');
});

test('the coming messages, and the ones over', () => {
  const traffic = parseTraffic(
    { SEM_B: { nsv_id: 3, time: NOW } },
    {
      now: trafficEvent(),
      soon: trafficEvent({
        code: 'SOON',
        dateDebut: '29/10/2026 04:00',
        dateFin: '30/10/2026 03:00',
      }),
      later: trafficEvent({
        code: 'LATER',
        dateDebut: '15/11/2026 04:00',
        dateFin: '16/11/2026 03:00',
      }),
      over: trafficEvent({
        code: 'OVER',
        dateDebut: '20/10/2026 04:00',
        dateFin: '27/10/2026 03:00',
      }),
      hidden: trafficEvent({ code: 'HIDDEN', visibleTC: false }),
    },
  );
  const b = lineTraffic(traffic, 'SEM:B', NOW);
  assert.equal(b.state, 'major');
  assert.deepEqual(
    [b.messages.map((m) => m.id), b.upcoming.map((m) => m.id)],
    [['SEM_TEST'], ['SOON']],
  );
});
