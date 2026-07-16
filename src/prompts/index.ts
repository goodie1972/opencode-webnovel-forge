import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import type { AgentPrompt, MasterStyle } from './types';

export type { AgentPrompt, MasterStyle } from './types';

const PACKAGE_ROOT = findPackageRoot();

const USER_PROMPT_DIR = path.join(
	os.homedir(),
	'.config',
	'opencode',
	'opencode-webnovel-forge',
	'prompts',
);

const BUNDLED_AGENT_DIR = path.join(PACKAGE_ROOT, 'prompts', 'agents');
const BUNDLED_MASTER_DIR = path.join(PACKAGE_ROOT, 'prompts', 'masters');

function findPackageRoot(): string {
	let dir = path.dirname(new URL(import.meta.url).pathname);
	for (let i = 0; i < 8; i++) {
		if (fs.existsSync(path.join(dir, 'prompts', 'agents'))) return dir;
		const parent = path.dirname(dir);
		if (parent === dir) break;
		dir = parent;
	}
	return path.resolve(process.cwd());
}

/**
 * Normalize agent name: editor_in_chief → editor-in-chief
 */
function normalizeName(name: string): string {
	return name.replaceAll('_', '-').toLowerCase();
}

/**
 * Resolve agent prompt file path.
 * Priority: user config dir → bundled prompts/agents/
 */
function resolveAgentPromptPath(agentName: string): string | null {
	const base = normalizeName(agentName);

	// Try user config override dir
	const userPath = path.join(USER_PROMPT_DIR, 'agents', `${base}.json`);
	if (fs.existsSync(userPath)) return userPath;

	// Try bundled dir
	const bundledPath = path.join(BUNDLED_AGENT_DIR, `${base}.json`);
	if (fs.existsSync(bundledPath)) return bundledPath;

	return null;
}

/**
 * Load an agent system prompt by agent name.
 * Falls back to bundled .md file if no JSON found.
 */
export function loadAgentPrompt(agentName: string): string {
	const jsonPath = resolveAgentPromptPath(agentName);
	if (jsonPath) {
		try {
			const raw = fs.readFileSync(jsonPath, 'utf-8');
			const parsed: AgentPrompt = JSON.parse(raw);
			if (parsed?.systemPrompt) return parsed.systemPrompt;
		} catch {
			// fall through
		}
	}

	// Backward compat: try .md from prompts/ root
	const altPath = path.join(PACKAGE_ROOT, 'prompts', `${normalizeName(agentName)}.md`);
	try {
		return fs.readFileSync(altPath, 'utf-8');
	} catch {
		return '';
	}
}

/**
 * Get the full AgentPrompt metadata, or null.
 */
export function getAgentPromptMeta(agentName: string): AgentPrompt | null {
	const jsonPath = resolveAgentPromptPath(agentName);
	if (!jsonPath) return null;
	try {
		const raw = fs.readFileSync(jsonPath, 'utf-8');
		return JSON.parse(raw) as AgentPrompt;
	} catch {
		return null;
	}
}

/**
 * Get the path to an agent's prompt file (for editing/display).
 */
export function getAgentPromptFilePath(agentName: string): string | null {
	return resolveAgentPromptPath(agentName);
}

/**
 * Get the user's editable agent prompt path.
 */
export function getUserAgentPromptPath(agentName: string): string {
	const base = normalizeName(agentName);
	return path.join(USER_PROMPT_DIR, 'agents', `${base}.json`);
}

/**
 * List all available agent prompt names.
 */
export function listAgentPrompts(): string[] {
	const names = new Set<string>();

	// From bundled
	if (fs.existsSync(BUNDLED_AGENT_DIR)) {
		for (const f of fs.readdirSync(BUNDLED_AGENT_DIR)) {
			if (f.endsWith('.json')) names.add(f.replace('.json', ''));
		}
	}

	// From user override (can add new ones)
	const userDir = path.join(USER_PROMPT_DIR, 'agents');
	if (fs.existsSync(userDir)) {
		for (const f of fs.readdirSync(userDir)) {
			if (f.endsWith('.json')) names.add(f.replace('.json', ''));
		}
	}

	return [...names].sort();
}

// ─── Master styles ──────────────────────────────────────────────

/**
 * Scan master style files from both bundled and user dirs.
 * User files take priority on name conflict.
 */
export function scanMasters(): MasterStyle[] {
	const map = new Map<string, MasterStyle>();

	// Load bundled masters
	if (fs.existsSync(BUNDLED_MASTER_DIR)) {
		for (const f of fs.readdirSync(BUNDLED_MASTER_DIR)) {
			if (!f.endsWith('.json')) continue;
			const fp = path.join(BUNDLED_MASTER_DIR, f);
			try {
				const raw = fs.readFileSync(fp, 'utf-8');
				const master = JSON.parse(raw) as MasterStyle;
				if (master?.name) map.set(master.name, master);
			} catch {
				// skip corrupt file
			}
		}
	}

	// Load user masters (override or add new)
	const userDir = path.join(USER_PROMPT_DIR, 'masters');
	if (fs.existsSync(userDir)) {
		for (const f of fs.readdirSync(userDir)) {
			if (!f.endsWith('.json')) continue;
			const fp = path.join(userDir, f);
			try {
				const raw = fs.readFileSync(fp, 'utf-8');
				const master = JSON.parse(raw) as MasterStyle;
				if (master?.name) map.set(master.name, master);
			} catch {
				// skip corrupt file
			}
		}
	}

	return [...map.values()];
}

/**
 * Get the user's master directory path (for adding new masters).
 */
export function getUserMasterDir(): string {
	return path.join(USER_PROMPT_DIR, 'masters');
}
