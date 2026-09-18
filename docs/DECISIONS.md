# GRAFT 결정 기록

날짜별로 확정된 사항을 기록한다. 명세가 모호하거나 요구사항 충돌이 있을 때는 여기 기록하고 진행한다.

---

## 2026-09-18 — T-17 이벤트 시스템 범위

### T-15·T-16의 "위험 판정"과 T-17의 "카드 선택"을 잇는 조립은 다음 작업으로 남긴다

T-15(`resolveHeat`)와 T-16(`assessCrewRisks`)은 이미 "이번 밤 이 카테고리의
이벤트를 띄워야 하는지"만 판정하도록 설계해 뒀다(각 작업의 DECISIONS.md
항목 참고). T-17은 그 신호를 받아 실제로 카드를 고르는
`filterEligibleEvents`/`pickWeightedEvent`/`triggerEvent`와, 플레이어가
고른 선택지를 적용하는 `applyEventChoice`를 만들었다. 하지만 "열기가
police 구간이라 eventTriggerDue가 true면 `triggerEvent(state, rng,
content, 'crackdown')`을 호출한다" 같은 실제 배선(한 밤 안에서 몇 개의
이벤트 기회를 만들지, 카테고리별 우선순위 등)은 만들지 않았다. WORK_SPEC이
T-17에 요구하는 완료 조건(조건 필터링 → 가중치 선택 → 효과 적용, 같은 밤
중복 방지)은 이 모듈 자체의 단위 동작이고, 여러 시스템을 하나의 밤
사이클로 묶는 일은 런 진행 흐름을 다루는 T-40(런 시작·종료 흐름)이나
별도 오케스트레이터에서 다룰 문제라고 판단했다.

### actingCrewEffect 적용 대상 조직원은 호출자가 명시한다

이벤트 데이터의 `actingCrewEffect`(T-12에서 결정)는 구체적인 조직원 ID를
담지 않으므로, `applyEventChoice()`는 `actingCrewId`를 옵션으로 받아 그
조직원에게만 효과를 적용한다. 효과는 있는데 ID가 없으면 에러를 던진다.
어떤 조직원을 "이 이벤트를 유발/처리한 사람"으로 지정할지(폭주라면 인간성이
낮은 그 조직원, 단속이라면 배치돼 있던 조직원 등)는 이 이벤트를 트리거한
호출자(T-33 이벤트 모달, T-20 시뮬레이터 봇)가 문맥으로 알고 있어야 한다.

### 이벤트 카테고리는 항상 명시적으로 넘긴다

`filterEligibleEvents`/`triggerEvent`는 category를 생략하면 전체
이벤트 풀에서 고른다. 열기 구간이나 조직원 위험과 무관하게 "이번 밤 아무
이벤트나 하나" 같은 범용 트리거가 필요할 수 있어 옵션으로 남겨뒀지만,
실제 사용처(T-40 등)는 대부분 특정 카테고리(`crackdown`, `raid`,
`['desertion','betrayal']` 등)를 지정해 호출할 것으로 예상한다.

---

## 2026-09-18 — T-16 조직원 상태 시스템 범위

### 사이버웨어 능력치 보너스는 baseStats를 건드리지 않는다

T-13에서 이미 `getEffectiveStats()`가 장착된 사이버웨어의 `statBonus`를
실행 시점에 합산하도록 만들어 뒀다. 그래서 `implantCyberware()`는
`cyberwareIds`에 추가하고 인간성만 깎을 뿐, `baseStats`는 그대로 둔다.
능력치 보너스를 baseStats에 직접 더하면 이중 계산(장착 목록 + baseStats)이
되거나, 나중에 사이버웨어를 제거하는 기능을 만들 때 원래 능력치를 복원할
방법이 없어진다.

### "위험 임무 연속 배치" 추적을 위해 CrewMember에 필드를 추가했다

FR-CREW-06의 "위험 임무 연속 배치" 감소 조건을 구현하려면 조직원별로 몇
밤 연속 공격·방어·정찰에 배치됐는지 기억해야 하는데, T-10에서 정의한
`CrewMember`에는 그런 필드가 없었다. `consecutiveRiskyNights: number`를
추가했다 (T-12가 `BusinessDef`에 `maintenanceCostPerLevel`을 추가했던
것과 같은 종류의 추가 확장). `resolveCrewLoyalty()`가 매 밤 갱신한다.

### 급여 체불·위험 임무·동료 사망으로 인한 충성도 변화는 새 모듈(loyalty.ts)로 분리했다

이 세 조건은 밤 해결(T-13)도 새벽 경제 결산(T-14)도 아닌 FR-CREW-06 고유의
규칙이라 `src/core/systems/loyalty.ts`에 `resolveCrewLoyalty()`로 모았다.
체불 여부는 **급여를 실제로 차감하기 전** 크레딧으로 판단해야 하므로, 이
함수는 `resolveNight()` 다음, `settleDawn()`보다 먼저 호출해야 한다.
휴식으로 인한 충성도 회복(FR-CREW-06 "휴식으로 증가")은 이미 T-13이 만든
`resolveRest()`(운영 중인 파일)에 이번 작업에서 추가했다 — 별도 모듈보다
행동 해결 시점에 바로 반영하는 게 자연스럽기 때문이다. 보상 이벤트로 인한
증가는 이벤트 시스템(T-17)의 몫으로 남겨둔다.

### 인간성·충성도 위험은 "이벤트를 띄울지"만 판정한다 (T-15와 같은 패턴)

FR-CREW-05(폭주)·FR-CREW-06(이탈·배신)의 "위험 이벤트 확률"을 T-15의
`resolveHeat()`가 세운 선례와 같은 방식으로 다뤘다: `assessCrewRisks()`는
인간성/충성도가 임계치 미만인 조직원에 대해 "이번 밤 그 위험이 발동하는지"
만 판정하고, 실제로 어떤 이벤트 카드(폭주/배신/이탈 각각 여러 종류 존재)가
뽑히는지는 조건 필터링·가중치 선택을 하는 이벤트 시스템(T-17)이 이어받는다.

---

## 2026-09-18 — T-15 열기 시스템 범위

### "구간별 이벤트 트리거 조건"은 트리거 여부 판정까지만, 카드 선택은 T-17 몫

FR-HEAT-01은 40~69 구간에서 "경찰 단속 이벤트 확률 발생", 70~99 구간에서
"기업 진압대 급습 확률 발생"이라고만 정의하고, 실제로 어떤 이벤트 카드가
뽑히는지(조건 필터링 → 가중치 선택)는 WORK_SPEC에서 T-17(이벤트 시스템)의
몫이다. 그래서 `resolveHeat()`는 구간 분류(`getHeatBand`)와 "이번 밤 열기
이벤트를 띄울지"를 `policeEventChance`/`raidEventChance` 확률로만 판정하고
(`HeatResolution.eventTriggerDue`), 실제 `EventCard`를 고르는 일은 하지
않는다. T-17이 `eventTriggerDue`가 true일 때 해당 구간에 맞는 이벤트
카테고리(`crackdown`/`raid`)에서 카드를 뽑도록 이어받을 것을 전제로 한다.

### "조용한 밤"은 이번 밤 행동으로 인한 열기 증가가 0인 밤으로 정의한다

FR-HEAT-01의 "조용한 밤이면 자연 감소"에서 "조용한 밤"이 정확히 무엇인지
명세에 없다. 배치된 행동들의 실제 열기 발생량(`NightReport.heatDelta`,
resolveNight가 채운 값)이 0인 밤으로 정의했다 — 즉 공격·정찰·운영처럼
열기를 발생시키는 행동을 전혀 하지 않은 밤(휴식·방어만 하거나 아무도
배치하지 않은 밤)에만 자연 감소가 적용된다.

### 100 도달 시 "다음 밤 급습 확정"은 이번 결산에서 즉시 확정으로 단순화했다

FR-HEAT-01 원문은 "다음 밤 은신처 급습 확정"이라 엄밀히는 급습이 발생하는
시점이 한 밤 뒤다. 하지만 RunState에 "다음 밤에 급습이 예약됨"을 저장할
필드가 없고, 그런 예약 상태를 언제 소비해 실제 급습 이벤트로 바꿀지는 런
진행 흐름(T-40)과 이벤트 시스템(T-17)이 같이 설계해야 하는 문제다. 지금은
열기가 100에 도달한 바로 그 새벽에 `heatResolution.lockdown = true`와
`eventTriggerDue = true`를 확정으로 반환해, T-17이 그 밤(또는 다음 밤)에
급습 이벤트를 강제로 띄우게 한다. "다음 밤"이라는 지연을 정확히 어디서
소비할지는 T-17/T-40에서 재검토한다.

---

## 2026-09-18 — T-12 콘텐츠 데이터 구조 결정

### 콘텐츠 정의 타입은 런타임 상태 타입과 분리한다

`src/core/types.ts`는 런 진행 중 바뀌는 상태(District.owner, CrewMember.humanity 등)를
표현한다. 반면 `src/data/*.json`은 런과 무관하게 고정된 카탈로그(구역 이름, 사업
배율, 이벤트 본문 등)다. 이 둘을 같은 인터페이스로 억지로 합치면 안 맞는 지점이
생긴다: 예를 들어 `EventChoiceEffect.crewEffects`는 구체적인 `CrewId`를 요구하는데,
이벤트 데이터는 그 이벤트가 어떤 조직원에게 적용될지 데이터 시점에 알 수 없다
(런타임에 배치된 조직원 중 하나가 정해진다).

그래서 `src/core/content/types.ts`에 데이터 전용 타입(`DistrictDef`, `BusinessDef`,
`CrewDef`, `CyberwareDef`, `RivalDef`, `EventCardDef`, `LegacyBonusDef`,
`BalanceConfig`)을 별도로 정의했다. `EventCardDef`의 선택지 효과는 `crewEffects`
대신 `actingCrewEffect`(이 이벤트를 유발/처리한 조직원에게 적용될 효과, 구체적
ID 없이)를 쓴다. 밤 해결 엔진(T-13)과 이벤트 시스템(T-17)이 실행 시점에 대상
조직원을 정해 `actingCrewEffect`를 런타임 `EventChoiceEffect.crewEffects`로
변환하는 책임을 진다.

### 영입 풀과 시작 조직원은 분리된 구조로 저장한다

REQUIREMENTS 6장은 "영입 가능 조직원 12 이상"을 요구하고, FR-CREW-02는 "런 시작 시
보스 1명 + 조직원 2명"을 요구한다. 시작 조직원이 영입 풀에 포함되는지 명세가
명시하지 않아서, `crew.json`을 `{ startingBoss, startingCrew: [2명], recruitPool:
[12명 이상] }` 구조로 분리해 두 수량 요구사항이 서로 겹치지 않고 각각 명확히
검증되게 했다.

### 유산 보너스 "시작 조직원 추가"는 영입 풀 1번 인물을 무료로 합류시킨다

FR-LEG-02의 "시작 조직원 추가" 보너스가 구체적으로 누구를 추가하는지 명세에
없어서, `recruitPool[0]`을 영입 비용 없이 합류시키는 것으로 잠정 구현했다.
추후 유산 화면(T-41)에서 플레이어가 직접 고르게 할 수도 있어 재검토 대상이다.

---

## 2026-09-18 — T-13 밤 해결 엔진 범위

### resolveNight()가 다루는 것과 다루지 않는 것

WORK_SPEC은 T-13의 완료 조건을 FR-ACT-01~03·FR-CREW-03~04·FR-BIZ-03으로
한정한다. `NightReport` 타입(T-10)에는 `incomeTotal`·`expenseTotal`·
`rivalActions`·`triggeredEventIds` 같은 이후 작업(T-14 경제, T-17 이벤트,
T-18 AI) 몫의 필드도 이미 있어서, T-13에서는 다음과 같이 범위를 정했다.

- `incomeTotal`은 이번 밤 행동에서 발생한 양수 크레딧 변화의 합으로 채운다
  (사업 운영 수입). `expenseTotal`(급여·유지비)은 0으로 두고 T-14가 채운다.
- `rivalActions`·`triggeredEventIds`는 빈 배열로 둔다 (T-18, T-17 몫).
- `heat`의 자연 감소(FR-HEAT-01 조용한 밤 감소)는 다루지 않는다 (T-15 몫).
  `report.heatDelta`는 이번 밤 행동으로 인한 변화만 합산한 값이다.
- 승패 판정(보스 사망 등, FR-RUN-04)은 상태에 반영만 하고 `RunState.ended`는
  건드리지 않는다 (T-19 몫).
- `resolveNight`는 해결이 끝나면 `phase`를 `'dawn'`으로 바꾼다. `night` 번호
  증가는 다음 계획 단계로 넘어갈 때의 몫으로 보고 여기서는 올리지 않는다.

### 행동별 성공 확률·결과 등급 공식 (FR-ACT-01)

`successChance = clamp(baseChance + (effectiveStat - difficulty) * statCoefficient, min, max)`
로 정하고, 굴린 값(roll)을 성공/실패권으로 나눈 뒤 각 권 안에서
`criticalSuccessRatio`/`criticalFailureRatio` 비율만큼을 대성공/대실패로
잘라낸다. 계수는 전부 `src/data/balance.json`의 `actionResolution`에 있다.
행동별 난이도(difficulty)는: 공격·정찰 = 대상 구역의 현재 방어력,
방어 = 고정값(`defendBaseDifficulty`), 운영 = 사업 레벨에 비례한 값
(`operateDifficultyBase + (level-1) * operateDifficultyPerLevel`).

### 부상 조직원은 배치 자체가 불가능하고, 회복은 배치와 무관하게 자동 처리한다

FR-CREW-04 "부상은 N밤 동안 행동 불가"를 "부상 중에는 어떤 행동도 배치할 수
없고, `injuredNightsRemaining`은 배치 여부와 상관없이 매 밤 자동으로
줄어든다"로 해석했다. 그 결과 '휴식' 행동은 이미 `active`인 조직원이
선택적으로 쉬면서 인간성을 회복하는 용도로만 쓰이고, 부상 회복 자체와는
분리된다.

### 사업 특수 효과 중 일부만 T-13에서 구현한다

`businesses.json`의 `specialEffect` 중 운영 해결과 직접 관련된
`reputation_scaled_income`(보호비 징수)·`reputation_gain`(격투장)·
`requires_hacker`(데이터 밀매)는 T-13에서 구현했다. `cyberware_discount`
(시술소)는 사이버웨어 구매 시점(T-36, 낮 성장 메뉴)에 적용되는 효과라
T-13 범위 밖으로 남겨둔다.

---

## 2026-09-16 — T-02 폰트·정적 에셋 서빙 경로

### 한글 픽셀 폰트: Galmuri

- 후보로 Galmuri(갈무리)·DungGeunMo·네오둥근을 검토했고, 사용자 확인 후 **Galmuri**로 확정했다.
- 처음엔 `Galmuri9Bitmap-Regular-2.40.4.ttf`(OS 설치용 임베디드 비트맵 전용 변형)를 받았으나, 브라우저의
  OTS(OpenType Sanitizer)가 `OTS parsing error: glyf: zero-length table`로 거부해 폰트가 로드되지 않고
  폴백 폰트로만 그려지는 문제를 발견했다(dev 서버 콘솔 경고로 확인). Bitmap 변형은 웹용이 아니라 OS/에디터에
  폰트로 설치해 쓰는 용도임을 뒤늦게 확인했다.
- `github.com/quiple/galmuri`가 배포하는 공식 `dist/galmuri.css`가 실제로 가리키는 `Galmuri9.woff2`
  (스케일러블 외곽선, 10px 디자인 크기, 420KB)로 교체해 `assets/fonts/Galmuri9.woff2`에 저장했다.
  10px 디자인 크기에 맞춰 정확히 `fontSize: '10px'`로만 렌더링하면 힌팅이 픽셀 격자에 맞아떨어져
  흐려지지 않는다(NFR-09, T-02 완료 조건의 "블러 없이"). 실제로 브라우저에서 확인했다.
- 라이선스는 OFL-1.1이며 `assets/fonts/LICENSE-galmuri.txt`로 함께 커밋했다(NFR-09).
- Canvas 텍스트는 `font-display`의 영향을 받지 않고(폴백 폰트로 그려지면 이후 재시도가 없다), 폰트가
  로드되기 전에 첫 프레임이 그려지면 영구히 흐린 폴백 폰트로 남는다. 이를 막기 위해 `src/main.ts`에서
  `Phaser.Game` 생성 전에 `document.fonts.load('10px Galmuri9')`를 `await`한다.

### 정적 에셋 서빙: `assets/`를 Vite `publicDir`로 지정

- `CLAUDE.md`의 폴더 구조는 임시 에셋 위치를 최상위 `assets/`로 고정하지만, Vite 기본 `publicDir`는
  `public/`이라 `assets/`의 파일은 그대로는 서빙되지 않는다.
- `vite.config.ts`에 `publicDir: 'assets'`를 추가해 `assets/` 내용을 빌드 결과물 루트에 그대로 복사하고
  개발 서버에서도 루트 경로로 서빙되게 했다(예: `assets/fonts/Galmuri9Bitmap-Regular.ttf` →
  `/fonts/Galmuri9Bitmap-Regular.ttf`). `ASSET_MANIFEST.md`도 함께 퍼블릭 경로로 노출되지만, 클라이언트
  전용 정적 배포(NFR-08) 게임이라 문제되지 않는다.

---

## 2026-09-16 — T-00/T-01 기술 스택 확정

### 설치 버전

npm 레지스트리에서 확인한 시점(2026-09-16) 기준 최신 안정 버전을 그대로 사용했다.

| 패키지 | 버전 | 비고 |
|---|---|---|
| phaser | 4.2.1 | 2026-04 정식 출시된 Phaser 4 라인의 최신 안정판 |
| vite | 8.3.0 | |
| vitest | 5.0.1 | vite ^6.4 \|\| ^7 \|\| ^8 요구 — 8.3.0과 호환 |
| typescript | 6.0.3 | 아래 "TypeScript 버전 예외" 참고 |
| typescript-eslint | 8.70.0 | |
| eslint | 10.10.0 | flat config(`eslint.config.js`) 사용 |
| @eslint/js | 10.0.1 | |
| eslint-config-prettier | 10.1.8 | |
| prettier | 3.9.6 | |
| @types/node | 22.20.3 | |

### TypeScript 버전 예외: 7.0.2 대신 6.0.3 사용

`CLAUDE.md`는 "T-00에서 최신 버전 확인 후 확정"이라고만 명시했다. npm 레지스트리 최신은
`typescript@7.0.2`(네이티브 Go 포트, tsgo)이지만, 현재 `typescript-eslint@8.70.0`의
peerDependency가 `typescript: '>=4.8.4 <6.1.0'`로 7.x를 지원하지 않는다. ESLint를 통한
정적 검사(NFR 없음이지만 팀 관례상 필수)를 포기할 수 없으므로, typescript-eslint가 지원하는
범위 내 최신인 `6.0.3`을 사용한다. typescript-eslint가 7.x를 지원하는 버전을 릴리스하면
갱신을 검토한다.

### Phaser 3 → 4 API 차이 (이 프로젝트에 영향 있는 것)

`node_modules/phaser/changelog/v4/4.0/MIGRATION-GUIDE.md`(Phaser 공식 배포 문서) 기준.

- **렌더러:** v3의 Pipeline 시스템이 전면 제거되고 `RenderNode` 아키텍처로 교체됐다.
  Canvas 렌더러는 아직 존재하지만 공식적으로 deprecated이며 v4의 신규 렌더링 기능(Filter 등)을
  지원하지 않는다. 이 프로젝트는 `Phaser.AUTO`를 쓰되 사실상 WebGL로 구동됨을 전제로 코드를 짠다.
- **FX/Mask → Filter 시스템 통합:** v3의 `preFX`/`postFX`, `BitmapMask`가 모두 `Filter`
  시스템(`internal`/`external` 필터 목록)으로 통합됐다. `Bloom`/`Shine`/`Circle`/`Gradient`
  FX는 각각 `Phaser.Actions.AddEffectBloom()`, `AddEffectShine()`, `AddMaskShape()`,
  `Gradient` 게임 오브젝트로 대체됐다. T-52(네온 깜빡임·비·조명 연출)에서 이 API를 기준으로 작성한다.
- **`roundPixels` 기본값 변경:** v3는 기본 `true`였지만 v4는 기본 `false`로 바뀌었다. 이
  프로젝트는 픽셀 아트 정수 배율 규칙(`CLAUDE.md`)을 지키기 위해 게임 설정에서
  `roundPixels: true`를 명시적으로 켰다(`src/main.ts`). 오브젝트 단위로는 `vertexRoundMode`로
  세밀 조정 가능.
- **정수 배율 확대:** `scale.zoom`에 `Phaser.Scale.MAX_ZOOM`을 지정하면 부모 요소(창 크기)에
  맞는 최대 정수 배율을 자동 계산한다. `scale.mode: FIT` + `autoCenter: CENTER_BOTH`와 함께
  사용해 480×270 캔버스를 정수 배율로 중앙 정렬한다.
- **텍스트 렌더링:** `Text` 게임 오브젝트 자체의 API(캔버스에 그려 텍스처로 만드는 방식,
  `resolution` 속성)는 v3와 크게 다르지 않다. 다만 v4의 신규 렌더러·좌표계·`roundPixels` 기본값
  변경이 간접적으로 영향을 준다. 이 프로젝트는 `pixelArt: true`(NEAREST 텍스처 필터링) +
  `roundPixels: true` + 정수 `MAX_ZOOM` 조합을 쓰므로, `Text.resolution` 기본값 1이어도
  확대 시 부드럽게 블러 처리되지 않고 또렷한 픽셀 단위로 확대된다(스크린샷으로 확인). 텍스트를
  더 매끈하게 하고 싶을 때만 `resolution`을 올린다(메모리 비용 있음).

### Phaser 3 예제를 참고할 때 주의할 점

1. **FX/Mask 예제 코드는 그대로 못 쓴다.** `sprite.preFX.addGlow()`, `setMask(new
   Phaser.Display.Masks.BitmapMask(...))` 같은 v3 예제는 v4에 없다. Filter API
   (`sprite.filters.internal/external`)로 옮겨 써야 한다.
2. **커스텀 WebGL 파이프라인 예제는 동작하지 않는다.** `this.renderer.pipelines.add(...)`,
   `setPipeline('CustomPipeline')` 같은 코드는 RenderNode로 재작성해야 한다. 이 프로젝트는
   커스텀 파이프라인을 쓸 계획이 없어 우선순위는 낮지만, 조명/필터 관련 예제를 볼 때 구분해야 한다.
3. **`roundPixels` 기본값 차이를 감안해야 한다.** v3 예제가 별다른 설정 없이 픽셀이 또렷하다고
   설명해도, v4에서 그대로 복사하면 기본값이 꺼져 있어 흐려 보일 수 있다. 게임 설정에
   `roundPixels: true`를 넣었는지 항상 확인한다.
4. **`Geom.Point`를 쓰는 예제는 `Vector2`로 바꿔야 한다.** v4에서 `Point` 클래스와 관련
   정적 함수가 전부 제거됐다(`Geom.Circle.getPoint()` 등은 이제 `Vector2`를 반환).
5. **`Math.TAU` 의미가 바뀌었다.** v3에서는 `TAU`가 실수로 `PI/2` 값을 가졌지만, v4는
   올바른 수학적 정의인 `PI*2`로 고쳐졌다. v3 예제의 `Math.TAU`를 그대로 옮기면 회전량이
   4배 달라진다(v3 기준 `PI/2` 의도였다면 v4의 `Math.PI_OVER_2`를 써야 한다).

### T-00 완료 확인

- `npm run build`, `npm run test`, `npm run lint` 모두 에러 없이 종료됨을 확인했다.
- `npm run dev`로 기동한 페이지를 헤드리스 브라우저(Playwright)로 열어 480×270 부트 씬이
  정수 배율로 중앙에 렌더링되고 "GRAFT" 텍스트가 블러 없이 표시되는 것을 스크린샷으로 확인했다.
