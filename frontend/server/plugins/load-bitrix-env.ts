import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

function loadEnvFile(path: string) {
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    return;
  }
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
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

export default defineNitroPlugin(() => {
  const candidates = [
    join(process.cwd(), '.env'),
    join(process.cwd(), 'bitrix.env'),
    '/etc/vbi-hr/bitrix.env'
  ];
  for (const path of candidates) {
    if (existsSync(path)) loadEnvFile(path);
  }
});
