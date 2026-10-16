import { afterEach, describe, expect, it } from 'vitest';
import { databaseNameFromUrl, dbEnvMismatch, getDb, isDbEnabled } from '../../server/db/client';

describe('db client', () => {
  const saved = process.env.DATABASE_URL;
  afterEach(() => {
    if (saved === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = saved;
  });

  it('без DATABASE_URL база выключена и getDb() → null', () => {
    delete process.env.DATABASE_URL;
    expect(isDbEnabled()).toBe(false);
    expect(getDb()).toBeNull();
  });

  it('имя базы из URL', () => {
    expect(databaseNameFromUrl('postgres://u:p@127.0.0.1:5432/vbi_staging')).toBe('vbi_staging');
    expect(databaseNameFromUrl('not a url')).toBe('');
  });

  it('стейдж не может смотреть в боевую базу и наоборот', () => {
    expect(dbEnvMismatch('staging', 'vbi_prod')).not.toBeNull();
    expect(dbEnvMismatch('production', 'vbi_staging')).not.toBeNull();
    expect(dbEnvMismatch('staging', 'vbi_staging')).toBeNull();
    expect(dbEnvMismatch('production', 'vbi_prod')).toBeNull();
    expect(dbEnvMismatch('development', 'vbi_dev')).toBeNull();
  });
});
