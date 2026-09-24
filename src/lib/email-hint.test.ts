import { describe, expect, it } from 'vitest'
import { emailHint, normaliseEmail, suggestDomain } from './email-hint'

describe('normaliseEmail', () => {
  it('tidies what phones and paste do to an address', () => {
    expect(normaliseEmail('  Leila.M@Gmail.com ')).toBe('leila.m@gmail.com')
    expect(normaliseEmail('mailto:dave@bigpond.com')).toBe('dave@bigpond.com')
    expect(normaliseEmail('dave @ bigpond.com')).toBe('dave@bigpond.com')
  })
})

describe('suggestDomain', () => {
  it('leaves a real domain alone', () => {
    for (const d of ['gmail.com', 'bigpond.net.au', 'optusnet.com.au', 'proton.me']) {
      expect(suggestDomain(d)).toBeNull()
    }
  })

  it('catches the finger slips', () => {
    expect(suggestDomain('gmial.com')).toBe('gmail.com')
    expect(suggestDomain('gmai.com')).toBe('gmail.com')
    expect(suggestDomain('hotmial.com')).toBe('hotmail.com')
    expect(suggestDomain('hotmil.com')).toBe('hotmail.com')
    expect(suggestDomain('yahooo.com')).toBe('yahoo.com')
    expect(suggestDomain('outlok.com')).toBe('outlook.com')
    expect(suggestDomain('icloud.co')).toBe('icloud.com')
  })

  it('catches the endings nobody means', () => {
    expect(suggestDomain('gmail.con')).toBe('gmail.com')
    expect(suggestDomain('gmail.cmo')).toBe('gmail.com')
    expect(suggestDomain('bigpond.con')).toBe('bigpond.com')
  })

  it('fixes both halves when an address is wrong twice over', () => {
    // Found by typing it into the real form: correcting only the ending gave
    // "gmial.com", which fixes the half nobody would notice and leaves the
    // half they would.
    expect(suggestDomain('gmial.con')).toBe('gmail.com')
    expect(suggestDomain('hotmial.co')).toBe('hotmail.com')
  })

  it('still fixes a bad ending on a domain it does not recognise', () => {
    expect(suggestDomain('ourchurch.con')).toBe('ourchurch.com')
  })

  it('strips a country code bolted onto a global provider', () => {
    expect(suggestDomain('gmail.com.au')).toBe('gmail.com')
    // But a provider that genuinely is .com.au keeps it.
    expect(suggestDomain('optusnet.com.au')).toBeNull()
    expect(suggestDomain('hotmail.com.au')).toBeNull()
  })

  it('does not rewrite an unusual but plausible domain', () => {
    // A workplace or small ISP must not be "corrected" into gmail.
    for (const d of ['lighthousecare.org.au', 'ourchurch.net', 'sjc.qld.edu.au', 'zoho.com']) {
      expect(suggestDomain(d)).toBeNull()
    }
  })
})

describe('emailHint', () => {
  it('says nothing while somebody is still typing', () => {
    for (const partial of ['', 'l', 'leila', 'leila@', 'leila@gm', 'leila@gmail.']) {
      expect(emailHint(partial).kind).toBe('quiet')
    }
  })

  it('calls out what more typing will not fix', () => {
    expect(emailHint('leila@@gmail.com').kind).toBe('invalid')
    expect(emailHint('leila,m@gmail.com').kind).toBe('invalid')
    expect(emailHint('@gmail.com').kind).toBe('invalid')
    expect(emailHint('leila@.gmail.com').kind).toBe('invalid')
    expect(emailHint('leila@gmail..com').kind).toBe('invalid')
  })

  it('offers the whole corrected address, not just the domain', () => {
    const hint = emailHint('leila.m@gmial.com')
    expect(hint.kind).toBe('suggestion')
    if (hint.kind === 'suggestion') {
      expect(hint.suggestion).toBe('leila.m@gmail.com')
      expect(hint.message).toContain('leila.m@gmail.com')
    }
  })

  it('is happy with a good address', () => {
    for (const good of [
      'leila.m@gmail.com',
      'dave+slh@bigpond.net.au',
      'josh@lighthousecare.org.au',
      "o'brien@outlook.com",
    ]) {
      expect(emailHint(good).kind).toBe('ok')
    }
  })

  it('accepts a suggestion that is then taken', () => {
    const first = emailHint('leila@hotmial.com')
    expect(first.kind).toBe('suggestion')
    if (first.kind === 'suggestion') expect(emailHint(first.suggestion).kind).toBe('ok')
  })
})
