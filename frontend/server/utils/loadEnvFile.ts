import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Кэш по пути файла: раньше был один на все файлы, и при совпадении mtime подставлялись ключи ЧУЖОГО файла. */
const cache = new Map<string, { mtime: number; vars: Record<string, string> }>();

/** Применить KEY=VALUE из файла к process.env. Возвращает число ключей или null, если файл не прочитан. */
export function applyEnvFile(path: string, force = false): number | null {
  if (!existsSync(path)) return null;

  let mtime: number;
  try {
    mtime = statSync(path).mtimeMs;
  } catch {
    return null;
  }
  const cached = cache.get(path);
  if (!force && cached && cached.mtime === mtime) {
    for (const [key, value] of Object.entries(cached.vars)) {
      process.env[key] = value;
    }
    return Object.keys(cached.vars).length;
  }

  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    return null;
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

  cache.set(path, { mtime, vars });
  return Object.keys(vars).length;
}

export function refreshLocalEnv() {
  applyEnvFile(join(process.cwd(), '.env'), true);
}
