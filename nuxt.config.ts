// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  runtimeConfig: {
    smtpHost: process.env.SMTP_HOST || '',
    smtpPort: Number.parseInt(process.env.SMTP_PORT || '587', 10),
    smtpSecure: process.env.SMTP_SECURE === 'true',
    smtpUser: process.env.SMTP_USER || '',
    smtpPass: process.env.SMTP_PASS || '',
    previewNotifyTo: process.env.PREVIEW_NOTIFY_TO || '',
    previewNotifyFrom: process.env.PREVIEW_NOTIFY_FROM || '',
    minioEndpoint: process.env.MINIO_ENDPOINT || '',
    minioPublicBaseUrl: process.env.MINIO_PUBLIC_BASE_URL || '',
    minioUploadUrlExpires: Number.parseInt(process.env.MINIO_UPLOAD_URL_EXPIRES || '3600', 10),
    minioRegion: process.env.MINIO_REGION || 'us-east-1',
    minioAccessKey: process.env.MINIO_ACCESS_KEY || '',
    minioSecretKey: process.env.MINIO_SECRET_KEY || '',
    minioBucket: process.env.MINIO_BUCKET || '',
    public: {
      appBaseUrl: process.env.NUXT_PUBLIC_APP_BASE_URL || ''
    }
  }
})
