import type { LLMVCROptions } from './config.js';
import { cassetteExists, loadCassette } from './cassette-manager.js';
import { LLMVCRMissError } from './errors.js';
import type { SSEChunk } from './config.js';

export const SENTINEL_RECORD_MISS = Symbol('RECORD_MISS');

/**
 * Find and return the recorded response for a request.
 * Throws LLMVCRMissError if no cassette is found and onMiss === 'error'.
 * Returns SENTINEL_RECORD_MISS if onMiss === 'record' and no cassette is found.
 */
export async function replay(
  fingerprint: string,
  requestUrl: string,
  config: Required<LLMVCROptions>,
): Promise<Response | typeof SENTINEL_RECORD_MISS> {
  if (!cassetteExists(fingerprint, config.cassetteDir)) {
    if (config.fuzzyMatch.onMiss === 'record') {
      return SENTINEL_RECORD_MISS;
    }
    throw new LLMVCRMissError(fingerprint, requestUrl, config.cassetteDir);
  }

  const cassette = loadCassette(fingerprint, config.cassetteDir);

  // Strip content-encoding to prevent downstream SDKs from double-decompression errors
  const headers = new Headers(cassette.response.headers as Record<string, string>);
  headers.delete('content-encoding');
  headers.delete('content-length');

  if (cassette.response.isStreaming) {
    const stream = config.streaming.timing === 'faithful'
      ? buildSSEStreamFaithful(cassette.response.chunks)
      : buildSSEStream(cassette.response.chunks);
    return new Response(stream, {
      status: cassette.response.status,
      headers: headers,
    });
  } else {
    return new Response(JSON.stringify(cassette.response.body), {
      status: cassette.response.status,
      headers: headers,
    });
  }
}

function buildSSEStream(chunks: SSEChunk[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(`data: ${chunk.data}\n\n`));
      }
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });
}

function buildSSEStreamFaithful(chunks: SSEChunk[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      let elapsed = 0;
      for (const chunk of chunks) {
        const wait = chunk.delayMs - elapsed;
        if (wait > 0) {
          await sleep(wait);
        }
        elapsed = chunk.delayMs;
        controller.enqueue(encoder.encode(`data: ${chunk.data}\n\n`));
      }
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
