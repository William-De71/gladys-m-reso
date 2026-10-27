// -----------------------------------------------------------------------------
// The reference data of the networks: lines and stops, kept in /data.
//
//   - lines: read again once a day, after 04:00. Mobilités M lists the lines of
//     every network of the area: M réso ("SEM": trams A to E, Chrono, Proximo,
//     Flexo…), its outer lines ("SE2"), Cars Région Isère ("C38"), Pays
//     Voironnais ("TPV"), Grésivaudan ("GSV"), the TER ("SNC")… A line is
//     typed the way the user reads it: "A", "tram A", "C1", "ligne 12", or by
//     its code ("SEM:C1", "TPV:514"). A short name used by several networks is
//     the one of M réso first (NETWORK_ORDER);
//   - stops: the "zones d'arrêt" (one name in one town, every pole and
//     platform of it), read again every seven days. A stop is typed by name
//     ("Chavant", "Grenoble Hôtel de Ville") or by its code ("SEM:GENCHV"),
//     given by the "Find a stop" button. A name typed with other words
//     resolves when one stop only holds them all ("victor" -> "Victor Hugo").
//     A stop of M réso also gives the departures of the other networks
//     calling there.
//
// Names are compared folded: no case, no accent, no punctuation.
// -----------------------------------------------------------------------------

const LINES_MAX_AGE_MS = 24 * 3600 * 1000;
const STOPS_MAX_AGE_MS = 7 * 24 * 3600 * 1000;
const MODES = {
  TRAM: 'tram',
  BUS: 'bus',
  CABLE: 'cable',
  FUNICULAR: 'funicular',
  TRAIN: 'train',
};
const LINE_MODES = {
  TRAM: MODES.TRAM,
  BUS: MODES.BUS,
  CABLE_CAR: MODES.CABLE,
  GONDOLA: MODES.CABLE,
  FUNICULAR: MODES.FUNICULAR,
  RAIL: MODES.TRAIN,
};
// The networks of the area, M réso first: a name shared by two networks ("C1"
// is a Chrono of M réso) is read as the one of the earliest here.
const NETWORK_ORDER = ['SEM', 'SE2', 'TPV', 'GSV', 'MCO', 'TRA', 'BUL', 'FUN', 'C38', 'SNC'];

/**
 * @description Fold a text for comparisons.
 * @param {unknown} value - The text.
 * @returns {string} Lower case, no accent, words separated by one space.
 * @example
 * fold("Grand'place – Échirolles"); // -> 'grand place echirolles'
 */
function fold(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * @description A slug for an external id.
 * @param {unknown} value - The text.
 * @param {number} [max] - Its longest length.
 * @returns {string} "victor-hugo".
 */
function slug(value, max = 40) {
  return fold(value).replace(/ /g, '-').slice(0, max).replace(/-$/, '');
}

/**
 * @description The network of a line or stop code.
 * @param {unknown} code - "SEM:C1".
 * @returns {string} "SEM".
 */
const networkOf = (code) => String(code ?? '').split(':')[0];

/**
 * @description The rank of a network, M réso first.
 * @param {string} network - "SEM".
 * @returns {number} Its position, the unknown ones last.
 */
function networkRank(network) {
  const index = NETWORK_ORDER.indexOf(network);
  return index === -1 ? NETWORK_ORDER.length : index;
}

/**
 * @description What is kept of a line.
 * @param {object} raw - A line of the API.
 * @returns {object} `{ id, name, longName, mode, kind, network, color }`.
 */
const lineOf = (raw) => ({
  id: String(raw.id ?? ''),
  name: String(raw.shortName || networkOf(raw.id) || ''),
  longName: String(raw.longName ?? ''),
  mode: LINE_MODES[String(raw.mode ?? '').toUpperCase()] ?? MODES.BUS,
  // TRAM, CHRONO, PROXIMO, FLEXO, SCOL…
  kind: String(raw.type ?? ''),
  network: networkOf(raw.id),
  color: /^[0-9a-f]{6}$/i.test(raw.color ?? '') ? `#${raw.color.toUpperCase()}` : '',
});

/**
 * @description What is kept of a stop.
 * @param {object} raw - The properties of a cluster of the API.
 * @returns {object} `{ code, name, city, network, visible }`.
 */
const stopOf = (raw) => ({
  code: String(raw.code ?? ''),
  name: String(raw.name ?? raw.code ?? '').trim(),
  city: String(raw.city ?? ''),
  network: networkOf(raw.code),
  // The hidden stops double a visible one of the same name (M réso).
  visible: raw.visible !== false,
});

/**
 * @description The ordering of lines or stops: M réso first, then by name.
 * @param {object} a - A line or stop.
 * @param {object} b - Another one.
 * @returns {number} The order.
 */
const byNetwork = (a, b) =>
  networkRank(a.network) - networkRank(b.network) ||
  a.name.localeCompare(b.name, 'fr', { numeric: true });

/**
 * @description Find a line among the known ones.
 * @param {object[]} lines - The known lines.
 * @param {string} typed - "A", "tram A", "ligne C1", "Chrono 1", "SEM:C1", "TPV:514".
 * @returns {object|null} The line.
 * @example
 * findLine(lines, 'tram a'); // -> { id: 'SEM:A', name: 'A', … }
 */
function findLine(lines, typed) {
  const raw = String(typed ?? '').trim();
  if (!raw) {
    return null;
  }
  const byId = lines.find((line) => line.id.toLowerCase() === raw.toLowerCase());
  if (byId) {
    return byId;
  }
  const compact = (value) => fold(value).replace(/ /g, '');
  const wanted = compact(
    raw.replace(
      /^\s*(ligne|line|linie|l[ií]nea|tram(way)?|tranv[ií]a|stra(ss|ß)enbahn|bus|chrono)\s+/i,
      '',
    ),
  );
  if (!wanted) {
    return null;
  }
  const matching = lines.filter((line) => compact(line.name) === wanted).sort(byNetwork);
  return matching[0] ?? null;
}

/**
 * @description The names a stop answers to: its name, and with its town.
 * @param {object} stop - A known stop.
 * @returns {string[]} The folded names.
 */
const namesOf = (stop) => [
  fold(stop.name),
  fold(`${stop.city} ${stop.name}`),
  fold(`${stop.name} ${stop.city}`),
];

/**
 * @description The best stops of a list: the ones of the first network.
 * @param {object[]} stops - Candidate stops.
 * @returns {object|null} The stop, null when none or when two towns share the
 * name in that network (the user adds the town).
 */
function best(stops) {
  if (stops.length === 0) {
    return null;
  }
  const top = Math.min(...stops.map((stop) => networkRank(stop.network)));
  const first = stops.filter((stop) => networkRank(stop.network) === top);
  return first.length === 1 ? first[0] : null;
}

/**
 * @description Find a stop among the known ones.
 * @param {object[]} stops - The known stops.
 * @param {string} typed - A name, "town name", or a code.
 * @returns {object|null} The stop.
 * @example
 * findStop(stops, 'chavant'); // -> { code: 'SEM:GENCHV', name: 'Chavant', … }
 */
function findStop(stops, typed) {
  const raw = String(typed ?? '').trim();
  if (!raw) {
    return null;
  }
  const byCode = stops.find((stop) => stop.code.toLowerCase() === raw.toLowerCase());
  if (byCode) {
    return byCode;
  }
  const wanted = fold(raw);
  if (!wanted) {
    return null;
  }
  const visible = stops.filter((stop) => stop.visible);
  const exact = visible.filter((stop) => namesOf(stop).includes(wanted));
  if (exact.length > 0) {
    return best(exact);
  }
  // A unique stop holding every typed word ("victor" -> "Victor Hugo").
  const words = wanted.split(' ');
  const holds = (name) => words.every((word) => ` ${name} `.includes(` ${word}`));
  return best(visible.filter((stop) => holds(namesOf(stop)[1])));
}

/**
 * @description Search stops by name, for the "Find a stop" button.
 * @param {object[]} stops - The known stops.
 * @param {string} query - Words of the name (or of the town).
 * @param {number} [max] - The most stops returned.
 * @returns {object[]} The visible stops, exact names first, M réso first.
 */
function searchStops(stops, query, max = 6) {
  const words = fold(query).split(' ').filter(Boolean);
  if (words.length === 0) {
    return [];
  }
  const wanted = words.join(' ');
  const rank = (stop) => {
    const name = fold(stop.name);
    if (name === wanted || namesOf(stop).includes(wanted)) {
      return 0;
    }
    return name.startsWith(wanted) ? 1 : 2;
  };
  return stops
    .filter((stop) => stop.visible)
    .filter((stop) => words.every((word) => ` ${namesOf(stop)[1]} `.includes(word)))
    .sort((a, b) => rank(a) - rank(b) || byNetwork(a, b) || a.city.localeCompare(b.city, 'fr'))
    .slice(0, max);
}

/**
 * @description The reference data, read through the API and kept in the store.
 * @param {object} options - Options.
 * @param {object} options.api - The Mobilités M client.
 * @param {object} options.store - The store (`data.network`).
 * @param {Function} options.now - `() => number` in ms.
 * @param {Function} options.isNewDay - `(readAt) => boolean`: a 04:00 passed since.
 * @param {object} [options.logger] - Logger.
 * @returns {object} The network.
 */
function createNetwork({ api, store, now, isNewDay, logger }) {
  const data = () => {
    if (!store.data.network || typeof store.data.network !== 'object') {
      store.data.network = { lines: null, linesAt: 0, stops: null, stopsAt: 0 };
    }
    return store.data.network;
  };

  /**
   * @description Read a part of the network again when stale. A failed
   * reading keeps what is known.
   * @param {string} name - `lines` or `stops`.
   * @param {boolean} stale - Whether it must be read.
   * @param {Function} read - `() => Promise<object[]>`.
   * @returns {Promise<object[]>} The part.
   */
  async function refresh(name, stale, read) {
    const kept = data();
    if (!stale) {
      return kept[name];
    }
    try {
      kept[name] = await read();
      kept[`${name}At`] = now();
      await store.save();
    } catch (err) {
      if (!kept[name]) {
        throw err;
      }
      logger?.warn(`Mobilités M ${name} not read again (${err.kind ?? 'error'}): ${err.message}`);
    }
    return kept[name];
  }

  /**
   * @description The lines, read again daily.
   * @param {boolean} [force] - Read even when fresh.
   * @returns {Promise<object[]>} The lines.
   */
  function lines(force = false) {
    const kept = data();
    const fresh = kept.lines && now() - kept.linesAt < LINES_MAX_AGE_MS && !isNewDay(kept.linesAt);
    return refresh('lines', force || !fresh, async () => {
      const list = (await api.lines()).map(lineOf).filter((line) => line.id && line.name);
      if (list.length === 0) {
        throw new Error('no line');
      }
      return list;
    });
  }

  /**
   * @description The stops, read again weekly.
   * @param {boolean} [force] - Read even when fresh.
   * @returns {Promise<object[]>} The stops.
   */
  function stops(force = false) {
    const kept = data();
    const fresh = kept.stops && now() - kept.stopsAt < STOPS_MAX_AGE_MS;
    return refresh('stops', force || !fresh, async () => {
      const list = (await api.stops()).map(stopOf).filter((stop) => stop.code && stop.name);
      if (list.length === 0) {
        throw new Error('no stop');
      }
      return list;
    });
  }

  return {
    lines,
    stops,
    /**
     * @description A line known without reading anything.
     * @param {string} id - The line code ("SEM:A").
     * @returns {object|null} The line.
     */
    peekLine: (id) => data().lines?.find((line) => line.id === String(id)) ?? null,
    /**
     * @description Resolve a typed line.
     * @param {string} typed - The line as typed.
     * @returns {Promise<object|null>} The line, null when unknown.
     */
    resolveLine: async (typed) => findLine(await lines(), typed),
    /**
     * @description Resolve a typed stop.
     * @param {string} typed - A name or a code.
     * @returns {Promise<object|null>} The stop.
     */
    resolveStop: async (typed) => findStop(await stops(), typed),
    /**
     * @description Search stops by name.
     * @param {string} query - Words of the name.
     * @returns {Promise<object[]>} The stops.
     */
    searchStops: async (query) => searchStops(await stops(), query),
  };
}

export {
  LINES_MAX_AGE_MS,
  STOPS_MAX_AGE_MS,
  MODES,
  NETWORK_ORDER,
  fold,
  slug,
  networkOf,
  networkRank,
  lineOf,
  stopOf,
  findLine,
  findStop,
  searchStops,
  createNetwork,
};
