/**
 * tests/types.test.ts
 *
 * T-10 완료 조건:
 * - 타입만으로 초기 런 상태 1개를 생성하는 테스트가 통과한다.
 * - Phaser·DOM 참조가 없다 (정적 검사로 보장).
 */

import { describe, expect, it } from 'vitest';
import { createInitialRunState } from '../src/core/initialState';

describe('T-10 초기 런 상태 생성', () => {
  const state = createInitialRunState('test-seed-2026');

  it('시드가 그대로 저장된다', () => {
    expect(state.seed).toBe('test-seed-2026');
  });

  it('시작 밤은 1이고 계획 단계다', () => {
    expect(state.night).toBe(1);
    expect(state.phase).toBe('planning');
  });

  it('초기 크레딧·열기·평판이 올바르다', () => {
    expect(state.credits).toBe(500);
    expect(state.heat).toBe(5);
    expect(state.reputation).toBe(20);
  });

  it('구역 6개가 생성된다 (FR-MAP-01)', () => {
    expect(state.districts).toHaveLength(6);
  });

  it('시작 구역(슬럼)은 플레이어 소유이고 정찰 완료다', () => {
    const slums = state.districts.find(d => d.id === 'slums');
    expect(slums).toBeDefined();
    expect(slums?.owner).toBe('player');
    expect(slums?.scouted).toBe(true);
  });

  it('다른 구역은 아직 정찰되지 않았다', () => {
    const unscouted = state.districts.filter(d => d.id !== 'slums');
    expect(unscouted.every(d => !d.scouted)).toBe(true);
  });

  it('기업 지구는 상층(upper)이다 (FR-MAP-01)', () => {
    const corp = state.districts.find(d => d.id === 'corporate_zone');
    expect(corp?.tier).toBe('upper');
  });

  it('초기 조직원은 보스 1명 + 조직원 2명 = 총 3명 (FR-CREW-02)', () => {
    expect(state.crew).toHaveLength(3);
    const boss = state.crew.find(c => c.isBoss);
    expect(boss).toBeDefined();
    expect(state.crew.filter(c => !c.isBoss)).toHaveLength(2);
  });

  it('보스는 사망 불가 마커를 가진다', () => {
    const boss = state.crew.find(c => c.isBoss);
    expect(boss?.status).toBe('active');
  });

  it('경쟁 갱이 2개다 (FR-AI-01)', () => {
    expect(state.rivals).toHaveLength(2);
    expect(state.rivals[0].personality).toBe('expansionist');
    expect(state.rivals[1].personality).toBe('aggressive');
  });

  it('런은 종료 상태가 아니다', () => {
    expect(state.ended).toBe(false);
    expect(state.endReason).toBeNull();
  });

  it('스키마 버전이 있다 (NFR-05)', () => {
    expect(state.schemaVersion).toBe(1);
  });

  it('유산 보너스: start_credits 적용 시 크레딧 증가', () => {
    const boosted = createInitialRunState('seed-b', ['start_credits']);
    expect(boosted.credits).toBe(800);
  });

  it('유산 보너스: start_extra_crew 적용 시 조직원 4명', () => {
    const s = createInitialRunState('seed-c', ['start_extra_crew']);
    expect(s.crew).toHaveLength(4);
  });

  it('유산 보너스: start_less_heat 적용 시 열기 감소', () => {
    const s = createInitialRunState('seed-d', ['start_less_heat']);
    expect(s.heat).toBe(0); // 5 - 5 = 0
  });

  it('능력치 범위가 1~10 내에 있다', () => {
    for (const member of state.crew) {
      const { force, tech, negotiation, stealth } = member.baseStats;
      for (const v of [force, tech, negotiation, stealth]) {
        expect(v).toBeGreaterThanOrEqual(1);
        expect(v).toBeLessThanOrEqual(10);
      }
    }
  });

  it('인간성·충성도가 0~100 범위다', () => {
    for (const member of state.crew) {
      expect(member.humanity).toBeGreaterThanOrEqual(0);
      expect(member.humanity).toBeLessThanOrEqual(100);
      expect(member.loyalty).toBeGreaterThanOrEqual(0);
      expect(member.loyalty).toBeLessThanOrEqual(100);
    }
  });
});
