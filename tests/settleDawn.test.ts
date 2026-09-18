/**
 * tests/settleDawn.test.ts
 *
 * T-14 완료 조건:
 * - 새벽 결산에서 수입과 급여·유지비가 반영된다 (FR-RES-01).
 * - 크레딧이 음수였던 연속 밤 수가 추적된다 (FR-RUN-04).
 */

import { describe, expect, it } from 'vitest';
import { createInitialRunState } from '../src/core/initialState';
import { createRng } from '../src/core/rng';
import { resolveNight } from '../src/core/systems/resolveNight';
import { settleDawn } from '../src/core/systems/settleDawn';
import { businessId, crewId, districtId } from '../src/core/types';
import type { Business, RunState } from '../src/core/types';

/** resolveNight를 배치 없이 돌려 phase='dawn' + lastNightReport가 채워진 상태를 만든다. */
function toDawn(state: RunState): RunState {
  return resolveNight(state, [], createRng('to-dawn')).state;
}

describe('T-14 새벽 결산: 급여·유지비 (FR-RES-01)', () => {
  it('모든 활성 조직원의 급여를 합산해 크레딧에서 차감한다', () => {
    const state = toDawn(createInitialRunState('t14-wages'));
    // boss(0) + crew_01(50) + crew_02(60) = 110
    const { state: after, report } = settleDawn(state);

    expect(report.expenseTotal).toBe(110);
    expect(after.credits).toBe(state.credits - 110);
  });

  it('사망한 조직원은 급여 계산에서 제외된다', () => {
    const base = createInitialRunState('t14-dead-wages');
    const withDeadCrew: RunState = {
      ...base,
      crew: base.crew.map((c) => (c.id === crewId('crew_02') ? { ...c, status: 'dead' as const } : c)),
    };
    const state = toDawn(withDeadCrew);
    const { report } = settleDawn(state);

    // boss(0) + crew_01(50)만 남는다 (crew_02 60 제외)
    expect(report.expenseTotal).toBe(50);
  });

  it('건설된 사업의 유지비가 레벨에 맞게 합산된다', () => {
    const base = createInitialRunState('t14-maintenance');
    const business: Business = {
      id: businessId('biz_1'),
      kind: 'protection',
      districtId: districtId('slums'),
      level: 2,
    };
    const withBiz: RunState = { ...base, businesses: [business] };
    const state = toDawn(withBiz);
    const { report } = settleDawn(state);

    // protection 레벨2 유지비 18 + 급여 110
    expect(report.expenseTotal).toBe(110 + 18);
  });

  it('결산 후 phase가 day로 바뀐다', () => {
    const state = toDawn(createInitialRunState('t14-phase'));
    const { state: after } = settleDawn(state);
    expect(after.phase).toBe('day');
  });

  it("phase가 'dawn'이 아니면 에러를 던진다", () => {
    const state = createInitialRunState('t14-not-dawn'); // phase: 'planning'
    expect(() => settleDawn(state)).toThrow(/dawn/);
  });

  it('resolveNight가 만든 리포트의 다른 필드는 그대로 유지된다', () => {
    const base = createInitialRunState('t14-report-merge');
    const { state: nightState, report: nightReport } = resolveNight(
      base,
      [{ crewId: crewId('crew_01'), action: 'rest' }],
      createRng('t14-report-merge-rng'),
    );

    const { report: dawnReport } = settleDawn(nightState);

    expect(dawnReport.actionOutcomes).toEqual(nightReport.actionOutcomes);
    expect(dawnReport.incomeTotal).toBe(nightReport.incomeTotal);
    expect(dawnReport.heatDelta).toBe(nightReport.heatDelta);
    expect(dawnReport.night).toBe(nightReport.night);
    expect(dawnReport.expenseTotal).toBe(110);
  });
});

describe('T-14 새벽 결산: 연속 적자 밤 수 (FR-RUN-04)', () => {
  it('결산 후 크레딧이 음수면 연속 적자 밤 수가 1 늘어난다', () => {
    const base = createInitialRunState('t14-debt-start');
    const poor: RunState = { ...base, credits: 50 };
    const state = toDawn(poor);

    const { state: after } = settleDawn(state);
    expect(after.credits).toBeLessThan(0);
    expect(after.consecutiveDebtNights).toBe(1);
  });

  it('적자가 이어지면 연속 밤 수가 계속 늘어난다', () => {
    const base = createInitialRunState('t14-debt-streak');
    let state: RunState = toDawn({ ...base, credits: 50 });

    const round1 = settleDawn(state);
    expect(round1.state.consecutiveDebtNights).toBe(1);

    state = toDawn(round1.state);
    const round2 = settleDawn(state);
    expect(round2.state.consecutiveDebtNights).toBe(2);

    state = toDawn(round2.state);
    const round3 = settleDawn(state);
    expect(round3.state.consecutiveDebtNights).toBe(3);
  });

  it('크레딧이 0 이상으로 회복되면 연속 밤 수가 0으로 초기화된다', () => {
    const base = createInitialRunState('t14-debt-reset');
    const recovering: RunState = { ...base, credits: 100_000, consecutiveDebtNights: 5 };
    const state = toDawn(recovering);

    const { state: after } = settleDawn(state);
    expect(after.credits).toBeGreaterThanOrEqual(0);
    expect(after.consecutiveDebtNights).toBe(0);
  });
});
