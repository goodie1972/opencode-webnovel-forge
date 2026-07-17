# NCS Control Mechanisms Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Chapter Control Card, Dynamic State, and Forgotten Element Detection to the writing pipeline.

**Architecture:** New `src/writer/control/` directory with shared types, control card generator, and dynamic state manager. Modify `first_draft.ts` to inject control cards into prompts. Modify `session.ts` to auto-save dynamic state after each stage. Extend `quality-review.ts` with forgotten element dimension.

**Tech Stack:** TypeScript, bun:test

---

### Task 0: Enrich `buildAgentContext` — 把已有数据全部喂给 LLM

**Files:**
- Modify: `src/writer/context/assemble.ts`
- Create: `tests/unit/writer/context/enriched-context.test.ts`

**现状**：`buildAgentContext` 虽然读了 `CharacterService`/`PlotService`/`ForeshadowingManager`，但返回给 LLM 的数据太薄：
- 角色只有 `name/role/traits/goal`，缺 `background/arc/voice/relationships`
- 伏笔只有 `description/importance/category`，缺 `plantAt/payoffAt/status`
- 世界只有 `factionNames/locationNames` 的计数，缺详细信息
- 完全没传角色关系

**改动**：扩展 `AgentContext` 接口 + 对应的 `getCharacters`/`getForeshadowing`/`getWorldSummary` 函数。

**Step 1: Write the failing test**

```typescript
import { test, expect, beforeAll, afterAll } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { tmpdir } from 'node:os';
import { NovelProjectManager } from '../../src/novel/project';
import { CharacterService } from '../../src/novel/character';
import { PlotService } from '../../src/novel/plot';
import { ForeshadowingManager } from '../../src/novel/foreshadowing';
import { WorldService } from '../../src/novel/world';
import { buildAgentContext } from '../../src/writer/context/assemble';

let testDir: string;
let dirName: string;
let pm: NovelProjectManager;

beforeAll(() => {
  testDir = path.join(tmpdir(), `enriched_ctx_${Date.now()}`);
  fs.mkdirSync(testDir, { recursive: true });
  pm = new NovelProjectManager(testDir);
  const project = pm.create({ title: '测试', author: '测试', genre: '玄幻' });
  dirName = project.dirName;

  // Seed character with relationships
  const cs = new CharacterService(pm, dirName);
  const c1 = cs.addCharacter({ name: '林云', role: 'protagonist', traits: ['坚毅'], background: '重生者', goal: '变强', arc: '从废材到巅峰', voice: '沉稳' });
  const c2 = cs.addCharacter({ name: '苏婉清', role: 'love_interest', traits: ['温柔'], background: '世家小姐', goal: '守护家族', arc: '从柔弱到坚强', voice: '温婉' });
  cs.addRelationship(c1.id, { targetId: c2.id, type: '青梅竹马', description: '从小一起长大' });
  cs.addRelationship(c2.id, { targetId: c1.id, type: '依赖', description: '信任依赖' });

  // Seed plot data
  const ps = new PlotService(pm, dirName);
  ps.addArc({ title: '觉醒篇', phase: 1, summary: '主角觉醒前世记忆' });
  ps.addSubplot({ name: '身世之谜', description: '林云的身世背景', relatedArc: '觉醒篇', status: 'active' });

  // Seed foreshadowing
  const fm = new ForeshadowingManager(pm, dirName);
  fm.addEntry({ description: '神秘玉佩隐藏的真相', category: 'item', plantAt: { chapterId: '1', detail: '第一章出现' }, importance: 9 });

  // Seed world
  const ws = new WorldService(pm, dirName);
  ws.addFaction({ name: '青云门', description: '正道大派', goals: ['维护正道'], members: ['林云'], power: 80 });
  ws.addLocation({ name: '青云山', description: '门派所在地', type: 'mountain' });

  // Add chapters so context builds
  const ch = pm.addChapter(dirName, '第一章');
  pm.writeChapterContent(dirName, ch.id, '第一章内容。'.repeat(100));
});

afterAll(() => {
  try { fs.rmSync(testDir, { recursive: true, force: true }); } catch { /* ok */ }
});

test('enriched context includes character backgrounds and relationships', async () => {
  const ctx = await buildAgentContext(pm, dirName);
  expect(ctx.characters.length).toBeGreaterThan(0);
  // Each character should have background, arc, voice
  for (const c of ctx.characters) {
    expect(c.background).toBeTruthy();
    expect(c.arc).toBeTruthy();
    expect(c.voice).toBeTruthy();
    // Should include relationships
    expect(Array.isArray(c.relationships)).toBe(true);
  }
});

test('enriched context includes detailed world info', async () => {
  const ctx = await buildAgentContext(pm, dirName);
  expect(ctx.worldSummary.factions).toBeGreaterThan(0);
  expect(ctx.worldSummary.locations).toBeGreaterThan(0);
  // Should include faction details (goals, power)
  expect(ctx.worldSummary.factionDetails[0]?.goals).toBeTruthy();
  expect(ctx.worldSummary.factionDetails[0]?.power).toBeGreaterThan(0);
});

test('enriched context includes foreshadowing planting details', async () => {
  const ctx = await buildAgentContext(pm, dirName);
  expect(ctx.activeForeshadowing.length).toBeGreaterThan(0);
  // Each foreshadowing should have planting chapter info
  for (const f of ctx.activeForeshadowing) {
    expect(f.plantAt).toBeTruthy();
  }
});

test('enriched context includes subplot relationships', async () => {
  const ctx = await buildAgentContext(pm, dirName);
  expect(ctx.subplots.length).toBeGreaterThan(0);
  for (const s of ctx.subplots) {
    expect(s.relatedArc).toBeTruthy();
  }
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/unit/writer/context/enriched-context.test.ts`
Expected: FAIL — `ctx.characters[0].background` is undefined, `ctx.worldSummary.factionDetails` is undefined

**Step 3: Expand AgentContext interface**

```typescript
// In assemble.ts, expand AgentContext
export interface AgentContext {
  projectMeta: NovelMeta;
  totalChapters: number;
  totalWords: number;
  recentChapters: { title: string; index: number; content: string }[];
  worldSummary: { 
    factions: number; 
    locations: number; 
    events: number; 
    factionNames: string[]; 
    locationNames: string[]; 
    factionDetails: { name: string; description: string; goals: string[]; power: number; memberCount: number }[];
    locationDetails: { name: string; description: string; type: string }[];
  };
  characters: { 
    name: string; 
    role: string; 
    traits: string[]; 
    goal: string; 
    background: string;
    arc: string;
    voice: string;
    relationships: { targetName: string; type: string; description: string }[];
  }[];
  plotArcs: { title: string; summary: string; status: string; phase: number; chapterCount: number }[];
  activeForeshadowing: { 
    description: string; 
    importance: number; 
    category: string; 
    status: string;
    plantAt: { chapterId: string; detail: string };
  }[];
  subplots: { name: string; description: string; status: string; relatedArc: string }[];
  shuangStats: { total: number; byType: Record<string, number>; avgIntensity: number };
  contextMemo: string;
}
```

**Step 4: Update getCharacters, getPlotData, getWorldSummary, getActiveForeshadowing**

```typescript
async function getCharacters(characterService: CharacterService) {
  const characters = characterService.getCharacters();
  // Need to resolve relationship targetIds to names
  const allChars = characters;
  return characters.map(c => ({
    name: c.name,
    role: c.role,
    traits: c.traits,
    goal: c.goal,
    background: c.background,
    arc: c.arc,
    voice: c.voice,
    relationships: c.relationships.map(r => ({
      targetName: allChars.find(x => x.id === r.targetId)?.name ?? r.targetId,
      type: r.type,
      description: r.description,
    })),
  }));
}

async function getWorldSummary(worldService: WorldService) {
  const factions = worldService.getFactions();
  const locations = worldService.getLocations();
  const events = worldService.getEvents();
  return {
    factions: factions.length,
    locations: locations.length,
    events: events.length,
    factionNames: factions.map(f => f.name),
    locationNames: locations.map(l => l.name),
    factionDetails: factions.map(f => ({
      name: f.name,
      description: f.description,
      goals: f.goals,
      power: f.power,
      memberCount: f.members.length,
    })),
    locationDetails: locations.map(l => ({
      name: l.name,
      description: l.description,
      type: l.type,
    })),
  };
}
```

**Step 5: Run test to verify it passes**

Run: `bun test tests/unit/writer/context/enriched-context.test.ts`
Expected: PASS

**Step 6: Verify existing tests still pass**

Run: `bun test tests/unit/writer/context/ tests/unit/writer/stages/ tests/unit/writer/session.test.ts`
Expected: all PASS

**Step 7: Commit**

```bash
git add src/writer/context/assemble.ts tests/unit/writer/context/enriched-context.test.ts
git commit -m "feat: enrich AgentContext with full character/plot/foreshadowing/world data"
```

---

**Files:**
- Create: `src/writer/control/types.ts`
- Create: `tests/unit/writer/control/types.test.ts`

**Step 1: Write the failing test**

```typescript
import { test, expect } from 'bun:test';

// Test type imports
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
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/unit/writer/control/types.test.ts`
Expected: FAIL — cannot find module

**Step 3: Write minimal types**

```typescript
export interface ChapterControlCard {
  chapterIndex: number;
  title: string;
  mission: string;
  linesToAdvance: string[];
  debtsToReturn: string[];
  conflict: string;
  endingResidue: string;
  characterStateChanges: string[];
}

export interface DynamicState {
  lastChapterIndex: number;
  characterStates: Record<string, CharacterState>;
  plotlineProgress: Record<string, PlotlineState>;
  foreshadowingStatus: Record<string, ForeshadowState>;
  emotionalDebts: string[];
  pendingConfirmations: string[];
  chaptersWritten: number;
}

export interface CharacterState {
  lastAppearance: number;
  status: string;
  relationshipChanges: string[];
}

export interface PlotlineState {
  lastAdvancement: number;
  status: string;
  nextExpectedBeat: string;
}

export interface ForeshadowState {
  status: 'planted' | 'active' | 'paid_off' | 'abandoned';
  plantedAt: number;
  expectedPayoffWindow: [number, number];
}

export interface ForgottenCheckResult {
  overdueCharacters: string[];
  coldPlotlines: string[];
  unreturnedDebts: string[];
  foreshadowingExpiring: string[];
  overallScore: number;
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/unit/writer/control/types.test.ts`
Expected: PASS

**Step 5: Create barrel export**

Create `src/writer/control/index.ts`:

```typescript
export * from './types';
export * from './control-card';
export * from './dynamic-state';
```

**Step 6: Commit**

```bash
git add src/writer/control/types.ts src/writer/control/index.ts tests/unit/writer/control/types.test.ts
git commit -m "feat: add control types (ChapterControlCard, DynamicState, ForgottenCheckResult)"
```

---

### Task 2: ChapterControlCard Generator

**Files:**
- Create: `src/writer/control/control-card.ts`
- Create: `tests/unit/writer/control/control-card.test.ts`

**Step 1: Write the failing test**

```typescript
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
  const filePath = path.join(pm.projectsDir, dirName, 'control-cards', '01-第一章.json');
  
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(card, null, 2), 'utf-8');
  
  const loaded = loadControlCard(pm.projectsDir, dirName, 1);
  expect(loaded).not.toBeNull();
  expect(loaded?.chapterIndex).toBe(1);
});

test('listControlCards returns sorted cards', () => {
  const cards = listControlCards(pm.projectsDir, dirName);
  expect(Array.isArray(cards)).toBe(true);
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/unit/writer/control/control-card.test.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

```typescript
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ChapterControlCard, DynamicState } from './types';

function slugify(s: string): string {
  return s.replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'untitled';
}

export function generateControlCard(
  chapterIndex: number,
  title: string,
  context: unknown,
  state: DynamicState,
): ChapterControlCard {
  const linesToAdvance = Object.entries(state.plotlineProgress)
    .filter(([_, p]) => p.status === 'active')
    .map(([name]) => name);

  const debtsToReturn = state.emotionalDebts.slice(0, 3);

  const mission = linesToAdvance.length > 0
    ? `推进 ${linesToAdvance.join('、')}，解决当前核心冲突`
    : '推动情节发展';

  return {
    chapterIndex,
    title,
    mission,
    linesToAdvance,
    debtsToReturn,
    conflict: '核心冲突待确定',
    endingResidue: '制造下一章的牵引力',
    characterStateChanges: [],
  };
}

export function loadControlCard(
  projectsDir: string,
  projectName: string,
  chapterIndex: number,
): ChapterControlCard | null {
  const cardsDir = path.join(projectsDir, projectName, 'control-cards');
  if (!fs.existsSync(cardsDir)) return null;

  const files = fs.readdirSync(cardsDir)
    .filter(f => f.startsWith(`${String(chapterIndex).padStart(2, '0')}-`))
    .sort();

  if (files.length === 0) return null;
  try {
    return JSON.parse(fs.readFileSync(path.join(cardsDir, files[0]), 'utf-8'));
  } catch {
    return null;
  }
}

export function saveControlCard(
  projectsDir: string,
  projectName: string,
  card: ChapterControlCard,
): string {
  const cardsDir = path.join(projectsDir, projectName, 'control-cards');
  if (!fs.existsSync(cardsDir)) fs.mkdirSync(cardsDir, { recursive: true });
  const filename = `${String(card.chapterIndex).padStart(2, '0')}-${slugify(card.title)}.json`;
  const filePath = path.join(cardsDir, filename);
  fs.writeFileSync(filePath, JSON.stringify(card, null, 2), 'utf-8');
  return filePath;
}

export function listControlCards(
  projectsDir: string,
  projectName: string,
): ChapterControlCard[] {
  const cardsDir = path.join(projectsDir, projectName, 'control-cards');
  if (!fs.existsSync(cardsDir)) return [];
  return fs.readdirSync(cardsDir)
    .filter(f => f.endsWith('.json'))
    .sort()
    .map(f => {
      try { return JSON.parse(fs.readFileSync(path.join(cardsDir, f), 'utf-8')); }
      catch { return null; }
    })
    .filter((c): c is ChapterControlCard => c !== null);
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/unit/writer/control/control-card.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/writer/control/control-card.ts tests/unit/writer/control/control-card.test.ts
git commit -m "feat: add ChapterControlCard generator and file I/O"
```

---

### Task 3: Integrate Control Card into `first_draft.ts`

**Files:**
- Modify: `src/writer/stages/first_draft.ts`
- Create: `tests/unit/writer/control/control-integration.test.ts`

**Step 1: Read current first_draft.ts**

Read the current file to understand the injection point.

**Step 2: Write integration test**

```typescript
import { test, expect, vi, beforeAll, afterAll } from 'bun:test';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';

// The test verifies that when first_draft runs, it:
// 1. Generates a control card
// 2. Saves it to control-cards/
// 3. The prompt sent to callAgent includes the card's mission
```

**Step 3: Modify first_draft.ts**

Before calling `callAgent`, inject control card data into the prompt:

```typescript
// In runFirstDraft, after building context:
const dynamicState = loadDynamicState(pm.projectsDir, projectDir) ?? createEmptyState();
const controlCard = generateControlCard(chapterIndex, chapterTitle, context, dynamicState);
saveControlCard(pm.projectsDir, projectDir, controlCard);

// Inject into prompt
const enhancedPrompt = [
  userMessage,
  `\n【本章控制卡】`,
  `任务: ${controlCard.mission}`,
  `推进情节: ${controlCard.linesToAdvance.join(', ')}`,
  `偿清债务: ${controlCard.debtsToReturn.join(', ')}`,
  `核心冲突: ${controlCard.conflict}`,
  `结尾余波: ${controlCard.endingResidue}`,
].join('\n');
```

**Step 4: Run tests**

Run: `bun test tests/unit/writer/stages/stages.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/writer/stages/first_draft.ts tests/unit/writer/control/control-integration.test.ts
git commit -m "feat: inject ChapterControlCard into first_draft prompt"
```

---

### Task 4: DynamicState — Manager + Persistence

**Files:**
- Create: `src/writer/control/dynamic-state.ts`
- Create: `tests/unit/writer/control/dynamic-state.test.ts`

The DynamicStateManager handles:
- Loading/saving `novels/<project>/dynamic-state.json`
- `updateAfterChapter(controlCard)` — increment chaptersWritten, update character lastAppearance, advance plotline, track foreshadowing
- `createEmptyState()` — returns default initial state

**Step 1-4:** Follow test-first pattern as above.

**Step 5: Commit**

```bash
git add src/writer/control/dynamic-state.ts tests/unit/writer/control/dynamic-state.test.ts
git commit -m "feat: add DynamicStateManager (update + persist)"
```

---

### Task 5: Integrate Dynamic State into `session.ts`

**Files:**
- Modify: `src/writer/session.ts`
- Create: `tests/unit/writer/control/session-integration.test.ts`

**Changes in `session.ts`:**

```typescript
// In runCurrentStage, at the end (before await this.save()):
const dynamicState = loadDynamicState(this.pm.projectsDir, this.projectDir) ?? createEmptyState();
dynamicState.lastChapterIndex = getCurrentChapterIndex(currentStage, styledResult);
dynamicState.chaptersWritten += 1;
saveDynamicState(this.pm.projectsDir, this.projectDir, dynamicState);
```

**Step 5: Commit**

```bash
git add src/writer/session.ts tests/unit/writer/control/session-integration.test.ts
git commit -m "feat: auto-write DynamicState after each stage in session"
```

---

### Task 6: Forgotten Element Detection in Quality Review

**Files:**
- Modify: `src/writer/quality/quality-review.ts`
- Create: `tests/unit/writer/quality/forgotten-check.test.ts`

**Add `forgottenCheck()` function:**

```typescript
export function forgottenCheck(state: DynamicState, currentChapter: number): ForgottenCheckResult {
  const overdueCharacters: string[] = [];
  const coldPlotlines: string[] = [];
  const foreshadowingExpiring: string[] = [];

  for (const [name, cs] of Object.entries(state.characterStates)) {
    const chaptersSince = currentChapter - cs.lastAppearance;
    if (chaptersSince >= 3) overdueCharacters.push(name);
  }

  for (const [name, ps] of Object.entries(state.plotlineProgress)) {
    const chaptersSince = currentChapter - ps.lastAdvancement;
    if (chaptersSince >= 5) coldPlotlines.push(name);
  }

  for (const [name, fs] of Object.entries(state.foreshadowingStatus)) {
    if (fs.status === 'paid_off' || fs.status === 'abandoned') continue;
    const windowLength = fs.expectedPayoffWindow[1] - fs.expectedPayoffWindow[0];
    const elapsed = currentChapter - fs.plantedAt;
    if (windowLength > 0 && elapsed > windowLength * 1.5) {
      foreshadowingExpiring.push(name);
    }
  }

  const total = overdueCharacters.length + coldPlotlines.length + foreshadowingExpiring.length;
  const overallScore = Math.max(0, 100 - total * 15);

  return {
    overdueCharacters,
    coldPlotlines,
    unreturnedDebts: state.emotionalDebts,
    foreshadowingExpiring,
    overallScore,
  };
}
```

**Modify `reviewContent()`** to accept optional `dynamicState` parameter and add `forgotten` dimension when state is provided.

**Step 5: Commit**

```bash
git add src/writer/quality/quality-review.ts tests/unit/writer/quality/forgotten-check.test.ts
git commit -m "feat: add forgotten element detection to quality review"
```

---

### Task 7: Integration Simulation Test

**Files:**
- Modify: `tests/simulation/pipeline-simulation.test.ts` (if exists) or create `tests/simulation/control-simulation.test.ts`

Add test that verifies the full flow: session runs → control cards are created → dynamic state is written → forgotten check detects nothing.

---

## Execution

**Plan complete and saved to `docs/plans/2026-07-17-ncs-control-mechanisms-plan.md`.**

**Recommended approach: Subagent-Driven (this session)** — I dispatch fresh subagent per task, review between tasks.
