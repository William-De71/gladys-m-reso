// The widget contents pass the validator of the SDK (what the core would
// drop or truncate), in every language.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';

import {
  buildDeparturesWidget,
  buildTrafficWidget,
  messageContent,
  readCount,
  routeValue,
  shortDate,
  dateText,
  BOARD_COUNT,
} from '../src/widgets.js';
import { parsePassages } from '../src/departures.js';
import { parseTraffic, lineTraffic } from '../src/traffic.js';
import { LANGUAGES } from '../src/i18n.js';
import {
  NOW,
  TZ,
  STOP_TIMES,
  LEVELS,
  EVENTS,
  stopTimesEntry,
  trafficEvent,
} from './helpers/fixtures.js';

const lineName = (code) => code.split(':')[1];
const GARES = parsePassages(STOP_TIMES['SEM:GENGAR'], { lineName });
const line = (id, name, mode = 'bus') => ({ id, name, mode, network: 'SEM' });

/**
 * @description Assert that the core would keep the content whole.
 * @param {object} content - The content.
 * @param {string} label - For the message.
 */
function assertValid(content, label) {
  assert.deepEqual(validateWidgetContent(content), [], label);
}

test('departures widget: one compact row per route, soonest first, in every language', () => {
  for (const language of LANGUAGES) {
    const content = buildDeparturesWidget({
      title: 'Gares',
      passages: GARES,
      readAt: NOW,
      count: 6,
      language,
      now: NOW,
      timeZone: TZ,
    });
    assertValid(content, language);
    const [heading, caption, status] = content.components;
    assert.equal(heading.text, 'Gares');
    assert.match(caption.text, /^Mobilités M · .*21:08/);
    assert.equal(status.items.length, 6);
  }
  const fr = buildDeparturesWidget({
    title: 'Gares',
    passages: GARES,
    readAt: NOW,
    count: 4,
    language: 'fr',
    now: NOW,
    timeZone: TZ,
  });
  assert.deepEqual(
    fr.components[2].items.map((item) => [item.label, item.value]),
    [
      ['A → La Poya', 'À l’approche · 19 min'],
      ['D → Étienne Grappe', '1 · 21 · 41 min'],
      ['B → Oxford', '5 · 25 · 45 min'],
      ["A → Grand'place", '6 · 35 min'],
    ],
  );
});

test('departures widget: a cancelled trip and a late one colour their row', () => {
  const passages = parsePassages(
    [
      stopTimesEntry({
        times: [
          { at: '21:12', state: 'CANCELED', trip: 'SEM:1' },
          { at: '21:20', trip: 'SEM:2' },
        ],
      }),
      stopTimesEntry({
        line: 'SEM:B',
        destination: 'Oxford',
        times: [{ at: '21:10', delay: 360 }],
      }),
      stopTimesEntry({ line: 'SEM:E', destination: 'Palluel', times: [{ at: '21:14' }] }),
    ],
    { lineName },
  );
  const content = buildDeparturesWidget({
    title: 'Victor Hugo',
    passages,
    readAt: NOW,
    count: 6,
    language: 'fr',
    now: NOW,
    timeZone: TZ,
  });
  assertValid(content, 'troubled');
  assert.deepEqual(
    content.components[2].items.map((item) => [item.label, item.value, item.color]),
    [
      ['E → Palluel', '5 min', 'success'],
      ['B → Oxford', '7 min', 'warning'],
      ['A → La Poya', 'supprimé 21:12 · 11 min', 'warning'],
    ],
  );
});

test('departures widget: times beyond an hour, nothing announced', () => {
  const options = { language: 'en', now: NOW, timeZone: TZ };
  const late = parsePassages([stopTimesEntry({ times: [{ at: '21:15' }, { at: '22:40' }] })]);
  assert.equal(routeValue(late, options), '6 min · 22:40');
  const empty = buildDeparturesWidget({
    title: 'Gares',
    passages: [],
    readAt: NOW,
    count: 6,
    language: 'de',
    now: NOW,
    timeZone: TZ,
  });
  assertValid(empty, 'empty');
  assert.equal(
    empty.components[1].text,
    'Keine Abfahrt angekündigt. Mobilités M · aktualisiert um 21:08.',
  );
  assert.equal(empty.ttl_seconds, 300);
});

test('departures widget: several stops in one list, a row per stop then its routes', () => {
  const content = buildDeparturesWidget({
    boards: [
      { title: 'Gares (A)', label: 'Gares', passages: GARES, readAt: NOW },
      { title: 'Chavant', label: 'Chavant', passages: [], readAt: NOW - 60000 },
    ],
    count: 6,
    language: 'fr',
    now: NOW,
    timeZone: TZ,
  });
  assertValid(content, 'several');
  const [heading, caption, status] = content.components;
  assert.equal(heading.text, 'Gares · Chavant');
  assert.equal(caption.text, 'Mobilités M');
  assert.equal(status.items[0].icon, 'map-pin');
  assert.equal(status.items[0].value, 'lu à 21:08');
  assert.equal(status.items.at(-1).value, 'Aucun passage annoncé');
  assert.ok(status.items.length <= 10);
});

test('traffic widget: states, messages under way and coming, in every language', () => {
  const traffic = parseTraffic(LEVELS, {
    ...EVENTS,
    soon: trafficEvent({ code: 'SOON', dateDebut: '29/10/2026 04:00', nsv_id: 1 }),
  });
  const lines = [
    line('SEM:A', 'A', 'tram'),
    line('SEM:B', 'B', 'tram'),
    line('SEM:C5', 'C5'),
    line('SEM:C1', 'C1'),
  ].map((entry) => ({ line: entry, traffic: lineTraffic(traffic, entry.id, NOW) }));
  for (const language of LANGUAGES) {
    const content = buildTrafficWidget({ lines, readAt: NOW, language, now: NOW, timeZone: TZ });
    assertValid(content, language);
  }
  const fr = buildTrafficWidget({ lines, readAt: NOW, language: 'fr', now: NOW, timeZone: TZ });
  const [heading, status, cards, caption] = fr.components;
  assert.equal(heading.text, 'Trafic M réso');
  assert.deepEqual(
    status.items.map((item) => [item.label, item.value, item.color]),
    [
      ['Tram A', 'Info trafic', 'info'],
      ['Tram B', 'Trafic normal', 'success'],
      ['Ligne C5', 'Trafic perturbé', 'warning'],
      ['Ligne C1', 'Trafic normal', 'success'],
    ],
  );
  // Under way, the latest first, then the coming ones; their period, their
  // hours of the day.
  assert.deepEqual(
    cards.items.map((item) => [item.title, item.badge.text, item.subtitle]),
    [
      ['travaux de nuit', 'Tram A', 'Perturbation · 26/10 22:30 → 30/10 02:00, 21:30–02:00'],
      ['travaux rue Diderot', 'Ligne C5', 'Perturbation · 15/07 04:00 → 19/12 03:00'],
      ['travaux Gares', 'Tram B', 'À venir · 29/10 04:00 → 30/10 03:00'],
    ],
  );
  assert.match(cards.items[1].description, /La ligne C5 est déviée/);
  assert.match(cards.items[1].links[0].url, /^https:\/\/www\.tag\.fr\/.*Diderot\.pdf$/);
  assert.equal(caption.text, 'Mobilités M · mis à jour à 21:08');
  // Nothing to say.
  const calm = buildTrafficWidget({
    lines: [lines[3]],
    readAt: NOW,
    language: 'es',
    now: NOW,
    timeZone: TZ,
  });
  assertValid(calm, 'calm');
  assert.equal(
    calm.components[2].text,
    'Ningún aviso de tráfico para estas líneas. Mobilités M · actualizado a las 21:08.',
  );
});

test('messages and settings', () => {
  assertValid(messageContent('Hello'), 'message');
  assert.equal(readCount(undefined, BOARD_COUNT), BOARD_COUNT.default);
  assert.equal(readCount('99', BOARD_COUNT), BOARD_COUNT.max);
  assert.equal(readCount(0, BOARD_COUNT), BOARD_COUNT.min);
  assert.equal(shortDate(Date.parse('2026-12-31T22:59:00Z'), TZ), '31/12');
  assert.equal(shortDate(null, TZ), '');
  assert.equal(dateText(Date.parse('2026-10-27T15:48:00Z'), NOW, TZ), '16:48');
  assert.equal(dateText(Date.parse('2026-10-26T20:31:00Z'), NOW, TZ), '26/10 21:31');
  assert.equal(dateText(null, NOW, TZ), '');
});
