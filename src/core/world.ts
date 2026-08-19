import type { Pose, Rect, Spot, World } from './types'
import { rectsOverlap } from './geometry'

export const LOT_WIDTH = 40
export const LOT_HEIGHT = 20

const SPOT_W = 2.6
const SPOT_H = 5.2
const SIDE_SPOT_W = 5.0
const SIDE_SPOT_H = 2.6

function spotRect(cx: number, cy: number, w: number, h: number): Rect {
  return { x: cx - w / 2, y: cy - h / 2, w, h }
}

export function createWorld(): World {
  const car = {
    length: 4.0,
    width: 1.8,
    wheelbase: 2.5,
    maxSteering: Math.atan(2.5 / 4.5),
    minTurningRadius: 4.5
  }

  const topCenters = [4.0, 13.0, 23.0, 33.0]
  const topY = 17.2
  const sideCentersY = [3.2, 8.0, 13.2]

  const spots: Spot[] = [
    ...topCenters.map((cx, i) => ({
      id: `T${i + 1}`,
      rect: spotRect(cx, topY, SPOT_W, SPOT_H),
      goalPose: { x: cx, y: topY, heading: -Math.PI / 2 },
      occupied: false
    })),
    ...sideCentersY.map((cy, i) => ({
      id: `L${i + 1}`,
      rect: spotRect(2.9, cy, SIDE_SPOT_W, SIDE_SPOT_H),
      goalPose: { x: 2.9, y: cy, heading: 0 },
      occupied: false
    })),
    ...sideCentersY.map((cy, i) => ({
      id: `R${i + 1}`,
      rect: spotRect(37.1, cy, SIDE_SPOT_W, SIDE_SPOT_H),
      goalPose: { x: 37.1, y: cy, heading: Math.PI },
      occupied: false
    }))
  ]

  const world: World = {
    bounds: { x: 0, y: 0, w: LOT_WIDTH, h: LOT_HEIGHT },
    wallThickness: 0.3,
    entrance: { x: 18, width: 4 },
    spots,
    obstacles: [
      { x: 7.5, y: 8.0, w: 1.2, h: 1.2 },
      { x: 15.5, y: 5.5, w: 1.2, h: 1.2 },
      { x: 25.5, y: 8.5, w: 1.2, h: 1.2 },
      { x: 32.5, y: 5.0, w: 1.2, h: 1.2 },
      { x: 10.5, y: 12.5, w: 1.2, h: 1.2 },
      { x: 20.5, y: 10.5, w: 1.2, h: 1.2 }
    ],
    car,
    startPose: { x: 20, y: 2.5, heading: Math.PI / 2 }
  }

  const errors = validateWorldLayout(world)
  if (errors.length > 0) {
    throw new Error(`Invalid world layout: ${errors.join('; ')}`)
  }
  return world
}

export function validateWorldLayout(world: World): string[] {
  const errors: string[] = []
  const b = world.bounds

  const withinBounds = (rect: Rect, label: string): void => {
    if (rect.x < 0 || rect.y < 0 || rect.x + rect.w > b.w || rect.y + rect.h > b.h) {
      errors.push(`${label} 超出停车场边界`)
    }
  }

  for (const spot of world.spots) {
    withinBounds(spot.rect, `车位 ${spot.id}`)
  }
  for (let i = 0; i < world.obstacles.length; i++) {
    withinBounds(world.obstacles[i], `障碍物 ${i + 1}`)
  }

  for (let i = 0; i < world.spots.length; i++) {
    for (let j = i + 1; j < world.spots.length; j++) {
      if (rectsOverlap(world.spots[i].rect, world.spots[j].rect, 1e-9)) {
        errors.push(`车位 ${world.spots[i].id} 与 ${world.spots[j].id} 重叠`)
      }
    }
  }

  for (let i = 0; i < world.obstacles.length; i++) {
    for (let j = i + 1; j < world.obstacles.length; j++) {
      if (rectsOverlap(world.obstacles[i], world.obstacles[j], 1e-9)) {
        errors.push(`障碍物 ${i + 1} 与 ${j + 1} 重叠`)
      }
    }
  }

  for (const spot of world.spots) {
    for (let j = 0; j < world.obstacles.length; j++) {
      if (rectsOverlap(spot.rect, world.obstacles[j], 1e-9)) {
        errors.push(`车位 ${spot.id} 与障碍物 ${j + 1} 重叠`)
      }
    }
  }

  const entranceRect: Rect = {
    x: world.entrance.x,
    y: -world.wallThickness,
    w: world.entrance.width,
    h: world.wallThickness
  }
  for (const spot of world.spots) {
    if (rectsOverlap(spot.rect, entranceRect, 1e-9)) errors.push(`车位 ${spot.id} 挡住了出入口`)
  }
  for (let j = 0; j < world.obstacles.length; j++) {
    if (rectsOverlap(world.obstacles[j], entranceRect, 1e-9)) errors.push(`障碍物 ${j + 1} 挡住了出入口`)
  }

  return errors
}

export function wallRects(world: World): Rect[] {
  const t = world.wallThickness
  const b = world.bounds
  const entranceRight = world.entrance.x + world.entrance.width
  return [
    { x: b.x - t, y: b.y + b.h, w: b.w + t * 2, h: t },
    { x: b.x - t, y: b.y - t, w: t, h: b.h + t * 2 },
    { x: b.x + b.w, y: b.y - t, w: t, h: b.h + t * 2 },
    { x: b.x - t, y: b.y - t, w: world.entrance.x + t, h: t },
    { x: entranceRight, y: b.y - t, w: b.w - entranceRight + t, h: t }
  ]
}

export function getSpotById(world: World, id: string): Spot | undefined {
  return world.spots.find((s) => s.id === id)
}

export function goalForSpot(spot: Spot): Pose {
  return spot.goalPose
}
