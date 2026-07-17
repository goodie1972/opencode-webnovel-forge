# NCS 控制机制整合设计

## 背景

分析 Novel-Control-Station-Skill 后，确定三项 P0 能力需要引入：
1. Chapter Control Card — 每章动笔前先锁定契约
2. Dynamic State — 每章后自动回写角色/情节/伏笔状态
3. Forgotten Element Detection — 质检维度扩展，发现叙事断裂

## 架构变化

```
src/writer/control/          ← 新目录
├── types.ts                 — 共享类型定义
├── control-card.ts          — ChapterControlCard 生成/读写
└── dynamic-state.ts         — DynamicStateManager 更新/持久化

src/writer/stages/first_draft.ts  — 集成控制卡 prompt
src/writer/session.ts             — 每个 stage 后回写 dynamic state
src/writer/quality/quality-review.ts — 新增 forgottenCheck 维度
```

## 数据流

```
runFirstDraft(StageInput)
  ├── controlCard = generateControlCard(context, dynamicState)
  ├── writeFile(control-cards/NN-slug.json, controlCard)
  ├── inject card into prompt → callAgent → output
  └── dynamicState.updateAfterChapter(controlCard, output)

runCurrentStage (末尾)
  └── dynamicState.save()
      ├── update character lastAppearance
      ├── advance plotline status
      ├── update foreshadowing payoff window
      └── write to novels/<project>/dynamic-state.json

reviewContent(styledOutput, dynamicState)
  └── forgottenCheck(dynamicState)
      ├── overdueCharacters (>3 chapters since last)
      ├── coldPlotlines (>5 chapters since last advance)
      └── expiringForeshadowing (>50% past payoff window)
```

## 类型定义

详见 `src/writer/control/types.ts`，包含：
- `ChapterControlCard`
- `ChapterControlCardData` (持久化)
- `DynamicState`
- `ForgottenCheckResult`

## 实施顺序

0. 富化 `buildAgentContext` — 把角色细节(full profile+关系)、世界观详情、伏笔埋点、支线关联全部注入 AgentContext
1. 创建 `src/writer/control/types.ts`
2. 实现 `control-card.ts`（生成 + 读写）
3. 修改 `first_draft.ts` 集成控制卡
4. 实现 `dynamic-state.ts`（更新 + 持久化）
5. 修改 `session.ts` 集成回写
6. 修改 `quality-review.ts` 新增遗忘检测
7. 测试

## Task 0 具体改动

`AgentContext` 扩展：

```typescript
// 角色：增加 background/arc/voice/relationships（解析 name）
// 世界观：增加 factionDetails(goals/power/members)/locationDetails(description/type)
// 伏笔：增加 status/plantAt 埋点信息
// 情节弧：增加 phase/chapterCount
// 支线：增加 relatedArc
```

没有新文件，只改 `assemble.ts` 的 getter 函数和接口定义。
