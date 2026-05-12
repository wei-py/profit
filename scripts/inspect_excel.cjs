const path = require("node:path");
const XLSX = require("xlsx");

const files = [
  "docs/excel-rule-engine-example.xlsx",
  "docs/excel-rule-engine-example copy.xlsx",
  "public/examples/excel-rule-engine-example.xlsx",
];

for (const file of files) {
  const fullPath = path.resolve(__dirname, "..", file);
  const wb = XLSX.readFile(fullPath);
  console.log(`\n=== ${file} ===`);
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
    console.log(`\n--- Sheet: ${name} (rows: ${data.length}) ---`);
    if (data.length > 0) {
      console.log("Headers:", data[0]);
      for (let i = 1; i < Math.min(data.length, 5); i++) {
        console.log(`Row ${i}:`, data[i]);
      }
      if (data.length > 5) console.log(`... (${data.length - 5} more rows)`);
    }
  }
}
