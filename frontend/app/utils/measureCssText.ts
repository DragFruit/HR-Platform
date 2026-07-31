/** Canvas-замер ширины текста (колонка ФИО в календарях отпусков). */

let measureCtx: CanvasRenderingContext2D | null = null;

const getMeasureCtx = () => {
  if (typeof document === 'undefined') return null;
  if (measureCtx) return measureCtx;
  const canvas = document.createElement('canvas');
  measureCtx = canvas.getContext('2d');
  return measureCtx;
};

export const buildFontFromStyle = (style: CSSStyleDeclaration | null, fallback: string) => {
  if (!style) return fallback;
  const font = style.font?.trim();
  if (font) return font;
  const weight = style.fontWeight || '600';
  const size = style.fontSize || '12px';
  const family = style.fontFamily || 'sans-serif';
  return `${weight} ${size} ${family}`;
};

export const measureCssText = (text: string, font: string, letterSpacingPx = 0) => {
  const ctx = getMeasureCtx();
  if (!ctx) return text.length * 8;
  ctx.font = font;
  const base = ctx.measureText(text).width;
  if (!letterSpacingPx || text.length < 2) return base;
  return base + letterSpacingPx * (text.length - 1);
};
