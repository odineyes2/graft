/**
 * src/scenes/navigation.ts
 *
 * 씬 사이 이동과 "뒤로 가기" 히스토리. T-30 산출물 (FR-UI-01, NFR-06).
 */

import type Phaser from 'phaser';

export const SCENE_KEYS = {
  boot: 'Boot',
  title: 'Title',
  hideout: 'Hideout',
  map: 'Map',
  crew: 'Crew',
  report: 'Report',
  settings: 'Settings',
  legacy: 'Legacy',
} as const;

export type SceneKey = (typeof SCENE_KEYS)[keyof typeof SCENE_KEYS];

const history: SceneKey[] = [];

/** target으로 이동하면서 현재 씬을 히스토리에 쌓는다 (뒤로 가기로 돌아올 수 있게). */
export function navigateTo(scene: Phaser.Scene, target: SceneKey): void {
  history.push(scene.scene.key as SceneKey);
  scene.scene.start(target);
}

/** 히스토리를 남기지 않고 이동한다 (예: 새 런 시작처럼 되돌아갈 필요가 없는 전환). */
export function navigateReplace(scene: Phaser.Scene, target: SceneKey): void {
  history.length = 0;
  scene.scene.start(target);
}

/** 직전 씬으로 돌아간다. 히스토리가 비어 있으면 fallback으로 이동한다. */
export function navigateBack(scene: Phaser.Scene, fallback: SceneKey = SCENE_KEYS.title): void {
  const previous = history.pop();
  scene.scene.start(previous ?? fallback);
}

/** 테스트에서 히스토리를 초기화할 때 쓴다. */
export function resetNavigationHistory(): void {
  history.length = 0;
}
