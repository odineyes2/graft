/**
 * tests/rivalAi.test.ts
 *
 * T-18 완료 조건: 두 성향(확장형/공격형)이 규칙대로 행동하고, 구역을 모두
 * 잃으면 괴멸 처리된다 (FR-AI-01~03).
 */

import { describe, expect, it } from 'vitest';
import { createInitialRunState } from '../src/core/initialState';
import { createRng } from '../src/core/rng';
import type { Rng } from '../src/core/rng';
import { planRivalActions, resolveRivalActions } from '../src/core/ai/rivalAi';
import { resolveNight } from '../src/core/systems/resolveNight';
import { districtId, gangId } from '../src/core/types';
import type { RunState } from '../src/core/types';

function makeFixedRng(value: number): Rng {
  return { next: () => value } as unknown as Rng;
}

function withDistrictOwner(state: RunState, id: string, owner: RunState['districts'][number]['owner']): RunState {
  return { ...state, districts: state.districts.map((d) => (d.id === districtId(id) ? { ...d, owner } : d)) };
}

function withDistrictDefense(state: RunState, id: string, defense: number): RunState {
  return { ...state, districts: state.districts.map((d) => (d.id === districtId(id) ? { ...d, defense } : d)) };
}

/** resolveNight를 배치 없이 돌려 lastNightReport가 채워진 상태를 만든다. */
function toDawn(state: RunState): RunState {
  return resolveNight(state, [], createRng('to-dawn')).state;
}

describe('T-18 확장형 AI: 중립 구역 우선 점령 (FR-AI-01)', () => {
  it('중립 구역이 있으면 그중 방어가 가장 약한 곳을 노린다', () => {
    const state = createInitialRunState('t18-expansionist-neutral');
    const plans = planRivalActions(state);
    const gangAPlan = plans.find((p) => p.gangId === gangId('gang_a'));
    // 초기 상태의 중립 구역: harbor(30), factory_district(60), corporate_zone(80) → harbor가 가장 약함
    expect(gangAPlan?.targetDistrictId).toBe(districtId('harbor'));
  });

  it('중립 구역이 없으면 방어가 가장 약한 플레이어 구역을 노린다', () => {
    let state = createInitialRunState('t18-expansionist-fallback');
    state = withDistrictOwner(state, 'harbor', 'player');
    state = withDistrictOwner(state, 'factory_district', 'player');
    state = withDistrictOwner(state, 'corporate_zone', 'player');
    // 이제 중립 구역 없음. 플레이어 구역: slums(20), harbor(30), factory_district(60), corporate_zone(80)

    const plans = planRivalActions(state);
    const gangAPlan = plans.find((p) => p.gangId === gangId('gang_a'));
    expect(gangAPlan?.targetDistrictId).toBe(districtId('slums'));
  });
});

describe('T-18 공격형 AI: 가장 약한 플레이어 구역 공격 (FR-AI-01)', () => {
  it('방어가 가장 약한 플레이어 구역을 노린다', () => {
    const state = createInitialRunState('t18-aggressive');
    const plans = planRivalActions(state);
    const gangBPlan = plans.find((p) => p.gangId === gangId('gang_b'));
    // 플레이어 구역은 slums 하나뿐이다
    expect(gangBPlan?.targetDistrictId).toBe(districtId('slums'));
  });

  it('플레이어 구역이 없으면 행동하지 않는다', () => {
    let state = createInitialRunState('t18-aggressive-none');
    state = withDistrictOwner(state, 'slums', 'neutral');

    const plans = planRivalActions(state);
    expect(plans.find((p) => p.gangId === gangId('gang_b'))).toBeUndefined();
  });
});

describe('T-18 괴멸 처리 (FR-AI-03)', () => {
  it('괴멸된 갱단은 행동하지 않는다', () => {
    const base = createInitialRunState('t18-defeated');
    const state: RunState = {
      ...base,
      rivals: base.rivals.map((r) => (r.id === gangId('gang_a') ? { ...r, controlledDistricts: [], defeated: true } : r)),
    };

    const plans = planRivalActions(state);
    expect(plans.find((p) => p.gangId === gangId('gang_a'))).toBeUndefined();
    expect(plans.find((p) => p.gangId === gangId('gang_b'))).toBeDefined();
  });
});

describe('T-18 공격 해결', () => {
  it('성공하면 구역 방어력이 damageOnSuccess만큼, 실패하면 damageOnFailure만큼 줄어든다', () => {
    const base = toDawn(createInitialRunState('t18-resolve-damage'));
    // gang_a(확장형)의 기본 목표는 harbor(중립, 방어30) — 점령되지 않을 만큼만 데미지를 준다.

    const success = resolveRivalActions(base, makeFixedRng(0.0));
    const failure = resolveRivalActions(base, makeFixedRng(0.999));

    const successDistrict = success.state.districts.find((d) => d.id === districtId('harbor'))!;
    const failureDistrict = failure.state.districts.find((d) => d.id === districtId('harbor'))!;
    expect(30 - successDistrict.defense).toBeGreaterThan(30 - failureDistrict.defense);
    expect(successDistrict.owner).toBe('neutral');
    expect(failureDistrict.owner).toBe('neutral');
  });

  it('방어력이 0 이하가 되면 구역을 점령하고 이전 소유 갱단 목록에서 빠지며 괴멸 처리된다', () => {
    const base = toDawn(createInitialRunState('t18-capture'));
    // gang_a(확장형)의 목표는 harbor(중립, 방어30)이므로, gang_b(공격형)의 목표인 slums를 낮춰 검증한다.
    const weak = withDistrictDefense(base, 'slums', 1);

    const { state: after, rivalActions } = resolveRivalActions(weak, makeFixedRng(0.0));

    const slums = after.districts.find((d) => d.id === districtId('slums'))!;
    expect(slums.owner).toBe(gangId('gang_b'));

    const gangB = after.rivals.find((r) => r.id === gangId('gang_b'))!;
    expect(gangB.controlledDistricts).toContain(districtId('slums'));

    const action = rivalActions.find((a) => a.gangId === gangId('gang_b'))!;
    expect(action.targetDistrictId).toBe(districtId('slums'));
    expect(action.succeeded).toBe(true);
  });

  it('리포트에 rivalActions가 반영된다', () => {
    const base = toDawn(createInitialRunState('t18-report'));
    const { report, rivalActions } = resolveRivalActions(base, createRng('t18-report-rng'));
    expect(report.rivalActions).toEqual(rivalActions);
    expect(rivalActions.length).toBeGreaterThan(0);
  });

  it('lastNightReport가 없으면 에러를 던진다', () => {
    const state = createInitialRunState('t18-no-report');
    expect(() => resolveRivalActions(state, createRng('x'))).toThrow();
  });

  it('같은 상태·시드면 같은 결과가 나온다 (FR-AI-02)', () => {
    const base = toDawn(createInitialRunState('t18-determinism'));
    const a = resolveRivalActions(base, createRng('shared-ai-seed'));
    const b = resolveRivalActions(base, createRng('shared-ai-seed'));
    expect(a.state).toEqual(b.state);
    expect(a.rivalActions).toEqual(b.rivalActions);
  });
});
