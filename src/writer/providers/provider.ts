export interface LLMProvider {
  name: string;
  match(model: string): boolean;
  call(
    model: string,
    messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
    options: { temperature?: number; maxTokens?: number; signal?: AbortSignal; apiKey?: string },
  ): Promise<{ content: string; model: string; tokensUsed?: number }>;
}