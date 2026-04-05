/**
 * Return a copy of the request body with all fuzzy-ignored fields removed.
 * Uses dot-notation paths. Supports array index notation: 'messages[0].content'
 *
 * Paths that don't exist are silently ignored.
 * Never mutates the original body.
 */
export function removeFuzzyFields(body: unknown, ignoreFields: string[]): unknown {
  if (!ignoreFields.length) return body;
  const clone = JSON.parse(JSON.stringify(body)) as Record<string, unknown>;
  for (const field of ignoreFields) {
    deletePath(clone, field);
  }
  return clone;
}

function deletePath(obj: Record<string, unknown>, path: string): void {
  // Parse 'messages[0].content' into ['messages', '0', 'content']
  const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.');
  let current: unknown = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (current == null || typeof current !== 'object') return;
    current = (current as Record<string, unknown>)[parts[i]];
  }
  if (current != null && typeof current === 'object') {
    delete (current as Record<string, unknown>)[parts[parts.length - 1]];
  }
}
