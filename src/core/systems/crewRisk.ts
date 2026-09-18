/**
 * src/core/systems/crewRisk.ts
 *
 * 인간성·충성도 위험 판정 (FR-CREW-05, FR-CREW-06).
 * 인간성이 humanityRiskThreshold 미만이면 매 밤 폭주 위험이, 충성도가
 * loyaltyRiskThreshold 미만이면 매 밤 이탈·배신 위험이 생긴다. 여기서는
 * "이번 밤 그 위험이 실제로 발동하는지"만 판정한다 — 어떤 이벤트 카드가
 * 뽑히는지는 이벤트 시스템(T-17)의 몫이다 (T-15 resolveHeat와 같은 패턴).
 *
 * 순수 TypeScript — Phaser / DOM / window / localStorage 참조 없음.
 * T-16 산출물.
 */

import { content } from '../content/load';
import type { ContentBundle } from '../content/types';
import type { Rng } from '../rng';
import type { CrewId, RunState } from '../types';

export interface CrewRiskAssessment {
  readonly crewId: CrewId;
  /** 인간성이 낮아 이번 밤 폭주 이벤트가 발동하는지 (FR-CREW-05) */
  readonly cyberpsychosisRiskDue: boolean;
  /** 충성도가 낮아 이번 밤 이탈·배신 이벤트가 발동하는지 (FR-CREW-06) */
  readonly loyaltyRiskDue: boolean;
}

/**
 * 상태('dead' 제외)의 모든 조직원에 대해 위험 발동 여부를 판정한다.
 * 위험 구간이 아닌 조직원은 RNG를 소비하지 않는다.
 */
export function assessCrewRisks(
  state: RunState,
  rng: Rng,
  bundle: ContentBundle = content,
): CrewRiskAssessment[] {
  const cfg = bundle.balance.crewRiskSystem;

  return state.crew
    .filter((c) => c.status !== 'dead')
    .map((c) => {
      const cyberpsychosisRiskDue =
        c.humanity < cfg.humanityRiskThreshold && rng.next() < cfg.humanityRiskChance;
      const loyaltyRiskDue = c.loyalty < cfg.loyaltyRiskThreshold && rng.next() < cfg.loyaltyRiskChance;

      return { crewId: c.id, cyberpsychosisRiskDue, loyaltyRiskDue };
    });
}
