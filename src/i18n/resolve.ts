/**
 * src/i18n/resolve.ts
 *
 * src/data/*.json의 nameKey·descriptionKey·textKey·choiceKey는 ko.ts 안의
 * 점(.) 경로 문자열이다(ko.ts 상단 주석 참고). 이 모듈은 그 경로를 실제
 * 문자열로 바꾼다 — 이벤트 카드처럼 텍스트가 전부 데이터에서 오는 화면에서 쓴다.
 */

import { ko } from './ko';

/** "events.evt_x.text" 같은 점(.) 경로를 ko 객체에서 찾아 문자열로 반환한다. */
export function t(key: string): string {
  const parts = key.split('.');
  let node: unknown = ko;

  for (const part of parts) {
    if (typeof node !== 'object' || node === null || !(part in node)) {
      throw new Error(`i18n 키를 찾을 수 없다: ${key}`);
    }
    node = (node as Record<string, unknown>)[part];
  }

  if (typeof node !== 'string') {
    throw new Error(`i18n 키가 문자열이 아니다: ${key}`);
  }

  return node;
}
