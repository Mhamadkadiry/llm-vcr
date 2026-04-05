import { http, passthrough, bypass } from 'msw';
import type { LLMVCROptions } from './config.js';
import { mergeConfig, validateConfig } from './config.js';
import { openaiProvider } from './providers/openai-provider.js';
import { anthropicProvider } from './providers/anthropic-provider.js';
import { createInterceptor } from './interceptor.js';
import { removeFuzzyFields } from './fuzzy-matcher.js';
import { fingerprint } from './hasher.js';
import { record } from './recorder.js';
import { replay, SENTINEL_RECORD_MISS } from './replayer.js';

function registerCleanup(fn: () => void): void {
  if (typeof (globalThis as any).afterAll === 'function') {
    (globalThis as any).afterAll(fn);
  } else {
    process.on('exit', fn);
  }
}

export function setupLLMVCR(options?: LLMVCROptions): void {
  const mergedOptions = mergeConfig(options);

  if (mergedOptions.providers.length === 0) {
    mergedOptions.providers = [openaiProvider, anthropicProvider];
  }

  validateConfig(mergedOptions);

  const handlers = mergedOptions.providers.flatMap(provider => {
    return provider.baseUrls.map(baseUrl => {
      // Intercept all requests starting with baseUrl (e.g. POST https://api.openai.com/*)
      const urlPattern = baseUrl.endsWith('/') ? `${baseUrl}*` : `${baseUrl}/*`;

      return http.all(urlPattern, async ({ request }) => {
        if (mergedOptions.mode === 'passthrough') {
          return passthrough();
        }

        // Clone request body to examine it without consuming the stream MSW needs it
        const clonedBodyReq = request.clone();
        let body: unknown = {};
        const text = await clonedBodyReq.text();
        if (text) {
          try {
            body = JSON.parse(text);
          } catch {
            // body is not JSON, leave as text
            body = text;
          }
        }

        const normalizedBody = removeFuzzyFields(
          body,
          mergedOptions.fuzzyMatch.ignore ?? [],
        );

        // Calculate fingerprint filtering keys using provider settings if needed?
        // Note: Spec says we strip based on provider.hashFields. Let's do that!
        const filteredBody: Record<string, unknown> = {};
        if (typeof normalizedBody === 'object' && normalizedBody !== null) {
          for (const key of provider.hashFields) {
            if (key in (normalizedBody as Record<string, unknown>)) {
              filteredBody[key] = (normalizedBody as Record<string, unknown>)[key];
            }
          }
        }

        const hashConfig = {
          url: new URL(request.url).origin + new URL(request.url).pathname, // URL no query string
          method: request.method,
          body: Object.keys(filteredBody).length > 0 ? filteredBody : normalizedBody,
        };

        const currentFingerprint = fingerprint(hashConfig);

        if (mergedOptions.mode === 'replay') {
          const replayResult = await replay(
            currentFingerprint,
            request.url,
            mergedOptions,
          );

          if (replayResult !== SENTINEL_RECORD_MISS) {
            return replayResult;
          }
          // If SENTINEL_RECORD_MISS, fall through to record below!
        }

        // Mode is 'record' (or fallback 'record' from missing replay)
        const fetchRequest = request.clone();
        const response = await fetch(bypass(fetchRequest));

        // Strip content-encoding because node:fetch auto-decompresses the body stream,
        // but preserves the header, causing downstream clients like OpenAI SDK to double-decompress and crash!
        const cleanedHeaders = new Headers(response.headers);
        cleanedHeaders.delete('content-encoding');
        cleanedHeaders.delete('content-length');
        
        const cleanResponse = new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: cleanedHeaders
        });

        await record(request, cleanResponse.clone(), currentFingerprint, mergedOptions);
        return cleanResponse;
      });
    });
  });

  const interceptor = createInterceptor(handlers);
  interceptor.start();

  registerCleanup(() => {
    interceptor.stop();
  });
}
