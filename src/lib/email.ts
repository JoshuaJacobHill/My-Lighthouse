import nodemailer from 'nodemailer'
import { Resend } from 'resend'
import prisma from '@/lib/prisma'
import type { EmailTemplateType } from '@prisma/client'

export type EmailProvider = 'resend' | 'smtp' | 'mock'

const CC_ADDRESS = 'volunteer@lighthousecare.org.au'

interface SendEmailOptions {
  to: string
  subject: string
  html: string
  text?: string
  templateType?: EmailTemplateType
  volunteerId?: string
  from?: string // override the default sender (e.g. Lighthouse Family Church for tithes)
  attachments?: { filename: string; content: string; contentType: string }[]
  /** Pass true to CC volunteer@lighthousecare.org.au — admin/coordinator emails only */
  ccAdmin?: boolean
}

interface SendEmailResult {
  success: boolean
  messageId?: string
  error?: string
}

// ─── Read settings from DB, fall back to env vars ─────────────────────────────

async function getEmailSettings(): Promise<Record<string, string>> {
  try {
    const rows = await prisma.appSetting.findMany({
      where: {
        key: {
          in: [
            'email_provider',
            'email_from_name',
            'email_from_address',
            'resend_api_key',
            'smtp_host',
            'smtp_port',
            'smtp_user',
            'smtp_pass',
          ],
        },
      },
    })
    return Object.fromEntries(rows.map((r) => [r.key, r.value]))
  } catch {
    return {}
  }
}

function resolveProvider(settings: Record<string, string>): EmailProvider {
  const val = settings.email_provider ?? process.env.EMAIL_PROVIDER ?? 'mock'
  if (val === 'resend' || val === 'smtp') return val
  return 'mock'
}

function resolveFromAddress(settings: Record<string, string>): string {
  const name =
    settings.email_from_name ??
    process.env.EMAIL_FROM_NAME ??
    'Lighthouse Care Volunteers'
  const address =
    settings.email_from_address ??
    process.env.EMAIL_FROM_ADDRESS ??
    'volunteers@lighthousecare.org.au'
  return `${name} <${address}>`
}

// ─── Providers ────────────────────────────────────────────────────────────────

async function sendViaMock(options: SendEmailOptions): Promise<SendEmailResult> {
  console.log('\n📧 [Mock Email]')
  console.log(`  To:      ${options.to}`)
  console.log(`  Subject: ${options.subject}`)
  return { success: true, messageId: `mock-${Date.now()}` }
}

async function sendViaResend(
  options: SendEmailOptions,
  settings: Record<string, string>
): Promise<SendEmailResult> {
  const apiKey = settings.resend_api_key ?? process.env.RESEND_API_KEY
  if (!apiKey) {
    return { success: false, error: 'Resend API key is not configured. Add it in Admin → Settings → Email.' }
  }

  const resend = new Resend(apiKey)

  const { data, error } = await resend.emails.send({
    from: options.from ?? resolveFromAddress(settings),
    to: options.to,
    ...(options.ccAdmin ? { cc: CC_ADDRESS, replyTo: CC_ADDRESS } : {}),
    subject: options.subject,
    html: options.html,
    text: options.text,
    attachments: options.attachments?.map((a) => ({
      filename: a.filename,
      content: Buffer.from(a.content).toString('base64'),
    })),
  })

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, messageId: data?.id }
}

async function sendViaSMTP(
  options: SendEmailOptions,
  settings: Record<string, string>
): Promise<SendEmailResult> {
  const host = settings.smtp_host ?? process.env.SMTP_HOST
  const port = parseInt(settings.smtp_port ?? process.env.SMTP_PORT ?? '587', 10)
  const user = settings.smtp_user ?? process.env.SMTP_USER
  const pass = settings.smtp_pass ?? process.env.SMTP_PASS

  if (!host) {
    return { success: false, error: 'SMTP host is not configured. Add it in Admin → Settings → Email.' }
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: user && pass ? { user, pass } : undefined,
  })

  const info = await transporter.sendMail({
    from: options.from ?? resolveFromAddress(settings),
    to: options.to,
    ...(options.ccAdmin ? { cc: CC_ADDRESS, replyTo: CC_ADDRESS } : {}),
    subject: options.subject,
    html: options.html,
    text: options.text,
  })

  return { success: true, messageId: info.messageId }
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  // Load settings from DB (with env var fallbacks)
  const settings = await getEmailSettings()
  const provider = resolveProvider(settings)

  // Create a pending log entry
  const logEntry = await prisma.emailLog.create({
    data: {
      to: options.to,
      subject: options.subject,
      templateType: options.templateType ?? null,
      status: 'PENDING',
      volunteerId: options.volunteerId ?? null,
    },
  })

  let result: SendEmailResult

  try {
    switch (provider) {
      case 'resend':
        result = await sendViaResend(options, settings)
        break
      case 'smtp':
        result = await sendViaSMTP(options, settings)
        break
      case 'mock':
      default:
        result = await sendViaMock(options)
        break
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    result = { success: false, error: errorMessage }
  }

  // Update the log entry with outcome
  await prisma.emailLog.update({
    where: { id: logEntry.id },
    data: {
      status: result.success ? 'SENT' : 'FAILED',
      sentAt: result.success ? new Date() : null,
      errorMsg: result.error ?? null,
      metadata: result.messageId ? { messageId: result.messageId } : undefined,
    },
  })

  return result
}
