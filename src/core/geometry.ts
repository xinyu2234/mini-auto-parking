import type { Pose, Rect } from './types'

export const TWO_PI = Math.PI * 2

export function normalizeAngle(a: number): number {
  const r = a % TWO_PI
  return r < 0 ? r + TWO_PI : r
}

export function wrapPi(a: number): number {
  const r = normalizeAngle(a)
  return r > Math.PI ? r - TWO_PI : r
}

export function poseRelativeTo(start: Pose, goal: Pose): { x: number; y: number; phi: number } {
  const dx = goal.x - start.x
  const dy = goal.y - start.y
  const c = Math.cos(start.heading)
  const s = Math.sin(start.heading)
  return {
    x: dx * c + dy * s,
    y: -dx * s + dy * c,
    phi: wrapPi(goal.heading - start.heading)
  }
}

export function poseFromRelative(base: Pose, rel: { x: number; y: number; phi: number }): Pose {
  const c = Math.cos(base.heading)
  const s = Math.sin(base.heading)
  return {
    x: base.x + rel.x * c - rel.y * s,
    y: base.y + rel.x * s + rel.y * c,
    heading: base.heading + rel.phi
  }
}

export interface Point {
  x: number
  y: number
}

export function rectCorners(rect: Rect): Point[] {
  return [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.w, y: rect.y },
    { x: rect.x + rect.w, y: rect.y + rect.h },
    { x: rect.x, y: rect.y + rect.h }
  ]
}

export function pointInRect(p: Point, rect: Rect, eps = 0): boolean {
  return (
    p.x >= rect.x - eps &&
    p.x <= rect.x + rect.w + eps &&
    p.y >= rect.y - eps &&
    p.y <= rect.y + rect.h + eps
  )
}

export function pointsOverlap(a: Point[], b: Point[], eps = 1e-7): boolean {
  const axes: Point[] = []
  for (let i = 0; i < a.length; i++) {
    const p = a[i]
    const q = a[(i + 1) % a.length]
    axes.push({ x: q.y - p.y, y: -(q.x - p.x) })
  }
  for (let i = 0; i < b.length; i++) {
    const p = b[i]
    const q = b[(i + 1) % b.length]
    axes.push({ x: q.y - p.y, y: -(q.x - p.x) })
  }

  for (const axis of axes) {
    const len = Math.hypot(axis.x, axis.y)
    if (len < 1e-12) continue
    const ax = axis.x / len
    const ay = axis.y / len
    let minA = Infinity
    let maxA = -Infinity
    for (const p of a) {
      const d = p.x * ax + p.y * ay
      if (d < minA) minA = d
      if (d > maxA) maxA = d
    }
    let minB = Infinity
    let maxB = -Infinity
    for (const p of b) {
      const d = p.x * ax + p.y * ay
      if (d < minB) minB = d
      if (d > maxB) maxB = d
    }
    if (maxA < minB + eps || maxB < minA + eps) return false
  }
  return true
}

export function rectsOverlap(a: Rect, b: Rect, eps = 1e-7): boolean {
  return pointsOverlap(rectCorners(a), rectCorners(b), eps)
}
