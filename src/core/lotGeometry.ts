// Geometry primitives shared by the layout generator: bounds, walls and validation.
import type { Entrance, LayoutId, Pose, Rect, Spot, World } from './types'
import { pointInRotatedRect, pointsOverlap, rectCorners, rotatedRectCorners } from './geometry'

export const LOT_WIDTH = 40
export const LOT_HEIGHT = 20

export function spotRect(cx: number, cy: number, w: number, h: number): Rect {
  return { x: cx - w / 2, y: cy - h / 2, w, h }
}

export function makeSpot(
  id: string,
  cx: number,
  cy: number,
  w: number,
  h: number,
  angle: number,
  goalHeading: number
): Spot {
  return {
    id,
    rect: spotRect(cx, cy, w, h),
    angle,
    goalPose: { x: cx, y: cy, heading: goalHeading },
    occupied: false
  }
}

export function baseWorld(
  layoutId: LayoutId,
  layoutName: string,
  entrance: Entrance,
  mapSeed: number
): Omit<World, 'spots' | 'obstacles'> {
  const car = {
    length: 4.0,
    width: 1.8,
    wheelbase: 2.5,
    maxSteering: Math.atan(2.5 / 4.5),
    minTurningRadius: 4.5
  }
  return {
    layoutId,
    layoutName,
    mapSeed,
    bounds: { x: 0, y: 0, w: LOT_WIDTH, h: LOT_HEIGHT },
    wallThickness: 0.3,
    entrance,
    car,
    startPose:
      entrance.side === 'left'
        ? { x: 2.0, y: entrance.center, heading: 0 }
        : { x: entrance.center, y: 2.5, heading: Math.PI / 2 }
  }
}

export function wallRects(world: World): Rect[] {
  const t = world.wallThickness
  const b = world.bounds
  const e = world.entrance
  const half = e.width / 2
  if (e.side === 'left') {
    return [
      { x: b.x - t, y: b.y + b.h, w: b.w + t * 2, h: t },
      { x: b.x - t, y: b.y - t, w: b.w + t * 2, h: t },
      { x: b.x + b.w, y: b.y - t, w: t, h: b.h + t * 2 },
      { x: b.x - t, y: e.center + half, w: t, h: b.h + t - (e.center + half) },
      { x: b.x - t, y: b.y - t, w: t, h: e.center - half + t }
    ]
  }
  return [
    { x: b.x - t, y: b.y + b.h, w: b.w + t * 2, h: t },
    { x: b.x - t, y: b.y - t, w: t, h: b.h + t * 2 },
    { x: b.x + b.w, y: b.y - t, w: t, h: b.h + t * 2 },
    { x: b.x - t, y: b.y - t, w: e.center - half + t, h: t },
    { x: e.center + half, y: b.y - t, w: b.w - (e.center + half) + t, h: t }
  ]
}

export function getSpotById(world: World, id: string): Spot | undefined {
  return world.spots.find((s) => s.id === id)
}

export function goalForSpot(spot: Spot): Pose {
  return spot.goalPose
}

export function validateWorldLayout(world: World): string[] {
  const errors: string[] = []
  const b = world.bounds
  const eps = 1e-6

  const spotCorners = (spot: Spot) => rotatedRectCorners(spot.rect, spot.angle)
  const withinBounds = (corners: { x: number; y: number }[], label: string): void => {
    for (const p of corners) {
      if (p.x < -eps || p.y < -eps || p.x > b.w + eps || p.y > b.h + eps) {
        errors.push(`${label} 超出停车场边界`)
        return
      }
    }
  }

  for (const spot of world.spots) {
    withinBounds(spotCorners(spot), `车位 ${spot.id}`)
  }
  for (let i = 0; i < world.obstacles.length; i++) {
    withinBounds(rectCorners(world.obstacles[i]), `障碍物 ${i + 1}`)
  }

  for (let i = 0; i < world.spots.length; i++) {
    for (let j = i + 1; j < world.spots.length; j++) {
      if (pointsOverlap(spotCorners(world.spots[i]), spotCorners(world.spots[j]), 1e-7)) {
        errors.push(`车位 ${world.spots[i].id} 与 ${world.spots[j].id} 重叠`)
      }
    }
  }

  for (let i = 0; i < world.obstacles.length; i++) {
    for (let j = i + 1; j < world.obstacles.length; j++) {
      if (pointsOverlap(rectCorners(world.obstacles[i]), rectCorners(world.obstacles[j]), 1e-7)) {
        errors.push(`障碍物 ${i + 1} 与 ${j + 1} 重叠`)
      }
    }
  }

  for (const spot of world.spots) {
    for (let j = 0; j < world.obstacles.length; j++) {
      if (pointsOverlap(spotCorners(spot), rectCorners(world.obstacles[j]), 1e-7)) {
        errors.push(`车位 ${spot.id} 与障碍物 ${j + 1} 重叠`)
      }
    }
  }

  const entranceRect: Rect =
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
    if (pointsOverlap(spotCorners(spot), rectCorners(entranceRect), 1e-7)) {
      errors.push(`车位 ${spot.id} 挡住了出入口`)
    }
  }
  for (let j = 0; j < world.obstacles.length; j++) {
    if (pointsOverlap(rectCorners(world.obstacles[j]), rectCorners(entranceRect), 1e-7)) {
      errors.push(`障碍物 ${j + 1} 挡住了出入口`)
    }
  }

  return errors
}

export const APPROACH_DEPTH = 5

function poseCorners(pose: Pose, car: World['car']): { x: number; y: number }[] {
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

/**
 * Area a car sweeps while driving straight out of (or into) a parking spot.
 * Obstacles are never placed here so that every spot keeps a usable entrance.
 */
export function approachZone(world: World, spot: Spot, depth = APPROACH_DEPTH): Rect {
  const h = spot.goalPose.heading
  const corners: { x: number; y: number }[] = []
  for (const d of [0, depth]) {
    corners.push(
      ...poseCorners(
        {
          x: spot.goalPose.x + Math.cos(h) * d,
          y: spot.goalPose.y + Math.sin(h) * d,
          heading: h
        },
        world.car
      )
    )
  }
  const xs = corners.map((p) => p.x)
  const ys = corners.map((p) => p.y)
  const margin = 0.35
  const b = world.bounds
  const minX = Math.max(b.x, Math.min(...xs) - margin)
  const minY = Math.max(b.y, Math.min(...ys) - margin)
  const maxX = Math.min(b.x + b.w, Math.max(...xs) + margin)
  const maxY = Math.min(b.y + b.h, Math.max(...ys) + margin)
  return {
    x: minX,
    y: minY,
    w: maxX - minX,
    h: maxY - minY
  }
}

function solidRects(world: World): Rect[] {
  return [...wallRects(world), ...world.obstacles]
}

/** The car body must fit inside the spot and the spot mouth must stay clear. */
export function hasApproachClearance(world: World, spot: Spot): boolean {
  const carPoly = poseCorners(spot.goalPose, world.car)
  const solids = solidRects(world)
  for (const rect of solids) {
    if (pointsOverlap(carPoly, rectCorners(rect), 1e-7)) return false
  }
  const zone = approachZone(world, spot)
  for (const rect of solids) {
    if (pointsOverlap(rectCorners(zone), rectCorners(rect), 1e-7)) return false
  }
  return true
}

function distanceToRect(px: number, py: number, r: Rect): number {
  const dx = Math.max(r.x - px, 0, px - (r.x + r.w))
  const dy = Math.max(r.y - py, 0, py - (r.y + r.h))
  return Math.hypot(dx, dy)
}

const REACH_CELL = 0.5
const CAR_CLEARANCE = 1.2

/**
 * Coarse free-space flood fill from the car's start pose. A spot counts as
 * reachable when the free space connects the start to the mouth of its spot.
 */
export function findUnreachableSpotIds(world: World): string[] {
  const fill = floodFill(world)
  if (!fill) return world.spots.map((s) => s.id)
  const { visited, nx, toCell } = fill
  const unreachable: string[] = []
  for (const spot of world.spots) {
    if (spot.occupied) continue
    const h = spot.goalPose.heading
    const mouth = {
      x: spot.goalPose.x + Math.cos(h) * APPROACH_DEPTH * 0.8,
      y: spot.goalPose.y + Math.sin(h) * APPROACH_DEPTH * 0.8
    }
    if (!visited[toCell(mouth.x, mouth.y)]) unreachable.push(spot.id)
  }
  return unreachable
}

/**
 * Share of the drivable area that can be reached from the entrance. A realistic
 * lot keeps its aisle open even when individual bays are hard to use.
 */
export function reachableFreeRatio(world: World): number {
  const fill = floodFill(world)
  if (!fill) return 0
  const { visited, passable } = fill
  let reachable = 0
  let total = 0
  for (let i = 0; i < passable.length; i++) {
    if (!passable[i]) continue
    total++
    if (visited[i]) reachable++
  }
  return total === 0 ? 0 : reachable / total
}

function floodFill(world: World): {
  visited: Uint8Array
  passable: Uint8Array
  nx: number
  toCell: (x: number, y: number) => number
} | null {
  const b = world.bounds
  const nx = Math.ceil(b.w / REACH_CELL)
  const ny = Math.ceil(b.h / REACH_CELL)
  const solids = solidRects(world)
  const passable = new Uint8Array(nx * ny)

  for (let iy = 0; iy < ny; iy++) {
    for (let ix = 0; ix < nx; ix++) {
      const cx = b.x + (ix + 0.5) * REACH_CELL
      const cy = b.y + (iy + 0.5) * REACH_CELL
      let ok = 1
      if (world.spots.some((s) => s.occupied && pointInRotatedRect({ x: cx, y: cy }, s.rect, s.angle))) {
        passable[iy * nx + ix] = 0
        continue
      }
      for (const rect of solids) {
        if (distanceToRect(cx, cy, rect) < CAR_CLEARANCE) {
          ok = 0
          break
        }
      }
      passable[iy * nx + ix] = ok
    }
  }

  const toCell = (x: number, y: number): number => {
    const ix = Math.min(nx - 1, Math.max(0, Math.floor((x - b.x) / REACH_CELL)))
    const iy = Math.min(ny - 1, Math.max(0, Math.floor((y - b.y) / REACH_CELL)))
    return iy * nx + ix
  }

  const visited = new Uint8Array(nx * ny)
  const start = toCell(world.startPose.x, world.startPose.y)
  if (!passable[start]) return null

  const queue = new Int32Array(nx * ny)
  let head = 0
  let tail = 0
  queue[tail++] = start
  visited[start] = 1
  while (head < tail) {
    const cur = queue[head++]
    const cx = cur % nx
    const cy = Math.floor(cur / nx)
    if (cx > 0 && !visited[cur - 1] && passable[cur - 1]) {
      visited[cur - 1] = 1
      queue[tail++] = cur - 1
    }
    if (cx < nx - 1 && !visited[cur + 1] && passable[cur + 1]) {
      visited[cur + 1] = 1
      queue[tail++] = cur + 1
    }
    if (cy > 0 && !visited[cur - nx] && passable[cur - nx]) {
      visited[cur - nx] = 1
      queue[tail++] = cur - nx
    }
    if (cy < ny - 1 && !visited[cur + nx] && passable[cur + nx]) {
      visited[cur + nx] = 1
      queue[tail++] = cur + nx
    }
  }

  return { visited, passable, nx, toCell }
}
