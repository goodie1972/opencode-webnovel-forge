# Writing Pipeline Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the complete writing pipeline — from `/novel write` command to LLM-driven chapter generation — connecting 14 agents, 6-stage workflow, and 10 master styles.

**Architecture:** Agent Runtime (LLM caller) → 6 Stage Runners → Quality Pipeline → WritingSession orchestrator → `/novel write` command. Each layer builds on the previous.

**Tech Stack:** TypeScript, existing novel services, OpenAI/Anthropic SDKs (added as optional deps), JSON prompt files, existing Master style JSONs.

---

### Task 1: Agent Runtime — `src/writer/agent-runtime.ts`

**Files:**
- Create: `src/writer/agent-runtime.ts`
- Test: `tests/unit/writer/agent-runtime.test.ts`

**Step 1: Define types**

```typescript
export interface AgentCallOptions {
  agentName: string;
  systemPrompt?: string; // extra instructions beyond the prompt file
  userMessage: string;
  model?: string;
  temperature?: number;
  masterStyle?: string; // optional master style name
}

export interface AgentResponse {
  content: string;
  model: string;
  tokensUsed?: number;
  durationMs: number;
}

export interface AgentRuntimeConfig {
  apiKey: string;
  baseUrl?: string;
  defaultModel?: string;
}
```

**Step 2: Implement callAgent**

- `callAgent(options: AgentCallOptions): Promise<AgentResponse>`
- Load prompt from `prompts/agents/{agentName}.json`
- If masterStyle provided, call `injectStyle()` (Task 2)
- Determine model: options.model > project settings > defaults
- Call LLM via fetch (OpenAI-compatible API)
- Return structured response
- Error handling: timeout, auth failure, malformed response

Support two API shapes initially:
1. OpenAI-compatible (`/v1/chat/completions`)
2. Anthropic (`/v1/messages`)

Detection: if model starts with `anthropic/` or `claude-` → Anthropic format, else OpenAI format.

**Step 3: Unit test with mock fetch**

- Test prompt loading
- Test style injection
- Test model selection fallback
- Test error handling

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

### Task 3: Quality Review Pipeline — `src/writer/quality/`

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

### Task 4: Stage Runners — `src/writer/stages/`

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

**Step 4: first-draft.ts** — The core writing loop

```typescript
export interface WriterLock {
  lockedWriter: string | null;      // null until first evaluation
  writerScores: Record<string, number[]>;
}

export async function runFirstDraft(
  pm: NovelProjectManager,
  dirName: string,
  runtime: AgentRuntime,
  session: WritingSession,
): Promise<{ chaptersWritten: number }>
```

Algorithm per chapter:
1. Read next synopsis from PlotService
2. Build context: recent chapters context.md + tracker.json + world/character data
3. If no writer locked yet:
   a. Dispatch synopsis to writer_a, writer_b, writer_c in parallel
   b. Evaluate 3 outputs (call editor-in-chief or use eval criteria)
   c. Lock highest-scoring writer
4. Else: dispatch to locked writer
5. Save chapter content via NovelProjectManager.writeChapterContent
6. Update ForeshadowingManager (mark payoffs)
7. Update ShuangPointTracker (mark placed)
8. Append to context.md
9. Every 3 chapters: call runQualityReview + revisionLoop
10. If locked writer fails quality twice → unlock, re-run step 3

**Step 5: revision.ts**

- Call runQualityReview for ALL written chapters
- Run revisionLoop with maxRounds=3
- Apply fixes to chapter content

**Step 6: polish.ts**

- Call `copy_editor` agent for each chapter
- Final consistency pass
- Update all chapter statuses to 'final'

### Task 5: WritingSession — `src/writer/session.ts`

**Files:**
- Create: `src/writer/session.ts`
- Test: `tests/unit/writer/session.test.ts`

**Step 1: Session types and state**

```typescript
export type SessionMode = 'auto' | 'semi_auto';
export type SessionStatus = 'idle' | 'running' | 'waiting_confirm' | 'completed' | 'aborted';

export interface SessionState {
  projectDir: string;
  mode: SessionMode;
  status: SessionStatus;
  workflow: ReturnType<WorkflowStateMachine['serialize']>;
  writerLock: WriterLock | null;
  currentStage: string;
  logs: SessionLogEntry[];
}
```

**Step 2: Implement WritingSession class**

```typescript
export class WritingSession {
  constructor(pm: NovelProjectManager, dirName: string, mode: SessionMode)
  
  async run(): Promise<void>
  // - Load or create session state
  // - Loop through workflow stages
  // - For each stage: call runner
  // - If semi_auto: emit 'waiting_confirm' → wait for confirm()
  // - If auto: proceed immediately
  // - Save state after each stage
  // - Handle abort
  
  async resume(): Promise<void>
  // - Load saved session
  // - Skip completed stages
  // - Run remaining stages
  
  async confirm(): Promise<void>
  // - Resume from waiting_confirm
  
  async abort(): Promise<void>
  // - Mark session as aborted
  // - Save partial progress
}
```

**Step 3: Persistence**

- Save to `novels/<dirName>/session.json`
- Includes: workflow state, writer lock, stage completion status, logs
- Load on `--continue`

### Task 6: Commands — Update `src/commands/novel.ts`

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

### Task 7: Tests

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

### Task 8: Barrel export + Build verification

**Files:**
- Create: `src/writer/index.ts`
- Verify: build, typecheck, all tests pass
