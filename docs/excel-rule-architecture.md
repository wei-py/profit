# Excel 规则驱动架构图

这份文档配合下面两个文件一起看：

1. `docs/excel-rule-example-guide.md`
2. `public/examples/excel-rule-engine-example.xlsx`

如果你想先抓整体，先看这份文档。它主要解决 4 个问题：

1. Excel 在整个系统里扮演什么角色
2. 一个工作簿里各个 sheet 是怎么协作的
3. 一次规则计算是按什么顺序执行的
4. 查表为什么要拆成独立 sheet

## 为什么这里同时用流程图和时序图

我建议你这样看：

1. 流程图：看结构和方向
2. 时序图：看一次计算到底怎么跑

原因很简单：

1. 只看流程图，容易知道“有什么”，但不清楚“先后顺序”
2. 只看时序图，容易知道“怎么跑”，但不清楚“整体边界”

所以这里两种图都会用。

## 总览流程

先看这张图，建立一句话理解：

Excel 定义字段、选项、规则和查表数据；页面只收集输入；引擎只负责解释执行。

```mermaid
flowchart LR
    A[配置.xlsx] --> B[字段定义 fields]
    A --> C[选项定义 option_groups / option_items]
    A --> D[规则定义 rules / condition groups / conditions / actions]
    A --> E[查表目录 lookup_tables]
    E --> F[独立查表 Sheet<br/>commission_table<br/>shipping_cost_table]

    G[预设页] --> A
    H[选项页] --> A
    I[模板/规则页] --> A

    J[创建页 / 列表页] --> K[读取配置]
    K --> B
    K --> C
    K --> D
    K --> E
    K --> F

    J --> L[收集用户输入]
    L --> M[规则引擎]
    B --> M
    D --> M
    E --> M
    F --> M
    M --> N[输出计算结果]
    N --> O[保存到列表 Excel]
```

## 工作簿结构

这张图重点看“Excel 内部关系”。

注意这里分成 4 层：

1. 字段层
2. 规则层
3. 动作层
4. 查表层

```mermaid
flowchart TD
    subgraph Workbook[配置.xlsx]
        OG[option_groups]
        OI[option_items]
        FIELDS[fields]
        RS[rule_sets]
        RULES[rules]
        GROUPS[rule_condition_groups]
        CONDS[rule_conditions]
        ACTIONS[rule_actions]
        TABLES[lookup_tables]
        T1[commission_table]
        T2[shipping_cost_table]
    end

    OG --> OI
    OG --> FIELDS
    RS --> RULES
    RULES --> GROUPS
    GROUPS --> CONDS
    RULES --> ACTIONS
    TABLES --> T1
    TABLES --> T2
    ACTIONS --> TABLES
    FIELDS --> CONDS
    FIELDS --> ACTIONS
```

这张图表达的是：

1. `fields` 负责定义当前业务有哪些字段
2. `option_groups / option_items` 给 `select` 字段提供候选值
3. `rules + groups + conditions` 负责描述“什么时候命中”
4. `rule_actions` 负责描述“命中后做什么”
5. `lookup_tables` 只是目录，真正的数据在独立 sheet 里

## 页面和引擎边界

这张图重点看“页面不直接处理业务规则”。

```mermaid
flowchart LR
    UI[页面层<br/>创建页 / 列表页] --> STORE[Store / Service]
    STORE --> REPO[Repository]
    REPO --> EXCEL[Excel 读取结果]

    STORE --> ENGINE[规则引擎]
    EXCEL --> ENGINE

    ENGINE --> RESULT[计算结果]
    RESULT --> STORE
    STORE --> UI
```

这里最重要的约束是：

1. 页面不自己拼规则
2. 页面不自己查 Excel
3. 页面只负责输入和展示
4. 引擎只负责执行通用规则结构

## 一次规则计算的时序

这张图最适合看“点击一次计算按钮，到底发生了什么”。

```mermaid
sequenceDiagram
    participant Page as 创建页
    participant Service as Config/Record Service
    participant Repo as Repository
    participant Engine as 规则引擎
    participant Lookup as 查表 Sheet

    Page->>Service: 请求当前预设对应的规则计算
    Service->>Repo: 读取字段、规则、查表目录
    Repo-->>Service: 返回结构化配置
    Service->>Engine: 传入字段定义 + 规则集 + 用户输入
    Engine->>Engine: 按优先级遍历规则
    Engine->>Engine: 计算条件树是否命中
    alt 动作为 lookup
        Engine->>Lookup: 根据 table_id / sheet_name 查表
        Lookup-->>Engine: 返回命中的值
    else 动作为 branch
        Engine->>Engine: 计算 when
        Engine->>Engine: 执行 then 或 else
    else 动作为 set
        Engine->>Engine: 直接设置结果值
    end
    Engine-->>Service: 返回结果对象和错误列表
    Service-->>Page: 返回可展示结果
```

这个顺序里有两个重点：

1. `Repository` 先把 Excel 转成结构化对象
2. `Engine` 执行的是结构化对象，不是直接操作原始单元格

## 条件树怎么理解

你前面已经确认要支持“条件树嵌套”，所以这里单独画一张图。

示例业务：

1. `listing_type = premium`
2. `sale_price` 在 `150 ~ 700`
3. `category = beauty or personal_care`

```mermaid
flowchart TD
    ROOT[AND 根组]
    C1[listing_type = premium]
    C2[sale_price between 150 and 700]
    OR1[OR 子组]
    C3[category = beauty]
    C4[category = personal_care]

    ROOT --> C1
    ROOT --> C2
    ROOT --> OR1
    OR1 --> C3
    OR1 --> C4
```

这张图对应 Excel 里的关系是：

1. `rules` 里有一条规则头
2. `rule_condition_groups` 里有根组和子组
3. `rule_conditions` 里挂具体条件

也就是说，嵌套不是靠写代码嵌套，而是靠表关系表达。

## 查表为什么要拆独立 sheet

你前面提的这个方向是对的：

`lookup_tables` 只做目录，真正数据放独立 sheet，会比所有查表混在一张总表里更好。

```mermaid
flowchart LR
    A[rule_actions.lookup] --> B[table_id]
    B --> C[lookup_tables]
    C --> D[sheet_name]
    D --> E[commission_table]
    D --> F[shipping_cost_table]
```

这么做的好处：

1. 每张查表可以有自己的列结构
2. Excel 维护时更接近人工思维
3. 新增复杂查表时，不需要污染一个总表
4. 引擎仍然可以通过 `lookup_tables` 保持统一入口

## 3 个示例怎么落到图里

### 例子 1：销售费率

适合：

1. `lookup`
2. 等值匹配
3. 独立 sheet：`commission_table`

理解方式：

1. 输入 `listing_type`
2. 输入 `category`
3. 去 `commission_table` 命中一行
4. 输出 `commission_rate`

### 例子 2：运费

适合：

1. `lookup`
2. 区间匹配
3. 独立 sheet：`shipping_cost_table`

理解方式：

1. 输入 `sale_price`
2. 输入 `shipping_weight`
3. 去 `shipping_cost_table` 找区间
4. 输出 `shipping_fee`

### 例子 3：卖家支付运费

适合：

1. `branch`
2. `then = set`
3. `else = lookup`

理解方式：

1. 如果 `is_free_shipping = true`
2. 直接输出 `0`
3. 否则去 `shipping_cost_table` 查值

## 阅读顺序建议

如果你是第一次看这套结构，建议按下面顺序：

1. 先看“总览流程”
2. 再看“工作簿结构”
3. 再看“条件树怎么理解”
4. 再看“一次规则计算的时序”
5. 最后打开 `excel-rule-engine-example.xlsx` 对照看具体 sheet

## 最后记一句话

这个项目里最核心的不是“写很多公式”，而是：

1. Excel 定义字段
2. Excel 定义规则
3. Excel 定义查表数据
4. 代码只做解释器

只要一直守住这 4 点，后面规则再复杂，也优先扩 Excel 结构，不优先扩业务硬编码。
