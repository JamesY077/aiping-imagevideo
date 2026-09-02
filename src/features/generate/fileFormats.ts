/**
 * 本地上传文件格式限制（图片 / 视频）
 * ------------------------------------------------------------------
 * 与 server/upload-service 支持的格式保持一致，统一收紧为常见格式：
 * - 文件选择器用 accept 属性做第一道过滤；
 * - 选择完成后用本模块做硬校验兜底（防止拖动、改名等方式绕过）。
 * 避免 HEIC、OPUS、MKV 等罕见格式传到上游导致 400 报错。
 * ------------------------------------------------------------------
 */

const SUPPORTED_IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'] as const
const SUPPORTED_VIDEO_EXTENSIONS = ['mp4', 'mov', 'webm', 'm4v'] as const

const SUPPORTED_IMAGE_MIMES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif', 'image/bmp']
const SUPPORTED_VIDEO_MIMES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v']

/** input[type=file] 的 accept 属性值：常见图片格式。 */
export const IMAGE_FILE_ACCEPT = [
  '.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp',
  ...SUPPORTED_IMAGE_MIMES,
].join(',')

/** input[type=file] 的 accept 属性值：常见视频格式。 */
export const VIDEO_FILE_ACCEPT = [
  '.mp4', '.mov', '.webm', '.m4v',
  ...SUPPORTED_VIDEO_MIMES,
].join(',')

/** UI 小字里展示的图片格式说明。 */
export const IMAGE_FORMAT_HINT = 'PNG / JPG / JPEG / WebP / GIF / BMP'

/** UI 小字里展示的视频格式说明。 */
export const VIDEO_FORMAT_HINT = 'MP4 / MOV / WebM / M4V'

export type UploadFileKind = 'image' | 'video'

/** 判断文件是否为受支持的常见格式，返回其类别；不支持的格式返回 null。 */
export function classifySupportedFile(file: File): UploadFileKind | null {
  const extension = (file.name.split('.').pop() || '').toLowerCase()
  const mime = (file.type || '').toLowerCase()

  if (
    (SUPPORTED_IMAGE_EXTENSIONS as readonly string[]).includes(extension) ||
    SUPPORTED_IMAGE_MIMES.includes(mime)
  ) {
    return 'image'
  }

  if (
    (SUPPORTED_VIDEO_EXTENSIONS as readonly string[]).includes(extension) ||
    SUPPORTED_VIDEO_MIMES.includes(mime)
  ) {
    return 'video'
  }

  return null
}

/** 校验文件是否为指定类别的常见格式；合法返回 null，否则返回错误提示文案。 */
export function validateUploadFileKind(file: File, kind: UploadFileKind): string | null {
  if (classifySupportedFile(file) === kind) return null
  return kind === 'image'
    ? `仅支持常见图片格式（${IMAGE_FORMAT_HINT}）`
    : `仅支持常见视频格式（${VIDEO_FORMAT_HINT}）`
}
