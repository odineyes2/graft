/**
 * src/core/systems/actionCheck.ts
 *
 * 행동 성공 확률·결과 등급 판정 공식 (FR-ACT-01, FR-ACT-02).
 * 계수는 src/data/balance.json의 actionResolution에서 온다.
 *
 * 순수 TypeScript — Phaser / DOM / window / localStorage 참조 없음.
 * T-13 산출물.
 */

import type { ActionResolutionConfig } from '../content/types';
import type { Rng } from '../rng';
import type { OutcomeGrade } from '../types';

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export interface CheckResult {
  readonly successChance: number;
  readonly grade: OutcomeGrade;
}

/**
 * 능력치 대 난이도로 성공 확률만 구한다 (RNG 소비 없음).
 * successChance = clamp(baseChance + (effectiveStat - difficulty) * statCoefficient, min, max)
 * 배치 확정 전 미리보기(FR-HEAT-02)처럼 실제로 굴리지 않고 확률만 필요할 때 쓴다.
 */
export function computeSuccessChance(
  effectiveStat: number,
  difficulty: number,
  cfg: ActionResolutionConfig,
): number {
  const raw = cfg.baseChance + (effectiveStat - difficulty) * cfg.statCoefficient;
  return clamp(raw, cfg.minChance, cfg.maxChance);
}

/** successChance 안에서 각 결과 등급이 나올 확률. */
export interface GradeProbabilities {
  readonly critical_success: number;
  readonly success: number;
  readonly failure: number;
  readonly critical_failure: number;
}

export function computeGradeProbabilities(successChance: number, cfg: ActionResolutionConfig): GradeProbabilities {
  return {
    critical_success: successChance * cfg.criticalSuccessRatio,
    success: successChance * (1 - cfg.criticalSuccessRatio),
    failure: (1 - successChance) * (1 - cfg.criticalFailureRatio),
    critical_failure: (1 - successChance) * cfg.criticalFailureRatio,
  };
}

/**
 * 능력치 대 난이도로 성공 확률을 구하고, RNG 한 번으로 결과 등급을 정한다.
 */
export function resolveCheck(
  rng: Rng,
  effectiveStat: number,
  difficulty: number,
  cfg: ActionResolutionConfig,
): CheckResult {
  const successChance = computeSuccessChance(effectiveStat, difficulty, cfg);
  const roll = rng.next();

  let grade: OutcomeGrade;
  if (roll < successChance) {
    grade = roll / successChance < cfg.criticalSuccessRatio ? 'critical_success' : 'success';
  } else {
    const failRoll = (roll - successChance) / (1 - successChance);
    grade = failRoll < cfg.criticalFailureRatio ? 'critical_failure' : 'failure';
  }

  return { successChance, grade };
}

/** 결과 등급에 대응하는 배수 (수입·피해량 등에 곱한다). */
export function gradeMultiplier(grade: OutcomeGrade, cfg: ActionResolutionConfig): number {
  return cfg.gradeMultiplier[grade];
}
