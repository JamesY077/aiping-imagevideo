<template>
  <div class="studio-page model3d-page" :style="{ '--studio-accent': '#38bdf8' }">
    <StudioIsland />

    <StudioHeader
      kicker="3D Studio"
      title="3D 建模"
      subtitle="V2Fun 三维重建：文生 3D、图生 3D、多视角 3D，以及视频动作捕捉"
      accent="#38bdf8"
    >
      <template #actions>
        <span class="studio-chip">{{ model.displayName }}</span>
        <span class="studio-chip chip-live">
          <span class="live-dot" aria-hidden="true" />
          组装台在线
        </span>
      </template>
    </StudioHeader>

    <main class="model3d-main">
      <!-- ============================ 左栏：模型 / 输入 / 参数 ============================ -->
      <aside class="model3d-rail model3d-rail--left studio-scroll">
        <!-- ---------- 模型 ---------- -->
        <section class="studio-panel rail-panel">
          <header class="studio-panel-head">
            <div class="studio-panel-headings">
              <span class="studio-kicker">Model · 01</span>
              <h2 class="studio-panel-title">选择建模引擎</h2>
            </div>
            <span class="studio-panel-meta">{{ MODEL3D_OPTIONS.length }} 个模型</span>
          </header>

          <div class="model-grid">
            <button
              v-for="option in MODEL3D_OPTIONS"
              :key="option.id"
              class="model-card"
              :class="{ active: option.id === modelId, motion: option.kind === 'motion' }"
              type="button"
              :aria-pressed="option.id === modelId"
              @click="selectModel(option)"
            >
              <span class="model-card-top">
                <span class="model-glyph" aria-hidden="true">
                  <svg v-if="option.kind === 'mesh'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round">
                    <path d="M12 2.8 20.2 7v10L12 21.2 3.8 17V7z" />
                    <path d="M3.8 7 12 11.3 20.2 7M12 11.3v9.9" opacity=".55" />
                  </svg>
                  <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="2.8" y="5.4" width="11.4" height="13.2" rx="2.4" />
                    <path d="M14.2 10.4 21 7.2v9.6l-6.8-3.2z" />
                  </svg>
                </span>
                <span class="model-badge">{{ option.badge }}</span>
              </span>
              <span class="model-name">{{ option.shortName }}</span>
              <span class="model-desc">{{ option.description }}</span>
              <span class="model-foot">
                <span class="model-price">{{ option.price }}</span>
                <span class="model-tags">
                  <em v-for="tag in option.tags.slice(0, 2)" :key="tag">{{ tag }}</em>
                </span>
              </span>
            </button>
          </div>
        </section>

        <!-- ---------- 输入 ---------- -->
        <section class="studio-panel rail-panel">
          <header class="studio-panel-head">
            <div class="studio-panel-headings">
              <span class="studio-kicker">Input · 02</span>
              <h2 class="studio-panel-title">{{ isMotion ? '视频动捕素材' : '建模输入' }}</h2>
            </div>
            <span class="studio-panel-meta">{{ isMotion ? '视频 · 片段' : '文本 · 图片' }}</span>
          </header>

          <!-- 3D 建模输入 -->
          <div v-if="!isMotion" class="panel-body">
            <div class="segmented" role="tablist" aria-label="输入方式">
              <button
                v-for="tab in MESH_MODES"
                :key="tab.value"
                class="segmented-item"
                :class="{ active: meshMode === tab.value }"
                type="button"
                role="tab"
                :aria-selected="meshMode === tab.value"
                @click="meshMode = tab.value"
              >
                {{ tab.label }}
              </button>
            </div>

            <!-- 文本 -->
            <div v-if="meshMode === 'text'" class="input-block">
              <textarea
                v-model="prompt"
                class="studio-field prompt-input"
                maxlength="2000"
                placeholder="描述要建模的物体：单体、结构清晰、材质明确。例如：一位宇航员，全身站立，双手自然下垂，白色宇航服细节清晰。"
                spellcheck="false"
                @keydown.meta.enter.prevent="submit"
                @keydown.ctrl.enter.prevent="submit"
              />
              <div class="field-meta">
                <span>{{ prompt.length }} / 2000</span>
                <span class="field-hint">⌘ / Ctrl + ↵ 直接生成</span>
              </div>

              <div class="preset-block">
                <div class="preset-head">
                  <span>灵感预设</span>
                  <span class="preset-hint">点击填入</span>
                </div>
                <div class="preset-chips">
                  <button v-for="preset in MESH_PROMPT_PRESETS" :key="preset.label" class="preset-chip" type="button" @click="prompt = preset.prompt">
                    {{ preset.label }}
                  </button>
                </div>
              </div>
            </div>

            <!-- 单图 -->
            <div v-else-if="meshMode === 'image'" class="input-block">
              <div
                class="dropzone"
                :class="{ filled: singleImage }"
                role="button"
                tabindex="0"
                @click="chooseImage('single')"
                @keydown.enter.prevent="chooseImage('single')"
                @keydown.space.prevent="chooseImage('single')"
                @dragover.prevent
                @drop.prevent="dropImage($event, 'single')"
              >
                <template v-if="singleImage">
                  <img class="dropzone-thumb" :src="singleImage.dataUrl" alt="参考图预览" />
                  <div class="dropzone-overlay">
                    <span>{{ singleImage.name }}</span>
                    <span>{{ singleImage.width }} × {{ singleImage.height }}</span>
                  </div>
                  <button class="thumb-clear" type="button" aria-label="移除图片" @click.stop="singleImage = null">×</button>
                </template>
                <template v-else>
                  <span class="dropzone-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                      <rect x="3" y="4.5" width="18" height="15" rx="3" />
                      <path d="M3.6 16.4 8.8 11l3.4 3.6 2.5-2.4 5.7 5.6" />
                      <circle cx="8.4" cy="9" r="1.5" />
                    </svg>
                  </span>
                  <span class="dropzone-title">上传一张参考图</span>
                  <span class="dropzone-sub">点击或拖拽 · PNG / JPG / WebP</span>
                </template>
              </div>
              <p class="field-hint">建议单一主体、背景干净、主体完整不裁切。</p>
            </div>

            <!-- 多视角 -->
            <div v-else class="input-block">
              <div class="view-grid">
                <div
                  v-for="slot in MULTI_VIEW_SLOTS"
                  :key="slot.key"
                  class="view-slot"
                  :class="{ filled: views[slot.key], required: slot.required }"
                  role="button"
                  tabindex="0"
                  @click="chooseImage(slot.key)"
                  @keydown.enter.prevent="chooseImage(slot.key)"
                  @keydown.space.prevent="chooseImage(slot.key)"
                  @dragover.prevent
                  @drop.prevent="dropImage($event, slot.key)"
                >
                  <template v-if="views[slot.key]">
                    <img :src="views[slot.key]?.dataUrl" :alt="slot.label" />
                    <button class="thumb-clear" type="button" aria-label="移除图片" @click.stop="views[slot.key] = null">×</button>
                  </template>
                  <template v-else>
                    <span class="view-slot-label">{{ slot.label }}</span>
                    <span class="view-slot-hint">{{ slot.hint }}</span>
                  </template>
                </div>
              </div>
              <p class="field-hint">正视图必填，补全左 / 背 / 右视图可以显著提升还原度。</p>
            </div>
          </div>

          <!-- 视频动捕输入 -->
          <div v-else class="panel-body">
            <div class="segmented" role="tablist" aria-label="视频来源">
              <button class="segmented-item" :class="{ active: videoSource === 'url' }" type="button" @click="videoSource = 'url'">视频地址</button>
              <button class="segmented-item" :class="{ active: videoSource === 'file' }" type="button" @click="videoSource = 'file'">本地上传</button>
            </div>

            <div v-if="videoSource === 'url'" class="input-block">
              <input v-model.trim="videoUrl" class="studio-field text-field" type="url" placeholder="https://... .mp4（服务商可访问的公网地址）" spellcheck="false" />
            </div>

            <div v-else class="input-block">
              <div
                class="dropzone dropzone--video"
                :class="{ filled: videoFile }"
                role="button"
                tabindex="0"
                @click="videoInputRef?.click()"
                @keydown.enter.prevent="videoInputRef?.click()"
                @keydown.space.prevent="videoInputRef?.click()"
                @dragover.prevent
                @drop.prevent="dropVideo($event)"
              >
                <template v-if="videoFile">
                  <span class="video-file-icon" aria-hidden="true">▣</span>
                  <span class="dropzone-title">{{ videoFile.name }}</span>
                  <span class="dropzone-sub">
                    {{ formatBytes(videoFile.size) }}
                    <template v-if="videoMeta?.duration"> · {{ videoMeta.duration.toFixed(1) }}s</template>
                  </span>
                  <button class="thumb-clear" type="button" aria-label="移除视频" @click.stop="clearVideo">×</button>
                </template>
                <template v-else>
                  <span class="dropzone-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                      <rect x="2.8" y="5.4" width="11.4" height="13.2" rx="2.4" />
                      <path d="M14.2 10.4 21 7.2v9.6l-6.8-3.2z" />
                    </svg>
                  </span>
                  <span class="dropzone-title">上传一段人物视频</span>
                  <span class="dropzone-sub">MP4 / MOV / WebM · 建议 ≤ 50MB · 单人全身入镜</span>
                </template>
              </div>
            </div>

            <div class="time-block">
              <div class="time-row">
                <label class="time-field">
                  <span>起始时间</span>
                  <div class="time-input">
                    <input v-model.number="startSeconds" type="number" min="0" :max="maxStart" step="0.5" />
                    <em>s</em>
                  </div>
                </label>
                <label class="time-field">
                  <span>片段时长</span>
                  <div class="time-input">
                    <input v-model.number="durationSeconds" type="number" :min="MOTION_DURATION_LIMITS.min" :max="maxDuration" step="1" />
                    <em>s</em>
                  </div>
                </label>
              </div>
              <input
                class="time-range"
                type="range"
                :min="0"
                :max="Math.max(0, maxStart)"
                step="0.1"
                :value="startSeconds"
                @input="onSeek(($event.target as HTMLInputElement).value)"
              />
              <div class="time-meta">
                <span>{{ videoDurationLabel }}</span>
                <span>{{ motionUnits }} 个计费单位（3 秒/单位）</span>
              </div>
            </div>

            <p class="field-hint">动捕会在指定片段内追踪人物并输出 BVH 动作数据；多人入镜时按检测顺序输出多份。</p>
          </div>
        </section>

        <!-- ---------- 参数 ---------- -->
        <section class="studio-panel rail-panel">
          <header class="studio-panel-head">
            <div class="studio-panel-headings">
              <span class="studio-kicker">Params · 03</span>
              <h2 class="studio-panel-title">生成参数</h2>
            </div>
            <span class="studio-panel-meta">异步任务</span>
          </header>

          <div class="panel-body">
            <template v-if="!isMotion">
              <label class="switch-row">
                <span class="switch-copy">
                  <span class="switch-title">生成纹理</span>
                  <span class="switch-sub">输出带颜色的模型（with_texture）</span>
                </span>
                <input v-model="withTexture" type="checkbox" />
                <span class="switch-track" aria-hidden="true"><span class="switch-thumb" /></span>
              </label>

              <label class="switch-row" :class="{ disabled: !withTexture }">
                <span class="switch-copy">
                  <span class="switch-title">高清纹理</span>
                  <span class="switch-sub">提高纹理分辨率（hd_texture）</span>
                </span>
                <input v-model="hdTexture" type="checkbox" :disabled="!withTexture" />
                <span class="switch-track" aria-hidden="true"><span class="switch-thumb" /></span>
              </label>

              <label class="switch-row" :class="{ disabled: !withTexture }">
                <span class="switch-copy">
                  <span class="switch-title">PBR 材质</span>
                  <span class="switch-sub">输出粗糙度 / 金属度贴图（pbr_texture）</span>
                </span>
                <input v-model="pbrTexture" type="checkbox" :disabled="!withTexture" />
                <span class="switch-track" aria-hidden="true"><span class="switch-thumb" /></span>
              </label>
            </template>

            <div v-else class="billing-card">
              <div class="billing-row">
                <span>计费单价</span>
                <strong>{{ model.price }}</strong>
              </div>
              <div class="billing-row">
                <span>本次预估</span>
                <strong>{{ motionEstimate }}</strong>
              </div>
              <p class="billing-note">按实际处理秒数向上取整到 3 秒一档，最终以平台账单为准。</p>
            </div>

            <div class="param-row">
              <div class="param-label">
                <span>任务优先级</span>
                <em>{{ priority || '默认' }}</em>
              </div>
              <input v-model.number="priority" class="time-range" type="range" min="0" max="255" step="1" />
              <p class="field-hint">0–255，数值越大排队越靠前。</p>
            </div>
          </div>
        </section>

        <div class="rail-actions">
          <button class="build-btn" type="button" :disabled="!canSubmit || isSubmitting" @click="submit">
            <span class="build-btn-glow" aria-hidden="true" />
            <span class="build-btn-label">
              <svg v-if="isMotion" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M4 18.5V6.2M20 18.5V6.2M4 12h16" />
                <circle cx="8.4" cy="8.2" r="2" />
                <circle cx="15.6" cy="15.6" r="2" />
              </svg>
              <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" aria-hidden="true">
                <path d="M12 2.8 20.2 7v10L12 21.2 3.8 17V7z" />
                <path d="M12 8.2 16 10.4v4.2L12 16.8 8 14.6v-4.2z" />
              </svg>
              {{ submitLabel }}
            </span>
          </button>
          <p v-if="submitHint" class="build-hint">{{ submitHint }}</p>
        </div>
      </aside>

      <!-- ============================ 中央：全息组装台 ============================ -->
      <section class="stage-column">
        <div ref="stageShellRef" class="stage-shell" :class="[`phase-${taskPhase}`, { 'is-video': showVideoStage }]">
          <div class="stage-topbar">
            <div class="stage-ident">
              <span class="stage-dot" :class="`dot-${taskPhase}`" aria-hidden="true" />
              <span class="stage-ident-model">{{ model.shortName }}</span>
              <span class="stage-ident-divider" aria-hidden="true" />
              <span class="stage-ident-mode">{{ isMotion ? 'MOTION CAPTURE' : meshMode === 'text' ? 'TEXT → 3D' : meshMode === 'image' ? 'IMAGE → 3D' : 'MULTI-VIEW → 3D' }}</span>
              <span class="stage-ident-status">{{ stageStatusText }}</span>
            </div>
            <div class="stage-actions">
              <button class="stage-action" type="button" :disabled="!viewerReady" title="重置视角" @click="resetView">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M4 11a8 8 0 1 1 2.6 5.9" />
                  <path d="M4 5.5V11h5.4" />
                </svg>
              </button>
              <button class="stage-action" type="button" :disabled="!viewerReady" title="保存截图" @click="takeScreenshot">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M4 8.3h3.2L9 5.6h6l1.8 2.7H20v10.1H4z" />
                  <circle cx="12" cy="13.2" r="3.1" />
                </svg>
              </button>
              <button class="stage-action" type="button" title="全屏查看" @click="toggleFullscreen">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
                </svg>
              </button>
            </div>
          </div>

          <div class="stage-viewport">
            <!-- Three.js 画布 -->
            <div ref="stageRef" class="stage-canvas" v-show="!showVideoStage" />

            <!-- 预览视频（动捕 / 无 CORS 时的兜底） -->
            <div v-if="showVideoStage" class="stage-video-wrap">
              <video
                ref="stageVideoRef"
                class="stage-video"
                :src="stageVideoSrc"
                controls
                autoplay
                loop
                muted
                playsinline
              />
              <div class="stage-video-tag">
                <span class="live-dot" aria-hidden="true" />
                {{ isMotion ? 'MOTION PREVIEW' : 'OFFICIAL PREVIEW' }}
              </div>
            </div>

            <!-- HUD 装饰 -->
            <div class="hud" aria-hidden="true">
              <span class="hud-corner hud-corner--tl" />
              <span class="hud-corner hud-corner--tr" />
              <span class="hud-corner hud-corner--bl" />
              <span class="hud-corner hud-corner--br" />
              <span class="hud-scan" />
              <span class="hud-line hud-line--h" />
              <span class="hud-line hud-line--v" />
              <span class="hud-ticks hud-ticks--left" />
              <span class="hud-ticks hud-ticks--right" />
            </div>

            <!-- 空闲态提示 -->
            <div v-if="!showVideoStage && viewerState === 'idle'" class="stage-idle">
              <span class="idle-title">装配台待命</span>
              <span class="idle-sub">左侧选择模型并提交描述，生成的模型会在这里逐层显影</span>
            </div>

            <!-- 加载态 -->
            <div v-if="!showVideoStage && viewerState === 'loading'" class="stage-loading">
              <span class="loading-ring" aria-hidden="true" />
              <span class="loading-title">正在装配模型</span>
              <span class="loading-sub">{{ loadLabel }}</span>
              <div class="loading-bar"><span :style="{ width: `${loadProgressPercent}%` }" /></div>
            </div>

            <!-- 失败 / 兜底提示 -->
            <div v-if="stageNotice" class="stage-notice" :class="{ error: stageNoticeTone === 'error' }">
              <span class="notice-icon" aria-hidden="true">!</span>
              <div class="notice-copy">
                <span>{{ stageNotice }}</span>
                <button v-if="canRetryModel" class="notice-action" type="button" @click="retryLoadModel">重试加载模型</button>
              </div>
            </div>

            <!-- 左下角读数 -->
            <div class="hud-readout hud-readout--left">
              <span class="readout-key">FORMAT</span>
              <span class="readout-value">{{ statsLabel }}</span>
              <span class="readout-key">SIZE</span>
              <span class="readout-value">{{ stats ? formatBytes(stats.bytes) : '—' }}</span>
            </div>
            <div class="hud-readout hud-readout--right">
              <span class="readout-key">FPS</span>
              <span class="readout-value">{{ fpsLabel }}</span>
              <span class="readout-key">PROXY</span>
              <span class="readout-value">{{ assetSourceLabel }}</span>
            </div>
          </div>

          <div class="stage-toolbar">
            <div class="tool-group">
              <button class="tool-chip" :class="{ active: holoStyle === 'natural' }" type="button" :disabled="!viewerReady" @click="setStyle('natural')">材质</button>
              <button class="tool-chip" :class="{ active: holoStyle === 'holo' }" type="button" :disabled="!viewerReady" @click="setStyle('holo')">全息</button>
            </div>

            <div class="tool-slider">
              <span>点径</span>
              <input v-model.number="pointSize" type="range" min="0.3" max="2.6" step="0.05" :disabled="!viewerReady" @input="applyPointSize" />
              <em>{{ pointSize.toFixed(2) }}×</em>
            </div>

            <div class="tool-group tool-group--end">
              <button class="tool-chip" :class="{ active: autoRotate }" type="button" :disabled="!viewerReady" @click="toggleAutoRotate">
                <span class="chip-dot" aria-hidden="true" />自动旋转
              </button>
              <button class="tool-chip" :class="{ active: showGrid }" type="button" :disabled="!viewerReady" @click="toggleGrid">栅格</button>
            </div>
          </div>
        </div>

        <div class="stage-steps">
          <div v-for="step in assemblySteps" :key="step.key" class="stage-step" :class="{ active: step.active, done: step.done }">
            <span class="step-index">{{ step.index }}</span>
            <span class="step-copy">
              <strong>{{ step.title }}</strong>
              <em>{{ step.sub }}</em>
            </span>
          </div>
        </div>
      </section>

      <!-- ============================ 右栏：任务 / 产物 / 历史 ============================ -->
      <aside class="model3d-rail model3d-rail--right studio-scroll">
        <section class="studio-panel rail-panel">
          <header class="studio-panel-head">
            <div class="studio-panel-headings">
              <span class="studio-kicker">Task · 04</span>
              <h2 class="studio-panel-title">任务状态</h2>
            </div>
            <span class="status-pill" :class="`status-${taskPhase}`">{{ stageStatusText }}</span>
          </header>

          <div class="panel-body">
            <div class="progress-track">
              <span class="progress-fill" :class="{ indeterminate: isRunning && !hasRealProgress }" :style="{ width: `${progressPercent}%` }" />
            </div>
            <div class="progress-meta">
              <span>{{ progressPercent }}%</span>
              <span>{{ elapsedLabel }}</span>
            </div>

            <dl class="task-meta">
              <div>
                <dt>任务 ID</dt>
                <dd>
                  <button v-if="task?.task_uuid" class="copy-btn" type="button" title="复制任务 ID" @click="copyTaskId">
                    {{ shortTaskId }}
                  </button>
                  <span v-else>—</span>
                </dd>
              </div>
              <div>
                <dt>模型</dt>
                <dd>{{ task?.model || model.displayName }}</dd>
              </div>
              <div>
                <dt>类型</dt>
                <dd>{{ taskKind === 'motion' ? '视频动捕' : '3D 建模' }}</dd>
              </div>
              <div>
                <dt>阶段</dt>
                <dd>{{ stageLabel }}</dd>
              </div>
            </dl>

            <p v-if="errorMessage" class="inline-error">{{ errorMessage }}</p>

            <button v-if="isRunning" class="studio-btn cancel-btn" type="button" @click="stopPolling(true)">停止轮询</button>
          </div>
        </section>

        <section class="studio-panel rail-panel">
          <header class="studio-panel-head">
            <div class="studio-panel-headings">
              <span class="studio-kicker">Output · 05</span>
              <h2 class="studio-panel-title">产物</h2>
            </div>
            <span class="studio-panel-meta">{{ assets.length }} 个文件</span>
          </header>

          <div class="panel-body">
            <div v-if="!assets.length" class="empty-block">
              <span>任务完成后，模型文件与预览视频会出现在这里。</span>
            </div>

            <ul v-else class="asset-list">
              <li v-for="asset in assets" :key="asset.path" class="asset-item">
                <span class="asset-icon" :class="`asset-${asset.kind}`" aria-hidden="true">
                  {{ asset.kind === 'mesh' ? '◈' : asset.kind === 'video' ? '▷' : asset.kind === 'motion' ? '⌁' : '◇' }}
                </span>
                <div class="asset-copy">
                  <span class="asset-name">{{ asset.label }}</span>
                  <span class="asset-sub">{{ assetSubLabel(asset) }}</span>
                </div>
                <div class="asset-actions">
                  <button class="asset-btn" type="button" title="下载" @click="downloadAsset(asset.url, fileNameOf(asset))">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                      <path d="M12 4v10.5M8.2 11l3.8 3.8L15.8 11M5 19h14" />
                    </svg>
                  </button>
                  <button v-if="asset.kind === 'video' || asset.kind === 'mesh'" class="asset-btn" type="button" title="在新窗口打开" @click="openAsset(asset.url)">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                      <path d="M13.5 5H19v5.5M19 5l-7.2 7.2M17 14.2V19H5V7h4.8" />
                    </svg>
                  </button>
                </div>
              </li>
            </ul>

            <p v-if="assets.length" class="asset-tip">
              下载链接由 V2Fun OSS 临时签发，约 1 小时后失效。历史任务可重新查询获取新链接。
            </p>
          </div>
        </section>

        <section class="studio-panel rail-panel rail-panel--history">
          <header class="studio-panel-head">
            <div class="studio-panel-headings">
              <span class="studio-kicker">History · 06</span>
              <h2 class="studio-panel-title">历史任务</h2>
            </div>
            <button v-if="historyEntries.length" class="link-btn" type="button" @click="historyEntries = clearHistory()">清空</button>
          </header>

          <div class="panel-body">
            <div v-if="!historyEntries.length" class="empty-block">
              <span>还没有任务。提交后会保留任务 ID，方便随时回看。</span>
            </div>
            <ul v-else class="history-list">
              <li v-for="entry in historyEntries" :key="entry.taskId">
                <button class="history-item" :class="{ active: task?.task_uuid === entry.taskId }" type="button" @click="restoreTask(entry)">
                  <span class="history-head">
                    <span class="history-model">{{ getModel3D(entry.modelId).shortName }}</span>
                    <span class="history-status" :class="`hs-${entry.status}`">{{ historyStatusText(entry.status) }}</span>
                  </span>
                  <span class="history-prompt">{{ entry.prompt || '（未填写描述）' }}</span>
                  <span class="history-time">{{ formatRelativeTime(entry.createdAt) }}</span>
                </button>
              </li>
            </ul>
          </div>
        </section>
      </aside>
    </main>

    <input ref="imageInputRef" class="hidden-input" type="file" accept="image/png,image/jpeg,image/webp,image/bmp" @change="onImageInputChange" />
    <input ref="videoInputRef" class="hidden-input" type="file" accept="video/mp4,video/quicktime,video/webm" @change="onVideoInputChange" />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import StudioHeader from '@/components/StudioHeader.vue'
import StudioIsland from '@/components/StudioIsland.vue'
import {
  DEFAULT_MODEL3D_ID,
  MODEL3D_OPTIONS,
  MOTION_DURATION_LIMITS,
  MULTI_VIEW_SLOTS,
  MESH_PROMPT_PRESETS,
  getModel3D,
  type MeshInputMode,
  type Model3DOption,
  type MultiViewKey,
} from '@/features/model3d/models'
import {
  collectMeshAssets,
  collectMotionAssets,
  createMeshTask,
  createMotionTask,
  getMeshTask,
  getMotionTask,
  pickMeshAsset,
  pickPreviewVideo,
  taskFailureMessage,
  taskRequestError,
  type MeshTaskResult,
  type MotionTaskResult,
  type TaskAsset,
} from '@/api/model3d'
import { AssetError, downloadAsset, formatBytes, mediaUrl } from '@/features/model3d/assets'
import { HologramViewer, type ViewerStats, type ViewerStyle } from '@/features/model3d/viewer'
import {
  addHistoryEntry,
  clearHistory,
  formatRelativeTime,
  loadHistory,
  updateHistoryStatus,
  type Model3DHistoryEntry,
} from '@/features/model3d/history'
import { prepareLocalImageDataUri } from '@/features/generate/localImage'
import { fileToBase64 } from '@/features/generate/files'

const MESH_MODES: { value: MeshInputMode; label: string }[] = [
  { value: 'text', label: '文生 3D' },
  { value: 'image', label: '图生 3D' },
  { value: 'multi', label: '多视角' },
]

/* ------------------------------------------------------------- 表单状态 */

const modelId = ref(DEFAULT_MODEL3D_ID)
const model = computed<Model3DOption>(() => getModel3D(modelId.value))
const isMotion = computed(() => model.value.kind === 'motion')

const meshMode = ref<MeshInputMode>('text')
const prompt = ref('')
const singleImage = ref<{ dataUrl: string; name: string; width: number; height: number } | null>(null)
const views = reactive<Record<MultiViewKey, { dataUrl: string; name: string } | null>>({
  front: null,
  left: null,
  back: null,
  right: null,
})

const videoSource = ref<'url' | 'file'>('url')
const videoUrl = ref('')
const videoFile = ref<{ name: string; size: number; dataUrl: string } | null>(null)
const videoMeta = ref<{ duration: number; width: number; height: number } | null>(null)
const videoObjectUrl = ref('')
const startSeconds = ref<number>(0)
const durationSeconds = ref<number>(MOTION_DURATION_LIMITS.defaultValue)

const withTexture = ref(true)
const hdTexture = ref(false)
const pbrTexture = ref(false)
const priority = ref(0)

const isSubmitting = ref(false)

/* ------------------------------------------------------------- 任务状态 */

const task = ref<MeshTaskResult | MotionTaskResult | null>(null)
const taskKind = ref<'mesh' | 'motion'>('mesh')
const taskPhase = ref<'idle' | 'running' | 'done' | 'failed'>('idle')
const errorMessage = ref('')
const elapsedMs = ref(0)
const historyEntries = ref<Model3DHistoryEntry[]>(loadHistory())

let pollTimer: number | null = null
let tickTimer: number | null = null
let pollBusy = false
let taskStartedAt = 0

const isRunning = computed(() => taskPhase.value === 'running')
const currentAssets = computed<TaskAsset[]>(() => {
  if (!task.value) return []
  return taskKind.value === 'motion'
    ? collectMotionAssets(task.value as MotionTaskResult)
    : collectMeshAssets(task.value as MeshTaskResult)
})
const assets = computed(() => currentAssets.value)

const hasRealProgress = computed(() => {
  const value = task.value?.progress
  return typeof value === 'number' && value > 0 && value < 1
})

const progressPercent = computed(() => {
  if (taskPhase.value === 'done') return 100
  if (taskPhase.value === 'idle') return 0
  if (taskPhase.value === 'failed') return 100
  const status = task.value?.status
  if (status === 'QUEUED') return 6
  const raw = task.value?.progress
  if (typeof raw === 'number' && raw > 0 && raw < 1) return Math.max(8, Math.round(raw * 100))
  // 上游 progress 有时直接给 1，用时间做兜底估算（90 秒左右收敛到 92%）。
  const seconds = elapsedMs.value / 1000
  return Math.min(92, 12 + Math.round((seconds / 90) * 80))
})

const stageStatusText = computed(() => {
  if (taskPhase.value === 'idle') return '待命'
  if (taskPhase.value === 'failed') return '失败'
  if (taskPhase.value === 'done') return '已完成'
  const status = task.value?.status
  if (status === 'QUEUED') return '排队中'
  return '建模中'
})

const stageLabel = computed(() => {
  if (taskPhase.value === 'idle') return '等待提交'
  if (taskPhase.value === 'failed') return '执行失败'
  if (taskPhase.value === 'done') return '装配完成'
  const status = task.value?.status
  if (status === 'QUEUED') return '排队等待 GPU'
  const stage = (task.value as MeshTaskResult | null)?.stage
  if (stage === 'mesh_generate') return '几何重建'
  if (stage === 'texture') return '纹理烘焙'
  if (stage === 'motion_detect' || stage === 'motion_detection') return '动作捕捉'
  return taskKind.value === 'motion' ? '动作捕捉' : '几何重建'
})

const elapsedLabel = computed(() => {
  if (!taskStartedAt) return '—'
  const seconds = Math.max(0, Math.round(elapsedMs.value / 1000))
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
})

const shortTaskId = computed(() => {
  const id = task.value?.task_uuid || ''
  return id ? `${id.slice(0, 8)}…${id.slice(-4)}` : '—'
})

const motionUnits = computed(() => Math.max(1, Math.ceil(durationSeconds.value / 3)))
const motionEstimate = computed(() => {
  const unitPrice = model.value.id.includes('Turbo') ? 0.1 : 1
  return `¥${(unitPrice * motionUnits.value).toFixed(2)}`
})

const videoTotal = computed(() => {
  const duration = videoMeta.value?.duration || 0
  return Number.isFinite(duration) && duration > 0 ? duration : 0
})
const videoDurationLabel = computed(() =>
  videoTotal.value ? `视频总长 ${videoTotal.value.toFixed(1)}s` : '未读取到视频时长（按手动输入）',
)

const maxDuration = computed(() => {
  const detected = videoTotal.value
  if (!detected) return MOTION_DURATION_LIMITS.max
  return Math.max(1, Math.min(MOTION_DURATION_LIMITS.max, Math.floor(detected - startSeconds.value)))
})
const maxStart = computed(() => {
  const detected = videoTotal.value
  if (!detected) return MOTION_DURATION_LIMITS.max
  return Math.max(0, Math.floor(detected))
})

const canSubmit = computed(() => {
  if (isSubmitting.value) return false
  if (isMotion.value) {
    const hasVideo = videoSource.value === 'file' ? Boolean(videoFile.value) : /^https?:\/\//i.test(videoUrl.value)
    return hasVideo && durationSeconds.value >= MOTION_DURATION_LIMITS.min
  }
  if (meshMode.value === 'text') return prompt.value.trim().length > 2
  if (meshMode.value === 'image') return Boolean(singleImage.value)
  return Boolean(views.front)
})

const submitLabel = computed(() => {
  if (isSubmitting.value) return '提交中…'
  if (isRunning.value) return '重新生成'
  return isMotion.value ? '开始动作捕捉' : '开始生成 3D 模型'
})

const submitHint = computed(() => {
  if (taskPhase.value === 'failed') return '可调整输入后重新提交'
  if (isMotion.value) return `${motionEstimate.value} 预估 · 异步任务，通常数十秒`
  return '异步任务，通常 40–90 秒；完成后自动装配到中央台面'
})

/* ------------------------------------------------------------- 视图状态 */

const stageShellRef = ref<HTMLElement | null>(null)
const stageRef = ref<HTMLElement | null>(null)
const stageVideoRef = ref<HTMLVideoElement | null>(null)
const imageInputRef = ref<HTMLInputElement | null>(null)
const videoInputRef = ref<HTMLInputElement | null>(null)
const pendingImageTarget = ref<'single' | MultiViewKey>('single')

let viewer: HologramViewer | null = null
const viewerState = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
const viewerError = ref('')
const stats = ref<ViewerStats | null>(null)
const assetSource = ref<'proxy' | 'direct' | ''>('')
const loadProgress = ref(0)
const previewMode = ref(false)
const previewVideoUrl = ref('')
const completedVideoUrl = ref('')

const autoRotate = ref(true)
const showGrid = ref(true)
const holoStyle = ref<ViewerStyle>('natural')
const pointSize = ref(1)
const fpsLabel = ref('—')

const viewerReady = computed(() => viewerState.value === 'ready')
const showVideoStage = computed(() => {
  if (isMotion.value) return Boolean(stageVideoSrc.value)
  return previewMode.value && Boolean(previewVideoUrl.value)
})
const stageVideoSrc = computed(() => {
  if (isMotion.value) {
    return completedVideoUrl.value || videoObjectUrl.value || (/^https?:\/\//i.test(videoUrl.value) ? videoUrl.value : '')
  }
  return previewVideoUrl.value
})
const canRetryModel = computed(() => Boolean(previewMode.value && previewVideoUrl.value && !isMotion.value))

const loadProgressPercent = computed(() => Math.round(loadProgress.value * 100))

const statsLabel = computed(() => {
  if (!stats.value) return '—'
  if (stats.value.format === 'ply-splat') return `SPLAT · ${stats.value.points.toLocaleString()} pts`
  if (stats.value.format === 'ply-mesh') return `MESH · ${stats.value.triangles.toLocaleString()} tri`
  return `${stats.value.format.toUpperCase()} · ${stats.value.triangles.toLocaleString()} tri`
})
const assetSourceLabel = computed(() => (assetSource.value === 'proxy' ? 'SAME-ORIGIN' : assetSource.value === 'direct' ? 'DIRECT' : '—'))
const loadLabel = computed(() => {
  if (loadProgressPercent.value > 0 && loadProgressPercent.value < 100) return `正在下载点云数据 ${loadProgressPercent.value}%`
  return '解析几何与颜色属性…'
})

const stageNotice = computed(() => {
  if (isMotion.value) {
    return taskPhase.value === 'failed' ? errorMessage.value : ''
  }
  if (viewerError.value) return viewerError.value
  if (taskPhase.value === 'failed') return errorMessage.value
  return ''
})
const stageNoticeTone = computed<'info' | 'error'>(() => (viewerError.value || taskPhase.value === 'failed' ? 'error' : 'info'))

const assemblySteps = computed(() => {
  const phase = taskPhase.value
  const activeIndex = phase === 'idle' ? 1 : phase === 'running' ? (progressPercent.value > 55 ? 3 : 2) : phase === 'done' ? 4 : 0
  return [
    { key: 'parse', index: '01', title: '输入解析', sub: isMotion.value ? '视频帧率 / 片段' : '文本 · 参考图', active: activeIndex === 1, done: activeIndex > 1 },
    { key: 'geometry', index: '02', title: '几何重建', sub: isMotion.value ? '人体姿态追踪' : '点云 / 网格生成', active: activeIndex === 2, done: activeIndex > 2 },
    { key: 'texture', index: '03', title: isMotion.value ? '动作数据' : '材质与纹理', sub: isMotion.value ? 'BVH 输出' : '着色 / 贴图', active: activeIndex === 3, done: activeIndex > 3 },
    { key: 'deploy', index: '04', title: '装配上架', sub: '全息转台', active: activeIndex === 4, done: false },
  ]
})

/* ------------------------------------------------------------- 生命周期 */

onMounted(async () => {
  await nextTick()
  if (stageRef.value) {
    viewer = new HologramViewer(stageRef.value)
    viewer.onStateChange = (state) => {
      viewerState.value = state
    }
    viewer.onProgress = (loaded, total) => {
      loadProgress.value = total > 0 ? Math.min(1, loaded / total) : 0
    }
    viewer.setAutoRotate(autoRotate.value)
  }
  startFpsProbe()

  // 刷新页面 / 重新进入时，自动续接上一次未结束的任务，避免历史记录一直停在「进行中」。
  const pending = historyEntries.value.find((entry) => entry.status === 'RUNNING')
  if (pending) restoreTask(pending)
})

onBeforeUnmount(() => {
  stopPolling(false)
  viewer?.dispose()
  viewer = null
  if (videoObjectUrl.value) URL.revokeObjectURL(videoObjectUrl.value)
})

function startFpsProbe() {
  let frames = 0
  let last = performance.now()
  const loop = () => {
    if (!viewer) {
      fpsLabel.value = '—'
      return
    }
    frames += 1
    const now = performance.now()
    if (now - last >= 1000) {
      fpsLabel.value = String(Math.round((frames * 1000) / (now - last)))
      frames = 0
      last = now
    }
    requestAnimationFrame(loop)
  }
  requestAnimationFrame(loop)
}

/* ------------------------------------------------------------- 模型切换 */

function selectModel(option: Model3DOption) {
  if (modelId.value === option.id) return
  modelId.value = option.id
  if (option.kind === 'motion') {
    previewMode.value = false
    viewerError.value = ''
  }
}

watch(meshMode, () => {
  errorMessage.value = ''
})

watch(durationSeconds, (value) => {
  const min = MOTION_DURATION_LIMITS.min
  const max = maxDuration.value
  if (value < min) durationSeconds.value = min
  if (value > max) durationSeconds.value = max
})

watch(startSeconds, (value) => {
  if (value < 0) startSeconds.value = 0
  if (value > maxStart.value) startSeconds.value = maxStart.value
})

/* ------------------------------------------------------------- 图片与视频输入 */

function chooseImage(target: 'single' | MultiViewKey) {
  pendingImageTarget.value = target
  imageInputRef.value?.click()
}

async function readImageFile(file: File) {
  if (!file.type.startsWith('image/')) throw new Error('请选择图片文件')
  if (file.size > 12 * 1024 * 1024) throw new Error('图片请控制在 12MB 以内')
  const dataUrl = await fileToBase64(file)
  const prepared = await prepareLocalImageDataUri(dataUrl)
  const dimensions = await measureImage(prepared)
  return { dataUrl: prepared, name: file.name, width: dimensions.width, height: dimensions.height }
}

function measureImage(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const image = new Image()
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight })
    image.onerror = () => resolve({ width: 0, height: 0 })
    image.src = dataUrl
  })
}

async function onImageInputChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  try {
    const slot = await readImageFile(file)
    if (pendingImageTarget.value === 'single') {
      singleImage.value = slot
    } else {
      views[pendingImageTarget.value] = { dataUrl: slot.dataUrl, name: slot.name }
    }
    errorMessage.value = ''
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '图片读取失败'
  }
}

async function dropImage(event: DragEvent, target: 'single' | MultiViewKey) {
  const file = event.dataTransfer?.files?.[0]
  if (!file) return
  try {
    const slot = await readImageFile(file)
    if (target === 'single') singleImage.value = slot
    else views[target] = { dataUrl: slot.dataUrl, name: slot.name }
    errorMessage.value = ''
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '图片读取失败'
  }
}

async function loadVideoFile(file: File) {
  if (!/^video\//.test(file.type)) throw new Error('请选择视频文件')
  if (file.size > 50 * 1024 * 1024) throw new Error('视频请控制在 50MB 以内')
  const dataUrl = await fileToBase64(file)
  if (videoObjectUrl.value) URL.revokeObjectURL(videoObjectUrl.value)
  videoObjectUrl.value = URL.createObjectURL(file)
  videoFile.value = { name: file.name, size: file.size, dataUrl }
  videoMeta.value = await measureVideo(videoObjectUrl.value)
  startSeconds.value = 0
  durationSeconds.value = Math.max(1, Math.min(MOTION_DURATION_LIMITS.max, Math.round(videoMeta.value.duration) || 3))
  errorMessage.value = ''
}

function measureVideo(src: string): Promise<{ duration: number; width: number; height: number }> {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.onloadedmetadata = () => resolve({ duration: video.duration || 0, width: video.videoWidth, height: video.videoHeight })
    video.onerror = () => resolve({ duration: 0, width: 0, height: 0 })
    video.src = src
  })
}

async function onVideoInputChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  try {
    await loadVideoFile(file)
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '视频读取失败'
  }
}

async function dropVideo(event: DragEvent) {
  const file = event.dataTransfer?.files?.[0]
  if (!file) return
  try {
    await loadVideoFile(file)
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '视频读取失败'
  }
}

function clearVideo() {
  videoFile.value = null
  videoMeta.value = null
  if (videoObjectUrl.value) URL.revokeObjectURL(videoObjectUrl.value)
  videoObjectUrl.value = ''
}

function onSeek(value: string) {
  startSeconds.value = Number(value) || 0
  const video = stageVideoRef.value
  if (video && isMotion.value && Number.isFinite(video.duration)) {
    video.currentTime = Math.min(video.duration, startSeconds.value)
  }
}

/* ------------------------------------------------------------- 提交任务 */

async function submit() {
  if (!canSubmit.value || isSubmitting.value) return
  isSubmitting.value = true
  errorMessage.value = ''
  previewMode.value = false
  viewerError.value = ''
  completedVideoUrl.value = ''
  previewVideoUrl.value = ''
  stopPolling(false)

  try {
    if (isMotion.value) {
      const video = videoSource.value === 'file' ? videoFile.value?.dataUrl || '' : videoUrl.value
      const response = await createMotionTask({
        model: model.value.id,
        video,
        startSeconds: Number(startSeconds.value) || 0,
        durationSeconds: Math.max(1, Number(durationSeconds.value) || 1),
        priority: priority.value,
      })
      beginTask(response.task_uuid, 'motion', response)
    } else {
      const payload: Parameters<typeof createMeshTask>[0] = {
        model: model.value.id,
        mode: meshMode.value,
        withTexture: withTexture.value,
        hdTexture: withTexture.value && hdTexture.value,
        pbrTexture: withTexture.value && pbrTexture.value,
        priority: priority.value,
      }
      if (meshMode.value === 'text') payload.prompt = prompt.value.trim()
      if (meshMode.value === 'image') payload.image = singleImage.value?.dataUrl
      if (meshMode.value === 'multi') {
        payload.views = {
          front: views.front?.dataUrl,
          left: views.left?.dataUrl || undefined,
          back: views.back?.dataUrl || undefined,
          right: views.right?.dataUrl || undefined,
        }
      }
      const response = await createMeshTask(payload)
      beginTask(response.task_uuid, 'mesh', response)
    }

    historyEntries.value = addHistoryEntry({
      taskId: task.value?.task_uuid || '',
      kind: taskKind.value,
      modelId: modelId.value,
      prompt: historyPrompt(),
      createdAt: Date.now(),
      status: 'RUNNING',
    })
  } catch (error) {
    errorMessage.value = taskRequestError(error, '任务创建失败，请稍后重试。')
    taskPhase.value = 'failed'
  } finally {
    isSubmitting.value = false
  }
}

function historyPrompt(): string {
  if (isMotion.value) return videoSource.value === 'file' ? videoFile.value?.name || '本地视频' : videoUrl.value
  if (meshMode.value === 'text') return prompt.value.trim()
  if (meshMode.value === 'image') return `图生 3D · ${singleImage.value?.name || '参考图'}`
  return `多视角 3D · ${views.front?.name || '正视图'}`
}

function beginTask(taskId: string, kind: 'mesh' | 'motion', response: { status?: string; model?: string; task_type?: string; created_at?: number }) {
  taskKind.value = kind
  task.value = {
    task_uuid: taskId,
    status: (response.status as MeshTaskResult['status']) || 'QUEUED',
    model: response.model || model.value.id,
    task_type: response.task_type,
    created_at: response.created_at || Math.floor(Date.now() / 1000),
    progress: null,
  }
  taskPhase.value = 'running'
  taskStartedAt = Date.now()
  elapsedMs.value = 0
  viewerError.value = ''
  startPolling()
}

/** 查询接口限流较敏感：默认 6 秒一次，遇到 429 指数退避到 30 秒。 */
const POLL_BASE_MS = 6000
const POLL_MAX_MS = 30000
let pollDelay = POLL_BASE_MS

function isRateLimited(error: unknown): boolean {
  return (error as { response?: { status?: number } })?.response?.status === 429
}

function startPolling() {
  stopPolling(false)
  taskStartedAt = Date.now()
  elapsedMs.value = 0
  pollDelay = POLL_BASE_MS
  tickTimer = window.setInterval(() => {
    elapsedMs.value = Date.now() - taskStartedAt
  }, 1000)
  void pollOnce()
}

function scheduleNextPoll() {
  if (taskPhase.value !== 'running' || !task.value?.task_uuid) return
  pollTimer = window.setTimeout(() => {
    pollTimer = null
    void pollOnce()
  }, pollDelay)
}

function stopPolling(reason?: boolean) {
  if (pollTimer) window.clearTimeout(pollTimer)
  if (tickTimer) window.clearInterval(tickTimer)
  pollTimer = null
  tickTimer = null
  if (reason && taskPhase.value === 'running') {
    taskPhase.value = 'idle'
    errorMessage.value = '已停止轮询。任务仍在服务端执行，可从历史任务重新查询。'
  }
}

async function pollOnce() {
  const id = task.value?.task_uuid
  if (!id || pollBusy || taskPhase.value !== 'running') return
  pollBusy = true
  try {
    if (taskKind.value === 'motion') {
      const result = await getMotionTask(id)
      task.value = result
      pollDelay = POLL_BASE_MS
      handleResult(result)
    } else {
      const result = await getMeshTask(id)
      task.value = result
      pollDelay = POLL_BASE_MS
      handleResult(result)
    }
  } catch (error) {
    if (isRateLimited(error)) {
      // 429 属于正常的限流反馈：静默拉长间隔，不打断任务状态。
      pollDelay = Math.min(POLL_MAX_MS, Math.max(POLL_BASE_MS * 2, pollDelay * 2))
    } else {
      const message = taskRequestError(error, '任务查询失败。')
      if (message.includes('不存在') || message.includes('过期')) {
        stopPolling(false)
        taskPhase.value = 'failed'
        errorMessage.value = message
        return
      }
      errorMessage.value = message
      pollDelay = Math.min(POLL_MAX_MS, Math.max(POLL_BASE_MS, pollDelay * 2))
    }
  } finally {
    pollBusy = false
    scheduleNextPoll()
  }
}

async function handleResult(result: MeshTaskResult | MotionTaskResult) {
  if (result.status === 'FAILED') {
    stopPolling(false)
    taskPhase.value = 'failed'
    elapsedMs.value = Date.now() - taskStartedAt
    errorMessage.value = taskFailureMessage(result)
    historyEntries.value = updateHistoryStatus(result.task_uuid, 'FAILED')
    return
  }

  if (result.status !== 'COMPLETED') return

  stopPolling(false)
  taskPhase.value = 'done'
  elapsedMs.value = Date.now() - taskStartedAt
  historyEntries.value = updateHistoryStatus(result.task_uuid, 'COMPLETED')

  if (taskKind.value === 'motion') {
    const list = collectMotionAssets(result as MotionTaskResult)
    const clip = list.find((asset) => asset.kind === 'video')
    completedVideoUrl.value = clip ? mediaUrl(clip.url) : videoObjectUrl.value
    viewerError.value = ''
    return
  }

  const meshTask = result as MeshTaskResult
  const list = collectMeshAssets(meshTask)
  const preview = pickPreviewVideo(list)
  previewVideoUrl.value = preview ? mediaUrl(preview.url) : ''
  const mesh = pickMeshAsset(list)
  if (!mesh) {
    previewMode.value = true
    viewerError.value = '本次任务没有返回可加载的 3D 文件，已展示官方预览视频。'
    return
  }
  await loadModel(mesh.url)
}

async function loadModel(url: string) {
  if (!viewer) return
  viewerError.value = ''
  loadProgress.value = 0
  try {
    const result = await viewer.loadFromUrl(url)
    stats.value = result.stats
    assetSource.value = result.source
    previewMode.value = false
    viewer.setPointSize(pointSize.value)
    viewer.setStyle(holoStyle.value)
    viewer.setAutoRotate(autoRotate.value)
    viewer.setGridVisible(showGrid.value)
  } catch (error) {
    previewMode.value = true
    viewerError.value = describeAssetError(error)
    stats.value = null
  }
}

function describeAssetError(error: unknown): string {
  if (error instanceof AssetError) {
    if (error.reason === 'proxy-unavailable') {
      return '同源代理未配置，无法在浏览器里读取点云文件。已切换为官方预览视频；配置 /v2fun-assets 反代后即可自由旋转查看。'
    }
    if (error.reason === 'cors') {
      return 'V2Fun OSS 未开放 CORS，模型文件被浏览器拦截。已切换为官方预览视频。'
    }
    if (error.reason === 'format') return '模型文件格式无法识别，已切换为官方预览视频。'
    return error.message
  }
  return error instanceof Error ? error.message : '模型加载失败，已切换为官方预览视频。'
}

async function retryLoadModel() {
  const mesh = pickMeshAsset(currentAssets.value)
  if (!mesh) return
  previewMode.value = true
  await loadModel(mesh.url)
}

/* ------------------------------------------------------------- 视图交互 */

function applyPointSize() {
  viewer?.setPointSize(pointSize.value)
}

function setStyle(style: ViewerStyle) {
  holoStyle.value = style
  viewer?.setStyle(style)
}

function toggleAutoRotate() {
  autoRotate.value = !autoRotate.value
  viewer?.setAutoRotate(autoRotate.value)
}

function toggleGrid() {
  showGrid.value = !showGrid.value
  viewer?.setGridVisible(showGrid.value)
}

function resetView() {
  viewer?.resetView()
}

function takeScreenshot() {
  const dataUrl = viewer?.screenshot()
  if (!dataUrl) return
  const anchor = document.createElement('a')
  anchor.href = dataUrl
  anchor.download = `artrealm-3d-${Date.now()}.png`
  anchor.click()
}

function toggleFullscreen() {
  const element = stageShellRef.value
  if (!element) return
  if (document.fullscreenElement) void document.exitFullscreen()
  else void element.requestFullscreen?.()
}

/* ------------------------------------------------------------- 产物 */

function fileNameOf(asset: TaskAsset): string {
  const name = asset.path.split('/').pop() || 'asset'
  return name.split('?')[0]
}

function openAsset(url: string) {
  window.open(mediaUrl(url), '_blank', 'noopener')
}

function assetSubLabel(asset: TaskAsset): string {
  const ext = asset.ext ? asset.ext.replace('.', '').toUpperCase() : 'FILE'
  if (!asset.expiresAt) return ext
  const diff = asset.expiresAt * 1000 - Date.now()
  if (diff <= 0) return `${ext} · 链接已过期，重新查询可刷新`
  const minutes = Math.max(1, Math.round(diff / 60000))
  return `${ext} · 约 ${minutes} 分钟后过期`
}

async function copyTaskId() {
  const id = task.value?.task_uuid
  if (!id) return
  try {
    await navigator.clipboard.writeText(id)
  } catch {
    // 忽略剪贴板权限问题
  }
}

/* ------------------------------------------------------------- 历史 */

function restoreTask(entry: Model3DHistoryEntry) {
  if (isRunning.value) stopPolling(false)
  modelId.value = entry.modelId
  taskKind.value = entry.kind
  task.value = {
    task_uuid: entry.taskId,
    status: 'PROCESSING',
    model: getModel3D(entry.modelId).id,
    progress: null,
  }
  taskPhase.value = 'running'
  errorMessage.value = ''
  previewMode.value = false
  viewerError.value = ''
  previewVideoUrl.value = ''
  completedVideoUrl.value = ''
  startPolling()
}

function historyStatusText(status: Model3DHistoryEntry['status']): string {
  if (status === 'COMPLETED') return '完成'
  if (status === 'FAILED') return '失败'
  if (status === 'QUEUED') return '排队'
  return '进行中'
}
</script>

<style scoped>
/* =========================================================================
 * 3D 建模分区：左中右三栏 + 钢铁侠式全息组装台
 * ========================================================================= */

.model3d-page {
  --stage-cyan: #38bdf8;
  --stage-cyan-soft: rgba(56, 189, 248, 0.16);
  --stage-line: rgba(125, 211, 252, 0.22);
}

.model3d-main {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: minmax(300px, 336px) minmax(420px, 1fr) minmax(280px, 320px);
  gap: 16px;
  align-items: start;
  padding: 0 22px 26px 10px;
  flex: 1 1 auto;
  min-height: 0;
}

.model3d-rail {
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-height: calc(100dvh - 96px);
  overflow-y: auto;
  padding-right: 4px;
  padding-bottom: 8px;
}

.rail-panel {
  flex: 0 0 auto;
}

.panel-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px 18px 18px;
}

/* ---------- 模型卡片 ---------- */

.model-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  padding: 14px 14px 16px;
}

.model-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 12px 11px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.035);
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  overflow: hidden;
  transition:
    border-color 180ms ease,
    background 180ms ease,
    transform 180ms ease;
}

.model-card::after {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(120px 80px at 100% 0%, rgba(56, 189, 248, 0.16), transparent 70%);
  opacity: 0;
  transition: opacity 220ms ease;
  pointer-events: none;
}

.model-card:hover {
  border-color: rgba(125, 211, 252, 0.32);
  background: rgba(255, 255, 255, 0.055);
}

.model-card:hover::after,
.model-card.active::after {
  opacity: 1;
}

.model-card.active {
  border-color: color-mix(in srgb, var(--stage-cyan) 62%, transparent);
  background: linear-gradient(160deg, rgba(56, 189, 248, 0.14), rgba(56, 189, 248, 0.04));
  box-shadow:
    inset 0 0 0 1px rgba(125, 211, 252, 0.22),
    0 12px 30px -18px rgba(56, 189, 248, 0.8);
}

.model-card.motion::after {
  background: radial-gradient(120px 80px at 100% 0%, rgba(167, 139, 250, 0.18), transparent 70%);
}

.model-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.model-glyph {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 9px;
  background: rgba(56, 189, 248, 0.12);
  color: #9fe4ff;
}

.model-card.motion .model-glyph {
  background: rgba(167, 139, 250, 0.14);
  color: #d3c4ff;
}

.model-glyph svg {
  width: 15px;
  height: 15px;
}

.model-badge {
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.14em;
  color: rgba(255, 255, 255, 0.42);
}

.model-name {
  font-family: var(--font-family-display);
  font-size: 13px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: rgba(255, 255, 255, 0.95);
}

.model-desc {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-size: 11px;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.46);
}

.model-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  margin-top: 2px;
  font-size: 10px;
  color: rgba(159, 228, 255, 0.8);
}

.model-tags {
  display: inline-flex;
  gap: 4px;
}

.model-tags em {
  font-style: normal;
  font-size: 9px;
  padding: 1px 5px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.5);
}

/* ---------- 分段控件 ---------- */

.segmented {
  display: flex;
  gap: 4px;
  padding: 4px;
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.03);
}

.segmented-item {
  flex: 1;
  min-height: 30px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: rgba(255, 255, 255, 0.52);
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition:
    background 160ms ease,
    color 160ms ease;
}

.segmented-item:hover {
  color: rgba(255, 255, 255, 0.82);
}

.segmented-item.active {
  background: rgba(56, 189, 248, 0.16);
  color: #b8ecff;
  box-shadow: inset 0 0 0 1px rgba(125, 211, 252, 0.28);
}

/* ---------- 文本输入 ---------- */

.input-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.prompt-input {
  min-height: 118px;
  padding: 12px 14px;
  font-size: 12.5px;
  line-height: 1.65;
}

.text-field {
  height: 40px;
  padding: 0 14px;
  font-size: 12.5px;
}

.field-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 10.5px;
  color: rgba(255, 255, 255, 0.36);
}

.field-hint {
  margin: 0;
  font-size: 10.5px;
  line-height: 1.55;
  color: rgba(255, 255, 255, 0.34);
}

.preset-block {
  display: flex;
  flex-direction: column;
  gap: 7px;
  margin-top: 2px;
}

.preset-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.06em;
  color: rgba(255, 255, 255, 0.42);
}

.preset-hint {
  font-weight: 400;
  letter-spacing: 0;
  color: rgba(255, 255, 255, 0.28);
}

.preset-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.preset-chip {
  padding: 4px 9px;
  border: 1px solid rgba(255, 255, 255, 0.09);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.03);
  color: rgba(255, 255, 255, 0.6);
  font: inherit;
  font-size: 11px;
  cursor: pointer;
  transition:
    border-color 160ms ease,
    color 160ms ease,
    background 160ms ease;
}

.preset-chip:hover {
  border-color: rgba(125, 211, 252, 0.4);
  background: rgba(56, 189, 248, 0.1);
  color: #d5f3ff;
}

/* ---------- 上传区 ---------- */

.dropzone {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 148px;
  padding: 14px;
  border: 1px dashed rgba(125, 211, 252, 0.28);
  border-radius: 16px;
  background: rgba(56, 189, 248, 0.045);
  color: rgba(255, 255, 255, 0.6);
  text-align: center;
  cursor: pointer;
  overflow: hidden;
  transition:
    border-color 180ms ease,
    background 180ms ease;
}

.dropzone:hover {
  border-color: rgba(125, 211, 252, 0.55);
  background: rgba(56, 189, 248, 0.09);
}

.dropzone.filled {
  border-style: solid;
  border-color: rgba(125, 211, 252, 0.3);
  padding: 0;
}

.dropzone--video {
  min-height: 118px;
}

.dropzone-icon svg {
  width: 26px;
  height: 26px;
  color: rgba(159, 228, 255, 0.75);
}

.dropzone-title {
  max-width: 100%;
  font-size: 12.5px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.82);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dropzone-sub {
  font-size: 10.5px;
  color: rgba(255, 255, 255, 0.36);
}

.video-file-icon {
  font-size: 20px;
  color: rgba(159, 228, 255, 0.8);
}

.dropzone-thumb {
  width: 100%;
  height: 148px;
  object-fit: contain;
  background: radial-gradient(circle at 50% 44%, rgba(56, 189, 248, 0.14), transparent 70%);
}

.dropzone-overlay {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
  font-size: 10.5px;
  color: rgba(255, 255, 255, 0.72);
  background: linear-gradient(180deg, transparent, rgba(4, 8, 14, 0.86));
}

.thumb-clear {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 22px;
  height: 22px;
  border: 0;
  border-radius: 50%;
  background: rgba(6, 10, 16, 0.72);
  color: rgba(255, 255, 255, 0.8);
  font: inherit;
  font-size: 15px;
  line-height: 1;
  cursor: pointer;
}

.thumb-clear:hover {
  background: rgba(244, 63, 94, 0.7);
}

.view-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.view-slot {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  aspect-ratio: 1 / 1;
  border: 1px dashed rgba(255, 255, 255, 0.14);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.03);
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  overflow: hidden;
  transition:
    border-color 160ms ease,
    background 160ms ease;
}

.view-slot.required {
  border-color: rgba(125, 211, 252, 0.38);
}

.view-slot:hover {
  border-color: rgba(125, 211, 252, 0.5);
  background: rgba(56, 189, 248, 0.07);
}

.view-slot img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.view-slot-label {
  font-size: 12px;
  font-weight: 600;
}

.view-slot-hint {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.3);
}

/* ---------- 动捕时间轴 ---------- */

.time-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.025);
}

.time-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.time-field {
  display: flex;
  flex-direction: column;
  gap: 5px;
  font-size: 10.5px;
  color: rgba(255, 255, 255, 0.42);
}

.time-input {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 34px;
  padding: 0 10px;
  border: 1px solid rgba(255, 255, 255, 0.09);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.04);
}

.time-input input {
  width: 100%;
  border: 0;
  background: transparent;
  color: rgba(255, 255, 255, 0.9);
  font: inherit;
  font-size: 12.5px;
  outline: none;
}

.time-input em {
  font-style: normal;
  font-size: 10.5px;
  color: rgba(255, 255, 255, 0.36);
}

.time-range {
  width: 100%;
  height: 4px;
  border-radius: 999px;
  appearance: none;
  background: linear-gradient(90deg, rgba(56, 189, 248, 0.55), rgba(56, 189, 248, 0.14));
  outline: none;
}

.time-range::-webkit-slider-thumb {
  appearance: none;
  width: 13px;
  height: 13px;
  border: 2px solid #06121b;
  border-radius: 50%;
  background: #7dd3fc;
  box-shadow: 0 0 10px rgba(56, 189, 248, 0.8);
  cursor: pointer;
}

.time-range::-moz-range-thumb {
  width: 13px;
  height: 13px;
  border: 2px solid #06121b;
  border-radius: 50%;
  background: #7dd3fc;
  cursor: pointer;
}

.time-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 10px;
  color: rgba(255, 255, 255, 0.34);
}

/* ---------- 开关与参数 ---------- */

.switch-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.025);
  cursor: pointer;
  transition: border-color 160ms ease;
}

.switch-row:hover {
  border-color: rgba(125, 211, 252, 0.26);
}

.switch-row.disabled {
  opacity: 0.42;
  cursor: not-allowed;
}

.switch-copy {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.switch-title {
  font-size: 12px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.84);
}

.switch-sub {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.36);
}

.switch-row input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.switch-track {
  position: relative;
  flex: 0 0 auto;
  width: 38px;
  height: 21px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.12);
  transition: background 180ms ease;
}

.switch-thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 15px;
  height: 15px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.75);
  transition:
    transform 180ms ease,
    background 180ms ease;
}

.switch-row input:checked + .switch-track {
  background: rgba(56, 189, 248, 0.55);
  box-shadow: 0 0 14px -2px rgba(56, 189, 248, 0.8);
}

.switch-row input:checked + .switch-track .switch-thumb {
  transform: translateX(17px);
  background: #fff;
}

.param-row {
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding-top: 4px;
}

.param-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11.5px;
  color: rgba(255, 255, 255, 0.62);
}

.param-label em {
  font-style: normal;
  font-size: 10.5px;
  color: rgba(159, 228, 255, 0.82);
}

.billing-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px;
  border: 1px solid rgba(167, 139, 250, 0.24);
  border-radius: 14px;
  background: rgba(167, 139, 250, 0.07);
}

.billing-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11.5px;
  color: rgba(255, 255, 255, 0.55);
}

.billing-row strong {
  font-size: 12.5px;
  color: #e6dcff;
}

.billing-note {
  margin: 0;
  font-size: 10px;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.32);
}

/* ---------- 生成按钮 ---------- */

.rail-actions {
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding: 2px 2px 4px;
}

.build-btn {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 48px;
  border: 1px solid rgba(125, 211, 252, 0.48);
  border-radius: 16px;
  background: linear-gradient(135deg, rgba(56, 189, 248, 0.92), rgba(14, 116, 171, 0.92));
  color: #04121b;
  font: inherit;
  font-size: 13.5px;
  font-weight: 700;
  letter-spacing: 0.02em;
  cursor: pointer;
  overflow: hidden;
  box-shadow:
    0 18px 36px -20px rgba(56, 189, 248, 0.9),
    inset 0 1px 0 rgba(255, 255, 255, 0.4);
  transition:
    filter 180ms ease,
    transform 180ms ease;
}

.build-btn:hover:not(:disabled) {
  filter: brightness(1.08);
  transform: translateY(-1px);
}

.build-btn:disabled {
  cursor: not-allowed;
  filter: grayscale(0.5);
  opacity: 0.5;
}

.build-btn-glow {
  position: absolute;
  inset: -40% -10%;
  background: linear-gradient(100deg, transparent 20%, rgba(255, 255, 255, 0.55) 46%, transparent 62%);
  transform: translateX(-120%);
  animation: build-sweep 3.6s ease-in-out infinite;
}

@keyframes build-sweep {
  0%,
  55% {
    transform: translateX(-120%);
  }
  100% {
    transform: translateX(120%);
  }
}

.build-btn-label {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.build-btn-label svg {
  width: 16px;
  height: 16px;
}

.build-hint {
  margin: 0;
  text-align: center;
  font-size: 10.5px;
  color: rgba(255, 255, 255, 0.34);
}

/* ============================ 中央组装台 ============================ */

.stage-column {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
  position: sticky;
  top: 8px;
}

.stage-shell {
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 560px;
  height: calc(100dvh - 210px);
  max-height: 880px;
  border: 1px solid rgba(125, 211, 252, 0.16);
  border-radius: 26px;
  background:
    radial-gradient(120% 80% at 50% 0%, rgba(56, 189, 248, 0.12), transparent 58%),
    radial-gradient(80% 60% at 50% 100%, rgba(37, 99, 235, 0.14), transparent 62%),
    linear-gradient(180deg, rgba(8, 14, 22, 0.9), rgba(4, 8, 14, 0.96));
  box-shadow:
    0 40px 90px -50px rgba(56, 189, 248, 0.6),
    inset 0 1px 0 rgba(255, 255, 255, 0.06);
  overflow: hidden;
}

.stage-shell::before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image:
    linear-gradient(rgba(125, 211, 252, 0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(125, 211, 252, 0.05) 1px, transparent 1px);
  background-size: 54px 54px;
  mask-image: radial-gradient(circle at 50% 46%, #000 0 42%, transparent 82%);
}

.stage-shell.is-video::before {
  opacity: 0.4;
}

.stage-topbar {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 18px 10px;
}

.stage-ident {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
  font-size: 11px;
  letter-spacing: 0.04em;
  color: rgba(255, 255, 255, 0.5);
}

.stage-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.3);
}

.stage-dot.dot-running {
  background: #38bdf8;
  box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.16);
  animation: dot-pulse 1.6s ease-in-out infinite;
}

.stage-dot.dot-done {
  background: #34d399;
  box-shadow: 0 0 0 3px rgba(52, 211, 153, 0.16);
}

.stage-dot.dot-failed {
  background: #fb7185;
  box-shadow: 0 0 0 3px rgba(251, 113, 133, 0.16);
}

@keyframes dot-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.35;
  }
}

.stage-ident-model {
  font-size: 12px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.86);
  white-space: nowrap;
}

.stage-ident-divider {
  width: 1px;
  height: 11px;
  background: rgba(255, 255, 255, 0.14);
}

.stage-ident-mode {
  font-size: 9.5px;
  font-weight: 700;
  letter-spacing: 0.13em;
  color: rgba(159, 228, 255, 0.72);
  white-space: nowrap;
}

.stage-ident-status {
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  font-size: 10px;
  white-space: nowrap;
}

.stage-actions {
  display: flex;
  gap: 6px;
}

.stage-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: 1px solid rgba(255, 255, 255, 0.09);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.035);
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  transition:
    border-color 160ms ease,
    color 160ms ease,
    background 160ms ease;
}

.stage-action svg {
  width: 15px;
  height: 15px;
}

.stage-action:hover:not(:disabled) {
  border-color: rgba(125, 211, 252, 0.4);
  background: rgba(56, 189, 248, 0.12);
  color: #d5f3ff;
}

.stage-action:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.stage-viewport {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  margin: 0 10px;
  border-radius: 18px;
  background: radial-gradient(circle at 50% 58%, rgba(14, 45, 66, 0.55), rgba(4, 8, 14, 0.9) 72%);
  overflow: hidden;
}

.stage-canvas {
  position: absolute;
  inset: 0;
}

.stage-video-wrap {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 26px 22px 30px;
  background: radial-gradient(circle at 50% 52%, rgba(14, 45, 66, 0.5), rgba(3, 7, 12, 0.92) 74%);
}

.stage-video {
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: 12px;
  background: #000;
}

.stage-video-tag {
  position: absolute;
  left: 26px;
  top: 24px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 9px;
  border: 1px solid rgba(125, 211, 252, 0.3);
  border-radius: 999px;
  background: rgba(4, 10, 18, 0.72);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.14em;
  color: rgba(159, 228, 255, 0.9);
  backdrop-filter: blur(8px);
}

.live-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #34d399;
  box-shadow: 0 0 8px rgba(52, 211, 153, 0.9);
}

/* HUD 装饰 */

.hud {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.hud-corner {
  position: absolute;
  width: 26px;
  height: 26px;
  border-color: rgba(125, 211, 252, 0.42);
  border-style: solid;
  border-width: 0;
}

.hud-corner--tl {
  top: 12px;
  left: 12px;
  border-top-width: 1px;
  border-left-width: 1px;
}

.hud-corner--tr {
  top: 12px;
  right: 12px;
  border-top-width: 1px;
  border-right-width: 1px;
}

.hud-corner--bl {
  bottom: 12px;
  left: 12px;
  border-bottom-width: 1px;
  border-left-width: 1px;
}

.hud-corner--br {
  bottom: 12px;
  right: 12px;
  border-bottom-width: 1px;
  border-right-width: 1px;
}

.hud-scan {
  position: absolute;
  left: 0;
  right: 0;
  height: 22%;
  background: linear-gradient(180deg, transparent, rgba(56, 189, 248, 0.055), transparent);
  animation: hud-scan 7.5s linear infinite;
}

@keyframes hud-scan {
  0% {
    transform: translateY(-30%);
  }
  100% {
    transform: translateY(460%);
  }
}

.hud-line {
  position: absolute;
  background: rgba(125, 211, 252, 0.1);
}

.hud-line--h {
  left: 8%;
  right: 8%;
  top: 50%;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(125, 211, 252, 0.16), transparent);
}

.hud-line--v {
  top: 10%;
  bottom: 10%;
  left: 50%;
  width: 1px;
  background: linear-gradient(180deg, transparent, rgba(125, 211, 252, 0.14), transparent);
}

.hud-ticks {
  position: absolute;
  top: 22%;
  bottom: 22%;
  width: 6px;
  background-image: repeating-linear-gradient(180deg, rgba(125, 211, 252, 0.34) 0 1px, transparent 1px 9px);
  opacity: 0.6;
}

.hud-ticks--left {
  left: 13px;
}

.hud-ticks--right {
  right: 13px;
}

.hud-readout {
  position: absolute;
  bottom: 14px;
  display: grid;
  grid-template-columns: auto auto;
  gap: 2px 8px;
  padding: 7px 10px;
  border: 1px solid rgba(125, 211, 252, 0.14);
  border-radius: 9px;
  background: rgba(3, 8, 14, 0.55);
  font-size: 9px;
  letter-spacing: 0.08em;
  backdrop-filter: blur(6px);
  pointer-events: none;
}

.hud-readout--left {
  left: 16px;
}

.hud-readout--right {
  right: 16px;
  text-align: right;
}

.readout-key {
  color: rgba(125, 211, 252, 0.45);
}

.readout-value {
  color: rgba(255, 255, 255, 0.66);
  font-variant-numeric: tabular-nums;
}

/* 中央提示 */

.stage-idle,
.stage-loading {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 7px;
  text-align: center;
  pointer-events: none;
  padding: 0 36px;
}

.idle-title,
.loading-title {
  font-family: var(--font-family-display);
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: rgba(255, 255, 255, 0.78);
}

.idle-sub,
.loading-sub {
  max-width: 320px;
  font-size: 11px;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.36);
}

.loading-ring {
  width: 46px;
  height: 46px;
  margin-bottom: 8px;
  border: 1px solid rgba(125, 211, 252, 0.18);
  border-top-color: #7dd3fc;
  border-radius: 50%;
  animation: ring-spin 1.1s linear infinite;
}

@keyframes ring-spin {
  to {
    transform: rotate(360deg);
  }
}

.loading-bar {
  width: 220px;
  height: 3px;
  margin-top: 6px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  overflow: hidden;
}

.loading-bar span {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, rgba(56, 189, 248, 0.4), #7dd3fc);
  transition: width 200ms ease;
}

.stage-notice {
  position: absolute;
  left: 50%;
  bottom: 62px;
  transform: translateX(-50%);
  display: flex;
  align-items: flex-start;
  gap: 8px;
  width: min(560px, calc(100% - 48px));
  padding: 10px 12px;
  border: 1px solid rgba(251, 191, 36, 0.28);
  border-radius: 12px;
  background: rgba(24, 18, 4, 0.78);
  color: rgba(255, 236, 200, 0.9);
  font-size: 11px;
  line-height: 1.6;
  backdrop-filter: blur(10px);
}

.notice-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: rgba(251, 191, 36, 0.2);
  font-size: 10px;
  font-weight: 800;
}

.notice-copy {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.notice-action {
  align-self: flex-start;
  padding: 3px 9px;
  border: 1px solid rgba(251, 191, 36, 0.4);
  border-radius: 999px;
  background: transparent;
  color: rgba(255, 236, 200, 0.95);
  font: inherit;
  font-size: 10.5px;
  cursor: pointer;
}

.notice-action:hover {
  background: rgba(251, 191, 36, 0.14);
}

/* 底部工具条 */

.stage-toolbar {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px 16px 12px;
  flex-wrap: wrap;
}

.tool-group {
  display: flex;
  gap: 5px;
}

.tool-group--end {
  margin-left: auto;
}

.tool-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 11px;
  border: 1px solid rgba(255, 255, 255, 0.09);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.03);
  color: rgba(255, 255, 255, 0.55);
  font: inherit;
  font-size: 11px;
  cursor: pointer;
  transition:
    border-color 160ms ease,
    color 160ms ease,
    background 160ms ease;
}

.tool-chip:hover:not(:disabled) {
  border-color: rgba(125, 211, 252, 0.35);
  color: #d5f3ff;
}

.tool-chip.active {
  border-color: rgba(125, 211, 252, 0.5);
  background: rgba(56, 189, 248, 0.14);
  color: #cdefff;
}

.tool-chip:disabled {
  opacity: 0.32;
  cursor: not-allowed;
}

.chip-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: currentColor;
}

.tool-slider {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 10.5px;
  color: rgba(255, 255, 255, 0.45);
}

.tool-slider input {
  width: 92px;
  height: 3px;
  appearance: none;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.14);
  outline: none;
}

.tool-slider input::-webkit-slider-thumb {
  appearance: none;
  width: 11px;
  height: 11px;
  border-radius: 50%;
  background: #7dd3fc;
  cursor: pointer;
}

.tool-slider input::-moz-range-thumb {
  width: 11px;
  height: 11px;
  border: 0;
  border-radius: 50%;
  background: #7dd3fc;
  cursor: pointer;
}

.tool-slider em {
  font-style: normal;
  font-variant-numeric: tabular-nums;
  color: rgba(159, 228, 255, 0.8);
}

/* 装配步骤 */

.stage-steps {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.stage-step {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 11px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 13px;
  background: rgba(255, 255, 255, 0.022);
  opacity: 0.55;
  transition:
    border-color 220ms ease,
    opacity 220ms ease,
    background 220ms ease;
}

.stage-step.active {
  opacity: 1;
  border-color: rgba(125, 211, 252, 0.4);
  background: rgba(56, 189, 248, 0.09);
}

.stage-step.done {
  opacity: 0.9;
}

.stage-step.done .step-index {
  color: #34d399;
}

.step-index {
  font-size: 9.5px;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: rgba(125, 211, 252, 0.7);
}

.step-copy {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.step-copy strong {
  font-size: 11px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.82);
}

.step-copy em {
  font-style: normal;
  font-size: 9.5px;
  color: rgba(255, 255, 255, 0.36);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ============================ 右栏 ============================ */

.status-pill {
  padding: 3px 9px;
  border-radius: 999px;
  font-size: 10.5px;
  font-weight: 600;
  background: rgba(255, 255, 255, 0.07);
  color: rgba(255, 255, 255, 0.6);
}

.status-pill.status-running {
  background: rgba(56, 189, 248, 0.16);
  color: #a9e7ff;
}

.status-pill.status-done {
  background: rgba(52, 211, 153, 0.16);
  color: #9df3cd;
}

.status-pill.status-failed {
  background: rgba(251, 113, 133, 0.16);
  color: #ffc1cb;
}

.progress-track {
  position: relative;
  height: 4px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  overflow: hidden;
}

.progress-fill {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(56, 189, 248, 0.55), #7dd3fc);
  transition: width 400ms ease;
}

.progress-fill.indeterminate {
  background: linear-gradient(90deg, rgba(56, 189, 248, 0.2), #7dd3fc, rgba(56, 189, 248, 0.2));
  background-size: 200% 100%;
  animation: progress-flow 1.8s linear infinite;
}

@keyframes progress-flow {
  from {
    background-position: 0% 0;
  }
  to {
    background-position: -200% 0;
  }
}

.progress-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: -6px;
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  color: rgba(255, 255, 255, 0.4);
}

.task-meta {
  display: flex;
  flex-direction: column;
  gap: 7px;
  margin: 0;
  padding: 12px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.022);
}

.task-meta > div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.task-meta dt {
  font-size: 10.5px;
  color: rgba(255, 255, 255, 0.36);
}

.task-meta dd {
  margin: 0;
  max-width: 62%;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.72);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.copy-btn {
  padding: 2px 7px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.04);
  color: rgba(159, 228, 255, 0.9);
  font: inherit;
  font-size: 10.5px;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
}

.copy-btn:hover {
  border-color: rgba(125, 211, 252, 0.4);
}

.inline-error {
  margin: 0;
  padding: 9px 11px;
  border: 1px solid rgba(251, 113, 133, 0.28);
  border-radius: 11px;
  background: rgba(251, 113, 133, 0.08);
  font-size: 11px;
  line-height: 1.6;
  color: #ffc9d2;
}

.cancel-btn {
  width: 100%;
}

.empty-block {
  padding: 16px 12px;
  border: 1px dashed rgba(255, 255, 255, 0.09);
  border-radius: 13px;
  text-align: center;
  font-size: 10.5px;
  line-height: 1.7;
  color: rgba(255, 255, 255, 0.32);
}

.asset-list,
.history-list {
  display: flex;
  flex-direction: column;
  gap: 7px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.asset-item {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 9px 10px;
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.028);
}

.asset-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 28px;
  height: 28px;
  border-radius: 9px;
  background: rgba(56, 189, 248, 0.12);
  color: #9fe4ff;
  font-size: 13px;
}

.asset-icon.asset-motion {
  background: rgba(167, 139, 250, 0.14);
  color: #d3c4ff;
}

.asset-icon.asset-video {
  background: rgba(52, 211, 153, 0.12);
  color: #9df3cd;
}

.asset-copy {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.asset-name {
  font-size: 11.5px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.82);
}

.asset-sub {
  font-size: 9.5px;
  color: rgba(255, 255, 255, 0.34);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.asset-actions {
  display: flex;
  gap: 4px;
}

.asset-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: 1px solid rgba(255, 255, 255, 0.09);
  border-radius: 8px;
  background: transparent;
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  transition:
    border-color 160ms ease,
    color 160ms ease,
    background 160ms ease;
}

.asset-btn svg {
  width: 13px;
  height: 13px;
}

.asset-btn:hover {
  border-color: rgba(125, 211, 252, 0.4);
  background: rgba(56, 189, 248, 0.12);
  color: #d5f3ff;
}

.asset-tip {
  margin: 0;
  font-size: 9.5px;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.3);
}

.link-btn {
  border: 0;
  background: transparent;
  color: rgba(159, 228, 255, 0.7);
  font: inherit;
  font-size: 10.5px;
  cursor: pointer;
}

.link-btn:hover {
  color: #b8ecff;
}

.history-item {
  display: flex;
  flex-direction: column;
  gap: 3px;
  width: 100%;
  padding: 9px 10px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.022);
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    border-color 160ms ease,
    background 160ms ease;
}

.history-item:hover {
  border-color: rgba(125, 211, 252, 0.3);
  background: rgba(56, 189, 248, 0.06);
}

.history-item.active {
  border-color: rgba(125, 211, 252, 0.42);
  background: rgba(56, 189, 248, 0.1);
}

.history-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.history-model {
  font-size: 11px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.8);
}

.history-status {
  font-size: 9.5px;
  padding: 1px 6px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.07);
  color: rgba(255, 255, 255, 0.5);
}

.history-status.hs-COMPLETED {
  background: rgba(52, 211, 153, 0.14);
  color: #9df3cd;
}

.history-status.hs-FAILED {
  background: rgba(251, 113, 133, 0.14);
  color: #ffc1cb;
}

.history-prompt {
  font-size: 10.5px;
  line-height: 1.45;
  color: rgba(255, 255, 255, 0.44);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.history-time {
  font-size: 9.5px;
  color: rgba(255, 255, 255, 0.28);
}

.rail-panel--history {
  min-height: 0;
}

.hidden-input {
  display: none;
}

/* Fullscreen */

.stage-shell:fullscreen {
  height: 100dvh;
  max-height: none;
  border-radius: 0;
  border: 0;
}

/* ============================ 响应式 ============================ */

@media (max-width: 1360px) {
  .model3d-main {
    grid-template-columns: minmax(280px, 310px) minmax(360px, 1fr) minmax(256px, 286px);
    gap: 12px;
    padding-right: 16px;
  }

  .stage-shell {
    height: calc(100dvh - 220px);
    min-height: 520px;
  }
}

@media (max-width: 1180px) {
  .model3d-main {
    grid-template-columns: 1fr;
    padding: 0 16px 28px;
  }

  .model3d-rail {
    max-height: none;
    overflow: visible;
    padding-right: 0;
  }

  .stage-column {
    position: static;
    order: -1;
  }

  .stage-shell {
    height: 62dvh;
    min-height: 460px;
  }

  .stage-steps {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .model3d-main {
    padding: 0 12px 24px;
  }

  .model-grid {
    grid-template-columns: 1fr;
  }

  .stage-shell {
    height: 56dvh;
    min-height: 400px;
  }

  .stage-toolbar {
    gap: 8px;
  }

  .tool-group--end {
    margin-left: 0;
  }
}
</style>
