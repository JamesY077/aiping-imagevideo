<template>
  <Teleport to="body">
    <div class="layer-editor-mask" @click.self="$emit('close')">
      <section class="layer-editor" role="dialog" aria-modal="true" aria-label="Moss 图层编辑">
        <header class="editor-head">
          <div class="head-text">
            <h2>图层编辑 · Moss</h2>
            <p>
              拖动框调整元素位置和大小，也可以在右侧用自然语言让 AI 改布局。Moss 是文生图模型，
              修改后会按新布局重新生成整图。
            </p>
          </div>
          <button class="close-btn" type="button" aria-label="关闭图层编辑" @click="$emit('close')">✕</button>
        </header>

        <div class="editor-body">
          <div class="stage">
            <div ref="canvasRef" class="canvas-wrap">
              <img :src="imageUrl" alt="待编辑的生成图片" draggable="false" @dragstart.prevent />
              <div
                v-for="(item, index) in draft.items"
                :key="item.id"
                class="bbox"
                :class="{
                  selected: item.id === selectedId,
                  background: isFullBleed(item),
                  'label-inside': item.y < draft.height * 0.03,
                }"
                :style="itemStyle(item, index)"
                @pointerdown="startDrag($event, item, 'move')"
              >
                <span class="bbox-label">
                  {{ index + 1 }} · {{ labelText(item.label) }}
                  <em v-if="isFullBleed(item)">背景</em>
                </span>
                <span
                  v-if="!isFullBleed(item)"
                  class="resize-handle"
                  aria-hidden="true"
                  @pointerdown.stop="startDrag($event, item, 'resize')"
                />
              </div>
            </div>
          </div>

          <aside class="side">
            <div class="panel-block layer-list-block">
              <div class="panel-head">
                <span class="panel-title">图层（{{ draft.items.length }}）</span>
                <button class="ghost-btn" type="button" @click="addLayer">＋ 添加</button>
              </div>
              <div class="layer-list">
                <button
                  v-for="(item, index) in draft.items"
                  :key="item.id"
                  class="layer-row"
                  :class="{ active: item.id === selectedId }"
                  type="button"
                  @click="selectedId = item.id"
                >
                  <span class="layer-index" :style="{ background: colorAt(index) }">{{ index + 1 }}</span>
                  <span class="layer-meta">
                    <span class="layer-kind">{{ labelText(item.label) }}</span>
                    <span class="layer-caption">{{ item.text || item.caption || '未命名图层' }}</span>
                  </span>
                  <span
                    v-if="draft.items.length > 1"
                    class="layer-remove"
                    role="button"
                    tabindex="0"
                    title="删除该图层"
                    @click.stop="removeLayer(item.id)"
                    @keydown.enter.stop="removeLayer(item.id)"
                  >✕</span>
                </button>
              </div>
            </div>

            <div v-if="selectedItem" class="panel-block inspector-block">
              <div class="panel-head">
                <span class="panel-title">图层属性</span>
                <span class="hint-text">{{ positionLabel(selectedItem) }}</span>
              </div>

              <label class="field">
                <span>类型</span>
                <select v-model="selectedItem.label">
                  <option value="object">物体</option>
                  <option value="character">人物</option>
                  <option value="text">文字</option>
                </select>
              </label>

              <label class="field">
                <span>元素描述<em>英文效果更好</em></span>
                <textarea
                  v-model="selectedItem.caption"
                  rows="3"
                  placeholder="例如：a white ceramic latte cup with leaf latte art, soft shadow"
                />
              </label>

              <label v-if="selectedItem.label === 'text'" class="field">
                <span>文字内容</span>
                <textarea
                  v-model="selectedItem.text"
                  rows="2"
                  placeholder="要渲染的原文，可换行"
                />
              </label>

              <div class="field">
                <span>位置与大小（像素）</span>
                <div class="coord-grid">
                  <label>X<input v-model.number="selectedItem.x" type="number" min="0" @change="clampSelected" /></label>
                  <label>Y<input v-model.number="selectedItem.y" type="number" min="0" @change="clampSelected" /></label>
                  <label>宽<input v-model.number="selectedItem.width" type="number" min="24" @change="clampSelected" /></label>
                  <label>高<input v-model.number="selectedItem.height" type="number" min="24" @change="clampSelected" /></label>
                </div>
              </div>
            </div>

            <div class="panel-block ai-block">
              <div class="panel-head">
                <span class="panel-title">自然语言修改</span>
              </div>
              <textarea
                v-model="instruction"
                rows="3"
                :disabled="busy"
                placeholder="例如：把标题移到顶部居中，咖啡杯放大并移到正中偏左，右下角再加一行小字「手冲 · 拿铁」"
              />
              <button class="ai-btn" type="button" :disabled="busy || !instruction.trim()" @click="applyInstruction">
                {{ busy ? 'AI 正在更新布局…' : '让 AI 更新布局' }}
              </button>
              <p v-if="errorMessage" class="error-text">{{ errorMessage }}</p>
            </div>

            <footer class="editor-foot">
              <p class="foot-note">
                重新生成会消耗一次 Moss 调用。未移动的元素会按原布局尽量保持原位，但细节可能有轻微差异。
              </p>
              <div class="foot-actions">
                <button class="ghost-btn" type="button" @click="$emit('close')">取消</button>
                <button class="primary-btn" type="button" :disabled="busy" @click="regenerate">
                  按此布局重新生成
                </button>
              </div>
            </footer>
          </aside>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { MossLayout, MossLayoutItem, MossLayoutLabel } from '@/types/layout'
import {
  clampLayoutItem,
  cloneLayout,
  createDefaultLayoutItem,
  describeItemPosition,
} from '@/features/layout/mossLayout'
import { editMossLayout } from '@/features/layout/planner'
import { normalizeErrorMessage } from '@/utils/errors'

const props = defineProps<{
  imageUrl: string
  layout: MossLayout
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'regenerate', layout: MossLayout): void
}>()

const LAYER_COLORS = ['#f6c453', '#63b3ed', '#f687b3', '#68d391', '#b794f4', '#f6ad55', '#4fd1c5', '#fc8181']

const draft = ref<MossLayout>(cloneLayout(props.layout))
const selectedId = ref<string | null>(draft.value.items[0]?.id ?? null)
const instruction = ref('')
const busy = ref(false)
const errorMessage = ref('')
const canvasRef = ref<HTMLElement | null>(null)

const selectedItem = computed(() => draft.value.items.find((item) => item.id === selectedId.value) || null)

function colorAt(index: number): string {
  return LAYER_COLORS[index % LAYER_COLORS.length]
}

function labelText(label: MossLayoutLabel): string {
  if (label === 'text') return '文字'
  if (label === 'character') return '人物'
  return '物体'
}

function isFullBleed(item: MossLayoutItem): boolean {
  return item.width >= draft.value.width * 0.95 && item.height >= draft.value.height * 0.95
}

function itemStyle(item: MossLayoutItem, index: number) {
  const color = colorAt(index)
  return {
    left: `${(item.x / draft.value.width) * 100}%`,
    top: `${(item.y / draft.value.height) * 100}%`,
    width: `${(item.width / draft.value.width) * 100}%`,
    height: `${(item.height / draft.value.height) * 100}%`,
    borderColor: color,
    '--layer-color': color,
  }
}

function positionLabel(item: MossLayoutItem): string {
  return `${describeItemPosition(item, draft.value.width, draft.value.height)} · ${item.width}×${item.height}`
}

function clampSelected() {
  const item = selectedItem.value
  if (!item) return
  const clamped = clampLayoutItem(
    {
      ...item,
      x: Number(item.x) || 0,
      y: Number(item.y) || 0,
      width: Number(item.width) || 24,
      height: Number(item.height) || 24,
    },
    draft.value.width,
    draft.value.height
  )
  Object.assign(item, clamped)
}

function addLayer() {
  const item = createDefaultLayoutItem(draft.value)
  draft.value.items.push(item)
  selectedId.value = item.id
}

function removeLayer(id: string) {
  if (draft.value.items.length <= 1) return
  const index = draft.value.items.findIndex((item) => item.id === id)
  if (index < 0) return
  draft.value.items.splice(index, 1)
  if (selectedId.value === id) {
    selectedId.value = draft.value.items[Math.min(index, draft.value.items.length - 1)]?.id ?? null
  }
}

interface DragState {
  mode: 'move' | 'resize'
  id: string
  startX: number
  startY: number
  origin: { x: number; y: number; width: number; height: number }
}

let dragState: DragState | null = null

function canvasRect(): DOMRect | null {
  const rect = canvasRef.value?.getBoundingClientRect()
  return rect && rect.width > 0 && rect.height > 0 ? rect : null
}

function startDrag(event: PointerEvent, item: MossLayoutItem, mode: 'move' | 'resize') {
  if (isFullBleed(item) && mode === 'move') return
  event.preventDefault()
  selectedId.value = item.id
  dragState = {
    mode,
    id: item.id,
    startX: event.clientX,
    startY: event.clientY,
    origin: { x: item.x, y: item.y, width: item.width, height: item.height },
  }
  window.addEventListener('pointermove', onDragMove)
  window.addEventListener('pointerup', stopDrag)
  window.addEventListener('pointercancel', stopDrag)
}

function onDragMove(event: PointerEvent) {
  const state = dragState
  const rect = canvasRect()
  if (!state || !rect) return
  const item = draft.value.items.find((candidate) => candidate.id === state.id)
  if (!item) return

  const scaleX = draft.value.width / rect.width
  const scaleY = draft.value.height / rect.height
  const dx = (event.clientX - state.startX) * scaleX
  const dy = (event.clientY - state.startY) * scaleY

  if (state.mode === 'move') {
    item.x = Math.round(Math.min(Math.max(state.origin.x + dx, 0), draft.value.width - item.width))
    item.y = Math.round(Math.min(Math.max(state.origin.y + dy, 0), draft.value.height - item.height))
    return
  }

  item.width = Math.round(Math.min(Math.max(state.origin.width + dx, 24), draft.value.width - item.x))
  item.height = Math.round(Math.min(Math.max(state.origin.height + dy, 24), draft.value.height - item.y))
}

function stopDrag() {
  dragState = null
  window.removeEventListener('pointermove', onDragMove)
  window.removeEventListener('pointerup', stopDrag)
  window.removeEventListener('pointercancel', stopDrag)
}

async function applyInstruction() {
  const text = instruction.value.trim()
  if (!text || busy.value) return

  busy.value = true
  errorMessage.value = ''
  try {
    const next = await editMossLayout({ layout: draft.value, instruction: text })
    draft.value = next
    instruction.value = ''
    if (!next.items.some((item) => item.id === selectedId.value)) {
      selectedId.value = next.items[0]?.id ?? null
    }
  } catch (error) {
    errorMessage.value = normalizeErrorMessage(error, 'AI 更新布局失败，请稍后重试。')
  } finally {
    busy.value = false
  }
}

function regenerate() {
  if (busy.value) return
  emit('regenerate', cloneLayout(draft.value))
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') emit('close')
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
  stopDrag()
})
</script>

<style scoped>
.layer-editor-mask {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(4, 4, 5, 0.72);
  backdrop-filter: blur(10px);
}

.layer-editor {
  display: flex;
  flex-direction: column;
  width: min(1280px, 100%);
  height: min(860px, 100%);
  overflow: hidden;
  border: 1px solid rgba(217, 205, 184, 0.18);
  border-radius: 22px;
  background: linear-gradient(180deg, rgba(22, 20, 17, 0.98), rgba(11, 10, 9, 0.98));
  color: rgba(255, 255, 255, 0.9);
  box-shadow: 0 30px 80px rgba(0, 0, 0, 0.55);
}

.editor-head {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 18px 22px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.head-text h2 {
  margin: 0 0 6px;
  font-size: 17px;
  font-weight: 600;
}

.head-text p {
  margin: 0;
  max-width: 760px;
  font-size: 12px;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.55);
}

.close-btn {
  margin-left: auto;
  width: 32px;
  height: 32px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.04);
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

.editor-body {
  display: flex;
  min-height: 0;
  flex: 1;
}

.stage {
  display: flex;
  flex: 1;
  min-width: 0;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background:
    radial-gradient(circle at 50% 0%, rgba(217, 205, 184, 0.09), transparent 60%),
    rgba(8, 8, 8, 0.55);
}

/* 画布容器必须与图片尺寸完全一致，否则 bbox 百分比定位会和图片错位。 */
.canvas-wrap {
  position: relative;
  display: block;
  flex: 0 0 auto;
  width: fit-content;
  height: fit-content;
  max-width: 100%;
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.4);
  touch-action: none;
}

.canvas-wrap img {
  display: block;
  width: auto;
  height: auto;
  max-width: 100%;
  max-height: calc(min(860px, 100vh - 40px) - 140px);
  user-select: none;
  -webkit-user-drag: none;
}

.bbox {
  position: absolute;
  border: 1.5px solid var(--layer-color, #f6c453);
  background: color-mix(in srgb, var(--layer-color, #f6c453) 12%, transparent);
  cursor: move;
  transition: background 0.15s ease, box-shadow 0.15s ease;
}

.bbox.background {
  cursor: default;
  border-style: dashed;
}

.bbox.selected {
  background: color-mix(in srgb, var(--layer-color, #f6c453) 22%, transparent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--layer-color, #f6c453) 45%, transparent);
  z-index: 2;
}

.bbox-label {
  position: absolute;
  top: -22px;
  left: -1px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 220px;
  padding: 2px 7px;
  overflow: hidden;
  border-radius: 6px 6px 6px 0;
  background: var(--layer-color, #f6c453);
  color: rgba(10, 10, 10, 0.92);
  font-size: 11px;
  font-weight: 600;
  line-height: 1.5;
  white-space: nowrap;
  text-overflow: ellipsis;
  pointer-events: none;
}

.bbox-label em {
  padding: 0 4px;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.18);
  font-style: normal;
}

/* 贴近画布顶部的图层把标签放进框内，避免被裁切。 */
.bbox.label-inside .bbox-label {
  top: 0;
  border-radius: 0 6px 6px 0;
}

.resize-handle {
  position: absolute;
  right: -5px;
  bottom: -5px;
  width: 11px;
  height: 11px;
  border: 1.5px solid rgba(10, 10, 10, 0.85);
  border-radius: 3px;
  background: var(--layer-color, #f6c453);
  cursor: nwse-resize;
}

.side {
  display: flex;
  flex-direction: column;
  width: 360px;
  flex: 0 0 360px;
  min-height: 0;
  border-left: 1px solid rgba(255, 255, 255, 0.08);
  overflow-y: auto;
}

.panel-block {
  padding: 14px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}

.panel-title {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: rgba(255, 255, 255, 0.78);
}

.hint-text {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.42);
}

.ghost-btn {
  padding: 5px 10px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.75);
  font-size: 12px;
  cursor: pointer;
}

.ghost-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

.layer-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 180px;
  overflow-y: auto;
}

.layer-row {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 7px 8px;
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.03);
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.layer-row:hover {
  background: rgba(255, 255, 255, 0.07);
}

.layer-row.active {
  border-color: rgba(246, 196, 83, 0.55);
  background: rgba(246, 196, 83, 0.1);
}

.layer-index {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  flex: 0 0 20px;
  border-radius: 7px;
  color: rgba(10, 10, 10, 0.9);
  font-size: 11px;
  font-weight: 700;
}

.layer-meta {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 1px;
}

.layer-kind {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.4);
}

.layer-caption {
  overflow: hidden;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.8);
  white-space: nowrap;
  text-overflow: ellipsis;
}

.layer-remove {
  margin-left: auto;
  padding: 2px 6px;
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.35);
  font-size: 11px;
}

.layer-remove:hover {
  background: rgba(248, 113, 113, 0.18);
  color: #fca5a5;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 10px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.55);
}

.field em {
  margin-left: 6px;
  color: rgba(255, 255, 255, 0.32);
  font-style: normal;
}

.field select,
.field input,
.field textarea,
.ai-block textarea {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 9px;
  background: rgba(0, 0, 0, 0.28);
  color: rgba(255, 255, 255, 0.88);
  font-size: 12px;
  font-family: inherit;
  line-height: 1.5;
  resize: vertical;
}

.field select:focus,
.field input:focus,
.field textarea:focus,
.ai-block textarea:focus {
  outline: none;
  border-color: rgba(246, 196, 83, 0.5);
}

.coord-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.coord-grid label {
  display: flex;
  align-items: center;
  gap: 6px;
  color: rgba(255, 255, 255, 0.45);
}

.ai-btn {
  width: 100%;
  margin-top: 8px;
  padding: 9px 12px;
  border: 1px solid rgba(246, 196, 83, 0.4);
  border-radius: 10px;
  background: rgba(246, 196, 83, 0.12);
  color: #f6e3b0;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.ai-btn:hover:not(:disabled) {
  background: rgba(246, 196, 83, 0.2);
}

.ai-btn:disabled,
.primary-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.error-text {
  margin: 8px 0 0;
  color: #fca5a5;
  font-size: 11px;
  line-height: 1.5;
}

.editor-foot {
  margin-top: auto;
  padding: 14px 16px 18px;
}

.foot-note {
  margin: 0 0 10px;
  color: rgba(255, 255, 255, 0.38);
  font-size: 11px;
  line-height: 1.5;
}

.foot-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.primary-btn {
  padding: 9px 16px;
  border: 0;
  border-radius: 10px;
  background: linear-gradient(135deg, #f6d98a, #e0a83a);
  color: #241a06;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

@media (max-width: 1100px) {
  .side {
    width: 320px;
    flex-basis: 320px;
  }
}

@media (max-width: 820px) {
  .layer-editor-mask {
    padding: 0;
  }

  .layer-editor {
    width: 100%;
    height: 100%;
    border-radius: 0;
  }

  .editor-body {
    flex-direction: column;
  }

  .stage {
    flex: none;
    height: auto;
  }

  .canvas-wrap img {
    max-height: 42vh;
  }

  .side {
    width: 100%;
    flex: 1;
    border-left: 0;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }
}
</style>
