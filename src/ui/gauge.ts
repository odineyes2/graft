/**
 * src/ui/gauge.ts
 *
 * 값/최댓값을 채워진 막대로 보여주는 게이지 (FR-UI-08, FR-HEAT-02의 열기
 * 게이지 등에서 재사용한다).
 */

import type Phaser from 'phaser';
import type { PaletteToken } from './palette';
import { palette, paletteColorNumber } from './palette';
import { FONT_FAMILY } from './fonts';

export interface GaugeOptions {
  readonly backgroundColor?: PaletteToken;
  readonly fillColor?: PaletteToken;
  readonly borderColor?: PaletteToken;
  /** 게이지 위에 겹쳐 표시할 텍스트 (예: "열기 42/100") */
  readonly label?: string;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function createGauge(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  value: number,
  max: number,
  options: GaugeOptions = {},
): Phaser.GameObjects.Container {
  const ratio = max > 0 ? clamp01(value / max) : 0;

  const bg = scene.add
    .rectangle(0, 0, width, height, paletteColorNumber(options.backgroundColor ?? 'bgPanelAlt'))
    .setOrigin(0, 0)
    .setStrokeStyle(1, paletteColorNumber(options.borderColor ?? 'borderDim'));

  const innerWidth = Math.max(0, Math.round((width - 2) * ratio));
  const fill = scene.add
    .rectangle(1, 1, innerWidth, height - 2, paletteColorNumber(options.fillColor ?? 'neonCyan'))
    .setOrigin(0, 0);

  const children: Phaser.GameObjects.GameObject[] = [bg, fill];

  if (options.label) {
    const text = scene.add
      .text(width / 2, height / 2, options.label, {
        fontFamily: FONT_FAMILY,
        fontSize: '8px',
        color: palette.textPrimary,
      })
      .setOrigin(0.5);
    children.push(text);
  }

  return scene.add.container(x, y, children);
}
