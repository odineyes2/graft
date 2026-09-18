/**
 * src/scenes/menuButton.ts
 *
 * 아주 단순한 클릭 가능 텍스트 버튼. 패널 테두리·게이지 등 정식 UI
 * 컴포넌트는 T-31에서 src/ui/에 만든다 — 이건 그 전까지 씬 뼈대(T-30)를
 * 채우기 위한 임시 버튼이다.
 */

import type Phaser from 'phaser';
import { palette } from '../ui/palette';
import { FONT_FAMILY } from '../ui/fonts';

export interface MenuButtonOptions {
  readonly disabled?: boolean;
}

export function createMenuButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onClick: () => void,
  options: MenuButtonOptions = {},
): Phaser.GameObjects.Text {
  const disabled = options.disabled ?? false;

  const text = scene.add.text(x, y, label, {
    fontFamily: FONT_FAMILY,
    fontSize: '10px',
    color: disabled ? palette.textDisabled : palette.textPrimary,
  });

  if (disabled) return text;

  text.setInteractive({ useHandCursor: true });
  text.on('pointerover', () => text.setColor(palette.neonCyan));
  text.on('pointerout', () => text.setColor(palette.textPrimary));
  text.on('pointerdown', onClick);

  return text;
}
