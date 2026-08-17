import type { PlannerRequest, PlannerResult } from '../../core/types'
import { planPath } from '../../core/hybridAStar'

self.onmessage = (event: MessageEvent<PlannerRequest>) => {
  const req = event.data
  try {
    const result = planPath(req.world, req.startPose, req.goalPose, req.budgetMs)
    const response: PlannerResult = {
      ...result,
      requestId: req.requestId,
      attempt: req.attempt
    }
    self.postMessage(response)
  } catch (err) {
    const response: PlannerResult = {
      requestId: req.requestId,
      status: 'not_found',
      path: [],
      expanded: 0,
      elapsedMs: 0,
      attempt: req.attempt
    }
    self.postMessage(response)
  }
}
