export class OpenAIProvider {
  readonly name = 'openai';

  constructor(private readonly config: { apiKey?: string; baseUrl?: string } = {}) {}

  match(model: string): boolean {
    // Returns true if model does NOT match anthropic/ or claude- prefix
    if (model.startsWith('anthropic/') || model.startsWith('claude-')) {
      return false;
    }
    return true;
  }

  async call(
    model: string,
    messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
    options: { temperature?: number; maxTokens?: number; signal?: AbortSignal; apiKey?: string },
  ): Promise<{ content: string; model: string; tokensUsed?: number }> {
    const baseUrl = this.config.baseUrl ?? 'https://api.openai.com/v1';
    const apiKey = options.apiKey ?? this.config.apiKey ?? process.env.OPENAI_API_KEY ?? process.env.LLM_API_KEY;

    const body = {
      model,
      messages,
      temperature: options.temperature,
      max_tokens: options.maxTokens,
    };

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: options.signal,
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new AgentAuthError('Authentication failed');
      }
      throw new AgentResponseError(`Invalid response from agent: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    const tokensUsed = data.usage?.total_tokens;

    if (!content) {
      throw new AgentResponseError('Invalid response from agent: No content in response');
    }

    return { content, model, tokensUsed };
  }
}

import { AgentAuthError, AgentResponseError } from '../errors';