<template>
  <div
    :class="['group-node', { 'group-node--selected': selected }]"
    :style="groupStyle"
  >
    <div class="group-node-header" :style="headerStyle">
      <!-- 分组名称：双击可编辑 -->
      <input
        v-if="editing"
        ref="inputRef"
        class="group-node-input nodrag"

        :value="label"
        @input="handleInput"
        @blur="stopEditing"
        @keydown.enter="stopEditing"
        @click.stop
      />
      <span
        v-else
        class="group-node-title"
        title="双击重命名"
        @dblclick.stop="startEditing"
      >
        {{ label }}
      </span>

      <div class="group-node-actions">
        <!-- 运行分组 -->
        <button
          type="button"
          class="group-node-btn group-node-btn--run"
          :style="{ background: color }"
          :disabled="canvasStore.isRunning"
          :title="isRunningThis ? '运行中…' : '按顺序运行分组内节点'"
          @click.stop="canvasStore.runGroup(id)"
        >
          {{ isRunningThis ? '运行中…' : '▶ 运行' }}
        </button>

        <!-- 颜色选择 -->
        <div class="group-node-color-wrap">
          <button
            type="button"
            class="group-node-btn group-node-color-toggle"
            title="选择分组颜色"
            @click.stop="colorMenuOpen = !colorMenuOpen"
          >
            <span class="group-node-color-dot" :style="{ background: color }" />
          </button>
          <div v-if="colorMenuOpen" class="group-node-color-menu" @click.stop>
            <button
              v-for="opt in GROUP_COLORS"
              :key="opt.key"
              type="button"
              class="group-node-color-item"
              :class="{ 'is-active': opt.color === color }"
              :title="opt.label"
              :style="{ background: opt.color }"
              @click.stop="pickColor(opt.color)"
            />
          </div>
        </div>

        <button
          type="button"
          class="group-node-btn"
          @click.stop="canvasStore.ungroup(id)"
        >
          解组
        </button>
      </div>
    </div>

    <!-- 右下角拖拽手柄：手动调整分组大小（nodrag 阻止 VueFlow 节点拖拽） -->
    <div
      ref="resizeHandleRef"
      class="group-node-resize nodrag nopan"
      title="拖拽调整分组大小"
      @mousedown.stop.prevent="startResize"
    />


  </div>
</template>


<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useVueFlow } from '@vue-flow/core'
import {
  useCanvasStore,
  GROUP_COLORS,
  DEFAULT_GROUP_COLOR,
  type CanvasNodeData,
} from '@/stores/canvasStore'


const props = defineProps<{
  id: string
  data: CanvasNodeData
  selected?: boolean
}>()

const canvasStore = useCanvasStore()
const { getViewport, findNode } = useVueFlow()
const resizeHandleRef = ref<HTMLElement | null>(null)
const label = computed(() => props.data?.label ?? '分组')
const color = computed(() => props.data?.groupColor || DEFAULT_GROUP_COLOR)



// 当前分组是否正在运行
const isRunningThis = computed(
  () => canvasStore.isRunning && canvasStore.runningGroupId === props.id,
)

// 将 16 进制颜色转为带透明度的 rgba，用于边框 / 背景着色
function hexToRgba(hex: string, alpha: number): string {
  const value = hex.replace('#', '')
  const r = parseInt(value.slice(0, 2), 16)
  const g = parseInt(value.slice(2, 4), 16)
  const b = parseInt(value.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

const groupStyle = computed(() => ({
  background: hexToRgba(color.value, 0.06),
  borderColor: hexToRgba(color.value, props.selected ? 0.9 : 0.4),
}))

const headerStyle = computed(() => ({
  color: hexToRgba(color.value, 0.95),
}))

// ------- 重命名 -------
const editing = ref(false)
const inputRef = ref<HTMLInputElement | null>(null)

async function startEditing() {
  editing.value = true
  await nextTick()
  inputRef.value?.focus()
  inputRef.value?.select()
}

function stopEditing() {
  editing.value = false
}

function handleInput(event: Event) {
  const target = event.target as HTMLInputElement
  canvasStore.updateNodeLabel(props.id, target.value)
}

// ------- 颜色选择 -------
const colorMenuOpen = ref(false)

function pickColor(next: string) {
  canvasStore.updateGroupColor(props.id, next)
  colorMenuOpen.value = false
}

function closeColorMenu() {
  colorMenuOpen.value = false
}

// ------- 拖拽调整大小 -------
// 关键点：VueFlow 会把外部 nodes 复制到内部状态，直接改 store 或内部节点对象的
// style 都不一定能触发 DOM 立即重绘（VueFlow 用 transform + inline 尺寸渲染）。
// 因此拖拽过程中直接修改真实 DOM 包裹元素（.vue-flow__node）的 width/height，
// 保证视觉即时跟手；拖拽结束再写回 VueFlow 内部节点与 store，做状态同步与持久化。
function startResize(event: MouseEvent) {
  const vfNode = findNode(props.id) as any
  // 找到当前分组对应的 DOM 包裹元素
  const nodeEl =
    (resizeHandleRef.value?.closest('.vue-flow__node') as HTMLElement | null) ||
    (document.querySelector(`.vue-flow__node[data-id="${props.id}"]`) as HTMLElement | null)

  const rect = nodeEl?.getBoundingClientRect()
  const zoom0 = getViewport().zoom || 1
  const startWidth =
    vfNode?.dimensions?.width ||
    (rect ? rect.width / zoom0 : 0) ||
    parseFloat(String(vfNode?.style?.width || '')) ||
    320
  const startHeight =
    vfNode?.dimensions?.height ||
    (rect ? rect.height / zoom0 : 0) ||
    parseFloat(String(vfNode?.style?.height || '')) ||
    200
  const startX = event.clientX
  const startY = event.clientY
  const zoom = getViewport().zoom || 1
  let lastW = startWidth
  let lastH = startHeight
  let rafId = 0
  let pendingW = startWidth
  let pendingH = startHeight

  // 用 rAF 节流：mousemove 只记录目标尺寸，真正写 DOM 合并到下一帧执行，
  // 避免每次移动都触发同步重排（layout thrashing）导致的卡顿。
  function flush() {
    rafId = 0
    lastW = pendingW
    lastH = pendingH
    if (nodeEl) {
      nodeEl.style.width = `${lastW}px`
      nodeEl.style.height = `${lastH}px`
    }
  }

  function onMove(e: MouseEvent) {
    // 缩放级别在拖拽开始时锁定，避免每帧读取触发额外 layout。
    pendingW = Math.max(120, Math.round(startWidth + (e.clientX - startX) / zoom))
    pendingH = Math.max(80, Math.round(startHeight + (e.clientY - startY) / zoom))
    if (!rafId) rafId = requestAnimationFrame(flush)
  }

  function onUp() {
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
    if (rafId) {
      cancelAnimationFrame(rafId)
      flush()
    }

    // 同步 VueFlow 内部节点尺寸（供内部布局/连线计算使用）
    if (vfNode) {
      vfNode.style = { ...(vfNode.style || {}), width: `${lastW}px`, height: `${lastH}px` }
      vfNode.dimensions = { width: lastW, height: lastH }
    }
    // 写回 store：持久化尺寸并支持撤销/重做
    canvasStore.updateGroupSize(props.id, lastW, lastH)
  }

  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
}





onMounted(() => window.addEventListener('click', closeColorMenu))
onBeforeUnmount(() => window.removeEventListener('click', closeColorMenu))
</script>
