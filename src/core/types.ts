/**
 * src/core/types.ts
 *
 * GRAFT 게임 상태 모델 전체. 이 파일은 순수 TypeScript다.
 * Phaser / DOM / window / localStorage 참조 금지.
 *
 * T-10 산출물.
 */

// ─── 공통 ID 타입 (실수 방지용 branded type) ─────────────────────────────────

export type DistrictId = string & { readonly _brand: 'DistrictId' };
export type BusinessId = string & { readonly _brand: 'BusinessId' };
export type CrewId     = string & { readonly _brand: 'CrewId' };
export type CyberwareId = string & { readonly _brand: 'CyberwareId' };
export type GangId     = string & { readonly _brand: 'GangId' };
export type EventId    = string & { readonly _brand: 'EventId' };

export function districtId(id: string): DistrictId { return id as DistrictId; }
export function businessId(id: string): BusinessId { return id as BusinessId; }
export function crewId(id: string): CrewId         { return id as CrewId; }
export function cyberwareId(id: string): CyberwareId { return id as CyberwareId; }
export function gangId(id: string): GangId         { return id as GangId; }
export function eventId(id: string): EventId       { return id as EventId; }

// ─── 구역 (District) ──────────────────────────────────────────────────────────

/** 도시 3개 층 */
export type CityTier = 'lower' | 'mid' | 'upper';

/** 구역 소유자 */
export type DistrictOwner = 'player' | GangId | 'neutral';

/**
 * District: 도시 지도의 점령 단위 (FR-MAP-01, FR-MAP-02)
 * 런 중에 바뀌는 동적 상태만 여기에 포함한다.
 * 고정 데이터(이름·초기 방어력·인접 목록 등)는 src/data/districts.json.
 */
export interface District {
  readonly id: DistrictId;
  tier: CityTier;
  owner: DistrictOwner;
  /** 현재 방어력 (0~100). 공격 받으면 감소 */
  defense: number;
  /** 각 슬롯에 건설된 사업 ID (null = 빈 슬롯). 슬롯 수는 data에서 결정 */
  businessSlots: ReadonlyArray<BusinessId | null>;
  /** 플레이어가 정찰 완료 여부 (FR-MAP-04 전장의 안개) */
  scouted: boolean;
}

// ─── 사업 (Business) ──────────────────────────────────────────────────────────

/** 사업 종류 (FR-BIZ-01) */
export type BusinessKind =
  | 'protection'    // 보호비 징수
  | 'clinic'        // 사이버웨어 시술소
  | 'arena'         // 지하 격투장
  | 'datatrafficking' // 데이터 밀매
  | 'bar';          // 위장용 바 (P1, FR-BIZ-04)

/**
 * Business: 구역 슬롯에 건설한 사업 인스턴스.
 * 고정 스탯(기본 수입·열기·요구 능력)은 src/data/businesses.json.
 */
export interface Business {
  readonly id: BusinessId;
  kind: BusinessKind;
  /** 사업이 위치한 구역 */
  districtId: DistrictId;
  /** 현재 레벨 1~3 (FR-BIZ-02) */
  level: 1 | 2 | 3;
}

// ─── 사이버웨어 (Cyberware) ───────────────────────────────────────────────────

/** 능력치 4종 (FR-CREW-01) */
export interface StatBlock {
  force:       number; // 무력 1~10
  tech:        number; // 기술 1~10
  negotiation: number; // 교섭 1~10
  stealth:     number; // 은신 1~10
}

/**
 * Cyberware: 이식 가능한 사이버웨어 정의.
 * 이것은 정의 타입(카탈로그)이다. 조직원의 장착 목록은 CrewMember.cyberwareIds.
 * 수치 효과는 src/data/cyberware.json에서 읽는다.
 */
export interface Cyberware {
  readonly id: CyberwareId;
  /** 부여하는 능력치 보너스 */
  statBonus: Partial<StatBlock>;
  /** 이식 시 인간성 감소량 (FR-CREW-05) */
  humanityCost: number;
  /** 구매 비용 (크레딧) */
  creditCost: number;
}

// ─── 조직원 (CrewMember) ──────────────────────────────────────────────────────

/** 조직원 상태 (FR-CREW-04) */
export type CrewStatus =
  | 'active'
  | 'injured'   // N밤 행동 불가
  | 'arrested'  // 구금 상태
  | 'dead';     // 영구 사망

/**
 * CrewMember: 런 중 조직원 한 명의 전체 상태 (FR-CREW-01).
 * 고정 정보(초상화 키, 기본 배경 이야기)는 data/crew.json.
 */
export interface CrewMember {
  readonly id: CrewId;
  /** 보스 여부 (보스 사망 시 즉시 패배, FR-RUN-04) */
  isBoss: boolean;
  /** 기본 능력치 (사이버웨어 보정 전) */
  baseStats: StatBlock;
  /** 인간성 0~100 (FR-CREW-05) */
  humanity: number;
  /** 충성도 0~100 (FR-CREW-06) */
  loyalty: number;
  /** 장착 중인 사이버웨어 ID 목록 */
  cyberwareIds: ReadonlyArray<CyberwareId>;
  /** 특성 ID 목록 (1~2개, data에서 효과 정의) */
  traitIds: ReadonlyArray<string>;
  status: CrewStatus;
  /** 부상 시 남은 행동 불가 밤 수 (status가 'injured'일 때만 의미 있음) */
  injuredNightsRemaining: number;
  /** 급여 (새벽마다 차감, FR-RES-01) */
  wagePerNight: number;
  /** 공격·방어·정찰에 연속으로 배치된 밤 수 (충성도 감소 판정용, FR-CREW-06) */
  consecutiveRiskyNights: number;
}

// ─── 경쟁 갱단 (RivalGang) ───────────────────────────────────────────────────

/** AI 성향 (FR-AI-01) */
export type GangPersonality = 'expansionist' | 'aggressive';

/**
 * RivalGang: 경쟁 갱단 현재 상태.
 * AI 행동 규칙은 src/core/ai/ 에서 구현.
 */
export interface RivalGang {
  readonly id: GangId;
  personality: GangPersonality;
  /** 소유 구역 목록 (비면 괴멸, FR-AI-03) */
  controlledDistricts: ReadonlyArray<DistrictId>;
  /** 괴멸 여부 */
  defeated: boolean;
  /** 보유 자금 (AI 행동 비용 계산용) */
  credits: number;
}

// ─── 이벤트 카드 (EventCard) ──────────────────────────────────────────────────

/** 이벤트 선택지 효과 (런타임 적용 함수가 아닌 순수 데이터) */
export interface EventChoiceEffect {
  /** 크레딧 변화 (양수=획득, 음수=지출) */
  creditDelta?: number;
  /** 열기 변화 */
  heatDelta?: number;
  /** 평판 변화 */
  reputationDelta?: number;
  /** 영향 받는 조직원 ID와 humanity/loyalty 변화 */
  crewEffects?: ReadonlyArray<{
    crewId: CrewId;
    humanityDelta?: number;
    loyaltyDelta?: number;
    statusChange?: CrewStatus;
  }>;
  /** 추가로 발생할 이벤트 ID (체인) */
  chainEventId?: EventId;
}

/** 이벤트 선택지 */
export interface EventChoice {
  readonly choiceKey: string; // i18n 키
  effect: EventChoiceEffect;
}

/** 이벤트 발생 조건 (FR-EVT-02) */
export interface EventCondition {
  /** 필요 열기 구간 [min, max] */
  heatRange?: [number, number];
  /** 필요 소유 구역 수 */
  minDistrictsOwned?: number;
  /** 특정 구역 소유 여부 */
  requiresDistrict?: DistrictId;
  /** 특정 조직원 상태 필요 */
  requiresCrewStatus?: { crewId: CrewId; status: CrewStatus };
}

/**
 * EventCard: 이벤트 카드 정의 (FR-EVT-01).
 * 이것은 데이터 정의 타입이다. src/data/events.json에 저장.
 * 런 실행 중 발생한 이벤트 인스턴스는 RunState.pendingEvents.
 */
export interface EventCard {
  readonly id: EventId;
  /** 초상화 에셋 키 */
  portraitKey: string;
  /** 이벤트 본문 i18n 키 */
  textKey: string;
  condition: EventCondition;
  /** 가중치 (조건 충족 시 뽑힐 확률 가중치) */
  weight: number;
  choices: ReadonlyArray<EventChoice>;
}

// ─── 배치 (Assignment) ────────────────────────────────────────────────────────

/** 조직원 행동 종류 (FR-CREW-03) */
export type ActionKind =
  | 'operate'   // 사업 운영
  | 'attack'    // 구역 공격
  | 'defend'    // 구역 방어
  | 'scout'     // 정찰
  | 'rest';     // 휴식 (부상 회복·인간성 소폭 회복)

/**
 * Assignment: 한 밤의 조직원 배치 결정.
 * 플레이어가 밤 시작 전에 확정하는 입력값.
 */
export interface Assignment {
  crewId: CrewId;
  action: ActionKind;
  /** 대상 구역 (operate·attack·defend·scout 시 필수) */
  targetDistrictId?: DistrictId;
  /** 운영 대상 사업 (operate 시 필수) */
  targetBusinessId?: BusinessId;
}

// ─── 밤 결산 리포트 (NightReport) ────────────────────────────────────────────

/** 결과 등급 (FR-ACT-02) */
export type OutcomeGrade = 'critical_success' | 'success' | 'failure' | 'critical_failure';

/** 행동 하나의 결과 */
export interface ActionOutcome {
  crewId: CrewId;
  action: ActionKind;
  targetDistrictId?: DistrictId;
  targetBusinessId?: BusinessId;
  /** 실행 전 계산된 성공 확률 0~1 (FR-ACT-03) */
  successChance: number;
  grade: OutcomeGrade;
  /** 크레딧 변화 */
  creditDelta: number;
  /** 열기 변화 */
  heatDelta: number;
  /** 조직원 상태 변화 (부상·체포) */
  crewStatusChange?: CrewStatus;
  /** 구역 소유권 변화 */
  districtOwnerChange?: { districtId: DistrictId; newOwner: DistrictOwner };
}

/** 경쟁 갱 AI 행동 요약 */
export interface RivalAction {
  gangId: GangId;
  action: ActionKind;
  targetDistrictId: DistrictId;
  succeeded: boolean;
}

/**
 * NightReport: 한 밤이 끝난 뒤 결산 화면에 표시할 전체 리포트 (FR-UI-04).
 */
export interface NightReport {
  night: number;
  /** 플레이어 행동별 결과 목록 */
  actionOutcomes: ReadonlyArray<ActionOutcome>;
  /** 경쟁 갱 행동 요약 */
  rivalActions: ReadonlyArray<RivalAction>;
  /** 새벽 수입 (사업 합산) */
  incomeTotal: number;
  /** 새벽 지출 (급여 + 유지비 합산) */
  expenseTotal: number;
  /** 이번 밤 발생한 이벤트 ID 목록 */
  triggeredEventIds: ReadonlyArray<EventId>;
  /** 열기 변화 (행동 합산, 자연 감소 포함) */
  heatDelta: number;
  /** 평판 변화 */
  reputationDelta: number;
}

// ─── 유산 (LegacyState) ──────────────────────────────────────────────────────

/** MVP 5종 유산 보너스 종류 (FR-LEG-02) */
export type LegacyBonusKind =
  | 'start_credits'     // 시작 크레딧 증가
  | 'start_extra_crew'  // 시작 조직원 추가
  | 'start_less_heat'   // 시작 열기 감소
  | 'start_prebuild'    // 사업 1종 선건설
  | 'start_special_crew'; // 영입 풀에 특수 조직원 추가

/** 해금된 유산 보너스 */
export interface LegacyBonus {
  kind: LegacyBonusKind;
  /** 해금 완료 여부 */
  unlocked: boolean;
}

/**
 * LegacyState: 런과 독립적으로 영구 보관되는 메타 진행 상태 (FR-LEG-03).
 * localStorage 저장은 src/save/에서 담당. 여기선 순수 데이터 형태만 정의.
 */
export interface LegacyState {
  /** 현재 보유 유산 포인트 */
  legacyPoints: number;
  /** 해금된 또는 해금 가능한 보너스 목록 */
  bonuses: ReadonlyArray<LegacyBonus>;
  /** 전체 런 횟수 */
  totalRuns: number;
  /** 전체 승리 횟수 */
  totalWins: number;
  /** 저장 스키마 버전 (마이그레이션용, NFR-05) */
  schemaVersion: number;
}

// ─── 승패 판정 ────────────────────────────────────────────────────────────────

/** 런 종료 원인 (FR-RUN-03, FR-RUN-04) */
export type RunEndReason =
  | 'victory_corporate'   // 기업 지구 장악으로 승리
  | 'victory_rivals'      // 경쟁 갱 모두 괴멸로 승리
  | 'defeat_boss_dead'    // 보스 사망
  | 'defeat_bankrupt'     // 3밤 연속 크레딧 음수
  | 'defeat_time_out'     // 30밤 종료 시 승리 조건 미달
  | 'defeat_raid';        // 은신처 급습으로 함락

// ─── 런 전체 상태 (RunState) ──────────────────────────────────────────────────

/**
 * RunState: 한 런(게임 판)의 모든 가변 상태.
 * 이 값을 직렬화해 localStorage에 저장하면 자동 저장이 된다.
 * 상태 변경은 반드시 (state, action, rng) => newState 형식의 함수로만 한다.
 */
export interface RunState {
  /** 재현용 시드 문자열 (FR-RUN-01) */
  readonly seed: string;
  /** 현재 밤 번호 1~30 (FR-RUN-02) */
  night: number;
  /** 현재 단계 */
  phase: 'planning' | 'night' | 'dawn' | 'day' | 'ended';

  // 자원 (FR-RES-01~03)
  credits: number;
  heat: number;           // 0~100
  reputation: number;     // 0~100

  /** 크레딧이 음수였던 연속 밤 수 (패배 조건 카운터, FR-RUN-04) */
  consecutiveDebtNights: number;

  // 맵
  districts: ReadonlyArray<District>;
  businesses: ReadonlyArray<Business>;

  // 조직원
  crew: ReadonlyArray<CrewMember>;

  // 경쟁 갱
  rivals: ReadonlyArray<RivalGang>;

  /** 현재 밤에 발생했지만 아직 플레이어 선택을 기다리는 이벤트 ID 큐 */
  pendingEventIds: ReadonlyArray<EventId>;
  /** 이번 런에서 이미 발생한 이벤트 ID (같은 밤 중복 방지, FR-EVT-03) */
  firedEventIdsThisNight: ReadonlyArray<EventId>;

  /** 이번 밤의 배치 (계획 단계에서 설정, 밤 해결 후 초기화) */
  currentAssignments: ReadonlyArray<Assignment>;

  /** 마지막으로 완료된 밤 결산 리포트 */
  lastNightReport: NightReport | null;

  /** 런 종료 여부와 이유 */
  ended: boolean;
  endReason: RunEndReason | null;

  /** 이 런에서 선택한 유산 보너스 목록 (시작 시 결정) */
  activeLegacyBonuses: ReadonlyArray<LegacyBonusKind>;

  /** 저장 스키마 버전 (마이그레이션용, NFR-05) */
  schemaVersion: number;
}
