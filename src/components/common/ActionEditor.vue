<script setup>
import { computed, ref, watch } from 'vue'

/**
 * @property {object} modelValue - 动作对象
 * @property {Array} [fields=[]] - 字段列表
 * @property {Array} [lookupTables=[]] - 查找表列表
 */
const props = defineProps({
  modelValue: { type: Object, required: true },
  fields: { type: Array, default: () => [] },
  lookupTables: { type: Array, default: () => [] },
})

/**
 * @event update:modelValue - 动作数据变更
 */
const emit = defineEmits(['update:modelValue'])

/** @type {import('vue').Ref<object>} 编辑中的动作副本 */
const action = ref({ ...props.modelValue })
/** @type {import('vue').Ref<string>} configJson 的 JSON 字符串表示 */
const configJsonStr = ref(JSON.stringify(props.modelValue.configJson || {}, null, 2))

watch(() => props.modelValue, (val) => {
  action.value = { ...val }
  configJsonStr.value = JSON.stringify(val.configJson || {}, null, 2)
}, { deep: true })

/** configJson 字符串的实时解析结果 */
const parsedConfigJson = computed(() => {
  try {
    return JSON.parse(configJsonStr.value)
  }
  catch {
    return {}
  }
})

/** 同步动作数据到父组件。 */
function update() {
  action.value.configJson = parsedConfigJson.value
  emit('update:modelValue', { ...action.value })
}

/**
 * 更新动作的顶层字段。
 * @param {string} field - 字段名
 * @param {*} value - 新值
 */
function updateField(field, value) {
  action.value[field] = value
  update()
}

/**
 * 更新 configJson 的一级字段。
 * @param {string} key - 字段名
 * @param {*} value - 新值
 */
function updateConfigJsonField(key, value) {
  const current = { ...parsedConfigJson.value }
  current[key] = value
  configJsonStr.value = JSON.stringify(current, null, 2)
  update()
}

/**
 * 更新 configJson 的嵌套字段。
 * @param {string} path - 点号分隔的路径，如 'when.field'
 * @param {*} value - 新值
 * @returns {void}
 */
function updateNestedConfigJson(path, value) {
  const current = { ...parsedConfigJson.value }
  const parts = path.split('.')
  let obj = current
  for (let i = 0; i < parts.length - 1; i++) {
    if (!obj[parts[i]])
      obj[parts[i]] = {}
    obj = obj[parts[i]]
  }
  obj[parts[parts.length - 1]] = value
  configJsonStr.value = JSON.stringify(current, null, 2)
  update()
}

/** 可选的动作类型列表 */
const actionTypes = ['set', 'lookup', 'branch']
/** 输出型字段列表 */
const outputFields = computed(() => props.fields.filter(f => f.ruleMode === 'output'))

/**
 * 获取动作类型的中文标签。
 * @param {string} type - 动作类型
 * @returns {string} 中文标签
 */
function actionTypeLabel(type) {
  const map = {
    set: '赋值',
    lookup: '查表',
    branch: '分支',
  }
  return map[type] || type
}

/** 新增一组输入映射条目。 */
function addInputMapEntry() {
  const current = { ...parsedConfigJson.value }
  if (!current.input_map)
    current.input_map = {}
  const key = `key_${Object.keys(current.input_map).length + 1}`
  current.input_map[key] = ''
  configJsonStr.value = JSON.stringify(current, null, 2)
  update()
}

/**
 * 更新输入映射的键名。
 * @param {string} oldKey - 旧键名
 * @param {string} newKey - 新键名
 */
function updateInputMapKey(oldKey, newKey) {
  const current = { ...parsedConfigJson.value }
  if (!current.input_map)
    return
  const val = current.input_map[oldKey]
  delete current.input_map[oldKey]
  current.input_map[newKey] = val
  configJsonStr.value = JSON.stringify(current, null, 2)
  update()
}

/**
 * 更新输入映射的值。
 * @param {string} key - 键名
 * @param {*} value - 新值
 */
function updateInputMapValue(key, value) {
  updateNestedConfigJson(`input_map.${key}`, value)
}

/**
 * 删除一组输入映射条目。
 * @param {string} key - 键名
 */
function removeInputMapEntry(key) {
  const current = { ...parsedConfigJson.value }
  if (current.input_map) {
    delete current.input_map[key]
  }
  configJsonStr.value = JSON.stringify(current, null, 2)
  update()
}
</script>

<template>
  <div class="border border-base-300 rounded-lg p-4 space-y-3">
    <div class="grid grid-cols-3 gap-3">
      <div>
        <label class="label text-xs pb-1">动作类型</label>
        <select
          :value="action.actionType"
          class="select select-bordered select-sm w-full"
          @change="updateField('actionType', $event.target.value)"
        >
          <option v-for="t in actionTypes" :key="t" :value="t">
            {{ actionTypeLabel(t) }}
          </option>
        </select>
      </div>
      <div>
        <label class="label text-xs pb-1">目标字段</label>
        <select
          :value="action.targetField"
          class="select select-bordered select-sm w-full"
          @change="updateField('targetField', $event.target.value)"
        >
          <option value="">
            -- Select --
          </option>
          <option v-for="f in outputFields" :key="f.fieldKey" :value="f.fieldKey">
            {{ f.fieldName }} ({{ f.fieldKey }})
          </option>
        </select>
      </div>
      <div>
        <label class="label text-xs pb-1">排序</label>
        <input
          :value="action.sort"
          type="number"
          class="input input-bordered input-sm w-full"
          @change="updateField('sort', $event.target.value)"
        >
      </div>
    </div>

    <div v-if="action.actionType === 'set'">
      <label class="label text-xs pb-1">值</label>
      <input
        :value="parsedConfigJson.value"
        type="text"
        class="input input-bordered input-sm w-full"
        @change="updateConfigJsonField('value', $event.target.value)"
      >
    </div>

    <div v-if="action.actionType === 'lookup'">
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="label text-xs pb-1">查找表</label>
          <select
            :value="parsedConfigJson.table_id"
            class="select select-bordered select-sm w-full"
            @change="updateConfigJsonField('table_id', $event.target.value)"
          >
            <option value="">
              -- 请选择 --
            </option>
            <option v-for="t in lookupTables" :key="t.tableId" :value="t.tableId">
              {{ t.tableName }}
            </option>
          </select>
        </div>
        <div>
          <label class="label text-xs pb-1">输出列</label>
          <input
            :value="parsedConfigJson.output_column"
            type="text"
            class="input input-bordered input-sm w-full"
            placeholder="输出列名"
            @change="updateConfigJsonField('output_column', $event.target.value)"
          >
        </div>
      </div>
      <div class="mt-3">
        <label class="label text-xs pb-1">输入映射</label>
        <div class="space-y-1 mb-2">
          <div
            v-for="(val, key) in parsedConfigJson.input_map || {}"
            :key="key"
            class="flex gap-2 items-center"
          >
            <input
              :value="key"
              type="text"
              class="input input-bordered input-sm w-32"
              placeholder="列名"
              @change="updateInputMapKey(key, $event.target.value)"
            >
            <span class="text-sm"> &larr; </span>
            <select
              :value="val"
              class="select select-bordered select-sm flex-1"
              @change="updateInputMapValue(key, $event.target.value)"
            >
              <option value="">
                -- 源字段 --
              </option>
              <option v-for="f in fields" :key="f.fieldKey" :value="f.fieldKey">
                {{ f.fieldName || f.fieldKey }}
              </option>
            </select>
            <button class="btn btn-ghost btn-xs text-error" @click="removeInputMapEntry(key)">
              x
            </button>
          </div>
        </div>
        <button class="btn btn-ghost btn-xs" @click="addInputMapEntry">
          + 新增映射
        </button>
      </div>
    </div>

    <div v-if="action.actionType === 'branch'">
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="label text-xs pb-1">条件字段</label>
          <select
            :value="parsedConfigJson.when?.field"
            class="select select-bordered select-sm w-full"
            @change="updateNestedConfigJson('when.field', $event.target.value)"
          >
            <option value="">
              -- 请选择 --
            </option>
            <option v-for="f in fields" :key="f.fieldKey" :value="f.fieldKey">
              {{ f.fieldName || f.fieldKey }}
            </option>
          </select>
        </div>
        <div>
          <label class="label text-xs pb-1">运算符</label>
          <select
            :value="parsedConfigJson.when?.operator"
            class="select select-bordered select-sm w-full"
            @change="updateNestedConfigJson('when.operator', $event.target.value)"
          >
            <option value="eq">
              =
            </option>
            <option value="neq">
              !=
            </option>
            <option value="gt">
              &gt;
            </option>
            <option value="gte">
              &gt;=
            </option>
            <option value="lt">
              &lt;
            </option>
            <option value="lte">
              &lt;=
            </option>
          </select>
        </div>
        <div>
          <label class="label text-xs pb-1">条件值</label>
          <input
            :value="parsedConfigJson.when?.value"
            type="text"
            class="input input-bordered input-sm w-full"
            @change="updateNestedConfigJson('when.value', $event.target.value === 'true' ? true : $event.target.value === 'false' ? false : $event.target.value)"
          >
        </div>
      </div>
      <div class="mt-3 flex gap-2">
        <div class="flex-1">
          <label class="label text-xs pb-1">
            <span class="badge badge-success badge-xs mr-1">满足条件</span>
          </label>
          <select
            :value="parsedConfigJson.then?.type"
            class="select select-bordered select-sm w-full mb-1"
            @change="updateNestedConfigJson('then.type', $event.target.value)"
          >
            <option value="set">
              赋值
            </option>
            <option value="lookup">
              查表
            </option>
          </select>
          <input
            v-if="parsedConfigJson.then?.type === 'set' || !parsedConfigJson.then?.type"
            :value="parsedConfigJson.then?.value"
            type="text"
            class="input input-bordered input-sm w-full"
            placeholder="值"
            @change="updateNestedConfigJson('then.value', $event.target.value)"
          >
        </div>
        <div class="flex-1">
          <label class="label text-xs pb-1">
            <span class="badge badge-error badge-xs mr-1">否则</span>
          </label>
          <select
            :value="parsedConfigJson.else?.type"
            class="select select-bordered select-sm w-full mb-1"
            @change="updateNestedConfigJson('else.type', $event.target.value)"
          >
            <option value="set">
              赋值
            </option>
            <option value="lookup">
              查表
            </option>
          </select>
          <input
            v-if="parsedConfigJson.else?.type === 'set' || !parsedConfigJson.else?.type"
            :value="parsedConfigJson.else?.value"
            type="text"
            class="input input-bordered input-sm w-full"
            placeholder="值"
            @change="updateNestedConfigJson('else.value', $event.target.value)"
          >
        </div>
      </div>
    </div>

    <details class="collapse collapse-arrow border border-base-300">
      <summary class="collapse-title text-xs font-medium">
        原始 config_json
      </summary>
      <div class="collapse-content">
        <textarea
          v-model="configJsonStr"
          class="textarea textarea-bordered textarea-sm w-full font-mono text-xs"
          rows="6"
          @change="update"
        />
      </div>
    </details>
  </div>
</template>
