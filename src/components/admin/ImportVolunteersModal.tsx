'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Upload, Download, X, CheckCircle2, AlertCircle, SkipForward, Loader2 } from 'lucide-react'
import type { ImportRow, ImportResult } from '@/app/api/admin/volunteers/import/route'

// ─── CSV template ─────────────────────────────────────────────────────────────

const TEMPLATE_HEADERS = [
  'first_name',
  'last_name',
  'email',
  'mobile',
  'date_of_birth',
  'address_line1',
  'address_line2',
  'suburb',
  'state',
  'postcode',
  'emergency_name',
  'emergency_phone',
  'emergency_relation',
  'preferred_locations',
  'areas_of_interest',
  'status',
  'medical_notes',
  'accessibility_needs',
  'notes',
]

const TEMPLATE_EXAMPLE = [
  'Jane',
  'Smith',
  'jane.smith@example.com',
  '0412345678',
  '1990-05-15',
  '12 Example St',
  '',
  'Logan Central',
  'QLD',
  '4114',
  'John Smith',
  '0498765432',
  'Spouse',
  'Loganholme',
  'Cashier',
  'PENDING_INDUCTION',
  '',
  '',
  '',
]

function downloadTemplate() {
  const csv = [TEMPLATE_HEADERS.join(','), TEMPLATE_EXAMPLE.join(',')].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'volunteer-import-template.csv'
  a.click()
  URL.revokeObjectURL(url)
}

// ─── CSV parser ───────────────────────────────────────────────────────────────

function parseLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current.trim())
  return result
}

function parseCSV(text: string): ImportRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) return []

  const headers = parseLine(lines[0]).map((h) =>
    h.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
  )

  return lines.slice(1).map((line) => {
    const values = parseLine(line)
    return Object.fromEntries(
      headers.map((h, i) => [h, values[i] ?? ''])
    ) as unknown as ImportRow
  })
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusChip({ status }: { status: ImportResult['status'] }) {
  if (status === 'imported')
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
        <CheckCircle2 className="h-3 w-3" /> Imported
      </span>
    )
  if (status === 'skipped')
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
        <SkipForward className="h-3 w-3" /> Skipped
      </span>
    )
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
      <AlertCircle className="h-3 w-3" /> Error
    </span>
  )
}

// ─── Main modal ───────────────────────────────────────────────────────────────

type Step = 'upload' | 'preview' | 'results'

export function ImportVolunteersModal() {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [step, setStep] = React.useState<Step>('upload')
  const [rows, setRows] = React.useState<ImportRow[]>([])
  const [parseError, setParseError] = React.useState<string | null>(null)
  const [importing, setImporting] = React.useState(false)
  const [results, setResults] = React.useState<ImportResult[]>([])
  const fileRef = React.useRef<HTMLInputElement>(null)

  function reset() {
    setStep('upload')
    setRows([])
    setParseError(null)
    setResults([])
    if (fileRef.current) fileRef.current.value = ''
  }

  function handleClose() {
    setOpen(false)
    reset()
    if (results.some((r) => r.status === 'imported')) {
      router.refresh()
    }
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setParseError(null)

    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string
        const parsed = parseCSV(text)
        if (parsed.length === 0) {
          setParseError('No data rows found. Make sure your CSV has a header row and at least one data row.')
          return
        }
        setRows(parsed)
        setStep('preview')
      } catch {
        setParseError('Could not parse the CSV file. Please check the format and try again.')
      }
    }
    reader.readAsText(file)
  }

  async function handleImport() {
    setImporting(true)
    try {
      const res = await fetch('/api/admin/volunteers/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Import failed')
      setResults(data.results)
      setStep('results')
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  function downloadResults() {
    const headers = ['row', 'name', 'email', 'status', 'email_sent', 'reason']
    const csvRows = results.map((r) =>
      [r.row, `"${r.name}"`, r.email, r.status, r.emailSent != null ? (r.emailSent ? 'yes' : 'no') : '', `"${r.reason ?? ''}"`].join(',')
    )
    const csv = [headers.join(','), ...csvRows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'import-results.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const importedCount = results.filter((r) => r.status === 'imported').length
  const skippedCount = results.filter((r) => r.status === 'skipped').length
  const errorCount = results.filter((r) => r.status === 'error').length

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-500"
      >
        <Upload className="h-4 w-4" aria-hidden="true" />
        Import CSV
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl flex flex-col max-h-[90vh]">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Import Volunteers</h2>
                <p className="text-sm text-gray-500">
                  {step === 'upload' && 'Upload a CSV file to bulk-import volunteers'}
                  {step === 'preview' && `${rows.length} row${rows.length !== 1 ? 's' : ''} ready to import`}
                  {step === 'results' && `Import complete — ${importedCount} added`}
                </p>
              </div>
              <button
                onClick={handleClose}
                className="rounded-md p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

              {/* ── STEP: UPLOAD ── */}
              {step === 'upload' && (
                <>
                  {/* Template download */}
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 flex items-start gap-3">
                    <Download className="h-5 w-5 text-gray-400 mt-0.5 shrink-0" aria-hidden="true" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">Start with the template</p>
                      <p className="text-xs text-gray-500 mt-0.5 mb-2">
                        Download our CSV template with all supported columns and an example row.
                      </p>
                      <button
                        onClick={downloadTemplate}
                        className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                      >
                        <Download className="h-3.5 w-3.5" aria-hidden="true" />
                        Download template
                      </button>
                    </div>
                  </div>

                  {/* Required columns info */}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Required columns</p>
                    <div className="flex flex-wrap gap-1.5">
                      {['first_name', 'last_name', 'email', 'mobile'].map((col) => (
                        <code key={col} className="rounded bg-orange-50 border border-orange-200 px-2 py-0.5 text-xs text-orange-700 font-mono">
                          {col}
                        </code>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      All other columns are optional. Volunteers with an already-registered email will be skipped.
                      Each new volunteer will receive a welcome email with a link to set their own password.
                    </p>
                  </div>

                  {/* File input */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select CSV file
                    </label>
                    <input
                      ref={fileRef}
                      type="file"
                      accept=".csv,text/csv"
                      onChange={handleFile}
                      className="block w-full text-sm text-gray-500 file:mr-4 file:rounded-md file:border file:border-gray-300 file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-gray-700 hover:file:bg-gray-50 cursor-pointer"
                    />
                  </div>

                  {parseError && (
                    <p className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                      {parseError}
                    </p>
                  )}
                </>
              )}

              {/* ── STEP: PREVIEW ── */}
              {step === 'preview' && (
                <>
                  <p className="text-sm text-gray-600">
                    Review the rows below. Any volunteer whose email is already in the system will be skipped automatically.
                  </p>

                  <div className="overflow-x-auto rounded-lg border border-gray-200">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-gray-100 bg-gray-50">
                          <th className="px-3 py-2 text-left font-semibold text-gray-500">#</th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-500">Name</th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-500">Email</th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-500">Mobile</th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-500">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {rows.map((row, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                            <td className="px-3 py-2 text-gray-900 font-medium">
                              {row.first_name} {row.last_name}
                            </td>
                            <td className="px-3 py-2 text-gray-600">{row.email}</td>
                            <td className="px-3 py-2 text-gray-600">{row.mobile}</td>
                            <td className="px-3 py-2 text-gray-500">{row.status || 'PENDING_INDUCTION'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {parseError && (
                    <p className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                      {parseError}
                    </p>
                  )}
                </>
              )}

              {/* ── STEP: RESULTS ── */}
              {step === 'results' && (
                <>
                  {/* Summary chips */}
                  <div className="flex flex-wrap gap-3">
                    <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                      <div>
                        <p className="text-lg font-bold text-green-700">{importedCount}</p>
                        <p className="text-xs text-green-600">Imported</p>
                      </div>
                    </div>
                    {skippedCount > 0 && (
                      <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                        <SkipForward className="h-5 w-5 text-amber-600" />
                        <div>
                          <p className="text-lg font-bold text-amber-700">{skippedCount}</p>
                          <p className="text-xs text-amber-600">Skipped</p>
                        </div>
                      </div>
                    )}
                    {errorCount > 0 && (
                      <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                        <AlertCircle className="h-5 w-5 text-red-600" />
                        <div>
                          <p className="text-lg font-bold text-red-700">{errorCount}</p>
                          <p className="text-xs text-red-600">Errors</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {importedCount > 0 && (
                    <p className="text-sm text-gray-600">
                      Each imported volunteer has been sent a welcome email with a link to set their own password.
                      The link is valid for <strong>7 days</strong>.
                    </p>
                  )}

                  <div className="overflow-x-auto rounded-lg border border-gray-200">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-gray-100 bg-gray-50">
                          <th className="px-3 py-2 text-left font-semibold text-gray-500">#</th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-500">Name</th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-500">Email</th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-500">Result</th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-500">Welcome Email</th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-500">Note</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {results.map((r) => (
                          <tr key={r.row} className="hover:bg-gray-50">
                            <td className="px-3 py-2 text-gray-400">{r.row}</td>
                            <td className="px-3 py-2 text-gray-900 font-medium">{r.name}</td>
                            <td className="px-3 py-2 text-gray-600">{r.email}</td>
                            <td className="px-3 py-2"><StatusChip status={r.status} /></td>
                            <td className="px-3 py-2">
                              {r.emailSent === true && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                                  <CheckCircle2 className="h-3 w-3" /> Sent
                                </span>
                              )}
                              {r.emailSent === false && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                                  <AlertCircle className="h-3 w-3" /> Failed
                                </span>
                              )}
                              {r.emailSent == null && <span className="text-gray-400">—</span>}
                            </td>
                            <td className="px-3 py-2 text-gray-500">{r.reason ?? ''}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-200 shrink-0">
              <div>
                {step === 'preview' && (
                  <button
                    onClick={reset}
                    disabled={importing}
                    className="text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50"
                  >
                    ← Choose different file
                  </button>
                )}
                {step === 'results' && importedCount > 0 && (
                  <button
                    onClick={downloadResults}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-orange-600 hover:text-orange-700"
                  >
                    <Download className="h-4 w-4" aria-hidden="true" />
                    Download results CSV
                  </button>
                )}
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleClose}
                  disabled={importing}
                  className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  {step === 'results' ? 'Close' : 'Cancel'}
                </button>

                {step === 'preview' && (
                  <button
                    onClick={handleImport}
                    disabled={importing || rows.length === 0}
                    className="inline-flex items-center gap-2 rounded-md bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50"
                  >
                    {importing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        Importing…
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4" aria-hidden="true" />
                        Import {rows.length} volunteer{rows.length !== 1 ? 's' : ''}
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>
      )}
    </>
  )
}
