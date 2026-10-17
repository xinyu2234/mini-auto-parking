import type { LayoutId, Rect, Spot, World } from './types'
import { pointsOverlap, rectCorners, rotatedRectCorners } from './geometry'
import {
  APPROACH_DEPTH,
  LOT_HEIGHT,
  LOT_WIDTH,
  approachZone,
  baseWorld,
  findUnreachableSpotIds,
  hasApproachClearance,
  makeSpot,
  validateWorldLayout
} from './lotGeometry'

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
  const base = baseWorld('perpendicular', '垂直入库', { side: 'bottom', center: 20, width: 4 }, seed)
  const spotW = 2.6
  const spotH = 5.2
  const gap = 0.3

  const topCount = pickInt(rng, 6, 8)
  const totalW = topCount * spotW + (topCount - 1) * gap
  const startX = (LOT_WIDTH - totalW) / 2
  const topSpots = Array.from({ length: topCount }, (_, i) =>
    makeSpot(`T${i + 1}`, startX + spotW / 2 + i * (spotW + gap), 17.4, spotW, spotH, 0, -Math.PI / 2)
  )

  const buildColumn = (prefix: string, cx: number, heading: number): Spot[] => {
    const count = pickInt(rng, 3, 4)
    const span = (count - 1) * 2.9
    const startY = 3.2 + rng() * Math.max(0, 12.9 - 3.2 - span)
    const spots = Array.from({ length: count }, (_, i) =>
      makeSpot(`${prefix}${i + 1}`, cx, startY + i * 2.9, 5.0, spotH - 2.6, 0, heading)
    )
    // A missing space here and there mirrors real lots with reserved bays.
    if (count > 3 && rng() < 0.35) spots.splice(pickInt(rng, 1, count - 2), 1)
    return renumber(prefix, spots)
  }

  return {
    ...base,
    spots: [...topSpots, ...buildColumn('L', 2.9, 0), ...buildColumn('R', 37.1, Math.PI)],
    obstacles: []
  }
}

function generateParallel(seed: number, rng: Rng): World {
  const base = baseWorld('parallel', '侧方停车', { side: 'left', center: 10, width: 4 }, seed)
  const spotW = 6.2
  const spotH = 2.6

  const buildRow = (prefix: string, y: number): Spot[] => {
    const count = pickInt(rng, 4, 5)
    const gaps = Array.from({ length: count - 1 }, () => jitter(rng, 1.0, 2.4))
    const total = count * spotW + gaps.reduce((a, b) => a + b, 0)
    let x = Math.max(0.6, (LOT_WIDTH - total) / 2)
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
  const base = baseWorld('angled', '斜列车位', { side: 'left', center: 10, width: 4 }, seed)
  const spotW = 2.6
  const spotH = 5.2
  const spacing = jitter(rng, 5.85, 6.35)
  const count = pickInt(rng, 5, 6)
  const totalW = (count - 1) * spacing
  const startX = (LOT_WIDTH - totalW) / 2

  const buildRow = (prefix: string, y: number, angle: number, heading: number): Spot[] =>
    Array.from({ length: count }, (_, i) =>
      makeSpot(`${prefix}${i + 1}`, startX + i * spacing, y, spotW, spotH, angle, heading)
    )

  return {
    ...base,
    spots: [
      ...buildRow('T', 15.0, (-Math.PI * 3) / 4, -Math.PI / 4),
      ...buildRow('B', 5.0, -Math.PI / 4, Math.PI / 4)
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
  const blocked: Rect[] = [
    ...world.spots.map((s) => approachZone(world, s, APPROACH_DEPTH)),
    clearanceZone(world)
  ]
  const spotShapes = world.spots.map((s) => rotatedRectCorners(s.rect, s.angle))
  const startCar = poseCorners(world.startPose, world.car)
  const placed: Rect[] = []

  for (let i = 0; i < count; i++) {
    for (let attempt = 0; attempt < 80; attempt++) {
      const size = jitter(rng, 1.0, 1.7)
      const candidate: Rect = {
        x: jitter(rng, 5.5, LOT_WIDTH - 5.5 - size),
        y: jitter(rng, 3.5, LOT_HEIGHT - 5.5 - size),
        w: size,
        h: size * jitter(rng, 0.75, 1.3)
      }
      if (candidate.y + candidate.h > LOT_HEIGHT - 3) continue
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

function buildLayout(layout: LayoutId, seed: number, rng: Rng, withObstacles: boolean): World {
  const world =
    layout === 'parallel'
      ? generateParallel(seed, rng)
      : layout === 'angled'
        ? generateAngled(seed, rng)
        : generatePerpendicular(seed, rng)
  if (withObstacles) {
    world.obstacles = scatterObstacles(world, rng, pickInt(rng, 3, 6))
  }
  return world
}

function isUsable(world: World): boolean {
  if (validateWorldLayout(world).length > 0) return false
  if (world.spots.length < 4) return false
  if (world.spots.some((spot) => !hasApproachClearance(world, spot))) return false
  if (findUnreachableSpotIds(world).length > 0) return false
  return true
}

/**
 * Builds a randomized lot that keeps the principles of its parking style.
 * Every accepted map is verified to be free of overlaps and to leave each spot
 * with a clear mouth plus a free-space route from the entrance.
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
