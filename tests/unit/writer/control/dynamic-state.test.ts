import { test, expect, beforeAll, afterAll } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { tmpdir } from 'node:os';
import { NovelProjectManager } from '../../../../src/novel/project';
import {
  createEmptyState,
  loadDynamicState,
  saveDynamicState,
  updateAfterChapter,
} from '../../../../src/writer/control/dynamic-state';
import type { ChapterControlCard, DynamicState } from '../../../../src/writer/control/types';

let testDir: string;
let dirName: string;
let pm: NovelProjectManager;

beforeAll(() => {
  testDir = path.join(tmpdir(), `dyn_state_${Date.now()}`);
  fs.mkdirSync(testDir, { recursive: true });
  pm = new NovelProjectManager(testDir);
  const project = pm.create({ title: '测试', author: '测试', genre: '玄幻' });
  dirName = project.dirName;
});

afterAll(() => {
  try { fs.rmSync(testDir, { recursive: true, force: true }); } catch { /* ok */ }
});

test('createEmptyState returns valid default state', () => {
  const state = createEmptyState();
  expect(state.lastChapterIndex).toBe(0);
  expect(state.chaptersWritten).toBe(0);
  expect(Object.keys(state.characterStates).length).toBe(0);
  expect(state.emotionalDebts.length).toBe(0);
});

test('save and load dynamic state', () => {
  const state = createEmptyState();
  state.chaptersWritten = 5;
  state.characterStates = { hero: { lastAppearance: 3, status: 'active', relationshipChanges: [] } };
  
  saveDynamicState(pm.projectsDir, dirName, state);
  
  const loaded = loadDynamicState(pm.projectsDir, dirName);
  expect(loaded).not.toBeNull();
  expect(loaded!.chaptersWritten).toBe(5);
  expect(loaded!.characterStates.hero.lastAppearance).toBe(3);
});

test('loadDynamicState returns null for non-existent file', () => {
  const loaded = loadDynamicState(pm.projectsDir, 'nonexistent_project');
  expect(loaded).toBeNull();
});

test('updateAfterChapter increments chaptersWritten and updates character states', () => {
  const state = createEmptyState();
  state.characterStates = { hero: { lastAppearance: 1, status: 'active', relationshipChanges: [] } };
  
  const card: ChapterControlCard = {
    chapterIndex: 2,
    title: '第二章',
    mission: '推进主线',
    linesToAdvance: ['main'],
    debtsToReturn: [],
    conflict: '主角 vs 反派',
    endingResidue: '悬念',
    characterStateChanges: ['hero: determined'],
  };
  
  const updated = updateAfterChapter(state, card);
  
  expect(updated.chaptersWritten).toBe(1);
  expect(updated.lastChapterIndex).toBe(2);
  expect(updated.characterStates.hero.lastAppearance).toBe(2);
  expect(updated.characterStates.hero.status).toBe('determined');
});

test('updateAfterChapter tracks emotional debts', () => {
  const state = createEmptyState();
  
  const card: ChapterControlCard = {
    chapterIndex: 1,
    title: '第一章',
    mission: '任务',
    linesToAdvance: [],
    debtsToReturn: ['debt-1', 'debt-2'],
    conflict: '',
    endingResidue: '',
    characterStateChanges: [],
  };
  
  const updated = updateAfterChapter(state, card);
  expect(updated.emotionalDebts).toContain('debt-1');
  expect(updated.emotionalDebts).toContain('debt-2');
  expect(updated.emotionalDebts.length).toBe(2);
});

test('updateAfterChapter does not duplicate debts', () => {
  const state = createEmptyState();
  state.emotionalDebts = ['existing-debt'];
  
  const card: ChapterControlCard = {
    chapterIndex: 1,
    title: '第一章',
    mission: '任务',
    linesToAdvance: [],
    debtsToReturn: ['existing-debt', 'new-debt'],
    conflict: '',
    endingResidue: '',
    characterStateChanges: [],
  };
  
  const updated = updateAfterChapter(state, card);
  expect(updated.emotionalDebts.filter(d => d === 'existing-debt').length).toBe(1);
  expect(updated.emotionalDebts).toContain('new-debt');
});
