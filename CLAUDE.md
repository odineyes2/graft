# GRAFT — Claude Code 작업 지침

사이버펑크 갱단 경영 시뮬레이션 **싱글 로그라이트** 웹게임. 픽셀 아트, 밤 단위 턴제.
기획 전체는 `docs/REQUIREMENTS.md`, 작업 순서와 완료 조건은 `docs/WORK_SPEC.md`를 기준으로 한다.

## 작업 방식

- 작업은 항상 `docs/WORK_SPEC.md`의 작업 ID(예: `T-13`) 단위로 진행한다. 시작 전에 해당 항목의 목표·산출물·완료 조건을 다시 읽는다.
- 한 번에 하나의 작업 ID만 진행한다. 완료 조건을 모두 만족하면 체크박스를 `[x]`로 바꾸고, `feat(T-13): 밤 해결 엔진` 형식으로 로컬 커밋한다.
- 명세가 모호하거나 요구사항끼리 충돌하면 추측으로 구현하지 말고 멈추고 질문한다. 결정된 사항은 `docs/DECISIONS.md`에 날짜와 함께 기록한다.
- `git push`, 원격 브랜치 생성, 의존성 메이저 버전 변경은 사용자가 요청할 때만 한다.
- 아트 에셋은 직접 그리지 않는다. 단색 도형·임시 스프라이트로 대체하고 `assets/ASSET_MANIFEST.md`에 필요한 에셋 목록(키, 크기, 용도)을 남긴다.

## 기술 스택 (T-00에서 최신 버전 확인 후 확정)

- TypeScript + Vite
- Phaser 4.x (2026년 4월 정식 출시된 메이저 버전). 온라인 예제 상당수가 Phaser 3 기준이므로, 특히 FX/Mask(Phaser 4에서 Filter 시스템으로 통합됨)와 렌더 파이프라인 관련 코드는 Phaser 4 공식 문서를 기준으로 작성한다.
- Vitest (코어 로직 테스트)
- ESLint + Prettier
- 저장: `localStorage` (스키마 버전 필드 필수)

## 아키텍처 규칙

- `src/core/`는 **순수 TypeScript**다. Phaser, DOM, `window`, `localStorage`를 import하거나 참조하지 않는다. 브라우저 없이 Node에서 테스트·시뮬레이션이 돌아가야 한다.
- 모든 무작위성은 `src/core/rng.ts`의 시드 기반 RNG를 통한다. `Math.random()` 사용 금지. 같은 시드 + 같은 입력 = 같은 결과.
- 게임 상태 변경은 `(state, action, rng) => newState` 형태의 함수로만 한다. 씬(Scene)은 상태를 읽고 액션을 보낼 뿐 직접 수정하지 않는다.
- 밸런스 수치(수입, 난이도, 열기 증가량 등)는 코드에 하드코딩하지 않고 `src/data/*.json`에 둔다.
- 화면에 표시되는 문자열은 `src/i18n/ko.ts`에 둔다. 1차 언어는 한국어.

## 폴더 구조

```
src/
  core/        순수 게임 로직 (state, rng, systems/, ai/)
  data/        밸런스·콘텐츠 JSON (districts, businesses, crew, events, legacy)
  scenes/      Phaser 씬
  ui/          재사용 UI 컴포넌트
  i18n/        문자열
  save/        저장/불러오기 (브라우저 의존 코드는 여기로 격리)
assets/        임시 에셋 + ASSET_MANIFEST.md
tools/         헤드리스 시뮬레이터 등 개발 도구
tests/
docs/          REQUIREMENTS.md, WORK_SPEC.md, DECISIONS.md
```

## 픽셀 아트 렌더링 규칙

- 내부 해상도 480×270(16:9), 정수 배율 확대. Phaser 설정에서 픽셀 아트 모드와 좌표 반올림을 켠다.
- 스프라이트·타일 기준 격자 16px. 초상화는 64×64.
- 색상은 `src/ui/palette.ts`에 정의한 팔레트 토큰만 사용한다.

## 명령어 (T-00 완료 후 실제 값으로 갱신)

```
npm run dev        개발 서버
npm run build      프로덕션 빌드
npm run test       Vitest
npm run lint       ESLint
npm run sim        헤드리스 밸런스 시뮬레이션 (T-18 이후)
```
