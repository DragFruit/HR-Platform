/**
 * Редактирование чувствительных строк для логов и ответов API.
 * Webhook Bitrix: user id и секрет из пути /rest/ заменяются на маску.
 */
export function redactSensitiveText(value: string): string {
  return String(value || '')
    .replace(/(\/rest\/)[^/\s]+\/[^/\s]+/gi, '$1***/***/')
    .replace(/(client_secret=)[^&\s]+/gi, '$1***')
    .replace(/(refresh_token=)[^&\s]+/gi, '$1***')
    .replace(/(access_token=)[^&\s]+/gi, '$1***')
    .replace(/(password["']?\s*[:=]\s*["']?)[^"',\s}]+/gi, '$1***');
}

export function redactSensitiveUnknown(err: unknown): string {
  if (err instanceof Error) return redactSensitiveText(err.message);
  return redactSensitiveText(String(err));
}
