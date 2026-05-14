import ExcelJS from "exceljs";

const STD_ORDER = ["国家平台", "计算字段", "选项组", "选项值", "计算模板", "费用规则", "模板参数"];
const MIN_W = 8;
const MAX_W = 30;
const PAD = 2;

export async function buildWorkbookBuffer(config) {
  const wb = new ExcelJS.Workbook();
  const colOrder = config.国家平台ColOrder;

  for (const name of STD_ORDER) {
    const data = config[name];
    if (data && data.length) {
      if (name === "国家平台" && colOrder && colOrder.length) {
        const reordered = reorderKeys(data, colOrder);
        appendSheet(wb, name, reordered);
      }
      else {
        appendSheet(wb, name, data);
      }
    }
  }

  if (config.lookupTables) {
    for (const [name, data] of Object.entries(config.lookupTables)) {
      if (data && data.length)
        appendSheet(wb, name, data);
    }
  }

  return new Uint8Array(await wb.xlsx.writeBuffer());
}

function reorderKeys(data, order) {
  return data.map((row) => {
    const result = {};
    for (const k of order) {
      if (k in row)
        result[k] = row[k];
    }
    for (const k of Object.keys(row)) {
      if (!(k in result))
        result[k] = row[k];
    }
    return result;
  });
}

function appendSheet(wb, name, data) {
  const ws = wb.addWorksheet(name);
  const centerAlign = { horizontal: "center", vertical: "middle" };

  const keys = Object.keys(data[0] || {});
  ws.columns = keys.map(k => ({ header: k, key: k }));

  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true };
  headerRow.eachCell((cell) => {
    cell.alignment = centerAlign;
  });

  for (const row of data) {
    const r = ws.addRow(keys.map(k => row[k] ?? ""));
    r.eachCell((cell) => {
      cell.alignment = centerAlign;
    });
  }

  ws.columns.forEach((col, i) => {
    let maxW = displayWidth(keys[i] || "");
    for (const row of data) {
      const val = row[keys[i]];
      if (val != null)
        maxW = Math.max(maxW, displayWidth(String(val)));
    }
    col.width = Math.max(MIN_W, Math.min(MAX_W, maxW + PAD));
  });
}

function displayWidth(str) {
  if (!str) return 0;
  let w = 0;
  for (const ch of str) {
    w += /[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/.test(ch) ? 2 : 1;
  }
  return w;
}