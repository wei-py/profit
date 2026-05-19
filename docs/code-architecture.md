# 项目代码架构文档

## 1. 项目概览

### 1.1 技术栈

| 层级          | 技术                        | 版本             |
| ------------- | --------------------------- | ---------------- |
| 框架          | Vue 3                       | ^3               |
| 状态管理      | Pinia                       | ^2               |
| 路由          | Vue Router                  | ^4               |
| 构建          | Vite                        | ^6               |
| CSS           | TailwindCSS ^4 + DaisyUI ^5 |
| 桌面          | Tauri                       | ^2               |
| 拖拽          | vue-draggable-next          | ^2.3.0           |
| Excel（配置） | xlsx（SheetJS）             | ^0.18            |
| Excel（列表） | exceljs + jszip             | ^4.4.0 / ^3.10.1 |
| 图片预览      | hevue-img-preview           | ^7.1.3           |
| 引导          | driver.js                   | ^1.4.0           |
| 工具          | xe-utils                    | ^4               |
| 日期          | dayjs                       | ^1               |
| 代码规范      | @antfu/eslint-config        | ^5               |

### 1.2 目录结构

```
src/
├── main.js              # 应用入口（Pinia + 路由 + 主题初始化）
├── App.vue              # 根组件（激活校验 + restoreLastPath）
├── style.css            # 全局样式
├── router/
│   └── index.js         # 路由定义
├── layouts/
│   └── DefaultLayout.vue # 主布局（顶栏 + 主题切换 + 引导）
├── pages/
│   ├── CountryPage.vue  # 配置页（890行，6个VueDraggableNext已修复）
│   ├── ListPage.vue     # 商品页（609行）
│   └── ActivationPage.vue # 激活页（84行，router.push 已修复）
├── stores/
│   ├── config.js        # 配置数据 Pinia store
│   ├── create.js        # 新建商品 Pinia store
│   ├── list.js          # 商品列表 Pinia store
│   └── activation.js    # 激活授权 Pinia store
├── services/
│   ├── excel-reader.js      # 配置 Excel 读取（SheetJS），含 @deprecated readListWorkbook
│   ├── excel-writer.js      # 配置 Excel 写入（SheetJS），含 @deprecated buildListWorkbookBuffer
│   ├── list-excel-reader.js # 商品列表 Excel 读取（ExcelJS+JSZip）
│   ├── list-excel-writer.js # 商品列表 Excel 写入（ExcelJS+JSZip+DISPIMG）
│   ├── rule-engine.js       # 费用计算引擎
│   ├── activation.js        # Tauri 激活 IPC
│   └── image-store.js       # 图片本地存储
├── composables/
│   ├── useFileIO.js     # 文件打开/保存（Tauri + 浏览器双实现）
│   ├── useTheme.js      # 主题切换与持久化
│   ├── useTour.js       # driver.js 引导步骤（⚠️ 部分步骤引用不存在的 DOM 属性）
│   └── useImageHost.js  # Tauri 本地图片管理
├── components/
│   └── common/
│       ├── FieldInput.vue       # 字段输入组件（下拉/布尔/数字/文本）
│       └── ImageUploader.vue    # 图片上传组件
```

### 1.3 路由图

```
/activate → ActivationPage.vue（独立路由，无布局）
/ → DefaultLayout.vue → redirect /list
  /country → CountryPage.vue（配置页）
  /list → ListPage.vue（商品页）
```

应用启动流程：

1. `main.js` — 读取 localStorage 主题，创建 Pinia + Router
2. `App.vue` — `onMounted` 检查激活状态，未激活跳转 `/activate`
3. 激活通过 → `restoreLastPath()` 尝试恢复上次打开的配置文件
4. `DefaultLayout.vue` — 顶栏导航（配置/商品）、主题切换、引导入口

---

## 2. 模块划分

### 模块 A：核心框架层

| 文件                      | 行数 | 职责                                       |
| ------------------------- | ---- | ------------------------------------------ |
| main.js                   | 20   | 应用创建、Pinia/Router 挂载、主题预加载    |
| App.vue                   | 35   | 激活校验、路径恢复、根 `<router-view>`     |
| router/index.js           | 21   | 路由定义：`/activate`、`/country`、`/list` |
| layouts/DefaultLayout.vue | 58   | 顶栏导航、主题切换、引导菜单               |
| style.css                 | —    | TailwindCSS 入口                           |

依赖关系：App.vue → activation store + useFileIO + useTheme；DefaultLayout → useTheme + useTour

### 模块 B：配置管理模块

| 文件                     | 行数 | 职责                                                                                                  |
| ------------------------ | ---- | ----------------------------------------------------------------------------------------------------- |
| stores/config.js         | 128  | Pinia store：7 个中文 key（与 Excel sheet 名一致）、loadFromBuffer、getExportBuffer、8 个便捷查询方法 |
| services/excel-reader.js | 60   | SheetJS 读取配置 xlsx → JSON 对象                                                                     |
| services/excel-writer.js | 53   | SheetJS 写入 JSON → xlsx ArrayBuffer                                                                  |
| pages/CountryPage.vue    | ~890 | 配置编辑页：国家表格、字段/选项组/模板拖拽列表（已修复）、6 个弹窗、条件树、确认弹窗                  |

核心数据结构（config store）：

- `国家平台`：`ref([])` — 国家配置行
- `计算字段`：`ref([])` — 字段定义行
- `选项组`：`ref([])` — 选项分组行
- `选项值`：`ref([])` — 选项值行
- `计算模板`：`ref([])` — 模板定义行
- `费用规则`：`ref([])` — 费率规则行
- `模板参数`：`ref([])` — 模板参数行
- `lookupTables`：`ref({})` — 动态费率表（key=表名, value=行数组）

### 模块 C：商品计算模块

| 文件                             | 行数 | 职责                                                            |
| -------------------------------- | ---- | --------------------------------------------------------------- |
| stores/create.js                 | 243  | Pinia store：国家/模板选择、SKU 生成、calculateAll、productRows |
| services/rule-engine.js          | 251  | 5 种计算方式（查表/百分比/固定值/加总/公式）、条件树求值        |
| components/common/FieldInput.vue | 59   | 字段输入渲染（下拉/布尔/数字/文本）                             |
| pages/ListPage.vue               | 609  | 商品页：新建面板 + SKU 表格 + 记录列表 + 反推计算               |

核心数据流（create store）：

- `selectCountry(id)` → `selectTemplate(id)` → `generateSkus()` → `calculateAll()` → `productRows()`
- `calculateAll()` 调用 `execute(rules, tables, mergedInputs)` 执行规则引擎

### 模块 D：商品列表模块

| 文件                          | 行数 | 职责                                                             |
| ----------------------------- | ---- | ---------------------------------------------------------------- |
| stores/list.js                | 83   | Pinia store：records + columnOrder、`_uid` 机制、syncColumnOrder |
| services/list-excel-reader.js | 144  | ExcelJS + JSZip 读取列表 xlsx（含 WPS DISPIMG 图片提取）         |
| services/list-excel-writer.js | 153  | ExcelJS + JSZip 写入列表 xlsx（含 WPS DISPIMG 图片注入）         |

### 模块 E：激活授权模块

| 文件                     | 行数 | 职责                                                           |
| ------------------------ | ---- | -------------------------------------------------------------- |
| stores/activation.js     | 164  | Pinia store：激活码验证、离线宽限期（7天）、Tauri Store 持久化 |
| services/activation.js   | 16   | Tauri IPC：`getFingerprint`、`activateCode`、`validateCode`    |
| pages/ActivationPage.vue | 84   | 激活页 UI（已改为 router.push 跳转）                           |

### 模块 F：基础设施层

| 文件                        | 行数 | 职责                                                               |
| --------------------------- | ---- | ------------------------------------------------------------------ |
| composables/useFileIO.js    | 162  | 双实现文件 I/O（Tauri dialog + File System Access API / fallback） |
| composables/useTheme.js     | 75   | 主题切换、localStorage + Tauri Store 持久化                        |
| composables/useTour.js      | 125  | driver.js 引导步骤定义（⚠️ 部分步骤引用不存在的 DOM 属性）         |
| composables/useImageHost.js | 137  | Tauri 本地图片：选择、保存、读取 base64                            |
| services/image-store.js     | 81   | 图片本地存储服务（Tauri fs / Web 仅 base64）                       |

---

## 3. 组件细分建议

### 3.1 CountryPage.vue (~890行) → 11 个子组件

CountryPage 是项目中最大的单文件组件，包含 6 个弹窗、6 个 VueDraggableNext 实例、条件树渲染、查表数据编辑等。

| 建议组件                 | 行数预估 | 职责                                            | 提取要点                                                    |
| ------------------------ | -------- | ----------------------------------------------- | ----------------------------------------------------------- |
| CountryTable.vue         | ~120     | 国家平台表格（展开/折叠行、动态列、编辑单元格） | `allKeys`、`expandedId`、`editingCell`、`addRow/deleteRow`  |
| FieldList.vue            | ~60      | 字段列表（拖拽排序 + CRUD）                     | `localFields`、`openNewField/openEditField`、拖拽实例       |
| FieldModal.vue           | ~80      | 字段编辑弹窗                                    | `fieldForm`、`editingFieldIdx`、`saveField/deleteField`     |
| OptionGroupList.vue      | ~50      | 选项组列表（拖拽排序）                          | `localOptGroups`、拖拽实例                                  |
| OptionGroupModal.vue     | ~120     | 选项组编辑弹窗（含选项值拖拽表格）              | `optForm`、`optItemsLocal`、拖拽排序表格                    |
| TemplateList.vue         | ~50      | 模板列表（拖拽排序）                            | `localTemplates`、拖拽实例                                  |
| TemplateModal.vue        | ~100     | 模板编辑弹窗（含规则表格 + 查表数据）           | `tplForm`、`tplRulesLocal`、查表数据表格                    |
| RuleEditorModal.vue      | ~150     | 规则编辑弹窗（条件树 + 计算配置）               | `ruleForm`、`condPool/condTree`、计算方式切换               |
| ConditionTree.vue        | ~80      | 条件树组件（AND/OR 递归渲染）                   | `flattenTree`、`addCond/addSubGroup/delNode/toggleGroupOp`  |
| LookupTableModal.vue     | ~80      | 查表数据弹窗（动态行列编辑）                    | `lookupRowsLocal`、`addLookupRow/addLookupCol/delLookupCol` |
| ConfigColEditorModal.vue | ~30      | 配置列编辑弹窗（拖拽排序）                      | `configColOrder`、拖拽实例                                  |

注意：各子组件间共享大量状态（`store`、`cpId`、`tplRulesLocal`、`condPool` 等），需要通过 props/emit 或 provide/inject 传递，拆分时需注意避免过度碎片化。

### 3.2 ListPage.vue (609行) → 6 个子组件

| 建议组件               | 行数预估 | 职责                                                      | 提取要点                                                                                          |
| ---------------------- | -------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| CreatePanel.vue        | ~180     | 新建商品面板（国家/模板选择 + 商品字段 + 变体 + SKU生成） | `enabledCountries/availableTemplates`、`handleCountryChange/handleTemplateChange`、商品级字段区域 |
| SkuTable.vue           | ~120     | SKU 表格（拖拽行排序 + 列编辑 + 图片上传）                | `skuColDisplay`、VueDraggableNext SKU 行、`openCalcModal`                                         |
| RecordList.vue         | ~80      | 商品记录列表（拖拽行排序 + 列编辑）                       | `listColumns`、VueDraggableNext 记录行、`loadRecordBack`                                          |
| ReverseCalcModal.vue   | ~60      | 反推计算弹窗                                              | `calcPrice/calcProfit/calcMargin`、`onCalcFieldChange`、二分搜索                                  |
| TraceModal.vue         | ~30      | 计算过程弹窗                                              | `traceField/traceSkuKey`                                                                          |
| ListColEditorModal.vue | ~30      | 列编辑弹窗                                                | `listStore.columnOrder` 拖拽排序                                                                  |

---

## 4. 数据流图

### 4.1 配置加载 → 计算 → 保存完整流程

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         配置加载流程                                     │
│                                                                         │
│  用户点击「打开配置」                                                     │
│       ↓                                                                 │
│  useFileIO.openConfigExcel()                                            │
│       ↓                                                                 │
│  Tauri dialog / browser picker → readFile → ArrayBuffer                │
│       ↓                                                                 │
│  configStore.loadFromBuffer(buffer, path)                               │
│       ↓                                                                 │
│  excel-reader.readWorkbookBuffer(buffer)                                │
│       ↓                                                                 │
│  SheetJS 解析 → 7 个 sheet JSON + lookupTables                          │
│       ↓                                                                 │
│  configStore 状态填充：国家平台/计算字段/选项组/选项值/计算模板/费用规则/模板参数 │
│       ↓                                                                 │
│  CountryPage 渲染国家表格                                                 │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                         商品计算流程                                     │
│                                                                         │
│  用户选择国家 → createStore.selectCountry(id)                            │
│       ↓                                                                 │
│  用户选择模板 → createStore.selectTemplate(id)                           │
│       ↓                                                                 │
│  自动加载默认值 → resetForTemplate()                                      │
│       ↓                                                                 │
│  用户填写商品级 + SKU级输入                                               │
│       ↓                                                                 │
│  generateSkus() — 笛卡尔积生成变体                                       │
│       ↓                                                                 │
│  calculateAll()                                                          │
│       ↓                                                                 │
│  rule-engine.execute(rules, lookupTables, mergedInputs)                 │
│       ↓                                                                 │
│  按计算顺序遍历费用规则：                                                  │
│    evalConditions → 条件树求值                                            │
│    → 查表/百分比/固定值/加总/公式 → 写入 results                          │
│       ↓                                                                 │
│  SKU.results 填充 → ListPage 渲染结果列                                   │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                         保存到列表流程                                    │
│                                                                         │
│  handleSaveToList()                                                      │
│       ↓                                                                 │
│  createStore.productRows() → 展平 SKU 为记录行                           │
│       ↓                                                                 │
│  listStore.addRecords(rows) → 每行加 _uid + syncColumnOrder              │
│       ↓                                                                 │
│  ListPage 渲染记录列表                                                    │
│       ↓                                                                 │
│  用户点击「保存列表」                                                      │
│       ↓                                                                 │
│  listStore.getExportBuffer()                                              │
│       ↓                                                                 │
│  list-excel-writer.buildListWorkbookBuffer(records, columnOrder)         │
│       ↓                                                                 │
│  ExcelJS + JSZip → xlsx（含 WPS DISPIMG 图片注入）                      │
│       ↓                                                                 │
│  useFileIO.saveListExcel() → 写入文件                                     │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Store 依赖关系图

```
activation store ← App.vue（启动校验）
      ↓
config store ← CountryPage（直接 mutate）
      ↓
create store ← ListPage（选择/计算/保存）
      ↓ ← configStore（查询字段/模板/规则）
list store ← ListPage（记录管理）
      ↓ ← configStore（columnOrder sync）
```

**关键问题**：CountryPage 直接 mutate config store 的 `ref` 数组（如 `store['国家平台'].push(r)`、`store['计算字段'][x] = {...fieldForm}`、`store['选项值'] = [...]`），绕过了 Pinia 的 action 模式。ListPage 通过 listStore 的 action 方法操作数据，模式更规范。

---

## 5. 已完成的重构

### 5.1 VueDraggableNext 6 处修复（CountryPage） ✅

CountryPage 原有 6 个 VueDraggableNext 实例，3 个完全损坏（computed 只读数组 + v-model），3 个有 item-key 问题。

| 实例           | 原用法                          | 问题                        | 修复                                                                                              |
| -------------- | ------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------- | --- | -------- |
| 字段列表       | `v-model="expFields"`           | computed 只读，v-model 无效 | `localFields` ref + watch expFieldsSource + `:list` + `@end="onFieldsDragEnd"` sync-back          |
| 选项组列表     | `v-model="expOptGroups"`        | computed 只读，v-model 无效 | `localOptGroups` ref + watch expOptGroupsSource + `:list` + `@end="onOptGroupsDragEnd"` sync-back |
| 模板列表       | `v-model="expTemplates"`        | computed 只读，v-model 无效 | `localTemplates` ref + watch expTemplatesSource + `:list` + `@end="onTemplatesDragEnd"` sync-back |
| 配置列排序弹窗 | `item-key="col"`                | 字符串数组无 `.col` 属性    | `:item-key="(item) => item"`                                                                      |
| 选项值表格     | `v-model` + `item-key="选项值"` | 选项值可重复                | `:list` + `_uid` 计数器 + `:item-key="(item) => item._uid"`                                       |
| 规则表格       | `v-model` + `item-key="编号"`   | 编号可为空                  | `:list` + `_uid` 计数器 + `:item-key="(r) => r.\_uid                                              |     | r.编号"` |

修复模式：对 computed 只读数组，创建 local ref + watch computed→local + `:list` + `@end` sync-back。避免 writable computed（会导致 Vue re-render 与 SortableJS DOM 操作冲突）。

### 5.2 死代码清理 ✅

| 已删除文件        | 原行数 | 原位置                   |
| ----------------- | ------ | ------------------------ |
| EditableTable.vue | 182    | `src/components/common/` |
| SkuTable.vue      | 165    | `src/components/common/` |
| validate.js       | 105    | `src/utils/`             |

已删除空目录：`src/components/create/`、`list/`、`option/`、`preset/`、`template/`、`src/utils/`

已标记 @deprecated：

- `excel-reader.js`: `readListWorkbook` — 被 `list-excel-reader.js` 替代
- `excel-writer.js`: `buildListWorkbookBuffer` — 被 `list-excel-writer.js` 替代

### 5.3 小修复 ✅

| 修复               | 原问题                        | 改动                                         |
| ------------------ | ----------------------------- | -------------------------------------------- |
| ActivationPage.vue | `window.location.href = '/'`  | 改为 `router.push('/')`，保持 SPA 路由一致性 |
| CountryPage.vue    | `confirm()` 浏览器原生弹窗    | 新增 `askConfirm()` + 自定义确认弹窗组件     |
| ListPage.vue       | `setTimeout(() => {...}, 50)` | 改为 `async/await nextTick()`，消除时序依赖  |

---

## 6. 待完成的重构建议

### 6.1 大文件拆分（优先级排序）

| 优先级 | 文件            | 行数 | 目标                        |
| ------ | --------------- | ---- | --------------------------- |
| P0     | CountryPage.vue | ~890 | 拆为 11 个子组件（见 §3.1） |
| P1     | ListPage.vue    | 609  | 拆为 6 个子组件（见 §3.2）  |
| P2     | rule-engine.js  | 251  | 将 5 个计算函数拆为独立模块 |

### 6.2 公式执行安全性

`rule-engine.js:240` 使用 `Function()` 构造器执行公式，仅有最小正则检查 `/^[\d\s+\-*/().]+$/.test(expr)`。

建议：

1. 使用安全数学表达式解析器（如 `math-expression-evaluator`、`mathjs` 受限模式）替代 `Function()`
2. 或增加更严格的白名单正则

### 6.3 统一 Excel I/O 库

当前使用两个 Excel 库：

- **SheetJS (xlsx)**：配置读写（无需图片功能，更轻量）
- **ExcelJS + JSZip**：列表读写（需要 WPS DISPIMG 图片嵌入）

建议保持双库方案，但应删除已废弃的 `readListWorkbook` 和 `buildListWorkbookBuffer`（已标记 @deprecated）。

### 6.4 其他待修复项

| 问题                          | 位置                                  | 建议                                                                  |
| ----------------------------- | ------------------------------------- | --------------------------------------------------------------------- |
| `catch {}` 空 catch           | activation.js:34, useFileIO.js:155 等 | 至少加 `console.warn`，便于排查                                       |
| useTour 步骤引用不存在属性    | useTour.js:10-33                      | `[data-tour="sidebar-nav"]` 等在 DefaultLayout 中不存在，需更新或删除 |
| CountryPage 直接 mutate store | CountryPage.vue 多处                  | 应改为通过 store action 操作，保持 Pinia 规范                         |
