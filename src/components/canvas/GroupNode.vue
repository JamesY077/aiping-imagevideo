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

  </div>
</template>


<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
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

onMounted(() => window.addEventListener('click', closeColorMenu))
onBeforeUnmount(() => window.removeEventListener('click', closeColorMenu))
</script>
