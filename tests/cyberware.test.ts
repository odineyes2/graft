/**
 * tests/cyberware.test.ts
 *
 * T-16 완료 조건: 사이버웨어 이식에 따른 능력치·인간성 변화가 동작한다 (FR-CREW-05).
 */

import { describe, expect, it } from 'vitest';
import { content } from '../src/core/content/load';
import { createInitialRunState } from '../src/core/initialState';
import { implantCyberware } from '../src/core/systems/cyberware';
import { getEffectiveStats } from '../src/core/systems/stats';
import { crewId, cyberwareId } from '../src/core/types';

describe('T-16 사이버웨어 이식 (FR-CREW-05)', () => {
  it('이식하면 인간성이 이식 비용만큼 줄어든다', () => {
    const state = createInitialRunState('t16-implant');
    const crew = state.crew.find((c) => c.id === crewId('crew_01'))!;
    const def = content.cyberware.find((c) => c.id === cyberwareId('cyber_arm'))!;

    const updated = implantCyberware(crew, def.id);
    expect(updated.humanity).toBe(crew.humanity - def.humanityCost);
  });

  it('인간성은 0 밑으로 내려가지 않는다', () => {
    const state = createInitialRunState('t16-implant-floor');
    const lowHumanity = { ...state.crew.find((c) => c.id === crewId('crew_01'))!, humanity: 5 };
    const def = content.cyberware.find((c) => c.id === cyberwareId('wetware_suite'))!; // humanityCost 25

    const updated = implantCyberware(lowHumanity, def.id);
    expect(updated.humanity).toBe(0);
  });

  it('이식 후 유효 능력치에 보너스가 반영된다 (baseStats는 그대로)', () => {
    const state = createInitialRunState('t16-implant-stats');
    const crew = state.crew.find((c) => c.id === crewId('crew_01'))!;
    const def = content.cyberware.find((c) => c.id === cyberwareId('cyber_arm'))!; // force +2

    const updated = implantCyberware(crew, def.id);
    expect(updated.baseStats).toEqual(crew.baseStats);

    const before = getEffectiveStats(crew, content);
    const after = getEffectiveStats(updated, content);
    expect(after.force).toBe(before.force + (def.statBonus.force ?? 0));
  });

  it('같은 사이버웨어를 두 번 이식하면 에러를 던진다', () => {
    const state = createInitialRunState('t16-implant-dup');
    const crew = state.crew.find((c) => c.id === crewId('crew_01'))!;
    const cyberwareIdToUse = cyberwareId('cyber_arm');

    const once = implantCyberware(crew, cyberwareIdToUse);
    expect(() => implantCyberware(once, cyberwareIdToUse)).toThrow();
  });

  it('존재하지 않는 사이버웨어를 이식하면 에러를 던진다', () => {
    const state = createInitialRunState('t16-implant-missing');
    const crew = state.crew.find((c) => c.id === crewId('crew_01'))!;
    expect(() => implantCyberware(crew, cyberwareId('does_not_exist'))).toThrow();
  });
});
