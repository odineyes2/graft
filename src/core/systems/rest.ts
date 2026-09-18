/**
 * src/core/systems/rest.ts
 *
 * '휴식' 행동 해결 (FR-CREW-03: 인간성 소폭 회복, FR-CREW-06: 휴식으로 충성도 회복).
 * 위험이 없는 행동이라 확률 판정 없이 항상 성공으로 처리한다. 부상 회복은
 * 부상 상태 조직원에게 매 밤 자동으로 적용되므로(resolveNight의
 * applyInjuryRecovery) 여기서는 다루지 않는다.
 *
 * 순수 TypeScript — Phaser / DOM / window / localStorage 참조 없음.
 * T-13/T-16 산출물.
 */

import type { ContentBundle } from '../content/types';
import type { ActionOutcome, CrewMember } from '../types';
import type { NightDraft } from './nightDraft';

export function resolveRest(draft: NightDraft, crew: CrewMember, content: ContentBundle): ActionOutcome {
  const cfg = content.balance.actionResolution;
  const newHumanity = Math.min(100, crew.humanity + cfg.restHumanityRecovery);
  const newLoyalty = Math.min(100, crew.loyalty + content.balance.loyaltySystem.restLoyaltyBonus);
  draft.setCrewMember({ ...crew, humanity: newHumanity, loyalty: newLoyalty });

  return {
    crewId: crew.id,
    action: 'rest',
    successChance: 1,
    grade: 'success',
    creditDelta: 0,
    heatDelta: 0,
  };
}
