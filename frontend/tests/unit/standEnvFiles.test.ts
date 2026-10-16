import { describe, expect, it } from 'vitest';
import {
  PRODUCTION_ENV_FILE,
  STAGING_ENV_FILE,
  resolveStand,
  standEnvFiles
} from '../../server/utils/standEnvFiles';

describe('standEnvFiles', () => {
  it('стейдж читает только свой файл, никогда боевой', () => {
    const files = standEnvFiles('staging', '/var/www/vbi-hr-staging');
    expect(files).toEqual([
      '/var/www/vbi-hr-staging/.env',
      '/var/www/vbi-hr-staging/bitrix.env',
      STAGING_ENV_FILE
    ]);
    expect(files).not.toContain(PRODUCTION_ENV_FILE);
    expect(files.some((f) => f.includes('production'))).toBe(false);
  });

  it('бой читает только боевой файл, не стейджевый', () => {
    const files = standEnvFiles('production', '/var/www/vbi-hr');
    expect(files).toEqual(['/var/www/vbi-hr/.env', '/var/www/vbi-hr/bitrix.env', PRODUCTION_ENV_FILE]);
    expect(files).not.toContain(STAGING_ENV_FILE);
  });

  it('development — только локальные файлы, без /etc/vbi-hr', () => {
    const files = standEnvFiles('development', '/repo/frontend');
    expect(files).toEqual(['/repo/frontend/.env', '/repo/frontend/bitrix.env']);
    expect(files.some((f) => f.startsWith('/etc/'))).toBe(false);
  });

  it('стенд не определён → ничего не грузим', () => {
    expect(standEnvFiles(null, '/var/www/vbi-hr-staging')).toEqual([]);
  });

  it('resolveStand принимает только точные значения', () => {
    expect(resolveStand('staging')).toBe('staging');
    expect(resolveStand(' production ')).toBe('production');
    expect(resolveStand('development')).toBe('development');
    expect(resolveStand('')).toBeNull();
    expect(resolveStand(undefined)).toBeNull();
    expect(resolveStand('prod')).toBeNull();
    expect(resolveStand('Staging')).toBeNull();
  });
});
