<template>
  <div class="kb-wysiwyg" @input="syncFromDom" @mousedown.capture="onEditorMouseDown">
    <div class="kb-wysiwyg__bar" role="toolbar" aria-label="Форматирование" @mousedown.prevent>
      <div class="kb-wysiwyg__combo" @click.stop>
        <button
          type="button"
          class="kb-wysiwyg__btn"
          :class="{ 'is-open': openMenu === 'heading' }"
          title="Заголовок"
          aria-haspopup="listbox"
          :aria-expanded="openMenu === 'heading'"
          @click="toggleMenu('heading')"
        >
          Заголовок
        </button>
        <div v-if="openMenu === 'heading'" class="kb-wysiwyg__drop" role="listbox">
          <button type="button" class="kb-wysiwyg__drop-item" @click="format('h2')">H2</button>
          <button type="button" class="kb-wysiwyg__drop-item" @click="format('h3')">H3</button>
          <button type="button" class="kb-wysiwyg__drop-item" @click="format('h4')">H4</button>
        </div>
      </div>

      <button type="button" class="kb-wysiwyg__btn" title="Жирный" @click="format('bold')"><strong>B</strong></button>
      <button type="button" class="kb-wysiwyg__btn kb-wysiwyg__btn--italic" title="Курсив" @click="format('italic')">
        <em>к</em>
      </button>
      <button type="button" class="kb-wysiwyg__btn" title="Подчёркивание" @click="format('underline')"><u>U</u></button>
      <button type="button" class="kb-wysiwyg__btn" title="Цитата" @click="format('quote')">« »</button>

      <div class="kb-wysiwyg__combo" @click.stop>
        <button
          type="button"
          class="kb-wysiwyg__btn"
          :class="{ 'is-open': openMenu === 'list' }"
          title="Список"
          aria-haspopup="listbox"
          :aria-expanded="openMenu === 'list'"
          @click="toggleMenu('list')"
        >
          Список
        </button>
        <div v-if="openMenu === 'list'" class="kb-wysiwyg__drop" role="listbox">
          <button type="button" class="kb-wysiwyg__drop-item" @click="format('ul')">• Точка</button>
          <button type="button" class="kb-wysiwyg__drop-item" @click="format('ol')">1. Нумерация</button>
        </div>
      </div>

      <button type="button" class="kb-wysiwyg__btn" title="Спойлер как в Telegram" @click="format('spoiler')">
        Спойлер
      </button>
      <button type="button" class="kb-wysiwyg__btn" title="Блок кода" @click="format('code')">Код</button>
    </div>

    <div class="kb-wysiwyg__column">
      <slot />
      <div
        ref="surfaceRef"
        class="kb-wysiwyg__surface"
        contenteditable="true"
        role="textbox"
        aria-multiline="true"
        aria-label="Текст статьи"
        data-placeholder="Текст статьи"
        spellcheck="true"
        @input="syncFromDom"
        @keydown="onSurfaceKeydown"
        @click="onSurfaceClick"
        @paste="onPaste"
        @contextmenu="onContextMenu"
      />
    </div>
  </div>

  <Teleport to="body">
    <div
      v-if="linkMenu"
      class="kb-link-menu"
      :style="{ top: `${linkMenu.y}px`, left: `${linkMenu.x}px` }"
      @mousedown.prevent
    >
      <button type="button" class="kb-link-menu__btn" @click.stop="addLinkFromMenu">Гиперссылка</button>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
const emit = defineEmits<{ ready: [] }>();
const model = defineModel<string>({ default: '' });

const surfaceRef = ref<HTMLElement | null>(null);
const openMenu = ref<'heading' | 'list' | null>(null);
const linkMenu = ref<{ x: number; y: number } | null>(null);
let savedRange: Range | null = null;
let applying = false;

const COPY_ICON =
  '<svg class="kb-code__icon" viewBox="0 0 16 16" aria-hidden="true"><rect x="5.2" y="5.2" width="8.2" height="8.2" rx="1.6" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M10.2 5.2V3.6A1.4 1.4 0 0 0 8.8 2.2H3.6A1.4 1.4 0 0 0 2.2 3.6v5.2A1.4 1.4 0 0 0 3.6 10.2h1.6" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';
const COPY_DONE_ICON =
  '<svg class="kb-code__icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.2 8.4 6.4 11.6 12.8 4.8" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';

const copyButtonHtml = () =>
  `<button type="button" class="kb-code__copy" aria-label="Копировать">${COPY_ICON}</button>`;

const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const isEmptyHtml = (html: string) => {
  const text = html
    .replace(/<br\s*\/?>/gi, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .trim();
  return !text;
};

const visibleText = (el: HTMLElement) =>
  (el.innerText || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\u200b/g, '')
    .trim();

const asElement = (target: EventTarget | null): Element | null =>
  target instanceof Element ? target : (target as Node | null)?.parentElement ?? null;

const selectionInside = (el: HTMLElement) => {
  const sel = window.getSelection();
  if (!sel?.rangeCount) return false;
  const node = sel.anchorNode;
  return Boolean(node && el.contains(node));
};

const placeCaretIn = (el: HTMLElement) => {
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(true);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
};

const ensureTrailingParagraph = (block: HTMLElement) => {
  const next = block.nextElementSibling;
  if (next instanceof HTMLElement && next.tagName === 'P') return next;
  const p = document.createElement('p');
  p.innerHTML = '<br>';
  block.after(p);
  return p;
};

const replaceWithEmptyParagraph = (el: HTMLElement) => {
  const p = document.createElement('p');
  p.innerHTML = '<br>';
  el.replaceWith(p);
  placeCaretIn(p);
};

const pruneEmptyDecorations = () => {
  const root = surfaceRef.value;
  if (!root) return;
  root.querySelectorAll('[data-kb-code]').forEach((wrap) => {
    const host = wrap as HTMLElement;
    if (selectionInside(host)) return;
    const source = (host.querySelector('pre, code') as HTMLElement | null) || host.querySelector('.kb-code__body');
    if (!source || !visibleText(source as HTMLElement)) replaceWithEmptyParagraph(host);
  });
  root.querySelectorAll('blockquote').forEach((bq) => {
    const host = bq as HTMLElement;
    if (selectionInside(host)) return;
    if (!visibleText(host)) replaceWithEmptyParagraph(host);
  });
};

const markdownToHtml = (src: string) => {
  const raw = src.trim();
  if (!raw) return '<p><br></p>';
  if (/<(p|h[1-4]|div|ul|ol|blockquote|span|pre|strong|em|u)\b/i.test(raw)) return src;

  const inline = (value: string) =>
    escapeHtml(value)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  return raw
    .split(/\n{2,}/)
    .map((block) => {
      const line = block.trim();
      if (line.startsWith('#### ')) return `<h4>${inline(line.slice(5))}</h4>`;
      if (line.startsWith('### ')) return `<h3>${inline(line.slice(4))}</h3>`;
      if (line.startsWith('## ')) return `<h2>${inline(line.slice(3))}</h2>`;
      if (line.startsWith('> ')) return `<blockquote><p>${inline(line.replace(/^>\s?/gm, ''))}</p></blockquote>`;
      if (/^[-*] /.test(line)) {
        const items = line
          .split('\n')
          .map((row) => `<li>${inline(row.replace(/^[-*]\s+/, ''))}</li>`)
          .join('');
        return `<ul>${items}</ul>`;
      }
      return `<p>${inline(line).replace(/\n/g, '<br>')}</p>`;
    })
    .join('');
};

const codeTextFromBlock = (block: Element) => {
  const pre = block.querySelector('pre') as HTMLElement | null;
  const code = block.querySelector('code') as HTMLElement | null;
  const body = block.querySelector('.kb-code__body') as HTMLElement | null;
  const source = pre || code || body;
  return source ? visibleText(source) : '';
};

const copyCodeFromButton = async (copyBtn: HTMLButtonElement) => {
  const block = copyBtn.closest('[data-kb-code]');
  if (!block) return;
  const text = codeTextFromBlock(block);
  let copied = false;
  try {
    await navigator.clipboard.writeText(text);
    copied = true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    copied = document.execCommand('copy');
    ta.remove();
  }
  copyBtn.innerHTML = copied ? COPY_DONE_ICON : COPY_ICON;
  copyBtn.setAttribute('aria-label', copied ? 'Скопировано' : 'Не вышло');
  window.setTimeout(() => {
    copyBtn.innerHTML = COPY_ICON;
    copyBtn.setAttribute('aria-label', 'Копировать');
  }, 1200);
};

const ensureCodeChrome = (root: HTMLElement) => {
  root.querySelectorAll('pre').forEach((pre) => {
    if (pre.closest('[data-kb-code]')) return;
    const wrap = document.createElement('div');
    wrap.className = 'kb-code';
    wrap.dataset.kbCode = '';
    wrap.contentEditable = 'false';
    wrap.innerHTML = `<div class="kb-code__bar"><span class="kb-code__lang">код</span>${copyButtonHtml()}</div>`;
    const host = document.createElement('div');
    host.className = 'kb-code__body';
    host.contentEditable = 'true';
    if (!host.dataset.kbBound) {
      host.dataset.kbBound = '1';
      host.addEventListener('input', () => syncFromDom());
    }
    pre.replaceWith(wrap);
    wrap.appendChild(host);
    host.appendChild(pre);
  });
  root.querySelectorAll('.kb-code__copy').forEach((btn) => {
    const button = btn as HTMLButtonElement;
    if (button.querySelector('svg')) return;
    button.innerHTML = COPY_ICON;
    button.setAttribute('aria-label', 'Копировать');
  });
};

const setHtml = (html: string) => {
  const el = surfaceRef.value;
  if (!el) return;
  applying = true;
  const next = markdownToHtml(html);
  if (el.innerHTML !== next) el.innerHTML = next;
  ensureCodeChrome(el);
  pruneEmptyDecorations();
  applying = false;
};

const syncFromDom = () => {
  if (applying) return;
  const el = surfaceRef.value;
  if (!el) return;
  ensureCodeChrome(el);
  pruneEmptyDecorations();
  model.value = isEmptyHtml(el.innerHTML) ? '' : el.innerHTML;
};

const selectedText = () => window.getSelection()?.toString() ?? '';

const formatBlock = (tag: string) => {
  const withBrackets = document.execCommand('formatBlock', false, `<${tag}>`);
  if (!withBrackets) document.execCommand('formatBlock', false, tag);
};

const blockNearCaret = (selector: string) => {
  const sel = window.getSelection();
  const node = sel?.anchorNode;
  const el = node instanceof HTMLElement ? node : node?.parentElement;
  if (!el) return null;
  const inside = el.closest(selector) as HTMLElement | null;
  if (inside) return inside;
  const p = el.closest('p');
  const prev = p?.previousElementSibling;
  if (prev instanceof HTMLElement && prev.matches(selector)) return prev;
  return null;
};

const looksLikeUrl = (value: string) => {
  const text = value.trim();
  if (!text || /\s/.test(text)) return false;
  try {
    const href = /^https?:\/\//i.test(text) ? text : `https://${text}`;
    const url = new URL(href);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    return url.hostname.includes('.');
  } catch {
    return false;
  }
};

const normalizeHref = (value: string) => {
  const text = value.trim();
  return /^https?:\/\//i.test(text) ? text : `https://${text}`;
};

const restoreSavedRange = () => {
  if (!savedRange) return false;
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(savedRange);
  return true;
};

const applyLink = (raw: string) => {
  const href = normalizeHref(raw);
  if (!href) return;
  document.execCommand('createLink', false, href);
};

const wrapSpoiler = () => {
  const sel = window.getSelection();
  const range = sel?.rangeCount ? sel.getRangeAt(0) : null;
  if (range && !range.collapsed) {
    try {
      const span = document.createElement('span');
      span.className = 'kb-spoiler';
      span.dataset.kbSpoiler = '';
      range.surroundContents(span);
      return;
    } catch {
      /* пересечение блоков — вставляем плоский текст */
    }
  }
  const text = selectedText().trim() || 'скрытый текст';
  document.execCommand(
    'insertHTML',
    false,
    `<span class="kb-spoiler" data-kb-spoiler>${escapeHtml(text)}</span>&nbsp;`
  );
};

const toggleMenu = (kind: 'heading' | 'list') => {
  openMenu.value = openMenu.value === kind ? null : kind;
};

const format = (
  kind: 'h2' | 'h3' | 'h4' | 'bold' | 'italic' | 'underline' | 'quote' | 'ul' | 'ol' | 'spoiler' | 'code'
) => {
  const el = surfaceRef.value;
  if (!el) return;
  el.focus();
  openMenu.value = null;

  if (kind === 'h2' || kind === 'h3' || kind === 'h4') {
    formatBlock(kind);
    const heading = blockNearCaret('h2,h3,h4');
    if (heading) ensureTrailingParagraph(heading);
  } else if (kind === 'quote') {
    const text = selectedText().trim() || 'цитата';
    document.execCommand(
      'insertHTML',
      false,
      `<blockquote><p>${escapeHtml(text)}</p></blockquote><p><br></p>`
    );
    const quote = blockNearCaret('blockquote');
    if (quote) ensureTrailingParagraph(quote);
  } else if (kind === 'bold') {
    document.execCommand('bold');
  } else if (kind === 'italic') {
    document.execCommand('italic');
  } else if (kind === 'underline') {
    document.execCommand('underline');
  } else if (kind === 'ul') {
    document.execCommand('insertUnorderedList');
  } else if (kind === 'ol') {
    document.execCommand('insertOrderedList');
  } else if (kind === 'spoiler') {
    wrapSpoiler();
  } else if (kind === 'code') {
    const text = selectedText() || 'код';
    document.execCommand(
      'insertHTML',
      false,
      `<div class="kb-code" data-kb-code contenteditable="false"><div class="kb-code__bar"><span class="kb-code__lang">код</span>${copyButtonHtml()}</div><div class="kb-code__body" contenteditable="true"><pre><code>${escapeHtml(text)}</code></pre></div></div><p><br></p>`
    );
    const block = blockNearCaret('[data-kb-code]');
    if (block) ensureTrailingParagraph(block);
  }

  syncFromDom();
};

const onPaste = (event: ClipboardEvent) => {
  const target = asElement(event.target);
  if (target?.closest('[data-kb-code]')) {
    event.preventDefault();
    const text = event.clipboardData?.getData('text/plain') ?? '';
    document.execCommand('insertText', false, text);
    syncFromDom();
    return;
  }

  const pasted = event.clipboardData?.getData('text/plain') ?? '';
  if (!looksLikeUrl(pasted)) return;

  event.preventDefault();
  const href = normalizeHref(pasted);
  const sel = window.getSelection();
  if (sel && !sel.isCollapsed && sel.toString().trim()) {
    applyLink(href);
  } else {
    document.execCommand('insertHTML', false, `<a href="${escapeHtml(href)}">${escapeHtml(pasted.trim())}</a>`);
  }
  syncFromDom();
};

const onContextMenu = (event: MouseEvent) => {
  const target = asElement(event.target);
  if (target?.closest('[data-kb-code]')) return;
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || !sel.toString().trim()) return;
  if (!surfaceRef.value?.contains(sel.anchorNode)) return;
  event.preventDefault();
  savedRange = sel.getRangeAt(0).cloneRange();
  linkMenu.value = { x: event.clientX, y: event.clientY };
};

const addLinkFromMenu = () => {
  const href = window.prompt('Адрес ссылки', 'https://');
  linkMenu.value = null;
  if (!href?.trim()) return;
  surfaceRef.value?.focus();
  restoreSavedRange();
  applyLink(href);
  syncFromDom();
};

const onEditorMouseDown = (event: MouseEvent) => {
  const copyBtn = asElement(event.target)?.closest('.kb-code__copy') as HTMLButtonElement | null;
  if (!copyBtn) return;
  event.preventDefault();
  event.stopPropagation();
  void copyCodeFromButton(copyBtn);
};

const onSurfaceKeydown = (event: KeyboardEvent) => {
  if (event.key !== 'Enter' || event.shiftKey) return;
  const target = asElement(event.target);
  if (target?.closest('[data-kb-code]')) return;

  const sel = window.getSelection();
  if (!sel?.rangeCount || !sel.isCollapsed) return;
  const node = sel.anchorNode;
  const el = node instanceof HTMLElement ? node : node?.parentElement;
  const bq = el?.closest('blockquote');
  if (!bq || !surfaceRef.value?.contains(bq)) return;

  const line = (el?.closest('p') as HTMLElement | null) || (bq as HTMLElement);
  if (visibleText(line)) return;

  event.preventDefault();
  const p = ensureTrailingParagraph(bq as HTMLElement);
  if (line !== bq && line.parentElement === bq && bq.childElementCount > 1) line.remove();
  placeCaretIn(p);
  syncFromDom();
};

const onSurfaceClick = (event: MouseEvent) => {
  const target = asElement(event.target);
  if (!target) return;
  linkMenu.value = null;

  const spoiler = target.closest('.kb-spoiler') as HTMLElement | null;
  if (spoiler && !spoiler.classList.contains('is-open')) {
    event.preventDefault();
    spoiler.classList.add('is-open');
  }
};

const onDocumentClick = () => {
  openMenu.value = null;
  linkMenu.value = null;
};

watch(
  () => model.value,
  (html) => {
    const el = surfaceRef.value;
    if (!el || applying) return;
    if (el.innerHTML === html) return;
    if (!html && isEmptyHtml(el.innerHTML)) return;
    setHtml(html);
  }
);

onMounted(() => {
  setHtml(model.value);
  syncFromDom();
  document.addEventListener('click', onDocumentClick);
  emit('ready');
});

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick);
});
</script>
