/**
 * Коробка с письмами благодарности. Что открыто и какие письма чьи, решает
 * сервер (ogonekMailboxOpen). Выскакивает сама, когда в ней появились письма,
 * которых человек ещё не видел; дальше открывается со страницы адвента.
 */
export type OgonekMailLetter = { id: string; text: string; read: boolean };

type MailboxState = { open: boolean; popup: boolean; letters: OgonekMailLetter[] };

export function useOgonekMailbox() {
  const state = useState<MailboxState>('ogonek-mailbox', () => ({ open: false, popup: false, letters: [] }));
  const visible = useState<boolean>('ogonek-mailbox-visible', () => false);

  async function refresh() {
    try {
      state.value = await $fetch<MailboxState>('/api/event/ogonek/mailbox');
    } catch {
      state.value = { open: false, popup: false, letters: [] };
    }
    if (!state.value.open) visible.value = false;
    else if (state.value.popup) show();
  }

  function show() {
    if (!state.value.open || !state.value.letters.length) return;
    visible.value = true;
    state.value = { ...state.value, popup: false };
    void $fetch('/api/event/ogonek/mailbox', { method: 'POST', body: { kind: 'seen' } }).catch(() => {});
  }

  function hide() {
    visible.value = false;
  }

  function markRead(id: string) {
    state.value = {
      ...state.value,
      letters: state.value.letters.map((l) => (l.id === id ? { ...l, read: true } : l))
    };
    void $fetch('/api/event/ogonek/mailbox', { method: 'POST', body: { kind: 'read', id } }).catch(() => {});
  }

  /** Панель отладки: коробка как при первом входе. */
  async function devReset() {
    await $fetch('/api/event/ogonek/mailbox', { method: 'POST', body: { kind: 'devReset' } });
    await refresh();
  }

  return { state, visible, refresh, show, hide, markRead, devReset };
}
