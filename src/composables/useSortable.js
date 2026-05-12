import { Plugins, Sortable } from '@shopify/draggable'
import { isRef, onMounted, onUnmounted, watch } from 'vue'

export function useSortable(containerRef, list, options = {}) {
  let sortable = null

  function spliceList(oldIndex, newIndex) {
    if (isRef(list)) {
      const arr = [...list.value]
      const [moved] = arr.splice(oldIndex, 1)
      arr.splice(newIndex, 0, moved)
      list.value = arr
    }
    else {
      const [moved] = list.splice(oldIndex, 1)
      list.splice(newIndex, 0, moved)
    }
  }

  function init() {
    if (!containerRef.value || sortable)
      return
    const { handle, draggable, animation, onEnd } = options
    const opts = {
      draggable: draggable || '.sortable-item',
      plugins: [Plugins.SortAnimation],
      sortAnimation: animation ? { duration: animation, easingFunction: 'ease' } : { duration: 200, easingFunction: 'ease' },
      mirror: { constrainDimensions: true },
    }
    if (handle)
      opts.handle = handle
    sortable = new Sortable(containerRef.value, opts)
    sortable.on('sortable:stop', (e) => {
      const { oldIndex, newIndex } = e
      if (oldIndex === newIndex)
        return
      spliceList(oldIndex, newIndex)
      if (onEnd)
        onEnd()
    })
  }

  function destroy() {
    if (sortable) {
      sortable.destroy()
      sortable = null
    }
  }

  onMounted(init)
  onUnmounted(destroy)
  watch(containerRef, (el) => {
    destroy()
    if (el)
      init()
  })

  return { sortable }
}
