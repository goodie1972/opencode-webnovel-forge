# OpenCode StoryForge 调研与 AI Web Novel Editorial 2.0 方案

## 目录

1. [StoryForge 架构分析](#1-storyforge-架构分析)
2. [Agent-Model 映射策略](#2-agent-model-映射策略)
3. [可借鉴的核心模块](#3-可借鉴的核心模块)
4. [中文网文特有的认知](#4-中文网文特有的认知)
5. [AI Web Novel Editorial 2.0 设计方案](#5-ai-web-novel-editorial-20-设计方案)
6. [实施路线图](#6-实施路线图)

---

## 1. StoryForge 架构分析

### 1.1 项目定位

OpenCode-StoryForge 是一个 **OpenCode 插件**（TypeScript），用于编排 AI agent 团队完成多阶段写作项目。版本 1.2.2，有完整的测试覆盖和构建工具链。

### 1.2 核心文件结构

```
opencode-storyforge/
├── src/
│   ├── index.ts                    # 插件入口
│   ├── agents/                     # Agent 定义与配置
│   │   ├── definitions.ts          # 模板定义
│   │   ├── types.ts                # 类型声明
│   │   └── index.ts                # 工厂函数 + 模型分配
│   ├── config/                     # 配置管理
│   │   ├── schema.ts               # Zod 验证 Schema
│   │   ├── loader.ts               # 双层配置加载（用户+项目）
│   │   └── constants.ts            # 默认模型映射
│   ├── hooks/                      # OpenCode 钩子
│   │   ├── guardrails.ts           # 工具调用限制
│   │   ├── context-budget.ts       # Token 预算控制
│   │   ├── delegation-tracker.ts   # Agent 委派追踪
│   │   ├── extractors.ts           # Markdown AST 解析
│   │   ├── system-enhancer.ts      # System prompt 增强
│   │   └── compaction-customizer.ts # 会话压缩增强
│   ├── evidence/                   # 证据存储
│   │   └── store.ts                # 文件锁 + 自动清理
│   ├── plan/                       # 计划管理
│   │   ├── manager.ts              # .md + .json 双格式
│   │   ├── schema.ts               # 计划结构定义
│   │   └── index.ts
│   ├── tools/                      # 自定义工具
│   │   ├── file-manager.ts         # 文件读写
│   │   └── index.ts
│   └── utils/                      # 工具函数
│       ├── logger.ts               # 日志 + 密钥脱敏
│       └── errors.ts
├── prompts/                        # Agent 提示词模板
├── references/                     # 参考文档
├── templates/                      # 模板
├── scripts/                        # 辅助脚本
├── tests/                          # 测试（8+ 文件）
├── package.json                    # opencode-writer-swarm
└── README.md
```

### 1.3 技术栈

| 组件 | 技术 | 说明 |
|------|------|------|
| 语言 | TypeScript | 类型安全 |
| 构建 | Bun | 快速构建 |
| 测试 | Bun Test | 自带测试框架 |
| 验证 | Zod v4 | Schema 验证 |
| Markdown 解析 | mdast-util + micromark | AST 级别解析 |
| 插件 API | @opencode-ai/plugin v1.1.53 | OpenCode 标准接口 |

---

## 2. Agent-Model 映射策略

### 2.1 StoryForge 的模型分层

```typescript
// src/config/constants.ts
export const DEFAULT_MODELS: Record<string, string> = {
  editor_in_chief: 'anthropic/claude-sonnet-4-5',  // 编排者 → 强模型
  writer:          'anthropic/claude-sonnet-4-5',   // 创作 → 强模型
  researcher:      'google/gemini-2.0-flash',       // 搜索 → 快便宜
  section_editor:  'openai/gpt-4o',                 // 结构审查 → 中等
  copy_editor:     'anthropic/claude-sonnet-4-5',   // 润色 → 强模型
  fact_checker:    'google/gemini-2.0-flash',       // 验证 → 快便宜
  reader_advocate: 'openai/gpt-4o',                 // 读者视角 → 中等
  default:         'inherit',                       // 未配置 → 继承会话模型
};
```

**核心原则：按任务复杂度分层选模型**

| 层级 | 模型特征 | 适用角色 | 原因 |
|------|---------|---------|------|
| Premium | Claude Sonnet/Opus | writer, copy_editor, editor_in_chief | 创作需要高质量输出 |
| Balanced | GPT-4o | section_editor, reader_advocate | 中等复杂度，需要理解力 |
| Fast | Gemini Flash | researcher, fact_checker | 搜索/验证不需要深度推理 |
| Inherit | 会话当前模型 | default | 灵活适配 |

### 2.2 我们 Swarm 当前的做法

```json
{
  "coder":           "deepseek-v4-flash",    // 写代码 → 便宜 ✓
  "reviewer":        "deepseek-v4-pro",      // 审查 → 贵 ✓
  "test_engineer":   "minimax-m2.5",         // 测试 → 便宜 ✓
  "explorer":        "minimax-m2.7",         // 探索 → 便宜 ✓
  "sme":             "mimo-v2.5-pro",        // 专家 → 贵 ✓
  "critic":          "qwen3.7-max",          // 批判 → 贵 ✓
  "designer":        "geminiproxy/gemini-3.5-flash", // 设计 → 便宜 ✓
}
```

我们的分配已经暗合了分层原则 👍

### 2.3 可以借鉴的设计

#### (a) Agent Override Schema

```json
{
  "agents": {
    "writer": {
      "model": "anthropic/claude-3.5-sonnet",
      "temperature": 0.8,
      "disabled": false
    }
  }
}
```

→ 支持 `disabled` 字段临时关闭某个 agent。

#### (b) 环境变量覆盖

```bash
# CI/CD 时一键换模型
export SWARM_MODEL_OVERRIDE=coder:deepseek-v4-pro
```

#### (c) Model Tier 标签

```typescript
type ModelTier = 'fast' | 'balanced' | 'premium';

const MODEL_TIER_MAP = {
  'flash': 'fast',
  'mini': 'fast',
  'pro': 'balanced',
  'max': 'premium',
  'opus': 'premium',
};
```

→ 在 `swarm-model` 工具中显示 tier 标签，方便一眼看出成本分布。

---

## 3. 可借鉴的核心模块

### 3.1 Guardrails Hook（最高优先级 ⭐⭐⭐）

**功能**：限制 tool_calls、duration、repetitions、consecutive_errors

```typescript
export const GuardrailsConfigSchema = z.object({
  enabled: z.boolean().default(true),
  max_tool_calls: z.number().min(1).default(200),
  max_duration_minutes: z.number().min(1).default(30),
  max_repetitions: z.number().min(1).default(10),
  max_consecutive_errors: z.number().min(1).default(5),
  warning_threshold: z.number().min(0).max(1).default(0.5),
});
```

**对我们的价值**：防止 agent 死循环、过度调用、连续失败。

### 3.2 Context Budget（高优先级 ⭐⭐⭐）

**功能**：估算 token 使用量，超过阈值时注入警告到 system prompt

```typescript
function estimateTokens(text?: string): number {
  return Math.ceil(text.length * 0.33); // 简单启发式
}
// 70% → WARNING, 90% → CRITICAL
```

**对我们的价值**：长对话上下文爆炸时自动预警，防止 token 浪费。

### 3.3 Evidence Store（高优先级 ⭐⭐⭐）

**功能**：可靠的证据存储，带文件锁、指数退避重试、自动清理

```typescript
class EvidenceStore {
  private async acquireLock(lockPath: string): Promise<FileHandle> { ... }
  private async writeWithRetries(filePath: string, content: string): Promise<void> { ... }
  private async pruneOnce(): Promise<void> { ... }
}
```

**对我们的价值**：我们现在的 backup 只是简单 copy。升级后可以：
- 加文件锁防止并发冲突
- 指数退避重试写入
- 按天数/数量自动清理旧备份

### 3.4 Markdown AST Parser（中优先级 ⭐⭐）

**功能**：用 mdast 解析 plan.md，提取 phase/tasks/decisions

```typescript
export function extractCurrentPhase(planContent: string): string | null { ... }
export function extractIncompleteTasks(planContent: string): string | null { ... }
export function extractDecisions(contextContent: string): string | null { ... }
```

**对我们的价值**：比正则更可靠地提取 plan.md 中的进度信息。

### 3.5 Compaction Hook（中优先级 ⭐⭐）

**功能**：会话压缩时注入关键上下文，防止 agent "失忆"

```typescript
async function handleCompaction(input, output) {
  output.context.push(`[SWARM PLAN] ${currentPhase}`);
  output.context.push(`[SWARM DECISIONS] ${decisionsSummary}`);
  output.context.push(`[SWARM TASKS] ${incompleteTasks}`);
}
```

**对我们的价值**：网文写作周期长，压缩后容易丢失关键设定。

### 3.6 Config Schema + Deep Merge（中优先级 ⭐⭐）

**功能**：Zod 验证 + 双层配置 + 原型污染防护

```typescript
function loadPluginConfig(directory: string): PluginConfig {
  const userConfig = loadConfigFromPath(userConfigPath);
  const projectConfig = loadConfigFromPath(projectConfigPath);
  return deepMerge(userConfig, projectConfig);
}
```

**对我们的价值**：配置更安全，支持用户级 + 项目级双层。

---

## 4. 中文网文特有的认知

这些是 storyforge 没有、我们需要加的：

### 4.1 网文核心概念

| 概念 | 定义 | 对应模块 |
|------|------|---------|
| **爽点** | 让读者感到满足/兴奋的情节节点 | shuang-point-tracker |
| **期待感** | 对后续情节的渴望程度 | pacing-analyzer |
| **人物弧光** | 角色从开始到结束的成长变化 | character-arc-tracker |
| **升级体系** | 战力/等级的合理递增 | upgrade-system-validator |
| **伏笔** | 提前埋下、后续兑现的细节 | foreshadowing-manager |
| **黄金三章** | 开篇三章的特殊审查标准 | chapter-template-guard |
| **字数节奏** | 每章字数、段落数、对话比例 | chapter-pacing-analyzer |
| **类型套路** | 玄幻/都市/科幻等类型的特定模式 | genre-patterns |

### 4.2 网文 vs 通用写作的差异

| 维度 | 通用写作 (StoryForge) | 中文网文 (我们) |
|------|---------------------|----------------|
| 更新频率 | 一次性完成 | 日更/周更，连载 |
| 篇幅 | 几千到几万 | 几十万到上百万字 |
| 爽点密度 | 均匀分布 | 需要有节奏的高潮/低谷 |
| 读者反馈 | 完成后阅读 | 边写边看评论调整 |
| 类型约束 | 较少 | 严格的类型套路 |
| 商业化 | 出版/影视 | 付费阅读/打赏 |

### 4.3 网文专用模块设计

#### (a) 爽点热力图

```typescript
interface ShuangPoint {
  chapter: number;
  type: '打脸' | '装逼' | '逆袭' | '收获' | '情感' | '揭秘';
  intensity: number;  // 0-10
  description: string;
}
```

#### (b) 节奏仪表盘

```typescript
interface ChapterMetrics {
  wordCount: number;
  paragraphCount: number;
  dialogueRatio: number;
  actionRatio: number;
  shuangScore: number;
  expectationScore: number;
}
```

#### (c) 人物关系图谱

```typescript
interface CharacterRelation {
  from: string;
  to: string;
  type: '师徒' | '兄弟' | '敌对' | '暧昧' | '主仆';
  strength: number;
  lastInteraction: number;
}
```

#### (d) 伏笔追踪器

```typescript
interface Foreshadow {
  id: string;
  plantedAt: number;
  expectedResolveAt: number;
  resolvedAt: number | null;
  status: 'planted' | 'active' | 'resolved' | 'forgotten';
  importance: 'major' | 'minor';
}
```

#### (e) 类型检查器

```typescript
interface GenreRules {
  genre: '玄幻' | '都市' | '科幻' | '历史' | '悬疑';
  rules: {
    maxChaptersWithoutShuang?: number;
    requiredUpgradeFrequency?: number;
    powerCeilingGrowth?: number;
  };
}
```

#### (f) 读者情绪模拟器

```typescript
interface ReaderEmotion {
  chapter: number;
  emotion: 'excited' | 'bored' | 'angry' | 'crying' | 'laughing';
  trigger: string;
  confidence: number;
}
```

---

## 5. AI Web Novel Editorial 2.0 设计方案

### 5.1 整体架构

```
ai-web-novel-editorial/
├── .swarm/
│   ├── guards/                    ← Guardrails 钩子
│   │   ├── tool-limiter.ts        ← 工具调用限制
│   │   ├── repetition-detector.ts ← 重复操作检测
│   │   └── duration-tracker.ts    ← 时长限制
│   ├── context-budget/            ← Context Budget
│   │   ├── token-estimator.ts     ← Token 估算
│   │   └── warning-injector.ts    ← 注入警告
│   ├── evidence-store/            ← 增强的证据存储
│   │   ├── file-lock.ts           ← 文件锁
│   │   ├── pruner.ts              ← 自动清理
│   │   └── retry-writer.ts        ← 指数退避写入
│   ├── plan-parser/               ← Markdown AST 解析
│   │   ├── phase-extractor.ts     ← 提取当前 phase
│   │   ├── task-extractor.ts      ← 提取未完成任务
│   │   └── decision-extractor.ts  ← 提取关键决策
│   ├── compaction-hook/           ← 会话压缩增强
│   │   └── context-injector.ts    ← 注入关键上下文
│   └── config-schema/             ← 配置验证
│       ├── schema.ts
│       └── loader.ts
├── novel-domain/                  ← 中文网文专用模块
│   ├── shuang-point-tracker.ts    ← 爽点追踪
│   ├── pacing-analyzer.ts         ← 节奏分析
│   ├── character-arc-tracker.ts   ← 人物弧光
│   ├── upgrade-system.ts          ← 升级体系验证
│   ├── foreshadowing-manager.ts   ← 伏笔管理
│   ├── chapter-template.ts        ← 章节模板
│   ├── genre-patterns.ts          ← 类型套路库
│   └── reader-simulator.ts        ← 读者情绪模拟
├── hooks/                         ← OpenCode 钩子入口
│   ├── index.ts
│   ├── guardrails.ts
│   ├── context-budget.ts
│   └── compaction.ts
├── tests/                         ← 完整测试
└── docs/                          ← 文档
    ├── STORYFORGE_RESEARCH.md     ← 本文档
    └── ARCHITECTURE_V2.md         ← 详细架构设计
```

### 5.2 分层设计

```
Layer 1: Guardrails（安全层）
  → 防止 agent 失控（tool_calls, duration, repetitions, errors）

Layer 2: Context Budget（效率层）
  → 控制 token 使用，超量时预警

Layer 3: Evidence Store（持久层）
  → 可靠的文件操作（锁、重试、清理）

Layer 4: Plan Parser（理解层）
  → 结构化读取 plan.md / context.md

Layer 5: Novel Domain（业务层）
  → 中文网文专用分析（爽点、节奏、人物、伏笔）
```

### 5.3 Agent-Model 映射建议

结合网文特性，建议的模型分配：

| Agent | 推荐 Tier | 理由 |
|-------|----------|------|
| `architect` | Premium | 架构师需要理解全局 |
| `writer` | Premium | 创作是核心，不能省 |
| `shuang-point-analyzer` | Fast | 爽点密度计算，规则驱动 |
| `pacing-reviewer` | Fast | 节奏检查，不需要深度 |
| `character-arc-tracker` | Premium | 人物弧光需要理解情感变化 |
| `foreshadowing-manager` | Fast | 伏笔追踪，主要是模式匹配 |
| `genre-checker` | Fast | 类型套路检查，规则驱动 |
| `reader-simulator` | Premium | 模拟读者情绪需要理解力 |
| `copy-editor` | Premium | 文字润色需要质量 |
| `fact-checker` | Fast | 事实验证，快就行 |

**核心原则：创作类用贵模型，检查类用便宜模型。**

### 5.4 与现有工具的集成

```
swarm-model.ps1          → 修改 agent 的 model/temperature
swarm-model (Node.js)    → 同上，跨平台
新 hooks                 → 运行时保护（guardrails, context budget）
新 novel-domain          → 网文专用分析
```

### 5.5 配置示例

```json
{
  "agents": {
    "writer": {
      "model": "opencode-go/qwen3.7-max",
      "temperature": 0.7,
      "disabled": false
    },
    "shuang-point-analyzer": {
      "model": "opencode-go/kimi-k2.5",
      "temperature": 0.1,
      "disabled": false
    }
  },
  "guardrails": {
    "enabled": true,
    "max_tool_calls": 200,
    "max_duration_minutes": 30,
    "max_repetitions": 10,
    "max_consecutive_errors": 5
  },
  "context_budget": {
    "enabled": true,
    "warn": 0.7,
    "critical": 0.9,
    "max_injection_tokens": 4000
  },
  "evidence": {
    "enabled": true,
    "max_age_days": 90,
    "max_bundles": 1000
  }
}
```

---

## 6. 实施路线图

### Phase 1: 基础设施（1-2 周）

- [ ] 实现 Guardrails Hook（tool_calls, duration, repetitions, errors）
- [ ] 实现 Context Budget（token 估算 + 预警注入）
- [ ] 增强 Evidence Store（文件锁 + 指数退避 + 自动清理）
- [ ] 迁移现有的 `swarm-model.ps1` 和 `swarm-model/` 到标准位置

### Phase 2: 网文分析引擎（2-3 周）

- [ ] 实现 Markdown AST Parser（plan.md / context.md 解析）
- [ ] 实现 Shuang Point Tracker（爽点密度追踪）
- [ ] 实现 Pacing Analyzer（节奏分析）
- [ ] 实现 Character Arc Tracker（人物弧光）
- [ ] 实现 Foreshadowing Manager（伏笔管理）

### Phase 3: 高级功能（2-3 周）

- [ ] 实现 Genre Pattern Checker（类型套路检查）
- [ ] 实现 Reader Emotion Simulator（读者情绪模拟）
- [ ] 实现 Upgrade System Validator（升级体系验证）
- [ ] 实现 Compaction Hook（会话压缩增强）
- [ ] 实现 System Enhancer（System Prompt 动态增强）

### Phase 4: 集成与优化（1-2 周）

- [ ] 完整测试覆盖
- [ ] 性能优化
- [ ] 文档完善
- [ ] 提交 PR 到 opencode-swarm

---

## 附录 A: StoryForge 关键代码摘录

### A.1 Agent 创建流程

```typescript
export function createAgents(config?: PluginConfig): AgentDefinition[] {
  for (const template of AGENT_TEMPLATES) {
    if (!isAgentDisabled(template.name, config)) {
      const agent = {
        name: template.name,
        config: {
          model: getModel(template.name, config),
          temperature: template.defaultTemperature,
          prompt: getPrompt(template.name),
        },
      };
      agents.push(applyOverrides(agent, config));
    }
  }
  return agents;
}
```

### A.2 Guardrails 实现

```typescript
export function createGuardrailsHook(config: GuardrailsConfig) {
  async function toolBefore(input: ToolInput): Promise<void> {
    const session = getGuardrailSession(input.sessionID);
    session.toolCalls++;
    checkToolCallLimit(session.toolCalls, config.max_tool_calls);
    checkDurationLimit(session, config.max_duration_minutes);
    checkRepetitionLimit(session.repetitionCount, config.max_repetitions);
    checkConsecutiveErrorsLimit(session.consecutiveErrors, config.max_consecutive_errors);
    if (shouldWarn(session.toolCalls, config.max_tool_calls, config.warning_threshold)) {
      warn('Guardrail warning: Approaching tool call limit');
    }
  }
}
```

### A.3 Context Budget 实现

```typescript
export function createContextBudgetHook(config, directory) {
  async function handler(input, output) {
    const planContent = await readSwarmFileAsync(directory, 'plan.md');
    const contextContent = await readSwarmFileAsync(directory, 'context.md');
    const totalTokens = estimateTokens(planContent) + estimateTokens(contextContent);
    const ratio = totalTokens / maxTokens;
    if (ratio >= 0.9) {
      output.system.push('[CONTEXT] CRITICAL: 90% budget used!');
    } else if (ratio >= 0.7) {
      output.system.push('[CONTEXT] WARNING: 70% budget used!');
    }
  }
}
```

### A.4 Evidence Store 文件锁

```typescript
private async acquireLock(lockPath: string): Promise<FileHandle> {
  while (true) {
    try {
      const handle = await fs.open(lockPath, 'wx');
      return handle;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      const stats = await fs.stat(lockPath);
      if (Date.now() - stats.mtimeMs > LOCK_TIMEOUT_MS) {
        await fs.unlink(lockPath);
        continue;
      }
      const delay = this.lockBackoffs[Math.min(attempt, 4)];
      await this.sleep(delay);
      attempt++;
    }
  }
}
```

---

## 附录 B: 与现有 Novel-Editorial 项目的对比

| 维度 | 现有项目 | StoryForge | 2.0 目标 |
|------|---------|------------|---------|
| 语言 | Python | TypeScript | Python 为主 + TS 钩子 |
| Agent 管理 | 手动编辑 JSON | 自动加载 + 验证 | 保持手动 + 增强验证 |
| 模型选择 | swarm-model 工具 | DEFAULT_MODELS | 分层模型 + tier 标签 |
| 安全保护 | 无 | Guardrails | 实现 Guardrails |
| 上下文管理 | 无 | Context Budget | 实现 Context Budget |
| 证据存储 | 简单 backup | Evidence Store | 实现增强版 |
| 计划解析 | 正则 | AST 解析 | 实现 AST 解析 |
| 网文分析 | 基础 | 无 | 完整网文分析引擎 |
| 测试覆盖 | 部分 | 完整 | 逐步完善 |
| 构建工具 | 无 | Bun | 可选 |

---

## 附录 C: 关键决策记录

### C.1 为什么保持 Python 为主？

1. 现有代码库是 Python，迁移成本高
2. 网文分析逻辑（NLP、情感分析）Python 生态更成熟
3. TypeScript 只用于 OpenCode 钩子层，通过 JSON 通信

### C.2 为什么不用 Zod？

1. Python 没有原生 Zod 等价物
2. 可以用 pydantic 替代
3. 或者只在 TS 钩子层做验证

### C.3 为什么分 Layer 设计？

1. 每层职责清晰，便于维护
2. 可以独立启用/禁用某层
3. 便于测试和替换

---

*文档生成时间：2026-07-14*
*调研来源：https://github.com/ZaxbyHub/opencode-storyforge*
*作者：goodie1972*
