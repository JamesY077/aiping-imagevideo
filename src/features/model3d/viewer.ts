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
import { SparkRenderer, SplatMesh } from '@sparkjsdev/spark'
import { AssetError, fetchAssetBytes, detectModelFormat } from './assets'

const CYAN = 0x38bdf8
const CYAN_SOFT = 0x7dd3fc

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
  private grid: THREE.GridHelper
  private raf = 0
  private clock = new THREE.Clock()
  private resizeObserver: ResizeObserver | null = null
  private disposed = false

  private spark: SparkRenderer
  private glowTexture = makeGlowTexture()
  private state: ViewerState = 'idle'
  private splat: SplatMesh | null = null
  private revealStart = 0
  private revealActive = false
  private modelHeight = 2.2
  private modelRadius = 1.4

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

    // Spark 负责所有高斯点云的排序与泼溅渲染，跟随普通 three 场景一起绘制。
    this.spark = new SparkRenderer({ renderer: this.renderer })
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
    this.rig.add(this.scanRing)

    this.grid = new THREE.GridHelper(8, 32, 0x1f5f7c, 0x0d2634)
    const gridMaterial = this.grid.material as THREE.Material
    gridMaterial.transparent = true
    gridMaterial.opacity = 0.5
    this.grid.position.y = 0.001
    this.rig.add(this.grid)

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
        transparent: true,
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
          transparent: true,
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
          transparent: true,
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
    this.renderer.setSize(width, height, false)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
  }

  private animate = () => {
    if (this.disposed) return
    this.raf = requestAnimationFrame(this.animate)
    const elapsed = this.clock.getElapsedTime()
    this.controls.update()

    if (this.state !== 'ready') {
      this.placeholder.rotation.y = elapsed * 0.5
      const wire = this.placeholder.getObjectByName('placeholder-wire')
      if (wire) {
        wire.rotation.x = Math.sin(elapsed * 0.5) * 0.25
        wire.rotation.z = elapsed * 0.18
      }
    } else {
      this.modelGroup.position.y = Math.sin(elapsed * 1.05) * 0.016
    }

    if (this.revealActive) {
      const progress = clamp01((performance.now() - this.revealStart) / 1350)
      const eased = easeOutCubic(progress)
      this.modelGroup.scale.setScalar(0.9 + 0.1 * eased)
      if (this.splat) this.splat.opacity = eased
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
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }

  private clearModel() {
    if (this.splat) {
      this.modelGroup.remove(this.splat)
      this.splat.dispose()
      this.splat = null
    }
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
    mesh.opacity = 0
    this.splat = mesh
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
    root.traverse((child) => {
      const mesh = child as THREE.Mesh
      if (!mesh.isMesh) return
      const geometry = mesh.geometry as THREE.BufferGeometry
      triangles += (geometry.getIndex()?.count ?? geometry.getAttribute('position').count) / 3
      const source = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial
      const material = new THREE.MeshStandardMaterial({
        color: source?.color?.clone() ?? new THREE.Color(0xbfe6f7),
        map: source?.map ?? null,
        metalness: 0.12,
        roughness: 0.62,
        side: THREE.DoubleSide,
      })
      mesh.material = material
    })

    const box = new THREE.Box3().setFromObject(root)
    this.placeModel(root, box)
    this.modelGroup.add(root)

    return { kind: 'mesh', count: Math.round(triangles), bytes: buffer.byteLength }
  }

  /* ---------------------------------------------------------------- 状态与交互 */

  private setState(state: ViewerState) {
    this.state = state
    this.onStateChange?.(state)
  }

  setAutoRotate(enabled: boolean) {
    this.controls.autoRotate = enabled
  }

  setGridVisible(visible: boolean) {
    this.grid.visible = visible
    this.floor.visible = visible
  }

  /** 按包围球自动取景，保持 3/4 侧前方视角。 */
  resetView() {
    const target = new THREE.Vector3(0, Math.max(this.modelHeight * 0.52, 0.2), 0)
    const distance = Math.min(12, Math.max(3.2, this.modelRadius * 3.7))
    const direction = new THREE.Vector3(0.31, 0.18, 0.9).normalize()
    this.controls.target.copy(target)
    this.camera.position.copy(target).addScaledVector(direction, distance)
    this.controls.update()
  }

  /** 截图：先同步渲染一帧，再读画布，避免开启 preserveDrawingBuffer 拖慢渲染。 */
  screenshot(): string | null {
    try {
      this.renderer.render(this.scene, this.camera)
      return this.renderer.domElement.toDataURL('image/png')
    } catch {
      return null
    }
  }
}
