import { prepare, layout, prepareWithSegments, layoutWithLines } from "@chenglou/pretext";

const FONT_FAMILY =
  '-apple-system, BlinkMacSystemFont, "Helvetica Neue", "Segoe UI", Roboto, Arial, sans-serif';

export const FONT_BASE = `20px ${FONT_FAMILY}`;
export const FONT_TABLE_SM = `14px ${FONT_FAMILY}`;
export const FONT_TABLE_XS = `12px ${FONT_FAMILY}`;
export const LINE_HEIGHT_BASE = 28;
export const LINE_HEIGHT_TABLE_SM = 20;
export const LINE_HEIGHT_TABLE_XS = 17;

const prepareCache = new Map();

function getCacheKey(text, font) {
  return `${text}|${font}`;
}

function getPrepared(text, font) {
  const key = getCacheKey(text, font);
  if (prepareCache.has(key)) return prepareCache.get(key);
  const prepared = prepare(String(text), font);
  prepareCache.set(key, prepared);
  return prepared;
}

export function measureTextHeight(text, maxWidth, lineHeight = LINE_HEIGHT_BASE, font = FONT_BASE) {
  if (!text) return 0;
  const prepared = getPrepared(text, font);
  const { height } = layout(prepared, Number(maxWidth) || 200, lineHeight);
  return height;
}

export function measureTextLines(text, maxWidth, lineHeight = LINE_HEIGHT_BASE, font = FONT_BASE) {
  if (!text) return { lines: [], height: 0, lineCount: 0 };
  const key = `seg|${getCacheKey(text, font)}`;
  if (!prepareCache.has(key)) {
    const prepared = prepareWithSegments(String(text), font);
    prepareCache.set(key, prepared);
  }
  return layoutWithLines(prepareCache.get(key), Number(maxWidth) || 200, lineHeight);
}

export function clearTextMeasureCache() {
  prepareCache.clear();
}
