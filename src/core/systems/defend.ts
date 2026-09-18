/**
 * src/core/systems/defend.ts
 *
 * '방어' 행동 해결 (FR-ACT-01~02).
 * 순수 TypeScript — Phaser / DOM / window / localStorage 참조 없음.
 * T-13 산출물.
 */

import type { ContentBundle } from '../content/types';
import type { Rng } from '../rng';
import type { ActionOutcome, Assignment, CrewMember, CrewStatus } from '../types';
import { gradeMultiplier, resolveCheck } from './actionCheck';
import type { NightDraft } from './nightDraft';
import { getEffectiveStats } from './stats';

export function resolveDefend(
  draft: NightDraft,
  crew: CrewMember,
  assignment: Assignment,
  rng: Rng,
  content: ContentBundle,
): ActionOutcome {
  if (!assignment.targetDistrictId) {
    throw new Error(`defend 행동에는 targetDistrictId가 필요하다 (crew=${crew.id})`);
  }

  const cfg = content.balance.actionResolution;
  const district = draft.getDistrict(assignment.targetDistrictId);
  if (district.owner !== 'player') {
    throw new Error(`방어는 플레이어가 소유한 구역에서만 가능하다: ${district.id}`);
  }

  const stats = getEffectiveStats(crew, content);
  const { successChance, grade } = resolveCheck(rng, stats.force, cfg.defendBaseDifficulty, cfg);
  const multiplier = gradeMultiplier(grade, cfg);

  const boost = Math.max(0, Math.round(stats.force * multiplier));
  const districtDef = content.districts.find((d) => d.id === district.id);
  const maxDefense = districtDef
    ? Math.round(districtDef.baseDefense * cfg.maxDistrictDefenseMultiplier)
    : district.defense + boost;
  const newDefense = Math.min(maxDefense, district.defense + boost);
  draft.setDistrict({ ...district, defense: newDefense });

  let crewStatusChange: CrewStatus | undefined;
  if (grade === 'critical_failure') {
    crewStatusChange = rng.next() < cfg.deathChanceOnCriticalFailure ? 'dead' : 'injured';
    draft.setCrewMember({
      ...crew,
      status: crewStatusChange,
      injuredNightsRemaining: crewStatusChange === 'injured' ? cfg.injuryNights : crew.injuredNightsRemaining,
    });
  }

  return {
    crewId: crew.id,
    action: 'defend',
    targetDistrictId: district.id,
    successChance,
    grade,
    creditDelta: 0,
    heatDelta: cfg.defendHeatBase,
    crewStatusChange,
  };
}
