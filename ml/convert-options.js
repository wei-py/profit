/** 将源 Excel 的类目树，转换成截图里的“选项值”格式 Excel。 安装依赖： npm i exceljs 使用方式： node convert-options.js input.xlsx output.xlsx 巴西_美客多 只生成“商品类目”，不生成“广告类型”和“是/否”： node convert-options.js input.xlsx output.xlsx 巴西_美客多 --no-static 修改商品类目的根节点名称： node convert-options.js input.xlsx output.xlsx 巴西_美客多 --root=商品类目 */

import ExcelJS from "exceljs";

function cellText(value) {
  if (value === null || value === undefined)
    return "";

  if (typeof value === "object") {
    if (Array.isArray(value.richText)) {
      return value.richText.map(item => item.text || "").join("").trim();
    }

    if (value.text !== undefined) {
      return String(value.text).trim();
    }

    if (value.result !== undefined) {
      return cellText(value.result);
    }

    if (value instanceof Date) {
      return value.toISOString().slice(0, 10);
    }
  }

  return String(value).trim();
}

function colByHeader(headerMap, candidates) {
  for (const name of candidates) {
    const key = Object.keys(headerMap).find(
      header => header.toLowerCase() === name.toLowerCase(),
    );

    if (key)
      return headerMap[key];
  }

  return null;
}

function parseArgs(argv) {
  const input = argv[2];
  const output = argv[3];

  let platform = "巴西_美客多";
  let includeStatic = true;
  let categoryRoot = "商品类目";

  for (const arg of argv.slice(4)) {
    if (arg === "--no-static") {
      includeStatic = false;
    }
    else if (arg.startsWith("--root=")) {
      categoryRoot = arg.slice("--root=".length) || categoryRoot;
    }
    else {
      platform = arg;
    }
  }

  if (!input || !output) {
    console.error(
      "用法: node convert-options.js input.xlsx output.xlsx [所属国家平台] [--no-static] [--root=商品类目]",
    );
    process.exit(1);
  }

  return {
    categoryRoot,
    includeStatic,
    input,
    output,
    platform,
  };
}

async function main() {
  const {
    categoryRoot,
    includeStatic,
    input,
    output,
    platform,
  } = parseArgs(process.argv);

  const sourceWb = new ExcelJS.Workbook();
  await sourceWb.xlsx.readFile(input);

  const sourceWs = sourceWb.worksheets[0];

  if (!sourceWs) {
    throw new Error("源 Excel 没有工作表");
  }

  /** 读取源 Excel 表头。 这个脚本默认源 Excel 至少有这些列： id parentId chCatName 或 catName 关系说明： id 是当前节点 ID parentId 是父节点 ID chCatName 是中文类目名 catName 是英文类目名 */
  const headerMap = {};

  sourceWs.getRow(1).eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const header = cellText(cell.value);
    if (header) {
      headerMap[header] = colNumber;
    }
  });

  const idCol = colByHeader(headerMap, ["id", "ID"]);
  const parentIdCol = colByHeader(headerMap, [
    "parentId",
    "parent_id",
    "Parent ID",
  ]);

  const cnNameCol = colByHeader(headerMap, [
    "chCatName",
    "中文名称",
    "中文类目",
    "选项值",
  ]);

  const enNameCol = colByHeader(headerMap, [
    "catName",
    "name",
    "英文名称",
    "英文类目",
  ]);

  if (!idCol) {
    throw new Error("找不到 id 列");
  }

  if (!parentIdCol) {
    throw new Error("找不到 parentId 列");
  }

  if (!cnNameCol && !enNameCol) {
    throw new Error("找不到 chCatName / catName / 选项值 列");
  }

  const nodes = [];
  const byId = new Map();

  for (let r = 2; r <= sourceWs.rowCount; r++) {
    const row = sourceWs.getRow(r);

    const id = cellText(row.getCell(idCol).value);

    if (!id || byId.has(id)) {
      continue;
    }

    const parentId = cellText(row.getCell(parentIdCol).value);
    const cnName = cnNameCol ? cellText(row.getCell(cnNameCol).value) : "";
    const enName = enNameCol ? cellText(row.getCell(enNameCol).value) : "";

    const optionValue = cnName || enName || id;

    const node = {
      id,
      optionValue,
      parentId,
      sourceRow: r,
    };

    nodes.push(node);
    byId.set(id, node);
  }

  /** 用 id / parentId 还原父子关系。 例子： id = MLB1747, parentId = MLB5726 表示： MLB1747 是 MLB5726 的子级 */
  const children = new Map();

  for (const node of nodes) {
    children.set(node.id, []);
  }

  const roots = [];

  for (const node of nodes) {
    if (node.parentId && byId.has(node.parentId)) {
      children.get(node.parentId).push(node);
    }
    else {
      roots.push(node);
    }
  }

  /** 排序规则： 同一个父级下面，按照源 Excel 的原始行顺序排序。 最终输出的“排序”字段： 每个父级下面从 1 开始。 */
  roots.sort((a, b) => a.sourceRow - b.sourceRow);

  for (const list of children.values()) {
    list.sort((a, b) => a.sourceRow - b.sourceRow);
  }

  const outputRows = [];

  function addOption(optionValue, parentValue = "", parentCode = "", sort = 1, remark = "") {
    const optionCode = parentCode ? `${parentCode} / ${optionValue}` : optionValue;

    outputRows.push({
      enabled: "是",
      optionCode,
      optionValue,
      parentCode,
      parentValue,
      platform,
      remark,
      sort,
    });

    return optionCode;
  }

  /** 截图里的固定选项： 广告类型 高级 经典 */
  if (includeStatic) {
    const adCode = addOption("广告类型", "", "", 1);

    addOption("高级", "广告类型", adCode, 1);
    addOption("经典", "广告类型", adCode, 2);
  }

  /** 类目根节点： 商品类目 美容 个护 家居 ... */
  const categoryRootSort = includeStatic ? 2 : 1;
  const categoryRootCode = addOption(categoryRoot, "", "", categoryRootSort);

  function walk(node, parentValue, parentCode, sort, pathIds = []) {
    if (pathIds.includes(node.id)) {
      console.warn(`检测到循环父子关系，已跳过节点: ${node.id}`);
      return;
    }

    const optionCode = addOption(
      node.optionValue,
      parentValue,
      parentCode,
      sort,
    );

    const nextPathIds = pathIds.concat(node.id);
    const list = children.get(node.id) || [];

    list.forEach((child, index) => {
      walk(child, node.optionValue, optionCode, index + 1, nextPathIds);
    });
  }

  roots.forEach((root, index) => {
    walk(root, categoryRoot, categoryRootCode, index + 1);
  });

  /** 截图里的固定选项： 是/否 是 否 */
  if (includeStatic) {
    const boolCode = addOption("是/否", "", "", 3);

    addOption("是", "是/否", boolCode, 1);
    addOption("否", "是/否", boolCode, 2);
  }

  const outWb = new ExcelJS.Workbook();
  const outWs = outWb.addWorksheet("选项值");

  outWs.columns = [
    { header: "所属国家平台", key: "platform", width: 18 },
    { header: "选项值", key: "optionValue", width: 22 },
    { header: "父级选项值", key: "parentValue", width: 22 },
    { header: "父级选项值编号", key: "parentCode", width: 38 },
    { header: "选项值编号", key: "optionCode", width: 55 },
    { header: "排序", key: "sort", width: 10 },
    { header: "启用", key: "enabled", width: 10 },
    { header: "备注", key: "remark", width: 18 },
  ];

  outputRows.forEach((item) => {
    outWs.addRow(item);
  });

  /** 样式：尽量贴近你截图里的格式。 */
  outWs.views = [{ state: "frozen", ySplit: 1 }];

  outWs.getRow(1).font = {
    bold: true,
  };

  outWs.getRow(1).height = 24;

  for (let r = 1; r <= outWs.rowCount; r++) {
    const row = outWs.getRow(r);

    row.height = r === 1 ? 24 : 22;

    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.alignment = {
        horizontal: "center",
        vertical: "middle",
        wrapText: true,
      };

      cell.border = {
        bottom: {
          color: { argb: "BFC7D8" },
          style: "thin",
        },
        left: {
          color: { argb: "BFC7D8" },
          style: "thin",
        },
        right: {
          color: { argb: "BFC7D8" },
          style: "thin",
        },
        top: {
          color: { argb: "BFC7D8" },
          style: "thin",
        },
      };
    });
  }

  await outWb.xlsx.writeFile(output);

  console.log(`转换完成: ${output}`);
  console.log(`输出行数: ${outputRows.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
