/**
 * src/core/systems/heat.ts
 *
 * 열기 시스템 (FR-HEAT-01): 구역대별 분류, 조용한 밤의 자연 감소,
 * 구간별 이벤트 트리거 판정, 100 도달 시 급습 확정.
 *
 * resolveNight(T-13)가 행동으로 인한 열기 증가를 이미 state.heat에 반영해
 * 두었으므로, 이 모듈은 그 결과를 이어받아 "새벽" 단계에서 자연 감소와
 * 이벤트 유발 여부를 처리한다. 실제로 어떤 이벤트 카드가 뽑히는지는 이벤트
 * 시스템(T-17)의 책임이다 — 여기서는 "이번 밤 열기 이벤트를 띄울지" 여부만
 * 판정한다.
 *
 * 순수 TypeScript — Phaser / DOM / window / localStorage 참조 없음.
 * T-15 산출물.
 */

import { content } from '../content/load';
import type { ContentBundle, HeatThresholds } from '../content/types';
import type { Rng } from '../rng';
import type { NightReport, RunState } from '../types';
import { clamp } from './actionCheck';

export type HeatBand = 'quiet' | 'police' | 'raid' | 'lockdown';

/** 현재 열기 값이 FR-HEAT-01의 어느 구간에 속하는지 분류한다. */
export function getHeatBand(heat: number, thresholds: HeatThresholds): HeatBand {
  if (heat >= thresholds.lockdownAt) return 'lockdown';
  if (heat >= thresholds.raidEventMin) return 'raid';
  if (heat >= thresholds.policeEventMin) return 'police';
  return 'quiet';
}

export interface HeatResolution {
  readonly band: HeatBand;
  /** 자연 감소량 (0 이하 값. 감소가 없었으면 0) */
  readonly decayApplied: number;
  /** 이번 밤 열기 구간 이벤트(단속·급습)를 띄워야 하는지 */
  readonly eventTriggerDue: boolean;
  /** 열기가 100에 도달해 다음 밤 은신처 급습이 확정됐는지 (FR-HEAT-01) */
  readonly lockdown: boolean;
}

/**
 * 자연 감소와 구간별 이벤트 유발 여부를 판정해 상태와 리포트를 갱신한다.
 * state.lastNightReport(resolveNight가 만든 값)가 있어야 한다.
 */
export function resolveHeat(
  state: RunState,
  rng: Rng,
  bundle: ContentBundle = content,
): { state: RunState; report: NightReport; heatResolution: HeatResolution } {
  if (!state.lastNightReport) {
    throw new Error('resolveHeat: resolveNight가 만든 lastNightReport가 없다');
  }

  const { heatThresholds, heatSystem } = bundle.balance;
  const actionHeatDelta = state.lastNightReport.heatDelta;
  const isQuietNight = actionHeatDelta === 0;

  let decayApplied = 0;
  if (isQuietNight && state.heat < heatThresholds.quietDecayBelow) {
    decayApplied = -Math.min(state.heat, heatSystem.naturalDecayAmount);
  }

  const newHeat = clamp(state.heat + decayApplied, 0, 100);
  const band = getHeatBand(newHeat, heatThresholds);
  const lockdown = band === 'lockdown';

  let eventTriggerDue = lockdown;
  if (!lockdown && band === 'police') {
    eventTriggerDue = rng.next() < heatSystem.policeEventChance;
  } else if (!lockdown && band === 'raid') {
    eventTriggerDue = rng.next() < heatSystem.raidEventChance;
  }

  const report: NightReport = { ...state.lastNightReport, heatDelta: actionHeatDelta + decayApplied };
  const newState: RunState = { ...state, heat: newHeat, lastNightReport: report };

  return { state: newState, report, heatResolution: { band, decayApplied, eventTriggerDue, lockdown } };
}
