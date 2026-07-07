import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/Login.vue'),
    meta: { title: '登录' }
  },
  {
    path: '/',
    name: 'Dashboard',
    component: () => import('../views/Dashboard.vue'),
    meta: { title: '仪表盘' }
  },
  {
    path: '/instruments',
    name: 'InstrumentList',
    component: () => import('../views/InstrumentList.vue'),
    meta: { title: '计量器具台账' }
  },
  {
    path: '/instruments/add',
    name: 'InstrumentAdd',
    component: () => import('../views/InstrumentForm.vue'),
    meta: { title: '新增器具' }
  },
  {
    path: '/instruments/:id',
    name: 'InstrumentEdit',
    component: () => import('../views/InstrumentForm.vue'),
    meta: { title: '编辑器具' }
  },
  {
    path: '/instruments/import',
    name: 'ImportPage',
    component: () => import('../views/ImportPage.vue'),
    meta: { title: '批量导入' }
  },
  {
    path: '/warning',
    name: 'WarningPage',
    component: () => import('../views/WarningPage.vue'),
    meta: { title: '到期预警' }
  },
  {
    path: '/inspection-workspace',
    name: 'InspectionWorkspace',
    component: () => import('../views/InspectionWorkspace.vue'),
    meta: { title: '送检工作台' }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  document.title = (to.meta.title || '计量器具管理') + ' - Meterly'

  if (to.path === '/login') {
    return next()
  }

  const authStore = useAuthStore()
  if (!authStore.token) {
    return next('/login')
  }

  next()
})

export default router
