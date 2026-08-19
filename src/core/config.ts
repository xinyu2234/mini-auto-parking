export const PLANNER = {
  gridCell: 0.25,
  headingBuckets: 32,
  primitiveDist: 0.5,
  reversePenalty: 1.7,
  steeringChangePenalty: 0.22,
  maxExpansions: 60000,
  analyticDistance: 8,
  sampleStep: 0.1,
  collisionSampleStep: 0.17,
  goalStraightTolerance: 0.08
} as const

export const RETRY = {
  distance: 1.2,
  maxAttempts: 3,
  budgetsMs: [2500, 3000, 3500]
} as const

export const ANIMATION = {
  forwardSpeed: 2.5,
  reverseSpeed: 1.5,
  speedOptions: [0.5, 1, 2]
} as const
