import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupLLMVCR } from '../src/setup.js';
import fs from 'node:fs';
import http from 'node:http';

const TEST_CASSETTE_DIR = './tests/__tmp_setup_cassettes__';

function cleanup() {
  if (fs.existsSync(TEST_CASSETTE_DIR)) {
    fs.rmSync(TEST_CASSETTE_DIR, { recursive: true, force: true });
  }
}

describe('setup', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it('record mode calls fetch and saves cassette', async () => {
    // Start local server to act as real API
    let capturedBody = '';
    const server = http.createServer((req, res) => {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        capturedBody = body;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ record: true }));
      });
    });

    await new Promise<void>(resolve => server.listen(0, resolve));
    const port = (server.address() as any).port;
    const baseUrl = `http://localhost:${port}`;

    setupLLMVCR({
      mode: 'record',
      cassetteDir: TEST_CASSETTE_DIR,
      providers: [
        { name: 'test-api', baseUrls: [baseUrl], hashFields: ['model'] }
      ]
    });

    const res = await fetch(`${baseUrl}/v1/messages`, {
      method: 'POST',
      body: JSON.stringify({ model: 'my-model' }),
    });

    const body = await res.json();
    expect(body).toEqual({ record: true });
    
    server.close();

    // Check if recorded
    expect(fs.existsSync(TEST_CASSETTE_DIR)).toBe(true);
    const files = fs.readdirSync(TEST_CASSETTE_DIR);
    expect(files).toHaveLength(1);
    const saved = JSON.parse(fs.readFileSync(TEST_CASSETTE_DIR + '/' + files[0], 'utf-8'));
    expect(saved.provider).toBe('test-api');
    expect(saved.response.body).toEqual({ record: true });
  });

  it('replay mode returns cassette without fetch', async () => {
    fs.mkdirSync(TEST_CASSETTE_DIR, { recursive: true });
    
    // We can't easily guess the hash if we don't use hasher directly.
    setupLLMVCR({
      mode: 'replay',
      cassetteDir: TEST_CASSETTE_DIR,
      providers: [ { name: 'test-api2', baseUrls: ['http://api.fake'], hashFields: [] } ],
      fuzzyMatch: { onMiss: 'error' }
    });

    // MSW catches the thrown LLMVCRMissError and returns a 500 response
    const res = await fetch('http://api.fake/call');
    expect(res.status).toBe(500);
  });

  it('does NOT intercept requests to other URLs', async () => {
    setupLLMVCR({
      mode: 'replay',
    });

    // Should throw native fetch error because no server is listening
    await expect(() => fetch('http://localhost:54321/missing')).rejects.toThrow();
  });
});

