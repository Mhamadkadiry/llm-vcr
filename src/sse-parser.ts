export interface SSEChunk {
  /** Raw content of the SSE data field (not parsed). */
  data: string;
  /** Milliseconds after stream start when this chunk arrived. */
  delayMs: number;
}

/**
 * Consume an SSE ReadableStream and return all chunks with timing.
 * Resolves when the stream closes or a 'data: [DONE]' sentinel is received.
 */
export async function captureStream(
  stream: ReadableStream<Uint8Array>,
): Promise<SSEChunk[]> {
  const decoder = new TextDecoder();
  const reader = stream.getReader();
  const chunks: SSEChunk[] = [];
  const startTime = Date.now();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? ''; // Keep incomplete line in buffer

      for (const line of lines) {
        const parsed = parseSSELine(line);
        if (parsed === null) continue;
        if (parsed === '[DONE]') return chunks;
        chunks.push({ data: parsed, delayMs: Date.now() - startTime });
      }
    }
  } finally {
    reader.releaseLock();
  }

  return chunks;
}

/**
 * Parse a single SSE line and return the data field value, or null if not a data line.
 */
export function parseSSELine(line: string): string | null {
  const trimmed = line.trim();
  if (trimmed.startsWith('data: ')) {
    return trimmed.slice(6);
  }
  return null;
}
