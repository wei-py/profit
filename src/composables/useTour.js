import { driver } from 'driver.js'
import 'driver.js/dist/driver.css'

let driverObj = null

const commonSteps = [
  {
    element: '[data-tour="sidebar-nav"]',
    popover: {
      title: '页面导航',
      description: '"利润工具"共有6个功能页面：预设、选项、字段、模板、新建、列表。点击即可切换。',
      side: 'right',
    },
  },
  {
    element: '[data-tour="sidebar-collapse"]',
    popover: {
      title: '收起侧边栏',
      description: '点击汉堡菜单可折叠侧边栏，为主内容区腾出更多空间。',
      side: 'right',
    },
  },
  {
    element: '[data-tour="theme-toggle"]',
    popover: {
      title: '主题切换',
      description: '点击可切换浅色/深色模式，适合不同光线环境使用。',
      side: 'right',
    },
  },
]

const tourSteps = {
  preset: [
    { element: '[data-tour="preset-toolbar"]', popover: { title: '打开配置 / 新建预设', description: '首次使用需先"打开配置"Excel文件。已有配置后可"新建预设"并"保存配置"。' } },
    { element: '[data-tour="preset-search"]', popover: { title: '搜索预设', description: '输入关键词可快速筛选预设列表，支持按名称、国家搜索。' } },
    { element: '[data-tour="preset-list"]', popover: { title: '预设列表', description: '展示所有已创建的预设，点击可查看和编辑其参数。' } },
    { element: '[data-tour="preset-param-table"]', popover: { title: '预设参数', description: '为预设定义参数列表。点击"补全默认参数"可快速从字段导入。' } },
  ],
  option: [
    { element: '[data-tour="option-toolbar"]', popover: { title: '管理选项分组', description: '选项分组用于为选择型字段提供下拉选项，如颜色、尺寸等。' } },
    { element: '[data-tour="option-group-list"]', popover: { title: '分组列表', description: '点击分组可查看和编辑其下的选项项。' } },
    { element: '[data-tour="option-item-table"]', popover: { title: '选项项', description: '为分组添加具体选项，设置显示名、值和排序。' } },
  ],
  field: [
    { element: '[data-tour="field-table"]', popover: { title: '字段定义', description: '定义所有可用字段的键、名称、类型等信息。字段会在预设参数和规则条件中被引用。' } },
  ],
  template: [
    { element: '[data-tour="template-ruleset-list"]', popover: { title: '规则集', description: '选择规则集，一个规则集包含多条规则。' } },
    { element: '[data-tour="template-rule-list"]', popover: { title: '规则列表', description: '规则定义了条件的组合方式与满足后执行的动作，按优先级排序。' } },
    { element: '[data-tour="template-tabs"]', popover: { title: '条件与动作 / 查找表', description: '切换编辑规则的条件与动作，或管理查找表数据。' } },
    { element: '[data-tour="template-condition-tree"]', popover: { title: '条件树', description: '以树形结构组织条件，支持 AND/OR 逻辑组合，可嵌套分组。' } },
    { element: '[data-tour="template-action-list"]', popover: { title: '动作列表', description: '条件满足时执行的动作，支持赋值、查表、分支三种类型。' } },
    { element: '[data-tour="template-lookup-list"]', popover: { title: '查找表', description: '用于"查表"动作匹配的数据表，支持精确匹配和区间匹配。' } },
  ],
  create: [
    { element: '[data-tour="create-preset-select"]', popover: { title: '选择预设', description: '选择一个已启用的预设作为计算模板。' } },
    { element: '[data-tour="create-basic-info"]', popover: { title: '基础信息', description: '填写产品名称、款号、成本和重量等基本信息。' } },
    { element: '[data-tour="create-params"]', popover: { title: '输入参数', description: '根据预设定义的参数填写具体数值。' } },
    { element: '[data-tour="create-calculate"]', popover: { title: '执行计算', description: '点击"计算"按钮，系统将根据预设规则自动计算利润等结果。' } },
    { element: '[data-tour="create-results"]', popover: { title: '计算结果', description: '查看计算结果，可点击"保存到列表"将记录存入列表页。' } },
  ],
  list: [
    { element: '[data-tour="list-toolbar"]', popover: { title: '操作列表', description: '打开或加载列表 Excel 文件，保存修改。' } },
    { element: '[data-tour="list-table"]', popover: { title: '记录列表', description: '展示所有保存的记录，支持查看详情、编辑和删除操作。' } },
  ],
}

export function useTour() {
  function startTour(routeName) {
    stopTour()

    const steps = [
      ...commonSteps,
      ...(tourSteps[routeName] || []),
    ]

    driverObj = driver({
      showProgress: true,
      animate: true,
      doneBtnText: '完成',
      closeBtnText: '关闭',
      nextBtnText: '下一步',
      prevBtnText: '上一步',
      progressText: '{{current}} / {{total}}',
      steps,
    })

    driverObj.drive()
  }

  function stopTour() {
    if (driverObj) {
      driverObj.destroy()
      driverObj = null
    }
  }

  return { startTour, stopTour }
}
