import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './style.css'

/**
 * 应用入口文件。
 * 初始化 Pinia、路由、主题，挂载 Vue 应用。
 */

const localTheme = localStorage.getItem('profit-theme')
if (localTheme === 'me' || localTheme === 'me-dark') {
  document.documentElement.setAttribute('data-theme', localTheme)
}

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
