/**
 * src/ui/button.ts
 *
 * 클릭 가능한 버튼 컴포넌트 (FR-UI-08). T-30이 임시로 썼던
 * src/scenes/menuButton.ts를 대체한다.
 */

import type Phaser from 'phaser';
import { palette, paletteColorNumber } from './palette';
import { FONT_FAMILY } from './fonts';

const DEFAULT_WIDTH = 120;
const DEFAULT_HEIGHT = 16;

export interface ButtonOptions {
  readonly width?: number;
  readonly height?: number;
  readonly disabled?: boolean;
}

export function createButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onClick: () => void,
  options: ButtonOptions = {},
): Phaser.GameObjects.Container {
  const width = options.width ?? DEFAULT_WIDTH;
  const height = options.height ?? DEFAULT_HEIGHT;
  const disabled = options.disabled ?? false;

  const bg = scene.add
    .rectangle(0, 0, width, height, paletteColorNumber('bgPanelAlt'))
    .setOrigin(0, 0)
    .setStrokeStyle(1, paletteColorNumber(disabled ? 'borderDim' : 'borderBright'));

  const text = scene.add
    .text(width / 2, height / 2, label, {
      fontFamily: FONT_FAMILY,
      fontSize: '10px',
      color: disabled ? palette.textDisabled : palette.textPrimary,
    })
    .setOrigin(0.5);

  const container = scene.add.container(x, y, [bg, text]);
  if (disabled) return container;

  bg.setInteractive({ useHandCursor: true });

  const setIdle = () => {
    bg.setFillStyle(paletteColorNumber('bgPanelAlt'));
    bg.setStrokeStyle(1, paletteColorNumber('borderBright'));
    text.setColor(palette.textPrimary);
  };

  bg.on('pointerover', () => {
    bg.setFillStyle(paletteColorNumber('bgPanel'));
    bg.setStrokeStyle(1, paletteColorNumber('neonCyan'));
    text.setColor(palette.neonCyan);
  });
  bg.on('pointerout', setIdle);
  bg.on('pointerdown', () => bg.setFillStyle(paletteColorNumber('borderDim')));
  bg.on('pointerup', () => {
    bg.setFillStyle(paletteColorNumber('bgPanel'));
    onClick();
  });

  return container;
}
