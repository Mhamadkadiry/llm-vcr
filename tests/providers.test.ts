import { describe, it, expect } from 'vitest';
import { openaiProvider } from '../src/providers/openai-provider.js';
import { anthropicProvider } from '../src/providers/anthropic-provider.js';
import { defineProvider } from '../src/providers/index.js';

describe('providers', () => {
  it('openaiProvider matches correct base URLs', () => {
    expect(openaiProvider.baseUrls).toContain('https://api.openai.com');
  });

  it('anthropicProvider matches correct base URLs', () => {
    expect(anthropicProvider.baseUrls).toContain('https://api.anthropic.com');
  });

  it('defineProvider returns valid provider object', () => {
    const custom = defineProvider({
      name: 'custom',
      baseUrls: ['https://api.custom.com'],
      hashFields: ['model'],
    });
    expect(custom.name).toBe('custom');
    expect(custom.baseUrls).toContain('https://api.custom.com');
    expect(custom.hashFields).toContain('model');
  });
});
