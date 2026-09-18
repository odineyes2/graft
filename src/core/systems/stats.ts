/**
 * src/core/systems/stats.ts
 *
 * 장착 사이버웨어 보정을 반영한 조직원 유효 능력치 계산.
 * 순수 TypeScript — Phaser / DOM / window / localStorage 참조 없음.
 *
 * T-13 산출물.
 */

import type { ContentBundle } from '../content/types';
import type { CrewMember, StatBlock } from '../types';

const STAT_KEYS: ReadonlyArray<keyof StatBlock> = ['force', 'tech', 'negotiation', 'stealth'];

/** 기본 능력치 + 장착한 모든 사이버웨어의 statBonus 합산. */
export function getEffectiveStats(crew: CrewMember, content: ContentBundle): StatBlock {
  const result: StatBlock = { ...crew.baseStats };

  for (const cyberwareId of crew.cyberwareIds) {
    const def = content.cyberware.find((c) => c.id === cyberwareId);
    if (!def) continue;
    for (const key of STAT_KEYS) {
      result[key] += def.statBonus[key] ?? 0;
    }
  }

  return result;
}
