import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { doctor } from '../src/cli/main.js';
import fs from 'node:fs';
import path from 'node:path';

const TEST_DIR = './tests/__tmp_cli_doctor__';

function cleanup() {
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  }
}

describe('cli-doctor', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it('exits with code 1 if directory does not exist', () => {
    const logs: string[] = [];
    const code = doctor('./missing_dir', (msg) => logs.push(msg));
    expect(code).toBe(1);
    expect(logs[0]).toContain('Directory not found');
  });

  it('outputs correct stats for a directory full of cassettes', () => {
    fs.mkdirSync(TEST_DIR, { recursive: true });

    // Create 3 fake cassettes: 2 JSON (openai), 1 streaming (anthropic)
    const c1 = {
      version: '1', provider: 'openai',
      request: { url: '', method: '', body: {}, headers: {} },
      response: { status: 200, isStreaming: false, chunks: [], body: {}, headers: {} },
      fingerprint: 'mock1', recordedAt: ''
    };
    const c2 = { ...c1, fingerprint: 'mock2' };
    const c3 = {
      ...c1, provider: 'anthropic', fingerprint: 'mock3',
      response: { ...c1.response, isStreaming: true }
    };

    fs.writeFileSync(path.join(TEST_DIR, 'mock1.json'), JSON.stringify(c1));
    fs.writeFileSync(path.join(TEST_DIR, 'mock2.json'), JSON.stringify(c2));
    fs.writeFileSync(path.join(TEST_DIR, 'mock3.json'), JSON.stringify(c3));

    const logs: string[] = [];
    const code = doctor(TEST_DIR, (msg) => logs.push(msg));
    
    expect(code).toBe(0);
    const output = logs.join('\n');
    
    expect(output).toContain('Total cassettes: 3');
    expect(output).toContain('openai       2 cassettes');
    expect(output).toContain('anthropic    1 cassettes');
    expect(output).toContain('Streaming cassettes: 1 (33%)');
    expect(output).toContain('JSON cassettes:      2 (67%)');
    expect(output).toContain('Estimated API calls avoided: 3');
  });

  it('handles empty directory gracefully', () => {
    fs.mkdirSync(TEST_DIR, { recursive: true });
    
    const logs: string[] = [];
    const code = doctor(TEST_DIR, (msg) => logs.push(msg));
    
    expect(code).toBe(0);
    const output = logs.join('\n');
    expect(output).toContain('Directory is empty');
  });
});
