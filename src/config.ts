import type { Provider } from './providers/index.js';

// ── Public Types ──────────────────────────────────────────────────────────────

export interface SSEChunk {
  /** Raw content of the SSE data field (not parsed). */
  data: string;
  /** Milliseconds after stream start when this chunk arrived. */
  delayMs: number;
}

export interface Cassette {
  /** Schema version. Always "1" in v1. */
  version: '1';
  /** ISO 8601 timestamp of when this cassette was recorded. */
  recordedAt: string;
  /** Which provider recorded this cassette. */
  provider: string;
  /** The outgoing request that was captured. */
  request: {
    url: string;
    method: string;
    /** Headers, with sensitive values already redacted. */
    headers: Record<string, string>;
    /** Parsed JSON body of the request. */
    body: unknown;
  };
  /** The response that was captured. */
  response: {
    status: number;
    /** Response headers. */
    headers: Record<string, string>;
    /**
     * For non-streaming responses: the parsed JSON response body.
     * For streaming responses: null (use `chunks` instead).
     */
    body: unknown | null;
    /** True if this was an SSE streaming response. */
    isStreaming: boolean;
    /**
     * For streaming responses: the captured SSE chunks.
     * Empty array for non-streaming responses.
     */
    chunks: SSEChunk[];
  };
  /** The fingerprint hash used to identify this cassette. */
  fingerprint: string;
}

export interface LLMVCROptions {
  /**
   * 'record'      — pass through to real API, save cassette
   * 'replay'      — intercept and return cassette, never hit real API
   * 'passthrough' — do nothing, let all requests through
   * Default: 'replay'
   */
  mode?: 'record' | 'replay' | 'passthrough';

  /**
   * Directory where cassette .json files are stored.
   * Default: './__llm_cassettes__'
   */
  cassetteDir?: string;

  /**
   * Streaming timing mode.
   * 'instant'  — replay SSE chunks with zero delay (CI-safe, default)
   * 'faithful' — replay SSE chunks with original recorded delays (for demos)
   */
  streaming?: {
    timing?: 'instant' | 'faithful';
  };

  /** Fuzzy matching rules for dynamic fields. */
  fuzzyMatch?: {
    /** Array of dot-notation field paths to ignore during hashing. */
    ignore?: string[];
    /**
     * What to do when no matching cassette is found in replay mode.
     * 'error'  — throw LLMVCRMissError immediately (default, CI-safe)
     * 'record' — fall through to real API and record a new cassette
     */
    onMiss?: 'error' | 'record';
  };

  /** Redaction configuration. */
  redact?: {
    /**
     * HTTP header names to redact (replaced with '[REDACTED]').
     * Authorization and x-api-key are always redacted.
     */
    headers?: string[];
    /**
     * Built-in body pattern redactors to enable.
     * Default: ['email']
     */
    patterns?: Array<'email' | 'phone' | 'ssn'>;
    /**
     * Custom redactor function. Receives the full cassette object before saving.
     */
    custom?: (cassette: Cassette) => Cassette;
  };

  /**
   * Provider plugins. Add custom providers here.
   * Default: [openaiProvider, anthropicProvider]
   */
  providers?: Provider[];
}

// ── Defaults ──────────────────────────────────────────────────────────────────

export const DEFAULT_CONFIG: Required<LLMVCROptions> = {
  mode: 'replay',
  cassetteDir: './__llm_cassettes__',
  streaming: {
    timing: 'instant',
  },
  fuzzyMatch: {
    ignore: [],
    onMiss: 'error',
  },
  redact: {
    headers: ['Authorization', 'x-api-key'],
    patterns: ['email'],
    custom: undefined,
  },
  providers: [], // populated at runtime with built-in providers
};

// ── Validation ────────────────────────────────────────────────────────────────

import { LLMVCRConfigError } from './errors.js';

export function validateConfig(config: LLMVCROptions): void {
  if (
    config.mode !== undefined &&
    !['record', 'replay', 'passthrough'].includes(config.mode)
  ) {
    throw new LLMVCRConfigError(
      'mode',
      String(config.mode),
      `'record', 'replay', or 'passthrough'`,
    );
  }

  if (config.cassetteDir !== undefined && config.cassetteDir.trim() === '') {
    throw new LLMVCRConfigError('cassetteDir', config.cassetteDir, 'a non-empty string');
  }

  if (
    config.streaming?.timing !== undefined &&
    !['instant', 'faithful'].includes(config.streaming.timing)
  ) {
    throw new LLMVCRConfigError(
      'streaming.timing',
      String(config.streaming.timing),
      `'instant' or 'faithful'`,
    );
  }

  if (
    config.fuzzyMatch?.onMiss !== undefined &&
    !['error', 'record'].includes(config.fuzzyMatch.onMiss)
  ) {
    throw new LLMVCRConfigError(
      'fuzzyMatch.onMiss',
      String(config.fuzzyMatch.onMiss),
      `'error' or 'record'`,
    );
  }
}

// ── Merge ─────────────────────────────────────────────────────────────────────

export function mergeConfig(user?: LLMVCROptions): Required<LLMVCROptions> {
  if (!user) return { ...DEFAULT_CONFIG };

  return {
    mode: user.mode ?? DEFAULT_CONFIG.mode,
    cassetteDir: user.cassetteDir ?? DEFAULT_CONFIG.cassetteDir,
    streaming: {
      timing: user.streaming?.timing ?? DEFAULT_CONFIG.streaming.timing,
    },
    fuzzyMatch: {
      ignore: user.fuzzyMatch?.ignore ?? DEFAULT_CONFIG.fuzzyMatch.ignore,
      onMiss: user.fuzzyMatch?.onMiss ?? DEFAULT_CONFIG.fuzzyMatch.onMiss,
    },
    redact: {
      // Arrays are replaced entirely when user specifies them
      headers: user.redact?.headers ?? DEFAULT_CONFIG.redact.headers,
      patterns: user.redact?.patterns ?? DEFAULT_CONFIG.redact.patterns,
      custom: user.redact?.custom ?? DEFAULT_CONFIG.redact.custom,
    },
    providers: user.providers ?? DEFAULT_CONFIG.providers,
  };
}
