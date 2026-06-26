import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

let cachedMtime = 0;
let cachedVars: Record<string, string> = {};

export function applyEnvFile(path: string, force = false) {
  if (!existsSync(path)) return;

  const mtime = statSync(path).mtimeMs;
  if (!force && mtime === cachedMtime) {
    for (const [key, value] of Object.entries(cachedVars)) {
      process.env[key] = value;
    }
    return;
  }

  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    return;
  }

  const vars: Record<string, string> = {};
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key) {
      vars[key] = value;
      process.env[key] = value;
    }
  }

  cachedMtime = mtime;
  cachedVars = vars;
}

export function refreshLocalEnv() {
  applyEnvFile(join(process.cwd(), '.env'), true);
}
