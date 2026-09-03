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
  { title: '电影质感剧照', prompt: '帮我创作一个影视风格的 skill，用于生成电影质感的剧照、关键帧和短片镜头。' },
  { title: '短视频带货', prompt: '帮我创作一个短视频带货口播的 skill，输出开场钩子、卖点脚本与分镜。' },
  { title: '产品宣传片', prompt: '帮我创作一个产品宣传片的 skill，强调质感、使用场景与卖点呈现。' },
  { title: '国风插画', prompt: '帮我创作一个国风插画风格的 skill，用于生成角色、场景和装饰性插画。' },
  { title: '品牌视觉 VI', prompt: '帮我创作一个品牌视觉规范 skill，输出标志延展、主视觉、色彩与版式规则。' },
  { title: '3D 卡通角色', prompt: '帮我创作一个 3D 卡通角色设计 skill，生成三视图、表情和动作参考。' },
  { title: '游戏场景概念', prompt: '帮我创作一个游戏场景概念设计 skill，强调世界观、光影、氛围和镜头叙事。' },
  { title: '电商产品主图', prompt: '帮我创作一个电商产品主图 skill，突出卖点、质感、背景和促销构图。' },
  { title: '美食摄影', prompt: '帮我创作一个美食摄影 skill，用于生成高质感菜品、食材和餐桌场景。' },
  { title: '建筑室内空间', prompt: '帮我创作一个室内设计提案 skill，生成空间效果图、材质与灯光方案。' },
  { title: '漫剧分镜', prompt: '帮我创作一个漫剧分镜 skill，输出章节镜头、台词和画面连续性规范。' },
  { title: '儿童绘本', prompt: '帮我创作一个儿童绘本 skill，生成温暖治愈的插画、角色与跨页叙事。' },
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
          <div class="sc-composer">
            <textarea
              v-model="input"
              rows="2"
              placeholder="描述你想要的 skill，例如：帮我创作一个影视风格的 skill"
              @keydown.enter.exact.prevent="send"
            ></textarea>
            <div class="sc-composer-footer">
              <span class="sc-composer-hint">Enter 发送 · Shift + Enter 换行</span>
              <button class="sc-send" :disabled="isGenerating || !input.trim()" @click="send">
                <span>{{ isGenerating ? '生成中…' : '发送' }}</span>
                <span class="sc-send-icon">↑</span>
              </button>
            </div>
          </div>
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
                  loading="lazy"
                  decoding="async"
                />
                <video
                  v-else-if="msg.generateResult?.type === 'video'"
                  :src="msg.generateResult.url"
                  class="sc-test-media"
                  controls
                  preload="metadata"
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
  color: var(--color-text);
  background:
    radial-gradient(circle at 12% 0%, rgba(10, 132, 255, 0.10), transparent 30%),
    radial-gradient(circle at 92% 4%, rgba(0, 0, 0, 0.05), transparent 26%),
    linear-gradient(180deg, #fdfcf8 0%, #f6f4ef 52%, #f2f0eb 100%);
}
.sc-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 14px 24px;
  border-bottom: 1px solid var(--color-border);
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
}
.sc-header h1 {
  font-size: 18px;
  font-weight: 700;
  margin: 0;
  flex: 1;
  letter-spacing: -0.01em;
}
.sc-back {
  background: var(--color-surface-strong);
  border: 1px solid var(--color-border-strong);
  color: var(--color-text);
  padding: 7px 13px;
  border-radius: 12px;
  cursor: pointer;
  box-shadow: var(--color-shadow-soft);
  transition: border-color var(--transition-base), background var(--transition-base), transform var(--transition-base);
}
.sc-back:hover {
  background: #ffffff;
  border-color: rgba(10, 132, 255, 0.38);
  transform: translateY(-1px);
}
.sc-model {
  font-size: 13px;
  color: var(--color-text-secondary);
}
.sc-templates {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 24px;
  border-bottom: 1px solid var(--color-border);
  background: rgba(255, 255, 255, 0.42);
}
.sc-templates-label {
  font-size: 13px;
  color: var(--color-text-hint);
  white-space: nowrap;
}
.sc-templates-list {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.sc-template {
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid var(--color-border-strong);
  color: var(--color-text-secondary);
  padding: 7px 13px;
  border-radius: 999px;
  cursor: pointer;
  font-size: 13px;
  box-shadow: var(--color-shadow-soft);
  transition: border-color var(--transition-base), color var(--transition-base), background var(--transition-base), transform var(--transition-base);
}
.sc-template:hover {
  border-color: rgba(10, 132, 255, 0.40);
  color: var(--color-accent-strong);
  background: #ffffff;
  transform: translateY(-1px);
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
  border-right: 1px solid var(--color-border);
  min-height: 0;
  background: rgba(255, 255, 255, 0.44);
}
.sc-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}
.sc-empty,
.sc-test-empty {
  color: var(--color-text-hint);
  font-size: 13px;
  line-height: 1.6;
}
.sc-msg {
  margin-bottom: 14px;
}
.sc-msg-role {
  font-size: 12px;
  color: var(--color-text-hint);
}
.sc-msg p {
  margin: 4px 0 0;
  padding: 10px 13px;
  border-radius: 14px;
  background: var(--color-surface-strong);
  border: 1px solid var(--color-border);
  color: var(--color-text);
  line-height: 1.5;
  white-space: pre-wrap;
  box-shadow: var(--color-shadow-soft);
}
.sc-msg.user p {
  background: var(--color-user-bubble);
  border-color: transparent;
  color: var(--color-text-inverse);
}
.sc-input {
  padding: 12px 14px 14px;
  border-top: 1px solid var(--color-border);
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
}
.sc-composer {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  background: var(--color-surface-strong);
  border: 1px solid var(--color-border-strong);
  border-radius: 16px;
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.08);
  transition: border-color var(--transition-base), box-shadow var(--transition-base);
}
.sc-composer:focus-within {
  border-color: rgba(10, 132, 255, 0.48);
  box-shadow: 0 0 0 4px var(--color-accent-soft);
}
.sc-composer textarea {
  width: 100%;
  flex: 1;
  resize: none;
  min-height: 58px;
  max-height: 140px;
  background: transparent;
  border: none;
  outline: none;
  color: var(--color-text);
  padding: 2px;
  font-family: inherit;
  font-size: 14px;
  line-height: 1.6;
}
.sc-composer-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.sc-composer-hint {
  font-size: 12px;
  color: var(--color-text-hint);
}
.sc-send {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  background: var(--color-accent);
  border: none;
  color: #fff;
  border-radius: 12px;
  padding: 8px 14px;
  cursor: pointer;
  font-weight: 600;
  box-shadow: 0 10px 24px rgba(77, 101, 255, 0.2);
  transition: background var(--transition-base), transform var(--transition-base), opacity var(--transition-base);
}
.sc-send:hover:not(:disabled) {
  background: var(--color-accent-strong);
  transform: translateY(-1px);
}
.sc-send:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.sc-send-icon {
  display: inline-grid;
  place-items: center;
  width: 20px;
  height: 20px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.2);
  font-size: 14px;
  line-height: 1;
}
.sc-editor {
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 18px;
}
.sc-editor-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.sc-editor-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--color-text);
}
.sc-editor-actions {
  display: flex;
  gap: 8px;
}
.sc-editor-actions button {
  background: var(--color-surface-strong);
  border: 1px solid var(--color-border-strong);
  color: var(--color-text-secondary);
  border-radius: 12px;
  padding: 8px 13px;
  cursor: pointer;
  font-size: 13px;
  box-shadow: var(--color-shadow-soft);
  transition: border-color var(--transition-base), color var(--transition-base), background var(--transition-base), transform var(--transition-base);
}
.sc-editor-actions button:hover:not(:disabled) {
  background: #ffffff;
  border-color: rgba(10, 132, 255, 0.40);
  color: var(--color-accent-strong);
  transform: translateY(-1px);
}
.sc-editor-actions button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.sc-md {
  flex: 1;
  min-height: 200px;
  background: rgba(255, 255, 255, 0.82);
  border: 1px solid var(--color-border-strong);
  border-radius: 14px;
  color: var(--color-text);
  padding: 14px;
  font-family: 'SFMono-Regular', Menlo, monospace;
  font-size: 13px;
  line-height: 1.6;
  resize: none;
  box-shadow: var(--color-shadow-soft);
  transition: border-color var(--transition-base), box-shadow var(--transition-base);
}
.sc-md:focus {
  border-color: rgba(10, 132, 255, 0.48);
  box-shadow: 0 0 0 4px var(--color-accent-soft);
}
.sc-test {
  margin-top: 12px;
}
.sc-test-toggle {
  background: var(--color-surface-strong);
  border: 1px solid var(--color-border-strong);
  color: var(--color-text-secondary);
  border-radius: 12px;
  padding: 10px 14px;
  cursor: pointer;
  width: 100%;
  text-align: left;
  font-weight: 600;
  box-shadow: var(--color-shadow-soft);
  transition: border-color var(--transition-base), color var(--transition-base), background var(--transition-base);
}
.sc-test-toggle:hover {
  background: #ffffff;
  border-color: rgba(10, 132, 255, 0.40);
  color: var(--color-accent-strong);
}
.sc-test-panel {
  border: 1px solid var(--color-border);
  border-top: none;
  border-radius: 0 0 12px 12px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.58);
}
.sc-test-type {
  display: flex;
  gap: 16px;
  margin-bottom: 10px;
  font-size: 13px;
  color: var(--color-text-secondary);
}
.sc-test-type label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}
.sc-test-input {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
}
.sc-test-input input {
  flex: 1;
  background: var(--color-surface-strong);
  border: 1px solid var(--color-border-strong);
  border-radius: 12px;
  color: var(--color-text);
  padding: 9px 11px;
  box-shadow: var(--color-shadow-soft);
  transition: border-color var(--transition-base), box-shadow var(--transition-base);
}
.sc-test-input input:focus {
  border-color: rgba(10, 132, 255, 0.48);
  box-shadow: 0 0 0 4px var(--color-accent-soft);
}
.sc-test-input button {
  background: var(--color-accent);
  border: none;
  color: #fff;
  border-radius: 12px;
  padding: 0 16px;
  cursor: pointer;
  box-shadow: 0 10px 24px rgba(77, 101, 255, 0.2);
  transition: background var(--transition-base), transform var(--transition-base), opacity var(--transition-base);
}
.sc-test-input button:hover:not(:disabled) {
  background: var(--color-accent-strong);
  transform: translateY(-1px);
}
.sc-test-input button:disabled {
  opacity: 0.45;
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
  border-radius: 12px;
  border: 1px solid var(--color-border-strong);
  object-fit: cover;
  background: #fff;
  box-shadow: var(--color-shadow-soft);
}
.sc-composer textarea::placeholder,
.sc-md::placeholder,
.sc-test-input input::placeholder {
  color: var(--color-text-hint);
}

.skill-create {
  --color-text: rgba(255, 255, 255, 0.92);
  --color-text-secondary: rgba(255, 255, 255, 0.68);
  --color-text-hint: rgba(255, 255, 255, 0.46);
  --color-text-inverse: #0a0a0c;
  --color-surface-strong: #1c1f26;
  --color-border: rgba(255, 255, 255, 0.10);
  --color-border-strong: rgba(255, 255, 255, 0.16);
  --color-accent: #3b82f6;
  --color-accent-strong: #8fb0ff;
  --color-accent-soft: rgba(92, 132, 255, 0.14);
  --color-user-bubble: linear-gradient(135deg, #f7f7f2 0%, #d9dce3 100%);
  --color-shadow-soft: 0 14px 40px rgba(0, 0, 0, 0.28);
  color: var(--color-text);
  background:
    radial-gradient(circle at 12% 0%, rgba(92, 132, 255, 0.18), transparent 30%),
    radial-gradient(circle at 92% 4%, rgba(124, 92, 255, 0.14), transparent 26%),
    linear-gradient(180deg, #070707 0%, #0b0d12 52%, #111318 100%);
}

.sc-header,
.sc-input {
  background: rgba(10, 10, 12, 0.82);
}

.sc-templates,
.sc-chat {
  background: rgba(255, 255, 255, 0.04);
}

.sc-back,
.sc-template,
.sc-composer,
.sc-editor-actions button,
.sc-md,
.sc-test-toggle,
.sc-test-panel,
.sc-test-input input {
  background: #1c1f26;
  border-color: #2b3342;
  color: var(--color-text);
  box-shadow: var(--color-shadow-soft);
}

.sc-msg p {
  background: #151923;
  border-color: #2b3342;
}

.sc-back:hover,
.sc-template:hover,
.sc-editor-actions button:hover:not(:disabled),
.sc-test-toggle:hover {
  background: #242b38;
  border-color: rgba(92, 132, 255, 0.48);
  color: var(--color-accent-strong);
}

.sc-send,
.sc-test-input button {
  background: linear-gradient(135deg, #3b82f6 0%, #7c5cff 100%);
  color: #fff;
}

.sc-send:hover:not(:disabled),
.sc-test-input button:hover:not(:disabled) {
  background: linear-gradient(135deg, #5b9cff 0%, #8d76ff 100%);
}

.sc-composer:focus-within,
.sc-md:focus,
.sc-test-input input:focus {
  border-color: rgba(92, 132, 255, 0.58);
  box-shadow: 0 0 0 4px rgba(92, 132, 255, 0.14), var(--color-shadow-soft);
}

.sc-test-media {
  background: #0d1016;
}

@media (max-width: 760px) {
  .sc-body {
    grid-template-columns: 1fr;
    grid-template-rows: 46% 1fr;
  }
  .sc-chat {
    border-right: none;
    border-bottom: 1px solid var(--color-border);
  }
  .sc-templates {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
