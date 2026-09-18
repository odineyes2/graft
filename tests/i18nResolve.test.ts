/**
 * tests/i18nResolve.test.ts
 *
 * T-33: t()가 src/data/*.json의 textKey·choiceKey 같은 점(.) 경로를
 * ko.ts의 실제 문자열로 바꾸는지 확인한다.
 */

import { describe, expect, it } from 'vitest';
import { t } from '../src/i18n/resolve';

describe('T-33 i18n 점(.) 경로 해석', () => {
  it('중첩된 경로를 실제 문자열로 바꾼다', () => {
    expect(t('common.gameTitle')).toBe('GRAFT');
    expect(t('events.evt_crackdown_bribe_check.text')).toEqual(expect.any(String));
  });

  it('존재하지 않는 경로면 에러를 던진다', () => {
    expect(() => t('events.not_a_real_event.text')).toThrow();
    expect(() => t('not.a.real.path')).toThrow();
  });

  it('문자열이 아닌 중간 노드를 가리키면 에러를 던진다', () => {
    expect(() => t('common')).toThrow();
  });
});
