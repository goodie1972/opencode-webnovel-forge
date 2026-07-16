import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as yaml from 'js-yaml';
import {
	type PluginConfig,
	PluginConfigSchema,
	getConfigValidationEnabled,
	getContextBudgetDefaults,
	getEvidenceDefaults,
	getGuardrailsDefaults,
	getHooksDefaults,
} from './schema';
import { warn } from '../utils/logger';
import { swarmState } from '../state';

const __filename = fileURLToPath(import.meta.url);
const __moduleDir = path.dirname(__filename);

/**
 * Resolve the package root directory by searching upward for the prompts/ directory.
 * Works from both source (src/config/) and bundled (dist/) locations.
 */
function resolvePackageRoot(): string {
	let dir = __moduleDir;
	// Walk up to find the directory containing prompts/agents/ (exclusive marker)
	for (let i = 0; i < 5; i++) {
		if (fs.existsSync(path.join(dir, 'prompts', 'agents'))) {
			return dir;
		}
		const parent = path.dirname(dir);
		if (parent === dir) break;
		dir = parent;
	}
	// Fallback: check for references/ (another project-root marker)
	dir = __moduleDir;
	for (let i = 0; i < 5; i++) {
		if (fs.existsSync(path.join(dir, 'references'))) return dir;
		const parent = path.dirname(dir);
		if (parent === dir) break;
		dir = parent;
	}
	// Last fallback: 2 levels up from src/config/
	return path.join(__moduleDir, '..', '..');
}

const PACKAGE_ROOT = resolvePackageRoot();

export const MAX_CONFIG_FILE_BYTES = 102_400;

function clonePluginConfig(config: PluginConfig): PluginConfig {
	return JSON.parse(JSON.stringify(config));
}

function createDefaultPluginConfig(): PluginConfig {
	return {
		qa_retry_limit: 3,
		file_retry_enabled: true,
		max_file_operation_retries: 3,
		config_validation_enabled: true,
		language: 'zh',
		context_budget: getContextBudgetDefaults(),
		evidence: getEvidenceDefaults(),
		guardrails: getGuardrailsDefaults(),
		hooks: getHooksDefaults(),
	};
}

/**
 * Structured error log entry for config loading failures.
 */
export interface ConfigLoadErrorLog {
	timestamp: string;
	filePath: string;
	errorCode: string | null;
	errorName: string;
	message: string;
}

/**
 * Log a structured error when config loading fails.
 * Exported for testing purposes.
 */
export function logConfigLoadError(filePath: string, error: unknown): void {
	const logEntry: ConfigLoadErrorLog = {
		timestamp: new Date().toISOString(),
		filePath,
		errorCode: error instanceof Error && 'code' in error ? String((error as any).code) : null,
		errorName: error instanceof Error ? error.name : 'UnknownError',
		message: error instanceof Error ? error.message : String(error),
	};

	warn('Config load error', logEntry);
}

/** XDG-compliant user config directory (~/.config or $XDG_CONFIG_HOME). */
function getUserConfigDir(): string {
	return process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
}

/** Parse raw string content as JSON or YAML, returning object or null. */
function parseConfigContent(content: string, filePath: string): Record<string, unknown> | null {
	const ext = path.extname(filePath).toLowerCase();
	try {
		if (ext === '.yaml' || ext === '.yml') {
			const doc = yaml.load(content);
			if (typeof doc !== 'object' || doc === null || Array.isArray(doc)) {
				warn('Config file must contain a top-level object', { path: filePath });
				return null;
			}
			return doc as Record<string, unknown>;
		}
		return JSON.parse(content);
	} catch (error) {
		logConfigLoadError(filePath, error);
		return null;
	}
}

/** Load and validate config from path (JSON or YAML), returning null on any failure. */
function loadConfigFromPath(configPath: string): PluginConfig | null {
	try {
		if (!fs.existsSync(configPath)) return null;

		const stats = fs.statSync(configPath);
		if (stats.size > MAX_CONFIG_FILE_BYTES) {
			warn('Config file too large', {
				path: configPath,
				maxBytes: MAX_CONFIG_FILE_BYTES,
			});
			return null;
		}

		const content = fs.readFileSync(configPath, 'utf-8');
		const rawConfig = parseConfigContent(content, configPath);
		if (!rawConfig) return null;

		const result = PluginConfigSchema.safeParse(rawConfig);
		if (!result.success) {
			warn('Invalid config document', {
				path: configPath,
				errors: result.error.format(),
			});
			return null;
		}

		return result.data;
	} catch (error) {
		logConfigLoadError(configPath, error);
		return null;
	}
}

/** Return the first existing config path from a list of candidates (JSON → YAML). */
function resolveConfigPath(...candidates: string[]): string | null {
	for (const p of candidates) {
		if (fs.existsSync(p)) return p;
	}
	return null;
}

/**
 * Options for deepMerge function.
 */
export interface DeepMergeOptions {
	enforceKeyFiltering?: boolean;
}

/**
 * Forbidden keys that could be used for prototype pollution.
 */
const FORBIDDEN_KEYS = ['__proto__', 'constructor', 'prototype'];

/**
 * Deep merge two objects, with override values taking precedence.
 * Arrays are replaced, not merged.
 * 
 * When enforceKeyFiltering is enabled, keys like __proto__, constructor, and prototype
 * are skipped to prevent prototype pollution attacks.
 */
export function deepMerge<T>(
	base?: T,
	override?: T,
	options: DeepMergeOptions = {},
): T | undefined {
	if (base === undefined) return override;
	if (override === undefined) return base;

	if (
		typeof base !== 'object' ||
		base === null ||
		typeof override !== 'object' ||
		override === null ||
		Array.isArray(base) ||
		Array.isArray(override)
	) {
		return override;
	}

	const { enforceKeyFiltering = true } = options;
	const result = { ...base } as any;

	for (const key of Object.keys(override)) {
		// Skip forbidden keys when filtering is enabled
		if (enforceKeyFiltering && FORBIDDEN_KEYS.includes(key)) {
			continue;
		}

		const baseValue = (base as any)[key];
		const overrideValue = (override as any)[key];
		result[key] = deepMerge(baseValue, overrideValue, options);
	}
	return result as T;
}

/**
 * Resolve config file paths (JSON + YAML alternatives).
 */
function resolveConfigPaths(directory: string): { user: string[]; project: string[] } {
	const extless = 'opencode-webnovel-forge';
	const userDir = path.join(getUserConfigDir(), 'opencode');
	const projectDir = path.join(directory, '.opencode');

	return {
		user: [path.join(userDir, `${extless}.json`), path.join(userDir, `${extless}.yaml`), path.join(userDir, `${extless}.yml`)],
		project: [path.join(projectDir, `${extless}.json`), path.join(projectDir, `${extless}.yaml`), path.join(projectDir, `${extless}.yml`)],
	};
}

/**
 * Load plugin configuration from user and project config files.
 *
 * Config locations (tried in order):
 * 1. User config: ~/.config/opencode/opencode-webnovel-forge.{json,yaml,yml}
 * 2. Project config: <directory>/.opencode/opencode-webnovel-forge.{json,yaml,yml}
 *
 * Project config takes precedence.
 */
export function loadPluginConfig(directory: string): PluginConfig {
	const paths = resolveConfigPaths(directory);

	const userConfigPath = resolveConfigPath(...paths.user);
	const projectConfigPath = resolveConfigPath(...paths.project);

	const userConfig = userConfigPath ? loadConfigFromPath(userConfigPath) : null;
	const projectConfig = projectConfigPath ? loadConfigFromPath(projectConfigPath) : null;

	let config: PluginConfig;

	if (userConfig) {
		config = clonePluginConfig(userConfig);
	} else if (swarmState.lastValidConfig) {
		warn('Falling back to last valid plugin config (project config will still apply)', {
			source: 'lastValidConfig',
		});
		config = clonePluginConfig(swarmState.lastValidConfig);
	} else {
		warn('Falling back to default plugin config', { source: 'defaults' });
		config = createDefaultPluginConfig();
	}

	if (projectConfig) {
		config = {
			...config,
			...projectConfig,
			agents: deepMerge(config.agents, projectConfig.agents, {
				enforceKeyFiltering: getConfigValidationEnabled(projectConfig),
			}),
			// Deep merge context_budget, evidence, guardrails, and hooks
			context_budget: deepMerge(
				config.context_budget ?? getContextBudgetDefaults(),
				projectConfig.context_budget,
				{ enforceKeyFiltering: getConfigValidationEnabled(projectConfig) },
			) ?? getContextBudgetDefaults(),
			evidence: deepMerge(
				config.evidence ?? getEvidenceDefaults(),
				projectConfig.evidence,
				{ enforceKeyFiltering: getConfigValidationEnabled(projectConfig) },
			) ?? getEvidenceDefaults(),
			guardrails: deepMerge(
				config.guardrails ?? getGuardrailsDefaults(),
				projectConfig.guardrails,
				{ enforceKeyFiltering: getConfigValidationEnabled(projectConfig) },
			) ?? getGuardrailsDefaults(),
			hooks: deepMerge(
				config.hooks ?? getHooksDefaults(),
				projectConfig.hooks,
				{ enforceKeyFiltering: getConfigValidationEnabled(projectConfig) },
			) ?? getHooksDefaults(),
		};
	}

	swarmState.lastValidConfig = clonePluginConfig(config);

	return config;
}

/**
 * Load prompt file from prompts/ directory.
 * Supports language subdirectories: prompts/zh/, prompts/en/
 * Falls back to prompts/ root if language dir not found.
 */
export function loadPrompt(name: string, language: string = 'zh'): string {
	// Try language-specific directory first
	const langPaths: string[] = [];
	if (language !== 'zh') {
		langPaths.push(path.join(PACKAGE_ROOT, 'prompts', language, `${name}.md`));
	}
	// Then try root prompts/ directory
	langPaths.push(path.join(PACKAGE_ROOT, 'prompts', `${name}.md`));

	for (const promptPath of langPaths) {
		try {
			return fs.readFileSync(promptPath, 'utf-8');
		} catch {
			continue;
		}
	}

	// Last resort: try underscore variant
	const altPath = path.join(PACKAGE_ROOT, 'prompts', `${name.replace(/-/g, '_')}.md`);
	try {
		return fs.readFileSync(altPath, 'utf-8');
	} catch {
		return '';
	}
}

/**
 * Load reference file from references/ directory
 */
export function loadReference(name: string): string {
	const refPath = path.join(PACKAGE_ROOT, 'references', `${name}.md`);
	try {
		return fs.readFileSync(refPath, 'utf-8');
	} catch (error) {
		warn('Error reading reference file', { name, path: refPath, error });
		return '';
	}
}
