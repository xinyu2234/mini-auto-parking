import { describe, expect, it } from 'vitest'
import { stepPose } from './bicycle'

const wheelbase = 2.5

describe('bicycle model', () => {
  it('drives straight', () => {
    const end = stepPose({ x: 0, y: 0, heading: 0 }, 0, 3, wheelbase)
    expect(end.x).toBeCloseTo(3, 6)
    expect(end.y).toBeCloseTo(0, 6)
    expect(end.heading).toBeCloseTo(0, 6)
  })

  it('completes a full circle with constant steering', () => {
    const radius = 4.5
    const steering = Math.atan(wheelbase / radius)
    const circumference = 2 * Math.PI * radius
    const end = stepPose({ x: 0, y: 0, heading: 0 }, steering, circumference, wheelbase)
    expect(end.x).toBeCloseTo(0, 4)
    expect(end.y).toBeCloseTo(0, 4)
    expect(Math.abs(end.heading - 2 * Math.PI) % (2 * Math.PI)).toBeCloseTo(0, 4)
  })

  it('reverses along the opposite direction', () => {
    const end = stepPose({ x: 0, y: 0, heading: 0 }, 0, -2, wheelbase)
    expect(end.x).toBeCloseTo(-2, 6)
    expect(end.y).toBeCloseTo(0, 6)
  })
})
