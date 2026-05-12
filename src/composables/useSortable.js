import { Sortable } from "@shopify/draggable";
import { isRef, onMounted, onUnmounted, watch } from "vue";

export function useSortable(containerRef, list, options = {}) {
  let sortable = null;

  function spliceList(oldIndex, newIndex) {
    if (options.onSplice) {
      options.onSplice(oldIndex, newIndex);
      return;
    }
    if (isRef(list)) {
      const arr = [...list.value];
      const [moved] = arr.splice(oldIndex, 1);
      arr.splice(newIndex, 0, moved);
      list.value = arr;
    } else {
      const [moved] = list.splice(oldIndex, 1);
      list.splice(newIndex, 0, moved);
    }
  }

  function init() {
    if (!containerRef.value || sortable) return;
    const { handle, draggable, onEnd } = options;
    const opts = {
      draggable: draggable || ".sortable-item",
      plugins: [],
      mirror: { constrainDimensions: true, appendTo: document.body },
    };
    if (handle) opts.handle = handle;
    sortable = new Sortable(containerRef.value, opts);

    sortable.on("mirror:created", (evt) => {
      evt.mirror.style.clipPath = "inset(100%)";
      evt.mirror.style.opacity = "0";
    });

    sortable.on("mirror:moved", (evt) => {
      evt.mirror.style.clipPath = "";
      evt.mirror.style.opacity = "0.9";
      evt.mirror.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
    });

    sortable.on("sortable:stop", (e) => {
      const { oldIndex, newIndex } = e;
      if (oldIndex === newIndex) return;
      spliceList(oldIndex, newIndex);
      if (onEnd) onEnd();
    });
  }

  function destroy() {
    if (sortable) {
      sortable.destroy();
      sortable = null;
    }
  }

  onMounted(init);
  onUnmounted(destroy);
  watch(containerRef, (el) => {
    destroy();
    if (el) init();
  });

  return { sortable };
}
