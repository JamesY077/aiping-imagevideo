<template>
  <div class="chat-page">
    <div class="workspace-shell single-session-layout">
      <header class="top-nav">
        <div class="brand-lockup">
          <strong class="brand-title">ArtRealm</strong>
        </div>

        <div class="top-nav-actions">
          <button class="skill-create-btn" type="button" @click="router.push('/skill')">
            <span class="skill-create-icon" aria-hidden="true">✦</span>
            创作 Skill
          </button>
          <button class="canvas-entry-btn" type="button" @click="router.push('/canvas')">
            <span class="canvas-entry-text">无限画布</span>
            <span class="canvas-entry-new" aria-label="测试版功能">BETA</span>
          </button>
          <button class="sidebar-secondary-btn" type="button" @click="router.push('/settings')">
            设置
          </button>
        </div>
      </header>


      <main class="workspace-main">
        <section class="chat-stage">
          <div class="chat-area" ref="chatAreaRef">
            <div v-if="activeMessages.length === 0" class="empty-state">
              <p class="empty-kicker">Simple Create · Agentic Visual Canvas</p>
              <h1>把一句想法变成一张可交付视觉。</h1>
              <p class="empty-copy">输入主体、风格、光线、构图和用途；系统会在这个简洁工作台里完成生成、查看、下载与再次迭代。</p>
            </div>


            <ChatBubble
              v-for="msg in activeMessages"
              :key="msg.id"
              :message="msg"
              @regenerate="handleRegenerate"
              @copy-prompt="handleCopyPrompt"
            />
          </div>
        </section>

        <section class="composer-dock" :class="{ 'ratio-open': showAspectRatioMenu }">
          <div class="composer-console" :class="{ open: isComposerControlsOpen, 'ratio-open': showAspectRatioMenu }">
            <button
              class="composer-summary"
              type="button"
              :aria-expanded="isComposerControlsOpen"
              aria-controls="composer-control-panel"
              @click="isComposerControlsOpen = !isComposerControlsOpen"
            >
              <span class="summary-kicker">Creative Console</span>
              <span class="summary-chip summary-chip-strong">{{ mediaTypeLabel }}</span>
              <span class="summary-chip">{{ selectedModelLabel }}</span>
              <span class="summary-chip">{{ activeGenerateModeLabel }}</span>
              <span class="summary-chip">{{ selectedAspectRatioOption.label }}</span>
              <span v-if="settingsStore.mediaType === 'video'" class="summary-chip">{{ selectedVideoDurationLabel }}</span>
              <span v-if="materialSummaryLabel" class="summary-chip" :class="{ attention: needsMaterialAttention }">{{ materialSummaryLabel }}</span>
              <span v-if="skillStore.activeSkill" class="summary-chip summary-chip-skill">Skill：{{ skillStore.activeSkill.name }}</span>
              <span class="summary-spacer" />
              <span class="summary-toggle">{{ isComposerControlsOpen ? '收起参数' : '展开参数与素材' }}</span>
            </button>

            <div v-show="isComposerControlsOpen" id="composer-control-panel" class="composer-control-panel" :class="{ 'ratio-open': showAspectRatioMenu }">
              <div class="composer-meta-row composer-meta-row-top">
                <div class="dock-pills dock-pills-primary">
              <div class="meta-pill meta-pill-type">
                <span class="meta-pill-label">创作类型</span>
                <div class="media-switch compact-switch" role="tablist" aria-label="生成类型">
                  <button class="switch-btn" :class="{ active: settingsStore.mediaType === 'image' }" @click="handleMediaTypeChange('image')">图像</button>
                  <button class="switch-btn" :class="{ active: settingsStore.mediaType === 'video' }" @click="handleMediaTypeChange('video')">视频</button>
                </div>
              </div>

              <div class="meta-pill meta-pill-model">
                <span class="meta-pill-label">模型选择</span>
                <div class="model-slot compact-model-slot">
                  <ModelSelector
                    :key="settingsStore.mediaType"
                    :mediaType="settingsStore.mediaType"
                    compact
                    v-model="settingsStore.selectedModel"
                    @update:modelValue="settingsStore.saveToStorage()"
                  />
                </div>
              </div>

              <div v-if="settingsStore.mediaType === 'image'" class="meta-pill meta-pill-mode">
                <span class="meta-pill-label">生成方式</span>
                <div class="video-mode-switch compact-switch" role="tablist" aria-label="图片生成方式">
                  <button
                    v-for="option in imageModeOptions"
                    :key="option.value"
                    class="switch-btn mode-switch-btn"
                    :class="{ active: imageMode === option.value }"
                    type="button"
                    :disabled="option.value === 'image2image' && !supportsImageReferenceMode"
                    @click="setImageMode(option.value)"
                  >
                    {{ option.label }}
                  </button>
                </div>
              </div>

              <div v-else-if="usesViduLikeVideoMode" class="meta-pill meta-pill-mode">
                <span class="meta-pill-label">生成方式</span>
                <div class="video-mode-switch compact-switch" role="tablist" aria-label="视频生成方式">
                  <button
                    v-for="option in activeVideoModeOptions"
                    :key="option.value"
                    class="switch-btn mode-switch-btn"
                    :class="{ active: videoMode === option.value }"
                    type="button"
                    @click="setVideoMode(option.value)"
                  >
                    {{ option.label }}
                  </button>
                </div>
              </div>

              <div class="meta-pill meta-pill-ratio">
                <span class="meta-pill-label">比例</span>
                <div class="ratio-selector" :class="{ open: showAspectRatioMenu }">
                  <button
                    class="ratio-current-btn"
                    type="button"
                    :aria-expanded="showAspectRatioMenu"
                    aria-label="选择比例"
                    @click="showAspectRatioMenu = !showAspectRatioMenu"
                  >
                    <span class="ratio-chip">
                      <span
                        class="ratio-current-box"
                        :style="{ width: `${selectedAspectRatioOption.boxWidth}px`, height: `${selectedAspectRatioOption.boxHeight}px` }"
                      />
                      {{ selectedAspectRatioOption.label }}
                    </span>
                    <span class="ratio-caret">▾</span>
                  </button>

                  <div v-if="showAspectRatioMenu" class="ratio-dropdown">
                    <button
                      v-for="option in aspectRatioOptions"
                      :key="option.value"
                      type="button"
                      class="ratio-dropdown-item"
                      :class="{ active: settingsStore.aspectRatio === option.value }"
                      @click="handleAspectRatioMenuSelect(option.value)"
                    >
                      <span class="ratio-option-preview">
                        <span class="ratio-option-box" :style="{ width: `${option.boxWidth}px`, height: `${option.boxHeight}px` }" />
                      </span>
                      <span>{{ option.label }}</span>
                    </button>
                  </div>
                </div>
              </div>

              <div v-if="isMinimaxH3VideoModel" class="meta-pill meta-pill-duration">
                <span class="meta-pill-label">分辨率</span>
                <div class="duration-selector">
                  <div class="duration-select-wrap">
                    <select
                      id="video-resolution"
                      v-model="settingsStore.videoResolution"
                      class="duration-select"
                      @change="settingsStore.saveToStorage()"
                    >
                      <option value="768P">768P</option>
                      <option value="2K">2K</option>
                    </select>
                    <span class="duration-caret" aria-hidden="true">▾</span>
                  </div>
                </div>
              </div>

              <div v-if="settingsStore.mediaType === 'video'" class="meta-pill meta-pill-duration duration-slot">
                <span class="meta-pill-label">时长</span>
                <div class="duration-selector">
                  <div class="duration-select-wrap">
                    <select
                      id="video-duration"
                      v-model="settingsStore.videoDuration"
                      class="duration-select"
                      @change="settingsStore.saveToStorage()"
                    >
                      <option v-for="option in videoDurationOptions" :key="option.value" :value="option.value">
                        {{ option.label }}
                      </option>
                    </select>
                    <span class="duration-caret" aria-hidden="true">▾</span>
                  </div>
                </div>
              </div>

            </div>



            <!-- 运镜指令（MiniMax 海螺系列：文生 / 图生 / 首尾帧）单独一行，避免挤压上方胶囊 -->
            <div v-if="showCameraGuide" class="camera-guide-row">
              <CameraMovementGuide compact @insert="insertCameraCommand" />
            </div>

            <div v-if="showReferenceField" class="reference-strip">

              <template v-if="usesViduLikeVideoMode">

                <div v-if="videoMode === 'image2video' || videoMode === 'endFrame2video'" class="upload-mini-row upload-card-row" :class="{ 'has-file': !!uploadedFile }">
                  <input
                    ref="fileInput"
                    type="file"
                    :accept="IMAGE_FILE_ACCEPT"
                    class="file-input"
                    @change="handleFileChange"
                  />
                  <button class="upload-btn upload-icon-btn" type="button" :aria-label="videoMode === 'endFrame2video' ? '上传尾帧图' : '上传参考图'" @click="fileInput?.click()">
                    +
                  </button>
                  <div class="upload-copy">
                    <span class="upload-label">{{ videoMode === 'endFrame2video' ? '尾帧图' : '参考图' }}</span>
                    <span class="upload-hint">{{ videoMode === 'endFrame2video' ? '作为视频结尾画面（MiniMax-H3），支持 PNG / JPG / WebP 等格式' : '用于图生视频，支持 PNG / JPG / WebP 等格式' }}</span>
                  </div>
                  <span v-if="uploadedFile" class="pill-filename">{{ uploadedFile.name }}</span>
                  <button v-if="uploadedFile" class="text-btn" type="button" @click="() => removeUploadedFile()">移除</button>
                </div>

                <div v-else-if="videoMode === 'motionControl2video'" class="motion-control-panel">
                  <p class="motion-control-note">动作控制 <small>用于通过参考图像和参考视频生成视频，使生成视频中的人物动作与参考视频一致。</small></p>
                  <div class="motion-control-options">
                    <label class="motion-control-option">
                      <span class="motion-control-option-label">保留原声</span>
                      <select v-model="motionControlKeepOriginalSound" class="motion-control-select" aria-label="是否保留原声">
                        <option value="yes">保留</option>
                        <option value="no">不保留</option>
                      </select>
                    </label>
                    <label class="motion-control-option">
                      <span class="motion-control-option-label">人物朝向</span>
                      <select v-model="motionControlCharacterOrientation" class="motion-control-select" aria-label="人物朝向">
                        <option value="image">参考图像</option>
                        <option value="video">参考视频</option>
                      </select>
                    </label>
                  </div>
                  <div class="frame-upload-grid">
                    <div class="upload-mini-row upload-card-row frame-upload-card" :class="{ 'has-file': !!motionControlImage }">
                      <input
                        ref="motionControlImageInput"
                        type="file"
                        :accept="IMAGE_FILE_ACCEPT"
                        class="file-input"
                        @change="handleMotionControlFileChange($event, 'image')"
                      />
                      <button class="upload-btn upload-icon-btn" type="button" aria-label="上传动作控制参考图" @click="motionControlImageInput?.click()">
                        +
                      </button>
                      <div class="upload-copy">
                        <span class="upload-label">参考图像</span>
                        <span class="upload-hint">作为生成视频的人物外观参考，支持 PNG / JPG / WebP 等格式</span>
                      </div>
                      <span v-if="motionControlImage" class="pill-filename">{{ motionControlImage.name }}</span>
                      <button v-if="motionControlImage" class="text-btn" type="button" @click="removeMotionControlFile('image')">移除</button>
                    </div>

                    <div class="upload-mini-row upload-card-row frame-upload-card" :class="{ 'has-file': !!motionControlVideo }">
                      <input
                        ref="motionControlVideoInput"
                        type="file"
                        :accept="VIDEO_FILE_ACCEPT"
                        class="file-input"
                        @change="handleMotionControlFileChange($event, 'video')"
                      />
                      <button class="upload-btn upload-icon-btn" type="button" aria-label="上传动作控制参考视频" @click="motionControlVideoInput?.click()">
                        +
                      </button>
                      <div class="upload-copy">
                        <span class="upload-label">参考视频</span>
                        <span class="upload-hint">用于对齐人物动作，支持 MP4 / MOV / WebM 等格式</span>
                      </div>
                      <span v-if="motionControlVideo" class="pill-filename">{{ motionControlVideo.name }}</span>
                      <button v-if="motionControlVideo" class="text-btn" type="button" @click="removeMotionControlFile('video')">移除</button>
                    </div>
                  </div>
                </div>

                <div v-else-if="videoMode === 'startEnd2video'" class="frame-upload-grid">
                  <div class="upload-mini-row upload-card-row frame-upload-card" :class="{ 'has-file': !!viduStartFrame }">
                    <input
                      ref="viduStartInput"
                      type="file"
                      :accept="IMAGE_FILE_ACCEPT"
                      class="file-input"
                      @change="handleViduFrameChange($event, 'start')"
                    />
                    <button class="upload-btn upload-icon-btn" type="button" aria-label="上传首帧" @click="viduStartInput?.click()">
                      +
                    </button>
                    <div class="upload-copy">
                      <span class="upload-label">首帧</span>
                      <span class="upload-hint">视频开始画面，支持 PNG / JPG / WebP 等格式</span>
                    </div>
                    <span v-if="viduStartFrame" class="pill-filename">{{ viduStartFrame.name }}</span>
                    <button v-if="viduStartFrame" class="text-btn" type="button" @click="removeViduFrame('start')">移除</button>
                  </div>

                  <div class="upload-mini-row upload-card-row frame-upload-card" :class="{ 'has-file': !!viduEndFrame }">
                    <input
                      ref="viduEndInput"
                      type="file"
                      :accept="IMAGE_FILE_ACCEPT"
                      class="file-input"
                      @change="handleViduFrameChange($event, 'end')"
                    />
                    <button class="upload-btn upload-icon-btn" type="button" aria-label="上传尾帧" @click="viduEndInput?.click()">
                      +
                    </button>
                    <div class="upload-copy">
                      <span class="upload-label">尾帧（可选）</span>
                      <span class="upload-hint">视频结束画面，支持 PNG / JPG / WebP 等格式</span>

                    </div>
                    <span v-if="viduEndFrame" class="pill-filename">{{ viduEndFrame.name }}</span>
                    <button v-if="viduEndFrame" class="text-btn" type="button" @click="removeViduFrame('end')">移除</button>
                  </div>
                </div>

                <div v-else-if="videoMode === 'referenceImage2video'" class="multimodal-panel">
                  <p class="multimodal-note">
                    参考生视频
                    <small>上传参考图片（多图主体，最多 {{ KLING_REFERENCE_IMAGE_LIMIT }} 张），模型会参考图中的主体生成视频。上传后可在文本中输入 <b>@</b> 精确指定素材位置，例如「让 @图片1 中的角色走进 @图片2 的场景」。支持常见格式：图片 PNG / JPG / WebP，视频 MP4 / MOV / WebM。</small>
                  </p>
                  <div class="multimodal-group">
                    <div class="multimodal-group-head">
                      <span class="multimodal-group-title">参考图片</span>
                      <span class="multimodal-group-count">{{ multimodalImages.length }}/{{ KLING_REFERENCE_IMAGE_LIMIT }}</span>
                    </div>
                    <div class="multimodal-thumb-row">
                      <div v-for="item in multimodalImages" :key="item.url" class="multimodal-thumb">
                        <img :src="item.url" :alt="item.refLabel" />
                        <span class="multimodal-thumb-tag">{{ item.refLabel }}</span>
                        <button class="multimodal-thumb-remove" type="button" aria-label="移除" @click="removeMultimodalAsset('image', item)">×</button>
                      </div>
                      <button
                        v-if="multimodalImages.length < KLING_REFERENCE_IMAGE_LIMIT"
                        class="multimodal-add-btn"
                        type="button"
                        aria-label="添加参考图"
                        @click="multimodalImageInput?.click()"
                      >+</button>
                    </div>
                    <input ref="multimodalImageInput" type="file" :accept="IMAGE_FILE_ACCEPT" multiple class="file-input" @change="handleMultimodalFileChange($event, 'image')" />
                  </div>
                </div>


                <div v-else-if="videoMode === 'subjectReference2video'" class="subject-reference-card" :class="{ 'has-file': !!uploadedFile }">

                  <input
                    ref="fileInput"
                    type="file"
                    :accept="IMAGE_FILE_ACCEPT"
                    class="file-input"
                    @change="handleFileChange"
                  />
                  <button class="subject-upload-btn" type="button" @click="fileInput?.click()">
                    <span class="subject-upload-icon">+</span>
                    上传主体图
                  </button>
                  <div class="subject-reference-copy">
                    <span class="upload-label">主体参考</span>
                    <span class="upload-hint">上传人物主体图片生成 S2V 视频，支持 PNG / JPG / WebP 等格式</span>
                  </div>
                  <span v-if="uploadedFile" class="pill-filename">{{ uploadedFile.name }}</span>
                  <button v-if="uploadedFile" class="text-btn" type="button" @click="() => removeUploadedFile()">移除</button>
                </div>


                <div v-else-if="videoMode === 'editVideo'" class="multimodal-panel edit-video-panel">
                  <p class="multimodal-note">
                    编辑视频
                    <small>提供「待编辑视频 + 参考图片 + 提示词」，完成替换主体、对象增删改、局部重绘/修复等编辑；仅需 1 个视频 + 1 张图片。可在文本中输入 <b>@</b> 精确指定素材位置，例如「将 @视频1 礼盒中的香水替换成 @图片1 中的面霜，运镜不变」。支持常见格式：图片 PNG / JPG / WebP，视频 MP4 / MOV / WebM。</small>
                  </p>
                  <div class="frame-upload-grid">
                    <div class="upload-mini-row upload-card-row frame-upload-card" :class="{ 'has-file': !!editVideoFile }">
                      <input
                        ref="editVideoInput"
                        type="file"
                        :accept="VIDEO_FILE_ACCEPT"
                        class="file-input"
                        @change="handleEditFileChange($event, 'video')"
                      />
                      <button class="upload-btn upload-icon-btn" type="button" aria-label="上传待编辑视频" @click="editVideoInput?.click()">
                        +
                      </button>
                      <div class="upload-copy">
                        <span class="upload-label">视频1</span>
                        <span class="upload-hint">请上传需要修改的视频，支持 MP4 / MOV / WebM 等格式</span>
                      </div>
                      <span v-if="editVideoFile" class="pill-filename">{{ editVideoFile.name }}</span>
                      <button v-if="editVideoFile" class="text-btn" type="button" @click="removeEditFile('video')">移除</button>
                    </div>

                    <div class="upload-mini-row upload-card-row frame-upload-card" :class="{ 'has-file': !!editImageFile }">
                      <input
                        ref="editImageInput"
                        type="file"
                        :accept="IMAGE_FILE_ACCEPT"
                        class="file-input"
                        @change="handleEditFileChange($event, 'image')"
                      />
                      <button class="upload-btn upload-icon-btn" type="button" aria-label="上传替换图片" @click="editImageInput?.click()">
                        +
                      </button>
                      <div class="upload-copy">
                        <span class="upload-label">图片1</span>
                        <span class="upload-hint">请上传想要替换成的图片，支持 PNG / JPG / WebP 等格式</span>
                      </div>
                      <span v-if="editImageFile" class="pill-filename">{{ editImageFile.name }}</span>
                      <button v-if="editImageFile" class="text-btn" type="button" @click="removeEditFile('image')">移除</button>
                    </div>
                  </div>
                </div>

                <div v-else-if="isMultimodalReferenceMode" class="multimodal-panel">
                  <p class="multimodal-note">
                    多模态参考
                    <small>可任意组合图片（0~9）、视频（0~3）、音频（0~3）作为参考；不支持「纯音频」或「文本+音频」。上传后可在文本中输入 <b>@</b> 精确指定素材位置。支持常见格式：图片 PNG / JPG / WebP，视频 MP4 / MOV / WebM。</small>
                  </p>


                  <div class="multimodal-groups">

                    <div class="multimodal-group">
                      <div class="multimodal-group-head">
                        <span class="multimodal-group-title">图片</span>
                        <span class="multimodal-group-count">{{ multimodalImages.length }}/{{ MULTIMODAL_LIMITS.image }}</span>
                      </div>
                      <div class="multimodal-thumb-row">
                        <div v-for="item in multimodalImages" :key="item.url" class="multimodal-thumb">
                          <img :src="item.url" :alt="item.refLabel" />
                          <span class="multimodal-thumb-tag">{{ item.refLabel }}</span>
                          <button class="multimodal-thumb-remove" type="button" aria-label="移除" @click="removeMultimodalAsset('image', item)">×</button>
                        </div>
                        <button
                          v-if="multimodalImages.length < MULTIMODAL_LIMITS.image"
                          class="multimodal-add-btn"
                          type="button"
                          aria-label="添加图片"
                          @click="multimodalImageInput?.click()"
                        >+</button>
                      </div>
                      <input ref="multimodalImageInput" type="file" :accept="IMAGE_FILE_ACCEPT" multiple class="file-input" @change="handleMultimodalFileChange($event, 'image')" />
                    </div>

                    <div class="multimodal-group">
                      <div class="multimodal-group-head">
                        <span class="multimodal-group-title">视频</span>
                        <span class="multimodal-group-count">{{ multimodalVideos.length }}/{{ MULTIMODAL_LIMITS.video }}</span>
                      </div>
                      <div class="multimodal-thumb-row">
                        <div v-for="item in multimodalVideos" :key="item.url" class="multimodal-thumb multimodal-thumb-file">
                          <span class="multimodal-file-icon">🎬</span>
                          <span class="multimodal-thumb-tag">{{ item.refLabel }}</span>
                          <button class="multimodal-thumb-remove" type="button" aria-label="移除" @click="removeMultimodalAsset('video', item)">×</button>
                        </div>
                        <button
                          v-if="multimodalVideos.length < MULTIMODAL_LIMITS.video"
                          class="multimodal-add-btn"
                          type="button"
                          aria-label="添加视频"
                          @click="multimodalVideoInput?.click()"
                        >+</button>
                      </div>
                      <input ref="multimodalVideoInput" type="file" :accept="VIDEO_FILE_ACCEPT" multiple class="file-input" @change="handleMultimodalFileChange($event, 'video')" />
                    </div>

                    <div class="multimodal-group">
                      <div class="multimodal-group-head">
                        <span class="multimodal-group-title">音频</span>
                        <span class="multimodal-group-count">{{ multimodalAudios.length }}/{{ MULTIMODAL_LIMITS.audio }}</span>
                      </div>
                      <div class="multimodal-thumb-row">
                        <div v-for="item in multimodalAudios" :key="item.url" class="multimodal-thumb multimodal-thumb-file">
                          <span class="multimodal-file-icon">🎵</span>
                          <span class="multimodal-thumb-tag">{{ item.refLabel }}</span>
                          <button class="multimodal-thumb-remove" type="button" aria-label="移除" @click="removeMultimodalAsset('audio', item)">×</button>
                        </div>
                        <button
                          v-if="multimodalAudios.length < MULTIMODAL_LIMITS.audio"
                          class="multimodal-add-btn"
                          type="button"
                          aria-label="添加音频"
                          @click="multimodalAudioInput?.click()"
                        >+</button>
                      </div>
                      <input ref="multimodalAudioInput" type="file" accept="audio/*" multiple class="file-input" @change="handleMultimodalFileChange($event, 'audio')" />
                    </div>
                  </div>
                </div>
              </template>


              <div v-else-if="isImageReferenceMode" class="upload-mini-row upload-card-row" :class="{ 'has-file': !!uploadedFile }">
                <input
                  ref="fileInput"
                  type="file"
                  :accept="IMAGE_FILE_ACCEPT"
                  class="file-input"
                  @change="handleFileChange"
                />
                <button class="upload-btn upload-icon-btn" type="button" aria-label="上传参考图" @click="fileInput?.click()">
                  +
                </button>
                <div class="upload-copy">
                  <span class="upload-label">参考图</span>
                  <span class="upload-hint">用于图生图，支持 PNG / JPG / WebP 等格式</span>
                </div>
                <span v-if="uploadedFile" class="pill-filename">{{ uploadedFile.name }}</span>
                <button v-if="uploadedFile" class="text-btn" type="button" @click="() => removeUploadedFile()">移除</button>
              </div>
              <div v-else-if="isUploadEnabled" class="upload-mini-row" :class="{ 'has-file': !!uploadedFile }">
                <input
                  ref="fileInput"
                  type="file"
                  :accept="uploadAccept"
                  class="file-input"
                  @change="handleFileChange"
                />
                <button
                  class="upload-btn upload-icon-btn"
                  type="button"
                  aria-label="上传参考"
                  :title="`支持常见格式：图片 ${IMAGE_FORMAT_HINT}；视频 ${VIDEO_FORMAT_HINT}`"
                  @click="fileInput?.click()"
                >
                  +
                </button>
                <span v-if="uploadedFile" class="pill-filename">{{ uploadedFile.name }}</span>
                <button v-if="uploadedFile" class="text-btn" type="button" @click="() => removeUploadedFile()">移除</button>
              </div>
              <input
                v-else-if="showReferenceUrlInput"
                v-model.trim="referenceUrl"
                type="url"
                class="reference-input"
                placeholder="粘贴参考图片或视频链接"
              />
              </div>

              <div class="skill-control-row">
                <input
                  ref="skillFileInput"
                  type="file"
                  accept=".md,text/markdown"
                  class="file-input"
                  @change="handleSkillFileChange"
                />
                <button
                  class="skill-upload-btn-inline"
                  type="button"
                  :class="{ active: !!skillStore.activeSkill }"
                  :title="skillStore.activeSkill ? `已应用 Skill：${skillStore.activeSkill.name}（点击更换）` : '上传 .md Skill，生成时将严格遵循其规范'"
                  @click="skillFileInput?.click()"
                >
                  {{ skillStore.activeSkill ? `Skill：${skillStore.activeSkill.name}` : '上传 Skill' }}
                </button>
                <button
                  v-if="skillStore.activeSkill"
                  class="skill-clear-inline"
                  type="button"
                  title="移除已应用的 Skill"
                  @click="skillStore.clearActiveSkill()"
                >
                  ×
                </button>
              </div>
            </div>
          </div>
          </div>

          <div v-if="referencedMentions.length" class="referenced-mentions" aria-label="已引用素材">
            <span class="referenced-mentions-label">已引用</span>
            <span
              v-for="item in referencedMentions"
              :key="item.url"
              class="referenced-chip"
              :class="`referenced-chip-${mentionKind(item)}`"
            >
              <span class="referenced-chip-dot" aria-hidden="true" />
              {{ item.refLabel }}
            </span>
          </div>

          <div :class="['input-shell', { expanded: isComposerExpanded }]">
            <div
              v-if="showMentionMenu && mentionableAssets.length"
              ref="mentionMenuRef"
              class="mention-menu"
              :style="mentionMenuStyle"
              role="listbox"
              aria-label="选择参考素材"
            >
              <button
                v-for="(item, index) in mentionableAssets"
                :key="item.url"
                type="button"
                class="mention-item"
                :class="{ active: index === activeMentionIndex }"
                @mousedown.prevent="insertMentionReference(item)"
                @mouseenter="activeMentionIndex = index"
              >
                <span class="mention-item-tag">{{ item.refLabel }}</span>
                <span class="mention-item-name">{{ item.name }}</span>
              </button>
            </div>
            <textarea
              ref="promptInputRef"
              v-model="inputText"
              :placeholder="inputPlaceholder"
              :style="{ height: `${composerTextareaHeight}px` }"
              @input="handlePromptInput"
              @keyup="handlePromptInput"
              @click="handlePromptInput"
              @keydown="handleComposerKeydown"
            />


            <div class="composer-actions">
              <button
                class="icon-btn"
                :title="isComposerExpanded ? '收起输入框' : '展开输入框'"
                :aria-label="isComposerExpanded ? '收起输入框' : '展开输入框'"
                @click="toggleComposerExpanded"
              >

                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M8 16L16 8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                  <path d="M9 8H16V15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
              <button
                class="polish-btn"
                :disabled="isPolishing || activeSessionGenerating || !hasPromptPolishModelConfigured"
                :title="!hasPromptPolishModelConfigured ? polishDisabledReason : ''"
                :aria-label="!hasPromptPolishModelConfigured ? polishDisabledReason : 'AI 润色'"
                @click="handlePolishPrompt"
              >
                {{ isPolishing ? '润色中…' : 'AI 润色' }}
              </button>
              <button
                class="send-btn send-icon-btn"
                :class="{ ready: canSend && !activeSessionGenerating }"
                :disabled="!canSend || activeSessionGenerating"
                @click="handleSend"
              >
                <span class="send-gradient-icon" :class="{ 'is-ready': canSend && !activeSessionGenerating }" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M4 12.75L19.5 4.5L15.75 19.5L11.25 13.5L4 12.75Z" :stroke="canSend && !activeSessionGenerating ? 'currentColor' : 'url(#chatSendGradient)'" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
                    <path d="M10.75 13.25L19.5 4.5" :stroke="canSend && !activeSessionGenerating ? 'currentColor' : 'url(#chatSendGradient)'" stroke-width="1.8" stroke-linecap="round" />
                    <defs>
                      <linearGradient id="chatSendGradient" x1="4" y1="4.5" x2="19.5" y2="19.5" gradientUnits="userSpaceOnUse">
                        <stop offset="0" stop-color="#24262d" />
                        <stop offset="0.55" stop-color="#3a3f47" />
                        <stop offset="1" stop-color="#0a84ff" />
                      </linearGradient>
                    </defs>
                  </svg>
                </span>
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, onMounted, computed, watch, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ChatBubble from '@/components/ChatBubble.vue'
import ModelSelector from '@/components/ModelSelector.vue'
import CameraMovementGuide from '@/components/CameraMovementGuide.vue'
import { useSettingsStore } from '@/stores/settingsStore'
import { DEFAULT_PROMPT_POLISH_SYSTEM_PROMPT } from '@/stores/settingsStore'
import { useGenerate } from '@/composables/useGenerate'
import { useChatStore } from '@/stores/chatStore'
import { useSkillStore } from '@/stores/skillStore'
import { readSkillFile } from '@/features/skill/parse'

import { polishPrompt } from '@/api/aiping'
import {
  ASPECT_RATIO_OPTIONS,
  getLocalUploadAccept,
  getModelCapability,
  getDefaultVideoDuration,
  getSupportedAspectRatios,
  getSupportedVideoDurations,
  modelRequiresReference,
  modelSupportsLocalUpload,
  type AspectRatioOption,
  type MediaType,
  type VideoGenerationMode,
} from '@/types/model'
import { showErrorMessage } from '@/utils/errors'
import { getReadableErrorMessage, validatePromptOrThrow } from '@/utils/errorHandling'
import type { Message, UploadedFile } from '@/types/chat'
import { resolveGenerateIoType } from '@/features/generate/media'
import {
  IMAGE_FILE_ACCEPT,
  IMAGE_FORMAT_HINT,
  VIDEO_FILE_ACCEPT,
  VIDEO_FORMAT_HINT,
  classifySupportedFile,
  validateUploadFileKind,
} from '@/features/generate/fileFormats'

const router = useRouter()
const route = useRoute()
const settingsStore = useSettingsStore()
const chatStore = useChatStore()
const skillStore = useSkillStore()
const { generate } = useGenerate()
const LANDING_REFERENCE_STORAGE_KEY = 'artrealm_landing_reference_image'

// Skill 上传入口（简易模式，非必填）：上传后生成会携带该 skill 规范。
const skillFileInput = ref<HTMLInputElement | null>(null)

async function handleSkillFileChange(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  if (!file.name.toLowerCase().endsWith('.md')) {
    showErrorMessage('Skill 文件需为 .md（Markdown）格式。')
    target.value = ''
    return
  }
  try {
    const content = await readSkillFile(file)
    skillStore.setActiveSkillFromContent(content, file.name)
  } catch (error) {
    showErrorMessage(getReadableErrorMessage(error, 'Skill 文件读取失败，请重试。'))
  } finally {
    target.value = ''
  }
}


const chatAreaRef = ref<HTMLElement | null>(null)
const promptInputRef = ref<HTMLTextAreaElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const viduStartInput = ref<HTMLInputElement | null>(null)
const viduEndInput = ref<HTMLInputElement | null>(null)
const motionControlImageInput = ref<HTMLInputElement | null>(null)
const motionControlVideoInput = ref<HTMLInputElement | null>(null)
const isPolishing = ref(false)
const isComposerExpanded = ref(false)
const isComposerControlsOpen = ref(true)
const COMPOSER_TEXTAREA_DEFAULT = 196
const COMPOSER_TEXTAREA_EXPANDED = 320
const composerTextareaHeight = ref(COMPOSER_TEXTAREA_DEFAULT)
const showAspectRatioMenu = ref(false)
const uploadedFile = ref<UploadedFile | null>(null)
const viduStartFrame = ref<UploadedFile | null>(null)
const viduEndFrame = ref<UploadedFile | null>(null)
const motionControlImage = ref<UploadedFile | null>(null)
const motionControlVideo = ref<UploadedFile | null>(null)
const motionControlKeepOriginalSound = ref<'yes' | 'no'>('yes')
const motionControlCharacterOrientation = ref<'image' | 'video'>('image')

const referenceUrl = ref('')

const inputText = ref('')
type ImageMode = 'text2image' | 'image2image'
type VideoMode = VideoGenerationMode


interface ImageDimensions {
  width: number
  height: number
}
const imageMode = ref<ImageMode>('text2image')
const videoMode = ref<VideoMode>('text2video')
// 多模态参考（Seedance 2.0 系列）：图片 0~9 / 视频 0~3 / 音频 0~3


const MULTIMODAL_LIMITS = { image: 9, video: 3, audio: 3 } as const
// Kling V3-Omni / Video-O1「参考生视频」：多图主体，参考图片上限 7 张（复用 multimodalImages 承载）。
const KLING_REFERENCE_IMAGE_LIMIT = 7

const multimodalImages = ref<UploadedFile[]>([])
const multimodalVideos = ref<UploadedFile[]>([])
const multimodalAudios = ref<UploadedFile[]>([])
const multimodalImageInput = ref<HTMLInputElement | null>(null)
const multimodalVideoInput = ref<HTMLInputElement | null>(null)
const multimodalAudioInput = ref<HTMLInputElement | null>(null)
// 编辑视频（Seedance 2.0）：固定「1 个待修改视频 + 1 张替换图片」
const editVideoFile = ref<UploadedFile | null>(null)
const editImageFile = ref<UploadedFile | null>(null)
const editVideoInput = ref<HTMLInputElement | null>(null)
const editImageInput = ref<HTMLInputElement | null>(null)

// @ 引用菜单状态
const showMentionMenu = ref(false)
const mentionAtIndex = ref(-1)
// 当前高亮的引用项索引（用于键盘上下选择）
const activeMentionIndex = ref(0)
const mentionMenuRef = ref<HTMLElement | null>(null)
const mentionMenuStyle = ref<Record<string, string>>({})

const imageModeOptions: Array<{ value: ImageMode; label: string }> = [
  { value: 'text2image', label: '文生图' },
  { value: 'image2image', label: '图生图' },
]
const viduVideoModeOptions: Array<{ value: VideoMode; label: string }> = [
  { value: 'text2video', label: '文生视频' },
  { value: 'image2video', label: '图生视频' },
  { value: 'startEnd2video', label: '首尾帧生视频' },
]
const minimaxHailuoVideoModeOptions: Array<{ value: VideoMode; label: string }> = [
  ...viduVideoModeOptions,
  { value: 'subjectReference2video', label: '主体参考视频' },
]
const klingMotionControlVideoModeOptions: Array<{ value: VideoMode; label: string }> = [
  { value: 'text2video', label: '文生视频' },
  { value: 'startEnd2video', label: '首尾帧生视频' },
  { value: 'motionControl2video', label: '动作控制' },
]

// Kling V3-Omni / Video-O1：支持「参考生视频（多图主体）」与「首尾帧生视频」。
const klingOmniVideoModeOptions: Array<{ value: VideoMode; label: string }> = [
  { value: 'text2video', label: '文生视频' },
  { value: 'referenceImage2video', label: '参考生视频' },
  { value: 'startEnd2video', label: '首尾帧生视频' },
]


const seedanceVideoModeOptions: Array<{ value: VideoMode; label: string }> = [
  { value: 'text2video', label: '文生视频' },
  { value: 'image2video', label: '图生视频' },
  { value: 'multimodalReference2video', label: '多模态参考' },
  { value: 'editVideo', label: '编辑视频' },
]

// MiniMax-H3：文生 / 图生（首帧）/ 尾帧 / 首尾帧 / 多模态参考（参考图 / 参考视频 / 参考音频）。
const minimaxH3VideoModeOptions: Array<{ value: VideoMode; label: string }> = [
  { value: 'text2video', label: '文生视频' },
  { value: 'image2video', label: '图生视频' },
  { value: 'endFrame2video', label: '尾帧生视频' },
  { value: 'startEnd2video', label: '首尾帧生视频' },
  { value: 'multimodalReference2video', label: '多模态参考' },
]


const hasPromptPolishModelConfigured = computed(() => !!settingsStore.promptPolishModel.trim())
const polishDisabledReason = '请前往设置完成 AI 润色模型设置'

const activeMessages = computed(() => chatStore.messages)
const activeSessionGenerating = computed(() => chatStore.isGenerating)
const modelCapability = computed(() => getModelCapability(settingsStore.selectedModel))
const isViduVideoModel = computed(() => settingsStore.mediaType === 'video' && modelCapability.value?.videoRequestMode === 'viduq3-fast')
const isMinimaxHailuoVideoModel = computed(() => settingsStore.mediaType === 'video' && modelCapability.value?.videoRequestMode === 'minimax-hailuo')
const isKlingMultimodalVideoModel = computed(() => {
  const mode = modelCapability.value?.videoRequestMode
  return settingsStore.mediaType === 'video' && (mode === 'kling-v26' || mode === 'kling-v3' || mode === 'kling-omni')
})
const isKlingMotionControlVideoModel = computed(() => {
  const mode = modelCapability.value?.videoRequestMode
  return settingsStore.mediaType === 'video' && (mode === 'kling-v26' || mode === 'kling-v3')
})
// 运镜指令提示：仅 MiniMax 海螺系列（minimax-hailuo）在文生 / 图生 / 首尾帧模式下展示。

const showCameraGuide = computed(() => {

  return (
    isMinimaxHailuoVideoModel.value &&
    ['text2video', 'image2video', 'startEnd2video'].includes(videoMode.value)
  )
})

const isKlingOmniVideoModel = computed(() => settingsStore.mediaType === 'video' && modelCapability.value?.videoRequestMode === 'kling-omni')
// Kling 参考生视频：复用多模态图片素材面板 + @ 引用
const isKlingReferenceMode = computed(() => isKlingOmniVideoModel.value && videoMode.value === 'referenceImage2video')


const isSeedanceVideoModel = computed(() => settingsStore.mediaType === 'video' && modelCapability.value?.videoRequestMode === 'seedance-2')
const isMinimaxH3VideoModel = computed(() => settingsStore.mediaType === 'video' && modelCapability.value?.videoRequestMode === 'minimax-h3')
// 多模态参考：Seedance 2.0 与 MiniMax-H3 共用「素材 + @ 引用」面板。
const isMultimodalReferenceMode = computed(() => (isSeedanceVideoModel.value || isMinimaxH3VideoModel.value) && videoMode.value === 'multimodalReference2video')
const isEditVideoMode = computed(() => isSeedanceVideoModel.value && videoMode.value === 'editVideo')
// 多模态参考、编辑视频、Kling 参考生视频都使用「素材 + @ 引用」的面板
const isSeedanceMentionMode = computed(() => isMultimodalReferenceMode.value || isEditVideoMode.value || isKlingReferenceMode.value)


const usesViduLikeVideoMode = computed(() => isViduVideoModel.value || isMinimaxHailuoVideoModel.value || isMinimaxH3VideoModel.value || isKlingMultimodalVideoModel.value || isSeedanceVideoModel.value)
// 统一引用开关：MiniMax-H3 等视频模型只要处于「多模态参考」模式，就复用 seedance2 的 @ 引用面板。
const isMentionReferenceMode = computed(
  () => isSeedanceMentionMode.value || (usesViduLikeVideoMode.value && videoMode.value === 'multimodalReference2video'),
)
const activeVideoModeOptions = computed(() => {
  if (isMinimaxHailuoVideoModel.value) return minimaxHailuoVideoModeOptions
  if (isMinimaxH3VideoModel.value) return minimaxH3VideoModeOptions
  if (isKlingMotionControlVideoModel.value) return klingMotionControlVideoModeOptions
  if (isKlingOmniVideoModel.value) return klingOmniVideoModeOptions
  if (isSeedanceVideoModel.value) return seedanceVideoModeOptions
  if (isKlingMultimodalVideoModel.value) return viduVideoModeOptions
  return viduVideoModeOptions

})
const mentionableAssets = computed<UploadedFile[]>(() => {
  // 编辑视频：固定「视频1 + 图片1」，用于 @ 引用与彩色标签
  if (isEditVideoMode.value) {
    return [editVideoFile.value, editImageFile.value].filter((item): item is UploadedFile => !!item)
  }
  return [
    ...multimodalImages.value,
    ...multimodalVideos.value,
    ...multimodalAudios.value,
  ]
})


// 匹配文本中的 @图片N / @视频N / @音频N 引用标签
const MENTION_TAG_REGEX = /@(图片|视频|音频)\d+/g

/** 判断素材属于哪一类，用于给标签上不同的渐变色。 */
function mentionKind(item: UploadedFile): 'image' | 'video' | 'audio' {
  const label = item.refLabel || ''
  if (label.startsWith('视频')) return 'video'
  if (label.startsWith('音频')) return 'audio'
  return 'image'
}

/**
 * 当前文本中真正被 @ 引用、且与已上传素材匹配的素材列表（去重、保持出现顺序）。
 * 在输入框上方以彩色标签展示，用作图片/视频/音频的直观区分。
 */
const referencedMentions = computed<UploadedFile[]>(() => {
  if (!isMentionReferenceMode.value || !inputText.value) return []

  const referencedLabels = new Set(
    Array.from(inputText.value.matchAll(MENTION_TAG_REGEX)).map((match) => match[0].slice(1)),
  )
  return mentionableAssets.value.filter((item) => referencedLabels.has(item.refLabel || ''))
})

const isUploadEnabled = computed(() => modelSupportsLocalUpload(settingsStore.selectedModel))
const supportsImageReferenceMode = computed(() => {
  return settingsStore.mediaType === 'image' && !!modelCapability.value?.inputs.includes('image') && isUploadEnabled.value
})
const isImageReferenceMode = computed(() => {
  return settingsStore.mediaType === 'image' && imageMode.value === 'image2image' && supportsImageReferenceMode.value
})
const requiresUpload = computed(() => {
  if (!modelRequiresReference(settingsStore.selectedModel)) return false
  return !!modelCapability.value?.inputs.includes('image') && !inputText.value.trim()
})
const showReferenceUrlInput = computed(() => requiresUpload.value && !isUploadEnabled.value)
const showReferenceField = computed(() => {
  if (usesViduLikeVideoMode.value) return videoMode.value !== 'text2video'
  if (settingsStore.mediaType === 'image') return isImageReferenceMode.value || showReferenceUrlInput.value
  return isUploadEnabled.value || showReferenceUrlInput.value
})

const uploadAccept = computed(
  () => getLocalUploadAccept(settingsStore.selectedModel) || `${IMAGE_FILE_ACCEPT},${VIDEO_FILE_ACCEPT}`,
)
function createAspectRatioOption(value: string): AspectRatioOption | null {
  const [width, height] = value.split(':').map((item) => Number(item))
  if (!width || !height) return null
  const scale = 28 / Math.max(width, height)
  return {
    value,
    label: value,
    boxWidth: Math.max(12, Math.round(width * scale)),
    boxHeight: Math.max(12, Math.round(height * scale)),
  }
}

function getAspectRatioOption(value: string): AspectRatioOption | null {
  // MiniMax-H3 图生/参考场景支持 adaptive（自适应）。
  if (value === 'adaptive') {
    return { value: 'adaptive', label: '自适应', boxWidth: 20, boxHeight: 20 }
  }
  return ASPECT_RATIO_OPTIONS.find((option) => option.value === value) || createAspectRatioOption(value)
}

const aspectRatioOptions = computed(() => {
  if (settingsStore.mediaType !== 'video') return ASPECT_RATIO_OPTIONS
  // MiniMax-H3 的具体比例列表依赖生成方式（仅图生/参考模式提供 adaptive）。
  const supported = getSupportedAspectRatios(settingsStore.selectedModel, videoMode.value)
  return supported
    ? supported.map(getAspectRatioOption).filter((option): option is AspectRatioOption => !!option)
    : ASPECT_RATIO_OPTIONS
})

const videoDurationOptions = computed(() => getSupportedVideoDurations(settingsStore.selectedModel) ?? [{ value: 6, label: '6s' }])

const selectedAspectRatioOption = computed(() => {
  return (
    aspectRatioOptions.value.find((option) => option.value === settingsStore.aspectRatio) ||
    aspectRatioOptions.value[0] ||
    ASPECT_RATIO_OPTIONS[0]
  )
})

const mediaTypeLabel = computed(() => (settingsStore.mediaType === 'image' ? '图像' : '视频'))
const selectedModelLabel = computed(() => settingsStore.selectedModel || '未选择模型')
const selectedVideoDurationLabel = computed(() => {
  return videoDurationOptions.value.find((option) => option.value === settingsStore.videoDuration)?.label || `${settingsStore.videoDuration}s`
})
const activeGenerateModeLabel = computed(() => {
  if (settingsStore.mediaType === 'image') {
    return imageModeOptions.find((option) => option.value === imageMode.value)?.label || '文生图'
  }
  if (usesViduLikeVideoMode.value) {
    return activeVideoModeOptions.value.find((option) => option.value === videoMode.value)?.label || '文生视频'
  }
  return uploadedFile.value ? '参考生成' : '文生视频'
})
const needsMaterialAttention = computed(() => {
  if (!showReferenceField.value) return false
  if (isImageReferenceMode.value) return !uploadedFile.value
  if (!usesViduLikeVideoMode.value) return showReferenceUrlInput.value ? !referenceUrl.value.trim() : false
  if (videoMode.value === 'image2video' || videoMode.value === 'endFrame2video') return !uploadedFile.value
  if (videoMode.value === 'motionControl2video') return !motionControlImage.value || !motionControlVideo.value
  if (videoMode.value === 'startEnd2video') return !viduStartFrame.value
  if (videoMode.value === 'referenceImage2video') return multimodalImages.value.length === 0
  if (videoMode.value === 'subjectReference2video') return !uploadedFile.value
  if (videoMode.value === 'editVideo') return !editVideoFile.value || !editImageFile.value
  return false
})
const materialSummaryLabel = computed(() => {
  if (!showReferenceField.value) return ''
  if (isImageReferenceMode.value) return uploadedFile.value ? `素材：${uploadedFile.value.name}` : '素材：待上传'
  if (showReferenceUrlInput.value) return referenceUrl.value.trim() ? '参考链接已填写' : '参考链接待填写'
  if (usesViduLikeVideoMode.value) {
    if (videoMode.value === 'image2video') return uploadedFile.value ? `参考图：${uploadedFile.value.name}` : '参考图待上传'
    if (videoMode.value === 'endFrame2video') return uploadedFile.value ? `尾帧图：${uploadedFile.value.name}` : '尾帧图待上传'
    if (videoMode.value === 'motionControl2video') {
      const count = [motionControlImage.value, motionControlVideo.value].filter(Boolean).length
      return count === 2 ? '动作素材已齐' : `动作素材 ${count}/2`
    }
    if (videoMode.value === 'startEnd2video') {
      if (viduStartFrame.value && viduEndFrame.value) return '首尾帧已添加'
      if (viduStartFrame.value) return '首帧已添加'
      return '首帧待上传'
    }
    if (videoMode.value === 'referenceImage2video') return multimodalImages.value.length ? `参考图 ${multimodalImages.value.length}/${KLING_REFERENCE_IMAGE_LIMIT}` : '参考图待上传'
    if (videoMode.value === 'multimodalReference2video') {
      const count = multimodalImages.value.length + multimodalVideos.value.length + multimodalAudios.value.length
      return count ? `多模态素材 ${count}` : '多模态素材可选'
    }
    if (videoMode.value === 'editVideo') {
      const count = [editVideoFile.value, editImageFile.value].filter(Boolean).length
      return count === 2 ? '编辑素材已齐' : `编辑素材 ${count}/2`
    }
    if (videoMode.value === 'subjectReference2video') return uploadedFile.value ? '主体参考已添加' : '主体图待上传'
  }
  return uploadedFile.value ? `素材：${uploadedFile.value.name}` : '素材可选'
})

watch(needsMaterialAttention, (needsAttention) => {
  if (needsAttention) isComposerControlsOpen.value = true
})

const inputPlaceholder = computed(() => {
  if (usesViduLikeVideoMode.value && videoMode.value === 'text2video') {
    return '描述你想生成的视频：场景、运动、节奏、情绪和镜头语言。'
  }
  if (usesViduLikeVideoMode.value && videoMode.value === 'image2video') {
    return '描述参考图如何动起来：主体运动、镜头推进、节奏和氛围。'
  }
  if (usesViduLikeVideoMode.value && videoMode.value === 'endFrame2video') {
    return '描述视频如何走向这个结尾画面：动作走向、镜头运动与氛围。'
  }
  if (usesViduLikeVideoMode.value && videoMode.value === 'motionControl2video') {
    return '描述参考图中的人物外观、服装和场景，并结合参考视频控制人物动作。'
  }
  if (usesViduLikeVideoMode.value && videoMode.value === 'startEnd2video') {
    return '描述首帧到尾帧之间的变化过程、镜头运动、节奏和氛围。'
  }
  if (isMentionReferenceMode.value) {
    return '描述生成目标，可输入 @ 引用图片、视频或音频，例如「让 @图片1 的角色走向 @视频1 的场景，并配合 @音频1 的节奏」。'
  }
  if (isMinimaxHailuoVideoModel.value && videoMode.value === 'subjectReference2video') {
    return '描述人物主体在视频中的动作、表情、镜头运动和氛围。'
  }
  if (isImageReferenceMode.value) {
    return '描述你希望参考图如何变化：风格、光线、细节、构图。'
  }
  if (settingsStore.mediaType === 'video' && uploadedFile.value?.type === 'image') {
    return '描述你希望参考图如何动起来：主体运动、镜头推进、节奏和氛围。'
  }
  if (settingsStore.mediaType === 'video' && uploadedFile.value?.type === 'video') {
    return '描述你希望参考视频如何延展：运动、镜头、节奏、氛围。'
  }
  return settingsStore.mediaType === 'image'
    ? '描述你想生成的画面：主体、氛围、镜头、色彩、质感。'
    : '描述你想生成的视频：场景、运动、节奏、情绪和镜头语言。'
})

const canSend = computed(() => {
  if (!inputText.value.trim()) return false
  if (usesViduLikeVideoMode.value) {
    if (videoMode.value === 'text2video') return true
    if (videoMode.value === 'multimodalReference2video') return true
    // 编辑视频：需上传待编辑视频 + 替换图片
    if (videoMode.value === 'editVideo') return !!editVideoFile.value && !!editImageFile.value
    // 参考生视频（Kling Omni / O1）：至少 1 张参考图片（复用 multimodalImages）
    if (videoMode.value === 'referenceImage2video') return multimodalImages.value.length > 0


    if (videoMode.value === 'image2video' || videoMode.value === 'endFrame2video') return !!uploadedFile.value


    if (videoMode.value === 'motionControl2video') return !!motionControlImage.value && !!motionControlVideo.value
    // 首尾帧生视频：首帧必填，尾帧可选。
    if (videoMode.value === 'startEnd2video') return !!viduStartFrame.value

    return !!uploadedFile.value || !!referenceUrl.value.trim()
  }

  if (settingsStore.mediaType === 'image' && imageMode.value === 'image2image') {
    return supportsImageReferenceMode.value && !!uploadedFile.value
  }
  if (modelCapability.value?.availabilityNote === 'requires-image-upload' || modelCapability.value?.availabilityNote === 'requires-video-upload') {
    return !!uploadedFile.value || !!referenceUrl.value.trim()
  }
  if (!requiresUpload.value) return true
  return !!uploadedFile.value || !!referenceUrl.value.trim()
})

function buildSessionWelcomeMessage(): Omit<Message, 'id' | 'timestamp'> {
  return {
    type: 'system',
    content: [
      '👋 欢迎来到 ArtRealm AI「简易模式」！这里专为快速出图、灵感速写而设计，一句话即可生成图像或视频。',
      '',
      '🖼️ 图像生成：支持「文生图」与「图生图」两种方式，快速把创意变成画面。',
      '🎬 视频生成：覆盖文生视频、图生视频、首尾帧生视频、主体参考视频与动作控制等多种玩法。',
      '📐 参数可调：可自由选择画面比例、视频时长，快速匹配不同创作场景。',
      '✨ AI 润色：一键把简短描述扩写成更专业的提示词（需先在「设置」中配置润色模型）。',
      '🧩 无限画布（BETA）：想要多画面并行、串联复杂创作流程？点击左侧「无限画布」体验节点式创作。',

      '',
      '💡 上手很简单：选择创作类型与模型 → 写下你的创意描述 → 点击发送即可开始生成。',
    ].join('\n'),


  }
}


function ensureWelcomeMessage() {
  if (chatStore.messages.length > 0) return
  chatStore.addMessage(buildSessionWelcomeMessage())
}

function handleMediaTypeChange(nextType: MediaType) {
  settingsStore.setMediaType(nextType)
  ensureSupportedAspectRatio()
  imageMode.value = 'text2image'
  videoMode.value = 'text2video'
  removeUploadedFile()
  removeViduFrames()
  removeMotionControlFiles()
  clearMultimodalAssets()
  clearEditFiles()
  referenceUrl.value = ''
}


function setImageMode(mode: ImageMode) {

  if (mode === 'image2image' && !supportsImageReferenceMode.value) return
  if (imageMode.value === mode) return
  imageMode.value = mode
  removeUploadedFile()
  referenceUrl.value = ''
}

function setVideoMode(mode: VideoMode) {
  if (videoMode.value === mode) return
  videoMode.value = mode
  removeUploadedFile()
  removeViduFrames()
  removeMotionControlFiles()
  clearMultimodalAssets()
  clearEditFiles()
  showMentionMenu.value = false
  referenceUrl.value = ''
  // 模式切换会影响可选比例（如 MiniMax-H3 仅图生/参考模式提供 adaptive），需要重新校验。
  ensureSupportedAspectRatio()
}




function selectAspectRatio(value: string) {

  if (!aspectRatioOptions.value.some((option) => option.value === value)) return
  settingsStore.aspectRatio = value
  settingsStore.saveToStorage()
}

function handleAspectRatioMenuSelect(value: string) {
  selectAspectRatio(value)
  showAspectRatioMenu.value = false
}

function ensureSupportedAspectRatio() {
  if (!aspectRatioOptions.value.length) return
  if (aspectRatioOptions.value.some((option) => option.value === settingsStore.aspectRatio)) return
  settingsStore.aspectRatio = aspectRatioOptions.value[0]?.value || '1:1'
  settingsStore.saveToStorage()
}

function ensureSupportedVideoDuration() {
  if (settingsStore.mediaType !== 'video') return
  if (videoDurationOptions.value.some((option) => option.value === settingsStore.videoDuration)) return
  settingsStore.videoDuration = getDefaultVideoDuration(settingsStore.selectedModel)
  settingsStore.saveToStorage()
}

function releaseUploadedFile(file: UploadedFile | null | undefined) {
  if (file?.file && file.url.startsWith('blob:')) {
    URL.revokeObjectURL(file.url)
  }
}

function createUploadedFile(file: File, type: UploadedFile['type'], dimensions?: ImageDimensions): UploadedFile {
  return {
    name: file.name,
    type,
    url: URL.createObjectURL(file),
    size: file.size,
    file,
    dimensions,
  }
}

function dataUrlToFile(dataUrl: string, name: string, type: string): File {
  const [meta, base64] = dataUrl.split(',')
  const mime = type || meta.match(/data:([^;]+)/)?.[1] || 'image/png'
  const binary = atob(base64 || '')
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return new File([bytes], name, { type: mime })
}

function restoreLandingReferenceImage() {
  if (route.query.reference !== 'landing') return
  const raw = sessionStorage.getItem(LANDING_REFERENCE_STORAGE_KEY)
  if (!raw) return

  try {
    const parsed = JSON.parse(raw) as { name?: string; type?: string; size?: number; dataUrl?: string }
    if (!parsed.dataUrl) return
    const file = dataUrlToFile(parsed.dataUrl, parsed.name || 'landing-reference.png', parsed.type || 'image/png')
    removeUploadedFile()
    uploadedFile.value = createUploadedFile(file, 'image')
    if (supportsImageReferenceMode.value) imageMode.value = 'image2image'
  } catch (error) {
    showErrorMessage(getReadableErrorMessage(error, '首页参考图读取失败，请重新上传。'))
  } finally {
    sessionStorage.removeItem(LANDING_REFERENCE_STORAGE_KEY)
  }
}

function getGreatestCommonDivisor(a: number, b: number): number {
  let x = Math.abs(a)
  let y = Math.abs(b)
  while (y) {
    const next = x % y
    x = y
    y = next
  }
  return x || 1
}

function getAspectRatioLabel(dimensions: ImageDimensions): string {
  const divisor = getGreatestCommonDivisor(dimensions.width, dimensions.height)
  return `${dimensions.width / divisor}:${dimensions.height / divisor}`
}

function hasSameAspectRatio(a: ImageDimensions, b: ImageDimensions): boolean {
  return a.width * b.height === b.width * a.height
}

function getImageDimensions(file: File): Promise<ImageDimensions> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      const dimensions = {
        width: image.naturalWidth,
        height: image.naturalHeight,
      }
      URL.revokeObjectURL(objectUrl)
      if (!dimensions.width || !dimensions.height) {
        reject(new Error('无法读取图片尺寸'))
        return
      }
      resolve(dimensions)
    }
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('无法读取图片尺寸'))
    }
    image.src = objectUrl
  })
}

async function resolveUploadedImageDimensions(uploadedFile: UploadedFile): Promise<ImageDimensions | null> {
  if (uploadedFile.dimensions) return uploadedFile.dimensions
  if (!uploadedFile.file) return null
  const dimensions = await getImageDimensions(uploadedFile.file)
  uploadedFile.dimensions = dimensions
  return dimensions
}

function showViduFrameAspectRatioError(startDimensions: ImageDimensions, endDimensions: ImageDimensions) {
  showErrorMessage(
    `首帧和尾帧图片比例必须相同。当前首帧为 ${getAspectRatioLabel(startDimensions)}，尾帧为 ${getAspectRatioLabel(endDimensions)}。`,
  )
}

async function validateViduFrameAspectRatio(): Promise<boolean> {
  if (!viduStartFrame.value || !viduEndFrame.value) return true
  try {
    const startDimensions = await resolveUploadedImageDimensions(viduStartFrame.value)
    const endDimensions = await resolveUploadedImageDimensions(viduEndFrame.value)
    if (!startDimensions || !endDimensions) return true
    if (hasSameAspectRatio(startDimensions, endDimensions)) return true
    showViduFrameAspectRatioError(startDimensions, endDimensions)
    return false
  } catch (error) {
    showErrorMessage('无法读取首帧或尾帧图片尺寸，请重新上传图片后再试。')
    return false
  }
}

function removeUploadedFile(options: { revoke?: boolean } = {}) {
  if (options.revoke !== false) {
    releaseUploadedFile(uploadedFile.value)
  }
  uploadedFile.value = null
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}

function removeViduFrame(position: 'start' | 'end', options: { revoke?: boolean } = {}) {
  if (position === 'start') {
    if (options.revoke !== false) {
      releaseUploadedFile(viduStartFrame.value)
    }
    viduStartFrame.value = null
    if (viduStartInput.value) viduStartInput.value.value = ''
    return
  }
  if (options.revoke !== false) {
    releaseUploadedFile(viduEndFrame.value)
  }
  viduEndFrame.value = null
  if (viduEndInput.value) viduEndInput.value.value = ''
}

function removeViduFrames(options: { revoke?: boolean } = {}) {
  removeViduFrame('start', options)
  removeViduFrame('end', options)
}

function removeMotionControlFile(type: 'image' | 'video', options: { revoke?: boolean } = {}) {
  if (type === 'image') {
    if (options.revoke !== false) releaseUploadedFile(motionControlImage.value)
    motionControlImage.value = null
    if (motionControlImageInput.value) motionControlImageInput.value.value = ''
    return
  }

  if (options.revoke !== false) releaseUploadedFile(motionControlVideo.value)
  motionControlVideo.value = null
  if (motionControlVideoInput.value) motionControlVideoInput.value.value = ''
}

function removeMotionControlFiles(options: { revoke?: boolean } = {}) {
  removeMotionControlFile('image', options)
  removeMotionControlFile('video', options)
}

function handleFileChange(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  const capability = getModelCapability(settingsStore.selectedModel)
  const fileKind = classifySupportedFile(file)
  if (!fileKind) {
    showErrorMessage(`仅支持常见格式：图片（${IMAGE_FORMAT_HINT}）、视频（${VIDEO_FORMAT_HINT}）`)
    target.value = ''
    return
  }
  const isImage = fileKind === 'image'
  const isVideo = fileKind === 'video'

  if (isImage && !capability?.localUploadInputs?.includes('image')) {
    showErrorMessage('当前模型不支持本地图片上传')
    return
  }

  if (isVideo && !capability?.localUploadInputs?.includes('video')) {
    showErrorMessage('当前模型不支持本地视频上传')
    return
  }

  removeUploadedFile()
  uploadedFile.value = createUploadedFile(file, isImage ? 'image' : 'video')
}

async function handleViduFrameChange(e: Event, position: 'start' | 'end') {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  const frameFormatError = validateUploadFileKind(file, 'image')
  if (frameFormatError) {
    showErrorMessage(`首尾帧生视频仅支持常见图片格式（${IMAGE_FORMAT_HINT}）`)
    target.value = ''
    return
  }

  let dimensions: ImageDimensions
  try {
    dimensions = await getImageDimensions(file)
  } catch (error) {
    showErrorMessage('无法读取图片尺寸，请重新上传图片后再试。')
    target.value = ''
    return
  }

  const oppositeFrame = position === 'start' ? viduEndFrame.value : viduStartFrame.value
  if (oppositeFrame) {
    try {
      const oppositeDimensions = await resolveUploadedImageDimensions(oppositeFrame)
      if (oppositeDimensions && !hasSameAspectRatio(dimensions, oppositeDimensions)) {
        if (position === 'start') {
          showViduFrameAspectRatioError(dimensions, oppositeDimensions)
        } else {
          showViduFrameAspectRatioError(oppositeDimensions, dimensions)
        }
        target.value = ''
        return
      }
    } catch (error) {
      showErrorMessage('无法读取已上传图片尺寸，请重新上传首帧和尾帧。')
      target.value = ''
      return
    }
  }

  removeViduFrame(position)
  const uploaded = createUploadedFile(file, 'image', dimensions)
  // 标记首/尾帧用途，供 buildParams（尤其是 kling-omni 首尾帧）区分帧图与参考图。
  uploaded.purpose = position === 'start' ? 'start-frame' : 'end-frame'
  if (position === 'start') {
    viduStartFrame.value = uploaded
  } else {
    viduEndFrame.value = uploaded
  }
}

function handleMotionControlFileChange(e: Event, type: 'image' | 'video') {

  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  const motionFormatError = validateUploadFileKind(file, type)
  if (motionFormatError) {
    showErrorMessage(
      type === 'image'
        ? `动作控制参考图像仅支持常见图片格式（${IMAGE_FORMAT_HINT}）`
        : `动作控制参考视频仅支持常见视频格式（${VIDEO_FORMAT_HINT}）`,
    )
    target.value = ''
    return
  }

  removeMotionControlFile(type)
  const uploaded = createUploadedFile(file, type)
  uploaded.purpose = type === 'image' ? 'motion-control-image' : 'motion-control-video'
  if (type === 'image') {
    motionControlImage.value = uploaded
  } else {
    motionControlVideo.value = uploaded
  }
}

// ---- 编辑视频（Seedance 2.0）相关：固定 1 视频 + 1 图片 ----

function handleEditFileChange(e: Event, type: 'image' | 'video') {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  const editFormatError = validateUploadFileKind(file, type)
  if (editFormatError) {
    showErrorMessage(editFormatError)
    target.value = ''
    return
  }

  removeEditFile(type)
  const uploaded = createUploadedFile(file, type)
  // 与多模态参考保持一致的 purpose / refLabel，交由 buildParams 分类为 reference_image / reference_video
  uploaded.purpose = type === 'image' ? 'multimodal-image' : 'multimodal-video'
  uploaded.refLabel = type === 'image' ? '图片1' : '视频1'
  if (type === 'image') {
    editImageFile.value = uploaded
  } else {
    editVideoFile.value = uploaded
  }
  target.value = ''
}

function removeEditFile(type: 'image' | 'video', options: { revoke?: boolean } = {}) {
  if (type === 'image') {
    if (options.revoke !== false) releaseUploadedFile(editImageFile.value)
    editImageFile.value = null
    if (editImageInput.value) editImageInput.value.value = ''
    return
  }
  if (options.revoke !== false) releaseUploadedFile(editVideoFile.value)
  editVideoFile.value = null
  if (editVideoInput.value) editVideoInput.value.value = ''
}

function clearEditFiles(options: { revoke?: boolean } = {}) {
  removeEditFile('image', options)
  removeEditFile('video', options)
}

// ---- 多模态参考（Seedance 2.0）相关 ----


function multimodalRefFromType(type: 'image' | 'video' | 'audio') {
  return type === 'image' ? multimodalImages : type === 'video' ? multimodalVideos : multimodalAudios
}

function multimodalLabelPrefix(type: 'image' | 'video' | 'audio') {
  return type === 'image' ? '图片' : type === 'video' ? '视频' : '音频'
}

/** 重新编号某一类素材的 refLabel（图片1、图片2……）。 */
function relabelMultimodal(type: 'image' | 'video' | 'audio') {
  const list = multimodalRefFromType(type).value
  const prefix = multimodalLabelPrefix(type)
  list.forEach((item, index) => {
    item.refLabel = `${prefix}${index + 1}`
  })
}

function handleMultimodalFileChange(e: Event, type: 'image' | 'video' | 'audio') {
  const target = e.target as HTMLInputElement
  const files = Array.from(target.files || [])
  if (!files.length) return

  const listRef = multimodalRefFromType(type)
  const limit = MULTIMODAL_LIMITS[type]

  for (const file of files) {
    if (listRef.value.length >= limit) {
      showErrorMessage(`${multimodalLabelPrefix(type)}最多上传 ${limit} 个。`)
      break
    }
    const formatError = type === 'audio'
      ? (!file.type.startsWith('audio/') ? '请上传正确的音频文件。' : null)
      : validateUploadFileKind(file, type)
    if (formatError) {
      showErrorMessage(formatError)
      continue
    }
    const uploaded = createUploadedFile(file, type)
    uploaded.purpose = type === 'image' ? 'multimodal-image' : type === 'video' ? 'multimodal-video' : 'multimodal-audio'
    listRef.value.push(uploaded)
  }
  relabelMultimodal(type)
  target.value = ''
}

function removeMultimodalAsset(type: 'image' | 'video' | 'audio', item: UploadedFile) {
  const listRef = multimodalRefFromType(type)
  const index = listRef.value.findIndex((entry) => entry.url === item.url)
  if (index < 0) return
  releaseUploadedFile(listRef.value[index])
  listRef.value.splice(index, 1)
  relabelMultimodal(type)
}

function clearMultimodalAssets(options: { revoke?: boolean } = {}) {
  const revoke = options.revoke !== false
  for (const listRef of [multimodalImages, multimodalVideos, multimodalAudios]) {
    if (revoke) listRef.value.forEach((item) => releaseUploadedFile(item))
    listRef.value = []
  }
}

/**
 * 输入框键盘处理：
 * - 当 @ 引用菜单打开时：↑/↓ 切换高亮项，Enter/Tab 选中当前项，Esc 关闭菜单；
 * - 菜单关闭时：Enter 仅作为普通换行（不再触发发送）。
 */
function handleComposerKeydown(event: KeyboardEvent) {
  if (event.isComposing) return
  if (!showMentionMenu.value || !mentionableAssets.value.length) return

  const total = mentionableAssets.value.length
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault()
      activeMentionIndex.value = (activeMentionIndex.value + 1) % total
      break
    case 'ArrowUp':
      event.preventDefault()
      activeMentionIndex.value = (activeMentionIndex.value - 1 + total) % total
      break
    case 'Enter':
    case 'Tab': {
      event.preventDefault()
      const item = mentionableAssets.value[activeMentionIndex.value]
      if (item) insertMentionReference(item)
      break
    }
    case 'Escape':
      event.preventDefault()
      showMentionMenu.value = false
      mentionAtIndex.value = -1
      break
    default:
      break
  }
}

/** 在光标处插入 @素材标签 引用。 */
function insertMentionReference(item: UploadedFile) {
  const label = item.refLabel || item.name
  const textarea = promptInputRef.value
  const insertText = `@${label} `
  if (!textarea) {
    inputText.value += insertText
  } else {
    const currentValue = textarea.value ?? inputText.value
    const start = mentionAtIndex.value >= 0 ? mentionAtIndex.value : textarea.selectionStart
    const end = textarea.selectionStart
    const before = currentValue.slice(0, start)
    const after = currentValue.slice(end)
    inputText.value = `${before}${insertText}${after}`
  }
  showMentionMenu.value = false
  mentionAtIndex.value = -1
  nextTick(() => promptInputRef.value?.focus())
}

/** 监听输入，检测末尾的 @ 以触发引用菜单。 */
function handlePromptInput(event?: Event) {
  if (!isMentionReferenceMode.value || !mentionableAssets.value.length) {
    showMentionMenu.value = false
    return
  }

  const textarea = promptInputRef.value
  const currentValue =
    (event?.target as HTMLTextAreaElement | undefined)?.value ??
    textarea?.value ??
    inputText.value
  const caret = textarea ? textarea.selectionStart : inputText.value.length
  const textBefore = currentValue.slice(0, caret)
  const atIndex = textBefore.lastIndexOf('@')
  if (atIndex >= 0 && !/\s/.test(textBefore.slice(atIndex + 1))) {
    mentionAtIndex.value = atIndex
    // 菜单（重新）打开时，若高亮索引越界则复位到第一项
    if (!showMentionMenu.value || activeMentionIndex.value >= mentionableAssets.value.length) {
      activeMentionIndex.value = 0
    }
    showMentionMenu.value = true
    void positionMentionMenu()
  } else {
    showMentionMenu.value = false
    mentionAtIndex.value = -1
  }
}

/** 将 @ 引用菜单定位到输入框附近，避免被父容器的 overflow/backdrop-filter 裁切。 */
async function positionMentionMenu() {
  await nextTick()
  const textarea = promptInputRef.value
  const menu = mentionMenuRef.value
  if (!textarea || !menu) return

  const rect = textarea.getBoundingClientRect()
  const gap = 8
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  const menuWidth = Math.max(menu.offsetWidth || 180, 180)
  const menuHeight = Math.min(menu.scrollHeight || 44, 220)
  const availableBelow = viewportHeight - rect.bottom - gap
  const availableAbove = rect.top - gap
  const maxHeight = Math.max(96, Math.min(220, Math.max(availableBelow, availableAbove) - gap))
  const placeBelow = availableBelow >= Math.min(menuHeight, maxHeight) || availableBelow >= availableAbove
  const left = Math.min(Math.max(8, rect.left), Math.max(8, viewportWidth - menuWidth - 8))
  const top = placeBelow
    ? rect.bottom + gap
    : Math.max(8, rect.top - Math.min(menuHeight, maxHeight) - gap)

  mentionMenuStyle.value = {
    position: 'fixed',
    top: `${top}px`,
    left: `${left}px`,
    bottom: 'auto',
    width: `${menuWidth}px`,
    maxHeight: `${maxHeight}px`,
  }
}

async function handlePolishPrompt() {

  const prompt = inputText.value.trim()
  try {
    validatePromptOrThrow(prompt)
  } catch (error) {
    alert(getReadableErrorMessage(error, '请检查提示词后重试。'))
    return
  }

  const model = settingsStore.promptPolishModel.trim()
  if (!model) {
    showErrorMessage('请先在设置中填写用于 AI 润色的模型 ID。')
    return
  }

  isPolishing.value = true
  try {
    inputText.value = await polishPrompt({
      model,
      messages: [
        {
          role: 'system',
          content: settingsStore.promptPolishSystemPrompt.trim() || DEFAULT_PROMPT_POLISH_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
    })
    await nextTick()
    promptInputRef.value?.focus()
  } catch (error) {
    alert(getReadableErrorMessage(error, '润色失败，请稍后重试。'))
  } finally {
    isPolishing.value = false
  }
}

async function handleCopyPrompt(prompt: string) {
  inputText.value = prompt
  await nextTick()
  promptInputRef.value?.focus()
}

/**
 * 插入运镜指令 / 示例到提示词（MiniMax 海螺系列）。
 * 优先在光标处插入，否则追加到末尾，并自动处理空格。
 */
function insertCameraCommand(text: string) {
  const textarea = promptInputRef.value
  if (!textarea) {
    const current = inputText.value
    inputText.value = current && !current.endsWith(' ') ? `${current} ${text}` : `${current}${text}`
    return
  }
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const before = inputText.value.slice(0, start)
  const after = inputText.value.slice(end)
  const needsLeadingSpace = before.length > 0 && !before.endsWith(' ')
  const insert = needsLeadingSpace ? ` ${text}` : text
  inputText.value = `${before}${insert}${after}`
  nextTick(() => {
    const caret = before.length + insert.length
    textarea.focus()
    textarea.setSelectionRange(caret, caret)
  })
}

async function toggleComposerExpanded() {
  const nextExpanded = !isComposerExpanded.value
  isComposerExpanded.value = nextExpanded
  composerTextareaHeight.value = nextExpanded
    ? Math.max(composerTextareaHeight.value, COMPOSER_TEXTAREA_EXPANDED)
    : COMPOSER_TEXTAREA_DEFAULT
  await nextTick()
  promptInputRef.value?.focus()
}

function scrollChatToBottom() {
  chatAreaRef.value?.scrollTo({ top: chatAreaRef.value.scrollHeight, behavior: 'smooth' })
}

onMounted(async () => {
  settingsStore.loadFromStorage()
  sessionStorage.removeItem('artrealm_landing_pending_prompt')
  if (route.query.type === 'image') {
    settingsStore.setMediaType('image')
    imageMode.value = 'text2image'
  }
  ensureSupportedAspectRatio()
  ensureSupportedVideoDuration()
  ensureWelcomeMessage()
  restoreLandingReferenceImage()
  const initialPrompt = typeof route.query.prompt === 'string' ? route.query.prompt.trim() : ''
  if (initialPrompt) {
    inputText.value = initialPrompt
    await nextTick()
    if (route.query.autosend === '1') {
      handleSend()
    } else {
      promptInputRef.value?.focus()
    }
  }
})

onBeforeUnmount(() => {
  releaseUploadedFile(uploadedFile.value)
  releaseUploadedFile(viduStartFrame.value)
  releaseUploadedFile(viduEndFrame.value)
  releaseUploadedFile(motionControlImage.value)
  releaseUploadedFile(motionControlVideo.value)
  releaseUploadedFile(editVideoFile.value)
  releaseUploadedFile(editImageFile.value)
  clearMultimodalAssets()
})



watch(
  () => settingsStore.selectedModel,
  () => {
    const capability = getModelCapability(settingsStore.selectedModel)
    if (!supportsImageReferenceMode.value) {
      imageMode.value = 'text2image'
    }
    const usesModeSwitcher = settingsStore.mediaType === 'video' && ['viduq3-fast', 'minimax-hailuo', 'minimax-h3', 'kling-v26', 'kling-v3', 'kling-omni', 'seedance-2'].includes(capability?.videoRequestMode || '')
    if (!usesModeSwitcher) {
      videoMode.value = 'text2video'
      removeViduFrames()
      removeMotionControlFiles()
      clearMultimodalAssets()
    }
    if (!activeVideoModeOptions.value.some((option) => option.value === videoMode.value)) {
      videoMode.value = 'text2video'
      removeViduFrames()
      removeMotionControlFiles()
      clearMultimodalAssets()
    }

    if (uploadedFile.value?.type === 'image' && !capability?.localUploadInputs?.includes('image')) {
      removeUploadedFile()
    }
    if (uploadedFile.value?.type === 'video' && !capability?.localUploadInputs?.includes('video')) {
      removeUploadedFile()
    }
    if (!showReferenceUrlInput.value) {
      referenceUrl.value = ''
    }
    ensureSupportedAspectRatio()
    ensureSupportedVideoDuration()
    showAspectRatioMenu.value = false
  }
)

watch(
  () => chatStore.messages.length,
  async () => {
    await nextTick()
    scrollChatToBottom()
  }
)

async function handleSend() {
  const prompt = inputText.value.trim()

  try {
    validatePromptOrThrow(prompt)
  } catch (error) {
    alert(getReadableErrorMessage(error, '提示词校验失败，请修改后重试。'))
    return
  }

  if (!canSend.value || activeSessionGenerating.value) return

  if (usesViduLikeVideoMode.value && videoMode.value === 'startEnd2video') {
    const isAspectRatioValid = await validateViduFrameAspectRatio()
    if (!isAspectRatioValid) return
  }

  inputText.value = ''

  const file: UploadedFile | UploadedFile[] | null = usesViduLikeVideoMode.value
    ? videoMode.value === 'image2video'
      ? uploadedFile.value
      : videoMode.value === 'motionControl2video' && motionControlImage.value && motionControlVideo.value
        ? [
            {
              ...motionControlImage.value,
              motionControlOptions: {
                keep_original_sound: motionControlKeepOriginalSound.value,
                character_orientation: motionControlCharacterOrientation.value,
              },
            },
            motionControlVideo.value,
          ]
      : videoMode.value === 'endFrame2video'
        ? (uploadedFile.value ? [{ ...uploadedFile.value, purpose: 'end-frame' as const }] : null)
      : videoMode.value === 'startEnd2video' && viduStartFrame.value
        ? (viduEndFrame.value ? [viduStartFrame.value, viduEndFrame.value] : [viduStartFrame.value])

        : videoMode.value === 'referenceImage2video'
          ? (multimodalImages.value.length ? [...multimodalImages.value] : null)
        : videoMode.value === 'multimodalReference2video' || videoMode.value === 'editVideo'

          ? (mentionableAssets.value.length ? [...mentionableAssets.value] : null)


        : videoMode.value === 'subjectReference2video'
          ? (uploadedFile.value ? { ...uploadedFile.value, name: 'Subject Reference' } : null)
          : null

    : uploadedFile.value ||

      (referenceUrl.value.trim()
        ? {
            name: 'Reference URL',
            type: 'image' as const,
            url: referenceUrl.value.trim(),
            size: 0,
          }
        : null)

  removeUploadedFile({ revoke: false })
  removeViduFrames({ revoke: false })
  removeMotionControlFiles({ revoke: false })
  clearMultimodalAssets({ revoke: false })
  showMentionMenu.value = false
  referenceUrl.value = ''

  const primaryFile = Array.isArray(file) ? file[0] : file


  const ioType = resolveGenerateIoType(settingsStore.mediaType, primaryFile)

  await nextTick()
  scrollChatToBottom()
  await generate(prompt, ioType, settingsStore.selectedModel, file, settingsStore.aspectRatio, settingsStore.videoDuration, false, skillStore.activeSkill?.content || null, settingsStore.videoResolution)



  settingsStore.saveToStorage()

  await nextTick()
  scrollChatToBottom()
}

async function handleRegenerate(message: Message) {
  const idx = activeMessages.value.findIndex((m) => m.id === message.id)
  const userMsg = idx > 0 ? activeMessages.value[idx - 1] : null
  if (userMsg && userMsg.type === 'user') {
    const model = userMsg.model || settingsStore.selectedModel
    const aspectRatio = userMsg.aspectRatio || settingsStore.aspectRatio
    const duration = userMsg.duration || settingsStore.videoDuration
    await generate(
      userMsg.content,
      resolveGenerateIoType(settingsStore.mediaType, userMsg.uploadedFiles?.[0] || userMsg.uploadedFile),
      model,
      userMsg.uploadedFiles || userMsg.uploadedFile || null,
      aspectRatio,
      duration,
      false,
      skillStore.activeSkill?.content || null,
      settingsStore.videoResolution,
    )
    await nextTick()
    scrollChatToBottom()
  }
}
</script>

<style scoped>
.chat-page {
  position: relative;
  height: 100dvh;
  padding: 16px 18px 18px;
  overflow: hidden;
  background: transparent;
  isolation: isolate;
  --surface-glass: rgba(255, 255, 255, 0.76);
  --surface-glass-strong: rgba(255, 255, 255, 0.92);
  --surface-line: rgba(255, 255, 255, 0.78);
  --surface-shadow: 0 24px 70px rgba(15, 23, 42, 0.10);
  --surface-shadow-soft: 0 12px 34px rgba(15, 23, 42, 0.07);
}

.chat-page::before {
  content: '';
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background:
    radial-gradient(circle at 16% 10%, rgba(255, 255, 255, 0.92), transparent 0 23%),
    radial-gradient(circle at 76% 18%, rgba(10, 132, 255, 0.14), transparent 0 20%),
    radial-gradient(circle at 45% 92%, rgba(17, 24, 39, 0.06), transparent 0 24%),
    linear-gradient(135deg, rgba(252, 253, 255, 0.96), rgba(238, 243, 249, 0.94) 52%, rgba(246, 247, 249, 0.98));
}

.chat-page::after {
  content: '';
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  opacity: 0.42;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.36) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.30) 1px, transparent 1px);
  background-size: 64px 64px;
  mask-image: radial-gradient(circle at 50% 48%, #000, transparent 74%);
}

.workspace-shell,
.session-sidebar,
.workspace-main,
.chat-stage,
.composer-dock {
  position: relative;
}

.workspace-shell {
  width: min(100%, 1480px);
  height: calc(100dvh - 34px);
  margin: 0 auto;
  display: grid;
  grid-template-columns: 224px minmax(0, 1fr);
  gap: 18px;
  min-height: 0;
  z-index: 1;
}

.single-session-layout {
  grid-template-columns: 224px minmax(0, 1fr);
}

.session-sidebar {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 16px;
  min-height: 0;
  padding: 16px 14px 14px;
  border-radius: 28px;
  border: 1px solid var(--surface-line);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.88), rgba(250, 251, 253, 0.70));
  box-shadow: var(--surface-shadow-soft);
  backdrop-filter: blur(28px) saturate(135%);
}

.single-session-sidebar {
  justify-content: space-between;
}

.single-session-top {
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
}

.brand-lockup {
  display: inline-flex;
  align-items: center;
  min-width: 0;
  width: 100%;
  padding: 6px 4px;
}

.brand-title {
  font-size: clamp(22px, 1.7vw, 28px);
  font-weight: 800;
  letter-spacing: -0.06em;
  line-height: 1;
  font-family: "Georgia", "Times New Roman", serif;
  font-style: italic;
  background: linear-gradient(135deg, #24262d 0%, #343842 58%, #0a84ff 135%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.single-session-card-panel {
  cursor: default;
}

.single-session-card-head {
  margin-bottom: 10px;
}

/* 简易模式说明卡片 */
.mode-intro-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 12px 14px;
  border-radius: 18px;
  border: 1px solid rgba(255, 255, 255, 0.82);
  background:
    linear-gradient(160deg, rgba(255, 255, 255, 0.92), rgba(244, 247, 251, 0.74)),
    radial-gradient(circle at 0 0, rgba(10, 132, 255, 0.12), transparent 38%);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.82), 0 10px 24px rgba(15, 23, 42, 0.05);
}

.mode-intro-badge {
  align-self: flex-start;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.02em;
  color: #fff;
  background: var(--color-theme-gradient);
  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.18);
}

.mode-intro-desc {
  margin: 0;
  font-size: 12px;
  line-height: 1.65;
  color: rgba(71, 85, 105, 0.86);
}

/* 侧边栏「创作 Skill」独立按钮（位于无限画布按钮上方） */
.skill-create-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 44px;
  padding: 0 18px;
  border: 0;
  border-radius: 16px;
  cursor: pointer;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: #fff;
  background: var(--color-theme-gradient);
  box-shadow: 0 14px 28px rgba(0, 0, 0, 0.18);
  transition: transform var(--transition-base), box-shadow var(--transition-base);
}

.skill-create-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 18px 34px rgba(0, 0, 0, 0.24);
}

.skill-create-icon {
  font-size: 14px;
  line-height: 1;
}

/* 无限画布：黑色平面按钮 + NEW 标志 */

.canvas-entry-btn {

  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 44px;
  padding: 0 18px;
  border: 0;
  border-radius: 16px;
  cursor: pointer;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: #f8fafc;
  background: #24262d;
  transition: background var(--transition-base);
}

.canvas-entry-btn:hover {
  background: #2c2c2e;
}

.canvas-entry-text {
  position: relative;
  z-index: 1;
}

.canvas-entry-new {
  display: inline-flex;
  align-items: center;
  z-index: 2;
  padding: 2px 7px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.06em;
  line-height: 1.2;
  color: #fff;
  background: #ff5f6d;
}




.sidebar-secondary-btn,
.sidebar-danger-btn,
.switch-btn,
.composer-summary,
.summary-toggle,
.ratio-current-btn,
.upload-btn,
.icon-btn,
.polish-btn,
.send-btn,
.text-btn,
.reference-input {
  transition:
    transform var(--transition-base),
    background var(--transition-base),
    border-color var(--transition-base),
    box-shadow var(--transition-base),
    opacity var(--transition-base);
}

.workspace-main {
  min-width: 0;
  min-height: 0;
  height: 100%;
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
  gap: 14px;
  overflow: hidden;
}

.chat-stage,
.composer-dock,
.session-card {
  border: 1px solid var(--surface-line);
  background: var(--surface-glass);
  box-shadow: var(--surface-shadow-soft);
  backdrop-filter: blur(28px) saturate(140%);
  background-clip: padding-box;
}

.status-label,
.session-meta-line.subtle,
.empty-kicker,
.empty-copy,
.duration-label {
  color: rgba(71, 85, 105, 0.78);
}

.chat-stage {
  min-height: 0;
  display: flex;
  flex-direction: column;
  border-radius: 32px;
  padding: 12px;
  overflow: hidden;
}

.chat-stage {
  border-bottom-color: rgba(255, 255, 255, 0.78);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.88), rgba(250, 251, 253, 0.74)),
    radial-gradient(circle at 50% 0%, rgba(10, 132, 255, 0.06), transparent 36%);
}

.chat-area {
  flex: 1 1 auto;
  min-height: 0;
  height: 100%;
  overflow-x: hidden;
  overflow-y: auto;
  padding: 12px 8px 12px 4px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.empty-state {
  margin: auto;
  max-width: 560px;
  padding: 44px 34px;
  text-align: center;
  border: 1px solid rgba(255, 255, 255, 0.74);
  border-radius: 30px;
  background: rgba(255, 255, 255, 0.42);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.88);
}

.empty-kicker {
  margin: 0 0 8px;
  text-transform: uppercase;
  letter-spacing: 0.28em;
  font-size: 12px;
}

.empty-state h1 {
  margin: 0;
  font-size: clamp(30px, 4vw, 46px);
  line-height: 1.06;
  letter-spacing: -0.05em;
}

.empty-copy {
  margin: 16px 0 0;
  font-size: 15px;
  line-height: 1.7;
}

.composer-dock {
  flex-shrink: 0;
  border-radius: 30px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  border-top-color: rgba(255, 255, 255, 0.76);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(248, 250, 252, 0.88)),
    radial-gradient(circle at 12% 0%, rgba(10, 132, 255, 0.08), transparent 35%);
  box-shadow: var(--surface-shadow), inset 0 1px 0 rgba(255, 255, 255, 0.90);
  overflow: visible;
}

.composer-console {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.composer-summary {
  width: 100%;
  min-height: 44px;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  padding: 7px 8px 7px 12px;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 22px;
  text-align: left;
  color: rgba(15, 23, 42, 0.88);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.92), rgba(248, 250, 252, 0.82));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.92), 0 8px 24px rgba(15, 23, 42, 0.05);
}

.composer-summary:hover {
  border-color: rgba(100, 116, 139, 0.30);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.96), 0 12px 28px rgba(15, 23, 42, 0.07);
}

.summary-kicker {
  flex: 0 0 auto;
  margin-right: 2px;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(71, 85, 105, 0.64);
}

.summary-chip {
  min-height: 26px;
  display: inline-flex;
  align-items: center;
  max-width: min(260px, 100%);
  padding: 0 9px;
  border: 1px solid rgba(148, 163, 184, 0.20);
  border-radius: 999px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
  font-weight: 750;
  background: rgba(255, 255, 255, 0.76);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.72);
}

.summary-chip-strong {
  border-color: transparent;
  color: #fff;
  background: #24262d;
}

.summary-chip.attention {
  border-color: rgba(245, 158, 11, 0.28);
  color: rgba(146, 64, 14, 0.95);
  background: rgba(255, 251, 235, 0.92);
}

.summary-chip-skill {
  border-color: rgba(10, 132, 255, 0.22);
  color: rgba(10, 102, 194, 0.96);
  background: rgba(10, 132, 255, 0.08);
}

.summary-spacer {
  flex: 1 1 24px;
}

.summary-toggle {
  min-height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 12px;
  border-radius: 999px;
  color: rgba(255, 255, 255, 0.96);
  font-size: 11px;
  font-weight: 800;
  background: var(--color-theme-gradient);
  box-shadow: 0 10px 22px rgba(15, 23, 42, 0.14);
}

.composer-control-panel {
  max-height: min(42vh, 420px);
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 9px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 22px;
  background:
    linear-gradient(180deg, rgba(248, 250, 252, 0.78), rgba(255, 255, 255, 0.62));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.86);
}

.composer-meta-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 6px;
}

.composer-meta-row-top {
  align-items: flex-start;
}

.dock-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.dock-pills-primary {
  flex: 1 1 auto;
  min-width: 0;
}

.meta-pill {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 7px 5px 10px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.78);
  background: rgba(255, 255, 255, 0.62);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.82), 0 6px 14px rgba(15, 23, 42, 0.04);
}

.meta-pill-type {
  flex: 0 0 auto;
}

.meta-pill-model {
  flex: 1 1 220px;
}

.meta-pill-ratio {
  flex: 0 0 auto;
}

.meta-pill-duration {
  flex: 0 0 auto;
}

.meta-pill-label {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
  color: rgba(51, 65, 85, 0.86);
}

.media-switch,
.video-mode-switch,
.ratio-selector,
.model-slot,
.duration-selector,
.upload-mini-row,
.reference-input {
  border: 1px solid rgba(148, 163, 184, 0.26);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.76);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.84),
    0 1px 2px rgba(15, 23, 42, 0.04);
}

.media-switch,
.video-mode-switch,
.ratio-selector,
.duration-selector {
  position: relative;
}

.media-switch::after,
.video-mode-switch::after,
.ratio-selector::after,
.duration-selector::after {
  content: '';
  position: absolute;
  right: -5px;
  top: 7px;
  bottom: 7px;
  width: 1px;
  background: rgba(148, 163, 184, 0.28);
}

.duration-slot:last-child .duration-selector::after,
.dock-pills-primary > :last-child::after {
  display: none;
}

.media-switch,
.video-mode-switch {
  display: inline-flex;
  padding: 2px;
  gap: 2px;
}

.compact-switch {
  padding: 2px;
  border-radius: 14px;
}

.switch-btn,
.sidebar-secondary-btn,
.sidebar-danger-btn,
.polish-btn,
.send-btn,
.icon-btn,
.upload-btn,
.text-btn,
.ratio-current-btn {
  border: 0;
  cursor: pointer;
}

.switch-btn {
  min-width: 88px;
  height: 40px;
  padding: 0 16px;
  border-radius: 14px;
  background: transparent;
  color: rgba(15, 23, 42, 0.72);
  font-weight: 600;
}

.compact-switch .switch-btn {
  min-width: 56px;
  height: 28px;
  padding: 0 8px;
  border-radius: 10px;
  font-size: 11px;
  white-space: nowrap;
}

.switch-btn.active {
  background: var(--color-theme-gradient);
  color: #fff;
  box-shadow: 0 12px 26px rgba(0, 0, 0, 0.16);
}

.ratio-selector {
  position: relative;
  border-color: rgba(100, 116, 139, 0.42);
  background: rgba(248, 250, 252, 0.92);
  flex: 0 0 auto;
  padding: 2px;
  border-radius: 14px;
  z-index: 2;
}

.ratio-selector.open,
.ratio-selector:focus-within,
.duration-selector:focus-within,
.media-switch:focus-within {
  border-color: rgba(10, 132, 255, 0.42);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.92),
    0 0 0 3px rgba(10, 132, 255, 0.08),
    0 8px 18px rgba(15, 23, 42, 0.06);
}

.ratio-selector.open {
  z-index: 30;
}

.ratio-current-btn {
  min-width: 112px;
  height: 28px;
  padding: 0 10px;
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  background: transparent;
  font-size: 11px;
  font-weight: 700;
  color: rgba(15, 23, 42, 0.88);
}

.ratio-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.ratio-current-box,
.ratio-option-box {
  display: inline-block;
  flex: 0 0 auto;
  box-sizing: border-box;
  border-radius: 6px;
  border: 1px solid rgba(15, 23, 42, 0.18);
  background: rgba(15, 23, 42, 0.06);
}

.ratio-current-box {
  transform: scale(0.72);
  transform-origin: center;
}

.ratio-caret,
.duration-caret {
  color: rgba(71, 85, 105, 0.7);
}

.ratio-dropdown {
  position: absolute;
  right: 0;
  bottom: calc(100% + 10px);
  width: min(420px, calc(100vw - 40px));
  min-width: max(300px, 100%);
  max-height: min(220px, calc(100dvh - 220px));
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 8px;
  border-radius: 18px;
  border: 1px solid rgba(255, 255, 255, 0.84);
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 24px 48px rgba(15, 23, 42, 0.14);
  z-index: 31;
}

.ratio-dropdown-item {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-height: 52px;
  padding: 6px 6px;
  border: 0;
  border-radius: 12px;
  background: transparent;
  text-align: center;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}

.ratio-dropdown-item.active {
  background: rgba(10, 132, 255, 0.10);
}

.ratio-option-preview {
  width: 32px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
}

.duration-selector,
.upload-mini-row {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 36px;
  padding: 0 12px;
}

.duration-selector {
  border-color: rgba(100, 116, 139, 0.42);
  background: rgba(248, 250, 252, 0.92);
  min-height: 34px;
  padding: 0 10px;
  border-radius: 14px;
}

.duration-select-wrap {
  position: relative;
}

.duration-select {
  appearance: none;
  border: 0;
  background: transparent;
  min-width: 48px;
  padding-right: 20px;
  font: inherit;
  font-weight: 700;
  color: rgba(15, 23, 42, 0.88);
  outline: none;
}

.duration-caret {
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
}

.reference-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  width: 100%;
  align-items: stretch;
}

.skill-control-row {
  width: 100%;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding-top: 2px;
}

/* 运镜指令：独占一行，弹出框向上展开，不再挤压上方胶囊行 */
.camera-guide-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  width: 100%;
}


.motion-control-note strong {

  padding: 0 2px;
  font-size: 12px;
  font-weight: 800;
  color: rgba(15, 23, 42, 0.9);
}

.motion-control-panel {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.motion-control-note {
  margin: 0;
  padding: 0 2px;
  font-size: 12px;
  font-weight: 800;
  color: rgba(15, 23, 42, 0.9);
}


.motion-control-note small {

  margin-left: 6px;
  font-size: 10px;
  font-weight: 500;
  color: rgba(71, 85, 105, 0.72);
}

.motion-control-options {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.motion-control-option {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 36px;
  padding: 0 10px;
  border: 1px solid rgba(148, 163, 184, 0.34);
  border-radius: 14px;
  background: rgba(248, 250, 252, 0.86);
}

.motion-control-option-label {
  font-size: 11px;
  font-weight: 800;
  color: rgba(51, 65, 85, 0.86);
}

.motion-control-select {
  border: 0;
  outline: none;
  background: transparent;
  font: inherit;
  font-size: 12px;
  font-weight: 700;
  color: rgba(15, 23, 42, 0.88);
}

/* 主体参考视频：上传主体图卡片（上传按钮 + 说明 + 文件名/URL） */
.subject-reference-card {
  width: 100%;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  padding: 8px 12px;
  border: 1px solid rgba(148, 163, 184, 0.34);
  border-radius: 16px;
  background: rgba(248, 250, 252, 0.86);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.72);
}

.subject-upload-btn {
  min-height: 38px;
  display: inline-flex;

  align-items: center;
  gap: 8px;
  padding: 0 14px;
  border: 0;
  border-radius: 14px;
  background: var(--color-theme-gradient);
  color: #fff;
  font-weight: 700;
  cursor: pointer;
}

.subject-upload-icon {
  width: 20px;
  height: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.18);
}

.subject-reference-copy {
  display: inline-flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.upload-copy {
  display: inline-flex;
  flex-direction: column;
  gap: 2px;
  min-width: 78px;
}

.upload-label {
  font-size: 12px;
  font-weight: 800;
  line-height: 1.1;
  color: rgba(15, 23, 42, 0.9);
}

.upload-hint {
  font-size: 10px;
  line-height: 1.1;
  color: rgba(71, 85, 105, 0.72);
}

.frame-upload-grid {
  width: 100%;
  display: grid;
  grid-template-columns: repeat(2, minmax(220px, 1fr));
  gap: 8px;
}

.frame-upload-card {
  width: 100%;
  justify-content: flex-start;
}

.multimodal-panel {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.multimodal-note {
  margin: 0;
  padding: 0 2px;
  font-size: 12px;
  font-weight: 800;
  color: rgba(15, 23, 42, 0.9);
}

.multimodal-note small {
  margin-left: 6px;
  font-size: 10px;
  font-weight: 500;
  color: rgba(71, 85, 105, 0.72);
}

.multimodal-note b {
  color: var(--color-accent-strong);
}

.multimodal-groups {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.multimodal-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 10px 10px;
  border: 1px solid rgba(148, 163, 184, 0.34);
  border-radius: 16px;
  background: rgba(248, 250, 252, 0.86);
}

.multimodal-group-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.multimodal-group-title {
  font-size: 11px;
  font-weight: 800;
  color: rgba(51, 65, 85, 0.9);
}

.multimodal-group-count {
  font-size: 10px;
  font-weight: 700;
  color: rgba(71, 85, 105, 0.66);
}

.multimodal-thumb-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.multimodal-thumb {
  position: relative;
  width: 52px;
  height: 52px;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid rgba(148, 163, 184, 0.4);
  background: rgba(255, 255, 255, 0.7);
}

.multimodal-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.multimodal-thumb-file {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.multimodal-file-icon {
  font-size: 20px;
}

.multimodal-thumb-tag {
  position: absolute;
  left: 2px;
  bottom: 2px;
  padding: 0 4px;
  border-radius: 6px;
  font-size: 9px;
  font-weight: 800;
  color: #fff;
  background: rgba(15, 23, 42, 0.72);
}

.multimodal-thumb-remove {
  position: absolute;
  top: 1px;
  right: 1px;
  width: 16px;
  height: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 999px;
  cursor: pointer;
  font-size: 12px;
  line-height: 1;
  color: #fff;
  background: rgba(15, 23, 42, 0.6);
}

.multimodal-add-btn {
  width: 52px;
  height: 52px;
  border: 1px dashed rgba(10, 132, 255, 0.42);
  border-radius: 12px;
  background: rgba(10, 132, 255, 0.06);
  color: rgba(10, 132, 255, 0.90);
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
}

.multimodal-add-btn:hover {
  background: rgba(10, 132, 255, 0.12);
}

/* @ 引用菜单 */
.mention-menu {
  position: absolute;
  left: 8px;
  bottom: calc(100% + 6px);
  z-index: 40;
  max-height: 220px;
  min-width: 180px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.84);
  background: rgba(255, 255, 255, 0.97);
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.16);
}

.mention-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  cursor: pointer;
  text-align: left;
}

.mention-item:hover,
.mention-item.active {
  background: rgba(10, 132, 255, 0.14);
}

.mention-item-tag {
  flex: 0 0 auto;
  padding: 1px 6px;
  border-radius: 6px;
  font-size: 10px;
  font-weight: 800;
  color: #fff;
  background: linear-gradient(135deg, #3b82f6 0%, #7c5cff 100%);
}

.mention-item-name {
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: rgba(15, 23, 42, 0.86);
}

.file-input {
  display: none;
}


.upload-icon-btn,
.icon-btn,
.send-icon-btn {
  width: 34px;
  height: 34px;
  border-radius: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.upload-btn,
.icon-btn {
  background: rgba(255, 255, 255, 0.58);
}

.upload-btn:hover,
.icon-btn:hover,
.text-btn:hover,
.polish-btn:not(:disabled):hover {
  background: rgba(255, 255, 255, 0.46);
}

.pill-filename {
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
}

.reference-input {
  min-width: min(420px, 100%);
  min-height: 34px;
  padding: 0 12px;
  outline: none;
  font-size: 13px;
}

.input-shell {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  align-items: end;
  padding: 8px 8px 8px 12px;
  border-radius: 24px;
  border: 1px solid rgba(148, 163, 184, 0.20);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(248, 250, 252, 0.78));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.92), 0 10px 24px rgba(15, 23, 42, 0.05);
}

.input-shell:focus-within {
  border-color: rgba(10, 132, 255, 0.28);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(248, 250, 252, 0.86));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.96), 0 0 0 4px rgba(10, 132, 255, 0.06), 0 14px 30px rgba(15, 23, 42, 0.08);
}

.compact-model-slot {
  min-width: min(200px, 100%);
  border: 0;
  background: transparent;
}

.input-shell.expanded textarea {
  min-height: 320px;
}

.input-shell textarea {
  width: 100%;
  min-height: 52px;
  max-height: 152px;
  box-sizing: border-box;
  margin: 0;
  padding: 7px 6px;
  border: 0;
  resize: vertical;
  background: transparent;
  outline: none;
  font: inherit;
  line-height: 1.45;
  color: rgba(15, 23, 42, 0.92);
}

/* 输入框上方「已引用素材」彩色标签行：用不同渐变色区分图片/视频/音频 */
.referenced-mentions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  padding: 2px 4px;
}

.referenced-mentions-label {
  font-size: 11px;
  font-weight: 700;
  color: rgba(71, 85, 105, 0.8);
}

.referenced-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.02em;
  color: #fff;
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.16);
}

.referenced-chip-dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.28);
}

/* 图片：紫色系 */
.referenced-chip-image {
  background: linear-gradient(135deg, #24262d, #4b5563);
}

/* 视频：橙红色系 */
.referenced-chip-video {
  background: linear-gradient(135deg, #24262d, #0a84ff);
}

/* 音频：青绿色系 */
.referenced-chip-audio {
  background: linear-gradient(135deg, #24262d, #22c1dc);
}

.composer-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  align-self: flex-end;
  padding-left: 4px;
}

/* 图像/视频模式：对话框内「上传 Skill」按钮 */
.skill-upload-btn-inline {
  min-height: 34px;
  max-width: 150px;
  padding: 0 12px;
  border: 1px solid rgba(10, 132, 255, 0.24);
  border-radius: 14px;
  background: rgba(10, 132, 255, 0.06);
  color: rgba(10, 132, 255, 0.95);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.skill-upload-btn-inline:hover {
  background: rgba(10, 132, 255, 0.16);
}

.skill-upload-btn-inline.active {
  color: #fff;
  border-color: transparent;
  background: var(--color-theme-gradient);
}

.skill-clear-inline {
  width: 26px;
  height: 26px;
  border: 0;
  border-radius: 999px;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  color: rgba(153, 27, 27, 0.9);
  background: rgba(153, 27, 27, 0.1);
}


.icon-btn svg,
.send-gradient-icon svg {
  width: 18px;
  height: 18px;
}

.polish-btn {
  min-height: 34px;
  padding: 0 12px;
  border-radius: 14px;
  font-weight: 600;
}

.sidebar-secondary-btn,
.sidebar-danger-btn {
  min-height: 40px;
  padding: 0 14px;
  border-radius: 16px;
  font-weight: 600;
}

.sidebar-secondary-btn,
.polish-btn,
.icon-btn,
.send-btn,
.text-btn {
  background: rgba(255, 255, 255, 0.62);
  color: rgba(15, 23, 42, 0.9);
}

.sidebar-danger-btn {
  background: rgba(153, 27, 27, 0.08);
  color: rgba(153, 27, 27, 0.92);
}

.send-btn.ready {
  background: var(--color-theme-gradient);
  color: rgba(255, 255, 255, 0.98);
  box-shadow: 0 16px 30px rgba(15, 23, 42, 0.20), 0 0 0 1px rgba(255, 255, 255, 0.42) inset;
}

.send-btn.ready .send-gradient-icon {
  color: rgba(255, 255, 255, 0.98);
}

.send-btn.ready .send-gradient-icon svg {
  color: currentColor;
}

.send-btn.ready .send-gradient-icon path {
  stroke: currentColor;
}

.send-btn:disabled,
.polish-btn:disabled,
.sidebar-secondary-btn:disabled,
.sidebar-danger-btn:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.session-card {
  padding: 16px;
  border-radius: 24px;
}

.session-card-head,
.session-card-meta,
.sidebar-footer {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.session-title {
  font-size: 18px;
}

@media (max-width: 1100px) {
  .workspace-shell,
  .single-session-layout {
    grid-template-columns: 1fr;
    height: calc(100dvh - 34px);
    min-height: 0;
  }

  .session-sidebar {
    order: 2;
    min-height: auto;
  }

  .workspace-main {
    order: 1;
    min-height: 0;
    height: 100%;
    overflow: hidden;
  }

}

@media (max-width: 720px) {
  .chat-page {
    height: 100dvh;
    padding: 10px;
  }

  .workspace-shell {
    gap: 12px;
  }

  .composer-meta-row,
  .dock-pills,
  .composer-actions,
  .sidebar-footer {
    width: 100%;
  }

  .input-shell {
    grid-template-columns: 1fr;
  }

  .dock-pills-primary,
  .meta-pill,
  .compact-model-slot {
    width: 100%;
  }

  .composer-actions {
    justify-content: space-between;
  }

  .composer-summary {
    align-items: flex-start;
  }

  .summary-kicker,
  .summary-spacer {
    display: none;
  }

  .summary-chip {
    max-width: 100%;
  }

  .summary-toggle {
    width: 100%;
  }

  .composer-control-panel {
    max-height: min(52vh, 460px);
  }

  .reference-input {
    min-width: 100%;
  }

  .frame-upload-grid {
    grid-template-columns: 1fr;
  }

  .subject-reference-card {
    flex-direction: column;
    align-items: stretch;
  }

  .subject-reference-url {
    min-width: 100%;
  }


  .video-mode-switch {
    width: 100%;
    overflow-x: auto;
  }

  .video-mode-switch .switch-btn {
    width: auto;
    flex: 1 0 max-content;
  }

  .ratio-selector,
  .ratio-current-btn {
    width: 100%;
  }

  .ratio-dropdown {
    left: 0;
    right: auto;
    min-width: 100%;
    width: min(100%, calc(100vw - 20px));
    grid-template-columns: repeat(3, minmax(0, 1fr));
    max-height: min(260px, calc(100dvh - 190px));
  }
}
.chat-page {
  padding: 14px;
  color: rgba(255, 255, 255, 0.92);
  background:
    radial-gradient(circle at 48% 4%, rgba(255, 255, 255, 0.11), transparent 0 24%),
    radial-gradient(circle at 12% 24%, rgba(91, 141, 255, 0.16), transparent 0 28%),
    radial-gradient(circle at 88% 78%, rgba(255, 138, 76, 0.10), transparent 0 22%),
    linear-gradient(180deg, #070707 0%, #0b0b0e 52%, #111114 100%);
  --surface-glass: rgba(255, 255, 255, 0.075);
  --surface-glass-strong: rgba(255, 255, 255, 0.11);
  --surface-line: rgba(255, 255, 255, 0.11);
  --surface-shadow: 0 24px 100px rgba(0, 0, 0, 0.42);
  --surface-shadow-soft: 0 14px 44px rgba(0, 0, 0, 0.24);
}

.chat-page::before {
  background:
    linear-gradient(rgba(255, 255, 255, 0.052) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.048) 1px, transparent 1px);
  background-size: 72px 72px;
  opacity: 1;
  mask-image: radial-gradient(circle at 50% 40%, #000 0 34%, transparent 78%);
}

.chat-page::after {
  background: linear-gradient(180deg, transparent, rgba(0, 0, 0, 0.48));
  opacity: 1;
  mask-image: none;
}

.workspace-shell,
.single-session-layout {
  width: min(100%, 1440px);
  grid-template-columns: 248px minmax(0, 1fr);
  gap: 14px;
}

.session-sidebar {
  padding: 16px;
  border-color: rgba(255, 255, 255, 0.11);
  background: rgba(255, 255, 255, 0.065);
  box-shadow: var(--surface-shadow-soft), inset 0 1px 0 rgba(255, 255, 255, 0.09);
  backdrop-filter: blur(28px) saturate(145%);
}

.brand-lockup {
  padding: 0;
}

.brand-title {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-family: var(--font-family-display);
  font-size: 22px;
  font-style: normal;
  font-weight: 700;
  letter-spacing: -0.05em;
  color: #f7f7f2;
  background: none;
}

.brand-title::before {
  content: 'A';
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 12px;
  background: #f7f7f2;
  color: #08080a;
  font: 800 16px/1 var(--font-family);
  box-shadow: 0 0 32px rgba(255, 255, 255, 0.22);
}

.mode-intro-card {
  margin-top: 14px;
  padding: 14px;
  border-color: rgba(255, 255, 255, 0.11);
  background:
    radial-gradient(circle at 18% 0%, rgba(255, 255, 255, 0.14), transparent 0 42%),
    rgba(255, 255, 255, 0.075);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.10);
}

.mode-intro-badge,
.canvas-entry-new {
  background: rgba(255, 255, 255, 0.92);
  color: #08080a;
  box-shadow: 0 12px 34px rgba(255, 255, 255, 0.10);
}

.mode-intro-desc,
.empty-copy {
  color: rgba(255, 255, 255, 0.54);
}

.workspace-main {
  border: 1px solid rgba(255, 255, 255, 0.10);
  border-radius: 34px;
  background:
    radial-gradient(circle at 50% 0%, rgba(255, 255, 255, 0.105), transparent 0 28%),
    rgba(255, 255, 255, 0.052);
  box-shadow: var(--surface-shadow), inset 0 1px 0 rgba(255, 255, 255, 0.08);
  overflow: hidden;
  backdrop-filter: blur(24px) saturate(140%);
}

.chat-stage {
  padding: 20px 20px 0;
}

.chat-area {
  border: 0;
  background: transparent;
  box-shadow: none;
}

.empty-state {
  width: min(100%, 780px);
  margin: clamp(42px, 8vh, 96px) auto 0;
  padding: 0;
  text-align: center;
}

.empty-kicker {
  color: rgba(255, 255, 255, 0.45);
  letter-spacing: 0.18em;
}

.empty-state h1 {
  max-width: 11ch;
  margin: 14px auto 0;
  color: #f7f7f2;
  font-family: var(--font-family-display);
  font-size: clamp(52px, 8vw, 104px);
  font-weight: 600;
  line-height: 0.9;
  letter-spacing: -0.08em;
}

.empty-copy {
  max-width: 560px;
  margin: 24px auto 0;
  font-size: 15px;
}

.composer-dock {
  padding: 0 20px 20px;
}

.composer-console {
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.075);
  box-shadow: 0 24px 90px rgba(0, 0, 0, 0.38), inset 0 1px 0 rgba(255, 255, 255, 0.11);
  backdrop-filter: blur(28px) saturate(145%);
}

.composer-summary {
  color: rgba(255, 255, 255, 0.78);
  background: transparent;
}

.summary-kicker,
.meta-pill-label {
  color: rgba(255, 255, 255, 0.42);
}

.summary-chip,
.meta-pill {
  border-color: rgba(255, 255, 255, 0.10);
  background: rgba(255, 255, 255, 0.075);
  color: rgba(255, 255, 255, 0.72);
}

.summary-chip-strong,
.switch-btn.active,
.mode-switch-btn.active,
.ratio-current-btn,
.send-btn.ready,
.skill-create-btn,
.canvas-entry-btn {
  background: #f7f7f2;
  color: #08080a;
  border-color: transparent;
}

.composer-control-panel {
  border-top-color: rgba(255, 255, 255, 0.10);
  background: rgba(0, 0, 0, 0.18);
}

.switch-btn,
.upload-mini-row,
.upload-card-row,
.reference-input,
.motion-control-panel,
.subject-reference-card,
.multimodal-panel,
.skill-control-row,
.ratio-dropdown {
  border-color: rgba(255, 255, 255, 0.11);
  background: rgba(255, 255, 255, 0.07);
  color: rgba(255, 255, 255, 0.76);
}

.switch-btn:not(.active):hover,
.upload-mini-row:hover,
.upload-card-row:hover {
  background: rgba(255, 255, 255, 0.11);
  color: #fff;
}

.input-shell {
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 24px;
  background: rgba(6, 6, 8, 0.78);
  box-shadow: inset 0 1px 18px rgba(0, 0, 0, 0.44);
}

.input-shell textarea {
  color: #fff;
}

.input-shell textarea::placeholder,
.upload-hint,
.pill-filename,
.summary-toggle {
  color: rgba(255, 255, 255, 0.42);
}

.icon-btn,
.polish-btn,
.text-btn,
.sidebar-secondary-btn,
.skill-upload-btn-inline {
  border: 1px solid rgba(255, 255, 255, 0.11);
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.76);
}

.icon-btn:hover,
.polish-btn:not(:disabled):hover,
.text-btn:hover,
.sidebar-secondary-btn:hover,
.skill-upload-btn-inline:hover {
  background: rgba(255, 255, 255, 0.14);
  color: #fff;
}

.send-btn.ready {
  box-shadow: 0 16px 36px rgba(255, 255, 255, 0.10);
}

.sidebar-footer {
  gap: 10px;
}

:deep(.message .avatar-icon),
:deep(.message .bubble),
:deep(.result-card) {
  border-color: rgba(255, 255, 255, 0.11);
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.9);
  box-shadow: 0 14px 44px rgba(0, 0, 0, 0.24), inset 0 1px 0 rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(20px) saturate(135%);
}

:deep(.message.user .bubble) {
  background: #f7f7f2;
  color: #08080a;
}

:deep(.content p),
:deep(.result-title),
:deep(.meta-pair dd) {
  color: rgba(255, 255, 255, 0.88);
}

:deep(.message.user .content p),
:deep(.message.user .time) {
  color: #08080a;
}

:deep(.message.system .bubble) {
  background: rgba(255, 255, 255, 0.075);
}

:deep(.meta-pair),
:deep(.media-frame),
:deep(.provider-pill) {
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.76);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
}

:deep(.meta-pair dt),
:deep(.time) {
  color: rgba(255, 255, 255, 0.42);
}

.chat-stage {
  border-color: rgba(255, 255, 255, 0.10);
  background: transparent;
  box-shadow: none;
}

.empty-state {
  border-color: rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.07);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

.composer-dock {
  border-color: transparent;
  background: transparent;
  box-shadow: none;
}

.composer-summary {
  border-color: rgba(255, 255, 255, 0.11);
  background: rgba(255, 255, 255, 0.075);
}

.media-switch,
.video-mode-switch,
.ratio-selector,
.model-slot,
.duration-selector {
  border-color: rgba(255, 255, 255, 0.11);
  background: rgba(255, 255, 255, 0.07);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

.motion-control-option {
  border-color: rgba(255, 255, 255, 0.11);
  background: rgba(255, 255, 255, 0.07);
}

.motion-control-option-label,
.motion-control-note,
.multimodal-note,
.upload-label {
  color: rgba(255, 255, 255, 0.82);
}

.motion-control-note small,
.multimodal-note small,
.upload-hint {
  color: rgba(255, 255, 255, 0.46);
}

.motion-control-select,
.duration-select {
  color: rgba(255, 255, 255, 0.88);
}

.ratio-caret,
.duration-caret {
  color: rgba(255, 255, 255, 0.5);
}

.summary-toggle {
  color: rgba(255, 255, 255, 0.88);
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.16);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.10);
  backdrop-filter: blur(18px) saturate(140%);
}

.send-btn.ready {
  background: linear-gradient(135deg, #5b8cff 0%, #7a5cff 100%);
  color: #fff;
  border-color: transparent;
  box-shadow: 0 14px 34px rgba(79, 110, 255, 0.32), inset 0 1px 0 rgba(255, 255, 255, 0.28);
}

.send-btn.ready .send-gradient-icon {
  color: #fff;
}

.input-shell:focus-within {
  border-color: rgba(122, 158, 255, 0.48);
  background: rgba(6, 6, 8, 0.88);
  box-shadow: inset 0 1px 18px rgba(0, 0, 0, 0.44), 0 0 0 3px rgba(91, 140, 255, 0.12);
}

:deep(.model-selector select) {
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.88);
  border-color: rgba(255, 255, 255, 0.12);
}

:deep(.model-selector .select-icon) {
  color: rgba(255, 255, 255, 0.58);
}

.ratio-current-btn {
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.86);
}

.ratio-dropdown-item {
  color: rgba(255, 255, 255, 0.78);
}

.ratio-dropdown-item.active {
  background: rgba(91, 140, 255, 0.16);
  color: #fff;
}

.ratio-current-box,
.ratio-option-box {
  border-color: rgba(255, 255, 255, 0.18);
  background: rgba(255, 255, 255, 0.08);
}

.ratio-selector.open,
.ratio-selector:focus-within {
  border-color: rgba(122, 158, 255, 0.50);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 0 0 3px rgba(91, 140, 255, 0.12);
}

.composer-control-panel.ratio-open {
  overflow: visible;
}

.skill-control-row {
  border: 0;
  background: transparent;
  box-shadow: none;
}

.skill-upload-btn-inline {
  background: transparent;
  border-color: rgba(255, 255, 255, 0.14);
  color: rgba(255, 255, 255, 0.78);
}

.skill-upload-btn-inline:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
}

.skill-upload-btn-inline.active {
  background: linear-gradient(135deg, #5b8cff 0%, #7a5cff 100%);
  border-color: transparent;
  color: #fff;
}

.composer-summary,
.composer-control-panel,
.composer-console,
.meta-pill,
.media-switch,
.video-mode-switch,
.ratio-selector,
.model-slot,
.duration-selector,
.upload-mini-row,
.upload-card-row,
.reference-input,
.motion-control-panel,
.motion-control-option,
.subject-reference-card,
.multimodal-panel,
.skill-control-row,
.ratio-dropdown {
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

.composer-summary {
  background: #17191f;
  border-color: transparent;
  box-shadow: none;
}

.composer-control-panel {
  background: #111318;
  border-color: transparent;
  box-shadow: none;
}

.composer-console {
  background: #15171c;
  border-color: transparent;
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.38);
}

.meta-pill,
.media-switch,
.video-mode-switch,
.ratio-selector,
.model-slot,
.duration-selector,
.upload-mini-row,
.upload-card-row,
.reference-input,
.motion-control-panel,
.motion-control-option,
.subject-reference-card,
.multimodal-panel {
  background: #1c1f26;
  border-color: transparent;
  box-shadow: none;
}

.ratio-dropdown {
  background: #15171c;
  border-color: transparent;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.42);
}

.input-shell {
  background: #0d0f13;
  border-color: transparent;
}

.input-shell:focus-within {
  background: #0d0f13;
}

.summary-toggle {
  background: #262a33;
  border-color: transparent;
  color: rgba(255, 255, 255, 0.88);
  backdrop-filter: none;
}

@media (max-width: 1100px) {
  .workspace-shell,
  .single-session-layout {
    grid-template-columns: 1fr;
  }

  .session-sidebar {
    order: 1;
    min-height: auto;
  }

  .workspace-main {
    order: 2;
  }

  .mode-intro-card {
    display: none;
  }

  .sidebar-footer {
    flex-direction: row;
    flex-wrap: wrap;
  }
}

@media (max-width: 720px) {
  .chat-page {
    padding: 8px;
  }

  .workspace-main,
  .composer-console,
  .input-shell {
    border-radius: 22px;
  }

  .empty-state h1 {
    font-size: clamp(40px, 14vw, 64px);
  }
}


/* 新简易模式布局：顶部菜单 + 左右创作区 */
.top-nav {
  position: relative;
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 48px;
}

.top-nav .brand-lockup {
  width: auto;
  padding: 0;
}

.top-nav-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
}

.workspace-shell,
.single-session-layout {
  grid-template-columns: 1fr;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 12px;
}

.workspace-main {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(360px, 0.85fr);
  grid-template-rows: minmax(0, 1fr);
  gap: 12px;
  height: 100%;
  background: transparent;
  border: 0;
  box-shadow: none;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  overflow: hidden;
}

.chat-stage {
  min-height: 0;
  border: 1px solid rgba(255, 255, 255, 0.10);
  border-radius: 24px;
  background: #111318;
}

.composer-dock {
  min-height: 0;
  display: flex;
  padding: 0;
  border: 0;
  background: transparent;
  box-shadow: none;
}

.composer-console {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.composer-summary {
  flex: 0 0 auto;
}

.composer-control-panel {
  flex: 1 1 auto;
  min-height: 0;
  max-height: none;
  overflow-y: auto;
}

.composer-control-panel.ratio-open {
  overflow: visible;
}

@media (max-width: 900px) {
  .workspace-main {
    grid-template-columns: 1fr;
    grid-template-rows: minmax(0, 1fr) auto;
  }
}

@media (max-width: 640px) {
  .top-nav {
    align-items: flex-start;
    flex-direction: column;
  }

  .top-nav-actions {
    width: 100%;
    justify-content: flex-start;
  }
}


/* 最终简易模式微调：紧凑顶栏 + 右栏上下结构 + 可读性 */
.top-nav {
  min-height: 54px;
  padding: 8px 12px;
  gap: 10px;
  background: #0a0a0c;
  border: 1px solid #22242b;
  border-radius: 16px;
  box-shadow: 0 14px 34px rgba(0, 0, 0, 0.24);
}

.top-nav .brand-title {
  font-size: 18px;
  gap: 9px;
  letter-spacing: -0.04em;
}

.top-nav .brand-title::before {
  width: 28px;
  height: 28px;
  border-radius: 10px;
  font-size: 13px;
}

.top-nav-actions {
  gap: 6px;
}

.top-nav-actions .skill-create-btn,
.top-nav-actions .canvas-entry-btn,
.top-nav-actions .sidebar-secondary-btn {
  min-height: 34px;
  padding: 0 13px;
  border-radius: 11px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0;
  gap: 6px;
}

.top-nav-actions .skill-create-btn {
  background: linear-gradient(135deg, #3b82f6 0%, #7c5cff 100%);
  color: #fff;
  border-color: transparent;
}

.top-nav-actions .canvas-entry-btn,
.top-nav-actions .sidebar-secondary-btn {
  background: #1c1f26;
  color: #e6e8ef;
  border: 1px solid #2a2e37;
}

.top-nav-actions .skill-create-icon {
  font-size: 12px;
}

.top-nav-actions .canvas-entry-new {
  padding: 2px 6px;
  font-size: 9px;
}

.workspace-shell,
.single-session-layout {
  gap: 12px;
}

.workspace-main {
  grid-template-columns: minmax(0, 1.1fr) minmax(380px, 0.9fr);
  gap: 14px;
}

.composer-dock {
  display: flex;
  flex-direction: column;
  gap: 0;
  min-height: 0;
  padding: 0;
  overflow: hidden;
  background: #15171c;
  border: 1px solid #22252d;
  border-radius: 22px;
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.30);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

.composer-console {
  order: 3;
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 0;
  overflow: hidden;
  background: transparent;
  border: 0;
  border-radius: 0;
  box-shadow: none;
}

.composer-summary {
  display: none;
}

.composer-control-panel {
  flex: 1 1 auto;
  min-height: 0;
  max-height: none;
  overflow-y: auto;
  padding: 16px;
  border: 0;
  border-radius: 0;
  background: transparent;
}

.composer-control-panel.ratio-open,
.composer-dock.ratio-open,
.composer-console.ratio-open {
  overflow: visible;
}

@media (min-width: 901px) {
  .composer-control-panel.ratio-open .ratio-dropdown {
    top: calc(100% + 10px);
    bottom: auto;
  }
}

.referenced-mentions {
  order: 2;
  flex: 0 0 auto;
  padding: 8px 16px;
}

.input-shell {
  order: 1;
  position: relative;
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 0;
  padding: 14px;
  border: 1px solid #2a2f3a;
  border-radius: 20px;
  background: linear-gradient(180deg, #11151c 0%, #0d1016 100%);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05), 0 18px 44px rgba(0, 0, 0, 0.22);
}

.input-shell:focus-within {
  border-color: rgba(92, 132, 255, 0.62);
  background: linear-gradient(180deg, #121822 0%, #0d1118 100%);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06), 0 0 0 3px rgba(92, 132, 255, 0.12), 0 18px 44px rgba(0, 0, 0, 0.26);
}

.composer-actions {
  width: 100%;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 8px;
  align-self: stretch;
  padding: 12px 0 0;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.meta-pill-label,
.upload-label,
.motion-control-note,
.motion-control-note strong,
.multimodal-note,
.multimodal-note strong,
.referenced-mentions-label {
  color: rgba(255, 255, 255, 0.88);
}

.upload-hint,
.motion-control-note small,
.multimodal-note small,
.input-shell textarea::placeholder {
  color: rgba(255, 255, 255, 0.58);
}

.multimodal-group,
.mention-menu {
  background: #151923;
  border-color: #2b3342;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05), 0 14px 32px rgba(0, 0, 0, 0.22);
}

.multimodal-group-title,
.mention-item-name {
  color: rgba(255, 255, 255, 0.86);
}

.multimodal-group-count {
  color: rgba(255, 255, 255, 0.54);
}

.multimodal-add-btn {
  border-color: rgba(92, 132, 255, 0.46);
  background: rgba(92, 132, 255, 0.10);
  color: rgba(190, 207, 255, 0.96);
}

.multimodal-add-btn:hover,
.mention-item:hover,
.mention-item.active {
  background: rgba(92, 132, 255, 0.18);
}

.switch-btn,
.ratio-current-btn,
.reference-input,
.motion-control-select,
.duration-select {
  color: rgba(255, 255, 255, 0.92);
}

.switch-btn:not(.active) {
  color: rgba(255, 255, 255, 0.72);
}

.switch-btn.active,
.mode-switch-btn.active {
  background: linear-gradient(135deg, #3b82f6 0%, #7c5cff 100%);
  color: #fff;
  border-color: transparent;
}

.ratio-current-btn {
  background: #1c1f26;
  color: rgba(255, 255, 255, 0.92);
}

.icon-btn,
.polish-btn,
.text-btn {
  color: rgba(255, 255, 255, 0.9);
}

.icon-btn,
.polish-btn {
  background: #1a1f29;
  border: 1px solid #2b3342;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
}

.icon-btn {
  width: 38px;
  height: 38px;
  border-radius: 13px;
}

.polish-btn {
  min-height: 38px;
  padding: 0 14px;
  border-radius: 13px;
  color: #dbe6ff;
}

.icon-btn:hover,
.polish-btn:not(:disabled):hover {
  background: #242b38;
  border-color: rgba(92, 132, 255, 0.5);
}

.send-btn.ready {
  background: linear-gradient(135deg, #3b82f6 0%, #7c5cff 100%);
  color: #fff;
  box-shadow: 0 12px 28px rgba(69, 105, 255, 0.32), inset 0 1px 0 rgba(255, 255, 255, 0.25);
}

.input-shell textarea {
  color: #fff;
  font-size: 15px;
  min-height: 0;
  max-height: none;
  padding: 4px 2px;
  overflow-y: auto;
  overscroll-behavior: contain;
  resize: none;
  cursor: text;
  scrollbar-width: thin;
  scrollbar-color: rgba(148, 163, 184, 0.38) transparent;
}

.input-shell textarea::-webkit-scrollbar {
  width: 8px;
}

.input-shell textarea::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.32);
}

.input-shell textarea::-webkit-scrollbar-track {
  background: transparent;
}

.meta-pill-label {
  font-size: 12px;
}

@media (max-width: 900px) {
  .input-shell {
    margin-top: 0;
  }

  .composer-console {
    max-height: min(46vh, 440px);
  }
}

@media (max-width: 640px) {
  .top-nav {
    min-height: auto;
  }

  .top-nav-actions .skill-create-btn,
  .top-nav-actions .canvas-entry-btn,
  .top-nav-actions .sidebar-secondary-btn {
    min-height: 32px;
    padding: 0 11px;
  }
}

</style>
