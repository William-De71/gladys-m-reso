import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  directionTerms,
  lineIdOf,
  parsePassages,
  minutesLeft,
  upcomingPassages,
  cancelledPassages,
  routeOf,
} from '../src/departures.js';
import { STOP_TIMES, NOW, stopTimesEntry } from './helpers/fixtures.js';

const lineName = (code) => code.split(':')[1];
const GARES = STOP_TIMES['SEM:GENGAR'];

test('a pattern: its line, its destination, the real-time estimate and the delay', () => {
  const [first] = parsePassages([stopTimesEntry({ times: [{ at: '21:15', delay: 150 }] })], {
    lineName,
  });
  assert.equal(first.lineId, 'SEM:A');
  assert.equal(first.line, 'A');
  assert.equal(first.destination, 'La Poya');
  // 21:15 in Paris, 2 min 30 s late.
  assert.equal(first.scheduled, Date.parse('2026-10-27T20:15:00Z'));
  assert.equal(first.at, Date.parse('2026-10-27T20:17:30Z'));
  assert.deepEqual([first.realtime, first.delay, first.cancelled], [true, 3, false]);
  // The timetable only: no delay, the scheduled time.
  const [planned] = parsePassages([
    stopTimesEntry({ times: [{ at: '21:15', delay: 60, state: 'SCHEDULED' }] }),
  ]);
  assert.deepEqual([planned.realtime, planned.delay], [false, 0]);
  assert.equal(planned.at, Date.parse('2026-10-27T20:15:00Z'));
  assert.equal(lineIdOf('SE2:C13:0:-690031056'), 'SE2:C13');
  assert.equal(lineIdOf(''), '');
});

test('the departures of a stop, soonest first; the real answer at Gares', () => {
  const all = parsePassages(GARES, { lineName });
  assert.ok(all.length > 30);
  assert.ok(all.every((p, i) => i === 0 || all[i - 1].at <= p.at));
  // 21:08:30: the A towards La Poya, a few seconds early, then the D.
  assert.deepEqual(
    all.slice(0, 2).map((p) => [p.line, p.destination, minutesLeft(p, NOW)]),
    [
      ['A', 'La Poya', 0],
      ['D', 'Étienne Grappe', 1],
    ],
  );
  // The C11 of M réso's outer network calls there too, 8 min late.
  const c11 = all.find((p) => p.lineId === 'SE2:C11');
  assert.deepEqual([c11.destination, c11.delay], ['Voiron Gare Routière Sud', 8]);
  // Some are the timetable only.
  assert.ok(all.some((p) => !p.realtime));
});

test('a line and a direction narrow the departures', () => {
  const a = parsePassages(GARES, { lineId: 'SEM:A', lineName });
  assert.ok(a.length > 0 && a.every((p) => p.line === 'A'));
  const towards = parsePassages(GARES, { lineId: 'SEM:A', direction: 'Poya | Fontaine' });
  assert.ok(towards.length > 0 && towards.every((p) => p.destination === 'La Poya'));
  // The town of the terminus counts too.
  assert.ok(parsePassages(GARES, { direction: 'Gières' }).some((p) => p.lineId === 'SEM:B'));
  assert.deepEqual(directionTerms(' La Poya | | Hôtel de Ville '), ['la poya', 'hotel de ville']);
});

test('waits, cancelled trips and routes', () => {
  const passages = parsePassages([
    stopTimesEntry({
      times: [
        { at: '21:12', state: 'CANCELED', trip: 'SEM:1' },
        { at: '21:15', trip: 'SEM:2' },
      ],
    }),
  ]);
  const [cancelled, next] = passages;
  assert.equal(cancelled.cancelled, true);
  assert.deepEqual(upcomingPassages(passages, NOW), [next]);
  assert.deepEqual(cancelledPassages(passages, NOW), [cancelled]);
  assert.equal(minutesLeft(next, NOW), 6);
  assert.equal(minutesLeft(next, NOW + 10 * 60000), 0);
  assert.equal(upcomingPassages([next], NOW + 7 * 60000).length, 0);
  assert.equal(routeOf(next), 'SEM:A|la poya');
  assert.deepEqual(parsePassages(null), []);
  assert.deepEqual(
    parsePassages([{ pattern: { id: 'SEM:A:1:1' }, times: [{ serviceDay: 'x' }] }]),
    [],
  );
});
