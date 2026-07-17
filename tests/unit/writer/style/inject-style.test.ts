import { describe, it, expect, beforeEach } from 'bun:test';
import { injectStyle, clearMasterCache, findMaster } from '../../../../src/writer/style/inject-style';

describe('injectStyle', () => {
  beforeEach(() => {
    clearMasterCache();
  });

  it('appends style instructions for known master', () => {
    const base = '你是一个网文写手。';
    const result = injectStyle(base, '辰东流');
    expect(result).toContain('## 风格指令');
    expect(result).toContain('风格指南');
    expect(result).toContain('风格特征');
    expect(result).not.toBe(base);
  });

  it('matches by displayName', () => {
    const base = 'test';
    const result = injectStyle(base, '辰东流');
    expect(result).toContain('## 风格指令');
  });

  it('returns base prompt unchanged for unknown master', () => {
    const base = '你是一个网文写手。';
    const result = injectStyle(base, '不存在的风格');
    expect(result).toBe(base);
  });

  it('returns base prompt unchanged for empty style name', () => {
    const base = 'test';
    const result = injectStyle(base, '');
    expect(result).toBe(base);
  });

  it('cache works across calls', () => {
    const base = 'test';
    const r1 = injectStyle(base, '辰东流');
    const r2 = injectStyle(base, '辰东流');
    expect(r1).toBe(r2);
  });
});

describe('findMaster', () => {
  beforeEach(() => {
    clearMasterCache();
  });

  it('finds master by name', () => {
    const m = findMaster('辰东流');
    expect(m).toBeDefined();
    expect(m!.name).toBe('辰东流');
  });

  it('finds master by displayName', () => {
    const m = findMaster('辰东流');
    expect(m).toBeDefined();
  });

  it('returns undefined for unknown master', () => {
    expect(findMaster('unknown')).toBeUndefined();
  });
});
