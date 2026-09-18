/**
 * src/ui/TerminalScene.ts
 *
 * 모든 게임 씬의 공통 기반. 해킹 단말기 연출(스캔라인)을 빠뜨리지 않고
 * 모든 화면에 적용하기 위해, 서브클래스가 create() 대신 createContent()를
 * 구현하게 강제한다 (FR-UI-08: "모든 씬에서 재사용된다").
 */

import Phaser from 'phaser';
import { createScanlineOverlay } from './scanlineOverlay';

export abstract class TerminalScene extends Phaser.Scene {
  create(): void {
    this.createContent();
    createScanlineOverlay(this);
  }

  protected abstract createContent(): void;
}
