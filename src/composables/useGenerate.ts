import { generateImage, generateVideo } from '@/api/aiping'
import { getImageProvider } from '@/api/providers/image'
import { useChatStore } from '@/stores/chatStore'
import type { GenerateResult, GenerateType, UploadedFile } from '@/types/chat'
import { getModelCapability } from '@/types/model'
import type { ModelCapability, ModelIOType } from '@/types/model'
import type { ImageGenerateRequest, ImageGenerateResponse, VideoGenerateRequest, VideoStatusResponse } from '@/types/api'
import { validatePromptOrThrow } from '@/utils/errorHandling'
import { normalizeErrorMessage, showErrorMessage } from '@/utils/errors'
import { aspectRatioToDimensions, aspectRatioToImageSize } from '@/features/generate/aspectRatio'
import { fileToBase64, toRawBase64 } from '@/features/generate/files'
import { pollVideoStatus, setVideoRatio, deleteVideoRatio } from '@/features/generate/video'
import { resolveRealCost } from '@/utils/format'
import { buildEffectivePrompt } from '@/features/skill/apply'

type ImageRequestMode = NonNullable<ModelCapability['imageRequestMode']>
type UploadInput = UploadedFile | UploadedFile[] | null | undefined

function ioTypeToGenerateType(ioType: ModelIOType): GenerateType {
  return ioType === 'text2image' || ioType === 'image2image' ? 'image' : 'video'
}

function getKlingAspectRatio(aspectRatio: string): string {
  if (['16:9', '9:16', '1:1'].includes(aspectRatio)) return aspectRatio
  throw new Error('当前可灵视频模型仅支持 16:9、9:16、1:1，请切换比例或模型后重试。')
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
        delete imageParams.width
        delete imageParams.height
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
  // 可灵声音开关：新协议使用 sound=on/off。
  klingSound: 'on' | 'off' = 'off',
  // 视频分辨率档位（当前仅 MiniMax-H3 使用：768P / 2K）。
  videoResolution: string | null = null
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
        // 声音字段跟随开关：可灵新协议为 on/off。
        videoParams.sound = klingSound
        deleteVideoRatio(videoParams)
      } else {
        // 声音字段跟随开关：可灵新协议为 on/off。
        videoParams.sound = klingSound
        setVideoRatio(videoParams, getKlingAspectRatio(aspectRatio))
      }
      videoParams.model_name = model || undefined
      break
    case 'kling-omni':
      videoParams.model_name = model || undefined
      videoParams.mode = 'pro'
      videoParams.sound = klingSound
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
    case 'minimax-h3': {
      // MiniMax-H3 走 /multimodal/minimax/videos/video_generation，content 数组协议。
      // 首尾帧：start-frame / end-frame；图生视频：单张首帧；多模态参考：multimodal-* 素材归类。
      const startFrameIndex = uploadedFiles.findIndex((file) => file.purpose === 'start-frame')
      const endFrameIndex = uploadedFiles.findIndex((file) => file.purpose === 'end-frame')
      const hasFrameUploads = startFrameIndex >= 0 || endFrameIndex >= 0

      if (hasFrameUploads) {
        if (startFrameIndex >= 0 && uploadValues[startFrameIndex]) {
          videoParams.first_frame_image = uploadValues[startFrameIndex]
        }
        if (endFrameIndex >= 0 && uploadValues[endFrameIndex]) {
          videoParams.last_frame_image = uploadValues[endFrameIndex]
        }
        // 纯尾帧生视频：只传尾帧（role=last_frame），不当作首帧。
        if (endFrameIndex >= 0 && startFrameIndex < 0 && uploadValues[endFrameIndex]) {
          delete videoParams.first_frame_image
        }
      } else if (uploadedFiles.some((file) => file.purpose?.startsWith('multimodal-'))) {
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
      } else if (uploadValue) {
        videoParams.first_frame_image = uploadValue
      }

      videoParams.duration = duration || 5
      videoParams.resolution = videoResolution === '2K' ? '2K' : '768P'
      delete videoParams.seconds
      delete videoParams.size
      delete videoParams.image
      delete videoParams.images
      delete videoParams.img_url
      delete videoParams.image_url
      delete videoParams.image_list
      delete videoParams.video_url
      delete videoParams.video_list
      delete videoParams.subject_reference
      delete videoParams.audio
      delete videoParams.movement_amplitude
      delete videoParams.off_peak
      delete videoParams.seed
      delete videoParams.style
      delete videoParams.payload
      delete videoParams.extra_body
      break
    }
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


const MAX_BATCH_SIZE = 5

function normalizeBatchSize(value: number): number {
  const parsed = Math.round(Number(value))
  return Number.isFinite(parsed) ? Math.min(MAX_BATCH_SIZE, Math.max(1, parsed)) : 1
}

function buildImageResult(
  response: ImageGenerateResponse,
  model: string | null,
  aspectRatio: string,
  capability: ModelCapability | null
): GenerateResult {
  const url = response.data[0]?.url || ''
  if (!url) {
    throw new Error('图片生成完成但未返回有效图片地址，请稍后重试或切换模型。')
  }

  return buildImageResultFromUrl(url, response, model, aspectRatio, capability)
}

function buildImageResultFromUrl(
  url: string,
  response: ImageGenerateResponse,
  model: string | null,
  aspectRatio: string,
  capability: ModelCapability | null
): GenerateResult {
  return {
    type: 'image',
    url,
    model: response.model || model || 'Qwen-Image-2.0-Pro',
    provider: response.provider,
    cost: resolveRealCost(response) / Math.max(response.data.length, 1),
    aspectRatio,
    createdAt: Date.now(),
    size: aspectRatioToDimensions(aspectRatio, capability?.imageRequestMode),
  }
}

function buildVideoResult(
  finalStatus: VideoStatusResponse,
  model: string | null,
  aspectRatio: string
): GenerateResult {
  const videoUrl = finalStatus.video_url || finalStatus.data?.[0]?.url || ''
  if (!videoUrl) {
    throw new Error('视频生成完成但未返回有效视频地址，请稍后重试或切换模型。')
  }

  return {
    type: 'video',
    url: videoUrl,
    model: finalStatus.model || model || '',
    provider: finalStatus.provider,
    cost: resolveRealCost(finalStatus),
    aspectRatio,
    createdAt: Date.now(),
    size: aspectRatioToDimensions(aspectRatio),
    thumbnail: finalStatus.data?.[0]?.thumbnail,
    duration: finalStatus.seconds || finalStatus.data?.[0]?.duration,
  }
}

function describeBatchFailure(successCount: number, total: number, errors: string[]): string | undefined {
  if (!errors.length) return undefined
  return `本轮共 ${total} 个任务，已成功生成 ${successCount} 个；失败原因：${errors.join('；')}`
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
    // 可灵系列是否生成声音：true 对应 sound=on，false 对应 off。
    klingSound = false,
    // Skill 规范：非空时，实际下发给模型的提示词会携带该 skill 规范，
    // 但聊天区仍展示用户输入的原始 prompt。
    skillContent: string | null = null,
    // 视频分辨率档位（MiniMax-H3 使用：768P / 2K，其余模型忽略）。
    videoResolution: string | null = null,
    // 简易模式单轮批量生成数量，限制为 1-5。
    batchSize = 1
  ) {

    validatePromptOrThrow(prompt)

    chatStore.isGenerating = true
    const generateType = ioTypeToGenerateType(ioType)
    const requestedBatchSize = normalizeBatchSize(batchSize)

    chatStore.addMessage({
      type: 'user',
      content: prompt,

      uploadedFile: Array.isArray(uploadedFile) ? uploadedFile[0] : uploadedFile || undefined,
      uploadedFiles: Array.isArray(uploadedFile) ? uploadedFile : undefined,
      aspectRatio,
      model: model || undefined,
      duration,
      batchSize: requestedBatchSize,
    })

    const assistantId = chatStore.addMessage({
      type: 'assistant',
      content: '',
      generateType,
      generateStatus: 'pending',
      batchSize: requestedBatchSize,
      progress: 0,
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

        if (requestedBatchSize === 1) {
          const result = await generateImage(imageParams)
          const imageResult = buildImageResult(result, model, aspectRatio, capability)
          chatStore.updateMessage(assistantId, {
            generateStatus: 'completed',
            generateResult: imageResult,
            generateResults: [imageResult],
            progress: 100,
          })
          return
        }

        const imageResults: GenerateResult[] = []
        const imageErrors: string[] = []

        // Qwen 图片接口支持 OpenAI 风格的 n 参数，单次请求即可返回多张，且比
        // 高并发请求更稳定；Doubao 等其他图片模型会忽略 n，走并发补齐。
        if (getImageProvider(imageParams).provider === 'qwen') {
          try {
            const batchResult = await generateImage({ ...imageParams, n: requestedBatchSize })
            const batchResults = batchResult.data
              .filter((item) => !!item.url)
              .slice(0, requestedBatchSize)
              .map((item) => buildImageResultFromUrl(item.url as string, batchResult, model, aspectRatio, capability))
            imageResults.push(...batchResults)
            if (imageResults.length) {
              chatStore.updateMessage(assistantId, {
                progress: Math.min(99, Math.round((imageResults.length / requestedBatchSize) * 100)),
              })
            }
            if (imageResults.length >= requestedBatchSize) {
              chatStore.updateMessage(assistantId, {
                generateStatus: 'completed',
                generateResult: imageResults[0],
                generateResults: imageResults,
                progress: 100,
              })
              return
            }
          } catch {
            // 批量接口异常时回退到并发请求补齐，错误最终由并发结果汇总。
          }
        }

        const remainingCount = requestedBatchSize - imageResults.length
        if (remainingCount > 0) {
          const imageTasks = Array.from({ length: remainingCount }, async () => {
            const result = await generateImage({ ...imageParams })
            const imageResult = buildImageResult(result, model, aspectRatio, capability)
            imageResults.push(imageResult)
            chatStore.updateMessage(assistantId, {
              progress: Math.min(99, Math.round((imageResults.length / requestedBatchSize) * 100)),
            })
            return imageResult
          })
          const imageSettled = await Promise.allSettled(imageTasks)
          for (const item of imageSettled) {
            if (item.status === 'rejected') {
              imageErrors.push(normalizeErrorMessage(item.reason, '部分图片生成失败'))
            }
          }
        }

        if (!imageResults.length) {
          throw new Error(imageErrors[0] || '批量图片生成失败，请稍后重试。')
        }

        chatStore.updateMessage(assistantId, {
          generateStatus: 'completed',
          generateResult: imageResults[0],
          generateResults: imageResults,
          partialError: describeBatchFailure(imageResults.length, requestedBatchSize, imageErrors),
          progress: 100,
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
        klingSound ? 'on' : 'off',
        videoResolution
      )

      if (requestedBatchSize === 1) {
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
          task.provider,
          task.providerCreateEndpoint,
        )

        const videoResult = buildVideoResult(finalStatus, model, aspectRatio)
        chatStore.updateMessage(assistantId, {
          generateStatus: 'completed',
          generateResult: videoResult,
          generateResults: [videoResult],
          progress: 100,
        })
        return
      }

      const videoTasks: Awaited<ReturnType<typeof generateVideo>>[] = []
      const videoCreateErrors: string[] = []
      const videoCreateSettled = await Promise.allSettled(
        Array.from({ length: requestedBatchSize }, () => generateVideo({ ...videoParams }))
      )
      for (const item of videoCreateSettled) {
        if (item.status === 'rejected') {
          videoCreateErrors.push(normalizeErrorMessage(item.reason, '部分视频任务创建失败'))
          continue
        }
        if (!item.value.id) {
          videoCreateErrors.push('视频任务创建成功但未返回任务 ID。')
          continue
        }
        videoTasks.push(item.value)
      }

      if (!videoTasks.length) {
        throw new Error(videoCreateErrors[0] || '批量视频任务创建失败，请稍后重试。')
      }

      chatStore.updateMessage(assistantId, {
        generateStatus: 'processing',
        progress: Math.max(2, Math.round((videoTasks.length / requestedBatchSize) * 10)),
      })

      const videoTaskProgress = videoTasks.map(() => 0)
      const videoTaskCompleted = videoTasks.map(() => false)
      const videoResults: GenerateResult[] = []
      const videoPollErrors: string[] = []

      const updateVideoBatchProgress = () => {
        const overall = videoTasks.reduce((sum, _task, index) => (
          sum + (videoTaskCompleted[index] ? 100 : Math.max(0, Math.min(100, videoTaskProgress[index])))
        ), 0)
        chatStore.updateMessage(assistantId, {
          progress: Math.min(99, Math.round(overall / videoTasks.length)),
        })
      }

      const videoPollTasks = videoTasks.map(async (task, index) => {
        const finalStatus = await pollVideoStatus(
          task.id,
          (progress) => {
            videoTaskProgress[index] = progress
            updateVideoBatchProgress()
          },
          3000,
          100,
          task.provider,
          task.providerCreateEndpoint,
        )
        videoTaskCompleted[index] = true
        updateVideoBatchProgress()
        const videoResult = buildVideoResult(finalStatus, model, aspectRatio)
        videoResults.push(videoResult)
        return videoResult
      })

      const videoSettled = await Promise.allSettled(videoPollTasks)
      for (const item of videoSettled) {
        if (item.status === 'rejected') {
          videoPollErrors.push(normalizeErrorMessage(item.reason, '部分视频生成失败'))
        }
      }
      const allVideoErrors = [...videoCreateErrors, ...videoPollErrors]
      if (!videoResults.length) {
        throw new Error(allVideoErrors[0] || '批量视频生成失败，请稍后重试。')
      }

      chatStore.updateMessage(assistantId, {
        generateStatus: 'completed',
        generateResult: videoResults[0],
        generateResults: videoResults,
        partialError: describeBatchFailure(videoResults.length, requestedBatchSize, allVideoErrors),
        progress: 100,
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
