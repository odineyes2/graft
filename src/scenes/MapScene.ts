/**
 * src/scenes/MapScene.ts
 *
 * 도시 지도 + 배치 (FR-UI-03, FR-MAP-02~04, FR-HEAT-02).
 * 3개 층에 6구역을 표시하고, 조직원을 클릭 한 번(구역 선택 → 행동 버튼)으로
 * 행동 슬롯에 배치·해제한다. "밤 시작" 버튼이 T-13 resolveNight를 호출한다.
 *
 * T-32 산출물.
 */

import { content } from '../core/content/load';
import { getHeatBand } from '../core/systems/heat';
import type { HeatBand } from '../core/systems/heat';
import { estimateNightHeatIncrease } from '../core/systems/estimateHeat';
import { resolveNight } from '../core/systems/resolveNight';
import type {
  ActionKind,
  Assignment,
  CrewId,
  CrewMember,
  CrewStatus,
  District,
  DistrictId,
  DistrictOwner,
  RunState,
} from '../core/types';
import { palette, paletteColorNumber } from '../ui/palette';
import type { PaletteToken } from '../ui/palette';
import { FONT_FAMILY } from '../ui/fonts';
import { TerminalScene } from '../ui/TerminalScene';
import { createButton } from '../ui/button';
import { createGauge } from '../ui/gauge';
import { createPanel } from '../ui/panel';
import { ko } from '../i18n/ko';
import { navigateBack, navigateTo, SCENE_KEYS } from './navigation';
import { getRunState, getRunRng, hasActiveRun, persistRun, setRunState } from './runStateStore';

const HEAT_BAND_COLOR: Record<HeatBand, PaletteToken> = {
  quiet: 'heatLow',
  police: 'heatMid',
  raid: 'heatHigh',
  lockdown: 'heatCritical',
};

const TIER_ORDER = ['upper', 'mid', 'lower'] as const;

const DISTRICT_BOX_WIDTH = 74;
const DISTRICT_BOX_HEIGHT = 26;
const DISTRICT_ROW_GAP = 30;
const DISTRICTS_TOP_Y = 26;

const CREW_ROW_HEIGHT = 16;
const CREW_PANEL_TOP_Y = 128;

function ownerColorToken(owner: DistrictOwner): PaletteToken {
  if (owner === 'player') return 'factionPlayer';
  if (owner === 'neutral') return 'factionNeutral';
  if ((owner as string) === 'gang_a') return 'factionRivalA';
  return 'factionRivalB';
}

function tierLabel(tier: (typeof TIER_ORDER)[number]): string {
  if (tier === 'upper') return ko.map.tierUpper;
  if (tier === 'mid') return ko.map.tierMid;
  return ko.map.tierLower;
}

function crewDisplayName(crewIdValue: CrewId): string {
  const entry = ko.crew[crewIdValue as unknown as keyof typeof ko.crew] as { name?: string } | undefined;
  return entry?.name ?? String(crewIdValue);
}

function districtDisplayName(id: DistrictId): string {
  const entry = ko.districts[id as unknown as keyof typeof ko.districts] as { name?: string } | undefined;
  return entry?.name ?? String(id);
}

function statusLabel(status: CrewStatus): string {
  if (status === 'injured') return ko.map.statusInjured;
  if (status === 'arrested') return ko.map.statusArrested;
  if (status === 'dead') return ko.map.statusDead;
  return '';
}

export class MapScene extends TerminalScene {
  private readonly dynamicObjects: Phaser.GameObjects.GameObject[] = [];
  private selectedDistrictId: DistrictId | null = null;

  constructor() {
    super(SCENE_KEYS.map);
  }

  createContent(): void {
    if (!hasActiveRun()) {
      this.scene.start(SCENE_KEYS.hideout);
      return;
    }

    this.input.keyboard?.on('keydown-ESC', () => navigateBack(this, SCENE_KEYS.hideout));
    this.render();
  }

  private track<T extends Phaser.GameObjects.GameObject>(obj: T): T {
    this.dynamicObjects.push(obj);
    return obj;
  }

  private clearDynamic(): void {
    for (const obj of this.dynamicObjects) obj.destroy();
    this.dynamicObjects.length = 0;
  }

  private render(): void {
    this.clearDynamic();
    const state = getRunState();
    this.renderHud(state);
    this.renderDistricts(state);
    this.renderCrewPanel(state);
    this.renderStartNightButton();

    this.track(
      this.add.text(20, this.scale.height - 10, ko.nav.back, {
        fontFamily: FONT_FAMILY,
        fontSize: '8px',
        color: palette.textMuted,
      }),
    );
  }

  // ── HUD: 밤 번호, 크레딧, 열기 게이지, 예상 열기 증가량 (FR-UI-03, FR-HEAT-02) ──

  private renderHud(state: RunState): void {
    const hudStyle = { fontFamily: FONT_FAMILY, fontSize: '9px', color: palette.textPrimary };

    this.track(
      this.add.text(6, 4, `${ko.map.nightLabel} ${state.night}/${content.balance.maxNights}`, hudStyle),
    );
    this.track(this.add.text(90, 4, `${ko.map.creditsLabel} ${state.credits}`, hudStyle));

    const band = getHeatBand(state.heat, content.balance.heatThresholds);
    this.track(
      createGauge(this, 190, 2, 110, 10, state.heat, 100, {
        fillColor: HEAT_BAND_COLOR[band],
        label: `${ko.map.heatLabel} ${state.heat}/100`,
      }),
    );

    const estimatedHeat = estimateNightHeatIncrease(state, state.currentAssignments);
    this.track(
      this.add.text(190, 14, `${ko.map.heatPreviewLabel} +${estimatedHeat}`, {
        fontFamily: FONT_FAMILY,
        fontSize: '8px',
        color: palette.textMuted,
      }),
    );

    if (!this.selectedDistrictId) {
      this.track(
        this.add.text(310, 4, ko.map.selectDistrictHint, {
          fontFamily: FONT_FAMILY,
          fontSize: '8px',
          color: palette.textMuted,
        }),
      );
    }
  }

  // ── 지도: 3개 층, 소유자 색, 안개 처리 (FR-MAP-02, FR-MAP-04) ──

  private renderDistricts(state: RunState): void {
    TIER_ORDER.forEach((tier, rowIndex) => {
      const districtsInTier = state.districts.filter((d) => {
        const def = content.districts.find((cd) => cd.id === d.id);
        return def?.tier === tier;
      });
      const y = DISTRICTS_TOP_Y + rowIndex * DISTRICT_ROW_GAP;

      this.track(
        this.add.text(6, y, tierLabel(tier), {
          fontFamily: FONT_FAMILY,
          fontSize: '8px',
          color: palette.textMuted,
        }),
      );

      const totalWidth = districtsInTier.length * DISTRICT_BOX_WIDTH + (districtsInTier.length - 1) * 6;
      const startX = Math.max(40, (this.scale.width - totalWidth) / 2);

      districtsInTier.forEach((district, i) => {
        const x = startX + i * (DISTRICT_BOX_WIDTH + 6);
        this.renderDistrictBox(district, x, y + 2);
      });
    });
  }

  private renderDistrictBox(district: District, x: number, y: number): void {
    const isSelected = this.selectedDistrictId === district.id;
    const fogged = district.owner !== 'player' && !district.scouted;
    const colorToken = ownerColorToken(district.owner);

    const rect = this.add
      .rectangle(x, y, DISTRICT_BOX_WIDTH, DISTRICT_BOX_HEIGHT, paletteColorNumber(colorToken), fogged ? 0.45 : 0.85)
      .setOrigin(0, 0)
      .setStrokeStyle(1, paletteColorNumber(isSelected ? 'neonCyan' : 'borderDim'));
    rect.setInteractive({ useHandCursor: true });
    rect.on('pointerdown', () => {
      this.selectedDistrictId = isSelected ? null : district.id;
      this.render();
    });
    this.track(rect);

    this.track(
      this.add
        .text(x + DISTRICT_BOX_WIDTH / 2, y + 3, districtDisplayName(district.id), {
          fontFamily: FONT_FAMILY,
          fontSize: '8px',
          color: palette.textPrimary,
        })
        .setOrigin(0.5, 0),
    );

    const defenseText = fogged ? `${ko.map.defenseLabel} ??` : `${ko.map.defenseLabel} ${district.defense}`;
    this.track(
      this.add
        .text(x + DISTRICT_BOX_WIDTH / 2, y + DISTRICT_BOX_HEIGHT - 10, defenseText, {
          fontFamily: FONT_FAMILY,
          fontSize: '8px',
          color: fogged ? palette.textDisabled : palette.textSecondary,
        })
        .setOrigin(0.5, 0),
    );
  }

  // ── 조직원 배치 패널 (FR-UI-03) ──

  private renderCrewPanel(state: RunState): void {
    const panelHeight = state.crew.length * CREW_ROW_HEIGHT + 8;
    this.track(
      createPanel(this, 4, CREW_PANEL_TOP_Y - 6, this.scale.width - 8, panelHeight, {
        titleText: ko.map.crewPanelTitle,
        borderColor: 'borderBright',
      }),
    );

    state.crew.forEach((crew, index) => {
      this.renderCrewRow(state, crew, CREW_PANEL_TOP_Y + 10 + index * CREW_ROW_HEIGHT);
    });
  }

  private renderCrewRow(state: RunState, crew: CrewMember, y: number): void {
    const nameStyle = { fontFamily: FONT_FAMILY, fontSize: '8px', color: palette.textPrimary };
    const mutedStyle = { fontFamily: FONT_FAMILY, fontSize: '8px', color: palette.textMuted };

    this.track(this.add.text(10, y, crewDisplayName(crew.id), nameStyle));

    if (crew.status !== 'active') {
      this.track(this.add.text(70, y, statusLabel(crew.status), mutedStyle));
      return;
    }

    const assignment = state.currentAssignments.find((a) => a.crewId === crew.id);
    this.track(
      this.add.text(70, y, assignment ? this.describeAssignment(assignment) : ko.map.unassigned, mutedStyle),
    );

    const actions: ReadonlyArray<{ kind: ActionKind; label: string }> = [
      { kind: 'rest', label: ko.map.actionRest },
      { kind: 'scout', label: ko.map.actionScout },
      { kind: 'defend', label: ko.map.actionDefend },
      { kind: 'attack', label: ko.map.actionAttack },
    ];

    let x = 210;
    for (const action of actions) {
      const enabled = action.kind === 'rest' || this.canAssign(state, action.kind);
      this.track(
        createButton(this, x, y - 3, action.label, () => this.assign(crew.id, action.kind), {
          width: 38,
          height: 13,
          disabled: !enabled,
        }),
      );
      x += 40;
    }

    if (assignment) {
      this.track(
        createButton(this, x, y - 3, ko.map.clear, () => this.clearAssignment(crew.id), {
          width: 34,
          height: 13,
        }),
      );
    }
  }

  private describeAssignment(assignment: Assignment): string {
    if (assignment.action === 'rest') return ko.map.actionRest;
    const targetName = assignment.targetDistrictId ? districtDisplayName(assignment.targetDistrictId) : '';
    const actionLabel =
      assignment.action === 'attack'
        ? ko.map.actionAttack
        : assignment.action === 'defend'
          ? ko.map.actionDefend
          : assignment.action === 'scout'
            ? ko.map.actionScout
            : ko.map.actionOperate;
    return `${actionLabel} → ${targetName}`;
  }

  // ── 배치 규칙 검증 (FR-MAP-03) ──

  private canAssign(state: RunState, action: ActionKind): boolean {
    if (!this.selectedDistrictId) return false;
    const district = state.districts.find((d) => d.id === this.selectedDistrictId);
    if (!district) return false;

    if (action === 'attack') return this.isAttackable(state, district);
    if (action === 'defend') return district.owner === 'player';
    if (action === 'scout') return !district.scouted;
    return true;
  }

  /** 내가 소유한 구역과 인접해야 공격할 수 있다. 상층은 중층 구역을 하나 이상 소유해야 한다 (FR-MAP-03). */
  private isAttackable(state: RunState, district: District): boolean {
    if (district.owner === 'player') return false;

    const def = content.districts.find((d) => d.id === district.id);
    if (!def) return false;

    const playerDistrictIds = new Set(state.districts.filter((d) => d.owner === 'player').map((d) => d.id));
    const isAdjacentToPlayer = def.adjacentDistrictIds.some((id) => playerDistrictIds.has(id));
    if (!isAdjacentToPlayer) return false;

    if (def.tier === 'upper') {
      const ownsMidTierDistrict = state.districts.some((d) => {
        if (d.owner !== 'player') return false;
        const ownedDef = content.districts.find((cd) => cd.id === d.id);
        return ownedDef?.tier === 'mid';
      });
      if (!ownsMidTierDistrict) return false;
    }

    return true;
  }

  // ── 배치 변경 (조직원을 행동 슬롯에 배치·해제) ──

  private assign(crewIdValue: CrewId, action: ActionKind): void {
    const state = getRunState();
    const filtered = state.currentAssignments.filter((a) => a.crewId !== crewIdValue);

    const assignment: Assignment =
      action === 'rest'
        ? { crewId: crewIdValue, action: 'rest' }
        : { crewId: crewIdValue, action, targetDistrictId: this.selectedDistrictId ?? undefined };

    if (action !== 'rest' && !assignment.targetDistrictId) return;

    setRunState({ ...state, currentAssignments: [...filtered, assignment] });
    this.render();
  }

  private clearAssignment(crewIdValue: CrewId): void {
    const state = getRunState();
    setRunState({
      ...state,
      currentAssignments: state.currentAssignments.filter((a) => a.crewId !== crewIdValue),
    });
    this.render();
  }

  // ── 밤 시작 (T-13 resolveNight 호출) ──

  private renderStartNightButton(): void {
    this.track(
      createButton(this, this.scale.width - 90, this.scale.height - 22, ko.map.startNight, () => this.startNight(), {
        width: 84,
      }),
    );
  }

  private startNight(): void {
    const state = getRunState();
    const rng = getRunRng();
    const { state: newState } = resolveNight(state, state.currentAssignments, rng);
    setRunState(newState);
    persistRun();
    this.selectedDistrictId = null;
    navigateTo(this, SCENE_KEYS.report);
  }
}
