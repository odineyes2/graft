/**
 * tests/heat.test.ts
 *
 * T-15 완료 조건:
 * - 자연 감소, 구간별 이벤트 트리거 조건, 100 도달 시 급습 확정이 동작한다 (FR-HEAT-01).
 */

import { describe, expect, it } from 'vitest';
import { content } from '../src/core/content/load';
import { createInitialRunState } from '../src/core/initialState';
import type { Rng } from '../src/core/rng';
import { getHeatBand, resolveHeat } from '../src/core/systems/heat';
import type { NightReport, RunState } from '../src/core/types';

function makeFixedRng(value: number): Rng {
  return { next: () => value } as unknown as Rng;
}

function makeReport(heatDelta: number): NightReport {
  return {
    night: 1,
    actionOutcomes: [],
    rivalActions: [],
    incomeTotal: 0,
    expenseTotal: 0,
    triggeredEventIds: [],
    heatDelta,
    reputationDelta: 0,
  };
}

function withHeatReport(heat: number, actionHeatDelta: number): RunState {
  const base = createInitialRunState('t15-fixture');
  return { ...base, heat, lastNightReport: makeReport(actionHeatDelta) };
}

const { heatThresholds } = content.balance;

describe('T-15 열기 구간 분류 (FR-HEAT-01)', () => {
  it('0~39는 quiet, 40~69는 police, 70~99는 raid, 100 이상은 lockdown이다', () => {
    expect(getHeatBand(0, heatThresholds)).toBe('quiet');
    expect(getHeatBand(39, heatThresholds)).toBe('quiet');
    expect(getHeatBand(40, heatThresholds)).toBe('police');
    expect(getHeatBand(69, heatThresholds)).toBe('police');
    expect(getHeatBand(70, heatThresholds)).toBe('raid');
    expect(getHeatBand(99, heatThresholds)).toBe('raid');
    expect(getHeatBand(100, heatThresholds)).toBe('lockdown');
  });
});

describe('T-15 자연 감소', () => {
  it('조용한 밤(행동 열기 증가 0)이고 quiet 구간이면 열기가 자연 감소한다', () => {
    const state = withHeatReport(20, 0);
    const { state: after, heatResolution } = resolveHeat(state, makeFixedRng(0.99));
    expect(heatResolution.decayApplied).toBeLessThan(0);
    expect(after.heat).toBe(20 + heatResolution.decayApplied);
  });

  it('자연 감소는 0 밑으로 내려가지 않는다', () => {
    const state = withHeatReport(3, 0);
    const { state: after } = resolveHeat(state, makeFixedRng(0.99));
    expect(after.heat).toBe(0);
  });

  it('행동으로 열기가 증가한 밤(조용하지 않음)에는 자연 감소가 없다', () => {
    const state = withHeatReport(20, 8);
    const { heatResolution } = resolveHeat(state, makeFixedRng(0.99));
    expect(heatResolution.decayApplied).toBe(0);
  });

  it('열기가 quietDecayBelow 이상이면 조용해도 자연 감소가 없다', () => {
    const state = withHeatReport(50, 0);
    const { heatResolution } = resolveHeat(state, makeFixedRng(0.99));
    expect(heatResolution.decayApplied).toBe(0);
  });

  it('결산 리포트의 heatDelta에 자연 감소분이 반영된다', () => {
    const state = withHeatReport(20, 0);
    const { report, heatResolution } = resolveHeat(state, makeFixedRng(0.99));
    expect(report.heatDelta).toBe(0 + heatResolution.decayApplied);
  });
});

describe('T-15 구간별 이벤트 트리거 (FR-HEAT-01)', () => {
  it('police 구간에서는 policeEventChance보다 작은 roll이면 이벤트가 유발된다', () => {
    const state = withHeatReport(50, 5); // 50 -> police 구간, 조용하지 않으니 자연 감소 없음
    const triggered = resolveHeat(state, makeFixedRng(0.01));
    const notTriggered = resolveHeat(state, makeFixedRng(0.99));
    expect(triggered.heatResolution.band).toBe('police');
    expect(triggered.heatResolution.eventTriggerDue).toBe(true);
    expect(notTriggered.heatResolution.eventTriggerDue).toBe(false);
  });

  it('raid 구간에서는 raidEventChance보다 작은 roll이면 이벤트가 유발된다', () => {
    const state = withHeatReport(80, 5);
    const triggered = resolveHeat(state, makeFixedRng(0.01));
    const notTriggered = resolveHeat(state, makeFixedRng(0.99));
    expect(triggered.heatResolution.band).toBe('raid');
    expect(triggered.heatResolution.eventTriggerDue).toBe(true);
    expect(notTriggered.heatResolution.eventTriggerDue).toBe(false);
  });

  it('quiet 구간에서는 이벤트가 유발되지 않는다', () => {
    const state = withHeatReport(10, 5); // 조용하지 않아 감소도 없지만 여전히 quiet 구간
    const { heatResolution } = resolveHeat(state, makeFixedRng(0.0));
    expect(heatResolution.band).toBe('quiet');
    expect(heatResolution.eventTriggerDue).toBe(false);
  });
});

describe('T-15 열기 100 도달 시 급습 확정', () => {
  it('열기가 100이면 lockdown이고 이벤트 트리거가 항상 확정된다', () => {
    const state = withHeatReport(100, 5);
    const { heatResolution } = resolveHeat(state, makeFixedRng(0.999));
    expect(heatResolution.band).toBe('lockdown');
    expect(heatResolution.lockdown).toBe(true);
    expect(heatResolution.eventTriggerDue).toBe(true);
  });
});

describe('T-15 resolveHeat 유효성 검사', () => {
  it('lastNightReport가 없으면 에러를 던진다', () => {
    const state = createInitialRunState('t15-no-report');
    expect(() => resolveHeat(state, makeFixedRng(0.5))).toThrow();
  });
});
