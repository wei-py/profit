import { createPinia } from "pinia";
import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import "./style.css";

const localTheme = localStorage.getItem("profit-theme");
if (localTheme === "lofi" || localTheme === "me-dark") {
  document.documentElement.setAttribute("data-theme", localTheme);
}

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.mount("#app");
