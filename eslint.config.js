import antfu from '@antfu/eslint-config'

export default antfu({
  vue: true,
  ignores: ['**/.kilo/**', '**/node_modules/**', '**/dist/**', '**/src-tauri/target/**'],
})
