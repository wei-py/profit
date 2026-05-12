const fs = require("node:fs");
const path = require("node:path");
const XLSX = require("xlsx");

// Field key replacements
const fieldMap = {
  category: "类目",
  commission_rate: "销售费率",
  fixed_additional_fee: "固定附加费",
  fixed_fee: "固定费用",
  is_free_shipping: "是否包邮",
  listing_type: "刊登类型",
  output_value: "输出值",
  range_1: "范围1",
  range_1_max: "范围1上限",
  range_1_min: "范围1下限",
  range_2: "范围2",
  range_2_max: "范围2上限",
  range_2_min: "范围2下限",
  sale_price: "售价",
  seller_shipping_cost: "卖家运费",
  shipping_fee: "运费",
  shipping_weight: "重量",
};

const files = [
  "docs/excel-rule-engine-example.xlsx",
  "docs/excel-rule-engine-example copy.xlsx",
  "public/examples/excel-rule-engine-example.xlsx",
];

function replaceKeysInJSON(jsonObj) {
  if (jsonObj === null || jsonObj === undefined)
    return jsonObj;
  if (typeof jsonObj !== "object") {
    if (typeof jsonObj === "string" && fieldMap[jsonObj]) {
      return fieldMap[jsonObj];
    }
    return jsonObj;
  }
  if (Array.isArray(jsonObj)) {
    return jsonObj.map(replaceKeysInJSON);
  }
  const result = {};
  for (const [key, value] of Object.entries(jsonObj)) {
    if (key === "input_map") {
      const newInputMap = {};
      for (const [colKey, fieldVal] of Object.entries(value)) {
        const newColKey = fieldMap[colKey] || colKey;
        const newFieldVal = fieldMap[fieldVal] || fieldVal;
        newInputMap[newColKey] = newFieldVal;
      }
      result[key] = newInputMap;
    }
    else if (key === "output_column") {
      result[key] = fieldMap[value] || value;
    }
    else if (key === "field") {
      result[key] = fieldMap[value] || value;
    }
    else {
      result[key] = replaceKeysInJSON(value);
    }
  }
  return result;
}

function processExcel(filePath) {
  console.log(`Processing: ${filePath}`);
  const wb = XLSX.readFile(filePath);
  let changed = false;

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(ws, {
      defval: "",
      header: 1,
    });
    if (data.length === 0)
      continue;

    let sheetChanged = false;

    // Process 'fields' sheet: replace field_key column
    if (sheetName === "fields") {
      const headers = data[0];
      const colIdx = headers.indexOf("field_key");
      if (colIdx >= 0) {
        for (let i = 1; i < data.length; i++) {
          const oldVal = data[i][colIdx];
          if (oldVal && fieldMap[String(oldVal)]) {
            data[i][colIdx] = fieldMap[String(oldVal)];
            sheetChanged = true;
          }
        }
      }
    }

    // Process 'rule_conditions' sheet: replace field_key column
    if (sheetName === "rule_conditions") {
      const headers = data[0];
      const colIdx = headers.indexOf("field_key");
      if (colIdx >= 0) {
        for (let i = 1; i < data.length; i++) {
          const oldVal = data[i][colIdx];
          if (oldVal && fieldMap[String(oldVal)]) {
            data[i][colIdx] = fieldMap[String(oldVal)];
            sheetChanged = true;
          }
        }
      }
    }

    // Process 'rule_actions' sheet: replace target_field and config_json
    if (sheetName === "rule_actions") {
      const headers = data[0];
      const targetIdx = headers.indexOf("target_field");
      const configIdx = headers.indexOf("config_json");

      for (let i = 1; i < data.length; i++) {
        if (targetIdx >= 0) {
          const oldVal = data[i][targetIdx];
          if (oldVal && fieldMap[String(oldVal)]) {
            data[i][targetIdx] = fieldMap[String(oldVal)];
            sheetChanged = true;
          }
        }
        if (configIdx >= 0) {
          const oldJson = data[i][configIdx];
          if (oldJson && typeof oldJson === "string" && oldJson.trim().startsWith("{")) {
            try {
              const parsed = JSON.parse(oldJson);
              const updated = replaceKeysInJSON(parsed);
              data[i][configIdx] = JSON.stringify(updated, null, 2);
              sheetChanged = true;
            }
            catch (e) {
              console.error(`  Warning: Failed to parse config_json in row ${i}: ${e.message}`);
            }
          }
        }
      }
    }

    // Process 'commission_table' sheet: replace column headers
    if (sheetName === "commission_table") {
      for (let j = 0; j < data[0].length; j++) {
        const oldHeader = data[0][j];
        if (oldHeader && fieldMap[String(oldHeader)]) {
          data[0][j] = fieldMap[String(oldHeader)];
          sheetChanged = true;
        }
      }
    }

    // Process 'shipping_cost_table' sheet: replace column headers
    if (sheetName === "shipping_cost_table") {
      for (let j = 0; j < data[0].length; j++) {
        const oldHeader = data[0][j];
        if (oldHeader && fieldMap[String(oldHeader)]) {
          data[0][j] = fieldMap[String(oldHeader)];
          sheetChanged = true;
        }
      }
    }

    if (sheetChanged) {
      changed = true;
      console.log(`  Updated sheet: ${sheetName}`);
      const newWs = XLSX.utils.aoa_to_sheet(data);
      // Copy cell formats/styles if any
      wb.Sheets[sheetName] = newWs;
    }
  }

  if (changed) {
    XLSX.writeFile(wb, filePath);
    console.log(`  Saved: ${filePath}`);
  }
  else {
    console.log(`  No changes needed`);
  }
}

for (const file of files) {
  const fullPath = path.resolve(__dirname, "..", file);
  if (fs.existsSync(fullPath)) {
    processExcel(fullPath);
  }
  else {
    console.log(`File not found: ${fullPath}`);
  }
}

console.log("\nDone. All Excel files updated.");
