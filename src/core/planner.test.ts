import { describe, expect, it } from 'vitest'
import type { World } from './types'
import { isPoseColliding } from './collision'
import { wrapPi } from './geometry'
import { planPath } from './hybridAStar'
import { createWorld } from './world'

function smallWorld(): World {
  return {
    layoutId: 'perpendicular',
    layoutName: '测试场地',
    mapSeed: 1,
    bounds: { x: 0, y: 0, w: 10, h: 6 },
    wallThickness: 0.3,
    entrance: { side: 'bottom', center: 5, width: 2 },
    spots: [],
    obstacles: [],
    car: {
      length: 3,
      width: 1.5,
      wheelbase: 2,
      maxSteering: Math.atan(2 / 3),
      minTurningRadius: 3
    },
    startPose: { x: 2, y: 1, heading: 0 }
  }
}

function closedWorld(): World {
  const w = smallWorld()
  w.bounds = { x: 0, y: 0, w: 8, h: 5 }
  w.obstacles = [
    { x: 2.5, y: 1.5, w: 3, h: 0.2 },
    { x: 2.5, y: 3.3, w: 3, h: 0.2 },
    { x: 2.5, y: 1.5, w: 0.2, h: 2 },
    { x: 5.3, y: 1.5, w: 0.2, h: 2 }
  ]
  return w
}

describe('hybrid A* planner', () => {
  it('finds a collision-free path in an open lot', () => {
    const world = smallWorld()
    const result = planPath(world, world.startPose, { x: 8, y: 4, heading: 0 }, 4000)
    expect(result.status).toBe('found')
    expect(result.path.length).toBeGreaterThan(2)
    const end = result.path[result.path.length - 1]
    expect(Math.hypot(end.x - 8, end.y - 4)).toBeLessThan(0.3)
    for (const p of result.path) {
      expect(isPoseColliding(world, p)).toBe(false)
    }
    for (let i = 2; i < result.path.length; i++) {
      const prev = result.path[i - 1]
      const cur = result.path[i]
      const dist = Math.hypot(cur.x - prev.x, cur.y - prev.y)
      const dh = Math.abs(cur.heading - prev.heading)
      if (dist > 1e-6) {
        expect(dh / dist).toBeLessThanOrEqual(1 / 3 + 0.01)
      }
    }
  })

  it('returns not_found when the goal is sealed off', () => {
    const world = closedWorld()
    const result = planPath(world, { x: 1, y: 1, heading: 0 }, { x: 4, y: 2.4, heading: 0 }, 3000)
    expect(result.status).toBe('not_found')
  })

  it('times out under a tiny budget', () => {
    const world = createWorld('perpendicular', 4242)
    const spot = world.spots.find((s) => !s.occupied) ?? world.spots[0]
    const result = planPath(world, world.startPose, spot.goalPose, 0.2)
    expect(result.status).toBe('timeout')
  })

  it.each(['perpendicular', 'parallel', 'angled'] as const)(
    'plans safely into free bays of a randomized %s map',
    (layoutId) => {
      const world = createWorld(layoutId, 2024)
      const free = world.spots.filter((s) => !s.occupied).slice(0, 2)
      expect(free.length).toBeGreaterThan(0)
      let solved = 0
      for (const spot of free) {
        const result = planPath(world, world.startPose, spot.goalPose, 5000)
        if (result.status !== 'found') {
          // Hard bays are allowed to fail; they must not return a partial path.
          expect(result.path).toEqual([])
          continue
        }
        solved++
        const end = result.path[result.path.length - 1]
        expect(Math.hypot(end.x - spot.goalPose.x, end.y - spot.goalPose.y)).toBeLessThan(0.35)
        expect(Math.abs(wrapPi(end.heading - spot.goalPose.heading))).toBeLessThan(0.12)
        for (const p of result.path) {
          expect(isPoseColliding(world, p)).toBe(false)
        }
      }
      expect(solved, `${layoutId} solved none`).toBeGreaterThan(0)
    },
    45000
  )

  it('never reports a path into a bay that already holds a car', () => {
    const world = createWorld('perpendicular', 2024)
    const occupied = world.spots.find((s) => s.occupied)
    expect(occupied).toBeDefined()
    const result = planPath(world, world.startPose, occupied!.goalPose, 2000)
    expect(result.status).not.toBe('found')
    expect(result.path).toEqual([])
  }, 20000)
})
