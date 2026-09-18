/**
 * tools/simulateRun.ts
 *
 * 봇 하나가 시드 하나로 런 하나를 끝까지 진행한다. advanceNight(T-20 핵심
 * 조립 함수)가 밤 사이클의 결정적인 부분을 처리하고, 여기서는 그 결과로
 * 나온 "이벤트를 띄워야 하는지" 신호를 받아 실제로 이벤트를 골라 적용하는
 * 봇 전용 로직만 담당한다.
 */

import { content } from '../src/core/content/load';
import type { EventCardDef } from '../src/core/content/types';
import { createInitialRunState } from '../src/core/initialState';
import { createRng } from '../src/core/rng';
import { advanceNight } from '../src/core/systems/advanceNight';
import type { CrewRiskAssessment } from '../src/core/systems/crewRisk';
import { applyEventChoice, triggerEvent } from '../src/core/systems/events';
import type { HeatResolution } from '../src/core/systems/heat';
import { buildRunEndSummary } from '../src/core/systems/runEnd';
import type { RunEndSummary } from '../src/core/systems/runEnd';
import type { CrewId, RunState } from '../src/core/types';
import { decideAssignments, pickEventChoice, tryBuildBusiness } from './bots';
import type { BotConfig } from './bots';

interface TriggeredEvent {
  readonly event: EventCardDef;
  readonly actingCrewId?: CrewId;
}

function resolveNightEvents(
  state: RunState,
  heatResolution: HeatResolution,
  crewRisks: ReadonlyArray<CrewRiskAssessment>,
  rng: ReturnType<typeof createRng>,
): RunState {
  let current = state;
  const triggered: TriggeredEvent[] = [];

  if (heatResolution.eventTriggerDue) {
    const category = heatResolution.band === 'police' ? 'crackdown' : 'raid';
    const result = triggerEvent(current, rng, content, category);
    current = result.state;
    if (result.event) {
      const activeCrew = current.crew.filter((c) => c.status !== 'dead');
      const actingCrewId = activeCrew.length > 0 ? rng.pick(activeCrew.map((c) => c.id)) : undefined;
      triggered.push({ event: result.event, actingCrewId });
    }
  }

  for (const risk of crewRisks) {
    if (risk.cyberpsychosisRiskDue) {
      const result = triggerEvent(current, rng, content, 'cyberpsychosis');
      current = result.state;
      if (result.event) triggered.push({ event: result.event, actingCrewId: risk.crewId });
    }
    if (risk.loyaltyRiskDue) {
      const result = triggerEvent(current, rng, content, ['betrayal', 'desertion']);
      current = result.state;
      if (result.event) triggered.push({ event: result.event, actingCrewId: risk.crewId });
    }
  }

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

    state = resolveNightEvents(state, result.heatResolution, result.crewRisks, rng);

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
