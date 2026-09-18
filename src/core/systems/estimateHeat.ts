/**
 * src/core/systems/estimateHeat.ts
 *
 * 배치 확정 전 예상 열기 증가량 계산 (FR-HEAT-02).
 * RNG를 소비하지 않는다 — 아직 굴리지 않은 확률을 등급별 기댓값으로
 * 미리 보여주는 용도다. 실제 결과는 resolveNight()가 RNG로 정한다.
 *
 * 순수 TypeScript — Phaser / DOM / window / localStorage 참조 없음.
 * T-15 산출물.
 */

import { content } from '../content/load';
import type { ActionResolutionConfig, ContentBundle } from '../content/types';
import type { Assignment, RunState } from '../types';
import { computeGradeProbabilities, computeSuccessChance } from './actionCheck';
import { getEffectiveStats } from './stats';

function expectedGradeMultiplier(successChance: number, cfg: ActionResolutionConfig): number {
  const probs = computeGradeProbabilities(successChance, cfg);
  return (
    probs.critical_success * cfg.gradeMultiplier.critical_success +
    probs.success * cfg.gradeMultiplier.success +
    probs.failure * cfg.gradeMultiplier.failure +
    probs.critical_failure * cfg.gradeMultiplier.critical_failure
  );
}

/** 배치 하나가 이번 밤 발생시킬 것으로 예상되는 열기 증가량. */
export function estimateAssignmentHeat(
  state: RunState,
  assignment: Assignment,
  bundle: ContentBundle = content,
): number {
  const cfg = bundle.balance.actionResolution;
  const crew = state.crew.find((c) => c.id === assignment.crewId);
  if (!crew) throw new Error(`존재하지 않는 조직원: ${assignment.crewId}`);

  if (assignment.action === 'rest') return 0;
  if (assignment.action === 'defend') return cfg.defendHeatBase;

  const stats = getEffectiveStats(crew, bundle);

  if (assignment.action === 'attack' || assignment.action === 'scout') {
    if (!assignment.targetDistrictId) return 0;
    const district = state.districts.find((d) => d.id === assignment.targetDistrictId);
    if (!district) throw new Error(`존재하지 않는 구역: ${assignment.targetDistrictId}`);

    if (assignment.action === 'attack') {
      const successChance = computeSuccessChance(stats.force, district.defense, cfg);
      const expectedMultiplier = expectedGradeMultiplier(successChance, cfg);
      return Math.round(cfg.attackHeatBase * Math.max(expectedMultiplier, cfg.minAttemptHeatMultiplier));
    }

    // scout
    const successChance = computeSuccessChance(stats.stealth, district.defense, cfg);
    const probs = computeGradeProbabilities(successChance, cfg);
    return Math.round(cfg.scoutHeatBase + cfg.attackHeatBase * probs.critical_failure);
  }

  // operate
  if (!assignment.targetBusinessId) return 0;
  const business = state.businesses.find((b) => b.id === assignment.targetBusinessId);
  if (!business) throw new Error(`존재하지 않는 사업: ${assignment.targetBusinessId}`);
  const businessDef = bundle.businesses.find((b) => b.kind === business.kind);
  if (!businessDef) throw new Error(`사업 정의가 없다: ${business.kind}`);
  const districtDef = bundle.districts.find((d) => d.id === business.districtId);
  if (!districtDef) throw new Error(`존재하지 않는 구역: ${business.districtId}`);

  const levelIndex = business.level - 1;
  const baseHeat = businessDef.heatPerLevel[levelIndex];

  if (businessDef.specialEffect === 'requires_hacker' && !crew.traitIds.includes('hacker')) {
    return Math.round(baseHeat * cfg.minAttemptHeatMultiplier * districtDef.heatMultiplier);
  }

  const difficulty = cfg.operateDifficultyBase + levelIndex * cfg.operateDifficultyPerLevel;
  const successChance = computeSuccessChance(stats[businessDef.requiredStat], difficulty, cfg);
  const expectedMultiplier = expectedGradeMultiplier(successChance, cfg);
  return Math.round(baseHeat * Math.max(expectedMultiplier, cfg.minAttemptHeatMultiplier) * districtDef.heatMultiplier);
}

/** 이번 밤 배치 전체가 발생시킬 것으로 예상되는 총 열기 증가량 (지도 화면 미리보기, FR-HEAT-02). */
export function estimateNightHeatIncrease(
  state: RunState,
  assignments: ReadonlyArray<Assignment>,
  bundle: ContentBundle = content,
): number {
  return assignments.reduce((sum, a) => sum + estimateAssignmentHeat(state, a, bundle), 0);
}
