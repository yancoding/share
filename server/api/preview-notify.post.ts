import nodemailer from 'nodemailer'
import { getRequestIP, getRequestHeader, readBody } from 'h3'

function parseVideoUrl(value: unknown) {
  if (typeof value !== 'string' || !value) {
    return ''
  }

  try {
    const parsed = new URL(value)
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString()
    }
  }
  catch {
    return ''
  }

  return ''
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const body = await readBody<{ videoUrl?: string }>(event)
  const videoUrl = parseVideoUrl(body?.videoUrl)

  if (!videoUrl) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid video url.' })
  }

  if (!config.previewNotifyTo) {
    return { sent: false, reason: 'PREVIEW_NOTIFY_TO is not configured.' }
  }

  if (!config.smtpHost || !config.smtpPort || !config.smtpUser || !config.smtpPass) {
    return { sent: false, reason: 'SMTP config is incomplete.' }
  }

  const visitedAt = new Date()
  const visitedAtIso = visitedAt.toISOString()
  const visitedAtLocal = new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'medium',
    hour12: false,
    timeZone: 'Asia/Shanghai'
  }).format(visitedAt)
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  const userAgent = getRequestHeader(event, 'user-agent') || 'unknown'
  const referer = getRequestHeader(event, 'referer') || 'unknown'
  const appBaseUrl = config.public.appBaseUrl || 'unknown'
  const subject = `【视频预览提醒】有人访问播放页 (${visitedAtLocal})`

  const textLines = [
    '视频预览访问提醒',
    '================',
    '',
    '[核心信息]',
    `- 访问时间(北京时间): ${visitedAtLocal}`,
    `- 访问时间(UTC): ${visitedAtIso}`,
    `- 视频地址: ${videoUrl}`,
    '',
    '[访客信息]',
    `- 访问 IP: ${ip}`,
    `- User-Agent: ${userAgent}`,
    '',
    '[页面来源]',
    `- Referer: ${referer}`,
    `- 站点地址: ${appBaseUrl}`,
  ]

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'PingFang SC','Microsoft YaHei',sans-serif;line-height:1.6;color:#1f2937;">
      <h2 style="margin:0 0 12px;">视频预览访问提醒</h2>
      <p style="margin:0 0 16px;color:#4b5563;">有人进入了视频预览播放页。</p>

      <div style="border:1px solid #e5e7eb;border-radius:10px;padding:12px 14px;margin-bottom:12px;">
        <div style="font-weight:600;margin-bottom:8px;">核心信息</div>
        <div><strong>访问时间(北京时间):</strong> ${escapeHtml(visitedAtLocal)}</div>
        <div><strong>访问时间(UTC):</strong> ${escapeHtml(visitedAtIso)}</div>
        <div><strong>视频地址:</strong> <a href="${escapeHtml(videoUrl)}">${escapeHtml(videoUrl)}</a></div>
      </div>

      <div style="border:1px solid #e5e7eb;border-radius:10px;padding:12px 14px;margin-bottom:12px;">
        <div style="font-weight:600;margin-bottom:8px;">访客信息</div>
        <div><strong>访问 IP:</strong> ${escapeHtml(ip)}</div>
        <div><strong>User-Agent:</strong> ${escapeHtml(userAgent)}</div>
      </div>

      <div style="border:1px solid #e5e7eb;border-radius:10px;padding:12px 14px;">
        <div style="font-weight:600;margin-bottom:8px;">页面来源</div>
        <div><strong>Referer:</strong> ${escapeHtml(referer)}</div>
        <div><strong>站点地址:</strong> ${escapeHtml(appBaseUrl)}</div>
      </div>
    </div>
  `

  const transporter = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpSecure,
    auth: {
      user: config.smtpUser,
      pass: config.smtpPass
    },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000
  })

  try {
    await transporter.sendMail({
      from: config.previewNotifyFrom || config.smtpUser,
      to: config.previewNotifyTo,
      subject,
      text: textLines.join('\n'),
      html
    })
  }
  catch (error) {
    const details = error as { message?: string; code?: string; command?: string }
    return {
      sent: false,
      reason: `SMTP send failed: ${details?.message || 'unknown error'}`,
      code: details?.code || 'UNKNOWN',
      command: details?.command || 'SEND'
    }
  }

  return { sent: true }
})
