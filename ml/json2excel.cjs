const fs = require("node:fs");
const ExcelJS = require("exceljs");

const inputFile = "./input.json";
const outputFile = "./output.xlsx";

function normalizeRoots(json) {
  // 支持 JSON 根节点是数组，或单个对象
  return Array.isArray(json) ? json : [json];
}

function flattenTree(nodes, parent = null, parentPath = [], parentChPath = []) {
  const rows = [];

  for (const node of nodes || []) {
    const currentPath = [...parentPath, node.catName || ""].filter(Boolean);
    const currentChPath = [...parentChPath, node.chCatName || ""].filter(Boolean);

    const row = {
      catName: node.catName || "",
      chCatName: node.chCatName || "",
      chPath: currentChPath.join(" / "),
      classic: node.classic ?? "",
      id: node.id || "",
      isLeaf:
        typeof node.isLeaf === "boolean"
          ? node.isLeaf
          : !(node.children && node.children.length),
      level: node.level ?? "",
      parentId: parent?.id || "",
      parentName: parent?.catName || "",
      path: currentPath.join(" / "),
      premium: node.premium ?? "",
    };

    rows.push(row);

    if (Array.isArray(node.children) && node.children.length > 0) {
      rows.push(...flattenTree(node.children, node, currentPath, currentChPath));
    }
  }

  return rows;
}

async function jsonToExcel() {
  const raw = fs.readFileSync(inputFile, "utf8");
  const json = JSON.parse(raw);

  const roots = normalizeRoots(json);
  const rows = flattenTree(roots);

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("categories");

  worksheet.columns = [
    { header: "id", key: "id", width: 14 },
    { header: "parentId", key: "parentId", width: 14 },
    { header: "level", key: "level", width: 8 },
    { header: "catName", key: "catName", width: 28 },
    { header: "chCatName", key: "chCatName", width: 24 },
    { header: "classic", key: "classic", width: 10 },
    { header: "premium", key: "premium", width: 10 },
    { header: "isLeaf", key: "isLeaf", width: 10 },
    { header: "parentName", key: "parentName", width: 24 },
    { header: "path", key: "path", width: 60 },
    { header: "chPath", key: "chPath", width: 60 },
  ];

  worksheet.addRows(rows);

  // 表头样式
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.alignment = { horizontal: "center", vertical: "middle" };

  // 冻结首行
  worksheet.views = [{ state: "frozen", ySplit: 1 }];

  // 自动筛选
  worksheet.autoFilter = {
    from: "A1",
    to: "K1",
  };

  // 单元格边框和对齐
  worksheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.alignment = {
        horizontal: "center",
        vertical: "middle",
        wrapText: false,
      };

      cell.border = {
        bottom: { style: "thin" },
        left: { style: "thin" },
        right: { style: "thin" },
        top: { style: "thin" },
      };
    });
  });

  // path / chPath 左对齐
  worksheet.getColumn("path").alignment = { horizontal: "left" };
  worksheet.getColumn("chPath").alignment = { horizontal: "left" };

  await workbook.xlsx.writeFile(outputFile);

  console.log(`导出成功：${outputFile}`);
  console.log(`总行数：${rows.length}`);
}

jsonToExcel().catch((err) => {
  console.error("导出失败：", err);
  process.exit(1);
});
