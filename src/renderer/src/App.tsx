import { useMemo, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import type { LayoutId } from '../../core/types'
import { ANIMATION } from '../../core/config'
import { createWorld, LAYOUT_OPTIONS } from '../../core/world'
import { ParkingLotCanvas } from './ParkingLotCanvas'
import { useParkingSimulation } from './useParkingSimulation'

export function App(): JSX.Element {
  const [layoutId, setLayoutId] = useState<LayoutId>('perpendicular')
  return <ParkingScene key={layoutId} layoutId={layoutId} onLayoutChange={setLayoutId} />
}

interface SceneProps {
  layoutId: LayoutId
  onLayoutChange: (id: LayoutId) => void
}

function ParkingScene({ layoutId, onLayoutChange }: SceneProps): JSX.Element {
  const world = useMemo(() => createWorld(layoutId), [layoutId])
  const sim = useParkingSimulation(layoutId)

  return (
    <div className="app">
      <main className="scene">
        <div className="status-strip">
          <span className={`status-dot status-${sim.status}`} />
          <span className="status-text">{sim.statusText}</span>
          <span className="status-target">目标车位：{sim.selectedSpotId ?? '未选择'}</span>
        </div>
        <ParkingLotCanvas
          world={world}
          selectedSpotId={sim.selectedSpotId}
          hoveredSpotId={sim.hoveredSpotId}
          path={sim.path}
          retrySplitIndex={sim.retrySplitIndex}
          carPose={sim.carPose}
          occupied={sim.occupied}
          onHover={sim.setHoveredSpotId}
          onSelect={sim.selectSpot}
        />
      </main>
      <aside className="panel">
        <h1>自动泊车</h1>
        <section className="control-group">
          <label>停车场布局</label>
          <div className="segmented layout-switch">
            {LAYOUT_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                className={layoutId === opt.id ? 'active' : ''}
                onClick={() => onLayoutChange(opt.id)}
              >
                {opt.name}
              </button>
            ))}
          </div>
        </section>
        <section className="control-group">
          <label>播放速度</label>
          <div className="segmented">
            {ANIMATION.speedOptions.map((v) => (
              <button
                key={v}
                className={sim.speedMultiplier === v ? 'active' : ''}
                onClick={() => sim.setSpeedMultiplier(v)}
              >
                {v}x
              </button>
            ))}
          </div>
        </section>
        <section className="control-group">
          <label>场地</label>
          <p className="lot-info">
            {world.layoutName} · {world.spots.length} 个车位
          </p>
        </section>
        <section className="control-group">
          <button className="reset-button" onClick={sim.reset}>
            <RotateCcw size={16} />
            重新开始
          </button>
        </section>
      </aside>
    </div>
  )
}
