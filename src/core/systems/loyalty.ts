/**
 * src/core/systems/loyalty.ts
 *
 * 충성도 증감 규칙 (FR-CREW-06): 급여 체불, 위험 임무(공격·방어·정찰) 연속
 * 배치, 동료 사망 시 감소한다. 휴식으로 인한 증가는 resolveRest(T-13/T-16)가
 * 직접 처리한다. 보상 이벤트로 인한 증가는 이벤트 시스템(T-17)의 몫이다.
 *
 * resolveNight()가 만든 state·report를 받아 settleDawn()이 실제로 급여를
 * 차감하기 *전에* 호출해야 한다 (체불 여부는 차감 전 크레딧으로 판단한다).
 *
 * 순수 TypeScript — Phaser / DOM / window / localStorage 참조 없음.
 * T-16 산출물.
 */

import { content } from '../content/load';
import type { ContentBundle } from '../content/types';
import type { ActionKind, Assignment, CrewId, NightReport, RunState } from '../types';
import { clamp } from './actionCheck';

const RISKY_ACTIONS: ReadonlySet<ActionKind> = new Set(['attack', 'defend', 'scout']);

function totalWages(state: RunState): number {
  return state.crew.filter((c) => c.status !== 'dead').reduce((sum, c) => sum + c.wagePerNight, 0);
}

function crewWhoDied(report: NightReport): Set<CrewId> {
  const ids = new Set<CrewId>();
  for (const outcome of report.actionOutcomes) {
    if (outcome.crewStatusChange === 'dead') ids.add(outcome.crewId);
  }
  return ids;
}

/**
 * 급여 체불·위험 임무 연속 배치·동료 사망을 반영해 충성도와 연속 배치 카운터를
 * 갱신한다. RNG를 쓰지 않는다 (결정적 규칙 적용).
 */
export function resolveCrewLoyalty(
  state: RunState,
  assignments: ReadonlyArray<Assignment>,
  report: NightReport,
  bundle: ContentBundle = content,
): RunState {
  const cfg = bundle.balance.loyaltySystem;
  const riskyCrewIds = new Set(
    assignments.filter((a) => RISKY_ACTIONS.has(a.action)).map((a) => a.crewId),
  );
  const wageArrears = state.credits < totalWages(state);
  const deaths = crewWhoDied(report);
  const deathPenalty = deaths.size * cfg.crewDeathPenalty;

  const crew = state.crew.map((c) => {
    if (c.status === 'dead') return c;

    const consecutiveRiskyNights = riskyCrewIds.has(c.id) ? c.consecutiveRiskyNights + 1 : 0;

    let loyaltyDelta = 0;
    if (wageArrears) loyaltyDelta -= cfg.wageArrearsPenalty;
    if (consecutiveRiskyNights >= cfg.riskyStreakThreshold) loyaltyDelta -= cfg.riskyStreakPenalty;
    if (deaths.size > 0 && !deaths.has(c.id)) loyaltyDelta -= deathPenalty;

    return {
      ...c,
      consecutiveRiskyNights,
      loyalty: clamp(c.loyalty + loyaltyDelta, 0, 100),
    };
  });

  return { ...state, crew };
}
