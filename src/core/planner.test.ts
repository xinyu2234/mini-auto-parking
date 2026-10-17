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
    const spot = world.spots[0]
    const result = planPath(world, world.startPose, spot.goalPose, 0.2)
    expect(result.status).toBe('timeout')
  })

  it('parks into a real side spot', () => {
    const world = createWorld('perpendicular', 4242)
    const spot = world.spots.find((s) => s.id === 'L1') as NonNullable<typeof world.spots[0]>
    const result = planPath(world, world.startPose, spot.goalPose, 8000)
    expect(result.status).toBe('found')
    const end = result.path[result.path.length - 1]
    expect(Math.hypot(end.x - spot.goalPose.x, end.y - spot.goalPose.y)).toBeLessThan(0.35)
    expect(Math.abs(wrapPi(end.heading - spot.goalPose.heading))).toBeLessThan(0.12)
    for (const p of result.path) {
      expect(isPoseColliding(world, p)).toBe(false)
    }
  }, 15000)

  it('parks into a real top spot', () => {
    const world = createWorld('perpendicular', 4242)
    const spot = world.spots.find((s) => s.id === 'T2') as NonNullable<typeof world.spots[0]>
    const result = planPath(world, world.startPose, spot.goalPose, 8000)
    expect(result.status).toBe('found')
    const end = result.path[result.path.length - 1]
    expect(Math.hypot(end.x - spot.goalPose.x, end.y - spot.goalPose.y)).toBeLessThan(0.35)
    expect(Math.abs(wrapPi(end.heading - spot.goalPose.heading))).toBeLessThan(0.12)
    for (const p of result.path) {
      expect(isPoseColliding(world, p)).toBe(false)
    }
  }, 15000)

  it('parks into a real right spot', () => {
    const world = createWorld('perpendicular', 4242)
    const spot = world.spots.find((s) => s.id === 'R2') as NonNullable<typeof world.spots[0]>
    const result = planPath(world, world.startPose, spot.goalPose, 8000)
    expect(result.status).toBe('found')
    const end = result.path[result.path.length - 1]
    expect(Math.hypot(end.x - spot.goalPose.x, end.y - spot.goalPose.y)).toBeLessThan(0.35)
    expect(Math.abs(wrapPi(end.heading - spot.goalPose.heading))).toBeLessThan(0.12)
    for (const p of result.path) {
      expect(isPoseColliding(world, p)).toBe(false)
    }
  }, 15000)

  it('parks into a parallel spot', () => {
    const world = createWorld('parallel', 4242)
    const spot = world.spots.find((s) => s.id === 'T1') as NonNullable<typeof world.spots[0]>
    const result = planPath(world, world.startPose, spot.goalPose, 10000)
    expect(result.status).toBe('found')
    const end = result.path[result.path.length - 1]
    expect(Math.hypot(end.x - spot.goalPose.x, end.y - spot.goalPose.y)).toBeLessThan(0.35)
    expect(Math.abs(wrapPi(end.heading - spot.goalPose.heading))).toBeLessThan(0.12)
    for (const p of result.path) {
      expect(isPoseColliding(world, p)).toBe(false)
    }
  }, 20000)

  it('parks into an angled spot', () => {
    const world = createWorld('angled', 4242)
    const spot = world.spots.find((s) => s.id === 'T1') as NonNullable<typeof world.spots[0]>
    const result = planPath(world, world.startPose, spot.goalPose, 10000)
    expect(result.status).toBe('found')
    const end = result.path[result.path.length - 1]
    expect(Math.hypot(end.x - spot.goalPose.x, end.y - spot.goalPose.y)).toBeLessThan(0.35)
    expect(Math.abs(wrapPi(end.heading - spot.goalPose.heading))).toBeLessThan(0.12)
    for (const p of result.path) {
      expect(isPoseColliding(world, p)).toBe(false)
    }
  }, 20000)

  it.each(['perpendicular', 'parallel', 'angled'] as const)(
    'solves several spots on a freshly generated %s map',
    (layoutId) => {
      const world = createWorld(layoutId, 2468)
      const picks = [world.spots[0], world.spots[world.spots.length - 1]]
      for (const spot of picks) {
        const result = planPath(world, world.startPose, spot.goalPose, 9000)
        expect(result.status, `${layoutId} ${spot.id}`).toBe('found')
        for (const p of result.path) {
          expect(isPoseColliding(world, p)).toBe(false)
        }
      }
    },
    40000
  )
})
