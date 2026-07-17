# Writing Pipeline Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the complete writing pipeline — from `/novel write` command to LLM-driven chapter generation — connecting 14 agents, 6-stage workflow, and 10 master styles.

**Architecture:** Agent Runtime (LLM caller) → 6 Stage Runners → Quality Pipeline → WritingSession orchestrator → `/novel write` command. Each layer builds on the previous.

**Tech Stack:** TypeScript, existing novel services, OpenAI/Anthropic SDKs (added as optional deps), JSON prompt files, existing Master style JSONs.

---

### Task 1: Agent Runtime — `src/writer/`

**Files:**
- Create: `src/writer/agent-runtime.ts` — main entry, config + callAgent
- Create: `src/writer/providers/provider.ts` — LLMProvider interface
- Create: `src/writer/providers/openai.ts` — OpenAI-compatible provider
- Create: `src/writer/providers/anthropic.ts` — Anthropic provider
- Test: `tests/unit/writer/agent-runtime.test.ts`

**Step 1: Provider interface**

```typescript
export interface LLMProvider {
  name: string;
  match(model: string): boolean; // returns true if this provider handles this model
  call(
    model: string,
    messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
    options: { temperature?: number; maxTokens?: number; signal?: AbortSignal },
  ): Promise<{ content: string; model: string; tokensUsed?: number }>;
}
```

**Step 2: OpenAI provider**

- Implements LLMProvider
- `match(model)` — true for models not matching Anthropic
- Uses `fetch()` to call `https://api.openai.com/v1/chat/completions` (with configurable baseUrl)
- Supports `apiKey` from options
- Parses `usage.total_tokens` from response

**Step 3: Anthropic provider**

- Implements LLMProvider
- `match(model)` — true when model starts with `anthropic/` or `claude-`
- Calls `https://api.anthropic.com/v1/messages`
- Uses `x-api-key` header

**Step 4: callAgent function**

```typescript
export interface AgentCallOptions {
  agentName: string;
  systemPrompt?: string;
  userMessage: string;
  model?: string;
  temperature?: number;
  masterStyle?: string;
}

export interface AgentResponse {
  content: string;
  model: string;
  tokensUsed?: number;
  durationMs: number;
}

export interface AgentRuntimeConfig {
  apiKey?: string;
  anthropicKey?: string;
  baseUrl?: string;
  defaultModel?: string;
  timeoutMs?: number;
}
```

- `callAgent(options)`: load prompt from JSON, optionally inject master style, pick provider, call LLM, time it
- Error classes: `AgentTimeoutError`, `AgentAuthError`, `AgentResponseError`

**Step 5: Unit test**

- Mock providers
- Test prompt loading, style injection, model selection, error handling

### Task 2: Master Style Injection — `src/writer/style/inject-style.ts`

**Files:**
- Create: `src/writer/style/inject-style.ts`
- Test: `tests/unit/writer/style/inject-style.test.ts`

**Step 1: Implement injectStyle**

```typescript
export function injectStyle(basePrompt: string, styleName: string): string
```

- Load master JSON from `data/masters/{styleName}.json` (or normalized name)
- Extract style features: `style`, `techniques`, `taboos`, `tone`
- Append as a "## 风格指令" section to the base prompt
- Support blending: `injectStyle(prompt, [{name: '辰东流', weight: 0.6}, {name: '猫腻流', weight: 0.4}])`

**Step 2: Test**

- Test single style injection
- Test blended style injection
- Test missing style file → fallback silently

### Task 3: Context Assembly — `src/writer/context/`

**Files:**
- Create: `src/writer/context/assemble.ts`
- Test: `tests/unit/writer/context/assemble.test.ts`

**Step 1: ContextBuilder types**

```typescript
export interface AgentContext {
  projectMeta: NovelMeta;
  recentChapters: { title: string; index: number; content: string }[];
  worldSummary: { factions: number; locations: number; events: number };
  characters: { name: string; role: string; traits: string[] }[];
  plotArcs: { title: string; summary: string; status: string }[];
  activeForeshadowing: { description: string; importance: number; category: string }[];
  shuangPlan: { total: number; byType: Record<string, number> };
  contextMemo: string; // accumulated context.md content
}
```

**Step 2: Implement buildAgentContext**

```typescript
export async function buildAgentContext(
  pm: NovelProjectManager,
  dirName: string,
  options?: { chapterId?: string; maxContextLength?: number },
): Promise<AgentContext>
```

- Read project meta
- Read last 5 chapters content
- Query WorldService for counts
- Query CharacterService for character list
- Query PlotService for arcs
- Query ForeshadowingManager for active entries
- Query ShuangPointTracker for stats
- Read and include context.md content
- Truncate if exceeds maxContextLength (default 8000 chars)

**Step 3: Test**

- Test assembly from a test project with mock data
- Test truncation logic
- Test with empty project

### Task 4: Quality Review Pipeline — `src/writer/quality/`

**Files:**
- Create: `src/writer/quality/quality-review.ts`
- Create: `src/writer/quality/revision-loop.ts`
- Test: `tests/unit/writer/quality/quality-review.test.ts`

**Step 1: QualityReview types**

```typescript
export interface QualityFinding {
  agent: string;
  severity: 'critical' | 'major' | 'minor' | 'suggestion';
  category: string;
  detail: string;
  location?: string; // chapter ID or range
}

export interface QualityReport {
  id: string;
  timestamp: string;
  scope: string[]; // chapter IDs reviewed
  findings: QualityFinding[];
  score: number; // 0-100
}
```

**Step 2: Implement runQualityReview**

```typescript
export async function runQualityReview(
  pm: NovelProjectManager,
  dirName: string,
  chapterIds: string[],
  runtime: AgentRuntime,
): Promise<QualityReport>
```

- Call 4 agents in parallel: reader-simulator, genre-checker, pacing-reviewer, copy-editor
- Each receives: recent chapters, context.md, tracker.json, world/character data
- Aggregate findings into one QualityReport

**Step 3: Implement revisionLoop**

```typescript
export async function revisionLoop(
  pm: NovelProjectManager,
  dirName: string,
  chapterIds: string[],
  report: QualityReport,
  runtime: AgentRuntime,
  maxRounds: number = 3,
): Promise<QualityReport>
```

- For each critical/major finding, generate revision prompt
- Call appropriate agent to fix
- Max 3 rounds
- Returns final report

### Task 5: Stage Runners — `src/writer/stages/`

**Files:**
- Create: `src/writer/stages/world-building.ts`
- Create: `src/writer/stages/character-design.ts`
- Create: `src/writer/stages/outline.ts`
- Create: `src/writer/stages/first-draft.ts` (most complex)
- Create: `src/writer/stages/revision.ts`
- Create: `src/writer/stages/polish.ts`
- Test: `tests/unit/writer/stages/stages.test.ts`

**Step 1: world-building.ts**

```typescript
export async function runWorldBuilding(
  pm: NovelProjectManager,
  dirName: string,
  runtime: AgentRuntime,
): Promise<{ factions: number; locations: number; events: number }>
```

- Call `world_builder` agent with project meta
- Agent returns factions, locations, events in structured JSON
- Parse and save via WorldService
- Return counts

**Step 2: character-design.ts**

- Call `character_designer` agent
- Parse returned characters with relationships
- Save via CharacterService
- Return character count

**Step 3: outline.ts**

- Call `plot_architect` agent → get arcs + outlines + subplots
- Save via PlotService
- Call `shuang_analyzer` agent → get shuang point plan
- Save via ShuangPointTracker
- Call `pacing_reviewer` agent → get pacing targets
- Save via PacingAnalyzer
- Generate foreshadowing plan → save via ForeshadowingManager

**Step 4: first-draft.ts** — The core writing loop (MVP: single writer)

```typescript
export async function runFirstDraft(
  pm: NovelProjectManager,
  dirName: string,
  runtime: AgentRuntime,
  writerName: string, // which writer agent to use (default: writer-a)
): Promise<{ chaptersWritten: number }>
```

Algorithm per chapter:
1. Read next synopsis from PlotService
2. Build context via buildAgentContext (Task 3)
3. Dispatch to configured writer agent with synopsis + context
4. Save chapter content via NovelProjectManager.writeChapterContent
5. Update ForeshadowingManager (mark payoffs from this chapter)
6. Update ShuangPointTracker (mark points placed in this chapter)
7. Append chapter event to context.md
8. Every 3 chapters: call runQualityReview + revisionLoop
9. If quality check fails → writer retries chapter once

**Step 5: revision.ts**

- Call runQualityReview for ALL written chapters
- Run revisionLoop with maxRounds=3
- Apply fixes to chapter content

**Step 6: polish.ts**

- Call `copy_editor` agent for each chapter
- Final consistency pass
- Update all chapter statuses to 'final'

### Task 6: WritingSession — `src/writer/session.ts`

**Files:**
- Create: `src/writer/session.ts`
- Test: `tests/unit/writer/session.test.ts`

**Step 1: Session schema types**

```typescript
export type SessionMode = 'auto' | 'semi_auto';
export type SessionStatus = 'idle' | 'running' | 'waiting_confirm' | 'completed' | 'aborted' | 'error';

export interface SessionState {
  version: 1;
  projectDir: string;
  mode: SessionMode;
  status: SessionStatus;
  workflow: ReturnType<WorkflowStateMachine['serialize']>;
  writerName: string;
  completedStages: string[];
  currentStage: string;
  logs: { timestamp: string; stage: string; message: string; level: 'info' | 'warn' | 'error' }[];
  error?: { message: string; stage: string; timestamp: string };
}
```

**Step 2: Implement WritingSession class**

```typescript
export class WritingSession {
  constructor(pm: NovelProjectManager, dirName: string, mode: SessionMode, writerName?: string)
  
  // Main lifecycle
  async run(): Promise<SessionState>
  async resume(): Promise<SessionState>
  
  // Semi-auto mode control
  async confirm(): Promise<void>
  async abort(): Promise<void>
  
  // Status
  getState(): SessionState
  get currentStageLabel(): string
  
  // Internal
  private save(): void
  private load(): SessionState | null
  private runStage(stage: WorkflowStage): Promise<void>
}
```

**Step 3: Persistence**

- Save to `novels/<dirName>/session.json`
- Schema version 1 with `version: 1` field
- On resume: check version → if mismatch, throw migration error
- Include: workflow state, completed stages, logs, error state
- Load on `--continue`

### Task 7: Commands — Update `src/commands/novel.ts`

**Files:**
- Modify: `src/commands/novel.ts`
- Modify: `src/novel/index.ts` (add writer export)

**Step 1: Add write subcommands**

```
/novel write <project>
/novel write --auto <project>
/novel write --continue <project>
/novel write --stage <stage> <project>
/novel write --confirm <session-id>
/novel write --abort <session-id>
```

**Step 2: Wire to session orchestrator**

- Parse args
- Create or load WritingSession
- Run / continue / confirm

**Step 3: Export from src/novel/index.ts**

- Add `export { WritingSession } from '../writer/session'`
- Add `export { callAgent } from '../writer/agent-runtime'`

### Task 8: Tests

**Files:**
- Create: `tests/unit/writer/agent-runtime.test.ts`
- Create: `tests/unit/writer/style/inject-style.test.ts`
- Create: `tests/unit/writer/quality/quality-review.test.ts`
- Create: `tests/unit/writer/stages/stages.test.ts`
- Create: `tests/unit/writer/session.test.ts`

Key test scenarios:
- Agent runtime: prompt loading, style injection, model fallback, API errors
- Style injection: single, blended, missing file
- Quality review: report generation, finding aggregation
- Stages: stage runner execution with mock agent runtime
- Session: auto/semi-auto flow, persistence, resume, abort
- Integration: mock HTTP server for LLM API testing

### Task 9: Barrel export + Build verification

**Files:**
- Create: `src/writer/index.ts`
- Verify: build, typecheck, all tests pass
