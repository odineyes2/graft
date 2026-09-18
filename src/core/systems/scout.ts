/**
 * src/core/systems/scout.ts
 *
 * '정찰' 행동 해결 (FR-ACT-01~02, FR-MAP-04 전장의 안개 해제).
 * 순수 TypeScript — Phaser / DOM / window / localStorage 참조 없음.
 * T-13 산출물.
 */

import type { ContentBundle } from '../content/types';
import type { Rng } from '../rng';
import type { ActionOutcome, Assignment, CrewMember, CrewStatus } from '../types';
import { resolveCheck } from './actionCheck';
import type { NightDraft } from './nightDraft';
import { getEffectiveStats } from './stats';

export function resolveScout(
  draft: NightDraft,
  crew: CrewMember,
  assignment: Assignment,
  rng: Rng,
  content: ContentBundle,
): ActionOutcome {
  if (!assignment.targetDistrictId) {
    throw new Error(`scout 행동에는 targetDistrictId가 필요하다 (crew=${crew.id})`);
  }

  const cfg = content.balance.actionResolution;
  const district = draft.getDistrict(assignment.targetDistrictId);
  const stats = getEffectiveStats(crew, content);
  const { successChance, grade } = resolveCheck(rng, stats.stealth, district.defense, cfg);

  let heatDelta = cfg.scoutHeatBase;
  let crewStatusChange: CrewStatus | undefined;

  if (grade === 'success' || grade === 'critical_success') {
    draft.setDistrict({ ...district, scouted: true });
  } else if (grade === 'critical_failure') {
    crewStatusChange = 'arrested';
    heatDelta += cfg.attackHeatBase;
    draft.setCrewMember({ ...crew, status: 'arrested' });
  }

  return {
    crewId: crew.id,
    action: 'scout',
    targetDistrictId: district.id,
    successChance,
    grade,
    creditDelta: 0,
    heatDelta,
    crewStatusChange,
  };
}
