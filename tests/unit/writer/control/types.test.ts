import { test, expect } from 'bun:test';

import type { ChapterControlCard, CharacterStateChange, DynamicState, ForgottenCheckResult } from '../../../../src/writer/control/types';

test('ChapterControlCard has required fields', () => {
  const card: ChapterControlCard = {
    chapterIndex: 1,
    title: 'test',
    mission: 'must change something',
    linesToAdvance: ['main'],
    debtsToReturn: ['foreshadow-1'],
    conflict: 'protagonist vs antagonist',
    endingResidue: 'cliffhanger',
    characterStateChanges: [{ characterId: 'protagonist', status: 'determined' }],
  };
  expect(card.chapterIndex).toBe(1);
  expect(card.mission).toBeTruthy();
  expect(card.linesToAdvance.length).toBeGreaterThan(0);
});

test('CharacterStateChange supports enriched fields', () => {
  const change: CharacterStateChange = {
    characterId: 'hero',
    status: 'active',
    emotionalState: '愤怒',
    relationshipChanges: [
      { targetName: 'villain', delta: -10, description: '冲突升级' },
    ],
    development: '成长弧 — 开始面对内心阴影',
  };
  expect(change.characterId).toBe('hero');
  expect(change.emotionalState).toBe('愤怒');
  expect(change.relationshipChanges).toHaveLength(1);
  expect(change.development).toBeTruthy();
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