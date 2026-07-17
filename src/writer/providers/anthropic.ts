import { AgentAuthError, AgentResponseError } from '../errors';

export class AnthropicProvider {
  readonly name = 'anthropic';

  constructor(private readonly config: { apiKey?: string } = {}) {}

  match(model: string): boolean {
    // Returns true if model starts with anthropic/ or claude-
    if (model.startsWith('anthropic/') || model.startsWith('claude-')) {
      return true;
    }
    return false;
  }

  async call(
    model: string,
    messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
    options: { temperature?: number; maxTokens?: number; signal?: AbortSignal; apiKey?: string },
  ): Promise<{ content: string; model: string; tokensUsed?: number }> {
    const apiKey = options.apiKey ?? this.config.apiKey ?? process.env.ANTHROPIC_API_KEY;

    const body = {
      model,
      messages,
      max_tokens: options.maxTokens,
      temperature: options.temperature,
    };

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey ?? '',
        'anthropic-version': '2023-06-01',
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
    const content = data.content?.[0]?.text || '';
    const tokensUsed = data.usage?.output_tokens;

    if (!content) {
      throw new AgentResponseError('Invalid response from agent: No content in response');
    }

    return { content, model, tokensUsed };
  }
}
