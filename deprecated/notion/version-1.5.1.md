# 版本 1.5.1

## 发布时间
2026-05-24

## 更新内容

### 计算配置重构
- 计算配置改为规则级 DAG 流程，支持一个模板包含多个规则
- 规则编辑器从画布改为普通表单布局，提升下拉选择和节点配置体验
- 计算节点改为可视化公式构造器，支持字段、节点、常量、运算符和括号组合
- 删除旧计算模型兼容层，Excel 一行一个规则

### 新建商品页重构
- 新建商品页重构为平台级、商品级、SKU级三段横向布局
- 新增平台级字段层级，商品ID和商品名称归入商品级
- SKU 变体属性改为小表格编辑，属性值支持逐个输入和删除，不再手写分隔符
- SKU 根据变体属性和 SKU 前缀自动生成，移除手动生成 SKU 按钮

### 优化
- 商品页表格/卡片视图切换增加本地持久化
- 更新弹窗日志支持换行显示，并优化长日志滚动展示
- 配置文件和商品计算统一使用 toPlain 深拷贝，避免 Vue Proxy 导致 Worker 报错

## 修复问题

- 修复 SKU 前缀变化、计算结果变化后列表不刷新的问题
- 修复计算按钮点击后被自动生成定时器覆盖结果的问题
- 修复配置导出和商品批量计算的 DataCloneError
- 修复 SKU 码前缀变化后表格不更新的问题
- 修复更新弹窗内注释日志 \n 不换行问题

## 涉及文件

```
src/domain/rule-graph.js            — calc 节点 formula 结构
src/services/graph-engine.js        — formula token 执行
src/components/country/RuleDagNodeConfig.vue  — 公式构造器 UI
src/components/country/RuleDagEditor.vue      — 规则名编辑
src/components/country/TemplateModal.vue      — 规则名移入编辑器
src/components/country/FieldModal.vue         — 新增平台级
src/constants/schema.js                       — FIELD_LEVELS 新增平台级
src/stores/create.js                          — platformFields
src/pages/ListPage.vue                        — 三段布局 + SKU优化
src/App.vue                                   — 更新日志换行
docs/default.xlsx                             — calc 节点迁移 formula
```

## 配置变更

- `计算配置` sheet 改为一行一个规则
- `计算配置` calc 节点从 expression 迁移到 formula token
- 新增平台级字段，旧数据不受影响

## 验证清单

- [x] pnpm build 通过
- [x] 配置导入正常
- [x] 配置导出正常
- [x] 商品计算正常
- [x] 规则编辑器工作正常
- [x] 公式构造器工作正常
- [x] 平台级/商品级/SKU级布局正常
- [x] SKU 自动生成正常
- [x] SKU 列表刷新正常
- [x] 表格/卡片切换持久化
- [x] 更新弹窗正常

## 发布备注

- 本次更新修改了大量核心逻辑，建议全面测试新建商品和计算功能
- 如果已有本地配置，建议重新导入默认 Excel

## Notion 关联

- [需求池 - 计算节点改为可视化公式构造器](#)
- [需求池 - 新建商品页三段横向布局](#)
- [需求池 - SKU 变体属性改为小表格](#)
- [需求池 - 更新弹窗日志支持换行](#)
- [需求池 - 新增平台级字段层级](#)
