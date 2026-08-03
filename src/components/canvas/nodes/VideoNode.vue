<template>
  <NodeShell
    ref="shellRef"
    :id="id"
    :data="data"
    :selected="selected"
    title="视频节点"
    placeholder="输入 prompt…（可用 @ 引用下方素材）"
    :default-system-prompt="DEFAULT_VIDEO_SYSTEM_PROMPT"
  >

    <template #icon>
      <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
        <rect x="4" y="6" width="16" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.8" />
        <path d="M11 10l4 2-4 2z" fill="currentColor" />
      </svg>
    </template>

    <template #toolbar>
      <!-- 生成方式选择 -->
      <select class="gen-select" :value="data.videoMode" @change="onVideoMode">
        <option v-for="m in videoModeOptions" :key="m.value" :value="m.value">{{ m.label }}</option>
      </select>

      <!-- 模型选择 -->
      <ModelSelector
        class="gen-model"
        media-type="video"
        :model-value="data.model ?? null"
        compact
        @update:model-value="(v) => store.updateNodeData(id, { model: v })"
      />

      <!-- 比例选择 -->
      <select class="gen-select" :value="data.aspectRatio" @change="onRatio">
        <option v-for="r in ratioOptions" :key="r" :value="r">{{ r }}</option>
      </select>

      <!-- 时长选择 -->
      <select class="gen-select" :value="String(data.duration)" @change="onDuration">
        <option v-for="d in durationOptions" :key="d.value" :value="String(d.value)">{{ d.label }}</option>
      </select>

      <!-- AI 润色 -->
      <button
        class="gen-chip"
        :class="{ 'gen-chip--active': data.polish }"
        @click="store.updateNodeData(id, { polish: !data.polish })"
      >
        AI润色
      </button>

      <!-- 是否生成声音（仅 Kling 系列支持 audio=native/off，默认关闭） -->
      <button
        v-if="showKlingSound"
        class="gen-chip"
        :class="{ 'gen-chip--active': data.klingSound }"
        :title="data.klingSound ? '生成的视频含有与画面适配的声音' : '生成的视频不含有声音'"
        @click="store.updateNodeData(id, { klingSound: !data.klingSound })"
      >
        {{ data.klingSound ? '声音开' : '声音关' }}
      </button>


      <!-- 图生视频：上传参考图 -->
      <label v-if="showUpload" class="gen-chip gen-upload">
        {{ data.referenceFileName ? '已选图' : '参考图' }}
        <input type="file" accept="image/*" hidden @change="onFile" />
      </label>

      <!-- 主体参考视频：上传主体参考图 -->
      <label v-if="showSubjectUpload" class="gen-chip gen-upload">
        {{ data.referenceFileName ? '已选主体图' : '主体参考图' }}
        <input type="file" accept="image/*" hidden @change="onFile" />
      </label>

      <!-- 首尾帧生视频：上传首帧 + 尾帧 -->
      <template v-if="showStartEndUpload">
        <label class="gen-chip gen-upload">
          {{ data.startFrameName ? '已选首帧' : '首帧' }}
          <input type="file" accept="image/*" hidden @change="onStartFrame" />
        </label>
        <label class="gen-chip gen-upload">
          {{ data.endFrameName ? '已选尾帧' : '尾帧(可选)' }}
          <input type="file" accept="image/*" hidden @change="onEndFrame" />
        </label>

      </template>

      <!-- 动作控制：上传参考图像 + 参考视频 -->
      <template v-if="showMotionUpload">
        <label class="gen-chip gen-upload">
          {{ data.motionImageName ? '已选参考图' : '参考图像' }}
          <input type="file" accept="image/*" hidden @change="onMotionImage" />
        </label>
        <label class="gen-chip gen-upload">
          {{ data.motionVideoName ? '已选参考视频' : '参考视频' }}
          <input type="file" accept="video/*" hidden @change="onMotionVideo" />
        </label>
      </template>

      <!-- 多模态参考（Seedance 2.0）：图片 0~9 / 视频 0~3 / 音频 0~3 拆分上传 -->
      <template v-if="showMultimodalUpload">
        <label class="gen-chip gen-upload">
          图片（{{ (data.multimodalImages || []).length }}/{{ MULTIMODAL_LIMITS.image }}）
          <input type="file" accept="image/*" multiple hidden @change="onMultimodalImages" />
        </label>
        <label class="gen-chip gen-upload">
          视频（{{ (data.multimodalVideos || []).length }}/{{ MULTIMODAL_LIMITS.video }}）
          <input type="file" accept="video/*" multiple hidden @change="onMultimodalVideos" />
        </label>
        <label class="gen-chip gen-upload">
          音频（{{ (data.multimodalAudios || []).length }}/{{ MULTIMODAL_LIMITS.audio }}）
          <input type="file" accept="audio/*" multiple hidden @change="onMultimodalAudios" />
        </label>
      </template>

      <!-- 编辑视频（Seedance 2.0）：待编辑视频 + 替换图片 -->
      <template v-if="showEditVideoUpload">
        <label class="gen-chip gen-upload">
          {{ data.editVideoName ? '已选视频' : '待编辑视频' }}
          <input type="file" accept="video/*" hidden @change="onEditVideo" />
        </label>
        <label class="gen-chip gen-upload">
          {{ data.editImageName ? '已选图片' : '替换图片' }}
          <input type="file" accept="image/*" hidden @change="onEditImage" />
        </label>
      </template>
    </template>

    <!-- 多模态参考：素材缩略图 + @ 引用提示（放在工具栏下方，展示已上传素材并支持删除） -->
    <template v-if="showMultimodalUpload" #below>
      <div
        v-if="hasMultimodalAssets"
        class="mm-assets nodrag"
        @mousedown.stop
        @wheel.stop
      >
        <div class="mm-hint">
          在提示词中用 <b>@图片1</b> / <b>@视频1</b> / <b>@音频1</b> 引用下方素材、指定其出现位置。
        </div>
        <div class="mm-group" v-if="(data.multimodalImages || []).length">
          <span
            v-for="(url, i) in data.multimodalImages"
            :key="'img' + i"
            class="mm-item"
            @click="insertRef('图片', i + 1)"
            :title="'点击在提示词插入 @图片' + (i + 1)"
          >
            <img :src="url" alt="" />
            <span class="mm-tag">@图片{{ i + 1 }}</span>
            <button class="mm-del" @click.stop="removeMultimodal('multimodalImages', i)">✕</button>
          </span>
        </div>
        <div class="mm-group" v-if="(data.multimodalVideos || []).length">
          <span
            v-for="(url, i) in data.multimodalVideos"
            :key="'vid' + i"
            class="mm-item"
            @click="insertRef('视频', i + 1)"
            :title="'点击在提示词插入 @视频' + (i + 1)"
          >
            <video :src="url" muted />
            <span class="mm-tag">@视频{{ i + 1 }}</span>
            <button class="mm-del" @click.stop="removeMultimodal('multimodalVideos', i)">✕</button>
          </span>
        </div>
        <div class="mm-group mm-group--audio" v-if="(data.multimodalAudios || []).length">
          <span
            v-for="(_url, i) in data.multimodalAudios"
            :key="'aud' + i"
            class="mm-item mm-item--audio"
            @click="insertRef('音频', i + 1)"
            :title="'点击在提示词插入 @音频' + (i + 1)"
          >
            <span class="mm-audio-ico">♪</span>
            <span class="mm-tag">@音频{{ i + 1 }}</span>
            <button class="mm-del" @click.stop="removeMultimodal('multimodalAudios', i)">✕</button>
          </span>
        </div>
      </div>
    </template>
  </NodeShell>
</template>


<script setup lang="ts">
/**
 * 视频节点：支持文生 / 图生 / 首尾帧 / 主体参考 / 动作控制 / 多模态参考 / 编辑视频多种生成方式。
 * 其中「多模态参考」「编辑视频」为 Seedance 2.0 系列专属能力。
 */
import { computed, ref } from 'vue'
import NodeShell from './NodeShell.vue'

import ModelSelector from '@/components/ModelSelector.vue'
import { useGenerationNode, type GenerationNodeProps } from './useGenerationNode'
import { DEFAULT_VIDEO_SYSTEM_PROMPT } from '@/stores/settingsStore'

const props = defineProps<GenerationNodeProps>()

// NodeShell 实例引用：用于调用其暴露的 insertMention（在光标处/末尾插入 @ 引用）。
const shellRef = ref<InstanceType<typeof NodeShell> | null>(null)

const {

  store,
  videoModeOptions,
  ratioOptions,
  durationOptions,
  showUpload,
  showSubjectUpload,
  showStartEndUpload,
  showMotionUpload,
  showMultimodalUpload,
  showEditVideoUpload,
  showKlingSound,
  MULTIMODAL_LIMITS,

  onVideoMode,
  onRatio,
  onDuration,
  onFile,
  onStartFrame,
  onEndFrame,
  onMotionImage,
  onMotionVideo,
  onMultimodalImages,
  onMultimodalVideos,
  onMultimodalAudios,
  removeMultimodal,
  onEditVideo,
  onEditImage,
} = useGenerationNode(props)

// 是否已有任意多模态素材（用于决定是否展示缩略图区）。
const hasMultimodalAssets = computed(
  () =>
    (props.data.multimodalImages || []).length +
      (props.data.multimodalVideos || []).length +
      (props.data.multimodalAudios || []).length >
    0,
)

// 点击素材：在提示词中插入 @引用（如 @图片1），指定素材出现位置。
// 优先调用 NodeShell 暴露的 insertMention（会聚焦输入框、定位光标），
// 若尚未获取到实例则退化为直接在末尾追加。
function insertRef(kind: '图片' | '视频' | '音频', index: number) {
  const label = `${kind}${index}`
  const shell = shellRef.value as unknown as { insertMention?: (label: string) => void } | null
  if (shell?.insertMention) {
    shell.insertMention(label)
    return
  }
  const current = props.data.prompt || ''
  const next = current && !current.endsWith(' ') ? `${current} @${label} ` : `${current}@${label} `
  store.updateNodeData(props.id, { prompt: next })
}

</script>

<style scoped>
.mm-assets {
  padding: 8px 10px 10px;
  border-top: 1px solid var(--border-color, #e5e7eb);
}
.mm-hint {
  font-size: 11px;
  line-height: 1.5;
  color: var(--text-secondary, #6b7280);
  margin-bottom: 6px;
}
.mm-hint b {
  color: var(--text-primary, #111827);
  font-weight: 600;
}
.mm-group {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
}
.mm-item {
  position: relative;
  width: 52px;
  height: 52px;
  border-radius: 6px;
  overflow: hidden;
  cursor: pointer;
  border: 1px solid var(--border-color, #e5e7eb);
  background: #f3f4f6;
  display: flex;
  align-items: center;
  justify-content: center;
}
.mm-item img,
.mm-item video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.mm-item--audio {
  background: #eef2ff;
}
.mm-audio-ico {
  font-size: 18px;
  color: #6366f1;
}
.mm-tag {
  position: absolute;
  left: 0;
  bottom: 0;
  right: 0;
  font-size: 9px;
  line-height: 1.3;
  text-align: center;
  color: #fff;
  background: rgba(0, 0, 0, 0.55);
  padding: 1px 0;
}
.mm-del {
  position: absolute;
  top: 1px;
  right: 1px;
  width: 14px;
  height: 14px;
  line-height: 12px;
  font-size: 10px;
  text-align: center;
  border: none;
  border-radius: 50%;
  color: #fff;
  background: rgba(0, 0, 0, 0.6);
  cursor: pointer;
  padding: 0;
}
</style>

