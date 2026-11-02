import { getDeployAppEnv } from './appEnv';

/**
 * «Сейчас» для адвента. На localhost и стейдже время можно сдвинуть
 * переменной `OGONEK_DEV_NOW` (ISO с зоной, например
 * `2026-12-16T11:00:00+03:00`), чтобы прогонять декабрь до его наступления.
 * На бою переменная игнорируется.
 */
export function ogonekNow(): Date {
  if (getDeployAppEnv() !== 'production') {
    const raw = String(process.env.OGONEK_DEV_NOW || '').trim();
    if (raw) {
      const ms = Date.parse(raw);
      if (Number.isFinite(ms)) return new Date(ms);
    }
  }
  return new Date();
}
