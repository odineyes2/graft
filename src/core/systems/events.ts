/**
 * src/core/systems/events.ts
 *
 * 이벤트 시스템 (FR-EVT-01~03): 조건 필터링 → 가중치 선택 → 선택지 효과 적용.
 * 열기 구간(T-15 resolveHeat)·조직원 위험(T-16 assessCrewRisks)이 "이번 밤
 * 이벤트를 띄워야 하는지"를 판정해 두면, 이 모듈이 실제로 어떤 카드를
 * 고르고 그 선택지 효과를 상태에 반영하는 일을 한다.
 *
 * 순수 TypeScript — Phaser / DOM / window / localStorage 참조 없음.
 * T-17 산출물.
 */

import { content } from '../content/load';
import type { ContentBundle, EventCardDef, EventCategory } from '../content/types';
import type { Rng } from '../rng';
import type { CrewId, RunState } from '../types';
import { clamp } from './actionCheck';

/** 이벤트의 발생 조건(EventConditionDef)이 현재 상태에서 참인지 (FR-EVT-02). */
export function matchesCondition(state: RunState, event: EventCardDef): boolean {
  const { condition } = event;

  if (condition.heatRange) {
    const [min, max] = condition.heatRange;
    if (state.heat < min || state.heat > max) return false;
  }

  if (condition.minDistrictsOwned !== undefined) {
    const owned = state.districts.filter((d) => d.owner === 'player').length;
    if (owned < condition.minDistrictsOwned) return false;
  }

  if (condition.requiresDistrict) {
    const district = state.districts.find((d) => d.id === condition.requiresDistrict);
    if (!district || district.owner !== 'player') return false;
  }

  return true;
}

/**
 * 조건을 만족하고, 카테고리가 주어졌다면 그 카테고리에 속하며, 이번 밤에 아직
 * 뽑히지 않은 이벤트 목록 (FR-EVT-02, FR-EVT-03 중복 방지).
 */
export function filterEligibleEvents(
  state: RunState,
  bundle: ContentBundle = content,
  category?: EventCategory | ReadonlyArray<EventCategory>,
): EventCardDef[] {
  const categories =
    category === undefined ? undefined : Array.isArray(category) ? category : [category];
  const fired = new Set(state.firedEventIdsThisNight);

  return bundle.events.filter(
    (event) =>
      !fired.has(event.id) &&
      (categories === undefined || categories.includes(event.category)) &&
      matchesCondition(state, event),
  );
}

/** 후보 이벤트 중 하나를 weight에 비례한 확률로 고른다. 후보가 없으면 undefined. */
export function pickWeightedEvent(
  rng: Rng,
  events: ReadonlyArray<EventCardDef>,
): EventCardDef | undefined {
  if (events.length === 0) return undefined;
  return rng.weightedPick(events.map((event) => ({ item: event, weight: event.weight })));
}

/**
 * 조건에 맞는 이벤트 중 하나를 골라 대기열(pendingEventIds)에 넣고, 이번 밤
 * 발생 기록(firedEventIdsThisNight)에 남긴다. 후보가 없으면 event가 null이다.
 */
export function triggerEvent(
  state: RunState,
  rng: Rng,
  bundle: ContentBundle = content,
  category?: EventCategory | ReadonlyArray<EventCategory>,
): { state: RunState; event: EventCardDef | null } {
  const eligible = filterEligibleEvents(state, bundle, category);
  const picked = pickWeightedEvent(rng, eligible);
  if (!picked) return { state, event: null };

  return {
    state: {
      ...state,
      pendingEventIds: [...state.pendingEventIds, picked.id],
      firedEventIdsThisNight: [...state.firedEventIdsThisNight, picked.id],
    },
    event: picked,
  };
}

export interface ApplyEventChoiceOptions {
  /** 선택지 효과에 actingCrewEffect가 있을 때 적용 대상 조직원 */
  readonly actingCrewId?: CrewId;
}

/**
 * 플레이어가 고른 선택지의 효과를 상태에 반영하고, 그 이벤트를 대기열에서
 * 뺀다. 체인 이벤트(chainEventId)가 있으면 대기열에 이어 넣는다.
 */
export function applyEventChoice(
  state: RunState,
  event: EventCardDef,
  choiceKey: string,
  options: ApplyEventChoiceOptions = {},
): RunState {
  const choice = event.choices.find((c) => c.choiceKey === choiceKey);
  if (!choice) {
    throw new Error(`이벤트 '${event.id}'에 선택지 '${choiceKey}'가 없다`);
  }

  const { effect } = choice;
  const credits = state.credits + (effect.creditDelta ?? 0);
  const heat = clamp(state.heat + (effect.heatDelta ?? 0), 0, 100);
  const reputation = clamp(state.reputation + (effect.reputationDelta ?? 0), 0, 100);

  let crew = state.crew;
  if (effect.actingCrewEffect) {
    if (!options.actingCrewId) {
      throw new Error(`이벤트 '${event.id}' 선택지 '${choiceKey}'는 actingCrewId가 필요하다`);
    }
    const { humanityDelta, loyaltyDelta, statusChange } = effect.actingCrewEffect;
    const targetId = options.actingCrewId;
    crew = state.crew.map((c) =>
      c.id === targetId
        ? {
            ...c,
            humanity: clamp(c.humanity + (humanityDelta ?? 0), 0, 100),
            loyalty: clamp(c.loyalty + (loyaltyDelta ?? 0), 0, 100),
            status: statusChange ?? c.status,
          }
        : c,
    );
  }

  let pendingEventIds = state.pendingEventIds.filter((id) => id !== event.id);
  if (effect.chainEventId && !pendingEventIds.includes(effect.chainEventId)) {
    pendingEventIds = [...pendingEventIds, effect.chainEventId];
  }

  return { ...state, credits, heat, reputation, crew, pendingEventIds };
}

/** 새 밤이 시작될 때 "이번 밤 이미 발생한 이벤트" 기록을 초기화한다 (FR-EVT-03). */
export function resetFiredEventsForNewNight(state: RunState): RunState {
  return { ...state, firedEventIdsThisNight: [] };
}
