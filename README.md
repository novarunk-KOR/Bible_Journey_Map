# Bible Journey Map

사도행전의 기록을 따라 바울의 1·2·3차 전도여행과 로마 압송 경로를 탐험하는 반응형 인터랙티브 지도입니다. HTML, CSS, Vanilla JavaScript, Leaflet, JSON, GeoJSON만 사용한 정적 사이트이므로 GitHub Pages에 바로 배포할 수 있습니다.

## 현재 범위

- 4개 여정, 54개 장소, 70개 방문 기록, 66개 이동 구간
- 도시·지역·섬·해상 웨이포인트 표시
- 전체/여정별 필터, 도시 정보 패널, 검색, 이전·다음 장소, 자동 재생과 속도 조절
- 모바일 하단 시트, 데스크톱 우측 패널
- `explicit`, `inferred`, `historical`, `disputed` 신뢰도 표시
- 로컬 데이터·UI 셸을 캐시하는 기본 PWA 구조

## 실행 방법

JSON 파일을 `fetch()`로 읽으므로 `index.html`을 파일 탐색기에서 직접 열지 말고 로컬 서버를 사용합니다.

```bash
python -m http.server 8080
```

브라우저에서 `http://localhost:8080`을 엽니다. Node.js가 설치되어 있다면 먼저 데이터 무결성을 검사할 수 있습니다.

```bash
npm test
```

## GitHub Pages 배포

1. 이 폴더의 내용을 GitHub 저장소 루트에 업로드합니다.
2. 기본 브랜치를 `main`으로 사용합니다.
3. 저장소의 **Settings → Pages → Source**에서 **GitHub Actions**를 선택합니다.
4. `.github/workflows/pages.yml`이 데이터 검증 후 사이트를 배포합니다.

정적 HTML/CSS/JavaScript를 저장소에서 직접 게시하는 방식은 GitHub Pages 공식 구조와 호환됩니다.

## 프로젝트 구조

```text
.
├─ index.html
├─ manifest.webmanifest
├─ service-worker.js
├─ assets/
│  ├─ css/styles.css
│  ├─ js/app.js
│  ├─ js/data-service.js
│  └─ icons/
├─ data/
│  ├─ cities.json
│  ├─ journeys.json
│  ├─ events.json
│  ├─ people.json
│  ├─ countries.json
│  ├─ routes.geojson
│  ├─ images.json
│  └─ metadata.json
├─ docs/
│  ├─ data-methodology.md
│  └─ qa-report.md
├─ scripts/validate-data.mjs
└─ .github/workflows/pages.yml
```

## 데이터 추가 방법

새 여정을 추가할 때는 다음 순서를 권장합니다.

1. `cities.json`에 장소를 추가합니다. 고대 이름, 현대 비정, 좌표 정밀도, 장절, 관련 인물, 신뢰도와 출처를 기록합니다.
2. `people.json`, `countries.json`, `events.json`에 필요한 참조 데이터를 추가합니다.
3. `journeys.json`에 여정과 `stops`를 순서대로 작성합니다. 각 stop에는 `order`, `previousStopId`, `nextStopId`, `bibleReference`, `eventSummary`, `companions`, `confidence`가 필요합니다.
4. `routes.geojson`에 인접 stop 사이의 선분을 추가합니다. 실제 도로·항로를 입증할 수 없다면 직선 근사임을 유지하고 추론 구간을 구분합니다.
5. `npm test`를 실행해 참조 무결성과 경로 개수를 검증합니다.

상세 필드 원칙은 `docs/data-methodology.md`에 정리되어 있습니다.

## 정확성 원칙

- 여행 순서와 사건은 사도행전을 최우선 기준으로 합니다.
- 본문에 개별 도시가 없는 구간은 임의의 도시를 넣지 않고 지역 노드로 표시합니다.
- Acts 18:22의 예루살렘 방문처럼 일반적이지만 직접 명시되지 않은 해석은 `inferred`입니다.
- 더베, 뵈닉스, 삼관 등 위치 논의가 있는 장소는 좌표 정밀도와 `disputed` 상태를 표시합니다.
- 지도 선은 방문 순서를 전달하기 위한 시각적 근사이며 실제 고대 도로·항해 궤적이 아닙니다.
- 연대와 관련 서신은 본문 직접 기록과 역사적 재구성을 구분합니다.

## 지도와 운영 주의

기본 지도는 OpenStreetMap 표준 타일을 사용하고 화면에 저작자 표시를 유지합니다. 서비스 워커는 OSM 타일을 캐시하지 않습니다. 공개 서비스의 트래픽이 커질 경우 OpenStreetMap Foundation의 타일 사용 정책에 맞는 전용/상용 타일 제공자로 교체해야 합니다.

Leaflet은 공식 안정 버전 1.9.4 CDN을 사용합니다. 외부 CDN이 차단된 환경에서는 Leaflet 파일을 로컬에 포함하도록 변경할 수 있습니다.

## 주요 참고 범위

- 사도행전 13:1–14:28 — 1차 전도여행
- 사도행전 15:36–18:22 — 2차 전도여행
- 사도행전 18:23–21:17 — 3차 전도여행
- 사도행전 21–26장 — 체포·가이사랴 재판 배경
- 사도행전 27:1–28:31 — 로마 압송

웹사이트에는 성경 번역문의 긴 본문을 복제하지 않고 장절과 사건 요약만 제공합니다. 공개 배포 시 실제 성경 본문을 추가하려면 해당 번역본의 저작권과 API 이용 조건을 별도로 확인해야 합니다.
