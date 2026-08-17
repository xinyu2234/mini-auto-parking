import type { CarSpec, Pose, Rect, World } from './types'
import { pointInRect, pointsOverlap, rectCorners } from './geometry'
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
  return false
}

export function isPointInSolid(world: World, x: number, y: number): boolean {
  const solids: Rect[] = [...wallRects(world), ...world.obstacles]
  return solids.some((r) => pointInRect({ x, y }, r))
}
