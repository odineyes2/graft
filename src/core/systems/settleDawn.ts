/**
 * src/core/systems/settleDawn.ts
 *
 * 새벽 결산 (FR-TURN-01의 "새벽: 결산" 단계, FR-RES-01, FR-RUN-04).
 * resolveNight()가 만든 상태(phase='dawn')를 받아 조직원 급여와 사업 유지비를
 * 차감하고, 크레딧이 연속으로 음수였던 밤 수를 갱신한다.
 *
 * 순수 TypeScript — Phaser / DOM / window / localStorage 참조 없음.
 * T-14 산출물.
 */

import { content } from '../content/load';
import type { ContentBundle } from '../content/types';
import type { NightReport, RunState } from '../types';

function sumWages(state: RunState): number {
  return state.crew.filter((c) => c.status !== 'dead').reduce((sum, c) => sum + c.wagePerNight, 0);
}

function sumMaintenance(state: RunState, bundle: ContentBundle): number {
  return state.businesses.reduce((sum, business) => {
    const def = bundle.businesses.find((b) => b.kind === business.kind);
    if (!def) throw new Error(`사업 정의가 없다: ${business.kind}`);
    return sum + def.maintenanceCostPerLevel[business.level - 1];
  }, 0);
}

/**
 * phase가 'dawn'인 상태를 받아 유지비를 차감하고 phase를 'day'로 넘긴다.
 * 같은 입력이면 항상 같은 결과가 나온다 (RNG를 쓰지 않는다).
 */
export function settleDawn(
  state: RunState,
  bundle: ContentBundle = content,
): { state: RunState; report: NightReport } {
  if (state.phase !== 'dawn') {
    throw new Error(`settleDawn은 phase가 'dawn'일 때만 호출할 수 있다 (현재: '${state.phase}')`);
  }
  if (!state.lastNightReport) {
    throw new Error('settleDawn: resolveNight가 만든 lastNightReport가 없다');
  }

  const wages = sumWages(state);
  const maintenance = sumMaintenance(state, bundle);
  const expenseTotal = wages + maintenance;

  const newCredits = state.credits - expenseTotal;
  const consecutiveDebtNights = newCredits < 0 ? state.consecutiveDebtNights + 1 : 0;

  const report: NightReport = { ...state.lastNightReport, expenseTotal };

  const newState: RunState = {
    ...state,
    phase: 'day',
    credits: newCredits,
    consecutiveDebtNights,
    lastNightReport: report,
  };

  return { state: newState, report };
}
