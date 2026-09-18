/**
 * tests/content.test.ts
 *
 * T-12 완료 조건:
 * - REQUIREMENTS 6장의 콘텐츠 수량을 모두 충족한다.
 * - 존재하지 않는 ID 참조, 비대칭 인접 관계, 선택지 없는(개수가 잘못된) 이벤트 등을
 *   검증 코드가 잡아낸다.
 */

import { describe, expect, it } from 'vitest';
import { content } from '../src/core/content/load';
import { validateContent } from '../src/core/content/validate';
import type { ContentBundle } from '../src/core/content/types';
import { districtId, eventId } from '../src/core/types';

describe('T-12 콘텐츠 데이터', () => {
  it('실제 콘텐츠는 검증 오류가 없다', () => {
    expect(validateContent(content)).toEqual([]);
  });

  it('구역이 6개다 (FR-MAP-01)', () => {
    expect(content.districts).toHaveLength(6);
  });

  it('사업이 4종이다 (FR-BIZ-01)', () => {
    expect(content.businesses).toHaveLength(4);
    const kinds = content.businesses.map((b) => b.kind).sort();
    expect(kinds).toEqual(['arena', 'clinic', 'datatrafficking', 'protection']);
  });

  it('영입 가능 조직원이 12명 이상이다 (FR-CREW-02)', () => {
    expect(content.crew.recruitPool.length).toBeGreaterThanOrEqual(12);
    expect(content.crew.startingCrew).toHaveLength(2);
  });

  it('사이버웨어가 6종이다', () => {
    expect(content.cyberware).toHaveLength(6);
  });

  it('경쟁 갱이 2개다 (FR-AI-01)', () => {
    expect(content.rivals).toHaveLength(2);
  });

  it('이벤트가 20종 이상이다 (FR-EVT-03)', () => {
    expect(content.events.length).toBeGreaterThanOrEqual(20);
  });

  it('유산 보너스가 5종이다 (FR-LEG-02)', () => {
    expect(content.legacyBonuses).toHaveLength(5);
    const kinds = content.legacyBonuses.map((b) => b.kind).sort();
    expect(kinds).toEqual(
      ['start_credits', 'start_extra_crew', 'start_less_heat', 'start_prebuild', 'start_special_crew'].sort(),
    );
  });

  it('구역 인접 관계가 완전히 대칭이다 (FR-MAP-02)', () => {
    for (const district of content.districts) {
      for (const neighborId of district.adjacentDistrictIds) {
        const neighbor = content.districts.find((d) => d.id === neighborId);
        expect(neighbor).toBeDefined();
        expect(neighbor?.adjacentDistrictIds).toContain(district.id);
      }
    }
  });

  it('모든 이벤트가 선택지 2~3개를 가진다 (FR-EVT-01)', () => {
    for (const event of content.events) {
      expect(event.choices.length).toBeGreaterThanOrEqual(2);
      expect(event.choices.length).toBeLessThanOrEqual(3);
    }
  });

  it('경쟁 갱단의 시작 구역이 모두 존재하는 구역이다', () => {
    const districtIds = new Set(content.districts.map((d) => d.id));
    for (const rival of content.rivals) {
      expect(districtIds.has(rival.startingDistrictId)).toBe(true);
    }
  });
});

describe('T-12 검증 로직이 잘못된 데이터를 잡아낸다', () => {
  it('존재하지 않는 구역을 인접 목록에서 참조하면 오류를 낸다', () => {
    const broken: ContentBundle = {
      ...content,
      districts: content.districts.map((d) =>
        d.id === districtId('slums')
          ? { ...d, adjacentDistrictIds: [...d.adjacentDistrictIds, districtId('does_not_exist')] }
          : d,
      ),
    };
    const errors = validateContent(broken);
    expect(errors.some((e) => e.includes('존재하지 않는 인접 구역'))).toBe(true);
  });

  it('인접 관계가 비대칭이면 오류를 낸다', () => {
    const broken: ContentBundle = {
      ...content,
      districts: content.districts.map((d) =>
        d.id === districtId('harbor')
          ? { ...d, adjacentDistrictIds: d.adjacentDistrictIds.filter((id) => id !== districtId('slums')) }
          : d,
      ),
    };
    const errors = validateContent(broken);
    expect(errors.some((e) => e.includes('비대칭'))).toBe(true);
  });

  it('구역 ID가 중복되면 오류를 낸다', () => {
    const broken: ContentBundle = {
      ...content,
      districts: [...content.districts, content.districts[0]!],
    };
    const errors = validateContent(broken);
    expect(errors.some((e) => e.includes('구역 ID가 중복'))).toBe(true);
  });

  it('구역이 6개 미만이면 오류를 낸다', () => {
    const broken: ContentBundle = { ...content, districts: content.districts.slice(0, 3) };
    const errors = validateContent(broken);
    expect(errors.some((e) => e.includes('구역 수가 부족'))).toBe(true);
  });

  it('선택지가 없는(1개뿐인) 이벤트는 오류를 낸다', () => {
    const broken: ContentBundle = {
      ...content,
      events: content.events.map((e, i) => (i === 0 ? { ...e, choices: e.choices.slice(0, 1) } : e)),
    };
    const errors = validateContent(broken);
    expect(errors.some((e) => e.includes('선택지가'))).toBe(true);
  });

  it('선택지가 4개인 이벤트는 오류를 낸다', () => {
    const broken: ContentBundle = {
      ...content,
      events: content.events.map((e, i) =>
        i === 0 ? { ...e, choices: [...e.choices, e.choices[0]!, e.choices[0]!] } : e,
      ),
    };
    const errors = validateContent(broken);
    expect(errors.some((e) => e.includes('선택지가'))).toBe(true);
  });

  it('이벤트가 존재하지 않는 구역을 조건으로 참조하면 오류를 낸다', () => {
    const broken: ContentBundle = {
      ...content,
      events: content.events.map((e, i) =>
        i === 0 ? { ...e, condition: { ...e.condition, requiresDistrict: districtId('does_not_exist') } } : e,
      ),
    };
    const errors = validateContent(broken);
    expect(errors.some((e) => e.includes('존재하지 않는 구역'))).toBe(true);
  });

  it('이벤트가 존재하지 않는 체인 이벤트를 참조하면 오류를 낸다', () => {
    const broken: ContentBundle = {
      ...content,
      events: content.events.map((e, i) =>
        i === 0
          ? {
              ...e,
              choices: e.choices.map((c, ci) =>
                ci === 0 ? { ...c, effect: { ...c.effect, chainEventId: eventId('does_not_exist') } } : c,
              ),
            }
          : e,
      ),
    };
    const errors = validateContent(broken);
    expect(errors.some((e) => e.includes('체인 이벤트'))).toBe(true);
  });

  it('이벤트 수가 20개 미만이면 오류를 낸다', () => {
    const broken: ContentBundle = { ...content, events: content.events.slice(0, 5) };
    const errors = validateContent(broken);
    expect(errors.some((e) => e.includes('이벤트 수가 부족'))).toBe(true);
  });

  it('경쟁 갱단이 존재하지 않는 구역에서 시작하면 오류를 낸다', () => {
    const broken: ContentBundle = {
      ...content,
      rivals: content.rivals.map((r, i) => (i === 0 ? { ...r, startingDistrictId: districtId('does_not_exist') } : r)),
    };
    const errors = validateContent(broken);
    expect(errors.some((e) => e.includes('시작 구역'))).toBe(true);
  });

  it('P0 사업 종류가 빠지면 오류를 낸다', () => {
    const broken: ContentBundle = { ...content, businesses: content.businesses.slice(1) };
    const errors = validateContent(broken);
    expect(errors.some((e) => e.includes("사업 종류"))).toBe(true);
  });

  it('영입 풀이 12명 미만이면 오류를 낸다', () => {
    const broken: ContentBundle = {
      ...content,
      crew: { ...content.crew, recruitPool: content.crew.recruitPool.slice(0, 5) },
    };
    const errors = validateContent(broken);
    expect(errors.some((e) => e.includes('영입 풀'))).toBe(true);
  });

  it('유산 보너스 종류가 하나라도 빠지면 오류를 낸다', () => {
    const broken: ContentBundle = { ...content, legacyBonuses: content.legacyBonuses.slice(1) };
    const errors = validateContent(broken);
    expect(errors.some((e) => e.includes('유산 보너스'))).toBe(true);
  });
});
