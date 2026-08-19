import type { World } from './types'
import { isPointInSolid } from './collision'
import { MinHeap } from './heap'

interface DijkstraNode {
  i: number
  dist: number
}

export function computeDijkstraField(world: World, goalX: number, goalY: number, cell: number): Float64Array {
  const b = world.bounds
  const nx = Math.ceil(b.w / cell)
  const ny = Math.ceil(b.h / cell)
  const dist = new Float64Array(nx * ny).fill(Infinity)
  const blocked = new Uint8Array(nx * ny)

  for (let i = 0; i < nx * ny; i++) {
    const cx = b.x + (i % nx + 0.5) * cell
    const cy = b.y + (Math.floor(i / nx) + 0.5) * cell
    blocked[i] = isPointInSolid(world, cx, cy) ? 1 : 0
  }

  const gx = Math.min(nx - 1, Math.max(0, Math.floor((goalX - b.x) / cell)))
  const gy = Math.min(ny - 1, Math.max(0, Math.floor((goalY - b.y) / cell)))
  const goal = gy * nx + gx
  if (blocked[goal]) return dist

  const heap = new MinHeap<DijkstraNode>((n) => n.dist)
  dist[goal] = 0
  heap.push({ i: goal, dist: 0 })

  while (heap.size > 0) {
    const cur = heap.pop() as DijkstraNode
    if (cur.dist > dist[cur.i]) continue
    const cx = cur.i % nx
    const cy = Math.floor(cur.i / nx)
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue
        const nx2 = cx + dx
        const ny2 = cy + dy
        if (nx2 < 0 || nx2 >= nx || ny2 < 0 || ny2 >= ny) continue
        const ni = ny2 * nx + nx2
        if (blocked[ni]) continue
        const step = dx !== 0 && dy !== 0 ? Math.SQRT2 * cell : cell
        const nd = cur.dist + step
        if (nd < dist[ni]) {
          dist[ni] = nd
          heap.push({ i: ni, dist: nd })
        }
      }
    }
  }
  return dist
}
