import fs from 'node:fs';
import type { Cassette, SSEChunk } from '../config.js';
import { loadCassette } from '../cassette-manager.js';
import path from 'node:path';

export function runDiff(fileA: string, fileB: string, log: typeof console.log = console.log): number {
  if (!fs.existsSync(fileA)) {
    log(`[llm-vcr] Error: File not found: ${fileA}`);
    return 1;
  }
  if (!fs.existsSync(fileB)) {
    log(`[llm-vcr] Error: File not found: ${fileB}`);
    return 1;
  }

  let cA: Cassette, cB: Cassette;
  try {
    // using raw read first to handle absolute paths, loadCassette expects fingerprints,
    // but diff is run against direct file paths.
    cA = JSON.parse(fs.readFileSync(fileA, 'utf-8'));
    cB = JSON.parse(fs.readFileSync(fileB, 'utf-8'));
  } catch (err) {
    log(`[llm-vcr] Error parsing cassettes: ${(err as Error).message}`);
    return 1;
  }

  log('llm-vcr diff — Cassette Comparison');
  log('────────────────────────────────────────');
  log(`Cassette A: ${fileA}`);
  log(`Cassette B: ${fileB}`);
  log('');

  let differencesFound = false;

  // Request comparison
  log('Request:');
  const reqUrlA = new URL(cA.request.url).pathname;
  const reqUrlB = new URL(cB.request.url).pathname;

  const modelA = (cA.request.body as any)?.model || 'unknown';
  const modelB = (cB.request.body as any)?.model || 'unknown';

  if (modelA === modelB) log(`  ✓ Same model: ${modelA}`);
  else { log(`  ~ Model changed: [A] ${modelA} -> [B] ${modelB}`); differencesFound = true; }

  if (reqUrlA === reqUrlB) log(`  ✓ Same endpoint: ${reqUrlA}`);
  else { log(`  ~ Endpoint changed: [A] ${reqUrlA} -> [B] ${reqUrlB}`); differencesFound = true; }

  // Simple string comparison for messages
  const bodyAStr = JSON.stringify(cA.request.body);
  const bodyBStr = JSON.stringify(cB.request.body);
  if (bodyAStr !== bodyBStr) {
    log(`  ~ Request bodies differ`);
    differencesFound = true;
  }
  log('');

  // Response comparison
  log('Response:');
  if (cA.response.status === cB.response.status) {
    log(`  ✓ Same status: ${cA.response.status}`);
  } else {
    log(`  ~ Status changed: [A] ${cA.response.status} -> [B] ${cB.response.status}`);
    differencesFound = true;
  }

  const textA = extractText(cA);
  const textB = extractText(cB);

  if (textA === textB) {
    log(`  ✓ Content is identical`);
  } else {
    log(`  ~ Content changed:\n`);
    log(`  [A] ${textA}`);
    log(`  [B] ${textB}\n`);

    const wordsA = new Set(textA.split(/\s+/).filter(Boolean));
    const wordsB = new Set(textB.split(/\s+/).filter(Boolean));

    const added = [...wordsB].filter(w => !wordsA.has(w));
    const removed = [...wordsA].filter(w => !wordsB.has(w));

    if (added.length) log(`  Words added:   ${added.join(', ')}`);
    if (removed.length) log(`  Words removed: ${removed.join(', ')}`);
    differencesFound = true;
  }
  log('');

  if (cA.response.isStreaming || cB.response.isStreaming) {
    log('Streaming:');
    printStreamingStats(cA, 'A', log);
    printStreamingStats(cB, 'B', log);
  }

  return differencesFound ? 1 : 0;
}

function extractText(c: Cassette): string {
  if (c.response.isStreaming && c.response.chunks) {
    return c.response.chunks.map(ch => ch.data).join('');
  }
  if (!c.response.body) return '';
  // Fallback for simple message formats
  const b = c.response.body as any;
  if (b?.choices?.[0]?.message?.content) return b.choices[0].message.content;
  if (b?.content?.[0]?.text) return b.content[0].text;
  return JSON.stringify(c.response.body);
}

function printStreamingStats(c: Cassette, label: string, log: typeof console.log) {
  if (!c.response.isStreaming) {
    log(`  ${label}: not streaming`);
    return;
  }
  const chunks = c.response.chunks || [];
  const total = chunks.length > 0 ? chunks[chunks.length - 1].delayMs : 0;
  log(`  ${label}: ${chunks.length} chunks, ~${total}ms total`);
}
