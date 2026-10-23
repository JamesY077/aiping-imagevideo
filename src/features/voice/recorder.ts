/**
 * 麦克风录音（用于声音复刻的样本采集）。
 *
 * 浏览器 MediaRecorder 在 Chrome 下输出 webm/opus、Safari 下输出 mp4/aac，
 * 两者都不在 MiniMax 允许的 mp3 / m4a / wav 白名单里，
 * 因此这里统一解码后重编码成 32kHz 单声道 WAV 再交给上传接口。
 */

import { onBeforeUnmount, ref } from 'vue'
import { decodeAudioBlob, encodeWavMono, getAudioContextCtor, getAudioDurationMs } from './audio'

export interface RecordingTake {
  blob: Blob
  durationMs: number
}

export function useVoiceRecorder() {
  const supported =
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices?.getUserMedia === 'function' &&
    typeof MediaRecorder !== 'undefined'

  const isRecording = ref(false)
  const isProcessing = ref(false)
  const isRequesting = ref(false)
  const elapsedMs = ref(0)
  const level = ref(0)
  const error = ref('')

  let mediaRecorder: MediaRecorder | null = null
  let stream: MediaStream | null = null
  let chunks: BlobPart[] = []
  let timerId: number | undefined
  let animationId = 0
  let audioContext: AudioContext | null = null
  let analyser: AnalyserNode | null = null
  let startedAt = 0
  let stoppedByUser = false

  function stopTimer() {
    if (timerId !== undefined) {
      window.clearInterval(timerId)
      timerId = undefined
    }
  }

  function stopMeter() {
    if (animationId) {
      cancelAnimationFrame(animationId)
      animationId = 0
    }
    analyser = null
    if (audioContext) {
      void audioContext.close().catch(() => {})
      audioContext = null
    }
    level.value = 0
  }

  function stopTracks() {
    stream?.getTracks().forEach((track) => track.stop())
    stream = null
  }

  function cleanup() {
    stopTimer()
    stopMeter()
    stopTracks()
    mediaRecorder = null
    chunks = []
    isRecording.value = false
    isProcessing.value = false
    isRequesting.value = false
  }

  function meter(mediaStream: MediaStream) {
    const Ctor = getAudioContextCtor()
    if (!Ctor) return

    try {
      const context = new Ctor()
      audioContext = context
      const source = context.createMediaStreamSource(mediaStream)
      const node = context.createAnalyser()
      node.fftSize = 1024
      node.smoothingTimeConstant = 0.7
      source.connect(node)
      analyser = node

      const data = new Uint8Array(node.frequencyBinCount)
      const tick = () => {
        if (!analyser) return
        analyser.getByteTimeDomainData(data)
        let sum = 0
        for (let index = 0; index < data.length; index += 1) {
          const value = (data[index] - 128) / 128
          sum += value * value
        }
        const rms = Math.sqrt(sum / data.length)
        level.value = Math.min(1, rms * 3.4)
        animationId = requestAnimationFrame(tick)
      }
      tick()
    } catch {
      // 电平表失败不影响录音本身
    }
  }

  async function start(): Promise<boolean> {
    if (!supported) {
      error.value = '当前浏览器不支持麦克风录音，请改用「上传音频」。'
      return false
    }
    if (isRecording.value) return true
    if (isRequesting.value) return false

    error.value = ''
    stoppedByUser = false
    isRequesting.value = true

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      })
    } catch (caught) {
      isRequesting.value = false
      const name = (caught as DOMException)?.name
      error.value =
        name === 'NotAllowedError'
          ? '麦克风权限被拒绝，请在浏览器地址栏的权限设置里允许麦克风后重试。'
          : name === 'NotFoundError'
            ? '没有检测到可用的麦克风设备。'
            : '无法启动录音，请检查麦克风是否被其他应用占用。'
      return false
    }
    isRequesting.value = false

    const preferredTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']
    const mimeType = preferredTypes.find((type) => MediaRecorder.isTypeSupported(type)) || ''

    try {
      mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
    } catch {
      mediaRecorder = new MediaRecorder(stream)
    }

    chunks = []
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data)
    }
    mediaRecorder.onerror = () => {
      error.value = '录音过程中出现异常，请重新录制。'
      cleanup()
    }

    mediaRecorder.start(200)
    startedAt = Date.now()
    elapsedMs.value = 0
    isRecording.value = true
    timerId = window.setInterval(() => {
      elapsedMs.value = Date.now() - startedAt
    }, 120)
    meter(stream)
    return true
  }

  async function stop(): Promise<RecordingTake | null> {
    const recorder = mediaRecorder
    if (!recorder || recorder.state === 'inactive') return null

    isProcessing.value = true
    stopTimer()
    stopMeter()

    const rawBlob = await new Promise<Blob>((resolve) => {
      recorder.onstop = () => {
        resolve(new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }))
      }
      recorder.stop()
    })

    stopTracks()
    mediaRecorder = null
    chunks = []
    isRecording.value = false
    stoppedByUser = true

    const decoded = await decodeAudioBlob(rawBlob)
    if (!decoded) {
      isProcessing.value = false
      error.value = '这段录音无法在当前浏览器解码，请改用「上传音频」提交 mp3 / m4a / wav 文件。'
      return null
    }

    const blob = encodeWavMono(decoded, 32000)
    const durationMs = Math.round(decoded.duration * 1000) || (await getAudioDurationMs(blob))
    isProcessing.value = false
    return { blob, durationMs }
  }

  function cancel() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      stoppedByUser = true
      mediaRecorder.onstop = null
      mediaRecorder.stop()
    }
    cleanup()
  }

  onBeforeUnmount(() => {
    if (!stoppedByUser) cancel()
  })

  return { supported, isRecording, isProcessing, isRequesting, elapsedMs, level, error, start, stop, cancel }
}
