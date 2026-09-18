/**
 * tests/simulateRun.test.ts
 *
 * T-20 완료 조건: 헤드리스 시뮬레이터가 봇별로 런을 끝까지 돌려 통계를 낼 수
 * 있는 유효한 결과를 만든다.
 */

import { describe, expect, it } from 'vitest';
import { AGGRESSIVE_BOT, CAREFUL_BOT } from '../tools/bots';
import { simulateOneRun } from '../tools/simulateRun';

const VALID_END_REASONS = [
  'victory_corporate',
  'victory_rivals',
  'defeat_boss_dead',
  'defeat_bankrupt',
  'defeat_time_out',
  'defeat_raid',
];

describe('T-20 simulateOneRun', () => {
  it('유효한 RunStats를 반환한다', () => {
    const stats = simulateOneRun('sim-test-1', CAREFUL_BOT);

    expect(VALID_END_REASONS).toContain(stats.endReason);
    expect(stats.survivedNights).toBeGreaterThanOrEqual(1);
    expect(stats.peakHeat).toBeGreaterThanOrEqual(0);
    expect(stats.peakHeat).toBeLessThanOrEqual(100);
    expect(typeof stats.isVictory).toBe('boolean');
    expect(stats.legacyPointsAwarded).toBeGreaterThanOrEqual(0);
  });

  it('같은 시드·봇이면 같은 결과가 나온다 (NFR-02)', () => {
    const a = simulateOneRun('sim-determinism', AGGRESSIVE_BOT);
    const b = simulateOneRun('sim-determinism', AGGRESSIVE_BOT);
    expect(a).toEqual(b);
  });

  it('30밤을 넘지 않는다 (FR-RUN-02)', () => {
    const stats = simulateOneRun('sim-max-nights', CAREFUL_BOT);
    expect(stats.survivedNights).toBeLessThanOrEqual(30);
  });

  it('신중형과 공격형은 다른 시드에서 서로 다른 궤적을 보일 수 있다', () => {
    const results = Array.from({ length: 20 }, (_, i) => ({
      careful: simulateOneRun(`sim-diff-${i}`, CAREFUL_BOT),
      aggressive: simulateOneRun(`sim-diff-${i}`, AGGRESSIVE_BOT),
    }));
    const anyDifferent = results.some((r) => r.careful.peakHeat !== r.aggressive.peakHeat);
    expect(anyDifferent).toBe(true);
  });
});
