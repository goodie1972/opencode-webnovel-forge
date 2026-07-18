# NCS 叙述控制系统 — 实现文档

日期: 2026-07-18

## 架构概览

NCS (Narrative Control System) 是 WebNovel Forge 的叙述控制子系统，负责：

1. 为每个章节生成**控制卡** (ChapterControlCard) — 指导 LLM 写手的叙述决策
2. 维护**动态状态** (DynamicState) — 跨章节追踪角色/情节/伏笔状态
3. 执行**遗忘检测** (ForgottenCheck) — 发现被遗忘的角色、冷剧情线、未偿还的债务
4. 将遗忘信息集成到**质量审查** (QualityReview) 的"遗忘维度"

## 数据流

```
runCurrentStage()
  │
  ├─ buildAgentContext()       → AgentContext (角色/情节/伏笔/世界观)
  ├─ loadDynamicState()        → DynamicState (上次章节后的状态)
  ├─ generateControlCard()     → ChapterControlCard (含动态 conflict/endingResidue)
  ├─ injectControlCard()       → 注入到写手 prompt
  ├─ runStage()                → LLM 执行章节写作
  ├─ forgottenCheck()          → 检查被遗忘元素 (写入前状态)
  ├─ reviewContent()           → 质检 + 遗忘维度评分
  ├─ updateAfterChapter()      → 更新 DynamicState (含关系变更)
  └─ saveDynamicState()        → 持久化
```

## 核心类型

### ChapterControlCard (types.ts)

| 字段 | 说明 | 来源 |
|------|------|------|
| chapterIndex | 章节序号 | 调用者 |
| title | 章节标题 | 调用者 |
| mission | 章节任务 | 从 plotlineProgress 推断 |
| linesToAdvance | 需推进的剧情线 | 从 DynamicState 读取 |
| debtsToReturn | 需偿还的情感债务 | 从 DynamicState 读取 |
| conflict | 核心冲突 | 从 plotArcs/subplots/角色动态推断 |
| endingResidue | 结尾余波/悬念 | 从 foreshadowing/arc 位置推断 |
| characterStateChanges | 角色状态变更 | 从 AgentContext.characters 推断 |

### CharacterStateChange (types.ts)

| 字段 | 说明 |
|------|------|
| characterId | 角色名 |
| status | active/missing/retired |
| emotionalState | 情绪状态 (从 role+arc 推断) |
| relationshipChanges[] | 关系变更 (targetName/delta/description) |
| development | 角色弧发展描述 |

### DynamicState (types.ts)

| 字段 | 说明 |
|------|------|
| characterStates | 角色状态 (lastAppearance/status/relationshipChanges) |
| plotlineProgress | 剧情线进度 (lastAdvancement/status/nextExpectedBeat) |
| foreshadowingStatus | 伏笔状态 (status/hints/plantedAt/payoffWindow) |
| emotionalDebts | 未偿还的情感债务列表 |

### ForgottenCheckResult (types.ts)

| 字段 | 判定条件 |
|------|---------|
| overdueCharacters | lastAppearance 距当前 ≥ 3 章 |
| coldPlotlines | lastAdvancement 距当前 ≥ 5 章 |
| unreturnedDebts | emotionalDebts 中未偿还的条目 |
| foreshadowingExpiring | 已过预期 payoff 窗口 1.5 倍 |
| overallScore | 100 - 问题数 × 15 |

## 核心函数

### generateControlCard
- `conflict`: 优先从 active plotArcs 提取 → active subplots → 角色关系(主角vs反派)
- `endingResidue`: 高重要性伏笔临近 payoff → arc 转折点 → 支线悬念 → contextMemo
- `characterStateChanges`: 遍历所有角色，从 role/arc 推断 emotionalState + development
- relationships: 根据关系类型 (rival/enemy/ally/friend) 分配 delta 值

### updateAfterChapter
- 应用 card.characterStateChanges 中的变更
- 处理 relationshipChanges (push 到 characterStates[].relationshipChanges)
- 自动检测已知角色出场 (通过 characterNames 参数，仅更新已有记录，不自动创建新角色)

### reviewContent 遗忘维度
- 在 ReviewOptions.forgottenResult 中传入 ForgottenCheckResult
- 生成 "forgotten" 维度：包含逾期角色/冷线/债务/伏笔的详细信息
- 低于 40 分触发 criticalIssues

## CLI 界面

`formatStageResult` (novel.ts) 在阶段输出后显示：
- 质量评分 (qualityScore/100)
- 遗忘预警 (⚠️ 角色已 X 章未出场 / 剧情线未推进 / 债务未偿还 / 伏笔即将过期)

## 文件映射

| 文件 | 职责 |
|------|------|
| src/writer/control/types.ts | 类型定义 |
| src/writer/control/control-card.ts | 控制卡生成/持久化 |
| src/writer/control/dynamic-state.ts | 动态状态管理 |
| src/writer/control/forgotten-check.ts | 遗忘检测 |
| src/writer/control/index.ts | 模块导出 |
| src/writer/session.ts | WritingSession 集成 |
| src/writer/quality/quality-review.ts | 遗忘维度集成 |
| src/writer/stages/types.ts | StageResult 扩展 |
| src/commands/novel.ts | CLI 展示 |

## 测试覆盖

- 24 个控制模块单元测试 (types/control-card/dynamic-state/forgotten-check/control-integration)
- 12 个质量模块测试 (quality-review/revision-loop)
- 3 个模拟集成测试
- 全部通过

## 关键决策

1. CharacterStateChanges 使用对象格式而非字符串，便于扩展
2. relationshipChanges 在 generateControlCard 时预填充而非在 updateAfterChapter 时计算
3. 已知角色自动更新 lastAppearance 但不自动添加新人（需要显式 characterStateChanges）
4. 遗忘检查在写入前运行（旧状态），质量审查包含遗忘维度，更新在之后
5. conflict/endingResidue 采用分层推断：plotArcs > subplots > 角色 > 默认值
