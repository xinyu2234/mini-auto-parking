import type { Pose, Rect, Spot, World } from './types'

export const LOT_WIDTH = 18
export const LOT_HEIGHT = 11

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

  const topCenters = [4.65, 7.55, 10.45, 13.35]
  const sideCentersY = [6.9, 9.5]

  const spots: Spot[] = [
    ...topCenters.map((cx, i) => ({
      id: `T${i + 1}`,
      rect: spotRect(cx, 8.0, 2.6, 5.2),
      goalPose: { x: cx, y: 8.0, heading: -Math.PI / 2 },
      occupied: false
    })),
    ...sideCentersY.map((cy, i) => ({
      id: `L${i + 1}`,
      rect: spotRect(2.9, cy, 5.0, 2.6),
      goalPose: { x: 2.9, y: cy, heading: 0 },
      occupied: false
    })),
    ...sideCentersY.map((cy, i) => ({
      id: `R${i + 1}`,
      rect: spotRect(15.1, cy, 5.0, 2.6),
      goalPose: { x: 15.1, y: cy, heading: Math.PI },
      occupied: false
    }))
  ]

  return {
    bounds: { x: 0, y: 0, w: LOT_WIDTH, h: LOT_HEIGHT },
    wallThickness: 0.3,
    entrance: { x: 7.3, width: 3.4 },
    spots,
    obstacles: [
      { x: 6.0, y: 4.6, w: 0.8, h: 0.8 },
      { x: 11.2, y: 4.6, w: 0.8, h: 0.8 }
    ],
    car,
    startPose: { x: 9.0, y: 2.2, heading: Math.PI / 2 }
  }
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
