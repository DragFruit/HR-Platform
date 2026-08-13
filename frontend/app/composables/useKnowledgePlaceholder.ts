export function useKnowledgePlaceholder(phrases: string[]) {
  const text = ref('');
  const idle = ref(true);

  let timer: ReturnType<typeof setTimeout> | null = null;
  let cancelled = false;
  let queue: string[] = [];
  let index = 0;

  const clearTimer = () => {
    if (!timer) return;
    clearTimeout(timer);
    timer = null;
  };

  const typePhrase = (phrase: string) => {
    text.value = '';
    let i = 0;
    const step = () => {
      if (cancelled || !idle.value) return;
      if (i <= phrase.length) {
        text.value = phrase.slice(0, i);
        i += 1;
        timer = setTimeout(step, 36);
        return;
      }
      timer = setTimeout(nextPhrase, 5000);
    };
    step();
  };

  const nextPhrase = () => {
    if (cancelled || !idle.value || !queue.length) return;
    index = (index + 1) % queue.length;
    typePhrase(queue[index] ?? '');
  };

  const start = () => {
    if (!phrases.length) return;
    const offset = Math.floor(Math.random() * phrases.length);
    queue = phrases.map((_, i) => phrases[(offset + i) % phrases.length] ?? '');
    index = 0;
    typePhrase(queue[0] ?? '');
  };

  const stop = () => {
    idle.value = false;
    clearTimer();
    text.value = '';
  };

  onMounted(start);
  onBeforeUnmount(() => {
    cancelled = true;
    clearTimer();
  });

  return { text, idle, stop };
}
