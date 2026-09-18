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
 * 능력치 대 난이도로 성공 확률을 구하고, RNG 한 번으로 결과 등급을 정한다.
 * successChance = clamp(baseChance + (effectiveStat - difficulty) * statCoefficient, min, max)
 */
export function resolveCheck(
  rng: Rng,
  effectiveStat: number,
  difficulty: number,
  cfg: ActionResolutionConfig,
): CheckResult {
  const raw = cfg.baseChance + (effectiveStat - difficulty) * cfg.statCoefficient;
  const successChance = clamp(raw, cfg.minChance, cfg.maxChance);
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
