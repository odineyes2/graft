import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { TitleScene } from './scenes/TitleScene';
import { HideoutScene } from './scenes/HideoutScene';
import { PlaceholderScene } from './scenes/PlaceholderScene';
import { SCENE_KEYS } from './scenes/navigation';
import { ko } from './i18n/ko';
import { palette } from './ui/palette';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'app',
  width: 480,
  height: 270,
  pixelArt: true,
  roundPixels: true,
  backgroundColor: palette.bgBase,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    zoom: Phaser.Scale.MAX_ZOOM,
  },
  scene: [
    BootScene,
    TitleScene,
    HideoutScene,
    new PlaceholderScene(SCENE_KEYS.map, ko.map.title),
    new PlaceholderScene(SCENE_KEYS.crew, ko.crew.title),
    new PlaceholderScene(SCENE_KEYS.report, ko.report.title),
    new PlaceholderScene(SCENE_KEYS.settings, ko.settings.title),
    new PlaceholderScene(SCENE_KEYS.legacy, ko.legacy.title),
  ],
};

async function boot(): Promise<void> {
  // Canvas 텍스트는 fillText 시점에 폰트가 로드되어 있지 않으면 폴백 폰트로
  // 영구히 그려진다(font-display와 달리 재시도가 없다). 로드 실패해도 폴백으로
  // 진행하도록 무시한다.
  try {
    await document.fonts.load('10px Galmuri9');
  } catch {
    /* 폴백 폰트로 계속 진행 */
  }
  new Phaser.Game(config);
}

void boot();
