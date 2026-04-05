import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { captureStream, parseSSELine } from '../src/sse-parser.js';

// Helper: build a ReadableStream<Uint8Array> from an array of string chunks
function makeStream(parts: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let i = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i < parts.length) {
        controller.enqueue(encoder.encode(parts[i++]));
      } else {
        controller.close();
      }
    },
  });
}

describe('sse-parser', () => {
  describe('parseSSELine', () => {
    it('returns data content for a data line', () => {
      expect(parseSSELine('data: hello world')).toBe('hello world');
    });

    it('returns null for non-data lines', () => {
      expect(parseSSELine('event: content_block')).toBeNull();
      expect(parseSSELine('id: 42')).toBeNull();
      expect(parseSSELine(': comment')).toBeNull();
      expect(parseSSELine('')).toBeNull();
    });
  });

  describe('captureStream', () => {
    it('parses a simple two-chunk SSE stream', async () => {
      const stream = makeStream([
        'data: {"text":"Hello"}\n\ndata: {"text":" World"}\n\ndata: [DONE]\n\n',
      ]);
      const chunks = await captureStream(stream);
      expect(chunks).toHaveLength(2);
      expect(chunks[0].data).toBe('{"text":"Hello"}');
      expect(chunks[1].data).toBe('{"text":" World"}');
    });

    it('stops at data: [DONE]', async () => {
      const stream = makeStream([
        'data: chunk1\n\ndata: [DONE]\n\ndata: should-not-appear\n\n',
      ]);
      const chunks = await captureStream(stream);
      expect(chunks).toHaveLength(1);
      expect(chunks[0].data).toBe('chunk1');
    });

    it('handles multi-read buffering (chunk split across two reads)', async () => {
      // First read contains partial line, second read completes it
      const stream = makeStream([
        'data: hell',
        'o\n\ndata: world\n\ndata: [DONE]\n\n',
      ]);
      const chunks = await captureStream(stream);
      expect(chunks).toHaveLength(2);
      expect(chunks[0].data).toBe('hello');
      expect(chunks[1].data).toBe('world');
    });

    it('ignores non-data lines (event:, id:, comments)', async () => {
      const stream = makeStream([
        'event: content\nid: 1\n: comment\ndata: real\n\ndata: [DONE]\n\n',
      ]);
      const chunks = await captureStream(stream);
      expect(chunks).toHaveLength(1);
      expect(chunks[0].data).toBe('real');
    });

    it('records correct relative delayMs using fake timers', async () => {
      vi.useFakeTimers();
      const encoder = new TextEncoder();
      let resolveRead: ((val: ReadableStreamReadResult<Uint8Array>) => void) | null = null;

      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          // Push first chunk immediately
          controller.enqueue(encoder.encode('data: first\n\n'));
          // We'll push the rest after a timer tick
          setTimeout(() => {
            controller.enqueue(encoder.encode('data: second\n\ndata: [DONE]\n\n'));
            controller.close();
          }, 100);
        },
      });

      const capturePromise = captureStream(stream);
      // Advance fake timers by 100ms to trigger the second chunk
      await vi.advanceTimersByTimeAsync(100);
      const chunks = await capturePromise;

      expect(chunks).toHaveLength(2);
      expect(chunks[0].delayMs).toBe(0);
      // The second chunk arrives after ~100ms
      expect(chunks[1].delayMs).toBeGreaterThanOrEqual(100);

      vi.useRealTimers();
    });
  });
});
