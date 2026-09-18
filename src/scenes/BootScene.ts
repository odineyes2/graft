import { palette, type PaletteToken, paletteColorNumber } from '../ui/palette';
import { createSilhouetteTexture, createSolidRectTexture } from '../ui/placeholder';
import { FONT_FAMILY } from '../ui/fonts';
import { TerminalScene } from '../ui/TerminalScene';
import { createGauge } from '../ui/gauge';
import { attachTooltip } from '../ui/tooltip';
import { ko } from '../i18n/ko';
import { SCENE_KEYS } from './navigation';

const SWATCH_SIZE = 10;
const SWATCH_GAP = 2;
const SWATCH_COLS = 8;
/** 아무 입력도 없을 때 타이틀로 자동 전환하기까지의 시간 (ms) */
const AUTO_ADVANCE_DELAY_MS = 2500;

export class BootScene extends TerminalScene {
  constructor() {
    super(SCENE_KEYS.boot);
  }

  createContent(): void {
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
    this.drawComponentPreview(360, 140);

    this.goToTitle = this.goToTitle.bind(this);
    this.input.once('pointerdown', this.goToTitle);
    this.input.keyboard?.once('keydown', this.goToTitle);
    this.time.delayedCall(AUTO_ADVANCE_DELAY_MS, this.goToTitle);
  }

  private goToTitle(): void {
    this.scene.start(SCENE_KEYS.title);
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

    const tile = this.add.image(x, y, 'placeholder-tile').setOrigin(0, 0);
    this.add.image(x + 24, y, 'placeholder-portrait').setOrigin(0, 0);

    attachTooltip(this, tile, ko.boot.tooltipSample);
  }

  /** T-31 UI 컴포넌트(게이지) 견본. 버튼·패널은 TitleScene/HideoutScene에서 실제로 쓰인다. */
  private drawComponentPreview(x: number, y: number): void {
    createGauge(this, x, y, 80, 8, 42, 100, {
      fillColor: 'heatMid',
      label: ko.boot.gaugeSample,
    });
  }
}
