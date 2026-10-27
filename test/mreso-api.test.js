import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createMresoClient, ORIGIN, USER_AGENT } from '../src/mreso-api.js';
import { fakeMreso, STOP_TIMES } from './helpers/fixtures.js';

test('the stop times need the origin header; a stop without departure answers 204', async () => {
  const fetch = fakeMreso();
  const seen = [];
  const api = createMresoClient({
    fetch: (url, init) => {
      seen.push(init.headers);
      return fetch(url, init);
    },
  });
  assert.equal((await api.stopTimes('SEM:GENGAR')).length, STOP_TIMES['SEM:GENGAR'].length);
  assert.deepEqual(await api.stopTimes('SEM:GENLP'), []);
  assert.equal(seen[0].origin, ORIGIN);
  assert.match(seen[0]['user-agent'], /^gladys-m-reso\//);
  assert.equal(USER_AGENT.includes('github.com/William-De71/gladys-m-reso'), true);
  assert.equal(fetch.calls[0].path, '/routers/default/index/clusters/SEM:GENGAR/stoptimes');
  assert.deepEqual(api.requests.byEndpoint, { stop_times: 2 });
});

test('the stops are the properties of the features; the levels and messages are objects', async () => {
  const api = createMresoClient({ fetch: fakeMreso() });
  const stops = await api.stops();
  assert.ok(stops.every((stop) => typeof stop.code === 'string'));
  assert.equal(typeof (await api.lineStatus()).SEM_A.nsv_id, 'number');
  assert.equal(typeof (await api.events()), 'object');
  assert.ok((await api.lines()).some((line) => line.id === 'SEM:A'));
});

test('errors: busy, unreachable, invalid; a 200 carrying an error is refused', async () => {
  const fetch = fakeMreso();
  const api = createMresoClient({ fetch });
  fetch.state.fail = 503;
  await assert.rejects(api.lines(), { kind: 'busy', message: 'HTTP 503: Service Unavailable' });
  fetch.state.fail = 'network';
  await assert.rejects(api.lines(), { kind: 'unreachable', message: 'ECONNREFUSED' });
  fetch.state.fail = 404;
  await assert.rejects(api.events(), { kind: 'invalid' });
  fetch.state.fail = null;
  // Without the origin header, the API answers 200 with an error.
  const bare = createMresoClient({ fetch: (url) => fetch(url, {}) });
  await assert.rejects(bare.stopTimes('SEM:GENGAR'), {
    kind: 'invalid',
    message: /Missing origin header/,
  });
  assert.equal(api.requests.failed, 3);
});
