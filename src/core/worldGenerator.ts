import type { LayoutId, Rect, Spot, World } from './types'
import { pointsOverlap, rectCorners, rotatedRectCorners } from './geometry'
import {
  approachZone,
  baseWorld,
  makeSpot,
  reachableFreeRatio,
  validateWorldLayout
} from './lotGeometry'

// Peak-hour lots can be almost full, so only a couple of free bays are kept.
const MIN_FREE_SPOTS = 2
const MAX_OCCUPANCY_RATIO = 0.8
const MOUTH_CLEARANCE = 1.5

const LAYOUT_SIZE: Record<LayoutId, { w: number; h: number }> = {
  perpendicular: { w: 80, h: 40 },
  parallel: { w: 80, h: 20 },
  angled: { w: 80, h: 40 }
}
const MIN_AISLE_REACH = 0.8

export const LAYOUT_OPTIONS: { id: LayoutId; name: string }[] = [
  { id: 'perpendicular', name: '垂直入库' },
  { id: 'parallel', name: '侧方停车' },
  { id: 'angled', name: '斜列车位' }
]

/** Small deterministic PRNG so a map seed always reproduces the same lot. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Rng = () => number

function pickInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1))
}

function jitter(rng: Rng, min: number, max: number): number {
  return min + rng() * (max - min)
}

function renumber(prefix: string, spots: Spot[]): Spot[] {
  return spots.map((spot, i) => ({ ...spot, id: `${prefix}${i + 1}` }))
}

function generatePerpendicular(seed: number, rng: Rng): World {
  const size = LAYOUT_SIZE.perpendicular
  const base = baseWorld(
    'perpendicular',
    '垂直入库',
    { side: 'bottom', center: size.w / 2, width: 4 },
    seed,
    size.w,
    size.h
  )
  const spotW = 2.6
  const spotH = 5.2
  const gap = 0.3

  // Long top row of perpendicular bays, like the teeth of a comb.
  const topCount = pickInt(rng, 9, 11)
  const totalW = topCount * spotW + (topCount - 1) * gap
  const startX = (size.w - totalW) / 2
  const topSpots = Array.from({ length: topCount }, (_, i) =>
    makeSpot(`T${i + 1}`, startX + spotW / 2 + i * (spotW + gap), size.h - 2.6, spotW, spotH, 0, -Math.PI / 2)
  )

  const buildColumn = (prefix: string, cx: number, heading: number): Spot[] => {
    const count = pickInt(rng, 6, 8)
    const startY = 8 + rng() * Math.max(0, size.h - 8 - 15.7 - (count - 1) * 2.9)
    const spots = Array.from({ length: count }, (_, i) =>
      makeSpot(`${prefix}${i + 1}`, cx, startY + i * 2.9, 5.0, 2.6, 0, heading)
    )
    if (count >= 6 && rng() < 0.35) spots.splice(pickInt(rng, 2, count - 3), 1)
    return renumber(prefix, spots)
  }

  // Two uniform divider walls run parallel to the short lot edges. Both sides
  // are double-loaded with horizontal bays, the classic large garage "island".
  const wallX = [size.w * 0.335, size.w * 0.665]
  const wallY0 = size.h * 0.275
  const wallLength = size.h * 0.45
  const dividerWalls = wallX.map((x) => ({ x: x - 0.2, y: wallY0, w: 0.4, h: wallLength }))
  const isleSpots: Spot[] = []
  const bayCenterY = Array.from({ length: 6 }, (_, i) => wallY0 + wallLength / 2 + (i - 2.5) * 2.9)
  wallX.forEach((wx, wi) => {
    bayCenterY.forEach((y, yi) => {
      isleSpots.push(makeSpot(`C${wi + 1}L${yi + 1}`, wx - 2.8, y, 5.2, 2.6, 0, Math.PI))
      isleSpots.push(makeSpot(`C${wi + 1}R${yi + 1}`, wx + 2.8, y, 5.2, 2.6, 0, 0))
    })
  })

  return {
    ...base,
    dividerWalls,
    spots: [
      ...topSpots,
      ...buildColumn('L', 2.9, 0),
      ...buildColumn('R', size.w - 2.9, Math.PI),
      ...isleSpots
    ],
    obstacles: []
  }
}

function generateParallel(seed: number, rng: Rng): World {
  const size = LAYOUT_SIZE.parallel
  const base = baseWorld('parallel', '侧方停车', { side: 'left', center: size.h / 2, width: 4 }, seed, size.w, size.h)
  const spotW = 6.2
  const spotH = 2.6

  // Roadside parallel bays are drawn nose-to-tail: most gaps are zero, the rest
  // are only a few centimetres, like painted spaces on a residential street.
  const buildRow = (prefix: string, y: number): Spot[] => {
    const count = pickInt(rng, 8, 10)
    const gaps = Array.from({ length: count - 1 }, () => (rng() < 0.55 ? 0 : jitter(rng, 0, 0.15)))
    const total = count * spotW + gaps.reduce((a, b) => a + b, 0)
    let x = Math.max(0.8, (size.w - total) / 2)
    const spots: Spot[] = []
    for (let i = 0; i < count; i++) {
      spots.push(makeSpot(`${prefix}${i + 1}`, x + spotW / 2, y, spotW, spotH, 0, 0))
      x += spotW + (gaps[i] ?? 0)
    }
    return spots
  }

  return {
    ...base,
    spots: [...buildRow('T', 17.2), ...buildRow('B', 2.8)],
    obstacles: []
  }
}

function generateAngled(seed: number, rng: Rng): World {
  const size = LAYOUT_SIZE.angled
  const base = baseWorld('angled', '斜列车位', { side: 'left', center: size.h / 2, width: 4 }, seed, size.w, size.h)
  const bayWidth = 2.6
  const depth = 5.2
  const count = pickInt(rng, 18, 19)
  const entranceClearance = 8
  const spacing = bayWidth / Math.sin(Math.PI / 4) + 1e-6
  const halfXExtent =
    Math.abs((bayWidth / 2) * Math.cos(Math.PI / 4)) + Math.abs((depth / 2) * Math.sin(Math.PI / 4))
  const minCenterX = entranceClearance + halfXExtent
  const maxCenterX = size.w - halfXExtent
  const maxStartX = maxCenterX - (count - 1) * spacing
  const startX = minCenterX + rng() * Math.max(0, maxStartX - minCenterX)

  // Four rows of rectangular bays. For two equal rectangles in the same row,
  // their long edges touch when the center offset d satisfies
  // d * |sin(longAxisAngle)| = bayWidth, hence d = bayWidth / |sin θ|.
  // This is the real staggered herringbone spacing: long edges touch while the
  // short mouth edges stay offset from each other.
  const buildRow = (
    prefix: string,
    y: number,
    angle: number,
    heading: number
  ): Spot[] => {
    return Array.from({ length: count }, (_, i) =>
      makeSpot(`${prefix}${i + 1}`, startX + i * spacing, y, bayWidth, depth, angle, heading)
    )
  }

  // Two opposing slants above and below the central area form two fishbone
  // columns, each built from two rows of rectangular angled bays.
  return {
    ...base,
    spots: [
      ...buildRow('TO', 36.0, (-Math.PI * 3) / 4, -Math.PI / 4),
      ...buildRow('TI', 26.0, -Math.PI / 4, Math.PI / 4),
      ...buildRow('BI', 14.0, (-Math.PI * 3) / 4, -Math.PI / 4),
      ...buildRow('BO', 4.0, -Math.PI / 4, Math.PI / 4)
    ],
    obstacles: []
  }
}

function poseCorners(pose: { x: number; y: number; heading: number }, car: World['car']) {
  const c = Math.cos(pose.heading)
  const s = Math.sin(pose.heading)
  const hw = car.width / 2
  const hl = car.length / 2
  return [
    { x: hl, y: hw },
    { x: hl, y: -hw },
    { x: -hl, y: -hw },
    { x: -hl, y: hw }
  ].map((p) => ({ x: pose.x + p.x * c - p.y * s, y: pose.y + p.x * s + p.y * c }))
}

function clearanceZone(world: World): Rect {
  const e = world.entrance
  const pad = 1.6
  if (e.side === 'left') {
    return { x: -0.5, y: e.center - e.width / 2 - pad, w: 9, h: e.width + pad * 2 }
  }
  return { x: e.center - e.width / 2 - pad, y: -0.5, w: e.width + pad * 2, h: 9 }
}

function overlapsAny(rect: Rect, others: Rect[]): boolean {
  return others.some((o) => pointsOverlap(rectCorners(rect), rectCorners(o), 1e-7))
}

function tooClose(rect: Rect, others: Rect[], minGap: number): boolean {
  const grow = (r: Rect): Rect => ({
    x: r.x - minGap,
    y: r.y - minGap,
    w: r.w + minGap * 2,
    h: r.h + minGap * 2
  })
  return overlapsAny(grow(rect), others)
}

/**
 * Scatters free-standing obstacles across the driving area. Candidate blocks are
 * rejected when they would block a spot mouth, the entrance or the spawn pose.
 */
function scatterObstacles(world: World, rng: Rng, count: number): Rect[] {
  if (count <= 0) return []
  // Pillars and planters stay out of the bays and their immediate mouth, but may
  // sit anywhere else in the driving area.
  const blocked: Rect[] = [
    ...world.spots.map((s) => approachZone(world, s, MOUTH_CLEARANCE)),
    clearanceZone(world),
    ...world.dividerWalls
  ]
  const spotShapes = world.spots.map((s) => rotatedRectCorners(s.rect, s.angle))
  const startCar = poseCorners(world.startPose, world.car)
  const placed: Rect[] = []
  const b = world.bounds

  for (let i = 0; i < count; i++) {
    for (let attempt = 0; attempt < 80; attempt++) {
      const size = jitter(rng, 1.0, 1.7)
      const candidate: Rect = {
        x: jitter(rng, 5.5, b.w - 5.5 - size),
        y: jitter(rng, 3.5, b.h - 5.5 - size),
        w: size,
        h: size * jitter(rng, 0.75, 1.3)
      }
      if (candidate.y + candidate.h > b.h - 3) continue
      if (overlapsAny(candidate, blocked)) continue
      if (overlapsAny(candidate, placed) || tooClose(candidate, placed, 1.0)) continue
      if (pointsOverlap(rectCorners(candidate), startCar, 1e-7)) continue
      if (spotShapes.some((poly) => pointsOverlap(rectCorners(candidate), poly, 1e-7))) continue
      placed.push(candidate)
      break
    }
  }
  return placed
}

/** Some bays are simulated as already taken by other cars. */
function assignOccupancy(world: World, rng: Rng): void {
  const order = world.spots.map((_, i) => i)
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  const ratio = jitter(rng, 0.15, MAX_OCCUPANCY_RATIO)
  const wanted = Math.floor(world.spots.length * ratio)
  const capacity = Math.max(0, world.spots.length - MIN_FREE_SPOTS)
  const taken = Math.min(wanted, capacity)
  for (let i = 0; i < taken; i++) world.spots[order[i]].occupied = true
}

function buildLayout(layout: LayoutId, seed: number, rng: Rng, withObstacles: boolean): World {
  const world =
    layout === 'parallel'
      ? generateParallel(seed, rng)
      : layout === 'angled'
        ? generateAngled(seed, rng)
        : generatePerpendicular(seed, rng)
  assignOccupancy(world, rng)
  if (withObstacles) {
    world.obstacles = scatterObstacles(world, rng, pickInt(rng, 3, 6))
  }
  return world
}

function isUsable(world: World): boolean {
  // Only realism is enforced. Whether a free bay is easy to reach is left to
  // the planner, so hard maps are allowed.
  if (validateWorldLayout(world).length > 0) return false
  if (world.spots.filter((spot) => !spot.occupied).length < MIN_FREE_SPOTS) return false
  // Pillars may make bays awkward, but must not wall off most of the aisle.
  return reachableFreeRatio(world) >= MIN_AISLE_REACH
}

/**
 * Builds a randomized lot that keeps the principles of its parking style.
 * Accepted maps are free of overlaps and keep at least a few free bays, but they
 * are allowed to be harder than the planner can currently solve.
 */
export function createWorld(layout: LayoutId = 'perpendicular', seed?: number): World {
  const mapSeed = seed ?? Math.floor(Math.random() * 1_000_000_000)
  for (let attempt = 0; attempt < 20; attempt++) {
    const rng = mulberry32((mapSeed + attempt * 7919) >>> 0)
    const world = buildLayout(layout, mapSeed, rng, true)
    if (isUsable(world)) return world
  }
  // Fall back to obstacle-free variants so a map is always returned.
  for (let attempt = 20; attempt < 28; attempt++) {
    const rng = mulberry32((mapSeed + attempt * 7919) >>> 0)
    const world = buildLayout(layout, mapSeed, rng, false)
    if (isUsable(world)) return world
  }
  throw new Error(`Unable to generate a valid ${layout} layout for seed ${mapSeed}`)
}
