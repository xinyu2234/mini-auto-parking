import { describe, expect, it } from 'vitest'
import { buildReverseSegment } from './retry'
import { createWorld } from './world'

describe('retry reverse segment', () => {
  it('reverses up to the requested distance from the start', () => {
    const world = createWorld()
    const samples = buildReverseSegment(world, world.startPose, 1.2)
    expect(samples.length).toBe(12)
    expect(samples[samples.length - 1].y).toBeCloseTo(world.startPose.y - 1.2, 6)
  })

  it('stops before leaving the lot boundary', () => {
    const world = createWorld()
    const samples = buildReverseSegment(world, { x: 40, y: 0.15, heading: Math.PI / 2 }, 1.2)
    expect(samples.length).toBeLessThan(12)
    expect(samples[samples.length - 1].y).toBeGreaterThanOrEqual(0)
  })
})
