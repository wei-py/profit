export const CONFIG_SHEET_NAMES = [
  "国家平台",
  "计算字段",
  "选项组",
  "选项值",
  "计算模板",
  "费用规则",
  "模板参数",
];

export const REQUIRED_CONFIG_SHEETS = [
  "国家平台",
  "计算字段",
  "选项组",
  "选项值",
  "计算模板",
  "费用规则",
];

export const META_SHEET_NAME = "__meta__";
export const LIST_SHEET_NAME = "商品记录";

export const CONFIG_HEADERS = {
  国家平台: ["编号", "国家", "平台", "货币", "货币符号", "汇率", "启用", "排序", "备注"],
  模板参数: ["模板编号", "字段键", "默认值", "必填", "说明"],
  计算字段: [
    "字段键",
    "字段名称",
    "类型",
    "单位",
    "选项组编号",
    "所属国家平台",
    "层级",
    "输入输出",
    "必填",
    "默认值",
    "说明",
  ],
  计算模板: ["编号", "名称", "所属国家平台", "启用", "说明"],
  费用规则: [
    "编号",
    "所属模板",
    "输出字段键",
    "费用名称",
    "计算顺序",
    "启用",
    "条件1字段",
    "条件1运算符",
    "条件1值",
    "条件1值2",
    "条件2字段",
    "条件2运算符",
    "条件2值",
    "条件2值2",
    "条件3字段",
    "条件3运算符",
    "条件3值",
    "条件3值2",
    "条件4字段",
    "条件4运算符",
    "条件4值",
    "条件4值2",
    "条件结构",
    "条件数据",
    "计算方式",
    "查表名称",
    "匹配方式",
    "输入映射",
    "输出列",
    "百分比基数",
    "百分比值",
    "百分比来源字段",
    "固定金额",
    "加总字段",
    "公式",
    "累加",
    "说明",
  ],
  选项值: ["所属分组", "选项值", "显示名", "排序", "启用", "备注"],
  选项组: ["编号", "名称", "所属国家平台", "父级编号", "父级选项值", "排序", "说明"],
};

export const YES_NO_OPTIONS = ["是", "否"];

export const CALC_METHOD_OPTIONS = ["查表", "百分比", "固定值", "加总", "公式"];
export const MATCH_MODE_OPTIONS = ["精确", "区间"];

export const CONDITION_OPERATOR_OPTIONS = [
  "等于",
  "不等于",
  "大于",
  "大于等于",
  "小于",
  "小于等于",
  "包含",
  "不包含",
  "为空",
  "不为空",
  "介于",
  "不介于",
  "属于",
  "不属于",
  "开头是",
  "结尾是",
];

export const FIELD_TYPES = ["文本", "数字", "下拉", "布尔", "日期"];
export const FIELD_LEVELS = ["商品级", "SKU级"];
export const IO_TYPES = ["输入", "输出"];

export const BUILTIN_FORMULA_HELPERS = [
  { label: "IF(条件,真,假)", value: "IF()" },
  { label: "SUM(字段...)", value: "SUM()" },
  { label: "ROUND(值,位数)", value: "ROUND()" },
  { label: "MIN(值...)", value: "MIN()" },
  { label: "MAX(值...)", value: "MAX()" },
  { label: "ABS(值)", value: "ABS()" },
  { label: "PCT(值)", value: "PCT()" },
];

export const SYSTEM_ROW_KEYS = new Set([
  "SKU码",
  "商品ID",
  "商品名称",
  "国家平台编号",
  "模板编号",
  "图片",
  "计算时间",
  "_uid",
]);
