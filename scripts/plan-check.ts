import { createWorld } from '../src/core/world'
import { planPath } from '../src/core/hybridAStar'
import type { LayoutId } from '../src/core/types'

/**
 * Developer utility: plan one bay of a seeded map.
 * Usage: npx vite-node scripts/plan-check.ts [layout] [seed] [spotId]
 */
const layout = (process.argv[2] ?? 'perpendicular') as LayoutId
const seed = Number(process.argv[3] ?? 2024)
const spotId = process.argv[4]
const world = createWorld(layout, seed)
const spot =
  (spotId ? world.spots.find((s) => s.id === spotId && !s.occupied) : undefined) ??
  world.spots.find((s) => !s.occupied)!
for (const budget of [1000, 2500]) {
  const t0 = performance.now()
  const result = planPath(world, world.startPose, spot.goalPose, budget)
  console.log(spot.id, budget, result.status, result.expanded, Math.round(performance.now() - t0), 'ms')
}
