<template>
  <div class="skill-picker" :class="`skill-picker-${layout}`">
    <div class="skill-picker-head">
      <span class="skill-picker-title">{{ uploadOnly ? 'Skill' : '风格 Skill' }}</span>
      <span class="skill-picker-meta">
        <template v-if="uploadOnly">视频生成仅使用上传的 Skill</template>
        <template v-else>
          {{ skillStore.selectedStyleSkillIds.length
            ? `已选 ${skillStore.selectedStyleSkillIds.length} 个`
            : layout === 'grid' ? '可多选' : '可多选 · 横向滑动' }}
        </template>
      </span>
      <button
        v-if="!uploadOnly && skillStore.selectedStyleSkillIds.length"
        class="skill-picker-clear"
        type="button"
        @click="skillStore.clearStyleSkills()"
      >
        清空
      </button>
    </div>

    <div
      v-if="!uploadOnly"
      class="skill-picker-rail"
      role="group"
      aria-label="风格 Skill，可多选"
      @wheel="handleSkillRailWheel"
    >
      <button
        v-for="skill in styleSkillOptions"
        :key="skill.id"
        class="skill-chip"
        :class="{ active: skillStore.selectedStyleSkillIds.includes(skill.id) }"
        type="button"
        :title="skill.description"
        :aria-pressed="skillStore.selectedStyleSkillIds.includes(skill.id)"
        @click="skillStore.toggleStyleSkill(skill.id)"
      >
        <img
          v-if="skill.thumbnail"
          class="skill-chip-thumb"
          :src="assetUrl(skill.thumbnail)"
          alt=""
          loading="lazy"
          decoding="async"
        />
        <span class="skill-chip-name">{{ skill.name }}</span>
        <span class="skill-chip-check" aria-hidden="true">✓</span>
      </button>
    </div>

    <div class="skill-picker-foot">
      <div v-if="!uploadOnly" class="skill-defaults">
        <span class="skill-defaults-label">默认规范</span>
        <span
          v-for="skill in skillStore.enabledDefaultQualitySkills"
          :key="skill.id"
          class="skill-default-tag"
        >
          {{ skill.name }}
        </span>
        <span v-if="!skillStore.enabledDefaultQualitySkills.length" class="skill-defaults-off">
          已全部关闭
        </span>
        <button class="skill-settings-link" type="button" @click="router.push('/settings')">
          设置
        </button>
      </div>

      <div class="skill-upload-group" :class="{ 'is-solo': uploadOnly }">
        <input
          ref="skillFileInput"
          type="file"
          accept=".md,text/markdown"
          class="file-input"
          @change="handleSkillFileChange"
        />
        <button
          class="skill-upload-btn-inline"
          type="button"
          :class="{ active: !!skillStore.activeSkill }"
          :title="skillStore.activeSkill ? `已应用 Skill：${skillStore.activeSkill.name}（点击更换）` : '上传 .md Skill，生成时将严格遵循其规范'"
          @click="skillFileInput?.click()"
        >
          {{ skillStore.activeSkill ? `已上传：${skillStore.activeSkill.name}` : '上传 Skill' }}
        </button>
        <button
          v-if="skillStore.activeSkill"
          class="skill-clear-inline"
          type="button"
          title="移除已上传的 Skill"
          @click="skillStore.clearActiveSkill()"
        >
          ×
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useSkillStore } from '@/stores/skillStore'
import { readSkillFile } from '@/features/skill/parse'
import { STYLE_SKILL_OPTIONS } from '@/features/skill/builtin'
import { showErrorMessage } from '@/utils/errors'
import { assetUrl } from '@/utils/assets'

/**
 * 内置风格 Skill 多选器。
 * layout=rail：横向滑动缩略图（原简易模式参数面板）；
 * layout=grid：多列网格（图片页右侧参数栏）。
 */
withDefaults(defineProps<{
  layout?: 'rail' | 'grid'
  /** 仅上传入口：视频页不展示内置质量/风格 Skill。 */
  uploadOnly?: boolean
}>(), { layout: 'rail', uploadOnly: false })

const router = useRouter()
const skillStore = useSkillStore()
const styleSkillOptions = STYLE_SKILL_OPTIONS
const skillFileInput = ref<HTMLInputElement | null>(null)

function handleSkillRailWheel(event: WheelEvent) {
  const rail = event.currentTarget as HTMLElement | null
  if (!rail) return
  if (rail.scrollWidth <= rail.clientWidth) return
  if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return
  event.preventDefault()
  rail.scrollLeft += event.deltaY
}

async function handleSkillFileChange(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  try {
    const content = await readSkillFile(file)
    skillStore.setActiveSkillFromContent(content, file.name)
  } catch (error: any) {
    showErrorMessage(error?.message || 'Skill 文件读取失败，请确认是 .md 文件。')
  } finally {
    target.value = ''
  }
}
</script>

<style scoped>
.file-input {
  display: none;
}

.skill-picker {
  display: flex;
  flex-direction: column;
  gap: 9px;
  width: 100%;
  min-width: 0;
  overflow: hidden;
  /* 横向 chip 列表不能把父级 grid 列撑宽 */
  contain: inline-size;
  padding: 10px;
  border: 1px solid rgba(255, 255, 255, 0.09);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.028);
}

.skill-picker-head {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.skill-picker-title {
  font-size: 10.5px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.66);
}

.skill-picker-meta {
  font-size: 10.5px;
  color: rgba(255, 255, 255, 0.38);
}

.skill-picker-clear {
  margin-left: auto;
  padding: 2px 8px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 999px;
  background: transparent;
  color: rgba(255, 255, 255, 0.55);
  font-size: 10px;
  cursor: pointer;
  transition: color 0.2s ease, border-color 0.2s ease;
}

.skill-picker-clear:hover {
  border-color: rgba(255, 154, 92, 0.5);
  color: #ffb27a;
}

.skill-picker-rail {
  display: flex;
  gap: 8px;
  width: 100%;
  min-width: 0;
  padding-bottom: 3px;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.16) transparent;
}

.skill-picker-rail::-webkit-scrollbar {
  height: 5px;
}

.skill-picker-rail::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.16);
}

.skill-picker-rail::-webkit-scrollbar-track {
  background: transparent;
}

.skill-chip {
  position: relative;
  flex: 0 0 auto;
  width: 78px;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
}

.skill-chip-thumb {
  display: block;
  width: 78px;
  height: 78px;
  border-radius: 11px;
  object-fit: cover;
  filter: saturate(0.86) brightness(0.74);
  outline: 1px solid rgba(255, 255, 255, 0.1);
  outline-offset: -1px;
  transition:
    filter 0.3s ease,
    outline-color 0.3s ease,
    transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.skill-chip:hover .skill-chip-thumb {
  filter: saturate(1) brightness(0.9);
  transform: translateY(-2px);
}

.skill-chip.active .skill-chip-thumb {
  filter: saturate(1) brightness(1);
  outline: 2px solid rgba(247, 247, 242, 0.92);
  outline-offset: -2px;
}

.skill-chip-name {
  display: block;
  margin-top: 5px;
  overflow: hidden;
  color: rgba(255, 255, 255, 0.5);
  font-size: 10.5px;
  font-weight: 600;
  line-height: 1.3;
  text-align: center;
  white-space: nowrap;
  text-overflow: ellipsis;
  transition: color 0.25s ease;
}

.skill-chip.active .skill-chip-name {
  color: #fff;
}

.skill-chip-check {
  position: absolute;
  top: 5px;
  right: 5px;
  display: grid;
  place-items: center;
  width: 17px;
  height: 17px;
  border-radius: 50%;
  background: #f7f7f2;
  color: #08080a;
  font-size: 10px;
  font-weight: 800;
  box-shadow: 0 0 0 1.5px rgba(8, 8, 10, 0.3);
  opacity: 0;
  transform: scale(0.6);
  transition:
    opacity 0.25s ease,
    transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.skill-chip.active .skill-chip-check {
  opacity: 1;
  transform: scale(1);
}

.skill-picker-foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
}

.skill-defaults {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 5px;
  min-width: 0;
}

.skill-defaults-label {
  font-size: 9.5px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.34);
}

.skill-default-tag {
  padding: 2px 7px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.07);
  color: rgba(255, 255, 255, 0.54);
  font-size: 9.5px;
  white-space: nowrap;
}

.skill-defaults-off {
  color: #ffb27a;
  font-size: 10px;
}

.skill-settings-link {
  padding: 0;
  border: 0;
  background: transparent;
  color: rgba(255, 255, 255, 0.45);
  font-size: 10px;
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
}

.skill-settings-link:hover {
  color: #fff;
}

.skill-upload-group {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
}

/* 侧栏网格版：三列铺满，方便快速扫视风格 */
.skill-picker-grid .skill-picker-rail {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px 8px;
  overflow: visible;
}

.skill-picker-grid .skill-chip {
  width: 100%;
  min-width: 0;
}

.skill-picker-grid .skill-chip-thumb {
  width: 100%;
  height: auto;
  aspect-ratio: 1;
}

.skill-picker-grid .skill-picker-foot {
  flex-direction: column;
  flex-wrap: nowrap;
  align-items: stretch;
  gap: 8px;
}

/* 侧栏较窄：让脚注两行各自占满，标签在内部自行换行，避免撑出容器。 */
.skill-picker-grid .skill-defaults,
.skill-picker-grid .skill-upload-group {
  width: 100%;
  min-width: 0;
}

.skill-picker-grid .skill-default-tag {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
}

.skill-picker-grid .skill-upload-group {
  margin-left: 0;
}

.skill-picker .skill-upload-group.is-solo {
  width: 100%;
  margin-left: 0;
}

@media (max-width: 560px) {
  .skill-picker {
    padding: 9px;
  }

  .skill-picker-rail .skill-chip,
  .skill-picker-rail .skill-chip-thumb {
    width: 70px;
  }

  .skill-picker-rail .skill-chip-thumb {
    height: 70px;
  }

  .skill-picker-grid .skill-chip,
  .skill-picker-grid .skill-chip-thumb {
    width: 100%;
    height: auto;
    aspect-ratio: 1;
  }

  .skill-upload-group {
    width: 100%;
    margin-left: 0;
  }
}
</style>
