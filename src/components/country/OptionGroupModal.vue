<script setup>
import { driver } from 'driver.js'
import { reactive, ref, watch } from 'vue'
import { VueDraggableNext } from 'vue-draggable-next'
import { useConfigStore } from '@/stores/config'
import 'driver.js/dist/driver.css'

const props = defineProps({
  open: Boolean,
  groupIdx: Number,
  cpId: String,
})
const emit = defineEmits(['close'])

const store = useConfigStore()
const form = reactive({})
const items = ref([])
let _uid = 0

const optionEditSteps = [
  {
    popover: {
      title: '编辑选项组',
      description: '选项组为下拉字段提供可选值。编号建议带国家前缀（如 br_刊登类型）。',
    },
  },
  {
    element: '[data-tour="opt-items"]',
    popover: {
      title: '选项值',
      description:
        '选项值=存储值（code），显示名=用户看到的文本。启用=否则该选项不出现在下拉框中。拖拽左侧三条杠可排序。',
    },
  },
]

function startTour(steps) {
  const d = driver({
    showProgress: true,
    animate: true,
    prevBtnText: '上一步',
    nextBtnText: '下一步',
    doneBtnText: '知道了',
    closeBtnText: '✕',
  })
  d.setSteps(steps)
  d.drive()
}

watch(
  () => props.open,
  (v) => {
    if (!v)
      return
    _uid = 0
    if (props.groupIdx >= 0) {
      const groups = store.getOptionGroupsByCountry(props.cpId)
      const g = groups[props.groupIdx]
      Object.assign(form, JSON.parse(JSON.stringify(g)))
      items.value = JSON.parse(JSON.stringify(store.getOptionItemsByGroup(g.编号))).map(item => ({
        ...item,
        _uid: ++_uid,
      }))
    }
    else {
      Object.assign(form, { 编号: '', 名称: '', 所属国家平台: props.cpId, 说明: '' })
      items.value = []
    }
  },
)

function addItem() {
  items.value.push({
    _uid: ++_uid,
    所属分组: form.编号,
    选项值: '',
    显示名: '',
    排序: '',
    启用: '是',
    备注: '',
  })
}
function delItem(i) {
  items.value.splice(i, 1)
}

function save() {
  if (props.groupIdx >= 0) {
    const groups = store.getOptionGroupsByCountry(props.cpId)
    const x = store['选项组'].indexOf(groups[props.groupIdx])
    if (x !== -1)
      store['选项组'][x] = { ...form }
    const keep = store['选项值'].filter(r => r.所属分组 !== form.编号)
    store['选项值'] = [...keep, ...items.value]
  }
  else {
    store['选项组'].push({ ...form })
    store['选项值'] = [...store['选项值'], ...items.value]
  }
  emit('close')
}

function deleteGroup() {
  if (props.groupIdx >= 0) {
    const groups = store.getOptionGroupsByCountry(props.cpId)
    const g = groups[props.groupIdx]
    store['选项组'] = store['选项组'].filter(r => r.编号 !== g.编号)
    store['选项值'] = store['选项值'].filter(r => r.所属分组 !== g.编号)
  }
  emit('close')
}
</script>

<template>
  <dialog :open="open" class="modal">
    <div class="modal-box max-w-2xl max-h-[85vh] overflow-y-auto">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-bold">
          {{ groupIdx >= 0 ? "编辑选项组" : "新建选项组" }}
        </h3>
        <button class="btn btn-ghost btn-sm btn-circle" @click="startTour(optionEditSteps)">
          ?
        </button>
      </div>
      <div class="grid grid-cols-3 gap-3 mb-4">
        <div>
          <label class="label py-0 text-xs">编号</label>
          <input v-model="form.编号" class="input input-bordered input-sm w-full">
        </div>
        <div>
          <label class="label py-0 text-xs">名称</label>
          <input v-model="form.名称" class="input input-bordered input-sm w-full">
        </div>
        <div>
          <label class="label py-0 text-xs">说明</label>
          <input v-model="form.说明" class="input input-bordered input-sm w-full">
        </div>
      </div>
      <div>
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm font-semibold" data-tour="opt-items">选项值（{{ items.length }}）</span>
          <button class="btn btn-xs btn-primary" @click="addItem">
            ＋
          </button>
        </div>
        <table v-if="items.length" class="table table-xs">
          <thead>
            <tr>
              <th class="w-8" />
              <th>选项值</th>
              <th>显示名</th>
              <th>排序</th>
              <th>启用</th>
              <th />
            </tr>
          </thead>
          <VueDraggableNext
            :list="items"
            tag="tbody"
            :animation="200"
            handle=".drag-handle"
            ghost-class="bg-base-300"
            :item-key="(item) => item._uid"
            no-transition-on-drag
          >
            <tr v-for="(item, i) in items" :key="i">
              <td>
                <span
                  class="drag-handle cursor-grab text-base-content/30 hover:text-base-content flex items-center justify-center select-none text-xs px-0.5"
                  title="拖拽排序"
                >☰</span>
              </td>
              <td><input v-model="item.选项值" class="input input-bordered input-xs w-20"></td>
              <td><input v-model="item.显示名" class="input input-bordered input-xs w-24"></td>
              <td><input v-model="item.排序" class="input input-bordered input-xs w-12"></td>
              <td>
                <select v-model="item.启用" class="select select-bordered select-xs w-16">
                  <option>是</option>
                  <option>否</option>
                </select>
              </td>
              <td>
                <button class="btn btn-ghost btn-xs text-error" @click="delItem(i)">
                  🗑️
                </button>
              </td>
            </tr>
          </VueDraggableNext>
        </table>
      </div>
      <div class="modal-action">
        <button v-if="groupIdx >= 0" class="btn btn-error btn-sm btn-outline" @click="deleteGroup">
          删除
        </button>
        <button class="btn btn-ghost btn-sm" @click="emit('close')">
          取消
        </button>
        <button class="btn btn-primary btn-sm" @click="save">
          保存
        </button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop" @click="emit('close')">
      <button>关闭</button>
    </form>
  </dialog>
</template>
