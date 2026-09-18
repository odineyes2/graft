/**
 * src/save/legacySave.ts
 *
 * 유산 저장·불러오기 (FR-LEG-03: 런 저장과 분리해 보관하며, 런을 지워도
 * 유지된다). runSave.ts와 다른 localStorage 키를 쓴다.
 *
 * T-21 산출물.
 */

import type { LegacyState } from '../core/types';
import { getBrowserStorage } from './storage';
import type { KeyValueStorage } from './storage';
import { LEGACY_SAVE_KEY } from './storageKeys';

/** LegacyState.schemaVersion에 쓰는 현재 버전. */
export const LEGACY_SCHEMA_VERSION = 1;

type LegacyMigration = (data: Record<string, unknown>) => Record<string, unknown>;

/** 지금은 버전 1뿐이라 비어 있다. runSave.ts의 RUN_SAVE_MIGRATIONS와 같은 패턴. */
const LEGACY_MIGRATIONS: Record<number, LegacyMigration> = {};

/** 유산 데이터가 아예 없을 때(첫 플레이) 쓰는 빈 값. */
export function createEmptyLegacyState(): LegacyState {
  return { legacyPoints: 0, bonuses: [], totalRuns: 0, totalWins: 0, schemaVersion: LEGACY_SCHEMA_VERSION };
}

function migrateLegacyData(raw: Record<string, unknown>): LegacyState | null {
  let data = raw;
  let version = typeof data.schemaVersion === 'number' ? data.schemaVersion : 0;

  if (version > LEGACY_SCHEMA_VERSION) return null;

  while (version < LEGACY_SCHEMA_VERSION) {
    const migrate = LEGACY_MIGRATIONS[version];
    if (!migrate) return null;
    data = migrate(data);
    version = typeof data.schemaVersion === 'number' ? data.schemaVersion : version + 1;
  }

  if (typeof data.legacyPoints !== 'number' || !Array.isArray(data.bonuses)) return null;
  return data as unknown as LegacyState;
}

export function saveLegacy(legacy: LegacyState, storage: KeyValueStorage = getBrowserStorage()): void {
  storage.setItem(LEGACY_SAVE_KEY, JSON.stringify(legacy));
}

/**
 * 유산 데이터를 불러온다. 저장이 없거나 손상/비호환 버전이면 빈 유산 상태를
 * 반환한다 (첫 플레이와 동일하게 취급 — null을 반환하지 않는다).
 */
export function loadLegacy(storage: KeyValueStorage = getBrowserStorage()): LegacyState {
  const raw = storage.getItem(LEGACY_SAVE_KEY);
  if (!raw) return createEmptyLegacyState();

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    storage.removeItem(LEGACY_SAVE_KEY);
    return createEmptyLegacyState();
  }

  if (typeof parsed !== 'object' || parsed === null) {
    storage.removeItem(LEGACY_SAVE_KEY);
    return createEmptyLegacyState();
  }

  const migrated = migrateLegacyData(parsed as Record<string, unknown>);
  if (!migrated) {
    storage.removeItem(LEGACY_SAVE_KEY);
    return createEmptyLegacyState();
  }

  return migrated;
}
