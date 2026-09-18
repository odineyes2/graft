/**
 * src/core/systems/business.ts
 *
 * 사업 건설 (FR-BIZ-02, FR-TURN-01의 "낮: 성장" 단계).
 * 밤 해결(T-13)이 이미 건설된 사업의 "운영"만 다루므로, 그 사업을
 * 애초에 만드는 함수가 없으면 T-20 헤드리스 시뮬레이터가 수입을 낼 수
 * 없다. 업그레이드·사이버웨어 구매·조직원 영입 같은 나머지 "낮" 단계
 * 행동은 UI(T-36)에서 함께 다룰 몫으로 남겨 둔다.
 *
 * 순수 TypeScript — Phaser / DOM / window / localStorage 참조 없음.
 * T-20 산출물.
 */

import { content } from '../content/load';
import type { ContentBundle } from '../content/types';
import { businessId } from '../types';
import type { Business, BusinessKind, DistrictId, RunState } from '../types';

/**
 * 플레이어가 소유한 구역의 빈 슬롯에 사업을 짓는다. 건설 비용을 크레딧에서
 * 뺀다. 빈 슬롯이 없거나 크레딧이 부족하면 에러를 던진다.
 */
export function buildBusiness(
  state: RunState,
  targetDistrictId: DistrictId,
  kind: BusinessKind,
  bundle: ContentBundle = content,
): RunState {
  const district = state.districts.find((d) => d.id === targetDistrictId);
  if (!district) {
    throw new Error(`존재하지 않는 구역: ${targetDistrictId}`);
  }
  if (district.owner !== 'player') {
    throw new Error(`플레이어가 소유한 구역에만 사업을 지을 수 있다: ${targetDistrictId}`);
  }

  const slotIndex = district.businessSlots.findIndex((slot) => slot === null);
  if (slotIndex === -1) {
    throw new Error(`구역 '${targetDistrictId}'에 빈 사업 슬롯이 없다`);
  }

  const def = bundle.businesses.find((b) => b.kind === kind);
  if (!def) {
    throw new Error(`사업 정의가 없다: ${kind}`);
  }
  if (state.credits < def.buildCost) {
    throw new Error(`'${kind}' 건설 비용(${def.buildCost})이 부족하다 (보유 크레딧 ${state.credits})`);
  }

  // 슬롯 위치로 ID를 만들면 같은 구역·같은 슬롯은 항상 같은 ID가 되어 결정적이다.
  const id = businessId(`${targetDistrictId}__slot${slotIndex}`);
  const business: Business = { id, kind, districtId: targetDistrictId, level: 1 };

  const businessSlots = district.businessSlots.map((slot, i) => (i === slotIndex ? id : slot));

  return {
    ...state,
    credits: state.credits - def.buildCost,
    businesses: [...state.businesses, business],
    districts: state.districts.map((d) => (d.id === targetDistrictId ? { ...d, businessSlots } : d)),
  };
}
