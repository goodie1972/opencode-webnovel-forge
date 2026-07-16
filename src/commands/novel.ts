import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { loadPluginConfig, PluginConfigSchema } from '../config';
import { AGENT_TEMPLATES } from '../agents/definitions';
import {
	scanMasters,
	listAgentPrompts,
	getAgentPromptFilePath,
	getUserAgentPromptPath,
	getAgentPromptMeta,
	getUserMasterDir,
} from '../prompts';

const PACKAGE_ROOT = findPackageRoot();
const PRESETS_DIR = path.join(PACKAGE_ROOT, 'presets');

function findPackageRoot(): string {
	let dir = path.dirname(new URL(import.meta.url).pathname);
	for (let i = 0; i < 5; i++) {
		if (fs.existsSync(path.join(dir, 'presets'))) return dir;
		const parent = path.dirname(dir);
		if (parent === dir) break;
		dir = parent;
	}
	return path.resolve(process.cwd());
}

function getConfigPaths(): { user: string; project: string } {
	const userDir = path.join(os.homedir(), '.config', 'opencode');
	const projectDir = path.join(process.cwd(), '.opencode');
	const base = 'opencode-webnovel-forge';

	const tryExt = (dir: string): string | null => {
		for (const ext of ['.json', '.yaml', '.yml']) {
			const p = path.join(dir, `${base}${ext}`);
			if (fs.existsSync(p)) return p;
		}
		return null;
	};

	return {
		user: tryExt(userDir) ?? path.join(userDir, `${base}.json`),
		project: tryExt(projectDir) ?? path.join(projectDir, `${base}.json`),
	};
}

function getOpenCodeConfigPath(): string {
	return path.join(os.homedir(), '.config', 'opencode', 'opencode.json');
}

function readProviders(): Record<string, string[]> {
	const p = getOpenCodeConfigPath();
	if (!fs.existsSync(p)) return {};
	try {
		const raw = JSON.parse(fs.readFileSync(p, 'utf-8'));
		const providers: Record<string, string[]> = {};
		if (raw?.provider) {
			for (const [name, data] of Object.entries(raw.provider) as [string, any][]) {
				if (data?.models) {
					providers[name] = Object.keys(data.models).sort();
				}
			}
		}
		return providers;
	} catch {
		return {};
	}
}

function getCurrentConfig(): Record<string, { model?: string; temperature?: number; disabled?: boolean }> {
	const paths = getConfigPaths();
	const project = fs.existsSync(paths.project) ? paths.project : null;
	const user = fs.existsSync(paths.user) ? paths.user : null;
	const active = project ?? user;
	if (!active) return {};

	try {
		const raw = fs.readFileSync(active, 'utf-8');
		const data = JSON.parse(raw);
		return data?.agents ?? {};
	} catch {
		return {};
	}
}

function writeConfig(
	agents: Record<string, { model?: string; temperature?: number; disabled?: boolean }>,
	language: string = 'zh',
): string {
	const paths = getConfigPaths();
	const target = paths.project;

	const existing: any = {};
	if (fs.existsSync(target)) {
		try {
			const raw = fs.readFileSync(target, 'utf-8');
			Object.assign(existing, JSON.parse(raw));
		} catch {}
	}

	if (fs.existsSync(target)) {
		const backupPath = `${target}.bak`;
		const ts = new Date().toISOString().replace(/[:.]/g, '');
		const finalBackup = fs.existsSync(backupPath)
			? `${target}.${ts}.bak`
			: backupPath;
		fs.copyFileSync(target, finalBackup);
	}

	existing.agents = agents;
	existing.language = language;

	const dir = path.dirname(target);
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir, { recursive: true });
	}

	fs.writeFileSync(target, JSON.stringify(existing, null, 2), 'utf-8');
	return target;
}

function showList(agents: Record<string, any>): string {
	const lines: string[] = [];
	lines.push('## 🎭 WebNovel Forge Agent 配置');
	lines.push('');
	lines.push('| Agent | 模型 | 温度 | 状态 |');
	lines.push('|-------|------|------|------|');

	const names = Object.keys(agents).sort();
	for (const name of names) {
		const a = agents[name];
		const model = a.disabled ? '-' : (a.model ?? '（未设置）');
		const temp = a.disabled ? '-' : (a.temperature?.toString() ?? '（未设置）');
		const status = a.disabled ? '❌ 已禁用' : '✅ 启用';
		lines.push(`| \`${name}\` | \`${model}\` | ${temp} | ${status} |`);
	}

	lines.push('');
	lines.push(`配置路径: \`${getConfigPaths().project}\``);
	return lines.join('\n');
}

export async function handleNovelCommand(
	_args: string[],
): Promise<string> {
	const rawArgs = [..._args];
	const subcommand = rawArgs[0]?.toLowerCase();

	if (subcommand === 'model') {
		return handleModelCommand(rawArgs.slice(1));
	}

	if (subcommand === 'prompt') {
		return handlePromptCommand(rawArgs.slice(1));
	}

	if (subcommand === 'master') {
		return handleMasterCommand(rawArgs.slice(1));
	}

	return [
		'## /novel 命令',
		'',
		'| 命令 | 说明 |',
		'|------|------|',
		'| `/novel model` | 配置 agent LLM 模型 |',
		'| `/novel prompt` | 查看 agent 系统提示词文件路径 |',
		'| `/novel master` | 查看/管理大神文风 |',
		'',
		'子命令:',
		'  `/novel model list` | `/novel model init <预设>` | `/novel model set <a> <m>`',
		'  `/novel prompt list` | `/novel prompt path <agent>`',
		'  `/novel master list` | `/novel master show <name>`',
	].join('\n');
}

// ─── Model subcommand ──────────────────────────────────────────

async function handleModelCommand(args: string[]): Promise<string> {
	const sub = args[0];

	if (sub === 'list') {
		const config = getCurrentConfig();
		const agents = Object.keys(config).length > 0
			? config
			: Object.fromEntries(AGENT_TEMPLATES.map((t) => [t.name, { model: t.defaultModel, temperature: t.defaultTemperature }]));
		return showList(agents);
	}

	if (sub === 'init') {
		const presetName = args[1];
		if (!presetName) {
			const available = fs.readdirSync(PRESETS_DIR)
				.filter((f) => f.endsWith('.yaml'))
				.map((f) => f.replace('.yaml', ''));
			return [
				'请指定预设名:\n',
				...available.map((p) => `  /novel model init ${p}`),
				'',
				'预设文件位于 presets/ 目录，可直接编辑',
			].join('\n');
		}

		const presetPath = path.join(PRESETS_DIR, `${presetName}.yaml`);
		if (!fs.existsSync(presetPath)) {
			return `预设 '${presetName}' 不存在。可用: ${fs.readdirSync(PRESETS_DIR).filter((f) => f.endsWith('.yaml')).map((f) => f.replace('.yaml', '')).join(', ')}`;
		}

		try {
			const content = fs.readFileSync(presetPath, 'utf-8');
			const { load } = await import('js-yaml');
			const doc = load(content) as any;
			if (!doc?.agents) {
				return `预设 '${presetName}' 格式无效，缺少 agents 字段`;
			}

			const validated = PluginConfigSchema.safeParse(doc);
			if (!validated.success) {
				return `预设 '${presetName}' 校验失败: ${validated.error.message}`;
			}

			const target = writeConfig(doc.agents, doc.language ?? 'zh');
			const count = Object.keys(doc.agents).length;
			return [
				`✅ 已从预设 **${presetName}** 创建配置`,
				`  - ${count} 个 agent 已配置`,
				`  - 配置文件: \`${target}\``,
				'',
				'运行 `/novel model list` 查看详情',
				'运行 `/novel model set <agent> <model>` 自定义某个 agent',
			].join('\n');
		} catch (e) {
			return `读取预设失败: ${e instanceof Error ? e.message : String(e)}`;
		}
	}

	if (sub === 'set') {
		const agentName = args[1];
		const modelName = args[2];
		const tempIdx = args.indexOf('--temp');
		const temperature = tempIdx >= 0 ? parseFloat(args[tempIdx + 1]) : undefined;

		if (!agentName || !modelName) {
			return '用法: `/novel model set <agent> <model> [--temp N]`\n例如: `/novel model set writer_b openai/gpt-4o --temp 0.5`';
		}

		const template = AGENT_TEMPLATES.find((t) => t.name === agentName);
		if (!template) {
			const valid = AGENT_TEMPLATES.map((t) => `\`${t.name}\``).join(', ');
			return `未知 agent: \`${agentName}\`。可用: ${valid}`;
		}

		const current = getCurrentConfig();
		current[agentName] = {
			model: modelName,
			temperature: temperature ?? current[agentName]?.temperature ?? template.defaultTemperature,
		};

		const target = writeConfig(current);
		const lines = [
			`✅ **${agentName}** 已更新:`,
			`  - model: \`${modelName}\``,
			`  - temperature: ${temperature ?? current[agentName]?.temperature ?? template.defaultTemperature}`,
			`  - 配置文件: \`${target}\``,
		];

		return lines.join('\n');
	}

	// Default: show overview
	const providers = readProviders();
	const current = getCurrentConfig();

	const lines: string[] = [];
	lines.push('## WebNovel Forge 模型配置');
	lines.push('');

	if (Object.keys(current).length > 0) {
		lines.push('**当前配置:**');
		lines.push('');
		const names = Object.keys(current).sort();
		for (const name of names) {
			const a = current[name];
			if (!a.disabled) {
				lines.push(`  - \`${name}\`: \`${a.model}\` (temp=${a.temperature})`);
			}
		}
		lines.push('');
	} else {
		lines.push('*当前无自定义配置，使用模板默认值*');
		lines.push('');
	}

	const provCount = Object.keys(providers).length;
	lines.push(`检测到 **${provCount}** 个 provider`);
	if (provCount > 0) {
		lines.push(Object.keys(providers).map((p) => `  - \`${p}\` (${providers[p].length} 个模型)`).join('\n'));
	}
	lines.push('');
	lines.push('**可用命令:**');
	lines.push('  `/novel model list` — 查看完整配置');
	lines.push('  `/novel model init <预设名>` — 从预设初始化');
	lines.push('  `/novel model set <agent> <model> [--temp N]` — 修改指定 agent');

	return lines.join('\n');
}

// ─── Prompt subcommand ─────────────────────────────────────────

async function handlePromptCommand(args: string[]): Promise<string> {
	const sub = args[0];
	const agentName = args[1];

	if (sub === 'list' || !sub) {
		const names = listAgentPrompts();
		const lines: string[] = [];
		lines.push('## Agent 提示词文件');
		lines.push('');
		lines.push(`共 **${names.length}** 个 agent：`);
		lines.push('');
		for (const name of names) {
			const meta = getAgentPromptMeta(name);
			const fp = getAgentPromptFilePath(name) ?? '（未找到）';
			const desc = meta?.description ? ` — ${meta.description}` : '';
			lines.push(`  - \`${name}\`${desc}`);
			lines.push(`    路径: \`${fp}\``);
		}
		lines.push('');
		lines.push('**编辑提示词**：复制 bundled 文件到用户目录，修改后即可生效：');
		lines.push(`  cp <bundled.json> ${getUserAgentPromptPath('')}`);
		return lines.join('\n');
	}

	if (sub === 'path' && agentName) {
		const fp = getAgentPromptFilePath(agentName);
		if (!fp) return `未找到 agent \`${agentName}\` 的提示词文件`;
		return `**${agentName}** 提示词文件路径: \`${fp}\``;
	}

	return '用法: `/novel prompt list` | `/novel prompt path <agent>`';
}

// ─── Master subcommand ─────────────────────────────────────────

async function handleMasterCommand(args: string[]): Promise<string> {
	const sub = args[0];
	const masterName = args.slice(1).join(' ');

	if (sub === 'list' || !sub) {
		const masters = scanMasters();
		const lines: string[] = [];
		lines.push('## 🏆 大神文风');
		lines.push('');
		lines.push(`已加载 **${masters.length}** 种文风：`);
		lines.push('');
		for (const m of masters) {
			lines.push(`  - **${m.displayName}** (${m.author}) — ${m.description}`);
			lines.push(`    特点: ${m.characteristics.slice(0, 3).join('、')}`);
		}
		lines.push('');
		lines.push('**添加新大神**：在以下目录创建新 JSON 文件，重启后自动加载：');
		lines.push(`  \`${getUserMasterDir()}\``);
		return lines.join('\n');
	}

	if (sub === 'show' && masterName) {
		const masters = scanMasters();
		const m = masters.find(
			(x) => x.name === masterName || x.displayName === masterName,
		);
		if (!m) {
			const names = masters.map((x) => `\`${x.displayName}\``).join(', ');
			return `未找到文风 \`${masterName}\`。可用: ${names}`;
		}
		return [
			`## ${m.displayName}`,
			`**作者**: ${m.author}`,
			`**描述**: ${m.description}`,
			'',
			'**特点**:',
			...m.characteristics.map((c) => `  - ${c}`),
			'',
			'**擅长**:',
			...m.strengths.map((s) => `  - ${s}`),
			'',
			'**短板**:',
			...m.weaknesses.map((w) => `  - ${w}`),
			'',
			'**适合题材**:',
			...m.bestFor.map((b) => `  - ${b}`),
			'',
			'**风格指南**:',
			`  ${m.styleGuide}`,
		].join('\n');
	}

	return '用法: `/novel master list` | `/novel master show <名称>`';
}
