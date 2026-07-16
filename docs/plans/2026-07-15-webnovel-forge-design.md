# OpenCode WebNovel Forge v2.0 设计方案

> 基于 opencode-storyforge 插件架构，融合 v1.0 网文业务逻辑
> 日期：2026-07-15

## 项目定位

`opencode-webnovel-forge` — 一个 OpenCode 插件，通过多 Agent 编排实现中文网文创作全流程。纯 CLI 模式，命令命名空间 `/novel`。

## 整体架构

```
Layer 1: Plugin Framework（复用 StoryForge）
  Config (Zod+双层) | Guardrails | Context Budget
  Evidence Store | Plan Manager | Commands

Layer 2: Agent Layer（网文专用编排）
  editor_in_chief → writer_a/b/c → world_builder
  → character_designer → plot_architect
  → shuang_analyzer → pacing_reviewer
  → reader_simulator → genre_checker → copy_editor

Layer 3: Novel Domain（TypeScript 重写 v1.0 业务）
  ProjectManager | WorldService | CharacterService
  PlotService | ShuangTracker | PacingAnalyzer
  ForeshadowingMgr | MemoryService | StyleService

Layer 4: Storage（Evidence Store + 文件系统持久化）
```

## Agent 定义

### 编排层
| Agent | 职责 | 能力需求 | 默认 Temp |
|-------|------|---------|----------|
| editor_in_chief | 理解用户意图、拆解任务、下发brief、评估多写手输出、做决策 | 强推理+长上下文 | 0.1 |

### 创作层
| Agent | 职责 | 能力需求 | 默认 Temp |
|-------|------|---------|----------|
| writer_a (创意型) | 放飞脑洞，出奇制胜 | 创作质量高 | 0.8 |
| writer_b (均衡型) | 稳定输出，合格线以上 | 创作质量高 | 0.5 |
| writer_c (严谨型) | 逻辑严密，结构工整 | 创作质量高 | 0.3 |
| world_builder | 世界观、力量体系、地理历史 | 逻辑自洽+想象力 | 0.3 |
| character_designer | 角色创建、人物弧光、关系网络 | 情感理解力 | 0.5 |
| plot_architect | 章节大纲、情节结构、伏笔布局 | 结构思维 | 0.3 |

### 评审层
| Agent | 职责 | 能力需求 | 默认 Temp |
|-------|------|---------|----------|
| shuang_analyzer | 爽点密度计算、分布热力图 | 规则驱动 | 0.1 |
| pacing_reviewer | 字数/段落/对话比分析 | 规则驱动 | 0.1 |
| genre_checker | 类型套路合规检查 | 模式匹配 | 0.1 |
| reader_simulator | 模拟读者情绪、预测追读率 | 情感理解力 | 0.5 |

### 润色层
| Agent | 职责 | 能力需求 | 默认 Temp |
|-------|------|---------|----------|
| copy_editor | 去AI味、润色、风格一致性 | 语言理解力强 | 0.1 |

> 模型不绑定，通过 `.opencode/opencode-webnovel-forge.json` 配置 + `swarm-model` 工具动态切换。

## 6 阶段创作流程

```
Stage 1: 创意构思  → editor_in_chief 引导 → 故事 brief
Stage 2: 世界构建  → world_builder → 世界观设定文档
Stage 3: 项目讨论  → 多角色讨论 → 讨论纪要
Stage 4: 角色设定  → character_designer + reader_simulator → 角色档案
Stage 5: 情节大纲  → plot_architect + shuang_analyzer + genre_checker → 大纲
Stage 6: 正文创作  → 多写手并行+择优 → 评审 → 润色 → 交付
```

### 正文创作子流程（多写手方案）

```
editor_in_chief 下发 brief
  → writer_a (0.8) / writer_b (0.5) / writer_c (0.3) 并行生成
  → editor_in_chief 择优或融合
  → shuang_analyzer + pacing_reviewer + reader_simulator + genre_checker 评审
  → 如有问题退回修改，否则 copy_editor 润色
  → 交付
```

## 命令命名空间

使用 `/novel` 避免与 opencode-swarm 的 `/swarm` 冲突：

- `/novel status` — 当前项目/阶段/Agent 状态
- `/novel list` — 项目列表
- `/novel create` — 新建项目
- `/novel stage` — 查看/跳转阶段
- `/novel diagnose` — 健康检查
- `/novel export` — 导出项目
- `/novel reset` — 重置

## 实施路线图

### Phase 0: 项目初始化（1天）
- Fork opencode-storyforge → opencode-webnovel-forge
- 重命名 package.json，更新插件 name
- 清理通用写作 Agent 定义和 prompt
- 确认构建链正常

### Phase 1: 核心框架复用（直接拿过来）
- Config | Guardrails | Context Budget | Evidence Store | Plan Manager | /swarm 命令

### Phase 2: Agent 定义 + Prompt（2-3天）
- 12 个 Agent 定义 + 中文 prompt
- swarm-model 适配
- 配置覆盖机制

### Phase 3: 网文业务层 TypeScript 重写（1周）
- 移植 v1.0 的 ProjectManager / WorldService / CharacterService / PlotService / ShuangTracker / PacingAnalyzer / ForeshadowingMgr / MemoryService

### Phase 4: 流程编排（3-4天）
- 6 阶段状态机
- 多写手并行+择优
- 评审反馈循环

### Phase 5: 状态面板 + 体验（2天）
- Plan/Context 注入右侧面板
- 阶段进度 + Agent 状态实时显示

### Phase 6: 测试 + 文档（2天）
- Agent 测试 / 集成测试 / README / 配置文档

总计约 2-3 周。

## 命名

- 包名：`opencode-webnovel-forge`
- 命令：`/novel`
- 配置：`.opencode/opencode-webnovel-forge.json`
- 项目目录：`data/projects/`
