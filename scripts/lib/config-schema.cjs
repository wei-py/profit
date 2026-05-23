const CONFIG_SHEETS = [
  "国家平台",
  "计算字段",
  "选项配置",
  "计算配置",
];
const REQUIRED_SHEETS = ["国家平台", "计算字段", "选项配置", "计算配置"];

const CONFIG_HEADERS = {
  国家平台: ["编号", "国家", "平台", "货币", "货币符号", "汇率", "启用", "排序", "备注"],
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
  计算配置: [
    "所属国家平台",
    "模板编号",
    "模板名称",
    "模板启用",
    "模板说明",
    "流程JSON",
  ],
  选项配置: ["所属国家平台", "选项值", "父级选项值", "父级选项值编号", "选项值编号", "排序", "启用", "备注"],
};

// 这些是前端实际依赖的核心列。其他 CONFIG_HEADERS 里的列是推荐列，缺失时只警告。
const REQUIRED_HEADERS = {
  国家平台: ["编号", "国家", "平台"],
  计算字段: ["字段键", "字段名称", "类型", "所属国家平台", "层级", "输入输出"],
  计算配置: ["所属国家平台", "模板编号", "模板名称", "流程JSON"],
  选项配置: ["所属国家平台", "选项值", "选项值编号"],
};

const CALC_METHODS = [];
const MATCH_MODES = ["精确", "区间", ""];
const CONDITION_OPERATORS = [
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
  "",
];

const IGNORED_EXTRA_SHEETS = new Set(["配置说明", "规则字典", "__meta__"]);

module.exports = {
  CALC_METHODS,
  CONDITION_OPERATORS,
  CONFIG_HEADERS,
  CONFIG_SHEETS,
  IGNORED_EXTRA_SHEETS,
  MATCH_MODES,
  REQUIRED_HEADERS,
  REQUIRED_SHEETS,
};
