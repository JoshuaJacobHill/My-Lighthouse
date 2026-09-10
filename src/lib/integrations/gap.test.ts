import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  EMPTY_GUID,
  findRows,
  gapStores,
  getAllStoreSales,
  isExternalSale,
  TAKE,
  createToken,
  getSaleDetail,
  getStoreSales,
  hasRealCustomer,
  resetGapToken,
  saleInstant,
  toEmcDateParam,
  type GapConfig,
} from './gap'

const cfg: GapConfig = {
  baseUrl: 'https://gap4.ezimanager.cloud',
  email: 'integration@example.com',
  password: 'never-logged',
  persistent: true,
  stores: [{ id: 1, name: 'Loganholme' }],
}

const loganholme = cfg.stores[0]

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

afterEach(() => {
  vi.unstubAllGlobals()
  resetGapToken()
})

describe('customer presence', () => {
  it('reads the all-zero GUID as no customer', () => {
    expect(hasRealCustomer({ customerGuid: EMPTY_GUID })).toBe(false)
    expect(hasRealCustomer({ customerGuid: EMPTY_GUID.toUpperCase() })).toBe(false)
  })

  it('reads a missing GUID as no customer', () => {
    expect(hasRealCustomer({})).toBe(false)
    expect(hasRealCustomer({ customerGuid: '' })).toBe(false)
    expect(hasRealCustomer({ customerGuid: '   ' })).toBe(false)
  })

  it('accepts a real GUID', () => {
    expect(hasRealCustomer({ customerGuid: '3f2504e0-4f89-11d3-9a0c-0305e82c3301' })).toBe(true)
  })
})

describe('date parameters', () => {
  it('formats a window as naive Brisbane wall-clock', () => {
    // 14:00 UTC is midnight the next day in Brisbane. Sending the UTC clock
    // would ask EMC for a window ten hours in the past.
    expect(toEmcDateParam(new Date('2026-09-08T14:00:00.000Z'))).toBe('2026-09-09T00:00:00')
    expect(toEmcDateParam(new Date('2026-09-09T13:59:59.000Z'))).toBe('2026-09-09T23:59:59')
  })

  it('carries no timezone marker, which is what EMC expects', () => {
    expect(toEmcDateParam(new Date())).not.toMatch(/[Z+]/)
  })
})

describe('transaction time', () => {
  it('prefers created and treats a bare timestamp as UTC', () => {
    const r = saleInstant({ created: '2026-09-09T04:30:00', createdLocal: '2026-09-09T14:30:00' })
    expect(r?.source).toBe('created')
    expect(r?.at.toISOString()).toBe('2026-09-09T04:30:00.000Z')
  })

  it('respects an explicit offset on created', () => {
    const r = saleInstant({ created: '2026-09-09T14:30:00+10:00' })
    expect(r?.at.toISOString()).toBe('2026-09-09T04:30:00.000Z')
  })

  it('falls back to createdLocal as Brisbane', () => {
    const r = saleInstant({ createdLocal: '2026-09-09T14:30:00' })
    expect(r?.source).toBe('createdLocal')
    expect(r?.at.toISOString()).toBe('2026-09-09T04:30:00.000Z')
  })

  it('returns null when EMC gives us no time at all', () => {
    expect(saleInstant({})).toBeNull()
    expect(saleInstant({ created: 'not a date' })).toBeNull()
  })
})

describe('authentication', () => {
  it('accepts a token wrapped in an object', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ token: 'abc123' })))
    expect(await createToken(cfg)).toBe('abc123')
  })

  it('accepts a bare string token', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('"abc123"', { status: 200 })),
    )
    expect(await createToken(cfg)).toBe('abc123')
  })

  it('never puts the password or the response body in the error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json({ message: 'Invalid password never-logged' }, 401)),
    )
    await expect(createToken(cfg)).rejects.toThrow(/CreateToken failed \(401\)/)
    await expect(createToken(cfg)).rejects.not.toThrow(/never-logged/)
  })
})

describe('request retry rules', () => {
  it('refreshes the token once on a 401 and retries', async () => {
    const calls: string[] = []
    const f = vi.fn(async (input: string | URL) => {
      const url = String(input)
      calls.push(url)
      if (url.includes('CreateToken')) return json({ token: `t${calls.length}` })
      // Fail the first sales call only.
      const salesCalls = calls.filter((c) => c.includes('/sales')).length
      return salesCalls === 1 ? json({}, 401) : json([{ saleHeaderID: 1 }])
    })
    vi.stubGlobal('fetch', f)

    const rows = await getStoreSales(cfg, loganholme, {
      start: new Date('2026-09-09T00:00:00Z'),
      end: new Date('2026-09-09T01:00:00Z'),
    })

    expect(rows).toHaveLength(1)
    expect(calls.filter((c) => c.includes('CreateToken'))).toHaveLength(2)
    expect(calls.filter((c) => c.includes('/sales'))).toHaveLength(2)
  })

  it('does not loop on a 401 that keeps happening', async () => {
    let sales = 0
    const f = vi.fn(async (input: string | URL) => {
      const url = String(input)
      if (url.includes('CreateToken')) return json({ token: 'x' })
      sales++
      return json({}, 401)
    })
    vi.stubGlobal('fetch', f)

    await expect(getSaleDetail(cfg, 42)).rejects.toThrow(/401/)
    // One original attempt plus exactly one retry after the refresh.
    expect(sales).toBe(2)
  })

  it('gives up immediately on a 403 rather than hammering their login', async () => {
    let detail = 0
    const f = vi.fn(async (input: string | URL) => {
      const url = String(input)
      if (url.includes('CreateToken')) return json({ token: 'x' })
      detail++
      return json({}, 403)
    })
    vi.stubGlobal('fetch', f)

    await expect(getSaleDetail(cfg, 42)).rejects.toThrow(/403/)
    expect(detail).toBe(1)
  })

  it('sends the window and ExcludeVoids as query parameters', async () => {
    const f = vi.fn(async (input: string | URL) => {
      const url = String(input)
      if (url.includes('CreateToken')) return json({ token: 'x' })
      return json([])
    })
    vi.stubGlobal('fetch', f)

    await getStoreSales(cfg, loganholme, {
      start: new Date('2026-09-08T14:00:00Z'),
      end: new Date('2026-09-09T13:59:59Z'),
      take: 10,
    })

    const salesUrl = f.mock.calls.map((c) => String(c[0])).find((u) => u.includes('/sales'))!
    expect(salesUrl).toContain('/api/store/1/sales')
    expect(salesUrl).toContain('StartDate=2026-09-09T00%3A00%3A00')
    expect(salesUrl).toContain('ExcludeVoids=true')
    expect(salesUrl).toContain('Take=10')
  })

  it('reads the { list: [...] } wrapper EMC actually returns', async () => {
    // This is the bug that read a busy trading hour as zero sales: the client
    // checked for a bare array, `items` and `data`, and missed `list`.
    const f = vi.fn(async (input: string | URL) =>
      String(input).includes('CreateToken')
        ? json({ token: 'x' })
        : json({ list: [{ saleHeaderID: 396613, saleIdentifier: '0010425360034' }], total: 1 }),
    )
    vi.stubGlobal('fetch', f)
    const rows = await getStoreSales(cfg, loganholme, { start: new Date(), end: new Date() })
    expect(rows).toHaveLength(1)
    expect(rows[0].saleHeaderID).toBe(396613)
  })
})

describe('store discovery', () => {
  it('reads one variable per store, so adding a shop is a settings change', () => {
    const stores = gapStores({
      EMC_LOGANHOLME_STORE_ID: '1',
      EMC_HILLCREST_STORE_ID: '2',
    })
    expect(stores).toEqual([
      { id: 1, name: 'Loganholme' },
      { id: 2, name: 'Hillcrest' },
    ])
  })

  it('title-cases a multi-word store name', () => {
    const stores = gapStores({ EMC_MOUNT_WARREN_STORE_ID: '3' })
    expect(stores[0].name).toBe('Mount Warren')
  })

  it('still honours the original single-store variables', () => {
    const stores = gapStores({
      EMC_STORE_ID: '1',
      EMC_STORE_NAME: 'Loganholme',
    })
    expect(stores).toEqual([{ id: 1, name: 'Loganholme' }])
  })

  it('ignores an empty or non-numeric value rather than inventing store NaN', () => {
    expect(gapStores({ EMC_HILLCREST_STORE_ID: '' })).toEqual([])
    expect(gapStores({ EMC_HILLCREST_STORE_ID: 'two' })).toEqual([])
    expect(gapStores({})).toEqual([])
  })
})

describe('finding the rows in a response', () => {
  it('takes whichever key holds an array', () => {
    expect(findRows({ list: [1, 2] })).toEqual({ rows: [1, 2], shape: 'object.list[]' })
    expect(findRows({ items: [1] })).toEqual({ rows: [1], shape: 'object.items[]' })
    expect(findRows({ data: [1] })).toEqual({ rows: [1], shape: 'object.data[]' })
  })

  it('still reads a bare array', () => {
    expect(findRows([1, 2])).toEqual({ rows: [1, 2], shape: 'array' })
  })

  it('is not fooled by keys that come before the list', () => {
    const r = findRows({ total: 1, page: 1, list: [{ saleHeaderID: 1 }] })
    expect(r.rows).toHaveLength(1)
  })

  it('names the keys it found when there is no array, so the shape is visible', () => {
    // The whole point: an empty result must say why, not just be empty.
    expect(findRows({ total: 0, message: 'none' }).shape).toBe('object{total,message}')
  })
})

describe('windows bigger than one request', () => {
  /** A tenant holding `total` sales spread evenly across the day. */
  function tenant(total: number) {
    const day = new Date('2026-09-10T00:00:00+10:00').getTime()
    const dayMs = 24 * 60 * 60_000
    const sales = Array.from({ length: total }, (_, i) => ({
      saleHeaderID: i + 1,
      at: day + Math.floor((i * dayMs) / total),
    }))
    const requests: number[] = []

    const f = vi.fn(async (input: string | URL) => {
      const url = new URL(String(input))
      if (url.pathname.includes('CreateToken')) return json({ token: 'x' })

      // EMC's naive Brisbane wall-clock, back to an instant.
      const from = new Date(`${url.searchParams.get('StartDate')}+10:00`).getTime()
      const to = new Date(`${url.searchParams.get('EndDate')}+10:00`).getTime()
      const take = Number(url.searchParams.get('Take'))
      requests.push(to - from)

      const inWindow = sales.filter((s) => s.at >= from && s.at <= to)
      return json({ list: inWindow.slice(0, take).map((s) => ({ saleHeaderID: s.saleHeaderID })) })
    })

    return { f, requests }
  }

  const whole = {
    start: new Date('2026-09-10T00:00:00+10:00'),
    end: new Date('2026-09-11T00:00:00+10:00'),
  }

  it('takes one request when the day fits', async () => {
    const { f, requests } = tenant(120)
    vi.stubGlobal('fetch', f)
    const rows = await getAllStoreSales(cfg, loganholme, whole)
    expect(rows).toHaveLength(120)
    expect(requests).toHaveLength(1)
  })

  it('splits the window rather than dropping the tail of a busy day', async () => {
    // The bug this exists for: a flat Take would return 500 of 1400 and look
    // like a quiet day. Nothing would prompt anyone to check.
    const { f, requests } = tenant(1400)
    vi.stubGlobal('fetch', f)
    const rows = await getAllStoreSales(cfg, loganholme, whole)
    expect(rows).toHaveLength(1400)
    expect(requests.length).toBeGreaterThan(1)
  })

  it('deduplicates the sale sitting on a split boundary', async () => {
    const { f } = tenant(1400)
    vi.stubGlobal('fetch', f)
    const rows = await getAllStoreSales(cfg, loganholme, whole)
    expect(new Set(rows.map((r) => r.saleHeaderID)).size).toBe(rows.length)
  })

  it('says so when it cannot see past the cap', async () => {
    // Every window full, however small: a server-side limit we cannot beat.
    const f = vi.fn(async (input: string | URL) =>
      String(input).includes('CreateToken')
        ? json({ token: 'x' })
        : json({ list: Array.from({ length: TAKE }, (_, i) => ({ saleHeaderID: i + 1 })) }),
    )
    vi.stubGlobal('fetch', f)
    const notes: string[] = []
    await getAllStoreSales(cfg, loganholme, { ...whole, onNote: (n) => notes.push(n) })
    expect(notes.length).toBeGreaterThan(0)
    expect(notes[0]).toMatch(/sales may be missing/)
  })
})

describe('telling a web order from a counter sale', () => {
  it('reads the externalSale flag', () => {
    expect(isExternalSale({ externalSale: 1 })).toBe(true)
    expect(isExternalSale({ externalSale: 0, machineName: 'LANE03' })).toBe(false)
  })

  it('accepts a boolean as well as 0/1', () => {
    // The tenant returns numbers, and nothing documents that it always will.
    expect(isExternalSale({ externalSale: true })).toBe(true)
    expect(isExternalSale({ externalSale: false, machineName: 'LANE02' })).toBe(false)
  })

  it('falls back to the missing till lane when there is no flag', () => {
    // The two signals agree in the live data: all 56 external sales had no
    // machineName, and every counter sale had one.
    expect(isExternalSale({ machineName: null })).toBe(true)
    expect(isExternalSale({})).toBe(true)
    expect(isExternalSale({ machineName: 'LANE03' })).toBe(false)
  })

  it('trusts the flag over the lane when they disagree', () => {
    expect(isExternalSale({ externalSale: 0, machineName: null })).toBe(false)
  })
})
