import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { reactive } from 'vue'

// ── Hoisted mock functions so vi.mock factories can reference them ──────────
const { mockConfirm, mockLogout, mockPush } = vi.hoisted(() => ({
  mockConfirm: vi.fn(),
  mockLogout: vi.fn(),
  mockPush: vi.fn(),
}))

// ── Module mocks (hoisted before any imports) ───────────────────────────────
vi.mock('@element-plus/icons-vue', () => {
  const names = [
    'DataBoard', 'Monitor', 'WarningFilled', 'Upload',
    'Fold', 'Expand', 'FullScreen', 'ArrowDown', 'User', 'SwitchButton'
  ]
  return Object.fromEntries(names.map(name => [name, { name, template: `<span>${name}</span>` }]))
})

vi.mock('element-plus', () => ({
  ElMessageBox: { confirm: mockConfirm },
}))

vi.mock('./stores/auth', () => ({
  useAuthStore: vi.fn(() => ({
    user: { nickname: '管理员' },
    logout: mockLogout,
  })),
}))

vi.mock('vue-router', () => ({
  useRoute: vi.fn(),
  useRouter: vi.fn(() => ({ push: mockPush })),
}))

// ── Real imports (resolved to mocks above) ──────────────────────────────────
import { useRoute } from 'vue-router'
import App from './App.vue'

// ── Global element-plus component stubs ─────────────────────────────────────
const ELEMENT_STUBS = {
  'router-view': { template: '<div class="router-view-stub"><slot /></div>' },
  'router-link': { template: '<a class="router-link-stub"><slot /></a>' },
  'el-container': { template: '<div class="el-container"><slot /></div>' },
  'el-aside': { template: '<aside class="el-aside"><slot /></aside>' },
  'el-header': { template: '<header class="el-header"><slot /></header>' },
  'el-main': { template: '<main class="el-main"><slot /></main>' },
  'el-menu': {
    template: '<nav class="el-menu"><slot /></nav>',
    props: ['defaultActive', 'router', 'collapse', 'backgroundColor', 'textColor', 'activeTextColor'],
  },
  'el-menu-item': {
    template: '<div :data-index="index" class="el-menu-item"><slot name="title" /><slot /></div>',
    props: ['index'],
  },
  'el-breadcrumb': { template: '<div class="el-breadcrumb"><slot /></div>', props: ['separator'] },
  'el-breadcrumb-item': {
    template: '<div class="el-breadcrumb-item"><slot /></div>',
    props: ['to'],
  },
  'el-dropdown': {
    template: '<div class="el-dropdown" @click="$emit(\'command\', $event)"><slot /><slot name="dropdown" /></div>',
    props: ['trigger'],
  },
  'el-dropdown-menu': { template: '<div class="el-dropdown-menu"><slot /></div>' },
  'el-dropdown-item': {
    template: '<div class="el-dropdown-item" @click="$emit(\'click\')"><slot /></div>',
    props: ['divided', 'onClick'],   // onClick 声明为 prop 防止 fallthrough 导致重复触发
  },
  'el-avatar': {
    template: '<div class="el-avatar"><slot /></div>',
    props: ['size', 'icon'],
  },
  'el-tooltip': {
    template: '<div class="el-tooltip"><slot /></div>',
    props: ['content', 'placement'],
  },
  'el-button': {
    template: '<button class="el-button" @click="$emit(\'click\')"><slot /></button>',
    props: ['link', 'onClick'],   // onClick 声明为 prop 防止 fallthrough 导致重复触发
  },
  'el-icon': {
    template: '<i class="el-icon"><slot /></i>',
    props: ['size'],
  },
}

// ── Helper ──────────────────────────────────────────────────────────────────
function createWrapper(routeOverrides = {}) {
  const routeState = reactive({
    path: '/',
    meta: {},
    ...routeOverrides,
  })
  useRoute.mockReturnValue(routeState)

  return mount(App, {
    global: {
      mocks: {
        $route: routeState,
        $router: { push: mockPush },
      },
      stubs: ELEMENT_STUBS,
    },
  })
}

// ── Tests ───────────────────────────────────────────────────────────────────
describe('App.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockConfirm.mockReset()
    mockLogout.mockReset()
    mockPush.mockReset()

    // Setup document fullscreen API mocks
    Object.defineProperty(document, 'fullscreenElement', {
      writable: true,
      value: null,
      configurable: true,
    })
    document.exitFullscreen = vi.fn()
    document.documentElement.requestFullscreen = vi.fn()
  })

  // =====================================================================
  //  正向路径（Positive Paths）
  // =====================================================================

  describe('布局渲染（Layout Rendering）', () => {
    it('非登录路由应渲染主应用布局（侧边栏 + 头部 + 内容区）', () => {
      const wrapper = createWrapper({ path: '/' })

      expect(wrapper.find('.app-sidebar').exists()).toBe(true)
      expect(wrapper.find('.app-header').exists()).toBe(true)
      expect(wrapper.find('.app-main').exists()).toBe(true)
      expect(wrapper.find('.sidebar-logo').exists()).toBe(true)
      expect(wrapper.find('.sidebar-menu').exists()).toBe(true)
    })

    it('登录页 /login 只渲染 login-layout，不渲染主布局', () => {
      const wrapper = createWrapper({ path: '/login' })

      expect(wrapper.find('.login-layout').exists()).toBe(true)
      expect(wrapper.find('.app-sidebar').exists()).toBe(false)
      expect(wrapper.find('.app-header').exists()).toBe(false)
      expect(wrapper.find('.main-container').exists()).toBe(false)
    })

    it('应显示来自 auth store 的用户昵称', () => {
      const wrapper = createWrapper()
      expect(wrapper.find('.user-name').text()).toBe('管理员')
    })

    it('应包含四个侧边栏菜单项', () => {
      const wrapper = createWrapper()
      const menuItems = wrapper.findAll('.el-menu-item')
      expect(menuItems.length).toBe(4)

      const texts = menuItems.map(item => item.text())
      expect(texts.some(t => t.includes('仪表盘'))).toBe(true)
      expect(texts.some(t => t.includes('计量器具'))).toBe(true)
      expect(texts.some(t => t.includes('到期预警'))).toBe(true)
      expect(texts.some(t => t.includes('数据导入'))).toBe(true)
    })

    it('面包屑应显示当前页面标题', () => {
      const wrapper = createWrapper({ path: '/instruments', meta: { title: '计量器具台账' } })
      const breadcrumbItems = wrapper.findAll('.el-breadcrumb-item')
      const titles = breadcrumbItems.map(item => item.text())
      expect(titles).toContain('计量器具台账')
    })
  })

  // =====================================================================
  //  activeMenu 计算属性
  // =====================================================================

  describe('activeMenu 计算属性', () => {
    it('路径为 "/" 时返回 "/"', () => {
      const wrapper = createWrapper({ path: '/' })
      expect(wrapper.vm.activeMenu).toBe('/')
    })

    it('路径为 "/warning" 时返回 "/warning"', () => {
      const wrapper = createWrapper({ path: '/warning' })
      expect(wrapper.vm.activeMenu).toBe('/warning')
    })

    it('路径为 "/instruments" 时返回 "/instruments"', () => {
      const wrapper = createWrapper({ path: '/instruments' })
      expect(wrapper.vm.activeMenu).toBe('/instruments')
    })

    it('路径以 "/instruments" 开头的子路由返回 "/instruments"', () => {
      const wrapper = createWrapper({ path: '/instruments/import' })
      expect(wrapper.vm.activeMenu).toBe('/instruments')
    })

    it('路径为 "/instruments/123/detail" 时依然返回 "/instruments"', () => {
      const wrapper = createWrapper({ path: '/instruments/123/detail' })
      expect(wrapper.vm.activeMenu).toBe('/instruments')
    })

    it('未知路由直接返回原始路径', () => {
      const wrapper = createWrapper({ path: '/some-unknown-page' })
      expect(wrapper.vm.activeMenu).toBe('/some-unknown-page')
    })
  })

  // =====================================================================
  //  currentTitle 计算属性
  // =====================================================================

  describe('currentTitle 计算属性', () => {
    it('有 meta.title 时返回该标题', () => {
      const wrapper = createWrapper({ path: '/instruments', meta: { title: '计量器具台账' } })
      expect(wrapper.vm.currentTitle).toBe('计量器具台账')
    })

    it('无 meta.title 时返回空字符串', () => {
      const wrapper = createWrapper({ path: '/', meta: {} })
      expect(wrapper.vm.currentTitle).toBe('')
    })

    it('meta 对象不存在时返回空字符串', () => {
      const wrapper = createWrapper({ path: '/warning' })
      expect(wrapper.vm.currentTitle).toBe('')
    })
  })

  // =====================================================================
  //  侧边栏折叠
  // =====================================================================

  describe('侧边栏折叠（Sidebar Collapse）', () => {
    it('初始状态侧边栏未折叠', () => {
      const wrapper = createWrapper()
      const sidebar = wrapper.find('.app-sidebar')
      expect(sidebar.classes()).not.toContain('collapsed')
    })

    it('点击折叠按钮后侧边栏变为 collapsed', async () => {
      const wrapper = createWrapper()
      const sidebar = wrapper.find('.app-sidebar')

      await wrapper.find('.sidebar-footer').trigger('click')
      expect(sidebar.classes()).toContain('collapsed')
    })

    it('再次点击折叠按钮取消 collapsed', async () => {
      const wrapper = createWrapper()
      const sidebar = wrapper.find('.app-sidebar')

      await wrapper.find('.sidebar-footer').trigger('click')
      expect(sidebar.classes()).toContain('collapsed')

      await wrapper.find('.sidebar-footer').trigger('click')
      expect(sidebar.classes()).not.toContain('collapsed')
    })

    it('多次点击应正确切换 collapsed 状态', async () => {
      const wrapper = createWrapper()
      const sidebar = wrapper.find('.app-sidebar')
      const footer = wrapper.find('.sidebar-footer')

      for (let i = 0; i < 5; i++) {
        await footer.trigger('click')
        expect(sidebar.classes().includes('collapsed')).toBe(i % 2 === 0)
      }
    })
  })

  // =====================================================================
  //  全屏切换
  // =====================================================================

  describe('全屏切换（toggleFullscreen）', () => {
    it('非全屏状态点击应调用 requestFullscreen', async () => {
      document.fullscreenElement = null
      const wrapper = createWrapper()

      await wrapper.find('.header-btn').trigger('click')

      expect(document.documentElement.requestFullscreen).toHaveBeenCalledTimes(1)
      expect(document.exitFullscreen).not.toHaveBeenCalled()
    })

    it('全屏状态点击应调用 exitFullscreen', async () => {
      document.fullscreenElement = {}
      const wrapper = createWrapper()

      await wrapper.find('.header-btn').trigger('click')

      expect(document.exitFullscreen).toHaveBeenCalledTimes(1)
      expect(document.documentElement.requestFullscreen).not.toHaveBeenCalled()
    })
  })

  // =====================================================================
  //  退出登录
  // =====================================================================

  describe('退出登录（handleLogout）', () => {
    it('确认退出时应调用 logout 并跳转至 /login', async () => {
      mockConfirm.mockResolvedValue('confirm')
      const wrapper = createWrapper()

      const items = wrapper.findAll('.el-dropdown-item')
      const logoutItem = items.find(i => i.text().includes('退出登录'))
      expect(logoutItem).toBeTruthy()

      await logoutItem.trigger('click')

      expect(mockConfirm).toHaveBeenCalledWith('确定退出登录吗？', '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      })

      // Wait for microtask resolution
      await new Promise(resolve => setTimeout(resolve, 0))

      expect(mockLogout).toHaveBeenCalledTimes(1)
      expect(mockPush).toHaveBeenCalledWith('/login')
    })

    it('取消退出时不应调用 logout 或 router.push', async () => {
      mockConfirm.mockRejectedValue('cancel')
      const wrapper = createWrapper()

      const items = wrapper.findAll('.el-dropdown-item')
      const logoutItem = items.find(i => i.text().includes('退出登录'))
      await logoutItem.trigger('click')

      // catch handler runs synchronously on reject, so no extra wait needed
      expect(mockConfirm).toHaveBeenCalledTimes(1)
      expect(mockLogout).not.toHaveBeenCalled()
      expect(mockPush).not.toHaveBeenCalled()
    })
  })

  // =====================================================================
  //  边界条件（Edge Cases）
  // =====================================================================

  describe('边界条件（Edge Cases）', () => {
    it('auth store 中 user 为 null 时用户名应显示 "管理员"（兜底）', async () => {
      const { useAuthStore } = await import('./stores/auth')
      useAuthStore.mockReturnValueOnce({
        user: null,
        logout: mockLogout,
      })

      const wrapper = createWrapper()
      expect(wrapper.find('.user-name').text()).toBe('管理员')
    })

    it('auth store 中 user 无 nickname 时用户名应显示 "管理员"（兜底）', async () => {
      const { useAuthStore } = await import('./stores/auth')
      useAuthStore.mockReturnValueOnce({
        user: {},
        logout: mockLogout,
      })

      const wrapper = createWrapper()
      expect(wrapper.find('.user-name').text()).toBe('管理员')
    })

    it('登录页路由不应包含侧边栏的任何元素', () => {
      const wrapper = createWrapper({ path: '/login' })

      expect(wrapper.find('.sidebar-logo').exists()).toBe(false)
      expect(wrapper.find('.sidebar-menu').exists()).toBe(false)
      expect(wrapper.find('.sidebar-footer').exists()).toBe(false)
      expect(wrapper.find('.user-avatar').exists()).toBe(false)
    })

    it('空路径应可正常渲染（兜底为非登录布局）', () => {
      const wrapper = createWrapper({ path: '' })
      // '' !== '/login' so main layout renders
      expect(wrapper.find('.app-sidebar').exists()).toBe(true)
    })

    it('路径为 "/LOGIN"（大写）不应触发登录布局', () => {
      const wrapper = createWrapper({ path: '/LOGIN' })
      // Exact match '/login' only
      expect(wrapper.find('.login-layout').exists()).toBe(false)
      expect(wrapper.find('.app-sidebar').exists()).toBe(true)
    })
  })
})
