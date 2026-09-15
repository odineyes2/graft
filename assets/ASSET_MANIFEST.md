# 에셋 매니페스트

아트 에셋은 직접 그리지 않는다(`CLAUDE.md` 참고). 실제 제작이 필요한 항목을 여기에 키·크기·용도로 기록하고,
그 전까지는 단색 도형·실루엣 등 임시 에셋(`src/ui/placeholder.ts`)으로 대체한다.

## 폰트

라이선스가 있는 실제 배포 에셋이므로 임시 에셋이 아니다. `assets/fonts/`에 보관하고 Vite `publicDir`(`assets/`)를
통해 `/fonts/...` 경로로 서빙한다.

| 파일 | 크기 | 용도 | 라이선스 |
|---|---|---|---|
| `fonts/Galmuri9.woff2` | 420KB | 본문용 한글 픽셀 폰트(10px 디자인 크기 웹폰트) | OFL-1.1 (`fonts/LICENSE-galmuri.txt`) |

- 출처: https://github.com/quiple/galmuri (dist 폴더, 공식 `galmuri.css`가 가리키는 웹폰트)
- `Galmuri9Bitmap-*.ttf`(OS 설치용 임베디드 비트맵 전용 변형)는 브라우저 OTS 검증에서
  `zero-length glyf table` 오류로 거부되어 쓸 수 없다. 반드시 `.woff2`/`.ttf`(스케일러블 외곽선) 변형을
  쓴다(`docs/DECISIONS.md` 참고).
- 필요 시 제목·강조용으로 `Galmuri11`(12px) 등 추가 웨이트를 같은 방식으로 받는다.

## 임시 에셋 (플레이스홀더)

`src/ui/placeholder.ts`의 `createSolidRectTexture` / `createSilhouetteTexture`로 런타임에 생성한다.
실제 아트로 교체 전까지 아래 규칙을 따른다: 타일류는 16px 격자, 초상화는 64×64.

| 키 | 크기 | 용도 | 상태 |
|---|---|---|---|
| `placeholder-tile` | 16×16 | 사업·구역 슬롯 등 타일 자리표시자 | 임시 (단색 사각형) |
| `placeholder-portrait` | 32×32 (실제 규칙은 64×64) | 조직원/보스 초상화 자리표시자 | 임시 (실루엣) — BootScene 데모는 화면 공간상 32px로 축소 표시, 실제 조직원 화면(T-36)에서는 64×64로 생성 |

## 향후 필요한 실제 아트 (제작 필요, 미착수)

M2 화면 작업(T-30~T-36)이 진행되며 구체화되는 대로 아래에 키·크기·용도를 추가한다.

| 키 | 크기 | 용도 | 상태 | 비고 |
|---|---|---|---|---|
| (아직 없음) | | | | M2 진행 시 채운다 |
