import type { CarSpec, PathSample, PlannerResult, Pose, World } from './types'
import { PLANNER } from './config'
import { isPoseColliding } from './collision'
import { computeDijkstraField } from './dijkstra'
import { normalizeAngle, poseRelativeTo, wrapPi } from './geometry'
import { MinHeap } from './heap'
import { reedsSheppWords, sampleRSWord, type RSWord } from './reedShepp'
import { stepPose } from './bicycle'

interface Primitive {
  steering: number
  dist: number
}

interface AstarNode {
  pose: Pose
  g: number
  f: number
  steering: number
  dir: 1 | -1
  key: number
  prev: AstarNode | null
  samples: PathSample[]
}

const TWO_PI_SLOT = Math.PI * 2

function buildPrimitives(car: CarSpec): Primitive[] {
  const max = Math.atan(car.wheelbase / car.minTurningRadius)
  const levels = [-max, -max / 2, 0, max / 2, max]
  const out: Primitive[] = []
  for (const steering of levels) {
    out.push({ steering, dist: PLANNER.primitiveDist })
    out.push({ steering, dist: -PLANNER.primitiveDist })
  }
  return out
}

function stateKey(pose: Pose, world: World): number {
  const b = world.bounds
  const nx = Math.ceil(b.w / PLANNER.gridCell)
  const ny = Math.ceil(b.h / PLANNER.gridCell)
  const cx = Math.min(nx - 1, Math.max(0, Math.floor((pose.x - b.x) / PLANNER.gridCell)))
  const cy = Math.min(ny - 1, Math.max(0, Math.floor((pose.y - b.y) / PLANNER.gridCell)))
  const bucket = (TWO_PI_SLOT / PLANNER.headingBuckets)
  const hi = Math.min(PLANNER.headingBuckets - 1, Math.floor(normalizeAngle(pose.heading) / bucket))
  return (cy * nx + cx) * PLANNER.headingBuckets + hi
}

function makeSamples(pose: Pose, steering: number, dist: number, car: CarSpec): PathSample[] {
  const out: PathSample[] = []
  const total = Math.abs(dist)
  const steps = Math.max(1, Math.round(total / PLANNER.sampleStep))
  for (let i = 1; i <= steps; i++) {
    const d = (dist / steps) * i
    const p = stepPose(pose, steering, d, car.wheelbase)
    out.push({ ...p, dir: dist >= 0 ? 1 : -1, steering })
  }
  return out
}

function collisionFreeSamples(world: World, samples: PathSample[]): boolean {
  for (const s of samples) {
    if (isPoseColliding(world, s)) return false
  }
  return true
}

function straightSamples(world: World, pose: Pose, goal: Pose, car: CarSpec): PathSample[] | null {
  const rel = poseRelativeTo(pose, goal)
  if (Math.abs(rel.phi) > PLANNER.goalStraightTolerance) return null
  const dist = Math.hypot(rel.x, rel.y)
  if (dist < 0.05) return null
  const dir: 1 | -1 = rel.x < 0 ? -1 : 1
  const samples = makeSamples(pose, 0, dir * dist, car)
  const end = samples[samples.length - 1]
  if (
    Math.hypot(end.x - goal.x, end.y - goal.y) < 0.15 &&
    collisionFreeSamples(world, samples.slice(1))
  ) {
    return [{ ...pose, dir, steering: 0 }, ...samples]
  }
  return null
}

function analyticConnection(
  world: World,
  pose: Pose,
  goal: Pose,
  car: CarSpec
): PathSample[] | null {
  const rel = poseRelativeTo(pose, goal)
  const rho = car.minTurningRadius
  const xN = rel.x / rho
  const yN = rel.y / rho
  const words: RSWord[] = reedsSheppWords(xN, yN, rel.phi)
  let best: PathSample[] | null = null

  for (const w of words) {
    const scaled: RSWord = {
      segments: w.segments.map((s) => ({ ...s, s: s.s * rho })),
      length: w.length * rho
    }
    const samples = sampleRSWord(scaled, pose, car, PLANNER.sampleStep)
    const end = samples[samples.length - 1]
    const posOk = Math.hypot(end.x - goal.x, end.y - goal.y) < 0.3
    const headingOk = Math.abs(wrapPi(end.heading - goal.heading)) < 0.2
    if (
      posOk &&
      headingOk &&
      collisionFreeSamples(world, samples.slice(1)) &&
      (!best || samples.length < best.length)
    ) {
      best = samples
    }
  }

  const straight = straightSamples(world, pose, goal, car)
  if (straight && (!best || straight.length < best.length)) best = straight
  return best
}

function reconstruct(node: AstarNode, analytic: PathSample[] | null): PathSample[] {
  const chain: AstarNode[] = []
  let cur: AstarNode | null = node
  while (cur) {
    chain.push(cur)
    cur = cur.prev
  }
  chain.reverse()

  const path: PathSample[] = [
    { ...chain[0].pose, dir: chain[0].dir, steering: chain[0].steering }
  ]
  for (const n of chain.slice(1)) {
    path.push(...n.samples)
    path.push({ ...n.pose, dir: n.dir, steering: n.steering })
  }
  if (analytic) {
    path.push(...analytic.slice(1))
  }
  return path
}

export function planPath(world: World, start: Pose, goal: Pose, budgetMs: number): PlannerResult {
  const started = performance.now()
  const deadline = started + budgetMs
  const car = world.car
  const primitives = buildPrimitives(car)
  const heuristic = computeDijkstraField(world, goal.x, goal.y, PLANNER.gridCell)
  const b = world.bounds
  const nx = Math.ceil(b.w / PLANNER.gridCell)
  const ny = Math.ceil(b.h / PLANNER.gridCell)

  const heuristicAt = (pose: Pose): number => {
    const cx = Math.min(nx - 1, Math.max(0, Math.floor((pose.x - b.x) / PLANNER.gridCell)))
    const cy = Math.min(ny - 1, Math.max(0, Math.floor((pose.y - b.y) / PLANNER.gridCell)))
    return heuristic[cy * nx + cx] ?? 0
  }

  const startKey = stateKey(start, world)
  const startH = heuristicAt(start)
  const root: AstarNode = {
    pose: start,
    g: 0,
    f: startH,
    steering: 0,
    dir: 1,
    key: startKey,
    prev: null,
    samples: []
  }

  const open = new MinHeap<AstarNode>((n) => n.f)
  const bestG = new Map<number, number>()
  const closed = new Set<number>()
  open.push(root)
  bestG.set(startKey, 0)

  let expanded = 0
  while (open.size > 0) {
    const node = open.pop() as AstarNode
    if (closed.has(node.key)) continue
    if ((bestG.get(node.key) ?? Infinity) < node.g - 1e-9) continue
    closed.add(node.key)
    expanded++

    if (expanded % 64 === 0 && performance.now() > deadline) {
      return { requestId: 0, status: 'timeout', path: [], expanded, elapsedMs: performance.now() - started, attempt: 0 }
    }
    if (expanded > PLANNER.maxExpansions) {
      return { requestId: 0, status: 'timeout', path: [], expanded, elapsedMs: performance.now() - started, attempt: 0 }
    }

    const nearGoal =
      Math.hypot(goal.x - node.pose.x, goal.y - node.pose.y) < PLANNER.analyticDistance
    if (nearGoal && (expanded % 6 === 0 || expanded < 24)) {
      const analytic = analyticConnection(world, node.pose, goal, car)
      if (analytic) {
        return {
          requestId: 0,
          status: 'found',
          path: reconstruct(node, analytic),
          expanded,
          elapsedMs: performance.now() - started,
          attempt: 0
        }
      }
    }

    for (const prim of primitives) {
      const samples = makeSamples(node.pose, prim.steering, prim.dist, car)
      if (!collisionFreeSamples(world, samples)) continue
      const endPose = samples[samples.length - 1]
      const key = stateKey(endPose, world)
      if (closed.has(key)) continue

      const reverse = prim.dist < 0
      const steeringChange =
        Math.abs(node.steering - prim.steering) > 0.01 ? PLANNER.steeringChangePenalty : 0
      const cost =
        Math.abs(prim.dist) * (reverse ? PLANNER.reversePenalty : 1) + steeringChange
      const g2 = node.g + cost
      const prevBest = bestG.get(key)
      if (prevBest !== undefined && prevBest <= g2 + 1e-9) continue

      const h = heuristicAt(endPose)
      const next: AstarNode = {
        pose: endPose,
        g: g2,
        f: g2 + h,
        steering: prim.steering,
        dir: prim.dist >= 0 ? 1 : -1,
        key,
        prev: node,
        samples: samples.slice(0, -1)
      }
      bestG.set(key, g2)
      open.push(next)
    }
  }

  return {
    requestId: 0,
    status: 'not_found',
    path: [],
    expanded,
    elapsedMs: performance.now() - started,
    attempt: 0
  }
}
