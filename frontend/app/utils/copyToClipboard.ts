/**
 * Копирование текста в буфер обмена, работающее и на plain HTTP.
 *
 * `navigator.clipboard` доступен только в secure context (https или localhost).
 * Оба стенда (`http://45.12.74.25` и `:8080`) — обычный http, там
 * `navigator.clipboard` === undefined, и `writeText` падал молча.
 *
 * Порядок: Clipboard API (если secure context) → скрытая textarea +
 * `document.execCommand('copy')`. Возвращает честный результат: `true`,
 * только если копирование действительно сработало.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;

  if (window.isSecureContext && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      /* падаем в execCommand-фолбэк ниже */
    }
  }

  return copyViaExecCommand(text);
}

function copyViaExecCommand(text: string): boolean {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.setAttribute('aria-hidden', 'true');
  ta.style.position = 'fixed';
  ta.style.top = '0';
  ta.style.left = '-9999px';
  ta.style.opacity = '0';
  const activeEl = document.activeElement as HTMLElement | null;
  document.body.appendChild(ta);
  let ok = false;
  try {
    ta.select();
    ta.setSelectionRange(0, text.length);
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  } finally {
    ta.remove();
    activeEl?.focus?.({ preventScroll: true });
  }
  return ok;
}

/** Выделить текст элемента — чтобы пользователь скопировал вручную (Ctrl/⌘+C), если буфер недоступен. */
export function selectElementText(el: Element | null | undefined): void {
  if (!el || typeof window === 'undefined') return;
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  range.selectNodeContents(el);
  selection.removeAllRanges();
  selection.addRange(range);
}
