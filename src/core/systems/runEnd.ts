/**
 * src/core/systems/runEnd.ts
 *
 * 승패 판정과 런 종료 정산 (FR-RUN-03~05, FR-LEG-01).
 *
 * 순수 TypeScript — Phaser / DOM / window / localStorage 참조 없음.
 * T-19 산출물.
 */

import { content } from '../content/load';
import type { ContentBundle } from '../content/types';
import { districtId } from '../types';
import type { CrewId, LegacyState, RunEndReason, RunState } from '../types';

/** FR-MAP-01: 최종 목표 구역(상층, 최고 수익, "최종 목표") */
const CORPORATE_ZONE_ID = districtId('corporate_zone');

const VICTORY_REASONS: ReadonlySet<RunEndReason> = new Set(['victory_corporate', 'victory_rivals']);

/**
 * 승패 조건을 판정한다. 여러 조건이 동시에 맞아도 하나만 반환한다:
 * 보스 사망·급습·파산 같은 즉각적 패배가 먼저이고, 그다음 승리 조건, 마지막이
 * "30밤 종료 시 승리 미달성" 시간 초과다 (둘 다 동시에 참일 수 없는 조건도
 * 있지만 우선순위를 명확히 하기 위해 순서를 고정했다).
 */
export function checkRunEndCondition(state: RunState, bundle: ContentBundle = content): RunEndReason | null {
  const { balance } = bundle;

  const boss = state.crew.find((c) => c.isBoss);
  if (boss && boss.status === 'dead') return 'defeat_boss_dead';

  if (state.heat >= balance.heatThresholds.lockdownAt) return 'defeat_raid';

  if (state.consecutiveDebtNights >= balance.consecutiveDebtNightsLimit) return 'defeat_bankrupt';

  const corporateZone = state.districts.find((d) => d.id === CORPORATE_ZONE_ID);
  if (corporateZone?.owner === 'player') return 'victory_corporate';

  if (state.rivals.length > 0 && state.rivals.every((r) => r.defeated)) return 'victory_rivals';

  if (state.night >= balance.maxNights) return 'defeat_time_out';

  return null;
}

/** 아직 끝나지 않았다면 조건을 판정해 ended/endReason을 채운다. 이미 끝났으면 그대로 돌려준다. */
export function applyRunEnd(state: RunState, bundle: ContentBundle = content): RunState {
  if (state.ended) return state;
  const reason = checkRunEndCondition(state, bundle);
  if (!reason) return state;
  return { ...state, ended: true, endReason: reason };
}

/** 이 런에서 동시에 소유한 구역 수의 최댓값을 갱신한다 (FR-RUN-05). */
export function trackDistrictPeak(state: RunState): RunState {
  const owned = state.districts.filter((d) => d.owner === 'player').length;
  if (owned <= state.maxDistrictsOwned) return state;
  return { ...state, maxDistrictsOwned: owned };
}

/** 런 종료 화면에 표시할 요약 (FR-RUN-05). */
export interface RunEndSummary {
  readonly endReason: RunEndReason;
  readonly isVictory: boolean;
  readonly survivedNights: number;
  readonly maxDistrictsOwned: number;
  readonly lostCrewIds: ReadonlyArray<CrewId>;
  readonly legacyPointsAwarded: number;
}

/** 끝난 런(state.ended === true)의 요약과 유산 포인트를 계산한다 (FR-RUN-05, FR-LEG-01). */
export function buildRunEndSummary(state: RunState, bundle: ContentBundle = content): RunEndSummary {
  if (!state.ended || !state.endReason) {
    throw new Error('buildRunEndSummary: 아직 종료되지 않은 런이다');
  }

  const cfg = bundle.balance.legacySystem;
  const isVictory = VICTORY_REASONS.has(state.endReason);
  const lostCrewIds = state.crew.filter((c) => c.status === 'dead').map((c) => c.id);

  const legacyPointsAwarded = Math.round(
    state.night * cfg.pointsPerNightSurvived +
      state.maxDistrictsOwned * cfg.pointsPerDistrictOwnedPeak +
      (isVictory ? cfg.victoryBonus : 0),
  );

  return {
    endReason: state.endReason,
    isVictory,
    survivedNights: state.night,
    maxDistrictsOwned: state.maxDistrictsOwned,
    lostCrewIds,
    legacyPointsAwarded,
  };
}

/** 런 결과를 영구 유산 상태에 반영한다 (FR-LEG-01). 저장은 save 모듈(T-21)의 몫이다. */
export function applyRunResultToLegacy(legacy: LegacyState, summary: RunEndSummary): LegacyState {
  return {
    ...legacy,
    legacyPoints: legacy.legacyPoints + summary.legacyPointsAwarded,
    totalRuns: legacy.totalRuns + 1,
    totalWins: legacy.totalWins + (summary.isVictory ? 1 : 0),
  };
}
