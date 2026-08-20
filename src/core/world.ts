import type { Entrance, LayoutId, Pose, Rect, Spot, World } from './types'
import { pointsOverlap, rectCorners, rotatedRectCorners } from './geometry'

export const LOT_WIDTH = 40
export const LOT_HEIGHT = 20

export const LAYOUT_OPTIONS: { id: LayoutId; name: string }[] = [
  { id: 'perpendicular', name: '垂直入库' },
  { id: 'parallel', name: '侧方停车' },
  { id: 'angled', name: '斜列车位' }
]

function spotRect(cx: number, cy: number, w: number, h: number): Rect {
  return { x: cx - w / 2, y: cy - h / 2, w, h }
}

function makeSpot(
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

function baseWorld(
  layoutId: LayoutId,
  layoutName: string,
  entrance: Entrance
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

function perpendicularWorld(): World {
  const base = baseWorld('perpendicular', '垂直入库', { side: 'bottom', center: 20, width: 4 })
  const topStart = (LOT_WIDTH - (8 * 2.6 + 7 * 0.3)) / 2
  const topCenters = Array.from({ length: 8 }, (_, i) => topStart + 1.3 + i * 2.9)
  const sideStart = 0.4
  const sideCentersY = Array.from({ length: 5 }, (_, i) => sideStart + 1.3 + i * 2.9)
  const spots: Spot[] = [
    ...topCenters.map((cx, i) => makeSpot(`T${i + 1}`, cx, 17.4, 2.6, 5.2, 0, -Math.PI / 2)),
    ...sideCentersY.map((cy, i) => makeSpot(`L${i + 1}`, 2.9, cy, 5.0, 2.6, 0, 0)),
    ...sideCentersY.map((cy, i) => makeSpot(`R${i + 1}`, 37.1, cy, 5.0, 2.6, 0, Math.PI))
  ]
  return {
    ...base,
    spots,
    obstacles: [
      { x: 8.5, y: 7.5, w: 1.2, h: 1.2 },
      { x: 16.5, y: 9.5, w: 1.2, h: 1.2 },
      { x: 24.5, y: 7.5, w: 1.2, h: 1.2 },
      { x: 31.5, y: 9.5, w: 1.2, h: 1.2 },
      { x: 12.5, y: 11.5, w: 1.2, h: 1.2 },
      { x: 27.5, y: 11.5, w: 1.2, h: 1.2 }
    ]
  }
}

function parallelWorld(): World {
  const base = baseWorld('parallel', '侧方停车', { side: 'left', center: 10, width: 4 })
  const centersX = [4, 11.5, 19, 26.5, 34]
  const spots: Spot[] = [
    ...centersX.map((cx, i) => makeSpot(`T${i + 1}`, cx, 17.2, 6.2, 2.6, 0, 0)),
    ...centersX.map((cx, i) => makeSpot(`B${i + 1}`, cx, 2.8, 6.2, 2.6, 0, 0))
  ]
  return {
    ...base,
    spots,
    obstacles: [
      { x: 10, y: 10, w: 1.2, h: 1.2 },
      { x: 30, y: 10, w: 1.2, h: 1.2 }
    ]
  }
}

function angledWorld(): World {
  const base = baseWorld('angled', '斜列车位', { side: 'left', center: 10, width: 4 })
  const centersX = [5, 10.8, 16.6, 22.4, 28.2, 34]
  const topAngle = -Math.PI * 3 / 4
  const bottomAngle = -Math.PI / 4
  const topHeading = -Math.PI / 4
  const bottomHeading = Math.PI / 4
  const spots: Spot[] = [
    ...centersX.map((cx, i) => makeSpot(`T${i + 1}`, cx, 15.0, 2.6, 5.2, topAngle, topHeading)),
    ...centersX.map((cx, i) => makeSpot(`B${i + 1}`, cx, 5.0, 2.6, 5.2, bottomAngle, bottomHeading))
  ]
  return {
    ...base,
    spots,
    obstacles: [
      { x: 10, y: 10, w: 1.2, h: 1.2 },
      { x: 30, y: 10, w: 1.2, h: 1.2 }
    ]
  }
}

export function createWorld(layout: LayoutId = 'perpendicular'): World {
  const world =
    layout === 'parallel' ? parallelWorld() : layout === 'angled' ? angledWorld() : perpendicularWorld()
  const errors = validateWorldLayout(world)
  if (errors.length > 0) {
    throw new Error(`Invalid ${layout} layout: ${errors.join('; ')}`)
  }
  return world
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
