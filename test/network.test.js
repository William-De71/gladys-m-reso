import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  fold,
  slug,
  networkOf,
  lineOf,
  stopOf,
  findLine,
  findStop,
  searchStops,
  createNetwork,
  MODES,
} from '../src/network.js';
import { createMresoClient } from '../src/mreso-api.js';
import { createStore } from '../src/store.js';
import { LINES, STOPS, fakeMreso, storePath, NOW } from './helpers/fixtures.js';

const lines = LINES.map(lineOf);
const stops = STOPS.features.map((feature) => stopOf(feature.properties));

test('names folded for comparisons; the network of a code', () => {
  assert.equal(fold("Grand'place – Échirolles"), 'grand place echirolles');
  assert.equal(slug('Fontaine Hôtel de Ville – La Source'), 'fontaine-hotel-de-ville-la-source');
  assert.equal(networkOf('SEM:C1'), 'SEM');
});

test('lines: code, public name, mode, network and colour', () => {
  assert.deepEqual(
    lines.find((line) => line.id === 'SEM:A'),
    {
      id: 'SEM:A',
      name: 'A',
      longName: "Fontaine La Poya / Le Pont-de-Claix L'Étoile",
      mode: MODES.TRAM,
      kind: 'TRAM',
      network: 'SEM',
      color: '#3376B8',
    },
  );
  assert.equal(lines.find((line) => line.id === 'BUL:BUL').mode, MODES.CABLE);
  assert.equal(lines.find((line) => line.id === 'SNC:C1').mode, MODES.TRAIN);
});

test('a line is typed the way users read it, M réso first', () => {
  const id = (typed) => findLine(lines, typed)?.id ?? null;
  assert.equal(id('A'), 'SEM:A');
  assert.equal(id('tram a'), 'SEM:A');
  assert.equal(id('Tramway B'), 'SEM:B');
  assert.equal(id('ligne C1'), 'SEM:C1');
  // "C1" is also a TER line: M réso first, the TER by its code.
  assert.equal(id('c1'), 'SEM:C1');
  assert.equal(id('SNC:C1'), 'SNC:C1');
  assert.equal(id('Chrono 5'), null);
  assert.equal(id('t83'), 'C38:T83');
  assert.equal(id('Z9'), null);
  assert.equal(id(''), null);
});

test('stops: the zones of one name in one town; the hidden doubles kept for their code', () => {
  const chavant = stops.find((stop) => stop.code === 'SEM:GENCHV');
  assert.deepEqual(chavant, {
    code: 'SEM:GENCHV',
    name: 'Chavant',
    city: 'Grenoble',
    network: 'SEM',
    visible: true,
  });
  assert.equal(stops.find((stop) => stop.code === 'SE2:CHV').visible, false);
});

test('a stop is typed by name, with its town, by some words, or by code', () => {
  const code = (typed) => findStop(stops, typed)?.code ?? null;
  assert.equal(code('chavant'), 'SEM:GENCHV');
  assert.equal(code('Gares'), 'SEM:GENGAR');
  assert.equal(code('victor'), 'SEM:GENVH');
  // The town before or after the name; M réso before the other networks.
  assert.equal(code('Grenoble Hôtel de Ville'), 'SEM:GENGHV');
  assert.equal(code('Seyssinet-Pariset Hôtel de Ville'), 'SEM:GENSEH');
  assert.equal(code('La Poya Fontaine'), 'SEM:GENLP');
  assert.equal(code('bouchayer'), 'SEM:GENSHV3');
  assert.equal(code('eugene chavant'), 'SNC:OCE87697466');
  // A code, even of a hidden stop.
  assert.equal(code('se2:chv'), 'SE2:CHV');
  // Words of several stops of M réso resolve to none.
  assert.equal(code('ville'), null);
  assert.equal(code('Nulle part'), null);
  assert.equal(code(''), null);
});

test('"Find a stop": exact names first, M réso first, visible stops only', () => {
  const found = searchStops(stops, 'hotel de ville');
  assert.equal(found[0].code, 'C38:1100281');
  assert.ok(found.every((stop) => stop.visible));
  assert.equal(found.length, 6);
  assert.deepEqual(
    searchStops(stops, 'chavant').map((stop) => stop.code),
    ['SEM:GENCHV', 'SNC:OCE87697466'],
  );
  assert.deepEqual(searchStops(stops, ' '), []);
});

test('the network is read once, kept in /data, the lines daily, the stops weekly', async () => {
  const fetch = fakeMreso();
  let clock = NOW;
  const store = createStore({ path: storePath() });
  const network = createNetwork({
    api: createMresoClient({ fetch }),
    store,
    now: () => clock,
    isNewDay: () => false,
  });
  assert.equal((await network.resolveLine('b')).id, 'SEM:B');
  assert.equal((await network.resolveStop('Victor Hugo')).code, 'SEM:GENVH');
  assert.equal(fetch.calls.length, 2, 'lines, stops');
  await network.lines();
  await network.stops();
  assert.equal(fetch.calls.length, 2);
  assert.equal(network.peekLine('SEM:C5').name, 'C5');
  clock += 8 * 24 * 3600 * 1000;
  fetch.state.fail = 503;
  // A failed reading keeps what is known.
  assert.equal((await network.resolveStop('SEM:GENGAR')).name, 'Gares');
  assert.equal(store.data.network.stops.length, STOPS.features.length);
});
