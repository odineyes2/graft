/**
 * tests/runEnd.test.ts
 *
 * T-19 완료 조건: FR-RUN-03~05, FR-LEG-01의 조건별 테스트가 모두 통과한다.
 */

import { describe, expect, it } from 'vitest';
import { content } from '../src/core/content/load';
import { createInitialRunState } from '../src/core/initialState';
import {
  applyRunEnd,
  applyRunResultToLegacy,
  buildRunEndSummary,
  checkRunEndCondition,
  trackDistrictPeak,
} from '../src/core/systems/runEnd';
import { crewId, districtId, gangId } from '../src/core/types';
import type { LegacyState, RunState } from '../src/core/types';

function withDistrictOwner(state: RunState, id: string, owner: RunState['districts'][number]['owner']): RunState {
  return { ...state, districts: state.districts.map((d) => (d.id === districtId(id) ? { ...d, owner } : d)) };
}

function withBossDead(state: RunState): RunState {
  return { ...state, crew: state.crew.map((c) => (c.isBoss ? { ...c, status: 'dead' as const } : c)) };
}

function withAllRivalsDefeated(state: RunState): RunState {
  return { ...state, rivals: state.rivals.map((r) => ({ ...r, controlledDistricts: [], defeated: true })) };
}

describe('T-19 승패 판정 (FR-RUN-03~04)', () => {
  it('아무 조건도 만족하지 않으면 null이다', () => {
    const state = createInitialRunState('t19-none');
    expect(checkRunEndCondition(state)).toBeNull();
  });

  it('보스가 사망하면 defeat_boss_dead다', () => {
    const state = withBossDead(createInitialRunState('t19-boss-dead'));
    expect(checkRunEndCondition(state)).toBe('defeat_boss_dead');
  });

  it('열기가 100에 도달하면 defeat_raid다', () => {
    const base = createInitialRunState('t19-raid');
    const state: RunState = { ...base, heat: 100 };
    expect(checkRunEndCondition(state)).toBe('defeat_raid');
  });

  it('연속 적자 밤 수가 한도에 도달하면 defeat_bankrupt다', () => {
    const base = createInitialRunState('t19-bankrupt');
    const state: RunState = { ...base, consecutiveDebtNights: content.balance.consecutiveDebtNightsLimit };
    expect(checkRunEndCondition(state)).toBe('defeat_bankrupt');
  });

  it('기업 지구를 장악하면 victory_corporate다', () => {
    const state = withDistrictOwner(createInitialRunState('t19-victory-corp'), 'corporate_zone', 'player');
    expect(checkRunEndCondition(state)).toBe('victory_corporate');
  });

  it('경쟁 갱단이 모두 괴멸되면 victory_rivals다', () => {
    const state = withAllRivalsDefeated(createInitialRunState('t19-victory-rivals'));
    expect(checkRunEndCondition(state)).toBe('victory_rivals');
  });

  it('30밤이 지났고 승리 조건도 없으면 defeat_time_out이다', () => {
    const base = createInitialRunState('t19-timeout');
    const state: RunState = { ...base, night: content.balance.maxNights };
    expect(checkRunEndCondition(state)).toBe('defeat_time_out');
  });

  it('보스 사망과 승리 조건이 동시에 맞으면 패배가 우선한다', () => {
    let state = createInitialRunState('t19-priority-defeat');
    state = withDistrictOwner(state, 'corporate_zone', 'player');
    state = withBossDead(state);
    expect(checkRunEndCondition(state)).toBe('defeat_boss_dead');
  });

  it('급습 조건과 갱단 전멸이 동시에 맞으면 급습(패배)이 우선한다', () => {
    let state = createInitialRunState('t19-priority-raid');
    state = withAllRivalsDefeated(state);
    state = { ...state, heat: 100 };
    expect(checkRunEndCondition(state)).toBe('defeat_raid');
  });

  it('시간 초과 조건과 승리 조건이 동시에 맞으면 승리가 우선한다', () => {
    let state = createInitialRunState('t19-priority-victory');
    state = withDistrictOwner(state, 'corporate_zone', 'player');
    state = { ...state, night: content.balance.maxNights };
    expect(checkRunEndCondition(state)).toBe('victory_corporate');
  });
});

describe('T-19 applyRunEnd', () => {
  it('조건을 만족하면 ended와 endReason을 채운다', () => {
    const state = withBossDead(createInitialRunState('t19-apply'));
    const after = applyRunEnd(state);
    expect(after.ended).toBe(true);
    expect(after.endReason).toBe('defeat_boss_dead');
  });

  it('조건을 만족하지 않으면 그대로다', () => {
    const state = createInitialRunState('t19-apply-none');
    const after = applyRunEnd(state);
    expect(after.ended).toBe(false);
    expect(after.endReason).toBeNull();
  });

  it('이미 끝난 런은 다시 판정하지 않는다', () => {
    const already: RunState = {
      ...createInitialRunState('t19-apply-idempotent'),
      ended: true,
      endReason: 'victory_corporate',
    };
    const after = applyRunEnd(already);
    expect(after.endReason).toBe('victory_corporate');
  });
});

describe('T-19 최대 장악 구역 수 추적 (FR-RUN-05)', () => {
  it('시작 시점에는 소유 구역 수(1)로 초기화된다', () => {
    const state = createInitialRunState('t19-peak-start');
    expect(state.maxDistrictsOwned).toBe(1);
  });

  it('구역을 더 소유하면 최댓값이 올라간다', () => {
    const state = withDistrictOwner(createInitialRunState('t19-peak-up'), 'harbor', 'player');
    const after = trackDistrictPeak(state);
    expect(after.maxDistrictsOwned).toBe(2);
  });

  it('구역을 다시 잃어도 최댓값은 내려가지 않는다', () => {
    let state = withDistrictOwner(createInitialRunState('t19-peak-keep'), 'harbor', 'player');
    state = trackDistrictPeak(state); // 2로 갱신
    state = withDistrictOwner(state, 'harbor', gangId('gang_a')); // 다시 잃음
    state = trackDistrictPeak(state);
    expect(state.maxDistrictsOwned).toBe(2);
  });
});

describe('T-19 런 종료 요약과 유산 (FR-RUN-05, FR-LEG-01)', () => {
  it('종료되지 않은 런은 요약을 만들 수 없다', () => {
    const state = createInitialRunState('t19-summary-not-ended');
    expect(() => buildRunEndSummary(state)).toThrow();
  });

  it('생존 밤 수·최대 구역 수·잃은 조직원이 요약에 반영된다', () => {
    const base = createInitialRunState('t19-summary-basic');
    const withDeadCrew: RunState = {
      ...base,
      night: 12,
      maxDistrictsOwned: 3,
      crew: base.crew.map((c) => (c.id === crewId('crew_02') ? { ...c, status: 'dead' as const } : c)),
      ended: true,
      endReason: 'defeat_bankrupt',
    };

    const summary = buildRunEndSummary(withDeadCrew);
    expect(summary.survivedNights).toBe(12);
    expect(summary.maxDistrictsOwned).toBe(3);
    expect(summary.lostCrewIds).toEqual([crewId('crew_02')]);
    expect(summary.isVictory).toBe(false);
  });

  it('승리로 끝나면 승리 보너스가 유산 포인트에 포함된다', () => {
    const cfg = content.balance.legacySystem;
    const base = createInitialRunState('t19-summary-victory');

    const victoryState: RunState = { ...base, night: 10, maxDistrictsOwned: 4, ended: true, endReason: 'victory_rivals' };
    const defeatState: RunState = { ...base, night: 10, maxDistrictsOwned: 4, ended: true, endReason: 'defeat_bankrupt' };

    const victorySummary = buildRunEndSummary(victoryState);
    const defeatSummary = buildRunEndSummary(defeatState);

    expect(victorySummary.isVictory).toBe(true);
    expect(defeatSummary.isVictory).toBe(false);
    expect(victorySummary.legacyPointsAwarded - defeatSummary.legacyPointsAwarded).toBe(cfg.victoryBonus);
  });

  it('유산 포인트 공식이 계수와 일치한다', () => {
    const cfg = content.balance.legacySystem;
    const base = createInitialRunState('t19-summary-formula');
    const state: RunState = {
      ...base,
      night: 15,
      maxDistrictsOwned: 5,
      ended: true,
      endReason: 'victory_corporate',
    };

    const summary = buildRunEndSummary(state);
    const expected = Math.round(15 * cfg.pointsPerNightSurvived + 5 * cfg.pointsPerDistrictOwnedPeak + cfg.victoryBonus);
    expect(summary.legacyPointsAwarded).toBe(expected);
  });

  it('applyRunResultToLegacy는 유산 포인트·런 횟수·승수를 누적한다', () => {
    const legacy: LegacyState = {
      legacyPoints: 10,
      bonuses: [],
      totalRuns: 2,
      totalWins: 1,
      schemaVersion: 1,
    };
    const base = createInitialRunState('t19-legacy-apply');
    const victoryState: RunState = { ...base, night: 5, maxDistrictsOwned: 2, ended: true, endReason: 'victory_corporate' };
    const summary = buildRunEndSummary(victoryState);

    const after = applyRunResultToLegacy(legacy, summary);
    expect(after.legacyPoints).toBe(legacy.legacyPoints + summary.legacyPointsAwarded);
    expect(after.totalRuns).toBe(3);
    expect(after.totalWins).toBe(2);
  });

  it('패배한 런은 totalWins를 늘리지 않는다', () => {
    const legacy: LegacyState = { legacyPoints: 0, bonuses: [], totalRuns: 0, totalWins: 0, schemaVersion: 1 };
    const base = createInitialRunState('t19-legacy-defeat');
    const defeatState: RunState = { ...base, night: 5, ended: true, endReason: 'defeat_time_out' };
    const summary = buildRunEndSummary(defeatState);

    const after = applyRunResultToLegacy(legacy, summary);
    expect(after.totalRuns).toBe(1);
    expect(after.totalWins).toBe(0);
  });
});
