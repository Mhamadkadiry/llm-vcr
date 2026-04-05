// ── Provider Interface ────────────────────────────────────────────────────────

export interface Provider {
  /** Display name, e.g. 'openai' */
  name: string;

  /**
   * Base URLs this provider handles.
   * A request URL is matched if it starts with any of these.
   */
  baseUrls: string[];

  /**
   * Top-level body fields to include in the hash.
   * Fields not listed here are excluded from fingerprinting.
   * This prevents unrelated fields from causing cache misses.
   */
  hashFields: string[];
}

/**
 * Create a provider definition. For use by community plugin authors.
 */
export function defineProvider(config: Provider): Provider {
  return config;
}
