import * as XLSX from "xlsx";

const STD_ORDER = ["国家平台", "计算字段", "选项组", "选项值", "计算模板", "费用规则", "模板参数"];

/**
 * 将配置对象序列化为 Excel ArrayBuffer。
 * @param {object} config
 * @returns {Uint8Array} Excel ArrayBuffer
 */
export function buildWorkbookBuffer(config) {
  const wb = XLSX.utils.book_new();
  const colOrder = config.国家平台ColOrder;

  for (const name of STD_ORDER) {
    const data = config[name];
    if (data && data.length) {
      if (name === "国家平台" && colOrder && colOrder.length) {
        const reordered = reorderKeys(data, colOrder);
        appendSheet(wb, name, reordered);
      } else {
        appendSheet(wb, name, data);
      }
    }
  }
  // 模板参数可为空
  if (config.模板参数 && !STD_ORDER.includes("模板参数")) {
    appendSheet(wb, "模板参数", config.模板参数);
  }

  // 动态费率表
  if (config.lookupTables) {
    for (const [name, data] of Object.entries(config.lookupTables)) {
      if (data && data.length) appendSheet(wb, name, data);
    }
  }

  return XLSX.write(wb, { bookType: "xlsx", type: "array" });
}

function reorderKeys(data, order) {
  return data.map((row) => {
    const result = {};
    for (const k of order) {
      if (k in row) result[k] = row[k];
    }
    for (const k of Object.keys(row)) {
      if (!(k in result)) result[k] = row[k];
    }
    return result;
  });
}

/**
 * @deprecated Use `list-excel-writer.js` instead — this version lacks WPS DISPIMG image
 * embedding and columnOrder support.
 */
export function buildListWorkbookBuffer(records) {
  const wb = XLSX.utils.book_new();
  if (records && records.length) {
    appendSheet(wb, "商品记录", records);
  } else {
    appendSheet(wb, "商品记录", []);
  }
  return XLSX.write(wb, { bookType: "xlsx", type: "array" });
}

function appendSheet(wb, name, data) {
  const ws = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, name);
}
