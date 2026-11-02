import fs from 'node:fs'
import path from 'node:path'
import { startEnv, describeError } from './lib/env.mjs'

const KEY = process.env.AIPING_API_KEY
const args = process.argv.slice(2)
const DRY = args.includes('--dry-run')
const RUN_SETUP = args.includes('--with-setup')
const LIMIT = Number((args.find((a) => a.startsWith('--limit=')) || '').split('=')[1] || 0)
const ONLY = (args.find((a) => a.startsWith('--only=')) || '').split('=')[1] || ''
const KEYS_FILE = (args.find((a) => a.startsWith('--keys=')) || '').split('=')[1] || ''
const CONCURRENCY = Number((args.find((a) => a.startsWith('--concurrency=')) || '').split('=')[1] || 3)
// 上游签名 URL 24 小时过期，跨天复测时用 --refresh-assets 重新生成整套参考素材。
const REFRESH_ASSETS = args.includes('--refresh-assets')
const PREPARE_ONLY = args.includes('--prepare-assets')

const OUT_DIR = path.resolve('test-results')
fs.mkdirSync(OUT_DIR, { recursive: true })
const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const JSONL = path.join(OUT_DIR, `matrix-${stamp}.jsonl`)
const STATE = path.join(OUT_DIR, 'assets.json')
const out = fs.createWriteStream(JSONL, { flags: 'a' })

const ts = () => new Date().toISOString().slice(11, 19)
function log(...parts) {
  const line = `[${ts()}] ${parts.join(' ')}`
  console.log(line)
}

const env = await startEnv({ apiKey: KEY })
const { model: modelUtil, models, api, bp, vid } = env

// ---------- 参考素材 ----------
function makeFile(name, type, url, extra = {}) {
  return { name, type, url, size: 0, ...extra }
}

async function loadOrCreateAssets() {
  const cached = fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, 'utf8')) : {}
  const assets = REFRESH_ASSETS ? {} : { ...cached }
  const REQUIRED = ['imageA', 'imageB', 'videoRef', 'humanImage', 'humanVideo']

  if (!REFRESH_ASSETS && REQUIRED.every((key) => assets[key])) {
    log('assets: reuse', STATE)
    return assets
  }
  if (DRY) {
    return {
      imageA: 'DRY_IMAGE_A',
      imageB: 'DRY_IMAGE_B',
      videoRef: 'DRY_VIDEO',
      humanImage: 'DRY_HUMAN_IMAGE',
      humanVideo: 'DRY_HUMAN_VIDEO',
    }
  }

  const save = () => fs.writeFileSync(STATE, JSON.stringify(assets, null, 2))

  async function genImage(prompt, ratio) {
    const params = await bp.buildImageParams(prompt, 'Doubao-Seedream-5.0-lite', null, ratio, 'seedream-5-lite')
    const res = await api.generateImage(params)
    const url = res?.data?.[0]?.url
    if (!url) throw new Error('参考图生成失败：' + JSON.stringify(res).slice(0, 500))
    return url
  }

  if (!assets.imageA) {
    log('assets: generating landscape reference image')
    assets.imageA = await genImage('雪山湖泊，清晨薄雾，写实风景摄影', '16:9')
    save()
  }
  if (!assets.imageB) {
    log('assets: generating portrait reference image')
    assets.imageB = await genImage('一株向日葵，浅色背景，写实摄影', '9:16')
    save()
  }
  if (!assets.humanImage) {
    log('assets: generating upper-body human reference image')
    assets.humanImage = await genImage(
      '正面全身站姿的年轻亚洲女性，穿浅色运动上衣与长裤，双手自然下垂，'
        + '完整上半身与腰部清晰可见，人物居中，纯浅灰色摄影棚背景，均匀柔光，'
        + '写实人像摄影，清晰五官，无遮挡，无裁切',
      '3:4',
    )
    save()
  }

  async function createAndPoll(params, options, label) {
    const task = await api.generateVideo(params)
    const final = await vid.pollVideoStatus(task.id, undefined, {
      provider: task.provider,
      providerCreateEndpoint: task.providerCreateEndpoint,
      ...options,
    })
    const url = final.video_url || final.data?.[0]?.url
    if (!url) throw new Error(`${label}生成失败：` + JSON.stringify(final).slice(0, 500))
    return url
  }

  if (!assets.videoRef) {
    log('assets: generating landscape reference video via MiniMax-H3 5s 768P')
    const params = await bp.buildVideoParams(
      '海浪缓慢拍打礁石，镜头平稳，自然光',
      'MiniMax-H3',
      null,
      '16:9',
      5,
      'minimax-h3',
      'off',
      '768P',
    )
    assets.videoRef = await createAndPoll(params, { duration: 5, resolution: '768P', timeoutMs: 20 * 60_000, interval: 4000 }, '参考视频')
    save()
  }

  if (!assets.humanVideo) {
    log('assets: generating human motion reference video via MiniMax-Hailuo-2.3 image2video')
    const humanFile = makeFile('humanImage.png', 'image', assets.humanImage)
    const params = await bp.buildVideoParams(
      '全身人物正面站立，缓慢转身并抬手挥手，镜头固定，动作自然流畅',
      'MiniMax-Hailuo-2.3',
      [humanFile],
      '16:9',
      6,
      'minimax-hailuo',
    )
    assets.humanVideo = await createAndPoll(params, { duration: 6, timeoutMs: 20 * 60_000, interval: 4000 }, '人像参考视频')
    save()
  }

  assets.createdAt = new Date().toISOString()
  save()
  log('assets: saved', STATE)
  return assets
}

// ---------- 用例构造 ----------
function pickRepresentativeRatio(list) {
  if (!list?.length) return '16:9'
  if (list.includes('16:9')) return '16:9'
  return list.find((r) => r !== 'adaptive') || list[0]
}

function buildCases(assets) {
  const cases = []
  const seen = new Set()
  const push = (c) => {
    const key = c.key
    if (seen.has(key)) return
    seen.add(key)
    cases.push(c)
  }

  const imageModels = models.imageModelModules.map((m) => ({
    id: m.id,
    mode: m.capability.imageRequestMode,
    modes: ['text2image', 'image2image'],
  }))
  const imageRatios = modelUtil.ASPECT_RATIO_OPTIONS.map((o) => o.value)

  for (const m of imageModels) {
    for (const mode of m.modes) {
      for (const ratio of imageRatios) {
        push({
          key: `image|${m.id}|${mode}|${ratio}`,
          kind: 'image',
          model: m.id,
          imageRequestMode: m.mode,
          mode,
          ratio,
          prompt: mode === 'image2image'
            ? '参考图片中的主体与色调，生成同风格的画面，构图稳定'
            : '雪山湖泊，清晨薄雾，写实风景摄影',
        })
      }
    }
  }

  const videoModules = models.videoModelModules.map((m) => ({
    id: m.id,
    mode: m.capability.videoRequestMode,
  }))

  for (const m of videoModules) {
    const modes = modelUtil.getSupportedVideoModes(m.id).map((o) => o.value)
    const durations = modelUtil.getSupportedVideoDurations(m.id).map((o) => o.value)
    const isH3 = m.mode === 'minimax-h3'
    const defaultDuration = modelUtil.getDefaultVideoDuration(m.id)
    const defaultResolution = isH3 ? '768P' : null
    const primaryMode = modes.includes('text2video') ? 'text2video' : modes[0]

    const make = (mode, ratio, duration, resolution) => ({
      key: `video|${m.id}|${mode}|${ratio}|${duration}|${resolution || ''}`,
      kind: 'video',
      model: m.id,
      videoRequestMode: m.mode,
      mode,
      ratio,
      duration,
      resolution,
      prompt: promptForMode(mode),
    })

    // 1) 每个模式各跑一次（探活 + 协议校验）
    for (const mode of modes) {
      const ratios = modelUtil.getSupportedAspectRatios(m.id, mode)
        || modelUtil.ASPECT_RATIO_OPTIONS.map((o) => o.value)
      const ratio = pickRepresentativeRatio(ratios)
      push(make(mode, ratio, defaultDuration, defaultResolution))
    }

    // 2) 主模式的全部比例
    const primaryRatios = (modelUtil.getSupportedAspectRatios(m.id, primaryMode) || [])
      .filter((r) => r !== 'adaptive')
    for (const ratio of primaryRatios) {
      push(make(primaryMode, ratio, defaultDuration, defaultResolution))
    }

    // 3) 主模式的全部时长
    for (const duration of durations) {
      const ratios = modelUtil.getSupportedAspectRatios(m.id, primaryMode) || []
      push(make(primaryMode, pickRepresentativeRatio(ratios), duration, defaultResolution))
    }

    // 4) MiniMax-H3：全部分辨率档
    if (isH3) {
      for (const resolution of ['768P', '2K']) {
        const ratios = modelUtil.getSupportedAspectRatios(m.id, primaryMode) || []
        push(make(primaryMode, pickRepresentativeRatio(ratios), defaultDuration, resolution))
      }
      // 已知高风险档位：2K + 15s（文生 & 多模态参考）
      push(make('text2video', '16:9', 15, '2K'))
      push(make('multimodalReference2video', '16:9', 15, '2K'))
    }
  }

  return cases
}

function promptForMode(mode) {
  switch (mode) {
    case 'image2image':
      return '参考图片中的主体与色调，生成同风格的画面，构图稳定'
    case 'referenceImage2video':
      return '参考图片中的主体自然运动，镜头平稳推进'
    case 'startEnd2video':
      return '从首帧平滑过渡到尾帧，镜头缓慢推进'
    case 'endFrame2video':
      return '镜头缓慢推进，最终停到尾帧画面'
    case 'subjectReference2video':
      return '保持主体一致，镜头缓慢环绕'
    case 'motionControl2video':
      return '参考视频中的动作，画面主体自然运动'
    case 'multimodalReference2video':
      return '参考素材中的主体在场景中自然运动，镜头稳定'
    case 'editVideo':
      return '把视频中的主体替换为参考图片中的主体，保持镜头与光照一致'
    default:
      return '清晨的湖面，薄雾缓慢流动，镜头平稳推进，自然光，写实风格'
  }
}

function buildUpload(c, assets) {
  const imgA = makeFile('imageA.png', 'image', assets.imageA)
  const imgB = makeFile('imageB.png', 'image', assets.imageB)
  const video = makeFile('videoRef.mp4', 'video', assets.videoRef)
  // 动作控制 / 主体参考需要可识别的人像（完整上半身），风景图会被上游判为识别失败。
  const human = makeFile('humanImage.png', 'image', assets.humanImage || assets.imageA)
  // 动作控制的参考视频同样必须含完整上半身人物。
  const humanVideo = makeFile('humanVideo.mp4', 'video', assets.humanVideo || assets.videoRef)

  switch (c.mode) {
    case 'text2image':
    case 'text2video':
      return null
    case 'image2image':
    case 'image2video':
    case 'referenceImage2video':
      return [imgA]
    case 'startEnd2video':
      return [
        { ...imgA, purpose: 'start-frame' },
        { ...imgB, purpose: 'end-frame' },
      ]
    case 'endFrame2video':
      return [{ ...imgA, purpose: 'end-frame' }]
    case 'subjectReference2video':
      return [{ ...human, name: 'Subject Reference' }]
    case 'motionControl2video':
      return [
        {
          ...human,
          purpose: 'motion-control-image',
          motionControlOptions: { keep_original_sound: 'yes', character_orientation: 'image' },
        },
        { ...humanVideo, purpose: 'motion-control-video' },
      ]
    case 'multimodalReference2video':
      return [
        { ...imgA, purpose: 'multimodal-image' },
        { ...video, purpose: 'multimodal-video' },
      ]
    case 'editVideo':
      return [
        { ...video, purpose: 'multimodal-video' },
        { ...imgA, purpose: 'multimodal-image' },
      ]
    default:
      return null
  }
}

// ---------- 执行 ----------
function timeoutFor(c) {
  if (c.kind !== 'video') return 0
  const is2K = String(c.resolution || '').toUpperCase() === '2K'
  if (c.videoRequestMode === 'minimax-h3') return (is2K ? 30 : 20) * 60_000
  if (c.videoRequestMode === 'seedance-2') return 20 * 60_000
  return 12 * 60_000
}

async function runImage(c, assets) {
  const started = Date.now()
  const record = { ...baseRecord(c), kind: 'image' }
  try {
    const params = await bp.buildImageParams(
      c.prompt,
      c.model,
      buildUpload(c, assets),
      c.ratio,
      c.imageRequestMode,
    )
    record.request = params
    const res = await api.generateImage(params)
    const url = res?.data?.[0]?.url || (res?.data?.[0]?.b64_json ? 'b64_json' : undefined)
    if (!url) throw new Error('图片接口未返回 url：' + JSON.stringify(res).slice(0, 500))
    record.status = 'succeeded'
    record.resultUrl = url
  } catch (error) {
    record.status = 'failed'
    record.error = describeError(error)
  }
  record.elapsedMs = Date.now() - started
  return record
}

async function runVideo(c, assets) {
  const started = Date.now()
  const record = { ...baseRecord(c), kind: 'video' }
  let task
  try {
    const params = await bp.buildVideoParams(
      c.prompt,
      c.model,
      buildUpload(c, assets),
      c.ratio,
      c.duration,
      c.videoRequestMode,
      'off',
      c.resolution,
      c.mode,
    )
    record.request = params
    task = await api.generateVideo(params)
    record.taskId = task.id
    record.provider = task.provider
    record.createMs = Date.now() - started
    const final = await vid.pollVideoStatus(task.id, undefined, {
      provider: task.provider,
      providerCreateEndpoint: task.providerCreateEndpoint,
      duration: c.duration,
      resolution: c.resolution,
      hasReferenceMedia: Array.isArray(buildUpload(c, assets)),
      timeoutMs: timeoutFor(c),
      interval: 4000,
    })
    record.status = 'succeeded'
    record.resultUrl = final.video_url || final.data?.[0]?.url
    record.upstreamStatus = final.status || final.state
    record.upstreamUsage = final.usage || final.total_cost || final.cost
  } catch (error) {
    record.status = 'failed'
    record.error = describeError(error)
  }
  record.elapsedMs = Date.now() - started
  return record
}

function baseRecord(c) {
  return {
    caseId: c.key,
    model: c.model,
    mode: c.mode,
    ratio: c.ratio,
    duration: c.duration,
    resolution: c.resolution || null,
    startedAt: new Date().toISOString(),
  }
}

async function runCase(c, assets) {
  const record = c.kind === 'image' ? await runImage(c, assets) : await runVideo(c, assets)
  out.write(JSON.stringify(record) + '\n')
  const flag = record.status === 'succeeded' ? 'OK ' : 'FAIL'
  const err = record.status === 'failed'
    ? ` status=${record.error?.status ?? '-'} msg=${(record.error?.message || '').slice(0, 180)}`
    : ''
  log(flag, c.key, `${Math.round(record.elapsedMs / 1000)}s${err}`)
  return record
}

async function pool(items, size, fn) {
  const results = []
  let index = 0
  const workers = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (true) {
      const i = index++
      if (i >= items.length) return
      results[i] = await fn(items[i], i)
    }
  })
  await Promise.all(workers)
  return results
}

// ---------- main ----------
try {
  const assets = await loadOrCreateAssets()
  if (PREPARE_ONLY) {
    log('assets: prepared')
  } else {
    let cases = buildCases(assets)
    if (ONLY) cases = cases.filter((c) => c.model.toLowerCase().includes(ONLY.toLowerCase()))
    if (KEYS_FILE) {
      const keys = new Set(JSON.parse(fs.readFileSync(KEYS_FILE, 'utf8')))
      cases = cases.filter((c) => keys.has(c.key))
    }
    if (LIMIT > 0) cases = cases.slice(0, LIMIT)

    log(`cases: ${cases.length} (image=${cases.filter((c) => c.kind === 'image').length}, video=${cases.filter((c) => c.kind === 'video').length}), concurrency=${CONCURRENCY}`)
    if (DRY) {
      for (const c of cases) {
        log('CASE', c.key)
      }
      const byModel = {}
      for (const c of cases) byModel[c.model] = (byModel[c.model] || 0) + 1
      log('byModel:', JSON.stringify(byModel, null, 2))
    } else {
      fs.writeFileSync(path.join(OUT_DIR, `cases-${stamp}.json`), JSON.stringify(cases, null, 2))
      const results = await pool(cases, CONCURRENCY, (c) => runCase(c, assets))
      const ok = results.filter((r) => r.status === 'succeeded').length
      const failed = results.filter((r) => r.status === 'failed')
      log(`DONE ok=${ok} failed=${failed.length} total=${results.length}`)
      for (const f of failed) {
        log('FAILED', f.caseId, '|', f.error?.status ?? '-', '|', (f.error?.message || '').slice(0, 300))
      }
      fs.writeFileSync(path.join(OUT_DIR, `summary-${stamp}.json`), JSON.stringify({
        total: results.length,
        ok,
        failed: failed.length,
        failures: failed.map((f) => ({ caseId: f.caseId, status: f.error?.status, message: f.error?.message, upstream: f.error?.upstream })),
      }, null, 2))
    }
  }
} finally {
  out.end()
  await env.close()
}
