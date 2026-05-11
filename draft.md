⏺ 让我把 ListPage 涉及的所有文件都读一遍，给你完整的介绍。

Read 6 files (ctrl+o to expand)

⏺ 下面是商品列表页面的完整架构介绍，你可以直接参考移植到其他项目。

---

商品列表模块：完整架构

整体数据流

Excel配置文件 ──→ config store ──→ CreatePanel (表单+计算) ──→ list store ──→ 商品记录表格
│ │
rule-engine Excel导出

两个独立的 Excel 文件、两个 Store 各管各的：

┌────────────────────────────┬─────────────┬──────────────────────────────────────────┐
│ 文件 │ Store │ 用途 │
├────────────────────────────┼─────────────┼──────────────────────────────────────────┤
│ 配置工作簿 (config.xlsx) │ configStore │ 国家平台、模板、费用规则、字段定义、选项 │
├────────────────────────────┼─────────────┼──────────────────────────────────────────┤
│ 商品工作簿 (products.xlsx) │ listStore │ 每次计算保存的 SKU 商品记录 │
└────────────────────────────┴─────────────┴──────────────────────────────────────────┘

---

一、ListPage.vue（页面主体）

文件：src/pages/ListPage.vue

3 个区域从上到下：

┌─ 工具栏 ────────────────────────────────────────┐
│ [国家平台▾] [模板▾] [打开配置] [打开商品] [保存] [清空] │
└────────────────────────────────────────────────┘
┌─ CreatePanel（新建面板，可折叠）─────────────────┐
│ 商品信息(字段表单) + 变体属性 + SKU表格 + [计算] [保存到列表] │
└────────────────────────────────────────────────┘
┌─ 商品记录表格 ──────────────────────────────────┐
│ 动态列（从所有行 keys 的并集生成）│ 每行可删除 │
└────────────────────────────────────────────────┘

工具栏的关键联动逻辑：

- 选择国家平台 → 模板下拉框自动过滤该国家的模板 → configStore.selectCountry(id)
- 选择模板后 CreatePanel 才会渲染：v-if="configStore.loaded && configStore.selectedTemplateId"
- "打开配置"：加载 config.xlsx，解析到 configStore
- "打开商品"：加载已有 products.xlsx，解析到 listStore.rows，设置绑定路径
- "保存商品"：已绑定路径→直接覆写文件；未绑定→弹窗让用户选位置+命名

商品记录表格：

// 列是动态的——取所有行 key 的并集
const listColumns = computed(() => {
const keys = new Set()
for (const row of listStore.rows) {
for (const key of Object.keys(row)) keys.add(key)
}
return [...keys]
})

每行是一个 SKU，列包括：商品ID、商品名称、国家平台、模板编号、SKU码、变体属性（颜色/尺码等）、商品级输入值、SKU级输入值、所有
计算结果、计算时间。

---

二、configStore（配置数据中心）

文件：src/stores/config.js

核心数据和计算属性：

// 原始数据（从 Excel 解析来）
countryPlatforms // 国家平台列表
calcFields // 计算字段（定义每个国家有哪些输入/输出字段）
optionGroups // 选项组（下拉选项的分组）
optionItems // 选项值（具体的下拉选项）
calcTemplates // 计算模板（每个国家下可有多个模板）
feeRules // 费用规则（模板下的计费规则，最重要）
templateParams // 模板参数（字段默认值）
lookupTables // 费率表（如运费表、佣金表）

// 关键计算属性（链式过滤）
enabledCountryPlatforms // 启用 + 按排序号排列的国家
templatesByCountry // 当前选中国家的模板列表
fieldsByCountry // 当前选中国家的字段列表
productInputFields // 字段中 level=商品级 + io=输入
skuInputFields // 字段中 level=SKU级 + io=输入
skuOutputFields // 字段中 level=SKU级 + io=输出
selectedTemplateRules // 当前选中模板的规则（按 order 排序）

联动链路：

选国家(id) → 过滤模板列表、过滤字段列表、过滤选项列表
选模板(id) → 过滤费用规则、加载模板参数默认值

---

三、createStore（新建商品状态）

文件：src/stores/create.js

核心状态：

productId // 商品ID（手动填）
productName // 商品名称
productInputs // 商品级字段值（reactive对象，key=字段键）
variantAttributes // 变体属性 [{name:'颜色', values:'红,蓝'}, {name:'尺码', values:'S,M'}]
skus // SKU数组（笛卡尔积生成）
lastCalculatedAt // 上次计算时间

核心方法链：

resetForTemplate(configStore)
├─ 清空 productInputs
├─ 按模板参数设置默认值
└─ 调用 generateSkus(configStore)

generateSkus(configStore)
├─ 对变体属性做笛卡尔积 → 生成 SKU 组合
├─ 每个 SKU 的 inputs 填入示例值或默认值
└─ 写入 skus[]

calculateAll(configStore)
├─ 遍历每个 SKU
├─ 合并输入: { ...productInputs, ...sku.inputs }
├─ 调用 executeRules({ feeRules, lookupTables, inputs, fieldKeys })
└─ 写入 results / traces / errors

productRows(configStore)
└─ 展平 SKU → 用于保存到 listStore 的格式
{ 商品ID, 商品名称, 国家平台, 模板编号, SKU码, ...attrs, ...inputs, ...results }

笛卡尔积实现：

// 颜色:红,蓝 + 尺码:S,M → [{颜色:'红',尺码:'S'}, {颜色:'红',尺码:'M'}, ...]
function cartesian(attributes) {
if (!attributes.length) return [{}]
return attributes.reduce((rows, attr) =>
rows.flatMap(row => attr.values.map(v => ({ ...row, [attr.name]: v }))),
[{}]
)
}

---

四、listStore（商品记录列表）

文件：src/stores/list.js

rows // 已保存的商品 SKU 行数组
filePath // 绑定的 Excel 文件路径（空=未绑定）
fileName // 从路径提取的文件名（显示用）

appendRows(nextRows) // 追加行（CreatePanel 保存到列表时用）
removeRow(index) // 删除一行
clearRows() // 清空
loadRows(newRows) // 从 Excel 加载（覆盖）
setFilePath(path) // 设置绑定路径

---

五、CreatePanel.vue（新建面板）

文件：src/components/list/CreatePanel.vue

布局：左右两栏

┌──── 左栏 (22rem) ────┐ ┌──── 右栏（自适应）──────────────────┐
│ 基本信息 │ │ SKU 表格 │
│ 商品ID [____] │ │ ┌──────────────────────────────┐ │
│ 商品名称 [____] │ │ │SKU码│颜色│尺码│售价│成本│图片│..│ │
│ │ │ ├────┼────┼────┼────┼────┼────┤ │
│ 商品级字段 │ │ │红-S │ 红 │ S │ 99 │ 25 │🖼️ │ │
│ 刊登类型 [▾] │ │ │红-M │ 红 │ M │109 │ 28 │🖼️ │ │
│ 商品类目 [▾] │ │ └──────────────────────────────┘ │
│ 是否包邮 [▾] │ │ │
│ │ │ [生成SKU] [计算] [保存到列表] │
│ 变体属性 │ │ │
│ 颜色: [红,蓝] [✕] │ │ │
│ 尺码: [S,M] [✕] │ │ │
│ [+添加变体属性] │ │ │
└──────────────────────┘ └────────────────────────────────────┘

关键联动：

- 切换国家/模板时 watch 自动调用 resetForTemplate，重新生成字段和 SKU
- "生成SKU" → generateSkus（用笛卡尔积重新生成，保留输入值）
- "计算" → calculateAll（逐SKU调用规则引擎）
- "保存到列表" → 先计算（如未计算），再 listStore.appendRows(productRows)

---

六、SkuTable.vue（SKU 变体表格）

文件：src/components/common/SkuTable.vue

动态列结构：

┌───────┬──────┬────────────────────────┬──────┬─────────────────────────┬──────┐
│ SKU码 │ 变体 │ (inputFields...动态列) │ 图片 │ (outputFields...动态列) │ 状态 │
├───────┼──────┼────────────────────────┼──────┼─────────────────────────┼──────┤
└───────┴──────┴────────────────────────┴──────┴─────────────────────────┴──────┘

- 输入列可编辑（number 或 text input）
- 输出列只读（计算结果），利润率自动格式化 41.47%
- 状态列：✅已计算 / ⏳未计算 / ❌错误
- 列完全由 configStore.skuInputFields 和 configStore.skuOutputFields 决定，不写死

---

七、FieldInput.vue（动态字段渲染器）

文件：src/components/common/FieldInput.vue

根据字段的 type 渲染不同控件：

┌──────────────┬─────────────────────────────────────────────────────────┐
│ type │ 控件 │
├──────────────┼─────────────────────────────────────────────────────────┤
│ 下拉 │ <select> + 选项来自 configStore.optionItemsForGroup(id) │
├──────────────┼─────────────────────────────────────────────────────────┤
│ 数字 │ <input type="number" step="0.01"> │
├──────────────┼─────────────────────────────────────────────────────────┤
│ 布尔 │ <input type="checkbox" class="toggle"> │
├──────────────┼─────────────────────────────────────────────────────────┤
│ 文本（默认） │ <input type="text"> │
└──────────────┴─────────────────────────────────────────────────────────┘

通过 v-model 双向绑定到 createStore.productInputs[field.key]。

---

八、文件 IO（useFileIO.js）

文件：src/composables/useFileIO.js

// 配置工作簿
openConfigFile(configStore) // 打开 → 解析 → 设置 sourcePath
saveConfigFile(configStore) // 已绑定→直接覆写 / 未绑定→弹窗选路径

// 商品工作簿
openProductFile(listStore) // 打开 → 解析 → loadRows → 设置 filePath
saveProducts(listStore) // 已绑定→直接覆写 / 未绑定→弹窗选路径命名

Tauri 环境：用原生 dialog + fs 插件，对话框选路径后直接读写
浏览器环境：用 <input type="file"> 选文件 + <a download> 触发下载

---

九、移植清单

如果要在其他项目使用这套架构，你需要的文件：

src/
├── stores/
│ ├── config.js ← Excel配置加载后的数据中心
│ ├── create.js ← 新建面板状态 + 笛卡尔积 + 计算调度
│ └── list.js ← 商品行存储 + 文件路径绑定
├── services/
│ ├── excel-reader.js ← SheetJS 读取解析 Excel
│ ├── excel-writer.js ← SheetJS 序列化写入 Excel
│ └── rule-engine.js ← 费用计算引擎（核心）
├── composables/
│ └── useFileIO.js ← 文件对话框 + 读写（Tauri/浏览器双模式）
├── components/
│ ├── common/
│ │ ├── FieldInput.vue ← 动态字段渲染（下拉/数字/布尔/文本）
│ │ └── SkuTable.vue ← SKU变体表格
│ └── list/
│ └── CreatePanel.vue ← 新建面板
├── pages/
│ └── ListPage.vue ← 页面主体
└── utils/
└── value.js ← isBlank, toNumber, toBoolean 等工具函数

依赖库：xlsx（SheetJS）、pinia、dayjs、vue-router、@tauri-apps/plugin-dialog、@tauri-apps/plugin-fs
