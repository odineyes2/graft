/**
 * src/ui/tooltip.ts
 *
 * 마우스를 올리면 뜨는 작은 설명 상자 (FR-UI-08). NFR-06(마우스 전용
 * 플레이 가능)을 보조하는 용도 — 키보드로도 조작 가능해야 하는 핵심 동작은
 * 툴팁 없이도 이해할 수 있어야 한다.
 */

import type Phaser from 'phaser';
import { palette, paletteColorNumber } from './palette';
import { FONT_FAMILY } from './fonts';

const TOOLTIP_DEPTH = 20_000;
const OFFSET_X = 8;
const OFFSET_Y = 8;

/** target에 마우스를 올리면 pointer 위치 근처에 text를 보여준다. */
export function attachTooltip(
  scene: Phaser.Scene,
  target: Phaser.GameObjects.GameObject,
  text: string,
): void {
  let tooltip: Phaser.GameObjects.Container | null = null;

  const destroyTooltip = (): void => {
    tooltip?.destroy();
    tooltip = null;
  };

  const showTooltip = (pointer: Phaser.Input.Pointer): void => {
    destroyTooltip();

    const label = scene.add
      .text(4, 2, text, { fontFamily: FONT_FAMILY, fontSize: '8px', color: palette.textPrimary })
      .setOrigin(0, 0);
    const bg = scene.add
      .rectangle(0, 0, label.width + 8, label.height + 4, paletteColorNumber('bgOverlay'))
      .setOrigin(0, 0)
      .setStrokeStyle(1, paletteColorNumber('borderBright'));

    tooltip = scene.add.container(pointer.x + OFFSET_X, pointer.y + OFFSET_Y, [bg, label]);
    tooltip.setDepth(TOOLTIP_DEPTH);
  };

  target.setInteractive();
  target.on('pointerover', showTooltip);
  target.on('pointermove', (pointer: Phaser.Input.Pointer) => {
    tooltip?.setPosition(pointer.x + OFFSET_X, pointer.y + OFFSET_Y);
  });
  target.on('pointerout', destroyTooltip);
  scene.events.once('shutdown', destroyTooltip);
}
