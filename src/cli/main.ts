#!/usr/bin/env node
import fs from 'node:fs';
import { listCassettes } from '../cassette-manager.js';
import { runDiff } from './diff.js';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function doctor(targetDir: string, log: typeof console.log = console.log): number {
  if (!fs.existsSync(targetDir)) {
    log(`[llm-vcr] Error: Directory not found: ${targetDir}`);
    return 1;
  }

  const cassettes = listCassettes(targetDir);
  let totalBytes = 0;
  let streamingCount = 0;

  type ProviderStats = { count: number; bytes: number };
  const providerStats: Record<string, ProviderStats> = {};

  for (const c of cassettes) {
    const stat = fs.statSync(c.filePath);
    totalBytes += stat.size;

    if (c.cassette.response.isStreaming) {
      streamingCount++;
    }

    const provider = c.cassette.provider || 'unknown';
    if (!providerStats[provider]) {
      providerStats[provider] = { count: 0, bytes: 0 };
    }
    providerStats[provider].count++;
    providerStats[provider].bytes += stat.size;
  }

  const jsonCount = cassettes.length - streamingCount;
  const streamingPct = cassettes.length > 0 ? Math.round((streamingCount / cassettes.length) * 100) : 0;
  const jsonPct = cassettes.length > 0 ? Math.round((jsonCount / cassettes.length) * 100) : 0;

  log('llm-vcr doctor — Cassette Analysis');
  log('────────────────────────────────────────');
  log(`Directory:     ${targetDir}`);
  log(`Total cassettes: ${cassettes.length}`);
  log(`Total size:    ${formatSize(totalBytes)}`);
  log('');

  if (cassettes.length > 0) {
    log('By provider:');
    for (const [provider, stats] of Object.entries(providerStats)) {
      const pName = provider.padEnd(12, ' ');
      const pCount = `${stats.count} cassettes`.padEnd(14, ' ');
      log(`  ${pName} ${pCount} ${formatSize(stats.bytes)}`);
    }
    log('');

    log(`Streaming cassettes: ${streamingCount} (${streamingPct}%)`);
    log(`JSON cassettes:      ${jsonCount} (${jsonPct}%)`);
    log('');
    log(`Estimated API calls avoided: ${cassettes.length}`);
    log(`Note: Use your provider's pricing page to estimate cost savings.`);
    log('');
    log('Run `llm-vcr diff <cassette.json>` to inspect a specific cassette.');
  } else {
    log('Directory is empty. No cassettes found.');
  }

  return 0;
}

// Simple CLI router
function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'doctor';

  if (command === 'diff') {
    const cA = args[1];
    const cB = args[2];
    if (!cA || !cB) {
      console.log('Usage: llm-vcr diff <cassette-a.json> <cassette-b.json>');
      process.exit(1);
    }
    process.exit(runDiff(cA, cB));
  } else if (command === 'doctor') {
    let dir = './__llm_cassettes__';
    const dirIndex = args.indexOf('--dir');
    if (dirIndex !== -1 && args[dirIndex + 1]) {
      dir = args[dirIndex + 1];
    }
    process.exit(doctor(dir));
  } else {
    console.log(`Unknown command: ${command}`);
    console.log('Usage: llm-vcr [doctor | diff]');
    process.exit(1);
  }
}

const isCLI = process.argv[1] && (
  process.argv[1].endsWith('main.js') ||
  process.argv[1].endsWith('main.ts') ||
  process.argv[1].endsWith('llm-vcr') ||
  process.argv[1].includes('.bin/llm-vcr')
);

if (isCLI) {
  main();
}
