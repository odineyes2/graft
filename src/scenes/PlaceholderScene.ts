/**
 * src/scenes/PlaceholderScene.ts
 *
 * 아직 실제 내용이 없는 화면(지도·조직원·결산·설정·유산)의 공통 뼈대.
 * 제목과 "뒤로가기"만 있다 — 실제 내용은 각 작업(T-32 지도, T-34 결산,
 * T-36 조직원, T-41 유산)에서 이 씬을 대체한다.
 */

import Phaser from 'phaser';
import { palette } from '../ui/palette';
import { FONT_FAMILY } from '../ui/fonts';
import { ko } from '../i18n/ko';
import { navigateBack } from './navigation';
import type { SceneKey } from './navigation';

export class PlaceholderScene extends Phaser.Scene {
  private readonly title: string;

  constructor(sceneKey: SceneKey, title: string) {
    super(sceneKey);
    this.title = title;
  }

  create(): void {
    this.add
      .text(this.scale.width / 2, 20, this.title, {
        fontFamily: FONT_FAMILY,
        fontSize: '14px',
        color: palette.textPrimary,
      })
      .setOrigin(0.5);

    this.add
      .text(this.scale.width / 2, this.scale.height / 2, ko.common.underConstruction, {
        fontFamily: FONT_FAMILY,
        fontSize: '10px',
        color: palette.textMuted,
      })
      .setOrigin(0.5);

    this.add.text(20, this.scale.height - 20, ko.nav.back, {
      fontFamily: FONT_FAMILY,
      fontSize: '10px',
      color: palette.textMuted,
    });

    this.input.keyboard?.on('keydown-ESC', () => navigateBack(this));
  }
}
