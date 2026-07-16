# OpenCode WebNovel Forge v2.0 实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**目标：** 基于 opencode-storyforge 插件架构，创建中文网文创作多 Agent 系统。

**架构方式：** Fork opencode-storyforge → 替换 Agent 定义和 Prompt → 添加网文业务层

**技术栈：** TypeScript / Bun / @opencode-ai/plugin v1.1.53 / Zod v4

---

## Phase 0: 项目初始化

### Task 0.1: Fork 并重命名

**文件：**
- 修改: `package.json`（name、description）
- 修改: `src/index.ts`（插件名、描述）
- 修改: `README.md`

**步骤 1：复制项目目录**
```bash
Copy-Item -Recurse -Path "D:\user\docs\python\opencode-storyforge" -Destination "D:\user\docs\python\opencode-webnovel-forge"
```

**步骤 2：更新 package.json**
- name: `opencode-webnovel-forge`
- description: `AI Web Novel creation swarm - multi-agent orchestration for Chinese web novel writing`

**步骤 3：更新 src/index.ts**
- 插件名从 `opencode-writer-swarm` → `opencode-webnovel-forge`
- 更新启动日志信息

**步骤 4：更新 README.md**
- 替换为网文创作相关描述

**步骤 5：验证构建**
```bash
cd D:\user\docs\python\opencode-webnovel-forge
bun install
bun run build
bun run typecheck
```

---

## Phase 1: 核心框架确认

**此阶段不写代码，验证 StoryForge 框架层在 fork 后仍正常：**
- `src/config/` — 双层配置 + Zod 验证
- `src/hooks/guardrails.ts` — 限流保护
- `src/hooks/context-budget.ts` — Token 预算
- `src/evidence/store.ts` — 证据存储
- `src/plan/` — 计划管理
- `src/commands/` — /swarm 命令

**验证：** `bun run build && bun test` 全部通过。

---

## Phase 2: Agent 定义 + Prompt

### Task 2.1: 重写 Agent 模板

**文件：** 修改 `src/agents/definitions.ts`

替换 AGENT_TEMPLATES 为 12 个网文 Agent：
- editor_in_chief（总编，temp 0.1）
- writer_a（创意型，temp 0.8）
- writer_b（均衡型，temp 0.5）
- writer_c（严谨型，temp 0.3）
- world_builder（世界观，temp 0.3）
- character_designer（角色，temp 0.5）
- plot_architect（情节，temp 0.3）
- shuang_analyzer（爽点，temp 0.1）
- pacing_reviewer（节奏，temp 0.1）
- genre_checker（类型，temp 0.1）
- reader_simulator（读者，temp 0.5）
- copy_editor（润色，temp 0.1）

### Task 2.2: 编写 12 个中文 Prompt

**文件：** 新增/修改 `prompts/` 下文件
- `editor-in-chief.md` — 编排逻辑：理解意图 → 拆解任务 → 下发 brief → 评估择优
- `writer-a.md` — "你是创意型写手...大胆放飞想象力"
- `writer-b.md` — "你是均衡型写手...稳定输出高质量内容"
- `writer-c.md` — "你是严谨型写手...注重逻辑和结构"
- `world-builder.md` — 世界观设定规则
- `character-designer.md` — 角色创建规则
- `plot-architect.md` — 大纲结构规则
- `shuang-analyzer.md` — 爽点分析规则
- `pacing-reviewer.md` — 节奏评审规则
- `genre-checker.md` — 类型检查规则
- `reader-simulator.md` — 读者情绪模拟规则
- `copy-editor.md` — 润色规则

### Task 2.3: 更新默认模型常量

**文件：** 修改 `src/config/constants.ts`
- DEFAULT_MODELS 改为网文 Agent，不写死具体模型（全用 inherit）

### Task 2.4: 适配 swarm-model

**文件：** 新增 `scripts/swarm-model.js`（Node.js 跨平台版本）
- 读取 `opencode-webnovel-forge.json` 的 agents 配置
- 支持运行时切换 agent 的 model / temperature

---

## Phase 3: 网文业务层 TypeScript 重写

### Task 3.1: NovelProjectManager

**文件：** 新增 `src/novel/project-manager.ts`

项目全生命周期管理：
- create / list / load / save / delete
- 目录结构：`data/projects/{id}/`
- 阶段状态 currentStage

### Task 3.2: WorldService

**文件：** 新增 `src/novel/world-service.ts`

世界观设定管理：
- CRUD 世界观文档
- 力量体系、地理历史、社会结构分类
- AI 自动生成辅助接口

### Task 3.3: CharacterService

**文件：** 新增 `src/novel/character-service.ts`

角色档案管理（移植 v1.0 三分类）：
- 主角/配角/群众分类
- 角色卡 CRUD
- 人物弧光追踪
- 关系网络

### Task 3.4: PlotService

**文件：** 新增 `src/novel/plot-service.ts`

情节大纲管理：
- 大纲结构存储
- 章节列表管理
- 伏笔布局

### Task 3.5: ShuangPointTracker

**文件：** 新增 `src/novel/shuang-tracker.ts`

爽点追踪系统：
- 爽点类型：打脸/装逼/逆袭/收获/情感/揭秘
- 爽点密度计算
- 分布热力图数据

### Task 3.6: PacingAnalyzer

**文件：** 新增 `src/novel/pacing-analyzer.ts`

节奏分析：
- 字数统计
- 段落数/对话比/动作比
- 节奏评分

### Task 3.7: ForeshadowingManager

**文件：** 新增 `src/novel/foreshadowing-manager.ts`

伏笔管理：
- 状态：planted / active / resolved / forgotten
- 伏笔收割提醒

### Task 3.8: MemoryService

**文件：** 新增 `src/novel/memory-service.ts`

基于 Evidence Store 的记忆库：
- 记忆文档 CRUD
- 跨阶段上下文引用
- 关键设定持久化

---

## Phase 4: 流程编排

### Task 4.1: 6 阶段状态机

**文件：** 新增 `src/novel/workflow.ts`
- 阶段定义和状态转换
- 每个阶段的 Agent 路由
- 阶段产物自动传递

### Task 4.2: editor_in_chief 编排

**文件：** 修改 `prompts/editor-in-chief.md`
- 用户意图 → 阶段/Agent 选择
- 多写手并行下发 brief
- 评审结果择优/融合/退回

### Task 4.3: 评审循环

**文件：** 修改各 analyzer prompt
- shuang_analyzer 输入输出格式
- pacing_reviewer 评分标准
- reader_simulator 报告格式
- genre_checker 检查规则

---

## Phase 5: 状态面板 + 体验

### Task 5.1: 命令改为 /novel

**文件：** 修改 `src/index.ts`、`src/commands/index.ts`
- 命令名从 swarm → novel

### Task 5.2: 面板注入

**文件：** 修改 `src/hooks/context-budget.ts`
- 当前阶段/任务状态注入右侧面板

### Task 5.3: 会话压缩保护

**文件：** 修改 `src/hooks/compaction-customizer.ts`
- 关键设定在压缩时不丢失

---

## Phase 6: 测试 + 文档

### Task 6.1: Agent 单元测试

**文件：** 新增 `tests/unit/agents/` 对应测试

### Task 6.2: 工作流集成测试

**文件：** 新增 `tests/integration/workflow.test.ts`

### Task 6.3: 文档完善

**文件：** 更新 `docs/` 和 `README.md`
