<template>
  <div class="canvas-page">
    <button class="canvas-back-btn" type="button" @click="router.push('/studio')">
      ← 返回生成
    </button>

    <!-- 顶部整体进度条 -->
    <div v-if="canvasStore.isRunning" class="canvas-progress">
      <div class="canvas-progress-info">
        <span>正在运行 {{ canvasStore.runDone }} / {{ canvasStore.runTotal }}</span>
        <span>{{ canvasStore.runProgress }}%</span>
      </div>
      <div class="canvas-progress-track">
        <div class="canvas-progress-bar" :style="{ width: canvasStore.runProgress + '%' }" />
      </div>
    </div>

    <!-- 双击空白处的创建菜单 -->
    <div
      v-if="contextMenu.visible"
      class="canvas-create-menu"
      :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
      @click.stop
    >
      <button
        v-for="item in nodeMenu"
        :key="item.kind"
        type="button"
        class="canvas-create-item"
        @click="createNodeAt(item.kind)"
      >
        {{ item.label }}
      </button>
    </div>


    <div ref="canvasRootRef" class="canvas-root">
      <CanvasToolbar @add-node="handleAddNode" />


      <VueFlow

        class="canvas-flow"
        :class="{ 'is-panning': isSpacePressed, 'is-grabbing': isGrabbing }"
        :nodes="canvasStore.nodes"
        :edges="canvasStore.edges"
        :node-types="generationNodeTypes"

        :delete-key-code="null"
        :multi-selection-key-code="['Meta', 'Shift']"
        :selection-key-code="true"
        :pan-on-drag="isSpacePressed"
        :selection-on-drag="!isSpacePressed"
        :pan-on-scroll="false"
        :zoom-on-scroll="true"
        fit-view-on-init

        @nodes-change="canvasStore.onNodesChange"
        @edges-change="canvasStore.onEdgesChange"
        @connect="canvasStore.onConnect"
        @dblclick="handlePaneDoubleClick"
      >

        <Background
          :variant="BackgroundVariant.Lines"
          :gap="28"
          :size="1"
          pattern-color="rgba(255, 255, 255, 0.06)"
          :bg-color="'transparent'"
        />

        <MiniMap
          class="canvas-minimap"
          pannable
          zoomable
          :mask-color="'rgba(18, 18, 20, 0.65)'"
          :node-color="'#3a3a3c'"
          :node-stroke-color="'#0a84ff'"
        />

        <div class="canvas-controls">
          <button
            type="button"
            class="ac-control-btn"
            title="放大"
            @click="() => zoomIn()"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path d="M12 5.5v13M5.5 12h13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
            </svg>
          </button>
          <button
            type="button"
            class="ac-control-btn"
            title="缩小"
            @click="() => zoomOut()"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path d="M5.5 12h13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
            </svg>
          </button>
          <button
            type="button"
            class="ac-control-btn"
            title="跟踪到当前组件"
            @click="() => fitView()"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path d="M4 9V5.5A1.5 1.5 0 0 1 5.5 4H9M15 4h3.5A1.5 1.5 0 0 1 20 5.5V9M20 15v3.5a1.5 1.5 0 0 1-1.5 1.5H15M9 20H5.5A1.5 1.5 0 0 1 4 18.5V15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
          <button
            type="button"
            class="ac-control-btn"
            :class="{ 'ac-control-btn--active': !isInteractive }"
            :title="isInteractive ? '锁定画板' : '解锁画板'"
            @click="toggleInteractivity"
          >
            <svg v-if="isInteractive" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path d="M8 10V7a4 4 0 0 1 7.5-2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
              <rect x="5" y="10" width="14" height="10" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.8" />
            </svg>
            <svg v-else viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
              <rect x="5" y="10" width="14" height="10" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.8" />
            </svg>
          </button>
        </div>



        <!-- 基础节点 / 分组节点通过具名插槽渲染；
             生成型节点（文本/图片/扩图/视频…）统一由 :node-types 注册表动态渲染，
             新增生成型节点无需在此登记。 -->
        <template #node-basicNode="nodeProps">
          <BasicNode v-bind="nodeProps" />
        </template>
        <template #node-groupNode="nodeProps">
          <GroupNode v-bind="nodeProps" />
        </template>
      </VueFlow>

    </div>

  </div>
</template>

<script setup lang="ts">
import { computed, markRaw, onBeforeUnmount, onMounted, ref } from 'vue'
import type { Component } from 'vue'


import { useRouter } from 'vue-router'
import { VueFlow, useVueFlow } from '@vue-flow/core'
import { Background, BackgroundVariant } from '@vue-flow/background'
import { MiniMap } from '@vue-flow/minimap'

import { useCanvasStore, type CanvasNodeKind } from '@/stores/canvasStore'
import CanvasToolbar from '@/components/canvas/CanvasToolbar.vue'
import BasicNode from '@/components/canvas/BasicNode.vue'
import GroupNode from '@/components/canvas/GroupNode.vue'
import {
  GENERATION_NODE_COMPONENTS,
  GENERATION_NODE_MENU,
} from '@/components/canvas/nodes'

// 双击创建 / 底部工具栏菜单项均来源于节点注册表，新增节点无需改此处。
const nodeMenu = GENERATION_NODE_MENU

// 生成型节点的 VueFlow type → 组件映射（markRaw 避免组件被响应式代理）。
// 通过 :node-types 传给 VueFlow，新增节点只需在注册表登记即可自动渲染。
const generationNodeTypes: Record<string, Component> = Object.fromEntries(
  Object.entries(GENERATION_NODE_COMPONENTS).map(([type, comp]) => [type, markRaw(comp)]),
)


import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/controls/dist/style.css'
import '@vue-flow/minimap/dist/style.css'

const router = useRouter()
const canvasStore = useCanvasStore()
const {
  zoomIn,
  zoomOut,
  fitView,
  setInteractive,
  getViewport,
  setViewport,
  nodesDraggable,
  nodesConnectable,
  elementsSelectable,
} = useVueFlow()



// 画布容器引用：用于监听尺寸变化并保持视口内容不丢失
const canvasRootRef = ref<HTMLElement | null>(null)

// 默认箭头（选择/框选）模式；按住空格切换为抓手拖动画布模式
const isSpacePressed = ref(false)
const isGrabbing = ref(false)


// 画板锁定状态：可拖动/可连线/可选中 三者都开启视为“可交互（未锁定）”
const isInteractive = computed(
  () => nodesDraggable.value && nodesConnectable.value && elementsSelectable.value,
)

function toggleInteractivity() {
  setInteractive(!isInteractive.value)
}


function handleSpaceDown(event: KeyboardEvent) {
  if (event.code !== 'Space') return
  if (isEditableTarget(event.target)) return
  // 防止空格滚动页面
  event.preventDefault()
  isSpacePressed.value = true
}

function handleSpaceUp(event: KeyboardEvent) {
  if (event.code !== 'Space') return
  isSpacePressed.value = false
  isGrabbing.value = false
}

function handleMouseDown() {
  if (isSpacePressed.value) isGrabbing.value = true
}

function handleMouseUp() {
  isGrabbing.value = false
}


// 双击空白处弹出创建菜单
const contextMenu = ref<{ visible: boolean; x: number; y: number; flowX: number; flowY: number }>({
  visible: false,
  x: 0,
  y: 0,
  flowX: 0,
  flowY: 0,
})

function handlePaneDoubleClick(event: MouseEvent) {
  const target = event.target as HTMLElement
  // Only add node when double-clicking empty pane (not on an existing node)
  if (target.closest('.vue-flow__node')) return
  const flow = clientToFlowCoordinate({ x: event.clientX, y: event.clientY })
  contextMenu.value = {
    visible: true,
    x: event.clientX,
    y: event.clientY,
    flowX: flow.x,
    flowY: flow.y,
  }
}

function createNodeAt(kind: CanvasNodeKind) {
  canvasStore.addGenerationNode(kind, { x: contextMenu.value.flowX, y: contextMenu.value.flowY })
  contextMenu.value.visible = false
}

// 底部菜单“添加节点”：在当前视口中心创建，避免节点落在可视区域之外
function handleAddNode(kind: CanvasNodeKind) {
  const el = document.querySelector('.canvas-flow') as HTMLElement | null
  const rect = el?.getBoundingClientRect()
  const cx = rect ? rect.left + rect.width / 2 : window.innerWidth / 2
  const cy = rect ? rect.top + rect.height / 2 : window.innerHeight / 2
  const flow = clientToFlowCoordinate({ x: cx, y: cy })
  const id = canvasStore.addGenerationNode(kind, { x: flow.x - 150, y: flow.y - 80 })
  // 稍微偏移以便连续添加时不完全重叠
  return id
}

function clientToFlowCoordinate(point: { x: number; y: number }) {
  const viewport = getViewport()
  const zoom = viewport.zoom && Number.isFinite(viewport.zoom) && viewport.zoom > 0 ? viewport.zoom : 1
  return {
    x: (point.x - viewport.x) / zoom,
    y: (point.y - viewport.y) / zoom,
  }
}

function closeContextMenu() {
  contextMenu.value.visible = false
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName.toLowerCase()
  return tag === 'input' || tag === 'textarea' || target.isContentEditable
}

// ------ 画布自适应：容器尺寸变化时保持视口内容不丢失 ------
// 原因：VueFlow 的 fit-view-on-init 只在初始化执行一次，浏览器窗口/容器尺寸
// 改变后视口（viewport）不会自动适配，导致原本可见的节点跑到可视区域外。
// 处理：记录尺寸变化前后视口中心对应的画布坐标，缩放不变，重新平移画布，
// 让原本处于视口中心的内容依旧居中，从而避免内容“消失”。
let resizeObserver: ResizeObserver | null = null
let prevSize: { width: number; height: number } | null = null
let resizeRaf = 0

function keepViewportCentered(width: number, height: number) {
  if (!prevSize) {
    prevSize = { width, height }
    return
  }
  const { width: prevWidth, height: prevHeight } = prevSize
  if (prevWidth === width && prevHeight === height) return
  if (prevWidth <= 0 || prevHeight <= 0 || width <= 0 || height <= 0) {
    prevSize = { width, height }
    return
  }

  const vp = getViewport()
  const zoom = vp.zoom || 1
  // 变化前视口中心对应的画布坐标
  const centerFlowX = (prevWidth / 2 - vp.x) / zoom
  const centerFlowY = (prevHeight / 2 - vp.y) / zoom
  // 变化后重新计算平移量，使该画布坐标仍位于新的视口中心
  const nextX = width / 2 - centerFlowX * zoom
  const nextY = height / 2 - centerFlowY * zoom
  setViewport({ x: nextX, y: nextY, zoom })

  prevSize = { width, height }
}

function handleContainerResize(entries: ResizeObserverEntry[]) {
  const entry = entries[0]
  if (!entry) return
  const { width, height } = entry.contentRect
  // 用 rAF 合并高频回调，避免拖动窗口时抖动
  if (resizeRaf) cancelAnimationFrame(resizeRaf)
  resizeRaf = requestAnimationFrame(() => keepViewportCentered(width, height))
}


function handleKeyDown(event: KeyboardEvent) {
  if (isEditableTarget(event.target)) return
  const meta = event.metaKey || event.ctrlKey
  const key = event.key.toLowerCase()

  if (meta && key === 'z' && !event.shiftKey) {
    event.preventDefault()
    canvasStore.undo()
    return
  }
  if (meta && (key === 'y' || (key === 'z' && event.shiftKey))) {
    event.preventDefault()
    canvasStore.redo()
    return
  }
  if (meta && key === 'c') {
    event.preventDefault()
    canvasStore.copySelected()
    return
  }
  if (meta && key === 'v') {
    event.preventDefault()
    canvasStore.pasteFromClipboard()
    return
  }
  if (meta && key === 'a') {
    event.preventDefault()
    canvasStore.selectAll()
    return
  }
  if (meta && key === 'g') {
    event.preventDefault()
    canvasStore.groupSelected()
    return
  }
  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault()
    canvasStore.removeSelected()
    return
  }
  if (event.key === 'Escape') {
    canvasStore.clearSelection()
  }
}

onMounted(() => {
  // 进入无限画布时清空当前节点与连线，保证每次打开都是空白画板。
  canvasStore.reset()
  setViewport({ x: 0, y: 0, zoom: 1 })

  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('keydown', handleSpaceDown)
  window.addEventListener('keyup', handleSpaceUp)
  window.addEventListener('mousedown', handleMouseDown)
  window.addEventListener('mouseup', handleMouseUp)
  window.addEventListener('click', closeContextMenu)

  // 监听画布容器尺寸变化（覆盖窗口缩放、侧栏开合、DPR 变化等场景），
  // 在尺寸变化后保持视口内容居中，避免节点跑出可视区域。
  if (canvasRootRef.value && typeof ResizeObserver !== 'undefined') {
    const rect = canvasRootRef.value.getBoundingClientRect()
    prevSize = { width: rect.width, height: rect.height }
    resizeObserver = new ResizeObserver(handleContainerResize)
    resizeObserver.observe(canvasRootRef.value)
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeyDown)
  window.removeEventListener('keydown', handleSpaceDown)
  window.removeEventListener('keyup', handleSpaceUp)
  window.removeEventListener('mousedown', handleMouseDown)
  window.removeEventListener('mouseup', handleMouseUp)
  window.removeEventListener('click', closeContextMenu)

  if (resizeRaf) cancelAnimationFrame(resizeRaf)
  resizeObserver?.disconnect()
  resizeObserver = null
})


</script>

<style scoped>
/* Apple-style dark theme tokens */
.canvas-page {
  --ac-bg: #0b0b0d;
  --ac-surface: rgba(44, 44, 46, 0.72);
  --ac-surface-solid: #1c1c1e;
  --ac-surface-hover: rgba(72, 72, 74, 0.9);
  --ac-border: rgba(255, 255, 255, 0.12);
  --ac-text: #f5f5f7;
  --ac-text-dim: #98989d;
  --ac-accent: #0a84ff;

  position: relative;
  width: 100%;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  color: var(--ac-text);
  background:
    radial-gradient(1200px 800px at 15% -10%, rgba(10, 132, 255, 0.12), transparent 60%),
    radial-gradient(1000px 700px at 90% 110%, rgba(191, 90, 242, 0.1), transparent 60%),
    linear-gradient(160deg, #141417 0%, #0b0b0d 55%, #08080a 100%);
}

.canvas-root {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.canvas-flow {
  width: 100%;
  height: 100%;
  background: transparent;
}

/* 背景网格：将实线网格渲染为虚线 */
.canvas-flow :deep(.vue-flow__background-pattern.lines path),
.canvas-flow :deep(.vue-flow__background-pattern.lines line),
.canvas-flow :deep(pattern path),
.canvas-flow :deep(pattern line) {
  stroke-dasharray: 4 6;
  stroke-linecap: round;
}



/* 默认箭头模式：面板不显示抓手光标 */
.canvas-flow :deep(.vue-flow__pane) {
  cursor: default;
}

/* 按住空格：抓手光标（可拖动画布） */
.canvas-flow.is-panning :deep(.vue-flow__pane) {
  cursor: grab;
}

/* 按住空格并按下鼠标：握拳光标（正在拖动） */
.canvas-flow.is-grabbing :deep(.vue-flow__pane) {
  cursor: grabbing;
}


.canvas-back-btn {
  position: absolute;
  top: 16px;
  left: 16px;
  z-index: 20;
  padding: 8px 16px;
  border: 1px solid var(--ac-border);
  border-radius: 999px;
  background: var(--ac-surface);
  -webkit-backdrop-filter: saturate(180%) blur(20px);
  backdrop-filter: saturate(180%) blur(20px);
  color: var(--ac-text);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.28);
  transition: background 0.18s ease, transform 0.18s ease;
}

.canvas-back-btn:hover {
  background: var(--ac-surface-hover);
}

.canvas-back-btn:active {
  transform: scale(0.97);
}

/* 顶部整体进度条 */
.canvas-progress {
  position: absolute;
  top: 72px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 30;
  width: min(480px, 60vw);
  padding: 10px 16px;
  border-radius: 14px;
  border: 1px solid var(--ac-border);
  background: var(--ac-surface);
  -webkit-backdrop-filter: saturate(180%) blur(20px);
  backdrop-filter: saturate(180%) blur(20px);
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.4);
}

.canvas-progress-info {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: var(--ac-text-dim);
  margin-bottom: 6px;
}

.canvas-progress-track {
  height: 6px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.1);
  overflow: hidden;
}

.canvas-progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #3c3f46, #8b909b);
  border-radius: 999px;
  transition: width 0.3s ease;
}

/* 双击创建菜单 */
.canvas-create-menu {
  position: fixed;
  z-index: 40;
  display: flex;
  flex-direction: column;
  min-width: 130px;
  padding: 6px;
  border-radius: 14px;
  border: 1px solid var(--ac-border);
  background: rgba(28, 28, 30, 0.96);
  -webkit-backdrop-filter: saturate(180%) blur(24px);
  backdrop-filter: saturate(180%) blur(24px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
}

.canvas-create-item {
  padding: 8px 12px;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: var(--ac-text);
  font-size: 13px;
  text-align: left;
  cursor: pointer;
}

.canvas-create-item:hover {
  background: var(--ac-surface-hover);
}

/* Toolbar — top center floating dock */
:deep(.canvas-toolbar) {
  position: absolute;
  top: 16px;
  bottom: auto;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  display: flex;
  gap: 4px;
  padding: 6px;
  border-radius: 18px;
  border: 1px solid var(--ac-border);
  background: var(--ac-surface);
  -webkit-backdrop-filter: saturate(180%) blur(24px);
  backdrop-filter: saturate(180%) blur(24px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.45);
}

:deep(.canvas-toolbar-button) {
  padding: 8px 14px;
  border: none;
  border-radius: 12px;
  background: transparent;
  color: var(--ac-text);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s ease, transform 0.12s ease;
}

:deep(.canvas-toolbar-button:hover) {
  background: var(--ac-surface-hover);
}

:deep(.canvas-toolbar-button:active) {
  transform: scale(0.95);
}

/* Basic node */
:deep(.basic-node) {
  min-width: 200px;
  min-height: 56px;
  padding: 16px 20px;
  display: flex;
  align-items: center;
  border-radius: 16px;
  border: 1px solid var(--ac-border);
  background: var(--ac-surface-solid);
  color: var(--ac-text);
  font-size: 14px;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.4);
  transition: box-shadow 0.15s ease;
}

:deep(.basic-node--selected) {
  box-shadow: 0 0 0 2px var(--ac-accent), 0 8px 28px rgba(0, 0, 0, 0.4);
}


:deep(.basic-node-label) {
  cursor: text;
  user-select: none;
  word-break: break-word;
}

:deep(.basic-node-input) {
  width: 100%;
  border: none;
  outline: none;
  background: transparent;
  color: var(--ac-text);
  font-size: 14px;
  font-family: inherit;
}

:deep(.basic-node-handle) {
  width: 10px;
  height: 10px;
  background: var(--ac-accent);
  border: 2px solid var(--ac-surface-solid);
}

/* Group node */
:deep(.group-node) {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 18px;
  border: 1px dashed rgba(10, 132, 255, 0.4);
  background: rgba(10, 132, 255, 0.06);
}


:deep(.group-node--selected) {
  border-style: solid;
}

:deep(.group-node-header) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 12px;
  font-size: 12px;
}

:deep(.group-node-title) {
  font-weight: 600;
  cursor: text;
  user-select: none;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

:deep(.group-node-input) {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: rgba(0, 0, 0, 0.25);
  border-radius: 6px;
  padding: 2px 6px;
  color: var(--ac-text);
  font-size: 12px;
  font-weight: 600;
  font-family: inherit;
}

:deep(.group-node-actions) {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

:deep(.group-node-btn) {
  border: none;
  border-radius: 8px;
  padding: 3px 9px;
  background: var(--ac-surface-hover);
  color: var(--ac-text);
  font-size: 11px;
  line-height: 1.4;
  cursor: pointer;
  transition: opacity 0.15s ease, transform 0.12s ease;
}

:deep(.group-node-btn:hover) {
  opacity: 0.88;
}

:deep(.group-node-btn:active) {
  transform: scale(0.94);
}

:deep(.group-node-btn--run) {
  color: #fff;
  font-weight: 600;
}

:deep(.group-node-btn--run:disabled) {
  opacity: 0.45;
  cursor: not-allowed;
}

:deep(.group-node-color-wrap) {
  position: relative;
  display: flex;
}

:deep(.group-node-color-toggle) {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
}

:deep(.group-node-color-dot) {
  display: block;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.35);
}

:deep(.group-node-color-menu) {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 30;
  display: flex;
  gap: 6px;
  padding: 8px;
  border-radius: 12px;
  border: 1px solid var(--ac-border);
  background: rgba(28, 28, 30, 0.98);
  -webkit-backdrop-filter: saturate(180%) blur(24px);
  backdrop-filter: saturate(180%) blur(24px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
}

:deep(.group-node-color-item) {
  width: 20px;
  height: 20px;
  padding: 0;
  border: 2px solid transparent;
  border-radius: 50%;
  cursor: pointer;
  transition: transform 0.12s ease;
}

:deep(.group-node-color-item:hover) {
  transform: scale(1.12);
}

:deep(.group-node-color-item.is-active) {
  border-color: #fff;
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.25);
}


/* Controls — Apple-style floating vertical control (bottom-left) */
.canvas-controls {
  position: absolute;
  left: 16px;
  bottom: 24px;
  z-index: 10;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px;
  border-radius: 18px;
  border: 1px solid var(--ac-border);
  background: var(--ac-surface);
  -webkit-backdrop-filter: saturate(180%) blur(24px);
  backdrop-filter: saturate(180%) blur(24px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.45);
}

.ac-control-btn {
  width: 38px;
  height: 38px;
  padding: 0;
  border: none;
  border-radius: 13px;
  background: transparent;
  color: var(--ac-text);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.15s ease, transform 0.12s ease;
}

.ac-control-btn:hover {
  background: var(--ac-surface-hover);
}

.ac-control-btn:active {
  transform: scale(0.92);
}

.ac-control-btn--active {
  background: var(--ac-accent);
  color: #fff;
}

.ac-control-btn--active:hover {
  background: var(--ac-accent);
}

.ac-control-btn svg {
  display: block;
}


/* MiniMap dark theme */
:deep(.canvas-minimap) {
  background: var(--ac-surface-solid) !important;
  border: 1px solid var(--ac-border);
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.45);
}

:deep(.canvas-minimap svg) {
  background: var(--ac-surface-solid);
}
</style>
