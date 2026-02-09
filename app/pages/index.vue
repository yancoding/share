<script setup lang="ts">
const isUploading = ref(false)
const statusText = ref('')
const shareLink = ref('')
const objectUrl = ref('')
const selectedFile = ref<File | null>(null)

function uploadToSignedUrl(signedUrl: string, file: File) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', signedUrl)
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream')

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = Math.floor((event.loaded / event.total) * 100)
        statusText.value = `正在直传到存储服务... ${percent}%`
      }
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve()
        return
      }
      reject(new Error(`Upload failed with status ${xhr.status}`))
    }
    xhr.onerror = () => reject(new Error('Network error while uploading to storage service.'))
    xhr.onabort = () => reject(new Error('Upload aborted.'))
    xhr.send(file)
  })
}

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  selectedFile.value = input.files?.[0] || null
  shareLink.value = ''
  objectUrl.value = ''
  statusText.value = ''
}

function getBaseUrl() {
  const config = useRuntimeConfig()
  if (config.public.appBaseUrl) {
    return config.public.appBaseUrl.replace(/\/$/, '')
  }
  if (import.meta.client) {
    return window.location.origin
  }
  return ''
}

async function uploadVideo() {
  if (!selectedFile.value) {
    statusText.value = '请先选择视频文件。'
    return
  }

  if (!selectedFile.value.type.startsWith('video/')) {
    statusText.value = '只支持上传视频文件。'
    return
  }

  isUploading.value = true
  statusText.value = '正在申请上传地址...'

  try {
    const file = selectedFile.value
    const { signedUrl, objectUrl: uploadedUrl } = await $fetch('/api/upload-url', {
      method: 'POST',
      body: {
        fileName: file.name,
        contentType: file.type || 'application/octet-stream'
      }
    })

    await uploadToSignedUrl(signedUrl, file)

    objectUrl.value = uploadedUrl
    const baseUrl = getBaseUrl()
    shareLink.value = `${baseUrl}/preview?video=${encodeURIComponent(uploadedUrl)}`
    statusText.value = '上传成功，复制链接即可分享。'
  }
  catch (error) {
    statusText.value = `上传失败：${error instanceof Error ? error.message : 'unknown error'}`
  }
  finally {
    isUploading.value = false
  }
}

async function copyShareLink() {
  if (!shareLink.value || !import.meta.client) {
    return
  }
  await navigator.clipboard.writeText(shareLink.value)
  statusText.value = '分享链接已复制。'
}
</script>

<template>
  <main class="container">
    <h1>视频分享</h1>
    <p class="desc">无需登录，上传视频后直接生成分享链接。</p>

    <input type="file" accept="video/*" @change="onFileChange">

    <button :disabled="isUploading || !selectedFile" @click="uploadVideo">
      {{ isUploading ? '上传中...' : '上传并生成分享链接' }}
    </button>

    <p v-if="statusText" class="status">{{ statusText }}</p>

    <section v-if="shareLink" class="result">
      <h2>分享链接</h2>
      <a :href="shareLink" target="_blank" rel="noopener noreferrer">{{ shareLink }}</a>
      <button @click="copyShareLink">复制链接</button>
    </section>

    <section v-if="objectUrl" class="result">
      <h2>视频地址</h2>
      <code>{{ objectUrl }}</code>
    </section>
  </main>
</template>

<style scoped>
.container {
  max-width: 860px;
  margin: 40px auto;
  padding: 0 20px;
  font-family: "Helvetica Neue", Arial, sans-serif;
}

.desc {
  color: #555;
}

input,
button {
  display: block;
  margin-top: 14px;
}

button {
  padding: 8px 14px;
  border: none;
  border-radius: 6px;
  background: #0b57d0;
  color: #fff;
  cursor: pointer;
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.status {
  margin-top: 16px;
}

.result {
  margin-top: 20px;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
}

.result h2 {
  margin: 0 0 10px;
  font-size: 16px;
}

code {
  word-break: break-all;
}
</style>
