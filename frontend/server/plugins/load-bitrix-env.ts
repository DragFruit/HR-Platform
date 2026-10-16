import { existsSync } from 'node:fs';
import { applyEnvFile } from '../utils/loadEnvFile';
import { resolveStand, standEnvFiles } from '../utils/standEnvFiles';

/** Подмешать env ТОЛЬКО своего стенда (см. standEnvFiles.ts). В лог — имена файлов и число ключей, без значений. */
export default defineNitroPlugin(() => {
  let baked: unknown = '';
  try {
    baked = useRuntimeConfig().public.appEnv;
  } catch {
    /* вне Nitro-контекста */
  }
  const stand = resolveStand(baked) ?? resolveStand(process.env.NUXT_PUBLIC_APP_ENV);

  if (!stand) {
    console.warn('[env] стенд не определён (NUXT_PUBLIC_APP_ENV) — env-файлы не подгружаются');
    return;
  }

  const loaded: string[] = [];
  for (const path of standEnvFiles(stand, process.cwd())) {
    if (!existsSync(path)) continue;
    const count = applyEnvFile(path);
    if (count !== null) loaded.push(`${path} (${count} keys)`);
  }
  console.info(`[env] stand=${stand} loaded: ${loaded.length ? loaded.join(', ') : 'none'}`);
});
