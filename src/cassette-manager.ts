import fs from 'node:fs';
import path from 'node:path';
import type { Cassette } from './config.js';
import { LLMVCRCassetteError } from './errors.js';

export interface CassetteEntry {
  fingerprint: string;
  filePath: string;
  cassette: Cassette;
}

function getCassettePath(fingerprint: string, cassetteDir: string): string {
  return path.join(cassetteDir, `${fingerprint}.json`);
}

/**
 * Check if a cassette exists for the given fingerprint.
 */
export function cassetteExists(fingerprint: string, cassetteDir: string): boolean {
  return fs.existsSync(getCassettePath(fingerprint, cassetteDir));
}

/**
 * Load and parse a cassette from disk.
 * Throws if the file does not exist or is invalid JSON.
 */
export function loadCassette(fingerprint: string, cassetteDir: string): Cassette {
  const filePath = getCassettePath(fingerprint, cassetteDir);
  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch (error) {
    throw new LLMVCRCassetteError(filePath, `Failed to read file: ${(error as Error).message}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    throw new LLMVCRCassetteError(filePath, `Invalid JSON: ${(error as Error).message}`);
  }

  validateCassetteSchema(parsed, filePath);
  return parsed as Cassette;
}

/**
 * Save a cassette to disk, creating the cassette directory if needed.
 * Overwrites any existing cassette with the same fingerprint.
 */
export function saveCassette(cassette: Cassette, cassetteDir: string): void {
  fs.mkdirSync(cassetteDir, { recursive: true });
  const filePath = getCassettePath(cassette.fingerprint, cassetteDir);
  fs.writeFileSync(filePath, JSON.stringify(cassette, null, 2), 'utf-8');
}

/**
 * List all cassette files in a directory.
 * Returns array of { fingerprint, filePath, cassette } objects.
 */
export function listCassettes(cassetteDir: string): CassetteEntry[] {
  if (!fs.existsSync(cassetteDir)) {
    return [];
  }

  const entries: CassetteEntry[] = [];
  const files = fs.readdirSync(cassetteDir);

  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    const filePath = path.join(cassetteDir, file);
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(content);
      // We don't throw on invalid schema here, just skip malformed files in list
      if (parsed && typeof parsed === 'object' && parsed.version) {
        entries.push({
          fingerprint: path.basename(file, '.json'),
          filePath,
          cassette: parsed as Cassette,
        });
      }
    } catch {
      // Skip unreadable or non-JSON files
    }
  }

  return entries;
}

/**
 * Basic schema validation to ensure the cassette has the minimum required fields.
 */
function validateCassetteSchema(parsed: unknown, filePath: string): void {
  if (!parsed || typeof parsed !== 'object') {
    throw new LLMVCRCassetteError(filePath, 'Root JSON must be an object');
  }
  const obj = parsed as Record<string, unknown>;
  if (obj.version !== '1') {
    throw new LLMVCRCassetteError(filePath, 'Missing or unsupported version');
  }
  if (!obj.request || typeof obj.request !== 'object') {
    throw new LLMVCRCassetteError(filePath, 'Missing request object');
  }
  if (!obj.response || typeof obj.response !== 'object') {
    throw new LLMVCRCassetteError(filePath, 'Missing response object');
  }
}
