/**
 * src/core/systems/nightEvents.ts
 *
 * advanceNight()가 남긴 "이번 밤 이 카테고리의 이벤트를 띄워야 하는지" 신호
 * (heatResolution.eventTriggerDue, crewRisks)를 받아 실제로 이벤트 카드를
 * 뽑아 state.pendingEventIds에 채운다. 어떤 조직원을 "유발자"로 볼지도
 * 여기서 정한다(폭주·이탈·배신은 그 위험 판정을 받은 조직원, 단속·급습은
 * 배치돼 있던 조직원 중 무작위).
 *
 * 시뮬레이터 봇(T-20 tools/simulateRun.ts)과 플레이어 UI(T-33 NightScene)가
 * 똑같은 규칙으로 이벤트를 뽑아야 결과가 재현 가능하므로 공유 모듈로 둔다.
 * 실제로 어떤 선택지를 고를지(봇 정책 vs 플레이어 입력)는 호출자 몫이다.
 *
 * 순수 TypeScript — Phaser / DOM / window / localStorage 참조 없음.
 * T-33 산출물 (원래 tools/simulateRun.ts에 있던 로직을 core로 승격).
 */

import { content } from '../content/load';
import type { ContentBundle, EventCardDef } from '../content/types';
import type { Rng } from '../rng';
import type { CrewId, RunState } from '../types';
import type { CrewRiskAssessment } from './crewRisk';
import { triggerEvent } from './events';
import type { HeatResolution } from './heat';

export interface TriggeredNightEvent {
  readonly event: EventCardDef;
  /** 이 이벤트를 "유발/처리한" 조직원. actingCrewEffect가 있는 선택지를 고르려면 필요하다. */
  readonly actingCrewId?: CrewId;
}

/**
 * heatResolution·crewRisks를 보고 실제 이벤트 카드를 골라 state에 반영한다.
 * 트리거된 순서대로 반환하므로 호출자는 그 순서대로 카드를 보여주고
 * applyEventChoice()로 선택지를 적용하면 된다.
 */
export function triggerNightEvents(
  state: RunState,
  heatResolution: HeatResolution,
  crewRisks: ReadonlyArray<CrewRiskAssessment>,
  rng: Rng,
  bundle: ContentBundle = content,
): { state: RunState; triggered: ReadonlyArray<TriggeredNightEvent> } {
  let current = state;
  const triggered: TriggeredNightEvent[] = [];

  if (heatResolution.eventTriggerDue) {
    const category = heatResolution.band === 'police' ? 'crackdown' : 'raid';
    const result = triggerEvent(current, rng, bundle, category);
    current = result.state;
    if (result.event) {
      const activeCrew = current.crew.filter((c) => c.status !== 'dead');
      const actingCrewId = activeCrew.length > 0 ? rng.pick(activeCrew.map((c) => c.id)) : undefined;
      triggered.push({ event: result.event, actingCrewId });
    }
  }

  for (const risk of crewRisks) {
    if (risk.cyberpsychosisRiskDue) {
      const result = triggerEvent(current, rng, bundle, 'cyberpsychosis');
      current = result.state;
      if (result.event) triggered.push({ event: result.event, actingCrewId: risk.crewId });
    }
    if (risk.loyaltyRiskDue) {
      const result = triggerEvent(current, rng, bundle, ['betrayal', 'desertion']);
      current = result.state;
      if (result.event) triggered.push({ event: result.event, actingCrewId: risk.crewId });
    }
  }

  if (triggered.length > 0 && current.lastNightReport) {
    current = {
      ...current,
      lastNightReport: {
        ...current.lastNightReport,
        triggeredEventIds: [
          ...current.lastNightReport.triggeredEventIds,
          ...triggered.map((t) => t.event.id),
        ],
      },
    };
  }

  return { state: current, triggered };
}
