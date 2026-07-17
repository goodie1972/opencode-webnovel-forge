import { test, expect } from 'bun:test';
import { forgottenCheck } from '../../../../src/writer/control/forgotten-check';
import type { DynamicState } from '../../../../src/writer/control/types';

test('forgottenCheck returns clean result when no elements are overdue', () => {
  const state: DynamicState = {
    lastChapterIndex: 10,
    characterStates: { hero: { lastAppearance: 9, status: 'active', relationshipChanges: [] } },
    plotlineProgress: { main: { lastAdvancement: 8, status: 'active' } },
    foreshadowingStatus: {},
    emotionalDebts: [],
    pendingConfirmations: [],
    chaptersWritten: 10,
  };
  
  const result = forgottenCheck(state, 10);
  expect(result.overdueCharacters.length).toBe(0);
  expect(result.coldPlotlines.length).toBe(0);
  expect(result.overallScore).toBe(100);
});

test('forgottenCheck detects overdue characters', () => {
  const state: DynamicState = {
    lastChapterIndex: 10,
    characterStates: {
      hero: { lastAppearance: 7, status: 'active', relationshipChanges: [] },
      villain: { lastAppearance: 5, status: 'idle', relationshipChanges: [] },
    },
    plotlineProgress: {},
    foreshadowingStatus: {},
    emotionalDebts: [],
    pendingConfirmations: [],
    chaptersWritten: 10,
  };
  
  const result = forgottenCheck(state, 10);
  expect(result.overdueCharacters).toContain('hero'); // 3 chapters since
  expect(result.overdueCharacters).toContain('villain'); // 5 chapters since
  expect(result.overallScore).toBeLessThan(100);
});

test('forgottenCheck detects cold plotlines', () => {
  const state: DynamicState = {
    lastChapterIndex: 10,
    characterStates: {},
    plotlineProgress: {
      main: { lastAdvancement: 4, status: 'planning' },
      subplotA: { lastAdvancement: 9, status: 'active' },
    },
    foreshadowingStatus: {},
    emotionalDebts: [],
    pendingConfirmations: [],
    chaptersWritten: 10,
  };
  
  const result = forgottenCheck(state, 10);
  expect(result.coldPlotlines).toContain('main');
  expect(result.coldPlotlines).not.toContain('subplotA');
});

test('forgottenCheck calculates score correctly', () => {
  const state: DynamicState = {
    lastChapterIndex: 20,
    characterStates: {
      a: { lastAppearance: 15, status: 'active', relationshipChanges: [] },
      b: { lastAppearance: 10, status: 'idle', relationshipChanges: [] },
      c: { lastAppearance: 5, status: 'gone', relationshipChanges: [] },
    },
    plotlineProgress: {
      main: { lastAdvancement: 14, status: 'active' },
      sub: { lastAdvancement: 10, status: 'planning' },
    },
    foreshadowingStatus: {},
    emotionalDebts: ['debt-1'],
    pendingConfirmations: [],
    chaptersWritten: 20,
  };
  
  const result = forgottenCheck(state, 20);
  expect(result.overdueCharacters.length).toBe(3); // a (diff=5), b (diff=10), c (diff=15) all >= 3
  expect(result.coldPlotlines.length).toBe(2); // main (diff=6 >= 5), sub (diff=10 >= 5)
  expect(result.unreturnedDebts).toContain('debt-1');
  expect(result.overallScore).toBe(Math.max(0, 100 - 5 * 15));
});

test('forgottenCheck handles empty state', () => {
  const state: DynamicState = {
    lastChapterIndex: 0,
    characterStates: {},
    plotlineProgress: {},
    foreshadowingStatus: {},
    emotionalDebts: [],
    pendingConfirmations: [],
    chaptersWritten: 0,
  };
  
  const result = forgottenCheck(state, 1);
  expect(result.overallScore).toBe(100);
  expect(result.overdueCharacters.length).toBe(0);
});
