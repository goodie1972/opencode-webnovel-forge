import type { AgentTemplate } from './types';

export const AGENT_TEMPLATES: AgentTemplate[] = [
	{
		name: 'editor_in_chief',
		description: '总编 — 统筹创作流程，分配任务，把控质量，择优/融合三写手输出',
		defaultModel: 'anthropic/claude-sonnet-4-5',
		defaultTemperature: 0.1,
	},
	{
		name: 'research_market',
		description: '市场调研员 — 爬取起点/番茄/七猫/纵横等平台排行，汇总方向风格优缺点，推荐Top3范本',
		defaultModel: 'google/gemini-2.0-flash',
		defaultTemperature: 0.2,
	},
	{
		name: 'research_deep',
		description: '深度分析师 — 对Top3范本深度阅读分析，提取特点精华，读取评论提取用户喜好',
		defaultModel: 'anthropic/claude-sonnet-4-5',
		defaultTemperature: 0.2,
	},
	{
		name: 'writer_a',
		description: '写手A（低温度·执行力型）— 严格按细纲执行，稳扎稳打，不跑偏，爽文流水线',
		defaultModel: 'anthropic/claude-sonnet-4-5',
		defaultTemperature: 0.2,
	},
	{
		name: 'writer_b',
		description: '写手B（中温度·平衡型）— 在细纲框架内发挥文采，兼顾情感与节奏，综合实力最强',
		defaultModel: 'anthropic/claude-sonnet-4-5',
		defaultTemperature: 0.5,
	},
	{
		name: 'writer_c',
		description: '写手C（高温度·创意型）— 不拘泥细纲，敢打破常规，文风跳跃，可能出惊喜也可能跑偏',
		defaultModel: 'anthropic/claude-sonnet-4-5',
		defaultTemperature: 0.8,
	},
	{
		name: 'world_builder',
		description: '世界观架构师 — 设计修仙等级、魔法体系、势力格局、力量体系等世界观设定',
		defaultModel: 'openai/gpt-4o',
		defaultTemperature: 0.3,
	},
	{
		name: 'character_designer',
		description: '角色设计师 — 设计人设、成长弧、关系网、角色动机与冲突',
		defaultModel: 'openai/gpt-4o',
		defaultTemperature: 0.4,
	},
	{
		name: 'plot_architect',
		description: '情节架构师 — 设计大纲、章纲、节奏节点、高潮低谷布局',
		defaultModel: 'anthropic/claude-sonnet-4-5',
		defaultTemperature: 0.3,
	},
	{
		name: 'shuang_analyzer',
		description: '爽点分析师 — 追踪爽点密度、高潮布局、情绪曲线优化',
		defaultModel: 'google/gemini-2.0-flash',
		defaultTemperature: 0.2,
	},
	{
		name: 'pacing_reviewer',
		description: '节奏评审 — 分析节奏曲线、情绪起伏、张弛控制',
		defaultModel: 'google/gemini-2.0-flash',
		defaultTemperature: 0.2,
	},
	{
		name: 'genre_checker',
		description: '类型审核 — 题材合规检查、套路匹配度、市场定位审核',
		defaultModel: 'openai/gpt-4o',
		defaultTemperature: 0.1,
	},
	{
		name: 'reader_simulator',
		description: '读者模拟器 — 模拟代入感检测、毒点排查、读者情绪反馈',
		defaultModel: 'anthropic/claude-sonnet-4-5',
		defaultTemperature: 0.4,
	},
	{
		name: 'copy_editor',
		description: '润色编辑 — 去AI味、语言风格统一、标点规范、节奏润色',
		defaultModel: 'anthropic/claude-sonnet-4-5',
		defaultTemperature: 0.1,
	},
];
