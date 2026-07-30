<template>
  <div class="canvas-page">
    <button class="canvas-back-btn" type="button" @click="router.push('/studio')">
      ← 返回生成
    </button>

    <div class="canvas-root">
      <CanvasToolbar />
      <VueFlow
        class="canvas-flow"
        :class="{ 'is-panning': isSpacePressed, 'is-grabbing': isGrabbing }"
        :nodes="canvasStore.nodes"
        :edges="canvasStore.edges"
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

        <Background :variant="BackgroundVariant.Dots" :gap="20" :size="1" />
        <MiniMap
          class="canvas-minimap"
          pannable
          zoomable
          :mask-color="'rgba(15, 17, 21, 0.6)'"
          :node-color="'#2b2f3a'"
          :node-stroke-color="'#4c7dff'"
        />

        <Controls class="canvas-controls" />

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
import { onBeforeUnmount, onMounted, ref } from 'vue'

import { useRouter } from 'vue-router'
import { VueFlow, useVueFlow } from '@vue-flow/core'
import { Background, BackgroundVariant } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { MiniMap } from '@vue-flow/minimap'
import { useCanvasStore } from '@/stores/canvasStore'
import CanvasToolbar from '@/components/canvas/CanvasToolbar.vue'
import BasicNode from '@/components/canvas/BasicNode.vue'
import GroupNode from '@/components/canvas/GroupNode.vue'

import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/controls/dist/style.css'
import '@vue-flow/minimap/dist/style.css'

const router = useRouter()
const canvasStore = useCanvasStore()
const { screenToFlowCoordinate } = useVueFlow()

// 默认箭头（选择/框选）模式；按住空格切换为抓手拖动画布模式
const isSpacePressed = ref(false)
const isGrabbing = ref(false)

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


function handlePaneDoubleClick(event: MouseEvent) {
  const target = event.target as HTMLElement
  // Only add node when double-clicking empty pane (not on an existing node)
  if (target.closest('.vue-flow__node')) return
  const position = screenToFlowCoordinate({ x: event.clientX, y: event.clientY })
  canvasStore.addNode(position)
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName.toLowerCase()
  return tag === 'input' || tag === 'textarea' || target.isContentEditable
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
  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('keydown', handleSpaceDown)
  window.addEventListener('keyup', handleSpaceUp)
  window.addEventListener('mousedown', handleMouseDown)
  window.addEventListener('mouseup', handleMouseUp)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeyDown)
  window.removeEventListener('keydown', handleSpaceDown)
  window.removeEventListener('keyup', handleSpaceUp)
  window.removeEventListener('mousedown', handleMouseDown)
  window.removeEventListener('mouseup', handleMouseUp)
})

</script>

<style scoped>
.canvas-page {
  position: relative;
  width: 100%;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  background: var(--canvas-bg, #0f1115);
  color: var(--canvas-text, #e6e8ee);
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
  background: var(--canvas-bg, #0f1115);
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
  padding: 8px 14px;
  border: 1px solid var(--canvas-border, #2b2f3a);
  border-radius: 10px;
  background: var(--canvas-surface, #1a1d24);
  color: var(--canvas-text, #e6e8ee);
  font-size: 13px;
  cursor: pointer;
  transition: background 0.15s ease;
}

.canvas-back-btn:hover {
  background: var(--canvas-surface-hover, #232733);
}

/* Toolbar */
:deep(.canvas-toolbar) {
  position: absolute;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  display: flex;
  gap: 4px;
  padding: 6px;
  border-radius: 12px;
  background: var(--canvas-surface, #1a1d24);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
}

:deep(.canvas-toolbar-button) {
  padding: 6px 12px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--canvas-text, #e6e8ee);
  font-size: 13px;
  cursor: pointer;
  transition: background 0.15s ease;
}

:deep(.canvas-toolbar-button:hover) {
  background: var(--canvas-surface-hover, #232733);
}

/* Basic node */
:deep(.basic-node) {
  min-width: 160px;
  padding: 12px 16px;
  border-radius: 12px;
  background: var(--canvas-surface, #1a1d24);
  color: var(--canvas-text, #e6e8ee);
  font-size: 14px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
  transition: box-shadow 0.15s ease;
}

:deep(.basic-node--selected) {
  box-shadow: 0 0 0 2px var(--canvas-accent, #4c7dff), 0 4px 16px rgba(0, 0, 0, 0.25);
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
  color: var(--canvas-text, #e6e8ee);
  font-size: 14px;
  font-family: inherit;
}

:deep(.basic-node-handle) {
  width: 10px;
  height: 10px;
  background: var(--canvas-accent, #4c7dff);
  border: 2px solid var(--canvas-surface, #1a1d24);
}

/* Group node */
:deep(.group-node) {
  width: 100%;
  height: 100%;
  border-radius: 16px;
  background: rgba(76, 125, 255, 0.06);
  border: 1px dashed rgba(76, 125, 255, 0.4);
}

:deep(.group-node--selected) {
  border-color: var(--canvas-accent, #4c7dff);
}

:deep(.group-node-header) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  color: var(--canvas-text-dim, #9aa0ad);
  font-size: 12px;
}

:deep(.group-node-ungroup) {
  border: none;
  border-radius: 6px;
  padding: 2px 8px;
  background: var(--canvas-surface-hover, #232733);
  color: var(--canvas-text, #e6e8ee);
  font-size: 11px;
  cursor: pointer;
}

/* Vue Flow overrides */
:deep(.vue-flow__controls),
:deep(.canvas-minimap) {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
}

/* MiniMap dark theme */
:deep(.canvas-minimap) {
  background: var(--canvas-surface, #1a1d24) !important;
  border: 1px solid var(--canvas-border, #2b2f3a);
  border-radius: 10px;
  overflow: hidden;
}

:deep(.canvas-minimap svg) {
  background: var(--canvas-surface, #1a1d24);
}
</style>

