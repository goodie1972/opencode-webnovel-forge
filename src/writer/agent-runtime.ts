import fs from 'fs';
import path from 'path';

import { getProvider } from './providers';
import { AgentTimeoutError, AgentAuthError, AgentResponseError } from './errors';

export { AgentTimeoutError, AgentAuthError, AgentResponseError };

export interface AgentCallOptions {
  agentName: string;
  systemPrompt?: string;
  userMessage: string;
  model?: string;
  temperature?: number;
  masterStyle?: string;
}

export interface AgentResponse {
  content: string;
  model: string;
  tokensUsed?: number;
  durationMs: number;
}

export interface AgentRuntimeConfig {
  apiKey?: string;
  anthropicKey?: string;
  baseUrl?: string;
  defaultModel?: string;
  defaultTemperature?: number;
  timeoutMs?: number;
}

export async function callAgent(
  options: AgentCallOptions,
  config?: AgentRuntimeConfig,
): Promise<AgentResponse> {
  const startTime = Date.now();

  try {
    const agentPromptPath = path.join(process.cwd(), 'prompts', 'agents', `${options.agentName}.json`);
    let agentPrompt: any;
    try {
      agentPrompt = JSON.parse(fs.readFileSync(agentPromptPath, 'utf-8'));
    } catch (error) {
      throw new AgentResponseError(`Failed to load agent prompt: ${agentPromptPath}`);
    }

    let systemPrompt = agentPrompt?.systemPrompt ?? '';

    if (options.masterStyle) {
      const { injectStyle } = await import('./style/inject-style');
      systemPrompt = injectStyle(systemPrompt, options.masterStyle);
    }

    if (options.systemPrompt) {
      systemPrompt += `\n\n${options.systemPrompt}`;
    }

    const model = options.model ?? config?.defaultModel ?? 'openai/gpt-4o';
    const temperature = options.temperature ?? config?.defaultTemperature ?? 0.7;

    const provider = getProvider(model);

    const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: options.userMessage });

    const timeoutMs = config?.timeoutMs ?? 60000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    let apiKey: string | undefined;
    if (provider.name === 'openai') {
      apiKey = config?.apiKey ?? process.env.OPENAI_API_KEY ?? process.env.LLM_API_KEY;
    } else if (provider.name === 'anthropic') {
      apiKey = config?.anthropicKey ?? process.env.ANTHROPIC_API_KEY;
    }

    const result = await provider.call(model, messages, {
      temperature,
      signal: controller.signal,
      apiKey,
    });

    clearTimeout(timeoutId);

    return {
      content: result.content,
      model: result.model,
      tokensUsed: result.tokensUsed,
      durationMs: Date.now() - startTime,
    };
  } catch (error) {
    if (error instanceof AgentTimeoutError || error instanceof AgentAuthError || error instanceof AgentResponseError) {
      throw error;
    }

    if (error instanceof Error && error.name === 'AbortError') {
      throw new AgentTimeoutError();
    }

    throw new AgentResponseError(`Unexpected error: ${error instanceof Error ? error.message : String(error)}`);
  }
}
