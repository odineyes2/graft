/**
 * tests/crewRisk.test.ts
 *
 * T-16 완료 조건: 인간성 20 미만·충성도 30 미만 시 위험 이벤트 확률이 동작한다
 * (FR-CREW-05, FR-CREW-06).
 */

import { describe, expect, it } from 'vitest';
import { content } from '../src/core/content/load';
import { createInitialRunState } from '../src/core/initialState';
import type { Rng } from '../src/core/rng';
import { assessCrewRisks } from '../src/core/systems/crewRisk';
import { crewId } from '../src/core/types';
import type { RunState } from '../src/core/types';

function makeFixedRng(value: number): Rng {
  return { next: () => value } as unknown as Rng;
}

const cfg = content.balance.crewRiskSystem;

function withCrewStats(humanity: number, loyalty: number): RunState {
  const base = createInitialRunState('t16-risk');
  return {
    ...base,
    crew: base.crew.map((c) => (c.id === crewId('crew_01') ? { ...c, humanity, loyalty } : c)),
  };
}

describe('T-16 인간성 위험: 폭주 (FR-CREW-05)', () => {
  it('인간성이 임계치 이상이면 폭주 위험이 발동하지 않는다', () => {
    const state = withCrewStats(cfg.humanityRiskThreshold, 60);
    const results = assessCrewRisks(state, makeFixedRng(0.0));
    const crew01 = results.find((r) => r.crewId === crewId('crew_01'))!;
    expect(crew01.cyberpsychosisRiskDue).toBe(false);
  });

  it('인간성이 임계치 미만이고 roll이 확률보다 작으면 폭주 위험이 발동한다', () => {
    const state = withCrewStats(cfg.humanityRiskThreshold - 1, 60);
    const results = assessCrewRisks(state, makeFixedRng(0.0));
    const crew01 = results.find((r) => r.crewId === crewId('crew_01'))!;
    expect(crew01.cyberpsychosisRiskDue).toBe(true);
  });

  it('인간성이 임계치 미만이어도 roll이 확률 이상이면 발동하지 않는다', () => {
    const state = withCrewStats(cfg.humanityRiskThreshold - 1, 60);
    const results = assessCrewRisks(state, makeFixedRng(0.999));
    const crew01 = results.find((r) => r.crewId === crewId('crew_01'))!;
    expect(crew01.cyberpsychosisRiskDue).toBe(false);
  });
});

describe('T-16 충성도 위험: 이탈·배신 (FR-CREW-06)', () => {
  it('충성도가 임계치 이상이면 위험이 발동하지 않는다', () => {
    const state = withCrewStats(70, cfg.loyaltyRiskThreshold);
    const results = assessCrewRisks(state, makeFixedRng(0.0));
    const crew01 = results.find((r) => r.crewId === crewId('crew_01'))!;
    expect(crew01.loyaltyRiskDue).toBe(false);
  });

  it('충성도가 임계치 미만이고 roll이 확률보다 작으면 위험이 발동한다', () => {
    const state = withCrewStats(70, cfg.loyaltyRiskThreshold - 1);
    const results = assessCrewRisks(state, makeFixedRng(0.0));
    const crew01 = results.find((r) => r.crewId === crewId('crew_01'))!;
    expect(crew01.loyaltyRiskDue).toBe(true);
  });
});

describe('T-16 위험 판정 범위', () => {
  it('사망한 조직원은 판정에서 제외된다', () => {
    const base = createInitialRunState('t16-risk-dead');
    const state: RunState = {
      ...base,
      crew: base.crew.map((c) =>
        c.id === crewId('crew_01') ? { ...c, status: 'dead' as const, humanity: 0, loyalty: 0 } : c,
      ),
    };
    const results = assessCrewRisks(state, makeFixedRng(0.0));
    expect(results.some((r) => r.crewId === crewId('crew_01'))).toBe(false);
  });

  it('위험 구간이 아닌 조직원은 RNG를 소비하지 않는다', () => {
    const state = createInitialRunState('t16-risk-no-consume'); // 모든 조직원 안전 구간
    let calls = 0;
    const countingRng = {
      next: () => {
        calls++;
        return 0.0;
      },
    } as unknown as Rng;
    assessCrewRisks(state, countingRng);
    expect(calls).toBe(0);
  });
});
