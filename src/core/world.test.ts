import { describe, expect, it } from 'vitest'
import { isPoseColliding } from './collision'
import { createWorld } from './world'

describe('world', () => {
  it('contains at least four parking spots with nose-out goals', () => {
    const world = createWorld()
    expect(world.spots.length).toBeGreaterThanOrEqual(4)
    for (const spot of world.spots) {
      expect(spot.goalPose).toBeDefined()
    }
  })

  it('starts the car inside the lot without collision', () => {
    const world = createWorld()
    expect(isPoseColliding(world, world.startPose)).toBe(false)
  })
})
