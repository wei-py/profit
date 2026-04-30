<script setup>
import { computed, reactive, ref } from 'vue'
import EditableTable from '@/components/common/EditableTable.vue'
import { useConfigStore } from '@/stores/config'

const store = useConfigStore()
const selectedCountryId = ref(store['国家平台'].find(c => c.启用 === '是')?.编号 || '')
const selectedTemplateId = ref('')

const enabledCountries = computed(() =>
  store['国家平台'].filter(c => c.启用 === '是' || c.启用 === 'TRUE'),
)

const countryTemplates = computed(() =>
  store.getTemplatesByCountry(selectedCountryId.value),
)

const templateRules = computed(() => {
  if (!selectedTemplateId.value) return []
  return store.getFeeRulesByTemplate(selectedTemplateId.value)
})

const templateParams = computed(() => {
  if (!selectedTemplateId.value) return []
  return store.getTemplateParams(selectedTemplateId.value)
})

// 当前国家的所有字段（用于下拉选项）
const countryFields = computed(() =>
  store.getFieldsByCountry(selectedCountryId.value),
)
const fieldKeys = computed(() => countryFields.value.map(f => f.字段键))
const outputFieldKeys = computed(() =>
  countryFields.value.filter(f => f.输入输出 === '输出' || f.输入输出 === 'output').map(f => f.字段键),
)

// ── 模板表 ──
const templateColumns = [
  { key: '编号', label: '编号', type: 'text' },
  { key: '名称', label: '名称', type: 'text' },
  { key: '所属国家平台', label: '所属国家平台', type: 'text' },
  { key: '启用', label: '启用', type: 'boolean' },
  { key: '说明', label: '说明', type: 'text' },
]

// ── 规则摘要列 ──
const ruleSummaryColumns = [
  { key: '编号', label: '编号', type: 'text' },
  { key: '输出字段键', label: '输出到', type: 'text' },
  { key: '计算方式', label: '计算方式', type: 'text' },
  { key: '条件摘要', label: '条件', type: 'text' },
  { key: '计算顺序', label: '顺序', type: 'number' },
  { key: '启用', label: '启用', type: 'boolean' },
]

// ── 规则编辑弹窗 ──
const showRuleModal = ref(false)
const editingIndex = ref(-1)
const ruleForm = reactive({})

function conditionSummary(r) {
  const parts = []
  if (r.条件1字段) parts.push(`${r.条件1字段} ${r.条件1运算符 || ''} ${r.条件1值}`)
  if (r.条件2字段) parts.push(`AND ${r.条件2字段} ${r.条件2运算符 || ''} ${r.条件2值}`)
  return parts.join(' ') || '无条件'
}

function openNewRule() {
  editingIndex.value = -1
  Object.assign(ruleForm, {
    编号: '', 所属模板: selectedTemplateId.value, 输出字段键: '', 费用名称: '',
    计算顺序: '', 启用: '是',
    条件1字段: '', 条件1运算符: '', 条件1值: '', 条件1值2: '',
    条件2字段: '', 条件2运算符: '', 条件2值: '', 条件2值2: '',
    计算方式: '', 查表名称: '', 匹配方式: '', 输入映射: '', 输出列: '',
    百分比基数: '', 百分比值: '', 百分比来源字段: '',
    固定金额: '', 加总字段: '', 公式: '', 累加: '否', 说明: '',
  })
  showRuleModal.value = true
}

function openEditRule(idx) {
  editingIndex.value = idx
  const realIdx = store['费用规则'].indexOf(templateRules.value[idx])
  Object.assign(ruleForm, JSON.parse(JSON.stringify(store['费用规则'][realIdx])))
  showRuleModal.value = true
}

function saveRule() {
  if (editingIndex.value >= 0) {
    const realIdx = store['费用规则'].indexOf(templateRules.value[editingIndex.value])
    if (realIdx !== -1) store['费用规则'][realIdx] = { ...ruleForm }
  }
  else {
    store['费用规则'].push({ ...ruleForm })
  }
  showRuleModal.value = false
}

function deleteRuleFromModal() {
  if (editingIndex.value >= 0) {
    const realIdx = store['费用规则'].indexOf(templateRules.value[editingIndex.value])
    if (realIdx !== -1) store['费用规则'].splice(realIdx, 1)
  }
  showRuleModal.value = false
}

// ── 模板 params ──
const paramColumns = [
  { key: '模板编号', label: '模板编号', type: 'text' },
  { key: '字段键', label: '字段键', type: 'text' },
  { key: '默认值', label: '默认值', type: 'text' },
  { key: '必填', label: '必填', type: 'boolean' },
]

function handleCountryChange(e) {
  selectedCountryId.value = e.target.value
  selectedTemplateId.value = ''
}

function onAddTemplate() {
  store['计算模板'].push({ 编号: '', 名称: '', 所属国家平台: selectedCountryId.value, 启用: '是', 说明: '' })
}
function onUpdateTemplate({ index, row }) {
  const idx = store['计算模板'].indexOf(countryTemplates.value[index])
  if (idx !== -1) store['计算模板'][idx] = row
}
function onDeleteTemplate({ index }) {
  const idx = store['计算模板'].indexOf(countryTemplates.value[index])
  if (idx !== -1) store['计算模板'].splice(idx, 1)
}

function onAddParam() {
  store['模板参数'].push({ 模板编号: selectedTemplateId.value, 字段键: '', 默认值: '', 必填: '否' })
}
function onUpdateParam({ index, row }) {
  const idx = store['模板参数'].indexOf(templateParams.value[index])
  if (idx !== -1) store['模板参数'][idx] = row
}
function onDeleteParam({ index }) {
  const idx = store['模板参数'].indexOf(templateParams.value[index])
  if (idx !== -1) store['模板参数'].splice(idx, 1)
}
</script>

<template>
  <div class="h-full flex flex-col overflow-hidden">
    <h1 class="text-2xl font-bold mb-4">模板管理</h1>

    <div class="mb-4 flex gap-4 items-end">
      <div>
        <label class="label py-1"><span class="label-text">国家平台</span></label>
        <select class="select select-bordered w-full max-w-xs" :value="selectedCountryId" @change="handleCountryChange">
          <option value="">-- 选择国家 --</option>
          <option v-for="c in enabledCountries" :key="c.编号" :value="c.编号">{{ c.国家 }} - {{ c.平台 }}</option>
        </select>
      </div>
      <div v-if="selectedCountryId">
        <label class="label py-1"><span class="label-text">模板</span></label>
        <select v-model="selectedTemplateId" class="select select-bordered w-full max-w-xs">
          <option value="">-- 选择模板 --</option>
          <option v-for="t in countryTemplates" :key="t.编号" :value="t.编号">{{ t.名称 }}</option>
        </select>
      </div>
    </div>

    <div class="flex-1 min-h-0 space-y-6 overflow-y-auto">
      <!-- 模板列表 -->
      <div class="card card-sm bg-base-100 border border-base-300">
        <div class="card-body">
          <h2 class="card-title text-lg">计算模板</h2>
          <EditableTable :columns="templateColumns" :rows="countryTemplates" id-key="编号"
            @add="onAddTemplate" @update="onUpdateTemplate" @delete="onDeleteTemplate" />
        </div>
      </div>

      <template v-if="selectedTemplateId">
        <!-- 费用规则 -->
        <div class="card card-sm bg-base-100 border border-base-300">
          <div class="card-body">
            <div class="flex items-center justify-between">
              <h2 class="card-title text-lg">费用规则（{{ templateRules.length }} 条）</h2>
              <button class="btn btn-primary btn-sm" @click="openNewRule">＋ 新建规则</button>
            </div>

            <div class="text-sm text-base-content/60 mb-2">
              💡 同行多个条件 = AND；不同行同输出字段键 = OR。点击行可编辑。
            </div>

            <table class="table table-sm">
              <thead>
                <tr>
                  <th>编号</th>
                  <th>输出到</th>
                  <th>计算方式</th>
                  <th>条件</th>
                  <th>顺序</th>
                  <th>启用</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(r, i) in templateRules" :key="r.编号 || i" class="hover cursor-pointer"
                  @click="openEditRule(i)">
                  <td class="font-mono text-xs">{{ r.编号 }}</td>
                  <td>{{ r.输出字段键 }}</td>
                  <td><span class="badge badge-sm">{{ r.计算方式 }}</span></td>
                  <td class="text-xs text-base-content/70">{{ conditionSummary(r) }}</td>
                  <td>{{ r.计算顺序 }}</td>
                  <td>{{ r.启用 === '是' ? '✅' : '—' }}</td>
                  <td>
                    <button class="btn btn-ghost btn-xs text-error"
                      @click.stop="onDeleteRule({ index: i })">🗑️</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- 模板参数 -->
        <div class="card card-sm bg-base-100 border border-base-300">
          <div class="card-body">
            <h2 class="card-title text-lg">模板参数（默认值）</h2>
            <EditableTable :columns="paramColumns" :rows="templateParams" id-key="字段键"
              @add="onAddParam" @update="onUpdateParam" @delete="onDeleteParam" />
          </div>
        </div>
      </template>
    </div>

    <!-- 规则编辑弹窗 -->
    <dialog :open="showRuleModal" class="modal">
      <div class="modal-box w-11/12 max-w-3xl max-h-[90vh] overflow-y-auto">
        <h3 class="text-lg font-bold mb-4">{{ editingIndex >= 0 ? '编辑规则' : '新建规则' }}</h3>

        <!-- 基本信息 -->
        <fieldset class="fieldset mb-4">
          <legend class="font-semibold text-sm mb-2">基本信息</legend>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div class="form-control">
              <label class="label py-0"><span class="label-text text-xs">编号</span></label>
              <input v-model="ruleForm.编号" class="input input-bordered input-sm" placeholder="r_br_001">
            </div>
            <div class="form-control">
              <label class="label py-0"><span class="label-text text-xs">费用名称</span></label>
              <input v-model="ruleForm.费用名称" class="input input-bordered input-sm" placeholder="销售佣金费率">
            </div>
            <div class="form-control">
              <label class="label py-0"><span class="label-text text-xs">计算顺序</span></label>
              <input v-model="ruleForm.计算顺序" type="number" class="input input-bordered input-sm" placeholder="10">
            </div>
            <div class="form-control">
              <label class="label py-0"><span class="label-text text-xs">启用</span></label>
              <select v-model="ruleForm.启用" class="select select-bordered select-sm">
                <option>是</option><option>否</option>
              </select>
            </div>
          </div>
          <div class="form-control mt-2">
            <label class="label py-0"><span class="label-text text-xs">输出字段键（结果写到哪个字段）</span></label>
            <input v-model="ruleForm.输出字段键" class="input input-bordered input-sm" list="outputKeys" placeholder="销售佣金费率">
            <datalist id="outputKeys">
              <option v-for="k in outputFieldKeys" :key="k" :value="k" />
            </datalist>
          </div>
        </fieldset>

        <!-- 条件 -->
        <fieldset class="fieldset mb-4 p-3 bg-base-200 rounded">
          <legend class="font-semibold text-sm mb-2">条件设置</legend>
          <div class="text-xs text-base-content/60 mb-2">
            ⚡ 条件1 AND 条件2 = 同行两个条件都满足才触发。OR = 拆成两条规则，同输出字段键。
          </div>

          <div class="grid grid-cols-4 gap-2 mb-2">
            <div class="form-control">
              <label class="label py-0"><span class="label-text text-xs">条件1 字段</span></label>
              <input v-model="ruleForm.条件1字段" class="input input-bordered input-sm" list="allKeys" placeholder="是否包邮">
            </div>
            <div class="form-control">
              <label class="label py-0"><span class="label-text text-xs">运算符</span></label>
              <select v-model="ruleForm.条件1运算符" class="select select-bordered select-sm">
                <option value="">—</option>
                <option>等于</option><option>不等于</option>
                <option>大于</option><option>大于等于</option>
                <option>小于</option><option>小于等于</option>
              </select>
            </div>
            <div class="form-control">
              <label class="label py-0"><span class="label-text text-xs">值</span></label>
              <input v-model="ruleForm.条件1值" class="input input-bordered input-sm" placeholder="是">
            </div>
            <div class="form-control">
              <label class="label py-0"><span class="label-text text-xs">值2（between用）</span></label>
              <input v-model="ruleForm.条件1值2" class="input input-bordered input-sm">
            </div>
          </div>

          <div class="text-xs font-semibold mb-1">{{ ruleForm.条件2字段 ? 'AND' : '+ AND 条件2（可选）' }}</div>
          <div class="grid grid-cols-4 gap-2">
            <input v-model="ruleForm.条件2字段" class="input input-bordered input-sm" list="allKeys" placeholder="字段">
            <select v-model="ruleForm.条件2运算符" class="select select-bordered select-sm">
              <option value="">—</option>
              <option>等于</option><option>不等于</option>
              <option>大于</option><option>大于等于</option>
              <option>小于</option><option>小于等于</option>
            </select>
            <input v-model="ruleForm.条件2值" class="input input-bordered input-sm" placeholder="值">
            <input v-model="ruleForm.条件2值2" class="input input-bordered input-sm" placeholder="值2">
          </div>

          <datalist id="allKeys">
            <option v-for="k in fieldKeys" :key="k" :value="k" />
          </datalist>
        </fieldset>

        <!-- 计算配置 -->
        <fieldset class="fieldset mb-4">
          <legend class="font-semibold text-sm mb-2">计算配置</legend>
          <div class="form-control mb-2">
            <label class="label py-0"><span class="label-text text-xs">计算方式</span></label>
            <select v-model="ruleForm.计算方式" class="select select-bordered select-sm w-full max-w-xs">
              <option value="">— 选择 —</option>
              <option>查表</option><option>百分比</option><option>固定值</option><option>加总</option><option>公式</option>
            </select>
          </div>

          <!-- 查表 -->
          <template v-if="ruleForm.计算方式 === '查表'">
            <div class="grid grid-cols-2 gap-2">
              <div class="form-control">
                <label class="label py-0"><span class="label-text text-xs">查表名称（Sheet名）</span></label>
                <input v-model="ruleForm.查表名称" class="input input-bordered input-sm" placeholder="commission_table">
              </div>
              <div class="form-control">
                <label class="label py-0"><span class="label-text text-xs">匹配方式</span></label>
                <select v-model="ruleForm.匹配方式" class="select select-bordered select-sm">
                  <option value="">—</option><option>精确</option><option>区间</option>
                </select>
              </div>
              <div class="form-control">
                <label class="label py-0"><span class="label-text text-xs">输入映射（字段键=表列名, 逗号分隔）</span></label>
                <input v-model="ruleForm.输入映射" class="input input-bordered input-sm" placeholder="刊登类型=刊登类型,商品类目=类目">
              </div>
              <div class="form-control">
                <label class="label py-0"><span class="label-text text-xs">输出列（取费率表哪一列）</span></label>
                <input v-model="ruleForm.输出列" class="input input-bordered input-sm" placeholder="费率">
              </div>
            </div>
          </template>

          <!-- 百分比 -->
          <template v-if="ruleForm.计算方式 === '百分比'">
            <div class="grid grid-cols-3 gap-2">
              <div class="form-control">
                <label class="label py-0"><span class="label-text text-xs">百分比基数</span></label>
                <input v-model="ruleForm.百分比基数" class="input input-bordered input-sm" list="allKeys" placeholder="售价">
              </div>
              <div class="form-control">
                <label class="label py-0"><span class="label-text text-xs">固定百分比值</span></label>
                <input v-model="ruleForm.百分比值" class="input input-bordered input-sm" placeholder="4.8（表示4.8%）">
              </div>
              <div class="form-control">
                <label class="label py-0"><span class="label-text text-xs">或用 动态来源字段</span></label>
                <input v-model="ruleForm.百分比来源字段" class="input input-bordered input-sm" list="allKeys" placeholder="销售佣金费率">
              </div>
            </div>
          </template>

          <!-- 固定值 -->
          <template v-if="ruleForm.计算方式 === '固定值'">
            <div class="form-control">
              <label class="label py-0"><span class="label-text text-xs">固定金额</span></label>
              <input v-model="ruleForm.固定金额" class="input input-bordered input-sm w-32" placeholder="0">
            </div>
          </template>

          <!-- 加总 -->
          <template v-if="ruleForm.计算方式 === '加总'">
            <div class="form-control">
              <label class="label py-0"><span class="label-text text-xs">加总字段（逗号分隔）</span></label>
              <input v-model="ruleForm.加总字段" class="input input-bordered input-sm w-full" list="allKeys" placeholder="销售佣金金额,运费,支付手续费">
            </div>
          </template>

          <!-- 公式 -->
          <template v-if="ruleForm.计算方式 === '公式'">
            <div class="form-control">
              <label class="label py-0"><span class="label-text text-xs">公式（中文字段键 + - * /）</span></label>
              <input v-model="ruleForm.公式" class="input input-bordered input-sm w-full font-mono" placeholder="售价 - 总费用 - 成本价">
            </div>
          </template>
        </fieldset>

        <!-- 说明 -->
        <div class="form-control mb-4">
          <label class="label py-0"><span class="label-text text-xs">说明</span></label>
          <input v-model="ruleForm.说明" class="input input-bordered input-sm w-full" placeholder="规则说明">
        </div>

        <div class="modal-action">
          <button v-if="editingIndex >= 0" class="btn btn-error btn-sm btn-outline" @click="deleteRuleFromModal">删除规则</button>
          <button class="btn btn-ghost btn-sm" @click="showRuleModal = false">取消</button>
          <button class="btn btn-primary btn-sm" @click="saveRule">保存</button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop" @click="showRuleModal = false"><button>关闭</button></form>
    </dialog>
  </div>
</template>
