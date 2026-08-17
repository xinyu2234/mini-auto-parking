export interface Pose {
  x: number
  y: number
  heading: number
}

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface CarSpec {
  length: number
  width: number
  wheelbase: number
  maxSteering: number
  minTurningRadius: number
}

export interface Spot {
  id: string
  rect: Rect
  goalPose: Pose
  occupied: boolean
}

export interface World {
  bounds: Rect
  wallThickness: number
  entrance: { x: number; width: number }
  spots: Spot[]
  obstacles: Rect[]
  car: CarSpec
  startPose: Pose
}

export interface PathSample extends Pose {
  dir: 1 | -1
  steering: number
}

export interface PlannerRequest {
  requestId: number
  world: World
  startPose: Pose
  goalPose: Pose
  budgetMs: number
  attempt: number
}

export type PlannerStatus = 'found' | 'timeout' | 'not_found'

export interface PlannerResult {
  requestId: number
  status: PlannerStatus
  path: PathSample[]
  expanded: number
  elapsedMs: number
  attempt: number
}
