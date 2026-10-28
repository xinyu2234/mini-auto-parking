import { describe, expect, it } from 'vitest'
import { isPoseColliding } from './collision'
import { pointsOverlap, rectCorners, rectsOverlap, rotatedRectCorners, wrapPi } from './geometry'
import { approachZone, createWorld, reachableFreeRatio, spotsAdjacent, validateWorldLayout } from './world'

const LAYOUTS = ['perpendicular', 'parallel', 'angled'] as const
const SEEDS = [1, 42, 777, 2024, 90210]

function hasBoxedInFreeBay(world: ReturnType<typeof createWorld>): boolean {
  for (let mid = 0; mid < world.spots.length; mid++) {
    const middle = world.spots[mid]
    if (middle.occupied) continue
    const neighbors = world.spots.filter(
      (spot, index) => index !== mid && spot.occupied && spotsAdjacent(middle, spot)
    )
    for (let i = 0; i < neighbors.length; i++) {
      for (let j = i + 1; j < neighbors.length; j++) {
        const v1 = {
          x: neighbors[i].goalPose.x - middle.goalPose.x,
          y: neighbors[i].goalPose.y - middle.goalPose.y
        }
        const v2 = {
          x: neighbors[j].goalPose.x - middle.goalPose.x,
          y: neighbors[j].goalPose.y - middle.goalPose.y
        }
        const len1 = Math.hypot(v1.x, v1.y)
        const len2 = Math.hypot(v2.x, v2.y)
        if (len1 > 1e-6 && len2 > 1e-6 && (v1.x * v2.x + v1.y * v2.y) / (len1 * len2) < -0.8) {
          return true
        }
      }
    }
  }
  return false
}

describe('randomized world generation', () => {
  it.each(LAYOUTS)('keeps the %s layout valid across many seeds', (layoutId) => {
    for (const seed of SEEDS) {
      const world = createWorld(layoutId, seed)
      expect(validateWorldLayout(world)).toEqual([])
      expect(world.spots.length).toBeGreaterThanOrEqual(4)
      expect(isPoseColliding(world, world.startPose)).toBe(false)
      expect(world.spots.filter((s) => !s.occupied).length).toBeGreaterThanOrEqual(2)
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
        expect(free.length).toBeGreaterThanOrEqual(2)
        expect(free.length).toBeLessThanOrEqual(world.spots.length)
      }
    }
  })

  it('can simulate peak-hour lots up to 80% occupancy', () => {
    let peak = 0
    for (const layoutId of LAYOUTS) {
      for (let seed = 1; seed <= 40; seed++) {
        const world = createWorld(layoutId, seed * 977)
        const ratio = world.spots.filter((s) => s.occupied).length / world.spots.length
        expect(ratio).toBeLessThanOrEqual(0.8 + 1e-9)
        peak = Math.max(peak, ratio)
      }
    }
    expect(peak).toBeGreaterThanOrEqual(0.7)
  })

  it.each(LAYOUTS)('always leaves a boxed-in free bay in %s', (layoutId) => {
    for (const seed of SEEDS) {
      const world = createWorld(layoutId, seed)
      expect(hasBoxedInFreeBay(world), `${layoutId} ${seed}`).toBe(true)
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
    expect(angled.spots.every((s) => !s.polygon)).toBe(true)
    expect(perpendicular.spots.every((s) => !s.polygon)).toBe(true)
    expect(parallel.spots.every((s) => !s.polygon)).toBe(true)
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
      const diff = wrapPi(spot.goalPose.heading - longAxis)
      expect(Math.abs(Math.sin(diff))).toBeLessThan(0.01)
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

describe('expanded map geometry', () => {
  it.each(['perpendicular', 'angled'] as const)('expands %s to about four times the original area', (layoutId) => {
    const world = createWorld(layoutId, 777)
    expect(world.bounds.w).toBe(80)
    expect(world.bounds.h).toBe(40)
    expect(world.bounds.w * world.bounds.h).toBeGreaterThanOrEqual(40 * 20 * 3)
  })

  it('expands the parallel map to about twice the original area', () => {
    const world = createWorld('parallel', 777)
    expect(world.bounds.w).toBe(80)
    expect(world.bounds.h).toBe(20)
    expect(world.bounds.w * world.bounds.h).toBe(40 * 20 * 2)
  })

  it('places uniformly sized double-loaded divider islands in the perpendicular map', () => {
    const world = createWorld('perpendicular', 777)
    expect(world.bounds.w).toBe(80)
    expect(world.dividerWalls.length).toBeGreaterThanOrEqual(2)
    const lengths = world.dividerWalls.map((w) => w.h)
    for (const length of lengths) expect(length).toBeCloseTo(lengths[0], 5)
    for (const wall of world.dividerWalls) expect(wall.h).toBeGreaterThan(wall.w)

    const leftBays = world.spots.filter((s) => /^C\d+L/.test(s.id))
    const rightBays = world.spots.filter((s) => /^C\d+R/.test(s.id))
    expect(leftBays.length).toBeGreaterThanOrEqual(10)
    expect(rightBays.length).toBeGreaterThanOrEqual(10)
    for (const spot of leftBays) expect(Math.abs(wrapPi(spot.goalPose.heading - Math.PI))).toBeLessThan(0.01)
    for (const spot of rightBays) expect(Math.abs(wrapPi(spot.goalPose.heading))).toBeLessThan(0.01)
  })

  it('draws parallel bays nose-to-tail with zero or tiny gaps', () => {
    let zeroGapCount = 0
    for (const seed of [1, 777, 2024]) {
      const world = createWorld('parallel', seed)
      for (const prefix of ['T', 'B']) {
        const row = world.spots
          .filter((s) => s.id.startsWith(prefix))
          .sort((a, b) => a.rect.x - b.rect.x)
        expect(row.length).toBeGreaterThanOrEqual(8)
        for (let i = 1; i < row.length; i++) {
          const gap = row[i].rect.x - (row[i - 1].rect.x + row[i - 1].rect.w)
          expect(gap).toBeGreaterThanOrEqual(-1e-9)
          expect(gap).toBeLessThanOrEqual(0.15 + 1e-9)
          if (gap < 1e-9) zeroGapCount++
        }
      }
    }
    expect(zeroGapCount).toBeGreaterThan(0)
  })

  it('builds tight herringbone rows in the expanded angled map', () => {
    const world = createWorld('angled', 777)
    expect(world.bounds.w).toBe(80)
    expect(world.bounds.h).toBe(40)
    for (const prefix of ['TO', 'TI', 'BI', 'BO']) {
      const row = world.spots
        .filter((s) => s.id.startsWith(prefix))
        .sort((a, b) => a.goalPose.x - b.goalPose.x)
      expect(row.length).toBeGreaterThanOrEqual(11)
      for (let i = 1; i < row.length; i++) {
        const a = row[i - 1]
        const b = row[i]
        const dx = b.goalPose.x - a.goalPose.x
        const longAxis = a.angle + Math.PI / 2
        // Perpendicular distance between the parallel long edges is exactly the
        // bay width, so the long edges touch. The mouth edges stay staggered.
        expect(Math.abs(dx * Math.sin(longAxis))).toBeCloseTo(a.rect.w, 4)
        expect(Math.abs(dx)).toBeLessThan(a.rect.h)
      }
    }
    for (const spot of world.spots) {
      const longAxis = spot.angle + Math.PI / 2
      expect(Math.abs(Math.sin(wrapPi(spot.goalPose.heading - longAxis)))).toBeLessThan(0.01)
    }
    const minX = Math.min(
      ...world.spots.flatMap((spot) => rotatedRectCorners(spot.rect, spot.angle).map((p) => p.x))
    )
    // Keep a turning apron beside the left-side entrance.
    expect(minX).toBeGreaterThanOrEqual(8 - 1e-6)
  })
})
