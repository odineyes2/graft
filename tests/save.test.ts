/**
 * tests/save.test.ts
 *
 * T-21 완료 조건: 저장 → 불러오기 후 다음 밤 결과가 저장 전 진행과 동일하다
 * (NFR-02, NFR-05, FR-LEG-03).
 */

import { describe, expect, it } from 'vitest';
import { createInitialRunState } from '../src/core/initialState';
import { createRng, restoreRng } from '../src/core/rng';
import { advanceNight } from '../src/core/systems/advanceNight';
import { crewId, districtId } from '../src/core/types';
import type { Assignment } from '../src/core/types';
import {
  clearRun,
  createEmptyLegacyState,
  loadLegacy,
  loadRun,
  LEGACY_SAVE_KEY,
  RUN_SAVE_KEY,
  saveLegacy,
  saveRun,
} from '../src/save';
import type { KeyValueStorage } from '../src/save';

function createMemoryStorage(): KeyValueStorage {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
}

describe('T-21 저장 → 불러오기 후 진행 재현 (NFR-02)', () => {
  it('저장 시점 이후 밤 결과가 저장하지 않고 이어간 경우와 동일하다', () => {
    const seed = 't21-continuity-seed';
    const state0 = createInitialRunState(seed);
    const rng = createRng(`${seed}-rng`);

    const assignmentsFor = (): Assignment[] => [{ crewId: crewId('crew_01'), action: 'rest' }];

    // 두 밤을 먼저 진행해 "저장 시점"을 만든다.
    const night1 = advanceNight(state0, assignmentsFor(), rng);
    const night2 = advanceNight(night1.state, assignmentsFor(), rng);
    const checkpointState = night2.state;
    const checkpointRngState = rng.getState();

    // 분기 A: 저장하지 않고 같은 rng 인스턴스로 계속 진행한다.
    const continuedAssignments: Assignment[] = [
      { crewId: crewId('crew_02'), action: 'scout', targetDistrictId: districtId('harbor') },
    ];
    const branchA = advanceNight(checkpointState, continuedAssignments, rng);

    // 분기 B: 저장 → 불러오기 → 복원한 rng로 같은 배치를 진행한다.
    const storage = createMemoryStorage();
    saveRun(checkpointState, checkpointRngState, storage);
    const loaded = loadRun(storage)!;
    const restoredRng = restoreRng(loaded.rngState);
    const branchB = advanceNight(loaded.runState, continuedAssignments, restoredRng);

    expect(branchB.state).toEqual(branchA.state);
    expect(branchB.report).toEqual(branchA.report);
  });
});

describe('T-21 런 저장·불러오기 (NFR-05)', () => {
  it('저장하지 않았으면 null을 반환한다', () => {
    const storage = createMemoryStorage();
    expect(loadRun(storage)).toBeNull();
  });

  it('저장한 그대로 불러온다', () => {
    const storage = createMemoryStorage();
    const state = createInitialRunState('t21-roundtrip');
    const rng = createRng('t21-roundtrip-rng');
    rng.next(); // 상태를 조금 진행시켜 초기값이 아님을 확인한다
    const rngState = rng.getState();

    saveRun(state, rngState, storage);
    const loaded = loadRun(storage);

    expect(loaded?.runState).toEqual(state);
    expect(loaded?.rngState).toEqual(rngState);
  });

  it('손상된 JSON이면 null을 반환하고 저장을 지운다', () => {
    const storage = createMemoryStorage();
    storage.setItem(RUN_SAVE_KEY, '{ this is not valid json');

    expect(loadRun(storage)).toBeNull();
    expect(storage.getItem(RUN_SAVE_KEY)).toBeNull();
  });

  it('미래 버전(현재 게임이 모르는 schemaVersion)이면 null을 반환하고 저장을 지운다', () => {
    const storage = createMemoryStorage();
    const state = createInitialRunState('t21-future-version');
    const rng = createRng('t21-future-version-rng');
    saveRun(state, rng.getState(), storage);

    // 저장된 payload의 버전을 미래 버전으로 조작한다.
    const raw = JSON.parse(storage.getItem(RUN_SAVE_KEY)!) as Record<string, unknown>;
    raw.schemaVersion = 999;
    storage.setItem(RUN_SAVE_KEY, JSON.stringify(raw));

    expect(loadRun(storage)).toBeNull();
    expect(storage.getItem(RUN_SAVE_KEY)).toBeNull();
  });

  it('clearRun은 런 저장만 지우고 유산 저장은 그대로 둔다 (FR-LEG-03)', () => {
    const storage = createMemoryStorage();
    const state = createInitialRunState('t21-clear-run');
    const rng = createRng('t21-clear-run-rng');
    saveRun(state, rng.getState(), storage);
    saveLegacy({ legacyPoints: 42, bonuses: [], totalRuns: 3, totalWins: 1, schemaVersion: 1 }, storage);

    clearRun(storage);

    expect(loadRun(storage)).toBeNull();
    expect(storage.getItem(LEGACY_SAVE_KEY)).not.toBeNull();
    expect(loadLegacy(storage).legacyPoints).toBe(42);
  });
});

describe('T-21 유산 저장·불러오기 (FR-LEG-03)', () => {
  it('저장한 적 없으면 빈 유산 상태를 반환한다', () => {
    const storage = createMemoryStorage();
    expect(loadLegacy(storage)).toEqual(createEmptyLegacyState());
  });

  it('저장한 그대로 불러온다', () => {
    const storage = createMemoryStorage();
    const legacy = { legacyPoints: 15, bonuses: [{ kind: 'start_credits' as const, unlocked: true }], totalRuns: 5, totalWins: 2, schemaVersion: 1 };
    saveLegacy(legacy, storage);
    expect(loadLegacy(storage)).toEqual(legacy);
  });

  it('손상된 저장이면 빈 유산 상태로 대체하고 저장을 지운다', () => {
    const storage = createMemoryStorage();
    storage.setItem(LEGACY_SAVE_KEY, 'not json at all {{{');

    expect(loadLegacy(storage)).toEqual(createEmptyLegacyState());
    expect(storage.getItem(LEGACY_SAVE_KEY)).toBeNull();
  });

  it('런과 유산은 서로 다른 저장 키를 쓴다', () => {
    expect(RUN_SAVE_KEY).not.toBe(LEGACY_SAVE_KEY);
  });
});
