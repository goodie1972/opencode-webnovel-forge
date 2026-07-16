# Writing Pipeline — 写作流水线设计

日期: 2026-07-16
状态: 已批准

## 概要

将 14 个 Agent + 6 阶段工作流 + 10 Master 风格串接为完整的自动/半自动写作流水线。用户在 `/novel write` 下可以选择一键全自动生成或逐步确认的半自动模式。

## 架构

```
/novel write 命令
    │
    ▼
WritingSession 编排器
    │  auto=true  → 全自动
    │  auto=false → 每步等待 confirm
    │  --continue → 断点续跑
    │
    ├── Stage: world_building
    │     runner: 调 world_builder agent → 存 WorldService
    ├── Stage: character_design
    │     runner: 调 character_designer agent → 存 CharacterService
    ├── Stage: outline
    │     runner: plot_architect + shuang_analyzer + pacing_reviewer → Plot/Shuang/Foreshadowing
    ├── Stage: first_draft
    │     runner: 逐章 → 提细纲 → (首次3写手并行/锁定后1写手) → 保存章节 → 更新坑追踪 → 每3-5章质控
    ├── Stage: revision
    │     runner: 4 agent 并行质控 → 收集问题 → 最多3轮修订
    └── Stage: polish
          runner: copy_editor 润色 → 定稿

Agent Runtime 执行层:
    callAgent(name, context) → AgentResponse
    - 加载 prompts/agents/{name}.json
    - Master 风格直接注入 systemPrompt
    - 读取项目 model 配置
    - 调用 LLM API
```

## 组件

### src/writer/agent-runtime.ts
- `callAgent(name, context, style?) → AgentResponse`
- 支持 OpenAI / Anthropic / 通过 OpenCode model 配置
- 返回 `{ content, model, tokensUsed, durationMs }`

### src/writer/session.ts
- `class WritingSession`
- 持有 PM + WorkflowStateMachine + mode
- `run()`, `resume()`, `confirm()`, `abort()`
- 持久化到 `novels/<project>/session.json`

### src/writer/stages/
6 个独立 runner 文件：
- `world-building.ts`
- `character-design.ts`
- `outline.ts`
- `first-draft.ts`
- `revision.ts`
- `polish.ts`

### src/writer/style/
- `inject-style.ts` — 将 master JSON 的风格细则拼入 writer agent 的 systemPrompt
- 支持多风格按比例融合

### src/writer/quality/
- `quality-review.ts` — 执行 4 个质控 agent 并汇总问题
- `revision-loop.ts` — 最多 3 轮修订循环

### src/commands/novel.ts
新增子命令：
- `/novel write`
- `/novel write --auto`
- `/novel write --continue`
- `/novel write --stage <stage>`
- `/novel write --confirm <session-id>`

## 数据文件

```
novels/<project>/
├── session.json           # WritingSession 状态
├── quality-reports/       # 质控报告
│   ├── report-001.json
│   └── ...
├── context.md             # 累积上下文（供 writer agent 参考）
└── ... (已有文件)
```

## 设计原则

- Session 幂等：可随时中断续跑，不重复生成
- Agent 调用可 mock：测试时不需要真实 LLM
- 双模式共享同一条路径：auto = 半自动 + 自动 confirm
