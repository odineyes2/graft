/**
 * tests/bots.test.ts
 *
 * T-20 산출물인 규칙 기반 봇(tools/bots.ts)의 배치·건설·이벤트 선택 로직을
 * 검증한다.
 */

import { describe, expect, it } from 'vitest';
import { content } from '../src/core/content/load';
import type { EventCardDef } from '../src/core/content/types';
import { createInitialRunState } from '../src/core/initialState';
import { businessId, districtId, eventId } from '../src/core/types';
import type { Business, RunState } from '../src/core/types';
import {
  AGGRESSIVE_BOT,
  CAREFUL_BOT,
  decideAssignments,
  pickEventChoice,
  tryBuildBusiness,
} from '../tools/bots';

function withDistrictDefense(state: RunState, id: string, defense: number): RunState {
  return { ...state, districts: state.districts.map((d) => (d.id === districtId(id) ? { ...d, defense } : d)) };
}

describe('T-20 사업 건설 정책', () => {
  it('크레딧과 빈 슬롯이 허락하는 한 계속 짓는다', () => {
    const state = createInitialRunState('bot-build-loop');
    const after = tryBuildBusiness(state, CAREFUL_BOT, content);

    // 슬럼 슬롯 2개가 모두 채워질 때까지 지어야 한다 (시작 크레딧 500, protection 200×2=400)
    const slums = after.districts.find((d) => d.id === districtId('slums'))!;
    expect(slums.businessSlots.every((slot) => slot !== null)).toBe(true);
    expect(after.businesses).toHaveLength(2);
    expect(after.credits).toBeLessThan(state.credits);
  });

  it('빈 슬롯이 없거나 크레딧이 부족하면 더 짓지 않는다', () => {
    const base = createInitialRunState('bot-build-stop');
    const poor = { ...base, credits: 0 };
    const after = tryBuildBusiness(poor, CAREFUL_BOT, content);
    expect(after.businesses).toHaveLength(0);
    expect(after.credits).toBe(0);
  });
});

describe('T-20 배치 정책', () => {
  it('같은 조직원을 두 행동에 배치하지 않는다', () => {
    let state = createInitialRunState('bot-no-double');
    state = tryBuildBusiness(state, CAREFUL_BOT, content);

    const assignments = decideAssignments(state, CAREFUL_BOT, content);
    const crewIds = assignments.map((a) => a.crewId);
    expect(new Set(crewIds).size).toBe(crewIds.length);
  });

  it('지어진 사업이 있으면 운영에 조직원을 배치한다', () => {
    const base = createInitialRunState('bot-operate');
    const business: Business = {
      id: businessId('biz_test'),
      kind: 'protection',
      districtId: districtId('slums'),
      level: 1,
    };
    const state = { ...base, businesses: [business] };

    const assignments = decideAssignments(state, CAREFUL_BOT, content);
    expect(assignments.some((a) => a.action === 'operate' && a.targetBusinessId === business.id)).toBe(true);
  });

  it('신중형 봇은 승산이 낮으면(attackChanceThreshold 미만) 공격하지 않는다', () => {
    // 방어력을 아주 높게 두어 승산을 거의 0으로 만든다.
    const state = withDistrictDefense(createInitialRunState('bot-careful-no-attack'), 'nightclub_row', 500);
    const alsoHigh = withDistrictDefense(state, 'harbor', 500);
    const evenMore = withDistrictDefense(alsoHigh, 'factory_district', 500);
    const final = withDistrictDefense(evenMore, 'corporate_zone', 500);
    // underground_market은 갱단 소유라 그대로 두되, 그것도 매우 방어가 강하게 만든다.
    const allHigh = withDistrictDefense(final, 'underground_market', 500);

    const assignments = decideAssignments(allHigh, CAREFUL_BOT, content);
    expect(assignments.some((a) => a.action === 'attack')).toBe(false);
  });

  it('공격형 봇은 승산과 무관하게(threshold 0) 공격을 시도한다', () => {
    const state = withDistrictDefense(createInitialRunState('bot-aggressive-attack'), 'harbor', 500);
    const assignments = decideAssignments(state, AGGRESSIVE_BOT, content);
    expect(assignments.some((a) => a.action === 'attack')).toBe(true);
  });

  it('열기가 heatCautionThreshold 이상이면 신중형 봇은 남은 조직원을 방어로 돌린다', () => {
    const base = createInitialRunState('bot-careful-defend');
    const state = { ...base, heat: CAREFUL_BOT.heatCautionThreshold };

    const assignments = decideAssignments(state, CAREFUL_BOT, content);
    expect(assignments.some((a) => a.action === 'attack')).toBe(false);
    expect(assignments.some((a) => a.action === 'defend')).toBe(true);
  });
});

describe('T-20 이벤트 선택 정책', () => {
  const fatalChoiceEvent: EventCardDef = {
    id: eventId('fixture_fatal'),
    category: 'desertion',
    portraitKey: 'p',
    textKey: 'k',
    condition: {},
    weight: 1,
    choices: [
      { choiceKey: 'safe', effect: { creditDelta: -10 } },
      { choiceKey: 'fatal', effect: { actingCrewEffect: { statusChange: 'dead' } } },
    ],
  };

  it('조직원이 죽는 선택지가 있으면 피한다', () => {
    const choice = pickEventChoice(fatalChoiceEvent, true);
    expect(choice).toBe('safe');
  });

  it('대상 조직원이 없으면 actingCrewEffect가 필요 없는 선택지를 고른다', () => {
    const needsCrewEvent: EventCardDef = {
      id: eventId('fixture_needs_crew'),
      category: 'betrayal',
      portraitKey: 'p',
      textKey: 'k',
      condition: {},
      weight: 1,
      choices: [
        { choiceKey: 'needs_crew', effect: { actingCrewEffect: { loyaltyDelta: -5 } } },
        { choiceKey: 'no_crew_needed', effect: { heatDelta: 5 } },
      ],
    };
    const choice = pickEventChoice(needsCrewEvent, false);
    expect(choice).toBe('no_crew_needed');
  });

  it('안전한 선택지가 없으면 첫 번째 선택지로 돌아간다', () => {
    const onlyFatalEvent: EventCardDef = {
      id: eventId('fixture_only_fatal'),
      category: 'desertion',
      portraitKey: 'p',
      textKey: 'k',
      condition: {},
      weight: 1,
      choices: [{ choiceKey: 'only', effect: { actingCrewEffect: { statusChange: 'dead' } } }],
    };
    expect(pickEventChoice(onlyFatalEvent, true)).toBe('only');
  });
});
