import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyToClipboard } from '~/utils/copyToClipboard';

const fakeDocument = (execResult: boolean | 'throw') => {
  const ta = {
    value: '',
    style: {} as Record<string, string>,
    setAttribute: vi.fn(),
    select: vi.fn(),
    setSelectionRange: vi.fn(),
    remove: vi.fn()
  };
  return {
    ta,
    doc: {
      activeElement: null,
      createElement: vi.fn(() => ta),
      body: { appendChild: vi.fn() },
      execCommand: vi.fn(() => {
        if (execResult === 'throw') throw new Error('nope');
        return execResult;
      })
    }
  };
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('copyToClipboard', () => {
  it('без window возвращает false (SSR)', async () => {
    expect(await copyToClipboard('x')).toBe(false);
  });

  it('secure context — Clipboard API', async () => {
    const writeText = vi.fn(async () => {});
    const { doc } = fakeDocument(false);
    vi.stubGlobal('window', { isSecureContext: true });
    vi.stubGlobal('document', doc);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    expect(await copyToClipboard('link')).toBe(true);
    expect(writeText).toHaveBeenCalledWith('link');
    expect(doc.execCommand).not.toHaveBeenCalled();
  });

  it('http (не secure) — фолбэк через execCommand', async () => {
    const { doc, ta } = fakeDocument(true);
    vi.stubGlobal('window', { isSecureContext: false });
    vi.stubGlobal('document', doc);
    vi.stubGlobal('navigator', {});
    expect(await copyToClipboard('http://45.12.74.25/s/abc')).toBe(true);
    expect(ta.value).toBe('http://45.12.74.25/s/abc');
    expect(doc.execCommand).toHaveBeenCalledWith('copy');
    expect(ta.remove).toHaveBeenCalled();
  });

  it('Clipboard API упал — пробует фолбэк', async () => {
    const { doc } = fakeDocument(true);
    vi.stubGlobal('window', { isSecureContext: true });
    vi.stubGlobal('document', doc);
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn(async () => { throw new Error('denied'); }) } });
    expect(await copyToClipboard('x')).toBe(true);
  });

  it('честно возвращает false, если и фолбэк не сработал', async () => {
    const { doc, ta } = fakeDocument('throw');
    vi.stubGlobal('window', { isSecureContext: false });
    vi.stubGlobal('document', doc);
    vi.stubGlobal('navigator', {});
    expect(await copyToClipboard('x')).toBe(false);
    expect(ta.remove).toHaveBeenCalled();
  });
});
