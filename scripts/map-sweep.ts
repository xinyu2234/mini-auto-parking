/**
 * Developer utility: sweeps many random seeds and reports how many spots the
 * planner can actually reach. Run with `npm run check:maps`.
 */
import { createWorld } from '../src/core/world'
import { planPath } from '../src/core/hybridAStar'
import type { LayoutId } from '../src/core/types'

const layouts: LayoutId[] = ['perpendicular', 'parallel', 'angled']
const genSeeds = Array.from({ length: 12 }, (_, i) => 1000 + i * 37)
const planSeeds = [2024, 777]

for (const layout of layouts) {
  let genMs = 0
  for (const seed of genSeeds) {
    const t = performance.now()
    const world = createWorld(layout, seed)
    genMs += performance.now() - t
    if (world.spots.length < 4) console.error('too few spots', layout, seed, world.spots.length)
  }
  console.log(`${layout}: 平均生成 ${(genMs / genSeeds.length).toFixed(2)}ms`)

  for (const seed of planSeeds) {
    const world = createWorld(layout, seed)
    const failures: string[] = []
    const occupied = world.spots.filter((s) => s.occupied).map((s) => s.id)
    const sample = world.spots.filter((s) => !s.occupied).slice(0, 5)
    const t = performance.now()
    for (const spot of sample) {
      const r = planPath(world, world.startPose, spot.goalPose, 5000)
      if (r.status !== 'found') failures.push(`${spot.id}:${r.status}`)
    }
    const free = world.spots.length - occupied.length
    const ok = sample.length - failures.length
    console.log(
      `  seed ${seed}: ${world.bounds.w}x${world.bounds.h}, 空闲${free}/${world.spots.length}, 抽样${ok}/${sample.length} 可泊入, ${(performance.now() - t).toFixed(0)}ms` +
        (failures.length ? ` 失败项 ${failures.join(',')}` : '')
    )
    if (occupied.length) console.log(`    已占用: ${occupied.join(',')}`)
  }
}
