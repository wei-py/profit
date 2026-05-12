import { driver } from 'driver.js'
import 'driver.js/dist/driver.css'

/** @type {object | null} driver.js 实例 */
let driverObj = null

/** 概览引导步骤配置 */
const overviewSteps = [
  {
    element: '[data-tour="sidebar-nav"]',
    popover: {
      title: '页面导航',
      description: '利润工具有6个功能页：预设、选项、字段、模板、新建、列表。点击切换页面。',
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
      description: '点击切换浅色/深色模式，适合不同光线环境。',
      side: 'right',
    },
  },
]

/** 各页面引导步骤配置 */
const tourSteps = {
  preset: [
    {
      element: '[data-tour="preset-toolbar"]',
      popover: {
        title: '操作按钮',
        description:
          '"打开配置"加载Excel配置文件；"新建预设"创建新预设；"保存配置"将修改写回Excel。',
      },
    },
    {
      element: '[data-tour="preset-search"]',
      popover: {
        title: '搜索预设',
        description: '输入关键词可快速筛选预设列表，支持按名称、国家搜索。',
      },
    },
    {
      element: '[data-tour="preset-list"]',
      popover: {
        title: '预设列表',
        description: '展示所有已创建的预设，点击选中后可查看和编辑右侧参数。',
      },
    },
    {
      element: '[data-tour="preset-detail-header"]',
      popover: {
        title: '预设信息',
        description: '显示当前预设的名称、国家/平台，可点击"编辑"修改基本信息或"删除"。',
        side: 'left',
      },
    },
    {
      element: '[data-tour="preset-param-table"]',
      popover: {
        title: '参数表格',
        description:
          '为预设定义参数列表。列含义：名称、类型、单位、字段键、选项组、默认值、排序、必填。',
        side: 'left',
      },
    },
    {
      element: '[data-tour="preset-fill-defaults"]',
      popover: {
        title: '补全默认参数',
        description: '点击自动从"字段"页导入所有尚未添加的字段作为参数，避免逐个手动添加。',
        side: 'top',
      },
    },
    {
      element: '[data-tour="preset-edit-modal"]',
      popover: {
        title: '编辑预设弹窗',
        description: '修改预设名称、国家、平台、规则集和启用状态，点击保存生效。',
      },
    },
  ],
  option: [
    {
      element: '[data-tour="option-toolbar"]',
      popover: {
        title: '操作按钮',
        description: '"新建分组"创建选项分组（如颜色、尺寸）；"保存配置"写回Excel。',
      },
    },
    {
      element: '[data-tour="option-group-list"]',
      popover: { title: '分组列表', description: '展示所有选项分组，点击分组可编辑右侧选项项。' },
    },
    {
      element: '[data-tour="option-detail-header"]',
      popover: {
        title: '分组信息',
        description: '显示当前分组名称和说明，可点击"编辑"修改或"删除"。',
        side: 'left',
      },
    },
    {
      element: '[data-tour="option-item-table"]',
      popover: {
        title: '选项项表格',
        description:
          '为分组添加具体选项。列含义：显示名（下拉显示的文本）、值（实际存储的值）、排序、启用、备注。',
        side: 'left',
      },
    },
    {
      element: '[data-tour="option-edit-modal"]',
      popover: { title: '编辑分组弹窗', description: '修改分组名称和说明，保存后更新列表。' },
    },
  ],
  field: [
    {
      element: '[data-tour="field-toolbar"]',
      popover: { title: '操作按钮', description: '"打开配置"加载Excel；"保存配置"写回。' },
    },
    {
      element: '[data-tour="field-table-header"]',
      popover: {
        title: '表格列说明',
        description:
          '字段键（唯一标识）、字段名（显示名称）、类型（text/number/select/boolean/date/image）、单位、选项组ID、规则模式（input/output/both）、必填。',
      },
    },
    {
      element: '[data-tour="field-table-body"]',
      popover: {
        title: '编辑字段',
        description: '直接在表格中增删改行，修改后点击"保存配置"持久化。',
      },
    },
  ],
  template: [
    {
      element: '[data-tour="template-ruleset-list"]',
      popover: {
        title: '规则集',
        description: '选择规则集作为规则的容器。一个规则集对应预设中的"规则集"字段。',
      },
    },
    {
      element: '[data-tour="template-rule-list"]',
      popover: {
        title: '规则列表',
        description: '展示当前规则集下的所有规则，按优先级排序。点击"+"新建规则。',
      },
    },
    {
      element: '[data-tour="template-rule-detail"]',
      popover: {
        title: '规则信息',
        description: '显示当前规则的说明、优先级和启用状态。可编辑或删除此规则。',
      },
    },
    {
      element: '[data-tour="template-tabs"]',
      popover: {
        title: '选项卡',
        description: '"条件与动作"编辑规则逻辑；"查找表"管理数据映射表。',
      },
    },
    {
      element: '[data-tour="template-condition-tree"]',
      popover: {
        title: '条件树',
        description: '以树形结构组织触发条件。点击"+ 根分组"创建顶层条件组，支持 AND/OR 逻辑嵌套。',
      },
    },
    {
      element: '[data-tour="template-condition-detail"]',
      popover: {
        title: '添加条件',
        description: '在条件组下添加具体条件：选择字段、运算符（=、!=、区间等）、值和排序。',
      },
    },
    {
      element: '[data-tour="template-action-list"]',
      popover: {
        title: '动作列表',
        description:
          '条件满足后执行的动作。支持赋值（set）、查表（lookup）、分支（branch）三种类型。',
      },
    },
    {
      element: '[data-tour="template-action-detail"]',
      popover: {
        title: '编辑动作',
        description: '设置动作类型、目标字段和配置参数。查表动作需指定查找表。',
      },
    },
    {
      element: '[data-tour="template-lookup-list"]',
      popover: {
        title: '查找表',
        description: '管理用于"查表"动作的数据映射表。支持精确匹配和区间匹配两种模式。',
      },
    },
  ],
  create: [
    {
      element: '[data-tour="create-preset-select"]',
      popover: {
        title: '选择预设',
        description: '从已启用的预设中选择一个作为计算模板。预设决定了参数列表和计算规则。',
      },
    },
    {
      element: '[data-tour="create-basic-info"]',
      popover: {
        title: '基础信息',
        description: '填写产品的基本属性：名称、款号（SKU）、成本（元）、重量（g）。',
      },
    },
    {
      element: '[data-tour="create-params"]',
      popover: {
        title: '输入参数',
        description: '根据预设定义的参数填写具体数值。参数类型和单位由预设决定。',
      },
    },
    {
      element: '[data-tour="create-calculate"]',
      popover: {
        title: '执行计算',
        description: '点击"计算"按钮，系统按规则引擎自动计算利润等结果，在右侧面板显示。',
      },
    },
    {
      element: '[data-tour="create-results"]',
      popover: {
        title: '计算结果',
        description: '展示计算后的各项指标。如果结果满意，可点击"保存到列表"将记录持久化。',
      },
    },
    {
      element: '[data-tour="create-images"]',
      popover: {
        title: '图片',
        description: '粘贴图片URL（多个用逗号分隔），下方可预览图片缩略图。',
      },
    },
    {
      element: '[data-tour="create-variants"]',
      popover: {
        title: '变体',
        description: '以JSON格式输入产品变体，如颜色、尺寸的组合，系统将生成变体列表。',
      },
    },
    {
      element: '[data-tour="create-preset-info"]',
      popover: {
        title: '预设信息',
        description: '显示当前预设的详细信息：名称、国家、平台、关联的规则集。',
      },
    },
  ],
  list: [
    {
      element: '[data-tour="list-toolbar"]',
      popover: {
        title: '操作按钮',
        description: '"打开列表Excel"加载已有数据；"保存"将修改写回Excel。上方显示当前文件路径。',
      },
    },
    {
      element: '[data-tour="list-filepath"]',
      popover: {
        title: '文件路径',
        description: '显示当前加载的列表Excel文件路径，确认操作的是正确文件。',
      },
    },
    {
      element: '[data-tour="list-table"]',
      popover: {
        title: '记录列表',
        description:
          '以表格展示所有记录，每行显示前8列。点击"查看"查看完整详情，"编辑"修改，"删除"移除。',
      },
    },
    {
      element: '[data-tour="list-detail-modal"]',
      popover: {
        title: '记录详情',
        description: '弹窗展示记录的全部字段。切换到编辑模式可直接修改数据并保存。',
      },
    },
  ],
}

export function useTour() {
  /**
   * 启动引导，停止当前引导后按类型选择步骤。
   * @param {string} type - 引导类型（'overview' 或页面名）
   */
  function startTour(type) {
    stopTour()

    const steps = type === 'overview' ? overviewSteps : tourSteps[type] || []

    if (steps.length === 0)
      return

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

  /** 停止并销毁当前引导实例。 */
  function stopTour() {
    if (driverObj) {
      driverObj.destroy()
      driverObj = null
    }
  }

  return { startTour, stopTour }
}
