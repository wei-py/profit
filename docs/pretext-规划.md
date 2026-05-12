# Pretext 集成规划文档

## 一、背景

**Pretext** 是由 React 核心团队成员 chenglou 开发的一个纯 JavaScript/TypeScript 库，用于**多行文本的测量和布局**。

### 核心能力

- 在不接触 DOM 的情况下预计算文本高度
- 避免 `getBoundingClientRect` 等触发重排的操作
- 支持所有语言（emoji、CJK、阿拉伯文等）
- 支持渲染到 DOM、Canvas、SVG

当前项目中并未使用 Pretext。

---

## 二、项目适合 Pretext 的场景分析

### 场景 1：列表虚拟滚动 🎯 高优先级

**位置**: `ListPage.vue` 商品记录列表（第 504 行）

```vue
<tr v-for="(row, idx) in listStore.records" :key="idx">
```

**问题**: 当商品记录很多时（如 500+ 条），一次性渲染所有行会导致页面卡顿。

**Pretext 作用**: 预计算每行高度，实现虚拟滚动，只渲染可见区域的行。

**预期效果**: 1000 条记录也能流畅滚动。

---

### 场景 2：SKU 表格动态行高 🎯 高优先级

**位置**: `ListPage.vue` SKU 表格（第 431 行）

```vue
<tr v-for="(sku, si) in createStore.skus" :key="sku.key">
```

**问题**: SKU 表格中某些单元格内容可能很长（如备注、描述），当前固定行高可能导致内容溢出或浪费空间。

**Pretext 作用**: 根据单元格内容动态计算行高。

**预期效果**: 长文本自动换行，行高自适应。

---

### 场景 3：长文本智能省略 🎯 中优先级

**位置**: 
- `ListPage.vue` 商品名称列（第 511 行）
- `EditableTable.vue` textarea 内容（第 126-127 行）
- 各种下拉选项、表格单元格

**问题**: 某些字段内容很长（如商品描述），显示时会被截断，用户不知道完整内容是什么。

**当前实现**: 使用 CSS `truncate` + `title` 属性显示完整内容。

```vue
<span class="flex-1 truncate text-xs" :title="col">{{ col }}</span>
```

**Pretext 作用**: 预计算文本宽度，智能判断是否需要省略号，以及省略多少字符最合适。

**预期效果**: 
- 短文本正常显示
- 长文本自动截断并显示省略号
- hover 时显示完整内容（已有 title）

---

### 场景 4：编辑列弹窗列名截断 🎯 低优先级

**位置**: `ListPage.vue` 编辑列弹窗（第 543、591 行）

```vue
<span class="flex-1 truncate text-xs" :title="col">{{ col }}</span>
```

**问题**: 列名可能很长（如"巴西 Mercadolivre 销售佣金费率"），当前直接截断。

**Pretext 作用**: 预计算列名字符宽度，智能决定截断位置。

**说明**: 优先级较低，当前 truncation 已满足基本需求。

---

### 场景 5：表单标签动态宽度 🎯 低优先级

**位置**: `FieldInput.vue` 字段输入组件（第 17、41 行）

**问题**: 字段名称可能很长，固定宽度可能导致布局错乱。

**Pretext 作用**: 预计算标签文本宽度，动态调整布局。

**说明**: 优先级较低，当前布局基本满足需求。

---

## 三、场景优先级排序

| 优先级 | 场景 | 用户体验提升 | 实现难度 |
|--------|------|--------------|----------|
| 🥇 1 | 列表虚拟滚动 | 显著（1000+ 条记录流畅度） | 中等 |
| 🥇 2 | SKU 表格动态行高 | 明显（长文本不再被截断） | 简单 |
| 🥈 3 | 长文本智能省略 | 中等（界面更美观） | 简单 |
| 🥉 4 | 编辑列弹窗列名截断 | 轻微 | 简单 |
| 🥉 5 | 表单标签动态宽度 | 轻微 | 简单 |

---

## 四、实施方案

### 4.1 安装依赖

```bash
pnpm add @chenglou/pretext
```

### 4.2 创建工具模块

在 `src/utils/textMeasure.js` 创建文本测量工具：

```javascript
import { prepare, layout, prepareWithSegments, layoutWithLines } from '@chenglou/pretext'

const DEFAULT_FONT = '14px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'

export function measureTextHeight(text, maxWidth, lineHeight = 20, font = DEFAULT_FONT) {
  if (!text) return 0
  const prepared = prepare(String(text), font)
  const { height } = layout(prepared, Number(maxWidth) || 200, lineHeight)
  return height
}

export function measureTextLines(text, maxWidth, lineHeight = 20, font = DEFAULT_FONT) {
  if (!text) return { lines: [], height: 0, lineCount: 0 }
  const prepared = prepareWithSegments(String(text), font)
  return layoutWithLines(prepared, Number(maxWidth) || 200, lineHeight)
}

export function getEllipsisText(text, maxWidth, font = DEFAULT_FONT, maxChars = 20) {
  if (!text || text.length <= maxChars) return { text, truncated: false }
  const fullHeight = measureTextHeight(text, maxWidth)
  const shortText = text.slice(0, maxChars) + '...'
  const shortHeight = measureTextHeight(shortText, maxWidth)
  if (fullHeight > shortHeight) {
    return { text: shortText, truncated: true }
  }
  return { text, truncated: false }
}
```

### 4.3 实现列表虚拟滚动

需要引入虚拟滚动库或手写实现。推荐使用 `vue-virtual-scroller` 或手写。

**手写实现思路**:

```vue
<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { measureTextHeight } from '@/utils/textMeasure'

const containerRef = ref(null)
const scrollTop = ref(0)
const containerHeight = ref(600)
const itemHeight = 40 // 预估行高

const visibleRange = computed(() => {
  const start = Math.floor(scrollTop.value / itemHeight)
  const count = Math.ceil(containerHeight.value / itemHeight) + 5
  return { start: Math.max(0, start - 2), end: start + count }
})

const visibleRecords = computed(() => {
  return listStore.records.slice(visibleRange.value.start, visibleRange.value.end)
})

function onScroll(e) {
  scrollTop.value = e.target.scrollTop
}
</script>

<template>
  <div ref="containerRef" class="overflow-auto" :style="{ height: containerHeight + 'px' }" @scroll="onScroll">
    <div :style="{ height: listStore.records.length * itemHeight + 'px', position: 'relative' }">
      <div :style="{ transform: `translateY(${visibleRange.start * itemHeight}px)` }">
        <tr v-for="(row, idx) in visibleRecords" :key="visibleRange.start + idx">
          <!-- 内容 -->
        </tr>
      </div>
    </div>
  </div>
</template>
```

### 4.4 实现 SKU 表格动态行高

```vue
<script setup>
import { measureTextHeight } from '@/utils/textMeasure'

function getCellHeight(text, maxWidth = 100) {
  const height = measureTextHeight(text, maxWidth, 16)
  return Math.max(32, height + 8) // 最小高度 32px
}
</script>

<template>
  <td :style="{ height: getCellHeight(cellValue) + 'px' }">
    {{ cellValue }}
  </td>
</template>
```

### 4.5 实现长文本智能省略

```vue
<script setup>
import { getEllipsisText } from '@/utils/textMeasure'

function formatCellText(text, maxWidth = 120) {
  const result = getEllipsisText(text, maxWidth)
  return result.text
}
</script>

<template>
  <td :title="cellText">
    {{ formatCellText(cellText) }}
  </td>
</template>
```

---

## 五、文件修改清单

| 文件 | 修改内容 | 优先级 |
|------|----------|--------|
| `package.json` | 添加 `@chenglou/pretext` 依赖 | 必须 |
| `src/utils/textMeasure.js` | 新建文本测量工具模块 | 必须 |
| `src/pages/ListPage.vue` | 列表虚拟滚动 | 🥇 |
| `src/pages/ListPage.vue` | SKU 表格动态行高 | 🥇 |
| `src/components/common/FieldInput.vue` | 长文本智能省略 | 🥈 |
| `src/components/common/EditableTable.vue` | textarea 自适应高度 | 🥈 |

---

## 六、实施步骤

### 第一阶段：基础能力

1. 安装 `@chenglou/pretext` 依赖
2. 创建 `src/utils/textMeasure.js` 工具模块
3. 验证基础测量功能正常

### 第二阶段：核心场景

4. 实现 SKU 表格动态行高（场景 2）
5. 实现长文本智能省略（场景 3）

### 第三阶段：高级功能

6. 实现列表虚拟滚动（场景 1）
7. 其他优化（场景 4、5）

---

## 七、注意事项

1. **字体一致性**: Pretext 使用的字体必须与 CSS 中完全一致
2. **性能优化**: 对大量相同文本，缓存 `PreparedText` 对象避免重复测量
3. **SSR 兼容**: Pretext 依赖 `Intl.Segmenter` 和 Canvas，确保目标环境支持
4. **渐进增强**: 优先保证无 Pretext 时的基本功能正常
5. **移动端**: Canvas 2D 在部分移动端浏览器可能受限

---

## 八、相关资源

- Pretext 官方文档: https://github.com/chenglou/pretext
- Pretext 在线演示: https://chenglou.me/pretext/
- Vue 虚拟滚动库: https://github.com/microcip/vue-virtual-scroller
