import type { PathSample } from '../../core/types'

export function segmentLength(a: PathSample, b: PathSample): number {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

export function pathLength(path: PathSample[]): number {
  let total = 0
  for (let i = 1; i < path.length; i++) total += segmentLength(path[i - 1], path[i])
  return total
}

export function sampleAt(path: PathSample[], distance: number): PathSample {
  if (path.length === 0) throw new Error('empty path')
  if (distance <= 0 || path.length === 1) return path[0]

  let walked = 0
  for (let i = 1; i < path.length; i++) {
    const len = segmentLength(path[i - 1], path[i])
    if (walked + len >= distance) {
      const t = len > 0 ? (distance - walked) / len : 0
      const a = path[i - 1]
      const b = path[i]
      return {
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        heading: a.heading + (b.heading - a.heading) * t,
        dir: b.dir,
        steering: a.steering + (b.steering - a.steering) * t
      }
    }
    walked += len
  }
  return path[path.length - 1]
}
