import type { PathSample, Pose, World } from './types'
import { isPoseColliding } from './collision'

export function buildReverseSegment(world: World, from: Pose, maxDistance: number, step = 0.1): PathSample[] {
  const samples: PathSample[] = []
  let pose = from
  let moved = 0
  while (moved < maxDistance - 1e-9) {
    const take = Math.min(step, maxDistance - moved)
    const next: Pose = {
      x: pose.x - take * Math.cos(pose.heading),
      y: pose.y - take * Math.sin(pose.heading),
      heading: pose.heading
    }
    if (isPoseColliding(world, next)) break
    samples.push({ ...next, dir: -1, steering: 0 })
    pose = next
    moved += take
  }
  return samples
}
