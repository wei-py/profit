import dayjs from "dayjs";
import XEUtils from "xe-utils";

const DISABLED_VALUES = new Set(["否", "FALSE", "false", "0", "停用", "disabled"]);
const EMPTY_VALUES = new Set(["", "42", null, undefined]);

export function normalizeText(value) {
  return String(value ?? "").trim();
}

export function normalizeId(value) {
  return normalizeText(value);
}

export function emptyToBlank(value) {
  return EMPTY_VALUES.has(value) ? "" : value;
}

export function isEnabled(row, fallback = true) {
  const raw = normalizeText(row?.启用 ?? (fallback ? "是" : "否"));
  return !DISABLED_VALUES.has(raw);
}

export function toArray(value) {
  return XEUtils.isArray(value) ? value : [];
}

export function toPlainObject(value) {
  return value && XEUtils.isPlainObject(value) ? value : {};
}

export function toNumber(value, fallback = 0) {
  if (value === "" || value === null || value === undefined)
    return fallback;
  const n = XEUtils.toNumber(value);
  return Number.isFinite(n) ? n : fallback;
}

export function toRate(value, fallback = 0) {
  const n = toNumber(value, fallback);
  if (!Number.isFinite(n))
    return fallback;
  return Math.abs(n) > 1 ? n / 100 : n;
}

export function isBlank(value) {
  if (value === null || value === undefined)
    return true;
  if (XEUtils.isArray(value))
    return value.length === 0;
  return normalizeText(value) === "";
}

export function cleanRow(row, headers = []) {
  const result = {};
  const source = toPlainObject(row);
  for (const key of headers) {
    if (!key)
      continue;
    result[key] = emptyToBlank(source[key] ?? "");
  }
  for (const [key, value] of Object.entries(source)) {
    if (!key || key.startsWith("__EMPTY"))
      continue;
    if (!(key in result))
      result[key] = emptyToBlank(value);
  }
  return result;
}

export function dropEmptyRows(rows, keyFields = []) {
  return toArray(rows).filter((row) => {
    const values = keyFields.length ? keyFields.map(key => row?.[key]) : Object.values(row || {});
    return values.some(value => !isBlank(emptyToBlank(value)));
  });
}

export function orderByNumber(rows, field, fallback = Number.MAX_SAFE_INTEGER) {
  return [...toArray(rows)].sort((a, b) => {
    const av = toNumber(a?.[field], fallback);
    const bv = toNumber(b?.[field], fallback);
    if (av !== bv)
      return av - bv;
    return normalizeText(a?.编号 || a?.名称 || a?.字段键).localeCompare(normalizeText(b?.编号 || b?.名称 || b?.字段键), "zh-Hans-CN");
  });
}

export function uniq(values) {
  return XEUtils.uniq(toArray(values).map(normalizeText).filter(Boolean));
}

export function nowText() {
  return dayjs().format("YYYY-MM-DD HH:mm:ss");
}

export function todayText() {
  return dayjs().format("YYYY-MM-DD");
}

export function readJson(value, fallback) {
  if (XEUtils.isPlainObject(value) || XEUtils.isArray(value))
    return value;
  const text = normalizeText(value);
  if (!text)
    return fallback;
  try {
    return JSON.parse(text);
  }
  catch {
    return fallback;
  }
}

export function writeJson(value) {
  return JSON.stringify(value ?? null);
}

export function parseDelimited(value) {
  return normalizeText(value)
    .split(/[|,，;；、\n]/)
    .map(s => s.trim())
    .filter(Boolean);
}

export function displayWidth(str) {
  return normalizeText(str).split("").reduce((sum, char) => sum + (/[^\x00-\xff]/.test(char) ? 2 : 1), 0);
}
