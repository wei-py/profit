<script setup>
import { driver } from 'driver.js'
import { ref, watch } from 'vue'
import { useConfigStore } from '@/stores/config'
import 'driver.js/dist/driver.css'

const props = defineProps({
  open: Boolean,
  tableName: String,
})
const emit = defineEmits(['close'])

const store = useConfigStore()
const newName = ref('')
const rowsLocal = ref([])

const lookupEditSteps = [
  {
    popover: {
      title: '查表编辑',
      description:
        '编辑费率表数据。表名可修改（同步更新所有规则中的引用）。＋行列增删行列。列头✕可删除整列。',
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
    newName.value = props.tableName
    rowsLocal.value = JSON.parse(JSON.stringify(store.lookupTables[props.tableName] || []))
  },
)

function addRow() {
  if (!rowsLocal.value.length) {
    rowsLocal.value.push({})
    return
  }
  const row = {}
  for (const k of Object.keys(rowsLocal.value[0])) row[k] = ''
  rowsLocal.value.push(row)
}
function delRow(i) {
  rowsLocal.value.splice(i, 1)
}

const newCol = ref('')
function addCol() {
  const col = newCol.value.trim()
  if (!col)
    return
  for (const row of rowsLocal.value) {
    if (!(col in row))
      row[col] = ''
  }
  rowsLocal.value = [...rowsLocal.value]
  newCol.value = ''
}
function delCol(col) {
  for (const row of rowsLocal.value) delete row[col]
  rowsLocal.value = [...rowsLocal.value]
}

function save() {
  const oldName = props.tableName
  const nn = newName.value.trim()
  if (!nn)
    return
  if (oldName !== nn) {
    store.lookupTables = { ...store.lookupTables, [nn]: rowsLocal.value }
    delete store.lookupTables[oldName]
    for (const r of store['费用规则']) {
      if (r.查表名称 === oldName)
        r.查表名称 = nn
    }
  }
  else {
    store.lookupTables = { ...store.lookupTables, [nn]: rowsLocal.value }
  }
  emit('close')
}
</script>

<template>
  <dialog :open="open" class="modal">
    <div class="modal-box w-11/12 max-w-4xl max-h-[85vh] overflow-y-auto">
      <div class="flex items-center gap-2 mb-4">
        <h3 class="text-lg font-bold">
          查表：
        </h3>
        <input v-model="newName" class="input input-bordered input-sm w-48 font-mono">
        <button class="btn btn-ghost btn-sm btn-circle ml-auto" @click="startTour(lookupEditSteps)">
          ?
        </button>
      </div>
      <div class="flex gap-2 mb-3">
        <button class="btn btn-xs btn-ghost" @click="addRow">
          ＋ 行
        </button>
        <button class="btn btn-xs btn-ghost" @click="addCol">
          ＋ 列
        </button>
        <input
          v-model="newCol"
          class="input input-bordered input-xs w-24"
          placeholder="列名"
          @keyup.enter="addCol"
        >
      </div>
      <div v-if="rowsLocal.length" class="overflow-x-auto">
        <table class="table table-xs">
          <thead>
            <tr>
              <th v-for="k in Object.keys(rowsLocal[0] || {})" :key="k" class="relative group">
                {{ k }}
                <button
                  class="btn btn-ghost btn-xs opacity-0 group-hover:opacity-100 text-error absolute -top-1 -right-1"
                  @click="delCol(k)"
                >
                  ✕
                </button>
              </th>
              <th class="w-12" />
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, i) in rowsLocal" :key="i">
              <td v-for="k in Object.keys(rowsLocal[0] || {})" :key="k">
                <input v-model="row[k]" class="input input-bordered input-xs w-full">
              </td>
              <td>
                <button class="btn btn-ghost btn-xs text-error" @click="delRow(i)">
                  🗑️
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="text-xs text-base-content/40 mb-4">
        空表，点击「＋ 行」或「＋ 列」开始
      </div>
      <div class="modal-action">
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
