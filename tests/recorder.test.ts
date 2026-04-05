import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { record } from '../src/recorder.js';
import { DEFAULT_CONFIG } from '../src/config.js';
import { loadCassette } from '../src/cassette-manager.js';
import { openaiProvider } from '../src/providers/openai-provider.js';
import fs from 'node:fs';
import path from 'node:path';

const config = {
  ...DEFAULT_CONFIG,
  cassetteDir: './tests/__tmp_cassettes__',
  providers: [openaiProvider],
};

function cleanup() {
  if (fs.existsSync(config.cassetteDir)) {
    fs.rmSync(config.cassetteDir, { recursive: true, force: true });
  }
}

describe('recorder', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it('records JSON response to cassette file', async () => {
    const req = new Request('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer 123' },
      body: JSON.stringify({ model: 'gpt-4' }),
    });

    const res = new Response(JSON.stringify({ good: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'x-custom': 'val' },
    });

    await record(req, res, 'fingerprint1', config);

    expect(fs.existsSync(path.join(config.cassetteDir, 'fingerprint1.json'))).toBe(true);
    const cassette = loadCassette('fingerprint1', config.cassetteDir);
    expect(cassette.response.body).toEqual({ good: true });
    expect(cassette.response.isStreaming).toBe(false);
    expect(cassette.request.headers['authorization']).toBe('[REDACTED]');
  });

  it('records SSE stream to cassette file with chunks', async () => {
    const req = new Request('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: hello\n\n'));
        controller.enqueue(encoder.encode('data: world\n\ndata: [DONE]\n\n'));
        controller.close();
      }
    });

    const res = new Response(stream, {
      headers: { 'Content-Type': 'text/event-stream' }
    });

    await record(req, res, 'fingerprint2', config);

    const cassette = loadCassette('fingerprint2', config.cassetteDir);
    expect(cassette.response.isStreaming).toBe(true);
    expect(cassette.response.chunks).toHaveLength(2);
    expect(cassette.response.chunks[0].data).toBe('hello');
    expect(cassette.response.chunks[1].data).toBe('world');
  });
});
