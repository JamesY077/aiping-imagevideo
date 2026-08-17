import { generateImage, generateVideo, getModels, polishPrompt } from '@/api/aiping'
import { useChatStore } from '@/stores/chatStore'
import { useSettingsStore } from '@/stores/settingsStore'
import type { GenerateType, UploadedFile } from '@/types/chat'
import { getModelCapability } from '@/types/model'
import type { ModelCapability, ModelIOType } from '@/types/model'
import type { ImageGenerateRequest, VideoGenerateRequest } from '@/types/api'
import { validatePromptOrThrow } from '@/utils/errorHandling'
import { normalizeErrorMessage, showErrorMessage } from '@/utils/errors'
import { aspectRatioToDimensions, aspectRatioToImageSize } from '@/features/generate/aspectRatio'
import { fileToBase64, toRawBase64 } from '@/features/generate/files'
import { pollVideoStatus, setVideoRatio, deleteVideoRatio } from '@/features/generate/video'
import { resolveRealCost } from '@/utils/format'

type ImageRequestMode = NonNullable<ModelCapability['imageRequestMode']>
type UploadInput = UploadedFile | UploadedFile[] | null | undefined

function ioTypeToGenerateType(ioType: ModelIOType): GenerateType {
  return ioType === 'text2image' || ioType === 'image2image' ? 'image' : 'video'
}

function getKlingAspectRatio(aspectRatio: string): string {
  if (['16:9', '9:16', '1:1'].includes(aspectRatio)) return aspectRatio
  throw new Error('当前可灵视频模型仅支持 16:9、9:16、1:1，请切换比例或模型后重试。')
}

const SKILL_COMPRESSION_SYSTEM_PROMPT = `你是一名专业的视频/图像 Skill 压缩助手。
请把用户提供的 Skill 规范压缩成 500 字左右的中文视觉创作规范，只保留会直接影响画面生成的关键约束，例如：主体、场景、画风、色调、构图、镜头、运镜、节奏、动作、服装、光影、声音氛围等。
删除 YAML 元信息、标题、说明文字、示例代码、流程步骤、角色背景故事等对画面生成没有直接帮助的内容。
只输出压缩后的规范正文，不要解释，不要使用 Markdown 标记，不要输出代码块。`

const SKILL_COMPRESSION_MAX_CHARS = 500

function cleanCompressedSkill(content: string): string {
  let result = content.trim()
  result = result.replace(/^```[a-zA-Z]*\s*|\s*```$/g, '').trim()
  if (result.length > SKILL_COMPRESSION_MAX_CHARS) {
    result = result.slice(0, SKILL_COMPRESSION_MAX_CHARS)
  }
  return result
}

/** 压缩失败时的兜底：去掉 YAML 头部并截断，避免一次失败就让生成完全中断。 */
function fallbackCompressSkill(skillContent: string): string {
  const body = skillContent
    .replace(/^\uFEFF?---\s*\n[\s\S]*?\n---\s*(\n|$)/, '')
    .trim()
  return cleanCompressedSkill(body)
}

async function resolveSkillCompressionModel(): Promise<string> {
  const settingsStore = useSettingsStore()
  const configured = settingsStore.promptPolishModel.trim()
  if (configured) return configured

  const models = await getModels()
  const candidates = Array.isArray(models?.data) ? models.data : []
  const preferredIds = ['DeepSeek-V3-0324', 'Qwen3-32B', 'Qwen3-14B', 'DeepSeek-V3']
  const preferred = candidates.find((model) => preferredIds.includes(model.id))
  const firstLlm = candidates.find((model) => {
    const modelType = (model as any).model_type
    return modelType === 'llm' || (Array.isArray(modelType) && modelType.includes('llm'))
  })
  const fallback = preferred || firstLlm
  if (!fallback?.id) {
    throw new Error('当前 API Key 没有可用的文本模型，无法压缩 Skill。请先在设置中配置 AI 润色模型。')
  }
  return fallback.id
}

async function compressSkillContent(skillContent: string): Promise<string> {
  const model = await resolveSkillCompressionModel()
  const compressed = await polishPrompt({
    model,
    messages: [
      { role: 'system', content: SKILL_COMPRESSION_SYSTEM_PROMPT },
      { role: 'user', content: `请压缩以下 Skill：\n\n${skillContent}` },
    ],
    temperature: 0.2,
  })
  return cleanCompressedSkill(compressed)
}

/** 有 Skill 时先压缩，再把压缩结果和用户提示词合并；无 Skill 时原样返回。 */
async function buildEffectivePrompt(prompt: string, skillContent: string | null | undefined): Promise<string> {
  if (!skillContent || !skillContent.trim()) return prompt

  let skillSummary: string
  try {
    skillSummary = await compressSkillContent(skillContent)
  } catch (error) {
    console.warn('Skill 压缩失败，使用截断后的原始 Skill 作为兜底。', error)
    skillSummary = fallbackCompressSkill(skillContent)
  }

  return `请严格遵循以下 Skill 创作规范：\n${skillSummary}\n\n用户创作需求：\n${prompt}`
}

function buildImageParams(
  prompt: string,
  model: string | null,
  uploadedFile: UploadInput,
  aspectRatio: string,
  mode: ImageRequestMode | undefined
): Promise<ImageGenerateRequest> | ImageGenerateRequest {
  const build = async () => {
    const primaryFile = Array.isArray(uploadedFile) ? uploadedFile[0] : uploadedFile
    let imageInput = primaryFile?.url
    if (primaryFile?.file) {
      imageInput = await fileToBase64(primaryFile.file)
    }

    const imageParams: ImageGenerateRequest = {
      prompt,
      model: model || undefined,
      image: imageInput,
      size: aspectRatioToImageSize(aspectRatio),
    }

    if (mode && mode !== 'default') {
      const { width, height } = aspectRatioToDimensions(aspectRatio, mode)
      imageParams.output_format = 'png'
      imageParams.watermark = false

      if (mode === 'seedream-5-lite') {
        imageParams.size = aspectRatioToImageSize(aspectRatio, mode, 'x')
      } else {
        imageParams.size = undefined
        imageParams.width = width
        imageParams.height = height
      }

    }

    return imageParams
  }

  return build()
}

async function buildVideoParams(
  prompt: string,
  model: string | null,
  uploadedFile: UploadInput,
  aspectRatio: string,
  duration: number,
  videoRequestMode: ModelCapability['videoRequestMode'],
  // Kling 系列「是否生成声音」：native 生成带声音的视频，off 无声音（默认）。
  klingAudio: 'native' | 'off' = 'off'
): Promise<VideoGenerateRequest> {

  const uploadedFiles = (Array.isArray(uploadedFile) ? uploadedFile : uploadedFile ? [uploadedFile] : [])
  const uploadValues = await Promise.all(
    uploadedFiles.map(async (file) => (file.file ? fileToBase64(file.file) : file.url))
  )
  const primaryFile = uploadedFiles[0]
  const uploadValue = uploadValues[0]

  const videoParams: VideoGenerateRequest = {
    prompt,
    model: model || undefined,
    duration,
    resolution: '1080p',
  }
  setVideoRatio(videoParams, aspectRatio)

  switch (videoRequestMode) {
    case 'kling-v26':
    case 'kling-v3':
      if (uploadedFiles.some((file) => file.purpose?.startsWith('motion-control'))) {
        const referenceImageIndex = uploadedFiles.findIndex((file) => file.purpose === 'motion-control-image' || file.type === 'image')
        const referenceVideoIndex = uploadedFiles.findIndex((file) => file.purpose === 'motion-control-video' || file.type === 'video')
        const referenceImage = referenceImageIndex >= 0 ? uploadValues[referenceImageIndex] : undefined
        const referenceVideo = referenceVideoIndex >= 0 ? uploadValues[referenceVideoIndex] : undefined
        const motionControlOptions = uploadedFiles.find((file) => file.motionControlOptions)?.motionControlOptions

        if (!referenceImage || !referenceVideo) {
          throw new Error('动作控制需要同时上传参考图像和参考视频。')
        }

        videoParams.motion_control = true
        videoParams.image_url = referenceImage
        videoParams.video_url = referenceVideo
        videoParams.keep_original_sound = motionControlOptions?.keep_original_sound || 'yes'
        videoParams.character_orientation = motionControlOptions?.character_orientation || 'image'
        videoParams.mode = 'pro'
        videoParams.model_name = model || undefined
        delete videoParams.image
        delete videoParams.img_url
        deleteVideoRatio(videoParams)
        delete videoParams.resolution
        delete videoParams.duration
        break
      }

      if (uploadValue) {
        videoParams.image = uploadValue
        // 声音字段跟随开关：开启则 on，否则 off（与 audio=native/off 保持一致）。
        videoParams.sound = klingAudio === 'native' ? 'on' : 'off'
        deleteVideoRatio(videoParams)
      } else {
        // 声音字段跟随开关：开启则 on，否则 off（与 audio=native/off 保持一致）。
        videoParams.sound = klingAudio === 'native' ? 'on' : 'off'
        setVideoRatio(videoParams, getKlingAspectRatio(aspectRatio))
      }
      videoParams.model_name = model || undefined
      // Kling 系列「是否生成声音」：native 生成带声音的视频，off 无声音（默认）。
      videoParams.klingAudio = klingAudio
      break
    case 'kling-omni':
      videoParams.model_name = model || undefined
      videoParams.mode = 'pro'
      setVideoRatio(videoParams, getKlingAspectRatio(aspectRatio))
      if (uploadValues.length >= 2) {
        videoParams.image_list = [
          { image_url: uploadValues[0], type: 'first_frame' },
          { image_url: uploadValues[1], type: 'end_frame' },
        ]
      } else if (uploadValues.length) {
        videoParams.images = uploadValues
      }
      delete videoParams.resolution
      // Kling 系列「是否生成声音」：native 生成带声音的视频，off 无声音（默认）。
      videoParams.klingAudio = klingAudio
      break

    case 'kling-o1':
      if (primaryFile?.type === 'image' && uploadValue) {
        videoParams.first_frame_url = primaryFile.file ? toRawBase64(uploadValue) : uploadValue
        deleteVideoRatio(videoParams)
      } else if (primaryFile?.type === 'video' && primaryFile.url) {
        videoParams.video_list = [primaryFile.url]
        deleteVideoRatio(videoParams)
      } else {
        setVideoRatio(videoParams, getKlingAspectRatio(aspectRatio))
      }
      break
    case 'viduq3-fast':
      if (uploadValues.length) {
        videoParams.images = uploadValues.slice(0, 2)
        videoParams.resolution = '1080p'
        videoParams.movement_amplitude = 'auto'
      } else {
        videoParams.aspect_ratio = aspectRatio || '4:3'
        videoParams.resolution = '1080p'
        videoParams.style = 'general'
        videoParams.movement_amplitude = 'auto'
      }
      delete videoParams.image
      delete videoParams.img_url
      delete videoParams.first_frame_url
      delete videoParams.last_frame_url
      delete videoParams.reference_images
      delete videoParams.video_list
      delete videoParams.ratio
      delete videoParams.size
      delete videoParams.audio
      delete videoParams.off_peak
      delete videoParams.watermark
      delete videoParams.extra_body
      break
    case 'minimax-hailuo':
      if (uploadValues.length >= 2) {
        videoParams.first_frame_image = uploadValues[0]
        videoParams.last_frame_image = uploadValues[1]
      } else if (uploadValue) {
        if (primaryFile?.type === 'image' && primaryFile?.name === 'Subject Reference') {
          videoParams.subject_reference = [
            {
              type: 'character',
              image: [uploadValue],
            },
          ]
        } else {
          videoParams.first_frame_image = uploadValue
        }
      }
      if (!videoParams.subject_reference) {
        videoParams.duration = duration || 6
        videoParams.resolution = '1080P'
      }
      deleteVideoRatio(videoParams)
      delete videoParams.seconds
      delete videoParams.size
      delete videoParams.image
      delete videoParams.images
      delete videoParams.img_url
      delete videoParams.first_frame_url
      delete videoParams.last_frame_url
      delete videoParams.reference_images
      delete videoParams.video_list
      delete videoParams.audio
      delete videoParams.movement_amplitude
      delete videoParams.off_peak
      delete videoParams.watermark
      delete videoParams.seed
      delete videoParams.style
      delete videoParams.payload
      delete videoParams.extra_body
      break
    case 'seedance-2': {
      // Seedance 2.0 走「素材 + contents/generations/tasks」接口。
      // 参考素材按类型分别放入 reference_images / reference_videos / reference_audios，
      // 由 aiping.ts 逐类生成素材（asset://）后组装 content 数组。
      const referenceImages: string[] = []
      const referenceVideos: string[] = []
      const referenceAudios: string[] = []
      uploadedFiles.forEach((file, index) => {
        const value = uploadValues[index]
        if (!value) return
        if (file.purpose === 'multimodal-video' || file.type === 'video') {
          referenceVideos.push(value)
        } else if (file.purpose === 'multimodal-audio' || file.type === 'audio') {
          referenceAudios.push(value)
        } else {
          referenceImages.push(value)
        }
      })
      if (referenceImages.length) videoParams.reference_images = referenceImages
      if (referenceVideos.length) videoParams.reference_videos = referenceVideos
      if (referenceAudios.length) videoParams.reference_audios = referenceAudios
      videoParams.duration = duration || 5
      videoParams.audio = true
      videoParams.watermark = false
      deleteVideoRatio(videoParams)
      videoParams.aspect_ratio = aspectRatio || '16:9'
      delete videoParams.image
      delete videoParams.img_url
      delete videoParams.images
      delete videoParams.first_frame_url
      delete videoParams.last_frame_url
      delete videoParams.resolution
      delete videoParams.movement_amplitude
      delete videoParams.off_peak
      delete videoParams.seed
      delete videoParams.style
      delete videoParams.payload
      delete videoParams.extra_body
      break
    }

    default:
      if (uploadValue) videoParams.img_url = uploadValue
      break
  }

  return videoParams
}


export function useGenerate() {
  const chatStore = useChatStore()

  async function generate(
    prompt: string,
    ioType: ModelIOType,
    model: string | null,
    uploadedFile?: UploadInput,
    aspectRatio = '1:1',
    duration = 6,
    // Kling 系列「是否生成声音」：true 生成带声音的视频（audio=native），false 无声音（默认）。
    klingSound = false,
    // Skill 规范：非空时，实际下发给模型的提示词会携带该 skill 规范，
    // 但聊天区仍展示用户输入的原始 prompt。
    skillContent: string | null = null
  ) {

    validatePromptOrThrow(prompt)

    chatStore.isGenerating = true
    const generateType = ioTypeToGenerateType(ioType)

    chatStore.addMessage({
      type: 'user',
      content: prompt,

      uploadedFile: Array.isArray(uploadedFile) ? uploadedFile[0] : uploadedFile || undefined,
      uploadedFiles: Array.isArray(uploadedFile) ? uploadedFile : undefined,
      aspectRatio,
      model: model || undefined,
      duration,
    })

    const assistantId = chatStore.addMessage({
      type: 'assistant',
      content: '',
      generateType,
      generateStatus: 'pending',
    })

    try {
      // 有 Skill 时先把规范压缩成 400-500 字，再拼接用户提示词下发。
      const effectivePrompt = await buildEffectivePrompt(prompt, skillContent)
      const capability = getModelCapability(model)

      if (generateType === 'image') {
        const imageParams = await buildImageParams(
          effectivePrompt,
          model,
          uploadedFile,
          aspectRatio,
          capability?.imageRequestMode
        )


        const result = await generateImage(imageParams)
        const url = result.data[0]?.url || ''
        if (!url) {
          throw new Error('图片生成完成但未返回有效图片地址，请稍后重试或切换模型。')
        }
        chatStore.updateMessage(assistantId, {
          generateStatus: 'completed',
          generateResult: {
            type: 'image',
            url,
            model: result.model || model || 'Qwen-Image-2.0-Pro',
            provider: result.provider,
            cost: resolveRealCost(result),
            aspectRatio,
            createdAt: Date.now(),
            size: aspectRatioToDimensions(aspectRatio, capability?.imageRequestMode),
          },
        })
        return
      }

      const videoParams = await buildVideoParams(
        effectivePrompt,
        model,
        uploadedFile,
        aspectRatio,
        duration,

        capability?.videoRequestMode,
        // Kling 系列「是否生成声音」：开启则 audio=native，否则 off（默认）。
        klingSound ? 'native' : 'off'
      )


      const task = await generateVideo(videoParams)
      if (!task.id) {
        throw new Error('视频任务创建成功但未返回任务 ID，请稍后重试或切换模型。')
      }
      chatStore.updateMessage(assistantId, { generateStatus: 'processing' })

      const finalStatus = await pollVideoStatus(
        task.id,
        (progress) => {
          chatStore.updateMessage(assistantId, { progress })
        },
        3000,
        100,
        task.provider
      )

      const videoUrl = finalStatus.video_url || finalStatus.data?.[0]?.url || ''
      if (!videoUrl) {
        throw new Error('视频生成完成但未返回有效视频地址，请稍后重试或切换模型。')
      }
      chatStore.updateMessage(assistantId, {
        generateStatus: 'completed',
        generateResult: {
          type: 'video',
          url: videoUrl,
          model: finalStatus.model,
          provider: finalStatus.provider,
          cost: resolveRealCost(finalStatus),
          aspectRatio,
          createdAt: Date.now(),
          size: aspectRatioToDimensions(aspectRatio),
          thumbnail: finalStatus.data?.[0]?.thumbnail,
          duration: finalStatus.seconds || finalStatus.data?.[0]?.duration,
        },
      })
    } catch (e: unknown) {
      const isTimeout = e instanceof Error && (e.message.includes('timeout') || e.message.includes('超时'))
      const errorMessage = isTimeout ? '生成超时，请更换模型或重试' : normalizeErrorMessage(e, '生成失败，请重试')
      chatStore.updateMessage(assistantId, {
        generateStatus: 'failed',
        error: errorMessage,
      })
      showErrorMessage(errorMessage, '生成失败，请重试')
    } finally {
      chatStore.isGenerating = false
    }
  }

  return { generate }
}
