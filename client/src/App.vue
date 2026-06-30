<template>
  <div id="app">
    <!-- 登录页独立布局 -->
    <div v-if="$route.path === '/login'" class="login-layout">
      <router-view />
    </div>

    <!-- 主应用布局 -->
    <el-container v-else class="main-container">
      <!-- 侧边栏 -->
      <el-aside :class="['app-sidebar', { collapsed: sidebarCollapsed }]">
        <div class="sidebar-logo" @click="$router.push('/')">
          <span class="logo-icon">📐</span>
          <span v-show="!sidebarCollapsed" class="logo-text">Meterly</span>
        </div>

        <el-menu
          :default-active="activeMenu"
          router
          :collapse="sidebarCollapsed"
          class="sidebar-menu"
          background-color="transparent"
          text-color="#8b9bb4"
          active-text-color="#ffffff"
        >
          <el-menu-item index="/">
            <el-icon><DataBoard /></el-icon>
            <template #title>仪表盘</template>
          </el-menu-item>

          <el-menu-item index="/instruments">
            <el-icon><Monitor /></el-icon>
            <template #title>计量器具</template>
          </el-menu-item>

          <el-menu-item index="/warning">
            <el-icon><WarningFilled /></el-icon>
            <template #title>到期预警</template>
          </el-menu-item>

          <el-menu-item index="/instruments/import">
            <el-icon><Upload /></el-icon>
            <template #title>数据导入</template>
          </el-menu-item>
        </el-menu>

        <div class="sidebar-footer" @click="sidebarCollapsed = !sidebarCollapsed">
          <el-icon :size="20">
            <Fold v-if="!sidebarCollapsed" />
            <Expand v-else />
          </el-icon>
        </div>
      </el-aside>

      <!-- 主内容区 -->
      <el-container class="content-container">
        <el-header class="app-header">
          <div class="header-left">
            <el-breadcrumb separator="/">
              <el-breadcrumb-item :to="{ path: '/' }">首页</el-breadcrumb-item>
              <el-breadcrumb-item v-if="currentTitle">{{ currentTitle }}</el-breadcrumb-item>
            </el-breadcrumb>
          </div>
          <div class="header-right">
            <el-tooltip content="全屏切换" placement="bottom">
              <el-button link class="header-btn" @click="toggleFullscreen">
                <el-icon :size="18"><FullScreen /></el-icon>
              </el-button>
            </el-tooltip>
            <el-dropdown trigger="click" class="user-dropdown">
              <div class="user-avatar">
                <el-avatar :size="32" icon="UserFilled" />
                <span class="user-name">{{ authStore.user?.nickname || '管理员' }}</span>
                <el-icon :size="12"><ArrowDown /></el-icon>
              </div>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item>
                    <el-icon><User /></el-icon>个人信息
                  </el-dropdown-item>
                  <el-dropdown-item divided @click="handleLogout">
                    <el-icon><SwitchButton /></el-icon>退出登录
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </el-header>

        <el-main class="app-main">
          <router-view />
        </el-main>
      </el-container>
    </el-container>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from './stores/auth'
import { ElMessageBox } from 'element-plus'
import {
  DataBoard, Monitor, WarningFilled, Upload,
  Fold, Expand, FullScreen, ArrowDown, User, SwitchButton
} from '@element-plus/icons-vue'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const sidebarCollapsed = ref(false)

const activeMenu = computed(() => {
  const path = route.path
  if (path === '/' || path === '/warning') return path
  if (path.startsWith('/instruments')) return '/instruments'
  return path
})

const currentTitle = computed(() => {
  return route.meta?.title || ''
})

function toggleFullscreen() {
  if (document.fullscreenElement) {
    document.exitFullscreen()
  } else {
    document.documentElement.requestFullscreen()
  }
}

function handleLogout() {
  ElMessageBox.confirm('确定退出登录吗？', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(() => {
    authStore.logout()
    router.push('/login')
  }).catch(() => {})
}
</script>

<style>
/* ======================= 全局变量 ======================= */
:root {
  --primary: #4f6ef7;
  --primary-light: #7b93fa;
  --primary-dark: #3a54d4;
  --success: #22c55e;
  --warning: #f59e0b;
  --danger: #ef4444;
  --info: #6366f1;
  --sidebar-bg: #1e293b;
  --sidebar-hover: #334155;
  --header-bg: #ffffff;
  --main-bg: #f1f5f9;
  --card-bg: #ffffff;
  --text-primary: #1e293b;
  --text-secondary: #64748b;
  --text-muted: #94a3b8;
  --border-color: #e2e8f0;
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
  --shadow-md: 0 4px 6px -1px rgba(0,0,0,0.07), 0 2px 4px -2px rgba(0,0,0,0.05);
  --shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.08), 0 4px 6px -4px rgba(0,0,0,0.04);
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --transition: 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body, #app {
  height: 100%;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC',
    'Hiragino Sans GB', 'Microsoft YaHei', 'Helvetica Neue', Arial, sans-serif;
  background: var(--main-bg);
  color: var(--text-primary);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* ======================= 全局滚动条 ======================= */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: #94a3b8; }

/* ======================= 主布局 ======================= */
.main-container {
  height: 100vh;
}

/* 侧边栏 */
.app-sidebar {
  width: 240px !important;
  background: var(--sidebar-bg);
  display: flex;
  flex-direction: column;
  transition: width var(--transition);
  overflow: hidden;
  z-index: 100;
}

.app-sidebar.collapsed {
  width: 64px !important;
}

.sidebar-logo {
  height: 64px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 20px;
  cursor: pointer;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  flex-shrink: 0;
}

.logo-icon {
  font-size: 24px;
  flex-shrink: 0;
}

.logo-text {
  font-size: 18px;
  font-weight: 700;
  color: #ffffff;
  white-space: nowrap;
  letter-spacing: -0.5px;
}

/* 侧边菜单 */
.sidebar-menu {
  flex: 1;
  border-right: none !important;
  padding: 12px 8px;
}

.sidebar-menu .el-menu-item {
  height: 44px;
  line-height: 44px;
  margin-bottom: 4px;
  border-radius: 8px;
  font-size: 14px;
  transition: all var(--transition);
}

.sidebar-menu .el-menu-item:hover {
  background: var(--sidebar-hover) !important;
  color: #e2e8f0 !important;
}

.sidebar-menu .el-menu-item.is-active {
  background: var(--primary) !important;
  color: #ffffff !important;
  font-weight: 500;
}

.sidebar-menu .el-menu-item .el-icon {
  font-size: 18px;
}

.sidebar-footer {
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-top: 1px solid rgba(255,255,255,0.06);
  color: #64748b;
  cursor: pointer;
  transition: color var(--transition);
  flex-shrink: 0;
}

.sidebar-footer:hover {
  color: #e2e8f0;
}

/* 内容容器 */
.content-container {
  flex-direction: column;
  overflow: hidden;
}

/* 顶部栏 */
.app-header {
  height: 64px !important;
  background: var(--header-bg);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  border-bottom: 1px solid var(--border-color);
  box-shadow: var(--shadow-sm);
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  color: var(--text-secondary);
}

.header-btn:hover {
  background: var(--main-bg);
  color: var(--text-primary);
}

.user-avatar {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 8px;
  transition: background var(--transition);
}

.user-avatar:hover {
  background: var(--main-bg);
}

.user-name {
  font-size: 13px;
  color: var(--text-primary);
  font-weight: 500;
}

/* 主内容区 */
.app-main {
  background: var(--main-bg);
  padding: 24px;
  overflow-y: auto;
  flex: 1;
}

/* ======================= Element Plus 覆盖 ======================= */
.el-card {
  border-radius: var(--radius-md) !important;
  border: 1px solid var(--border-color) !important;
  box-shadow: var(--shadow-sm);
  transition: box-shadow var(--transition);
}

.el-card:hover {
  box-shadow: var(--shadow-md);
}

.el-card__header {
  border-bottom: 1px solid var(--border-color) !important;
  padding: 16px 20px !important;
  font-weight: 700;
  font-size: 15px;
  color: var(--text-primary);
}

.el-card__body {
  padding: 20px !important;
}

.el-button--primary {
  --el-button-bg-color: var(--primary);
  --el-button-border-color: var(--primary);
  --el-button-hover-bg-color: var(--primary-dark);
  --el-button-hover-border-color: var(--primary-dark);
  border-radius: 8px !important;
  font-weight: 500;
}

.el-table {
  --el-table-header-bg-color: #f8fafc;
  --el-table-row-hover-bg-color: #f1f5f9;
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.el-table th.el-table__cell {
  font-weight: 700;
  color: var(--text-primary);
  font-size: 14px;
}

.el-table td.el-table__cell {
  font-size: 13px;
}

.el-pagination {
  --el-pagination-button-bg-color: #f1f5f9;
  font-weight: 500;
}

.el-menu {
  border-right: none !important;
}

.el-tag {
  border-radius: 6px !important;
  font-weight: 500;
}

.el-breadcrumb__inner {
  color: var(--text-secondary) !important;
  font-weight: 400;
}

.el-breadcrumb__inner.is-link:hover {
  color: var(--primary) !important;
}

/* ======================= 登录页 ======================= */
.login-layout {
  min-height: 100vh;
}
</style>
