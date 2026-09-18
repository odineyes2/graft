/**
 * src/i18n/lookup.ts
 *
 * 콘텐츠 ID(구역·조직원·사업·경쟁 갱단)를 표시용 이름으로 바꾸는 헬퍼.
 * MapScene(T-32)이 처음 만든 걸 NightScene(T-33)도 써야 해서 공유 모듈로 뺐다.
 */

import type { BusinessKind, CrewId, CrewStatus, DistrictId, GangId } from '../core/types';
import { ko } from './ko';

function lookupName<T extends string>(
  table: Record<string, { name?: string }>,
  id: T,
): string {
  const entry = table[id];
  return entry?.name ?? String(id);
}

export function crewName(id: CrewId): string {
  return lookupName(ko.crew as unknown as Record<string, { name?: string }>, id);
}

export function districtName(id: DistrictId): string {
  return lookupName(ko.districts as unknown as Record<string, { name?: string }>, id);
}

export function businessName(kind: BusinessKind): string {
  return lookupName(ko.businesses as unknown as Record<string, { name?: string }>, kind);
}

export function gangName(id: GangId): string {
  return lookupName(ko.rivals as unknown as Record<string, { name?: string }>, id);
}

export function crewStatusLabel(status: CrewStatus): string {
  if (status === 'injured') return ko.map.statusInjured;
  if (status === 'arrested') return ko.map.statusArrested;
  if (status === 'dead') return ko.map.statusDead;
  return '';
}
