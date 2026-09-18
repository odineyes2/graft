/**
 * tests/business.test.ts
 *
 * buildBusiness()가 사업을 짓고 건설 비용을 차감하는지 확인한다.
 * FR-BIZ-02, T-20이 시뮬레이터에 수입원을 만들어 주기 위해 추가했다.
 */

import { describe, expect, it } from 'vitest';
import { content } from '../src/core/content/load';
import { createInitialRunState } from '../src/core/initialState';
import { buildBusiness } from '../src/core/systems/business';
import { districtId } from '../src/core/types';

describe('T-20 사업 건설 (FR-BIZ-02)', () => {
  it('빈 슬롯에 사업을 짓고 건설 비용을 차감한다', () => {
    const state = createInitialRunState('t20-build-basic');
    const def = content.businesses.find((b) => b.kind === 'protection')!;

    const after = buildBusiness(state, districtId('slums'), 'protection');

    expect(after.credits).toBe(state.credits - def.buildCost);
    expect(after.businesses).toHaveLength(1);
    expect(after.businesses[0]!.kind).toBe('protection');
    expect(after.businesses[0]!.level).toBe(1);
    expect(after.businesses[0]!.districtId).toBe(districtId('slums'));

    const district = after.districts.find((d) => d.id === districtId('slums'))!;
    expect(district.businessSlots).toContain(after.businesses[0]!.id);
  });

  it('같은 구역·슬롯이면 항상 같은 ID가 나온다 (결정론)', () => {
    const state = createInitialRunState('t20-build-deterministic');
    const a = buildBusiness(state, districtId('slums'), 'protection');
    const freshState = createInitialRunState('t20-build-deterministic');
    const b = buildBusiness(freshState, districtId('slums'), 'protection');
    expect(a.businesses[0]!.id).toBe(b.businesses[0]!.id);
  });

  it('플레이어가 소유하지 않은 구역에는 지을 수 없다', () => {
    const state = createInitialRunState('t20-build-not-owned');
    expect(() => buildBusiness(state, districtId('harbor'), 'protection')).toThrow(/소유한 구역/);
  });

  it('빈 슬롯이 없으면 에러를 던진다', () => {
    let state = createInitialRunState('t20-build-full');
    state = { ...state, credits: 10_000 }; // 건설 비용 부족으로 실패하지 않도록 넉넉히 준다
    state = buildBusiness(state, districtId('slums'), 'protection');
    state = buildBusiness(state, districtId('slums'), 'clinic'); // 슬럼 슬롯 2개 모두 채움
    expect(() => buildBusiness(state, districtId('slums'), 'arena')).toThrow(/빈 사업 슬롯/);
  });

  it('크레딧이 부족하면 에러를 던진다', () => {
    const base = createInitialRunState('t20-build-poor');
    const state = { ...base, credits: 0 };
    expect(() => buildBusiness(state, districtId('slums'), 'protection')).toThrow(/부족/);
  });
});
