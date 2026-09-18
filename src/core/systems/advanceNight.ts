/**
 * src/core/systems/advanceNight.ts
 *
 * 한 밤 전체를 순서대로 해결하는 조립 함수. T-13~T-19가 각자 만든 시스템을
 * FR-TURN-01의 순서(밤 실행 → 새벽 결산 → 열기 → 승패 판정)대로 이어 붙인다.
 *
 * 이벤트는 "이번 밤에 어떤 카테고리의 이벤트를 띄워야 하는지"까지만
 * 결정하고(T-15 열기 구간, T-16 조직원 위험), 실제로 어떤 선택지를 고를지는
 * 다루지 않는다 — 사람 플레이어는 화면에서 고르고(T-33), 시뮬레이터
 * 봇(T-20 tools/sim.ts)은 자기 정책대로 고른다. 그래서 이 함수는
 * pendingEventIds를 채워 넣을 수는 있어도 비우지는 않는다; 호출자가
 * applyEventChoice()로 마저 처리해야 한다.
 *
 * 순수 TypeScript — Phaser / DOM / window / localStorage 참조 없음.
 * T-20 산출물.
 */

import { content } from '../content/load';
import type { ContentBundle } from '../content/types';
import type { Rng } from '../rng';
import type { Assignment, NightReport, RunState } from '../types';
import { resolveRivalActions } from '../ai/rivalAi';
import type { CrewRiskAssessment } from './crewRisk';
import { assessCrewRisks } from './crewRisk';
import { resetFiredEventsForNewNight } from './events';
import type { HeatResolution } from './heat';
import { resolveHeat } from './heat';
import { resolveCrewLoyalty } from './loyalty';
import { resolveNight } from './resolveNight';
import { applyRunEnd, trackDistrictPeak } from './runEnd';
import { settleDawn } from './settleDawn';

export interface AdvanceNightResult {
  readonly state: RunState;
  readonly report: NightReport;
  readonly heatResolution: HeatResolution;
  readonly crewRisks: ReadonlyArray<CrewRiskAssessment>;
}

/**
 * assignments(이번 밤 배치)를 받아 밤 실행 → 경쟁 갱 AI → 충성도 → 새벽
 * 결산 → 열기 → 위험 판정 → 구역 소유 최댓값 갱신 → 승패 판정까지 한 번에
 * 처리한다. 런이 끝나지 않았으면 다음 밤 계획 단계로 넘어가도록 night을
 * 올리고 phase를 'planning'으로 되돌린다.
 */
export function advanceNight(
  state: RunState,
  assignments: ReadonlyArray<Assignment>,
  rng: Rng,
  bundle: ContentBundle = content,
): AdvanceNightResult {
  let current = resetFiredEventsForNewNight(state);

  const nightResult = resolveNight(current, assignments, rng);
  current = nightResult.state;

  const rivalResult = resolveRivalActions(current, rng, bundle);
  current = rivalResult.state;

  current = resolveCrewLoyalty(current, assignments, current.lastNightReport ?? nightResult.report, bundle);

  const dawnResult = settleDawn(current, bundle);
  current = dawnResult.state;

  const heatResult = resolveHeat(current, rng, bundle);
  current = heatResult.state;

  const crewRisks = assessCrewRisks(current, rng, bundle);

  current = trackDistrictPeak(current);
  current = applyRunEnd(current, bundle);

  current = current.ended
    ? { ...current, phase: 'ended' }
    : { ...current, night: current.night + 1, phase: 'planning' };

  return {
    state: current,
    report: current.lastNightReport ?? dawnResult.report,
    heatResolution: heatResult.heatResolution,
    crewRisks,
  };
}
