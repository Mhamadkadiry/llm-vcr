import { defineProvider } from './index.js';

export const openaiProvider = defineProvider({
  name: 'openai',
  baseUrls: ['https://api.openai.com'],
  hashFields: [
    'model',
    'messages',
    'temperature',
    'max_tokens',
    'max_completion_tokens',
    'stream',
    'tools',
    'tool_choice',
    'response_format',
    'system',
  ],
});
