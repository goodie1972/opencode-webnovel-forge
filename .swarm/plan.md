<!-- PLAN_HASH: gjp6wn2h05zm -->
# OpenCode WebNovel Forge v2.0
Swarm: mega
Phase: 1 [COMPLETE] | Updated: 2026-07-16T09:59:51.544Z

---
## Phase 1: 项目初始化 — Fork + 重命名 [COMPLETE]
- [x] 1.1: Fork opencode-storyforge 为 opencode-webnovel-forge，更新 package.json 和插件名 [MEDIUM]
- [x] 1.2: 验证构建链正常（bun install / build / typecheck） [SMALL]

---
## Phase 2: Agent 定义 + Prompt [PENDING]
- [x] 2.1: 重写 Agent 模板定义（14 个网文 Agent + 10 个大师风格 + prompts模块） [LARGE]
- [ ] 2.2: 编写 14 个中文 Prompt 文件 + 10 个大师风格文件 + /novel model/prompt/master 命令 [LARGE] (depends: 2.1)

---
## Phase 3: 网文业务层 TypeScript 重写 [PENDING]
- [ ] 3.1: NovelProjectManager — 项目管理 [MEDIUM]
- [ ] 3.2: WorldService — 世界观服务 [MEDIUM] (depends: 3.1)
- [ ] 3.3: CharacterService — 角色服务 [MEDIUM] (depends: 3.1)
- [ ] 3.4: PlotService — 情节大纲服务 [MEDIUM] (depends: 3.1)
- [ ] 3.5: ShuangPointTracker — 爽点追踪 [MEDIUM] (depends: 3.1)
- [ ] 3.6: PacingAnalyzer — 节奏分析 [MEDIUM] (depends: 3.1)
- [ ] 3.7: ForeshadowingManager — 伏笔管理 [MEDIUM] (depends: 3.1)
- [ ] 3.8: MemoryService — 记忆库 [MEDIUM] (depends: 3.1)
- [ ] 3.9: 6 阶段状态机 workflow.ts [LARGE] (depends: 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8)

---
## Phase 4: 命令 + 面板 + 测试 [PENDING]
- [x] 4.1: 命令改为 /novel 命名空间 [SMALL]
- [ ] 4.2: 状态面板注入 [SMALL]
- [ ] 4.3: Agent 和工作流测试 [MEDIUM]
- [ ] 4.4: 文档完善 [SMALL]
