// Builds the widget contents of the illustrations with the integration's own
// code: node gen.mjs <repo> <out.json> (run by render.sh)
//
// The two widgets on a real Tuesday evening in Grenoble: the answers of the
// API of Mobilités M read on 2026-10-27 at 21:08 and kept in test/fixtures
// (departures at Gares, levels of service and traffic messages) go through
// the real parsers (src/departures.js, src/traffic.js) and the real widget
// builders (src/widgets.js). Two things are added to show what the widgets
// do with them: a cancelled bus C1, and works on line C1 starting in two days.
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const [repo, out] = process.argv.slice(2);
const load = (path) => import(pathToFileURL(`${repo}/${path}`).href);
const { buildDeparturesWidget, buildTrafficWidget } = await load('src/widgets.js');
const { parsePassages } = await load('src/departures.js');
const { parseTraffic, lineTraffic } = await load('src/traffic.js');
const { lineOf } = await load('src/network.js');
const { LANGUAGES } = await load('src/i18n.js');
const fixture = (name) => JSON.parse(readFileSync(`${repo}/test/fixtures/${name}`, 'utf8'));
const manifest = JSON.parse(readFileSync(`${repo}/gladys-assistant-integration.json`, 'utf8'));

// Tuesday 27 October 2026, 21:08:30 in Paris.
const NOW = Date.parse('2026-10-27T20:08:30Z');
const TZ = 'Europe/Paris';

const known = Object.fromEntries(fixture('lines.json').map((raw) => [raw.id, lineOf(raw)]));
const gares = fixture('stoptimes-gengar.json');
// The second C1 towards Cité Jean Macé cancelled.
for (const entry of gares) {
  if (entry.pattern.id.startsWith('SEM:C1:') && entry.pattern.desc === 'Cité Jean Macé') {
    entry.times[1] = { ...entry.times[1], realtimeState: 'CANCELED' };
  }
}
const passages = parsePassages(gares, { lineName: (code) => known[code]?.name ?? code });
const traffic = parseTraffic(fixture('line-status.json'), {
  ...fixture('events.json'),
  coming: {
    code: 'SEM_ILLUSTRATION',
    titre: 'travaux cours Jean Jaurès',
    description: 'La ligne C1 est déviée entre Gares et Chavant en raison de travaux.',
    dateDebut: '29/10/2026 20:00',
    dateFin: '31/10/2026 03:00',
    heureDebut: '00:00:00',
    heureFin: '00:00:00',
    listeLigne: 'SEM_C1',
    nsv_id: 2,
    visibleTC: true,
  },
});
const lines = ['SEM:A', 'SEM:B', 'SEM:C1', 'SEM:C5'].map((id) => ({
  line: known[id],
  traffic: lineTraffic(traffic, id, NOW),
}));

const contents = {};
for (const language of LANGUAGES) {
  contents[language] = {
    departures: buildDeparturesWidget({
      title: 'Gares',
      passages,
      readAt: NOW,
      count: 6,
      language,
      now: NOW,
      timeZone: TZ,
    }),
    traffic: buildTrafficWidget({
      lines,
      readAt: NOW - 2 * 60 * 1000,
      language,
      now: NOW,
      timeZone: TZ,
    }),
  };
}
const widgets = Object.fromEntries(
  manifest.widgets.map((w) => [w.key, { icon: w.icon, label: w.label }]),
);
writeFileSync(out, JSON.stringify({ now: NOW, widgets, contents }));
