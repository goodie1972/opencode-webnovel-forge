# OpenCode WebNovel Forge

AI Web Novel creation swarm - multi-agent orchestration for Chinese web novel writing.

基于 opencode-storyforge 插件架构，打造面向中文网文创作的多 Agent 系统。

## Agents

- **editor_in_chief** (总编) — 编排创作全流程
- **writer_a/b/c** (写手×3) — 创意型/均衡型/严谨型，并行生成+择优
- **world_builder** (世界观架构师) — 世界观、力量体系设定
- **character_designer** (角色设计师) — 角色创建、人物弧光
- **plot_architect** (情节架构师) — 大纲、章节结构、伏笔
- **shuang_analyzer** (爽点分析师) — 爽点密度追踪
- **pacing_reviewer** (节奏评审) — 节奏分析
- **genre_checker** (类型检查器) — 类型套路合规
- **reader_simulator** (读者模拟器) — 读者情绪模拟
- **copy_editor** (润色编辑) — 去AI味、润色

## 6 阶段创作流程

1. 创意构思 → 2. 世界构建 → 3. 项目讨论 → 4. 角色设定 → 5. 情节大纲 → 6. 正文创作

## Commands

- /novel status — 当前项目/阶段/Agent 状态
- /novel list — 项目列表
- /novel create — 新建项目
- /novel stage — 查看/跳转阶段
- /novel diagnose — 健康检查
- /novel export — 导出项目
- /novel reset — 重置

## Configuration

编辑 .opencode/opencode-webnovel-forge.json 配置 Agent 模型映射。

