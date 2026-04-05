import { describe, it, expect } from 'vitest';
import { removeFuzzyFields } from '../src/fuzzy-matcher.js';

describe('fuzzy-matcher', () => {
  it('removes a top-level field', () => {
    const body = { model: 'gpt-4o', user_id: 'abc123', messages: [] };
    const result = removeFuzzyFields(body, ['user_id']) as typeof body;
    expect(result).not.toHaveProperty('user_id');
    expect(result.model).toBe('gpt-4o');
  });

  it('removes a nested field via dot notation', () => {
    const body = { metadata: { timestamp: '2026-01-01', version: '1' } };
    const result = removeFuzzyFields(body, ['metadata.timestamp']) as typeof body;
    expect((result.metadata as Record<string, unknown>).timestamp).toBeUndefined();
    expect((result.metadata as Record<string, unknown>).version).toBe('1');
  });

  it('removes an array element field via bracket notation', () => {
    const body = { messages: [{ role: 'user', content: 'dynamic content', ts: 123 }] };
    const result = removeFuzzyFields(body, ['messages[0].ts']) as typeof body;
    expect((result.messages[0] as Record<string, unknown>).ts).toBeUndefined();
    expect((result.messages[0] as Record<string, unknown>).role).toBe('user');
  });

  it('silently ignores non-existent paths', () => {
    const body = { model: 'gpt-4o' };
    expect(() => removeFuzzyFields(body, ['non_existent.path'])).not.toThrow();
    const result = removeFuzzyFields(body, ['non_existent.path']) as typeof body;
    expect(result.model).toBe('gpt-4o');
  });

  it('returns a deep clone — original object is NOT mutated', () => {
    const body = { model: 'gpt-4o', user_id: 'abc' };
    const original = JSON.stringify(body);
    removeFuzzyFields(body, ['user_id']);
    expect(JSON.stringify(body)).toBe(original);
  });

  it('empty ignore list returns an equivalent object', () => {
    const body = { model: 'gpt-4o', messages: [{ role: 'user' }] };
    const result = removeFuzzyFields(body, []);
    expect(result).toEqual(body);
  });
});
