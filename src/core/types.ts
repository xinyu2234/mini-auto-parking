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
  angle: number
  goalPose: Pose
  occupied: boolean
}

export type LayoutId = 'perpendicular' | 'parallel' | 'angled'

export type EntranceSide = 'bottom' | 'left'

export interface Entrance {
  side: EntranceSide
  center: number
  width: number
}

export interface World {
  layoutId: LayoutId
  layoutName: string
  bounds: Rect
  wallThickness: number
  entrance: Entrance
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
