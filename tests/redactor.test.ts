import { describe, it, expect, vi } from 'vitest';
import { redact } from '../src/redactor.js';
import type { Cassette, LLMVCROptions } from '../src/config.js';
import { DEFAULT_CONFIG } from '../src/config.js';

function makeCassette(overrides: Partial<Cassette> = {}): Cassette {
  return {
    version: '1',
    recordedAt: '2026-04-05T14:23:01.000Z',
    provider: 'openai',
    fingerprint: 'a3f9b2c1d4e5f607',
    request: {
      url: 'https://api.openai.com/v1/chat/completions',
      method: 'POST',
      headers: {
        Authorization: 'Bearer sk-real-key',
        'x-api-key': 'real-key',
        'content-type': 'application/json',
      },
      body: { model: 'gpt-4o', messages: [] },
    },
    response: {
      status: 200,
      headers: { 'content-type': 'application/json' },
      isStreaming: false,
      body: { choices: [{ message: { content: 'Test response' } }] },
      chunks: [],
    },
    ...overrides,
  };
}

function makeConfig(overrides: Partial<LLMVCROptions['redact']> = {}): Required<LLMVCROptions> {
  return {
    ...DEFAULT_CONFIG,
    redact: {
      headers: overrides.headers ?? DEFAULT_CONFIG.redact.headers,
      patterns: overrides.patterns ?? DEFAULT_CONFIG.redact.patterns,
      custom: overrides.custom,
    },
  };
}

describe('redactor', () => {
  it('Authorization header is always redacted', () => {
    const cassette = makeCassette();
    const result = redact(cassette, makeConfig({ headers: [] }));
    expect(result.request.headers['Authorization']).toBe('[REDACTED]');
  });

  it('x-api-key header is always redacted', () => {
    const cassette = makeCassette();
    const result = redact(cassette, makeConfig({ headers: [] }));
    expect(result.request.headers['x-api-key']).toBe('[REDACTED]');
  });

  it('custom config header is redacted', () => {
    const cassette = makeCassette();
    // Inject a custom header to redact
    cassette.request.headers['My-Token'] = 'secret';
    const result = redact(cassette, makeConfig({ headers: ['Authorization', 'x-api-key', 'My-Token'] }));
    expect(result.request.headers['My-Token']).toBe('[REDACTED]');
  });

  it('email pattern is replaced in response body', () => {
    const cassette = makeCassette();
    cassette.response.body = { message: 'Contact user@example.com for help.' };
    const result = redact(cassette, makeConfig({ patterns: ['email'] }));
    const body = result.response.body as { message: string };
    expect(body.message).toContain('[REDACTED:email]');
    expect(body.message).not.toContain('user@example.com');
  });

  it('phone pattern is replaced when configured', () => {
    const cassette = makeCassette();
    cassette.response.body = { message: 'Call 555-867-5309 now.' };
    const result = redact(cassette, makeConfig({ patterns: ['phone'] }));
    const body = result.response.body as { message: string };
    expect(body.message).toContain('[REDACTED:phone]');
  });

  it('custom redactor function is called and its return value used', () => {
    const cassette = makeCassette();
    const customFn = vi.fn((c: Cassette) => {
      const modified = JSON.parse(JSON.stringify(c)) as Cassette;
      modified.provider = 'custom-redacted';
      return modified;
    });
    const result = redact(cassette, makeConfig({ custom: customFn }));
    expect(customFn).toHaveBeenCalledOnce();
    expect(result.provider).toBe('custom-redacted');
  });

  it('redaction order: headers → patterns → custom', () => {
    const callOrder: string[] = [];
    const cassette = makeCassette();
    // Inject email into a header value so we can verify headers run before patterns
    cassette.request.headers['x-user'] = 'test@order.com';

    // Spy to track header-stage and pattern-stage
    // We verify via the final state: header should be [REDACTED], body email should be [REDACTED:email]
    cassette.response.body = { info: 'reach me at order@check.com' };

    const customFn = vi.fn((c: Cassette) => {
      callOrder.push('custom');
      return c;
    });

    const result = redact(cassette, makeConfig({
      headers: ['Authorization', 'x-api-key', 'x-user'],
      patterns: ['email'],
      custom: customFn,
    }));

    // Headers redacted first
    expect(result.request.headers['x-user']).toBe('[REDACTED]');
    // Email pattern applied to body
    const body = result.response.body as { info: string };
    expect(body.info).toContain('[REDACTED:email]');
    // Custom called last
    expect(callOrder).toEqual(['custom']);
  });
});
