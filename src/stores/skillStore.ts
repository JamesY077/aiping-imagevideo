import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  ARTSKILLS_AUTO_MODEL,
  type ArtSkillsModelPreference,
} from '@/features/skill/models'
import { parseSkillContent, type ParsedSkill } from '@/features/skill/parse'
import {
  DEFAULT_QUALITY_SKILL_IDS,
  getBuiltinSkill,
} from '@/features/skill/builtin'

const SKILL_STORAGE_KEY = 'artskills'

/** 同时生效的上传 Skill 上限。 */
export const MAX_ACTIVE_SKILLS = 3

interface StoredSkillState {
  modelPreference?: ArtSkillsModelPreference
  /** 旧版本的单份上传 Skill，读取时迁移进 activeSkills。 */
  activeSkill?: ParsedSkill | null
  activeSkills?: ParsedSkill[]
  defaultQualitySkillStates?: Record<string, boolean>
  selectedStyleSkillIds?: string[]
}

/** 过滤空内容并按上限截断，避免旧缓存带入无效条目。 */
function normalizeActiveSkills(input?: ParsedSkill[] | null): ParsedSkill[] {
  if (!Array.isArray(input)) return []
  const seen = new Set<string>()
  const result: ParsedSkill[] = []
  for (const skill of input) {
    if (!skill || typeof skill.content !== 'string' || !skill.content.trim()) continue
    const key = (skill.name || '').trim().toLowerCase()
    if (key && seen.has(key)) continue
    if (key) seen.add(key)
    result.push(skill)
    if (result.length >= MAX_ACTIVE_SKILLS) break
  }
  return result
}

/** 三个默认质量 Skill 默认全部开启；缺失的键回落到开启。 */
function normalizeDefaultStates(input?: Record<string, boolean>): Record<string, boolean> {
  const result: Record<string, boolean> = {}
  for (const id of DEFAULT_QUALITY_SKILL_IDS) {
    result[id] = input?.[id] !== false
  }
  return result
}

/** 过滤掉已下线或不存在的内置 Skill id，避免旧缓存带到新版本。 */
function normalizeSelectedIds(input?: string[]): string[] {
  if (!Array.isArray(input)) return []
  const seen = new Set<string>()
  const result: string[] = []
  for (const id of input) {
    if (typeof id !== 'string' || seen.has(id)) continue
    const skill = getBuiltinSkill(id)
    if (!skill || skill.category === 'quality') continue
    seen.add(id)
    result.push(id)
  }
  return result
}

/**
 * 全局 Skill 状态：
 * - modelPreference：设置里选择的 Skill 创作模型。
 * - activeSkills：用户自行上传/应用的 Skill（最多 3 份）。
 * - defaultQualitySkillStates：内置质量 Skill 的开关（默认开启）。
 * - selectedStyleSkillIds：生图页多选的风格 Skill。
 */
export const useSkillStore = defineStore('skill', () => {
  const modelPreference = ref<ArtSkillsModelPreference>(ARTSKILLS_AUTO_MODEL)
  const activeSkills = ref<ParsedSkill[]>([])
  /** 兼容旧调用：第一份上传 Skill。 */
  const activeSkill = computed(() => activeSkills.value[0] || null)
  const defaultQualitySkillStates = ref<Record<string, boolean>>(normalizeDefaultStates())
  const selectedStyleSkillIds = ref<string[]>([])

  const enabledDefaultQualitySkills = computed(() =>
    DEFAULT_QUALITY_SKILL_IDS.filter((id) => defaultQualitySkillStates.value[id] !== false)
      .map((id) => getBuiltinSkill(id))
      .filter((skill): skill is NonNullable<typeof skill> => Boolean(skill)),
  )

  const selectedStyleSkills = computed(() =>
    selectedStyleSkillIds.value
      .map((id) => getBuiltinSkill(id))
      .filter((skill): skill is NonNullable<typeof skill> => Boolean(skill)),
  )

  /** 仅上传 Skill 的正文。 */
  const activeSkillContents = computed<string[]>(() =>
    activeSkills.value.map((skill) => skill.content.trim()).filter(Boolean),
  )

  /**
   * 视频生成实际携带的 Skill 正文：风格 + 上传 Skill。
   * 视频不套用图片的默认质量规范（impeccable / hallmark / editable-design）。
   */
  const videoSkillContents = computed<string[]>(() => {
    const contents = [
      ...selectedStyleSkills.value.map((skill) => skill.content),
      ...activeSkills.value.map((skill) => skill.content),
    ]
    return contents.map((content) => content.trim()).filter(Boolean)
  })

  /**
   * 生成时实际携带的 Skill 正文，顺序即优先级：
   * 默认质量规范 → 用户多选的风格/手绘 → 自行上传的 Skill。
   * 上传的 Skill 放最后，避免被内置规范冲淡。
   */
  const effectiveSkillContents = computed<string[]>(() => {
    const contents = [
      ...enabledDefaultQualitySkills.value.map((skill) => skill.content),
      ...selectedStyleSkills.value.map((skill) => skill.content),
      ...activeSkills.value.map((skill) => skill.content),
    ]
    return contents.map((content) => content.trim()).filter(Boolean)
  })

  function loadFromStorage() {
    if (typeof localStorage === 'undefined') return
    const saved = localStorage.getItem(SKILL_STORAGE_KEY)
    if (!saved) {
      defaultQualitySkillStates.value = normalizeDefaultStates()
      selectedStyleSkillIds.value = []
      return
    }
    try {
      const parsed = JSON.parse(saved) as StoredSkillState
      modelPreference.value = parsed.modelPreference || ARTSKILLS_AUTO_MODEL
      // 优先新字段；旧版本只有 activeSkill，读入后自动迁移成单元素数组。
      const storedSkills = Array.isArray(parsed.activeSkills) && parsed.activeSkills.length
        ? parsed.activeSkills
        : parsed.activeSkill ? [parsed.activeSkill] : []
      activeSkills.value = normalizeActiveSkills(storedSkills)
      defaultQualitySkillStates.value = normalizeDefaultStates(parsed.defaultQualitySkillStates)
      selectedStyleSkillIds.value = normalizeSelectedIds(parsed.selectedStyleSkillIds)
    } catch {
      activeSkills.value = []
      defaultQualitySkillStates.value = normalizeDefaultStates()
      selectedStyleSkillIds.value = []
    }
  }

  function saveToStorage() {
    try {
      localStorage.setItem(
        SKILL_STORAGE_KEY,
        JSON.stringify({
          modelPreference: modelPreference.value,
          activeSkills: activeSkills.value,
          defaultQualitySkillStates: defaultQualitySkillStates.value,
          selectedStyleSkillIds: selectedStyleSkillIds.value,
        }),
      )
    } catch (error) {
      // localStorage 配额有限，超大 Skill 写入失败时至少不要中断上传流程。
      console.warn('Skill 状态保存失败，可能是上传文件过大。', error)
    }
  }

  function setModelPreference(preference: ArtSkillsModelPreference) {
    modelPreference.value = preference
    saveToStorage()
  }

  /** 新增一份上传 Skill；超过上限或重名时返回 false。 */
  function addActiveSkill(skill: ParsedSkill): boolean {
    if (!skill?.content?.trim()) return false
    if (activeSkills.value.length >= MAX_ACTIVE_SKILLS) return false
    const key = (skill.name || '').trim().toLowerCase()
    if (key && activeSkills.value.some((item) => (item.name || '').trim().toLowerCase() === key)) {
      return false
    }
    activeSkills.value = [...activeSkills.value, skill]
    saveToStorage()
    return true
  }

  /** 直接用一段 skill markdown 文本新增一份上传 Skill。 */
  function addActiveSkillFromContent(content: string, fileName = 'skill.md') {
    return addActiveSkill(parseSkillContent(content, fileName))
  }

  /** 移除指定位置的上传 Skill。 */
  function removeActiveSkill(index: number) {
    if (index < 0 || index >= activeSkills.value.length) return
    activeSkills.value = activeSkills.value.filter((_, i) => i !== index)
    saveToStorage()
  }

  function clearActiveSkills() {
    activeSkills.value = []
    saveToStorage()
  }

  /** 兼容旧调用：设成唯一一份上传 Skill（传 null 清空）。 */
  function setActiveSkill(skill: ParsedSkill | null) {
    activeSkills.value = skill ? normalizeActiveSkills([skill]) : []
    saveToStorage()
  }

  /** 兼容旧调用：用一段文本覆盖全部上传 Skill。 */
  function setActiveSkillFromContent(content: string, fileName = 'skill.md') {
    setActiveSkill(parseSkillContent(content, fileName))
  }

  /** 兼容旧调用：清空全部上传 Skill。 */
  function clearActiveSkill() {
    clearActiveSkills()
  }

  /** 设置页：开启/关闭某个默认质量 Skill。 */
  function setDefaultQualitySkillEnabled(id: string, enabled: boolean) {
    if (!DEFAULT_QUALITY_SKILL_IDS.includes(id)) return
    defaultQualitySkillStates.value = {
      ...defaultQualitySkillStates.value,
      [id]: enabled,
    }
    saveToStorage()
  }

  function isDefaultQualitySkillEnabled(id: string): boolean {
    return defaultQualitySkillStates.value[id] !== false
  }

  /** 一键恢复三个默认质量 Skill。 */
  function enableAllDefaultQualitySkills() {
    defaultQualitySkillStates.value = normalizeDefaultStates(
      Object.fromEntries(DEFAULT_QUALITY_SKILL_IDS.map((id) => [id, true])),
    )
    saveToStorage()
  }

  /** 生图页：多选切换一个内置风格 Skill。 */
  function toggleStyleSkill(id: string) {
    const skill = getBuiltinSkill(id)
    if (!skill || skill.category === 'quality') return
    const current = selectedStyleSkillIds.value
    selectedStyleSkillIds.value = current.includes(id)
      ? current.filter((item) => item !== id)
      : [...current, id]
    saveToStorage()
  }

  function clearStyleSkills() {
    selectedStyleSkillIds.value = []
    saveToStorage()
  }

  // 任意页面首次使用 Skill 状态时立即恢复持久化内容。
  // /skill、/settings 等页面没有显式调用 loadFromStorage，若此时直接 saveToStorage，
  // 会把已选风格与已上传 Skill 覆盖成空，表现为「上传后无法和已有 Skill 一起选」。
  loadFromStorage()

  return {
    modelPreference,
    activeSkill,
    activeSkills,
    defaultQualitySkillStates,
    selectedStyleSkillIds,
    enabledDefaultQualitySkills,
    selectedStyleSkills,
    activeSkillContents,
    effectiveSkillContents,
    videoSkillContents,
    loadFromStorage,
    saveToStorage,
    setModelPreference,
    addActiveSkill,
    addActiveSkillFromContent,
    removeActiveSkill,
    clearActiveSkills,
    setActiveSkill,
    setActiveSkillFromContent,
    clearActiveSkill,
    setDefaultQualitySkillEnabled,
    isDefaultQualitySkillEnabled,
    enableAllDefaultQualitySkills,
    toggleStyleSkill,
    clearStyleSkills,
  }
})
