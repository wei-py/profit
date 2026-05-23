import { driver } from "driver.js";
import "driver.js/dist/driver.css";

/** @type {object | null} driver.js 实例 */
let driverObj = null;

const COMMON_DRIVER_OPTIONS = {
  animate: true,
  closeBtnText: "关闭",
  doneBtnText: "完成",
  nextBtnText: "下一步",
  prevBtnText: "上一步",
  progressText: "{{current}} / {{total}}",
  showProgress: true,
};

/** 概览引导步骤配置 */
const overviewSteps = [
  {
    element: "[data-tour=\"app-tabs\"]",
    popover: {
      description:
        "顶部只有两个主入口：配置负责维护国家平台、字段、选项来源和模板；商品负责新建商品、计算 SKU 和维护商品记录。",
      side: "bottom",
      title: "主导航",
    },
  },
  {
    element: "[data-tour=\"app-help\"]",
    popover: {
      description:
        "右上角问号可以打开当前页面引导，也可以查看应用概览。每个弹窗和关键操作区域也有独立问号。",
      side: "bottom",
      title: "帮助入口",
    },
  },
  {
    element: "[data-tour=\"theme-toggle\"]",
    popover: {
      description: "点击切换浅色/深色模式。",
      side: "bottom",
      title: "主题切换",
    },
  },
];

const countrySteps = [
  {
    element: "[data-tour=\"country-toolbar\"]",
    popover: {
      description: "打开配置、保存配置、编辑列和添加列都在这里。远程配置只能读取，不能直接保存。",
      side: "bottom",
      title: "配置操作区",
    },
  },
  {
    element: "[data-tour=\"country-table\"]",
    popover: {
      description:
        "这里是一行一个国家平台。点击行或展开按钮可以进入该国家平台下的字段、选项来源和模板配置。",
      title: "国家平台列表",
    },
  },
  {
    element: "[data-tour=\"country-row-drag\"]",
    popover: {
      description: "拖动三条杠调整国家平台顺序。展开状态下拖动会先临时收起，结束后自动恢复。",
      title: "国家平台拖拽排序",
    },
  },
  {
    element: "[data-tour=\"country-fields\"]",
    popover: {
      description: "字段决定商品页会出现哪些输入项和输出项。字段可以拖拽排序，点击字段名可编辑。",
      title: "字段配置",
    },
  },
  {
    element: "[data-tour=\"country-options\"]",
    popover: {
      description:
        "选项来源用于下拉和树形选择器，比如商品类目、刊登类型、是否。支持拖拽排序和子级选项。",
      title: "选项来源",
    },
  },
  {
    element: "[data-tour=\"country-templates\"]",
    popover: {
      description:
        "模板把字段、查表数据和计算流程串起来。商品页选择模板后会按流程生成 SKU 和计算结果。",
      title: "模板配置",
    },
  },
];

const listSteps = [
  {
    element: "[data-tour=\"list-toolbar\"]",
    popover: {
      description: "打开/保存商品记录 Excel，也可以收起或展开新建商品面板。",
      side: "bottom",
      title: "商品页操作区",
    },
  },
  {
    element: "[data-tour=\"product-editor\"]",
    popover: {
      description:
        "这里是商品编辑区。平时为新建商品；从商品记录读取后会切换为修改商品，保存后替换原商品 ID 的整组记录。",
      title: "新建 / 修改商品",
    },
  },
  {
    element: "[data-tour=\"product-preset\"]",
    popover: {
      description: "先选国家平台，再选模板。模板会决定商品级字段、SKU 字段、计算规则和查表数据。",
      title: "国家平台和模板",
    },
  },
  {
    element: "[data-tour=\"product-fields\"]",
    popover: {
      description: "商品级字段会写入当前商品的所有 SKU，例如是否包邮、商品类目等。",
      title: "商品级字段",
    },
  },
  {
    element: "[data-tour=\"product-variants\"]",
    popover: {
      description: "填写颜色、尺码等变体属性，用竖线或逗号分隔多个值，然后生成 SKU。",
      title: "变体属性",
    },
  },
  {
    element: "[data-tour=\"product-actions\"]",
    popover: {
      description: "生成 SKU、计算费用和利润、保存到列表都在这里。修改商品时按钮会显示为保存修改。",
      title: "商品操作按钮",
    },
  },
  {
    element: "[data-tour=\"sku-toolbar\"]",
    popover: {
      description: "SKU 列表支持表格/卡片视图、编辑列和分页。表格与卡片都可以拖拽排序。",
      title: "SKU 列表操作区",
    },
  },
  {
    element: "[data-tour=\"sku-table\"]",
    popover: {
      description: "每行是一个 SKU。输入 SKU 级字段后点击计算；输出结果旁边的问号可查看计算过程。",
      title: "SKU 明细",
    },
  },
  {
    element: "[data-tour=\"records-toolbar\"]",
    popover: {
      description: "商品记录默认表格显示，可切换卡片、编辑显示列和分页查看。",
      title: "商品记录操作区",
    },
  },
  {
    element: "[data-tour=\"records-table\"]",
    popover: {
      description: "商品记录按商品 ID 分组显示斑马纹。同商品 ID 的多条 SKU 会作为一整块拖拽移动。",
      title: "商品记录列表",
    },
  },
  {
    element: "[data-tour=\"record-actions\"]",
    popover: {
      description: "点击复制图标会按商品 ID 读取整组 SKU 到上方编辑区；删除图标删除当前行。",
      title: "记录操作",
    },
  },
];

/** 兼容旧入口，同时映射到新的两页结构。 */
const tourSteps = {
  country: countrySteps,
  create: listSteps,
  field: countrySteps,
  list: listSteps,
  option: countrySteps,
  preset: countrySteps,
  template: countrySteps,
};

function getSteps(typeOrSteps) {
  if (Array.isArray(typeOrSteps))
    return typeOrSteps;
  return typeOrSteps === "overview" ? overviewSteps : tourSteps[typeOrSteps] || [];
}

function stepExists(step) {
  if (!step?.element)
    return true;
  if (typeof document === "undefined")
    return true;
  return !!document.querySelector(step.element);
}

export function useTour() {
  /**
   * 启动引导。参数可以是内置类型字符串，也可以是步骤数组。
   * @param {string | Array} typeOrSteps - 'overview'、'country'、'list' 或自定义步骤数组。
   */
  function startTour(typeOrSteps = "overview") {
    stopTour();

    const rawSteps = getSteps(typeOrSteps);
    const steps = rawSteps.filter(stepExists);

    if (steps.length === 0)
      return;

    driverObj = driver({
      ...COMMON_DRIVER_OPTIONS,
      steps,
    });

    driverObj.drive();
  }

  /** 停止并销毁当前引导实例。 */
  function stopTour() {
    if (driverObj) {
      driverObj.destroy();
      driverObj = null;
    }
  }

  return {
    startTour,
    stopTour,
  };
}
