/**
 * tests/nightEvents.test.ts
 *
 * T-33: triggerNightEvents가 heatResolution·crewRisks 신호를 보고 실제
 * 이벤트 카드를 뽑아 pendingEventIds/triggered를 채우는지 확인한다.
 */

import { describe, expect, it } from 'vitest';
import { content } from '../src/core/content/load';
import type { ContentBundle, EventCardDef } from '../src/core/content/types';
import { createInitialRunState } from '../src/core/initialState';
import { createRng } from '../src/core/rng';
import type { CrewRiskAssessment } from '../src/core/systems/crewRisk';
import type { HeatResolution } from '../src/core/systems/heat';
import { triggerNightEvents } from '../src/core/systems/nightEvents';
import { crewId, eventId } from '../src/core/types';
import type { RunState } from '../src/core/types';

const noRisk = (state: RunState): CrewRiskAssessment[] =>
  state.crew.map((c) => ({ crewId: c.id, cyberpsychosisRiskDue: false, loyaltyRiskDue: false }));

const quietHeat: HeatResolution = { band: 'quiet', decayApplied: 0, eventTriggerDue: false, lockdown: false };

function fixtureBundle(events: EventCardDef[]): ContentBundle {
  return { ...content, events };
}

function withLastNightReport(state: RunState): RunState {
  return {
    ...state,
    lastNightReport: {
      night: state.night,
      actionOutcomes: [],
      rivalActions: [],
      incomeTotal: 0,
      expenseTotal: 0,
      triggeredEventIds: [],
      heatDelta: 0,
      reputationDelta: 0,
    },
  };
}

const crackdownEvent: EventCardDef = {
  id: eventId('fixture_crackdown'),
  category: 'crackdown',
  portraitKey: 'p',
  textKey: 'k',
  condition: {},
  weight: 10,
  choices: [{ choiceKey: 'a', effect: {} }],
};

const raidEvent: EventCardDef = {
  id: eventId('fixture_raid'),
  category: 'raid',
  portraitKey: 'p',
  textKey: 'k',
  condition: {},
  weight: 10,
  choices: [{ choiceKey: 'a', effect: {} }],
};

const cyberpsychosisEvent: EventCardDef = {
  id: eventId('fixture_cyberpsychosis'),
  category: 'cyberpsychosis',
  portraitKey: 'p',
  textKey: 'k',
  condition: {},
  weight: 10,
  choices: [{ choiceKey: 'a', effect: {} }],
};

const desertionEvent: EventCardDef = {
  id: eventId('fixture_desertion'),
  category: 'desertion',
  portraitKey: 'p',
  textKey: 'k',
  condition: {},
  weight: 10,
  choices: [{ choiceKey: 'a', effect: {} }],
};

describe('T-33 triggerNightEvents: 열기 구간 트리거', () => {
  it('eventTriggerDue가 false면 아무 이벤트도 트리거하지 않는다', () => {
    const state = withLastNightReport(createInitialRunState('t33-heat-none'));
    const bundle = fixtureBundle([crackdownEvent, raidEvent]);

    const { triggered } = triggerNightEvents(state, quietHeat, noRisk(state), createRng('rng'), bundle);
    expect(triggered).toHaveLength(0);
  });

  it("band이 'police'면 crackdown 카테고리를 트리거한다", () => {
    const state = withLastNightReport(createInitialRunState('t33-heat-police'));
    const bundle = fixtureBundle([crackdownEvent, raidEvent]);
    const heat: HeatResolution = { band: 'police', decayApplied: 0, eventTriggerDue: true, lockdown: false };

    const { triggered } = triggerNightEvents(state, heat, noRisk(state), createRng('rng'), bundle);
    expect(triggered).toHaveLength(1);
    expect(triggered[0]?.event.id).toBe(crackdownEvent.id);
  });

  it("band이 'raid' 또는 'lockdown'이면 raid 카테고리를 트리거한다", () => {
    const state = withLastNightReport(createInitialRunState('t33-heat-raid'));
    const bundle = fixtureBundle([crackdownEvent, raidEvent]);
    const heat: HeatResolution = { band: 'raid', decayApplied: 0, eventTriggerDue: true, lockdown: false };

    const { triggered } = triggerNightEvents(state, heat, noRisk(state), createRng('rng'), bundle);
    expect(triggered).toHaveLength(1);
    expect(triggered[0]?.event.id).toBe(raidEvent.id);
  });

  it('트리거된 이벤트에는 배치된 조직원 중에서 고른 actingCrewId가 있다', () => {
    const state = withLastNightReport(createInitialRunState('t33-heat-acting'));
    const bundle = fixtureBundle([crackdownEvent]);
    const heat: HeatResolution = { band: 'police', decayApplied: 0, eventTriggerDue: true, lockdown: false };

    const { triggered } = triggerNightEvents(state, heat, noRisk(state), createRng('rng'), bundle);
    const activeIds = state.crew.filter((c) => c.status !== 'dead').map((c) => c.id);
    expect(triggered[0]?.actingCrewId).toBeDefined();
    expect(activeIds).toContain(triggered[0]!.actingCrewId);
  });
});

describe('T-33 triggerNightEvents: 조직원 위험 트리거 (FR-CREW-05~06)', () => {
  it('cyberpsychosisRiskDue인 조직원마다 폭주 이벤트를 그 조직원 기준으로 트리거한다', () => {
    const state = withLastNightReport(createInitialRunState('t33-crew-cyberpsychosis'));
    const bundle = fixtureBundle([cyberpsychosisEvent]);
    const risks: CrewRiskAssessment[] = [
      { crewId: crewId('boss'), cyberpsychosisRiskDue: true, loyaltyRiskDue: false },
    ];

    const { triggered } = triggerNightEvents(state, quietHeat, risks, createRng('rng'), bundle);
    expect(triggered).toHaveLength(1);
    expect(triggered[0]?.event.id).toBe(cyberpsychosisEvent.id);
    expect(triggered[0]?.actingCrewId).toBe(crewId('boss'));
  });

  it('loyaltyRiskDue인 조직원마다 배신/이탈 이벤트를 그 조직원 기준으로 트리거한다', () => {
    const state = withLastNightReport(createInitialRunState('t33-crew-loyalty'));
    const bundle = fixtureBundle([desertionEvent]);
    const risks: CrewRiskAssessment[] = [
      { crewId: crewId('crew_01'), cyberpsychosisRiskDue: false, loyaltyRiskDue: true },
    ];

    const { triggered } = triggerNightEvents(state, quietHeat, risks, createRng('rng'), bundle);
    expect(triggered).toHaveLength(1);
    expect(triggered[0]?.event.id).toBe(desertionEvent.id);
    expect(triggered[0]?.actingCrewId).toBe(crewId('crew_01'));
  });

  it('여러 조직원이 동시에 위험 상태면 여러 이벤트가 순서대로 트리거된다', () => {
    const state = withLastNightReport(createInitialRunState('t33-crew-multi'));
    const bundle = fixtureBundle([cyberpsychosisEvent, desertionEvent]);
    const risks: CrewRiskAssessment[] = [
      { crewId: crewId('boss'), cyberpsychosisRiskDue: true, loyaltyRiskDue: false },
      { crewId: crewId('crew_01'), cyberpsychosisRiskDue: false, loyaltyRiskDue: true },
    ];

    const { triggered } = triggerNightEvents(state, quietHeat, risks, createRng('rng'), bundle);
    expect(triggered).toHaveLength(2);
    expect(triggered.map((t) => t.event.id)).toEqual([cyberpsychosisEvent.id, desertionEvent.id]);
  });
});

describe('T-33 triggerNightEvents: 리포트·상태 반영', () => {
  it('트리거된 이벤트 ID를 lastNightReport.triggeredEventIds에 남긴다', () => {
    const state = withLastNightReport(createInitialRunState('t33-report'));
    const bundle = fixtureBundle([crackdownEvent]);
    const heat: HeatResolution = { band: 'police', decayApplied: 0, eventTriggerDue: true, lockdown: false };

    const { state: after } = triggerNightEvents(state, heat, noRisk(state), createRng('rng'), bundle);
    expect(after.lastNightReport?.triggeredEventIds).toContain(crackdownEvent.id);
  });

  it('트리거된 이벤트를 pendingEventIds 대기열에 넣는다', () => {
    const state = withLastNightReport(createInitialRunState('t33-pending'));
    const bundle = fixtureBundle([crackdownEvent]);
    const heat: HeatResolution = { band: 'police', decayApplied: 0, eventTriggerDue: true, lockdown: false };

    const { state: after } = triggerNightEvents(state, heat, noRisk(state), createRng('rng'), bundle);
    expect(after.pendingEventIds).toContain(crackdownEvent.id);
  });

  it('같은 상태·신호·시드면 같은 결과가 나온다 (NFR-02)', () => {
    const state = withLastNightReport(createInitialRunState('t33-determinism'));
    const bundle = fixtureBundle([crackdownEvent, cyberpsychosisEvent]);
    const heat: HeatResolution = { band: 'police', decayApplied: 0, eventTriggerDue: true, lockdown: false };
    const risks: CrewRiskAssessment[] = [
      { crewId: crewId('boss'), cyberpsychosisRiskDue: true, loyaltyRiskDue: false },
    ];

    const a = triggerNightEvents(state, heat, risks, createRng('shared-seed'), bundle);
    const b = triggerNightEvents(state, heat, risks, createRng('shared-seed'), bundle);
    expect(a.state).toEqual(b.state);
    expect(a.triggered).toEqual(b.triggered);
  });
});
