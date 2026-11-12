/**
 * GIF 编码线程：主线程负责用 WebGL 渲染 + 合背景，把每帧 RGBA 传进来，
 * 这里做调色板量化并写进 GIF 流。放在 Worker 里是因为量化几十帧会阻塞主线程。
 *
 * 这里不引 `lib.webworker`（会和项目里的 DOM 类型冲突），只用最小作用域接口。
 */
import { GIFEncoder, applyPalette, quantize, type GifEncoder } from 'gifenc'

type InboundMessage =
  | { type: 'start'; width: number; height: number; delay: number }
  | { type: 'frame'; buffer: ArrayBuffer }
  | { type: 'finish' }

type OutboundMessage =
  | { type: 'progress'; index: number }
  | { type: 'done'; buffer: ArrayBuffer }
  | { type: 'error'; message: string }

interface WorkerScope {
  onmessage: ((event: MessageEvent<InboundMessage>) => void) | null
  postMessage(message: OutboundMessage, transfer?: Transferable[]): void
}

const scope = self as unknown as WorkerScope

let encoder: GifEncoder | null = null
let width = 0
let height = 0
let delay = 0
let frameIndex = 0

scope.onmessage = (event) => {
  const message = event.data
  try {
    if (message.type === 'start') {
      width = message.width
      height = message.height
      delay = message.delay
      frameIndex = 0
      encoder = GIFEncoder()
      return
    }

    if (message.type === 'frame') {
      if (!encoder) throw new Error('编码器尚未初始化')
      const rgba = new Uint8Array(message.buffer)
      const palette = quantize(rgba, 256, { format: 'rgb565' })
      const pixels = applyPalette(rgba, palette, 'rgb565')
      encoder.writeFrame(pixels, width, height, { palette, delay })
      frameIndex += 1
      scope.postMessage({ type: 'progress', index: frameIndex })
      return
    }

    if (message.type === 'finish') {
      if (!encoder) throw new Error('编码器尚未初始化')
      encoder.finish()
      const bytes = encoder.bytes()
      const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
      scope.postMessage({ type: 'done', buffer }, [buffer])
      encoder = null
    }
  } catch (error) {
    scope.postMessage({ type: 'error', message: error instanceof Error ? error.message : '动图编码失败' })
  }
}
