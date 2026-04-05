import { createHash } from 'node:crypto';

export interface NormalizedRequest {
  url: string;   // Full URL, no query string
  method: string;
  body: unknown;  // Parsed JSON body, with fuzzy-ignored fields removed
}

/**
 * Compute a 16-character hex fingerprint for a request.
 * Input is the normalized request object (after fuzzy field removal).
 *
 * Keys are sorted for stability — JSON.stringify is not key-order-stable,
 * so we sort recursively to guarantee the same hash for equivalent bodies.
 */
export function fingerprint(request: NormalizedRequest): string {
  const canonical = JSON.stringify({
    url: request.url,
    method: request.method.toUpperCase(),
    body: sortedKeys(request.body),
  });
  return createHash('sha256').update(canonical).digest('hex').slice(0, 16);
}

/**
 * Recursively sort object keys so that JSON.stringify produces a stable string
 * regardless of the insertion order of properties.
 */
function sortedKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortedKeys);
  }
  if (value !== null && typeof value === 'object') {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = sortedKeys((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}
