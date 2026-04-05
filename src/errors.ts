// ── Error Classes ─────────────────────────────────────────────────────────────

/**
 * Thrown in replay mode when no matching cassette is found and onMiss === 'error'.
 */
export class LLMVCRMissError extends Error {
  readonly fingerprint: string;
  readonly requestUrl: string;
  readonly cassetteDir: string;

  constructor(fingerprint: string, requestUrl: string, cassetteDir: string) {
    super(
      `[llm-vcr] No cassette found for request.\n` +
        `  URL:          ${requestUrl}\n` +
        `  Fingerprint:  ${fingerprint}\n` +
        `  Cassette dir: ${cassetteDir}\n\n` +
        `To record this cassette, run your tests once with mode: 'record' (or unset CI).`,
    );
    this.name = 'LLMVCRMissError';
    this.fingerprint = fingerprint;
    this.requestUrl = requestUrl;
    this.cassetteDir = cassetteDir;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when an invalid configuration option is provided.
 */
export class LLMVCRConfigError extends Error {
  constructor(field: string, value: string, validValues: string) {
    super(
      `[llm-vcr] Invalid configuration.\n` +
        `  Field: ${field}\n` +
        `  Value: ${JSON.stringify(value)}\n` +
        `  Expected: ${validValues}`,
    );
    this.name = 'LLMVCRConfigError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when a cassette file is malformed or missing required fields.
 */
export class LLMVCRCassetteError extends Error {
  constructor(filePath: string, detail: string) {
    super(
      `[llm-vcr] Invalid cassette file.\n` +
        `  File:   ${filePath}\n` +
        `  Detail: ${detail}`,
    );
    this.name = 'LLMVCRCassetteError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
