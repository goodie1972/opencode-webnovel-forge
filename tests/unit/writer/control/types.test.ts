import { test, expect } from 'bun:test';

import type { ChapterControlCard, DynamicState, ForgottenCheckResult } from '../../../../src/writer/control/types';

test('ChapterControlCard has required fields', () => {
  const card: ChapterControlCard = {
    chapterIndex: 1,
    title: 'test',
    mission: 'must change something',
    linesToAdvance: ['main'],
    debtsToReturn: ['foreshadow-1'],
    conflict: 'protagonist vs antagonist',
    endingResidue: 'cliffhanger',
    characterStateChanges: ['protagonist determined'],
  };
  expect(card.chapterIndex).toBe(1);
  expect(card.mission).toBeTruthy();
  expect(card.linesToAdvance.length).toBeGreaterThan(0);
});

test('DynamicState has all required sections', () => {
  const state: DynamicState = {
    lastChapterIndex: 1,
    characterStates: {},
    plotlineProgress: {},
    foreshadowingStatus: {},
    emotionalDebts: [],
    pendingConfirmations: [],
    chaptersWritten: 0,
  };
  expect(state.chaptersWritten).toBe(0);
});

test('ForgottenCheckResult structure', () => {
  const result: ForgottenCheckResult = {
    overdueCharacters: [],
    coldPlotlines: [],
    unreturnedDebts: [],
    foreshadowingExpiring: [],
    overallScore: 100,
  };
  expect(result.overallScore).toBe(100);
});