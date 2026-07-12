const DATA_FILES = {
  cities: 'data/cities.json',
  journeys: 'data/journeys.json',
  events: 'data/events.json',
  people: 'data/people.json',
  countries: 'data/countries.json',
  routes: 'data/routes.geojson',
  images: 'data/images.json',
  metadata: 'data/metadata.json'
};

async function loadJson(path) {
  const response = await fetch(path, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`${path} 로드 실패 (${response.status})`);
  return response.json();
}

export async function loadProjectData() {
  const entries = await Promise.all(
    Object.entries(DATA_FILES).map(async ([key, path]) => [key, await loadJson(path)])
  );
  return Object.fromEntries(entries);
}
