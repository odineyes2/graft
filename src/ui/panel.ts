/**
 * src/ui/panel.ts
 *
 * 테두리 있는 배경 패널. 화면 안 구획을 나누는 기본 단위로 모든 씬에서
 * 재사용한다 (FR-UI-08 "패널 테두리").
 */

import type Phaser from 'phaser';
import type { PaletteToken } from './palette';
import { palette, paletteColorNumber } from './palette';
import { FONT_FAMILY } from './fonts';

export interface PanelOptions {
  readonly backgroundColor?: PaletteToken;
  readonly borderColor?: PaletteToken;
  /** 패널 왼쪽 위에 표시할 제목 (없으면 표시하지 않는다) */
  readonly titleText?: string;
}

export function createPanel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  options: PanelOptions = {},
): Phaser.GameObjects.Container {
  const bg = scene.add
    .rectangle(0, 0, width, height, paletteColorNumber(options.backgroundColor ?? 'bgPanel'))
    .setOrigin(0, 0)
    .setStrokeStyle(1, paletteColorNumber(options.borderColor ?? 'borderDim'));

  const children: Phaser.GameObjects.GameObject[] = [bg];

  if (options.titleText) {
    const title = scene.add.text(4, 2, options.titleText, {
      fontFamily: FONT_FAMILY,
      fontSize: '10px',
      color: palette.textSecondary,
    });
    children.push(title);
  }

  return scene.add.container(x, y, children);
}
