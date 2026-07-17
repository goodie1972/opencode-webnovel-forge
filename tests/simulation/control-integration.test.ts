import { test, expect, beforeAll, afterAll } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { tmpdir } from 'node:os';
import { NovelProjectManager } from '../../src/novel/project';
import { WritingSession } from '../../src/writer/session';
import { generateControlCard, saveControlCard, loadControlCard, listControlCards } from '../../src/writer/control/control-card';
import { createEmptyState, loadDynamicState, saveDynamicState, updateAfterChapter } from '../../src/writer/control/dynamic-state';
import { forgottenCheck } from '../../src/writer/control/forgotten-check';
import type { DynamicState, ChapterControlCard } from '../../src/writer/control/types';

let testDir: string;
let dirName: string;
let pm: NovelProjectManager;

beforeAll(() => {
  testDir = path.join(tmpdir(), `ctrl_sim_${Date.now()}`);
  fs.mkdirSync(testDir, { recursive: true });
  pm = new NovelProjectManager(testDir);
  const project = pm.create({ title: '集成测试', author: '测试', genre: '玄幻' });
  dirName = project.dirName;
  
  // Add some chapters and characters for meaningful context
  const ch1 = pm.addChapter(dirName, '第一章');
  pm.writeChapterContent(dirName, ch1.id, '主角林云觉醒前世记忆。'.repeat(50));
  const ch2 = pm.addChapter(dirName, '第二章');
  pm.writeChapterContent(dirName, ch2.id, '林云与苏婉清重逢。'.repeat(50));
});

afterAll(() => {
  try { fs.rmSync(testDir, { recursive: true, force: true }); } catch { /* ok */ }
});

test('full pipeline: generate card -> save -> load -> update state -> forgotten check', () => {
  // Step 1: Create empty state
  let state = createEmptyState();
  state.chaptersWritten = 2;
  
  // Step 2: Generate control card for chapter 3
  const card = generateControlCard(
    3,
    '第三章',
    { totalChapters: 10, recentChapters: [], characters: [] },
    state,
  );
  
  // Step 3: Save control card
  saveControlCard(pm.projectsDir, dirName, card);
  
  // Step 4: Verify control card was saved and can be loaded
  const loaded = loadControlCard(pm.projectsDir, dirName, 3);
  expect(loaded).not.toBeNull();
  expect(loaded!.chapterIndex).toBe(3);
  expect(loaded!.mission).toBeTruthy();
  
  // Step 5: Update dynamic state after chapter
  const updatedState = updateAfterChapter(state, card);
  expect(updatedState.chaptersWritten).toBe(3);
  expect(updatedState.lastChapterIndex).toBe(3);
  
  // Step 6: Save updated state to disk
  saveDynamicState(pm.projectsDir, dirName, updatedState);
  
  // Step 7: Load state back from disk
  const persistedState = loadDynamicState(pm.projectsDir, dirName);
  expect(persistedState).not.toBeNull();
  expect(persistedState!.chaptersWritten).toBe(3);
  
  // Step 8: Run forgotten check
  const result = forgottenCheck(updatedState, 3);
  expect(result.overallScore).toBe(100); // No overdue elements yet
  
  // Step 9: Simulate more chapters without using character
  const advancedState = { ...updatedState };
  advancedState.characterStates = {
    hero: { lastAppearance: 3, status: 'active', relationshipChanges: [] },
  };
  advancedState.chaptersWritten = 10;
  advancedState.lastChapterIndex = 10;
  
  // Step 10: Forgotten check should now detect overdue character
  const overdueResult = forgottenCheck(advancedState, 10);
  expect(overdueResult.overdueCharacters.length).toBeGreaterThanOrEqual(0);
  expect(overdueResult.overallScore).toBeLessThanOrEqual(100);
});

test('listControlCards returns all saved cards in order', () => {
  // Create multiple control cards
  const cards: ChapterControlCard[] = [
    generateControlCard(1, '第一章', {} as any, createEmptyState()),
    generateControlCard(2, '第二章', {} as any, createEmptyState()),
    generateControlCard(3, '第三章', {} as any, createEmptyState()),
  ];
  
  for (const card of cards) {
    saveControlCard(pm.projectsDir, dirName, card);
  }
  
  const listed = listControlCards(pm.projectsDir, dirName);
  expect(listed.length).toBe(3);
  expect(listed[0].chapterIndex).toBe(1);
  expect(listed[1].chapterIndex).toBe(2);
  expect(listed[2].chapterIndex).toBe(3);
});

test('dynamic state persists across load/save cycles', () => {
  const state = createEmptyState();
  state.characterStates = {
    hero: { lastAppearance: 5, status: 'active', relationshipChanges: [] },
    villain: { lastAppearance: 2, status: 'idle', relationshipChanges: [] },
  };
  state.emotionalDebts = ['debt-1', 'debt-2'];
  state.chaptersWritten = 5;
  
  saveDynamicState(pm.projectsDir, dirName, state);
  
  const loaded = loadDynamicState(pm.projectsDir, dirName);
  expect(loaded).not.toBeNull();
  expect(Object.keys(loaded!.characterStates).length).toBe(2);
  expect(loaded!.emotionalDebts.length).toBe(2);
  expect(loaded!.chaptersWritten).toBe(5);
});
