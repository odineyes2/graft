# GRAFT 결정 기록

날짜별로 확정된 사항을 기록한다. 명세가 모호하거나 요구사항 충돌이 있을 때는 여기 기록하고 진행한다.

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
