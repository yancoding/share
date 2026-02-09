import { randomUUID } from 'node:crypto'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

interface UploadUrlBody {
  fileName?: string
  contentType?: string
}

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
}

function bypassProxyForEndpoint(endpoint: string) {
  try {
    const hostname = new URL(endpoint).hostname
    const merged = new Set(
      `${process.env.NO_PROXY || process.env.no_proxy || ''}`.split(',').map(item => item.trim()).filter(Boolean)
    )
    merged.add(hostname)
    const value = Array.from(merged).join(',')
    process.env.NO_PROXY = value
    process.env.no_proxy = value
  }
  catch {
    // Ignore malformed endpoint and keep default network behavior.
  }
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)

  if (!config.minioEndpoint || !config.minioAccessKey || !config.minioSecretKey || !config.minioBucket) {
    throw createError({
      statusCode: 500,
      statusMessage: 'MinIO config is incomplete. Please set MINIO_ENDPOINT/MINIO_ACCESS_KEY/MINIO_SECRET_KEY/MINIO_BUCKET.'
    })
  }

  const body = await readBody<UploadUrlBody>(event)
  const fileName = body?.fileName || 'video.mp4'
  const contentType = body?.contentType || 'video/mp4'

  if (!contentType.startsWith('video/')) {
    throw createError({ statusCode: 400, statusMessage: 'Only video files are allowed.' })
  }

  const safeName = sanitizeFileName(fileName)
  const objectKey = `videos/${Date.now()}-${randomUUID()}-${safeName}`
  bypassProxyForEndpoint(config.minioEndpoint)

  const s3 = new S3Client({
    endpoint: config.minioEndpoint,
    region: config.minioRegion,
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.minioAccessKey,
      secretAccessKey: config.minioSecretKey
    }
  })

  const command = new PutObjectCommand({
    Bucket: config.minioBucket,
    Key: objectKey,
    ContentType: contentType
  })

  const expiresIn = Math.max(60, Number(config.minioUploadUrlExpires || 3600))
  const signedUrl = await getSignedUrl(s3, command, { expiresIn })
  const endpoint = (config.minioPublicBaseUrl || config.minioEndpoint).replace(/\/$/, '')
  const objectUrl = `${endpoint}/${config.minioBucket}/${objectKey}`

  return {
    signedUrl,
    objectUrl,
    expiresIn
  }
})
