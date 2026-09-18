/**
 * tools/simulateRun.ts
 *
 * 봇 하나가 시드 하나로 런 하나를 끝까지 진행한다. advanceNight(T-20 핵심
 * 조립 함수)가 밤 사이클의 결정적인 부분을 처리하고, core의
 * triggerNightEvents(T-33)가 어떤 이벤트가 뜨는지까지 정한다. 여기서는 그
 * 결과로 나온 이벤트에 어떤 선택지를 고를지 결정하는 봇 전용 로직만 담당한다.
 */

import { content } from '../src/core/content/load';
import { createInitialRunState } from '../src/core/initialState';
import { createRng } from '../src/core/rng';
import { advanceNight } from '../src/core/systems/advanceNight';
import { applyEventChoice } from '../src/core/systems/events';
import { triggerNightEvents } from '../src/core/systems/nightEvents';
import type { TriggeredNightEvent } from '../src/core/systems/nightEvents';
import { buildRunEndSummary } from '../src/core/systems/runEnd';
import type { RunEndSummary } from '../src/core/systems/runEnd';
import type { RunState } from '../src/core/types';
import { decideAssignments, pickEventChoice, tryBuildBusiness } from './bots';
import type { BotConfig } from './bots';

function applyNightEventChoices(
  state: RunState,
  triggered: ReadonlyArray<TriggeredNightEvent>,
): RunState {
  let current = state;

  for (const { event, actingCrewId } of triggered) {
    const choiceKey = pickEventChoice(event, actingCrewId !== undefined);
    try {
      current = applyEventChoice(current, event, choiceKey, actingCrewId ? { actingCrewId } : {});
    } catch (err) {
      // 적용 대상 조직원이 없는 등 드문 경우 — 통계 목적상 건너뛴다.
      console.warn(`[sim] 이벤트 적용 실패, 건너뜀: ${event.id} (${(err as Error).message})`);
    }
  }

  return current;
}

export interface RunStats extends RunEndSummary {
  readonly peakHeat: number;
}

export function simulateOneRun(seed: string, bot: BotConfig): RunStats {
  const rng = createRng(seed);
  let state = createInitialRunState(seed);
  let peakHeat = state.heat;

  state = tryBuildBusiness(state, bot, content);

  // 안전장치: maxNights를 넘겨도 끝나지 않는 버그가 있으면 무한 루프 대신 여기서 멈춘다.
  const maxIterations = content.balance.maxNights + 5;
  let iterations = 0;

  while (!state.ended && iterations < maxIterations) {
    iterations++;
    const assignments = decideAssignments(state, bot, content);
    const result = advanceNight(state, assignments, rng, content);
    state = result.state;

    const heatBeforeDecay = state.heat - result.heatResolution.decayApplied;
    peakHeat = Math.max(peakHeat, heatBeforeDecay);

    const { state: triggeredState, triggered } = triggerNightEvents(
      state,
      result.heatResolution,
      result.crewRisks,
      rng,
      content,
    );
    state = applyNightEventChoices(triggeredState, triggered);

    if (!state.ended) {
      state = tryBuildBusiness(state, bot, content);
    }
  }

  if (!state.ended) {
    // 안전장치가 발동한 극히 드문 경우: 시간 초과로 간주해 요약을 만들 수 있게 한다.
    state = { ...state, ended: true, endReason: 'defeat_time_out' };
  }

  const summary = buildRunEndSummary(state);
  return { ...summary, peakHeat };
}
