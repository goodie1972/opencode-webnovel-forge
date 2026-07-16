import type { AgentConfig as SDKAgentConfig } from '@opencode-ai/sdk';
import { type PluginConfig } from '../config';
import { loadAgentPrompt } from '../prompts';
import type { AgentDefinition } from './types';
import { AGENT_TEMPLATES } from './definitions';

export type { AgentDefinition } from './types';

/**
 * Resolution chain (highest to lowest):
 *   1. config.agents.<name>.model/temperature  (user override)
 *   2. AGENT_TEMPLATES.<name>.defaultModel/defaultTemperature (code fallback)
 */

function getModelForAgent(
	agentName: string,
	templateDefault: string,
	config?: PluginConfig,
): string {
	return config?.agents?.[agentName]?.model ?? templateDefault;
}

function getTemperatureForAgent(
	agentName: string,
	templateDefault: number,
	config?: PluginConfig,
): number {
	return config?.agents?.[agentName]?.temperature ?? templateDefault;
}

function isAgentDisabled(
	agentName: string,
	config?: PluginConfig,
): boolean {
	return config?.agents?.[agentName]?.disabled === true;
}

/**
 * Create all agent definitions with configuration applied.
 * Resolution: config.agents.<name> → template default.
 */
export function createAgents(config?: PluginConfig): AgentDefinition[] {
	const agents: AgentDefinition[] = [];

	const getPrompt = (name: string) =>
		loadAgentPrompt(name);

	for (const template of AGENT_TEMPLATES) {
		if (!isAgentDisabled(template.name, config)) {
			const agent: AgentDefinition = {
				name: template.name,
				description: template.description,
				config: {
					model: getModelForAgent(template.name, template.defaultModel, config),
					temperature: getTemperatureForAgent(
						template.name,
						template.defaultTemperature,
						config,
					),
					prompt: getPrompt(template.name),
				},
			};
			agents.push(agent);
		}
	}

	return agents;
}

/**
 * Get agent configurations formatted for the OpenCode SDK.
 */
export function getAgentConfigs(
	config?: PluginConfig,
): Record<string, SDKAgentConfig> {
	const agents = createAgents(config);

	return Object.fromEntries(
		agents.map((agent) => {
			const sdkConfig: SDKAgentConfig = {
				...agent.config,
				description: agent.description,
			};

			if (agent.name === 'editor_in_chief') {
				sdkConfig.mode = 'primary';
			} else {
				sdkConfig.mode = 'subagent';
			}

			return [agent.name, sdkConfig];
		}),
	);
}
