/**
 * src/core/content/load.ts
 *
 * src/data/*.json을 읽어 브랜드 타입을 씌우고 검증까지 마친 ContentBundle을
 * 만든다. 이 모듈만 JSON import를 알고, 나머지 코드는 ContentBundle 타입을
 * 통해서만 콘텐츠에 접근한다.
 *
 * 순수 TypeScript — Phaser / DOM / window / localStorage 참조 없음.
 * T-12 산출물.
 */

import { crewId, cyberwareId, districtId, eventId, gangId } from '../types';
import type { CrewStatus, DistrictOwner } from '../types';
import rawBalance from '../../data/balance.json';
import rawBusinesses from '../../data/businesses.json';
import rawCrew from '../../data/crew.json';
import rawCyberware from '../../data/cyberware.json';
import rawDistricts from '../../data/districts.json';
import rawEvents from '../../data/events.json';
import rawLegacy from '../../data/legacy.json';
import rawRivals from '../../data/rivals.json';
import { assertValidContent } from './validate';
import type {
  BalanceConfig,
  BusinessDef,
  ContentBundle,
  CrewContentDef,
  CrewDef,
  CyberwareDef,
  DistrictDef,
  EventCardDef,
  EventChoiceDef,
  LegacyBonusDef,
  RivalDef,
} from './types';

function toDistrictOwner(raw: string): DistrictOwner {
  if (raw === 'player' || raw === 'neutral') return raw;
  return gangId(raw);
}

function mapDistrict(raw: (typeof rawDistricts)[number]): DistrictDef {
  return {
    ...raw,
    id: districtId(raw.id),
    tier: raw.tier as DistrictDef['tier'],
    initialOwner: toDistrictOwner(raw.initialOwner),
    adjacentDistrictIds: raw.adjacentDistrictIds.map(districtId),
  };
}

/** businesses.json 원본 형태. JSON은 3-튜플을 표현할 수 없어 number[]로 들어온다. */
interface RawBusinessJson {
  readonly kind: string;
  readonly nameKey: string;
  readonly descriptionKey: string;
  readonly requiredStat: string;
  readonly incomePerLevel: readonly number[];
  readonly heatPerLevel: readonly number[];
  readonly maintenanceCostPerLevel: readonly number[];
  readonly buildCost: number;
  readonly upgradeCost: readonly number[];
  readonly specialEffect: string;
}

function mapBusiness(raw: RawBusinessJson): BusinessDef {
  const [i1, i2, i3] = raw.incomePerLevel;
  const [h1, h2, h3] = raw.heatPerLevel;
  const [m1, m2, m3] = raw.maintenanceCostPerLevel;
  const [u1, u2] = raw.upgradeCost;
  if (i1 === undefined || i2 === undefined || i3 === undefined) {
    throw new Error(`businesses.json: '${raw.kind}'의 incomePerLevel은 3개 값이 필요하다`);
  }
  if (h1 === undefined || h2 === undefined || h3 === undefined) {
    throw new Error(`businesses.json: '${raw.kind}'의 heatPerLevel은 3개 값이 필요하다`);
  }
  if (m1 === undefined || m2 === undefined || m3 === undefined) {
    throw new Error(`businesses.json: '${raw.kind}'의 maintenanceCostPerLevel은 3개 값이 필요하다`);
  }
  if (u1 === undefined || u2 === undefined) {
    throw new Error(`businesses.json: '${raw.kind}'의 upgradeCost는 2개 값이 필요하다`);
  }
  return {
    ...raw,
    kind: raw.kind as BusinessDef['kind'],
    requiredStat: raw.requiredStat as BusinessDef['requiredStat'],
    incomePerLevel: [i1, i2, i3],
    heatPerLevel: [h1, h2, h3],
    maintenanceCostPerLevel: [m1, m2, m3],
    upgradeCost: [u1, u2],
    specialEffect: raw.specialEffect as BusinessDef['specialEffect'],
  };
}

type RawCrewEntry = (typeof rawCrew)['startingBoss'];

function mapCrew(raw: RawCrewEntry): CrewDef {
  return { ...raw, id: crewId(raw.id) };
}

function mapCyberware(raw: (typeof rawCyberware)[number]): CyberwareDef {
  return { ...raw, id: cyberwareId(raw.id) };
}

function mapRival(raw: (typeof rawRivals)[number]): RivalDef {
  return {
    ...raw,
    id: gangId(raw.id),
    personality: raw.personality as RivalDef['personality'],
    startingDistrictId: districtId(raw.startingDistrictId),
  };
}

/** events.json 원본 형태. JSON은 선택지별 effect 필드 조합이 제각각이라 느슨하게 받는다. */
interface RawEventChoiceJson {
  readonly choiceKey: string;
  readonly effect: {
    readonly creditDelta?: number;
    readonly heatDelta?: number;
    readonly reputationDelta?: number;
    readonly actingCrewEffect?: {
      readonly humanityDelta?: number;
      readonly loyaltyDelta?: number;
      readonly statusChange?: string;
    };
    readonly chainEventId?: string;
  };
}

interface RawEventJson {
  readonly id: string;
  readonly category: string;
  readonly portraitKey: string;
  readonly textKey: string;
  readonly condition: {
    readonly heatRange?: readonly number[];
    readonly minDistrictsOwned?: number;
    readonly requiresDistrict?: string;
  };
  readonly weight: number;
  readonly choices: readonly RawEventChoiceJson[];
}

function mapEventChoice(raw: RawEventChoiceJson): EventChoiceDef {
  const rawActingCrewEffect = raw.effect.actingCrewEffect;
  return {
    ...raw,
    effect: {
      ...raw.effect,
      actingCrewEffect: rawActingCrewEffect
        ? {
            ...rawActingCrewEffect,
            statusChange: rawActingCrewEffect.statusChange as CrewStatus | undefined,
          }
        : undefined,
      chainEventId: raw.effect.chainEventId ? eventId(raw.effect.chainEventId) : undefined,
    },
  };
}

function mapEvent(raw: RawEventJson): EventCardDef {
  const heatRange = raw.condition.heatRange;
  if (heatRange !== undefined && heatRange.length !== 2) {
    throw new Error(`events.json: '${raw.id}'의 heatRange는 [min, max] 형태여야 한다`);
  }
  return {
    ...raw,
    id: eventId(raw.id),
    category: raw.category as EventCardDef['category'],
    condition: {
      ...raw.condition,
      heatRange: heatRange as readonly [number, number] | undefined,
      requiresDistrict: raw.condition.requiresDistrict
        ? districtId(raw.condition.requiresDistrict)
        : undefined,
    },
    choices: raw.choices.map(mapEventChoice),
  };
}

function mapLegacyBonus(raw: (typeof rawLegacy)[number]): LegacyBonusDef {
  return { ...raw, kind: raw.kind as LegacyBonusDef['kind'] };
}

/** JSON을 읽어 브랜드 타입을 씌우고 검증까지 마친 ContentBundle을 만든다. */
export function loadContent(): ContentBundle {
  const crew: CrewContentDef = {
    startingBoss: mapCrew(rawCrew.startingBoss),
    startingCrew: rawCrew.startingCrew.map(mapCrew),
    recruitPool: rawCrew.recruitPool.map(mapCrew),
  };

  const bundle: ContentBundle = {
    districts: rawDistricts.map(mapDistrict),
    businesses: rawBusinesses.map(mapBusiness),
    crew,
    cyberware: rawCyberware.map(mapCyberware),
    rivals: rawRivals.map(mapRival),
    events: rawEvents.map(mapEvent),
    legacyBonuses: rawLegacy.map(mapLegacyBonus),
    balance: rawBalance as BalanceConfig,
  };

  assertValidContent(bundle);
  return bundle;
}

/** 앱 전체가 공유하는 검증된 콘텐츠. 모듈 최초 import 시 한 번 생성된다. */
export const content: ContentBundle = loadContent();
