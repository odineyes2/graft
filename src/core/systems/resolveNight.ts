/**
 * src/core/systems/resolveNight.ts
 *
 * 한 밤(FR-TURN-01의 "밤: 실행" 단계)을 해결하는 순수 함수.
 * 배치(Assignment[])를 받아 행동별 해결 모듈에 위임하고, 결과를 모아
 * NightReport를 만든다. 경제 결산(T-14)·열기 자연 감소(T-15)·이벤트
 * 발생(T-17)·경쟁 갱 AI(T-18)·승패 판정(T-19)은 이후 단계의 책임이며
 * 여기서는 다루지 않는다.
 *
 * 순수 TypeScript — Phaser / DOM / window / localStorage 참조 없음.
 * Math.random() 사용 금지, 모든 무작위성은 인자로 받은 Rng를 통한다.
 *
 * T-13 산출물.
 */

import { content } from '../content/load';
import type { Rng } from '../rng';
import type { ActionOutcome, Assignment, CrewId, NightReport, RunState } from '../types';
import { resolveAttack } from './attack';
import { resolveDefend } from './defend';
import { NightDraft } from './nightDraft';
import { resolveOperate } from './operate';
import { resolveRest } from './rest';
import { resolveScout } from './scout';

/** 부상 조직원의 밤별 자동 회복 (FR-CREW-04). 배치 여부와 무관하게 항상 적용된다. */
function applyInjuryRecovery(draft: NightDraft, state: RunState): void {
  for (const crew of state.crew) {
    if (crew.status !== 'injured') continue;
    const remaining = Math.max(0, crew.injuredNightsRemaining - 1);
    draft.setCrewMember({
      ...crew,
      injuredNightsRemaining: remaining,
      status: remaining === 0 ? 'active' : 'injured',
    });
  }
}

function validateAssignments(state: RunState, assignments: ReadonlyArray<Assignment>): void {
  const seen = new Set<CrewId>();

  for (const assignment of assignments) {
    if (seen.has(assignment.crewId)) {
      throw new Error(`조직원 '${assignment.crewId}'가 두 가지 행동에 배치됐다 (FR-CREW-03 위반)`);
    }
    seen.add(assignment.crewId);

    const crew = state.crew.find((c) => c.id === assignment.crewId);
    if (!crew) {
      throw new Error(`존재하지 않는 조직원 배치: ${assignment.crewId}`);
    }
    if (crew.status !== 'active') {
      throw new Error(
        `조직원 '${assignment.crewId}'는 상태 '${crew.status}'라 배치할 수 없다 (FR-CREW-04)`,
      );
    }

    if (assignment.action === 'operate') {
      if (!assignment.targetBusinessId || !assignment.targetDistrictId) {
        throw new Error(`operate 배치에는 targetBusinessId와 targetDistrictId가 모두 필요하다`);
      }
      const business = state.businesses.find((b) => b.id === assignment.targetBusinessId);
      if (!business) {
        throw new Error(`존재하지 않는 사업 배치: ${assignment.targetBusinessId}`);
      }
      if (business.districtId !== assignment.targetDistrictId) {
        throw new Error(
          `사업 '${business.id}'는 구역 '${business.districtId}'에 있는데 targetDistrictId가 '${assignment.targetDistrictId}'다`,
        );
      }
    } else if (assignment.action === 'attack' || assignment.action === 'defend' || assignment.action === 'scout') {
      if (!assignment.targetDistrictId) {
        throw new Error(`${assignment.action} 배치에는 targetDistrictId가 필요하다`);
      }
    }
  }
}

/**
 * 배치를 해결해 새 RunState와 NightReport를 만든다.
 * 같은 state·assignments·rng 시퀀스면 항상 같은 결과가 나온다 (NFR-02).
 */
export function resolveNight(
  state: RunState,
  assignments: ReadonlyArray<Assignment>,
  rng: Rng,
): { state: RunState; report: NightReport } {
  validateAssignments(state, assignments);

  const draft = new NightDraft(state);
  applyInjuryRecovery(draft, state);

  const actionOutcomes: ActionOutcome[] = [];

  for (const assignment of assignments) {
    const crew = draft.getCrewMember(assignment.crewId);
    let outcome: ActionOutcome;

    switch (assignment.action) {
      case 'operate':
        outcome = resolveOperate(draft, crew, assignment, rng, content);
        break;
      case 'attack':
        outcome = resolveAttack(draft, crew, assignment, rng, content);
        break;
      case 'defend':
        outcome = resolveDefend(draft, crew, assignment, rng, content);
        break;
      case 'scout':
        outcome = resolveScout(draft, crew, assignment, rng, content);
        break;
      case 'rest':
        outcome = resolveRest(draft, crew, content);
        break;
    }

    draft.credits += outcome.creditDelta;
    draft.heat += outcome.heatDelta;
    actionOutcomes.push(outcome);
  }

  const incomeTotal = actionOutcomes
    .filter((o) => o.creditDelta > 0)
    .reduce((sum, o) => sum + o.creditDelta, 0);
  const heatDelta = actionOutcomes.reduce((sum, o) => sum + o.heatDelta, 0);

  const report: NightReport = {
    night: state.night,
    actionOutcomes,
    rivalActions: [],
    incomeTotal,
    expenseTotal: 0,
    triggeredEventIds: [],
    heatDelta,
    reputationDelta: draft.reputation - state.reputation,
  };

  const newState: RunState = {
    ...draft.toState(),
    phase: 'dawn',
    currentAssignments: [],
    lastNightReport: report,
  };

  return { state: newState, report };
}
