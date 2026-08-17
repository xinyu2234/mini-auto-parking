import { useMemo } from 'react'
import { RotateCcw } from 'lucide-react'
import { ANIMATION } from '../../core/config'
import { createWorld } from '../../core/world'
import { ParkingLotCanvas } from './ParkingLotCanvas'
import { useParkingSimulation } from './useParkingSimulation'

export function App(): JSX.Element {
  const world = useMemo(() => createWorld(), [])
  const sim = useParkingSimulation()

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
            {world.spots.length} 个车位 · 顶部 {world.spots.filter((s) => s.id.startsWith('T')).length} ·
            左墙 {world.spots.filter((s) => s.id.startsWith('L')).length} ·
            右墙 {world.spots.filter((s) => s.id.startsWith('R')).length}
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
