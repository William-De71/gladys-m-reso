// -----------------------------------------------------------------------------
// The stop times of a stop -> its passages.
//
// The API answers one entry per route pattern calling at the stop: its line
// (the start of `pattern.id`, "SEM:B:1:234041489" -> "SEM:B"), its
// destination (`pattern.desc`) and its next times. Each time counts in seconds
// from `serviceDay` (the start of the day of the trip, a true Unix time): the
// timetable (`scheduledDeparture`) and the real-time estimate
// (`realtimeDeparture`, with `departureDelay` in seconds). `realtimeState`
// says how much to trust it: `UPDATED` (the vehicle is followed), `SCHEDULED`
// (the timetable only), `CANCELED` (the trip is cancelled). Trips ending at
// the stop are not in the answer.
// -----------------------------------------------------------------------------

import { fold } from './network.js';

const CANCELLED_STATES = new Set(['CANCELED', 'CANCELLED']);

/**
 * @description Split a typed direction into the words to look for.
 * @param {string} direction - "Fontaine | La Poya".
 * @returns {string[]} The folded alternatives.
 * @example
 * directionTerms('Fontaine | La Poya'); // -> ['fontaine', 'la poya']
 */
function directionTerms(direction) {
  return String(direction ?? '')
    .split('|')
    .map(fold)
    .filter(Boolean);
}

/**
 * @description The line code of a pattern.
 * @param {unknown} patternId - "SEM:B:1:234041489".
 * @returns {string} "SEM:B".
 */
function lineIdOf(patternId) {
  const [network = '', line = ''] = String(patternId ?? '').split(':');
  return network && line ? `${network}:${line}` : '';
}

/**
 * @description The passages of one pattern.
 * @param {object} entry - `{ pattern, times }` of the API.
 * @param {Function} lineName - `(code) => public name`.
 * @returns {object[]} The passages.
 */
function passagesOfPattern(entry, lineName) {
  const pattern = entry?.pattern ?? {};
  const lineId = lineIdOf(pattern.id);
  const destination = String(pattern.desc || pattern.lastStopName || '').trim();
  const terminus = String(pattern.lastStopName ?? '').trim();
  return (Array.isArray(entry?.times) ? entry.times : [])
    .filter((time) => Number.isFinite(time?.serviceDay))
    .map((time) => {
      const realtime = time.realtime === true;
      const scheduled = (time.serviceDay + Number(time.scheduledDeparture)) * 1000;
      const estimated = (time.serviceDay + Number(time.realtimeDeparture)) * 1000;
      return {
        lineId,
        line: String(lineName(lineId) || lineId.split(':')[1] || ''),
        destination,
        terminus,
        at: realtime && Number.isFinite(estimated) ? estimated : scheduled,
        scheduled,
        realtime,
        delay: realtime ? Math.round(Number(time.departureDelay) / 60) || 0 : 0,
        cancelled: CANCELLED_STATES.has(String(time.realtimeState ?? '').toUpperCase()),
        // 1 low, 2 moderate, 3 high, as the API says it ("Faible", "Modérée"…).
        occupancy: Number.isInteger(time.occupancyId) ? time.occupancyId : null,
        trip: String(time.tripId ?? ''),
      };
    })
    .filter((passage) => Number.isFinite(passage.at) && Number.isFinite(passage.scheduled));
}

/**
 * @description The passages of a stop, soonest first.
 * @param {object[]} entries - The answer of the stop times.
 * @param {object} [filter] - `{ lineId, direction, lineName }`: the optional
 * line and direction, and `(code) => public name`.
 * @returns {object[]} The passages, cancelled ones included.
 */
function parsePassages(entries, { lineId = '', direction = '', lineName = () => '' } = {}) {
  const terms = directionTerms(direction);
  return (Array.isArray(entries) ? entries : [])
    .flatMap((entry) => passagesOfPattern(entry, lineName))
    .filter((passage) => !lineId || passage.lineId === lineId)
    .filter((passage) => {
      if (terms.length === 0) {
        return true;
      }
      const target = fold(`${passage.destination} ${passage.terminus}`);
      return terms.some((term) => target.includes(term));
    })
    .sort((a, b) => a.at - b.at);
}

/**
 * @description The minutes left before a passage.
 * @param {object} passage - The passage.
 * @param {number} now - Now (ms).
 * @returns {number} Whole minutes (rounded down, like the screens).
 */
function minutesLeft(passage, now) {
  return Math.max(0, Math.floor((passage.at - now) / 60000));
}

/**
 * @description The passages not gone yet, cancelled ones left out.
 * @param {object[]} passages - The passages.
 * @param {number} now - Now (ms).
 * @returns {object[]} The passages to come.
 */
const upcomingPassages = (passages, now) =>
  passages.filter((passage) => !passage.cancelled && passage.at > now - 30000);

/**
 * @description The cancelled passages not gone yet.
 * @param {object[]} passages - The passages.
 * @param {number} now - Now (ms).
 * @returns {object[]} The cancelled passages to come.
 */
const cancelledPassages = (passages, now) =>
  passages.filter((passage) => passage.cancelled && passage.scheduled > now - 30000);

/**
 * @description Who a passage is, across readings: line and destination.
 * @param {object} passage - The passage.
 * @returns {string} "SEM:A|la poya".
 */
const routeOf = (passage) => `${passage.lineId}|${fold(passage.destination)}`;

export {
  directionTerms,
  lineIdOf,
  passagesOfPattern,
  parsePassages,
  minutesLeft,
  upcomingPassages,
  cancelledPassages,
  routeOf,
};
