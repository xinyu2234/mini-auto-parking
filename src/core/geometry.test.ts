import { describe, expect, it } from 'vitest'
import { pointInRect, pointsOverlap, rectCorners } from './geometry'

describe('geometry', () => {
  it('detects overlapping rectangles', () => {
    const a = rectCorners({ x: 0, y: 0, w: 2, h: 2 })
    const b = rectCorners({ x: 1, y: 1, w: 2, h: 2 })
    expect(pointsOverlap(a, b)).toBe(true)
  })

  it('treats touching rectangles as non-overlapping', () => {
    const a = rectCorners({ x: 0, y: 0, w: 2, h: 2 })
    const b = rectCorners({ x: 2, y: 0, w: 2, h: 2 })
    expect(pointsOverlap(a, b)).toBe(false)
  })

  it('detects rotated rectangle overlap', () => {
    const center = { x: 0, y: 0 }
    const angle = Math.PI / 4
    const c = Math.cos(angle)
    const s = Math.sin(angle)
    const a = [
      { x: center.x - c - s, y: center.y + s - c },
      { x: center.x + c - s, y: center.y - s - c },
      { x: center.x + c + s, y: center.y - s + c },
      { x: center.x - c + s, y: center.y + s + c }
    ]
    const b = rectCorners({ x: 0.2, y: -0.2, w: 1, h: 1 })
    expect(pointsOverlap(a, b)).toBe(true)
  })

  it('checks points in rects', () => {
    const rect = { x: 1, y: 2, w: 3, h: 4 }
    expect(pointInRect({ x: 2, y: 3 }, rect)).toBe(true)
    expect(pointInRect({ x: 3.9, y: 5.9 }, rect)).toBe(true)
    expect(pointInRect({ x: 0.9, y: 3 }, rect)).toBe(false)
  })
})
