# 修复：输入值跨字段串扰

## 根因确认

`updateInput` 日志显示 `fieldKey` 为空字符串 `""`：

```
[updateInput] fieldKey: "" value: "2222222222"
```

Excel `preset_params` 表的 `field_key` 列在问题预设中为空值，Excel 读取器解析为 `p.field_key || ''` → `""`。多个参数的空 `fieldKey` 全部绑定到 `userInputs[""]` 同一个 key，导致输入任一框都会影响所有绑定到该 key 的输入框。

关键代码链路：
- `excel-reader.js:311` — `fieldKey: p.field_key || ''`
- `FieldInput` v-model 绑定 — `:model-value="createStore.userInputs[param.fieldKey]"`
- `updateInput` → `userInputs.value[fieldKey] = value` — 所有空 fieldKey 参数写同一个 key
- `selectPreset` / `resetToDefaults` 中也向 `userInputs[""]` 写值

## 修复方案

在 `paramFields` computed 和 `selectPreset`/`resetToDefaults` 中跳过 `fieldKey` 为空的参数，同时输出 `console.warn` 提示用户修正 Excel 配置。

同时移除本 session 中添加的诊断日志。

## 涉及文件

| 文件 | 修改 |
|------|------|
| `src/pages/CreatePage.vue` | `paramFields` 中过滤空 fieldKey + 警告；移除重复检测诊断日志和 watch 日志 |
| `src/stores/create.js` | `selectPreset` 和 `resetToDefaults` 中跳过空 fieldKey param；移除 updateInput 日志 |

## 实施细节

### 1. `CreatePage.vue` — `paramFields` computed

- 在 `.map()` 后 `.filter(f => !!f.fieldKey)` 过滤掉空 fieldKey 的 param
- 检测到被过滤的 param 时输出一个 `console.warn`，列出被跳过的 param 名称和预设 ID
- 移除之前添加的 fieldKey/paramId 重复检测代码
- 移除 watch 中的 `console.log` 快照日志

### 2. `stores/create.js` — `selectPreset` 和 `resetToDefaults`

- 遍历 preset.params 时跳过 `param.fieldKey` 为空的 param
- 移除 `updateInput` 中的 `console.log`

### 3. 用户侧操作

- 警告提示后，用户检查 Excel `preset_params` 表中对应预设的 `field_key` 列，填写正确的字段键
