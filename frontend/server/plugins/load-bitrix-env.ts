import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { applyEnvFile } from '../utils/loadEnvFile';

export default defineNitroPlugin(() => {
  const candidates = [
    join(process.cwd(), '.env'),
    join(process.cwd(), 'bitrix.env'),
    '/etc/vbi-hr/bitrix.env',
    '/etc/vbi-hr/bitrix-production.env'
  ];
  for (const path of candidates) {
    if (existsSync(path)) applyEnvFile(path);
  }
});
