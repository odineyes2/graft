import Phaser from 'phaser';
import { palette, type PaletteToken, paletteColorNumber } from '../ui/palette';
import { createSilhouetteTexture, createSolidRectTexture } from '../ui/placeholder';
import { ko } from '../i18n/ko';

const FONT_FAMILY = 'Galmuri9, monospace';
const SWATCH_SIZE = 10;
const SWATCH_GAP = 2;
const SWATCH_COLS = 8;

export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  create(): void {
    this.add
      .text(this.scale.width / 2, 12, ko.common.gameTitle, {
        fontFamily: FONT_FAMILY,
        fontSize: '10px',
        color: palette.textPrimary,
      })
      .setOrigin(0.5);

    this.add.text(10, 26, ko.boot.paletteLabel, {
      fontFamily: FONT_FAMILY,
      fontSize: '10px',
      color: palette.textMuted,
    });

    this.drawPaletteSwatches(10, 38);

    this.add.text(10, 92, ko.boot.fontSampleKo, {
      fontFamily: FONT_FAMILY,
      fontSize: '10px',
      color: palette.textPrimary,
    });
    this.add.text(10, 106, ko.boot.fontSampleEn, {
      fontFamily: FONT_FAMILY,
      fontSize: '10px',
      color: palette.neonCyan,
    });
    this.add.text(10, 120, ko.boot.fontSampleNum, {
      fontFamily: FONT_FAMILY,
      fontSize: '10px',
      color: palette.neonAmber,
    });

    this.drawPlaceholderPreview(360, 92);
  }

  private drawPaletteSwatches(originX: number, originY: number): void {
    const tokens = Object.keys(palette) as PaletteToken[];
    tokens.forEach((token, index) => {
      const col = index % SWATCH_COLS;
      const row = Math.floor(index / SWATCH_COLS);
      const x = originX + col * (SWATCH_SIZE + SWATCH_GAP);
      const y = originY + row * (SWATCH_SIZE + SWATCH_GAP);

      this.add
        .rectangle(x, y, SWATCH_SIZE, SWATCH_SIZE, paletteColorNumber(token))
        .setOrigin(0, 0);
    });
  }

  private drawPlaceholderPreview(x: number, y: number): void {
    createSolidRectTexture(this, 'placeholder-tile', 16, 16, paletteColorNumber('factionNeutral'));
    createSilhouetteTexture(this, 'placeholder-portrait', 32, paletteColorNumber('textMuted'));

    this.add.image(x, y, 'placeholder-tile').setOrigin(0, 0);
    this.add.image(x + 24, y, 'placeholder-portrait').setOrigin(0, 0);
  }
}
