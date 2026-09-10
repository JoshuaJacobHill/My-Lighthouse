import { describe, expect, it, vi, afterEach } from 'vitest'
import { createHash } from 'node:crypto'
import {
  buildPurchasePayload,
  buildUserData,
  centsToAmount,
  isMatchable,
  normaliseCountry,
  normaliseEmail,
  normaliseName,
  normalisePhoneAu,
  normalisePostcode,
  sendEvents,
  sha256,
  type CapiConfig,
} from './meta-capi'

const cfg: CapiConfig = {
  baseUrl: 'https://graph.facebook.com',
  version: 'v26.0',
  datasetId: '326811303390692',
  token: 'test-token',
  currency: 'AUD',
}

const digest = (v: string) => createHash('sha256').update(v, 'utf8').digest('hex')

describe('money', () => {
  it('reads EMC cents as dollars', () => {
    expect(centsToAmount(7194)).toBe(71.94)
    expect(centsToAmount(2500)).toBe(25)
    expect(centsToAmount(0)).toBe(0)
  })

  it('does not produce floating-point dust', () => {
    // 0.1 + 0.2 territory: the value must be exactly representable in JSON.
    expect(JSON.stringify(centsToAmount(1010))).toBe('10.1')
  })
})

describe('email normalisation', () => {
  it('trims and lowercases before hashing', () => {
    expect(normaliseEmail('  Jane.Smith@Example.COM ')).toBe('jane.smith@example.com')
    expect(sha256(normaliseEmail('Jane@Example.com')!)).toBe(digest('jane@example.com'))
  })

  it('rejects anything that is not an address', () => {
    expect(normaliseEmail('not-an-email')).toBeNull()
    expect(normaliseEmail('')).toBeNull()
    expect(normaliseEmail(null)).toBeNull()
  })
})

describe('Australian phone normalisation', () => {
  it('turns every local shape into 61-prefixed digits', () => {
    expect(normalisePhoneAu('0412 345 678')).toBe('61412345678')
    expect(normalisePhoneAu('+61 412 345 678')).toBe('61412345678')
    expect(normalisePhoneAu('61412345678')).toBe('61412345678')
    expect(normalisePhoneAu('0061412345678')).toBe('61412345678')
    expect(normalisePhoneAu('412345678')).toBe('61412345678')
  })

  it('handles landlines the same way', () => {
    expect(normalisePhoneAu('(07) 3123 4567')).toBe('61731234567')
    expect(normalisePhoneAu('07 3123 4567')).toBe('61731234567')
  })

  it('drops what it cannot recognise rather than guessing', () => {
    // A wrong hash is worse than no hash: it looks like data and matches nobody.
    expect(normalisePhoneAu('12345')).toBeNull()
    expect(normalisePhoneAu('n/a')).toBeNull()
    expect(normalisePhoneAu('')).toBeNull()
  })

  it('hashes the normalised form, not what was typed', () => {
    expect(sha256(normalisePhoneAu('0412 345 678')!)).toBe(digest('61412345678'))
  })
})

describe('name normalisation', () => {
  it('lowercases and strips punctuation and spaces', () => {
    expect(normaliseName('  Mary-Jane ')).toBe('maryjane')
    expect(normaliseName("O'Brien")).toBe('obrien')
    expect(normaliseName('Smith')).toBe('smith')
  })

  it('keeps non-Latin letters', () => {
    expect(normaliseName('Ngô')).toBe('ngô')
  })

  it('returns null for nothing usable', () => {
    expect(normaliseName('   ')).toBeNull()
    expect(normaliseName('!!!')).toBeNull()
  })
})

describe('postcode and country normalisation', () => {
  it('accepts four Australian digits', () => {
    expect(normalisePostcode(' 4129 ')).toBe('4129')
    expect(normalisePostcode('41 29')).toBe('4129')
  })

  it('rejects a postcode that is not four digits', () => {
    expect(normalisePostcode('412')).toBeNull()
    expect(normalisePostcode('SW1A 1AA')).toBeNull()
  })

  it('lowercases the two-letter country', () => {
    expect(normaliseCountry('AU')).toBe('au')
    expect(normaliseCountry()).toBe('au')
    expect(normaliseCountry('Australia')).toBeNull()
  })
})

describe('user data', () => {
  it('hashes each present field and omits the rest', () => {
    const user = buildUserData({ email: 'Jane@Example.com', mobile: '0412 345 678' })
    expect(user.em).toEqual([digest('jane@example.com')])
    expect(user.ph).toEqual([digest('61412345678')])
    expect(user.country).toEqual([digest('au')])
    expect(user.fn).toBeUndefined()
    expect(user.zp).toBeUndefined()
  })

  it('never carries a raw value through', () => {
    const raw = { email: 'jane@example.com', mobile: '0412345678', givenName: 'Jane' }
    const serialised = JSON.stringify(buildUserData(raw))
    expect(serialised).not.toContain('jane@example.com')
    expect(serialised).not.toContain('0412345678')
    expect(serialised.toLowerCase()).not.toContain('jane')
  })

  it('does not count country alone as matchable', () => {
    // Everyone shopping in Loganholme is in Australia; that matches nobody.
    expect(isMatchable(buildUserData({}))).toBe(false)
    expect(isMatchable(buildUserData({ email: 'jane@example.com' }))).toBe(true)
    expect(isMatchable(buildUserData({ mobile: '0412345678' }))).toBe(true)
  })

  it('accepts name plus postcode together as a match', () => {
    const user = buildUserData({ givenName: 'Jane', familyName: 'Smith', postalCode: '4129' })
    expect(isMatchable(user)).toBe(true)
  })
})

describe('purchase payload', () => {
  const input = {
    saleIdentifier: 'LOGANHOLME-000123',
    occurredAt: new Date('2026-09-09T04:30:00.000Z'),
    totalCents: 7194,
    userData: buildUserData({ email: 'jane@example.com' }),
  }

  it('matches what Meta accepted in testing', () => {
    const p = buildPurchasePayload(input, cfg)
    expect(p.data).toHaveLength(1)
    const e = p.data[0]
    expect(e.event_name).toBe('Purchase')
    expect(e.action_source).toBe('physical_store')
    expect(e.custom_data.currency).toBe('AUD')
    expect(e.custom_data.value).toBe(71.94)
  })

  it('uses the sale identifier as both event_id and order_id', () => {
    const e = buildPurchasePayload(input, cfg).data[0]
    expect(e.event_id).toBe('LOGANHOLME-000123')
    expect(e.custom_data.order_id).toBe('LOGANHOLME-000123')
  })

  it('sends the transaction time, not now', () => {
    const e = buildPurchasePayload(input, cfg).data[0]
    expect(e.event_time).toBe(Math.floor(input.occurredAt.getTime() / 1000))
  })

  it('builds an identical event_id every time, so a retry cannot double-count', () => {
    const a = buildPurchasePayload(input, cfg).data[0].event_id
    const b = buildPurchasePayload(input, cfg).data[0].event_id
    expect(a).toBe(b)
  })

  it('includes test_event_code only when configured', () => {
    expect(buildPurchasePayload(input, cfg).test_event_code).toBeUndefined()
    expect(
      buildPurchasePayload(input, { ...cfg, testEventCode: 'TEST94037' }).test_event_code,
    ).toBe('TEST94037')
  })
})

describe('sending', () => {
  afterEach(() => vi.unstubAllGlobals())

  const ok = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

  const payload = buildPurchasePayload(
    {
      saleIdentifier: 'S1',
      occurredAt: new Date('2026-09-09T04:30:00.000Z'),
      totalCents: 2500,
      userData: buildUserData({ email: 'jane@example.com' }),
    },
    cfg,
  )

  it('succeeds only when Meta says it received an event', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ok({ events_received: 1, fbtrace_id: 'abc' })))
    const res = await sendEvents(payload, cfg)
    expect(res.ok).toBe(true)
  })

  it('treats HTTP 200 with events_received 0 as a failure', async () => {
    // Meta does this. Marking such a sale as sent would lose it for good.
    vi.stubGlobal('fetch', vi.fn(async () => ok({ events_received: 0 })))
    const res = await sendEvents(payload, cfg)
    expect(res.ok).toBe(false)
  })

  it('does not retry a 400', async () => {
    const f = vi.fn(async () => ok({ error: { message: 'bad param' } }, 400))
    vi.stubGlobal('fetch', f)
    const res = await sendEvents(payload, cfg)
    expect(res.ok).toBe(false)
    expect(f).toHaveBeenCalledTimes(1)
  })

  it('retries a 500 and can then succeed', async () => {
    let n = 0
    const f = vi.fn(async () => {
      n++
      return n === 1 ? ok({}, 500) : ok({ events_received: 1 })
    })
    vi.stubGlobal('fetch', f)
    const res = await sendEvents(payload, cfg)
    expect(res.ok).toBe(true)
    expect(f).toHaveBeenCalledTimes(2)
  })

  it('posts to the configured dataset with a bearer token', async () => {
    const f = vi.fn(async () => ok({ events_received: 1 }))
    vi.stubGlobal('fetch', f)
    await sendEvents(payload, cfg)
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://graph.facebook.com/v26.0/326811303390692/events')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer test-token')
  })
})
