import type { LLMProvider } from './provider';
export { OpenAIProvider } from './openai';
export { AnthropicProvider } from './anthropic';

// Provider registry
const _providers: LLMProvider[] = [];

export function registerProvider(provider: LLMProvider): void {
  _providers.push(provider);
}

export function getProvider(model: string): LLMProvider {
  for (const p of _providers) {
    if (p.match(model)) return p;
  }
  throw new Error(`No provider found for model: ${model}`);
}

export function resetProviders(): void {
  _providers.length = 0;
}

// Register defaults on first import
import { OpenAIProvider } from './openai';
import { AnthropicProvider } from './anthropic';
registerProvider(new OpenAIProvider());
registerProvider(new AnthropicProvider());
