/**
 * src/scenes/runStateStore.ts
 *
 * 현재 진행 중인 런의 RunState·Rng를 들고 있는 모듈 수준 저장소.
 * CLAUDE.md 아키텍처 규칙("씬은 상태를 읽고 액션을 보낼 뿐 직접 수정하지
 * 않는다")에 따라, 씬은 이 저장소를 통해서만 상태를 읽고, 상태 변경은
 * src/core/의 순수 함수(resolveNight 등)가 반환한 새 상태를 setRunState로
 * 반영하는 방식으로만 한다.
 *
 * T-32 산출물 — 유산 보너스 선택·런 종료 처리 같은 나머지 흐름은
 * T-40(런 시작·종료 흐름)에서 채운다.
 */

import { createInitialRunState } from '../core/initialState';
import { createRng, restoreRng } from '../core/rng';
import type { Rng } from '../core/rng';
import type { LegacyBonusKind, RunState } from '../core/types';
import { loadRun, saveRun } from '../save/runSave';

let currentState: RunState | null = null;
let currentRng: Rng | null = null;

export function hasActiveRun(): boolean {
  return currentState !== null;
}

export function getRunState(): RunState {
  if (!currentState) throw new Error('진행 중인 런이 없다');
  return currentState;
}

export function getRunRng(): Rng {
  if (!currentRng) throw new Error('진행 중인 런이 없다');
  return currentRng;
}

export function setRunState(state: RunState): void {
  currentState = state;
}

/** 새 런을 시작한다 (FR-RUN-01). 시드는 매 실행마다 다르게 생성한다. */
export function startNewRun(legacyBonuses: ReadonlyArray<LegacyBonusKind> = []): RunState {
  const seed = `${Date.now()}`;
  currentState = createInitialRunState(seed, legacyBonuses);
  currentRng = createRng(`${seed}-rng`);
  return currentState;
}

/** 저장된 런을 불러온다. 저장이 없으면 null을 반환하고 저장소를 건드리지 않는다. */
export function continueRun(): RunState | null {
  const saved = loadRun();
  if (!saved) return null;
  currentState = saved.runState;
  currentRng = restoreRng(saved.rngState);
  return currentState;
}

/** 현재 진행 상태를 저장한다 (FR-TURN-03: 매 밤이 끝날 때 자동 저장). */
export function persistRun(): void {
  if (!currentState || !currentRng) return;
  saveRun(currentState, currentRng.getState());
}
