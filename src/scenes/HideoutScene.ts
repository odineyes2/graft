/**
 * src/scenes/HideoutScene.ts
 *
 * 은신처: 각 기능 화면으로 이동하는 허브 (FR-UI-02). 측면 뷰·조직원
 * 스프라이트·비 내리는 창문 연출은 T-35에서 채운다 — 여기서는 T-30이
 * 요구하는 네비게이션 뼈대에 T-31의 패널·버튼 컴포넌트를 입힌다.
 */

import { palette } from '../ui/palette';
import { FONT_FAMILY } from '../ui/fonts';
import { TerminalScene } from '../ui/TerminalScene';
import { createButton } from '../ui/button';
import { createPanel } from '../ui/panel';
import { ko } from '../i18n/ko';
import { navigateBack, navigateTo, SCENE_KEYS } from './navigation';

export class HideoutScene extends TerminalScene {
  constructor() {
    super(SCENE_KEYS.hideout);
  }

  createContent(): void {
    this.add
      .text(this.scale.width / 2, 12, ko.hideout.title, {
        fontFamily: FONT_FAMILY,
        fontSize: '14px',
        color: palette.textPrimary,
      })
      .setOrigin(0.5);

    createPanel(this, 16, 30, 160, 90, { borderColor: 'borderBright' });

    createButton(this, 24, 40, ko.hideout.goMap, () => navigateTo(this, SCENE_KEYS.map));
    createButton(this, 24, 62, ko.hideout.goCrew, () => navigateTo(this, SCENE_KEYS.crew));
    createButton(this, 24, 84, ko.hideout.goReport, () => navigateTo(this, SCENE_KEYS.report));

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
