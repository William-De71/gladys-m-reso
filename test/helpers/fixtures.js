// A fake API of Mobilités M for the tests, served through the `fetch` option
// of the integration. Its answers are real ones, read on 2026-10-27 at 21:08
// (Paris) and reduced: the departures at Gares, Chavant and Victor Hugo, the
// levels of service and the traffic messages of the lines met there, those
// lines (and a few others sharing a name: the TER "C1"), and the stops of a
// few names. Open data of Mobilités M (SMMAG), ODbL. Tests never touch the
// network.

import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// 2026-10-27 21:08:30 in Paris: the time of the readings.
const NOW = Date.parse('2026-10-27T20:08:30Z');
const TZ = 'Europe/Paris';
// The start of the service day of the stop times (midnight in Paris).
const SERVICE_DAY = 1793055600;

const fixture = (name) =>
  JSON.parse(readFileSync(new URL(`../fixtures/${name}`, import.meta.url), 'utf8'));
const LINES = fixture('lines.json');
const STOPS = fixture('stops.json');
const LEVELS = fixture('line-status.json');
const EVENTS = fixture('events.json');
const STOP_TIMES = {
  'SEM:GENGAR': fixture('stoptimes-gengar.json'),
  'SEM:GENCHV': fixture('stoptimes-genchv.json'),
  'SEM:GENVH': fixture('stoptimes-genvh.json'),
};

const silent = { info() {}, warn() {}, error() {}, debug() {} };

/**
 * @description A temporary path for the file kept in /data.
 * @returns {string} The path (its directory exists, the file does not).
 */
const storePath = () => join(mkdtempSync(join(tmpdir(), 'm-reso-')), 'm-reso.json');

const clone = (value) => JSON.parse(JSON.stringify(value));

/**
 * @description The seconds of a Paris time of the service day of the fixtures.
 * @param {string} time - "21:15", "21:15:30".
 * @returns {number} Seconds since the start of the day.
 */
function secondsOf(time) {
  const [hours, minutes, seconds = 0] = time.split(':').map(Number);
  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * @description An entry of the stop times: one pattern and its times.
 * @param {object} [options] - What differs from a tram A towards La Poya at
 * Victor Hugo, leaving at 21:15 (Paris), on time and followed in real time.
 * @param {string} [options.line] - The line code.
 * @param {string} [options.destination] - The destination.
 * @param {Array<object>} [options.times] - `{ at, delay, state, trip }` per
 * departure: `at` the scheduled Paris time, `delay` seconds, `state`
 * UPDATED / SCHEDULED / CANCELED.
 * @returns {object} The entry, as the API writes it.
 */
function stopTimesEntry({
  line = 'SEM:A',
  destination = 'La Poya',
  times = [{ at: '21:15' }],
} = {}) {
  return {
    pattern: {
      id: `${line}:1:123456`,
      desc: destination,
      dir: 1,
      shortDesc: destination.toUpperCase(),
      lastStop: 'SEM:2109',
      lastStopName: `Fontaine, ${destination}`,
    },
    times: times.map(({ at, delay = 0, state = 'UPDATED', trip = `SEM:${at}` }) => ({
      stopId: 'SEM:3203',
      stopName: 'Grenoble, Victor Hugo',
      scheduledArrival: secondsOf(at),
      scheduledDeparture: secondsOf(at),
      realtimeArrival: secondsOf(at) + delay,
      realtimeDeparture: secondsOf(at) + delay,
      arrivalDelay: delay,
      departureDelay: delay,
      timepoint: true,
      realtime: state !== 'SCHEDULED',
      realtimeState: state,
      serviceDay: SERVICE_DAY,
      tripId: trip,
      pickupType: '0',
      occupancy: 'Faible',
      occupancyId: 1,
    })),
  };
}

/**
 * @description A traffic message.
 * @param {object} fields - What differs from works on tram B, level 2, from
 * 27/10 04:00 to 30/10 03:00.
 * @returns {object} The message, as the API writes it.
 */
function trafficEvent(fields = {}) {
  return {
    type: 'restriction_ltc',
    code: 'SEM_TEST',
    dateDebut: '27/10/2026 04:00',
    dateFin: '30/10/2026 03:00',
    heureDebut: '00:00:00',
    heureFin: '00:00:00',
    latitude: -1,
    longitude: -1,
    weekEnd: '2',
    texte: 'travaux Gares|La ligne B est déviée.',
    titre: 'travaux Gares',
    description: 'La ligne B est déviée entre Gares et Cité Internationale.',
    visibleTC: true,
    listeLigne: 'SEM_B',
    listeLigneArret: 'SEM_B',
    nsv_id: 2,
    ...fields,
  };
}

/**
 * @description The fake API.
 * @returns {Function} A fetch function, with `.calls` and `.state`.
 */
function fakeMreso() {
  const state = {
    lines: clone(LINES),
    stops: clone(STOPS),
    levels: clone(LEVELS),
    events: clone(EVENTS),
    stopTimes: clone(STOP_TIMES),
    // 'network', or an HTTP status, for every request; a stop code fails alone.
    fail: null,
    failStop: null,
  };
  const calls = [];

  const json = (body, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });

  /**
   * @description The fetch function.
   * @param {string} url - The URL.
   * @param {object} [init] - The request options.
   * @returns {Promise<Response>} The answer.
   */
  async function fetchFn(url, init = {}) {
    const parsed = new URL(url);
    const path = decodeURIComponent(parsed.pathname.replace(/^\/api/, ''));
    calls.push({ path, params: Object.fromEntries(parsed.searchParams) });
    if (state.fail === 'network') {
      throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNREFUSED' } });
    }
    if (typeof state.fail === 'number') {
      return new Response('Service Unavailable', { status: state.fail });
    }
    const stop = /^\/routers\/default\/index\/clusters\/([^/]+)\/(stoptimes|routes)$/.exec(path);
    if (stop) {
      if (!init.headers?.origin) {
        return json({
          error:
            'Missing origin header: please add origin header and contact us for massive usage of the API.',
        });
      }
      if (state.failStop === stop[1]) {
        return new Response('Bad Gateway', { status: 502 });
      }
      const entries = state.stopTimes[stop[1]];
      if (stop[2] === 'routes') {
        const ids = new Set(
          (entries ?? []).map((entry) => entry.pattern.id.split(':').slice(0, 2).join(':')),
        );
        return json(state.lines.filter((line) => ids.has(line.id)));
      }
      return entries && entries.length ? json(entries) : new Response(null, { status: 204 });
    }
    switch (path) {
      case '/routers/default/index/routes':
        return json(state.lines);
      case '/points/json':
        return json({ type: 'FeatureCollection', features: state.stops.features });
      case '/dyn/ligne/json':
        return json(state.levels);
      case '/dyn/evtTC/json':
        return json(state.events);
      default:
        return new Response('Not Found', { status: 404 });
    }
  }
  fetchFn.calls = calls;
  fetchFn.state = state;
  return fetchFn;
}

/**
 * @description A minimal Gladys client for the pure builders.
 */
const fakeGladys = {
  externalIds: (type, id) => ({
    device: `ext:m-reso:${type}:${id}`,
    feature: (key) => `ext:m-reso:${type}:${id}:${key}`,
  }),
};

export {
  NOW,
  TZ,
  SERVICE_DAY,
  LINES,
  STOPS,
  LEVELS,
  EVENTS,
  STOP_TIMES,
  silent,
  storePath,
  secondsOf,
  stopTimesEntry,
  trafficEvent,
  fakeMreso,
  fakeGladys,
};
