# Profit Logo 优化说明

## 产品描述

Profit 是一款面向跨境电商、外贸卖家和运营人员的桌面端利润分析工具。它帮助用户导入商品、订单、成本、物流、汇率等数据，快速计算利润、毛利率、成本结构和经营表现。

产品定位：专业、清晰、高效、可信赖的利润分析工具。

## 优化方向

请基于当前已显示的 Logo 做优化，不要重新发散成全新的品牌图形。

当前 Logo 的核心视觉是：

- 深色立体盒体 / 包裹 / 容器
- 绿色柱状图
- 向上增长箭头
- 浅色圆角方形 App 图标背景

优化目标：保留“盒体 + 数据增长”的识别方向，让它更像高质量 macOS App 图标，更精致、更清晰、更高级。

## 风格要求

- macOS App Icon 风格，适合 Dock、Launchpad 和系统应用列表
- 圆角方形图标构图
- 中心图形更稳定、更清楚
- 轻微 3D 层次、柔和阴影、细腻高光
- 盒体边缘更干净，柱状图和箭头更流畅
- 32x32 小尺寸下仍然能看出“增长图表 + 盒体”

## 颜色方向

沿用当前 Logo 的色彩方向，不要改成蓝紫色。

- 主体深色：深海军蓝、墨黑蓝、深灰蓝
- 增长元素：绿色、青绿色、薄荷绿、翡翠绿
- 背景：浅灰白、柔和米白、轻微玻璃质感
- 可以加入细腻渐变，但不要花哨

## 不要做

- 不要使用 P 字母作为主体
- 不要改成蓝紫色科技风
- 不要美元符号、硬币、钱包、银行卡
- 不要像银行、记账、炒股 App
- 不要过度卡通
- 不要复杂到小尺寸看不清
- 不要纯扁平廉价 Web 图标感
- 不要完全推翻当前“盒体 + 增长图表”的方向

## 必须交付的文件名（严格一致）

以下文件名与 `src-tauri/icons/` 目录一致，生成后可直接覆盖：

```text
32x32.png
128x128.png
128x128@2x.png
1024x1024.png
icon.png
icon.icns
icon.ico
Square30x30Logo.png
Square44x44Logo.png
Square71x71Logo.png
Square89x89Logo.png
Square107x107Logo.png
Square142x142Logo.png
Square150x150Logo.png
Square284x284Logo.png
Square310x310Logo.png
StoreLogo.png
```

## 交付要求

- 所有 PNG 使用透明背景，除非是 macOS 圆角方形图标本身需要浅色底
- SVG 路径干净、可编辑
- 小尺寸文件需要单独优化，不要只从 1024x1024 机械缩小
- `32x32.png` 里主体必须仍然清楚
- `icon.icns` 用于 macOS
- `icon.ico` 用于 Windows
- 文件名必须严格一致，方便直接覆盖 `src-tauri/icons/`

## 完整提示词

以下是可直接复制给 AI 的 Logo 生成 prompt：

```text
请基于当前 Profit App 已有 Logo 做优化，而不是重新设计一个完全不同的 Logo。

产品背景：
Profit 是一款面向跨境电商、外贸卖家和运营人员的桌面端利润分析工具。它帮助用户导入商品、订单、成本、物流、汇率等数据，快速计算利润、毛利率、成本结构和经营表现。

当前 Logo 的核心视觉方向：
深色立体盒体 / 包裹 / 容器 + 绿色柱状图 + 向上增长箭头 + 浅色圆角方形 App 图标背景。

优化目标：
保留当前“盒体 + 数据增长”的识别方向，让它更像高质量 macOS App Icon。整体要更精致、更清晰、更专业、更高级。适合放在 macOS Dock、Launchpad、Windows 桌面和系统应用列表中。

风格要求：
macOS Big Sur / Sonoma App Icon 风格。
圆角方形图标构图。
轻微 3D 层次、柔和阴影、细腻高光、干净边缘。
盒体要更稳定、更有质感。
绿色柱状图和上升箭头要更流畅、更清晰。
小尺寸 32x32 下仍然能看出“增长图表 + 盒体”。

颜色方向：
沿用当前 Logo 的配色方向，不要改成蓝紫色。
主体使用深海军蓝、墨黑蓝、深灰蓝。
增长元素使用绿色、青绿色、薄荷绿、翡翠绿。
背景使用浅灰白、柔和米白或轻微玻璃质感。
可以加入细腻渐变，但不要花哨。

不要做：
不要使用 P 字母作为主体。
不要改成蓝紫色科技风。
不要美元符号、硬币、钱包、银行卡。
不要像银行、记账、炒股 App。
不要过度卡通。
不要纯扁平廉价 Web 图标感。
不要复杂到 32x32 看不清。
不要完全推翻当前“盒体 + 增长图表”的方向。

请生成以下文件，文件名必须严格一致：

Tauri App 图标（直接覆盖 src-tauri/icons/）：
32x32.png
128x128.png
128x128@2x.png
1024x1024.png
icon.png
icon.icns
icon.ico
Square30x30Logo.png
Square44x44Logo.png
Square71x71Logo.png
Square89x89Logo.png
Square107x107Logo.png
Square142x142Logo.png
Square150x150Logo.png
Square284x284Logo.png
Square310x310Logo.png
StoreLogo.png

交付要求：
所有 PNG 尽量使用透明背景；如果是 macOS App Icon 圆角底图，可以保留浅色圆角背景。
SVG 路径要干净、可编辑。
小尺寸图标要单独优化，不要只从 1024x1024 机械缩小。
32x32.png 中主体必须仍然清楚。
icon.icns 用于 macOS，icon.ico 用于 Windows。
文件名必须严格一致。
```
