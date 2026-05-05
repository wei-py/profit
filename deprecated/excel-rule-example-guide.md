# Excel 规则驱动示例说明

这份说明对应示例文件：`public/examples/excel-rule-engine-example.xlsx`

如果你想先看整体关系，再看这份逐表说明，先打开：

`docs/excel-rule-architecture.md`

如果你想专门看这个示例工作簿里各个 sheet 和字段怎么关联，再看：

`docs/excel-rule-sheet-relations.md`

用途不是把 Mercado Livre 的规则写死，而是演示一种通用结构：

1. 字段由 Excel 定义
2. 规则由 Excel 定义
3. 查表数据由 Excel 定义
4. 代码只负责解析和执行

## 看文件的顺序

建议按下面顺序阅读工作簿：

1. `overview`
2. `option_groups`
3. `option_items`
4. `fields`
5. `rule_sets`
6. `rules`
7. `rule_condition_groups`
8. `rule_conditions`
9. `rule_actions`
10. `lookup_tables`
11. `commission_table`
12. `shipping_cost_table`

## 这份示例解决了什么问题

示例里演示了 3 类规则：

1. 销售费率：根据刊登类型和类目查出费率
2. 运费：根据售价区间和重量区间查表
3. 卖家支付运费：如果包邮则为 0，否则查运费表

注意：

1. 这 3 类只是例子
2. 引擎不应该知道“佣金”“运费”这些业务词
3. 引擎只认识字段、条件树、动作、查表

## 每个 Sheet 的作用

### `overview`

给人看的总览，提醒这份工作簿里有哪些规则入口和样例流程。

### `fields`

定义业务字段。这里没有固定行业字段，只有当前样例需要的字段。

关键列：

1. `field_key`：代码内部引用键
2. `field_name`：页面展示名
3. `type`：`number/select/boolean/date/image/rule`
4. `unit`：单位
5. `option_group_id`：如果是 `select`，引用哪个选项组
6. `rule_mode`：如果是 `rule`，是 `input` 还是 `output`

### `option_groups` / `option_items`

这两张表是给 `select` 字段提供候选值的。

这也是“字段不写死”的一部分：

1. 下拉选项来自 Excel
2. 页面运行时读取
3. 不是把刊登类型、类目写死在代码里

### `rule_sets`

定义规则集入口。某个预设组合后面可以绑定某个 `rule_set_id`。

### `rules`

定义规则头。

关键列：

1. `rule_id`
2. `rule_set_id`
3. `priority`
4. `enabled`
5. `root_group_id`
6. `description`

### `rule_condition_groups`

定义条件树里的分组节点。

关键列：

1. `group_id`
2. `rule_id`
3. `parent_group_id`
4. `logic`：`and/or`
5. `sort`

如果 `parent_group_id` 为空，表示它是这条规则的根组。

### `rule_conditions`

定义条件树里的叶子条件。

关键列：

1. `condition_id`
2. `group_id`
3. `field_key`
4. `operator`
5. `value_type`
6. `value`
7. `value_end`

这里支持的例子有：

1. `eq`
2. `between`

后面实际实现时可以扩展更多操作符。

### `rule_actions`

定义规则命中后要执行的动作。

当前示例只用了 3 类动作：

1. `lookup`
2. `branch`
3. `set`

关键列：

1. `action_id`
2. `rule_id`
3. `sort`
4. `action_type`
5. `target_field`
6. `config_json`

为什么这里用 `config_json`：

1. 动作配置通常会嵌套
2. 例如查表需要 `table_id + input_map + output_column`
3. 例如条件分支需要 `when + then + else`

如果把这些列完全摊平，很快就会失控。

### `lookup_tables`

定义查表目录。

例如：

1. `commission_table`
2. `shipping_cost_table`

这张表只负责告诉系统：

1. 有哪些查表表
2. 每张表是什么匹配方式
3. 实际数据在哪个 sheet

建议至少有这些列：

1. `table_id`
2. `table_name`
3. `match_mode`
4. `sheet_name`
5. `description`

### `commission_table`

这是销售费率查表 sheet。

特点：

1. 费率可以来自表
2. 适合等值匹配
3. 可以按 `刊登类型 + 类目` 这类维度查值

示例列可以是：

1. `刊登类型`
2. `类目`
3. `输出值`
4. `note`

### `shipping_cost_table`

这是运费区间查表 sheet。

特点：

1. 运费可以来自表
2. 适合区间匹配
3. 可以按 `售价 + 重量` 这类维度查值

示例列可以是：

1. `范围1下限`
2. `范围1上限`
3. `范围2下限`
4. `范围2上限`
5. `输出值`
6. `note`

## 3 个例子到底怎么跑

### 例子 1：销售费率

业务意思：

1. 给定刊登类型
2. 给定类目
3. 查出销售费率

这在样例里对应：

1. `rules` 里的 `rule_commission_lookup`
2. `rule_actions` 里的 `act_commission_lookup`
3. `commission_table` sheet

引擎流程：

1. 命中规则
2. 执行 `lookup`
3. 用 `刊登类型` 和 `类目` 查表
4. 把结果写到 `销售费率`

### 例子 2：运费

业务意思：

1. 给定售价
2. 给定重量
3. 查出运费

这在样例里对应：

1. `rules` 里的 `rule_shipping_lookup`
2. `rule_actions` 里的 `act_shipping_lookup`
3. `shipping_cost_table` sheet

引擎流程：

1. 命中规则
2. 执行 `lookup`
3. 用 `售价` 和 `重量` 找区间
4. 把结果写到 `运费`

### 例子 3：卖家支付运费

业务意思：

1. 如果包邮，则卖家支付运费为 0
2. 如果不包邮，则继续查运费表

这在样例里对应：

1. `rules` 里的 `rule_seller_shipping_cost`
2. `rule_actions` 里的 `act_seller_shipping_branch`

这里的重点不是“写 if 语句”，而是把 if 也结构化。

`config_json` 里会有：

1. `when`
2. `then`
3. `else`

因此代码只需要支持 `branch` 动作，不需要写死“包邮运费规则”。

### 额外例子：嵌套条件树

工作簿里还额外放了一条 `rule_fixed_fee_nested`，专门演示“条件树嵌套”。

业务意思：

1. `刊登类型 = premium`
2. `售价` 在 `150 ~ 700`
3. `类目 = beauty or personal_care`
4. 命中后设置 `固定附加费 = 6.25`

它对应：

1. `rules` 里的 `rule_fixed_fee_nested`
2. `rule_condition_groups` 里的 `grp_fixed_fee_root` 和 `grp_fixed_fee_or`
3. `rule_conditions` 里的 4 条条件记录

这条样例不是为了业务本身，而是为了让你直观看到：

1. 条件树不是靠代码嵌套 `if`
2. 条件树也可以由 Excel 结构表达

## 这份示例故意没有做的事

为了让你先看懂，这份示例没有继续扩展：

1. 自由文本公式
2. 多层动作依赖链
3. 循环引用检测
4. 多规则集串联
5. 更复杂的嵌套查表

这些后面都可以加，但第一版不需要一起上。

## 实现时代码应该做什么

代码应该只做 4 件事：

1. 读取 Excel
2. 组装字段定义、条件树、动作配置
3. 依规则优先级执行
4. 返回结果和错误

代码不应该做的事：

1. 把类目写成内置枚举
2. 把费率写成 `if/else`
3. 把运费区间写在常量文件里

## 你可以怎么读这份样例

最简单的阅读方法：

1. 先看 `fields`，理解有哪些输入和输出字段
2. 再看 `lookup_tables`，知道要读哪张查表 sheet
3. 再看具体查表 sheet，比如 `commission_table`、`shipping_cost_table`
4. 再看 `rule_actions`，理解规则命中后做什么
5. 最后再回头看条件树相关的两张表

如果你只想先抓住重点，就记这一句：

不是代码决定业务规则，而是 Excel 决定规则，代码只做解释器。
