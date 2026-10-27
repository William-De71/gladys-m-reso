// -----------------------------------------------------------------------------
// HTTP client of the open data API of Mobilités M, the mobility service of the
// Grenoble area (SMMAG): https://data.mobilites-m.fr/donnees. No key, ODbL;
// the real-time stop times require an `origin` header naming the application
// (without it the API answers 200 with `{ "error": "Missing origin header…" }`).
//
// Routes used (their documentation is served at https://data.mobilites-m.fr/api/routes):
//   /api/routers/default/index/routes            the lines of every network of
//                                                the area (M réso "SEM", Cars
//                                                Région "C38", Pays Voironnais
//                                                "TPV"…), read daily;
//   /api/points/json?types=clusters              the stops ("zones d'arrêt":
//                                                the poles of one name in one
//                                                town), read weekly (900 KB);
//   /api/routers/default/index/clusters/:code/routes
//                                                the lines of one stop ("Find a
//                                                stop");
//   /api/routers/default/index/clusters/:code/stoptimes
//                                                the next departures at one stop,
//                                                real time: one request per stop
//                                                (204 when none);
//   /api/dyn/ligne/json                          the level of service of every
//                                                line (`nsv_id`);
//   /api/dyn/evtTC/json                          the traffic messages (works,
//                                                diversions, timetables changed).
// Errors are plain text ("Not Found") or JSON `{ error }`.
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';

const BASE_URL = process.env.MRESO_API_URL || 'https://data.mobilites-m.fr/api';
const TIMEOUT_MS = 20000;
const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const ORIGIN = 'gladys-m-reso';
const USER_AGENT = `gladys-m-reso/${version} (+https://github.com/William-De71/gladys-m-reso)`;

const ENDPOINTS = {
  LINES: 'lines',
  STOPS: 'stops',
  STOP_LINES: 'stop_lines',
  STOP_TIMES: 'stop_times',
  LINE_STATUS: 'line_status',
  EVENTS: 'events',
};

class MresoError extends Error {
  /**
   * @param {string} kind - `busy`, `unreachable` or `invalid`.
   * @param {string} message - The detail.
   * @param {object} [extra] - `{ status }`.
   */
  constructor(kind, message, { status = null } = {}) {
    super(message);
    this.name = 'MresoError';
    this.kind = kind;
    this.status = status;
  }
}

/**
 * @description A client of the open data API of Mobilités M.
 * @param {object} [options] - Options.
 * @param {Function} [options.fetch] - The fetch function (tests).
 * @param {Function} [options.now] - `() => number` in ms.
 * @param {string} [options.baseUrl] - The API root (tests, end-to-end runs).
 * @returns {object} The methods, and `requests` for the diagnostic.
 */
function createMresoClient({
  fetch: fetchFn = globalThis.fetch,
  now = () => Date.now(),
  baseUrl = BASE_URL,
} = {}) {
  // Requests made, per endpoint, for the diagnostic.
  const requests = { total: 0, byEndpoint: {}, failed: 0, last: null };

  /**
   * @description Call the API.
   * @param {string} endpoint - ENDPOINTS, for the counters.
   * @param {string} path - The path and query, after the root.
   * @param {object} [options] - `{ empty }`: the value of a 204 answer.
   * @returns {Promise<unknown>} The JSON answer.
   */
  async function call(endpoint, path, { empty = null } = {}) {
    requests.total += 1;
    requests.byEndpoint[endpoint] = (requests.byEndpoint[endpoint] ?? 0) + 1;
    requests.last = now();
    let response;
    try {
      response = await fetchFn(`${baseUrl}${path}`, {
        headers: { accept: 'application/json', origin: ORIGIN, 'user-agent': USER_AGENT },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      requests.failed += 1;
      throw new MresoError('unreachable', err.cause?.code ?? err.message);
    }
    if (response.status === 204) {
      return empty;
    }
    if (!response.ok) {
      requests.failed += 1;
      let detail = `HTTP ${response.status}`;
      try {
        const text = (await response.text()).trim();
        if (text) {
          detail = `${detail}: ${text.split('\n')[0].slice(0, 160)}`;
        }
      } catch {
        // No body: the status says enough.
      }
      let kind = 'unreachable';
      if (response.status === 429 || response.status === 503) {
        kind = 'busy';
      } else if (response.status >= 400 && response.status < 500) {
        kind = 'invalid';
      }
      throw new MresoError(kind, detail, { status: response.status });
    }
    let body;
    try {
      body = await response.json();
    } catch (err) {
      requests.failed += 1;
      throw new MresoError('invalid', `${endpoint}: ${err.message}`);
    }
    // A refused request still answers 200, with an error.
    if (body && !Array.isArray(body) && typeof body.error === 'string') {
      requests.failed += 1;
      throw new MresoError('invalid', `${endpoint}: ${body.error.slice(0, 160)}`);
    }
    return body;
  }

  /**
   * @description An answer that must be a list.
   * @param {string} endpoint - ENDPOINTS.
   * @param {string} path - The path.
   * @returns {Promise<object[]>} The list.
   */
  async function list(endpoint, path) {
    const body = await call(endpoint, path, { empty: [] });
    if (!Array.isArray(body)) {
      throw new MresoError('invalid', `${endpoint}: not a list`);
    }
    return body;
  }

  /**
   * @description An answer that must be an object.
   * @param {string} endpoint - ENDPOINTS.
   * @param {string} path - The path.
   * @returns {Promise<object>} The object.
   */
  async function object(endpoint, path) {
    const body = await call(endpoint, path, { empty: {} });
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new MresoError('invalid', `${endpoint}: not an object`);
    }
    return body;
  }

  const code = (value) => encodeURIComponent(String(value));

  return {
    requests,
    /**
     * @description The lines of every network of the area.
     * @returns {Promise<object[]>} `[{ id: "SEM:A", shortName, longName, color, mode, type }]`.
     */
    lines: () => list(ENDPOINTS.LINES, '/routers/default/index/routes'),
    /**
     * @description The stops (zones d'arrêt) of every network.
     * @returns {Promise<object[]>} The `properties` of the features:
     * `[{ id, code: "SEM:GENCHV", city, name, visible }]`.
     */
    stops: async () => {
      const body = await object(ENDPOINTS.STOPS, '/points/json?types=clusters');
      if (!Array.isArray(body.features)) {
        throw new MresoError('invalid', `${ENDPOINTS.STOPS}: no features`);
      }
      return body.features
        .map((feature) => feature?.properties)
        .filter((properties) => properties && typeof properties === 'object');
    },
    /**
     * @description The lines serving one stop.
     * @param {string} stopCode - "SEM:GENCHV".
     * @returns {Promise<object[]>} The lines.
     */
    stopLines: (stopCode) =>
      list(ENDPOINTS.STOP_LINES, `/routers/default/index/clusters/${code(stopCode)}/routes`),
    /**
     * @description The next departures at one stop, cancelled trips included.
     * @param {string} stopCode - "SEM:GENCHV".
     * @returns {Promise<object[]>} `[{ pattern, times }]`, empty when none.
     */
    stopTimes: (stopCode) =>
      list(
        ENDPOINTS.STOP_TIMES,
        `/routers/default/index/clusters/${code(stopCode)}/stoptimes?showCancelledTrips=true`,
      ),
    /**
     * @description The level of service of every line.
     * @returns {Promise<object>} `{ "SEM_A": { nsv_id, time, stops } }`.
     */
    lineStatus: () => object(ENDPOINTS.LINE_STATUS, '/dyn/ligne/json'),
    /**
     * @description The traffic messages of every network.
     * @returns {Promise<object>} `{ <code>: { titre, description, listeLigne, … } }`.
     */
    events: () => object(ENDPOINTS.EVENTS, '/dyn/evtTC/json'),
  };
}

export { BASE_URL, ORIGIN, USER_AGENT, ENDPOINTS, MresoError, createMresoClient };
