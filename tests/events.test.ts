/**
 * tests/events.test.ts
 *
 * T-17 완료 조건: 조건 필터링 → 가중치 선택 → 선택지 효과 적용이 동작한다.
 * 같은 밤에 같은 이벤트가 중복 발생하지 않는다 (FR-EVT-01~03).
 */

import { describe, expect, it } from 'vitest';
import { content } from '../src/core/content/load';
import type { ContentBundle, EventCardDef } from '../src/core/content/types';
import { createInitialRunState } from '../src/core/initialState';
import { createRng } from '../src/core/rng';
import {
  applyEventChoice,
  filterEligibleEvents,
  matchesCondition,
  pickWeightedEvent,
  resetFiredEventsForNewNight,
  triggerEvent,
} from '../src/core/systems/events';
import { crewId, districtId, eventId } from '../src/core/types';
import type { RunState } from '../src/core/types';

function findEvent(id: string): EventCardDef {
  const event = content.events.find((e) => e.id === eventId(id));
  if (!event) throw new Error(`fixture event not found: ${id}`);
  return event;
}

function withHeat(state: RunState, heat: number): RunState {
  return { ...state, heat };
}

function withDistrictOwner(state: RunState, id: string, owner: RunState['districts'][number]['owner']): RunState {
  return { ...state, districts: state.districts.map((d) => (d.id === districtId(id) ? { ...d, owner } : d)) };
}

describe('T-17 조건 필터링 (FR-EVT-02)', () => {
  it('heatRange 조건은 열기가 구간 안일 때만 참이다', () => {
    const event = findEvent('evt_crackdown_bribe_check'); // heatRange [40, 69]
    const base = createInitialRunState('t17-heat-range');
    expect(matchesCondition(withHeat(base, 39), event)).toBe(false);
    expect(matchesCondition(withHeat(base, 40), event)).toBe(true);
    expect(matchesCondition(withHeat(base, 69), event)).toBe(true);
    expect(matchesCondition(withHeat(base, 70), event)).toBe(false);
  });

  it('minDistrictsOwned 조건은 소유 구역 수가 충분할 때만 참이다', () => {
    const event = findEvent('evt_recruit_offer_specialist'); // minDistrictsOwned: 2
    const base = createInitialRunState('t17-min-districts'); // 슬럼 1개만 소유
    expect(matchesCondition(base, event)).toBe(false);

    const withSecond = withDistrictOwner(base, 'harbor', 'player');
    expect(matchesCondition(withSecond, event)).toBe(true);
  });

  it('requiresDistrict 조건은 그 구역을 소유해야 참이다', () => {
    const event = findEvent('evt_raid_corporate_zone'); // requiresDistrict: corporate_zone
    const base = withHeat(createInitialRunState('t17-requires-district'), 80);
    expect(matchesCondition(base, event)).toBe(false);

    const owned = withDistrictOwner(base, 'corporate_zone', 'player');
    expect(matchesCondition(owned, event)).toBe(true);
  });

  it('filterEligibleEvents는 카테고리와 조건을 모두 만족하는 이벤트만 남긴다', () => {
    const state = withHeat(createInitialRunState('t17-filter-category'), 45);
    const eligible = filterEligibleEvents(state, content, 'crackdown');
    expect(eligible.length).toBeGreaterThan(0);
    for (const event of eligible) {
      expect(event.category).toBe('crackdown');
    }
  });

  it('firedEventIdsThisNight에 있는 이벤트는 후보에서 제외된다', () => {
    const base = withHeat(createInitialRunState('t17-dedup-filter'), 45);
    const alreadyFired = findEvent('evt_crackdown_bribe_check');
    const state: RunState = { ...base, firedEventIdsThisNight: [alreadyFired.id] };

    const eligible = filterEligibleEvents(state, content, 'crackdown');
    expect(eligible.some((e) => e.id === alreadyFired.id)).toBe(false);
  });
});

describe('T-17 가중치 선택', () => {
  it('후보가 없으면 undefined를 반환한다', () => {
    expect(pickWeightedEvent(createRng('empty'), [])).toBeUndefined();
  });

  it('같은 시드면 같은 이벤트가 뽑힌다', () => {
    const state = withHeat(createInitialRunState('t17-weighted-repro'), 45);
    const candidates = filterEligibleEvents(state, content, 'crackdown');
    const a = pickWeightedEvent(createRng('pick-seed'), candidates);
    const b = pickWeightedEvent(createRng('pick-seed'), candidates);
    expect(a?.id).toBe(b?.id);
  });
});

describe('T-17 이벤트 트리거와 중복 방지 (FR-EVT-03)', () => {
  function makeFixtureBundle(events: EventCardDef[]): ContentBundle {
    return { ...content, events };
  }

  const soleEvent: EventCardDef = {
    id: eventId('fixture_only_event'),
    category: 'deal_offer',
    portraitKey: 'p',
    textKey: 'k',
    condition: {},
    weight: 10,
    choices: [
      { choiceKey: 'a', effect: {} },
      { choiceKey: 'b', effect: {} },
    ],
  };

  it('조건에 맞는 이벤트를 대기열과 이번 밤 발생 기록에 넣는다', () => {
    const state = createInitialRunState('t17-trigger-basic');
    const bundle = makeFixtureBundle([soleEvent]);

    const { state: after, event } = triggerEvent(state, createRng('trigger-1'), bundle, 'deal_offer');

    expect(event?.id).toBe(soleEvent.id);
    expect(after.pendingEventIds).toContain(soleEvent.id);
    expect(after.firedEventIdsThisNight).toContain(soleEvent.id);
  });

  it('후보가 없으면 event가 null이고 상태가 바뀌지 않는다', () => {
    const state = withHeat(createInitialRunState('t17-trigger-none'), 10); // quiet 구간
    const { state: after, event } = triggerEvent(state, createRng('trigger-2'), content, 'crackdown');
    expect(event).toBeNull();
    expect(after).toBe(state);
  });

  it('같은 밤에 유일한 후보를 이미 뽑았다면 다시 트리거해도 null이다', () => {
    const state = createInitialRunState('t17-trigger-dedup');
    const bundle = makeFixtureBundle([soleEvent]);

    const first = triggerEvent(state, createRng('dedup-1'), bundle, 'deal_offer');
    expect(first.event?.id).toBe(soleEvent.id);

    const second = triggerEvent(first.state, createRng('dedup-2'), bundle, 'deal_offer');
    expect(second.event).toBeNull();
  });

  it('resetFiredEventsForNewNight 이후에는 다시 같은 이벤트가 뽑힐 수 있다', () => {
    const state = createInitialRunState('t17-trigger-reset');
    const bundle = makeFixtureBundle([soleEvent]);

    const first = triggerEvent(state, createRng('reset-1'), bundle, 'deal_offer');
    const resetState = resetFiredEventsForNewNight(first.state);
    expect(resetState.firedEventIdsThisNight).toHaveLength(0);

    const second = triggerEvent(resetState, createRng('reset-2'), bundle, 'deal_offer');
    expect(second.event?.id).toBe(soleEvent.id);
  });
});

describe('T-17 선택지 효과 적용 (FR-EVT-01)', () => {
  it('크레딧·열기·평판 변화가 반영되고 이벤트가 대기열에서 빠진다', () => {
    const event = findEvent('evt_crackdown_bribe_check');
    const base = createInitialRunState('t17-apply-basic');
    const state: RunState = { ...base, pendingEventIds: [event.id] };

    const after = applyEventChoice(state, event, 'events.evt_crackdown_bribe_check.choice_bribe');

    expect(after.credits).toBe(state.credits - 150);
    expect(after.heat).toBe(Math.max(0, state.heat - 10));
    expect(after.pendingEventIds).not.toContain(event.id);
  });

  it('actingCrewEffect가 있으면 지정한 조직원에게만 적용된다', () => {
    const event = findEvent('evt_crackdown_bribe_check');
    const base = createInitialRunState('t17-apply-crew');
    const state: RunState = { ...base, pendingEventIds: [event.id] };

    const after = applyEventChoice(state, event, 'events.evt_crackdown_bribe_check.choice_refuse', {
      actingCrewId: crewId('crew_01'),
    });

    const crew01 = after.crew.find((c) => c.id === crewId('crew_01'))!;
    const crew02 = after.crew.find((c) => c.id === crewId('crew_02'))!;
    expect(crew01.status).toBe('arrested');
    expect(crew02.status).toBe('active');
  });

  it('actingCrewEffect가 있는데 actingCrewId를 주지 않으면 에러를 던진다', () => {
    const event = findEvent('evt_crackdown_bribe_check');
    const state = createInitialRunState('t17-apply-missing-crew');
    expect(() => applyEventChoice(state, event, 'events.evt_crackdown_bribe_check.choice_refuse')).toThrow();
  });

  it('존재하지 않는 선택지 키를 주면 에러를 던진다', () => {
    const event = findEvent('evt_crackdown_bribe_check');
    const state = createInitialRunState('t17-apply-bad-choice');
    expect(() => applyEventChoice(state, event, 'not_a_real_choice')).toThrow();
  });

  it('체인 이벤트가 있으면 대기열에 이어 넣는다', () => {
    const chainedEvent: EventCardDef = {
      id: eventId('fixture_chain_parent'),
      category: 'deal_offer',
      portraitKey: 'p',
      textKey: 'k',
      condition: {},
      weight: 10,
      choices: [{ choiceKey: 'go', effect: { chainEventId: eventId('fixture_chain_child') } }],
    };
    const state = createInitialRunState('t17-apply-chain');
    const withPending: RunState = { ...state, pendingEventIds: [chainedEvent.id] };

    const after = applyEventChoice(withPending, chainedEvent, 'go');
    expect(after.pendingEventIds).not.toContain(chainedEvent.id);
    expect(after.pendingEventIds).toContain(eventId('fixture_chain_child'));
  });

  it('열기와 평판은 0~100 범위로 클램프된다', () => {
    const lowHeatChoice: EventCardDef = {
      id: eventId('fixture_clamp_event'),
      category: 'deal_offer',
      portraitKey: 'p',
      textKey: 'k',
      condition: {},
      weight: 10,
      choices: [{ choiceKey: 'go', effect: { heatDelta: -999, reputationDelta: 999 } }],
    };
    const state = createInitialRunState('t17-apply-clamp');
    const after = applyEventChoice(state, lowHeatChoice, 'go');
    expect(after.heat).toBe(0);
    expect(after.reputation).toBe(100);
  });
});
