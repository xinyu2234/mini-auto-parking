import { describe, expect, it } from 'vitest'
import { isPoseColliding } from './collision'
import { pointsOverlap, rectCorners, rectsOverlap, wrapPi } from './geometry'
import { approachZone, createWorld, reachableFreeRatio, validateWorldLayout } from './world'

const LAYOUTS = ['perpendicular', 'parallel', 'angled'] as const
const SEEDS = [1, 42, 777, 2024, 90210]

describe('randomized world generation', () => {
  it.each(LAYOUTS)('keeps the %s layout valid across many seeds', (layoutId) => {
    for (const seed of SEEDS) {
      const world = createWorld(layoutId, seed)
      expect(validateWorldLayout(world)).toEqual([])
      expect(world.spots.length).toBeGreaterThanOrEqual(4)
      expect(isPoseColliding(world, world.startPose)).toBe(false)
      expect(world.spots.filter((s) => !s.occupied).length).toBeGreaterThanOrEqual(4)
    }
  })

  it.each(LAYOUTS)('parks other cars in some %s bays', (layoutId) => {
    const occupiedCounts = SEEDS.map(
      (seed) => createWorld(layoutId, seed).spots.filter((s) => s.occupied).length
    )
    expect(Math.max(...occupiedCounts)).toBeGreaterThan(0)
  })

  it('keeps enough free bays to pick a target', () => {
    for (const layoutId of LAYOUTS) {
      for (const seed of SEEDS) {
        const world = createWorld(layoutId, seed)
        const free = world.spots.filter((s) => !s.occupied)
        expect(free.length).toBeGreaterThanOrEqual(4)
        expect(free.length).toBeLessThanOrEqual(world.spots.length)
      }
    }
  })

  it('reproduces the same lot for the same seed', () => {
    for (const layoutId of LAYOUTS) {
      const a = createWorld(layoutId, 31415)
      const b = createWorld(layoutId, 31415)
      expect(JSON.stringify(a.spots)).toBe(JSON.stringify(b.spots))
      expect(JSON.stringify(a.obstacles)).toBe(JSON.stringify(b.obstacles))
    }
  })

  it.each(LAYOUTS)('produces different maps for different seeds in %s', (layoutId) => {
    const signatures = new Set<string>()
    for (const seed of SEEDS) {
      const world = createWorld(layoutId, seed)
      const signature = world.spots
        .map((s) => `${s.rect.x.toFixed(2)},${s.rect.y.toFixed(2)}`)
        .join('|')
      signatures.add(signature)
    }
    expect(signatures.size).toBeGreaterThan(1)
  })

  it('randomizes obstacle placement', () => {
    const signatures = new Set<string>()
    for (const seed of SEEDS) {
      const world = createWorld('perpendicular', seed)
      expect(world.obstacles.length).toBeGreaterThan(0)
      signatures.add(world.obstacles.map((o) => `${o.x.toFixed(1)},${o.y.toFixed(1)}`).join('|'))
    }
    expect(signatures.size).toBeGreaterThan(1)
  })

  it('never places a pillar inside a bay or right at its mouth', () => {
    for (const layoutId of LAYOUTS) {
      for (const seed of SEEDS) {
        const world = createWorld(layoutId, seed)
        for (const spot of world.spots) {
          const mouth = approachZone(world, spot, 1.5)
          for (const obstacle of world.obstacles) {
            expect(
              pointsOverlap(rectCorners(obstacle), rectCorners(mouth), 1e-7),
              `${layoutId} ${seed} ${spot.id}`
            ).toBe(false)
          }
        }
      }
    }
  })

  it('treats bays that already hold a car as obstacles', () => {
    for (const layoutId of LAYOUTS) {
      const world = createWorld(layoutId, 2024)
      const taken = world.spots.filter((s) => s.occupied)
      const free = world.spots.filter((s) => !s.occupied)
      expect(taken.length).toBeGreaterThan(0)
      for (const spot of taken) {
        expect(isPoseColliding(world, spot.goalPose), `${layoutId} ${spot.id}`).toBe(true)
      }
      for (const spot of free) {
        expect(isPoseColliding(world, spot.goalPose), `${layoutId} ${spot.id}`).toBe(false)
      }
    }
  })

  it('keeps the driving aisle open enough to be realistic', () => {
    for (const layoutId of LAYOUTS) {
      for (const seed of SEEDS) {
        const world = createWorld(layoutId, seed)
        expect(reachableFreeRatio(world), `${layoutId} ${seed}`).toBeGreaterThanOrEqual(0.8)
      }
    }
  })

  it('generates maps quickly enough for a UI button', () => {
    const started = Date.now()
    for (const layoutId of LAYOUTS) {
      for (const seed of SEEDS) createWorld(layoutId, seed)
    }
    expect(Date.now() - started).toBeLessThan(5000)
  })
})

describe('layout principles', () => {
  it.each(LAYOUTS)('keeps the %s layout name and spot goals', (layoutId) => {
    const world = createWorld(layoutId, 4242)
    expect(world.layoutName.length).toBeGreaterThan(0)
    expect(world.spots.length).toBeGreaterThanOrEqual(4)
    for (const spot of world.spots) {
      expect(spot.goalPose).toBeDefined()
    }
  })

  it('rotates spots only in the angled layout', () => {
    const angled = createWorld('angled', 4242)
    const perpendicular = createWorld('perpendicular', 4242)
    const parallel = createWorld('parallel', 4242)
    expect(angled.spots.some((s) => s.angle !== 0)).toBe(true)
    expect(perpendicular.spots.every((s) => s.angle === 0)).toBe(true)
    expect(parallel.spots.every((s) => s.angle === 0)).toBe(true)
  })

  it('packs perpendicular spots tightly like comb teeth', () => {
    const world = createWorld('perpendicular', 4242)
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
    const world = createWorld('parallel', 4242)
    expect(world.spots.length).toBeGreaterThanOrEqual(4)
    for (const spot of world.spots) {
      expect(spot.rect.w).toBeGreaterThan(spot.rect.h)
      expect(Math.abs(wrapPi(spot.goalPose.heading))).toBeLessThan(0.01)
    }
  })

  it('keeps parallel spots close to the long sides', () => {
    const world = createWorld('parallel', 4242)
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
    const world = createWorld('angled', 4242)
    for (const spot of world.spots) {
      const longAxis = spot.angle + Math.PI / 2
      expect(Math.abs(wrapPi(spot.goalPose.heading - longAxis))).toBeLessThan(0.01)
    }
  })

  it('contains at least four parking spots with nose-out goals', () => {
    const world = createWorld('perpendicular', 4242)
    expect(world.spots.length).toBeGreaterThanOrEqual(4)
    for (const spot of world.spots) {
      expect(spot.goalPose).toBeDefined()
    }
  })

  it('starts the car inside the lot without collision', () => {
    const world = createWorld('perpendicular', 4242)
    expect(isPoseColliding(world, world.startPose)).toBe(false)
  })

  it('enforces the non-overlap rule for the generated layout', () => {
    const world = createWorld('perpendicular', 4242)
    expect(validateWorldLayout(world)).toEqual([])
  })

  it('keeps every spot and obstacle inside the lot bounds', () => {
    const world = createWorld('perpendicular', 4242)
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
    const world = createWorld('perpendicular', 4242)
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
    const world = createWorld('perpendicular', 4242)
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
    const world = createWorld('perpendicular', 4242)
    world.spots[0].rect = { ...world.spots[1].rect }
    const errors = validateWorldLayout(world)
    expect(errors.some((e) => e.includes('重叠'))).toBe(true)
  })
})
