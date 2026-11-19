import { describe, expect, it } from 'vitest';
import { isProductionBrowserHost } from '~/utils/productionHost';

describe('isProductionBrowserHost', () => {
  it('офисный сервер: бой снаружи на :9180 (и :80 / без порта)', () => {
    expect(isProductionBrowserHost('178.176.44.94', '9180')).toBe(true);
    expect(isProductionBrowserHost('178.176.44.94', '80')).toBe(true);
    expect(isProductionBrowserHost('178.176.44.94', '')).toBe(true);
  });

  it('офисный сервер: стейдж :8080 и прочие порты не бой', () => {
    expect(isProductionBrowserHost('178.176.44.94', '8080')).toBe(false);
    expect(isProductionBrowserHost('178.176.44.94', '3300')).toBe(false);
    expect(isProductionBrowserHost('178.176.44.94', '3301')).toBe(false);
  });

  it('старый VPS: бой без порта / :80, стейдж :8080', () => {
    expect(isProductionBrowserHost('45.12.74.25', '')).toBe(true);
    expect(isProductionBrowserHost('45.12.74.25', '80')).toBe(true);
    expect(isProductionBrowserHost('45.12.74.25', '8080')).toBe(false);
    expect(isProductionBrowserHost('45.12.74.25', '9180')).toBe(false);
  });

  it('домен vibe.testvbi.ru: бой без порта / :80 / :443, остальные порты не бой', () => {
    expect(isProductionBrowserHost('vibe.testvbi.ru', '')).toBe(true);
    expect(isProductionBrowserHost('vibe.testvbi.ru', '80')).toBe(true);
    expect(isProductionBrowserHost('vibe.testvbi.ru', '443')).toBe(true);
    expect(isProductionBrowserHost('vibe.testvbi.ru', '9180')).toBe(true);
    expect(isProductionBrowserHost('vibe.testvbi.ru', '8080')).toBe(false);
    expect(isProductionBrowserHost('git.testvbi.ru', '')).toBe(false);
  });

  it('localhost и чужие хосты не бой', () => {
    expect(isProductionBrowserHost('localhost', '3000')).toBe(false);
    expect(isProductionBrowserHost('localhost', '')).toBe(false);
    expect(isProductionBrowserHost('178.176.44.95', '9180')).toBe(false);
  });
});
