/**
 * src/scenes/TitleScene.ts
 *
 * 타이틀 화면: 새 런, 이어하기, 유산, 설정 (FR-UI-01).
 * T-30 산출물 — 실제 런 시작 로직(T-40)은 아직 연결하지 않고 은신처로
 * 이동만 한다.
 */

import Phaser from 'phaser';
import { palette } from '../ui/palette';
import { FONT_FAMILY } from '../ui/fonts';
import { ko } from '../i18n/ko';
import { loadRun } from '../save/runSave';
import { createMenuButton } from './menuButton';
import { navigateTo, SCENE_KEYS } from './navigation';

interface MenuItem {
  readonly label: string;
  readonly onClick: () => void;
  readonly disabled?: boolean;
}

export class TitleScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.title);
  }

  create(): void {
    this.add
      .text(this.scale.width / 2, 50, ko.common.gameTitle, {
        fontFamily: FONT_FAMILY,
        fontSize: '20px',
        color: palette.neonCyan,
      })
      .setOrigin(0.5);

    const hasSave = this.hasSavedRun();

    const items: MenuItem[] = [
      { label: ko.title.newRun, onClick: () => navigateTo(this, SCENE_KEYS.hideout) },
      {
        label: ko.title.continueRun,
        onClick: () => navigateTo(this, SCENE_KEYS.hideout),
        disabled: !hasSave,
      },
      { label: ko.title.legacy, onClick: () => navigateTo(this, SCENE_KEYS.legacy) },
      { label: ko.title.settings, onClick: () => navigateTo(this, SCENE_KEYS.settings) },
    ];

    const startY = 130;
    const gapY = 22;
    items.forEach((item, index) => {
      createMenuButton(
        this,
        this.scale.width / 2 - 50,
        startY + index * gapY,
        `${index + 1}. ${item.label}`,
        item.onClick,
        { disabled: item.disabled },
      );
    });

    const keyboard = this.input.keyboard;
    keyboard?.on('keydown-ONE', () => items[0]?.onClick());
    keyboard?.on('keydown-TWO', () => {
      if (!items[1]?.disabled) items[1]?.onClick();
    });
    keyboard?.on('keydown-THREE', () => items[2]?.onClick());
    keyboard?.on('keydown-FOUR', () => items[3]?.onClick());
  }

  private hasSavedRun(): boolean {
    try {
      return loadRun() !== null;
    } catch {
      return false;
    }
  }
}
