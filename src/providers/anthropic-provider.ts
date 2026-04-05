import { defineProvider } from './index.js';

export const anthropicProvider = defineProvider({
  name: 'anthropic',
  baseUrls: ['https://api.anthropic.com'],
  hashFields: [
    'model',
    'messages',
    'system',
    'max_tokens',
    'temperature',
    'stream',
    'tools',
    'tool_choice',
    'metadata',
  ],
});
