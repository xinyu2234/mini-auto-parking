import { describe, expect, it } from 'vitest'
import { isPoseColliding } from './collision'
import { rectsOverlap, wrapPi } from './geometry'
import { createWorld, validateWorldLayout } from './world'

describe('world', () => {
  it.each(['perpendicular', 'parallel', 'angled'] as const)(
    'generates a valid %s layout',
    (layoutId) => {
      const world = createWorld(layoutId)
      expect(world.layoutName.length).toBeGreaterThan(0)
      expect(world.spots.length).toBeGreaterThanOrEqual(4)
      expect(validateWorldLayout(world)).toEqual([])
      expect(isPoseColliding(world, world.startPose)).toBe(false)
      for (const spot of world.spots) {
        expect(spot.goalPose).toBeDefined()
      }
    }
  )

  it('rotates spots only in the angled layout', () => {
    const angled = createWorld('angled')
    const perpendicular = createWorld('perpendicular')
    const parallel = createWorld('parallel')
    expect(angled.spots.some((s) => s.angle !== 0)).toBe(true)
    expect(perpendicular.spots.every((s) => s.angle === 0)).toBe(true)
    expect(parallel.spots.every((s) => s.angle === 0)).toBe(true)
  })

  it('packs perpendicular spots tightly like comb teeth', () => {
    const world = createWorld('perpendicular')
    const tops = world.spots
      .filter((s) => s.id.startsWith('T'))
      .sort((a, b) => a.rect.x - b.rect.x)
    expect(tops.length).toBeGreaterThanOrEqual(5)
    for (let i = 1; i < tops.length; i++) {
      const gap = tops[i].rect.x - (tops[i - 1].rect.x + tops[i - 1].rect.w)
      expect(gap).toBeCloseTo(0.3, 5)
    }
  })

  it('orients parallel spots along the horizontal road', () => {
    const world = createWorld('parallel')
    expect(world.spots.length).toBeGreaterThanOrEqual(4)
    for (const spot of world.spots) {
      expect(spot.rect.w).toBeGreaterThan(spot.rect.h)
      expect(Math.abs(wrapPi(spot.goalPose.heading))).toBeLessThan(0.01)
    }
  })

  it('keeps parallel spots close to the long sides', () => {
    const world = createWorld('parallel')
    const tops = world.spots.filter((s) => s.id.startsWith('T'))
    const bottoms = world.spots.filter((s) => s.id.startsWith('B'))
    expect(tops.length).toBeGreaterThan(0)
    expect(bottoms.length).toBeGreaterThan(0)
    for (const spot of tops) {
      expect(spot.rect.y + spot.rect.h).toBeGreaterThan(17)
    }
    for (const spot of bottoms) {
      expect(spot.rect.y).toBeLessThan(4)
    }
  })

  it('aligns angled spot headings with the slot long axis', () => {
    const world = createWorld('angled')
    for (const spot of world.spots) {
      const longAxis = spot.angle + Math.PI / 2
      expect(Math.abs(wrapPi(spot.goalPose.heading - longAxis))).toBeLessThan(0.01)
    }
  })

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
    const entrance =
      world.entrance.side === 'left'
        ? {
            x: -world.wallThickness,
            y: world.entrance.center - world.entrance.width / 2,
            w: world.wallThickness,
            h: world.entrance.width
          }
        : {
            x: world.entrance.center - world.entrance.width / 2,
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
