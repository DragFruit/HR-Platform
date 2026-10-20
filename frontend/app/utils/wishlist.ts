/**
 * Вишлист сотрудника: общие правила для клиента и сервера (server/api/profile/wishlist.*).
 * Пункт = текст и/или ссылка http(s). Без HTML: всё выводится текстом через {{ }} в Vue,
 * ссылка — только после проверки протокола, открывается в новой вкладке с rel=noopener noreferrer.
 */

export const WISHLIST_MAX_ITEMS = 20;
export const WISHLIST_MAX_TEXT = 300;
export const WISHLIST_MAX_URL = 1000;

export type WishlistItem = {
  /** Стабильный id пункта (для порядка и key в списке). */
  id: string;
  /** Что хочется словами; может быть пустым, если есть ссылка. */
  text: string;
  /** Ссылка http(s) или пустая строка. */
  url: string;
};

export type WishlistInputItem = { id?: unknown; text?: unknown; url?: unknown };

export class WishlistValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WishlistValidationError';
  }
}

/** Управляющие символы (кроме переноса строки) и zero-width — выкидываем. */
const CONTROL_CHARS = /[\u0000-\u0009\u000B-\u001F\u007F​-‏‪-‮⁠-⁤﻿]/g;

/** Текст пункта: без управляющих символов, схлопнутые пробелы, максимум одна пустая строка подряд. */
export function cleanWishText(raw: unknown): string {
  return String(raw ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(CONTROL_CHARS, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .trim();
}

/**
 * Ссылка: только http/https, без логина-пароля в адресе. «ozon.ru/…» без протокола → https://.
 * Пустая строка — нет ссылки. null — ссылка есть, но плохая.
 */
export function normalizeWishUrl(raw: unknown): string | null {
  const value = String(raw ?? '').replace(CONTROL_CHARS, '').trim();
  if (!value) return '';
  if (/\s/.test(value)) return null;
  let candidate = value;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(candidate)) {
    // похоже на домен без протокола (ozon.ru/..., www.wb.ru)
    if (!/^[\p{L}\p{N}-]+(\.[\p{L}\p{N}-]+)+(?:[/:?#]|$)/u.test(candidate)) return null;
    candidate = `https://${candidate}`;
  }
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
  if (parsed.username || parsed.password) return null;
  if (!parsed.hostname || !parsed.hostname.includes('.')) return null;
  const href = parsed.href;
  if (href.length > WISHLIST_MAX_URL) return null;
  return href;
}

/** Домен для подписи ссылки: «ozon.ru» (без www.). */
export function wishUrlDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, '');
  } catch {
    return '';
  }
}

/** Безопасно ли ставить в href (повторная проверка на клиенте перед выводом). */
export function isSafeWishUrl(url: unknown): url is string {
  if (typeof url !== 'string' || !url) return false;
  return normalizeWishUrl(url) === url;
}

const ID_PATTERN = /^[a-z0-9-]{1,40}$/i;

export function newWishId(): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `w-${Date.now().toString(36)}-${rand}`;
}

/**
 * Строгая проверка того, что пришло от пользователя (PUT). Пустые пункты (ни текста, ни ссылки)
 * молча выкидываем; плохая ссылка, слишком длинный текст или больше 20 пунктов — ошибка с текстом
 * для человека. Порядок — как в запросе.
 */
export function validateWishlistInput(input: unknown): WishlistItem[] {
  if (!Array.isArray(input)) throw new WishlistValidationError('Ожидался список пожеланий');
  const out: WishlistItem[] = [];
  const seen = new Set<string>();
  input.forEach((raw, index) => {
    const row = (raw && typeof raw === 'object' ? raw : {}) as WishlistInputItem;
    const text = cleanWishText(row.text);
    const url = normalizeWishUrl(row.url);
    const n = index + 1;
    if (url === null) {
      throw new WishlistValidationError(`Пункт ${n}: ссылка должна начинаться с http:// или https://`);
    }
    if (!text && !url) return;
    if (text.length > WISHLIST_MAX_TEXT) {
      throw new WishlistValidationError(`Пункт ${n}: не длиннее ${WISHLIST_MAX_TEXT} символов`);
    }
    let id = typeof row.id === 'string' && ID_PATTERN.test(row.id) ? row.id : newWishId();
    while (seen.has(id)) id = newWishId();
    seen.add(id);
    out.push({ id, text, url });
  });
  if (out.length > WISHLIST_MAX_ITEMS) {
    throw new WishlistValidationError(`В вишлисте не больше ${WISHLIST_MAX_ITEMS} пунктов`);
  }
  return out;
}

/** Мягкая чистка при чтении из хранилища: битые пункты пропускаем, не падаем. */
export function sanitizeStoredWishlist(input: unknown): WishlistItem[] {
  if (!Array.isArray(input)) return [];
  const out: WishlistItem[] = [];
  for (const raw of input) {
    const row = (raw && typeof raw === 'object' ? raw : {}) as WishlistInputItem;
    const text = cleanWishText(row.text).slice(0, WISHLIST_MAX_TEXT);
    const url = normalizeWishUrl(row.url) ?? '';
    if (!text && !url) continue;
    const id = typeof row.id === 'string' && ID_PATTERN.test(row.id) ? row.id : newWishId();
    out.push({ id, text, url });
    if (out.length >= WISHLIST_MAX_ITEMS) break;
  }
  return out;
}
