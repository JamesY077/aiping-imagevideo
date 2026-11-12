/**
 * 3D 建模工作台的「全息组装台」渲染器。
 *
 * 视觉：中央悬浮模型 + 地面同心光环 + 垂直扫描装配动画 + 栅格 HUD。
 *
 * 技术：
 * - V2Fun 的 3D 产物是 **3D 高斯点云 PLY**（f_dc_* / opacity / scale_* / rot_*，无面索引），
 *   交给 Spark（@sparkjsdev/spark）做真正的高斯泼溅渲染：按深度排序 + 各向异性椭圆，
 *   这才是官方预览视频里那种「实心物体」的效果；
 * - 同时兼容 GLB / GLTF（走 MeshStandardMaterial）；
 * - 资源统一经同源代理读取（见 assets.ts），绕开 V2Fun OSS 不返回 CORS 头的问题。
 */

import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter.js'
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js'
import { PLYExporter } from 'three/examples/jsm/exporters/PLYExporter.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { SparkRenderer, SplatMesh } from '@sparkjsdev/spark'
import { AssetError, fetchAssetBytes, detectModelFormat } from './assets'

const CYAN = 0x38bdf8
const CYAN_SOFT = 0x7dd3fc

/** 预览材质：只影响本地渲染与导出，不改变上游返回的模型文件。 */
export type ViewerMaterial =
  | 'original'
  | 'matte'
  | 'ceramic'
  | 'metal'
  | 'chrome'
  | 'gold'
  | 'glass'
  | 'jade'

/** 可导出的三角网格格式。点云 PLY 无法可靠转换成 OBJ / STL。 */
export type ModelExportFormat = 'glb' | 'gltf' | 'obj' | 'stl' | 'ply'

/** 快捷机位：等轴 + 四个正交方向。 */
export type ViewerView = 'iso' | 'front' | 'back' | 'left' | 'right'

export interface ScreenshotOptions {
  /** transparent：透明背景；solid：纯色；scene：当前 AI 背景 */
  background?: 'transparent' | 'solid' | 'scene'
  color?: string
  /** PNG / JPEG / WebP；JPEG 不支持透明，透明模式会回落为白底。 */
  format?: 'png' | 'jpeg' | 'webp'
  quality?: number
}

export interface TurntableOptions {
  /** 输出边长（正方形），同时也是采集时的绘制缓冲尺寸。 */
  size: number
  /** 一整圈的帧数。 */
  frames: number
  /** GIF 不支持半透明，只有 solid / scene 两种背景。 */
  background?: 'solid' | 'scene'
  color?: string
  /** 每帧的回调：拿到 RGBA 像素后交给编码器；返回 Promise 可以限速。 */
  onFrame: (rgba: Uint8ClampedArray, index: number, total: number) => void | Promise<void>
}

const VIEW_DIRECTIONS: Record<ViewerView, THREE.Vector3> = {
  iso: new THREE.Vector3(0.31, 0.18, 0.9).normalize(),
  front: new THREE.Vector3(0, 0, 1),
  back: new THREE.Vector3(0, 0, -1),
  left: new THREE.Vector3(-1, 0, 0),
  right: new THREE.Vector3(1, 0, 0),
}

/**
 * 高斯点云没有 PBR 材质，只能做整体乘色与通透度调整。
 * 用接近中性的色值，避免把原始扫描色染死。
 */
const SPLAT_MATERIALS: Record<ViewerMaterial, { color: number; opacity: number }> = {
  original: { color: 0xffffff, opacity: 1 },
  matte: { color: 0xf1f3f5, opacity: 1 },
  ceramic: { color: 0xfff4e6, opacity: 1 },
  metal: { color: 0xd3dee9, opacity: 1 },
  chrome: { color: 0xf3f9ff, opacity: 1 },
  gold: { color: 0xf0c264, opacity: 1 },
  glass: { color: 0xdff2ff, opacity: 0.72 },
  jade: { color: 0x8fe6bd, opacity: 0.86 },
}

/** V2Fun 的点云是「Y 轴朝下、正面朝 +X」，绕 (1,0,1) 转 180° 摆正成 Y-up。 */
const AXIS_FIX = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 1).normalize(), Math.PI)

export type ViewerState = 'idle' | 'loading' | 'ready' | 'error'

export interface ViewerStats {
  kind: 'splat' | 'mesh'
  /** 高斯点数量或三角面数量 */
  count: number
  bytes: number
}

export interface LoadResult {
  stats: ViewerStats
}

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - clamp01(t), 3)
}

/**
 * 栅格贴图：中心镂空（模型脚下）并向边缘淡出。
 * 高斯泼溅是半透明叠加的，栅格线如果铺到模型脚下会从模型里透出来。
 */
function makeGridTexture(): THREE.Texture {
  const size = 1024
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const step = size / 32
    ctx.strokeStyle = '#4c93b8'
    ctx.lineWidth = 1.6
    ctx.beginPath()
    for (let i = 0; i <= 32; i += 1) {
      const p = i * step
      ctx.moveTo(p, 0)
      ctx.lineTo(p, size)
      ctx.moveTo(0, p)
      ctx.lineTo(size, p)
    }
    ctx.stroke()

    ctx.globalCompositeOperation = 'destination-in'
    const mask = ctx.createRadialGradient(size / 2, size / 2, size * 0.13, size / 2, size / 2, size * 0.5)
    mask.addColorStop(0, 'rgba(0, 0, 0, 0)')
    mask.addColorStop(0.16, 'rgba(0, 0, 0, 1)')
    mask.addColorStop(0.8, 'rgba(0, 0, 0, 0.45)')
    mask.addColorStop(1, 'rgba(0, 0, 0, 0)')
    ctx.fillStyle = mask
    ctx.fillRect(0, 0, size, size)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function makeGlowTexture(): THREE.Texture {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    gradient.addColorStop(0, 'rgba(120, 220, 255, 0.85)')
    gradient.addColorStop(0.35, 'rgba(56, 189, 248, 0.35)')
    gradient.addColorStop(1, 'rgba(8, 20, 32, 0)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, size, size)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

export class HologramViewer {
  private container: HTMLElement
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera: THREE.PerspectiveCamera
  private controls: OrbitControls
  private rig = new THREE.Group()
  private modelGroup = new THREE.Group()
  private placeholder = new THREE.Group()
  private floor = new THREE.Group()
  private scanRing: THREE.Mesh
  private grid: THREE.Mesh
  private raf = 0
  private clock = new THREE.Clock()
  private resizeObserver: ResizeObserver | null = null
  private disposed = false

  private spark: SparkRenderer
  private glowTexture = makeGlowTexture()
  private gridTexture = makeGridTexture()
  private state: ViewerState = 'idle'
  private splat: SplatMesh | null = null
  private revealStart = 0
  private revealActive = false
  private modelHeight = 2.2
  private modelRadius = 1.4

  /** GLB 网格与它们的原始材质，用于切换金属 / 玻璃预览。 */
  private meshEntries: { mesh: THREE.Mesh; base: THREE.MeshStandardMaterial }[] = []
  private overrideMaterials: THREE.Material[] = []
  private envTexture: THREE.Texture | null = null
  private materialPreset: ViewerMaterial = 'original'
  private materialThickness = 0.6
  private viewTween: { from: THREE.Vector3; to: THREE.Vector3; start: number; duration: number } | null = null
  private backdropImage: HTMLImageElement | null = null
  private building = false
  private buildingProgress = 0

  onStateChange: ((state: ViewerState) => void) | null = null
  onProgress: ((loaded: number, total: number) => void) | null = null

  constructor(container: HTMLElement) {
    this.container = container
    this.scene.fog = new THREE.FogExp2(0x05070d, 0.055)

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.renderer.setClearAlpha(0)
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.12

    // 金属 / 玻璃需要环境反射才不发黑：用程序化房间贴图生成一份 PMREM，
    // 同时作为场景环境光，让 glTF 自带的 metallicRoughness 材质也能正确反射。
    const pmrem = new THREE.PMREMGenerator(this.renderer)
    this.envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    pmrem.dispose()
    this.scene.environment = this.envTexture
    const canvas = this.renderer.domElement
    canvas.className = 'hologram-canvas'
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    canvas.style.display = 'block'
    canvas.style.touchAction = 'none'
    container.appendChild(canvas)

    this.camera = new THREE.PerspectiveCamera(42, 1, 0.01, 120)
    this.camera.position.set(1.55, 1.95, 4.55)

    this.controls = new OrbitControls(this.camera, canvas)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.075
    this.controls.target.set(0, 1.08, 0)
    this.controls.minDistance = 1.1
    this.controls.maxDistance = 12
    this.controls.maxPolarAngle = Math.PI * 0.52
    this.controls.minPolarAngle = Math.PI * 0.06
    this.controls.autoRotateSpeed = 0.85
    this.controls.autoRotate = true
    this.controls.zoomSpeed = 0.85
    this.controls.update()

    // 用户一旦手动拖拽，就中断机位补间，避免和手势抢相机。
    this.controls.addEventListener('start', () => {
      this.viewTween = null
    })

    // Spark 负责所有高斯点云的排序与泼溅渲染，跟随普通 three 场景一起绘制。
    // 略微扩大高斯覆盖范围，减轻放大查看时点与点之间的颗粒感。
    this.spark = new SparkRenderer({
      renderer: this.renderer,
      maxStdDev: Math.sqrt(9),
      preBlurAmount: 0.25,
    })
    this.scene.add(this.spark)
    this.scene.add(new THREE.HemisphereLight(0xbfe9ff, 0x0a111c, 1.15))
    this.addDirectionalLight(0xffffff, 2.1, [3.4, 5.2, 4.2])
    this.addDirectionalLight(CYAN_SOFT, 2.4, [-4.2, 2.4, -3.4])
    this.addDirectionalLight(0x7c9cff, 1.4, [0, 2.2, -5])

    this.buildFloor()
    this.buildPlaceholder()

    this.scanRing = new THREE.Mesh(
      new THREE.RingGeometry(0.98, 1.03, 96),
      new THREE.MeshBasicMaterial({
        color: 0xd8f6ff,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    )
    this.scanRing.rotation.x = -Math.PI / 2
    this.scanRing.position.y = 0.02
    this.scanRing.visible = false
    // 扫描环属于「叠加特效」，必须画在模型之后。
    this.scanRing.renderOrder = 2
    this.scene.add(this.scanRing)

    this.grid = new THREE.Mesh(
      new THREE.PlaneGeometry(8, 8),
      new THREE.MeshBasicMaterial({
        map: this.gridTexture,
        transparent: false,
        opacity: 0.62,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    )
    this.grid.rotation.x = -Math.PI / 2
    this.grid.position.y = 0.002
    this.rig.add(this.grid)
    // 高斯泼溅从自己的通道合成，若地面留在透明队列里会盖到模型上面；
    // 因此地面类材质走不透明队列 + renderOrder=-1，永远先画、且不写深度。
    this.rig.renderOrder = -1

    this.scene.add(this.rig, this.modelGroup, this.placeholder)

    this.resize()
    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(container)
    this.animate()
  }

  /* ---------------------------------------------------------------- 场景搭建 */

  private addDirectionalLight(color: number, intensity: number, position: [number, number, number]) {
    const light = new THREE.DirectionalLight(color, intensity)
    light.position.set(...position)
    this.scene.add(light)
  }

  /** 地面柔光 + 同心光环 + 刻度辐条，一起跟随「栅格」开关显隐。 */
  private buildFloor() {
    const glow = new THREE.Mesh(
      new THREE.CircleGeometry(3.1, 64),
      new THREE.MeshBasicMaterial({
        map: this.glowTexture,
        transparent: false,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    )
    glow.rotation.x = -Math.PI / 2
    glow.position.y = 0.004
    this.floor.add(glow)

    ;[0.85, 1.3, 1.75, 2.25, 2.85].forEach((radius, index) => {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(radius - 0.006, radius + 0.006, 160),
        new THREE.MeshBasicMaterial({
          color: index % 2 === 0 ? CYAN : 0x1d6d8f,
          transparent: false,
          opacity: index === 0 ? 0.75 : 0.3,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      )
      ring.rotation.x = -Math.PI / 2
      ring.position.y = 0.006 + index * 0.001
      this.floor.add(ring)
    })

    const spokes: number[] = []
    for (let i = 0; i < 48; i += 1) {
      const angle = (i / 48) * Math.PI * 2
      const outer = i % 4 === 0 ? 2.9 : 2.68
      spokes.push(Math.cos(angle) * 1.32, 0, Math.sin(angle) * 1.32)
      spokes.push(Math.cos(angle) * outer, 0, Math.sin(angle) * outer)
    }
    const spokeGeometry = new THREE.BufferGeometry()
    spokeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(spokes, 3))
    this.floor.add(
      new THREE.LineSegments(
        spokeGeometry,
        new THREE.LineBasicMaterial({
          color: 0x2a7a9c,
          transparent: false,
          opacity: 0.4,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      ),
    )

    this.rig.add(this.floor)
  }

  private buildPlaceholder() {
    const wire = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.72, 1),
      new THREE.MeshBasicMaterial({
        color: CYAN,
        wireframe: true,
        transparent: true,
        opacity: 0.32,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    )
    wire.name = 'placeholder-wire'
    wire.position.y = 1.15
    this.placeholder.add(wire)

    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 32, 24),
      new THREE.MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.55, depthWrite: false }),
    )
    core.position.y = 1.15
    this.placeholder.add(core)

    for (let i = 0; i < 2; i += 1) {
      const torus = new THREE.Mesh(
        new THREE.TorusGeometry(0.95 + i * 0.22, 0.006, 8, 140),
        new THREE.MeshBasicMaterial({
          color: i === 0 ? 0x67e8f9 : 0x3b82f6,
          transparent: true,
          opacity: 0.55,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      )
      torus.rotation.x = Math.PI / 2
      torus.position.y = 1.15
      this.placeholder.add(torus)
    }
  }

  /* ---------------------------------------------------------------- 生命周期 */

  private resize() {
    const width = Math.max(1, this.container.clientWidth)
    const height = Math.max(1, this.container.clientHeight)
    // Retina 基础上再做一点超采样，缩回 CSS 尺寸时能减轻点云颗粒与网格锯齿；
    // 同时把绘制缓冲限制在约 8MP，避免全屏 4K 时帧率崩掉。
    const base = Math.min(window.devicePixelRatio || 1, 2)
    const areaRatio = Math.sqrt(8_000_000 / Math.max(width * height, 1))
    const pixelRatio = Math.max(1, Math.min(base * 1.25, 3, areaRatio))
    this.renderer.setPixelRatio(pixelRatio)
    this.renderer.setSize(width, height, false)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
  }

  private animate = () => {
    if (this.disposed) return
    this.raf = requestAnimationFrame(this.animate)
    const elapsed = this.clock.getElapsedTime()

    if (this.viewTween) {
      const progress = clamp01((performance.now() - this.viewTween.start) / this.viewTween.duration)
      this.camera.position.lerpVectors(this.viewTween.from, this.viewTween.to, easeOutCubic(progress))
      if (progress >= 1) this.viewTween = null
    }

    this.controls.update()

    if (this.state !== 'ready') {
      // 任务进行中装配台加速运转，扫描环自下而上循环扫过占位体。
      const speed = this.building ? 1.25 : 0.5
      this.placeholder.rotation.y = elapsed * speed
      const wire = this.placeholder.getObjectByName('placeholder-wire')
      if (wire) {
        wire.rotation.x = Math.sin(elapsed * (this.building ? 1.7 : 0.5)) * (this.building ? 0.45 : 0.25)
        wire.rotation.z = elapsed * (this.building ? 0.62 : 0.18)
      }
      this.placeholder.scale.setScalar(this.building ? 1 + Math.sin(elapsed * 5.4) * 0.04 : 1)
      if (this.building) {
        const sweep = (elapsed * (0.4 + (this.buildingProgress / 100) * 0.4)) % 1
        this.scanRing.visible = true
        this.scanRing.position.y = 0.02 + sweep * 2.15
        ;(this.scanRing.material as THREE.MeshBasicMaterial).opacity = 0.85 * (1 - sweep * 0.72)
      }
    } else {
      this.modelGroup.position.y = Math.sin(elapsed * 1.05) * 0.016
    }

    if (this.revealActive) {
      const progress = clamp01((performance.now() - this.revealStart) / 1350)
      const eased = easeOutCubic(progress)
      this.modelGroup.scale.setScalar(0.9 + 0.1 * eased)
      if (this.splat) this.splat.opacity = eased * this.splatTargetOpacity()
      this.scanRing.visible = true
      this.scanRing.position.y = 0.02 + eased * this.modelHeight
      ;(this.scanRing.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - eased * 0.55)
      if (progress >= 1) {
        this.revealActive = false
        this.scanRing.visible = false
      }
    }

    this.renderer.render(this.scene, this.camera)
  }

  dispose() {
    this.disposed = true
    cancelAnimationFrame(this.raf)
    this.resizeObserver?.disconnect()
    this.resizeObserver = null
    this.controls.dispose()
    this.clearModel()
    this.spark.dispose()
    this.scene.traverse((object) => {
      const mesh = object as THREE.Mesh
      mesh.geometry?.dispose?.()
      const material = mesh.material as THREE.Material | THREE.Material[] | undefined
      if (Array.isArray(material)) material.forEach((item) => item.dispose())
      else material?.dispose?.()
    })
    this.glowTexture.dispose()
    this.gridTexture.dispose()
    this.envTexture?.dispose()
    this.envTexture = null
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }

  private clearModel() {
    if (this.splat) {
      this.modelGroup.remove(this.splat)
      this.splat.dispose()
      this.splat = null
    }
    // 先把覆盖材质换回原始材质，再统一释放，避免重复 dispose。
    this.meshEntries.forEach(({ mesh, base }) => {
      mesh.material = base
    })
    this.overrideMaterials.forEach((material) => material.dispose())
    this.overrideMaterials = []
    this.meshEntries = []
    // GLB / GLTF 分支自己创建材质，换模型时一并释放显存。
    this.modelGroup.traverse((object) => {
      const mesh = object as THREE.Mesh
      mesh.geometry?.dispose?.()
      const material = mesh.material as THREE.Material | THREE.Material[] | undefined
      if (Array.isArray(material)) material.forEach((item) => item.dispose())
      else material?.dispose?.()
    })
    this.modelGroup.clear()
    this.modelGroup.scale.setScalar(1)
  }

  /* ---------------------------------------------------------------- 模型加载 */

  /** 回到待命状态：清空已加载模型，让装配台显示执行 / 待命动画。 */
  resetToIdle() {
    this.revealActive = false
    this.clearModel()
    this.placeholder.visible = true
    this.scanRing.visible = this.building
    this.modelHeight = 2.2
    this.modelRadius = 1.4
    this.setState('idle')
  }

  async loadFromUrl(rawUrl: string): Promise<LoadResult> {
    this.setState('loading')
    this.clearModel()
    this.placeholder.visible = true
    this.scanRing.visible = false
    this.revealActive = false

    const buffer = await fetchAssetBytes(rawUrl, (loaded, total) => this.onProgress?.(loaded, total))
    const format = detectModelFormat(buffer, rawUrl)

    let stats: ViewerStats
    if (format === 'ply') stats = await this.addSplat(buffer)
    else if (format === 'glb' || format === 'gltf') stats = await this.addGltf(buffer, format)
    else throw new AssetError('无法识别的 3D 文件格式', 'format')

    this.placeholder.visible = false
    this.setState('ready')
    this.resetView()
    this.revealStart = performance.now()
    this.revealActive = true
    return { stats }
  }

  /** 让模型「落在台面上」：归一化到最长边 2.05，底面贴地、水平居中。 */
  private placeModel(object: THREE.Object3D, box: THREE.Box3) {
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())
    const scale = 2.05 / Math.max(size.x, size.y, size.z, 1e-4)
    object.scale.setScalar(scale)
    object.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale)
    this.modelHeight = size.y * scale
    this.modelRadius = 0.5 * size.length() * scale
  }

  /**
   * 高斯点云：交给 Spark 渲染。
   *
   * 摆正后的包围盒是一个轴置换（x'=z, y'=-y, z'=x），直接换算成新的 AABB，
   * 再按最长边归一化，避免长条 / 扁平模型被裁到画外。
   */
  private async addSplat(buffer: ArrayBuffer): Promise<ViewerStats> {
    const mesh = new SplatMesh({ fileBytes: buffer })
    await mesh.initialized

    const box = mesh.getBoundingBox()
    if (box.isEmpty()) throw new AssetError('点云数据为空', 'format')
    const rotated = new THREE.Box3(
      new THREE.Vector3(box.min.z, -box.max.y, box.min.x),
      new THREE.Vector3(box.max.z, -box.min.y, box.max.x),
    )

    mesh.quaternion.copy(AXIS_FIX)
    this.placeModel(mesh, rotated)

    // 装配动画里从 0 淡入
    this.splat = mesh
    this.applyMaterialToSplat()
    mesh.opacity = 0
    this.modelGroup.add(mesh)

    return { kind: 'splat', count: mesh.packedSplats?.numSplats ?? 0, bytes: buffer.byteLength }
  }

  private async addGltf(buffer: ArrayBuffer, format: 'glb' | 'gltf'): Promise<ViewerStats> {
    const loader = new GLTFLoader()
    const gltf = await new Promise<{ scene: THREE.Group }>((resolve, reject) => {
      loader.parse(
        format === 'gltf' ? new TextDecoder().decode(buffer) : buffer,
        '',
        (result) => resolve(result as unknown as { scene: THREE.Group }),
        (error) => reject(error),
      )
    })

    const root = gltf.scene
    let triangles = 0
    this.meshEntries = []
    root.traverse((child) => {
      const mesh = child as THREE.Mesh
      if (!mesh.isMesh) return
      const geometry = mesh.geometry as THREE.BufferGeometry
      triangles += (geometry.getIndex()?.count ?? geometry.getAttribute('position').count) / 3
      // V2Fun 的 GLB 只有 POSITION / TEXCOORD，没有法线；不补算法线的话
      // 所有光照项都会变成 0，模型在深色背景里就是一团黑剪影。
      if (!geometry.getAttribute('normal')) geometry.computeVertexNormals()
      const source = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial | undefined
      // 直接保留 glTF 自带材质：baseColor / metallicRoughness / normal 等贴图都是上游烘焙好的，
      // 之前重新 new 一个基础材质会把金属度、粗糙度贴图丢掉，模型看起来就“材质不对”。
      let material: THREE.MeshStandardMaterial
      if (source?.isMeshStandardMaterial) {
        material = source
        material.side = THREE.DoubleSide
        material.envMap = this.envTexture
        material.envMapIntensity = 0.9
        material.needsUpdate = true
      } else {
        material = new THREE.MeshStandardMaterial({
          color: source?.color?.clone() ?? new THREE.Color(0xbfe6f7),
          map: source?.map ?? null,
          metalness: 0.12,
          roughness: 0.62,
          side: THREE.DoubleSide,
        })
      }
      mesh.material = material
      this.meshEntries.push({ mesh, base: material })
    })

    const box = new THREE.Box3().setFromObject(root)
    this.placeModel(root, box)
    this.modelGroup.add(root)
    // 模型就绪后应用当前选中的预览材质（换任务时保持用户的选择）。
    this.applyMaterialToMeshes()

    return { kind: 'mesh', count: Math.round(triangles), bytes: buffer.byteLength }
  }

  /* ---------------------------------------------------------------- 材质与机位 */

  setMaterial(preset: ViewerMaterial, thickness = this.materialThickness) {
    this.materialPreset = preset
    this.materialThickness = Math.min(2, Math.max(0.05, thickness))
    this.applyMaterialToMeshes()
    this.applyMaterialToSplat()
  }

  /** 点云没有 PBR，只能整体乘色 + 调通透度；至少让材质按钮在点云上也有反馈。 */
  private applyMaterialToSplat() {
    if (!this.splat) return
    const preset = SPLAT_MATERIALS[this.materialPreset]
    this.splat.recolor.setHex(preset.color)
    this.splat.opacity = preset.opacity
  }

  private splatTargetOpacity(): number {
    return SPLAT_MATERIALS[this.materialPreset].opacity
  }

  private applyMaterialToMeshes() {
    if (!this.meshEntries.length) return
    this.overrideMaterials.forEach((material) => material.dispose())
    this.overrideMaterials = []

    this.meshEntries.forEach(({ mesh, base }) => {
      if (this.materialPreset === 'original') {
        mesh.material = base
        return
      }
      const material = this.buildOverrideMaterial(base)
      this.overrideMaterials.push(material)
      mesh.material = material
    })
  }

  private buildOverrideMaterial(base: THREE.MeshStandardMaterial): THREE.Material {
    switch (this.materialPreset) {
      case 'matte':
        return new THREE.MeshStandardMaterial({
          color: base.color?.clone() ?? new THREE.Color(0xcbd5df),
          map: base.map ?? null,
          metalness: 0.02,
          roughness: 0.94,
          envMap: this.envTexture,
          envMapIntensity: 0.25,
          side: THREE.DoubleSide,
        })
      case 'ceramic':
        return new THREE.MeshPhysicalMaterial({
          color: 0xf3efe6,
          metalness: 0,
          roughness: 0.2,
          clearcoat: 1,
          clearcoatRoughness: 0.08,
          envMap: this.envTexture,
          envMapIntensity: 0.8,
          side: THREE.DoubleSide,
        })
      case 'chrome':
        return new THREE.MeshStandardMaterial({
          color: 0xe9f2fa,
          metalness: 1,
          roughness: 0.035,
          envMap: this.envTexture,
          envMapIntensity: 1.7,
          side: THREE.DoubleSide,
        })
      case 'gold':
        return new THREE.MeshStandardMaterial({
          color: 0xf3c75f,
          metalness: 1,
          roughness: 0.17,
          envMap: this.envTexture,
          envMapIntensity: 1.5,
          side: THREE.DoubleSide,
        })
      case 'glass':
        return this.buildGlassMaterial()
      case 'jade':
        return new THREE.MeshPhysicalMaterial({
          color: 0x7fe0b6,
          metalness: 0,
          roughness: 0.26,
          transmission: 0.62,
          thickness: 0.9,
          ior: 1.55,
          envMap: this.envTexture,
          envMapIntensity: 1.1,
          clearcoat: 0.55,
          clearcoatRoughness: 0.12,
          transparent: true,
          side: THREE.DoubleSide,
        })
      default:
        return this.buildMetalMaterial(base)
    }
  }

  private buildMetalMaterial(base: THREE.MeshStandardMaterial): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({
      color: base.color?.clone() ?? new THREE.Color(0xc9d6e3),
      map: base.map ?? null,
      metalness: 0.96,
      roughness: 0.22,
      envMap: this.envTexture,
      envMapIntensity: 1.15,
      side: THREE.DoubleSide,
    })
  }

  private buildGlassMaterial(): THREE.MeshPhysicalMaterial {
    return new THREE.MeshPhysicalMaterial({
      color: 0xdff2ff,
      metalness: 0,
      roughness: 0.06,
      transmission: 1,
      // 归一化后模型最长边约 2.05，厚度 0.15–2 在观感上跨度合适。
      thickness: 0.15 + this.materialThickness * 1.85,
      ior: 1.46,
      envMap: this.envTexture,
      envMapIntensity: 1.2,
      clearcoat: 0.7,
      clearcoatRoughness: 0.06,
      transparent: true,
      side: THREE.DoubleSide,
    })
  }

  /** 快捷机位：围绕当前目标点做 420ms 缓动，不会跳变。 */
  setView(view: ViewerView) {
    this.controls.autoRotate = false
    const target = this.controls.target.clone()
    const distance = Math.max(2.8, this.camera.position.distanceTo(target))
    const to = target.clone().addScaledVector(VIEW_DIRECTIONS[view] ?? VIEW_DIRECTIONS.iso, distance)
    this.viewTween = {
      from: this.camera.position.clone(),
      to,
      start: performance.now(),
      duration: 420,
    }
  }

  /** 预载 AI 背景图，导出时同步绘制到画布上。 */
  async setBackdrop(url: string | null): Promise<void> {
    if (!url) {
      this.backdropImage = null
      return
    }
    const image = new Image()
    image.src = url
    try {
      await image.decode()
      this.backdropImage = image
    } catch {
      this.backdropImage = null
    }
  }

  /* ---------------------------------------------------------------- 状态与交互 */

  private setState(state: ViewerState) {
    this.state = state
    this.onStateChange?.(state)
  }

  setAutoRotate(enabled: boolean) {
    this.controls.autoRotate = enabled
  }

  /**
   * 任务进行中：装配台进入「执行中」状态。
   * 占位体加速旋转 + 轻微脉冲，扫描环上下循环扫过。
   */
  setBuilding(active: boolean, progress = 0) {
    this.buildingProgress = Math.min(100, Math.max(0, progress))
    if (active === this.building) return
    this.building = active
    if (!active) {
      this.placeholder.scale.setScalar(1)
      if (!this.revealActive) this.scanRing.visible = false
    }
  }

  /** 导出当前预览模型。点云无法转成三角网格，需提示用户下载原始 PLY。 */
  async exportModel(format: ModelExportFormat): Promise<Blob> {
    let meshCount = 0
    this.modelGroup.traverse((object) => {
      if ((object as THREE.Mesh).isMesh) meshCount += 1
    })
    if (!meshCount) throw new AssetError('点云模型无法转换为网格格式，请在右侧下载原始 PLY', 'format')

    switch (format) {
      case 'glb':
      case 'gltf': {
        const exporter = new GLTFExporter()
        const result = await exporter.parseAsync(this.modelGroup, {
          binary: format === 'glb',
          onlyVisible: true,
        })
        if (format === 'glb') return new Blob([result as ArrayBuffer], { type: 'model/gltf-binary' })
        return new Blob([JSON.stringify(result, null, 2)], { type: 'model/gltf+json' })
      }
      case 'obj': {
        const text = new OBJExporter().parse(this.modelGroup)
        return new Blob([text], { type: 'text/plain' })
      }
      case 'stl': {
        const data = new STLExporter().parse(this.modelGroup, { binary: true }) as BlobPart
        return new Blob([data], { type: 'model/stl' })
      }
      default: {
        // PLYExporter 是回调式 API，binary 模式返回 DataView。
        const data = await new Promise<BlobPart | null>((resolve) => {
          new PLYExporter().parse(this.modelGroup, (result) => resolve(result as unknown as BlobPart), {
            binary: true,
          })
        })
        if (!data) throw new AssetError('PLY 导出失败，请改用 GLB 或 STL', 'format')
        return new Blob([data], { type: 'application/octet-stream' })
      }
    }
  }

  setGridVisible(visible: boolean) {
    this.grid.visible = visible
    this.floor.visible = visible
  }

  /** 按包围球自动取景，保持 3/4 侧前方视角。 */
  resetView() {
    this.viewTween = null
    const target = new THREE.Vector3(0, Math.max(this.modelHeight * 0.52, 0.2), 0)
    const distance = Math.min(12, Math.max(3.2, this.modelRadius * 3.7))
    const direction = new THREE.Vector3(0.31, 0.18, 0.9).normalize()
    this.controls.target.copy(target)
    this.camera.position.copy(target).addScaledVector(direction, distance)
    this.controls.update()
  }

  /**
   * 截图：先同步渲染一帧，再读画布，避免开启 preserveDrawingBuffer 拖慢渲染。
   * 画布本身是透明的，按需合成纯色 / AI 背景；透明模式直接输出带 alpha 的 PNG。
   */
  screenshot(options: ScreenshotOptions = {}): string | null {
    const mode = options.background ?? 'solid'
    const format = options.format ?? 'png'
    const rigVisible = this.rig.visible
    const placeholderVisible = this.placeholder.visible
    const ringVisible = this.scanRing.visible
    // 导出画面里不要台面栅格、占位球与扫描环，只保留模型本身。
    this.rig.visible = false
    this.placeholder.visible = false
    this.scanRing.visible = false
    try {
      this.renderer.render(this.scene, this.camera)
      const source = this.renderer.domElement
      const canvas = document.createElement('canvas')
      canvas.width = source.width
      canvas.height = source.height
      const ctx = canvas.getContext('2d')
      if (!ctx) return null

      paintBackdrop(ctx, canvas.width, canvas.height, mode, options.color, format, this.backdropImage)

      ctx.drawImage(source, 0, 0)
      const mime = format === 'jpeg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png'
      return canvas.toDataURL(mime, format === 'png' ? undefined : (options.quality ?? 0.92))
    } catch {
      return null
    } finally {
      this.rig.visible = rigVisible
      this.placeholder.visible = placeholderVisible
      this.scanRing.visible = ringVisible
    }
  }

  /**
   * 转台动画：绕模型转满一圈，逐帧把 RGBA 交给调用方编码（GIF 用）。
   * 采集期间把绘制缓冲临时改成正方形并隐藏画布，结束后完整还原相机与渲染状态。
   */
  async captureTurntable(options: TurntableOptions): Promise<void> {
    const size = Math.max(64, Math.round(options.size))
    const frames = Math.max(2, Math.round(options.frames))
    const canvas = this.renderer.domElement
    const previousSize = this.renderer.getSize(new THREE.Vector2())
    const previousRatio = this.renderer.getPixelRatio()
    const previousAspect = this.camera.aspect
    const previousPosition = this.camera.position.clone()
    const previousTarget = this.controls.target.clone()
    const previousDamping = this.controls.enableDamping
    const previousAutoRotate = this.controls.autoRotate
    const previousVisibility = canvas.style.visibility
    const previous = {
      rig: this.rig.visible,
      placeholder: this.placeholder.visible,
      ring: this.scanRing.visible,
      scale: this.modelGroup.scale.x,
      bob: this.modelGroup.position.y,
      splatOpacity: this.splat?.opacity ?? 1,
    }

    const output = document.createElement('canvas')
    output.width = size
    output.height = size
    const ctx = output.getContext('2d', { willReadFrequently: true })
    if (!ctx) throw new AssetError('动图导出失败：当前浏览器不支持画布导出', 'format')

    // 采集期间冻结显影动画与自动旋转，避免帧与帧之间出现漂移。
    this.viewTween = null
    this.revealActive = false
    this.modelGroup.scale.setScalar(1)
    this.modelGroup.position.y = 0
    if (this.splat) this.splat.opacity = this.splatTargetOpacity()
    this.rig.visible = false
    this.placeholder.visible = false
    this.scanRing.visible = false
    this.controls.enableDamping = false
    this.controls.autoRotate = false
    canvas.style.visibility = 'hidden'

    try {
      this.renderer.setPixelRatio(1)
      this.renderer.setSize(size, size, false)
      this.camera.aspect = 1
      this.camera.updateProjectionMatrix()

      const target = this.controls.target.clone()
      const offset = previousPosition.clone().sub(target)
      const axis = new THREE.Vector3(0, 1, 0)
      for (let index = 0; index < frames; index += 1) {
        const angle = (index / frames) * Math.PI * 2
        this.camera.position.copy(target).add(offset.clone().applyAxisAngle(axis, angle))
        this.camera.lookAt(target)
        this.camera.updateMatrixWorld()
        this.renderer.render(this.scene, this.camera)
        paintBackdrop(ctx, size, size, options.background ?? 'solid', options.color, 'png', this.backdropImage)
        ctx.drawImage(canvas, 0, 0)
        await options.onFrame(ctx.getImageData(0, 0, size, size).data, index, frames)
      }
    } finally {
      this.renderer.setPixelRatio(previousRatio)
      this.renderer.setSize(previousSize.x, previousSize.y, false)
      this.camera.aspect = previousAspect
      this.camera.updateProjectionMatrix()
      this.camera.position.copy(previousPosition)
      this.controls.target.copy(previousTarget)
      this.controls.enableDamping = previousDamping
      this.controls.autoRotate = previousAutoRotate
      this.controls.update()
      this.modelGroup.scale.setScalar(previous.scale)
      this.modelGroup.position.y = previous.bob
      if (this.splat) this.splat.opacity = previous.splatOpacity
      this.rig.visible = previous.rig
      this.placeholder.visible = previous.placeholder
      this.scanRing.visible = previous.ring
      canvas.style.visibility = previousVisibility
      this.resize()
    }
  }
}

/** 截图 / 动图共用的背景合成：透明模式不铺底，交给画布 alpha。 */
function paintBackdrop(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  mode: 'transparent' | 'solid' | 'scene',
  color: string | undefined,
  format: 'png' | 'jpeg' | 'webp',
  backdrop: HTMLImageElement | null,
) {
  if (mode === 'solid') {
    ctx.fillStyle = color || '#0b1626'
    ctx.fillRect(0, 0, width, height)
  } else if (mode === 'scene') {
    if (backdrop?.complete && backdrop.naturalWidth) {
      drawCover(ctx, backdrop, width, height)
      // 很浅的暗角，和舞台里的可读性处理保持一致。
      ctx.fillStyle = 'rgba(3, 8, 14, 0.16)'
      ctx.fillRect(0, 0, width, height)
    } else {
      fillStageGradient(ctx, width, height)
    }
  } else if (format === 'jpeg') {
    // JPEG 没有 alpha 通道，透明背景会变成黑底，统一回落为白底。
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
  }
}

/** 背景图按 cover 方式铺满画布。 */
function drawCover(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  width: number,
  height: number,
) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight)
  const drawWidth = image.naturalWidth * scale
  const drawHeight = image.naturalHeight * scale
  ctx.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight)
}

function fillStageGradient(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const gradient = ctx.createRadialGradient(width / 2, height * 0.38, 0, width / 2, height * 0.38, Math.max(width, height) * 0.8)
  gradient.addColorStop(0, '#0b1626')
  gradient.addColorStop(1, '#04060b')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)
}
