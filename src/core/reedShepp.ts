import type { CarSpec, PathSample, Pose } from './types'
import { stepPose } from './bicycle'
import { TWO_PI, wrapPi } from './geometry'

export interface RSSegment {
  k: -1 | 0 | 1
  s: number
}

export interface RSWord {
  segments: RSSegment[]
  length: number
}

const EPS = 1e-6

function polar(x: number, y: number): { r: number; theta: number } {
  return { r: Math.hypot(x, y), theta: Math.atan2(y, x) }
}

function wrap0to2pi(a: number): number {
  const r = a % TWO_PI
  return r < 0 ? r + TWO_PI : r
}

function cwDelta(from: number, to: number): number {
  const d = wrap0to2pi(from - to)
  return d === 0 ? 0 : d - TWO_PI
}

function ccwDelta(from: number, to: number): number {
  return wrap0to2pi(from - to)
}

function word(...segments: RSSegment[]): RSWord {
  const length = segments.reduce((sum, s) => sum + Math.abs(s.s), 0)
  return { segments, length }
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x))
}

function clean(x: number): number {
  return Math.abs(x) < EPS ? 0 : x
}

function rsLSL(x: number, y: number, phi: number): RSWord | null {
  const { r, theta } = polar(x - Math.sin(phi), y + Math.cos(phi) - 1)
  const u = Math.max(0, r)
  const t = clean(theta)
  const v = clean(phi - theta)
  if (t < -EPS || u < -EPS || v < -EPS) return null
  return word(
    { k: 1, s: Math.max(0, t) },
    { k: 0, s: Math.max(0, u) },
    { k: 1, s: Math.max(0, v) }
  )
}

function rsRSR(x: number, y: number, phi: number): RSWord | null {
  const { r, theta } = polar(x + Math.sin(phi), y - Math.cos(phi) + 1)
  const u = Math.max(0, r)
  const t = clean(theta)
  const v = clean(phi - theta)
  if (t > EPS || u < -EPS || v > EPS) return null
  return word(
    { k: -1, s: Math.min(0, t) },
    { k: 0, s: Math.max(0, u) },
    { k: -1, s: Math.min(0, v) }
  )
}

function rsLSR(x: number, y: number, phi: number): RSWord | null {
  const { r, theta } = polar(x + Math.sin(phi), y - Math.cos(phi) - 1)
  if (r < 2 - EPS) return null
  const u = Math.sqrt(Math.max(0, r * r - 4))
  const thetaT = clean(theta + Math.atan2(2, u))
  const v = clean(thetaT - phi)
  if (thetaT < -EPS || u < -EPS || v > EPS) return null
  return word(
    { k: 1, s: Math.max(0, thetaT) },
    { k: 0, s: Math.max(0, u) },
    { k: -1, s: Math.min(0, v) }
  )
}

function rsRSL(x: number, y: number, phi: number): RSWord | null {
  const { r, theta } = polar(x - Math.sin(phi), y + Math.cos(phi) + 1)
  if (r < 2 - EPS) return null
  const u = Math.sqrt(Math.max(0, r * r - 4))
  const thetaT = clean(theta - Math.atan2(2, u))
  const v = clean(phi - thetaT)
  if (thetaT > EPS || u < -EPS || v < -EPS) return null
  return word(
    { k: -1, s: Math.min(0, thetaT) },
    { k: 0, s: Math.max(0, u) },
    { k: 1, s: Math.max(0, v) }
  )
}

function rsLRL(x: number, y: number, phi: number): RSWord | null {
  const c1 = { x: 0, y: 1 }
  const c3 = { x: x - Math.sin(phi), y: y + Math.cos(phi) }
  const d = { x: c3.x - c1.x, y: c3.y - c1.y }
  const r = Math.hypot(d.x, d.y)
  if (r > 4 + EPS) return null
  const delta = Math.acos(clamp(r / 4, -1, 1))
  const beta = Math.atan2(d.y, d.x) + delta
  const c2 = { x: c1.x + 2 * Math.cos(beta), y: c1.y + 2 * Math.sin(beta) }
  const gamma = Math.atan2(c3.y - c2.y, c3.x - c2.x)
  const h1 = beta + Math.PI / 2
  const h2 = gamma - Math.PI / 2
  let t = wrap0to2pi(h1)
  if (t > TWO_PI - EPS) t = 0
  const um = cwDelta(h2, h1)
  let v = wrap0to2pi(phi - h2)
  if (v > TWO_PI - EPS) v = 0
  if (t < -EPS || um > -EPS || v < -EPS) return null
  return word(
    { k: 1, s: Math.max(0, t) },
    { k: -1, s: Math.min(0, um) },
    { k: 1, s: Math.max(0, v) }
  )
}

function rsRLR(x: number, y: number, phi: number): RSWord | null {
  const c1 = { x: 0, y: -1 }
  const c3 = { x: x + Math.sin(phi), y: y - Math.cos(phi) }
  const d = { x: c3.x - c1.x, y: c3.y - c1.y }
  const r = Math.hypot(d.x, d.y)
  if (r > 4 + EPS) return null
  const delta = Math.acos(clamp(r / 4, -1, 1))
  const beta = Math.atan2(d.y, d.x) - delta
  const c2 = { x: c1.x + 2 * Math.cos(beta), y: c1.y + 2 * Math.sin(beta) }
  const gamma = Math.atan2(c3.y - c2.y, c3.x - c2.x)
  const h1 = beta - Math.PI / 2
  const h2 = gamma + Math.PI / 2
  const t = cwDelta(h1, 0)
  const um = ccwDelta(h2, h1)
  const v = cwDelta(phi, h2)
  if (t > -EPS || um < EPS || v > -EPS) return null
  return word(
    { k: -1, s: Math.min(0, t) },
    { k: 1, s: Math.max(0, um) },
    { k: -1, s: Math.min(0, v) }
  )
}

function timeFlipGoal(x: number, y: number, phi: number): { x: number; y: number; phi: number } {
  const c = Math.cos(phi)
  const s = Math.sin(phi)
  return {
    x: -x * c - y * s,
    y: x * s - y * c,
    phi: wrapPi(-phi)
  }
}

function timeFlipWord(w: RSWord): RSWord {
  const segments = w.segments
    .slice()
    .reverse()
    .map((seg) => ({
      k: (seg.k === 0 ? 0 : -seg.k) as -1 | 0 | 1,
      s: -seg.s
    }))
  return { segments, length: w.length }
}

const SOLVERS = [rsLSL, rsRSR, rsLSR, rsRSL, rsLRL, rsRLR]

function endsAtGoal(w: RSWord, x: number, y: number, phi: number): boolean {
  let pose: Pose = { x: 0, y: 0, heading: 0 }
  const step = 0.05
  for (const seg of w.segments) {
    let remaining = Math.abs(seg.s)
    const steering = seg.k === 0 ? 0 : seg.k * Math.PI / 4
    const sign = seg.s >= 0 ? 1 : -1
    while (remaining > 1e-9) {
      const take = Math.min(step, remaining)
      pose = stepPose(pose, steering, sign * take, 1)
      remaining -= take
    }
  }
  return (
    Math.hypot(pose.x - x, pose.y - y) < 1e-3 &&
    Math.abs(wrapPi(pose.heading - phi)) < 1e-3
  )
}

export function reedsSheppWords(x: number, y: number, phi: number): RSWord[] {
  const out: RSWord[] = []
  for (const solve of SOLVERS) {
    const w = solve(x, y, phi)
    if (w && endsAtGoal(w, x, y, phi)) out.push(w)
  }
  const tf = timeFlipGoal(x, y, phi)
  for (const solve of SOLVERS) {
    const w = solve(tf.x, tf.y, tf.phi)
    const flipped = w ? timeFlipWord(w) : null
    if (flipped && endsAtGoal(flipped, x, y, phi)) out.push(flipped)
  }

  const seen = new Set<string>()
  const unique: RSWord[] = []
  for (const w of out) {
    const key = w.segments.map((s) => `${s.k}:${s.s.toFixed(3)}`).join('|')
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(w)
  }
  unique.sort((a, b) => a.length - b.length)
  return unique
}

export function sampleRSWord(word: RSWord, start: Pose, car: CarSpec, step = 0.1): PathSample[] {
  const maxSteering = Math.atan(car.wheelbase / car.minTurningRadius)
  const poses: PathSample[] = [{ ...start, dir: 1, steering: 0 }]
  let pose = start
  for (const seg of word.segments) {
    const sign = seg.s >= 0 ? 1 : -1
    let remaining = Math.abs(seg.s)
    let steering = 0
    if (seg.k === 1) steering = maxSteering
    else if (seg.k === -1) steering = -maxSteering
    while (remaining > 1e-9) {
      const take = Math.min(step, remaining)
      pose = stepPose(pose, steering, sign * take, car.wheelbase)
      poses.push({ ...pose, dir: sign as 1 | -1, steering })
      remaining -= take
    }
  }
  return poses
}
