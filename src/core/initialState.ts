/**
 * src/core/initialState.ts
 *
 * 새 런을 시작할 때 초기 RunState를 만드는 팩토리 함수.
 * 순수 TypeScript — Phaser / DOM / window / localStorage 참조 없음.
 *
 * T-10 산출물.
 */

import type {
  RunState,
  District,
  CrewMember,
  RivalGang,
  LegacyBonusKind,
  StatBlock,
} from './types';
import { districtId, crewId, gangId } from './types';

/** 밸런스 상수 — 실제 수치는 추후 src/data/balance.json으로 이동 (T-12) */
const STARTING_CREDITS    = 500;
const STARTING_HEAT       = 5;
const STARTING_REPUTATION = 20;
const SCHEMA_VERSION      = 1;

function makeStats(
  force: number,
  tech: number,
  negotiation: number,
  stealth: number,
): StatBlock {
  return { force, tech, negotiation, stealth };
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
  // ── 유산 보너스 적용 ──────────────────────────────────────────────────
  let startCredits = STARTING_CREDITS;
  let startHeat    = STARTING_HEAT;
  const hasExtraCrew = legacyBonuses.includes('start_extra_crew');

  if (legacyBonuses.includes('start_credits'))   startCredits += 300;
  if (legacyBonuses.includes('start_less_heat')) startHeat = Math.max(0, startHeat - 5);

  // ── 구역 초기 배치 (FR-MAP-01) ────────────────────────────────────────
  // 이름·인접 목록·정확한 슬롯 수는 T-12에서 data/districts.json으로 이동
  const districts: District[] = [
    // 하층
    {
      id:            districtId('slums'),
      tier:          'lower',
      owner:         'player',
      defense:       20,
      businessSlots: [null, null],
      scouted:       true,
    },
    {
      id:            districtId('harbor'),
      tier:          'lower',
      owner:         'neutral',
      defense:       30,
      businessSlots: [null, null],
      scouted:       false,
    },
    {
      id:            districtId('underground_market'),
      tier:          'lower',
      owner:         gangId('gang_a'),   // GangId는 DistrictOwner의 유효 값
      defense:       35,
      businessSlots: [null, null],
      scouted:       false,
    },
    // 중층
    {
      id:            districtId('nightclub_row'),
      tier:          'mid',
      owner:         gangId('gang_b'),
      defense:       40,
      businessSlots: [null, null, null],
      scouted:       false,
    },
    {
      id:            districtId('factory_district'),
      tier:          'mid',
      owner:         'neutral',
      defense:       60,
      businessSlots: [null, null],
      scouted:       false,
    },
    // 상층
    {
      id:            districtId('corporate_zone'),
      tier:          'upper',
      owner:         'neutral',
      defense:       80,
      businessSlots: [null, null, null],
      scouted:       false,
    },
  ];

  // ── 초기 조직원 (보스 1 + 조직원 2, FR-CREW-02) ──────────────────────
  const crew: CrewMember[] = [
    {
      id:                     crewId('boss'),
      isBoss:                 true,
      baseStats:              makeStats(6, 5, 5, 4),
      humanity:               80,
      loyalty:                100,
      cyberwareIds:           [],
      traitIds:               ['leader'],
      status:                 'active',
      injuredNightsRemaining: 0,
      wagePerNight:           0,
    },
    {
      id:                     crewId('crew_01'),
      isBoss:                 false,
      baseStats:              makeStats(7, 3, 4, 5),
      humanity:               75,
      loyalty:                65,
      cyberwareIds:           [],
      traitIds:               ['street_fighter'],
      status:                 'active',
      injuredNightsRemaining: 0,
      wagePerNight:           50,
    },
    {
      id:                     crewId('crew_02'),
      isBoss:                 false,
      baseStats:              makeStats(3, 8, 4, 6),
      humanity:               70,
      loyalty:                60,
      cyberwareIds:           [],
      traitIds:               ['hacker'],
      status:                 'active',
      injuredNightsRemaining: 0,
      wagePerNight:           60,
    },
  ];

  // 유산 보너스: 추가 조직원
  if (hasExtraCrew) {
    crew.push({
      id:                     crewId('crew_legacy'),
      isBoss:                 false,
      baseStats:              makeStats(5, 5, 5, 5),
      humanity:               80,
      loyalty:                70,
      cyberwareIds:           [],
      traitIds:               [],
      status:                 'active',
      injuredNightsRemaining: 0,
      wagePerNight:           55,
    });
  }

  // ── 경쟁 갱 (FR-AI-01) ───────────────────────────────────────────────
  const rivals: RivalGang[] = [
    {
      id:                  gangId('gang_a'),
      personality:         'expansionist',
      controlledDistricts: [districtId('underground_market')],
      defeated:            false,
      credits:             400,
    },
    {
      id:                  gangId('gang_b'),
      personality:         'aggressive',
      controlledDistricts: [districtId('nightclub_row')],
      defeated:            false,
      credits:             350,
    },
  ];

  return {
    seed,
    night: 1,
    phase: 'planning',

    credits:    startCredits,
    heat:       startHeat,
    reputation: STARTING_REPUTATION,

    consecutiveDebtNights: 0,

    districts,
    businesses: [],

    crew,
    rivals,

    pendingEventIds:        [],
    firedEventIdsThisNight: [],

    currentAssignments: [],
    lastNightReport:    null,

    ended:     false,
    endReason: null,

    activeLegacyBonuses: legacyBonuses,
    schemaVersion:       SCHEMA_VERSION,
  };
}
