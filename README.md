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

## Project Structure

- `prompts/agents/*.json` — Agent 系统提示词（JSON 格式）
- `prompts/masters/*.json` — 大神文风文件
- `presets/*.yaml` — 模型配置预设
- `novels/<project>/` — 小说项目目录（自动生成）

## Configuration

Edit `.opencode/opencode-webnovel-forge.json` for agent model overrides.
User overrides in `~/.config/opencode/opencode-webnovel-forge/prompts/agents/`.
