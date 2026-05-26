import { normalizeId } from "@/utils/value";

export function dedupeOptionConfigs(rows) {
  const map = new Map();
  for (const row of rows) {
    const countryId = normalizeId(row.所属国家平台 || "");
    const nodeId = (row.选项值编号 || "").trim();
    if (!countryId || !nodeId)
      continue;
    const key = `${countryId}\u0000${nodeId}`;
    map.set(key, row);
  }
  const result = [];
  for (const row of rows) {
    const countryId = normalizeId(row.所属国家平台 || "");
    const nodeId = (row.选项值编号 || "").trim();
    if (!countryId || !nodeId) {
      result.push(row);
      continue;
    }
    const key = `${countryId}\u0000${nodeId}`;
    if (map.get(key) === row)
      result.push(row);
  }
  return result;
}
