# Profit Logo 生成说明

## 产品描述

Profit 是一款面向跨境电商、外贸卖家和运营人员的桌面端利润分析工具。帮助用户导入商品、订单、成本、物流、汇率等数据，快速计算利润、毛利率、成本结构和经营表现。

产品定位：专业、清晰、高效、可信赖的财务/利润分析工具。

## Logo 风格

macOS App Icon 风格，适合放在 Dock、Launchpad 和系统应用列表中。

- 圆角方形图标
- 精致渐变背景
- 轻微 3D 层次 / 玻璃质感 / 细腻阴影
- 柔和高光，不过度拟物
- macOS 深色/浅色模式都清晰

## 可用元素

- P 字母（抽象、几何化处理）
- 利润增长曲线 / 上升趋势线
- 数据图表 / 表格 / 网格
- 经营分析 / 数据可视化意象

## 颜色建议

蓝紫、青绿、科技感渐变，或深色背景配明亮渐变主体。高级、清爽、专业。

## 避免

- 不要纯扁平、廉价 Web 图标感
- 不要使用美元符号、硬币堆叠等俗套元素
- 不要像银行、记账、炒股 App
- 不要过度卡通
- 不要复杂到 32x32 看不清
- 不要把 `.app` 后缀放进 identifier

## 必须交付的文件名（严格一致）

以下文件名与 `src-tauri/icons/` 目录一致，生成后可直接覆盖：

```
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

## 额外交付

| 文件名 | 用途 |
|---|---|
| `logo.svg` | 矢量源文件 |
| `logo-horizontal.svg` | 图标 + Profit 文字横版 Logo |
| `logo-dark.svg` | 深色背景版本 |
| `logo-light.svg` | 浅色背景版本 |
| `logo-monochrome.svg` | 单色版本（特殊场景） |
| `favicon.ico` | 网站 favicon（多尺寸） |
| `favicon-16x16.png` | 网站 tab 图标 |
| `favicon-32x32.png` | 网站 tab 图标 |
| `apple-touch-icon.png` | iOS Safari 书签图标，180x180 |
| `web-app-192x192.png` | Web App Manifest |
| `web-app-512x512.png` | Web App Manifest |

## 交付要求

- 所有 PNG 透明背景
- SVG 路径干净、可编辑
- 小尺寸（32x32）需专门优化，不能简单缩放导致模糊
- 图标主体清晰，不依赖细小文字
- 适配 macOS 圆角方形 App 图标

## 完整提示词

以下是可直接复制给 AI 的 Logo 生成 prompt：

```
为一款名为 Profit 的桌面端利润分析工具设计 Logo。
它面向跨境电商和外贸卖家，帮助用户导入数据并分析商品利润、成本结构、毛利率和经营表现。
Logo 要体现“利润增长、数据分析、专业可信、高效决策”。

风格要求：
简洁现代，偏 macOS App 图标风格（Big Sur / Sonoma 风格），
适合放在 Dock、Launchpad 和系统应用列表中。
圆角方形图标，精致渐变背景，轻微 3D 层次 / 玻璃质感 / 细腻阴影，
不过度拟物，macOS 深色/浅色模式都清晰。

可以结合以下元素：
P 字母（抽象几何化）、上升箭头 / 利润增长曲线、数据图表 / 表格 / 网格。

颜色建议：
蓝紫、青绿、科技感渐变，或深色背景配明亮渐变主体。高级、清爽、专业。

避免：
不要纯扁平廉价 Web 图标感。
不要美元符号、硬币堆叠。
不要像银行、记账、炒股 App。
不要过度卡通。
不要复杂到 32x32 看不清。

请生成以下文件，文件名必须严格一致：

Tauri App 图标（src-tauri/icons/）：
32x32.png、128x128.png、128x128@2x.png（256x256）、1024x1024.png
icon.png、icon.icns、icon.ico
Square30x30Logo.png、Square44x44Logo.png、Square71x71Logo.png
Square89x89Logo.png、Square107x107Logo.png、Square142x142Logo.png
Square150x150Logo.png、Square284x284Logo.png、Square310x310Logo.png
StoreLogo.png

额外交付：
logo.svg（矢量源文件）
logo-horizontal.svg（图标 + Profit 文字横版）
logo-dark.svg（深色背景版）
logo-light.svg（浅色背景版）
logo-monochrome.svg（单色版）
favicon.ico、favicon-16x16.png、favicon-32x32.png
apple-touch-icon.png（180x180）
web-app-192x192.png、web-app-512x512.png

要求：
所有 PNG 透明背景。
小尺寸（32x32）需专门优化，不能简单缩放导致模糊。
图标主体清晰，不依赖细小文字或复杂细节。
适配 macOS 圆角方形 App 图标场景。
```
