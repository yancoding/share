<script setup lang="ts">
const route = useRoute()

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

const videoUrl = computed(() => parseVideoUrl(route.query.video))
</script>

<template>
  <main class="container">
    <header class="head">
      <h1>视频预览</h1>
      <p class="sub">在手机和桌面端均可直接播放</p>
    </header>

    <section class="panel">
      <p v-if="!videoUrl" class="error">
        无效的视频地址，请检查分享链接是否完整。
      </p>

      <video
        v-else
        :src="videoUrl"
        controls
        playsinline
        preload="metadata"
        class="player"
      />
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
}

.player {
  width: 100%;
  aspect-ratio: 16 / 9;
  max-height: 78vh;
  display: block;
  background: #000;
  border-radius: 10px;
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

  .player {
    border-radius: 8px;
    max-height: 68vh;
  }
}
</style>
