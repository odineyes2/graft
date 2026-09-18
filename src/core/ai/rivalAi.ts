/**
 * src/core/ai/rivalAi.ts
 *
 * 경쟁 갱단 AI (FR-AI-01~03). 플레이어 행동 해결 후, 같은 시드 RNG를 이어
 * 써서 결정한다(FR-AI-02) — 호출자가 resolveNight에 쓴 것과 같은 Rng
 * 인스턴스를 넘기면 된다.
 *
 * - 확장형(expansionist): 중립 구역을 우선 노리고, 없으면 플레이어 구역 중
 *   방어가 가장 약한 곳을 노린다.
 * - 공격형(aggressive): 방어가 가장 약한 플레이어 구역을 노린다.
 * - 괴멸된(defeated) 갱단은 행동하지 않는다(FR-AI-03).
 *
 * 순수 TypeScript — Phaser / DOM / window / localStorage 참조 없음.
 * T-18 산출물.
 */

import { content } from '../content/load';
import type { ContentBundle } from '../content/types';
import type { Rng } from '../rng';
import type { District, DistrictId, GangId, NightReport, RivalAction, RivalGang, RunState } from '../types';

export interface RivalActionPlan {
  readonly gangId: GangId;
  readonly targetDistrictId: DistrictId;
}

function pickWeakestDefense(districts: ReadonlyArray<District>): District | undefined {
  return districts.reduce<District | undefined>(
    (weakest, d) => (weakest === undefined || d.defense < weakest.defense ? d : weakest),
    undefined,
  );
}

function pickTarget(state: RunState, rival: RivalGang): DistrictId | null {
  const playerDistricts = state.districts.filter((d) => d.owner === 'player');

  if (rival.personality === 'expansionist') {
    const neutralDistricts = state.districts.filter((d) => d.owner === 'neutral');
    const target = pickWeakestDefense(neutralDistricts) ?? pickWeakestDefense(playerDistricts);
    return target?.id ?? null;
  }

  // aggressive
  return pickWeakestDefense(playerDistricts)?.id ?? null;
}

/** 괴멸되지 않은 갱단마다 이번 밤 노릴 구역을 정한다 (RNG를 쓰지 않는 결정적 규칙). */
export function planRivalActions(state: RunState): RivalActionPlan[] {
  const plans: RivalActionPlan[] = [];
  for (const rival of state.rivals) {
    if (rival.defeated) continue;
    const targetDistrictId = pickTarget(state, rival);
    if (targetDistrictId) plans.push({ gangId: rival.id, targetDistrictId });
  }
  return plans;
}

/**
 * 계획된 공격을 순서대로 해결한다. 방어력이 0 이하로 떨어지면 구역을
 * 점령하고, 이전 소유자가 경쟁 갱단이었다면 그 갱단의 소유 목록에서 빼고
 * 필요하면 괴멸 처리한다(FR-AI-03). state.lastNightReport가 있어야 한다.
 */
export function resolveRivalActions(
  state: RunState,
  rng: Rng,
  bundle: ContentBundle = content,
): { state: RunState; report: NightReport; rivalActions: ReadonlyArray<RivalAction> } {
  if (!state.lastNightReport) {
    throw new Error('resolveRivalActions: resolveNight가 만든 lastNightReport가 없다');
  }

  const cfg = bundle.balance.rivalAi;
  const plans = planRivalActions(state);

  let districts = state.districts;
  let rivals = state.rivals;
  const rivalActions: RivalAction[] = [];

  for (const plan of plans) {
    const district = districts.find((d) => d.id === plan.targetDistrictId);
    if (!district) continue;

    const succeeded = rng.next() < cfg.attackSuccessChance;
    const damage = succeeded ? cfg.damageOnSuccess : cfg.damageOnFailure;
    let newDefense = Math.max(0, district.defense - damage);
    let newOwner = district.owner;

    if (newDefense <= 0) {
      const districtDef = bundle.districts.find((d) => d.id === district.id);
      newDefense = districtDef ? Math.round(districtDef.baseDefense * cfg.capturedDistrictDefenseFraction) : 1;
      const previousOwner = district.owner;
      newOwner = plan.gangId;

      if (previousOwner !== 'neutral' && previousOwner !== 'player' && previousOwner !== plan.gangId) {
        rivals = rivals.map((r) => {
          if (r.id !== previousOwner) return r;
          const controlledDistricts = r.controlledDistricts.filter((id) => id !== district.id);
          return { ...r, controlledDistricts, defeated: controlledDistricts.length === 0 };
        });
      }

      rivals = rivals.map((r) =>
        r.id === plan.gangId ? { ...r, controlledDistricts: [...r.controlledDistricts, district.id] } : r,
      );
    }

    districts = districts.map((d) => (d.id === district.id ? { ...d, defense: newDefense, owner: newOwner } : d));
    rivalActions.push({ gangId: plan.gangId, action: 'attack', targetDistrictId: district.id, succeeded });
  }

  const report: NightReport = { ...state.lastNightReport, rivalActions };
  const newState: RunState = { ...state, districts, rivals, lastNightReport: report };

  return { state: newState, report, rivalActions };
}
