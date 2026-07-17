import { test, expect } from 'bun:test';
import type { AgentContext } from '../../../src/writer/context/assemble';
import { WritingSession } from '../../../src/writer/session';

function createMockContext(): AgentContext {
  return {
    projectMeta: {
      title: 'Test Novel',
      author: 'Author',
      genre: 'xianxia',
      tags: ['cultivation', 'magic'],
      description: 'A test novel',
      targetWords: 100000,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
    totalChapters: 5,
    totalWords: 12000,
    recentChapters: [{ title: 'ch1', index: 1, content: 'chapter one content' }],
    worldSummary: { factions: 2, locations: 3, events: 1, factionNames: ['f1'], locationNames: ['l1'] },
    characters: [{ name: 'hero', role: 'protagonist', traits: ['brave'], goal: 'ascend' }],
    plotArcs: [{ title: 'arc1', summary: 'story arc', status: 'planning' }],
    activeForeshadowing: [{ description: 'mystery', importance: 8, category: 'plot' }],
    subplots: [{ name: 'sub1', description: 'side story', status: 'active' }],
    shuangStats: { total: 3, byType: { face_slap: 2 }, avgIntensity: 7 },
    contextMemo: 'project notes',
  };
}

function mockProjectData() {
  return {
    meta: {
      title: 'Test',
      author: 'Author',
      genre: 'xianxia',
      tags: [],
      description: '',
      targetWords: 100000,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
    chapters: [
      { id: 'ch1', title: 'Chapter 1', index: 1, wordCount: 1000, status: 'draft', createdAt: '2026-01-01', updatedAt: '2026-01-01' },
      { id: 'ch2', title: 'Chapter 2', index: 2, wordCount: 2000, status: 'draft', createdAt: '2026-01-01', updatedAt: '2026-01-01' }
    ],
    settings: { language: 'zh', agentOverrides: {} }
  };
}

test('WritingSession exists and can be imported', () => {
  expect(WritingSession).toBeDefined();
});

test('WritingSession has static create method', () => {
  expect(typeof WritingSession.create).toBe('function');
});

test('WritingSession has static resume method', () => {
  expect(typeof WritingSession.resume).toBe('function');
});

test('WritingSession has instance methods runCurrentStage, advanceStage, and getStatus', () => {
  const mockPm = {
    load: () => mockProjectData(),
  };
  
  const session = new WritingSession('/tmp', 'test-novel', { mode: 'auto' });
  (session as any).pm = mockPm;
  
  expect(typeof session.runCurrentStage).toBe('function');
  expect(typeof session.advanceStage).toBe('function');
  expect(typeof session.getStatus).toBe('function');
});

test('SessionStatus interface is properly exported', () => {
  const mockPm = {
    load: () => mockProjectData(),
  } as any;
  
  const session = new WritingSession('/tmp', 'test-novel', { mode: 'auto' });
  (session as any).pm = mockPm;
  
  const status = session.getStatus();
  
  expect(status).toHaveProperty('projectDir');
  expect(status).toHaveProperty('mode');
  expect(status).toHaveProperty('currentStage');
  expect(status).toHaveProperty('stageLabel');
  expect(status).toHaveProperty('progress');
  expect(status).toHaveProperty('isComplete');
  expect(status).toHaveProperty('stageRequirements');
  expect(status).toHaveProperty('totalWords');
  expect(status).toHaveProperty('totalChapters');
});

test('WritingSessionState interface is properly defined', () => {
  const state: any = {
    projectDir: 'test-novel',
    config: { mode: 'auto' },
    workflow: {
      currentStage: 'world_building',
      stageHistory: [{ stage: 'world_building', enteredAt: '2026-01-01T00:00:00.000Z' }],
      stageData: [['world_building', {}]],
    },
    startedAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T12:00:00.000Z',
  };
  
  expect(state.projectDir).toBe('test-novel');
  expect(state.config.mode).toBe('auto');
  expect(state.workflow.currentStage).toBe('world_building');
  expect(state.workflow.stageHistory).toHaveLength(1);
});

test('WritingSession constructor initializes correctly', () => {
  const session = new WritingSession('/tmp', 'test-novel', { mode: 'semi-auto' });
  
  expect(session.projectDir).toBe('test-novel');
  expect(session.config.mode).toBe('semi-auto');
});

 test('WritingSession config defaults to semi-auto', () => {
   const session = new WritingSession('/tmp', 'test-novel');
   expect(session.config.mode).toBe('semi-auto');
   expect(session.config.autoSaveInterval).toBe(60000);
 });

 test('WritingSession config can be overridden', () => {
   const session = new WritingSession('/tmp', 'test-novel', { mode: 'auto', masterStyle: 'test-style' });
   expect(session.config.mode).toBe('auto');
   expect(session.config.masterStyle).toBe('test-style');
 });
