import { test, expect, vi } from 'bun:test';
import type { AgentContext } from '../../../../src/writer/context/assemble';
import {
  runWorldBuilding,
  runCharacterDesign,
  runOutline,
  runFirstDraft,
  runRevision,
  runPolish,
} from '../../../../src/writer/stages';

vi.mock('../../../../src/writer/agent-runtime', () => ({
  callAgent: vi.fn(),
}));

import { callAgent } from '../../../../src/writer/agent-runtime';
const mockCallAgent = callAgent as any;
const mockResponse = { content: 'mock output', tokensUsed: 100 };

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

test('world_building stage calls correct agent', async () => {
  mockCallAgent.mockResolvedValue(mockResponse);
  const result = await runWorldBuilding({ context: createMockContext() });
  expect(mockCallAgent).toHaveBeenCalledWith(expect.objectContaining({ agentName: 'world_builder' }));
  expect(result.output).toBe('mock output');
  expect(result.stageName).toBe('world_building');
});

test('character_design stage calls correct agent', async () => {
  mockCallAgent.mockResolvedValue(mockResponse);
  const result = await runCharacterDesign({ context: createMockContext() });
  expect(mockCallAgent).toHaveBeenCalledWith(expect.objectContaining({ agentName: 'character_designer' }));
  expect(result.stageName).toBe('character_design');
});

test('outline stage calls correct agent', async () => {
  mockCallAgent.mockResolvedValue(mockResponse);
  const result = await runOutline({ context: createMockContext() });
  expect(mockCallAgent).toHaveBeenCalledWith(expect.objectContaining({ agentName: 'outliner' }));
  expect(result.stageName).toBe('outline');
});

test('first_draft stage with single chapter uses first_draft_writer', async () => {
  mockCallAgent.mockResolvedValue(mockResponse);
  const ctx = createMockContext();
  ctx.totalChapters = 1;
  const result = await runFirstDraft({ context: ctx });
  expect(mockCallAgent).toHaveBeenCalledWith(expect.objectContaining({ agentName: 'first_draft_writer' }));
  expect(result.stageName).toBe('first_draft');
});

test('first_draft with many chapters uses parallel writers', async () => {
  mockCallAgent.mockResolvedValue(mockResponse);
  const ctx = createMockContext();
  ctx.totalChapters = 5;
  const result = await runFirstDraft({ context: ctx });
  // Should call 3 parallel agents + 1 sequential = 4 calls
  expect(mockCallAgent).toHaveBeenCalledWith(expect.objectContaining({ agentName: 'writer_a' }));
  expect(mockCallAgent).toHaveBeenCalledWith(expect.objectContaining({ agentName: 'writer_b' }));
  expect(mockCallAgent).toHaveBeenCalledWith(expect.objectContaining({ agentName: 'writer_c' }));
  expect(result.agentUsed).toContain('writer_a');
  expect(result.stageName).toBe('first_draft');
});

test('revision stage calls correct agent', async () => {
  mockCallAgent.mockResolvedValue(mockResponse);
  const result = await runRevision({ context: createMockContext() });
  expect(mockCallAgent).toHaveBeenCalledWith(expect.objectContaining({ agentName: 'revision_editor' }));
  expect(result.stageName).toBe('revision');
});

test('polish stage calls correct agent', async () => {
  mockCallAgent.mockResolvedValue(mockResponse);
  const result = await runPolish({ context: createMockContext() });
  expect(mockCallAgent).toHaveBeenCalledWith(expect.objectContaining({ agentName: 'polisher' }));
  expect(result.stageName).toBe('polish');
});

test('masterStyle is passed through', async () => {
  mockCallAgent.mockResolvedValue(mockResponse);
  await runWorldBuilding({ context: createMockContext(), masterStyle: '辰东流' });
  expect(mockCallAgent).toHaveBeenCalledWith(expect.objectContaining({ masterStyle: '辰东流' }));
});
