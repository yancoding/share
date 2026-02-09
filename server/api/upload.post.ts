import { randomUUID } from 'node:crypto'
import { S3Client } from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'

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

  const formData = await readMultipartFormData(event)
  const filePart = formData?.find(item => item.name === 'file')

  if (!filePart || !filePart.data?.length) {
    throw createError({ statusCode: 400, statusMessage: 'File is required.' })
  }

  const fileName = sanitizeFileName(filePart.filename || 'video.mp4')
  const contentType = filePart.type || 'video/mp4'

  if (!contentType.startsWith('video/')) {
    throw createError({ statusCode: 400, statusMessage: 'Only video files are allowed.' })
  }

  const objectKey = `videos/${Date.now()}-${randomUUID()}-${fileName}`
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

  try {
    // Use multipart upload for better reliability on slower networks / larger files.
    const upload = new Upload({
      client: s3,
      params: {
        Bucket: config.minioBucket,
        Key: objectKey,
        Body: filePart.data,
        ContentType: contentType
      },
      queueSize: 4,
      partSize: 5 * 1024 * 1024,
      leavePartsOnError: false
    })

    await upload.done()
  }
  catch (error) {
    const details = error as {
      message?: string
      $metadata?: { httpStatusCode?: number; requestId?: string }
      Code?: string
      code?: string
      name?: string
    }
    const status = details?.$metadata?.httpStatusCode
    const requestId = details?.$metadata?.requestId
    const code = details?.Code || details?.code || details?.name
    const message = details?.message || 'unknown error'
    const extra = [status ? `status=${status}` : '', code ? `code=${code}` : '', requestId ? `requestId=${requestId}` : '']
      .filter(Boolean)
      .join(', ')

    throw createError({
      statusCode: 500,
      statusMessage: `Upload to MinIO failed: ${message}${extra ? ` (${extra})` : ''}`
    })
  }

  const endpoint = (config.minioPublicBaseUrl || config.minioEndpoint).replace(/\/$/, '')
  const objectUrl = `${endpoint}/${config.minioBucket}/${objectKey}`

  return {
    objectUrl
  }
})
