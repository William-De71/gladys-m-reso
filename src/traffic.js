// -----------------------------------------------------------------------------
// The traffic of the networks, read every 5 minutes from two answers:
//   - the level of service of each line (`/dyn/ligne/json`, keyed "SEM_A"):
//     `nsv_id` 1 normal, 2 disrupted, 3 and 4 heavily disrupted (the website
//     of Mobilités M draws 3 and 4 in its error colour), with the time it
//     began and the stops concerned;
//   - the traffic messages (`/dyn/evtTC/json`): a title, a text, the lines
//     ("SEM_C5,SEM_C6"), a period of validity in Paris wall-clock time
//     ("15/07/2026 04:00" to "19/12/2026 03:00"), sometimes hours of the day
//     ("21:30" to "02:00" for works at night), a level and a document.
// States of a line, from the mildest: `unknown` (nothing read yet), `normal`,
// `info` (a message under way, normal service), `disrupted`, `major`. The texts
// are in French only: the networks have no other language.
// -----------------------------------------------------------------------------

import { wallToInstant, MINUTE_MS } from './time.js';

const STATES = ['unknown', 'normal', 'info', 'disrupted', 'major'];
const SERIOUS = ['disrupted', 'major'];
// A message starting this soon is shown as coming.
const UPCOMING_MS = 3 * 24 * 60 * MINUTE_MS;
const TEXT_MAX = 2000;
const TITLE_MAX = 140;

/**
 * @description The state of a level of service.
 * @param {unknown} level - `nsv_id`.
 * @returns {string} A state.
 */
function stateOfLevel(level) {
  const value = Number(level);
  if (value >= 3) {
    return 'major';
  }
  return value === 2 ? 'disrupted' : 'normal';
}

/**
 * @description The key of a line in the dynamic answers.
 * @param {string} lineId - "SEM:A".
 * @returns {string} "SEM_A".
 */
const dynKey = (lineId) => String(lineId).replace(':', '_');

/**
 * @description A date of the messages, in Paris wall-clock time.
 * @param {unknown} value - "15/07/2026 04:00".
 * @returns {number|null} The instant (ms), null when absent or invalid.
 */
function parseMessageDate(value) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/.exec(
    String(value ?? '').trim(),
  );
  if (!match) {
    return null;
  }
  const [, day, month, year, hour = '0', minute = '0'] = match;
  const wall = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
  return Number.isFinite(wall) ? wallToInstant(wall) : null;
}

/**
 * @description The hours of the day of a message, when it gives some.
 * @param {unknown} start - "21:30" or "00:00:00".
 * @param {unknown} end - "02:00".
 * @returns {string} "21:30–02:00", '' for the whole day.
 */
function hoursOf(start, end) {
  const short = (value) => /^(\d{2}:\d{2})/.exec(String(value ?? ''))?.[1] ?? '';
  const [from, to] = [short(start), short(end)];
  if (!from || !to || from === to) {
    return '';
  }
  return `${from}–${to}`;
}

/**
 * @description A plain text: no tags, blank lines dropped.
 * @param {unknown} value - The text.
 * @param {number} [max] - Its longest length.
 * @returns {string} The text.
 */
function plainText(value, max = TEXT_MAX) {
  return String(value ?? '')
    .replace(/\r/g, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .split('\n')
    .map((line) => line.replace(/[ \t\u00a0]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
    .slice(0, max);
}

/**
 * @description A short title.
 * @param {string} title - The title of the message.
 * @param {string} text - Its text.
 * @returns {string} The title, or the first sentence of the text, at most TITLE_MAX characters.
 */
function titleOf(title, text) {
  const [firstLine = ''] = text.split('\n');
  const sentence = title || (/^(.+?[.!?])(\s|$)/.exec(firstLine)?.[1] ?? firstLine);
  return sentence.length > TITLE_MAX ? `${sentence.slice(0, TITLE_MAX - 1)}…` : sentence;
}

/**
 * @description The document of a message, when on https.
 * @param {unknown} value - The URL.
 * @returns {string} The URL, '' when none.
 */
function linkOf(value) {
  const url = String(value ?? '').trim();
  if (!/^https:\/\/\S+$/i.test(url.replace(/ /g, '%20')) || url.length > 2048) {
    return '';
  }
  return url.replace(/ /g, '%20');
}

/**
 * @description What is kept of a message.
 * @param {string} key - Its key in the answer.
 * @param {object} raw - The message.
 * @returns {object} `{ id, lineIds, level, title, text, url, start, end, hours }`.
 */
function messageOf(key, raw) {
  const titre = plainText(raw.titre, TITLE_MAX * 2);
  const text = plainText(raw.description || raw.texte);
  return {
    id: String(raw.code || key),
    lineIds: String(raw.listeLigne ?? '')
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => /^[A-Z0-9]+_[A-Za-z0-9-]+$/.test(entry))
      .map((entry) => entry.replace('_', ':')),
    level: Number.isFinite(Number(raw.nsv_id)) ? Number(raw.nsv_id) : 0,
    title: titleOf(titre, text),
    text: text || titre,
    url: linkOf(raw.plan),
    start: parseMessageDate(raw.dateDebut),
    end: parseMessageDate(raw.dateFin),
    hours: hoursOf(raw.heureDebut, raw.heureFin),
  };
}

/**
 * @description Read the traffic.
 * @param {object} levels - The levels of service, by "SEM_A".
 * @param {object} events - The messages, by code.
 * @returns {{ levels: object, messages: object[] }} The levels by line code
 * ("SEM:A": `{ level, since }`) and the messages about a line.
 */
function parseTraffic(levels, events) {
  const byLine = {};
  for (const [key, value] of Object.entries(levels ?? {})) {
    if (value && typeof value === 'object' && /^[A-Z0-9]+_/.test(key)) {
      byLine[key.replace('_', ':')] = {
        level: Number(value.nsv_id) || 1,
        since: Number.isFinite(value.time) ? value.time : null,
      };
    }
  }
  return {
    levels: byLine,
    messages: Object.entries(events ?? {})
      .filter(([, raw]) => raw && typeof raw === 'object' && raw.visibleTC !== false)
      .map(([key, raw]) => messageOf(key, raw))
      .filter((message) => message.lineIds.length > 0 && (message.text || message.title)),
  };
}

/**
 * @description The rank of a state, for comparisons.
 * @param {string} state - A state.
 * @returns {number} Its position in STATES.
 */
const rank = (state) => STATES.indexOf(state);

/**
 * @description The state a message gives.
 * @param {object} message - The message.
 * @returns {string} `info`, `disrupted` or `major`.
 */
const messageState = (message) => (message.level >= 2 ? stateOfLevel(message.level) : 'info');

/**
 * @description The traffic of one line.
 * @param {object|null} traffic - parseTraffic().
 * @param {string} lineId - The line code.
 * @param {number} now - Now (ms).
 * @returns {{ state: string, since: number|null, messages: object[], upcoming: object[] }}
 * Its state, the messages under way (latest start first) and the ones coming
 * in the next three days (soonest first), each with its `state`.
 */
function lineTraffic(traffic, lineId, now) {
  if (!traffic) {
    return { state: 'unknown', since: null, messages: [], upcoming: [] };
  }
  const own = traffic.messages
    .filter((message) => message.lineIds.includes(lineId))
    .filter((message) => message.end === null || message.end > now)
    .map((message) => ({ ...message, state: messageState(message) }));
  const messages = own
    .filter((message) => message.start === null || message.start <= now)
    .sort((a, b) => (b.start ?? 0) - (a.start ?? 0));
  const upcoming = own
    .filter((message) => message.start !== null && message.start > now)
    .filter((message) => message.start - now <= UPCOMING_MS)
    .sort((a, b) => a.start - b.start);
  const level = traffic.levels[lineId];
  let state = stateOfLevel(level?.level ?? 1);
  if (state === 'normal' && messages.length > 0) {
    state = 'info';
  }
  return {
    state,
    since: SERIOUS.includes(state) ? (level?.since ?? null) : null,
    messages,
    upcoming,
  };
}

/**
 * @description The messages of a line about a disruption under way.
 * @param {{ messages: object[] }} line - lineTraffic().
 * @returns {object[]} The messages.
 */
const seriousMessages = (line) => line.messages.filter((m) => SERIOUS.includes(m.state));

export {
  STATES,
  SERIOUS,
  UPCOMING_MS,
  stateOfLevel,
  dynKey,
  parseMessageDate,
  hoursOf,
  plainText,
  titleOf,
  linkOf,
  messageOf,
  parseTraffic,
  rank,
  messageState,
  lineTraffic,
  seriousMessages,
};
