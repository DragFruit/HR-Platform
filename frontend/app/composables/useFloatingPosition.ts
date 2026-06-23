import { nextTick, onUnmounted, reactive, ref, watch, type Ref } from 'vue';

export type FloatingPlacement = 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end';

type FloatingPositionOptions = {
  placement?: FloatingPlacement;
  offset?: number;
  flip?: boolean;
  viewportPadding?: number;
};

const flipVertical = (placement: FloatingPlacement): FloatingPlacement =>
  placement.startsWith('bottom')
    ? (placement.replace('bottom', 'top') as FloatingPlacement)
    : (placement.replace('top', 'bottom') as FloatingPlacement);

const flipHorizontal = (placement: FloatingPlacement): FloatingPlacement =>
  placement.endsWith('-start')
    ? (placement.replace('-start', '-end') as FloatingPlacement)
    : (placement.replace('-end', '-start') as FloatingPlacement);

const calcPosition = (
  placement: FloatingPlacement,
  anchorRect: DOMRect,
  popWidth: number,
  popHeight: number,
  offset: number
) => {
  switch (placement) {
    case 'bottom-start':
      return { top: anchorRect.bottom + offset, left: anchorRect.left };
    case 'bottom-end':
      return { top: anchorRect.bottom + offset, left: anchorRect.right - popWidth };
    case 'top-start':
      return { top: anchorRect.top - popHeight - offset, left: anchorRect.left };
    case 'top-end':
      return { top: anchorRect.top - popHeight - offset, left: anchorRect.right - popWidth };
  }
};

const fitsViewport = (
  coords: { top: number; left: number },
  popWidth: number,
  popHeight: number,
  padding: number
) => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  return (
    coords.top >= padding &&
    coords.left >= padding &&
    coords.top + popHeight <= vh - padding &&
    coords.left + popWidth <= vw - padding
  );
};

export function useFloatingPosition(
  anchorRef: Ref<HTMLElement | null>,
  popoverRef: Ref<HTMLElement | null>,
  open: Ref<boolean>,
  options: FloatingPositionOptions = {}
) {
  const {
    placement = 'bottom-start',
    offset = 10,
    flip = true,
    viewportPadding = 8
  } = options;

  const position = reactive({ top: 0, left: 0 });
  const resolvedPlacement = ref<FloatingPlacement>(placement);

  const updatePosition = () => {
    const anchor = anchorRef.value;
    if (!anchor) return;

    const anchorRect = anchor.getBoundingClientRect();
    const popover = popoverRef.value;
    const popWidth = popover?.offsetWidth || 260;
    const popHeight = popover?.offsetHeight || 120;

    const candidates: FloatingPlacement[] = flip
      ? [
          placement,
          flipVertical(placement),
          flipHorizontal(placement),
          flipVertical(flipHorizontal(placement))
        ]
      : [placement];

    for (const candidate of [...new Set(candidates)]) {
      const coords = calcPosition(candidate, anchorRect, popWidth, popHeight, offset);
      if (fitsViewport(coords, popWidth, popHeight, viewportPadding)) {
        position.top = coords.top;
        position.left = coords.left;
        resolvedPlacement.value = candidate;
        return;
      }
    }

    const fallback = calcPosition(placement, anchorRect, popWidth, popHeight, offset);
    position.top = Math.min(
      Math.max(viewportPadding, fallback.top),
      window.innerHeight - popHeight - viewportPadding
    );
    position.left = Math.min(
      Math.max(viewportPadding, fallback.left),
      window.innerWidth - popWidth - viewportPadding
    );
    resolvedPlacement.value = placement;
  };

  let rafId = 0;
  const scheduleUpdate = () => {
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(updatePosition);
  };

  const onScrollOrResize = () => scheduleUpdate();

  watch(open, async (isOpen) => {
    if (isOpen) {
      await nextTick();
      scheduleUpdate();
      window.addEventListener('scroll', onScrollOrResize, true);
      window.addEventListener('resize', onScrollOrResize);
    } else {
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    }
  });

  onUnmounted(() => {
    cancelAnimationFrame(rafId);
    window.removeEventListener('scroll', onScrollOrResize, true);
    window.removeEventListener('resize', onScrollOrResize);
  });

  return { position, resolvedPlacement, updatePosition: scheduleUpdate };
}

export function useDismissOnEscape(open: Ref<boolean>, onDismiss: () => void) {
  const onKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && open.value) {
      event.preventDefault();
      onDismiss();
    }
  };

  watch(open, (isOpen) => {
    if (isOpen) {
      document.addEventListener('keydown', onKeydown);
    } else {
      document.removeEventListener('keydown', onKeydown);
    }
  });

  onUnmounted(() => {
    document.removeEventListener('keydown', onKeydown);
  });
}
