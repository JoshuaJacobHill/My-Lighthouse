import { describe, expect, it } from 'vitest'
import {
  DEFAULT_BANNED_TERMS,
  bannedMessage,
  bannedTermIn,
  parseTerms,
} from './wishlist-limits'

const terms = DEFAULT_BANNED_TERMS as readonly string[]

describe('bannedTermIn', () => {
  it('catches the things children actually write', () => {
    expect(bannedTermIn('a PS5', terms)).toBe('ps5')
    expect(bannedTermIn('I would love an iPhone please', terms)).toBe('iphone')
    expect(bannedTermIn('Nintendo Switch games and the switch', terms)).toBeTruthy()
    expect(bannedTermIn('a gaming pc', terms)).toBe('gaming pc')
  })

  it('ignores punctuation and casing', () => {
    expect(bannedTermIn('PlayStation!!!', terms)).toBe('playstation')
    expect(bannedTermIn('an  X BOX', terms)).toBe('x box')
  })

  it('matches whole words, not substrings', () => {
    // The bug that would make this feature worse than nothing: a child asking
    // for an activity book told their answer is invalid, because "tv" is
    // inside "Activity".
    expect(bannedTermIn('An activity book', terms)).toBeNull()
    expect(bannedTermIn('A catalogue of dinosaurs', terms)).toBeNull()
    expect(bannedTermIn('Scattergories', terms)).toBeNull()
  })

  it('lets ordinary wishes through', () => {
    for (const wish of [
      'A big set of textas and a sketchbook',
      'Minecraft Lego',
      'A netball and a skipping rope',
      'Diary of a Wimpy Kid',
      'A drink bottle and a lunch box for school',
      'Broncos shorts and a t-shirt',
      'A basketball and a pump',
    ]) {
      expect(bannedTermIn(wish, terms)).toBeNull()
    }
  })

  it('names the term, so the message can be specific', () => {
    const hit = bannedTermIn('can i have a drone', terms)
    expect(hit).toBe('drone')
    expect(bannedMessage(hit!)).toContain('drone')
  })

  it('says nothing about an empty answer', () => {
    expect(bannedTermIn('', terms)).toBeNull()
    expect(bannedTermIn('   ', terms)).toBeNull()
  })
})

describe('parseTerms', () => {
  it('takes one per line or comma-separated, and folds case', () => {
    expect(parseTerms('PS5\niPhone, Drone\n\n  Xbox  ')).toEqual([
      'ps5',
      'iphone',
      'drone',
      'xbox',
    ])
  })

  it('drops duplicates however they were typed', () => {
    expect(parseTerms('ps5\nPS5\nPs5')).toEqual(['ps5'])
  })

  it('copes with an empty list', () => {
    expect(parseTerms('')).toEqual([])
    expect(parseTerms('\n,  ,\n')).toEqual([])
  })
})
