/**
 * Email HTML utilities — no server dependencies, safe to import from client components.
 *
 * Queensland (Brisbane) is always UTC+10 — no daylight saving.
 * Brand colour: #f97316 (orange-500)
 */

const ORANGE = '#f97316'
const TEXT_BODY = '#374151'
const TEXT_LIGHT = '#6b7280'

const BUTTON_STYLE = [
  `background:${ORANGE}`,
  'color:#ffffff',
  'padding:13px 28px',
  'border-radius:6px',
  'text-decoration:none',
  'display:inline-block',
  'font-weight:600',
  'font-size:14px',
  'line-height:1',
].join(';')

const P_STYLE = `margin:0 0 18px 0;line-height:1.7;color:${TEXT_BODY};font-size:15px;`

// ─── Full email wrapper ───────────────────────────────────────────────────────

export function wrapEmailHtml(bodyContent: string, appUrl = 'https://my.lighthousecare.org.au'): string {
  const logoUrl = `${appUrl}/logo-inline-black.png`

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>Lighthouse Care</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;-webkit-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

          <!-- Logo header -->
          <tr>
            <td style="background:#ffffff;padding:28px 40px 24px;text-align:center;border-bottom:3px solid ${ORANGE};">
              <img src="${logoUrl}" alt="Lighthouse Care" height="38" style="height:38px;width:auto;display:block;margin:0 auto;" />
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px 28px;color:${TEXT_BODY};font-size:15px;line-height:1.7;">
              ${bodyContent}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 40px;text-align:center;">
              <p style="margin:0;font-size:12px;color:${TEXT_LIGHT};line-height:1.7;">
                Lighthouse Care — making lives better so that together we can make the world better.<br>
                ABN 87 637 110 948 &middot; Logan, South East Queensland<br>
                <a href="mailto:volunteer@lighthousecare.org.au" style="color:${ORANGE};text-decoration:none;">volunteer@lighthousecare.org.au</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

// ─── Church-branded wrapper (tithes to Lighthouse Family Church) ──────────────
// Same layout as the Care wrapper but with the church wordmark + footer, and no
// Lighthouse Care tagline/ABN.

export function wrapChurchEmailHtml(bodyContent: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>Lighthouse Family Church</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;-webkit-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:#ffffff;padding:28px 40px 24px;text-align:center;border-bottom:3px solid ${ORANGE};">
              <span style="font-size:20px;font-weight:800;letter-spacing:-0.02em;color:#111827;">Lighthouse Family Church</span>
            </td>
          </tr>
          <tr>
            <td style="padding:36px 40px 28px;color:${TEXT_BODY};font-size:15px;line-height:1.7;">
              ${bodyContent}
            </td>
          </tr>
          <tr>
            <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 40px;text-align:center;">
              <p style="margin:0;font-size:12px;color:${TEXT_LIGHT};line-height:1.7;">
                Lighthouse Family Church &middot; Logan, South East Queensland<br>
                <a href="https://lighthousefamilychurch.org.au" style="color:${ORANGE};text-decoration:none;">lighthousefamilychurch.org.au</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

// ─── Build HTML from plain text ───────────────────────────────────────────────
// Converts the plain-text version of a template into styled HTML using the
// email wrapper above. Handles paragraphs, line breaks, portal link buttons,
// and inline links.

export function buildHtmlFromText(text: string, appUrl = 'https://my.lighthousecare.org.au'): string {
  const button = (href: string, label: string) =>
    `<p style="margin:24px 0;"><a href="${href}" style="${BUTTON_STYLE}">${label}</a></p>`

  const p = (content: string) =>
    `<p style="${P_STYLE}">${content}</p>`

  const paragraphs = text.split(/\n\n+/).filter((para) => para.trim())

  const htmlParts = paragraphs.map((para) => {
    const trimmed = para.trim()

    // Standalone {{portal_link}} or bare URL → orange button
    if (trimmed === '{{portal_link}}' || /^https?:\/\/\S+$/.test(trimmed)) {
      return button(trimmed, 'Visit your portal &rarr;')
    }

    // Single line ending with ": {{portal_link}}" → labelled button
    if (/:\s*\{\{portal_link\}\}$/.test(trimmed) && !trimmed.includes('\n')) {
      const label = trimmed.replace(/:\s*\{\{portal_link\}\}$/, '').trim()
      return button('{{portal_link}}', label + ' &rarr;')
    }

    // Regular paragraph — inline {{portal_link}} becomes an orange hyperlink
    const content = trimmed
      .split('\n')
      .map((line) =>
        line.replace(
          /\{\{portal_link\}\}/g,
          `<a href="{{portal_link}}" style="color:${ORANGE};font-weight:500;text-decoration:underline;">your volunteer portal</a>`
        )
      )
      .join('<br>')

    return p(content)
  })

  return wrapEmailHtml(htmlParts.join('\n              '), appUrl)
}
