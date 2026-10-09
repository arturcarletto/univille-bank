import { createRouter, createWebHashHistory } from 'vue-router'
import { auth } from './api/index.js'
import AuthView from './views/AuthView.vue'
import DashboardView from './views/DashboardView.vue'
export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/dashboard' },
    { path: '/login', component: AuthView, props: { mode: 'login' } },
    { path: '/register', component: AuthView, props: { mode: 'register' } },
    { path: '/dashboard', component: DashboardView, meta: { requiresAuth: true } },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})
router.beforeEach((to) => {
  if (to.meta.requiresAuth && !auth.state.token) return '/login'
  if (!to.meta.requiresAuth && auth.state.token) return '/dashboard'
})
