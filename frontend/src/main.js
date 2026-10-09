import { createApp, watch } from 'vue'
import App from './App.vue'
import { router } from './router.js'
import { auth } from './api/index.js'
import './style.css'
watch(() => auth.state.token, (token) => {
  if (!token && router.currentRoute.value.meta.requiresAuth) router.replace('/login')
})
createApp(App).use(router).mount('#app')
