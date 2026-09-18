/**
 * src/core/systems/attack.ts
 *
 * '공격' 행동 해결 (FR-ACT-01~02, FR-MAP-02).
 * 순수 TypeScript — Phaser / DOM / window / localStorage 참조 없음.
 * T-13 산출물.
 */

import type { ContentBundle } from '../content/types';
import type { Rng } from '../rng';
import type { ActionOutcome, Assignment, CrewMember, CrewStatus } from '../types';
import { gradeMultiplier, resolveCheck } from './actionCheck';
import type { NightDraft } from './nightDraft';
import { getEffectiveStats } from './stats';

export function resolveAttack(
  draft: NightDraft,
  crew: CrewMember,
  assignment: Assignment,
  rng: Rng,
  content: ContentBundle,
): ActionOutcome {
  if (!assignment.targetDistrictId) {
    throw new Error(`attack 행동에는 targetDistrictId가 필요하다 (crew=${crew.id})`);
  }

  const cfg = content.balance.actionResolution;
  const district = draft.getDistrict(assignment.targetDistrictId);
  const stats = getEffectiveStats(crew, content);
  const { successChance, grade } = resolveCheck(rng, stats.force, district.defense, cfg);
  const multiplier = gradeMultiplier(grade, cfg);

  const damage = Math.round(stats.force * multiplier);
  let newDefense = Math.max(0, district.defense - damage);
  let newOwner = district.owner;
  let districtOwnerChange: ActionOutcome['districtOwnerChange'];

  if (newDefense <= 0 && district.owner !== 'player') {
    const previousOwner = district.owner;
    const districtDef = content.districts.find((d) => d.id === district.id);
    newDefense = districtDef ? Math.round(districtDef.baseDefense * cfg.capturedDistrictDefenseFraction) : 1;
    newOwner = 'player';
    districtOwnerChange = { districtId: district.id, newOwner: 'player' };

    if (previousOwner !== 'neutral') {
      const rival = draft.getRival(previousOwner);
      if (rival) {
        const remaining = rival.controlledDistricts.filter((id) => id !== district.id);
        draft.setRival({ ...rival, controlledDistricts: remaining, defeated: remaining.length === 0 });
      }
    }
  }

  draft.setDistrict({ ...district, defense: newDefense, owner: newOwner });

  const heatDelta = Math.round(cfg.attackHeatBase * Math.max(multiplier, cfg.minAttemptHeatMultiplier));

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
    action: 'attack',
    targetDistrictId: district.id,
    successChance,
    grade,
    creditDelta: 0,
    heatDelta,
    crewStatusChange,
    districtOwnerChange,
  };
}
