import { describe, it, expect, beforeEach } from 'bun:test';
import { createAgents, getAgentConfigs } from '../agents';
import type { PluginConfig } from '../config';

function makeBaseConfig(overrides?: Record<string, unknown>): PluginConfig {
	return {
		qa_retry_limit: 3,
		file_retry_enabled: true,
		max_file_operation_retries: 3,
		config_validation_enabled: true,
		language: 'zh',
		context_budget: {
			enabled: true,
			warn: 0.7,
			critical: 0.9,
			max_injection_tokens: 4000,
			model_limits: { default: 128000 },
			target_agents: ['architect'],
		},
		evidence: {
			enabled: true,
			max_age_days: 90,
			max_bundles: 1000,
			auto_archive: false,
		},
		guardrails: {
			enabled: true,
			max_tool_calls: 200,
			max_duration_minutes: 30,
			max_repetitions: 10,
			max_consecutive_errors: 5,
			warning_threshold: 0.5,
		},
		...overrides,
	} as PluginConfig;
}

describe('createAgents', () => {
	let mockConfig: PluginConfig;

	beforeEach(() => {
		mockConfig = makeBaseConfig({
			agents: {
				writer_a: { model: 'custom-model', temperature: 0.8 },
			},
		});
	});

	describe('Happy path', () => {
		it('should create all agents from templates', () => {
			const agents = createAgents();

			expect(agents).toHaveLength(14);
			expect(agents).toContainEqual(
				expect.objectContaining({ name: 'editor_in_chief' }),
			);
			expect(agents).toContainEqual(
				expect.objectContaining({ name: 'research_market' }),
			);
			expect(agents).toContainEqual(
				expect.objectContaining({ name: 'research_deep' }),
			);
			expect(agents).toContainEqual(
				expect.objectContaining({ name: 'writer_a' }),
			);
			expect(agents).toContainEqual(
				expect.objectContaining({ name: 'writer_b' }),
			);
			expect(agents).toContainEqual(
				expect.objectContaining({ name: 'writer_c' }),
			);
			expect(agents).toContainEqual(
				expect.objectContaining({ name: 'world_builder' }),
			);
			expect(agents).toContainEqual(
				expect.objectContaining({ name: 'character_designer' }),
			);
			expect(agents).toContainEqual(
				expect.objectContaining({ name: 'plot_architect' }),
			);
			expect(agents).toContainEqual(
				expect.objectContaining({ name: 'shuang_analyzer' }),
			);
			expect(agents).toContainEqual(
				expect.objectContaining({ name: 'pacing_reviewer' }),
			);
			expect(agents).toContainEqual(
				expect.objectContaining({ name: 'genre_checker' }),
			);
			expect(agents).toContainEqual(
				expect.objectContaining({ name: 'reader_simulator' }),
			);
			expect(agents).toContainEqual(
				expect.objectContaining({ name: 'copy_editor' }),
			);
		});

		it('should create agent with default model when no override', () => {
			const agents = createAgents(mockConfig);

			const editor = agents.find((a) => a.name === 'editor_in_chief');
			expect(editor).toBeDefined();
			expect(editor?.config.model).toBe('anthropic/claude-sonnet-4-5');
		});

		it('should create agent with default temperature when no override', () => {
			const agents = createAgents(mockConfig);

			const editor = agents.find((a) => a.name === 'editor_in_chief');
			expect(editor).toBeDefined();
			expect(editor?.config.temperature).toBe(0.1);
		});
	});

	describe('Config overrides', () => {
		it('should apply model override from config', () => {
			const agents = createAgents(mockConfig);

			const writer = agents.find((a) => a.name === 'writer_a');
			expect(writer).toBeDefined();
			expect(writer?.config.model).toBe('custom-model');
		});

		it('should apply temperature override from config', () => {
			const agents = createAgents(mockConfig);

			const writer = agents.find((a) => a.name === 'writer_a');
			expect(writer).toBeDefined();
			expect(writer?.config.temperature).toBe(0.8);
		});

		it('should apply multiple overrides', () => {
			mockConfig = makeBaseConfig({
				agents: {
					editor_in_chief: {
						model: 'gpt-4-turbo',
						temperature: 0.15,
					},
				},
			});
			const agents = createAgents(mockConfig);

			const editor = agents.find((a) => a.name === 'editor_in_chief');
			expect(editor).toBeDefined();
			expect(editor?.config.model).toBe('gpt-4-turbo');
			expect(editor?.config.temperature).toBe(0.15);
		});

		it('should preserve default temperature when not overridden', () => {
			const agents = createAgents(mockConfig);

			const researcher = agents.find((a) => a.name === 'research_market');
			expect(researcher).toBeDefined();
			expect(researcher?.config.temperature).toBe(0.2);
		});

		it('should use default model when no override', () => {
			const agents = createAgents(mockConfig);

			const researcher = agents.find((a) => a.name === 'research_market');
			expect(researcher).toBeDefined();
			expect(researcher?.config.model).toBe('google/gemini-2.0-flash');
		});
	});

	describe('Disabled agents', () => {
		it('should skip disabled agents', () => {
			mockConfig = makeBaseConfig({
				agents: {
					research_market: { disabled: true },
				},
			});
			const agents = createAgents(mockConfig);

			expect(agents).toHaveLength(13);
			expect(agents).not.toContainEqual(
				expect.objectContaining({ name: 'research_market' }),
			);
		});

		it('should respect disabled flag in config', () => {
			mockConfig = makeBaseConfig({
				agents: {
					research_market: { disabled: true },
				},
			});
			const agents = createAgents(mockConfig);

			expect(agents).toHaveLength(13);
			expect(agents.find((a) => a.name === 'research_market')).toBeUndefined();
		});

		it('should not skip agent when disabled is false', () => {
			mockConfig = makeBaseConfig({
				agents: {
					editor_in_chief: { disabled: false },
				},
			});
			const agents = createAgents(mockConfig);

			expect(agents).toHaveLength(14);
			expect(agents.find((a) => a.name === 'editor_in_chief')).toBeDefined();
		});
	});

	describe('getAgentConfigs', () => {
		it('should convert agents to SDK configs', () => {
			mockConfig = makeBaseConfig({
				agents: {
					research_market: { disabled: true },
				},
			});
			const sdkConfigs = getAgentConfigs(mockConfig);

			expect(Object.keys(sdkConfigs)).toHaveLength(13);
			expect(sdkConfigs['editor_in_chief']).toBeDefined();
			expect(sdkConfigs['writer_a']).toBeDefined();
			expect(sdkConfigs['research_market']).toBeUndefined();
		});

		it('should include description in SDK config', () => {
			const sdkConfigs = getAgentConfigs(mockConfig);

			expect(sdkConfigs['editor_in_chief']).toHaveProperty('description');
			expect(sdkConfigs['editor_in_chief'].description).toBeDefined();
			expect(typeof sdkConfigs['editor_in_chief'].description).toBe('string');
		});

		it('should set editor_in_chief mode to primary', () => {
			const sdkConfigs = getAgentConfigs(mockConfig);

			expect(sdkConfigs['editor_in_chief'].mode).toBe('primary');
		});

		it('should set other agents mode to subagent', () => {
			const sdkConfigs = getAgentConfigs(mockConfig);

			expect(sdkConfigs['writer_a'].mode).toBe('subagent');
			expect(sdkConfigs['research_market'].mode).toBe('subagent');
			expect(sdkConfigs['world_builder'].mode).toBe('subagent');
		});

		it('should include all config properties in SDK config', () => {
			const sdkConfigs = getAgentConfigs(mockConfig);

			expect(sdkConfigs['writer_a']).toHaveProperty('model');
			expect(sdkConfigs['writer_a']).toHaveProperty('temperature');
			expect(sdkConfigs['writer_a']).toHaveProperty('prompt');
		});
	});

	describe('Edge cases', () => {
		it('should handle empty config', () => {
			const agents = createAgents(undefined);

			expect(agents).toHaveLength(14);
			expect(agents[0].name).toBe('editor_in_chief');
		});

		it('should handle config with no agent overrides', () => {
			const agents = createAgents(makeBaseConfig());

			expect(agents).toHaveLength(14);
			expect(agents.find((a) => a.name === 'research_market')).toBeDefined();
		});

		it('should handle config with undefined agents', () => {
			const agents = createAgents(makeBaseConfig({ agents: undefined }));

			expect(agents).toHaveLength(14);
		});

		it('should handle all agents disabled', () => {
			mockConfig = makeBaseConfig({
				agents: {
					editor_in_chief: { disabled: true },
					research_market: { disabled: true },
					research_deep: { disabled: true },
					writer_a: { disabled: true },
					writer_b: { disabled: true },
					writer_c: { disabled: true },
					world_builder: { disabled: true },
					character_designer: { disabled: true },
					plot_architect: { disabled: true },
					shuang_analyzer: { disabled: true },
					pacing_reviewer: { disabled: true },
					genre_checker: { disabled: true },
					reader_simulator: { disabled: true },
					copy_editor: { disabled: true },
				},
			});
			const agents = createAgents(mockConfig);

			expect(agents).toHaveLength(0);
		});

		it('should work with config provided', () => {
			const agents = createAgents(mockConfig);
			expect(agents).toBeDefined();
		});
	});
});
