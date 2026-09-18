/**
 * src/ui/scanlineOverlay.ts
 *
 * 해킹 단말기 화면 연출의 핵심 요소: 화면 전체를 덮는 스캔라인 (FR-UI-08).
 * 네온 깜빡임·비 효과 같은 화려한 연출은 Phaser 4 Filter 시스템을 쓰는
 * T-52 몫이다 — 여기서는 반복 타일 텍스처로 만드는 단순한 스캔라인만 다룬다.
 */

import type Phaser from 'phaser';
import { paletteColorNumber } from './palette';

const TEXTURE_KEY = 'ui-scanline-tile';
const LINE_ALPHA = 0.08;
/** 스캔라인 한 줄 + 빈 줄 = 2px 반복 */
const TILE_HEIGHT = 2;
/** 다른 UI 위에 항상 그려지도록 매우 높은 값을 쓴다 */
const OVERLAY_DEPTH = 10_000;

function ensureScanlineTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(TEXTURE_KEY)) return;

  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(paletteColorNumber('scanline'), LINE_ALPHA);
  g.fillRect(0, 0, 1, 1);
  g.generateTexture(TEXTURE_KEY, 1, TILE_HEIGHT);
  g.destroy();
}

/** 씬 전체(현재 카메라 뷰포트 크기)를 덮는 스캔라인 오버레이를 만들어 반환한다. */
export function createScanlineOverlay(scene: Phaser.Scene): Phaser.GameObjects.TileSprite {
  ensureScanlineTexture(scene);

  const overlay = scene.add
    .tileSprite(0, 0, scene.scale.width, scene.scale.height, TEXTURE_KEY)
    .setOrigin(0, 0)
    .setScrollFactor(0)
    .setDepth(OVERLAY_DEPTH);

  return overlay;
}
