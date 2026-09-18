/**
 * src/core/initialState.ts
 *
 * 새 런을 시작할 때 초기 RunState를 만드는 팩토리 함수.
 * 밸런스 수치와 콘텐츠(구역·조직원·경쟁 갱단)는 src/data/*.json에서 읽는다
 * (CLAUDE.md 아키텍처 규칙 — 하드코딩 금지). content/load.ts가 검증까지 마친
 * ContentBundle을 제공한다.
 *
 * 순수 TypeScript — Phaser / DOM / window / localStorage 참조 없음.
 *
 * T-10/T-12 산출물.
 */

import type { CrewDef } from './content/types';
import { content } from './content/load';
import type { CrewMember, District, LegacyBonusKind, RivalGang, RunState } from './types';

const SCHEMA_VERSION = 1;

function districtFromDef(def: (typeof content.districts)[number]): District {
  return {
    id: def.id,
    tier: def.tier,
    owner: def.initialOwner,
    defense: def.baseDefense,
    businessSlots: Array.from({ length: def.businessSlotCount }, () => null),
    scouted: def.initialOwner === 'player',
  };
}

function crewMemberFromDef(def: CrewDef, isBoss: boolean): CrewMember {
  return {
    id: def.id,
    isBoss,
    baseStats: def.baseStats,
    humanity: def.humanity,
    loyalty: def.loyalty,
    cyberwareIds: [],
    traitIds: def.traitIds,
    status: 'active',
    injuredNightsRemaining: 0,
    wagePerNight: def.wagePerNight,
    consecutiveRiskyNights: 0,
  };
}

function rivalFromDef(def: (typeof content.rivals)[number]): RivalGang {
  return {
    id: def.id,
    personality: def.personality,
    controlledDistricts: [def.startingDistrictId],
    defeated: false,
    credits: def.startingCredits,
  };
}

/**
 * 새 런의 초기 상태를 생성한다.
 * @param seed          재현용 시드 문자열 (FR-RUN-01)
 * @param legacyBonuses 이번 런에서 활성화된 유산 보너스 목록 (FR-LEG-02)
 */
export function createInitialRunState(
  seed: string,
  legacyBonuses: ReadonlyArray<LegacyBonusKind> = [],
): RunState {
  const { balance } = content;

  // ── 유산 보너스 적용 ──────────────────────────────────────────────────
  let startCredits = balance.startingCredits;
  let startHeat = balance.startingHeat;
  const hasExtraCrew = legacyBonuses.includes('start_extra_crew');

  if (legacyBonuses.includes('start_credits')) {
    startCredits += balance.legacyBonusEffects.start_credits.creditsDelta;
  }
  if (legacyBonuses.includes('start_less_heat')) {
    startHeat = Math.max(0, startHeat + balance.legacyBonusEffects.start_less_heat.heatDelta);
  }

  // ── 구역 초기 배치 (FR-MAP-01) ────────────────────────────────────────
  const districts: District[] = content.districts.map(districtFromDef);

  // ── 초기 조직원 (보스 1 + 조직원 2, FR-CREW-02) ──────────────────────
  const crew: CrewMember[] = [
    crewMemberFromDef(content.crew.startingBoss, true),
    ...content.crew.startingCrew.map((def) => crewMemberFromDef(def, false)),
  ];

  // 유산 보너스: 추가 조직원 (영입 풀 첫 번째 인물을 무료로 합류시킨다)
  if (hasExtraCrew) {
    const bonusCrewDef = content.crew.recruitPool[0];
    if (bonusCrewDef) {
      crew.push(crewMemberFromDef(bonusCrewDef, false));
    }
  }

  // ── 경쟁 갱 (FR-AI-01) ───────────────────────────────────────────────
  const rivals: RivalGang[] = content.rivals.map(rivalFromDef);

  return {
    seed,
    night: 1,
    phase: 'planning',

    credits: startCredits,
    heat: startHeat,
    reputation: balance.startingReputation,

    consecutiveDebtNights: 0,

    districts,
    businesses: [],

    crew,
    rivals,

    pendingEventIds: [],
    firedEventIdsThisNight: [],

    currentAssignments: [],
    lastNightReport: null,

    ended: false,
    endReason: null,

    activeLegacyBonuses: legacyBonuses,
    schemaVersion: SCHEMA_VERSION,
  };
}
