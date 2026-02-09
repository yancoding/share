<script setup lang="ts">
const route = useRoute()
const videoRef = ref<HTMLVideoElement | null>(null)
const playerShellRef = ref<HTMLDivElement | null>(null)

const minScale = 1
const maxScale = 10
const zoomScale = ref(1)
const zoomOffsetX = ref(0)
const zoomOffsetY = ref(0)
const pinchStartDistance = ref<number | null>(null)
const pinchStartScale = ref(1)
const pinchStartFocalX = ref(0)
const pinchStartFocalY = ref(0)
const pinchStartOffsetX = ref(0)
const pinchStartOffsetY = ref(0)
const panStartX = ref(0)
const panStartY = ref(0)
const panStartOffsetX = ref(0)
const panStartOffsetY = ref(0)
const activeGesture = ref<'none' | 'pinch' | 'pan'>('none')
const isNativeFullscreen = ref(false)
const isManualFullscreen = ref(false)
const prevBodyOverflow = ref<string | null>(null)

function parseVideoUrl(value: unknown) {
  if (typeof value !== 'string' || !value) {
    return ''
  }

  try {
    const url = new URL(value)
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return url.toString()
    }
  }
  catch {
    return ''
  }

  return ''
}

function getTouchDistance(touches: TouchList) {
  if (touches.length < 2) {
    return null
  }

  const first = touches[0]
  const second = touches[1]
  const distanceX = first.clientX - second.clientX
  const distanceY = first.clientY - second.clientY
  return Math.hypot(distanceX, distanceY)
}

function getTouchMidpoint(touches: TouchList) {
  if (touches.length < 2) {
    return null
  }

  return {
    x: (touches[0].clientX + touches[1].clientX) / 2,
    y: (touches[0].clientY + touches[1].clientY) / 2,
  }
}

function getPointInShell(clientX: number, clientY: number) {
  const shell = playerShellRef.value
  if (!shell) {
    return { x: 0, y: 0 }
  }

  const rect = shell.getBoundingClientRect()
  return {
    x: clientX - (rect.left + rect.width / 2),
    y: clientY - (rect.top + rect.height / 2),
  }
}

function clampScale(scale: number) {
  return Math.min(Math.max(scale, minScale), maxScale)
}

function getMaxOffset(scale: number) {
  const shell = playerShellRef.value
  if (!shell || scale <= 1) {
    return { x: 0, y: 0 }
  }

  return {
    x: (shell.clientWidth * (scale - 1)) / 2,
    y: (shell.clientHeight * (scale - 1)) / 2,
  }
}

function clampOffset(offsetX: number, offsetY: number, scale: number) {
  const limit = getMaxOffset(scale)
  return {
    x: Math.min(Math.max(offsetX, -limit.x), limit.x),
    y: Math.min(Math.max(offsetY, -limit.y), limit.y),
  }
}

function setZoomTransform(nextScale: number, nextOffsetX: number, nextOffsetY: number) {
  const scale = clampScale(nextScale)
  zoomScale.value = scale

  if (scale <= 1) {
    zoomOffsetX.value = 0
    zoomOffsetY.value = 0
    return
  }

  const clampedOffset = clampOffset(nextOffsetX, nextOffsetY, scale)
  zoomOffsetX.value = clampedOffset.x
  zoomOffsetY.value = clampedOffset.y
}

function isVideoInNativeFullscreen() {
  const videoEl = videoRef.value
  if (!videoEl) {
    return false
  }

  if ((videoEl as HTMLVideoElement & { webkitDisplayingFullscreen?: boolean }).webkitDisplayingFullscreen || isNativeFullscreen.value) {
    return true
  }

  const fullscreenEl = document.fullscreenElement ?? (document as Document & { webkitFullscreenElement?: Element | null }).webkitFullscreenElement ?? null
  return fullscreenEl === videoEl
}

function isZoomActive() {
  return isManualFullscreen.value || isVideoInNativeFullscreen()
}

function resetZoomState() {
  zoomScale.value = 1
  zoomOffsetX.value = 0
  zoomOffsetY.value = 0
  pinchStartDistance.value = null
  pinchStartScale.value = 1
  activeGesture.value = 'none'
}

function lockBodyScroll() {
  if (prevBodyOverflow.value === null) {
    prevBodyOverflow.value = document.body.style.overflow
  }
  document.body.style.overflow = 'hidden'
}

function unlockBodyScroll() {
  document.body.style.overflow = prevBodyOverflow.value ?? ''
  prevBodyOverflow.value = null
}

function enterManualFullscreen() {
  isManualFullscreen.value = true
  lockBodyScroll()
}

function exitManualFullscreen() {
  if (!isManualFullscreen.value) {
    return
  }

  isManualFullscreen.value = false
  unlockBodyScroll()
  resetZoomState()
}

function toggleManualFullscreen() {
  if (isManualFullscreen.value) {
    exitManualFullscreen()
    return
  }

  enterManualFullscreen()
}

function onTouchStart(event: TouchEvent) {
  if (!isZoomActive()) {
    return
  }

  if (event.touches.length === 2) {
    const distance = getTouchDistance(event.touches)
    const midpoint = getTouchMidpoint(event.touches)
    if (!distance || !midpoint) {
      return
    }

    const focalPoint = getPointInShell(midpoint.x, midpoint.y)
    activeGesture.value = 'pinch'
    pinchStartDistance.value = distance
    pinchStartScale.value = zoomScale.value
    pinchStartFocalX.value = focalPoint.x
    pinchStartFocalY.value = focalPoint.y
    pinchStartOffsetX.value = zoomOffsetX.value
    pinchStartOffsetY.value = zoomOffsetY.value
    return
  }

  if (event.touches.length === 1 && zoomScale.value > 1) {
    activeGesture.value = 'pan'
    panStartX.value = event.touches[0].clientX
    panStartY.value = event.touches[0].clientY
    panStartOffsetX.value = zoomOffsetX.value
    panStartOffsetY.value = zoomOffsetY.value
  }
}

function onTouchMove(event: TouchEvent) {
  if (!isZoomActive()) {
    return
  }

  if (event.touches.length === 2) {
    const currentDistance = getTouchDistance(event.touches)
    const midpoint = getTouchMidpoint(event.touches)
    if (!currentDistance || !midpoint) {
      return
    }
    const focalPoint = getPointInShell(midpoint.x, midpoint.y)

    if (activeGesture.value !== 'pinch' || !pinchStartDistance.value) {
      activeGesture.value = 'pinch'
      pinchStartDistance.value = currentDistance
      pinchStartScale.value = zoomScale.value
      pinchStartFocalX.value = focalPoint.x
      pinchStartFocalY.value = focalPoint.y
      pinchStartOffsetX.value = zoomOffsetX.value
      pinchStartOffsetY.value = zoomOffsetY.value
      return
    }

    event.preventDefault()
    const scaleRatio = currentDistance / pinchStartDistance.value
    const nextScale = clampScale(pinchStartScale.value * scaleRatio)
    const contentX = (pinchStartFocalX.value - pinchStartOffsetX.value) / pinchStartScale.value
    const contentY = (pinchStartFocalY.value - pinchStartOffsetY.value) / pinchStartScale.value
    const nextOffsetX = focalPoint.x - nextScale * contentX
    const nextOffsetY = focalPoint.y - nextScale * contentY
    setZoomTransform(nextScale, nextOffsetX, nextOffsetY)
    return
  }

  if (event.touches.length !== 1 || activeGesture.value !== 'pan' || zoomScale.value <= 1) {
    return
  }

  event.preventDefault()
  const touch = event.touches[0]
  const nextOffsetX = panStartOffsetX.value + (touch.clientX - panStartX.value)
  const nextOffsetY = panStartOffsetY.value + (touch.clientY - panStartY.value)
  const clampedOffset = clampOffset(nextOffsetX, nextOffsetY, zoomScale.value)
  zoomOffsetX.value = clampedOffset.x
  zoomOffsetY.value = clampedOffset.y
}

function onTouchEnd(event: TouchEvent) {
  if (event.touches.length >= 2) {
    return
  }

  if (event.touches.length === 1 && zoomScale.value > 1) {
    activeGesture.value = 'pan'
    panStartX.value = event.touches[0].clientX
    panStartY.value = event.touches[0].clientY
    panStartOffsetX.value = zoomOffsetX.value
    panStartOffsetY.value = zoomOffsetY.value
    pinchStartDistance.value = null
    pinchStartScale.value = zoomScale.value
    return
  }

  activeGesture.value = 'none'
  pinchStartDistance.value = null
  pinchStartScale.value = zoomScale.value
}

function onFullscreenChange() {
  if (!isVideoInNativeFullscreen() && !isManualFullscreen.value) {
    resetZoomState()
  }
}

function onNativeFullscreenStart() {
  isNativeFullscreen.value = true
}

function onNativeFullscreenEnd() {
  isNativeFullscreen.value = false
  if (!isManualFullscreen.value) {
    resetZoomState()
  }
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    exitManualFullscreen()
  }
}

const playerStyle = computed(() => {
  return {
    transform: `translate3d(${zoomOffsetX.value}px, ${zoomOffsetY.value}px, 0) scale(${zoomScale.value})`,
    transformOrigin: 'center center',
    transition: activeGesture.value === 'none' ? 'transform 0.12s ease-out' : 'none',
  }
})

const videoUrl = computed(() => parseVideoUrl(route.query.video))

async function notifyPreviewOpened() {
  if (!videoUrl.value) {
    return
  }

  try {
    const response = await fetch('/api/preview-notify', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        videoUrl: videoUrl.value,
      }),
    })

    const result = await response.json().catch(() => null) as { sent?: boolean; reason?: string } | null
    if (!response.ok || !result?.sent) {
      console.warn('Preview notification was not sent.', result?.reason || `HTTP ${response.status}`)
    }
  }
  catch (error) {
    console.warn('Failed to send preview notification.', error)
  }
}

onMounted(() => {
  document.addEventListener('fullscreenchange', onFullscreenChange)
  document.addEventListener('webkitfullscreenchange', onFullscreenChange as EventListener)
  document.addEventListener('keydown', onKeydown)
  void notifyPreviewOpened()
})

onBeforeUnmount(() => {
  document.removeEventListener('fullscreenchange', onFullscreenChange)
  document.removeEventListener('webkitfullscreenchange', onFullscreenChange as EventListener)
  document.removeEventListener('keydown', onKeydown)
  unlockBodyScroll()
})
</script>

<template>
  <main class="container" :class="{ 'container--fullscreen': isManualFullscreen }">
    <header v-if="!isManualFullscreen" class="head">
      <h1>视频预览</h1>
      <p class="sub">在手机和桌面端均可直接播放</p>
    </header>

    <section class="panel" :class="{ 'panel--fullscreen': isManualFullscreen }">
      <p v-if="!videoUrl" class="error">
        无效的视频地址，请检查分享链接是否完整。
      </p>

      <div
        v-else
        ref="playerShellRef"
        class="player-shell"
        @touchstart="onTouchStart"
        @touchmove="onTouchMove"
        @touchend="onTouchEnd"
        @touchcancel="onTouchEnd"
      >
        <video
          ref="videoRef"
          :src="videoUrl"
          :style="playerStyle"
          controls
          controlslist="nofullscreen"
          disablepictureinpicture
          playsinline
          preload="metadata"
          class="player"
          :class="{ 'player--fullscreen': isManualFullscreen }"
          @webkitbeginfullscreen="onNativeFullscreenStart"
          @webkitendfullscreen="onNativeFullscreenEnd"
        />

        <button
          type="button"
          class="fullscreen-btn"
          @click="toggleManualFullscreen"
        >
          {{ isManualFullscreen ? '退出全屏' : '全屏' }}
        </button>
      </div>
    </section>
  </main>
</template>

<style scoped>
.container {
  max-width: 980px;
  margin: 0 auto;
  padding: calc(env(safe-area-inset-top) + 20px) 16px calc(env(safe-area-inset-bottom) + 24px);
  font-family: "Helvetica Neue", Arial, sans-serif;
}

.container--fullscreen {
  max-width: none;
  padding: 0;
}

.head h1 {
  margin: 0;
  font-size: clamp(24px, 5vw, 34px);
}

.sub {
  margin: 10px 0 18px;
  color: #5f6368;
  font-size: 14px;
}

.panel {
  border: 1px solid #e6e8eb;
  border-radius: 14px;
  padding: 10px;
  background: #fff;
  overflow: hidden;
}

.panel--fullscreen {
  position: fixed;
  inset: 0;
  z-index: 999;
  border: 0;
  border-radius: 0;
  padding: 0;
  background: #000;
}

.player-shell {
  position: relative;
}

.panel--fullscreen .player-shell {
  width: 100%;
  height: 100%;
  touch-action: none;
}

.player {
  width: 100%;
  aspect-ratio: 16 / 9;
  max-height: 78vh;
  display: block;
  background: #000;
  border-radius: 10px;
  transition: transform 0.12s ease-out;
}

.player--fullscreen {
  width: 100%;
  height: 100%;
  max-height: none;
  aspect-ratio: auto;
  object-fit: contain;
  border-radius: 0;
}

.fullscreen-btn {
  position: absolute;
  right: 12px;
  bottom: 12px;
  z-index: 2;
  border: 0;
  border-radius: 999px;
  padding: 8px 12px;
  font-size: 13px;
  color: #fff;
  background: rgba(0, 0, 0, 0.6);
}

.panel--fullscreen .fullscreen-btn {
  top: calc(env(safe-area-inset-top) + 12px);
  right: calc(env(safe-area-inset-right) + 12px);
  bottom: auto;
}

.error {
  margin: 8px 6px;
  color: #b00020;
}

@media (max-width: 640px) {
  .container {
    padding-left: 12px;
    padding-right: 12px;
  }

  .sub {
    margin-bottom: 12px;
    font-size: 13px;
  }

  .panel {
    padding: 8px;
    border-radius: 12px;
  }

  .panel--fullscreen {
    padding: 0;
    border-radius: 0;
  }

  .player {
    border-radius: 8px;
    max-height: 68vh;
  }

  .player--fullscreen {
    border-radius: 0;
    max-height: none;
  }
}
</style>
