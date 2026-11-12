/**
 * 3D 建模分区的「组装台」渲染器。
 *
 * 视觉目标：钢铁侠实验室里的全息装配台 —— 中央悬浮模型、地面同心光环、
 * 垂直扫描光带、栅格与角标 HUD，模型可以自由旋转 / 缩放 / 平移。
 *
 * 技术要点：
 * - V2Fun 的 3D 产物实测是 **3D 高斯点云 PLY**（含 f_dc_0..2 / opacity / scale_*），
 *   不是三角面片，因此这里用自定义 ShaderMaterial 渲染为点精灵（点云雕塑）；
 * - 同时兼容常规 PLY 网格与 GLB / GLTF（自动走 MeshStandardMaterial）；
 * - 所有资源都经同源代理读取（见 assets.ts），避免 V2Fun OSS 无 CORS 的问题。
 */

import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { AssetError, detectModelFormat, fetchAssetBytes } from './assets'

const CYAN = 0x38bdf8
const CYAN_SOFT = 0x7dd3fc
const SH_C0 = 0.28209479177387814

export type ViewerStyle = 'natural' | 'holo'
export type ViewerState = 'idle' | 'loading' | 'ready' | 'error'

export interface ViewerStats {
  format: 'ply-splat' | 'ply-mesh' | 'glb' | 'gltf'
  points: number
  triangles: number
  bytes: number
}

export interface LoadResult {
  stats: ViewerStats
  source: 'proxy' | 'direct'
}

function sigmoid(value: number): number {
  return 1 / (1 + Math.exp(-value))
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
  private scanRing: THREE.Mesh
  private grid: THREE.GridHelper
  private floorRings: THREE.Object3D[] = []
  private raf = 0
  private clock = new THREE.Clock()
  private resizeObserver: ResizeObserver | null = null
  private disposed = false

  private state: ViewerState = 'idle'
  private pointSize = 1
  private style: ViewerStyle = 'natural'
  private autoRotate = true
  private gridVisible = true
  private meshMaterials: THREE.MeshStandardMaterial[] = []
  private splatMaterial: THREE.ShaderMaterial | null = null
  private glow = makeGlowTexture()

  private revealActive = false
  private revealStart = 0
  private revealDuration = 1.35
  private modelHeight = 2.2
  /** 归一化后模型的包围球半径，用于自动取景。 */
  private modelRadius = 1.4

  onStateChange: ((state: ViewerState) => void) | null = null
  onProgress: ((loaded: number, total: number) => void) | null = null

  constructor(container: HTMLElement) {
    this.container = container
    this.scene.fog = new THREE.FogExp2(0x05070d, 0.055)

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.renderer.setClearAlpha(0)
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.12
    this.renderer.domElement.className = 'hologram-canvas'
    this.renderer.domElement.style.width = '100%'
    this.renderer.domElement.style.height = '100%'
    this.renderer.domElement.style.display = 'block'
    this.renderer.domElement.style.touchAction = 'none'
    container.appendChild(this.renderer.domElement)

    this.camera = new THREE.PerspectiveCamera(42, 1, 0.01, 120)
    this.camera.position.set(1.55, 1.95, 4.55)

    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
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

    this.buildLights()
    this.buildStage()
    this.scene.add(this.rig)
    this.scene.add(this.modelGroup)
    this.scene.add(this.placeholder)
    this.buildPlaceholder()

    this.scanRing = this.createScanRing()
    this.rig.add(this.scanRing)
    this.scanRing.visible = false

    this.grid = new THREE.GridHelper(8, 32, 0x1f5f7c, 0x0d2634)
    const gridMaterial = this.grid.material as THREE.Material
    gridMaterial.transparent = true
    gridMaterial.opacity = 0.5
    this.grid.position.y = 0.001
    this.rig.add(this.grid)

    this.resize()
    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(container)
    this.animate()
  }

  /* ---------------------------------------------------------------- 场景搭建 */

  private buildLights() {
    this.scene.add(new THREE.HemisphereLight(0xbfe9ff, 0x0a111c, 1.15))

    const key = new THREE.DirectionalLight(0xffffff, 2.1)
    key.position.set(3.4, 5.2, 4.2)
    this.scene.add(key)

    const fill = new THREE.DirectionalLight(CYAN_SOFT, 2.4)
    fill.position.set(-4.2, 2.4, -3.4)
    this.scene.add(fill)

    const rim = new THREE.DirectionalLight(0x7c9cff, 1.4)
    rim.position.set(0, 2.2, -5)
    this.scene.add(rim)
  }

  private buildStage() {
    // 地面柔光
    const glow = new THREE.Mesh(
      new THREE.CircleGeometry(3.1, 64),
      new THREE.MeshBasicMaterial({
        map: this.glow,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    )
    glow.rotation.x = -Math.PI / 2
    glow.position.y = 0.004
    this.rig.add(glow)

    // 同心光环
    const radii = [0.85, 1.3, 1.75, 2.25, 2.85]
    radii.forEach((radius, index) => {
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
      this.rig.add(ring)
      this.floorRings.push(ring)
    })

    // 刻度辐条
    const spokes: number[] = []
    const inner = 1.32
    const outer = 2.9
    for (let i = 0; i < 48; i += 1) {
      const angle = (i / 48) * Math.PI * 2
      const length = i % 4 === 0 ? outer : outer - 0.22
      spokes.push(Math.cos(angle) * inner, 0, Math.sin(angle) * inner)
      spokes.push(Math.cos(angle) * length, 0, Math.sin(angle) * length)
    }
    const spokeGeometry = new THREE.BufferGeometry()
    spokeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(spokes, 3))
    const spokeLines = new THREE.LineSegments(
      spokeGeometry,
      new THREE.LineBasicMaterial({
        color: 0x2a7a9c,
        transparent: true,
        opacity: 0.4,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    )
    this.rig.add(spokeLines)
  }

  private createScanRing(): THREE.Mesh {
    const ring = new THREE.Mesh(
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
    ring.rotation.x = -Math.PI / 2
    ring.position.y = 0.02
    return ring
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
      new THREE.MeshBasicMaterial({
        color: 0x9fe8ff,
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    )
    core.position.y = 1.15
    core.name = 'placeholder-core'
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
      torus.name = `placeholder-ring-${i}`
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
    if (this.splatMaterial) {
      const proj = (height * 0.5) / Math.tan((this.camera.fov * Math.PI) / 360)
      this.splatMaterial.uniforms.uProj.value = proj
    }
  }

  private animate = () => {
    if (this.disposed) return
    this.raf = requestAnimationFrame(this.animate)
    const delta = Math.min(this.clock.getDelta(), 0.05)
    const elapsed = this.clock.elapsedTime

    this.controls.update()

    if (this.state !== 'ready') {
      this.placeholder.rotation.y += delta * 0.5
      this.placeholder.position.y = Math.sin(elapsed * 1.2) * 0.04
      const wire = this.placeholder.getObjectByName('placeholder-wire')
      if (wire) {
        wire.rotation.x = Math.sin(elapsed * 0.5) * 0.25
        wire.rotation.z = elapsed * 0.18
      }
    }

    if (this.state === 'ready') {
      this.modelGroup.position.y = Math.sin(elapsed * 1.05) * 0.016
    }

    if (this.revealActive && this.splatMaterial) {
      const progress = clamp01((performance.now() - this.revealStart) / (this.revealDuration * 1000))
      const eased = easeOutCubic(progress)
      this.splatMaterial.uniforms.uReveal.value = eased
      this.scanRing.visible = true
      this.scanRing.position.y = 0.02 + eased * this.modelHeight
      ;(this.scanRing.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - eased * 0.55)
      if (progress >= 1) {
        this.revealActive = false
        this.scanRing.visible = false
      }
    }

    if (this.gridVisible) {
      this.grid.visible = true
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
    this.scene.traverse((object) => {
      const mesh = object as THREE.Mesh
      if (mesh.geometry) mesh.geometry.dispose()
      const material = mesh.material as THREE.Material | THREE.Material[] | undefined
      if (Array.isArray(material)) material.forEach((item) => item.dispose())
      else material?.dispose()
    })
    this.glow.dispose()
    this.renderer.dispose()
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement)
    }
  }

  private clearModel() {
    this.modelGroup.clear()
    this.meshMaterials = []
    this.splatMaterial = null
  }

  /* ---------------------------------------------------------------- 模型加载 */

  async loadFromUrl(rawUrl: string): Promise<LoadResult> {
    this.setState('loading')
    this.placeholder.visible = true
    this.clearModel()
    this.scanRing.visible = false
    this.revealActive = false

    const asset = await fetchAssetBytes(rawUrl, (loaded, total) => this.onProgress?.(loaded, total))
    const format = detectModelFormat(asset.buffer, rawUrl)

    let result: LoadResult
    if (format === 'ply') {
      result = this.loadPly(asset.buffer, asset.source)
    } else if (format === 'glb' || format === 'gltf') {
      result = await this.loadGltf(asset.buffer, format, asset.source)
    } else {
      throw new AssetError('无法识别的 3D 文件格式', 'format')
    }

    this.placeholder.visible = false
    this.setState('ready')
    this.resetView()
    this.startReveal()
    return result
  }

  /**
   * 把模型缩放到台面上。
   *
   * 之前按「高度 = 2.2」归一化，遇到长条形 / 扁平物体（例如相机、沙发）
   * 横向会被放大到出画；改为按最长边归一化，再按包围球半径自动取景。
   */
  private normalizeObject(object: THREE.Object3D, targetSize = 2.05) {
    const box = new THREE.Box3().setFromObject(object)
    const size = new THREE.Vector3()
    box.getSize(size)

    const maxExtent = Math.max(size.x, size.y, size.z, 1e-4)
    const scale = targetSize / maxExtent
    object.scale.multiplyScalar(scale)

    // 重新计算包围盒，把模型落到台面中心
    const nextBox = new THREE.Box3().setFromObject(object)
    const nextSize = new THREE.Vector3()
    const nextCenter = new THREE.Vector3()
    nextBox.getSize(nextSize)
    nextBox.getCenter(nextCenter)
    object.position.x -= nextCenter.x
    object.position.z -= nextCenter.z
    object.position.y -= nextBox.min.y

    this.modelHeight = nextSize.y
    this.modelRadius = 0.5 * Math.hypot(nextSize.x, nextSize.y, nextSize.z)

    return { scale, box: nextBox }
  }

  private loadPly(buffer: ArrayBuffer, source: 'proxy' | 'direct'): LoadResult {
    const loader = new PLYLoader()
    // V2Fun 的 splat 用自定义属性存颜色 / 不透明度 / 尺度，PLYLoader 默认会丢掉它们。
    loader.setCustomPropertyNameMapping({
      fDc: ['f_dc_0', 'f_dc_1', 'f_dc_2'],
      fOpacity: ['opacity'],
      fScale: ['scale_0', 'scale_1', 'scale_2'],
    })
    const geometry = loader.parse(buffer)
    geometry.computeBoundingBox()

    const position = geometry.getAttribute('position') as THREE.BufferAttribute | undefined
    if (!position) throw new AssetError('PLY 文件缺少顶点数据', 'format')

    const colorAttr = geometry.getAttribute('color') as THREE.BufferAttribute | undefined
    const index = geometry.getIndex()

    // 无面索引 = 点云 / 高斯点云（V2Fun 的默认产物），走点精灵渲染。
    if (!index) {
      return this.buildSplat(geometry, buffer.byteLength, source)
    }

    // 常规三角网格 PLY
    if (!geometry.getAttribute('normal')) geometry.computeVertexNormals()
    const hasColor = Boolean(colorAttr)
    const material = new THREE.MeshStandardMaterial({
      color: hasColor ? 0xffffff : 0xbfe6f7,
      vertexColors: hasColor,
      metalness: 0.18,
      roughness: 0.55,
      side: THREE.DoubleSide,
    })
    this.meshMaterials = [material]
    const mesh = new THREE.Mesh(geometry, material)
    // V2Fun 的几何体是 Y 轴朝下、正面朝 +X；绕 (1,0,1) 旋转 180° 摆正。
    mesh.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 1).normalize(), Math.PI)
    this.modelGroup.add(mesh)
    this.normalizeObject(mesh)

    const triangles = index ? index.count / 3 : position.count / 3
    return {
      stats: { format: 'ply-mesh', points: position.count, triangles: Math.round(triangles), bytes: buffer.byteLength },
      source,
    }
  }

  private buildSplat(geometry: THREE.BufferGeometry, bytes: number, source: 'proxy' | 'direct'): LoadResult {
    const position = geometry.getAttribute('position') as THREE.BufferAttribute
    const count = position.count
    const dc = geometry.getAttribute('fDc') as THREE.BufferAttribute | undefined
    const colorAttr = geometry.getAttribute('color') as THREE.BufferAttribute | undefined
    const opacityAttr = geometry.getAttribute('fOpacity') as THREE.BufferAttribute | undefined
    const splatScale = geometry.getAttribute('fScale') as THREE.BufferAttribute | undefined

    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 4)
    const sizes = new Float32Array(count)

    /*
     * V2Fun 的 splat 采用「Y 轴朝下、正面朝 +X」的相机坐标系（实测 3 个任务一致）。
     * 这里一次性转成 three 的 Y-up 世界坐标：
     *   x' = z, y' = -y, z' = x   （等价于绕 (1,0,1) 轴旋转 180°）
     * 直接写入最终坐标，避免给 Points 加旋转后 gl_PointSize 不跟随缩放的问题。
     */
    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity
    let minZ = Infinity
    let maxZ = -Infinity
    for (let i = 0; i < count; i += 1) {
      const x = position.getZ(i)
      const y = -position.getY(i)
      const z = position.getX(i)
      positions[i * 3] = x
      positions[i * 3 + 1] = y
      positions[i * 3 + 2] = z
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
      if (z < minZ) minZ = z
      if (z > maxZ) maxZ = z

      if (colorAttr && !dc) {
        colors[i * 4] = colorAttr.getX(i)
        colors[i * 4 + 1] = colorAttr.getY(i)
        colors[i * 4 + 2] = colorAttr.getZ(i)
        colors[i * 4 + 3] = 1
      } else if (dc) {
        colors[i * 4] = clamp01(0.5 + SH_C0 * dc.getX(i))
        colors[i * 4 + 1] = clamp01(0.5 + SH_C0 * dc.getY(i))
        colors[i * 4 + 2] = clamp01(0.5 + SH_C0 * dc.getZ(i))
        colors[i * 4 + 3] = opacityAttr ? sigmoid(opacityAttr.getX(i)) : 1
      } else {
        colors[i * 4] = 0.72
        colors[i * 4 + 1] = 0.9
        colors[i * 4 + 2] = 1
        colors[i * 4 + 3] = 1
      }

      const baseSize = splatScale
        ? Math.exp((splatScale.getX(i) + splatScale.getY(i) + splatScale.getZ(i)) / 3)
        : 0.012
      sizes[i] = baseSize
    }

    // 按最长边归一化（与 normalizeObject 一致），并同步缩放点大小，保证视觉比例一致。
    const rawHeight = Math.max(maxY - minY, 1e-4)
    const rawWidth = maxX - minX
    const rawDepth = maxZ - minZ
    const scale = 2.05 / Math.max(rawWidth, rawHeight, rawDepth, 1e-4)
    const midX = (minX + maxX) / 2
    const midZ = (minZ + maxZ) / 2

    for (let i = 0; i < count; i += 1) {
      positions[i * 3] = (positions[i * 3] - midX) * scale
      positions[i * 3 + 1] = (positions[i * 3 + 1] - minY) * scale
      positions[i * 3 + 2] = (positions[i * 3 + 2] - midZ) * scale
      // 高斯半径通常远小于点间距，放大后取一个下限，避免点稀疏像噪点。
      sizes[i] = Math.max(0.0036, Math.min(0.06, sizes[i] * scale * 3))
    }
    this.modelHeight = rawHeight * scale
    this.modelRadius = 0.5 * Math.hypot(rawWidth, rawHeight, rawDepth) * scale

    const splatGeometry = new THREE.BufferGeometry()
    splatGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    splatGeometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 4))
    splatGeometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uProj: {
          value:
            (Math.max(this.container.clientHeight, 320) * 0.5) / Math.tan((this.camera.fov * Math.PI) / 360),
        },
        uSize: { value: this.pointSize },
        uAlpha: { value: this.style === 'holo' ? 0.1 : 0.6 },
        uReveal: { value: 1 },
        uHolo: { value: this.style === 'holo' ? 1 : 0 },
        uHeight: { value: this.modelHeight },
        uSharp: { value: this.style === 'holo' ? 0.75 : 1 },
      },
      vertexShader: /* glsl */ `
        attribute vec4 aColor;
        attribute float aSize;
        uniform float uProj;
        uniform float uSize;
        uniform float uAlpha;
        uniform float uReveal;
        uniform float uHeight;
        varying vec4 vColor;
        varying float vAlpha;
        void main() {
          vColor = aColor;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          float visible = step(position.y / uHeight, uReveal);
          vAlpha = aColor.a * uAlpha * visible;
          // 2.2 为画布上的经验放大系数：高斯半径远小于点间距，直接按半径画会碎成噪点。
          float size = aSize * uProj * uSize * 2.2 / max(-mvPosition.z, 0.001);
          gl_PointSize = clamp(size, 1.0, 48.0);
          gl_Position = projectionMatrix * mvPosition;
          if (vAlpha < 0.004) {
            gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
          }
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uHolo;
        uniform float uSharp;
        varying vec4 vColor;
        varying float vAlpha;
        void main() {
          vec2 coord = gl_PointCoord - 0.5;
          float dist = dot(coord, coord);
          if (dist > 0.25) discard;
          // uSharp=0 高斯软边（体积感），uSharp=1 硬边小圆点（表面更实、雾感更少）
          float soft = smoothstep(0.25, mix(0.02, 0.215, uSharp), dist);
          vec3 natural = vColor.rgb;
          vec3 holo = mix(vec3(0.24, 0.85, 1.0), vColor.rgb, 0.45);
          vec3 color = mix(natural, holo, uHolo);
          gl_FragColor = vec4(color, vAlpha * soft);
        }
      `,
      transparent: true,
      // 点云没有前后排序，写深度会把「先画的点」当成最前面，出现麻点；
      // 用纯 alpha 混合叠加反而更接近官方预览里的实体表面。
      depthWrite: false,
      depthTest: true,
      blending: this.style === 'holo' ? THREE.AdditiveBlending : THREE.NormalBlending,
    })

    this.splatMaterial = material
    const points = new THREE.Points(splatGeometry, material)
    points.frustumCulled = true
    this.modelGroup.add(points)
    geometry.dispose()

    return {
      stats: { format: 'ply-splat', points: count, triangles: 0, bytes },
      source,
    }
  }

  private async loadGltf(buffer: ArrayBuffer, format: 'glb' | 'gltf', source: 'proxy' | 'direct'): Promise<LoadResult> {
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
    const materials: THREE.MeshStandardMaterial[] = []
    root.traverse((child) => {
      const mesh = child as THREE.Mesh
      if (!mesh.isMesh) return
      const geometry = mesh.geometry as THREE.BufferGeometry
      triangles += geometry.getIndex() ? (geometry.getIndex() as THREE.BufferAttribute).count / 3 : geometry.getAttribute('position').count / 3
      const original = mesh.material as THREE.Material | THREE.Material[]
      const list = Array.isArray(original) ? original : [original]
      const mapped = list.map((item) => {
        const material = new THREE.MeshStandardMaterial({
          color: (item as THREE.MeshStandardMaterial).color?.clone() ?? new THREE.Color(0xbfe6f7),
          map: (item as THREE.MeshStandardMaterial).map ?? null,
          metalness: 0.12,
          roughness: 0.62,
          side: THREE.DoubleSide,
          transparent: (item as THREE.MeshStandardMaterial).transparent ?? false,
        })
        materials.push(material)
        return material
      })
      mesh.material = mapped.length === 1 ? mapped[0] : mapped
    })
    this.meshMaterials = materials

    this.modelGroup.add(root)
    this.normalizeObject(root)

    return {
      stats: { format, points: 0, triangles: Math.round(triangles), bytes: buffer.byteLength },
      source,
    }
  }

  /* ---------------------------------------------------------------- 状态与交互 */

  private setState(state: ViewerState) {
    this.state = state
    this.onStateChange?.(state)
  }

  private startReveal() {
    this.revealStart = performance.now()
    this.revealActive = true
    if (this.splatMaterial) {
      this.splatMaterial.uniforms.uReveal.value = 0
    } else {
      // 网格模型：用缩放做「装配落地」动画
      this.modelGroup.scale.setScalar(0.82)
      const started = performance.now()
      const tick = () => {
        if (this.disposed) return
        const p = clamp01((performance.now() - started) / 900)
        this.modelGroup.scale.setScalar(0.82 + 0.18 * easeOutCubic(p))
        if (p < 1) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    }
  }

  setPointSize(size: number) {
    this.pointSize = size
    if (this.splatMaterial) this.splatMaterial.uniforms.uSize.value = size
  }

  setStyle(style: ViewerStyle) {
    this.style = style
    if (this.splatMaterial) {
      this.splatMaterial.uniforms.uHolo.value = style === 'holo' ? 1 : 0
      this.splatMaterial.uniforms.uAlpha.value = style === 'holo' ? 0.1 : 0.6
      this.splatMaterial.uniforms.uSharp.value = style === 'holo' ? 0.75 : 1
      this.splatMaterial.blending = style === 'holo' ? THREE.AdditiveBlending : THREE.NormalBlending
      this.splatMaterial.needsUpdate = true
    }
    this.meshMaterials.forEach((material) => {
      material.color.set(style === 'holo' ? 0x7fe4ff : 0xd9f2ff)
      material.wireframe = false
      material.emissive = new THREE.Color(style === 'holo' ? 0x1b6f88 : 0x000000)
      material.needsUpdate = true
    })
  }

  setWireframe(enabled: boolean) {
    this.meshMaterials.forEach((material) => {
      material.wireframe = enabled
      material.needsUpdate = true
    })
  }

  setAutoRotate(enabled: boolean) {
    this.autoRotate = enabled
    this.controls.autoRotate = enabled
  }

  setGridVisible(visible: boolean) {
    this.gridVisible = visible
    this.grid.visible = visible
    this.floorRings.forEach((ring) => (ring.visible = visible))
  }

  /** 按当前模型的包围球自动取景，保持 3/4 侧前方视角。 */
  resetView() {
    const target = new THREE.Vector3(0, Math.max(this.modelHeight * 0.52, 0.2), 0)
    const distance = Math.min(12, Math.max(3.2, this.modelRadius * 3.7))
    const direction = new THREE.Vector3(0.31, 0.18, 0.9).normalize()
    this.controls.target.copy(target)
    this.camera.position.copy(target).addScaledVector(direction, distance)
    this.controls.update()
  }

  screenshot(): string | null {
    try {
      return this.renderer.domElement.toDataURL('image/png')
    } catch {
      return null
    }
  }

  getState(): ViewerState {
    return this.state
  }

  getAutoRotate(): boolean {
    return this.autoRotate
  }

  getStyle(): ViewerStyle {
    return this.style
  }
}
