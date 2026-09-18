/**
 * tests/navigation.test.ts
 *
 * T-30 완료 조건: 씬 사이 이동과 뒤로 가기 히스토리가 동작한다 (FR-UI-01).
 * 실제 Phaser 없이 scene.scene.start()만 흉내 낸 가짜 씬으로 검증한다 —
 * navigation.ts는 Phaser를 값으로 import하지 않는다(타입만 참조한다).
 */

import { describe, expect, it, beforeEach } from 'vitest';
import {
  navigateBack,
  navigateReplace,
  navigateTo,
  resetNavigationHistory,
  SCENE_KEYS,
} from '../src/scenes/navigation';
import type { SceneKey } from '../src/scenes/navigation';
import type Phaser from 'phaser';

function makeFakeScene(key: SceneKey): { scene: Phaser.Scene; starts: SceneKey[] } {
  const starts: SceneKey[] = [];
  const scene = {
    scene: {
      key,
      start: (target: SceneKey) => {
        starts.push(target);
      },
    },
  } as unknown as Phaser.Scene;
  return { scene, starts };
}

describe('T-30 씬 네비게이션', () => {
  beforeEach(() => {
    resetNavigationHistory();
  });

  it('navigateTo는 대상 씬을 시작한다', () => {
    const { scene, starts } = makeFakeScene(SCENE_KEYS.title);
    navigateTo(scene, SCENE_KEYS.hideout);
    expect(starts).toEqual([SCENE_KEYS.hideout]);
  });

  it('navigateBack은 직전에 있던 씬으로 되돌아간다', () => {
    const title = makeFakeScene(SCENE_KEYS.title);
    navigateTo(title.scene, SCENE_KEYS.hideout);

    const hideout = makeFakeScene(SCENE_KEYS.hideout);
    navigateTo(hideout.scene, SCENE_KEYS.map);

    const map = makeFakeScene(SCENE_KEYS.map);
    navigateBack(map.scene);
    expect(map.starts).toEqual([SCENE_KEYS.hideout]);
  });

  it('히스토리가 여러 단계를 정확히 거슬러 올라간다', () => {
    const calls: SceneKey[] = [];
    const makeTrackedScene = (key: SceneKey) => {
      const scene = {
        scene: {
          key,
          start: (target: SceneKey) => calls.push(target),
        },
      } as unknown as Phaser.Scene;
      return scene;
    };

    let current = makeTrackedScene(SCENE_KEYS.title);
    navigateTo(current, SCENE_KEYS.hideout);
    current = makeTrackedScene(SCENE_KEYS.hideout);
    navigateTo(current, SCENE_KEYS.map);
    current = makeTrackedScene(SCENE_KEYS.map);

    navigateBack(current); // map -> hideout
    current = makeTrackedScene(SCENE_KEYS.hideout);
    navigateBack(current); // hideout -> title

    expect(calls).toEqual([SCENE_KEYS.hideout, SCENE_KEYS.map, SCENE_KEYS.hideout, SCENE_KEYS.title]);
  });

  it('히스토리가 비어 있으면 fallback으로 이동한다', () => {
    const { scene, starts } = makeFakeScene(SCENE_KEYS.map);
    navigateBack(scene, SCENE_KEYS.hideout);
    expect(starts).toEqual([SCENE_KEYS.hideout]);
  });

  it('fallback을 생략하면 기본값은 타이틀이다', () => {
    const { scene, starts } = makeFakeScene(SCENE_KEYS.map);
    navigateBack(scene);
    expect(starts).toEqual([SCENE_KEYS.title]);
  });

  it('navigateReplace는 히스토리를 남기지 않는다', () => {
    const title = makeFakeScene(SCENE_KEYS.title);
    navigateTo(title.scene, SCENE_KEYS.hideout);

    const hideout = makeFakeScene(SCENE_KEYS.hideout);
    navigateReplace(hideout.scene, SCENE_KEYS.map);

    const map = makeFakeScene(SCENE_KEYS.map);
    navigateBack(map.scene, SCENE_KEYS.settings);
    expect(map.starts).toEqual([SCENE_KEYS.settings]); // 히스토리가 비어 fallback으로 감
  });
});
