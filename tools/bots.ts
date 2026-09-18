/**
 * tools/bots.ts
 *
 * T-20 헤드리스 시뮬레이터용 규칙 기반 봇 2종.
 * - 신중형(careful): 승산이 확실할 때만 공격하고, 열기가 오르면 방어로 돌아선다.
 * - 공격형(aggressive): 승산을 따지지 않고 계속 공격을 밀어붙인다.
 *
 * 이 파일은 개발 도구다 — src/core/는 여전히 순수 TypeScript를 유지하고,
 * 여기서 만드는 "무엇을 배치할지"는 core 함수(advanceNight 등)에 입력으로
 * 넘기는 값일 뿐, core 로직 자체를 바꾸지 않는다.
 */

import type { ContentBundle, EventCardDef } from '../src/core/content/types';
import { computeSuccessChance } from '../src/core/systems/actionCheck';
import { buildBusiness } from '../src/core/systems/business';
import { getEffectiveStats } from '../src/core/systems/stats';
import type { Assignment, BusinessKind, CrewId, CrewMember, District, RunState } from '../src/core/types';

export interface BotConfig {
  readonly name: string;
  /** 이 확률 이상일 때만 공격을 시도한다 (0이면 승산을 따지지 않는다). */
  readonly attackChanceThreshold: number;
  /** 열기가 이 값 이상이면 남은 조직원을 공격 대신 방어로 돌린다. */
  readonly heatCautionThreshold: number;
  /** 지을 사업 우선순위. */
  readonly buildPriority: ReadonlyArray<BusinessKind>;
}

export const CAREFUL_BOT: BotConfig = {
  name: '신중형',
  attackChanceThreshold: 0.65,
  heatCautionThreshold: 40,
  buildPriority: ['protection', 'clinic'],
};

export const AGGRESSIVE_BOT: BotConfig = {
  name: '공격형',
  attackChanceThreshold: 0,
  heatCautionThreshold: 101, // 사실상 항상 공격을 계속한다
  buildPriority: ['protection', 'arena'],
};

function pickWeakestDefense(districts: ReadonlyArray<District>): District | undefined {
  return districts.reduce<District | undefined>(
    (weakest, d) => (weakest === undefined || d.defense < weakest.defense ? d : weakest),
    undefined,
  );
}

/**
 * 성장 단계: 지을 수 있는 사업을 크레딧과 빈 슬롯이 허락하는 한 계속 짓는다
 * (FR-TURN-01 "낮" 단계 일부). 같은 구역에 같은 종류를 두 번 지어도 된다 —
 * 조직원을 놀리는 것보다 운영할 사업을 늘리는 편이 낫다.
 */
export function tryBuildBusiness(state: RunState, bot: BotConfig, bundle: ContentBundle): RunState {
  let current = state;

  for (;;) {
    const playerDistricts = current.districts.filter((d) => d.owner === 'player');
    let built = false;

    for (const district of playerDistricts) {
      const hasEmptySlot = district.businessSlots.some((slot) => slot === null);
      if (!hasEmptySlot) continue;

      const affordableKind = bot.buildPriority.find((kind) => {
        const def = bundle.businesses.find((b) => b.kind === kind);
        return def !== undefined && current.credits >= def.buildCost;
      });
      if (!affordableKind) continue;

      current = buildBusiness(current, district.id, affordableKind, bundle);
      built = true;
      break;
    }

    if (!built) return current;
  }
}

/** 밤 배치를 결정한다. */
export function decideAssignments(state: RunState, bot: BotConfig, bundle: ContentBundle): Assignment[] {
  const activeCrew = state.crew.filter((c) => c.status === 'active');
  const usedCrewIds = new Set<CrewId>();
  const assignments: Assignment[] = [];
  const cfg = bundle.balance.actionResolution;

  function takeStrongest(): CrewMember | undefined {
    const candidates = activeCrew.filter((c) => !usedCrewIds.has(c.id));
    if (candidates.length === 0) return undefined;
    return candidates.reduce((best, c) => (c.baseStats.force > best.baseStats.force ? c : best));
  }

  // 1. 지어진 사업마다 관련 능력치가 가장 높은 조직원을 운영에 배치한다.
  for (const business of state.businesses) {
    const businessDef = bundle.businesses.find((b) => b.kind === business.kind);
    if (!businessDef) continue;

    const remaining = activeCrew.filter((c) => !usedCrewIds.has(c.id));
    if (remaining.length === 0) break;

    const hackerCandidates =
      businessDef.specialEffect === 'requires_hacker' ? remaining.filter((c) => c.traitIds.includes('hacker')) : remaining;
    const pool = hackerCandidates.length > 0 ? hackerCandidates : remaining;

    const chosen = pool.reduce((best, c) => {
      const bestStat = getEffectiveStats(best, bundle)[businessDef.requiredStat];
      const cStat = getEffectiveStats(c, bundle)[businessDef.requiredStat];
      return cStat > bestStat ? c : best;
    });

    assignments.push({
      crewId: chosen.id,
      action: 'operate',
      targetDistrictId: business.districtId,
      targetBusinessId: business.id,
    });
    usedCrewIds.add(chosen.id);
  }

  // 2. 공격 여부 판단 (열기가 낮을 때만).
  if (state.heat < bot.heatCautionThreshold) {
    const target = pickWeakestDefense(state.districts.filter((d) => d.owner !== 'player'));
    const attacker = takeStrongest();
    if (target && attacker) {
      const stats = getEffectiveStats(attacker, bundle);
      const chance = computeSuccessChance(stats.force, target.defense, cfg);
      if (chance >= bot.attackChanceThreshold) {
        assignments.push({ crewId: attacker.id, action: 'attack', targetDistrictId: target.id });
        usedCrewIds.add(attacker.id);
      }
    }
  }

  // 3. 남은 조직원: 열기가 높으면 방어, 아니면 휴식.
  for (const crew of activeCrew) {
    if (usedCrewIds.has(crew.id)) continue;

    if (state.heat >= bot.heatCautionThreshold) {
      const weakestOwned = pickWeakestDefense(state.districts.filter((d) => d.owner === 'player'));
      if (weakestOwned) {
        assignments.push({ crewId: crew.id, action: 'defend', targetDistrictId: weakestOwned.id });
        continue;
      }
    }

    assignments.push({ crewId: crew.id, action: 'rest' });
  }

  return assignments;
}

/** 이벤트 선택지 하나를 고른다: 조직원이 죽는 선택지는 피한다. */
export function pickEventChoice(event: EventCardDef, hasActingCrew: boolean): string {
  const safeChoices = event.choices.filter(
    (c) => (hasActingCrew || !c.effect.actingCrewEffect) && c.effect.actingCrewEffect?.statusChange !== 'dead',
  );
  const pool = safeChoices.length > 0 ? safeChoices : event.choices;
  return pool[0]!.choiceKey;
}
