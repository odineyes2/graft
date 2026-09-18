/**
 * tests/loyalty.test.ts
 *
 * T-16 완료 조건: 충성도 증감 규칙이 동작한다 (FR-CREW-06):
 * 급여 체불, 위험 임무 연속 배치, 동료 사망 시 감소.
 */

import { describe, expect, it } from 'vitest';
import { content } from '../src/core/content/load';
import { createInitialRunState } from '../src/core/initialState';
import { resolveCrewLoyalty } from '../src/core/systems/loyalty';
import { crewId, districtId } from '../src/core/types';
import type { ActionOutcome, Assignment, NightReport, RunState } from '../src/core/types';

const cfg = content.balance.loyaltySystem;

function makeReport(actionOutcomes: ActionOutcome[] = []): NightReport {
  return {
    night: 1,
    actionOutcomes,
    rivalActions: [],
    incomeTotal: 0,
    expenseTotal: 0,
    triggeredEventIds: [],
    heatDelta: 0,
    reputationDelta: 0,
  };
}

describe('T-16 충성도: 급여 체불 (FR-CREW-06)', () => {
  it('결산 전 크레딧이 총 급여보다 적으면 모든 생존 조직원의 충성도가 줄어든다', () => {
    const base = createInitialRunState('t16-arrears');
    const poor: RunState = { ...base, credits: 10 }; // 급여 합 110보다 적음
    const before = poor.crew.map((c) => c.loyalty);

    const { crew: after } = resolveCrewLoyalty(poor, [], makeReport());

    for (let i = 0; i < after.length; i++) {
      expect(after[i]!.loyalty).toBe(Math.max(0, before[i]! - cfg.wageArrearsPenalty));
    }
  });

  it('크레딧이 충분하면 체불로 인한 감소가 없다', () => {
    const base = createInitialRunState('t16-no-arrears');
    const before = base.crew.map((c) => c.loyalty);

    const { crew: after } = resolveCrewLoyalty(base, [], makeReport());

    for (let i = 0; i < after.length; i++) {
      expect(after[i]!.loyalty).toBe(before[i]);
    }
  });
});

describe('T-16 충성도: 위험 임무 연속 배치 (FR-CREW-06)', () => {
  it('공격·방어·정찰에 연속 배치된 밤 수가 임계치에 도달하면 그 밤부터 충성도가 줄어든다', () => {
    let state = createInitialRunState('t16-risky-streak');
    const assignment: Assignment = {
      crewId: crewId('crew_01'),
      action: 'attack',
      targetDistrictId: districtId('nightclub_row'),
    };

    for (let night = 1; night < cfg.riskyStreakThreshold; night++) {
      const result = resolveCrewLoyalty(state, [assignment], makeReport());
      state = result;
      const crew01 = state.crew.find((c) => c.id === crewId('crew_01'))!;
      expect(crew01.consecutiveRiskyNights).toBe(night);
      expect(crew01.loyalty).toBe(65); // 시작 충성도, 아직 임계치 미달
    }

    // 임계치에 도달하는 밤
    state = resolveCrewLoyalty(state, [assignment], makeReport());
    const atThreshold = state.crew.find((c) => c.id === crewId('crew_01'))!;
    expect(atThreshold.consecutiveRiskyNights).toBe(cfg.riskyStreakThreshold);
    expect(atThreshold.loyalty).toBe(65 - cfg.riskyStreakPenalty);
  });

  it('위험 임무가 아닌 행동을 배치하면 연속 카운터가 0으로 초기화된다', () => {
    let state = createInitialRunState('t16-risky-reset');
    const risky: Assignment = {
      crewId: crewId('crew_01'),
      action: 'scout',
      targetDistrictId: districtId('harbor'),
    };
    state = resolveCrewLoyalty(state, [risky], makeReport());
    state = resolveCrewLoyalty(state, [risky], makeReport());
    expect(state.crew.find((c) => c.id === crewId('crew_01'))!.consecutiveRiskyNights).toBe(2);

    state = resolveCrewLoyalty(state, [{ crewId: crewId('crew_01'), action: 'rest' }], makeReport());
    expect(state.crew.find((c) => c.id === crewId('crew_01'))!.consecutiveRiskyNights).toBe(0);
  });

  it('배치되지 않은 조직원도 연속 카운터가 0으로 초기화된다', () => {
    const state = createInitialRunState('t16-risky-idle');
    const result = resolveCrewLoyalty(state, [], makeReport());
    for (const c of result.crew) {
      expect(c.consecutiveRiskyNights).toBe(0);
    }
  });
});

describe('T-16 충성도: 동료 사망 (FR-CREW-06)', () => {
  it('조직원이 사망하면 생존한 다른 조직원의 충성도가 줄어든다', () => {
    const base = createInitialRunState('t16-death');
    const withDead: RunState = {
      ...base,
      crew: base.crew.map((c) => (c.id === crewId('crew_02') ? { ...c, status: 'dead' as const } : c)),
    };
    const report = makeReport([
      {
        crewId: crewId('crew_02'),
        action: 'attack',
        successChance: 0.1,
        grade: 'critical_failure',
        creditDelta: 0,
        heatDelta: 5,
        crewStatusChange: 'dead',
      },
    ]);

    const { crew: after } = resolveCrewLoyalty(withDead, [], report);

    const boss = after.find((c) => c.id === crewId('boss'))!;
    const crew01 = after.find((c) => c.id === crewId('crew_01'))!;
    expect(boss.loyalty).toBe(100 - cfg.crewDeathPenalty);
    expect(crew01.loyalty).toBe(65 - cfg.crewDeathPenalty);
  });

  it('사망한 조직원 자신은 충성도가 갱신되지 않는다', () => {
    const base = createInitialRunState('t16-death-self');
    const deadLoyalty = 42;
    const withDead: RunState = {
      ...base,
      crew: base.crew.map((c) =>
        c.id === crewId('crew_02') ? { ...c, status: 'dead' as const, loyalty: deadLoyalty } : c,
      ),
    };
    const report = makeReport([
      {
        crewId: crewId('crew_02'),
        action: 'attack',
        successChance: 0.1,
        grade: 'critical_failure',
        creditDelta: 0,
        heatDelta: 5,
        crewStatusChange: 'dead',
      },
    ]);

    const { crew: after } = resolveCrewLoyalty(withDead, [], report);
    expect(after.find((c) => c.id === crewId('crew_02'))!.loyalty).toBe(deadLoyalty);
  });
});

describe('T-16 충성도 범위', () => {
  it('충성도는 0 밑으로 내려가지 않는다', () => {
    const base = createInitialRunState('t16-loyalty-floor');
    const lowLoyalty: RunState = {
      ...base,
      credits: 0, // 체불 유발
      crew: base.crew.map((c) => ({ ...c, loyalty: 5 })),
    };
    const { crew: after } = resolveCrewLoyalty(lowLoyalty, [], makeReport());
    for (const c of after) {
      expect(c.loyalty).toBeGreaterThanOrEqual(0);
    }
  });
});
