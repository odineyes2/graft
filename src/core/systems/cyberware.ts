/**
 * src/core/systems/cyberware.ts
 *
 * 사이버웨어 이식 (FR-CREW-05): 능력치 보너스는 장착 목록만으로 결정되므로
 * (getEffectiveStats, T-13) baseStats는 건드리지 않고, 이식 대가인 인간성
 * 감소만 여기서 처리한다.
 *
 * 순수 TypeScript — Phaser / DOM / window / localStorage 참조 없음.
 * T-16 산출물.
 */

import { content } from '../content/load';
import type { ContentBundle } from '../content/types';
import type { CrewMember, CyberwareId } from '../types';
import { clamp } from './actionCheck';

/** 조직원에게 사이버웨어를 이식한다. 능력치는 그대로 두고 인간성만 깎는다. */
export function implantCyberware(
  crew: CrewMember,
  cyberwareId: CyberwareId,
  bundle: ContentBundle = content,
): CrewMember {
  const def = bundle.cyberware.find((c) => c.id === cyberwareId);
  if (!def) {
    throw new Error(`존재하지 않는 사이버웨어: ${cyberwareId}`);
  }
  if (crew.cyberwareIds.includes(cyberwareId)) {
    throw new Error(`조직원 '${crew.id}'는 이미 '${cyberwareId}'를 장착했다`);
  }

  return {
    ...crew,
    cyberwareIds: [...crew.cyberwareIds, cyberwareId],
    humanity: clamp(crew.humanity - def.humanityCost, 0, 100),
  };
}
