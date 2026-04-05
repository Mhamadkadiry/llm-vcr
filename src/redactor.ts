import type { Cassette, LLMVCROptions } from './config.js';

// Mandatory headers always redacted, regardless of user config
const MANDATORY_REDACT_HEADERS = ['authorization', 'x-api-key', 'api-key'];

const PATTERNS: Record<string, RegExp> = {
  email: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g,
  phone: /(\+?1[-.s]?)?\(?\d{3}\)?[-.s]\d{3}[-.s]\d{4}/g,
  ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
};

/**
 * Apply all configured redaction to a cassette before saving.
 * Order: (1) headers, (2) body patterns, (3) custom function.
 * Never mutates the original cassette — always works on a deep clone.
 */
export function redact(cassette: Cassette, config: Required<LLMVCROptions>): Cassette {
  // Deep clone to avoid mutation
  let result: Cassette = JSON.parse(JSON.stringify(cassette)) as Cassette;

  // Step 1: Headers
  result = redactHeaders(result, config.redact.headers ?? []);

  // Step 2: Body patterns
  if (config.redact.patterns && config.redact.patterns.length > 0) {
    result = redactPatterns(result, config.redact.patterns);
  }

  // Step 3: Custom function
  if (config.redact.custom) {
    result = config.redact.custom(result);
  }

  return result;
}

function redactHeaders(cassette: Cassette, configHeaders: string[]): Cassette {
  const headersToRedact = new Set([
    ...MANDATORY_REDACT_HEADERS,
    ...configHeaders.map((h) => h.toLowerCase()),
  ]);

  // Redact request headers
  for (const key of Object.keys(cassette.request.headers)) {
    if (headersToRedact.has(key.toLowerCase())) {
      cassette.request.headers[key] = '[REDACTED]';
    }
  }

  // Redact response headers (e.g. set-cookie with tokens)
  for (const key of Object.keys(cassette.response.headers)) {
    if (headersToRedact.has(key.toLowerCase())) {
      cassette.response.headers[key] = '[REDACTED]';
    }
  }

  return cassette;
}

function redactPatterns(
  cassette: Cassette,
  patterns: Array<'email' | 'phone' | 'ssn'>,
): Cassette {
  let serialized = JSON.stringify(cassette);

  for (const name of patterns) {
    const regex = PATTERNS[name];
    if (regex) {
      // Reset lastIndex for global regexes
      regex.lastIndex = 0;
      serialized = serialized.replace(regex, `[REDACTED:${name}]`);
    }
  }

  return JSON.parse(serialized) as Cassette;
}
