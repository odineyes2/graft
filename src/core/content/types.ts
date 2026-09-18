/**
 * src/core/content/types.ts
 *
 * 콘텐츠 정의(데이터) 타입. src/data/*.json의 형태를 기술한다.
 * src/core/types.ts의 런타임 상태 타입과는 다른 개념이다:
 *   - types.ts   → 런 진행 중 바뀌는 값 (District.owner, CrewMember.humanity 등)
 *   - content/types.ts → 런과 무관하게 고정된 카탈로그 (구역 이름, 사업 배율, 이벤트 본문 등)
 *
 * 순수 TypeScript — Phaser / DOM / window / localStorage 참조 없음.
 * T-12 산출물.
 */

import type {
  BusinessKind,
  CityTier,
  CrewId,
  CrewStatus,
  CyberwareId,
  DistrictId,
  DistrictOwner,
  EventId,
  GangId,
  GangPersonality,
  LegacyBonusKind,
  StatBlock,
} from '../types';

// ─── 구역 정의 (FR-MAP-01, FR-MAP-02) ────────────────────────────────────────

export interface DistrictDef {
  readonly id: DistrictId;
  readonly nameKey: string;
  readonly tier: CityTier;
  /** 런 시작 시 소유자 */
  readonly initialOwner: DistrictOwner;
  readonly baseDefense: number;
  readonly businessSlotCount: number;
  readonly incomeMultiplier: number;
  readonly heatMultiplier: number;
  /** 인접 구역 목록. 반드시 대칭이어야 한다 (A가 B를 포함하면 B도 A를 포함) */
  readonly adjacentDistrictIds: ReadonlyArray<DistrictId>;
}

// ─── 사업 정의 (FR-BIZ-01~03) ─────────────────────────────────────────────────

export type BusinessSpecialEffect =
  | 'reputation_scaled_income' // 보호비 징수: 평판에 비례해 수입 증가
  | 'cyberware_discount' // 사이버웨어 시술소: 이식 비용 할인
  | 'reputation_gain' // 지하 격투장: 평판 상승
  | 'requires_hacker'; // 데이터 밀매: 해커 특성 배치 필수

export interface BusinessDef {
  readonly kind: BusinessKind;
  readonly nameKey: string;
  readonly descriptionKey: string;
  /** 수입에 반영되는 배치 조직원 능력치 */
  readonly requiredStat: keyof StatBlock;
  /** 레벨 1~3별 기본 수입 */
  readonly incomePerLevel: readonly [number, number, number];
  /** 레벨 1~3별 기본 열기 증가량 */
  readonly heatPerLevel: readonly [number, number, number];
  /** 레벨 1~3별 매 새벽 차감되는 유지비 (FR-RES-01) */
  readonly maintenanceCostPerLevel: readonly [number, number, number];
  readonly buildCost: number;
  /** [레벨1→2 비용, 레벨2→3 비용] */
  readonly upgradeCost: readonly [number, number];
  readonly specialEffect: BusinessSpecialEffect;
}

// ─── 조직원 정의 (FR-CREW-01, FR-CREW-02) ─────────────────────────────────────

export interface CrewDef {
  readonly id: CrewId;
  readonly nameKey: string;
  readonly portraitKey: string;
  readonly baseStats: StatBlock;
  readonly humanity: number;
  readonly loyalty: number;
  readonly traitIds: ReadonlyArray<string>;
  readonly wagePerNight: number;
  /** 영입 풀 소속일 때만 의미 있음 (시작 조직원은 무료) */
  readonly recruitCost?: number;
  /** 영입 풀 소속일 때만 의미 있음: 영입에 필요한 최소 평판 (FR-RES-03) */
  readonly minReputation?: number;
}

export interface CrewContentDef {
  readonly startingBoss: CrewDef;
  /** 길이 2 고정 */
  readonly startingCrew: ReadonlyArray<CrewDef>;
  /** 길이 12 이상 (REQUIREMENTS 6장) */
  readonly recruitPool: ReadonlyArray<CrewDef>;
}

// ─── 사이버웨어 정의 (FR-CREW-05) ─────────────────────────────────────────────

export interface CyberwareDef {
  readonly id: CyberwareId;
  readonly nameKey: string;
  readonly descriptionKey: string;
  readonly statBonus: Partial<StatBlock>;
  readonly humanityCost: number;
  readonly creditCost: number;
}

// ─── 경쟁 갱단 정의 (FR-AI-01) ─────────────────────────────────────────────────

export interface RivalDef {
  readonly id: GangId;
  readonly nameKey: string;
  readonly personality: GangPersonality;
  readonly startingDistrictId: DistrictId;
  readonly startingCredits: number;
}

// ─── 이벤트 정의 (FR-EVT-01~03) ────────────────────────────────────────────────

/** 이벤트 분류 (FR-EVT-03 예시 목록 기준) */
export type EventCategory =
  | 'crackdown' // 단속
  | 'raid' // 급습
  | 'cyberpsychosis' // 폭주
  | 'betrayal' // 배신
  | 'desertion' // 이탈
  | 'recruit_offer' // 영입 제안
  | 'deal_offer' // 거래 제안
  | 'bribe_demand'; // 뇌물 요구

export interface EventConditionDef {
  /** 필요 열기 구간 [min, max] */
  readonly heatRange?: readonly [number, number];
  /** 필요 소유 구역 수 (최소) */
  readonly minDistrictsOwned?: number;
  /** 특정 구역 소유 필요 */
  readonly requiresDistrict?: DistrictId;
}

/**
 * 이벤트 선택지 효과의 데이터 정의.
 * actingCrewEffect는 "이 이벤트를 유발/처리한 조직원"에게 적용되는 효과를 뜻한다.
 * 어떤 조직원인지(구체적 CrewId)는 데이터 시점에 알 수 없으므로, 밤 해결
 * 엔진(T-13/T-17)이 실행 시점에 대상 조직원을 정해 runtime EventChoiceEffect로
 * 변환한다. 결정 근거: docs/DECISIONS.md 2026-09-18 참고.
 */
export interface EventChoiceEffectDef {
  readonly creditDelta?: number;
  readonly heatDelta?: number;
  readonly reputationDelta?: number;
  readonly actingCrewEffect?: {
    readonly humanityDelta?: number;
    readonly loyaltyDelta?: number;
    readonly statusChange?: CrewStatus;
  };
  /** 체인 이벤트 ID (FR-EVT-04 이후 대비, MVP에서는 대부분 미사용) */
  readonly chainEventId?: EventId;
}

export interface EventChoiceDef {
  /** i18n 키 (선택지 버튼 텍스트) */
  readonly choiceKey: string;
  readonly effect: EventChoiceEffectDef;
}

export interface EventCardDef {
  readonly id: EventId;
  readonly category: EventCategory;
  readonly portraitKey: string;
  /** i18n 키 (이벤트 본문) */
  readonly textKey: string;
  readonly condition: EventConditionDef;
  readonly weight: number;
  /** 2~3개 (FR-EVT-01) */
  readonly choices: ReadonlyArray<EventChoiceDef>;
}

// ─── 유산 보너스 정의 (FR-LEG-02) ──────────────────────────────────────────────

export interface LegacyBonusDef {
  readonly kind: LegacyBonusKind;
  readonly nameKey: string;
  readonly descriptionKey: string;
  /** 해금에 필요한 유산 포인트 */
  readonly unlockCost: number;
}

// ─── 밸런스 상수 (전역) ────────────────────────────────────────────────────────

export interface HeatThresholds {
  /** 이 값 미만이면 조용한 밤에 열기가 자연 감소한다 (FR-HEAT-01 0~39 구간) */
  readonly quietDecayBelow: number;
  /** 이 값 이상이면 경찰 단속 이벤트 확률 발생 (40~69 구간) */
  readonly policeEventMin: number;
  /** 이 값 이상이면 기업 진압대 급습 확률 발생 (70~99 구간) */
  readonly raidEventMin: number;
  /** 이 값 도달 시 다음 밤 은신처 급습 확정 */
  readonly lockdownAt: number;
}

/** 인간성·충성도 위험 구간 판정 계수 (FR-CREW-05~06) */
export interface CrewRiskSystemConfig {
  /** 이 값 미만이면 매 밤 폭주 위험이 생긴다 */
  readonly humanityRiskThreshold: number;
  /** 인간성이 위험 구간일 때 밤마다 폭주 이벤트가 유발될 확률 */
  readonly humanityRiskChance: number;
  /** 이 값 미만이면 매 밤 이탈·배신 위험이 생긴다 */
  readonly loyaltyRiskThreshold: number;
  /** 충성도가 위험 구간일 때 밤마다 이탈·배신 이벤트가 유발될 확률 */
  readonly loyaltyRiskChance: number;
}

/** 충성도 증감 계수 (FR-CREW-06) */
export interface LoyaltySystemConfig {
  /** 급여를 지급할 크레딧이 부족했을 때(체불) 충성도 감소량 */
  readonly wageArrearsPenalty: number;
  /** 이 밤 수만큼 공격·방어·정찰에 연속 배치되면 그 다음부터 매 밤 감소 판정 */
  readonly riskyStreakThreshold: number;
  /** 연속 위험 임무 배치가 임계치 이상일 때 밤마다 충성도 감소량 */
  readonly riskyStreakPenalty: number;
  /** 동료가 사망했을 때 생존 조직원 전원의 충성도 감소량 */
  readonly crewDeathPenalty: number;
  /** 휴식 행동으로 얻는 충성도 회복량 */
  readonly restLoyaltyBonus: number;
}

/** 열기 자연 감소·구간별 이벤트 유발 확률 (FR-HEAT-01) */
export interface HeatSystemConfig {
  /** 조용한 밤(행동으로 인한 열기 증가가 0)일 때 낮 열기 구간에서 감소하는 양 */
  readonly naturalDecayAmount: number;
  /** 40~69 구간에서 밤마다 경찰 단속 이벤트가 유발될 확률 */
  readonly policeEventChance: number;
  /** 70~99 구간에서 밤마다 기업 진압대 급습 이벤트가 유발될 확률 */
  readonly raidEventChance: number;
}

/** 결과 등급별 배수 (수입·피해량 등에 곱한다) */
export interface GradeMultiplierConfig {
  readonly critical_success: number;
  readonly success: number;
  readonly failure: number;
  readonly critical_failure: number;
}

/**
 * 행동 해결 공식의 계수 (FR-ACT-01: "수치 공식은 데이터 파일의 계수로 조정 가능해야 한다").
 * successChance = clamp(baseChance + (effectiveStat - difficulty) * statCoefficient, minChance, maxChance)
 * roll < successChance → 성공권 (그중 criticalSuccessRatio 비율만큼 대성공)
 * roll >= successChance → 실패권 (그중 criticalFailureRatio 비율만큼 대실패)
 */
export interface ActionResolutionConfig {
  readonly baseChance: number;
  readonly statCoefficient: number;
  readonly minChance: number;
  readonly maxChance: number;
  readonly criticalSuccessRatio: number;
  readonly criticalFailureRatio: number;
  readonly gradeMultiplier: GradeMultiplierConfig;
  /** 실패해도 시도 자체로 발생하는 최소 열기 배수 (0이면 완전 실패 시 열기 0) */
  readonly minAttemptHeatMultiplier: number;
  readonly attackHeatBase: number;
  readonly defendHeatBase: number;
  readonly scoutHeatBase: number;
  readonly defendBaseDifficulty: number;
  readonly operateDifficultyBase: number;
  readonly operateDifficultyPerLevel: number;
  /** 구역 점령 시 방어력을 구역 기본 방어력의 이 비율로 재설정한다 */
  readonly capturedDistrictDefenseFraction: number;
  /** 방어 행동으로 올릴 수 있는 방어력 상한 (구역 기본 방어력의 배수) */
  readonly maxDistrictDefenseMultiplier: number;
  /** 부상 시 행동 불가 밤 수 (FR-CREW-04) */
  readonly injuryNights: number;
  /** 공격·방어 대실패 시 사망(부상 대신)으로 이어질 확률 */
  readonly deathChanceOnCriticalFailure: number;
  readonly restHumanityRecovery: number;
  readonly arenaReputationGain: number;
  readonly reputationIncomeScale: number;
}

export interface BalanceConfig {
  readonly startingCredits: number;
  readonly startingHeat: number;
  readonly startingReputation: number;
  /** 최대 진행 밤 수 (FR-RUN-02) */
  readonly maxNights: number;
  /** 이 밤 수만큼 연속 적자면 패배 (FR-RUN-04) */
  readonly consecutiveDebtNightsLimit: number;
  readonly heatThresholds: HeatThresholds;
  /** 유산 보너스별 수치 효과 (start_credits, start_less_heat) */
  readonly legacyBonusEffects: {
    readonly start_credits: { readonly creditsDelta: number };
    readonly start_less_heat: { readonly heatDelta: number };
  };
  readonly actionResolution: ActionResolutionConfig;
  readonly heatSystem: HeatSystemConfig;
  readonly crewRiskSystem: CrewRiskSystemConfig;
  readonly loyaltySystem: LoyaltySystemConfig;
}

// ─── 콘텐츠 번들 ────────────────────────────────────────────────────────────────

/** 검증까지 끝난 전체 콘텐츠. loadContent()가 반환한다. */
export interface ContentBundle {
  readonly districts: ReadonlyArray<DistrictDef>;
  readonly businesses: ReadonlyArray<BusinessDef>;
  readonly crew: CrewContentDef;
  readonly cyberware: ReadonlyArray<CyberwareDef>;
  readonly rivals: ReadonlyArray<RivalDef>;
  readonly events: ReadonlyArray<EventCardDef>;
  readonly legacyBonuses: ReadonlyArray<LegacyBonusDef>;
  readonly balance: BalanceConfig;
}
