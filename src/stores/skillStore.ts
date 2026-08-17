import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  ARTSKILLS_AUTO_MODEL,
  type ArtSkillsModelPreference,
} from '@/features/skill/models'
import { parseSkillContent, type ParsedSkill } from '@/features/skill/parse'

const SKILL_STORAGE_KEY = 'artskills'

/**
 * 全局 Skill 状态：
 * - modelPreference：设置里选择的 Skill 创作模型（auto 随机 / 指定其中之一）。
 * - activeSkill：简易模式下当前应用于生成的 skill（上传或从创作页应用），生成时会携带其规范。
 */
export const useSkillStore = defineStore('skill', () => {
  const modelPreference = ref<ArtSkillsModelPreference>(ARTSKILLS_AUTO_MODEL)
  const activeSkill = ref<ParsedSkill | null>(null)

  function loadFromStorage() {
    const saved = localStorage.getItem(SKILL_STORAGE_KEY)
    if (!saved) return
    try {
      const parsed = JSON.parse(saved) as {
        modelPreference?: ArtSkillsModelPreference
        activeSkill?: ParsedSkill | null
      }
      modelPreference.value = parsed.modelPreference || ARTSKILLS_AUTO_MODEL
      activeSkill.value = parsed.activeSkill || null
    } catch {
      // 忽略解析错误，使用默认值。
    }
  }

  function saveToStorage() {
    localStorage.setItem(
      SKILL_STORAGE_KEY,
      JSON.stringify({
        modelPreference: modelPreference.value,
        activeSkill: activeSkill.value,
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

  return {
    modelPreference,
    activeSkill,
    loadFromStorage,
    saveToStorage,
    setModelPreference,
    setActiveSkill,
    setActiveSkillFromContent,
    clearActiveSkill,
  }
})
