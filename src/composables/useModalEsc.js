import { onBeforeUnmount, watch } from "vue";

let uid = 0;
const stack = [];

function remove(id) {
  const idx = stack.indexOf(id);
  if (idx !== -1)
    stack.splice(idx, 1);
}

function add(id) {
  remove(id);
  stack.push(id);
}

function isOpenValue(source) {
  if (typeof source === "function")
    return !!source();
  return !!source?.value;
}

export function useModalEsc(openSource, close) {
  const id = ++uid;

  watch(
    openSource,
    (open) => {
      if (open)
        add(id);
      else remove(id);
    },
    { immediate: true },
  );

  function onKeydown(event) {
    if (event.key !== "Escape" || !isOpenValue(openSource))
      return;
    if (stack[stack.length - 1] !== id)
      return;
    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === "function")
      event.stopImmediatePropagation();
    close();
  }

  document.addEventListener("keydown", onKeydown, true);

  onBeforeUnmount(() => {
    document.removeEventListener("keydown", onKeydown, true);
    remove(id);
  });
}
