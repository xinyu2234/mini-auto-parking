import { useEffect, useRef } from 'react'
import type { PathSample, Spot, World } from '../../core/types'
import { pointInRotatedRect } from '../../core/geometry'
import { wallRects } from '../../core/world'
import { LOT_HEIGHT, LOT_WIDTH } from '../../core/world'

interface Props {
  world: World
  selectedSpotId: string | null
  hoveredSpotId: string | null
  path: PathSample[]
  retrySplitIndex: number
  carPose: PathSample
  occupied: Set<string>
  onHover: (id: string | null) => void
  onSelect: (id: string) => void
}

interface View {
  scale: number
  left: number
  top: number
}

export function ParkingLotCanvas(props: Props): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const viewRef = useRef<View>({ scale: 40, left: 40, top: 40 })
  const propsRef = useRef<Props>(props)
  const renderRef = useRef<() => void>(() => {})
  propsRef.current = props

  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return

    const render = () => {
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const dpr = window.devicePixelRatio || 1
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      draw(ctx, propsRef.current, viewRef.current)
    }
    renderRef.current = render

    const resize = () => {
      const w = container.clientWidth
      const h = container.clientHeight
      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.max(1, Math.floor(w * dpr))
      canvas.height = Math.max(1, Math.floor(h * dpr))
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      const scale = Math.min((w - 60) / LOT_WIDTH, (h - 60) / LOT_HEIGHT)
      viewRef.current = {
        scale,
        left: (w - LOT_WIDTH * scale) / 2,
        top: (h - LOT_HEIGHT * scale) / 2
      }
      // Resizing a canvas clears its bitmap, so repaint right away.
      render()
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    renderRef.current()
  })

  const worldToScreen = (x: number, y: number): { x: number; y: number } => {
    const v = viewRef.current
    return { x: v.left + x * v.scale, y: v.top + (LOT_HEIGHT - y) * v.scale }
  }

  const screenToWorld = (sx: number, sy: number): { x: number; y: number } => {
    const v = viewRef.current
    return { x: (sx - v.left) / v.scale, y: LOT_HEIGHT - (sy - v.top) / v.scale }
  }

  const handleMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const p = screenToWorld(e.clientX - rect.left, e.clientY - rect.top)
    const hit = props.world.spots.find((s) => pointInRotatedRect(p, s.rect, s.angle))
    props.onHover(hit ? hit.id : null)
  }

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const p = screenToWorld(e.clientX - rect.left, e.clientY - rect.top)
    const hit = props.world.spots.find((s) => pointInRotatedRect(p, s.rect, s.angle))
    if (hit) {
      props.onSelect(hit.id)
    }
  }

  return (
    <div ref={containerRef} className="canvas-container">
      <canvas
        ref={canvasRef}
        onMouseMove={handleMove}
        onMouseLeave={() => props.onHover(null)}
        onClick={handleClick}
        style={{ cursor: props.hoveredSpotId ? 'pointer' : 'default' }}
      />
    </div>
  )
}

function draw(ctx: CanvasRenderingContext2D, props: Props, view: View): void {
  const { world } = props
  const sx = (x: number) => view.left + x * view.scale
  const sy = (y: number) => view.top + (LOT_HEIGHT - y) * view.scale

  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  ctx.fillStyle = '#151a21'
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)

  // Lot floor
  ctx.fillStyle = '#dfe3e6'
  ctx.fillRect(sx(0), sy(LOT_HEIGHT), LOT_WIDTH * view.scale, LOT_HEIGHT * view.scale)

  // Wall
  ctx.fillStyle = '#3d4650'
  for (const w of wallRects(world)) {
    ctx.fillRect(sx(w.x), sy(w.y + w.h), w.w * view.scale, w.h * view.scale)
  }

  // Entrance marking
  const ent = world.entrance
  ctx.strokeStyle = '#1f9d55'
  ctx.lineWidth = 3
  ctx.setLineDash([8, 6])
  ctx.beginPath()
  if (ent.side === 'left') {
    ctx.moveTo(sx(0), sy(ent.center - ent.width / 2 + 0.25))
    ctx.lineTo(sx(0), sy(ent.center + ent.width / 2 - 0.25))
  } else {
    ctx.moveTo(sx(ent.center - ent.width / 2 + 0.25), sy(0))
    ctx.lineTo(sx(ent.center + ent.width / 2 - 0.25), sy(0))
  }
  ctx.stroke()
  ctx.setLineDash([])

  // Spots
  for (const spot of world.spots) {
    drawSpot(ctx, props, spot, sx, sy)
  }

  // Obstacles
  ctx.fillStyle = '#66788a'
  ctx.strokeStyle = '#39424c'
  ctx.lineWidth = 2
  for (const o of world.obstacles) {
    ctx.fillRect(sx(o.x), sy(o.y + o.h), o.w * view.scale, o.h * view.scale)
    ctx.strokeRect(sx(o.x), sy(o.y + o.h), o.w * view.scale, o.h * view.scale)
  }

  drawPath(ctx, props, sx, sy)
  drawCar(ctx, props, sx, sy)
}

function drawSpot(
  ctx: CanvasRenderingContext2D,
  props: Props,
  spot: Spot,
  sx: (x: number) => number,
  sy: (y: number) => number
): void {
  const r = spot.rect
  const cx = sx(r.x + r.w / 2)
  const cy = sy(r.y + r.h / 2)
  const w = r.w * (sx(1) - sx(0))
  const h = r.h * (sy(0) - sy(1))

  const hovered = props.hoveredSpotId === spot.id
  const selected = props.selectedSpotId === spot.id
  const occupied = props.occupied.has(spot.id)

  ctx.save()
  ctx.translate(cx, cy)
  if (spot.angle !== 0) ctx.rotate(-spot.angle)
  ctx.fillStyle = occupied ? '#c2c9d0' : selected ? '#4f9d5b' : hovered ? '#a9d6ab' : '#f4f6f7'
  ctx.strokeStyle = selected ? '#2e6b38' : '#8a949d'
  ctx.lineWidth = selected ? 3 : 1.5
  ctx.fillRect(-w / 2, -h / 2, w, h)
  ctx.strokeRect(-w / 2, -h / 2, w, h)

  ctx.fillStyle = occupied ? '#6b737c' : selected ? '#ffffff' : '#4a5560'
  ctx.font = `${Math.max(11, w * 0.22)}px "Segoe UI", sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(occupied ? '已停' : 'P', 0, 0)
  ctx.restore()
}

function drawPath(
  ctx: CanvasRenderingContext2D,
  props: Props,
  sx: (x: number) => number,
  sy: (y: number) => number
): void {
  const path = props.path
  if (path.length < 2) return
  const split = Math.min(props.retrySplitIndex, path.length)

  const stroke = (start: number, end: number, color: string, dash: number[], width: number) => {
    ctx.strokeStyle = color
    ctx.lineWidth = width
    ctx.setLineDash(dash)
    ctx.beginPath()
    ctx.moveTo(sx(path[start].x), sy(path[start].y))
    for (let i = start + 1; i <= end; i++) {
      ctx.lineTo(sx(path[i].x), sy(path[i].y))
    }
    ctx.stroke()
    ctx.setLineDash([])
  }

  if (split > 1) stroke(0, split - 1, '#9aa4ad', [6, 6], 3)
  if (split < path.length - 1) stroke(split, path.length - 1, '#2f7cf6', [], 4)

  // Direction arrows
  ctx.fillStyle = split > 1 ? '#8a949d' : '#2f7cf6'
  let walked = 0
  for (let i = 1; i < path.length; i++) {
    walked += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y)
    if (walked >= 1.4 && i % 3 === 0) {
      const p = path[i]
      const angle = -p.heading
      const px = sx(p.x)
      const py = sy(p.y)
      ctx.save()
      ctx.translate(px, py)
      ctx.rotate(angle)
      ctx.beginPath()
      ctx.moveTo(9, 0)
      ctx.lineTo(-4, -5)
      ctx.lineTo(-4, 5)
      ctx.closePath()
      ctx.fill()
      ctx.restore()
      walked = 0
    }
  }
}

function drawCar(
  ctx: CanvasRenderingContext2D,
  props: Props,
  sx: (x: number) => number,
  sy: (y: number) => number
): void {
  const car = props.world.car
  const p = props.carPose
  const scale = sx(1) - sx(0)
  const px = sx(p.x)
  const py = sy(p.y)
  const w = car.width * scale
  const l = car.length * scale

  ctx.save()
  ctx.translate(px, py)
  ctx.rotate(-p.heading)

  // Shadow
  ctx.fillStyle = 'rgba(20, 26, 32, 0.35)'
  ctx.beginPath()
  ctx.roundRect(-l / 2 + 2, -w / 2 + 3, l, w, 5)
  ctx.fill()

  // Body
  ctx.fillStyle = '#d6455f'
  ctx.strokeStyle = '#8f2c3f'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.roundRect(-l / 2, -w / 2, l, w, 5)
  ctx.fill()
  ctx.stroke()

  // Windshield
  ctx.fillStyle = '#cfe6f2'
  ctx.beginPath()
  ctx.roundRect(l * 0.12, -w * 0.34, l * 0.24, w * 0.68, 3)
  ctx.fill()

  // Rear window
  ctx.fillStyle = '#cfe6f2'
  ctx.beginPath()
  ctx.roundRect(-l * 0.38, -w * 0.3, l * 0.16, w * 0.6, 2)
  ctx.fill()

  // Front marker
  ctx.fillStyle = '#ffe08a'
  ctx.beginPath()
  ctx.moveTo(l / 2, 0)
  ctx.lineTo(l / 2 - 5, -4)
  ctx.lineTo(l / 2 - 5, 4)
  ctx.closePath()
  ctx.fill()

  const wheel = (wx: number, wy: number, steer: number) => {
    ctx.save()
    ctx.translate(wx, wy)
    ctx.rotate(-steer)
    ctx.fillStyle = '#20262d'
    ctx.fillRect(-l * 0.055, -w * 0.13, l * 0.11, w * 0.26)
    ctx.restore()
  }
  const steer = p.steering || 0
  wheel(-l * 0.26, -w / 2 + 1, steer)
  wheel(-l * 0.26, w / 2 - 1, steer)
  wheel(l * 0.26, -w / 2 + 1, 0)
  wheel(l * 0.26, w / 2 - 1, 0)

  ctx.restore()
}
