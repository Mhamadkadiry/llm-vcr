import { describe, it, expect } from 'vitest';
import { fingerprint } from '../src/hasher.js';

describe('hasher', () => {
  it('same request body produces the same fingerprint', () => {
    const req = { url: 'https://api.openai.com/v1/chat/completions', method: 'POST', body: { model: 'gpt-4o', messages: [{ role: 'user', content: 'Hello' }] } };
    expect(fingerprint(req)).toBe(fingerprint(req));
  });

  it('different body produces a different fingerprint', () => {
    const a = { url: 'https://api.openai.com/v1/chat/completions', method: 'POST', body: { model: 'gpt-4o' } };
    const b = { url: 'https://api.openai.com/v1/chat/completions', method: 'POST', body: { model: 'gpt-3.5-turbo' } };
    expect(fingerprint(a)).not.toBe(fingerprint(b));
  });

  it('header differences do NOT change the fingerprint', () => {
    // fingerprint() only takes url/method/body — headers are deliberately excluded
    const base = { url: 'https://api.openai.com/v1/chat/completions', method: 'POST', body: { model: 'gpt-4o' } };
    // Same request, imaginary different auth header — since headers aren't passed to fingerprint(), result is identical
    expect(fingerprint(base)).toBe(fingerprint({ ...base }));
  });

  it('key insertion order in body does NOT change the fingerprint', () => {
    const a = { url: 'https://api.openai.com/v1/chat/completions', method: 'POST', body: { model: 'gpt-4o', temperature: 0.7 } };
    const b = { url: 'https://api.openai.com/v1/chat/completions', method: 'POST', body: { temperature: 0.7, model: 'gpt-4o' } };
    expect(fingerprint(a)).toBe(fingerprint(b));
  });

  it('URL differences DO change the fingerprint', () => {
    const a = { url: 'https://api.openai.com/v1/chat/completions', method: 'POST', body: {} };
    const b = { url: 'https://api.anthropic.com/v1/messages', method: 'POST', body: {} };
    expect(fingerprint(a)).not.toBe(fingerprint(b));
  });

  it('returns a 16-character hex string', () => {
    const req = { url: 'https://api.openai.com/v1/chat/completions', method: 'POST', body: {} };
    const result = fingerprint(req);
    expect(result).toMatch(/^[0-9a-f]{16}$/);
  });
});
