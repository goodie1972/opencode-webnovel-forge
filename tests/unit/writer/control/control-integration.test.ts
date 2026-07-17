import { test, expect, beforeAll, afterAll } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { tmpdir } from 'node:os';
import { NovelProjectManager } from '../../../../src/novel/project';
import { generateControlCard, saveControlCard, loadControlCard } from '../../../../src/writer/control/control-card';
import { runFirstDraft } from '../../../../src/writer/stages/first_draft';
import type { StageInput } from '../../../../src/writer/stages/types';
import type { DynamicState } from '../../../../src/writer/control/types';

let testDir: string;
let dirName: string;
let pm: NovelProjectManager;

beforeAll(() => {
  testDir = path.join(tmpdir(), `ctrl_int_${Date.now()}`);
  fs.mkdirSync(testDir, { recursive: true });
  pm = new NovelProjectManager(testDir);
  const project = pm.create({ title: '控制卡测试', author: '测试', genre: '玄幻' });
  dirName = project.dirName;
  // Add some chapters and characters so context is meaningful
  const ch = pm.addChapter(dirName, '第一章');
  pm.writeChapterContent(dirName, ch.id, '第一章内容。'.repeat(50));
});

afterAll(() => {
  try { fs.rmSync(testDir, { recursive: true, force: true }); } catch { /* ok */ }
});

test('control card is saved after stage run', () => {
  const emptyState = {
    lastChapterIndex: 0,
    characterStates: {},
    plotlineProgress: {},
    foreshadowingStatus: {},
    emotionalDebts: [],
    pendingConfirmations: [],
    chaptersWritten: 1,
  };
  
  const card = generateControlCard(2, '第二章', {} as any, emptyState as DynamicState);
  saveControlCard(pm.projectsDir, dirName, card);
  
  const loaded = loadControlCard(pm.projectsDir, dirName, 2);
  expect(loaded).not.toBeNull();
  expect(loaded!.chapterIndex).toBe(2);
  expect(loaded!.mission).toBeTruthy();
});

test('StageInput accepts projectsDir and controlCard', () => {
  const input: StageInput = {
    context: { totalChapters: 0 } as any,
    projectsDir: pm.projectsDir,
    projectDir: dirName,
    controlCard: {
      chapterIndex: 1,
      title: 'test',
      mission: 'test mission',
      linesToAdvance: ['main'],
      debtsToReturn: [],
      conflict: 'test conflict',
      endingResidue: 'test residue',
      characterStateChanges: [],
    },
  };
  expect(input.projectsDir).toBe(pm.projectsDir);
  expect(input.projectDir).toBe(dirName);
  expect(input.controlCard!.mission).toBe('test mission');
});