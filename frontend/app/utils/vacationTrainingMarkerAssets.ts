export type MarkerAssetId = 'square' | 'standard' | 'wide';

export const MARKER_RING_SRC: Record<MarkerAssetId, string> = {
  square: '/images/vacation-training/marker-ring-1x1.png',
  standard: '/images/vacation-training/marker-ring-4x3.png',
  wide: '/images/vacation-training/marker-ring-16x9.png'
};

export const pickMarkerAsset = (rect: DOMRect): MarkerAssetId => {
  const ratio = rect.width / Math.max(rect.height, 1);
  if (ratio > 2.1) return 'wide';
  if (ratio < 1.2) return 'square';
  return 'standard';
};

export const markerPaddingForStep = (stepId: string | undefined) => {
  switch (stepId) {
    case 'balance':
      return { x: 14, y: 10 };
    case 'projection':
      return { x: 12, y: 10 };
    case 'manage-request':
      return { x: 14, y: 12 };
    case 'reservation-book':
      return { x: 10, y: 8 };
    case 'reservation-clarify':
      return { x: 12, y: 10 };
    case 'calendar':
      return { x: 22, y: 18 };
    case 'create':
      return { x: 16, y: 12 };
    case 'requests':
      return { x: 14, y: 12 };
    default:
      return { x: 16, y: 14 };
  }
};

/** Прямоугольник цифры баланса — по фактической ширине текста, не всей строки блока */
export const measureBalanceValueRect = (): DOMRect | null => {
  const card = document.querySelector('[data-tour="vac-balance"]');
  const value = card?.querySelector('.emp-balance-big');
  if (!value) return null;

  const range = document.createRange();
  range.selectNodeContents(value);
  const textRect = range.getBoundingClientRect();
  if (textRect.width > 0 && textRect.height > 0) return textRect;

  return value.getBoundingClientRect();
};

/** Прямоугольник текста «Рассчитать доступные дни к дате» */
export const measureProjectionSummaryRect = (): DOMRect | null => {
  const details = document.querySelector('[data-tour="vac-projection"]');
  const summary = details?.querySelector('.emp-projection-summary');
  if (!summary) return null;

  const range = document.createRange();
  range.selectNodeContents(summary);
  const textRect = range.getBoundingClientRect();
  if (textRect.width > 0 && textRect.height > 0) return textRect;

  return summary.getBoundingClientRect();
};

/** Прямоугольник заголовка «Мои заявки» */
export const measureRequestsHeadingRect = (): DOMRect | null => {
  const block = document.querySelector('[data-tour="vac-my-requests"]');
  const heading = block?.querySelector('.emp-requests-heading');
  if (!heading) return null;

  const range = document.createRange();
  range.selectNodeContents(heading);
  const textRect = range.getBoundingClientRect();
  if (textRect.width > 0 && textRect.height > 0) return textRect;

  return heading.getBoundingClientRect();
};

/** Кнопка «Создать заявку» в блоке предварительных броней */
export const measureReservationsClarifyRect = (): DOMRect | null => {
  const block = document.querySelector('[data-tour="vac-reservations-block"]');
  const btn = block?.querySelector('[data-tour="vac-reservation-clarify"]');
  if (!btn) return block?.getBoundingClientRect() ?? null;
  return btn.getBoundingClientRect();
};

/** Прямоугольник строки тулбара формы создания заявки (заголовок → кнопка «Создать») */
export const measureCreateToolbarUnderlineRect = (): DOMRect | null => {
  const form = document.querySelector('[data-tour="vac-create-form"]');
  if (!form) return null;

  const title = form.querySelector('.vac-emp-toolbar__title');
  const submit = form.querySelector('.vac-emp-btn, button[type="submit"]');
  if (!title || !submit) return null;

  const titleRect = title.getBoundingClientRect();
  const submitRect = submit.getBoundingClientRect();
  let rowBottom = Math.max(titleRect.bottom, submitRect.bottom);

  form.querySelectorAll('input.vac-emp-input').forEach((input) => {
    rowBottom = Math.max(rowBottom, input.getBoundingClientRect().bottom);
  });

  return new DOMRect(
    titleRect.left,
    titleRect.top,
    submitRect.right - titleRect.left,
    rowBottom - titleRect.top
  );
};

/** Волнистый овал «от руки» для обводки цифр баланса */
export const buildHandCirclePath = (width: number, height: number) => {
  const w = Math.max(width, 28);
  const h = Math.max(height, 28);
  const cx = w / 2;
  const cy = h / 2;
  const rx = w / 2 - 3;
  const ry = h / 2 - 3;

  return [
    `M ${cx} ${cy - ry}`,
    `C ${cx + rx * 0.58} ${cy - ry * 1.08}, ${cx + rx * 1.04} ${cy - ry * 0.42}, ${cx + rx} ${cy}`,
    `C ${cx + rx * 1.02} ${cy + ry * 0.45}, ${cx + rx * 0.54} ${cy + ry * 1.06}, ${cx} ${cy + ry}`,
    `C ${cx - rx * 0.56} ${cy + ry * 1.02}, ${cx - rx * 1.05} ${cy + ry * 0.4}, ${cx - rx} ${cy}`,
    `C ${cx - rx * 1.03} ${cy - ry * 0.38}, ${cx - rx * 0.52} ${cy - ry * 1.04}, ${cx} ${cy - ry}`
  ].join(' ');
};

/** Волнистая линия-подчёркивание «от руки» для шага с kind: underline */
export const buildHandUnderlinePath = (width: number, height = 12) => {
  const w = Math.max(width, 24);
  const baseY = height * 0.62;
  const lift = height * 0.28;
  const dip = height * 0.22;
  return [
    `M 0 ${baseY + 1.2}`,
    `C ${w * 0.12} ${baseY - lift}, ${w * 0.28} ${baseY + dip}, ${w * 0.42} ${baseY - 0.4}`,
    `S ${w * 0.72} ${baseY + lift * 0.85}, ${w * 0.86} ${baseY - dip * 0.5}`,
    `S ${w * 0.97} ${baseY + lift * 0.35}, ${w} ${baseY + 1}`
  ].join(' ');
};
