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

interface StoredSkillState {
  modelPreference?: ArtSkillsModelPreference
  activeSkill?: ParsedSkill | null
  defaultQualitySkillStates?: Record<string, boolean>
  selectedStyleSkillIds?: string[]
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
 * - activeSkill：用户自行上传/应用的单份 Skill，保持原有能力。
 * - defaultQualitySkillStates：内置质量 Skill 的开关（默认开启）。
 * - selectedStyleSkillIds：生图页多选的风格 Skill。
 */
export const useSkillStore = defineStore('skill', () => {
  const modelPreference = ref<ArtSkillsModelPreference>(ARTSKILLS_AUTO_MODEL)
  const activeSkill = ref<ParsedSkill | null>(null)
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

  /**
   * 生成时实际携带的 Skill 正文，顺序即优先级：
   * 默认质量规范 → 用户多选的风格/手绘 → 自行上传的 Skill。
   * 上传的 Skill 放最后，避免被内置规范冲淡。
   */
  const effectiveSkillContents = computed<string[]>(() => {
    const contents = [
      ...enabledDefaultQualitySkills.value.map((skill) => skill.content),
      ...selectedStyleSkills.value.map((skill) => skill.content),
      activeSkill.value?.content || '',
    ]
    return contents.map((content) => content.trim()).filter(Boolean)
  })

  function loadFromStorage() {
    const saved = localStorage.getItem(SKILL_STORAGE_KEY)
    if (!saved) {
      defaultQualitySkillStates.value = normalizeDefaultStates()
      selectedStyleSkillIds.value = []
      return
    }
    try {
      const parsed = JSON.parse(saved) as StoredSkillState
      modelPreference.value = parsed.modelPreference || ARTSKILLS_AUTO_MODEL
      activeSkill.value = parsed.activeSkill || null
      defaultQualitySkillStates.value = normalizeDefaultStates(parsed.defaultQualitySkillStates)
      selectedStyleSkillIds.value = normalizeSelectedIds(parsed.selectedStyleSkillIds)
    } catch {
      defaultQualitySkillStates.value = normalizeDefaultStates()
      selectedStyleSkillIds.value = []
    }
  }

  function saveToStorage() {
    localStorage.setItem(
      SKILL_STORAGE_KEY,
      JSON.stringify({
        modelPreference: modelPreference.value,
        activeSkill: activeSkill.value,
        defaultQualitySkillStates: defaultQualitySkillStates.value,
        selectedStyleSkillIds: selectedStyleSkillIds.value,
      }),
    )
  }

  function setModelPreference(preference: ArtSkillsModelPreference) {
    modelPreference.value = preference
    saveToStorage()
  }

  /** 直接用一段 skill markdown 文本设为当前应用的 skill。 */
  function setActiveSkillFromContent(content: string, fileName = 'skill.md') {
    activeSkill.value = parseSkillContent(content, fileName)
    saveToStorage()
  }

  /** 使用已解析好的 skill 设为当前应用的 skill。 */
  function setActiveSkill(skill: ParsedSkill | null) {
    activeSkill.value = skill
    saveToStorage()
  }

  function clearActiveSkill() {
    activeSkill.value = null
    saveToStorage()
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

  return {
    modelPreference,
    activeSkill,
    defaultQualitySkillStates,
    selectedStyleSkillIds,
    enabledDefaultQualitySkills,
    selectedStyleSkills,
    effectiveSkillContents,
    loadFromStorage,
    saveToStorage,
    setModelPreference,
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
