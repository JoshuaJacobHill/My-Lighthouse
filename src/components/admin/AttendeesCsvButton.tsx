'use client'

import * as React from 'react'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'

/** Downloads a pre-built CSV string as a file. */
export function AttendeesCsvButton({ csv, filename }: { csv: string; filename: string }) {
  function handleExport() {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <Button variant="outline" size="sm" onClick={handleExport}>
      <Download className="h-4 w-4" aria-hidden="true" /> Export CSV
    </Button>
  )
}
