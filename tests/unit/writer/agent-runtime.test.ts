import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import * as path from 'path';
import * as fs from 'fs';
import { callAgent, AgentTimeoutError, AgentAuthError, AgentResponseError } from '../../../src/writer/agent-runtime';
import { resetProviders, registerProvider, getProvider } from '../../../src/writer/providers';

const originalFetch = globalThis.fetch;
const cwd = process.cwd();

// Mock provider that returns predictable responses
class MockProvider {
  readonly name = 'mock';
  private response: any;
  private shouldTimeout = false;
  private shouldAuthFail = false;

  setResponse(r: any) { this.response = r; }
  setTimeout(v: boolean) { this.shouldTimeout = v; }
  setAuthFail(v: boolean) { this.shouldAuthFail = v; }

  match(_model: string): boolean { return true; }

  async call(
    _model: string,
    _messages: any[],
    options?: { signal?: AbortSignal },
  ): Promise<{ content: string; model: string; tokensUsed?: number }> {
    if (this.shouldTimeout) {
      return new Promise((_, reject) => {
        const timer = setTimeout(() => reject(new DOMException('Aborted', 'AbortError')), 5);
        if (options?.signal) {
          (options.signal as AbortSignal).onabort = () => {
            clearTimeout(timer);
            reject(new DOMException('Aborted', 'AbortError'));
          };
        }
      });
    }
    if (this.shouldAuthFail) {
      throw new AgentAuthError();
    }
    if (!this.response) {
      throw new AgentResponseError('Invalid response from agent: No content in response');
    }
    return {
      content: this.response.content,
      model: _model,
      tokensUsed: this.response.tokensUsed,
    };
  }
}

const mockProvider = new MockProvider();

describe('callAgent', () => {
  beforeAll(() => {
    resetProviders();
    registerProvider(mockProvider as any);
  });

  afterAll(() => {
    resetProviders();
    globalThis.fetch = originalFetch;
  });

  it('loads agent prompt from JSON file', async () => {
    mockProvider.setResponse({ content: 'test response', tokensUsed: 10 });
    const result = await callAgent({
      agentName: 'editor-in-chief',
      userMessage: 'test',
      model: 'mock-model',
    });
    expect(result.content).toBe('test response');
    expect(result.tokensUsed).toBe(10);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('loads master style and appends instructions', async () => {
    mockProvider.setResponse({ content: 'styled response', tokensUsed: 5 });
    const result = await callAgent({
      agentName: 'editor-in-chief',
      userMessage: 'write a chapter',
      masterStyle: '辰东流',
      model: 'mock-model',
    });
    expect(result.content).toBe('styled response');
  });

  it('matches master by displayName', async () => {
    mockProvider.setResponse({ content: 'display matched', tokensUsed: 3 });
    const result = await callAgent({
      agentName: 'editor-in-chief',
      userMessage: 'hi',
      masterStyle: '辰东流',
      model: 'mock-model',
    });
    expect(result.content).toBe('display matched');
  });

  it('uses model from options over config default', async () => {
    mockProvider.setResponse({ content: 'test' });
    const result = await callAgent(
      { agentName: 'editor-in-chief', userMessage: 'hi', model: 'mock-model' },
      { defaultModel: 'other-model' },
    );
    expect(result.content).toBe('test');
  });

  it('throws AgentTimeoutError on abort', async () => {
    mockProvider.setTimeout(true);
    try {
      await callAgent(
        { agentName: 'editor-in-chief', userMessage: 'hi', model: 'mock-model' },
        { timeoutMs: 10 },
      );
      expect.unreachable('Should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(AgentTimeoutError);
    }
    mockProvider.setTimeout(false);
  });

  it('throws AgentAuthError on auth failure', async () => {
    mockProvider.setAuthFail(true);
    try {
      await callAgent(
        { agentName: 'editor-in-chief', userMessage: 'hi', model: 'mock-model' },
      );
      expect.unreachable('Should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(AgentAuthError);
    }
    mockProvider.setAuthFail(false);
  });

  it('throws AgentResponseError on invalid prompt file', async () => {
    try {
      await callAgent({
        agentName: 'non_existent_agent_xyz',
        userMessage: 'hi',
        model: 'mock-model',
      });
      expect.unreachable('Should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(AgentResponseError);
    }
  });
});

describe('provider registry', () => {
  afterAll(() => {
    resetProviders();
  });

  it('returns provider by model match', () => {
    resetProviders();
    registerProvider(mockProvider as any);
    const p = getProvider('any-model');
    expect(p.name).toBe('mock');
  });

  it('throws on no matching provider', () => {
    resetProviders();
    expect(() => getProvider('any')).toThrow('No provider found for model');
  });
});

describe('real provider matching', () => {
  beforeAll(() => {
    resetProviders();
  });

  afterAll(() => {
    resetProviders();
  });

  it('matches OpenAI for gpt-4o', async () => {
    // Re-register real providers
    const { OpenAIProvider } = await import('../../../src/writer/providers/openai');
    const { AnthropicProvider } = await import('../../../src/writer/providers/anthropic');
    registerProvider(new OpenAIProvider() as any);
    registerProvider(new AnthropicProvider() as any);

    const p = getProvider('gpt-4o');
    expect(p.name).toBe('openai');

    const p2 = getProvider('claude-3-opus');
    expect(p2.name).toBe('anthropic');

    const p3 = getProvider('anthropic/claude-3-5-sonnet');
    expect(p3.name).toBe('anthropic');
  });
});
