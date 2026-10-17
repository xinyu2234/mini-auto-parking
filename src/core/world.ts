// Public entry point for lot data. Geometry lives in `lotGeometry`, while the
// randomized map builder lives in `worldGenerator`.
export {
  LOT_HEIGHT,
  LOT_WIDTH,
  APPROACH_DEPTH,
  approachZone,
  getSpotById,
  goalForSpot,
  hasApproachClearance,
  findUnreachableSpotIds,
  validateWorldLayout,
  wallRects
} from './lotGeometry'

export { LAYOUT_OPTIONS, createWorld } from './worldGenerator'
