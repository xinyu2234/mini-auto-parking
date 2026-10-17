import type { CarSpec, Pose, Rect, World } from './types'
import { pointInRect, pointInRotatedRect, pointsOverlap, rectCorners, rotatedRectCorners } from './geometry'
import { wallRects } from './world'

export interface Point {
  x: number
  y: number
}

export function carCorners(pose: Pose, car: CarSpec): Point[] {
  const c = Math.cos(pose.heading)
  const s = Math.sin(pose.heading)
  const hw = car.width / 2
  const hl = car.length / 2
  const local = [
    { x: hl, y: hw },
    { x: hl, y: -hw },
    { x: -hl, y: -hw },
    { x: -hl, y: hw }
  ]
  return local.map((p) => ({
    x: pose.x + p.x * c - p.y * s,
    y: pose.y + p.x * s + p.y * c
  }))
}

export function isPoseColliding(world: World, pose: Pose, margin = 1e-6): boolean {
  const b = world.bounds
  if (
    pose.x < b.x + margin ||
    pose.x > b.x + b.w - margin ||
    pose.y < b.y + margin ||
    pose.y > b.y + b.h - margin
  ) {
    return true
  }

  const corners = carCorners(pose, world.car)
  const solids: Rect[] = [...wallRects(world), ...world.obstacles]
  for (const rect of solids) {
    if (pointsOverlap(corners, rectCorners(rect), 1e-5)) return true
  }

  // Bays that already hold a parked car are solid obstacles as well.
  for (const spot of world.spots) {
    if (!spot.occupied) continue
    if (pointsOverlap(corners, rotatedRectCorners(spot.rect, spot.angle), 1e-5)) return true
  }
  return false
}

export function isPointInSolid(world: World, x: number, y: number): boolean {
  const solids: Rect[] = [...wallRects(world), ...world.obstacles]
  if (solids.some((r) => pointInRect({ x, y }, r))) return true
  return world.spots.some((s) => s.occupied && pointInRotatedRect({ x, y }, s.rect, s.angle))
}
