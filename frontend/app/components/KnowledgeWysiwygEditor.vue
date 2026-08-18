<template>
  <div class="kb-wysiwyg">
    <div class="kb-wysiwyg__bar" role="toolbar" aria-label="Форматирование" @mousedown.prevent>
      <button type="button" class="kb-wysiwyg__btn" title="Заголовок" @click="format('h2')">H2</button>
      <button type="button" class="kb-wysiwyg__btn" title="Подзаголовок" @click="format('h3')">H3</button>
      <span class="kb-wysiwyg__sep" />
      <button type="button" class="kb-wysiwyg__btn" title="Жирный" @click="format('bold')"><strong>B</strong></button>
      <button type="button" class="kb-wysiwyg__btn" title="Курсив" @click="format('italic')"><em>I</em></button>
      <button type="button" class="kb-wysiwyg__btn" title="Цитата" @click="format('quote')">« »</button>
      <span class="kb-wysiwyg__sep" />
      <button type="button" class="kb-wysiwyg__btn" title="Список" @click="format('ul')">• Список</button>
      <button type="button" class="kb-wysiwyg__btn" title="Нумерация" @click="format('ol')">1.</button>
      <button type="button" class="kb-wysiwyg__btn" title="Ссылка" @click="format('link')">Ссылка</button>
      <span class="kb-wysiwyg__sep" />
      <button type="button" class="kb-wysiwyg__btn" title="Спойлер как в Telegram" @click="format('spoiler')">
        Спойлер
      </button>
      <button type="button" class="kb-wysiwyg__btn" title="Блок кода" @click="format('code')">Код</button>
    </div>

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
      @click="onSurfaceClick"
    />
  </div>
</template>

<script setup lang="ts">
const model = defineModel<string>({ default: '' });

const surfaceRef = ref<HTMLElement | null>(null);
let applying = false;

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

const markdownToHtml = (src: string) => {
  const raw = src.trim();
  if (!raw) return '<p><br></p>';
  if (/<(p|h[1-3]|div|ul|ol|blockquote|span|pre|strong|em)\b/i.test(raw)) return src;

  const inline = (value: string) =>
    escapeHtml(value)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  return raw
    .split(/\n{2,}/)
    .map((block) => {
      const line = block.trim();
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

const ensureCodeChrome = (root: HTMLElement) => {
  root.querySelectorAll('pre').forEach((pre) => {
    if (pre.closest('[data-kb-code]')) return;
    const wrap = document.createElement('div');
    wrap.className = 'kb-code';
    wrap.dataset.kbCode = '';
    wrap.contentEditable = 'false';
    wrap.innerHTML =
      '<div class="kb-code__bar"><span class="kb-code__lang">код</span><button type="button" class="kb-code__copy">Копировать</button></div>';
    const host = document.createElement('div');
    host.className = 'kb-code__body';
    host.contentEditable = 'true';
    pre.replaceWith(wrap);
    wrap.appendChild(host);
    host.appendChild(pre);
  });
};

const setHtml = (html: string) => {
  const el = surfaceRef.value;
  if (!el) return;
  applying = true;
  const next = markdownToHtml(html);
  if (el.innerHTML !== next) el.innerHTML = next;
  ensureCodeChrome(el);
  applying = false;
};

const syncFromDom = () => {
  if (applying) return;
  const el = surfaceRef.value;
  if (!el) return;
  ensureCodeChrome(el);
  model.value = isEmptyHtml(el.innerHTML) ? '' : el.innerHTML;
};

const selectedText = () => window.getSelection()?.toString() ?? '';

const format = (
  kind: 'h2' | 'h3' | 'bold' | 'italic' | 'quote' | 'ul' | 'ol' | 'link' | 'spoiler' | 'code'
) => {
  const el = surfaceRef.value;
  if (!el) return;
  el.focus();

  if (kind === 'h2' || kind === 'h3') {
    document.execCommand('formatBlock', false, kind);
  } else if (kind === 'quote') {
    document.execCommand('formatBlock', false, 'blockquote');
  } else if (kind === 'bold') {
    document.execCommand('bold');
  } else if (kind === 'italic') {
    document.execCommand('italic');
  } else if (kind === 'ul') {
    document.execCommand('insertUnorderedList');
  } else if (kind === 'ol') {
    document.execCommand('insertOrderedList');
  } else if (kind === 'link') {
    const href = window.prompt('Адрес ссылки', 'https://');
    if (href) document.execCommand('createLink', false, href.trim());
  } else if (kind === 'spoiler') {
    const text = selectedText().trim() || 'скрытый текст';
    document.execCommand(
      'insertHTML',
      false,
      `<span class="kb-spoiler" data-kb-spoiler>${escapeHtml(text)}</span>&nbsp;`
    );
  } else if (kind === 'code') {
    const text = selectedText() || 'код';
    document.execCommand(
      'insertHTML',
      false,
      `<div class="kb-code" data-kb-code contenteditable="false"><div class="kb-code__bar"><span class="kb-code__lang">код</span><button type="button" class="kb-code__copy">Копировать</button></div><div class="kb-code__body" contenteditable="true"><pre><code>${escapeHtml(text)}</code></pre></div></div><p><br></p>`
    );
  }

  syncFromDom();
};

const onSurfaceClick = async (event: MouseEvent) => {
  const target = event.target as HTMLElement | null;
  if (!target) return;

  const copyBtn = target.closest('.kb-code__copy') as HTMLButtonElement | null;
  if (copyBtn) {
    event.preventDefault();
    const block = copyBtn.closest('[data-kb-code]');
    const text = block?.querySelector('pre')?.innerText ?? '';
    try {
      await navigator.clipboard.writeText(text);
      copyBtn.textContent = 'Скопировано';
      window.setTimeout(() => {
        copyBtn.textContent = 'Копировать';
      }, 1200);
    } catch {
      copyBtn.textContent = 'Не вышло';
    }
    return;
  }

  const spoiler = target.closest('.kb-spoiler') as HTMLElement | null;
  if (spoiler && !spoiler.classList.contains('is-open')) {
    event.preventDefault();
    spoiler.classList.add('is-open');
  }
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
});
</script>
