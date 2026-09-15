import Phaser from 'phaser';

/**
 * 임시 스프라이트 생성 유틸. 최종 아트가 준비되기 전까지 단색 사각형·실루엣으로 대체한다.
 * 필요한 실제 에셋 목록은 assets/ASSET_MANIFEST.md에 기록한다.
 */

export function createSolidRectTexture(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  color: number,
): void {
  if (scene.textures.exists(key)) return;

  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(color, 1);
  g.fillRect(0, 0, width, height);
  g.generateTexture(key, width, height);
  g.destroy();
}

export function createSilhouetteTexture(
  scene: Phaser.Scene,
  key: string,
  size: number,
  color: number,
): void {
  if (scene.textures.exists(key)) return;

  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(color, 1);

  const cx = size / 2;
  const headRadius = size * 0.22;
  const headCy = size * 0.32;

  g.fillCircle(cx, headCy, headRadius);
  g.fillTriangle(
    cx - size * 0.32,
    size * 0.95,
    cx + size * 0.32,
    size * 0.95,
    cx,
    headCy + headRadius * 0.6,
  );

  g.generateTexture(key, size, size);
  g.destroy();
}
