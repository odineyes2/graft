import { describe, expect, it } from 'vitest';
import { CORE_VERSION } from '../src/core/version';

describe('core/version', () => {
  it('exposes a semver-like version string', () => {
    expect(CORE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
