import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { replay, SENTINEL_RECORD_MISS } from '../src/replayer.js';
import { DEFAULT_CONFIG } from '../src/config.js';
import { saveCassette } from '../src/cassette-manager.js';
import { LLMVCRMissError } from '../src/errors.js';
import fs from 'node:fs';

const config = {
  ...DEFAULT_CONFIG,
  cassetteDir: './tests/__tmp_replay_cassettes__',
};

function cleanup() {
  if (fs.existsSync(config.cassetteDir)) {
    fs.rmSync(config.cassetteDir, { recursive: true, force: true });
  }
}

describe('replayer', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it('throws LLMVCRMissError when cassette missing and onMiss is error', async () => {
    await expect(() => replay('missing', 'https://api.com', config)).rejects.toThrow(LLMVCRMissError);
  });

  it('returns sentinel when cassette missing and onMiss is record', async () => {
    const result = await replay('missing', 'https://api.com', {
      ...config,
      fuzzyMatch: { ...config.fuzzyMatch, onMiss: 'record' }
    });
    expect(result).toBe(SENTINEL_RECORD_MISS);
  });

  it('returns correct response for existing JSON cassette', async () => {
    saveCassette({
      version: '1', fingerprint: 'json1', provider: 'test',
      request: { url: 'u', method: 'POST', body: {}, headers: {} },
      response: { status: 201, headers: { 'x-hi': 'hello' }, body: { success: true }, chunks: [], isStreaming: false },
      recordedAt: new Date().toISOString()
    }, config.cassetteDir);

    const res = await replay('json1', 'u', config) as Response;
    expect(res.status).toBe(201);
    expect(res.headers.get('x-hi')).toBe('hello');
    const body = await res.json();
    expect(body).toEqual({ success: true });
  });

  it('returns correctly handled streaming response', async () => {
    saveCassette({
      version: '1', fingerprint: 'stream1', provider: 'test',
      request: { url: 'u', method: 'POST', body: {}, headers: {} },
      response: { status: 200, headers: {}, body: null, chunks: [
        { data: 'a', delayMs: 0 }, { data: 'b', delayMs: 10 }
      ], isStreaming: true },
      recordedAt: new Date().toISOString()
    }, config.cassetteDir);

    const res = await replay('stream1', 'u', config) as Response;
    const reader = res.body?.getReader();
    expect(reader).toBeDefined();

    const decoder = new TextDecoder();
    let text = '';
    while (true) {
      const { done, value } = await reader!.read();
      if (done) break;
      text += decoder.decode(value);
    }
    expect(text).toContain('data: a\n\n');
    expect(text).toContain('data: b\n\n');
    expect(text).toContain('data: [DONE]\n\n');
  });
});
