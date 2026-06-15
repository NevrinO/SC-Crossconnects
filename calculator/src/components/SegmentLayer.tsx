import { GridBounds, gridToScreenCenter } from '../lib/grid-utils'
import { PathSegment } from '../types/room'

interface SegmentLayerProps {
  bounds: GridBounds
  cellSize: number
  orientation: 'numbers-vertical' | 'numbers-horizontal'
  segments: PathSegment[]
  selectedPathSegments?: PathSegment[]
  cableType?: 'fiber' | 'copper' | null
}

export function SegmentLayer({
  bounds,
  cellSize,
  orientation,
  segments,
  selectedPathSegments = [],
  cableType,
}: SegmentLayerProps) {
  // Determine segment visual state
  const getSegmentState = (segment: PathSegment): 'muted' | 'available' | 'selected' => {
    // Check if segment is in selected path
    if (selectedPathSegments.some(s => s.id === segment.id)) {
      return 'selected'
    }

    // Check if segment is available for selected cable type
    if (cableType) {
      const isFiber = cableType === 'fiber'
      const hasFiber = segment.fiberHeight !== null
      const hasCopper = segment.copperHeight !== null

      if (isFiber && hasFiber) return 'available'
      if (!isFiber && hasCopper) return 'available'
    }

    return 'muted'
  }

  // Get segment style based on state
  const getSegmentStyle = (state: 'muted' | 'available' | 'selected') => {
    switch (state) {
      case 'selected':
        return { stroke: '#2563eb', strokeWidth: 4, opacity: 1 } // blue-600, thick
      case 'available':
        return { stroke: '#60a5fa', strokeWidth: 2, opacity: 0.7 } // blue-400, medium
      case 'muted':
      default:
        return { stroke: '#d1d5db', strokeWidth: 1, opacity: 0.4 } // gray-300, thin
    }
  }

  return (
    <g>
      {segments.map(segment => {
        const startPos = gridToScreenCenter(segment.start, bounds, cellSize, orientation)
        const endPos = gridToScreenCenter(segment.end, bounds, cellSize, orientation)
        if (!startPos || !endPos) return null

        const state = getSegmentState(segment)
        const style = getSegmentStyle(state)

        return (
          <line
            key={segment.id}
            x1={startPos.x}
            y1={startPos.y}
            x2={endPos.x}
            y2={endPos.y}
            stroke={style.stroke}
            strokeWidth={style.strokeWidth}
            opacity={style.opacity}
            strokeLinecap="round"
          />
        )
      })}
    </g>
  )
}
