import { useKnowledgeAiAnswer, type KnowledgeAiPart } from '~/composables/useKnowledgeAiAnswer';

export const KB_AI_CHAT_STORAGE_KEY = 'vbi-kb-ai-chat-v1';
export const KB_AI_CHAT_TTL_MS = 24 * 60 * 60 * 1000;

export type KnowledgeChatMessage = {
  id: string;
  from: 'user' | 'bot';
  text?: string;
  parts?: KnowledgeAiPart[];
  createdAt: number;
};

type StoredChat = {
  savedAt: number;
  messages: KnowledgeChatMessage[];
};

const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const readStore = (): KnowledgeChatMessage[] => {
  if (!import.meta.client) return [];
  try {
    const raw = localStorage.getItem(KB_AI_CHAT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredChat;
    if (!parsed?.savedAt || Date.now() - parsed.savedAt > KB_AI_CHAT_TTL_MS) {
      localStorage.removeItem(KB_AI_CHAT_STORAGE_KEY);
      return [];
    }
    return Array.isArray(parsed.messages) ? parsed.messages : [];
  } catch {
    return [];
  }
};

const writeStore = (messages: KnowledgeChatMessage[]) => {
  if (!import.meta.client) return;
  const payload: StoredChat = { savedAt: Date.now(), messages };
  localStorage.setItem(KB_AI_CHAT_STORAGE_KEY, JSON.stringify(payload));
};

export function useKnowledgeAiChat() {
  const { answerQuestion } = useKnowledgeAiAnswer();
  const messages = ref<KnowledgeChatMessage[]>([]);
  const error = ref('');

  const persist = () => writeStore(messages.value);

  const hydrate = () => {
    messages.value = readStore();
  };

  const send = async (raw: string) => {
    const text = raw.trim();
    if (!text) return;
    error.value = '';

    messages.value.push({
      id: newId(),
      from: 'user',
      text,
      createdAt: Date.now()
    });

    try {
      const answer = await answerQuestion(text);
      messages.value.push({
        id: newId(),
        from: 'bot',
        parts: answer.parts,
        createdAt: Date.now()
      });
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Не удалось ответить';
    }

    persist();
  };

  return {
    messages,
    error,
    hydrate,
    send
  };
}
