/**
 * src/save/runSave.ts
 *
 * 런 저장·불러오기 (FR-TURN-03, NFR-02, NFR-05). 유산 저장(legacySave.ts)과는
 * 별도의 localStorage 키를 쓴다 (FR-LEG-03: 런을 지워도 유산은 남아야 한다).
 *
 * RunState 자체는 RNG를 담지 않는다 — CLAUDE.md 아키텍처 규칙대로 RNG는
 * 항상 (state, action, rng) 함수의 인자로만 다룬다. 그래서 "저장한 시점부터
 * 이어서 같은 결과가 나오려면" RunState뿐 아니라 그 시점의 RngState도 함께
 * 저장해야 한다 — 호출자가 진행 중이던 Rng의 getState() 값을 넘겨야 한다.
 *
 * T-21 산출물.
 */

import type { RngState } from '../core/rng';
import type { RunState } from '../core/types';
import { getBrowserStorage } from './storage';
import type { KeyValueStorage } from './storage';
import { RUN_SAVE_KEY } from './storageKeys';

/** 저장 포맷 자체의 버전. RunState.schemaVersion(런 데이터 내부 버전)과는 별개다. */
export const RUN_SAVE_SCHEMA_VERSION = 1;

export interface RunSaveData {
  readonly schemaVersion: number;
  readonly runState: RunState;
  readonly rngState: RngState;
}

type RunSaveMigration = (data: Record<string, unknown>) => Record<string, unknown>;

/**
 * 이전 저장 포맷 버전 → 다음 버전으로 옮기는 함수들.
 * 예: 버전 1에서 2로 필드가 추가/변경되면 `1: (data) => ({ ...data, schemaVersion: 2, ... })`처럼 등록한다.
 * 지금은 버전 1뿐이라 비어 있다.
 */
const RUN_SAVE_MIGRATIONS: Record<number, RunSaveMigration> = {};

/**
 * raw 데이터를 현재 버전까지 마이그레이션한다. 더 높은 버전(미래의 게임에서
 * 만든 저장)이거나 마이그레이션 경로가 없으면 null을 반환해 "안전하게 폐기"
 * 하게 한다 (NFR-05).
 */
function migrateRunSaveData(raw: Record<string, unknown>): RunSaveData | null {
  let data = raw;
  let version = typeof data.schemaVersion === 'number' ? data.schemaVersion : 0;

  if (version > RUN_SAVE_SCHEMA_VERSION) return null;

  while (version < RUN_SAVE_SCHEMA_VERSION) {
    const migrate = RUN_SAVE_MIGRATIONS[version];
    if (!migrate) return null;
    data = migrate(data);
    version = typeof data.schemaVersion === 'number' ? data.schemaVersion : version + 1;
  }

  if (!data.runState || !data.rngState) return null;
  return data as unknown as RunSaveData;
}

/** 현재 진행 중인 런과 그 시점의 RNG 상태를 저장한다 (FR-TURN-03: 매 밤 끝날 때 자동 저장). */
export function saveRun(
  runState: RunState,
  rngState: RngState,
  storage: KeyValueStorage = getBrowserStorage(),
): void {
  const payload: RunSaveData = { schemaVersion: RUN_SAVE_SCHEMA_VERSION, runState, rngState };
  storage.setItem(RUN_SAVE_KEY, JSON.stringify(payload));
}

/**
 * 저장된 런을 불러온다. 저장이 없거나, 손상됐거나, 마이그레이션할 수 없는
 * 버전이면 null을 반환하고 (안전을 위해) 해당 저장을 지운다.
 */
export function loadRun(storage: KeyValueStorage = getBrowserStorage()): RunSaveData | null {
  const raw = storage.getItem(RUN_SAVE_KEY);
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    storage.removeItem(RUN_SAVE_KEY);
    return null;
  }

  if (typeof parsed !== 'object' || parsed === null) {
    storage.removeItem(RUN_SAVE_KEY);
    return null;
  }

  const migrated = migrateRunSaveData(parsed as Record<string, unknown>);
  if (!migrated) {
    storage.removeItem(RUN_SAVE_KEY);
    return null;
  }

  return migrated;
}

/** 저장된 런을 지운다. 유산 저장(legacySave.ts)은 건드리지 않는다 (FR-LEG-03). */
export function clearRun(storage: KeyValueStorage = getBrowserStorage()): void {
  storage.removeItem(RUN_SAVE_KEY);
}
