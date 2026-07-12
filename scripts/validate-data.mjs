import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = async name => JSON.parse(await fs.readFile(path.join(root, 'data', name), 'utf8'));
const [cities, journeys, people, countries, events, routes] = await Promise.all([
  read('cities.json'), read('journeys.json'), read('people.json'), read('countries.json'), read('events.json'), read('routes.geojson')
]);
const errors = [];
const unique = (items, label) => {
  const seen = new Set();
  for (const item of items) {
    if (!item.id) errors.push(`${label}: id 누락`);
    if (seen.has(item.id)) errors.push(`${label}: 중복 id ${item.id}`);
    seen.add(item.id);
  }
  return seen;
};
const cityIds = unique(cities, 'cities');
const journeyIds = unique(journeys, 'journeys');
const peopleIds = unique(people, 'people');
const countryIds = unique(countries, 'countries');
unique(events, 'events');
const stopIds = new Set();

for (const city of cities) {
  if (!countryIds.has(city.countryId)) errors.push(`city ${city.id}: unknown country ${city.countryId}`);
  if (!Number.isFinite(city.coordinates?.lat) || !Number.isFinite(city.coordinates?.lng)) errors.push(`city ${city.id}: invalid coordinates`);
  if (!city.bibleReferences?.length) errors.push(`city ${city.id}: bibleReferences 누락`);
  if (!city.sourceType || !city.sourceReference) errors.push(`city ${city.id}: source fields 누락`);
  if (!Array.isArray(city.visits) || !city.visits.length) errors.push(`city ${city.id}: visits 누락`);
  for (const id of city.relatedJourneyIds || []) {
    if (!journeyIds.has(id)) errors.push(`city ${city.id}: unknown journey ${id}`);
    if (!(city.visits || []).some(visit => visit.journeyId === id)) errors.push(`city ${city.id}: journey ${id} has no visit record`);
  }
  for (const id of city.relatedPeopleIds || []) if (!peopleIds.has(id)) errors.push(`city ${city.id}: unknown person ${id}`);
}

let expectedRouteCount = 0;
for (const journey of journeys) {
  expectedRouteCount += Math.max(0, journey.stops.length - 1);
  journey.stops.forEach((stop, index) => {
    if (stopIds.has(stop.id)) errors.push(`duplicate stop id ${stop.id}`);
    stopIds.add(stop.id);
    if (!cityIds.has(stop.placeId)) errors.push(`${stop.id}: unknown place ${stop.placeId}`);
    if (stop.order !== index + 1) errors.push(`${stop.id}: order ${stop.order}, expected ${index + 1}`);
    const expectedPrev = index ? journey.stops[index - 1].id : null;
    const expectedNext = index + 1 < journey.stops.length ? journey.stops[index + 1].id : null;
    if (stop.previousStopId !== expectedPrev) errors.push(`${stop.id}: previousStopId mismatch`);
    if (stop.nextStopId !== expectedNext) errors.push(`${stop.id}: nextStopId mismatch`);
    if (!stop.bibleReference) errors.push(`${stop.id}: bibleReference 누락`);
    if (!stop.sourceType || !stop.sourceReference) errors.push(`${stop.id}: source fields 누락`);
  });
}

for (const event of events) {
  if (!cityIds.has(event.placeId)) errors.push(`event ${event.id}: unknown place ${event.placeId}`);
  if (!journeyIds.has(event.journeyId)) errors.push(`event ${event.id}: unknown journey ${event.journeyId}`);
  if (!event.bibleReferences?.length) errors.push(`event ${event.id}: bibleReferences 누락`);
  if (!event.sourceType || !event.sourceReference) errors.push(`event ${event.id}: source fields 누락`);
}

if (routes.type !== 'FeatureCollection') errors.push('routes.geojson: FeatureCollection 아님');
if (routes.features.length !== expectedRouteCount) errors.push(`route count ${routes.features.length}, expected ${expectedRouteCount}`);
for (const feature of routes.features) {
  const p = feature.properties || {};
  if (!journeyIds.has(p.journeyId)) errors.push(`route: unknown journey ${p.journeyId}`);
  if (!stopIds.has(p.fromStopId) || !stopIds.has(p.toStopId)) errors.push(`route: invalid stop link ${p.fromStopId} -> ${p.toStopId}`);
  if (feature.geometry?.type !== 'LineString' || feature.geometry.coordinates.length < 2) errors.push('route: invalid geometry');
}

if (errors.length) {
  console.error(`\n데이터 검증 실패: ${errors.length}건`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}
console.log(`데이터 검증 통과: ${cities.length} places, ${stopIds.size} stops, ${routes.features.length} route segments, ${events.length} major events`);
