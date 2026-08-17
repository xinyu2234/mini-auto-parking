import { describe, expect, it } from 'vitest'
import type { CarSpec } from './types'
import { normalizeAngle } from './geometry'
import { reedsSheppWords, sampleRSWord } from './reedShepp'

const car: CarSpec = {
  length: 4,
  width: 1.8,
  wheelbase: 2.5,
  maxSteering: Math.atan(2.5 / 4.5),
  minTurningRadius: 4.5
}

const cases = [
  { x: 5, y: 0, phi: 0 },
  { x: 0, y: 4, phi: Math.PI },
  { x: 3, y: 3, phi: Math.PI / 2 },
  { x: 0, y: -4, phi: 0 },
  { x: 6, y: 1, phi: 2.5 }
]

describe('Reeds-Shepp words', () => {
  it.each(cases)('finds a reconstructable path for %j', ({ x, y, phi }) => {
    const words = reedsSheppWords(x, y, phi)
    expect(words.length).toBeGreaterThan(0)
    for (const w of words) {
      const scaled = {
        segments: w.segments.map((s) => ({ ...s, s: s.s * car.minTurningRadius })),
        length: w.length * car.minTurningRadius
      }
      const samples = sampleRSWord(scaled, { x: 0, y: 0, heading: 0 }, car, 0.01)
      const end = samples[samples.length - 1]
      const tx = x * car.minTurningRadius
      const ty = y * car.minTurningRadius
      expect(Math.hypot(end.x - tx, end.y - ty)).toBeLessThan(0.05)
      expect(Math.abs(normalizeAngle(end.heading) - normalizeAngle(phi))).toBeLessThan(0.05)
    }
  })

  it('prefers the straight path for a straight goal', () => {
    const words = reedsSheppWords(5, 0, 0)
    expect(words[0].length).toBeCloseTo(5, 5)
  })
})
