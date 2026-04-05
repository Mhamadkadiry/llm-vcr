// vitest.setup.ts
import { setupLLMVCR } from 'llm-vcr';

// This is an example setup file configuring llm-vcr for testing.
// In actual usage, point your tools (like vitest) to load this before your tests!
setupLLMVCR({
  mode: process.env.CI ? 'replay' : 'record',
  cassetteDir: './__llm_cassettes__',
});
