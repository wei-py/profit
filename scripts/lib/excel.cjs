const fs = require("node:fs");
const path = require("node:path");
const XLSX = require("xlsx");
const XEUtils = require("xe-utils");
const { CONFIG_HEADERS } = require("./config-schema.cjs");

function normalizeText(value) {
  return String(value ?? "").trim();
}

function readWorkbook(filePath) {
  return XLSX.readFile(filePath, { cellDates: false });
}

function sheetToRows(wb, sheetName) {
  const ws = wb.Sheets[sheetName];
  return ws ? XLSX.utils.sheet_to_json(ws, { defval: "", raw: false }) : [];
}

function rowsToSheet(rows, preferredHeaders = []) {
  const headers = collectHeaders(rows, preferredHeaders);
  const data = [headers, ...rows.map(row => headers.map(header => row?.[header] ?? ""))];
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws["!cols"] = headers.map((header, index) => ({
    wch: Math.max(8, Math.min(34, displayWidth(header, rows, index) + 2)),
  }));
  return ws;
}

function writeWorkbook(filePath, sheets) {
  const wb = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    const headers = CONFIG_HEADERS[name] || [];
    XLSX.utils.book_append_sheet(wb, rowsToSheet(rows, headers), safeSheetName(name));
  }
  ensureDir(path.dirname(filePath));
  XLSX.writeFile(wb, filePath, { bookType: "xlsx" });
}

function collectHeaders(rows, preferredHeaders = []) {
  const headers = [];
  const seen = new Set();
  for (const header of preferredHeaders) {
    if (header && !seen.has(header)) {
      headers.push(header);
      seen.add(header);
    }
  }
  for (const row of rows || []) {
    for (const key of Object.keys(row || {})) {
      if (key && !seen.has(key)) {
        headers.push(key);
        seen.add(key);
      }
    }
  }
  return headers;
}

function cleanRows(rows, sheetName = "") {
  const headers = CONFIG_HEADERS[sheetName] || [];
  return (rows || [])
    .map((row) => {
      const next = {};
      for (const header of headers)
        next[header] = normalizeCell(row?.[header]);
      for (const [key, value] of Object.entries(row || {})) {
        if (key && !(key in next))
          next[key] = normalizeCell(value);
      }
      return next;
    })
    .filter(row => Object.values(row).some(value => normalizeText(value)));
}

function normalizeCell(value) {
  const text = normalizeText(value);
  return text === "42" ? "" : value;
}

function displayWidth(header, rows, index) {
  const values = [header, ...(rows || []).map(row => Object.values(row || {})[index])];
  return XEUtils.max(values.map(value => normalizeText(value).split("").reduce((sum, char) => sum + (/[^\x00-\xff]/.test(char) ? 2 : 1), 0))) || 8;
}

function safeSheetName(name) {
  return String(name || "Sheet").replace(/[\\/?*\[\]:]/g, "_").slice(0, 31);
}

function ensureDir(dir) {
  if (!fs.existsSync(dir))
    fs.mkdirSync(dir, { recursive: true });
}

module.exports = { cleanRows, readWorkbook, sheetToRows, writeWorkbook };
