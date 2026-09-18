/**
 * tests/advanceNight.test.ts
 *
 * advanceNight()가 T-13~T-19 시스템을 올바른 순서로 이어 붙이는지 확인한다.
 */

import { describe, expect, it } from 'vitest';
import { createInitialRunState } from '../src/core/initialState';
import { createRng } from '../src/core/rng';
import { advanceNight } from '../src/core/systems/advanceNight';
import { crewId, districtId } from '../src/core/types';
import type { Assignment, RunState } from '../src/core/types';

describe('T-20 advanceNight: 시스템 조립', () => {
  it('런이 끝나지 않았으면 밤이 늘고 phase가 planning으로 돌아간다', () => {
    const state = createInitialRunState('t20-advance-basic');
    const assignments: Assignment[] = [{ crewId: crewId('crew_01'), action: 'rest' }];

    const result = advanceNight(state, assignments, createRng('t20-advance-basic-rng'));

    expect(result.state.night).toBe(state.night + 1);
    expect(result.state.phase).toBe('planning');
    expect(result.state.ended).toBe(false);
  });

  it('런이 끝나면 phase가 ended가 되고 밤이 늘지 않는다', () => {
    const base = createInitialRunState('t20-advance-ended');
    const bossDead: RunState = {
      ...base,
      crew: base.crew.map((c) => (c.isBoss ? { ...c, status: 'dead' as const } : c)),
    };

    const result = advanceNight(bossDead, [], createRng('t20-advance-ended-rng'));

    expect(result.state.ended).toBe(true);
    expect(result.state.endReason).toBe('defeat_boss_dead');
    expect(result.state.phase).toBe('ended');
    expect(result.state.night).toBe(bossDead.night);
  });

  it('리포트에 경쟁 갱 행동·지출·열기 변화가 모두 반영된다', () => {
    const state = createInitialRunState('t20-advance-report');
    const result = advanceNight(state, [], createRng('t20-advance-report-rng'));

    expect(result.report.rivalActions.length).toBeGreaterThan(0);
    expect(result.report.expenseTotal).toBeGreaterThan(0); // 급여
  });

  it('열기 구간과 조직원 위험 판정 결과를 함께 반환한다', () => {
    const state = createInitialRunState('t20-advance-signals');
    const result = advanceNight(state, [], createRng('t20-advance-signals-rng'));

    expect(['quiet', 'police', 'raid', 'lockdown']).toContain(result.heatResolution.band);
    expect(result.crewRisks.length).toBe(state.crew.length);
  });

  it('구역을 점령하면 maxDistrictsOwned이 갱신된다', () => {
    const base = createInitialRunState('t20-advance-peak');
    const weak: RunState = {
      ...base,
      districts: base.districts.map((d) => (d.id === districtId('underground_market') ? { ...d, defense: 1 } : d)),
    };
    const assignments: Assignment[] = [
      { crewId: crewId('crew_01'), action: 'attack', targetDistrictId: districtId('underground_market') },
    ];

    const result = advanceNight(weak, assignments, createRng('t20-advance-peak-rng'));
    if (result.report.actionOutcomes[0]?.districtOwnerChange) {
      expect(result.state.maxDistrictsOwned).toBeGreaterThan(1);
    }
  });

  it('같은 상태·배치·시드면 같은 결과가 나온다', () => {
    const state = createInitialRunState('t20-advance-determinism');
    const assignments: Assignment[] = [
      { crewId: crewId('crew_01'), action: 'scout', targetDistrictId: districtId('harbor') },
    ];

    const a = advanceNight(state, assignments, createRng('shared-advance-seed'));
    const b = advanceNight(state, assignments, createRng('shared-advance-seed'));

    expect(a.state).toEqual(b.state);
    expect(a.report).toEqual(b.report);
  });
});
