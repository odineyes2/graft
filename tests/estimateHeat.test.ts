/**
 * tests/estimateHeat.test.ts
 *
 * T-15 완료 조건: 배치 확정 전 예상 열기 증가량을 계산하는 함수가 있다 (FR-HEAT-02).
 */

import { describe, expect, it } from 'vitest';
import { content } from '../src/core/content/load';
import { createInitialRunState } from '../src/core/initialState';
import { computeGradeProbabilities, computeSuccessChance } from '../src/core/systems/actionCheck';
import { estimateAssignmentHeat, estimateNightHeatIncrease } from '../src/core/systems/estimateHeat';
import { businessId, crewId, districtId } from '../src/core/types';
import type { Assignment, Business, CrewMember, RunState } from '../src/core/types';

function makeTestCrew(id: string, statValue: number, traitIds: string[] = []): CrewMember {
  return {
    id: crewId(id),
    isBoss: false,
    baseStats: { force: statValue, tech: statValue, negotiation: statValue, stealth: statValue },
    humanity: 70,
    loyalty: 60,
    cyberwareIds: [],
    traitIds,
    status: 'active',
    injuredNightsRemaining: 0,
    wagePerNight: 0,
  };
}

function withCrew(state: RunState, ...crew: CrewMember[]): RunState {
  const ids = new Set(crew.map((c) => c.id));
  return { ...state, crew: [...state.crew.filter((c) => !ids.has(c.id)), ...crew] };
}

function withBusinesses(state: RunState, ...businesses: Business[]): RunState {
  return { ...state, businesses: [...state.businesses, ...businesses] };
}

describe('T-15 예상 열기 증가량 (FR-HEAT-02)', () => {
  it('휴식은 예상 열기 증가가 없다', () => {
    const state = createInitialRunState('t15-est-rest');
    const assignment: Assignment = { crewId: crewId('crew_01'), action: 'rest' };
    expect(estimateAssignmentHeat(state, assignment)).toBe(0);
  });

  it('방어는 항상 defendHeatBase만큼만 예상된다', () => {
    const state = createInitialRunState('t15-est-defend');
    const assignment: Assignment = {
      crewId: crewId('crew_01'),
      action: 'defend',
      targetDistrictId: districtId('slums'),
    };
    expect(estimateAssignmentHeat(state, assignment)).toBe(content.balance.actionResolution.defendHeatBase);
  });

  it('공격은 능력치가 높을수록 예상 열기가 같거나 크다 (성공할수록 더 시끄럽다)', () => {
    const base = createInitialRunState('t15-est-attack');
    const strong = makeTestCrew('crew_strong', 9);
    const weak = makeTestCrew('crew_weak', 2);
    const state = withCrew(base, strong, weak);

    const strongEstimate = estimateAssignmentHeat(state, {
      crewId: strong.id,
      action: 'attack',
      targetDistrictId: districtId('nightclub_row'),
    });
    const weakEstimate = estimateAssignmentHeat(state, {
      crewId: weak.id,
      action: 'attack',
      targetDistrictId: districtId('nightclub_row'),
    });

    expect(strongEstimate).toBeGreaterThanOrEqual(weakEstimate);
  });

  it('정찰의 예상 열기 계산이 공식과 일치한다', () => {
    const base = createInitialRunState('t15-est-scout');
    const crew = makeTestCrew('crew_scout', 6);
    const state = withCrew(base, crew);
    const district = state.districts.find((d) => d.id === districtId('harbor'))!;

    const cfg = content.balance.actionResolution;
    const successChance = computeSuccessChance(6, district.defense, cfg);
    const probs = computeGradeProbabilities(successChance, cfg);
    const expected = Math.round(cfg.scoutHeatBase + cfg.attackHeatBase * probs.critical_failure);

    const actual = estimateAssignmentHeat(state, {
      crewId: crew.id,
      action: 'scout',
      targetDistrictId: districtId('harbor'),
    });

    expect(actual).toBe(expected);
  });

  it('운영: 해커가 필요한 사업에 해커가 없으면 확률과 무관하게 고정된 값을 예상한다', () => {
    const base = createInitialRunState('t15-est-hacker');
    const business: Business = {
      id: businessId('biz_data'),
      kind: 'datatrafficking',
      districtId: districtId('slums'),
      level: 1,
    };
    const nonHacker = makeTestCrew('crew_no_hacker', 9);
    const state = withBusinesses(withCrew(base, nonHacker), business);

    const businessDef = content.businesses.find((b) => b.kind === 'datatrafficking')!;
    const districtDef = content.districts.find((d) => d.id === districtId('slums'))!;
    const cfg = content.balance.actionResolution;
    const expected = Math.round(
      businessDef.heatPerLevel[0] * cfg.minAttemptHeatMultiplier * districtDef.heatMultiplier,
    );

    const actual = estimateAssignmentHeat(state, {
      crewId: nonHacker.id,
      action: 'operate',
      targetDistrictId: districtId('slums'),
      targetBusinessId: business.id,
    });

    expect(actual).toBe(expected);
  });

  it('여러 배치의 총 예상 열기는 개별 예상치의 합과 같다', () => {
    const state = createInitialRunState('t15-est-total');
    const assignments: Assignment[] = [
      { crewId: crewId('crew_01'), action: 'attack', targetDistrictId: districtId('nightclub_row') },
      { crewId: crewId('crew_02'), action: 'scout', targetDistrictId: districtId('harbor') },
      { crewId: crewId('boss'), action: 'rest' },
    ];

    const total = estimateNightHeatIncrease(state, assignments);
    const sum = assignments.reduce((acc, a) => acc + estimateAssignmentHeat(state, a), 0);
    expect(total).toBe(sum);
  });

  it('RNG를 소비하지 않으므로 반복 호출해도 항상 같은 값이 나온다', () => {
    const state = createInitialRunState('t15-est-pure');
    const assignment: Assignment = {
      crewId: crewId('crew_01'),
      action: 'attack',
      targetDistrictId: districtId('nightclub_row'),
    };
    const a = estimateAssignmentHeat(state, assignment);
    const b = estimateAssignmentHeat(state, assignment);
    const c = estimateAssignmentHeat(state, assignment);
    expect(a).toBe(b);
    expect(b).toBe(c);
  });
});
