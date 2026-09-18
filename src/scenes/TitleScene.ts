/**
 * src/scenes/TitleScene.ts
 *
 * 타이틀 화면: 새 런, 이어하기, 유산, 설정 (FR-UI-01).
 * "새 런"/"이어하기"는 T-32부터 runStateStore로 실제 RunState를 만들거나
 * 불러온다. 유산 보너스 선택 같은 나머지 시작 흐름은 T-40 몫이다.
 */

import { palette } from '../ui/palette';
import { FONT_FAMILY } from '../ui/fonts';
import { TerminalScene } from '../ui/TerminalScene';
import { createButton } from '../ui/button';
import { ko } from '../i18n/ko';
import { loadRun } from '../save/runSave';
import { continueRun, startNewRun } from './runStateStore';
import { navigateTo, SCENE_KEYS } from './navigation';

interface MenuItem {
  readonly label: string;
  readonly onClick: () => void;
  readonly disabled?: boolean;
}

const BUTTON_WIDTH = 120;

export class TitleScene extends TerminalScene {
  constructor() {
    super(SCENE_KEYS.title);
  }

  createContent(): void {
    this.add
      .text(this.scale.width / 2, 50, ko.common.gameTitle, {
        fontFamily: FONT_FAMILY,
        fontSize: '20px',
        color: palette.neonCyan,
      })
      .setOrigin(0.5);

    const hasSave = this.hasSavedRun();

    const items: MenuItem[] = [
      {
        label: ko.title.newRun,
        onClick: () => {
          startNewRun();
          navigateTo(this, SCENE_KEYS.hideout);
        },
      },
      {
        label: ko.title.continueRun,
        onClick: () => {
          if (continueRun()) navigateTo(this, SCENE_KEYS.hideout);
        },
        disabled: !hasSave,
      },
      { label: ko.title.legacy, onClick: () => navigateTo(this, SCENE_KEYS.legacy) },
      { label: ko.title.settings, onClick: () => navigateTo(this, SCENE_KEYS.settings) },
    ];

    const startY = 130;
    const gapY = 22;
    items.forEach((item, index) => {
      createButton(
        this,
        this.scale.width / 2 - BUTTON_WIDTH / 2,
        startY + index * gapY,
        `${index + 1}. ${item.label}`,
        item.onClick,
        { disabled: item.disabled, width: BUTTON_WIDTH },
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
