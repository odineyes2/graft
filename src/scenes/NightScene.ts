/**
 * src/scenes/NightScene.ts
 *
 * 밤 실행 연출 + 이벤트 카드 (FR-TURN-02, FR-UI-05).
 * MapScene에서 확정한 배치를 advanceNight(T-13~T-19 조립)로 한 번에
 * 해결한 뒤, 그 결과(행동별 결과 → 경쟁 갱 동향)를 순서대로 짧게 보여주고,
 * triggerNightEvents(T-33)가 뽑은 이벤트가 있으면 멈춰서 카드를 띄우고
 * 선택을 받는다. 선택 적용 중 체인 이벤트가 생기면 이어서 보여준다.
 *
 * T-33 산출물.
 */

import { content } from '../core/content/load';
import { advanceNight } from '../core/systems/advanceNight';
import { applyEventChoice } from '../core/systems/events';
import { triggerNightEvents } from '../core/systems/nightEvents';
import type { TriggeredNightEvent } from '../core/systems/nightEvents';
import type { EventCardDef } from '../core/content/types';
import type {
  ActionKind,
  ActionOutcome,
  CrewId,
  EventId,
  OutcomeGrade,
  RivalAction,
  RunState,
} from '../core/types';
import { palette } from '../ui/palette';
import type { PaletteToken } from '../ui/palette';
import { FONT_FAMILY } from '../ui/fonts';
import { TerminalScene } from '../ui/TerminalScene';
import { createButton } from '../ui/button';
import { createPanel } from '../ui/panel';
import { ko } from '../i18n/ko';
import { t } from '../i18n/resolve';
import { businessName, crewName, crewStatusLabel, districtName, gangName } from '../i18n/lookup';
import { navigateReplace, SCENE_KEYS } from './navigation';
import { getRunRng, getRunState, hasActiveRun, persistRun, setRunState } from './runStateStore';

const ACTION_DISPLAY_MS = 750;

type PlaybackItem =
  | { readonly kind: 'action'; readonly outcome: ActionOutcome }
  | { readonly kind: 'rival'; readonly rivalAction: RivalAction };

function actionLabel(action: ActionKind): string {
  switch (action) {
    case 'rest':
      return ko.map.actionRest;
    case 'scout':
      return ko.map.actionScout;
    case 'defend':
      return ko.map.actionDefend;
    case 'attack':
      return ko.map.actionAttack;
    case 'operate':
      return ko.map.actionOperate;
  }
}

function gradeLabel(grade: OutcomeGrade): string {
  switch (grade) {
    case 'critical_success':
      return ko.night.gradeCriticalSuccess;
    case 'success':
      return ko.night.gradeSuccess;
    case 'failure':
      return ko.night.gradeFailure;
    case 'critical_failure':
      return ko.night.gradeCriticalFailure;
  }
}

function gradeColorToken(grade: OutcomeGrade): PaletteToken {
  switch (grade) {
    case 'critical_success':
      return 'success';
    case 'success':
      return 'neonCyan';
    case 'failure':
      return 'warning';
    case 'critical_failure':
      return 'danger';
  }
}

export class NightScene extends TerminalScene {
  private readonly dynamicObjects: Phaser.GameObjects.GameObject[] = [];

  /** createContent()에서 항상 채워진다. 씬은 게임 부팅 시 한 번만 생성되고
   * 밤마다 재사용되므로, 필드 초기화 시점에는 아직 진행 중인 런이 없을 수 있다. */
  private state!: RunState;
  private night = 0;
  private queue: PlaybackItem[] = [];
  private queueIndex = 0;
  private eventQueue: TriggeredNightEvent[] = [];
  private shownEventIds = new Set<EventId>();
  private advanceTimer: Phaser.Time.TimerEvent | null = null;

  constructor() {
    super(SCENE_KEYS.night);
  }

  createContent(): void {
    if (!hasActiveRun()) {
      this.scene.start(SCENE_KEYS.hideout);
      return;
    }

    const before = getRunState();
    const rng = getRunRng();
    this.night = before.night;

    const nightResult = advanceNight(before, before.currentAssignments, rng, content);
    const { state: triggeredState, triggered } = triggerNightEvents(
      nightResult.state,
      nightResult.heatResolution,
      nightResult.crewRisks,
      rng,
      content,
    );

    this.state = triggeredState;
    this.eventQueue = [...triggered];
    this.shownEventIds = new Set();

    const report = nightResult.report;
    this.queue = [
      ...report.actionOutcomes.map((outcome): PlaybackItem => ({ kind: 'action', outcome })),
      ...report.rivalActions.map((rivalAction): PlaybackItem => ({ kind: 'rival', rivalAction })),
    ];
    this.queueIndex = 0;

    this.renderTitle();
    this.showNextPlaybackItem();
  }

  private track<T extends Phaser.GameObjects.GameObject>(obj: T): T {
    this.dynamicObjects.push(obj);
    return obj;
  }

  private clearDynamic(): void {
    if (this.advanceTimer) {
      this.advanceTimer.remove();
      this.advanceTimer = null;
    }
    this.input.off('pointerdown');
    this.input.keyboard?.off('keydown-SPACE');
    for (const obj of this.dynamicObjects) obj.destroy();
    this.dynamicObjects.length = 0;
  }

  private renderTitle(): void {
    this.add
      .text(this.scale.width / 2, 10, `${ko.night.title} — ${ko.map.nightLabel} ${this.night}`, {
        fontFamily: FONT_FAMILY,
        fontSize: '12px',
        color: palette.textPrimary,
      })
      .setOrigin(0.5);
  }

  // ── 행동/경쟁 갱 동향을 한 번에 하나씩 짧게 보여준다 (FR-TURN-02) ──

  private showNextPlaybackItem(): void {
    this.clearDynamic();

    if (this.queueIndex >= this.queue.length) {
      this.showNextEvent();
      return;
    }

    const item = this.queue[this.queueIndex]!;
    const { headline, detail, color } = this.describePlaybackItem(item);

    this.track(
      createPanel(this, 40, 100, this.scale.width - 80, 60, { borderColor: 'borderBright' }),
    );
    this.track(
      this.add
        .text(this.scale.width / 2, 122, headline, {
          fontFamily: FONT_FAMILY,
          fontSize: '10px',
          color: palette.textPrimary,
        })
        .setOrigin(0.5),
    );
    this.track(
      this.add
        .text(this.scale.width / 2, 138, detail, {
          fontFamily: FONT_FAMILY,
          fontSize: '9px',
          color: palette[color],
        })
        .setOrigin(0.5),
    );

    this.track(
      this.add
        .text(this.scale.width / 2, 170, `${this.queueIndex + 1} / ${this.queue.length}`, {
          fontFamily: FONT_FAMILY,
          fontSize: '8px',
          color: palette.textMuted,
        })
        .setOrigin(0.5),
    );
    this.track(
      this.add
        .text(this.scale.width / 2, this.scale.height - 14, ko.night.continueHint, {
          fontFamily: FONT_FAMILY,
          fontSize: '8px',
          color: palette.textDisabled,
        })
        .setOrigin(0.5),
    );

    const advance = () => {
      this.queueIndex++;
      this.showNextPlaybackItem();
    };

    this.advanceTimer = this.time.delayedCall(ACTION_DISPLAY_MS, advance);
    this.input.once('pointerdown', advance);
    this.input.keyboard?.once('keydown-SPACE', advance);
  }

  private describePlaybackItem(item: PlaybackItem): {
    headline: string;
    detail: string;
    color: PaletteToken;
  } {
    if (item.kind === 'rival') {
      const { rivalAction } = item;
      const headline = `${gangName(rivalAction.gangId)} · ${actionLabel(rivalAction.action)} → ${districtName(rivalAction.targetDistrictId)}`;
      const detail = rivalAction.succeeded ? ko.night.rivalSucceeded : ko.night.rivalFailed;
      return { headline, detail, color: rivalAction.succeeded ? 'danger' : 'textSecondary' };
    }

    const { outcome } = item;
    const target = outcome.targetDistrictId
      ? districtName(outcome.targetDistrictId)
      : outcome.targetBusinessId
        ? businessName(this.state.businesses.find((b) => b.id === outcome.targetBusinessId)?.kind ?? 'protection')
        : null;

    const headline = `${crewName(outcome.crewId)} · ${actionLabel(outcome.action)}${target ? ` → ${target}` : ''}`;

    const parts: string[] = [`${gradeLabel(outcome.grade)} (${Math.round(outcome.successChance * 100)}%)`];
    if (outcome.creditDelta !== 0) {
      parts.push(`${ko.map.creditsLabel} ${outcome.creditDelta > 0 ? '+' : ''}${outcome.creditDelta}`);
    }
    if (outcome.heatDelta !== 0) {
      parts.push(`${ko.map.heatLabel} ${outcome.heatDelta > 0 ? '+' : ''}${outcome.heatDelta}`);
    }
    if (outcome.crewStatusChange) {
      parts.push(`→ ${crewStatusLabel(outcome.crewStatusChange)}`);
    }
    if (outcome.districtOwnerChange) {
      parts.push(`${districtName(outcome.districtOwnerChange.districtId)} 점령`);
    }

    return { headline, detail: parts.join('  '), color: gradeColorToken(outcome.grade) };
  }

  // ── 이벤트 카드 (FR-UI-05, FR-TURN-02) ──

  private showNextEvent(): void {
    this.clearDynamic();

    const next = this.nextTriggeredEvent();
    if (!next) {
      this.finish();
      return;
    }

    const { event, actingCrewId } = next;
    this.shownEventIds.add(event.id);

    this.track(
      createPanel(this, 30, 60, this.scale.width - 60, 150, {
        borderColor: 'neonPink',
        titleText: actingCrewId ? crewName(actingCrewId) : undefined,
      }),
    );
    this.track(
      this.add.text(40, 80, t(event.textKey), {
        fontFamily: FONT_FAMILY,
        fontSize: '9px',
        color: palette.textPrimary,
        wordWrap: { width: this.scale.width - 80 },
      }),
    );
    this.track(
      this.add.text(40, 122, ko.night.eventChoicePrompt, {
        fontFamily: FONT_FAMILY,
        fontSize: '8px',
        color: palette.textMuted,
      }),
    );

    event.choices.forEach((choice, index) => {
      this.track(
        createButton(
          this,
          40,
          138 + index * 20,
          t(choice.choiceKey),
          () => this.chooseEvent(event, choice.choiceKey, actingCrewId),
          { width: this.scale.width - 80, height: 16 },
        ),
      );
    });
  }

  /** 로컬 큐에 남은 트리거 이벤트가 없으면, applyEventChoice가 새로 이어붙인 체인 이벤트를 찾는다. */
  private nextTriggeredEvent(): TriggeredNightEvent | null {
    const fromQueue = this.eventQueue.shift();
    if (fromQueue) return fromQueue;

    const chainedId = this.state.pendingEventIds.find((id) => !this.shownEventIds.has(id));
    if (!chainedId) return null;

    const event = content.events.find((e) => e.id === chainedId);
    if (!event) return null;

    return { event, actingCrewId: undefined };
  }

  private chooseEvent(event: EventCardDef, choiceKey: string, actingCrewId?: CrewId): void {
    try {
      this.state = applyEventChoice(this.state, event, choiceKey, actingCrewId ? { actingCrewId } : {});
    } catch (err) {
      console.warn(`[night] 이벤트 적용 실패, 건너뜀: ${event.id} (${(err as Error).message})`);
    }
    this.showNextEvent();
  }

  // ── 마무리: 저장하고 결산 화면으로 (T-34가 실제 내용을 채운다) ──

  private finish(): void {
    setRunState(this.state);
    persistRun();
    navigateReplace(this, SCENE_KEYS.report);
  }
}
