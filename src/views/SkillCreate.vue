<script setup lang="ts">
// 创作 Skill 页面：左侧对话框 + 右侧 Markdown 编辑框。
// 顶部提供模版例子专区；生成结果直接进入编辑框、支持修改与下载；
// 底部「效果测试」可对当前 skill 做图片/视频测试。
import { ref, computed, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { generateSkill, type SkillTurn } from '@/features/skill/generate'
import { parseSkillContent } from '@/features/skill/parse'
import { ARTSKILLS_DISPLAY_NAME } from '@/features/skill/models'
import { useSkillStore } from '@/stores/skillStore'
import { useGenerate } from '@/composables/useGenerate'
import { useChatStore } from '@/stores/chatStore'
import { imageModelModules, videoModelModules } from '@/models'

const router = useRouter()
const skillStore = useSkillStore()
const chatStore = useChatStore()
const { generate } = useGenerate()

// —— 模版例子专区 ——
const templates = [
  { title: '影视风格 Skill', prompt: '帮我创作一个影视风格的 skill，用于生成电影质感的画面。' },
  { title: '短视频带货 Skill', prompt: '帮我创作一个短视频带货口播的 skill，输出脚本与分镜。' },
  { title: '产品宣传片 Skill', prompt: '帮我创作一个产品宣传片的 skill，强调质感与卖点呈现。' },
  { title: '国风插画 Skill', prompt: '帮我创作一个国风插画风格的 skill，用于图片生成。' },
]

// —— 对话 ——
const input = ref('')
const messages = ref<Array<{ role: 'user' | 'assistant'; content: string }>>([])
const isGenerating = ref(false)

// —— Markdown 编辑框 ——
const markdown = ref('')

const skillName = computed(() => {
  if (!markdown.value.trim()) return ARTSKILLS_DISPLAY_NAME
  return parseSkillContent(markdown.value).name
})

function useTemplate(prompt: string) {
  input.value = prompt
}

async function send() {
  const text = input.value.trim()
  if (!text || isGenerating.value) return
  input.value = ''
  messages.value.push({ role: 'user', content: text })
  isGenerating.value = true
  try {
    const history: SkillTurn[] = messages.value
      .slice(0, -1)
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role, content: m.content }))
    // 若已有生成内容，把当前 markdown 作为上下文交给模型继续修改。
    if (markdown.value.trim()) {
      history.push({ role: 'assistant', content: markdown.value })
    }
    const result = await generateSkill({
      prompt: text,
      modelPreference: skillStore.modelPreference,
      history,
    })
    markdown.value = result.content
    messages.value.push({
      role: 'assistant',
      content: `已按 ${ARTSKILLS_DISPLAY_NAME} 生成 Skill，可在右侧编辑框查看与修改。`,
    })
    await nextTick()
  } catch (e) {
    messages.value.push({
      role: 'assistant',
      content: `生成失败：${e instanceof Error ? e.message : '未知错误，请重试。'}`,
    })
  } finally {
    isGenerating.value = false
  }
}

function downloadSkill() {
  if (!markdown.value.trim()) return
  const blob = new Blob([markdown.value], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const safeName = skillName.value.replace(/[^\w\u4e00-\u9fa5-]+/g, '_') || 'skill'
  a.href = url
  a.download = `${safeName}.md`
  a.click()
  URL.revokeObjectURL(url)
}

function applyAsActiveSkill() {
  if (!markdown.value.trim()) return
  skillStore.setActiveSkillFromContent(markdown.value, `${skillName.value}.md`)
  applied.value = true
  setTimeout(() => (applied.value = false), 2000)
}
const applied = ref(false)

// —— 效果测试 ——
const showTest = ref(false)
const testType = ref<'image' | 'video'>('image')
const testPrompt = ref('')
const imageModelId = imageModelModules[0]?.id || ''
const videoModelId = videoModelModules[0]?.id || ''

const testResults = computed(() =>
  chatStore.messages.filter((m) => m.type === 'assistant' && m.generateResult),
)

async function runTest() {
  const text = testPrompt.value.trim()
  if (!text || chatStore.isGenerating) return
  if (testType.value === 'image') {
    await generate(text, 'text2image', imageModelId, undefined, '1:1', 6, false, markdown.value || null)
  } else {
    await generate(text, 'text2video', videoModelId, undefined, '16:9', 5, false, markdown.value || null)
  }
}

function goBack() {
  router.back()
}
</script>

<template>
  <div class="skill-create">
    <header class="sc-header">
      <button class="sc-back" @click="goBack">← 返回</button>
      <h1>创作 Skill</h1>
      <div class="sc-model">当前模型：{{ ARTSKILLS_DISPLAY_NAME }}</div>
    </header>

    <!-- 模版例子专区 -->
    <section class="sc-templates">
      <span class="sc-templates-label">模版例子</span>
      <div class="sc-templates-list">
        <button
          v-for="tpl in templates"
          :key="tpl.title"
          class="sc-template"
          @click="useTemplate(tpl.prompt)"
        >
          {{ tpl.title }}
        </button>
      </div>
    </section>

    <div class="sc-body">
      <!-- 左：对话框 -->
      <section class="sc-chat">
        <div class="sc-messages">
          <p v-if="!messages.length" class="sc-empty">
            在下方输入一句话，例如：“帮我创作一个影视风格的 skill”，即可生成标准化 Skill 文件。
          </p>
          <div
            v-for="(msg, i) in messages"
            :key="i"
            class="sc-msg"
            :class="msg.role"
          >
            <span class="sc-msg-role">{{ msg.role === 'user' ? '你' : ARTSKILLS_DISPLAY_NAME }}</span>
            <p>{{ msg.content }}</p>
          </div>
          <div v-if="isGenerating" class="sc-msg assistant">
            <span class="sc-msg-role">{{ ARTSKILLS_DISPLAY_NAME }}</span>
            <p>正在生成 Skill…</p>
          </div>
        </div>
        <div class="sc-input">
          <textarea
            v-model="input"
            placeholder="描述你想要的 skill，例如：帮我创作一个影视风格的 skill"
            @keydown.enter.exact.prevent="send"
          />
          <button class="sc-send" :disabled="isGenerating || !input.trim()" @click="send">
            发送
          </button>
        </div>
      </section>

      <!-- 右：Markdown 编辑框 -->
      <section class="sc-editor">
        <div class="sc-editor-toolbar">
          <span class="sc-editor-title">Skill 内容（可编辑）</span>
          <div class="sc-editor-actions">
            <button :disabled="!markdown.trim()" @click="applyAsActiveSkill">
              {{ applied ? '已应用 ✓' : '应用到生成' }}
            </button>
            <button :disabled="!markdown.trim()" @click="downloadSkill">下载 .md</button>
          </div>
        </div>
        <textarea
          v-model="markdown"
          class="sc-md"
          placeholder="生成后的 Skill 内容将显示在这里，支持自行修改。"
        />

        <!-- 效果测试 -->
        <div class="sc-test">
          <button class="sc-test-toggle" @click="showTest = !showTest">
            效果测试 {{ showTest ? '▲' : '▼' }}
          </button>
          <div v-if="showTest" class="sc-test-panel">
            <div class="sc-test-type">
              <label><input v-model="testType" type="radio" value="image" /> 图片测试</label>
              <label><input v-model="testType" type="radio" value="video" /> 视频测试</label>
            </div>
            <div class="sc-test-input">
              <input
                v-model="testPrompt"
                placeholder="输入测试提示词，将携带当前 Skill 规范生成"
                @keydown.enter.prevent="runTest"
              />
              <button :disabled="chatStore.isGenerating || !testPrompt.trim()" @click="runTest">
                {{ chatStore.isGenerating ? '生成中…' : '开始测试' }}
              </button>
            </div>
            <div class="sc-test-results">
              <template v-for="msg in testResults" :key="msg.id">
                <img
                  v-if="msg.generateResult?.type === 'image'"
                  :src="msg.generateResult.url"
                  class="sc-test-media"
                />
                <video
                  v-else-if="msg.generateResult?.type === 'video'"
                  :src="msg.generateResult.url"
                  class="sc-test-media"
                  controls
                />
              </template>
              <p v-if="!testResults.length" class="sc-test-empty">测试结果会显示在这里。</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.skill-create {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #0f1115;
  color: #e6e8eb;
}
.sc-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 14px 24px;
  border-bottom: 1px solid #232733;
}
.sc-header h1 {
  font-size: 18px;
  margin: 0;
  flex: 1;
}
.sc-back {
  background: transparent;
  border: 1px solid #2c3140;
  color: #cbd0d8;
  padding: 6px 12px;
  border-radius: 8px;
  cursor: pointer;
}
.sc-model {
  font-size: 13px;
  color: #8a92a3;
}
.sc-templates {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 24px;
  border-bottom: 1px solid #232733;
}
.sc-templates-label {
  font-size: 13px;
  color: #8a92a3;
}
.sc-templates-list {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.sc-template {
  background: #1a1e27;
  border: 1px solid #2c3140;
  color: #cbd0d8;
  padding: 6px 12px;
  border-radius: 20px;
  cursor: pointer;
  font-size: 13px;
}
.sc-template:hover {
  border-color: #4c6ef5;
}
.sc-body {
  flex: 1;
  display: grid;
  grid-template-columns: 380px 1fr;
  min-height: 0;
}
.sc-chat {
  display: flex;
  flex-direction: column;
  border-right: 1px solid #232733;
  min-height: 0;
}
.sc-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}
.sc-empty,
.sc-test-empty {
  color: #6b7280;
  font-size: 13px;
  line-height: 1.6;
}
.sc-msg {
  margin-bottom: 14px;
}
.sc-msg-role {
  font-size: 12px;
  color: #8a92a3;
}
.sc-msg p {
  margin: 4px 0 0;
  padding: 8px 12px;
  border-radius: 8px;
  background: #1a1e27;
  line-height: 1.5;
  white-space: pre-wrap;
}
.sc-msg.user p {
  background: #24304d;
}
.sc-input {
  display: flex;
  gap: 8px;
  padding: 12px;
  border-top: 1px solid #232733;
}
.sc-input textarea {
  flex: 1;
  resize: none;
  height: 56px;
  background: #1a1e27;
  border: 1px solid #2c3140;
  border-radius: 8px;
  color: #e6e8eb;
  padding: 8px 10px;
  font-family: inherit;
}
.sc-send {
  background: #4c6ef5;
  border: none;
  color: #fff;
  border-radius: 8px;
  padding: 0 18px;
  cursor: pointer;
}
.sc-send:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.sc-editor {
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 16px;
}
.sc-editor-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.sc-editor-title {
  font-size: 14px;
  color: #cbd0d8;
}
.sc-editor-actions {
  display: flex;
  gap: 8px;
}
.sc-editor-actions button {
  background: #1a1e27;
  border: 1px solid #2c3140;
  color: #cbd0d8;
  border-radius: 8px;
  padding: 6px 12px;
  cursor: pointer;
  font-size: 13px;
}
.sc-editor-actions button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.sc-md {
  flex: 1;
  min-height: 200px;
  background: #12151c;
  border: 1px solid #2c3140;
  border-radius: 8px;
  color: #e6e8eb;
  padding: 12px;
  font-family: 'SFMono-Regular', Menlo, monospace;
  font-size: 13px;
  line-height: 1.6;
  resize: none;
}
.sc-test {
  margin-top: 12px;
}
.sc-test-toggle {
  background: #1a1e27;
  border: 1px solid #2c3140;
  color: #cbd0d8;
  border-radius: 8px;
  padding: 8px 14px;
  cursor: pointer;
  width: 100%;
  text-align: left;
}
.sc-test-panel {
  border: 1px solid #232733;
  border-top: none;
  border-radius: 0 0 8px 8px;
  padding: 12px;
}
.sc-test-type {
  display: flex;
  gap: 16px;
  margin-bottom: 10px;
  font-size: 13px;
}
.sc-test-input {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
}
.sc-test-input input {
  flex: 1;
  background: #1a1e27;
  border: 1px solid #2c3140;
  border-radius: 8px;
  color: #e6e8eb;
  padding: 8px 10px;
}
.sc-test-input button {
  background: #4c6ef5;
  border: none;
  color: #fff;
  border-radius: 8px;
  padding: 0 16px;
  cursor: pointer;
}
.sc-test-input button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.sc-test-results {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.sc-test-media {
  max-width: 160px;
  max-height: 160px;
  border-radius: 8px;
  border: 1px solid #2c3140;
}
</style>
