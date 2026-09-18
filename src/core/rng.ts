/**
 * src/core/rng.ts
 *
 * 시드 기반 결정론적 RNG. 게임 상태에 영향을 주는 모든 무작위성은 이 모듈을
 * 통해서만 발생해야 한다 (CLAUDE.md, NFR-02). Math.random() 사용 금지.
 * 순수 TypeScript — Phaser / DOM / window / localStorage 참조 없음.
 *
 * T-11 산출물.
 */

/** 직렬화 가능한 RNG 내부 상태. 저장·불러오기 시 그대로 보존한다. */
export interface RngState {
  readonly state: number;
}

/** 가중치 선택 항목 */
export interface WeightedOption<T> {
  readonly item: T;
  readonly weight: number;
}

/**
 * mulberry32 알고리즘 기반 32비트 결정론적 PRNG.
 * 같은 초기 상태(state)에서 같은 순서로 호출하면 항상 같은 결과가 나온다.
 */
export class Rng {
  private state: number;

  constructor(state: number) {
    this.state = state >>> 0;
  }

  /** [0, 1) 구간의 실수 하나를 뽑고 내부 상태를 전진시킨다. */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** [min, max) 구간의 실수. */
  float(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** [min, max] 양 끝 포함 정수. */
  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /** 배열에서 원소 하나를 균등 확률로 고른다. 빈 배열이면 에러. */
  pick<T>(items: ReadonlyArray<T>): T {
    if (items.length === 0) {
      throw new Error('Rng.pick: 빈 배열에서는 고를 수 없다');
    }
    return items[this.int(0, items.length - 1)] as T;
  }

  /** 가중치에 비례한 확률로 항목 하나를 고른다. 가중치 합은 0보다 커야 한다. */
  weightedPick<T>(options: ReadonlyArray<WeightedOption<T>>): T {
    const totalWeight = options.reduce((sum, o) => sum + o.weight, 0);
    if (options.length === 0 || totalWeight <= 0) {
      throw new Error('Rng.weightedPick: 가중치 합이 0보다 커야 한다');
    }
    let roll = this.float(0, totalWeight);
    for (const option of options) {
      roll -= option.weight;
      if (roll < 0) return option.item;
    }
    // 부동소수점 오차로 roll이 끝까지 남는 극히 드문 경우 마지막 항목을 반환한다.
    return options[options.length - 1]!.item;
  }

  /** Fisher-Yates 셔플. 입력 배열을 변경하지 않고 새 배열을 반환한다. */
  shuffle<T>(items: ReadonlyArray<T>): T[] {
    const result = items.slice();
    for (let i = result.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [result[i], result[j]] = [result[j] as T, result[i] as T];
    }
    return result;
  }

  /** 현재 내부 상태를 직렬화 가능한 형태로 꺼낸다 (저장용). */
  getState(): RngState {
    return { state: this.state };
  }
}

/** 문자열 시드를 32비트 정수 시드 값으로 변환한다 (xmur3 해시). */
function hashSeed(seed: string): number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  h ^= h >>> 16;
  return h >>> 0;
}

/** 문자열 시드로부터 새 RNG를 만든다 (예: 런 시드, FR-RUN-01). */
export function createRng(seed: string): Rng {
  return new Rng(hashSeed(seed));
}

/** 저장된 RngState로부터 RNG를 복원한다. 이어지는 next() 결과가 저장 전과 동일하다. */
export function restoreRng(state: RngState): Rng {
  return new Rng(state.state);
}
