import type { Cassette, LLMVCROptions } from './config.js';
import { captureStream } from './sse-parser.js';
import { redact } from './redactor.js';
import { saveCassette } from './cassette-manager.js';

/**
 * Record a completed API interaction to a cassette file.
 * Handles both JSON and SSE responses.
 *
 * @param request Original Request object (from fetch)
 * @param response Real API Response from network
 * @param fingerprint Computed hash of the request
 * @param config Active configuration
 */
export async function record(
  request: Request,
  response: Response,
  fingerprint: string,
  config: Required<LLMVCROptions>,
): Promise<void> {
  const reqBodyText = await request.text();
  const reqBody = reqBodyText ? JSON.parse(reqBodyText) : null;
  
  // Clone the request headers into a plain object
  const reqHeaders: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    reqHeaders[key] = value;
  });

  const resHeaders: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    resHeaders[key] = value;
  });

  const contentType = response.headers.get('content-type') || '';
  const isStreaming = contentType.includes('text/event-stream');

  let resBody: unknown | null = null;
  let chunks: { data: string; delayMs: number }[] = [];

  if (isStreaming && response.body) {
    chunks = await captureStream(response.body);
  } else {
    const resBodyText = await response.text();
    resBody = resBodyText ? JSON.parse(resBodyText) : null;
  }

  // Find provider name based on URL, defaulting to 'unknown'
  const matchedProvider = config.providers.find(p =>
    p.baseUrls.some(url => request.url.startsWith(url))
  );

  const cassette: Cassette = {
    version: '1',
    recordedAt: new Date().toISOString(),
    provider: matchedProvider ? matchedProvider.name : 'unknown',
    fingerprint,
    request: {
      url: request.url,
      method: request.method,
      headers: reqHeaders,
      body: reqBody,
    },
    response: {
      status: response.status,
      headers: resHeaders,
      body: resBody,
      isStreaming,
      chunks,
    },
  };

  const redactedCassette = redact(cassette, config);
  saveCassette(redactedCassette, config.cassetteDir);
}
