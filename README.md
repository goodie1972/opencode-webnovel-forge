# OpenCode WebNovel Forge

AI Web Novel creation swarm — multi-agent orchestration for Chinese web novel writing, built as an opencode plugin.

## Agents (14)

| Agent | Role |
|-------|------|
| `editor_in_chief` | 总编 — 全局把控 |
| `writer_a` | 写手-爆发型 — 日更万字，快节奏 |
| `writer_b` | 写手-稳健型 — 稳定输出 |
| `writer_c` | 写手-精修型 — 慢工出细活 |
| `world_builder` | 世界观架构师 — 世界/力量体系 |
| `character_designer` | 角色设计师 — 人物塑造 |
| `plot_architect` | 情节架构师 — 大纲/结构 |
| `shuang_analyzer` | 爽点分析师 — 爽点密度 |
| `pacing_reviewer` | 节奏评审 — 叙事节奏 |
| `genre_checker` | 类型检查 — 路线合规 |
| `reader_simulator` | 读者模拟 — 读者视角 |
| `copy_editor` | 润色编辑 — 去AI味 |
| `research_market` | 市场研究 — 榜单/趋势 |
| `research_deep` | 深度研究 — 考据/设定 |

## Workflow (6-stage)

世界观构建 → 角色设计 → 大纲创作 → 初稿 → 修改 → 精修

## Commands

| Command | Description |
|---------|-------------|
| `/novel model list` | 查看 agent 模型配置 |
| `/novel model init <preset>` | 从预设初始化模型配置 |
| `/novel model set <agent> <model>` | 设置指定 agent 的模型 |
| `/novel prompt list` | 查看所有 agent 提示词路径 |
| `/novel prompt path <agent>` | 查看指定 agent 提示词路径 |
| `/novel master list` | 列出所有大神文风 |
| `/novel master show <name>` | 查看大神文风详情 |
| `/novel status` | 显示当前项目状态面板 |
| `/novel active <dir>` | 切换活动项目 |
| `/novel write` | 运行 AI 写作管线 |
| `/novel write --auto <project>` | 全自动模式（无需确认，自动跑完6阶段） |
| `/novel write --continue <project>` | 断点续跑（恢复上次中断的会话） |
| `/novel write --stage <s> <project>` | 只运行指定阶段 |
| `/novel write --confirm <project>` | 半自动模式下确认进入下一阶段 |
| `/novel write --abort <project>` | 中止并清除当前会话 |

## Writing Pipeline Architecture

```
/novel write 命令
    │
    ▼
WritingSession 编排器 (src/writer/session.ts)
    │  模式: auto (全自动) / semi-auto (每步确认)
    │  持久化: novels/<project>/.writing-session.json
    │
    ├── Stage 1: world_building  →  src/writer/stages/world_building.ts
    ├── Stage 2: character_design →  src/writer/stages/character_design.ts
    ├── Stage 3: outline          →  src/writer/stages/outline.ts
    ├── Stage 4: first_draft      →  src/writer/stages/first_draft.ts  (多Agent并行)
    ├── Stage 5: revision         →  src/writer/stages/revision.ts
    └── Stage 6: polish           →  src/writer/stages/polish.ts

 质量管控 (src/writer/quality/):
    quality-review.ts  — 6维度质检 (长度/对话比/段落结构/套话/重复词/遗忘)
                         遗忘维度来自 NCS ForgottenCheck
    revision-loop.ts   — 最多3轮自动修订
    saveQualityReport  →  novels/<project>/quality-reports/<report-id>.json

 上下文组装 (src/writer/context/):
    buildAgentContext  — 从项目加载章节/世界观/角色/情节/爽点/伏笔

 风格注入 (src/writer/style/):
    injectStyle        — 将 prompt/masters/ 中的大神文风注入 system prompt

 NCS 叙述控制 (src/writer/control/):
    control-card.ts    — 章节控制卡生成 (动态 conflict/endingResidue/角色状态)
    dynamic-state.ts   — 跨章节动态状态管理 (角色出场/关系变更/伏笔追踪)
    forgotten-check.ts — 遗忘检测 (过期角色/冷线/债务/伏笔)
    types.ts           — ChapterControlCard/CharacterStateChange/DynamicState
```

## Project Structure

```
src/
├── commands/novel.ts       — 所有 /novel 子命令路由
├── novel/                  — 业务层 (项目管理/世界观/角色/情节/爽点/节奏/伏笔/记忆)
│   ├── project.ts          — NovelProjectManager
│   ├── world.ts            — WorldService
│   ├── character.ts        — CharacterService
│   ├── plot.ts             — PlotService
│   ├── shuang.ts           — ShuangPointTracker
│   ├── pacing.ts           — PacingAnalyzer
│   ├── foreshadowing.ts    — ForeshadowingManager
│   ├── memory.ts           — MemoryService
│   └── workflow.ts         — WorkflowStateMachine (6阶段流转)
    └── writer/                 — 写作管线
    ├── agent-runtime.ts    — LLM 调用 (callAgent + providers)
    ├── session.ts          — WritingSession 编排器
    ├── context/assemble.ts — 上下文组装
    ├── style/inject-style.ts — 大神文风注入
    ├── control/             — NCS 叙述控制子系统
    │   ├── types.ts         — ChapterControlCard / DynamicState / ForgottenCheckResult
    │   ├── control-card.ts  — 控制卡生成 + 文件 IO
    │   ├── dynamic-state.ts — 动态状态管理
    │   ├── forgotten-check.ts — 遗忘检测引擎
    │   └── index.ts
    ├── quality/
    │   ├── quality-review.ts  — 6维度质量审查 (含遗忘维度)
    │   └── revision-loop.ts   — 修订循环
    └── stages/              — 6阶段 Runner
        ├── world_building.ts
        ├── character_design.ts
        ├── outline.ts
        ├── first_draft.ts
        ├── revision.ts
        └── polish.ts
prompts/
├── agents/*.json           — 14个 Agent 系统提示词
├── masters/*.json          — 大神文风文件 (10种)
presets/*.yaml              — 模型配置预设
novels/<project>/           — 小说项目目录 (自动生成)
└── quality-reports/        — 质检报告 (自动生成)
```

## Quality Review Dimensions

| Dimension | Description | Threshold |
|-----------|-------------|-----------|
| length | 内容长度 (500-10000字符) | ≥ 60 |
| dialogueRatio | 对话占比 (推荐 15-40%) | ≥ 15 |
| paragraphStructure | 段落结构评分 | ≥ 40 |
| clichés | 套路/套话检测 | ≥ 40 |
| repeatWords | 重复词检测 | ≥ 40 |
| forgotten | 叙事连续性 — 过期角色/冷线/债务/伏笔 | ≥ 40 |

**forgotten 维度**来自 NCS (Narrative Control System) 的遗忘检测，在每次阶段输出后自动运行：角色 ≥ 3 章未出场、剧情线 ≥ 5 章未推进、伏笔超期 1.5 倍等均会触发预警。

## NCS 叙述控制系统

在每个章节生成前，系统自动创建 **ChapterControlCard**（控制卡）：

```json
{
  "chapterIndex": 5,
  "mission": "推进 主线、支线-A",
  "conflict": "【觉醒篇】发展阶段 — 主角与反派的首次正面交锋",
  "endingResidue": "伏笔逼近: 暗流涌动的真相即将揭开...",
  "characterStateChanges": [
    { "characterId": "主角", "status": "active", "emotionalState": "决心坚定",
      "development": "成长弧 — 从懦弱到坚强", "relationshipChanges": [
        { "targetName": "反派", "delta": -5, "description": "敌对关系" }
      ]
    }
  ]
}
```

控制卡注入到写手 prompt 中，完成后触发：
1. **遗忘检测** — 检查被冷落的角色/剧情线，加入质量审查
2. **动态状态更新** — 角色出场时间、关系变更、伏笔状态同步到 DynamicState

每次阶段完成后 CLI 输出显示质量评分和遗忘预警：

```
✅ 阶段 first_draft 完成
  - Agent: `writer_a`
  - Tokens: 1523
  - 质量评分: 82/100
  - ⚠️ 角色 暗影 已 5 章未出场
  - ⚠️ 剧情线 sub_plot_b 已 3 章未推进
```

## First Draft — Multi-Agent Parallel

当写作章节数 ≥ 3 时，前3章使用 `writer_a`/`writer_b`/`writer_c` 三个写手并行生成不同风格，后续章节锁定 `writer_a` 串行接续，确保风格一致性。

## Installation

### 1. 安装 OpenCode CLI

```bash
npm install -g @opencode-ai/cli
```

验证安装：

```bash
opencode --version
```

### 2. 安装 WebNovel Forge 插件

```bash
opencode plugin add opencode-webnovel-forge
```

或从源码安装（需提前克隆仓库）：

```bash
git clone https://github.com/goodie1972/opencode-webnovel-forge.git
cd opencode-webnovel-forge
opencode plugin install .
```

### 3. 配置 LLM API Key

编辑 `~/.config/opencode/opencode.json`：

```json
{
  "OPENAI_API_KEY": "sk-xxx",
  "ANTHROPIC_API_KEY": "sk-ant-xxx"
}
```

至少需要配置一个 LLM 供应商（OpenAI 或 Anthropic）。

### 4. 初始化模型配置

进入 OpenCode 会话，通过 preset 初始化：

```bash
/novel model init default
```

查看所有 agent 的模型分配：

```bash
/novel model list
```

### 快速开始

```bash
opencode
```

在 OpenCode 会话内运行：

```
/novel write --auto 仙帝重生
```

全自动模式将依次执行 6 个写作阶段，无需手动确认。

## Configuration

Edit `.opencode/opencode-webnovel-forge.json` for agent model overrides.
User overrides in `~/.config/opencode/opencode-webnovel-forge/prompts/agents/`.

## Required Files

- `.opencode/opencode-webnovel-forge.json` — agent 模型配置 (推荐从 preset 初始化)
- `~/.config/opencode/opencode.json` — LLM provider API key 配置
