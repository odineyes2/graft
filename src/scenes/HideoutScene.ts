/**
 * src/scenes/HideoutScene.ts
 *
 * 은신처: 각 기능 화면으로 이동하는 허브 (FR-UI-02). 측면 뷰·조직원
 * 스프라이트·비 내리는 창문 연출은 T-35에서 채운다 — 여기서는 T-30이
 * 요구하는 네비게이션 뼈대만 만든다.
 */

import Phaser from 'phaser';
import { palette } from '../ui/palette';
import { FONT_FAMILY } from '../ui/fonts';
import { ko } from '../i18n/ko';
import { createMenuButton } from './menuButton';
import { navigateBack, navigateTo, SCENE_KEYS } from './navigation';

export class HideoutScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.hideout);
  }

  create(): void {
    this.add
      .text(this.scale.width / 2, 20, ko.hideout.title, {
        fontFamily: FONT_FAMILY,
        fontSize: '14px',
        color: palette.textPrimary,
      })
      .setOrigin(0.5);

    createMenuButton(this, 20, 70, ko.hideout.goMap, () => navigateTo(this, SCENE_KEYS.map));
    createMenuButton(this, 20, 90, ko.hideout.goCrew, () => navigateTo(this, SCENE_KEYS.crew));
    createMenuButton(this, 20, 110, ko.hideout.goReport, () => navigateTo(this, SCENE_KEYS.report));

    this.add.text(20, this.scale.height - 20, ko.nav.back, {
      fontFamily: FONT_FAMILY,
      fontSize: '10px',
      color: palette.textMuted,
    });

    const keyboard = this.input.keyboard;
    keyboard?.on('keydown-M', () => navigateTo(this, SCENE_KEYS.map));
    keyboard?.on('keydown-C', () => navigateTo(this, SCENE_KEYS.crew));
    keyboard?.on('keydown-R', () => navigateTo(this, SCENE_KEYS.report));
    keyboard?.on('keydown-ESC', () => navigateBack(this, SCENE_KEYS.title));
  }
}
