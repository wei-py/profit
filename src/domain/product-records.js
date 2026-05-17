import { SYSTEM_ROW_KEYS } from "@/constants/schema";
import { nowText, normalizeId, parseDelimited } from "@/utils/value";

export function normalizeProductId(value) {
  return normalizeId(value);
}

export function makeRecordProductKey(row) {
  return normalizeProductId(row?.商品ID) || `__row_${row?._uid || ""}`;
}

export function groupRecordsByProductId(records, productId, fallbackRow) {
  const target = normalizeProductId(productId);
  if (!target)
    return fallbackRow ? [fallbackRow] : [];
  return (records || []).filter(row => normalizeProductId(row?.商品ID) === target);
}

export function inferVariantAttributes(rows, fields = []) {
  const knownKeys = new Set(SYSTEM_ROW_KEYS);
  for (const field of fields || [])
    knownKeys.add(field.字段键);

  const candidateKeys = [];
  for (const row of rows || []) {
    for (const key of Object.keys(row || {})) {
      if (!knownKeys.has(key) && !candidateKeys.includes(key))
        candidateKeys.push(key);
    }
  }

  return candidateKeys
    .map((key) => {
      const values = [];
      for (const row of rows || []) {
        const value = normalizeId(row?.[key]);
        if (value && !values.includes(value))
          values.push(value);
      }
      return {
        name: key,
        values: values.join("|"),
      };
    })
    .filter(attr => attr.name && attr.values);
}

export function makeVariantKeyFromRow(row, attrs) {
  return (attrs || []).map(attr => normalizeId(row?.[attr.name])).join(",");
}

export function makeVariantKeyFromAttrs(values, attrs) {
  return (attrs || []).map(attr => normalizeId(values?.[attr.name])).join(",");
}

export function normalizeVariantValues(value) {
  return normalizeId(value).replace(/[,，、]/g, "|");
}

export function parseVariantValues(value) {
  return parseDelimited(value);
}

export function buildProductRows({ productId, productName, selectedCountryId, selectedTemplateId, productInputs, skus, calculatedAt }) {
  const time = calculatedAt || nowText();
  return (skus || []).map(sku => ({
    SKU码: sku.skuCode || "",
    商品ID: productId || "",
    商品名称: productName || "",
    国家平台编号: selectedCountryId || "",
    模板编号: selectedTemplateId || "",
    ...(sku.attrs || {}),
    ...(productInputs || {}),
    ...(sku.inputs || {}),
    ...(sku.results || {}),
    图片: sku.images || "",
    计算时间: time,
  }));
}
