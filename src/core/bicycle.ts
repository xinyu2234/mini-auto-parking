import type { CarSpec, Pose } from './types'

export function stepPose(pose: Pose, steering: number, dist: number, wheelbase: number): Pose {
  const h = pose.heading
  if (Math.abs(steering) < 1e-9) {
    return {
      x: pose.x + dist * Math.cos(h),
      y: pose.y + dist * Math.sin(h),
      heading: h
    }
  }
  const radius = wheelbase / Math.tan(steering)
  const delta = dist / radius
  const h2 = h + delta
  return {
    x: pose.x + radius * (Math.sin(h2) - Math.sin(h)),
    y: pose.y - radius * (Math.cos(h2) - Math.cos(h)),
    heading: h2
  }
}

export function steeringForRadius(wheelbase: number, radius: number): number {
  return Math.atan2(wheelbase, radius)
}

export function maxSteeringForRadius(car: CarSpec): number {
  return Math.atan(car.wheelbase / car.minTurningRadius)
}
