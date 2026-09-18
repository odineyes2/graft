/**
 * src/core/content/validate.ts
 *
 * ContentBundle 검증. 존재하지 않는 ID 참조, 비대칭 인접 관계, 선택지 없는
 * 이벤트, REQUIREMENTS 6장 수량 미달 등을 잡아낸다.
 *
 * 순수 TypeScript — Phaser / DOM / window / localStorage 참조 없음.
 * T-12 산출물.
 */

import type { LegacyBonusKind } from '../types';
import type { ContentBundle } from './types';

const ALL_LEGACY_BONUS_KINDS: ReadonlyArray<LegacyBonusKind> = [
  'start_credits',
  'start_extra_crew',
  'start_less_heat',
  'start_prebuild',
  'start_special_crew',
];

const ALL_P0_BUSINESS_KINDS = ['protection', 'clinic', 'arena', 'datatrafficking'] as const;

/** REQUIREMENTS 6장 MVP 콘텐츠 수량 요약의 최소 수량 */
const MIN_COUNTS = {
  districts: 6,
  businesses: 4,
  recruitPool: 12,
  cyberware: 6,
  rivals: 2,
  events: 20,
  legacyBonuses: 5,
} as const;

function findDuplicates(ids: ReadonlyArray<string>): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) duplicates.add(id);
    seen.add(id);
  }
  return [...duplicates];
}

/**
 * bundle을 검증하고 발견한 문제를 한국어 메시지 배열로 반환한다.
 * 빈 배열이면 유효한 콘텐츠다.
 */
export function validateContent(bundle: ContentBundle): string[] {
  const errors: string[] = [];

  // ── 구역 ──────────────────────────────────────────────────────────────
  const districtIds = new Set(bundle.districts.map((d) => d.id as string));

  if (bundle.districts.length < MIN_COUNTS.districts) {
    errors.push(
      `구역 수가 부족하다: ${bundle.districts.length}개 (최소 ${MIN_COUNTS.districts}개, FR-MAP-01)`,
    );
  }

  const dupDistrictIds = findDuplicates(bundle.districts.map((d) => d.id as string));
  if (dupDistrictIds.length > 0) {
    errors.push(`구역 ID가 중복된다: ${dupDistrictIds.join(', ')}`);
  }

  for (const district of bundle.districts) {
    for (const adjId of district.adjacentDistrictIds) {
      if (!districtIds.has(adjId as string)) {
        errors.push(`구역 '${district.id}'가 존재하지 않는 인접 구역 '${adjId}'를 참조한다`);
        continue;
      }
      const neighbor = bundle.districts.find((d) => d.id === adjId);
      if (neighbor && !neighbor.adjacentDistrictIds.includes(district.id)) {
        errors.push(`인접 관계가 비대칭이다: '${district.id}' → '${adjId}'는 있지만 역방향이 없다`);
      }
    }

    if (
      typeof district.initialOwner === 'string' &&
      district.initialOwner !== 'player' &&
      district.initialOwner !== 'neutral' &&
      !bundle.rivals.some((r) => r.id === district.initialOwner)
    ) {
      errors.push(
        `구역 '${district.id}'의 초기 소유자 '${district.initialOwner}'가 rivals.json에 존재하지 않는다`,
      );
    }
  }

  // ── 사업 ──────────────────────────────────────────────────────────────
  if (bundle.businesses.length < MIN_COUNTS.businesses) {
    errors.push(
      `사업 종류가 부족하다: ${bundle.businesses.length}개 (최소 ${MIN_COUNTS.businesses}개, FR-BIZ-01)`,
    );
  }
  const businessKinds = new Set(bundle.businesses.map((b) => b.kind as string));
  for (const kind of ALL_P0_BUSINESS_KINDS) {
    if (!businessKinds.has(kind)) {
      errors.push(`P0 사업 종류 '${kind}'가 businesses.json에 없다 (FR-BIZ-01)`);
    }
  }
  const dupBusinessKinds = findDuplicates(bundle.businesses.map((b) => b.kind as string));
  if (dupBusinessKinds.length > 0) {
    errors.push(`사업 종류가 중복된다: ${dupBusinessKinds.join(', ')}`);
  }

  // ── 조직원 ────────────────────────────────────────────────────────────
  if (bundle.crew.recruitPool.length < MIN_COUNTS.recruitPool) {
    errors.push(
      `영입 풀 조직원 수가 부족하다: ${bundle.crew.recruitPool.length}명 (최소 ${MIN_COUNTS.recruitPool}명, FR-CREW-02)`,
    );
  }
  if (bundle.crew.startingCrew.length !== 2) {
    errors.push(
      `시작 조직원(보스 제외)은 정확히 2명이어야 한다 (현재 ${bundle.crew.startingCrew.length}명, FR-CREW-02)`,
    );
  }
  const allCrewIds = [
    bundle.crew.startingBoss.id as string,
    ...bundle.crew.startingCrew.map((c) => c.id as string),
    ...bundle.crew.recruitPool.map((c) => c.id as string),
  ];
  const dupCrewIds = findDuplicates(allCrewIds);
  if (dupCrewIds.length > 0) {
    errors.push(`조직원 ID가 중복된다: ${dupCrewIds.join(', ')}`);
  }

  // ── 사이버웨어 ────────────────────────────────────────────────────────
  if (bundle.cyberware.length < MIN_COUNTS.cyberware) {
    errors.push(
      `사이버웨어 수가 부족하다: ${bundle.cyberware.length}개 (최소 ${MIN_COUNTS.cyberware}개)`,
    );
  }
  const dupCyberwareIds = findDuplicates(bundle.cyberware.map((c) => c.id as string));
  if (dupCyberwareIds.length > 0) {
    errors.push(`사이버웨어 ID가 중복된다: ${dupCyberwareIds.join(', ')}`);
  }

  // ── 경쟁 갱단 ─────────────────────────────────────────────────────────
  if (bundle.rivals.length !== MIN_COUNTS.rivals) {
    errors.push(`경쟁 갱단은 정확히 ${MIN_COUNTS.rivals}개여야 한다 (현재 ${bundle.rivals.length}개, FR-AI-01)`);
  }
  const dupRivalIds = findDuplicates(bundle.rivals.map((r) => r.id as string));
  if (dupRivalIds.length > 0) {
    errors.push(`경쟁 갱단 ID가 중복된다: ${dupRivalIds.join(', ')}`);
  }
  for (const rival of bundle.rivals) {
    if (!districtIds.has(rival.startingDistrictId as string)) {
      errors.push(
        `경쟁 갱단 '${rival.id}'의 시작 구역 '${rival.startingDistrictId}'가 districts.json에 없다`,
      );
    }
  }

  // ── 이벤트 ────────────────────────────────────────────────────────────
  if (bundle.events.length < MIN_COUNTS.events) {
    errors.push(`이벤트 수가 부족하다: ${bundle.events.length}개 (최소 ${MIN_COUNTS.events}개, FR-EVT-03)`);
  }
  const dupEventIds = findDuplicates(bundle.events.map((e) => e.id as string));
  if (dupEventIds.length > 0) {
    errors.push(`이벤트 ID가 중복된다: ${dupEventIds.join(', ')}`);
  }
  const eventIds = new Set(bundle.events.map((e) => e.id as string));

  for (const event of bundle.events) {
    if (event.choices.length < 2 || event.choices.length > 3) {
      errors.push(
        `이벤트 '${event.id}'의 선택지가 ${event.choices.length}개다 (2~3개여야 함, FR-EVT-01)`,
      );
    }

    if (event.condition.requiresDistrict && !districtIds.has(event.condition.requiresDistrict as string)) {
      errors.push(
        `이벤트 '${event.id}'가 존재하지 않는 구역 '${event.condition.requiresDistrict}'을 조건으로 참조한다`,
      );
    }

    if (event.condition.heatRange) {
      const [min, max] = event.condition.heatRange;
      if (min > max) {
        errors.push(`이벤트 '${event.id}'의 heatRange가 [${min}, ${max}]로 역전되어 있다`);
      }
    }

    for (const choice of event.choices) {
      const chainId = choice.effect.chainEventId;
      if (chainId && !eventIds.has(chainId as string)) {
        errors.push(
          `이벤트 '${event.id}'의 선택지 '${choice.choiceKey}'가 존재하지 않는 체인 이벤트 '${chainId}'를 참조한다`,
        );
      }
    }
  }

  // ── 유산 보너스 ───────────────────────────────────────────────────────
  if (bundle.legacyBonuses.length !== MIN_COUNTS.legacyBonuses) {
    errors.push(
      `유산 보너스는 정확히 ${MIN_COUNTS.legacyBonuses}종이어야 한다 (현재 ${bundle.legacyBonuses.length}종, FR-LEG-02)`,
    );
  }
  const legacyKinds = new Set(bundle.legacyBonuses.map((b) => b.kind));
  for (const kind of ALL_LEGACY_BONUS_KINDS) {
    if (!legacyKinds.has(kind)) {
      errors.push(`유산 보너스 종류 '${kind}'가 legacy.json에 없다 (FR-LEG-02)`);
    }
  }
  const dupLegacyKinds = findDuplicates(bundle.legacyBonuses.map((b) => b.kind));
  if (dupLegacyKinds.length > 0) {
    errors.push(`유산 보너스 종류가 중복된다: ${dupLegacyKinds.join(', ')}`);
  }

  return errors;
}

/** 검증 후 문제가 있으면 에러를 던진다. */
export function assertValidContent(bundle: ContentBundle): void {
  const errors = validateContent(bundle);
  if (errors.length > 0) {
    throw new Error(`콘텐츠 데이터 검증 실패:\n- ${errors.join('\n- ')}`);
  }
}
