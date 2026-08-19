import { describe, expect, it } from 'vitest'
import { isPoseColliding } from './collision'
import { rectsOverlap } from './geometry'
import { createWorld, validateWorldLayout } from './world'

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

  it('enforces the non-overlap rule for the generated layout', () => {
    const world = createWorld()
    expect(validateWorldLayout(world)).toEqual([])
  })

  it('keeps every spot and obstacle inside the lot bounds', () => {
    const world = createWorld()
    const b = world.bounds
    for (const spot of world.spots) {
      const r = spot.rect
      expect(r.x).toBeGreaterThanOrEqual(0)
      expect(r.y).toBeGreaterThanOrEqual(0)
      expect(r.x + r.w).toBeLessThanOrEqual(b.w)
      expect(r.y + r.h).toBeLessThanOrEqual(b.h)
    }
    for (const o of world.obstacles) {
      expect(o.x).toBeGreaterThanOrEqual(0)
      expect(o.y).toBeGreaterThanOrEqual(0)
      expect(o.x + o.w).toBeLessThanOrEqual(b.w)
      expect(o.y + o.h).toBeLessThanOrEqual(b.h)
    }
  })

  it('has no spot-spot, obstacle-obstacle or spot-obstacle overlaps', () => {
    const world = createWorld()
    for (let i = 0; i < world.spots.length; i++) {
      for (let j = i + 1; j < world.spots.length; j++) {
        expect(rectsOverlap(world.spots[i].rect, world.spots[j].rect, 1e-9)).toBe(false)
      }
    }
    for (let i = 0; i < world.obstacles.length; i++) {
      for (let j = i + 1; j < world.obstacles.length; j++) {
        expect(rectsOverlap(world.obstacles[i], world.obstacles[j], 1e-9)).toBe(false)
      }
      for (const spot of world.spots) {
        expect(rectsOverlap(spot.rect, world.obstacles[i], 1e-9)).toBe(false)
      }
    }
  })

  it('leaves the entrance opening unblocked', () => {
    const world = createWorld()
    const entrance = {
      x: world.entrance.x,
      y: -world.wallThickness,
      w: world.entrance.width,
      h: world.wallThickness
    }
    for (const spot of world.spots) {
      expect(rectsOverlap(spot.rect, entrance, 1e-9)).toBe(false)
    }
    for (const o of world.obstacles) {
      expect(rectsOverlap(o, entrance, 1e-9)).toBe(false)
    }
  })

  it('rejects a layout with overlapping spots', () => {
    const world = createWorld()
    world.spots[0].rect = { ...world.spots[1].rect }
    const errors = validateWorldLayout(world)
    expect(errors.some((e) => e.includes('重叠'))).toBe(true)
  })
})
