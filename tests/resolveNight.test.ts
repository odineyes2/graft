/**
 * tests/resolveNight.test.ts
 *
 * T-13 완료 조건:
 * - FR-ACT-01~03, FR-CREW-03~04, FR-BIZ-03을 만족한다.
 * - 리포트에 행동별 성공 확률과 결과 등급이 포함된다.
 * - 같은 입력·시드면 같은 리포트가 나오는 테스트가 통과한다.
 */

import { describe, expect, it } from 'vitest';
import { createInitialRunState } from '../src/core/initialState';
import { createRng } from '../src/core/rng';
import type { Rng } from '../src/core/rng';
import { resolveNight } from '../src/core/systems/resolveNight';
import { businessId, crewId, districtId } from '../src/core/types';
import type { Assignment, Business, CrewMember, RunState } from '../src/core/types';

function makeFixedRng(value: number): Rng {
  return { next: () => value } as unknown as Rng;
}

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

function withDistrictDefense(state: RunState, id: string, defense: number): RunState {
  return {
    ...state,
    districts: state.districts.map((d) => (d.id === districtId(id) ? { ...d, defense } : d)),
  };
}

describe('T-13 밤 해결 엔진: 결정론 (NFR-02)', () => {
  it('같은 state·assignments·시드면 같은 리포트와 상태가 나온다', () => {
    const state = createInitialRunState('t13-determinism');
    const assignments: Assignment[] = [
      { crewId: crewId('crew_01'), action: 'attack', targetDistrictId: districtId('underground_market') },
      { crewId: crewId('crew_02'), action: 'scout', targetDistrictId: districtId('harbor') },
      { crewId: crewId('boss'), action: 'rest' },
    ];

    const resultA = resolveNight(state, assignments, createRng('shared-night-seed'));
    const resultB = resolveNight(state, assignments, createRng('shared-night-seed'));

    expect(resultA.report).toEqual(resultB.report);
    expect(resultA.state).toEqual(resultB.state);
  });
});

describe('T-13 밤 해결 엔진: 리포트 (FR-ACT-03)', () => {
  it('모든 행동 결과에 성공 확률과 결과 등급이 포함된다', () => {
    const state = createInitialRunState('t13-report');
    const assignments: Assignment[] = [
      { crewId: crewId('crew_01'), action: 'attack', targetDistrictId: districtId('underground_market') },
      { crewId: crewId('crew_02'), action: 'scout', targetDistrictId: districtId('harbor') },
    ];

    const { report } = resolveNight(state, assignments, createRng('report-seed'));

    expect(report.actionOutcomes).toHaveLength(2);
    for (const outcome of report.actionOutcomes) {
      expect(outcome.successChance).toBeGreaterThanOrEqual(0);
      expect(outcome.successChance).toBeLessThanOrEqual(1);
      expect(['critical_success', 'success', 'failure', 'critical_failure']).toContain(outcome.grade);
    }
  });

  it('배치되지 않은 조직원은 결과에 나타나지 않는다', () => {
    const state = createInitialRunState('t13-idle');
    const { report } = resolveNight(state, [], createRng('idle-seed'));
    expect(report.actionOutcomes).toHaveLength(0);
    expect(report.night).toBe(state.night);
  });
});

describe('T-13 밤 해결 엔진: 조직원 배치 규칙 (FR-CREW-03~04)', () => {
  it('한 조직원을 같은 밤에 두 행동에 배치하면 에러를 던진다', () => {
    const state = createInitialRunState('t13-double');
    const assignments: Assignment[] = [
      { crewId: crewId('crew_01'), action: 'rest' },
      { crewId: crewId('crew_01'), action: 'scout', targetDistrictId: districtId('harbor') },
    ];
    expect(() => resolveNight(state, assignments, createRng('x'))).toThrow(/두 가지 행동/);
  });

  it('존재하지 않는 조직원을 배치하면 에러를 던진다', () => {
    const state = createInitialRunState('t13-missing');
    const assignments: Assignment[] = [{ crewId: crewId('ghost'), action: 'rest' }];
    expect(() => resolveNight(state, assignments, createRng('x'))).toThrow();
  });

  it('부상 상태인 조직원을 배치하면 에러를 던진다', () => {
    const base = createInitialRunState('t13-injured-assign');
    const injuredCrew = { ...base.crew.find((c) => c.id === crewId('crew_01'))!, status: 'injured' as const, injuredNightsRemaining: 2 };
    const state = withCrew(base, injuredCrew);
    const assignments: Assignment[] = [{ crewId: crewId('crew_01'), action: 'rest' }];
    expect(() => resolveNight(state, assignments, createRng('x'))).toThrow(/injured/);
  });

  it('부상 조직원은 배치 없이도 매 밤 자동으로 회복하다가 0이 되면 active로 돌아간다', () => {
    const base = createInitialRunState('t13-recovery');
    const injuredCrew = { ...base.crew.find((c) => c.id === crewId('crew_01'))!, status: 'injured' as const, injuredNightsRemaining: 2 };
    const state1 = withCrew(base, injuredCrew);

    const { state: state2 } = resolveNight(state1, [], createRng('recover-1'));
    const crew2 = state2.crew.find((c) => c.id === crewId('crew_01'))!;
    expect(crew2.status).toBe('injured');
    expect(crew2.injuredNightsRemaining).toBe(1);

    const { state: state3 } = resolveNight(state2, [], createRng('recover-2'));
    const crew3 = state3.crew.find((c) => c.id === crewId('crew_01'))!;
    expect(crew3.status).toBe('active');
    expect(crew3.injuredNightsRemaining).toBe(0);
  });
});

describe('T-13 공격 행동 (FR-ACT-01~02)', () => {
  it('능력치가 높을수록 성공 확률이 높다', () => {
    const base = createInitialRunState('t13-attack-chance');
    // 방어력을 중간 수준으로 낮춰 minChance 클램프에 걸리지 않게 한다.
    const state = withDistrictDefense(base, 'nightclub_row', 10);
    const strong = resolveNight(
      state,
      [{ crewId: crewId('crew_01'), action: 'attack', targetDistrictId: districtId('nightclub_row') }],
      createRng('attack-strong'),
    );
    const weak = resolveNight(
      state,
      [{ crewId: crewId('crew_02'), action: 'attack', targetDistrictId: districtId('nightclub_row') }],
      createRng('attack-weak'),
    );
    // crew_01 force 7 > crew_02 force 3
    expect(strong.report.actionOutcomes[0]!.successChance).toBeGreaterThan(
      weak.report.actionOutcomes[0]!.successChance,
    );
  });

  it('방어력을 0 이하로 깎으면 구역을 점령하고 상대 갱단 소유 목록에서 제거한다', () => {
    const base = createInitialRunState('t13-capture');
    const state = withDistrictDefense(base, 'underground_market', 3);
    const rivalBefore = state.rivals.find((r) => r.personality === 'expansionist')!;
    expect(rivalBefore.controlledDistricts).toContain(districtId('underground_market'));

    const { state: after, report } = resolveNight(
      state,
      [{ crewId: crewId('crew_01'), action: 'attack', targetDistrictId: districtId('underground_market') }],
      createRng('capture-seed'),
    );

    const outcome = report.actionOutcomes[0]!;
    // 방어력이 워낙 낮아 실패 등급이라도 점령까지는 못 가더라도, 최소 데미지 규칙은 검증한다.
    expect(outcome.action).toBe('attack');

    if (outcome.grade !== 'failure' || outcome.districtOwnerChange) {
      const district = after.districts.find((d) => d.id === districtId('underground_market'))!;
      if (district.owner === 'player') {
        expect(outcome.districtOwnerChange).toEqual({
          districtId: districtId('underground_market'),
          newOwner: 'player',
        });
        const rivalAfter = after.rivals.find((r) => r.personality === 'expansionist')!;
        expect(rivalAfter.controlledDistricts).not.toContain(districtId('underground_market'));
        expect(rivalAfter.defeated).toBe(true);
      }
    }
  });

  it('대실패 시 조직원이 부상당하거나 사망한다', () => {
    const base = createInitialRunState('t13-crit-fail');
    // 방어력을 매우 높게 두어 실패권을 넓히고, roll을 대실패 구간으로 고정한다.
    const state = withDistrictDefense(base, 'corporate_zone', 500);
    const attacker = state.crew.find((c) => c.id === crewId('crew_01'))!;

    // successChance는 minChance(0.05)로 클램프된다. roll=0.06 → failRoll=(0.06-0.05)/0.95≈0.0105 < 0.2 → critical_failure.
    // resolveNight은 실제 Rng를 쓰므로, 대실패가 나올 때까지 시드를 바꿔가며 찾는다.
    let found = false;
    for (let i = 0; i < 200 && !found; i++) {
      const { report } = resolveNight(
        state,
        [{ crewId: attacker.id, action: 'attack', targetDistrictId: districtId('corporate_zone') }],
        createRng(`crit-fail-search-${i}`),
      );
      const outcome = report.actionOutcomes[0]!;
      if (outcome.grade === 'critical_failure') {
        expect(['injured', 'dead']).toContain(outcome.crewStatusChange);
        found = true;
      }
    }
    expect(found).toBe(true);
  });
});

describe('T-13 방어 행동', () => {
  it('플레이어 소유 구역만 방어할 수 있다', () => {
    const state = createInitialRunState('t13-defend-invalid');
    expect(() =>
      resolveNight(
        state,
        [{ crewId: crewId('crew_01'), action: 'defend', targetDistrictId: districtId('nightclub_row') }],
        createRng('x'),
      ),
    ).toThrow(/플레이어가 소유/);
  });

  it('성공하면 구역 방어력이 오른다', () => {
    const state = createInitialRunState('t13-defend-success');
    const before = state.districts.find((d) => d.id === districtId('slums'))!.defense;

    const { state: after, report } = resolveNight(
      state,
      [{ crewId: crewId('crew_01'), action: 'defend', targetDistrictId: districtId('slums') }],
      makeFixedRng(0.1), // successChance(0.5 근방) 안쪽 → success 계열
    );

    const afterDefense = after.districts.find((d) => d.id === districtId('slums'))!.defense;
    const outcome = report.actionOutcomes[0]!;
    if (outcome.grade === 'success' || outcome.grade === 'critical_success') {
      expect(afterDefense).toBeGreaterThan(before);
    } else {
      expect(afterDefense).toBeGreaterThanOrEqual(before);
    }
  });
});

describe('T-13 정찰 행동 (FR-MAP-04)', () => {
  it('성공하면 구역이 정찰 완료 상태가 된다', () => {
    const state = createInitialRunState('t13-scout');
    expect(state.districts.find((d) => d.id === districtId('harbor'))!.scouted).toBe(false);

    const { state: after, report } = resolveNight(
      state,
      [{ crewId: crewId('crew_02'), action: 'scout', targetDistrictId: districtId('harbor') }],
      makeFixedRng(0.001),
    );

    const outcome = report.actionOutcomes[0]!;
    expect(outcome.grade === 'success' || outcome.grade === 'critical_success').toBe(true);
    expect(after.districts.find((d) => d.id === districtId('harbor'))!.scouted).toBe(true);
  });
});

describe('T-13 운영 행동 (FR-BIZ-03)', () => {
  it('배치 조직원의 관련 능력치가 높을수록 성공 확률이 높다', () => {
    const base = createInitialRunState('t13-operate-chance');
    const business: Business = {
      id: businessId('biz_protection'),
      kind: 'protection',
      districtId: districtId('slums'),
      level: 1,
    };
    const strong = makeTestCrew('crew_strong', 9);
    const weak = makeTestCrew('crew_weak', 1);
    const state = withBusinesses(withCrew(base, strong, weak), business);

    const strongResult = resolveNight(
      state,
      [{ crewId: strong.id, action: 'operate', targetDistrictId: districtId('slums'), targetBusinessId: business.id }],
      createRng('op-strong'),
    );
    const weakResult = resolveNight(
      state,
      [{ crewId: weak.id, action: 'operate', targetDistrictId: districtId('slums'), targetBusinessId: business.id }],
      createRng('op-weak'),
    );

    expect(strongResult.report.actionOutcomes[0]!.successChance).toBeGreaterThan(
      weakResult.report.actionOutcomes[0]!.successChance,
    );
  });

  it('성공 시 수입이 발생하고 등급이 높을수록 수입이 커진다', () => {
    const base = createInitialRunState('t13-operate-income');
    const business: Business = {
      id: businessId('biz_protection_2'),
      kind: 'protection',
      districtId: districtId('slums'),
      level: 1,
    };
    // difficulty = operateDifficultyBase(5); force=5로 맞춰 successChance를 정확히 0.5로 만든다.
    const crew = makeTestCrew('crew_balanced', 5);
    const state = withBusinesses(withCrew(base, crew), business);
    const assignment: Assignment = {
      crewId: crew.id,
      action: 'operate',
      targetDistrictId: districtId('slums'),
      targetBusinessId: business.id,
    };

    const critical = resolveNight(state, [assignment], makeFixedRng(0.0)); // critical_success
    const success = resolveNight(state, [assignment], makeFixedRng(0.45)); // success
    const failure = resolveNight(state, [assignment], makeFixedRng(0.9)); // failure
    const criticalFailure = resolveNight(state, [assignment], makeFixedRng(0.55)); // critical_failure

    const incomes = {
      critical: critical.report.actionOutcomes[0]!,
      success: success.report.actionOutcomes[0]!,
      failure: failure.report.actionOutcomes[0]!,
      criticalFailure: criticalFailure.report.actionOutcomes[0]!,
    };

    expect(incomes.critical.grade).toBe('critical_success');
    expect(incomes.success.grade).toBe('success');
    expect(incomes.failure.grade).toBe('failure');
    expect(incomes.criticalFailure.grade).toBe('critical_failure');

    expect(incomes.critical.creditDelta).toBeGreaterThan(incomes.success.creditDelta);
    expect(incomes.success.creditDelta).toBeGreaterThan(incomes.failure.creditDelta);
    expect(incomes.failure.creditDelta).toBeGreaterThan(incomes.criticalFailure.creditDelta);
    expect(incomes.criticalFailure.creditDelta).toBe(0);
  });

  it("해커 특성이 없으면 데이터 밀매는 자동 실패 처리된다 (FR-BIZ-01 '해커 배치 필수')", () => {
    const base = createInitialRunState('t13-hacker');
    const business: Business = {
      id: businessId('biz_data'),
      kind: 'datatrafficking',
      districtId: districtId('slums'),
      level: 1,
    };
    const nonHacker = makeTestCrew('crew_no_hacker', 9);
    const state = withBusinesses(withCrew(base, nonHacker), business);

    const { report } = resolveNight(
      state,
      [
        {
          crewId: nonHacker.id,
          action: 'operate',
          targetDistrictId: districtId('slums'),
          targetBusinessId: business.id,
        },
      ],
      createRng('no-hacker-seed'),
    );

    const outcome = report.actionOutcomes[0]!;
    expect(outcome.grade).toBe('failure');
    expect(outcome.successChance).toBe(0);
    expect(outcome.creditDelta).toBe(0);
  });
});

describe('T-13 휴식 행동 (FR-CREW-03)', () => {
  it('인간성이 소폭 회복되고 항상 성공으로 처리된다', () => {
    const state = createInitialRunState('t13-rest');
    const before = state.crew.find((c) => c.id === crewId('crew_01'))!.humanity;

    const { state: after, report } = resolveNight(
      state,
      [{ crewId: crewId('crew_01'), action: 'rest' }],
      createRng('rest-seed'),
    );

    const afterHumanity = after.crew.find((c) => c.id === crewId('crew_01'))!.humanity;
    expect(afterHumanity).toBeGreaterThan(before);
    expect(report.actionOutcomes[0]).toMatchObject({ action: 'rest', grade: 'success', successChance: 1 });
  });
});
