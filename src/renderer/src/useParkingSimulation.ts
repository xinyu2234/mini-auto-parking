import { useCallback, useEffect, useRef, useState } from 'react'
import type { PathSample, PlannerResult, Pose, World } from '../../core/types'
import { ANIMATION, RETRY } from '../../core/config'
import { buildReverseSegment } from '../../core/retry'
import { getSpotById } from '../../core/world'
import { pathLength, sampleAt } from './pathUtils'

export type AppStatus = 'idle' | 'planning' | 'reversing' | 'parking' | 'done' | 'failed'

export interface Simulation {
  status: AppStatus
  statusText: string
  selectedSpotId: string | null
  hoveredSpotId: string | null
  setHoveredSpotId: (id: string | null) => void
  carPose: PathSample
  path: PathSample[]
  retrySplitIndex: number
  occupied: Set<string>
  speedMultiplier: number
  setSpeedMultiplier: (v: number) => void
  selectSpot: (id: string) => void
  reset: () => void
}

function statusText(status: AppStatus): string {
  switch (status) {
    case 'idle':
      return '请选择目标车位'
    case 'planning':
      return '正在规划路径…'
    case 'reversing':
      return '正在倒车调整…'
    case 'parking':
      return '正在泊车…'
    case 'done':
      return '停车已完成'
    case 'failed':
      return '未找到可行路径，请换一个车位试试'
  }
}

export function useParkingSimulation(world: World): Simulation {
  const worldRef = useRef<World>(world)
  const [status, setStatus] = useState<AppStatus>('idle')
  const [selectedSpotId, setSelectedSpotId] = useState<string | null>(null)
  const [hoveredSpotId, setHoveredSpotId] = useState<string | null>(null)
  const [carPose, setCarPose] = useState<PathSample>({
    ...worldRef.current.startPose,
    dir: 1,
    steering: 0
  })
  const [path, setPath] = useState<PathSample[]>([])
  const [retrySplitIndex, setRetrySplitIndex] = useState(0)
  const [occupied, setOccupied] = useState<Set<string>>(new Set())
  const [speedMultiplier, setSpeedMultiplierState] = useState(1)

  const statusRef = useRef<AppStatus>('idle')
  const selectedRef = useRef<string | null>(null)
  const carPoseRef = useRef<PathSample>(carPose)
  const pathRef = useRef<PathSample[]>([])
  const retrySamplesRef = useRef<PathSample[]>([])
  const attemptRef = useRef(0)
  const workerRef = useRef<Worker | null>(null)
  const rafRef = useRef<number | null>(null)
  const speedRef = useRef(1)
  const requestIdRef = useRef(0)
  const occupiedRef = useRef<Set<string>>(new Set())

  const setStatusSafe = useCallback((s: AppStatus) => {
    statusRef.current = s
    setStatus(s)
  }, [])

  const cancelAnimation = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [])

  const terminateWorker = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.terminate()
      workerRef.current = null
    }
  }, [])

  const animatePath = useCallback(
    (samples: PathSample[], baseSpeed: number, onDone: () => void, startProgress = 0) => {
      cancelAnimation()
      const total = pathLength(samples)
      if (total < 1e-6) {
        onDone()
        return
      }
      let progress = startProgress
      let last = performance.now()
      const tick = (now: number) => {
        const dt = Math.min(0.05, Math.max(0, (now - last) / 1000))
        last = now
        progress += baseSpeed * speedRef.current * dt
        if (progress >= total) {
          const end = samples[samples.length - 1]
          carPoseRef.current = end
          setCarPose(end)
          onDone()
          return
        }
        const s = sampleAt(samples, progress)
        carPoseRef.current = s
        setCarPose(s)
        rafRef.current = requestAnimationFrame(tick)
      }
      rafRef.current = requestAnimationFrame(tick)
    },
    [cancelAnimation]
  )

  const startAttempt = useCallback(
    (attempt: number) => {
      const spotId = selectedRef.current
      if (!spotId) return
      const spot = getSpotById(worldRef.current, spotId)
      if (!spot) return
      terminateWorker()
      setStatusSafe('planning')
      const worker = new Worker(new URL('./planner.worker.ts', import.meta.url), { type: 'module' })
      workerRef.current = worker
      const reqId = ++requestIdRef.current
      worker.onmessage = (e: MessageEvent<PlannerResult>) => {
        if (e.data.requestId !== reqId) return
        const result = e.data
        if (result.status === 'found') {
          pathRef.current = [...retrySamplesRef.current, ...result.path]
          setPath(pathRef.current)
          setRetrySplitIndex(retrySamplesRef.current.length)
          const samples = pathRef.current
          animatePath(
            samples,
            ANIMATION.forwardSpeed,
            () => {
              setStatusSafe('done')
              const next = new Set(occupiedRef.current)
              next.add(spotId)
              occupiedRef.current = next
              setOccupied(next)
            },
            pathLength(retrySamplesRef.current)
          )
          return
        }

        if (attempt < RETRY.maxAttempts - 1) {
          const reverse = buildReverseSegment(worldRef.current, carPoseRef.current, RETRY.distance)
          if (reverse.length > 0) {
            retrySamplesRef.current = [...retrySamplesRef.current, ...reverse]
            setStatusSafe('reversing')
            pathRef.current = [...retrySamplesRef.current]
            setPath(pathRef.current)
            setRetrySplitIndex(retrySamplesRef.current.length)
            animatePath(reverse, ANIMATION.reverseSpeed, () => {
              startAttempt(attempt + 1)
            })
            return
          }
          startAttempt(attempt + 1)
          return
        }

        pathRef.current = []
        setPath([])
        setRetrySplitIndex(0)
        setStatusSafe('failed')
      }
      worker.postMessage({
        requestId: reqId,
        world: worldRef.current,
        startPose: carPoseRef.current,
        goalPose: spot.goalPose,
        budgetMs: RETRY.budgetsMs[attempt] ?? RETRY.budgetsMs[RETRY.budgetsMs.length - 1],
        attempt
      })
    },
    [animatePath, setStatusSafe, terminateWorker]
  )

  const reset = useCallback(() => {
    terminateWorker()
    cancelAnimation()
    retrySamplesRef.current = []
    attemptRef.current = 0
    pathRef.current = []
    setPath([])
    setRetrySplitIndex(0)
    const start: PathSample = { ...worldRef.current.startPose, dir: 1, steering: 0 }
    carPoseRef.current = start
    setCarPose(start)
    setSelectedSpotId(null)
    selectedRef.current = null
    setHoveredSpotId(null)
    setStatusSafe('idle')
    occupiedRef.current = new Set()
    setOccupied(new Set())
  }, [cancelAnimation, setStatusSafe, terminateWorker])

  const selectSpot = useCallback(
    (id: string) => {
      const spot = getSpotById(worldRef.current, id)
      if (!spot) return
      if (spot.occupied) return
      if (occupiedRef.current.has(id)) return
      if (statusRef.current === 'planning' || statusRef.current === 'parking' || statusRef.current === 'reversing') {
        return
      }
      if (statusRef.current === 'done' || statusRef.current === 'failed') {
        terminateWorker()
        cancelAnimation()
        retrySamplesRef.current = []
        pathRef.current = []
        setPath([])
        setRetrySplitIndex(0)
        const start: PathSample = { ...worldRef.current.startPose, dir: 1, steering: 0 }
        carPoseRef.current = start
        setCarPose(start)
      }
      setSelectedSpotId(id)
      selectedRef.current = id
      attemptRef.current = 0
      startAttempt(0)
    },
    [cancelAnimation, startAttempt, terminateWorker]
  )

  const setSpeedMultiplier = useCallback((v: number) => {
    speedRef.current = v
    setSpeedMultiplierState(v)
  }, [])

  useEffect(() => {
    return () => {
      terminateWorker()
      cancelAnimation()
    }
  }, [cancelAnimation, terminateWorker])

  return {
    status,
    statusText: statusText(status),
    selectedSpotId,
    hoveredSpotId,
    setHoveredSpotId,
    carPose,
    path,
    retrySplitIndex,
    occupied,
    speedMultiplier,
    setSpeedMultiplier,
    selectSpot,
    reset
  }
}
