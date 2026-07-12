import { loadProjectData } from './data-service.js';

const els = {
  map: document.querySelector('#map'),
  journeyTabs: document.querySelector('#journeyTabs'),
  heroCard: document.querySelector('#heroCard'),
  startButton: document.querySelector('#startButton'),
  brandButton: document.querySelector('#brandButton'),
  cityCount: document.querySelector('#cityCount'),
  detailPanel: document.querySelector('#detailPanel'),
  panelContent: document.querySelector('#panelContent'),
  panelClose: document.querySelector('#panelClose'),
  timelineJourney: document.querySelector('#timelineJourney'),
  timelinePlace: document.querySelector('#timelinePlace'),
  progressBar: document.querySelector('#progressBar'),
  progressText: document.querySelector('#progressText'),
  prevButton: document.querySelector('#prevButton'),
  nextButton: document.querySelector('#nextButton'),
  playButton: document.querySelector('#playButton'),
  speedSelect: document.querySelector('#speedSelect'),
  searchInput: document.querySelector('#searchInput'),
  searchResults: document.querySelector('#searchResults'),
  searchClear: document.querySelector('#searchClear'),
  placeLanguageSelect: document.querySelector('#placeLanguageSelect'),
  infoButton: document.querySelector('#infoButton'),
  infoDialog: document.querySelector('#infoDialog')
};

const state = {
  data: null,
  map: null,
  activeJourneyId: 'all',
  playJourneyId: null,
  currentStopIndex: -1,
  markers: new Map(),
  routeLayers: new Map(),
  progressLayer: null,
  selectedPlaceId: null,
  selectedStopId: null,
  playTimer: null,
  isPlaying: false,
  searchIndex: []
};

state.placeLanguage = localStorage.getItem('bibleJourneyPlaceLanguage') || 'ko';

const ORIGINAL_PLACE_NAMES = {
  antioch_syria:'Ἀντιόχεια', seleucia_pieria:'Σελεύκεια ἡ Πιερία', salamis:'Σαλαμίς', paphos:'Πάφος', perga:'Πέργη', antioch_pisidia:'Ἀντιόχεια τῆς Πισιδίας', iconium:'Ἰκόνιον', lystra:'Λύστρα', derbe:'Δέρβη', attalia:'Ἀττάλεια',
  syria_cilicia_region:'Συρία καὶ Κιλικία', galatia_phrygia:'Γαλατία καὶ Φρυγία', mysia:'Μυσία', troas:'Ἀλεξάνδρεια Τρωάς', samothrace:'Σαμοθρᾴκη', neapolis:'Νεάπολις', philippi:'Φίλιπποι', amphipolis:'Ἀμφίπολις', apollonia:'Ἀπολλωνία', thessalonica:'Θεσσαλονίκη', berea:'Βέροια', athens:'Ἀθῆναι', corinth:'Κόρινθος', cenchreae:'Κεγχρεαί', ephesus:'Ἔφεσος', caesarea_maritima:'Caesarea Maritima', jerusalem:'Ἱερουσαλήμ',
  macedonia_region:'Μακεδονία', achaia_region:'Ἀχαΐα', assos:'Ἄσσος', mitylene:'Μυτιλήνη', chios:'Χίος', samos:'Σάμος', miletus:'Μίλητος', cos:'Κῶς', rhodes:'Ῥόδος', patara:'Πάταρα', tyre:'Τύρος', ptolemais:'Πτολεμαΐς', sidon:'Σιδών', cyprus_leeward:'Κύπρος', myra:'Μύρα', cnidus:'Κνίδος', salmone:'Σαλμώνη', fair_havens:'Καλοὶ Λιμένες', lasea:'Λασαία', phoenix_crete:'Φοῖνιξ', malta:'Melite', syracuse:'Syracusae', rhegium:'Rhegium', puteoli:'Puteoli', forum_appius:'Forum Appii', three_taverns:'Tres Tabernae', rome:'Roma'
};

const TYPE_LABELS = {
  city: '도시', region: '지역', island: '섬', sea_waypoint: '해상 지점'
};

const CONFIDENCE_LABELS = {
  explicit: '본문 직접 기록', inferred: '본문 흐름 추론', historical: '역사 자료 기반', disputed: '학설 차이'
};

const TRAVEL_MODE_LABELS = {
  land: '육로', sea: '해로', mixed: '육로·해로', unknown: '확인 필요'
};

const STATUS_LABELS = {
  visited: '방문·통과', nearby: '인근 언급', unreached: '목적지였으나 미도착'
};

const normalize = value => String(value ?? '').toLocaleLowerCase('ko-KR').replace(/\s+/g, ' ').trim();
const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const formatBibleReference = value => String(value ?? '')
  .replace(/\bActs\s+(\d+):(\d+)(?:-(?:(\d+):)?(\d+))?/gi, (_, chapter, start, endChapter, end) => {
    if (!end) return `사도행전 ${chapter}장 ${start}절`;
    return endChapter
      ? `사도행전 ${chapter}장 ${start}절–${endChapter}장 ${end}절`
      : `사도행전 ${chapter}장 ${start}–${end}절`;
  })
  .replace(/\bActs\s+(\d+)-(\d+)/gi, '사도행전 $1–$2장')
  .replace(/\bActs\s+(\d+)/gi, '사도행전 $1장')
  .replace(/\bActs\b/gi, '사도행전');
const getJourney = id => state.data.journeys.find(item => item.id === id);
const getPlace = id => state.data.cities.find(item => item.id === id);
const getPerson = id => state.data.people.find(item => item.id === id);
const getCountry = id => state.data.countries.find(item => item.id === id);
const getPlaceName = place => {
  if (!place) return '';
  if (state.placeLanguage === 'en') return place.ancientNameEn;
  if (state.placeLanguage === 'original') return ORIGINAL_PLACE_NAMES[place.id] || place.ancientNameEn;
  return place.ancientNameKo;
};
const getImage = id => state.data.images.find(item => item.id === id) || state.data.images.find(item => item.id === 'generic-city');

function getStopRecords(placeId) {
  return state.data.journeys.flatMap(journey => journey.stops
    .filter(stop => stop.placeId === placeId)
    .map(stop => ({ ...stop, journey }))
  );
}

function confidenceChip(confidence) {
  return `<span class="confidence-chip ${escapeHtml(confidence)}" title="${escapeHtml(CONFIDENCE_LABELS[confidence] || confidence)}">${escapeHtml(confidence)}</span>`;
}

function typeLabel(type) {
  return TYPE_LABELS[type] || type;
}

function initMap() {
  state.map = L.map(els.map, {
    zoomControl: false,
    minZoom: 3,
    maxZoom: 11,
    worldCopyJump: false,
    preferCanvas: true,
    maxBounds: [[20, -18], [48, 46]],
    maxBoundsViscosity: 0.72
  }).setView([38.2, 23.2], 4);

  L.control.zoom({ position: 'topleft' }).addTo(state.map);
  // Use a label-free basemap so place names can follow the UI language selector.
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {
    subdomains: 'abcd',
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    crossOrigin: true
  }).addTo(state.map);

  state.map.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>');
  state.map.on('click', event => {
    if (event.originalEvent?.target?.closest?.('.leaflet-marker-icon')) return;
    hideSearchResults();
  });
  state.map.on('zoomend', renderMarkers);
}

function createJourneyTabs() {
  const fragment = document.createDocumentFragment();
  state.data.journeys.forEach(journey => {
    const button = document.createElement('button');
    button.className = 'journey-tab';
    button.type = 'button';
    button.dataset.journey = journey.id;
    button.setAttribute('aria-pressed', 'false');
    button.style.setProperty('--tab-color', journey.color);
    button.textContent = journey.shortTitle;
    fragment.appendChild(button);
  });
  els.journeyTabs.appendChild(fragment);
}

function markerJourneyColor(place) {
  const journeyId = state.activeJourneyId !== 'all'
    ? state.activeJourneyId
    : place.relatedJourneyIds[0];
  return getJourney(journeyId)?.color || '#2f6fed';
}

function getMarkerOrder(placeId) {
  if (state.activeJourneyId === 'all') return '';
  const stop = getJourney(state.activeJourneyId)?.stops.find(item => item.placeId === placeId);
  return stop?.order ?? '';
}

function makeMarkerIcon(place, active = false, pulsing = false) {
  const color = markerJourneyColor(place);
  const classes = [
    'marker-shell',
    active ? 'is-active' : '',
    pulsing ? 'marker-pulse' : '',
    ['region','sea_waypoint'].includes(place.type) ? 'region' : '',
    place.status === 'unreached' ? 'unreached' : '',
    place.status === 'nearby' ? 'nearby' : ''
  ].filter(Boolean).join(' ');
  const order = getMarkerOrder(place.id);
  const content = order || (place.type === 'region' ? '◇' : place.status === 'unreached' ? '×' : '');
  return L.divIcon({
    className: '',
    html: `<div class="${classes}" style="--marker-color:${color}"><div class="marker-dot"><span>${content}</span></div></div>`,
    iconSize: [34,34],
    iconAnchor: [17,17],
    tooltipAnchor: [0,-15]
  });
}

function renderMarkers() {
  for (const marker of state.markers.values()) marker.remove();
  state.markers.clear();

  const visibleJourneyIds = state.activeJourneyId === 'all'
    ? new Set(state.data.journeys.map(item => item.id))
    : new Set([state.activeJourneyId]);

  state.data.cities.forEach(place => {
    const visible = place.relatedJourneyIds.some(id => visibleJourneyIds.has(id));
    if (!visible) return;
    const marker = L.marker([place.coordinates.lat, place.coordinates.lng], {
      icon: makeMarkerIcon(place, place.id === state.selectedPlaceId, false),
      keyboard: true,
      riseOnHover: true,
      title: `${getPlaceName(place)} (${place.modernName})`
    });
    const showPermanentLabel = state.activeJourneyId !== 'all' || state.map.getZoom() >= 5 || place.id === state.selectedPlaceId;
    marker.bindTooltip(getPlaceName(place), {
      className: `place-tooltip${showPermanentLabel ? ' map-place-label' : ''}`,
      direction: 'top',
      offset: [0,-4],
      permanent: showPermanentLabel,
      opacity: 1
    });
    marker.on('click', () => {
      const matchingStops = getStopRecords(place.id).filter(record => state.activeJourneyId === 'all' || record.journey.id === state.activeJourneyId);
      openPlace(place.id, matchingStops[0]?.id ?? null, { fly: false });
    });
    marker.addTo(state.map);
    state.markers.set(place.id, marker);
  });
}

function routeStyle(feature, muted = false) {
  const journey = getJourney(feature.properties.journeyId);
  const uncertain = feature.properties.confidence !== 'explicit';
  return {
    color: journey.color,
    weight: muted ? 2.5 : 4.2,
    opacity: muted ? .38 : .78,
    dashArray: uncertain ? '7 8' : null,
    lineCap: 'round',
    lineJoin: 'round'
  };
}

function renderRoutes() {
  for (const layer of state.routeLayers.values()) layer.remove();
  state.routeLayers.clear();
  if (state.progressLayer) {
    state.progressLayer.remove();
    state.progressLayer = null;
  }

  const journeyIds = state.activeJourneyId === 'all'
    ? state.data.journeys.map(item => item.id)
    : [state.activeJourneyId];

  journeyIds.forEach(journeyId => {
    const features = state.data.routes.features.filter(feature => feature.properties.journeyId === journeyId);
    const layer = L.geoJSON({ type: 'FeatureCollection', features }, {
      style: feature => routeStyle(feature, state.activeJourneyId === 'all'),
      onEachFeature: (feature, path) => {
        const from = getPlace(feature.properties.fromPlaceId);
        const to = getPlace(feature.properties.toPlaceId);
        path.bindTooltip(`${getPlaceName(from)} → ${getPlaceName(to)}<br>${formatBibleReference(feature.properties.sourceReference)}`, {
          sticky: true,
          className: 'route-tooltip'
        });
        path.on('click', () => openPlace(to.id, feature.properties.toStopId, { fly: true }));
      }
    }).addTo(state.map);
    state.routeLayers.set(journeyId, layer);
  });
  updateProgressRoute();
}

function fitJourney(journeyId) {
  const journey = getJourney(journeyId);
  if (!journey) return;
  const latLngs = journey.stops.map(stop => {
    const place = getPlace(stop.placeId);
    return [place.coordinates.lat, place.coordinates.lng];
  });
  const bounds = L.latLngBounds(latLngs);
  const panelPadding = window.innerWidth > 680 ? [410, 100] : [30, 170];
  state.map.fitBounds(bounds, { paddingTopLeft: [40,40], paddingBottomRight: panelPadding, maxZoom: 6, animate: true });
}

function updateMarkerIcons(pulsingPlaceId = null) {
  state.markers.forEach((marker, placeId) => {
    const place = getPlace(placeId);
    marker.setIcon(makeMarkerIcon(place, placeId === state.selectedPlaceId, placeId === pulsingPlaceId));
  });
}

function setActiveJourney(journeyId, { showPanel = true, focus = true, resetIndex = true } = {}) {
  stopAutoplay();
  state.activeJourneyId = journeyId;
  if (journeyId !== 'all') state.playJourneyId = journeyId;
  if (resetIndex) state.currentStopIndex = -1;
  state.selectedPlaceId = null;
  state.selectedStopId = null;
  closePanel();

  document.querySelectorAll('.journey-tab').forEach(button => {
    const active = button.dataset.journey === journeyId;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });

  renderRoutes();
  renderMarkers();
  updateTimeline();
  els.heroCard.classList.add('is-hidden');

  if (journeyId === 'all') {
    state.map.flyTo([38.2, 23.2], 4, { duration: .7 });
  } else {
    if (focus) fitJourney(journeyId);
    if (showPanel) showJourneyPanel(journeyId);
  }
}

function openPlace(placeId, stopId = null, { fly = true } = {}) {
  const place = getPlace(placeId);
  if (!place) return;
  state.selectedPlaceId = placeId;
  state.selectedStopId = stopId;
  els.heroCard.classList.add('is-hidden');
  renderPlacePanel(place, stopId);
  updateMarkerIcons(placeId);

  const stopRecord = stopId ? state.data.journeys.flatMap(j => j.stops.map(s => ({...s, journey:j}))).find(record => record.id === stopId) : null;
  if (stopRecord) {
    state.playJourneyId = stopRecord.journey.id;
    state.currentStopIndex = stopRecord.journey.stops.findIndex(item => item.id === stopId);
  }
  updateTimeline();
  updateProgressRoute();

  if (fly) {
    const offsetLng = window.innerWidth > 680 ? -2.4 : 0;
    state.map.flyTo([place.coordinates.lat, place.coordinates.lng + offsetLng], Math.max(state.map.getZoom(), place.type === 'region' ? 5 : 7), { duration: .8 });
  }
}

function renderPlacePanel(place, selectedStopId) {
  const country = getCountry(place.countryId);
  const stopRecords = getStopRecords(place.id).sort((a,b) => a.journey.id.localeCompare(b.journey.id) || a.order - b.order);
  const relatedEvents = state.data.events.filter(event => event.placeId === place.id);
  const people = place.relatedPeopleIds.map(getPerson).filter(Boolean);
  const image = getImage('generic-city');
  const journeyBadges = place.relatedJourneyIds.map(id => {
    const journey = getJourney(id);
    return `<span class="journey-badge" style="background:${journey.color}">${escapeHtml(journey.shortTitle)}</span>`;
  }).join('');

  const stopCards = stopRecords.map(record => {
    const previousStop = record.previousStopId ? record.journey.stops.find(stop => stop.id === record.previousStopId) : null;
    const previousPlace = previousStop ? getPlace(previousStop.placeId) : null;
    const companions = record.companions.map(getPerson).filter(Boolean);
    const routeCopy = previousPlace
      ? `${getPlaceName(previousPlace)} → ${getPlaceName(place)}`
      : `${getPlaceName(place)}에서 여정 시작`;
    return `
      <li class="expandable-card stop-card"${record.id === selectedStopId ? ' aria-current="step"' : ''}>
        <details${record.id === selectedStopId ? ' open' : ''}>
          <summary>
            <span class="stop-number" style="--stop-color:${record.journey.color}">${record.order}</span>
            <span class="card-summary-copy"><strong>${escapeHtml(record.journey.title)} · ${escapeHtml(formatBibleReference(record.bibleReference))}</strong><small>${escapeHtml(record.eventSummary)}</small></span>
            <span class="expand-indicator" aria-hidden="true"></span>
          </summary>
          <div class="card-details">
            <p>${escapeHtml(record.eventSummary)}</p>
            <dl class="detail-facts">
              <div><dt>이동 구간</dt><dd>${escapeHtml(routeCopy)}</dd></div>
              <div><dt>이동 방식</dt><dd>${escapeHtml(TRAVEL_MODE_LABELS[record.travelModeFromPrevious] || record.travelModeFromPrevious)}</dd></div>
              <div><dt>동행자</dt><dd>${escapeHtml(companions.map(person => person.nameKo).join(', ') || '기록 없음')}</dd></div>
              <div><dt>방문 상태</dt><dd>${escapeHtml(STATUS_LABELS[record.status] || record.status)}</dd></div>
              <div><dt>출처</dt><dd>성경 · ${escapeHtml(formatBibleReference(record.sourceReference))}</dd></div>
            </dl>
            <div class="badge-row">${confidenceChip(record.confidence)}<span class="confidence-description">${escapeHtml(CONFIDENCE_LABELS[record.confidence] || '')}</span></div>
            <div class="local-bible-note"><strong>본문 내용 요약</strong><span>위 내용은 ${escapeHtml(formatBibleReference(record.bibleReference))}에 기록된 이동과 사건을 요약한 것입니다.</span></div>
          </div>
        </details>
      </li>`;
  }).join('');

  const eventCards = relatedEvents.length ? relatedEvents.map(event => {
    const journey = getJourney(event.journeyId);
    return `<li class="expandable-card event-card" style="--event-color:${journey?.color || '#2f6fed'}">
      <details>
        <summary>
          <span class="card-summary-copy"><strong>${escapeHtml(event.title)}</strong><small>${escapeHtml(event.summary)}</small></span>
          <span class="expand-indicator" aria-hidden="true"></span>
        </summary>
        <div class="card-details">
          <p>${escapeHtml(event.summary)}</p>
          <dl class="detail-facts">
            <div><dt>관련 여정</dt><dd>${escapeHtml(journey?.title || '여정 확인 필요')}</dd></div>
            <div><dt>성경 본문</dt><dd>${escapeHtml(event.bibleReferences.map(formatBibleReference).join(', '))}</dd></div>
            <div><dt>출처</dt><dd>성경 · ${escapeHtml(formatBibleReference(event.sourceReference))}</dd></div>
          </dl>
          <div class="badge-row">${confidenceChip(event.confidence)}<span class="confidence-description">${escapeHtml(CONFIDENCE_LABELS[event.confidence] || '')}</span></div>
          <div class="local-bible-note"><strong>본문 내용 요약</strong><span>저작권이 있는 번역 본문을 인용하지 않고, 해당 사건의 핵심 내용만 정리했습니다.</span></div>
        </div>
      </details>
    </li>`;
  }).join('') : '<li class="event-card"><strong>이동 경유지</strong><span>사도행전에는 별도의 주요 사건 없이 경유 또는 항해 위치로 기록됩니다.</span></li>';

  const letterItems = place.relatedLetters.length
    ? place.relatedLetters.map(letter => `<li><strong>${escapeHtml(letter.name)}</strong>${confidenceChip(letter.confidence)}<small>${escapeHtml(letter.relation)}</small></li>`).join('')
    : '<li>직접 연결되는 신약 서신 정보가 확정적으로 기록되지 않았습니다.</li>';

  const sourceItems = [
    ...place.bibleReferences.map(ref => `<li><strong>개역개정</strong> · ${escapeHtml(formatBibleReference(ref))}</li>`)
  ].join('');

  const bibleReferenceCards = place.bibleReferences.map(ref => {
    const normalizedRef = String(ref).toLowerCase();
    const matchingStops = stopRecords.filter(record => {
      const candidate = String(record.bibleReference).toLowerCase();
      return candidate === normalizedRef || candidate.includes(normalizedRef) || normalizedRef.includes(candidate);
    });
    const matchingEvents = relatedEvents.filter(event => event.bibleReferences.some(eventRef => {
      const candidate = String(eventRef).toLowerCase();
      return candidate === normalizedRef || candidate.includes(normalizedRef) || normalizedRef.includes(candidate);
    }));
    const summaries = [...matchingEvents.map(event => event.summary), ...matchingStops.map(record => record.eventSummary)];
    const uniqueSummaries = [...new Set(summaries)];
    const summaryItems = uniqueSummaries.length
      ? `<ul>${uniqueSummaries.map(summary => `<li>${escapeHtml(summary)}</li>`).join('')}</ul>`
      : `<p>${escapeHtml(place.summary)}</p>`;
    return `<li class="bible-reference-card"><details><summary>${escapeHtml(formatBibleReference(ref))}<span class="expand-indicator" aria-hidden="true"></span></summary><div class="bible-reference-details"><strong>본문 내용 요약</strong>${summaryItems}<small>※ 개역개정 본문 인용이 아닌, 사도행전의 이동과 사건을 정리한 요약입니다.</small></div></details></li>`;
  }).join('');

  els.panelContent.innerHTML = `
    <div class="panel-visual"><img src="${image.path}" alt="${escapeHtml(image.alt)}" loading="lazy"></div>
    <div class="panel-body">
      <div class="panel-title-row">
        <span class="eyebrow">${escapeHtml(typeLabel(place.type).toUpperCase())}</span>
        <h2>${escapeHtml(getPlaceName(place))}</h2>
        <div class="modern-name">${escapeHtml(place.ancientNameKo)} · ${escapeHtml(ORIGINAL_PLACE_NAMES[place.id] || place.ancientNameEn)} · ${escapeHtml(place.ancientNameEn)}</div>
      </div>
      <div class="badge-row">${journeyBadges}${confidenceChip(place.confidence)}<span class="type-badge">${escapeHtml(typeLabel(place.type))}</span></div>
      <p class="panel-summary">${escapeHtml(place.summary)}</p>
      <dl class="info-grid">
        <div class="info-cell"><dt>현재 국가</dt><dd>${escapeHtml(country?.nameKo || '확인 필요')}</dd></div>
        <div class="info-cell"><dt>방문 상태</dt><dd>${place.status === 'unreached' ? '목적지였으나 미도착' : place.status === 'nearby' ? '인근 언급' : '방문·통과 기록'}</dd></div>
      </dl>

      <section class="panel-section"><h3>관련 사건</h3><ul class="event-list">${eventCards}</ul></section>
      <section class="panel-section"><h3>방문 순서와 이동 기록</h3><ul class="stop-list">${stopCards}</ul></section>
      <section class="panel-section"><h3>관련 인물</h3><ul class="people-list">${people.map(person => `<li><strong>${escapeHtml(person.nameKo)}</strong> · ${escapeHtml(person.description)}</li>`).join('')}</ul></section>
      <section class="panel-section"><h3>관련 성경 <small class="section-note">개역개정 장절 기준</small></h3><ul class="reference-list">${bibleReferenceCards}</ul></section>
      <section class="panel-section"><h3>관련 서신</h3><ul class="letter-list">${letterItems}</ul></section>
      <section class="panel-section"><h3>당시 역사와 지리</h3><p>${escapeHtml(place.historicalContext)}</p></section>
      <section class="panel-section"><h3>출처와 주의</h3><ul class="source-list">${sourceItems}</ul></section>
    </div>`;

  els.detailPanel.hidden = false;
  document.body.classList.add('panel-open');
}

function showJourneyPanel(journeyId) {
  const journey = getJourney(journeyId);
  const people = journey.companions.map(getPerson).filter(Boolean);
  const image = getImage(journeyId);
  const uncertainStops = journey.stops.filter(stop => stop.confidence !== 'explicit').length;
  els.panelContent.innerHTML = `
    <div class="panel-visual"><img src="${image.path}" alt="${escapeHtml(image.alt)}"></div>
    <div class="journey-hero" style="--journey-color:${journey.color}">
        <span class="eyebrow">${escapeHtml(formatBibleReference(journey.keyReference))}</span>
      <h2>${escapeHtml(journey.title)}</h2>
      <p>${escapeHtml(journey.summary)}</p>
      <div class="journey-stat-grid">
        <div class="info-cell"><dt>방문 기록</dt><dd>${journey.stops.length}개 정류 기록</dd></div>
        <div class="info-cell"><dt>추론 구간</dt><dd>${uncertainStops}개 표시</dd></div>
      </div>
    </div>
    <div class="panel-body">
      <section class="panel-section"><h3>여행 목적</h3><p>${escapeHtml(journey.purpose)}</p></section>
      <section class="panel-section"><h3>기간</h3><p>${escapeHtml(journey.period)}</p></section>
      <section class="panel-section"><h3>동행자</h3><ul class="people-list">${people.map(person => `<li><strong>${escapeHtml(person.nameKo)}</strong> · ${escapeHtml(person.description)}</li>`).join('')}</ul></section>
      <section class="panel-section"><h3>대표 사건</h3><ul class="event-list">${journey.keyEvents.map(title => `<li class="event-card" style="--event-color:${journey.color}"><strong>${escapeHtml(title)}</strong></li>`).join('')}</ul></section>
      <section class="panel-section"><h3>전체 방문 순서</h3><ul class="stop-list">${journey.stops.map(stop => {
        const place = getPlace(stop.placeId);
        return `<li class="stop-card"><button type="button" class="stop-number" style="--stop-color:${journey.color};border:0;cursor:pointer" data-open-stop="${stop.id}">${stop.order}</button><div><strong>${escapeHtml(getPlaceName(place))} · ${escapeHtml(formatBibleReference(stop.bibleReference))}</strong><p>${escapeHtml(stop.eventSummary)}</p></div></li>`;
      }).join('')}</ul></section>
      <section class="panel-section"><h3>정확성 원칙</h3><p>경로는 사도행전의 서술 순서를 우선합니다. 본문에 도시가 없는 구간은 지역 노드로 남기고, 일반적 해석은 inferred, 위치 논쟁은 disputed로 표시합니다.</p></section>
    </div>`;
  els.detailPanel.hidden = false;
  document.body.classList.add('panel-open');
}

function closePanel() {
  els.detailPanel.hidden = true;
  document.body.classList.remove('panel-open');
  state.selectedPlaceId = null;
  state.selectedStopId = null;
  updateMarkerIcons();
}

function updateTimeline() {
  const journey = getJourney(state.playJourneyId);
  if (!journey) {
    els.timelineJourney.textContent = '여정을 선택하세요';
    els.timelinePlace.textContent = '도시를 누르면 상세 정보가 열립니다';
    els.progressText.textContent = '0 / 0';
    els.progressBar.style.width = '0%';
    els.prevButton.disabled = true;
    els.nextButton.disabled = true;
    els.playButton.disabled = true;
    return;
  }

  const stop = journey.stops[state.currentStopIndex];
  const place = stop ? getPlace(stop.placeId) : null;
  els.timelineJourney.textContent = journey.title;
  els.timelinePlace.textContent = stop ? `${stop.order}. ${getPlaceName(place)} · ${formatBibleReference(stop.bibleReference)}` : '재생하면 첫 장소부터 시작합니다';
  const current = state.currentStopIndex >= 0 ? state.currentStopIndex + 1 : 0;
  els.progressText.textContent = `${current} / ${journey.stops.length}`;
  els.progressBar.style.width = `${journey.stops.length ? current / journey.stops.length * 100 : 0}%`;
  els.progressBar.style.background = journey.color;
  els.prevButton.disabled = state.currentStopIndex <= 0;
  els.nextButton.disabled = state.currentStopIndex >= journey.stops.length - 1;
  els.playButton.disabled = false;
  els.playButton.innerHTML = state.isPlaying ? '<span aria-hidden="true">❚❚</span>' : '<span aria-hidden="true">▶</span>';
  els.playButton.setAttribute('aria-label', state.isPlaying ? '자동 재생 일시정지' : '자동 재생 시작');
}

function showStopByIndex(index, { fly = true } = {}) {
  const journey = getJourney(state.playJourneyId);
  if (!journey) return;
  const bounded = Math.max(0, Math.min(index, journey.stops.length - 1));
  state.currentStopIndex = bounded;
  const stop = journey.stops[bounded];
  const place = getPlace(stop.placeId);
  openPlace(place.id, stop.id, { fly });
  updateMarkerIcons(place.id);
}

function updateProgressRoute() {
  if (state.progressLayer) {
    state.progressLayer.remove();
    state.progressLayer = null;
  }
  const journey = getJourney(state.playJourneyId);
  if (!journey || state.currentStopIndex < 0 || state.activeJourneyId === 'all') return;
  const coordinates = journey.stops.slice(0, state.currentStopIndex + 1).map(stop => {
    const place = getPlace(stop.placeId);
    return [place.coordinates.lat, place.coordinates.lng];
  });
  if (coordinates.length < 2) return;
  state.progressLayer = L.polyline(coordinates, {
    color: journey.color,
    weight: 6.5,
    opacity: .96,
    lineCap: 'round',
    lineJoin: 'round'
  }).addTo(state.map).bringToFront();
}

function toggleAutoplay() {
  if (state.isPlaying) {
    stopAutoplay();
    return;
  }
  if (!state.playJourneyId) setActiveJourney(state.data.journeys[0].id, { showPanel: false });
  const journey = getJourney(state.playJourneyId);
  if (state.activeJourneyId === 'all') setActiveJourney(journey.id, { showPanel: false, resetIndex: false });
  if (state.currentStopIndex < 0 || state.currentStopIndex >= journey.stops.length - 1) showStopByIndex(0);
  state.isPlaying = true;
  updateTimeline();
  scheduleNextStop();
}

function scheduleNextStop() {
  clearTimeout(state.playTimer);
  if (!state.isPlaying) return;
  const journey = getJourney(state.playJourneyId);
  const delay = Number(els.speedSelect.value);
  state.playTimer = setTimeout(() => {
    if (state.currentStopIndex >= journey.stops.length - 1) {
      stopAutoplay();
      return;
    }
    showStopByIndex(state.currentStopIndex + 1);
    scheduleNextStop();
  }, delay);
}

function stopAutoplay() {
  clearTimeout(state.playTimer);
  state.playTimer = null;
  state.isPlaying = false;
  updateTimeline();
}

function buildSearchIndex() {
  state.searchIndex = state.data.cities.map(place => {
    const country = getCountry(place.countryId);
    const people = place.relatedPeopleIds.map(getPerson).filter(Boolean);
    const journeys = place.relatedJourneyIds.map(getJourney).filter(Boolean);
    const text = [
      place.ancientNameKo, place.ancientNameEn, place.modernName,
      country?.nameKo, country?.nameEn, place.summary, place.historicalContext,
      ...place.bibleReferences,
      ...people.flatMap(person => [person.nameKo, person.nameEn]),
      ...journeys.flatMap(journey => [journey.title, journey.keyReference]),
      ...place.relatedLetters.flatMap(letter => [letter.name, letter.relation])
    ].join(' ');
    return { place, text: normalize(text), people, country };
  });
}

function searchPlaces(query) {
  const normalized = normalize(query);
  if (!normalized) return [];
  const tokens = normalized.split(' ').filter(Boolean);
  return state.searchIndex
    .map(item => {
      const exactName = [item.place.ancientNameKo, item.place.ancientNameEn, item.place.modernName].some(name => normalize(name).includes(normalized));
      const tokenMatches = tokens.filter(token => item.text.includes(token)).length;
      const score = (exactName ? 100 : 0) + tokenMatches * 10 + (item.text.startsWith(normalized) ? 20 : 0);
      return { ...item, score };
    })
    .filter(item => item.score > 0)
    .sort((a,b) => b.score - a.score || a.place.ancientNameKo.localeCompare(b.place.ancientNameKo, 'ko'))
    .slice(0, 12);
}

function renderSearchResults(query) {
  const results = searchPlaces(query);
  els.searchClear.hidden = !query;
  if (!query) {
    hideSearchResults();
    return;
  }
  els.searchResults.innerHTML = results.length ? results.map(({ place, country }) => `
    <button class="search-result" type="button" role="option" data-place-id="${place.id}">
      <span class="search-result-icon">⌖</span>
      <span><strong>${escapeHtml(getPlaceName(place))}</strong><small>${escapeHtml(place.ancientNameKo)} · ${escapeHtml(place.ancientNameEn)} · ${escapeHtml(country?.nameKo || '')}</small></span>
      <span class="result-type">${escapeHtml(typeLabel(place.type))}</span>
    </button>`).join('') : '<div class="search-result"><span class="search-result-icon">—</span><span><strong>검색 결과 없음</strong><small>도시, 국가, 인물 또는 장절을 다시 입력해 보세요.</small></span></div>';
  els.searchResults.hidden = false;
  els.searchInput.setAttribute('aria-expanded', 'true');
}

function hideSearchResults() {
  els.searchResults.hidden = true;
  els.searchInput.setAttribute('aria-expanded', 'false');
}

function bindEvents() {
  els.journeyTabs.addEventListener('click', event => {
    const button = event.target.closest('[data-journey]');
    if (!button) return;
    setActiveJourney(button.dataset.journey);
  });
  els.startButton.addEventListener('click', () => {
    const first = state.data.journeys[0];
    setActiveJourney(first.id, { showPanel: false });
    state.currentStopIndex = 0;
    showStopByIndex(0);
  });
  els.brandButton.addEventListener('click', resetHome);
  els.panelClose.addEventListener('click', closePanel);
  els.prevButton.addEventListener('click', () => showStopByIndex(state.currentStopIndex - 1));
  els.nextButton.addEventListener('click', () => {
    if (!state.playJourneyId) {
      setActiveJourney(state.data.journeys[0].id, { showPanel: false });
      showStopByIndex(0);
      return;
    }
    showStopByIndex(state.currentStopIndex + 1);
  });
  els.playButton.addEventListener('click', toggleAutoplay);
  els.speedSelect.addEventListener('change', () => { if (state.isPlaying) scheduleNextStop(); });
  els.placeLanguageSelect.addEventListener('change', event => {
    state.placeLanguage = event.target.value;
    localStorage.setItem('bibleJourneyPlaceLanguage', state.placeLanguage);
    renderRoutes();
    renderMarkers();
    updateTimeline();
    if (state.selectedPlaceId) renderPlacePanel(getPlace(state.selectedPlaceId), state.selectedStopId);
  });
  els.infoButton.addEventListener('click', () => els.infoDialog.showModal());
  els.searchInput.addEventListener('input', event => renderSearchResults(event.target.value));
  els.searchInput.addEventListener('keydown', event => {
    if (event.key === 'Escape') hideSearchResults();
    if (event.key === 'Enter') {
      const first = els.searchResults.querySelector('[data-place-id]');
      if (first) {
        event.preventDefault();
        selectSearchResult(first.dataset.placeId);
      }
    }
  });
  els.searchClear.addEventListener('click', () => {
    els.searchInput.value = '';
    els.searchClear.hidden = true;
    hideSearchResults();
    els.searchInput.focus();
  });
  els.searchResults.addEventListener('click', event => {
    const button = event.target.closest('[data-place-id]');
    if (button) selectSearchResult(button.dataset.placeId);
  });
  els.panelContent.addEventListener('click', event => {
    const button = event.target.closest('[data-open-stop]');
    if (!button) return;
    const stopId = button.dataset.openStop;
    const journey = state.data.journeys.find(item => item.stops.some(stop => stop.id === stopId));
    if (!journey) return;
    if (state.activeJourneyId !== journey.id) setActiveJourney(journey.id, { showPanel: false, resetIndex: false });
    state.playJourneyId = journey.id;
    showStopByIndex(journey.stops.findIndex(stop => stop.id === stopId));
  });
  document.addEventListener('click', event => {
    if (!event.target.closest('.search-wrap')) hideSearchResults();
  });
  window.addEventListener('resize', () => state.map?.invalidateSize());
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopAutoplay(); });
}

function selectSearchResult(placeId) {
  hideSearchResults();
  els.searchInput.value = getPlaceName(getPlace(placeId));
  els.searchClear.hidden = false;
  openPlace(placeId, null, { fly: true });
}

function resetHome() {
  stopAutoplay();
  state.activeJourneyId = 'all';
  state.playJourneyId = null;
  state.currentStopIndex = -1;
  closePanel();
  document.querySelectorAll('.journey-tab').forEach(button => {
    const active = button.dataset.journey === 'all';
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  renderRoutes();
  renderMarkers();
  state.map.flyTo([38.2, 23.2], 4, { duration: .8 });
  els.heroCard.classList.remove('is-hidden');
  els.searchInput.value = '';
  els.searchClear.hidden = true;
  updateTimeline();
}

function showFatalError(error) {
  console.error(error);
  els.map.innerHTML = `<div class="loading-error"><div><h2>데이터를 불러오지 못했습니다</h2><p>${escapeHtml(error.message)}<br>로컬 파일을 직접 열지 말고 README의 로컬 서버 실행 방법을 사용하세요.</p></div></div>`;
}

async function init() {
  try {
    state.data = await loadProjectData();
    state.playJourneyId = null;
    if (!['ko', 'original', 'en'].includes(state.placeLanguage)) state.placeLanguage = 'ko';
    els.placeLanguageSelect.value = state.placeLanguage;
    els.cityCount.textContent = state.data.cities.length;
    initMap();
    createJourneyTabs();
    renderRoutes();
    renderMarkers();
    buildSearchIndex();
    bindEvents();
    updateTimeline();
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('./service-worker.js').catch(error => console.warn('Service worker:', error));
    }
  } catch (error) {
    showFatalError(error);
  }
}

init();
