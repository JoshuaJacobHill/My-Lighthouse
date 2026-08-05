'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Save, Loader2, Wand2, Code2, AlignLeft, Eye } from 'lucide-react'
import { buildHtmlFromText } from '@/lib/email-html'

interface Template {
  id: string | null
  type: string
  name: string
  subject: string
  bodyHtml: string
  bodyText: string
  isActive: boolean
}

interface TemplateEditorProps {
  template: Template
}

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? 'https://my.lighthousecare.org.au'

const SAMPLE_VARS: Record<string, string> = {
  first_name: 'Sarah',
  last_name: 'Mitchell',
  shift_date: '12/05/2025',
  shift_time: '9:00 am – 1:00 pm',
  location: 'Loganholme',
  portal_link: APP_URL,
  org_name: 'Lighthouse Care',
  organisation_name: 'Lighthouse Care',
  amount: '$50.00',
  frequency: 'monthly',
  fund_name: 'Lighthouse Care',
  receipt_no: 'LC-1A2B3C4D',
  set_password_link: `${APP_URL}/account/setup?token=sample`,
  resume_link: `${APP_URL}/give/resume/sample`,
}

const AVAILABLE_VARS = [
  { key: '{{first_name}}', desc: 'Volunteer first name' },
  { key: '{{last_name}}', desc: 'Volunteer last name' },
  { key: '{{shift_date}}', desc: 'Shift date' },
  { key: '{{shift_time}}', desc: 'Shift time range' },
  { key: '{{location}}', desc: 'Location name' },
  { key: '{{portal_link}}', desc: 'Volunteer portal URL' },
  { key: '{{organisation_name}}', desc: 'Organisation name' },
  { key: '{{set_password_link}}', desc: 'Password setup link (import welcome)' },
  { key: '{{amount}}', desc: 'Gift amount (donor emails)' },
  { key: '{{frequency}}', desc: 'Recurring frequency (migration)' },
  { key: '{{fund_name}}', desc: 'Fund / appeal name (donor emails)' },
  { key: '{{resume_link}}', desc: 'Re-confirm card link (migration)' },
]

function replaceSampleVars(text: string): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, key) => SAMPLE_VARS[key] ?? match)
}

type Tab = 'html' | 'text' | 'preview'

export function TemplateEditor({ template }: TemplateEditorProps) {
  const router = useRouter()
  const [tab, setTab] = React.useState<Tab>('html')
  const [subject, setSubject] = React.useState(template.subject)
  const [bodyHtml, setBodyHtml] = React.useState(template.bodyHtml)
  const [bodyText, setBodyText] = React.useState(template.bodyText)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState(false)

  // Debounced preview HTML — only re-renders 400 ms after typing stops
  const [previewHtml, setPreviewHtml] = React.useState(() => replaceSampleVars(bodyHtml))
  React.useEffect(() => {
    const id = setTimeout(() => setPreviewHtml(replaceSampleVars(bodyHtml)), 400)
    return () => clearTimeout(id)
  }, [bodyHtml])

  function handleGenerateHtml() {
    if (!bodyText.trim()) return
    const generated = buildHtmlFromText(bodyText, APP_URL)
    setBodyHtml(generated)
    setTab('preview')
  }

  async function handleSave() {
    setError(null)
    setSuccess(false)
    setSaving(true)
    try {
      const response = await fetch(`/api/admin/email-templates/${template.type}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, bodyHtml, bodyText }),
      })
      const result = await response.json()
      if (!result.success) {
        setError(result.error ?? 'Failed to save template.')
      } else {
        setSuccess(true)
        setTimeout(() => setSuccess(false), 3000)
        router.refresh()
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Subject */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Subject Line</label>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
        />
      </div>

      {/* Tab bar */}
      <div>
        <div className="flex items-center justify-between mb-0">
          <div className="flex gap-0.5 border-b border-gray-200 w-full">
            {(
              [
                { id: 'html', label: 'HTML Body', icon: Code2 },
                { id: 'text', label: 'Plain Text', icon: AlignLeft },
                { id: 'preview', label: 'Preview', icon: Eye },
              ] as { id: Tab; label: string; icon: React.ElementType }[]
            ).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={[
                  'inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
                  tab === id
                    ? 'border-orange-500 text-orange-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
                ].join(' ')}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* HTML tab */}
        {tab === 'html' && (
          <div className="pt-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-400">
                Edit raw HTML. Use the button below to auto-generate from your plain text.
              </p>
              <button
                type="button"
                onClick={handleGenerateHtml}
                disabled={!bodyText.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-medium text-orange-700 hover:bg-orange-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Wand2 className="h-3.5 w-3.5" aria-hidden="true" />
                Generate HTML from plain text
              </button>
            </div>
            <textarea
              value={bodyHtml}
              onChange={(e) => setBodyHtml(e.target.value)}
              rows={18}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm font-mono text-gray-900 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/30 resize-y"
              spellCheck={false}
            />
          </div>
        )}

        {/* Plain text tab */}
        {tab === 'text' && (
          <div className="pt-3 space-y-2">
            <p className="text-xs text-gray-400">
              Fallback for email clients that don&apos;t support HTML. Keep this in sync with the HTML body.
            </p>
            <textarea
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              rows={12}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm font-mono text-gray-900 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/30 resize-y"
              spellCheck={false}
            />
          </div>
        )}

        {/* Preview tab */}
        {tab === 'preview' && (
          <div className="pt-3">
            <div className="rounded-lg border border-gray-200 overflow-hidden">
              {/* Simulated email header */}
              <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 space-y-1">
                <div className="flex items-baseline gap-2 text-xs">
                  <span className="font-medium text-gray-500 w-14 shrink-0">To:</span>
                  <span className="text-gray-700">Sarah Mitchell &lt;sarah@example.com&gt;</span>
                </div>
                <div className="flex items-baseline gap-2 text-xs">
                  <span className="font-medium text-gray-500 w-14 shrink-0">Subject:</span>
                  <span className="text-gray-700 font-medium">{replaceSampleVars(subject)}</span>
                </div>
              </div>
              {/* Rendered email */}
              <iframe
                srcDoc={previewHtml}
                title="Email preview"
                sandbox="allow-same-origin"
                className="w-full border-0"
                style={{ height: '640px' }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Preview uses sample data. Variables are substituted with example values.
            </p>
          </div>
        )}
      </div>

      {/* Available variables */}
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Available Variables</h3>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {AVAILABLE_VARS.map(({ key, desc }) => (
            <div key={key} className="flex items-center gap-2">
              <code className="rounded bg-white border border-gray-200 px-2 py-0.5 text-xs font-mono text-orange-600">
                {key}
              </code>
              <span className="text-xs text-gray-500">{desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Error / success */}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          Template saved successfully.
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-orange-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Template
        </button>
        <a
          href="/admin/emails"
          className="rounded-lg border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
        >
          Cancel
        </a>
      </div>
    </div>
  )
}
