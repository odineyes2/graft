/**
 * src/save/storage.ts
 *
 * localStorage 접근을 감싸는 최소 인터페이스. src/core/는 이 파일이 있는
 * src/save/로만 브라우저 의존(localStorage) 코드를 격리한다는 CLAUDE.md
 * 규칙을 따른다. 테스트에서는 실제 localStorage 대신 메모리 기반 구현을
 * 주입할 수 있다 (Node 테스트 환경에는 localStorage가 없다).
 *
 * T-21 산출물.
 */

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** 브라우저의 전역 localStorage를 반환한다. 없는 환경(Node 등)에서는 에러를 던진다. */
export function getBrowserStorage(): KeyValueStorage {
  if (typeof localStorage === 'undefined') {
    throw new Error(
      'localStorage를 쓸 수 없는 환경이다. 테스트에서는 KeyValueStorage를 직접 넘겨야 한다.',
    );
  }
  return localStorage;
}
