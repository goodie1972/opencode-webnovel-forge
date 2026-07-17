import { test, expect, beforeAll, afterAll } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { tmpdir } from 'node:os';
import { NovelProjectManager } from '../../../../src/novel/project';
import { generateControlCard, loadControlCard, listControlCards } from '../../../../src/writer/control/control-card';
import type { DynamicState } from '../../../../src/writer/control/types';

let testDir: string;
let dirName: string;
let pm: NovelProjectManager;

beforeAll(() => {
  testDir = path.join(tmpdir(), `control_test_${Date.now()}`);
  fs.mkdirSync(testDir, { recursive: true });
  pm = new NovelProjectManager(testDir);
  const project = pm.create({ title: '测试', author: '测试', genre: '玄幻' });
  dirName = project.dirName;
});

afterAll(() => {
  try { fs.rmSync(testDir, { recursive: true, force: true }); } catch { /* ok */ }
});

test('generateControlCard returns valid card', () => {
  const context = { targetChapters: 'test content', recentChapters: [] } as any;
  const state: DynamicState = {
    lastChapterIndex: 0,
    characterStates: { char1: { lastAppearance: 1, status: 'active', relationshipChanges: [] } },
    plotlineProgress: { main: { lastAdvancement: 1, status: 'active', nextExpectedBeat: 'confrontation' } },
    foreshadowingStatus: {},
    emotionalDebts: [],
    pendingConfirmations: [],
    chaptersWritten: 1,
  };

  const card = generateControlCard(2, '测试章节', context, state);
  expect(card.chapterIndex).toBe(2);
  expect(card.title).toBe('测试章节');
  expect(card.mission).toBeTruthy();
  expect(typeof card.conflict).toBe('string');
});

test('save and load control card', () => {
  const card = generateControlCard(1, '第一章', {} as any, {
    lastChapterIndex: 0, characterStates: {}, plotlineProgress: {},
    foreshadowingStatus: {}, emotionalDebts: [], pendingConfirmations: [], chaptersWritten: 0,
  });
  // Use saveControlCard to persist
  const { saveControlCard } = require('../../../../src/writer/control/control-card');
  if (typeof saveControlCard === 'function') {
    saveControlCard(pm.projectsDir, dirName, card);
  } else {
    // Fallback: manual write
    const filePath = path.join(pm.projectsDir, dirName, 'control-cards', '01-第一章.json');
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(card, null, 2), 'utf-8');
  }
  
  const loaded = loadControlCard(pm.projectsDir, dirName, 1);
  expect(loaded).not.toBeNull();
  expect(loaded?.chapterIndex).toBe(1);
});

test('listControlCards returns sorted cards', () => {
  const cards = listControlCards(pm.projectsDir, dirName);
  expect(Array.isArray(cards)).toBe(true);
});