/**
 * src/core/systems/operate.ts
 *
 * '운영' 행동 해결 (FR-ACT-01~02, FR-BIZ-03).
 * 배치된 조직원의 사업 관련 능력치가 수입에 반영된다.
 * 순수 TypeScript — Phaser / DOM / window / localStorage 참조 없음.
 * T-13 산출물.
 */

import type { ContentBundle } from '../content/types';
import type { Rng } from '../rng';
import type { ActionOutcome, Assignment, CrewMember, CrewStatus } from '../types';
import { gradeMultiplier, resolveCheck } from './actionCheck';
import type { NightDraft } from './nightDraft';
import { getEffectiveStats } from './stats';

export function resolveOperate(
  draft: NightDraft,
  crew: CrewMember,
  assignment: Assignment,
  rng: Rng,
  content: ContentBundle,
): ActionOutcome {
  if (!assignment.targetBusinessId) {
    throw new Error(`operate 행동에는 targetBusinessId가 필요하다 (crew=${crew.id})`);
  }

  const business = draft.getBusiness(assignment.targetBusinessId);
  if (!business) {
    throw new Error(`존재하지 않는 사업: ${assignment.targetBusinessId}`);
  }

  const businessDef = content.businesses.find((b) => b.kind === business.kind);
  if (!businessDef) {
    throw new Error(`사업 정의가 없다: ${business.kind}`);
  }

  const cfg = content.balance.actionResolution;
  const districtDef = content.districts.find((d) => d.id === business.districtId);
  if (!districtDef) {
    throw new Error(`존재하지 않는 구역: ${business.districtId}`);
  }

  const levelIndex = business.level - 1;
  const baseIncome = businessDef.incomePerLevel[levelIndex];
  const baseHeat = businessDef.heatPerLevel[levelIndex];

  // FR-BIZ-01 "해커 배치 필수": 해커 특성이 없는 조직원을 배치하면 자동 실패로 취급한다.
  if (businessDef.specialEffect === 'requires_hacker' && !crew.traitIds.includes('hacker')) {
    const heatDelta = Math.round(baseHeat * cfg.minAttemptHeatMultiplier * districtDef.heatMultiplier);
    return {
      crewId: crew.id,
      action: 'operate',
      targetDistrictId: business.districtId,
      targetBusinessId: business.id,
      successChance: 0,
      grade: 'failure',
      creditDelta: 0,
      heatDelta,
    };
  }

  const stats = getEffectiveStats(crew, content);
  const statValue = stats[businessDef.requiredStat];
  const difficulty = cfg.operateDifficultyBase + levelIndex * cfg.operateDifficultyPerLevel;
  const { successChance, grade } = resolveCheck(rng, statValue, difficulty, cfg);
  const multiplier = gradeMultiplier(grade, cfg);

  let income = baseIncome * multiplier * districtDef.incomeMultiplier;
  if (businessDef.specialEffect === 'reputation_scaled_income') {
    income *= 1 + (draft.reputation / 100) * cfg.reputationIncomeScale;
  }
  income = Math.round(income);

  const heatDelta = Math.round(
    baseHeat * Math.max(multiplier, cfg.minAttemptHeatMultiplier) * districtDef.heatMultiplier,
  );

  let crewStatusChange: CrewStatus | undefined;
  if (grade === 'critical_failure') {
    crewStatusChange = 'arrested';
    draft.setCrewMember({ ...crew, status: 'arrested' });
  }

  if (businessDef.specialEffect === 'reputation_gain' && (grade === 'success' || grade === 'critical_success')) {
    const gain = cfg.arenaReputationGain * (grade === 'critical_success' ? 2 : 1);
    draft.reputation += gain;
  }

  return {
    crewId: crew.id,
    action: 'operate',
    targetDistrictId: business.districtId,
    targetBusinessId: business.id,
    successChance,
    grade,
    creditDelta: income,
    heatDelta,
    crewStatusChange,
  };
}
