/**
 * tests/rng.test.ts
 *
 * T-11 완료 조건:
 * - 같은 시드로 10,000회 호출한 결과가 항상 동일하다.
 * - RNG 상태를 저장·복원한 뒤 이어지는 값이 저장 전과 동일하다.
 */

import { describe, expect, it } from 'vitest';
import { createRng, restoreRng } from '../src/core/rng';

describe('T-11 시드 RNG', () => {
  it('같은 시드로 10,000회 호출한 결과가 항상 동일하다', () => {
    const a = createRng('graft-seed');
    const b = createRng('graft-seed');

    const seqA = Array.from({ length: 10_000 }, () => a.next());
    const seqB = Array.from({ length: 10_000 }, () => b.next());

    expect(seqA).toEqual(seqB);
  });

  it('다른 시드는 다른 결과를 낸다', () => {
    const a = createRng('seed-1');
    const b = createRng('seed-2');
    const seqA = Array.from({ length: 100 }, () => a.next());
    const seqB = Array.from({ length: 100 }, () => b.next());
    expect(seqA).not.toEqual(seqB);
  });

  it('next()는 항상 [0, 1) 구간이다', () => {
    const rng = createRng('range-check');
    for (let i = 0; i < 10_000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('RNG 상태를 저장·복원한 뒤 이어지는 값이 저장 전과 동일하다', () => {
    const original = createRng('save-restore-seed');

    // 앞부분을 소비해 상태를 어느 정도 진행시킨다.
    for (let i = 0; i < 37; i++) original.next();

    const savedState = original.getState();
    const continuedFromOriginal = Array.from({ length: 50 }, () => original.next());

    const restored = restoreRng(savedState);
    const continuedFromRestored = Array.from({ length: 50 }, () => restored.next());

    expect(continuedFromRestored).toEqual(continuedFromOriginal);
  });

  it('getState()는 직렬화 가능한 순수 객체다 (JSON 왕복 가능)', () => {
    const rng = createRng('json-roundtrip');
    for (let i = 0; i < 5; i++) rng.next();

    const json = JSON.stringify(rng.getState());
    const restored = restoreRng(JSON.parse(json) as ReturnType<typeof rng.getState>);

    expect(restored.next()).toBe(rng.next());
  });

  it('int(min, max)는 양 끝을 포함한 정수만 반환한다', () => {
    const rng = createRng('int-range');
    const seen = new Set<number>();
    for (let i = 0; i < 2_000; i++) {
      const v = rng.int(1, 6);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(6);
      seen.add(v);
    }
    expect(seen).toEqual(new Set([1, 2, 3, 4, 5, 6]));
  });

  it('float(min, max)는 구간 내 실수를 반환한다', () => {
    const rng = createRng('float-range');
    for (let i = 0; i < 1_000; i++) {
      const v = rng.float(10, 20);
      expect(v).toBeGreaterThanOrEqual(10);
      expect(v).toBeLessThan(20);
    }
  });

  it('pick()은 배열 안의 값만 반환하고, 같은 시드면 같은 순서로 고른다', () => {
    const items = ['a', 'b', 'c', 'd'] as const;
    const a = createRng('pick-seed');
    const b = createRng('pick-seed');
    const picksA = Array.from({ length: 20 }, () => a.pick(items));
    const picksB = Array.from({ length: 20 }, () => b.pick(items));
    expect(picksA).toEqual(picksB);
    expect(picksA.every((v) => items.includes(v))).toBe(true);
  });

  it('pick()은 빈 배열에서 에러를 던진다', () => {
    const rng = createRng('pick-empty');
    expect(() => rng.pick([])).toThrow();
  });

  it('shuffle()은 원본 배열을 바꾸지 않고 같은 원소를 재배열한다', () => {
    const rng = createRng('shuffle-seed');
    const original = [1, 2, 3, 4, 5];
    const shuffled = rng.shuffle(original);

    expect(original).toEqual([1, 2, 3, 4, 5]); // 원본 불변
    expect(shuffled).toHaveLength(original.length);
    expect([...shuffled].sort()).toEqual([...original].sort());
  });

  it('shuffle()은 같은 시드면 같은 순서로 섞는다', () => {
    const a = createRng('shuffle-repro');
    const b = createRng('shuffle-repro');
    const items = ['a', 'b', 'c', 'd', 'e', 'f'];
    expect(a.shuffle(items)).toEqual(b.shuffle(items));
  });

  it('weightedPick()은 가중치가 0인 항목을 거의 고르지 않는다', () => {
    const rng = createRng('weighted-seed');
    const counts: Record<string, number> = { heavy: 0, light: 0, zero: 0 };
    for (let i = 0; i < 2_000; i++) {
      const picked = rng.weightedPick([
        { item: 'heavy', weight: 98 },
        { item: 'light', weight: 2 },
        { item: 'zero', weight: 0 },
      ]);
      counts[picked] = (counts[picked] ?? 0) + 1;
    }
    expect(counts.zero).toBe(0);
    expect(counts.heavy).toBeGreaterThan(counts.light);
  });

  it('weightedPick()은 가중치 합이 0 이하면 에러를 던진다', () => {
    const rng = createRng('weighted-empty');
    expect(() => rng.weightedPick([])).toThrow();
    expect(() => rng.weightedPick([{ item: 'x', weight: 0 }])).toThrow();
  });
});
